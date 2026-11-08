import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTools } from "../src/redteam/tools.js";

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("redteam tools", () => {
	it("open → add → query 三个工具串起来", async () => {
		const home = mkdtempSync(join(tmpdir(), "dsh-purge-tools-"));
		dirs.push(home);
		const tools = new Map(buildTools(home).map((tool) => [tool.name, tool]));
		expect([...tools.keys()]).toEqual(["redteam_engagement_open", "redteam_asset_add", "redteam_asset_query"]);

		const opened = JSON.parse(await tools.get("redteam_engagement_open")?.execute({ target: "示例单位", scope: ["10.0.0.0/24"] }) as string) as {
			ok: boolean;
			engagement: { id: string };
			stats: { stats: { assets: number } };
		};
		expect(opened.ok).toBe(true);
		expect(opened.engagement.id).toBe("示例单位");
		expect(opened.stats.stats.assets).toBe(0);

		const added = JSON.parse(
			await tools.get("redteam_asset_add")?.execute({
				engagement: "示例单位",
				ip: "10.0.0.5",
				provenance: "active",
				tool: "nmap",
				ports: [{ port: 443, service: "https", product: "nginx" }],
			}) as string,
		) as { ok: boolean; counts: { assets: number } };
		expect(added).toMatchObject({ ok: true, counts: { assets: 1 } });

		const queried = JSON.parse(
			await tools.get("redteam_asset_query")?.execute({ engagement: "示例单位", limit: 10 }) as string,
		) as { ok: boolean; total: number; items: { ip: string }[] };
		expect(queried.ok).toBe(true);
		expect(queried.total).toBe(1);
		expect(queried.items[0]?.ip).toBe("10.0.0.5");
	});

	it("参数校验：缺 target / provenance 非法", async () => {
		const home = mkdtempSync(join(tmpdir(), "dsh-purge-tools-"));
		dirs.push(home);
		const tools = new Map(buildTools(home).map((tool) => [tool.name, tool]));
		expect(() => tools.get("redteam_engagement_open")?.execute({})).toThrow(/target 必填/);
		expect(() => tools.get("redteam_asset_add")?.execute({ ip: "1.2.3.4", provenance: "x" })).toThrow(/provenance/);
	});
});
