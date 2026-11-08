/** 环境适配页：适配原因、工具查找结果、整包目录分配、暂不配置。 */
import { createElement as h, useCallback, useEffect, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Table, Toolbar } from "../ui.js";
import { platform } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText } from "./types.js";

type Tone = "ok" | "warn" | "bad" | undefined;
type Busy = "" | "load" | "assign" | "skip";

interface ToolItem {
	id: string;
	label?: string;
	path?: string | null;
	source?: string;
	names?: string[];
	configured?: string;
	note?: string;
}

interface ToolsPayload {
	total?: number;
	found?: number;
	missing?: number;
	items?: ToolItem[];
}

interface AdaptPayload {
	ok?: boolean;
	ready?: boolean;
	reason?: string;
	message?: string;
	kali?: boolean;
	kaliSource?: string | null;
	skipped?: boolean;
	configured?: boolean;
	found?: number;
	missing?: number;
	total?: number;
	foundIds?: string[];
	missingIds?: string[];
}

interface SummaryPayload {
	ok?: boolean;
	error?: string;
	toolkitDir?: string;
	toolkitExists?: boolean;
	nucleiTemplatesDir?: string | null;
	tools?: ToolsPayload;
	adapt?: AdaptPayload;
	hint?: string;
	config?: Record<string, unknown>;
}

interface AssignPayload {
	ok?: boolean;
	error?: string;
	dir?: string;
	scanned?: number;
	assigned?: Record<string, string>;
	assignedCount?: number;
	hits?: { id: string; path: string; name: string }[];
	nucleiTemplatesDir?: string | null;
	config?: Record<string, unknown>;
	tools?: ToolsPayload;
	adapt?: AdaptPayload;
}

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

const REASON_LABEL: Record<string, string> = {
	kali: "Kali 宿主",
	skipped: "已确认暂不配置",
	configured: "已保存工具路径",
	"tools-found": "本机已找到工具",
	"need-config": "待配置",
};

const REASON_TONE: Record<string, Tone> = {
	"need-config": "bad",
	skipped: "warn",
	configured: "ok",
	"tools-found": "ok",
	kali: "ok",
};

function reasonLabel(reason: string): string {
	return REASON_LABEL[reason] ?? (reason || "未知");
}

function reasonTone(reason: string, ready: boolean): Tone {
	if (!ready) return "bad";
	return REASON_TONE[reason] ?? "ok";
}

