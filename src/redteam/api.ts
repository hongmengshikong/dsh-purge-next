/**
 * 红队 HTTP API 分派（对应旧 store-core.js 的 dispatch 子集）。
 *
 * 已接：bootstrap / openEngagement / activateEngagement / ingest / assets / asset /
 *       scores / addScoreHit。
 * TODO(M5)：vulns / credentials / webshell / tunnel / chain / report 等写读路径。
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { activeEngagementId, dbPathOf, listEngagements, openEngagement, pathsOf, setActiveEngagement } from "./store/engagement.js";
import { ingestBundle, type IngestBundle } from "./store/ingest.js";
import { listAssets, stats, upsertAsset } from "./store/assets.js";
import { addScoreHit } from "./store/score-hit.js";
import { listScoreBoard } from "./store/score-board.js";
import { seedScorePoints } from "./store/scoring.js";

export interface ApiRequest {
	op?: string;
	engagement?: string;
	name?: string;
	scope?: string[];
	[key: string]: unknown;
}

function withDb<T>(root: string, id: string, fn: (db: DatabaseSync) => T): T {
	const fp = dbPathOf(pathsOf(root), id);
	if (!existsSync(fp)) throw new Error(`engagement not found: ${id}`);
	const db = new DatabaseSync(fp);
	try {
		seedScorePoints(db);
		return fn(db);
	} finally {
		db.close();
	}
}

export function dispatch(root: string, req: ApiRequest = {}): Record<string, unknown> {
	const op = typeof req.op === "string" ? req.op.trim() : "";
	if (!op) return { ok: false, error: "缺少 op" };

	try {
		if (op === "bootstrap") {
			const engagements = listEngagements(root);
			const active = activeEngagementId(root);
			return {
				ok: true,
				root,
				engagements,
				current: (typeof req.engagement === "string" && req.engagement.trim()) || active || engagements[0]?.id || null,
			};
		}

		if (op === "openEngagement") {
			const scope = Array.isArray(req.scope) ? (req.scope as string[]) : [];
			return { ok: true, engagement: openEngagement(root, String(req.name ?? ""), scope) };
		}

		if (op === "activateEngagement") {
			const activated = setActiveEngagement(root, String(req.engagement ?? ""));
			return { ok: activated, current: activeEngagementId(root) };
		}

		const id =
			(typeof req.engagement === "string" && req.engagement.trim()) || (activeEngagementId(root) ?? "");
		if (!id) return { ok: false, error: "engagement required" };

		if (op === "ingest") {
			return withDb(root, id, (db) => {
				const result = ingestBundle(db, (req.bundle ?? req) as IngestBundle);
				return { ok: true, scan_run_id: result.scan_run_id, counts: result.counts, stats: stats(db) };
			});
		}

		if (op === "addAsset") {
			return withDb(root, id, (db) => {
				const asset = upsertAsset(db, (req.asset ?? req) as never);
				return { ok: true, id: asset };
			});
		}

		if (op === "assets") {
			return withDb(root, id, (db) => {
				const listed = listAssets(db, {
					cidr: typeof req.cidr === "string" ? req.cidr : undefined,
					state: typeof req.state === "string" ? req.state : undefined,
					ip: typeof req.ip === "string" ? req.ip : undefined,
					sort: (req.sort as "ip" | "discovered" | "ports" | undefined) ?? "ip",
					limit: Number(req.limit) || undefined,
					offset: Number(req.offset) || undefined,
				});
				return { ok: true, ...listed };
			});
		}

		if (op === "asset") {
			return withDb(root, id, (db) => {
				const row = db.prepare("SELECT * FROM asset WHERE id = ?").get(Number(req.id)) as Record<string, unknown> | undefined;
				return { ok: true, asset: row ?? null };
			});
		}

		if (op === "stats") return withDb(root, id, (db) => ({ ok: true, stats: stats(db) }));

		if (op === "scores") return withDb(root, id, (db) => ({ ok: true, ...listScoreBoard(db) }));

		if (op === "addScoreHit") {
			return withDb(root, id, (db) => {
				const hit = addScoreHit(db, (req.hit ?? req) as never);
				const board = listScoreBoard(db);
				return { ok: true, hit, summary: board.summary };
			});
		}

		return { ok: false, error: `未知操作: ${op}` };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** `$DSH_HOME/redteam`（与旧插件同位置）。 */
export const redteamRoot = (dshHome: string): string => join(dshHome, "redteam");
