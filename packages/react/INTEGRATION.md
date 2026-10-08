# adminUI 接入手册

`@adminui/react` 是一套后台 UI SDK：React 19 + TypeScript 7，shadcn / Radix 组合方式，样式已封装，宿主不必装 Tailwind。后端语言不限，经 HTTP adapter 接入；前端必须是 React。

写页面前先读 [AI-RULES.md](AI-RULES.md)（组件套件与硬规则）和 [PAGE-TEMPLATES.md](PAGE-TEMPLATES.md)（**每个页面先选 T01–T17 一个模板**，布局定死只换内容），能力清单在 `import { CAPABILITIES, DESIGN_RULES, PAGE_TEMPLATES } from '@adminui/react/catalog'`。界面改动先做演示（静态页或 starter 页）给产品负责人看，通过后再写代码。

| 文档 | 内容 |
|---|---|
| [AI-RULES.md](AI-RULES.md) | 先选模板、先出演示；套件清单、视觉与交互硬规则、任务提示词、宿主 AGENTS.md 片段 |
| [PAGE-TEMPLATES.md](PAGE-TEMPLATES.md) | 17 个页面模板：用途、骨架、组件、示例代码、演示文件、starter 页 |
| [DESIGN.md](DESIGN.md) | 色卡、尺寸、页面层级、资源面板、客户门户、动效 |
| [TABLES.md](TABLES.md) | 选列表形式、`DataTable`、记录详情三档 |
| [GRID.md](GRID.md) | 多维表格 `BitableGrid`（可选子路径，只给格内录数据的页面） |
| [WORKFLOWS.md](WORKFLOWS.md) | 批量、视图、偏好、任务、草稿、冲突、导入、命令面板、工作区 |
| [ACCESS.md](ACCESS.md) | 角色权限、审计、字典 / 参数、多租户治理 |
| [DASHBOARDS.md](DASHBOARDS.md) | 数据看板 / 运营面板 / 报表页 |
| [CHANGELOG.md](CHANGELOG.md) | 版本记录与升级说明 |
| [MIGRATION-8.md](MIGRATION-8.md) | 从 7.x 升到 8.0：旧 → 新对照表、`admin-ui-audit` 规则 |

## 1. 安装

固定版本安装（`npm install @adminui/react`）：

```json
{"dependencies":{"@adminui/react":"8.1.0","react":"^19.0.0","react-dom":"^19.0.0"}}
```


- npm 包发布之前，可以安装 GitHub Release 里的 tarball：`npm install https://github.com/xx2468171796/admin-ui/releases/download/v8.2.0/adminui-react-8.2.0.tgz`；也可以从源码 `npm pack ./packages/react` 自己打包；workspace 用户可整体 vendor 并记录版本。消费方固定版本，不跟 main。
- Node ≥ 26；包分发编译产物（`dist/`，源码同包附带），Vite 直接用；Next App Router 用客户端入口并配置 `transpilePackages: ['@adminui/react']`；SSR 首屏用项目 `palette`，挂载后再读用户的色卡和字号。
- 本包按 `strict` + `noUncheckedIndexedAccess` 编译，消费方开这两项也不报错，不需要 `skipLibCheck`。

**样式怎么进来**（照做就不会缺样式、也不会把整包 CSS 拖进首屏）：

1. 应用入口的**第一行 import** 写 `import '@adminui/react/styles.css'`。它只有 token、基础和核心组件（约 22 KB gzip）。
2. 其它区域的 CSS（表格工作区、视图、图表、看板搭建器、权限、评论、分享……）**跟着渲染它的组件自动进来**：每个模块自己引自己那块样式（`#aui-css/<块>.css`，在本包 `package.json` 的 `imports` 里映射），打包器照常把 CSS 打进对应的 chunk；Node / SSR / 测试里拿到的是空模块，不报错。宿主不用、也不要手动引这些文件。
3. **只从公开入口导入**：`@adminui/react`、`@adminui/react/<子路径>`、`@adminui/react/styles.css`。不写 `@adminui/react/src/...`、`.../dist/...` 这类深路径（`admin-ui-audit` 的 `deep-import` 规则会报）。
4. **重的子路径懒加载**：`grid`、`views`、`charts`、`dashboard-builder`、`form-builder`、`access`、`markdown`、`excel` 用 `React.lazy(() => import(...))` 或页面级动态 `import()`，它们的 JS 和 CSS 一起按需加载，不进首屏。

### 1.0 按项目规模起步

| 项目规模（project-design） | 默认从哪档起步、按需再加 | 装哪些子路径 | 起步样板 | 首屏预算（gzip） |
|---|---|---|---|---|
| small 小工具 | 只用核心入口：token、主题、基础与表单组件、`DataTable`、`Dialog`、提示、布局、`AdminShell`；不带重依赖 | 无（`@adminui/react` + `styles.css`） | `examples/small`；Go / Rust 单服务静态构建走 `examples/single-service` | ≤ 72 KB JS（不含 react，含 react ≈ 127）/ ≤ 32 KB CSS |
| medium 中型 | 核心 + 用到才加的子路径 | 按页面需要加 `grid` / `views` / `charts` / `form-builder` / `access` / `markdown` / `excel` …，重的懒加载 | `examples/starter` | ≤ 300 KB JS（含 react）/ ≤ 40 KB CSS |
| large 大型 | 全部，重的懒加载 | 全部子路径，`grid` / `views` / `charts` / `dashboard-builder` / `form-builder` / `access` / `markdown` / `excel` 一律懒加载 | `examples/large` | ≤ 300 KB JS（含 react）/ ≤ 40 KB CSS |

