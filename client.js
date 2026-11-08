window.__ModuleLoader__.load({ id: "dsh-purge-next", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  Dock: () => Dock,
  Panel: () => Panel,
  apply: () => apply,
  default: () => index_default,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/app.ts
var import_react13 = require("react");

// src/client/ui.ts
var import_react = require("react");
var h = import_react.createElement;
var MIN_W = 380;
var MIN_H = 260;
function clampRect(rect) {
  const vw = typeof window === "undefined" ? 1400 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const w = Math.min(Math.max(rect.w, MIN_W), Math.max(MIN_W, vw - 16));
  const hgt = Math.min(Math.max(rect.h, MIN_H), Math.max(MIN_H, vh - 16));
  return {
    w,
    h: hgt,
    x: Math.min(Math.max(8, rect.x), Math.max(8, vw - w - 8)),
    y: Math.min(Math.max(8, rect.y), Math.max(8, vh - 48))
  };
}
function defaultRect() {
  const vw = typeof window === "undefined" ? 1400 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const w = Math.min(720, Math.max(MIN_W, vw - 32));
  const hgt = Math.min(640, Math.max(MIN_H, vh - 96));
  return { x: Math.max(8, vw - w - 20), y: Math.max(8, vh - hgt - 24), w, h: hgt };
}
function loadRect(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.w === "number" && typeof parsed.h === "number") {
        return clampRect(parsed);
      }
    }
  } catch {
  }
  return defaultRect();
}
var styled = false;
function injectStyles() {
  if (styled || typeof document === "undefined") return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.dshp-ui-panel{position:fixed;z-index:60;display:flex;flex-direction:column;overflow:hidden;
  background:var(--dsw-alias-bg-layer-2,#1b1f27);color:var(--dsw-alias-label-primary,#e6e6e6);
  border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.42);
  font:12px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.dshp-ui-head{display:flex;align-items:center;gap:8px;padding:8px 10px;user-select:none;cursor:grab;
  background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border-bottom:1px solid rgba(255,255,255,.08);touch-action:none}
.dshp-ui-head:active{cursor:grabbing}
.dshp-ui-grip{opacity:.45;letter-spacing:-2px}
.dshp-ui-title{font-weight:700;letter-spacing:.2px;white-space:nowrap}
.dshp-ui-tabs{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:none}
.dshp-ui-tabs::-webkit-scrollbar{display:none}
.dshp-ui-tab{padding:3px 10px;border-radius:999px;cursor:pointer;opacity:.72;white-space:nowrap;font-size:11.5px;border:1px solid transparent}
.dshp-ui-tab:hover{opacity:1;background:rgba(255,255,255,.06)}
.dshp-ui-tab[data-on="1"]{opacity:1;font-weight:600;background:rgba(99,102,241,.24);border-color:rgba(99,102,241,.45);color:#dbe4ff}
.dshp-ui-icon{border:none;background:transparent;color:inherit;cursor:pointer;opacity:.62;font-size:14px;line-height:1;padding:2px 4px;border-radius:6px}
.dshp-ui-icon:hover{opacity:1;background:rgba(255,255,255,.08)}
.dshp-ui-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.dshp-ui-body::-webkit-scrollbar{width:10px;height:10px}
.dshp-ui-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:999px;border:2px solid transparent;background-clip:content-box}
.dshp-ui-resize{position:absolute;right:2px;bottom:2px;width:14px;height:14px;cursor:nwse-resize;
  background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.28) 50%);border-radius:3px}
