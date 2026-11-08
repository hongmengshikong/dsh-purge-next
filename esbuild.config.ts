/**
 * client 构建：esbuild → CJS → 套上 DSH 的 __ModuleLoader__ 包装。
 *
 * 取代旧仓库 build-client.mjs 的「按 factory: (require) => { 字面量切片」。
 * 宿主的约定只有两条：
 *   window.__ModuleLoader__.load({ id, factory })
 *   factory(require) 返回模块导出（这里必须含 apply / inject）
 */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";

const result = await build({
	entryPoints: ["src/client/index.ts"],
	bundle: true,
	format: "cjs",
	platform: "browser",
	target: "es2022",
	// 宿主提供，不能打进产物
	external: ["react", "react-dom"],
	write: false,
	logLevel: "silent",
});

const file = result.outputFiles?.[0];
if (!file) throw new Error("esbuild produced no output");

const banner = `window.__ModuleLoader__.load({ id: "dsh-purge-next", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n`;
const footer = `\nreturn module.exports;\n} });\n`;

writeFileSync("client.js", `${banner}${file.text}${footer}`, "utf8");
console.log(`client.js written (${Buffer.byteLength(banner + file.text + footer)} bytes)`);

