/**
 * 红队工具集（先接 3 个高频工具，名称/参数与旧 tools.js 对齐）。
 *
 * 旧工具靠会话绑定解析靶标；本移植先用 `engagement` 参数 + 当前指针，
 * 会话级绑定在 M5 后续补齐。
 */
import type { PluginCtx } from "../host/types.js";
import { dispatch, redteamRoot } from "./api.js";
import { findDshHome } from "../engine/host-discovery.js";
import { bindEngagement, bindingViewOf, boundEngagement, resolveEngagement, type ExecLike } from "./session.js";

export interface ToolSpec {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	execute(args: Record<string, unknown>, exec?: ExecLike): Promise<string> | string;
}

const json = (value: unknown): string => JSON.stringify(value, null, 2);

export function buildTools(dshHome: string = findDshHome()): ToolSpec[] {
	const root = redteamRoot(dshHome);

	return [
		{
			name: "redteam_engagement_open",
			description:
				"打开或创建一次攻防演练靶标（按单位名称）。若靶标已存在则复用其资产库；后续资产工具默认作用于它。",
			parameters: {
				target: { type: "string", required: true, description: "靶标单位名称" },
				scope: { type: "array", items: { type: "string" }, description: "授权范围 CIDR 列表（可选）" },
			},
			execute(args, exec) {
				const name = String(args.target ?? "").trim();
				if (!name) throw new Error("target 必填");
				const scope = Array.isArray(args.scope) ? (args.scope as string[]) : [];
				const opened = dispatch(root, { op: "openEngagement", name, scope });
				if (!opened.ok) return json(opened);
				const id = (opened.engagement as { id: string }).id;
				bindEngagement(exec, id);
				const stats = dispatch(root, { op: "stats", engagement: id });
				return json({ ...opened, stats, session: bindingViewOf(exec) });
			},
		},
		{
			name: "redteam_asset_add",
			description:
				"把一个资产及其端口/服务/指纹写入资产库（幂等 upsert）。provenance 必填：被动收集 passive，主动探测 active。",
			parameters: {
				engagement: { type: "string", description: "靶标 id；省略用当前指针" },
				ip: { type: "string", required: true },
				state: { type: "string", description: "live | dead | unknown" },
				primary_name: { type: "string" },
				provenance: { type: "string", enum: ["passive", "active"], required: true },
				tool: { type: "string" },
				names: { type: "array", items: { type: "object" } },
				ports: { type: "array", items: { type: "object" } },
			},
			execute(args, exec) {
				const ip = String(args.ip ?? "").trim();
				if (!ip) throw new Error("ip 必填");
				if (args.provenance !== "passive" && args.provenance !== "active") throw new Error("provenance 必须是 passive|active");
				const asset = {
					ip,
					state: typeof args.state === "string" ? args.state : undefined,
					primary_name: typeof args.primary_name === "string" ? args.primary_name : undefined,
					provenance: args.provenance,
					tool: typeof args.tool === "string" ? args.tool : undefined,
					names: args.names,
					ports: args.ports,
				};
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "ingest", engagement: id, bundle: { assets: [asset] } }));
			},
		},
		{
			name: "redteam_asset_query",
			description: "检索资产库（C 段 / 状态 / 排序 / 条数）。返回资产行与开放端口计数。",
			parameters: {
				engagement: { type: "string" },
				cidr: { type: "string" },
				state: { type: "string", enum: ["live", "dead", "unknown"] },
				sort: { type: "string", enum: ["priority", "todo", "ports", "ip", "discovered"] },
				limit: { type: "number", description: "默认 50，最大 200" },
			},
			execute(args, exec) {
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(
					dispatch(root, {
						op: "assets",
						engagement: id,
						cidr: typeof args.cidr === "string" ? args.cidr : undefined,
						state: typeof args.state === "string" ? args.state : undefined,
						sort: typeof args.sort === "string" ? args.sort : "ip",
						limit: Math.min(Number(args.limit) || 50, 200),
					}),
				);
			},
		},
		{
			name: "redteam_session_bind",
			description: "把当前会话绑定到指定靶标（不影响其它会话）。",
			parameters: {
				engagement: { type: "string", required: true, description: "靶标 id" },
			},
			execute(args, exec) {
				const id = String(args.engagement ?? "").trim();
				if (!id) throw new Error("engagement 必填");
				bindEngagement(exec, id);
				return json({ ok: true, session: bindingViewOf(exec) });
			},
		},
		{
			name: "redteam_session_info",
			description: "查看当前会话绑定的靶标。",
			parameters: {},
			execute(_args, exec) {
				return json({ ok: true, session: bindingViewOf(exec) });
			},
		},
		{
			name: "redteam_vuln_add",
			description: "记录一条漏洞成果（标题必填；severity/cve/asset_id/target/evidence 可选）。",
			parameters: {
				engagement: { type: "string" },
				title: { type: "string", required: true },
				severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
				cve: { type: "string" },
				asset_id: { type: "number" },
				target: { type: "string" },
				evidence: { type: "string" },
			},
			execute(args, exec) {
				const title = String(args.title ?? "").trim();
				if (!title) throw new Error("title 必填");
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "addVuln", engagement: id, vuln: { ...args, title } }));
			},
		},
		{
			name: "redteam_vuln_query",
			description: "按 severity/status 查询漏洞成果。",
			parameters: {
				engagement: { type: "string" },
				severity: { type: "string" },
				status: { type: "string" },
				limit: { type: "number" },
			},
			execute(args, exec) {
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "vulns", engagement: id, severity: args.severity, status: args.status, limit: args.limit }));
			},
		},
		{
			name: "redteam_credential_add",
			description: "记录凭据（host 必填；同一 host+username+secret_type 幂等更新）。",
			parameters: {
				engagement: { type: "string" },
				host: { type: "string", required: true },
				username: { type: "string" },
				secret_type: { type: "string" },
				secret_value: { type: "string" },
				privilege: { type: "string" },
			},
			execute(args, exec) {
				const host = String(args.host ?? "").trim();
				if (!host) throw new Error("host 必填");
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "addCredential", engagement: id, credential: { ...args, host } }));
			},
		},
		{
			name: "redteam_tunnel_list",
			description: "列出已记录的内网隧道。",
			parameters: { engagement: { type: "string" }, limit: { type: "number" } },
			execute(args, exec) {
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "tunnels", engagement: id, limit: args.limit }));
			},
		},
		{
			name: "redteam_chain_add",
			description: "追加一条攻击链步骤。",
			parameters: {
				engagement: { type: "string" },
				title: { type: "string", required: true },
				stage: { type: "string" },
				asset_id: { type: "number" },
				vuln_id: { type: "number" },
				tool: { type: "string" },
				result: { type: "string" },
			},
			execute(args, exec) {
				const title = String(args.title ?? "").trim();
				if (!title) throw new Error("title 必填");
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "addChainStep", engagement: id, step: { ...args, title } }));
			},
		},
		{
			name: "redteam_roles",
			description: "列出演练台的作战角色（role/title/planner）。",
			parameters: { engagement: { type: "string" } },
			execute(args, exec) {
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				const result = dispatch(root, { op: "prompts", engagement: id }) as { roles?: { role: string; title: string; planner: boolean }[] };
				return json({ ok: true, roles: (result.roles ?? []).map((role) => ({ role: role.role, title: role.title, planner: role.planner })) });
			},
		},
		{
			name: "redteam_role_prompt",
			description: "读取某个角色的提示词正文。",
			parameters: { engagement: { type: "string" }, role: { type: "string", required: true } },
			execute(args, exec) {
				const role = String(args.role ?? "").trim();
				if (!role) throw new Error("role 必填");
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				const result = dispatch(root, { op: "prompts", engagement: id }) as { roles?: { role: string; content: string }[] };
				const hit = (result.roles ?? []).find((item) => item.role === role);
				return json(hit ? { ok: true, role, content: hit.content } : { ok: false, error: `未知角色: ${role}` });
			},
		},
		{
			name: "redteam_role_prompt_reset",
			description: "把角色提示词恢复为内置默认（不传 role 则全部恢复）。",
			parameters: { engagement: { type: "string" }, role: { type: "string" } },
			execute(args, exec) {
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "resetPrompts", engagement: id, role: args.role }));
			},
		},
		{
			name: "redteam_asset_graph",
			description: "资产图谱：C 段 → 资产 → 开放端口（含域名解析边）。",
			parameters: { engagement: { type: "string" }, cidr: { type: "string" } },
			execute(args, exec) {
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "graph", engagement: id, cidr: args.cidr }));
			},
		},
		{
			name: "redteam_http_evidence_add",
			description: "记录一条 HTTP 请求/响应证据（可直接粘贴进 Burp 复现）。",
			parameters: {
				engagement: { type: "string" },
				url: { type: "string", required: true },
				method: { type: "string" },
				status: { type: "number" },
				request: { type: "string" },
				response: { type: "string" },
				vuln_id: { type: "number" },
			},
			execute(args, exec) {
				const url = String(args.url ?? "").trim();
				if (!url) throw new Error("url 必填");
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "addHttpEvidence", engagement: id, evidence: { ...args, url } }));
			},
		},
		{
			name: "redteam_attack_file_add",
			description: "保存针对目标实际生效的脚本/POC（落盘 attack-files/）。",
			parameters: {
				engagement: { type: "string" },
				target: { type: "string", required: true },
				name: { type: "string", required: true },
				content: { type: "string", required: true },
				kind: { type: "string" },
				description: { type: "string" },
			},
			execute(args, exec) {
				const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
				return json(dispatch(root, { op: "addAttackFile", engagement: id, file: args }));
			},
		},
	];
}

export function registerRedteamTools(ctx: PluginCtx, dshHome?: string): void {
	const tools = buildTools(dshHome);
	for (const tool of tools) {
		ctx.tools?.register({
			name: tool.name,
			description: tool.description,
			input: tool.parameters,
			execute: (args: Record<string, unknown>, exec?: unknown) => tool.execute(args, exec as ExecLike),
		});
	}
}
