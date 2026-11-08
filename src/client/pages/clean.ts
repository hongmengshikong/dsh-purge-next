/** 清洗页：补丁状态总览、注入提示词编辑、应用/还原/刷新。 */
import { createElement as h, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Btn, Card, Empty, Muted, Select, Table, TextArea, Toolbar } from "../ui.js";
import { plugin } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText } from "./types.js";

type Tone = "ok" | "warn" | "bad" | undefined;
type Busy = "" | "load" | "save" | "apply" | "revert";

interface StatusPayload {
	ok?: boolean;
	error?: string;
	counts?: Record<string, number>;
	required?: number;
	required_bad?: { id: number; name: string; status: string }[];
	drifted?: { id: number; name: string }[];
	ai_base?: string | null;
	dsh_home?: string;
	host?: string;
}

interface UpdatePayload {
	ok?: boolean;
	configured?: boolean;
	channel?: string;
	repo_url?: string;
	tarball_url?: string | null;
	note?: string;
}

interface PatchRow {
	id: number;
	name: string;
	layer: string;
	status: string;
}

interface PatchesPayload {
	ok?: boolean;
	rows?: PatchRow[];
	error?: string;
}

interface PromptPayload {
	ok?: boolean;
	content?: string;
	path?: string;
	hash?: string;
	error?: string;
}

interface ApplyPayload {
	ok?: boolean;
	applied?: number;
	drifted?: number;
	changed_files?: number;
	required?: number;
	required_bad?: number;
	error?: string;
}

interface RevertPayload {
	ok?: boolean;
	reverted?: number;
	error?: string;
}

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

const STATUS_LABEL: Record<string, string> = {
	applied: "已应用",
	already: "已存在",
	ok: "已应用",
	pending: "待应用",
	drifted: "已漂移",
	skipped: "已跳过",
	unmatched: "未匹配",
	na: "不适用",
	missing_file: "文件缺失",
	unknown: "未知",
	missing: "缺失",
};

const STATUS_TONE: Record<string, Tone> = {
	applied: "ok",
	already: "ok",
	ok: "ok",
	pending: "warn",
	drifted: "bad",
	unmatched: "warn",
	missing_file: "bad",
	missing: "bad",
};

const COUNT_LABEL: Record<string, string> = {
	applied: "已应用",
	already: "已存在",
	pending: "待应用",
	drifted: "已漂移",
	skipped: "已跳过",
	unmatched: "未匹配",
	na: "不适用",
	missing_file: "文件缺失",
	unknown: "未知",
};

const COUNT_ORDER = ["applied", "already", "pending", "drifted", "skipped", "unmatched", "na", "missing_file", "unknown"];

const FILTERS = [
	{ value: "all", label: "全部状态" },
	{ value: "applied", label: "已应用" },
	{ value: "pending", label: "待应用" },
	{ value: "drifted", label: "已漂移" },
	{ value: "skipped", label: "已跳过" },
	{ value: "unmatched", label: "未匹配" },
	{ value: "na", label: "不适用" },
	{ value: "missing_file", label: "文件缺失" },
	{ value: "unknown", label: "未知" },
];

const ERROR_HINT: Record<string, string> = {
	ai_base_not_found: "没有找到宿主安装目录（ai_base），确认 dsh 已安装后点刷新。",
	patches_not_loaded: "补丁表没有加载成功，检查插件包里的 patches/ 目录。",
};

function statusLabel(status: string): string {
	return STATUS_LABEL[status] ?? (status || "未知");
}

function statusTone(status: string): Tone {
	return STATUS_TONE[status];
}

function countEntries(counts: Record<string, number> | undefined): { key: string; label: string; value: number }[] {
	const source = counts ?? {};
	const keys = [
		...COUNT_ORDER.filter((key) => source[key] !== undefined),
		...Object.keys(source).filter((key) => !COUNT_ORDER.includes(key)).sort(),
	];
	return keys.map((key) => ({ key, label: COUNT_LABEL[key] ?? key, value: Number(source[key] ?? 0) }));
}

function matchFilter(status: string, filter: string): boolean {
	if (filter === "all") return true;
	if (filter === "applied") return status === "applied" || status === "already" || status === "ok";
	return status === filter;
}

function countTone(key: string): Tone {
	if (key === "applied" || key === "already") return "ok";
	if (key === "pending" || key === "unmatched") return "warn";
	if (key === "drifted" || key === "missing_file") return "bad";
	return undefined;
}

