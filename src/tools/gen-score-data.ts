/**
 * 生成 score-data.ts：从旧仓库导出 DEFAULT_STAGES / DEFAULT_SCORE_POINTS。
 *
 * 用法：
 *   node src/tools/gen-score-data.ts
 *   DSH_PURGE_SRC=D:\path\to\dsh-purge node src/tools/gen-score-data.ts
 *
 * 生成物是**数据**（TS 常量），入库；旧仓库升级后重跑本脚本即可。
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceRepo = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const moduleUrl = pathToFileURL(join(sourceRepo, "lib", "redteam", "store-core.js")).href;

const mod = (await import(moduleUrl)) as {
	DEFAULT_STAGES: unknown[];
	DEFAULT_SCORE_POINTS: unknown[];
};

const header = `/* 由 src/tools/gen-score-data.ts 从旧仓库生成，不要手改。
 * 源：lib/redteam/store-core.js 的 DEFAULT_STAGES / DEFAULT_SCORE_POINTS
 * 重新生成：node src/tools/gen-score-data.ts
 */

`;

const body =
	`export interface StageSeed {\n` +
	`\tcode: string;\n\tname: string;\n\tsubtitle?: string;\n\tcolor?: string;\n\tgoal?: string;\n` +
	`\tsections?: unknown[];\n\ttools?: string;\n\ttransition?: string;\n\t[key: string]: unknown;\n}\n\n` +
	`export interface ScorePointSeed {\n` +
	`\tcode: string;\n\tname: string;\n\tcategory?: string;\n\tpoints?: number;\n\tdescription?: string;\n` +
	`\tenabled?: number;\n\tsrc?: number | null;\n\trule?: number | null;\n\ttier?: string | null;\n` +
	`\tcap?: number;\n\tdedup_scope?: string;\n\tlegacy?: number;\n\t[key: string]: unknown;\n}\n\n` +
	`export const DEFAULT_STAGES: StageSeed[] = ${JSON.stringify(mod.DEFAULT_STAGES, null, "\t")};\n\n` +
	`export const DEFAULT_SCORE_POINTS: ScorePointSeed[] = ${JSON.stringify(mod.DEFAULT_SCORE_POINTS, null, "\t")};\n`;

const target = join(ROOT, "src", "redteam", "store", "score-data.ts");
writeFileSync(target, header + body, "utf8");
console.log(`written ${target}: stages=${mod.DEFAULT_STAGES.length} points=${mod.DEFAULT_SCORE_POINTS.length}`);
