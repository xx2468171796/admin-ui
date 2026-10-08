# 列表、数据表格与记录详情

本手册三部分：先选列表形式（§1），再写数据表格 `DataTable`（§2），点开一行看详情走记录详情三档（§3）。整体界面见 [DESIGN.md](DESIGN.md)；像电子表格一样录数据的多维表格见 [GRID.md](GRID.md)。

## 1. 先选列表形式

后台管理的主列表默认是 **`DataTable`**：操作按钮直接露在每行、格子里放自己的状态徽标和组合内容、每行一样高、分页、点行看详情。多维表格 `BitableGrid` 只给**在格子里录数据、改数据、粘贴一批、自己分组统计**的页面。

| 数据长什么样 | 用 | 组件 |
|---|---|---|
| 后台管理的主列表：同类记录多、会增长，用户要找、筛、排序，并对每行做操作（编辑、删除、连接、复制、分享…） | 数据表格（默认） | `DataTable` + `QueryBar` + 操作列（`RowActionBar`：放得下就露，放不下才进 ⋯）+ 固定行高 + 分页 + `expandRecord` |
| 量很大（上万）、要搜要筛的日志（审计、会话、流水） | 数据表格 + 服务端分页 | `DataTable` + `useDataSource` / `useCursorDataSource`（页码或游标，服务端筛选） |
| 主要工作是在格子里录入 / 修改 / 粘贴数据、自己分组统计（像飞书多维表格 / Excel） | 多维表格 | `BitableGrid`（可选子路径 `@adminui/react/grid`，见 [GRID.md](GRID.md)） |
| 少量固定行（约 20 行以内）一眼看完：排行、统计、图表旁明细、几条配置、弹框 / 卡片 / 标签页里的小表 | 紧凑表格 | `CompactTable` |
| 按时间发生的事：某个对象的历史 / 体检 / 心跳 / 操作日志 / 版本 / 通知 / 最近动态 | 时间线 | `ActivityFeed` |
| 几项有名字的检查，每项一个状态 + 原因：自检、依赖、工具链、运行器、步骤进度 | 状态清单 | `StatusChecklist` |
| 一个对象的属性（标签 → 值） | 键值列表 | `DescriptionList` / 记录详情 |
| 5 条以内、内容丰富、彼此不比较 | 卡片 | `SectionCard` / `MetricCard` |

拿不准时问三个问题：
1. 用户会不会在里面找东西、对每行做操作？会 → `DataTable`（主要工作是改格子才用 `BitableGrid`）。
2. 是不是「按时间发生的事」？是 → `ActivityFeed`（要搜要筛的大日志仍是 `DataTable` + 服务端分页）。
3. 是不是「几项检查各有一个状态」？是 → `StatusChecklist`；否则 → `CompactTable`。

纯函数版本：`suggestCollection()` 返回 `"table" | "grid" | "compact" | "feed" | "checklist" | "description"`。

**别这样**
- 3 行的表配搜索框、筛选、分组、行号、统计栏：控件比数据还多。
- 某台机器最近 50 次体检放进可排序的表格：时间顺序被打乱。
- 后台管理列表用多维表格：操作被收进「更多」菜单看不见。
- 弹框里塞完整的表格：要筛要比就给「去完整列表」。
- 一个对象的属性做成两列表格：用键值列表。
- 状态只靠颜色：永远是图标 + 文字。

### 1.1 三个轻量组件（根入口，不依赖 TanStack）

**CompactTable**
```tsx
<CompactTable caption="工具排行" rows={rows} getRowId={(r) => r.id}
  fields={fields}                          // 和 BitableGrid 同一套 GridField
  columns={["name", "calls", "failRate"]}  // 显示成列的字段；其余在点开的详情里
  sort={{ key: "calls", direction: "desc" }}  // 固定顺序，没有排序按钮
  maxRows={10} viewAll={{ label: "去完整列表", onClick: openFullPage }}
  rowActions={(r) => [...]}                // 1 个操作直接是按钮，多的进 ⋯
  expandRecord={{ layout }}
  loading={…} error={…} onRetry={…} emptyLabel="还没有…" />
```
表头一行、行高固定（默认 32px，`rowHeight="medium"` 两行），数字右对齐，放不下省略号；没有工具栏、行号、统计栏。弹框 / 卡片里用 `maxHeight` 内部滚动。

**ActivityFeed**
```tsx
<ActivityFeed caption="最近动态" items={events} getId={(e) => e.id} time={(e) => e.at}
  title={(e) => e.what} actor={(e) => e.who} description={(e) => e.detail}
  tone={(e) => (e.ok ? "success" : "danger")} meta={(e) => e.size}
  marker={(e) => (e.byPerson ? { kind: "person", name: e.who, key: e.whoId } : null)}
  layout={eventLayout} canOpen={(e) => e.hasDetail} maxItems={20} />
```
最新在上、按天分组（日期标题吸顶「今天 10月7日 周三」）；相对时间，悬停看精确时间；轨道标记：`marker` 指定，不给时按 tone——success / danger / warning 是带 ✓ / ✕ / ! 的结果圆，其余是系统小圆点；描述最多两行，`meta` 是跟在后面的普通文字（不是状态胶囊）；`attachments` 放附件小卡；`canOpen` 决定哪些条目可点；底部「显示更早的 N 条」每次多 `maxItems` 条。

