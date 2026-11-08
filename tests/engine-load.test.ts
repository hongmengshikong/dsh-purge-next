import { describe, expect, it } from "vitest";
import { loadPatchTables } from "../src/engine/load.js";

const PATCH_DIR = new URL("../patches", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

describe("patch corpus", () => {
	it("四个表齐全且计数符合预期", () => {
		const t = loadPatchTables(PATCH_DIR);
		expect(t.prompt).toHaveLength(10);
		expect(t.code).toHaveLength(3);
		expect(t.engine).toHaveLength(8);
		expect(t.tools).toHaveLength(63);
		expect(t.all).toHaveLength(84);
	});

	it("id 唯一，且 display groups 只引用存在的 id", () => {
		const t = loadPatchTables(PATCH_DIR);
		const ids = t.all.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const [, groupIds] of Object.entries(t.displayGroups)) {
			for (const id of groupIds) expect(ids).toContain(id);
		}
		expect(Object.keys(t.displayGroups)).toHaveLength(9);
	});

	it("RegExp 型 pattern 被还原成 RegExp（不是普通对象）", () => {
		const t = loadPatchTables(PATCH_DIR);
		let regexes = 0;
		for (const patch of t.all) {
			for (const r of patch.replacements ?? []) {
				if (r.pattern instanceof RegExp) regexes += 1;
				else expect(typeof r.pattern).toBe("string");
			}
		}
		expect(regexes).toBeGreaterThan(0);
	});

	it("每条补丁要么有 patterns+replace，要么有 replacements", () => {
		const t = loadPatchTables(PATCH_DIR);
		for (const patch of t.all) {
			const legacy = Array.isArray(patch.patterns) && patch.patterns.length > 0 && typeof patch.replace === "string";
			const modern = Array.isArray(patch.replacements) && patch.replacements.length > 0;
			expect(legacy || modern, `${patch.id} ${patch.name} 缺少替换定义`).toBe(true);
		}
	});
});
