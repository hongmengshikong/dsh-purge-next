import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
	activeEngagementId,
	assertWithin,
	listEngagements,
	openEngagement,
	setActiveEngagement,
	slugify,
} from "../src/redteam/store/engagement.js";

const roots: string[] = [];
function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-eng-"));
	roots.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("slugify", () => {
	it("中文保留、空格与符号折叠为 -", () => {
		expect(slugify("测试单位 A")).toBe("测试单位-a");
		expect(slugify("  ACME  Inc. ")).toBe("acme-inc");
	});
	it("空名回退到 engagement-<ts>", () => {
		expect(slugify("   ")).toMatch(/^engagement-\d+$/);
	});
});

describe("engagement 工作区", () => {
	it("openEngagement 建目录、yaml、空库，并绑定当前指针", () => {
		const root = tempRoot();
		const opened = openEngagement(root, "测试单位", ["10.0.0.0/24"], {
			now: () => "2026-01-01T00:00:00.000Z",
		});
		expect(opened).toEqual({ id: "测试单位", name: "测试单位", scope: ["10.0.0.0/24"] });

		const base = join(root, "engagements", "测试单位");
		for (const sub of ["agents", "runs", "reports"]) {
			expect(statSync(join(base, sub)).isDirectory()).toBe(true);
		}
		expect(statSync(join(base, "assets.db")).isFile()).toBe(true);
		const probe = new DatabaseSync(join(base, "assets.db"));
		const tables = (probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
		expect(tables).toEqual(expect.arrayContaining(["asset", "port", "score_point"]));
		probe.close();

		const yaml = readFileSync(join(base, "engagement.yaml"), "utf8");
		expect(yaml).toContain("target_name: 测试单位");
		expect(yaml).toContain("scope_cidrs: [10.0.0.0/24]");
		expect(yaml).toContain("status: active");

		expect(activeEngagementId(root)).toBe("测试单位");
	});

	it("再次 open 保留 created_at，并可更新 scope", () => {
		const root = tempRoot();
		openEngagement(root, "A", ["10.0.0.0/24"], { now: () => "2026-01-01T00:00:00.000Z" });
		const second = openEngagement(root, "A", ["10.0.1.0/24"], {
			now: () => "2026-02-01T00:00:00.000Z",
		});
		expect(second.scope).toEqual(["10.0.1.0/24"]);
		const yaml = readFileSync(join(root, "engagements", "a", "engagement.yaml"), "utf8");
		expect(yaml).toContain("created_at: 2026-01-01T00:00:00.000Z");
		expect(yaml).toContain("updated_at: 2026-02-01T00:00:00.000Z");
	});

	it("listEngagements 按 created_at 倒序", () => {
		const root = tempRoot();
		openEngagement(root, "old", [], { now: () => "2026-01-01T00:00:00.000Z", bindCurrent: false });
		openEngagement(root, "new", [], { now: () => "2026-03-01T00:00:00.000Z", bindCurrent: false });
		const list = listEngagements(root);
		expect(list.map((item) => item.id)).toEqual(["new", "old"]);
		expect(list[0]?.stats).toBeNull();
	});

	it("setActiveEngagement 只接受存在的库；未知 id 返回 false", () => {
		const root = tempRoot();
		expect(setActiveEngagement(root, "nope")).toBe(false);
		openEngagement(root, "B", [], { bindCurrent: false });
		expect(setActiveEngagement(root, "b")).toBe(true);
		expect(activeEngagementId(root)).toBe("b");
	});

	it("assertWithin 挡住 ../ 越界", () => {
		const root = tempRoot();
		expect(() => assertWithin(join(root, "..", "etc"), [join(root, "engagements")])).toThrow(/escapes root/);
	});
});
