/**
 * 补丁应用（applyReplacementsToText / rollupPatchStatus 的 TS 移植）。
 *
 * 语义与旧 lib/core.js 一致：
 * - literal 用 split/join 全量替换；RegExp 用带 $1..$9 的字符串替换；
 * - `expect` 命中数不符 → 整条拒写（hitMismatch）；
 * - `insertProbe` 已存在则跳过（防重复插入）；
 * - `skipIfMarked` 且 patchApplied → 不再替换；
 * - YAML 文件里无缩进 identity needle 不替换；替换文本里的 `//` 注释转 `#`。
 *
 * 未移植（TODO M3）：#42 的 legacyApplyPath 折叠/重写、YAML persona 标量清理。
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CompiledPatch, CompiledReplacement, PatchTables } from "./types.js";
import { appliesOnWeb } from "./status.js";

const asLf = (text: string): string => text.replace(/\r\n/g, "\n");
const isYamlPath = (fp: string): boolean => /\.ya?ml$/i.test(fp);

function isBareIdentityNeedle(pattern: unknown): boolean {
	if (typeof pattern !== "string") return false;
	if (/^[ \t]/.test(pattern)) return false;
	return /^You are a coding agent powered by\b/.test(pattern);
}

function replacementsOf(patch: CompiledPatch): CompiledReplacement[] {
	if (Array.isArray(patch.replacements) && patch.replacements.length > 0) return patch.replacements;
	return (patch.patterns ?? []).map((pattern) => ({ pattern, replace: patch.replace ?? "" }));
}

function copyRegExp(pattern: RegExp, global: boolean): RegExp {
	const flags = String(pattern.flags || "").replace("g", "") + (global ? "g" : "");
	return new RegExp(pattern.source, flags);
}

function patchApplied(text: string, patch: CompiledPatch): boolean {
	const hay = asLf(text);
	if (Array.isArray(patch.forbid) && patch.forbid.some((marker) => hay.includes(asLf(marker)))) return false;
	if (Array.isArray(patch.markers) && patch.markers.length > 0) {
		const hit = (marker: string) => hay.includes(asLf(marker));
		return patch.markersAny ? patch.markers.some(hit) : patch.markers.every(hit);
	}
	if (typeof patch.marker === "string" && patch.marker) return hay.includes(asLf(patch.marker));
	if (typeof patch.replace === "string" && patch.replace.length > 0) {
		const firstLine = asLf(patch.replace).split("\n")[0] ?? "";
		return hay.includes(firstLine.slice(0, 60));
	}
	return false;
}

/** YAML 行尾 `//` 注释转 `#`（`!!js` 行与引号内不动）。 */
export function yamlJsCommentsToHash(text: string): string {
	return asLf(text).split("\n").map((line) => {
		if (line.includes("!!js")) return line;
		let quote = "";
		for (let i = 0; i < line.length - 1; i += 1) {
			const ch = line[i];
			if (quote) {
				if (quote === "'" && ch === "'" && line[i + 1] === "'") {
					i += 1;
					continue;
				}
				if (quote === '"' && ch === "\\") {
					i += 1;
					continue;
				}
				if (ch === quote) quote = "";
				continue;
			}
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (ch === "#") return line;
			if (ch === "/" && line[i + 1] === "/" && (i === 0 || /\s/.test(line[i - 1] ?? ""))) {
				return `${line.slice(0, i)}#${line.slice(i + 2)}`;
			}
		}
		return line;
	}).join("\n");
}

export interface HitMismatch {
	patch_id: number | undefined;
	expected: number;
	actual: number;
	file: string;
}

export interface ApplyTextResult {
	text: string;
	changed: boolean;
	hitMismatch?: HitMismatch;
}

export function applyReplacementsToText(text: string, patch: CompiledPatch, fp = ""): ApplyTextResult {
	const source = text;
	if (patch.skipIfMarked && patchApplied(source, patch)) return { text: source, changed: false };

	const crlf = source.includes("\r\n");
	const yaml = isYamlPath(fp);
	let out = asLf(source);
	let changed = false;

	for (const rep of replacementsOf(patch)) {
		const { pattern, replace } = rep;
		if (pattern === undefined || typeof replace !== "string") continue;
		if (rep.insertProbe && out.includes(rep.insertProbe)) continue;
		if (yaml && isBareIdentityNeedle(pattern)) continue;
		const written = yaml ? yamlJsCommentsToHash(asLf(replace)) : asLf(replace);

		if (pattern instanceof RegExp) {
			if (typeof rep.expect === "number") {
				const hits = (out.match(copyRegExp(pattern, true)) ?? []).length;
				if (hits !== rep.expect) {
					return { text: source, changed: false, hitMismatch: { patch_id: patch.id, expected: rep.expect, actual: hits, file: fp } };
				}
			}
			const re = copyRegExp(pattern, true);
			re.lastIndex = 0;
			if (!re.test(out)) continue;
			re.lastIndex = 0;
			const next = out.replace(re, written);
			if (next === out) continue;
			out = next;
			changed = true;
			continue;
		}

		const needle = asLf(pattern);
		if (typeof rep.expect === "number") {
			const hits = needle ? out.split(needle).length - 1 : 0;
			if (hits !== rep.expect) {
				return { text: source, changed: false, hitMismatch: { patch_id: patch.id, expected: rep.expect, actual: hits, file: fp } };
			}
		}
		if (!out.includes(needle)) continue;
		const next = out.split(needle).join(written);
		if (next === out) continue;
		out = next;
		changed = true;
	}

	return { text: crlf ? out.replace(/\n/g, "\r\n") : out, changed };
}

