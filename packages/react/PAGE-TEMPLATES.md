# 页面模板（T01–T17）：先选模板，再写页面

已审定 14 个页面模板（T01–T14）；多维表格样稿标准化又加了 3 个自带外壳的模板（T15 表格工作区、T16 公开页、T17 看板搭建器）。**每个后台页面都从其中一个起步：布局定死，只按业务换内容。** 写页面前先在代码注释或交付说明里写明「本页用 Txx」；套不上、要偏离布局，先问产品负责人，先做演示（静态页或 starter 页）给产品负责人看，通过后再写。

- 通过的模板截图（标准）：`design/templates/tNN-*.png`——T01 `t01-home.png` … T13 `t13-personal.png`，T14 `t14-record-detail.png`，T15 `t15-workspace.png`，T16 `t16-public-form.png`，T17 `t17-dashboard-builder.png`。
- 可运行的 React 版：starter 菜单「页面模板」（`examples/starter/src/PageTemplates.tsx`），只用 SDK 组件拼成，照着改内容就是新页面；T15–T17 各占一整页（`TemplateWorkspace.tsx` / `TemplatePublic.tsx` / `TemplateBuilder.tsx`，地址 `#template=t15 | t16-form | t16-success | t16-visitor | t16-password | t17`，加 `&dark` 看深色）。
- 机器可读清单：`import { PAGE_TEMPLATES } from "@adminui/react/catalog"`（每个模板的用途、骨架、组件、演示文件、starter 页）。
- 浏览器验收：`npm run test:page-templates`（1440×900 浅 / 深色 + 390 手机，T15–T17 另查外壳几何、目录收起 / 搜索 / 键盘、手机底栏和抽屉、触屏尺寸、搭建器三栏；截图在 `test/artifacts/page-templates/`）。

## 所有模板共同：贴边，栏与栏一条线（8.6）

每个模板的页面都铺在白底上、贴着工作标签行、侧栏和窗口边：**块与块、栏与栏之间只有一条 1px 分隔线，不露灰色画布、不做成一张张圆角卡片**（以前的「卡片流」页面也一样，和工作区页面看起来一致）。下文骨架里说的「卡」「卡片」指一个区块（有标题行的一块），不再是带框带阴影的浮动卡片。只有看板 / KPI 卡（放在看板自己的浅色画布带上）、画册 / 看板 / 记录卡片、工作项卡片这类真正独立的对象之间留缝。页面或分区里只有一个带标题的区块时不再重复标题（标题只给读屏，数量、「?」和按钮并进筛选行或一条紧凑的工具行）；只有一个分区的 `TabbedPage` 不出分区标签行。starter「系统 → 页面贴边」把工作区分区（角色）和普通列表分区（部门）放在同一个 `TabbedPage` 里对照，另有「租户成员」（单分区）；浏览器验收 `test/page-flush-checks.mjs`（截图像素检查块之间不露画布，截图 `test/artifacts/page-flush/`）。

## 怎么选

| 页面要干什么 | 模板 |
|---|---|
| 登录后第一屏：现在怎么样、要我做什么 | T01 工作台首页 |
| 管一类会增长的对象（找、筛、逐行操作） | T02 资源列表页 |
| 先看几个数正不正常，再处理列表 | T03 指标 + 列表页 |
| 一段时间的用量 / 花费 / 趋势 | T04 统计看板页（复杂经营看板另按 DASHBOARDS.md 写分类卡） |
| 一个菜单项下几个相关页面 | T05 分区合并页（每个分区通常是 T02） |
| 审计 / 任务 / 告警这类按时间的记录 | T06 日志 / 时间线页 |
| 谁连着什么、拓扑、监控墙 | T07 关系图 / 实时监控页 |
| 一组配置项、授权信息、个人设置 | T08 设置 / 表单页 |
| 谁能对哪些对象做什么 | T09 权限配置页 |
| 占满整屏的工具（AI 助理、终端、远程桌面） | T10 工具 / 工作区页 |
| AI 目标、任务、长流程的进度 | T11 进度 / 工作项页 |
| 多步操作（新增、接入、激活、导入） | T12 向导页 |
| 「我的」：我的首页、我的接入 | T13 个人页 |
| 列表里一行的详情 | T14 记录详情 |
| 一个模块一整屏的工作区：多维表格、CRM、文件、知识库（左边图标栏 + 目录） | T15 表格工作区 |
| 不用登录、从链接打开：填表、提交成功、访客看记录、密码门、一次性密钥 | T16 公开页 |
| 拖组件搭东西：看板（以后的表单 / 报表编辑器） | T17 看板搭建器 |

列表类页面（T02、T03、T09）不在分区里时写 `<PageBody fill>`：卡片撑满一屏，空表居中、分页贴底，卡片下面不留空白。

所有模板共同的规矩（AI-RULES.md §0–§2）：不写重复页名的大标题和介绍段落（说明放「?」）；页面按钮并进第一块的标题行或分区标签行右端，不单独占一行；表格每行一样高、最多露 3 个操作；指标卡紧凑；颜色只用色卡；不加装饰色条。

---

## T01 工作台首页

- **什么时候用**：登录后的首页、某个角色的工作台。回答「现在正不正常、要我做什么、常去哪」。
- **骨架**：① 指标带（一张卡一排 4–6 个数）② 左：待办（分类切换 + 每条带处理按钮 + 没问题的收成一行小标签）+ 最近的操作 ③ 右栏 340：此刻在线 + 常用入口。
- **组件**：`StatStrip`、`SplitLayout`、`TodoInbox`、`ActionList dense`（最近操作）、`PresenceList`、`QuickLinks`、`LiveStatus`。
- **演示 / starter**：`design/templates/t01-home.png` · 「T01 工作台首页」
- **典型用到它的页面（以运维平台为例）**：首页。

