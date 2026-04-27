// =============================================================================
// components/shared/workflow-sidebar.component.ts
// Left sidebar showing step status and action legend.
// Equivalent to: <aside class="sidebar"> in React AlertInvestigation.
// =============================================================================

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowStateService } from '../../services/workflow-state.service';
import { ACTION_META, WorkflowAction } from '../../models/workflow.models';

@Component({
  selector: 'wlc-workflow-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="sidebar">
      <div class="sidebar-title">Alert Investigation</div>

      <!-- Step list -->
      <div *ngFor="let step of state.steps()"
           class="step-item"
           [class.active]="step.status === 'active'"
           [class.done]="step.status === 'ESCALATE' || step.status === 'CLOSE'"
           [class.sendback]="step.status === 'SEND_BACK'"
           [class.pending]="step.status === 'pending'">
        <div class="step-num">LEVEL {{ step.num }}</div>
        <div class="step-name">{{ step.label }}</div>
        <span *ngIf="getBadge(step.status) as badge"
              class="step-badge"
              [style.color]="badge.color"
              [style.border-color]="badge.color"
              [style.background]="badge.color + '15'">
          {{ step.status === 'active' ? 'IN PROGRESS' : step.status }}
        </span>
      </div>

      <!-- Action legend -->
      <div class="legend">
        <div class="legend-title">Actions</div>
        <div *ngFor="let action of actions" class="legend-item">
          <span class="legend-icon" [style.color]="getMeta(action).color">
            {{ getMeta(action).icon }}
          </span>
          <div>
            <div class="legend-key" [style.color]="getMeta(action).color">{{ action }}</div>
            <div class="legend-desc">{{ getActionDesc(action) }}</div>
          </div>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      background: #0a1628;
      border-right: 1px solid #1e3a5f;
      padding: 24px 16px;
      display: flex; flex-direction: column; gap: 8px;
      min-width: 260px;
    }
    .sidebar-title {
      font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
      color: #64748b; font-family: 'JetBrains Mono', monospace;
      padding: 0 8px; margin-bottom: 8px;
    }
    .step-item {
      border-radius: 8px; padding: 12px 14px;
      border: 1px solid transparent; transition: all 180ms;
    }
    .step-item.active   { background: #0f2548; border-color: #2563eb; }
    .step-item.done     { background: #0a1f10; border-color: #16a34a; }
    .step-item.sendback { background: #1a1000; border-color: #d97706; }
    .step-item.pending  { opacity: .4; }

    .step-num  { font-size: 9px; color: #64748b; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px; }
    .step-name { font-size: 13px; font-weight: 600; color: #e2e8f0; }
    .step-badge {
      font-size: 9px; font-family: 'JetBrains Mono', monospace;
      padding: 2px 7px; border-radius: 10px; margin-top: 5px;
      display: inline-block; border: 1px solid;
    }

    .legend {
      margin-top: auto; padding-top: 20px;
      border-top: 1px solid #1a2f4a;
    }
    .legend-title {
      font-size: 9px; letter-spacing: .14em; text-transform: uppercase;
      color: #64748b; font-family: 'JetBrains Mono', monospace; margin-bottom: 10px;
    }
    .legend-item {
      display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;
    }
    .legend-icon  { font-size: 14px; }
    .legend-key   { font-size: 11px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
    .legend-desc  { font-size: 10px; color: #64748b; }
  `]
})
export class WorkflowSidebarComponent {
  state   = inject(WorkflowStateService);
  actions = (['ESCALATE', 'CLOSE', 'SEND_BACK'] as WorkflowAction[]);

  getMeta(action: WorkflowAction | string) {
    return ACTION_META[action as WorkflowAction] ?? { color: '#64748b', icon: '·' };
  }

  getBadge(status: string) {
    if (status === 'pending') return null;
    return this.getMeta(status);
  }

  getActionDesc(action: WorkflowAction): string {
    const map: Record<WorkflowAction, string> = {
      ESCALATE:  'Move to next level',
      CLOSE:     'End investigation',
      SEND_BACK: 'Request more info',
    };
    return map[action];
  }
}
