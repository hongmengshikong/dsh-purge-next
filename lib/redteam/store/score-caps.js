/**
 * 得分封顶与去重（applyScoreCaps / evaluateScoreBoard 的 TS 移植）。
 *
 * 唯一口径：面板 / 报告 / 攻击链都调这里，避免三处各写一遍导致总分不一致。
 * 语义与旧 lib/redteam/score-rules.js 完全一致：
 *   dedup_scope: service | system | target | none
 *   rule + cap: 同一规则累计不超过 cap（0 = 不设上限）
 *   self_created = 1 不参与竞争、也不占位
 */
import { normalizePort, parseTargetPort } from "./score-rules.js";
import { isIpv6 } from "./ip.js";
export function targetAuthority(target) {
    const text = String(target ?? "").trim();
    if (text === "")
        return null;
    const url = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)/i.exec(text);
    const scheme = url !== null ? (url[1] ?? "").toLowerCase() : null;
    const authority = url !== null ? (url[2] ?? "") : (/^([^\s/?#]+)/.exec(text) ?? [])[1] ?? "";
    if (!authority)
        return null;
    const host = authority.replace(/:\d{1,5}$/, "").toLowerCase();
    if (host === "")
        return null;
    let port = parseTargetPort(text);
    if (port === null) {
        if (scheme === "http")
            port = 80;
        else if (scheme === "https")
            port = 443;
    }
    return port === null ? host : `${host}:${port}`;
}
export function scoreServiceKey(hit) {
    const authority = targetAuthority(hit.target);
    if (authority !== null)
        return `t${authority}`;
    const rawAsset = hit.asset_id;
    const assetId = rawAsset === null || rawAsset === undefined || rawAsset === "" ? null : Number(rawAsset);
    if (assetId === null)
        return null;
    const port = normalizePort(hit.port);
    return `a${assetId}:${port === null ? 0 : port}`;
}
export function serviceLabel(hit, assetIp) {
    const ip = assetIp || hit.asset_ip || "";
    const port = normalizePort(hit.port) ?? parseTargetPort(hit.target);
    if (ip !== "")
        return port === null ? ip : `${ip}:${port}`;
    const authority = targetAuthority(hit.target);
    if (authority === null)
        return hit.target ? String(hit.target) : "(未标注服务)";
    if (port !== null && !/:\d{1,5}$/.test(authority))
        return `${authority}:${port}`;
    return authority;
}
function legacyCapGroup(code) {
    const text = String(code ?? "").trim();
    if (text === "web-account-user" || text === "web-account-admin")
        return "service";
    return ["web-account-user", "web-account-admin", "db-access"].includes(text) ? "service" : null;
}
export function systemKeyOf(hit, nameByAsset) {
    const service = scoreServiceKey(hit);
    const serviceText = service === null || service === undefined ? "" : String(service);
    const explicit = String(hit.system_key ?? "").trim();
    if (explicit !== "" && (serviceText === "" || explicit.includes(serviceText))) {
        const head = explicit.split("|")[0] ?? "";
        if (serviceText !== "" || String(head).trim() !== "")
            return explicit;
    }
    const rawAsset = hit.asset_id;
    const assetId = rawAsset === null || rawAsset === undefined || rawAsset === "" ? null : Number(rawAsset);
    const nameOf = (id) => {
        if (id === null || !nameByAsset)
            return null;
        const raw = nameByAsset.get(id);
        const text = raw === null || raw === undefined ? "" : String(raw).trim();
        return text === "" ? null : text;
    };
    const name = nameOf(assetId);
    if (name !== null)
        return `${name}|${serviceText}`;
    if (serviceText !== "")
        return serviceText;
    return `#hit${String(hit.id ?? "0")}`;
}
export function pickBestHit(list) {
    return list.reduce((best, current) => {
        const bp = Number(best.points) || 0;
        const cp = Number(current.points) || 0;
        if (cp !== bp)
            return cp > bp ? current : best;
        return Number(current.id) < Number(best.id) ? current : best;
    }, list[0]);
}
export function applyScoreCaps(rows = [], pointsByCode, nameByAsset) {
    const metaOf = (row) => {
        let meta;
        if (pointsByCode && typeof pointsByCode === "object") {
            meta = pointsByCode instanceof Map ? pointsByCode.get(String(row.code)) : pointsByCode[String(row.code)];
        }
        const rule = meta && meta.rule !== null && meta.rule !== undefined ? Number(meta.rule) : null;
        const legacyScope = legacyCapGroup(row.code);
        return {
            group: rule === null ? `code:${String(row.code ?? "")}` : `rule:${rule}`,
            cap: meta && Number(meta.cap) > 0 ? Number(meta.cap) : 0,
            scope: ((meta && meta.dedup_scope) || legacyScope || "none"),
            rule,
        };
    };
    const flagged = (rows ?? []).map((row) => {
        const meta = metaOf(row);
        return {
            ...row,
            capped: false,
            capped_by_id: null,
            capped_reason_kind: null,
            service_key: null,
            cap_group: meta.group,
            dedup_scope: meta.scope,
            rule: meta.rule,
            rule_cap: meta.cap,
        };
    });
    // ① 计分口径去重：同口径键内只保留分值最高的一条（同分取更早记的）
    const buckets = new Map();
    for (const row of flagged) {
        if (Number(row.self_created) === 1)
            continue;
        const scope = row.dedup_scope;
        if (scope === "none" || scope === null || scope === undefined)
            continue;
        let key;
        if (scope === "target")
            key = "target";
        else if (scope === "system")
            key = `sys:${String(systemKeyOf(row, nameByAsset) || "")}`;
        else {
            const service = scoreServiceKey(row);
            if (service === null || service === undefined || String(service) === "")
                continue;
            key = `svc:${String(service)}`;
        }
        if (key === "" || key === "svc:null" || key === "sys:null")
            continue;
        const bucketKey = `${row.cap_group}|${key}`;
        if (!buckets.has(bucketKey))
            buckets.set(bucketKey, []);
        buckets.get(bucketKey)?.push(row);
    }
    let capped = 0;
    for (const list of buckets.values()) {
        if (list.length < 2)
            continue;
        const best = pickBestHit(list);
        for (const row of list) {
            if (row === best)
                continue;
            row.capped = true;
            row.capped_by_id = best.id;
            row.capped_by_points = Number(best.points) || 0;
            row.capped_by_evidence = best.evidence ?? null;
            row.capped_reason_kind = "dedup";
            capped += 1;
        }
    }
    // ② 规则上限：同一 rule 的计分命中累计不得超过 cap（按分值从高到低累计）
    const caps = new Map();
    const byRule = new Map();
    for (const row of flagged) {
        if (row.capped === true || Number(row.self_created) === 1)
            continue;
        if (row.rule_cap <= 0)
            continue;
        if (!byRule.has(row.cap_group))
            byRule.set(row.cap_group, []);
        byRule.get(row.cap_group)?.push(row);
    }
    for (const [group, list] of byRule.entries()) {
        const cap = list[0]?.rule_cap ?? 0;
        const ordered = [...list].sort((a, b) => {
            const pa = Number(a.points) || 0;
            const pb = Number(b.points) || 0;
            if (pb !== pa)
                return pb - pa;
            return Number(a.id) - Number(b.id);
        });
        let used = 0;
        let nCapped = 0;
        for (const row of ordered) {
            const points = Number(row.points) || 0;
            if (used + points > cap) {
                row.capped = true;
                row.capped_reason_kind = "cap";
                row.capped_by_points = null;
                nCapped += 1;
                capped += 1;
            }
            else {
                used += points;
            }
        }
        caps.set(group, { rule: list[0]?.rule ?? null, cap, used, capped: nCapped });
    }
    return { capped, items: flagged, caps };
}
export function loadScoreMeta(db) {
    const rows = db
        .prepare("SELECT code, rule, cap, dedup_scope, points, enabled, builtin, src FROM score_point")
        .all();
    return new Map(rows.map((row) => [
        String(row.code),
        {
            rule: row.rule === null || row.rule === undefined ? null : Number(row.rule),
            cap: Number(row.cap) || 0,
            dedup_scope: String(row.dedup_scope ?? "service"),
            points: Number(row.points) || 0,
            enabled: row.enabled === null || row.enabled === undefined ? 1 : Number(row.enabled),
            builtin: Number(row.builtin) === 1,
            src: row.src === null || row.src === undefined ? null : Number(row.src),
        },
    ]));
}
export function loadAssetNames(db) {
    const rows = db.prepare("SELECT id, primary_name FROM asset").all();
    return new Map(rows.filter((row) => row.primary_name).map((row) => [Number(row.id), String(row.primary_name)]));
}
export function hitPointsOf(hit, metaByCode) {
    let base = 0;
    const rawPoints = hit.points;
    if (rawPoints !== null && rawPoints !== undefined && rawPoints !== "")
        base = Number(rawPoints) || 0;
    else if (hit.code && metaByCode)
        base = Number(metaByCode.get(String(hit.code))?.points ?? 0) || 0;
    const multiplier = Number(hit.multiplier);
    return Math.round(base * (Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1));
}
export function evaluateScoreBoard(db, rows = [], options = {}) {
    const meta = options.meta ?? loadScoreMeta(db);
    const names = options.names ?? loadAssetNames(db);
    const prepared = (rows ?? []).map((hit) => {
        const code = hit.code === null || hit.code === undefined ? null : String(hit.code);
        const pointMeta = code === null ? undefined : meta.get(code);
        const name = hit.asset_id === null || hit.asset_id === undefined ? null : names.get(Number(hit.asset_id));
        return {
            ...hit,
            code,
            points: hit.points !== null && hit.points !== undefined && hit.points !== ""
                ? Number(hit.points) || 0
                : hitPointsOf(hit, meta),
            rule: pointMeta === undefined || pointMeta.rule === undefined ? null : pointMeta.rule,
            cap: pointMeta === undefined ? 0 : pointMeta.cap,
            dedup_scope: pointMeta === undefined ? "service" : pointMeta.dedup_scope,
            cap_group: pointMeta === undefined || pointMeta.rule === null || pointMeta.rule === undefined ? `code:${String(code)}` : `rule:${pointMeta.rule}`,
            rule_cap: pointMeta === undefined ? 0 : pointMeta.cap,
            system_key: [name ?? "", normalizePort(hit.port) ?? parseTargetPort(hit.target) ?? ""].join("|"),
        };
    });
    const evaluated = applyScoreCaps(prepared, meta, names);
    const byId = new Map(evaluated.items.map((item) => [item.id, item]));
    const disabledIds = new Set();
    if (options.enabledOnly === true) {
        for (const hit of prepared) {
            const pointMeta = hit.code === null ? undefined : meta.get(String(hit.code));
            if (pointMeta !== undefined && Number(pointMeta.enabled) !== 1)
                disabledIds.add(hit.id);
        }
    }
    return { byId, items: evaluated.items, caps: evaluated.caps, meta, names, disabledIds };
}
export function scoreCapReasonText(hit, bestPoints) {
    const label = serviceLabel(hit);
    if (hit.capped_reason_kind === "cap") {
        return (`「${label}」这条不计分：` +
            (hit.rule === null || hit.rule === undefined ? "" : `规则 ${hit.rule} `) +
            `的**累计得分已达该规则上限（${Number(hit.rule_cap) || 0} 分）**——同一规则超出上限的部分不再累加。` +
            "把精力换到别的规则或别的资产上，不要在已达上限的规则里继续刷。");
    }
    return (`「${label}」这个目标上的权限已经拿满（计分口径：同一目标只算分值最高的那条` +
        (bestPoints === undefined || bestPoints === null ? "" : `，+${bestPoints} 分`) +
        "）——这条按规则不再计分，只作过程留痕；**换目标或换规则推进，不要在同一个目标上刷同类成果**。");
}
export const serviceCapReason = scoreCapReasonText;
/** 数据规模粗判门槛（100 万条/行）。 */
export const SENSITIVE_DATA_MIN_ROWS = 1_000_000;
export function parseRowCount(evidence) {
    const text = String(evidence ?? "");
    if (text.trim() === "")
        return null;
    const units = { 亿: 1e8, 千万: 1e7, 百万: 1e6, 十万: 1e5, 万: 1e4, 千: 1e3 };
    const nums = [];
    const cn = /(\d[\d,]*(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千)?\s*(条|行|记录|数据|records?|rows?|entries)/gi;
    for (const match of text.matchAll(cn)) {
        const base = Number(String(match[1]).replace(/,/g, ""));
        if (!Number.isFinite(base))
            continue;
        const mult = match[2] === undefined ? 1 : units[match[2]] ?? 1;
        nums.push(Math.round(base * mult));
    }
    if (nums.length > 0)
        return Math.max(...nums);
    for (const match of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千)/g)) {
        const base = Number(String(match[1]).replace(/,/g, ""));
        if (Number.isFinite(base))
            nums.push(Math.round(base * (units[match[2] ?? ""] ?? 1)));
    }
    return nums.length === 0 ? null : Math.max(...nums);
}
export function formatRows(value) {
    return Number(value).toLocaleString("en-US");
}
/** 供将来扩展：IPv6 判定复用同一实现。 */
export { isIpv6 };