**三档只是默认起点，任何子路径都可以加**：小工具要多维表格、图表、搭建器照样装，重的懒加载就行；**预算只量首屏**，不禁止引入任何子路径。本包用 `scripts/size-budget.mjs`（`npm run size`，含在 `npm run check` 里）按子路径量 gzip 体积，超了就失败；宿主项目把首屏预算写进自己的 verify。

### 1.1 入口与可选依赖

| 入口 | 内容 | 额外安装 |
|---|---|---|
| `@adminui/react` | 全部组件、hooks、类型（含 `ListAdapter` / `UploadAdapter` 等合同类型）、色卡函数 | — |
| `@adminui/react/styles.css` | 核心样式（token、基础、核心组件），入口第一行导入一次；其它区域的样式跟组件自动进来 | — |
| `@adminui/react/catalog` | 能力清单 `CAPABILITIES`、`DESIGN_RULES`（纯数据） | — |
| `@adminui/react/charts` | `AdminChart` 与图表 builder | `echarts@6.1.0` |
| `@adminui/react/markdown` | `MarkdownEditor` | `react-markdown@^10.1.0 remark-gfm@^4.0.1` |
| `@adminui/react/excel` | `parseSpreadsheet`（CSV / XLSX） | `read-excel-file@9.3.10` |
| `@adminui/react/grid` | `BitableGrid` 等（见 [GRID.md](GRID.md)） | `@tanstack/react-table@^9.2.4 @tanstack/react-virtual@^3.14.13` |
| `@adminui/react/grid-query` | 多维表格的后端半边（无 React，Node / Bun 直接用） | — |
| `@adminui/react/access` | 权限部件、`AccessConsole`、治理页（见 [ACCESS.md](ACCESS.md)） | — |
| `@adminui/react/settings` | `DictManager` / `ParamManager`（旧名 `/peizhi` 在 8.x 照样能用，已弃用） | — |
| `@adminui/react/views` | 看板 / 画册 / 日历 / 甘特、视图标签与设置、`DashboardTabs`（见 [VIEWS.md](VIEWS.md)） | — |
| `@adminui/react/dashboard-builder` | `DashboardBuilder` / `DashboardView`、`normalizeDashboard`、`migrateDashboardSpec`（见 [DASHBOARDS.md](DASHBOARDS.md) §14） | `echarts@6.1.0` |
| `@adminui/react/org-picker` | 组织选人 `OrgPicker` / `OrgPickerField`、`OrgDataSource` 等类型、纯规则（见 §4.2）；GrantList / ShareDialog 给 `orgSource` 时自动懒加载它 | — |
| `@adminui/react/form-builder` | 收集表单搭建器 `FormBuilder` | — |
| `@adminui/react/forms-public` | 公开填写页 `PublicForm` / `FormSuccess` | — |
| `@adminui/react/record-detail-spec` | 记录详情布局 JSON 的规则（无 React，服务端校验用） | — |

根入口不导入任何可选依赖、也不再导出子路径的东西；子路径用 `React.lazy` 按页加载（样式随之按需加载）。

### 1.2 本地 starter

```bash
npm pack ./packages/react --pack-destination /tmp
cp -R packages/react/examples/starter /tmp/adminui-starter
cp /tmp/adminui-react-8.0.0.tgz /tmp/adminui-sdk.tgz   # starter 依赖 ../adminui-sdk.tgz
cd /tmp/adminui-starter && npm install && npm run dev
```

starter 是完整的演示后台（用户列表 / 详情 / 弹框 / 客户与订单 / 轻量集合 / 多维表格 / 权限 / 工作流 / 动效 / 运营看板），数据虚构、没有生产副作用。

## 2. Provider、外壳与色卡

```tsx
import '@adminui/react/styles.css';   // 应用入口第一行
import { AdminProvider, AdminShell, AppearanceButton, NotificationProvider, CommandPalette, navCommands, type NavItem } from '@adminui/react';

export function AdminRoot({ children }: { children: React.ReactNode }) {
  return <AdminProvider storageKey="my-project:admin" palette="forest" mode="system">
    <NotificationProvider>{children}</NotificationProvider>
  </AdminProvider>;
}
```