```tsx
<PageHeader title="首页" />
<PageBody>
  <StatStrip title="运营概况" description="…" actions={<LiveStatus state="live" dataTime={t} />} items={[
    { key: "reach", label: "机器可达", icon: <Server />, value: "38/38", unit: "台", note: "100% · 比昨天持平" },
  ]} />
  <SplitLayout rail={<><PresenceList people={online} /><Panel title="常用入口"><QuickLinks items={links} /></Panel></>}>
    <TodoInbox filters={[{ key: "today", label: "今天" }]} items={todos} ok={["机器 38/38 可达"]} />
    <Panel title="最近的操作" flush><ActionList dense label="最近的操作" items={recent} /></Panel>
  </SplitLayout>
</PageBody>
```

## T02 资源列表页

- **什么时候用**：管理一类对象的主列表（会增长、要找要筛、对每行做操作）。
- **骨架**：（可选分区标签）→ 一张列表卡：标题行（标题 · 数量 · ? · 页面按钮）→ 筛选行 → 表格（固定行高，每行 ≤3 个操作，其余进 ⋯）→ 合计 + 分页；勾选后底部浮出批量操作条。
- **组件**：`PageBody fill`（没有分区时：列表卡片撑满一屏，空表居中）、`TabbedPage`（有分区时，`sections` 可带 `count`）、`ResourcePanel`（`unit` 显示「38 台」）、`QueryBar` + `Choice`、`DataTable`（`rowHeight`、`expandRecord`、`bulkActions`）、`RowActionBar`、`CellText` / `CellPeople` / `CopyableValue variant="inline"`、`StatusBadge`。
- **演示 / starter**：`design/templates/t02-list.png` · 「T02 资源列表页」
- **典型用到它的页面（以运维平台为例）**：机器、数据库、资产、人员、角色、人员组、常驻服务、下载节点、代码镜像、客户授权、我能看的资产、我的电脑、订阅账号、SSH 公钥、AI 接入、常用提示词、知识库。

```tsx
<PageHeader title="机器" />
<PageBody fill>
<ResourcePanel title="机器" count={total} unit="台" actions={<Button size="sm"><Plus />新增机器</Button>}
  filters={<QueryBar value={q} onChange={setQ} onSearch={search} onReset={reset}><Choice label="状态" … /></QueryBar>}>
  <DataTable caption="机器列表" rows={rows} rowKey={(m) => m.id} columns={columns} rowHeight="medium"
    selected={selected} onSelectionChange={setSelected} bulkActions={[{ key: "move", label: "移到分组", icon: <FolderInput />, onSelect: openMove }, …]}
    pagination={{ mode: "page", total, page, pageSize, onPageChange, onPageSizeChange }} />
</ResourcePanel>
</PageBody>
```

## T03 指标 + 列表页

- **什么时候用**：先看几个数是否正常，再处理列表（备份、远控、额度、告警）。
- **骨架**：① 分区标签行（右端：实时 · ? · 页面按钮——第一块是指标卡时 SDK 自动放这里）② 紧凑指标卡一排（≤ 90px 高）③ 「要处理的」（有才出现）④ 列表卡。
- **组件**：`TabbedPage`（`actions` 放 `LiveStatus` + 主按钮）、`MetricGrid` + `MetricCard`（有对比基准用 `KpiGrid` + `KpiCard`）、`TodoInbox title="要处理的"`、`ResourcePanel` + `DataTable`（操作列可放 `Switch` + `RowActionBar`）。
- **演示 / starter**：`design/templates/t03-kpi-list.png` · 「T03 指标 + 列表」
- **典型用到它的页面（以运维平台为例）**：备份、远控、中转额度、机群、告警。

```tsx
<TabbedPage title="备份" actions={<><LiveStatus state={live.state} dataTime={live.dataTime} /><Button size="sm"><Plus />新增备份</Button></>}
  sections={sections} value={tab} onValueChange={setTab} render={() => (<>
    <MetricGrid><MetricCard title="恢复点达标" icon={Check} value="21/21" unit="条" note="…" /></MetricGrid>
    {problems.length > 0 && <TodoInbox title="要处理的" items={problems} />}
    <ResourcePanel title="备份策略" count={21} unit="条"><DataTable … /></ResourcePanel>
  </>)} />
```

## T04 统计看板页

- **什么时候用**：一段时间的用量 / 花费 / 趋势（AI 用量、额度用量、存储用量）。要做经营看板、实时大屏时先按 DASHBOARDS.md 写分类卡。
- **骨架**：① 概况卡：标题行放时间范围分段 + 人员筛选 + 导出，下面指标带 ② 两列：趋势图 | 占比条 ③ 两列：明细表 | 排行。
- **组件**：`StatStrip`（`actions` 放 `SegmentedControl` / `Choice` / 导出）、`SplitLayout railWidth={380}`、`AdminChart` + `timeSeriesOption`（`@adminui/react/charts` 懒加载）、`BarList`（`ranked` 排行）、`DataTable` + `RatioBar`（占比列）。
- **演示 / starter**：`design/templates/t04-stats.png` · 「T04 统计看板页」
- **典型用到它的页面（以运维平台为例）**：AI 用量（我的 / 全员）、中转额度用量、存储用量。

