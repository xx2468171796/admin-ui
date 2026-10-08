# 安装与起步

> npm 包发布之前，装 GitHub Release 附带的 tarball（内容和 npm 包一样）；发布后改成一行 `npm install`。

## 1. 安装

需要 React 19。可选依赖只在用到对应子路径时安装。

```sh
# npm 发布后
npm install @adminui/react react@^19 react-dom@^19
# 发布前：装 GitHub Release 附带的 tarball
npm install https://github.com/xx2468171796/admin-ui/releases/download/v8.2.0/adminui-react-8.2.0.tgz react@^19 react-dom@^19
```

想用别的名字导入时用 npm 别名（`"my-ui": "npm:@adminui/react@^8"`），`admin-ui-audit` 会从 package.json 认出别名。

| 子路径 | 内容 | 另外安装 |
|---|---|---|
| `@adminui/react` | 全部核心组件、hooks、合同类型、色卡函数 | — |
| `@adminui/react/styles.css` | 核心样式（token、基础和核心组件） | — |
| `@adminui/react/grid` | 多维表格 `BitableGrid` | `@tanstack/react-table` `@tanstack/react-virtual` |
| `@adminui/react/views` | 看板、画册、日历、甘特、视图标签 | — |
| `@adminui/react/charts` | `AdminChart` 和图表 builder | `echarts` |
| `@adminui/react/dashboard-builder` | 看板搭建器、只读看板 | `echarts` |
| `@adminui/react/form-builder` · `/forms-public` | 收集表单搭建器 · 公开填写页 | — |
| `@adminui/react/access` | 权限部件、权限控制台、治理页 | — |
| `@adminui/react/settings` | 字典 / 参数配置页（旧名 `/peizhi` 在 8.x 照样能用，已弃用） | — |
| `@adminui/react/markdown` | Markdown 编辑器 | `react-markdown` `remark-gfm` |
| `@adminui/react/excel` | CSV / XLSX 解析 | `read-excel-file` |
| `@adminui/react/grid-query` · `/record-detail-spec` | 无 React 的服务端半边（视图翻查询、布局校验） | — |
| `@adminui/react/catalog` | 机器可读能力清单（纯数据） | — |

## 2. 样式只引一次，放第一行

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

- **地区默认值是中性的**：日期按浏览器时区，金额不带币种符号，电话框按浏览器语言的地区选区号。项目在 Provider 上设一次：`<AdminProvider defaults={{ timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" }}>`；组件自己的 `timeZone` / `currency` / `defaultCountry` 优先。服务端用的 `/grid-query` 不读 Provider，要显式传 `timeZone`。
- `styles.css` 只有 token、基础和核心组件（约 24 KB gzip）。其它样式**跟着组件自动进来**：每个组件自己引它那一块，打包器把 CSS 打进对应的 chunk。不要手动引包里的其它 CSS 文件。
- 只从公开入口导入；不要写 `@adminui/react/src/...` 或 `.../dist/...`（审计规则 `deep-import` 会报）。
- 重的子路径一律懒加载：

```tsx
const CustomersGrid = lazy(() => import("./customers-grid")); // 里面 import "@adminui/react/grid"
```

## 3. 按项目规模选起步样板

三档只是默认起点，**任何子路径都可以加**——预算只量首屏，重的懒加载就行。

| 规模 | 默认用什么 | 起步样板 | 首屏预算（gzip） |
|---|---|---|---|
| 小：一两个列表的内部工具 | 只用核心入口：外壳、列表页、表单弹框、提示 | `examples/small` | JS ≤ 72 KB（不含 React）/ CSS ≤ 32 KB |
| 中：一个业务系统 | 核心 + 用到才加的子路径 | `examples/starter` | JS ≤ 300 KB（含 React）/ CSS ≤ 40 KB |
| 大：一个平台、很多模块 | 全部子路径，重的放在懒加载路由里 | `examples/large` | JS ≤ 300 KB（含 React）/ CSS ≤ 40 KB |

实测（8.0）：小档首屏 66.7 KB JS（含 React 126.6）/ 30.0 KB CSS；中档 179.3 KB（含 React）/ 37.4 KB；大档 123.8 KB（含 React）/ 33.1 KB。组件库自己的 CI 用 `scripts/size-budget.mjs` 按子路径量 gzip 体积，超预算就失败；建议你的项目也把首屏预算写进门禁。

## 4. 第一个页面

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, DataTable, PageBody, PageHeader, QueryBar, ResourcePanel, StatusBadge, type Column } from "@adminui/react";

type Customer = { id: string; name: string; city: string; active: boolean };

const columns: Column<Customer>[] = [
  { key: "name", title: "客户", render: (c) => <strong>{c.name}</strong>, mobile: "primary" },
  { key: "city", title: "城市", render: (c) => c.city },
  { key: "active", title: "状态", render: (c) => <StatusBadge tone={c.active ? "success" : "neutral"}>{c.active ? "合作中" : "已停用"}</StatusBadge>, mobile: "status" },
];

export function CustomersPage({ rows }: { rows: Customer[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const shown = rows.filter((c) => c.name.includes(q));
  return (
    <PageBody>
      <PageHeader title="客户" actions={<Button><Plus aria-hidden="true" />新建客户</Button>} />
      <ResourcePanel title="全部客户" count={shown.length} unit="家"
        filters={<QueryBar value={q} onChange={setQ} onSearch={() => setPage(1)} onReset={() => setQ("")} variant="flush" />}>
        <DataTable caption="客户" columns={columns} rows={shown.slice((page - 1) * 20, page * 20)} rowKey={(c) => c.id}
          pagination={{ mode: "page", page, pageSize: 20, total: shown.length, onPageChange: setPage, onPageSizeChange: () => setPage(1) }} />
      </ResourcePanel>
    </PageBody>
  );
}
```

真实项目里列表数据走 `useDataSource(adapter, query)`：它负责乱序请求丢弃、刷新时保留旧数据、出错重试；你只写一个 `ListAdapter`（发请求、校验响应）。

## 5. 和现有样式共存

组件库的 CSS 只匹配 `.adminui` 内部和 `.aui-*` 类，不依赖 Tailwind 扫描 node_modules。你可以继续用 Tailwind 或自己的 CSS 写业务区域，颜色用 `var(--aui-*)`。不要覆盖 `.aui-*` 的内部样式——缺什么提 issue 回流到库里。

## 6. 放进门禁

```sh
npx admin-ui-audit src --baseline ui-audit-baseline.json
```

第一次接入先 `--write-baseline` 登记历史问题，之后只许减少。规则见 [给 AI 用](ai.html)。
