# WLC · Camunda 8.7 — Angular 17

Angular conversion of the White-Label Component React prototype.

## Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Angular 17 (standalone components)  |
| State       | Angular Signals (`signal`, `computed`) |
| Forms       | ReactiveFormsModule (`FormGroup`, `FormControl`) |
| HTTP        | `HttpClient` (Angular `HttpClientModule`) |
| Styling     | Component-scoped CSS + global reset |
| Language    | TypeScript 5.2                      |

## Quick Start

```bash
npm install
npm start          # dev server on http://localhost:4200
npm run build      # production build → dist/
```

## Project Structure

```
src/app/
├── models/
│   └── workflow.models.ts          # All TypeScript interfaces & types
│
├── services/
│   ├── schema.service.ts           # Fetches form schemas, splits payload
│   └── workflow-state.service.ts   # Signals-based runtime state
│
├── pipes/
│   └── field-count.pipe.ts         # fieldCount pipe for templates
│
├── components/
│   ├── alert-investigation/
│   │   ├── alert-investigation.component.ts    # Main orchestrator
│   │   ├── alert-investigation.component.html  # Template
│   │   └── alert-investigation.component.css   # Styles
│   │
│   └── shared/
│       ├── dynamic-field.component.ts    # Single field renderer (JSON → input)
│       ├── workflow-sidebar.component.ts # Left sidebar, step status
│       └── data-panel.component.ts       # Right panel, live data inspector
│
├── app.module.ts         # Root NgModule
├── app-routing.module.ts # Routes
└── app.component.ts      # Root shell
```

## React → Angular Mapping

| React                          | Angular                                      |
|--------------------------------|----------------------------------------------|
| `useState`                     | `signal()`                                   |
| `useEffect`                    | `ngOnInit()` / `ngOnChanges()`               |
| `useMemo` / `computed value`   | `computed()`                                 |
| `useWorkflowEngine` hook       | `WorkflowStateService` + `SchemaService`     |
| `props`                        | `@Input()` decorators                        |
| JSX `renderField()`            | `DynamicFieldComponent` + `*ngFor`           |
| Conditional render (`&&`)      | `*ngIf`                                      |
| List render (`.map()`)         | `*ngFor`                                     |
| `useState` form values         | `ReactiveFormsModule` (`FormGroup`)          |
| Inline CSS                     | Component `styleUrls` / `styles`             |
| `fetch()` calls                | `HttpClient` in `SchemaService`              |

## Connecting to the WLC API

In `src/environments/environment.ts`, set `wlcApiUrl` to your Node.js
Express server (`wlc-api-server.js`). In development the app uses local
schema data; in production it calls:

```
GET /api/workflows/alert-investigation-v1/steps/:stepId/template
POST /api/instances/:instanceId/submit
```

## Data Routing (unchanged from React)

Fields with `camundaVar: true` → sent to Camunda via `POST /v1/tasks/:id/complete`
Fields with `camundaVar: false` → stored in `step_submissions.wlc_data` (WLC DB)
