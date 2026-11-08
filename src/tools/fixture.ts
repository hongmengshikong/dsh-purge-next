/**
 * 取宿主快照（不进 git）：从本机旧仓库复制 hosts/<host>/ 到 tests/fixtures/。
 *
 * 用法：
 *   node src/tools/fixture.ts                 # 默认 0.2.2-rc.1
 *   node src/tools/fixture.ts --host 0.2.2-rc.1
 *   DSH_PURGE_SRC=D:\path\to\dsh-purge node src/tools/fixture.ts
 *
 * 快照是门禁与 apply/revert 测试的输入，属于「测试数据」，不入库。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function argValue(name: string, fallback: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	return value && !value.startsWith("--") ? value : fallback;
}

const host = argValue("--host", "0.2.2-rc.1");
const sourceRepo = process.env.DSH_PURGE_SRC || "D:\\Home\\dsh-purge";
const source = join(sourceRepo, "hosts", host);
const target = join(ROOT, "tests", "fixtures", `host-${host}`);

if (!existsSync(source)) {
	console.error(`找不到宿主快照：${source}`);
	console.error("设置 DSH_PURGE_SRC 指向旧仓库根目录，或先跑旧仓库的 host:snapshot。");
	process.exit(2);
}

mkdirSync(dirname(target), { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`fixture: ${source} -> ${target}`);
