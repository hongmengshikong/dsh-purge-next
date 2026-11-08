import type { PluginCtx } from "./host/types.js";
import { findAiBase, findDshHome } from "./engine/host-discovery.js";
import { applyPayload, loadContext, revertPayload, seedPayload, statusPayload } from "./service.js";

/**
 * 主插件入口。
 *
 * 与旧仓库的契约一致：默认导出 { name, inject, apply }；web 面通过
 * `webServer` 服务注册三条路由（status/apply/revert），启动时把内置提示词喂到磁盘。
 */
export const name = "dsh-purge-next";
export const inject: string[] = [];

interface HttpResponse {
	writeHead?(code: number, headers?: Record<string, string>): void;
	setHeader?(key: string, value: string): void;
	end?(body?: string): void;
}

interface RouteRegistrar {
	register(route: { kind: "exact" | "prefix"; path: string; handler: (req: unknown, res: unknown) => unknown }): unknown;
}

function send(res: unknown, code: number, body: unknown): void {
	const response = res as HttpResponse;
	try {
		response.writeHead?.(code, { "content-type": "application/json; charset=utf-8" });
	} catch {
		/* 头部已发送时忽略 */
	}
	response.end?.(JSON.stringify(body));
}

export function apply(ctx: PluginCtx): void {
	const dshHome = findDshHome();
	const seed = seedPayload(dshHome);
	if (seed.ok) ctx.logger.info(`[dsh-purge-next] prompt-inject: ${seed.action}`);
	else ctx.logger.warn(`[dsh-purge-next] prompt-inject seed failed: ${seed.error ?? seed.action}`);

	const server = ctx.get<RouteRegistrar>("webServer");
	if (!server || typeof server.register !== "function") {
		ctx.logger.warn("[dsh-purge-next] webServer 不可用：status/apply/revert 路由未注册");
		return;
	}

	const context = () => loadContext({ aiBase: findAiBase(), dshHome: findDshHome() });

	server.register({
		kind: "exact",
		path: "/dsh-purge-next/status",
		handler: (_req, res) => {
			send(res, 200, statusPayload(context()));
			return undefined;
		},
	});
	server.register({
		kind: "exact",
		path: "/dsh-purge-next/apply",
		handler: (_req, res) => {
			const payload = applyPayload(context());
			send(res, payload.ok ? 200 : 500, payload);
			return undefined;
		},
	});
	server.register({
		kind: "exact",
		path: "/dsh-purge-next/revert",
		handler: (_req, res) => {
			const payload = revertPayload(context());
			send(res, payload.ok ? 200 : 500, payload);
			return undefined;
		},
	});
}

export default { name, inject, apply };
