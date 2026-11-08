/**
 * 事实库 schema 与增量迁移（与旧仓库 lib/redteam/schema.js 对齐）。
 *
 * 纪律：
 * - DDL 字符串逐字节保留（迁移/对账依赖它）；
 * - 迁移先查 PRAGMA 再 ADD COLUMN，可重复执行；
 * - FTS5 是编译期能力，必须探测后决定是否建虚拟表。
 */
import { DatabaseSync } from "node:sqlite";
import { parseTargetPort } from "./score-rules.js";

export interface SqlStatement {
	all(...params: unknown[]): unknown[];
	get(...params: unknown[]): unknown;
	run(...params: unknown[]): unknown;
}

export interface SqlDb {
	exec(sql: string): void;
	prepare(sql: string): SqlStatement;
}

export const HAS_FTS5: boolean = (() => {
	if (process.env.REDTEAM_NO_FTS5 === "1") return false;
	try {
		const probe = new DatabaseSync(":memory:");
		try {
			probe.exec("CREATE VIRTUAL TABLE __fts5_probe USING fts5(x)");
			return true;
		} finally {
			probe.close();
		}
	} catch {
		return false;
	}
})();

export const ASSET_FTS_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS asset_fts USING fts5(
  asset_id UNINDEXED, ip, names, banners, titles, fingerprints
);
`;

export const POC_FTS_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS poc_fts USING fts5(
  poc_id UNINDEXED, title, cve, component, versions, tags, description, content
);
`;

/** 内外网判定 SQL 片段（作用于 asset.ip）。 */
export const SCOPE_SQL = `CASE
  WHEN ip LIKE '10.%' OR ip LIKE '192.168.%' OR ip LIKE '127.%' OR ip LIKE '169.254.%'
    OR (ip LIKE '172.%' AND CAST(substr(ip, 5, instr(substr(ip, 5), '.') - 1) AS INTEGER) BETWEEN 16 AND 31)
    OR (ip LIKE '100.%' AND CAST(substr(ip, 5, instr(substr(ip, 5), '.') - 1) AS INTEGER) BETWEEN 64 AND 127)
  THEN 'internal' ELSE 'external' END`;

/** 旧攻击链 stage → 新阶段 code 的兜底映射。 */
export const LEGACY_STAGE_MAP: Record<string, string> = {
	recon: "recon",
	vuln: "internet",
	exploit: "internet",
	access: "internal",
	pivot: "boundary",
	data: "internal",
	other: "recon",
};

export const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS scan_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_session_id TEXT, tool TEXT, argv TEXT,
  started_at TEXT, finished_at TEXT, status TEXT DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS segment (
  cidr TEXT PRIMARY KEY, ip_start TEXT, ip_end TEXT,
  org TEXT, asn TEXT, country TEXT, city TEXT,
  source TEXT, first_seen TEXT, last_seen TEXT
);

CREATE TABLE IF NOT EXISTS asset (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_cidr TEXT NOT NULL, ip TEXT NOT NULL, ip_int INTEGER,
  state TEXT DEFAULT 'unknown', primary_name TEXT, confidence REAL,
  first_seen TEXT, last_seen TEXT, discovered_at TEXT,
  test_status TEXT DEFAULT 'untested', test_notes TEXT, test_surface TEXT,
  test_updated_at TEXT, test_updated_by TEXT, blocked_count INTEGER DEFAULT 0,
  priority TEXT, potential TEXT, assess_reason TEXT, assessed_at TEXT, assessed_by TEXT,
  UNIQUE(segment_cidr, ip)
);

CREATE TABLE IF NOT EXISTS asset_name (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL, name TEXT NOT NULL, kind TEXT,
  provenance TEXT, tool TEXT, first_seen TEXT, last_seen TEXT,
  UNIQUE(asset_id, name, kind)
);

CREATE TABLE IF NOT EXISTS port (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL, proto TEXT DEFAULT 'tcp', port INTEGER NOT NULL,
  state TEXT DEFAULT 'open', provenance TEXT, tool TEXT, banner TEXT,
  url TEXT, title TEXT,
  first_seen TEXT, last_seen TEXT,
  UNIQUE(asset_id, proto, port)
);

CREATE TABLE IF NOT EXISTS service (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  port_id INTEGER NOT NULL, name TEXT, product TEXT, version TEXT, cpe TEXT,
  provenance TEXT, tool TEXT, first_seen TEXT, last_seen TEXT
);

