# 视图：标签、看板、画册、日历、甘特（可选子路径 `@adminui/react/views`）

多维表格样稿里表格之外的视图，标准化成通用组件：D01 / D16 视图标签和视图管理、D06 看板、D07 画册、D09 / D09b 日历、D10 甘特和甘特设置。starter「系统 → 视图」有照样稿摆的完整示例（`examples/starter/src/ViewsShowcase.tsx`），浏览器验收 `npm run test:views`（截图在 `test/artifacts/views/`）。

```ts
import { ViewTabs, ViewManager, KanbanBoard, GalleryView, CalendarMonth, CalendarWeek, GanttView, GanttSettings } from "@adminui/react/views";
import "@adminui/react/styles.css"; // 已经引过就不用再引
```

## 0. 共同约定

- **只做界面，数据源无关**：记录由宿主按当前视图筛好、排好、分好组再传进来；改动（换列、改日期、改顺序、视图增删改）都走回调，**先显示后保存，回调 reject 就放回原处**并读屏播报原因。服务端照样校验权限。
- **字段就是表格的字段**：`fields: GridField<T>[]`（和 `@adminui/react/grid` 的 BitableGrid 共用一份），卡片 / 列表里的值用表格同一套格子渲染（标签、人、日期、金额看起来一模一样）。
- **颜色只有选项 10 色**（`green · teal · blue · violet · pink · red · orange · yellow · olive · gray` 和各自的实心）：看板列、日历事件、甘特条都跟单选字段选项的 `tone` 走；任意 CSS 颜色一律显示灰。
- **records / events / groups 用 `useMemo` 保持引用**：组件只在引用变了时重新摆放并丢掉「正在保存」的乐观状态，宿主每次渲染都新建数组会让刚拖过去的卡片闪回。
- **一周从周几开始、节假日 / 调休都是参数**：`weekStart`（默认周一）、`workCalendar: { weekend?, holidays?, workdays? }`。**SDK 不带任何地区的日历**，宿主自己给：按租户 / 用户所在地区从服务端取当年的假日表，合成 `{ holidays: { "2026-10-01": "国庆日", … }, workdays: { "2026-10-10": "国庆调休" } }` 传给日历和甘特。值就是显示的名称——月历格子写「休 国庆日」、周视图表头写「国庆日」、甘特表头写「休」（悬停出名称）并画斜纹，补班日写「班」；值为空字符串时显示「休息日」/「调休上班」。
- **今天 / 现在一律主色**（不用异常红）：月历今天的数字、周视图「现在」线和时间牌、甘特今天线和表头日期牌。日历事件、甘特条一律**选项软底**（实心选项也显示它的浅色，`softTone`）。
- 键盘全可用，浅 / 深色，390px 手机：看板横滑吸附，月历 = 小格 + 彩点 + 当天日程（没有周 / 日视图），甘特变带进度小轨道的列表，页面不横向溢出。
- **视图上面的工具栏**用表格的 `GridToolbar`（`@adminui/react/grid`），传 `features={{ rowHeight: false }}` 去掉「行高」（这些视图没有行）；和表格一样固定一行：快捷筛选（`quickFilters`）在右边、搜索可收成图标（`searchMode="icon"`）、少用的进「⋯」（`more`），见 GRID.md §8.2；放进工作区的 `Pane fill` 时工具栏在上、视图撑满自己滚，画册自动离栏边 16px（AI-RULES 附录 R），不要再包一层 `padding: 16` 的 div。

## 1. 视图标签 `ViewTabs` 和视图管理 `ViewManager`（D01 / D16）

