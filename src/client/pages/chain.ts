/** 攻击链页：步骤时间线、新增步骤、攻击图谱（节点 / 关系列表，不引图形库）。零依赖，React 由宿主提供。 */
import { createElement as h, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Select, Table, TextArea, Toolbar } from "../ui.js";
import { redteam } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText } from "./types.js";

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

const STAGES: { value: string; label: string }[] = [
	{ value: "recon", label: "信息收集" },
	{ value: "assess", label: "资产评估" },
	{ value: "vuln-scan", label: "漏洞发现" },
	{ value: "exploit", label: "漏洞利用" },
	{ value: "internal", label: "内网渗透" },
	{ value: "boundary", label: "边界突破" },
];

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((stage) => [stage.value, stage.label]));

const STAGE_COLOR: Record<string, string> = {
	recon: "#38bdf8",
	assess: "#a78bfa",
	"vuln-scan": "#fbbf24",
	exploit: "#f87171",
	internal: "#34d399",
	boundary: "#fb923c",
};

const KIND_LABEL: Record<string, string> = {
	asset: "资产",
	vuln: "漏洞",
	step: "步骤",
	segment: "网段",
	port: "端口",
	domain: "域名",
};

const RELATION_LABEL: Record<string, string> = {
	has: "存在漏洞",
	leads: "推进到",
	contains: "包含",
	exposes: "暴露",
	resolves: "解析到",
};

interface ChainStep {
	id: number;
	seq: number | null;
	stage: string | null;
	stage_code?: string | null;
	title: string | null;
	detail: string | null;
	asset_id: number | null;
	vuln_id: number | null;
	access_id: number | null;
	point_id: number | null;
	evidence_ref: string | null;
	tool: string | null;
	agent: string | null;
	result: string | null;
	recorded_by: string | null;
	recorded_at: string | null;
	asset_ip?: string | null;
	vuln_title?: string | null;
	vuln_cve?: string | null;
}

