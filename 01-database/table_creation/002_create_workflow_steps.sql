-- =============================================================================
-- Migration 002: workflow_steps
-- One row per user-task step inside a Camunda workflow.
-- Stores the JSON form template the WLC renders for that step.
-- =============================================================================

BEGIN;

-- Depends on migration 001
-- Verify parent table exists before creating FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'camunda_workflows'
    ) THEN
        RAISE EXCEPTION 'Run migration 001 first (camunda_workflows table missing).';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS workflow_steps (
    -- -------------------------------------------------------------------------
    -- Identity
    -- -------------------------------------------------------------------------
    id                      SERIAL          PRIMARY KEY,

    -- FK → camunda_workflows
    workflow_id             INTEGER         NOT NULL
                                REFERENCES camunda_workflows (id)
                                ON DELETE CASCADE,

    -- The Camunda user-task definition id (the id= attribute on <userTask> in BPMN).
    -- This is what Camunda returns in task.taskDefinitionId from GET /v1/user-tasks.
    camunda_step_id         VARCHAR(255)    NOT NULL,

    -- Display label for this step (used in progress tracker UI)
    step_name               VARCHAR(255)    NOT NULL,

    -- Zero-based execution order within the workflow.
    -- Used to drive the progress bar and "step X of N" subtitle.
    step_order              SMALLINT        NOT NULL DEFAULT 0,

    -- Whether this step is currently active / renderable.
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    -- -------------------------------------------------------------------------
    -- JSON Form Template
    -- -------------------------------------------------------------------------
    -- The full form schema that the WLC dynamic renderer consumes.
    -- Schema contract (array of field objects):
    --
    --   {
    --     "stepId":   "step-kyc",           -- mirrors camunda_step_id
    --     "title":    "KYC Verification",
    --     "subtitle": "Step 2 of 3",
    --     "schema": [
    --       {
    --         "id":          "docType",       -- field key / variable name
    --         "type":        "select",        -- text | email | date | select | textarea | number | checkbox
    --         "label":       "Document Type",
    --         "required":    true,
    --         "camundaVar":  true,            -- TRUE  → sent to Camunda as process variable
    --                                         -- FALSE → stored only in WLC business DB
    --         "options":     ["Passport", "Driver's License"]  -- for select fields
    --       }
    --     ]
    --   }
    --
    form_template           JSONB           NOT NULL,

    -- Optional JSON-Schema for server-side validation of submitted data
    validation_schema       JSONB,

    -- -------------------------------------------------------------------------
    -- Audit
    -- -------------------------------------------------------------------------
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Enforce uniqueness: one step definition per workflow
CREATE UNIQUE INDEX uq_workflow_steps_workflow_step
    ON workflow_steps (workflow_id, camunda_step_id);

-- The hottest query: "give me the template for this camunda step in this workflow"
CREATE INDEX idx_workflow_steps_lookup
    ON workflow_steps (workflow_id, camunda_step_id)
    WHERE is_active = TRUE;

-- GIN index enables JSONB containment / path queries on form_template
CREATE INDEX idx_workflow_steps_form_template_gin
    ON workflow_steps USING GIN (form_template);

CREATE TRIGGER trg_workflow_steps_updated_at
    BEFORE UPDATE ON workflow_steps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------------------------------------
-- Helper view: flat lookup joining workflow key + step id → template
-- Used by the WLC Schema Service API endpoint
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_step_form_templates AS
SELECT
    ws.id                   AS step_pk,
    cw.id                   AS workflow_pk,
    cw.camunda_process_key,
    cw.display_name         AS workflow_name,
    ws.camunda_step_id,
    ws.step_name,
    ws.step_order,
    ws.form_template,
    ws.validation_schema,
    ws.is_active            AS step_active,
    cw.is_active            AS workflow_active
FROM workflow_steps ws
JOIN camunda_workflows cw ON cw.id = ws.workflow_id;

COMMENT ON TABLE  workflow_steps                        IS 'Per-step form templates. Each row maps a Camunda user-task to a WLC JSON form schema.';
COMMENT ON COLUMN workflow_steps.camunda_step_id        IS 'Must match the userTask id in the BPMN XML exactly.';
COMMENT ON COLUMN workflow_steps.form_template          IS 'JSONB schema consumed by the WLC dynamic form renderer. See column comment for contract.';
COMMENT ON COLUMN workflow_steps.camundaVar             IS 'Fields with camundaVar=true are forwarded to Camunda; others stay in WLC DB only.';
COMMENT ON VIEW   v_step_form_templates                 IS 'Convenience view — joins workflow + step for the API schema-lookup endpoint.';

COMMIT;
