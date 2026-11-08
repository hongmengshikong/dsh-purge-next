/** 角色提示词（agents/<role>.md）读写。 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dirOf, pathsOf } from "./store/engagement.js";
import { DEFAULT_PROMPTS, PLANNER_ROLE, ROLE_TITLES } from "./prompts-data.js";

export interface RolePrompt {
	role: string;
	title: string;
	planner: boolean;
	dispatcher: boolean;
	content: string;
	updated_at: string | null;
}

function promptsDir(root: string, id: string): string {
	return join(dirOf(pathsOf(root), id), "agents");
}

export function listPrompts(root: string, id: string): RolePrompt[] {
	const dir = promptsDir(root, id);
	mkdirSync(dir, { recursive: true });
	return Object.entries(ROLE_TITLES).map(([role, title]) => {
		const fp = join(dir, `${role}.md`);
		const exists = existsSync(fp);
		return {
			role,
			title,
			planner: role === PLANNER_ROLE,
			dispatcher: role !== PLANNER_ROLE,
			content: exists ? readFileSync(fp, "utf8") : (DEFAULT_PROMPTS[role] ?? ""),
			updated_at: exists ? statSync(fp).mtime.toISOString() : null,
		};
	});
}

export function savePrompt(root: string, id: string, role: string, content: string): { ok: boolean; role: string; path: string; error?: string } {
	if (!role || !(role in ROLE_TITLES)) return { ok: false, role, path: "", error: `未知角色: ${role}` };
	const dir = promptsDir(root, id);
	mkdirSync(dir, { recursive: true });
	const fp = join(dir, `${role}.md`);
	const tmp = `${fp}.tmp-${process.pid}`;
	writeFileSync(tmp, content, "utf8");
	renameSync(tmp, fp);
	return { ok: true, role, path: fp };
}

export function resetPrompts(root: string, id: string, role?: string): { ok: boolean; reset: string[] } {
	const roles = role ? [role] : Object.keys(ROLE_TITLES);
	const done: string[] = [];
	for (const item of roles) {
		if (!(item in ROLE_TITLES)) continue;
		savePrompt(root, id, item, DEFAULT_PROMPTS[item] ?? "");
		done.push(item);
	}
	return { ok: done.length > 0, reset: done };
}
