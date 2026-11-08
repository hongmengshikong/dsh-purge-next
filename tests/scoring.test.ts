import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { openEngagement, dbPathOf, pathsOf } from "../src/redteam/store/engagement.js";
import { ASSET_FTS_DDL, DDL, HAS_FTS5, migrate } from "../src/redteam/store/schema.js";
import { listStages, seedScorePoints, seedStages } from "../src/redteam/store/scoring.js";
import { DEFAULT_SCORE_POINTS, DEFAULT_STAGES } from "../src/redteam/store/score-data.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "redteam", "store-core.js");

const roots: string[] = [];
function tempDb(): DatabaseSync {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-score-"));
	roots.push(dir);
	const db = new DatabaseSync(join(dir, "assets.db"));
	db.exec(DDL);
	if (HAS_FTS5) db.exec(ASSET_FTS_DDL);
	migrate(db);
	return db;
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

const FIXED = () => "2026-01-01T00:00:00.000Z";

describe("seedStages / seedScorePoints", () => {
	it("阶段播种 5 条且幂等", () => {
		const db = tempDb();
		expect(seedStages(db, FIXED)).toEqual({ seeded: 5 });
		expect(seedStages(db, FIXED)).toEqual({ seeded: 0 });
		const stages = listStages(db, FIXED);
		expect(stages.map((stage) => stage.code)).toEqual(DEFAULT_STAGES.map((stage) => stage.code));
		expect(stages.map((stage) => stage.ordinal)).toEqual([1, 2, 3, 4, 5]);
		db.close();
	});

	it("得分点播种 25 条，内置元数据写入且幂等", () => {
		const db = tempDb();
		expect(seedScorePoints(db, FIXED)).toEqual({ seeded: 25, synced: 0 });
		expect(seedScorePoints(db, FIXED)).toEqual({ seeded: 0, synced: 25 });

		const rows = db
			.prepare("SELECT code, rule, cap, dedup_scope, legacy, builtin, sort_order FROM score_point ORDER BY sort_order")
			.all() as Record<string, unknown>[];
		expect(rows).toHaveLength(DEFAULT_SCORE_POINTS.length);
		expect(rows.every((row) => Number(row.builtin) === 1 && Number(row.legacy) === 0)).toBe(true);
		expect(rows.map((row) => Number(row.sort_order))).toEqual(rows.map((_, index) => index));
		db.close();
	});

	it("openEngagement 自动播种得分点", () => {
		const root = mkdtempSync(join(tmpdir(), "dsh-purge-score-eng-"));
		roots.push(root);
		const opened = openEngagement(root, "seed", [], { now: FIXED });
		const paths = pathsOf(root);
		const db = new DatabaseSync(dbPathOf(paths, opened.id));
		const count = db.prepare("SELECT COUNT(*) AS n FROM score_point").get() as { n: number };
		expect(count.n).toBe(25);
		db.close();
	});
});

describe.skipIf(!existsSync(OLD_CORE))("评分配置 parity（对照旧实现）", () => {
	it("stage / score_point 两张表 dump 完全一致", async () => {
		const oldModule = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			RedteamStore: new (root: string) => {
				openEngagement(name: string, scope: string[]): { id: string };
				listStages(id: string): unknown;
				db(id: string): DatabaseSync;
			};
		};
		const oldRoot = mkdtempSync(join(tmpdir(), "old-score-"));
		roots.push(oldRoot);
		const oldStore = new oldModule.RedteamStore(oldRoot);
		const engagement = oldStore.openEngagement("parity", []);
		oldStore.listStages(engagement.id);
		const oldDb = oldStore.db(engagement.id);

		const newRoot = mkdtempSync(join(tmpdir(), "new-score-"));
		roots.push(newRoot);
		const opened = openEngagement(newRoot, "parity", [], { now: FIXED });
		const newDb = new DatabaseSync(dbPathOf(pathsOf(newRoot), opened.id));
		listStages(newDb, FIXED);

		const stageSql = "SELECT code, name, subtitle, color, goal, sections, tools, transition, sort_order FROM stage ORDER BY sort_order, code";
		const pointSql =
			"SELECT code, name, category, points, description, enabled, sort_order, src, rule, tier, cap, dedup_scope, legacy, builtin FROM score_point ORDER BY sort_order, code";

		expect(newDb.prepare(stageSql).all()).toEqual(oldDb.prepare(stageSql).all());
		expect(newDb.prepare(pointSql).all()).toEqual(oldDb.prepare(pointSql).all());

		newDb.close();
		oldDb.close();
	});
});