```tsx
<StatStrip title="全员用量" count="9 月 3 日 – 10 月 2 日" actions={<SegmentedControl size="sm" … />} items={stats} />
<SplitLayout railWidth={380} rail={<Panel title="按模型分" flush><BarList label="按模型分" items={models} /></Panel>}>
  <Panel title="每天的花费"><AdminChart option={timeSeriesOption({ series, mode, area: true })} label="每天的花费" height={210} /></Panel>
</SplitLayout>
```

## T05 分区合并页

- **什么时候用**：一个菜单项下有几个相关页面（人员 / 角色 / 邀请）。
- **骨架**：分区标签（图标 + 数量；要处理的数量用注意色）→ 当前分区内容（通常是一个 T02）；分区开头是列表卡时，页面按钮和「?」并进列表卡标题行。
- **组件**：`TabbedPage`（`sections` 带 `icon` / `count` / `countTone`），分区里照写 T02。
- **演示 / starter**：`design/templates/t05-sections.png` · 「T05 分区合并页」
- **典型用到它的页面（以运维平台为例）**：机器、备份、远控、人员、授权、我的接入、AI 助理、AI 用量、订阅、机群、镜像。

```tsx
<TabbedPage title="人员" value={tab} onValueChange={setTab} sections={[
  { id: "people", label: "人员", icon: <Users />, count: 23 },
  { id: "invites", label: "邀请", icon: <Link2 />, count: 2, countTone: "attention" },
]} render={(id, active) => (id === "people" ? <PeopleList active={active} /> : <Invites active={active} />)} />
```

## T06 日志 / 时间线页

- **什么时候用**：审计日志、会话审计、AI 任务记录、告警历史这类「按时间发生的记录」，要检索、要看改前改后。
- **骨架**：一张卡：标题行（条数 · ? · 导出）→ 筛选行（时间范围 · 操作人 · 动作 · 搜索）→ 按天分组的一行一条（时间 · 谁（AI 带标）· 做了什么 · 对象 · 结果 · 展开）→ 展开看改前改后 → 加载更多。
- **组件**：`ResourcePanel` + `QueryBar`（`SegmentedControl` 时间范围 + `Choice`）+ `LogTimeline`（`actor` / `text` / `target` / `result` / `diff` / `total` / `onLoadMore`）。某一个对象的历史用 `ActivityFeed`。
- **演示 / starter**：`design/templates/t06-log.png` · 「T06 日志 / 时间线」
- **典型用到它的页面（以运维平台为例）**：审计日志、会话审计、AI 任务记录、告警历史。

```tsx
<ResourcePanel title="审计日志" count={total} unit="条" filters={<QueryBar …><SegmentedControl … /></QueryBar>}>
  <LogTimeline caption="审计日志" items={rows} getId={(e) => e.id} time={(e) => e.at}
    actor={(e) => ({ name: e.who, ai: e.isAgent })} text={(e) => e.summary} target={(e) => e.target}
    result={(e) => ({ label: "成功", tone: "success" })} diff={(e) => ({ meta: [e.ip], changes: e.changes })}
    total={total} onLoadMore={loadMore} />
</ResourcePanel>
```

## T07 关系图 / 实时监控页

- **什么时候用**：连接图、备份图、远控监控墙——看对象之间的关系和此刻状态。
- **骨架**：一张满宽卡：标题行（标题 · 实时 · ?；右边筛选小签）→ 图例行（右端汇总数）→ 大画布 + 右侧 300 选中对象详情（标题、几个数、列表、底部按钮）。
- **组件**：`GraphLayout`（`live`、`filters={<ChipGroup …/>}`、`legend`、`summary`、`tools`、`detail`）、详情用 `Pane bare` + `PaneSection` + `DescriptionList` + `ActionList`。**画布本身由业务画**（SVG / 图库），颜色只用色卡变量（`var(--aui-primary)` 等）。
- **演示 / starter**：`design/templates/t07-graph.png` · 「T07 关系图 / 监控」
- **典型用到它的页面（以运维平台为例）**：连接图、备份图、远控监控墙。

```tsx
<GraphLayout title="连接图" live={<LiveStatus state={s} dataTime={t} />} filters={<ChipGroup label="筛选" … />}
  legend={[{ key: "on", label: "正在连接", kind: "line" }, { key: "busy", label: "负载高", kind: "dot", tone: "attention" }]}
  summary="人 6 · 在线 4" detail={<Pane bare icon={<Server />} title="web-01" hint="生产环境" footer={…}>…</Pane>}>
  <MyGraphCanvas />
</GraphLayout>
```

## T08 设置 / 表单页

- **什么时候用**：一组配置项、产品授权、告警规则、个人设置——一页有好几组字段。
- **骨架**：左 200 分节导航（白底、右边一条竖线，不包卡片；分组小标题 + 34px 行；滚动时高亮当前节，改过的节琥珀圆点、出错的节红色叹号；窄屏变吸顶胶囊）+ 右边一节一张卡（只读事实用字段方块；可改项两列表单，标签在上，提示只在需要处）+ 有未保存改动时底部浮起保存条（改动数 · 有误数 · 放弃 / 保存）。
- **组件**：`SideNavLayout`（`sections` 带 `group` / `dirty` / `error`，`footer={<SaveBar …/>}`；每节不各放保存按钮）；同样的设置放在抽屉里（表设置）用 `SettingsSheet`（左 184 分节 + 右边一次一节 + 底部保存条）、`Panel`、`DescriptionList columns={3}`、`FormSection`（不写标题 = 两列网格）、`FormField`（`changed` 显示「已改」）、`SaveBar`。改动可以接 `changedFields` 算差异。
- **演示 / starter**：`design/templates/t08-settings.png` · 「T08 设置 / 表单」
- **典型用到它的页面（以运维平台为例）**：产品授权、客户授权设置、镜像设置、告警规则、个人设置。

