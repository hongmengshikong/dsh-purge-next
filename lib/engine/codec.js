/** `{ regex, flags }` 在 JSON 里表示 RegExp；载入时还原，引擎才能用 instanceof 判定。 */
export function isEncodedRegex(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((k) => k === "regex" || k === "flags") && typeof value.regex === "string";
}
export function decodePattern(value) {
    if (isEncodedRegex(value))
        return new RegExp(value.regex, value.flags ?? "");
    return value;
}
export function decodeReplacement(replacement) {
    return { ...replacement, pattern: decodePattern(replacement.pattern) };
}
/** 数组/对象递归解码，供整表载入时一次性处理。 */
export function decodeDeep(value) {
    if (isEncodedRegex(value))
        return new RegExp(value.regex, value.flags ?? "");
    if (Array.isArray(value))
        return value.map((item) => decodeDeep(item));
    if (value && typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value))
            out[k] = decodeDeep(v);
        return out;
    }
    return value;
}
