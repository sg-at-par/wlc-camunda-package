import { useState, useEffect } from "react";

// ── Form schemas (mirrors what the WLC DB returns) ────────────────────────────
const SCHEMAS = {
  "step-l1-analysis": {
    stepId: "step-l1-analysis",
    title: "L1 Alert Analysis",
    subtitle: "Level 1  ·  Initial Triage",
    availableActions: ["ESCALATE", "CLOSE"],
    schema: [
      { id: "alertId",         type: "text",     label: "Alert ID",                  required: true,  camundaVar: false, placeholder: "ALT-2026-XXXXX" },
      { id: "alertSource",     type: "select",   label: "Alert Source",              required: true,  camundaVar: true,  options: ["SIEM","EDR","IDS/IPS","Cloud Watch","Manual Report"] },
      { id: "severity",        type: "select",   label: "Severity",                  required: true,  camundaVar: true,  options: ["Critical","High","Medium","Low"] },
      { id: "affectedAsset",   type: "text",     label: "Affected Asset / Host",     required: true,  camundaVar: false, placeholder: "hostname or IP address" },
      { id: "initialFindings", type: "textarea", label: "Initial Findings",          required: true,  camundaVar: false, placeholder: "Describe what triggered this alert..." },
      { id: "isFalsePositive", type: "select",   label: "False Positive Assessment", required: true,  camundaVar: true,  options: ["Confirmed Threat","Likely Threat","Uncertain","Likely False Positive","Confirmed False Positive"] },
      { id: "analystName",     type: "text",     label: "L1 Analyst Name",           required: true,  camundaVar: false, placeholder: "Your full name" },
      { id: "action",          type: "select",   label: "Action",                    required: true,  camundaVar: true,  options: ["ESCALATE","CLOSE"], note: "ESCALATE → L2  |  CLOSE → End investigation" },
      { id: "actionNotes",     type: "textarea", label: "Action Justification",      required: true,  camundaVar: false, placeholder: "Justify your decision..." },
    ],
  },

  "step-l2-analysis": {
    stepId: "step-l2-analysis",
    title: "L2 Alert Analysis",
    subtitle: "Level 2  ·  Deep Dive Investigation",
    availableActions: ["ESCALATE", "CLOSE", "SEND_BACK"],
    schema: [
      { id: "alertId",          type: "text",     label: "Alert ID",                       required: true,  camundaVar: false, placeholder: "ALT-2026-XXXXX" },
      { id: "l1SummaryReview",  type: "textarea", label: "L1 Summary Review",              required: true,  camundaVar: false, placeholder: "Summarise L1 findings..." },
      { id: "attackVector",     type: "select",   label: "Attack Vector (MITRE ATT&CK)",   required: true,  camundaVar: true,  options: ["Initial Access","Execution","Persistence","Privilege Escalation","Defense Evasion","Credential Access","Discovery","Lateral Movement","Collection","Exfiltration","Impact","N/A"] },
      { id: "iocList",          type: "textarea", label: "Indicators of Compromise",       required: false, camundaVar: false, placeholder: "IPs, hashes, domains, file paths..." },
      { id: "affectedSystems",  type: "textarea", label: "Affected Systems / Blast Radius",required: true,  camundaVar: false, placeholder: "All impacted hosts, accounts, services..." },
      { id: "containmentTaken", type: "select",   label: "Containment Action Taken",       required: true,  camundaVar: true,  options: ["None","Host Isolated","Account Disabled","Network Segment Blocked","Process Killed","Multiple Actions"] },
      { id: "riskScore",        type: "select",   label: "Risk Score",                     required: true,  camundaVar: true,  options: ["1 - Minimal","2 - Low","3 - Moderate","4 - High","5 - Critical"] },
      { id: "analystName",      type: "text",     label: "L2 Analyst Name",                required: true,  camundaVar: false, placeholder: "Your full name" },
      { id: "action",           type: "select",   label: "Action",                         required: true,  camundaVar: true,  options: ["ESCALATE","CLOSE","SEND_BACK"], note: "ESCALATE → QA  |  CLOSE → End  |  SEND_BACK → L1" },
      { id: "actionNotes",      type: "textarea", label: "Action Justification",           required: true,  camundaVar: false, placeholder: "Justify your decision..." },
      { id: "sendBackRequest",  type: "textarea", label: "Send-Back Request Details",      required: false, camundaVar: false, placeholder: "What additional info is needed from L1?", showWhen: { field: "action", value: "SEND_BACK" } },
    ],
  },

  "step-qa-analysis": {
    stepId: "step-qa-analysis",
    title: "QA Analysis",
    subtitle: "Level 3  ·  Quality Assurance & Final Decision",
    availableActions: ["CLOSE", "SEND_BACK"],
    schema: [
      { id: "alertId",              type: "text",     label: "Alert ID",                      required: true,  camundaVar: false, placeholder: "ALT-2026-XXXXX" },
      { id: "investigationQuality", type: "select",   label: "Overall Investigation Quality", required: true,  camundaVar: true,  options: ["Excellent","Acceptable","Needs Improvement","Inadequate"] },
      { id: "l1ReviewNotes",        type: "textarea", label: "L1 Work Review",                required: true,  camundaVar: false, placeholder: "Assess quality and completeness of L1 analysis..." },
      { id: "l2ReviewNotes",        type: "textarea", label: "L2 Work Review",                required: true,  camundaVar: false, placeholder: "Assess quality and completeness of L2 analysis..." },
      { id: "finalClassification",  type: "select",   label: "Final Threat Classification",   required: true,  camundaVar: true,  options: ["True Positive — Critical Incident","True Positive — Standard Incident","True Positive — Low Priority","False Positive — Tuning Required","False Positive — Acceptable Noise"] },
      { id: "lessonsLearned",       type: "textarea", label: "Lessons Learned",               required: false, camundaVar: false, placeholder: "Process improvements or detection rule changes..." },
      { id: "complianceFlag",       type: "select",   label: "Compliance / Regulatory Flag",  required: true,  camundaVar: true,  options: ["None","GDPR Notifiable","PCI-DSS","HIPAA","SOX","Multiple"], note: "Triggers compliance notification if not None" },
      { id: "analystName",          type: "text",     label: "QA Analyst Name",               required: true,  camundaVar: false, placeholder: "Your full name" },
      { id: "action",               type: "select",   label: "Final Action",                  required: true,  camundaVar: true,  options: ["CLOSE","SEND_BACK"], note: "CLOSE → Complete  |  SEND_BACK → L2 rework" },
      { id: "actionNotes",          type: "textarea", label: "QA Decision Notes",             required: true,  camundaVar: false, placeholder: "Document the final decision and follow-up actions..." },
      { id: "sendBackRequest",      type: "textarea", label: "Send-Back Instructions for L2", required: false, camundaVar: false, placeholder: "What rework is required from L2?", showWhen: { field: "action", value: "SEND_BACK" } },
    ],
  },
};

