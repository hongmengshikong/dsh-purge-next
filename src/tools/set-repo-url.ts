/**
 * 仓库上传后：一条命令填好更新源。
 *
 * 用法：
 *   node src/tools/set-repo-url.ts https://github.com/<owner>/dsh-purge-next
 *   node src/tools/set-repo-url.ts https://github.com/<owner>/dsh-purge-next --dry-run
 *
 * 做的事：改写 src/update/check.ts 的 DEFAULT_REPO_URL，并打印后续步骤
 * （build → commit → tag → push）。不改 package.json / 不联网。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("--")) ?? "";
const dryRun = args.includes("--dry-run");

if (!/^https?:\/\/[^\s]+\/[^\s]+$/.test(url)) {
	console.error("用法: node src/tools/set-repo-url.ts https://github.com/<owner>/dsh-purge-next");
	process.exit(2);
}

const file = join(ROOT, "src", "update", "check.ts");
const source = readFileSync(file, "utf8");
const next = source.replace(/export const DEFAULT_REPO_URL = "";/, `export const DEFAULT_REPO_URL = ${JSON.stringify(url)};`);
if (next === source) {
	console.error("DEFAULT_REPO_URL 未找到或已是该值；请检查 src/update/check.ts");
	process.exit(1);
}

if (dryRun) {
	console.log(`[dry-run] 将写入：DEFAULT_REPO_URL = ${JSON.stringify(url)}`);
	process.exit(0);
}

writeFileSync(file, next, "utf8");
console.log(`DEFAULT_REPO_URL = ${url}`);
console.log("");
console.log("后续步骤：");
console.log("  1. npm run verify");
console.log("  2. git add -A && git commit -m \"chore(update): 更新源指向本仓库\"");
console.log("  3. git tag -d v0.2.2-rc.1 && git tag -a v0.2.2-rc.1 -m \"dsh-purge-next 0.2.2-rc.1\"");
console.log("  4. git remote add origin <repo> && git push -u origin master && git push origin v0.2.2-rc.1");
console.log("  5. 安装：dsh plugin --profile web add --ignore-scripts <repo 的 tag tarball>");
