/**
 * 插件服务层：把引擎能力整理成可被 HTTP / 工具复用的纯函数。
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostApply, hostRevert, hostStatus, SUPPORTED_HOSTS } from "./engine/host.js";
import { loadPatchTables } from "./engine/load.js";
import { findAiBase, findDshHome } from "./engine/host-discovery.js";
import { seedPromptInjectAtBoot, readPromptInjectFile, saveOverrideContent, hashOverride, findOverrideFile } from "./prompt/inject.js";
import { describeUpdate, updateStatus, updateTarballUrl } from "./update/check.js";
export function defaultHost() {
    const env = process.env.DSH_PURGE_HOST;
    if (env && SUPPORTED_HOSTS.includes(env))
        return env;
    return SUPPORTED_HOSTS[0] ?? "0.2.2-rc.1";
}
/** lib/service.js → 包根（patches/ 在包根下） */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export function loadContext(options = {}) {
    const aiBase = options.aiBase !== undefined ? options.aiBase : findAiBase();
    const dshHome = options.dshHome ?? findDshHome();
    const host = defaultHost();
    let tables = options.tables ?? null;
    if (tables === null) {
        try {
            tables = loadPatchTables(join(PACKAGE_ROOT, "patches"));
        }
        catch {
            tables = null;
        }
    }
    return { aiBase, dshHome, host, tables };
}
export function statusPayload(ctx) {
    const base = {
        ok: false,
        ai_base: ctx.aiBase,
        dsh_home: ctx.dshHome,
        host: ctx.host,
        counts: {},
        required: 0,
        required_bad: [],
        drifted: [],
    };
    if (!ctx.aiBase || !existsSync(ctx.aiBase))
        return { ...base, error: "ai_base_not_found" };
    if (!ctx.tables)
        return { ...base, error: "patches_not_loaded" };
    try {
        const status = hostStatus(ctx.aiBase, ctx.host, ctx.tables);
        return {
            ...base,
            ok: true,
            counts: status.counts,
            required: status.required.length,
            required_bad: status.requiredBad,
            drifted: status.drifted,
        };
    }
    catch (error) {
        return { ...base, error: error instanceof Error ? error.message : String(error) };
    }
}
export function applyPayload(ctx) {
    const empty = { ok: false, applied: 0, drifted: 0, changed_files: 0, required: 0, required_bad: 0 };
    if (!ctx.aiBase || !existsSync(ctx.aiBase))
        return { ...empty, error: "ai_base_not_found" };
    if (!ctx.tables)
        return { ...empty, error: "patches_not_loaded" };
    try {
        const result = hostApply(ctx.aiBase, ctx.host, ctx.tables);
        const after = hostStatus(ctx.aiBase, ctx.host, ctx.tables);
        return {
            ok: result.drifted === 0 && after.requiredBad.length === 0,
            applied: result.applied,
            drifted: result.drifted,
            changed_files: result.changedFiles.length,
            required: after.required.length,
            required_bad: after.requiredBad.length,
        };
    }
    catch (error) {
        return { ...empty, error: error instanceof Error ? error.message : String(error) };
    }
}
export function revertPayload(ctx) {
    if (!ctx.aiBase || !existsSync(ctx.aiBase))
        return { ok: false, reverted: 0, error: "ai_base_not_found" };
    try {
        const result = hostRevert(ctx.aiBase);
        return { ok: true, reverted: result.reverted };
    }
    catch (error) {
        return { ok: false, reverted: 0, error: error instanceof Error ? error.message : String(error) };
    }
}
export function seedPayload(dshHome) {
    try {
        const result = seedPromptInjectAtBoot(dshHome);
        return { ok: result.action !== "error", action: result.action, path: result.path };
    }
    catch (error) {
        return { ok: false, action: "error", path: "", error: error instanceof Error ? error.message : String(error) };
    }
}
export function updatePayload() {
    const status = updateStatus();
    return {
        ok: status.configured,
        configured: status.configured,
        channel: status.channel,
        repo_url: status.repoUrl,
        tarball_url: updateTarballUrl(),
        note: describeUpdate(status),
    };
}
export function readPromptPayload(dshHome) {
    const content = readPromptInjectFile(dshHome);
    return { ok: true, path: findOverrideFile(dshHome), content, hash: hashOverride(content) };
}
export function savePromptPayload(dshHome, content) {
    saveOverrideContent(dshHome, content);
    const next = readPromptInjectFile(dshHome);
    return { ok: true, saved: true, path: findOverrideFile(dshHome), content: next, hash: hashOverride(next) };
}
/** 逐条补丁状态（设置页表格用）。 */
export function patchesPayload(ctx) {
    if (!ctx.aiBase || !existsSync(ctx.aiBase))
        return { ok: false, rows: [], error: "ai_base_not_found" };
    if (!ctx.tables)
        return { ok: false, rows: [], error: "patches_not_loaded" };
    try {
        const status = hostStatus(ctx.aiBase, ctx.host, ctx.tables);
        const rows = ctx.tables.all.map((patch) => ({
            id: patch.id,
            name: patch.name,
            layer: patch.layer ?? "",
            status: status.status[patch.id] ?? "unknown",
        }));
        return { ok: true, rows };
    }
    catch (error) {
        return { ok: false, rows: [], error: error instanceof Error ? error.message : String(error) };
    }
}
