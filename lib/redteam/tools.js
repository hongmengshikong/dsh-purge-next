import { dispatch, redteamRoot } from "./api.js";
import { findDshHome } from "../engine/host-discovery.js";
import { bindEngagement, bindKeyOf, bindingViewOf, boundEngagement, resolveEngagement } from "./session.js";
import { maxAgentsOf, maxAgentsSourceOf } from "./settings.js";
import { platformSummary } from "./platform-config.js";
const json = (value) => JSON.stringify(value, null, 2);
/* 并发闸门：按会话根 id 记录预留（子智能体真正跑起来前先占位）。 */
const RESERVATION_CAP = 500;
const reservations = new Map();
function slotOwner(exec) {
    return bindKeyOf(exec);
}
function reservationList(owner) {
    return reservations.get(owner) ?? [];
}
function addReservation(owner, label) {
    const key = label + "#" + Date.now();
    const list = reservationList(owner).slice();
    list.push({ key, label: label || "slot", at: Date.now() });
    reservations.set(owner, list.slice(-RESERVATION_CAP));
    return key;
}
function dropReservation(owner, key) {
    const list = reservationList(owner).slice();
    const index = key ? list.findIndex((item) => item.key === key) : 0;
    if (index < 0)
        return false;
    list.splice(index, 1);
    reservations.set(owner, list);
    return true;
}
export function buildTools(dshHome = findDshHome()) {
    const root = redteamRoot(dshHome);
    return [
        {
            name: "redteam_engagement_open",
            description: "打开或创建一次攻防演练靶标（按单位名称）。若靶标已存在则复用其资产库；后续资产工具默认作用于它。",
            parameters: {
                target: { type: "string", required: true, description: "靶标单位名称" },
                scope: { type: "array", items: { type: "string" }, description: "授权范围 CIDR 列表（可选）" },
            },
            execute(args, exec) {
                const name = String(args.target ?? "").trim();
                if (!name)
                    throw new Error("target 必填");
                const scope = Array.isArray(args.scope) ? args.scope : [];
                const opened = dispatch(root, { op: "openEngagement", name, scope });
                if (!opened.ok)
                    return json(opened);
                const id = opened.engagement.id;
                bindEngagement(exec, id);
                const stats = dispatch(root, { op: "stats", engagement: id });
                return json({ ...opened, stats, session: bindingViewOf(exec) });
            },
        },
        {
            name: "redteam_asset_add",
            description: "把一个资产及其端口/服务/指纹写入资产库（幂等 upsert）。provenance 必填：被动收集 passive，主动探测 active。",
            parameters: {
                engagement: { type: "string", description: "靶标 id；省略用当前指针" },
                ip: { type: "string", required: true },
                state: { type: "string", description: "live | dead | unknown" },
                primary_name: { type: "string" },
                provenance: { type: "string", enum: ["passive", "active"], required: true },
                tool: { type: "string" },
                names: { type: "array", items: { type: "object" } },
                ports: { type: "array", items: { type: "object" } },
            },
            execute(args, exec) {
                const ip = String(args.ip ?? "").trim();
                if (!ip)
                    throw new Error("ip 必填");
                if (args.provenance !== "passive" && args.provenance !== "active")
                    throw new Error("provenance 必须是 passive|active");
                const asset = {
                    ip,
                    state: typeof args.state === "string" ? args.state : undefined,
                    primary_name: typeof args.primary_name === "string" ? args.primary_name : undefined,
                    provenance: args.provenance,
                    tool: typeof args.tool === "string" ? args.tool : undefined,
                    names: args.names,
                    ports: args.ports,
                };
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "ingest", engagement: id, bundle: { assets: [asset] } }));
            },
        },
        {
            name: "redteam_asset_query",
            description: "检索资产库（C 段 / 状态 / 排序 / 条数）。返回资产行与开放端口计数。",
            parameters: {
                engagement: { type: "string" },
                cidr: { type: "string" },
                state: { type: "string", enum: ["live", "dead", "unknown"] },
                sort: { type: "string", enum: ["priority", "todo", "ports", "ip", "discovered"] },
                limit: { type: "number", description: "默认 50，最大 200" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, {
                    op: "assets",
                    engagement: id,
                    cidr: typeof args.cidr === "string" ? args.cidr : undefined,
                    state: typeof args.state === "string" ? args.state : undefined,
                    sort: typeof args.sort === "string" ? args.sort : "ip",
                    limit: Math.min(Number(args.limit) || 50, 200),
                }));
            },
        },
        {
            name: "redteam_session_bind",
            description: "把当前会话绑定到指定靶标（不影响其它会话）。",
            parameters: {
                engagement: { type: "string", required: true, description: "靶标 id" },
            },
            execute(args, exec) {
                const id = String(args.engagement ?? "").trim();
                if (!id)
                    throw new Error("engagement 必填");
                bindEngagement(exec, id);
                return json({ ok: true, session: bindingViewOf(exec) });
            },
        },
        {
            name: "redteam_session_info",
            description: "查看当前会话绑定的靶标。",
            parameters: {},
            execute(_args, exec) {
                return json({ ok: true, session: bindingViewOf(exec) });
            },
        },
        {
            name: "redteam_vuln_add",
            description: "记录一条漏洞成果（标题必填；severity/cve/asset_id/target/evidence 可选）。",
            parameters: {
                engagement: { type: "string" },
                title: { type: "string", required: true },
                severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
                cve: { type: "string" },
                asset_id: { type: "number" },
                target: { type: "string" },
                evidence: { type: "string" },
            },
            execute(args, exec) {
                const title = String(args.title ?? "").trim();
                if (!title)
                    throw new Error("title 必填");
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addVuln", engagement: id, vuln: { ...args, title } }));
            },
        },
        {
            name: "redteam_vuln_query",
            description: "按 severity/status 查询漏洞成果。",
            parameters: {
                engagement: { type: "string" },
                severity: { type: "string" },
                status: { type: "string" },
                limit: { type: "number" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "vulns", engagement: id, severity: args.severity, status: args.status, limit: args.limit }));
            },
        },
        {
            name: "redteam_credential_add",
            description: "记录凭据（host 必填；同一 host+username+secret_type 幂等更新）。",
            parameters: {
                engagement: { type: "string" },
                host: { type: "string", required: true },
                username: { type: "string" },
                secret_type: { type: "string" },
                secret_value: { type: "string" },
                privilege: { type: "string" },
            },
            execute(args, exec) {
                const host = String(args.host ?? "").trim();
                if (!host)
                    throw new Error("host 必填");
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addCredential", engagement: id, credential: { ...args, host } }));
            },
        },
        {
            name: "redteam_tunnel_list",
            description: "列出已记录的内网隧道。",
            parameters: { engagement: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "tunnels", engagement: id, limit: args.limit }));
            },
        },
        {
            name: "redteam_chain_add",
            description: "追加一条攻击链步骤。",
            parameters: {
                engagement: { type: "string" },
                title: { type: "string", required: true },
                stage: { type: "string" },
                asset_id: { type: "number" },
                vuln_id: { type: "number" },
                tool: { type: "string" },
                result: { type: "string" },
            },
            execute(args, exec) {
                const title = String(args.title ?? "").trim();
                if (!title)
                    throw new Error("title 必填");
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addChainStep", engagement: id, step: { ...args, title } }));
            },
        },
        {
            name: "redteam_roles",
            description: "列出演练台的作战角色（role/title/planner）。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                const result = dispatch(root, { op: "prompts", engagement: id });
                return json({ ok: true, roles: (result.roles ?? []).map((role) => ({ role: role.role, title: role.title, planner: role.planner })) });
            },
        },
        {
            name: "redteam_role_prompt",
            description: "读取某个角色的提示词正文。",
            parameters: { engagement: { type: "string" }, role: { type: "string", required: true } },
            execute(args, exec) {
                const role = String(args.role ?? "").trim();
                if (!role)
                    throw new Error("role 必填");
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                const result = dispatch(root, { op: "prompts", engagement: id });
                const hit = (result.roles ?? []).find((item) => item.role === role);
                return json(hit ? { ok: true, role, content: hit.content } : { ok: false, error: `未知角色: ${role}` });
            },
        },
        {
            name: "redteam_role_prompt_reset",
            description: "把角色提示词恢复为内置默认（不传 role 则全部恢复）。",
            parameters: { engagement: { type: "string" }, role: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "resetPrompts", engagement: id, role: args.role }));
            },
        },
        {
            name: "redteam_asset_graph",
            description: "资产图谱：C 段 → 资产 → 开放端口（含域名解析边）。",
            parameters: { engagement: { type: "string" }, cidr: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "graph", engagement: id, cidr: args.cidr }));
            },
        },
        {
            name: "redteam_http_evidence_add",
            description: "记录一条 HTTP 请求/响应证据（可直接粘贴进 Burp 复现）。",
            parameters: {
                engagement: { type: "string" },
                url: { type: "string", required: true },
                method: { type: "string" },
                status: { type: "number" },
                request: { type: "string" },
                response: { type: "string" },
                vuln_id: { type: "number" },
            },
            execute(args, exec) {
                const url = String(args.url ?? "").trim();
                if (!url)
                    throw new Error("url 必填");
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addHttpEvidence", engagement: id, evidence: { ...args, url } }));
            },
        },
        {
            name: "redteam_attack_file_add",
            description: "保存针对目标实际生效的脚本/POC（落盘 attack-files/）。",
            parameters: {
                engagement: { type: "string" },
                target: { type: "string", required: true },
                name: { type: "string", required: true },
                content: { type: "string", required: true },
                kind: { type: "string" },
                description: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addAttackFile", engagement: id, file: args }));
            },
        },
        {
            name: "redteam_asset_get",
            description: "取单个资产详情（含端口与服务）。",
            parameters: { engagement: { type: "string" }, id: { type: "number", required: true } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "asset", engagement: id, id: args.id }));
            },
        },
        {
            name: "redteam_asset_stats",
            description: "资产/端口/漏洞/凭据等计数。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "stats", engagement: id }));
            },
        },
        {
            name: "redteam_asset_assess",
            description: "给资产打易打性/潜力与理由。",
            parameters: {
                engagement: { type: "string" },
                id: { type: "number", required: true },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                potential: { type: "string" },
                assess_reason: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "assessAsset", engagement: id, assess: args }));
            },
        },
        {
            name: "redteam_score_list",
            description: "得分看板（summary + 每个得分点的计数）。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                const board = dispatch(root, { op: "scores", engagement: id });
                return json({ ok: true, summary: board.summary, items: (board.items ?? []).map((item) => ({ code: item.code, counted: item.counted, earned: item.earned, capped: item.capped })) });
            },
        },
        {
            name: "redteam_score_hit",
            description: "记录一次得分（code + evidence 必填）。",
            parameters: {
                engagement: { type: "string" },
                code: { type: "string", required: true },
                evidence: { type: "string", required: true },
                target: { type: "string" },
                asset_id: { type: "number" },
                points: { type: "number" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addScoreHit", engagement: id, hit: args }));
            },
        },
        {
            name: "redteam_score_report",
            description: "计分总账（summary + 已得/未得条目）。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                const report = dispatch(root, { op: "scoreReport", engagement: id });
                return json({ ok: true, summary: report.summary, achieved: report.achieved, missing: report.missing });
            },
        },
        {
            name: "redteam_report",
            description: "生成 Markdown 成果报告。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "report", engagement: id }));
            },
        },
        {
            name: "redteam_sessions",
            description: "会话总览：webshell / 隧道（含是否真正跨越边界）+ 凭据/访问计数。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "sessions", engagement: id }));
            },
        },
        {
            name: "redteam_attack_graph",
            description: "攻击图谱：资产 → 漏洞 → 攻击步骤。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "attackGraph", engagement: id }));
            },
        },
        {
            name: "redteam_vuln_update",
            description: "更新漏洞状态/严重度/证据/拿到什么。",
            parameters: {
                engagement: { type: "string" },
                id: { type: "number", required: true },
                status: { type: "string" },
                severity: { type: "string" },
                evidence: { type: "string" },
                gained: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "updateVuln", engagement: id, id: args.id, patch: args }));
            },
        },
        {
            name: "redteam_tunnel_update",
            description: "更新隧道状态/备注/延迟。",
            parameters: {
                engagement: { type: "string" },
                id: { type: "number", required: true },
                status: { type: "string" },
                note: { type: "string" },
                latency_ms: { type: "number" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "updateTunnel", engagement: id, id: args.id, patch: args }));
            },
        },
        {
            name: "redteam_asset_link",
            description: "建立实体关系边（asset/domain/port/vuln 之间）。",
            parameters: {
                engagement: { type: "string" },
                src_kind: { type: "string", required: true },
                src_id: { type: "string", required: true },
                dst_kind: { type: "string", required: true },
                dst_id: { type: "string", required: true },
                relation: { type: "string", required: true },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "assetLink", engagement: id, link: args }));
            },
        },
        {
            name: "redteam_shot_list",
            description: "列出证据截图。",
            parameters: { engagement: { type: "string" }, point_id: { type: "number" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "shots", engagement: id, point_id: args.point_id, limit: args.limit }));
            },
        },
        {
            name: "redteam_shot_add",
            description: "保存一张证据截图（base64）。",
            parameters: {
                engagement: { type: "string" },
                data: { type: "string", required: true },
                label: { type: "string" },
                point_id: { type: "number" },
                asset_id: { type: "number" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "shotAdd", engagement: id, shot: args }));
            },
        },
        {
            name: "redteam_credential_list",
            description: "列出已获取凭据。",
            parameters: { engagement: { type: "string" }, host: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "credentials", engagement: id, host: args.host, limit: args.limit }));
            },
        },
        {
            name: "redteam_webshell_list",
            description: "列出已上线 webshell。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "webshells", engagement: id }));
            },
        },
        {
            name: "redteam_webshell_add",
            description: "登记 webshell（url 必填，(url,pass_key) 幂等）。",
            parameters: {
                engagement: { type: "string" },
                url: { type: "string", required: true },
                pass_key: { type: "string" },
                shell_type: { type: "string" },
                status: { type: "string" },
            },
            execute(args, exec) {
                const url = String(args.url ?? "").trim();
                if (!url)
                    throw new Error("url 必填");
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addWebshell", engagement: id, webshell: { ...args, url } }));
            },
        },
        {
            name: "redteam_attack_file_list",
            description: "列出已保存的攻击文件。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "attackFiles", engagement: id }));
            },
        },
        {
            name: "redteam_asset_test",
            description: "更新资产测试状态（untested/testing/tested/blocked/abandoned/no_surface）。",
            parameters: {
                engagement: { type: "string" },
                id: { type: "number", required: true },
                status: { type: "string" },
                notes: { type: "string" },
                surface: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "assetTest", engagement: id, test: args }));
            },
        },
        {
            name: "redteam_asset_timeline",
            description: "资产发现时间线（按天聚合 + 最近资产）。",
            parameters: { engagement: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "discoveryTimeline", engagement: id, limit: args.limit }));
            },
        },
        {
            name: "redteam_domain_index",
            description: "域名索引（按资产数排序）。",
            parameters: { engagement: { type: "string" }, q: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "domains", engagement: id, q: args.q, limit: args.limit }));
            },
        },
        {
            name: "redteam_web_list",
            description: "列出 Web 资产（URL / 标题 / banner）。",
            parameters: { engagement: { type: "string" }, q: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "web", engagement: id, q: args.q, limit: args.limit }));
            },
        },
        {
            name: "redteam_shot_delete",
            description: "删除证据截图（同时删文件）。",
            parameters: { engagement: { type: "string" }, id: { type: "number", required: true } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "shotDelete", engagement: id, id: args.id }));
            },
        },
        {
            name: "redteam_score_point_save",
            description: "新增/修改自建得分点（内置点拒绝修改）。",
            parameters: {
                engagement: { type: "string" },
                id: { type: "number" },
                code: { type: "string" },
                name: { type: "string" },
                points: { type: "number" },
                category: { type: "string" },
                dedup_scope: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "saveScorePoint", engagement: id, point: args }));
            },
        },
        {
            name: "redteam_report_targets",
            description: "按目标聚合漏洞数量。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "reportTargets", engagement: id }));
            },
        },
        {
            name: "redteam_chain",
            description: "读取攻击链步骤。",
            parameters: { engagement: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "chain", engagement: id, limit: args.limit }));
            },
        },
        {
            name: "redteam_access_add",
            description: "记录一次可用访问（host/username/method/privilege）。",
            parameters: {
                engagement: { type: "string" },
                host: { type: "string", required: true },
                username: { type: "string" },
                method: { type: "string" },
                privilege: { type: "string" },
                session_ref: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addAccess", engagement: id, access: args }));
            },
        },
        {
            name: "redteam_access_list",
            description: "列出访问会话。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "access", engagement: id }));
            },
        },
        {
            name: "redteam_tunnel_add",
            description: "登记内网隧道（entry_kind 决定是否算跨越边界）。",
            parameters: {
                engagement: { type: "string" },
                kind: { type: "string" },
                listen: { type: "string" },
                entry: { type: "string" },
                reach: { type: "string" },
                entry_kind: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "addTunnel", engagement: id, tunnel: args }));
            },
        },
        {
            name: "redteam_webshell_update",
            description: "更新 webshell 状态/备注/延迟。",
            parameters: {
                engagement: { type: "string" },
                id: { type: "number", required: true },
                status: { type: "string" },
                note: { type: "string" },
                latency_ms: { type: "number" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "updateWebshell", engagement: id, id: args.id, patch: args }));
            },
        },
        {
            name: "redteam_attack_chain",
            description: "攻击图谱（旧名，等价 attack_graph）。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "attackGraph", engagement: id }));
            },
        },
        {
            name: "redteam_attack_path",
            description: "攻击图谱（旧名，等价 attack_graph）。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "attackGraph", engagement: id }));
            },
        },
        {
            name: "redteam_preflight",
            description: "开打前自检：靶标统计与运行环境摘要。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "preflight", engagement: id }));
            },
        },
        {
            name: "redteam_session_check",
            description: "检查当前会话绑定的靶标是否仍存在。",
            parameters: {},
            execute(_args, exec) {
                const view = bindingViewOf(exec);
                return json({ ok: true, session: view, resolved: view.engagement });
            },
        },
        {
            name: "redteam_unverified_count",
            description: "还有多少条 claimed/inferred 证据没有闭环核实。",
            parameters: { engagement: { type: "string" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "unverifiedCount", engagement: id }));
            },
        },
        {
            name: "redteam_evidence_list",
            description: "列出证据账本条目（可按 operation / confidence 过滤）。",
            parameters: { engagement: { type: "string" }, operation: { type: "string" }, confidence: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "evidenceList", engagement: id, operation: args.operation, confidence: args.confidence, limit: args.limit }));
            },
        },
        {
            name: "redteam_evidence_record",
            description: "记录一条证据（operation + result 必填，哈希去重）。",
            parameters: {
                engagement: { type: "string" },
                operation: { type: "string", required: true },
                parameters: { type: "object" },
                result: { type: "object", required: true },
                confidence: { type: "string" },
                authority: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "evidenceRecord", engagement: id, evidence: args }));
            },
        },
        {
            name: "redteam_poc_search",
            description: "【打 Nday/1day 第一步】先查知识库（跨靶标 POC/EXP）与本机 nuclei 模板库。",
            parameters: {
                q: { type: "string" },
                cve: { type: "string" },
                component: { type: "string" },
                category: { type: "string" },
                kind: { type: "string" },
                verified: { type: "boolean" },
                limit: { type: "number" },
                templateLimit: { type: "number" },
            },
            execute(args) {
                return json(dispatch(root, { op: "pocSearch", ...args }));
            },
        },
        {
            name: "redteam_poc_get",
            description: "取一条知识库 POC 的完整正文（id 或 code）。",
            parameters: { id: { type: "number" }, code: { type: "string" } },
            execute(args) {
                return json(dispatch(root, { op: "pocGet", ...args }));
            },
        },
        {
            name: "redteam_poc_add",
            description: "把验证有效的 POC/EXP 回填知识库（title 必填，建议带 category/cve/component）。",
            parameters: {
                title: { type: "string", required: true },
                code: { type: "string" },
                kind: { type: "string" },
                category: { type: "string" },
                cve: { type: "string" },
                component: { type: "string" },
                language: { type: "string" },
                content: { type: "string" },
                description: { type: "string" },
                usage: { type: "string" },
                verified: { type: "boolean" },
                verified_note: { type: "string" },
            },
            execute(args) {
                return json(dispatch(root, { op: "pocSave", poc: args }));
            },
        },
        {
            name: "redteam_poc_list",
            description: "列出/筛选知识库条目（轻量字段，不含正文）。",
            parameters: {
                q: { type: "string" },
                category: { type: "string" },
                kind: { type: "string" },
                verified: { type: "boolean" },
                limit: { type: "number" },
            },
            execute(args) {
                return json(dispatch(root, { op: "pocList", ...args }));
            },
        },
        {
            name: "redteam_poc_update",
            description: "补验证结论/归类/正文（id 或 code + patch）。",
            parameters: {
                id: { type: "number" },
                code: { type: "string" },
                verified: { type: "boolean" },
                verified_note: { type: "string" },
                category: { type: "string" },
                content: { type: "string" },
                description: { type: "string" },
            },
            execute(args) {
                const { id, code, ...patch } = args;
                return json(dispatch(root, { op: "pocUpdate", id, code, patch }));
            },
        },
        {
            name: "redteam_poc_use",
            description: "记一次复用（用于排序：常用武器排前面）。",
            parameters: { id: { type: "number" }, code: { type: "string" }, used_on: { type: "string" } },
            execute(args) {
                return json(dispatch(root, { op: "pocUse", ...args }));
            },
        },
        {
            name: "redteam_agent_slot",
            description: "执行智能体并发闸门：status 看名额，acquire 占位（满了直接拒绝），release 释放。",
            parameters: {
                action: { type: "string", required: true, enum: ["status", "acquire", "release"] },
                label: { type: "string" },
                key: { type: "string" },
            },
            execute(args, exec) {
                const owner = slotOwner(exec);
                const reserved = reservationList(owner);
                const live = { running: 0, running_labels: [], available: false, error: "宿主未暴露子会话注册表，按预留统计" };
                const used = Math.max(live.running, reserved.length);
                const cap = maxAgentsOf(root);
                const free = Math.max(cap - used, 0);
                const base = {
                    ok: true,
                    max: cap,
                    used,
                    free,
                    running_from_registry: live.running,
                    running_labels: live.running_labels,
                    reservations: reserved,
                    registry_available: live.available,
                    registry_note: live.error,
                    source: maxAgentsSourceOf(root),
                };
                const action = String(args.action ?? "");
                if (action === "status") {
                    return json({ ...base, hint: free === 0 ? "名额已满：等现有智能体回报后再派。" : "还有 " + free + " 个名额。" });
                }
                if (action === "acquire") {
                    if (free <= 0)
                        return json({ ...base, ok: false, error: "并发已满（最多 " + cap + " 个）：先等回报或 release。" });
                    const key = addReservation(owner, String(args.label ?? "slot"));
                    return json({ ...base, slot: key, used: used + 1, free: Math.max(cap - used - 1, 0), hint: "已占位（" + key + "）；失败时 action=release key=" + key });
                }
                if (action === "release") {
                    const dropped = dropReservation(owner, typeof args.key === "string" && args.key.trim() ? args.key.trim() : undefined);
                    return json({ ...base, released: dropped, used: Math.max(used - (dropped ? 1 : 0), 0) });
                }
                return json({ ...base, ok: false, error: "action 必须是 status|acquire|release" });
            },
        },
        {
            name: "redteam_evidence_verify",
            description: "核对子智能体回报与证据账本是否一致（hash 级核对）。matched=false 表示改口、夸大或库里没有。",
            parameters: {
                engagement: { type: "string" },
                operation: { type: "string", required: true },
                parameters: { type: "object" },
                result: { type: "object", required: true },
                confidence: { type: "string" },
                authority: { type: "string" },
                limitations: { type: "array", items: { type: "string" } },
                supporting_ev_ids: { type: "array", items: { type: "string" } },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "evidenceVerify", engagement: id, evidence: args }));
            },
        },
        {
            name: "redteam_evidence_upgrade",
            description: "把 claimed / inferred 升级为 observed（必须带亲自验证的 verified_result）。",
            parameters: {
                engagement: { type: "string" },
                claimed_ev_id: { type: "string", required: true },
                verified_result: { type: "object" },
                verified_by: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "evidenceUpgrade", engagement: id, evidence: args }));
            },
        },
        {
            name: "redteam_unknown_record",
            description: "记录一个还没解决的作战问题（question+domain 去重）。",
            parameters: {
                engagement: { type: "string" },
                question: { type: "string", required: true },
                severity: { type: "string" },
                domain: { type: "string" },
                recommended_probe: { type: "string" },
                supporting_ev_ids: { type: "array", items: { type: "string" } },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "unknownRecord", engagement: id, unknown: args }));
            },
        },
        {
            name: "redteam_unknown_list",
            description: "列出未解决的作战问题（派活前先看 open 项）。",
            parameters: { engagement: { type: "string" }, status: { type: "string" }, severity: { type: "string" }, limit: { type: "number" } },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "unknownList", engagement: id, status: args.status, severity: args.severity, limit: args.limit }));
            },
        },
        {
            name: "redteam_unknown_resolve",
            description: "把未解决问题标为 resolved / contradicted / withdrawn。",
            parameters: {
                engagement: { type: "string" },
                unk_id: { type: "string", required: true },
                disposition: { type: "string", required: true },
                resolution: { type: "string" },
            },
            execute(args, exec) {
                const id = resolveEngagement(root, exec, args.engagement) ?? boundEngagement(exec);
                return json(dispatch(root, { op: "unknownResolve", engagement: id, unk_id: args.unk_id, disposition: args.disposition, resolution: args.resolution }));
            },
        },
    ];
}
export function registerRedteamTools(ctx, dshHome) {
    const tools = buildTools(dshHome);
    for (const tool of tools) {
        ctx.tools?.register({
            name: tool.name,
            description: tool.description,
            input: tool.parameters,
            execute: (args, exec) => tool.execute(args, exec),
        });
    }
}