function clip(text: string, head = 30, tail = 18): string {
	if (!text) return "";
	if (text.length <= head + tail + 1) return text;
	return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function pathLine(label: string, value: string | null | undefined): unknown {
	const text = value ? String(value) : "";
	return h(
		Toolbar,
		null,
		h("span", { style: { opacity: 0.7, minWidth: 96 } }, label),
		text
			? h("span", { title: text, style: { fontFamily: MONO, fontSize: 11.5, opacity: 0.9 } }, clip(text))
			: h(Muted, null, "未设置"),
	);
}

export function EnvPage(props: PageProps): unknown {
	const [summary, setSummary] = useState<SummaryPayload | null>(null);
	const [dir, setDir] = useState("");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<Busy>("");

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const data = await platform.summary<SummaryPayload>();
			if (data?.ok === false) throw new Error(data.error ?? "环境适配读取失败");
			setSummary(data ?? null);
		} catch (error) {
			props.notify(`环境适配读取失败：${errorText(error)}`, "bad");
		} finally {
			setLoading(false);
		}
	}, [props.notify]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const assign = useCallback(async () => {
		const target = dir.trim();
		if (!target) {
			props.notify("先填整包工具目录，例如 D:\\redteam-toolkit", "bad");
			return;
		}
		setBusy("assign");
		try {
			const result = await platform.assign<AssignPayload>(target);
			if (result?.ok === false) throw new Error(result.error ?? "分配失败");
			const assignedCount = Number(result?.assignedCount ?? 0);
			const scanned = Number(result?.scanned ?? 0);
			if (assignedCount === 0) {
				props.notify(`没有在 ${result?.dir ?? target} 里认出工具（扫描 ${scanned} 个文件），换目录或手动填写路径`, "bad");
			} else {
				props.notify(
					`已分配 ${assignedCount} 个工具（扫描 ${scanned} 个文件）${result?.nucleiTemplatesDir ? " · 已识别 nuclei-templates" : ""}`,
				);
			}
			await reload();
		} catch (error) {
			props.notify(`分配失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
		}
	}, [dir, props.notify, reload]);

	const skip = useCallback(async () => {
		setBusy("skip");
		try {
			const data = await platform.save<SummaryPayload>({ envAdaptSkip: true });
			if (data?.ok === false) throw new Error(data.error ?? "保存失败");
			if (data) setSummary(data);
			props.notify("已记录：暂不配置工具（扫描类技能可能不可用）");
		} catch (error) {
			props.notify(`保存失败：${errorText(error)}`, "bad");
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

	const summaryCard = h(
		Card,
		{
			title: "环境适配状态",
			actions: h(Btn, { onClick: () => void reload(), disabled: locked }, loading ? "刷新中…" : "刷新"),
		},
		h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 8 } },
			!loaded
				? h(Muted, null, loading ? "读取中…" : "环境适配读取失败，点右上角刷新重试。")
				: h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: 8 } },
						h(
							Toolbar,
							null,
							h(Badge, { tone: reasonTone(reason, ready) }, reasonLabel(reason)),
							h(Badge, { tone: found >= 2 ? "ok" : found > 0 ? "warn" : "bad" }, `已找到 ${found}/${total}`),
							h(Badge, { tone: missing > 0 ? "warn" : "ok" }, `未找到 ${missing}`),
							adapt.skipped ? h(Badge, { tone: "warn" }, "已跳过配置") : null,
							adapt.kali ? h(Badge, { tone: "ok" }, "Kali") : null,
						),
						h(Muted, null, `reason ${reason || "—"} · found ${found} · missing ${missing} · total ${total}`),
						h(Muted, null, adapt.message || summary?.hint || "没有适配说明。"),
						pathLine("工具箱目录", summary?.toolkitDir),
						pathLine("nuclei 模板", summary?.nucleiTemplatesDir ?? ""),
						summary?.toolkitExists === false ? h(Muted, null, "工具箱目录还不存在，可先分配整包目录。") : null,
					),
		),
	);

	const assignCard = h(
		Card,
		{ title: "整包目录分配" },
		h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 8 } },
			h(
				Toolbar,
				null,
				h(Input, {
					value: dir,
					onChange: setDir,
					placeholder: summary?.toolkitDir ? `例如 ${summary.toolkitDir}` : "例如 D:\\redteam-toolkit",
					style: { flex: 1, minWidth: 240 },
				}),
				h(Btn, { variant: "primary", onClick: () => void assign(), disabled: locked }, busy === "assign" ? "执行中…" : "分配"),
				h(Btn, { onClick: () => void skip(), disabled: locked }, busy === "skip" ? "执行中…" : "暂不配置"),
			),
			h(Muted, null, "会递归扫描该目录里的 nmap / nuclei / fscan / frp 等可执行文件并写入工具路径；扫描不到会提示失败。"),
			summary?.nucleiTemplatesDir
				? h(Muted, null, `已识别 nuclei 模板目录：${summary.nucleiTemplatesDir}`)
				: null,
		),
	);

	const tableRows: unknown[][] = items.map((item) => [
		h("span", { style: { fontFamily: MONO }, title: item.label ?? item.id }, item.id),
		item.path ? h(Badge, { tone: "ok" }, "已找到") : h(Badge, { tone: "warn" }, "未找到"),
		item.path
			? h("span", { title: item.path, style: { fontFamily: MONO, opacity: 0.85 } }, clip(item.path))
			: h("span", { style: { opacity: 0.6 }, title: item.note ?? "" }, item.note ?? "—"),
	]);

	const toolsCard = h(
		Card,
		{ title: `工具清单（${found}/${total}）` },
		items.length === 0
			? h(Empty, null, loading ? "工具清单读取中…" : "没有工具清单数据")
			: h(Table, { head: ["工具", "状态", "路径"], rows: tableRows }),
	);

	return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, summaryCard, assignCard, toolsCard);
}
