// =============================================================================
// components/alert-investigation/alert-investigation.component.ts
// Main form orchestrator — builds FormGroup from JSON schema, handles
// submission, routing, and split payload dispatch.
// Equivalent to: AlertInvestigation.jsx (React)
// =============================================================================

import {
  Component, OnInit, OnDestroy, inject, signal, computed, effect
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription }      from 'rxjs';

import { SchemaService }         from '../../services/schema.service';
import { WorkflowStateService }  from '../../services/workflow-state.service';
import { DynamicFieldComponent } from '../shared/dynamic-field.component';
import { WorkflowSidebarComponent } from '../shared/workflow-sidebar.component';
import { DataPanelComponent }    from '../shared/data-panel.component';

import {
  FormSchema, FormField, WorkflowAction, ACTION_META
} from '../../models/workflow.models';

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e'
};

@Component({
  selector: 'wlc-alert-investigation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicFieldComponent,
    WorkflowSidebarComponent,
    DataPanelComponent,
  ],
  templateUrl: './alert-investigation.component.html',
  styleUrls:   ['./alert-investigation.component.css'],
})
export class AlertInvestigationComponent implements OnInit, OnDestroy {

  // ── DI ────────────────────────────────────────────────────────────────────
  private schemaSvc = inject(SchemaService);
  state             = inject(WorkflowStateService);

  // ── State ─────────────────────────────────────────────────────────────────
  schema    = signal<FormSchema | null>(null);
  form      = signal<FormGroup>(new FormGroup({}));
  allValues = signal<Record<string, string>>({});

  // Computed: current severity badge color
  severityColor = computed(() => {
    const sv = this.state.camundaVars()['severity'];
    return sv ? SEVERITY_COLORS[sv] ?? '#64748b' : null;
  });

  readonly actionMeta = ACTION_META;
  readonly actionKeys = (['ESCALATE', 'CLOSE', 'SEND_BACK'] as WorkflowAction[]);

  private subs = new Subscription();

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSchema(this.state.currentStepId());
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Load schema and rebuild FormGroup ─────────────────────────────────────
  private loadSchema(stepId: string): void {
    this.subs.add(
      this.schemaSvc.getFormSchema('alert-investigation-v1', stepId)
        .subscribe(schema => {
          this.schema.set(schema);
          this.buildForm(schema);
        })
    );
  }

  private buildForm(schema: FormSchema): void {
    const controls: Record<string, FormControl> = {};
    schema.schema.forEach((field: FormField) => {
      controls[field.id] = new FormControl(
        '',
        field.required ? Validators.required : []
      );
    });
    const group = new FormGroup(controls);
    this.form.set(group);
    this.allValues.set({});

    // Keep allValues in sync for showWhen conditionals
    this.subs.add(
      group.valueChanges.subscribe((vals: Record<string, string>) => {
        this.allValues.set({ ...vals });
      })
    );
  }

  // ── Submit via action button ───────────────────────────────────────────────
  submit(action: WorkflowAction): void {
    // Set action field value before validation
    const actionControl = this.form().get('action');
    if (actionControl) actionControl.setValue(action);

    // Mark all touched so errors show
    this.form().markAllAsTouched();

    // Skip validation for showWhen-hidden fields
    const schema = this.schema()!;
    let valid = true;
    schema.schema.forEach((field: FormField) => {
      if (field.showWhen) {
        const trigger = this.allValues()[field.showWhen.field];
        if (trigger !== field.showWhen.value) {
          // Field is hidden — clear its error
          this.form().get(field.id)?.setErrors(null);
        }
      }
      if (this.form().get(field.id)?.invalid) valid = false;
    });

    if (!valid) return;

    const values = this.form().value as Record<string, string>;
    const stepId = this.state.currentStepId();
    const stepTitle = schema.title;

    // Split payload
    const { camundaVariables, wlcData } = this.schemaSvc.splitPayload(schema, values);

    // Record in state
    this.state.recordSubmission(
      stepId, stepTitle, action,
      values['analystName'] ?? '',
      camundaVariables, wlcData
    );

    // Resolve next step
    const nextStepId = this.schemaSvc.resolveNextStep(stepId, action);

    if (!nextStepId) {
      this.state.complete(action);
    } else {
      this.state.advanceTo(nextStepId);
      this.loadSchema(nextStepId);
    }
  }

  // ── Restart ────────────────────────────────────────────────────────────────
  restart(): void {
    this.state.reset();
    this.loadSchema('step-l1-analysis');
  }

  // ── Template helpers ───────────────────────────────────────────────────────
  getControl(fieldId: string): FormControl {
    return this.form().get(fieldId) as FormControl;
  }

  getNextLabel(action: WorkflowAction): string {
    const stepId = this.state.currentStepId();
    if (action === 'ESCALATE')  return stepId === 'step-l1-analysis' ? '→ L2' : '→ QA';
    if (action === 'SEND_BACK') return stepId === 'step-l2-analysis' ? '→ L1' : '→ L2';
    return '';
  }

  isActionAvailable(action: WorkflowAction): boolean {
    return this.schema()?.availableActions.includes(action) ?? false;
  }

  getCamundaVarEntries(): [string, string][] {
    return Object.entries(this.state.camundaVars());
  }
}
