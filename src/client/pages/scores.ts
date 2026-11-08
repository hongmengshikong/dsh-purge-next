/** 得分目标页：得分看板（summary + items[].hits）、记分表单、达成 / 缺口清单。零依赖，React 由宿主提供。 */
import { createElement as h, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Select, Table, TextArea, Toolbar } from "../ui.js";
import { redteam } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText, fmt } from "./types.js";

const CUSTOM_CODE = "__custom__";
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

interface ScoreHitItem {
	id: number;
	asset_id: number | null;
	vuln_id: number | null;
	step_id: number | null;
	target: string | null;
	evidence: string | null;
	note: string | null;
	points: number;
	points_overridden: boolean;
	port: number | null;
	self_created: boolean;
	capped: boolean;
	capped_reason_kind: string | null;
	capped_by: string | null;
	service: string;
	recorded_by: string | null;
	recorded_at: string | null;
}

interface ScorePointItem {
	id: number;
	code: string;
	name: string;
	category: string | null;
	points: number;
	cap: number;
	dedup_scope: string | null;
	enabled: boolean;
	counted: number;
	earned: number;
	self_created: number;
	capped: number;
	hits: ScoreHitItem[];
}

interface ScoreSummary {
	achievedPoints: number;
	pointCount: number;
	hitPointCount: number;
	hitCount: number;
	countedHits: number;
	selfCreatedHits: number;
	serviceCappedHits: number;
	cappedByDedup: number;
	cappedByRuleLimit: number;
}

interface ScoresData {
	ok?: boolean;
	error?: string;
	items?: ScorePointItem[];
	summary?: ScoreSummary;
}

interface ScoreEntry {
	code: string;
	name: string;
	points: number;
}

interface ScoreReportSummary {
	hits?: number;
	points?: number;
	totalPoints?: number;
	countedHits?: number;
	achievedCount?: number;
	missingCount?: number;
	missingPoints?: number;
	selfCreatedHits?: number;
	serviceCappedHits?: number;
	tunnelsLegit?: number;
	tunnelsSelfOnly?: number;
}

interface ScoreReportData {
	ok?: boolean;
	error?: string;
	items?: (ScoreHitItem & { code?: string; point_name?: string })[];
	achieved?: ScoreEntry[];
	missing?: ScoreEntry[];
	summary?: ScoreReportSummary;
}

interface HitResult {
	ok?: boolean;
	error?: string;
	hit?: ScoreHitItem & { point_code?: string };
}

/** dispatch 用 HTTP 200 返回 ok:false，这里统一转成异常，交给 catch 里的 notify。 */
function unwrap<T extends { ok?: boolean; error?: string }>(data: T | null | undefined): T {
	if (data === null || data === undefined) throw new Error("接口返回为空");
	if (data.ok === false) throw new Error(data.error ?? "请求失败");
	return data;
}