// ── Action routing: given current step + action, returns next step ────────────
function resolveNextStep(stepId, action) {
  if (action === "ESCALATE") {
    return stepId === "step-l1-analysis" ? "step-l2-analysis" : "step-qa-analysis";
  }
  if (action === "SEND_BACK") {
    return stepId === "step-l2-analysis" ? "step-l1-analysis" : "step-l2-analysis";
  }
  return null; // CLOSE → done
}

const ACTION_META = {
  ESCALATE:  { color: "#3b82f6", bg: "#1e3a5f", border: "#2563eb", icon: "↑", label: "Escalate" },
  CLOSE:     { color: "#22c55e", bg: "#14532d", border: "#16a34a", icon: "✓", label: "Close"    },
  SEND_BACK: { color: "#f59e0b", bg: "#451a03", border: "#d97706", icon: "↩", label: "Send Back" },
};

const SEVERITY_COLORS = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e" };

// ── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:       #050a0f;
    --s1:       #0a1628;
    --s2:       #0f1f38;
    --border:   #1e3a5f;
    --border2:  #1a2f4a;
    --text:     #e2e8f0;
    --muted:    #64748b;
    --mono:     'JetBrains Mono', monospace;
    --sans:     'Outfit', sans-serif;
  }
  body { background: var(--bg); font-family: var(--sans); min-height: 100vh; color: var(--text); }

  /* ── shell ── */
  .shell {
    display: grid;
    grid-template-columns: 260px 1fr 280px;
    min-height: 100vh;
  }

  /* ── left sidebar ── */
  .sidebar {
    background: var(--s1);
    border-right: 1px solid var(--border);
    padding: 24px 16px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .sidebar-title {
    font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--muted); font-family: var(--mono);
    padding: 0 8px; margin-bottom: 8px;
  }
  .step-item {
    border-radius: 8px; padding: 12px 14px;
    border: 1px solid transparent;
    transition: all 180ms;
  }
  .step-item.active   { background: #0f2548; border-color: #2563eb; }
  .step-item.done     { background: #0a1f10; border-color: #16a34a; }
  .step-item.sendback { background: #1a1000; border-color: #d97706; }
  .step-item.pending  { opacity: .4; }
  .step-num   { font-size: 9px; color: var(--muted); font-family: var(--mono); margin-bottom: 4px; }
  .step-name  { font-size: 13px; font-weight: 600; }
  .step-badge {
    font-size: 9px; font-family: var(--mono); padding: 2px 7px;
    border-radius: 10px; margin-top: 5px; display: inline-block;
    border: 1px solid;
  }

  /* ── main form area ── */
  .main { overflow-y: auto; padding: 28px 32px; background: var(--bg); }

  /* ── breadcrumb / header ── */
  .form-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 24px;
  }
  .form-title  { font-size: 22px; font-weight: 700; }
  .form-sub    { font-size: 12px; color: var(--muted); font-family: var(--mono); margin-top: 4px; }
  .action-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .action-pill {
    font-size: 10px; padding: 4px 10px; border-radius: 20px;
    font-family: var(--mono); border: 1px solid; font-weight: 500;
    display: flex; align-items: center; gap: 5px;
  }

  /* ── fields ── */
  .fields { display: flex; flex-direction: column; gap: 0; }
  .field-row {
    display: grid; grid-template-columns: 220px 1fr;
    border-bottom: 1px solid var(--border2);
    min-height: 56px; transition: background 150ms;
  }
  .field-row:last-child { border-bottom: none; }
  .field-row:focus-within { background: #0a1628; }
  .field-row.hidden { display: none; }
  .field-row.revealed { animation: reveal .25s ease; }
  @keyframes reveal { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform: translateY(0); } }

  .label-col {
    padding: 14px 16px 14px 0;
    border-right: 1px solid var(--border2);
    display: flex; flex-direction: column; justify-content: center; gap: 5px;
  }
  .field-label {
    font-size: 12px; font-weight: 500; color: var(--text);
    display: flex; align-items: center; gap: 6px;
  }
  .req { color: #ef4444; }
  .route-badge {
    font-size: 9px; padding: 2px 6px; border-radius: 3px;
    font-family: var(--mono); border: 1px solid; letter-spacing: .04em;
  }
  .rb-camunda { color: #60a5fa; border-color: #1e40af; background: #0f1f3a; }
  .rb-wlc     { color: #4ade80; border-color: #14532d; background: #0a1f10; }
  .field-note { font-size: 10px; color: var(--muted); font-family: var(--mono); line-height: 1.4; }

  .input-col { padding: 0 0 0 16px; display: flex; align-items: center; }
  .f-input, .f-select, .f-textarea {
    background: transparent; border: none; outline: none;
    font-family: var(--sans); font-size: 13px; color: var(--text);
    width: 100%; padding: 14px 0;
  }
  .f-textarea { resize: none; padding-top: 16px; align-self: stretch; }
  .f-select   { cursor: pointer; appearance: none; }
  .f-select option { background: #0a1628; }
  .field-row.has-error .label-col { border-right-color: #ef4444; }
  .field-row.has-error .f-input,
  .field-row.has-error .f-select,
  .field-row.has-error .f-textarea { color: #ef4444; }
  .error-msg { font-size: 10px; color: #ef4444; font-family: var(--mono); padding: 3px 0 6px 220px; }

  /* ── action bar ── */
  .action-bar {
    margin-top: 24px;
    border: 1px solid var(--border);
    background: var(--s1);
    border-radius: 8px;
    overflow: hidden;
  }
  .action-bar-head {
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
    font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--muted); font-family: var(--mono);
  }
  .action-bar-body { padding: 16px 18px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .btn-action {
    padding: 10px 20px; border-radius: 6px;
    font-family: var(--sans); font-size: 13px; font-weight: 600;
    cursor: pointer; border: 1px solid; transition: all 150ms;
    display: flex; align-items: center; gap: 8px;
  }
  .btn-action:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }
  .btn-action:disabled { opacity: .35; cursor: not-allowed; }
  .btn-hint { font-size: 11px; color: var(--muted); font-family: var(--mono); }

  /* ── form card wrapper ── */
  .form-card {
    background: var(--s1);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    animation: slideUp .28s ease;
  }
  @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .form-card-head {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--s2);
  }

  /* ── right panel ── */
  .right-panel {
    background: var(--s1);
    border-left: 1px solid var(--border);
    overflow-y: auto; padding: 20px 16px;
    display: flex; flex-direction: column; gap: 20px;
  }
  .panel-section-title {
    font-size: 9px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--muted); font-family: var(--mono);
    margin-bottom: 10px;
    display: flex; align-items: center; gap: 8px;
  }
  .panel-section-title::after { content:''; flex:1; height:1px; background: var(--border2); }

  /* routing table */
  .route-table { display: flex; flex-direction: column; gap: 4px; }
  .route-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 10px; border-radius: 5px; background: var(--s2);
  }
  .route-key   { font-size: 10px; color: var(--muted); font-family: var(--mono); }
  .route-value { font-size: 11px; color: var(--text); word-break: break-all; text-align: right; max-width: 130px; }

  /* flow history */
  .history-entry {
    padding: 9px 12px; border-radius: 6px;
    border-left: 3px solid;
    background: var(--s2); margin-bottom: 5px;
    font-size: 11px; line-height: 1.5;
  }
  .history-entry .h-step  { font-weight: 600; font-family: var(--sans); }
  .history-entry .h-action { font-family: var(--mono); font-size: 10px; }
  .history-entry .h-time  { font-size: 9px; color: var(--muted); margin-top: 2px; }

  /* ── complete screen ── */
  .complete-screen {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 60vh; gap: 16px; text-align: center;
    animation: slideUp .3s ease;
  }
  .complete-icon { font-size: 56px; }
  .complete-title { font-size: 24px; font-weight: 700; }
  .complete-sub { font-size: 13px; color: var(--muted); max-width: 360px; line-height: 1.6; }
  .btn-restart {
    margin-top: 12px; padding: 10px 24px;
    background: transparent; border: 1px solid var(--border);
    color: var(--text); font-family: var(--sans); font-size: 13px;
    font-weight: 600; cursor: pointer; border-radius: 6px;
    transition: all 150ms;
  }
  .btn-restart:hover { background: var(--s2); border-color: #2563eb; }

  /* severity badge */
  .sev-badge {
    display: inline-block; font-size: 10px; font-family: var(--mono);
    padding: 2px 8px; border-radius: 3px; border: 1px solid; margin-left: 8px;
  }
`;

// ── History entry builder ─────────────────────────────────────────────────────
function makeHistoryEntry(stepId, action, values) {
  const schema = SCHEMAS[stepId];
  return {
    stepId,
    stepTitle: schema.title,
    action,
    analystName: values.analystName || "—",
    time: new Date().toLocaleTimeString(),
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AlertInvestigation() {
  const [currentStep, setCurrentStep]   = useState("step-l1-analysis");
  const [values, setValues]             = useState({});
  const [errors, setErrors]             = useState({});
  const [history, setHistory]           = useState([]);
  const [camundaVars, setCamundaVars]   = useState({});
  const [wlcData, setWlcData]           = useState({});
  const [done, setDone]                 = useState(false);
  const [doneAction, setDoneAction]     = useState(null);
  // Track which steps have been visited (for sidebar state)
  const [visitedSteps, setVisitedSteps] = useState({ "step-l1-analysis": "active" });

  const schema = SCHEMAS[currentStep];

  // Reset field values when step changes
  useEffect(() => {
    const init = {};
    schema.schema.forEach(f => { init[f.id] = ""; });
    setValues(init);
    setErrors({});
  }, [currentStep]);

  const set = (id, val) => {
    setValues(v => ({ ...v, [id]: val }));
    setErrors(e => { const n = { ...e }; delete n[id]; return n; });
  };

  const validate = () => {
    const e = {};
    schema.schema.forEach(f => {
      if (!f.showWhen && f.required && !String(values[f.id] || "").trim()) {
        e[f.id] = "Required";
      }
      // Also validate showWhen fields if they're visible and required
      if (f.showWhen && f.required) {
        const triggerVal = values[f.showWhen.field];
        if (triggerVal === f.showWhen.value && !String(values[f.id] || "").trim()) {
          e[f.id] = "Required";
        }
      }
    });
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const action = values.action;

    // Split payload
    const cv = {}, wd = {};
    schema.schema.forEach(f => {
      if (values[f.id] !== undefined && values[f.id] !== "") {
        if (f.camundaVar) cv[f.id] = values[f.id];
        else              wd[f.id] = values[f.id];
      }
    });

    // Update accumulated state
    setCamundaVars(p => ({ ...p, ...cv }));
    setWlcData(p => ({ ...p, [currentStep]: wd }));

    // Record history
    const entry = makeHistoryEntry(currentStep, action, values);
    setHistory(h => [...h, entry]);

    // Update visited steps
    setVisitedSteps(v => ({ ...v, [currentStep]: action }));

    const nextStep = resolveNextStep(currentStep, action);

    if (!nextStep) {
      setDone(true);
      setDoneAction(action);
    } else {
      setVisitedSteps(v => ({ ...v, [nextStep]: "active" }));
      setCurrentStep(nextStep);
    }
  };

  const restart = () => {
    setCurrentStep("step-l1-analysis");
    setValues({});
    setErrors({});
    setHistory([]);
    setCamundaVars({});
    setWlcData({});
    setDone(false);
    setDoneAction(null);
    setVisitedSteps({ "step-l1-analysis": "active" });
  };

  // ── Sidebar step status ──
  const STEPS = [
    { id: "step-l1-analysis", label: "L1 Alert Analysis",  num: "L1" },
    { id: "step-l2-analysis", label: "L2 Alert Analysis",  num: "L2" },
    { id: "step-qa-analysis", label: "QA Analysis",         num: "QA" },
  ];

  function stepItemClass(stepId) {
    if (stepId === currentStep && !done) return "step-item active";
    const v = visitedSteps[stepId];
    if (!v) return "step-item pending";
    if (v === "SEND_BACK") return "step-item sendback";
    if (v === "CLOSE" || v === "ESCALATE") return "step-item done";
    return "step-item";
  }

  function stepBadge(stepId) {
    if (stepId === currentStep && !done) return { text: "IN PROGRESS", color: "#3b82f6" };
    const v = visitedSteps[stepId];
    if (!v || v === "active") return null;
    const m = ACTION_META[v];
    if (!m) return null;
    return { text: v, color: m.color };
  }

  // ── Field renderer ──
  const renderField = (f) => {
    // showWhen logic
    if (f.showWhen) {
      const triggerVal = values[f.showWhen.field];
      if (triggerVal !== f.showWhen.value) return null;
    }

    const hasErr = !!errors[f.id];
    const common = {
      id: f.id,
      value: values[f.id] || "",
      onChange: e => set(f.id, e.target.value),
    };

    let input;
    if (f.type === "select") {
      input = (
        <select className="f-select" {...common}>
          <option value="" disabled>Select…</option>
          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (f.type === "textarea") {
      input = <textarea className="f-textarea" rows={3} {...common} placeholder={f.placeholder || ""} />;
    } else {
      input = <input className="f-input" type={f.type} {...common} placeholder={f.placeholder || ""} />;
    }

    return (
      <div key={f.id}>
        <div className={`field-row${hasErr ? " has-error" : ""}${f.showWhen ? " revealed" : ""}`}>
          <div className="label-col">
            <div className="field-label">
              {f.label}
              {f.required && <span className="req"> *</span>}
              <span className={`route-badge ${f.camundaVar ? "rb-camunda" : "rb-wlc"}`}>
                {f.camundaVar ? "CAMUNDA" : "WLC"}
              </span>
            </div>
            {f.note && <div className="field-note">{f.note}</div>}
          </div>
          <div className="input-col">{input}</div>
        </div>
        {hasErr && <div className="error-msg">⚠ {errors[f.id]}</div>}
      </div>
    );
  };

  const severityColor = SEVERITY_COLORS[camundaVars.severity] || "var(--muted)";

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-title">Alert Investigation</div>
          {STEPS.map(s => {
            const badge = stepBadge(s.id);
            return (
              <div key={s.id} className={stepItemClass(s.id)}>
                <div className="step-num">LEVEL {s.num}</div>
                <div className="step-name">{s.label}</div>
                {badge && (
                  <span className="step-badge" style={{ color: badge.color, borderColor: badge.color, background: badge.color + "15" }}>
                    {badge.text}
                  </span>
                )}
              </div>
            );
          })}

          {/* Action legend */}
          <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid var(--border2)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 10 }}>
              Actions
            </div>
            {Object.entries(ACTION_META).map(([key, m]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: m.color }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: m.color, fontFamily: "var(--mono)" }}>{key}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {key === "ESCALATE"  && "Move to next level"}
                    {key === "CLOSE"     && "End investigation"}
                    {key === "SEND_BACK" && "Request more info"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── MAIN FORM ── */}
        <main className="main">
          {done ? (
            <div className="complete-screen">
              <div className="complete-icon">
                {doneAction === "CLOSE" ? "✅" : "↩"}
              </div>
              <div className="complete-title">
                {doneAction === "CLOSE" ? "Investigation Closed" : "Sent Back"}
              </div>
              <div className="complete-sub">
                {doneAction === "CLOSE"
                  ? `The alert investigation has been closed by ${SCHEMAS[currentStep]?.title || "QA"}. All data has been routed — Camunda variables submitted, WLC business data stored.`
                  : `Step returned to previous level with a request for more information.`}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                {Object.entries(camundaVars).length > 0 && (
                  <div style={{ textAlign: "left", background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 18px", minWidth: 200 }}>
                    <div style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "#60a5fa", fontFamily: "var(--mono)", marginBottom: 8 }}>Camunda Variables</div>
                    {Object.entries(camundaVars).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: "var(--text)", marginBottom: 4 }}>
                        <span style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}>{k}: </span>{String(v)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn-restart" onClick={restart}>Start New Investigation</button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="form-header">
                <div>
                  <div className="form-title">
                    {schema.title}
                    {camundaVars.severity && (
                      <span className="sev-badge" style={{ color: severityColor, borderColor: severityColor, background: severityColor + "20" }}>
                        {camundaVars.severity}
                      </span>
                    )}
                  </div>
                  <div className="form-sub">{schema.subtitle} · {schema.stepId}</div>
                </div>
                <div className="action-pills">
                  {schema.availableActions.map(a => {
                    const m = ACTION_META[a];
                    return (
                      <span key={a} className="action-pill" style={{ color: m.color, borderColor: m.border, background: m.bg }}>
                        {m.icon} {a}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Form card */}
              <div className="form-card">
                <div className="form-card-head">
                  <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                      {schema.schema.filter(f => f.camundaVar).length} camunda vars
                    </span>
                    <span style={{ color: "var(--border2)" }}>·</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                      {schema.schema.filter(f => !f.camundaVar).length} wlc fields
                    </span>
                    <span style={{ color: "var(--border2)" }}>·</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                      actions: {schema.availableActions.join(" | ")}
                    </span>
                  </div>
                </div>
                <div className="fields">
                  {schema.schema.map(f => renderField(f))}
                </div>
              </div>

              {/* Action bar */}
              <div className="action-bar">
                <div className="action-bar-head">Submit & Route</div>
                <div className="action-bar-body">
                  {schema.availableActions.map(a => {
                    const m = ACTION_META[a];
                    const isSelected = values.action === a;
                    return (
                      <button
                        key={a}
                        className="btn-action"
                        style={{
                          color: m.color,
                          borderColor: isSelected ? m.color : m.border,
                          background: isSelected ? m.bg : "transparent",
                          boxShadow: isSelected ? `0 0 0 1px ${m.border}` : "none",
                        }}
                        onClick={() => {
                          set("action", a);
                          setTimeout(handleSubmit, 50);
                        }}
                      >
                        <span>{m.icon}</span>
                        {m.label}
                        {a === "ESCALATE"  && <span style={{ fontSize: 10, color: "var(--muted)" }}>→ {currentStep === "step-l1-analysis" ? "L2" : "QA"}</span>}
                        {a === "SEND_BACK" && <span style={{ fontSize: 10, color: "var(--muted)" }}>→ {currentStep === "step-l2-analysis" ? "L1" : "L2"}</span>}
                      </button>
                    );
                  })}
                  <span className="btn-hint">Select action to validate & submit</span>
                </div>
              </div>
            </>
          )}
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="right-panel">

          {/* Camunda vars */}
          <div>
            <div className="panel-section-title">Camunda Variables</div>
            {Object.keys(camundaVars).length === 0
              ? <div style={{ fontSize: 11, color: "var(--muted)" }}>None submitted yet</div>
              : (
                <div className="route-table">
                  {Object.entries(camundaVars).map(([k, v]) => (
                    <div className="route-row" key={k}>
                      <span className="route-key">{k}</span>
                      <span className="route-value">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Live data split */}
          {!done && Object.keys(values).some(k => values[k]) && (
            <div>
              <div className="panel-section-title">Live Split Preview</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {schema.schema
                  .filter(f => values[f.id])
                  .map(f => (
                    <div className="route-row" key={f.id}>
                      <span className="route-key" style={{ color: f.camundaVar ? "#60a5fa" : "#4ade80" }}>
                        {f.camundaVar ? "▲" : "●"} {f.id}
                      </span>
                      <span className="route-value">{String(values[f.id]).slice(0, 22)}{values[f.id]?.length > 22 ? "…" : ""}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Flow history */}
          <div>
            <div className="panel-section-title">Flow History ({history.length})</div>
            {history.length === 0
              ? <div style={{ fontSize: 11, color: "var(--muted)" }}>No steps completed yet</div>
              : history.map((h, i) => {
                  const m = ACTION_META[h.action] || { color: "var(--muted)", border: "var(--border2)" };
                  return (
                    <div className="history-entry" key={i} style={{ borderColor: m.border }}>
                      <div className="h-step">{h.stepTitle}</div>
                      <div className="h-action" style={{ color: m.color }}>{h.action} — {h.analystName}</div>
                      <div className="h-time">{h.time}</div>
                    </div>
                  );
                })
            }
          </div>

          {/* WLC data per step */}
          {Object.keys(wlcData).length > 0 && (
            <div>
              <div className="panel-section-title">WLC Business Data</div>
              {Object.entries(wlcData).map(([step, data]) => (
                <div key={step} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 5 }}>{step}</div>
                  {Object.entries(data).map(([k, v]) => (
                    <div className="route-row" key={k}>
                      <span className="route-key">{k}</span>
                      <span className="route-value">{String(v).slice(0, 20)}{v?.length > 20 ? "…" : ""}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

        </aside>
      </div>
    </>
  );
}
