import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { ingestBundle } from "../src/redteam/store/ingest.js";
import { ASSET_FTS_DDL, DDL, HAS_FTS5, migrate } from "../src/redteam/store/schema.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "redteam", "store-core.js");

const BUNDLE = {
	scan: { tool: "nmap", argv: ["-sV"] },
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
		{ ip: "8.8.8.8", ports: [{ port: 53, proto: "udp", state: "open" }] },
	],
	edges: [{ src_kind: "asset", src_id: 1, dst_kind: "asset", dst_id: 2, relation: "reaches" }],
};

function dump(db: DatabaseSync): Record<string, unknown[]> {
	return {
		asset: db.prepare("SELECT id, ip, segment_cidr, ip_int, state, primary_name, scope FROM asset ORDER BY id").all(),
		port: db.prepare("SELECT asset_id, proto, port, state, banner, url, title, provenance FROM port ORDER BY id").all(),
		service: db.prepare("SELECT port_id, name, product, version, cpe, provenance FROM service ORDER BY id").all(),
		fingerprint: db.prepare("SELECT asset_id, port_id, category, vendor, product, version, evidence, confidence FROM fingerprint ORDER BY id").all(),
		name: db.prepare("SELECT asset_id, name, kind, provenance FROM asset_name ORDER BY id").all(),
		observation: db.prepare("SELECT entity_kind, entity_id, attr, value, provenance FROM observation ORDER BY id").all(),
		edge: db.prepare("SELECT src_kind, src_id, dst_kind, dst_id, relation FROM edge ORDER BY id").all(),
		scan_run: db.prepare("SELECT tool, argv, status FROM scan_run ORDER BY id").all(),
	};
}

const roots: string[] = [];
function tempRoot(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	roots.push(dir);
	return dir;
}

describe.skipIf(!existsSync(OLD_CORE))("ingest parity（对照旧 RedteamStore.importBundle）", () => {
	it("八张表的 dump 逐字节一致", async () => {
		const oldModule = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			RedteamStore: new (root: string) => {
				openEngagement(name: string, scope: string[]): { id: string };
				importBundle(id: string, bundle: unknown): unknown;
				db(id: string): DatabaseSync;
				close(): void;
			};
		};
		const oldRoot = tempRoot("old-ingest-");
		const oldStore = new oldModule.RedteamStore(oldRoot);
		const engagement = oldStore.openEngagement("oracle", []);
		oldStore.importBundle(engagement.id, BUNDLE);
		const oldDump = dump(oldStore.db(engagement.id));
		oldStore.close();

		const newRoot = tempRoot("new-ingest-");
		const db = new DatabaseSync(join(newRoot, "assets.db"));
		db.exec(DDL);
		if (HAS_FTS5) db.exec(ASSET_FTS_DDL);
		migrate(db);
		ingestBundle(db, BUNDLE);
		const newDump = dump(db);
		db.close();

		expect(newDump).toEqual(oldDump);
	});
});

// 保证旧仓库缺失时 roots 也被清理
process.on("exit", () => {
	for (const dir of roots.splice(0)) {
		try {
			rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
		} catch {
			/* 退出阶段忽略 */
		}
	}
});
