/** 会话级靶标绑定（旧 tools.js bindings 的最小移植）。 */
import { existsSync } from "node:fs";
import { dbPathOf, pathsOf } from "./store/engagement.js";
const bindings = new Map();
/** 同一个会话的所有执行上下文归一到同一个 key；拿不到就落到 local。 */
export function bindKeyOf(exec) {
    const raw = exec?.sessionId ?? exec?.session?.id ?? exec?.agent?.sessionId;
    return typeof raw === "string" && raw.trim() ? raw.trim() : "local";
}
export function bindEngagement(exec, id) {
    bindings.set(bindKeyOf(exec), id);
}
export function boundEngagement(exec) {
    return bindings.get(bindKeyOf(exec));
}
export function bindingViewOf(exec) {
    const key = bindKeyOf(exec);
    return {
        session: key,
        engagement: bindings.get(key) ?? null,
        is_subagent: Boolean(exec?.agent && exec.agent.parentSessionId),
    };
}
/** 显式参数 > 会话绑定 > 当前指针；都没有则 undefined。 */
export function resolveEngagement(root, exec, explicit) {
    if (typeof explicit === "string" && explicit.trim())
        return explicit.trim();
    const bound = boundEngagement(exec);
    if (bound && existsSync(dbPathOf(pathsOf(root), bound)))
        return bound;
    return undefined;
}
