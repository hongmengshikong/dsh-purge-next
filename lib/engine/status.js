import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legacyApplyPathStarts, STALE_LEGACY_APPLY_CALL } from "./legacy.js";
/** 与旧仓库 core.js 对齐的判定原语（status 只读，不改文件）。 */
const asLf = (text) => text.replace(/\r\n/g, "\n");
const isYamlPath = (fp) => /\.ya?ml$/i.test(fp);
function matchesPattern(hay, pattern) {
    if (pattern instanceof RegExp) {
        // 不复用带 g 的实例：test() 会留下 lastIndex。
        return new RegExp(pattern.source, pattern.flags.replace("g", "")).test(hay);
    }
    return hay.includes(asLf(pattern));
}
function replacementsOf(patch) {
    if (Array.isArray(patch.replacements) && patch.replacements.length > 0)
        return patch.replacements;
    return (patch.patterns ?? []).map((pattern) => ({ pattern, replace: patch.replace }));
}
function isBareIdentityNeedle(pattern) {
    if (typeof pattern !== "string")
        return false;
    const needle = asLf(pattern);
    if (!needle)
        return false;
    if (/^[ \t]/.test(needle))
        return false;
    return /^You are a coding agent powered by\b/.test(needle);
}
const LAYOUT_SOFT_IDS = new Set([4, 25, 26, 5, 11, 12]);
const isLayoutSoft = (p) => LAYOUT_SOFT_IDS.has(p.id) || p.softSettle === true;
function patchApplied(text, patch) {
    const hay = asLf(text);
    if (patch.id === 42 && legacyApplyPathStarts(hay) > 1)
        return false;
    if (patch.id === 42 && hay.includes(STALE_LEGACY_APPLY_CALL))
        return false;
    if (Array.isArray(patch.forbid) && patch.forbid.some((marker) => hay.includes(asLf(marker))))
        return false;
    if (Array.isArray(patch.markers) && patch.markers.length > 0) {
        const hit = (marker) => hay.includes(asLf(marker));
        return patch.markersAny ? patch.markers.some(hit) : patch.markers.every(hit);
    }
    if (typeof patch.marker === "string" && patch.marker)
        return hay.includes(asLf(patch.marker));
    if (typeof patch.replace === "string" && patch.replace.length > 0) {
        const firstLine = asLf(patch.replace).split("\n")[0] ?? "";
        return hay.includes(firstLine.slice(0, 60));
    }
    return false;
}
function hasRemainingWork(text, patch, fp) {
    const hay = asLf(text);
    const yaml = isYamlPath(fp);
    for (const { pattern, replace } of replacementsOf(patch)) {
        if (pattern === undefined || typeof replace !== "string")
            continue;
        if (yaml && isBareIdentityNeedle(pattern))
            continue;
        if (matchesPattern(hay, pattern))
            return true;
    }
    return false;
}
function isSelfMarked(patch) {
    const reps = replacementsOf(patch);
    if (reps.length === 0)
        return false;
    return reps.every(({ pattern }) => {
        if (pattern === undefined)
            return false;
        const needle = asLf(String(pattern));
        return needle.includes("[dsh-purge]") || needle.includes("# dsh-purge");
    });
}
export function filePatchOutcome(text, patch, fp = "") {
    if (patchApplied(text, patch))
        return "applied";
    if (isLayoutSoft(patch) && !hasRemainingWork(text, patch, fp))
        return "applied";
    if (hasRemainingWork(text, patch, fp))
        return "pending";
    if (isSelfMarked(patch))
        return "skipped";
    return "drifted";
}
/** 与 patchAppliesHere(p, "web") 对齐：无 surfaces 或包含 web 才参与。 */
export function appliesOnWeb(patch) {
    const want = patch.surfaces;
    if (!Array.isArray(want) || want.length === 0)
        return true;
    return want.includes("web");
}
/**
 * 对一个宿主目录计算全量状态。
 * @param paths 文件键 → 相对 fixture 根的路径（由旧仓库 targetFiles 生成，见 fixture README）
 */
export function computeStatus(tables, paths, root) {
    const status = {};
    for (const patch of tables.all) {
        if (!appliesOnWeb(patch)) {
            status[patch.id] = "na";
            continue;
        }
        const keys = Array.isArray(patch.file) ? patch.file : [patch.file];
        let applied = 0;
        let pending = 0;
        let skipped = 0;
        let unmatched = 0;
        let missing = 0;
        let drifted = 0;
        for (const key of keys) {
            const fps = (paths[key] ?? []).filter((rel) => rel.length > 0);
            if (fps.length === 0) {
                missing += 1;
                continue;
            }
            for (const rel of fps) {
                let text;
                try {
                    text = readFileSync(join(root, rel), "utf8");
                }
                catch {
                    pending += 1;
                    continue;
                }
                const outcome = filePatchOutcome(text, patch, rel);
                if (outcome === "applied")
                    applied += 1;
                else if (outcome === "pending")
                    pending += 1;
                else if (outcome === "drifted")
                    drifted += 1;
                else if (patch.strictFiles)
                    unmatched += 1;
                else
                    skipped += 1;
            }
        }
        if (pending > 0)
            status[patch.id] = "pending";
        else if (drifted > 0)
            status[patch.id] = "drifted";
        else if (applied > 0)
            status[patch.id] = "applied";
        else if (unmatched > 0)
            status[patch.id] = "unmatched";
        else if (skipped > 0)
            status[patch.id] = "skipped";
        else
            status[patch.id] = patch.optional ? "na" : "missing_file";
    }
    const counts = {};
    for (const value of Object.values(status))
        counts[value] = (counts[value] ?? 0) + 1;
    return { status, counts };
}
