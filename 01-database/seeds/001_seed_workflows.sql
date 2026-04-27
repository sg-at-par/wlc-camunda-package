-- =============================================================================
-- Seed 001: camunda_workflows
-- Reference data for the two sample workflows used in the WLC prototype.
-- =============================================================================

BEGIN;

INSERT INTO camunda_workflows (
    camunda_process_key,
    display_name,
    description,
    version,
    is_active
)
VALUES
(
    'customer-onboarding-v2',
    'Customer Onboarding',
    'End-to-end customer onboarding flow covering profile capture, KYC verification, and final approval.',
    '2.0.0',
    TRUE
),
(
    'loan-application-v1',
    'Loan Application',
    'Loan origination workflow: applicant details collection through credit decision.',
    '1.0.0',
    TRUE
)
ON CONFLICT (camunda_process_key) DO UPDATE
    SET display_name  = EXCLUDED.display_name,
        description   = EXCLUDED.description,
        version       = EXCLUDED.version,
        is_active     = EXCLUDED.is_active,
        updated_at    = NOW();

COMMIT;
