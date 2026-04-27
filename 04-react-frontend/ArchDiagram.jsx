import { useState } from "react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0d1117;
    --grid:      #161b22;
    --border:    #21262d;
    --border2:   #30363d;

    --camunda:   #f78166;
    --camunda-d: #3d1f1a;
    --camunda-m: rgba(247,129,102,0.12);

    --wlc:       #79c0ff;
    --wlc-d:     #1a2d3d;
    --wlc-m:     rgba(121,192,255,0.10);

    --db:        #56d364;
    --db-d:      #1a3021;
    --db-m:      rgba(86,211,100,0.10);

    --user:      #d2a8ff;
    --user-d:    #2d1f3d;
    --user-m:    rgba(210,168,255,0.10);

    --arrow:     #484f58;
    --text:      #e6edf3;
    --muted:     #8b949e;
    --mono:      'IBM Plex Mono', monospace;
    --sans:      'IBM Plex Sans', sans-serif;
  }

  body {
    background: var(--bg);
    font-family: var(--mono);
    min-height: 100vh;
  }

  .diagram-shell {
    min-height: 100vh;
    background: var(--bg);
    background-image:
      linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
    background-size: 32px 32px;
    padding: 32px 24px 48px;
    position: relative;
  }

  /* ── header ── */
  .diag-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 36px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border2);
  }
  .diag-title-group {}
  .diag-eyebrow {
    font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 6px;
  }
  .diag-title {
    font-family: var(--sans); font-size: 20px; font-weight: 600;
    color: var(--text); letter-spacing: -.01em;
  }
  .diag-subtitle {
    font-size: 11px; color: var(--muted); margin-top: 4px;
  }
  .legend {
    display: flex; gap: 20px; align-items: center; flex-wrap: wrap;
    justify-content: flex-end;
  }
  .legend-item {
    display: flex; align-items: center; gap: 7px;
    font-size: 11px; color: var(--muted);
  }
  .legend-dot {
    width: 10px; height: 10px; border-radius: 2px;
  }

  /* ── layer labels ── */
  .layer-label {
    font-size: 9px; letter-spacing: .18em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .layer-label::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  /* ── lanes ── */
  .diagram-body { display: flex; flex-direction: column; gap: 8px; }

  .lane {
    display: grid;
    align-items: stretch;
    gap: 8px;
    position: relative;
  }
  .lane-user     { grid-template-columns: 1fr; }
  .lane-wlc      { grid-template-columns: 200px 1fr 1fr; }
  .lane-api      { grid-template-columns: 1fr 1fr 1fr; }
  .lane-data     { grid-template-columns: 1fr 1fr 1fr; }
  .lane-camunda  { grid-template-columns: 1fr 1fr; }

  /* ── node card ── */
  .node {
    border: 1px solid var(--border2);
    border-radius: 6px;
    padding: 16px 18px;
    position: relative;
    cursor: pointer;
    transition: border-color 200ms, box-shadow 200ms, transform 200ms;
    background: var(--grid);
  }
  .node:hover { transform: translateY(-2px); }

  .node.camunda { border-color: color-mix(in srgb, var(--camunda) 30%, transparent); background: var(--camunda-d); }
  .node.camunda:hover { border-color: var(--camunda); box-shadow: 0 0 0 1px var(--camunda), 0 8px 24px rgba(247,129,102,.2); }

  .node.wlc { border-color: color-mix(in srgb, var(--wlc) 30%, transparent); background: var(--wlc-d); }
  .node.wlc:hover { border-color: var(--wlc); box-shadow: 0 0 0 1px var(--wlc), 0 8px 24px rgba(121,192,255,.2); }

  .node.db { border-color: color-mix(in srgb, var(--db) 30%, transparent); background: var(--db-d); }
  .node.db:hover { border-color: var(--db); box-shadow: 0 0 0 1px var(--db), 0 8px 24px rgba(86,211,100,.2); }

  .node.user { border-color: color-mix(in srgb, var(--user) 30%, transparent); background: var(--user-d); }
  .node.user:hover { border-color: var(--user); box-shadow: 0 0 0 1px var(--user), 0 8px 24px rgba(210,168,255,.2); }

  .node.active-node { transform: translateY(-2px); }
  .node.camunda.active-node { border-color: var(--camunda); box-shadow: 0 0 0 1px var(--camunda), 0 8px 24px rgba(247,129,102,.25); }
  .node.wlc.active-node     { border-color: var(--wlc);     box-shadow: 0 0 0 1px var(--wlc),     0 8px 24px rgba(121,192,255,.25); }
  .node.db.active-node      { border-color: var(--db);      box-shadow: 0 0 0 1px var(--db),      0 8px 24px rgba(86,211,100,.25); }
  .node.user.active-node    { border-color: var(--user);    box-shadow: 0 0 0 1px var(--user),    0 8px 24px rgba(210,168,255,.25); }

  .node-icon   { font-size: 22px; margin-bottom: 10px; }
  .node-name   { font-size: 12px; font-weight: 600; color: var(--text); font-family: var(--sans); margin-bottom: 4px; }
  .node-tech   { font-size: 10px; color: var(--muted); font-family: var(--mono); margin-bottom: 8px; }
  .node-tags   { display: flex; flex-wrap: wrap; gap: 4px; }
  .node-tag    {
    font-size: 9px; padding: 2px 7px; border-radius: 3px;
    font-family: var(--mono); letter-spacing: .04em;
    border: 1px solid;
  }
  .tag-camunda { border-color: color-mix(in srgb, var(--camunda) 40%, transparent); color: var(--camunda); background: var(--camunda-m); }
  .tag-wlc     { border-color: color-mix(in srgb, var(--wlc)     40%, transparent); color: var(--wlc);     background: var(--wlc-m); }
  .tag-db      { border-color: color-mix(in srgb, var(--db)      40%, transparent); color: var(--db);      background: var(--db-m); }
  .tag-user    { border-color: color-mix(in srgb, var(--user)    40%, transparent); color: var(--user);    background: var(--user-m); }
  .tag-neutral { border-color: var(--border2); color: var(--muted); background: transparent; }

  /* ── connector arrows (SVG overlay) ── */
  .arrows-svg {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  /* ── detail panel ── */
  .detail-panel {
    margin-top: 20px;
    border: 1px solid var(--border2);
    border-radius: 6px;
    background: var(--grid);
    overflow: hidden;
    animation: fadeUp .2s ease;
  }
  @keyframes fadeUp {
    from { opacity:0; transform: translateY(6px); }
    to   { opacity:1; transform: translateY(0); }
  }
  .detail-head {
    padding: 14px 20px;
    border-bottom: 1px solid var(--border2);
    display: flex; justify-content: space-between; align-items: center;
  }
  .detail-head-left { display: flex; align-items: center; gap: 10px; }
  .detail-icon  { font-size: 18px; }
  .detail-name  { font-size: 14px; font-weight: 600; color: var(--text); font-family: var(--sans); }
  .detail-close {
    background: none; border: none; color: var(--muted);
    cursor: pointer; font-size: 18px; padding: 2px 6px;
    transition: color 150ms;
  }
  .detail-close:hover { color: var(--text); }
  .detail-body { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; }
  .detail-section { padding: 16px 20px; border-right: 1px solid var(--border2); }
  .detail-section:last-child { border-right: none; }
  .detail-section-title {
    font-size: 9px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 10px;
  }
  .detail-item {
    font-size: 11px; color: var(--text); padding: 4px 0;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; gap: 8px;
    line-height: 1.5;
  }
  .detail-item:last-child { border-bottom: none; }
  .detail-item-bullet { color: var(--muted); flex-shrink: 0; margin-top: 1px; }

  /* ── flow steps ── */
  .flow-section { margin-top: 20px; }
  .flow-title {
    font-size: 9px; letter-spacing: .18em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .flow-title::after { content:''; flex:1; height:1px; background:var(--border); }
  .flow-steps { display: flex; gap: 0; overflow-x: auto; padding-bottom: 4px; }
  .flow-step {
    display: flex; align-items: stretch; flex-shrink: 0;
  }
  .flow-step-inner {
    border: 1px solid var(--border2); border-radius: 6px;
    padding: 12px 14px; background: var(--grid);
    min-width: 170px;
  }
  .flow-step-num {
    font-size: 9px; color: var(--muted); margin-bottom: 5px; font-family: var(--mono);
  }
  .flow-step-label {
    font-size: 11px; font-weight: 500; color: var(--text);
    font-family: var(--sans); margin-bottom: 4px;
  }
  .flow-step-detail { font-size: 10px; color: var(--muted); line-height: 1.5; }
  .flow-step-tag {
    display: inline-block; margin-top: 6px;
    font-size: 9px; padding: 1px 6px; border-radius: 2px; border: 1px solid;
  }
  .flow-arrow {
    display: flex; align-items: center;
    padding: 0 8px; color: var(--arrow); font-size: 16px; flex-shrink: 0;
  }
`;

// ── Node definitions ─────────────────────────────────────────────────────────

const NODES = {
  user: {
    id: "user", kind: "user", icon: "👤",
    name: "End User / Operator",
    tech: "Browser · React WLC",
    tags: [{ label: "Web UI", cls: "tag-user" }, { label: "Mobile", cls: "tag-user" }],
    detail: {
      responsibilities: ["Fills dynamic forms rendered by WLC", "Initiates process instances", "Reviews and approves workflow steps"],
      interfaces:       ["React Form Renderer", "Step progress tracker", "Data payload inspector"],
      notes:            ["No direct Camunda access", "Never sees BPMN internals", "Role-based step visibility (future)"],
    },
  },
  wlcRenderer: {
    id: "wlcRenderer", kind: "wlc", icon: "🎨",
    name: "WLC Form Renderer",
    tech: "React · DynamicForm.jsx",
    tags: [{ label: "JSON → UI", cls: "tag-wlc" }, { label: "Client", cls: "tag-neutral" }],
    detail: {
      responsibilities: ["Consumes JSON schema from WLC API", "Renders fields dynamically by type", "Splits data on submit (camundaVar flag)"],
      interfaces:       ["GET /api/workflows/:key/steps/:id/template", "Field types: text, select, date, textarea, email, number"],
      notes:            ["No hardcoded form fields", "camundaVar=true → Camunda path", "camundaVar=false → WLC DB path"],
    },
  },
  wlcEngine: {
    id: "wlcEngine", kind: "wlc", icon: "⚙️",
    name: "WLC Workflow Engine",
    tech: "useWorkflowEngine hook",
    tags: [{ label: "State mgmt", cls: "tag-wlc" }, { label: "Orchestrator", cls: "tag-wlc" }],
    detail: {
      responsibilities: ["Manages process lifecycle state", "Orchestrates Camunda ↔ WLC API calls", "Routes submitted data to correct destination"],
      interfaces:       ["startProcess()", "submitStep()", "getNextUserTask()"],
      notes:            ["Single source of truth for step index", "Handles loading/error states", "Triggers audit log entries"],
    },
  },
  wlcApiServer: {
    id: "wlcApiServer", kind: "wlc", icon: "🖥️",
    name: "WLC API Server",
    tech: "Express.js · Node 18",
    tags: [{ label: "REST", cls: "tag-wlc" }, { label: "Port 3001", cls: "tag-neutral" }],
    detail: {
      responsibilities: ["Serves form templates to renderer", "Persists WLC business data", "Manages workflow/step catalog"],
      interfaces:       ["GET /api/workflows", "GET /api/workflows/:key/steps/:id/template", "POST /api/instances/:id/submit"],
      notes:            ["CORS-restricted to WLC origin", "X-Correlation-ID header tracing", "All SQL via named query constants"],
    },
  },
  wlcSchemaService: {
    id: "wlcSchemaService", kind: "wlc", icon: "🔧",
    name: "WLC Schema Service",
    tech: "wlc-schema-service.js",
    tags: [{ label: "Business logic", cls: "tag-wlc" }, { label: "Transactions", cls: "tag-wlc" }],
    detail: {
      responsibilities: ["getFormTemplate() — hot path schema lookup", "saveStepSubmission() — atomic split+save", "createProcessInstance() — registers new runs"],
      interfaces:       ["db.query() named queries", "db.transaction() for atomic writes", "log_audit_event() stored function"],
      notes:            ["All data routing decisions here", "Single DB transaction per submit", "Auto-writes audit log on every op"],
    },
  },
  wlcDb: {
    id: "wlcDb", kind: "db", icon: "🗄️",
    name: "WLC PostgreSQL DB",
    tech: "PostgreSQL 14+",
    tags: [{ label: "On-prem", cls: "tag-db" }, { label: "JSONB", cls: "tag-db" }],
    detail: {
      responsibilities: ["Stores workflow + step definitions", "Holds JSON form templates (JSONB)", "Records WLC business field submissions"],
      interfaces:       ["camunda_workflows", "workflow_steps (form_template JSONB)", "step_submissions (wlc_data JSONB)", "wlc_audit_log"],
      notes:            ["GIN index on form_template for fast JSONB queries", "Append-only audit log (UPDATE/DELETE blocked)", "v_step_form_templates join view"],
    },
  },
  camundaRestGw: {
    id: "camundaRestGw", kind: "camunda", icon: "🌐",
    name: "Camunda REST Gateway",
    tech: "Camunda 8.7 · Port 8080",
    tags: [{ label: "On-prem", cls: "tag-camunda" }, { label: "/v1", cls: "tag-neutral" }],
    detail: {
      responsibilities: ["Exposes REST API for process management", "Accepts process variable submissions", "Returns next user task after completion"],
      interfaces:       ["POST /v1/process-instances", "POST /v1/tasks/:id/complete", "GET /v1/user-tasks?processInstanceKey=…"],
      notes:            ["Auth: Bearer token (Zeebe Identity)", "Returns taskDefinitionId for WLC schema lookup", "On-prem — not cloud-hosted"],
    },
  },
  camundaEngine: {
    id: "camundaEngine", kind: "camunda", icon: "⚡",
    name: "Zeebe Engine",
    tech: "Camunda 8.7 · Zeebe",
    tags: [{ label: "BPMN", cls: "tag-camunda" }, { label: "DMN", cls: "tag-camunda" }],
    detail: {
      responsibilities: ["Executes BPMN process definitions", "Evaluates gateway conditions using process vars", "Manages process instance state machine"],
      interfaces:       ["Process variables (camundaVar=true fields)", "User task lifecycle (create/complete)", "Service task invocations"],
      notes:            ["Only receives camundaVar=true fields", "WLC business data is invisible to Zeebe", "Stateless from WLC's perspective"],
    },
  },
  auditLog: {
    id: "auditLog", kind: "db", icon: "📋",
    name: "WLC Audit Log",
    tech: "wlc_audit_log table",
    tags: [{ label: "Append-only", cls: "tag-db" }, { label: "Immutable", cls: "tag-db" }],
    detail: {
      responsibilities: ["Records every process + step event", "Immutable — UPDATE/DELETE blocked by rules", "Queryable for compliance & debugging"],
      interfaces:       ["log_audit_event() stored function", "audit_event_type enum (18 event types)", "GET /api/instances/:key/audit"],
      notes:            ["Never modified after insert", "Includes correlation IDs for request tracing", "Partition by month for high volume"],
    },
  },
};

const FLOW_STEPS = [
  { num: "01", label: "User selects process",    detail: "Clicks process in sidebar catalog",       tag: "WLC UI",      cls: "tag-user" },
  { num: "02", label: "WLC starts instance",     detail: "POST /v1/process-instances → Camunda",    tag: "Camunda API", cls: "tag-camunda" },
  { num: "03", label: "Register in WLC DB",      detail: "INSERT process_instances + audit event",  tag: "WLC DB",      cls: "tag-db" },
  { num: "04", label: "Fetch form schema",        detail: "GET /api/…/template → workflow_steps",   tag: "WLC DB",      cls: "tag-db" },
  { num: "05", label: "Render dynamic form",     detail: "JSON schema → React UI fields",           tag: "Renderer",    cls: "tag-wlc" },
  { num: "06", label: "User submits step",       detail: "Data split by camundaVar flag",           tag: "WLC Engine",  cls: "tag-wlc" },
  { num: "07", label: "→ Camunda variables",     detail: "POST /v1/tasks/:id/complete + vars",      tag: "Camunda API", cls: "tag-camunda" },
  { num: "08", label: "→ WLC business data",     detail: "INSERT step_submissions.wlc_data",        tag: "WLC DB",      cls: "tag-db" },
  { num: "09", label: "Query next task",         detail: "GET /v1/user-tasks?processInstanceKey=…", tag: "Camunda API", cls: "tag-camunda" },
  { num: "10", label: "Load next form schema",   detail: "taskDefinitionId → WLC DB lookup",        tag: "WLC DB",      cls: "tag-db" },
  { num: "11", label: "Repeat 05–10",            detail: "Until process reaches end event",         tag: "Loop",        cls: "tag-neutral" },
  { num: "12", label: "Process complete",        detail: "Instance status = COMPLETED + audit",     tag: "Done",        cls: "tag-db" },
];

export default function ArchDiagram() {
  const [active, setActive] = useState(null);

  const toggle = (id) => setActive(prev => prev === id ? null : id);
  const node = active ? NODES[active] : null;

  return (
    <>
      <style>{STYLE}</style>
      <div className="diagram-shell">

        {/* Header */}
        <div className="diag-header">
          <div className="diag-title-group">
            <div className="diag-eyebrow">Technical Architecture</div>
            <div className="diag-title">WLC ↔ Camunda 8.7 Integration</div>
            <div className="diag-subtitle">Click any node to inspect responsibilities, interfaces & notes</div>
          </div>
          <div className="legend">
            {[
              { color: "var(--user)",    label: "User / UI" },
              { color: "var(--wlc)",     label: "WLC Layer" },
              { color: "var(--camunda)", label: "Camunda 8.7" },
              { color: "var(--db)",      label: "Data Store" },
            ].map(({ color, label }) => (
              <div className="legend-item" key={label}>
                <div className="legend-dot" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Diagram layers */}
        <div className="diagram-body">

          {/* Layer 1: User */}
          <div className="layer-label">User Layer</div>
          <div className="lane lane-user">
            <Node id="user" active={active} onClick={toggle} />
          </div>

          {/* Layer 2: WLC Frontend */}
          <div className="layer-label" style={{ marginTop: 16 }}>WLC Frontend</div>
          <div className="lane lane-wlc">
            <Node id="wlcRenderer" active={active} onClick={toggle} />
            <Node id="wlcEngine"   active={active} onClick={toggle} />
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
              <ArrowBox
                lines={[
                  { dir: "↓", label: "fetch template",   cls: "tag-wlc" },
                  { dir: "↓", label: "submit step data",  cls: "tag-wlc" },
                ]}
              />
            </div>
          </div>

          {/* Layer 3: WLC API + Camunda Gateway */}
          <div className="layer-label" style={{ marginTop: 16 }}>WLC API + Camunda Gateway</div>
          <div className="lane lane-api">
            <Node id="wlcApiServer"      active={active} onClick={toggle} />
            <Node id="wlcSchemaService"  active={active} onClick={toggle} />
            <Node id="camundaRestGw"     active={active} onClick={toggle} />
          </div>

          {/* Layer 4: Data + Camunda Engine */}
          <div className="layer-label" style={{ marginTop: 16 }}>Data Layer + Camunda Engine</div>
          <div className="lane lane-data">
            <Node id="wlcDb"         active={active} onClick={toggle} />
            <Node id="auditLog"      active={active} onClick={toggle} />
            <Node id="camundaEngine" active={active} onClick={toggle} />
          </div>

        </div>

        {/* Data routing callout */}
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <DataPathCard
            color="var(--camunda)"
            bg="var(--camunda-d)"
            border="color-mix(in srgb, var(--camunda) 30%, transparent)"
            icon="⚡"
            title="Camunda Variable Path"
            flag="camundaVar: true"
            items={[
              "tier, decision, country, docType…",
              "POST /v1/tasks/:id/complete",
              "Evaluated by BPMN gateway conditions",
              "Stored in Zeebe variable store",
              "Drive workflow routing decisions",
            ]}
          />
          <DataPathCard
            color="var(--db)"
            bg="var(--db-d)"
            border="color-mix(in srgb, var(--db) 30%, transparent)"
            icon="🗄️"
            title="WLC Business Data Path"
            flag="camundaVar: false"
            items={[
              "firstName, docNumber, notes, reason…",
              "INSERT step_submissions.wlc_data",
              "Camunda never sees these values",
              "Stored as JSONB in PostgreSQL",
              "Available via WLC reporting API",
            ]}
          />
        </div>

        {/* Detail panel */}
        {node && (
          <div className="detail-panel">
            <div className="detail-head">
              <div className="detail-head-left">
                <span className="detail-icon">{node.icon}</span>
                <span className="detail-name">{node.name}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>· {node.tech}</span>
              </div>
              <button className="detail-close" onClick={() => setActive(null)}>×</button>
            </div>
            <div className="detail-body">
              {[
                { title: "Responsibilities", items: node.detail.responsibilities },
                { title: "Interfaces / APIs",  items: node.detail.interfaces },
                { title: "Notes",              items: node.detail.notes },
              ].map(({ title, items }) => (
                <div className="detail-section" key={title}>
                  <div className="detail-section-title">{title}</div>
                  {items.map((item, i) => (
                    <div className="detail-item" key={i}>
                      <span className="detail-item-bullet">›</span>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flow steps */}
        <div className="flow-section">
          <div className="flow-title">Request Flow — end to end</div>
          <div className="flow-steps">
            {FLOW_STEPS.map((s, i) => (
              <div className="flow-step" key={s.num}>
                <div className="flow-step-inner">
                  <div className="flow-step-num">STEP {s.num}</div>
                  <div className="flow-step-label">{s.label}</div>
                  <div className="flow-step-detail">{s.detail}</div>
                  <span className={`flow-step-tag ${s.cls}`}>{s.tag}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && <div className="flow-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Node({ id, active, onClick }) {
  const n = NODES[id];
  const isActive = active === id;
  return (
    <div
      className={`node ${n.kind}${isActive ? " active-node" : ""}`}
      onClick={() => onClick(id)}
    >
      <div className="node-icon">{n.icon}</div>
      <div className="node-name">{n.name}</div>
      <div className="node-tech">{n.tech}</div>
      <div className="node-tags">
        {n.tags.map((t) => (
          <span className={`node-tag ${t.cls}`} key={t.label}>{t.label}</span>
        ))}
      </div>
    </div>
  );
}

function ArrowBox({ lines }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      alignItems: "center", justifyContent: "center",
      padding: "12px 16px",
      border: "1px dashed var(--border2)",
      borderRadius: 6,
      background: "transparent",
      minHeight: 80,
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 16, color: "var(--muted)" }}>{l.dir}</span>
          <span className={`node-tag ${l.cls}`}>{l.label}</span>
        </div>
      ))}
    </div>
  );
}

function DataPathCard({ color, bg, border, icon, title, flag, items }) {
  return (
    <div style={{
      border: `1px solid ${border}`,
      background: bg,
      borderRadius: 6,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "var(--sans)" }}>{title}</div>
          <div style={{ fontSize: 10, color, fontFamily: "var(--mono)", marginTop: 2, letterSpacing: ".06em" }}>{flag}</div>
        </div>
      </div>
      <div style={{ padding: "12px 16px" }}>
        {items.map((item, i) => (
          <div key={i} style={{
            fontSize: 11, color: "var(--text)", padding: "4px 0",
            borderBottom: "1px solid var(--border)",
            display: "flex", gap: 8, lineHeight: 1.5,
          }}>
            <span style={{ color: "var(--muted)", flexShrink: 0 }}>›</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
