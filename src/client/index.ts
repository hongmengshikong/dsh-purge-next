/**
 * 浏览器端入口：浮层 Dock（补丁状态 + 演练台概览）。
 *
 * 数据源：
 *   GET  /dsh-purge-next/status
 *   POST /redteam/api  {op:"bootstrap"} / {op:"scores"}
 *   POST /dsh-purge-next/{apply,revert}
 */
import { createElement, useCallback, useEffect, useState } from "react";
import {
	engagementLabel,
	formatBootstrap,
	formatScore,
	formatStatus,
	type BootstrapPayload,
	type ScorePayload,
	type StatusPayload,
} from "./view-model.js";

export const name = "dsh-purge-next";
export const inject: string[] = ["slots"];

interface SlotApi {
	inject(slot: string, cb: () => unknown): unknown;
	register(spec: Record<string, unknown>, component: unknown): unknown;
}

interface ClientCtx {
	slots?: SlotApi;
}

const h = createElement;

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
	return (await response.json()) as T;
}

const postApi = <T,>(body: Record<string, unknown>): Promise<T> =>
	getJson<T>("/redteam/api", { method: "POST", body: JSON.stringify(body) });

const styles = {
	box: {
		position: "fixed",
		right: 16,
		bottom: 16,
		zIndex: 40,
		width: 300,
		background: "var(--dsw-alias-bg-layer-2, #fff)",
		border: "1px solid rgba(0,0,0,.12)",
		borderRadius: 10,
		padding: "10px 12px",
		fontSize: 12,
		boxShadow: "0 6px 20px rgba(0,0,0,.12)",
	} as const,
	muted: { opacity: 0.75, marginBottom: 6 } as const,
	row: { display: "flex", gap: 8, marginTop: 6 } as const,
	button: { padding: "4px 10px", cursor: "pointer" } as const,
	engagement: { padding: "2px 8px", cursor: "pointer", fontSize: 11 } as const,
};

export function Dock(): unknown {
	const [status, setStatus] = useState<StatusPayload | null>(null);
	const [boot, setBoot] = useState<BootstrapPayload | null>(null);
	const [score, setScore] = useState<ScorePayload | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			const [nextStatus, nextBoot] = await Promise.all([
				getJson<StatusPayload>("/dsh-purge-next/status"),
				postApi<BootstrapPayload>({ op: "bootstrap" }),
			]);
			setStatus(nextStatus);
			setBoot(nextBoot);
			const current = nextBoot.current;
			if (current) setScore(await postApi<ScorePayload>({ op: "scores", engagement: current }));
			else setScore(null);
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

	const activate = useCallback(
		async (id: string) => {
			setBusy(true);
			try {
				await postApi({ op: "activateEngagement", engagement: id });
				await load();
			} finally {
				setBusy(false);
			}
		},
		[load],
	);

	const engagements = boot?.engagements ?? [];

	return h(
		"div",
		{ className: "dshp-next-dock", "data-dsh-purge-next": "dock", style: styles.box },
		h("div", { style: { fontWeight: 600, marginBottom: 6 } }, "dsh-purge-next"),
		h("div", { style: styles.muted }, formatStatus(status)),
		h("div", { style: styles.muted }, formatBootstrap(boot)),
		h("div", { style: styles.muted }, formatScore(score)),
		engagements.length > 0
			? h(
					"div",
					{ style: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 } },
					...engagements.map((item) =>
						h(
							"button",
							{
								key: item.id,
								type: "button",
								disabled: busy,
								onClick: () => void activate(item.id),
								style: styles.engagement,
							},
							engagementLabel(item, boot?.current),
						),
					),
				)
			: null,
		h(
			"div",
			{ style: styles.row },
			h("button", { type: "button", disabled: busy, onClick: () => void act("/dsh-purge-next/apply"), style: styles.button }, "应用"),
			h("button", { type: "button", disabled: busy, onClick: () => void act("/dsh-purge-next/revert"), style: styles.button }, "还原"),
			h("button", { type: "button", disabled: busy, onClick: () => void load(), style: styles.button }, "刷新"),
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
