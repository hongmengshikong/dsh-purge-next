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