**统一时间线 Timeline**：`ActivityFeed`、`LogTimeline`、记录详情里的跟进记录是同一个解剖——左 20px 轨道，1px 线穿过中心；人做的事 = 20px 头像（按人分色，浅底 + 首字），系统的事 = 8px 圆点，结果 = 带 ✓ / ✕ / ! 的 20px 圆，标记的圆心压在线的中线上；标题行「谁 + 做了什么 + 对象」，时间在右（正文数字字体，悬停看完整时间）；正文 13.5px；附件 / 录音是描边小卡；手机上时间折到标题下面。宿主自己拼跟进列表（CRM 跟进块）用积木，不自己画圆点和竖线：
```tsx
const today = dayHeading("2026-10-07");               // { label: "今天", date: "10月7日 周三" }
<Timeline label="跟进记录">
  <TimelineDay label={today.label} date={today.date}>
    <TimelineItem marker="person" avatar="小王" avatarKey={userId} title={<><b>小王</b> LINE 跟进</>}
      time="10:42" timeTitle="2026-10-07 10:42:10"
      attachments={<TimelineAttachment icon={<FileText />} onClick={open}>报价-v2.pdf · 1.2 MB</TimelineAttachment>}>
      客户说太太想先看样品…
    </TimelineItem>
    <TimelineItem marker="result" result="danger" title={<><b>同步失败</b> LINE 档案</>} time="10:30" />
    <TimelineItem marker="system" title="提醒：下次跟进是今天" time="09:00" />
  </TimelineDay>
</Timeline>
<TimelineMore count={9} onClick={loadOlder} />   {/* 「显示更早的 9 条」 */}
```
`TimelineItem`：`marker`（person / system，默认 / result）、`avatar` + `avatarKey`、`dot`（system 圆点色：neutral / brand / info / warning）、`result`（success / danger / warning）、`title`、`time`、`timeTitle`、`dateTime`、`children`（正文）、`attachments`、`muted`（系统事件默认灰字）、`onOpen`（标题行变成按钮）。首次加载用 `TimelineSkeleton`；空状态用 `StatePanel kind="empty"` 居中在卡片里。`LogTimeline` 审计密排是这套的一行版：一行 44px「时间 · 头像 + 人 · 摘要 · 对象小块 · 展开」，展开 = 下方白底键值列表（`readableDetail` 把技术 key 收进「原始数据（JSON）」），`loading` 骨架行、`emptyLabel` + `emptyHint` 居中空状态。

**StatusChecklist**
```tsx
<StatusChecklist caption="连接自检" items={checks} getId={(c) => c.id} label={(c) => c.name}
  status={(c) => c.state /* ok | warning | error | pending | off | unknown */}
  reason={(c) => c.detail} meta={(c) => c.version}
  action={(c) => (c.state === "error" ? { label: "去修复", onSelect: () => fix(c) } : null)} />
```
顶部汇总「1 项异常 · 2 项正常」（全部正常时「全部正常（N 项）」）；每项图标 + 文字状态 + 原因 + 最多一个操作。

## 2. 数据表格 DataTable

`DataTable` 是受控展示：不自己请求接口、不切片分页、不算总数。数据由 `useDataSource` / `useCursorDataSource` 提供（写法见 [INTEGRATION.md](INTEGRATION.md) §3）。可运行示例：starter「系统 → 客户与订单」（`examples/starter/src/BusinessTables.tsx`）。

### 2.1 必填与常用属性

- 必填：`rows`、`columns`、`rowKey`、`caption`、`pagination`。
- `pagination`：`{ mode: 'page', total, page, pageSize, onPageChange, onPageSizeChange, pageSizes? }`（有真实总数）、`{ mode: 'cursor', pageIndex, pageSize, canPrev, canNext, onPrev, onNext, onPageSizeChange }`（游标，没有总数和页码）、`{ mode: 'all' }`（十几行一次拿全的短表，页脚只写「共 N 条」）。
- 状态：`loading`（这张表自己的表头 + 和列宽一致的骨架行）、`error` + `errorDetails`（请求号，进「错误详情」可复制）+ `onRetry`、`emptyKind`（`empty` / `no-results`）、`emptyLabel`、`emptyAction`。
- 排序：单列 `sort` / `onSortChange`；多列 `sorts` / `onSortsChange`（数组顺序是优先级，传给服务端）；两种只用一种。
- 选择：`selected` / `onSelectionChange`、`isRowSelectable(row)`（返回 false 的行不能新选，表头全选只含当前页可选的；部分勾选时表头半选「−」）。
- 批量：`bulkActions`（+ `bulkNote`「本页 24 条」）——勾选后表格底部居中浮出 `BulkActionBar`「已选 N 条 · 动作 · ✕」，不推动表格；选中行的操作列照常可点，工具栏不会被替换。
- 手机：`mobile`（默认 `"cards"`：≤ 760px 每行一张卡片；`"table"` 保留横滑表格）；列上 `mobile: "primary" | "status" | "meta" | "hidden"` 决定卡片上放哪（§2.3）。
- 其他：`rowHeight`、`expandRecord`、`expandable`、`grouping`、`zebra`、`maxHeight`（固定表头）、`toolbar`、`preferences`（来自 `TablePreferencesMenu`）。
- 放进整屏工作区（`WorkspaceLayout` 的栏、`Pane fill` 里）时表格、`ResourcePanel`、`QueryBar` 自动贴边；筛选行要放在 Pane 头下面写 `QueryBar variant="flush"`，放进 Pane 头或 `ResourcePanel filters` 写 `variant="bare"`（AI-RULES 附录 R）。

| 属性 | 含义 |
|---|---|
| `rowHeight` | `short / medium / tall / extraTall` = 40 / 56 / 88 / 120px，容纳 1 / 2 / 3 / 5 行文字；不传按密度（compact 40、comfortable 48）；`"auto"` 让内容撑高行，只给十几行的小表 |
| `expandRecord` | 行首图标打开记录详情（§3）：`{ layout?, level?, url?, title?, description?, label?, fields?, render?, openKey?, onOpenChange? }` |
| `expandable` | 行内展开：`{ expanded, onExpandedChange, label, render, canExpand? }`，按需挂载，展开不改变勾选 |
| `grouping` | 整行宽的分组标题：`{ by, header, collapsed?, onCollapsedChange? }`（§2.5） |
| `maxHeight` | 数字像素：有界滚动 + 固定表头；不传则跟页面滚动 |

### 2.2 固定行高

行高是表格的设置，不由内容决定：同一张表每行一样高，格子放不下就截断（省略号 + 悬停全文），完整内容点开记录看。

| 档 | 行高 | 文字行数 | 适合 |
|---|---|---|---|
| 紧凑（`short` / 密度 compact） | 40 | 1 | 密集核对 |
| 宽松（默认，密度 comfortable） | 48 | 1 | 大部分列表 |
| 两行（`medium`） | 56 | 2 | 名称 + 编号 / 部门：`CellText` 的第二行只在这一档出现，40 / 48 里进悬停提示 |
| `tall` | 88 | 3 | 备注多 |
| `extraTall` | 120 | 5 | 以长文本为主的台账 |
| `"auto"` | 最小 = 密度行高 | 不限 | 十几行的小表 |