| `AdminProvider` 属性 | 说明 |
|---|---|
| `storageKey`（必填） | 用户外观 / 色卡 / 字号的 localStorage 前缀，每个项目一个 |
| `palette` | 色卡 id（`forest` 默认、`ocean`、`celadon`、`graphite`、`clay`、`plum`）、完整 `PaletteSpec` 或品牌色 `"#rrggbb"`；规则见 [DESIGN.md](DESIGN.md) §1 |
| `mode` | `light`（默认）/ `dark` / `system`；是项目默认，用户在外观里选过就以用户的为准（宿主再改 `mode` 时以宿主为准） |
| `density` | `compact`（默认，表格行 40px）/ `comfortable`（48px） |
| `defaultFontSize` | `small / medium / mediumLarge`（默认）`/ large / xlarge` |
| `motion` | `system`（默认，跟随系统减少动态）/ `none` |
| `defaults` | 地区默认值 `{ timeZone, currency, phoneCountry }`，见下 |

**地区默认值**：SDK 不假定任何国家或地区。没设置时：时区 = 浏览器的（服务端 = 进程的 `TZ`），金额不显示币种符号，电话框的区号 = 浏览器语言的地区（不在列表里就用列表第一个）；`MONEY_CURRENCIES` 按 ISO 币种代码排序，`PHONE_COUNTRIES` / `FORM_COUNTRY_CODES` 按地区代码排序。项目在 Provider 上设一次：`<AdminProvider defaults={{ timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" }}>`（`currency` 写 ISO 代码或直接写符号如 `"¥"`）。组件自己的 `timeZone` / `currency` / `defaultCountry`、`GridField.currency` / `timeZone` / `phoneCountry` 优先；BitableGrid 把没写这些的字段用 Provider 的值补上。`useAdminDefaults()` 读当前值，不用 AdminProvider 的地方包一层 `AdminDefaultsProvider`。纯函数（`/grid-query` 的 `parseGridQuery` / `applyGridQuery` / `buildGridSql` / `buildGridGroupSql`、`formatDateTime`、`formatMinorMoney`、share-core 等）不读 Provider：服务端要显式传 `timeZone`（mysql / sqlite 的 `utcOffset` 不传时按这个时区当前的偏移算），金额要显式传 `symbol` / `field.currency`。

`useAdminTheme()` 返回 `{ palette, paletteChoice, setPalette, fontSize, setFontSize, portal, motionEnabled, mode, modeChoice, setMode, density }`。主题与 `.aui-portal` 只存在 Provider 内，不改 html / body / `:root`；同页可有两个不同色卡的后台区域，弹层挂在所属区域。不要给 Provider 祖先加 transform / filter / overflow-hidden。

### 2.1 AdminShell

```tsx
const navigation: NavItem[] = [
  { id: 'dashboard', title: '运营总览', icon: Gauge },                         // 不分组，排在最上
  { id: 'users', title: '用户管理', icon: Users, group: '用户与资产', keywords: '会员 账号' },
  { id: 'wallets', title: '钱包流水', icon: Wallet, group: '用户与资产' },
];

<AdminShell logo="A" brand={<>Acme <small>工作台</small></>} navigation={navigation} tabs={tabs} activeId={activeId}
  onNavigate={navigate} onCloseTab={closeTab} onCloseTabs={closeTabs}
  company={{ value: tenantId, options: tenants.map((t) => ({ id: t.id, name: t.name })), onSwitch: switchTenant }}
  account={{ name: me.name, detail: `${me.account} · ${tenantName}`, role: me.title }}
  accountMenu={[
    { id: 'me', label: '我的资料', icon: UserRound, onSelect: () => navigate('me') },
    { id: 'tokens', label: 'API 令牌', icon: KeyRound, onSelect: () => navigate('tokens') },
    { id: 'admin', label: '管理后台', icon: LayoutGrid, href: '/admin/', external: true },
  ]}
  onSignOut={logout}
  documentTitle={(t) => `${t} · 运营后台`}
  headerActions={<>
    <CommandPalette commands={navCommands(navigation, navigate, [{ id: 'pwd', label: '改密码', run: openPassword }])} />
    <AppearanceButton />
  </>} />
```

- 外壳尺寸和账号区：侧栏 232 / 折叠 64 / 顶栏 48。「切换公司」在品牌下（`company`：`options` + `onSwitch`，或只给 `onOpen` 打开宿主自己的选择页），左下一行头像打开账号菜单（`accountMenu` + 「外观」+ `onSignOut`）；侧栏底部不放散按钮。
- 顶栏是真面包屑：`crumbRoot`（如「管理后台」）→ 标签自己的 `crumbs` 或菜单 `group` → 当前页；`NavItem.badge` / `badgeTone` / `locked` 给菜单数量和「没开通」。
- 工作标签是胶囊；`pinned` 标签（工作台）只有图标、不能关；「关闭其他 / 关闭右侧」一次关几个，传 `onCloseTabs(ids)`（不传就逐个调 `onCloseTab`，那时 `onCloseTab` 不能读过时的状态）。手机上没有标签条，顶栏的页签数按钮列出已打开的页面。

