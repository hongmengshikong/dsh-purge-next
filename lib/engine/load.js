import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeDeep } from "./codec.js";
const GROUPS = ["prompt", "code", "engine", "tools"];
const NAME_RE = /^[A-Z][A-Z0-9_]*$/;
function readJson(file) {
    return JSON.parse(readFileSync(file, "utf8"));
}
function assertPatch(patch, where) {
    if (typeof patch.id !== "number" || !Number.isFinite(patch.id))
        throw new Error(`${where}: id 必须是数字`);
    if (typeof patch.name !== "string" || !NAME_RE.test(patch.name))
        throw new Error(`${where}: name 必须是大写字母/数字/下划线`);
    if (typeof patch.desc !== "string" || !patch.desc.trim())
        throw new Error(`${where}: desc 不能为空`);
    const file = patch.file;
    const fileOk = typeof file === "string" ? file.length > 0 : Array.isArray(file) && file.length > 0 && file.every((f) => typeof f === "string" && f.length > 0);
    if (!fileOk)
        throw new Error(`${where}: file 必须是非空字符串或字符串数组`);
}
/**
 * 读取 `patches/`：四个表 + display groups。
 *
 * 只做形状校验（id 唯一、必填字段、分组一致），语义校验留给门禁。
 * 顺序即应用顺序，不允许重排。
 */
export function loadPatchTables(dir) {
    const tables = {};
    const seen = new Map();
    for (const group of GROUPS) {
        const doc = readJson(join(dir, `${group}.json`));
        if (doc.group !== group)
            throw new Error(`patches/${group}.json: group 字段是 ${String(doc.group)}，应为 ${group}`);
        if (!Array.isArray(doc.patches) || doc.patches.length === 0)
            throw new Error(`patches/${group}.json: patches 必须是非空数组`);
        doc.patches.forEach((patch, index) => {
            assertPatch(patch, `patches/${group}.json[${index}]`);
            const prev = seen.get(patch.id);
            if (prev)
                throw new Error(`补丁 id 重复：${patch.id}（${prev} / ${patch.name}）`);
            seen.set(patch.id, patch.name);
        });
        tables[group] = decodeDeep(doc.patches);
    }
    const groupsDoc = readJson(join(dir, "display-groups.json"));
    const rawGroups = groupsDoc.groups;
    if (!rawGroups || typeof rawGroups !== "object" || Array.isArray(rawGroups))
        throw new Error("patches/display-groups.json: 缺少 groups 对象");
    const displayGroups = {};
    for (const [key, ids] of Object.entries(rawGroups)) {
        if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "number")) {
            throw new Error(`display-groups.${key} 必须是非空数字数组`);
        }
        for (const id of ids)
            if (!seen.has(id))
                throw new Error(`display-groups.${key} 引用了不存在的补丁 id ${id}`);
        displayGroups[key] = ids;
    }
    return {
        prompt: tables.prompt,
        code: tables.code,
        engine: tables.engine,
        tools: tables.tools,
        displayGroups,
        all: [...tables.prompt, ...tables.code, ...tables.engine, ...tables.tools],
    };
}
