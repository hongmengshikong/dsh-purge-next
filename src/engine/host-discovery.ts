/** 宿主发现（聚焦 Web/CLI 场景的最小实现）。 */
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const isDir = (fp: string): boolean => {
	try {
		return statSync(fp).isDirectory();
	} catch {
		return false;
	}
};

const isAiBase = (dir: string): boolean => isDir(join(dir, "dsh")) || isDir(join(dir, "dsh-web-app"));

function walkUp(start: string, maxDepth = 8): string | null {
	let dir = resolve(start);
	for (let depth = 0; depth <= maxDepth; depth += 1) {
		if (dir.endsWith("@deepseek-ai") && isAiBase(dir)) return normalize(dir);
		const nested = join(dir, "node_modules", "@deepseek-ai");
		if (isAiBase(nested)) return normalize(nested);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

export interface FindAiBaseOptions {
	env?: NodeJS.ProcessEnv;
	starts?: string[];
}

/** 依次尝试：显式环境变量 → 运行中进程 → cwd → 插件自身位置。 */
export function findAiBase(options: FindAiBaseOptions = {}): string | null {
	const env = options.env ?? process.env;
	const override = env.DSH_PURGE_AI_BASE;
	if (override && String(override).trim() && isAiBase(String(override).trim())) return normalize(String(override).trim());

	const starts = options.starts ?? [
		dirname(resolve(process.argv[1] ?? ".")),
		process.cwd(),
		dirname(fileURLToPath(import.meta.url)),
	];
	for (const start of starts) {
		const hit = walkUp(start);
		if (hit) return hit;
	}
	return null;
}

export function findDshHome(env: NodeJS.ProcessEnv = process.env): string {
	const fromEnv = env.DSH_HOME;
	if (fromEnv && String(fromEnv).trim()) return normalize(String(fromEnv).trim());
	return join(homedir(), ".dsh");
}

export function aiBaseExists(aiBase: string | null): aiBase is string {
	return Boolean(aiBase && existsSync(aiBase));
}
