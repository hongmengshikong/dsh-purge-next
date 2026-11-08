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
import { activeEngagementId, dbPathOf, dirOf, listEngagements, openEngagement, pathsOf, setActiveEngagement } from "./store/engagement.js";
import { createHash } from "node:crypto";
import { existsSync as fileExists, mkdirSync, readFileSync as readFile, rmSync, writeFileSync as writeFile } from "node:fs";

import { ingestBundle, type IngestBundle } from "./store/ingest.js";
import { listAssets, stats, upsertAsset } from "./store/assets.js";
import { addScoreHit } from "./store/score-hit.js";
import { listScoreBoard } from "./store/score-board.js";
import { seedScorePoints, listStages } from "./store/scoring.js";
import { SCOPE_SQL } from "./store/schema.js";
import { listPrompts, resetPrompts, savePrompt } from "./prompts.js";
import { deletePoc, getPoc, markPocUsed, pocStats, savePoc, searchPocs, updatePoc } from "./knowledge/store.js";
import { searchTemplates, templateStats } from "./knowledge/templates.js";
import { assignToolkitFolder, loadPlatformConfig, platformSummary, savePlatformConfig } from "./platform-config.js";

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

		if (op === "platformConfigGet") return platformSummary(root);

		if (op === "platformConfigSave") {
			savePlatformConfig((req.config ?? req) as never, root);
			return platformSummary(root);
		}

		if (op === "platformAssignToolkit") return assignToolkitFolder(String(req.dir ?? ""), root);

		if (op === "platformConfigRaw") return { ok: true, config: loadPlatformConfig(root) };

		if (op === "pocSearch") {
			const items = searchPocs(root, req as never);
			const templates = typeof req.templateLimit === "number" ? searchTemplates(root, String(req.q ?? ""), Math.min(req.templateLimit, 100)) : undefined;
			return { ok: true, items, stats: pocStats(root), templates, dbPath: join(root, "knowledge.db"), root };
		}

		if (op === "pocList") return { ok: true, items: searchPocs(root, req as never), stats: pocStats(root), dbPath: join(root, "knowledge.db") };

		if (op === "templateSearch") return { ok: true, ...searchTemplates(root, String(req.q ?? ""), Math.min(Number(req.limit) || 40, 200)) };

		if (op === "templateStats") return { ok: true, stats: templateStats(root) };

		if (op === "pocStats") return { ok: true, stats: pocStats(root) };

		if (op === "pocGet") return { ok: true, ...(getPoc(root, req.id !== undefined ? Number(req.id) : (req.code as string)) ?? {}) };

		if (op === "pocSave") return { ok: true, ...savePoc(root, (req.poc ?? req) as never) };

		if (op === "pocUpdate") {
			return { ok: true, poc: updatePoc(root, req.id !== undefined ? Number(req.id) : String(req.code ?? ""), (req.patch ?? req) as never) };
		}

		if (op === "pocDelete") return deletePoc(root, req.id !== undefined ? Number(req.id) : String(req.code ?? ""));

		if (op === "pocUse") {
			const used = markPocUsed(root, req.id !== undefined ? Number(req.id) : String(req.code ?? ""), typeof req.used_on === "string" ? req.used_on : undefined);
			return used;
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

		if (op === "testStats") {
			return withDb(root, id, (db) => {
				const rows = db.prepare("SELECT COALESCE(test_status, 'untested') AS s, COUNT(*) AS n FROM asset GROUP BY s").all() as { s: string; n: number }[];
				const out: Record<string, number> = { untested: 0, testing: 0, tested: 0, blocked: 0, abandoned: 0, no_surface: 0 };
				for (const row of rows) out[row.s] = row.n;
				return { ok: true, stats: out };
			});
		}

		if (op === "vulnStats") {
			return withDb(root, id, (db) => {
				const bySeverity: Record<string, number> = {};
				for (const row of db.prepare("SELECT severity, COUNT(*) AS n FROM vuln GROUP BY severity").all() as { severity: string; n: number }[]) bySeverity[row.severity] = row.n;
				const byStatus: Record<string, number> = {};
				for (const row of db.prepare("SELECT status, COUNT(*) AS n FROM vuln GROUP BY status").all() as { status: string; n: number }[]) byStatus[row.status] = row.n;
				const withGained = Number((db.prepare("SELECT COUNT(*) AS n FROM vuln WHERE COALESCE(gained,'') <> ''").get() as { n: number }).n);
				const withEvidence = Number((db.prepare("SELECT COUNT(*) AS n FROM vuln WHERE COALESCE(evidence,'') <> '' OR id IN (SELECT vuln_id FROM http_evidence WHERE vuln_id IS NOT NULL)").get() as { n: number }).n);
				const rawTargets = db.prepare("SELECT target, (SELECT ip FROM asset WHERE id = vuln.asset_id) AS ip FROM vuln").all() as { target?: string | null; ip?: string | null }[];
				const targetGroups = new Set(rawTargets.map((row) => String(row.target || row.ip || ""))).size;
				return { ok: true, stats: { total: Object.values(bySeverity).reduce((a, b) => a + b, 0), bySeverity, byStatus, withGained, withEvidence, targetGroups } };
			});
		}

		if (op === "activeTests") {
			return withDb(root, id, (db) => {
				const limit = Math.min(Number(req.limit) || 8, 50);
				const select = `SELECT a.id, a.ip, a.segment_cidr, COALESCE(a.scope, (${SCOPE_SQL})) AS scope, a.state,
				  COALESCE(a.test_status, 'untested') AS test_status, a.test_notes, a.test_surface,
				  a.test_updated_at, a.test_updated_by, COALESCE(a.blocked_count, 0) AS blocked_count,
				  a.priority, a.potential,
				  (SELECT COUNT(*) FROM port p WHERE p.asset_id = a.id AND p.state = 'open') AS open_ports,
				  (SELECT COUNT(*) FROM vuln v WHERE v.asset_id = a.id AND v.status IN ('confirmed','exploited')) AS vulns,
				  (SELECT COUNT(*) FROM webshell w WHERE w.asset_id = a.id) AS webshells,
				  (SELECT COUNT(*) FROM tunnel t WHERE t.asset_id = a.id) AS tunnels`;
				const testing = db.prepare(`${select} FROM asset a WHERE COALESCE(a.test_status, 'untested') = 'testing' ORDER BY a.test_updated_at DESC, a.id DESC LIMIT ?`).all(limit);
				const recent = db.prepare(`${select} FROM asset a WHERE a.test_updated_at IS NOT NULL AND COALESCE(a.test_status, 'untested') <> 'testing' ORDER BY a.test_updated_at DESC LIMIT ?`).all(limit);
				const queue = db.prepare(`${select} FROM asset a WHERE COALESCE(a.test_status, 'untested') = 'untested' ORDER BY CASE COALESCE(a.priority, '') WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END, (SELECT COUNT(*) FROM port p WHERE p.asset_id = a.id AND p.state = 'open') DESC, a.ip_int LIMIT ?`).all(limit);
				const untested = Number((db.prepare("SELECT COUNT(*) AS n FROM asset a WHERE COALESCE(a.test_status, 'untested') = 'untested'").get() as { n: number }).n);
				const statRows = db.prepare("SELECT COALESCE(test_status, 'untested') AS s, COUNT(*) AS n FROM asset GROUP BY s").all() as { s: string; n: number }[];
				const statsOut: Record<string, number> = { untested: 0, testing: 0, tested: 0, blocked: 0, abandoned: 0, no_surface: 0 };
				for (const row of statRows) statsOut[row.s] = row.n;
				return { ok: true, testing, recent, queue, stats: statsOut, untested, at: new Date().toISOString() };
			});
		}

		if (op === "shots") {
			return withDb(root, id, (db) => {
				const where = [];
				const args = [];
				if (req.point_id !== undefined) { where.push("point_id = ?"); args.push(Number(req.point_id)); }
				if (req.hit_id !== undefined) { where.push("hit_id = ?"); args.push(Number(req.hit_id)); }
				const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
				return { ok: true, items: db.prepare(`SELECT * FROM shot ${clause} ORDER BY id DESC LIMIT ?`).all(...args, Math.min(Number(req.limit) || 200, 1000)) };
			});
		}

		if (op === "shotAdd") {
			const shot = (req.shot ?? req) as Record<string, unknown>;
			const data = String(shot.data ?? "");
			if (!data) return { ok: false, error: "shot.data(base64) 必填" };
			const buffer = Buffer.from(data.replace(/^data:[^,]+,/, ""), "base64");
			const sha = createHash("sha256").update(buffer).digest("hex");
			const ext = String(shot.mime ?? "image/png").includes("jpeg") ? "jpg" : "png";
			const file = String(shot.file ?? `shot-${Date.now()}-${sha.slice(0, 8)}.${ext}`);
			const dir = join(dirOf(pathsOf(root), id), "shots");
			mkdirSync(dir, { recursive: true });
			writeFile(join(dir, file), buffer);
			return withDb(root, id, (db) => {
				const result = db.prepare(
					`INSERT INTO shot(point_id, hit_id, asset_id, vuln_id, target, label, note, file, kind, mime, bytes, width, height, sha256, source_ref, captured_at, found_by_agent, agent, created_at)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				).run(
					sqlv(shot.point_id), sqlv(shot.hit_id), sqlv(shot.asset_id), sqlv(shot.vuln_id), sqlv(shot.target),
					sqlv(shot.label), sqlv(shot.note), file, sqlv(shot.kind) ?? "screenshot", sqlv(shot.mime) ?? "image/png",
					buffer.length, sqlv(shot.width), sqlv(shot.height), sha, sqlv(shot.source_ref),
					sqlv(shot.captured_at) ?? new Date().toISOString(), sqlv(shot.found_by_agent), sqlv(shot.agent), new Date().toISOString(),
				);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0), file, sha256: sha };
			});
		}

		if (op === "shotData") {
			return withDb(root, id, (db) => {
				const row = db.prepare("SELECT * FROM shot WHERE id = ?").get(Number(req.id)) as Record<string, unknown> | undefined;
				if (!row) return { ok: false, error: "shot not found" };
				const fp = join(dirOf(pathsOf(root), id), "shots", String(row.file));
				if (!fileExists(fp)) return { ok: false, error: "shot file missing" };
				return { ok: true, mime: row.mime ?? "image/png", data: readFile(fp).toString("base64"), item: row };
			});
		}

		if (op === "shotDelete") {
			return withDb(root, id, (db) => {
				const row = db.prepare("SELECT file FROM shot WHERE id = ?").get(Number(req.id)) as { file?: string } | undefined;
				db.prepare("DELETE FROM shot WHERE id = ?").run(Number(req.id));
				if (row?.file) {
					try {
						rmSync(join(dirOf(pathsOf(root), id), "shots", row.file), { force: true });
					} catch {
						/* 文件已不在 */
					}
				}
				return { ok: true, deleted: true };
			});
		}

		if (op === "access") {
			return withDb(root, id, (db) => ({ ok: true, items: db.prepare("SELECT * FROM access_session ORDER BY id DESC LIMIT ?").all(Math.min(Number(req.limit) || 200, 1000)) }));
		}

		if (op === "addAccess") {
			return withDb(root, id, (db) => {
				const s = (req.access ?? req) as Record<string, unknown>;
				const result = db.prepare(
					`INSERT INTO access_session(asset_id, host, username, method, privilege, session_ref, note, found_by_agent, obtained_at)
					 VALUES(?,?,?,?,?,?,?,?,?)`,
				).run(
					sqlv(s.asset_id), sqlv(s.host), sqlv(s.username) ?? "", sqlv(s.method), sqlv(s.privilege),
					sqlv(s.session_ref), sqlv(s.note), sqlv(s.found_by_agent), new Date().toISOString(),
				);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0) };
			});
		}

		if (op === "webshells") {
			return withDb(root, id, (db) => ({ ok: true, items: db.prepare("SELECT * FROM webshell ORDER BY id DESC LIMIT ?").all(Math.min(Number(req.limit) || 200, 1000)) }));
		}

		if (op === "addWebshell") {
			return withDb(root, id, (db) => {
				const w = (req.webshell ?? req) as Record<string, unknown>;
				const url = String(w.url ?? "").trim();
				if (!url) return { ok: false, error: "webshell.url 必填" };
				db.prepare(
					`INSERT INTO webshell(asset_id, url, shell_type, pass_key, secret_ref, privilege, status, note, found_by_agent, created_at, updated_at, agent)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
					 ON CONFLICT(url, pass_key) DO UPDATE SET
					   shell_type = COALESCE(excluded.shell_type, webshell.shell_type),
					   secret_ref = COALESCE(excluded.secret_ref, webshell.secret_ref),
					   privilege = COALESCE(excluded.privilege, webshell.privilege),
					   status = COALESCE(excluded.status, webshell.status),
					   note = COALESCE(excluded.note, webshell.note),
					   updated_at = excluded.updated_at`,
				).run(
					sqlv(w.asset_id), url, sqlv(w.shell_type), sqlv(w.pass_key), sqlv(w.secret_ref), sqlv(w.privilege),
					sqlv(w.status) ?? "unknown", sqlv(w.note), sqlv(w.found_by_agent), new Date().toISOString(), new Date().toISOString(), sqlv(w.agent),
				);
				return { ok: true };
			});
		}

		if (op === "updateWebshell") {
			return withDb(root, id, (db) => {
				const patch = (req.patch ?? req) as Record<string, unknown>;
				const target = Number(req.id ?? patch.id);
				const row = db.prepare("SELECT * FROM webshell WHERE id = ?").get(target) as Record<string, unknown> | undefined;
				if (!row) return { ok: false, error: "webshell not found" };
				db.prepare(
					`UPDATE webshell SET status = ?, last_check = ?, check_note = ?, latency_ms = ?, privilege = COALESCE(?, privilege), note = COALESCE(?, note), updated_at = ?
					 WHERE id = ?`,
				).run(
					sqlv(patch.status) ?? String(row.status ?? "unknown"), sqlv(patch.last_check), sqlv(patch.check_note),
					sqlv(patch.latency_ms), sqlv(patch.privilege), sqlv(patch.note), new Date().toISOString(), target,
				);
				return { ok: true };
			});
		}

		if (op === "import") {
			const body = (req.bundle ?? req) as Record<string, unknown>;
			return dispatch(root, { ...req, op: "ingest", bundle: body });
		}

		if (op === "saveScorePoint") {
			return withDb(root, id, (db) => {
				const point = (req.point ?? req) as Record<string, unknown>;
				const pointId = point.id !== undefined ? Number(point.id) : 0;
				if (pointId) {
					const current = db.prepare("SELECT builtin FROM score_point WHERE id = ?").get(pointId) as { builtin?: number } | undefined;
					if (!current) return { ok: false, error: "score point not found" };
					if (Number(current.builtin) === 1) {
						const keys = Object.keys(point).filter((key) => !["id", "enabled"].includes(key));
						if (keys.length > 0) return { ok: false, error: "内置得分点只能启用/停用", builtin: true };
						db.prepare("UPDATE score_point SET enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ?")
							.run(sqlv(point.enabled), new Date().toISOString(), pointId);
						return { ok: true, id: pointId, builtin: true };
					}
					db.prepare(
						`UPDATE score_point SET name = COALESCE(?, name), category = COALESCE(?, category), points = COALESCE(?, points),
						   description = COALESCE(?, description), enabled = COALESCE(?, enabled), cap = COALESCE(?, cap), dedup_scope = COALESCE(?, dedup_scope),
						   updated_at = ? WHERE id = ?`,
					).run(
						sqlv(point.name), sqlv(point.category), sqlv(point.points), sqlv(point.description), sqlv(point.enabled),
						sqlv(point.cap), sqlv(point.dedup_scope), new Date().toISOString(), pointId,
					);
					return { ok: true, id: pointId, builtin: false };
				}
				const code = String(point.code ?? "").trim();
				const name = String(point.name ?? "").trim();
				if (!code || !name) return { ok: false, error: "code 与 name 必填" };
				const exists = db.prepare("SELECT id FROM score_point WHERE code = ?").get(code) as { id?: number } | undefined;
				if (exists?.id) return { ok: false, error: "code 已存在" };
				const result = db.prepare(
					`INSERT INTO score_point(code, name, category, points, description, enabled, sort_order, created_at, updated_at, cap, dedup_scope, legacy, builtin)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0)`,
				).run(
					code, name, sqlv(point.category), sqlv(point.points) ?? 0, sqlv(point.description), sqlv(point.enabled) ?? 1,
					Number((db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM score_point").get() as { n: number }).n),
					new Date().toISOString(), new Date().toISOString(), sqlv(point.cap) ?? 0, sqlv(point.dedup_scope) ?? "none",
				);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0), builtin: false };
			});
		}

		if (op === "deleteScorePoint") {
			return withDb(root, id, (db) => {
				const pointId = Number(req.id ?? (req.point as Record<string, unknown> | undefined)?.id);
				const current = db.prepare("SELECT builtin FROM score_point WHERE id = ?").get(pointId) as { builtin?: number } | undefined;
				if (!current) return { ok: false, error: "score point not found" };
				if (Number(current.builtin) === 1) return { ok: false, error: "内置得分点不可删除（只能停用）", builtin: true };
				db.prepare("DELETE FROM score_hit WHERE point_id = ?").run(pointId);
				db.prepare("DELETE FROM score_point WHERE id = ?").run(pointId);
				return { ok: true, deleted: true };
			});
		}

		if (op === "reportTargets") {
			return withDb(root, id, (db) => {
				const rows = db.prepare(`SELECT COALESCE(v.target, a.ip, '(未标注)') AS target,
				  COUNT(*) AS vulns, SUM(CASE WHEN v.severity IN ('critical','high','medium') THEN 1 ELSE 0 END) AS serious
				  FROM vuln v LEFT JOIN asset a ON a.id = v.asset_id GROUP BY target ORDER BY vulns DESC`).all();
				return { ok: true, items: rows };
			});
		}

		if (op === "preflight") {
			return withDb(root, id, (db) => ({
				ok: true,
				engagement: id,
				stats: stats(db),
				platform: platformSummary(root),
				prompt_seeded: false,
				at: new Date().toISOString(),
			}));
		}

		if (op === "unverifiedCount") {
			return withDb(root, id, (db) => ({
				ok: true,
				count: Number((db.prepare("SELECT COUNT(*) AS n FROM vuln WHERE COALESCE(status, '') IN ('', 'candidate')").get() as { n: number }).n),
			}));
		}

		if (op === "sessions") {
			return withDb(root, id, (db) => {
				const shells = db.prepare("SELECT w.*, a.ip AS asset_ip FROM webshell w LEFT JOIN asset a ON a.id = w.asset_id ORDER BY w.id DESC").all() as Record<string, unknown>[];
				const tunnels = db.prepare("SELECT t.*, a.ip AS asset_ip, w.url AS webshell_url FROM tunnel t LEFT JOIN asset a ON a.id = t.asset_id LEFT JOIN webshell w ON w.id = t.webshell_id ORDER BY t.id DESC")
					.all() as Record<string, unknown>[];
				const legit = (kind: unknown) => ["target-outbound", "target-http", "target-agent"].includes(String(kind));
				const mapped: Record<string, unknown>[] = tunnels.map((row) => ({ ...row, legit: legit(row.entry_kind), entry_kind_label: row.entry_kind ?? null }));
				const one = (sql: string): number => Number((db.prepare(sql).get() as { n?: number }).n ?? 0);
				return {
					ok: true,
					webshells: shells,
					tunnels: mapped,
					totals: {
						webshells: shells.length,
						webshellsOnline: shells.filter((row) => row.status === "online").length,
						tunnels: mapped.length,
						tunnelsActive: mapped.filter((row) => row.status === "active").length,
						tunnelsLegit: mapped.filter((row) => row.legit === true).length,
						credentials: one("SELECT COUNT(*) AS n FROM credential"),
						accesses: one("SELECT COUNT(*) AS n FROM access_session"),
					},
				};
			});
		}

		if (op === "consoleDigest") {
			return withDb(root, id, (db) => {
				const count = (sql: string): number => Number((db.prepare(sql).get() as { n?: number }).n ?? 0);
				const at = (sql: string): string | null => ((db.prepare(sql).get() as { t?: string | null }).t ?? null);
				return {
					ok: true,
					sections: {
						assets: { count: count("SELECT COUNT(*) AS n FROM asset"), at: at("SELECT MAX(COALESCE(discovered_at, first_seen, last_seen)) AS t FROM asset") },
						vulns: { count: count("SELECT COUNT(*) AS n FROM vuln"), at: at("SELECT MAX(found_at) AS t FROM vuln") },
						credentials: { count: count("SELECT COUNT(*) AS n FROM credential"), at: at("SELECT MAX(found_at) AS t FROM credential") },
						access: { count: count("SELECT COUNT(*) AS n FROM access_session"), at: at("SELECT MAX(obtained_at) AS t FROM access_session") },
						webshells: { count: count("SELECT COUNT(*) AS n FROM webshell"), at: at("SELECT MAX(updated_at) AS t FROM webshell") },
						tunnels: { count: count("SELECT COUNT(*) AS n FROM tunnel"), at: at("SELECT MAX(updated_at) AS t FROM tunnel") },
						steps: { count: count("SELECT COUNT(*) AS n FROM attack_step"), at: at("SELECT MAX(recorded_at) AS t FROM attack_step") },
						hits: { count: count("SELECT COUNT(*) AS n FROM score_hit"), at: at("SELECT MAX(recorded_at) AS t FROM score_hit") },
						shots: { count: count("SELECT COUNT(*) AS n FROM shot"), at: at("SELECT MAX(created_at) AS t FROM shot") },
					},
				};
			});
		}

		if (op === "snapshot") {
			return withDb(root, id, (db) => {
				const engagement = listEngagements(root).find((item) => item.id === id);
				return { ok: true, engagement, stats: stats(db), at: new Date().toISOString() };
			});
		}

		if (op === "attackGraph") {
			return withDb(root, id, (db) => {
				const nodes: { id: string; kind: string; label: string; meta: Record<string, unknown> }[] = [];
				const edges: { source: string; target: string; relation: string }[] = [];
				const assets = db.prepare("SELECT id, ip FROM asset ORDER BY ip_int").all() as { id: number; ip: string }[];
				for (const asset of assets) nodes.push({ id: `asset:${asset.id}`, kind: "asset", label: asset.ip, meta: {} });
				const vulns = db.prepare("SELECT id, asset_id, title, severity FROM vuln").all() as { id: number; asset_id?: number | null; title?: string; severity?: string }[];
				for (const vuln of vulns) {
					nodes.push({ id: `vuln:${vuln.id}`, kind: "vuln", label: vuln.title ?? `vuln ${vuln.id}`, meta: { severity: vuln.severity } });
					if (vuln.asset_id) edges.push({ source: `asset:${vuln.asset_id}`, target: `vuln:${vuln.id}`, relation: "has" });
				}
				const steps = db.prepare("SELECT id, asset_id, vuln_id, title, stage FROM attack_step ORDER BY COALESCE(seq, 999999), id").all() as {
					id: number;
					asset_id?: number | null;
					vuln_id?: number | null;
					title?: string;
					stage?: string;
				}[];
				for (const step of steps) {
					nodes.push({ id: `step:${step.id}`, kind: "step", label: step.title ?? `step ${step.id}`, meta: { stage: step.stage } });
					if (step.vuln_id) edges.push({ source: `vuln:${step.vuln_id}`, target: `step:${step.id}`, relation: "leads" });
					else if (step.asset_id) edges.push({ source: `asset:${step.asset_id}`, target: `step:${step.id}`, relation: "leads" });
				}
				return { ok: true, nodes, edges };
			});
		}

		if (op === "updateVuln") {
			return withDb(root, id, (db) => {
				const patch = (req.patch ?? req) as Record<string, unknown>;
				const vulnId = Number(req.id ?? patch.id);
				const row = db.prepare("SELECT * FROM vuln WHERE id = ?").get(vulnId) as Record<string, unknown> | undefined;
				if (!row) return { ok: false, error: "vuln not found" };
				db.prepare(
					`UPDATE vuln SET title = COALESCE(?, title), severity = COALESCE(?, severity), status = COALESCE(?, status),
					   evidence = COALESCE(?, evidence), gained = COALESCE(?, gained), confidence = COALESCE(?, confidence),
					   target = COALESCE(?, target), agent = COALESCE(?, agent) WHERE id = ?`,
				).run(sqlv(patch.title), sqlv(patch.severity), sqlv(patch.status), sqlv(patch.evidence), sqlv(patch.gained), sqlv(patch.confidence), sqlv(patch.target), sqlv(patch.agent), vulnId);
				return { ok: true };
			});
		}

		if (op === "updateTunnel") {
			return withDb(root, id, (db) => {
				const patch = (req.patch ?? req) as Record<string, unknown>;
				const tunnelId = Number(req.id ?? patch.id);
				const row = db.prepare("SELECT * FROM tunnel WHERE id = ?").get(tunnelId) as Record<string, unknown> | undefined;
				if (!row) return { ok: false, error: "tunnel not found" };
				db.prepare(
					`UPDATE tunnel SET status = COALESCE(?, status), last_check = COALESCE(?, last_check), check_note = COALESCE(?, check_note),
					   latency_ms = COALESCE(?, latency_ms), note = COALESCE(?, note), updated_at = ? WHERE id = ?`,
				).run(sqlv(patch.status), sqlv(patch.last_check), sqlv(patch.check_note), sqlv(patch.latency_ms), sqlv(patch.note), new Date().toISOString(), tunnelId);
				return { ok: true };
			});
		}

		if (op === "assetLink") {
			return withDb(root, id, (db) => {
				const link = (req.link ?? req) as Record<string, unknown>;
				db.prepare(
					`INSERT INTO edge(src_kind, src_id, dst_kind, dst_id, relation, confidence, first_seen, last_seen)
					 VALUES(?,?,?,?,?,?,?,?)
					 ON CONFLICT(src_kind, src_id, dst_kind, dst_id, relation) DO UPDATE SET last_seen = excluded.last_seen`,
				).run(
					String(link.src_kind ?? ""), String(link.src_id ?? ""), String(link.dst_kind ?? ""), String(link.dst_id ?? ""),
					String(link.relation ?? "related"), sqlv(link.confidence), new Date().toISOString(), new Date().toISOString(),
				);
				return { ok: true };
			});
		}

		if (op === "discoveryTimeline") {
			return withDb(root, id, (db) => {
				const limit = Math.min(Number(req.limit) || 50, 500);
				const days = db.prepare(`SELECT substr(COALESCE(discovered_at, first_seen, ''), 1, 10) AS day,
				  COUNT(*) AS assets,
				  SUM(CASE WHEN COALESCE(scope, (${SCOPE_SQL})) = 'internal' THEN 1 ELSE 0 END) AS internal,
				  SUM(CASE WHEN COALESCE(scope, (${SCOPE_SQL})) = 'external' THEN 1 ELSE 0 END) AS external
				  FROM asset GROUP BY day ORDER BY day DESC`).all() as { day?: string }[];
				const recent = db.prepare(`SELECT id, ip, segment_cidr, state, primary_name, discovered_at, first_seen, last_seen,
				  COALESCE(scope, (${SCOPE_SQL})) AS scope, priority,
				  (SELECT COUNT(*) FROM port p WHERE p.asset_id = asset.id AND p.state = 'open') AS open_ports
				  FROM asset ORDER BY COALESCE(discovered_at, first_seen, '') DESC, id DESC LIMIT ?`).all(limit);
				const span = db.prepare("SELECT MIN(COALESCE(discovered_at, first_seen)) AS first, MAX(COALESCE(discovered_at, first_seen)) AS last, COUNT(*) AS total FROM asset").get() as Record<string, unknown>;
				return { ok: true, days: days.map((row) => ({ ...row, day: row.day || "(未知时间)" })), recent, span };
			});
		}

		if (op === "domains") {
			return withDb(root, id, (db) => {
				const where = ["kind IN ('domain','hostname')"];
				const args: (string | number | null)[] = [];
				if (typeof req.q === "string" && req.q) {
					where.push("name LIKE ?");
					args.push(`%${String(req.q)}%`);
				}
				const items = db.prepare(`SELECT name, COUNT(DISTINCT asset_id) AS assets, MAX(last_seen) AS last_seen
				  FROM asset_name WHERE ${where.join(" AND ")} GROUP BY name ORDER BY assets DESC, name LIMIT ?`).all(...args, Math.min(Number(req.limit) || 200, 1000));
				return { ok: true, items };
			});
		}

		if (op === "web") {
			return withDb(root, id, (db) => {
				const where = ["(p.url IS NOT NULL OR p.title IS NOT NULL)"];
				const args: (string | number | null)[] = [];
				if (typeof req.q === "string" && req.q) {
					where.push("(p.url LIKE ? OR p.title LIKE ?)");
					args.push(`%${String(req.q)}%`, `%${String(req.q)}%`);
				}
				const items = db.prepare(`SELECT p.id, p.asset_id, a.ip, p.port, p.proto, p.url, p.title, p.banner
				  FROM port p JOIN asset a ON a.id = p.asset_id WHERE ${where.join(" AND ")} ORDER BY p.id DESC LIMIT ?`)
					.all(...args, Math.min(Number(req.limit) || 200, 1000));
				return { ok: true, items };
			});
		}

		if (op === "assessAsset") {
			return withDb(root, id, (db) => {
				const patch = (req.assess ?? req) as Record<string, unknown>;
				const assetId = Number(patch.id ?? patch.asset_id);
				if (!assetId) return { ok: false, error: "asset id 必填" };
				db.prepare("UPDATE asset SET priority = COALESCE(?, priority), potential = COALESCE(?, potential), assess_reason = COALESCE(?, assess_reason), assessed_at = ?, assessed_by = COALESCE(?, assessed_by) WHERE id = ?")
					.run(sqlv(patch.priority), sqlv(patch.potential), sqlv(patch.assess_reason), new Date().toISOString(), sqlv(patch.assessed_by), assetId);
				return { ok: true };
			});
		}

		if (op === "assetTest") {
			return withDb(root, id, (db) => {
				const patch = (req.test ?? req) as Record<string, unknown>;
				const assetId = Number(patch.id ?? patch.asset_id);
				if (!assetId) return { ok: false, error: "asset id 必填" };
				db.prepare("UPDATE asset SET test_status = COALESCE(?, test_status), test_notes = COALESCE(?, test_notes), test_surface = COALESCE(?, test_surface), test_updated_at = ?, test_updated_by = COALESCE(?, test_updated_by) WHERE id = ?")
					.run(sqlv(patch.status), sqlv(patch.notes), sqlv(patch.surface), new Date().toISOString(), sqlv(patch.by), assetId);
				return { ok: true };
			});
		}

		if (op === "graph") {
			return withDb(root, id, (db) => {
				const nodes: { id: string; kind: string; label: string; meta: Record<string, unknown> }[] = [];
				const edges: { source: string; target: string; relation: string }[] = [];
				const seen = new Set<string>();
				const push = (node: { id: string; kind: string; label: string; meta: Record<string, unknown> }) => {
					if (!seen.has(node.id)) {
						seen.add(node.id);
						nodes.push(node);
					}
				};
				const segments = (typeof req.cidr === "string" && req.cidr
					? db.prepare("SELECT * FROM segment WHERE cidr = ?").all(req.cidr)
					: db.prepare("SELECT * FROM segment").all()) as Record<string, unknown>[];
				for (const seg of segments) {
					const cidr = String(seg.cidr);
					push({ id: `seg:${cidr}`, kind: "segment", label: cidr, meta: { org: seg.org, asn: seg.asn } });
					const assets = db.prepare("SELECT * FROM asset WHERE segment_cidr = ? ORDER BY ip_int").all(cidr) as Record<string, unknown>[];
					for (const asset of assets) {
						const assetId = Number(asset.id);
						const nodeId = `asset:${assetId}`;
						const openPorts = db.prepare("SELECT COUNT(*) AS n FROM port WHERE asset_id = ? AND state = 'open'").get(assetId) as { n: number };
						push({
							id: nodeId,
							kind: "asset",
							label: String(asset.ip),
							meta: { state: asset.state, name: asset.primary_name, ports: Number(openPorts.n), segment: cidr },
						});
						edges.push({ source: `seg:${cidr}`, target: nodeId, relation: "contains" });
						const ports = db.prepare("SELECT id, port, proto, provenance FROM port WHERE asset_id = ? AND state = 'open'").all(assetId) as Record<string, unknown>[];
						for (const item of ports) {
							const portNode = `port:${Number(item.id)}`;
							push({ id: portNode, kind: "port", label: `${item.port}/${item.proto}`, meta: { provenance: item.provenance, asset: asset.ip } });
							edges.push({ source: nodeId, target: portNode, relation: "exposes" });
						}
						if (asset.primary_name) {
							const domainId = `name:${String(asset.primary_name)}`;
							push({ id: domainId, kind: "domain", label: String(asset.primary_name), meta: {} });
							edges.push({ source: domainId, target: nodeId, relation: "resolves" });
						}
					}
				}
				return { ok: true, nodes, edges };
			});
		}

		if (op === "httpEvidence") {
			return withDb(root, id, (db) => ({ ok: true, items: db.prepare("SELECT * FROM http_evidence ORDER BY id DESC LIMIT ?").all(Math.min(Number(req.limit) || 200, 1000)) }));
		}

		if (op === "addHttpEvidence") {
			return withDb(root, id, (db) => {
				const e = (req.evidence ?? req) as Record<string, unknown>;
				const result = db.prepare(
					`INSERT INTO http_evidence(vuln_id, asset_id, label, method, url, status, request, response, note, captured_by, captured_at)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
				).run(
					sqlv(e.vuln_id), sqlv(e.asset_id), sqlv(e.label), sqlv(e.method), sqlv(e.url), sqlv(e.status),
					sqlv(e.request), sqlv(e.response), sqlv(e.note), sqlv(e.captured_by), new Date().toISOString(),
				);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0) };
			});
		}

		if (op === "attackFiles") {
			return withDb(root, id, (db) => ({
				ok: true,
				items: db.prepare("SELECT id, target, kind, name, path, description, created_at FROM attack_file ORDER BY id DESC LIMIT ?").all(Math.min(Number(req.limit) || 200, 1000)),
			}));
		}

		if (op === "addAttackFile") {
			const item = (req.file ?? req) as Record<string, unknown>;
			const target = String(item.target ?? "").trim();
			const name = String(item.name ?? "").trim();
			if (!target || !name) return { ok: false, error: "target 与 name 必填" };
			const dir = join(dirOf(pathsOf(root), id), "attack-files", target.replace(/[^\w.@-]+/g, "_"));
			mkdirSync(dir, { recursive: true });
			const rel = join("attack-files", target.replace(/[^\w.@-]+/g, "_"), name.replace(/[^\w.@-]+/g, "_"));
			writeFile(join(dirOf(pathsOf(root), id), rel), String(item.content ?? ""), "utf8");
			return withDb(root, id, (db) => {
				const existing = db.prepare("SELECT id FROM attack_file WHERE target = ? AND name = ?").get(target, name) as { id?: number } | undefined;
				if (existing?.id) {
					db.prepare("UPDATE attack_file SET kind = COALESCE(?, kind), description = COALESCE(?, description), evidence = COALESCE(?, evidence), path = ? WHERE id = ?").run(
						sqlv(item.kind), sqlv(item.description), sqlv(item.evidence), rel, existing.id,
					);
					return { ok: true, id: existing.id, path: rel, updated: true };
				}
				const result = db.prepare(
					`INSERT INTO attack_file(target, target_kind, name, kind, path, description, evidence, asset_id, vuln_id, created_by, created_at)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
				).run(
					target, sqlv(item.target_kind), name, sqlv(item.kind), rel, sqlv(item.description), sqlv(item.evidence),
					sqlv(item.asset_id), sqlv(item.vuln_id), sqlv(item.created_by), new Date().toISOString(),
				);
				return { ok: true, id: Number((result as { lastInsertRowid?: number | bigint }).lastInsertRowid ?? 0), path: rel };
			});
		}

		if (op === "readAttackFile") {
			return withDb(root, id, (db) => {
				const row = db.prepare("SELECT * FROM attack_file WHERE id = ?").get(Number(req.id)) as Record<string, unknown> | undefined;
				if (!row) return { ok: false, error: "attack file not found" };
				const fp = join(dirOf(pathsOf(root), id), String(row.path));
				if (!fileExists(fp)) return { ok: false, error: "file missing" };
				return { ok: true, item: row, content: readFile(fp, "utf8") };
			});
		}

		if (op === "prompts") return { ok: true, roles: listPrompts(root, id) };

		if (op === "savePrompt") {
			const role = String(req.role ?? "").trim();
			const content = typeof req.content === "string" ? req.content : "";
			const saved = savePrompt(root, id, role, content);
			return saved.ok ? { ok: true, role: saved.role, path: saved.path } : { ok: false, error: saved.error };
		}

		if (op === "resetPrompts") {
			const result = resetPrompts(root, id, typeof req.role === "string" ? req.role : undefined);
			return { ok: result.ok, reset: result.reset };
		}

		if (op === "scoreChain") {
			return withDb(root, id, (db) => {
				const board = listScoreBoard(db);
				const stages = listStages(db);
				const items = board.items.flatMap((item) => item.hits.map((hit) => ({ ...hit, code: item.code, point_name: item.name, stage_code: null })));
				return {
					ok: true,
					items,
					stages,
					achieved: board.items.filter((item) => item.counted > 0).map((item) => ({ code: item.code, name: item.name, points: item.earned })),
					missing: board.items.filter((item) => item.enabled && item.hits.length === 0).map((item) => ({ code: item.code, name: item.name, points: item.points })),
					summary: {
						hits: board.summary.hitCount,
						points: board.summary.achievedPoints,
						countedHits: board.summary.countedHits,
						selfCreatedHits: board.summary.selfCreatedHits,
						serviceCappedHits: board.summary.serviceCappedHits,
					},
				};
			});
		}

		if (op === "scoreReport") {
			return withDb(root, id, (db) => {
				const board = listScoreBoard(db);
				const achieved = board.items.filter((item) => item.counted > 0).map((item) => ({ code: item.code, name: item.name, points: item.earned }));
				const missing = board.items.filter((item) => item.enabled && item.hits.length === 0).map((item) => ({ code: item.code, name: item.name, points: item.points }));
				const tunnels = db.prepare("SELECT entry_kind FROM tunnel").all() as { entry_kind?: string | null }[];
				const legit = tunnels.filter((row) => ["target-outbound", "target-http", "target-agent"].includes(String(row.entry_kind))).length;
				return {
					ok: true,
					items: board.items.flatMap((item) => item.hits.map((hit) => ({ ...hit, code: item.code, point_name: item.name }))),
					achieved,
					missing,
					summary: {
						hits: board.summary.hitCount,
						points: board.summary.achievedPoints,
						totalPoints: board.summary.achievedPoints,
						countedHits: board.summary.countedHits,
						achievedCount: achieved.length,
						missingCount: missing.length,
						missingPoints: missing.reduce((sum, item) => sum + item.points, 0),
						selfCreatedHits: board.summary.selfCreatedHits,
						serviceCappedHits: board.summary.serviceCappedHits,
						tunnelsLegit: legit,
						tunnelsSelfOnly: tunnels.length - legit,
					},
				};
			});
		}

		if (op === "report") {
			return withDb(root, id, (db) => {
				const meta = listEngagements(root).find((item) => item.id === id);
				const assets = db.prepare("SELECT COUNT(*) AS n FROM asset").get() as { n: number };
				const vulns = db.prepare("SELECT COUNT(*) AS n FROM vuln").get() as { n: number };
				const creds = db.prepare("SELECT COUNT(*) AS n FROM credential").get() as { n: number };
				const steps = db.prepare("SELECT COUNT(*) AS n FROM attack_step").get() as { n: number };
				const board = listScoreBoard(db);
				const lines = [
					"# 演练成果报告",
					"",
					"- 靶标：" + (meta?.name ?? id) + "（" + id + "）",
					"- 授权范围：" + ((meta?.scope ?? []).join(", ") || "未标注"),
					"- 资产：" + Number(assets.n) + " · 漏洞：" + Number(vulns.n) + " · 凭据：" + Number(creds.n) + " · 攻击链步骤：" + Number(steps.n),
					"- 得分：" + board.summary.achievedPoints + "（计分命中 " + board.summary.countedHits + "/" + board.summary.hitCount + "）",
					"",
					"## 1. 资产面",
					"",
				];
				for (const row of db.prepare("SELECT ip, state, primary_name FROM asset ORDER BY ip_int").all() as { ip: string; state?: string; primary_name?: string }[]) {
					lines.push("- " + row.ip + " · " + (row.state ?? "unknown") + (row.primary_name ? " · " + row.primary_name : ""));
				}
				if (Number(assets.n) === 0) lines.push("（没有资产）");
				return { ok: true, markdown: lines.join("\n"), generated_at: new Date().toISOString() };
			});
		}

		if (op === "stages") return withDb(root, id, (db) => ({ ok: true, items: listStages(db) }));

		if (op === "saveStage") {
			return withDb(root, id, (db) => {
				const patch = (req.stage ?? req) as Record<string, unknown>;
				const code = String(patch.code ?? "").trim();
				if (!code) return { ok: false, error: "stage.code 必填" };
				const current = db.prepare("SELECT * FROM stage WHERE code = ?").get(code) as Record<string, unknown> | undefined;
				const text = (value: unknown, fallback: string): string =>
					typeof value === "string" ? value : String(current?.[fallback] ?? "");
				db.prepare(
					`INSERT INTO stage(code, name, subtitle, color, goal, sections, tools, transition, sort_order, updated_at)
					 VALUES(?,?,?,?,?,?,?,?,?,?)
					 ON CONFLICT(code) DO UPDATE SET
					   name = excluded.name, subtitle = excluded.subtitle, color = excluded.color, goal = excluded.goal,
					   sections = excluded.sections, tools = excluded.tools,
					   transition = excluded.transition, updated_at = excluded.updated_at`,
				).run(
					code,
					text(patch.name, "name") || code,
					text(patch.subtitle, "subtitle"),
					text(patch.color, "color") || "#64748b",
					text(patch.goal, "goal"),
					patch.sections !== undefined ? JSON.stringify(patch.sections) : String(current?.sections ?? "[]"),
					text(patch.tools, "tools"),
					text(patch.transition, "transition"),
					Number(current?.sort_order ?? 0),
					new Date().toISOString(),
				);
				return { ok: true, items: listStages(db) };
			});
		}

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
				const severity = ["info", "low", "medium", "high", "critical"].includes(String(v.severity)) ? String(v.severity) : "info";
				const status = ["candidate", "confirmed", "exploited", "false_positive", "fixed"].includes(String(v.status)) ? String(v.status) : "candidate";
				const existing = v.cve
					? (db.prepare("SELECT id FROM vuln WHERE asset_id IS ? AND cve = ? AND COALESCE(target, '') = ?").get(sqlv(v.asset_id), String(v.cve), String(v.target ?? "")) as { id?: number } | undefined)
					: (db.prepare("SELECT id FROM vuln WHERE asset_id IS ? AND COALESCE(cve, '') = '' AND title = ? AND COALESCE(target, '') = ?").get(sqlv(v.asset_id), String(v.title ?? ""), String(v.target ?? "")) as { id?: number } | undefined);
				if (existing?.id) {
					db.prepare(`UPDATE vuln SET title = COALESCE(?, title), severity = ?, status = COALESCE(?, status),
					   evidence = COALESCE(?, evidence), confidence = COALESCE(?, confidence), source = COALESCE(?, source),
					   target = COALESCE(?, target), found_by_agent = COALESCE(?, found_by_agent), gained = COALESCE(?, gained), agent = COALESCE(?, agent)
					 WHERE id = ?`).run(
						sqlv(v.title), severity, sqlv(v.status), sqlv(v.evidence), sqlv(v.confidence), sqlv(v.source),
						sqlv(v.target), sqlv(v.found_by_agent), sqlv(v.gained), sqlv(v.agent), existing.id,
					);
					return { ok: true, id: existing.id, updated: true };
				}
				const result = db.prepare(`INSERT INTO vuln(asset_id, port_id, cve, title, severity, source, confidence, status, evidence, target, gained, found_by_agent, found_at, agent)
				 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
					sqlv(v.asset_id), sqlv(v.port_id), sqlv(v.cve), sqlv(v.title), severity, sqlv(v.source), sqlv(v.confidence), status,
					sqlv(v.evidence), sqlv(v.target), sqlv(v.gained), sqlv(v.found_by_agent), new Date().toISOString(), sqlv(v.agent),
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