```tsx
<SideNavLayout sections={[
  { id: "update", label: "更新设置", icon: <RefreshCw />, dirty: changed.length > 0, content: (
    <Panel title="更新设置"><FormSection>
      <FormField label="更新通道" htmlFor="channel" changed={draft.channel !== saved.channel}><Choice … /></FormField>
    </FormSection></Panel>) },
]} footer={<SaveBar count={changed.length} summary={labels} onDiscard={reset} onSave={save} />} />
```

## T09 权限配置页

- **什么时候用**：授权、角色权限、组成员、资产分享——左边选人或组，右边改他对一批对象的权限。
- **骨架**：（分区标签）→ 一张卡：标题行（? · 新增）→ 左 260 人 / 组列表（搜索 + 分组标题 + 选中高亮）+ 右边选中对象的矩阵表（对象行 × 权限列的勾选格，改过的格浅色框）→ 改动汇总条（改了 N 处 · 撤销 · 保存）→ 图例。
- **手机**：列表 → 详情两步：`ListDetailLayout` 传 `detailOpen` + `onBack`（+ `detailTitle`），先只看列表，点一行只看详情，左上 ← 回列表。
- **组件**：`PageBody fill`（不在分区里时，整张卡片撑满一屏）、`Panel flush` + `ListDetailLayout`（`list={<SelectList search="搜人或组" …/>}`）（SelectList 规格：行 36 / 有 `hint` 两行 52 / 手机 44，`icon` 是 16px 备注色小图标不套圆底，选中 = 主色浅底 + 加粗，分组标题带数量，搜索命中高亮，搜不到一句话 + `onCreate`，`loading` 骨架行）、`Pane bare`（选中对象的标题和按钮）、`DataTable`（`pagination={{ mode: "all" }}`，格子里 `ChangeMark` + `Checkbox`）、`SaveBar placement="inline"`。quanxian 的角色权限用 `@adminui/react/access` 的 `PermissionMatrix`。
- **演示 / starter**：`design/templates/t09-matrix.png` · 「T09 权限配置页」
- **典型用到它的页面（以运维平台为例）**：授权、角色权限、人员组成员、资产分享。

```tsx
<Panel title="谁能连哪些机器" flush actions={<Button size="sm"><Plus />新增授权</Button>}>
  <ListDetailLayout list={<SelectList label="人和组" search="搜人或组" items={subjects} selected={id} onSelect={setId} />}>
    <Pane bare icon={<Users />} title="运维组" hint="3 人 · 授权 5 台机器" footer="浅色框 = 改过、还没保存">
      <DataTable … columns={[{ key: "ssh", title: "连接", render: (g) => <ChangeMark changed={…}><Checkbox … /></ChangeMark> }]} />
      <SaveBar placement="inline" count={n} summary={text} onDiscard={undo} onSave={save} />
    </Pane>
  </ListDetailLayout>
</Panel>
```

## T10 工具 / 工作区页

- **什么时候用**：AI 助理、网页终端、游戏制作、远程桌面这类整屏工具。
- **骨架**：占满工作标签下的整屏、**页面本身不滚**：左 240 列表（搜索 + 新建 + 条目）| 中间工作区（对话 / 终端，自己滚，底部输入框）| 右 280 上下文（当前对象、可用工具、花费）。宽屏贴边（贴住工作标签条、侧栏、窗口边），栏与栏之间一条线分隔，不留缝、不做成一张张卡片（对标飞书文档 / 多维表格）；栏里的表格、列表面板、筛选栏、画册、表单搭建器、表格权限、有效权限、记录头部、页内标签条都自动贴边（AI-RULES 附录 R）。放在 `TabbedPage` 分区里时，分区标签条也贴着工作区、下面不留缝（8.6 起同一页的普通分区也一样贴边）。窄屏（≤ 1100px）上下排也贴边（8.6 起唯一的样子，`narrow="card"` 已删除）：外壳内容区不留内边距、没有外框和圆角，栏贴着左右边、上下之间一条横线（在 `TabbedPage` 里分区标签条照样贴边）。
- **手机**：有「列表 + 详情」的工作区用 `WorkspaceLayout narrow="steps" detailOpen onBack`：先列表、点进详情、← 返回，右栏收进详情；单栏阅读页（文档）用默认（8.6 起窄屏上下排一律贴边，`narrow="card"` 已删除）。
- **组件**：`WorkspaceLayout`（自动量出高度）、三栏都是 `Pane`；左 `SearchField` + `SelectList`（未读 `unreadCount` = 名字加粗 + 主色数量徽标，只有布尔 `unread` 时是小圆点；按天分组）；中 `ChatThread` + `ChatMessage` + `ToolCallCard` + `InlineAlert`（要确认的操作）+ `LoadingDots` + `Composer`；右 `PaneSection` + `InfoList` + `DescriptionList` + `Meter`。终端 / 远程桌面画面由业务放进中间的 `Pane`。
- **演示 / starter**：`design/templates/t10-workspace.png` · 「T10 工具 / 工作区」
- **典型用到它的页面（以运维平台为例）**：AI 助理、网页终端、游戏制作、自我进化、远程桌面。