```tsx
<ViewTabs
  views={views}                    // ViewSummary[]：{ id, name, kind, tier: "standard" | "shared" | "mine", mustSee?, hidden?, modified? }
  activeId={active}
  onSelect={setActive}
  tabMenu={(v) => sections}        // 当前标签的 ⋯，也是右键 / Shift+F10 菜单
  onCreateView={({ kind, name, audience }) => …}   // 「+」→ 新建视图：6 张类型卡 + 名字 + 给谁看
  createAudiences={["mine", "shared"]}             // 有「共享给一组」的权限才给 "shared"
  createNote="建好后从当前视图带上筛选和排序"
  onRename={(id, name) => …}       // 双击「我的」视图（或 F2）就地改名
  manager={<ViewManager views={views} activeId={active} tierNotes={{ standard: "林经理维护", shared: "一组 · 周组长建", mine: "只有你看得到 · 数量不限" }}
    onSelect onReorder={(tier, ids) => …} onHiddenChange onRename onDuplicate onDelete onCreate />}
/>
```

- **一行**：视图标签 → 「+」新建 → 右侧「视图」（视图管理）+ 宿主的 `trailing`（仪表盘组）。没有「视图 ▾」按钮；快捷筛选（公海 / 我跟进中的 / 停滞）不放在标签行，放到工具栏右边（`GridToolbar quickFilters`）。
- 标签 = 类型图标 + 名字 + **档位记号**（标准 = 小锁、共享 = 两个人、我的 = 不加），不再有带框的「标准 / 共享」字；当前 = 加粗 + 2px 主色下划线 + ⋯。`modified: true`（用户改了标准 / 共享视图的筛选等，只对自己生效）时标签上一个注意色小点，同时在标签下面放 `ViewOverrideBar`（GRID.md §8.5）。
- 标签按 标准 → 共享 → 我的 排，隐藏的不出现（必看的总在）；放不下的进「更多 N」（按 标准 / 共享 / 我的 分组，最下面「管理视图…」），当前视图总留在栏里。
- 手机（≤ 760px）：所有标签一行横滑（两边渐隐，当前标签滚到中间），没有「更多」；`trailing` 收进「视图」面板，视图管理和新建视图是底部弹层。
- 新建视图：`NewViewPanel`（6 张类型卡，每张一句用途 `VIEW_KIND_HINTS` + 名字 + 「只有我 / 共享给一组」）；只给旧的 `onCreate(kind)` 时只有类型卡，`onCreate` 第二个参数也能拿到草稿。
- 视图管理 380 宽：搜索（超过 6 个视图时）+ 三档小标题写谁维护，每档拖动 / Alt+↑↓ 排序（`policy.canReorder === false` 锁住，搜索时不能拖）；眼睛悬停才出、隐藏的变灰划线（必看的眼睛禁用并写原因）；⋯ = 重命名 · 复制一份 / 复制为我的视图 · 从标签栏隐藏 · 删除视图（自带 ConfirmDialog，压在一切弹层之上）；底部「+ 新建视图」（在 ViewTabs 里打开同一个新建面板）+「拖动排序只改你的标签栏」。
- 谁能改什么：`viewActions(view, { canManageStandard, canManageShared })`；普通人改标准 / 共享视图的筛选、分组、排序时，显示 `ViewLockNotice`（「复制为我的视图」）。

## 2. 记录卡片 `RecordCard`

```tsx
<RecordCard record={r} title={r.name}
  tags={[stageField, productsField]}       // 标签行：单选 / 多选值 = 10 色软标签 20px，最多 3 个 +「+N」
  keyline={[amountField, regionField]}     // 关键数行：金额 / 数字加粗等宽 · 其余用「 · 」接上，一行省略
  owner={ownerField} due={nextField} comments={(r) => r.commentCount}   // 底栏：头像 + 名字 | 评论数 + 下次跟进
  today="2026-10-07" timeZone="Asia/Shanghai" locked={!canMove(r) && "成交只有主管能换阶段"}
  attachments={r.files} onOpen={() => open(r)} onOpenCover={(i) => lightbox(r, i)} />
```

