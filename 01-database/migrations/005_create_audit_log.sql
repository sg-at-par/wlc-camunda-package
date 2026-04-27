-- =============================================================================
-- Migration 005: wlc_audit_log
-- Append-only audit trail for all significant WLC ↔ Camunda interactions.
-- Never UPDATE or DELETE from this table.
-- =============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'step_submissions') THEN
        RAISE EXCEPTION 'Run migrations 001–004 first.';
    END IF;
END;
$$;

CREATE TYPE audit_event_type AS ENUM (
    -- Process lifecycle
    'PROCESS_STARTED',
    'PROCESS_COMPLETED',
    'PROCESS_TERMINATED',
    'PROCESS_SUSPENDED',
    'PROCESS_INCIDENT',

    -- Step / task lifecycle
    'TASK_FETCHED',         -- WLC polled Camunda and got a task
    'TASK_COMPLETED',       -- WLC sent variables to Camunda to complete task
    'STEP_FORM_LOADED',     -- WLC retrieved JSON template from DB
    'STEP_DATA_SAVED',      -- WLC business data written to step_submissions

    -- Schema management
    'TEMPLATE_CREATED',
    'TEMPLATE_UPDATED',
    'TEMPLATE_DEACTIVATED',

    -- Errors
    'CAMUNDA_API_ERROR',
    'VALIDATION_ERROR',
    'SCHEMA_NOT_FOUND'
);

CREATE TABLE IF NOT EXISTS wlc_audit_log (
    -- -------------------------------------------------------------------------
    -- Identity (BIGSERIAL for high-volume append)
    -- -------------------------------------------------------------------------
    id                      BIGSERIAL       PRIMARY KEY,

    event_type              audit_event_type NOT NULL,

    -- -------------------------------------------------------------------------
    -- Context references (nullable — not all events have all refs)
    -- -------------------------------------------------------------------------
    workflow_id             INTEGER         REFERENCES camunda_workflows (id) ON DELETE SET NULL,
    step_id                 INTEGER         REFERENCES workflow_steps (id)    ON DELETE SET NULL,
    instance_id             INTEGER         REFERENCES process_instances (id) ON DELETE SET NULL,

    -- Camunda identifiers (denormalised for fast incident lookup without joins)
    camunda_instance_key    BIGINT,
    camunda_task_id         VARCHAR(255),
    camunda_process_key     VARCHAR(255),
    camunda_step_id         VARCHAR(255),

    -- -------------------------------------------------------------------------
    -- Event payload
    -- -------------------------------------------------------------------------
    -- Arbitrary extra data for the event (e.g. error message, variable names)
    payload                 JSONB,

    -- HTTP / system actor
    actor                   VARCHAR(255),
    correlation_id          VARCHAR(100),
    source_ip               INET,

    -- -------------------------------------------------------------------------
    -- Timestamp (partitioning key — use range partitioning in production)
    -- -------------------------------------------------------------------------
    occurred_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW()
)
-- Partition by month in production:
-- PARTITION BY RANGE (occurred_at);
;

-- Protect against accidental mutation
CREATE RULE no_update_audit AS ON UPDATE TO wlc_audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO wlc_audit_log DO INSTEAD NOTHING;

-- Query patterns
CREATE INDEX idx_audit_event_type         ON wlc_audit_log (event_type, occurred_at DESC);
CREATE INDEX idx_audit_instance_key       ON wlc_audit_log (camunda_instance_key) WHERE camunda_instance_key IS NOT NULL;
CREATE INDEX idx_audit_correlation        ON wlc_audit_log (correlation_id)       WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_audit_occurred_at        ON wlc_audit_log (occurred_at DESC);
CREATE INDEX idx_audit_payload_gin        ON wlc_audit_log USING GIN (payload)    WHERE payload IS NOT NULL;

-- -------------------------------------------------------------------------
-- Helper function: insert audit event from application code
-- Usage: SELECT log_audit_event('TASK_COMPLETED', p_instance_id := 1, ...)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_audit_event(
    p_event_type            audit_event_type,
    p_workflow_id           INTEGER  DEFAULT NULL,
    p_step_id               INTEGER  DEFAULT NULL,
    p_instance_id           INTEGER  DEFAULT NULL,
    p_camunda_instance_key  BIGINT   DEFAULT NULL,
    p_camunda_task_id       VARCHAR  DEFAULT NULL,
    p_camunda_process_key   VARCHAR  DEFAULT NULL,
    p_camunda_step_id       VARCHAR  DEFAULT NULL,
    p_payload               JSONB    DEFAULT NULL,
    p_actor                 VARCHAR  DEFAULT NULL,
    p_correlation_id        VARCHAR  DEFAULT NULL,
    p_source_ip             INET     DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO wlc_audit_log (
        event_type, workflow_id, step_id, instance_id,
        camunda_instance_key, camunda_task_id,
        camunda_process_key, camunda_step_id,
        payload, actor, correlation_id, source_ip
    )
    VALUES (
        p_event_type, p_workflow_id, p_step_id, p_instance_id,
        p_camunda_instance_key, p_camunda_task_id,
        p_camunda_process_key, p_camunda_step_id,
        p_payload, p_actor, p_correlation_id, p_source_ip
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON TABLE    wlc_audit_log           IS 'Append-only audit trail. Never updated or deleted.';
COMMENT ON FUNCTION log_audit_event         IS 'Convenience function for inserting audit events from application or trigger code.';

COMMIT;
