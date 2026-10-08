# 适配的技术栈

admin-ui 是 **React 19 前端组件库**；后端是什么语言都行——组件只认 adapter（一个返回 Promise 的函数），数据从哪里来由你决定。

下表里「已验证」= 包里有可运行的示例或测试；「文档支持」= 接入手册写了做法，但没有示例工程；「原理可行」= 没有专门验证，按静态构建的原理应该可用。

## 前端

| 技术栈 | 状态 | 说明 |
|---|---|---|
| **React 19 + Vite（SPA）** | 已验证 | 首选。三档起步样板（small / starter / large）都是 Vite；本站也是 Vite 构建。 |
| **Next.js（App Router）** | 文档支持 | 组件都是客户端组件（`"use client"`），在客户端边界里用；`next.config` 加 `transpilePackages: ['@adminui/react']`。SSR 首屏用项目默认色卡，挂载后再读用户自己选的色卡和字号（存在 localStorage），首屏可能闪一下颜色。没有官方示例工程。 |
| **Remix / React Router 7（框架模式）** | 原理可行 | 同 Next：在客户端组件里用，重的子路径懒加载。 |
| **Tauri / Electron 桌面端** | 原理可行 | 前端照常 Vite 构建，`base: './'` 让资源用相对路径；样式只作用在 `.adminui` 内，不依赖浏览器以外的能力（主题读 `matchMedia`、偏好存 localStorage）。 |
| **微前端 / 嵌进旧系统** | 文档支持 | 样式只匹配 `.adminui` 和 `.aui-*`，不改 html / body / `:root`，可以和旧项目的全局样式共存；同一页面可以有两个不同色卡的区域。 |
| React 18 及以下 | 不支持 | peer 依赖是 `react@^19`。 |
| Vue / Angular / Svelte / 小程序 | 不支持 | 组件是 React 组件。只能用 iframe 或自己包成 Web Component 的方式嵌进去（没有官方方案）。Vue 项目建议选 TDesign、Arco Vue 或 Element Plus。 |

构建工具：Vite、webpack、esbuild、Rspack 都能处理包里按组件拆开的 CSS（每个组件自己 `import` 它那一块样式）。在 Node、SSR 和单元测试里这些 CSS 导入是空模块，不需要配 CSS loader。

## 后端

| 后端 | 状态 | 怎么接 |
|---|---|---|
| **Node：Fastify / Express / NestJS / Hono** | 已验证（模式） | 前端用 `ListAdapter`、`CursorListAdapter`、`UploadAdapter` 等合同类型发 HTTP 请求；分页、排序、筛选的白名单在服务端校验。多维表格的服务端半边 `@adminui/react/grid-query`（无 React）可以直接在 Node / Bun 里用，把视图（筛选、分组、排序）翻成查询。 |
| **Go** | 已验证 | `examples/single-service/go`：`//go:embed all:web/dist` 把前端构建产物嵌进二进制，纯 Go SQLite 驱动，不需要 CGO。 |
| **Rust** | 已验证 | `examples/single-service/rust`：`include_dir` 嵌入同一份 `web/dist`，`tiny_http` 提供接口，`rusqlite` 存数据。 |
| Python / Java / .NET / PHP | 原理可行 | 和 Go / Rust 一样：前端静态构建，后端提供 JSON 接口并托管静态文件。 |

### 单服务（Go / Rust）的形状

```text
tool/
  web/                 # 从 examples/small 或 starter 起步，替换演示 adapter
    dist/              # npm run build 生成，嵌进二进制
  data/tool.sqlite     # 可写的数据目录，不打进二进制
/admin/                # 后台静态入口
/admin/assets/*        # 带哈希的构建资源，长缓存
/api/admin/*           # 同一个进程的 JSON 接口
```

要点：部署在 `/admin/` 时 Vite 的 `base` 改成 `'/admin/'`；SPA 回退只对页面导航生效，缺失的 JS / CSS 和未知接口返回 404；登录、权限、会话、CSRF 和业务校验都在后端做——前端组件里的权限部件只负责展示和编辑，不负责授权。生产环境不需要 Node。

## 数据和权限放在哪

| 放在前端（组件库负责） | 放在后端（你负责） |
|---|---|
| 列表的查询状态、视图配置的编辑、选中、乱序请求丢弃、失败保留输入 | 分页、排序、筛选的白名单校验；`total` 和 rows 同一口径 |
| 权限编辑器、权限诊断的展示 | 真正的授权判断、审计日志落库 |
| 上传队列、进度、重试 | 存储、病毒扫描、签名链接 |
| 看板 / 视图 / 记录详情布局的编辑 | 布局 JSON 的校验（`@adminui/react/record-detail-spec` 可在服务端复用同一套规则）、存储 |
