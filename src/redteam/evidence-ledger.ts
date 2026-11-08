/** 证据账本 + 未解决问题台账（对齐 dsh-purge 开源版 evidence-ledger.mjs）。 */
import { createHash } from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export const EVIDENCE_CONFIDENCE = ["claimed", "observed", "derived", "inferred"] as const;
export const EVIDENCE_AUTHORITY = [
	"tool-output",
	"database-record",
	"screenshot",
	"request-replay",
	"subagent-report",
	"operator-input",
] as const;
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

type Json = unknown;

function canonicalize(value: Json): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
	const record = value as Record<string, Json>;
	const keys = Object.keys(record).sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function sanitizeForHash(value: unknown): Json {
	if (value === undefined) return null;
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "function") return "[function]";
	if (typeof value === "symbol") return "[symbol]";
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(sanitizeForHash);
	const out: Record<string, Json> = {};
	for (const [key, item] of Object.entries(value)) out[key] = sanitizeForHash(item);
	return out;
}

export function evidenceId(semantic: unknown): string {
	return `ev_${createHash("sha256").update(canonicalize(sanitizeForHash(semantic)), "utf8").digest("hex")}`;
}

function safeJsonParse<T>(text: unknown, fallback: T): T {
	try {
		return JSON.parse(String(text)) as T;
	} catch {
		return fallback;
	}
}

function parseEvidenceRow(row: Record<string, unknown>): Record<string, unknown> {
	return {
		...row,
		parameters: safeJsonParse(row.parameters, {}),
		result: safeJsonParse(row.result, null),
		limitations: safeJsonParse(row.limitations, []),
		supporting_ev_ids: safeJsonParse(row.supporting_ev_ids, []),
	};
}

function parseUnknownRow(row: Record<string, unknown>): Record<string, unknown> {
	return {
		...row,
		supporting_ev_ids: safeJsonParse(row.supporting_ev_ids, []),
		contradicting_ev_ids: safeJsonParse(row.contradicting_ev_ids, []),
	};
}

export interface EvidenceInput {
	operation?: string;
	parameters?: Record<string, unknown>;
	result?: unknown;
	confidence?: string;
	authority?: string;
	limitations?: string[];
	supporting_ev_ids?: string[];
	recorded_by?: string;
	source_agent?: string;
	engagement_id?: string;
	raw_ref?: string;
}

export class EvidenceLedger {
	constructor(private readonly db: DatabaseSync) {
		this.db.exec(EVIDENCE_LEDGER_DDL);
	}

	record(input: EvidenceInput): { ok: boolean; ev_id?: string; duplicate?: boolean; error?: string } {
		const {
			operation,
			parameters = {},
			result,
			confidence = "observed",
			authority = "tool-output",
			limitations = [],
			supporting_ev_ids = [],
			recorded_by,
			source_agent,
			engagement_id,
			raw_ref,
		} = input;
		if (!operation || typeof operation !== "string") return { ok: false, error: "operation is required and must be a string" };
		if (result === undefined || result === null) return { ok: false, error: "result is required" };
		if (!(EVIDENCE_CONFIDENCE as readonly string[]).includes(confidence)) return { ok: false, error: `confidence must be one of ${EVIDENCE_CONFIDENCE.join(",")}` };
		if (!(EVIDENCE_AUTHORITY as readonly string[]).includes(authority)) return { ok: false, error: `authority must be one of ${EVIDENCE_AUTHORITY.join(",")}` };

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
			if (existing) return { ok: true, ev_id: evId, duplicate: true };
			this.db
				.prepare(
					`INSERT INTO evidence
           (ev_id, confidence, authority, operation, parameters, result,
            raw_ref, limitations, supporting_ev_ids,
            recorded_by, recorded_at, source_agent, engagement_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
				)
				.run(
					evId,
					confidence,
					authority,
					operation,
					JSON.stringify(parameters),
					JSON.stringify(result),
					raw_ref ?? null,
					JSON.stringify(limitations),
					JSON.stringify(supporting_ev_ids),
					recorded_by ?? null,
					new Date().toISOString(),
					source_agent ?? null,
					engagement_id ?? null,
				);
			return { ok: true, ev_id: evId, duplicate: false };
		} catch (error) {
			return { ok: false, error: String((error as Error).message ?? error) };
		}
	}

	get(evId: string): Record<string, unknown> | undefined {
		try {
			const row = this.db.prepare("SELECT * FROM evidence WHERE ev_id = ?").get(evId);
			return row ? parseEvidenceRow(row as Record<string, unknown>) : undefined;
		} catch {
			return undefined;
		}
	}

	verify(input: EvidenceInput): { matched: boolean; ev_id?: string; expected_ev_id?: string; actual_ev_id?: string | null; note?: string } {
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

	upgrade(input: { claimed_ev_id?: string; verified_by?: string; verified_result?: unknown }): { ok: boolean; ev_id?: string; duplicate?: boolean; error?: string } {
		const { claimed_ev_id, verified_by, verified_result } = input;
		const existing = this.get(String(claimed_ev_id ?? ""));
		if (!existing) return { ok: false, error: `evidence not found: ${claimed_ev_id}` };
		if (existing.confidence === "observed") return { ok: true, ev_id: String(claimed_ev_id) };
		if (!CONFIDENCE_REQUIRES_VERIFICATION.has(String(existing.confidence))) {
			return { ok: false, error: `confidence '${String(existing.confidence)}' does not require upgrade` };
		}
		return this.record({
			operation: String(existing.operation),
			parameters: existing.parameters as Record<string, unknown>,
			result: verified_result ?? existing.result,
			confidence: "observed",
			authority: existing.authority === "subagent-report" ? "tool-output" : String(existing.authority),
			limitations: existing.limitations as string[],
			supporting_ev_ids: [...(existing.supporting_ev_ids as string[]), String(claimed_ev_id)],
			recorded_by: verified_by ?? "coordinator",
			source_agent: existing.source_agent as string | undefined,
			engagement_id: existing.engagement_id as string | undefined,
		});
	}

	list(filter: { operation?: string; confidence?: string; engagement_id?: string; limit?: number; offset?: number } = {}): Record<string, unknown>[] {
		const { operation, confidence, engagement_id, limit = 50, offset = 0 } = filter;
		const conditions: string[] = [];
		const params: SQLInputValue[] = [];
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
			const rows = this.db.prepare(`SELECT * FROM evidence ${where} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[];
			return rows.map(parseEvidenceRow);
		} catch {
			return [];
		}
	}

