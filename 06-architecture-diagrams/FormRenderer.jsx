import { useState, useEffect } from "react";

// ── The exact JSON templates from the database ────────────────────────────────
const FORM_SCHEMAS = {
  "step-onboarding": {
    stepId: "step-onboarding",
    title: "Customer Onboarding",
    subtitle: "Step 1 of 3",
    schema: [
      { id: "firstName",  type: "text",   label: "First Name",        required: true,  camundaVar: false, placeholder: "Jane" },
      { id: "lastName",   type: "text",   label: "Last Name",         required: true,  camundaVar: false, placeholder: "Smith" },
      { id: "email",      type: "email",  label: "Email Address",     required: true,  camundaVar: false, placeholder: "jane@example.com" },
      { id: "tier",       type: "select", label: "Customer Tier",     required: true,  camundaVar: true,  options: ["Standard", "Premium", "Enterprise"] },
      { id: "startDate",  type: "date",   label: "Onboarding Date",   required: true,  camundaVar: true  },
    ],
  },
  "step-kyc": {
    stepId: "step-kyc",
    title: "KYC Verification",
    subtitle: "Step 2 of 3",
    schema: [
      { id: "docType",   type: "select",   label: "Document Type",    required: true,  camundaVar: true,  options: ["Passport", "Driver's License", "National ID"] },
      { id: "docNumber", type: "text",     label: "Document Number",  required: true,  camundaVar: false, placeholder: "AB1234567" },
      { id: "country",   type: "select",   label: "Issuing Country",  required: true,  camundaVar: true,  options: ["US", "UK", "DE", "FR", "SG", "AU"] },
      { id: "notes",     type: "textarea", label: "Additional Notes", required: false, camundaVar: false, placeholder: "Any relevant details..." },
    ],
  },
  "step-approval": {
    stepId: "step-approval",
    title: "Final Approval",
    subtitle: "Step 3 of 3",
    schema: [
      { id: "reviewerName", type: "text",     label: "Reviewer Name", required: true,  camundaVar: false, placeholder: "Full name" },
      { id: "decision",     type: "select",   label: "Decision",      required: true,  camundaVar: true,  options: ["Approve", "Reject", "Escalate"] },
      { id: "reason",       type: "textarea", label: "Reason / Comment", required: false, camundaVar: false, placeholder: "Provide justification..." },
    ],
  },
};

const STEPS = ["step-onboarding", "step-kyc", "step-approval"];

