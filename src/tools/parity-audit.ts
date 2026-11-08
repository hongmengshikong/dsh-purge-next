/**
 * parity 审计：对比旧仓库与新实现的工具名 / dispatch op 名。
 *
 * 用法：
 *   node src/tools/parity-audit.ts            # 打印差异
 *   node src/tools/parity-audit.ts --json     # 机器可读
 *
 * 规则：新实现的名字必须是旧名字的子集（不允许凭空发明）；
 * 差额按“未迁”列出，供 §9.2 分类。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OLD = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";

function readIf(fp: string): string {
	try {
		return readFileSync(fp, "utf8");
	} catch {
		return "";
	}
}

function uniq(values: string[]): string[] {
	return [...new Set(values)].sort();
}

function oldTools(text: string): string[] {
	return uniq([...text.matchAll(/name:\s*'(redteam_[a-z_]+)'/g)].map((m) => m[1] as string));
}

function oldOps(text: string): string[] {
	return uniq([...text.matchAll(/op === '([a-zA-Z]+)'/g)].map((m) => m[1] as string));
}

function newTools(text: string): string[] {
	return uniq([...text.matchAll(/name:\s*"(redteam_[a-z_]+)"/g)].map((m) => m[1] as string));
}

function newOps(text: string): string[] {
	return uniq([...text.matchAll(/op === "([a-zA-Z]+)"/g)].map((m) => m[1] as string));
}

const oldToolList = oldTools(readIf(join(OLD, "lib", "redteam", "tools.js")));
const oldOpList = oldOps(readIf(join(OLD, "lib", "redteam", "store-core.js")));
const newToolList = newTools(readIf(join(ROOT, "src", "redteam", "tools.ts")));
const newOpList = newOps(readIf(join(ROOT, "src", "redteam", "api.ts")));

const missingTools = oldToolList.filter((name) => !newToolList.includes(name));
const missingOps = oldOpList.filter((name) => !newOpList.includes(name));
const extraTools = newToolList.filter((name) => !oldToolList.includes(name));
const extraOps = newOpList.filter((name) => !oldOpList.includes(name));

const report = {
	oldRepo: OLD,
	oldRepoFound: existsSync(join(OLD, "lib", "redteam", "store-core.js")),
	tools: { old: oldToolList.length, new: newToolList.length, missing: missingTools, extra: extraTools },
	ops: { old: oldOpList.length, new: newOpList.length, missing: missingOps, extra: extraOps },
};

if (process.argv.includes("--json")) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`old repo: ${OLD} (found=${report.oldRepoFound})`);
	console.log(`tools: ${report.tools.new}/${report.tools.old}  missing ${missingTools.length}`);
	if (missingTools.length) console.log(`  missing: ${missingTools.join(", ")}`);
	console.log(`ops:   ${report.ops.new}/${report.ops.old}  missing ${missingOps.length}`);
	if (missingOps.length) console.log(`  missing: ${missingOps.join(", ")}`);
	if (extraTools.length) console.log(`  extra tools (not in old): ${extraTools.join(", ")}`);
	if (extraOps.length) console.log(`  extra ops (not in old): ${extraOps.join(", ")}`);
}