export interface RollupInput {
	applied: number;
	already: number;
	missing: number;
	notFound: number;
	drifted: number;
	lastError: string | null;
	keyCount: number;
	layoutSoft?: boolean;
	strictFiles?: boolean;
}

export function rollupPatchStatus(input: RollupInput): string {
	const { applied, already, missing, notFound, drifted, lastError, keyCount } = input;
	if (lastError) return lastError;
	if (input.strictFiles && notFound > 0) return "pattern_not_found";
	if (drifted > 0) return "drifted";
	if (applied > 0) return "applied";
	if (already > 0 && (notFound === 0 || input.layoutSoft)) return "already";
	if (missing === keyCount) return "missing_file";
	if (notFound === 0) return "skipped";
	return "pattern_not_found";
}

const LAYOUT_SOFT_IDS = new Set([4, 25, 26, 5, 11, 12]);
const isLayoutSoft = (patch: CompiledPatch): boolean => LAYOUT_SOFT_IDS.has(patch.id) || patch.softSettle === true;

export interface ApplyFileResult {
	applied: number;
	already: number;
	missing: number;
	notFound: number;
	drifted: number;
	selfMarked: number;
	lastError: string | null;
	paths: string[];
}

export interface ApplyOptions {
	write?: boolean;
	now?: () => number;
}

/**
 * 对一个宿主根应用补丁表。
 * @param paths 文件键 → 相对 root 的路径（fixture 映射；后续可换成 targetFiles 的实现）
 */
export function applyPatchesToRoot(
	root: string,
	tables: PatchTables,
	paths: Record<string, string[]>,
	options: ApplyOptions = {},
): { report: { id: number; name: string; status: string; applied: number; already: number; drifted: number }[]; changedFiles: string[] } {
	const write = options.write !== false;
	const report: { id: number; name: string; status: string; applied: number; already: number; drifted: number }[] = [];
	const changedFiles: string[] = [];

	for (const patch of tables.all) {
		if (!appliesOnWeb(patch)) {
			report.push({ id: patch.id, name: patch.name, status: "na", applied: 0, already: 0, drifted: 0 });
			continue;
		}
		const keys = Array.isArray(patch.file) ? patch.file : [patch.file];
		const result: ApplyFileResult = { applied: 0, already: 0, missing: 0, notFound: 0, drifted: 0, selfMarked: 0, lastError: null, paths: [] };

		for (const key of keys) {
			const files = (paths[key] ?? []).filter(Boolean);
			if (files.length === 0) {
				result.missing += 1;
				continue;
			}
			for (const rel of files) {
				const fp = join(root, rel);
				result.paths.push(fp);
				let text: string;
				try {
					text = readFileSync(fp, "utf8");
				} catch {
					result.lastError = "read_error";
					continue;
				}
				const applied = applyReplacementsToText(text, patch, rel);
				if (applied.hitMismatch) {
					result.lastError = `hit_count_mismatch:#${patch.id}:${applied.hitMismatch.actual}/${applied.hitMismatch.expected}`;
					continue;
				}
				if (applied.changed) {
					if (write) {
						const bak = `${fp}.dshpurge.bak`;
						if (!existsSync(bak)) copyFileSync(fp, bak);
						const tmp = `${fp}.dshpurge.tmp`;
						writeFileSync(tmp, applied.text, "utf8");
						renameSync(tmp, fp);
						changedFiles.push(fp);
					}
					result.applied += 1;
					continue;
				}
				// 未变化：区分 already / pending / drifted（与 status 判定同源）
				const settled = patchApplied(text, patch) || (isLayoutSoft(patch) && !hasWork(text, patch, rel));
				if (settled) result.already += 1;
				else if (hasWork(text, patch, rel)) result.notFound += 1;
				else if (isSelfMarked(patch)) result.selfMarked += 1;
				else result.drifted += 1;
			}
		}

		const status = rollupPatchStatus({
			applied: result.applied,
			already: result.already,
			missing: result.missing,
			notFound: result.notFound,
			drifted: result.drifted,
			lastError: result.lastError,
			keyCount: keys.length,
			layoutSoft: isLayoutSoft(patch),
			strictFiles: patch.strictFiles === true,
		});
		report.push({ id: patch.id, name: patch.name, status, applied: result.applied, already: result.already, drifted: result.drifted });
	}
	return { report, changedFiles };
}

function hasWork(text: string, patch: CompiledPatch, rel: string): boolean {
	const hay = asLf(text);
	const yaml = isYamlPath(rel);
	for (const rep of replacementsOf(patch)) {
		const { pattern, replace } = rep;
		if (pattern === undefined || typeof replace !== "string") continue;
		if (yaml && isBareIdentityNeedle(pattern)) continue;
		if (pattern instanceof RegExp) {
			if (copyRegExp(pattern, false).test(hay)) return true;
		} else if (hay.includes(asLf(pattern))) return true;
	}
	return false;
}

function isSelfMarked(patch: CompiledPatch): boolean {
	const reps = replacementsOf(patch);
	if (reps.length === 0) return false;
	return reps.every((rep) => {
		if (rep.pattern === undefined) return false;
		const needle = asLf(String(rep.pattern));
		return needle.includes("[dsh-purge]") || needle.includes("# dsh-purge");
	});
}

void dirname;