- **五个固定位**：封面（可选，16:10；紧凑 4:3）→ 标题（14px 加粗，最多两行）→ 标签行 → 关键数行 → 底栏。**没填的字段不占行**（不画「—」）；底栏「下次跟进」：今天 = 注意色「今天」、逾期 = 异常色「逾期 N 天」、明天「明天」、其余灰「10-14」（纯函数 `dueState(value, today, timeZone)`）。
- 默认**不显示字段名**；`showLabels`（卡片设置「显示字段名」）把标签 / 关键数 / `fields` 变成两列对齐的「字段名 · 值」。`fields` 是额外的行（只写值，空的跳过）。
- 封面 = 标了 `cover` 的，否则第一张图片 / 视频，否则第一个；**这条没图 = 中性底 + 图标**，不写字、不画插画；右下角「图 N」（`coverBadge="count"`）或圆点（`"dots"`）。点封面开大图（`onOpenCover`），点别处开详情（`onOpen`，整张卡一个点击目标）。
- 状态：圆角 8、内边距 10 × 12；平时只有 1px 线；悬停边加深 + 轻阴影 + 右上角「展开」（`onExpand`，默认同 `onOpen`）；键盘聚焦 / 选中（`selected`）= 主色边 + 输入框同款 3px 光圈；`dragging` 微倾 + 深阴影；`ghost` 35% 透明；`locked` 标题右边小锁（字符串 = 悬停原因）；`loading` 骨架卡。
- 视图把同一套字段传给每张卡：`cardSlots: RecordCardSlots<T>`（`{ tags, keyline, owner, due, comments }`，KanbanBoard / GalleryView 都收）。

## 3. 看板 `KanbanBoard`（D06）

```tsx
<KanbanBoard records={rows} recordId={(r) => r.id} groupField={stageField} cardTitle={(r) => r.name} cardFields={fields}
  cardAttachments={(r) => r.files} label="阶段看板"
  columnMeta={{ first: { total: 128, hasMore: true, loading } }} onLoadMore={(value) => …}
  onMove={(recordId, toValue, beforeId) => api.move(…)}   // toValue = 选项值，「未设置」是 null；beforeId = 落点下面那张（null = 列尾）
  onOpen={(r) => …} onAdd={(value) => …} />
```

- 卡片 = `RecordCard` 五个固定位：`cardSlots={{ tags, keyline, owner, due, comments }}`（按阶段分组时标签行不要再放阶段）；不显示字段名（`showLabels` = 卡片设置「显示字段名」）；看板默认不显示封面（`cardAttachments` 只在设置了封面字段时给）。
- 列 = 单选字段的选项和色调：宽 280、圆角 12、浅底无边框；列头 = 10 色软标签 + 条数 + **金额合计**（`columnMeta[key].summary` 服务端整列合计，或 `sumField` 按已加载的卡片求和），＋ 和 ⋯ 悬停才出。值为空或不在选项里的进「未设置」——**没有记录就不显示**，有记录时默认收起成 44px 竖条。列 ⋯：收起这一列 · 列颜色（`OptionSwatchPicker`，也回调 `onColumnToneChange`）· 在这一列新建 · 隐藏这一列（「隐藏的列」恢复）。`columnState` / `onColumnStateChange` 可受控保存。空列写「拖卡片到这里，或点 + 新建」；加载用骨架卡（不转圈）；没加载完的写「还有 N 条 · 滚到底自动加载」。
- 拖卡片：卡片微倾 + 深阴影，原位置半透明；落点虚线框「松开放到「谈判」」；**底部居中提示条**「阶段：报价 → 谈判 · Esc 取消」（不压在卡片上）；放下后提示「阶段：报价 → 谈判」带「撤销」（`undo`，默认开，需要 NotificationProvider）。靠边自动滚，Esc 取消。键盘：Alt+←/→ 换列，Alt+↑/↓ 列内移动，Shift+F10「移到…」。`canMove(record)` 锁住个别记录：标题右边小锁，按住时提示条写 `lockReason(record)`（「成交只有主管能换阶段」）。
- 每列自己滚动，滚到底自动 `onLoadMore`（按钮留给键盘）；还有列在右边时边缘渐隐 + ‹ › 翻页。手机：顶部列切换胶囊（带条数），一列 86% 宽横滑吸附。
- `selectedId`：右侧抽屉里正打开的那张卡片高亮（§9）。