.dshp-ui-card{border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.025)}
.dshp-ui-card-title{font-weight:600;font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:8px;justify-content:space-between}
.dshp-ui-btn{padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font-size:12px}
.dshp-ui-btn:hover:not(:disabled){background:rgba(255,255,255,.11)}
.dshp-ui-btn:disabled{opacity:.45;cursor:not-allowed}
.dshp-ui-btn[data-variant="primary"]{border-color:rgba(99,102,241,.55);background:rgba(99,102,241,.3);color:#e0e7ff;font-weight:600}
.dshp-ui-btn[data-variant="danger"]{border-color:rgba(248,113,113,.45);background:rgba(248,113,113,.16);color:#fecaca}
.dshp-ui-input,.dshp-ui-area{font:inherit;font-size:11.5px;padding:5px 8px;border-radius:7px;border:1px solid rgba(255,255,255,.14);
  background:rgba(0,0,0,.22);color:inherit;min-width:0}
.dshp-ui-area{width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical}
.dshp-ui-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dshp-ui-table{width:100%;border-collapse:collapse;font-size:11.5px}
.dshp-ui-table th{text-align:left;font-weight:500;opacity:.6;padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.1)}
.dshp-ui-table td{padding:2px 6px;border-bottom:1px solid rgba(255,255,255,.05)}
.dshp-ui-table tr:hover td{background:rgba(255,255,255,.03)}
.dshp-ui-badge{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10.5px;background:rgba(255,255,255,.08)}
.dshp-ui-badge[data-tone="ok"]{background:rgba(34,197,94,.16);color:#86efac}
.dshp-ui-badge[data-tone="warn"]{background:rgba(234,179,8,.16);color:#fde68a}
.dshp-ui-badge[data-tone="bad"]{background:rgba(248,113,113,.16);color:#fecaca}
.dshp-ui-muted{opacity:.68}
.dshp-ui-empty{padding:18px;text-align:center;opacity:.5}
`;
  document.head.appendChild(style);
}
function DockShell(props) {
  injectStyles();
  const key = props.storageKey ?? "dshp-ui-geom";
  const [rect, setRect] = (0, import_react.useState)(() => loadRect(key));
  const [collapsed, setCollapsed] = (0, import_react.useState)(false);
  const drag = (0, import_react.useRef)(null);
  const start = (0, import_react.useCallback)(
    (mode) => (event) => {
      if (event.button !== void 0 && event.button !== 0) return;
      drag.current = { mode, sx: event.clientX, sy: event.clientY, rect };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [rect]
  );
  const move = (0, import_react.useCallback)((event) => {
    const info = drag.current;
    if (!info) return;
    const dx = event.clientX - info.sx;
    const dy = event.clientY - info.sy;
    if (info.mode === "move") setRect(clampRect({ ...info.rect, x: info.rect.x + dx, y: info.rect.y + dy }));
    else setRect(clampRect({ ...info.rect, w: info.rect.w + dx, h: info.rect.h + dy }));
  }, []);
  const end = (0, import_react.useCallback)(() => {
    if (!drag.current) return;
    drag.current = null;
    try {
      localStorage.setItem(key, JSON.stringify(rect));
    } catch {
    }
  }, [key, rect]);
  return h(
    "div",
    { className: "dshp-ui-panel", style: { left: rect.x, top: rect.y, width: rect.w, height: collapsed ? "auto" : rect.h } },
    h(
      "div",
      { className: "dshp-ui-head", onPointerDown: start("move"), onPointerMove: move, onPointerUp: end, onPointerCancel: end },
      h("span", { className: "dshp-ui-grip" }, "\u283F"),
      h("strong", { className: "dshp-ui-title" }, props.title),
      h(
        "div",
        { className: "dshp-ui-tabs", onPointerDown: (event) => event.stopPropagation() },
        ...props.tabs.map(
          (tab) => h("span", {
            key: tab.id,
            className: "dshp-ui-tab",
            "data-on": tab.id === props.active ? "1" : "0",
            onClick: () => props.onTab(tab.id)
          }, tab.label)
        )
      ),
      h("button", { type: "button", className: "dshp-ui-icon", title: "\u56DE\u5230\u9ED8\u8BA4\u4F4D\u7F6E", onClick: () => setRect(defaultRect()) }, "\u27F2"),
      h("button", { type: "button", className: "dshp-ui-icon", title: collapsed ? "\u5C55\u5F00" : "\u6536\u8D77", onClick: () => setCollapsed(!collapsed) }, collapsed ? "\u25A2" : "\u2014")
    ),
    collapsed ? null : h("div", { className: "dshp-ui-body" }, props.children),
    collapsed ? null : h("div", {
      className: "dshp-ui-resize",
      onPointerDown: start("resize"),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end
    })
  );
}
function Card(props) {
  return h(
    "div",
    { className: "dshp-ui-card" },
    props.title ? h("div", { className: "dshp-ui-card-title" }, props.title, props.actions ?? null) : null,
    props.children
  );
}
function Btn(props) {
  return h("button", {
    type: "button",
    className: "dshp-ui-btn",
    "data-variant": props.variant,
    disabled: props.disabled,
    title: props.title,
    onClick: props.onClick
  }, props.children);
}
function Badge(props) {
  return h("span", { className: "dshp-ui-badge", "data-tone": props.tone }, props.children);
}
function Table(props) {
  return h(
    "table",
    { className: "dshp-ui-table" },
    h("thead", null, h("tr", null, ...props.head.map((title) => h("th", { key: title }, title)))),
    h("tbody", null, ...props.rows.map((row, index) => h("tr", { key: index }, ...row.map((cell, cellIndex) => h("td", { key: cellIndex }, cell)))))
  );
}
function Input(props) {
  return h("input", {
    className: "dshp-ui-input",
    type: props.type ?? "text",
    value: props.value,
    placeholder: props.placeholder,
    style: props.style,
    onChange: (event) => props.onChange(event.target.value)
  });
}
function TextArea(props) {
  return h("textarea", {
    className: "dshp-ui-area",
    value: props.value,
    placeholder: props.placeholder,
    rows: props.rows ?? 6,
    style: props.style,
    onChange: (event) => props.onChange(event.target.value)
  });
}
function Select(props) {
  return h("select", {
    className: "dshp-ui-input",
    value: props.value,
    style: props.style,
    onChange: (event) => props.onChange(event.target.value)
  }, ...props.options.map((option) => h("option", { key: option.value, value: option.value }, option.label)));
}
function Toolbar(props) {
  return h("div", { className: "dshp-ui-row" }, props.children);
}
function Muted(props) {
  return h("div", { className: "dshp-ui-muted" }, props.children);
}
function Empty(props) {
  return h("div", { className: "dshp-ui-empty" }, props.children ?? "\u6682\u65E0\u6570\u636E");
}

// src/client/api.ts
var API_PATH = "/redteam/api";
async function api(op, payload = {}) {
  const response = await fetch(API_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op, ...payload })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(String(data.error ?? `HTTP ${response.status}`));
  return data;
}
async function getJson(path) {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
  return await response.json();
}
async function postJson(path, body = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  return await response.json();
}
var plugin = {
  status: () => getJson("/dsh-purge-next/status"),
  patches: () => getJson("/dsh-purge-next/patches"),
  apply: () => postJson("/dsh-purge-next/apply"),
  revert: () => postJson("/dsh-purge-next/revert"),
  update: () => getJson("/dsh-purge-next/update"),
  prompt: () => getJson("/dsh-purge-next/prompt"),
  savePrompt: (content) => postJson("/dsh-purge-next/prompt", { content })
};
var redteam = {
  bootstrap: () => api("bootstrap"),
  open: (name2, scope = []) => api("openEngagement", { name: name2, scope }),
  activate: (eng) => api("activateEngagement", { engagement: eng }),
  stats: (eng) => api("stats", { engagement: eng }),
  assets: (eng, filter = {}) => api("assets", { engagement: eng, ...filter }),
  asset: (eng, id) => api("asset", { engagement: eng, id }),
  ingest: (eng, bundle) => api("ingest", { engagement: eng, bundle }),
  assess: (eng, assess) => api("assessAsset", { engagement: eng, assess }),
  test: (eng, test) => api("assetTest", { engagement: eng, test }),
  graph: (eng, cidr) => api("graph", { engagement: eng, cidr }),
  timeline: (eng, limit = 50) => api("discoveryTimeline", { engagement: eng, limit }),
  domains: (eng, q) => api("domains", { engagement: eng, q }),
  web: (eng, q) => api("web", { engagement: eng, q }),
  vulns: (eng, filter = {}) => api("vulns", { engagement: eng, ...filter }),
  addVuln: (eng, vuln) => api("addVuln", { engagement: eng, vuln }),
  updateVuln: (eng, id, patch) => api("updateVuln", { engagement: eng, id, patch }),
  vulnStats: (eng) => api("vulnStats", { engagement: eng }),
  credentials: (eng) => api("credentials", { engagement: eng }),
  addCredential: (eng, credential) => api("addCredential", { engagement: eng, credential }),
  access: (eng) => api("access", { engagement: eng }),
  addAccess: (eng, access) => api("addAccess", { engagement: eng, access }),
  webshells: (eng) => api("webshells", { engagement: eng }),
  addWebshell: (eng, webshell) => api("addWebshell", { engagement: eng, webshell }),
  updateWebshell: (eng, id, patch) => api("updateWebshell", { engagement: eng, id, patch }),
  tunnels: (eng) => api("tunnels", { engagement: eng }),
  addTunnel: (eng, tunnel) => api("addTunnel", { engagement: eng, tunnel }),
  updateTunnel: (eng, id, patch) => api("updateTunnel", { engagement: eng, id, patch }),
  sessions: (eng) => api("sessions", { engagement: eng }),
  probe: (eng) => api("probeSessions", { engagement: eng }),
  chain: (eng) => api("chain", { engagement: eng }),
  addChainStep: (eng, step) => api("addChainStep", { engagement: eng, step }),
  attackGraph: (eng) => api("attackGraph", { engagement: eng }),
  scores: (eng) => api("scores", { engagement: eng }),
  addScoreHit: (eng, hit) => api("addScoreHit", { engagement: eng, hit }),
  scoreReport: (eng) => api("scoreReport", { engagement: eng }),
  scoreChain: (eng) => api("scoreChain", { engagement: eng }),
  report: (eng) => api("report", { engagement: eng }),
  reportTargets: (eng) => api("reportTargets", { engagement: eng }),
  shots: (eng, filter = {}) => api("shots", { engagement: eng, ...filter }),
  shotData: (eng, id) => api("shotData", { engagement: eng, id }),
  addShot: (eng, shot) => api("shotAdd", { engagement: eng, shot }),
  httpEvidence: (eng) => api("httpEvidence", { engagement: eng }),
  addHttpEvidence: (eng, evidence) => api("addHttpEvidence", { engagement: eng, evidence }),
  attackFiles: (eng) => api("attackFiles", { engagement: eng }),
  addAttackFile: (eng, file) => api("addAttackFile", { engagement: eng, file }),
  prompts: (eng) => api("prompts", { engagement: eng }),
  savePrompt: (eng, role, content) => api("savePrompt", { engagement: eng, role, content }),
  evidenceList: (eng, filter = {}) => api("evidenceList", { engagement: eng, ...filter }),
  recordEvidence: (eng, evidence) => api("evidenceRecord", { engagement: eng, evidence }),
  unknowns: (eng, filter = {}) => api("unknownList", { engagement: eng, ...filter }),
  recordUnknown: (eng, unknown) => api("unknownRecord", { engagement: eng, unknown }),
  resolveUnknown: (eng, unk_id, disposition, resolution) => api("unknownResolve", { engagement: eng, unk_id, disposition, resolution })
};
var knowledge = {
  search: (filter = {}) => api("pocSearch", filter),
  get: (code) => api("pocGet", { code }),
  save: (poc) => api("pocSave", { poc }),
  remove: (code) => api("pocDelete", { code }),
  use: (code, used_on) => api("pocUse", { code, used_on }),
  stats: () => api("pocStats"),
  templates: (q, limit = 40) => api("templateSearch", { q, limit })
};
var skills = {
  catalog: () => api("skillCatalog"),
  read: (name2, library = "redteam") => api("skillRead", { name: name2, library }),
  save: (name2, content, description) => api("skillSave", { name: name2, content, description }),
  remove: (name2) => api("skillDelete", { name: name2 }),
  installBundled: () => api("skillInstallBundled"),
  importPath: (path) => api("skillImport", { path }),
  health: () => api("skillHealth")
};
var platform = {
  summary: () => api("platformConfigGet"),
  save: (config) => api("platformConfigSave", { config }),
  assign: (dir) => api("platformAssignToolkit", { dir })
};

// src/client/pages/clean.ts
var import_react2 = require("react");

// src/client/pages/types.ts
function fmt(value) {
  if (value === null || value === void 0) return "\u2014";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "\u662F" : "\u5426";
  return String(value);
}
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/client/pages/clean.ts
var MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";
var STATUS_LABEL = {
  applied: "\u5DF2\u5E94\u7528",
  already: "\u5DF2\u5B58\u5728",
  ok: "\u5DF2\u5E94\u7528",
  pending: "\u5F85\u5E94\u7528",
  drifted: "\u5DF2\u6F02\u79FB",
  skipped: "\u5DF2\u8DF3\u8FC7",
  unmatched: "\u672A\u5339\u914D",
  na: "\u4E0D\u9002\u7528",
  missing_file: "\u6587\u4EF6\u7F3A\u5931",
  unknown: "\u672A\u77E5",
  missing: "\u7F3A\u5931"
};
var STATUS_TONE = {
  applied: "ok",
  already: "ok",
  ok: "ok",
  pending: "warn",
  drifted: "bad",
  unmatched: "warn",
  missing_file: "bad",
  missing: "bad"
};
var COUNT_LABEL = {
  applied: "\u5DF2\u5E94\u7528",
  already: "\u5DF2\u5B58\u5728",
  pending: "\u5F85\u5E94\u7528",
  drifted: "\u5DF2\u6F02\u79FB",
  skipped: "\u5DF2\u8DF3\u8FC7",
  unmatched: "\u672A\u5339\u914D",
  na: "\u4E0D\u9002\u7528",
  missing_file: "\u6587\u4EF6\u7F3A\u5931",
  unknown: "\u672A\u77E5"
};
var COUNT_ORDER = ["applied", "already", "pending", "drifted", "skipped", "unmatched", "na", "missing_file", "unknown"];
var FILTERS = [
  { value: "all", label: "\u5168\u90E8\u72B6\u6001" },
  { value: "applied", label: "\u5DF2\u5E94\u7528" },
  { value: "pending", label: "\u5F85\u5E94\u7528" },
  { value: "drifted", label: "\u5DF2\u6F02\u79FB" },
  { value: "skipped", label: "\u5DF2\u8DF3\u8FC7" },
  { value: "unmatched", label: "\u672A\u5339\u914D" },
  { value: "na", label: "\u4E0D\u9002\u7528" },
  { value: "missing_file", label: "\u6587\u4EF6\u7F3A\u5931" },
  { value: "unknown", label: "\u672A\u77E5" }
];
var ERROR_HINT = {
  ai_base_not_found: "\u6CA1\u6709\u627E\u5230\u5BBF\u4E3B\u5B89\u88C5\u76EE\u5F55\uFF08ai_base\uFF09\uFF0C\u786E\u8BA4 dsh \u5DF2\u5B89\u88C5\u540E\u70B9\u5237\u65B0\u3002",
  patches_not_loaded: "\u8865\u4E01\u8868\u6CA1\u6709\u52A0\u8F7D\u6210\u529F\uFF0C\u68C0\u67E5\u63D2\u4EF6\u5305\u91CC\u7684 patches/ \u76EE\u5F55\u3002"
};
function statusLabel(status) {
  return STATUS_LABEL[status] ?? (status || "\u672A\u77E5");
}
function statusTone(status) {
  return STATUS_TONE[status];
}
function countEntries(counts) {
  const source = counts ?? {};
  const keys = [
    ...COUNT_ORDER.filter((key) => source[key] !== void 0),
    ...Object.keys(source).filter((key) => !COUNT_ORDER.includes(key)).sort()
  ];
  return keys.map((key) => ({ key, label: COUNT_LABEL[key] ?? key, value: Number(source[key] ?? 0) }));
}
function matchFilter(status, filter) {
  if (filter === "all") return true;
  if (filter === "applied") return status === "applied" || status === "already" || status === "ok";
  return status === filter;
}
function countTone(key) {
  if (key === "applied" || key === "already") return "ok";
  if (key === "pending" || key === "unmatched") return "warn";
  if (key === "drifted" || key === "missing_file") return "bad";
  return void 0;
}
function CleanPage(props) {
  const [status, setStatus] = (0, import_react2.useState)(null);
  const [update, setUpdate] = (0, import_react2.useState)(null);
  const [rows, setRows] = (0, import_react2.useState)([]);
  const [patchesError, setPatchesError] = (0, import_react2.useState)("");
  const [filter, setFilter] = (0, import_react2.useState)("all");
  const [promptValue, setPromptValue] = (0, import_react2.useState)("");
  const [promptPath, setPromptPath] = (0, import_react2.useState)("");
  const [promptDirty, setPromptDirty] = (0, import_react2.useState)(false);
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const [busy, setBusy] = (0, import_react2.useState)("");
  const promptLoaded = (0, import_react2.useRef)(false);
  const reload = (0, import_react2.useCallback)(async () => {
    setLoading(true);
    try {
      const [statusData, updateData, patchesData, promptData] = await Promise.all([
        plugin.status(),
        plugin.update().catch(
          () => ({ ok: false, configured: false, channel: "", repo_url: "", tarball_url: null, note: "\u66F4\u65B0\u6E90\u8BFB\u53D6\u5931\u8D25" })
        ),
        plugin.patches(),
        plugin.prompt().catch(() => ({ ok: false }))
      ]);
      setStatus(statusData ?? null);
      setUpdate(updateData ?? null);
      setRows(Array.isArray(patchesData?.rows) ? patchesData.rows : []);
      setPatchesError(patchesData?.ok === false ? patchesData.error ?? "\u8865\u4E01\u6E05\u5355\u8BFB\u53D6\u5931\u8D25" : "");
      if (!promptLoaded.current) {
        if (typeof promptData?.content === "string") {
          setPromptValue(promptData.content);
          setPromptPath(promptData.path ?? "");
          setPromptDirty(false);
          promptLoaded.current = true;
        } else if (promptData?.ok === false && promptData.error) {
          props.notify(`\u8BFB\u53D6\u63D0\u793A\u8BCD\u5931\u8D25\uFF1A${promptData.error}`, "bad");
        }
      }
    } catch (error) {
      props.notify(`\u8BFB\u53D6\u6E05\u6D17\u72B6\u6001\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setLoading(false);
    }
  }, [props.notify]);
  (0, import_react2.useEffect)(() => {
    void reload();
  }, [reload]);
  const savePromptOnly = (0, import_react2.useCallback)(async () => {
    if (!promptLoaded.current) throw new Error("\u63D0\u793A\u8BCD\u5C1A\u672A\u52A0\u8F7D\uFF0C\u5148\u70B9\u5237\u65B0\u518D\u4FDD\u5B58");
    const saved = await plugin.savePrompt(promptValue);
    if (saved?.ok === false) throw new Error(saved.error ?? "\u4FDD\u5B58\u5931\u8D25");
    if (typeof saved?.content === "string") setPromptValue(saved.content);
    if (saved?.path) setPromptPath(saved.path);
    setPromptDirty(false);
    promptLoaded.current = true;
  }, [promptValue]);
  const onSavePrompt = (0, import_react2.useCallback)(async () => {
    setBusy("save");
    try {
      await savePromptOnly();
      props.notify("\u63D0\u793A\u8BCD\u5DF2\u4FDD\u5B58");
    } catch (error) {
      props.notify(`\u63D0\u793A\u8BCD\u4FDD\u5B58\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
    }
  }, [props.notify, savePromptOnly]);
  const onApply = (0, import_react2.useCallback)(async () => {
    setBusy("apply");
    if (promptLoaded.current) {
      try {
        await savePromptOnly();
      } catch (error) {
        setBusy("");
        props.notify(`\u63D0\u793A\u8BCD\u4FDD\u5B58\u5931\u8D25\uFF0C\u5DF2\u4E2D\u6B62\u5E94\u7528\uFF1A${errorText(error)}`, "bad");
        return;
      }
    }
    try {
      const result = await plugin.apply();
      if (result?.error) throw new Error(result.error);
      const applied = Number(result?.applied ?? 0);
      const drifted2 = Number(result?.drifted ?? 0);
      const changed = Number(result?.changed_files ?? 0);
      const requiredBad = Number(result?.required_bad ?? 0);
      const ok = result?.ok !== false && drifted2 === 0 && requiredBad === 0;
      props.notify(
        ok ? `\u8865\u4E01\u5DF2\u5E94\u7528 ${applied} \u9879 \xB7 \u6F02\u79FB ${drifted2} \xB7 \u6539\u52A8\u6587\u4EF6 ${changed}` : `\u8865\u4E01\u5DF2\u5E94\u7528 ${applied} \u9879\uFF0C\u4F46\u4ECD\u6709\u6F02\u79FB ${drifted2}\u3001\u5FC5\u9700\u7F3A\u53E3 ${requiredBad}`,
        ok ? "ok" : "bad"
      );
    } catch (error) {
      props.notify(`\u5E94\u7528\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
      void reload();
    }
  }, [props.notify, reload, savePromptOnly]);
  const onRevert = (0, import_react2.useCallback)(async () => {
    setBusy("revert");
    try {
      const result = await plugin.revert();
      if (result?.error) throw new Error(result.error);
      if (result?.ok === false) throw new Error("\u8FD8\u539F\u672A\u5B8C\u6210");
      props.notify(`\u5DF2\u8FD8\u539F ${Number(result?.reverted ?? 0)} \u5904\u6539\u52A8`);
    } catch (error) {
      props.notify(`\u8FD8\u539F\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
      void reload();
    }
  }, [props.notify, reload]);
  const locked = busy !== "" || loading;
  const counts = countEntries(status?.counts);
  const required = Number(status?.required ?? 0);
  const drifted = Array.isArray(status?.drifted) ? status.drifted : [];
  const statusFailed = status !== null && status.ok === false;
  const filtered = rows.filter((row) => matchFilter(row.status, filter));
  const updateText = update === null ? "\u8BFB\u53D6\u4E2D\u2026" : update.configured ? `${update.channel || "master"} \xB7 ${update.repo_url || "\u672A\u586B\u5199\u4ED3\u5E93\u5730\u5740"}` : update.note || "\u672A\u914D\u7F6E\uFF08\u4ED3\u5E93\u4E0A\u4F20\u540E\u586B\u5199 URL\uFF09";
  const metadata = [
    status?.host ? `\u5BBF\u4E3B ${status.host}` : "",
    status?.ai_base ? `ai_base ${status.ai_base}` : "",
    status?.dsh_home ? `dsh_home ${status.dsh_home}` : "",
    promptPath ? `\u63D0\u793A\u8BCD ${promptPath}` : ""
  ].filter(Boolean);
  const statusCard = (0, import_react2.createElement)(
    Card,
    {
      title: "\u6E05\u6D17\u72B6\u6001",
      actions: (0, import_react2.createElement)(
        Toolbar,
        null,
        (0, import_react2.createElement)(Btn, { onClick: () => void reload(), disabled: locked }, loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"),
        (0, import_react2.createElement)(Btn, { variant: "primary", onClick: () => void onApply(), disabled: locked }, busy === "apply" ? "\u6267\u884C\u4E2D\u2026" : "\u5E94\u7528\u8865\u4E01"),
        (0, import_react2.createElement)(Btn, { variant: "danger", onClick: () => void onRevert(), disabled: locked }, busy === "revert" ? "\u6267\u884C\u4E2D\u2026" : "\u8FD8\u539F")
      )
    },
    (0, import_react2.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      (0, import_react2.createElement)(
        Toolbar,
        null,
        (0, import_react2.createElement)(Badge, { tone: statusFailed ? "bad" : "ok" }, `\u5FC5\u9700 ${required} \u9879`),
        (0, import_react2.createElement)(Badge, { tone: drifted.length > 0 ? "bad" : "ok" }, `\u6F02\u79FB ${drifted.length} \u9879`),
        ...counts.map((entry) => (0, import_react2.createElement)(Badge, { key: entry.key, tone: countTone(entry.key) }, `${entry.label} ${entry.value}`)),
        status === null && loading ? (0, import_react2.createElement)(Muted, null, "\u8BFB\u53D6\u4E2D\u2026") : null
      ),
      statusFailed && status?.error ? (0, import_react2.createElement)(
        Toolbar,
        null,
        (0, import_react2.createElement)(Badge, { tone: "bad" }, status.error),
        (0, import_react2.createElement)(Muted, null, ERROR_HINT[status.error] ?? "\u72B6\u6001\u8BFB\u53D6\u4E0D\u5B8C\u6574\uFF0C\u53EF\u70B9\u5237\u65B0\u91CD\u8BD5\u3002")
      ) : null,
      drifted.length > 0 ? (0, import_react2.createElement)(Muted, null, `\u6F02\u79FB\u8865\u4E01\uFF1A${drifted.map((item) => item.name || `#${item.id}`).join("\u3001")}`) : null,
      (0, import_react2.createElement)(
        Toolbar,
        null,
        (0, import_react2.createElement)("span", { style: { opacity: 0.7 } }, "\u66F4\u65B0\u6E90"),
        (0, import_react2.createElement)("span", { style: { fontFamily: MONO, fontSize: 11.5 } }, updateText)
      ),
      update?.tarball_url ? (0, import_react2.createElement)(Muted, null, `\u66F4\u65B0\u5305 tarball\uFF1A${update.tarball_url}`) : null,
      metadata.length > 0 ? (0, import_react2.createElement)(Muted, null, metadata.join(" \xB7 ")) : null
    )
  );
  const promptCard = (0, import_react2.createElement)(
    Card,
    {
      title: "\u6CE8\u5165\u63D0\u793A\u8BCD",
      actions: (0, import_react2.createElement)(
        Toolbar,
        null,
        promptDirty ? (0, import_react2.createElement)(Badge, { tone: "warn" }, "\u672A\u4FDD\u5B58") : null,
        (0, import_react2.createElement)(Btn, { onClick: () => void onSavePrompt(), disabled: locked }, busy === "save" ? "\u6267\u884C\u4E2D\u2026" : "\u4FDD\u5B58\u63D0\u793A\u8BCD")
      )
    },
    (0, import_react2.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      (0, import_react2.createElement)(TextArea, {
        value: promptValue,
        onChange: (next) => {
          setPromptValue(next);
          setPromptDirty(true);
        },
        rows: 10,
        placeholder: "\u5728\u8FD9\u91CC\u7F16\u8F91\u6CE8\u5165\u63D0\u793A\u8BCD\uFF1B\u5E94\u7528\u8865\u4E01\u524D\u4F1A\u81EA\u52A8\u4FDD\u5B58\u3002",
        style: { minHeight: 170 }
      }),
      (0, import_react2.createElement)(Muted, null, `${promptValue.length} \u5B57\u7B26 \xB7 \u5E94\u7528\u8865\u4E01\u524D\u81EA\u52A8\u4FDD\u5B58${promptDirty ? " \xB7 \u6709\u672A\u4FDD\u5B58\u6539\u52A8" : ""}`)
    )
  );
  const tableRows = filtered.map((row) => [
    (0, import_react2.createElement)("span", { style: { fontFamily: MONO, opacity: 0.75 } }, `#${row.id}`),
    row.name || "\u2014",
    row.layer || "\u2014",
    (0, import_react2.createElement)(Badge, { tone: statusTone(row.status) }, statusLabel(row.status))
  ]);
  const patchCard = (0, import_react2.createElement)(
    Card,
    {
      title: `\u8865\u4E01\u6E05\u5355\uFF08${filtered.length}/${rows.length}\uFF09`,
      actions: (0, import_react2.createElement)(Select, { value: filter, onChange: setFilter, options: FILTERS, style: { minWidth: 130 } })
    },
    filtered.length === 0 ? (0, import_react2.createElement)(
      Empty,
      null,
      rows.length === 0 ? loading ? "\u8865\u4E01\u6570\u636E\u8BFB\u53D6\u4E2D\u2026" : patchesError ? `\u8865\u4E01\u6E05\u5355\u8BFB\u53D6\u5931\u8D25\uFF1A${patchesError}` : "\u6682\u65E0\u8865\u4E01\u6570\u636E" : "\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u7684\u8865\u4E01"
    ) : (0, import_react2.createElement)(Table, { head: ["ID", "\u8865\u4E01", "\u5C42", "\u72B6\u6001"], rows: tableRows })
  );
  return (0, import_react2.createElement)("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, statusCard, promptCard, patchCard);
}

// src/client/pages/assets.ts
var import_react3 = require("react");
var VIEWS = [
  { id: "list", label: "\u8D44\u4EA7\u5217\u8868" },
  { id: "timeline", label: "\u65F6\u95F4\u7EBF" },
  { id: "domains", label: "\u57DF\u540D" },
  { id: "web", label: "Web" },
  { id: "graph", label: "\u56FE\u8C31" }
];
var SORTS = [
  { value: "ip", label: "\u6309 IP" },
  { value: "ports", label: "\u6309\u5F00\u653E\u7AEF\u53E3\u6570" },
  { value: "discovered", label: "\u6309\u53D1\u73B0\u65F6\u95F4" }
];
var PRIORITIES = [
  { value: "high", label: "high\uFF08\u9AD8\uFF09" },
  { value: "medium", label: "medium\uFF08\u4E2D\uFF09" },
  { value: "low", label: "low\uFF08\u4F4E\uFF09" }
];
var TEST_STATUS = [
  { value: "untested", label: "untested\uFF08\u672A\u6D4B\uFF09" },
  { value: "testing", label: "testing\uFF08\u6D4B\u8BD5\u4E2D\uFF09" },
  { value: "tested", label: "tested\uFF08\u5DF2\u6D4B\uFF09" },
  { value: "blocked", label: "blocked\uFF08\u53D7\u963B\uFF09" },
  { value: "no_surface", label: "no_surface\uFF08\u65E0\u53EF\u7528\u653B\u51FB\u9762\uFF09" }
];
var PROVENANCES = [
  { value: "active", label: "active\uFF08\u4E3B\u52A8\u63A2\u6D4B\uFF09" },
  { value: "passive", label: "passive\uFF08\u88AB\u52A8\u6536\u96C6\uFF09" }
];
var STATE_TONE = { live: "ok", up: "ok", down: "bad", dead: "bad", filtered: "warn", unknown: void 0 };
var PRIORITY_TONE = { high: "bad", medium: "warn", low: "ok" };
var TEST_TONE = { untested: void 0, testing: "warn", tested: "ok", blocked: "bad", no_surface: void 0 };
function ipError(value) {
  const raw = value.trim();
  if (raw === "") return "IP \u5FC5\u586B";
  const parts = raw.split(".");
  if (parts.length !== 4) return "IP \u683C\u5F0F\u4E0D\u6B63\u786E\uFF08\u4F8B\u5982 10.0.0.5\uFF09";
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return "IP \u6BCF\u6BB5\u5FC5\u987B\u662F\u6700\u591A\u4E09\u4F4D\u7684\u6570\u5B57";
    const n = Number(part);
    if (n < 0 || n > 255) return "IP \u6BCF\u6BB5\u5FC5\u987B\u5728 0-255 \u4E4B\u95F4";
  }
  return null;
}
function cidrError(value) {
  const raw = value.trim();
  if (raw === "") return null;
  const [ip, bits] = raw.split("/");
  if (bits === void 0 || !/^\d{1,2}$/.test(bits) || Number(bits) > 32) return "CIDR \u683C\u5F0F\u4E0D\u6B63\u786E\uFF08\u4F8B\u5982 10.0.0.0/24\uFF09";
  return ipError(ip ?? "");
}
function parsePorts(raw) {
  const ports = [];
  const tokens = raw.split(/[,，\s]+/).map((token) => token.trim()).filter(Boolean);
  for (const token of tokens) {
    const [portText, protoText] = token.split("/");
    const port = Number(portText);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return { ports: [], error: `\u7AEF\u53E3\u4E0D\u5408\u6CD5\uFF1A${token}\uFF081-65535\uFF09` };
    const proto = (protoText || "tcp").toLowerCase();
    if (proto !== "tcp" && proto !== "udp") return { ports: [], error: `\u534F\u8BAE\u53EA\u80FD\u662F tcp/udp\uFF1A${token}` };
    if (ports.some((item) => item.port === port && item.proto === proto)) continue;
    ports.push({ port, proto, state: "open" });
  }
  return { ports, error: null };
}
function metaText(meta) {
  if (!meta) return "\u2014";
  const pairs = Object.entries(meta).filter(([, value]) => value !== null && value !== void 0 && value !== "").map(([key, value]) => `${key}=${String(value)}`);
  return pairs.length === 0 ? "\u2014" : pairs.join(" \xB7 ");
}
function clip(value, max = 60) {
  const text = value === null || value === void 0 ? "" : String(value);
  return text.length > max ? `${text.slice(0, max)}\u2026` : text;
}
function AssetsPage(props) {
  const { engagement, refresh, notify } = props;
  const [view, setView] = (0, import_react3.useState)("list");
  const [keyword, setKeyword] = (0, import_react3.useState)("");
  const [applied, setApplied] = (0, import_react3.useState)("");
  const [cidr, setCidr] = (0, import_react3.useState)("");
  const [appliedCidr, setAppliedCidr] = (0, import_react3.useState)("");
  const [sort, setSort] = (0, import_react3.useState)("ip");
  const [tick, setTick] = (0, import_react3.useState)(0);
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [detailLoading, setDetailLoading] = (0, import_react3.useState)(false);
  const [busy, setBusy] = (0, import_react3.useState)("");
  const [items, setItems] = (0, import_react3.useState)([]);
  const [total, setTotal] = (0, import_react3.useState)(0);
  const [timeline, setTimeline] = (0, import_react3.useState)(null);
  const [domains, setDomains] = (0, import_react3.useState)([]);
  const [webItems, setWebItems] = (0, import_react3.useState)([]);
  const [graph, setGraph] = (0, import_react3.useState)(null);
  const [selected, setSelected] = (0, import_react3.useState)(null);
  const [detail, setDetail] = (0, import_react3.useState)(null);
  const [newIp, setNewIp] = (0, import_react3.useState)("");
  const [newProvenance, setNewProvenance] = (0, import_react3.useState)("active");
  const [newPorts, setNewPorts] = (0, import_react3.useState)("");
  const [priority, setPriority] = (0, import_react3.useState)("medium");
  const [reason, setReason] = (0, import_react3.useState)("");
  const [testStatus, setTestStatus] = (0, import_react3.useState)("untested");
  const [testNote, setTestNote] = (0, import_react3.useState)("");
  const reload = (0, import_react3.useCallback)(() => {
    const bad = cidrError(cidr);
    if (bad) {
      notify(bad, "bad");
      return;
    }
    setApplied(keyword.trim());
    setAppliedCidr(cidr.trim());
    setTick((value) => value + 1);
    refresh();
  }, [cidr, keyword, notify, refresh]);
  (0, import_react3.useEffect)(() => {
    if (!engagement) return;
    let alive = true;
    setLoading(true);
    const run = async () => {
      try {
        if (view === "list") {
          const data = await redteam.assets(engagement, {
            cidr: appliedCidr || void 0,
            sort,
            limit: 500
          });
          if (!alive) return;
          if (data.ok === false) throw new Error(data.error ?? "\u8D44\u4EA7\u5217\u8868\u62C9\u53D6\u5931\u8D25");
          setItems(data.items ?? []);
          setTotal(Number(data.total ?? 0));
        } else if (view === "timeline") {
          const data = await redteam.timeline(engagement, 50);
          if (!alive) return;
          if (data.ok === false) throw new Error(data.error ?? "\u65F6\u95F4\u7EBF\u62C9\u53D6\u5931\u8D25");
          setTimeline(data);
        } else if (view === "domains") {
          const data = await redteam.domains(engagement, applied || void 0);
          if (!alive) return;
          if (data.ok === false) throw new Error(data.error ?? "\u57DF\u540D\u62C9\u53D6\u5931\u8D25");
          setDomains(data.items ?? []);
        } else if (view === "web") {
          const data = await redteam.web(engagement, applied || void 0);
          if (!alive) return;
          if (data.ok === false) throw new Error(data.error ?? "Web \u8D44\u4EA7\u62C9\u53D6\u5931\u8D25");
          setWebItems(data.items ?? []);
        } else {
          const data = await redteam.graph(engagement, appliedCidr || void 0);
          if (!alive) return;
          if (data.ok === false) throw new Error(data.error ?? "\u56FE\u8C31\u62C9\u53D6\u5931\u8D25");
          setGraph(data);
        }
      } catch (error) {
        if (alive) notify(errorText(error), "bad");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [applied, appliedCidr, engagement, notify, sort, tick, view]);
  (0, import_react3.useEffect)(() => {
    if (!engagement || selected === null) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    const run = async () => {
      try {
        const data = await redteam.asset(engagement, selected);
        if (!alive) return;
        if (data.ok === false) throw new Error(data.error ?? "\u8D44\u4EA7\u8BE6\u60C5\u62C9\u53D6\u5931\u8D25");
        let ports = Array.isArray(data.ports) ? data.ports : [];
        const names = Array.isArray(data.names) ? data.names : [];
        const portsFrom = Array.isArray(data.ports) ? "asset" : "web";
        if (!Array.isArray(data.ports)) {
          const web = await redteam.web(engagement);
          if (!alive) return;
          ports = (web.items ?? []).filter((row2) => Number(row2.asset_id) === selected);
        }
        setDetail({ asset: data.asset ?? null, ports, names, portsFrom });
        const row = data.asset;
        if (row) {
          setPriority(row.priority ?? "medium");
          setReason(row.assess_reason ?? "");
          setTestStatus(row.test_status ?? "untested");
          setTestNote(row.test_notes ?? "");
        }
      } catch (error) {
        if (alive) {
          notify(errorText(error), "bad");
          setDetail(null);
        }
      } finally {
        if (alive) setDetailLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [engagement, notify, selected, tick]);
  const addAsset = (0, import_react3.useCallback)(async () => {
    if (!engagement) return;
    const bad = ipError(newIp);
    if (bad) {
      notify(bad, "bad");
      return;
    }
    const parsed = parsePorts(newPorts);
    if (parsed.error) {
      notify(parsed.error, "bad");
      return;
    }
    setBusy("ingest");
    try {
      const data = await redteam.ingest(engagement, {
        scan: { tool: "manual" },
        assets: [{ ip: newIp.trim(), provenance: newProvenance, ports: parsed.ports }]
      });
      if (data.ok === false) throw new Error(data.error ?? "\u5165\u5E93\u5931\u8D25");
      notify(`\u5DF2\u5165\u5E93 ${Number(data.counts?.assets ?? 1)} \u4E2A\u8D44\u4EA7 / ${Number(data.counts?.ports ?? parsed.ports.length)} \u4E2A\u7AEF\u53E3`);
      setNewIp("");
      setNewPorts("");
      setTick((value) => value + 1);
      refresh();
    } catch (error) {
      notify(errorText(error), "bad");
    } finally {
      setBusy("");
    }
  }, [engagement, newIp, newPorts, newProvenance, notify, refresh]);
  const assess = (0, import_react3.useCallback)(async () => {
    if (!engagement || selected === null) return;
    setBusy("assess");
    try {
      const data = await redteam.assess(engagement, {
        id: selected,
        priority,
        assess_reason: reason.trim() || void 0
      });
      if (data.ok === false) throw new Error(data.error ?? "\u8BC4\u4F30\u5931\u8D25");
      notify(`\u5DF2\u8BC4\u4F30 #${selected}\uFF1A${priority}`);
      setTick((value) => value + 1);
      refresh();
    } catch (error) {
      notify(errorText(error), "bad");
    } finally {
      setBusy("");
    }
  }, [engagement, notify, priority, reason, refresh, selected]);
  const saveTest = (0, import_react3.useCallback)(async () => {
    if (!engagement || selected === null) return;
    setBusy("test");
    try {
      const data = await redteam.test(engagement, {
        id: selected,
        status: testStatus,
        notes: testNote.trim() || void 0
      });
      if (data.ok === false) throw new Error(data.error ?? "\u6D4B\u8BD5\u72B6\u6001\u66F4\u65B0\u5931\u8D25");
      notify(`\u5DF2\u66F4\u65B0 #${selected} \u6D4B\u8BD5\u72B6\u6001\uFF1A${testStatus}`);
      setTick((value) => value + 1);
      refresh();
    } catch (error) {
      notify(errorText(error), "bad");
    } finally {
      setBusy("");
    }
  }, [engagement, notify, refresh, selected, testNote, testStatus]);
  const visible = (0, import_react3.useMemo)(() => {
    const needle = keyword.trim().toLowerCase();
    if (needle === "") return items;
    return items.filter(
      (row) => [row.ip, row.primary_name, row.state, row.priority, row.test_status, row.segment_cidr].some((value) => String(value ?? "").toLowerCase().includes(needle))
    );
  }, [items, keyword]);
  const badge = (value, tones) => {
    const text = value === null || value === void 0 || value === "" ? "\u2014" : value;
    return (0, import_react3.createElement)(Badge, { tone: value ? tones[value] : void 0 }, text);
  };
  if (!engagement) {
    return (0, import_react3.createElement)(Card, { title: "\u8D44\u4EA7\u6D4B\u7ED8" }, (0, import_react3.createElement)(Empty, null, "\u5148\u521B\u5EFA/\u9009\u62E9\u9776\u6807"));
  }
  const listRows = visible.map((row) => [
    (0, import_react3.createElement)(
      "span",
      {
        key: `ip-${row.id}`,
        title: "\u70B9\u51FB\u67E5\u770B\u8BE6\u60C5",
        style: { cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" },
        onClick: () => setSelected(row.id)
      },
      row.ip
    ),
    badge(row.state, STATE_TONE),
    fmt(row.primary_name),
    fmt(row.open_port_count ?? row.open_ports ?? 0),
    badge(row.priority, PRIORITY_TONE),
    badge(row.test_status ?? "untested", TEST_TONE)
  ]);
  const listCard = (0, import_react3.createElement)(
    Card,
    {
      title: `\u8D44\u4EA7\u5217\u8868${loading ? " \xB7 \u52A0\u8F7D\u4E2D\u2026" : ""}`,
      actions: (0, import_react3.createElement)(Muted, null, keyword.trim() ? `${visible.length} / ${total}` : `\u5171 ${total} \u6761`)
    },
    visible.length === 0 ? (0, import_react3.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : keyword.trim() ? "\u5173\u952E\u8BCD\u6CA1\u6709\u547D\u4E2D\u8D44\u4EA7" : "\u8FD8\u6CA1\u6709\u8D44\u4EA7\uFF1A\u5148\u65B0\u589E\uFF0C\u6216\u8BA9\u667A\u80FD\u4F53 ingest \u626B\u63CF\u7ED3\u679C") : (0, import_react3.createElement)(Table, { head: ["IP", "\u72B6\u6001", "\u4E3B\u57DF\u540D", "\u5F00\u653E\u7AEF\u53E3", "\u4F18\u5148\u7EA7", "\u6D4B\u8BD5"], rows: listRows }),
    visible.length > 0 ? (0, import_react3.createElement)(Muted, null, "\u70B9\u51FB IP \u67E5\u770B\u7AEF\u53E3\u3001\u8BC4\u4F30\u4E0E\u6D4B\u8BD5\u72B6\u6001\u3002") : null
  );
  const addCard = (0, import_react3.createElement)(
    Card,
    { title: "\u65B0\u589E\u8D44\u4EA7" },
    (0, import_react3.createElement)(
      Toolbar,
      null,
      (0, import_react3.createElement)(Input, { value: newIp, onChange: setNewIp, placeholder: "IP\uFF0C\u4F8B\u5982 10.0.0.5", style: { width: 160 } }),
      (0, import_react3.createElement)(Select, { value: newProvenance, onChange: setNewProvenance, options: PROVENANCES }),
      (0, import_react3.createElement)(Input, { value: newPorts, onChange: setNewPorts, placeholder: "\u7AEF\u53E3\uFF0C\u9017\u53F7\u5206\u9694\uFF1A80,443/tcp", style: { width: 210 } }),
      (0, import_react3.createElement)(Btn, { variant: "primary", onClick: () => void addAsset(), disabled: busy !== "" }, busy === "ingest" ? "\u5165\u5E93\u4E2D\u2026" : "\u5165\u5E93")
    ),
    (0, import_react3.createElement)(Muted, null, "\u8D70 ingest \u2192 bundle.assets[{ ip, provenance, ports }]\uFF0Cprovenance \u51B3\u5B9A segment.source \u4E0E\u7AEF\u53E3\u6765\u6E90\u3002")
  );
  const detailCard = selected === null ? null : (0, import_react3.createElement)(
    Card,
    {
      title: `\u8D44\u4EA7\u8BE6\u60C5 \xB7 #${selected}${detailLoading ? " \xB7 \u52A0\u8F7D\u4E2D\u2026" : ""}`,
      actions: (0, import_react3.createElement)(
        Toolbar,
        null,
        detail?.asset ? badge(detail.asset.priority, PRIORITY_TONE) : null,
        detail?.asset ? badge(detail.asset.test_status ?? "untested", TEST_TONE) : null,
        (0, import_react3.createElement)(Btn, { onClick: () => setSelected(null) }, "\u5173\u95ED")
      )
    },
    (0, import_react3.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      detail === null ? (0, import_react3.createElement)(Empty, null, detailLoading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u6CA1\u6709\u53D6\u5230\u8BE5\u8D44\u4EA7") : (0, import_react3.createElement)(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        (0, import_react3.createElement)(
          Muted,
          null,
          [
            `IP ${detail.asset?.ip ?? "\u2014"}`,
            `\u6BB5 ${fmt(detail.asset?.segment_cidr)}`,
            `\u8303\u56F4 ${fmt(detail.asset?.scope)}`,
            `\u4E3B\u57DF\u540D ${fmt(detail.asset?.primary_name)}`,
            `\u53D1\u73B0 ${fmt(detail.asset?.discovered_at ?? detail.asset?.first_seen)}`
          ].join(" \xB7 ")
        ),
        detail.asset?.assess_reason ? (0, import_react3.createElement)(Muted, null, `\u8BC4\u4F30\u7406\u7531\uFF1A${detail.asset.assess_reason}`) : null,
        detail.asset?.test_notes ? (0, import_react3.createElement)(Muted, null, `\u6D4B\u8BD5\u5907\u6CE8\uFF1A${detail.asset.test_notes}`) : null,
        detail.names.length > 0 ? (0, import_react3.createElement)(Table, {
          head: ["\u540D\u79F0", "\u7C7B\u578B"],
          rows: detail.names.map((row) => [fmt(row.name), fmt(row.kind)])
        }) : null,
        (0, import_react3.createElement)("div", { style: { fontWeight: 600 } }, `\u5F00\u653E\u7AEF\u53E3${detail.portsFrom === "web" ? "\uFF08\u6765\u81EA web \u89C6\u56FE\uFF09" : ""}`),
        detail.ports.length === 0 ? (0, import_react3.createElement)(Muted, null, "\u8BE5\u8D44\u4EA7\u6682\u65E0\u7AEF\u53E3\u8BB0\u5F55") : (0, import_react3.createElement)(Table, {
          head: ["\u7AEF\u53E3", "\u72B6\u6001", "\u6765\u6E90", "URL / \u6807\u9898"],
          rows: detail.ports.map((row) => [
            `${fmt(row.port)}/${fmt(row.proto ?? "tcp")}`,
            fmt(row.state ?? "open"),
            fmt(row.provenance),
            clip(row.url ?? row.title ?? row.banner ?? "\u2014")
          ])
        }),
        (0, import_react3.createElement)(
          Toolbar,
          null,
          (0, import_react3.createElement)("span", null, "\u8BC4\u4F30"),
          (0, import_react3.createElement)(Select, { value: priority, onChange: setPriority, options: PRIORITIES }),
          (0, import_react3.createElement)(Input, { value: reason, onChange: setReason, placeholder: "\u8BC4\u4F30\u7406\u7531", style: { flex: 1, minWidth: 160 } }),
          (0, import_react3.createElement)(Btn, { variant: "primary", onClick: () => void assess(), disabled: busy !== "" }, busy === "assess" ? "\u63D0\u4EA4\u4E2D\u2026" : "\u4FDD\u5B58\u8BC4\u4F30")
        ),
        (0, import_react3.createElement)(
          Toolbar,
          null,
          (0, import_react3.createElement)("span", null, "\u6D4B\u8BD5"),
          (0, import_react3.createElement)(Select, { value: testStatus, onChange: setTestStatus, options: TEST_STATUS }),
          (0, import_react3.createElement)(Input, { value: testNote, onChange: setTestNote, placeholder: "\u6D4B\u8BD5\u5907\u6CE8", style: { flex: 1, minWidth: 160 } }),
          (0, import_react3.createElement)(Btn, { onClick: () => void saveTest(), disabled: busy !== "" }, busy === "test" ? "\u63D0\u4EA4\u4E2D\u2026" : "\u8BB0\u5F55\u72B6\u6001")
        )
      )
    )
  );
  const timelineCard = (() => {
    const days = timeline?.days ?? [];
    const recent = timeline?.recent ?? [];
    return (0, import_react3.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      (0, import_react3.createElement)(
        Card,
        { title: "\u53D1\u73B0\u8282\u594F\uFF08\u6309\u5929\uFF09", actions: timeline?.span ? (0, import_react3.createElement)(Muted, null, `\u5171 ${fmt(timeline.span.total)} \u6761`) : null },
        (0, import_react3.createElement)(Muted, null, timeline?.span ? `\u8DE8\u5EA6 ${fmt(timeline.span.first)} \u2192 ${fmt(timeline.span.last)}` : "\u2014"),
        days.length === 0 ? (0, import_react3.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u8FD8\u6CA1\u6709\u53D1\u73B0\u8BB0\u5F55") : (0, import_react3.createElement)(Table, {
          head: ["\u65E5\u671F", "\u8D44\u4EA7", "\u5185\u90E8", "\u5916\u90E8"],
          rows: days.map((row) => [fmt(row.day), fmt(row.assets), fmt(row.internal), fmt(row.external)])
        })
      ),
      (0, import_react3.createElement)(
        Card,
        { title: "\u6700\u8FD1\u53D1\u73B0" },
        recent.length === 0 ? (0, import_react3.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u8FD8\u6CA1\u6709\u8D44\u4EA7") : (0, import_react3.createElement)(Table, {
          head: ["IP", "\u72B6\u6001", "\u4E3B\u57DF\u540D", "\u5F00\u653E\u7AEF\u53E3", "\u4F18\u5148\u7EA7", "\u53D1\u73B0\u65F6\u95F4"],
          rows: recent.map((row) => [
            (0, import_react3.createElement)(
              "span",
              {
                key: `recent-${row.id}`,
                style: { cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" },
                onClick: () => setSelected(row.id)
              },
              row.ip
            ),
            badge(row.state, STATE_TONE),
            fmt(row.primary_name),
            fmt(row.open_ports ?? row.open_port_count ?? 0),
            badge(row.priority, PRIORITY_TONE),
            fmt(row.discovered_at ?? row.first_seen)
          ])
        })
      )
    );
  })();
  const domainsCard = (0, import_react3.createElement)(
    Card,
    { title: "\u57DF\u540D", actions: (0, import_react3.createElement)(Muted, null, applied ? `\u5173\u952E\u8BCD\u300C${applied}\u300D` : "\u5168\u90E8") },
    (domains ?? []).length === 0 ? (0, import_react3.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : applied ? "\u5173\u952E\u8BCD\u6CA1\u6709\u547D\u4E2D\u57DF\u540D" : "\u8FD8\u6CA1\u6709\u57DF\u540D/\u4E3B\u673A\u540D\u8BB0\u5F55") : (0, import_react3.createElement)(Table, {
      head: ["\u57DF\u540D", "\u8D44\u4EA7\u6570", "\u6700\u8FD1\u51FA\u73B0"],
      rows: (domains ?? []).map((row) => [fmt(row.name), fmt(row.assets), fmt(row.last_seen)])
    })
  );
  const webCard = (0, import_react3.createElement)(
    Card,
    { title: "Web \u8D44\u4EA7", actions: (0, import_react3.createElement)(Muted, null, `${webItems.length} \u6761`) },
    webItems.length === 0 ? (0, import_react3.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : applied ? "\u5173\u952E\u8BCD\u6CA1\u6709\u547D\u4E2D Web \u8D44\u4EA7" : "\u8FD8\u6CA1\u6709\u5E26 URL/\u6807\u9898\u7684\u7AEF\u53E3\u8BB0\u5F55") : (0, import_react3.createElement)(Table, {
      head: ["URL / \u6807\u9898", "\u7AEF\u53E3", "\u8D44\u4EA7", "Banner"],
      rows: webItems.map((row) => [
        clip(row.url ?? row.title ?? "\u2014", 70),
        `${fmt(row.port)}/${fmt(row.proto ?? "tcp")}`,
        fmt(row.ip),
        clip(row.banner ?? row.title ?? "\u2014", 40)
      ])
    })
  );
  const graphCard = (() => {
    const nodes = graph?.nodes ?? [];
    const edges = graph?.edges ?? [];
    return (0, import_react3.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      (0, import_react3.createElement)(
        Card,
        { title: "\u56FE\u8C31\u8282\u70B9", actions: (0, import_react3.createElement)(Muted, null, `${nodes.length} \u8282\u70B9 / ${edges.length} \u8FB9`) },
        nodes.length === 0 ? (0, import_react3.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : appliedCidr ? "\u8BE5 CIDR \u4E0B\u6CA1\u6709\u8282\u70B9" : "\u8FD8\u6CA1\u6709\u56FE\u8C31\u6570\u636E") : (0, import_react3.createElement)(Table, {
          head: ["ID", "\u7C7B\u578B", "\u6807\u7B7E", "\u5C5E\u6027"],
          rows: nodes.map((node) => [node.id, node.kind, node.label, metaText(node.meta)])
        })
      ),
      (0, import_react3.createElement)(
        Card,
        { title: "\u56FE\u8C31\u8FB9" },
        edges.length === 0 ? (0, import_react3.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u8FD8\u6CA1\u6709\u8FB9") : (0, import_react3.createElement)(Table, {
          head: ["\u6E90", "\u5173\u7CFB", "\u76EE\u6807"],
          rows: edges.map((edge) => [edge.source, edge.relation, edge.target])
        })
      )
    );
  })();
  const body = () => {
    if (view === "timeline") return timelineCard;
    if (view === "domains") return domainsCard;
    if (view === "web") return webCard;
    if (view === "graph") return graphCard;
    return (0, import_react3.createElement)("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, addCard, listCard);
  };
  return (0, import_react3.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    (0, import_react3.createElement)(
      Card,
      { title: `\u8D44\u4EA7\u6D4B\u7ED8 \xB7 ${engagement}` },
      (0, import_react3.createElement)(
        Toolbar,
        null,
        (0, import_react3.createElement)(Input, { value: keyword, onChange: setKeyword, placeholder: "\u5173\u952E\u8BCD\uFF08IP / \u57DF\u540D / \u72B6\u6001\uFF09", style: { width: 190 } }),
        (0, import_react3.createElement)(Input, { value: cidr, onChange: setCidr, placeholder: "CIDR\uFF0C\u4F8B\u5982 10.0.0.0/24", style: { width: 180 } }),
        (0, import_react3.createElement)(Select, { value: sort, onChange: setSort, options: SORTS }),
        (0, import_react3.createElement)(Btn, { variant: "primary", onClick: reload, disabled: loading }, loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0")
      ),
      (0, import_react3.createElement)(Muted, null, "\u5217\u8868\u5173\u952E\u8BCD\u5373\u65F6\u672C\u5730\u8FC7\u6EE4\uFF1B\u57DF\u540D / Web \u5173\u952E\u8BCD\u70B9\u300C\u5237\u65B0\u300D\u540E\u670D\u52A1\u7AEF\u68C0\u7D22\u3002CIDR \u8D70 assets/graph \u7684\u7CBE\u786E\u6BB5\u5339\u914D\u3002"),
      (0, import_react3.createElement)(
        Toolbar,
        null,
        ...VIEWS.map(
          (item) => (0, import_react3.createElement)(
            Btn,
            { key: item.id, variant: item.id === view ? "primary" : void 0, onClick: () => setView(item.id) },
            item.label
          )
        )
      )
    ),
    body(),
    detailCard
  );
}

// src/client/pages/findings.ts
var import_react4 = require("react");
var VIEWS2 = [
  { id: "vulns", label: "\u6F0F\u6D1E" },
  { id: "creds", label: "\u51ED\u636E" },
  { id: "access", label: "\u8BBF\u95EE" },
  { id: "evidence", label: "\u8BC1\u636E" },
  { id: "shots", label: "\u622A\u56FE" },
  { id: "http", label: "HTTP \u8BC1\u636E" },
  { id: "files", label: "\u653B\u51FB\u6587\u4EF6" }
];
var SEVERITIES = ["critical", "high", "medium", "low", "info"];
var STATUSES = ["candidate", "confirmed", "exploited", "false_positive", "fixed"];
var CONFIDENCES = ["observed", "claimed", "derived", "inferred"];
var AUTHORITIES = ["tool-output", "database-record", "screenshot", "request-replay", "subagent-report", "operator-input"];
var HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
var SEVERITY_LABEL = { critical: "\u4E25\u91CD", high: "\u9AD8\u5371", medium: "\u4E2D\u5371", low: "\u4F4E\u5371", info: "\u4FE1\u606F" };
var STATUS_LABEL2 = {
  candidate: "\u5019\u9009",
  confirmed: "\u5DF2\u786E\u8BA4",
  exploited: "\u5DF2\u5229\u7528",
  false_positive: "\u8BEF\u62A5",
  fixed: "\u5DF2\u4FEE\u590D"
};
var PRE_STYLE = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 260,
  overflow: "auto",
  margin: 0,
  padding: "6px 8px",
  fontSize: 11,
  lineHeight: 1.5,
  borderRadius: 8,
  background: "rgba(0,0,0,.24)",
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace"
};
var MONO_STYLE = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", wordBreak: "break-all" };
function check(data) {
  if (data.ok === false) throw new Error(data.error || "\u63A5\u53E3\u8FD4\u56DE\u5931\u8D25");
  return data;
}
function pretty(value) {
  try {
    const text = JSON.stringify(value, null, 2);
    return text === void 0 ? String(value) : text;
  } catch {
    return String(value);
  }
}
function sevTone(severity) {
  if (severity === "critical" || severity === "high") return "bad";
  if (severity === "medium") return "warn";
  return void 0;
}
function statusTone2(status) {
  if (status === "exploited") return "ok";
  if (status === "confirmed") return "warn";
  if (status === "false_positive") return "bad";
  return void 0;
}
function confidenceTone(confidence) {
  if (confidence === "observed") return "ok";
  if (confidence === "claimed" || confidence === "inferred") return "warn";
  return void 0;
}
function httpTone(status) {
  if (status === null || status === void 0) return void 0;
  if (status >= 500) return "bad";
  if (status >= 400) return "warn";
  if (status >= 200) return "ok";
  return void 0;
}
function shortId(value) {
  const text = String(value ?? "");
  return text.length > 16 ? `${text.slice(0, 16)}\u2026` : text || "\u2014";
}
function FindingsPage(props) {
  const eng = props.engagement ?? "";
  const notify = props.notify;
  const refresh = props.refresh;
  const [view, setView] = (0, import_react4.useState)("vulns");
  const [loading, setLoading] = (0, import_react4.useState)(false);
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [vulnItems, setVulnItems] = (0, import_react4.useState)([]);
  const [stats, setStats] = (0, import_react4.useState)(null);
  const [vulnForm, setVulnForm] = (0, import_react4.useState)({ title: "", severity: "medium", target: "", asset_id: "" });
  const [credItems, setCredItems] = (0, import_react4.useState)([]);
  const [credForm, setCredForm] = (0, import_react4.useState)({ host: "", username: "", secret_type: "password", secret_value: "", privilege: "" });
  const [accessItems, setAccessItems] = (0, import_react4.useState)([]);
  const [accessForm, setAccessForm] = (0, import_react4.useState)({ host: "", username: "", method: "", privilege: "", session_ref: "" });
  const [evidenceItems, setEvidenceItems] = (0, import_react4.useState)([]);
  const [evidenceOpen, setEvidenceOpen] = (0, import_react4.useState)("");
  const [evidenceForm, setEvidenceForm] = (0, import_react4.useState)({ operation: "", result: "", confidence: "observed", authority: "tool-output" });
  const [shotItems, setShotItems] = (0, import_react4.useState)([]);
  const [shotForm, setShotForm] = (0, import_react4.useState)({ label: "", data: "", kind: "screenshot", mime: "image/png" });
  const [shotView, setShotView] = (0, import_react4.useState)(null);
  const [shotLoadingId, setShotLoadingId] = (0, import_react4.useState)(null);
  const [httpItems, setHttpItems] = (0, import_react4.useState)([]);
  const [httpOpen, setHttpOpen] = (0, import_react4.useState)(null);
  const [httpForm, setHttpForm] = (0, import_react4.useState)({ method: "GET", url: "", status: "200", request: "", response: "", label: "" });
  const [fileItems, setFileItems] = (0, import_react4.useState)([]);
  const [fileForm, setFileForm] = (0, import_react4.useState)({ target: "", name: "", kind: "poc", content: "", description: "" });
  const busyRef = (0, import_react4.useRef)(false);
  const load = (0, import_react4.useCallback)(async () => {
    if (!eng) return;
    setLoading(true);
    let reported = false;
    const report = (error) => {
      if (reported) return;
      reported = true;
      notify(errorText(error), "bad");
    };
    const grab = async (promise, fallback) => {
      try {
        return check(await promise);
      } catch (error) {
        report(error);
        return fallback;
      }
    };
    try {
      const [vulns, statsRes, creds, accesses, evidence, shots, http, files] = await Promise.all([
        grab(redteam.vulns(eng), { items: [] }),
        grab(redteam.vulnStats(eng), { stats: void 0 }),
        grab(redteam.credentials(eng), { items: [] }),
        grab(redteam.access(eng), { items: [] }),
        grab(redteam.evidenceList(eng, { limit: 100 }), { items: [] }),
        grab(redteam.shots(eng, { limit: 100 }), { items: [] }),
        grab(redteam.httpEvidence(eng), { items: [] }),
        grab(redteam.attackFiles(eng), { items: [] })
      ]);
      setVulnItems(vulns.items ?? []);
      setStats(statsRes.stats ?? null);
      setCredItems(creds.items ?? []);
      setAccessItems(accesses.items ?? []);
      setEvidenceItems(evidence.items ?? []);
      setShotItems(shots.items ?? []);
      setHttpItems(http.items ?? []);
      setFileItems(files.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [eng, notify]);
  (0, import_react4.useEffect)(() => {
    void load();
  }, [load]);
  const run = (0, import_react4.useCallback)(
    async (work) => {
      if (!eng) {
        notify("\u8BF7\u5148\u521B\u5EFA\u6216\u9009\u62E9\u9776\u6807", "bad");
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await work();
        await load();
        refresh();
      } catch (error) {
        notify(errorText(error), "bad");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [eng, load, notify, refresh]
  );
  const submitVuln = () => {
    const title = vulnForm.title.trim();
    if (!title) {
      notify("\u6F0F\u6D1E\u6807\u9898\u5FC5\u586B", "bad");
      return;
    }
    const assetId = vulnForm.asset_id.trim() === "" ? null : Number(vulnForm.asset_id);
    if (assetId !== null && !Number.isFinite(assetId)) {
      notify("asset_id \u5FC5\u987B\u662F\u6570\u5B57", "bad");
      return;
    }
    void run(async () => {
      check(
        await redteam.addVuln(eng, {
          title,
          severity: vulnForm.severity,
          target: vulnForm.target.trim() || null,
          asset_id: assetId
        })
      );
      setVulnForm({ title: "", severity: "medium", target: "", asset_id: "" });
      notify(`\u6F0F\u6D1E\u300C${title}\u300D\u5DF2\u8BB0\u5F55`);
    });
  };
  const changeVulnStatus = (row, status) => {
    void run(async () => {
      check(await redteam.updateVuln(eng, row.id, { status }));
      notify(`#${row.id} \u72B6\u6001 \u2192 ${STATUS_LABEL2[status] ?? status}`);
    });
  };
  const submitCredential = () => {
    const host = credForm.host.trim();
    const username = credForm.username.trim();
    if (!host || !username) {
      notify("\u51ED\u636E\u9700\u8981 host \u4E0E username", "bad");
      return;
    }
    void run(async () => {
      check(
        await redteam.addCredential(eng, {
          host,
          username,
          secret_type: credForm.secret_type.trim() || "password",
          secret_value: credForm.secret_value,
          privilege: credForm.privilege.trim() || null
        })
      );
      setCredForm({ host: "", username: "", secret_type: "password", secret_value: "", privilege: "" });
      notify(`\u51ED\u636E ${username}@${host} \u5DF2\u8BB0\u5F55`);
    });
  };
  const submitAccess = () => {
    const host = accessForm.host.trim();
    if (!host) {
      notify("\u8BBF\u95EE\u8BB0\u5F55\u9700\u8981 host", "bad");
      return;
    }
    void run(async () => {
      check(
        await redteam.addAccess(eng, {
          host,
          username: accessForm.username.trim() || null,
          method: accessForm.method.trim() || null,
          privilege: accessForm.privilege.trim() || null,
          session_ref: accessForm.session_ref.trim() || null
        })
      );
      setAccessForm({ host: "", username: "", method: "", privilege: "", session_ref: "" });
      notify(`\u8BBF\u95EE\u5165\u53E3 ${host} \u5DF2\u8BB0\u5F55`);
    });
  };
  const submitEvidence = () => {
    const operation = evidenceForm.operation.trim();
    if (!operation) {
      notify("\u8BC1\u636E\u9700\u8981 operation", "bad");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(evidenceForm.result.trim() || "null");
    } catch {
      notify("result \u5FC5\u987B\u662F\u5408\u6CD5 JSON", "bad");
      return;
    }
    if (parsed === null || parsed === void 0) {
      notify("result \u4E0D\u80FD\u4E3A\u7A7A\uFF08JSON \u5BF9\u8C61/\u6570\u7EC4/\u5B57\u7B26\u4E32\u5747\u53EF\uFF09", "bad");
      return;
    }
    void run(async () => {
      const data = check(
        await redteam.recordEvidence(eng, {
          operation,
          result: parsed,
          confidence: evidenceForm.confidence,
          authority: evidenceForm.authority
        })
      );
      setEvidenceForm({ operation: "", result: "", confidence: "observed", authority: "tool-output" });
      notify(data.duplicate ? "\u8BC1\u636E\u5DF2\u5B58\u5728\uFF08\u5185\u5BB9\u53BB\u91CD\uFF09" : `\u8BC1\u636E ${shortId(data.ev_id)} \u5DF2\u5165\u8D26`);
    });
  };
  const openShot = (row) => {
    if (shotLoadingId !== null) return;
    setShotLoadingId(row.id);
    void (async () => {
      try {
        const data = check(await redteam.shotData(eng, row.id));
        setShotView({ id: row.id, mime: data.mime ?? "image/png", data: data.data ?? "" });
      } catch (error) {
        notify(errorText(error), "bad");
      } finally {
        setShotLoadingId(null);
      }
    })();
  };
  const submitShot = () => {
    const data = shotForm.data.trim();
    if (!data) {
      notify("\u8BF7\u7C98\u8D34\u622A\u56FE base64", "bad");
      return;
    }
    void run(async () => {
      check(
        await redteam.addShot(eng, {
          label: shotForm.label.trim() || null,
          data,
          kind: shotForm.kind,
          mime: shotForm.mime
        })
      );
      setShotForm({ label: "", data: "", kind: "screenshot", mime: "image/png" });
      notify("\u622A\u56FE\u5DF2\u4E0A\u4F20");
    });
  };
  const submitHttp = () => {
    const url = httpForm.url.trim();
    if (!url) {
      notify("HTTP \u8BC1\u636E\u9700\u8981 url", "bad");
      return;
    }
    const status = httpForm.status.trim() === "" ? null : Number(httpForm.status);
    if (status !== null && !Number.isFinite(status)) {
      notify("status \u5FC5\u987B\u662F\u6570\u5B57", "bad");
      return;
    }
    void run(async () => {
      check(
        await redteam.addHttpEvidence(eng, {
          label: httpForm.label.trim() || null,
          method: httpForm.method,
          url,
          status,
          request: httpForm.request,
          response: httpForm.response
        })
      );
      setHttpForm({ method: "GET", url: "", status: "200", request: "", response: "", label: "" });
      notify("HTTP \u8BC1\u636E\u5DF2\u8BB0\u5F55");
    });
  };
  const submitFile = () => {
    const target = fileForm.target.trim();
    const name2 = fileForm.name.trim();
    if (!target || !name2) {
      notify("\u653B\u51FB\u6587\u4EF6\u9700\u8981 target \u4E0E name", "bad");
      return;
    }
    void run(async () => {
      const data = check(
        await redteam.addAttackFile(eng, {
          target,
          name: name2,
          kind: fileForm.kind.trim() || null,
          content: fileForm.content,
          description: fileForm.description.trim() || null
        })
      );
      setFileForm({ target: "", name: "", kind: "poc", content: "", description: "" });
      notify(data.updated ? `\u653B\u51FB\u6587\u4EF6 ${name2} \u5DF2\u8986\u76D6` : `\u653B\u51FB\u6587\u4EF6 ${name2} \u5DF2\u5F52\u6863`);
    });
  };
  if (!eng) {
    return (0, import_react4.createElement)(
      Card,
      { title: "\u8FD8\u6CA1\u6709\u9776\u6807" },
      (0, import_react4.createElement)(Muted, null, "\u5148\u5728\u4E0A\u65B9\u521B\u5EFA\u6216\u9009\u62E9\u9776\u6807\uFF0C\u518D\u8BB0\u5F55\u6F0F\u6D1E\u3001\u51ED\u636E\u3001\u8BBF\u95EE\u5165\u53E3\u4E0E\u8BC1\u636E\u3002"),
      (0, import_react4.createElement)(Empty, null, "\u6682\u65E0\u6570\u636E")
    );
  }
  const statsCard = () => (0, import_react4.createElement)(
    Card,
    { title: "\u6F0F\u6D1E\u7EDF\u8BA1", actions: (0, import_react4.createElement)(Muted, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u6309\u7B49\u7EA7 / \u72B6\u6001\u6C47\u603B") },
    stats ? (0, import_react4.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 6 } },
      (0, import_react4.createElement)(
        Toolbar,
        null,
        (0, import_react4.createElement)(Badge, null, `\u603B\u6570 ${fmt(stats.total ?? 0)}`),
        ...SEVERITIES.map(
          (severity) => (0, import_react4.createElement)(Badge, { key: severity, tone: sevTone(severity) }, `${SEVERITY_LABEL[severity] ?? severity} ${fmt(stats.bySeverity?.[severity] ?? 0)}`)
        )
      ),
      (0, import_react4.createElement)(
        Toolbar,
        null,
        ...STATUSES.map(
          (status) => (0, import_react4.createElement)(Badge, { key: status, tone: statusTone2(status) }, `${STATUS_LABEL2[status] ?? status} ${fmt(stats.byStatus?.[status] ?? 0)}`)
        )
      ),
      (0, import_react4.createElement)(
        Muted,
        null,
        `\u6709\u6210\u679C ${fmt(stats.withGained ?? 0)} \xB7 \u6709\u8BC1\u636E ${fmt(stats.withEvidence ?? 0)} \xB7 \u76EE\u6807\u5206\u7EC4 ${fmt(stats.targetGroups ?? 0)}`
      )
    ) : (0, import_react4.createElement)(Empty, null, "\u7EDF\u8BA1\u5C1A\u672A\u52A0\u8F7D")
  );
  const viewTabs = () => (0, import_react4.createElement)(
    "div",
    { style: { display: "flex", gap: 2, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 6 } },
    ...VIEWS2.map(
      (item) => (0, import_react4.createElement)(
        "span",
        {
          key: item.id,
          className: "dshp-ui-tab",
          "data-on": item.id === view ? "1" : "0",
          onClick: () => setView(item.id)
        },
        item.label
      )
    )
  );
  const vulnView = () => (0, import_react4.createElement)(
    Card,
    { title: "\u6F0F\u6D1E\u6E05\u5355", actions: (0, import_react4.createElement)(Muted, null, `${vulnItems.length} \u6761`) },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Input, {
        value: vulnForm.title,
        onChange: (value) => setVulnForm({ ...vulnForm, title: value }),
        placeholder: "\u6F0F\u6D1E\u6807\u9898\uFF08\u5FC5\u586B\uFF09",
        style: { flex: 2, minWidth: 180 }
      }),
      (0, import_react4.createElement)(Select, {
        value: vulnForm.severity,
        options: SEVERITIES.map((severity) => ({ value: severity, label: `${severity} \xB7 ${SEVERITY_LABEL[severity] ?? ""}` })),
        onChange: (value) => setVulnForm({ ...vulnForm, severity: value }),
        style: { width: 150 }
      }),
      (0, import_react4.createElement)(Input, {
        value: vulnForm.target,
        onChange: (value) => setVulnForm({ ...vulnForm, target: value }),
        placeholder: "target\uFF08\u57DF\u540D/IP\uFF0C\u53EF\u7A7A\uFF09",
        style: { flex: 1, minWidth: 150 }
      }),
      (0, import_react4.createElement)(Input, {
        value: vulnForm.asset_id,
        onChange: (value) => setVulnForm({ ...vulnForm, asset_id: value }),
        placeholder: "asset_id",
        type: "number",
        style: { width: 100 }
      }),
      (0, import_react4.createElement)(Btn, { variant: "primary", disabled: busy, onClick: submitVuln }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u65B0\u589E\u6F0F\u6D1E")
    ),
    vulnItems.length === 0 ? (0, import_react4.createElement)(Empty, null, "\u6682\u65E0\u6F0F\u6D1E\u8BB0\u5F55") : (0, import_react4.createElement)(Table, {
      head: ["ID", "\u6807\u9898", "\u7B49\u7EA7", "\u72B6\u6001", "\u76EE\u6807", "\u6210\u679C", "\u72B6\u6001\u6D41\u8F6C"],
      rows: vulnItems.map((row) => [
        `#${row.id}`,
        row.title || "\uFF08\u672A\u547D\u540D\uFF09",
        (0, import_react4.createElement)(Badge, { tone: sevTone(String(row.severity ?? "")) }, `${row.severity ?? "info"} \xB7 ${SEVERITY_LABEL[String(row.severity ?? "info")] ?? ""}`),
        (0, import_react4.createElement)(Badge, { tone: statusTone2(String(row.status ?? "")) }, STATUS_LABEL2[String(row.status ?? "candidate")] ?? String(row.status ?? "\u2014")),
        row.target || "\u2014",
        row.gained || "\u2014",
        (0, import_react4.createElement)(
          Select,
          {
            value: String(row.status ?? "candidate"),
            options: STATUSES.map((status) => ({ value: status, label: STATUS_LABEL2[status] ?? status })),
            style: { width: 118 },
            onChange: (value) => changeVulnStatus(row, value)
          }
        )
      ])
    })
  );
  const credView = () => (0, import_react4.createElement)(
    Card,
    { title: "\u51ED\u636E", actions: (0, import_react4.createElement)(Muted, null, `${credItems.length} \u6761`) },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Input, { value: credForm.host, onChange: (value) => setCredForm({ ...credForm, host: value }), placeholder: "host\uFF08\u5FC5\u586B\uFF09", style: { minWidth: 140 } }),
      (0, import_react4.createElement)(Input, { value: credForm.username, onChange: (value) => setCredForm({ ...credForm, username: value }), placeholder: "username\uFF08\u5FC5\u586B\uFF09", style: { minWidth: 130 } }),
      (0, import_react4.createElement)(Select, {
        value: credForm.secret_type,
        options: ["password", "ntlm", "hash", "sshkey", "token", "cookie"].map((item) => ({ value: item, label: item })),
        onChange: (value) => setCredForm({ ...credForm, secret_type: value }),
        style: { width: 110 }
      }),
      (0, import_react4.createElement)(Input, { value: credForm.secret_value, onChange: (value) => setCredForm({ ...credForm, secret_value: value }), placeholder: "secret_value", style: { flex: 1, minWidth: 150 } }),
      (0, import_react4.createElement)(Input, { value: credForm.privilege, onChange: (value) => setCredForm({ ...credForm, privilege: value }), placeholder: "privilege", style: { width: 110 } }),
      (0, import_react4.createElement)(Btn, { variant: "primary", disabled: busy, onClick: submitCredential }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u65B0\u589E\u51ED\u636E")
    ),
    credItems.length === 0 ? (0, import_react4.createElement)(Empty, null, "\u6682\u65E0\u51ED\u636E") : (0, import_react4.createElement)(Table, {
      head: ["\u4E3B\u673A", "\u8D26\u53F7", "\u7C7B\u578B", "\u53E3\u4EE4/\u5BC6\u94A5", "\u6743\u9650", "\u6765\u6E90", "\u65F6\u95F4"],
      rows: credItems.map((row) => [
        row.host || "\u2014",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.username || "\u2014"),
        row.secret_type || "\u2014",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.secret_value || "\u2014"),
        row.privilege || "\u2014",
        row.source || "\u2014",
        fmt(row.found_at)
      ])
    })
  );
  const accessView = () => (0, import_react4.createElement)(
    Card,
    { title: "\u8BBF\u95EE\u5165\u53E3", actions: (0, import_react4.createElement)(Muted, null, `${accessItems.length} \u6761`) },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Input, { value: accessForm.host, onChange: (value) => setAccessForm({ ...accessForm, host: value }), placeholder: "host\uFF08\u5FC5\u586B\uFF09", style: { minWidth: 140 } }),
      (0, import_react4.createElement)(Input, { value: accessForm.username, onChange: (value) => setAccessForm({ ...accessForm, username: value }), placeholder: "username", style: { minWidth: 120 } }),
      (0, import_react4.createElement)(Input, { value: accessForm.method, onChange: (value) => setAccessForm({ ...accessForm, method: value }), placeholder: "method\uFF08ssh/rdp/webshell\uFF09", style: { minWidth: 150 } }),
      (0, import_react4.createElement)(Input, { value: accessForm.privilege, onChange: (value) => setAccessForm({ ...accessForm, privilege: value }), placeholder: "privilege", style: { width: 110 } }),
      (0, import_react4.createElement)(Input, { value: accessForm.session_ref, onChange: (value) => setAccessForm({ ...accessForm, session_ref: value }), placeholder: "session_ref", style: { flex: 1, minWidth: 130 } }),
      (0, import_react4.createElement)(Btn, { variant: "primary", disabled: busy, onClick: submitAccess }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u65B0\u589E\u8BBF\u95EE")
    ),
    accessItems.length === 0 ? (0, import_react4.createElement)(Empty, null, "\u6682\u65E0\u8BBF\u95EE\u8BB0\u5F55") : (0, import_react4.createElement)(Table, {
      head: ["\u4E3B\u673A", "\u8D26\u53F7", "\u65B9\u5F0F", "\u6743\u9650", "\u4F1A\u8BDD\u5F15\u7528", "\u83B7\u5F97\u65F6\u95F4"],
      rows: accessItems.map((row) => [
        row.host || "\u2014",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.username || "\u2014"),
        row.method || "\u2014",
        row.privilege || "\u2014",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.session_ref || "\u2014"),
        fmt(row.obtained_at)
      ])
    })
  );
  const evidenceDetail = evidenceOpen ? evidenceItems.find((item) => String(item.ev_id ?? "") === evidenceOpen) : void 0;
  const evidenceView = () => (0, import_react4.createElement)(
    Card,
    { title: "\u8BC1\u636E\u8D26\u672C", actions: (0, import_react4.createElement)(Muted, null, `${evidenceItems.length} \u6761`) },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Input, {
        value: evidenceForm.operation,
        onChange: (value) => setEvidenceForm({ ...evidenceForm, operation: value }),
        placeholder: "operation\uFF08\u4F8B\u5982 nmap -sV\uFF09",
        style: { flex: 2, minWidth: 180 }
      }),
      (0, import_react4.createElement)(Select, {
        value: evidenceForm.confidence,
        options: CONFIDENCES.map((item) => ({ value: item, label: item })),
        onChange: (value) => setEvidenceForm({ ...evidenceForm, confidence: value }),
        style: { width: 120 }
      }),
      (0, import_react4.createElement)(Select, {
        value: evidenceForm.authority,
        options: AUTHORITIES.map((item) => ({ value: item, label: item })),
        onChange: (value) => setEvidenceForm({ ...evidenceForm, authority: value }),
        style: { width: 150 }
      }),
      (0, import_react4.createElement)(Btn, { variant: "primary", disabled: busy, onClick: submitEvidence }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u8BB0\u5F55\u8BC1\u636E")
    ),
    (0, import_react4.createElement)(TextArea, {
      value: evidenceForm.result,
      onChange: (value) => setEvidenceForm({ ...evidenceForm, result: value }),
      placeholder: 'result JSON\uFF0C\u4F8B\u5982 {"code":200,"body":"ok"}',
      rows: 4
    }),
    evidenceItems.length === 0 ? (0, import_react4.createElement)(Empty, null, "\u6682\u65E0\u8BC1\u636E") : (0, import_react4.createElement)(Table, {
      head: ["\u8BC1\u636E", "\u64CD\u4F5C", "\u7F6E\u4FE1", "\u6743\u5A01", "\u8BB0\u5F55\u65F6\u95F4", "\u8BE6\u60C5"],
      rows: evidenceItems.map((row) => [
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, shortId(row.ev_id)),
        row.operation || "\u2014",
        (0, import_react4.createElement)(Badge, { tone: confidenceTone(String(row.confidence ?? "")) }, row.confidence || "\u2014"),
        row.authority || "\u2014",
        fmt(row.recorded_at),
        (0, import_react4.createElement)(
          Btn,
          {
            onClick: () => setEvidenceOpen(evidenceOpen === String(row.ev_id ?? "") ? "" : String(row.ev_id ?? ""))
          },
          evidenceOpen === String(row.ev_id ?? "") ? "\u6536\u8D77" : "\u5C55\u5F00"
        )
      ])
    }),
    evidenceDetail ? (0, import_react4.createElement)(
      "div",
      { style: { marginTop: 8 } },
      (0, import_react4.createElement)(Muted, null, `params / result \xB7 ${shortId(evidenceDetail.ev_id)}`),
      (0, import_react4.createElement)("pre", { style: PRE_STYLE }, pretty({ parameters: evidenceDetail.parameters, result: evidenceDetail.result, limitations: evidenceDetail.limitations }))
    ) : null
  );
  const shotPreview = () => shotView ? (0, import_react4.createElement)(
    Card,
    {
      title: `\u622A\u56FE #${shotView.id}`,
      actions: (0, import_react4.createElement)(Btn, { onClick: () => setShotView(null) }, "\u5173\u95ED")
    },
    shotView.data ? (0, import_react4.createElement)("img", {
      src: `data:${shotView.mime};base64,${shotView.data}`,
      alt: `\u622A\u56FE #${shotView.id}`,
      style: { maxWidth: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", display: "block" }
    }) : (0, import_react4.createElement)(Empty, null, "\u622A\u56FE\u5185\u5BB9\u4E3A\u7A7A")
  ) : null;
  const shotsView = () => (0, import_react4.createElement)(
    Card,
    { title: "\u8BC1\u636E\u622A\u56FE", actions: (0, import_react4.createElement)(Muted, null, `${shotItems.length} \u5F20`) },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Input, {
        value: shotForm.label,
        onChange: (value) => setShotForm({ ...shotForm, label: value }),
        placeholder: "\u6807\u7B7E\uFF08\u4F8B\u5982 \u540E\u53F0\u6743\u9650\uFF09",
        style: { flex: 1, minWidth: 160 }
      }),
      (0, import_react4.createElement)(Select, {
        value: shotForm.kind,
        options: [
          { value: "screenshot", label: "screenshot" },
          { value: "card", label: "card" }
        ],
        onChange: (value) => setShotForm({ ...shotForm, kind: value }),
        style: { width: 120 }
      }),
      (0, import_react4.createElement)(Select, {
        value: shotForm.mime,
        options: [
          { value: "image/png", label: "image/png" },
          { value: "image/jpeg", label: "image/jpeg" }
        ],
        onChange: (value) => setShotForm({ ...shotForm, mime: value }),
        style: { width: 130 }
      }),
      (0, import_react4.createElement)(Btn, { variant: "primary", disabled: busy, onClick: submitShot }, busy ? "\u4E0A\u4F20\u4E2D\u2026" : "\u4E0A\u4F20\u622A\u56FE")
    ),
    (0, import_react4.createElement)(TextArea, {
      value: shotForm.data,
      onChange: (value) => setShotForm({ ...shotForm, data: value }),
      placeholder: "\u7C98\u8D34 base64\uFF08\u53EF\u5E26 data:image/png;base64, \u524D\u7F00\uFF0C\u670D\u52A1\u7AEF\u4F1A\u81EA\u52A8\u53BB\u6389\uFF09",
      rows: 4
    }),
    shotItems.length === 0 ? (0, import_react4.createElement)(Empty, null, "\u6682\u65E0\u622A\u56FE") : (0, import_react4.createElement)(Table, {
      head: ["ID", "\u6807\u7B7E", "\u6587\u4EF6", "\u7C7B\u578B", "\u5C3A\u5BF8", "\u65F6\u95F4", "\u67E5\u770B"],
      rows: shotItems.map((row) => [
        `#${row.id}`,
        row.label || "\u2014",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.file || "\u2014"),
        row.kind || "screenshot",
        row.width && row.height ? `${fmt(row.width)}\xD7${fmt(row.height)} \xB7 ${fmt(row.bytes)} B` : `${fmt(row.bytes)} B`,
        fmt(row.created_at ?? row.captured_at),
        (0, import_react4.createElement)(Btn, { disabled: shotLoadingId !== null, onClick: () => openShot(row) }, shotLoadingId === row.id ? "\u8BFB\u53D6\u4E2D\u2026" : "\u67E5\u770B")
      ])
    }),
    shotPreview()
  );
  const httpDetail = httpOpen === null ? void 0 : httpItems.find((item) => item.id === httpOpen);
  const httpView = () => (0, import_react4.createElement)(
    Card,
    { title: "HTTP \u8BC1\u636E", actions: (0, import_react4.createElement)(Muted, null, `${httpItems.length} \u6761`) },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Select, {
        value: httpForm.method,
        options: HTTP_METHODS.map((item) => ({ value: item, label: item })),
        onChange: (value) => setHttpForm({ ...httpForm, method: value }),
        style: { width: 100 }
      }),
      (0, import_react4.createElement)(Input, {
        value: httpForm.url,
        onChange: (value) => setHttpForm({ ...httpForm, url: value }),
        placeholder: "URL\uFF08\u5FC5\u586B\uFF09",
        style: { flex: 3, minWidth: 200 }
      }),
      (0, import_react4.createElement)(Input, {
        value: httpForm.status,
        onChange: (value) => setHttpForm({ ...httpForm, status: value }),
        placeholder: "status",
        type: "number",
        style: { width: 90 }
      }),
      (0, import_react4.createElement)(Input, {
        value: httpForm.label,
        onChange: (value) => setHttpForm({ ...httpForm, label: value }),
        placeholder: "label",
        style: { width: 130 }
      }),
      (0, import_react4.createElement)(Btn, { variant: "primary", disabled: busy, onClick: submitHttp }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u65B0\u589E HTTP \u8BC1\u636E")
    ),
    (0, import_react4.createElement)(
      "div",
      { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } },
      (0, import_react4.createElement)(TextArea, {
        value: httpForm.request,
        onChange: (value) => setHttpForm({ ...httpForm, request: value }),
        placeholder: "\u539F\u59CB\u8BF7\u6C42\uFF08\u53EF\u76F4\u63A5\u7C98\u8D34\u8FDB Burp\uFF09",
        rows: 4
      }),
      (0, import_react4.createElement)(TextArea, {
        value: httpForm.response,
        onChange: (value) => setHttpForm({ ...httpForm, response: value }),
        placeholder: "\u539F\u59CB\u54CD\u5E94",
        rows: 4
      })
    ),
    httpItems.length === 0 ? (0, import_react4.createElement)(Empty, null, "\u6682\u65E0 HTTP \u8BC1\u636E") : (0, import_react4.createElement)(Table, {
      head: ["ID", "\u65B9\u6CD5", "URL", "\u72B6\u6001", "\u6807\u7B7E", "\u65F6\u95F4", "\u8BE6\u60C5"],
      rows: httpItems.map((row) => [
        `#${row.id}`,
        row.method || "GET",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.url || "\u2014"),
        (0, import_react4.createElement)(Badge, { tone: httpTone(row.status) }, fmt(row.status)),
        row.label || "\u2014",
        fmt(row.captured_at),
        (0, import_react4.createElement)(Btn, { onClick: () => setHttpOpen(httpOpen === row.id ? null : row.id) }, httpOpen === row.id ? "\u6536\u8D77" : "\u5C55\u5F00")
      ])
    }),
    httpDetail ? (0, import_react4.createElement)(
      "div",
      { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 } },
      (0, import_react4.createElement)(Muted, null, `#${httpDetail.id} ${httpDetail.method ?? "GET"} ${httpDetail.url ?? ""}`),
      (0, import_react4.createElement)("pre", { style: PRE_STYLE }, `\u2500\u2500 request \u2500\u2500
${httpDetail.request ?? ""}

\u2500\u2500 response \u2500\u2500
${httpDetail.response ?? ""}`)
    ) : null
  );
  const filesView = () => (0, import_react4.createElement)(
    Card,
    { title: "\u653B\u51FB\u6587\u4EF6", actions: (0, import_react4.createElement)(Muted, null, `${fileItems.length} \u4E2A`) },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Input, {
        value: fileForm.target,
        onChange: (value) => setFileForm({ ...fileForm, target: value }),
        placeholder: "target\uFF08\u5FC5\u586B\uFF09",
        style: { minWidth: 150 }
      }),
      (0, import_react4.createElement)(Input, {
        value: fileForm.name,
        onChange: (value) => setFileForm({ ...fileForm, name: value }),
        placeholder: "\u6587\u4EF6\u540D\uFF08\u5FC5\u586B\uFF09",
        style: { minWidth: 150 }
      }),
      (0, import_react4.createElement)(Input, {
        value: fileForm.kind,
        onChange: (value) => setFileForm({ ...fileForm, kind: value }),
        placeholder: "kind\uFF08poc/exp/script\uFF09",
        style: { width: 160 }
      }),
      (0, import_react4.createElement)(Input, {
        value: fileForm.description,
        onChange: (value) => setFileForm({ ...fileForm, description: value }),
        placeholder: "\u8BF4\u660E",
        style: { flex: 1, minWidth: 130 }
      }),
      (0, import_react4.createElement)(Btn, { variant: "primary", disabled: busy, onClick: submitFile }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u5F52\u6863\u6587\u4EF6")
    ),
    (0, import_react4.createElement)(TextArea, {
      value: fileForm.content,
      onChange: (value) => setFileForm({ ...fileForm, content: value }),
      placeholder: "\u6587\u4EF6\u6B63\u6587\uFF08\u811A\u672C/POC \u539F\u6587\uFF09",
      rows: 5
    }),
    fileItems.length === 0 ? (0, import_react4.createElement)(Empty, null, "\u6682\u65E0\u653B\u51FB\u6587\u4EF6") : (0, import_react4.createElement)(Table, {
      head: ["ID", "\u76EE\u6807", "\u540D\u79F0", "\u7C7B\u578B", "\u8DEF\u5F84", "\u8BF4\u660E", "\u65F6\u95F4"],
      rows: fileItems.map((row) => [
        `#${row.id}`,
        row.target || "\u2014",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.name || "\u2014"),
        row.kind || "\u2014",
        (0, import_react4.createElement)("span", { style: MONO_STYLE }, row.path || "\u2014"),
        row.description || "\u2014",
        fmt(row.created_at)
      ])
    })
  );
  const body = () => {
    switch (view) {
      case "vulns":
        return vulnView();
      case "creds":
        return credView();
      case "access":
        return accessView();
      case "evidence":
        return evidenceView();
      case "shots":
        return shotsView();
      case "http":
        return httpView();
      case "files":
        return filesView();
      default:
        return (0, import_react4.createElement)(Empty, null);
    }
  };
  return (0, import_react4.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    (0, import_react4.createElement)(
      Toolbar,
      null,
      (0, import_react4.createElement)(Btn, { onClick: () => void load(), disabled: loading }, loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"),
      (0, import_react4.createElement)(Muted, null, `\u9776\u6807 ${eng}`)
    ),
    statsCard(),
    viewTabs(),
    body()
  );
}

