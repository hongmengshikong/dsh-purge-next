/**
 * 生成 prompts-data.ts：从旧仓库导出角色标题与默认提示词。
 *
 * 用法：node src/tools/gen-prompts-data.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceRepo = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const mod = (await import(pathToFileURL(join(sourceRepo, "lib", "redteam", "store-core.js")).href));
const header = `/* 由 src/tools/gen-prompts-data.ts 从旧仓库生成，不要手改。
 * 源：lib/redteam/store-core.js 的 ROLE_TITLES / DEFAULT_PROMPTS / PLANNER_ROLE
 */

`;
const body = `export const ROLE_TITLES: Record<string, string> = ${JSON.stringify(mod.ROLE_TITLES, null, "\t")};\n\n` +
    `export const PLANNER_ROLE = ${JSON.stringify(mod.PLANNER_ROLE)};\n\n` +
    `export const DEFAULT_PROMPTS: Record<string, string> = ${JSON.stringify(mod.DEFAULT_PROMPTS, null, "\t")};\n`;
const target = join(ROOT, "src", "redteam", "prompts-data.ts");
writeFileSync(target, header + body, "utf8");
console.log(`written ${target}: roles=${Object.keys(mod.ROLE_TITLES).length}`);
