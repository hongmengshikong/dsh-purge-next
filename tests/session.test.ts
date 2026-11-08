import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dispatch, redteamRoot } from "../src/redteam/api.js";
import { bindEngagement, bindingViewOf, boundEngagement, resolveEngagement } from "../src/redteam/session.js";

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe("session 绑定", () => {
	it("按会话隔离绑定，解析优先级：显式 > 绑定", () => {
		const home = mkdtempSync(join(tmpdir(), "dsh-purge-session-"));
		dirs.push(home);
		const root = redteamRoot(home);
		dispatch(root, { op: "openEngagement", name: "a", scope: [] });
		dispatch(root, { op: "openEngagement", name: "b", scope: [] });

		const execA = { sessionId: "s1" };
		const execB = { sessionId: "s2" };
		bindEngagement(execA, "a");
		expect(boundEngagement(execA)).toBe("a");
		expect(boundEngagement(execB)).toBeUndefined();
		expect(bindingViewOf(execA)).toMatchObject({ session: "s1", engagement: "a", is_subagent: false });
		expect(resolveEngagement(root, execA)).toBe("a");
		expect(resolveEngagement(root, execA, "b")).toBe("b");
		expect(bindingViewOf({ agent: { sessionId: "s3", parentSessionId: "s1" } })).toMatchObject({
			session: "s3",
			is_subagent: true,
		});
	});
});
