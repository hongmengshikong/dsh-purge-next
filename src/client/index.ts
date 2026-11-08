/**
 * 浏览器端入口：浮层面板（清洗 / 演练台两个标签页）。
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { DockShell } from "./ui.js";
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
		zIndex: 60,
		width: 560,
		maxWidth: "calc(100vw - 24px)",
		maxHeight: "80vh",
		display: "flex",
		flexDirection: "column",
		background: "var(--dsw-alias-bg-layer-2, #1b1f27)",
		color: "var(--dsw-alias-label-primary, #e6e6e6)",
		border: "1px solid rgba(255,255,255,.10)",
		borderRadius: 14,
		boxShadow: "0 18px 48px rgba(0,0,0,.38)",
		overflow: "hidden",
		fontSize: 12,
	} as const,
	header: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		padding: "8px 10px",
		background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))",
		borderBottom: "1px solid rgba(255,255,255,.08)",
		cursor: "grab",
		userSelect: "none",
		touchAction: "none",
	} as const,
	grip: { opacity: 0.45, fontSize: 14, letterSpacing: -2, cursor: "grab" } as const,
	brand: { fontSize: 12, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" } as const,
	tabs: { display: "flex", gap: 2, overflowX: "auto", flex: 1, scrollbarWidth: "none" } as const,
	tab: { padding: "3px 9px", borderRadius: 999, cursor: "pointer", opacity: 0.7, whiteSpace: "nowrap", fontSize: 11.5 } as const,
	tabOn: { padding: "3px 9px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 600, opacity: 1, background: "rgba(99,102,241,.22)", color: "#c7d2fe" } as const,
	iconBtn: { border: "none", background: "transparent", color: "inherit", cursor: "pointer", opacity: 0.6, fontSize: 14, lineHeight: 1, padding: "2px 4px" } as const,
	body: { padding: "10px 12px 12px", overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 } as const,
	muted: { opacity: 0.72, lineHeight: 1.5 } as const,
	row: { display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" } as const,
	button: {
		padding: "5px 12px",
		cursor: "pointer",
		borderRadius: 8,
		border: "1px solid rgba(255,255,255,.14)",
		background: "rgba(255,255,255,.06)",
		color: "inherit",
		fontSize: 12,
	} as const,
	primary: {
		padding: "5px 14px",
		cursor: "pointer",
		borderRadius: 8,
		border: "1px solid rgba(99,102,241,.55)",
		background: "rgba(99,102,241,.28)",
		color: "#e0e7ff",
		fontSize: 12,
		fontWeight: 600,
	} as const,
	input: { flex: 1, minWidth: 120, fontSize: 11.5, padding: "4px 8px", borderRadius: 7, border: "1px solid rgba(255,255,255,.14)", background: "rgba(0,0,0,.20)", color: "inherit" } as const,
	area: { width: "100%", fontSize: 11, padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "rgba(0,0,0,.20)", color: "inherit", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", resize: "vertical" } as const,
	table: { width: "100%", borderCollapse: "collapse" as const, marginTop: 2, fontSize: 11.5 } as const,
	th: { padding: "3px 6px", textAlign: "left" as const, opacity: 0.6, fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,.10)" } as const,
	cell: { padding: "2px 6px", borderBottom: "1px solid rgba(255,255,255,.05)", textAlign: "left" as const } as const,
	chip: { padding: "1px 7px", borderRadius: 999, fontSize: 10.5, background: "rgba(255,255,255,.07)" } as const,
	engagement: { padding: "2px 8px", cursor: "pointer", fontSize: 10.5, borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "inherit" } as const,
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
	const [newSkillName, setNewSkillName] = useState("");
	const [skillImportDir, setSkillImportDir] = useState("");
	const [skillHealth, setSkillHealth] = useState<{ id: string; ok: boolean; problems: { kind: string; target: string; fix: string }[] }[]>([]);
	const [skillText, setSkillText] = useState("");
	const [pocQuery, setPocQuery] = useState("");
	const [pocItems, setPocItems] = useState<{ code: string; title: string; category?: string; verified?: number }[]>([]);
	const [pocDetail, setPocDetail] = useState("");
	const [pocTitle, setPocTitle] = useState("");
	const [pocCve, setPocCve] = useState("");
	const [pocBody, setPocBody] = useState("");
	const [pocCategory, setPocCategory] = useState("");
	const [pocVerified, setPocVerified] = useState(false);
	const [envSummary, setEnvSummary] = useState<Record<string, unknown> | null>(null);
	const [envDir, setEnvDir] = useState("");
	const [promptText, setPromptText] = useState("");
	const [busy, setBusy] = useState(false);
	const [pos, setPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 });
	const [collapsed, setCollapsed] = useState(false);
	const dragRef = useRef<{ dx: number; dy: number } | null>(null);

	const defaultPos = useCallback(() => {
		if (typeof window === "undefined") return { x: 16, y: 16 };
		return { x: Math.max(8, window.innerWidth - 600), y: Math.max(8, window.innerHeight - 640) };
	}, []);

	useEffect(() => {
		try {
			const raw = localStorage.getItem("dshp-next-pos");
			if (raw) {
				const saved = JSON.parse(raw) as { x?: number; y?: number };
				if (typeof saved.x === "number" && typeof saved.y === "number") {
					setPos(saved);
					return;
				}
			}
		} catch {
			/* 忽略坏位置 */
		}
		setPos(defaultPos());
	}, [defaultPos]);

	const startDrag = useCallback((event: { clientX: number; clientY: number; button?: number; currentTarget: { setPointerCapture?: (id: number) => void }; pointerId: number }) => {
		if (event.button !== undefined && event.button !== 0) return;
		dragRef.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y };
		event.currentTarget.setPointerCapture?.(event.pointerId);
	}, [pos.x, pos.y]);

	const moveDrag = useCallback((event: { clientX: number; clientY: number; currentTarget: { offsetWidth?: number } }) => {
		const drag = dragRef.current;
		if (!drag) return;
		const width = event.currentTarget.offsetWidth ?? 560;
		const maxX = Math.max(8, (typeof window === "undefined" ? 1200 : window.innerWidth) - width - 8);
		const maxY = Math.max(8, (typeof window === "undefined" ? 900 : window.innerHeight) - 48);
		setPos({
			x: Math.min(Math.max(8, event.clientX - drag.dx), maxX),
			y: Math.min(Math.max(8, event.clientY - drag.dy), maxY),
		});
	}, []);

	const endDrag = useCallback(() => {
		if (!dragRef.current) return;
		dragRef.current = null;
		try {
			localStorage.setItem("dshp-next-pos", JSON.stringify(pos));
		} catch {
			/* 忽略存储失败 */
		}
	}, [pos]);

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

	return h(DockShell, {
		title: "dsh-purge-next",
		tabs: [
			{ id: "clean", label: "清洗" },
			{ id: "redteam", label: "演练台" },
			{ id: "skills", label: "技能库" },
			{ id: "knowledge", label: "知识库" },
			{ id: "env", label: "环境适配" },
		],
		active: tab,
		onTab: (id: string) => setTab(id as typeof tab),
		storageKey: "dshp-next-geom",
	},
		h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
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
							h("input", {
								value: newSkillName,
								onChange: (event: { target: { value: string } }) => setNewSkillName(event.target.value),
								placeholder: "新技能名（kebab-case）",
								style: { flex: 1, fontSize: 11 },
							}),
							h("button", {
								type: "button",
								style: styles.button,
								onClick: () => {
									const name = newSkillName.trim();
									if (!name) return;
									setSkillName(name);
									setSkillText("---\nname: " + name + "\ndescription: 新技能\n---\n\n");
								},
							}, "新建"),
						),
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
						h("div", { style: styles.row },
							h("input", {
								value: skillImportDir,
								onChange: (event: { target: { value: string } }) => setSkillImportDir(event.target.value),
								placeholder: "技能目录或 .md 路径",
								style: { flex: 1, fontSize: 11 },
							}),
							h("button", {
								type: "button",
								disabled: busy || !skillImportDir.trim(),
								onClick: async () => {
									setBusy(true);
									try {
										await postApi({ op: "skillImport", path: skillImportDir });
										await load();
									} finally {
										setBusy(false);
									}
								},
								style: styles.button,
							}, "导入"),
							h("button", {
								type: "button",
								disabled: busy,
								onClick: async () => {
									setBusy(true);
									try {
										await postApi({ op: "skillInstallBundled" });
										await load();
									} finally {
										setBusy(false);
									}
								},
								style: styles.button,
							}, "安装内置技能"),
							h("button", {
								type: "button",
								disabled: busy,
								onClick: async () => {
									const result = await postApi<{ items?: { id: string; ok: boolean; problems: { kind: string; target: string; fix: string }[] }[] }>({ op: "skillHealth" });
									setSkillHealth(result.items ?? []);
								},
								style: styles.button,
							}, "体检"),
						),
						...skillHealth.filter((item) => !item.ok).slice(0, 6).map((item) =>
							h("div", { key: item.id, style: { fontSize: 11, color: "#b45309", marginTop: 2 } },
								item.id + "：" + item.problems.map((problem) => problem.fix).join("；"),
							),
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
							h("select", {
								value: pocCategory,
								onChange: (event: { target: { value: string } }) => setPocCategory(event.target.value),
								style: { fontSize: 11 },
							},
								h("option", { value: "" }, "全部归类"),
								...["rce", "deserialization", "file-upload", "sqli", "unauthorized", "auth-bypass", "weak-password", "ssrf", "xxe", "path-traversal", "info-leak", "privesc", "tunnel", "other"].map((code) =>
									h("option", { key: code, value: code }, code),
								),
							),
							h("label", { style: { fontSize: 11, display: "flex", alignItems: "center", gap: 2 } },
								h("input", {
									type: "checkbox",
									checked: pocVerified,
									onChange: (event: { target: { checked: boolean } }) => setPocVerified(event.target.checked),
								}),
								"仅已验证",
							),
							h("button", {
								type: "button",
								style: styles.button,
								onClick: async () => {
									const found = await postApi<{ items?: { code: string; title: string; category?: string; verified?: number }[] }>({
										op: "pocSearch",
										q: pocQuery,
										category: pocCategory || undefined,
										verified: pocVerified || undefined,
									});
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
										await postApi({ op: "pocSave", poc: { title: pocTitle, cve: pocCve, content: pocBody, verified: true, source: "self", category: pocCategory || undefined } });
										const found = await postApi<{ items?: { code: string; title: string; category?: string; verified?: number }[] }>({
											op: "pocSearch",
											q: pocQuery,
											category: pocCategory || undefined,
											verified: pocVerified || undefined,
										});
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
			),
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
