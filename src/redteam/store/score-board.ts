/**
 * 得分看板（listScorePoints 的 TS 移植子集）。
 *
 * 已移植：每个得分点的命中列表、计入/封顶统计、earned、summary 核心字段。
 * 未移植（TODO M2）：证据截图挂载（#representativeShots）与 ruleGroups 分组、
 * latestCapped 的文案拼装。字段命名与旧实现保持一致，便于后续补齐。
 */
import { hitPointsOf, evaluateScoreBoard, loadAssetNames, serviceLabel, scoreCapReasonText, type CappedRow, type ScoreMeta } from "./score-caps.js";
import { normalizePort, parseTargetPort } from "./score-rules.js";
import type { SqlDb } from "./schema.js";

export interface ScorePointRow {
	id: number;
	code: string;
	name: string;
	category: string | null;
	points: number | null;
	tier: string | null;
	rule: number | null;
	cap: number | null;
	dedup_scope: string | null;
	src: number | null;
	builtin: number | null;
	legacy: number | null;
	description: string | null;
	enabled: number | null;
	sort_order: number | null;
}

export interface ScoreHitItem {
	id: number;
	asset_id: number | null;
	vuln_id: number | null;
	step_id: number | null;
	target: string | null;
	evidence: string | null;
	note: string | null;
	points: number;
	points_overridden: boolean;
	port: number | null;
	self_created: boolean;
	capped: boolean;
	capped_by_id: number | null;
	capped_reason_kind: string | null;
	capped_by: string | null;
	service: string;
	recorded_by: string | null;
	recorded_at: string | null;
}

export interface ScorePointItem {
	id: number;
	code: string;
	name: string;
	category: string | null;
	points: number;
	rule: number | null;
	tier: string | null;
	cap: number;
	dedup_scope: string;
	src: number | null;
	builtin: boolean;
	legacy: boolean;
	counted: number;
	earned: number;
	self_created: number;
	capped: number;
	cap_used: number | null;
	cap_capped: number;
	enabled: boolean;
	sort_order: number;
	hits: ScoreHitItem[];
}

export interface LatestCapped {
	hit_id: number;
	point_id: number;
	code: string | null;
	service: string;
	evidence: string | null;
	points: number;
	recorded_at: string | null;
	reason: string;
}

export interface ScoreSummary {
	achievedPoints: number;
	pointCount: number;
	hitPointCount: number;
	hitCount: number;
	countedHits: number;
	selfCreatedHits: number;
	serviceCappedHits: number;
	cappedByDedup: number;
	cappedByRuleLimit: number;
	legacyPointCount: number;
	legacyHitCount: number;
	latestCapped: LatestCapped | null;
}

export interface ScoreBoardView {
	items: ScorePointItem[];
	summary: ScoreSummary;
}