```tsx
<WorkspaceLayout
  left={<Pane header={<SearchField size="sm" … />} actions={<Button size="sm"><Plus />新对话</Button>}><SelectList … /></Pane>}
  right={<Pane title="本次对话"><PaneSection title="可用工具"><InfoList … /></PaneSection></Pane>}>
  <Pane title={conv.title} footer={<Composer value={text} onChange={setText} onSend={send} />}>
    <ChatThread>{messages.map((m) => <ChatMessage key={m.id} author={m.author} mine={m.mine} time={m.time}>{m.body}</ChatMessage>)}</ChatThread>
  </Pane>
</WorkspaceLayout>
```

中间一栏是「筛选 + 表格」、右栏是一个列表、栏头下有提示（starter「系统 → 工作区贴边 · 客户表」）：

```tsx
<WorkspaceLayout left={<Pane …><SelectList … /></Pane>} right={<ResourcePanel title="最近跟进" count={n} unit="条"><DataTable … /></ResourcePanel>}>
  <Pane fill title="客户" count={total} actions={<Button size="sm"><Plus />新建</Button>} notice={<InlineAlert title="…">…</InlineAlert>}>
    <QueryBar variant="flush" value={draft} onChange={setDraft} onSearch={search} onReset={reset} />
    <DataTable caption="客户" rows={rows} columns={columns} rowKey={(r) => r.id} pagination={…} />
  </Pane>
</WorkspaceLayout>
```

文档阅读 / 编辑器页（starter「系统 → 工作区贴边 · 文档」）：窄屏上下排贴边（默认），正文用纯中性灰，栏头是面包屑：

```tsx
<WorkspaceLayout left={<Pane title="个人空间"><SelectList … /></Pane>} right={<Pane title="大纲" padding="md">…</Pane>}>
  <Pane label="文档正文" padding="md" header={<Breadcrumbs items={[{ label: "个人空间", onClick: goSpace }, { label: doc.title }]} />}>
    <article className="aui-neutral-text">…</article>
  </Pane>
</WorkspaceLayout>
```

## T11 进度 / 工作项页

- **什么时候用**：AI 目标、AI 任务、长流程（游戏制作任务）的进度跟踪。
- **骨架**：标题卡（标题 · 数量 · ? · 分段筛选 · 搜索 · 新建）→ 工作项卡片列表（标题 · 负责人行 · 步骤条 · 进度条 · 最新动态 · 查看 / 暂停 / ⋯；等人确认的卡琥珀色边 + 一行确认条，排在最上）→ 底部汇总一行。
- **组件**：`Panel flush`（只有标题行）、`SegmentedControl`、`SearchField`、`WorkItemList`（`footer`）+ `WorkItemCard`（`steps` / `current` / `progress` / `event` / `actions` / `attention`）。
- **演示 / starter**：`design/templates/t11-board.png` · 「T11 进度 / 工作项」
- **典型用到它的页面（以运维平台为例）**：AI 目标、AI 任务、游戏制作任务。

```tsx
<WorkItemList label="进行中的目标" footer={<>本周已完成 6 个<Button size="sm" variant="ghost">看已完成 ›</Button></>}>
  <WorkItemCard title={g.title} owner={g.agent} facts={[`发起人 ${g.by}`, g.elapsed]} steps={STEPS} current={g.step}
    progress={g.ratio} event={g.latest} actions={actions(g)}
    attention={g.waiting ? { label: "等你确认", text: g.question, action: { label: "去确认", onSelect: () => open(g) } } : undefined} />
</WorkItemList>
```

## T12 向导页

- **什么时候用**：新增机器、一键接入、新增远控接入、激活授权、导入——要按顺序走几步的操作。
- **骨架**：向导（标题行（? · 一句提示 · 关闭）→ 步骤条 → 每步一块内容（最宽 880）→ 底栏 上一步 / 下一步，**不能下一步时在旁边写原因**）| 右侧 260 一栏（常见问题、最近记录）。8.6.1 起和其它页面一样贴边：向导不是浮动卡片，和右栏之间一条竖线、右栏撑到底。
- **组件**：`WizardLayout`（`steps` / `current` / `onBack` / `onNext` / `nextDisabledReason` / `aside`）、`FormField`、`ChoiceTiles`（大选项单选）、`SegmentedControl`、`CopyBlock`（命令）、`InlineAlert`（等待状态 + 「马上检查」）、`ActionList wrap`（常见问题）、`InfoList`。导入 CSV / Excel 用现成的 `ImportWizard`。
- **演示 / starter**：`design/templates/t12-wizard.png` · 「T12 向导页」
- **典型用到它的页面（以运维平台为例）**：新增机器、一键接入、新增远控接入、激活授权、导入。

```tsx
<WizardLayout title="新增机器 · 一键脚本接入" steps={steps} current={step} onBack={back} onNext={next}
  nextDisabledReason={connected ? undefined : "机器连上来之后才能下一步"} aside={<Panel title="常见问题" flush>…</Panel>}>
  <FormField label="这台机器是什么系统" htmlFor="os"><ChoiceTiles id="os" label="系统" value={os} onValueChange={setOs} options={…} /></FormField>
  <CopyBlock label="接入命令" value={command} />
</WizardLayout>
```

## T13 个人页

