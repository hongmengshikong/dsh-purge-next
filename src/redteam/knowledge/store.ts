/** 全局 POC/EXP 知识库（跨靶标共享），对齐 dsh-purge 1.1.71 的 knowledge.db。 */
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve, sep } from "node:path";
import {
	KNOWLEDGE_DDL,
	KNOWLEDGE_MIGRATIONS,
	KNOWLEDGE_POST_INDEXES,
	POC_CATEGORIES,
	POC_FTS_DDL,
	POC_KINDS,
	POC_SOURCES,
	defaultPocFilename,
	pocCategoryName,
	slugPoc,
	type PocCategory,
} from "./schema.js";
import { nowIso } from "../store/engagement.js";

export interface KnowledgeHandle {
	db: DatabaseSync;
	hasFts: boolean;
}

const handles = new Map<string, KnowledgeHandle>();

function knowledgePath(root: string): string {
	return join(root, "knowledge.db");
}

export function pocsDirOf(root: string): string {
	return join(root, "pocs");
}

function within(child: string, parent: string): string {
	const target = resolve(child);
	const base = resolve(parent);
	if (target !== base && !target.startsWith(base + sep)) throw new Error(`path outside pocs/: ${child}`);
	return target;
}

export function openKnowledge(root: string): KnowledgeHandle {
	const key = resolve(root);
	const cached = handles.get(key);
	if (cached) return cached;
	mkdirSync(root, { recursive: true });
	mkdirSync(pocsDirOf(root), { recursive: true });
	const db = new DatabaseSync(knowledgePath(root));
	db.exec(KNOWLEDGE_DDL);
	const columns = new Set((db.prepare("PRAGMA table_info(poc)").all() as { name: string }[]).map((row) => row.name));
	for (const migration of KNOWLEDGE_MIGRATIONS) {
		if (!columns.has(migration.column)) db.exec(migration.ddl);
	}
	db.exec(KNOWLEDGE_POST_INDEXES);
	let hasFts = true;
	try {
		db.exec(POC_FTS_DDL);
	} catch {
		hasFts = false;
	}
	const handle = { db, hasFts };
	handles.set(key, handle);
	return handle;
}

export function closeKnowledge(root: string): void {
	const key = resolve(root);
	const handle = handles.get(key);
	if (!handle) return;
	try {
		handle.db.close();
	} catch {
		/* 已关闭 */
	}
	handles.delete(key);
}

function reindex(handle: KnowledgeHandle, pocId: number): void {
	if (!handle.hasFts) return;
	const db = handle.db;
	db.prepare("DELETE FROM poc_fts WHERE poc_id = ?").run(String(pocId));
	const row = db.prepare("SELECT * FROM poc WHERE id = ?").get(pocId) as Record<string, unknown> | undefined;
	if (!row) return;
	db.prepare("INSERT INTO poc_fts(poc_id, title, cve, component, versions, tags, description, content) VALUES(?,?,?,?,?,?,?,?)").run(
		String(row.id),
		String(row.title ?? ""),
		String(row.cve ?? ""),
		String(row.component ?? ""),
		String(row.versions ?? ""),
		String(row.tags ?? ""),
		String(row.description ?? ""),
		String(row.content ?? ""),
	);
}

export interface PocInput {
	code?: string;
	title?: string;
	kind?: string;
	category?: string;
	cve?: string;
	component?: string;
	versions?: string;
	severity?: string;
	language?: string;
	source?: string;
	source_url?: string;
	description?: string;
	usage?: string;
	content?: string;
	path?: string;
	filename?: string;
	verified?: boolean | number | null;
	verified_note?: string;
	tags?: string;
	engagement_id?: string;
	engagement_name?: string;
	asset_target?: string;
	found_by_agent?: string;
	created_by?: string;
}

export interface PocRow extends Record<string, unknown> {
	id: number;
	code: string;
	title: string;
}

