import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deleteSkill, parseSkillDocument, readSkill, saveSkill, skillCatalog, skillsStatus } from "../src/redteam/skills.js";
import { dispatch } from "../src/redteam/api.js";

const dirs: string[] = [];
function tempHome(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-skills-"));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function writeSkill(dir: string, id: string, description = "示例技能", body = "步骤一"): void {
	mkdirSync(join(dir, id), { recursive: true });
	writeFileSync(join(dir, id, "SKILL.md"), `---\nname: ${id}\ndescription: ${description}\n---\n\n${body}\n`, "utf8");
}

describe("skills", () => {
	it("frontmatter 解析与校验", () => {
		expect(parseSkillDocument("---\nname: code-review\ndescription: 代码审查\n---\n正文")).toMatchObject({ ok: true, name: "code-review", description: "代码审查" });
		expect(parseSkillDocument("no frontmatter").ok).toBe(false);
		expect(parseSkillDocument("---\nname: Bad_Name\ndescription: x\n---\n").ok).toBe(false);
		expect(parseSkillDocument("---\nname: ok-name\n---\n").ok).toBe(false);
	});

	it("目录扫描：redteam + official", () => {
		const home = tempHome();
		const root = join(home, "redteam");
		writeSkill(join(root, "skills"), "rt-skill");
		writeSkill(join(home, "skills"), "official-skill", "官方技能");
		const items = skillCatalog(root);
		expect(items).toHaveLength(2);
		expect(items.map((item) => item.library).sort()).toEqual(["official", "redteam"]);
		expect(skillsStatus(root)).toMatchObject({ redteam: 1, official: 1, broken: 0, total: 2 });
	});

	it("read / save / delete", () => {
		const home = tempHome();
		const root = join(home, "redteam");
		writeSkill(join(root, "skills"), "rt-skill", "示例", "原始正文");
		const hit = readSkill(root, "rt-skill");
		expect(hit?.content).toContain("原始正文");

		const saved = saveSkill(root, "new-skill", "新正文", "新技能");
		expect(saved.ok).toBe(true);
		expect(existsSync(join(root, "skills", "new-skill", "SKILL.md"))).toBe(true);
		expect(readSkill(root, "new-skill")?.content).toContain("新正文");

		expect(deleteSkill(root, "new-skill")).toMatchObject({ ok: true, removed: true });
		expect(readSkill(root, "new-skill")).toBeNull();
	});

	it("API：skillCatalog / skillRead / skillSave / skillDelete", () => {
		const home = tempHome();
		const root = join(home, "redteam");
		writeSkill(join(root, "skills"), "api-skill");
		const catalog = dispatch(root, { op: "skillCatalog" }) as { items: unknown[]; status: { total: number } };
		expect(catalog.items).toHaveLength(1);
		expect(catalog.status.total).toBe(1);

		const read = dispatch(root, { op: "skillRead", name: "api-skill" }) as { content: string };
		expect(read.content).toContain("步骤一");

		expect(dispatch(root, { op: "skillSave", name: "saved-skill", content: "正文", description: "保存" })).toMatchObject({ ok: true });
		expect(dispatch(root, { op: "skillDelete", name: "saved-skill" })).toMatchObject({ ok: true, removed: true });
	});
});
