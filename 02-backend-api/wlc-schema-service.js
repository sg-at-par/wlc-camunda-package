// =============================================================================
// api/wlc-schema-service.js
// Business logic layer between the REST API and the database.
// All Camunda ↔ WLC data routing decisions live here.
// =============================================================================

'use strict';

const { query, transaction } = require('./db');

// ─────────────────────────────────────────────────────────────────────────────
// Schema / Catalog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all active workflows (for the sidebar catalog).
 * @returns {Promise<Array>}
 */
async function listWorkflows() {
  const { rows } = await query('LIST_ACTIVE_WORKFLOWS');
  return rows;
}

/**
 * Get all step definitions for a workflow in order.
 * Used to pre-load the progress tracker.
 * @param {string} camundaProcessKey
 * @returns {Promise<Array>}
 */
async function getWorkflowSteps(camundaProcessKey) {
  const { rows } = await query('GET_ALL_STEPS_FOR_WORKFLOW', [camundaProcessKey]);
  return rows;
}

/**
 * THE primary API call: given a Camunda process key and a step id,
 * return the JSON form template the WLC renderer needs.
 *
 * Called after:
 *   GET /v1/user-tasks?processInstanceKey=…  → tasks[0].taskDefinitionId
 *
 * @param {string} camundaProcessKey  e.g. 'customer-onboarding-v2'
 * @param {string} camundaStepId      e.g. 'step-kyc'
 * @returns {Promise<object|null>}
 */
