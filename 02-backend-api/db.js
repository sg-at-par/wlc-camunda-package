// =============================================================================
// api/db.js
// PostgreSQL connection pool shared by all WLC services.
// Uses the `pg` driver (npm install pg).
// =============================================================================

'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'wlc_camunda',
  user:     process.env.PGUSER     || 'wlc_app',
  password: process.env.PGPASSWORD || 'changeme',

  // Pool sizing — tune for your on-prem PostgreSQL server
  max:              10,   // maximum concurrent connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Log pool errors to avoid uncaught exceptions
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ─────────────────────────────────────────────────────────────────────────────
// Named SQL queries
// All SQL lives here (not inline in service files) so it can be reviewed,
// tested, and diffed independently.
// ─────────────────────────────────────────────────────────────────────────────

const queries = {
  // ── Schema / catalog (read) ───────────────────────────────────────────────

  LIST_ACTIVE_WORKFLOWS: `
    SELECT
        cw.id,
        cw.camunda_process_key,
        cw.display_name,
        cw.description,
        cw.version,
        COUNT(ws.id)::INT AS step_count
    FROM camunda_workflows cw
    LEFT JOIN workflow_steps ws
        ON ws.workflow_id = cw.id AND ws.is_active = TRUE
    WHERE cw.is_active = TRUE
    GROUP BY cw.id
    ORDER BY cw.display_name
  `,

  GET_ALL_STEPS_FOR_WORKFLOW: `
    SELECT
        ws.id,
        ws.camunda_step_id,
        ws.step_name,
        ws.step_order
    FROM workflow_steps    ws
    JOIN camunda_workflows cw ON cw.id = ws.workflow_id
    WHERE cw.camunda_process_key = $1
      AND ws.is_active  = TRUE
      AND cw.is_active  = TRUE
    ORDER BY ws.step_order ASC
  `,

  GET_FORM_TEMPLATE: `
    SELECT
        ws.id               AS step_pk,
        ws.camunda_step_id,
        ws.step_name,
        ws.step_order,
        ws.form_template,
        ws.validation_schema,
        cw.camunda_process_key,
        cw.display_name     AS workflow_name
    FROM workflow_steps    ws
    JOIN camunda_workflows cw ON cw.id = ws.workflow_id
    WHERE cw.camunda_process_key = $1
      AND ws.camunda_step_id     = $2
      AND ws.is_active           = TRUE
      AND cw.is_active           = TRUE
    LIMIT 1
  `,

  // ── Runtime (read) ────────────────────────────────────────────────────────

  GET_ACTIVE_INSTANCES: `
    SELECT
        pi.id,
        pi.camunda_instance_key,
        cw.camunda_process_key,
        cw.display_name         AS workflow_name,
        ws.step_name            AS current_step,
        pi.initiated_by,
        pi.started_at,
        pi.last_activity_at
    FROM process_instances pi
    JOIN camunda_workflows cw ON cw.id = pi.workflow_id
    LEFT JOIN workflow_steps ws ON ws.id = pi.current_step_id
    WHERE pi.status = 'ACTIVE'
    ORDER BY pi.last_activity_at DESC
  `,

  GET_INSTANCE_BY_CAMUNDA_KEY: `
    SELECT
        pi.id,
        pi.workflow_id,
        pi.camunda_instance_key,
        pi.current_step_id,
        pi.current_camunda_task_id,
        pi.status,
        pi.initiated_by,
        pi.started_at
    FROM process_instances pi
    WHERE pi.camunda_instance_key = $1
    LIMIT 1
  `,

  GET_INSTANCE_HISTORY: `
    SELECT
        ws.camunda_step_id,
        ws.step_name,
        ws.step_order,
        ss.wlc_data,
        ss.camunda_variables,
        ss.camunda_task_id,
        ss.submitted_by,
        ss.submitted_at
    FROM step_submissions  ss
    JOIN process_instances pi ON pi.id = ss.instance_id
    JOIN workflow_steps    ws ON ws.id = ss.step_id
    WHERE pi.camunda_instance_key = $1
    ORDER BY ws.step_order, ss.submitted_at
  `,

  GET_AUDIT_FOR_INSTANCE: `
    SELECT
        al.event_type,
        al.camunda_step_id,
        al.camunda_task_id,
        al.payload,
        al.actor,
        al.correlation_id,
        al.occurred_at
    FROM wlc_audit_log al
    WHERE al.camunda_instance_key = $1
    ORDER BY al.occurred_at ASC
  `,

  // ── Runtime (write) ───────────────────────────────────────────────────────

  CREATE_PROCESS_INSTANCE: `
    INSERT INTO process_instances (
        workflow_id, camunda_instance_key,
        current_step_id, status, initiated_by, tenant_id
    )
    VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
    RETURNING id, camunda_instance_key
  `,

  ADVANCE_INSTANCE_STEP: `
    UPDATE process_instances
    SET current_step_id         = $1,
        current_camunda_task_id = $2
    WHERE id = $3
    RETURNING id, current_step_id, current_camunda_task_id
  `,

  COMPLETE_INSTANCE: `
    UPDATE process_instances
    SET status = 'COMPLETED', completed_at = NOW()
    WHERE id = $1
    RETURNING id, status, completed_at
  `,

  SAVE_STEP_SUBMISSION: `
    INSERT INTO step_submissions (
        instance_id, step_id,
        wlc_data, camunda_variables,
        camunda_task_id, submitted_by, correlation_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, submitted_at
  `,

  // ── Admin (write) ─────────────────────────────────────────────────────────

  UPSERT_WORKFLOW: `
    INSERT INTO camunda_workflows (
        camunda_process_key, display_name, description, version
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (camunda_process_key) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            description  = EXCLUDED.description,
            version      = EXCLUDED.version,
            updated_at   = NOW()
    RETURNING id, camunda_process_key
  `,

  UPSERT_STEP_TEMPLATE: `
    INSERT INTO workflow_steps (
        workflow_id, camunda_step_id, step_name, step_order, form_template
    )
    SELECT cw.id, $2, $3, $4, $5::JSONB
    FROM camunda_workflows cw
    WHERE cw.camunda_process_key = $1
    ON CONFLICT (workflow_id, camunda_step_id) DO UPDATE
        SET step_name     = EXCLUDED.step_name,
            step_order    = EXCLUDED.step_order,
            form_template = EXCLUDED.form_template,
            updated_at    = NOW()
    RETURNING id, camunda_step_id
  `,

  DEACTIVATE_STEP: `
    UPDATE workflow_steps ws
    SET is_active = FALSE
    FROM camunda_workflows cw
    WHERE cw.id                  = ws.workflow_id
      AND cw.camunda_process_key = $1
      AND ws.camunda_step_id     = $2
    RETURNING ws.id, ws.camunda_step_id
  `,

  // ── Audit helper ──────────────────────────────────────────────────────────

  INSERT_AUDIT: `
    SELECT log_audit_event(
        $1::audit_event_type,   -- event_type
        $2,                     -- workflow_id
        $3,                     -- step_id
        $4,                     -- instance_id
        $5,                     -- camunda_instance_key
        $6,                     -- camunda_task_id
        $7,                     -- camunda_process_key
        $8,                     -- camunda_step_id
        $9::JSONB,              -- payload
        $10,                    -- actor
        $11                     -- correlation_id
    ) AS audit_id
  `,
};

/**
 * Execute a named query.
 * @param {keyof queries} name
 * @param {any[]} params
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(name, params = []) {
  const sql = queries[name];
  if (!sql) throw new Error(`Unknown query: ${name}`);
  try {
    return await pool.query(sql, params);
  } catch (err) {
    console.error(`[DB] Query "${name}" failed:`, err.message);
    throw err;
  }
}

/**
 * Execute multiple statements in a single transaction.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction, queries };
