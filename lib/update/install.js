/**
 * profile 安装补丁（旧 scripts/ensure-profile-bundle.mjs 的 TS 版）。
 *
 * pnpm add / dsh plugin add 都不会写这两笔：
 *   1. package.json 的 dsh.profile.bundles 加入插件
 *   2. 用户层 cordis.patch.yml 的本体 insert
 * 已有则跳过（幂等）。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
export const PLUGIN_NAME = "dsh-purge-next";
function readJson(fp) {
    try {
        return JSON.parse(readFileSync(fp, "utf8"));
    }
    catch {
        return null;
    }
}
function isProfilePkg(pkg) {
    if (!pkg || typeof pkg !== "object")
        return false;
    if (typeof pkg.name === "string" && pkg.name.startsWith("dsh-profile-"))
        return true;
    return Array.isArray(pkg.dsh?.profile?.bundles);
}
/** 从 INIT_CWD / local prefix / cwd 向上找 profile 目录。 */
export function findProfileDir(seeds = [process.env.INIT_CWD ?? "", process.env.npm_config_local_prefix ?? "", process.cwd()]) {
    for (const seed of seeds.filter(Boolean)) {
        let dir = resolve(seed);
        for (let depth = 0; depth < 8; depth += 1) {
            if (isProfilePkg(readJson(join(dir, "package.json"))))
                return dir;
            const parent = dirname(dir);
            if (parent === dir)
                break;
            dir = parent;
        }
    }
    return "";
}
export function hasBodyInsert(text, id = PLUGIN_NAME) {
    const lines = String(text ?? "").split(/\r?\n/);
    let insertIndent = -1;
    for (const line of lines) {
        if (/^-\s*insert:\s*$/.test(line) || /^\s+-\s*insert:\s*$/.test(line)) {
            insertIndent = (/^[ \t]*/.exec(line)?.[0] ?? "").length;
            continue;
        }
        if (insertIndent < 0)
            continue;
        const indent = (/^[ \t]*/.exec(line)?.[0] ?? "").length;
        const trimmed = line.trim();
        if (trimmed && indent <= insertIndent && /^-\s/.test(trimmed)) {
            insertIndent = -1;
            if (/^-\s*insert:\s*$/.test(trimmed))
                insertIndent = indent;
            continue;
        }
        if (new RegExp(`^-\\s*id:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`).test(trimmed))
            return true;
    }
    return false;
}
/** 幂等写入 bundles 与 insert。找不到 profile 时 skipped=true。 */
export function ensureProfileBundle(profileDir = findProfileDir(), id = PLUGIN_NAME) {
    if (!profileDir || !existsSync(join(profileDir, "package.json"))) {
        return { profileDir, bundlesChanged: false, insertChanged: false, skipped: true };
    }
    const pkgPath = join(profileDir, "package.json");
    const pkg = readJson(pkgPath) ?? {};
    pkg.dsh = pkg.dsh ?? {};
    pkg.dsh.profile = pkg.dsh.profile ?? {};
    const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
    let bundlesChanged = false;
    if (!bundles.includes(id)) {
        bundles.push(id);
        pkg.dsh.profile.bundles = bundles;
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
        bundlesChanged = true;
    }
    const ymlPath = join(profileDir, "cordis.patch.yml");
    let text = "";
    try {
        text = readFileSync(ymlPath, "utf8");
    }
    catch {
        text = "";
    }
    let insertChanged = false;
    if (!hasBodyInsert(text, id)) {
        const block = `- insert:\n    - id: ${id}\n      name: ${id}\n`;
        const prefix = text && !text.endsWith("\n") ? "\n" : "";
        writeFileSync(ymlPath, `${text}${prefix}${text ? "\n" : ""}${block}`, "utf8");
        insertChanged = true;
    }
    return { profileDir, bundlesChanged, insertChanged, skipped: false };
}
