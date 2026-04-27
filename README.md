# WLC ↔ Camunda 8.7 — Complete Solution Package

**White-Label Component (WLC) integration with Camunda 8.7 on-premises**
Alert Investigation Workflow: L1 Analysis → L2 Analysis → QA Analysis

---

## Package Contents

```
wlc-camunda-package/
│
├── 01-database/                    PostgreSQL schema, seeds, named queries
│   ├── migrations/
│   │   ├── 001_create_camunda_workflows.sql
│   │   ├── 002_create_workflow_steps.sql      ← stores JSON form templates
│   │   ├── 003_create_process_instances.sql   ← runtime instance tracking
│   │   ├── 004_create_step_submissions.sql    ← WLC business data store
│   │   └── 005_create_audit_log.sql           ← append-only audit trail
│   ├── seeds/
│   │   ├── 001_seed_workflows.sql             ← generic workflow registry
│   │   └── 002_seed_alert_investigation.sql   ← L1/L2/QA form templates
│   └── queries/
│       ├── workflow_queries.sql               ← read-side named queries
│       └── runtime_queries.sql               ← write-side named queries
│
├── 02-backend-api/                 Node.js / Express REST API
│   ├── db.js                       PostgreSQL connection pool + all SQL
│   ├── wlc-schema-service.js       Business logic layer
│   └── wlc-api-server.js           Express REST endpoints
│
├── 03-bpmn/                        Camunda 8.7 process definition
│   └── alert-investigation-v1.bpmn BPMN 2.0 — deploy to Zeebe
│
├── 04-react-frontend/              React JSX components (original)
│   ├── AlertInvestigation.jsx      Main alert workflow form (L1/L2/QA)
│   ├── CamundaFormEngine.jsx       Full engine with sidebar catalog
│   ├── FormRenderer.jsx            Isolated JSON→UI renderer demo
│   └── ArchDiagram.jsx             Interactive architecture diagram
│
├── 05-angular-frontend/            Angular 17 conversion (production-ready)
│   ├── src/app/
│   │   ├── models/workflow.models.ts              TypeScript interfaces
│   │   ├── services/schema.service.ts             Schema fetch + payload split
│   │   ├── services/workflow-state.service.ts     Angular Signals state
│   │   ├── pipes/field-count.pipe.ts              Utility pipe
│   │   └── components/
│   │       ├── alert-investigation/               Main form orchestrator
│   │       └── shared/
│   │           ├── dynamic-field.component.ts     JSON→UI field renderer
│   │           ├── workflow-sidebar.component.ts  Step progress sidebar
│   │           └── data-panel.component.ts        Live data inspector panel
│   ├── package.json
│   ├── angular.json
│   ├── tsconfig.json
│   └── README.md
│
└── 06-architecture-diagrams/       Technical architecture diagrams
    ├── WLC_Camunda_Architecture.pdf   3-page PDF (A3 landscape)
    └── WLC_Camunda_Architecture.vsdx  Native Visio file (editable)
```

---

## Prerequisites

| Component      | Requirement                        |
|----------------|------------------------------------|
| PostgreSQL     | 14+                                |
| Node.js        | 18+                                |
| npm            | 9+                                 |
| Angular CLI    | 17+ (`npm install -g @angular/cli`)|
| Camunda        | 8.7 on-premises (Zeebe engine)     |
| Camunda Modeler| Latest (to deploy BPMN)            |

---

## Step 1 — Database Setup

### 1.1 Create the database

```bash
createdb wlc_camunda
```

### 1.2 Create a dedicated application user

```sql
CREATE USER wlc_app WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE wlc_camunda TO wlc_app;
```

### 1.3 Run migrations in order

```bash
cd 01-database

psql -d wlc_camunda -f migrations/001_create_camunda_workflows.sql
psql -d wlc_camunda -f migrations/002_create_workflow_steps.sql
psql -d wlc_camunda -f migrations/003_create_process_instances.sql
psql -d wlc_camunda -f migrations/004_create_step_submissions.sql
psql -d wlc_camunda -f migrations/005_create_audit_log.sql
```

### 1.4 Seed reference data

```bash
psql -d wlc_camunda -f seeds/001_seed_workflows.sql
psql -d wlc_camunda -f seeds/002_seed_alert_investigation.sql
```

### 1.5 Verify

```sql
-- Should return 1 workflow
SELECT camunda_process_key, display_name FROM camunda_workflows;

-- Should return 3 steps with JSON templates
SELECT camunda_step_id, step_name, step_order
FROM workflow_steps
ORDER BY step_order;
```

