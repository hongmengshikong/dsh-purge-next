import type { SqlExecutor } from "./types.js";

/**
 * 建库 DDL 与增量迁移。
 *
 * 规矩：
 * - 只写幂等语句（CREATE TABLE IF NOT EXISTS / ADD COLUMN 由 ensureColumn 判断）；
 * - 每个迁移必须能在「空库」和「老库」上各跑一次而不报错；
 * - 迁移失败不要吞掉整段：单条包 try，失败留日志（由调用方注入 logger）。
 */

export const SCHEMA_VERSION = 1;

export const DDL = {
	target: `
		CREATE TABLE IF NOT EXISTS target (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			scope      TEXT NOT NULL DEFAULT 'unknown',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
	`,
	finding: `
		CREATE TABLE IF NOT EXISTS finding (
			id         TEXT PRIMARY KEY,
			target_id  TEXT NOT NULL,
			title      TEXT NOT NULL,
			severity   TEXT NOT NULL DEFAULT 'info',
			created_at TEXT NOT NULL
		)
	`,
	indexes: [
		"CREATE INDEX IF NOT EXISTS idx_finding_target ON finding(target_id)",
		"CREATE INDEX IF NOT EXISTS idx_finding_severity ON finding(severity)",
	],
} as const;

export function migrate(db: SqlExecutor): void {
	db.exec(DDL.target);
	db.exec(DDL.finding);
	for (const sql of DDL.indexes) db.exec(sql);
	db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/** 读取当前库的 schema 版本（空库为 0）。 */
export function readVersion(db: SqlExecutor & { prepare(sql: string): { get(): unknown } }): number {
	try {
		const row = db.prepare("PRAGMA user_version").get() as { user_version?: unknown } | undefined;
		const value = Number(row?.user_version ?? 0);
		return Number.isFinite(value) ? value : 0;
	} catch {
		return 0;
	}
}
