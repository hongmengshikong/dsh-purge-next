# dsh-purge-next 0.2.2-rc.2 发布说明（满血版）

> 与宿主 `0.2.2-rc.1` **1:1 钉死**。只支持这一版宿主。

## 能力

### 清洗（补丁引擎）
- 84 条补丁（10 prompt / 3 code / 8 engine / 63 tools），逐字节搬运旧仓库语料
- `status / apply / revert`：备份 `.dshpurge.bak`、临时文件原子写、`#42` 折叠重写、YAML persona 清理、stale bak 刷新
- 门禁：必需补丁 36 条全部可打，`drifted = 0`
- 还原：`apply → revert` 后目标文件 sha256 与快照全等；二次 apply `applied = 0`

### 提示词注入
- 内置默认正文（25 KB）随仓库分发；启动 seed 到 `$DSH_HOME/prompt-inject.md`
- 用户自写稿永不覆盖；插件旧默认自动刷新；`override-state.json` 记录 hash/seedHash
- `GET/POST /dsh-purge-next/prompt` + 面板编辑框

### 红队演练台
- `POST /redteam/api`：63 个 op（bootstrap / engagement / ingest / assets / vulns / credentials / tunnels / webshells / shots / chain / scores / report / stages / prompts …）
- 53 个 `redteam_*` 工具（名称与旧插件一致；`audit:parity` 校验新名 ⊆ 旧名）
- 数据层：schema 与迁移逐字节对齐旧实现，`importBundle` 八张表 dump 全等
- 评分：25 条规则得分点、service/system/target/none 去重、rule+cap 封顶、看板与 scoreReport 同口径

### UI
- 浮层面板两个标签：
  - **清洗**：状态摘要、更新源、提示词编辑、应用/还原、84 条补丁状态表
  - **演练台**：靶标切换、得分概览、资产表、证据查看（base64 → img）、报告预览

### 更新
- 单通道 `master`，**无 stable / beta**
- 未配置仓库时 `/dsh-purge-next/update` 返回 `unconfigured`；配置后生成 `<repo>/archive/refs/heads/master.tar.gz`
- `ensureProfileBundle`：bundles + `cordis.patch.yml` insert 幂等写入

## 满血能力（相对 0.2.2-rc.1）

- **POC 知识库**：`knowledge.db`（schema/FTS/老库补列迁移）、8 个 op、6 个工具、正文落盘 `pocs/<code>/`
- **nuclei 模板检索**：平台配置目录优先、7 天索引缓存、`templateSearch/Stats`
- **技能库**：redteam + official 双目录扫描、frontmatter 解析、读写删、面板新建
- **环境适配**：`platform-config` 工具解析/整包分配/Kali 探测、3 个 op、面板页
- **证据账本**：语义哈希、record/verify/upgrade/未闭环计数、5 个工具
- **未解决问题**：UnknownRegistry 3 个工具
- **并发闸门**：`redteam_agent_slot` + settings 三级生效
- **会话实测**：probeSessions（HTTP/TCP）
- **UI**：五页签（清洗 / 演练台 / 技能库 / 知识库 / 环境适配）

## 验证（本版实测）

```
npm run typecheck     通过
npm test              25 文件 / 98 条全过
npm run gate          required 36 / bad 0 / drifted 0
npm run audit:parity  tools 65/64（缺 0）、ops 91/72（缺 0）
真机 apply→revert     93 次写入 / 57 文件还原，sha256 回到基线 dbae65a3…
```

## 安装

```powershell
# 目录安装（开发）
dsh plugin --profile web add --ignore-scripts file:D:\Home\dsh-purge-next
node node_modules\dsh-purge-next\scripts\ensure-profile-bundle.mjs   # 若未自动执行

# tarball
npm pack
dsh plugin --profile web add --ignore-scripts .\dsh-purge-next-0.2.2-rc.1.tgz
```

## 安装实测

- `npm pack` → 161.9 KB / 64 文件（含 `lib/`、`client.js`、`patches/`、`docs/`）
- 解包进隔离 profile 后启动：`/dsh-purge-next/status` 200，`/patches` 84 行
- `ensureProfileBundle`：首次补 insert（`insertChanged=true`），第二次调用 `bundlesChanged=false` / `insertChanged=false`

## 已知边界

- 仅支持 `0.2.2-rc.1`；换宿主需重跑 `gen-host-paths` / `fixture:fetch` / `gate`
- 未迁移：POC 知识库（旧版已下架）、平台配置、模板检索、`unknown_*`、`agent_slot`、`evidence_upgrade/verify`
- 更新源：`https://github.com/hongmengshikong/dsh-purge-next`（可用 `DSH_PURGE_REPO_URL` 覆盖）
- 主线只有 TS 源码/配置；构建产物发布在 `dist` 分支，更新包取 `archive/refs/heads/dist.tar.gz`

## 上传后三步

```powershell
node src/tools/set-repo-url.ts https://github.com/<owner>/dsh-purge-next
npm run verify
git add -A; git commit; git tag -d v0.2.2-rc.1; git tag -a v0.2.2-rc.1 -m "dsh-purge-next 0.2.2-rc.1"
git remote add origin <repo>; git push -u origin master; git push origin v0.2.2-rc.1
```

## 升级路径（宿主升版时）

1. `npm run fixture:fetch -- --host <新版本>`（旧仓库先 snapshot）
2. `node src/tools/gen-host-paths.ts --host <新版本>`
3. `npm run gate -- --host <新版本>`，修 patch 锚点直到 36/36
4. `npm run typecheck && npm test`
