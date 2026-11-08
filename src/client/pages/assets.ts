/**
 * 资产测绘页：资产列表 / 发现时间线 / 域名 / Web / 图谱。
 *
 * 数据面（对照 src/redteam/api.ts）：
 *   assets   → { total, sort, items: AssetRow[] }
 *   asset    → { asset: AssetRow | null }（当前实现不带 ports/names，缺端口时用 web 视图补齐）
 *   ingest   → { scan_run_id, counts: { assets, ports }, stats }
 *   assess   → { ok }（写 priority / assess_reason）
 *   test     → { ok }（写 test_status / test_notes）
 *   timeline → { days, recent, span }
 *   domains  → { items: [{ name, assets, last_seen }] }
 *   web      → { items: [{ id, asset_id, ip, port, proto, url, title, banner }] }
 *   graph    → { nodes: [{ id, kind, label, meta }], edges: [{ source, target, relation }] }
 */
import { createElement as h, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Select, Table, Toolbar } from "../ui.js";
import { redteam } from "../api.js";
import { errorText, fmt, type PageProps } from "./types.js";

type View = "list" | "timeline" | "domains" | "web" | "graph";
type Tone = "ok" | "warn" | "bad" | undefined;

interface AssetRow {
	id: number;
	ip: string;
	state?: string | null;
	primary_name?: string | null;
	open_port_count?: number | null;
	open_ports?: number | null;
	priority?: string | null;
	test_status?: string | null;
	test_notes?: string | null;
	segment_cidr?: string | null;
	scope?: string | null;
	discovered_at?: string | null;
	first_seen?: string | null;
	last_seen?: string | null;
	assess_reason?: string | null;
}

interface PortRow {
	id?: number | null;
	port?: number | null;
	proto?: string | null;
	state?: string | null;
	provenance?: string | null;
	url?: string | null;
	title?: string | null;
	banner?: string | null;
}

interface NameRow {
	name?: string | null;
	kind?: string | null;
}

interface WebRow extends PortRow {
	asset_id?: number | null;
	ip?: string | null;
}

interface Detail {
	asset: AssetRow | null;
	ports: PortRow[];
	names: NameRow[];
	/** 端口来源：asset op 自带 / 用 web 视图补齐 */
	portsFrom: "asset" | "web";
}

interface AssetsRes {
	ok?: boolean;
	error?: string;
	total?: number;
	items?: AssetRow[];
}

interface AssetRes {
	ok?: boolean;
	error?: string;
	asset?: AssetRow | null;
	ports?: PortRow[];
	names?: NameRow[];
}

interface IngestRes {
	ok?: boolean;
	error?: string;
	counts?: { assets?: number; ports?: number; names?: number };
}

interface TimelineRes {
	ok?: boolean;
	error?: string;
	days?: { day?: string; assets?: number; internal?: number; external?: number }[];
	recent?: AssetRow[];
	span?: Record<string, unknown>;
}

interface DomainsRes {
	ok?: boolean;
	error?: string;
	items?: { name?: string; assets?: number; last_seen?: string | null }[];
}

interface WebRes {
	ok?: boolean;
	error?: string;
	items?: WebRow[];
}

interface GraphNode {
	id: string;
	kind: string;
	label: string;
	meta?: Record<string, unknown>;
}

interface GraphEdge {
	source: string;
	target: string;
	relation: string;
}

interface GraphRes {
	ok?: boolean;
	error?: string;
	nodes?: GraphNode[];
	edges?: GraphEdge[];
}

const VIEWS: { id: View; label: string }[] = [
	{ id: "list", label: "资产列表" },
	{ id: "timeline", label: "时间线" },
	{ id: "domains", label: "域名" },
	{ id: "web", label: "Web" },
	{ id: "graph", label: "图谱" },
];

const SORTS = [
	{ value: "ip", label: "按 IP" },
	{ value: "ports", label: "按开放端口数" },
	{ value: "discovered", label: "按发现时间" },
];

