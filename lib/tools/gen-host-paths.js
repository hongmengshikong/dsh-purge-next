/**
 * 生成 host-paths.ts：把旧仓库 targetFiles(aiBase) 的结果固化成 key → 相对 aiBase 的路径。
 *
 * 用法：
 *   node src/tools/gen-host-paths.ts
 *   DSH_PURGE_SRC=D:\path\to\dsh-purge node src/tools/gen-host-paths.ts --host 0.2.2-rc.1
 *
 * 目的：在新引擎里按 1:1 钉死的宿主版本解析目标文件，不必先移植整张 targetFiles 映射。
 * 旧仓库升级/换宿主时重跑本脚本即可。
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function argValue(name, fallback) {
    const index = process.argv.indexOf(name);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    return value && !value.startsWith("--") ? value : fallback;
}
const host = argValue("--host", "0.2.2-rc.1");
const sourceRepo = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const fixtureAiBase = join(ROOT, "tests", "fixtures", `host-${host}`, "node_modules", "@deepseek-ai");
if (!existsSync(fixtureAiBase)) {
    console.error(`缺少快照：${fixtureAiBase}（先 npm run fixture:fetch）`);
    process.exit(2);
}
const oldCore = (await import(pathToFileURL(join(sourceRepo, "lib", "core.js")).href));
const files = oldCore.targetFiles(fixtureAiBase);
const prefix = `${join(fixtureAiBase, "..").replace(/\\/g, "/")}/`;
const map = {};
for (const [key, value] of Object.entries(files)) {
    const list = (Array.isArray(value) ? value : [value]).filter((item) => typeof item === "string" && item.length > 0);
    if (list.length === 0)
        continue;
    map[key] = list.map((abs) => {
        const norm = abs.replace(/\\/g, "/");
        if (norm.startsWith(prefix))
            return norm.slice(prefix.length);
        // 旧 targetFiles 可能返回宿主 profile 下的绝对路径；按最后一个 node_modules/ 归一
        const at = norm.lastIndexOf("/node_modules/");
        return at >= 0 ? norm.slice(at + "/node_modules/".length) : norm;
    });
}
const header = `/* 由 src/tools/gen-host-paths.ts 生成，不要手改。
 * 源：旧仓库 targetFiles() 在 tests/fixtures/host-${host} 上的结果
 * 重新生成：npm run fixture:fetch && node src/tools/gen-host-paths.ts
 */

`;
const body = `export const HOST_PATHS: Record<string, Record<string, string[]>> = {\n` +
    `\t${JSON.stringify(host)}: ${JSON.stringify(map, null, "\t")},\n` +
    `};\n`;
const target = join(ROOT, "src", "engine", "host-paths.ts");
writeFileSync(target, header + body, "utf8");
console.log(`written ${target}: keys=${Object.keys(map).length}`);
