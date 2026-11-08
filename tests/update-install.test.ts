import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureProfileBundle, hasBodyInsert } from "../src/update/install.js";
import { updatePayload } from "../src/service.js";
import { formatUpdate } from "../src/client/view-model.js";

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function tempProfile(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-profile-"));
	dirs.push(dir);
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "dsh-profile-test", dsh: { profile: { bundles: ["@deepseek-ai/dsh-base"] } } }, null, 2));
	writeFileSync(join(dir, "cordis.patch.yml"), "- id: existing\n  name: existing\n", "utf8");
	return dir;
}

describe("ensure-profile-bundle", () => {
	it("写入 bundles 与 insert，且幂等", () => {
		const dir = tempProfile();
		const first = ensureProfileBundle(dir, "dsh-purge-next");
		expect(first).toMatchObject({ bundlesChanged: true, insertChanged: true, skipped: false });

		const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { dsh: { profile: { bundles: string[] } } };
		expect(pkg.dsh.profile.bundles).toContain("dsh-purge-next");
		const yml = readFileSync(join(dir, "cordis.patch.yml"), "utf8");
		expect(hasBodyInsert(yml, "dsh-purge-next")).toBe(true);

		const second = ensureProfileBundle(dir, "dsh-purge-next");
		expect(second).toMatchObject({ bundlesChanged: false, insertChanged: false });
	});

	it("找不到 profile 时 skipped", () => {
		expect(ensureProfileBundle("", "dsh-purge-next")).toMatchObject({ skipped: true });
	});

	it("已有 insert 时只补 bundles", () => {
		const dir = tempProfile();
		writeFileSync(join(dir, "cordis.patch.yml"), "- insert:\n    - id: dsh-purge-next\n      name: dsh-purge-next\n", "utf8");
		const result = ensureProfileBundle(dir, "dsh-purge-next");
		expect(result).toMatchObject({ bundlesChanged: true, insertChanged: false });
	});
});

describe("update payload", () => {
	it("默认指向本仓库；env 可覆盖", () => {
		const old = process.env.DSH_PURGE_REPO_URL;
		delete process.env.DSH_PURGE_REPO_URL;
		try {
			const payload = updatePayload();
			expect(payload).toMatchObject({ ok: true, configured: true, channel: "master", repo_url: "https://github.com/hongmengshikong/dsh-purge-next" });
			expect(payload.tarball_url).toContain("/archive/refs/heads/master.tar.gz");

			process.env.DSH_PURGE_REPO_URL = "https://github.com/example/fork";
			const overridden = updatePayload();
			expect(overridden.repo_url).toBe("https://github.com/example/fork");
			expect(formatUpdate(overridden)).toContain("example/fork");
		} finally {
			if (old === undefined) delete process.env.DSH_PURGE_REPO_URL;
			else process.env.DSH_PURGE_REPO_URL = old;
		}
	});
});
