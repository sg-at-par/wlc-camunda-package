// =============================================================================
// services/schema.service.ts
// Holds all form schemas and provides routing/split logic.
// In production, getFormSchema() calls the WLC API server instead of
// returning local data.
// Equivalent to: the useWorkflowEngine hook + WLC_API mock in React.
// =============================================================================

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import {
  FormSchema, WorkflowAction, SubmissionPayload, FormField
} from '../models/workflow.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SchemaService {

  constructor(private http: HttpClient) {}

  // ── In production: fetch from WLC API ──────────────────────────────────────
  // GET /api/workflows/:processKey/steps/:stepId/template
  getFormSchema(processKey: string, stepId: string): Observable<FormSchema> {
    if (environment.production) {
      return this.http.get<FormSchema>(
        `${environment.wlcApiUrl}/api/workflows/${processKey}/steps/${stepId}/template`
      );
    }
    // Dev: return local schema
    const schema = LOCAL_SCHEMAS[stepId];
    if (!schema) throw new Error(`Schema not found: ${stepId}`);
    return of(schema);
  }

  // ── Routing: given current step + action → next step id (null = done) ──────
  resolveNextStep(stepId: string, action: WorkflowAction): string | null {
    if (action === 'ESCALATE') {
      return stepId === 'step-l1-analysis' ? 'step-l2-analysis' : 'step-qa-analysis';
    }
    if (action === 'SEND_BACK') {
      return stepId === 'step-l2-analysis' ? 'step-l1-analysis' : 'step-l2-analysis';
    }
    return null; // CLOSE
  }

  // ── Split form values into Camunda vars + WLC data ────────────────────────
  splitPayload(
    schema: FormSchema,
    values: Record<string, string>
  ): SubmissionPayload {
    const camundaVariables: Record<string, string> = {};
    const wlcData: Record<string, string>          = {};

    schema.schema.forEach((field: FormField) => {
      const val = values[field.id];
      if (val !== undefined && val !== '') {
        if (field.camundaVar) camundaVariables[field.id] = val;
        else                  wlcData[field.id]          = val;
      }
    });

    return { camundaVariables, wlcData };
  }
}