const PRIORITIES = [
	{ value: "high", label: "high（高）" },
	{ value: "medium", label: "medium（中）" },
	{ value: "low", label: "low（低）" },
];

const TEST_STATUS = [
	{ value: "untested", label: "untested（未测）" },
	{ value: "testing", label: "testing（测试中）" },
	{ value: "tested", label: "tested（已测）" },
	{ value: "blocked", label: "blocked（受阻）" },
	{ value: "no_surface", label: "no_surface（无可用攻击面）" },
];

const PROVENANCES = [
	{ value: "active", label: "active（主动探测）" },
	{ value: "passive", label: "passive（被动收集）" },
];

const STATE_TONE: Record<string, Tone> = { live: "ok", up: "ok", down: "bad", dead: "bad", filtered: "warn", unknown: undefined };
const PRIORITY_TONE: Record<string, Tone> = { high: "bad", medium: "warn", low: "ok" };
const TEST_TONE: Record<string, Tone> = { untested: undefined, testing: "warn", tested: "ok", blocked: "bad", no_surface: undefined };

/** 返回 null 表示可用；否则返回中文错误。 */
function ipError(value: string): string | null {
	const raw = value.trim();
	if (raw === "") return "IP 必填";
	const parts = raw.split(".");
	if (parts.length !== 4) return "IP 格式不正确（例如 10.0.0.5）";
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return "IP 每段必须是最多三位的数字";
		const n = Number(part);
		if (n < 0 || n > 255) return "IP 每段必须在 0-255 之间";
	}
	return null;
}

function cidrError(value: string): string | null {
	const raw = value.trim();
	if (raw === "") return null;
	const [ip, bits] = raw.split("/");
	if (bits === undefined || !/^\d{1,2}$/.test(bits) || Number(bits) > 32) return "CIDR 格式不正确（例如 10.0.0.0/24）";
	return ipError(ip ?? "");
}

/** 解析「80, 443/tcp, 8080」；返回错误时 ports 为空。 */
function parsePorts(raw: string): { ports: PortRow[]; error: string | null } {
	const ports: PortRow[] = [];
	const tokens = raw.split(/[,，\s]+/).map((token) => token.trim()).filter(Boolean);
	for (const token of tokens) {
		const [portText, protoText] = token.split("/");
		const port = Number(portText);
		if (!Number.isInteger(port) || port < 1 || port > 65535) return { ports: [], error: `端口不合法：${token}（1-65535）` };
		const proto = (protoText || "tcp").toLowerCase();
		if (proto !== "tcp" && proto !== "udp") return { ports: [], error: `协议只能是 tcp/udp：${token}` };
		if (ports.some((item) => item.port === port && item.proto === proto)) continue;
		ports.push({ port, proto, state: "open" });
	}
	return { ports, error: null };
}

function metaText(meta: Record<string, unknown> | undefined): string {
	if (!meta) return "—";
	const pairs = Object.entries(meta)
		.filter(([, value]) => value !== null && value !== undefined && value !== "")
		.map(([key, value]) => `${key}=${String(value)}`);
	return pairs.length === 0 ? "—" : pairs.join(" · ");
}

