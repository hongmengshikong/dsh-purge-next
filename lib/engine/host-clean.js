/** 判定「宿主提示词已清洗」用的标记（与旧 lib/host-clean.js 一致）。 */
export const HOST_CLEAN_MARKERS = {
    identity: "[dsh-purge] identity stripped",
    inject: [
        "[dsh-purge] complete prompt keeps waterfall inject",
        "[dsh-purge] complete prompt keeps inject",
        "[dsh-purge] fold-complete inject first",
    ],
    // 0.2.2 合法代码里有 `… transformed.sections : [completeSection]` 的三元尾巴，
    // 只认整行赋值形态，避免把正常代码误判成「inject 被丢掉」。
    drops: ["sections: [completeSection]", "sections : [completeSection]"],
};
/** 重启前看系统提示词文件：标记写上了，或者当前原文里已经没有那两处旧拦截。 */
export function hostPromptKeepsInject(text) {
    const body = String(text ?? "");
    if (body.includes(HOST_CLEAN_MARKERS.identity))
        return true;
    if (!body.includes("system-prompt/assemble"))
        return false;
    const identityLeft = body.includes("You are an AI agent powered by DeepSeek Harness.");
    const ternaryShape = body.includes("completeSection ===");
    const dropsInject = !ternaryShape && HOST_CLEAN_MARKERS.drops.some((marker) => body.includes(marker));
    return !identityLeft && !dropsInject;
}
