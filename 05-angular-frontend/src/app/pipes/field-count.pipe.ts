// =============================================================================
// pipes/field-count.pipe.ts
// Counts fields by camundaVar flag — replaces .filter(f => f.camundaVar).length
// Usage in template: schema.schema | fieldCount:true
// =============================================================================

import { Pipe, PipeTransform } from '@angular/core';
import { FormField } from '../models/workflow.models';

@Pipe({ name: 'fieldCount', standalone: true, pure: true })
export class FieldCountPipe implements PipeTransform {
  transform(fields: FormField[], camundaVar: boolean): number {
    return fields.filter(f => f.camundaVar === camundaVar).length;
  }
}
