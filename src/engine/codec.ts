import type { CompiledPattern, CompiledReplacement, Pattern } from "./types.js";

/** `{ regex, flags }` 在 JSON 里表示 RegExp；载入时还原，引擎才能用 instanceof 判定。 */
export function isEncodedRegex(value: unknown): value is { regex: string; flags?: string } {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const keys = Object.keys(value);
	return keys.length > 0 && keys.every((k) => k === "regex" || k === "flags") && typeof (value as { regex?: unknown }).regex === "string";
}

export function decodePattern(value: Pattern | string): CompiledPattern {
	if (isEncodedRegex(value)) return new RegExp(value.regex, value.flags ?? "");
	return value;
}

export function decodeReplacement(replacement: { pattern: Pattern; replace: string; expect?: number; insertProbe?: string }): CompiledReplacement {
	return { ...replacement, pattern: decodePattern(replacement.pattern) };
}

/** 数组/对象递归解码，供整表载入时一次性处理。 */
export function decodeDeep<T>(value: unknown): T {
	if (isEncodedRegex(value)) return new RegExp(value.regex, value.flags ?? "") as unknown as T;
	if (Array.isArray(value)) return value.map((item) => decodeDeep(item)) as unknown as T;
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = decodeDeep(v);
		return out as T;
	}
	return value as T;
}
