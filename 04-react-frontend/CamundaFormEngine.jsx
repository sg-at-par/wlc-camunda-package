import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SERVICES  (replace with real HTTP calls in production)
// ─────────────────────────────────────────────────────────────────────────────

/** Simulates your White-Label Component (WLC) database */
const WLC_DB = {
  "step-onboarding": {
    stepId: "step-onboarding",
    title: "Customer Onboarding",
    subtitle: "Step 1 of 3",
    schema: [
      { id: "firstName", type: "text",   label: "First Name",   required: true,  camundaVar: false },
      { id: "lastName",  type: "text",   label: "Last Name",    required: true,  camundaVar: false },
      { id: "email",     type: "email",  label: "Email",        required: true,  camundaVar: false },
      { id: "tier",      type: "select", label: "Customer Tier", required: true, camundaVar: true,
        options: ["Standard", "Premium", "Enterprise"] },
      { id: "startDate", type: "date",   label: "Start Date",   required: true,  camundaVar: true },
    ],
  },
  "step-kyc": {
    stepId: "step-kyc",
    title: "KYC Verification",
    subtitle: "Step 2 of 3",
    schema: [
      { id: "docType",   type: "select", label: "Document Type", required: true, camundaVar: true,
        options: ["Passport", "Driver's License", "National ID"] },
      { id: "docNumber", type: "text",   label: "Document Number", required: true, camundaVar: false },
      { id: "country",   type: "select", label: "Issuing Country",  required: true, camundaVar: true,
        options: ["US", "UK", "DE", "FR", "SG"] },
      { id: "notes",     type: "textarea", label: "Additional Notes", required: false, camundaVar: false },
    ],
  },
  "step-approval": {
    stepId: "step-approval",
    title: "Final Approval",
    subtitle: "Step 3 of 3",
    schema: [
      { id: "reviewerName", type: "text",   label: "Reviewer Name",   required: true,  camundaVar: false },
      { id: "decision",     type: "select", label: "Decision",         required: true,  camundaVar: true,
        options: ["Approve", "Reject", "Escalate"] },
      { id: "reason",       type: "textarea", label: "Reason / Comment", required: false, camundaVar: false },
    ],
  },
};

/** Simulates Camunda 8.7 REST API */
const CamundaAPI = {
  baseUrl: "http://camunda-onprem:8080/v1",   // ← your on-prem URL

  async startProcess(processKey, variables) {
    await delay(600);
    return {
      processInstanceKey: `pi-${Date.now()}`,
      processDefinitionKey: processKey,
      status: "ACTIVE",
    };
  },

  async completeTask(taskId, camundaVariables) {
    await delay(500);
    return { taskId, completed: true };
  },

  async getNextUserTask(processInstanceKey) {
    await delay(700);
    const steps = ["step-onboarding", "step-kyc", "step-approval"];
    const current = steps[Math.floor(Math.random() * steps.length)];
    return {
      taskId: `task-${Date.now()}`,
      taskDefinitionId: current,
      name: WLC_DB[current]?.title,
      processInstanceKey,
    };
  },
};

