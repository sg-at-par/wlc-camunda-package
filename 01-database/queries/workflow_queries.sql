-- =============================================================================
-- queries/workflow_queries.sql
-- Named read queries for the WLC Schema Service.
-- Each query is labelled with the JS constant name used in wlc-schema-service.js
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- GET_FORM_TEMPLATE
-- Primary hot path: given a Camunda process key + step id,
-- return the JSON template the renderer needs.
-- Called after: GET /v1/user-tasks responds with taskDefinitionId
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.GET_FORM_TEMPLATE
SELECT
    ws.id                   AS step_pk,
    ws.camunda_step_id,
    ws.step_name,
    ws.step_order,
    ws.form_template,
    ws.validation_schema,
    cw.camunda_process_key,
    cw.display_name         AS workflow_name
FROM workflow_steps    ws
JOIN camunda_workflows cw ON cw.id = ws.workflow_id
WHERE cw.camunda_process_key = $1   -- e.g. 'customer-onboarding-v2'
  AND ws.camunda_step_id     = $2   -- e.g. 'step-kyc'
  AND ws.is_active           = TRUE
  AND cw.is_active           = TRUE;


-- ─────────────────────────────────────────────────────────────────────────────
-- GET_ALL_STEPS_FOR_WORKFLOW
-- Returns all steps for a workflow in order — used to build the
-- progress tracker / step list in the UI sidebar.
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.GET_ALL_STEPS_FOR_WORKFLOW
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
ORDER BY ws.step_order ASC;


-- ─────────────────────────────────────────────────────────────────────────────
-- LIST_ACTIVE_WORKFLOWS
-- Populates the sidebar process catalog.
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.LIST_ACTIVE_WORKFLOWS
SELECT
    cw.id,
    cw.camunda_process_key,
    cw.display_name,
    cw.description,
    cw.version,
    COUNT(ws.id)::INT   AS step_count
FROM camunda_workflows cw
LEFT JOIN workflow_steps ws
    ON ws.workflow_id = cw.id AND ws.is_active = TRUE
WHERE cw.is_active = TRUE
GROUP BY cw.id
ORDER BY cw.display_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- GET_INSTANCE_HISTORY
-- Full submission history for a given Camunda process instance.
-- Used by the audit panel in the WLC admin UI.
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.GET_INSTANCE_HISTORY
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
WHERE pi.camunda_instance_key = $1   -- e.g. 2251799813685249
ORDER BY ws.step_order, ss.submitted_at;


-- ─────────────────────────────────────────────────────────────────────────────
-- GET_ACTIVE_INSTANCES
-- Dashboard query: all currently active process instances.
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.GET_ACTIVE_INSTANCES
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
ORDER BY pi.last_activity_at DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- GET_AUDIT_FOR_INSTANCE
-- All audit log entries for a specific Camunda process instance.
-- ─────────────────────────────────────────────────────────────────────────────
-- JS: queries.GET_AUDIT_FOR_INSTANCE
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
ORDER BY al.occurred_at ASC;
