import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dispatch, redteamRoot } from "../src/redteam/api.js";
import { DEFAULT_SCORE_POINTS } from "../src/redteam/store/score-data.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "redteam", "store-core.js");
const CODE = DEFAULT_SCORE_POINTS[0]?.code ?? "";

const dirs: string[] = [];
function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-api-"));
	dirs.push(dir);
	return redteamRoot(dir);
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("redteam api 分派", () => {
	it("bootstrap → openEngagement → ingest → assets → addScoreHit → scores", () => {
		const root = tempRoot();
		expect(dispatch(root, { op: "bootstrap" })).toMatchObject({ ok: true, engagements: [] });

		const opened = dispatch(root, { op: "openEngagement", name: "示例单位", scope: ["10.0.0.0/24"] });
		expect(opened).toMatchObject({ ok: true, engagement: { id: "示例单位", name: "示例单位" } });

		const ingested = dispatch(root, {
			op: "ingest",
			engagement: "示例单位",
			bundle: {
				assets: [{ ip: "10.0.0.5", ports: [{ port: 443, service: "https", product: "nginx" }] }],
			},
		});
		expect(ingested).toMatchObject({ ok: true, counts: { assets: 1, ports: 1, services: 1 } });

		const assets = dispatch(root, { op: "assets", engagement: "示例单位" });
		expect(assets).toMatchObject({ ok: true, total: 1 });
		expect((assets.items as { ip: string }[])[0]?.ip).toBe("10.0.0.5");

		const hit = dispatch(root, {
			op: "addScoreHit",
			engagement: "示例单位",
			hit: { code: CODE, evidence: "admin shell", target: "10.0.0.5:443", asset_id: 1 },
		});
		expect(hit).toMatchObject({ ok: true });

		const scores = dispatch(root, { op: "scores", engagement: "示例单位" });
		expect(scores).toMatchObject({ ok: true });
		const summary = scores.summary as { hitCount: number; countedHits: number };
		expect(summary.hitCount).toBe(1);
		expect(summary.countedHits).toBe(1);
	});

	it("vuln / credential / tunnel / chain 读写", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "r", scope: [] });

		const vuln = dispatch(root, { op: "addVuln", engagement: "r", vuln: { title: "SQLi", severity: "high", asset_id: 1 } });
		expect(vuln).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "vulns", engagement: "r" }).items as unknown[]).length).toBe(1);

		expect(dispatch(root, { op: "addCredential", engagement: "r", credential: { host: "10.0.0.5", username: "admin", secret_type: "password", secret_value: "x" } })).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "credentials", engagement: "r" }).items as unknown[]).length).toBe(1);

		expect(dispatch(root, { op: "addTunnel", engagement: "r", tunnel: { kind: "socks5", entry: "10.0.0.5:443" } })).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "tunnels", engagement: "r" }).items as unknown[]).length).toBe(1);

		expect(dispatch(root, { op: "addChainStep", engagement: "r", step: { title: "打点", stage: "boundary", vuln_id: 1 } })).toMatchObject({ ok: true });
		const chain = dispatch(root, { op: "chain", engagement: "r" }).items as { title: string; vuln_title: string }[];
		expect(chain[0]).toMatchObject({ title: "打点", vuln_title: "SQLi" });
	});

	it("未知 op / 缺少靶标返回明确错误", () => {
		const root = tempRoot();
		expect(dispatch(root, { op: "assets" })).toMatchObject({ ok: false, error: "engagement required" });
		dispatch(root, { op: "openEngagement", name: "x", scope: [] });
		expect(dispatch(root, { op: "nope", engagement: "x" })).toMatchObject({ ok: false, error: "未知操作: nope" });
	});
});

describe.skipIf(!existsSync(OLD_CORE))("api parity（对照旧 dispatch）", () => {
	it("bootstrap / openEngagement / scores.summary 一致", async () => {
		const old = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			RedteamStore: new (root: string) => unknown;
			dispatch(store: unknown, req: Record<string, unknown>): Record<string, unknown>;
		};
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "parity", scope: ["10.0.0.0/24"] });
		dispatch(root, { op: "addScoreHit", engagement: "parity", hit: { code: CODE, evidence: "x", target: "10.0.0.5:443", asset_id: 1 } });

		const oldStore = new old.RedteamStore(root) as { close?: () => void };
		const oldScores = old.dispatch(oldStore, { op: "scores", engagement: "parity" }) as { summary: Record<string, unknown> };
		const newScores = dispatch(root, { op: "scores", engagement: "parity" }) as { summary: Record<string, unknown> };
		expect(newScores.summary).toEqual(oldScores.summary);

		const oldBoot = old.dispatch(oldStore, { op: "bootstrap" }) as { current: string; engagements: { id: string }[] };
		const newBoot = dispatch(root, { op: "bootstrap" }) as { current: string; engagements: { id: string }[] };
		expect(newBoot.current).toBe(oldBoot.current);
		expect(newBoot.engagements.map((e) => e.id)).toEqual(oldBoot.engagements.map((e) => e.id));
		oldStore.close?.();
	});
});
