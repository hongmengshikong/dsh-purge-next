/**
 * 知识库页：POC 检索 / 正文编辑 / 保存 / 复用记账 / 本机模板命中 / 统计。
 *
 * 数据面（对照 src/redteam/api.ts 与 knowledge/store.ts）：
 *   pocSearch      → { items, stats }（items 不含正文，只有 content_bytes/has_content）
 *   pocGet         → 展开 poc 行，含 content
 *   pocSave        → { poc, created, path }（title 必填）
 *   pocUse         → { hit_count }（hit_count + 1）
 *   pocStats       → { stats: { total, verified, reused, withContent, byCategory } }
 *   templateSearch → { dir, total, items: [{ path, name, severity, tags }] }
 */
import { createElement as h, useCallback, useEffect, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Select, Table, TextArea, Toolbar } from "../ui.js";
import { knowledge } from "../api.js";
import { errorText, fmt, type PageProps } from "./types.js";

type Tone = "ok" | "warn" | "bad" | undefined;

const CATEGORIES = [
	{ value: "rce", label: "远程命令执行" },
	{ value: "deserialization", label: "反序列化" },
	{ value: "file-upload", label: "文件上传 getshell" },
	{ value: "sqli", label: "SQL 注入" },
	{ value: "unauthorized", label: "未授权访问" },
	{ value: "auth-bypass", label: "认证绕过 / 越权" },
	{ value: "weak-password", label: "弱口令 / 口令爆破" },
	{ value: "ssrf", label: "SSRF" },
	{ value: "xxe", label: "XXE" },
	{ value: "path-traversal", label: "目录穿越 / 任意文件读" },
	{ value: "info-leak", label: "信息泄露" },
	{ value: "privesc", label: "提权 / 横向" },
	{ value: "tunnel", label: "隧道 / 代理" },
	{ value: "other", label: "其它" },
];

const CATEGORY_OPTIONS = [{ value: "", label: "全部分类" }, ...CATEGORIES];

const SEVERITY_TONE: Record<string, Tone> = { critical: "bad", high: "bad", medium: "warn", low: "ok", info: undefined };

interface PocRow {
	id?: number;
	code: string;
	title?: string | null;
	category?: string | null;
	cve?: string | null;
	kind?: string | null;
	source?: string | null;
	path?: string | null;
	verified?: number | boolean | null;
	hit_count?: number | null;
	content?: string | null;
	content_bytes?: number | null;
	has_content?: number | null;
}

interface SearchRes {
	ok?: boolean;
	error?: string;
	items?: PocRow[];
	stats?: { total?: number; verified?: number; reused?: number };
}

interface GetRes extends PocRow {
	ok?: boolean;
	error?: string;
}

interface SaveRes {
	ok?: boolean;
	error?: string;
	poc?: PocRow;
	created?: boolean;
	path?: string | null;
}

interface UseRes {
	ok?: boolean;
	error?: string;
	code?: string;
	hit_count?: number;
}

interface PocStats {
	total?: number;
	verified?: number;
	reused?: number;
	withContent?: number;
	byCategory?: { code?: string; name?: string; n?: number; verified?: number }[];
}

interface StatsRes {
	ok?: boolean;
	error?: string;
	stats?: PocStats;
}

interface TemplateRow {
	path?: string;
	name?: string;
	severity?: string;
	tags?: string;
}

interface TemplateRes {
	ok?: boolean;
	error?: string;
	dir?: string | null;
	total?: number;
	items?: TemplateRow[];
}

function categoryLabel(code: string | null | undefined): string {
	const hit = CATEGORIES.find((item) => item.value === code);
	return hit ? hit.label : code ? String(code) : "其它";
}

function verifiedOf(value: boolean | number | null | undefined): boolean {
	return value === true || Number(value ?? 0) > 0;
}

