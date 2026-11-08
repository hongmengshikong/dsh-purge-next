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
var import_react = require("react");

// src/client/view-model.ts
function formatStatus(status) {
  if (!status) return "\u8BFB\u53D6\u4E2D\u2026";
  if (status.error) return `\u9519\u8BEF\uFF1A${status.error}`;
  const counts = status.counts ?? {};
  const parts = Object.entries(counts).map(([key, value]) => `${key} ${value}`);
  return `\u5FC5\u9700 ${status.required ?? 0} \xB7 \u6F02\u79FB ${(status.drifted ?? []).length} \xB7 ${parts.join(" / ")}`;
}
function formatBootstrap(boot) {
  if (!boot) return "\u9776\u6807\u8BFB\u53D6\u4E2D\u2026";
  if (!boot.ok) return "\u9776\u6807\u8BFB\u53D6\u5931\u8D25";
  const list = boot.engagements ?? [];
  if (list.length === 0) return "\u6682\u65E0\u9776\u6807\uFF08\u7528 redteam_engagement_open \u521B\u5EFA\uFF09";
  const current = boot.current ? `\u5F53\u524D\uFF1A${boot.current}` : "\u672A\u9009\u62E9\u9776\u6807";
  return `${current} \xB7 \u5171 ${list.length} \u4E2A`;
}
function formatScore(score) {
  if (!score) return "\u5F97\u5206\u8BFB\u53D6\u4E2D\u2026";
  if (!score.ok) return `\u5F97\u5206\u8BFB\u53D6\u5931\u8D25${score.error ? `\uFF1A${score.error}` : ""}`;
  const summary = score.summary ?? {};
  return `\u5F97\u5206 ${summary.achievedPoints ?? 0} \xB7 \u8BA1\u5206\u547D\u4E2D ${summary.countedHits ?? 0}/${summary.hitCount ?? 0}`;
}
function engagementLabel(item, current) {
  const text = item.name && item.name !== item.id ? `${item.name} (${item.id})` : item.id;
  const mark = current === item.id ? "\u25CF " : "";
  return mark + (text.length > 24 ? `${text.slice(0, 23)}\u2026` : text);
}
function formatUpdate(payload) {
  if (!payload) return "\u66F4\u65B0\u6E90\u8BFB\u53D6\u4E2D\u2026";
  if (!payload.configured) return payload.note || "\u66F4\u65B0\u6E90\u672A\u914D\u7F6E\uFF08\u4ED3\u5E93\u4E0A\u4F20\u540E\u586B\u5199 URL\uFF09";
  return `\u66F4\u65B0\u6E90\uFF1A${payload.channel ?? "master"} \xB7 ${payload.repo_url ?? ""}`;
}