const WLC_API = {
  async getFormSchema(stepId) {
    await delay(300);
    return WLC_DB[stepId] ?? null;
  },

  async saveBusinessData(stepId, data) {
    await delay(200);
    console.log("[WLC] Business data saved:", { stepId, data });
    return { saved: true };
  },
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0a0c10;
    --surface:   #10141c;
    --surface2:  #161c28;
    --border:    #232b3e;
    --accent:    #3d7eff;
    --accent2:   #00e5b0;
    --danger:    #ff4560;
    --warn:      #ffb830;
    --text:      #e8eaf0;
    --muted:     #6b7891;
    --radius:    10px;
    --font:      'Syne', sans-serif;
    --mono:      'DM Mono', monospace;
    --trans:     200ms cubic-bezier(.4,0,.2,1);
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); }

  .engine-root {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px 1fr 320px;
    grid-template-rows: 56px 1fr;
    background: var(--bg);
  }

  /* ── TOP BAR ── */
  .topbar {
    grid-column: 1 / -1;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px;
    padding: 0 24px;
  }
  .topbar-logo {
    font-size: 13px; font-weight: 800; letter-spacing: .12em;
    text-transform: uppercase; color: var(--accent2);
    font-family: var(--mono);
  }
  .topbar-sep { width: 1px; height: 20px; background: var(--border); }
  .topbar-title { font-size: 14px; color: var(--muted); flex: 1; }
  .topbar-badge {
    font-size: 11px; font-family: var(--mono); padding: 3px 10px;
    border-radius: 20px; background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  }

  /* ── SIDEBAR ── */
  .sidebar {
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 20px 16px;
    overflow-y: auto;
  }
  .sidebar-section { margin-bottom: 24px; }
  .sidebar-label {
    font-size: 10px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; color: var(--muted);
    margin-bottom: 10px; padding: 0 8px;
    font-family: var(--mono);
  }
  .process-card {
    padding: 12px; border-radius: var(--radius);
    border: 1px solid var(--border); cursor: pointer;
    transition: var(--trans); margin-bottom: 8px;
    background: transparent;
  }
  .process-card:hover { background: var(--surface2); border-color: var(--accent); }
  .process-card.active {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-color: var(--accent);
  }
  .process-card-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .process-card-key  { font-size: 11px; color: var(--muted); font-family: var(--mono); }
  .status-dot {
    display: inline-block; width: 7px; height: 7px;
    border-radius: 50%; margin-right: 6px;
  }
  .status-active  { background: var(--accent2); box-shadow: 0 0 6px var(--accent2); }
  .status-waiting { background: var(--warn); }
  .status-idle    { background: var(--muted); }

  /* ── MAIN AREA ── */
  .main {
    overflow-y: auto;
    background: var(--bg);
    padding: 28px 32px;
    display: flex; flex-direction: column; gap: 24px;
  }

  /* ── STEP TRACKER ── */
  .step-tracker {
    display: flex; align-items: center; gap: 0;
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .step-node {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; flex: 1;
  }
  .step-circle {
    width: 32px; height: 32px; border-radius: 50%;
    border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; font-family: var(--mono);
    transition: var(--trans); background: var(--surface);
  }
  .step-circle.done    { border-color: var(--accent2); color: var(--accent2); background: color-mix(in srgb, var(--accent2) 12%, transparent); }
  .step-circle.current { border-color: var(--accent);  color: var(--accent);  background: color-mix(in srgb, var(--accent)  18%, transparent); }
  .step-label { font-size: 11px; color: var(--muted); text-align: center; max-width: 80px; }
  .step-label.current { color: var(--text); font-weight: 600; }
  .step-line {
    flex: 0 0 40px; height: 2px;
    background: var(--border); margin-bottom: 18px;
    transition: var(--trans);
  }
  .step-line.done { background: var(--accent2); }

  /* ── FORM CARD ── */
  .form-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    animation: slideIn .3s ease;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .form-header {
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .form-title   { font-size: 18px; font-weight: 700; }
  .form-sub     { font-size: 12px; color: var(--muted); margin-top: 4px; font-family: var(--mono); }
  .form-body    { padding: 24px; display: grid; gap: 18px; }
  .form-footer  {
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    display: flex; gap: 12px; justify-content: flex-end;
  }

  /* ── FIELD ── */
  .field-wrap   { display: flex; flex-direction: column; gap: 6px; }
  .field-label  {
    font-size: 12px; font-weight: 600; letter-spacing: .04em;
    display: flex; align-items: center; gap: 8px;
  }
  .field-label .req { color: var(--danger); }
  .field-badge {
    font-size: 9px; font-family: var(--mono); padding: 2px 7px;
    border-radius: 20px; font-weight: 500;
    letter-spacing: .06em;
  }
  .badge-camunda {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .badge-wlc {
    background: color-mix(in srgb, var(--accent2) 12%, transparent);
    color: var(--accent2);
    border: 1px solid color-mix(in srgb, var(--accent2) 22%, transparent);
  }
  .field-input, .field-select, .field-textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    padding: 10px 14px;
    width: 100%;
    outline: none;
    transition: var(--trans);
    appearance: none;
  }
  .field-input:focus, .field-select:focus, .field-textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
  }
  .field-input.error, .field-select.error, .field-textarea.error {
    border-color: var(--danger);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 12%, transparent);
  }
  .field-textarea { resize: vertical; min-height: 80px; }
  .field-error { font-size: 11px; color: var(--danger); font-family: var(--mono); }

  /* ── BUTTONS ── */
  .btn {
    padding: 10px 22px; border-radius: 8px; font-family: var(--font);
    font-size: 13px; font-weight: 700; letter-spacing: .04em;
    cursor: pointer; border: none; transition: var(--trans);
    display: inline-flex; align-items: center; gap: 8px;
  }
  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) { background: #5590ff; transform: translateY(-1px); }
  .btn-ghost {
    background: transparent; color: var(--muted);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover:not(:disabled) { color: var(--text); border-color: var(--accent); }
  .btn-danger {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  }
  .btn:disabled { opacity: .45; cursor: not-allowed; }
  .btn-sm { padding: 6px 14px; font-size: 12px; }
  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.25);
    border-top-color: #fff;
    animation: spin .7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── RIGHT PANEL ── */
  .right-panel {
    background: var(--surface);
    border-left: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .panel-tabs {
    display: flex; border-bottom: 1px solid var(--border);
  }
  .panel-tab {
    flex: 1; padding: 14px 8px; font-size: 12px; font-weight: 600;
    text-align: center; cursor: pointer; color: var(--muted);
    transition: var(--trans); border: none; background: transparent;
    letter-spacing: .04em;
  }
  .panel-tab.active { color: var(--accent); border-bottom: 2px solid var(--accent); }
  .panel-body { flex: 1; overflow-y: auto; padding: 16px; }

  /* ── DATA INSPECTOR ── */
  .data-section { margin-bottom: 16px; }
  .data-section-head {
    font-size: 10px; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: var(--muted);
    margin-bottom: 8px; font-family: var(--mono);
    display: flex; align-items: center; gap: 8px;
  }
  .data-section-head::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }
  .kv-row {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 7px 10px; border-radius: 6px; gap: 12px;
    background: var(--surface2); margin-bottom: 4px;
  }
  .kv-key   { font-size: 11px; color: var(--muted); font-family: var(--mono); flex-shrink: 0; }
  .kv-value { font-size: 12px; color: var(--text); word-break: break-all; text-align: right; }
  .json-box {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px;
    font-family: var(--mono); font-size: 11px;
    color: var(--accent2); white-space: pre-wrap;
    word-break: break-all; max-height: 260px; overflow-y: auto;
  }

  /* ── LOG ── */
  .log-entry {
    padding: 8px 10px; border-radius: 6px;
    font-size: 11px; font-family: var(--mono);
    margin-bottom: 5px; border-left: 3px solid var(--border);
    line-height: 1.5;
  }
  .log-info    { border-color: var(--accent);  background: color-mix(in srgb, var(--accent)  8%, transparent); }
  .log-success { border-color: var(--accent2); background: color-mix(in srgb, var(--accent2) 8%, transparent); }
  .log-warn    { border-color: var(--warn);    background: color-mix(in srgb, var(--warn)    8%, transparent); }
  .log-error   { border-color: var(--danger);  background: color-mix(in srgb, var(--danger)  8%, transparent); }
  .log-time    { color: var(--muted); font-size: 10px; }

  /* ── EMPTY / LOADING ── */
  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 60px 20px; gap: 12px;
    color: var(--muted); text-align: center;
  }
  .empty-icon { font-size: 40px; opacity: .4; }
  .empty-label { font-size: 14px; font-weight: 600; }
  .empty-sub   { font-size: 12px; opacity: .6; }

  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; backdrop-filter: blur(4px);
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 32px; max-width: 440px; width: 90%;
    animation: slideIn .25s ease;
  }
  .modal-title  { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
  .modal-sub    { font-size: 14px; color: var(--muted); margin-bottom: 24px; line-height: 1.6; }
  .modal-footer { display: flex; gap: 12px; justify-content: flex-end; }

  .tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .tag {
    font-size: 11px; font-family: var(--mono); padding: 3px 9px;
    border-radius: 20px; background: var(--surface2); color: var(--muted);
    border: 1px solid var(--border);
  }

  .progress-bar {
    height: 3px; background: var(--border); border-radius: 2px;
    overflow: hidden; margin-top: 8px;
  }
  .progress-fill {
    height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2));
    transition: width .6s cubic-bezier(.4,0,.2,1);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS DEFINITIONS (sidebar catalog)
