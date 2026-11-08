/** 漏洞成果页：漏洞 / 凭据 / 访问 / 证据 / 截图 / HTTP 证据 / 攻击文件 七个子视图。 */
import { createElement as h, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Select, Table, TextArea, Toolbar } from "../ui.js";
import { redteam } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText, fmt } from "./types.js";

type View = "vulns" | "creds" | "access" | "evidence" | "shots" | "http" | "files";

type Res<T> = T & {
	ok?: boolean;
	error?: string;
};

interface VulnRow {
	id: number;
	asset_id?: number | null;
	cve?: string | null;
	title?: string | null;
	severity?: string | null;
	status?: string | null;
	target?: string | null;
	gained?: string | null;
	confidence?: number | null;
	found_at?: string | null;
}

interface VulnStats {
	total?: number;
	bySeverity?: Record<string, number>;
	byStatus?: Record<string, number>;
	withGained?: number;
	withEvidence?: number;
	targetGroups?: number;
}

interface CredentialRow {
	id: number;
	host?: string | null;
	username?: string | null;
	secret_type?: string | null;
	secret_value?: string | null;
	privilege?: string | null;
	source?: string | null;
	found_at?: string | null;
}

interface AccessRow {
	id: number;
	host?: string | null;
	username?: string | null;
	method?: string | null;
	privilege?: string | null;
	session_ref?: string | null;
	obtained_at?: string | null;
}

interface EvidenceRow {
	ev_id?: string;
	operation?: string;
	confidence?: string;
	authority?: string;
	recorded_at?: string | null;
	source_agent?: string | null;
	parameters?: unknown;
	result?: unknown;
	limitations?: unknown;
}

interface ShotRow {
	id: number;
	label?: string | null;
	file?: string | null;
	kind?: string | null;
	mime?: string | null;
	bytes?: number | null;
	width?: number | null;
	height?: number | null;
	captured_at?: string | null;
	created_at?: string | null;
}

interface HttpRow {
	id: number;
	label?: string | null;
	method?: string | null;
	url?: string | null;
	status?: number | null;
	request?: string | null;
	response?: string | null;
	captured_at?: string | null;
}

interface FileRow {
	id: number;
	target?: string | null;
	kind?: string | null;
	name?: string | null;
	path?: string | null;
	description?: string | null;
	created_at?: string | null;
}

const VIEWS: { id: View; label: string }[] = [
	{ id: "vulns", label: "漏洞" },
	{ id: "creds", label: "凭据" },
	{ id: "access", label: "访问" },
	{ id: "evidence", label: "证据" },
	{ id: "shots", label: "截图" },
	{ id: "http", label: "HTTP 证据" },
	{ id: "files", label: "攻击文件" },
];

const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const STATUSES = ["candidate", "confirmed", "exploited", "false_positive", "fixed"];
const CONFIDENCES = ["observed", "claimed", "derived", "inferred"];
const AUTHORITIES = ["tool-output", "database-record", "screenshot", "request-replay", "subagent-report", "operator-input"];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const SEVERITY_LABEL: Record<string, string> = { critical: "严重", high: "高危", medium: "中危", low: "低危", info: "信息" };
const STATUS_LABEL: Record<string, string> = {
	candidate: "候选",
	confirmed: "已确认",
	exploited: "已利用",
	false_positive: "误报",
	fixed: "已修复",
};

const PRE_STYLE: Record<string, string | number> = {
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
	fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
};

const MONO_STYLE: Record<string, string> = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", wordBreak: "break-all" };

function check<T>(data: Res<T>): T {
	if (data.ok === false) throw new Error(data.error || "接口返回失败");
	return data;
}

function pretty(value: unknown): string {
	try {
		const text = JSON.stringify(value, null, 2);
		return text === undefined ? String(value) : text;
	} catch {
		return String(value);
	}
}

function sevTone(severity: string): "bad" | "warn" | undefined {
	if (severity === "critical" || severity === "high") return "bad";
	if (severity === "medium") return "warn";
	return undefined;
}

function statusTone(status: string): "ok" | "warn" | "bad" | undefined {
	if (status === "exploited") return "ok";
	if (status === "confirmed") return "warn";
	if (status === "false_positive") return "bad";
	return undefined;
}