interface ChainData {
	ok?: boolean;
	error?: string;
	items?: ChainStep[];
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

interface GraphData {
	ok?: boolean;
	error?: string;
	nodes?: GraphNode[];
	edges?: GraphEdge[];
}

interface ScoreCode {
	code: string;
	id: number;
	name: string;
}

interface ScoresData {
	ok?: boolean;
	error?: string;
	items?: { id: number; code: string; name: string }[];
}

interface AddStepResult {
	ok?: boolean;
	error?: string;
	id?: number;
}

/** dispatch 用 HTTP 200 返回 ok:false，这里统一转成异常。 */
function unwrap<T extends { ok?: boolean; error?: string }>(data: T | null | undefined): T {
	if (data === null || data === undefined) throw new Error("接口返回为空");
	if (data.ok === false) throw new Error(data.error ?? "请求失败");
	return data;
}

function metaText(meta: Record<string, unknown> | undefined): string {
	if (!meta) return "—";
	const parts = Object.entries(meta)
		.filter(([, value]) => value !== null && value !== undefined && value !== "")
		.map(([key, value]) => `${key}=${String(value)}`);
	return parts.length ? parts.join(" · ") : "—";
}

export function ChainPage(props: PageProps): unknown {
	const { engagement, notify, refresh } = props;
	const [steps, setSteps] = useState<ChainStep[]>([]);
	const [nodes, setNodes] = useState<GraphNode[]>([]);
	const [edges, setEdges] = useState<GraphEdge[]>([]);
	const [codes, setCodes] = useState<ScoreCode[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);
	const [title, setTitle] = useState("");
	const [stage, setStage] = useState("recon");
	const [seq, setSeq] = useState("");
	const [detail, setDetail] = useState("");
	const [pointCode, setPointCode] = useState("");
	const [evidence, setEvidence] = useState("");

	const load = useCallback(async () => {
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
				redteam.chain<ChainData>(engagement),
				redteam.attackGraph<GraphData>(engagement),
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
		// 得分点清单只用于把表单里的 code 映射成 point_id，取不到不影响主流程。
		try {
			const data = unwrap(await redteam.scores<ScoresData>(engagement));
			setCodes((data.items ?? []).map((item) => ({ code: item.code, id: item.id, name: item.name })));
		} catch {
			setCodes([]);
		}
	}, [engagement, notify, reloadKey]);

	useEffect(() => {
		void load();
	}, [load]);

	const nodeIndex = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

	const kindCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
		return counts;
	}, [nodes]);

	const labelOf = useCallback(
		(id: string): string => {
			const node = nodeIndex.get(id);
			return node ? `${node.label}（${id}）` : id;
		},
		[nodeIndex],
	);

	const reload = useCallback(() => {
		setReloadKey((value) => value + 1);
		refresh();
	}, [refresh]);

	const submit = useCallback(async () => {
		if (!engagement) {
			notify("先在顶部选择靶标", "bad");
			return;
		}
		const stepTitle = title.trim();
		if (stepTitle === "") {
			notify("标题必填：一句话说明这一步做了什么", "bad");
			return;
		}
		let order: number | undefined;
		const rawSeq = seq.trim();
		if (rawSeq !== "") {
			const parsed = Number(rawSeq);
			if (!Number.isFinite(parsed) || parsed < 0) {
				notify("顺序需为非负数字，或留空", "bad");
				return;
			}
			order = Math.trunc(parsed);
		}
		let pointId: number | undefined;
		const rawPoint = pointCode.trim();
		if (rawPoint !== "") {
			const asNumber = Number(rawPoint);
			if (Number.isInteger(asNumber) && asNumber > 0) {
				pointId = asNumber;
			} else {
				const found = codes.find((item) => item.code.toLowerCase() === rawPoint.toLowerCase());
				if (!found) {
					notify(`未识别的得分点：${rawPoint}（可填 code 或数字 id，留空则不关联）`, "bad");
					return;
				}
				pointId = found.id;
			}
		}
		setSaving(true);
		try {
			const result = unwrap(
				await redteam.addChainStep<AddStepResult>(engagement, {
					title: stepTitle,
					stage,
					seq: order,
					detail: detail.trim() === "" ? undefined : detail.trim(),
					point_id: pointId,
					evidence_ref: evidence.trim() === "" ? undefined : evidence.trim(),
				}),
			);
			notify(`已添加攻击链步骤${result.id ? ` #${result.id}` : ""}`);
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
		return h(Card, { title: "攻击链" }, h(Muted, null, "先在顶部选择或创建靶标，再记录攻击链。"));
	}

	const timeline =
		steps.length === 0
			? h(Empty, null, loading ? "加载中…" : "还没有攻击链步骤，用下面的表单记录第一条。")
			: h(
					"div",
					{ style: { position: "relative", paddingLeft: 16, marginTop: 4 } },
					h("div", {
						style: {
							position: "absolute",
							left: 4,
							top: 6,
							bottom: 6,
							width: 1,
							background: "rgba(255,255,255,.14)",
						},
					}),
					...steps.map((step, index) => {
						const stageCode = String(step.stage ?? step.stage_code ?? "");
						const color = STAGE_COLOR[stageCode] ?? "#94a3b8";
						const stageText = STAGE_LABEL[stageCode] ?? (stageCode === "" ? "未标注" : stageCode);
						const chips: string[] = [];
						if (step.asset_ip) chips.push(`资产 ${step.asset_ip}`);
						else if (step.asset_id) chips.push(`资产 #${step.asset_id}`);
						if (step.vuln_title) chips.push(`漏洞 ${step.vuln_title}${step.vuln_cve ? `（${step.vuln_cve}）` : ""}`);
						else if (step.vuln_id) chips.push(`漏洞 #${step.vuln_id}`);
						if (step.point_id) chips.push(`得分点 #${step.point_id}`);
						if (step.evidence_ref) chips.push(`证据 ${step.evidence_ref}`);
						if (step.tool) chips.push(`工具 ${step.tool}`);
						if (step.agent) chips.push(`执行 ${step.agent}`);
						return h(
							"div",
							{ key: step.id ?? `step-${index}`, style: { position: "relative", paddingBottom: 12 } },
							h("span", {
								style: {
									position: "absolute",
									left: -16,
									top: 5,
									width: 9,
									height: 9,
									borderRadius: "50%",
									background: color,
									boxShadow: `0 0 0 3px rgba(255,255,255,.06)`,
								},
							}),
							h(
								"div",
								{ style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
								h(Badge, { tone: stageCode === "exploit" ? "bad" : undefined }, stageText),
								h("strong", null, step.title ?? "(未命名步骤)"),
								step.seq !== null && step.seq !== undefined ? h(Muted, null, `#${step.seq}`) : null,
								step.recorded_at ? h(Muted, null, step.recorded_at) : null,
							),
							step.detail
								? h("div", { style: { whiteSpace: "pre-wrap", marginTop: 2, opacity: 0.92 } }, step.detail)
								: null,
							step.result ? h("div", { style: { marginTop: 2 } }, h(Muted, null, `结果：${step.result}`)) : null,
							chips.length ? h(Muted, null, chips.join(" · ")) : null,
							step.recorded_by ? h(Muted, null, `记录人 ${step.recorded_by}`) : null,
						);
					}),
				);

	const nodeRows = nodes.map((node) => [
		h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
			h(Badge, null, KIND_LABEL[node.kind] ?? node.kind),
			h("span", { style: { fontFamily: MONO, opacity: 0.7 } }, node.id),
		),
		h("span", null, node.label),
		h("span", { style: { opacity: 0.7 } }, metaText(node.meta)),
	]);

	const edgeRows = edges.map((edge) => [
		h("span", { style: { fontFamily: MONO } }, labelOf(edge.source)),
		h(Badge, null, RELATION_LABEL[edge.relation] ?? edge.relation),
		h("span", { style: { fontFamily: MONO } }, labelOf(edge.target)),
	]);

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		h(
			Card,
			{
				title: "攻击链",
				actions: h(
					Toolbar,
					null,
					h(Badge, null, `步骤 ${steps.length}`),
					h(Btn, { onClick: reload, disabled: loading }, loading ? "加载中…" : "刷新"),
				),
			},
			error ? h("div", { style: { color: "#fecaca", marginBottom: 6 } }, error) : null,
			timeline,
		),
		h(
			Card,
			{ title: "新增步骤" },
			h(
				"div",
				{ style: { display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: "8px 10px", alignItems: "center" } },
				h(Muted, null, "标题 *"),
				h(Input, { value: title, onChange: setTitle, placeholder: "如：通过 WebShell 建立 suo5 隧道" }),
				h(Muted, null, "阶段"),
				h(Select, { value: stage, onChange: setStage, options: STAGES }),
				h(Muted, null, "顺序"),
				h(Input, { value: seq, onChange: setSeq, placeholder: "可选：seq（留空自动排最后）" }),
				h(Muted, null, "明细"),
				h(TextArea, {
					value: detail,
					onChange: setDetail,
					rows: 3,
					placeholder: "这一步怎么做的：入口、命令、账号来源，可留空",
				}),
				h(Muted, null, "得分点"),
				h(Input, {
					value: pointCode,
					onChange: setPointCode,
					placeholder: codes.length ? "code（如 R01）或数字 id，可留空" : "数字 point_id，可留空",
				}),
				h(Muted, null, "证据"),
				h(Input, { value: evidence, onChange: setEvidence, placeholder: "证据引用：文件路径 / 命令回显 / 截图文件名" }),
			),
			h(
				"div",
				{ style: { marginTop: 8 } },
				h(
					Toolbar,
					null,
					h(Btn, { variant: "primary", disabled: saving, onClick: () => void submit() }, saving ? "提交中…" : "添加步骤"),
					h(
						Muted,
						null,
						codes.length
							? `已加载 ${codes.length} 个得分点 code，可填 code 或数字 id`
							: "未取到得分点清单，得分点请填数字 point_id",
					),
				),
			),
		),
		h(
			Card,
			{
				title: "攻击图谱",
				actions: h(
					Toolbar,
					null,
					h(Badge, null, `节点 ${nodes.length}`),
					h(Badge, null, `资产 ${kindCounts.asset ?? 0}`),
					h(Badge, null, `漏洞 ${kindCounts.vuln ?? 0}`),
					h(Badge, null, `步骤 ${kindCounts.step ?? 0}`),
					h(Badge, null, `关系 ${edges.length}`),
				),
			},
			nodes.length === 0
				? h(Empty, null, loading ? "加载中…" : "还没有图谱节点，先录入资产与漏洞")
				: h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: 10 } },
						h(
							"div",
							null,
							h(Muted, null, "节点"),
							h(
								"div",
								{ style: { maxHeight: 220, overflow: "auto", marginTop: 4 } },
								h(Table, { head: ["类型 / 标识", "标签", "属性"], rows: nodeRows }),
							),
						),
						h(
							"div",
							null,
							h(Muted, null, "关系"),
							edges.length === 0
								? h(Muted, null, "暂无关系")
								: h(
										"div",
										{ style: { maxHeight: 220, overflow: "auto", marginTop: 4 } },
										h(Table, { head: ["来源", "关系", "目标"], rows: edgeRows }),
									),
						),
					),
		),
	);
}
