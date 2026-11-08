/** #42 遗留产物的修复原语（与旧 core.js 一致）。 */
export const STALE_LEGACY_APPLY_CALL = "=> legacyApplyPath(section, op)";
export const SETTINGS_APPLY_CALL = "=> applyPathOp(section, op)";
const asLf = (text) => text.replace(/\r\n/g, "\n");
function endOfBalancedBlock(text, openAt) {
    let depth = 0;
    for (let i = openAt; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === "{")
            depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0)
                return i + 1;
        }
    }
    return text.length;
}
/** 1.1.17 之前 #42 会叠多份 legacyApplyPath，settings 整文件语法错误。 */
export function collapseDuplicateLegacyApplyPath(text) {
    const crlf = text.includes("\r\n");
    const src = asLf(text);
    const key = "function legacyApplyPath(section, op) {";
    const starts = [];
    let from = 0;
    while (from < src.length) {
        const at = src.indexOf(key, from);
        if (at < 0)
            break;
        starts.push(at);
        from = at + key.length;
    }
    if (starts.length < 2)
        return text;
    const firstStart = starts[0];
    const firstOpen = src.indexOf("{", firstStart);
    const firstEnd = endOfBalancedBlock(src, firstOpen);
    let out = src.slice(0, firstEnd);
    let cursor = firstEnd;
    for (let index = 1; index < starts.length; index += 1) {
        const start = starts[index];
        const open = src.indexOf("{", start);
        const end = endOfBalancedBlock(src, open);
        out += src.slice(cursor, start);
        cursor = end;
    }
    out += src.slice(cursor);
    out = out.replace(/\n{3,}/g, "\n\n");
    return crlf ? out.replace(/\n/g, "\r\n") : out;
}
/** #42 旧产物调用已删除的 legacyApplyPath。只换这一处调用，不动函数定义。 */
export function rewriteStaleLegacyApplyCall(text) {
    const hay = asLf(text);
    if (!hay.includes(STALE_LEGACY_APPLY_CALL))
        return text;
    const next = hay.split(STALE_LEGACY_APPLY_CALL).join(SETTINGS_APPLY_CALL);
    return text.includes("\r\n") ? next.replace(/\n/g, "\r\n") : next;
}
export function legacyApplyPathStarts(text) {
    const hay = asLf(text);
    const key = "function legacyApplyPath(section, op) {";
    let count = 0;
    let from = 0;
    while (from < hay.length) {
        const at = hay.indexOf(key, from);
        if (at < 0)
            break;
        count += 1;
        from = at + key.length;
    }
    return count;
}
