-- =============================================================================
-- Migration 003: process_instances
-- Runtime table — one row per active (or completed) Camunda process instance
-- initiated through the WLC. Tracks which step the user is currently on.
-- =============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_steps') THEN
        RAISE EXCEPTION 'Run migrations 001–002 first.';
    END IF;
END;
$$;

-- Enum for lifecycle states mirroring Camunda + WLC states
CREATE TYPE instance_status AS ENUM (
    'ACTIVE',       -- Running, waiting on a user task
    'COMPLETED',    -- All steps done, process ended in Camunda
    'TERMINATED',   -- Cancelled by user or admin
    'SUSPENDED',    -- Paused in Camunda
    'INCIDENT'      -- Camunda has raised an incident on this instance
);

CREATE TABLE IF NOT EXISTS process_instances (
    -- -------------------------------------------------------------------------
    -- Identity
    -- -------------------------------------------------------------------------
    id                          SERIAL              PRIMARY KEY,

    -- FK → camunda_workflows (which process definition)
    workflow_id                 INTEGER             NOT NULL
                                    REFERENCES camunda_workflows (id),

    -- The process instance key returned by Camunda when the process was started
    -- POST /v1/process-instances → { "processInstanceKey": 2251799813685249 }
    camunda_instance_key        BIGINT              NOT NULL UNIQUE,

    -- -------------------------------------------------------------------------
    -- Current position in the workflow
    -- -------------------------------------------------------------------------
    -- FK → workflow_steps.id  (the step the user is currently on)
    current_step_id             INTEGER
                                    REFERENCES workflow_steps (id),

    -- The active Camunda task id for the current step
    -- GET /v1/user-tasks?processInstanceKey=… → tasks[0].id
    current_camunda_task_id     VARCHAR(255),

    status                      instance_status     NOT NULL DEFAULT 'ACTIVE',

    -- -------------------------------------------------------------------------
    -- User / tenant context
    -- -------------------------------------------------------------------------
    -- The end-user or system that initiated this process (your own user id)
    initiated_by                VARCHAR(255),

    -- Optional tenant identifier for multi-tenant WLC deployments
    tenant_id                   VARCHAR(100),

    -- -------------------------------------------------------------------------
    -- Timestamps
    -- -------------------------------------------------------------------------
    started_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    completed_at                TIMESTAMPTZ,
    last_activity_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_process_instances_updated_at
    BEFORE UPDATE ON process_instances
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Update last_activity_at automatically
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_instances_activity
    BEFORE UPDATE ON process_instances
    FOR EACH ROW EXECUTE FUNCTION update_last_activity();

-- Indexes
CREATE INDEX idx_pi_workflow        ON process_instances (workflow_id, status);
CREATE INDEX idx_pi_tenant          ON process_instances (tenant_id)  WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_pi_initiated_by    ON process_instances (initiated_by) WHERE initiated_by IS NOT NULL;
CREATE INDEX idx_pi_active          ON process_instances (status)
    WHERE status = 'ACTIVE';

COMMENT ON TABLE  process_instances                         IS 'One row per running or completed WLC-initiated Camunda process instance.';
COMMENT ON COLUMN process_instances.camunda_instance_key    IS 'The processInstanceKey returned by POST /v1/process-instances.';
COMMENT ON COLUMN process_instances.current_camunda_task_id IS 'Updated after each step submission when WLC polls GET /v1/user-tasks.';

COMMIT;
