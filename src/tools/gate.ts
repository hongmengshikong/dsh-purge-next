/**
 * M1 门禁：对钉死的宿主快照跑 status，要求「必需补丁」全绿。
 *
 * 判定口径（与旧仓库 host-verify.mjs 一致）：
 *   - 必需 = optional !== true 且 surfaces 含 web 且文件键在 manifest 里
 *   - 必需补丁 status 必须是 applied 或 pending
 *   - drifted 一律让门禁失败
 *   - 另外与旧仓库 patchStatus 的期望快照逐 id 对比，防移植回归
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPatchTables } from "../engine/load.js";
import { appliesOnWeb, computeStatus } from "../engine/status.js";
import type { CompiledPatch, PatchOutcome } from "../engine/types.js";

interface ExpectedFile {
	status: Record<string, PatchOutcome>;
	paths: Record<string, string[]>;
}

interface Manifest {
	files: { key: string; role: string }[];
}

interface Diff {
	id: number;
	want: PatchOutcome;
	got: PatchOutcome | undefined;
}

/** lib/tools/gate.js → 仓库根 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function argValue(name: string, fallback: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	return value && !value.startsWith("--") ? value : fallback;
}

const HOST = argValue("--host", "0.2.2-rc.1");
const asJson = process.argv.includes("--json");

const fixture = join(ROOT, "tests", "fixtures", `host-${HOST}`);
if (!existsSync(join(fixture, "expected-status.json"))) {
	console.error(`缺少宿主快照：${fixture}`);
	console.error("先跑 npm run fixture:fetch（从旧仓库 hosts/ 复制，不入库）。");
	process.exit(2);
}
const expected = JSON.parse(readFileSync(join(fixture, "expected-status.json"), "utf8")) as ExpectedFile;
const manifest = JSON.parse(readFileSync(join(fixture, "manifest.json"), "utf8")) as Manifest;

const tables = loadPatchTables(join(ROOT, "patches"));
const got = computeStatus(tables, expected.paths, fixture);
const pinned = new Set(manifest.files.filter((file) => file.role === "host").map((file) => file.key));

const diffs: Diff[] = [];
for (const [id, want] of Object.entries(expected.status)) {
	const mine = got.status[Number(id)];
	if (mine !== want) diffs.push({ id: Number(id), want, got: mine });
}

function keysOf(patch: CompiledPatch): string[] {
	return Array.isArray(patch.file) ? patch.file : [patch.file];
}

const required = tables.all.filter((patch) => {
	if (patch.optional === true) return false;
	if (!appliesOnWeb(patch)) return false;
	if (!keysOf(patch).some((key) => pinned.has(key))) return false;
	return got.status[patch.id] !== "na";
});
const bad = required.filter((patch) => {
	const status = got.status[patch.id];
	return status !== "applied" && status !== "pending";
});
const drifted = tables.all.filter((patch) => got.status[patch.id] === "drifted");
const missing = tables.all.filter((patch) => got.status[patch.id] === "missing_file");
const skipped = tables.all.filter((patch) => got.status[patch.id] === "skipped");

const report = {
	host: HOST,
	counts: got.counts,
	required: required.length,
	required_bad: bad.map((patch) => ({ id: patch.id, name: patch.name, status: got.status[patch.id] })),
	drifted: drifted.map((patch) => ({ id: patch.id, name: patch.name })),
	missing: missing.map((patch) => ({ id: patch.id, name: patch.name })),
	skipped: skipped.map((patch) => ({ id: patch.id, name: patch.name })),
	parity_diffs: diffs,
	ok: diffs.length === 0 && bad.length === 0 && drifted.length === 0,
};

if (asJson) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`host ${HOST}  status: ${JSON.stringify(got.counts)}`);
	console.log(
		`required ${required.length} / bad ${bad.length} / drifted ${drifted.length} / missing ${missing.length} / skipped ${skipped.length}`,
	);
	for (const patch of bad) console.log(`  BAD      #${patch.id} ${patch.name} -> ${got.status[patch.id]}`);
	for (const patch of drifted) console.log(`  DRIFTED  #${patch.id} ${patch.name}`);
	for (const diff of diffs) console.log(`  DIFF     #${diff.id} expected ${diff.want} got ${diff.got}`);
	console.log(report.ok ? "GATE PASS" : "GATE FAIL");
}
process.exit(report.ok ? 0 : 1);
