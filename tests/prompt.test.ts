import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hostPromptKeepsInject } from "../src/engine/host-clean.js";
import {
	findOverrideFile,
	hashOverride,
	isKeepableUserOverride,
	readOverrideState,
	seedPromptInjectAtBoot,
} from "../src/prompt/inject.js";
import { DEFAULT_PROMPT_INJECT } from "../src/prompt/prompt-data.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "core.js");
const OLD_CLEAN = join(OLD_REPO, "lib", "host-clean.js");

const dirs: string[] = [];
function tempHome(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-prompt-"));
	dirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("prompt-inject seed", () => {
	it("空目录 → 写入内置默认，state 记录 hash", () => {
		const home = tempHome();
		const result = seedPromptInjectAtBoot(home);
		expect(result.action).toBe("seed_default");
		expect(readFileSync(findOverrideFile(home), "utf8")).toBe(DEFAULT_PROMPT_INJECT);
		const state = readOverrideState(home);
		expect(state.customized).toBe(false);
		expect(state.hash).toBe(hashOverride(DEFAULT_PROMPT_INJECT));
	});

	it("用户自写 → 保留，不覆盖", () => {
		const home = tempHome();
		seedPromptInjectAtBoot(home);
		const custom = "MY OWN PROMPT";
		writeFileSync(findOverrideFile(home), custom, "utf8");
		expect(isKeepableUserOverride(home, custom)).toBe(true);
		expect(seedPromptInjectAtBoot(home).action).toBe("kept_user_custom");
		expect(readFileSync(findOverrideFile(home), "utf8")).toBe(custom);
	});

	it("插件旧默认（带标记但内容不同）→ 刷新为当前默认", () => {
		const home = tempHome();
		const old = `${DEFAULT_PROMPT_INJECT}\n<!-- tweak -->`;
		writeFileSync(findOverrideFile(home), old, "utf8");
		expect(seedPromptInjectAtBoot(home).action).toBe("refresh_default");
		expect(readFileSync(findOverrideFile(home), "utf8")).toBe(DEFAULT_PROMPT_INJECT);
	});

	it("已是当前默认 → current，不重写", () => {
		const home = tempHome();
		seedPromptInjectAtBoot(home);
		expect(seedPromptInjectAtBoot(home).action).toBe("current");
	});
});

describe("hostPromptKeepsInject", () => {
	it("identity 标记 / 三元形态 / 裸 drops 的判定", () => {
		expect(hostPromptKeepsInject("x [dsh-purge] identity stripped y")).toBe(true);
		expect(hostPromptKeepsInject("system-prompt/assemble\ncompleteSection === void 0 ? a : [completeSection]")).toBe(true);
		expect(hostPromptKeepsInject("system-prompt/assemble\nsections: [completeSection]")).toBe(false);
		expect(hostPromptKeepsInject("You are an AI agent powered by DeepSeek Harness.")).toBe(false);
	});
});

describe.skipIf(!existsSync(OLD_CORE))("prompt parity（对照旧 core.js / host-clean.js）", () => {
	it("seed 结果与旧实现一致（action / 文件 / state.hash）", async () => {
		const old = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			seedPromptInjectAtBoot(home: string): { action: string };
		};
		const clean = (await import(`file://${OLD_CLEAN.replace(/\\/g, "/")}`)) as {
			hostPromptKeepsInject(text: string): boolean;
		};

		const cases = ["", "MY CUSTOM PROMPT", `${DEFAULT_PROMPT_INJECT}\n<!-- tweak -->`, DEFAULT_PROMPT_INJECT];
		for (const content of cases) {
			const oldHome = tempHome();
			const newHome = tempHome();
			if (content) writeFileSync(findOverrideFile(oldHome), content, "utf8");
			if (content) writeFileSync(findOverrideFile(newHome), content, "utf8");

			const oldResult = old.seedPromptInjectAtBoot(oldHome);
			const newResult = seedPromptInjectAtBoot(newHome);
			expect(newResult.action).toBe(oldResult.action);
			expect(readFileSync(findOverrideFile(newHome), "utf8")).toBe(readFileSync(findOverrideFile(oldHome), "utf8"));
			expect(readOverrideState(newHome).hash).toBe(readOverrideState(oldHome).hash);
		}

		const samples = [
			"x [dsh-purge] identity stripped y",
			"system-prompt/assemble\ncompleteSection === void 0 ? a : [completeSection]",
			"system-prompt/assemble\nsections: [completeSection]",
			"",
		];
		for (const sample of samples) expect(hostPromptKeepsInject(sample)).toBe(clean.hostPromptKeepsInject(sample));
	});
});
