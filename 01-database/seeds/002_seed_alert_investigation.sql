-- =============================================================================
-- Seed: alert-investigation-v1
-- Workflow registry + all 3 step form templates
--
-- Decision field "action" (camundaVar: true) drives Camunda XOR gateways:
--   L1: ESCALATE | CLOSE
--   L2: ESCALATE | CLOSE | SEND_BACK
--   QA: CLOSE    | SEND_BACK
-- =============================================================================

BEGIN;

-- ── 1. Register Workflow ──────────────────────────────────────────────────────

INSERT INTO camunda_workflows (
    camunda_process_key, display_name, description, version, is_active
)
VALUES (
    'alert-investigation-v1',
    'Alert Investigation',
    'Three-level SOC alert investigation: L1 Analysis -> L2 Analysis -> QA Analysis. '
    'Each level can escalate to the next, close the investigation, or send back to '
    'the previous level to request more information.',
    '1.0.0',
    TRUE
)
ON CONFLICT (camunda_process_key) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        description  = EXCLUDED.description,
        version      = EXCLUDED.version,
        is_active    = EXCLUDED.is_active,
        updated_at   = NOW();


-- ── 2. Step 1 — L1 Alert Analysis ────────────────────────────────────────────

INSERT INTO workflow_steps (
    workflow_id, camunda_step_id, step_name, step_order, form_template
)
SELECT cw.id, 'step-l1-analysis', 'L1 Alert Analysis', 0, '{
    "stepId":          "step-l1-analysis",
    "title":           "L1 Alert Analysis",
    "subtitle":        "Level 1 - Initial Triage",
    "availableActions":["ESCALATE","CLOSE"],
    "schema": [
        {"id":"alertId",         "type":"text",     "label":"Alert ID",                   "required":true,  "camundaVar":false, "placeholder":"ALT-2026-XXXXX"},
        {"id":"alertSource",     "type":"select",   "label":"Alert Source",               "required":true,  "camundaVar":true,  "options":["SIEM","EDR","IDS/IPS","Cloud Watch","Manual Report"],                                                                        "note":"Used for SLA routing in Camunda"},
        {"id":"severity",        "type":"select",   "label":"Severity",                   "required":true,  "camundaVar":true,  "options":["Critical","High","Medium","Low"],                                                                                             "note":"Drives escalation gateway threshold"},
        {"id":"affectedAsset",   "type":"text",     "label":"Affected Asset / Host",      "required":true,  "camundaVar":false, "placeholder":"hostname or IP address"},
        {"id":"initialFindings", "type":"textarea", "label":"Initial Findings",           "required":true,  "camundaVar":false, "placeholder":"Describe what triggered this alert and your initial observations..."},
        {"id":"isFalsePositive", "type":"select",   "label":"False Positive Assessment",  "required":true,  "camundaVar":true,  "options":["Confirmed Threat","Likely Threat","Uncertain","Likely False Positive","Confirmed False Positive"],                            "note":"If Confirmed False Positive, action should be CLOSE"},
        {"id":"analystName",     "type":"text",     "label":"L1 Analyst Name",            "required":true,  "camundaVar":false, "placeholder":"Your full name"},
        {"id":"action",          "type":"select",   "label":"Action",                     "required":true,  "camundaVar":true,  "options":["ESCALATE","CLOSE"],                                                                                                           "note":"ESCALATE -> L2 Alert Analysis  |  CLOSE -> End investigation"},
        {"id":"actionNotes",     "type":"textarea", "label":"Action Justification",       "required":true,  "camundaVar":false, "placeholder":"Justify your escalation or closure decision..."}
    ]
}'::JSONB
FROM camunda_workflows cw
WHERE cw.camunda_process_key = 'alert-investigation-v1'
ON CONFLICT (workflow_id, camunda_step_id) DO UPDATE
    SET form_template = EXCLUDED.form_template,
        step_name     = EXCLUDED.step_name,
        step_order    = EXCLUDED.step_order,
        updated_at    = NOW();


-- ── 3. Step 2 — L2 Alert Analysis ────────────────────────────────────────────

