/** 知识库 schema 与归类（对齐 dsh-purge 1.1.71）。 */
export const POC_KINDS = ["poc", "exp", "script", "template", "payload"];
export const POC_SOURCES = ["web", "self", "manual", "nuclei-template", "kb"];
export const KNOWLEDGE_DDL = `
CREATE TABLE IF NOT EXISTS poc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT,
  category TEXT,
  cve TEXT,
  component TEXT,
  versions TEXT,
  severity TEXT,
  language TEXT,
  source TEXT,
  source_url TEXT,
  description TEXT,
  usage TEXT,
  content TEXT,
  path TEXT,
  verified INTEGER DEFAULT 0,
  verified_note TEXT,
  hit_count INTEGER DEFAULT 0,
  used_on TEXT,
  engagement_id TEXT,
  engagement_name TEXT,
  asset_target TEXT,
  found_by_agent TEXT,
  tags TEXT,
  created_by TEXT, created_at TEXT, updated_at TEXT,
  UNIQUE(code)
);
CREATE INDEX IF NOT EXISTS ix_poc_cve ON poc(cve);
CREATE INDEX IF NOT EXISTS ix_poc_component ON poc(component);
CREATE INDEX IF NOT EXISTS ix_poc_kind ON poc(kind, verified);
`;
export const POC_FTS_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS poc_fts USING fts5(
  poc_id UNINDEXED, title, cve, component, versions, tags, description, content
);
`;
/** 老 knowledge.db 缺的列：逐列 ALTER（CREATE INDEX 放在补列之后）。 */
export const KNOWLEDGE_MIGRATIONS = [
    { column: "category", ddl: "ALTER TABLE poc ADD COLUMN category TEXT" },
    { column: "engagement_id", ddl: "ALTER TABLE poc ADD COLUMN engagement_id TEXT" },
    { column: "engagement_name", ddl: "ALTER TABLE poc ADD COLUMN engagement_name TEXT" },
    { column: "asset_target", ddl: "ALTER TABLE poc ADD COLUMN asset_target TEXT" },
    { column: "found_by_agent", ddl: "ALTER TABLE poc ADD COLUMN found_by_agent TEXT" },
    { column: "tags", ddl: "ALTER TABLE poc ADD COLUMN tags TEXT" },
    { column: "path", ddl: "ALTER TABLE poc ADD COLUMN path TEXT" },
    { column: "source_url", ddl: "ALTER TABLE poc ADD COLUMN source_url TEXT" },
    { column: "usage", ddl: "ALTER TABLE poc ADD COLUMN usage TEXT" },
    { column: "verified_note", ddl: "ALTER TABLE poc ADD COLUMN verified_note TEXT" },
    { column: "hit_count", ddl: "ALTER TABLE poc ADD COLUMN hit_count INTEGER DEFAULT 0" },
    { column: "used_on", ddl: "ALTER TABLE poc ADD COLUMN used_on TEXT" },
    { column: "content", ddl: "ALTER TABLE poc ADD COLUMN content TEXT" },
];
export const KNOWLEDGE_POST_INDEXES = `
CREATE INDEX IF NOT EXISTS ix_poc_category ON poc(category);
CREATE INDEX IF NOT EXISTS ix_poc_engagement ON poc(engagement_id);
`;
export const POC_CATEGORIES = [
    { code: "rce", name: "远程命令执行", hint: "框架/中间件/组件 RCE、表达式注入、模板注入" },
    { code: "deserialization", name: "反序列化", hint: "Java/PHP/.NET 反序列化链、fastjson/jackson 等" },
    { code: "file-upload", name: "文件上传 getshell", hint: "上传绕过、解析漏洞、二次渲染、竞争" },
    { code: "sqli", name: "SQL 注入", hint: "注入点验证、拖库、写文件、提权" },
    { code: "unauthorized", name: "未授权访问", hint: "未鉴权接口/服务（Redis、Docker、Actuator、Swagger 调用）" },
    { code: "auth-bypass", name: "认证绕过 / 越权", hint: "登录绕过、JWT 缺陷、越权读写、逻辑缺陷" },
    { code: "weak-password", name: "弱口令 / 口令爆破", hint: "管理端弱口令、数据库弱口令、默认口令" },
    { code: "ssrf", name: "SSRF", hint: "服务端请求伪造、云元数据、内网探测跳板" },
    { code: "xxe", name: "XXE", hint: "XML 外部实体读取与 SSRF" },
    { code: "path-traversal", name: "目录穿越 / 任意文件读取", hint: "路径穿越、任意文件读、源码/配置读取" },
    { code: "info-leak", name: "信息泄露", hint: "配置/凭据/源码/备份泄露（能升级为得分的那些）" },
    { code: "privesc", name: "提权 / 横向", hint: "本地提权、凭据复用、Pass-the-Hash、横向工具" },
    { code: "tunnel", name: "隧道 / 代理", hint: "suo5、frp、chisel、Neo-ReGeorg、内网代理" },
    { code: "other", name: "其它", hint: "不属于上面任何一类（写清用途）" },
];
export function pocCategoryName(code) {
    const hit = POC_CATEGORIES.find((item) => item.code === String(code || ""));
    return hit ? hit.name : code ? String(code) : "未归类";
}
const flat = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
/** 与旧实现一致：标题里已含 CVE 时不重复拼。 */
export function slugPoc(title, cve) {
    const text = String(title || "").trim();
    const id = String(cve || "").trim();
    const base = id !== "" && !flat(text).includes(flat(id)) ? `${id} ${text}` : text;
    const slug = base
        .toLowerCase()
        .replace(/cve[-_ ]?(\d{4})[-_ ]?(\d+)/g, "cve-$1-$2")
        .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+$/, "");
    return slug === "" ? `poc-${Date.now()}` : slug;
}
export function defaultPocFilename(title, kind, language) {
    const ext = {
        python: "py",
        py: "py",
        go: "go",
        java: "java",
        bash: "sh",
        sh: "sh",
        shell: "sh",
        js: "js",
        node: "js",
        php: "php",
        ruby: "rb",
        powershell: "ps1",
        http: "http",
        nuclei: "yaml",
        yaml: "yaml",
    }[String(language || "").toLowerCase()];
    if (ext)
        return `poc.${ext}`;
    if (kind === "template")
        return "poc.yaml";
    return "poc.txt";
}