export function savePoc(root: string, input: PocInput): { poc: PocRow; created: boolean; path: string | null } {
	const { db } = openKnowledge(root);
	const title = String(input.title || "").trim();
	if (title === "") throw new Error("poc.title required（写清是什么漏洞/组件的 POC）");
	const kind = (POC_KINDS as readonly string[]).includes(String(input.kind)) ? String(input.kind) : String(input.kind || "").toLowerCase() === "exp" ? "exp" : "poc";
	const source = (POC_SOURCES as readonly string[]).includes(String(input.source)) ? String(input.source) : "self";
	const rawCode = String(input.code || "").trim();
	const code = rawCode === "" ? slugPoc(title, input.cve) : rawCode.replace(/[^\w.\u4e00-\u9fa5-]+/g, "-").replace(/^[.-]+/, "");
	if (code === "") throw new Error("poc.code invalid（净化后为空，请用字母/数字/中文/短横线）");

	const dir = within(join(pocsDirOf(root), code), pocsDirOf(root));
	mkdirSync(dir, { recursive: true });

	let content = typeof input.content === "string" ? input.content : "";
	if (content === "" && typeof input.path === "string" && input.path.length > 0) {
		const src = isAbsolute(input.path) ? input.path : join(pocsDirOf(root), input.path);
		if (!existsSync(src)) throw new Error(`poc content or existing path required: ${input.path}`);
		content = readFileSync(src, "utf8");
	}
	let filePath: string | null = null;
	if (content !== "") {
		const filename = String(input.filename || "").trim().replace(/[/\\]/g, "-") || defaultPocFilename(title, kind, input.language);
		filePath = within(join(dir, filename), pocsDirOf(root));
		writeFileSync(filePath, content, "utf8");
	}

	const existing = db.prepare("SELECT * FROM poc WHERE code = ?").get(code) as Record<string, unknown> | undefined;
	const verified =
		input.verified === undefined || input.verified === null ? (existing ? Number(existing.verified ?? 0) : 0) : input.verified ? 1 : 0;
	const rawCategory = String(input.category || (existing ? existing.category : "") || "").trim();
	const category = rawCategory === "" ? "other" : POC_CATEGORIES.some((item) => item.code === rawCategory) ? rawCategory : "other";
	const now = nowIso();
	const put = (value: unknown): SQLInputValue => {
		if (value === undefined || value === null) return null;
		if (typeof value === "boolean") return value ? 1 : 0;
		if (typeof value === "number" || typeof value === "string" || value instanceof Uint8Array) return value;
		return String(value);
	};

	db.prepare(
		`INSERT INTO poc(code, title, kind, category, cve, component, versions, severity, language, source, source_url,
        description, usage, content, path, verified, verified_note, hit_count, used_on, tags,
        engagement_id, engagement_name, asset_target, found_by_agent, created_by, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(code) DO UPDATE SET
        title = excluded.title, kind = excluded.kind, category = excluded.category,
        cve = COALESCE(excluded.cve, poc.cve),
        component = COALESCE(excluded.component, poc.component), versions = COALESCE(excluded.versions, poc.versions),
        severity = COALESCE(excluded.severity, poc.severity), language = COALESCE(excluded.language, poc.language),
        source = excluded.source, source_url = COALESCE(excluded.source_url, poc.source_url),
        description = COALESCE(excluded.description, poc.description), usage = COALESCE(excluded.usage, poc.usage),
        content = CASE WHEN excluded.content <> '' THEN excluded.content ELSE poc.content END,
        path = COALESCE(excluded.path, poc.path),
        verified = excluded.verified, verified_note = COALESCE(excluded.verified_note, poc.verified_note),
        engagement_id = COALESCE(excluded.engagement_id, poc.engagement_id),
        engagement_name = COALESCE(excluded.engagement_name, poc.engagement_name),
        asset_target = COALESCE(excluded.asset_target, poc.asset_target),
        found_by_agent = COALESCE(excluded.found_by_agent, poc.found_by_agent),
        tags = COALESCE(excluded.tags, poc.tags), updated_at = excluded.updated_at`,
	).run(
		code,
		title,
		kind,
		category,
		put(input.cve),
		put(input.component),
		put(input.versions),
		put(input.severity),
		put(input.language),
		source,
		put(input.source_url),
		put(input.description),
		put(input.usage),
		content,
		filePath,
		verified,
		put(input.verified_note),
		existing ? Number(existing.hit_count ?? 0) : 0,
		existing ? (existing.used_on as SQLInputValue) : null,
		put(input.tags),
		put(input.engagement_id),
		put(input.engagement_name),
		put(input.asset_target),
		put(input.found_by_agent),
		put(input.created_by),
		existing ? String(existing.created_at) : now,
		now,
	);
	const row = db.prepare("SELECT * FROM poc WHERE code = ?").get(code) as unknown as PocRow;
	reindex(openKnowledge(root), row.id);
	return { poc: row, created: existing === undefined, path: filePath };
}

