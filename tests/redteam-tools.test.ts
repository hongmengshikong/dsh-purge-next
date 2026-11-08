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
		expect([...tools.keys()]).toEqual([
			"redteam_engagement_open",
			"redteam_asset_add",
			"redteam_asset_query",
			"redteam_session_bind",
			"redteam_session_info",
			"redteam_vuln_add",
			"redteam_vuln_query",
			"redteam_credential_add",
			"redteam_tunnel_list",
			"redteam_chain_add",
			"redteam_roles",
			"redteam_role_prompt",
			"redteam_role_prompt_reset",
			"redteam_asset_graph",
			"redteam_http_evidence_add",
			"redteam_attack_file_add",
			"redteam_asset_get",
			"redteam_asset_stats",
			"redteam_asset_assess",
			"redteam_score_list",
			"redteam_score_hit",
			"redteam_score_report",
			"redteam_report",
			"redteam_sessions",
			"redteam_attack_graph",
			"redteam_vuln_update",
			"redteam_tunnel_update",
			"redteam_asset_link",
			"redteam_shot_list",
			"redteam_shot_add",
			"redteam_credential_list",
			"redteam_webshell_list",
			"redteam_webshell_add",
			"redteam_attack_file_list",
			"redteam_asset_test",
			"redteam_asset_timeline",
			"redteam_domain_index",
			"redteam_web_list",
			"redteam_shot_delete",
			"redteam_score_point_save",
			"redteam_report_targets",
			"redteam_chain",
			"redteam_access_add",
			"redteam_access_list",
			"redteam_tunnel_add",
			"redteam_webshell_update",
			"redteam_attack_chain",
			"redteam_attack_path",
			"redteam_preflight",
			"redteam_session_check",
			"redteam_unverified_count",
			"redteam_evidence_list",
			"redteam_evidence_record",
			"redteam_poc_search",
			"redteam_poc_get",
			"redteam_poc_add",
			"redteam_poc_list",
			"redteam_poc_update",
			"redteam_poc_use",
			"redteam_agent_slot",
		]);

		const exec = { sessionId: "s-tools" };
		const opened = JSON.parse(await tools.get("redteam_engagement_open")?.execute({ target: "示例单位", scope: ["10.0.0.0/24"] }, exec) as string) as {
			ok: boolean;
			engagement: { id: string };
			stats: { stats: { assets: number } };
		};
		expect(opened.ok).toBe(true);
		expect(opened.engagement.id).toBe("示例单位");
		expect(opened.stats.stats.assets).toBe(0);
		expect(opened.session).toMatchObject({ session: "s-tools", engagement: "示例单位" });

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
