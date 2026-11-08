/**
 * 资产读写（M2 第一片写入原语 + 只读查询）。
 *
 * SQL 与旧仓库 store-core.js 的 `#upsertSegment` / `#upsertAsset` / `stats` 原样对齐。
 * 尚未移植：assetChildren / 全文检索 / 复杂过滤（q、priority、fingerprint…），见 TASKBOOK M2。
 */
import { cidrOf, ipToInt, scopeOfIp } from "./ip.js";
import { nowIso } from "./engagement.js";
export function upsertAsset(db, input, now = nowIso) {
    const ip = String(input.ip ?? "").trim();
    if (!ip)
        throw new Error("asset.ip is required");
    const cidr = input.segment_cidr || cidrOf(ip);
    const stamp = now();
    db.prepare(`INSERT INTO segment(cidr, ip_start, ip_end, org, asn, country, city, source, first_seen, last_seen)
		 VALUES(?,?,?,?,?,?,?,?,?,?)
		 ON CONFLICT(cidr) DO UPDATE SET
		   org = COALESCE(excluded.org, segment.org),
		   asn = COALESCE(excluded.asn, segment.asn),
		   country = COALESCE(excluded.country, segment.country),
		   city = COALESCE(excluded.city, segment.city),
		   last_seen = excluded.last_seen`).run(cidr, null, null, null, null, null, null, input.provenance ?? null, input.first_seen ?? stamp, stamp);
    db.prepare(`INSERT INTO asset(segment_cidr, ip, ip_int, state, primary_name, confidence, first_seen, last_seen, discovered_at, scope)
		 VALUES(?,?,?,?,?,?,?,?,?,?)
		 ON CONFLICT(segment_cidr, ip) DO UPDATE SET
		   state = COALESCE(excluded.state, asset.state),
		   primary_name = COALESCE(excluded.primary_name, asset.primary_name),
		   scope = COALESCE(NULLIF(asset.scope, ''), excluded.scope),
		   discovered_at = COALESCE(NULLIF(asset.discovered_at, ''), excluded.discovered_at),
		   last_seen = excluded.last_seen`).run(cidr, ip, ipToInt(ip), input.state ?? "unknown", input.primary_name ?? null, input.confidence ?? null, input.first_seen ?? stamp, input.last_seen ?? stamp, input.discovered_at ?? stamp, input.scope || scopeOfIp(ip));
    const row = db.prepare("SELECT id FROM asset WHERE segment_cidr = ? AND ip = ?").get(cidr, ip);
    if (!row?.id)
        throw new Error("asset vanished after upsert");
    return row.id;
}
export function stats(db) {
    const one = (sql) => {
        const row = db.prepare(sql).get();
        return Number(Object.values(row ?? {})[0] ?? 0);
    };
    return {
        segments: one("SELECT COUNT(*) FROM segment"),
        assets: one("SELECT COUNT(*) FROM asset"),
        liveAssets: one("SELECT COUNT(*) FROM asset WHERE state = 'live'"),
        openPorts: one("SELECT COUNT(*) FROM port WHERE state = 'open'"),
        services: one("SELECT COUNT(*) FROM service"),
        fingerprints: one("SELECT COUNT(*) FROM fingerprint"),
        passiveSignals: one("SELECT COUNT(*) FROM observation WHERE provenance = 'passive'"),
        activeSignals: one("SELECT COUNT(*) FROM observation WHERE provenance = 'active'"),
        vulns: one("SELECT COUNT(*) FROM vuln"),
        credentials: one("SELECT COUNT(*) FROM credential"),
        accesses: one("SELECT COUNT(*) FROM access_session"),
        untestedAssets: one("SELECT COUNT(*) FROM asset WHERE COALESCE(test_status, 'untested') = 'untested'"),
        blockedAssets: one("SELECT COUNT(*) FROM asset WHERE COALESCE(test_status, '') = 'blocked' OR blocked_count > 0"),
    };
}
export function getAssetRow(db, assetId) {
    const row = db.prepare("SELECT * FROM asset WHERE id = ?").get(Number(assetId));
    return row ? row : undefined;
}
export function listAssets(db, filters = {}) {
    const where = [];
    const args = [];
    if (filters.cidr) {
        where.push("a.segment_cidr = ?");
        args.push(filters.cidr);
    }
    if (filters.state) {
        where.push("a.state = ?");
        args.push(filters.state);
    }
    if (filters.ip) {
        where.push("a.ip = ?");
        args.push(filters.ip);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const openPorts = "COALESCE((SELECT COUNT(*) FROM port p WHERE p.asset_id = a.id AND p.state = 'open'), 0)";
    const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM asset a ${clause}`).get(...args);
    const total = Number(totalRow?.n ?? 0);
    const sort = filters.sort ?? "ip";
    let orderBy = "a.ip_int";
    if (sort === "ports")
        orderBy = `${openPorts} DESC, a.ip_int`;
    else if (sort === "discovered")
        orderBy = "COALESCE(a.discovered_at, a.first_seen, '') DESC, a.id DESC";
    const limit = Math.min(Number(filters.limit) || 200, 2000);
    const offset = Number(filters.offset) || 0;
    const rows = db
        .prepare(`SELECT a.*, ${openPorts} AS open_port_count FROM asset a ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
        .all(...args, limit, offset);
    return { total, sort, items: rows };
}
