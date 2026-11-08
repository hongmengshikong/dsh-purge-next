/** 插件级设置（并发智能体上限），对齐 settings.js。 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
export const DEFAULT_MAX_AGENTS = 3;
export const MAX_AGENTS_LIMIT = 10;
export function settingsPathOf(root) {
    return join(String(root || "."), "settings.json");
}
export function readSettings(root) {
    try {
        if (!existsSync(settingsPathOf(root)))
            return {};
        const parsed = JSON.parse(readFileSync(settingsPathOf(root), "utf8"));
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
export function writeSettings(root, patch) {
    const next = { ...readSettings(root), ...patch };
    mkdirSync(String(root || "."), { recursive: true });
    writeFileSync(settingsPathOf(root), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
}
export function clampMaxAgents(value) {
    const numeric = Math.floor(Number(value));
    if (!Number.isFinite(numeric))
        return DEFAULT_MAX_AGENTS;
    return Math.min(Math.max(numeric, 1), MAX_AGENTS_LIMIT);
}
export function maxAgentsOf(root, env = process.env) {
    const fromFile = Number(readSettings(root).maxAgents);
    if (Number.isFinite(fromFile) && fromFile > 0)
        return clampMaxAgents(fromFile);
    const fromEnv = Number(env?.REDTEAM_MAX_AGENTS);
    if (Number.isFinite(fromEnv) && fromEnv > 0)
        return clampMaxAgents(fromEnv);
    return DEFAULT_MAX_AGENTS;
}
export function saveMaxAgents(root, value) {
    const applied = clampMaxAgents(value);
    writeSettings(root, { maxAgents: applied });
    return applied;
}
export function maxAgentsSourceOf(root, env = process.env) {
    const fromFile = Number(readSettings(root).maxAgents);
    if (Number.isFinite(fromFile) && fromFile > 0)
        return "settings";
    const fromEnv = Number(env?.REDTEAM_MAX_AGENTS);
    if (Number.isFinite(fromEnv) && fromEnv > 0)
        return "env";
    return "default";
}