---

## Step 2 — Backend API Setup

### 2.1 Install dependencies

```bash
cd 02-backend-api
npm init -y
npm install pg express
```

### 2.2 Set environment variables

```bash
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=wlc_camunda
export PGUSER=wlc_app
export PGPASSWORD=changeme
export PORT=3001
export ALLOWED_ORIGIN=http://localhost:4200
```

Or create a `.env` file and use `dotenv`:

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=wlc_camunda
PGUSER=wlc_app
PGPASSWORD=changeme
PORT=3001
ALLOWED_ORIGIN=http://localhost:4200
```

### 2.3 Start the API server

```bash
node wlc-api-server.js
```

### 2.4 Verify the API

```bash
# Health check
curl http://localhost:3001/health

# List workflows
curl http://localhost:3001/api/workflows

# Fetch L1 form template
curl http://localhost:3001/api/workflows/alert-investigation-v1/steps/step-l1-analysis/template
```

### Key API Endpoints

| Method | Endpoint                                              | Description                        |
|--------|-------------------------------------------------------|------------------------------------|
| GET    | /api/workflows                                        | List all active workflows          |
| GET    | /api/workflows/:key/steps                             | Steps for a workflow               |
| GET    | /api/workflows/:key/steps/:stepId/template            | JSON form template ← hot path      |
| POST   | /api/instances                                        | Register new process instance      |
| POST   | /api/instances/:id/submit                             | Submit step data (split routing)   |
| GET    | /api/instances/active                                 | All active instances               |
| GET    | /api/instances/:camundaKey/history                    | Submission history                 |
| GET    | /api/instances/:camundaKey/audit                      | Audit log                          |
| PUT    | /api/admin/workflows                                  | Register/update workflow           |
| PUT    | /api/admin/workflows/:key/steps/:stepId               | Upsert form template               |

---

## Step 3 — Deploy BPMN to Camunda

### 3.1 Using Camunda Modeler (recommended)

1. Open **Camunda Modeler**
2. File → Open → select `03-bpmn/alert-investigation-v1.bpmn`
3. Click **Deploy** → enter your Camunda 8.7 cluster endpoint
4. Confirm deployment

### 3.2 Using the Camunda REST API

```bash
curl -X POST http://your-camunda-host:8080/v1/deployments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "resources=@03-bpmn/alert-investigation-v1.bpmn"
```

### 3.3 Workflow routing logic

| Current Step    | Action    | Next Step          |
|-----------------|-----------|--------------------|
| L1 Analysis     | ESCALATE  | L2 Analysis        |
| L1 Analysis     | CLOSE     | End (closed at L1) |
| L2 Analysis     | ESCALATE  | QA Analysis        |
| L2 Analysis     | CLOSE     | End (closed at L2) |
| L2 Analysis     | SEND_BACK | L1 Analysis (loop) |
| QA Analysis     | CLOSE     | Compliance check → End |
| QA Analysis     | SEND_BACK | L2 Analysis (loop) |

### 3.4 Camunda variables vs WLC data

Fields marked `camundaVar: true` in the JSON template are sent to Camunda
as process variables (they drive gateway conditions in the BPMN). All other
fields are stored only in `step_submissions.wlc_data` in your PostgreSQL DB.

---

## Step 4 — Frontend Setup

### Option A: Angular (recommended for production)

```bash
cd 05-angular-frontend
npm install
```

Update the API URL in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  wlcApiUrl: 'http://localhost:3001',  // ← your WLC API server
};
```

Start the dev server:

```bash
npm start
# App available at http://localhost:4200
```

Production build:

```bash
npm run build
# Output in dist/wlc-camunda-angular/
```

### Option B: React (prototype / development only)

The React components are standalone JSX files. Use them in any React project
(Create React App, Vite, Next.js):

```bash
# With Vite
npm create vite@latest wlc-react -- --template react
cd wlc-react
npm install
cp ../04-react-frontend/*.jsx src/
npm run dev
```

Import the main component:

```jsx
import AlertInvestigation from './AlertInvestigation';
// Render anywhere
<AlertInvestigation />
```

---

## Step 5 — Register the Compliance Notification Worker

The BPMN contains a service task (`compliance-notify`) that fires when
`complianceFlag != "None"` after QA closes an investigation. Register a
Zeebe job worker to handle it:

