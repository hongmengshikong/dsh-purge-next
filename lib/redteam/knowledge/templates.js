/** 本机 nuclei 模板索引（POC 优先查本机现成模板）。 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadPlatformConfig, nucleiTemplatesDirOf } from "../platform-config.js";
export function nucleiTemplatesDir(root) {
    // 环境适配里手填/自动分配的路径优先
    try {
        const configured = nucleiTemplatesDirOf(loadPlatformConfig(root), root);
        if (configured)
            return configured;
    }
    catch {
        /* 配置读失败继续默认探测 */
    }
    const env = process.env.NUCLEI_TEMPLATES;
    if (env && existsSync(env))
        return env;
    const candidates = [
        join(root, "toolkit", "nuclei-templates"),
        join(homedir(), ".local", "nuclei-templates"),
        join(homedir(), "nuclei-templates"),
        "/usr/share/nuclei-templates",
        "/opt/nuclei-templates",
    ];
    return candidates.find((dir) => existsSync(dir)) ?? null;
}
function cachePath(root) {
    return join(root, "pocs", ".nuclei-index.json");
}
export function nucleiIndex(root, force = false) {
    const dir = nucleiTemplatesDir(root);
    if (!dir)
        return { dir: null, items: [], cached: false };
    const cache = cachePath(root);
    if (!force && existsSync(cache)) {
        try {
            const cached = JSON.parse(readFileSync(cache, "utf8"));
            const fresh = cached.dir === dir && Array.isArray(cached.items) && Date.now() - Number(cached.built_at || 0) < 7 * 24 * 3600 * 1000;
            if (fresh && cached.items)
                return { dir, items: cached.items, cached: true };
        }
        catch {
            /* 坏缓存重建 */
        }
    }
    const items = [];
    const walk = (rel) => {
        let entries;
        try {
            entries = readdirSync(join(dir, rel), { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const next = rel === "" ? entry.name : `${rel}/${entry.name}`;
            if (entry.isDirectory()) {
                walk(next);
                continue;
            }
            if (!/\.ya?ml$/i.test(entry.name))
                continue;
            let head = "";
            try {
                head = readFileSync(join(dir, next), "utf8").slice(0, 2000);
            }
            catch {
                continue;
            }
            const pick = (re) => {
                const match = re.exec(head);
                return match === null ? "" : String(match[1]).trim().replace(/^["']|["']$/g, "");
            };
            items.push({
                path: next,
                name: pick(/^\s*name:\s*(.+)$/m),
                severity: pick(/^\s*severity:\s*(.+)$/m),
                tags: pick(/^\s*tags:\s*(.+)$/m),
            });
        }
    };
    walk("");
    try {
        mkdirSync(join(root, "pocs"), { recursive: true });
        writeFileSync(cache, JSON.stringify({ built_at: Date.now(), dir, items }), "utf8");
    }
    catch {
        /* 写不进缓存不影响检索 */
    }
    return { dir, items, cached: false };
}
export function templateStats(root) {
    const { dir, items } = nucleiIndex(root);
    return { dir: dir ?? null, total: items.length, cve: items.filter((item) => /cve-\d{4}-\d+/i.test(item.path)).length };
}
export function searchTemplates(root, q, limit = 40) {
    const { dir, items } = nucleiIndex(root);
    if (dir === null)
        return { dir: null, total: 0, items: [] };
    const raw = String(q || "").trim();
    if (raw === "")
        return { dir, total: items.length, items: [] };
    const needle = raw.toLowerCase();
    const out = [];
    for (const item of items) {
        if (`${item.path} ${item.name} ${item.tags}`.toLowerCase().includes(needle))
            out.push(item);
        if (out.length >= limit)
            break;
    }
    return { dir, total: items.length, items: out };
}
