/**
 * 采集结果入库（importBundle 的 TS 移植）。
 *
 * 与旧仓库 store-core.js `importBundle` 对齐：单事务写
 * scan_run / segment / asset / asset_name / port / service / fingerprint /
 * observation / edge，并在 FTS5 可用时重建 asset_fts。
 */
import { nowIso } from "./engagement.js";
import { HAS_FTS5 } from "./schema.js";
import { upsertAsset } from "./assets.js";
function upsertSegment(db, seg, stamp) {
    db.prepare(`INSERT INTO segment(cidr, ip_start, ip_end, org, asn, country, city, source, first_seen, last_seen)
		 VALUES(?,?,?,?,?,?,?,?,?,?)
		 ON CONFLICT(cidr) DO UPDATE SET
		   org = COALESCE(excluded.org, segment.org),
		   asn = COALESCE(excluded.asn, segment.asn),
		   country = COALESCE(excluded.country, segment.country),
		   city = COALESCE(excluded.city, segment.city),
		   last_seen = excluded.last_seen`).run(seg.cidr, seg.ip_start ?? null, seg.ip_end ?? null, seg.org ?? null, seg.asn ?? null, seg.country ?? null, seg.city ?? null, seg.source ?? null, seg.first_seen ?? stamp, stamp);
}
function observe(db, entityKind, entityId, attr, value, provenance, tool, scanRunId, stamp) {
    db.prepare(`INSERT INTO observation(entity_kind, entity_id, attr, value, provenance, tool, scan_run_id, collected_at, raw_ref)
		 VALUES(?,?,?,?,?,?,?,?,?)`).run(entityKind, entityId, attr, value, provenance, tool, scanRunId, stamp, null);
}
function edge(db, srcKind, srcId, dstKind, dstId, relation, confidence, stamp) {
    db.prepare(`INSERT INTO edge(src_kind, src_id, dst_kind, dst_id, relation, confidence, first_seen, last_seen)
		 VALUES(?,?,?,?,?,?,?,?)
		 ON CONFLICT(src_kind, src_id, dst_kind, dst_id, relation) DO UPDATE SET last_seen = excluded.last_seen`).run(srcKind, String(srcId), dstKind, String(dstId), relation, confidence, stamp, stamp);
}
function reindex(db, assetId) {
    if (!HAS_FTS5)
        return;
    const asset = db.prepare("SELECT * FROM asset WHERE id = ?").get(assetId);
    if (!asset)
        return;
    const names = db.prepare("SELECT name FROM asset_name WHERE asset_id = ?").all(assetId)
        .map((row) => row.name)
        .join(" ");
    const banners = db.prepare("SELECT banner FROM port WHERE asset_id = ? AND banner IS NOT NULL").all(assetId)
        .map((row) => row.banner)
        .join(" ");
    const titles = db.prepare("SELECT title FROM port WHERE asset_id = ? AND title IS NOT NULL").all(assetId)
        .map((row) => row.title)
        .join(" ") +
        " " +
        db.prepare("SELECT url FROM port WHERE asset_id = ? AND url IS NOT NULL").all(assetId)
            .map((row) => row.url)
            .join(" ") +
        " " +
        db
            .prepare(`SELECT s.product, s.name, s.version FROM service s JOIN port p ON p.id = s.port_id WHERE p.asset_id = ?`)
            .all(assetId)
            .map((row) => [row.name, row.product, row.version].filter(Boolean).join(" "))
            .join(" ");
    const fingerprints = db.prepare("SELECT vendor, product, version, category FROM fingerprint WHERE asset_id = ?").all(assetId)
        .map((row) => [row.category, row.vendor, row.product, row.version].filter(Boolean).join(" "))
        .join(" ");
    db.prepare("DELETE FROM asset_fts WHERE asset_id = ?").run(String(assetId));
    db.prepare("INSERT INTO asset_fts(asset_id, ip, names, banners, titles, fingerprints) VALUES(?,?,?,?,?,?)").run(String(assetId), asset.ip ?? "", names, banners, titles, fingerprints);
}
/**
 * 采集结果入库。事务边界与旧实现一致：scan_run 也在事务内。
 */