- `tabs[].content` 是页面 JSX，未激活页保留挂载；路由、权限、未保存关闭确认由宿主管（starter 有例子）。菜单和标签用稳定唯一 id。
- `group` 把菜单分组（按首次出现顺序）；不写 `group` 的项平铺。`keywords` 只给搜索用。
- `variant="portal"` 是给客户的用户中心（无多页签，`mobileNav` 底部栏），见 [DESIGN.md](DESIGN.md) §3.3。
- `CommandPalette` 放顶栏右上，命令用 `navCommands` 从菜单生成：按空格拆词、每个词都要出现在「名称 + keywords + group」里；≤720px 收成放大镜图标。页内另有命令面板时用 `enabled` 让出快捷键。
- **刚打开的页面也要 Ctrl / ⌘ K**：给顶栏面板 `globalShortcut`（或 `AdminShell globalShortcut`，壳里的面板跟着用）——快捷键挂在 window 上，焦点还在 `<body>` 时也认；在输入框 / 可编辑区域里只认带 Ctrl / ⌘ 的组合（单键命令如 `g`、`/` 不抢打字），弹框里的按键留给弹框。一个页面只给一个面板开；页内面板（不开 global）焦点在页内时先拿到按键。宿主不要再自己挂 window / document 的 Ctrl+K 监听。
- 侧栏 `brand` 槽里的按钮、输入框自动换成深色侧栏配色；宿主自己写的侧栏样式用 `currentColor` 或 `--aui-text` / `--aui-secondary`。

### 2.2 页面与分区

**先选模板**：页面的整体布局从 [PAGE-TEMPLATES.md](PAGE-TEMPLATES.md) 的 T01–T17 里选一个，用对应的块和布局组件（`StatStrip`、`TodoInbox`、`SplitLayout`、`SideNavLayout`、`ListDetailLayout`、`WorkspaceLayout`、`WizardLayout`、`GraphLayout`、`LogTimeline`、`WorkItemCard` …）拼，starter 菜单「页面模板」里每个模板一页可直接照抄。

页面 = `PageHeader` + `PageBody`（规则见 [DESIGN.md](DESIGN.md) §3.1）。列表页写 `<PageBody fill>`：页面至少一屏高，最后一块列表卡片伸到底，表格区占满、分页贴底，空表时「暂无数据」在表头与分页之间居中，不再在卡片下面留一大片空白（细则见 DESIGN.md §3.1）。一个菜单项合并几个页面用 `TabbedPage`：

```tsx
<TabbedPage
  title="系统设置" description="……" actions={<Button>查看生成结果</Button>}
  sections={[{ id: 'modules', label: '模块开关' }, { id: 'security', label: '安全策略' }, { id: 'audit', label: '审计', disabled: true }]}
  value={section} onValueChange={setSection}
  active={activeTab === 'settings'}             // 页面本身是否可见（当前工作标签），默认 true
  render={(id, active) => id === 'modules' ? <ModulesPage active={active} /> : <SecurityPage active={active} />} />
```

- `keepMounted`（默认 true）：打开过的分区切走不卸载；`render` 的 `active` 只有「当前分区且页面可见」才是 true，非 active 的分区暂停轮询。
- 每个分区包 `PanelErrorBoundary`（也可单独用：`children, onReset?, onError?`）：一块出错只坏这一块（中文提示 +「重试」）。
- 分区里的页面照写 `PageHeader`，自动收成「说明 + 操作」一行。

### 2.3 小控件

- `SegmentedControl`（`value, onValueChange, options: { value, label, icon?, disabled? }[], label, size?: 'sm' | 'md'`）：2–6 个短选项单选；方向键只移焦点，Enter / 空格才选。
- `ChipGroup`（`value: string[], onValueChange, options: { value, label, count?, disabled? }[], label`）：多选筛选标签，结果按选项顺序。
- `DatePicker` / `DateTimePicker` / `TimeInput`（`value, onChange, min?, max?, clearable?, weekStart?, isDisabledDate?, holidays?, size?: 'sm' | 'md' | 'touch'`，`id` / `aria-*` 落在输入框上）、`DateRangePicker`（`value: { from, to }, presets?`，用 `dateRangePresets([...])` 生成）、`CalendarButton`（「+ 添加」点开日历挑一天）：替换原生 date / datetime-local / time 输入框，值格式不变；能直接打字，日历走 PopoverLayer（弹框里可用）。细则见 AI-RULES 附录 P。
- `QuickDatePresets`（`onPick, days?（默认 1/7/30）, permanent?, type?: 'date' | 'datetime-local'`）：日期 / 到期输入框下的「1 天 / 7 天 / 30 天 / 永久」，给本地时间的输入框值，永久给空串。
- `CopyableValue variant="inline"`（`label?` 给按钮读名）：表格格子里的编号 / IP / Key 前缀，一行高、单行省略、小复制图标。默认样式留给详情页和弹框。
- `Tabs`（`value, onValueChange, items, label`，可选 `children` / `panelId` / `actions`）：页内分区，下划线式，与工作标签明显不同。
- `Switch` 表达「启用 / 停用」，`Checkbox` 只表达选中；两者自带定位壳层，宽表里不会把整页顶宽，宿主不要给控件加 `position:relative`。

## 3. 列表适配

