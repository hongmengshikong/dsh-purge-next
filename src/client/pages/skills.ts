/** 技能库页：列表/正文编辑、新建模板、导入、内置安装、体检、删除。 */
import { createElement as h, useCallback, useEffect, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Table, TextArea, Toolbar } from "../ui.js";
import { skills } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText } from "./types.js";

type Tone = "ok" | "warn" | "bad" | undefined;
type Busy = "" | "catalog" | "read" | "save" | "import" | "install" | "health" | "remove";

interface SkillItem {
	id: string;
	library: string;
	kind?: string;
	path?: string;
	description?: string;
	whenToUse?: string;
	valid?: boolean;
	error?: string | null;
	size?: number;
	updated_at?: string | null;
}

interface CatalogStatus {
	redteam?: number;
	official?: number;
	broken?: number;
	total?: number;
	redteamDir?: string;
	officialDir?: string;
}

interface CatalogPayload {
	ok?: boolean;
	items?: SkillItem[];
	status?: CatalogStatus;
	error?: string;
}

interface ReadPayload {
	ok?: boolean;
	item?: SkillItem;
	content?: string;
	error?: string;
}

interface BasicPayload {
	ok?: boolean;
	error?: string;
	id?: string;
	path?: string;
	removed?: boolean;
	installed?: string[];
	skipped?: number;
	source?: string;
	items?: SkillItem[];
}

interface HealthProblem {
	kind?: string;
	target?: string;
	fix?: string;
}

interface HealthItem {
	id: string;
	library?: string;
	ok?: boolean;
	problems?: HealthProblem[];
}

