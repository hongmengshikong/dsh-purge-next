import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evidenceId } from "../src/redteam/evidence-ledger.js";
import { dispatch } from "../src/redteam/api.js";

const dirs: string[] = [];
function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "dsh-purge-ev-"));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

const OLD = "D:\\Home\\dsh-purge\\lib\\redteam\\evidence-ledger.mjs";

describe("evidence id", () => {
	it("与旧实现同哈希（键序无关）", async () => {
		const semantic = { operation: "nmap_scan", parameters: { target: "10.0.0.5", flags: "-sV" }, result: { open: 2 }, confidence: "observed", authority: "tool-output", limitations: [], supporting_ev_ids: [] };
		const mine = evidenceId(semantic);
		const old = (await import(`file://${OLD.replace(/\\/g, "/")}`)) as { evidenceId: (value: unknown) => string };
		expect(mine).toBe(old.evidenceId(semantic));
		expect(evidenceId({ b: 1, a: 2 })).toBe(evidenceId({ a: 2, b: 1 }));
	});
});

describe("evidence ledger via API", () => {
	it("record 去重 / verify / upgrade / unverified_count", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "ledger", scope: [] });

		const recorded = dispatch(root, { op: "evidenceRecord", engagement: "ledger", evidence: { operation: "curl", result: { status: 200 } } }) as { ok: boolean; ev_id: string; duplicate: boolean };
		expect(recorded).toMatchObject({ ok: true, duplicate: false });
		const again = dispatch(root, { op: "evidenceRecord", engagement: "ledger", evidence: { operation: "curl", result: { status: 200 } } }) as { duplicate: boolean };
		expect(again.duplicate).toBe(true);

		const verified = dispatch(root, { op: "evidenceVerify", engagement: "ledger", evidence: { operation: "curl", result: { status: 200 } } }) as { matched: boolean };
		expect(verified.matched).toBe(true);

		const claimed = dispatch(root, {
			op: "evidenceRecord",
			engagement: "ledger",
			evidence: { operation: "webshell", result: { online: true }, confidence: "claimed", authority: "subagent-report" },
		}) as { ev_id: string };
		expect((dispatch(root, { op: "unverifiedCount", engagement: "ledger" }) as { count: number }).count).toBe(1);

		const upgraded = dispatch(root, { op: "evidenceUpgrade", engagement: "ledger", evidence: { claimed_ev_id: claimed.ev_id, verified_result: { online: true }, verified_by: "coordinator" } }) as { ok: boolean; ev_id: string };
		expect(upgraded.ok).toBe(true);
		expect((dispatch(root, { op: "unverifiedCount", engagement: "ledger" }) as { count: number }).count).toBe(0);
		expect((dispatch(root, { op: "evidenceList", engagement: "ledger" }) as { items: unknown[] }).items.length).toBeGreaterThanOrEqual(2);
	});
});

describe("unknown registry via API", () => {
	it("record 去重 / list open / resolve", () => {
		const root = tempRoot();
		dispatch(root, { op: "openEngagement", name: "unk", scope: [] });
		const first = dispatch(root, { op: "unknownRecord", engagement: "unk", unknown: { question: "10.0.3.7:22 凭据？", domain: "internal-recon", severity: "high" } }) as { ok: boolean; unk_id: string; duplicate: boolean };
		expect(first).toMatchObject({ ok: true, duplicate: false });
		const second = dispatch(root, { op: "unknownRecord", engagement: "unk", unknown: { question: "10.0.3.7:22 凭据？", domain: "internal-recon" } }) as { duplicate: boolean };
		expect(second.duplicate).toBe(true);

		const open = dispatch(root, { op: "unknownList", engagement: "unk", status: "open" }) as { items: unknown[] };
		expect(open.items).toHaveLength(1);

		expect(dispatch(root, { op: "unknownResolve", engagement: "unk", unk_id: first.unk_id, disposition: "resolved", resolution: "root/root" })).toMatchObject({ ok: true });
		expect((dispatch(root, { op: "unknownList", engagement: "unk", status: "open" }) as { items: unknown[] }).items).toHaveLength(0);
	});
});