CREATE TABLE IF NOT EXISTS fingerprint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL, port_id INTEGER,
  category TEXT, vendor TEXT, product TEXT, version TEXT,
  evidence TEXT, confidence REAL, provenance TEXT, tool TEXT,
  first_seen TEXT, last_seen TEXT
);

CREATE TABLE IF NOT EXISTS observation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_kind TEXT NOT NULL, entity_id INTEGER NOT NULL,
  attr TEXT, value TEXT, provenance TEXT, tool TEXT,
  scan_run_id INTEGER, collected_at TEXT, raw_ref TEXT
);

CREATE TABLE IF NOT EXISTS edge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src_kind TEXT NOT NULL, src_id TEXT NOT NULL,
  dst_kind TEXT NOT NULL, dst_id TEXT NOT NULL,
  relation TEXT NOT NULL, confidence REAL, scan_run_id INTEGER,
  first_seen TEXT, last_seen TEXT,
  UNIQUE(src_kind, src_id, dst_kind, dst_id, relation)
);

CREATE TABLE IF NOT EXISTS tag (
  entity_kind TEXT NOT NULL, entity_id INTEGER NOT NULL, tag TEXT NOT NULL,
  note TEXT, created_by TEXT, created_at TEXT,
  PRIMARY KEY (entity_kind, entity_id, tag)
);

CREATE TABLE IF NOT EXISTS vuln (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER, port_id INTEGER, cve TEXT, title TEXT, severity TEXT,
  source TEXT, confidence REAL, status TEXT, evidence TEXT, target TEXT,
  found_by_agent TEXT, found_at TEXT, gained TEXT, agent TEXT
);

/* 得分点：来自攻防演练得分规则，用户可编辑（分值、启用、分类） */
CREATE TABLE IF NOT EXISTS score_point (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  points INTEGER DEFAULT 0,
  max_hits INTEGER DEFAULT 1,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT,
  /* ── 按《突破入侵类得分规则》新增的判定字段（v0.11.0）────────────────────
     rule：规则号（RULE 1…25）；**同一 rule 的得分点共用该规则的得分上限**
     tier：同规则内的档位（普通权限/管理员权限/加成分…），面板与报告按它分组展示
     cap：该 rule 的累计得分上限（0 = 不设上限）
     dedup_scope：计分口径 service(同资产同端口只算最高一条) / system(同系统只算最高权限一次)
                  / target(整个目标只算一次) / none(按台卡节点数累加)
     legacy：1 = 旧版得分点（迁移后保留但停用，只作历史参照，不参与新口径计分） */
  /* src：《突破入侵类得分规则（合并版）》里的原序号（合并行写首个原序号），仅用于与原表对账 */
  src INTEGER,
  rule INTEGER,
  tier TEXT,
  cap INTEGER DEFAULT 0,
  dedup_scope TEXT DEFAULT 'service',
  legacy INTEGER DEFAULT 0,
  /* builtin：1 = 随《突破入侵类得分规则》分发的内置得分点（分值/上限/口径由规则锁定，
     用户只能改「启用/停用」）；0 = 用户自建点（可任意编辑，且不会被播种逻辑清掉）。
     判定内置**必须看这个标志位**，不能用 code 名单：用户自建的得分点一旦被判成旧体系残留，
     会在下次读取得分面板时连同命中一起删掉，而写入侧仍返回成功。 */
  builtin INTEGER DEFAULT 0
);

/* 得分记录：某个得分点在某个目标上被拿下 */
/* 作战阶段：全链路攻击路径图的五个阶段（内容可编辑） */
CREATE TABLE IF NOT EXISTS stage (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  color TEXT,
  goal TEXT,
  sections TEXT,
  tools TEXT,
  transition TEXT,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS score_hit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  point_id INTEGER NOT NULL,
  asset_id INTEGER, vuln_id INTEGER, step_id INTEGER, target TEXT,
  evidence TEXT, note TEXT,
  self_created INTEGER DEFAULT 0,
  port INTEGER,
  recorded_by TEXT, recorded_at TEXT,
  /* 本次命中的实际分值（NULL = 用得分点的默认 points）。
     《合并版》把同一项的多个档位合并成一条（如服务器主机权限"普通 10 / 管理员 50"、
     域名控制"一级 50 / 二级 20"），**档位差异只能落在每一条命中上**，
     否则"权限取高只计一次"无从表达。 */
  points INTEGER,
  /* 倍率：G5 数据规模翻倍（×2）/ G6 IPv6 成果 ×3。**作用在权限分上**，
     与 points 相乘后再参与上限累计。存下来是为了让面板与报告能解释"这条为什么是 200 分"，
     而不是让读者以为分值算错了。 */
  multiplier REAL DEFAULT 1
);

