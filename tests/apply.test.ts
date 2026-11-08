import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyPatchesToRoot, applyReplacementsToText, rollupPatchStatus } from "../src/engine/apply.js";
import { revertRoot } from "../src/engine/revert.js";
import { loadPatchTables } from "../src/engine/load.js";
import { appliesOnWeb, computeStatus } from "../src/engine/status.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "core.js");
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FIXTURE = join(ROOT, "tests", "fixtures", "host-0.2.2-rc.1");
const HAS_FIXTURE = existsSync(join(FIXTURE, "expected-status.json"));

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function copyFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-apply-"));
	dirs.push(dir);
	cpSync(FIXTURE, dir, { recursive: true });
	return dir;
}

function hashTree(root: string, rels: string[]): string {
	const hash = createHash("sha256");
	for (const rel of [...rels].sort()) {
		const fp = join(root, rel);
		if (!existsSync(fp)) continue;
		hash.update(rel).update("\0").update(readFileSync(fp)).update("\0");
	}
	return hash.digest("hex");
}

describe.skipIf(!HAS_FIXTURE)("apply", () => {
	it("applyReplacementsToText 与旧实现逐文件一致", async () => {
		if (!existsSync(OLD_CORE)) return;
		const old = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			applyReplacementsToText(text: string, patch: unknown, fp?: string): { text: string; changed: boolean; hitMismatch?: unknown };
			ALL_PATCHES: unknown[];
		};
		const tables = loadPatchTables(join(ROOT, "patches"));
		const expected = JSON.parse(readFileSync(join(FIXTURE, "expected-status.json"), "utf8")) as {
			paths: Record<string, string[]>;
		};
		const oldPatches = new Map<number, unknown>(
			(old.ALL_PATCHES as { id: number }[]).map((patch) => [Number(patch.id), patch]),
		);

		let compared = 0;
		for (const patch of tables.all) {
			if (!appliesOnWeb(patch)) continue;
			const keys = Array.isArray(patch.file) ? patch.file : [patch.file];
			for (const key of keys) {
				for (const rel of expected.paths[key] ?? []) {
					const fp = join(FIXTURE, rel);
					if (!existsSync(fp)) continue;
					const text = readFileSync(fp, "utf8");
					const oldOut = old.applyReplacementsToText(text, oldPatches.get(patch.id), rel);
					const newOut = applyReplacementsToText(text, patch, rel);
					expect(newOut.text, `#${patch.id} ${rel}`).toBe(oldOut.text);
					expect(newOut.changed, `#${patch.id} ${rel}`).toBe(oldOut.changed);
					compared += 1;
				}
			}
		}
		expect(compared).toBeGreaterThan(40);
	});

	it("在快照副本上 apply → 无 drifted、二次 apply 幂等", () => {
		const copy = copyFixture();
		const tables = loadPatchTables(join(ROOT, "patches"));
		const expected = JSON.parse(readFileSync(join(FIXTURE, "expected-status.json"), "utf8")) as {
			paths: Record<string, string[]>;
		};
		const rels = [...new Set(Object.values(expected.paths).flat())];

		const first = applyPatchesToRoot(copy, tables, expected.paths, { write: true });
		const firstApplied = first.report.reduce((n, row) => n + row.applied, 0);
		expect(firstApplied).toBeGreaterThan(40);
		expect(first.report.filter((row) => row.status === "drifted")).toEqual([]);

		const afterFirst = hashTree(copy, rels);
		const second = applyPatchesToRoot(copy, tables, expected.paths, { write: true });
		expect(second.report.reduce((n, row) => n + row.applied, 0)).toBe(0);
		expect(second.report.filter((row) => row.status === "drifted")).toEqual([]);
		expect(hashTree(copy, rels)).toBe(afterFirst);

		const status = computeStatus(tables, expected.paths, copy);
		expect(status.status[1]).toBe("applied");
	});

	it("apply → revert 后与快照 sha256 全等，且不残留 bak", () => {
		const copy = copyFixture();
		const tables = loadPatchTables(join(ROOT, "patches"));
		const expected = JSON.parse(readFileSync(join(FIXTURE, "expected-status.json"), "utf8")) as {
			paths: Record<string, string[]>;
		};
		const rels = [...new Set(Object.values(expected.paths).flat())];
		const before = hashTree(FIXTURE, rels);

		applyPatchesToRoot(copy, tables, expected.paths, { write: true });
		expect(hashTree(copy, rels)).not.toBe(before);

		const result = revertRoot(copy);
		expect(result.reverted).toBeGreaterThan(40);
		expect(hashTree(copy, rels)).toBe(before);

		const leftovers = rels.filter((rel) => existsSync(join(copy, rel + ".dshpurge.bak")));
		expect(leftovers).toEqual([]);
	});

	it("rollupPatchStatus 关键分支", () => {
		expect(rollupPatchStatus({ applied: 1, already: 0, missing: 0, notFound: 0, drifted: 0, lastError: null, keyCount: 1 })).toBe("applied");
		expect(rollupPatchStatus({ applied: 0, already: 1, missing: 0, notFound: 0, drifted: 0, lastError: null, keyCount: 1 })).toBe("already");
		expect(rollupPatchStatus({ applied: 0, already: 0, missing: 0, notFound: 0, drifted: 1, lastError: null, keyCount: 1 })).toBe("drifted");
		expect(rollupPatchStatus({ applied: 0, already: 0, missing: 1, notFound: 0, drifted: 0, lastError: null, keyCount: 1 })).toBe("missing_file");
	});
});
