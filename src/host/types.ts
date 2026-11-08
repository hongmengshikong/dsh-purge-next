/**
 * 宿主侧最小契约。
 *
 * 只声明本插件真正用到的成员；不复制 @deepseek-ai/* 的 8,553 个 .d.ts，
 * 避免跟随宿主 rc 版本频繁返工。新增成员时在这里补一行即可。
 */

export interface Disposable {
	(): void;
}

export interface Logger {
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
	debug?(...args: unknown[]): void;
}

export interface PluginCtx {
	readonly logger: Logger;
	/** 订阅宿主事件，返回 disposer */
	on(event: string, handler: (...args: unknown[]) => unknown): Disposable;
	/** 生命周期副作用，返回 disposer */
	effect(fn: () => Disposable | void): Disposable;
	/** 读宿主服务（可能不存在） */
	get<T = unknown>(name: string): T | undefined;
	/** 提供插件自身服务 */
	provide(name: string, value: unknown): void;
	/** 工具注册（宿主注入在 tools 服务上，这里只描述最小面） */
	readonly tools?: {
		register(def: ToolDef): Disposable;
	};
	readonly settings?: {
		configure(schema: unknown, fiber?: unknown): Disposable;
	};
	readonly webServer?: {
		register(route: { kind: "exact" | "prefix"; path: string; handler: (req: unknown, res: unknown) => unknown }): Disposable;
	};
}

export interface ToolDef {
	name: string;
	description: string;
	input?: Record<string, unknown>;
	output?: Record<string, unknown>;
	execute(args: Record<string, unknown>, exec?: unknown): unknown;
}

export interface PluginModule {
	name: string;
	inject: string[];
	apply(ctx: PluginCtx): void;
}