interface HealthPayload {
	ok?: boolean;
	items?: HealthItem[];
	error?: string;
}

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";
const VALID_NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function clip(text: string, head = 42, tail = 0): string {
	const value = String(text ?? "");
	if (!value) return "";
	if (value.length <= head + tail + 1) return value;
	if (tail <= 0) return `${value.slice(0, head)}…`;
	return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function templateFor(name: string): string {
	return [
		"---",
		`name: ${name}`,
		`description: ${name} 技能，一句话说明什么时候用它`,
		"---",
		"",
		"## 用途",
		"",
		"- 说明这个技能解决什么问题、什么时候该用。",
		"",
		"## 步骤",
		"",
		"1. ",
		"",
		"## 注意",
		"",
		"- ",
		"",
	].join("\n");
}

export function SkillsPage(props: PageProps): unknown {
	const [items, setItems] = useState<SkillItem[]>([]);
	const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | null>(null);
	const [selected, setSelected] = useState<SkillItem | null>(null);
	const [content, setContent] = useState("");
	const [dirty, setDirty] = useState(false);
	const [health, setHealth] = useState<HealthItem[] | null>(null);
	const [newName, setNewName] = useState("");
	const [importValue, setImportValue] = useState("");
	const [pendingDelete, setPendingDelete] = useState("");
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<Busy>("");

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const data = await skills.catalog<CatalogPayload>();
			if (data?.ok === false) throw new Error(data.error ?? "技能库读取失败");
			const list = Array.isArray(data?.items) ? data.items : [];
			setItems(list);
			setCatalogStatus(data?.status ?? null);
			setPendingDelete("");
			setSelected((prev) => {
				if (!prev) return prev;
				const hit = list.find((item) => item.id === prev.id && item.library === prev.library) ?? list.find((item) => item.id === prev.id);
				return hit ? { ...prev, ...hit } : prev;
			});
		} catch (error) {
			props.notify(`技能库读取失败：${errorText(error)}`, "bad");
		} finally {
			setLoading(false);
		}
	}, [props.notify]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const openItem = useCallback(
		async (item: SkillItem) => {
			setBusy("read");
			try {
				const data = await skills.read<ReadPayload>(item.id, item.library);
				if (data?.ok === false) throw new Error(data.error ?? "读取失败");
				const loaded = data?.item ?? item;
				setSelected({ ...item, ...loaded });
				setContent(typeof data?.content === "string" ? data.content : "");
				setDirty(false);
			} catch (error) {
				props.notify(`读取技能 ${item.id} 失败：${errorText(error)}`, "bad");
			} finally {
				setBusy("");
			}
		},
		[props.notify],
	);

	const save = useCallback(async () => {
		if (!selected) return;
		setBusy("save");
		try {
			const data = await skills.save<BasicPayload>(selected.id, content);
			if (data?.ok === false) throw new Error(data.error ?? "保存失败");
			setDirty(false);
			props.notify(`已保存技能 ${selected.id}`);
			setHealth(null);
			await reload();
			props.refresh();
		} catch (error) {
			props.notify(`保存失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
		}
	}, [content, props, reload, selected]);

	const createTemplate = useCallback(() => {
		const name = newName.trim();
		if (!VALID_NAME.test(name)) {
			props.notify("技能名要用 kebab-case（小写字母/数字/短横线），例如 code-review", "bad");
			return;
		}
		setSelected({ id: name, library: "redteam", path: "" });
		setContent(templateFor(name));
		setDirty(true);
		setNewName("");
		props.notify(`已生成 ${name} 模板，改完点「保存」写盘`);
	}, [newName, props]);

	const importSkill = useCallback(async () => {
		const target = importValue.trim();
		if (!target) {
			props.notify("先填要导入的目录（含 SKILL.md）或 .md 文件路径", "bad");
			return;
		}
		setBusy("import");
		try {
			const data = await skills.importPath<BasicPayload>(target);
			if (data?.ok === false) throw new Error(data.error ?? "导入失败");
			props.notify(`已导入技能 ${data?.id ?? ""}`);
			setImportValue("");
			setHealth(null);
			await reload();
			props.refresh();
		} catch (error) {
			props.notify(`导入失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
		}
	}, [importValue, props, reload]);

	const installBundled = useCallback(async () => {
		setBusy("install");
		try {
			const data = await skills.installBundled<BasicPayload>();
			if (data?.ok === false) throw new Error(data.error ?? "安装失败");
			const installed = Array.isArray(data?.installed) ? data.installed.length : 0;
			const skipped = Number(data?.skipped ?? 0);
			props.notify(installed > 0 ? `已安装 ${installed} 个内置技能（跳过已存在 ${skipped} 个）` : `内置技能都已存在（跳过 ${skipped} 个）`);
			setHealth(null);
			await reload();
			props.refresh();
		} catch (error) {
			props.notify(`安装内置技能失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
		}
	}, [props, reload]);

	const runHealth = useCallback(async () => {
		setBusy("health");
		try {
			const data = await skills.health<HealthPayload>();
			if (data?.ok === false) throw new Error(data.error ?? "体检失败");
			const list = Array.isArray(data?.items) ? data.items : [];
			setHealth(list);
			const failed = list.filter((item) => item.ok === false).length;
			props.notify(failed > 0 ? `体检完成：${failed}/${list.length} 项有问题` : `体检通过：${list.length} 个技能全部就绪`, failed > 0 ? "bad" : "ok");
		} catch (error) {
			props.notify(`体检失败：${errorText(error)}`, "bad");
		} finally {
			setBusy("");
		}
	}, [props.notify]);

	const removeItem = useCallback(
		async (item: SkillItem) => {
			if (item.library !== "redteam") {
				props.notify("只能删除 redteam 技能库里的技能", "bad");
				return;
			}
			if (pendingDelete !== item.id) {
				setPendingDelete(item.id);
				props.notify(`再点一次「确认删除」删除 ${item.id}`);
				return;
			}
			setBusy("remove");
			try {
				const data = await skills.remove<BasicPayload>(item.id);
				if (data?.ok === false) throw new Error(data.error ?? "删除失败");
				props.notify(`已删除技能 ${item.id}`);
				if (selected?.id === item.id) {
					setSelected(null);
					setContent("");
					setDirty(false);
				}
				setPendingDelete("");
				setHealth(null);
				await reload();
				props.refresh();
			} catch (error) {
				props.notify(`删除失败：${errorText(error)}`, "bad");
			} finally {
				setBusy("");
			}
		},
		[props, pendingDelete, reload, selected],
	);

	const locked = busy !== "" || loading;
	const failures = (health ?? []).filter((item) => item.ok === false);

	const listRows: unknown[][] = items.map((item) => [
		h(
			"span",
			{
				style: { fontFamily: MONO, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" },
				title: item.path ?? item.id,
				onClick: () => void openItem(item),
			},
			item.id,
		),
		h(Badge, { tone: item.library === "official" ? "warn" : undefined }, item.library || "redteam"),
		item.valid === false ? h(Badge, { tone: "bad" }, clip(item.error ?? "无效", 14, 0)) : h(Badge, { tone: "ok" }, "有效"),
		h("span", { title: item.description ?? "", style: { opacity: 0.85 } }, item.description ? clip(item.description, 46, 0) : "—"),
		h(
			Toolbar,
			null,
			h(Btn, { onClick: () => void openItem(item), disabled: busy !== "" }, busy === "read" ? "…" : "打开"),
			item.library === "redteam"
				? h(
						Btn,
						{ variant: "danger", onClick: () => void removeItem(item), disabled: busy !== "" },
						pendingDelete === item.id ? "确认删除" : "删除",
					)
				: null,
		),
	]);

	const listCard = h(
		Card,
		{
			title: `技能列表（${items.length}）`,
			actions: h(
				Toolbar,
				null,
				h(Btn, { onClick: () => void reload(), disabled: busy !== "" }, loading ? "刷新中…" : "刷新"),
				h(Btn, { onClick: () => void installBundled(), disabled: busy !== "" }, busy === "install" ? "执行中…" : "安装内置"),
				h(Btn, { onClick: () => void runHealth(), disabled: busy !== "" }, busy === "health" ? "执行中…" : "体检"),
			),
		},
		h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 8 } },
			catalogStatus
				? h(
						Muted,
						null,
						`redteam ${catalogStatus.redteam ?? 0} · official ${catalogStatus.official ?? 0} · 无效 ${catalogStatus.broken ?? 0}${
							catalogStatus.redteamDir ? ` · ${catalogStatus.redteamDir}` : ""
						}`,
					)
				: null,
			items.length === 0
				? h(Empty, null, loading ? "技能列表读取中…" : "还没有技能：可「安装内置」或从路径导入")
				: h(Table, { head: ["技能", "库", "校验", "说明", "操作"], rows: listRows }),
		),
	);

	const editorCard = h(
		Card,
		{
			title: selected ? `编辑：${selected.id}` : "编辑技能",
			actions: h(
				Toolbar,
				null,
				selected ? h(Badge, { tone: selected.library === "official" ? "warn" : undefined }, selected.library) : null,
				dirty ? h(Badge, { tone: "warn" }, "未保存") : null,
				h(Btn, { variant: "primary", onClick: () => void save(), disabled: busy !== "" || !selected }, busy === "save" ? "执行中…" : "保存"),
			),
		},
		selected
			? h(
					"div",
					{ style: { display: "flex", flexDirection: "column", gap: 8 } },
					h(TextArea, {
						value: content,
						onChange: (next: string) => {
							setContent(next);
							setDirty(true);
						},
						rows: 16,
						placeholder: "SKILL.md 内容（必须包含 --- frontmatter ---，其中 name/description 必填）",
						style: { minHeight: 260 },
					}),
					h(
						Muted,
						null,
						`${content.length} 字符${dirty ? " · 有未保存改动" : ""}${selected.path ? ` · ${selected.path}` : ""}${
							selected.library === "official" ? " · 官方技能保存后在 redteam 技能库生成同名副本" : ""
						}`,
					),
				)
			: h(Empty, null, "点击列表里的技能名加载正文，或在下面新建模板"),
	);

	const createCard = h(
		Card,
		{ title: "新建技能" },
		h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 8 } },
			h(
				Toolbar,
				null,
				h(Input, {
					value: newName,
					onChange: setNewName,
					placeholder: "kebab-case 名称，例如 code-review",
					style: { flex: 1, minWidth: 200 },
				}),
				h(Btn, { onClick: () => createTemplate(), disabled: busy !== "" }, "新建模板"),
			),
			h(Muted, null, "会预填 name/description frontmatter 到编辑器，点「保存」才写盘。"),
		),
	);

	const importCard = h(
		Card,
		{ title: "导入技能" },
		h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 8 } },
			h(
				Toolbar,
				null,
				h(Input, {
					value: importValue,
					onChange: setImportValue,
					placeholder: "目录（含 SKILL.md）或 .md 文件路径",
					style: { flex: 1, minWidth: 240 },
				}),
				h(Btn, { onClick: () => void importSkill(), disabled: busy !== "" }, busy === "import" ? "执行中…" : "导入"),
			),
			h(Muted, null, "导入到 redteam 技能库，同名会覆盖。"),
		),
	);

	const healthRows: unknown[][] = [];
	for (const item of failures) {
		const problems = Array.isArray(item.problems) ? item.problems : [];
		if (problems.length === 0) healthRows.push([item.id, "未知", "—", "体检失败但没有给出原因"]);
		for (const problem of problems) {
			healthRows.push([
				item.id,
				problem.kind || "—",
				problem.target || "—",
				h("span", { style: { opacity: 0.85 } }, problem.fix || "—"),
			]);
		}
	}

	const healthCard =
		health === null
			? null
			: h(
					Card,
					{
						title: `体检结果（${failures.length} 项失败 / ${health.length} 个技能）`,
						actions: h(
							Toolbar,
							null,
							h(Btn, { onClick: () => void runHealth(), disabled: busy !== "" }, busy === "health" ? "执行中…" : "重新体检"),
							h(Btn, { onClick: () => setHealth(null), disabled: busy !== "" }, "关闭"),
						),
					},
					failures.length === 0
						? h(Muted, null, "全部技能体检通过：正文提到的工具与环境变量都已就绪。")
						: h(Table, { head: ["技能", "类型", "对象", "修复建议"], rows: healthRows }),
				);

	return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, listCard, editorCard, createCard, importCard, healthCard);
}
