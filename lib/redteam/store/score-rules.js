/** 从 target 里解析端口：`http://h:8080/x`、`10.0.0.5:6379`、`10.0.0.5:22`。 */
export function parseTargetPort(target) {
    const text = String(target ?? "").trim();
    if (text === "")
        return null;
    const url = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\s]+)/i.exec(text);
    const authority = url !== null ? (url[1] ?? "") : (/^([^\s/?#]+)/.exec(text) ?? [])[1] ?? "";
    if (!authority)
        return null;
    const match = /:(\d{1,5})$/.exec(authority);
    if (match === null)
        return null;
    const value = Number(match[1]);
    return Number.isInteger(value) && value > 0 && value <= 65535 ? value : null;
}
/** 库列的 port 值（老库可能是 null/0/空串）。 */
export function normalizePort(value) {
    if (value === null || value === undefined || value === "")
        return null;
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= 65535 ? number : null;
}