async function getFormTemplate(camundaProcessKey, camundaStepId) {
  const { rows } = await query('GET_FORM_TEMPLATE', [camundaProcessKey, camundaStepId]);
  if (!rows.length) return null;

  const row = rows[0];
  // Return the stored template enriched with DB metadata
  return {
    stepPk:            row.step_pk,
    camundaStepId:     row.camunda_step_id,
    stepName:          row.step_name,
    stepOrder:         row.step_order,
    formTemplate:      row.form_template,        // the JSONB blob the renderer uses
    validationSchema:  row.validation_schema,
    workflowName:      row.workflow_name,
    camundaProcessKey: row.camunda_process_key,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Process Instance Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a new process instance in the WLC DB after Camunda has started it.
 *
 * @param {object} opts
 * @param {string}  opts.camundaProcessKey     - the BPMN process id
 * @param {bigint}  opts.camundaInstanceKey    - key from Camunda POST response
 * @param {string}  opts.firstStepId           - camunda_step_id of the first user task
 * @param {string=} opts.initiatedBy           - user id
 * @param {string=} opts.tenantId
 * @returns {Promise<{id: number, camundaInstanceKey: bigint}>}
 */
async function createProcessInstance({ camundaProcessKey, camundaInstanceKey, firstStepId, initiatedBy, tenantId }) {
  return transaction(async (client) => {
    // Resolve the workflow PK
    const wfRes = await client.query(
      `SELECT id FROM camunda_workflows WHERE camunda_process_key = $1 AND is_active = TRUE`,
      [camundaProcessKey]
    );
    if (!wfRes.rows.length) throw new Error(`Workflow not found: ${camundaProcessKey}`);
    const workflowId = wfRes.rows[0].id;

    // Resolve the first step PK
    const stepRes = await client.query(
      `SELECT id FROM workflow_steps WHERE workflow_id = $1 AND camunda_step_id = $2 AND is_active = TRUE`,
      [workflowId, firstStepId]
    );
    if (!stepRes.rows.length) throw new Error(`Step not found: ${firstStepId}`);
    const firstStepPk = stepRes.rows[0].id;

    // Create the instance row
    const instRes = await client.query(
      `INSERT INTO process_instances (workflow_id, camunda_instance_key, current_step_id, status, initiated_by, tenant_id)
       VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
       RETURNING id, camunda_instance_key`,
      [workflowId, camundaInstanceKey, firstStepPk, initiatedBy ?? null, tenantId ?? null]
    );

    // Audit
    await client.query(
      `SELECT log_audit_event('PROCESS_STARTED', $1, $2, $3, $4, NULL, $5, $6, $7::JSONB, $8, NULL)`,
      [workflowId, firstStepPk, instRes.rows[0].id, camundaInstanceKey,
       camundaProcessKey, firstStepId,
       JSON.stringify({ initiatedBy }), initiatedBy ?? 'system']
    );

    return { id: instRes.rows[0].id, camundaInstanceKey: instRes.rows[0].camunda_instance_key };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Submission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a completed step submission.
 * Splits form data into WLC fields and Camunda variable snapshot.
 * Advances the instance to the next step.
 *
 * @param {object} opts
 * @param {number}  opts.instanceId           - process_instances.id (WLC pk)
 * @param {string}  opts.camundaProcessKey
 * @param {string}  opts.currentStepId        - camunda_step_id just completed
 * @param {string}  opts.nextStepId           - camunda_step_id to advance to (null if last)
 * @param {string}  opts.camundaTaskId        - the task id completed in Camunda
 * @param {object}  opts.wlcData              - WLC-only field values
 * @param {object}  opts.camundaVariables     - variables sent to Camunda
 * @param {string=} opts.submittedBy
 * @param {string=} opts.correlationId
 * @returns {Promise<{submissionId: number}>}
 */
async function saveStepSubmission({
  instanceId, camundaProcessKey,
  currentStepId, nextStepId,
  camundaTaskId,
  wlcData, camundaVariables,
  submittedBy, correlationId,
}) {
  return transaction(async (client) => {
    // Resolve current step PK
    const stepRes = await client.query(
      `SELECT ws.id, ws.workflow_id, pi.camunda_instance_key
       FROM workflow_steps ws
       JOIN process_instances pi ON pi.workflow_id = ws.workflow_id
       WHERE pi.id = $1 AND ws.camunda_step_id = $2`,
      [instanceId, currentStepId]
    );
    if (!stepRes.rows.length) throw new Error(`Step not found: ${currentStepId} for instance ${instanceId}`);
    const { id: stepPk, workflow_id: workflowId, camunda_instance_key: camundaInstanceKey } = stepRes.rows[0];

    // Write business data
    const subRes = await client.query(
      `INSERT INTO step_submissions (instance_id, step_id, wlc_data, camunda_variables, camunda_task_id, submitted_by, correlation_id)
       VALUES ($1, $2, $3::JSONB, $4::JSONB, $5, $6, $7)
       RETURNING id, submitted_at`,
      [instanceId, stepPk, JSON.stringify(wlcData), JSON.stringify(camundaVariables),
       camundaTaskId ?? null, submittedBy ?? null, correlationId ?? null]
    );

    // Audit: WLC data saved
    await client.query(
      `SELECT log_audit_event('STEP_DATA_SAVED', $1, $2, $3, $4, $5, $6, $7, $8::JSONB, $9, $10)`,
      [workflowId, stepPk, instanceId, camundaInstanceKey, camundaTaskId,
       camundaProcessKey, currentStepId,
       JSON.stringify({ wlcFields: Object.keys(wlcData), camundaVarKeys: Object.keys(camundaVariables) }),
       submittedBy ?? 'system', correlationId ?? null]
    );

    // Advance to next step if there is one
    if (nextStepId) {
      const nextStepRes = await client.query(
        `SELECT id FROM workflow_steps ws
         JOIN process_instances pi ON pi.workflow_id = ws.workflow_id
         WHERE pi.id = $1 AND ws.camunda_step_id = $2`,
        [instanceId, nextStepId]
      );

      if (nextStepRes.rows.length) {
        await client.query(
          `UPDATE process_instances SET current_step_id = $1, current_camunda_task_id = NULL WHERE id = $2`,
          [nextStepRes.rows[0].id, instanceId]
        );
      }
    } else {
      // Mark complete
      await client.query(
        `UPDATE process_instances SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
        [instanceId]
      );
      await client.query(
        `SELECT log_audit_event('PROCESS_COMPLETED', $1, NULL, $2, $3, NULL, $4, NULL, NULL, $5, NULL)`,
        [workflowId, instanceId, camundaInstanceKey, camundaProcessKey, submittedBy ?? 'system']
      );
    }

    return { submissionId: subRes.rows[0].id, submittedAt: subRes.rows[0].submitted_at };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: manage templates
// ─────────────────────────────────────────────────────────────────────────────

async function upsertWorkflow({ camundaProcessKey, displayName, description, version }) {
  const { rows } = await query('UPSERT_WORKFLOW', [camundaProcessKey, displayName, description ?? null, version ?? '1.0.0']);
  return rows[0];
}

async function upsertStepTemplate({ camundaProcessKey, camundaStepId, stepName, stepOrder, formTemplate }) {
  const { rows } = await query('UPSERT_STEP_TEMPLATE', [
    camundaProcessKey, camundaStepId, stepName, stepOrder ?? 0, JSON.stringify(formTemplate),
  ]);
  return rows[0];
}

async function deactivateStep(camundaProcessKey, camundaStepId) {
  const { rows } = await query('DEACTIVATE_STEP', [camundaProcessKey, camundaStepId]);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries / reporting
// ─────────────────────────────────────────────────────────────────────────────

async function getActiveInstances() {
  const { rows } = await query('GET_ACTIVE_INSTANCES');
  return rows;
}

async function getInstanceHistory(camundaInstanceKey) {
  const { rows } = await query('GET_INSTANCE_HISTORY', [camundaInstanceKey]);
  return rows;
}

async function getAuditLog(camundaInstanceKey) {
  const { rows } = await query('GET_AUDIT_FOR_INSTANCE', [camundaInstanceKey]);
  return rows;
}

module.exports = {
  // Catalog
  listWorkflows,
  getWorkflowSteps,
  getFormTemplate,
  // Lifecycle
  createProcessInstance,
  saveStepSubmission,
  // Admin
  upsertWorkflow,
  upsertStepTemplate,
  deactivateStep,
  // Reporting
  getActiveInstances,
  getInstanceHistory,
  getAuditLog,
};