- 优先级：`preferences.rowHeight`（用户在「表格设置」里选的）> `rowHeight` > 表格偏好 density > Provider density。
- 让用户自己选：`<TablePreferencesMenu rowHeightControl … />` 多一项「行高」，存进 `TablePreferences.rowHeight`。
- 行数 = ⌊(行高 − 上下留白) ÷ 20⌋，留白 = (行高 − 32) ÷ 2，最多 8px（`rowLineBudget`）；字号变大时一起变。
- 格子内容最高 = 行高 − 4px；操作列（`kind: 'actions'`）永远一行，文字按钮常驻次要色、悬停行变主色。表头固定 40px（`mobile="table"` 的手机 44px）、12px / 600 次要色，和多维表格共用 `--aui-table-head-*`。
- 多维表格 `BitableGrid` 的行高档另算（`ROW_HEIGHT_PRESETS`，矮行 32），见 GRID.md。

### 2.3 列 `Column<T>`

| 属性 | 含义 |
|---|---|
| `key`, `title`, `render(row, { selected })` | 必填 |
| `width` / `minWidth` / `maxWidth` | 列宽；截断的列必须给 `width` 或 `maxWidth` |
| `truncate: row => 全文` | 单行省略 + 悬停全文（默认上限 320px）；不能只加省略号不给全文 |
| `wrap: true` | 在行的行数内换行，放不下省略号 |
| `detail: row => ReactNode` | 记录详情里这一列的完整显示 |
| `numeric: true` | 右对齐、等宽数字；金额单位由宿主写在标题里 |
| `sortable`, `align` | 排序、对齐 |
| `kind: 'actions'` | 操作列：选中行照常可点；放最后一列时表格溢出自动固定在右边；手机卡片上只露 ⋯ |
| `mobile` | 手机卡片上的位置：`primary`（标题）/ `status`（标题后的小标签）/ `meta`（灰字行）/ `hidden`（只在记录详情里）；不写按默认规则 |

**一格一件事、每行一样高**：名称、备注、地址用 `truncate` 或 `CellText`（主文字 + 一行灰色说明）；用途、全文备注、徽标清单、分给谁放 `expandable` 或记录详情；编号、金额、状态不截断。不要在格子里竖着堆好几行文字和徽标。

```tsx
const columns: Column<Order>[] = [
  { key: 'id', title: '订单', width: 150, render: (r) => <CopyableValue variant="inline" value={r.id} label="订单号" /> },
  { key: 'customer', title: '客户', maxWidth: 260, render: (r) => <CellText primary={r.customer} secondary={`${r.city} · ${r.owner}`} /> },
  { key: 'amount', title: '金额（元）', numeric: true, sortable: true, render: (r) => <MoneyDisplay value={r.amountFen} unit="" /> },
  { key: 'status', title: '状态', width: 96, render: (r) => <StatusBadge tone={r.paid ? 'success' : 'warning'}>{r.paid ? '已付款' : '待付款'}</StatusBadge> },
  { key: 'actions', title: '操作', kind: 'actions', render: (r) => (
    <RowActionBar label={`${r.id}的更多操作`} actions={[
      { key: 'edit', label: '编辑', icon: <Pencil />, onSelect: () => edit(r) },
      { key: 'export', label: '导出', icon: <Download />, onSelect: () => exportOne(r) },
      { key: 'void', label: '作废', destructive: true, disabled: !r.voidable, disabledReason: '已发货，不能作废', onSelect: () => confirmVoid(r) },
    ]} />
  ) },
];
```

### 2.4 字段格子 Cell*

在列的 `render` 里用，自动按本行行数截断；在记录详情、`expandable` 里自动完整显示。

| 组件 | 用途 | 表格里 |
|---|---|---|
| `CellText primary secondary` | 名称 + 一行灰色说明 | 各自截断；矮行只留主文字，说明进悬停 |
| `CellLongText text lines?` | 备注、描述、地址 | 按行数截断 + 悬停全文 |
| `CellTags items` | 多选、标签、关联记录 | 排不下显示 `+N`，悬停 / 点开看其余 |
| `CellPeople people` | 负责人、成员 | 同上，首字头像 |
| `CellLink href` | 网址 | 一行省略、新标签页打开；只认 http(s) / mailto |
| `CellDate value time? timeZone?` | 日期 / 时间 | `2026-09-30` / `2026-09-30 14:05`，悬停带秒和时区 |

`items: { label, tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand', key? }[]`。表格里的可复制值（编号、IP、Key 前缀）用 `CopyableValue variant="inline"`。

### 2.5 分组

整行宽、可折叠的分组标题行（每组一个 `<tbody>`，`th scope=rowgroup`），点列头只在组内排序。

- 默认不分组，筛选是主要手段；分组做成工具栏里「分组：不分组 / 按 A / 按 B」。
- 本地数据：先排序，再 `flattenGroups(groupRows(rows, by, compareGroupKeys))`，然后翻页——同组相邻。服务端分页：服务端按「组键, 排序列」排好。
- `header(key, rows)` 拿到本页这一组的行；整组汇总由宿主算好传入。
- 折叠受控：`collapsed` + `onCollapsedChange`。换分组方式时清空 `collapsed`。
- 禁止自己加一列「分组」只在每组第一行写组名。

```tsx
const arranged = groupBy === 'none' ? sorted : flattenGroups(groupRows(sorted, groupOf, compareGroupKeys));
<DataTable rows={arranged.slice(from, to)} grouping={groupBy === 'none' ? undefined : {
  by: groupOf, collapsed, onCollapsedChange: setCollapsed,
  header: (key) => <><strong>{key}</strong> <Count value={totals.get(key) ?? 0} /></>,
}} … />
```

### 2.6 行操作