function confidenceTone(confidence: string): "ok" | "warn" | undefined {
	if (confidence === "observed") return "ok";
	if (confidence === "claimed" || confidence === "inferred") return "warn";
	return undefined;
}

function httpTone(status: number | null | undefined): "ok" | "warn" | "bad" | undefined {
	if (status === null || status === undefined) return undefined;
	if (status >= 500) return "bad";
	if (status >= 400) return "warn";
	if (status >= 200) return "ok";
	return undefined;
}

function shortId(value: unknown): string {
	const text = String(value ?? "");
	return text.length > 16 ? `${text.slice(0, 16)}…` : text || "—";
}

export function FindingsPage(props: PageProps): unknown {
	const eng = props.engagement ?? "";
	const notify = props.notify;
	const refresh = props.refresh;

	const [view, setView] = useState<View>("vulns");
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);

	const [vulnItems, setVulnItems] = useState<VulnRow[]>([]);
	const [stats, setStats] = useState<VulnStats | null>(null);
	const [vulnForm, setVulnForm] = useState({ title: "", severity: "medium", target: "", asset_id: "" });

	const [credItems, setCredItems] = useState<CredentialRow[]>([]);
	const [credForm, setCredForm] = useState({ host: "", username: "", secret_type: "password", secret_value: "", privilege: "" });

	const [accessItems, setAccessItems] = useState<AccessRow[]>([]);
	const [accessForm, setAccessForm] = useState({ host: "", username: "", method: "", privilege: "", session_ref: "" });

	const [evidenceItems, setEvidenceItems] = useState<EvidenceRow[]>([]);
	const [evidenceOpen, setEvidenceOpen] = useState("");
	const [evidenceForm, setEvidenceForm] = useState({ operation: "", result: "", confidence: "observed", authority: "tool-output" });

	const [shotItems, setShotItems] = useState<ShotRow[]>([]);
	const [shotForm, setShotForm] = useState({ label: "", data: "", kind: "screenshot", mime: "image/png" });
	const [shotView, setShotView] = useState<{ id: number; mime: string; data: string } | null>(null);
	const [shotLoadingId, setShotLoadingId] = useState<number | null>(null);

	const [httpItems, setHttpItems] = useState<HttpRow[]>([]);
	const [httpOpen, setHttpOpen] = useState<number | null>(null);
	const [httpForm, setHttpForm] = useState({ method: "GET", url: "", status: "200", request: "", response: "", label: "" });

	const [fileItems, setFileItems] = useState<FileRow[]>([]);
	const [fileForm, setFileForm] = useState({ target: "", name: "", kind: "poc", content: "", description: "" });

	/** Select 没有 disabled 属性，双击/连点只能靠 ref 兜住重复提交。 */
	const busyRef = useRef(false);

	const load = useCallback(async (): Promise<void> => {
		if (!eng) return;
		setLoading(true);
		let reported = false;
		const report = (error: unknown): void => {
			if (reported) return;
			reported = true;
			notify(errorText(error), "bad");
		};
		const grab = async <T>(promise: Promise<Res<T>>, fallback: T): Promise<T> => {
			try {
				return check(await promise);
			} catch (error) {
				report(error);
				return fallback;
			}
		};
		try {
			const [vulns, statsRes, creds, accesses, evidence, shots, http, files] = await Promise.all([
				grab(redteam.vulns<Res<{ items?: VulnRow[] }>>(eng), { items: [] as VulnRow[] }),
				grab(redteam.vulnStats<Res<{ stats?: VulnStats }>>(eng), { stats: undefined } as { stats?: VulnStats }),
				grab(redteam.credentials<Res<{ items?: CredentialRow[] }>>(eng), { items: [] as CredentialRow[] }),
				grab(redteam.access<Res<{ items?: AccessRow[] }>>(eng), { items: [] as AccessRow[] }),
				grab(redteam.evidenceList<Res<{ items?: EvidenceRow[] }>>(eng, { limit: 100 }), { items: [] as EvidenceRow[] }),
				grab(redteam.shots<Res<{ items?: ShotRow[] }>>(eng, { limit: 100 }), { items: [] as ShotRow[] }),
				grab(redteam.httpEvidence<Res<{ items?: HttpRow[] }>>(eng), { items: [] as HttpRow[] }),
				grab(redteam.attackFiles<Res<{ items?: FileRow[] }>>(eng), { items: [] as FileRow[] }),
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

	useEffect(() => {
		void load();
	}, [load]);

	const run = useCallback(
		async (work: () => Promise<void>): Promise<void> => {
			if (!eng) {
				notify("请先创建或选择靶标", "bad");
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
		[eng, load, notify, refresh],
	);

	/* ── 写操作 ─────────────────────────────────────────────── */

	const submitVuln = (): void => {
		const title = vulnForm.title.trim();
		if (!title) {
			notify("漏洞标题必填", "bad");
			return;
		}
		const assetId = vulnForm.asset_id.trim() === "" ? null : Number(vulnForm.asset_id);
		if (assetId !== null && !Number.isFinite(assetId)) {
			notify("asset_id 必须是数字", "bad");
			return;
		}
		void run(async () => {
			check(
				await redteam.addVuln<Res<{ id?: number }>>(eng, {
					title,
					severity: vulnForm.severity,
					target: vulnForm.target.trim() || null,
					asset_id: assetId,
				}),
			);
			setVulnForm({ title: "", severity: "medium", target: "", asset_id: "" });
			notify(`漏洞「${title}」已记录`);
		});
	};

	const changeVulnStatus = (row: VulnRow, status: string): void => {
		void run(async () => {
			check(await redteam.updateVuln<Res<Record<string, unknown>>>(eng, row.id, { status }));
			notify(`#${row.id} 状态 → ${STATUS_LABEL[status] ?? status}`);
		});
	};

	const submitCredential = (): void => {
		const host = credForm.host.trim();
		const username = credForm.username.trim();
		if (!host || !username) {
			notify("凭据需要 host 与 username", "bad");
			return;
		}
		void run(async () => {
			check(
				await redteam.addCredential<Res<Record<string, unknown>>>(eng, {
					host,
					username,
					secret_type: credForm.secret_type.trim() || "password",
					secret_value: credForm.secret_value,
					privilege: credForm.privilege.trim() || null,
				}),
			);
			setCredForm({ host: "", username: "", secret_type: "password", secret_value: "", privilege: "" });
			notify(`凭据 ${username}@${host} 已记录`);
		});
	};

	const submitAccess = (): void => {
		const host = accessForm.host.trim();
		if (!host) {
			notify("访问记录需要 host", "bad");
			return;
		}
		void run(async () => {
			check(
				await redteam.addAccess<Res<{ id?: number }>>(eng, {
					host,
					username: accessForm.username.trim() || null,
					method: accessForm.method.trim() || null,
					privilege: accessForm.privilege.trim() || null,
					session_ref: accessForm.session_ref.trim() || null,
				}),
			);
			setAccessForm({ host: "", username: "", method: "", privilege: "", session_ref: "" });
			notify(`访问入口 ${host} 已记录`);
		});
	};

	const submitEvidence = (): void => {
		const operation = evidenceForm.operation.trim();
		if (!operation) {
			notify("证据需要 operation", "bad");
			return;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(evidenceForm.result.trim() || "null");
		} catch {
			notify("result 必须是合法 JSON", "bad");
			return;
		}
		if (parsed === null || parsed === undefined) {
			notify("result 不能为空（JSON 对象/数组/字符串均可）", "bad");
			return;
		}
		void run(async () => {
			const data = check(
				await redteam.recordEvidence<Res<{ ev_id?: string; duplicate?: boolean }>>(eng, {
					operation,
					result: parsed,
					confidence: evidenceForm.confidence,
					authority: evidenceForm.authority,
				}),
			);
			setEvidenceForm({ operation: "", result: "", confidence: "observed", authority: "tool-output" });
			notify(data.duplicate ? "证据已存在（内容去重）" : `证据 ${shortId(data.ev_id)} 已入账`);
		});
	};

	const openShot = (row: ShotRow): void => {
		if (shotLoadingId !== null) return;
		setShotLoadingId(row.id);
		void (async () => {
			try {
				const data = check(await redteam.shotData<Res<{ mime?: string; data?: string }>>(eng, row.id));
				setShotView({ id: row.id, mime: data.mime ?? "image/png", data: data.data ?? "" });
			} catch (error) {
				notify(errorText(error), "bad");
			} finally {
				setShotLoadingId(null);
			}
		})();
	};

	const submitShot = (): void => {
		const data = shotForm.data.trim();
		if (!data) {
			notify("请粘贴截图 base64", "bad");
			return;
		}
		void run(async () => {
			check(
				await redteam.addShot<Res<{ id?: number; file?: string }>>(eng, {
					label: shotForm.label.trim() || null,
					data,
					kind: shotForm.kind,
					mime: shotForm.mime,
				}),
			);
			setShotForm({ label: "", data: "", kind: "screenshot", mime: "image/png" });
			notify("截图已上传");
		});
	};

	const submitHttp = (): void => {
		const url = httpForm.url.trim();
		if (!url) {
			notify("HTTP 证据需要 url", "bad");
			return;
		}
		const status = httpForm.status.trim() === "" ? null : Number(httpForm.status);
		if (status !== null && !Number.isFinite(status)) {
			notify("status 必须是数字", "bad");
			return;
		}
		void run(async () => {
			check(
				await redteam.addHttpEvidence<Res<{ id?: number }>>(eng, {
					label: httpForm.label.trim() || null,
					method: httpForm.method,
					url,
					status,
					request: httpForm.request,
					response: httpForm.response,
				}),
			);
			setHttpForm({ method: "GET", url: "", status: "200", request: "", response: "", label: "" });
			notify("HTTP 证据已记录");
		});
	};

	const submitFile = (): void => {
		const target = fileForm.target.trim();
		const name = fileForm.name.trim();
		if (!target || !name) {
			notify("攻击文件需要 target 与 name", "bad");
			return;
		}
		void run(async () => {
			const data = check(
				await redteam.addAttackFile<Res<{ id?: number; path?: string; updated?: boolean }>>(eng, {
					target,
					name,
					kind: fileForm.kind.trim() || null,
					content: fileForm.content,
					description: fileForm.description.trim() || null,
				}),
			);
			setFileForm({ target: "", name: "", kind: "poc", content: "", description: "" });
			notify(data.updated ? `攻击文件 ${name} 已覆盖` : `攻击文件 ${name} 已归档`);
		});
	};

	/* ── 渲染 ───────────────────────────────────────────────── */

	if (!eng) {
		return h(
			Card,
			{ title: "还没有靶标" },
			h(Muted, null, "先在上方创建或选择靶标，再记录漏洞、凭据、访问入口与证据。"),
			h(Empty, null, "暂无数据"),
		);
	}

	const statsCard = (): unknown =>
		h(
			Card,
			{ title: "漏洞统计", actions: h(Muted, null, loading ? "加载中…" : "按等级 / 状态汇总") },
			stats
				? h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: 6 } },
						h(
							Toolbar,
							null,
							h(Badge, null, `总数 ${fmt(stats.total ?? 0)}`),
							...SEVERITIES.map((severity) =>
								h(Badge, { key: severity, tone: sevTone(severity) }, `${SEVERITY_LABEL[severity] ?? severity} ${fmt(stats.bySeverity?.[severity] ?? 0)}`),
							),
						),
						h(
							Toolbar,
							null,
							...STATUSES.map((status) =>
								h(Badge, { key: status, tone: statusTone(status) }, `${STATUS_LABEL[status] ?? status} ${fmt(stats.byStatus?.[status] ?? 0)}`),
							),
						),
						h(
							Muted,
							null,
							`有成果 ${fmt(stats.withGained ?? 0)} · 有证据 ${fmt(stats.withEvidence ?? 0)} · 目标分组 ${fmt(stats.targetGroups ?? 0)}`,
						),
					)
				: h(Empty, null, "统计尚未加载"),
		);

	const viewTabs = (): unknown =>
		h(
			"div",
			{ style: { display: "flex", gap: 2, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 6 } },
			...VIEWS.map((item) =>
				h(
					"span",
					{
						key: item.id,
						className: "dshp-ui-tab",
						"data-on": item.id === view ? "1" : "0",
						onClick: () => setView(item.id),
					},
					item.label,
				),
			),
		);

	const vulnView = (): unknown =>
		h(
			Card,
			{ title: "漏洞清单", actions: h(Muted, null, `${vulnItems.length} 条`) },
			h(
				Toolbar,
				null,
				h(Input, {
					value: vulnForm.title,
					onChange: (value: string) => setVulnForm({ ...vulnForm, title: value }),
					placeholder: "漏洞标题（必填）",
					style: { flex: 2, minWidth: 180 },
				}),
				h(Select, {
					value: vulnForm.severity,
					options: SEVERITIES.map((severity) => ({ value: severity, label: `${severity} · ${SEVERITY_LABEL[severity] ?? ""}` })),
					onChange: (value: string) => setVulnForm({ ...vulnForm, severity: value }),
					style: { width: 150 },
				}),
				h(Input, {
					value: vulnForm.target,
					onChange: (value: string) => setVulnForm({ ...vulnForm, target: value }),
					placeholder: "target（域名/IP，可空）",
					style: { flex: 1, minWidth: 150 },
				}),
				h(Input, {
					value: vulnForm.asset_id,
					onChange: (value: string) => setVulnForm({ ...vulnForm, asset_id: value }),
					placeholder: "asset_id",
					type: "number",
					style: { width: 100 },
				}),
				h(Btn, { variant: "primary", disabled: busy, onClick: submitVuln }, busy ? "写入中…" : "新增漏洞"),
			),
			vulnItems.length === 0
				? h(Empty, null, "暂无漏洞记录")
				: h(Table, {
						head: ["ID", "标题", "等级", "状态", "目标", "成果", "状态流转"],
						rows: vulnItems.map((row) => [
							`#${row.id}`,
							row.title || "（未命名）",
							h(Badge, { tone: sevTone(String(row.severity ?? "")) }, `${row.severity ?? "info"} · ${SEVERITY_LABEL[String(row.severity ?? "info")] ?? ""}`),
							h(Badge, { tone: statusTone(String(row.status ?? "")) }, STATUS_LABEL[String(row.status ?? "candidate")] ?? String(row.status ?? "—")),
							row.target || "—",
							row.gained || "—",
							h(
								Select,
								{
									value: String(row.status ?? "candidate"),
									options: STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] ?? status })),
									style: { width: 118 },
									onChange: (value: string) => changeVulnStatus(row, value),
								},
							),
						]),
					}),
		);

	const credView = (): unknown =>
		h(
			Card,
			{ title: "凭据", actions: h(Muted, null, `${credItems.length} 条`) },
			h(
				Toolbar,
				null,
				h(Input, { value: credForm.host, onChange: (value: string) => setCredForm({ ...credForm, host: value }), placeholder: "host（必填）", style: { minWidth: 140 } }),
				h(Input, { value: credForm.username, onChange: (value: string) => setCredForm({ ...credForm, username: value }), placeholder: "username（必填）", style: { minWidth: 130 } }),
				h(Select, {
					value: credForm.secret_type,
					options: ["password", "ntlm", "hash", "sshkey", "token", "cookie"].map((item) => ({ value: item, label: item })),
					onChange: (value: string) => setCredForm({ ...credForm, secret_type: value }),
					style: { width: 110 },
				}),
				h(Input, { value: credForm.secret_value, onChange: (value: string) => setCredForm({ ...credForm, secret_value: value }), placeholder: "secret_value", style: { flex: 1, minWidth: 150 } }),
				h(Input, { value: credForm.privilege, onChange: (value: string) => setCredForm({ ...credForm, privilege: value }), placeholder: "privilege", style: { width: 110 } }),
				h(Btn, { variant: "primary", disabled: busy, onClick: submitCredential }, busy ? "写入中…" : "新增凭据"),
			),
			credItems.length === 0
				? h(Empty, null, "暂无凭据")
				: h(Table, {
						head: ["主机", "账号", "类型", "口令/密钥", "权限", "来源", "时间"],
						rows: credItems.map((row) => [
							row.host || "—",
							h("span", { style: MONO_STYLE }, row.username || "—"),
							row.secret_type || "—",
							h("span", { style: MONO_STYLE }, row.secret_value || "—"),
							row.privilege || "—",
							row.source || "—",
							fmt(row.found_at),
						]),
					}),
		);

	const accessView = (): unknown =>
		h(
			Card,
			{ title: "访问入口", actions: h(Muted, null, `${accessItems.length} 条`) },
			h(
				Toolbar,
				null,
				h(Input, { value: accessForm.host, onChange: (value: string) => setAccessForm({ ...accessForm, host: value }), placeholder: "host（必填）", style: { minWidth: 140 } }),
				h(Input, { value: accessForm.username, onChange: (value: string) => setAccessForm({ ...accessForm, username: value }), placeholder: "username", style: { minWidth: 120 } }),
				h(Input, { value: accessForm.method, onChange: (value: string) => setAccessForm({ ...accessForm, method: value }), placeholder: "method（ssh/rdp/webshell）", style: { minWidth: 150 } }),
				h(Input, { value: accessForm.privilege, onChange: (value: string) => setAccessForm({ ...accessForm, privilege: value }), placeholder: "privilege", style: { width: 110 } }),
				h(Input, { value: accessForm.session_ref, onChange: (value: string) => setAccessForm({ ...accessForm, session_ref: value }), placeholder: "session_ref", style: { flex: 1, minWidth: 130 } }),
				h(Btn, { variant: "primary", disabled: busy, onClick: submitAccess }, busy ? "写入中…" : "新增访问"),
			),
			accessItems.length === 0
				? h(Empty, null, "暂无访问记录")
				: h(Table, {
						head: ["主机", "账号", "方式", "权限", "会话引用", "获得时间"],
						rows: accessItems.map((row) => [
							row.host || "—",
							h("span", { style: MONO_STYLE }, row.username || "—"),
							row.method || "—",
							row.privilege || "—",
							h("span", { style: MONO_STYLE }, row.session_ref || "—"),
							fmt(row.obtained_at),
						]),
					}),
		);

	const evidenceDetail = evidenceOpen ? evidenceItems.find((item) => String(item.ev_id ?? "") === evidenceOpen) : undefined;

	const evidenceView = (): unknown =>
		h(
			Card,
			{ title: "证据账本", actions: h(Muted, null, `${evidenceItems.length} 条`) },
			h(
				Toolbar,
				null,
				h(Input, {
					value: evidenceForm.operation,
					onChange: (value: string) => setEvidenceForm({ ...evidenceForm, operation: value }),
					placeholder: "operation（例如 nmap -sV）",
					style: { flex: 2, minWidth: 180 },
				}),
				h(Select, {
					value: evidenceForm.confidence,
					options: CONFIDENCES.map((item) => ({ value: item, label: item })),
					onChange: (value: string) => setEvidenceForm({ ...evidenceForm, confidence: value }),
					style: { width: 120 },
				}),
				h(Select, {
					value: evidenceForm.authority,
					options: AUTHORITIES.map((item) => ({ value: item, label: item })),
					onChange: (value: string) => setEvidenceForm({ ...evidenceForm, authority: value }),
					style: { width: 150 },
				}),
				h(Btn, { variant: "primary", disabled: busy, onClick: submitEvidence }, busy ? "写入中…" : "记录证据"),
			),
			h(TextArea, {
				value: evidenceForm.result,
				onChange: (value: string) => setEvidenceForm({ ...evidenceForm, result: value }),
				placeholder: 'result JSON，例如 {"code":200,"body":"ok"}',
				rows: 4,
			}),
			evidenceItems.length === 0
				? h(Empty, null, "暂无证据")
				: h(Table, {
						head: ["证据", "操作", "置信", "权威", "记录时间", "详情"],
						rows: evidenceItems.map((row) => [
							h("span", { style: MONO_STYLE }, shortId(row.ev_id)),
							row.operation || "—",
							h(Badge, { tone: confidenceTone(String(row.confidence ?? "")) }, row.confidence || "—"),
							row.authority || "—",
							fmt(row.recorded_at),
							h(
								Btn,
								{
									onClick: () => setEvidenceOpen(evidenceOpen === String(row.ev_id ?? "") ? "" : String(row.ev_id ?? "")),
								},
								evidenceOpen === String(row.ev_id ?? "") ? "收起" : "展开",
							),
						]),
					}),
			evidenceDetail
				? h(
						"div",
						{ style: { marginTop: 8 } },
						h(Muted, null, `params / result · ${shortId(evidenceDetail.ev_id)}`),
						h("pre", { style: PRE_STYLE }, pretty({ parameters: evidenceDetail.parameters, result: evidenceDetail.result, limitations: evidenceDetail.limitations })),
					)
				: null,
		);

	const shotPreview = (): unknown =>
		shotView
			? h(
					Card,
					{
						title: `截图 #${shotView.id}`,
						actions: h(Btn, { onClick: () => setShotView(null) }, "关闭"),
					},
					shotView.data
						? h("img", {
								src: `data:${shotView.mime};base64,${shotView.data}`,
								alt: `截图 #${shotView.id}`,
								style: { maxWidth: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", display: "block" },
							})
						: h(Empty, null, "截图内容为空"),
				)
			: null;

	const shotsView = (): unknown =>
		h(
			Card,
			{ title: "证据截图", actions: h(Muted, null, `${shotItems.length} 张`) },
			h(
				Toolbar,
				null,
				h(Input, {
					value: shotForm.label,
					onChange: (value: string) => setShotForm({ ...shotForm, label: value }),
					placeholder: "标签（例如 后台权限）",
					style: { flex: 1, minWidth: 160 },
				}),
				h(Select, {
					value: shotForm.kind,
					options: [
						{ value: "screenshot", label: "screenshot" },
						{ value: "card", label: "card" },
					],
					onChange: (value: string) => setShotForm({ ...shotForm, kind: value }),
					style: { width: 120 },
				}),
				h(Select, {
					value: shotForm.mime,
					options: [
						{ value: "image/png", label: "image/png" },
						{ value: "image/jpeg", label: "image/jpeg" },
					],
					onChange: (value: string) => setShotForm({ ...shotForm, mime: value }),
					style: { width: 130 },
				}),
				h(Btn, { variant: "primary", disabled: busy, onClick: submitShot }, busy ? "上传中…" : "上传截图"),
			),
			h(TextArea, {
				value: shotForm.data,
				onChange: (value: string) => setShotForm({ ...shotForm, data: value }),
				placeholder: "粘贴 base64（可带 data:image/png;base64, 前缀，服务端会自动去掉）",
				rows: 4,
			}),
			shotItems.length === 0
				? h(Empty, null, "暂无截图")
				: h(Table, {
						head: ["ID", "标签", "文件", "类型", "尺寸", "时间", "查看"],
						rows: shotItems.map((row) => [
							`#${row.id}`,
							row.label || "—",
							h("span", { style: MONO_STYLE }, row.file || "—"),
							row.kind || "screenshot",
							row.width && row.height ? `${fmt(row.width)}×${fmt(row.height)} · ${fmt(row.bytes)} B` : `${fmt(row.bytes)} B`,
							fmt(row.created_at ?? row.captured_at),
							h(Btn, { disabled: shotLoadingId !== null, onClick: () => openShot(row) }, shotLoadingId === row.id ? "读取中…" : "查看"),
						]),
					}),
			shotPreview(),
		);

	const httpDetail = httpOpen === null ? undefined : httpItems.find((item) => item.id === httpOpen);

	const httpView = (): unknown =>
		h(
			Card,
			{ title: "HTTP 证据", actions: h(Muted, null, `${httpItems.length} 条`) },
			h(
				Toolbar,
				null,
				h(Select, {
					value: httpForm.method,
					options: HTTP_METHODS.map((item) => ({ value: item, label: item })),
					onChange: (value: string) => setHttpForm({ ...httpForm, method: value }),
					style: { width: 100 },
				}),
				h(Input, {
					value: httpForm.url,
					onChange: (value: string) => setHttpForm({ ...httpForm, url: value }),
					placeholder: "URL（必填）",
					style: { flex: 3, minWidth: 200 },
				}),
				h(Input, {
					value: httpForm.status,
					onChange: (value: string) => setHttpForm({ ...httpForm, status: value }),
					placeholder: "status",
					type: "number",
					style: { width: 90 },
				}),
				h(Input, {
					value: httpForm.label,
					onChange: (value: string) => setHttpForm({ ...httpForm, label: value }),
					placeholder: "label",
					style: { width: 130 },
				}),
				h(Btn, { variant: "primary", disabled: busy, onClick: submitHttp }, busy ? "写入中…" : "新增 HTTP 证据"),
			),
			h(
				"div",
				{ style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } },
				h(TextArea, {
					value: httpForm.request,
					onChange: (value: string) => setHttpForm({ ...httpForm, request: value }),
					placeholder: "原始请求（可直接粘贴进 Burp）",
					rows: 4,
				}),
				h(TextArea, {
					value: httpForm.response,
					onChange: (value: string) => setHttpForm({ ...httpForm, response: value }),
					placeholder: "原始响应",
					rows: 4,
				}),
			),
			httpItems.length === 0
				? h(Empty, null, "暂无 HTTP 证据")
				: h(Table, {
						head: ["ID", "方法", "URL", "状态", "标签", "时间", "详情"],
						rows: httpItems.map((row) => [
							`#${row.id}`,
							row.method || "GET",
							h("span", { style: MONO_STYLE }, row.url || "—"),
							h(Badge, { tone: httpTone(row.status) }, fmt(row.status)),
							row.label || "—",
							fmt(row.captured_at),
							h(Btn, { onClick: () => setHttpOpen(httpOpen === row.id ? null : row.id) }, httpOpen === row.id ? "收起" : "展开"),
						]),
					}),
			httpDetail
				? h(
						"div",
						{ style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 } },
						h(Muted, null, `#${httpDetail.id} ${httpDetail.method ?? "GET"} ${httpDetail.url ?? ""}`),
						h("pre", { style: PRE_STYLE }, `── request ──\n${httpDetail.request ?? ""}\n\n── response ──\n${httpDetail.response ?? ""}`),
					)
				: null,
		);

	const filesView = (): unknown =>
		h(
			Card,
			{ title: "攻击文件", actions: h(Muted, null, `${fileItems.length} 个`) },
			h(
				Toolbar,
				null,
				h(Input, {
					value: fileForm.target,
					onChange: (value: string) => setFileForm({ ...fileForm, target: value }),
					placeholder: "target（必填）",
					style: { minWidth: 150 },
				}),
				h(Input, {
					value: fileForm.name,
					onChange: (value: string) => setFileForm({ ...fileForm, name: value }),
					placeholder: "文件名（必填）",
					style: { minWidth: 150 },
				}),
				h(Input, {
					value: fileForm.kind,
					onChange: (value: string) => setFileForm({ ...fileForm, kind: value }),
					placeholder: "kind（poc/exp/script）",
					style: { width: 160 },
				}),
				h(Input, {
					value: fileForm.description,
					onChange: (value: string) => setFileForm({ ...fileForm, description: value }),
					placeholder: "说明",
					style: { flex: 1, minWidth: 130 },
				}),
				h(Btn, { variant: "primary", disabled: busy, onClick: submitFile }, busy ? "写入中…" : "归档文件"),
			),
			h(TextArea, {
				value: fileForm.content,
				onChange: (value: string) => setFileForm({ ...fileForm, content: value }),
				placeholder: "文件正文（脚本/POC 原文）",
				rows: 5,
			}),
			fileItems.length === 0
				? h(Empty, null, "暂无攻击文件")
				: h(Table, {
						head: ["ID", "目标", "名称", "类型", "路径", "说明", "时间"],
						rows: fileItems.map((row) => [
							`#${row.id}`,
							row.target || "—",
							h("span", { style: MONO_STYLE }, row.name || "—"),
							row.kind || "—",
							h("span", { style: MONO_STYLE }, row.path || "—"),
							row.description || "—",
							fmt(row.created_at),
						]),
					}),
		);

	const body = (): unknown => {
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
				return h(Empty, null);
		}
	};

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		h(
			Toolbar,
			null,
			h(Btn, { onClick: () => void load(), disabled: loading }, loading ? "刷新中…" : "刷新"),
			h(Muted, null, `靶标 ${eng}`),
		),
		statsCard(),
		viewTabs(),
		body(),
	);
}
