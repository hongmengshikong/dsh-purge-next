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

type SqlValue = string | number | null;
const sqlv = (value: unknown): SqlValue =>
	value === null || value === undefined ? null : typeof value === "number" || typeof value === "string" ? value : String(value);

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


		if (op === "addVuln") {
			return withDb(root, id, (db) => {
				const v = (req.vuln ?? req) as Record<string, unknown>;
				const result = db
					.prepare(
						`INSERT INTO vuln(asset_id, port_id, cve, title, severity, source, confidence, status, evidence, target, found_by_agent, found_at, gained, agent)
						 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
					)
					.run(
						sqlv(v.asset_id), sqlv(v.port_id), sqlv(v.cve), sqlv(v.title), sqlv(v.severity),
						sqlv(v.source), sqlv(v.confidence), sqlv(v.status) ?? "open", sqlv(v.evidence), sqlv(v.target),
						sqlv(v.found_by_agent), sqlv(v.found_at), sqlv(v.gained), sqlv(v.agent),
					);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0) };
			});
		}

		if (op === "vulns") {
			return withDb(root, id, (db) => {
				const where = [];
				const args = [];
				if (typeof req.severity === "string" && req.severity) { where.push("severity = ?"); args.push(req.severity); }
				if (typeof req.status === "string" && req.status) { where.push("status = ?"); args.push(req.status); }
				const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
				const items = db.prepare(`SELECT * FROM vuln ${clause} ORDER BY id DESC LIMIT ?`).all(...args, Math.min(Number(req.limit) || 200, 1000));
				return { ok: true, items };
			});
		}

		if (op === "addCredential") {
			return withDb(root, id, (db) => {
				const c = (req.credential ?? req) as Record<string, unknown>;
				db.prepare(
					`INSERT INTO credential(asset_id, host, username, secret_type, secret_value, secret_ref, privilege, source, tool, note, found_by_agent, found_at, agent)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
					 ON CONFLICT(host, username, secret_type) DO UPDATE SET
					   secret_value = excluded.secret_value, secret_ref = excluded.secret_ref,
					   privilege = COALESCE(excluded.privilege, credential.privilege), note = COALESCE(excluded.note, credential.note)`,
				).run(
					sqlv(c.asset_id), sqlv(c.host), sqlv(c.username), sqlv(c.secret_type),
					sqlv(c.secret_value), sqlv(c.secret_ref), sqlv(c.privilege), sqlv(c.source),
					sqlv(c.tool), sqlv(c.note), sqlv(c.found_by_agent), sqlv(c.found_at), sqlv(c.agent),
				);
				return { ok: true };
			});
		}

		if (op === "credentials") {
			return withDb(root, id, (db) => {
				const where = [];
				const args = [];
				if (typeof req.host === "string" && req.host) { where.push("host LIKE ?"); args.push(`%${req.host}%`); }
				const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
				return { ok: true, items: db.prepare(`SELECT * FROM credential ${clause} ORDER BY id DESC LIMIT ?`).all(...args, Math.min(Number(req.limit) || 200, 1000)) };
			});
		}

		if (op === "addTunnel") {
			return withDb(root, id, (db) => {
				const t = (req.tunnel ?? req) as Record<string, unknown>;
				const result = db.prepare(
					`INSERT INTO tunnel(asset_id, webshell_id, kind, listen, entry, reach, entry_kind, status, pid, command, note, found_by_agent, created_at, updated_at, agent)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				).run(
					sqlv(t.asset_id), sqlv(t.webshell_id), sqlv(t.kind), sqlv(t.listen), sqlv(t.entry),
					sqlv(t.reach), sqlv(t.entry_kind), sqlv(t.status) ?? "unknown", sqlv(t.pid), sqlv(t.command),
					sqlv(t.note), sqlv(t.found_by_agent), new Date().toISOString(), new Date().toISOString(), sqlv(t.agent),
				);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0) };
			});
		}

		if (op === "tunnels") {
			return withDb(root, id, (db) => ({ ok: true, items: db.prepare("SELECT * FROM tunnel ORDER BY id DESC LIMIT ?").all(Math.min(Number(req.limit) || 200, 1000)) }));
		}

		if (op === "addChainStep") {
			return withDb(root, id, (db) => {
				const s = (req.step ?? req) as Record<string, unknown>;
				const result = db.prepare(
					`INSERT INTO attack_step(seq, stage, title, detail, asset_id, vuln_id, access_id, point_id, evidence_ref, tool, agent, result, recorded_by, recorded_at)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				).run(
					sqlv(s.seq), sqlv(s.stage), sqlv(s.title), sqlv(s.detail), sqlv(s.asset_id),
					sqlv(s.vuln_id), sqlv(s.access_id), sqlv(s.point_id), sqlv(s.evidence_ref),
					sqlv(s.tool), sqlv(s.agent), sqlv(s.result), sqlv(s.recorded_by), new Date().toISOString(),
				);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0) };
			});
		}

		if (op === "chain") {
			return withDb(root, id, (db) => ({
				ok: true,
				items: db.prepare(
					`SELECT s.*, a.ip AS asset_ip, v.title AS vuln_title, v.cve AS vuln_cve
					 FROM attack_step s LEFT JOIN asset a ON a.id = s.asset_id LEFT JOIN vuln v ON v.id = s.vuln_id
					 ORDER BY COALESCE(s.seq, 999999), s.id LIMIT ?`,
				).all(Math.min(Number(req.limit) || 5000, 5000)),
			}));
		}

		return { ok: false, error: `未知操作: ${op}` };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** `$DSH_HOME/redteam`（与旧插件同位置）。 */
export const redteamRoot = (dshHome: string): string => join(dshHome, "redteam");
