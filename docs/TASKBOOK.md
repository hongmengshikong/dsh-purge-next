# dsh-purge-next 任务书

> 这份文件是项目的**唯一进度真相**。每次开工先读「§2 当前状态」，收工前更新它。
> 新窗口接手时，只读这一份就能知道：做到哪、下一步做什么、怎么验证。

- 仓库：`D:\Home\dsh-purge-next`（git 已 init，尚未建首个 commit）
- 参考仓库（冻结，只读）：`D:\Home\dsh-purge`，tag `v0.2.2-rc.1` = `385ce36`
- 目标宿主：DSH `0.2.2-rc.1`（安装于 npx 缓存 `_npx\1e7f6d9597241db0`）
- 最后更新：2026-11-08 20:10（PoC 通过）

---

## 1. 项目目标与边界

### 目标
用 TypeScript 重写 dsh-purge，交付形态不变（DSH 插件、零运行时依赖），换取：
1. 红队数据层（SQLite / 评分 / 工具契约）的类型安全；
2. 可测试的构建链（tsc + esbuild），摆脱 `build-client.mjs` 的字符串切片；
3. 一份 API 契约同时给 server 与 client 用。

### 非目标（明确不做）
- 不重写补丁语料（`patches/*.json` 原样搬运，175 KB / 84 条锚点）。
- 不重写宿主适配知识（锚点、门禁、快照）。
- 不做全量 TS：补丁引擎 / 桌面层 / UI bundle 的类型化收益低，按里程碑再定。
- 不引入运行时依赖（`dependencies` 必须保持 `{}`）。

### 硬约束（平台契约）
| 约束 | 说明 |
| --- | --- |
| `main: lib/index.js` | 宿主直接 import 构建产物 |
| `exports` 子路径 | `./client`、`./redteam`、`./redteam/store` 必须保留 |
| `dsh.client` | `platform: "web"` + `inject` 列表，否则 client 不加载 |
| `dsh.bundle.patch` | `cordis.patch.yml` 里写 insert |
| 插件导出 | `{ name, inject, apply }`，`name` 必须与包名一致（踩过：不一致会导致 client 不注册） |
| client 形态 | `window.__ModuleLoader__.load({ id, factory })`，`factory(require)` 返回带 `apply/inject` 的对象 |
| `engines >=22` | `node:sqlite` 需要 |
| `lib/` 是产物 | 源码在 `src/`；`lib/`、`client.js`、`tests/fixtures/` **都不入库**，由 `npm run build` / `fixture:fetch` 生成 |

---

## 2. 当前状态（每次更新这里）

**阶段：M1 完成（语料 + loader + gate 全绿），下一步 M2 store parity。**

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 项目骨架 | ✅ | `src/`、`tests/`、`docs/`、`esbuild.config.mjs`、`tsconfig.json` |
| TS 构建 | ✅ | `npm run build` → `lib/` + `client.js`（1792 B） |
| 单元测试 | ✅ | `tests/store.test.ts` 5/5 |
| loader 模拟 | ✅ | `tests/loader-sim.mjs`：id/inject/apply/Panel 全通过 |
| 真机注册 | ✅ | 隔离实例 boot HTML 的 manifest 含 `{"id":"dsh-purge-next","url":"plugins/??dsh-purge-next/client.js&rev=…"}` |
| 真机下发 | ✅ | 该 URL 200、1863 B、含 `data-dsh-purge-next` |
| 真机执行 | ✅ | 浏览器控制台 `document.body.dataset.dshPurgeNext` → `'loaded'` |
| M1 语料搬运 | ✅ | `patches/` 8 个文件；prompt 10 / code 3 / engine 8 / tools 63 = 84 |
| M1 loader | ✅ | `src/engine/{types,codec,load}.ts`；`tests/engine-load.test.ts` 4 条通过 |
| M1 gate | ✅ | `npm run gate` → required 36 / bad 0 / drifted 0 / parity diff 0 |

**下一步：M1（补丁引擎骨架 + 语料搬运），见 §5。**

---

## 3. 目录结构与职责