- **什么时候用**：我的首页、我的机器、我的接入、我的电脑——只看「我」的东西。
- **骨架**：① 我的指标带 ② 左：最近用过（对象 + 状态 + 上次时间 + 2 个常用操作）+ 要留意的事（快到期 + 申请续期；其他正常收成一句）③ 右栏 440：我的接入（公钥列表、密钥列表、从自己电脑连的命令）。
- **组件**：`StatStrip`、`SplitLayout railWidth={440}`、`ActionList`（`badge` + `meta` + 行操作）、`TodoInbox`（`ok` 写一句话）、`Panel flush` + `PaneSection flush`（带浅色标题条的小节）、`SegmentedControl`、`CopyBlock`。
- **演示 / starter**：`design/templates/t13-personal.png` · 「T13 个人页」
- **典型用到它的页面（以运维平台为例）**：我的首页、我的机器、我的接入、我的电脑。

```tsx
<SplitLayout railWidth={440} rail={<Panel title="我的接入" flush>
  <PaneSection title="SSH 公钥" count={2} flush actions={<Button size="sm" variant="ghost"><Plus />添加</Button>}><ActionList label="SSH 公钥" items={keys} /></PaneSection>
</Panel>}>
  <Panel title="最近连过" count={5} flush><ActionList label="最近连过" items={recent} /></Panel>
  <TodoInbox title="要留意的事" items={due} ok="其他都正常：…" />
</SplitLayout>
```

## T14 记录详情（C 版）

- **什么时候用**：所有列表行的「详情」。字段少用小弹框，多的用大弹框，图表和大关联表放整页（TABLES.md §3）。
- **骨架**：头部（大图标 + 标题 + 状态 + 标签 + 上一条 / 下一条）→ 关键信息块 → 带图标的标签页 → 字段行（灰色字段名在左、值在右，按分区排）→ 右栏概要。
- **组件**：`DataTable expandRecord={{ layout }}` / `RecordDetailDialog` / `RecordPage` / `useRecordDetail`（一份 `RecordLayout` 三档通用），内部是 `RecordHeader`、`FactStrip` 和字段行（不要自己用 `DescriptionList` 拼详情）。
- **卡片分区（样稿 C）**：有阶段、跟进、评论的档案（客户、商机、工单）给 `RecordLayout.cards`（或独立页面用 `RecordDetail`）：阶段 + 关键数整条在上，左宽主栏放宿主块，右栏分区卡片；用户可「编辑布局」，版式 cards / single / split（TABLES.md §3.7）。
- **演示 / starter**：`design/templates/t14-record-detail.png` · 「T14 记录详情」（打开「组件总览」里的记录详情演示） · 「记录详情 · 卡片」
- **典型用到它的页面（以运维平台为例）**：所有列表行的「详情」。

## T15 表格工作区

- **什么时候用**：多维表格、CRM、文件、知识库、话术这类「一个模块占一整屏、左边一棵目录、右边一张表 / 一个视图」的工作区。普通管理页面仍在 `AdminShell` 里用 T01–T14。
- **骨架**（样稿 D01）：左 56px 平台图标栏（模块图标 + 下方小字，当前的浅底加粗；底部通知 / 设置 / 头像）| 232px 目录（头部：所属空间名 + 灰字 + ⋯；搜索；一层文件夹带 chevron + 右侧灰色行数（展开 / 收起都显示）；每行图标 + 名字 + 右侧灰色数量；底部「+ 新建」）| 工作区：标题栏 48px（表名 · ? · ☆ · 右侧业务线胶囊 · 正在看的人 · 评论 / 自动化 / 权限图标 · 主按钮「分享」· ⋯）→ 视图标签 → 工具栏（左端「添加记录 ▾」）→ 个人设置条（有调整时）→ 视图（撑满剩下的高度）。**整页不滚**，只有视图区、目录自己滚。
- **页名**：T15 是唯一在页面里显示页名的模板（图标栏没有页名），表名写在 `WorkspaceTitleBar`，不要再加 `PageHeader showTitle`。
- **组件**：`RailShell`（`modules` / `footer` / `account` / `sidebar` / `mobileNav`）、`NavTree`（`nodes` / `activeId` / `onSelect` / `menu` / `search` / `createMenu`）、`WorkspaceTitleBar`（`title` / `description` / `favorite` / `scope` / `presence` / `tools` / `actions` / `more`）+ `ScopePill`、`ViewTabs`（`@adminui/react/views`）、`BitableGrid`（`toolbarLeading={<SplitButton …/>}`、`banner={<ViewOverrideBar …/>}`）或 `KanbanBoard` / `GalleryView` / `CalendarMonth` / `GanttView`。
- **手机（≤ 760px）**：图标栏变底栏（≤ 4 个模块 + 「更多」，当前模块总在栏里），目录变左侧抽屉（标题栏左端「打开目录」，选一行自动收回），标题栏只留表名、胶囊图标和主按钮。
- **演示 / starter**：`design/templates/t15-workspace.png` · 「T15 表格工作区」（`#template=t15`）