	countUnverified(engagement_id: string): number {
		try {
			const row = this.db.prepare("SELECT COUNT(*) AS n FROM evidence WHERE confidence IN ('claimed','inferred') AND engagement_id = ?").get(engagement_id) as { n?: number } | undefined;
			return Number(row?.n ?? 0);
		} catch {
			return 0;
		}
	}

	countUnresolvedClaims(engagement_id: string): number {
		try {
			const rows = this.db.prepare("SELECT ev_id FROM evidence WHERE confidence IN ('claimed','inferred') AND engagement_id = ?").all(engagement_id) as { ev_id: string }[];
			if (rows.length === 0) return 0;
			const closed = new Set<string>();
			const observed = this.db.prepare("SELECT supporting_ev_ids FROM evidence WHERE confidence = 'observed' AND engagement_id = ?").all(engagement_id) as { supporting_ev_ids: string }[];
			for (const row of observed) {
				let ids: string[] = [];
				try {
					ids = JSON.parse(row.supporting_ev_ids) as string[];
				} catch {
					/* 忽略坏数据 */
				}
				for (const id of ids) closed.add(id);
			}
			return rows.filter((row) => !closed.has(row.ev_id)).length;
		} catch {
			return 0;
		}
	}
}

export interface UnknownInput {
	question?: string;
	severity?: string;
	domain?: string;
	recommended_probe?: string;
	supporting_ev_ids?: string[];
	engagement_id?: string;
	recorded_by?: string;
}

export class UnknownRegistry {
	constructor(private readonly db: DatabaseSync) {
		this.db.exec(EVIDENCE_LEDGER_DDL);
	}

	record(input: UnknownInput): { ok: boolean; unk_id?: string; duplicate?: boolean; error?: string } {
		const { question, severity = "medium", domain = "general", recommended_probe, supporting_ev_ids = [], engagement_id, recorded_by = "coordinator" } = input;
		if (!question || typeof question !== "string") return { ok: false, error: "question is required" };
		if (!["low", "medium", "high", "critical"].includes(severity)) return { ok: false, error: "severity must be low|medium|high|critical" };
		const unkId = `unk_${createHash("sha256").update(canonicalize({ question: question.replace(/\s+/gu, " ").trim(), domain })).digest("hex")}`;
		try {
			const existing = this.db.prepare("SELECT unk_id FROM residual_unknown WHERE unk_id = ?").get(unkId);
			if (existing) return { ok: true, unk_id: unkId, duplicate: true };
			this.db
				.prepare(
					`INSERT INTO residual_unknown
           (unk_id, revision, question, status, severity, domain,
            supporting_ev_ids, recommended_probe, recorded_by, recorded_at, engagement_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
				)
				.run(unkId, 1, question.trim(), "open", severity, domain, JSON.stringify(supporting_ev_ids), recommended_probe ?? null, recorded_by, new Date().toISOString(), engagement_id ?? null);
			return { ok: true, unk_id: unkId, duplicate: false };
		} catch (error) {
			return { ok: false, error: String((error as Error).message ?? error) };
		}
	}

	resolve(unkId: string, disposition: string, resolution?: string, resolvedBy = "coordinator"): { ok: boolean; unk_id?: string; error?: string } {
		void resolvedBy;
		if (!["resolved", "contradicted", "withdrawn"].includes(disposition)) return { ok: false, error: "disposition must be resolved|contradicted|withdrawn" };
		try {
			this.db.prepare("UPDATE residual_unknown SET status = ?, resolution = ?, resolved_at = ? WHERE unk_id = ?").run(disposition, resolution ?? null, new Date().toISOString(), unkId);
			return { ok: true, unk_id: unkId };
		} catch (error) {
			return { ok: false, error: String((error as Error).message ?? error) };
		}
	}

	list(filter: { status?: string; severity?: string; engagement_id?: string; limit?: number; offset?: number } = {}): Record<string, unknown>[] {
		const { status, severity, engagement_id, limit = 50, offset = 0 } = filter;
		const conditions: string[] = [];
		const params: SQLInputValue[] = [];
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
			const rows = this.db.prepare(`SELECT * FROM residual_unknown ${where} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[];
			return rows.map(parseUnknownRow);
		} catch {
			return [];
		}
	}
}
