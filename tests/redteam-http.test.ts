import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installRedteamApi, readJsonBody } from "../src/redteam/http.js";
import { dispatch, redteamRoot } from "../src/redteam/api.js";

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

interface Route {
	path: string;
	handler: (req: unknown, res: unknown) => unknown;
}

function capture(): { res: unknown; body: () => unknown; code: () => number } {
	let text = "";
	let status = 0;
	return {
		res: {
			writeHead: (code: number) => {
				status = code;
			},
			end: (chunk?: string) => {
				text = chunk ?? "";
			},
		},
		body: () => JSON.parse(text || "{}") as unknown,
		code: () => status,
	};
}

describe("redteam http 桥", () => {
	it("POST /redteam/api → dispatch", async () => {
		const home = mkdtempSync(join(tmpdir(), "dsh-purge-http-"));
		dirs.push(home);
		const routes: Route[] = [];
		installRedteamApi({ register: (route) => routes.push(route as Route) }, home);
		expect(routes.map((route) => route.path)).toEqual(["/redteam/api"]);

		const opened = dispatch(redteamRoot(home), { op: "openEngagement", name: "web", scope: [] });
		expect(opened.ok).toBe(true);

		const ok = capture();
		await routes[0]?.handler({ method: "POST", body: { op: "bootstrap" } }, ok.res);
		expect(ok.code()).toBe(200);
		expect(ok.body()).toMatchObject({ ok: true, current: "web" });

		const bad = capture();
		await routes[0]?.handler({ method: "GET" }, bad.res);
		expect(bad.code()).toBe(405);
	});

	it("readJsonBody 支持 string / 异步迭代器", async () => {
		expect(await readJsonBody({ body: '{"a":1}' })).toEqual({ a: 1 });
		async function* chunks(): AsyncGenerator<string> {
			yield '{"op":';
			yield '"bootstrap"}';
		}
		expect(await readJsonBody(chunks())).toEqual({ op: "bootstrap" });
	});
});