```tsx
<RailShell brand="A" modules={MODULES} activeModule="table" onModuleChange={go} footer={[notice, settings]} account={{ name: "小王", menu }}
  sidebar={<NavTree title="智能家居业务" subtitle="华南子公司" icon={<Table2 />} nodes={tree} activeId={tableId} onSelect={openTable} search="搜索数据表、仪表盘" createMenu={create} />}>
  <WorkspaceTitleBar title="客户" description="…" favorite={star} onFavoriteChange={setStar}
    scope={<ScopePill value={line} options={lines} onChange={switchLine} />} presence={viewers}
    tools={<IconButton label="评论"><MessageSquare /></IconButton>} actions={<Button size="sm"><Share2 />分享</Button>} more={more} />
  <ViewTabs views={views} activeId={viewId} onSelect={setViewId} onCreate={createView} />
  <BitableGrid caption="客户" rows={rows} getRowId={(r) => r.id} fields={fields} view={view} onViewChange={onViewChange}
    toolbarLeading={<SplitButton label="添加记录" icon={<Plus />} onClick={add} sections={addWays} />}
    banner={<ViewOverrideBar base={shared} view={view} fields={fields} onReset={reset} />} />
</RailShell>
```

## T16 公开页

- **什么时候用**：不用登录、从链接打开的页面——填表单、提交成功、访客看分享的记录、手机密码门、一次性密钥、「链接已失效」。
- **骨架**（样稿 D18 / D18m / D18s / D21 / D21m / D21s）：**没有后台外壳**。填表 / 结果页：品牌条（logo + 名字 + 一行灰字；右端「已填 4 / 7 题」）+ 居中一栏（填表 688、提交成功 560、其他结果页 440）+ 标题（公开页显示标题）+ 「带 * 的是必填」+ 一两行说明 + 题目 + 整宽提交按钮 + 底部一句说明；结果页 = 大圆状态图标 + 标题 + 下一步 + 灰色时间 + 提交内容摘要 + 「再填一份」。访客页 / 密码门 / 一次性密钥用分享套件的 `SharedPageShell`。
- **手机**：一栏整宽、卡片去边框，品牌条带进度吸顶；按钮、输入框 ≥ 44px（`--aui-control-height-touch`，`.aui-public` 外框自动套用）。不画插画、不用装饰渐变；品牌条是白底（标志方块 + 名字 + 小字）+ 右上「已填 2 / 5 题」+ 带底一条细进度线。登录页用 `AuthLayout` + `LoginForm`（居中 420，按钮一直能点、点了再校验）。
- **组件**：填表单直接用 `PublicForm`（`@adminui/react/forms-public`，自带品牌条、居中一栏、手机吸顶进度、上传 / 录音、验证插槽），提交成功用 `FormSuccess`（摘要 `formSummary`）；不是表单的公开页（链接已失效、已撤回、自定义内容）用 `PublicPageLayout`（`brand` / `brandNote` / `title` / `aside` / `description` / `progress` / `width` / `footer`）+ `PublicResult`（`tone` / `title` / `description` / `meta` / `children` / `actions` / `note`）；访客页 `SharedPageShell` + `SharedRecordCard`，密码门 `PasswordGate`，密钥 `SecretReveal`。
- **演示 / starter**：`design/templates/t16-public-form.png` · 「T16 公开页」（`#template=t16-form` / `t16-success` / `t16-expired` / `t16-visitor` / `t16-password`）

```tsx
<PublicForm form={form} fields={fields} answers={answers} onAnswersChange={setAnswers} brand={<FormBrand logo="A" name="Acme" subtitle="智能家居" />}
  footer="由 Acme 多维表格 提供 · 你的信息仅用于联系你" upload={upload} captcha={<Slider />} captchaDone={passed} onSubmit={send} />

<FormSuccess brand={brand} message="顾问会在 1 个工作日内联系您" meta="官网咨询表单 · 10-05 14:32 提交"
  summary={formSummary(form, fields, sent, visibleFormQuestions(form, fields, sent))} onFillAgain={again} footer={footer} />

<PublicPageLayout brand={brand} width="narrow" footer={footer}>
  <PublicResult tone="warning" title="这个表单已停止收集" description="想联系顾问，请拨打 0800-123-456" note="可以关闭这个页面了" />
</PublicPageLayout>
```

## T17 看板搭建器

- **什么时候用**：用拖组件的方式搭东西：看板直接用 `DashboardBuilder`（`@adminui/react/dashboard-builder`，自带下面整套骨架）；以后的表单编辑器、报表编辑器还没有现成搭建器时，用 `BuilderLayout` 这个框架自己拼。
- **骨架**（样稿 D32）：`RailShell`（不带目录）里放 `DashboardBuilder`（或 `BuilderLayout`）：一行工具条（图标 + 名字 ✎ · 范围「我的看板」· 「N 处修改未保存」· ? 数据范围说明 ‖ 撤销 / 重做 · 预览 · 取消 · 另存为我的 · 保存）→ 看板筛选行（不套卡、一行：时间 · 对比 · 组 · 人 · + 筛选字段 · 改过才出的重置）→ 三栏：左 248 组件库（搜索 + 图表类型 3 列 + 标准组件 · 口径来自指标字典；可收成 56 图标栏）| 画布（6 列 × 行高 28，自己滚）| 右 320 选中组件的设置（数据 / 样式；没选中不出右栏）。**整页不滚**；≤ 900px 三栏上下排。
- **组件**：看板 = `DashboardBuilder`（`value` / `filterBar` 放 `DashboardFilterBar` / `loadWidgetData` / `sources` / `metrics` / `templates` / `scopeLabel` / `permissionNote` / `onSave` / `height="100%"`），放进 `RailShell` 后贴边铺满。别的编辑器用 `BuilderLayout`（`title` / `onTitleChange` / `icon` / `badges` / `notice` / `history` / `actions` / `filters` / `library` / `config`），两侧用 `Pane` + `PaneSection`；筛选行用 `SegmentedControl` / `Choice` 或 `DashboardFilterBar`。
- **演示 / starter**：`design/templates/t17-dashboard-builder.png` · 「T17 看板搭建器」（`#template=t17`；框架 `BuilderLayout` 单独看 `#template=t17-frame`）

