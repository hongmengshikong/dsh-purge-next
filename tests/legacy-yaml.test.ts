import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collapseDuplicateLegacyApplyPath, rewriteStaleLegacyApplyCall, legacyApplyPathStarts } from "../src/engine/legacy.js";
import { sanitizeYamlPersonaScalars } from "../src/engine/yaml.js";

const OLD_REPO = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const OLD_CORE = join(OLD_REPO, "lib", "core.js");

const DUPLICATED = `const a = 1;
function legacyApplyPath(section, op) {
  return section[op];
}
const between = 2;
function legacyApplyPath(section, op) {
  return section[op];
}
tail`;
const STALE = "const apply = (section, op) => legacyApplyPath(section, op);";

const YAML = `personaPrefix: >
  You are a coding agent powered by DeepSeek Harness.

  Keep this line.

  Working directory: {{cwd}}.
suffix: ""
  orphan body that should disappear
next: ok
`;

describe.skipIf(!existsSync(OLD_CORE))("legacy / yaml parity（对照旧 core.js）", () => {
	it("collapseDuplicateLegacyApplyPath 输出一致", async () => {
		const old = (await import(`file://${OLD_CORE.replace(/\\/g, "/")}`)) as {
			collapseDuplicateLegacyApplyPath(text: string): string;
			sanitizeYamlPersonaScalars(text: string): string;
		};
		expect(collapseDuplicateLegacyApplyPath(DUPLICATED)).toBe(old.collapseDuplicateLegacyApplyPath(DUPLICATED));
		expect(sanitizeYamlPersonaScalars(YAML)).toBe(old.sanitizeYamlPersonaScalars(YAML));
	});
});

describe("legacy / yaml 语义", () => {
	it("重复的 legacyApplyPath 只留第一份", () => {
		const out = collapseDuplicateLegacyApplyPath(DUPLICATED);
		expect(legacyApplyPathStarts(out)).toBe(1);
		expect(out).toContain("const between = 2;");
	});

	it("旧调用 => legacyApplyPath 被改写为 applyPathOp", () => {
		const out = rewriteStaleLegacyApplyCall(STALE);
		expect(out).toBe("const apply = (section, op) => applyPathOp(section, op);");
	});

	it("YAML 折叠块丢掉宿主样板段，保留用户内容", () => {
		const out = sanitizeYamlPersonaScalars(YAML);
		expect(out).toContain("personaPrefix: |-");
		expect(out).toContain("Keep this line.");
		expect(out).not.toContain("You are a coding agent powered by");
		expect(out).not.toContain("Working directory:");
	});
});
