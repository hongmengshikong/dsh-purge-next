# dsh-purge-next 任务书

> 这份文件是项目的**唯一进度真相**。每次开工先读「§2 当前状态」，收工前更新它。
> 开发过程中发现新问题/新约束，**直接改这份文档**（改完在 §12 记一行），不要另开文档。

- 仓库：`D:\Home\dsh-purge-next`（git 已重建，单一初始提交）
- 参考仓库（冻结，只读）：`D:\Home\dsh-purge`，tag `v0.2.2-rc.1` = `385ce36`
- 目标宿主：DSH `0.2.2-rc.1`（npx 缓存 `_npx\1e7f6d9597241db0`）
- 本仓库远端：**尚未上传**（上传后把 URL 填到 §9 与 update 源配置）
- 最后更新：2026-11-08 20:30（确立全面重构目标）

---

## 1. 目标与范围

### 最终目标
用 TypeScript 全面重构 dsh-purge，交付 `dsh-purge-next`，在 DSH 宿主上达到**与 dsh-purge 等价的效果**：

1. 门禁：`required 36 / bad 0 / drifted 0`；
2. `apply → revert` 后宿主文件与快照**字节级一致**；
3. 二次 apply 幂等（`applied=0`）；
4. 提示词注入、工具注入、红队演练台（资产库/评分/报告/UI）功能对齐；
5. 安装/更新链路可用，且**更新源指向本仓库**；
6. 主线只保留 TS 源码、配置、补丁语料与文档。

### 重构范围（全部要迁）
| 层 | 旧仓库位置 | 新仓库目标 | 里程碑 |
| --- | --- | --- | --- |
| 补丁引擎 | `lib/core.js` | `src/engine/*` | M3 |
| 提示词注入 | `lib/inject*.js`、`lib/default-prompt-inject.md` | `src/prompt/*` | M4 |
| 红队数据层 | `lib/redteam/store-core.js` 等 | `src/redteam/store/*` | M2 |
| 红队工具 | `lib/redteam/tools.js` | `src/redteam/tools.ts` | M5 |
| 红队 HTTP API | `lib/redteam/ui.js` | `src/redteam/api.ts` | M5 |
| 红队 UI | `lib/redteam/client.js` | `src/client/*`（TSX） | M6 |
| 更新/安装 | `lib/update.js`、`scripts/ensure-profile-bundle.mjs` | `src/update/*`、`src/tools/*` | M7 |
| 门禁/快照工具 | `scripts/host-*.mjs` | `src/tools/*` | 已起步 |

### 明确不做
- 不重写 `patches/*.json` 的锚点语义（原样搬运）。
- 不保留「正式版 / 测试版」双通道：**只有一条主线**（`master`），没有 `beta` 分支、没有 channel 切换、没有 `channel.json`（见 D7）。
- 不引入运行时依赖。
- 不在主线提交构建产物与宿主快照。

### 硬约束（平台契约）
| 约束 | 说明 |
| --- | --- |
| `main: lib/index.js` | 宿主直接 import 构建产物（产物由 `prepare`/`npm pack` 生成，不入库） |
| `exports` 子路径 | `./client`、`./redteam`、`./redteam/store` |
| `dsh.client` | `platform: "web"` + `inject` 列表 |
| `dsh.bundle.patch` | `cordis.patch.yml` 写 insert |
| 插件导出 | `{ name, inject, apply }`，`name` 必须与包名一致 |
| client 形态 | `window.__ModuleLoader__.load({ id, factory })` |
| `engines >=22` | `node:sqlite` 需要 |
| 零运行时依赖 | `dependencies: {}` |

---

## 2. 当前状态

**阶段：M1 完成；M2（红队数据层 parity）进行中。**

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 仓库重建（单提交、无产物/快照） | ✅ | `029f960`，36 个 tracked 文件 |
| TS 构建 | ✅ | `npm run build` → `lib/` + `client.js` |
| 语料 | ✅ | 84 条（10/3/8/63） |
| status parity | ✅ | 与旧 `core.patchStatus` 逐 id 一致（0 diff） |
| 门禁 | ✅ | required 36 / bad 0 / drifted 0 |
| client 真机 | ✅ | 隔离实例 `dataset.dshPurgeNext === "loaded"` |
| 快照取值 | ✅ | `npm run fixture:fetch`（不入库） |
| M2 engagement 生命周期 | ✅ | `slugify/open/list/active`，7 条单测 |
| M2 schema 全量 | ✅ | DDL/KNOWLEDGE_DDL 与旧实现 sha256 一致；迁移幂等；建库接进 openEngagement |
| M2 资产读写 | ✅ | `upsertAsset/stats/listAssets`（SQL 与旧实现一致；asset 行已对照旧 `importBundle`） |
| M2 ingest 完整链路 | ⬜ | 下一项：ports/services/names/observations/edges + importBundle |