`DataTable` 是受控展示，不请求接口、不切页、不算总数（属性见 [TABLES.md](TABLES.md) §2）。`useDataSource` 负责取消旧查询、丢弃过期响应、加载 / 失败状态。

```tsx
import type { ListAdapter } from '@adminui/react';
type UserRow = { id: string; nickname: string };
// 放模块级或 useMemo 内，保持函数身份稳定。
export const listUsers: ListAdapter<UserRow> = async (query, { signal }) => {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), q: query.search });
  if (query.sort) { params.set('sort', query.sort.key); params.set('direction', query.sort.direction); }
  for (const [key, value] of Object.entries(query.filters)) params.set(key, value);
  const response = await fetch(`/api/admin/users?${params}`, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error('用户列表加载失败');
  return response.json();   // 宿主在此校验响应并映射成 { rows, total }
};

const users = useDataSource(listUsers, query);
<ResourcePanel title="用户" count={users.data?.total}
  actions={<Button variant="outline" disabled={users.refreshing} onClick={users.refresh}>刷新</Button>}
  feedback={users.staleError && <InlineAlert tone="error" title="刷新失败，当前数据可能已过期">{users.staleError}</InlineAlert>}>
  <DataTable rows={users.data?.rows ?? []} loading={users.loading} error={users.error} onRetry={users.reload}
    pagination={{ mode: 'page', total: users.data?.total ?? 0, page: query.page, pageSize: query.pageSize, onPageChange, onPageSizeChange }} … />
</ResourcePanel>
```

- `ListQuery<F>`：`page` 从 1 开始、`pageSize`、`search`、`filters`（泛型）、`sort?` / `sorts?`。`ListResult<T>`：`{ rows, total, updatedAt? }`。服务端对页大小和排序键做白名单。
- 搜索、筛选、排序、页大小变化回第 1 页；删除最后一行后宿主修正 page。
- `reload()`：进入 loading、清掉旧行。`refresh()`（= `reload({ silent: true })`）：保留当前行，失败且有数据时给 `staleError`（配 `InlineAlert`），没数据才落到 `error`。定时刷新、保存后刷新都用 `refresh()`。
- `QueryBar` 的 children 放任意筛选控件：窄屏换行（下限 140px），「查询 / 重置」同行；非 SDK 控件加 `data-aui-query-field` 享受同一下限。

### 3.1 两种分页

| 接口形态 | 用 | 页脚 |
|---|---|---|
| 服务端能给真实总数 | `mode: 'page'` + `useDataSource` | 总条数 + 页码 + 上 / 下页 |
| keyset / 游标接口，没有总数 | `mode: 'cursor'` + `useCursorDataSource` | 上一页 / 下一页 + 每页条数 |
| 十几行一次拿全 | `mode: 'all'` | 「共 N 条」 |

游标模式的 `total` / `page` 在类型上是 `never`，编不过就不会出现猜出来的分母。

```tsx
import { DataTable, useCursorDataSource, type CursorListAdapter } from '@adminui/react';
export const listLedger: CursorListAdapter<LedgerRow> = async (query, { signal }) => {
  const params = new URLSearchParams({ limit: String(query.limit), q: query.search });
  if (query.cursor) params.set('cursor', query.cursor);
  const response = await fetch(`/api/admin/ledger?${params}`, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error('账本加载失败');
  return response.json();   // { rows, nextCursor, hasMore }
};

const ledger = useCursorDataSource(listLedger, { limit, search, filters: {} });
<DataTable rows={ledger.data?.rows ?? []} columns={ledgerColumns} rowKey={(r) => r.id} caption="资金账本"
  loading={ledger.loading} error={ledger.error} onRetry={ledger.reload}
  pagination={{ mode: 'cursor', pageIndex: ledger.pageIndex, pageSize: limit, onPageSizeChange: setLimit,
    canPrev: ledger.canPrev, canNext: ledger.canNext, onPrev: ledger.prev, onNext: ledger.next }} />
```

游标由 hook 维护成栈（「上一页」可用，query 一变自动回第一页）。返回 `{ data, loading, error, refreshing, staleError, pageIndex, canPrev, canNext, next, prev, reset, reload, refresh }`。`hasMore: true` 却没有 `nextCursor` 按响应格式错误处理。

## 4. 表单与弹框

```tsx
import { FormDialog, FormField, Input } from '@adminui/react';
export function RenameDialog(props: { open: boolean; value: string; original: string; setValue(v: string): void; close(): void; save(v: string): Promise<void> }) {
  return <FormDialog open={props.open} title="修改昵称" description="保存后更新用户资料。"
    dirty={props.value !== props.original} onClose={props.close}
    onSubmit={async () => { if (!props.value.trim()) throw Error('请填写昵称'); await props.save(props.value.trim()); }}>
    <FormField label="昵称" htmlFor="nickname" required>
      <Input id="nickname" value={props.value} onChange={(e) => props.setValue(e.target.value)} />
    </FormField>
  </FormDialog>;
}
```

