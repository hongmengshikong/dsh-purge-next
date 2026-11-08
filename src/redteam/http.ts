/** HTTP 桥：POST /redteam/api → dispatch(root, body)。 */
import { dispatchAsync, redteamRoot } from "./api.js";

interface HttpResponse {
	writeHead?(code: number, headers?: Record<string, string>): void;
	end?(body?: string): void;
}

function send(res: unknown, code: number, body: unknown): void {
	const response = res as HttpResponse;
	response.writeHead?.(code, { "content-type": "application/json; charset=utf-8" });
	response.end?.(JSON.stringify(body));
}

/** 兼容已解析 body / 事件流 / 异步迭代器三种请求形态。 */
export async function readJsonBody(req: unknown): Promise<Record<string, unknown>> {
	const request = req as {
		body?: unknown;
		method?: string;
		on?: (event: string, cb: (...args: unknown[]) => void) => void;
		[Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
	};

	if (request.body !== undefined) {
		if (typeof request.body === "string") {
			try {
				return JSON.parse(request.body) as Record<string, unknown>;
			} catch {
				return {};
			}
		}
		if (request.body && typeof request.body === "object") return request.body as Record<string, unknown>;
	}

	const chunks: Buffer[] = [];
	if (typeof request.on === "function") {
		return await new Promise<Record<string, unknown>>((resolve) => {
			request.on?.("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
			request.on?.("end", () => {
				try {
					resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>);
				} catch {
					resolve({});
				}
			});
			request.on?.("error", () => resolve({}));
		});
	}
	if (typeof request[Symbol.asyncIterator] === "function") {
		for await (const chunk of request as AsyncIterable<unknown>) chunks.push(Buffer.from(String(chunk)));
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
	} catch {
		return {};
	}
}

export function installRedteamApi(server: {
	register(route: { kind: "exact" | "prefix"; path: string; handler: (req: unknown, res: unknown) => unknown }): unknown;
}, dshHome: string): void {
	server.register({
		kind: "exact",
		path: "/redteam/api",
		handler: async (req, res) => {
			const request = req as { method?: string };
			if (request.method !== "POST") {
				send(res, 405, { ok: false, error: "method not allowed" });
				return undefined;
			}
			const body = await readJsonBody(req);
			send(res, 200, await dispatchAsync(redteamRoot(dshHome), body));
			return undefined;
		},
	});
}