function shortText(value: string | null | undefined, limit = 64): string {
	const text = String(value ?? "").replace(/\s+/g, " ").trim();
	if (text === "") return "—";
	return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function ScoresPage(props: PageProps): unknown {
	const { engagement, notify, refresh } = props;
	const [board, setBoard] = useState<ScoresData | null>(null);
	const [report, setReport] = useState<ScoreReportData | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);
	const [onlyHit, setOnlyHit] = useState(false);
	const [pointCode, setPointCode] = useState(CUSTOM_CODE);
	const [customCode, setCustomCode] = useState("");
	const [evidence, setEvidence] = useState("");
	const [target, setTarget] = useState("");
	const [assetId, setAssetId] = useState("");

	const load = useCallback(async () => {
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
				redteam.scores<ScoresData>(engagement),
				redteam.scoreReport<ScoreReportData>(engagement),
			]);
			setBoard(unwrap(scores));
			setReport(unwrap(scoreReport));
		} catch (err) {
			const text = errorText(err);
			setError(text);
			notify(text, "bad");
		} finally {
			setLoading(false);
		}
	}, [engagement, notify, reloadKey]);

	useEffect(() => {
		void load();
	}, [load]);

	const items = board?.items ?? [];
	const summary = board?.summary ?? null;
	const reportSummary = report?.summary ?? null;
	const achieved = report?.achieved ?? [];
	const missing = report?.missing ?? [];

	const selectedPoint = useMemo(() => items.find((item) => item.code === pointCode) ?? null, [items, pointCode]);

	const codeOptions = useMemo(() => {
		const options = items
			.filter((item) => item.enabled || item.hits.length > 0)
			.map((item) => ({ value: item.code, label: `${item.code} · ${item.name}（${item.points} 分）` }));
		if (pointCode !== CUSTOM_CODE && pointCode !== "" && !options.some((option) => option.value === pointCode)) {
			options.unshift({ value: pointCode, label: `${pointCode}（当前清单里没有，仍可提交）` });
		}
		options.push({ value: CUSTOM_CODE, label: "自定义 code…" });
		return options;
	}, [items, pointCode]);

	const rows = useMemo(() => (onlyHit ? items.filter((item) => item.hits.length > 0) : items), [items, onlyHit]);

	const recentHits = useMemo(() => {
		const flat = items.flatMap((item) => item.hits.map((hit) => ({ hit, code: item.code, name: item.name })));
		flat.sort(
			(a, b) =>
				String(b.hit.recorded_at ?? "").localeCompare(String(a.hit.recorded_at ?? "")) || Number(b.hit.id) - Number(a.hit.id),
		);
		return flat.slice(0, 20);
	}, [items]);

	const reload = useCallback(() => {
		setReloadKey((value) => value + 1);
		refresh();
	}, [refresh]);

	const submit = useCallback(async () => {
		if (!engagement) {
			notify("先在顶部选择靶标", "bad");
			return;
		}
		const code = (pointCode === CUSTOM_CODE ? customCode : pointCode).trim();
		if (code === "") {
			notify("得分点 code 必填：选一个已知 code，或切到“自定义 code”手工填写", "bad");
			return;
		}
		const proof = evidence.trim();
		if (proof === "") {
			notify("evidence 必填：写清账号 / 命令回显 / 数据量 / 文件路径", "bad");
			return;
		}
		let asset: number | undefined;
		const rawAsset = assetId.trim();
		if (rawAsset !== "") {
			const parsed = Number(rawAsset);
			if (!Number.isFinite(parsed) || parsed <= 0) {
				notify("asset_id 需为正整数，或留空", "bad");
				return;
			}
			asset = Math.trunc(parsed);
		}
		setSaving(true);
		try {
			const result = unwrap(
				await redteam.addScoreHit<HitResult>(engagement, {
					code,
					evidence: proof,
					target: target.trim() === "" ? undefined : target.trim(),
					asset_id: asset,
				}),
			);
			notify(`已记分：${result.hit?.point_code || code}`);
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
		return h(Card, { title: "得分目标" }, h(Muted, null, "先在顶部选择或创建靶标，再记录得分。"));
	}

	const summaryBadges = [
		h(Badge, { key: "points", tone: "ok" }, `得分 ${summary ? summary.achievedPoints : 0}`),
		h(Badge, { key: "counted" }, `计分命中 ${summary?.countedHits ?? 0}`),
		h(Badge, { key: "hits" }, `总命中 ${summary?.hitCount ?? 0}`),
		h(
			Badge,
			{ key: "self", tone: (summary?.selfCreatedHits ?? 0) > 0 ? "warn" : undefined },
			`自建 ${summary?.selfCreatedHits ?? 0}`,
		),
		h(
			Badge,
			{ key: "capped", tone: (summary?.serviceCappedHits ?? 0) > 0 ? "warn" : undefined },
			`封顶 ${summary?.serviceCappedHits ?? 0}`,
		),
		h(Muted, { key: "point" }, `得分点 ${summary?.pointCount ?? 0} 个 · 已命中 ${summary?.hitPointCount ?? 0} 个`),
	];

	const scoreRows = rows.map((item) => {
		const selfCreated = item.self_created > 0;
		const capped = item.capped > 0;
		return [
			h(
				"div",
				{ style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
				h("span", { style: { fontWeight: item.counted > 0 ? 600 : 400 } }, item.name),
				h(Badge, null, item.code),
				item.enabled ? null : h(Badge, { tone: "warn" }, "已停用"),
				item.category ? h("span", { style: { opacity: 0.6 } }, item.category) : null,
			),
			h(
				"span",
				null,
				fmt(item.points),
				item.cap > 0 ? h("span", { style: { opacity: 0.55 } }, ` / 封顶 ${item.cap}`) : null,
			),
			h(
				"div",
				{ style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
				h("span", null, String(item.hits.length)),
				item.counted !== item.hits.length ? h("span", { style: { opacity: 0.6 } }, `计 ${item.counted}`) : null,
				selfCreated ? h(Badge, { tone: "warn" }, `自建 ${item.self_created}`) : null,
				capped ? h(Badge, { tone: "warn" }, `封顶 ${item.capped}`) : null,
			),
			h("strong", null, fmt(item.earned)),
		];
	});

	const hitRows = recentHits.map(({ hit, code, name }) => [
		h(
			"div",
			{ style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
			h("span", null, name),
			h(Badge, null, code),
		),
		h("span", null, fmt(hit.points)),
		h(
			"span",
			{
				style: {
					fontFamily: MONO,
					display: "inline-block",
					maxWidth: 180,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					verticalAlign: "bottom",
				},
				title: hit.target ?? "",
			},
			shortText(hit.target, 40),
		),
		h(
			"span",
			{
				style: {
					display: "inline-block",
					maxWidth: 320,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					verticalAlign: "bottom",
				},
				title: hit.evidence ?? "",
			},
			shortText(hit.evidence, 64),
		),
		hit.self_created
			? h(Badge, { tone: "warn" }, "自建不计")
			: hit.capped
				? h(Badge, { tone: "warn" }, "封顶不计")
				: h(Badge, { tone: "ok" }, "计入"),
	]);

	const entryList = (title: string, tone: "ok" | "warn", entries: ScoreEntry[], emptyText: string): unknown =>
		h(
			"div",
			{ style: { flex: "1 1 220px", minWidth: 200, display: "flex", flexDirection: "column", gap: 4 } },
			h(
				"div",
				{ style: { display: "flex", alignItems: "center", gap: 6 } },
				h(Badge, { tone }, title),
				h(Muted, null, `${entries.length} 项`),
			),
			entries.length === 0
				? h(Muted, null, emptyText)
				: h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: 2, maxHeight: 220, overflow: "auto" } },
						...entries.map((entry) =>
							h(
								"div",
								{ key: `${tone}-${entry.code}`, style: { display: "flex", alignItems: "center", gap: 6 } },
								h(
									"span",
									{ style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
									entry.name,
								),
								h(Badge, null, entry.code),
								h("span", { style: { opacity: 0.75, whiteSpace: "nowrap" } }, `${entry.points} 分`),
							),
						),
					),
		);

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		h(
			Card,
			{
				title: "得分看板",
				actions: h(
					Toolbar,
					null,
					h(Btn, { onClick: () => setOnlyHit(!onlyHit) }, onlyHit ? "显示全部得分点" : "只看有命中"),
					h(Btn, { onClick: reload, disabled: loading }, loading ? "加载中…" : "刷新"),
				),
			},
			h(Toolbar, null, ...summaryBadges),
			reportSummary
				? h(
						Muted,
						null,
						`已达成 ${reportSummary.achievedCount ?? 0} 项 · 未命中 ${reportSummary.missingCount ?? 0} 项（缺口 ${reportSummary.missingPoints ?? 0} 分）· 合规入口 ${reportSummary.tunnelsLegit ?? 0} / 自建 ${reportSummary.tunnelsSelfOnly ?? 0}`,
					)
				: null,
			error ? h("div", { style: { color: "#fecaca", marginTop: 4 } }, error) : null,
			rows.length === 0
				? h(Empty, null, loading ? "加载中…" : onlyHit ? "还没有命中的得分点" : "还没有得分点规则")
				: h("div", { style: { overflow: "auto" } }, h(Table, { head: ["得分点", "分值", "命中数", "已得"], rows: scoreRows })),
		),
		h(
			Card,
			{ title: "记一条得分" },
			h(
				"div",
				{ style: { display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: "8px 10px", alignItems: "start" } },
				h(Muted, null, "得分点 *"),
				h(
					"div",
					{ style: { display: "flex", flexDirection: "column", gap: 6 } },
					h(Select, { value: pointCode, onChange: setPointCode, options: codeOptions }),
					pointCode === CUSTOM_CODE
						? h(Input, {
								value: customCode,
								onChange: setCustomCode,
								placeholder: "自定义 code（如 R26 / 自定义-边界突破）",
							})
						: h(
								Muted,
								null,
								selectedPoint
									? `${selectedPoint.name} · 分值 ${selectedPoint.points}${selectedPoint.cap > 0 ? ` · 封顶 ${selectedPoint.cap}` : ""}${selectedPoint.enabled ? "" : " · 已停用"}`
									: "清单里还没有这个 code，提交后按后端返回为准",
							),
				),
				h(Muted, null, "证据 *"),
				h(TextArea, {
					value: evidence,
					onChange: setEvidence,
					rows: 3,
					placeholder: "必填：账号 / 命令回显 / 数据量 / 文件路径",
				}),
				h(Muted, null, "目标"),
				h(Input, { value: target, onChange: setTarget, placeholder: "如 https://host:8443/ 或 host:22，可留空" }),
				h(Muted, null, "资产 ID"),
				h(Input, { value: assetId, onChange: setAssetId, placeholder: "可选：asset.id（数字）" }),
			),
			h(
				"div",
				{ style: { marginTop: 8 } },
				h(
					Toolbar,
					null,
					h(Btn, { variant: "primary", disabled: saving, onClick: () => void submit() }, saving ? "提交中…" : "记录得分"),
					h(Muted, null, "evidence 必填；target 带端口时按服务维度计入封顶"),
				),
			),
		),
		h(
			Card,
			{ title: "达成 / 缺口", actions: h(Muted, null, "来自 scoreReport") },
			h(
				"div",
				{ style: { display: "flex", gap: 12, flexWrap: "wrap" } },
				entryList("已达成", "ok", achieved, "还没有计入的得分点"),
				entryList("未命中", "warn", missing, "所有得分点都命中了"),
			),
		),
		recentHits.length
			? h(
					Card,
					{ title: "最近命中", actions: h(Muted, null, `共 ${summary?.hitCount ?? recentHits.length} 条，显示最近 ${recentHits.length} 条`) },
					h("div", { style: { overflow: "auto" } }, h(Table, { head: ["得分点", "分值", "目标", "证据", "计入"], rows: hitRows })),
				)
			: null,
	);
}
