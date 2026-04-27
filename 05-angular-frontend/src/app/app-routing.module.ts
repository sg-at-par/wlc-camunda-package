// =============================================================================
// app/app-routing.module.ts
// =============================================================================

import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'alert-investigation',
    pathMatch: 'full',
  },
  {
    path: 'alert-investigation',
    loadComponent: () =>
      import('./components/alert-investigation/alert-investigation.component')
        .then(m => m.AlertInvestigationComponent),
    title: 'Alert Investigation — WLC',
  },
  {
    path: '**',
    redirectTo: 'alert-investigation',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