---

## 3. 目录结构

```
src/
  index.ts                 主插件入口
  host/types.ts            宿主最小契约
  engine/                  补丁引擎（types/codec/load/status；M3 加 apply/revert）
  prompt/                  【M4】提示词注入与清洗
  redteam/
    index.ts                演练台插件壳
    store/                  数据层（schema/store/types；M2 扩 queries/score）
    tools.ts                【M5】工具定义
    api.ts                  【M5】HTTP /redteam/api
  client/index.ts          【M6】UI（TSX）
  update/                  【M7】单通道更新
  tools/
    gate.ts                 门禁
    fixture.ts              快照获取
tests/                     全部 .ts
patches/                   84 条语料（入库）
docs/TASKBOOK.md           本文件
```

---

## 4. 开发规范

- **源码 100% TypeScript**：`src/**`、`tests/**` 不允许 `.js/.mjs/.cjs`。
- `lib/**`、`client.js`、`tests/fixtures/**` 是生成物，不入库。
- `strict` + `noUncheckedIndexedAccess`；禁止 `any`。
- ESM 相对导入带 `.js` 后缀。
- 不吞异常；兜底必须注释原因。
- 提交前：`npm run typecheck && npm run build && npm test && npm run gate`。
- Commit：`<type>(<scope>): <subject>`；一个里程碑至少一个 commit。
- 版本与宿主 1:1：`0.2.2-rc.1` ↔ `v0.2.2-rc.1`；不跨版本声明兼容。

---

## 5. 里程碑

### M1 骨架 + 语料 + status 门禁 ✅
见 §2。

### M2 红队数据层 parity（进行中）
1. 列旧 `store-core.js` 的方法清单，按“核心读写 / 统计评分 / 附件与知识库”分组；
2. 选 8–10 个高频方法（engagement / target / asset / finding / score）先移植；
3. 旧实现跑固定输入序列 → `expected-db-dump.json`（不入库，随 fixture）；
4. 新实现跑同一序列 → 逐字段对比；
5. 迁移幂等测试。

验收：parity 0 diff；`npm test` 全绿。

### M3 补丁引擎 apply/revert
- 移植 `applyPatches`、`revertAll`、备份（`.dshpurge.bak`）、原子写；
- 验收：快照上 apply 后 84 条状态正确；revert 后与快照 sha256 全等；二次 apply `applied=0`。

### M4 提示词注入
- 移植 prompt-inject 的读写、seed、identity 清洗；
- 验收：`prompt-inject.md` 内容与旧实现逐字节一致（同输入）。

### M5 红队工具 + API
- tools 定义与 JSON 输出契约；`POST /redteam/api` 分派；
- 验收：同一请求序列，新旧响应逐字段一致。

### M6 UI（TSX）
- 设置页 + 演练台面板；esbuild 打包；
- 验收：3099 隔离实例面板可用，无 console 报错。

### M7 单通道更新 + 安装
- 删除 stable/beta 概念：`update.js` 只保留 `master`；
- 更新源指向本仓库（URL 待上传后填）；
- `ensure-profile-bundle` 逻辑 TS 化；
- 验收：从本仓库安装 → 启动 → 更新检查指向本仓库。

### M8 全面 parity 与安全网
- apply/revert 字节级、幂等、双跑；
- 工具/API/UI 冒烟；
- 验收：与旧插件同宿主同操作，结果一致。

### M9 切换
- 旧仓库冻结；新仓库打 tag `v0.2.2-rc.1`（与宿主同版）。

---

## 6. 参考代码位置

| 旧路径 | 新目标 | 备注 |
| --- | --- | --- |
| `lib/core.js` | `src/engine/` | 引擎与匹配判定 |
| `lib/settle-policy.js` | `src/engine/restart-policy.ts` | applied>0 / sealed / promptReady |
| `lib/host-clean.js` | `src/engine/host-clean.ts` | identity 标记优先 |
| `lib/redteam/store-core.js` | `src/redteam/store/` | 5153 行，按 schema/rows/queries/score 拆 |
| `lib/redteam/schema.js` | `src/redteam/store/schema.ts` | DDL + 迁移 |
| `lib/redteam/score-rules.js` | `src/redteam/store/score.ts` | 评分口径 |
| `lib/redteam/tools.js` | `src/redteam/tools.ts` | 工具契约 |
| `lib/redteam/client.js` | `src/client/`（TSX） | 4219 行 |
| `lib/update.js` | `src/update/` | **去掉 stable/beta** |
| `build-client.mjs` | `esbuild.config.ts` | 已替换 |
| `hosts/0.2.2-rc.1/` | `tests/fixtures/`（不入库） | `npm run fixture:fetch` |
| `scripts/host-verify.mjs` | `src/tools/gate.ts` | 已移植 |

