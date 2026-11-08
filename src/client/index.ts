/**
 * 浏览器端入口：浮层面板（清洗 / 演练台两个标签页）。
 */
import { createElement, useCallback, useEffect, useState } from "react";
import {
	engagementLabel,
	formatBootstrap,
	formatScore,
	formatStatus,
	formatUpdate,
	type BootstrapPayload,
	type ScorePayload,
	type StatusPayload,
	type UpdatePayload,
} from "./view-model.js";

export const name = "dsh-purge-next";
export const inject: string[] = ["slots"];

interface SlotApi {
	inject(slot: string, cb: () => unknown): unknown;
	register(spec: Record<string, unknown>, component: unknown): unknown;
}

interface ClientCtx {
	slots?: SlotApi;
}

interface PatchRow {
	id: number;
	name: string;
	layer: string;
	status: string;
}

interface AssetRow {
	id: number;
	ip: string;
	state?: string | null;
	open_port_count?: number;
}

const h = createElement;
const API = "/redteam/api";

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
	return (await response.json()) as T;
}

const postApi = <T,>(body: Record<string, unknown>): Promise<T> =>
	getJson<T>(API, { method: "POST", body: JSON.stringify(body) });

const styles = {
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
		boxShadow: "0 6px 20px rgba(0,0,0,.12)",
	} as const,
	muted: { opacity: 0.75, marginBottom: 4 } as const,
	row: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" } as const,
	button: { padding: "4px 10px", cursor: "pointer" } as const,
	tab: { padding: "3px 10px", cursor: "pointer", borderBottom: "2px solid transparent" } as const,
	tabOn: { padding: "3px 10px", cursor: "pointer", borderBottom: "2px solid currentColor", fontWeight: 600 } as const,
	table: { width: "100%", borderCollapse: "collapse", marginTop: 6 } as const,
	cell: { padding: "1px 4px", borderBottom: "1px solid rgba(0,0,0,.06)", textAlign: "left" } as const,
};

const COLOR: Record<string, string> = {
	applied: "#166534",
	already: "#166534",
	pending: "#a16207",
	drifted: "#b91c1c",
	missing_file: "#6b7280",
	skipped: "#6b7280",
	na: "#6b7280",
};

