/** Dock 的纯展示逻辑（可在 Node 里单测，不依赖 DOM）。 */

export interface StatusPayload {
	ok: boolean;
	counts?: Record<string, number>;
	required?: number;
	required_bad?: unknown[];
	drifted?: unknown[];
	error?: string;
}

export interface BootstrapPayload {
	ok: boolean;
	root?: string;
	engagements?: { id: string; name: string; status?: string }[];
	current?: string | null;
}

export interface ScorePayload {
	ok: boolean;
	summary?: { achievedPoints?: number; countedHits?: number; hitCount?: number };
	error?: string;
}

export function formatStatus(status: StatusPayload | null): string {
	if (!status) return "读取中…";
	if (status.error) return `错误：${status.error}`;
	const counts = status.counts ?? {};
	const parts = Object.entries(counts).map(([key, value]) => `${key} ${value}`);
	return `必需 ${status.required ?? 0} · 漂移 ${(status.drifted ?? []).length} · ${parts.join(" / ")}`;
}

export function formatBootstrap(boot: BootstrapPayload | null): string {
	if (!boot) return "靶标读取中…";
	if (!boot.ok) return "靶标读取失败";
	const list = boot.engagements ?? [];
	if (list.length === 0) return "暂无靶标（用 redteam_engagement_open 创建）";
	const current = boot.current ? `当前：${boot.current}` : "未选择靶标";
	return `${current} · 共 ${list.length} 个`;
}

export function formatScore(score: ScorePayload | null): string {
	if (!score) return "得分读取中…";
	if (!score.ok) return `得分读取失败${score.error ? `：${score.error}` : ""}`;
	const summary = score.summary ?? {};
	return `得分 ${summary.achievedPoints ?? 0} · 计分命中 ${summary.countedHits ?? 0}/${summary.hitCount ?? 0}`;
}

/** 靶标列表 → 按钮标签（截断过长名称，保持 Dock 不换行）。 */
export function engagementLabel(item: { id: string; name?: string }, current: string | null | undefined): string {
	const text = item.name && item.name !== item.id ? `${item.name} (${item.id})` : item.id;
	const mark = current === item.id ? "● " : "";
	return mark + (text.length > 24 ? `${text.slice(0, 23)}…` : text);
}
