/** 技能库（SKILL.md 扫描/解析/读写），迁移自完整版 lib/skills.js 的核心部分。 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_CATALOG, loadPlatformConfig, resolveTool } from "./platform-config.js";
export const MAX_DESCRIPTION = 1024;
export function validSkillName(id) {
    return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(String(id || ""));
}
/** $DSH_HOME/redteam/skills（随包/自建） */
export function redteamSkillsDir(root) {
    return join(root, "skills");
}
/** $DSH_HOME/skills（官方技能） */
export function officialSkillsDir(root) {
    return join(dirname(root), "skills");
}
export function skillBackupDir(root) {
    return join(dirname(root), "dsh-purge-backups");
}
export function splitFrontmatter(raw) {
    const text = String(raw || "").replace(/^\uFEFF/, "");
    if (!text.startsWith("---"))
        return null;
    const afterOpen = text.slice(3);
    if (!/^\r?\n/.test(afterOpen))
        return null;
    const rest = afterOpen.replace(/^\r?\n/, "");
    const close = rest.match(/\r?\n---(?:\r?\n|$)/);
    if (!close || close.index == null)
        return null;
    return { head: rest.slice(0, close.index), body: rest.slice(close.index + close[0].length) };
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function blockScalarValue(head, key) {
    const lines = String(head || "").split(/\r?\n/);
    const headerRe = new RegExp(`^(\\s*)${escapeRegExp(key)}:\\s*([|>])([+-]?)(\\d*)\\s*(?:#.*)?$`);
    let headerIdx = -1;
    let keyIndent = 0;
    let style = "|";
    let chomp = "";
    let indentHint = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const match = lines[i]?.match(headerRe);
        if (!match)
            continue;
        headerIdx = i;
        keyIndent = (match[1] ?? "").length;
        style = match[2] ?? "|";
        chomp = match[3] || "";
        indentHint = match[4] ? parseInt(match[4], 10) : 0;
        break;
    }
    if (headerIdx < 0)
        return "";
    const body = [];
    let blockIndent = indentHint > 0 ? keyIndent + indentHint : 0;
    for (let i = headerIdx + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.trim() === "") {
            body.push("");
            continue;
        }
        const indent = (line.match(/^(\s*)/)?.[1] ?? "").length;
        if (indent <= keyIndent)
            break;
        if (!blockIndent)
            blockIndent = indent;
        if (indent < blockIndent)
            break;
        body.push(line.slice(blockIndent));
    }
    while (body.length && body[body.length - 1] === "")
        body.pop();
    let text;
    if (style === "|") {
        text = body.join("\n");
    }
    else {
        text = "";
        for (let i = 0; i < body.length; i += 1) {
            const cur = body[i];
            if (i === 0) {
                text += cur;
                continue;
            }
            if (cur === "") {
                text += "\n";
                continue;
            }
            if (body[i - 1] === "") {
                text += cur;
                continue;
            }
            text += ` ${cur}`;
        }
    }
    if (chomp === "+")
        text += "\n";
    else if (chomp !== "-" && text.length > 0)
        text += "\n";
    return text.replace(/\s+/g, " ").trim();
}
function yamlLineField(head, key) {
    const re = new RegExp(`^${escapeRegExp(key)}:\\s*(.*)$`, "m");
    const match = String(head || "").match(re);
    if (!match)
        return "";
    let value = (match[1] ?? "").trim();
    if (!value)
        return "";
    if (/^[|>][+-]?\d*\s*(?:#.*)?$/.test(value))
        return blockScalarValue(head, key);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        try {
            return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
        }
        catch {
            return value.slice(1, -1);
        }
    }
    const comment = value.indexOf(" #");
    if (comment >= 0)
        value = value.slice(0, comment).trim();
    return value;
}
function yamlBoolField(head, key) {
    const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
    const match = String(head || "").match(re);
    if (!match)
        return { present: false };
    let value = (match[1] ?? "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1).trim();
    const comment = value.indexOf(" #");
    if (comment >= 0)
        value = value.slice(0, comment).trim();
    const norm = value.toLowerCase();
    if (["true", "yes", "on", "1"].includes(norm))
        return { present: true, value: true };
    if (["false", "no", "off", "0"].includes(norm))
        return { present: true, value: false };
    return { present: true, invalid: true };
}
export function parseSkillDocument(raw) {
    const parts = splitFrontmatter(raw);
    if (!parts)
        return { ok: false, error: "缺少 YAML frontmatter（须以 --- 包围）" };
    const name = yamlLineField(parts.head, "name");
    const description = yamlLineField(parts.head, "description");
    if (!validSkillName(name))
        return { ok: false, error: "frontmatter.name 必须是 kebab-case，例如 code-review" };
    if (!description)
        return { ok: false, error: "frontmatter.description 必填（单行）" };
    const disableModel = yamlBoolField(parts.head, "disable-model-invocation");
    const userInvocable = yamlBoolField(parts.head, "user-invocable");
    if (disableModel.invalid)
        return { ok: false, error: "disable-model-invocation 必须是布尔值（true/false）" };
    if (userInvocable.invalid)
        return { ok: false, error: "user-invocable 必须是布尔值（true/false）" };
    return {
        ok: true,
        name,
        description,
        whenToUse: yamlLineField(parts.head, "whenToUse"),
        modelInvocable: disableModel.value !== true,
        userInvocable: userInvocable.value !== false,
        body: parts.body,
        head: parts.head,
    };
}
function yamlScalar(text) {
    if (/^[A-Za-z0-9._+/-]+$/.test(text))
        return text;
    return JSON.stringify(text);
}
export function renderSkillDocument(id, description, body = "") {
    if (!validSkillName(id))
        throw new Error("invalid skill name");
    const desc = String(description || "").trim() || id;
    const text = String(body || "").replace(/^\uFEFF/, "");
    const parts = splitFrontmatter(text);
    const inner = parts ? parts.body : text;
    return `---\nname: ${id}\ndescription: ${yamlScalar(desc.slice(0, MAX_DESCRIPTION))}\n---\n\n${inner.replace(/^\r?\n/, "")}`;
}
function readSkillFile(id, fp, kind, library) {
    const content = readFileSync(fp, "utf8");
    const parsed = parseSkillDocument(content);
    let mtime = null;
    try {
        mtime = statSync(fp).mtime.toISOString();
    }
    catch {
        /* ignore */
    }
    return {
        id,
        library,
        kind,
        path: fp,
        description: parsed.ok ? parsed.description ?? "" : "",
        whenToUse: parsed.ok ? parsed.whenToUse ?? "" : "",
        modelInvocable: parsed.ok ? Boolean(parsed.modelInvocable) : false,
        userInvocable: parsed.ok ? Boolean(parsed.userInvocable) : false,
        valid: parsed.ok,
        error: parsed.ok ? null : parsed.error ?? "invalid",
        size: Buffer.byteLength(content, "utf8"),
        updated_at: mtime,
    };
}
function scanLibrary(dir, library) {
    const out = [];
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return out;
    }
    const seen = new Set();
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === ".system")
            continue;
        if (entry.isDirectory()) {
            const fp = join(dir, entry.name, "SKILL.md");
            if (!existsSync(fp))
                continue;
            const content = readFileSync(fp, "utf8");
            const parsed = parseSkillDocument(content);
            const id = parsed.ok ? String(parsed.name) : validSkillName(entry.name) ? entry.name : "";
            if (!id || seen.has(id))
                continue;
            seen.add(id);
            out.push(readSkillFile(id, fp, "bundle", library));
            continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "SKILL.md")
            continue;
        const fallback = entry.name.slice(0, -3);
        const fp = join(dir, entry.name);
        const parsed = parseSkillDocument(readFileSync(fp, "utf8"));
        const id = parsed.ok ? String(parsed.name) : validSkillName(fallback) ? fallback : "";
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        out.push(readSkillFile(id, fp, "flat", library));
    }
    return out;
}
export function skillCatalog(root) {
    return [...scanLibrary(redteamSkillsDir(root), "redteam"), ...scanLibrary(officialSkillsDir(root), "official")];
}
export function readSkill(root, id, library = "redteam") {
    if (!validSkillName(id))
        return null;
    const dir = library === "official" ? officialSkillsDir(root) : redteamSkillsDir(root);
    const candidates = [join(dir, id, "SKILL.md"), join(dir, `${id}.md`)];
    for (const fp of candidates) {
        if (!existsSync(fp))
            continue;
        const kind = fp.endsWith("SKILL.md") ? "bundle" : "flat";
        return { item: readSkillFile(id, fp, kind, library), content: readFileSync(fp, "utf8") };
    }
    return null;
}
export function saveSkill(root, id, content, description = "") {
    if (!validSkillName(id))
        return { ok: false, error: "invalid skill name" };
    const text = description ? renderSkillDocument(id, description, content) : String(content || "");
    if (!splitFrontmatter(text))
        return { ok: false, error: "内容缺少 frontmatter" };
    const dir = join(redteamSkillsDir(root), id);
    mkdirSync(dir, { recursive: true });
    const fp = join(dir, "SKILL.md");
    const tmp = `${fp}.tmp-${process.pid}`;
    writeFileSync(tmp, text, "utf8");
    renameSync(tmp, fp);
    return { ok: true, path: fp };
}
export function deleteSkill(root, id) {
    if (!validSkillName(id))
        return { ok: false, error: "invalid skill name" };
    const dir = join(redteamSkillsDir(root), id);
    if (!existsSync(dir))
        return { ok: false, error: "skill not found（只能删除 redteam 技能库里的技能）" };
    rmSync(dir, { recursive: true, force: true });
    return { ok: true, removed: true };
}
export function skillsStatus(root) {
    const items = skillCatalog(root);
    return {
        redteam: items.filter((item) => item.library === "redteam").length,
        official: items.filter((item) => item.library === "official").length,
        broken: items.filter((item) => !item.valid).length,
        total: items.length,
        redteamDir: redteamSkillsDir(root),
        officialDir: officialSkillsDir(root),
    };
}
/* ── 随包技能与导入/体检 ───────────────────────────────────────────── */
/** 包内 skills/redteam 目录（lib/redteam/../../skills/redteam）。 */
export function bundledSkillsDir() {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [join(here, "..", "..", "skills", "redteam"), join(here, "..", "skills", "redteam")];
    return candidates.find((dir) => existsSync(dir)) ?? candidates[0] ?? "";
}
/** 把随包技能复制到 $DSH_HOME/redteam/skills（只补缺失，不覆盖用户改动）。 */
export function installBundledSkills(root) {
    const source = bundledSkillsDir();
    const target = redteamSkillsDir(root);
    mkdirSync(target, { recursive: true });
    const installed = [];
    let skipped = 0;
    let entries = [];
    try {
        entries = readdirSync(source).filter((name) => name.endsWith(".md"));
    }
    catch {
        return { installed, skipped, source };
    }
    for (const name of entries) {
        const to = join(target, name);
        if (existsSync(to)) {
            skipped += 1;
            continue;
        }
        cpSync(join(source, name), to);
        installed.push(name);
    }
    return { installed, skipped, source };
}
/** 从目录或 .md 文件导入技能（目录需含 SKILL.md；同名覆盖）。 */
export function importSkillPath(root, sourcePath) {
    const source = resolve(String(sourcePath || "").trim());
    if (!source || !existsSync(source))
        return { ok: false, error: "路径不存在：" + source };
    const stat = statSync(source);
    if (stat.isDirectory()) {
        const skillFile = join(source, "SKILL.md");
        if (!existsSync(skillFile))
            return { ok: false, error: "目录里没有 SKILL.md" };
        const parsed = parseSkillDocument(readFileSync(skillFile, "utf8"));
        const id = parsed.ok ? String(parsed.name) : basename(source);
        if (!validSkillName(id))
            return { ok: false, error: "技能名不合法：" + id };
        const target = join(redteamSkillsDir(root), id);
        mkdirSync(target, { recursive: true });
        cpSync(source, target, { recursive: true, force: true });
        return { ok: true, id, path: target };
    }
    if (!stat.isFile() || !source.toLowerCase().endsWith(".md"))
        return { ok: false, error: "只支持目录或 .md 文件" };
    const parsed = parseSkillDocument(readFileSync(source, "utf8"));
    if (!parsed.ok)
        return { ok: false, error: parsed.error ?? "frontmatter 无效" };
    const id = String(parsed.name);
    const dir = join(redteamSkillsDir(root), id);
    mkdirSync(dir, { recursive: true });
    cpSync(source, join(dir, "SKILL.md"), { force: true });
    return { ok: true, id, path: dir };
}
/** 简化版体检：正文提到的工具/环境变量是否就绪。 */
export function skillHealth(root, item) {
    const problems = [];
    if (!item.valid) {
        problems.push({ kind: "frontmatter", target: item.id, fix: item.error ?? "SKILL.md frontmatter 无效" });
        return { id: item.id, library: item.library, ok: false, problems };
    }
    const hit = readSkill(root, item.id, item.library);
    const content = String(hit?.content ?? "").toLowerCase();
    if (!content)
        return { id: item.id, library: item.library, ok: true, problems };
    const cfg = loadPlatformConfig(root);
    for (const tool of TOOL_CATALOG) {
        const mentioned = [tool.id, ...tool.names].some((name) => content.includes(String(name).toLowerCase()));
        if (!mentioned)
            continue;
        if (resolveTool(tool.id, { root, config: cfg }).path)
            continue;
        problems.push({ kind: "tool", target: tool.id, fix: "未找到 " + tool.id + "：在「环境适配」里填路径，或分配整包工具目录" });
    }
    for (const key of ["FOFA_KEY", "REDTEAM_VPS_HOST", "REDTEAM_VPS_KEY"]) {
        if (!content.includes(key.toLowerCase()))
            continue;
        const configured = String(cfg.env?.[key] ?? "").trim() || String(process.env[key] ?? "").trim();
        if (!configured)
            problems.push({ kind: "env", target: key, fix: "缺少 " + key + "：在「环境适配」里填写" });
    }
    return { id: item.id, library: item.library, ok: problems.length === 0, problems };
}
export function skillsHealth(root) {
    return skillCatalog(root).map((item) => skillHealth(root, item));
}
