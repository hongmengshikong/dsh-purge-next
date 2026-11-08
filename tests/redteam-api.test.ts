import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
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

	it("shots / access / webshell", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "ev", scope: [] });

		const added = dispatch(root, { op: "shotAdd", engagement: "ev", shot: { label: "证据", data: Buffer.from("hello").toString("base64") } });
		expect(added).toMatchObject({ ok: true });
		const file = join(root, "engagements", "ev", "shots", String((added as { file: string }).file));
		expect(existsSync(file)).toBe(true);

		const list = dispatch(root, { op: "shots", engagement: "ev" }).items as { id: number }[];
		expect(list).toHaveLength(1);
		const data = dispatch(root, { op: "shotData", engagement: "ev", id: list[0]?.id });
		expect(Buffer.from(String((data as { data: string }).data), "base64").toString()).toBe("hello");

		expect(dispatch(root, { op: "shotDelete", engagement: "ev", id: list[0]?.id })).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "shots", engagement: "ev" }).items as unknown[]).length).toBe(0);
		expect(existsSync(file)).toBe(false);

		expect(dispatch(root, { op: "addAccess", engagement: "ev", access: { host: "10.0.0.5", username: "admin", method: "ssh" } })).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "access", engagement: "ev" }).items as unknown[]).length).toBe(1);

		dispatch(root, { op: "addWebshell", engagement: "ev", webshell: { url: "http://10.0.0.5/s.jsp", pass_key: "x" } });
		dispatch(root, { op: "addWebshell", engagement: "ev", webshell: { url: "http://10.0.0.5/s.jsp", pass_key: "x", status: "online" } });
		const shells = dispatch(root, { op: "webshells", engagement: "ev" }).items as { id: number }[];
		expect(shells).toHaveLength(1);
		expect(dispatch(root, { op: "updateWebshell", engagement: "ev", id: shells[0]?.id, patch: { status: "offline", note: "挂了" } })).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "webshells", engagement: "ev" }).items as { status: string }[])[0]?.status).toBe("offline");
	});

	it("discoveryTimeline / domains / web / assess / assetTest", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "tl", scope: [] });
		dispatch(root, { op: "ingest", engagement: "tl", bundle: { assets: [{ ip: "10.0.0.5", names: [{ name: "portal.local" }], ports: [{ port: 443, url: "https://10.0.0.5/", title: "Portal" }] }] } });

		const timeline = dispatch(root, { op: "discoveryTimeline", engagement: "tl" }) as { recent: unknown[]; days: unknown[] };
		expect(timeline.recent).toHaveLength(1);
		expect(timeline.days.length).toBeGreaterThan(0);

		const domains = dispatch(root, { op: "domains", engagement: "tl" }).items as { name: string }[];
		expect(domains.map((item) => item.name)).toContain("portal.local");

		const web = dispatch(root, { op: "web", engagement: "tl" }).items as { url: string }[];
		expect(web[0]?.url).toBe("https://10.0.0.5/");

		dispatch(root, { op: "assessAsset", engagement: "tl", assess: { id: 1, priority: "high", potential: "high", assess_reason: "OA" } });
		const stats = dispatch(root, { op: "asset", engagement: "tl", id: 1 }).asset as { priority: string };
		expect(stats.priority).toBe("high");

		dispatch(root, { op: "assetTest", engagement: "tl", test: { id: 1, status: "testing", notes: "in progress" } });
		expect((dispatch(root, { op: "testStats", engagement: "tl" }).stats as Record<string, number>).testing).toBe(1);
	});

	it("graph / httpEvidence / attackFiles", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "g", scope: [] });
		dispatch(root, { op: "ingest", engagement: "g", bundle: { assets: [{ ip: "10.0.0.5", primary_name: "portal", ports: [{ port: 443 }] }] } });

		const graph = dispatch(root, { op: "graph", engagement: "g" }) as { nodes: { kind: string }[]; edges: { relation: string }[] };
		const kinds = graph.nodes.map((node) => node.kind);
		expect(kinds).toEqual(expect.arrayContaining(["segment", "asset", "port", "domain"]));
		expect(graph.edges.map((edge) => edge.relation)).toEqual(expect.arrayContaining(["contains", "exposes", "resolves"]));

		expect(dispatch(root, { op: "addHttpEvidence", engagement: "g", evidence: { url: "http://10.0.0.5/", method: "GET", status: 200, request: "GET /", response: "HTTP/1.1 200" } })).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "httpEvidence", engagement: "g" }).items as unknown[]).length).toBe(1);

		const added = dispatch(root, { op: "addAttackFile", engagement: "g", file: { target: "10.0.0.5", name: "poc.py", content: "print(1)", kind: "poc" } });
		expect(added).toMatchObject({ ok: true });
		const read = dispatch(root, { op: "readAttackFile", engagement: "g", id: (added as { id: number }).id });
		expect(read).toMatchObject({ ok: true, content: "print(1)" });
		expect((dispatch(root, { op: "attackFiles", engagement: "g" }).items as unknown[]).length).toBe(1);
	});

	it("prompts / savePrompt / resetPrompts", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "pr", scope: [] });
		const roles = dispatch(root, { op: "prompts", engagement: "pr" }).roles as { role: string; planner: boolean; content: string }[];
		expect(roles).toHaveLength(6);
		expect(roles.find((item) => item.role === "plan")?.planner).toBe(true);
		expect((roles.find((item) => item.role === "recon")?.content ?? "").length).toBeGreaterThan(100);

		expect(dispatch(root, { op: "savePrompt", engagement: "pr", role: "recon", content: "CUSTOM" })).toMatchObject({ ok: true });
		const after = dispatch(root, { op: "prompts", engagement: "pr" }).roles as { role: string; content: string }[];
		expect(after.find((item) => item.role === "recon")?.content).toBe("CUSTOM");

		expect(dispatch(root, { op: "resetPrompts", engagement: "pr", role: "recon" })).toMatchObject({ ok: true });
		const reset = dispatch(root, { op: "prompts", engagement: "pr" }).roles as { role: string; content: string }[];
		expect((reset.find((item) => item.role === "recon")?.content ?? "").length).toBeGreaterThan(100);
	});

	it("stages / saveStage", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "s", scope: [] });
		const stages = dispatch(root, { op: "stages", engagement: "s" }).items as { code: string; name: string }[];
		expect(stages).toHaveLength(5);
		const saved = dispatch(root, { op: "saveStage", engagement: "s", stage: { code: "recon", name: "侦察（改）" } });
		expect(saved).toMatchObject({ ok: true });
		const after = dispatch(root, { op: "stages", engagement: "s" }).items as { code: string; name: string }[];
		expect(after.find((item) => item.code === "recon")?.name).toBe("侦察（改）");
	});

	it("未知 op / 缺少靶标返回明确错误", () => {
		const root = tempRoot();
		expect(dispatch(root, { op: "assets" })).toMatchObject({ ok: false, error: "engagement required" });
		dispatch(root, { op: "openEngagement", name: "x", scope: [] });
		expect(dispatch(root, { op: "nope", engagement: "x" })).toMatchObject({ ok: false, error: "未知操作: nope" });
	});
});