INSERT INTO workflow_steps (
    workflow_id, camunda_step_id, step_name, step_order, form_template
)
SELECT cw.id, 'step-l2-analysis', 'L2 Alert Analysis', 1, '{
    "stepId":          "step-l2-analysis",
    "title":           "L2 Alert Analysis",
    "subtitle":        "Level 2 - Deep Dive Investigation",
    "availableActions":["ESCALATE","CLOSE","SEND_BACK"],
    "schema": [
        {"id":"alertId",          "type":"text",     "label":"Alert ID",                        "required":true,  "camundaVar":false, "placeholder":"ALT-2026-XXXXX"},
        {"id":"l1SummaryReview",  "type":"textarea", "label":"L1 Summary Review",               "required":true,  "camundaVar":false, "placeholder":"Summarise L1 findings and confirm your understanding..."},
        {"id":"attackVector",     "type":"select",   "label":"Attack Vector (MITRE ATT&CK)",    "required":true,  "camundaVar":true,  "options":["Initial Access","Execution","Persistence","Privilege Escalation","Defense Evasion","Credential Access","Discovery","Lateral Movement","Collection","Exfiltration","Impact","N/A"], "note":"Used for SOAR playbook selection in Camunda"},
        {"id":"iocList",          "type":"textarea", "label":"Indicators of Compromise (IOCs)", "required":false, "camundaVar":false, "placeholder":"IPs, hashes, domains, registry keys, file paths..."},
        {"id":"affectedSystems",  "type":"textarea", "label":"Affected Systems / Blast Radius", "required":true,  "camundaVar":false, "placeholder":"All impacted hosts, accounts, or services..."},
        {"id":"containmentTaken", "type":"select",   "label":"Containment Action Taken",        "required":true,  "camundaVar":true,  "options":["None","Host Isolated","Account Disabled","Network Segment Blocked","Process Killed","Multiple Actions"],                "note":"Triggers containment notification in Camunda"},
        {"id":"riskScore",        "type":"select",   "label":"Risk Score",                      "required":true,  "camundaVar":true,  "options":["1 - Minimal","2 - Low","3 - Moderate","4 - High","5 - Critical"],                                                      "note":"Score >= 4 auto-escalates to QA via Camunda gateway"},
        {"id":"analystName",      "type":"text",     "label":"L2 Analyst Name",                 "required":true,  "camundaVar":false, "placeholder":"Your full name"},
        {"id":"action",           "type":"select",   "label":"Action",                          "required":true,  "camundaVar":true,  "options":["ESCALATE","CLOSE","SEND_BACK"],                                                                                         "note":"ESCALATE -> QA  |  CLOSE -> End  |  SEND_BACK -> L1 for more info"},
        {"id":"actionNotes",      "type":"textarea", "label":"Action Justification",            "required":true,  "camundaVar":false, "placeholder":"Justify escalation, closure, or send-back..."},
        {"id":"sendBackRequest",  "type":"textarea", "label":"Send-Back Request Details",       "required":false, "camundaVar":false, "placeholder":"If SEND_BACK: what additional information is needed from L1?"}
    ]
}'::JSONB
FROM camunda_workflows cw
WHERE cw.camunda_process_key = 'alert-investigation-v1'
ON CONFLICT (workflow_id, camunda_step_id) DO UPDATE
    SET form_template = EXCLUDED.form_template,
        step_name     = EXCLUDED.step_name,
        step_order    = EXCLUDED.step_order,
        updated_at    = NOW();


-- ── 4. Step 3 — QA Analysis ──────────────────────────────────────────────────

INSERT INTO workflow_steps (
    workflow_id, camunda_step_id, step_name, step_order, form_template
)
SELECT cw.id, 'step-qa-analysis', 'QA Analysis', 2, '{
    "stepId":          "step-qa-analysis",
    "title":           "QA Analysis",
    "subtitle":        "Level 3 - Quality Assurance & Final Decision",
    "availableActions":["CLOSE","SEND_BACK"],
    "schema": [
        {"id":"alertId",              "type":"text",     "label":"Alert ID",                      "required":true,  "camundaVar":false, "placeholder":"ALT-2026-XXXXX"},
        {"id":"investigationQuality", "type":"select",   "label":"Overall Investigation Quality", "required":true,  "camundaVar":true,  "options":["Excellent","Acceptable","Needs Improvement","Inadequate"],                                                                                                                   "note":"Written to Camunda for quality metrics reporting"},
        {"id":"l1ReviewNotes",        "type":"textarea", "label":"L1 Work Review",                "required":true,  "camundaVar":false, "placeholder":"Assess quality and completeness of L1 analysis..."},
        {"id":"l2ReviewNotes",        "type":"textarea", "label":"L2 Work Review",                "required":true,  "camundaVar":false, "placeholder":"Assess quality and completeness of L2 analysis..."},
        {"id":"finalClassification",  "type":"select",   "label":"Final Threat Classification",   "required":true,  "camundaVar":true,  "options":["True Positive - Critical Incident","True Positive - Standard Incident","True Positive - Low Priority","False Positive - Tuning Required","False Positive - Acceptable Noise"], "note":"Written to Camunda for SIEM tuning and reporting"},
        {"id":"lessonsLearned",       "type":"textarea", "label":"Lessons Learned",               "required":false, "camundaVar":false, "placeholder":"Process improvements or detection rule changes recommended..."},
        {"id":"complianceFlag",       "type":"select",   "label":"Compliance / Regulatory Flag",  "required":true,  "camundaVar":true,  "options":["None","GDPR Notifiable","PCI-DSS","HIPAA","SOX","Multiple"],                                                                                                                 "note":"Triggers compliance notification task in Camunda if not None"},
        {"id":"analystName",          "type":"text",     "label":"QA Analyst Name",               "required":true,  "camundaVar":false, "placeholder":"Your full name"},
        {"id":"action",               "type":"select",   "label":"Final Action",                  "required":true,  "camundaVar":true,  "options":["CLOSE","SEND_BACK"],                                                                                                                                                          "note":"CLOSE -> Investigation complete  |  SEND_BACK -> Return to L2 for rework"},
        {"id":"actionNotes",          "type":"textarea", "label":"QA Decision Notes",             "required":true,  "camundaVar":false, "placeholder":"Document the final QA decision and follow-up actions..."},
        {"id":"sendBackRequest",      "type":"textarea", "label":"Send-Back Instructions for L2", "required":false, "camundaVar":false, "placeholder":"If SEND_BACK: what rework is required from L2?"}
    ]
}'::JSONB
FROM camunda_workflows cw
WHERE cw.camunda_process_key = 'alert-investigation-v1'
ON CONFLICT (workflow_id, camunda_step_id) DO UPDATE
    SET form_template = EXCLUDED.form_template,
        step_name     = EXCLUDED.step_name,
        step_order    = EXCLUDED.step_order,
        updated_at    = NOW();

COMMIT;