---

## 7. 验证流程

### 7.0 首次准备
```powershell
npm install            # devDeps；prepare 自动 build
npm run fixture:fetch  # 从旧仓库复制 0.2.2-rc.1 快照（不入库）
```

### 7.1 日常
```powershell
npm run typecheck
npm run build
npm test
npm run gate
```

### 7.2 client 真机（隔离实例）
```powershell
$env:DSH_HOME = 'D:\Home\_dsh-next'
node "C:\Users\Administrator\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh\lib\bin.js" `
  next-poc --port 3099 --no-open
# 控制台：document.body.dataset.dshPurgeNext → "loaded"
```

### 7.3 字节级还原（M3 起）
apply → revert → 与快照 sha256 全等；二次 apply `applied=0`。

---

## 8. 决策记录

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 产物与快照不入库 | 主线只留源码；安装走 `prepare`/`npm pack` |
| D2 | client 用 esbuild + banner/footer | 真机验证通过 |
| D3 | 零运行时依赖 | 减少宿主侧不确定性 |
| D4 | TS 只覆盖数据层与工具契约 | 锚点/字符串手术收益低 |
| D5 | 补丁语料原样复制 | 版本知识不可重写 |
| D6 | 版本与宿主 1:1 | 防跨版本 pattern 污染 |
| D7 | **取消正式版/测试版双通道** | 用户无此需求；只保留 `master` 一条线，删除 `channel.json`/`beta` ref |
| D8 | **更新源指向本仓库** | URL 待上传后填入 `src/update/` 配置；在此之前更新检查返回“未配置” |

---

## 9. 待办（跨里程碑）

- [ ] 上传仓库后填写 URL：`https://github.com/<owner>/dsh-purge-next`（占位，待定）
- [ ] `src/update/` 只保留单通道逻辑，删除 stable/beta
- [ ] `ensure-profile-bundle` TS 化
- [ ] 桌面（desktop）路径是否纳入，M5 后评估

---

## 10. 风险与已知坑

1. 插件 `name` 必须等于包名，否则 client 404。
2. `host-clean` 的 `[completeSection]` 三元会误伤，identity 标记优先。
3. `net-scope.js` 的 `allowCache` 未声明（旧仓库已知 ReferenceError），不要照抄。
4. `rewind.wrapSessionDeriveMessages` 是死调用，移植时删除。
5. 旧 `tools.js` 里 `return KB_DISABLED` 之后有大段死代码（`args` 未定义），移植时按现状判断是否保留。
6. 旧 `schema.js` 迁移里的 `LEGACY_STAGE_MAP` / `SCOPE_SQL` 悬空，移植要补定义或删除。
7. Windows 下 git 换行：`patches/**` 已 `-text`，fixture 不入库。

---

## 11. 接手检查清单

1. 读 §2；2. `git log --oneline`；3. 跑 §7.1；4. 从当前里程碑的验收项继续；5. 收工更新 §2 与 §12 并提交。

---

## 12. 变更日志（只追加）

- 2026-11-08 20:16 — M1 完成：语料 84 条、status parity 0 diff、gate 36/0/0；首次提交 `d997eb3`。
- 2026-11-08 20:19 — 源码全 TS（`src/tools/gate.ts`、`tests/loader-sim.test.ts`、`esbuild.config.ts`）。
- 2026-11-08 20:22 — 产物与快照移出版本库；新增 `fixture:fetch` 与 `prepare`。
- 2026-11-08 20:26 — 清空历史，重建仓库为单一提交 `029f960`。
- 2026-11-08 20:32 — M2 资产：`ip.ts`（ipToInt/cidrOf/scopeOfIp）与 `assets.ts`（upsertAsset/stats/listAssets）；旧 store `importBundle` 对照两行资产字段完全一致（8.8.8.8 external/live/portal、10.0.0.5 internal/unknown）。观测量（observation）尚未写入，属 ingest 端口后续。27 tests 全绿。
- 2026-11-08 20:30 — M2 schema：`src/redteam/store/schema.ts` 全量移植（DDL 4 段 sha256 与旧实现一致，迁移幂等，FTS5 探测），`score-rules.ts` 提供 parseTargetPort；`openEngagement` 现在建全量 schema。23 tests 全绿。
- 2026-11-08 20:29 — M2 第一片：`src/redteam/store/{meta,engagement}.ts`（slugify/open/list/active），7 条单测；19 tests 全绿。schema 全量与 seed 仍待移植。
- 2026-11-08 20:30 — 确立全面重构目标；取消 stable/beta 双通道（D7）；更新源指向本仓库（D8，URL 待填）；里程碑扩到 M2–M9。
