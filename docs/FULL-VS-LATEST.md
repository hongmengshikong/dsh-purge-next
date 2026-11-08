# 满血版 vs 最新开源版：差异与升级前必读

> 目的：你在更新 `dsh-purge` 之前，先看清「完整版 1.1.71」「最新开源版 1.1.92 / 0.2.2-rc.1」「本项目满血版 0.2.2-rc.1-full.1」三者的真实差异。
>
> 结论先说：**最新版不是完整版的超集**。1.1.71 有完整知识库/技能库，但没有证据账本；最新开源版有证据账本/未知问题，却把知识库关掉、技能库页面换成环境适配。现在的满血版是两者的并集。

---

## 1. 三个“版本”分别指什么

| 称呼 | 具体对象 | 位置 |
| --- | --- | --- |
| **完整版（满血基线）** | `v1.1.71`（1.1.73 之前的最后一个完整 tag） | bare repo：`D:\Home\dsh-purge-dist\dsh-purge.git` |
| **最新开源版** | `v1.1.92` tag / `0.2.2-rc.1` master（当前旧仓库） | `D:\Home\dsh-purge` 与 `dsh-purge-dist\dsh-purge-1.1.92.tgz` |
| **本项目满血版** | `dsh-purge-next 0.2.2-rc.1-full.1` | `D:\Home\dsh-purge-next`，远端 `master` / `dist` |

关键分界提交：

```
2b6487c  1.1.73: open-source local-lab only; drop skills and knowledge base.
```

也就是说：**1.1.72 及以前是完整版；1.1.73 起进入“开源本地实验版”，知识库/技能库被下线。**

---

## 2. 功能对照表

| 能力 | 完整版 1.1.71 | 最新开源版 1.1.92 / 0.2.2-rc.1 | 本项目满血版 full.1 |
| --- | --- | --- | --- |
| 补丁引擎（84 条 / 门禁 36） | ✅ | ✅ | ✅ 同 |
| 提示词注入 | ✅ | ✅ | ✅ 同 |
| POC 知识库（`knowledge.db`、8 op、6 工具） | ✅ 真正可检索/回填 | ⛔ dispatch 直接返回 `开源版已下架知识库`，工具返回 `KB_DISABLED` | ✅ 已恢复 |
| nuclei 模板检索 | ✅ | ⛔ 随 POC 入口一起不可达 | ✅ 平台目录优先 + 索引缓存 |
| 知识库页面 | ✅ `KnowledgeTab` | ❌ 页签被重定向到 `EnvTab` | ✅ 知识库页 |
| 技能库页面 | ✅ `SkillsTab` | ❌ 页签被重定向到 `EnvTab` | ✅ 技能库页 + 新建/导入/体检 |
| 随包红队技能（23 个 md） | ✅ 随包 | ✅ 仍随包，但无技能页 | ✅ 随包 + 启动幂等安装 |
| 证据账本（evidence 5 工具） | ❌ 没有 | ✅ | ✅ |
| 未解决问题台账（unknown 3 工具） | ❌ 没有 | ✅ | ✅ |
| `redteam_agent_slot` 并发闸门 | ✅ | ✅ | ✅（settings 三级生效） |
| `probeSessions` 会话实测 | ✅ | ✅ | ✅（HTTP + TCP） |
| 环境适配（platformConfig* / EnvTab） | ✅ | ✅ | ✅ |
| 红队工具数 | 56 | 64 | 65（旧 64 名全覆盖 + attack_graph） |
| `/redteam/api` op | 72 | 72 | 91（含新增） |
| UI | 旧版完整页面（知识库/技能库可用） | 旧版页面，但知识库/技能库换成环境适配 | 自研 14 页面 + 五页签 + 演练台 7 子页签 |
| 更新源 | 旧仓库 | 旧仓库 | 本仓库 `dist` 分支（单通道 master） |

工具数差异的来源：1.1.92 比 1.1.71 多 8 个工具（evidence 5 + unknown 3）；POC 的 6 个工具两边都有，只是 1.1.92 里执行即返回“已下架”。

---