describe.skipIf(!existsSync(OLD_CORE))("api parity（对照旧 dispatch）", () => {
	it("testStats / vulnStats / activeTests 与旧实现一致", async () => {
		const old = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			RedteamStore: new (root: string) => {
				testStats(id: string): Record<string, number>;
				vulnStats(id: string): Record<string, unknown>;
				activeTests(id: string, f?: Record<string, unknown>): { queue: { ip: string }[]; untested: number };
				close?: () => void;
			};
		};
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "stats", scope: [] });
		dispatch(root, { op: "ingest", engagement: "stats", bundle: { assets: [{ ip: "10.0.0.5", state: "live" }, { ip: "10.0.0.6" }] } });
		const first = dispatch(root, { op: "addVuln", engagement: "stats", vuln: { title: "SQLi", severity: "high", asset_id: 1 } });
		const second = dispatch(root, { op: "addVuln", engagement: "stats", vuln: { title: "SQLi", severity: "high", asset_id: 1 } });
		expect((first as { updated?: boolean }).updated).toBeUndefined();
		expect(second).toMatchObject({ ok: true, updated: true });

		const oldStore = new old.RedteamStore(root);
		expect(dispatch(root, { op: "testStats", engagement: "stats" }).stats).toEqual(oldStore.testStats("stats"));
		expect(dispatch(root, { op: "vulnStats", engagement: "stats" }).stats).toEqual(oldStore.vulnStats("stats"));
		const mine = dispatch(root, { op: "activeTests", engagement: "stats" }) as { queue: { ip: string }[]; untested: number };
		const theirs = oldStore.activeTests("stats");
		expect(mine.untested).toBe(theirs.untested);
		expect(mine.queue.map((row) => row.ip)).toEqual(theirs.queue.map((row) => row.ip));
		oldStore.close?.();
	});

	it("scoreReport summary 与 report 骨架", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "rep", scope: ["10.0.0.0/24"] });
		dispatch(root, { op: "ingest", engagement: "rep", bundle: { assets: [{ ip: "10.0.0.5", ports: [{ port: 443 }] }] } });
		dispatch(root, { op: "addScoreHit", engagement: "rep", hit: { code: CODE, evidence: "admin", target: "10.0.0.5:443", asset_id: 1 } });
		dispatch(root, { op: "addTunnel", engagement: "rep", tunnel: { kind: "socks5", entry_kind: "target-http", entry: "10.0.0.5:443" } });

		const report = dispatch(root, { op: "scoreReport", engagement: "rep" }) as { summary: Record<string, number> };
		const scores = dispatch(root, { op: "scores", engagement: "rep" }) as { summary: Record<string, number> };
		expect(report.summary.points).toBe(scores.summary.achievedPoints);
		expect(report.summary.hits).toBe(scores.summary.hitCount);
		expect(report.summary.countedHits).toBe(scores.summary.countedHits);
		expect(report.summary.tunnelsLegit).toBe(1);

		const md = dispatch(root, { op: "report", engagement: "rep" });
		expect(String(md.markdown)).toContain("演练成果报告");
		expect(String(md.markdown)).toContain("10.0.0.5");
	});

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
