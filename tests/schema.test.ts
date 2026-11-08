import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
	ASSET_FTS_DDL,
	DDL,
	KNOWLEDGE_DDL,
	POC_FTS_DDL,
	guessPocCategory,
	migrate,
	migrateKnowledge,
} from "../src/redteam/store/schema.js";

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** 旧仓库 lib/redteam/schema.js 的 DDL 指纹：移植后必须逐字节一致。 */
const OLD_HASHES = {
	ddl: "c9d8ec5ba8e7ac1d57917ed4774d10b498b1d64eba2b6c1ae0f9a7d2ed2ca4d9",
	knowledge: "7c599d2a726e80a95b6a8ddf8cccba4e27d4b0cb5f5e9ba30c74b6ab03e23d7e",
	assetFts: "a6eab803433d11d92c33ac51c67c759717c0d028a61b122770f06567898ad74c",
	pocFts: "dcf5cbab9006df3baa895681a9953bbd7b2ae0a72e396984a9fe075ca012534d",
};

const roots: string[] = [];
function tempDb(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-schema-"));
	roots.push(dir);
	return join(dir, "assets.db");
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("schema 移植", () => {
	it("DDL 与旧仓库逐字节一致（sha256）", () => {
		expect(sha256(DDL)).toBe(OLD_HASHES.ddl);
		expect(sha256(KNOWLEDGE_DDL)).toBe(OLD_HASHES.knowledge);
		expect(sha256(ASSET_FTS_DDL)).toBe(OLD_HASHES.assetFts);
		expect(sha256(POC_FTS_DDL)).toBe(OLD_HASHES.pocFts);
	});

	it("建库后可重复迁移（幂等），列齐全", () => {
		const db = new DatabaseSync(tempDb());
		db.exec(DDL);
		migrate(db);
		migrate(db);

		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
			.all() as { name: string }[];
		const names = tables.map((row) => row.name);
		for (const table of ["asset", "port", "vuln", "score_point", "score_hit", "attack_step", "credential", "tunnel", "shot"]) {
			expect(names).toContain(table);
		}

		const assetColumns = (db.prepare("PRAGMA table_info(asset)").all() as { name: string }[]).map((row) => row.name);
		for (const column of ["scope", "discovered_at", "test_status", "priority", "assessed_by"]) {
			expect(assetColumns).toContain(column);
		}

		const views = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'view'").all() as { name: string }[]).map(
			(row) => row.name,
		);
		expect(views).toEqual(expect.arrayContaining(["v_asset_summary", "v_asset_service"]));
		db.close();
	});

	it("知识库迁移补列并按关键词归类", () => {
		const db = new DatabaseSync(tempDb());
		db.exec(KNOWLEDGE_DDL);
		migrateKnowledge(db);
		db.prepare("INSERT INTO poc (code, title, component) VALUES (?, ?, ?)").run("shiro-550", "Shiro 反序列化", "Shiro");
		migrateKnowledge(db);

		const row = db.prepare("SELECT category FROM poc WHERE code = ?").get("shiro-550") as { category?: string };
		expect(row.category).toBe("deserialization");
		db.close();
	});

	it("guessPocCategory 关键词优先级", () => {
		expect(guessPocCategory("Weblogic 反序列化 getshell")).toBe("deserialization");
		expect(guessPocCategory("上传绕过 写马")).toBe("file-upload");
		expect(guessPocCategory("随便什么")).toBe("other");
	});
});
