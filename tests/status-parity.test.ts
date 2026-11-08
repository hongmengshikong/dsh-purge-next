import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPatchTables } from "../src/engine/load.js";
import { appliesOnWeb, computeStatus } from "../src/engine/status.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FIXTURE = join(ROOT, "tests", "fixtures", "host-0.2.2-rc.1");

const HAS_FIXTURE = existsSync(join(FIXTURE, "expected-status.json"));

describe.skipIf(!HAS_FIXTURE)("status parity（对 0.2.2-rc.1 快照）", () => {
	it("与旧仓库 patchStatus 逐 id 一致", () => {
		const expected = JSON.parse(readFileSync(join(FIXTURE, "expected-status.json"), "utf8")) as {
			status: Record<string, string>;
			paths: Record<string, string[]>;
		};
		const tables = loadPatchTables(join(ROOT, "patches"));
		const got = computeStatus(tables, expected.paths, FIXTURE);

		const diffs: [number, string, string | undefined][] = [];
		for (const [id, want] of Object.entries(expected.status)) {
			const mine = got.status[Number(id)];
			if (mine !== want) diffs.push([Number(id), want, mine]);
		}
		expect(diffs).toEqual([]);
	});

	it("必需补丁（optional!==true 且 pinned）全部 applied 或 pending，且无 drifted", () => {
		const expected = JSON.parse(readFileSync(join(FIXTURE, "expected-status.json"), "utf8")) as {
			paths: Record<string, string[]>;
		};
		const manifest = JSON.parse(readFileSync(join(FIXTURE, "manifest.json"), "utf8")) as {
			files: { key: string; role: string }[];
		};
		const pinned = new Set(manifest.files.filter((f) => f.role === "host").map((f) => f.key));
		const tables = loadPatchTables(join(ROOT, "patches"));
		const got = computeStatus(tables, expected.paths, FIXTURE);

		const required = tables.all.filter((p) => {
			if (p.optional === true) return false;
			if (!appliesOnWeb(p)) return false;
			const keys = Array.isArray(p.file) ? p.file : [p.file];
			if (!keys.some((k) => pinned.has(k))) return false;
			return got.status[p.id] !== "na";
		});

		expect(required.length).toBe(36);
		const bad = required.filter((p) => !["applied", "pending"].includes(got.status[p.id]));
		expect(bad.map((p) => [p.id, p.name, got.status[p.id]])).toEqual([]);
		expect(required.filter((p) => got.status[p.id] === "drifted")).toHaveLength(0);
	});
});