## 4. 画册 `GalleryView`（D07）

```tsx
<GalleryView records={rows} recordId={(r) => r.id} cardTitle={(r) => r.name} cardSlots={slots} label="客户相册"
  cardAttachments={(r) => r.files} coverFields={imageFields /* 表里的图片 / 附件字段 */} coverField={view.coverField} onCoverFieldChange={…}
  density={density} onDensityChange={…} showLabels={labels} onShowLabelsChange={…} today={today} timeZone="Asia/Shanghai"
  total={168} hasMore loading={loading} onLoadMore={…} filterText="阶段 = 成交 · 区域 = 广州" onClearFilters={clear} onOpen={…} />
```

- 内容区顶部一行：条数 · 排序说明（`summary`，默认「共 N 条」）| 封面字段下拉（含「不显示封面」）| 紧凑 / 常规 | 字段名开关。网格自动列宽：最小 236（紧凑 184），间距 16；手机 2 列，不写字段名、负责人只留头像。
- **没有图片字段时默认「不显示封面」**：`coverField` 不传时用 `defaultCoverField(coverFields)`（`coverFields` 为空 = 不显示；也接受 GridField 列表，取第一个 `attachment` 字段）；有图片字段但这条没图 → 中性底 + 图标。只传 `cardAttachments`、不传 `coverFields` 的老用法照旧显示封面。
- 点封面开 `MediaLightbox`（`lightbox` 传下载 / 新窗口回调，或 `onOpenCover` 换成宿主的查看器）；点卡片开记录。
- 筛选无结果（`filterText` 或 `onClearFilters`）：空状态写当前筛选 +「清空筛选」；加载中在末尾放骨架卡，`total` 时写「已显示 20 / 168」；`hasMore` / `onLoadMore` 滚到底自动加载。

## 5. 月历 `CalendarMonth`（D09）

```tsx
<CalendarMonth events={events} date={day} onNavigate={setDay} label="跟进日历" timeZone="Asia/Shanghai" weekStart={1}
  workCalendar={{ holidays: { "2026-10-01": "国庆日" }, workdays: { "2026-10-10": "国庆调休" } }}   // 宿主按地区给，见 §0
  mode={mode} onModeChange={setMode}          // 工具栏的 日 / 周 / 月（手机上只有月）
  legend={{ title: "按「阶段」着色", items }}  // 右上角：彩点 + 说明
  undated={items} undatedHint="拖到日历上某一天 = 设「下次跟进」"   // 「无日期 N」抽屉，拖到某天 → onDateChange(id, "2026-10-20", null)
  onCreate={(day) => …}                        // 格子右上角 ＋ / 双击空白 / Enter：就地新建，日期填好
  onDateChange={(id, start, end) => …} onOpen={(id) => …} onClearDate={(id) => …} eventMenu={(e) => sections} />
```

- 事件 `CalendarEvent`：全天 = 日期键（`"2026-10-13"`，`end` 含当天）；定时 = ISO 瞬间（按 `timeZone` 落到哪天几点）；`tone`、`badge`（事件卡里的选项标签）、`details`（事件卡字段行）、`editable: false` 不能拖。
- **全天 / 跨天 = 选项软底条**，跨周拆段、续段前面带「‹」；**定时 = 色点 + 时间 + 标题，不铺底**。每格最多 3 行 +「+N 更多」（另起一行），点开列出这天全部。
- 周末和宿主假日浅底，假日写「休 国庆日」、补班「班」；今天 = 主色圆底数字 +「今天」。
- **点事件出事件卡**（选项标签 · 时间 · 字段行；主按钮「打开详情」+「清除日期」；Esc / 点外面关），**双击直接开详情**（`onOpen`）。
- 拖事件到另一天（保留时长和钟点）；Alt+←/→ 一天、Alt+↑/↓ 一周；日子格方向键移动，Enter 调 `onCreate(day)`。
- 无日期抽屉 300 宽：搜索 + 40px 行（拖柄 · 名字 · 阶段标签），拖到某一天 = 设日期（`onDateChange(id, day, null)`，宿主决定几点）；键盘：右键 / Shift+F10「放到今天 / 选中的那天」。
- 窄于 `agendaBelow`（默认 560px，手机）：月历缩成小格 + 彩点（最多 3 个），下面是选中那天的日程（44px 行）；工具栏没有 日 / 周。