```javascript
const { ZBClient } = require('zeebe-node');
const zbc = new ZBClient('your-camunda-host:26500');

zbc.createWorker({
  taskType: 'compliance-notify',
  taskHandler: async (job) => {
    const { complianceFlag, finalClassification, alertId } = job.variables;
    // Send notification to your compliance team
    await notifyComplianceTeam({ complianceFlag, finalClassification, alertId });
    return job.complete();
  },
});
```

---

## Step 6 — Adding a New Workflow

To add a new workflow without touching code:

### 6.1 Register it via the Admin API

```bash
curl -X PUT http://localhost:3001/api/admin/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "camundaProcessKey": "my-new-workflow-v1",
    "displayName": "My New Workflow",
    "description": "Description here",
    "version": "1.0.0"
  }'
```

### 6.2 Add step templates

```bash
curl -X PUT http://localhost:3001/api/admin/workflows/my-new-workflow-v1/steps/step-one \
  -H "Content-Type: application/json" \
  -d '{
    "stepName": "Step One",
    "stepOrder": 0,
    "formTemplate": {
      "stepId": "step-one",
      "title": "Step One",
      "subtitle": "Step 1 of N",
      "availableActions": ["ESCALATE", "CLOSE"],
      "schema": [
        {
          "id": "myField",
          "type": "text",
          "label": "My Field",
          "required": true,
          "camundaVar": true
        }
      ]
    }
  }'
```

### 6.3 Field types supported

| type       | Renders as              | Notes                              |
|------------|-------------------------|------------------------------------|
| `text`     | `<input type="text">`   |                                    |
| `email`    | `<input type="email">`  | Browser-validated                  |
| `number`   | `<input type="number">` |                                    |
| `date`     | `<input type="date">`   | Browser date picker                |
| `select`   | `<select>`              | Requires `options` array           |
| `textarea` | `<textarea>`            |                                    |
| `checkbox` | `<input type="checkbox">`|                                   |

Use `showWhen: { field: "fieldId", value: "someValue" }` to make a field
conditionally visible based on another field's value.

---

## Architecture Diagrams

Open `06-architecture-diagrams/` for:

- **WLC_Camunda_Architecture.pdf** — 3-page A3 PDF:
  - Page 1: System overview (all layers + data routing callouts)
  - Page 2: End-to-end request flow (12-step sequence)
  - Page 3: Database schema (all 5 tables with columns + FK relationships)

- **WLC_Camunda_Architecture.vsdx** — Native Visio file:
  - Opens in Microsoft Visio (any version supporting OOXML)
  - Opens in draw.io: File → Import → VSDX
  - Opens in Lucidchart: Import → Visio
  - All shapes are individually editable

---

## Data Flow Summary

```
User submits form
      │
      ▼
WLC splits payload by camundaVar flag
      │
      ├─ camundaVar: true  ──► POST /v1/tasks/:id/complete  ──► Camunda Zeebe
      │                        (drives BPMN gateway decisions)
      │
      └─ camundaVar: false ──► POST /api/instances/:id/submit ──► PostgreSQL
                               (step_submissions.wlc_data)

After submit:
      WLC polls GET /v1/user-tasks?processInstanceKey=…
            │
            └─ Camunda returns taskDefinitionId
                    │
                    └─ WLC fetches JSON template from workflow_steps
                            │
                            └─ Renderer displays next form
```

---

## Environment Variable Reference

| Variable         | Default         | Description                     |
|------------------|-----------------|---------------------------------|
| `PGHOST`         | `localhost`     | PostgreSQL host                 |
| `PGPORT`         | `5432`          | PostgreSQL port                 |
| `PGDATABASE`     | `wlc_camunda`   | Database name                   |
| `PGUSER`         | `wlc_app`       | Database user                   |
| `PGPASSWORD`     | —               | Database password               |
| `PORT`           | `3001`          | API server port                 |
| `ALLOWED_ORIGIN` | `*`             | CORS origin (tighten in prod)   |

---

## Technology Stack

| Layer              | Technology                    | Version  |
|--------------------|-------------------------------|----------|
| Workflow Engine    | Camunda / Zeebe               | 8.7      |
| Database           | PostgreSQL                    | 14+      |
| Backend API        | Node.js + Express             | 18+      |
| Frontend (Angular) | Angular + TypeScript          | 17 / 5.2 |
| Frontend (React)   | React + JSX                   | 18+      |
| Process Definition | BPMN 2.0                      | —        |

---

*Generated by WLC Engineering — Claude AI assisted*