```
src/
  index.ts                 主插件入口（name/inject/apply）
  host/types.ts            宿主最小契约（logger/on/effect/get/provide/tools/webServer）
  engine/                  【M1】补丁引擎：加载 patches、apply/status/revert
    types.ts                PatchSpec / PatchTable / ApplyResult
    load.ts                 读 patches/*.json（运行时 fs，不用 import assertions）
  redteam/
    index.ts                演练台插件壳
    store/                  【M2】数据层（已起步）
      types.ts              实体 + 行类型 + ScoreResult
      schema.ts             DDL + 幂等迁移
      store.ts              DatabaseSync 封装、upsert、评分
      index.ts              re-export
  client/
    index.ts                【M3】UI 入口（当前只有 PoC 标记）
  tools/
    gate.ts                 门禁：快照 status + 必需补丁判定（node lib/tools/gate.js）
patches/                    【M1】从旧仓库原样复制（不得手改语义）
tests/
  store.test.ts             数据层单测
  loader-sim.test.ts        vm 模拟 __ModuleLoader__（读根目录 client.js）
  engine-load.test.ts       语料加载 + 计数 + schema 形状
  status-parity.test.ts     与旧 core.patchStatus 逐 id 对比
  fixtures/                 hosts 快照（不入库；npm run fixture:fetch 生成）
docs/
  TASKBOOK.md               本文件
  POC.md                    client 构建 PoC 记录
```

---

## 4. 开发规范

### 语言与风格
- **源码 100% TypeScript**：`src/**` 与 `tests/**` 不允许出现 `.js/.mjs/.cjs`。
- `lib/**` 与根 `client.js` 是构建产物（宿主只能执行 JS），已在 `.gitattributes` 标记 linguist-generated，不手改。
- `tests/fixtures/**` 是宿主官方文件快照（上游 .js），属于测试数据，不是本项目源码。
- `strict: true`、`noUncheckedIndexedAccess: true`；禁止 `any`（必要时 `unknown` + 收窄）。
- ESM：相对导入必须带 `.js` 后缀（NodeNext）。
- 错误处理：不吞异常；确需兜底时写 `catch (err) { /* 原因 */ }` 并注释为什么可以吞。
- 注释只写“为什么”，不写“是什么”。

### 构建与产物
- 源码只改 `src/`；`lib/` 与 `client.js` 由 `npm run build` 生成，**不进 git**（.gitignore）。
- 提交前必须：`npm run build && npm run typecheck && npm test && npm run gate`。
- 发布：`npm pack`（会先跑 `prepare` → build），产物进 tarball；git 直装依赖 `prepare` 构建。
- `tests/fixtures/` 是宿主快照，也不入库；用 `npm run fixture:fetch` 从旧仓库复制。

### 补丁语料
- `patches/*.json` 原样复制，不重排、不改缩进、不合并条目。
- 新增/修改补丁只允许：`pattern`、`replace`、`markers`、`optional` 等字段级修改，并同步 `NOTES.md`。

### 版本与提交
- 分支：`main`；开发分支 `m1-engine`、`m2-store` …
- Commit：`<type>(<scope>): <subject>`，type ∈ feat/fix/refactor/test/docs/chore。
- Tag：与宿主版本绑定，如 `v0.2.2-rc.1-next.1`；一个 tag 只对一版宿主负责。
- 不提交 `node_modules/`、`lib/` 之外的临时文件；`.gitignore` 必须含 `node_modules/`。

### 安全红线
- 不在仓库里放宿主快照之外的第三方产物；`hosts/` 只放 targetFiles 命中的文件。
- 不把 prompt 明文放进仓库（沿用旧仓库 `.gitignore` 规则）。

---

## 5. 里程碑与验收

### M0 骨架 + client PoC ✅（已完成）
验收：见 §2 表格。

### M1 补丁引擎骨架 + 语料搬运（下一步）
1. `patches/` 从旧仓库复制（prompt/code/engine/tools/display-groups/patch.schema.json/NOTES.md）。
2. `src/engine/types.ts`：`PatchSpec`、`PatchTable`、`ApplyReport`。
3. `src/engine/load.ts`：读取 4 个表 + display groups，最小形状校验（id 唯一、必填字段）。
4. `tests/engine-load.test.ts`：计数 = 10/3/8/63，总数 84；id 唯一；字段类型。
5. `scripts/gate.mjs`：对 `hosts/0.2.2-rc.1` 快照跑 status（可先只读、实现“命中/漂移”判定）。