- `FormDialog`：`onSubmit` resolve 自动关闭；校验或保存失败 throw / reject，错误显示且保留内容。提交锁同步置位，连点不重复调用；提交中不能关。`busy` / `error` 叠加外部状态，`destructive` 危险样式，`submitLabel` 默认「保存」。
- `FormField`：label / hint / error；单个子控件自动接 `aria-describedby`、`aria-invalid`；`Choice` 放进去由可见 label 命名。分组用 `FormSection`。
- `Dialog`（`open, title, description?, onClose, footer?, size?: 'sm' | 'md' | 'lg' | 'record'`）：生成结果、体检报告、选图、只读明细这类没有「保存」的弹层。
- 关闭后焦点回到打开它的按钮；按钮已被卸载时退回仍存在的那层容器。

### 4.1 确认、改动清单、一次性密钥

```tsx
<ConfirmDialog open={open} title="停用账号" destructive confirmLabel="停用"
  impact={`将停用 ${user.name}（${user.id}），对方会立刻被登出。`}
  reason={{ label: '原因', required: true, placeholder: '写进审计日志' }}
  onClose={() => setOpen(false)}
  onConfirm={async (reason) => { await api.disable(user.id, reason); }}>
  <ChangeList items={changedFields(saved, draft, fields)} />
</ConfirmDialog>
```

- `ConfirmDialog`：`open, title, description?, impact?, children?, destructive?, confirmLabel?, reason?: { label, required?, placeholder? }, typeToConfirm?, onConfirm(reason), onClose, size?`。`confirmLabel` 写动作动词（「删除」「停用」「转交 23 位」）；不传时按钮是「确定」（只是兜底，宿主一律传动词）。执行中锁定；reject 时弹框不关、原因不丢；resolve 才关。
- 改配置：**草稿 → `changedFields(saved, draft, fields)` → `ChangeList`（字段 · 原值 → 新值 · 生效方式）放进 `ConfirmDialog` → 原因 → 保存**。`fields: { key, label, unit?, effect?, format? }[]`；没有改动时显示「没有改动」，宿主同时禁用保存。
- `OneTimeSecretDialog`（`open, title, secret, description?, usage?, onClose`）：复制成功或勾「我已保存」之前关不掉；明文只在这个组件的 props 里。

### 4.2 选人：组织选人

分享 / 授权 / 指派 / 转交 / 审批人一律用组织选人；宿主只写一个数据适配器 `OrgDataSource`，服务端按「看的人」的可授权范围过滤。

```tsx
import { OrgPicker, OrgPickerField, type OrgDataSource, type PickedSubject } from '@adminui/react/org-picker';

// 一个项目一个适配器：平台通讯录 / quanxian / 员工表都行。路径 path 不含集团根；ancestors = 根 → 父节点 id（半选、含下级用）。
export const orgSource: OrgDataSource = {
  roots: () => api.get('/org/roots'),                                   // 集团或公司：OrgUnit[]（id, kind, label, parentId, memberCount, childCount）
  loadChildren: (id) => api.get(`/org/units/${id}/children`),           // 展开时才调
  loadMembers: (id, { deep, cursor, signal }) => api.get(`/org/units/${id}/members`, { deep, cursor, signal }), // { items, nextCursor, total, hiddenDeparted }
  search: (q, { kinds, limit, signal }) => api.get('/org/search', { q, kinds, limit, signal }),               // 服务端：拼音首字母、职务、公司名；回 path + ancestors
  resolve: (refs) => api.post('/org/resolve', refs),                    // 回显：label、path、status: 'left'（已离职）
  pathOf: (id) => api.get(`/org/units/${id}/path`),                     // 根 → 节点，定位用
};

<OrgPicker open={open} onClose={close} title="分享给同事" source={orgSource}
  value={value} onChange={(next, picks) => { setValue(next); save(picks); }}  // picks = { kind, id, label, path, includeSub }[]
  defaultFocus={me.primaryDeptId}                                           // 只定位不勾
  availability={(ref) => scope.of(ref)}                                     // ok / locked + reason / partial / hidden
  extraSources={[rolesTab, linesTab]} shortcuts={myShortcuts}
  existing={{ 'person:u7': '已授权 · 可读写' }} />

<OrgPickerField source={orgSource} value={value} onChange={setValue} commit="instant" suggestions={[myDept, ...recent]} />
```

