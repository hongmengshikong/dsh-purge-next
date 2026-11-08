import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyScoreCaps, evaluateScoreBoard, type ScoreMeta } from "../src/redteam/store/score-caps.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_RULES = join(OLD_REPO, "lib", "redteam", "score-rules.js");

const meta = (rule: number, cap: number, scope: string, points: number): ScoreMeta => ({
	rule,
	cap,
	dedup_scope: scope,
	points,
	enabled: 1,
	builtin: true,
	src: rule,
});

const POINTS = new Map<string, ScoreMeta>([
	["svc-a", meta(1, 100, "service", 50)],
	["svc-b", meta(1, 100, "service", 30)],
	["sys-a", meta(2, 0, "system", 40)],
	["tgt-a", meta(3, 0, "target", 25)],
	["cap-a", meta(4, 100, "none", 60)],
]);

const ROWS = [
	{ id: 1, code: "svc-a", points: 50, asset_id: 1, target: "10.0.0.5:443", self_created: 0 },
	{ id: 2, code: "svc-b", points: 30, asset_id: 1, target: "https://10.0.0.5/", self_created: 0 },
	{ id: 3, code: "sys-a", points: 40, asset_id: 2, target: "10.0.0.6:80", self_created: 0 },
	{ id: 4, code: "sys-a", points: 35, asset_id: 2, target: "10.0.0.6:80", self_created: 0 },
	{ id: 5, code: "tgt-a", points: 25, asset_id: 3, target: "10.0.0.7:22", self_created: 0 },
	{ id: 6, code: "tgt-a", points: 20, asset_id: 4, target: "10.0.0.8:22", self_created: 0 },
	{ id: 7, code: "cap-a", points: 60, asset_id: 5, target: "10.0.0.9:1", self_created: 0 },
	{ id: 8, code: "cap-a", points: 60, asset_id: 6, target: "10.0.0.10:1", self_created: 0 },
	{ id: 9, code: "svc-a", points: 99, asset_id: 1, target: "10.0.0.5:443", self_created: 1 },
];

const clone = () => ROWS.map((row) => ({ ...row }));

describe.skipIf(!existsSync(OLD_RULES))("applyScoreCaps parity（对照旧 score-rules）", () => {
	it("capped / items / caps 与旧实现完全一致", async () => {
		const oldRules = (await import(`file://${OLD_RULES.replace(/\\/g, "/")}`)) as {
			applyScoreCaps(rows: unknown[], pointsByCode: Map<string, unknown>): {
				capped: number;
				items: Record<string, unknown>[];
				caps: Map<string, unknown>;
			};
		};
		const oldOut = oldRules.applyScoreCaps(clone(), new Map([...POINTS].map(([code, value]) => [code, { ...value }])));
		const newOut = applyScoreCaps(clone(), new Map([...POINTS].map(([code, value]) => [code, { ...value }])));

		expect(newOut.capped).toBe(oldOut.capped);
		expect(newOut.items).toEqual(oldOut.items);
		expect([...newOut.caps.entries()]).toEqual([...oldOut.caps.entries()]);
	});
});

describe("applyScoreCaps 语义", () => {
	it("service 口径：同服务只留最高分，self_created 不参与", () => {
		const out = applyScoreCaps(clone(), POINTS);
		const byId = new Map(out.items.map((item) => [item.id, item]));
		expect(byId.get(1)?.capped).toBe(false);
		expect(byId.get(2)?.capped).toBe(true);
		expect(byId.get(9)?.capped).toBe(false);
	});

	it("rule cap：累计超过上限的命中被标记", () => {
		const out = applyScoreCaps(clone(), POINTS);
		const byId = new Map(out.items.map((item) => [item.id, item]));
		expect(byId.get(7)?.capped).toBe(false);
		expect(byId.get(8)?.capped).toBe(true);
		expect(byId.get(8)?.capped_reason_kind).toBe("cap");
	});

	it("target/system 口径各自只留一条", () => {
		const out = applyScoreCaps(clone(), POINTS);
		const byId = new Map(out.items.map((item) => [item.id, item]));
		expect(byId.get(3)?.capped).toBe(false);
		expect(byId.get(4)?.capped).toBe(true);
		expect(byId.get(5)?.capped).toBe(false);
		expect(byId.get(6)?.capped).toBe(true);
	});
});

describe("evaluateScoreBoard", () => {
	it("按 db 元数据回填 rule/cap 并保持封顶结果", () => {
		const fakeDb = {
			prepare: (sql: string) => ({
				all: () =>
					sql.includes("score_point")
						? [
								{ code: "svc-a", rule: 1, cap: 100, dedup_scope: "service", points: 50, enabled: 1, builtin: 1, src: 1 },
								{ code: "svc-b", rule: 1, cap: 100, dedup_scope: "service", points: 30, enabled: 1, builtin: 1, src: 1 },
							]
						: [{ id: 1, primary_name: "portal" }],
			}),
		};
		const board = evaluateScoreBoard(
			fakeDb as never,
			[
				{ id: 1, code: "svc-a", points: 50, asset_id: 1, target: "10.0.0.5:443" },
				{ id: 2, code: "svc-b", points: 30, asset_id: 1, target: "10.0.0.5:443" },
			],
			{ enabledOnly: true },
		);
		expect(board.byId.get(1)?.capped).toBe(false);
		expect(board.byId.get(2)?.capped).toBe(true);
		expect(board.disabledIds.size).toBe(0);
	});
});
