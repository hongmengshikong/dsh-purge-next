import { join } from "node:path";
import { findAiBase, findDshHome } from "./engine/host-discovery.js";
import { applyPayload, loadContext, patchesPayload, readDrillGrant, readPromptPayload, revertPayload, saveDrillGrant, savePromptPayload, seedPayload, statusPayload, updatePayload } from "./service.js";
import { installBundledSkills, readSkill, saveSkill, skillCatalog } from "./redteam/skills.js";
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
            path: "/dsh-purge-next/override",
            handler: async (req, res) => {
                const request = req;
                if (request.method === "GET") {
                    const prompt = readPromptPayload(dshHome);
                    send(res, 200, { ok: true, content: prompt.content, defaultContent: prompt.content, hash: prompt.hash });
                    return undefined;
                }
                const body = await readJsonBody(req);
                const saved = savePromptPayload(dshHome, typeof body.content === "string" ? body.content : "");
                send(res, 200, { ...saved });
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/own-servers",
            handler: async (req, res) => {
                const request = req;
                if (request.method === "GET") {
                    send(res, 200, { ok: true, content: "" });
                    return undefined;
                }
                send(res, 200, { ok: true });
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/rules",
            handler: (_req, res) => {
                send(res, 200, { ok: true, rules: [] });
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/hooks-deny",
            handler: async (req, res) => {
                const request = req;
                if (request.method === "GET") {
                    send(res, 200, { ok: true, hooksDenyBypass: false });
                    return undefined;
                }
                readJsonBody(req).catch(() => ({}));
                send(res, 200, { ok: true, hooksDenyBypass: false });
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/skills",
            handler: (_req, res) => {
                send(res, 200, { ok: true, skills: skillCatalog(join(dshHome, "redteam")).map((item) => item.id), items: skillCatalog(join(dshHome, "redteam")) });
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/skill",
            handler: async (req, res) => {
                const request = req;
                if (request.method === "GET") {
                    const url = new URL(String(req.url ?? "/"), "http://local");
                    const name = url.searchParams.get("name") ?? "";
                    const hit = readSkill(join(dshHome, "redteam"), name, "redteam");
                    send(res, 200, hit ? { ok: true, ...hit } : { ok: false, error: "skill not found" });
                    return undefined;
                }
                const body = await readJsonBody(req);
                const saved = saveSkill(join(dshHome, "redteam"), String(body.name ?? ""), String(body.content ?? ""), typeof body.description === "string" ? body.description : "");
                send(res, 200, saved);
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/restart",
            handler: (_req, res) => {
                send(res, 200, { ok: false, error: "请手动重启 dsh web（插件不自动重启宿主）" });
                return undefined;
            },
        });
        server.register({
            kind: "exact",
            path: "/dsh-purge-next/drill-grant",
            handler: async (req, res) => {
                const request = req;
                if (request.method === "GET") {
                    send(res, 200, { ok: true, ...readDrillGrant(dshHome) });
                    return undefined;
                }
                let granted = true;
                try {
                    const body = await readJsonBody(req);
                    if (typeof body.granted === "boolean")
                        granted = body.granted;
                }
                catch {
                    /* 空 body 视为授权 */
                }
                send(res, 200, { ok: true, ...saveDrillGrant(dshHome, granted) });
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
