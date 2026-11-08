/**
 * 记分写入（addScoreHit 的可验证子集）。
 *
 * 已移植：得分点解析（point_id / code / point_name）、evidence 必填、
 * self_created、服务端口解析、points 边界校验、G5/G6 倍率。
 *
 * TODO(M2)：旧实现插入后还会跑 listScorePoints 计算封顶并回传 capped 信息；
 * 封顶评估（applyScoreCaps / evaluateScoreBoard）单独移植，之后在这里接回。
 */
import { nowIso } from "./engagement.js";
import { isIpv6 } from "./ip.js";
import { normalizePort, parseTargetPort } from "./score-rules.js";
import type { SqlDb } from "./schema.js";

export interface ScoreHitInput {
	point_id?: number | string | null;
	code?: string | null;
	point_name?: string | null;
	asset_id?: number | null;
	vuln_id?: number | null;
	step_id?: number | null;
	target?: string | null;
	evidence?: string | null;
	note?: string | null;
	self_created?: boolean | number | string | null;
	port?: number | string | null;
	recorded_by?: string | null;
	points?: number | string | null;
	ip_version?: number | string | null;
	data_scale?: string | null;
}

export interface ScoreHitRecord {
	id: number;
	point_id: number;
	point_code: string;
	asset_id: number | null;
	vuln_id: number | null;
	step_id: number | null;
	target: string | null;
	evidence: string;
	note: string | null;
	self_created: number;
	port: number | null;
	points: number | null;
	multiplier: number;
}

