/** 红队数据层的领域模型：数据库行 + 对外实体 + 评分结果。 */

export type Scope = "internal" | "external" | "unknown";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

/** target 表一行（snake_case，与 SQLite 列一一对应） */
export interface TargetRow {
	id: string;
	name: string;
	scope: Scope;
	created_at: string;
	updated_at: string;
}

/** finding 表一行 */
export interface FindingRow {
	id: string;
	target_id: string;
	title: string;
	severity: Severity;
	created_at: string;
}

/** 对外暴露的靶标实体（camelCase） */
export interface Target {
	id: string;
	name: string;
	scope: Scope;
	createdAt: string;
	updatedAt: string;
}

export interface Finding {
	id: string;
	targetId: string;
	title: string;
	severity: Severity;
	createdAt: string;
}

export interface ScoreRule {
	id: string;
	severity: Severity;
	weight: number;
	label: string;
}

export interface ScoreResult {
	total: number;
	bySeverity: Record<Severity, number>;
	findings: number;
}

/** 建库/迁移入参：只依赖最小 exec 面，便于测试时用内存库替身 */
export interface SqlExecutor {
	exec(sql: string): void;
}
