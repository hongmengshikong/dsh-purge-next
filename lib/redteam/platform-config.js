/** 平台适配配置（对齐 dsh-purge 1.1.71 platform-config.js）。 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, platform as osPlatform } from "node:os";
import { delimiter, isAbsolute, join, resolve, sep } from "node:path";
export const TOOL_CATALOG = [
    { id: "nmap", label: "Nmap", names: ["nmap.exe", "nmap"] },
    { id: "nuclei", label: "Nuclei", names: ["nuclei.exe", "nuclei"] },
    { id: "masscan", label: "Masscan", names: ["masscan.exe", "masscan"] },
    { id: "fscan", label: "fscan", names: ["fscan.exe", "fscan"] },
    { id: "gogo", label: "gogo", names: ["gogo.exe", "gogo"] },
    { id: "suo5", label: "suo5", names: ["suo5.exe", "suo5-windows-amd64.exe", "suo5-linux-amd64", "suo5"] },
    { id: "frpc", label: "frp 客户端", names: ["frpc.exe", "frpc"] },
    { id: "frps", label: "frp 服务端", names: ["frps.exe", "frps"] },
    { id: "chisel", label: "chisel", names: ["chisel.exe", "chisel"] },
    { id: "ffuf", label: "ffuf", names: ["ffuf.exe", "ffuf"] },
    { id: "httpx", label: "httpx", names: ["httpx-toolkit", "pd-httpx", "httpx.exe", "httpx"], rejectPython: true, adapt: [/^httpx-toolkit$/, /^pd-httpx$/, /^httpx$/] },
    { id: "dnsx", label: "dnsx", names: ["dnsx.exe", "dnsx"] },
    { id: "subfinder", label: "subfinder", names: ["subfinder.exe", "subfinder"] },
    { id: "ksubdomain", label: "ksubdomain", names: ["ksubdomain.exe", "ksubdomain"] },
    { id: "impacket", label: "impacket（目录或入口）", names: ["impacket-secretsdump", "impacket-secretsdump.exe", "secretsdump.py", "impacket"], adapt: [/^impacket-secretsdump$/, /^secretsdump\.py$/] },
];
function emptyConfig() {
    return {
        version: 1,
        platform: "auto",
        toolkitDir: "",
        nucleiTemplatesDir: "",
        binDirs: [],
        tools: Object.fromEntries(TOOL_CATALOG.map((tool) => [tool.id, ""])),
        env: { FOFA_KEY: "", REDTEAM_VPS_HOST: "", REDTEAM_VPS_KEY: "" },
        notes: "",
        envAdaptSkip: false,
        envAdaptConfigured: false,
        updated_at: null,
    };
}
export function configPathOf(root) {
    return join(root || ".", "config.json");
}
export function defaultToolkitDir(root) {
    return join(root || ".", "toolkit");
}
function isWinLike(cfg) {
    const target = cfg.platform || "auto";
    if (target === "windows")
        return true;
    if (target === "linux")
        return false;
    return osPlatform() === "win32";
}
export function loadPlatformConfig(root) {
    const base = emptyConfig();
    const file = configPathOf(root);
    if (!existsSync(file))
        return { ...base, path: file, exists: false };
    try {
        const raw = JSON.parse(readFileSync(file, "utf8"));
        const tools = { ...base.tools, ...(raw.tools && typeof raw.tools === "object" ? raw.tools : {}) };
        const env = { ...base.env, ...(raw.env && typeof raw.env === "object" ? raw.env : {}) };
        const binDirs = Array.isArray(raw.binDirs) ? raw.binDirs.map((item) => String(item || "").trim()).filter(Boolean) : [];
        return {
            version: Number(raw.version) || 1,
            platform: ["auto", "windows", "linux"].includes(String(raw.platform)) ? raw.platform : "auto",
            toolkitDir: typeof raw.toolkitDir === "string" ? raw.toolkitDir.trim() : "",
            nucleiTemplatesDir: typeof raw.nucleiTemplatesDir === "string" ? raw.nucleiTemplatesDir.trim() : "",
            binDirs,
            tools,
            env,
            notes: typeof raw.notes === "string" ? raw.notes : "",
            envAdaptSkip: Boolean(raw.envAdaptSkip),
            envAdaptConfigured: Boolean(raw.envAdaptConfigured),
            updated_at: raw.updated_at ?? null,
            path: file,
            exists: true,
        };
    }
    catch (error) {
        return { ...base, path: file, exists: true, error: error instanceof Error ? error.message : String(error) };
    }
}
export function savePlatformConfig(patch, root) {
    mkdirSync(root, { recursive: true });
    const prev = loadPlatformConfig(root);
    const next = {
        version: 1,
        platform: ["auto", "windows", "linux"].includes(String(patch.platform)) ? patch.platform : prev.platform || "auto",
        toolkitDir: typeof patch.toolkitDir === "string" ? patch.toolkitDir.trim() : prev.toolkitDir || "",
        nucleiTemplatesDir: typeof patch.nucleiTemplatesDir === "string" ? patch.nucleiTemplatesDir.trim() : prev.nucleiTemplatesDir || "",
        binDirs: Array.isArray(patch.binDirs) ? patch.binDirs.map((item) => String(item || "").trim()).filter(Boolean) : prev.binDirs || [],
        tools: { ...(prev.tools || {}), ...(patch.tools && typeof patch.tools === "object" ? patch.tools : {}) },
        env: { ...(prev.env || {}), ...(patch.env && typeof patch.env === "object" ? patch.env : {}) },
        notes: typeof patch.notes === "string" ? patch.notes : prev.notes || "",
        envAdaptSkip: patch.envAdaptSkip !== undefined ? Boolean(patch.envAdaptSkip) : Boolean(prev.envAdaptSkip),
        envAdaptConfigured: patch.envAdaptConfigured !== undefined ? Boolean(patch.envAdaptConfigured) : Boolean(prev.envAdaptConfigured),
        updated_at: new Date().toISOString(),
    };
    for (const tool of TOOL_CATALOG) {
        if (next.tools[tool.id] === undefined || next.tools[tool.id] === null)
            next.tools[tool.id] = "";
        else
            next.tools[tool.id] = String(next.tools[tool.id]).trim();
    }
    writeFileSync(configPathOf(root), JSON.stringify(next, null, 2), "utf8");
    return loadPlatformConfig(root);
}
export function toolkitDirOf(cfg, root) {
    const config = cfg || loadPlatformConfig(root);
    return config.toolkitDir ? resolve(config.toolkitDir) : defaultToolkitDir(root);
}
export function nucleiTemplatesDirOf(cfg, root) {
    const config = cfg || loadPlatformConfig(root);
    if (config.nucleiTemplatesDir && existsSync(config.nucleiTemplatesDir))
        return resolve(config.nucleiTemplatesDir);
    return null;
}
function looksLikePythonCli(file) {
    let fd;
    try {
        const buffer = Buffer.alloc(96);
        fd = openSync(file, "r");
        const read = readSync(fd, buffer, 0, buffer.length, 0);
        const head = buffer.subarray(0, read).toString("utf8");
        return head.startsWith("#!") && /python/i.test(head);
    }
    catch {
        return false;
    }
    finally {
        if (fd !== undefined) {
            try {
                closeSync(fd);
            }
            catch {
                /* ignore */
            }
        }
    }
}
function adaptInDir(dir, options) {
    const patterns = options.adapt;
    if (!dir || !Array.isArray(patterns) || patterns.length === 0 || !existsSync(dir))
        return null;
    let names;
    try {
        names = readdirSync(dir);
    }
    catch {
        return null;
    }
    for (const pattern of patterns) {
        for (const name of names) {
            if (!pattern.test(String(name).toLowerCase()))
                continue;
            const file = join(dir, name);
            try {
                if (!statSync(file).isFile())
                    continue;
                if (options.rejectPython && looksLikePythonCli(file))
                    continue;
                return file;
            }
            catch {
                /* continue */
            }
        }
    }
    return null;
}
function findInDir(dir, names, options = {}) {
    if (!dir || !existsSync(dir))
        return null;
    const tryOne = (base) => {
        for (const name of names) {
            const candidate = join(base, name);
            if (!existsSync(candidate))
                continue;
            try {
                const stat = statSync(candidate);
                if (!stat.isFile())
                    continue;
                if (options.rejectPython && looksLikePythonCli(candidate))
                    continue;
                return candidate;
            }
            catch {
                /* continue */
            }
        }
        return null;
    };
    const hit = tryOne(dir) || adaptInDir(dir, options);
    if (hit)
        return hit;
    for (const sub of ["bin", "Bins", "tools", "Tools"]) {
        const nested = tryOne(join(dir, sub)) || adaptInDir(join(dir, sub), options);
        if (nested)
            return nested;
    }
    return null;
}
function findOnPath(names, env, options = {}) {
    const pathVar = env.PATH || env.Path || "";
    for (const part of pathVar.split(delimiter).filter(Boolean)) {
        const hit = findInDir(part, names, options);
        if (hit)
            return hit;
    }
    return null;
}
function linuxFallbackDirs(env) {
    const home = env.HOME || homedir();
    const dirs = ["/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin", "/bin", "/snap/bin"];
    if (home)
        dirs.push(join(home, "go", "bin"), join(home, ".local", "bin"), join(home, ".pdtm", "go", "bin"));
    return dirs;
}
export function resolveTool(id, options) {
    const cfg = options.config || loadPlatformConfig(options.root);
    const env = options.env || process.env;
    const def = TOOL_CATALOG.find((tool) => tool.id === id);
    if (!def)
        return { id, label: id, path: null, source: "missing", names: [] };
    const configured = cfg.tools && typeof cfg.tools[id] === "string" ? cfg.tools[id].trim() : "";
    if (configured) {
        const abs = isAbsolute(configured) ? configured : resolve(configured);
        if (existsSync(abs))
            return { id, label: def.label, path: abs, source: "config", names: def.names };
        return { id, label: def.label, path: null, source: "missing", names: def.names, configured: abs, note: `config 路径不存在：${abs}` };
    }
    const findOpts = { rejectPython: Boolean(def.rejectPython), adapt: def.adapt };
    const fromToolkit = findInDir(toolkitDirOf(cfg, options.root), def.names, findOpts);
    if (fromToolkit)
        return { id, label: def.label, path: fromToolkit, source: "toolkit", names: def.names };
    for (const dir of cfg.binDirs || []) {
        const hit = findInDir(dir, def.names, findOpts);
        if (hit)
            return { id, label: def.label, path: hit, source: "binDir", names: def.names, binDir: dir };
    }
    const fromPath = findOnPath(def.names, env, findOpts);
    if (fromPath)
        return { id, label: def.label, path: fromPath, source: "path", names: def.names };
    if (!isWinLike(cfg)) {
        for (const dir of linuxFallbackDirs(env)) {
            const hit = findInDir(dir, def.names, findOpts);
            if (hit)
                return { id, label: def.label, path: hit, source: "path", names: def.names };
        }
    }
    return { id, label: def.label, path: null, source: "missing", names: def.names };
}
export function resolveAllTools(options) {
    return TOOL_CATALOG.map((tool) => resolveTool(tool.id, options));
}
export function mergeConfigEnv(effectiveEnv, cfg) {
    const out = { ...(effectiveEnv || {}) };
    for (const [key, value] of Object.entries(cfg?.env || {})) {
        if (typeof value !== "string")
            continue;
        const trimmed = value.trim();
        if (trimmed === "")
            continue;
        if (out[key] === undefined || out[key] === "")
            out[key] = trimmed;
    }
    return out;
}
export function detectKali() {
    if (osPlatform() !== "linux")
        return { kali: false, source: null, detail: "非 Linux 宿主" };
    try {
        const text = readFileSync("/etc/os-release", "utf8");
        if (/ID\s*=\s*"?kali"?/i.test(text) || /ID_LIKE\s*=[^\n]*kali/i.test(text) || /NAME\s*=\s*".*Kali/i.test(text)) {
            return { kali: true, source: "os-release", detail: "os-release 标明 Kali" };
        }
    }
    catch {
        /* ignore */
    }
    for (const marker of ["/usr/share/kali-menu", "/etc/apt/sources.list.d/kali.list", "/usr/share/kali-defaults"]) {
        if (existsSync(marker))
            return { kali: true, source: "paths", detail: marker };
    }
    return { kali: false, source: null, detail: null };
}
const NAME_TO_IDS = (() => {
    const map = new Map();
    for (const tool of TOOL_CATALOG) {
        for (const name of tool.names) {
            const key = String(name).toLowerCase();
            const list = map.get(key) ?? [];
            list.push(tool.id);
            map.set(key, list);
        }
    }
    return map;
})();
export function scanFolderForTools(dir, options = {}) {
    const maxDepth = Math.min(Math.max(Number(options.maxDepth) || 4, 1), 6);
    const maxFiles = Math.min(Math.max(Number(options.maxFiles) || 8000, 100), 20000);
    const root = resolve(String(dir || "").trim());
    const assigned = {};
    const hits = [];
    if (!root || !existsSync(root))
        return { ok: false, error: `目录不存在：${root}`, assigned, hits };
    let stat;
    try {
        stat = statSync(root);
    }
    catch {
        return { ok: false, error: `无法读取目录：${root}`, assigned, hits };
    }
    if (!stat.isDirectory())
        return { ok: false, error: `不是文件夹：${root}`, assigned, hits };
    let scanned = 0;
    const ranks = {};
    const walk = (base, depth) => {
        if (depth > maxDepth || scanned > maxFiles)
            return;
        let entries;
        try {
            entries = readdirSync(base, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const full = join(base, entry.name);
            let isDir = entry.isDirectory();
            let isFile = entry.isFile();
            try {
                const s = statSync(full);
                isDir = s.isDirectory();
                isFile = s.isFile();
            }
            catch {
                continue;
            }
            if (isDir) {
                walk(full, depth + 1);
                continue;
            }
            if (!isFile)
                continue;
            scanned += 1;
            const key = entry.name.toLowerCase();
            const ids = NAME_TO_IDS.get(key);
            if (!ids)
                continue;
            for (const id of ids) {
                const def = TOOL_CATALOG.find((tool) => tool.id === id);
                if (def && def.rejectPython && looksLikePythonCli(full))
                    continue;
                const rank = def ? def.names.findIndex((name) => name.toLowerCase() === key) : 99;
                const prevRank = ranks[id] === undefined ? 99 : ranks[id];
                if (assigned[id] && rank >= prevRank)
                    continue;
                ranks[id] = rank < 0 ? 99 : rank;
                assigned[id] = full;
                hits.push({ id, path: full, name: entry.name });
            }
        }
    };
    walk(root, 0);
    let nucleiTemplatesDir = "";
    for (const candidate of [join(root, "nuclei-templates"), join(root, "nuclei", "templates")]) {
        if (!existsSync(candidate))
            continue;
        try {
            if (statSync(candidate).isDirectory()) {
                nucleiTemplatesDir = candidate;
                break;
            }
        }
        catch {
            /* ignore */
        }
    }
    return { ok: true, dir: root, scanned, assigned, hits, nucleiTemplatesDir, assignedCount: Object.keys(assigned).length };
}
export function assignToolkitFolder(dir, root) {
    const scan = scanFolderForTools(dir);
    if (!scan.ok)
        return { ...scan, ok: false };
    const prev = loadPlatformConfig(root);
    const tools = { ...(prev.tools || {}) };
    for (const [id, path] of Object.entries(scan.assigned || {}))
        tools[id] = path;
    const binDirs = Array.isArray(prev.binDirs) ? prev.binDirs.slice() : [];
    if (scan.dir && !binDirs.includes(scan.dir))
        binDirs.unshift(scan.dir);
    const patch = { toolkitDir: scan.dir, binDirs, tools, envAdaptConfigured: true, envAdaptSkip: false };
    if (scan.nucleiTemplatesDir)
        patch.nucleiTemplatesDir = scan.nucleiTemplatesDir;
    const cfg = savePlatformConfig(patch, root);
    const summary = platformSummary(root);
    return {
        ok: true,
        assigned: scan.assigned,
        assignedCount: scan.assignedCount,
        hits: scan.hits,
        scanned: scan.scanned,
        dir: scan.dir,
        nucleiTemplatesDir: scan.nucleiTemplatesDir || null,
        config: cfg,
        tools: summary.tools,
        adapt: summary.adapt,
    };
}
export function envAdaptStatus(root) {
    const cfg = loadPlatformConfig(root);
    const kaliInfo = detectKali();
    const tools = resolveAllTools({ root, config: cfg });
    const foundItems = tools.filter((tool) => tool.path);
    const missingItems = tools.filter((tool) => !tool.path);
    const skipped = Boolean(cfg.envAdaptSkip);
    const savedPaths = Boolean(cfg.toolkitDir && String(cfg.toolkitDir).trim()) ||
        (cfg.binDirs && cfg.binDirs.length > 0) ||
        TOOL_CATALOG.some((tool) => cfg.tools && cfg.tools[tool.id] && String(cfg.tools[tool.id]).trim());
    let reason = "need-config";
    let ready = false;
    let message = "";
    if (kaliInfo.kali) {
        ready = true;
        reason = "kali";
        message = "已检测到 Kali，默认直接使用本机工具（PATH / 默认查找）。";
    }
    else if (skipped) {
        ready = true;
        reason = "skipped";
        message = "你已确认暂不配置工具，可正常对话（扫描类技能可能不可用）。";
    }
    else if (savedPaths) {
        ready = true;
        reason = "configured";
        message = `已保存的工具路径还在，更新插件不会要求重配。当前找到 ${foundItems.length}/${tools.length} 个工具。`;
    }
    else if (foundItems.length >= 2) {
        ready = true;
        reason = "tools-found";
        message = `本机已能找到 ${foundItems.length} 个工具，视为可用。`;
    }
    else {
        reason = "need-config";
        message = "未检测到 Kali，且工具未配置。请打开 dsh-purge → 环境适配，填写路径或选整包文件夹自动分配；也可确认暂不配置后继续对话。";
    }
    return {
        ok: true,
        ready,
        reason,
        message,
        kali: Boolean(kaliInfo.kali),
        kaliSource: kaliInfo.source,
        kaliDetail: kaliInfo.detail,
        skipped,
        configured: savedPaths,
        found: foundItems.length,
        missing: missingItems.length,
        total: tools.length,
        foundIds: foundItems.map((tool) => tool.id),
        missingIds: missingItems.map((tool) => tool.id),
    };
}
export function markEnvAdaptSkip(root, skip = true) {
    savePlatformConfig({ envAdaptSkip: Boolean(skip) }, root);
    return envAdaptStatus(root);
}
export function platformSummary(root) {
    const cfg = loadPlatformConfig(root);
    const win = isWinLike(cfg);
    const tools = resolveAllTools({ root, config: cfg });
    const found = tools.filter((tool) => tool.path);
    const missing = tools.filter((tool) => !tool.path);
    const toolkit = toolkitDirOf(cfg, root);
    const nuclei = nucleiTemplatesDirOf(cfg, root) || (existsSync(join(toolkit, "nuclei-templates")) ? join(toolkit, "nuclei-templates") : null);
    const adapt = envAdaptStatus(root);
    return {
        ok: true,
        config: cfg,
        runtime: { nodePlatform: osPlatform(), effective: win ? "windows" : "linux", windows: win, sep },
        toolkitDir: toolkit,
        toolkitExists: existsSync(toolkit),
        nucleiTemplatesDir: nuclei,
        tools: { total: tools.length, found: found.length, missing: missing.length, items: tools },
        adapt,
        hint: adapt.kali
            ? "已检测到 Kali。系统包按发行版文件名认：impacket-secretsdump、httpx-toolkit（不把 Python 的 /usr/bin/httpx 当成扫描器）。fscan、gogo、suo5、frp、chisel、dnsx、subfinder、ksubdomain 不是 Kali 自带命令，没放进 /usr/bin 或 ~/go/bin 就会显示未找到。"
            : win
                ? "当前按 Windows 适配：建议在 Kali 虚拟机里跑，或在本页填工具路径/整包文件夹自动分配。出网代理看下方「出网状态」。"
                : "当前按 Linux 适配：可用 setup.sh 装工具箱，也可在本页手填或整包文件夹自动分配。出网代理看下方「出网状态」。",
        egress: {
            http_proxy: process.env.HTTP_PROXY || process.env.http_proxy || "",
            https_proxy: process.env.HTTPS_PROXY || process.env.https_proxy || "",
            all_proxy: process.env.ALL_PROXY || process.env.all_proxy || "",
            no_proxy: process.env.NO_PROXY || process.env.no_proxy || "",
            note: "只读进程环境；改系统/终端代理后需重启宿主。命令级代理请用技能 cn-proxy-pool，不改本机网络配置。",
        },
    };
}
