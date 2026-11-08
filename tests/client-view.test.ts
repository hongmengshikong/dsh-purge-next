import { describe, expect, it } from "vitest";
import { engagementLabel, formatBootstrap, formatScore, formatStatus } from "../src/client/view-model.js";
import { describeUpdate, repoUrl, updateStatus, updateStatusFor, updateTarballFor, updateTarballUrl } from "../src/update/check.js";

describe("client view-model", () => {
	it("status / bootstrap / score 文案", () => {
		expect(formatStatus({ ok: true, required: 36, drifted: [], counts: { applied: 69 } })).toBe("必需 36 · 漂移 0 · applied 69");
		expect(formatStatus({ ok: false, error: "ai_base_not_found" })).toBe("错误：ai_base_not_found");
		expect(formatBootstrap({ ok: true, engagements: [{ id: "a" }], current: "a" })).toBe("当前：a · 共 1 个");
		expect(formatBootstrap({ ok: true, engagements: [], current: null })).toContain("暂无靶标");
		expect(formatScore({ ok: true, summary: { achievedPoints: 60, countedHits: 2, hitCount: 3 } })).toBe("得分 60 · 计分命中 2/3");
	});

	it("engagementLabel 标记当前项并截断", () => {
		expect(engagementLabel({ id: "a", name: "A" }, "a")).toBe("● A (a)");
		expect(engagementLabel({ id: "x".repeat(30) }, null)).toHaveLength(24);
	});
});

describe("update（单通道）", () => {
	it("空 URL 返回 unconfigured，且不生成 tarball URL", () => {
		expect(updateStatusFor("")).toMatchObject({ configured: false, channel: "master", reason: "repo_not_configured" });
		expect(updateTarballFor("")).toBeNull();
		expect(describeUpdate(updateStatusFor(""))).toContain("未配置");
	});

	it("默认更新源指向本仓库（无 env 时）", () => {
		const old = process.env.DSH_PURGE_REPO_URL;
		delete process.env.DSH_PURGE_REPO_URL;
		try {
			expect(updateStatus()).toMatchObject({ configured: true, channel: "master", repoUrl: "https://github.com/hongmengshikong/dsh-purge-next" });
			expect(updateTarballUrl()).toBe("https://github.com/hongmengshikong/dsh-purge-next/archive/refs/heads/master.tar.gz");
		} finally {
			if (old !== undefined) process.env.DSH_PURGE_REPO_URL = old;
		}
	});

	it("配置后指向 master tarball，且没有 stable/beta 概念", () => {
		const old = process.env.DSH_PURGE_REPO_URL;
		process.env.DSH_PURGE_REPO_URL = "https://github.com/example/dsh-purge-next.git";
		try {
			expect(repoUrl()).toBe("https://github.com/example/dsh-purge-next.git");
			expect(updateTarballUrl()).toBe("https://github.com/example/dsh-purge-next/archive/refs/heads/master.tar.gz");
			expect(updateStatus().channel).toBe("master");
		} finally {
			if (old === undefined) delete process.env.DSH_PURGE_REPO_URL;
			else process.env.DSH_PURGE_REPO_URL = old;
		}
	});
});