- `OrgPicker`：`open, onClose, title, description?, source, value, onChange(next, picks), mode?: 'single' | 'multiple', selectable?, max?, includeSubDefault?（默认 true）, defaultFocus?, shortcuts?, extraSources?, availability?, existing?, lockedHint?, emptyAction?, confirmLabel?, locale?: 'zh-CN' | 'zh-TW' | 'en', messages?`。草稿只在「确定」时交出；`value` 里 `status: 'left'` 的人留在右栏划掉，只能手动去掉。手机自动换整屏下钻。
- `OrgPickerField`：同上的选项 + `placeholder?, commit?: 'instant' | 'batch', suggestions?, chips?（默认 true）, dialogTitle?, dialogDescription?, disabled?, label?, id?, autoFocus?, defaultQuery?`（后两个给懒加载的宿主：占位框里已经点了 / 打了字，真框挂上时接着用）。
- `defaultFocus` 可以晚到：宿主的「我的部门」接口比弹框慢时，先打开、值到了再定位（换了值会重新定位）；`lockedHint` 只接在没有原因的锁定提示后面——`availability` 给了原因（通常已经写了找谁开）就原样显示。
- **GrantList / ShareDialog**：`<GrantList mode="picked" orgSource={orgSource} orgPicker={{ availability, defaultFocus, extraSources, suggestions }} …/>`、`<ShareDialog people={{ …, orgSource, orgPicker }} />`——添加框换成 `OrgPickerField`（懒加载，JS 和 `org-picker` 样式块按需进来），已授权的灰着写「已授权 · 档位」，选中的按 `entryFromPick` 变成 `GrantEntry`（`kind`、`hint` = 路径、`path`、`includeSub`）；`GrantEntry.status: 'left'` 的行标「已离职」。
- 体积：`@adminui/react/org-picker` 45.7 KB JS / 27.3 KB CSS（gzip，含核心；样式块单独一份），核心入口不变；只有渲染了带 `orgSource` 的 GrantList / ShareDialog 或直接引子路径的页面才下载它。
- 旧的 `OrgTreePicker` / `UserTransfer`（`/access`）已弃用，下个大版本删除：只选部门 → `OrgPickerField selectable={['dept']}`，三列选人 → `OrgPicker selectable={['person']}`。

## 5. 上传

```tsx
import type { UploadAdapter } from '@adminui/react';
export const upload: UploadAdapter = async (file, { signal, onProgress }) => {
  const form = new FormData(); form.append('file', file);
  const response = await fetch('/api/admin/assets', { method: 'POST', body: form, signal, credentials: 'same-origin' });
  if (!response.ok) throw Error('上传失败');
  const asset = await response.json();   // 宿主校验并映射为 { id, name, url }
  onProgress(100); return asset;
};
// <UploadField upload={upload} onUploaded={…} accept={['image/png', 'image/jpeg']} maxBytes={5 * 1024 * 1024} />
```

需要实时百分比时用 XHR / 项目上传 SDK 实现同一 adapter；取消必须尊重 signal。前端类型 / 大小检查只是体验，服务端独立检查内容和权限。

## 6. 报表、导出与看板

```tsx
import { Button, ReportToolbar, buildCsv, downloadCsv, type ReportFilter, type ReportPreset } from '@adminui/react';

<ReportToolbar value={filter} sources={sources} presets={presets}
  onApply={setFilter} onReset={() => setFilter(initialFilter)} freshness={updatedAt} />
<Button onClick={() => downloadCsv('运营明细', buildCsv(rows, [
  { title: '日期', value: (row) => row.day },
  { title: '投入（弹药）', value: (row) => row.costDecimal, type: 'number' },
]))}>导出 CSV</Button>
```

- `ReportToolbar` 的 `value` 是 `{ start, end, source }`（`YYYY-MM-DD`，含首尾）；`validateReportRange(value, maxDays?)` 做同样的日历校验。`freshness` 显示宿主真实更新时间。
- CSV 带 UTF-8 BOM；文字前缀 `= + - @` 转义防公式注入，数值列只接受十进制。大量行、敏感报表走服务端授权导出。
- 看板组件（`KpiGrid` / `KpiCard`、`DashboardSection`、`LiveStatus` + `useLiveResource`、`computeDelta`、`formatNumber`、容差带函数）和设计流程见 [DASHBOARDS.md](DASHBOARDS.md)；完整示例 starter「团队今日示例」「看板部件」两页。


## 7. 图表与 Markdown

- `AdminChart`（`@adminui/react/charts`）：传 ECharts option、`label`、`visible`（当前工作页是否可见）；`height` 默认 300；`loading / error / empty / onRetry`；`live`（实时面板，关更新动画）；`table`（「查看数据」替代视图）。实例只建一次，option 变化用 `replaceMerge: ['series']` 增量合并，只有明暗切换才重建。
- 配色从 adminUI token 取：类别用 `vizCategory(i)`（选项标签色），单系列 / 有序用 `VIZ_BRAND` / `vizBrandStep(i)`（当前色卡主色深浅），`AdminChart` 用 `resolveVizTokens(option, chartColors(palette))` 换成真实颜色；宿主不写死 itemStyle 颜色。builder：`timeSeriesOption`（缺数断线、进行中虚线、事件标注、时间轴 `HH:mm` / 跨天 `MM-dd`）、`toleranceBandOption`、`funnelPlotOption`、`cohortHeatmapOption`；自写 formatter 拼 HTML 用 `escapeHtml`，自写时间轴用 `timeAxisLabel`。
- `MarkdownEditor`（`@adminui/react/markdown`）：`value / onChange`，GFM 实时预览，`maxBytes` 默认 1 MiB；不执行原始 HTML，不自动存草稿。

## 8. 轻量单服务：Go / Rust + SQLite