function clip(value: unknown, max = 60): string {
	const text = value === null || value === undefined ? "" : String(value);
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function AssetsPage(props: PageProps): unknown {
	const { engagement, refresh, notify } = props;

	const [view, setView] = useState<View>("list");
	const [keyword, setKeyword] = useState("");
	const [applied, setApplied] = useState("");
	const [cidr, setCidr] = useState("");
	const [appliedCidr, setAppliedCidr] = useState("");
	const [sort, setSort] = useState("ip");
	const [tick, setTick] = useState(0);
	const [loading, setLoading] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	const [busy, setBusy] = useState("");

	const [items, setItems] = useState<AssetRow[]>([]);
	const [total, setTotal] = useState(0);
	const [timeline, setTimeline] = useState<TimelineRes | null>(null);
	const [domains, setDomains] = useState<DomainsRes["items"]>([]);
	const [webItems, setWebItems] = useState<WebRow[]>([]);
	const [graph, setGraph] = useState<GraphRes | null>(null);

	const [selected, setSelected] = useState<number | null>(null);
	const [detail, setDetail] = useState<Detail | null>(null);

	const [newIp, setNewIp] = useState("");
	const [newProvenance, setNewProvenance] = useState("active");
	const [newPorts, setNewPorts] = useState("");
	const [priority, setPriority] = useState("medium");
	const [reason, setReason] = useState("");
	const [testStatus, setTestStatus] = useState("untested");
	const [testNote, setTestNote] = useState("");

	const reload = useCallback(() => {
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

	// 按当前视图拉取数据；刷新 tick / CIDR / 排序 / 检索词变化时重跑。
	useEffect(() => {
		if (!engagement) return;
		let alive = true;
		setLoading(true);
		const run = async (): Promise<void> => {
			try {
				if (view === "list") {
					const data = await redteam.assets<AssetsRes>(engagement, {
						cidr: appliedCidr || undefined,
						sort,
						limit: 500,
					});
					if (!alive) return;
					if (data.ok === false) throw new Error(data.error ?? "资产列表拉取失败");
					setItems(data.items ?? []);
					setTotal(Number(data.total ?? 0));
				} else if (view === "timeline") {
					const data = await redteam.timeline<TimelineRes>(engagement, 50);
					if (!alive) return;
					if (data.ok === false) throw new Error(data.error ?? "时间线拉取失败");
					setTimeline(data);
				} else if (view === "domains") {
					const data = await redteam.domains<DomainsRes>(engagement, applied || undefined);
					if (!alive) return;
					if (data.ok === false) throw new Error(data.error ?? "域名拉取失败");
					setDomains(data.items ?? []);
				} else if (view === "web") {
					const data = await redteam.web<WebRes>(engagement, applied || undefined);
					if (!alive) return;
					if (data.ok === false) throw new Error(data.error ?? "Web 资产拉取失败");
					setWebItems(data.items ?? []);
				} else {
					const data = await redteam.graph<GraphRes>(engagement, appliedCidr || undefined);
					if (!alive) return;
					if (data.ok === false) throw new Error(data.error ?? "图谱拉取失败");
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

	// 选中资产后拉详情；刷新 tick 变化时同步最新评估/测试字段。
	useEffect(() => {
		if (!engagement || selected === null) {
			setDetail(null);
			return;
		}
		let alive = true;
		setDetailLoading(true);
		const run = async (): Promise<void> => {
			try {
				const data = await redteam.asset<AssetRes>(engagement, selected);
				if (!alive) return;
				if (data.ok === false) throw new Error(data.error ?? "资产详情拉取失败");
				let ports: PortRow[] = Array.isArray(data.ports) ? data.ports : [];
				const names: NameRow[] = Array.isArray(data.names) ? data.names : [];
				const portsFrom: "asset" | "web" = Array.isArray(data.ports) ? "asset" : "web";
				if (!Array.isArray(data.ports)) {
					// 后端 asset op 当前只回 asset 行：用 web 视图的端口记录补齐。
					const web = await redteam.web<WebRes>(engagement);
					if (!alive) return;
					ports = (web.items ?? []).filter((row) => Number(row.asset_id) === selected);
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

	const addAsset = useCallback(async (): Promise<void> => {
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
			const data = await redteam.ingest<IngestRes>(engagement, {
				scan: { tool: "manual" },
				assets: [{ ip: newIp.trim(), provenance: newProvenance, ports: parsed.ports }],
			});
			if (data.ok === false) throw new Error(data.error ?? "入库失败");
			notify(`已入库 ${Number(data.counts?.assets ?? 1)} 个资产 / ${Number(data.counts?.ports ?? parsed.ports.length)} 个端口`);
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

	const assess = useCallback(async (): Promise<void> => {
		if (!engagement || selected === null) return;
		setBusy("assess");
		try {
			const data = await redteam.assess<{ ok?: boolean; error?: string }>(engagement, {
				id: selected,
				priority,
				assess_reason: reason.trim() || undefined,
			});
			if (data.ok === false) throw new Error(data.error ?? "评估失败");
			notify(`已评估 #${selected}：${priority}`);
			setTick((value) => value + 1);
			refresh();
		} catch (error) {
			notify(errorText(error), "bad");
		} finally {
			setBusy("");
		}
	}, [engagement, notify, priority, reason, refresh, selected]);

	const saveTest = useCallback(async (): Promise<void> => {
		if (!engagement || selected === null) return;
		setBusy("test");
		try {
			const data = await redteam.test<{ ok?: boolean; error?: string }>(engagement, {
				id: selected,
				status: testStatus,
				notes: testNote.trim() || undefined,
			});
			if (data.ok === false) throw new Error(data.error ?? "测试状态更新失败");
			notify(`已更新 #${selected} 测试状态：${testStatus}`);
			setTick((value) => value + 1);
			refresh();
		} catch (error) {
			notify(errorText(error), "bad");
		} finally {
			setBusy("");
		}
	}, [engagement, notify, refresh, selected, testNote, testStatus]);

	const visible = useMemo(() => {
		const needle = keyword.trim().toLowerCase();
		if (needle === "") return items;
		return items.filter((row) =>
			[row.ip, row.primary_name, row.state, row.priority, row.test_status, row.segment_cidr]
				.some((value) => String(value ?? "").toLowerCase().includes(needle)),
		);
	}, [items, keyword]);

	const badge = (value: string | null | undefined, tones: Record<string, Tone>): unknown => {
		const text = value === null || value === undefined || value === "" ? "—" : value;
		return h(Badge, { tone: value ? tones[value] : undefined }, text);
	};

	if (!engagement) {
		return h(Card, { title: "资产测绘" }, h(Empty, null, "先创建/选择靶标"));
	}

	const listRows = visible.map((row) => [
		h(
			"span",
			{
				key: `ip-${row.id}`,
				title: "点击查看详情",
				style: { cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" },
				onClick: () => setSelected(row.id),
			},
			row.ip,
		),
		badge(row.state, STATE_TONE),
		fmt(row.primary_name),
		fmt(row.open_port_count ?? row.open_ports ?? 0),
		badge(row.priority, PRIORITY_TONE),
		badge(row.test_status ?? "untested", TEST_TONE),
	]);

	const listCard = h(
		Card,
		{
			title: `资产列表${loading ? " · 加载中…" : ""}`,
			actions: h(Muted, null, keyword.trim() ? `${visible.length} / ${total}` : `共 ${total} 条`),
		},
		visible.length === 0
			? h(Empty, null, loading ? "加载中…" : keyword.trim() ? "关键词没有命中资产" : "还没有资产：先新增，或让智能体 ingest 扫描结果")
			: h(Table, { head: ["IP", "状态", "主域名", "开放端口", "优先级", "测试"], rows: listRows }),
		visible.length > 0 ? h(Muted, null, "点击 IP 查看端口、评估与测试状态。") : null,
	);

	const addCard = h(
		Card,
		{ title: "新增资产" },
		h(
			Toolbar,
			null,
			h(Input, { value: newIp, onChange: setNewIp, placeholder: "IP，例如 10.0.0.5", style: { width: 160 } }),
			h(Select, { value: newProvenance, onChange: setNewProvenance, options: PROVENANCES }),
			h(Input, { value: newPorts, onChange: setNewPorts, placeholder: "端口，逗号分隔：80,443/tcp", style: { width: 210 } }),
			h(Btn, { variant: "primary", onClick: () => void addAsset(), disabled: busy !== "" }, busy === "ingest" ? "入库中…" : "入库"),
		),
		h(Muted, null, "走 ingest → bundle.assets[{ ip, provenance, ports }]，provenance 决定 segment.source 与端口来源。"),
	);

	const detailCard =
		selected === null
			? null
			: h(
					Card,
					{
						title: `资产详情 · #${selected}${detailLoading ? " · 加载中…" : ""}`,
						actions: h(
							Toolbar,
							null,
							detail?.asset ? badge(detail.asset.priority, PRIORITY_TONE) : null,
							detail?.asset ? badge(detail.asset.test_status ?? "untested", TEST_TONE) : null,
							h(Btn, { onClick: () => setSelected(null) }, "关闭"),
						),
					},
					h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: 8 } },
						detail === null
							? h(Empty, null, detailLoading ? "加载中…" : "没有取到该资产")
							: h(
									"div",
									{ style: { display: "flex", flexDirection: "column", gap: 8 } },
									h(
										Muted,
										null,
										[
											`IP ${detail.asset?.ip ?? "—"}`,
											`段 ${fmt(detail.asset?.segment_cidr)}`,
											`范围 ${fmt(detail.asset?.scope)}`,
											`主域名 ${fmt(detail.asset?.primary_name)}`,
											`发现 ${fmt(detail.asset?.discovered_at ?? detail.asset?.first_seen)}`,
										].join(" · "),
									),
									detail.asset?.assess_reason ? h(Muted, null, `评估理由：${detail.asset.assess_reason}`) : null,
									detail.asset?.test_notes ? h(Muted, null, `测试备注：${detail.asset.test_notes}`) : null,
									detail.names.length > 0
										? h(Table, {
												head: ["名称", "类型"],
												rows: detail.names.map((row) => [fmt(row.name), fmt(row.kind)]),
											})
										: null,
									h("div", { style: { fontWeight: 600 } }, `开放端口${detail.portsFrom === "web" ? "（来自 web 视图）" : ""}`),
									detail.ports.length === 0
										? h(Muted, null, "该资产暂无端口记录")
										: h(Table, {
												head: ["端口", "状态", "来源", "URL / 标题"],
												rows: detail.ports.map((row) => [
													`${fmt(row.port)}/${fmt(row.proto ?? "tcp")}`,
													fmt(row.state ?? "open"),
													fmt(row.provenance),
													clip(row.url ?? row.title ?? row.banner ?? "—"),
												]),
											}),
									h(
										Toolbar,
										null,
										h("span", null, "评估"),
										h(Select, { value: priority, onChange: setPriority, options: PRIORITIES }),
										h(Input, { value: reason, onChange: setReason, placeholder: "评估理由", style: { flex: 1, minWidth: 160 } }),
										h(Btn, { variant: "primary", onClick: () => void assess(), disabled: busy !== "" }, busy === "assess" ? "提交中…" : "保存评估"),
									),
									h(
										Toolbar,
										null,
										h("span", null, "测试"),
										h(Select, { value: testStatus, onChange: setTestStatus, options: TEST_STATUS }),
										h(Input, { value: testNote, onChange: setTestNote, placeholder: "测试备注", style: { flex: 1, minWidth: 160 } }),
										h(Btn, { onClick: () => void saveTest(), disabled: busy !== "" }, busy === "test" ? "提交中…" : "记录状态"),
									),
								),
					),
				);

	const timelineCard = (() => {
		const days = timeline?.days ?? [];
		const recent = timeline?.recent ?? [];
		return h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 10 } },
			h(
				Card,
				{ title: "发现节奏（按天）", actions: timeline?.span ? h(Muted, null, `共 ${fmt(timeline.span.total)} 条`) : null },
				h(Muted, null, timeline?.span ? `跨度 ${fmt(timeline.span.first)} → ${fmt(timeline.span.last)}` : "—"),
				days.length === 0
					? h(Empty, null, loading ? "加载中…" : "还没有发现记录")
					: h(Table, {
							head: ["日期", "资产", "内部", "外部"],
							rows: days.map((row) => [fmt(row.day), fmt(row.assets), fmt(row.internal), fmt(row.external)]),
						}),
			),
			h(
				Card,
				{ title: "最近发现" },
				recent.length === 0
					? h(Empty, null, loading ? "加载中…" : "还没有资产")
					: h(Table, {
							head: ["IP", "状态", "主域名", "开放端口", "优先级", "发现时间"],
							rows: recent.map((row) => [
								h(
									"span",
									{
										key: `recent-${row.id}`,
										style: { cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" },
										onClick: () => setSelected(row.id),
									},
									row.ip,
								),
								badge(row.state, STATE_TONE),
								fmt(row.primary_name),
								fmt(row.open_ports ?? row.open_port_count ?? 0),
								badge(row.priority, PRIORITY_TONE),
								fmt(row.discovered_at ?? row.first_seen),
							]),
						}),
			),
		);
	})();

	const domainsCard = h(
		Card,
		{ title: "域名", actions: h(Muted, null, applied ? `关键词「${applied}」` : "全部") },
		(domains ?? []).length === 0
			? h(Empty, null, loading ? "加载中…" : applied ? "关键词没有命中域名" : "还没有域名/主机名记录")
			: h(Table, {
					head: ["域名", "资产数", "最近出现"],
					rows: (domains ?? []).map((row) => [fmt(row.name), fmt(row.assets), fmt(row.last_seen)]),
				}),
	);

	const webCard = h(
		Card,
		{ title: "Web 资产", actions: h(Muted, null, `${webItems.length} 条`) },
		webItems.length === 0
			? h(Empty, null, loading ? "加载中…" : applied ? "关键词没有命中 Web 资产" : "还没有带 URL/标题的端口记录")
			: h(Table, {
					head: ["URL / 标题", "端口", "资产", "Banner"],
					rows: webItems.map((row) => [
						clip(row.url ?? row.title ?? "—", 70),
						`${fmt(row.port)}/${fmt(row.proto ?? "tcp")}`,
						fmt(row.ip),
						clip(row.banner ?? row.title ?? "—", 40),
					]),
				}),
	);

	const graphCard = (() => {
		const nodes = graph?.nodes ?? [];
		const edges = graph?.edges ?? [];
		return h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 10 } },
			h(
				Card,
				{ title: "图谱节点", actions: h(Muted, null, `${nodes.length} 节点 / ${edges.length} 边`) },
				nodes.length === 0
					? h(Empty, null, loading ? "加载中…" : appliedCidr ? "该 CIDR 下没有节点" : "还没有图谱数据")
					: h(Table, {
							head: ["ID", "类型", "标签", "属性"],
							rows: nodes.map((node) => [node.id, node.kind, node.label, metaText(node.meta)]),
						}),
			),
			h(
				Card,
				{ title: "图谱边" },
				edges.length === 0
					? h(Empty, null, loading ? "加载中…" : "还没有边")
					: h(Table, {
							head: ["源", "关系", "目标"],
							rows: edges.map((edge) => [edge.source, edge.relation, edge.target]),
						}),
			),
		);
	})();

	const body = (): unknown => {
		if (view === "timeline") return timelineCard;
		if (view === "domains") return domainsCard;
		if (view === "web") return webCard;
		if (view === "graph") return graphCard;
		return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, addCard, listCard);
	};

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		h(
			Card,
			{ title: `资产测绘 · ${engagement}` },
			h(
				Toolbar,
				null,
				h(Input, { value: keyword, onChange: setKeyword, placeholder: "关键词（IP / 域名 / 状态）", style: { width: 190 } }),
				h(Input, { value: cidr, onChange: setCidr, placeholder: "CIDR，例如 10.0.0.0/24", style: { width: 180 } }),
				h(Select, { value: sort, onChange: setSort, options: SORTS }),
				h(Btn, { variant: "primary", onClick: reload, disabled: loading }, loading ? "刷新中…" : "刷新"),
			),
			h(Muted, null, "列表关键词即时本地过滤；域名 / Web 关键词点「刷新」后服务端检索。CIDR 走 assets/graph 的精确段匹配。"),
			h(
				Toolbar,
				null,
				...VIEWS.map((item) =>
					h(
						Btn,
						{ key: item.id, variant: item.id === view ? "primary" : undefined, onClick: () => setView(item.id) },
						item.label,
					),
				),
			),
		),
		body(),
		detailCard,
	);
}
