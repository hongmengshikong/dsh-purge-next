/**
 * 浏览器端入口：设置页/浮层骨架。
 *
 * 通过 `slots.inject("shell.overlay")` 注册一个浮动 Dock：
 *   - 显示 /dsh-purge-next/status 的计数与必需补丁状态；
 *   - 提供「应用」「还原」两个按钮（POST /dsh-purge-next/{apply,revert}）。
 * 渲染只用 createElement，避免为 UI 引入 JSX 配置。
 */
import { createElement, useCallback, useEffect, useState } from "react";

export const name = "dsh-purge-next";
export const inject: string[] = ["slots"];

interface StatusPayload {
	ok: boolean;
	counts?: Record<string, number>;
	required?: number;
	required_bad?: unknown[];
	drifted?: unknown[];
	error?: string;
}

interface SlotApi {
	inject(slot: string, cb: () => unknown): unknown;
	register(spec: Record<string, unknown>, component: unknown): unknown;
}

interface ClientCtx {
	slots?: SlotApi;
}

const h = createElement;

async function getJson(path: string, init?: RequestInit): Promise<StatusPayload> {
	const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
	return (await response.json()) as StatusPayload;
}

function summaryText(status: StatusPayload | null): string {
	if (!status) return "读取中…";
	if (status.error) return `错误：${status.error}`;
	const counts = status.counts ?? {};
	const parts = Object.entries(counts).map(([key, value]) => `${key} ${value}`);
	return `必需 ${status.required ?? 0} · 漂移 ${(status.drifted ?? []).length} · ${parts.join(" / ")}`;
}

export function Dock(): unknown {
	const [status, setStatus] = useState<StatusPayload | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			setStatus(await getJson("/dsh-purge-next/status"));
		} catch (error) {
			setStatus({ ok: false, error: error instanceof Error ? error.message : String(error) });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const act = useCallback(
		async (path: string) => {
			setBusy(true);
			try {
				await getJson(path, { method: "POST" });
				await load();
			} finally {
				setBusy(false);
			}
		},
		[load],
	);

	return h(
		"div",
		{
			className: "dshp-next-dock",
			"data-dsh-purge-next": "dock",
			style: {
				position: "fixed",
				right: 16,
				bottom: 16,
				zIndex: 40,
				background: "var(--dsw-alias-bg-layer-2, #fff)",
				border: "1px solid rgba(0,0,0,.12)",
				borderRadius: 10,
				padding: "10px 12px",
				fontSize: 12,
				boxShadow: "0 6px 20px rgba(0,0,0,.12)",
			},
		},
		h("div", { style: { fontWeight: 600, marginBottom: 6 } }, "dsh-purge-next"),
		h("div", { style: { opacity: 0.75, marginBottom: 8 } }, summaryText(status)),
		h(
			"div",
			{ style: { display: "flex", gap: 8 } },
			h(
				"button",
				{
					type: "button",
					disabled: busy,
					onClick: () => void act("/dsh-purge-next/apply"),
					style: { padding: "4px 10px", cursor: busy ? "default" : "pointer" },
				},
				"应用",
			),
			h(
				"button",
				{ type: "button", disabled: busy, onClick: () => void act("/dsh-purge-next/revert") },
				"还原",
			),
		),
	);
}

export function apply(ctx: ClientCtx): void {
	try {
		if (typeof document !== "undefined" && document.body) document.body.setAttribute("data-dsh-purge-next", "loaded");
	} catch {
		/* 非浏览器环境忽略 */
	}
	const slots = ctx?.slots;
	if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
	slots.inject("shell.overlay", () => slots.register({ name: "shell.overlay", id: "dsh-purge-next-dock", order: 60 }, Dock));
}

export default { name, inject, apply, Dock };