验收：
- `npm test` 全绿；
- `node scripts/gate.mjs --host 0.2.2-rc.1` 输出与旧仓库 `host:verify` 一致（必需 36、失败 0、drift 0）。

### M2 store parity（数据层）
- 把旧 `store-core.js` 的查询/写入逐组移植；同一 SQLite fixture，新旧实现输出逐字段对比。
- 验收：parity 测试 100% 一致；新增迁移幂等测试。

### M3 UI 迁移（TSX）
- 先设置页（简单面板），再演练台（资产表/评分/报告）。
- 验收：3099 页面出现面板，`document.body.dataset.dshPurgeNext === "loaded"`，无 console 报错。

### M4 字节级安全网
- `apply → revert` 后与 `hosts/<ver>` 快照 sha256 全等；
- 二次 apply `applied=0`（幂等）；
- 门禁接入 CI。

---

## 6. 参考代码位置（旧仓库 = 只读真相）

| 旧仓库路径 | 新仓库目标 | 说明 |
| --- | --- | --- |
| `patches/*.json` | `patches/` | 原样复制，语义不动 |
| `lib/core.js`（补丁表已迁出，引擎在 2000–4800 行） | `src/engine/` | apply/status/backup/revert |
| `lib/settle-policy.js` | `src/engine/restart-policy.ts` | 重启判定（applied>0 / sealed / promptReady） |
| `lib/host-clean.js` | `src/engine/host-clean.ts` | `identity` 标记判定（注意 `[completeSection]` 三元误伤） |
| `lib/redteam/store-core.js` | `src/redteam/store/` | 5153 行，按 schema/rows/queries/score 拆 |
| `lib/redteam/schema.js` | `src/redteam/store/schema.ts` | 584 行 DDL + 迁移 |
| `lib/redteam/score-rules.js` | `src/redteam/store/score.ts` | 871 行评分口径 |
| `lib/redteam/tools.js` | `src/redteam/tools.ts` | 2154 行，工具 schema/JSON 输出 |
| `lib/redteam/client.js` | `src/client/`（TSX） | 4219 行 UI，M3 再动 |
| `build-client.mjs` | `esbuild.config.mjs` | 已替换 |
| `hosts/0.2.2-rc.1/` | `tests/fixtures/host-0.2.2-rc.1/` | 62 文件 / 3.03 MB；M1 复制或软链 |
| `scripts/host-verify.mjs` | `scripts/gate.mjs` | 门禁口径：必需补丁 applied/pending 均可，drifted 失败 |

关键行号（旧仓库，仅供定位，改动后以内容为准）：
- `lib/index.js:2335` `applyShouldRestart` 调用点
- `lib/index.js:2328` `complete` 判定四要素
- `lib/restart-web.js` 自重启（EPIPE 修复版本）
- `lib/net-scope.js:403` `allowCache` 未声明（已知 bug，旧仓库未修）

---

## 7. 验证流程（每条都要能复现）

### 7.0 首次准备（clone 后）
```powershell
npm install                 # devDeps；prepare 会自动 build
npm run fixture:fetch       # 从 D:\Home\dsh-purge\hosts 复制快照（不入库）
```

### 7.1 日常（每次改完）
```powershell
npm run typecheck
npm run build
npm test          # 含 loader-sim.test.ts
npm run gate      # 构建 + 快照门禁
```

### 7.2 client 真机检查（隔离实例，不碰 3080）
```powershell
$env:DSH_HOME = 'D:\Home\_dsh-next'
node "C:\Users\Administrator\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh\lib\bin.js" `
  next-poc --port 3099 --no-open
