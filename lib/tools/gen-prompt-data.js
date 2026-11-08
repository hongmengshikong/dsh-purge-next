/**
 * 生成 prompt-data.ts：把插件内置的 prompt-inject 默认正文固化进仓库。
 *
 * 用法：
 *   node src/tools/gen-prompt-data.ts
 *   DSH_PURGE_SRC=D:\path\to\dsh-purge node src/tools/gen-prompt-data.ts
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceRepo = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const source = join(sourceRepo, "lib", "default-prompt-inject.md");
const raw = readFileSync(source, "utf8");
const normalize = (text) => text.replace(/\r\n/g, "\n").trim();
const hash = createHash("sha256").update(normalize(raw), "utf8").digest("hex");
const header = `/* 由 src/tools/gen-prompt-data.ts 从旧仓库生成，不要手改。
 * 源：lib/default-prompt-inject.md
 * 重新生成：node src/tools/gen-prompt-data.ts
 */

`;
const body = `export const DEFAULT_PROMPT_INJECT = ${JSON.stringify(raw)};\n\n` +
    `/** normalizeOverride(DEFAULT_PROMPT_INJECT) 的 sha256（与旧 defaultOverrideHash 一致）。 */\n` +
    `export const DEFAULT_PROMPT_INJECT_HASH = ${JSON.stringify(hash)};\n`;
const target = join(ROOT, "src", "prompt", "prompt-data.ts");
writeFileSync(target, header + body, "utf8");
console.log(`written ${target}: bytes=${Buffer.byteLength(raw)} hash=${hash.slice(0, 12)}`);