/* 凭据：secret_value 存明文口令/密钥（面板直接显示，便于随时复用），secret_ref 指向 runs/ 下的证据文件。
   注意：本库只在本机，禁止把库文件或导出内容提交到任何仓库。 */
CREATE TABLE IF NOT EXISTS credential (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER, host TEXT, username TEXT, secret_type TEXT,
  secret_value TEXT, secret_ref TEXT,
  privilege TEXT, source TEXT, tool TEXT, note TEXT,
  found_by_agent TEXT, found_at TEXT, agent TEXT,
  UNIQUE(host, username, secret_type)
);

/* 访问会话：拿到入口后的一次可控访问记录（横向移动的起点） */
CREATE TABLE IF NOT EXISTS access_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER, host TEXT, username TEXT, method TEXT, privilege TEXT,
  session_ref TEXT, note TEXT, found_by_agent TEXT, obtained_at TEXT
);

/* WebShell：已经上线的可控入口。智能体随时可以复用，避免"打到最后忘了还有 webshell" */
CREATE TABLE IF NOT EXISTS webshell (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER, url TEXT NOT NULL, shell_type TEXT, pass_key TEXT,
  secret_ref TEXT, privilege TEXT,
  status TEXT DEFAULT 'unknown', last_check TEXT, check_note TEXT, latency_ms INTEGER,
  note TEXT, found_by_agent TEXT, created_at TEXT, updated_at TEXT, agent TEXT,
  UNIQUE(url, pass_key)
);

/* 内网隧道：suo5 / socks5 / ssh -R / frp 等。记录入口、监听地址与可达网段 */
CREATE TABLE IF NOT EXISTS tunnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER, webshell_id INTEGER, kind TEXT, listen TEXT,
  entry TEXT, reach TEXT,
  entry_kind TEXT,
  status TEXT DEFAULT 'unknown', last_check TEXT, check_note TEXT, latency_ms INTEGER,
  pid TEXT, command TEXT, note TEXT, found_by_agent TEXT, created_at TEXT, updated_at TEXT, agent TEXT
);

/* HTTP 证据：原始请求/响应，可直接粘贴进 Burp Suite / Yakit 复现 */
CREATE TABLE IF NOT EXISTS http_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vuln_id INTEGER, asset_id INTEGER, label TEXT,
  method TEXT, url TEXT, status INTEGER,
  request TEXT, response TEXT, note TEXT,
  captured_by TEXT, captured_at TEXT
);

/* 攻击文件：针对某个目标实际生效的脚本/POC/EXP（只收录验证有效的） */
CREATE TABLE IF NOT EXISTS attack_file (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL, target_kind TEXT, name TEXT NOT NULL, kind TEXT,
  path TEXT NOT NULL, description TEXT, evidence TEXT,
  asset_id INTEGER, vuln_id INTEGER, created_by TEXT, created_at TEXT,
  UNIQUE(target, name)
);

/* 攻击链步骤：人工/智能体记录的链路节点，用于攻击链页面与报告。
   tool/agent/result 三列是"这一步怎么做的"的凭证：报告要写清账号密码怎么来的、
   隧道怎么搭的，靠的就是步骤上的工具与命令原文。 */
CREATE TABLE IF NOT EXISTS attack_step (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER, stage TEXT, title TEXT, detail TEXT,
  asset_id INTEGER, vuln_id INTEGER, access_id INTEGER, point_id INTEGER,
  evidence_ref TEXT, tool TEXT, agent TEXT, result TEXT,
  recorded_by TEXT, recorded_at TEXT
);

/* 证据截图：得分成果的"看得见"的那一份材料。
   落盘位置：<靶标目录>/shots/，库里只存文件名与元数据 —— 图片不进 SQLite。
   kind：screenshot 现场截图；card 由记录生成的证据摘录卡，报告里要分开标注。 */
