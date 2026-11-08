/**
 * 插件服务层：把引擎能力整理成可被 HTTP / 工具复用的纯函数。
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostApply, hostRevert, hostStatus, SUPPORTED_HOSTS, type HostApplyResult, type HostStatus } from "./engine/host.js";
import { loadPatchTables } from "./engine/load.js";
import { findAiBase, findDshHome } from "./engine/host-discovery.js";
import { seedPromptInjectAtBoot, readPromptInjectFile, saveOverrideContent, hashOverride, findOverrideFile } from "./prompt/inject.js";
import { describeUpdate, updateStatus, updateTarballUrl } from "./update/check.js";
import type { PatchTables } from "./engine/types.js";

export interface ServiceContext {
	aiBase: string | null;
	dshHome: string;
	host: string;
	tables: PatchTables | null;
}

export function defaultHost(): string {
	const env = process.env.DSH_PURGE_HOST;
	if (env && SUPPORTED_HOSTS.includes(env)) return env;
	return SUPPORTED_HOSTS[0] ?? "0.2.2-rc.1";
}

/** lib/service.js → 包根（patches/ 在包根下） */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadContext(options: { aiBase?: string | null; dshHome?: string; tables?: PatchTables | null } = {}): ServiceContext {
	const aiBase = options.aiBase !== undefined ? options.aiBase : findAiBase();
	const dshHome = options.dshHome ?? findDshHome();
	const host = defaultHost();
	let tables: PatchTables | null = options.tables ?? null;
	if (tables === null) {
		try {
			tables = loadPatchTables(join(PACKAGE_ROOT, "patches"));
		} catch {
			tables = null;
		}
	}
	return { aiBase, dshHome, host, tables };
}

export interface StatusPayload {
	[key: string]: unknown;
	ok: boolean;
	ai_base: string | null;
	dsh_home: string;
	host: string;
	counts: Record<string, number>;
	required: number;
	required_bad: { id: number; name: string; status: string }[];
	drifted: { id: number; name: string }[];
	error?: string;
}

export function statusPayload(ctx: ServiceContext): StatusPayload {
	const base: StatusPayload = {
		ok: false,
		ai_base: ctx.aiBase,
		dsh_home: ctx.dshHome,
		host: ctx.host,
		counts: {},
		required: 0,
		required_bad: [],
		drifted: [],
	};
	if (!ctx.aiBase || !existsSync(ctx.aiBase)) return { ...base, error: "ai_base_not_found" };
	if (!ctx.tables) return { ...base, error: "patches_not_loaded" };
	try {
		const status: HostStatus = hostStatus(ctx.aiBase, ctx.host, ctx.tables);
		const rows = patchesPayload(ctx).rows;
		const counts = status.counts as Record<string, number>;
		return {
			...base,
			ok: true,
			counts: status.counts,
			required: status.required.length,
			required_bad: status.requiredBad,
			drifted: status.drifted,
			/* 旧版 UI 兼容字段 */
			ready: true,
			surface: "web",
			patches_applied: counts.applied ?? 0,
			patches_pending: counts.pending ?? 0,
			patches_skipped: counts.skipped ?? 0,
			patches_drifted: status.drifted.length,
			patches_na: counts.na ?? 0,
			patches_total: rows.length,
			patch_status: Object.fromEntries(rows.map((row) => [String(row.id), row.status])),
			patches: rows.map((row) => ({ id: row.id, ids: [row.id], layer: row.layer, status: row.status })),
			patch_names: Object.fromEntries(rows.map((row) => [String(row.id), row.name])),
			host_version: ctx.host,
			plugin_version: "0.2.2-rc.1-full.1",
			has_backup: true,
			apply_progress: { active: false, kind: "apply", stage: "idle" },
		};
	} catch (error) {
		return { ...base, error: error instanceof Error ? error.message : String(error) };
	}
}

export interface ApplyPayload {
	ok: boolean;
	applied: number;
	drifted: number;
	changed_files: number;
	required: number;
	required_bad: number;
	error?: string;
}