小工具后台同样用本包：React 前端构建成静态资源，由原 Go / Rust 进程托管或嵌入二进制；Node 只用于开发和构建，生产不需要 Node，也不为 UI 增加 Redis / PostgreSQL / Fastify。

可运行的双后端案例：[examples/single-service/README.md](examples/single-service/README.md)（共用前端、Go / Rust 两套 SQLite 服务、构建步骤、给 AI 的 AGENTS.md）。仓根 `npm run prepare:single-service -w @adminui/react` 准备前端。

```text
tool/
  web/                 # 从 examples/starter 起步，替换演示 adapter
    dist/              # npm run build 生成
  data/tool.sqlite     # 可写持久目录，不打进二进制、不开放静态访问
/admin/                # 后台静态入口
/admin/assets/*        # 构建资源
/api/admin/*           # 同进程 REST JSON 接口
```

1. 部署在 `/admin/` 时 `vite.config.ts` 的 `base` 改为 `'/admin/'`；开发时 `server.proxy` 配 `'/api': 'http://127.0.0.1:8080'`。页面始终请求同源 `/api/admin/...`。
2. 先 `npm run build` 前端，再构建后端；流水线每次重新生成前端。
3. **Go**：`//go:embed all:web/dist` + `fs.Sub` + `http.StripPrefix` + `http.FileServer`。**Rust**：Axum / Actix 提供 API，`rust-embed` / `include_dir` 嵌入 `web/dist` 并返回正确 MIME。
4. 静态映射只允许 `web/dist`；`/admin` 重定向到 `/admin/`；SPA fallback 只对页面导航生效，缺失的 JS / CSS 和未知 API 返回 404。index.html 用重新验证缓存，带哈希的 assets 长缓存。
5. adapter 检查 HTTP 状态、校验 JSON 再映射；401 交给登录流程，403 显示无权限。服务端校验页大小、筛选和排序白名单；SQLite 用绑定参数，`total` 与 rows 同一筛选口径；配置迁移、busy timeout、短写事务，需要时开 WAL，备份用 SQLite 备份能力。
6. 登录、权限、会话、CSRF、业务校验由 Go / Rust 服务执行。

**手机必验**：360px、390px 和 1440px 桌面——菜单可开关、筛选换行、详情堆叠、宽表只在表内横滚、弹框可滚动且关闭 / 保存可触达、不靠 hover；真机检查软键盘。发布还要验：只启动 Go / Rust 服务就能访问后台与 API、重启后数据仍在、深链可用、不存在的资源 404。

## 9. 与既有项目样式共存

本包 CSS 只匹配 `.adminui` 内部和 `.aui-*` 类，不依赖 Tailwind 扫描 node_modules。宿主可继续用 Tailwind 写业务区域，颜色用 `var(--aui-*)`。不要覆盖 `.aui-*` 的内部结构；业务 class 用项目自己的前缀。旧项目全局 `button` 等高优先级样式要限定作用域。

## 10. 验证与发版

- 包开发：仓根 `npm install` → 本包 `npm run check`（类型 + 单测）→ 浏览器 `npm run test:browser` 及受影响的专项（见 [AGENTS.md](AGENTS.md)；页面模板相关跑 `npm run test:page-templates`，截图和 `design/templates/tNN-*.png` 对照）→ `npm run test:packed`。浏览器脚本找 `CHROMIUM_PATH` 或 Playwright Chromium，缺浏览器先 `npx playwright install chromium`。
- 宿主：verify 门禁里跑 `admin-ui-audit <src目录> --baseline <基线文件>`（包里的 bin，零依赖；第一次接入先加 `--write-baseline` 登记历史问题，之后只许减少；规则和忽略注释见 `npx admin-ui-audit --help`）；类型 / 构建、桌面手机截图、换色卡、深色、查询排序分页、请求失败 / 乱序、表单失败保留内容 / 连点防重 / 退出确认、上传失败 / 取消。
- 发 tag `adminUI-vX.Y.Z`；改动写进 [CHANGELOG.md](CHANGELOG.md)。

## 11. 升级到 8.0

- **升不升由项目自己定**：已有项目可以继续钉着原来的 tag，照常能用，不强制升级；**新项目一律用最新版**（当前 `adminUI-v8.3.0`）；大型宿主项目跟最新。
- 这一版不留兼容层：被新组件取代的旧 API、旧 prop、旧类名和旧 CSS 变量都已去掉。旧 → 新对照表见 [MIGRATION-8.md](MIGRATION-8.md)。
- 升级前先在项目里跑审计，按输出逐条改：

  ```bash
  npx admin-ui-audit src            # 或 npx @adminui/react audit src
  ```

  规则 `removed-api` / `removed-prop` / `removed-class` / `removed-css-var` / `legacy-tone` / `deep-import`，每条打印 `文件:行` 和该换成什么。改完再跑类型检查、构建和截图对照。
- 库里存的旧数据不用迁移：选项色旧名用 `legacyTone` / `optionTone` 读（DESIGN.md §1.7）；存量看板先过 `migrateDashboardSpec`（DASHBOARDS.md §14）。

