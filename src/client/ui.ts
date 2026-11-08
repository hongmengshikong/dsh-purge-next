/** 轻量 UI 框架：DockShell（拖拽/缩放/持久化）+ 基础组件，零依赖，React 由宿主提供。 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";

const h = createElement;

export interface TabItem {
	id: string;
	label: string;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

const MIN_W = 380;
const MIN_H = 260;

function clampRect(rect: Rect): Rect {
	const vw = typeof window === "undefined" ? 1400 : window.innerWidth;
	const vh = typeof window === "undefined" ? 900 : window.innerHeight;
	const w = Math.min(Math.max(rect.w, MIN_W), Math.max(MIN_W, vw - 16));
	const hgt = Math.min(Math.max(rect.h, MIN_H), Math.max(MIN_H, vh - 16));
	return {
		w,
		h: hgt,
		x: Math.min(Math.max(8, rect.x), Math.max(8, vw - w - 8)),
		y: Math.min(Math.max(8, rect.y), Math.max(8, vh - 48)),
	};
}

function defaultRect(): Rect {
	const vw = typeof window === "undefined" ? 1400 : window.innerWidth;
	const vh = typeof window === "undefined" ? 900 : window.innerHeight;
	const w = Math.min(720, Math.max(MIN_W, vw - 32));
	const hgt = Math.min(640, Math.max(MIN_H, vh - 96));
	return { x: Math.max(8, vw - w - 20), y: Math.max(8, vh - hgt - 24), w, h: hgt };
}

function loadRect(key: string): Rect {
	try {
		const raw = localStorage.getItem(key);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<Rect>;
			if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.w === "number" && typeof parsed.h === "number") {
				return clampRect(parsed as Rect);
			}
		}
	} catch {
		/* ignore */
	}
	return defaultRect();
}

let styled = false;
function injectStyles(): void {
	if (styled || typeof document === "undefined") return;
	styled = true;
	const style = document.createElement("style");
	style.textContent = `
.dshp-ui-panel{position:fixed;z-index:60;display:flex;flex-direction:column;overflow:hidden;
  background:var(--dsw-alias-bg-layer-2,#1b1f27);color:var(--dsw-alias-label-primary,#e6e6e6);
  border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.42);
  font:12px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.dshp-ui-head{display:flex;align-items:center;gap:8px;padding:8px 10px;user-select:none;cursor:grab;
  background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border-bottom:1px solid rgba(255,255,255,.08);touch-action:none}
.dshp-ui-head:active{cursor:grabbing}
.dshp-ui-grip{opacity:.45;letter-spacing:-2px}
.dshp-ui-title{font-weight:700;letter-spacing:.2px;white-space:nowrap}
.dshp-ui-tabs{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:none}
.dshp-ui-tabs::-webkit-scrollbar{display:none}
.dshp-ui-tab{padding:3px 10px;border-radius:999px;cursor:pointer;opacity:.72;white-space:nowrap;font-size:11.5px;border:1px solid transparent}
.dshp-ui-tab:hover{opacity:1;background:rgba(255,255,255,.06)}
.dshp-ui-tab[data-on="1"]{opacity:1;font-weight:600;background:rgba(99,102,241,.24);border-color:rgba(99,102,241,.45);color:#dbe4ff}
.dshp-ui-icon{border:none;background:transparent;color:inherit;cursor:pointer;opacity:.62;font-size:14px;line-height:1;padding:2px 4px;border-radius:6px}
.dshp-ui-icon:hover{opacity:1;background:rgba(255,255,255,.08)}
.dshp-ui-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.dshp-ui-body::-webkit-scrollbar{width:10px;height:10px}
.dshp-ui-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:999px;border:2px solid transparent;background-clip:content-box}
.dshp-ui-resize{position:absolute;right:2px;bottom:2px;width:14px;height:14px;cursor:nwse-resize;
  background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.28) 50%);border-radius:3px}
.dshp-ui-card{border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.025)}
.dshp-ui-card-title{font-weight:600;font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:8px;justify-content:space-between}
.dshp-ui-btn{padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font-size:12px}
.dshp-ui-btn:hover:not(:disabled){background:rgba(255,255,255,.11)}
.dshp-ui-btn:disabled{opacity:.45;cursor:not-allowed}
.dshp-ui-btn[data-variant="primary"]{border-color:rgba(99,102,241,.55);background:rgba(99,102,241,.3);color:#e0e7ff;font-weight:600}
.dshp-ui-btn[data-variant="danger"]{border-color:rgba(248,113,113,.45);background:rgba(248,113,113,.16);color:#fecaca}
.dshp-ui-input,.dshp-ui-area{font:inherit;font-size:11.5px;padding:5px 8px;border-radius:7px;border:1px solid rgba(255,255,255,.14);
  background:rgba(0,0,0,.22);color:inherit;min-width:0}
.dshp-ui-area{width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical}
.dshp-ui-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dshp-ui-table{width:100%;border-collapse:collapse;font-size:11.5px}
.dshp-ui-table th{text-align:left;font-weight:500;opacity:.6;padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.1)}
.dshp-ui-table td{padding:2px 6px;border-bottom:1px solid rgba(255,255,255,.05)}
.dshp-ui-table tr:hover td{background:rgba(255,255,255,.03)}
.dshp-ui-badge{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10.5px;background:rgba(255,255,255,.08)}
.dshp-ui-badge[data-tone="ok"]{background:rgba(34,197,94,.16);color:#86efac}
.dshp-ui-badge[data-tone="warn"]{background:rgba(234,179,8,.16);color:#fde68a}
.dshp-ui-badge[data-tone="bad"]{background:rgba(248,113,113,.16);color:#fecaca}
.dshp-ui-muted{opacity:.68}
.dshp-ui-empty{padding:18px;text-align:center;opacity:.5}
`;
	document.head.appendChild(style);
}

