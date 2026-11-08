/** 会话隧道页：WebShell / 隧道 / 连通性实测（probeSessions）。 */
import { createElement as h, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Btn, Card, Empty, Input, Muted, Select, Table, Toolbar } from "../ui.js";
import { redteam } from "../api.js";
import type { PageProps } from "./types.js";
import { errorText, fmt } from "./types.js";

type Res<T> = T & {
	ok?: boolean;
	error?: string;
};

interface WebshellRow {
	id: number;
	url?: string | null;
	shell_type?: string | null;
	pass_key?: string | null;
	privilege?: string | null;
	status?: string | null;
	latency_ms?: number | null;
	last_check?: string | null;
	check_note?: string | null;
	note?: string | null;
	asset_ip?: string | null;
}

interface TunnelRow {
	id: number;
	kind?: string | null;
	listen?: string | null;
	entry?: string | null;
	entry_kind?: string | null;
	status?: string | null;
	latency_ms?: number | null;
	last_check?: string | null;
	check_note?: string | null;
	webshell_url?: string | null;
	asset_ip?: string | null;
}

interface Totals {
	webshells?: number;
	webshellsOnline?: number;
	tunnels?: number;
	tunnelsActive?: number;
	tunnelsLegit?: number;
	credentials?: number;
	accesses?: number;
}

interface SessionsData {
	webshells?: WebshellRow[];
	tunnels?: TunnelRow[];
	totals?: Totals;
}

interface ProbeShell {
	id: number;
	url?: string;
	status?: string;
	note?: string;
	latency_ms?: number;
}

interface ProbeTunnel {
	id: number;
	kind?: string;
	listen?: string;
	status?: string;
	note?: string;
	latency_ms?: number;
}

interface ProbeData {
	webshells?: ProbeShell[];
	tunnels?: ProbeTunnel[];
	checkedAt?: string;
	note?: string;
}

const SHELL_STATUSES = ["online", "offline", "unknown"];
const TUNNEL_STATUSES = ["active", "down", "unknown"];
const SHELL_TYPES = ["php", "jsp", "aspx", "ashx", "suo5", "behinder", "godzilla"];