## 6. 周 / 日 `CalendarWeek`（D09b）

同 §5 的参数，另有 `days`（7 / 1，或由 `mode` 决定）、`hourHeight`（52）、`step`（30 分钟）、`startHour`（打开时滚到 8 点）、`onCreate(startIso, endIso)`（在空白处拖出一段 / 双击空白）、`now`、`agendaBelow`（560）。表头写周几 + 日子（今天主色圆牌）+ 假日名称；全天栏放全天 / 跨天事件，**最多 2 行 +「+N 更多」**，左边 ⌄ 展开全部；定时块 = 选项软底 + 同色细边，重叠的并排；**「现在」= 主色线 + 主色时间牌**。点事件出事件卡、双击开详情（同 §5）。**上下拖改时间、左右拖换天**，拉底边改时长，都有虚线预览和时间；**手机（窄于 `agendaBelow`）没有周 / 日视图**：显示 §5 的手机月历，并 `onModeChange("month")` 让宿主切回月；右键 / Shift+F10 菜单 = 打开详情 · 提前 / 推后 30 分钟 · 清除日期 + `eventMenu`；Alt+↑/↓ 30 分钟，Alt+Shift+↑/↓ 改时长，Alt+←/→ 换天（全天 / 跨天条也是，菜单有「提前一天 / 推后一天」）；传了 `onCreate` 时日子列是一个 Tab 停点，←/→ 换天、Enter 在可见区第一格新建。不到 15 分钟的事件显示时拉到 15 分钟高，但移动 / 改时长按真实结束时间。改完 `onDateChange(id, startIso, endIso)`。

## 7. 甘特 `GanttView`（D10）

```tsx
<GanttView fields={fields} groups={groups /* 宿主分好的 ≤ 2 级 GanttGroup[]，或 records */} recordId={(r) => r.id} label="安装排期"
  config={{ startField: "installStart", endMode: "field", endField: "installEnd", workdaysOnly: true, titleField: "name",
            extraFields: ["owner"], listFields: ["name", "installer", "phone", "installStart", "installEnd"], colorField: "stage", scale: "month" }}
  workCalendar={calendar} timeZone="Asia/Shanghai" milestones={[{ day: "2026-10-18", label: "样板间开放日" }]}
  onDateChange={(id, { start, end, duration }) => …} canEdit={(r) => …} onOpen={(r) => …} onAddRow={() => …} />
```