## 3. “最新版”到底删了什么

以 `D:\Home\dsh-purge`（0.2.2-rc.1）为例，能直接看到：

1. **POC 全链路下线**
   ```js
   // lib/redteam/store-core.js
   if (op === 'pocSearch' || ... || op === 'pocStats') {
     return { ok: false, error: '开源版已下架知识库', disabled: true }
   }
   ```
   工具侧同样：
   ```js
   const KB_DISABLED = JSON.stringify({ ok: false, error: '开源版已下架知识库', disabled: true })
   ```

2. **知识库/技能库页面被替换**
   ```js
   // client.js
   else if (st.tab === 'env' || st.tab === 'knowledge' || st.tab === 'skills')
     body = h(EnvTab, ...)
   ```
   点“知识库/技能库”实际看到的是“环境适配”。

3. **但数据没有删**
   - `knowledge.db`、`pocs/`、23 个技能文件、`config.json` 都还在；
   - 只是最新版不给你入口/不执行；换回完整版或本项目即可继续用。

4. **最新版新增了完整版没有的**
   - `evidence-ledger.mjs`：语义哈希证据账本（claimed/observed/upgrade/未闭环）；
   - `unknown`：未解决作战问题台账；
   - 以及后续一些会话/状态修正。

所以“越新越全”不成立；1.1.71 和 1.1.92 是两条能力线。

---

## 4. 更新 dsh-purge 前怎么选

### 方案 A：退回完整版 1.1.71

适合：你主要用知识库/技能库，不需要证据账本。

```powershell
# 从 bare repo 取完整版源码（不动现有工作树）
git --git-dir=D:\Home\dsh-purge-dist\dsh-purge.git show v1.1.71:package.json | Select-String version

# 或在临时目录检出
git --git-dir=D:\Home\dsh-purge-dist\dsh-purge.git worktree add D:\Home\dsh-purge-1.1.71 v1.1.71
```

注意：这是旧仓库代码，宿主版本要匹配；装回后 `dsh-purge` 与 `dsh-purge-next` 只能启用一个。

### 方案 B：留在最新开源版 1.1.92 / 0.2.2-rc.1

适合：只用补丁、演练台数据、证据账本；接受没有知识库/技能库入口。

- 恢复入口的唯一办法是改代码去掉 `KB_DISABLED` / `EnvTab` 重定向（不建议长期维护）；
- 数据文件仍在 `$DSH_HOME/redteam`，随时可切回完整版读取。

### 方案 C（推荐）：用本项目满血版

- 已把 1.1.71 的 POC/技能库/环境适配和 1.1.92 的证据账本/unknown/闸门合并；
- 安装源：`https://github.com/hongmengshikong/dsh-purge-next/archive/refs/heads/dist.tar.gz`；
- 装前先 **还原并停用旧 `dsh-purge`**，两者同时启用会撞 `/redteam/api`、工具名、`.dshpurge.bak`；
- 数据兼容：同样使用 `$DSH_HOME/redteam`，旧靶标库/知识库/技能文件直接可读。

---

## 5. 更新前检查清单

1. `dsh-purge` 面板先点「还原」，确认补丁回到未打状态；
2. 备份 `$DSH_HOME\redteam`（至少 `knowledge.db`、`pocs\`、`skills\`、`settings.json`、`config.json`）；
3. 从 profile 的 `package.json` 与 `cordis.patch.yml` 移除旧插件（或至少禁用）；
4. 安装新版本后先看 `/dsh-purge-next/status`：`required 36 / drifted 0`；
5. 再打开面板点「应用」，确认 `applied 69 / pending 0`；
6. 需要回滚时：还原 → 卸新装旧 → 用第 2 步备份恢复数据。

---

## 6. 一句话总结

- **1.1.71**：知识库/技能库完整，但没有证据账本；
- **1.1.92 / 0.2.2-rc.1**：证据账本/unknown 有了，知识库/技能库入口被砍；
- **本项目 full.1**：两边并集，且工具 65/65、op 91、UI 14 页；更新 `dsh-purge` 时建议直接切到它，或明确退回 1.1.71。
