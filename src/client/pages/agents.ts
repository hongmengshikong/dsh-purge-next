/** 智能体页：角色提示词编辑 / 并发闸门说明 / 会话绑定。 */
import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Btn, Card, Empty, Muted, Select, Table, TextArea, Toolbar } from "../ui.js";
import { redteam } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText, fmt } from "./types.js";

type Res<T> = T & {
	ok?: boolean;
	error?: string;
};

interface RolePrompt {
	role: string;
	title?: string;
	planner?: boolean;
	dispatcher?: boolean;
	content?: string;
	updated_at?: string | null;
}

const MONO_STYLE: Record<string, string> = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", wordBreak: "break-all" };

function check<T>(data: Res<T>): T {
	if (data.ok === false) throw new Error(data.error || "接口返回失败");
	return data;
}

export function AgentsPage(props: PageProps): unknown {
	const eng = props.engagement ?? "";
	const notify = props.notify;
	const refresh = props.refresh;

	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [roles, setRoles] = useState<RolePrompt[]>([]);
	const [roleId, setRoleId] = useState("");
	const [content, setContent] = useState("");
	const [savedContent, setSavedContent] = useState("");

	/** 防重复保存：按钮 disabled 之外再加一把同步锁。 */
	const saveRef = useRef(false);

	/** load 里要判断“当前选中的角色是否还存在”，但不想把 roleId 放进依赖造成循环刷新。 */
	const roleRef = useRef("");
	useEffect(() => {
		roleRef.current = roleId;
	}, [roleId]);

	const load = useCallback(async (): Promise<void> => {
		if (!eng) return;
		setLoading(true);
		try {
			const result = check(await redteam.prompts<Res<{ roles?: RolePrompt[] }>>(eng));
			const list = result.roles ?? [];
			const keep = list.some((item) => item.role === roleRef.current) ? roleRef.current : (list[0]?.role ?? "");
			const hit = list.find((item) => item.role === keep);
			setRoles(list);
			setRoleId(keep);
			roleRef.current = keep;
			setContent(hit?.content ?? "");
			setSavedContent(hit?.content ?? "");
		} catch (error) {
			notify(errorText(error), "bad");
		} finally {
			setLoading(false);
		}
	}, [eng, notify]);

	useEffect(() => {
		void load();
	}, [load]);

	const current = useMemo(() => roles.find((item) => item.role === roleId), [roles, roleId]);
	const dirty = content !== savedContent;

	const pickRole = (value: string): void => {
		if (busy) return;
		setRoleId(value);
		roleRef.current = value;
		const hit = roles.find((item) => item.role === value);
		setContent(hit?.content ?? "");
		setSavedContent(hit?.content ?? "");
	};

	const save = (): void => {
		if (!eng) {
			notify("请先创建或选择靶标", "bad");
			return;
		}
		if (!roleId) {
			notify("请先选择角色", "bad");
			return;
		}
		if (saveRef.current) return;
		saveRef.current = true;
		setBusy(true);
		void (async () => {
			try {
				const result = check(await redteam.savePrompt<Res<{ role?: string; path?: string }>>(eng, roleId, content));
				setSavedContent(content);
				setRoles((prev) => prev.map((item) => (item.role === roleId ? { ...item, content, updated_at: new Date().toISOString() } : item)));
				notify(`角色 ${result.role ?? roleId} 提示词已保存`);
				refresh();
			} catch (error) {
				notify(errorText(error), "bad");
			} finally {
				saveRef.current = false;
				setBusy(false);
			}
		})();
	};

	if (!eng) {
		return h(
			Card,
			{ title: "还没有靶标" },
			h(Muted, null, "智能体提示词与靶标绑定，先在上方创建或选择靶标。"),
			h(Empty, null, "暂无数据"),
		);
	}

	const roleOptions = roles.map((item) => ({
		value: item.role,
		label: item.title ? `${item.role} · ${item.title}` : item.role,
	}));

	const gateCard = (): unknown =>
		h(
			Card,
			{ title: "并发闸门" },
			h(Toolbar, null, h(Badge, { tone: "warn" }, "并发上限 3"), h(Muted, null, "settings.json maxAgents 可改")),
			h(Muted, null, "最多 3 个执行智能体（settings.json maxAgents 可改）：规划器负责拆解任务，执行智能体并行落地，超出闸门的派发会被排队或拒绝。"),
		);

	const bindCard = (): unknown =>
		h(
			Card,
			{ title: "会话绑定" },
			h(Toolbar, null, h(Badge, null, "当前靶标"), h("span", { style: MONO_STYLE }, eng)),
			h(Muted, null, `提示词落盘位置：<靶标目录>/agents/<role>.md（靶标 ${eng}）。`),
		);

	const roleTable = (): unknown =>
		h(
			Card,
			{ title: "角色清单", actions: h(Muted, null, `${roles.length} 个`) },
			roles.length === 0
				? h(Empty, null, "暂无角色提示词")
				: h(Table, {
						head: ["角色", "标题", "类型", "更新时间", "编辑"],
						rows: roles.map((item) => [
							h("span", { style: MONO_STYLE }, item.role),
							item.title || "—",
							item.planner ? h(Badge, { tone: "warn" }, "planner") : h(Badge, null, "执行"),
							fmt(item.updated_at),
							h(Btn, { disabled: busy, onClick: () => pickRole(item.role) }, item.role === roleId ? "编辑中" : "编辑"),
						]),
					}),
		);

	const editorCard = (): unknown =>
		h(
			Card,
			{
				title: "角色提示词",
				actions: h(
					Toolbar,
					null,
					dirty ? h(Badge, { tone: "warn" }, "未保存") : h(Badge, { tone: "ok" }, "已同步"),
					h(Btn, { onClick: () => void load(), disabled: loading }, loading ? "加载中…" : "刷新"),
				),
			},
			h(
				Toolbar,
				null,
				h(Select, {
					value: roleId,
					options: roleOptions.length > 0 ? roleOptions : [{ value: "", label: "（无角色）" }],
					onChange: pickRole,
					style: { minWidth: 220 },
				}),
				current?.planner ? h(Badge, { tone: "warn" }, "规划器") : h(Badge, null, "执行智能体"),
				h(Muted, null, `更新时间 ${fmt(current?.updated_at)}`),
				h(Btn, { variant: "primary", disabled: busy || !roleId, onClick: save }, busy ? "保存中…" : "保存"),
			),
			h(TextArea, {
				value: content,
				onChange: (value: string) => setContent(value),
				placeholder: roleId ? `角色 ${roleId} 的提示词（Markdown）` : "先选择角色",
				rows: 18,
			}),
			h(Muted, null, `恢复默认：本页不提供一键重置。删除或清空 <靶标目录>/agents/${roleId || "<role>"}.md 后点刷新（或重开靶标面板）即回到内置默认文本。`),
		);

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		h(Toolbar, null, h(Muted, null, `靶标 ${eng}`), dirty ? h(Badge, { tone: "warn" }, "有未保存改动") : null),
		gateCard(),
		bindCard(),
		editorCard(),
		roleTable(),
	);
}
