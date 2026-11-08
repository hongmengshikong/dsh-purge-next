import type { PluginCtx } from "./host/types.js";

/**
 * 主插件入口（骨架）。
 *
 * 与旧仓库的契约保持一致：默认导出 { name, inject, apply }，
 * 由 DSH 的 cordis loader 直接 import。补丁引擎、prompt 注入、HTTP 路由
 * 会在后续里程碑里接进来。
 */
export const name = "dsh-purge-next";
export const inject: string[] = [];

export function apply(_ctx: PluginCtx): void {
	/* 骨架：引擎与路由从这里挂载 */
}

export default { name, inject, apply };

