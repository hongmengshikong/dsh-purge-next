import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { upsertAsset } from "../src/redteam/store/assets.js";
import { addScoreHit, scoreMultiplierOf, targetHasIpv6Host } from "../src/redteam/store/score-hit.js";
import { DEFAULT_SCORE_POINTS } from "../src/redteam/store/score-data.js";
import { ASSET_FTS_DDL, DDL, HAS_FTS5, migrate } from "../src/redteam/store/schema.js";
import { seedScorePoints } from "../src/redteam/store/scoring.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "redteam", "store-core.js");
const CODE = DEFAULT_SCORE_POINTS[0]?.code ?? "";

const roots: string[] = [];
function tempDb(seed = true): DatabaseSync {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-hit-"));
	roots.push(dir);
	const db = new DatabaseSync(join(dir, "assets.db"));
	db.exec(DDL);
	if (HAS_FTS5) db.exec(ASSET_FTS_DDL);
	migrate(db);
	if (seed) seedScorePoints(db);
	return db;
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

const FIXED = () => "2026-01-01T00:00:00.000Z";

describe("score hit 写入", () => {
	it("按 code 记分并写入 effective 字段", () => {
		const db = tempDb();
		upsertAsset(db, { ip: "10.0.0.5" });
		const hit = addScoreHit(
			db,
			{ code: CODE, evidence: "whoami -> admin", target: "10.0.0.5:443", asset_id: 1, port: 443 },
			FIXED,
		);
		expect(hit.point_code).toBe(CODE);
		expect(hit.port).toBe(443);
		expect(hit.multiplier).toBe(1);
		const row = db.prepare("SELECT * FROM score_hit WHERE id = ?").get(hit.id) as Record<string, unknown>;
		expect(row).toMatchObject({ point_id: hit.point_id, evidence: "whoami -> admin", self_created: 0, port: 443, multiplier: 1 });
		db.close();
	});

	it("self_created 记录但不计分标记；IPv6 target 触发 ×3", () => {
		const db = tempDb();
		const hit = addScoreHit(
			db,
			{ code: CODE, evidence: "self registered", target: "http://[2001:db8::1]:8080/", self_created: true },
			FIXED,
		);
		expect(hit.self_created).toBe(1);
		expect(hit.multiplier).toBe(3);
		expect(hit.port).toBe(8080);
		db.close();
	});

	it("points 覆盖走边界校验", () => {
		const db = tempDb();
		const ok = addScoreHit(db, { code: CODE, evidence: "tier", points: 50 }, FIXED);
		expect(ok.points).toBe(50);
		expect(() => addScoreHit(db, { code: CODE, evidence: "x", points: 0 }, FIXED)).toThrow(/必须大于 0/);
		expect(() => addScoreHit(db, { code: CODE, evidence: "x", points: 999999999 }, FIXED)).toThrow(/超过该得分点的合理上限/);
		db.close();
	});

	it("缺 evidence / 未知 code 报错", () => {
		const db = tempDb();
		expect(() => addScoreHit(db, { code: CODE }, FIXED)).toThrow(/evidence required/);
		expect(() => addScoreHit(db, { code: "no-such-code", evidence: "x" }, FIXED)).toThrow(/score point not found/);
		db.close();
	});

	it("targetHasIpv6Host / scoreMultiplierOf", () => {
		expect(targetHasIpv6Host("http://[2001:db8::1]:8080/x")).toBe(true);
		expect(targetHasIpv6Host("dc01:389")).toBe(false);
		expect(scoreMultiplierOf({ data_scale: "large" }).multiplier).toBe(2);
		expect(scoreMultiplierOf({ ip_version: 6, data_scale: "kb" }).multiplier).toBe(6);
	});
});

describe.skipIf(!existsSync(OLD_CORE))("score hit parity（对照旧 addScoreHit）", () => {
	it("score_hit 行字段一致", async () => {
		const oldModule = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			RedteamStore: new (root: string) => {
				openEngagement(name: string, scope: string[]): { id: string };
				addScoreHit(id: string, hit: unknown): unknown;
				db(id: string): DatabaseSync;
			};
		};
		const oldRoot = mkdtempSync(join(tmpdir(), "old-hit-"));
		roots.push(oldRoot);
		const oldStore = new oldModule.RedteamStore(oldRoot);
		const engagement = oldStore.openEngagement("hit", []);
		oldStore.addScoreHit(engagement.id, { code: CODE, evidence: "whoami -> admin", target: "10.0.0.5:443", asset_id: 1 });
		const oldDb = oldStore.db(engagement.id);

		const newDb = tempDb();
		upsertAsset(newDb, { ip: "10.0.0.5" });
		addScoreHit(newDb, { code: CODE, evidence: "whoami -> admin", target: "10.0.0.5:443", asset_id: 1 }, FIXED);

		const sql = "SELECT point_id, asset_id, vuln_id, step_id, target, evidence, note, self_created, port, points, multiplier FROM score_hit";
		expect(newDb.prepare(sql).all()).toEqual(oldDb.prepare(sql).all());
		newDb.close();
		oldDb.close();
	});
});
