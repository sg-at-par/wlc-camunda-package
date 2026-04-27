-- =============================================================================
-- queries/runtime_queries.sql
-- Write-path queries executed during form submission and process lifecycle.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE_PROCESS_INSTANCE
-- Called after Camunda confirms a new process instance was started.
-- $1 workflow_id, $2 camunda_instance_key, $3 first_step_id,
-- $4 initiated_by, $5 tenant_id
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.CREATE_PROCESS_INSTANCE
INSERT INTO process_instances (
    workflow_id,
    camunda_instance_key,
    current_step_id,
    status,
    initiated_by,
    tenant_id
)
VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
RETURNING id, camunda_instance_key;


-- ─────────────────────────────────────────────────────────────────────────────
-- ADVANCE_INSTANCE_STEP
-- After user submits a step: update the instance to point to the next step.
-- $1 next_step_id (workflow_steps.id), $2 next_task_id, $3 instance_id (WLC pk)
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.ADVANCE_INSTANCE_STEP
UPDATE process_instances
SET
    current_step_id          = $1,
    current_camunda_task_id  = $2,
    status                   = 'ACTIVE'
WHERE id = $3
RETURNING id, current_step_id, current_camunda_task_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- COMPLETE_INSTANCE
-- Called when Camunda signals the process has ended.
-- $1 instance_id
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.COMPLETE_INSTANCE
UPDATE process_instances
SET
    status        = 'COMPLETED',
    completed_at  = NOW()
WHERE id = $1
RETURNING id, status, completed_at;


-- ─────────────────────────────────────────────────────────────────────────────
-- SAVE_STEP_SUBMISSION
-- Persist WLC business data + Camunda variable snapshot for one step.
-- $1 instance_id, $2 step_id (workflow_steps.id),
-- $3 wlc_data (JSONB), $4 camunda_variables (JSONB),
-- $5 camunda_task_id, $6 submitted_by, $7 correlation_id
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.SAVE_STEP_SUBMISSION
INSERT INTO step_submissions (
    instance_id,
    step_id,
    wlc_data,
    camunda_variables,
    camunda_task_id,
    submitted_by,
    correlation_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, submitted_at;


-- ─────────────────────────────────────────────────────────────────────────────
-- UPSERT_WORKFLOW
-- Admin: register or update a Camunda process definition in the WLC.
-- $1 camunda_process_key, $2 display_name, $3 description, $4 version
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.UPSERT_WORKFLOW
INSERT INTO camunda_workflows (
    camunda_process_key,
    display_name,
    description,
    version
)
VALUES ($1, $2, $3, $4)
ON CONFLICT (camunda_process_key) DO UPDATE
    SET display_name  = EXCLUDED.display_name,
        description   = EXCLUDED.description,
        version       = EXCLUDED.version,
        updated_at    = NOW()
RETURNING id, camunda_process_key;


-- ─────────────────────────────────────────────────────────────────────────────
-- UPSERT_STEP_TEMPLATE
-- Admin: create or replace the JSON form template for a step.
-- $1 camunda_process_key, $2 camunda_step_id, $3 step_name,
-- $4 step_order, $5 form_template (JSONB)
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.UPSERT_STEP_TEMPLATE
INSERT INTO workflow_steps (
    workflow_id,
    camunda_step_id,
    step_name,
    step_order,
    form_template
)
SELECT
    cw.id, $2, $3, $4, $5::JSONB
FROM camunda_workflows cw
WHERE cw.camunda_process_key = $1
ON CONFLICT (workflow_id, camunda_step_id) DO UPDATE
    SET step_name     = EXCLUDED.step_name,
        step_order    = EXCLUDED.step_order,
        form_template = EXCLUDED.form_template,
        updated_at    = NOW()
RETURNING id, camunda_step_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- DEACTIVATE_STEP
-- Soft-delete a step so it is no longer returned to the renderer.
-- $1 camunda_process_key, $2 camunda_step_id
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.DEACTIVATE_STEP
UPDATE workflow_steps ws
SET is_active = FALSE
FROM camunda_workflows cw
WHERE cw.id                  = ws.workflow_id
  AND cw.camunda_process_key = $1
  AND ws.camunda_step_id     = $2
RETURNING ws.id, ws.camunda_step_id;