export function targetHasIpv6Host(target: unknown): boolean {
	const text = String(target ?? "").trim();
	if (text === "") return false;
	const bracket = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\])/i.exec(text);
	if (bracket !== null) return isIpv6((bracket[1] ?? "").replace(/^\[|\]$/g, ""));
	const url = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\s]+)/i.exec(text);
	const authority = url !== null ? (url[1] ?? "") : (/^([^\s/?#]+)/.exec(text) ?? [])[1] ?? "";
	if (!authority) return false;
	const host = authority.replace(/^\[|\]$/g, "").replace(/:\d{1,5}$/, "");
	return isIpv6(host);
}

export function scoreMultiplierOf(hit: ScoreHitInput): { multiplier: number; reasons: string[] } {
	const reasons: string[] = [];
	let multiplier = 1;
	const target = String(hit.target ?? "");
	const ipv6 =
		Number(hit.ip_version) === 6 ||
		targetHasIpv6Host(target) ||
		/(^|\/\/)(?:\[[0-9a-f:]+\]|[0-9a-f]*(?::[0-9a-f]*){2,})/i.test(target);
	if (ipv6) {
		multiplier *= 3;
		reasons.push("G6 IPv6 成果 ×3");
	}
	const scale = String(hit.data_scale ?? "").trim().toLowerCase();
	if (scale === "large") {
		multiplier *= 2;
		reasons.push("G5 数据规模超 1 亿条 / 10TB ×2");
	} else if (scale === "knowledge-base" || scale === "kb") {
		multiplier *= 2;
		reasons.push("G5 控制知识库相关系统 ×2");
	}
	return { multiplier, reasons };
}

export function hitPointsOf(hit: { points?: unknown; multiplier?: unknown; code?: string | null }, metaByCode?: Map<string, { points?: number }>): number {
	let base = 0;
	if (hit.points !== null && hit.points !== undefined && hit.points !== "") base = Number(hit.points) || 0;
	else if (hit.code && metaByCode) base = Number(metaByCode.get(String(hit.code))?.points ?? 0) || 0;
	const mult = Number(hit.multiplier);
	return Math.round(base * (Number.isFinite(mult) && mult > 0 ? mult : 1));
}

function servicePortOf(db: SqlDb, hit: ScoreHitInput): number | null {
	const explicit = normalizePort(hit.port);
	if (explicit !== null) return explicit;
	const fromTarget = parseTargetPort(hit.target);
	if (fromTarget !== null) return fromTarget;
	const rawAsset = hit.asset_id as unknown;
	const assetId = rawAsset === null || rawAsset === undefined || rawAsset === "" ? null : Number(rawAsset);
	if (assetId === null) return null;
	try {
		const ports = db.prepare("SELECT port FROM port WHERE asset_id = ? ORDER BY port").all(assetId) as { port: number }[];
		if (ports.length === 1) return normalizePort(ports[0]?.port);
	} catch {
		/* 表不存在时忽略 */
	}
	return null;
}

/**
 * 记录一次得分。
 * @returns 插入行的完整快照（供上层拼装响应；封顶标记暂未计算）
 */
export function addScoreHit(db: SqlDb, hit: ScoreHitInput, now: () => string = nowIso): ScoreHitRecord {
	let pointId: number | null = hit.point_id !== undefined && hit.point_id !== null ? Number(hit.point_id) : null;
	if (pointId === null && hit.code) {
		const row = db.prepare("SELECT id FROM score_point WHERE code = ?").get(String(hit.code)) as { id?: number } | undefined;
		if (row !== undefined) pointId = Number(row.id);
	}
	if (pointId === null && hit.point_name) {
		const row = db.prepare("SELECT id FROM score_point WHERE name = ?").get(String(hit.point_name)) as { id?: number } | undefined;
		if (row !== undefined) pointId = Number(row.id);
	}
	if (pointId === null) {
		throw new Error(
			"score point not found：得分规则已按《突破入侵类得分规则（合并版）》重构为 25 项，旧 code 已作废。先用 redteam_score_list 读实际 code，或传 point_id / point_name。",
		);
	}

	const evidence = String(hit.evidence ?? "").trim();
	if (evidence === "") throw new Error("score hit evidence required：一条命中必须写明依据（账号 / 命令输出 / 数据量 / 路径）");

	const selfCreated = hit.self_created === true || hit.self_created === 1 || hit.self_created === "1" ? 1 : 0;
	const port = servicePortOf(db, hit);

	const pointMeta = (db.prepare("SELECT points, cap FROM score_point WHERE id = ?").get(pointId) as { points?: number; cap?: number } | undefined) ?? {};
	const pointsMax = Math.max(Number(pointMeta.cap) || 0, (Number(pointMeta.points) || 0) * 100, 1000);
	let hitPoints: number | null = null;
	if (hit.points !== undefined && hit.points !== null && hit.points !== "") {
		const value = Number(hit.points);
		if (!Number.isFinite(value)) throw new Error(`score hit points invalid：points 必须是有限数字（收到 ${JSON.stringify(hit.points)}）`);
		if (value <= 0) throw new Error(`score hit points invalid：points 必须大于 0（收到 ${value}）。请按得分规则的档位表填写分值，不要用它来调节分数。`);
		if (value > pointsMax) {
			throw new Error(
				`score hit points invalid：points=${value} 超过该得分点的合理上限 ${pointsMax}（= max(规则上限 ${Number(pointMeta.cap) || 0}，默认分值 ${Number(pointMeta.points) || 0} × 100)）。请按规则档位填写，或修正得分点的分值设置。`,
			);
		}
		hitPoints = value;
	}

	const multiplier = scoreMultiplierOf(hit).multiplier;
	const result = db
		.prepare(
			`INSERT INTO score_hit(point_id, asset_id, vuln_id, step_id, target, evidence, note, self_created, port, recorded_by, recorded_at, points, multiplier)
			 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		)
		.run(
			pointId,
			hit.asset_id ?? null,
			hit.vuln_id ?? null,
			hit.step_id ?? null,
			hit.target ?? null,
			evidence,
			hit.note ?? null,
			selfCreated,
			port,
			hit.recorded_by ?? null,
			now(),
			hitPoints,
			multiplier,
		);
	const hitId = Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0);
	const point = db.prepare("SELECT code FROM score_point WHERE id = ?").get(pointId) as { code?: string } | undefined;

	return {
		id: hitId,
		point_id: pointId,
		point_code: String(point?.code ?? ""),
		asset_id: hit.asset_id ?? null,
		vuln_id: hit.vuln_id ?? null,
		step_id: hit.step_id ?? null,
		target: (hit.target as string | null) ?? null,
		evidence,
		note: (hit.note as string | null) ?? null,
		self_created: selfCreated,
		port,
		points: hitPoints,
		multiplier,
	};
}
