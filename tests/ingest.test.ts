import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { ingestBundle } from "../src/redteam/store/ingest.js";
import { ASSET_FTS_DDL, DDL, HAS_FTS5, migrate } from "../src/redteam/store/schema.js";
import { stats } from "../src/redteam/store/assets.js";

const roots: string[] = [];
function tempDb(): DatabaseSync {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-ingest-"));
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

describe("ingestBundle", () => {
	it("写入 scan_run / asset / port / service / fingerprint / name / observation / edge", () => {
		const db = tempDb();
		const result = ingestBundle(
			db,
			{
				scan: { tool: "nmap", argv: ["-sV", "10.0.0.0/24"] },
				assets: [
					{
						ip: "10.0.0.5",
						state: "live",
						primary_name: "portal.local",
						names: [{ name: "portal.local", kind: "domain" }],
						ports: [
							{
								port: 443,
								proto: "tcp",
								service: "https",
								product: "nginx",
								version: "1.24",
								banner: "nginx/1.24",
								title: "Portal",
								fingerprints: [{ category: "web", product: "nginx", version: "1.24" }],
							},
						],
					},
				],
				edges: [{ src_kind: "asset", src_id: 1, dst_kind: "asset", dst_id: 2, relation: "reaches" }],
			},
			FIXED,
		);

		expect(result.counts).toEqual({ segments: 0, assets: 1, ports: 1, services: 1, fingerprints: 1, names: 1, edges: 1 });
		expect(result.scan_run_id).toBeTypeOf("number");

		const port = db.prepare("SELECT * FROM port WHERE port = 443").get() as Record<string, unknown>;
		expect(port).toMatchObject({ proto: "tcp", state: "open" });
		expect(port.banner).toBe("nginx/1.24");

		const service = db.prepare("SELECT * FROM service").get() as Record<string, unknown>;
		expect(service).toMatchObject({ name: "https", product: "nginx", version: "1.24" });

		const fingerprint = db.prepare("SELECT * FROM fingerprint").get() as Record<string, unknown>;
		expect(fingerprint).toMatchObject({ category: "web", product: "nginx", version: "1.24" });

		const name = db.prepare("SELECT * FROM asset_name").get() as Record<string, unknown>;
		expect(name).toMatchObject({ name: "portal.local", kind: "domain" });

		const observations = db.prepare("SELECT attr FROM observation ORDER BY id").all() as { attr: string }[];
		expect(observations.map((row) => row.attr)).toEqual(
			expect.arrayContaining(["name", "primary_name", "open", "service", "fingerprint"]),
		);

		const relations = (db.prepare("SELECT relation FROM edge ORDER BY id").all() as { relation: string }[]).map((row) => row.relation);
		expect(relations).toEqual(expect.arrayContaining(["resolves", "reaches"]));

		const counts = stats(db);
		expect(counts).toMatchObject({ assets: 1, liveAssets: 1, openPorts: 1, services: 1, fingerprints: 1 });
		expect(counts.activeSignals).toBeGreaterThan(0);
		db.close();
	});

	it("同一端口重复 ingest 只更新状态，不新增行", () => {
		const db = tempDb();
		ingestBundle(db, { assets: [{ ip: "10.0.0.5", ports: [{ port: 80, state: "open", banner: "old" }] }] }, FIXED);
		ingestBundle(db, { assets: [{ ip: "10.0.0.5", ports: [{ port: 80, state: "closed", title: "new" }] }] }, FIXED);
		const rows = db.prepare("SELECT state, banner, title FROM port").all() as Record<string, unknown>[];
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ state: "closed", banner: "old", title: "new" });
		db.close();
	});

	it("中途失败回滚，scan_run 不残留", () => {
		const db = tempDb();
		expect(() =>
			ingestBundle(
				db,
				{
					scan: { tool: "nmap" },
					assets: [{ ip: "10.0.0.5", ports: [{ port: Number.NaN }] }],
				},
				FIXED,
			),
		).toThrow();
		expect((db.prepare("SELECT COUNT(*) AS n FROM scan_run").get() as { n: number }).n).toBe(0);
		expect((db.prepare("SELECT COUNT(*) AS n FROM asset").get() as { n: number }).n).toBe(0);
		db.close();
	});
});