# 从 stdout 取 token，打开对应 URL，控制台执行：
#   document.body.dataset.dshPurgeNext   → 期望 "loaded"
```
插件安装路径：`D:\Home\_dsh-next\profiles\next-poc\node_modules\dsh-purge-next`（手动拷贝 `lib/`、`client.js`、`package.json`、`cordis.patch.yml`）。

### 7.3 门禁（M1 起）
```powershell
node scripts/gate.mjs --host 0.2.2-rc.1
# 期望：必需 36 / 失败 0 / drifted 0
```

### 7.4 字节级还原（M4）
```powershell
node scripts/revert-check.mjs --host 0.2.2-rc.1
# 期望：apply→revert 后文件 sha256 与 fixtures 全等
```

---

## 8. 决策记录（ADR 简版）

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 产物与快照不入库 | 主线只留源码与数据；安装走 `prepare`/`npm pack`，快照用 `fixture:fetch` |
| D2 | client 用 esbuild + banner/footer | 已用真实 DSH 验证（manifest 注册 + `dataset=='loaded'`） |
| D3 | 零运行时依赖 | 插件装进 profile，减少宿主侧不确定性 |
| D4 | TS 只覆盖数据层与工具契约 | 补丁锚点/字符串手术的类型收益低 |
| D5 | 补丁语料原样复制 | 它是 0.2.0-rc.2→0.2.2-rc.1 的版本知识，重写等于重踩坑 |
| D6 | 版本与宿主 1:1 | 跨版本 pattern 会互相污染，门禁无法定义 |

---

## 9. 风险与已知坑

1. **`name` 必须等于包名**：client 记录按插件名注册，不一致会 404（本次踩过）。
2. **client 记录失效的表现**：boot HTML 有 id，但 `/plugins/??<id>/client.js` 404；先查 `dsh.client` 与 `exports["./client"]`。
3. **`host-clean` 的 `[completeSection]`**：三元表达式会误判“inject 被丢弃”，判定要用 identity 标记优先。
4. **`writeAllowText` 的 `allowCache` 未声明**：旧仓库已知 ReferenceError，移植时不要照抄。
5. **`rewind.wrapSessionDeriveMessages`**：旧仓库死调用，移植时删除。
6. **pnpm 12 拦截 build script**：安装插件用 `--ignore-scripts` + 手动 `ensure-profile-bundle`。
7. **标签/历史**：旧仓库曾重写历史，新项目不要引用旧 commit 的短 sha，只引用 tag。

---

## 10. 接手检查清单（新窗口照做）

1. 读 §2「当前状态」，确认阶段。
2. `git log --oneline -5` 与 §2 是否一致。
3. 跑 §7.1 四条命令，应全绿。
4. 若上一阶段未完成，从对应里程碑的“验收”条目继续；不要跳阶段。
5. 收工前：更新 §2 表格 + 在 §11 追加一条进度记录，然后 commit。

---

## 11. 进度日志（只追加，不改旧条目）

- 2026-11-08 20:10 — M0 完成：TS 骨架、`lib/`+`client.js` 构建、store 单测 5/5、loader 模拟通过；隔离实例（`_dsh-next` / `next-poc` / 3099）真机验证 `dataset.dshPurgeNext === 'loaded'`。esbuild 方案定为 D2。
- 2026-11-08 20:10 — 记录已知坑：插件 `name` 与包名不一致会导致 client 404（已修，`src/index.ts` 现在导出 `dsh-purge-next`）。
- 2026-11-08 20:13 — M1 第一步：`patches/` 原样复制（84 条，10/3/8/63），新增 `src/engine/{types,codec,load}.ts` 与 4 条语料测试。
- 2026-11-08 20:16 — M1 完成：快照落到 `tests/fixtures/host-0.2.2-rc.1`（62 文件），`expected-status.json` 由旧 core 生成；`src/engine/status.ts` 逐 id 与旧实现一致（0 diff），门禁输出 required 36 / bad 0 / drifted 0；11 tests 全绿。首次提交 d997eb3。
- 2026-11-08 20:22 — 主线瘦身：`lib/`、`client.js`、`tests/fixtures/` 全部移出版本库（.gitignore），新增 `src/tools/fixture.ts`（`npm run fixture:fetch`）与 `prepare` 构建；清空历史，重建为单一初始提交。
- 2026-11-08 20:19 — 源码全 TS：`scripts/gate.mjs` → `src/tools/gate.ts`，`tests/loader-sim.mjs` → `tests/loader-sim.test.ts`，`esbuild.config.mjs` → `esbuild.config.ts`（Node 26 原生跑 TS）。仓库里剩下的 `.js` 只有 `lib/**`、`client.js`（产物）与 `tests/fixtures/**`（宿主快照）。12 tests + gate 全绿。