export interface PocFilters {
	q?: string;
	query?: string;
	cve?: string;
	component?: string;
	kind?: string;
	category?: string;
	engagement?: string;
	asset_target?: string;
	language?: string;
	source?: string;
	tag?: string;
	verified?: boolean | number;
	limit?: number;
}

export function searchPocs(root: string, filters: PocFilters = {}): Record<string, unknown>[] {
	const { db, hasFts } = openKnowledge(root);
	const where: string[] = [];
	const args: SQLInputValue[] = [];
	const q = String(filters.q || filters.query || "").trim();
	if (q !== "") {
		const match = q
			.split(/\s+/)
			.filter(Boolean)
			.map((token) => `"${token.replace(/"/g, "")}"`)
			.join(" AND ");
		let ids: number[] = [];
		if (hasFts) {
			try {
				ids = (db.prepare("SELECT poc_id FROM poc_fts WHERE poc_fts MATCH ? LIMIT 200").all(match) as { poc_id: string }[]).map((row) => Number(row.poc_id));
			} catch {
				ids = [];
			}
		}
		if (ids.length === 0) {
			const like = `%${q}%`;
			ids = (
				db
					.prepare(
						`SELECT id FROM poc WHERE title LIKE ? OR cve LIKE ? OR component LIKE ?
             OR versions LIKE ? OR tags LIKE ? OR description LIKE ? OR content LIKE ? LIMIT 200`,
					)
					.all(like, like, like, like, like, like, like) as { id: number }[]
			).map((row) => row.id);
		}
		if (ids.length === 0) return [];
		where.push(`id IN (${ids.map(() => "?").join(",")})`);
		args.push(...ids);
	}
	if (filters.cve) {
		where.push("cve LIKE ?");
		args.push(`%${String(filters.cve)}%`);
	}
	if (filters.component) {
		where.push("component LIKE ?");
		args.push(`%${String(filters.component)}%`);
	}
	if (filters.kind) {
		where.push("kind = ?");
		args.push(String(filters.kind));
	}
	if (filters.category) {
		const list = String(filters.category)
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
		if (list.length > 1) {
			where.push(`COALESCE(NULLIF(category, ''), 'other') IN (${list.map(() => "?").join(",")})`);
			args.push(...list);
		} else if (list.length === 1) {
			where.push("COALESCE(NULLIF(category, ''), 'other') = ?");
			args.push(list[0] as string);
		}
	}
	if (filters.engagement) {
		where.push("(engagement_id = ? OR engagement_name LIKE ?)");
		args.push(String(filters.engagement), `%${String(filters.engagement)}%`);
	}
	if (filters.asset_target) {
		where.push("asset_target LIKE ?");
		args.push(`%${String(filters.asset_target)}%`);
	}
	if (filters.language) {
		where.push("language = ?");
		args.push(String(filters.language));
	}
	if (filters.source) {
		where.push("source = ?");
		args.push(String(filters.source));
	}
	if (filters.tag) {
		where.push("tags LIKE ?");
		args.push(`%${String(filters.tag)}%`);
	}
	if (filters.verified === true || filters.verified === 1) where.push("verified = 1");
	const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
	const limit = Math.min(Number(filters.limit) || 200, 1000);
	return db
		.prepare(
			`SELECT id, code, title, kind, category, cve, component, versions, severity, language, source, source_url,
        description, usage, path, verified, verified_note, hit_count, used_on, tags,
        engagement_id, engagement_name, asset_target, found_by_agent, created_by, created_at, updated_at,
        LENGTH(COALESCE(content, '')) AS content_bytes,
        CASE WHEN COALESCE(content, '') = '' THEN 0 ELSE 1 END AS has_content
      FROM poc ${clause} ORDER BY verified DESC, hit_count DESC, updated_at DESC, id DESC LIMIT ?`,
		)
		.all(...args, limit) as Record<string, unknown>[];
}