export function Panel(): unknown {
	const [tab, setTab] = useState<"clean" | "redteam" | "skills" | "knowledge" | "env">("clean");
	const [status, setStatus] = useState<StatusPayload | null>(null);
	const [boot, setBoot] = useState<BootstrapPayload | null>(null);
	const [score, setScore] = useState<ScorePayload | null>(null);
	const [update, setUpdate] = useState<UpdatePayload | null>(null);
	const [patches, setPatches] = useState<PatchRow[]>([]);
	const [assets, setAssets] = useState<AssetRow[]>([]);
	const [scoreItems, setScoreItems] = useState<{ id: number; code: string; name: string; points: number; counted: number; earned: number; enabled: boolean }[]>([]);
	const [shots, setShots] = useState<{ id: number; label?: string; file: string }[]>([]);
	const [shotView, setShotView] = useState<{ mime: string; data: string } | null>(null);
	const [reportText, setReportText] = useState("");
	const [skills, setSkills] = useState<{ id: string; library: string; description: string; valid: boolean; error: string | null }[]>([]);
	const [skillName, setSkillName] = useState("");
	const [skillText, setSkillText] = useState("");
	const [pocQuery, setPocQuery] = useState("");
	const [pocItems, setPocItems] = useState<{ code: string; title: string; category?: string; verified?: number }[]>([]);
	const [pocDetail, setPocDetail] = useState("");
	const [pocTitle, setPocTitle] = useState("");
	const [pocCve, setPocCve] = useState("");
	const [pocBody, setPocBody] = useState("");
	const [envSummary, setEnvSummary] = useState<Record<string, unknown> | null>(null);
	const [envDir, setEnvDir] = useState("");
	const [promptText, setPromptText] = useState("");
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			const [nextStatus, nextBoot, nextUpdate, nextPatches] = await Promise.all([
				getJson<StatusPayload>("/dsh-purge-next/status"),
				postApi<BootstrapPayload>({ op: "bootstrap" }),
				getJson<UpdatePayload>("/dsh-purge-next/update"),
				getJson<{ rows?: PatchRow[] }>("/dsh-purge-next/patches"),
			]);
			setStatus(nextStatus);
			setBoot(nextBoot);
			setUpdate(nextUpdate);
			setPatches(nextPatches.rows ?? []);
			const current = nextBoot.current;
			if (current) {
				const [nextScore, nextAssets, nextShots] = await Promise.all([
					postApi<ScorePayload & { items?: { id: number; code: string; name: string; points: number; counted: number; earned: number; enabled: boolean }[] }>({ op: "scores", engagement: current }),
					postApi<{ items?: AssetRow[] }>({ op: "assets", engagement: current, limit: 50 }),
					postApi<{ items?: { id: number; label?: string; file: string }[] }>({ op: "shots", engagement: current, limit: 20 }),
				]);
				setScore(nextScore);
				setScoreItems(nextScore.items ?? []);
				setAssets(nextAssets.items ?? []);
				setShots(nextShots.items ?? []);
			} else {
				setScore(null);
				setAssets([]);
			}
			const prompt = await getJson<{ content?: string }>("/dsh-purge-next/prompt");
			setPromptText(prompt.content ?? "");
			try {
				const catalog = await postApi<{ items?: { id: string; library: string; description: string; valid: boolean; error: string | null }[] }>({ op: "skillCatalog" });
				setSkills(catalog.items ?? []);
			} catch {
				setSkills([]);
			}
			try {
				setEnvSummary(await postApi<Record<string, unknown>>({ op: "platformConfigGet" }));
			} catch {
				setEnvSummary(null);
			}
		} catch (error) {
			setStatus({ ok: false, error: error instanceof Error ? error.message : String(error) });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const act = useCallback(
		async (path: string, body?: Record<string, unknown>) => {
			setBusy(true);
			try {
				await getJson(path, body ? { method: "POST", body: JSON.stringify(body) } : { method: "POST" });
				await load();
			} finally {
				setBusy(false);
			}
		},
		[load],
	);

	const activate = useCallback(
		async (id: string) => {
			setBusy(true);
			try {
				await postApi({ op: "activateEngagement", engagement: id });
				await load();
			} finally {
				setBusy(false);
			}
		},
		[load],
	);

	const engagements = boot?.engagements ?? [];
	const shownPatches = patches.filter((row) => row.status !== "na");

	return h(
		"div",
		{ className: "dshp-next-panel", "data-dsh-purge-next": "dock", style: styles.box },
		h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
			h("strong", null, "dsh-purge-next"),
			h("span", { role: "button", style: tab === "clean" ? styles.tabOn : styles.tab, onClick: () => setTab("clean") }, "清洗"),
			h("span", { role: "button", style: tab === "redteam" ? styles.tabOn : styles.tab, onClick: () => setTab("redteam") }, "演练台"),
			h("span", { role: "button", style: tab === "skills" ? styles.tabOn : styles.tab, onClick: () => setTab("skills") }, "技能库"),
			h("span", { role: "button", style: tab === "knowledge" ? styles.tabOn : styles.tab, onClick: () => setTab("knowledge") }, "知识库"),
			h("span", { role: "button", style: tab === "env" ? styles.tabOn : styles.tab, onClick: () => setTab("env") }, "环境适配"),
		),
		tab === "clean"
			? h(
					"div",
					null,
					h("div", { style: styles.muted }, formatStatus(status)),
					h("div", { style: styles.muted }, formatUpdate(update)),
					h("textarea", {
						value: promptText,
						onChange: (event: { target: { value: string } }) => setPromptText(event.target.value),
						placeholder: "prompt-inject.md",
						style: { width: "100%", height: 56, fontSize: 11, marginTop: 4, fontFamily: "monospace" },
					}),
					h("div", { style: styles.row },
						h("button", { type: "button", disabled: busy, onClick: () => void act("/dsh-purge-next/apply"), style: styles.button }, "应用"),
						h("button", { type: "button", disabled: busy, onClick: () => void act("/dsh-purge-next/revert"), style: styles.button }, "还原"),
						h("button", {
							type: "button",
							disabled: busy,
							onClick: () => {
								setBusy(true);
								void getJson("/dsh-purge-next/prompt", { method: "POST", body: JSON.stringify({ content: promptText }) }).finally(() => setBusy(false));
							},
							style: styles.button,
						}, "保存提示词"),
						h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "刷新"),
					),
					h("table", { style: styles.table },
						h("tbody", null, ...shownPatches.map((row) =>
							h("tr", { key: row.id },
								h("td", { style: styles.cell }, `#${row.id}`),
								h("td", { style: styles.cell }, row.name),
								h("td", { style: { ...styles.cell, color: COLOR[row.status] ?? "#333" } }, row.status),
							),
						)),
					),
				)
			: tab === "redteam"
				? h(
					"div",
					null,
					h("div", { style: styles.muted }, formatBootstrap(boot)),
					h("div", { style: styles.muted }, formatScore(score)),
					h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0" } },
						...engagements.map((item) =>
							h("button", { key: item.id, type: "button", disabled: busy, onClick: () => void activate(item.id), style: styles.engagement }, engagementLabel(item, boot?.current)),
						),
					),
					h("table", { style: styles.table },
						h("thead", null, h("tr", null,
							h("th", { style: styles.cell }, "IP"),
							h("th", { style: styles.cell }, "状态"),
							h("th", { style: styles.cell }, "端口"),
						)),
						h("tbody", null, ...assets.map((row) =>
							h("tr", { key: row.id },
								h("td", { style: styles.cell }, row.ip),
								h("td", { style: styles.cell }, row.state ?? "unknown"),
								h("td", { style: styles.cell }, String(row.open_port_count ?? "")),
							),
						)),
					),
					h("table", { style: styles.table },
						h("thead", null, h("tr", null,
							h("th", { style: styles.cell }, "得分点"),
							h("th", { style: styles.cell }, "分值"),
							h("th", { style: styles.cell }, "命中"),
							h("th", { style: styles.cell }, "已得"),
						)),
						h("tbody", null, ...scoreItems.slice(0, 12).map((item) =>
							h("tr", { key: item.code },
								h("td", { style: styles.cell }, item.name),
								h("td", { style: styles.cell }, String(item.points)),
								h("td", { style: styles.cell }, String(item.counted)),
								h("td", { style: styles.cell }, String(item.earned)),
							),
						)),
					),
					shots.length > 0
						? h("div", { style: { marginTop: 6 } },
								h("div", { style: styles.muted }, `证据 ${shots.length} 张`),
								...shots.slice(0, 6).map((shot) =>
									h("button", {
										key: shot.id,
										type: "button",
										style: styles.engagement,
										onClick: async () => {
											const current = boot?.current;
											if (!current) return;
											const data = await postApi<{ mime?: string; data?: string }>({ op: "shotData", engagement: current, id: shot.id });
											if (data.data) setShotView({ mime: data.mime ?? "image/png", data: data.data });
										},
									}, shot.label || shot.file),
								),
								shotView ? h("img", { src: `data:${shotView.mime};base64,${shotView.data}`, style: { maxWidth: "100%", marginTop: 4 } }) : null,
							)
						: null,
					h("div", { style: styles.row },
						h("button", {
							type: "button",
							disabled: busy,
							onClick: async () => {
								const current = boot?.current;
								if (!current) return;
								const report = await postApi<{ markdown?: string }>({ op: "report", engagement: current });
								setReportText(String(report.markdown ?? ""));
							},
							style: styles.button,
						}, "生成报告"),
						h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "刷新"),
					),
					reportText
						? h("pre", { style: { whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", fontSize: 11, marginTop: 6 } }, reportText)
						: null,
				)
			: tab === "skills"
				? h(
						"div",
						null,
						h("div", { style: styles.muted }, "技能 " + skills.length + " 个（redteam + official）"),
						h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0" } },
							...skills.map((item) =>
								h("button", {
									key: item.library + ":" + item.id,
									type: "button",
									style: styles.engagement,
									onClick: async () => {
										setSkillName(item.id);
										const hit = await postApi<{ content?: string }>({ op: "skillRead", name: item.id, library: item.library });
										setSkillText(String(hit.content ?? ""));
									},
								}, (item.valid ? "" : "⚠ ") + item.id + " · " + item.library),
							),
						),
						h("textarea", {
							value: skillText,
							onChange: (event: { target: { value: string } }) => setSkillText(event.target.value),
							placeholder: "SKILL.md",
							style: { width: "100%", height: 120, fontSize: 11, marginTop: 4, fontFamily: "monospace" },
						}),
						h("div", { style: styles.row },
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
								style: styles.button,
							}, "保存技能"),
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
								style: styles.button,
							}, "删除（redteam）"),
							h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "刷新"),
						),
					)
			: tab === "knowledge"
				? h(
						"div",
						null,
						h("div", { style: styles.row },
							h("input", {
								value: pocQuery,
								onChange: (event: { target: { value: string } }) => setPocQuery(event.target.value),
								placeholder: "CVE / 组件 / 关键字",
								style: { flex: 1, fontSize: 11 },
							}),
							h("button", {
								type: "button",
								style: styles.button,
								onClick: async () => {
									const found = await postApi<{ items?: { code: string; title: string; category?: string; verified?: number }[] }>({ op: "pocSearch", q: pocQuery });
									setPocItems(found.items ?? []);
								},
							}, "搜索"),
						),
						h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, margin: "4px 0" } },
							...pocItems.map((item) =>
								h("button", {
									key: item.code,
									type: "button",
									style: styles.engagement,
									onClick: async () => {
										const hit = await postApi<{ content?: string; title?: string; code?: string }>({ op: "pocGet", code: item.code });
										setPocDetail(String(hit.content ?? ""));
										setPocTitle(String(hit.title ?? item.title));
										setPocBody(String(hit.content ?? ""));
									},
								}, (item.verified ? "✓ " : "") + item.title),
							),
						),
						pocDetail ? h("pre", { style: { whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto", fontSize: 11 } }, pocDetail) : null,
						h("input", { value: pocTitle, onChange: (event: { target: { value: string } }) => setPocTitle(event.target.value), placeholder: "标题（回填/保存）", style: { width: "100%", marginTop: 4, fontSize: 11 } }),
						h("input", { value: pocCve, onChange: (event: { target: { value: string } }) => setPocCve(event.target.value), placeholder: "CVE（可选）", style: { width: "100%", marginTop: 4, fontSize: 11 } }),
						h("textarea", {
							value: pocBody,
							onChange: (event: { target: { value: string } }) => setPocBody(event.target.value),
							placeholder: "POC/EXP 正文",
							style: { width: "100%", height: 90, fontSize: 11, marginTop: 4, fontFamily: "monospace" },
						}),
						h("div", { style: styles.row },
							h("button", {
								type: "button",
								disabled: busy || !pocTitle.trim(),
								onClick: async () => {
									setBusy(true);
									try {
										await postApi({ op: "pocSave", poc: { title: pocTitle, cve: pocCve, content: pocBody, verified: true, source: "self" } });
										const found = await postApi<{ items?: { code: string; title: string; category?: string; verified?: number }[] }>({ op: "pocSearch", q: pocQuery });
										setPocItems(found.items ?? []);
									} finally {
										setBusy(false);
									}
								},
								style: styles.button,
							}, "保存到知识库"),
							h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "刷新"),
						),
					)
				: tab === "env"
					? h(
							"div",
							null,
							h("div", { style: styles.muted }, "环境适配 · " + String(((envSummary?.adapt as Record<string, unknown>)?.reason) ?? "未知")),
							h("div", { style: styles.muted }, String(((envSummary?.adapt as Record<string, unknown>)?.message) ?? "")),
							h("div", { style: styles.muted }, "工具 " + String(((envSummary?.tools as Record<string, unknown>)?.found) ?? 0) + "/" + String(((envSummary?.tools as Record<string, unknown>)?.total) ?? 0) + " · 模板 " + String((envSummary?.nucleiTemplatesDir as string) ?? "未配置")),
							h("div", { style: styles.row },
								h("input", {
									value: envDir,
									onChange: (event: { target: { value: string } }) => setEnvDir(event.target.value),
									placeholder: "工具整包目录（自动分配）",
									style: { flex: 1, fontSize: 11 },
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
									style: styles.button,
								}, "分配"),
							),
							h("table", { style: styles.table },
								h("tbody", null, ...(((envSummary?.tools as { items?: { id: string; path: string | null }[] })?.items) ?? []).map((tool) =>
									h("tr", { key: tool.id },
										h("td", { style: styles.cell }, tool.id),
										h("td", { style: { ...styles.cell, color: tool.path ? "#166534" : "#b91c1c" } }, tool.path ? "✓" : "缺失"),
									),
								)),
							),
							h("div", { style: styles.row },
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
									style: styles.button,
								}, "暂不配置"),
								h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "刷新"),
							),
						)
					: null,
	);
}

/** 兼容旧命名。 */
export const Dock = Panel;

export function apply(ctx: ClientCtx): void {
	try {
		if (typeof document !== "undefined" && document.body) document.body.setAttribute("data-dsh-purge-next", "loaded");
	} catch {
		/* 非浏览器环境忽略 */
	}
	const slots = ctx?.slots;
	if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
	slots.inject("shell.overlay", () => slots.register({ name: "shell.overlay", id: "dsh-purge-next-dock", order: 60 }, Panel));
}

export default { name, inject, apply, Panel, Dock };
