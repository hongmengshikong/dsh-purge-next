/**
 * prompt-inject 落盘与 seed（旧 core.js 同语义的 TS 移植）。
 *
 * - 注入读的是 $DSH_HOME/prompt-inject.md；
 * - 磁盘上是「用户自写」→ 永不覆盖；
 * - 磁盘上是插件旧默认（含 ChatML/小码酱特征）或当前默认 → 刷新为当前默认；
 * - state 记 hash / seedHash / customized，避免重新编码后被误判成用户自改。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROMPT_INJECT } from "./prompt-data.js";
export const normalizeOverride = (text) => String(text ?? "").replace(/\r\n/g, "\n").trim();
export function hashOverride(text) {
    return createHash("sha256").update(normalizeOverride(text), "utf8").digest("hex");
}
export const defaultOverrideText = () => DEFAULT_PROMPT_INJECT;
export const defaultOverrideHash = () => hashOverride(DEFAULT_PROMPT_INJECT);
export const findOverrideFile = (dshHome) => join(dshHome, "prompt-inject.md");
export const overrideStatePath = (dshHome) => join(dshHome, "dsh-purge", "override-state.json");
export function readOverrideState(dshHome) {
    try {
        const value = JSON.parse(readFileSync(overrideStatePath(dshHome), "utf8"));
        return value !== null && typeof value === "object" ? value : {};
    }
    catch {
        return {};
    }
}
function atomicWrite(fp, text) {
    mkdirSync(join(fp, ".."), { recursive: true });
    const tmp = `${fp}.tmp-${process.pid}`;
    writeFileSync(tmp, text, "utf8");
    renameSync(tmp, fp);
}
export function writeOverrideState(dshHome, state) {
    atomicWrite(overrideStatePath(dshHome), `${JSON.stringify(state, null, 2)}\n`);
}
export function readPromptInjectFile(dshHome) {
    try {
        return readFileSync(findOverrideFile(dshHome), "utf8");
    }
    catch {
        return "";
    }
}
const PLUGIN_DEFAULT_MARKS = ["<|im_start|>system:", "<project_instructions>", "Little Code Sauce"];
export function looksLikePluginDefault(text) {
    const normalized = normalizeOverride(text);
    if (!normalized)
        return false;
    if (normalized === normalizeOverride(DEFAULT_PROMPT_INJECT))
        return true;
    return PLUGIN_DEFAULT_MARKS.every((mark) => normalized.includes(mark));
}
function overrideTextIsOurs(state, text) {
    const stamp = hashOverride(text);
    if (typeof state.hash === "string" && state.hash === stamp)
        return true;
    if (typeof state.seedHash === "string" && state.seedHash === stamp)
        return true;
    return false;
}
/** 这份正文是不是用户另写的稿（插件旧默认、当前默认、上次 seed 都算「否」）。 */
export function isKeepableUserOverride(dshHome, text) {
    const incoming = normalizeOverride(text);
    if (!incoming)
        return false;
    if (incoming === normalizeOverride(DEFAULT_PROMPT_INJECT))
        return false;
    if (looksLikePluginDefault(text))
        return false;
    const state = readOverrideState(dshHome);
    const stamp = hashOverride(text);
    if (typeof state.seedHash === "string" && state.seedHash === stamp)
        return false;
    if (state.customized !== true && overrideTextIsOurs(state, text))
        return false;
    return true;
}
export function saveOverrideContent(dshHome, content) {
    const incoming = typeof content === "string" ? content : "";
    const customized = Boolean(normalizeOverride(incoming)) && normalizeOverride(incoming) !== normalizeOverride(DEFAULT_PROMPT_INJECT);
    const fp = findOverrideFile(dshHome);
    mkdirSync(dshHome, { recursive: true });
    atomicWrite(fp, incoming);
    writeOverrideState(dshHome, {
        customized,
        hash: hashOverride(incoming),
        seedHash: defaultOverrideHash(),
        updatedAt: new Date().toISOString(),
    });
}
/** 启动时把内置默认喂到磁盘；用户自改时保留。 */
export function seedPromptInjectAtBoot(dshHome) {
    const home = String(dshHome ?? "");
    const fp = findOverrideFile(home);
    if (!home)
        return { action: "error", path: fp, reason: "no_home" };
    const bundled = DEFAULT_PROMPT_INJECT;
    const bundledNorm = normalizeOverride(bundled);
    if (!bundledNorm)
        return { action: "empty_slot", path: fp };
    const diskRaw = readPromptInjectFile(home);
    const diskNorm = normalizeOverride(diskRaw);
    if (isKeepableUserOverride(home, diskRaw))
        return { action: "kept_user_custom", path: fp, reason: "user_custom" };
    if (diskNorm === bundledNorm)
        return { action: "current", path: fp, reason: "current" };
    try {
        atomicWrite(fp, bundled);
        writeOverrideState(home, {
            customized: false,
            hash: hashOverride(bundled),
            seedHash: defaultOverrideHash(),
            updatedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        return { action: "error", path: fp, reason: String(error instanceof Error ? error.message : error) };
    }
    return { action: diskNorm ? "refresh_default" : "seed_default", path: fp, reason: diskNorm ? "refresh_default" : "seed_default" };
}
/** 应用后：用户自写才按框落盘，否则走 seed。 */
export function commitOverrideOnApply(dshHome, incoming) {
    if (isKeepableUserOverride(dshHome, incoming)) {
        saveOverrideContent(dshHome, incoming);
        return { action: "saved_user", path: findOverrideFile(dshHome), reason: "saved_user" };
    }
    return seedPromptInjectAtBoot(dshHome);
}
export function installOverride(dshHome, force = false) {
    const fp = findOverrideFile(dshHome);
    mkdirSync(dshHome, { recursive: true });
    const bundled = DEFAULT_PROMPT_INJECT;
    if (!normalizeOverride(bundled))
        return existsSync(fp) ? "empty" : "missing";
    const disk = readPromptInjectFile(dshHome);
    const state = readOverrideState(dshHome);
    if (!force &&
        normalizeOverride(disk) &&
        hashOverride(disk) !== defaultOverrideHash() &&
        !overrideTextIsOurs(state, disk) &&
        !looksLikePluginDefault(disk)) {
        writeOverrideState(dshHome, { customized: true, hash: hashOverride(disk), seedHash: defaultOverrideHash(), updatedAt: new Date().toISOString() });
        return "exists";
    }
    if (!force && normalizeOverride(disk) && normalizeOverride(disk) === normalizeOverride(bundled)) {
        writeOverrideState(dshHome, { customized: false, hash: hashOverride(bundled), seedHash: defaultOverrideHash(), updatedAt: new Date().toISOString() });
        return "exists";
    }
    atomicWrite(fp, bundled);
    writeOverrideState(dshHome, { customized: false, hash: hashOverride(bundled), seedHash: defaultOverrideHash(), updatedAt: new Date().toISOString() });
    return "wrote";
}