CREATE TABLE IF NOT EXISTS shot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  point_id INTEGER, hit_id INTEGER, asset_id INTEGER, vuln_id INTEGER,
  target TEXT, label TEXT, note TEXT,
  file TEXT NOT NULL,
  kind TEXT DEFAULT 'screenshot',
  mime TEXT, bytes INTEGER, width INTEGER, height INTEGER, sha256 TEXT,
  source_ref TEXT, captured_at TEXT, found_by_agent TEXT, agent TEXT, created_at TEXT,
  UNIQUE(file)
);


CREATE INDEX IF NOT EXISTS ix_asset_segment ON asset(segment_cidr);
CREATE INDEX IF NOT EXISTS ix_asset_ip_int ON asset(ip_int);
CREATE INDEX IF NOT EXISTS ix_port_asset ON port(asset_id);
CREATE INDEX IF NOT EXISTS ix_port_port ON port(port);
CREATE INDEX IF NOT EXISTS ix_service_port ON service(port_id);
CREATE INDEX IF NOT EXISTS ix_service_name ON service(name, product, version);
CREATE INDEX IF NOT EXISTS ix_fp_asset ON fingerprint(asset_id);
CREATE INDEX IF NOT EXISTS ix_fp_product ON fingerprint(product, version);
CREATE INDEX IF NOT EXISTS ix_edge_src ON edge(src_kind, src_id);
CREATE INDEX IF NOT EXISTS ix_edge_dst ON edge(dst_kind, dst_id);
CREATE INDEX IF NOT EXISTS ix_obs_entity ON observation(entity_kind, entity_id);
CREATE INDEX IF NOT EXISTS ix_vuln_asset ON vuln(asset_id);
CREATE INDEX IF NOT EXISTS ix_vuln_sev ON vuln(severity, status);
CREATE INDEX IF NOT EXISTS ix_vuln_cve ON vuln(cve);
CREATE INDEX IF NOT EXISTS ix_cred_host ON credential(host);
CREATE INDEX IF NOT EXISTS ix_access_host ON access_session(host);
CREATE INDEX IF NOT EXISTS ix_webshell_status ON webshell(status);
CREATE INDEX IF NOT EXISTS ix_tunnel_status ON tunnel(status);
CREATE INDEX IF NOT EXISTS ix_shot_point ON shot(point_id);
CREATE INDEX IF NOT EXISTS ix_shot_hit ON shot(hit_id);
CREATE INDEX IF NOT EXISTS ix_shot_asset ON shot(asset_id);
CREATE INDEX IF NOT EXISTS ix_http_vuln ON http_evidence(vuln_id);
CREATE INDEX IF NOT EXISTS ix_http_asset ON http_evidence(asset_id);
CREATE INDEX IF NOT EXISTS ix_step_seq ON attack_step(seq, id);
CREATE INDEX IF NOT EXISTS ix_attack_target ON attack_file(target);
CREATE INDEX IF NOT EXISTS ix_score_hit_point ON score_hit(point_id);
/* 报告/攻击链按时间排序取命中（scoreReport 的 ORDER BY h.recorded_at, h.id） */
CREATE INDEX IF NOT EXISTS ix_score_hit_time ON score_hit(recorded_at, id);
/* 报告的"这一步关联了哪些攻击步骤"按 asset_id / vuln_id / step_id 反查 */
CREATE INDEX IF NOT EXISTS ix_score_hit_vuln ON score_hit(vuln_id);
CREATE INDEX IF NOT EXISTS ix_score_hit_step ON score_hit(step_id);
/* 攻击步骤按资产/漏洞反查（报告溯源与 #hitTrace 的兜底归因都走这里） */
CREATE INDEX IF NOT EXISTS ix_step_asset ON attack_step(asset_id);
CREATE INDEX IF NOT EXISTS ix_step_vuln ON attack_step(vuln_id);
CREATE INDEX IF NOT EXISTS ix_step_recorded ON attack_step(recorded_at);
/* 资产按 C 段 + 状态筛（资产测绘左侧点某个 C 段就是这条） */
CREATE INDEX IF NOT EXISTS ix_asset_segment_state ON asset(segment_cidr, state);
/* http 证据按目标 URL 做 LIKE 兜底匹配（scoreReport 找不到显式关联时用） */
CREATE INDEX IF NOT EXISTS ix_http_url ON http_evidence(url);
/* 隧道/马按资产与状态查（会话页与攻击链都要） */
CREATE INDEX IF NOT EXISTS ix_tunnel_asset ON tunnel(asset_id);
CREATE INDEX IF NOT EXISTS ix_webshell_asset ON webshell(asset_id);
CREATE INDEX IF NOT EXISTS ix_credential_asset ON credential(asset_id);
CREATE INDEX IF NOT EXISTS ix_access_asset ON access_session(asset_id);
CREATE INDEX IF NOT EXISTS ix_score_hit_asset ON score_hit(asset_id);

