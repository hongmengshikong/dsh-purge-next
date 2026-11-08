/** 报告页：生成 Markdown 报告、按目标聚合统计、一键复制（带降级）。零依赖，React 由宿主提供。 */
import { createElement as h, useCallback, useEffect, useState } from "react";
import { Badge, Btn, Card, Empty, Muted, Table, Toolbar } from "../ui.js";
import { redteam } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText, fmt } from "./types.js";

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

interface ReportTarget {
	target?: string | null;
	vulns?: number | null;
	serious?: number | null;
}

interface TargetsData {
	ok?: boolean;
	error?: string;
	items?: ReportTarget[];
}

interface ReportData {
	ok?: boolean;
	error?: string;
	markdown?: string;
	generated_at?: string;
}

/** dispatch 用 HTTP 200 返回 ok:false，这里统一转成异常。 */
function unwrap<T extends { ok?: boolean; error?: string }>(data: T | null | undefined): T {
	if (data === null || data === undefined) throw new Error("接口返回为空");
	if (data.ok === false) throw new Error(data.error ?? "请求失败");
	return data;
}

/**
 * 复制到剪贴板：优先 navigator.clipboard.writeText；
 * 没有安全上下文 / 权限被拒时退到 textarea + execCommand，仍然失败则返回 false。
 */
async function copyText(text: string): Promise<boolean> {
	try {
		const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard;
		if (clipboard && typeof clipboard.writeText === "function") {
			await clipboard.writeText(text);
			return true;
		}
	} catch {
		/* 落到降级方案 */
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

export function ReportPage(props: PageProps): unknown {
	const { engagement, notify, refresh } = props;
	const [targets, setTargets] = useState<ReportTarget[]>([]);
	const [markdown, setMarkdown] = useState("");
	const [generatedAt, setGeneratedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	const loadTargets = useCallback(async () => {
		if (!engagement) {
			setTargets([]);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const data = unwrap(await redteam.reportTargets<TargetsData>(engagement));
			setTargets(data.items ?? []);
		} catch (err) {
			const text = errorText(err);
			setError(text);
			notify(text, "bad");
		} finally {
			setLoading(false);
		}
	}, [engagement, notify, reloadKey]);

	useEffect(() => {
		void loadTargets();
	}, [loadTargets]);

	const generate = useCallback(async () => {
		if (!engagement) {
			notify("先在顶部选择靶标", "bad");
			return;
		}
		setGenerating(true);
		setError(null);
		try {
			const data = unwrap(await redteam.report<ReportData>(engagement));
			setMarkdown(String(data.markdown ?? ""));
			setGeneratedAt(typeof data.generated_at === "string" ? data.generated_at : null);
			notify("报告已生成");
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

	const copy = useCallback(async () => {
		if (markdown === "") {
			notify("还没有报告内容，先生成报告", "bad");
			return;
		}
		const copied = await copyText(markdown);
		if (copied) notify("已复制", "ok");
		else notify("复制失败：在报告框内手动全选（Ctrl+A）后复制", "bad");
	}, [markdown, notify]);

	if (!engagement) {
		return h(Card, { title: "报告" }, h(Muted, null, "先在顶部选择或创建靶标，再生成报告。"));
	}

	const totals = targets.reduce<{ vulns: number; serious: number }>(
		(acc, item) => ({
			vulns: acc.vulns + Number(item.vulns ?? 0),
			serious: acc.serious + Number(item.serious ?? 0),
		}),
		{ vulns: 0, serious: 0 },
	);

	const targetRows = targets.map((item) => [
		h("span", { style: { fontFamily: MONO } }, fmt(item.target)),
		fmt(item.vulns),
		Number(item.serious ?? 0) > 0 ? h(Badge, { tone: "bad" }, fmt(item.serious)) : h(Muted, null, "0"),
	]);

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		h(
			Card,
			{
				title: "成果报告",
				actions: h(
					Toolbar,
					null,
					h(Btn, { variant: "primary", disabled: generating, onClick: () => void generate() }, generating ? "生成中…" : "生成报告"),
					h(Btn, { disabled: markdown === "", onClick: () => void copy() }, "复制"),
				),
			},
			h(
				Muted,
				null,
				generatedAt
					? `生成于 ${generatedAt} · 来自 redteam.report`
					: "报告按当前靶标的资产 / 漏洞 / 攻击链 / 得分汇总生成，Markdown 可直接贴进交付文档。",
			),
			error ? h("div", { style: { color: "#fecaca", marginTop: 4 } }, error) : null,
			markdown === ""
				? h(Empty, null, generating ? "正在生成…" : "点击「生成报告」输出 Markdown")
				: h(
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
								fontFamily: MONO,
								fontSize: 11.5,
								lineHeight: 1.6,
							},
						},
						markdown,
					),
		),
		h(
			Card,
			{
				title: "按目标聚合",
				actions: h(
					Toolbar,
					null,
					h(Badge, null, `目标 ${targets.length}`),
					h(Badge, null, `漏洞 ${totals.vulns}`),
					h(Badge, { tone: totals.serious > 0 ? "bad" : undefined }, `严重 ${totals.serious}`),
				),
			},
			targets.length === 0
				? h(Empty, null, loading ? "加载中…" : "还没有漏洞记录，先录入成果再聚合")
				: h(
						"div",
						{ style: { overflow: "auto" } },
						h(Table, { head: ["目标", "漏洞", "严重"], rows: targetRows }),
					),
		),
	);
}