- **操作列一律用 `RowActionBar`**：把这一行的全部操作按常用顺序给它，它按列宽**放得下几个就露几个、最多 3 个**（`max`，默认 3），其余进 ⋯；⋯ 旁边不许还有能放下一个按钮的空位（3 个已满除外）。**灰掉（disabled）的操作不占位**，在 ⋯ 里带原因。危险操作（`destructive`）默认在 ⋯ 里，`menuOnly: false` 才露出；`menuOnly: true` 强制进菜单。操作列宽度只按前 3 个可用按钮算，表格有富余时自动变宽，窄屏自动收。不要自己摆 `Button` + `RowActions`。操作列标 `kind: 'actions'`。
- `RowActions` 只剩「只有一个 ⋯」的场合（卡片角、记录详情头部的更多）。
- `actions: { key, label, onSelect, icon?, ariaLabel?, destructive?, menuOnly?, disabled?, disabledReason? }[]`；图标给齐（露出来时显示）；`label`（组件属性）写成「某某的更多操作」便于读屏区分行；按钮字短时用 `ariaLabel` 写全（「复制 xx 的完整信息」）。
- 菜单挂在 Provider 的 portal，不被滚动容器裁掉；↑↓ / Home / End 移动，Esc 和选择后焦点回到按钮；滚动时跟随按钮。
- 禁用项写 `disabledReason`：原因显示在菜单项下方，仍可聚焦读出。
- 危险操作选中后打开 `ConfirmDialog`，不要在菜单里直接执行。记录详情弹框里也能用 `RowActions`（菜单渲染在弹框内）。

### 2.7 批量、宽表、分页页脚

- 批量：`bulkActions`，底部浮条 `BulkActionBar`（DataTable 和多维表格共用一个）：白底圆角 12 + 浮层阴影，「已选 N 条」加粗、幽灵按钮带图标、竖线、✕「清除选择」；最多 4 个按钮（手机 2 个），其余进 ⋯；表格比屏幕高时贴视口底，手机贴屏幕底；焦点在浮条里时 Esc 清除选择、←/→ 在按钮间移动。危险操作写 `danger: true` 并在 `onSelect` 里先开 `ConfirmDialog`。自己的列表也能直接用：放在滚动内容之后、分页脚之前（父级 `position: relative`，不能是 `overflow: hidden` 的滚动容器——用 `overflow: clip`）：
  ```tsx
  <BulkActionBar count={selected.length} note="本页 24 条" onClear={() => setSelected([])}
    actions={[{ key: "transfer", label: "转交", icon: <ArrowLeftRight />, onSelect: openTransfer },
              { key: "delete", label: "删除", icon: <Trash2 />, danger: true, onSelect: confirmDelete }]} />
  ```
  确认、结果、失败重试见 [WORKFLOWS.md](WORKFLOWS.md)。`isRowSelectable` 只影响新选择；宿主改筛选 / 页码 / 权限或删除记录时清理选择和 `expanded`。跨页全选用服务端签发的查询快照，不能拿当前页 ID 冒充。
- 冻结：`preferences.pinned` 指定业务主键列，显示在数据列首位并避开展开 / 勾选列；末尾操作列溢出时固定在右边。≤760px 释放横向冻结，保留固定表头。
- 多排序：每列一个方向 + 优先级；只有最高优先级列用 `aria-sort`。
- 页脚：左「共 168 条」（有勾选时「已选 2 / 共 168 条」，加载中「共 — 条」），右每页条数 + 页码，当前页 = 主色浅底（不是实心绿块）；每页条数选项总包含当前 `pageSize`，只有 1 个选项时不显示选择框；游标模式左「已显示 1–20 条」、右只有 ‹ ›（传了 `pageSizes` 才有每页条数），不写「第 1 页」；≤420px 页码模式变成「‹ 3 / 9 ›」一行。
- 手机（≤ 760px）默认卡片列表：每行一张卡片——勾选 · 名字（加粗）+ 状态小标签 · ⋯ 一行，负责人 / 金额 / 下次跟进等灰字一行；顶上「本页全选」；没有横滑。卡片上放什么：标题 = 第一列（或 `mobile: "primary"`），状态 = key 为 status / stage / state 的列（或 `mobile: "status"`），灰字行 = 接下来 3 列（`mobile: "meta"` 的总显示，`mobile: "hidden"` 只在记录详情里），操作列只露 ⋯。
- 手机行高至少 44px，行内按钮 40px。

## 3. 记录详情：一份布局，三档展示

点开一行看详情统一走这套。`DataTable`、`CompactTable`、`ActivityFeed`、`BitableGrid` 的 `expandRecord` / `layout` 已经接好；其他入口（卡片、搜索结果、通知）用 `useRecordDetail` 或 `RecordDetailDialog` / `RecordPage`。详情只用居中弹框或整页，不自己拼详情弹框；**从看板 / 画册 / 日历 / 甘特这些视图打开**时默认是右侧抽屉（`RecordDetailDialog frame="drawer"`，同一个外框、同一份内容，VIEWS.md §9）。

| 档 | 什么时候用 | 长什么样 |
|---|---|---|
| ① 简要 `peek` | 字段少（≤ 8）、没有标签页；看一眼、做一个操作 | 居中小弹框 560px；标题 + 状态；关键字段一列；底部「查看完整详情」+ 1–2 个主操作 |
| ② 详情 `expanded` | 字段多、要分组、要看活动 / 关联；在列表里逐条翻看 | 居中大弹框 800–1280px（约屏宽 72%）；高度随内容，至少半屏、最多 88%（有标签页时固定 88%）；手机全屏 |
| ③ 整页 `page` | 要收藏 / 分享的完整档案、图表、关联表多 | 独立路由：返回链接、标题、状态、操作、指标卡、图表、标签页、关联表 |

默认：≤ 8 个字段且没有标签页 → 简要；否则 → 详情。整页只经「在新页面打开」或链接进入。

### 3.1 详情弹框的结构（字段行，不给 `cards` 时）

```
┌ 客户 / 全部 · 第 3 条，共 120 条 ▲ ▼                                       ┐
│ 图标 标题 [状态]                              [已关注] [复制链接] ⋯ ⤡ ↗ ✕ │
│ 副标题（负责人 · 编号）                                                   │
├ 详情 | 修改历史 ─────────────────────────────────────────── 一条底线 ─────┤
│ 客户资料                                       │ 概要                     │
│ 10 / 11 已填 · 未填写：客户质量                │ 编号          C-0001     │
│ 手机        139****0781 👁           ✎ ⧉ ⟲ ← 悬停才出 │ 负责人        小王       │
│ 备注        需求：展会上留的资料……             ├──────────────────────────┤
│ 客户质量    —（点一下直接填）                  │ 评论                      │
├────────────────────────────────────────────────┤                          │
│ 跟进记录（子表，平的，没有外框）               │                          │
└────────────────────────────────────────────────┴──────────────────────────┘
```

