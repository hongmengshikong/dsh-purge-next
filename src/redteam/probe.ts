/** 会话连通性实测（host 侧），对齐旧 probeSessions。 */
import { connect } from "node:net";
import { dispatch } from "./api.js";

interface WebshellRow {
	id: number;
	url: string;
}

interface TunnelRow {
	id: number;
	kind?: string;
	listen?: string;
}

async function probeWebshell(timeout: number, row: WebshellRow): Promise<{ id: number; url: string; status: string; note: string; latency_ms: number }> {
	const started = Date.now();
	let status = "offline";
	let note = "";
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		const response = await fetch(row.url, { method: "GET", redirect: "manual", signal: controller.signal });
		clearTimeout(timer);
		status = response.status < 500 ? "online" : "offline";
		note = `HTTP ${response.status}`;
	} catch (error) {
		const err = error as Error;
		note = err?.name === "AbortError" ? `超时 >${timeout}ms` : String(err?.message || err).slice(0, 160);
	}
	return { id: row.id, url: row.url, status, note, latency_ms: Date.now() - started };
}

async function probeTunnel(timeout: number, row: TunnelRow): Promise<{ id: number; kind?: string; listen?: string; status: string; note: string; latency_ms: number }> {
	const target = String(row.listen || "")
		.replace(/^socks5:\/\//, "")
		.replace(/^https?:\/\//, "");
	const started = Date.now();
	let status = "down";
	let note = "";
	if (target === "") {
		note = "缺少 listen 地址，无法探测";
	} else {
		const index = target.lastIndexOf(":");
		const host = index > 0 ? target.slice(0, index) : "127.0.0.1";
		const port = Number(index > 0 ? target.slice(index + 1) : target);
		if (!Number.isFinite(port) || port <= 0) {
			note = `无法解析端口：${row.listen}`;
		} else {
			note = await new Promise<string>((resolve) => {
				let done = false;
				const socket = connect({ host, port });
				const finish = (ok: boolean, text: string): void => {
					if (done) return;
					done = true;
					try {
						socket.destroy();
					} catch {
						/* ignore */
					}
					resolve(ok ? "" : text);
				};
				socket.setTimeout(timeout);
				socket.on("connect", () => {
					status = "active";
					finish(true, "");
				});
				socket.on("timeout", () => finish(false, `超时 >${timeout}ms`));
				socket.on("error", (error: NodeJS.ErrnoException) => finish(false, String(error.code || error.message || error).slice(0, 120)));
			});
		}
	}
	return { id: row.id, kind: row.kind, listen: row.listen, status, note, latency_ms: Date.now() - started };
}

export async function probeSessions(root: string, engagement: string, options: { timeoutMs?: number } = {}): Promise<Record<string, unknown>> {
	const timeout = Math.min(Math.max(Number(options.timeoutMs) || 6000, 1000), 20000);
	const shells = (dispatch(root, { op: "webshells", engagement, limit: 500 }).items ?? []) as WebshellRow[];
	const tunnels = (dispatch(root, { op: "tunnels", engagement, limit: 500 }).items ?? []) as TunnelRow[];
	const out = { ok: true, webshells: [] as unknown[], tunnels: [] as unknown[], checkedAt: new Date().toISOString() };

	for (const shell of shells) {
		const result = await probeWebshell(timeout, shell);
		try {
			dispatch(root, {
				op: "updateWebshell",
				engagement,
				id: shell.id,
				patch: { status: result.status, last_check: new Date().toISOString(), latency_ms: result.latency_ms, check_note: result.note },
			});
		} catch {
			/* 更新失败不影响探测结果 */
		}
		out.webshells.push(result);
	}

	for (const tunnel of tunnels) {
		const result = await probeTunnel(timeout, tunnel);
		try {
			dispatch(root, {
				op: "updateTunnel",
				engagement,
				id: tunnel.id,
				patch: { status: result.status, last_check: new Date().toISOString(), latency_ms: result.latency_ms, check_note: result.note },
			});
		} catch {
			/* ignore */
		}
		out.tunnels.push(result);
	}
	return out;
}
