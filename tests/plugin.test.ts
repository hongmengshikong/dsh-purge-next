import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { apply as pluginApply, name as pluginName } from "../src/index.js";
import type { PluginCtx } from "../src/host/types.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FIXTURE = join(ROOT, "tests", "fixtures", "host-0.2.2-rc.1");
const HAS_FIXTURE = existsSync(join(FIXTURE, "node_modules"));

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

interface Route {
	kind: string;
	path: string;
	handler: (req: unknown, res: unknown) => unknown;
}

function fakeCtx(routes: Route[]): PluginCtx {
	return {
		logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
		on: () => () => undefined,
		effect: () => () => undefined,
		get: ((service: string) =>
			service === "webServer"
				? {
						register: (route: Route) => {
							routes.push(route);
							return () => undefined;
						},
					}
				: undefined) as PluginCtx["get"],
		provide: () => undefined,
	};
}

function capture(): { res: unknown; body: () => unknown } {
	let text = "";
	return {
		res: {
			writeHead: () => undefined,
			end: (chunk?: string) => {
				text = chunk ?? "";
			},
		},
		body: () => JSON.parse(text || "{}") as unknown,
	};
}

describe.skipIf(!HAS_FIXTURE)("plugin 入口", () => {
	it("启动时 seed 提示词并注册三条路由", () => {
		const dir = mkdtempSync(join(tmpdir(), "dsh-purge-plugin-"));
		dirs.push(dir);
		cpSync(join(FIXTURE, "node_modules"), join(dir, "node_modules"), { recursive: true });
		const aiBase = join(dir, "node_modules", "@deepseek-ai");
		const home = join(dir, "home");

		process.env.DSH_HOME = home;
		process.env.DSH_PURGE_AI_BASE = aiBase;
		try {
			const routes: Route[] = [];
			pluginApply(fakeCtx(routes));
			expect(pluginName).toBe("dsh-purge-next");
			expect(routes.map((route) => route.path)).toEqual([
				"/redteam/api",
				"/dsh-purge-next/status",
				"/dsh-purge-next/apply",
				"/dsh-purge-next/revert",
			]);
			expect(existsSync(join(home, "prompt-inject.md"))).toBe(true);
			expect(readFileSync(join(home, "prompt-inject.md"), "utf8").length).toBeGreaterThan(1000);

			const byPath = (path: string) => routes.find((route) => route.path === path);
			const status = capture();
			byPath("/dsh-purge-next/status")?.handler({}, status.res);
			expect(status.body()).toMatchObject({ ok: true, required: 36, required_bad: [], drifted: [] });

			const applied = capture();
			byPath("/dsh-purge-next/apply")?.handler({}, applied.res);
			expect(applied.body()).toMatchObject({ ok: true, required_bad: 0 });

			const reverted = capture();
			byPath("/dsh-purge-next/revert")?.handler({}, reverted.res);
			expect(reverted.body()).toMatchObject({ ok: true });
		} finally {
			delete process.env.DSH_HOME;
			delete process.env.DSH_PURGE_AI_BASE;
		}
	});
});
