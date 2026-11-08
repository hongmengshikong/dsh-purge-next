import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RedteamStore, SEVERITY_WEIGHT } from "../src/redteam/store/index.js";

const temps: string[] = [];
function tempDb(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-store-"));
	temps.push(dir);
	return join(dir, "redteam.db");
}

afterEach(() => {
	for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("RedteamStore", () => {
	it("建库 → 写靶标 → 读回（字段映射 camelCase）", () => {
		const store = new RedteamStore(tempDb());
		const created = store.addTarget({ id: "t1", name: "示例单位", scope: "external" });
		expect(created).toMatchObject({ id: "t1", name: "示例单位", scope: "external" });
		expect(store.listTargets()).toHaveLength(1);
		expect(store.getTarget("t1")?.scope).toBe("external");
		store.close();
	});

	it("upsert 同一 id 不产生重复行", () => {
		const store = new RedteamStore(tempDb());
		store.addTarget({ id: "t1", name: "A" });
		store.addTarget({ id: "t1", name: "B" });
		const rows = store.listTargets();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("B");
		store.close();
	});

	it("评分按 severity 权重累加，并给出分级计数", () => {
		const store = new RedteamStore(tempDb());
		store.addTarget({ id: "t1", name: "A" });
		store.addFinding({ id: "f1", targetId: "t1", title: "SQLi", severity: "high" });
		store.addFinding({ id: "f2", targetId: "t1", title: "信息泄露", severity: "low" });
		store.addFinding({ id: "f3", targetId: "t1", title: "RCE", severity: "critical" });

		const score = store.scoreTarget("t1");
		expect(score.findings).toBe(3);
		expect(score.total).toBe(SEVERITY_WEIGHT.high + SEVERITY_WEIGHT.low + SEVERITY_WEIGHT.critical);
		expect(score.bySeverity).toMatchObject({ high: 1, low: 1, critical: 1, medium: 0, info: 0 });
		store.close();
	});

	it("非法枚举被拒绝", () => {
		const store = new RedteamStore(tempDb());
		// @ts-expect-error 故意传非法 scope
		expect(() => store.addTarget({ id: "x", name: "x", scope: "lan" })).toThrow(/invalid scope/);
		store.close();
	});

	it("重开同一库不重复建表（迁移幂等）", () => {
		const db = tempDb();
		const a = new RedteamStore(db);
		a.addTarget({ id: "t1", name: "A" });
		a.close();
		const b = new RedteamStore(db);
		expect(b.listTargets()).toHaveLength(1);
		b.close();
	});
});