- 不给 `layout.cards` 就是字段行：字段一栏，左边灰色字段名（约 132px，可换行，可带图标），右边值（正常字重，不加粗不放大）；分区、子表、右栏都是平的区域，区域之间一条线，**没有卡片套卡片**，右栏和正文同一个白底、中间一条竖线。
- 字段的按钮（编辑、修改历史 / 自定义 `actions`、拨打、打开、复制）只在这一行悬停或有焦点时出现；留痕查看的眼睛留在值后面。只读字段悬停时出一把锁（`edit` 返回 null，原因写 `lockedReason`）。
- **就地编辑**：字段给 `edit: (row) => ({ render: (ctx) => <编辑器 …/> })`，点值（或悬停出来的「编辑」、焦点在值上按 Enter / F2）就把值那一格换成编辑器，占满整格宽、原值藏起来；保存成功调 `ctx.done()`，失败留在编辑器显示原因；Esc 只取消这一格、不关详情；结束后焦点回到值上。多维表格的字段直接用 `GridCellEditor variant="field"`（`@adminui/react/grid`）：单行 Enter 保存、长文本 Enter 换行 / Ctrl + Enter 保存、点别处保存，选项列表和日历挂在值下面。有自己界面的字段（勾选框切换、附件面板、关联选择器）给 `edit: (row) => ({ onActivate: (anchor) => … })`。可编辑的空字段留在原位（显示 —，点一下就填），「未填写：…」一行里的名字点了也直接进编辑。
- 分区的 `progress` 变成分区标题下的一行浅色字「10 / 11 已填 · 未填写：客户质量」，不是卡片头。
- 要阶段条、关键数、可挪的分区卡片，给 `layout.cards`（卡片分区 C，§3.7）。

#### 头部、关键信息条、标签页、右栏

- 头部 `RecordHeader`（只有一种：白底紧凑头部）：标题、状态徽标、副标题（编号 · 更新时间）、上一条 / 下一条、缩小、在新页面打开、关闭。
- 关键信息条 `FactStrip`：2–5 个一眼要看的事实（来自 `layout.highlights`），右侧主操作（`primary` 最多 2 个，其余进「更多」）；眼下要处理的那一件事（「已续费」）给 `tone: 'attention'`，琥珀浅底按钮，另算、不占 2 个主操作的名额。
- 标签页：第一个默认叫「详情」，`layout.overview: { label: '概览', icon }` 改名加图标；其余标签页都带图标，计数在后（`count`），表单式的标签页用 `sections` + `countUnfilled` 自动显示「6 未填」（红）。
- 右侧概要栏 `aside`（和正文同一个白底，中间一条竖线）：归属与分享（含介绍版本、提醒规则）、标签、最近动态（`ActivityFeed` 取最近 4 条 + 「查看全部 N 条操作记录 →」用 `render(row, { setTab })` 切到「操作记录」标签页）。

### 3.2 布局定义 `RecordLayout<T>`

```tsx
import type { RecordLayout } from '@adminui/react';

const machineLayout: Partial<RecordLayout<Machine>> = {
  subtitle: (m) => `${m.alias} · ${m.host}`,
  status: (m) => (m.online ? { label: '在线', tone: 'success' } : { label: '离线', tone: 'danger' }),
  highlights: (m) => [                     // 2–5 个：弹框顶部关键信息条，整页变指标卡
    { key: 'cpu', label: 'CPU', value: `${m.cpu}%`, tone: m.cpu > 90 ? 'danger' : undefined },
    { key: 'mem', label: '内存', value: `${m.mem}%` },
  ],
  sections: [
    { key: 'basic', title: '连接信息', fields: [
      { key: 'host', label: '地址', value: (m) => m.host, copy: true, peek: true },
      { key: 'os', label: '系统', value: (m) => m.os, peek: true },
      { key: 'password', label: '密码', value: (m) => (m.hasPassword ? '已保存' : null), showEmpty: true },
      { key: 'tags', label: '标签', value: (m) => <CellTags items={m.tags.map((t) => ({ label: t }))} />, text: (m) => m.tags.join(','), full: true },
    ] },
    { key: 'note', title: '说明', collapsible: true, columns: 1, fields: [{ key: 'note', label: '说明', value: (m) => m.note, full: true }] },
  ],
  aside: [{ key: 'meta', title: '概要', fields: [
    { key: 'owner', label: '负责人', value: (m) => m.owner },
    { key: 'updated', label: '更新时间', value: (m) => <DateTimeDisplay value={m.updatedAt} /> },
  ] }],
  tabs: [
    { key: 'activity', label: '活动', count: (m) => m.events, render: (m) => <ActivityFeed … /> },
    { key: 'metrics', label: '监控图表', pageOnly: true, render: (m) => <MachineCharts id={m.id} /> },
  ],
  actions: (m) => [
    { key: 'ssh', label: '打开终端', primary: true, onSelect: () => openTerminal(m) },
    { key: 'edit', label: '编辑', onSelect: () => edit(m) },
    { key: 'delete', label: '删除', destructive: true, onSelect: () => confirmRemove(m) },
  ],
  href: (m) => `/console/machines/${m.id}`,   // 有它才出现「在新页面打开」
};

<DataTable … expandRecord={{ layout: machineLayout, url: true }} />
```

