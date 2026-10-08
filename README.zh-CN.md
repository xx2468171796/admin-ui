# admin-ui

**为数据密集型管理后台而生的 React 19 组件库**——页面模板、数据表格、多视图表格、记录详情、权限管理、数据看板、表单搭建、主题，以及 AI 编程工具能直接照着用的机器可读使用规则。

[![CI](https://github.com/xx2468171796/admin-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/xx2468171796/admin-ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@adminui/react.svg)](https://www.npmjs.com/package/@adminui/react)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

文档与在线演示：**https://adminui.zygskins.cn** · [English](README.md)

## 特点

- **先选模板再写页面。** 列表、指标列表、分区、设置、工作区、看板、向导等页面模板把布局定死，整个后台每一页长得一样、用起来一样。
- **为真实数据设计。** 表格支持服务端分页、排序、冻结列、批量操作；多视图表格（表格 / 看板 / 画册 / 日历 / 甘特）虚拟滚动，能扛 10 万行；记录详情三档尺寸。
- **默认就小。** 根入口和 `styles.css` 都很小（CI 里有体积预算）；重功能放在可选子路径，样式跟着用到它的组件自动进来。
- **不绑后端。** 数据、权限、业务规则都通过你写的 adapter 注入；示例里有 Go / Rust 单文件服务。
- **自带护栏。** 随包的 `admin-ui-audit` 命令检查你项目里的界面漂移（自造按钮、色卡外颜色、深层导入等）。

## 安装

```sh
npm install @adminui/react react@^19 react-dom@^19
```

**npm 上还没有这个包之前**，装 GitHub Release 附带的 tarball（和 npm 包内容一样）：

```sh
npm install https://github.com/xx2468171796/admin-ui/releases/download/v8.3.0/adminui-react-8.3.0.tgz react@^19 react-dom@^19
```

想用别的包名导入的项目可以用 npm 别名（`"my-ui": "npm:@adminui/react@^8"`）；`admin-ui-audit` 会从你的 `package.json` 认出这种别名。

可选依赖只在用到对应子路径时安装：

| 导入 | 内容 | 另外安装 |
|---|---|---|
| `@adminui/react` | 核心组件、hooks、合同类型、色卡 | — |
| `@adminui/react/styles.css` | 核心样式（token、基础、核心组件） | — |
| `@adminui/react/grid` | 多视图表格 `BitableGrid` | `@tanstack/react-table` `@tanstack/react-virtual` |
| `@adminui/react/views` | 看板、画册、日历、甘特、视图标签 | — |
| `@adminui/react/charts` · `/dashboard-builder` | 图表、看板搭建器 | `echarts` |
| `@adminui/react/form-builder` · `/forms-public` | 收集表单搭建器 · 公开填写页 | — |
| `@adminui/react/access` | 权限部件、权限控制台、治理页 | — |
| `@adminui/react/settings` | 字典 / 参数配置页（`/peizhi` 是 8.x 保留的旧名，已弃用） | — |
| `@adminui/react/markdown` | Markdown 编辑器 | `react-markdown` `remark-gfm` |
| `@adminui/react/excel` | CSV / XLSX 解析 | `read-excel-file` |
| `@adminui/react/grid-query` · `/record-detail-spec` | 无 React 的服务端半边（视图翻查询、布局校验） | — |
| `@adminui/react/catalog` | 机器可读能力清单（纯数据） | — |

## 起步

```tsx
import "@adminui/react/styles.css"; // 入口文件的第一个 import
import { AdminProvider, NotificationProvider } from "@adminui/react";

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider storageKey="my-app:admin" palette="forest" mode="system">
      <NotificationProvider>{children}</NotificationProvider>
    </AdminProvider>
  );
}
```

地区默认值是中性的：日期按浏览器时区，金额不带币种符号，电话框按浏览器语言的地区选区号。在 Provider 上设一次自己的（组件自己的属性仍然优先）：

```tsx
<AdminProvider storageKey="my-app:admin" defaults={{ timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" }}>
```

服务端用的 `/grid-query` 不读 Provider，要显式传 `timeZone`。

只从公开入口导入；重的子路径（`grid`、`views`、`charts`、`dashboard-builder`、`form-builder`、`access`、`markdown`、`excel`）一律懒加载：

```tsx
const CustomersGrid = lazy(() => import("./customers-grid")); // 里面 import "@adminui/react/grid"
```

把漂移检查放进 CI：

```sh
npx admin-ui-audit src --baseline ui-audit-baseline.json
```

## 示例

| 目录 | 适合 |
|---|---|
| [examples/small](examples/small) | 一两个列表的内部工具（只用核心入口） |
| [examples/medium](examples/medium) | 完整后台：全部模板、多视图表格、权限、看板 |
| [examples/large](examples/large) | 多模块后台，重功能懒加载 |
| [examples/single-service](examples/single-service) | Go 或 Rust + SQLite，一个二进制带上前端 |

## 仓库结构

```
packages/react   组件库本体（@adminui/react）、测试、体积预算、审计工具
sites/docs       文档与演示站（https://adminui.zygskins.cn）
examples/        独立的消费方示例项目
scripts/         编译 dist、dist 核对、泄漏守卫
```

编译产物 `dist/` **不提交**：CI 和发布流程里现编（`npm run build`）。克隆后先跑一次 `npm run build` 再跑 `npm run check`。

## 参与贡献

欢迎 PR，先读 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。请遵守[行为准则](CODE_OF_CONDUCT.md)；安全问题请通过 GitHub 私密漏洞报告提交（见 [SECURITY.md](SECURITY.md)，没有安全邮箱）。

## 许可

[MIT](LICENSE) © 2026 admin-ui contributors。部分组件模式源自 shadcn/ui（MIT），见 [THIRD-PARTY.md](THIRD-PARTY.md)。
