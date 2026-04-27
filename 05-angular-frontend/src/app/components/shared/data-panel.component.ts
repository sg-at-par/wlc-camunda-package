// =============================================================================
// components/shared/data-panel.component.ts
// Right panel: Camunda vars, live split preview, flow history, WLC data.
// Equivalent to: <aside class="right-panel"> in React AlertInvestigation.
// =============================================================================

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowStateService } from '../../services/workflow-state.service';
import { ACTION_META, FormSchema, WorkflowAction } from '../../models/workflow.models';

@Component({
  selector: 'wlc-data-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="right-panel">

      <!-- Camunda Variables -->
      <div class="panel-section">
        <div class="section-title">Camunda Variables</div>
        <div *ngIf="state.camundaVarEntries().length === 0" class="empty-note">
          None submitted yet
        </div>
        <div *ngFor="let pair of state.camundaVarEntries()" class="kv-row">
          <span class="kv-key">{{ pair[0] }}</span>
          <span class="kv-value">{{ pair[1] }}</span>
        </div>
      </div>

      <!-- Live Split Preview -->
      <div class="panel-section" *ngIf="schema && hasValues">
        <div class="section-title">Live Split Preview</div>
        <div *ngFor="let field of schema.schema">
          <div class="kv-row" *ngIf="currentValues[field.id]">
            <span class="kv-key"
                  [style.color]="field.camundaVar ? '#60a5fa' : '#4ade80'">
              {{ field.camundaVar ? '▲' : '●' }} {{ field.id }}
            </span>
            <span class="kv-value">{{ truncate(currentValues[field.id]) }}</span>
          </div>
        </div>
      </div>

      <!-- Flow History -->
      <div class="panel-section">
        <div class="section-title">Flow History ({{ state.history().length }})</div>
        <div *ngIf="state.history().length === 0" class="empty-note">
          No steps completed yet
        </div>
        <div *ngFor="let entry of state.history()"
             class="history-entry"
             [style.border-left-color]="getActionBorder(entry.action)">
          <div class="h-step">{{ entry.stepTitle }}</div>
          <div class="h-action" [style.color]="getActionColor(entry.action)">
            {{ entry.action }} — {{ entry.analystName }}
          </div>
          <div class="h-time">{{ entry.time }}</div>
        </div>
      </div>

      <!-- WLC Business Data -->
      <div class="panel-section" *ngIf="wlcDataKeys.length > 0">
        <div class="section-title">WLC Business Data</div>
        <div *ngFor="let stepKey of wlcDataKeys" class="wlc-step-group">
          <div class="wlc-step-label">{{ stepKey }}</div>
          <div *ngFor="let pair of getWlcPairs(stepKey)" class="kv-row">
            <span class="kv-key">{{ pair[0] }}</span>
            <span class="kv-value">{{ truncate(pair[1]) }}</span>
          </div>
        </div>
      </div>

    </aside>
  `,
  styles: [`
    .right-panel {
      background: #0a1628; border-left: 1px solid #1e3a5f;
      overflow-y: auto; padding: 20px 16px;
      display: flex; flex-direction: column; gap: 20px;
      min-width: 280px;
    }
    .section-title {
      font-size: 9px; letter-spacing: .16em; text-transform: uppercase;
      color: #64748b; font-family: 'JetBrains Mono', monospace;
      margin-bottom: 10px; padding-bottom: 6px;
      border-bottom: 1px solid #1a2f4a;
    }
    .empty-note { font-size: 11px; color: #64748b; }
    .kv-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 5px 8px; border-radius: 4px; background: #0f1f38; margin-bottom: 3px;
    }
    .kv-key   { font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
    .kv-value { font-size: 11px; color: #e2e8f0; word-break: break-all; text-align: right; max-width: 140px; }

    .history-entry {
      padding: 9px 10px; border-radius: 5px;
      border-left: 3px solid; background: #0f1f38;
      margin-bottom: 5px; font-size: 11px; line-height: 1.5;
    }
    .h-step   { font-weight: 600; color: #e2e8f0; }
    .h-action { font-family: 'JetBrains Mono', monospace; font-size: 10px; }
    .h-time   { font-size: 9px; color: #64748b; margin-top: 2px; }

    .wlc-step-label {
      font-size: 9px; color: #64748b;
      font-family: 'JetBrains Mono', monospace; margin-bottom: 5px;
    }
    .wlc-step-group { margin-bottom: 12px; }
  `]
})
export class DataPanelComponent {
  @Input() schema?:        FormSchema;
  @Input() currentValues:  Record<string, string> = {};

  state = inject(WorkflowStateService);

  get hasValues(): boolean {
    return Object.values(this.currentValues).some(v => !!v);
  }

  get wlcDataKeys(): string[] {
    return Object.keys(this.state.wlcData());
  }

  getWlcPairs(stepKey: string): [string, string][] {
    return Object.entries(this.state.wlcData()[stepKey] || {});
  }

  getActionColor(action: WorkflowAction): string {
    return ACTION_META[action]?.color ?? '#64748b';
  }

  getActionBorder(action: WorkflowAction): string {
    return ACTION_META[action]?.border ?? '#1e3a5f';
  }

  truncate(val: string, len = 22): string {
    return val?.length > len ? val.slice(0, len) + '…' : val;
  }
}