- `endMode`：`field`（结束日期字段）/ `duration`（工期数字字段，天）/ `fixed`（`fixedDays`）；`workdaysOnly` 时工期跳过周末和宿主节假日、补班日照常算，条上休息日画斜纹，悬停提示写「6 个工作日（含 1 天休息日不计）」。工期按工作日算的 `duration` / `fixed` 整条移动时保持工作日数（跨周末顺延）；`fixed` 没有两端拖柄，Shift / Alt+←/→ 不改两端。
- 刻度 周 / 两周 / 季 / 年（`GanttScale` 的值仍是 `week` / `month` / `quarter` / `year`，存过的 `scale: "month"` 就是「两周」）。
- **默认只看两周，左侧字段拿剩下的宽度**：「两周」刻度正好显示 `visibleDays`（默认 15）天，从锚点前 2 天开始（「今天」在第 3 列），一天 36px；时间轴之外的宽度都给左侧字段列表（最少 320、最多约 880px），左侧各列按类型和表头字数定基准宽、随左侧变宽按比例变宽，1440 屏五六列字段都完整显示。容器窄了先把一天压到 28px，再把左侧压到 320px，再窄时间轴少放几天；窄于 `listBelow` 变列表。「周」刻度在同样的时间轴里放 7 天（左侧宽度不随刻度变），「季」/「年」照旧按刻度铺满。‹ › 在「两周」上一次翻 `visibleDays` 天，「周」7 天，「季」/「年」一季 / 一年；标题跨月写「2026 年 9 – 10 月」。
- **左侧宽度谁说了算**：宿主传 `listWidth`（受控）或用户拖过分隔条 / 用 ←/→ 调过，就按那个宽度，时间轴按一天 36px（周 56、季 8、年 2.4，`GANTT_DAY_WIDTH`）能放几天放几天；双击分隔条回到默认分栏（不受控时）；« 收起左侧时时间轴同样铺满。纯计算在 `ganttFrame` / `ganttAutoSplit`（`GANTT_SPLIT` 是这些数字），宿主自己画别的排期时可以复用。
- **条形 = 选项色软底 + 同色细边 + 深色字**（标题加粗，其余字段细一号）；放不下的字挪到条形右边、带面板底色（今天线不穿过），靠右边界时挪到左边（`barTextPlace`）。**今天 = 主色 2px 线 + 表头主色日期圆牌**；周末浅底、宿主假日斜纹 + 表头「休」（悬停出名称），补班「班」。
- 窗口外的记录只在当行边缘放一个「09-28 → 09-30」小牌，点一下跳过去（条的开始落在第 3 列）；跨窗口边的条被裁平那一头（虚线边）。
- 拖条形整体移动；先点选再拖两端改开始 / 结束；键盘 ←/→ 移动一天，Shift+←/→ 改结束，Alt+←/→ 改开始，Enter 打开。`onDateChange` 给的 `duration` 按工作日或自然日（看 `workdaysOnly`）。
- 条上文字 = 标题 + 最多 `GANTT_MAX_EXTRA`（2）个字段，没配额外字段时写天数；`barText` 可整个换掉。分隔条可拖、←/→ 调宽、双击复原，« 收起左侧。两侧行悬停同步。
- 几百行内直接画；更多行请服务端分页或按分组懒加载。窄于 `listBelow`（640px，手机）变按分组的列表：标题 + 选项标签、「09-28 → 10-02 · 5 天」+ 负责人、当前窗口的进度小轨道（带今天线，`ganttTrack`）。
- 颜色依据：`colorField`（单选字段的选项色调）→ `colorRules`（「按条件」：和 BitableGrid 填色同一个规则模型 `GridColorRule`，条件树 + 选项 10 色，从上到下第一条符合的生效，只看整行规则；「我」/ 相对日期按 `conditionContext` 解析）→ 统一主色。卡片 / 日历要同样着色时用 `viewRecordTone(record, fields, { colorField, colorRules }, context)`。

## 8. 设置面板（D06 卡片设置 / D09 日历设置 / D10 甘特设置）

三个面板**同一个骨架**：标题行（面板名 · 视图名 + 标准 / 共享）→ 分节小标题 → 左 96px 标签、右控件 → 底栏。都是受控的面板内容，放进工具栏按钮下的 `PopoverPanel`（给 `sheet`：手机上是底部弹层，底栏固定），底栏放 `ViewSettingsFooter`：

```tsx
<PopoverPanel open={open} anchor={button} onClose={close} title="甘特设置 · 安装排期（标准视图）" width={780} sheet
  footer={<ViewSettingsFooter changes={countSettingChanges(shared, mine)} onReset={…} onSaveAsNew={…} onSaveForAll={canManage ? … : undefined} />}>
  <GanttSettings fields={fields} value={settings} onChange={setSettings}
    calendars={[{ id: "cn", label: "中国大陆" }, { id: "sg", label: "新加坡" }]} timeZones={[{ value: "Asia/Shanghai", label: "(UTC+08:00) 上海" }]} />
</PopoverPanel>
```

