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
	it("未配置 → unconfigured；配置 → master tarball", () => {
		const old = process.env.DSH_PURGE_REPO_URL;
		delete process.env.DSH_PURGE_REPO_URL;
		try {
			expect(updatePayload()).toMatchObject({ ok: false, configured: false, channel: "master", tarball_url: null });
			expect(formatUpdate(updatePayload())).toContain("未配置");

			process.env.DSH_PURGE_REPO_URL = "https://github.com/example/dsh-purge-next";
			const configured = updatePayload();
			expect(configured).toMatchObject({ ok: true, configured: true });
			expect(configured.tarball_url).toContain("/archive/refs/heads/master.tar.gz");
		} finally {
			if (old === undefined) delete process.env.DSH_PURGE_REPO_URL;
			else process.env.DSH_PURGE_REPO_URL = old;
		}
	});
});
