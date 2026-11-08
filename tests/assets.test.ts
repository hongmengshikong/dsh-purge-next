import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { stats, listAssets, upsertAsset } from "../src/redteam/store/assets.js";
import { cidrOf, ipToInt, scopeOfIp } from "../src/redteam/store/ip.js";
import { DDL, migrate } from "../src/redteam/store/schema.js";

const roots: string[] = [];
function tempDb(): DatabaseSync {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-assets-"));
	roots.push(dir);
	const db = new DatabaseSync(join(dir, "assets.db"));
	db.exec(DDL);
	migrate(db);
	return db;
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe("IP 纯函数", () => {
	it("ipToInt / cidrOf / scopeOfIp", () => {
		expect(ipToInt("10.0.0.5")).toBe(167772165);
		expect(ipToInt("2001:db8::1")).toBeNull();
		expect(cidrOf("10.0.0.5")).toBe("10.0.0.0/24");
		expect(cidrOf("2001:db8::1")).toBe("2001:db8:0:0::/64");
		expect(scopeOfIp("10.1.2.3")).toBe("internal");
		expect(scopeOfIp("172.20.0.1")).toBe("internal");
		expect(scopeOfIp("100.100.0.1")).toBe("internal");
		expect(scopeOfIp("8.8.8.8")).toBe("external");
	});
});

describe("upsertAsset / stats / listAssets", () => {
	it("首次写入推导 segment/scope/ip_int", () => {
		const db = tempDb();
		upsertAsset(db, { ip: "10.0.0.5", provenance: "nmap" }, () => "2026-01-01T00:00:00.000Z");
		const row = db.prepare("SELECT * FROM asset WHERE ip = ?").get("10.0.0.5") as Record<string, unknown>;
		expect(row.segment_cidr).toBe("10.0.0.0/24");
		expect(row.ip_int).toBe(167772165);
		expect(row.scope).toBe("internal");
		expect(row.discovered_at).toBe("2026-01-01T00:00:00.000Z");
		db.close();
	});

	it("重复写入保留 discovered_at，刷新 last_seen 与状态", () => {
		const db = tempDb();
		upsertAsset(db, { ip: "10.0.0.5" }, () => "2026-01-01T00:00:00.000Z");
		upsertAsset(db, { ip: "10.0.0.5", state: "live", primary_name: "portal" }, () => "2026-02-01T00:00:00.000Z");
		const row = db.prepare("SELECT * FROM asset WHERE ip = ?").get("10.0.0.5") as Record<string, unknown>;
		expect(row.discovered_at).toBe("2026-01-01T00:00:00.000Z");
		expect(row.last_seen).toBe("2026-02-01T00:00:00.000Z");
		expect(row.state).toBe("live");
		expect(row.primary_name).toBe("portal");
		db.close();
	});

	it("stats 计数与 listAssets 排序/过滤", () => {
		const db = tempDb();
		upsertAsset(db, { ip: "10.0.0.5" });
		upsertAsset(db, { ip: "8.8.8.8", state: "live" });

		const counts = stats(db);
		expect(counts).toMatchObject({ assets: 2, liveAssets: 1, segments: 2, untestedAssets: 2 });

		const all = listAssets(db, { sort: "ip" });
		expect(all.total).toBe(2);
		expect(all.items.map((item) => item.ip)).toEqual(["8.8.8.8", "10.0.0.5"]);

		const filtered = listAssets(db, { cidr: "10.0.0.0/24" });
		expect(filtered.items.map((item) => item.ip)).toEqual(["10.0.0.5"]);
		db.close();
	});
});
