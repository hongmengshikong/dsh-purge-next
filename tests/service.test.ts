import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyPayload, revertPayload, statusPayload } from "../src/service.js";
import { loadPatchTables } from "../src/engine/load.js";
import type { ServiceContext } from "../src/service.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FIXTURE = join(ROOT, "tests", "fixtures", "host-0.2.2-rc.1");
const HAS_FIXTURE = existsSync(join(FIXTURE, "node_modules"));
const tables = loadPatchTables(join(ROOT, "patches"));

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function tempHost(): { aiBase: string; root: string } {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-service-"));
	dirs.push(dir);
	cpSync(join(FIXTURE, "node_modules"), join(dir, "node_modules"), { recursive: true });
	return { aiBase: join(dir, "node_modules", "@deepseek-ai"), root: dir };
}

describe.skipIf(!HAS_FIXTURE)("service payloads", () => {
	it("status → apply → revert 的返回结构", () => {
		const { aiBase, root } = tempHost();
		const ctx: ServiceContext = { aiBase, dshHome: join(root, "home"), host: "0.2.2-rc.1", tables };

		const status = statusPayload(ctx);
		expect(status.ok).toBe(true);
		expect(status.required).toBe(36);
		expect(status.required_bad).toEqual([]);
		expect(status.drifted).toEqual([]);

		const applied = applyPayload(ctx);
		expect(applied.ok).toBe(true);
		expect(applied.applied).toBeGreaterThan(40);
		expect(applied.required_bad).toBe(0);

		const reverted = revertPayload(ctx);
		expect(reverted.ok).toBe(true);
		expect(reverted.reverted).toBeGreaterThan(40);
	});

	it("缺少 ai_base 时返回明确错误", () => {
		const ctx: ServiceContext = { aiBase: join(tmpdir(), "nope-not-here"), dshHome: tmpdir(), host: "0.2.2-rc.1", tables };
		expect(statusPayload(ctx).error).toBe("ai_base_not_found");
		expect(applyPayload(ctx).error).toBe("ai_base_not_found");
		expect(revertPayload(ctx).error).toBe("ai_base_not_found");
	});
});

describe("service 包根解析", () => {
	it("从包根能加载 patches", () => {
		expect(tables.all.length).toBe(84);
	});
});
