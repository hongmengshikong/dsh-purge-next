/**
 * 浏览器端入口（PoC）。
 *
 * 这里故意 import react，用来验证 esbuild 产物在 __ModuleLoader__ 里
 * 通过 factory(require) 拿到宿主 react 的路径是通的。
 */
import { createElement, useEffect, useState } from "react";

export const name = "dsh-purge-next";
export const inject: string[] = ["slots", "locale", "uiConversation"];

export function Panel(): unknown {
	const [count] = useState(0);
	useEffect(() => undefined, []);
	return createElement("div", { className: "dshp-next" }, `dsh-purge-next · ${count}`);
}

export function apply(_ctx: unknown): void {
	/* PoC 标记：client bundle 真的被执行过，headless 检查用。 */
	try {
		if (typeof document !== "undefined" && document.body) {
			document.body.setAttribute("data-dsh-purge-next", "loaded");
		}
	} catch {
		/* 非浏览器环境忽略 */
	}
}

export default { name, inject, apply, Panel };

