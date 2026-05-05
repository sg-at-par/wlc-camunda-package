-- =============================================================================
-- Migration 004: step_submissions
-- Stores the business data submitted by the user at each step.
-- Only WLC fields (camundaVar = false) land here.
-- Camunda variables are sent directly to Camunda and are NOT stored here
-- (they live in Camunda's own variable store).
-- =============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'process_instances') THEN
        RAISE EXCEPTION 'Run migrations 001–003 first.';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS step_submissions (
    -- -------------------------------------------------------------------------
    -- Identity
    -- -------------------------------------------------------------------------
    id                      SERIAL          PRIMARY KEY,

    -- FK → process_instances (which runtime instance)
    instance_id             INTEGER         NOT NULL
                                REFERENCES process_instances (id)
                                ON DELETE CASCADE,

    -- FK → workflow_steps (which step definition / template was rendered)
    step_id                 INTEGER         NOT NULL
                                REFERENCES workflow_steps (id),

    -- -------------------------------------------------------------------------
    -- Submitted payload
    -- -------------------------------------------------------------------------
    -- The raw form values submitted by the user for THIS step,
    -- ONLY the WLC-owned fields (camundaVar = false).
    -- Camunda variables are NOT duplicated here.
    wlc_data                JSONB           NOT NULL DEFAULT '{}',

    -- Snapshot of the Camunda variables submitted at this step (for audit only).
    -- These were also sent to Camunda; stored here for completeness.
    camunda_variables       JSONB           NOT NULL DEFAULT '{}',

    -- The Camunda task id that was completed at this step
    camunda_task_id         VARCHAR(255),

    -- -------------------------------------------------------------------------
    -- Submission context
    -- -------------------------------------------------------------------------
    submitted_by            VARCHAR(255),   -- user id or system actor
    submission_source       VARCHAR(50)     DEFAULT 'WEB_UI',  -- WEB_UI | API | MOBILE

    -- HTTP correlation id for request tracing
    correlation_id          VARCHAR(100),

    -- -------------------------------------------------------------------------
    -- Timestamps
    -- -------------------------------------------------------------------------
    submitted_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    -- No updated_at: submissions are immutable once written
);

-- One submission per instance+step (re-submission would INSERT a new row,
-- allowing a full history of revisions if needed)
-- If you want exactly one row per step: add UNIQUE (instance_id, step_id)
CREATE INDEX idx_ss_instance         ON step_submissions (instance_id);
CREATE INDEX idx_ss_step             ON step_submissions (step_id);
CREATE INDEX idx_ss_submitted_at     ON step_submissions (submitted_at DESC);
CREATE INDEX idx_ss_wlc_data_gin     ON step_submissions USING GIN (wlc_data);
CREATE INDEX idx_ss_camunda_vars_gin ON step_submissions USING GIN (camunda_variables);

-- -------------------------------------------------------------------------
-- Convenience view: full submission history for an instance
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_instance_submissions AS
SELECT
    pi.camunda_instance_key,
    cw.camunda_process_key,
    ws.camunda_step_id,
    ws.step_name,
    ws.step_order,
    ss.wlc_data,
    ss.camunda_variables,
    ss.camunda_task_id,
    ss.submitted_by,
    ss.submitted_at,
    ss.correlation_id
FROM step_submissions ss
JOIN process_instances pi ON pi.id = ss.instance_id
JOIN workflow_steps    ws ON ws.id = ss.step_id
JOIN camunda_workflows cw ON cw.id = pi.workflow_id
ORDER BY pi.camunda_instance_key, ws.step_order, ss.submitted_at;

COMMENT ON TABLE  step_submissions              IS 'Immutable record of every form submission. WLC business fields only; Camunda vars stored for audit.';
COMMENT ON COLUMN step_submissions.wlc_data     IS 'Fields with camundaVar=false. This is the WLC canonical business data store.';
COMMENT ON COLUMN step_submissions.camunda_variables IS 'Fields with camundaVar=true — mirrored here for auditability only.';

COMMIT;
