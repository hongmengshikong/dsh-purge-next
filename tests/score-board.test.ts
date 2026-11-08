import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { upsertAsset } from "../src/redteam/store/assets.js";
import { addScoreHit } from "../src/redteam/store/score-hit.js";
import { listScoreBoard } from "../src/redteam/store/score-board.js";
import { DEFAULT_SCORE_POINTS } from "../src/redteam/store/score-data.js";
import { ASSET_FTS_DDL, DDL, HAS_FTS5, migrate } from "../src/redteam/store/schema.js";
import { seedScorePoints } from "../src/redteam/store/scoring.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "redteam", "store-core.js");
const CODE_A = DEFAULT_SCORE_POINTS[0]?.code ?? "";
const CODE_B = DEFAULT_SCORE_POINTS[1]?.code ?? "";

const roots: string[] = [];
function tempDb(): DatabaseSync {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-board-"));
	roots.push(dir);
	const db = new DatabaseSync(join(dir, "assets.db"));
	db.exec(DDL);
	if (HAS_FTS5) db.exec(ASSET_FTS_DDL);
	migrate(db);
	seedScorePoints(db);
	return db;
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

const FIXED = () => "2026-01-01T00:00:00.000Z";

function seedHits(db: DatabaseSync): void {
	upsertAsset(db, { ip: "10.0.0.5", primary_name: "portal" });
	addScoreHit(db, { code: CODE_A, evidence: "admin shell", target: "10.0.0.5:443", asset_id: 1 }, FIXED);
	addScoreHit(db, { code: CODE_B, evidence: "user shell", target: "10.0.0.5:443", asset_id: 1 }, FIXED);
	addScoreHit(db, { code: CODE_A, evidence: "self reg", target: "10.0.0.5:443", asset_id: 1, self_created: true }, FIXED);
}

describe.skipIf(!existsSync(OLD_CORE))("listScorePoints parity（对照旧看板）", () => {
	it("summary 与每个得分点的 counted/earned/self_created/capped 一致", async () => {
		const oldModule = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			RedteamStore: new (root: string) => {
				openEngagement(name: string, scope: string[]): { id: string };
				addScoreHit(id: string, hit: unknown): unknown;
				listScorePoints(id: string): {
					items: { code: string; counted: number; earned: number; self_created: number; capped: number }[];
					summary: Record<string, unknown>;
				};
				close(): void;
			};
		};
		const oldRoot = mkdtempSync(join(tmpdir(), "old-board-"));
		roots.push(oldRoot);
		const oldStore = new oldModule.RedteamStore(oldRoot);
		const engagement = oldStore.openEngagement("board", []);
		oldStore.addScoreHit(engagement.id, { code: CODE_A, evidence: "admin shell", target: "10.0.0.5:443", asset_id: 1 });
		oldStore.addScoreHit(engagement.id, { code: CODE_B, evidence: "user shell", target: "10.0.0.5:443", asset_id: 1 });
		oldStore.addScoreHit(engagement.id, { code: CODE_A, evidence: "self reg", target: "10.0.0.5:443", asset_id: 1, self_created: true });
		const oldBoard = oldStore.listScorePoints(engagement.id);
		oldStore.close();

		const db = tempDb();
		seedHits(db);
		const board = listScoreBoard(db);

		expect(board.summary).toEqual(oldBoard.summary);

		const pick = (items: { code: string; counted: number; earned: number; self_created: number; capped: number }[]) =>
			items
				.map((item) => ({
					code: item.code,
					counted: item.counted,
					earned: item.earned,
					self_created: item.self_created,
					capped: item.capped,
				}))
				.sort((a, b) => a.code.localeCompare(b.code));
		expect(pick(board.items)).toEqual(pick(oldBoard.items));
		db.close();
	});
});