```tsx
<RailShell brand="A" modules={MODULES} activeModule="home" onModuleChange={go}>
  <DashboardBuilder value={schema} filterContext={filters} filterBar={<DashboardFilterBar … />} loadWidgetData={load}
    sources={SOURCES} metrics={METRICS} templates={TEMPLATES} scopeLabel="我的看板" permissionNote="你只能看到你有权限的数据：一组 5 人"
    onSave={save} onCancel={cancel} height="100%" />
</RailShell>

{/* 还没有现成搭建器的编辑器：BuilderLayout 框架 */}
<RailShell brand="A" modules={MODULES} activeModule="home" onModuleChange={go}>
  <BuilderLayout title={name} onTitleChange={rename} icon={<LayoutDashboard />} badges={<Tag>我的看板</Tag>}
    notice={<><Shield />你只能看到你有权限的数据：一组 5 人</>} history={{ canUndo, canRedo, onUndo, onRedo }}
    actions={<><Button variant="outline"><Eye />预览</Button><Button variant="outline">取消</Button><Button>保存</Button></>}
    filters={…} library={<Pane title="添加组件">…</Pane>} config={selected ? <Pane title="组件设置">…</Pane> : null}>
    {canvas}
  </BuilderLayout>
</RailShell>
```

## 6.0 新增的块和布局（速查）

| 组件 | 一句话 |
|---|---|
| `StatStrip` | 一张卡一排 4–6 个数（图标标签、值 + 单位、一行说明、可带注意 / 异常色），标题行可放按钮 |
| `TodoInbox` | 待办卡：数量、「?」、带数量的分段筛选、每条 ≤2 个按钮、「没问题的」小标签、空状态 |
| `ActionList` | 一行一条：图标块 / 头像 · 标题 + 灰字 · 状态 · 时间 · 操作（`buttons` 实心 + 描边 ≤2，`inline` 幽灵按钮 ≤3），`dense` 一行动态，`wrap` 灰字换行 |
| `QuickLinks` | 常用入口的图标方块网格 |
| `PresenceList` | 此刻在线：一排小计数 + 每人一行 + 状态 |
| `BarList` / `RatioBar` | 占比 / 排行的条形列表；表格格子里的小比例条 |
| `InfoList` | 窄栏里的「图标 · 名称 … 值」小行 |
| `ChoiceTiles` | 2–4 个大选项的单选方块（方向键可切） |
| `ChangeMark` | 改过、还没保存的浅色框 |
| `SaveBar` | 未保存改动条：`sticky`（设置页底部浮起）/ `inline`（矩阵下方） |
| `SearchField` | 图标在框里的搜索框（`size="sm"` 放标题行） |
| `SelectList` | 列表详情页的左栏：搜索、分组标题、选中高亮、未读小点 |
| `Pane` / `PaneSection` | 工作区的一栏（标题行、提示条 `notice`、自己滚的主体、底栏；`padding="sm" \| "md"` 给松散内容留边，`fill` = 上下几块、最后一块撑满自己滚，窄屏上下排时长到外壳内容区底；主体里直接放 `Tabs` 时标签条贴边、面板里照样贴边；根元素收 `ref` 和 `aria-*` / `data-*` / DOM 事件）；栏里的小节（`flush` = 列表贴边 + 浅色标题条） |
| `SplitLayout` | 主栏 + 右栏（默认 340），1100px 以下上下排 |
| `SideNavLayout` | 设置页：左分节导航（滚动高亮、改动小点）+ 右分节卡 + 底部保存条 |
| `ListDetailLayout` | 左列表（默认 260）+ 右内容，放在 `Panel flush` 里 |
| `WorkspaceLayout` | 整屏三栏工具页，页面本身不滚；窄屏上下排贴边（默认 `"flush"`），`narrow="steps"` 手机上列表 → 详情两步走 |
| `WizardLayout` | 向导（贴边，内容最宽 880）\| 右侧 260 一栏 |
| `GraphLayout` | 关系图 / 监控墙：标题行 + 图例 + 画布 + 右侧详情 |
| `LogTimeline` | 按天分组的一行一条日志，展开看改前改后，加载更多；手机上每条拆成几行、不横着滚 |
| `WorkItemCard` / `WorkItemList` | 工作项卡片（步骤、进度、动态、操作、等人确认） |
| `ChatThread` / `ChatMessage` / `ToolCallCard` / `Composer` | 对话、工具调用、输入框 |

已有组件的小扩展：`Pane` 加 `padding` / `fill` / `notice`、根元素收 `ref` 和标准 DOM 属性 / 事件，`QueryBar` 加 `variant`（`flush` / `bare`），`GridToolbar` 的 `features` 加 `rowHeight`；`Panel` 加 `count`（标题后灰字或 `LiveStatus`）和 `flush`（内容贴边）；`ResourcePanel` 加 `unit`（「38 台」）；`TabbedPage` 分区加 `icon` / `count` / `countTone`；`Tabs` 的 `countTone` 加 `attention`；`FormField` 加 `changed`；`FormSection` 的 `title` 可省；`Meter` 加 `tone`；`Steps` 加 `size="sm"` / `tone="attention"` / `stretch`。