export function CleanPage(props: PageProps): unknown {
	const [status, setStatus] = useState<StatusPayload | null>(null);
	const [update, setUpdate] = useState<UpdatePayload | null>(null);
	const [rows, setRows] = useState<PatchRow[]>([]);
	const [patchesError, setPatchesError] = useState("");
	const [filter, setFilter] = useState("all");
	const [promptValue, setPromptValue] = useState("");
	const [promptPath, setPromptPath] = useState("");
	const [promptDirty, setPromptDirty] = useState(false);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<Busy>("");
	const promptLoaded = useRef(false);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const [statusData, updateData, patchesData, promptData] = await Promise.all([
				plugin.status<StatusPayload>(),
				plugin.update<UpdatePayload>().catch(
					(): UpdatePayload => ({ ok: false, configured: false, channel: "", repo_url: "", tarball_url: null, note: "更新源读取失败" }),
				),
				plugin.patches<PatchesPayload>(),
				plugin.prompt<PromptPayload>().catch((): PromptPayload => ({ ok: false })),
			]);
			setStatus(statusData ?? null);
			setUpdate(updateData ?? null);
			setRows(Array.isArray(patchesData?.rows) ? patchesData.rows : []);
			setPatchesError(patchesData?.ok === false ? patchesData.error ?? "补丁清单读取失败" : "");
			if (!promptLoaded.current) {
				if (typeof promptData?.content === "string") {
					setPromptValue(promptData.content);
					setPromptPath(promptData.path ?? "");
					setPromptDirty(false);
					promptLoaded.current = true;
				} else if (promptData?.ok === false && promptData.error) {
					props.notify(`读取提示词失败：${promptData.error}`, "bad");
				}
			}
		} catch (error) {
			props.notify(`读取清洗状态失败：${errorText(error)}`, "bad");
		} finally {
			setLoading(false);
		}
	}, [props.notify]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const savePromptOnly = useCallback(async (): Promise<void> => {
		if (!promptLoaded.current) throw new Error("提示词尚未加载，先点刷新再保存");
		const saved = await plugin.savePrompt<PromptPayload>(promptValue);
		if (saved?.ok === false) throw new Error(saved.error ?? "保存失败");
		if (typeof saved?.content === "string") setPromptValue(saved.content);
		if (saved?.path) setPromptPath(saved.path);
		setPromptDirty(false);
		promptLoaded.current = true;
	}, [promptValue]);

	const onSavePrompt = useCallback(async () => {
		setBusy("save");
		try {
			await savePromptOnly();
			props.notify("提示词已保存");
		} catch (error) {
			props.notify(`提示词保存失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
		}
	}, [props.notify, savePromptOnly]);

	const onApply = useCallback(async () => {
		setBusy("apply");
		if (promptLoaded.current) {
			try {
				await savePromptOnly();
			} catch (error) {
				setBusy("");
				props.notify(`提示词保存失败，已中止应用：${errorText(error)}`, "bad");
				return;
			}
		}
		try {
			const result = await plugin.apply<ApplyPayload>();
			if (result?.error) throw new Error(result.error);
			const applied = Number(result?.applied ?? 0);
			const drifted = Number(result?.drifted ?? 0);
			const changed = Number(result?.changed_files ?? 0);
			const requiredBad = Number(result?.required_bad ?? 0);
			const ok = result?.ok !== false && drifted === 0 && requiredBad === 0;
			props.notify(
				ok
					? `补丁已应用 ${applied} 项 · 漂移 ${drifted} · 改动文件 ${changed}`
					: `补丁已应用 ${applied} 项，但仍有漂移 ${drifted}、必需缺口 ${requiredBad}`,
				ok ? "ok" : "bad",
			);
		} catch (error) {
			props.notify(`应用失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
			void reload();
		}
	}, [props.notify, reload, savePromptOnly]);

	const onRevert = useCallback(async () => {
		setBusy("revert");
		try {
			const result = await plugin.revert<RevertPayload>();
			if (result?.error) throw new Error(result.error);
			if (result?.ok === false) throw new Error("还原未完成");
			props.notify(`已还原 ${Number(result?.reverted ?? 0)} 处改动`);
		} catch (error) {
			props.notify(`还原失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
			void reload();
		}
	}, [props.notify, reload]);

	const locked = busy !== "" || loading;
	const counts = countEntries(status?.counts);
	const required = Number(status?.required ?? 0);
	const drifted = Array.isArray(status?.drifted) ? status.drifted : [];
	const statusFailed = status !== null && status.ok === false;
	const filtered = rows.filter((row) => matchFilter(row.status, filter));

	const updateText =
		update === null
			? "读取中…"
			: update.configured
				? `${update.channel || "master"} · ${update.repo_url || "未填写仓库地址"}`
				: update.note || "未配置（仓库上传后填写 URL）";

	const metadata = [
		status?.host ? `宿主 ${status.host}` : "",
		status?.ai_base ? `ai_base ${status.ai_base}` : "",
		status?.dsh_home ? `dsh_home ${status.dsh_home}` : "",
		promptPath ? `提示词 ${promptPath}` : "",
	].filter(Boolean);

	const statusCard = h(
		Card,
		{
			title: "清洗状态",
			actions: h(
				Toolbar,
				null,
				h(Btn, { onClick: () => void reload(), disabled: locked }, loading ? "刷新中…" : "刷新"),
				h(Btn, { variant: "primary", onClick: () => void onApply(), disabled: locked }, busy === "apply" ? "执行中…" : "应用补丁"),
				h(Btn, { variant: "danger", onClick: () => void onRevert(), disabled: locked }, busy === "revert" ? "执行中…" : "还原"),
			),
		},
		h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 8 } },
			h(
				Toolbar,
				null,
				h(Badge, { tone: statusFailed ? "bad" : "ok" }, `必需 ${required} 项`),
				h(Badge, { tone: drifted.length > 0 ? "bad" : "ok" }, `漂移 ${drifted.length} 项`),
				...counts.map((entry) => h(Badge, { key: entry.key, tone: countTone(entry.key) }, `${entry.label} ${entry.value}`)),
				status === null && loading ? h(Muted, null, "读取中…") : null,
			),
			statusFailed && status?.error
				? h(
						Toolbar,
						null,
						h(Badge, { tone: "bad" }, status.error),
						h(Muted, null, ERROR_HINT[status.error] ?? "状态读取不完整，可点刷新重试。"),
					)
				: null,
			drifted.length > 0
				? h(Muted, null, `漂移补丁：${drifted.map((item) => item.name || `#${item.id}`).join("、")}`)
				: null,
			h(
				Toolbar,
				null,
				h("span", { style: { opacity: 0.7 } }, "更新源"),
				h("span", { style: { fontFamily: MONO, fontSize: 11.5 } }, updateText),
			),
			update?.tarball_url
				? h(Muted, null, `更新包 tarball：${update.tarball_url}`)
				: null,
			metadata.length > 0
				? h(Muted, null, metadata.join(" · "))
				: null,
		),
	);

	const promptCard = h(
		Card,
		{
			title: "注入提示词",
			actions: h(
				Toolbar,
				null,
				promptDirty ? h(Badge, { tone: "warn" }, "未保存") : null,
				h(Btn, { onClick: () => void onSavePrompt(), disabled: locked }, busy === "save" ? "执行中…" : "保存提示词"),
			),
		},
		h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 8 } },
			h(TextArea, {
				value: promptValue,
				onChange: (next: string) => {
					setPromptValue(next);
					setPromptDirty(true);
				},
				rows: 10,
				placeholder: "在这里编辑注入提示词；应用补丁前会自动保存。",
				style: { minHeight: 170 },
			}),
			h(Muted, null, `${promptValue.length} 字符 · 应用补丁前自动保存${promptDirty ? " · 有未保存改动" : ""}`),
		),
	);

	const tableRows: unknown[][] = filtered.map((row) => [
		h("span", { style: { fontFamily: MONO, opacity: 0.75 } }, `#${row.id}`),
		row.name || "—",
		row.layer || "—",
		h(Badge, { tone: statusTone(row.status) }, statusLabel(row.status)),
	]);

	const patchCard = h(
		Card,
		{
			title: `补丁清单（${filtered.length}/${rows.length}）`,
			actions: h(Select, { value: filter, onChange: setFilter, options: FILTERS, style: { minWidth: 130 } }),
		},
		filtered.length === 0
			? h(
					Empty,
					null,
					rows.length === 0
						? loading
							? "补丁数据读取中…"
							: patchesError
								? `补丁清单读取失败：${patchesError}`
								: "暂无补丁数据"
						: "没有符合筛选的补丁",
				)
			: h(Table, { head: ["ID", "补丁", "层", "状态"], rows: tableRows }),
	);

	return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, statusCard, promptCard, patchCard);
}