- **字段**：`value` 显示、`text` 纯文本（复制、判空）、`copy` 复制按钮、`full` 占整行、`hint` 说明、`peek` 进简要档、`tone` 浅色底（attention 快到期 / danger 没填）、`action: (row) => ({ label, icon, onSelect })` 字段行上一个小图标按钮（悬停出现；下次续费上的「已续费」、空着的客户售价上的「+」直接打开表单；不关弹框，返回 null 不显示）。
- **空字段收起**：空值（null、空串、空数组、表格占位「—」）不一行一个「—」，而是在分区末尾收成一行灰字「未填写：备注、附件」；`showEmpty` 让空着本身有意义的字段留在原位显示「—」，`hideEmpty` 空了连「未填写」也不进。全空且没有 `render` 的分区不显示。和标题相同的字段不在正文重复。
- **标签在左**：字段默认标签在左、值在右，大弹框里标签列固定宽；分区 `fieldLayout: 'stacked'` 改成标签在上。
- **分区**：`title`、`description`、`fields`、`render`（自由内容，第二个参数 `{ level, setTab }` 可切标签页）、`columns`（默认 2；整页 3；窄屏 1）、`collapsible` / `collapsed`、`progress`（「3 / 4 已填」）、`actions`（分区头部 1–2 个按钮：「登录邮箱」「查看全部密钥」「编辑」）。
- **标签页**：`render` 自由内容（操作记录用 `LogTimeline`），或 `sections` 和「详情」一样画分区（右栏保留）；`countUnfilled` 计数 = 这些分区里没填的字段数；`hidden(row)` 对这条记录不显示；`sections` 全空的标签页自动不显示（不是订阅的记录就不会多出「价格」「客户」）。
- 表格不给 `layout` 时自动把所有列放进一个分区，只适合简单记录；字段多的记录（资产、机器、客户）自己排：`status` + 3–4 个 `highlights`，正文按用途分区，`aside` 放归属 / 标签 / 更新时间，常用操作 `primary`。
- **地址栏**：`url: true` 把打开的记录写进 `?record=<id>`（简要档另带 `recordView=peek`）；打开记一条历史，切记录只替换，按返回键关闭。`url: 'machine'` 换参数名。
- 操作执行后默认关闭弹框（打开整页 / 终端 / 确认框时不盖着）；要保持打开给 `keepOpen: true`。

### 3.3 整页

```tsx
import { RecordPage } from '@adminui/react';

export function MachinePage({ id }: { id: string }) {
  const { data, loading, error, reload } = useMachine(id);
  return <RecordPage layout={{ title: (m) => m.name, sections: [], ...machineLayout }} row={data}
    loading={loading} error={error} onRetry={reload} notFound={!loading && !data}
    back={{ label: '机器', href: '/console/machines' }}
    overview={(m) => <><KpiGrid>…</KpiGrid><AdminChart … /></>} />;
}
```

返回链接 → 标题 + 状态 + 操作 → `highlights` 变指标卡 → 标签页（详情 + 所有 tabs，含 `pageOnly`）→ 「详情」里先 `overview`（图表），再分区（3 列）+ 概要栏。关联列表只显示前 5 条，底部「查看全部」链到筛好的列表页。找不到 / 没权限用 `notFound`。

### 3.4 不在表格里用

```tsx
const detail = useRecordDetail({ rows: list, rowKey: (r) => r.id, layout: fullLayout, url: true });
<Card onClick={() => detail.open(item.id)} />   // 或 detail.open(id, 'peek')
{detail.element}
```

`useRecordDetail` 返回 `{ open(key, level?), close, openKey, level, setLevel, element }`；打开的记录离开列表（被删、被筛掉）自动关闭。只要一个弹框时直接用 `RecordDetailDialog`。

### 3.5 键盘与规矩

- Esc 关闭，焦点回到打开它的那一行（切换过就回到当前那条）；Alt + ↑ / ↓ 随时切换，J / K 在不打字时切换；弹框打开时焦点在弹框本身。
- 标签页一般 3–4 个，字段多的档案（订阅：概览 / 价格与成本 / 登录与令牌 / 客户 / 介绍 / 操作记录）最多 6 个、每个带图标；重图表和大关联表标 `pageOnly`。
- 主操作最多 2 个（另加 1 个 `tone: 'attention'`）；删除这类危险操作放「更多」并走确认框。
- 不在第 ① / ② 档里再开详情弹框；关联记录替换当前内容或链到整页。
- 手机上第 ② 档全屏，第 ① 档仍是居中弹框。

### 3.6 子表、看不到的字段、字段按钮、评论、字段弹窗（样稿 D11 / D12）

```tsx
import { CommentThread, CompactTable, SubTableSection, type RecordLayout } from '@adminui/react';

const customerLayout: RecordLayout<Customer> = {
  title: (c) => c.name,
  sections: [
    { key: 'basic', title: '客户资料', progress: true, hiddenFields: (c) => c.hiddenFieldCount,   // 「2 个字段你看不到」
      fields: [
        { key: 'phone', label: '手机', value: (c) => c.phoneMasked, copy: true, tel: (c) => c.canCall ? c.phoneDial : null,
          reveal: (c) => api.revealPhone(c.id) },        // 宿主鉴权 + 记谁看过，resolve 明文；30 秒后自动打码（remaskAfter）
        { key: 'next', label: '下次跟进', value: (c) => c.next, tone: () => 'attention',
          actions: (c) => [{ label: '提醒我', icon: <Bell />, onSelect: () => remind(c) }] },   // 一个字段多个小按钮
      ] },
    { key: 'follow', title: '跟进记录', block: (c) => (                                          // block = 整块自己画
      <SubTableSection title="跟进记录" total={c.followCount} shown={4} note="子表 · 能看这个客户的人就能看"
        onOpenInTable={() => openTable(c)} columns={cols} onColumnsChange={setCols}
        onAdd={() => addFollow(c)} addLabel="添加跟进" onViewAll={() => openAll(c)}>
        <CompactTable caption="跟进记录" rows={c.recentFollows} getRowId={(r) => r.id} fields={followFields} columns={visible(cols)} />
      </SubTableSection>) },
  ],
  aside: [{ key: 'comments', title: '评论', block: (c) => <CommentThread comments={comments} onSend={send} searchMentions={searchMembers} onReact={react} onResolve={resolve} onUpload={upload} /> }],
};
```

- **子表**：`SubTableSection` 只管外框（标题 + 计数 + 灰字说明、「在表格中打开」、「显示列」面板、底部添加 / 条数 / 查看全部），表格是宿主的：只读用 `CompactTable`，要在详情里直接改用 `BitableGrid toolbar={false}`（虚拟滚动关掉也行，最近 N 条）。默认只放最近几条，全部走「查看全部」或「在表格中打开」。
- **看不到的字段**：分区 `hiddenFields(row)` 返回这个人看不到的字段个数（服务端算），在分区底部出「N 个字段你看不到」，悬停说明找谁申请。不要把字段名或值发到前端再藏。
- **就地编辑**：`edit` 见 §3.1；宿主的编辑器组件自己管保存和错误，例：

