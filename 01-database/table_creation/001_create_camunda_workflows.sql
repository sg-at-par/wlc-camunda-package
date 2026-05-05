-- =============================================================================
-- Migration 001: camunda_workflows
-- Stores the registry of Camunda process definitions known to the WLC.
-- One row per Camunda process definition (e.g. "customer-onboarding-v2").
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS camunda_workflows (
    -- -------------------------------------------------------------------------
    -- Identity
    -- -------------------------------------------------------------------------
    id                      SERIAL          PRIMARY KEY,

    -- The exact key used in Camunda (process definition key in BPMN).
    -- This is what you pass to POST /v1/process-instances  { "bpmnProcessId": ... }
    camunda_process_key     VARCHAR(255)    NOT NULL UNIQUE,

    -- Human-readable label shown in the WLC UI sidebar
    display_name            VARCHAR(255)    NOT NULL,

    -- Optional description for operators / admins
    description             TEXT,

    -- Semantic version of this workflow definition (informational)
    version                 VARCHAR(50)     NOT NULL DEFAULT '1.0.0',

    -- Whether this workflow is available for new process instances
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    -- -------------------------------------------------------------------------
    -- Camunda deployment metadata (populated after deploy, optional)
    -- -------------------------------------------------------------------------
    camunda_definition_key  BIGINT,                  -- numeric key from Camunda deployment
    camunda_version_tag     VARCHAR(100),             -- version tag set in Modeler
    deployed_at             TIMESTAMPTZ,

    -- -------------------------------------------------------------------------
    -- Audit
    -- -------------------------------------------------------------------------
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_camunda_workflows_updated_at
    BEFORE UPDATE ON camunda_workflows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lookup by active state (most common query)
CREATE INDEX idx_camunda_workflows_active
    ON camunda_workflows (is_active, camunda_process_key);

COMMENT ON TABLE  camunda_workflows                        IS 'Registry of Camunda process definitions managed by the WLC.';
COMMENT ON COLUMN camunda_workflows.camunda_process_key    IS 'Must match the BPMN process id exactly — used in all Camunda REST calls.';
COMMENT ON COLUMN camunda_workflows.camunda_definition_key IS 'Numeric process definition key returned by the Camunda deployment API.';

COMMIT;
