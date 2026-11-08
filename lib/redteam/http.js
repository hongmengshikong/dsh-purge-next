/** HTTP 桥：POST /redteam/api → dispatch(root, body)。 */
import { dispatchAsync, redteamRoot } from "./api.js";
function send(res, code, body) {
    const response = res;
    response.writeHead?.(code, { "content-type": "application/json; charset=utf-8" });
    response.end?.(JSON.stringify(body));
}
/** 兼容已解析 body / 事件流 / 异步迭代器三种请求形态。 */
export async function readJsonBody(req) {
    const request = req;
    if (request.body !== undefined) {
        if (typeof request.body === "string") {
            try {
                return JSON.parse(request.body);
            }
            catch {
                return {};
            }
        }
        if (request.body && typeof request.body === "object")
            return request.body;
    }
    const chunks = [];
    if (typeof request.on === "function") {
        return await new Promise((resolve) => {
            request.on?.("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
            request.on?.("end", () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
                }
                catch {
                    resolve({});
                }
            });
            request.on?.("error", () => resolve({}));
        });
    }
    if (typeof request[Symbol.asyncIterator] === "function") {
        for await (const chunk of request)
            chunks.push(Buffer.from(String(chunk)));
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    }
    catch {
        return {};
    }
}
export function installRedteamApi(server, dshHome) {
    server.register({
        kind: "exact",
        path: "/redteam/api",
        handler: async (req, res) => {
            const request = req;
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
