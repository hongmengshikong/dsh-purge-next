/** 页面共享类型与工具。 */

export interface PageProps {
	engagement: string | null;
	refresh: () => void;
	notify: (text: string, tone?: "ok" | "bad") => void;
}

export function fmt(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "number") return String(value);
	if (typeof value === "boolean") return value ? "是" : "否";
	return String(value);
}

export function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