export function ingestBundle(db, bundle, now = nowIso) {
    const counts = { segments: 0, assets: 0, ports: 0, services: 0, fingerprints: 0, names: 0, edges: 0 };
    let runId = null;
    db.exec("BEGIN");
    try {
        if (bundle.scan) {
            const stamp = now();
            const result = db
                .prepare(`INSERT INTO scan_run(agent_session_id, tool, argv, started_at, status)
					 VALUES(?,?,?,?,'completed')`)
                .run(bundle.scan.agent_session_id ?? null, bundle.scan.tool ?? null, bundle.scan.argv ? JSON.stringify(bundle.scan.argv) : null, stamp);
            runId = Number(result.lastInsertRowid ?? 0);
        }
        for (const segment of bundle.segments ?? []) {
            upsertSegment(db, segment, now());
            counts.segments += 1;
        }
        for (const asset of bundle.assets ?? []) {
            const stamp = now();
            const provenance = asset.provenance || "active";
            const tool = asset.tool || bundle.scan?.tool || null;
            const assetId = upsertAsset(db, { ...asset, provenance }, () => stamp);
            counts.assets += 1;
            for (const name of asset.names ?? []) {
                db.prepare(`INSERT INTO asset_name(asset_id, name, kind, provenance, tool, first_seen, last_seen)
					 VALUES(?,?,?,?,?,?,?)
					 ON CONFLICT(asset_id, name, kind) DO UPDATE SET last_seen = excluded.last_seen`).run(assetId, name.name, name.kind ?? "domain", name.provenance ?? provenance, tool, stamp, stamp);
                counts.names += 1;
                observe(db, "asset", assetId, "name", name.name, name.provenance ?? provenance, tool, runId, stamp);
                edge(db, "domain", name.name, "asset", assetId, "resolves", null, stamp);
            }
            if (asset.primary_name)
                observe(db, "asset", assetId, "primary_name", asset.primary_name, provenance, tool, runId, stamp);
            for (const port of asset.ports ?? []) {
                const proto = port.proto ?? "tcp";
                const portNumber = Number(port.port);
                const portProvenance = port.provenance || provenance;
                db.prepare(`INSERT INTO port(asset_id, proto, port, state, provenance, tool, banner, url, title, first_seen, last_seen)
					 VALUES(?,?,?,?,?,?,?,?,?,?,?)
					 ON CONFLICT(asset_id, proto, port) DO UPDATE SET
					   state = excluded.state,
					   banner = COALESCE(excluded.banner, port.banner),
					   url = COALESCE(excluded.url, port.url),
					   title = COALESCE(excluded.title, port.title),
					   last_seen = excluded.last_seen`).run(assetId, proto, portNumber, port.state ?? "open", portProvenance, port.tool ?? tool, port.banner ?? null, port.url ?? null, port.title ?? null, stamp, stamp);
                const portRow = db.prepare("SELECT id FROM port WHERE asset_id = ? AND proto = ? AND port = ?").get(assetId, proto, portNumber);
                if (!portRow?.id)
                    throw new Error("port vanished after upsert");
                const portId = portRow.id;
                counts.ports += 1;
                observe(db, "port", portId, "open", `${portNumber}/${proto}`, portProvenance, port.tool ?? tool, runId, stamp);
                if (port.service || port.product || port.version) {
                    db.prepare(`INSERT INTO service(port_id, name, product, version, cpe, provenance, tool, first_seen, last_seen)
						 VALUES(?,?,?,?,?,?,?,?,?)`).run(portId, port.service ?? null, port.product ?? null, port.version ?? null, port.cpe ?? null, portProvenance, port.tool ?? tool, stamp, stamp);
                    counts.services += 1;
                    observe(db, "port", portId, "service", [port.service, port.product, port.version].filter(Boolean).join(" "), portProvenance, port.tool ?? tool, runId, stamp);
                }
                for (const fingerprint of port.fingerprints ?? []) {
                    db.prepare(`INSERT INTO fingerprint(asset_id, port_id, category, vendor, product, version, evidence, confidence, provenance, tool, first_seen, last_seen)
						 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(assetId, portId, fingerprint.category ?? null, fingerprint.vendor ?? null, fingerprint.product ?? null, fingerprint.version ?? null, fingerprint.evidence ?? null, fingerprint.confidence ?? null, fingerprint.provenance ?? portProvenance, fingerprint.tool ?? tool, stamp, stamp);
                    counts.fingerprints += 1;
                    observe(db, "asset", assetId, "fingerprint", [fingerprint.category, fingerprint.vendor, fingerprint.product, fingerprint.version].filter(Boolean).join(" "), fingerprint.provenance ?? portProvenance, fingerprint.tool ?? tool, runId, stamp);
                }
            }
            reindex(db, assetId);
        }
        for (const item of bundle.edges ?? []) {
            edge(db, item.src_kind, item.src_id, item.dst_kind, item.dst_id, item.relation, item.confidence ?? null, now());
            counts.edges += 1;
        }
        db.exec("COMMIT");
    }
    catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
    return { scan_run_id: runId, counts };
}
