import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hostApply, hostPaths, hostRevert, hostStatus } from "../src/engine/host.js";
import { loadPatchTables } from "../src/engine/load.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FIXTURE = join(ROOT, "tests", "fixtures", "host-0.2.2-rc.1");
const AI_BASE = join(FIXTURE, "node_modules", "@deepseek-ai");
const HAS_FIXTURE = existsSync(AI_BASE);

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function copyHost(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-host-"));
	dirs.push(dir);
	cpSync(join(FIXTURE, "node_modules"), join(dir, "node_modules"), { recursive: true });
	return join(dir, "node_modules", "@deepseek-ai");
}

function hashTree(root: string): string {
	const hash = createHash("sha256");
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir).sort()) {
			const fp = join(dir, name);
			if (statSync(fp).isDirectory()) {
				walk(fp);
				continue;
			}
			hash.update(fp.slice(root.length)).update("\0").update(readFileSync(fp)).update("\0");
		}
	};
	walk(root);
	return hash.digest("hex");
}

const tables = loadPatchTables(join(ROOT, "patches"));

describe.skipIf(!HAS_FIXTURE)("host 入口", () => {
	it("hostPaths 覆盖快照里的 58 个文件键", () => {
		const map = hostPaths("0.2.2-rc.1");
		expect(Object.keys(map).length).toBe(58);
		expect(map["agent-instructions"]).toEqual(["@deepseek-ai/dsh-agent-instructions/lib/index.js"]);
	});

	it("未知宿主版本直接报错", () => {
		expect(() => hostPaths("9.9.9")).toThrow(/不支持的宿主版本/);
	});

	it("status → apply → status → revert 全链路", () => {
		const copy = copyHost();
		const before = hashTree(copy);

		const status0 = hostStatus(copy, "0.2.2-rc.1", tables);
		expect(status0.required).toHaveLength(36);
		expect(status0.requiredBad).toEqual([]);
		expect(status0.drifted).toEqual([]);

		const applied = hostApply(copy, "0.2.2-rc.1", tables);
		expect(applied.applied).toBeGreaterThan(40);
		expect(applied.drifted).toBe(0);

		const status1 = hostStatus(copy, "0.2.2-rc.1", tables);
		expect(status1.drifted).toEqual([]);
		expect(status1.counts.pending ?? 0).toBe(0);

		hostRevert(copy);
		expect(hashTree(copy)).toBe(before);
	});

	it("二次 apply 幂等", () => {
		const copy = copyHost();
		hostApply(copy, "0.2.2-rc.1", tables);
		const second = hostApply(copy, "0.2.2-rc.1", tables);
		expect(second.applied).toBe(0);
		expect(second.drifted).toBe(0);
	});
});
