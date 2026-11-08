/** IP / CIDR 纯函数（与旧 lib/redteam/ip-utils.js 一致）。 */
export const ipToInt = (ip) => {
    const text = String(ip ?? "").trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(text))
        return null;
    return text.split(".").reduce((acc, part) => (acc * 256 + Number(part)) >>> 0, 0);
};
export function isIpv6(ip) {
    const text = String(ip ?? "").trim();
    if (!text.includes(":"))
        return false;
    return /^[0-9a-fA-F:]+(:\d{1,3}(\.\d{1,3}){3})?$/.test(text) && text.split(":").length <= 9;
}
export function expandIpv6(ip) {
    const text = String(ip ?? "").trim().replace(/^\[|\]$/g, "");
    const [head = "", tail] = text.split("::");
    const left = head === "" ? [] : head.split(":");
    const right = tail === undefined || tail === "" ? [] : tail.split(":");
    const missing = 8 - left.length - right.length;
    const groups = left.concat(new Array(Math.max(missing, 0)).fill("0")).concat(right);
    return groups.map((group) => (group === "" ? "0" : group.toLowerCase()));
}
/** IPv4 → 前三段 + .0/24；IPv6 → 前四组 + ::/64；认不出返回原文。 */
export const cidrOf = (ip) => {
    const text = String(ip ?? "").trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text))
        return `${text.split(".").slice(0, 3).join(".")}.0/24`;
    if (isIpv6(text))
        return `${expandIpv6(text).slice(0, 4).join(":")}::/64`;
    return text;
};
export function scopeOfIp(ip) {
    const text = String(ip ?? "");
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(text);
    if (mapped !== null)
        return scopeOfIp(mapped[1]);
    if (/^f[cd][0-9a-f]{2}:/i.test(text) || /^fe[89ab][0-9a-f]:/i.test(text))
        return "internal";
    if (/^(10\.|192\.168\.|127\.|169\.254\.)/.test(text))
        return "internal";
    const rfc1918 = /^172\.(\d{1,3})\./.exec(text);
    if (rfc1918 !== null) {
        const second = Number(rfc1918[1]);
        if (second >= 16 && second <= 31)
            return "internal";
    }
    const cgnat = /^100\.(\d{1,3})\./.exec(text);
    if (cgnat !== null) {
        const second = Number(cgnat[1]);
        if (second >= 64 && second <= 127)
            return "internal";
    }
    return "external";
}
