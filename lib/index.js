import { join } from "node:path";
import { findAiBase, findDshHome } from "./engine/host-discovery.js";
import { applyPayload, loadContext, patchesPayload, readPromptPayload, revertPayload, savePromptPayload, seedPayload, statusPayload, updatePayload } from "./service.js";
import { installBundledSkills } from "./redteam/skills.js";
import { readJsonBody } from "./redteam/http.js";
import { registerRedteamTools } from "./redteam/tools.js";
import { installRedteamApi } from "./redteam/http.js";
/**
 * 主插件入口。
 *
 * 与旧仓库的契约一致：默认导出 { name, inject, apply }；web 面通过
 * `webServer` 服务注册三条路由（status/apply/revert），启动时把内置提示词喂到磁盘。
 */
export const name = "dsh-purge-next";
export const inject = [];
function send(res, code, body) {
    const response = res;
    try {
        response.writeHead?.(code, { "content-type": "application/json; charset=utf-8" });
    }
    catch {
        /* 头部已发送时忽略 */
    }
    response.end?.(JSON.stringify(body));
}
export function apply(ctx) {
    const dshHome = findDshHome();
    const seed = seedPayload(dshHome);
    if (seed.ok)
        ctx.logger.info(`[dsh-purge-next] prompt-inject: ${seed.action}`);
    else
        ctx.logger.warn(`[dsh-purge-next] prompt-inject seed failed: ${seed.error ?? seed.action}`);
    try {
        const skills = installBundledSkills(join(dshHome, "redteam"));
        if (skills.installed.length > 0)
            ctx.logger.info(`[dsh-purge-next] bundled skills installed: ${skills.installed.length}`);
    }
    catch (error) {
        ctx.logger.warn(`[dsh-purge-next] bundled skills install failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const registerTools = (host) => {
        try {
            registerRedteamTools(host, dshHome);
        }
        catch (error) {
            ctx.logger.warn(`[dsh-purge-next] 工具注册失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    if (typeof ctx.inject === "function")
        ctx.inject(["tools"], (host) => registerTools(host));
    else
        registerTools(ctx);
    const context = () => loadContext({ aiBase: findAiBase(), dshHome: findDshHome() });
    const registerRoutes = (server) => {
        installRedteamApi(server, dshHome);
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
            path: "/dsh-purge-next/patches",
            handler: (_req, res) => {
                send(res, 200, patchesPayload(context()));
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/prompt",
            handler: async (req, res) => {
                const request = req;
                if (request.method === "GET") {
                    send(res, 200, readPromptPayload(dshHome));
                    return undefined;
                }
                if (request.method !== "POST") {
                    send(res, 405, { ok: false, error: "method not allowed" });
                    return undefined;
                }
                const body = await readJsonBody(req);
                send(res, 200, savePromptPayload(dshHome, typeof body.content === "string" ? body.content : ""));
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/update",
            handler: (_req, res) => {
                send(res, 200, updatePayload());
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
    };
    if (typeof ctx.inject === "function") {
        ctx.inject(["webServer"], (host) => {
            if (host.webServer)
                registerRoutes(host.webServer);
        });
        return;
    }
    const server = ctx.get("webServer");
    if (!server || typeof server.register !== "function") {
        ctx.logger.warn("[dsh-purge-next] webServer 不可用：status/apply/revert 路由未注册");
        return;
    }
    registerRoutes(server);
}