// src/client/index.ts
var name = "dsh-purge-next";
var inject = ["slots"];
var h = import_react.createElement;
var API = "/redteam/api";
async function getJson(path, init) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  return await response.json();
}
var postApi = (body) => getJson(API, { method: "POST", body: JSON.stringify(body) });
var styles = {
  box: {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 40,
    width: 420,
    maxHeight: "70vh",
    overflow: "auto",
    background: "var(--dsw-alias-bg-layer-2, #fff)",
    border: "1px solid rgba(0,0,0,.12)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12,
    boxShadow: "0 6px 20px rgba(0,0,0,.12)"
  },
  muted: { opacity: 0.75, marginBottom: 4 },
  row: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" },
  button: { padding: "4px 10px", cursor: "pointer" },
  tab: { padding: "3px 10px", cursor: "pointer", borderBottom: "2px solid transparent" },
  tabOn: { padding: "3px 10px", cursor: "pointer", borderBottom: "2px solid currentColor", fontWeight: 600 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 6 },
  cell: { padding: "1px 4px", borderBottom: "1px solid rgba(0,0,0,.06)", textAlign: "left" }
};
var COLOR = {
  applied: "#166534",
  already: "#166534",
  pending: "#a16207",
  drifted: "#b91c1c",
  missing_file: "#6b7280",
  skipped: "#6b7280",
  na: "#6b7280"
};
function Panel() {
  const [tab, setTab] = (0, import_react.useState)("clean");
  const [status, setStatus] = (0, import_react.useState)(null);
  const [boot, setBoot] = (0, import_react.useState)(null);
  const [score, setScore] = (0, import_react.useState)(null);
  const [update, setUpdate] = (0, import_react.useState)(null);
  const [patches, setPatches] = (0, import_react.useState)([]);
  const [assets, setAssets] = (0, import_react.useState)([]);
  const [scoreItems, setScoreItems] = (0, import_react.useState)([]);
  const [shots, setShots] = (0, import_react.useState)([]);
  const [shotView, setShotView] = (0, import_react.useState)(null);
  const [reportText, setReportText] = (0, import_react.useState)("");
  const [skills, setSkills] = (0, import_react.useState)([]);
  const [skillName, setSkillName] = (0, import_react.useState)("");
  const [newSkillName, setNewSkillName] = (0, import_react.useState)("");
  const [skillText, setSkillText] = (0, import_react.useState)("");
  const [pocQuery, setPocQuery] = (0, import_react.useState)("");
  const [pocItems, setPocItems] = (0, import_react.useState)([]);
  const [pocDetail, setPocDetail] = (0, import_react.useState)("");
  const [pocTitle, setPocTitle] = (0, import_react.useState)("");
  const [pocCve, setPocCve] = (0, import_react.useState)("");
  const [pocBody, setPocBody] = (0, import_react.useState)("");
  const [pocCategory, setPocCategory] = (0, import_react.useState)("");
  const [pocVerified, setPocVerified] = (0, import_react.useState)(false);
  const [envSummary, setEnvSummary] = (0, import_react.useState)(null);
  const [envDir, setEnvDir] = (0, import_react.useState)("");
  const [promptText, setPromptText] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const load = (0, import_react.useCallback)(async () => {
    try {
      const [nextStatus, nextBoot, nextUpdate, nextPatches] = await Promise.all([
        getJson("/dsh-purge-next/status"),
        postApi({ op: "bootstrap" }),
        getJson("/dsh-purge-next/update"),
        getJson("/dsh-purge-next/patches")
      ]);
      setStatus(nextStatus);
      setBoot(nextBoot);
      setUpdate(nextUpdate);
      setPatches(nextPatches.rows ?? []);
      const current = nextBoot.current;
      if (current) {
        const [nextScore, nextAssets, nextShots] = await Promise.all([
          postApi({ op: "scores", engagement: current }),
          postApi({ op: "assets", engagement: current, limit: 50 }),
          postApi({ op: "shots", engagement: current, limit: 20 })
        ]);
        setScore(nextScore);
        setScoreItems(nextScore.items ?? []);
        setAssets(nextAssets.items ?? []);
        setShots(nextShots.items ?? []);
      } else {
        setScore(null);
        setAssets([]);
      }
      const prompt = await getJson("/dsh-purge-next/prompt");
      setPromptText(prompt.content ?? "");
      try {
        const catalog = await postApi({ op: "skillCatalog" });
        setSkills(catalog.items ?? []);
      } catch {
        setSkills([]);
      }
      try {
        setEnvSummary(await postApi({ op: "platformConfigGet" }));
      } catch {
        setEnvSummary(null);
      }
    } catch (error) {
      setStatus({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }, []);
  (0, import_react.useEffect)(() => {
    void load();
  }, [load]);
  const act = (0, import_react.useCallback)(
    async (path, body) => {
      setBusy(true);
      try {
        await getJson(path, body ? { method: "POST", body: JSON.stringify(body) } : { method: "POST" });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load]
  );
  const activate = (0, import_react.useCallback)(
    async (id) => {
      setBusy(true);
      try {
        await postApi({ op: "activateEngagement", engagement: id });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load]
  );
  const engagements = boot?.engagements ?? [];
  const shownPatches = patches.filter((row) => row.status !== "na");
  return h(
    "div",
    { className: "dshp-next-panel", "data-dsh-purge-next": "dock", style: styles.box },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
      h("strong", null, "dsh-purge-next"),
      h("span", { role: "button", style: tab === "clean" ? styles.tabOn : styles.tab, onClick: () => setTab("clean") }, "\u6E05\u6D17"),
      h("span", { role: "button", style: tab === "redteam" ? styles.tabOn : styles.tab, onClick: () => setTab("redteam") }, "\u6F14\u7EC3\u53F0"),
      h("span", { role: "button", style: tab === "skills" ? styles.tabOn : styles.tab, onClick: () => setTab("skills") }, "\u6280\u80FD\u5E93"),
      h("span", { role: "button", style: tab === "knowledge" ? styles.tabOn : styles.tab, onClick: () => setTab("knowledge") }, "\u77E5\u8BC6\u5E93"),
      h("span", { role: "button", style: tab === "env" ? styles.tabOn : styles.tab, onClick: () => setTab("env") }, "\u73AF\u5883\u9002\u914D")
    ),
    tab === "clean" ? h(
      "div",
      null,
      h("div", { style: styles.muted }, formatStatus(status)),
      h("div", { style: styles.muted }, formatUpdate(update)),
      h("textarea", {
        value: promptText,
        onChange: (event) => setPromptText(event.target.value),
        placeholder: "prompt-inject.md",
        style: { width: "100%", height: 56, fontSize: 11, marginTop: 4, fontFamily: "monospace" }
      }),
      h(
        "div",
        { style: styles.row },
        h("button", { type: "button", disabled: busy, onClick: () => void act("/dsh-purge-next/apply"), style: styles.button }, "\u5E94\u7528"),
        h("button", { type: "button", disabled: busy, onClick: () => void act("/dsh-purge-next/revert"), style: styles.button }, "\u8FD8\u539F"),
        h("button", {
          type: "button",
          disabled: busy,
          onClick: () => {
            setBusy(true);
            void getJson("/dsh-purge-next/prompt", { method: "POST", body: JSON.stringify({ content: promptText }) }).finally(() => setBusy(false));
          },
          style: styles.button
        }, "\u4FDD\u5B58\u63D0\u793A\u8BCD"),
        h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "\u5237\u65B0")
      ),
      h(
        "table",
        { style: styles.table },
        h("tbody", null, ...shownPatches.map(
          (row) => h(
            "tr",
            { key: row.id },
            h("td", { style: styles.cell }, `#${row.id}`),
            h("td", { style: styles.cell }, row.name),
            h("td", { style: { ...styles.cell, color: COLOR[row.status] ?? "#333" } }, row.status)
          )
        ))
      )
    ) : tab === "redteam" ? h(
      "div",
      null,
      h("div", { style: styles.muted }, formatBootstrap(boot)),
      h("div", { style: styles.muted }, formatScore(score)),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0" } },
        ...engagements.map(
          (item) => h("button", { key: item.id, type: "button", disabled: busy, onClick: () => void activate(item.id), style: styles.engagement }, engagementLabel(item, boot?.current))
        )
      ),
      h(
        "table",
        { style: styles.table },
        h("thead", null, h(
          "tr",
          null,
          h("th", { style: styles.cell }, "IP"),
          h("th", { style: styles.cell }, "\u72B6\u6001"),
          h("th", { style: styles.cell }, "\u7AEF\u53E3")
        )),
        h("tbody", null, ...assets.map(
          (row) => h(
            "tr",
            { key: row.id },
            h("td", { style: styles.cell }, row.ip),
            h("td", { style: styles.cell }, row.state ?? "unknown"),
            h("td", { style: styles.cell }, String(row.open_port_count ?? ""))
          )
        ))
      ),
      h(
        "table",
        { style: styles.table },
        h("thead", null, h(
          "tr",
          null,
          h("th", { style: styles.cell }, "\u5F97\u5206\u70B9"),
          h("th", { style: styles.cell }, "\u5206\u503C"),
          h("th", { style: styles.cell }, "\u547D\u4E2D"),
          h("th", { style: styles.cell }, "\u5DF2\u5F97")
        )),
        h("tbody", null, ...scoreItems.slice(0, 12).map(
          (item) => h(
            "tr",
            { key: item.code },
            h("td", { style: styles.cell }, item.name),
            h("td", { style: styles.cell }, String(item.points)),
            h("td", { style: styles.cell }, String(item.counted)),
            h("td", { style: styles.cell }, String(item.earned))
          )
        ))
      ),
      shots.length > 0 ? h(
        "div",
        { style: { marginTop: 6 } },
        h("div", { style: styles.muted }, `\u8BC1\u636E ${shots.length} \u5F20`),
        ...shots.slice(0, 6).map(
          (shot) => h("button", {
            key: shot.id,
            type: "button",
            style: styles.engagement,
            onClick: async () => {
              const current = boot?.current;
              if (!current) return;
              const data = await postApi({ op: "shotData", engagement: current, id: shot.id });
              if (data.data) setShotView({ mime: data.mime ?? "image/png", data: data.data });
            }
          }, shot.label || shot.file)
        ),
        shotView ? h("img", { src: `data:${shotView.mime};base64,${shotView.data}`, style: { maxWidth: "100%", marginTop: 4 } }) : null
      ) : null,
      h(
        "div",
        { style: styles.row },
        h("button", {
          type: "button",
          disabled: busy,
          onClick: async () => {
            const current = boot?.current;
            if (!current) return;
            const report = await postApi({ op: "report", engagement: current });
            setReportText(String(report.markdown ?? ""));
          },
          style: styles.button
        }, "\u751F\u6210\u62A5\u544A"),
        h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "\u5237\u65B0")
      ),
      reportText ? h("pre", { style: { whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", fontSize: 11, marginTop: 6 } }, reportText) : null
    ) : tab === "skills" ? h(
      "div",
      null,
      h("div", { style: styles.muted }, "\u6280\u80FD " + skills.length + " \u4E2A\uFF08redteam + official\uFF09"),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0" } },
        ...skills.map(
          (item) => h("button", {
            key: item.library + ":" + item.id,
            type: "button",
            style: styles.engagement,
            onClick: async () => {
              setSkillName(item.id);
              const hit = await postApi({ op: "skillRead", name: item.id, library: item.library });
              setSkillText(String(hit.content ?? ""));
            }
          }, (item.valid ? "" : "\u26A0 ") + item.id + " \xB7 " + item.library)
        )
      ),
      h("textarea", {
        value: skillText,
        onChange: (event) => setSkillText(event.target.value),
        placeholder: "SKILL.md",
        style: { width: "100%", height: 120, fontSize: 11, marginTop: 4, fontFamily: "monospace" }
      }),
      h(
        "div",
        { style: styles.row },
        h("input", {
          value: newSkillName,
          onChange: (event) => setNewSkillName(event.target.value),
          placeholder: "\u65B0\u6280\u80FD\u540D\uFF08kebab-case\uFF09",
          style: { flex: 1, fontSize: 11 }
        }),
        h("button", {
          type: "button",
          style: styles.button,
          onClick: () => {
            const name2 = newSkillName.trim();
            if (!name2) return;
            setSkillName(name2);
            setSkillText("---\nname: " + name2 + "\ndescription: \u65B0\u6280\u80FD\n---\n\n");
          }
        }, "\u65B0\u5EFA")
      ),
      h(
        "div",
        { style: styles.row },
        h("button", {
          type: "button",
          disabled: busy || !skillName,
          onClick: async () => {
            setBusy(true);
            try {
              await postApi({ op: "skillSave", name: skillName, content: skillText });
              await load();
            } finally {
              setBusy(false);
            }
          },
          style: styles.button
        }, "\u4FDD\u5B58\u6280\u80FD"),
        h("button", {
          type: "button",
          disabled: busy || !skillName,
          onClick: async () => {
            setBusy(true);
            try {
              await postApi({ op: "skillDelete", name: skillName });
              setSkillText("");
              await load();
            } finally {
              setBusy(false);
            }
          },
          style: styles.button
        }, "\u5220\u9664\uFF08redteam\uFF09"),
        h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "\u5237\u65B0")
      )
    ) : tab === "knowledge" ? h(
      "div",
      null,
      h(
        "div",
        { style: styles.row },
        h("input", {
          value: pocQuery,
          onChange: (event) => setPocQuery(event.target.value),
          placeholder: "CVE / \u7EC4\u4EF6 / \u5173\u952E\u5B57",
          style: { flex: 1, fontSize: 11 }
        }),
        h(
          "select",
          {
            value: pocCategory,
            onChange: (event) => setPocCategory(event.target.value),
            style: { fontSize: 11 }
          },
          h("option", { value: "" }, "\u5168\u90E8\u5F52\u7C7B"),
          ...["rce", "deserialization", "file-upload", "sqli", "unauthorized", "auth-bypass", "weak-password", "ssrf", "xxe", "path-traversal", "info-leak", "privesc", "tunnel", "other"].map(
            (code) => h("option", { key: code, value: code }, code)
          )
        ),
        h(
          "label",
          { style: { fontSize: 11, display: "flex", alignItems: "center", gap: 2 } },
          h("input", {
            type: "checkbox",
            checked: pocVerified,
            onChange: (event) => setPocVerified(event.target.checked)
          }),
          "\u4EC5\u5DF2\u9A8C\u8BC1"
        ),
        h("button", {
          type: "button",
          style: styles.button,
          onClick: async () => {
            const found = await postApi({
              op: "pocSearch",
              q: pocQuery,
              category: pocCategory || void 0,
              verified: pocVerified || void 0
            });
            setPocItems(found.items ?? []);
          }
        }, "\u641C\u7D22")
      ),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0" } },
        ...pocItems.map(
          (item) => h("button", {
            key: item.code,
            type: "button",
            style: styles.engagement,
            onClick: async () => {
              const hit = await postApi({ op: "pocGet", code: item.code });
              setPocDetail(String(hit.content ?? ""));
              setPocTitle(String(hit.title ?? item.title));
              setPocBody(String(hit.content ?? ""));
            }
          }, (item.verified ? "\u2713 " : "") + item.title)
        )
      ),
      pocDetail ? h("pre", { style: { whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto", fontSize: 11 } }, pocDetail) : null,
      h("input", { value: pocTitle, onChange: (event) => setPocTitle(event.target.value), placeholder: "\u6807\u9898\uFF08\u56DE\u586B/\u4FDD\u5B58\uFF09", style: { width: "100%", marginTop: 4, fontSize: 11 } }),
      h("input", { value: pocCve, onChange: (event) => setPocCve(event.target.value), placeholder: "CVE\uFF08\u53EF\u9009\uFF09", style: { width: "100%", marginTop: 4, fontSize: 11 } }),
      h("textarea", {
        value: pocBody,
        onChange: (event) => setPocBody(event.target.value),
        placeholder: "POC/EXP \u6B63\u6587",
        style: { width: "100%", height: 90, fontSize: 11, marginTop: 4, fontFamily: "monospace" }
      }),
      h(
        "div",
        { style: styles.row },
        h("button", {
          type: "button",
          disabled: busy || !pocTitle.trim(),
          onClick: async () => {
            setBusy(true);
            try {
              await postApi({ op: "pocSave", poc: { title: pocTitle, cve: pocCve, content: pocBody, verified: true, source: "self", category: pocCategory || void 0 } });
              const found = await postApi({
                op: "pocSearch",
                q: pocQuery,
                category: pocCategory || void 0,
                verified: pocVerified || void 0
              });
              setPocItems(found.items ?? []);
            } finally {
              setBusy(false);
            }
          },
          style: styles.button
        }, "\u4FDD\u5B58\u5230\u77E5\u8BC6\u5E93"),
        h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "\u5237\u65B0")
      )
    ) : tab === "env" ? h(
      "div",
      null,
      h("div", { style: styles.muted }, "\u73AF\u5883\u9002\u914D \xB7 " + String(envSummary?.adapt?.reason ?? "\u672A\u77E5")),
      h("div", { style: styles.muted }, String(envSummary?.adapt?.message ?? "")),
      h("div", { style: styles.muted }, "\u5DE5\u5177 " + String(envSummary?.tools?.found ?? 0) + "/" + String(envSummary?.tools?.total ?? 0) + " \xB7 \u6A21\u677F " + String(envSummary?.nucleiTemplatesDir ?? "\u672A\u914D\u7F6E")),
      h(
        "div",
        { style: styles.row },
        h("input", {
          value: envDir,
          onChange: (event) => setEnvDir(event.target.value),
          placeholder: "\u5DE5\u5177\u6574\u5305\u76EE\u5F55\uFF08\u81EA\u52A8\u5206\u914D\uFF09",
          style: { flex: 1, fontSize: 11 }
        }),
        h("button", {
          type: "button",
          disabled: busy || !envDir.trim(),
          onClick: async () => {
            setBusy(true);
            try {
              await postApi({ op: "platformAssignToolkit", dir: envDir });
              await load();
            } finally {
              setBusy(false);
            }
          },
          style: styles.button
        }, "\u5206\u914D")
      ),
      h(
        "table",
        { style: styles.table },
        h("tbody", null, ...(envSummary?.tools?.items ?? []).map(
          (tool) => h(
            "tr",
            { key: tool.id },
            h("td", { style: styles.cell }, tool.id),
            h("td", { style: { ...styles.cell, color: tool.path ? "#166534" : "#b91c1c" } }, tool.path ? "\u2713" : "\u7F3A\u5931")
          )
        ))
      ),
      h(
        "div",
        { style: styles.row },
        h("button", {
          type: "button",
          disabled: busy,
          onClick: async () => {
            setBusy(true);
            try {
              await postApi({ op: "platformConfigSave", config: { envAdaptSkip: true } });
              await load();
            } finally {
              setBusy(false);
            }
          },
          style: styles.button
        }, "\u6682\u4E0D\u914D\u7F6E"),
        h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "\u5237\u65B0")
      )
    ) : null
  );
}
var Dock = Panel;
function apply(ctx) {
  try {
    if (typeof document !== "undefined" && document.body) document.body.setAttribute("data-dsh-purge-next", "loaded");
  } catch {
  }
  const slots = ctx?.slots;
  if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
  slots.inject("shell.overlay", () => slots.register({ name: "shell.overlay", id: "dsh-purge-next-dock", order: 60 }, Panel));
}
var index_default = { name, inject, apply, Panel, Dock };

return module.exports;
} });
