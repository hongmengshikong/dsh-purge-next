import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { closeKnowledge, deletePoc, getPoc, markPocUsed, pocStats, searchPocs, savePoc, updatePoc } from "../src/redteam/knowledge/store.js";
import { searchTemplates, templateStats } from "../src/redteam/knowledge/templates.js";
import { slugPoc } from "../src/redteam/knowledge/schema.js";
import { dispatch } from "../src/redteam/api.js";

const dirs: string[] = [];
function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-kb-"));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) {
		closeKnowledge(dir);
		rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
	}
});

describe("knowledge store", () => {
	it("savePoc 落库+落盘，code/CVE 规则与旧版一致", () => {
		const root = tempRoot();
		const saved = savePoc(root, { title: "Weblogic 反序列化", cve: "CVE-2023-21839", category: "deserialization", content: "print(1)", language: "python" });
		expect(saved.created).toBe(true);
		expect(saved.poc.code).toContain("cve-2023-21839");
		expect(String(saved.poc.path)).toContain(join("pocs", String(saved.poc.code)));
		expect(existsSync(String(saved.poc.path))).toBe(true);

		const fetched = getPoc(root, saved.poc.code);
		expect(fetched?.content).toBe("print(1)");
	});

	it("检索（CVE/关键字/归类/verified）与统计", () => {
		const root = tempRoot();
		savePoc(root, { title: "Shiro 550", cve: "CVE-2016-4437", category: "deserialization", verified: true, content: "x" });
		savePoc(root, { title: "Redis 未授权", category: "unauthorized", content: "y" });

		expect(searchPocs(root, { cve: "2016-4437" })).toHaveLength(1);
		expect(searchPocs(root, { q: "Redis" })).toHaveLength(1);
		expect(searchPocs(root, { category: "deserialization" })).toHaveLength(1);
		expect(searchPocs(root, { verified: true })).toHaveLength(1);

		const stats = pocStats(root);
		expect(stats.total).toBe(2);
		expect(stats.verified).toBe(1);
		expect(stats.withContent).toBe(2);
		expect(stats.byCategory.find((item) => item.code === "unauthorized")?.n).toBe(1);
	});

	it("update / use / delete", () => {
		const root = tempRoot();
		const saved = savePoc(root, { title: "POC", content: "a" });
		const updated = updatePoc(root, saved.poc.code, { verified: true, verified_note: "10.0.0.5 回显" });
		expect(updated.verified).toBe(1);
		expect(markPocUsed(root, saved.poc.code, "eng-a")).toMatchObject({ ok: true, hit_count: 1 });
		const deleted = deletePoc(root, saved.poc.code);
		expect(deleted).toMatchObject({ ok: true, deleted: true });
		expect(getPoc(root, saved.poc.code)).toBeUndefined();
		expect(existsSync(join(root, "pocs", saved.poc.code))).toBe(false);
	});

	it("slugPoc：标题已含 CVE 不重复拼", () => {
		expect(slugPoc("Weblogic CVE-2023-21839 RCE", "CVE-2023-21839")).toBe("weblogic-cve-2023-21839-rce");
		expect(slugPoc("Weblogic RCE", "CVE-2023-21839")).toBe("cve-2023-21839-weblogic-rce");
	});
});

describe("knowledge API", () => {
	it("pocSave / pocSearch / pocGet / pocUse / pocDelete", () => {
		const root = tempRoot();
		const saved = dispatch(root, { op: "pocSave", poc: { title: "Fastjson", cve: "CVE-2022-25845", category: "deserialization", content: "payload" } }) as { poc: { code: string } };
		expect(saved.poc.code).toContain("cve-2022-25845");
		const found = dispatch(root, { op: "pocSearch", q: "Fastjson" }) as { items: unknown[]; stats: { total: number } };
		expect(found.items).toHaveLength(1);
		expect(found.stats.total).toBe(1);
		const got = dispatch(root, { op: "pocGet", code: saved.poc.code }) as { content: string };
		expect(got.content).toBe("payload");
		expect(dispatch(root, { op: "pocUse", code: saved.poc.code, used_on: "eng" })).toMatchObject({ ok: true, hit_count: 1 });
		expect(dispatch(root, { op: "pocDelete", code: saved.poc.code })).toMatchObject({ ok: true, deleted: true });
		expect((dispatch(root, { op: "pocList" }) as { items: unknown[] }).items).toHaveLength(0);
	});
});

describe("nuclei templates", () => {
	it("索引与检索", () => {
		const root = tempRoot();
		const templates = join(root, "nuclei-templates");
		mkdirSync(join(templates, "cves"), { recursive: true });
		writeFileSync(join(templates, "cves", "CVE-2023-1234.yaml"), "id: CVE-2023-1234\ninfo:\n  name: Demo RCE\n  severity: critical\n  tags: rce,demo\n", "utf8");
		const old = process.env.NUCLEI_TEMPLATES;
		process.env.NUCLEI_TEMPLATES = templates;
		try {
			const stats = templateStats(root);
			expect(stats).toMatchObject({ total: 1, cve: 1 });
			const found = searchTemplates(root, "CVE-2023-1234");
			expect(found.items[0]).toMatchObject({ name: "Demo RCE", severity: "critical" });
		} finally {
			if (old === undefined) delete process.env.NUCLEI_TEMPLATES;
			else process.env.NUCLEI_TEMPLATES = old;
		}
	});
});