- 底栏：左边没改 =「改了只对你生效」，改了 = 注意色小点「已改 1 处，只对你生效」（`changes`，用 `countSettingChanges(shared, mine)` 算）；右边 恢复（没改时禁用）· 另存为新视图 · 保存给所有人（只给有维护权限的人传 `onSaveForAll`）。
- `FieldOrderPicker`：拖柄 + 类型图标 + 名字 + 眼睛（中性色，不是一列绿），主字段锁在第一个。`CardSettings`：`preview`（**实时预览卡**：宿主用当前设置画一张 `RecordCard`）→ `before`（看板的「分组」节：分组字段 + 隐藏空列）→ 卡片（封面 · 密度 · 显示字段名，默认关）→ 卡片上的字段。`CalendarSettings`：开始 / 结束日期字段、颜色依据、一周开始、节假日日历。`GanttSettings`：时间（开始、结束方式、只算工作日、节假日日历、补班日、时区、默认刻度）+ 分组（≤ `maxGroupLevels` 3 级、拖动、顺序、显示空分组）+ 显示（条形标题、条上额外字段 ≤ 2、左侧字段、颜色依据（按单选字段 / 按条件 / 统一颜色；「按条件」里就是表格填色面板的规则列表，只按整行）、里程碑字段）。分组层级 `ViewGroupLevel` 就是表格的 `GroupLevel`（`asc` / `desc`；单选字段 `asc` = 按选项顺序、`desc` = 倒序），存过的旧值 `order: "option"` 读成 `asc`。
- 「改了只对你生效」：个人调整由宿主存成个人设置，有权限的人「保存给所有人」。节假日日历和补班日由宿主合成 `WorkCalendar` 传给日历 / 甘特。

## 9. 从视图打开记录：记录展开框

从看板 / 画册 / 日历 / 甘特点开一条记录，**默认右侧抽屉**：`RecordDetailDialog frame="drawer"`——640 宽、贴右边铺满高、**没有遮罩也不模糊**，左边的视图照样能点（点别的卡片直接换人，被打开的卡片在视图里高亮：看板 `selectedId`），↑ ↓ 上一条 / 下一条，Esc 关。抽屉 / 居中弹框（`frame="dialog"`，遮罩只用 overlay 半透明色）/ 整页是**同一个外框**，给了 `onFrameChange` 标题栏右侧三档随时切（`"page"` 由宿主跳到记录自己的地址）。表格里点「展开」仍可以用弹框。

```tsx
<RecordDetailDialog layout={layout} row={open} level="expanded" frame={frame} onFrameChange={(f) => f === "page" ? go(f) : setFrame(f)}
  nav={{ index, total, label: view.name, onMove: (d) => setOpen(rows[index + d]) }}   // 标题栏「8 / 13 · 按阶段」
  onCopyLink={copy} frameMenu={sections} onClose={() => setOpen(undefined)} recordKey={open?.id} />
```

- 外框标题栏（`RecordFrameBar`）只放外框的事：左 ↑ ↓ +「8 / 13 · 按阶段」，右 复制链接 · ⋯ | 三档 | ×；关注、记跟进这些业务按钮在详情头部。
- 内容 = 记录详情 C 卡片分区（`layout.cards`）；抽屉里自动单栏、指标 2 × 2。手机：全屏从下面滑入。

## 10. 不要做

- 不在项目里手写看板 / 日历 / 甘特 / 视图标签；缺东西回流 SDK。
- 不给事件、条形、列写任意颜色；不画装饰插画当封面。
- 不在 SDK 里放节假日数据；不在浏览器里判断谁能改标准视图（`viewActions` 只决定界面，服务端校验）。