CREATE VIEW IF NOT EXISTS v_asset_summary AS
SELECT a.id, a.ip, a.segment_cidr, a.state, a.primary_name, a.first_seen, a.last_seen,
  (SELECT COUNT(*) FROM port p WHERE p.asset_id = a.id AND p.state = 'open') AS open_ports,
  (SELECT COUNT(*) FROM observation o WHERE o.entity_kind = 'asset' AND o.entity_id = a.id AND o.provenance = 'passive') AS passive_signals,
  (SELECT COUNT(*) FROM observation o WHERE o.entity_kind = 'asset' AND o.entity_id = a.id AND o.provenance = 'active') AS active_signals
FROM asset a;

CREATE VIEW IF NOT EXISTS v_asset_service AS
SELECT p.asset_id, p.port, p.proto, p.provenance AS port_provenance,
       s.name AS service, s.product, s.version, s.provenance AS service_provenance
FROM port p LEFT JOIN service s ON s.port_id = p.id;
`;

export const KNOWLEDGE_DDL = `
CREATE TABLE IF NOT EXISTS poc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,                -- 稳定标识（slug），智能体可直接引用
  title TEXT NOT NULL,
  kind TEXT,                         -- poc | exp | script | template | payload
  category TEXT,                     -- 归类：rce / deserialization / file-upload / sqli / unauthorized / auth-bypass / weak-password / ssrf / xxe / path-traversal / file-read / info-leak / privesc / tunnel / other
  cve TEXT,                          -- CVE / CNVD / 厂商编号
  component TEXT,                    -- 组件/产品（Weblogic、Shiro、泛微 OA…）
  versions TEXT,                     -- 影响版本
  severity TEXT,
  language TEXT,                     -- python | go | java | bash | http | nuclei | js | php
  source TEXT,                       -- web | self | manual | nuclei-template | kb
  source_url TEXT,
  description TEXT,
  usage TEXT,                        -- 用法/命令行示例
  content TEXT,                      -- 正文（脚本 / POC / 原始请求）
  path TEXT,                         -- 落盘位置（pocs/<code>/<file>），便于智能体直接 cat
  verified INTEGER DEFAULT 0,        -- 是否实测验证过
  verified_note TEXT,                -- 验证证据（哪台目标、什么回显）
  hit_count INTEGER DEFAULT 0,       -- 被复用次数
  used_on TEXT,                      -- 最近一次使用在哪个靶标/目标
  -- 来源溯源：这条知识是在哪个靶标、哪台资产上发现/验证出来的（建立时间看 created_at）
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
/* 注意：归类 / 来源靶标两个索引**不能写在这里** —— 老 knowledge.db 的 poc 表还没有
   这两列，CREATE INDEX 会在 exec(DDL) 阶段直接抛
   "no such column: category"，连补列的迁移都跑不到。它们在 migrateKnowledge() 补完列之后再建。 */
