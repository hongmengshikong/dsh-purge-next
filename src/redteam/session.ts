/** 会话级靶标绑定（旧 tools.js bindings 的最小移植）。 */
import { existsSync } from "node:fs";
import { dbPathOf, pathsOf } from "./store/engagement.js";

const bindings = new Map<string, string>();

export interface ExecLike {
	sessionId?: string;
	session?: { id?: string };
	agent?: { sessionId?: string };
	[k: string]: unknown;
}

/** 同一个会话的所有执行上下文归一到同一个 key；拿不到就落到 local。 */
export function bindKeyOf(exec?: ExecLike): string {
	const raw = exec?.sessionId ?? exec?.session?.id ?? exec?.agent?.sessionId;
	return typeof raw === "string" && raw.trim() ? raw.trim() : "local";
}

export function bindEngagement(exec: ExecLike | undefined, id: string): void {
	bindings.set(bindKeyOf(exec), id);
}

export function boundEngagement(exec?: ExecLike): string | undefined {
	return bindings.get(bindKeyOf(exec));
}

export interface BindingView {
	session: string;
	engagement: string | null;
	is_subagent: boolean;
}

export function bindingViewOf(exec?: ExecLike): BindingView {
	const key = bindKeyOf(exec);
	return {
		session: key,
		engagement: bindings.get(key) ?? null,
		is_subagent: Boolean(exec?.agent && (exec.agent as { parentSessionId?: string }).parentSessionId),
	};
}

/** 显式参数 > 会话绑定 > 当前指针；都没有则 undefined。 */
export function resolveEngagement(root: string, exec: ExecLike | undefined, explicit?: unknown): string | undefined {
	if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
	const bound = boundEngagement(exec);
	if (bound && existsSync(dbPathOf(pathsOf(root), bound))) return bound;
	return undefined;
}
