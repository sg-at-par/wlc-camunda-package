// =============================================================================
// api/wlc-api-server.js
// Express REST server — the HTTP interface consumed by the React WLC component.
//
// Start:  node wlc-api-server.js
// Port:   process.env.PORT  (default 3001)
// =============================================================================

'use strict';

const express = require('express');
const svc     = require('./wlc-schema-service');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// CORS — tighten to your WLC origin in production
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Attach correlation id from header (for audit trail)
app.use((req, _res, next) => {
  req.correlationId = req.headers['x-correlation-id'] ?? `wlc-${Date.now()}`;
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Error helper
// ─────────────────────────────────────────────────────────────────────────────

function handleError(res, err, context) {
  console.error(`[API] ${context}:`, err.message);
  const status = err.message.includes('not found') ? 404 : 500;
  res.status(status).json({ error: err.message, context });
}

// =============================================================================
// CATALOG ENDPOINTS
// =============================================================================

/**
 * GET /api/workflows
 * List all active workflows for the UI sidebar.
 */
app.get('/api/workflows', async (_req, res) => {
  try {
    const workflows = await svc.listWorkflows();
    res.json(workflows);
  } catch (err) {
    handleError(res, err, 'listWorkflows');
  }
});

/**
 * GET /api/workflows/:processKey/steps
 * All steps for a workflow (progress tracker).
 */
app.get('/api/workflows/:processKey/steps', async (req, res) => {
  try {
    const steps = await svc.getWorkflowSteps(req.params.processKey);
    if (!steps.length) return res.status(404).json({ error: 'Workflow not found or has no active steps.' });
    res.json(steps);
  } catch (err) {
    handleError(res, err, 'getWorkflowSteps');
  }
});

// =============================================================================
// FORM TEMPLATE ENDPOINT  ← hottest path
// =============================================================================

/**
 * GET /api/workflows/:processKey/steps/:stepId/template
 *
 * Called by the WLC after Camunda returns the next taskDefinitionId.
 * Returns the JSONB form schema the dynamic renderer needs.
 *
 * Example:
 *   GET /api/workflows/customer-onboarding-v2/steps/step-kyc/template
 */
app.get('/api/workflows/:processKey/steps/:stepId/template', async (req, res) => {
  try {
    const template = await svc.getFormTemplate(req.params.processKey, req.params.stepId);
    if (!template) {
      return res.status(404).json({
        error: `No active template found for processKey="${req.params.processKey}" stepId="${req.params.stepId}"`,
      });
    }
    res.json(template);
  } catch (err) {
    handleError(res, err, 'getFormTemplate');
  }
});

// =============================================================================
// PROCESS INSTANCE LIFECYCLE
// =============================================================================

/**
 * POST /api/instances
 * Called after Camunda confirms a new process instance was started.
 *
 * Body: {
 *   camundaProcessKey:   "customer-onboarding-v2",
 *   camundaInstanceKey:  2251799813685249,
 *   firstStepId:         "step-onboarding",
 *   initiatedBy?:        "user-123",
 *   tenantId?:           "tenant-abc"
 * }
 */
app.post('/api/instances', async (req, res) => {
  try {
    const { camundaProcessKey, camundaInstanceKey, firstStepId, initiatedBy, tenantId } = req.body;
    if (!camundaProcessKey || !camundaInstanceKey || !firstStepId) {
      return res.status(400).json({ error: 'camundaProcessKey, camundaInstanceKey, firstStepId are required.' });
    }
    const result = await svc.createProcessInstance({
      camundaProcessKey,
      camundaInstanceKey: BigInt(camundaInstanceKey),
      firstStepId,
      initiatedBy,
      tenantId,
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err, 'createProcessInstance');
  }
});

/**
 * GET /api/instances/active
 * Dashboard: all running instances.
 */
app.get('/api/instances/active', async (_req, res) => {
  try {
    res.json(await svc.getActiveInstances());
  } catch (err) {
    handleError(res, err, 'getActiveInstances');
  }
});

/**
 * GET /api/instances/:camundaInstanceKey/history
 * Full submission history for a process instance.
 */
app.get('/api/instances/:camundaInstanceKey/history', async (req, res) => {
  try {
    const rows = await svc.getInstanceHistory(BigInt(req.params.camundaInstanceKey));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getInstanceHistory');
  }
});

/**
 * GET /api/instances/:camundaInstanceKey/audit
 * Audit trail for a process instance.
 */
app.get('/api/instances/:camundaInstanceKey/audit', async (req, res) => {
  try {
    const rows = await svc.getAuditLog(BigInt(req.params.camundaInstanceKey));
    res.json(rows);
  } catch (err) {
    handleError(res, err, 'getAuditLog');
  }
});

// =============================================================================
// STEP SUBMISSION
// =============================================================================

/**
 * POST /api/instances/:instanceId/submit
 * Save a completed step submission. Splits data into WLC and Camunda paths.
 *
 * Body: {
 *   camundaProcessKey:  "customer-onboarding-v2",
 *   currentStepId:      "step-onboarding",
 *   nextStepId:         "step-kyc",           // omit or null on last step
 *   camundaTaskId:      "task-abc123",
 *   wlcData:            { firstName: "Jane", lastName: "Smith", email: "..." },
 *   camundaVariables:   { tier: "Premium", startDate: "2026-04-22" },
 *   submittedBy?:       "user-123"
 * }
 */
app.post('/api/instances/:instanceId/submit', async (req, res) => {
  try {
    const { camundaProcessKey, currentStepId, nextStepId, camundaTaskId,
            wlcData, camundaVariables, submittedBy } = req.body;

    if (!camundaProcessKey || !currentStepId || !wlcData || !camundaVariables) {
      return res.status(400).json({ error: 'camundaProcessKey, currentStepId, wlcData and camundaVariables are required.' });
    }

    const result = await svc.saveStepSubmission({
      instanceId:       parseInt(req.params.instanceId, 10),
      camundaProcessKey,
      currentStepId,
      nextStepId:       nextStepId ?? null,
      camundaTaskId:    camundaTaskId ?? null,
      wlcData,
      camundaVariables,
      submittedBy:      submittedBy ?? null,
      correlationId:    req.correlationId,
    });

    res.status(201).json(result);
  } catch (err) {
    handleError(res, err, 'saveStepSubmission');
  }
});

// =============================================================================
// ADMIN: manage templates
// =============================================================================

/**
 * PUT /api/admin/workflows
 * Register or update a workflow definition.
 */
app.put('/api/admin/workflows', async (req, res) => {
  try {
    const { camundaProcessKey, displayName, description, version } = req.body;
    if (!camundaProcessKey || !displayName) {
      return res.status(400).json({ error: 'camundaProcessKey and displayName are required.' });
    }
    const result = await svc.upsertWorkflow({ camundaProcessKey, displayName, description, version });
    res.json(result);
  } catch (err) {
    handleError(res, err, 'upsertWorkflow');
  }
});

/**
 * PUT /api/admin/workflows/:processKey/steps/:stepId
 * Create or replace the JSON form template for a step.
 *
 * Body: {
 *   stepName:     "KYC Verification",
 *   stepOrder:    1,
 *   formTemplate: { stepId: "step-kyc", title: "...", schema: [...] }
 * }
 */
app.put('/api/admin/workflows/:processKey/steps/:stepId', async (req, res) => {
  try {
    const { stepName, stepOrder, formTemplate } = req.body;
    if (!stepName || !formTemplate) {
      return res.status(400).json({ error: 'stepName and formTemplate are required.' });
    }
    const result = await svc.upsertStepTemplate({
      camundaProcessKey: req.params.processKey,
      camundaStepId:     req.params.stepId,
      stepName,
      stepOrder:         stepOrder ?? 0,
      formTemplate,
    });
    res.json(result);
  } catch (err) {
    handleError(res, err, 'upsertStepTemplate');
  }
});

/**
 * DELETE /api/admin/workflows/:processKey/steps/:stepId
 * Soft-delete (deactivate) a step template.
 */
app.delete('/api/admin/workflows/:processKey/steps/:stepId', async (req, res) => {
  try {
    const result = await svc.deactivateStep(req.params.processKey, req.params.stepId);
    if (!result) return res.status(404).json({ error: 'Step not found.' });
    res.json({ deactivated: true, ...result });
  } catch (err) {
    handleError(res, err, 'deactivateStep');
  }
});

// =============================================================================
// Health check
// =============================================================================

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'wlc-api', timestamp: new Date().toISOString() });
});

// =============================================================================
// Start
// =============================================================================

app.listen(PORT, () => {
  console.log(`[WLC API] Listening on http://localhost:${PORT}`);
  console.log(`[WLC API] PostgreSQL → ${process.env.PGHOST ?? 'localhost'}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? 'wlc_camunda'}`);
});

module.exports = app; // for testing