```tsx
import { GridCellEditor, type GridField } from '@adminui/react/grid';
function NoteEditor({ ctx, row, field }: { ctx: RecordFieldEditContext; row: Customer; field: GridField<Customer> }) {
  const [error, setError] = useState<string | null>(null);
  return <GridCellEditor variant="field" field={field} row={row} anchor={ctx.anchor} error={error} onCancel={ctx.done}
    onCommit={(commit) => api.save(row.id, field.key, commit).then(ctx.done, (e) => setError(e.message))} />;
}
// 字段：{ key: 'note', label: '备注', value: (c) => c.note, edit: (c) => c.canEdit ? { render: (ctx) => <NoteEditor ctx={ctx} row={c} field={NOTE} /> } : null, lockedReason: '只有负责人能改' }
```
- **字段按钮**（这一行悬停或有焦点时出现）：`action`（一个，编辑 / 补填）+ `actions`（更多，`onSelect` 或 `href`）+ 内置的留痕查看（`reveal`）、拨打（`tel`）、复制（`copy`）、打开（`href`）。打码时不出复制按钮；查看后复制的是明文。点按钮不关详情弹框。
- **留痕查看**：`reveal(row)` / `SensitiveValue onReveal` 由宿主调接口——服务端判权限、写「谁在什么时候看了哪条记录的哪个字段」、返回明文；明文只留在组件内存里，`remaskAfter`（默认 30 秒）后自动打码，读秒显示在值后面。没权限就 reject 一个写着原因的 Error。
- **评论**：`CommentThread` 的 `comments` 是服务端给的一页（`CommentItem`：作者、时间、正文 + `mentions`、`attachments`、`reactions`、`resolved`、一层 `replies`）；`onSend(draft)` reject 时文字保留并提示；`searchMentions` 只返回能看这条记录的人；回应固定 4 种（赞 / 收到 / 看过 / 有疑问，`COMMENT_REACTION_KEYS`），只用图标 + 名字，不用 emoji；已解决的默认隐藏（`defaultFilter="open"`，受控用 `filter` / `onFilterChange`，纯函数 `filterComments(items, "open" | "all")`）；`onUpload` 把选的图片 / 文件先传好变成 `MediaItem`。编辑 / 删除自己的评论：传 `canEdit` / `canDelete`（例如 `(c) => c.author.id === me`，服务端再核对）和 `onEdit(id, body, mentions, { attachments, files })` / `onDelete(id)`；服务端写 `editedAt`（显示「已编辑」），有回复的删除可以留墓碑 `deleted: true`（显示「评论已删除」，回复保留）；本地更新用 `patchComment` / `removeComment`。整套服务端合同见 `CommentThreadAdapter`（list / create / update / react / resolve / remove / searchMentions / upload）。
- **字段弹窗**（表头「新建字段」、「修改字段」）：`FieldDialog`，类型目录 `types` 由宿主给（做不了的写 `later` 原因），`optionTypes` 的类型出 `OptionsEditor`；右栏 `aside` 放 `GrantList mode="picked"`（默认的人 `locked` 锁住、再授权给下级 / 部门 / 角色、`audience` 出「谁看不到 / 共几人能看」横幅）。名称必填 / 重名 / 选项重名内置校验，保存失败留在弹框。每个选项行要放宿主自己的控件（阶段选项的「类别」下拉、「默认赢率」输入）用 `renderOptionExtra(option, index, change)`（`FieldDialog` / `OptionsEditor` 都有），数据放 `option.meta`，`change({ meta: { ...option.meta, winRate } })`；改名、换色、换序、`cleanOptions` 都保留 `meta`。

### 3.7 卡片分区：可调布局的详情（`RecordDetail` / `RecordLayout.cards`）

已审定的样稿 C（截图 `design/templates/t14-record-detail.png`，starter「记录详情 · 卡片」）。字段多、有阶段、有跟进和评论的档案（客户、商机、工单）用它：

```
┌ 头部：图标 标题 [状态] [标签] 副标题             [编辑布局] [☆ 关注] ⋯ ⤡ ↗ ✕ ┐
├ 阶段（整条）：2/7 需求确认 · 已 3 天          标记丢单 [进入报价 →]          │
│  ▬▬▬ ▬▬▬ ▭▭▭ ▭▭▭ ▭▭▭ ▭▭▭ ▭▭▭  更多▾（丢单、作废）                            │
│  首通 需求确认 报价 …   1 天 / 第 3 天                                         │
├ 关键数（最多 4 个，整条）：预计金额 │ 下次跟进 │ 最后跟进 │ 跟进次数         │
├ 主栏（宽）：跟进（宿主块）                │ 右栏 380：联系方式（分区卡片）   │
│            评论（宿主块）                │          需求 · 成交「3 个空字段已收起 · 显示」│
└──────────────────────────────────────────┴──────────────────────────────────┘
```

