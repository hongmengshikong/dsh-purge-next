/**
 * client PoC 的自动验证：用 vm 模拟 DSH 的 __ModuleLoader__，
 * 确认 esbuild 产物能被 factory(require) 加载并导出 { name, inject, apply }。
 *
 * 依赖根目录已构建的 client.js（npm run build）。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import vm from "node:vm";

interface LoadedModule {
	id: string;
	factory: (requireFn: (id: string) => unknown) => Record<string, unknown>;
}

const CLIENT_PATH = new URL("../client.js", import.meta.url);
const code = readFileSync(CLIENT_PATH, "utf8");

function loadBundle(): { mod: LoadedModule; exportsObj: Record<string, unknown>; bytes: number } {
	const loaded: LoadedModule[] = [];
	const sandbox = {
		window: {
			__ModuleLoader__: {
				load(mod: LoadedModule) {
					loaded.push(mod);
				},
			},
		},
		console,
	};
	vm.createContext(sandbox);
	vm.runInContext(code, sandbox, { filename: "client.js" });

	assert.equal(loaded.length, 1, "expected exactly one __ModuleLoader__.load() call");
	const mod = loaded[0] as LoadedModule;
	assert.equal(mod.id, "dsh-purge-next");
	assert.equal(typeof mod.factory, "function");

	const reactStub = {
		createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
		useState: (init: unknown) => [init, () => undefined],
		useEffect: () => undefined,
		useRef: (init: unknown) => ({ current: init }),
		useCallback: (fn: unknown) => fn,
		Component: class {},
	};
	const requireStub = (id: string): unknown => {
		if (id === "react") return reactStub;
		if (id === "react-dom") return { createPortal: (node: unknown) => node };
		throw new Error(`unexpected require: ${id}`);
	};

	const exportsObj = mod.factory(requireStub);
	return { mod, exportsObj, bytes: Buffer.byteLength(code) };
}

describe("client bundle（__ModuleLoader__ 包装）", () => {
	it("id / inject / apply 形状正确，apply 不抛", () => {
		const { mod, exportsObj, bytes } = loadBundle();
		expect(mod.id).toBe("dsh-purge-next");
		expect(typeof exportsObj.apply).toBe("function");
		expect(Array.isArray(exportsObj.inject)).toBe(true);
		expect(exportsObj.name).toBe("dsh-purge-next");
		expect(typeof exportsObj.Dock).toBe("function");
		let slotName = "";
		let registered: Record<string, unknown> | null = null;
		const ctx = {
			slots: {
				inject: (name: string, cb: () => unknown) => {
					slotName = name;
					cb();
				},
				register: (spec: Record<string, unknown>) => {
					registered = spec;
					return () => undefined;
				},
			},
		};
		expect(() => (exportsObj.apply as (ctx: unknown) => void)(ctx)).not.toThrow();
		expect(slotName).toBe("shell.overlay");
		expect(registered).toMatchObject({ id: "dsh-purge-next-dock" });
		expect(bytes).toBeGreaterThan(500);
	});
});