`;

export interface PocCategory {
	code: string;
	name: string;
	hint: string;
}

export const POC_CATEGORIES: PocCategory[] = [
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

export function pocCategoryName(code: unknown): string {
	const hit = POC_CATEGORIES.find((item) => item.code === String(code ?? ""));
	return hit ? hit.name : (code ? String(code) : "未归类");
}

export function guessPocCategory(text: unknown): string {
	const value = String(text ?? "").toLowerCase();
	const has = (...words: string[]): boolean => words.some((word) => value.includes(word));
	if (has("反序列化", "deserial", "shiro", "fastjson", "weblogic", "log4j", "jackson")) return "deserialization";
	if (has("文件上传", "file-upload", "fileupload", "upload", "getshell", "webshell", "写马")) return "file-upload";
	if (has("sql 注入", "sqli", "sql注入", "注入拖库", "union select")) return "sqli";
	if (has("弱口令", "爆破", "brute", "默认口令", "默认凭据", "hydra")) return "weak-password";
	if (has("隧道", "socks", "suo5", "frp", "chisel", "regeorg", "代理")) return "tunnel";
	if (has("未授权", "unauth", "免认证", "免鉴权", "未鉴权", "无鉴权")) return "unauthorized";
	if (has("越权", "认证绕过", "鉴权绕过", "jwt", "逻辑漏洞", "验证码绕过", "auth-bypass")) return "auth-bypass";
	if (has("rce", "命令执行", "代码执行", "表达式注入", "模板注入", "ssti", "命令注入", "远程执行")) return "rce";
	if (has("ssrf", "服务端请求伪造")) return "ssrf";
	if (has("xxe", "外部实体")) return "xxe";
	if (has("任意文件读", "文件读取", "目录穿越", "路径穿越", "path traversal", "lfi", "任意文件下载")) return "path-traversal";
	if (has("提权", "横向", "pass-the-hash", "mimikatz", "impacket", "凭据复用")) return "privesc";
	if (has("信息泄露", "配置泄露", "敏感信息", "源码泄露", "泄露", "leak")) return "info-leak";
	return "other";
}

export function migrate(db: SqlDb): void {
	const has = (table: string, column: string): boolean => {
		try {
			return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => (row as { name?: string }).name === column);
		} catch {
			/* 读不到表结构 = 没有这一列，交给 ensure 尝试 ALTER */
			return false;
		}
	};
	const ensure = (table: string, column: string, ddl: string): boolean => {
		if (has(table, column)) return false;
		try {
			db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
		} catch {
			/* 并发迁移时忽略 */
		}
		return true;
	};
	ensure("vuln", "target", "TEXT");
	ensure("vuln", "found_by_agent", "TEXT");
	ensure("vuln", "found_at", "TEXT");
	ensure("port", "url", "TEXT");
	ensure("port", "title", "TEXT");
	ensure("asset", "test_status", "TEXT DEFAULT 'untested'");
	ensure("asset", "test_notes", "TEXT");
	ensure("asset", "test_surface", "TEXT");
	ensure("asset", "test_updated_at", "TEXT");
	ensure("asset", "test_updated_by", "TEXT");
	ensure("asset", "blocked_count", "INTEGER DEFAULT 0");
	ensure("asset", "priority", "TEXT");
	ensure("asset", "potential", "TEXT");
	ensure("asset", "assess_reason", "TEXT");
	ensure("asset", "assessed_at", "TEXT");
	ensure("asset", "assessed_by", "TEXT");
	ensure("asset", "discovered_at", "TEXT");
	ensure("vuln", "agent", "TEXT");
	ensure("credential", "agent", "TEXT");
	ensure("webshell", "agent", "TEXT");
	ensure("tunnel", "agent", "TEXT");
	ensure("attack_step", "tool", "TEXT");
	ensure("attack_step", "agent", "TEXT");
	ensure("attack_step", "result", "TEXT");
	ensure("asset", "scope", "TEXT");
	ensure("vuln", "gained", "TEXT");
	ensure("credential", "secret_value", "TEXT");
	ensure("score_point", "rule", "INTEGER");
	ensure("score_point", "tier", "TEXT");
	ensure("score_point", "cap", "INTEGER DEFAULT 0");
	ensure("score_point", "dedup_scope", "TEXT DEFAULT 'service'");
	ensure("score_point", "legacy", "INTEGER DEFAULT 0");
	ensure("score_point", "builtin", "INTEGER DEFAULT 0");
	ensure("score_point", "src", "INTEGER");
	ensure("score_hit", "multiplier", "REAL DEFAULT 1");
	ensure("score_hit", "points", "INTEGER");
	ensure("score_hit", "vuln_id", "INTEGER");
	ensure("score_hit", "step_id", "INTEGER");
	ensure("attack_step", "point_id", "INTEGER");
	try {
		db.prepare("DELETE FROM stage WHERE code IN ('external','foothold','tunnel','privilege')").run();
		db.prepare("DELETE FROM stage WHERE code = 'target' AND name = '靶标系统权限'").run();
		db.prepare("DELETE FROM stage WHERE code NOT IN ('recon','internet','boundary','internal','target')").run();
	} catch {
		/* 表还不存在 */
	}
	if (has("stage", "attck")) {
		try {
			db.exec("ALTER TABLE stage DROP COLUMN attck");
		} catch {
			/* 老 SQLite 不支持 DROP COLUMN */
		}
	}
	try {
		db.prepare("UPDATE attack_step SET stage_code = NULL WHERE stage_code IN ('external','foothold','tunnel','privilege')").run();
		db.prepare("UPDATE score_hit SET stage_code = NULL WHERE stage_code IN ('external','foothold','tunnel','privilege')").run();
	} catch {
		/* 忽略 */
	}
	if (has("score_point", "stage_code")) {
		try {
			db.exec("ALTER TABLE score_point DROP COLUMN stage_code");
		} catch {
			/* 忽略 */
		}
	}
	if (has("stage", "blue_team")) {
		try {
			db.exec("ALTER TABLE stage DROP COLUMN blue_team");
		} catch {
			/* 忽略 */
		}
	}
	ensure("score_hit", "stage_code", "TEXT");
	ensure("score_hit", "self_created", "INTEGER DEFAULT 0");
	ensure("score_hit", "port", "INTEGER");
	try {
		const pending = db
			.prepare("SELECT COUNT(*) AS n FROM score_hit WHERE port IS NULL AND target IS NOT NULL AND target <> ''")
			.get() as { n?: number } | undefined;
		if (Number(pending?.n ?? 0) > 0) {
			const upd = db.prepare("UPDATE score_hit SET port = ? WHERE id = ?");
			for (const row of db
				.prepare("SELECT id, target FROM score_hit WHERE port IS NULL AND target IS NOT NULL AND target <> ''")
				.all() as { id: number; target: string }[]) {
				const port = parseTargetPort(row.target);
				if (port !== null) upd.run(port, row.id);
			}
		}
	} catch {
		/* 表还不存在 */
	}
	ensure("tunnel", "entry_kind", "TEXT");
	if (ensure("attack_step", "stage_code", "TEXT")) {
		try {
			const stmt = db.prepare("UPDATE attack_step SET stage_code = ? WHERE stage = ?");
			for (const [legacy, code] of Object.entries(LEGACY_STAGE_MAP)) stmt.run(code, legacy);
		} catch {
			/* 忽略 */
		}
	}
	try {
		db.exec(`UPDATE asset SET scope = (${SCOPE_SQL}) WHERE scope IS NULL OR scope = ''`);
	} catch {
		/* 首次建库时表为空 */
	}
	try {
		db.exec("UPDATE asset SET discovered_at = COALESCE(first_seen, last_seen) WHERE discovered_at IS NULL OR discovered_at = ''");
	} catch {
		/* 忽略 */
	}
}

export function migrateKnowledge(db: SqlDb): void {
	const has = (column: string): boolean => {
		try {
			return db.prepare("PRAGMA table_info(poc)").all().some((row) => (row as { name?: string }).name === column);
		} catch {
			return true;
		}
	};
	const ensure = (column: string, ddl: string): void => {
		if (has(column)) return;
		try {
			db.exec(`ALTER TABLE poc ADD COLUMN ${column} ${ddl}`);
		} catch {
			/* 并发迁移时忽略 */
		}
	};
	ensure("category", "TEXT");
	ensure("engagement_id", "TEXT");
	ensure("engagement_name", "TEXT");
	ensure("asset_target", "TEXT");
	ensure("found_by_agent", "TEXT");
	try {
		db.exec("CREATE INDEX IF NOT EXISTS ix_poc_category ON poc(category)");
	} catch {
		/* 忽略 */
	}
	try {
		db.exec("CREATE INDEX IF NOT EXISTS ix_poc_engagement ON poc(engagement_id)");
	} catch {
		/* 忽略 */
	}
	try {
		const rows = db.prepare("SELECT id, code, title, component FROM poc WHERE COALESCE(category, '') = ''").all() as {
			id: number;
			code?: string;
			title?: string;
			component?: string;
		}[];
		const upd = db.prepare("UPDATE poc SET category = ? WHERE id = ?");
		for (const row of rows) {
			upd.run(guessPocCategory([row.code, row.title, row.component].filter(Boolean).join(" ")), row.id);
		}
	} catch {
		/* 忽略 */
	}
}
