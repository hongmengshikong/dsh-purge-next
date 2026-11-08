/** 证据账本 + 未解决问题台账（对齐 dsh-purge 开源版 evidence-ledger.mjs）。 */
import { createHash } from "node:crypto";
export const EVIDENCE_CONFIDENCE = ["claimed", "observed", "derived", "inferred"];
export const EVIDENCE_AUTHORITY = [
    "tool-output",
    "database-record",
    "screenshot",
    "request-replay",
    "subagent-report",
    "operator-input",
];
export const CONFIDENCE_REQUIRES_VERIFICATION = new Set(["claimed", "inferred"]);
export const EVIDENCE_LEDGER_DDL = `
CREATE TABLE IF NOT EXISTS evidence (
  ev_id TEXT PRIMARY KEY,
  confidence TEXT NOT NULL CHECK(confidence IN ('claimed','observed','derived','inferred')),
  authority TEXT NOT NULL,
  operation TEXT NOT NULL,
  parameters TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL,
  raw_ref TEXT,
  limitations TEXT NOT NULL DEFAULT '[]',
  supporting_ev_ids TEXT NOT NULL DEFAULT '[]',
  recorded_by TEXT,
  recorded_at TEXT,
  source_agent TEXT,
  engagement_id TEXT
);
CREATE INDEX IF NOT EXISTS ix_evidence_operation ON evidence(operation);
CREATE INDEX IF NOT EXISTS ix_evidence_confidence ON evidence(confidence);
CREATE INDEX IF NOT EXISTS ix_evidence_engagement ON evidence(engagement_id);

CREATE TABLE IF NOT EXISTS residual_unknown (
  unk_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','investigating','blocked','contradicted','resolved')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK(severity IN ('low','medium','high','critical')),
  domain TEXT NOT NULL DEFAULT 'general',
  scope_digest TEXT,
  supporting_ev_ids TEXT NOT NULL DEFAULT '[]',
  contradicting_ev_ids TEXT NOT NULL DEFAULT '[]',
  required_authority TEXT,
  required_confidence TEXT,
  recommended_probe TEXT,
  resolution TEXT,
  recorded_by TEXT,
  recorded_at TEXT,
  resolved_at TEXT,
  engagement_id TEXT
);
CREATE INDEX IF NOT EXISTS ix_unknown_status ON residual_unknown(status);
CREATE INDEX IF NOT EXISTS ix_unknown_engagement ON residual_unknown(engagement_id);
`;
function canonicalize(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalize).join(",")}]`;
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}
function sanitizeForHash(value) {
    if (value === undefined)
        return null;
    if (typeof value === "bigint")
        return value.toString();
    if (typeof value === "function")
        return "[function]";
    if (typeof value === "symbol")
        return "[symbol]";
    if (value === null || typeof value !== "object")
        return value;
    if (Array.isArray(value))
        return value.map(sanitizeForHash);
    const out = {};
    for (const [key, item] of Object.entries(value))
        out[key] = sanitizeForHash(item);
    return out;
}
export function evidenceId(semantic) {
    return `ev_${createHash("sha256").update(canonicalize(sanitizeForHash(semantic)), "utf8").digest("hex")}`;
}
function safeJsonParse(text, fallback) {
    try {
        return JSON.parse(String(text));
    }
    catch {
        return fallback;
    }
}
function parseEvidenceRow(row) {
    return {
        ...row,
        parameters: safeJsonParse(row.parameters, {}),
        result: safeJsonParse(row.result, null),
        limitations: safeJsonParse(row.limitations, []),
        supporting_ev_ids: safeJsonParse(row.supporting_ev_ids, []),
    };
}
function parseUnknownRow(row) {
    return {
        ...row,
        supporting_ev_ids: safeJsonParse(row.supporting_ev_ids, []),
        contradicting_ev_ids: safeJsonParse(row.contradicting_ev_ids, []),
    };
}
export class EvidenceLedger {
    db;
    constructor(db) {
        this.db = db;
        this.db.exec(EVIDENCE_LEDGER_DDL);
    }
    record(input) {
        const { operation, parameters = {}, result, confidence = "observed", authority = "tool-output", limitations = [], supporting_ev_ids = [], recorded_by, source_agent, engagement_id, raw_ref, } = input;
        if (!operation || typeof operation !== "string")
            return { ok: false, error: "operation is required and must be a string" };
        if (result === undefined || result === null)
            return { ok: false, error: "result is required" };
        if (!EVIDENCE_CONFIDENCE.includes(confidence))
            return { ok: false, error: `confidence must be one of ${EVIDENCE_CONFIDENCE.join(",")}` };
        if (!EVIDENCE_AUTHORITY.includes(authority))
            return { ok: false, error: `authority must be one of ${EVIDENCE_AUTHORITY.join(",")}` };
        const semantic = {
            operation,
            parameters: sanitizeForHash(parameters),
            result: sanitizeForHash(result),
            confidence,
            authority,
            limitations,
            supporting_ev_ids: [...supporting_ev_ids].sort(),
        };
        const evId = evidenceId(semantic);
        try {
            const existing = this.db.prepare("SELECT ev_id FROM evidence WHERE ev_id = ?").get(evId);
            if (existing)
                return { ok: true, ev_id: evId, duplicate: true };
            this.db
                .prepare(`INSERT INTO evidence
           (ev_id, confidence, authority, operation, parameters, result,
            raw_ref, limitations, supporting_ev_ids,
            recorded_by, recorded_at, source_agent, engagement_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
                .run(evId, confidence, authority, operation, JSON.stringify(parameters), JSON.stringify(result), raw_ref ?? null, JSON.stringify(limitations), JSON.stringify(supporting_ev_ids), recorded_by ?? null, new Date().toISOString(), source_agent ?? null, engagement_id ?? null);
            return { ok: true, ev_id: evId, duplicate: false };
        }
        catch (error) {
            return { ok: false, error: String(error.message ?? error) };
        }
    }
    get(evId) {
        try {
            const row = this.db.prepare("SELECT * FROM evidence WHERE ev_id = ?").get(evId);
            return row ? parseEvidenceRow(row) : undefined;
        }
        catch {
            return undefined;
        }
    }
    verify(input) {
        const { operation, parameters = {}, result, confidence = "observed", authority = "tool-output", limitations = [], supporting_ev_ids = [] } = input;
        const semantic = {
            operation,
            parameters: sanitizeForHash(parameters),
            result: sanitizeForHash(result),
            confidence,
            authority,
            limitations,
            supporting_ev_ids: [...supporting_ev_ids].sort(),
        };
        const expected = evidenceId(semantic);
        const found = this.get(expected);
        return found ? { matched: true, ev_id: expected } : { matched: false, expected_ev_id: expected, actual_ev_id: null, note: "no matching evidence in ledger" };
    }
    upgrade(input) {
        const { claimed_ev_id, verified_by, verified_result } = input;
        const existing = this.get(String(claimed_ev_id ?? ""));
        if (!existing)
            return { ok: false, error: `evidence not found: ${claimed_ev_id}` };
        if (existing.confidence === "observed")
            return { ok: true, ev_id: String(claimed_ev_id) };
        if (!CONFIDENCE_REQUIRES_VERIFICATION.has(String(existing.confidence))) {
            return { ok: false, error: `confidence '${String(existing.confidence)}' does not require upgrade` };
        }
        return this.record({
            operation: String(existing.operation),
            parameters: existing.parameters,
            result: verified_result ?? existing.result,
            confidence: "observed",
            authority: existing.authority === "subagent-report" ? "tool-output" : String(existing.authority),
            limitations: existing.limitations,
            supporting_ev_ids: [...existing.supporting_ev_ids, String(claimed_ev_id)],
            recorded_by: verified_by ?? "coordinator",
            source_agent: existing.source_agent,
            engagement_id: existing.engagement_id,
        });
    }
    list(filter = {}) {
        const { operation, confidence, engagement_id, limit = 50, offset = 0 } = filter;
        const conditions = [];
        const params = [];
        if (operation) {
            conditions.push("operation = ?");
            params.push(operation);
        }
        if (confidence) {
            conditions.push("confidence = ?");
            params.push(confidence);
        }
        if (engagement_id) {
            conditions.push("engagement_id = ?");
            params.push(engagement_id);
        }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        try {
            const rows = this.db.prepare(`SELECT * FROM evidence ${where} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
            return rows.map(parseEvidenceRow);
        }
        catch {
            return [];
        }
    }
    countUnverified(engagement_id) {
        try {
            const row = this.db.prepare("SELECT COUNT(*) AS n FROM evidence WHERE confidence IN ('claimed','inferred') AND engagement_id = ?").get(engagement_id);
            return Number(row?.n ?? 0);
        }
        catch {
            return 0;
        }
    }
    countUnresolvedClaims(engagement_id) {
        try {
            const rows = this.db.prepare("SELECT ev_id FROM evidence WHERE confidence IN ('claimed','inferred') AND engagement_id = ?").all(engagement_id);
            if (rows.length === 0)
                return 0;
            const closed = new Set();
            const observed = this.db.prepare("SELECT supporting_ev_ids FROM evidence WHERE confidence = 'observed' AND engagement_id = ?").all(engagement_id);
            for (const row of observed) {
                let ids = [];
                try {
                    ids = JSON.parse(row.supporting_ev_ids);
                }
                catch {
                    /* 忽略坏数据 */
                }
                for (const id of ids)
                    closed.add(id);
            }
            return rows.filter((row) => !closed.has(row.ev_id)).length;
        }
        catch {
            return 0;
        }
    }
}
export class UnknownRegistry {
    db;
    constructor(db) {
        this.db = db;
        this.db.exec(EVIDENCE_LEDGER_DDL);
    }
    record(input) {
        const { question, severity = "medium", domain = "general", recommended_probe, supporting_ev_ids = [], engagement_id, recorded_by = "coordinator" } = input;
        if (!question || typeof question !== "string")
            return { ok: false, error: "question is required" };
        if (!["low", "medium", "high", "critical"].includes(severity))
            return { ok: false, error: "severity must be low|medium|high|critical" };
        const unkId = `unk_${createHash("sha256").update(canonicalize({ question: question.replace(/\s+/gu, " ").trim(), domain })).digest("hex")}`;
        try {
            const existing = this.db.prepare("SELECT unk_id FROM residual_unknown WHERE unk_id = ?").get(unkId);
            if (existing)
                return { ok: true, unk_id: unkId, duplicate: true };
            this.db
                .prepare(`INSERT INTO residual_unknown
           (unk_id, revision, question, status, severity, domain,
            supporting_ev_ids, recommended_probe, recorded_by, recorded_at, engagement_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
                .run(unkId, 1, question.trim(), "open", severity, domain, JSON.stringify(supporting_ev_ids), recommended_probe ?? null, recorded_by, new Date().toISOString(), engagement_id ?? null);
            return { ok: true, unk_id: unkId, duplicate: false };
        }
        catch (error) {
            return { ok: false, error: String(error.message ?? error) };
        }
    }
    resolve(unkId, disposition, resolution, resolvedBy = "coordinator") {
        void resolvedBy;
        if (!["resolved", "contradicted", "withdrawn"].includes(disposition))
            return { ok: false, error: "disposition must be resolved|contradicted|withdrawn" };
        try {
            this.db.prepare("UPDATE residual_unknown SET status = ?, resolution = ?, resolved_at = ? WHERE unk_id = ?").run(disposition, resolution ?? null, new Date().toISOString(), unkId);
            return { ok: true, unk_id: unkId };
        }
        catch (error) {
            return { ok: false, error: String(error.message ?? error) };
        }
    }
    list(filter = {}) {
        const { status, severity, engagement_id, limit = 50, offset = 0 } = filter;
        const conditions = [];
        const params = [];
        if (status) {
            conditions.push("status = ?");
            params.push(status);
        }
        if (severity) {
            conditions.push("severity = ?");
            params.push(severity);
        }
        if (engagement_id) {
            conditions.push("engagement_id = ?");
            params.push(engagement_id);
        }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        try {
            const rows = this.db.prepare(`SELECT * FROM residual_unknown ${where} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
            return rows.map(parseUnknownRow);
        }
        catch {
            return [];
        }
    }
}
