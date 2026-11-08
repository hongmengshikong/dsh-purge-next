import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dispatch, dispatchAsync } from "../src/redteam/api.js";

const dirs: string[] = [];
function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-probe-"));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("probeSessions", () => {
	it("webshell HTTP 实测 online；隧道连接拒绝 down", async () => {
		const server = createServer((_req, res) => {
			res.writeHead(200);
			res.end("ok");
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const port = (server.address() as { port: number }).port;

		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "probe", scope: [] });
		dispatch(root, { op: "addWebshell", engagement: "probe", webshell: { url: `http://127.0.0.1:${port}/s.jsp`, status: "unknown" } });
		dispatch(root, { op: "addTunnel", engagement: "probe", tunnel: { kind: "socks5", listen: `127.0.0.1:${port}` } });

		const result = (await dispatchAsync(root, { op: "probeSessions", engagement: "probe", timeoutMs: 2000 })) as {
			ok: boolean;
			webshells: { status: string; note: string }[];
			tunnels: { status: string }[];
		};
		expect(result.ok).toBe(true);
		expect(result.webshells[0]?.status).toBe("online");
		expect(result.webshells[0]?.note).toContain("HTTP 200");
		expect(result.tunnels[0]?.status).toBe("active");

		const shells = dispatch(root, { op: "webshells", engagement: "probe" }).items as { status: string }[];
		expect(shells[0]?.status).toBe("online");

		server.close();
	});

	it("没有靶标时返回空结果", async () => {
		const root = tempRoot();
		expect(await dispatchAsync(root, { op: "probeSessions" })).toMatchObject({ ok: true, webshells: [], tunnels: [] });
	});
});
