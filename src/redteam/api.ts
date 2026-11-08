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
import { seedScorePoints, listStages } from "./store/scoring.js";
import { SCOPE_SQL } from "./store/schema.js";

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