// ── Styles ────────────────────────────────────────────────────────────────────
const style = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink:       #1a1a2e;
    --paper:     #f5f0e8;
    --cream:     #ede8dc;
    --line:      #d4cfc4;
    --accent:    #c84b31;
    --camunda:   #2563eb;
    --wlc:       #16a34a;
    --muted:     #8a8578;
    --mono:      'Geist Mono', monospace;
    --serif:     'Instrument Serif', serif;
  }

  body {
    background: var(--paper);
    font-family: var(--mono);
    min-height: 100vh;
  }

  .shell {
    max-width: 760px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  /* ── header ── */
  .page-header {
    display: flex; align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 20px;
    margin-bottom: 36px;
  }
  .page-header-left { display: flex; flex-direction: column; gap: 4px; }
  .page-kicker {
    font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
    color: var(--muted); font-family: var(--mono);
  }
  .page-title {
    font-family: var(--serif); font-size: 32px; color: var(--ink);
    line-height: 1.1; font-style: italic;
  }

  /* ── step tabs ── */
  .step-tabs {
    display: flex; gap: 0;
    border: 1.5px solid var(--ink); border-radius: 0;
    overflow: hidden; margin-bottom: 32px;
  }
  .step-tab {
    flex: 1; padding: 10px 6px;
    background: transparent; border: none;
    cursor: pointer;
    font-family: var(--mono); font-size: 11px;
    color: var(--muted); letter-spacing: .06em;
    text-transform: uppercase;
    border-right: 1.5px solid var(--ink);
    transition: background 180ms, color 180ms;
    display: flex; flex-direction: column;
    align-items: center; gap: 4px;
  }
  .step-tab:last-child { border-right: none; }
  .step-tab .tab-num {
    font-size: 18px; font-family: var(--serif);
    font-style: italic; color: var(--ink);
  }
  .step-tab.active {
    background: var(--ink); color: var(--paper);
  }
  .step-tab.active .tab-num { color: var(--paper); }
  .step-tab.done {
    background: var(--cream);
  }
  .step-tab.done .tab-num { color: var(--muted); }

  /* ── form card ── */
  .form-card {
    border: 1.5px solid var(--ink);
    background: #fff;
    animation: rise .28s cubic-bezier(.4,0,.2,1);
  }
  @keyframes rise {
    from { opacity:0; transform: translateY(10px); }
    to   { opacity:1; transform: translateY(0); }
  }

  .form-head {
    padding: 24px 28px 20px;
    border-bottom: 1.5px solid var(--line);
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .form-head-left {}
  .form-title  { font-family: var(--serif); font-size: 26px; color: var(--ink); font-style: italic; }
  .form-sub    { font-size: 11px; color: var(--muted); margin-top: 4px; letter-spacing: .06em; }
  .form-stats  { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
  .stat-pill {
    font-size: 10px; letter-spacing: .08em; padding: 3px 10px;
    border: 1px solid; display: flex; align-items: center; gap: 5px;
  }
  .stat-pill.camunda { border-color: var(--camunda); color: var(--camunda); }
  .stat-pill.wlc     { border-color: var(--wlc);     color: var(--wlc); }
  .stat-dot { width:6px; height:6px; border-radius:50%; }
  .stat-dot.camunda { background: var(--camunda); }
  .stat-dot.wlc     { background: var(--wlc); }

  /* ── fields grid ── */
  .form-body {
    padding: 28px;
    display: grid;
    gap: 0;
  }

  .field-row {
    display: grid;
    border-bottom: 1px solid var(--line);
  }
  .field-row:last-child { border-bottom: none; }

  .field-inner {
    display: grid;
    grid-template-columns: 220px 1fr;
    min-height: 58px;
  }

  .field-label-col {
    padding: 16px 20px 16px 0;
    border-right: 1px solid var(--line);
    display: flex; flex-direction: column;
    justify-content: center; gap: 5px;
  }
  .field-label {
    font-size: 12px; font-weight: 500; color: var(--ink);
    letter-spacing: .03em; display: flex; align-items: center; gap: 6px;
  }
  .req { color: var(--accent); font-size: 14px; }

  .route-tag {
    font-size: 9px; letter-spacing: .1em; text-transform: uppercase;
    padding: 2px 7px; display: inline-flex; align-items: center; gap: 4px;
    border: 1px solid; width: fit-content;
  }
  .route-tag.camunda { border-color: var(--camunda); color: var(--camunda); background: #eff6ff; }
  .route-tag.wlc     { border-color: var(--wlc);     color: var(--wlc);     background: #f0fdf4; }
  .route-dot { width:5px; height:5px; border-radius:50%; }
  .route-dot.camunda { background: var(--camunda); }
  .route-dot.wlc     { background: var(--wlc); }

  .field-input-col {
    padding: 0 0 0 20px;
    display: flex; align-items: center;
  }

  .field-input, .field-select, .field-textarea {
    width: 100%; background: transparent;
    border: none; outline: none;
    font-family: var(--mono); font-size: 13px; color: var(--ink);
    padding: 16px 0;
  }
  .field-input::placeholder, .field-textarea::placeholder { color: var(--line); }
  .field-textarea { resize: none; padding-top: 18px; align-self: stretch; }
  .field-select { cursor: pointer; appearance: none; background: transparent; }
  .field-select option { background: #fff; }

  .field-row.has-error .field-label-col { border-right-color: var(--accent); }
  .field-row.has-error .field-input-col { border-bottom: 2px solid var(--accent); }
  .field-row.has-error .field-input,
  .field-row.has-error .field-select,
  .field-row.has-error .field-textarea { color: var(--accent); }

  .error-msg {
    font-size: 10px; color: var(--accent);
    padding: 4px 0 8px 220px;
    letter-spacing: .04em;
  }

  /* focused row highlight */
  .field-row:focus-within {
    background: #fafaf8;
  }
  .field-row:focus-within .field-label-col {
    border-right-color: var(--ink);
  }

  /* ── footer ── */
  .form-footer {
    padding: 20px 28px;
    border-top: 1.5px solid var(--line);
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-hint { font-size: 11px; color: var(--muted); }

  .btn-submit {
    background: var(--ink); color: var(--paper);
    border: none; cursor: pointer;
    font-family: var(--mono); font-size: 12px;
    letter-spacing: .08em; text-transform: uppercase;
    padding: 12px 28px;
    display: flex; align-items: center; gap: 10px;
    transition: background 150ms;
  }
  .btn-submit:hover:not(:disabled) { background: #2d2d4a; }
  .btn-submit:disabled { opacity: .4; cursor: not-allowed; }
  .arrow { font-size: 16px; transition: transform 150ms; }
  .btn-submit:hover:not(:disabled) .arrow { transform: translateX(4px); }

  /* ── payload preview ── */
  .payload-panel {
    margin-top: 24px;
    border: 1.5px solid var(--line);
    background: #fafaf8;
    animation: rise .3s ease;
  }
  .payload-header {
    padding: 12px 20px;
    border-bottom: 1px solid var(--line);
    font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--muted); display: flex; justify-content: space-between;
  }
  .payload-cols { display: grid; grid-template-columns: 1fr 1fr; }
  .payload-col {
    padding: 16px 20px;
  }
  .payload-col:first-child { border-right: 1px solid var(--line); }
  .payload-col-head {
    font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
    margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
  }
  .payload-col-head.camunda { color: var(--camunda); }
  .payload-col-head.wlc     { color: var(--wlc); }
  pre {
    font-family: var(--mono); font-size: 11px;
    color: var(--ink); white-space: pre-wrap; line-height: 1.7;
  }
  .key-color { color: var(--muted); }

  /* ── success ── */
  .success-card {
    border: 1.5px solid var(--ink); background: #fff;
    padding: 48px 40px; text-align: center;
    animation: rise .3s ease;
  }
  .success-mark {
    font-family: var(--serif); font-size: 64px;
    color: var(--ink); font-style: italic; margin-bottom: 12px;
  }
  .success-title {
    font-family: var(--serif); font-size: 28px;
    color: var(--ink); font-style: italic; margin-bottom: 8px;
  }
  .success-sub { font-size: 12px; color: var(--muted); }
  .btn-restart {
    margin-top: 28px;
    background: transparent; border: 1.5px solid var(--ink);
    font-family: var(--mono); font-size: 11px; letter-spacing: .08em;
    text-transform: uppercase; padding: 10px 24px; cursor: pointer;
    color: var(--ink); transition: background 150ms, color 150ms;
  }
  .btn-restart:hover { background: var(--ink); color: var(--paper); }
`;

// ── Field renderer ────────────────────────────────────────────────────────────
function Field({ f, value, onChange, error }) {
  const routeClass = f.camundaVar ? "camunda" : "wlc";
  const routeLabel = f.camundaVar ? "Camunda var" : "WLC store";

  let input;
  const commonProps = {
    id: f.id,
    value: value || "",
    onChange: (e) => onChange(f.id, e.target.value),
    placeholder: f.placeholder || "",
  };

  if (f.type === "select") {
    input = (
      <select className="field-select" {...commonProps}>
        <option value="" disabled>Select…</option>
        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (f.type === "textarea") {
    input = <textarea className="field-textarea" rows={3} {...commonProps} />;
  } else {
    input = <input className="field-input" type={f.type} {...commonProps} />;
  }

  return (
    <div className={`field-row${error ? " has-error" : ""}`}>
      <div className="field-inner">
        <div className="field-label-col">
          <div className="field-label">
            {f.label}
            {f.required && <span className="req">*</span>}
          </div>
          <span className={`route-tag ${routeClass}`}>
            <span className={`route-dot ${routeClass}`} />
            {routeLabel}
          </span>
        </div>
        <div className="field-input-col">
          {input}
        </div>
      </div>
      {error && <div className="error-msg">↑ {error}</div>}
    </div>
  );
}

// ── Payload preview ───────────────────────────────────────────────────────────
function PayloadPreview({ schema, values }) {
  const camunda = {}, wlc = {};
  schema.schema.forEach((f) => {
    if (values[f.id]) {
      if (f.camundaVar) camunda[f.id] = values[f.id];
      else              wlc[f.id]     = values[f.id];
    }
  });

  const fmt = (obj) => {
    if (!Object.keys(obj).length) return '{ }';
    return "{\n" + Object.entries(obj).map(([k,v]) =>
      `  "${k}": "${v}"`
    ).join(",\n") + "\n}";
  };

  return (
    <div className="payload-panel">
      <div className="payload-header">
        <span>Live payload split</span>
        <span>{Object.keys(camunda).length} camunda · {Object.keys(wlc).length} wlc</span>
      </div>
      <div className="payload-cols">
        <div className="payload-col">
          <div className="payload-col-head camunda">
            <span className="route-dot camunda" style={{width:7,height:7}}/>
            → Camunda REST API
          </div>
          <pre>{fmt(camunda)}</pre>
        </div>
        <div className="payload-col">
          <div className="payload-col-head wlc">
            <span className="route-dot wlc" style={{width:7,height:7}}/>
            → WLC Database
          </div>
          <pre>{fmt(wlc)}</pre>
        </div>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function FormRenderer() {
  const [stepIndex, setStepIndex]       = useState(0);
  const [completed, setCompleted]       = useState([]);
  const [values, setValues]             = useState({});
  const [errors, setErrors]             = useState({});
  const [done, setDone]                 = useState(false);
  const [showPayload, setShowPayload]   = useState(true);

  const stepId = STEPS[stepIndex];
  const schema = FORM_SCHEMAS[stepId];

  // Reset values when step changes
  useEffect(() => {
    const init = {};
    schema.schema.forEach((f) => { init[f.id] = ""; });
    setValues(init);
    setErrors({});
  }, [stepIndex]);

  const set = (id, val) => {
    setValues((v) => ({ ...v, [id]: val }));
    setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
  };

  const handleSubmit = () => {
    const e = {};
    schema.schema.forEach((f) => {
      if (f.required && !String(values[f.id] || "").trim()) e[f.id] = "This field is required";
    });
    if (Object.keys(e).length) { setErrors(e); return; }

    setCompleted((c) => [...c, stepId]);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      setDone(true);
    }
  };

  const restart = () => {
    setStepIndex(0); setCompleted([]); setValues({}); setErrors({}); setDone(false);
  };

  const camundaCount = schema.schema.filter(f => f.camundaVar).length;
  const wlcCount     = schema.schema.filter(f => !f.camundaVar).length;

  return (
    <>
      <style>{style}</style>
      <div className="shell">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <span className="page-kicker">WLC · Dynamic Form Renderer</span>
            <h1 className="page-title">JSON → UI</h1>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:8 }}>
            <label style={{ fontSize:11, color:"var(--muted)", display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
              <input type="checkbox" checked={showPayload} onChange={e => setShowPayload(e.target.checked)} />
              Show payload split
            </label>
          </div>
        </div>

        {/* Step tabs */}
        <div className="step-tabs">
          {STEPS.map((sid, i) => (
            <button
              key={sid}
              className={`step-tab${i === stepIndex && !done ? " active" : ""}${completed.includes(sid) ? " done" : ""}`}
              onClick={() => { if (completed.includes(sid)) { setStepIndex(i); setCompleted(c => c.filter((_,j)=>j<i)); setDone(false); } }}
            >
              <span className="tab-num">{completed.includes(sid) ? "✓" : i + 1}</span>
              <span>{FORM_SCHEMAS[sid].title}</span>
            </button>
          ))}
        </div>

        {done ? (
          <div className="success-card">
            <div className="success-mark">✓</div>
            <div className="success-title">Process Complete</div>
            <div className="success-sub">All 3 steps submitted. Camunda variables routed · WLC data stored.</div>
            <button className="btn-restart" onClick={restart}>Start Again</button>
          </div>
        ) : (
          <>
            {/* Form card — rendered entirely from JSON */}
            <div className="form-card">
              <div className="form-head">
                <div className="form-head-left">
                  <div className="form-title">{schema.title}</div>
                  <div className="form-sub">{schema.subtitle} · stepId: {schema.stepId}</div>
                </div>
                <div className="form-stats">
                  <div className="stat-pill camunda">
                    <span className="stat-dot camunda" />
                    {camundaCount} Camunda var{camundaCount !== 1 ? "s" : ""}
                  </div>
                  <div className="stat-pill wlc">
                    <span className="stat-dot wlc" />
                    {wlcCount} WLC field{wlcCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="form-body">
                {schema.schema.map((f) => (
                  <Field
                    key={f.id}
                    f={f}
                    value={values[f.id]}
                    onChange={set}
                    error={errors[f.id]}
                  />
                ))}
              </div>

              <div className="form-footer">
                <span className="footer-hint">
                  * Required · Fields route automatically on submit
                </span>
                <button className="btn-submit" onClick={handleSubmit}>
                  {stepIndex < STEPS.length - 1 ? "Next step" : "Submit"}
                  <span className="arrow">→</span>
                </button>
              </div>
            </div>

            {/* Live payload split */}
            {showPayload && <PayloadPreview schema={schema} values={values} />}
          </>
        )}
      </div>
    </>
  );
}