- **布局是一份 JSON**（`RecordDetailSpec`，规则在 `@adminui/react/record-detail-spec`，无 React，服务端也能用）：`{ preset: 'cards' | 'single' | 'split', blocks: [{ id, kind: 'stage' | 'keyNumbers' | 'section' | 'slot', column: 'main' | 'side', title?, fields?, collapsed?, hideEmpty? }], hidden: [], keyNumbers?: [] }`。`section` 是一组字段 key；`slot` 是宿主画的块（跟进、评论、子表、附件），按 id 对上 `slots`；`hidden` 是用户隐藏的块 id 和字段 key；`keyNumbers` 是选中的关键数 key（最多 4 个）。宿主存它、读它，SDK 用 `normalizeRecordDetailSpec` 纠正（丢未知 / 重复，字段只在一个分区，没归属的进「其他字段」，补上宿主有但布局没写的块）。**服务端保存前也用它校验。**
- **三种版式**：`cards`（默认，C）浅底软卡片，阶段 + 关键数一整条在上，左宽主栏（宿主块）、右栏分区卡片；`single`（A）一列居中、平的分区、阶段变箭头；`split`（B）左资料（一栏白底，分区之间一条线）、右动态。手机（≤ 760px，或容器窄于 720px）一律一列：顶部、主栏、右栏；分段进度只留色条。
- **分区卡片**里的字段就是记录详情的字段行（`RecordField`：悬停按钮、就地编辑 `edit`、只读锁、复制、拨打、留痕查看）；空字段（**包括能编辑的**）收成一行「3 个空字段已收起 · 显示」，点「显示」就地填；`hideEmpty: false` 的分区照常显示空字段，字段自己的 `showEmpty` 永远留着。分区标题点了能临时收起 / 展开，`collapsed` 是默认收起。
- **阶段** `stage(row) = { steps, current?, onSelect?, readOnly?, onAdvance?, onMarkLost?, labels? }`：`steps` 每段 `{ id, label, days?, kind?: 'normal' | 'lost' | 'void', state? }`（给了 `current` 就只按位置推：前面已完成、后面未开始，以前走过的段只留天数不填色；不给 `current` 才读 state）。完成的段写「1 天」，当前段「第 3 天」、标题行「· 已 3 天」；每段是按钮（`onSelect(stepId)`，Tab + Enter），丢单 / 作废这类出口不在路径里，在末尾「更多」菜单，记录已退出时这个按钮显示出口名（红）。「进入<下一阶段>」/「标记失败」（`labels.advance` / `labels.markLost` 改字，例如「标记丢单」）。单独用：`<StagePath steps current onSelect variant="segments" | "chevrons" readOnly />`。
- **关注**：`follow(row) = { on, onToggle }`，头部一颗安静的星「关注 / 已关注」。
- **编辑布局**（给 `editor` 才有按钮）：头部上方出一条编辑条——「公司默认 / 只改我的」（`canEditDefault`）、版式、恢复公司默认（`onReset`）、取消、完成（`onSave(spec, scope)`，reject 留在编辑态显示原因）。每张卡片右上角：拖动把手（拖到另一栏 / 换顺序；键盘 Alt + ↑ / ↓ 换顺序、Alt + ← / → 换栏，或空格拿起、方向键移动、空格放下、Esc 放回）、整理字段（分区）、选择关键数、默认收起、隐藏；隐藏的进底部「已隐藏」托盘，点一下恢复；栏末「+ 添加分区」。「整理字段」是一个侧边面板：所有分区和字段（`SortableList`，字段只能在分区里拖，键盘到分区边上直接进相邻分区），改分区名、隐藏字段、新建 / 删除分区（字段移到「其他字段」）。编辑时 Esc 先退出编辑，不关弹框。
- 文字用后台正文色 `--aui-text`；样稿里的 #1F2329 是文档阅读区的纯中性灰，记录详情不用。

**表格 / 列表里打开**（弹框和整页的「详情」页签变卡片分区，其他标签页不变）：

```tsx
const layout: RecordLayout<Customer> = {
  title: (c) => c.name, avatar: (c) => c.name[0], status: () => ({ label: '跟进中', tone: 'brand' }),
  sections: [{ key: 'contact', title: '联系方式', fields: contactFields }, { key: 'needs', title: '需求', fields: needFields }],
  cards: {
    spec: savedSpec,                                  // 服务端存的 JSON（没有就用 sections 当初始分区）
    stage: (c) => ({ steps, current: c.stage, onSelect: (id) => setStage(c, id), onAdvance: () => advance(c), onMarkLost: () => markLost(c), labels: { markLost: '标记丢单' } }),
    keyNumbers: (c) => [{ key: 'amount', label: '预计金额', value: money(c.amount), hint: '赢率 30%' }, …],
    slots: (c) => ({ activity: { title: '跟进', count: c.follows, render: () => <FollowFeed id={c.id} /> }, comments: { title: '评论', render: () => <CommentThread title={null} … /> } }),
    follow: (c) => ({ on: c.following, onToggle: () => toggleFollow(c) }),
    editor: { canEditDefault: isAdmin, onSave: (spec, scope) => api.saveLayout(spec, scope), onReset: () => api.resetMyLayout() },
  },
};
<DataTable … expandRecord={{ layout, url: true }} />
```

`sections` 里用 `block` / `render` 画的分区（子表、评论）自动变成 slot，id = 分区 `key`。**自己的页面 / 框**用 `<RecordDetail row fields spec stage keyNumbers slots follow layoutEditor title avatar status badges tags meta nav actions recordKey />`（头部 + 编辑条 + 正文；`badges` = 标题旁彩色小标签，`meta` 可给分段数组 `["智能家居客户", { person: "小王", suffix: "负责" }, "建档 2 天"]`，`avatar` 默认标题第一个字）；表格里的弹框用 `RecordLayout.badges` / `RecordLayout.meta`。字段说明给 `RecordField.description`（悬停字段名看），不要用 ⓘ 图标。跟进类的「写一条」用 `ActivityComposer`（方式小标签 + 短文本 + 底部一行：工具 | 下次跟进 + 日期 + 1/3/7 天 + 保存）。只要正文用 `RecordDetailBody` + `useRecordLayoutEditor`。starter「系统 → 记录详情 · 卡片」。

## 4. 验收

- `npm run test:business-tables`：真实横 / 纵滚动下的冻结偏移和表头、受限全选、批量隔离、多排序、各档行高每行一样高、`+N` / 悬停 / Esc、记录详情的全部字段 / 上一条下一条 / 焦点归还 / 手机全屏、深色对比度、360 / 390 / 1440px。
- `npm run test:records`（starter「系统 → 记录与字段」：字段行没有卡片套卡片、按钮只在悬停出现、就地编辑文本 / 长文本 / 单选 / 日期 / 失败 / 锁 / 手机、留痕查看、拨打 / 复制 / 多个按钮、看不到的字段、子表显示列、评论 @ / 回复 / 回应 / 解决 / 默认「未解决」、字段弹窗键盘与校验、授权名单、390 / 深色）。
- `npm run test:collections`（starter「系统 → 轻量集合」）、`npm run test:record-detail`（第 ② 档尺寸居中、Alt+↓ / K、地址栏只替换、缩小到第 ① 档、返回键关闭、整页、手机、深色）。