// ─────────────────────────────────────────────────────────────────────────────

const PROCESS_DEFS = [
  { key: "customer-onboarding-v2", name: "Customer Onboarding", steps: ["step-onboarding", "step-kyc", "step-approval"] },
  { key: "loan-application-v1",    name: "Loan Application",    steps: ["step-onboarding", "step-approval"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useWorkflowEngine() {
  const [processInstance, setProcessInstance] = useState(null);
  const [currentStepMeta, setCurrentStepMeta] = useState(null);
  const [formSchema, setFormSchema] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState("");
  const [log, setLog] = useState([]);
  const [camundaVars, setCamundaVars] = useState({});
  const [wlcData, setWlcData] = useState({});
  const [status, setStatus] = useState("idle"); // idle | running | complete

  const addLog = useCallback((msg, type = "info") => {
    setLog((l) => [...l, { msg, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  const startProcess = useCallback(async (processDef) => {
    setLoading("Starting process…");
    addLog(`Starting Camunda process: ${processDef.key}`, "info");
    try {
      const pi = await CamundaAPI.startProcess(processDef.key, {});
      setProcessInstance({ ...pi, def: processDef });
      setStepIndex(0);
      setCamundaVars({});
      setWlcData({});
      setStatus("running");
      addLog(`Process instance created: ${pi.processInstanceKey}`, "success");

      // Load first task
      setLoading("Fetching first task…");
      const firstStepId = processDef.steps[0];
      addLog(`WLC → fetching form schema for step: ${firstStepId}`, "info");
      const schema = await WLC_API.getFormSchema(firstStepId);
      setFormSchema(schema);
      setCurrentStepMeta({ taskId: `task-init`, taskDefinitionId: firstStepId });
      addLog(`Form schema loaded: "${schema.title}"`, "success");
    } catch (e) {
      addLog(`Error: ${e.message}`, "error");
    } finally {
      setLoading("");
    }
  }, [addLog]);

  const submitStep = useCallback(async (formData) => {
    if (!processInstance || !currentStepMeta || !formSchema) return;

    // Split data
    const camunda = {}, wlc = {};
    formSchema.schema.forEach((f) => {
      if (formData[f.id] !== undefined) {
        if (f.camundaVar) camunda[f.id] = formData[f.id];
        else wlc[f.id] = formData[f.id];
      }
    });

    setLoading("Submitting…");
    addLog(`Submitting task: ${currentStepMeta.taskId}`, "info");

    try {
      // 1. Send camunda vars to Camunda
      if (Object.keys(camunda).length > 0) {
        addLog(`→ Camunda: ${Object.keys(camunda).join(", ")}`, "info");
        await CamundaAPI.completeTask(currentStepMeta.taskId, camunda);
        setCamundaVars((v) => ({ ...v, ...camunda }));
        addLog("Camunda task completed ✓", "success");
      }

      // 2. Save business data to WLC
      if (Object.keys(wlc).length > 0) {
        addLog(`→ WLC store: ${Object.keys(wlc).join(", ")}`, "info");
        await WLC_API.saveBusinessData(formSchema.stepId, wlc);
        setWlcData((d) => ({ ...d, ...wlc }));
        addLog("Business data saved to WLC ✓", "success");
      }

      // 3. Ask Camunda for next task
      const nextStepIdx = stepIndex + 1;
      const processDef = processInstance.def;

      if (nextStepIdx >= processDef.steps.length) {
        setStatus("complete");
        setFormSchema(null);
        addLog("🎉 Process complete!", "success");
        setLoading("");
        return;
      }

      setLoading("Querying next task…");
      addLog("Querying Camunda for next user task…", "info");
      const nextTask = await CamundaAPI.getNextUserTask(processInstance.processInstanceKey);
      addLog(`Next task received: ${nextTask.taskDefinitionId}`, "info");

      // 4. Fetch schema from WLC
      const nextStepId = processDef.steps[nextStepIdx];
      addLog(`WLC → fetching schema for: ${nextStepId}`, "info");
      const nextSchema = await WLC_API.getFormSchema(nextStepId);
      setFormSchema(nextSchema);
      setCurrentStepMeta(nextTask);
      setStepIndex(nextStepIdx);
      addLog(`Form loaded: "${nextSchema.title}"`, "success");

    } catch (e) {
      addLog(`Error: ${e.message}`, "error");
    } finally {
      setLoading("");
    }
  }, [processInstance, currentStepMeta, formSchema, stepIndex, addLog]);

  const reset = useCallback(() => {
    setProcessInstance(null);
    setFormSchema(null);
    setCurrentStepMeta(null);
    setStepIndex(0);
    setCamundaVars({});
    setWlcData({});
    setStatus("idle");
    setLog([]);
  }, []);

  return {
    processInstance, formSchema, stepIndex,
    loading, log, camundaVars, wlcData, status,
    startProcess, submitStep, reset,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC FORM
// ─────────────────────────────────────────────────────────────────────────────

function DynamicForm({ schema, onSubmit, loading }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const init = {};
    schema.schema.forEach((f) => { init[f.id] = ""; });
    setValues(init);
    setErrors({});
  }, [schema]);

  const set = (id, val) => {
    setValues((v) => ({ ...v, [id]: val }));
    if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
  };

  const validate = () => {
    const e = {};
    schema.schema.forEach((f) => {
      if (f.required && !String(values[f.id] || "").trim()) e[f.id] = "Required";
    });
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSubmit(values);
  };

  const renderField = (f) => {
    const cls = errors[f.id] ? " error" : "";
    const common = { id: f.id, value: values[f.id] || "", onChange: (ev) => set(f.id, ev.target.value) };

    let input;
    if (f.type === "select") {
      input = (
        <select className={`field-select${cls}`} {...common} style={{ color: values[f.id] ? undefined : "var(--muted)" }}>
          <option value="" disabled>Select…</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (f.type === "textarea") {
      input = <textarea className={`field-textarea${cls}`} {...common} rows={3} />;
    } else {
      input = <input className={`field-input${cls}`} type={f.type} {...common} />;
    }

    return (
      <div className="field-wrap" key={f.id}>
        <label className="field-label" htmlFor={f.id}>
          {f.label}
          {f.required && <span className="req"> *</span>}
          <span className={`field-badge ${f.camundaVar ? "badge-camunda" : "badge-wlc"}`}>
            {f.camundaVar ? "CAMUNDA" : "WLC"}
          </span>
        </label>
        {input}
        {errors[f.id] && <span className="field-error">⚠ {errors[f.id]}</span>}
      </div>
    );
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <div>
          <div className="form-title">{schema.title}</div>
          <div className="form-sub">{schema.subtitle} · {schema.stepId}</div>
        </div>
        <div className="tag-row">
          <span className="tag">{schema.schema.filter(f => f.camundaVar).length} camunda vars</span>
          <span className="tag">{schema.schema.filter(f => !f.camundaVar).length} wlc fields</span>
        </div>
      </div>
      <div className="form-body" style={{ gridTemplateColumns: schema.schema.length > 3 ? "1fr 1fr" : "1fr" }}>
        {schema.schema.map(renderField)}
      </div>
      <div className="form-footer">
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!!loading}>
          {loading ? <><span className="spinner" /> {loading}</> : "Submit & Continue →"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL
// ─────────────────────────────────────────────────────────────────────────────

function RightPanel({ camundaVars, wlcData, log, processInstance }) {
  const [tab, setTab] = useState("data");

  return (
    <div className="right-panel">
      <div className="panel-tabs">
        {["data", "log"].map((t) => (
          <button key={t} className={`panel-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "data" ? "Data Inspector" : `Audit Log (${log.length})`}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === "data" && (
          <>
            {processInstance && (
              <div className="data-section">
                <div className="data-section-head">Process Instance</div>
                {[
                  ["Key", processInstance.processInstanceKey],
                  ["Definition", processInstance.processDefinitionKey],
                  ["Status", processInstance.status],
                ].map(([k, v]) => (
                  <div className="kv-row" key={k}>
                    <span className="kv-key">{k}</span>
                    <span className="kv-value">{v}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="data-section">
              <div className="data-section-head">Camunda Variables</div>
              {Object.keys(camundaVars).length === 0
                ? <div style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>None yet</div>
                : Object.entries(camundaVars).map(([k, v]) => (
                    <div className="kv-row" key={k}>
                      <span className="kv-key">{k}</span>
                      <span className="kv-value">{String(v)}</span>
                    </div>
                  ))}
            </div>

            <div className="data-section">
              <div className="data-section-head">WLC Business Data</div>
              {Object.keys(wlcData).length === 0
                ? <div style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>None yet</div>
                : Object.entries(wlcData).map(([k, v]) => (
                    <div className="kv-row" key={k}>
                      <span className="kv-key">{k}</span>
                      <span className="kv-value">{String(v)}</span>
                    </div>
                  ))}
            </div>

            {(Object.keys(camundaVars).length > 0 || Object.keys(wlcData).length > 0) && (
              <div className="data-section">
                <div className="data-section-head">Raw Payload</div>
                <div className="json-box">
                  {JSON.stringify({ camundaVariables: camundaVars, wlcData }, null, 2)}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "log" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {log.length === 0
              ? <div style={{ color: "var(--muted)", fontSize: 12, padding: "20px 0" }}>No activity yet</div>
              : [...log].reverse().map((l, i) => (
                  <div className={`log-entry log-${l.type}`} key={i}>
                    <div className="log-time">{l.time}</div>
                    {l.msg}
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function CamundaFormEngine() {
  const engine = useWorkflowEngine();
  const [selectedDef, setSelectedDef] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSelectProcess = (def) => {
    if (engine.status === "running") { setShowConfirm(true); setSelectedDef(def); return; }
    setSelectedDef(def);
    engine.reset();
    engine.startProcess(def);
  };

  const handleConfirmSwitch = () => {
    setShowConfirm(false);
    engine.reset();
    engine.startProcess(selectedDef);
  };

  const steps = selectedDef?.steps ?? [];
  const progress = steps.length ? ((engine.stepIndex) / steps.length) * 100 : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="engine-root">
        {/* TOP BAR */}
        <header className="topbar">
          <span className="topbar-logo">WLC Engine</span>
          <div className="topbar-sep" />
          <span className="topbar-title">Camunda 8.7 · White-Label Form Runtime</span>
          {engine.processInstance && (
            <span className="topbar-badge">{engine.processInstance.processInstanceKey}</span>
          )}
          {engine.status === "running" && (
            <span className="topbar-badge" style={{ borderColor: "var(--accent2)", color: "var(--accent2)", background: "color-mix(in srgb, var(--accent2) 12%, transparent)" }}>
              ● RUNNING
            </span>
          )}
          {engine.status === "complete" && (
            <span className="topbar-badge" style={{ borderColor: "var(--warn)", color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 12%, transparent)" }}>
              ✓ COMPLETE
            </span>
          )}
        </header>

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Process Catalog</div>
            {PROCESS_DEFS.map((def) => (
              <div
                key={def.key}
                className={`process-card${engine.processInstance?.def.key === def.key ? " active" : ""}`}
                onClick={() => handleSelectProcess(def)}
              >
                <div className="process-card-name">
                  <span className={`status-dot ${engine.processInstance?.def.key === def.key && engine.status === "running" ? "status-active" : "status-idle"}`} />
                  {def.name}
                </div>
                <div className="process-card-key">{def.key}</div>
                <div className="tag-row" style={{ marginTop: 8 }}>
                  <span className="tag">{def.steps.length} steps</span>
                </div>
              </div>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Legend</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { color: "var(--accent)",  label: "CAMUNDA", desc: "Sent to Camunda process variables" },
                { color: "var(--accent2)", label: "WLC",     desc: "Stored in WLC business database" },
              ].map(({ color, label, desc }) => (
                <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {engine.status === "running" && (
            <div style={{ marginTop: "auto" }}>
              <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={engine.reset}>
                ↺ Reset
              </button>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main className="main">
          {/* Step tracker */}
          {steps.length > 0 && (
            <div className="form-card" style={{ padding: "16px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                  WORKFLOW PROGRESS
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                  {engine.status === "complete" ? steps.length : engine.stepIndex}/{steps.length} steps
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${engine.status === "complete" ? 100 : progress}%` }} />
              </div>
              <div className="step-tracker" style={{ marginTop: 16 }}>
                {steps.map((stepId, i) => {
                  const isDone = engine.status === "complete" || i < engine.stepIndex;
                  const isCurrent = engine.status !== "complete" && i === engine.stepIndex;
                  return (
                    <div key={stepId} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div className="step-node" style={{ flex: 1 }}>
                        <div className={`step-circle${isDone ? " done" : isCurrent ? " current" : ""}`}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        <div className={`step-label${isCurrent ? " current" : ""}`}>
                          {WLC_DB[stepId]?.title ?? stepId}
                        </div>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`step-line${isDone ? " done" : ""}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* States */}
          {engine.status === "idle" && (
            <div className="form-card">
              <div className="empty-state">
                <div className="empty-icon">⬡</div>
                <div className="empty-label">Select a process to begin</div>
                <div className="empty-sub">Choose a workflow from the catalog on the left</div>
              </div>
            </div>
          )}

          {engine.loading && !engine.formSchema && (
            <div className="form-card">
              <div className="empty-state">
                <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <div className="empty-label">{engine.loading}</div>
              </div>
            </div>
          )}

          {engine.formSchema && engine.status === "running" && (
            <DynamicForm
              schema={engine.formSchema}
              onSubmit={engine.submitStep}
              loading={engine.loading}
            />
          )}

          {engine.status === "complete" && (
            <div className="form-card">
              <div className="empty-state" style={{ gap: 16 }}>
                <div style={{ fontSize: 52 }}>🎉</div>
                <div className="empty-label" style={{ fontSize: 18, color: "var(--accent2)" }}>Process Complete</div>
                <div className="empty-sub">
                  All steps submitted. Camunda process instance <strong style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{engine.processInstance?.processInstanceKey}</strong> has been advanced to completion.
                </div>
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={engine.reset}>
                  Start New Instance
                </button>
              </div>
            </div>
          )}

          {/* Architecture note */}
          <div className="form-card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", lineHeight: 1.8 }}>
              <strong style={{ color: "var(--text)" }}>Data routing:</strong> Fields tagged{" "}
              <span style={{ color: "var(--accent)" }}>CAMUNDA</span> → POST /v1/tasks/:id/complete (Camunda 8.7 REST) ·{" "}
              Fields tagged <span style={{ color: "var(--accent2)" }}>WLC</span> → WLC Business API → your database ·{" "}
              Next step lookup → GET /v1/user-tasks?processInstanceKey=… → WLC schema store
            </div>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <RightPanel
          camundaVars={engine.camundaVars}
          wlcData={engine.wlcData}
          log={engine.log}
          processInstance={engine.processInstance}
        />
      </div>

      {/* Confirm switch modal */}
      {showConfirm && (
        <div className="overlay">
          <div className="modal">
            <div className="modal-title">Switch Process?</div>
            <div className="modal-sub">
              A process is currently running. Switching will reset all unsaved data and start a new instance of <strong>{selectedDef?.name}</strong>.
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmSwitch}>Switch & Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
