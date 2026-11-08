/**
 * 靶标工作区（engagement）：目录、engagement.yaml、当前指针。
 *
 * 对齐旧仓库 `lib/redteam/store-core.js` 的：
 *   slugify / openEngagement / listEngagements / activeEngagementId / setActiveEngagement
 *
 * 尚未移植（TODO M2）：openEngagement 里的 seedScorePoints 与 prompts 初始化，
 * 需要先搬完整 schema（asset/port/score_point/...）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readMeta, writeMeta } from "./meta.js";
import { ASSET_FTS_DDL, DDL, HAS_FTS5, migrate } from "./schema.js";
import { seedScorePoints } from "./scoring.js";
export function nowIso() {
    return new Date().toISOString();
}
/** 与旧 ip-utils.slugify 一致：中文保留，其余转 `-`。 */
export function slugify(name) {
    const text = String(name ?? "").trim().toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
    return text === "" ? `engagement-${Date.now()}` : text;
}
export function pathsOf(root) {
    return {
        root,
        engagementsDir: join(root, "engagements"),
        currentPath: join(root, "current"),
    };
}
/** 挡住 `../` 越界：id 来自请求体。 */
export function assertWithin(target, roots) {
    const resolved = resolve(target);
    for (const root of roots) {
        const base = resolve(root);
        if (resolved === base || resolved.startsWith(base + sep))
            return resolved;
    }
    throw new Error(`path escapes root: ${target}`);
}
export function dirOf(paths, id) {
    return assertWithin(join(paths.engagementsDir, id), [paths.engagementsDir]);
}
export const metaPathOf = (paths, id) => join(dirOf(paths, id), "engagement.yaml");
export const dbPathOf = (paths, id) => join(dirOf(paths, id), "assets.db");
export const promptsDirOf = (paths, id) => join(dirOf(paths, id), "agents");
/**
 * 打开/创建靶标工作区。
 * 语义对齐旧实现：目录 + engagement.yaml + 空库；默认把「当前靶标」指过来。
 */
export function openEngagement(root, name, scope = [], options = {}) {
    const paths = pathsOf(root);
    const id = slugify(name);
    const dir = dirOf(paths, id);
    mkdirSync(dir, { recursive: true });
    for (const sub of ["agents", "runs", "reports"])
        mkdirSync(join(dir, sub), { recursive: true });
    const metaPath = metaPathOf(paths, id);
    const existing = readMeta(metaPath);
    const now = options.now ?? nowIso;
    const meta = {
        target_name: name,
        scope_cidrs: scope.length > 0 ? scope : (existing?.scope_cidrs ?? []),
        status: "active",
        created_at: existing?.created_at ?? now(),
        updated_at: now(),
    };
    writeMeta(metaPath, meta);
    // 与旧实现一致：建全量 schema + 迁移（FTS5 缺席时跳过虚拟表）。
    const dbFile = dbPathOf(paths, id);
    const fresh = !existsSync(dbFile);
    const db = new DatabaseSync(dbFile);
    try {
        if (fresh) {
            db.exec(DDL);
            if (HAS_FTS5)
                db.exec(ASSET_FTS_DDL);
            migrate(db);
        }
        // 旧实现每次 open 都播种默认得分点（幂等）。
        seedScorePoints(db, now);
    }
    finally {
        db.close();
    }
    if (options.bindCurrent !== false)
        setActiveEngagement(root, id);
    return { id, name, scope: meta.scope_cidrs };
}
export function listEngagements(root, options = {}) {
    const paths = pathsOf(root);
    mkdirSync(paths.engagementsDir, { recursive: true });
    const out = [];
    for (const entry of readdirSync(paths.engagementsDir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const meta = (readMeta(metaPathOf(paths, entry.name)) ?? {});
        out.push({
            id: entry.name,
            name: typeof meta.target_name === "string" && meta.target_name ? meta.target_name : entry.name,
            scope: Array.isArray(meta.scope_cidrs) ? meta.scope_cidrs : [],
            status: typeof meta.status === "string" && meta.status ? meta.status : "active",
            created_at: typeof meta.created_at === "string" ? meta.created_at : null,
            stats: null,
        });
    }
    return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
export function activeEngagementId(root) {
    const paths = pathsOf(root);
    try {
        const raw = readFileSync(paths.currentPath, "utf8").trim();
        if (raw && existsSync(dbPathOf(paths, raw)))
            return raw;
    }
    catch {
        /* 无指针时回退到最近创建 */
    }
    const list = listEngagements(root);
    return list.length > 0 ? list[0]?.id : undefined;
}
export function setActiveEngagement(root, id) {
    const paths = pathsOf(root);
    if (!id || !existsSync(dbPathOf(paths, id)))
        return false;
    mkdirSync(paths.root, { recursive: true });
    writeFileSync(paths.currentPath, String(id), "utf8");
    return true;
}