export function DockShell(props: {
	title: string;
	tabs: TabItem[];
	active: string;
	onTab: (id: string) => void;
	storageKey?: string;
	children?: unknown;
}): unknown {
	injectStyles();
	const key = props.storageKey ?? "dshp-ui-geom";
	const [rect, setRect] = useState<Rect>(() => loadRect(key));
	const [collapsed, setCollapsed] = useState(false);
	const drag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; rect: Rect } | null>(null);

	const start = useCallback(
		(mode: "move" | "resize") => (event: { clientX: number; clientY: number; button?: number; currentTarget: { setPointerCapture?: (id: number) => void }; pointerId: number }) => {
			if (event.button !== undefined && event.button !== 0) return;
			drag.current = { mode, sx: event.clientX, sy: event.clientY, rect };
			event.currentTarget.setPointerCapture?.(event.pointerId);
		},
		[rect],
	);

	const move = useCallback((event: { clientX: number; clientY: number }) => {
		const info = drag.current;
		if (!info) return;
		const dx = event.clientX - info.sx;
		const dy = event.clientY - info.sy;
		if (info.mode === "move") setRect(clampRect({ ...info.rect, x: info.rect.x + dx, y: info.rect.y + dy }));
		else setRect(clampRect({ ...info.rect, w: info.rect.w + dx, h: info.rect.h + dy }));
	}, []);

	const end = useCallback(() => {
		if (!drag.current) return;
		drag.current = null;
		try {
			localStorage.setItem(key, JSON.stringify(rect));
		} catch {
			/* ignore */
		}
	}, [key, rect]);

	return h(
		"div",
		{ className: "dshp-ui-panel", style: { left: rect.x, top: rect.y, width: rect.w, height: collapsed ? "auto" : rect.h } },
		h(
			"div",
			{ className: "dshp-ui-head", onPointerDown: start("move"), onPointerMove: move, onPointerUp: end, onPointerCancel: end },
			h("span", { className: "dshp-ui-grip" }, "⠿"),
			h("strong", { className: "dshp-ui-title" }, props.title),
			h(
				"div",
				{ className: "dshp-ui-tabs", onPointerDown: (event: { stopPropagation: () => void }) => event.stopPropagation() },
				...props.tabs.map((tab) =>
					h("span", {
						key: tab.id,
						className: "dshp-ui-tab",
						"data-on": tab.id === props.active ? "1" : "0",
						onClick: () => props.onTab(tab.id),
					}, tab.label),
				),
			),
			h("button", { type: "button", className: "dshp-ui-icon", title: "回到默认位置", onClick: () => setRect(defaultRect()) }, "⟲"),
			h("button", { type: "button", className: "dshp-ui-icon", title: collapsed ? "展开" : "收起", onClick: () => setCollapsed(!collapsed) }, collapsed ? "▢" : "—"),
		),
		collapsed ? null : h("div", { className: "dshp-ui-body" }, props.children),
		collapsed
			? null
			: h("div", {
					className: "dshp-ui-resize",
					onPointerDown: start("resize"),
					onPointerMove: move,
					onPointerUp: end,
					onPointerCancel: end,
				}),
	);
}

export function Card(props: { title?: string; actions?: unknown; children?: unknown }): unknown {
	return h("div", { className: "dshp-ui-card" },
		props.title ? h("div", { className: "dshp-ui-card-title" }, props.title, props.actions ?? null) : null,
		props.children,
	);
}

export function Btn(props: { children?: unknown; onClick?: () => void; disabled?: boolean; variant?: "primary" | "danger"; title?: string }): unknown {
	return h("button", {
		type: "button",
		className: "dshp-ui-btn",
		"data-variant": props.variant,
		disabled: props.disabled,
		title: props.title,
		onClick: props.onClick,
	}, props.children);
}

export function Badge(props: { children?: unknown; tone?: "ok" | "warn" | "bad" }): unknown {
	return h("span", { className: "dshp-ui-badge", "data-tone": props.tone }, props.children);
}

export function Table(props: { head: string[]; rows: unknown[][] }): unknown {
	return h("table", { className: "dshp-ui-table" },
		h("thead", null, h("tr", null, ...props.head.map((title) => h("th", { key: title }, title)))),
		h("tbody", null, ...props.rows.map((row, index) => h("tr", { key: index }, ...row.map((cell, cellIndex) => h("td", { key: cellIndex }, cell))))),
	);
}

export function Input(props: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string; style?: Record<string, unknown> }): unknown {
	return h("input", {
		className: "dshp-ui-input",
		type: props.type ?? "text",
		value: props.value,
		placeholder: props.placeholder,
		style: props.style,
		onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
	});
}

export function TextArea(props: { value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; style?: Record<string, unknown> }): unknown {
	return h("textarea", {
		className: "dshp-ui-area",
		value: props.value,
		placeholder: props.placeholder,
		rows: props.rows ?? 6,
		style: props.style,
		onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
	});
}

export function Select(props: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; style?: Record<string, unknown> }): unknown {
	return h("select", {
		className: "dshp-ui-input",
		value: props.value,
		style: props.style,
		onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
	}, ...props.options.map((option) => h("option", { key: option.value, value: option.value }, option.label)));
}

export function Toolbar(props: { children?: unknown }): unknown {
	return h("div", { className: "dshp-ui-row" }, props.children);
}

export function Muted(props: { children?: unknown }): unknown {
	return h("div", { className: "dshp-ui-muted" }, props.children);
}

export function Empty(props: { children?: unknown }): unknown {
	return h("div", { className: "dshp-ui-empty" }, props.children ?? "暂无数据");
}
