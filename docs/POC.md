# esbuild client PoC

## 为什么做

旧仓库的 `client.js` 靠 `build-client.mjs` 对 `factory: (require) => {` 这个**字面量**做切片，
把 `lib/redteam/client.js` 的一段塞进包装里。源码一改缩进/换 TS，切片就断。

新仓库改用 esbuild：源码正常写 TS → 打成 CJS → 构建脚本套上同样的
`window.__ModuleLoader__.load({ id, factory })` 包装。**不再依赖任何字符串匹配。**

PoC 要回答的只有一个问题：**esbuild 产物套上包装后，能不能在 DSH 的 loader 里正常加载并
`require("react")`，返回 `{ name, inject, apply }`。**

## 两级验证

### 第 1 级：模拟 loader（自动、随时可跑）

```powershell
npm run build
npm run test:loader
```

`tests/loader-sim.mjs` 用 `node:vm` 造一个 `window.__ModuleLoader__.load`，
执行 `client.js`，再用桩 `require` 调 `factory`，断言：

- `load()` 恰好被调用一次，`id === "dsh-purge"`
- `factory` 返回对象含 `apply`（函数）、`inject`（数组）、`name`
- `apply({})` 不抛异常

通过 = 包装结构、CJS 产物、外部依赖 `react` 的解析路径都没有问题。

### 第 2 级：真机（需要一次人工确认）

1. 把 `client.js` 与 `package.json` 放进一个隔离 profile（或临时 DSH_HOME）
2. 启动 dsh，打开页面
3. 看控制台有没有 `dsh-purge-next` 相关报错；插件设置页是否出现

真机失败而第 1 级通过，通常是宿主侧的 `inject` 名称（`slots` / `locale` / `uiConversation`）
或 slot 注册方式不匹配，不是打包问题。

## 失败时怎么办

保留**手写包装**（和旧仓库一样），但只包一层，内部逻辑仍然 TS：

```
client.handwritten.js      // 手写 banner/footer，import("./dist/client-inner.js")
dist/client-inner.js       // esbuild 产物，不套 loader
```

这样既拿到 TS 的内部类型，又不赌 loader 契约。

## 结论（2026-11-08）

真机验证通过：隔离实例（`DSH_HOME=D:\Home\_dsh-next`，profile `next-poc`，端口 3099）的
boot HTML 里注册了
`{"id":"dsh-purge-next","url":"plugins/??dsh-purge-next/client.js&rev=…"}`，
该 URL 返回 200 且内容是 esbuild 产物；浏览器控制台
`document.body.dataset.dshPurgeNext` 返回 `'loaded'`。

→ **采用 esbuild 方案，不再保留手写包装。**

## 当前状态

- `npm run build` 产物：`lib/`（tsc emit）+ `client.js`（esbuild + 包装）
- 零运行时依赖：`dependencies: {}`，`react` 是宿主注入的 external
- `engines: node >=22`（`node:sqlite` 需要）

