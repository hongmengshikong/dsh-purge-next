/**
 * engagement.yaml 的极简读写：格式与旧仓库 store-core.js 完全一致。
 *
 *   key: value
 *   key: [a, b, c]
 *
 * 不要换成 YAML 库：旧文件是手写行格式，换库会改变字节，破坏 parity。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type MetaValue = string | string[];
export type Meta = Record<string, MetaValue>;

export function readMeta(path: string): Meta | undefined {
	if (!existsSync(path)) return undefined;
	const out: Meta = {};
	for (const line of readFileSync(path, "utf8").split("\n")) {
		const match = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
		if (!match) continue;
		const key = match[1] as string;
		const raw = (match[2] ?? "").trim();
		if (raw.startsWith("[") && raw.endsWith("]")) {
			out[key] = raw
				.slice(1, -1)
				.split(",")
				.map((item) => item.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);
		} else {
			out[key] = raw.replace(/^["']|["']$/g, "");
		}
	}
	return out;
}

export function writeMeta(path: string, meta: Meta): void {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(meta)) {
		if (Array.isArray(value)) lines.push(`${key}: [${value.join(", ")}]`);
		else if (value !== undefined && value !== null) lines.push(`${key}: ${value}`);
	}
	writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}