const MONO_STYLE: Record<string, string> = { fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", wordBreak: "break-all" };
const PROBE_PRE_STYLE: Record<string, string | number> = {
	whiteSpace: "pre-wrap",
	wordBreak: "break-all",
	maxHeight: 220,
	overflow: "auto",
	margin: 0,
	padding: "6px 8px",
	fontSize: 11,
	lineHeight: 1.5,
	borderRadius: 8,
	background: "rgba(0,0,0,.24)",
	fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
};

function check<T>(data: Res<T>): T {
	if (data.ok === false) throw new Error(data.error || "接口返回失败");
	return data;
}

function shellTone(status: string): "ok" | "warn" | "bad" | undefined {
	if (status === "online") return "ok";
	if (status === "offline") return "bad";
	if (status === "unknown") return "warn";
	return undefined;
}

function tunnelTone(status: string): "ok" | "warn" | "bad" | undefined {
	if (status === "active") return "ok";
	if (status === "down") return "bad";
	if (status === "unknown") return "warn";
	return undefined;
}

function probeNote(text: string | undefined): string {
	const value = String(text ?? "").trim();
	return value === "" ? "—" : value;
}

export function SessionsPage(props: PageProps): unknown {
	const eng = props.engagement ?? "";
	const notify = props.notify;
	const refresh = props.refresh;

	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [probing, setProbing] = useState(false);
	const [data, setData] = useState<SessionsData | null>(null);
	const [probe, setProbe] = useState<ProbeData | null>(null);
	const [probeRaw, setProbeRaw] = useState(false);

	const [shellForm, setShellForm] = useState({ url: "", pass_key: "", shell_type: "php" });
	const [tunnelForm, setTunnelForm] = useState({ kind: "socks5", listen: "", entry: "", entry_kind: "target-outbound" });

	/** Select 无 disabled，重复提交靠 ref 兜底；probe 单独一把锁，避免和写操作互相顶掉。 */
	const workingRef = useRef(false);
	const probeRef = useRef(false);

	const load = useCallback(async (): Promise<void> => {
		if (!eng) return;
		setLoading(true);
		try {
			const result = check(await redteam.sessions<Res<SessionsData>>(eng));
			setData({ webshells: result.webshells ?? [], tunnels: result.tunnels ?? [], totals: result.totals ?? {} });
		} catch (error) {
			notify(errorText(error), "bad");
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
			if (workingRef.current) return;
			workingRef.current = true;
			setBusy(true);
			try {
				await work();
				await load();
				refresh();
			} catch (error) {
				notify(errorText(error), "bad");
			} finally {
				workingRef.current = false;
				setBusy(false);
			}
		},
		[eng, load, notify, refresh],
	);

	const addShell = (): void => {
		const url = shellForm.url.trim();
		if (!url) {
			notify("WebShell URL 必填", "bad");
			return;
		}
		void run(async () => {
			check(
				await redteam.addWebshell<Res<Record<string, unknown>>>(eng, {
					url,
					pass_key: shellForm.pass_key.trim() || null,
					shell_type: shellForm.shell_type,
					status: "unknown",
				}),
			);
			setShellForm({ url: "", pass_key: "", shell_type: "php" });
			notify("WebShell 已登记");
		});
	};

	const setShellStatus = (row: WebshellRow, status: string): void => {
		void run(async () => {
			/* 服务端对 check_note/latency_ms 不做 COALESCE，手动改状态时带上原值，避免把实测结果抹掉。 */
			check(
				await redteam.updateWebshell<Res<Record<string, unknown>>>(eng, row.id, {
					status,
					last_check: new Date().toISOString(),
					check_note: row.check_note ?? null,
					latency_ms: row.latency_ms ?? null,
				}),
			);
			notify(`WebShell #${row.id} → ${status}`);
		});
	};

	const addTunnel = (): void => {
		const listen = tunnelForm.listen.trim();
		if (!listen) {
			notify("隧道 listen 必填", "bad");
			return;
		}
		void run(async () => {
			check(
				await redteam.addTunnel<Res<{ id?: number }>>(eng, {
					kind: tunnelForm.kind.trim() || null,
					listen,
					entry: tunnelForm.entry.trim() || null,
					entry_kind: tunnelForm.entry_kind.trim() || null,
					status: "unknown",
				}),
			);
			setTunnelForm({ kind: "socks5", listen: "", entry: "", entry_kind: "target-outbound" });
			notify("隧道已登记");
		});
	};

	const setTunnelStatus = (row: TunnelRow, status: string): void => {
		void run(async () => {
			check(
				await redteam.updateTunnel<Res<Record<string, unknown>>>(eng, row.id, {
					status,
					last_check: new Date().toISOString(),
					check_note: row.check_note ?? null,
					latency_ms: row.latency_ms ?? null,
				}),
			);
			notify(`隧道 #${row.id} → ${status}`);
		});
	};

	const probeNow = (): void => {
		if (!eng || probeRef.current) return;
		probeRef.current = true;
		setProbing(true);
		void (async () => {
			try {
				const result = check(await redteam.probe<Res<ProbeData>>(eng));
				setProbe({
					webshells: result.webshells ?? [],
					tunnels: result.tunnels ?? [],
					checkedAt: result.checkedAt,
					note: result.note,
				});
				notify("连通性实测完成");
				await load();
				refresh();
			} catch (error) {
				notify(errorText(error), "bad");
			} finally {
				probeRef.current = false;
				setProbing(false);
			}
		})();
	};

	if (!eng) {
		return h(
			Card,
			{ title: "还没有靶标" },
			h(Muted, null, "先在上方创建或选择靶标，再登记 WebShell、隧道并做连通性实测。"),
			h(Empty, null, "暂无数据"),
		);
	}

	const totals = data?.totals ?? {};
	const shells = data?.webshells ?? [];
	const tunnels = data?.tunnels ?? [];

	const overview = (): unknown =>
		h(
			Card,
			{ title: "会话概览", actions: h(Muted, null, loading ? "加载中…" : `靶标 ${eng}`) },
			h(
				Toolbar,
				null,
				h(Badge, null, `WebShell ${fmt(totals.webshells ?? 0)}`),
				h(Badge, { tone: (totals.webshellsOnline ?? 0) > 0 ? "ok" : undefined }, `在线 ${fmt(totals.webshellsOnline ?? 0)}`),
				h(Badge, null, `隧道 ${fmt(totals.tunnels ?? 0)}`),
				h(Badge, { tone: (totals.tunnelsActive ?? 0) > 0 ? "ok" : undefined }, `活跃 ${fmt(totals.tunnelsActive ?? 0)}`),
				h(Badge, { tone: (totals.tunnelsLegit ?? 0) > 0 ? "ok" : "warn" }, `合规入口 ${fmt(totals.tunnelsLegit ?? 0)}`),
				h(Badge, null, `凭据 ${fmt(totals.credentials ?? 0)}`),
				h(Badge, null, `访问 ${fmt(totals.accesses ?? 0)}`),
			),
			h(Muted, null, "合规入口 = entry_kind 为 target-outbound / target-http / target-agent 的隧道；其余属于自建出入口。"),
		);

	const shellsCard = (): unknown =>
		h(
			Card,
			{ title: "WebShell", actions: h(Muted, null, `${shells.length} 个`) },
			h(
				Toolbar,
				null,
				h(Input, {
					value: shellForm.url,
					onChange: (value: string) => setShellForm({ ...shellForm, url: value }),
					placeholder: "URL（必填，例如 http://t/shell.php）",
					style: { flex: 3, minWidth: 220 },
				}),
				h(Input, {
					value: shellForm.pass_key,
					onChange: (value: string) => setShellForm({ ...shellForm, pass_key: value }),
					placeholder: "pass_key",
					style: { width: 130 },
				}),
				h(Select, {
					value: shellForm.shell_type,
					options: SHELL_TYPES.map((item) => ({ value: item, label: item })),
					onChange: (value: string) => setShellForm({ ...shellForm, shell_type: value }),
					style: { width: 120 },
				}),
				h(Btn, { variant: "primary", disabled: busy, onClick: addShell }, busy ? "写入中…" : "登记 WebShell"),
			),
			shells.length === 0
				? h(Empty, null, "暂无 WebShell")
				: h(Table, {
						head: ["ID", "URL", "类型", "状态", "延迟", "最近检查", "备注", "切换状态"],
						rows: shells.map((row) => [
							`#${row.id}`,
							h("span", { style: MONO_STYLE }, row.url || "—"),
							row.shell_type || "—",
							h(Badge, { tone: shellTone(String(row.status ?? "")) }, row.status || "unknown"),
							row.latency_ms === null || row.latency_ms === undefined ? "—" : `${fmt(row.latency_ms)} ms`,
							fmt(row.last_check),
							probeNote(row.check_note ?? row.note ?? ""),
							h(Select, {
								value: String(row.status ?? "unknown"),
								options: SHELL_STATUSES.map((item) => ({ value: item, label: item })),
								style: { width: 110 },
								onChange: (value: string) => setShellStatus(row, value),
							}),
						]),
					}),
		);

	const tunnelsCard = (): unknown =>
		h(
			Card,
			{ title: "隧道", actions: h(Muted, null, `${tunnels.length} 条`) },
			h(
				Toolbar,
				null,
				h(Input, {
					value: tunnelForm.kind,
					onChange: (value: string) => setTunnelForm({ ...tunnelForm, kind: value }),
					placeholder: "kind（socks5/suo5/ssh -R/frp）",
					style: { width: 190 },
				}),
				h(Input, {
					value: tunnelForm.listen,
					onChange: (value: string) => setTunnelForm({ ...tunnelForm, listen: value }),
					placeholder: "listen（127.0.0.1:1080，必填）",
					style: { flex: 2, minWidth: 190 },
				}),
				h(Input, {
					value: tunnelForm.entry,
					onChange: (value: string) => setTunnelForm({ ...tunnelForm, entry: value }),
					placeholder: "entry（入口地址）",
					style: { flex: 1, minWidth: 150 },
				}),
				h(Select, {
					value: tunnelForm.entry_kind,
					options: [
						{ value: "target-outbound", label: "target-outbound（合规）" },
						{ value: "target-http", label: "target-http（合规）" },
						{ value: "target-agent", label: "target-agent（合规）" },
						{ value: "self-build", label: "self-build（自建）" },
					],
					onChange: (value: string) => setTunnelForm({ ...tunnelForm, entry_kind: value }),
					style: { width: 200 },
				}),
				h(Btn, { variant: "primary", disabled: busy, onClick: addTunnel }, busy ? "写入中…" : "登记隧道"),
			),
			tunnels.length === 0
				? h(Empty, null, "暂无隧道")
				: h(Table, {
						head: ["ID", "类型", "监听", "入口", "出入口类型", "状态", "延迟", "最近检查", "切换状态"],
						rows: tunnels.map((row) => [
							`#${row.id}`,
							row.kind || "—",
							h("span", { style: MONO_STYLE }, row.listen || "—"),
							h("span", { style: MONO_STYLE }, row.entry || "—"),
							row.entry_kind || "—",
							h(Badge, { tone: tunnelTone(String(row.status ?? "")) }, row.status || "unknown"),
							row.latency_ms === null || row.latency_ms === undefined ? "—" : `${fmt(row.latency_ms)} ms`,
							fmt(row.last_check),
							h(Select, {
								value: String(row.status ?? "unknown"),
								options: TUNNEL_STATUSES.map((item) => ({ value: item, label: item })),
								style: { width: 110 },
								onChange: (value: string) => setTunnelStatus(row, value),
							}),
						]),
					}),
		);

	const probeCard = (): unknown =>
		h(
			Card,
			{
				title: "连通性实测",
				actions: h(
					Toolbar,
					null,
					h(Muted, null, probe?.checkedAt ? `上次 ${probe.checkedAt}` : "尚未实测"),
					probe ? h(Btn, { onClick: () => setProbeRaw(!probeRaw) }, probeRaw ? "收起原始" : "原始返回") : null,
					h(Btn, { variant: "primary", disabled: probing || busy, onClick: probeNow }, probing ? "实测中…" : "连通性实测"),
				),
			},
			probe?.note ? h(Muted, null, probe.note) : null,
			probe === null
				? h(Muted, null, "点「连通性实测」会逐个请求 WebShell 并 TCP 连接隧道监听地址，结果同时回写会话状态。")
				: h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: 10 } },
						(probe.webshells ?? []).length === 0
							? h(Empty, null, "没有可探测的 WebShell")
							: h(Table, {
									head: ["WebShell", "URL", "状态", "说明", "延迟"],
									rows: (probe.webshells ?? []).map((row) => [
										`#${row.id}`,
										h("span", { style: MONO_STYLE }, row.url || "—"),
										h(Badge, { tone: shellTone(String(row.status ?? "")) }, row.status || "unknown"),
										probeNote(row.note),
										row.latency_ms === undefined ? "—" : `${fmt(row.latency_ms)} ms`,
									]),
								}),
						(probe.tunnels ?? []).length === 0
							? h(Empty, null, "没有可探测的隧道")
							: h(Table, {
									head: ["隧道", "类型", "监听", "状态", "说明", "延迟"],
									rows: (probe.tunnels ?? []).map((row) => [
										`#${row.id}`,
										row.kind || "—",
										h("span", { style: MONO_STYLE }, row.listen || "—"),
										h(Badge, { tone: tunnelTone(String(row.status ?? "")) }, row.status || "unknown"),
										probeNote(row.note),
										row.latency_ms === undefined ? "—" : `${fmt(row.latency_ms)} ms`,
									]),
								}),
						probeRaw ? h("pre", { style: PROBE_PRE_STYLE }, JSON.stringify(probe, null, 2)) : null,
					),
		);

	return h(
		"div",
		{ style: { display: "flex", flexDirection: "column", gap: 10 } },
		h(
			Toolbar,
			null,
			h(Btn, { onClick: () => void load(), disabled: loading }, loading ? "刷新中…" : "刷新"),
			h(Muted, null, `靶标 ${eng}`),
		),
		overview(),
		shellsCard(),
		tunnelsCard(),
		probeCard(),
	);
}
