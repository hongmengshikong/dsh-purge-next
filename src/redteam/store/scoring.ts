/**
 * 作战阶段与默认得分点（seedStages / seedScorePoints 的 TS 移植）。
 *
 * 数据来自 score-data.ts（由旧仓库生成）。迁移策略与旧实现一致：
 * 缺哪条补哪条；已存在的内置点同步规则元数据（name/category/points/rule/cap/...），
 * **不覆盖用户的启用/停用状态**。
 *
 * TODO(M2)：旧实现还有一段「旧体系得分点与命中归档后清理」，涉及文件归档与不可逆删除，
 * 等 score_hit 写入链路移植完再一起做；fresh DB 上两者输出一致。
 */
import { nowIso } from "./engagement.js";
import { DEFAULT_SCORE_POINTS, DEFAULT_STAGES } from "./score-data.js";
import type { SqlDb } from "./schema.js";

export interface SeedStagesResult {
	seeded: number;
}

export function seedStages(db: SqlDb, now: () => string = nowIso): SeedStagesResult {
	const have = new Set((db.prepare("SELECT code FROM stage").all() as { code: string }[]).map((row) => row.code));
	if (DEFAULT_STAGES.every((stage) => have.has(stage.code))) return { seeded: 0 };

	const maxRow = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS n FROM stage").get() as { n?: number } | undefined;
	let order = Number(maxRow?.n ?? -1) + 1;
	const insert = db.prepare(
		`INSERT INTO stage(code, name, subtitle, color, goal, sections, tools, transition, sort_order, updated_at)
		 VALUES(?,?,?,?,?,?,?,?,?,?)`,
	);
	let seeded = 0;
	for (const stage of DEFAULT_STAGES) {
		if (have.has(stage.code)) continue;
		insert.run(
			stage.code,
			stage.name,
			stage.subtitle ?? null,
			stage.color ?? null,
			stage.goal ?? null,
			JSON.stringify(stage.sections ?? []),
			stage.tools ?? null,
			stage.transition ?? null,
			order++,
			now(),
		);
		seeded += 1;
	}
	return { seeded };
}

export interface StageItem {
	code: string;
	name: string;
	subtitle: string;
	color: string;
	goal: string;
	sections: unknown;
	tools: string;
	transition: string;
	ordinal: number;
	updated_at: string | null;
}

function parseJson(text: unknown, fallback: unknown): unknown {
	try {
		return JSON.parse(String(text ?? ""));
	} catch {
		return fallback;
	}
}

export function listStages(db: SqlDb, now: () => string = nowIso): StageItem[] {
	seedStages(db, now);
	const rows = db.prepare("SELECT * FROM stage ORDER BY sort_order, code").all() as Record<string, unknown>[];
	return rows.map((row, index) => ({
		code: String(row.code ?? ""),
		name: String(row.name ?? ""),
		subtitle: String(row.subtitle ?? ""),
		color: String(row.color ?? "#64748b"),
		goal: String(row.goal ?? ""),
		sections: parseJson(row.sections, []),
		tools: String(row.tools ?? ""),
		transition: String(row.transition ?? ""),
		ordinal: index + 1,
		updated_at: (row.updated_at as string | null) ?? null,
	}));
}

export interface SeedPointsResult {
	seeded: number;
	synced: number;
}

interface ScorePointRow {
	id: number;
	code: string;
}

export function seedScorePoints(db: SqlDb, now: () => string = nowIso): SeedPointsResult {
	const have = new Set(
		(db.prepare("SELECT code FROM score_point").all() as { code: string }[]).map((row) => String(row.code)),
	);

	let synced = 0;
	if (have.size > 0) {
		const update = db.prepare(
			`UPDATE score_point SET name = ?, category = ?, points = ?, description = ?,
			   src = ?, rule = ?, tier = ?, cap = ?, dedup_scope = ?, builtin = 1, updated_at = ?
			 WHERE code = ? AND legacy = 0`,
		);
		for (const point of DEFAULT_SCORE_POINTS) {
			if (!have.has(point.code)) continue;
			try {
				const result = update.run(
					point.name,
					point.category ?? null,
					point.points ?? 0,
					point.description ?? null,
					point.src ?? null,
					point.rule ?? null,
					point.tier ?? null,
					point.cap ?? 0,
					point.dedup_scope || "service",
					now(),
					point.code,
				) as { changes?: number };
				if (Number(result.changes ?? 0) > 0) synced += 1;
			} catch {
				/* 单条失败不影响其它点 */
			}
		}
	}

	const missing = DEFAULT_SCORE_POINTS.filter((point) => !have.has(point.code));
	if (missing.length > 0) {
		const maxRow = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM score_point").get() as { n?: number } | undefined;
		let order = Number(maxRow?.n ?? 0);
		const insert = db.prepare(
			`INSERT INTO score_point
			   (code, name, category, points, description, enabled, sort_order, created_at, updated_at,
			    src, rule, tier, cap, dedup_scope, legacy, builtin)
			 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		);
		for (const point of missing) {
			insert.run(
				point.code,
				point.name,
				point.category ?? null,
				point.points ?? 0,
				point.description ?? null,
				point.enabled === 0 ? 0 : 1,
				order++,
				now(),
				now(),
				point.src ?? null,
				point.rule ?? null,
				point.tier ?? null,
				point.cap ?? 0,
				point.dedup_scope || "service",
				point.legacy === 1 ? 1 : 0,
				point.legacy === 1 ? 0 : 1,
			);
		}
	}

	return { seeded: missing.length, synced };
}

export function listScorePointRows(db: SqlDb): ScorePointRow[] {
	return db.prepare("SELECT id, code FROM score_point ORDER BY COALESCE(points, 0) ASC, sort_order ASC, id ASC").all() as ScorePointRow[];
}