export function getPoc(root: string, key: string | number | undefined | null): (PocRow & { content: string }) | undefined {
	const { db } = openKnowledge(root);
	const raw = String(key ?? "").trim();
	if (raw === "") return undefined;
	const numeric = Number(raw);
	const row = (Number.isFinite(numeric) && String(numeric) === raw
		? db.prepare("SELECT * FROM poc WHERE id = ?").get(numeric)
		: db.prepare("SELECT * FROM poc WHERE code = ?").get(raw)) as Record<string, unknown> | undefined;
	if (!row) return undefined;
	let content = String(row.content ?? "");
	if (content === "" && row.path) {
		try {
			content = readFileSync(within(String(row.path), pocsDirOf(root)), "utf8");
		} catch {
			content = "";
		}
	}
	return { ...(row as unknown as PocRow), content };
}

export function markPocUsed(root: string, key: string | number, usedOn?: string): { ok: boolean; id?: number; code?: string; hit_count?: number; error?: string } {
	const { db } = openKnowledge(root);
	const row = getPoc(root, key);
	if (!row) return { ok: false, error: `poc not found: ${key}` };
	db.prepare("UPDATE poc SET hit_count = COALESCE(hit_count, 0) + 1, used_on = ?, updated_at = ? WHERE id = ?").run(usedOn ?? null, nowIso(), row.id);
	return { ok: true, id: row.id, code: row.code, hit_count: Number(row.hit_count ?? 0) + 1 };
}

export function updatePoc(root: string, key: string | number, patch: Partial<PocInput>): PocRow & { content: string } {
	const { db } = openKnowledge(root);
	const row = getPoc(root, key);
	if (!row) throw new Error(`poc not found: ${key}`);
	const next = {
		title: patch.title ?? row.title,
		kind: patch.kind ?? row.kind,
		category: patch.category ?? row.category,
		cve: patch.cve ?? row.cve,
		component: patch.component ?? row.component,
		versions: patch.versions ?? row.versions,
		severity: patch.severity ?? row.severity,
		language: patch.language ?? row.language,
		source: patch.source ?? row.source,
		source_url: patch.source_url ?? row.source_url,
		description: patch.description ?? row.description,
		usage: patch.usage ?? row.usage,
		verified: patch.verified === undefined || patch.verified === null ? Number(row.verified ?? 0) : patch.verified ? 1 : 0,
		verified_note: patch.verified_note ?? row.verified_note,
		tags: patch.tags ?? row.tags,
		engagement_id: patch.engagement_id ?? row.engagement_id,
		engagement_name: patch.engagement_name ?? row.engagement_name,
		asset_target: patch.asset_target ?? row.asset_target,
		found_by_agent: patch.found_by_agent ?? row.found_by_agent,
		content: typeof patch.content === "string" && patch.content !== "" ? patch.content : row.content,
		path: row.path as string | null,
	};
	if (next.content !== row.content) {
		const dir = join(pocsDirOf(root), row.code);
		mkdirSync(dir, { recursive: true });
		next.path = join(dir, row.path ? basename(String(row.path)) : "poc.txt");
		writeFileSync(next.path, next.content || "", "utf8");
	}
	db.prepare(
		`UPDATE poc SET title = ?, kind = ?, category = ?, cve = ?, component = ?, versions = ?, severity = ?, language = ?,
      source = ?, source_url = ?, description = ?, usage = ?, verified = ?, verified_note = ?, tags = ?,
      engagement_id = ?, engagement_name = ?, asset_target = ?, found_by_agent = ?, content = ?, path = ?, updated_at = ?
      WHERE id = ?`,
	).run(
		String(next.title),
		String(next.kind ?? ""),
		String(next.category ?? ""),
		next.cve as SQLInputValue,
		next.component as SQLInputValue,
		next.versions as SQLInputValue,
		next.severity as SQLInputValue,
		next.language as SQLInputValue,
		String(next.source ?? ""),
		next.source_url as SQLInputValue,
		next.description as SQLInputValue,
		next.usage as SQLInputValue,
		Number(next.verified),
		next.verified_note as SQLInputValue,
		next.tags as SQLInputValue,
		next.engagement_id as SQLInputValue,
		next.engagement_name as SQLInputValue,
		next.asset_target as SQLInputValue,
		next.found_by_agent as SQLInputValue,
		String(next.content ?? ""),
		next.path,
		nowIso(),
		row.id,
	);
	reindex(openKnowledge(root), row.id);
	return getPoc(root, row.id) as PocRow & { content: string };
}

