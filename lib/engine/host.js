/**
 * 宿主侧入口：按 1:1 钉死的版本解析目标文件，串起 status / apply / revert。
 *
 * 路径映射来自 host-paths.ts（由旧 targetFiles 在快照上生成），
 * 因此不需要先移植整张 targetFiles 表；换宿主版本时重跑生成脚本。
 */
import { dirname, join } from "node:path";
import { HOST_PATHS } from "./host-paths.js";
import { applyPatchesToRoot } from "./apply.js";
import { revertRoot } from "./revert.js";
import { computeStatus, appliesOnWeb } from "./status.js";
export const SUPPORTED_HOSTS = Object.keys(HOST_PATHS);
export function hostPaths(version) {
    const map = HOST_PATHS[version];
    if (!map)
        throw new Error(`不支持的宿主版本：${version}（已支持：${SUPPORTED_HOSTS.join(", ")}）`);
    return map;
}
/** 目标文件的绝对路径（key → paths）。 */
export function absoluteHostPaths(aiBase, version) {
    const out = {};
    for (const [key, list] of Object.entries(hostPaths(version)))
        out[key] = list.map((rel) => join(aiBase, rel));
    return out;
}
/** 只读状态；必需补丁口径与门禁一致（optional !== true 且 surfaces 含 web）。 */
export function hostStatus(aiBase, version, tables) {
    const map = hostPaths(version);
    const computed = computeStatus(tables, map, dirname(aiBase));
    const keys = new Set(Object.keys(map));
    const required = tables.all
        .filter((patch) => {
        if (patch.optional === true)
            return false;
        if (!appliesOnWeb(patch))
            return false;
        const patchKeys = Array.isArray(patch.file) ? patch.file : [patch.file];
        return patchKeys.some((key) => keys.has(key)) && computed.status[patch.id] !== "na";
    })
        .map((patch) => ({ id: patch.id, name: patch.name, status: computed.status[patch.id] }));
    return {
        status: computed.status,
        counts: computed.counts,
        required,
        requiredBad: required.filter((row) => row.status !== "applied" && row.status !== "pending"),
        drifted: tables.all
            .filter((patch) => computed.status[patch.id] === "drifted")
            .map((patch) => ({ id: patch.id, name: patch.name })),
    };
}
export function hostApply(aiBase, version, tables) {
    const result = applyPatchesToRoot(dirname(aiBase), tables, hostPaths(version), { write: true });
    const applied = result.report.reduce((sum, row) => sum + row.applied, 0);
    return {
        report: result.report,
        changedFiles: result.changedFiles,
        applied,
        drifted: result.report.filter((row) => row.status === "drifted").length,
    };
}
export function hostRevert(aiBase) {
    // 目标文件可能在同级 @earendil-works/...（#47/#49/#57），所以还原范围是 node_modules。
    return revertRoot(dirname(aiBase));
}
