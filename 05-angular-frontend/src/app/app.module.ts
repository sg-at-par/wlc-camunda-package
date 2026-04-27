// =============================================================================
// app/app.module.ts
// Root NgModule — wires all components, services, routing.
// =============================================================================

import { NgModule }             from '@angular/core';
import { BrowserModule }        from '@angular/platform-browser';
import { HttpClientModule }     from '@angular/common/http';
import { ReactiveFormsModule }  from '@angular/forms';

import { AppRoutingModule }     from './app-routing.module';
import { AppComponent }         from './app.component';

// Standalone components are imported directly into routes/other standalones,
// but we declare the shell AppComponent here.
@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    AppRoutingModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
