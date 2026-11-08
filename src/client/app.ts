/** 应用外壳：清洗 / 演练台（资产、漏洞、会话、智能体、攻击链、得分、报告）/ 技能库 / 知识库 / 环境适配。 */
import { createElement as h, useCallback, useEffect, useState } from "react";
import { DockShell, Card, Btn, Input, Select, Toolbar, Muted, Empty } from "./ui.js";
import { redteam } from "./api.js";
import type { PageProps } from "./pages/types.js";
import { CleanPage } from "./pages/clean.js";
import { AssetsPage } from "./pages/assets.js";
import { FindingsPage } from "./pages/findings.js";
import { SessionsPage } from "./pages/sessions.js";
import { AgentsPage } from "./pages/agents.js";
import { ChainPage } from "./pages/chain.js";
import { ScoresPage } from "./pages/scores.js";
import { ReportPage } from "./pages/report.js";
import { SkillsPage } from "./pages/skills.js";
import { KnowledgePage } from "./pages/knowledge.js";
import { EnvPage } from "./pages/env.js";

type TopTab = "clean" | "redteam" | "skills" | "knowledge" | "env";
type DrillTab = "assets" | "findings" | "sessions" | "agents" | "chain" | "scores" | "report";

const TOP_TABS = [
	{ id: "clean", label: "清洗" },
	{ id: "redteam", label: "演练台" },
	{ id: "skills", label: "技能库" },
	{ id: "knowledge", label: "知识库" },
	{ id: "env", label: "环境适配" },
];

const DRILL_TABS: { id: DrillTab; label: string }[] = [
	{ id: "assets", label: "资产测绘" },
	{ id: "findings", label: "漏洞成果" },
	{ id: "sessions", label: "会话隧道" },
	{ id: "agents", label: "智能体" },
	{ id: "chain", label: "攻击链" },
	{ id: "scores", label: "得分目标" },
	{ id: "report", label: "报告" },
];

export function App(): unknown {
	const [tab, setTab] = useState<TopTab>("clean");
	const [drillTab, setDrillTab] = useState<DrillTab>("assets");
	const [engagements, setEngagements] = useState<{ id: string; name?: string }[]>([]);
	const [current, setCurrent] = useState<string | null>(null);
	const [newName, setNewName] = useState("");
	const [toast, setToast] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);
	const [tick, setTick] = useState(0);

	const refresh = useCallback(() => setTick((value) => value + 1), []);
	const notify = useCallback((text: string, tone: "ok" | "bad" = "ok") => {
		setToast({ text, tone });
		setTimeout(() => setToast(null), 3200);
	}, []);

	const load = useCallback(async () => {
		try {
			const data = await redteam.bootstrap<{ ok?: boolean; engagements?: { id: string; name?: string }[]; current?: string | null }>();
			setEngagements(data.engagements ?? []);
			setCurrent((prev) => prev ?? data.current ?? null);
		} catch (error) {
			notify(error instanceof Error ? error.message : String(error), "bad");
		}
	}, [notify]);

	useEffect(() => {
		void load();
	}, [load, tick]);

	const openEngagement = useCallback(async () => {
		const name = newName.trim();
		if (!name) return;
		try {
			const opened = await redteam.open<{ ok?: boolean; engagement?: { id: string } }>(name, []);
			const id = opened?.engagement?.id;
			if (id) {
				setCurrent(id);
				setNewName("");
				refresh();
				notify(`已创建靶标 ${name}`);
			}
		} catch (error) {
			notify(error instanceof Error ? error.message : String(error), "bad");
		}
	}, [newName, notify, refresh]);

	const activate = useCallback(
		async (id: string) => {
			try {
				await redteam.activate(id);
				setCurrent(id);
				refresh();
			} catch (error) {
				notify(error instanceof Error ? error.message : String(error), "bad");
			}
		},
		[notify, refresh],
	);

	const pageProps: PageProps = { engagement: current, refresh, notify };

	const renderDrill = (): unknown => {
		if (!current) {
			return h(
				Card,
				{ title: "还没有靶标" },
				h(Muted, null, "输入攻防演练靶标单位名称，创建演练并开始资产测绘。"),
				h(
					Toolbar,
					null,
					h(Input, { value: newName, onChange: setNewName, placeholder: "例如：示例科技有限公司", style: { flex: 1, minWidth: 220 } }),
					h(Btn, { variant: "primary", onClick: () => void openEngagement() }, "创建靶标"),
				),
			);
		}
		switch (drillTab) {
			case "assets":
				return h(AssetsPage, pageProps);
			case "findings":
				return h(FindingsPage, pageProps);
			case "sessions":
				return h(SessionsPage, pageProps);
			case "agents":
				return h(AgentsPage, pageProps);
			case "chain":
				return h(ChainPage, pageProps);
			case "scores":
				return h(ScoresPage, pageProps);
			case "report":
				return h(ReportPage, pageProps);
			default:
				return h(Empty, null);
		}
	};

	const body = (): unknown => {
		if (tab === "clean") return h(CleanPage, pageProps);
		if (tab === "skills") return h(SkillsPage, pageProps);
		if (tab === "knowledge") return h(KnowledgePage, pageProps);
		if (tab === "env") return h(EnvPage, pageProps);
		if (!current) return renderDrill();
		return h(
			"div",
			{ style: { display: "flex", flexDirection: "column", gap: 10 } },
			h(
				Toolbar,
				null,
				h(Select, {
					value: current,
					onChange: (value: string) => void activate(value),
					options: engagements.length
						? engagements.map((item) => ({ value: item.id, label: item.name ? `${item.name}（${item.id}）` : item.id }))
						: [{ value: current, label: current }],
				}),
				h(Input, { value: newName, onChange: setNewName, placeholder: "新建靶标名称" }),
				h(Btn, { onClick: () => void openEngagement() }, "新建"),
				h(Btn, { onClick: refresh }, "刷新"),
			),
			h(
				"div",
				{ style: { display: "flex", gap: 2, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,.08)", paddingBottom: 6 } },
				...DRILL_TABS.map((item) =>
					h("span", {
						key: item.id,
						className: "dshp-ui-tab",
						"data-on": item.id === drillTab ? "1" : "0",
						onClick: () => setDrillTab(item.id),
					}, item.label),
				),
			),
			renderDrill(),
		);
	};

	return h(
		DockShell,
		{ title: "dsh-purge-next", tabs: TOP_TABS, active: tab, onTab: (id: string) => setTab(id as TopTab), storageKey: "dshp-next-geom" },
		body(),
		toast
			? h(
					"div",
					{
						style: {
							position: "fixed",
							right: 24,
							bottom: 24,
							zIndex: 80,
							padding: "8px 14px",
							borderRadius: 10,
							fontSize: 12,
							background: toast.tone === "bad" ? "rgba(185,28,28,.92)" : "rgba(22,101,52,.92)",
							color: "#fff",
							boxShadow: "0 8px 24px rgba(0,0,0,.35)",
						},
					},
					toast.text,
				)
			: null,
	);
}
