/**
 * 浏览器端入口：挂载 DockShell 应用（清洗 / 演练台 / 技能库 / 知识库 / 环境适配）。
 * 页面实现位于 ./pages/*.ts，框架组件位于 ./ui.ts。
 */
import { App } from "./app.js";

export const name = "dsh-purge-next";
export const inject: string[] = ["slots"];

interface SlotApi {
	inject(slot: string, cb: () => unknown): unknown;
	register(spec: Record<string, unknown>, component: unknown): unknown;
}

interface ClientCtx {
	slots?: SlotApi;
}

/** 兼容旧命名。 */
export const Panel = App;
export const Dock = App;

export function apply(ctx: ClientCtx): void {
	try {
		if (typeof document !== "undefined" && document.body) document.body.setAttribute("data-dsh-purge-next", "loaded");
	} catch {
		/* 非浏览器环境忽略 */
	}
	const slots = ctx?.slots;
	if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
	slots.inject("shell.overlay", () => slots.register({ name: "shell.overlay", id: "dsh-purge-next-dock", order: 60 }, App));
}

export default { name, inject, apply, Panel, Dock };