export function listScoreBoard(db: SqlDb): ScoreBoardView {
	const pointRows = db.prepare("SELECT * FROM score_point ORDER BY COALESCE(points, 0) ASC, sort_order ASC, id ASC").all() as unknown as ScorePointRow[];
	const hitRows = db.prepare("SELECT * FROM score_hit ORDER BY recorded_at DESC, id DESC").all() as unknown as Record<string, unknown>[];
	const assetIp = new Map(
		(db.prepare("SELECT id, ip FROM asset").all() as { id: number; ip: string }[]).map((row) => [row.id, row.ip]),
	);
	const names = loadAssetNames(db);
	const codeOf = new Map(pointRows.map((row) => [row.id, row.code]));
	const pointsOf = new Map(pointRows.map((row) => [row.id, Number(row.points) || 0]));
	const metaByCode = new Map<string, ScoreMeta>(
		pointRows.map((row) => [
			row.code,
			{
				rule: row.rule === null || row.rule === undefined ? null : Number(row.rule),
				cap: Number(row.cap) || 0,
				dedup_scope: row.dedup_scope ?? "service",
				points: Number(row.points) || 0,
				enabled: row.enabled === null || row.enabled === undefined ? 1 : Number(row.enabled),
				builtin: Number(row.builtin) === 1,
				src: row.src === null || row.src === undefined ? null : Number(row.src),
			},
		]),
	);

	const effectivePoints = (hit: Record<string, unknown>): number => {
		const code = codeOf.get(Number(hit.point_id));
		return hitPointsOf(
			{ points: hit.points as number | null, multiplier: hit.multiplier as number | null, code: code ?? null },
			new Map([[String(code), { points: pointsOf.get(Number(hit.point_id)) ?? 0 } as ScoreMeta]]),
		);
	};

	const byPoint = new Map<number, Record<string, unknown>[]>();
	for (const hit of hitRows) {
		const pointId = Number(hit.point_id);
		if (!byPoint.has(pointId)) byPoint.set(pointId, []);
		byPoint.get(pointId)?.push(hit);
	}

	const capped = evaluateScoreBoard(
		db,
		hitRows.map((hit) => ({
			...hit,
			id: Number(hit.id),
			code: codeOf.get(Number(hit.point_id)) ?? null,
			points: effectivePoints(hit),
		})) as never,
		{ meta: metaByCode, names },
	);
	const cappedById = new Map(capped.items.map((hit) => [hit.id, hit]));

	const enabledRows = pointRows.filter((row) => row.enabled === 1);
	const enabledIds = new Set(enabledRows.map((row) => row.id));

	const items: ScorePointItem[] = pointRows.map((row) => {
		const list = (byPoint.get(row.id) ?? []).map((hit) => {
			const flag = cappedById.get(Number(hit.id)) as CappedRow | undefined;
			const isCapped = flag !== undefined && flag.capped === true;
			const item: ScoreHitItem = {
				id: Number(hit.id),
				asset_id: (hit.asset_id as number | null) ?? null,
				vuln_id: (hit.vuln_id as number | null) ?? null,
				step_id: (hit.step_id as number | null) ?? null,
				target: (hit.target as string | null) ?? null,
				evidence: (hit.evidence as string | null) ?? null,
				note: (hit.note as string | null) ?? null,
				points: effectivePoints(hit),
				points_overridden: hit.points !== null && hit.points !== undefined,
				port: normalizePort(hit.port) ?? parseTargetPort(hit.target),
				self_created: Number(hit.self_created) === 1,
				capped: isCapped,
				capped_by_id: isCapped && flag ? flag.capped_by_id ?? null : null,
				capped_reason_kind: isCapped && flag ? flag.capped_reason_kind ?? null : null,
				capped_by: isCapped && flag ? ((flag.capped_by_evidence as string | null) ?? null) : null,
				service: "",
				recorded_by: (hit.recorded_by as string | null) ?? null,
				recorded_at: (hit.recorded_at as string | null) ?? null,
			};
			item.service = serviceLabel(
				{
					id: item.id,
					target: item.target,
					port: item.port,
					asset_ip: assetIp.get(Number(hit.asset_id)) ?? "",
					code: row.code,
				} as never,
				assetIp.get(Number(hit.asset_id)) ?? "",
			);
			return { item, flag, raw: hit };
		});

		const valid = list.filter((entry) => entry.item.self_created !== true);
		const countedList = valid.filter((entry) => entry.item.capped !== true);
		const cappedList = valid.filter((entry) => entry.item.capped === true);
		const meta = metaByCode.get(row.code);
		const capUsed = meta && meta.rule !== null ? capped.caps.get(`rule:${meta.rule}`) : undefined;

		return {
			id: row.id,
			code: row.code,
			name: row.name,
			category: row.category,
			points: Number(row.points) || 0,
			rule: meta?.rule ?? null,
			tier: row.tier ?? null,
			cap: Number(row.cap) || 0,
			dedup_scope: meta?.dedup_scope ?? "service",
			src: row.src === null || row.src === undefined ? null : Number(row.src),
			builtin: Number(row.builtin) === 1,
			legacy: Number(row.legacy) === 1,
			counted: countedList.length,
			earned: countedList.reduce((sum, entry) => sum + (Number(entry.item.points) || 0), 0),
			self_created: list.length - valid.length,
			capped: cappedList.length,
			cap_used: capUsed ? capUsed.used : null,
			cap_capped: capUsed ? capUsed.capped : 0,
			enabled: row.enabled === 1,
			sort_order: Number(row.sort_order) || 0,
			hits: list.map((entry) => entry.item),
		};
	});

	const sorted = items.slice().sort((a, b) => {
		const ra = a.hits.length > 0 ? 0 : 1;
		const rb = b.hits.length > 0 ? 0 : 1;
		if (ra !== rb) return ra - rb;
		if (a.points !== b.points) return a.points - b.points;
		return a.sort_order - b.sort_order;
	});

	const cappedItems = capped.items.filter(
		(hit) => hit.capped === true && codeOf.get(Number(hit.point_id)) !== undefined && enabledIds.has(Number(hit.point_id)),
	);
	const legacyItems = items.filter((item) => item.legacy);
	const enabledItems = items.filter((item) => item.enabled);

	const latestCappedRow = cappedItems
		.slice()
		.sort((a, b) => {
			const sa = `${String(a.recorded_at ?? "")}#${String(a.id).padStart(8, "0")}`;
			const sb = `${String(b.recorded_at ?? "")}#${String(b.id).padStart(8, "0")}`;
			return sb.localeCompare(sa);
		})[0];
	const latestCapped: LatestCapped | null = latestCappedRow
		? {
				hit_id: Number(latestCappedRow.id),
				point_id: Number(latestCappedRow.point_id),
				code: (latestCappedRow.code as string | null) ?? null,
				service: serviceLabel(
					{ ...latestCappedRow, asset_ip: assetIp.get(Number(latestCappedRow.asset_id)) ?? "" } as never,
					assetIp.get(Number(latestCappedRow.asset_id)) ?? "",
				),
				evidence: (latestCappedRow.evidence as string | null) ?? null,
				points: Number(latestCappedRow.points) || 0,
				recorded_at: (latestCappedRow.recorded_at as string | null) ?? null,
				reason: scoreCapReasonText(
					{ ...latestCappedRow, asset_ip: assetIp.get(Number(latestCappedRow.asset_id)) ?? "" } as never,
					(latestCappedRow.capped_by_points as number | null) ?? null,
				),
			}
		: null;

	return {
		items: sorted,
		summary: {
			achievedPoints: enabledItems.reduce((sum, item) => sum + item.earned, 0),
			pointCount: enabledItems.length,
			hitPointCount: enabledItems.filter((item) => item.counted > 0).length,
			hitCount: items.reduce((sum, item) => sum + item.hits.length, 0),
			countedHits: enabledItems.reduce((sum, item) => sum + item.counted, 0),
			selfCreatedHits: items.reduce((sum, item) => sum + item.self_created, 0),
			serviceCappedHits: cappedItems.length,
			cappedByDedup: cappedItems.filter((hit) => hit.capped_reason_kind === "dedup").length,
			cappedByRuleLimit: cappedItems.filter((hit) => hit.capped_reason_kind === "cap").length,
			legacyPointCount: legacyItems.length,
			legacyHitCount: legacyItems.reduce((sum, item) => sum + item.hits.length, 0),
			latestCapped,
		},
	};
}

export { scoreCapReasonText };