export function KnowledgePage(props: PageProps): unknown {
	const { notify } = props;

	const [q, setQ] = useState("");
	const [category, setCategory] = useState("");
	const [verifiedOnly, setVerifiedOnly] = useState(false);
	const [applied, setApplied] = useState({ q: "", category: "", verified: false });
	const [tick, setTick] = useState(0);

	const [items, setItems] = useState<PocRow[]>([]);
	const [stats, setStats] = useState<PocStats>({});
	const [templates, setTemplates] = useState<TemplateRow[]>([]);
	const [templateDir, setTemplateDir] = useState<string | null>(null);

	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState("");

	const [selected, setSelected] = useState<string | null>(null);
	const [detail, setDetail] = useState<GetRes | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	// 已载入表单的 POC（用于「复用/保存后刷新」时保留正在编辑的草稿）
	const [formCode, setFormCode] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [cve, setCve] = useState("");
	const [content, setContent] = useState("");
	const [draftCategory, setDraftCategory] = useState("other");

	const search = useCallback(() => {
		setApplied({ q: q.trim(), category, verified: verifiedOnly });
		setTick((value) => value + 1);
	}, [category, q, verifiedOnly]);

	// 检索 + 模板命中 + 统计一起拉；apply 只在点搜索时变，避免逐字请求。
	useEffect(() => {
		let alive = true;
		setLoading(true);
		const run = async (): Promise<void> => {
			try {
				const filter: Record<string, unknown> = { limit: 200 };
				if (applied.q !== "") filter.q = applied.q;
				if (applied.category !== "") filter.category = applied.category;
				if (applied.verified) filter.verified = true;
				const [found, hits, stat] = await Promise.all([
					knowledge.search<SearchRes>(filter),
					applied.q !== "" ? knowledge.templates<TemplateRes>(applied.q) : Promise.resolve<TemplateRes>({ ok: true, items: [] }),
					knowledge.stats<StatsRes>(),
				]);
				if (!alive) return;
				if (found.ok === false) throw new Error(found.error ?? "检索失败");
				setItems(found.items ?? []);
				setTemplates((hits.items ?? []).slice(0, 10));
				setTemplateDir(hits.dir ?? null);
				// 统计失败不算致命：退回 pocSearch 附带的 stats。
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

	// 选中条目后拉正文；tick 变化（保存/复用后）同步最新 hit_count。
	useEffect(() => {
		if (selected === null || selected === "") {
			setDetail(null);
			setFormCode(null);
			return;
		}
		let alive = true;
		setDetailLoading(true);
		const run = async (): Promise<void> => {
			try {
				const data = await knowledge.get<GetRes>(selected);
				if (!alive) return;
				if (data.ok === false) throw new Error(data.error ?? "读取 POC 失败");
				if (!data.code) throw new Error("POC 不存在或已被删除");
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

	const save = useCallback(async (): Promise<void> => {
		if (!detail?.code) {
			notify("先选中一条 POC", "bad");
			return;
		}
		if (title.trim() === "") {
			notify("标题必填（写清是什么漏洞/组件的 POC）", "bad");
			return;
		}
		setBusy("save");
		try {
			const data = await knowledge.save<SaveRes>({
				code: detail.code,
				title: title.trim(),
				cve: cve.trim() || undefined,
				content,
				category: draftCategory,
				verified: true,
				source: "self",
				kind: String(detail.kind ?? "poc"),
			});
			if (data.ok === false) throw new Error(data.error ?? "保存失败");
			notify(`${data.created ? "已新建" : "已更新"} POC ${detail.code}`);
			setTick((value) => value + 1);
		} catch (error) {
			notify(errorText(error), "bad");
		} finally {
			setBusy("");
		}
	}, [content, cve, detail, draftCategory, notify, title]);

	const reuse = useCallback(async (): Promise<void> => {
		const code = detail?.code;
		if (!code) {
			notify("先选中一条 POC", "bad");
			return;
		}
		setBusy("use");
		try {
			const data = await knowledge.use<UseRes>(code);
			if (data.ok === false) throw new Error(data.error ?? "记录复用失败");
			notify(`已记一次复用：${code}，累计 ${Number(data.hit_count ?? 0)} 次`);
			setTick((value) => value + 1);
		} catch (error) {
			notify(errorText(error), "bad");
		} finally {
			setBusy("");
		}
	}, [detail, notify]);

	const resultRows = items.map((row) => [
		h(
			"span",
			{
				key: `title-${row.code}`,
				title: "点击加载正文",
				style: {
					cursor: "pointer",
					textDecoration: "underline",
					textDecorationStyle: "dotted",
					fontWeight: row.code === selected ? 600 : undefined,
				},
				onClick: () => setSelected(row.code),
			},
			fmt(row.title ?? row.code),
		),
		fmt(row.code),
		categoryLabel(row.category),
		h(Badge, { tone: verifiedOf(row.verified) ? "ok" : undefined }, verifiedOf(row.verified) ? "已验证" : "未验证"),
		fmt(row.hit_count ?? 0),
	]);

	const statsLine = h(
		Toolbar,
		null,
		h(Badge, null, `总数 ${stats.total ?? 0}`),
		h(Badge, { tone: "ok" }, `已验证 ${stats.verified ?? 0}`),
		h(Badge, { tone: "warn" }, `复用合计 ${stats.reused ?? 0}`),
		stats.withContent === undefined ? null : h(Muted, null, `有正文 ${stats.withContent}`),
	);

	const byCategory = (stats.byCategory ?? []).filter((row) => Number(row.n ?? 0) > 0);
	const categoryLine =
		byCategory.length === 0
			? null
			: h(Muted, null, byCategory.map((row) => `${categoryLabel(row.code)} ${Number(row.n ?? 0)}`).join(" · "));

	const searchCard = h(
		Card,
		{ title: "POC 知识库（跨靶标共享）" },
		h(
			Toolbar,
			null,
			h(Input, {
				value: q,
				onChange: setQ,
				placeholder: "标题 / CVE / 组件 / 正文关键词",
				style: { flex: 1, minWidth: 200 },
			}),
			h(Select, { value: category, onChange: setCategory, options: CATEGORY_OPTIONS }),
			h(
				Btn,
				{ variant: verifiedOnly ? "primary" : undefined, onClick: () => setVerifiedOnly(!verifiedOnly) },
				verifiedOnly ? "仅已验证 ✓" : "仅已验证",
			),
			h(Btn, { variant: "primary", onClick: search, disabled: loading }, loading ? "检索中…" : "搜索"),
		),
		statsLine,
		categoryLine,
	);

	const resultCard = h(
		Card,
		{
			title: `检索结果${loading ? " · 加载中…" : ""}`,
			actions: h(Muted, null, `${items.length} 条`),
		},
		items.length === 0
			? h(Empty, null, loading ? "加载中…" : applied.q || applied.category || applied.verified ? "没有命中：放宽关键词或分类" : "知识库还没有 POC")
			: h(Table, { head: ["标题", "code", "归类", "verified", "复用次数"], rows: resultRows }),
	);

	const detailCard =
		selected === null
			? null
			: h(
					Card,
					{
						title: `POC 详情 · ${selected}${detailLoading ? " · 加载中…" : ""}`,
						actions: h(Btn, { onClick: () => setSelected(null) }, "关闭"),
					},
					h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: 8 } },
						detail === null
							? h(Empty, null, detailLoading ? "加载中…" : "没有取到该 POC")
							: h(
									"div",
									{ style: { display: "flex", flexDirection: "column", gap: 8 } },
									h(
										Muted,
										null,
										[
											`source ${fmt(detail.source)}`,
											`kind ${fmt(detail.kind)}`,
											`verified ${verifiedOf(detail.verified) ? "是" : "否"}`,
											`复用 ${fmt(detail.hit_count ?? 0)} 次`,
											`文件 ${fmt(detail.path)}`,
										].join(" · "),
									),
									h(
										Toolbar,
										null,
										h(Input, { value: title, onChange: setTitle, placeholder: "标题（必填）", style: { flex: 1, minWidth: 200 } }),
										h(Input, { value: cve, onChange: setCve, placeholder: "CVE / 编号", style: { width: 150 } }),
										h(Select, { value: draftCategory, onChange: setDraftCategory, options: CATEGORIES }),
									),
									h(TextArea, {
										value: content,
										onChange: setContent,
										rows: 14,
										placeholder: "POC / EXP 正文（命令、脚本、请求原文均可）",
									}),
									h(
										Toolbar,
										null,
										h(
											Btn,
											{ variant: "primary", onClick: () => void save(), disabled: busy !== "" || detailLoading },
											busy === "save" ? "保存中…" : "保存到知识库",
										),
										h(
											Btn,
											{ onClick: () => void reuse(), disabled: busy !== "" || detailLoading },
											busy === "use" ? "记账中…" : "记一次复用",
										),
										h(Muted, null, "保存会写入 verified:true / source:self，并按当前归类归档。"),
									),
								),
					),
				);

	const templateCard = h(
		Card,
		{
			title: "模板命中",
			actions: h(Muted, null, applied.q === "" ? "待检索" : templateDir ? `目录 ${templateDir}` : "未配置 nuclei 模板目录"),
		},
		applied.q === ""
			? h(Muted, null, "输入关键词并搜索后，展示本机 nuclei 模板的前 10 条命中。")
			: templates.length === 0
				? h(Empty, null, templateDir ? "本机模板没有命中" : "没有找到 nuclei 模板目录（环境适配里可指定）")
				: h(Table, {
						head: ["模板路径", "名称", "等级", "标签"],
						rows: templates.map((row) => [
							fmt(row.path),
							fmt(row.name),
							h(Badge, { tone: SEVERITY_TONE[String(row.severity ?? "").toLowerCase()] }, fmt(row.severity ?? "—")),
							fmt(row.tags),
						]),
					}),
	);

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		searchCard,
		resultCard,
		detailCard,
		templateCard,
	);
}