export function deletePoc(root: string, key: string | number): { ok: boolean; id?: number; code?: string; deleted?: boolean; removed_files?: number; error?: string } {
	const { db, hasFts } = openKnowledge(root);
	const row = getPoc(root, key);
	if (!row) return { ok: false, error: `poc not found: ${key}` };
	db.prepare("DELETE FROM poc WHERE id = ?").run(row.id);
	if (hasFts) db.prepare("DELETE FROM poc_fts WHERE poc_id = ?").run(String(row.id));
	let removedFiles = 0;
	try {
		const dir = join(pocsDirOf(root), row.code);
		if (existsSync(dir) && resolve(dir).startsWith(resolve(pocsDirOf(root)))) {
			removedFiles = readdirSync(dir).length;
			rmSync(dir, { recursive: true, force: true });
		}
	} catch {
		/* 忽略 */
	}
	return { ok: true, id: row.id, code: row.code, deleted: true, removed_files: removedFiles };
}

export interface PocStats {
	total: number;
	verified: number;
	withContent: number;
	reused: number;
	uncategorized: number;
	earliest: unknown;
	latest: unknown;
	byKind: unknown[];
	bySource: unknown[];
	byCategory: (PocCategory & { n: number; verified: number })[];
	byEngagement: unknown[];
	topAssets: unknown[];
	topComponents: unknown[];
	categories: PocCategory[];
	dbPath: string;
}

export function pocStats(root: string): PocStats {
	const { db } = openKnowledge(root);
	const one = (sql: string): unknown => Object.values((db.prepare(sql).get() as Record<string, unknown>) || {})[0] ?? 0;
	const byKind = db.prepare("SELECT COALESCE(kind, 'poc') AS kind, COUNT(*) AS n FROM poc GROUP BY kind ORDER BY n DESC").all() as unknown[];
	const bySource = db.prepare("SELECT COALESCE(source, 'self') AS source, COUNT(*) AS n FROM poc GROUP BY source ORDER BY n DESC").all() as unknown[];
	const topComponents = db
		.prepare(`SELECT component, COUNT(*) AS n FROM poc WHERE component IS NOT NULL AND component <> ''
      GROUP BY component ORDER BY n DESC, component LIMIT 12`)
		.all() as unknown[];
	const catRows = db.prepare("SELECT COALESCE(NULLIF(category, ''), 'other') AS category, COUNT(*) AS n, SUM(verified) AS verified FROM poc GROUP BY category").all() as {
		category: string;
		n: number;
		verified: number;
	}[];
	const catMap = new Map(catRows.map((row) => [row.category, row]));
	const byCategory = POC_CATEGORIES.map((item) => {
		const row = catMap.get(item.code);
		return { ...item, n: row ? row.n : 0, verified: row ? row.verified || 0 : 0 };
	});
	for (const [code, row] of catMap) {
		if (POC_CATEGORIES.some((item) => item.code === code)) continue;
		byCategory.push({ code, name: pocCategoryName(code), hint: "", n: row.n, verified: row.verified || 0 });
	}
	const byEngagement = db
		.prepare(`SELECT COALESCE(NULLIF(engagement_name, ''), NULLIF(engagement_id, ''), '(未标注来源靶标)') AS engagement,
        COUNT(*) AS n, MAX(created_at) AS latest FROM poc GROUP BY engagement ORDER BY n DESC, latest DESC LIMIT 30`)
		.all() as unknown[];
	const topAssets = db
		.prepare(`SELECT asset_target, COUNT(*) AS n FROM poc WHERE COALESCE(asset_target, '') <> ''
      GROUP BY asset_target ORDER BY n DESC, asset_target LIMIT 15`)
		.all() as unknown[];
	return {
		total: Number(one("SELECT COUNT(*) FROM poc")),
		verified: Number(one("SELECT COUNT(*) FROM poc WHERE verified = 1")),
		withContent: Number(one("SELECT COUNT(*) FROM poc WHERE COALESCE(content, '') <> ''")),
		reused: Number(one("SELECT COALESCE(SUM(hit_count), 0) FROM poc")),
		uncategorized: Number(one("SELECT COUNT(*) FROM poc WHERE COALESCE(NULLIF(category, ''), 'other') = 'other'")),
		earliest: one("SELECT MIN(created_at) FROM poc"),
		latest: one("SELECT MAX(created_at) FROM poc"),
		byKind,
		bySource,
		byCategory,
		byEngagement,
		topAssets,
		topComponents,
		categories: POC_CATEGORIES,
		dbPath: knowledgePath(root),
	};
}

export { knowledgePath };
