import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	assignToolkitFolder,
	envAdaptStatus,
	loadPlatformConfig,
	platformSummary,
	resolveTool,
	savePlatformConfig,
	toolkitDirOf,
} from "../src/redteam/platform-config.js";
import { maxAgentsOf, saveMaxAgents } from "../src/redteam/settings.js";
import { buildTools } from "../src/redteam/tools.js";

const dirs: string[] = [];
function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-platform-"));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("platform config", () => {
	it("保存/读取 + 工具箱解析", () => {
		const root = tempRoot();
		const toolkit = join(root, "toolkit");
		mkdirSync(toolkit, { recursive: true });
		writeFileSync(join(toolkit, "nmap.exe"), "fake", "utf8");
		const cfg = savePlatformConfig({ toolkitDir: toolkit, platform: "windows" }, root);
		expect(cfg.tools.nmap).toBe("");
		expect(toolkitDirOf(loadPlatformConfig(root), root)).toBe(toolkit);
		const resolved = resolveTool("nmap", { root, config: cfg });
		expect(resolved).toMatchObject({ id: "nmap", source: "toolkit" });
		expect(String(resolved.path)).toContain("nmap.exe");
	});

	it("整包文件夹分配：工具 + nuclei 模板目录", () => {
		const root = tempRoot();
		const folder = join(root, "kali-tools");
		mkdirSync(join(folder, "nuclei-templates", "cves"), { recursive: true });
		writeFileSync(join(folder, "fscan.exe"), "fake", "utf8");
		writeFileSync(join(folder, "nuclei-templates", "cves", "CVE-2024-1.yaml"), "id: CVE-2024-1\ninfo:\n  name: t\n  severity: high\n", "utf8");
		const result = assignToolkitFolder(folder, root);
		expect(result).toMatchObject({ ok: true, assignedCount: 1, dir: folder });
		expect((result.assigned as Record<string, string>).fscan).toContain("fscan.exe");
		expect(result.nucleiTemplatesDir).toContain("nuclei-templates");
		const summary = platformSummary(root);
		expect((summary.tools as { found: number }).found).toBeGreaterThanOrEqual(1);
		expect((summary.adapt as { reason: string }).reason).toBe("configured");
	});

	it("envAdaptStatus：未配置 → need-config，跳过 → skipped", () => {
		const root = tempRoot();
		const before = envAdaptStatus(root);
		expect(["need-config", "tools-found", "configured", "kali"]).toContain(before.reason as string);
		savePlatformConfig({ envAdaptSkip: true }, root);
		expect(envAdaptStatus(root)).toMatchObject({ ready: true, reason: "skipped" });
	});
});

describe("maxAgents settings", () => {
	it("文件/环境变量/默认 三级生效", () => {
		const root = tempRoot();
		expect(maxAgentsOf(root, {} as NodeJS.ProcessEnv)).toBe(3);
		expect(maxAgentsOf(root, { REDTEAM_MAX_AGENTS: "5" } as NodeJS.ProcessEnv)).toBe(5);
		saveMaxAgents(root, 2);
		expect(maxAgentsOf(root, { REDTEAM_MAX_AGENTS: "5" } as NodeJS.ProcessEnv)).toBe(2);
		saveMaxAgents(root, 99);
		expect(maxAgentsOf(root, {} as NodeJS.ProcessEnv)).toBe(10);
	});
});

describe("agent_slot", () => {
	it("status / acquire / release 受 maxAgents 限制", () => {
		const home = tempRoot();
		const root = join(home, "redteam");
		mkdirSync(root, { recursive: true });
		saveMaxAgents(root, 1);
		const tools = buildTools(home);
		const slot = tools.find((tool) => tool.name === "redteam_agent_slot");
		expect(slot).toBeDefined();
		const exec = { sessionId: "s1" };

		const status = JSON.parse(String(slot?.execute({ action: "status" }, exec))) as Record<string, unknown>;
		expect(status).toMatchObject({ max: 1, used: 0, free: 1 });

		const first = JSON.parse(String(slot?.execute({ action: "acquire", label: "侦察" }, exec))) as Record<string, unknown>;
		expect(first.ok).toBe(true);
		expect(first.used).toBe(1);

		const second = JSON.parse(String(slot?.execute({ action: "acquire", label: "打点" }, exec))) as Record<string, unknown>;
		expect(second.ok).toBe(false);

		const released = JSON.parse(String(slot?.execute({ action: "release", key: first.slot }, exec))) as Record<string, unknown>;
		expect(released).toMatchObject({ ok: true, released: true, used: 0 });

		expect(JSON.parse(String(slot?.execute({ action: "acquire" }, exec)))).toMatchObject({ ok: true });
	});
});
