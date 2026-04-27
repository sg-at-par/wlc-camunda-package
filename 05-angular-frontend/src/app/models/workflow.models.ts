// =============================================================================
// models/workflow.models.ts
// Shared TypeScript interfaces for the WLC ↔ Camunda 8.7 integration
// =============================================================================

// ── Field types supported by the dynamic form renderer ───────────────────────
export type FieldType = 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';

// ── A single field definition inside a form schema ───────────────────────────
export interface FormField {
  id:          string;
  type:        FieldType;
  label:       string;
  required:    boolean;
  camundaVar:  boolean;       // true  → sent to Camunda as process variable
                               // false → stored in WLC step_submissions.wlc_data
  options?:    string[];       // for select fields
  placeholder?: string;
  note?:       string;         // shown as hint below the label
  showWhen?:   {               // conditional visibility
    field: string;
    value: string;
  };
}

// ── The full form schema returned by the WLC API ─────────────────────────────
export interface FormSchema {
  stepId:           string;
  title:            string;
  subtitle:         string;
  availableActions: WorkflowAction[];
  schema:           FormField[];
}

// ── Workflow action options ───────────────────────────────────────────────────
export type WorkflowAction = 'ESCALATE' | 'CLOSE' | 'SEND_BACK';

export interface ActionMeta {
  color:  string;
  bg:     string;
  border: string;
  icon:   string;
  label:  string;
}

export const ACTION_META: Record<WorkflowAction, ActionMeta> = {
  ESCALATE:  { color: '#3b82f6', bg: '#1e3a5f', border: '#2563eb', icon: '↑', label: 'Escalate'  },
  CLOSE:     { color: '#22c55e', bg: '#14532d', border: '#16a34a', icon: '✓', label: 'Close'     },
  SEND_BACK: { color: '#f59e0b', bg: '#451a03', border: '#d97706', icon: '↩', label: 'Send Back' },
};

// ── A completed step record ───────────────────────────────────────────────────
export interface StepHistoryEntry {
  stepId:      string;
  stepTitle:   string;
  action:      WorkflowAction;
  analystName: string;
  time:        string;
}

// ── Split payload after form submission ───────────────────────────────────────
export interface SubmissionPayload {
  camundaVariables: Record<string, string>;
  wlcData:          Record<string, string>;
}

// ── Workflow step status for the sidebar ─────────────────────────────────────
export type StepStatus = 'pending' | 'active' | WorkflowAction;

export interface WorkflowStep {
  id:     string;
  label:  string;
  num:    string;
  status: StepStatus;
}

// ── Camunda process instance (from WLC API) ───────────────────────────────────
export interface ProcessInstance {
  id:                  number;
  camundaInstanceKey:  string;
  processDefinitionKey: string;
  status:              string;
}