// src/client/pages/sessions.ts
var import_react5 = require("react");
var SHELL_STATUSES = ["online", "offline", "unknown"];
var TUNNEL_STATUSES = ["active", "down", "unknown"];
var SHELL_TYPES = ["php", "jsp", "aspx", "ashx", "suo5", "behinder", "godzilla"];
var MONO_STYLE2 = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", wordBreak: "break-all" };
var PROBE_PRE_STYLE = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 220,
  overflow: "auto",
  margin: 0,
  padding: "6px 8px",
  fontSize: 11,
  lineHeight: 1.5,
  borderRadius: 8,
  background: "rgba(0,0,0,.24)",
  fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace"
};
function check2(data) {
  if (data.ok === false) throw new Error(data.error || "\u63A5\u53E3\u8FD4\u56DE\u5931\u8D25");
  return data;
}
function shellTone(status) {
  if (status === "online") return "ok";
  if (status === "offline") return "bad";
  if (status === "unknown") return "warn";
  return void 0;
}
function tunnelTone(status) {
  if (status === "active") return "ok";
  if (status === "down") return "bad";
  if (status === "unknown") return "warn";
  return void 0;
}
function probeNote(text) {
  const value = String(text ?? "").trim();
  return value === "" ? "\u2014" : value;
}
function SessionsPage(props) {
  const eng = props.engagement ?? "";
  const notify = props.notify;
  const refresh = props.refresh;
  const [loading, setLoading] = (0, import_react5.useState)(false);
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const [probing, setProbing] = (0, import_react5.useState)(false);
  const [data, setData] = (0, import_react5.useState)(null);
  const [probe, setProbe] = (0, import_react5.useState)(null);
  const [probeRaw, setProbeRaw] = (0, import_react5.useState)(false);
  const [shellForm, setShellForm] = (0, import_react5.useState)({ url: "", pass_key: "", shell_type: "php" });
  const [tunnelForm, setTunnelForm] = (0, import_react5.useState)({ kind: "socks5", listen: "", entry: "", entry_kind: "target-outbound" });
  const workingRef = (0, import_react5.useRef)(false);
  const probeRef = (0, import_react5.useRef)(false);
  const load = (0, import_react5.useCallback)(async () => {
    if (!eng) return;
    setLoading(true);
    try {
      const result = check2(await redteam.sessions(eng));
      setData({ webshells: result.webshells ?? [], tunnels: result.tunnels ?? [], totals: result.totals ?? {} });
    } catch (error) {
      notify(errorText(error), "bad");
    } finally {
      setLoading(false);
    }
  }, [eng, notify]);
  (0, import_react5.useEffect)(() => {
    void load();
  }, [load]);
  const run = (0, import_react5.useCallback)(
    async (work) => {
      if (!eng) {
        notify("\u8BF7\u5148\u521B\u5EFA\u6216\u9009\u62E9\u9776\u6807", "bad");
        return;
      }
      if (workingRef.current) return;
      workingRef.current = true;
      setBusy(true);
      try {
        await work();
        await load();
        refresh();
      } catch (error) {
        notify(errorText(error), "bad");
      } finally {
        workingRef.current = false;
        setBusy(false);
      }
    },
    [eng, load, notify, refresh]
  );
  const addShell = () => {
    const url = shellForm.url.trim();
    if (!url) {
      notify("WebShell URL \u5FC5\u586B", "bad");
      return;
    }
    void run(async () => {
      check2(
        await redteam.addWebshell(eng, {
          url,
          pass_key: shellForm.pass_key.trim() || null,
          shell_type: shellForm.shell_type,
          status: "unknown"
        })
      );
      setShellForm({ url: "", pass_key: "", shell_type: "php" });
      notify("WebShell \u5DF2\u767B\u8BB0");
    });
  };
  const setShellStatus = (row, status) => {
    void run(async () => {
      check2(
        await redteam.updateWebshell(eng, row.id, {
          status,
          last_check: (/* @__PURE__ */ new Date()).toISOString(),
          check_note: row.check_note ?? null,
          latency_ms: row.latency_ms ?? null
        })
      );
      notify(`WebShell #${row.id} \u2192 ${status}`);
    });
  };
  const addTunnel = () => {
    const listen = tunnelForm.listen.trim();
    if (!listen) {
      notify("\u96A7\u9053 listen \u5FC5\u586B", "bad");
      return;
    }
    void run(async () => {
      check2(
        await redteam.addTunnel(eng, {
          kind: tunnelForm.kind.trim() || null,
          listen,
          entry: tunnelForm.entry.trim() || null,
          entry_kind: tunnelForm.entry_kind.trim() || null,
          status: "unknown"
        })
      );
      setTunnelForm({ kind: "socks5", listen: "", entry: "", entry_kind: "target-outbound" });
      notify("\u96A7\u9053\u5DF2\u767B\u8BB0");
    });
  };
  const setTunnelStatus = (row, status) => {
    void run(async () => {
      check2(
        await redteam.updateTunnel(eng, row.id, {
          status,
          last_check: (/* @__PURE__ */ new Date()).toISOString(),
          check_note: row.check_note ?? null,
          latency_ms: row.latency_ms ?? null
        })
      );
      notify(`\u96A7\u9053 #${row.id} \u2192 ${status}`);
    });
  };
  const probeNow = () => {
    if (!eng || probeRef.current) return;
    probeRef.current = true;
    setProbing(true);
    void (async () => {
      try {
        const result = check2(await redteam.probe(eng));
        setProbe({
          webshells: result.webshells ?? [],
          tunnels: result.tunnels ?? [],
          checkedAt: result.checkedAt,
          note: result.note
        });
        notify("\u8FDE\u901A\u6027\u5B9E\u6D4B\u5B8C\u6210");
        await load();
        refresh();
      } catch (error) {
        notify(errorText(error), "bad");
      } finally {
        probeRef.current = false;
        setProbing(false);
      }
    })();
  };
  if (!eng) {
    return (0, import_react5.createElement)(
      Card,
      { title: "\u8FD8\u6CA1\u6709\u9776\u6807" },
      (0, import_react5.createElement)(Muted, null, "\u5148\u5728\u4E0A\u65B9\u521B\u5EFA\u6216\u9009\u62E9\u9776\u6807\uFF0C\u518D\u767B\u8BB0 WebShell\u3001\u96A7\u9053\u5E76\u505A\u8FDE\u901A\u6027\u5B9E\u6D4B\u3002"),
      (0, import_react5.createElement)(Empty, null, "\u6682\u65E0\u6570\u636E")
    );
  }
  const totals = data?.totals ?? {};
  const shells = data?.webshells ?? [];
  const tunnels = data?.tunnels ?? [];
  const overview = () => (0, import_react5.createElement)(
    Card,
    { title: "\u4F1A\u8BDD\u6982\u89C8", actions: (0, import_react5.createElement)(Muted, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : `\u9776\u6807 ${eng}`) },
    (0, import_react5.createElement)(
      Toolbar,
      null,
      (0, import_react5.createElement)(Badge, null, `WebShell ${fmt(totals.webshells ?? 0)}`),
      (0, import_react5.createElement)(Badge, { tone: (totals.webshellsOnline ?? 0) > 0 ? "ok" : void 0 }, `\u5728\u7EBF ${fmt(totals.webshellsOnline ?? 0)}`),
      (0, import_react5.createElement)(Badge, null, `\u96A7\u9053 ${fmt(totals.tunnels ?? 0)}`),
      (0, import_react5.createElement)(Badge, { tone: (totals.tunnelsActive ?? 0) > 0 ? "ok" : void 0 }, `\u6D3B\u8DC3 ${fmt(totals.tunnelsActive ?? 0)}`),
      (0, import_react5.createElement)(Badge, { tone: (totals.tunnelsLegit ?? 0) > 0 ? "ok" : "warn" }, `\u5408\u89C4\u5165\u53E3 ${fmt(totals.tunnelsLegit ?? 0)}`),
      (0, import_react5.createElement)(Badge, null, `\u51ED\u636E ${fmt(totals.credentials ?? 0)}`),
      (0, import_react5.createElement)(Badge, null, `\u8BBF\u95EE ${fmt(totals.accesses ?? 0)}`)
    ),
    (0, import_react5.createElement)(Muted, null, "\u5408\u89C4\u5165\u53E3 = entry_kind \u4E3A target-outbound / target-http / target-agent \u7684\u96A7\u9053\uFF1B\u5176\u4F59\u5C5E\u4E8E\u81EA\u5EFA\u51FA\u5165\u53E3\u3002")
  );
  const shellsCard = () => (0, import_react5.createElement)(
    Card,
    { title: "WebShell", actions: (0, import_react5.createElement)(Muted, null, `${shells.length} \u4E2A`) },
    (0, import_react5.createElement)(
      Toolbar,
      null,
      (0, import_react5.createElement)(Input, {
        value: shellForm.url,
        onChange: (value) => setShellForm({ ...shellForm, url: value }),
        placeholder: "URL\uFF08\u5FC5\u586B\uFF0C\u4F8B\u5982 http://t/shell.php\uFF09",
        style: { flex: 3, minWidth: 220 }
      }),
      (0, import_react5.createElement)(Input, {
        value: shellForm.pass_key,
        onChange: (value) => setShellForm({ ...shellForm, pass_key: value }),
        placeholder: "pass_key",
        style: { width: 130 }
      }),
      (0, import_react5.createElement)(Select, {
        value: shellForm.shell_type,
        options: SHELL_TYPES.map((item) => ({ value: item, label: item })),
        onChange: (value) => setShellForm({ ...shellForm, shell_type: value }),
        style: { width: 120 }
      }),
      (0, import_react5.createElement)(Btn, { variant: "primary", disabled: busy, onClick: addShell }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u767B\u8BB0 WebShell")
    ),
    shells.length === 0 ? (0, import_react5.createElement)(Empty, null, "\u6682\u65E0 WebShell") : (0, import_react5.createElement)(Table, {
      head: ["ID", "URL", "\u7C7B\u578B", "\u72B6\u6001", "\u5EF6\u8FDF", "\u6700\u8FD1\u68C0\u67E5", "\u5907\u6CE8", "\u5207\u6362\u72B6\u6001"],
      rows: shells.map((row) => [
        `#${row.id}`,
        (0, import_react5.createElement)("span", { style: MONO_STYLE2 }, row.url || "\u2014"),
        row.shell_type || "\u2014",
        (0, import_react5.createElement)(Badge, { tone: shellTone(String(row.status ?? "")) }, row.status || "unknown"),
        row.latency_ms === null || row.latency_ms === void 0 ? "\u2014" : `${fmt(row.latency_ms)} ms`,
        fmt(row.last_check),
        probeNote(row.check_note ?? row.note ?? ""),
        (0, import_react5.createElement)(Select, {
          value: String(row.status ?? "unknown"),
          options: SHELL_STATUSES.map((item) => ({ value: item, label: item })),
          style: { width: 110 },
          onChange: (value) => setShellStatus(row, value)
        })
      ])
    })
  );
  const tunnelsCard = () => (0, import_react5.createElement)(
    Card,
    { title: "\u96A7\u9053", actions: (0, import_react5.createElement)(Muted, null, `${tunnels.length} \u6761`) },
    (0, import_react5.createElement)(
      Toolbar,
      null,
      (0, import_react5.createElement)(Input, {
        value: tunnelForm.kind,
        onChange: (value) => setTunnelForm({ ...tunnelForm, kind: value }),
        placeholder: "kind\uFF08socks5/suo5/ssh -R/frp\uFF09",
        style: { width: 190 }
      }),
      (0, import_react5.createElement)(Input, {
        value: tunnelForm.listen,
        onChange: (value) => setTunnelForm({ ...tunnelForm, listen: value }),
        placeholder: "listen\uFF08127.0.0.1:1080\uFF0C\u5FC5\u586B\uFF09",
        style: { flex: 2, minWidth: 190 }
      }),
      (0, import_react5.createElement)(Input, {
        value: tunnelForm.entry,
        onChange: (value) => setTunnelForm({ ...tunnelForm, entry: value }),
        placeholder: "entry\uFF08\u5165\u53E3\u5730\u5740\uFF09",
        style: { flex: 1, minWidth: 150 }
      }),
      (0, import_react5.createElement)(Select, {
        value: tunnelForm.entry_kind,
        options: [
          { value: "target-outbound", label: "target-outbound\uFF08\u5408\u89C4\uFF09" },
          { value: "target-http", label: "target-http\uFF08\u5408\u89C4\uFF09" },
          { value: "target-agent", label: "target-agent\uFF08\u5408\u89C4\uFF09" },
          { value: "self-build", label: "self-build\uFF08\u81EA\u5EFA\uFF09" }
        ],
        onChange: (value) => setTunnelForm({ ...tunnelForm, entry_kind: value }),
        style: { width: 200 }
      }),
      (0, import_react5.createElement)(Btn, { variant: "primary", disabled: busy, onClick: addTunnel }, busy ? "\u5199\u5165\u4E2D\u2026" : "\u767B\u8BB0\u96A7\u9053")
    ),
    tunnels.length === 0 ? (0, import_react5.createElement)(Empty, null, "\u6682\u65E0\u96A7\u9053") : (0, import_react5.createElement)(Table, {
      head: ["ID", "\u7C7B\u578B", "\u76D1\u542C", "\u5165\u53E3", "\u51FA\u5165\u53E3\u7C7B\u578B", "\u72B6\u6001", "\u5EF6\u8FDF", "\u6700\u8FD1\u68C0\u67E5", "\u5207\u6362\u72B6\u6001"],
      rows: tunnels.map((row) => [
        `#${row.id}`,
        row.kind || "\u2014",
        (0, import_react5.createElement)("span", { style: MONO_STYLE2 }, row.listen || "\u2014"),
        (0, import_react5.createElement)("span", { style: MONO_STYLE2 }, row.entry || "\u2014"),
        row.entry_kind || "\u2014",
        (0, import_react5.createElement)(Badge, { tone: tunnelTone(String(row.status ?? "")) }, row.status || "unknown"),
        row.latency_ms === null || row.latency_ms === void 0 ? "\u2014" : `${fmt(row.latency_ms)} ms`,
        fmt(row.last_check),
        (0, import_react5.createElement)(Select, {
          value: String(row.status ?? "unknown"),
          options: TUNNEL_STATUSES.map((item) => ({ value: item, label: item })),
          style: { width: 110 },
          onChange: (value) => setTunnelStatus(row, value)
        })
      ])
    })
  );
  const probeCard = () => (0, import_react5.createElement)(
    Card,
    {
      title: "\u8FDE\u901A\u6027\u5B9E\u6D4B",
      actions: (0, import_react5.createElement)(
        Toolbar,
        null,
        (0, import_react5.createElement)(Muted, null, probe?.checkedAt ? `\u4E0A\u6B21 ${probe.checkedAt}` : "\u5C1A\u672A\u5B9E\u6D4B"),
        probe ? (0, import_react5.createElement)(Btn, { onClick: () => setProbeRaw(!probeRaw) }, probeRaw ? "\u6536\u8D77\u539F\u59CB" : "\u539F\u59CB\u8FD4\u56DE") : null,
        (0, import_react5.createElement)(Btn, { variant: "primary", disabled: probing || busy, onClick: probeNow }, probing ? "\u5B9E\u6D4B\u4E2D\u2026" : "\u8FDE\u901A\u6027\u5B9E\u6D4B")
      )
    },
    probe?.note ? (0, import_react5.createElement)(Muted, null, probe.note) : null,
    probe === null ? (0, import_react5.createElement)(Muted, null, "\u70B9\u300C\u8FDE\u901A\u6027\u5B9E\u6D4B\u300D\u4F1A\u9010\u4E2A\u8BF7\u6C42 WebShell \u5E76 TCP \u8FDE\u63A5\u96A7\u9053\u76D1\u542C\u5730\u5740\uFF0C\u7ED3\u679C\u540C\u65F6\u56DE\u5199\u4F1A\u8BDD\u72B6\u6001\u3002") : (0, import_react5.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      (probe.webshells ?? []).length === 0 ? (0, import_react5.createElement)(Empty, null, "\u6CA1\u6709\u53EF\u63A2\u6D4B\u7684 WebShell") : (0, import_react5.createElement)(Table, {
        head: ["WebShell", "URL", "\u72B6\u6001", "\u8BF4\u660E", "\u5EF6\u8FDF"],
        rows: (probe.webshells ?? []).map((row) => [
          `#${row.id}`,
          (0, import_react5.createElement)("span", { style: MONO_STYLE2 }, row.url || "\u2014"),
          (0, import_react5.createElement)(Badge, { tone: shellTone(String(row.status ?? "")) }, row.status || "unknown"),
          probeNote(row.note),
          row.latency_ms === void 0 ? "\u2014" : `${fmt(row.latency_ms)} ms`
        ])
      }),
      (probe.tunnels ?? []).length === 0 ? (0, import_react5.createElement)(Empty, null, "\u6CA1\u6709\u53EF\u63A2\u6D4B\u7684\u96A7\u9053") : (0, import_react5.createElement)(Table, {
        head: ["\u96A7\u9053", "\u7C7B\u578B", "\u76D1\u542C", "\u72B6\u6001", "\u8BF4\u660E", "\u5EF6\u8FDF"],
        rows: (probe.tunnels ?? []).map((row) => [
          `#${row.id}`,
          row.kind || "\u2014",
          (0, import_react5.createElement)("span", { style: MONO_STYLE2 }, row.listen || "\u2014"),
          (0, import_react5.createElement)(Badge, { tone: tunnelTone(String(row.status ?? "")) }, row.status || "unknown"),
          probeNote(row.note),
          row.latency_ms === void 0 ? "\u2014" : `${fmt(row.latency_ms)} ms`
        ])
      }),
      probeRaw ? (0, import_react5.createElement)("pre", { style: PROBE_PRE_STYLE }, JSON.stringify(probe, null, 2)) : null
    )
  );
  return (0, import_react5.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    (0, import_react5.createElement)(
      Toolbar,
      null,
      (0, import_react5.createElement)(Btn, { onClick: () => void load(), disabled: loading }, loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"),
      (0, import_react5.createElement)(Muted, null, `\u9776\u6807 ${eng}`)
    ),
    overview(),
    shellsCard(),
    tunnelsCard(),
    probeCard()
  );
}

// src/client/pages/agents.ts
var import_react6 = require("react");
var MONO_STYLE3 = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", wordBreak: "break-all" };
function check3(data) {
  if (data.ok === false) throw new Error(data.error || "\u63A5\u53E3\u8FD4\u56DE\u5931\u8D25");
  return data;
}
function AgentsPage(props) {
  const eng = props.engagement ?? "";
  const notify = props.notify;
  const refresh = props.refresh;
  const [loading, setLoading] = (0, import_react6.useState)(false);
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [roles, setRoles] = (0, import_react6.useState)([]);
  const [roleId, setRoleId] = (0, import_react6.useState)("");
  const [content, setContent] = (0, import_react6.useState)("");
  const [savedContent, setSavedContent] = (0, import_react6.useState)("");
  const saveRef = (0, import_react6.useRef)(false);
  const roleRef = (0, import_react6.useRef)("");
  (0, import_react6.useEffect)(() => {
    roleRef.current = roleId;
  }, [roleId]);
  const load = (0, import_react6.useCallback)(async () => {
    if (!eng) return;
    setLoading(true);
    try {
      const result = check3(await redteam.prompts(eng));
      const list = result.roles ?? [];
      const keep = list.some((item) => item.role === roleRef.current) ? roleRef.current : list[0]?.role ?? "";
      const hit = list.find((item) => item.role === keep);
      setRoles(list);
      setRoleId(keep);
      roleRef.current = keep;
      setContent(hit?.content ?? "");
      setSavedContent(hit?.content ?? "");
    } catch (error) {
      notify(errorText(error), "bad");
    } finally {
      setLoading(false);
    }
  }, [eng, notify]);
  (0, import_react6.useEffect)(() => {
    void load();
  }, [load]);
  const current = (0, import_react6.useMemo)(() => roles.find((item) => item.role === roleId), [roles, roleId]);
  const dirty = content !== savedContent;
  const pickRole = (value) => {
    if (busy) return;
    setRoleId(value);
    roleRef.current = value;
    const hit = roles.find((item) => item.role === value);
    setContent(hit?.content ?? "");
    setSavedContent(hit?.content ?? "");
  };
  const save = () => {
    if (!eng) {
      notify("\u8BF7\u5148\u521B\u5EFA\u6216\u9009\u62E9\u9776\u6807", "bad");
      return;
    }
    if (!roleId) {
      notify("\u8BF7\u5148\u9009\u62E9\u89D2\u8272", "bad");
      return;
    }
    if (saveRef.current) return;
    saveRef.current = true;
    setBusy(true);
    void (async () => {
      try {
        const result = check3(await redteam.savePrompt(eng, roleId, content));
        setSavedContent(content);
        setRoles((prev) => prev.map((item) => item.role === roleId ? { ...item, content, updated_at: (/* @__PURE__ */ new Date()).toISOString() } : item));
        notify(`\u89D2\u8272 ${result.role ?? roleId} \u63D0\u793A\u8BCD\u5DF2\u4FDD\u5B58`);
        refresh();
      } catch (error) {
        notify(errorText(error), "bad");
      } finally {
        saveRef.current = false;
        setBusy(false);
      }
    })();
  };
  if (!eng) {
    return (0, import_react6.createElement)(
      Card,
      { title: "\u8FD8\u6CA1\u6709\u9776\u6807" },
      (0, import_react6.createElement)(Muted, null, "\u667A\u80FD\u4F53\u63D0\u793A\u8BCD\u4E0E\u9776\u6807\u7ED1\u5B9A\uFF0C\u5148\u5728\u4E0A\u65B9\u521B\u5EFA\u6216\u9009\u62E9\u9776\u6807\u3002"),
      (0, import_react6.createElement)(Empty, null, "\u6682\u65E0\u6570\u636E")
    );
  }
  const roleOptions = roles.map((item) => ({
    value: item.role,
    label: item.title ? `${item.role} \xB7 ${item.title}` : item.role
  }));
  const gateCard = () => (0, import_react6.createElement)(
    Card,
    { title: "\u5E76\u53D1\u95F8\u95E8" },
    (0, import_react6.createElement)(Toolbar, null, (0, import_react6.createElement)(Badge, { tone: "warn" }, "\u5E76\u53D1\u4E0A\u9650 3"), (0, import_react6.createElement)(Muted, null, "settings.json maxAgents \u53EF\u6539")),
    (0, import_react6.createElement)(Muted, null, "\u6700\u591A 3 \u4E2A\u6267\u884C\u667A\u80FD\u4F53\uFF08settings.json maxAgents \u53EF\u6539\uFF09\uFF1A\u89C4\u5212\u5668\u8D1F\u8D23\u62C6\u89E3\u4EFB\u52A1\uFF0C\u6267\u884C\u667A\u80FD\u4F53\u5E76\u884C\u843D\u5730\uFF0C\u8D85\u51FA\u95F8\u95E8\u7684\u6D3E\u53D1\u4F1A\u88AB\u6392\u961F\u6216\u62D2\u7EDD\u3002")
  );
  const bindCard = () => (0, import_react6.createElement)(
    Card,
    { title: "\u4F1A\u8BDD\u7ED1\u5B9A" },
    (0, import_react6.createElement)(Toolbar, null, (0, import_react6.createElement)(Badge, null, "\u5F53\u524D\u9776\u6807"), (0, import_react6.createElement)("span", { style: MONO_STYLE3 }, eng)),
    (0, import_react6.createElement)(Muted, null, `\u63D0\u793A\u8BCD\u843D\u76D8\u4F4D\u7F6E\uFF1A<\u9776\u6807\u76EE\u5F55>/agents/<role>.md\uFF08\u9776\u6807 ${eng}\uFF09\u3002`)
  );
  const roleTable = () => (0, import_react6.createElement)(
    Card,
    { title: "\u89D2\u8272\u6E05\u5355", actions: (0, import_react6.createElement)(Muted, null, `${roles.length} \u4E2A`) },
    roles.length === 0 ? (0, import_react6.createElement)(Empty, null, "\u6682\u65E0\u89D2\u8272\u63D0\u793A\u8BCD") : (0, import_react6.createElement)(Table, {
      head: ["\u89D2\u8272", "\u6807\u9898", "\u7C7B\u578B", "\u66F4\u65B0\u65F6\u95F4", "\u7F16\u8F91"],
      rows: roles.map((item) => [
        (0, import_react6.createElement)("span", { style: MONO_STYLE3 }, item.role),
        item.title || "\u2014",
        item.planner ? (0, import_react6.createElement)(Badge, { tone: "warn" }, "planner") : (0, import_react6.createElement)(Badge, null, "\u6267\u884C"),
        fmt(item.updated_at),
        (0, import_react6.createElement)(Btn, { disabled: busy, onClick: () => pickRole(item.role) }, item.role === roleId ? "\u7F16\u8F91\u4E2D" : "\u7F16\u8F91")
      ])
    })
  );
  const editorCard = () => (0, import_react6.createElement)(
    Card,
    {
      title: "\u89D2\u8272\u63D0\u793A\u8BCD",
      actions: (0, import_react6.createElement)(
        Toolbar,
        null,
        dirty ? (0, import_react6.createElement)(Badge, { tone: "warn" }, "\u672A\u4FDD\u5B58") : (0, import_react6.createElement)(Badge, { tone: "ok" }, "\u5DF2\u540C\u6B65"),
        (0, import_react6.createElement)(Btn, { onClick: () => void load(), disabled: loading }, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u5237\u65B0")
      )
    },
    (0, import_react6.createElement)(
      Toolbar,
      null,
      (0, import_react6.createElement)(Select, {
        value: roleId,
        options: roleOptions.length > 0 ? roleOptions : [{ value: "", label: "\uFF08\u65E0\u89D2\u8272\uFF09" }],
        onChange: pickRole,
        style: { minWidth: 220 }
      }),
      current?.planner ? (0, import_react6.createElement)(Badge, { tone: "warn" }, "\u89C4\u5212\u5668") : (0, import_react6.createElement)(Badge, null, "\u6267\u884C\u667A\u80FD\u4F53"),
      (0, import_react6.createElement)(Muted, null, `\u66F4\u65B0\u65F6\u95F4 ${fmt(current?.updated_at)}`),
      (0, import_react6.createElement)(Btn, { variant: "primary", disabled: busy || !roleId, onClick: save }, busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58")
    ),
    (0, import_react6.createElement)(TextArea, {
      value: content,
      onChange: (value) => setContent(value),
      placeholder: roleId ? `\u89D2\u8272 ${roleId} \u7684\u63D0\u793A\u8BCD\uFF08Markdown\uFF09` : "\u5148\u9009\u62E9\u89D2\u8272",
      rows: 18
    }),
    (0, import_react6.createElement)(Muted, null, `\u6062\u590D\u9ED8\u8BA4\uFF1A\u672C\u9875\u4E0D\u63D0\u4F9B\u4E00\u952E\u91CD\u7F6E\u3002\u5220\u9664\u6216\u6E05\u7A7A <\u9776\u6807\u76EE\u5F55>/agents/${roleId || "<role>"}.md \u540E\u70B9\u5237\u65B0\uFF08\u6216\u91CD\u5F00\u9776\u6807\u9762\u677F\uFF09\u5373\u56DE\u5230\u5185\u7F6E\u9ED8\u8BA4\u6587\u672C\u3002`)
  );
  return (0, import_react6.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    (0, import_react6.createElement)(Toolbar, null, (0, import_react6.createElement)(Muted, null, `\u9776\u6807 ${eng}`), dirty ? (0, import_react6.createElement)(Badge, { tone: "warn" }, "\u6709\u672A\u4FDD\u5B58\u6539\u52A8") : null),
    gateCard(),
    bindCard(),
    editorCard(),
    roleTable()
  );
}

// src/client/pages/chain.ts
var import_react7 = require("react");
var MONO2 = "ui-monospace,SFMono-Regular,Menlo,monospace";
var STAGES = [
  { value: "recon", label: "\u4FE1\u606F\u6536\u96C6" },
  { value: "assess", label: "\u8D44\u4EA7\u8BC4\u4F30" },
  { value: "vuln-scan", label: "\u6F0F\u6D1E\u53D1\u73B0" },
  { value: "exploit", label: "\u6F0F\u6D1E\u5229\u7528" },
  { value: "internal", label: "\u5185\u7F51\u6E17\u900F" },
  { value: "boundary", label: "\u8FB9\u754C\u7A81\u7834" }
];
var STAGE_LABEL = Object.fromEntries(STAGES.map((stage) => [stage.value, stage.label]));
var STAGE_COLOR = {
  recon: "#38bdf8",
  assess: "#a78bfa",
  "vuln-scan": "#fbbf24",
  exploit: "#f87171",
  internal: "#34d399",
  boundary: "#fb923c"
};
var KIND_LABEL = {
  asset: "\u8D44\u4EA7",
  vuln: "\u6F0F\u6D1E",
  step: "\u6B65\u9AA4",
  segment: "\u7F51\u6BB5",
  port: "\u7AEF\u53E3",
  domain: "\u57DF\u540D"
};
var RELATION_LABEL = {
  has: "\u5B58\u5728\u6F0F\u6D1E",
  leads: "\u63A8\u8FDB\u5230",
  contains: "\u5305\u542B",
  exposes: "\u66B4\u9732",
  resolves: "\u89E3\u6790\u5230"
};
function unwrap(data) {
  if (data === null || data === void 0) throw new Error("\u63A5\u53E3\u8FD4\u56DE\u4E3A\u7A7A");
  if (data.ok === false) throw new Error(data.error ?? "\u8BF7\u6C42\u5931\u8D25");
  return data;
}
function metaText2(meta) {
  if (!meta) return "\u2014";
  const parts = Object.entries(meta).filter(([, value]) => value !== null && value !== void 0 && value !== "").map(([key, value]) => `${key}=${String(value)}`);
  return parts.length ? parts.join(" \xB7 ") : "\u2014";
}
function ChainPage(props) {
  const { engagement, notify, refresh } = props;
  const [steps, setSteps] = (0, import_react7.useState)([]);
  const [nodes, setNodes] = (0, import_react7.useState)([]);
  const [edges, setEdges] = (0, import_react7.useState)([]);
  const [codes, setCodes] = (0, import_react7.useState)([]);
  const [loading, setLoading] = (0, import_react7.useState)(false);
  const [saving, setSaving] = (0, import_react7.useState)(false);
  const [error, setError] = (0, import_react7.useState)(null);
  const [reloadKey, setReloadKey] = (0, import_react7.useState)(0);
  const [title, setTitle] = (0, import_react7.useState)("");
  const [stage, setStage] = (0, import_react7.useState)("recon");
  const [seq, setSeq] = (0, import_react7.useState)("");
  const [detail, setDetail] = (0, import_react7.useState)("");
  const [pointCode, setPointCode] = (0, import_react7.useState)("");
  const [evidence, setEvidence] = (0, import_react7.useState)("");
  const load = (0, import_react7.useCallback)(async () => {
    if (!engagement) {
      setSteps([]);
      setNodes([]);
      setEdges([]);
      setCodes([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [chainData, graphData] = await Promise.all([
        redteam.chain(engagement),
        redteam.attackGraph(engagement)
      ]);
      setSteps(unwrap(chainData).items ?? []);
      const graph = unwrap(graphData);
      setNodes(graph.nodes ?? []);
      setEdges(graph.edges ?? []);
    } catch (err) {
      const text = errorText(err);
      setError(text);
      notify(text, "bad");
    } finally {
      setLoading(false);
    }
    try {
      const data = unwrap(await redteam.scores(engagement));
      setCodes((data.items ?? []).map((item) => ({ code: item.code, id: item.id, name: item.name })));
    } catch {
      setCodes([]);
    }
  }, [engagement, notify, reloadKey]);
  (0, import_react7.useEffect)(() => {
    void load();
  }, [load]);
  const nodeIndex = (0, import_react7.useMemo)(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const kindCounts = (0, import_react7.useMemo)(() => {
    const counts = {};
    for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
    return counts;
  }, [nodes]);
  const labelOf = (0, import_react7.useCallback)(
    (id) => {
      const node = nodeIndex.get(id);
      return node ? `${node.label}\uFF08${id}\uFF09` : id;
    },
    [nodeIndex]
  );
  const reload = (0, import_react7.useCallback)(() => {
    setReloadKey((value) => value + 1);
    refresh();
  }, [refresh]);
  const submit = (0, import_react7.useCallback)(async () => {
    if (!engagement) {
      notify("\u5148\u5728\u9876\u90E8\u9009\u62E9\u9776\u6807", "bad");
      return;
    }
    const stepTitle = title.trim();
    if (stepTitle === "") {
      notify("\u6807\u9898\u5FC5\u586B\uFF1A\u4E00\u53E5\u8BDD\u8BF4\u660E\u8FD9\u4E00\u6B65\u505A\u4E86\u4EC0\u4E48", "bad");
      return;
    }
    let order;
    const rawSeq = seq.trim();
    if (rawSeq !== "") {
      const parsed = Number(rawSeq);
      if (!Number.isFinite(parsed) || parsed < 0) {
        notify("\u987A\u5E8F\u9700\u4E3A\u975E\u8D1F\u6570\u5B57\uFF0C\u6216\u7559\u7A7A", "bad");
        return;
      }
      order = Math.trunc(parsed);
    }
    let pointId;
    const rawPoint = pointCode.trim();
    if (rawPoint !== "") {
      const asNumber = Number(rawPoint);
      if (Number.isInteger(asNumber) && asNumber > 0) {
        pointId = asNumber;
      } else {
        const found = codes.find((item) => item.code.toLowerCase() === rawPoint.toLowerCase());
        if (!found) {
          notify(`\u672A\u8BC6\u522B\u7684\u5F97\u5206\u70B9\uFF1A${rawPoint}\uFF08\u53EF\u586B code \u6216\u6570\u5B57 id\uFF0C\u7559\u7A7A\u5219\u4E0D\u5173\u8054\uFF09`, "bad");
          return;
        }
        pointId = found.id;
      }
    }
    setSaving(true);
    try {
      const result = unwrap(
        await redteam.addChainStep(engagement, {
          title: stepTitle,
          stage,
          seq: order,
          detail: detail.trim() === "" ? void 0 : detail.trim(),
          point_id: pointId,
          evidence_ref: evidence.trim() === "" ? void 0 : evidence.trim()
        })
      );
      notify(`\u5DF2\u6DFB\u52A0\u653B\u51FB\u94FE\u6B65\u9AA4${result.id ? ` #${result.id}` : ""}`);
      setTitle("");
      setSeq("");
      setDetail("");
      setPointCode("");
      setEvidence("");
      reload();
    } catch (err) {
      notify(errorText(err), "bad");
    } finally {
      setSaving(false);
    }
  }, [codes, detail, engagement, evidence, notify, pointCode, reload, seq, stage, title]);
  if (!engagement) {
    return (0, import_react7.createElement)(Card, { title: "\u653B\u51FB\u94FE" }, (0, import_react7.createElement)(Muted, null, "\u5148\u5728\u9876\u90E8\u9009\u62E9\u6216\u521B\u5EFA\u9776\u6807\uFF0C\u518D\u8BB0\u5F55\u653B\u51FB\u94FE\u3002"));
  }
  const timeline = steps.length === 0 ? (0, import_react7.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u8FD8\u6CA1\u6709\u653B\u51FB\u94FE\u6B65\u9AA4\uFF0C\u7528\u4E0B\u9762\u7684\u8868\u5355\u8BB0\u5F55\u7B2C\u4E00\u6761\u3002") : (0, import_react7.createElement)(
    "div",
    { style: { position: "relative", paddingLeft: 16, marginTop: 4 } },
    (0, import_react7.createElement)("div", {
      style: {
        position: "absolute",
        left: 4,
        top: 6,
        bottom: 6,
        width: 1,
        background: "rgba(255,255,255,.14)"
      }
    }),
    ...steps.map((step, index) => {
      const stageCode = String(step.stage ?? step.stage_code ?? "");
      const color = STAGE_COLOR[stageCode] ?? "#94a3b8";
      const stageText = STAGE_LABEL[stageCode] ?? (stageCode === "" ? "\u672A\u6807\u6CE8" : stageCode);
      const chips = [];
      if (step.asset_ip) chips.push(`\u8D44\u4EA7 ${step.asset_ip}`);
      else if (step.asset_id) chips.push(`\u8D44\u4EA7 #${step.asset_id}`);
      if (step.vuln_title) chips.push(`\u6F0F\u6D1E ${step.vuln_title}${step.vuln_cve ? `\uFF08${step.vuln_cve}\uFF09` : ""}`);
      else if (step.vuln_id) chips.push(`\u6F0F\u6D1E #${step.vuln_id}`);
      if (step.point_id) chips.push(`\u5F97\u5206\u70B9 #${step.point_id}`);
      if (step.evidence_ref) chips.push(`\u8BC1\u636E ${step.evidence_ref}`);
      if (step.tool) chips.push(`\u5DE5\u5177 ${step.tool}`);
      if (step.agent) chips.push(`\u6267\u884C ${step.agent}`);
      return (0, import_react7.createElement)(
        "div",
        { key: step.id ?? `step-${index}`, style: { position: "relative", paddingBottom: 12 } },
        (0, import_react7.createElement)("span", {
          style: {
            position: "absolute",
            left: -16,
            top: 5,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 0 3px rgba(255,255,255,.06)`
          }
        }),
        (0, import_react7.createElement)(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
          (0, import_react7.createElement)(Badge, { tone: stageCode === "exploit" ? "bad" : void 0 }, stageText),
          (0, import_react7.createElement)("strong", null, step.title ?? "(\u672A\u547D\u540D\u6B65\u9AA4)"),
          step.seq !== null && step.seq !== void 0 ? (0, import_react7.createElement)(Muted, null, `#${step.seq}`) : null,
          step.recorded_at ? (0, import_react7.createElement)(Muted, null, step.recorded_at) : null
        ),
        step.detail ? (0, import_react7.createElement)("div", { style: { whiteSpace: "pre-wrap", marginTop: 2, opacity: 0.92 } }, step.detail) : null,
        step.result ? (0, import_react7.createElement)("div", { style: { marginTop: 2 } }, (0, import_react7.createElement)(Muted, null, `\u7ED3\u679C\uFF1A${step.result}`)) : null,
        chips.length ? (0, import_react7.createElement)(Muted, null, chips.join(" \xB7 ")) : null,
        step.recorded_by ? (0, import_react7.createElement)(Muted, null, `\u8BB0\u5F55\u4EBA ${step.recorded_by}`) : null
      );
    })
  );
  const nodeRows = nodes.map((node) => [
    (0, import_react7.createElement)(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 6 } },
      (0, import_react7.createElement)(Badge, null, KIND_LABEL[node.kind] ?? node.kind),
      (0, import_react7.createElement)("span", { style: { fontFamily: MONO2, opacity: 0.7 } }, node.id)
    ),
    (0, import_react7.createElement)("span", null, node.label),
    (0, import_react7.createElement)("span", { style: { opacity: 0.7 } }, metaText2(node.meta))
  ]);
  const edgeRows = edges.map((edge) => [
    (0, import_react7.createElement)("span", { style: { fontFamily: MONO2 } }, labelOf(edge.source)),
    (0, import_react7.createElement)(Badge, null, RELATION_LABEL[edge.relation] ?? edge.relation),
    (0, import_react7.createElement)("span", { style: { fontFamily: MONO2 } }, labelOf(edge.target))
  ]);
  return (0, import_react7.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    (0, import_react7.createElement)(
      Card,
      {
        title: "\u653B\u51FB\u94FE",
        actions: (0, import_react7.createElement)(
          Toolbar,
          null,
          (0, import_react7.createElement)(Badge, null, `\u6B65\u9AA4 ${steps.length}`),
          (0, import_react7.createElement)(Btn, { onClick: reload, disabled: loading }, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u5237\u65B0")
        )
      },
      error ? (0, import_react7.createElement)("div", { style: { color: "#fecaca", marginBottom: 6 } }, error) : null,
      timeline
    ),
    (0, import_react7.createElement)(
      Card,
      { title: "\u65B0\u589E\u6B65\u9AA4" },
      (0, import_react7.createElement)(
        "div",
        { style: { display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: "8px 10px", alignItems: "center" } },
        (0, import_react7.createElement)(Muted, null, "\u6807\u9898 *"),
        (0, import_react7.createElement)(Input, { value: title, onChange: setTitle, placeholder: "\u5982\uFF1A\u901A\u8FC7 WebShell \u5EFA\u7ACB suo5 \u96A7\u9053" }),
        (0, import_react7.createElement)(Muted, null, "\u9636\u6BB5"),
        (0, import_react7.createElement)(Select, { value: stage, onChange: setStage, options: STAGES }),
        (0, import_react7.createElement)(Muted, null, "\u987A\u5E8F"),
        (0, import_react7.createElement)(Input, { value: seq, onChange: setSeq, placeholder: "\u53EF\u9009\uFF1Aseq\uFF08\u7559\u7A7A\u81EA\u52A8\u6392\u6700\u540E\uFF09" }),
        (0, import_react7.createElement)(Muted, null, "\u660E\u7EC6"),
        (0, import_react7.createElement)(TextArea, {
          value: detail,
          onChange: setDetail,
          rows: 3,
          placeholder: "\u8FD9\u4E00\u6B65\u600E\u4E48\u505A\u7684\uFF1A\u5165\u53E3\u3001\u547D\u4EE4\u3001\u8D26\u53F7\u6765\u6E90\uFF0C\u53EF\u7559\u7A7A"
        }),
        (0, import_react7.createElement)(Muted, null, "\u5F97\u5206\u70B9"),
        (0, import_react7.createElement)(Input, {
          value: pointCode,
          onChange: setPointCode,
          placeholder: codes.length ? "code\uFF08\u5982 R01\uFF09\u6216\u6570\u5B57 id\uFF0C\u53EF\u7559\u7A7A" : "\u6570\u5B57 point_id\uFF0C\u53EF\u7559\u7A7A"
        }),
        (0, import_react7.createElement)(Muted, null, "\u8BC1\u636E"),
        (0, import_react7.createElement)(Input, { value: evidence, onChange: setEvidence, placeholder: "\u8BC1\u636E\u5F15\u7528\uFF1A\u6587\u4EF6\u8DEF\u5F84 / \u547D\u4EE4\u56DE\u663E / \u622A\u56FE\u6587\u4EF6\u540D" })
      ),
      (0, import_react7.createElement)(
        "div",
        { style: { marginTop: 8 } },
        (0, import_react7.createElement)(
          Toolbar,
          null,
          (0, import_react7.createElement)(Btn, { variant: "primary", disabled: saving, onClick: () => void submit() }, saving ? "\u63D0\u4EA4\u4E2D\u2026" : "\u6DFB\u52A0\u6B65\u9AA4"),
          (0, import_react7.createElement)(
            Muted,
            null,
            codes.length ? `\u5DF2\u52A0\u8F7D ${codes.length} \u4E2A\u5F97\u5206\u70B9 code\uFF0C\u53EF\u586B code \u6216\u6570\u5B57 id` : "\u672A\u53D6\u5230\u5F97\u5206\u70B9\u6E05\u5355\uFF0C\u5F97\u5206\u70B9\u8BF7\u586B\u6570\u5B57 point_id"
          )
        )
      )
    ),
    (0, import_react7.createElement)(
      Card,
      {
        title: "\u653B\u51FB\u56FE\u8C31",
        actions: (0, import_react7.createElement)(
          Toolbar,
          null,
          (0, import_react7.createElement)(Badge, null, `\u8282\u70B9 ${nodes.length}`),
          (0, import_react7.createElement)(Badge, null, `\u8D44\u4EA7 ${kindCounts.asset ?? 0}`),
          (0, import_react7.createElement)(Badge, null, `\u6F0F\u6D1E ${kindCounts.vuln ?? 0}`),
          (0, import_react7.createElement)(Badge, null, `\u6B65\u9AA4 ${kindCounts.step ?? 0}`),
          (0, import_react7.createElement)(Badge, null, `\u5173\u7CFB ${edges.length}`)
        )
      },
      nodes.length === 0 ? (0, import_react7.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u8FD8\u6CA1\u6709\u56FE\u8C31\u8282\u70B9\uFF0C\u5148\u5F55\u5165\u8D44\u4EA7\u4E0E\u6F0F\u6D1E") : (0, import_react7.createElement)(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 10 } },
        (0, import_react7.createElement)(
          "div",
          null,
          (0, import_react7.createElement)(Muted, null, "\u8282\u70B9"),
          (0, import_react7.createElement)(
            "div",
            { style: { maxHeight: 220, overflow: "auto", marginTop: 4 } },
            (0, import_react7.createElement)(Table, { head: ["\u7C7B\u578B / \u6807\u8BC6", "\u6807\u7B7E", "\u5C5E\u6027"], rows: nodeRows })
          )
        ),
        (0, import_react7.createElement)(
          "div",
          null,
          (0, import_react7.createElement)(Muted, null, "\u5173\u7CFB"),
          edges.length === 0 ? (0, import_react7.createElement)(Muted, null, "\u6682\u65E0\u5173\u7CFB") : (0, import_react7.createElement)(
            "div",
            { style: { maxHeight: 220, overflow: "auto", marginTop: 4 } },
            (0, import_react7.createElement)(Table, { head: ["\u6765\u6E90", "\u5173\u7CFB", "\u76EE\u6807"], rows: edgeRows })
          )
        )
      )
    )
  );
}

// src/client/pages/scores.ts
var import_react8 = require("react");
var CUSTOM_CODE = "__custom__";
var MONO3 = "ui-monospace,SFMono-Regular,Menlo,monospace";
function unwrap2(data) {
  if (data === null || data === void 0) throw new Error("\u63A5\u53E3\u8FD4\u56DE\u4E3A\u7A7A");
  if (data.ok === false) throw new Error(data.error ?? "\u8BF7\u6C42\u5931\u8D25");
  return data;
}
function shortText(value, limit = 64) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text === "") return "\u2014";
  return text.length > limit ? `${text.slice(0, limit)}\u2026` : text;
}
function ScoresPage(props) {
  const { engagement, notify, refresh } = props;
  const [board, setBoard] = (0, import_react8.useState)(null);
  const [report, setReport] = (0, import_react8.useState)(null);
  const [loading, setLoading] = (0, import_react8.useState)(false);
  const [saving, setSaving] = (0, import_react8.useState)(false);
  const [error, setError] = (0, import_react8.useState)(null);
  const [reloadKey, setReloadKey] = (0, import_react8.useState)(0);
  const [onlyHit, setOnlyHit] = (0, import_react8.useState)(false);
  const [pointCode, setPointCode] = (0, import_react8.useState)(CUSTOM_CODE);
  const [customCode, setCustomCode] = (0, import_react8.useState)("");
  const [evidence, setEvidence] = (0, import_react8.useState)("");
  const [target, setTarget] = (0, import_react8.useState)("");
  const [assetId, setAssetId] = (0, import_react8.useState)("");
  const load = (0, import_react8.useCallback)(async () => {
    if (!engagement) {
      setBoard(null);
      setReport(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [scores, scoreReport] = await Promise.all([
        redteam.scores(engagement),
        redteam.scoreReport(engagement)
      ]);
      setBoard(unwrap2(scores));
      setReport(unwrap2(scoreReport));
    } catch (err) {
      const text = errorText(err);
      setError(text);
      notify(text, "bad");
    } finally {
      setLoading(false);
    }
  }, [engagement, notify, reloadKey]);
  (0, import_react8.useEffect)(() => {
    void load();
  }, [load]);
  const items = board?.items ?? [];
  const summary = board?.summary ?? null;
  const reportSummary = report?.summary ?? null;
  const achieved = report?.achieved ?? [];
  const missing = report?.missing ?? [];
  const selectedPoint = (0, import_react8.useMemo)(() => items.find((item) => item.code === pointCode) ?? null, [items, pointCode]);
  const codeOptions = (0, import_react8.useMemo)(() => {
    const options = items.filter((item) => item.enabled || item.hits.length > 0).map((item) => ({ value: item.code, label: `${item.code} \xB7 ${item.name}\uFF08${item.points} \u5206\uFF09` }));
    if (pointCode !== CUSTOM_CODE && pointCode !== "" && !options.some((option) => option.value === pointCode)) {
      options.unshift({ value: pointCode, label: `${pointCode}\uFF08\u5F53\u524D\u6E05\u5355\u91CC\u6CA1\u6709\uFF0C\u4ECD\u53EF\u63D0\u4EA4\uFF09` });
    }
    options.push({ value: CUSTOM_CODE, label: "\u81EA\u5B9A\u4E49 code\u2026" });
    return options;
  }, [items, pointCode]);
  const rows = (0, import_react8.useMemo)(() => onlyHit ? items.filter((item) => item.hits.length > 0) : items, [items, onlyHit]);
  const recentHits = (0, import_react8.useMemo)(() => {
    const flat = items.flatMap((item) => item.hits.map((hit) => ({ hit, code: item.code, name: item.name })));
    flat.sort(
      (a, b) => String(b.hit.recorded_at ?? "").localeCompare(String(a.hit.recorded_at ?? "")) || Number(b.hit.id) - Number(a.hit.id)
    );
    return flat.slice(0, 20);
  }, [items]);
  const reload = (0, import_react8.useCallback)(() => {
    setReloadKey((value) => value + 1);
    refresh();
  }, [refresh]);
  const submit = (0, import_react8.useCallback)(async () => {
    if (!engagement) {
      notify("\u5148\u5728\u9876\u90E8\u9009\u62E9\u9776\u6807", "bad");
      return;
    }
    const code = (pointCode === CUSTOM_CODE ? customCode : pointCode).trim();
    if (code === "") {
      notify("\u5F97\u5206\u70B9 code \u5FC5\u586B\uFF1A\u9009\u4E00\u4E2A\u5DF2\u77E5 code\uFF0C\u6216\u5207\u5230\u201C\u81EA\u5B9A\u4E49 code\u201D\u624B\u5DE5\u586B\u5199", "bad");
      return;
    }
    const proof = evidence.trim();
    if (proof === "") {
      notify("evidence \u5FC5\u586B\uFF1A\u5199\u6E05\u8D26\u53F7 / \u547D\u4EE4\u56DE\u663E / \u6570\u636E\u91CF / \u6587\u4EF6\u8DEF\u5F84", "bad");
      return;
    }
    let asset;
    const rawAsset = assetId.trim();
    if (rawAsset !== "") {
      const parsed = Number(rawAsset);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        notify("asset_id \u9700\u4E3A\u6B63\u6574\u6570\uFF0C\u6216\u7559\u7A7A", "bad");
        return;
      }
      asset = Math.trunc(parsed);
    }
    setSaving(true);
    try {
      const result = unwrap2(
        await redteam.addScoreHit(engagement, {
          code,
          evidence: proof,
          target: target.trim() === "" ? void 0 : target.trim(),
          asset_id: asset
        })
      );
      notify(`\u5DF2\u8BB0\u5206\uFF1A${result.hit?.point_code || code}`);
      setEvidence("");
      setTarget("");
      setAssetId("");
      reload();
    } catch (err) {
      notify(errorText(err), "bad");
    } finally {
      setSaving(false);
    }
  }, [assetId, customCode, engagement, evidence, notify, pointCode, reload, target]);
  if (!engagement) {
    return (0, import_react8.createElement)(Card, { title: "\u5F97\u5206\u76EE\u6807" }, (0, import_react8.createElement)(Muted, null, "\u5148\u5728\u9876\u90E8\u9009\u62E9\u6216\u521B\u5EFA\u9776\u6807\uFF0C\u518D\u8BB0\u5F55\u5F97\u5206\u3002"));
  }
  const summaryBadges = [
    (0, import_react8.createElement)(Badge, { key: "points", tone: "ok" }, `\u5F97\u5206 ${summary ? summary.achievedPoints : 0}`),
    (0, import_react8.createElement)(Badge, { key: "counted" }, `\u8BA1\u5206\u547D\u4E2D ${summary?.countedHits ?? 0}`),
    (0, import_react8.createElement)(Badge, { key: "hits" }, `\u603B\u547D\u4E2D ${summary?.hitCount ?? 0}`),
    (0, import_react8.createElement)(
      Badge,
      { key: "self", tone: (summary?.selfCreatedHits ?? 0) > 0 ? "warn" : void 0 },
      `\u81EA\u5EFA ${summary?.selfCreatedHits ?? 0}`
    ),
    (0, import_react8.createElement)(
      Badge,
      { key: "capped", tone: (summary?.serviceCappedHits ?? 0) > 0 ? "warn" : void 0 },
      `\u5C01\u9876 ${summary?.serviceCappedHits ?? 0}`
    ),
    (0, import_react8.createElement)(Muted, { key: "point" }, `\u5F97\u5206\u70B9 ${summary?.pointCount ?? 0} \u4E2A \xB7 \u5DF2\u547D\u4E2D ${summary?.hitPointCount ?? 0} \u4E2A`)
  ];
  const scoreRows = rows.map((item) => {
    const selfCreated = item.self_created > 0;
    const capped = item.capped > 0;
    return [
      (0, import_react8.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
        (0, import_react8.createElement)("span", { style: { fontWeight: item.counted > 0 ? 600 : 400 } }, item.name),
        (0, import_react8.createElement)(Badge, null, item.code),
        item.enabled ? null : (0, import_react8.createElement)(Badge, { tone: "warn" }, "\u5DF2\u505C\u7528"),
        item.category ? (0, import_react8.createElement)("span", { style: { opacity: 0.6 } }, item.category) : null
      ),
      (0, import_react8.createElement)(
        "span",
        null,
        fmt(item.points),
        item.cap > 0 ? (0, import_react8.createElement)("span", { style: { opacity: 0.55 } }, ` / \u5C01\u9876 ${item.cap}`) : null
      ),
      (0, import_react8.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
        (0, import_react8.createElement)("span", null, String(item.hits.length)),
        item.counted !== item.hits.length ? (0, import_react8.createElement)("span", { style: { opacity: 0.6 } }, `\u8BA1 ${item.counted}`) : null,
        selfCreated ? (0, import_react8.createElement)(Badge, { tone: "warn" }, `\u81EA\u5EFA ${item.self_created}`) : null,
        capped ? (0, import_react8.createElement)(Badge, { tone: "warn" }, `\u5C01\u9876 ${item.capped}`) : null
      ),
      (0, import_react8.createElement)("strong", null, fmt(item.earned))
    ];
  });
  const hitRows = recentHits.map(({ hit, code, name: name2 }) => [
    (0, import_react8.createElement)(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
      (0, import_react8.createElement)("span", null, name2),
      (0, import_react8.createElement)(Badge, null, code)
    ),
    (0, import_react8.createElement)("span", null, fmt(hit.points)),
    (0, import_react8.createElement)(
      "span",
      {
        style: {
          fontFamily: MONO3,
          display: "inline-block",
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          verticalAlign: "bottom"
        },
        title: hit.target ?? ""
      },
      shortText(hit.target, 40)
    ),
    (0, import_react8.createElement)(
      "span",
      {
        style: {
          display: "inline-block",
          maxWidth: 320,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          verticalAlign: "bottom"
        },
        title: hit.evidence ?? ""
      },
      shortText(hit.evidence, 64)
    ),
    hit.self_created ? (0, import_react8.createElement)(Badge, { tone: "warn" }, "\u81EA\u5EFA\u4E0D\u8BA1") : hit.capped ? (0, import_react8.createElement)(Badge, { tone: "warn" }, "\u5C01\u9876\u4E0D\u8BA1") : (0, import_react8.createElement)(Badge, { tone: "ok" }, "\u8BA1\u5165")
  ]);
  const entryList = (title, tone, entries, emptyText) => (0, import_react8.createElement)(
    "div",
    { style: { flex: "1 1 220px", minWidth: 200, display: "flex", flexDirection: "column", gap: 4 } },
    (0, import_react8.createElement)(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 6 } },
      (0, import_react8.createElement)(Badge, { tone }, title),
      (0, import_react8.createElement)(Muted, null, `${entries.length} \u9879`)
    ),
    entries.length === 0 ? (0, import_react8.createElement)(Muted, null, emptyText) : (0, import_react8.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 2, maxHeight: 220, overflow: "auto" } },
      ...entries.map(
        (entry) => (0, import_react8.createElement)(
          "div",
          { key: `${tone}-${entry.code}`, style: { display: "flex", alignItems: "center", gap: 6 } },
          (0, import_react8.createElement)(
            "span",
            { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            entry.name
          ),
          (0, import_react8.createElement)(Badge, null, entry.code),
          (0, import_react8.createElement)("span", { style: { opacity: 0.75, whiteSpace: "nowrap" } }, `${entry.points} \u5206`)
        )
      )
    )
  );
  return (0, import_react8.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    (0, import_react8.createElement)(
      Card,
      {
        title: "\u5F97\u5206\u770B\u677F",
        actions: (0, import_react8.createElement)(
          Toolbar,
          null,
          (0, import_react8.createElement)(Btn, { onClick: () => setOnlyHit(!onlyHit) }, onlyHit ? "\u663E\u793A\u5168\u90E8\u5F97\u5206\u70B9" : "\u53EA\u770B\u6709\u547D\u4E2D"),
          (0, import_react8.createElement)(Btn, { onClick: reload, disabled: loading }, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u5237\u65B0")
        )
      },
      (0, import_react8.createElement)(Toolbar, null, ...summaryBadges),
      reportSummary ? (0, import_react8.createElement)(
        Muted,
        null,
        `\u5DF2\u8FBE\u6210 ${reportSummary.achievedCount ?? 0} \u9879 \xB7 \u672A\u547D\u4E2D ${reportSummary.missingCount ?? 0} \u9879\uFF08\u7F3A\u53E3 ${reportSummary.missingPoints ?? 0} \u5206\uFF09\xB7 \u5408\u89C4\u5165\u53E3 ${reportSummary.tunnelsLegit ?? 0} / \u81EA\u5EFA ${reportSummary.tunnelsSelfOnly ?? 0}`
      ) : null,
      error ? (0, import_react8.createElement)("div", { style: { color: "#fecaca", marginTop: 4 } }, error) : null,
      rows.length === 0 ? (0, import_react8.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : onlyHit ? "\u8FD8\u6CA1\u6709\u547D\u4E2D\u7684\u5F97\u5206\u70B9" : "\u8FD8\u6CA1\u6709\u5F97\u5206\u70B9\u89C4\u5219") : (0, import_react8.createElement)("div", { style: { overflow: "auto" } }, (0, import_react8.createElement)(Table, { head: ["\u5F97\u5206\u70B9", "\u5206\u503C", "\u547D\u4E2D\u6570", "\u5DF2\u5F97"], rows: scoreRows }))
    ),
    (0, import_react8.createElement)(
      Card,
      { title: "\u8BB0\u4E00\u6761\u5F97\u5206" },
      (0, import_react8.createElement)(
        "div",
        { style: { display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: "8px 10px", alignItems: "start" } },
        (0, import_react8.createElement)(Muted, null, "\u5F97\u5206\u70B9 *"),
        (0, import_react8.createElement)(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 6 } },
          (0, import_react8.createElement)(Select, { value: pointCode, onChange: setPointCode, options: codeOptions }),
          pointCode === CUSTOM_CODE ? (0, import_react8.createElement)(Input, {
            value: customCode,
            onChange: setCustomCode,
            placeholder: "\u81EA\u5B9A\u4E49 code\uFF08\u5982 R26 / \u81EA\u5B9A\u4E49-\u8FB9\u754C\u7A81\u7834\uFF09"
          }) : (0, import_react8.createElement)(
            Muted,
            null,
            selectedPoint ? `${selectedPoint.name} \xB7 \u5206\u503C ${selectedPoint.points}${selectedPoint.cap > 0 ? ` \xB7 \u5C01\u9876 ${selectedPoint.cap}` : ""}${selectedPoint.enabled ? "" : " \xB7 \u5DF2\u505C\u7528"}` : "\u6E05\u5355\u91CC\u8FD8\u6CA1\u6709\u8FD9\u4E2A code\uFF0C\u63D0\u4EA4\u540E\u6309\u540E\u7AEF\u8FD4\u56DE\u4E3A\u51C6"
          )
        ),
        (0, import_react8.createElement)(Muted, null, "\u8BC1\u636E *"),
        (0, import_react8.createElement)(TextArea, {
          value: evidence,
          onChange: setEvidence,
          rows: 3,
          placeholder: "\u5FC5\u586B\uFF1A\u8D26\u53F7 / \u547D\u4EE4\u56DE\u663E / \u6570\u636E\u91CF / \u6587\u4EF6\u8DEF\u5F84"
        }),
        (0, import_react8.createElement)(Muted, null, "\u76EE\u6807"),
        (0, import_react8.createElement)(Input, { value: target, onChange: setTarget, placeholder: "\u5982 https://host:8443/ \u6216 host:22\uFF0C\u53EF\u7559\u7A7A" }),
        (0, import_react8.createElement)(Muted, null, "\u8D44\u4EA7 ID"),
        (0, import_react8.createElement)(Input, { value: assetId, onChange: setAssetId, placeholder: "\u53EF\u9009\uFF1Aasset.id\uFF08\u6570\u5B57\uFF09" })
      ),
      (0, import_react8.createElement)(
        "div",
        { style: { marginTop: 8 } },
        (0, import_react8.createElement)(
          Toolbar,
          null,
          (0, import_react8.createElement)(Btn, { variant: "primary", disabled: saving, onClick: () => void submit() }, saving ? "\u63D0\u4EA4\u4E2D\u2026" : "\u8BB0\u5F55\u5F97\u5206"),
          (0, import_react8.createElement)(Muted, null, "evidence \u5FC5\u586B\uFF1Btarget \u5E26\u7AEF\u53E3\u65F6\u6309\u670D\u52A1\u7EF4\u5EA6\u8BA1\u5165\u5C01\u9876")
        )
      )
    ),
    (0, import_react8.createElement)(
      Card,
      { title: "\u8FBE\u6210 / \u7F3A\u53E3", actions: (0, import_react8.createElement)(Muted, null, "\u6765\u81EA scoreReport") },
      (0, import_react8.createElement)(
        "div",
        { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
        entryList("\u5DF2\u8FBE\u6210", "ok", achieved, "\u8FD8\u6CA1\u6709\u8BA1\u5165\u7684\u5F97\u5206\u70B9"),
        entryList("\u672A\u547D\u4E2D", "warn", missing, "\u6240\u6709\u5F97\u5206\u70B9\u90FD\u547D\u4E2D\u4E86")
      )
    ),
    recentHits.length ? (0, import_react8.createElement)(
      Card,
      { title: "\u6700\u8FD1\u547D\u4E2D", actions: (0, import_react8.createElement)(Muted, null, `\u5171 ${summary?.hitCount ?? recentHits.length} \u6761\uFF0C\u663E\u793A\u6700\u8FD1 ${recentHits.length} \u6761`) },
      (0, import_react8.createElement)("div", { style: { overflow: "auto" } }, (0, import_react8.createElement)(Table, { head: ["\u5F97\u5206\u70B9", "\u5206\u503C", "\u76EE\u6807", "\u8BC1\u636E", "\u8BA1\u5165"], rows: hitRows }))
    ) : null
  );
}

// src/client/pages/report.ts
var import_react9 = require("react");
var MONO4 = "ui-monospace,SFMono-Regular,Menlo,monospace";
function unwrap3(data) {
  if (data === null || data === void 0) throw new Error("\u63A5\u53E3\u8FD4\u56DE\u4E3A\u7A7A");
  if (data.ok === false) throw new Error(data.error ?? "\u8BF7\u6C42\u5931\u8D25");
  return data;
}
async function copyText(text) {
  try {
    const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const copied = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
    document.body.removeChild(area);
    return copied === true;
  } catch {
    return false;
  }
}
function ReportPage(props) {
  const { engagement, notify, refresh } = props;
  const [targets, setTargets] = (0, import_react9.useState)([]);
  const [markdown, setMarkdown] = (0, import_react9.useState)("");
  const [generatedAt, setGeneratedAt] = (0, import_react9.useState)(null);
  const [loading, setLoading] = (0, import_react9.useState)(false);
  const [generating, setGenerating] = (0, import_react9.useState)(false);
  const [error, setError] = (0, import_react9.useState)(null);
  const [reloadKey, setReloadKey] = (0, import_react9.useState)(0);
  const loadTargets = (0, import_react9.useCallback)(async () => {
    if (!engagement) {
      setTargets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = unwrap3(await redteam.reportTargets(engagement));
      setTargets(data.items ?? []);
    } catch (err) {
      const text = errorText(err);
      setError(text);
      notify(text, "bad");
    } finally {
      setLoading(false);
    }
  }, [engagement, notify, reloadKey]);
  (0, import_react9.useEffect)(() => {
    void loadTargets();
  }, [loadTargets]);
  const generate = (0, import_react9.useCallback)(async () => {
    if (!engagement) {
      notify("\u5148\u5728\u9876\u90E8\u9009\u62E9\u9776\u6807", "bad");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const data = unwrap3(await redteam.report(engagement));
      setMarkdown(String(data.markdown ?? ""));
      setGeneratedAt(typeof data.generated_at === "string" ? data.generated_at : null);
      notify("\u62A5\u544A\u5DF2\u751F\u6210");
      setReloadKey((value) => value + 1);
      refresh();
    } catch (err) {
      const text = errorText(err);
      setError(text);
      notify(text, "bad");
    } finally {
      setGenerating(false);
    }
  }, [engagement, notify, refresh]);
  const copy = (0, import_react9.useCallback)(async () => {
    if (markdown === "") {
      notify("\u8FD8\u6CA1\u6709\u62A5\u544A\u5185\u5BB9\uFF0C\u5148\u751F\u6210\u62A5\u544A", "bad");
      return;
    }
    const copied = await copyText(markdown);
    if (copied) notify("\u5DF2\u590D\u5236", "ok");
    else notify("\u590D\u5236\u5931\u8D25\uFF1A\u5728\u62A5\u544A\u6846\u5185\u624B\u52A8\u5168\u9009\uFF08Ctrl+A\uFF09\u540E\u590D\u5236", "bad");
  }, [markdown, notify]);
  if (!engagement) {
    return (0, import_react9.createElement)(Card, { title: "\u62A5\u544A" }, (0, import_react9.createElement)(Muted, null, "\u5148\u5728\u9876\u90E8\u9009\u62E9\u6216\u521B\u5EFA\u9776\u6807\uFF0C\u518D\u751F\u6210\u62A5\u544A\u3002"));
  }
  const totals = targets.reduce(
    (acc, item) => ({
      vulns: acc.vulns + Number(item.vulns ?? 0),
      serious: acc.serious + Number(item.serious ?? 0)
    }),
    { vulns: 0, serious: 0 }
  );
  const targetRows = targets.map((item) => [
    (0, import_react9.createElement)("span", { style: { fontFamily: MONO4 } }, fmt(item.target)),
    fmt(item.vulns),
    Number(item.serious ?? 0) > 0 ? (0, import_react9.createElement)(Badge, { tone: "bad" }, fmt(item.serious)) : (0, import_react9.createElement)(Muted, null, "0")
  ]);
  return (0, import_react9.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    (0, import_react9.createElement)(
      Card,
      {
        title: "\u6210\u679C\u62A5\u544A",
        actions: (0, import_react9.createElement)(
          Toolbar,
          null,
          (0, import_react9.createElement)(Btn, { variant: "primary", disabled: generating, onClick: () => void generate() }, generating ? "\u751F\u6210\u4E2D\u2026" : "\u751F\u6210\u62A5\u544A"),
          (0, import_react9.createElement)(Btn, { disabled: markdown === "", onClick: () => void copy() }, "\u590D\u5236")
        )
      },
      (0, import_react9.createElement)(
        Muted,
        null,
        generatedAt ? `\u751F\u6210\u4E8E ${generatedAt} \xB7 \u6765\u81EA redteam.report` : "\u62A5\u544A\u6309\u5F53\u524D\u9776\u6807\u7684\u8D44\u4EA7 / \u6F0F\u6D1E / \u653B\u51FB\u94FE / \u5F97\u5206\u6C47\u603B\u751F\u6210\uFF0CMarkdown \u53EF\u76F4\u63A5\u8D34\u8FDB\u4EA4\u4ED8\u6587\u6863\u3002"
      ),
      error ? (0, import_react9.createElement)("div", { style: { color: "#fecaca", marginTop: 4 } }, error) : null,
      markdown === "" ? (0, import_react9.createElement)(Empty, null, generating ? "\u6B63\u5728\u751F\u6210\u2026" : "\u70B9\u51FB\u300C\u751F\u6210\u62A5\u544A\u300D\u8F93\u51FA Markdown") : (0, import_react9.createElement)(
        "pre",
        {
          style: {
            margin: "8px 0 0",
            padding: "10px 12px",
            maxHeight: 420,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(0,0,0,.28)",
            fontFamily: MONO4,
            fontSize: 11.5,
            lineHeight: 1.6
          }
        },
        markdown
      )
    ),
    (0, import_react9.createElement)(
      Card,
      {
        title: "\u6309\u76EE\u6807\u805A\u5408",
        actions: (0, import_react9.createElement)(
          Toolbar,
          null,
          (0, import_react9.createElement)(Badge, null, `\u76EE\u6807 ${targets.length}`),
          (0, import_react9.createElement)(Badge, null, `\u6F0F\u6D1E ${totals.vulns}`),
          (0, import_react9.createElement)(Badge, { tone: totals.serious > 0 ? "bad" : void 0 }, `\u4E25\u91CD ${totals.serious}`)
        )
      },
      targets.length === 0 ? (0, import_react9.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u8FD8\u6CA1\u6709\u6F0F\u6D1E\u8BB0\u5F55\uFF0C\u5148\u5F55\u5165\u6210\u679C\u518D\u805A\u5408") : (0, import_react9.createElement)(
        "div",
        { style: { overflow: "auto" } },
        (0, import_react9.createElement)(Table, { head: ["\u76EE\u6807", "\u6F0F\u6D1E", "\u4E25\u91CD"], rows: targetRows })
      )
    )
  );
}

// src/client/pages/skills.ts
var import_react10 = require("react");
var MONO5 = "ui-monospace,SFMono-Regular,Menlo,monospace";
var VALID_NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
function clip2(text, head = 42, tail = 0) {
  const value = String(text ?? "");
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  if (tail <= 0) return `${value.slice(0, head)}\u2026`;
  return `${value.slice(0, head)}\u2026${value.slice(-tail)}`;
}
function templateFor(name2) {
  return [
    "---",
    `name: ${name2}`,
    `description: ${name2} \u6280\u80FD\uFF0C\u4E00\u53E5\u8BDD\u8BF4\u660E\u4EC0\u4E48\u65F6\u5019\u7528\u5B83`,
    "---",
    "",
    "## \u7528\u9014",
    "",
    "- \u8BF4\u660E\u8FD9\u4E2A\u6280\u80FD\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\u3001\u4EC0\u4E48\u65F6\u5019\u8BE5\u7528\u3002",
    "",
    "## \u6B65\u9AA4",
    "",
    "1. ",
    "",
    "## \u6CE8\u610F",
    "",
    "- ",
    ""
  ].join("\n");
}
function SkillsPage(props) {
  const [items, setItems] = (0, import_react10.useState)([]);
  const [catalogStatus, setCatalogStatus] = (0, import_react10.useState)(null);
  const [selected, setSelected] = (0, import_react10.useState)(null);
  const [content, setContent] = (0, import_react10.useState)("");
  const [dirty, setDirty] = (0, import_react10.useState)(false);
  const [health, setHealth] = (0, import_react10.useState)(null);
  const [newName, setNewName] = (0, import_react10.useState)("");
  const [importValue, setImportValue] = (0, import_react10.useState)("");
  const [pendingDelete, setPendingDelete] = (0, import_react10.useState)("");
  const [loading, setLoading] = (0, import_react10.useState)(true);
  const [busy, setBusy] = (0, import_react10.useState)("");
  const reload = (0, import_react10.useCallback)(async () => {
    setLoading(true);
    try {
      const data = await skills.catalog();
      if (data?.ok === false) throw new Error(data.error ?? "\u6280\u80FD\u5E93\u8BFB\u53D6\u5931\u8D25");
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setCatalogStatus(data?.status ?? null);
      setPendingDelete("");
      setSelected((prev) => {
        if (!prev) return prev;
        const hit = list.find((item) => item.id === prev.id && item.library === prev.library) ?? list.find((item) => item.id === prev.id);
        return hit ? { ...prev, ...hit } : prev;
      });
    } catch (error) {
      props.notify(`\u6280\u80FD\u5E93\u8BFB\u53D6\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setLoading(false);
    }
  }, [props.notify]);
  (0, import_react10.useEffect)(() => {
    void reload();
  }, [reload]);
  const openItem = (0, import_react10.useCallback)(
    async (item) => {
      setBusy("read");
      try {
        const data = await skills.read(item.id, item.library);
        if (data?.ok === false) throw new Error(data.error ?? "\u8BFB\u53D6\u5931\u8D25");
        const loaded = data?.item ?? item;
        setSelected({ ...item, ...loaded });
        setContent(typeof data?.content === "string" ? data.content : "");
        setDirty(false);
      } catch (error) {
        props.notify(`\u8BFB\u53D6\u6280\u80FD ${item.id} \u5931\u8D25\uFF1A${errorText(error)}`, "bad");
      } finally {
        setBusy("");
      }
    },
    [props.notify]
  );
  const save = (0, import_react10.useCallback)(async () => {
    if (!selected) return;
    setBusy("save");
    try {
      const data = await skills.save(selected.id, content);
      if (data?.ok === false) throw new Error(data.error ?? "\u4FDD\u5B58\u5931\u8D25");
      setDirty(false);
      props.notify(`\u5DF2\u4FDD\u5B58\u6280\u80FD ${selected.id}`);
      setHealth(null);
      await reload();
      props.refresh();
    } catch (error) {
      props.notify(`\u4FDD\u5B58\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
    }
  }, [content, props, reload, selected]);
  const createTemplate = (0, import_react10.useCallback)(() => {
    const name2 = newName.trim();
    if (!VALID_NAME.test(name2)) {
      props.notify("\u6280\u80FD\u540D\u8981\u7528 kebab-case\uFF08\u5C0F\u5199\u5B57\u6BCD/\u6570\u5B57/\u77ED\u6A2A\u7EBF\uFF09\uFF0C\u4F8B\u5982 code-review", "bad");
      return;
    }
    setSelected({ id: name2, library: "redteam", path: "" });
    setContent(templateFor(name2));
    setDirty(true);
    setNewName("");
    props.notify(`\u5DF2\u751F\u6210 ${name2} \u6A21\u677F\uFF0C\u6539\u5B8C\u70B9\u300C\u4FDD\u5B58\u300D\u5199\u76D8`);
  }, [newName, props]);
  const importSkill = (0, import_react10.useCallback)(async () => {
    const target = importValue.trim();
    if (!target) {
      props.notify("\u5148\u586B\u8981\u5BFC\u5165\u7684\u76EE\u5F55\uFF08\u542B SKILL.md\uFF09\u6216 .md \u6587\u4EF6\u8DEF\u5F84", "bad");
      return;
    }
    setBusy("import");
    try {
      const data = await skills.importPath(target);
      if (data?.ok === false) throw new Error(data.error ?? "\u5BFC\u5165\u5931\u8D25");
      props.notify(`\u5DF2\u5BFC\u5165\u6280\u80FD ${data?.id ?? ""}`);
      setImportValue("");
      setHealth(null);
      await reload();
      props.refresh();
    } catch (error) {
      props.notify(`\u5BFC\u5165\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
    }
  }, [importValue, props, reload]);
  const installBundled = (0, import_react10.useCallback)(async () => {
    setBusy("install");
    try {
      const data = await skills.installBundled();
      if (data?.ok === false) throw new Error(data.error ?? "\u5B89\u88C5\u5931\u8D25");
      const installed = Array.isArray(data?.installed) ? data.installed.length : 0;
      const skipped = Number(data?.skipped ?? 0);
      props.notify(installed > 0 ? `\u5DF2\u5B89\u88C5 ${installed} \u4E2A\u5185\u7F6E\u6280\u80FD\uFF08\u8DF3\u8FC7\u5DF2\u5B58\u5728 ${skipped} \u4E2A\uFF09` : `\u5185\u7F6E\u6280\u80FD\u90FD\u5DF2\u5B58\u5728\uFF08\u8DF3\u8FC7 ${skipped} \u4E2A\uFF09`);
      setHealth(null);
      await reload();
      props.refresh();
    } catch (error) {
      props.notify(`\u5B89\u88C5\u5185\u7F6E\u6280\u80FD\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
    }
  }, [props, reload]);
  const runHealth = (0, import_react10.useCallback)(async () => {
    setBusy("health");
    try {
      const data = await skills.health();
      if (data?.ok === false) throw new Error(data.error ?? "\u4F53\u68C0\u5931\u8D25");
      const list = Array.isArray(data?.items) ? data.items : [];
      setHealth(list);
      const failed = list.filter((item) => item.ok === false).length;
      props.notify(failed > 0 ? `\u4F53\u68C0\u5B8C\u6210\uFF1A${failed}/${list.length} \u9879\u6709\u95EE\u9898` : `\u4F53\u68C0\u901A\u8FC7\uFF1A${list.length} \u4E2A\u6280\u80FD\u5168\u90E8\u5C31\u7EEA`, failed > 0 ? "bad" : "ok");
    } catch (error) {
      props.notify(`\u4F53\u68C0\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
    }
  }, [props.notify]);
  const removeItem = (0, import_react10.useCallback)(
    async (item) => {
      if (item.library !== "redteam") {
        props.notify("\u53EA\u80FD\u5220\u9664 redteam \u6280\u80FD\u5E93\u91CC\u7684\u6280\u80FD", "bad");
        return;
      }
      if (pendingDelete !== item.id) {
        setPendingDelete(item.id);
        props.notify(`\u518D\u70B9\u4E00\u6B21\u300C\u786E\u8BA4\u5220\u9664\u300D\u5220\u9664 ${item.id}`);
        return;
      }
      setBusy("remove");
      try {
        const data = await skills.remove(item.id);
        if (data?.ok === false) throw new Error(data.error ?? "\u5220\u9664\u5931\u8D25");
        props.notify(`\u5DF2\u5220\u9664\u6280\u80FD ${item.id}`);
        if (selected?.id === item.id) {
          setSelected(null);
          setContent("");
          setDirty(false);
        }
        setPendingDelete("");
        setHealth(null);
        await reload();
        props.refresh();
      } catch (error) {
        props.notify(`\u5220\u9664\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
      } finally {
        setBusy("");
      }
    },
    [props, pendingDelete, reload, selected]
  );
  const locked = busy !== "" || loading;
  const failures = (health ?? []).filter((item) => item.ok === false);
  const listRows = items.map((item) => [
    (0, import_react10.createElement)(
      "span",
      {
        style: { fontFamily: MONO5, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" },
        title: item.path ?? item.id,
        onClick: () => void openItem(item)
      },
      item.id
    ),
    (0, import_react10.createElement)(Badge, { tone: item.library === "official" ? "warn" : void 0 }, item.library || "redteam"),
    item.valid === false ? (0, import_react10.createElement)(Badge, { tone: "bad" }, clip2(item.error ?? "\u65E0\u6548", 14, 0)) : (0, import_react10.createElement)(Badge, { tone: "ok" }, "\u6709\u6548"),
    (0, import_react10.createElement)("span", { title: item.description ?? "", style: { opacity: 0.85 } }, item.description ? clip2(item.description, 46, 0) : "\u2014"),
    (0, import_react10.createElement)(
      Toolbar,
      null,
      (0, import_react10.createElement)(Btn, { onClick: () => void openItem(item), disabled: busy !== "" }, busy === "read" ? "\u2026" : "\u6253\u5F00"),
      item.library === "redteam" ? (0, import_react10.createElement)(
        Btn,
        { variant: "danger", onClick: () => void removeItem(item), disabled: busy !== "" },
        pendingDelete === item.id ? "\u786E\u8BA4\u5220\u9664" : "\u5220\u9664"
      ) : null
    )
  ]);
  const listCard = (0, import_react10.createElement)(
    Card,
    {
      title: `\u6280\u80FD\u5217\u8868\uFF08${items.length}\uFF09`,
      actions: (0, import_react10.createElement)(
        Toolbar,
        null,
        (0, import_react10.createElement)(Btn, { onClick: () => void reload(), disabled: busy !== "" }, loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"),
        (0, import_react10.createElement)(Btn, { onClick: () => void installBundled(), disabled: busy !== "" }, busy === "install" ? "\u6267\u884C\u4E2D\u2026" : "\u5B89\u88C5\u5185\u7F6E"),
        (0, import_react10.createElement)(Btn, { onClick: () => void runHealth(), disabled: busy !== "" }, busy === "health" ? "\u6267\u884C\u4E2D\u2026" : "\u4F53\u68C0")
      )
    },
    (0, import_react10.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      catalogStatus ? (0, import_react10.createElement)(
        Muted,
        null,
        `redteam ${catalogStatus.redteam ?? 0} \xB7 official ${catalogStatus.official ?? 0} \xB7 \u65E0\u6548 ${catalogStatus.broken ?? 0}${catalogStatus.redteamDir ? ` \xB7 ${catalogStatus.redteamDir}` : ""}`
      ) : null,
      items.length === 0 ? (0, import_react10.createElement)(Empty, null, loading ? "\u6280\u80FD\u5217\u8868\u8BFB\u53D6\u4E2D\u2026" : "\u8FD8\u6CA1\u6709\u6280\u80FD\uFF1A\u53EF\u300C\u5B89\u88C5\u5185\u7F6E\u300D\u6216\u4ECE\u8DEF\u5F84\u5BFC\u5165") : (0, import_react10.createElement)(Table, { head: ["\u6280\u80FD", "\u5E93", "\u6821\u9A8C", "\u8BF4\u660E", "\u64CD\u4F5C"], rows: listRows })
    )
  );
  const editorCard = (0, import_react10.createElement)(
    Card,
    {
      title: selected ? `\u7F16\u8F91\uFF1A${selected.id}` : "\u7F16\u8F91\u6280\u80FD",
      actions: (0, import_react10.createElement)(
        Toolbar,
        null,
        selected ? (0, import_react10.createElement)(Badge, { tone: selected.library === "official" ? "warn" : void 0 }, selected.library) : null,
        dirty ? (0, import_react10.createElement)(Badge, { tone: "warn" }, "\u672A\u4FDD\u5B58") : null,
        (0, import_react10.createElement)(Btn, { variant: "primary", onClick: () => void save(), disabled: busy !== "" || !selected }, busy === "save" ? "\u6267\u884C\u4E2D\u2026" : "\u4FDD\u5B58")
      )
    },
    selected ? (0, import_react10.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      (0, import_react10.createElement)(TextArea, {
        value: content,
        onChange: (next) => {
          setContent(next);
          setDirty(true);
        },
        rows: 16,
        placeholder: "SKILL.md \u5185\u5BB9\uFF08\u5FC5\u987B\u5305\u542B --- frontmatter ---\uFF0C\u5176\u4E2D name/description \u5FC5\u586B\uFF09",
        style: { minHeight: 260 }
      }),
      (0, import_react10.createElement)(
        Muted,
        null,
        `${content.length} \u5B57\u7B26${dirty ? " \xB7 \u6709\u672A\u4FDD\u5B58\u6539\u52A8" : ""}${selected.path ? ` \xB7 ${selected.path}` : ""}${selected.library === "official" ? " \xB7 \u5B98\u65B9\u6280\u80FD\u4FDD\u5B58\u540E\u5728 redteam \u6280\u80FD\u5E93\u751F\u6210\u540C\u540D\u526F\u672C" : ""}`
      )
    ) : (0, import_react10.createElement)(Empty, null, "\u70B9\u51FB\u5217\u8868\u91CC\u7684\u6280\u80FD\u540D\u52A0\u8F7D\u6B63\u6587\uFF0C\u6216\u5728\u4E0B\u9762\u65B0\u5EFA\u6A21\u677F")
  );
  const createCard = (0, import_react10.createElement)(
    Card,
    { title: "\u65B0\u5EFA\u6280\u80FD" },
    (0, import_react10.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      (0, import_react10.createElement)(
        Toolbar,
        null,
        (0, import_react10.createElement)(Input, {
          value: newName,
          onChange: setNewName,
          placeholder: "kebab-case \u540D\u79F0\uFF0C\u4F8B\u5982 code-review",
          style: { flex: 1, minWidth: 200 }
        }),
        (0, import_react10.createElement)(Btn, { onClick: () => createTemplate(), disabled: busy !== "" }, "\u65B0\u5EFA\u6A21\u677F")
      ),
      (0, import_react10.createElement)(Muted, null, "\u4F1A\u9884\u586B name/description frontmatter \u5230\u7F16\u8F91\u5668\uFF0C\u70B9\u300C\u4FDD\u5B58\u300D\u624D\u5199\u76D8\u3002")
    )
  );
  const importCard = (0, import_react10.createElement)(
    Card,
    { title: "\u5BFC\u5165\u6280\u80FD" },
    (0, import_react10.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      (0, import_react10.createElement)(
        Toolbar,
        null,
        (0, import_react10.createElement)(Input, {
          value: importValue,
          onChange: setImportValue,
          placeholder: "\u76EE\u5F55\uFF08\u542B SKILL.md\uFF09\u6216 .md \u6587\u4EF6\u8DEF\u5F84",
          style: { flex: 1, minWidth: 240 }
        }),
        (0, import_react10.createElement)(Btn, { onClick: () => void importSkill(), disabled: busy !== "" }, busy === "import" ? "\u6267\u884C\u4E2D\u2026" : "\u5BFC\u5165")
      ),
      (0, import_react10.createElement)(Muted, null, "\u5BFC\u5165\u5230 redteam \u6280\u80FD\u5E93\uFF0C\u540C\u540D\u4F1A\u8986\u76D6\u3002")
    )
  );
  const healthRows = [];
  for (const item of failures) {
    const problems = Array.isArray(item.problems) ? item.problems : [];
    if (problems.length === 0) healthRows.push([item.id, "\u672A\u77E5", "\u2014", "\u4F53\u68C0\u5931\u8D25\u4F46\u6CA1\u6709\u7ED9\u51FA\u539F\u56E0"]);
    for (const problem of problems) {
      healthRows.push([
        item.id,
        problem.kind || "\u2014",
        problem.target || "\u2014",
        (0, import_react10.createElement)("span", { style: { opacity: 0.85 } }, problem.fix || "\u2014")
      ]);
    }
  }
  const healthCard = health === null ? null : (0, import_react10.createElement)(
    Card,
    {
      title: `\u4F53\u68C0\u7ED3\u679C\uFF08${failures.length} \u9879\u5931\u8D25 / ${health.length} \u4E2A\u6280\u80FD\uFF09`,
      actions: (0, import_react10.createElement)(
        Toolbar,
        null,
        (0, import_react10.createElement)(Btn, { onClick: () => void runHealth(), disabled: busy !== "" }, busy === "health" ? "\u6267\u884C\u4E2D\u2026" : "\u91CD\u65B0\u4F53\u68C0"),
        (0, import_react10.createElement)(Btn, { onClick: () => setHealth(null), disabled: busy !== "" }, "\u5173\u95ED")
      )
    },
    failures.length === 0 ? (0, import_react10.createElement)(Muted, null, "\u5168\u90E8\u6280\u80FD\u4F53\u68C0\u901A\u8FC7\uFF1A\u6B63\u6587\u63D0\u5230\u7684\u5DE5\u5177\u4E0E\u73AF\u5883\u53D8\u91CF\u90FD\u5DF2\u5C31\u7EEA\u3002") : (0, import_react10.createElement)(Table, { head: ["\u6280\u80FD", "\u7C7B\u578B", "\u5BF9\u8C61", "\u4FEE\u590D\u5EFA\u8BAE"], rows: healthRows })
  );
  return (0, import_react10.createElement)("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, listCard, editorCard, createCard, importCard, healthCard);
}

// src/client/pages/knowledge.ts
var import_react11 = require("react");
var CATEGORIES = [
  { value: "rce", label: "\u8FDC\u7A0B\u547D\u4EE4\u6267\u884C" },
  { value: "deserialization", label: "\u53CD\u5E8F\u5217\u5316" },
  { value: "file-upload", label: "\u6587\u4EF6\u4E0A\u4F20 getshell" },
  { value: "sqli", label: "SQL \u6CE8\u5165" },
  { value: "unauthorized", label: "\u672A\u6388\u6743\u8BBF\u95EE" },
  { value: "auth-bypass", label: "\u8BA4\u8BC1\u7ED5\u8FC7 / \u8D8A\u6743" },
  { value: "weak-password", label: "\u5F31\u53E3\u4EE4 / \u53E3\u4EE4\u7206\u7834" },
  { value: "ssrf", label: "SSRF" },
  { value: "xxe", label: "XXE" },
  { value: "path-traversal", label: "\u76EE\u5F55\u7A7F\u8D8A / \u4EFB\u610F\u6587\u4EF6\u8BFB" },
  { value: "info-leak", label: "\u4FE1\u606F\u6CC4\u9732" },
  { value: "privesc", label: "\u63D0\u6743 / \u6A2A\u5411" },
  { value: "tunnel", label: "\u96A7\u9053 / \u4EE3\u7406" },
  { value: "other", label: "\u5176\u5B83" }
];
var CATEGORY_OPTIONS = [{ value: "", label: "\u5168\u90E8\u5206\u7C7B" }, ...CATEGORIES];
var SEVERITY_TONE = { critical: "bad", high: "bad", medium: "warn", low: "ok", info: void 0 };
function categoryLabel(code) {
  const hit = CATEGORIES.find((item) => item.value === code);
  return hit ? hit.label : code ? String(code) : "\u5176\u5B83";
}
function verifiedOf(value) {
  return value === true || Number(value ?? 0) > 0;
}
function KnowledgePage(props) {
  const { notify } = props;
  const [q, setQ] = (0, import_react11.useState)("");
  const [category, setCategory] = (0, import_react11.useState)("");
  const [verifiedOnly, setVerifiedOnly] = (0, import_react11.useState)(false);
  const [applied, setApplied] = (0, import_react11.useState)({ q: "", category: "", verified: false });
  const [tick, setTick] = (0, import_react11.useState)(0);
  const [items, setItems] = (0, import_react11.useState)([]);
  const [stats, setStats] = (0, import_react11.useState)({});
  const [templates, setTemplates] = (0, import_react11.useState)([]);
  const [templateDir, setTemplateDir] = (0, import_react11.useState)(null);
  const [loading, setLoading] = (0, import_react11.useState)(false);
  const [busy, setBusy] = (0, import_react11.useState)("");
  const [selected, setSelected] = (0, import_react11.useState)(null);
  const [detail, setDetail] = (0, import_react11.useState)(null);
  const [detailLoading, setDetailLoading] = (0, import_react11.useState)(false);
  const [formCode, setFormCode] = (0, import_react11.useState)(null);
  const [title, setTitle] = (0, import_react11.useState)("");
  const [cve, setCve] = (0, import_react11.useState)("");
  const [content, setContent] = (0, import_react11.useState)("");
  const [draftCategory, setDraftCategory] = (0, import_react11.useState)("other");
  const search = (0, import_react11.useCallback)(() => {
    setApplied({ q: q.trim(), category, verified: verifiedOnly });
    setTick((value) => value + 1);
  }, [category, q, verifiedOnly]);
  (0, import_react11.useEffect)(() => {
    let alive = true;
    setLoading(true);
    const run = async () => {
      try {
        const filter = { limit: 200 };
        if (applied.q !== "") filter.q = applied.q;
        if (applied.category !== "") filter.category = applied.category;
        if (applied.verified) filter.verified = true;
        const [found, hits, stat] = await Promise.all([
          knowledge.search(filter),
          applied.q !== "" ? knowledge.templates(applied.q) : Promise.resolve({ ok: true, items: [] }),
          knowledge.stats()
        ]);
        if (!alive) return;
        if (found.ok === false) throw new Error(found.error ?? "\u68C0\u7D22\u5931\u8D25");
        setItems(found.items ?? []);
        setTemplates((hits.items ?? []).slice(0, 10));
        setTemplateDir(hits.dir ?? null);
        setStats(stat.stats ?? found.stats ?? {});
      } catch (error) {
        if (alive) notify(errorText(error), "bad");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [applied, notify, tick]);
  (0, import_react11.useEffect)(() => {
    if (selected === null || selected === "") {
      setDetail(null);
      setFormCode(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    const run = async () => {
      try {
        const data = await knowledge.get(selected);
        if (!alive) return;
        if (data.ok === false) throw new Error(data.error ?? "\u8BFB\u53D6 POC \u5931\u8D25");
        if (!data.code) throw new Error("POC \u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664");
        setDetail(data);
        if (formCode !== String(data.code)) {
          setTitle(String(data.title ?? ""));
          setCve(String(data.cve ?? ""));
          setContent(String(data.content ?? ""));
          setDraftCategory(String(data.category ?? "other") || "other");
          setFormCode(String(data.code));
        }
      } catch (error) {
        if (alive) {
          notify(errorText(error), "bad");
          setDetail(null);
        }
      } finally {
        if (alive) setDetailLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [notify, selected, tick]);
  const save = (0, import_react11.useCallback)(async () => {
    if (!detail?.code) {
      notify("\u5148\u9009\u4E2D\u4E00\u6761 POC", "bad");
      return;
    }
    if (title.trim() === "") {
      notify("\u6807\u9898\u5FC5\u586B\uFF08\u5199\u6E05\u662F\u4EC0\u4E48\u6F0F\u6D1E/\u7EC4\u4EF6\u7684 POC\uFF09", "bad");
      return;
    }
    setBusy("save");
    try {
      const data = await knowledge.save({
        code: detail.code,
        title: title.trim(),
        cve: cve.trim() || void 0,
        content,
        category: draftCategory,
        verified: true,
        source: "self",
        kind: String(detail.kind ?? "poc")
      });
      if (data.ok === false) throw new Error(data.error ?? "\u4FDD\u5B58\u5931\u8D25");
      notify(`${data.created ? "\u5DF2\u65B0\u5EFA" : "\u5DF2\u66F4\u65B0"} POC ${detail.code}`);
      setTick((value) => value + 1);
    } catch (error) {
      notify(errorText(error), "bad");
    } finally {
      setBusy("");
    }
  }, [content, cve, detail, draftCategory, notify, title]);
  const reuse = (0, import_react11.useCallback)(async () => {
    const code = detail?.code;
    if (!code) {
      notify("\u5148\u9009\u4E2D\u4E00\u6761 POC", "bad");
      return;
    }
    setBusy("use");
    try {
      const data = await knowledge.use(code);
      if (data.ok === false) throw new Error(data.error ?? "\u8BB0\u5F55\u590D\u7528\u5931\u8D25");
      notify(`\u5DF2\u8BB0\u4E00\u6B21\u590D\u7528\uFF1A${code}\uFF0C\u7D2F\u8BA1 ${Number(data.hit_count ?? 0)} \u6B21`);
      setTick((value) => value + 1);
    } catch (error) {
      notify(errorText(error), "bad");
    } finally {
      setBusy("");
    }
  }, [detail, notify]);
  const resultRows = items.map((row) => [
    (0, import_react11.createElement)(
      "span",
      {
        key: `title-${row.code}`,
        title: "\u70B9\u51FB\u52A0\u8F7D\u6B63\u6587",
        style: {
          cursor: "pointer",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          fontWeight: row.code === selected ? 600 : void 0
        },
        onClick: () => setSelected(row.code)
      },
      fmt(row.title ?? row.code)
    ),
    fmt(row.code),
    categoryLabel(row.category),
    (0, import_react11.createElement)(Badge, { tone: verifiedOf(row.verified) ? "ok" : void 0 }, verifiedOf(row.verified) ? "\u5DF2\u9A8C\u8BC1" : "\u672A\u9A8C\u8BC1"),
    fmt(row.hit_count ?? 0)
  ]);
  const statsLine = (0, import_react11.createElement)(
    Toolbar,
    null,
    (0, import_react11.createElement)(Badge, null, `\u603B\u6570 ${stats.total ?? 0}`),
    (0, import_react11.createElement)(Badge, { tone: "ok" }, `\u5DF2\u9A8C\u8BC1 ${stats.verified ?? 0}`),
    (0, import_react11.createElement)(Badge, { tone: "warn" }, `\u590D\u7528\u5408\u8BA1 ${stats.reused ?? 0}`),
    stats.withContent === void 0 ? null : (0, import_react11.createElement)(Muted, null, `\u6709\u6B63\u6587 ${stats.withContent}`)
  );
  const byCategory = (stats.byCategory ?? []).filter((row) => Number(row.n ?? 0) > 0);
  const categoryLine = byCategory.length === 0 ? null : (0, import_react11.createElement)(Muted, null, byCategory.map((row) => `${categoryLabel(row.code)} ${Number(row.n ?? 0)}`).join(" \xB7 "));
  const searchCard = (0, import_react11.createElement)(
    Card,
    { title: "POC \u77E5\u8BC6\u5E93\uFF08\u8DE8\u9776\u6807\u5171\u4EAB\uFF09" },
    (0, import_react11.createElement)(
      Toolbar,
      null,
      (0, import_react11.createElement)(Input, {
        value: q,
        onChange: setQ,
        placeholder: "\u6807\u9898 / CVE / \u7EC4\u4EF6 / \u6B63\u6587\u5173\u952E\u8BCD",
        style: { flex: 1, minWidth: 200 }
      }),
      (0, import_react11.createElement)(Select, { value: category, onChange: setCategory, options: CATEGORY_OPTIONS }),
      (0, import_react11.createElement)(
        Btn,
        { variant: verifiedOnly ? "primary" : void 0, onClick: () => setVerifiedOnly(!verifiedOnly) },
        verifiedOnly ? "\u4EC5\u5DF2\u9A8C\u8BC1 \u2713" : "\u4EC5\u5DF2\u9A8C\u8BC1"
      ),
      (0, import_react11.createElement)(Btn, { variant: "primary", onClick: search, disabled: loading }, loading ? "\u68C0\u7D22\u4E2D\u2026" : "\u641C\u7D22")
    ),
    statsLine,
    categoryLine
  );
  const resultCard = (0, import_react11.createElement)(
    Card,
    {
      title: `\u68C0\u7D22\u7ED3\u679C${loading ? " \xB7 \u52A0\u8F7D\u4E2D\u2026" : ""}`,
      actions: (0, import_react11.createElement)(Muted, null, `${items.length} \u6761`)
    },
    items.length === 0 ? (0, import_react11.createElement)(Empty, null, loading ? "\u52A0\u8F7D\u4E2D\u2026" : applied.q || applied.category || applied.verified ? "\u6CA1\u6709\u547D\u4E2D\uFF1A\u653E\u5BBD\u5173\u952E\u8BCD\u6216\u5206\u7C7B" : "\u77E5\u8BC6\u5E93\u8FD8\u6CA1\u6709 POC") : (0, import_react11.createElement)(Table, { head: ["\u6807\u9898", "code", "\u5F52\u7C7B", "verified", "\u590D\u7528\u6B21\u6570"], rows: resultRows })
  );
  const detailCard = selected === null ? null : (0, import_react11.createElement)(
    Card,
    {
      title: `POC \u8BE6\u60C5 \xB7 ${selected}${detailLoading ? " \xB7 \u52A0\u8F7D\u4E2D\u2026" : ""}`,
      actions: (0, import_react11.createElement)(Btn, { onClick: () => setSelected(null) }, "\u5173\u95ED")
    },
    (0, import_react11.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      detail === null ? (0, import_react11.createElement)(Empty, null, detailLoading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u6CA1\u6709\u53D6\u5230\u8BE5 POC") : (0, import_react11.createElement)(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        (0, import_react11.createElement)(
          Muted,
          null,
          [
            `source ${fmt(detail.source)}`,
            `kind ${fmt(detail.kind)}`,
            `verified ${verifiedOf(detail.verified) ? "\u662F" : "\u5426"}`,
            `\u590D\u7528 ${fmt(detail.hit_count ?? 0)} \u6B21`,
            `\u6587\u4EF6 ${fmt(detail.path)}`
          ].join(" \xB7 ")
        ),
        (0, import_react11.createElement)(
          Toolbar,
          null,
          (0, import_react11.createElement)(Input, { value: title, onChange: setTitle, placeholder: "\u6807\u9898\uFF08\u5FC5\u586B\uFF09", style: { flex: 1, minWidth: 200 } }),
          (0, import_react11.createElement)(Input, { value: cve, onChange: setCve, placeholder: "CVE / \u7F16\u53F7", style: { width: 150 } }),
          (0, import_react11.createElement)(Select, { value: draftCategory, onChange: setDraftCategory, options: CATEGORIES })
        ),
        (0, import_react11.createElement)(TextArea, {
          value: content,
          onChange: setContent,
          rows: 14,
          placeholder: "POC / EXP \u6B63\u6587\uFF08\u547D\u4EE4\u3001\u811A\u672C\u3001\u8BF7\u6C42\u539F\u6587\u5747\u53EF\uFF09"
        }),
        (0, import_react11.createElement)(
          Toolbar,
          null,
          (0, import_react11.createElement)(
            Btn,
            { variant: "primary", onClick: () => void save(), disabled: busy !== "" || detailLoading },
            busy === "save" ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u5230\u77E5\u8BC6\u5E93"
          ),
          (0, import_react11.createElement)(
            Btn,
            { onClick: () => void reuse(), disabled: busy !== "" || detailLoading },
            busy === "use" ? "\u8BB0\u8D26\u4E2D\u2026" : "\u8BB0\u4E00\u6B21\u590D\u7528"
          ),
          (0, import_react11.createElement)(Muted, null, "\u4FDD\u5B58\u4F1A\u5199\u5165 verified:true / source:self\uFF0C\u5E76\u6309\u5F53\u524D\u5F52\u7C7B\u5F52\u6863\u3002")
        )
      )
    )
  );
  const templateCard = (0, import_react11.createElement)(
    Card,
    {
      title: "\u6A21\u677F\u547D\u4E2D",
      actions: (0, import_react11.createElement)(Muted, null, applied.q === "" ? "\u5F85\u68C0\u7D22" : templateDir ? `\u76EE\u5F55 ${templateDir}` : "\u672A\u914D\u7F6E nuclei \u6A21\u677F\u76EE\u5F55")
    },
    applied.q === "" ? (0, import_react11.createElement)(Muted, null, "\u8F93\u5165\u5173\u952E\u8BCD\u5E76\u641C\u7D22\u540E\uFF0C\u5C55\u793A\u672C\u673A nuclei \u6A21\u677F\u7684\u524D 10 \u6761\u547D\u4E2D\u3002") : templates.length === 0 ? (0, import_react11.createElement)(Empty, null, templateDir ? "\u672C\u673A\u6A21\u677F\u6CA1\u6709\u547D\u4E2D" : "\u6CA1\u6709\u627E\u5230 nuclei \u6A21\u677F\u76EE\u5F55\uFF08\u73AF\u5883\u9002\u914D\u91CC\u53EF\u6307\u5B9A\uFF09") : (0, import_react11.createElement)(Table, {
      head: ["\u6A21\u677F\u8DEF\u5F84", "\u540D\u79F0", "\u7B49\u7EA7", "\u6807\u7B7E"],
      rows: templates.map((row) => [
        fmt(row.path),
        fmt(row.name),
        (0, import_react11.createElement)(Badge, { tone: SEVERITY_TONE[String(row.severity ?? "").toLowerCase()] }, fmt(row.severity ?? "\u2014")),
        fmt(row.tags)
      ])
    })
  );
  return (0, import_react11.createElement)(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    searchCard,
    resultCard,
    detailCard,
    templateCard
  );
}

// src/client/pages/env.ts
var import_react12 = require("react");
var MONO6 = "ui-monospace,SFMono-Regular,Menlo,monospace";
var REASON_LABEL = {
  kali: "Kali \u5BBF\u4E3B",
  skipped: "\u5DF2\u786E\u8BA4\u6682\u4E0D\u914D\u7F6E",
  configured: "\u5DF2\u4FDD\u5B58\u5DE5\u5177\u8DEF\u5F84",
  "tools-found": "\u672C\u673A\u5DF2\u627E\u5230\u5DE5\u5177",
  "need-config": "\u5F85\u914D\u7F6E"
};
var REASON_TONE = {
  "need-config": "bad",
  skipped: "warn",
  configured: "ok",
  "tools-found": "ok",
  kali: "ok"
};
function reasonLabel(reason) {
  return REASON_LABEL[reason] ?? (reason || "\u672A\u77E5");
}
function reasonTone(reason, ready) {
  if (!ready) return "bad";
  return REASON_TONE[reason] ?? "ok";
}
function clip3(text, head = 30, tail = 18) {
  if (!text) return "";
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}\u2026${text.slice(-tail)}`;
}
function pathLine(label, value) {
  const text = value ? String(value) : "";
  return (0, import_react12.createElement)(
    Toolbar,
    null,
    (0, import_react12.createElement)("span", { style: { opacity: 0.7, minWidth: 96 } }, label),
    text ? (0, import_react12.createElement)("span", { title: text, style: { fontFamily: MONO6, fontSize: 11.5, opacity: 0.9 } }, clip3(text)) : (0, import_react12.createElement)(Muted, null, "\u672A\u8BBE\u7F6E")
  );
}
function EnvPage(props) {
  const [summary, setSummary] = (0, import_react12.useState)(null);
  const [dir, setDir] = (0, import_react12.useState)("");
  const [loading, setLoading] = (0, import_react12.useState)(true);
  const [busy, setBusy] = (0, import_react12.useState)("");
  const reload = (0, import_react12.useCallback)(async () => {
    setLoading(true);
    try {
      const data = await platform.summary();
      if (data?.ok === false) throw new Error(data.error ?? "\u73AF\u5883\u9002\u914D\u8BFB\u53D6\u5931\u8D25");
      setSummary(data ?? null);
    } catch (error) {
      props.notify(`\u73AF\u5883\u9002\u914D\u8BFB\u53D6\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setLoading(false);
    }
  }, [props.notify]);
  (0, import_react12.useEffect)(() => {
    void reload();
  }, [reload]);
  const assign = (0, import_react12.useCallback)(async () => {
    const target = dir.trim();
    if (!target) {
      props.notify("\u5148\u586B\u6574\u5305\u5DE5\u5177\u76EE\u5F55\uFF0C\u4F8B\u5982 D:\\redteam-toolkit", "bad");
      return;
    }
    setBusy("assign");
    try {
      const result = await platform.assign(target);
      if (result?.ok === false) throw new Error(result.error ?? "\u5206\u914D\u5931\u8D25");
      const assignedCount = Number(result?.assignedCount ?? 0);
      const scanned = Number(result?.scanned ?? 0);
      if (assignedCount === 0) {
        props.notify(`\u6CA1\u6709\u5728 ${result?.dir ?? target} \u91CC\u8BA4\u51FA\u5DE5\u5177\uFF08\u626B\u63CF ${scanned} \u4E2A\u6587\u4EF6\uFF09\uFF0C\u6362\u76EE\u5F55\u6216\u624B\u52A8\u586B\u5199\u8DEF\u5F84`, "bad");
      } else {
        props.notify(
          `\u5DF2\u5206\u914D ${assignedCount} \u4E2A\u5DE5\u5177\uFF08\u626B\u63CF ${scanned} \u4E2A\u6587\u4EF6\uFF09${result?.nucleiTemplatesDir ? " \xB7 \u5DF2\u8BC6\u522B nuclei-templates" : ""}`
        );
      }
      await reload();
    } catch (error) {
      props.notify(`\u5206\u914D\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
    }
  }, [dir, props.notify, reload]);
  const skip = (0, import_react12.useCallback)(async () => {
    setBusy("skip");
    try {
      const data = await platform.save({ envAdaptSkip: true });
      if (data?.ok === false) throw new Error(data.error ?? "\u4FDD\u5B58\u5931\u8D25");
      if (data) setSummary(data);
      props.notify("\u5DF2\u8BB0\u5F55\uFF1A\u6682\u4E0D\u914D\u7F6E\u5DE5\u5177\uFF08\u626B\u63CF\u7C7B\u6280\u80FD\u53EF\u80FD\u4E0D\u53EF\u7528\uFF09");
    } catch (error) {
      props.notify(`\u4FDD\u5B58\u5931\u8D25\uFF1A${errorText(error)}`, "bad");
    } finally {
      setBusy("");
    }
  }, [props.notify]);
  const locked = busy !== "" || loading;
  const loaded = summary !== null;
  const adapt = summary?.adapt ?? {};
  const tools = summary?.tools ?? {};
  const items = Array.isArray(tools.items) ? tools.items : [];
  const found = Number(adapt.found ?? tools.found ?? 0);
  const total = Number(adapt.total ?? tools.total ?? items.length);
  const missing = Number(adapt.missing ?? tools.missing ?? Math.max(total - found, 0));
  const ready = loaded && adapt.ready !== false && adapt.reason !== "need-config";
  const reason = String(adapt.reason ?? "");
  const summaryCard = (0, import_react12.createElement)(
    Card,
    {
      title: "\u73AF\u5883\u9002\u914D\u72B6\u6001",
      actions: (0, import_react12.createElement)(Btn, { onClick: () => void reload(), disabled: locked }, loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0")
    },
    (0, import_react12.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      !loaded ? (0, import_react12.createElement)(Muted, null, loading ? "\u8BFB\u53D6\u4E2D\u2026" : "\u73AF\u5883\u9002\u914D\u8BFB\u53D6\u5931\u8D25\uFF0C\u70B9\u53F3\u4E0A\u89D2\u5237\u65B0\u91CD\u8BD5\u3002") : (0, import_react12.createElement)(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        (0, import_react12.createElement)(
          Toolbar,
          null,
          (0, import_react12.createElement)(Badge, { tone: reasonTone(reason, ready) }, reasonLabel(reason)),
          (0, import_react12.createElement)(Badge, { tone: found >= 2 ? "ok" : found > 0 ? "warn" : "bad" }, `\u5DF2\u627E\u5230 ${found}/${total}`),
          (0, import_react12.createElement)(Badge, { tone: missing > 0 ? "warn" : "ok" }, `\u672A\u627E\u5230 ${missing}`),
          adapt.skipped ? (0, import_react12.createElement)(Badge, { tone: "warn" }, "\u5DF2\u8DF3\u8FC7\u914D\u7F6E") : null,
          adapt.kali ? (0, import_react12.createElement)(Badge, { tone: "ok" }, "Kali") : null
        ),
        (0, import_react12.createElement)(Muted, null, `reason ${reason || "\u2014"} \xB7 found ${found} \xB7 missing ${missing} \xB7 total ${total}`),
        (0, import_react12.createElement)(Muted, null, adapt.message || summary?.hint || "\u6CA1\u6709\u9002\u914D\u8BF4\u660E\u3002"),
        pathLine("\u5DE5\u5177\u7BB1\u76EE\u5F55", summary?.toolkitDir),
        pathLine("nuclei \u6A21\u677F", summary?.nucleiTemplatesDir ?? ""),
        summary?.toolkitExists === false ? (0, import_react12.createElement)(Muted, null, "\u5DE5\u5177\u7BB1\u76EE\u5F55\u8FD8\u4E0D\u5B58\u5728\uFF0C\u53EF\u5148\u5206\u914D\u6574\u5305\u76EE\u5F55\u3002") : null
      )
    )
  );
  const assignCard = (0, import_react12.createElement)(
    Card,
    { title: "\u6574\u5305\u76EE\u5F55\u5206\u914D" },
    (0, import_react12.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8 } },
      (0, import_react12.createElement)(
        Toolbar,
        null,
        (0, import_react12.createElement)(Input, {
          value: dir,
          onChange: setDir,
          placeholder: summary?.toolkitDir ? `\u4F8B\u5982 ${summary.toolkitDir}` : "\u4F8B\u5982 D:\\redteam-toolkit",
          style: { flex: 1, minWidth: 240 }
        }),
        (0, import_react12.createElement)(Btn, { variant: "primary", onClick: () => void assign(), disabled: locked }, busy === "assign" ? "\u6267\u884C\u4E2D\u2026" : "\u5206\u914D"),
        (0, import_react12.createElement)(Btn, { onClick: () => void skip(), disabled: locked }, busy === "skip" ? "\u6267\u884C\u4E2D\u2026" : "\u6682\u4E0D\u914D\u7F6E")
      ),
      (0, import_react12.createElement)(Muted, null, "\u4F1A\u9012\u5F52\u626B\u63CF\u8BE5\u76EE\u5F55\u91CC\u7684 nmap / nuclei / fscan / frp \u7B49\u53EF\u6267\u884C\u6587\u4EF6\u5E76\u5199\u5165\u5DE5\u5177\u8DEF\u5F84\uFF1B\u626B\u63CF\u4E0D\u5230\u4F1A\u63D0\u793A\u5931\u8D25\u3002"),
      summary?.nucleiTemplatesDir ? (0, import_react12.createElement)(Muted, null, `\u5DF2\u8BC6\u522B nuclei \u6A21\u677F\u76EE\u5F55\uFF1A${summary.nucleiTemplatesDir}`) : null
    )
  );
  const tableRows = items.map((item) => [
    (0, import_react12.createElement)("span", { style: { fontFamily: MONO6 }, title: item.label ?? item.id }, item.id),
    item.path ? (0, import_react12.createElement)(Badge, { tone: "ok" }, "\u5DF2\u627E\u5230") : (0, import_react12.createElement)(Badge, { tone: "warn" }, "\u672A\u627E\u5230"),
    item.path ? (0, import_react12.createElement)("span", { title: item.path, style: { fontFamily: MONO6, opacity: 0.85 } }, clip3(item.path)) : (0, import_react12.createElement)("span", { style: { opacity: 0.6 }, title: item.note ?? "" }, item.note ?? "\u2014")
  ]);
  const toolsCard = (0, import_react12.createElement)(
    Card,
    { title: `\u5DE5\u5177\u6E05\u5355\uFF08${found}/${total}\uFF09` },
    items.length === 0 ? (0, import_react12.createElement)(Empty, null, loading ? "\u5DE5\u5177\u6E05\u5355\u8BFB\u53D6\u4E2D\u2026" : "\u6CA1\u6709\u5DE5\u5177\u6E05\u5355\u6570\u636E") : (0, import_react12.createElement)(Table, { head: ["\u5DE5\u5177", "\u72B6\u6001", "\u8DEF\u5F84"], rows: tableRows })
  );
  return (0, import_react12.createElement)("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, summaryCard, assignCard, toolsCard);
}

// src/client/app.ts
var TOP_TABS = [
  { id: "clean", label: "\u6E05\u6D17" },
  { id: "redteam", label: "\u6F14\u7EC3\u53F0" },
  { id: "skills", label: "\u6280\u80FD\u5E93" },
  { id: "knowledge", label: "\u77E5\u8BC6\u5E93" },
  { id: "env", label: "\u73AF\u5883\u9002\u914D" }
];
var DRILL_TABS = [
  { id: "assets", label: "\u8D44\u4EA7\u6D4B\u7ED8" },
  { id: "findings", label: "\u6F0F\u6D1E\u6210\u679C" },
  { id: "sessions", label: "\u4F1A\u8BDD\u96A7\u9053" },
  { id: "agents", label: "\u667A\u80FD\u4F53" },
  { id: "chain", label: "\u653B\u51FB\u94FE" },
  { id: "scores", label: "\u5F97\u5206\u76EE\u6807" },
  { id: "report", label: "\u62A5\u544A" }
];
function App() {
  const [tab, setTab] = (0, import_react13.useState)("clean");
  const [drillTab, setDrillTab] = (0, import_react13.useState)("assets");
  const [engagements, setEngagements] = (0, import_react13.useState)([]);
  const [current, setCurrent] = (0, import_react13.useState)(null);
  const [newName, setNewName] = (0, import_react13.useState)("");
  const [toast, setToast] = (0, import_react13.useState)(null);
  const [tick, setTick] = (0, import_react13.useState)(0);
  const refresh = (0, import_react13.useCallback)(() => setTick((value) => value + 1), []);
  const notify = (0, import_react13.useCallback)((text, tone = "ok") => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3200);
  }, []);
  const load = (0, import_react13.useCallback)(async () => {
    try {
      const data = await redteam.bootstrap();
      setEngagements(data.engagements ?? []);
      setCurrent((prev) => prev ?? data.current ?? null);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "bad");
    }
  }, [notify]);
  (0, import_react13.useEffect)(() => {
    void load();
  }, [load, tick]);
  const openEngagement = (0, import_react13.useCallback)(async () => {
    const name2 = newName.trim();
    if (!name2) return;
    try {
      const opened = await redteam.open(name2, []);
      const id = opened?.engagement?.id;
      if (id) {
        setCurrent(id);
        setNewName("");
        refresh();
        notify(`\u5DF2\u521B\u5EFA\u9776\u6807 ${name2}`);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "bad");
    }
  }, [newName, notify, refresh]);
  const activate = (0, import_react13.useCallback)(
    async (id) => {
      try {
        await redteam.activate(id);
        setCurrent(id);
        refresh();
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error), "bad");
      }
    },
    [notify, refresh]
  );
  const pageProps = { engagement: current, refresh, notify };
  const renderDrill = () => {
    if (!current) {
      return (0, import_react13.createElement)(
        Card,
        { title: "\u8FD8\u6CA1\u6709\u9776\u6807" },
        (0, import_react13.createElement)(Muted, null, "\u8F93\u5165\u653B\u9632\u6F14\u7EC3\u9776\u6807\u5355\u4F4D\u540D\u79F0\uFF0C\u521B\u5EFA\u6F14\u7EC3\u5E76\u5F00\u59CB\u8D44\u4EA7\u6D4B\u7ED8\u3002"),
        (0, import_react13.createElement)(
          Toolbar,
          null,
          (0, import_react13.createElement)(Input, { value: newName, onChange: setNewName, placeholder: "\u4F8B\u5982\uFF1A\u793A\u4F8B\u79D1\u6280\u6709\u9650\u516C\u53F8", style: { flex: 1, minWidth: 220 } }),
          (0, import_react13.createElement)(Btn, { variant: "primary", onClick: () => void openEngagement() }, "\u521B\u5EFA\u9776\u6807")
        )
      );
    }
    switch (drillTab) {
      case "assets":
        return (0, import_react13.createElement)(AssetsPage, pageProps);
      case "findings":
        return (0, import_react13.createElement)(FindingsPage, pageProps);
      case "sessions":
        return (0, import_react13.createElement)(SessionsPage, pageProps);
      case "agents":
        return (0, import_react13.createElement)(AgentsPage, pageProps);
      case "chain":
        return (0, import_react13.createElement)(ChainPage, pageProps);
      case "scores":
        return (0, import_react13.createElement)(ScoresPage, pageProps);
      case "report":
        return (0, import_react13.createElement)(ReportPage, pageProps);
      default:
        return (0, import_react13.createElement)(Empty, null);
    }
  };
  const body = () => {
    if (tab === "clean") return (0, import_react13.createElement)(CleanPage, pageProps);
    if (tab === "skills") return (0, import_react13.createElement)(SkillsPage, pageProps);
    if (tab === "knowledge") return (0, import_react13.createElement)(KnowledgePage, pageProps);
    if (tab === "env") return (0, import_react13.createElement)(EnvPage, pageProps);
    if (!current) return renderDrill();
    return (0, import_react13.createElement)(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      (0, import_react13.createElement)(
        Toolbar,
        null,
        (0, import_react13.createElement)(Select, {
          value: current,
          onChange: (value) => void activate(value),
          options: engagements.length ? engagements.map((item) => ({ value: item.id, label: item.name ? `${item.name}\uFF08${item.id}\uFF09` : item.id })) : [{ value: current, label: current }]
        }),
        (0, import_react13.createElement)(Input, { value: newName, onChange: setNewName, placeholder: "\u65B0\u5EFA\u9776\u6807\u540D\u79F0" }),
        (0, import_react13.createElement)(Btn, { onClick: () => void openEngagement() }, "\u65B0\u5EFA"),
        (0, import_react13.createElement)(Btn, { onClick: refresh }, "\u5237\u65B0")
      ),
      (0, import_react13.createElement)(
        "div",
        { style: { display: "flex", gap: 2, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 6 } },
        ...DRILL_TABS.map(
          (item) => (0, import_react13.createElement)("span", {
            key: item.id,
            className: "dshp-ui-tab",
            "data-on": item.id === drillTab ? "1" : "0",
            onClick: () => setDrillTab(item.id)
          }, item.label)
        )
      ),
      renderDrill()
    );
  };
  return (0, import_react13.createElement)(
    DockShell,
    { title: "dsh-purge-next", tabs: TOP_TABS, active: tab, onTab: (id) => setTab(id), storageKey: "dshp-next-geom" },
    body(),
    toast ? (0, import_react13.createElement)(
      "div",
      {
        style: {
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 80,
          padding: "8px 14px",
          borderRadius: 10,
          fontSize: 12,
          background: toast.tone === "bad" ? "rgba(185,28,28,.92)" : "rgba(22,101,52,.92)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,.35)"
        }
      },
      toast.text
    ) : null
  );
}

// src/client/index.ts
var name = "dsh-purge-next";
var inject = ["slots"];
var Panel = App;
var Dock = App;
function apply(ctx) {
  try {
    if (typeof document !== "undefined" && document.body) document.body.setAttribute("data-dsh-purge-next", "loaded");
  } catch {
  }
  const slots = ctx?.slots;
  if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
  slots.inject("shell.overlay", () => slots.register({ name: "shell.overlay", id: "dsh-purge-next-dock", order: 60 }, App));
}
var index_default = { name, inject, apply, Panel, Dock };

return module.exports;
} });
