# dsh-purge-next

dsh-purge 的 TypeScript 重写版：补丁引擎 + 提示词注入 + 红队演练台，零运行时依赖。

- 宿主：DSH `0.2.2-rc.1`（1:1 钉死，门禁 36/36）
- 源码：`src/**` 全 TypeScript；`lib/`、`client.js` 为构建产物（不入库）
- 补丁语料：`patches/**`（84 条，原样搬运）
- 进度与决策：`docs/TASKBOOK.md`

## 构建与验证

```powershell
npm install            # devDeps；prepare 自动 build
npm run fixture:fetch  # 从旧仓库复制 0.2.2-rc.1 宿主快照（不入库）
npm run typecheck
npm test
npm run gate           # required 36 / bad 0 / drifted 0
```

## 插件能力

- 补丁引擎：status / apply / revert（`.dshpurge.bak` 备份、字节级还原、幂等、stale bak 刷新）
- 提示词：启动 seed `$DSH_HOME/prompt-inject.md`、保留用户稿、`/dsh-purge-next/prompt` 读写
- 红队演练台：`/redteam/api`（60 个 op）、42 个 `redteam_*` 工具
- 浮层 UI：清洗（状态表/应用/还原/提示词）与演练台（靶标/资产/得分）

## 更新

单通道 `master`，无 stable/beta。仓库上传后设置 `DSH_PURGE_REPO_URL`（或在
`src/update/check.ts` 填 `DEFAULT_REPO_URL`），否则 `/dsh-purge-next/update` 返回 unconfigured。

## 目录

```
src/engine      补丁引擎（apply/status/revert/host-paths）
src/prompt      提示词注入与默认数据
src/redteam     数据层 / API / 工具 / 角色提示词
src/update      单通道更新与 profile 安装
src/client      浮层面板（esbuild → client.js）
tests/          98 条测试（parity 对照旧实现）
```
