// =============================================================================
// components/shared/dynamic-field/dynamic-field.component.ts
// Renders one form field from a FormField schema definition.
// Equivalent to: renderField() function in React.
// =============================================================================

import {
  Component, Input, OnInit, OnChanges,
  SimpleChanges, Output, EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { FormField } from '../../../models/workflow.models';

@Component({
  selector: 'wlc-dynamic-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="field-row"
         [class.has-error]="showError"
         [class.hidden]="!isVisible">

      <!-- Label column -->
      <div class="label-col">
        <div class="field-label">
          {{ field.label }}
          <span class="req" *ngIf="field.required"> *</span>
          <span class="route-badge"
                [class.rb-camunda]="field.camundaVar"
                [class.rb-wlc]="!field.camundaVar">
            {{ field.camundaVar ? 'CAMUNDA' : 'WLC' }}
          </span>
        </div>
        <div class="field-note" *ngIf="field.note">{{ field.note }}</div>
      </div>

      <!-- Input column -->
      <div class="input-col">

        <!-- text / email / number / date -->
        <input
          *ngIf="isTextInput"
          class="f-input"
          [type]="field.type"
          [placeholder]="field.placeholder || ''"
          [formControl]="control"
          [id]="field.id"
        />

        <!-- select -->
        <select
          *ngIf="field.type === 'select'"
          class="f-select"
          [formControl]="control"
          [id]="field.id"
        >
          <option value="" disabled>Select…</option>
          <option *ngFor="let opt of field.options" [value]="opt">{{ opt }}</option>
        </select>

        <!-- textarea -->
        <textarea
          *ngIf="field.type === 'textarea'"
          class="f-textarea"
          [placeholder]="field.placeholder || ''"
          [formControl]="control"
          [id]="field.id"
          rows="3"
        ></textarea>

      </div>
    </div>

    <!-- Validation error -->
    <div class="error-msg" *ngIf="showError">⚠ This field is required</div>
  `,
  styles: [`
    .field-row {
      display: grid;
      grid-template-columns: 220px 1fr;
      border-bottom: 1px solid #1a2f4a;
      min-height: 56px;
      transition: background 150ms;
    }
    .field-row:focus-within { background: #0a1628; }
    .field-row.hidden        { display: none; }
    .field-row.has-error .label-col  { border-right-color: #ef4444; }
    .field-row.has-error .f-input,
    .field-row.has-error .f-select,
    .field-row.has-error .f-textarea { color: #ef4444; }

    .label-col {
      padding: 14px 16px 14px 0;
      border-right: 1px solid #1a2f4a;
      display: flex; flex-direction: column;
      justify-content: center; gap: 5px;
    }
    .field-label {
      font-size: 12px; font-weight: 500; color: #e2e8f0;
      display: flex; align-items: center; gap: 6px;
    }
    .req { color: #ef4444; }

    .route-badge {
      font-size: 9px; padding: 2px 6px; border-radius: 3px;
      font-family: 'JetBrains Mono', monospace;
      border: 1px solid; letter-spacing: .04em;
    }
    .rb-camunda { color: #60a5fa; border-color: #1e40af; background: #0f1f3a; }
    .rb-wlc     { color: #4ade80; border-color: #14532d; background: #0a1f10; }

    .field-note {
      font-size: 10px; color: #64748b;
      font-family: 'JetBrains Mono', monospace; line-height: 1.4;
    }

    .input-col {
      padding: 0 0 0 16px;
      display: flex; align-items: center;
    }

    .f-input, .f-select, .f-textarea {
      background: transparent; border: none; outline: none;
      font-family: 'Outfit', sans-serif;
      font-size: 13px; color: #e2e8f0;
      width: 100%; padding: 14px 0;
    }
    .f-textarea { resize: none; padding-top: 16px; align-self: stretch; }
    .f-select   { cursor: pointer; appearance: none; }
    .f-select option { background: #0a1628; }

    .error-msg {
      font-size: 10px; color: #ef4444;
      font-family: 'JetBrains Mono', monospace;
      padding: 3px 0 6px 220px;
    }
  `]
})
export class DynamicFieldComponent implements OnInit, OnChanges {
  @Input({ required: true }) field!:   FormField;
  @Input({ required: true }) control!: FormControl;
  @Input() allValues: Record<string, string> = {};

  isVisible   = true;
  showError   = false;
  isTextInput = false;

  ngOnInit(): void {
    this.isTextInput = ['text','email','number','date'].includes(this.field.type);
    this.updateVisibility();

    // Show error only after the field is touched
    this.control.statusChanges.subscribe(() => {
      this.showError = this.control.invalid && this.control.touched;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allValues']) {
      this.updateVisibility();
    }
  }

  private updateVisibility(): void {
    if (!this.field.showWhen) {
      this.isVisible = true;
      return;
    }
    const { field, value } = this.field.showWhen;
    this.isVisible = this.allValues[field] === value;
  }
}
