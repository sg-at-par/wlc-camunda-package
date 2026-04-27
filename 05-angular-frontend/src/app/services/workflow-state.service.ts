// =============================================================================
// services/workflow-state.service.ts
// Manages runtime workflow state across components.
// Equivalent to: the useWorkflowEngine hook in React.
// =============================================================================

import { Injectable, signal, computed } from '@angular/core';
import {
  WorkflowAction, StepHistoryEntry, WorkflowStep, StepStatus
} from '../models/workflow.models';

const STEP_DEFINITIONS: WorkflowStep[] = [
  { id: 'step-l1-analysis', label: 'L1 Alert Analysis', num: 'L1', status: 'active'  },
  { id: 'step-l2-analysis', label: 'L2 Alert Analysis', num: 'L2', status: 'pending' },
  { id: 'step-qa-analysis', label: 'QA Analysis',        num: 'QA', status: 'pending' },
];

@Injectable({ providedIn: 'root' })
export class WorkflowStateService {

  // ── Signals (Angular 17 reactive state) ────────────────────────────────────
  currentStepId   = signal<string>('step-l1-analysis');
  isComplete      = signal<boolean>(false);
  finalAction     = signal<WorkflowAction | null>(null);
  history         = signal<StepHistoryEntry[]>([]);
  camundaVars     = signal<Record<string, string>>({});
  wlcData         = signal<Record<string, Record<string, string>>>({});
  steps           = signal<WorkflowStep[]>(
    STEP_DEFINITIONS.map(s => ({ ...s }))
  );

  // ── Computed: accumulated camunda vars as display pairs ───────────────────
  camundaVarEntries = computed(() =>
    Object.entries(this.camundaVars())
  );

  // ── Record a completed step submission ────────────────────────────────────
  recordSubmission(
    stepId:    string,
    stepTitle: string,
    action:    WorkflowAction,
    analystName: string,
    camundaVariables: Record<string, string>,
    wlcStepData:      Record<string, string>
  ): void {
    // Append history
    const entry: StepHistoryEntry = {
      stepId,
      stepTitle,
      action,
      analystName: analystName || '—',
      time: new Date().toLocaleTimeString(),
    };
    this.history.update(h => [...h, entry]);

    // Accumulate Camunda vars (merge across steps)
    this.camundaVars.update(cv => ({ ...cv, ...camundaVariables }));

    // Store WLC data keyed by stepId
    this.wlcData.update(wd => ({ ...wd, [stepId]: wlcStepData }));

    // Update sidebar step status
    this.steps.update(steps =>
      steps.map(s => {
        if (s.id === stepId) return { ...s, status: action as StepStatus };
        return s;
      })
    );
  }

  // ── Advance to next step ─────────────────────────────────────────────────
  advanceTo(nextStepId: string): void {
    this.currentStepId.set(nextStepId);
    this.steps.update(steps =>
      steps.map(s =>
        s.id === nextStepId ? { ...s, status: 'active' } : s
      )
    );
  }

  // ── Mark workflow complete ────────────────────────────────────────────────
  complete(action: WorkflowAction): void {
    this.isComplete.set(true);
    this.finalAction.set(action);
  }

  // ── Full reset ────────────────────────────────────────────────────────────
  reset(): void {
    this.currentStepId.set('step-l1-analysis');
    this.isComplete.set(false);
    this.finalAction.set(null);
    this.history.set([]);
    this.camundaVars.set({});
    this.wlcData.set({});
    this.steps.set(STEP_DEFINITIONS.map(s => ({ ...s })));
  }
}