export function applyPayload(ctx: ServiceContext): ApplyPayload {
	const empty: ApplyPayload = { ok: false, applied: 0, drifted: 0, changed_files: 0, required: 0, required_bad: 0 };
	if (!ctx.aiBase || !existsSync(ctx.aiBase)) return { ...empty, error: "ai_base_not_found" };
	if (!ctx.tables) return { ...empty, error: "patches_not_loaded" };
	try {
		const result: HostApplyResult = hostApply(ctx.aiBase, ctx.host, ctx.tables);
		const after = hostStatus(ctx.aiBase, ctx.host, ctx.tables);
		return {
			ok: result.drifted === 0 && after.requiredBad.length === 0,
			applied: result.applied,
			drifted: result.drifted,
			changed_files: result.changedFiles.length,
			required: after.required.length,
			required_bad: after.requiredBad.length,
		};
	} catch (error) {
		return { ...empty, error: error instanceof Error ? error.message : String(error) };
	}
}

export interface RevertPayload {
	ok: boolean;
	reverted: number;
	error?: string;
}

export function revertPayload(ctx: ServiceContext): RevertPayload {
	if (!ctx.aiBase || !existsSync(ctx.aiBase)) return { ok: false, reverted: 0, error: "ai_base_not_found" };
	try {
		const result = hostRevert(ctx.aiBase);
		return { ok: true, reverted: result.reverted };
	} catch (error) {
		return { ok: false, reverted: 0, error: error instanceof Error ? error.message : String(error) };
	}
}

export interface SeedPayload {
	ok: boolean;
	action: string;
	path: string;
	error?: string;
}

export function seedPayload(dshHome: string): SeedPayload {
	try {
		const result = seedPromptInjectAtBoot(dshHome);
		return { ok: result.action !== "error", action: result.action, path: result.path };
	} catch (error) {
		return { ok: false, action: "error", path: "", error: error instanceof Error ? error.message : String(error) };
	}
}

export interface UpdatePayload {
	ok: boolean;
	configured: boolean;
	channel: string;
	repo_url: string;
	tarball_url: string | null;
	note: string;
}

export function updatePayload(): UpdatePayload {
	const status = updateStatus();
	return {
		ok: status.configured,
		configured: status.configured,
		channel: status.channel,
		repo_url: status.repoUrl,
		tarball_url: updateTarballUrl(),
		note: describeUpdate(status),
	};
}

export interface PromptPayload {
	ok: boolean;
	path: string;
	content: string;
	hash: string;
}

export function readPromptPayload(dshHome: string): PromptPayload {
	const content = readPromptInjectFile(dshHome);
	return { ok: true, path: findOverrideFile(dshHome), content, hash: hashOverride(content) };
}

export function savePromptPayload(dshHome: string, content: string): PromptPayload & { saved: boolean } {
	saveOverrideContent(dshHome, content);
	const next = readPromptInjectFile(dshHome);
	return { ok: true, saved: true, path: findOverrideFile(dshHome), content: next, hash: hashOverride(next) };
}

export interface PatchRow {
	id: number;
	name: string;
	layer: string;
	status: string;
}

export interface PatchesPayload {
	ok: boolean;
	rows: PatchRow[];
	error?: string;
}

/** 逐条补丁状态（设置页表格用）。 */
export function patchesPayload(ctx: ServiceContext): PatchesPayload {
	if (!ctx.aiBase || !existsSync(ctx.aiBase)) return { ok: false, rows: [], error: "ai_base_not_found" };
	if (!ctx.tables) return { ok: false, rows: [], error: "patches_not_loaded" };
	try {
		const status = hostStatus(ctx.aiBase, ctx.host, ctx.tables);
		const rows = ctx.tables.all.map((patch) => ({
			id: patch.id,
			name: patch.name,
			layer: patch.layer ?? "",
			status: status.status[patch.id] ?? "unknown",
		}));
		return { ok: true, rows };
	} catch (error) {
		return { ok: false, rows: [], error: error instanceof Error ? error.message : String(error) };
	}
}
