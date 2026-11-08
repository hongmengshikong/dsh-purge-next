import type { PluginCtx } from "../host/types.js";

/** 红队演练台的 Cordis 插件壳；数据层在 ./store。 */
export const name = "dsh-purge-redteam";
export const inject: string[] = [];

export function apply(_ctx: PluginCtx): void {
	/* 骨架：后续在这里注册 tools / webServer 路由 / slots */
}

export default { name, inject, apply };