// ── Local schemas (mirrors seeds/002_seed_alert_investigation.sql) ────────────
const LOCAL_SCHEMAS: Record<string, FormSchema> = {

  'step-l1-analysis': {
    stepId:           'step-l1-analysis',
    title:            'L1 Alert Analysis',
    subtitle:         'Level 1  ·  Initial Triage',
    availableActions: ['ESCALATE', 'CLOSE'],
    schema: [
      { id: 'alertId',         type: 'text',     label: 'Alert ID',                  required: true,  camundaVar: false, placeholder: 'ALT-2026-XXXXX' },
      { id: 'alertSource',     type: 'select',   label: 'Alert Source',              required: true,  camundaVar: true,  options: ['SIEM','EDR','IDS/IPS','Cloud Watch','Manual Report'], note: 'Used for SLA routing in Camunda' },
      { id: 'severity',        type: 'select',   label: 'Severity',                  required: true,  camundaVar: true,  options: ['Critical','High','Medium','Low'], note: 'Drives escalation gateway threshold' },
      { id: 'affectedAsset',   type: 'text',     label: 'Affected Asset / Host',     required: true,  camundaVar: false, placeholder: 'hostname or IP address' },
      { id: 'initialFindings', type: 'textarea', label: 'Initial Findings',          required: true,  camundaVar: false, placeholder: 'Describe what triggered this alert...' },
      { id: 'isFalsePositive', type: 'select',   label: 'False Positive Assessment', required: true,  camundaVar: true,  options: ['Confirmed Threat','Likely Threat','Uncertain','Likely False Positive','Confirmed False Positive'] },
      { id: 'analystName',     type: 'text',     label: 'L1 Analyst Name',           required: true,  camundaVar: false, placeholder: 'Your full name' },
      { id: 'action',          type: 'select',   label: 'Action',                    required: true,  camundaVar: true,  options: ['ESCALATE','CLOSE'], note: 'ESCALATE → L2  |  CLOSE → End investigation' },
      { id: 'actionNotes',     type: 'textarea', label: 'Action Justification',      required: true,  camundaVar: false, placeholder: 'Justify your decision...' },
    ],
  },

  'step-l2-analysis': {
    stepId:           'step-l2-analysis',
    title:            'L2 Alert Analysis',
    subtitle:         'Level 2  ·  Deep Dive Investigation',
    availableActions: ['ESCALATE', 'CLOSE', 'SEND_BACK'],
    schema: [
      { id: 'alertId',          type: 'text',     label: 'Alert ID',                        required: true,  camundaVar: false, placeholder: 'ALT-2026-XXXXX' },
      { id: 'l1SummaryReview',  type: 'textarea', label: 'L1 Summary Review',               required: true,  camundaVar: false, placeholder: 'Summarise L1 findings...' },
      { id: 'attackVector',     type: 'select',   label: 'Attack Vector (MITRE ATT&CK)',    required: true,  camundaVar: true,  options: ['Initial Access','Execution','Persistence','Privilege Escalation','Defense Evasion','Credential Access','Discovery','Lateral Movement','Collection','Exfiltration','Impact','N/A'], note: 'Used for SOAR playbook selection' },
      { id: 'iocList',          type: 'textarea', label: 'Indicators of Compromise',        required: false, camundaVar: false, placeholder: 'IPs, hashes, domains, file paths...' },
      { id: 'affectedSystems',  type: 'textarea', label: 'Affected Systems / Blast Radius', required: true,  camundaVar: false, placeholder: 'All impacted hosts, accounts, services...' },
      { id: 'containmentTaken', type: 'select',   label: 'Containment Action Taken',        required: true,  camundaVar: true,  options: ['None','Host Isolated','Account Disabled','Network Segment Blocked','Process Killed','Multiple Actions'], note: 'Triggers containment notification in Camunda' },
      { id: 'riskScore',        type: 'select',   label: 'Risk Score',                      required: true,  camundaVar: true,  options: ['1 - Minimal','2 - Low','3 - Moderate','4 - High','5 - Critical'], note: 'Score >= 4 auto-escalates to QA' },
      { id: 'analystName',      type: 'text',     label: 'L2 Analyst Name',                 required: true,  camundaVar: false, placeholder: 'Your full name' },
      { id: 'action',           type: 'select',   label: 'Action',                          required: true,  camundaVar: true,  options: ['ESCALATE','CLOSE','SEND_BACK'], note: 'ESCALATE → QA  |  CLOSE → End  |  SEND_BACK → L1' },
      { id: 'actionNotes',      type: 'textarea', label: 'Action Justification',            required: true,  camundaVar: false, placeholder: 'Justify your decision...' },
      { id: 'sendBackRequest',  type: 'textarea', label: 'Send-Back Request Details',       required: false, camundaVar: false, placeholder: 'What info is needed from L1?', showWhen: { field: 'action', value: 'SEND_BACK' } },
    ],
  },

  'step-qa-analysis': {
    stepId:           'step-qa-analysis',
    title:            'QA Analysis',
    subtitle:         'Level 3  ·  Quality Assurance & Final Decision',
    availableActions: ['CLOSE', 'SEND_BACK'],
    schema: [
      { id: 'alertId',              type: 'text',     label: 'Alert ID',                      required: true,  camundaVar: false, placeholder: 'ALT-2026-XXXXX' },
      { id: 'investigationQuality', type: 'select',   label: 'Overall Investigation Quality', required: true,  camundaVar: true,  options: ['Excellent','Acceptable','Needs Improvement','Inadequate'], note: 'Written to Camunda for quality metrics' },
      { id: 'l1ReviewNotes',        type: 'textarea', label: 'L1 Work Review',                required: true,  camundaVar: false, placeholder: 'Assess quality of L1 analysis...' },
      { id: 'l2ReviewNotes',        type: 'textarea', label: 'L2 Work Review',                required: true,  camundaVar: false, placeholder: 'Assess quality of L2 analysis...' },
      { id: 'finalClassification',  type: 'select',   label: 'Final Threat Classification',   required: true,  camundaVar: true,  options: ['True Positive — Critical Incident','True Positive — Standard Incident','True Positive — Low Priority','False Positive — Tuning Required','False Positive — Acceptable Noise'], note: 'Written to Camunda for SIEM tuning' },
      { id: 'lessonsLearned',       type: 'textarea', label: 'Lessons Learned',               required: false, camundaVar: false, placeholder: 'Process improvements or detection rule changes...' },
      { id: 'complianceFlag',       type: 'select',   label: 'Compliance / Regulatory Flag',  required: true,  camundaVar: true,  options: ['None','GDPR Notifiable','PCI-DSS','HIPAA','SOX','Multiple'], note: 'Triggers compliance notification if not None' },
      { id: 'analystName',          type: 'text',     label: 'QA Analyst Name',               required: true,  camundaVar: false, placeholder: 'Your full name' },
      { id: 'action',               type: 'select',   label: 'Final Action',                  required: true,  camundaVar: true,  options: ['CLOSE','SEND_BACK'], note: 'CLOSE → Complete  |  SEND_BACK → L2 rework' },
      { id: 'actionNotes',          type: 'textarea', label: 'QA Decision Notes',             required: true,  camundaVar: false, placeholder: 'Document the final decision...' },
      { id: 'sendBackRequest',      type: 'textarea', label: 'Send-Back Instructions for L2', required: false, camundaVar: false, placeholder: 'What rework is required from L2?', showWhen: { field: 'action', value: 'SEND_BACK' } },
    ],
  },
};
