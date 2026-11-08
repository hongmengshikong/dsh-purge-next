import type {
	Finding,
	FindingRow,
	Scope,
	ScoreResult,
	Severity,
	Target,
	TargetRow,
} from "./types.js";
import { DatabaseSync } from "node:sqlite";

/** 评分权重：类型层面穷举 severity，新增等级会在这里编译报错。 */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
	info: 0,
	low: 1,
	medium: 3,
	high: 7,
	critical: 12,
};

const SCOPES: readonly Scope[] = ["internal", "external", "unknown"];
const SEVERITIES: readonly Severity[] = ["info", "low", "medium", "high", "critical"];

export function isScope(value: unknown): value is Scope {
	return typeof value === "string" && (SCOPES as readonly string[]).includes(value);
}

export function isSeverity(value: unknown): value is Severity {
	return typeof value === "string" && (SEVERITIES as readonly string[]).includes(value);
}

export interface StoreOptions {
	/** 注入时钟，测试里可固定 */
	now?: () => string;
}

export class RedteamStore {
	private readonly db: DatabaseSync;
	private readonly now: () => string;

	constructor(dbPath: string, options: StoreOptions = {}) {
		this.db = new DatabaseSync(dbPath);
		this.now = options.now ?? (() => new Date().toISOString());
		// 占位模型（target/finding）尚未并入正式 schema；先建自己的两张表。
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS target (
				id TEXT PRIMARY KEY, name TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'unknown',
				created_at TEXT NOT NULL, updated_at TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS finding (
				id TEXT PRIMARY KEY, target_id TEXT NOT NULL, title TEXT NOT NULL,
				severity TEXT NOT NULL DEFAULT 'info', created_at TEXT NOT NULL
			);
		`);
	}

	addTarget(input: { id: string; name: string; scope?: Scope }): Target {
		const scope = input.scope ?? "unknown";
		if (!isScope(scope)) throw new Error(`invalid scope: ${String(scope)}`);
		const ts = this.now();
		this.db
			.prepare(
				`INSERT INTO target (id, name, scope, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET name=excluded.name, scope=excluded.scope, updated_at=excluded.updated_at`,
			)
			.run(input.id, input.name, scope, ts, ts);
		const row = this.getTarget(input.id);
		if (!row) throw new Error("target vanished after upsert");
		return row;
	}

	getTarget(id: string): Target | null {
		const row = this.db.prepare(`SELECT * FROM target WHERE id = ?`).get(id) as TargetRow | undefined;
		return row ? toTarget(row) : null;
	}

	listTargets(): Target[] {
		const rows = this.db.prepare(`SELECT * FROM target ORDER BY created_at ASC`).all() as unknown as TargetRow[];
		return rows.map(toTarget);
	}

	addFinding(input: { id: string; targetId: string; title: string; severity?: Severity }): Finding {
		const severity = input.severity ?? "info";
		if (!isSeverity(severity)) throw new Error(`invalid severity: ${String(severity)}`);
		const ts = this.now();
		this.db
			.prepare(`INSERT INTO finding (id, target_id, title, severity, created_at) VALUES (?, ?, ?, ?, ?)`)
			.run(input.id, input.targetId, input.title, severity, ts);
		const row = this.db.prepare(`SELECT * FROM finding WHERE id = ?`).get(input.id) as FindingRow | undefined;
		if (!row) throw new Error("finding vanished after insert");
		return toFinding(row);
	}

	listFindings(targetId?: string): Finding[] {
		const rows = targetId
			? (this.db.prepare(`SELECT * FROM finding WHERE target_id = ? ORDER BY created_at ASC`).all(targetId) as unknown as FindingRow[])
			: (this.db.prepare(`SELECT * FROM finding ORDER BY created_at ASC`).all() as unknown as FindingRow[]);
		return rows.map(toFinding);
	}

	/** 靶标得分：按 severity 权重求和；未知等级在写入时已被拒绝，这里无需兜底。 */
	scoreTarget(targetId: string): ScoreResult {
		const findings = this.listFindings(targetId);
		const bySeverity: Record<Severity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
		let total = 0;
		for (const f of findings) {
			bySeverity[f.severity] += 1;
			total += SEVERITY_WEIGHT[f.severity];
		}
		return { total, bySeverity, findings: findings.length };
	}

	close(): void {
		this.db.close();
	}
}

function toTarget(row: TargetRow): Target {
	return {
		id: row.id,
		name: row.name,
		scope: isScope(row.scope) ? row.scope : "unknown",
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toFinding(row: FindingRow): Finding {
	return {
		id: row.id,
		targetId: row.target_id,
		title: row.title,
		severity: isSeverity(row.severity) ? row.severity : "info",
		createdAt: row.created_at,
	};
}
