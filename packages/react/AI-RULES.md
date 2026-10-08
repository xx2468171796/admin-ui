# adminUI：AI 写后台页面的规则

适用于所有用 `@adminui/react` 的管理后台（含 Go / Rust + SQLite 单服务工具），不约束玩家前台。可用符号以 `@adminui/react/catalog` 为准，不按记忆猜 import。

**界面会被自动检查**：项目 verify 里跑 `admin-ui-audit`（原生控件、写死颜色、装饰色条、改 SDK 样式、操作列、介绍段落、页面大标题、没用模板），走样的页面过不了门禁；规则和忽略注释见 `npx admin-ui-audit --help`。

## 按项目规模起步

| 项目规模（project-design） | 默认从哪档起步、按需再加 | 装哪些子路径 | 起步样板 | 首屏预算（gzip） |
|---|---|---|---|---|
| small 小工具 | 只用核心入口：token、主题、基础与表单组件、`DataTable`、`Dialog`、提示、布局、`AdminShell`；不带重依赖 | 无（`@adminui/react` + `styles.css`） | `examples/small`；Go / Rust 单服务静态构建走 `examples/single-service` | ≤ 72 KB JS（不含 react，含 react ≈ 127）/ ≤ 32 KB CSS |
| medium 中型 | 核心 + 用到才加的子路径 | 按页面需要加 `grid` / `views` / `charts` / `form-builder` / `access` / `markdown` / `excel` …，重的懒加载 | `examples/starter` | ≤ 300 KB JS（含 react）/ ≤ 40 KB CSS |
| large 大型 | 全部，重的懒加载 | 全部子路径，`grid` / `views` / `charts` / `dashboard-builder` / `form-builder` / `access` / `markdown` / `excel` 一律 `lazy()` | `examples/large` | ≤ 300 KB JS（含 react）/ ≤ 40 KB CSS |

**三档只是默认起点，任何子路径都可以加**：小工具要多维表格、图表、搭建器照样装，重的懒加载就行；**预算只量首屏**，不禁止引入任何子路径。门禁是 `scripts/size-budget.mjs`（`npm run size`，含在 `npm run check` 里）。

## 先选模板

**每个后台页面动手前先说清用 T01–T17 哪一个模板**（[PAGE-TEMPLATES.md](PAGE-TEMPLATES.md)）：工作台首页、资源列表、指标 + 列表、统计看板、分区合并、日志 / 时间线、关系图 / 监控、设置 / 表单、权限配置、工具 / 工作区、进度 / 工作项、向导、个人页、记录详情，以及自带外壳的表格工作区（T15，图标栏 + 目录）、公开页（T16，没有后台外壳）、看板搭建器（T17）。**布局定死，只按业务换内容**；照 starter 菜单「页面模板」里对应的一页改，代码注释或交付说明里写「本页用 Txx」。套不上或要改布局，先问产品负责人，偏离要产品负责人点头。

## 界面改动先出演示、产品负责人确认再写代码

新页面套不上模板、要改布局、要新组件时，**先做演示**（静态 HTML 页或 starter 里的一页，真实内容，只用色卡变量），做成审阅页给产品负责人逐项点「通过 / 要改」；全部通过后才写 React 代码，交付时把截图和通过的演示截图逐张对照。

## 0. 基本规则：只用套件组件和色卡颜色

**后台页面只能用下面这套已批准的组件和当前色卡里的颜色来拼。** 只有产品负责人提出特殊要求时才能偏离，并且要在偏离处的代码注释里写明原因（谁要求、为什么），例如：

```tsx
// 偏离套件：产品负责人 2026-10-02 要求大屏上的在线人数用 64px 数字，套件 MetricCard 最大 32px。
```

不手写按钮、表格、弹框、徽标、卡片样式，不写死颜色，不加装饰色条。套件缺东西时先说明缺口，共性需求回流 SDK。

### 0.1 套件清单（按类别，括号里是 SDK 名称）

| 类别 | 组件 |
|---|---|
| 1. 基础控件 | 按钮（`Button` 7 种样式 4 档尺寸 · 图标按钮 `IconButton` · 按钮组 `ButtonGroup` · 主操作 + 其他方式 `SplitButton` · 工具栏「⋯」`MoreMenu`）、链接（`Link`）、输入框（`Input`：前后缀 / 框内一格 / 清空 / 字数）、多行输入（`Textarea`：自动长高）、搜索（`SearchBox` · `Highlight`）、数字 / 金额 / 电话 / 百分比（`NumberInput` · `MoneyInput` · `PhoneInput` · `PercentInput`）、滑块（`Slider`，只给赢率这类大概值）、密码（`PasswordInput` · `PasswordStrength`）、下拉选择（`Choice` · 多选 `MultiChoice` · 表单里 ≤ 6 个带色选项 `ChoiceTags`）、日期 / 时间（`DatePicker` · `DateTimePicker` · `TimeInput` · `DateRangePicker` · `CalendarButton`，见附录 P）、勾选框（`Checkbox`）、单选圆点（`RadioGroup`）、开关（`Switch` · 立即保存的 `AsyncSwitch`）、分段选择（`SegmentedControl`）、多选标签（`ChipGroup`）、日期快捷（`QuickDatePresets`）、搜索筛选栏（`QueryBar`）、上传（`UploadField`）、评分（`Rating`）、步进器（`NumberStepper`）、分格密码（`CodeInput`）、选项颜色（`OptionSwatchPicker`，10 色 + 实心） |
| 2. 状态与标记 | 状态徽标（`StatusBadge`：表格里圆点 + 字、头部软底）、标签（`Tag` · 表格里 `CellTags`）、数量角标（`Count` · 圆点 `DotBadge`）、头像（`Avatar` · 人员块 `PersonChip`）、提示气泡（`Tooltip`，不用原生 title）、快捷键（`Kbd` · 快捷键表 `ShortcutSheet`）、分隔线（`Divider`）、骨架 / 进度（`ContentSkeleton` · `SkeletonBlock` · `TopProgress` · `ProgressBar` · `StepProgress` · `Spinner`）、实时状态（`LiveStatus`）、进度 / 配额条（`Meter` · `QuotaMeter`）、加载中（`LoadingDots` · `Skeleton`）、到期徽标（`ExpiryBadge`）、在线头像（`AvatarStack`）、倒计时（`Countdown`）、变化值（`DeltaBadge`）、锁标（`LockPill`） |
| 3. 值的展示 | 时间（`DateTimeDisplay` · `RelativeTime` · `CellDate`）、数字 / 金额（`NumberDisplay` · `MoneyDisplay`）、可复制的值（`CopyableValue` · 字段行复制图标 `CopyButton` · 整段值 / 令牌 `CopyField`）、命令块（`CopyBlock`）、敏感值（`SensitiveValue`，留痕查看 `useSensitiveReveal`）、一次性密钥（`OneTimeSecretDialog`）、键值列表（`DescriptionList`）、格子文字（`CellText` · `CellLongText` · `CellLink` · `CellPeople`）、二维码（`QrCode`）、水印（`Watermark`） |
| 4. 提示与反馈 | 行内提示条（`InlineAlert`）、空 / 出错 / 加载面板（`StatePanel`）、操作结果提示（`useNotify` · 先做再撤销 `useUndoToast`）、禁用原因（`DisabledReason`）、确认弹框（`ConfirmDialog`）、改动清单（`ChangeList`）、冲突选择（`ConflictChooser` · `ConflictModePicker` · `ConflictToggle`） |
| 5. 页面与容器 | 页面头（`PageHeader`：只有右上角按钮 + 「?」说明）、说明「?」（`HelpTip`）、页面体（`PageBody`）、面板 / 列表面板（`Panel` · `ResourcePanel`）、分组卡片（`SectionCard`）、页内标签页（`Tabs`）、合并页（`TabbedPage`）、看板分区（`DashboardSection`）、弹出菜单（`RowActions`；右键 / 表头 / ⋯ 菜单 `Menu` · `ContextMenu` · `MenuButton`）、弹出面板（`PopoverPanel`）、普通弹框（`Dialog`；侧边 / 手机底部弹层 `SideSheet` · `BottomSheet`）、表时光机（`TimeMachineDialog`） |
| 6. 表单 | 表单弹框（`FormDialog`）、表单字段（`FormField`）、表单分组（`FormSection`）、选人 / 分享（组织选人 `OrgPicker` · 行内 `OrgPickerField`，`@adminui/react/org-picker`；`SharePicker`；授权名单 `GrantList`，给 `orgSource` 就用组织选人）、步骤（`Steps`）、导入向导（`ImportWizard`）、Markdown 编辑器（`MarkdownEditor`）、拖动排序（`SortableList`） |
| 7. 列表 | 数据表格（`DataTable`，含分页）、行操作条（`RowActionBar`：放得下就露、最多 3 个，其余进 ⋯）、批量操作（`DataTable bulkActions` → 底部浮动条 `BulkActionBar`）、时间线（`ActivityFeed`）、状态清单（`StatusChecklist`）、紧凑小表（`CompactTable`）、操作记录（`LogTimeline variant="operations"` · `LogKindFilter` · `LogStatusPill`）；格内录数据的页面才用多维表格（`BitableGrid`，见第 14 类） |
| 8. 指标与图表 | 指标卡（`MetricCard` · `MetricGrid`，没有对比基准）、KPI 卡（`KpiCard` · `KpiGrid`，带对比 / 目标，`size` 三档）、迷你趋势（`Sparkline`）、图表（`AdminChart` + builder：柱 / 条形 `barOption`、环 `donutOption`、堆叠 `stackedBarOption`、实际 vs 目标 `targetBarOption`、折线 `timeSeriesOption`）、图表状态（`ChartState`）、图表颜色（`chartColors` · `vizCategory` · `vizOptionColor`）、子弹图（`BulletBar`）、个人进度环（`ProgressRing`）、看板筛选（`DashboardFilterBar`）、报表工具条（`ReportToolbar`）、转化漏斗（`StepFunnel`）、留存表（`CohortTable`）、汇总卡（`RollupCard`）、仪表盘标签（`DashboardTabs`，`@adminui/react/views`） |
| 9. 记录详情（不给 `cards` = 字段行；给 `RecordLayout.cards` = 卡片分区 C） | 字段一栏 + 就地编辑（`RecordField.edit` + `GridCellEditor variant="field"`）、记录头部（`RecordHeader`，白底紧凑头部）、关键信息条（`FactStrip`）、人员行（`PersonLine`）、图标块（`IconBlock`）、三档详情（`RecordDetailDialog` · `RecordPage` · `useRecordDetail`）、卡片分区 + 编辑布局（`RecordLayout.cards` · `RecordDetail` · `StagePath`，TABLES §3.7）、子表区块（`SubTableSection`）、看不到的字段（`HiddenFieldsPill`）、评论（`CommentThread`） |
| 10. 外壳与导航 | 外壳与侧边菜单（`AdminShell`）、工作标签（`AdminShell tabs`）、面包屑（`Breadcrumbs`）、命令面板（`CommandPalette`：`commands` + 各模块 `providers`）、通知中心（`NotificationCenter`：铃铛 +「通知」「待我处理」）、切换公司 / 账号菜单（`AdminShell company` · `account` + `accountMenu` + `onSignOut`）、外观（`AppearanceButton`：浅 / 深 / 跟随系统 + 色卡 + 字号）、设置抽屉（`SettingsSheet`）、加载更多（`LoadMore`）、登录页（`AuthLayout` · `LoginForm`）、窄屏列表 → 详情（`ListDetailLayout onBack` · `NarrowBackBar`）、客户门户（`AdminShell variant="portal"` · `SetupChecklist`）、模块工作区外壳（`RailShell` · `NavTree` · `WorkspaceTitleBar` · `ScopePill`，T15）、公开页（`PublicPageLayout` · `PublicResult`，T16；分享页 `SharedPageShell`）、搭建器框架（`BuilderLayout`，T17）、手机布局判断（`useIsMobile` · `useMediaQuery`） |
| 11. 页面模板（6.0） | 指标带（`StatStrip`）、待办（`TodoInbox`）、行列表（`ActionList`）、常用入口（`QuickLinks`）、在线（`PresenceList`）、条形列表（`BarList` · `RatioBar`）、信息小行（`InfoList`）、选项方块（`ChoiceTiles`）、改动标记（`ChangeMark`）、保存条（`SaveBar`）、搜索框（`SearchField`）、选择列表（`SelectList`）、窗格（`Pane` · `PaneSection`）、日志时间线（`LogTimeline`）、工作项（`WorkItemCard` · `WorkItemList`）、对话（`ChatThread` · `ChatMessage` · `ToolCallCard` · `Composer`）；布局 `SplitLayout` · `SideNavLayout` · `ListDetailLayout` · `WorkspaceLayout` · `WizardLayout` · `GraphLayout`（各模板用哪些见 [PAGE-TEMPLATES.md](PAGE-TEMPLATES.md)） |
| 12. 媒体与附件 | 附件集（`AttachmentGallery`）、大图预览（`MediaLightbox`）、音频播放（`AudioPlayer`，格子里 `variant="mini"`）、多文件上传（`UploadQueue` · `UploadDropZone` · `UploadQueueList` · `useUploadQueue`）、录音（`AudioRecorder` · `useAudioRecorder`）、按住说话（`HoldToTalk`）、小部件（`MediaThumb` · `MediaTypeIcon`）——细则见附录 E |
| 13. AI | 建议更新（`SuggestionReview`）、出处（`CitationChips` · `SourcedAnswer`）、提示词（`PromptEditor` · `VersionList` · `CompareGrid`）——细则见附录 H |
| 14. 多维表格与视图 | 多维表格（`BitableGrid`：表头 / 单元格菜单、冻结线、填充柄、行操作、筛选 / 分组 / 排序 / 字段 / 填色面板都自带）、个人设置条（`ViewOverrideBar`）、字段选择（`GridFieldPicker`）、视图标签与管理（`ViewTabs` · `ViewManager`）、记录卡片（`RecordCard`）、看板（`KanbanBoard`）、画册（`GalleryView`）、日历（`CalendarMonth` · `CalendarWeek`）、甘特（`GanttView`）、视图设置（`CardSettings` · `CalendarSettings` · `GanttSettings` · `FieldOrderPicker`）——细则见附录 G、I、L |
| 15. 记录与字段 | 新建 / 修改字段（`FieldDialog`）、字段类型格子（`FieldTypePicker`）、选项编辑（`OptionsEditor`）、表格就地权限（`TableAccessPanel`，`@adminui/react/access`）、人员权限构成（`AccessProfileHeader` · `OverrideTargetFields`，`access`）——细则见附录 J |
| 16. 分享与历史 | 分享弹窗（`ShareDialog`）、访客记录卡（`SharedRecordCard` · `SharedMediaCard`）、密码门（`PasswordGate`）、一次性密钥页（`SecretReveal`）、我的分享（`ShareManager` · `ShareAccessLog`）、单元格修改历史（`CellHistoryPopover`）——细则见附录 K |
| 17. 条件与搭建器 | 条件编辑器（`ConditionTreeEditor`：条件组、且 / 或、「我」、相对日期，表格筛选 / 权限 / 规则共用）、条件的一句话说明（`ConditionSummary` · `describeConditionTree`）、规则列表（`RuleList`：从上往下匹配、兜底一条）、收集表单搭建器（`FormBuilder`，`@adminui/react/form-builder`）、公开填写页与提交成功（`PublicForm` · `FormSuccess`，`@adminui/react/forms-public`）、看板搭建器与只读看板（`DashboardBuilder` · `DashboardView`，`@adminui/react/dashboard-builder`）、录音文字稿（`TranscriptViewer`） |
| 18. 审批 | 列表（`ApprovalList`：我的申请 / 待我审批 / 全部）、详情（`ApprovalDetail`：申请时的内容 + 审批进度 + 批准 / 驳回 / 撤回）、竖向审批进度（`ApprovalProgress`）、记录详情里的进度卡（`ApprovalProgressCard`）——细则见附录 U |

颜色只来自当前色卡：一个主色系 + 注意 / 异常 / 信息三种点缀色，「正常」用主色系（见 [DESIGN.md](DESIGN.md) §1）。

## 1. 先判断写在哪一层

| 内容 | 写在哪 | 能自由调整什么 |
|---|---|---|
| 字体、间距、颜色、按钮、弹层、分页外观 | SDK | 发新版本统一调整，项目里不复制一套 |
| 菜单、表格列、筛选字段、详情分区、表单字段 | 项目页面 | 用套件组件自由组合 |
| API 路径、字段映射、查询参数、上传、权限判断 | 项目 adapter | 匹配现有服务合同 |
| 金额、资格、发奖、密码 / 手机等规则 | 项目服务或业务 SDK | UI 不自行限制或重算 |
| 只被一个页面用的业务小组件 | 项目 feature | 用套件组件拼，颜色间距用 token |
| 已有第二个使用方的通用交互 | adminUI 新组件 | 补合同、清单、示例和交互测试后发版 |

页面上没有权限的按钮可以隐藏，但服务端授权必须执行。

## 2. 视觉硬约束

- 所有后台内容包在 `AdminProvider` 内，只导入一次 `@adminui/react/styles.css`。禁止全局覆盖 `body`、`button`、`:root` 或另装 reset。
- **样式怎么进来**：`import "@adminui/react/styles.css"` 放在应用入口的**第一行 import**（它只有 token、基础和核心组件）；其它区域的 CSS 跟着渲染它的组件自动进来，不用手动引。只从包的公开入口导入（`@adminui/react`、`@adminui/react/<子路径>`、`styles.css`），**不导入 `src/` / `dist/` 下的文件**；重的子路径（`grid`、`views`、`charts`、`dashboard-builder`、`form-builder`、`access`、`markdown`、`excel`）用 `lazy()` / 动态 `import()`，它们的 JS 和 CSS 一起按需加载。
- **页面一进来就是按钮和内容**：侧栏、工作标签、面包屑已经写了页名，页面里**不再显示大标题**（`PageHeader` 默认只给读屏，`showTitle` 只给没有外壳的页面）；**不写介绍段落**——页面 / 面板的介绍写进 `description`，SDK 收成右上角 / 标题旁的「?」（`HelpTip`），鼠标移上去才显示。**页面按钮不单独占一行**（5.3）：`PageHeader` 的 `actions` 和「?」自动并进页面 / 分区第一块的标题行（`Panel` / `ResourcePanel` / `DashboardSection`，和它自己的按钮一行）；第一块是 KPI 卡这类没有标题行的，就放进上面分区标签那一行的右端（5.4），所以页面头照常写在最上面，不要为了省一行自己把按钮挪进面板。不要手写 `<p>` 介绍、不要用提示条当介绍；提示条只放要用户处理的事（例「2 台新设备等认领」）。
- 页面 = `PageHeader + PageBody`（兄弟区块放 `PageBody` 里，不手写 margin）。列表页写 `<PageBody fill>`（卡片撑满一屏、空表居中、分页贴底），不要在项目里自己拉伸 `.aui-*` 布局。列表 = `ResourcePanel`（`filters` 放 `QueryBar`，`children` 放 `DataTable`）；详情走记录详情三档；弹出表单 = `FormDialog + FormSection + FormField`；看板 = `DashboardSection + KpiGrid + KpiCard + AdminChart`，**动手前先按 [DASHBOARDS.md](DASHBOARDS.md) §0 写分类卡，交付前按 §12 截图亲眼检查**。
- 字体（8 档）：大数字 28、页面 / 记录标题 22、区块大标题 18、卡片标题 14.5、正文 14、表格 / 控件 13、标签 12.5、备注 / 表头 12（都乘 `--aui-font-scale`；例外只有对话框标题 16、KPI 数字 28 / 24 / 20和键帽、头像、角标这类小标记）；字重只用 400 / 500 / 600；正文 `--aui-text`，次要 `--aui-secondary`，备注 `--aui-note`。文档阅读 / 编辑器正文区加 `className="aui-neutral-text"` 换成纯中性灰（附录 R、DESIGN §1.6），别处不用。关键内容不降透明度，文字对比度 ≥ 4.5:1。
- 控件高 36px（小号 28px），圆角控件 8px / 面板 12px；内容铺满，桌面两侧 16px、手机 12px；不加居中 `max-width` 或大幅欢迎横幅。
- 颜色只用 `var(--aui-*)`；换色走 `AdminProvider palette` 或顶栏 `AppearanceButton`。禁写死颜色、`text-blue-*`、装饰色条。状态同时有图标 / 文字。
- 只朝一个方向滚的容器两个方向都写明：横滚 `overflow-x:auto; overflow-y:hidden`，竖滚反过来；滚动容器里不用负 margin，焦点框 `outline-offset:-2px`。
- 按钮：`default` 主按钮一块区域只一个；工具栏 = 一个主按钮 + 「⋯」（`MoreMenu`），其余是灰字 `ghost`；表格行里的动作用 `text`（主色字）；跳到别处用 `Link`；页面上的删除 `destructive-outline`，实心 `destructive` 只在确认框；保存时 `loading`，说不清为什么禁用就给 `disabledReason`；只有图标的按钮用 `IconButton`。静态状态用 `StatusBadge`，不伪装成按钮。
- 「启用 / 停用」用 `Switch`，多选用 `Checkbox`；页内分区用 `Tabs`；没有保存动作的弹层用 `Dialog`。
- 一个菜单项合并几个页面用 `TabbedPage`；分区里的页面照写 `PageHeader`，不要手写「嵌入时隐藏标题」。
- 2–6 个短选项单选用 `SegmentedControl`，多选筛选用 `ChipGroup`，不手写一排 `aria-pressed` 按钮；日期 / 时间用 `DatePicker` 家族（不写原生 `type="date"`），到期输入框下用 `QuickDatePresets`；格子里的可复制值用 `CopyableValue variant="inline"`。
- 顶栏右上放 `CommandPalette`，命令用 `navCommands` 从菜单生成，同义词写 `NavItem.keywords`；顶栏那一个开 `globalShortcut`（或 `AdminShell globalShortcut`），刚打开的页面按 Ctrl / ⌘ K 也能打开，不要自己在 window / document 上补监听。
- 图标用 Lucide SVG，禁 emoji；一个意思一个图标（`ACTION_ICONS`），不写 `strokeWidth`；图标按钮用 `IconButton`（`label` 必填）。**不写原生 `title`**：悬停说明用 `Tooltip` / `tipProps`（深色气泡，可带快捷键），带标题和链接的说明用 `HelpTip`。
- 加载：表格首次加载传 `loading`（表头 + 骨架行、数量「—」），刷新传 `refreshing`（旧数据留着 + 顶部细条）；不在内容中间转圈。
- 输入：列表搜索打字就筛（`QueryBar` 默认），慢列表 `searchMode="enter"`；设置页整页一个吸底 `SaveBar` + `useChangeTracker` + `FormField changed`，不每个分区一个保存按钮；提交出错 `throw new FormFieldErrors({...})`，错误文案写「原因 + 怎么改」；电话 `PhoneInput defaultCountry` 传本公司所在地；赢率这类大概值用 `PercentInput slider` / `Slider`。

## 3. 交互硬约束

- **先选列表形式（[TABLES.md](TABLES.md) §1）**：后台管理主列表 → `DataTable`（操作列用 `RowActionBar`：放得下就露、最多 3 个，其余进 ⋯，⋯ 旁边不许留空位，灰掉的不占位；固定行高；分页；`expandRecord`）；大日志 → `DataTable` + 服务端分页；格内录数据改数据 → `BitableGrid`（[GRID.md](GRID.md)）；排行 / 弹框卡片里的几行 → `CompactTable`；某个对象的历史 / 日志 / 心跳 → `ActivityFeed`；几项检查 → `StatusChecklist`；一个对象的属性 → `DescriptionList`。
- **每行一样高**：行高用 `rowHeight`（`short / medium / tall / extraTall`）或让用户在 `TablePreferencesMenu rowHeightControl` 里选；长文本用 `truncate` / `CellText` / `CellLongText`，标签和人用 `CellTags` / `CellPeople`（放不下 +N），这些列给 `width` / `maxWidth`；补充信息进 `expandable` 或记录详情。不在格子里竖着堆文字和徽标。`rowHeight="auto"` 只给十几行的小表。
- 分组用 `DataTable grouping`（先 `groupRows` / `flattenGroups` 再翻页），禁止自拼「分组」列。
- **点开一行看详情走记录详情三档（[TABLES.md](TABLES.md) §3）**：表格 `expandRecord={{ layout, url: true }}`，其他入口 `useRecordDetail` / `RecordDetailDialog`，独立页面 `RecordPage`。字段少用小弹框，多的用大弹框（手机全屏），图表和大关联表放整页（`pageOnly` / `overview`）。不给 `cards` 是字段行：字段名在左、值在右，按钮悬停才出，能改的字段给 `edit` 点值就地编辑（不要再自己开浮层编辑器、不要自己画字段方块）；只读的空字段收进「未填写」。**详情不从侧边滑出，不自己拼详情弹框的头部、上一条下一条、复制按钮**。
- 批量操作传 `DataTable bulkActions`（勾选后底部浮出 `BulkActionBar`，不挤表格），操作列标 `kind: 'actions'`；只读行用 `isRowSelectable` 禁选；全选只含当前页可选项；跨页全选用服务端查询快照。
- 搜索 / 筛选 / 排序 / 页大小变化回第 1 页并清理失效选择。服务端分页交给 adapter，禁止只排序当前页冒充全量。有真实总数用 `mode: 'page'`，游标接口用 `mode: 'cursor'`；未知总数不伪造。
- 列表和图表覆盖 loading / empty / no-results / error，错误给重试。请求过期不能覆盖新结果（`useDataSource`）；不在每次 render 新建 adapter 函数。定时 / 保存后刷新用 `refresh()`，失败显示 `staleError`。
- `FormDialog.onSubmit`：校验失败 throw / reject；await 真正保存；resolve 才关并提示成功。填写变更传 `dirty`。
- 删除 / 封禁 / 不可逆动作用 `ConfirmDialog`（`impact` 写对象与后果，审计要 `reason`，影响大的加 `typeToConfirm`）；改配置先 `changedFields + ChangeList` 再保存；只显示一次的密钥用 `OneTimeSecretDialog`。
- 切换工作标签保留筛选、页码和未保存输入；关闭脏标签先确认；隐藏的工作页传 `active={false}`，暂停轮询和动画。
- 角色 / 权限 / 审计按 [ACCESS.md](ACCESS.md)：服务端确认 actor / 租户、授权范围、version、最后管理员；业务变更与成功审计同事务；撤权后关闭无权工作标签并清缓存。浏览器持久化只是演示。
- 上传提供类型 / 大小、进度、取消、失败反馈；adapter 尊重 AbortSignal；blob URL 不是已上传地址。
- Markdown 不执行原始 HTML，不引入 `rehype-raw`；不把密码、token、手机号放进浏览器草稿。
- 指标缺失用 `null` / 「—」，不是 0；注明单位、口径和更新时间；金额用最小单位 bigint，财务口径由服务端给。
- 报表日期范围由项目定时区；CSV 用 `buildCsv`；大量行走服务端异步导出。
- ECharts / Markdown / 多维表格只从子路径懒加载；隐藏工作页传 `visible={false}`；图表配「查看数据」替代视图。
- 动效只用 SDK 自带反馈或 `MotionReveal / Skeleton / LoadingDots`（[DESIGN.md](DESIGN.md) §4）；动画结束不能当请求成功的条件。
- 后台工作流（批量、视图、偏好、任务、草稿、冲突、导入、命令、工作区）复用 [WORKFLOWS.md](WORKFLOWS.md)：持久化 key 含项目 / 租户 / 用户 / 资源；409 冲突来自服务端版本检查；XLSX 只从 `@adminui/react/excel` 动态导入。

## 4. 写一个页面的顺序

1. **先选模板**（[PAGE-TEMPLATES.md](PAGE-TEMPLATES.md)）：写下「本页用 Txx」；套不上的先做演示给产品负责人看，通过后再写。读 [INTEGRATION.md](INTEGRATION.md) 与 catalog；确认现有 API、字段和权限，分清真实接口与演示数据。
2. 从 starter 菜单「页面模板」里对应的一页（`examples/starter/src/PageTemplates.tsx`）起步，替换 adapter 和业务字段；Go / Rust + SQLite 从 `examples/single-service/README.md` 起步。拆文件可以，不复制 SDK 源码或样式。
3. 补齐成功 / 失败 / 空 / 无权限状态，处理保存后列表和详情同步。
4. 跑类型检查和构建，在浏览器实测 360 / 390px 手机、1440px 桌面、默认色卡和一套备用色卡、深色；整页不横向溢出。
5. 测真实的查询 / 排序 / 分页、表单失败保留输入、连点只保存一次、退出确认、上传取消 / 失败。看截图确认颜色和密度，构建成功不等于视觉验收。
6. 新增共性能力才回流 SDK；改包跑本包 `npm run check`、浏览器专项和 `test:packed`。

## 附录 A：任务提示词

把尖括号换成项目实际情况；未知项先查代码 / API，不编造。

### A. 新建完整后台页面

```text
请在当前项目实现 <页面或模块>，目标用户 <运营/财务/客服等>，核心任务 <任务>。
先读项目 AGENTS.md 和已安装 @adminui/react 的 INTEGRATION.md、AI-RULES.md、PAGE-TEMPLATES.md、catalog；确认包版本、真实页面、接口、字段、权限和数据规模。
先选模板：写明本页用 T01–T17 哪一个，照 starter「页面模板」对应的一页改内容，不改布局；套不上就先做静态演示给我审，通过后再写代码。
只用 AI-RULES §0 的套件组件和当前色卡颜色；偏离必须是产品负责人要求并在代码注释写原因。
先列「模板 → 用户任务 → 页面分区 → 套件组件 → API/权限 → 验收」清单，然后直接实现。
要求：
1. 页面 PageHeader + PageBody；列表 ResourcePanel + QueryBar + DataTable（操作列露出常用按钮）；详情走记录详情三档；表单 FormDialog + FormField。
2. 列表覆盖加载、空、筛选无结果、失败重试；筛选/排序变化回第一页；真实服务分页排序，未知总数不伪造。
3. 保存 await 成功才关；失败保留输入；防重复提交；未保存关闭确认；危险操作用 ConfirmDialog 写清对象和影响。
4. 权限由服务端执行，前端同步控制菜单/动作；敏感变更在服务端审计。
5. 手机筛选换行、宽表内滚、弹框可触达；浅深色、键盘、减少动态都可用。
6. Go/Rust 项目沿用原服务，不为 UI 加 Node 服务。
交付代码和实际验证结果：360/390/1440px、深色、正常/失败/无权限，并和模板截图（design/templates/tNN-*.png）并排对照；标明哪些接了真接口、哪些未验证。
```

### B. 优化现有后台，逐页闭环

```text
请优化 <项目/页面范围>，按已安装 @adminui/react 的 AI-RULES.md、DESIGN.md、TABLES.md 执行。
先看真实页面和源码，列出范围内页面、已用组件、接口和未完成行为；不能只凭截图判断。
对照 AI-RULES §0 套件：手写的按钮/表格/弹框/卡片/颜色换成套件组件和色卡 token；主列表是 DataTable；详情是记录详情三档（居中弹框 / 整页；从视图打开 = 右侧抽屉 `frame="drawer"`）；没有装饰色条。
输出问题表（位置、用户影响、修复方式、优先级），先修功能错误、丢输入、误操作、权限泄露、手机不可用，再统一布局/状态/文案。逐页修改和验证。
共性问题在 SDK 修并更新 catalog 和文档；页面字段和业务行为留在项目。
结束给出「已改页面 / 实际测试 / 剩余缺口」，附桌面、手机、深色截图。
```

### C. 数据表格专项

```text
请改进 <客户/订单/库存等页面> 的表格。先读 TABLES.md 和 catalog，参考 https://carbondesignsystem.com/components/data-table/usage/。
确认真实字段、主键、数据量、只读条件、金额单位、服务端筛选排序分页和导出范围。
先按 TABLES §1 选列表形式；主列表用 DataTable：关键标识可冻结；长文本 truncate / CellText / CellLongText 配 width/maxWidth；标签和人 CellTags / CellPeople；数字右对齐写单位；状态 StatusBadge 带文字；操作列 kind:'actions' 用 RowActionBar（全部操作按常用顺序给它，放得下就露、最多 3 个，其余进 ⋯；灰掉的和危险操作默认在 ⋯）。每行一样高，按内容选 rowHeight 或给用户 rowHeightControl。完整内容走 expandRecord（记录详情三档，写 RecordLayout）。
区分全局、批量、行内动作；批量模式隔离行操作；跨页全选用服务端快照。分组用 grouping，不自拼分组列。
验证真实横纵滚动、冻结列不盖勾选框、键盘、批量部分失败重试、筛选无结果恢复、导出权限与 CSV 安全、360/390px 无整页溢出。
```

### D. 权限、审计和高风险操作

```text
请补齐 <模块> 的权限和审计。先读 ACCESS.md、现有认证模块和服务端政策，按项目规模选 AccessManager/AuditLogPage、AccessConsole 或治理页。
列出每个页面、按钮、接口对应的 resource:action 和数据范围。服务端从已验证会话取 actor/租户，逐次鉴权。
角色修改检查可授予范围、版本、受保护角色和最后管理员；撤权后关闭无权标签并清缓存；409 保留输入并提示刷新。
关键变更和成功审计同事务，拒绝/失败独立留痕；排除密码/token/完整手机号。日志检索和导出独立鉴权。
测试允许/拒绝、版本冲突、审计存储故障、重启持久化、租户隔离。
```

### E. 交付前检查与文档同步

```text
请对 <改动范围> 做最后验收，先看项目门禁，不凭构建成功宣布完成。
核对组件符号和属性来自当前 catalog；页面只用套件组件和色卡颜色，偏离处有原因注释。
运行受影响的类型检查、测试和浏览器交互：成功与失败、键盘焦点、手机、深色、减少动态、请求乱序、重复提交、数据范围。
同步接入文档和示例，删除失效指引。汇报实际结果与未验证项，不编造截图或上线结果。
```

### F. 数据看板 / 运营面板 / 报表页

```text
请为 <项目> 实现/优化 <看板名称>。先读 DASHBOARDS.md、AI-RULES.md 与 catalog。
第一步不写代码：按 DASHBOARDS §0 写分类卡——业务类型（选 §2 模板卡）、主用途（实时值班/经营复盘/深入分析/对账核查只选一个）、受众、看完要做的决定、新鲜度、数错代价、北极星与 3–5 个一级 KPI、下钻路径、对比基准、刷新档位、时区与日切、查看范围、告警条件。
业务类型不在 §2：先上网调研至少 5 个独立来源写新模板卡（含「陷阱」），交付后回流 DASHBOARDS §2。
实现：DashboardSection + KpiGrid + KpiCard（delta 用 computeDelta）+ AdminChart builder；实时档 useLiveResource + LiveStatus（3 秒）；照 starter「运营看板示例」起步。
概率 / 比率类指标（命中率、转化率等有理论值的比率）用理论值 ± 1.96·σ/√N_eff 容差带与漏斗图，禁固定百分比阈值。下钻 ≤3 层、状态进 URL。聚合在服务端，查看范围服务端强制。
交付：分类卡、页面、指标字典、接口与聚合 SQL、测试结果、桌面/360/390/深色截图（逐张亲眼看），§13 清单逐条结果。
```

## 附录 B：宿主 AGENTS.md 片段

```md
后台统一使用 @adminui/react。写或改后台前先读 node_modules/@adminui/react/AI-RULES.md、PAGE-TEMPLATES.md、INTEGRATION.md 和 @adminui/react/catalog。
每个后台页面先选模板（T01–T17，PAGE-TEMPLATES.md），布局定死只换内容；套不上或改布局，先做演示（静态页或 starter 页）给产品负责人看，通过后再写代码。
页面只用 AI-RULES §0 的套件组件和当前色卡颜色；偏离只在产品负责人特殊要求时，并在代码注释写原因。
主列表用 DataTable（操作列露出常用按钮），详情走记录详情三档（TABLES.md，居中弹框 / 整页；看板 / 日历等视图里点开 = 右侧抽屉，VIEWS.md §9）。
项目只扩业务字段/列/adapter，不复制主题、按钮、表格和弹框 CSS。交付验证桌面/手机、浅深色、错误恢复、未保存输入和权限边界。
数据看板/运营面板/报表页先读 DASHBOARDS.md：先写分类卡（业务类型 × 用途 × 受众），再用对应业务模板卡。
Go/Rust + SQLite 单服务：前端静态构建由原服务托管，REST adapter 接同源 API，生产不需要 Node。
```

vendor / workspace 安装时把 node_modules 路径换成实际包目录。安装包不会自动改宿主 AGENTS.md，也不注册 AI skill。

## 附录 C：官方参考

| 网址 | 用于 | 落点 |
|---|---|---|
| [Cloudscape](https://cloudscape.design/) · [Table view](https://cloudscape.design/patterns/resource-management/view/table-view/) | 整体结构、资源列表、偏好、分页、空 / 错误状态 | `PageHeader` + `ResourcePanel` + `QueryBar` + `DataTable` |
| [Carbon Data table](https://carbondesignsystem.com/components/data-table/usage/) | 密集表格、选择、展开、批量与行操作 | [TABLES.md](TABLES.md) |
| [Radix Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) | 弹框、选择器、焦点与键盘 | SDK 已封装的 Radix 组件 |
| [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/) | 表格、对话框、标签页语义 | 按模式检查键盘、焦点、名称、状态 |

只借鉴原则，代码用本包当前 API；不照抄外站 import、不引入另一套全局 CSS、不搬 AWS / IBM 品牌素材。

<!-- bt/foundations -->
## 附录 D：基础部件（菜单、弹出面板、拖动排序、选项颜色、小部件、侧边 / 底部弹层）

多维表格样稿标准化出来的通用部件，所有后台都用，不在项目里另写。starter 菜单「系统 → 基础部件」有照样稿摆的真实示例，浏览器验收 `npm run test:foundations`（截图在 `test/artifacts/foundations/`）。

| 要做的 | 用 | 要点 |
|---|---|---|
| 右键菜单、表头菜单、列 ⋯、事件菜单 | `ContextMenu` / `MenuButton` / `Menu` | 菜单项是数据：`sections`（可带 `title`）→ `MenuItem`（`icon`、`shortcut`、`hint`、`count` 填进 `{count}`、`items` 子菜单、`danger` 放最后一组、`disabled` + `disabledReason`、`checked`）。在指针处或锚点下打开，贴边自动翻转；键盘、首字母跳转、焦点归还都内置。表格行的 ⋯ 仍用 `RowActionBar` |
| 主操作 + 其他方式 | `SplitButton` | 「添加记录 ▾」；▾ 里放用表单添加、导入、复制上一条 |
| 工具栏 / 表头下面的面板 | `PopoverPanel` | `title` + `help`（「?」）+ `headerExtra`（「显示 13 / 15」）+ 内容 + `footer`；非模态，Esc / 点外面关；不要自己拼浮层 |
| 用户调顺序 | `SortableList` | 最多两层（编组可折叠、项目能跨组）；`locked` 不能动也不能被越过；键盘 Alt+↑/↓ 或空格拿起；数据由宿主保管（`onChange`）。纯数组用 `reorder` |
| 选项 / 标签颜色 | `tone`（10 色 + 实心）+ `OptionSwatchPicker` | green · teal · blue · violet · pink · red · orange · yellow · olive · gray，实心 `greenSolid` 这类只给最重要的一个值；跟色卡和深色走；**不收任意颜色**，新写的数据只用这 20 个名字；读存量数据用 `optionTone`（含 `legacyTone`，见 DESIGN.md §1.7）和 `color: "blue"` 这类颜色名，`#hex` 经 `colorTone` 对到最近的色 |
| 下拉 / 多选 | `Choice` / `MultiChoice`（自己拼用 `OptionList`） | 一种外观：勾在右（多选勾选框在左）、多于 6 项出搜索、`group` / `hint` / `disabledReason`、`clearable` 悬停 ×（不放「（清空）」选项）、`onCreate` 就地新建；筛选条和格子用 `size="sm"`；手机自动底部弹层 |
| 在线 / 成员 | `AvatarStack` | 最多 `max` 个，其余「+k」，悬停看名字 |
| 评分 | `Rating` | 星用注意色；只读传 `value`，可改再传 `onChange` |
| 次数 / 天数 | `NumberStepper` | − 数字 单位 +，`min` / `max` 夹住 |
| 密码 / 验证码 | `CodeInput` | 分格、粘贴填满、`error` 整组变异常色；校验在服务端 |
| 倒计时 | `Countdown` | `variant="text"`（放胶囊或句子）/ `"ring"`；过期由服务端判定，`onExpire` 只更新界面 |
| 分享页水印 | `Watermark` | 只是提醒，不是安全措施 |
| 侧边工具面板 / 手机底部弹层 | `SideSheet` / `BottomSheet`（= `Dialog placement="side" / "bottom"`） | **记录详情不用 SideSheet 自己拼**：表格里是居中弹框 / 整页，从视图打开用 `RecordDetailDialog frame="drawer"`（同一外框，VIEWS.md §9） |
| 金额只显示到元 | `MoneyDisplay digits={0}`、表格金额字段 `precision: 0` | 值始终是「分」，舍入远离零，统计值精确（`roundMinor`） |

浮层（菜单、面板、选色器）都挂 Provider 的 portal，在 `Dialog` / `SideSheet` 里打开时挂进弹框本身（焦点锁定里能用键盘），里面按 Esc 只关浮层、不关弹框。
<!-- bt/media -->
## 附录 E：媒体与附件（§0.1 第 12 类）

| 类别 | 组件 |
|---|---|
| 12. 媒体与附件 | 附件集（`AttachmentGallery`：网格 / 列表 / 一行条）、大图预览（`MediaLightbox`）、音频播放（`AudioPlayer`，格子里用 `variant="mini"`）、多文件上传（`UploadQueue` · `UploadDropZone` · `UploadQueueList` · `useUploadQueue`；单文件仍是 `UploadField`）、录音（`AudioRecorder` · `useAudioRecorder`）、按住说话（`HoldToTalk`）、小部件（`MediaThumb` · `MediaTypeIcon` · `LockPill`） |

- 附件、图片、视频、音频、文件不要手写缩略图、播放器、灯箱或上传进度：一条记录 / 一个字段的附件用 `AttachmentGallery`（面板里 `mode="tiles"`，记录详情的附件行 `mode="strip"`），点开走它自带的 `MediaLightbox`；宿主有自己的查看器时传 `onOpen`。
- 文件地址、签名下载、打包下载、在线预览页（Office）、转文字都由宿主给：`url` / `thumbUrl` / `previewUrl` / `onDownload` / `onOpenInNewWindow` / `audioAction`。没有缩略图就显示中性底 + 类型图标，不画渐变插画；文件类型字不上色。
- 有权限限制的文件给 `lock: { label, hint }`（锁标），看不了的加 `denied: true`：不能打开、不能勾选、不进批量下载。服务端照样逐个鉴权，下载地址按人签发。
- 表格里的录音格用 `<AudioPlayer variant="mini" />`（≤24px 高，放进 32px 行）；`peaks` 由服务端算好给（任意长度，SDK 降采样），没有就是普通进度条；同一页同时只放一个。
- 多文件上传用 `useUploadQueue` / `UploadQueue`：适配器收 `{ signal, onProgress, key, attempt }`，失败时 reject 一个写着原因的 Error（「网络中断，已保留文件」），断点续传用 `key` 找回会话、`attempt > 1` 时续传；要在方块上显示进度就把队列条目映射成 `MediaItem.upload`。
- 录音：`AudioRecorder`（大计时 + 实时波形 + 暂停 / 结束并保存 / 取消，`onDone` 拿到 Blob）；手机上的语音输入用 `HoldToTalk`（≥44px，上滑取消）。`notes` 只写宿主真做到的事（例如断网暂存）。录音红是唯一允许的点缀色例外（[DESIGN.md](DESIGN.md) §1.5），别处不要用红色当强调。
- 媒体上的字和遮罩用 `--aui-on-media`、`--aui-media-scrim*`，不写 `#fff` / `rgba(0,0,0,…)`。
<!-- bt/dashboards -->
## 附录 F：看板部件（§0.1 第 8 类「指标与图表」的细则）

| 需要 | 用什么 |
|---|---|
| 目标完成度（KPI 卡里、汇总卡里、表格格子里） | `BulletBar`；KPI 卡直接写 `KpiCard target={{ value, target }} timeProgress={0.15}` |
| 手机「我的今天」这类**个人**进度 | `ProgressRing`（带目标刻度）；**其它地方一律子弹图**，不用环、仪表盘 |
| 变化值（卡片、表格格子、指标条） | `DeltaBadge`（`computeDelta` 的结果；格子里 `size="sm"`，绝对值写 `unit`） |
| 北极星 / 进行中标签、分母行、数据源未接的指标 | `KpiCard tag` / `detail` / `placeholder` |
| 看板筛选行（时间 · 对比 · 维度 · 保存为我的 · 重置） | `DashboardFilterBar` + `useDashboardFilters`；下钻用 `carryFilterContext` |
| 转化漏斗 | `StepFunnel` |
| cohort（批次 × 天龄） | `CohortTable`（HTML 表，「未到期」格）；要图表版用 `cohortHeatmapOption` |
| 每期实际 vs 目标的柱图 | `targetBarOption`（`@adminui/react/charts`） |
| 分布 / 排行 / 占比 / 按第二个维度拆开 | `barOption`（`horizontal` = 条形排行）/ `donutOption`（≤ 5 片 + 其他）/ `stackedBarOption`；颜色写 token：单系列默认主色，类别 `vizCategory(i)`，选项字段用 `vizOptionColor(选项的色)` |
| 图的加载 / 空 / 筛选无结果 / 失败 / 刷新失败 / 无权限 | `AdminChart` 的 `loading` / `empty` / `noMatch` / `error` / `stale` / `forbidden`，自己画的图用 `ChartState`——都和图一样高，不用 `StatePanel` / 转圈 |
| 仪表盘标签（公司默认 / 我的） | `DashboardTabs`（`scope` company = 楼、personal = 人），放 `ViewTabs` 的 `trailing` |
| 报表的日期 / 来源筛选 | `ReportToolbar`：选了就查，**不加「查询」按钮**；给 `defaultValue` 时「重置」改过才出 |
| 总览页里每个子公司 / 业务线一张卡 | `RollupCard`，放在 `Panel flush` 里 |

**图表颜色只从色卡来**：不写十六进制；类别 = 选项标签色（`vizCategory(i)`）、单系列 / 有序 = 主色深浅（`VIZ_BRAND` / `vizBrandStep(i)`），`AdminChart` 用 `chartColors(palette)` 换成当前色卡；卡头不挂「标准」，只露「自定义口径」「覆盖看板筛选」；筛选行不套卡、一行、改过才出「重置」。

详见 [DASHBOARDS.md](DASHBOARDS.md) §12、§14 和 [DESIGN.md](DESIGN.md) §2.5；starter「团队今日示例」「看板部件」「图表与仪表盘」「看板搭建」。
<!-- bt/grid-b -->
## 附录 G：多维表格的菜单、冻结线、填充柄、行操作和更多字段类型（样稿 D01 / D02 / D03 / D19）

BitableGrid 自带这些，项目里**不要另写**右键菜单、表头菜单、冻结线、填充柄、评分 / 附件 / 电话格子。详见 [GRID.md](GRID.md) §12；starter「系统 → 多维表格 · 客户」；浏览器验收 `npm run test:grid-tools`。

| 要做的 | 用 | 要点 |
|---|---|---|
| 修改 / 插入 / 复制 / 删除字段、字段权限 | `onFieldAction(kind, field)` + `fieldActions` | 双击表头 = 修改；删除前宿主自己 `ConfirmDialog` |
| 表头菜单里的自定义项（字段编组子菜单） | `headerMenuItems(field)` → `MenuItem & { slot }` | `slot`：edit / insert / view / sort / manage（默认）/ danger |
| 「按此字段筛选」接自己的筛选面板 | `onFilterByField(field)` | 不给就往视图加一个空条件 |
| 末尾「+」列 | `onAddField` | |
| 行的右键菜单 | `onRowsInsert` / `onRowsDuplicate` / `onRowsDelete` / `cellMenuItems(ctx)` | 作用的记录 = 勾选的行或选区里的行（`ctx.rowIds`）；删除先确认 |
| 冻结列 | `GridView.frozen`（用户拖冻结线、菜单「冻结至此列」） | `frozenColumns` 只是默认 |
| 新增记录 | `onAddRow(group)` | 每个最底层组底部「新增一行」，`group` 是该组每一级的分组值（多级分组时多个键） |
| 拖动排序 | `onRowMove({ rowId, afterId, beforeId, group })` | 只在没排序时可用；键盘 Alt+Shift+↑↓ |
| 评论角标 / 逾期标红 | `cellBadge(row, field)` / `GridField.tone(row)` | 角标 `label` 给读屏 |
| 评分、进度、电话、自动编号、系统字段、公式、附件、关联、查找引用 | `type: "rating" / "progress" / "phone" / "autoNumber" / "createdBy" / "createdAt" / "modifiedBy" / "modifiedAt" / "formula" / "attachment" / "link" / "lookup"` | 电话 `mask` + `onReveal`（真脱敏在服务端）；公式 `resultType`；附件第一个是音频就用迷你播放器；关联 `openRef` / `openEditor` |

写和字段类型有关的规则时用 `coreType(field)` / `gridFilterOps(field)`，不要直接 `switch (field.type)`（新类型会映射到对应的基础类型）。

<!-- bt/history -->
## 附录 H：版本回退与 AI 审阅（样稿 D23 / D24 / D15 / D27 / D28；§0.1 第 4 / 5 / 7 / 13 类的细则）

已并入 §0.1：操作记录（第 7 类）、冲突选择（第 4 类）、表时光机（第 5 类）、AI 审阅（第 13 类）、人员权限构成（第 15 类）。

- **撤回**：批量操作（粘贴、批量改 / 分配、导入、一次自动化、一次同步）和字段 / 视图改动各有一个操作编号，用 `LogTimeline variant="operations"` 列出来；撤回窗口是参数（`undoWindowDays`，默认 3 天），之外的自动进「超过 N 天」灰组、撤回灰掉并说原因（逐条恢复走单元格历史）。撤回时别人后来又改过的格子默认**保留别人的**，用户可整批改成「一起退回」或逐格选；选择随 `onUndo(decisions)` 交给服务端，服务端逐格重新校验、写审计。
- **整表回滚**用 `TimeMachineDialog`：先 `onPreview` 拿到预览（改回 / 加回 / 移除 + 冲突）才能确认；回滚本身也是一次可以再撤回的操作，页面上写出来（`notes` 默认两条）。
- **AI 结果先审后写**：AI 建议改字段一律走 `SuggestionReview`（采用 / 忽略 / 撤销），不自动写记录；给用户说的话（话术、回答）用 `SourcedAnswer`，每句能对上出处，知识库里没有的价格 / 承诺不出现（`missingCitations` 查编造的编号）。
- **提示词**用 `PromptEditor`：改提示词只改「怎么分析」，字段格式由宿主固定；发布前用 `CompareGrid` 拿历史样本试跑对比；`VersionList` 回退 = 生成新版本，不删旧版本。token 有网关计数就传 `countTokens`，没有显示「约」。

<!-- bt/grid-a -->
## 附录 I：多维表格视图 v2（筛选 / 分组 / 排序 / 字段 / 填色）与条件模型

多维表格样稿 D01 / D04 / D05 / D17 / D17b 标准化出来的部分；`BitableGrid` 默认工具栏已经带上，不在项目里另写面板。详见 [GRID.md](GRID.md) §7.1、§8；浏览器验收 `npm run test:grid-panels`（截图 `test/artifacts/grid-panels/`）。

| 要做的 | 用 | 要点 |
|---|---|---|
| 任何「满足这些条件」的东西（表格筛选、填色、分配规则、权限条件、表单显示条件） | 条件模型 `ConditionGroup`（根入口 `condition-core` 那组函数） | 一棵树：条件 + 条件组，每组自己的全部满足 / 任一满足；嵌套默认 1 层、最多 50 条（可改）；值可以是 `{ dynamic: 'me' }`（宿主解析，解析不了不匹配）、相对日期 `{ relative: 'pastDays', days: 7 }`、固定范围；**不要自己再造一套条件结构** |
| 表格的筛选 / 分组 / 排序 / 字段 / 填色 | `BitableGrid` 自带工具栏（单独摆用 `GridToolbar` 或 `GridFilterTool` 等） | 上限给 `limits`；「另存为新视图」给 `onSaveAsView`；「我」给 `conditionContext.resolve`；字段编组用 `GridField.group` 或视图里调；受限字段 `restricted` 自动带锁、不能筛 |
| 服务端 10 万行也要分组 | 数据源 `loadGroups` + 后端 `applyGridGroups` 或 `buildGridGroupSql` + `gridGroupsFromSql` | 行按 `query.groups` 先排；不要在前端拿已加载的块自己分组 |
| 「你调整了这个视图」 | `ViewOverrideBar`（放 `banner`）+ `describeViewDiff` | 恢复共享设置 / 另存为新视图 / 保存给所有人（没权限不给 `onSaveForAll`）；视图从宿主接口异步读取时 `useGridView({ load: async … })` |
| 别的列表里选字段 | `GridFieldPicker` | 可搜索、类型图标、锁；不要用长下拉框列几十个字段 |
<!-- bt/records -->
## 附录 J：记录与字段（字段弹窗、授权名单、记录详情扩展、评论、表格就地权限）

样稿 D11 / D12 / D13 标准化出来的部件；starter「系统 → 记录与字段」「系统 → 表格权限」照样稿摆了真实内容，浏览器验收 `npm run test:records`（截图在 `test/artifacts/records/`）。

| 类别 | 组件 |
|---|---|
| 记录与字段（§0.1 第 6 / 9 / 15 类） | 新建 / 修改字段（`FieldDialog`）、字段类型格子（`FieldTypePicker`）、选项编辑（`OptionsEditor`）、授权 / 分享名单（`GrantList`：`mode="list"` = 原来的 `SharePicker`，`mode="picked"` = 已选的人 + 搜索添加 + 锁住的默认的人 + 谁看不到 / 共几人能看）、子表区块（`SubTableSection`）、看不到的字段（`HiddenFieldsPill`）、评论（`CommentThread`）、留痕查看（`SensitiveValue onReveal` · `useSensitiveReveal`）、表格就地权限（`TableAccessPanel`，`@adminui/react/access`） |

| 要做的 | 用 | 要点 |
|---|---|---|
| 加 / 改一个字段 | `FieldDialog` | 类型目录由宿主给（`FieldTypeTile[]`，没做的写 `later` 原因 → 虚线格子）；`optionTypes` 的类型出选项编辑；币种 / 小数位 / 默认值 / 右栏授权都是插槽；`onSubmit` reject 留在弹框显示原因。不要自己画类型格子、选项行、取色器 |
| 选项 / 标签 / 字典值的列表 | `OptionsEditor` | 拖动或键盘排序、10 色 + 实心、和表格一样的预览、重名标红；回车加下一个 |
| 「再给谁授权」「分享给」 | `GrantList` | `picked`：候选人只给操作者管得着的（宿主 / 服务端限定 `subjects` 或 `searchSubjects`），默认的人 `locked` 去不掉，`audience` 用服务端算的结果出横幅；服务端照样校验授权范围 |
| 记录里的子表 | `SubTableSection` + `CompactTable`（要格内编辑：`BitableGrid toolbar={false}`） | 用 `RecordSection.block` 放进详情；表头「在表格中打开」「显示列」，底部「+ 添加 · 共 N 条，显示最近 M 条 · 查看全部 →」 |
| 有字段对这个人隐藏 | 分区 `hiddenFields(row)` | 只给个数，出「N 个字段你看不到」；字段本身服务端就不下发 |
| 在详情里改一个字段 | `RecordField.edit` → `{ render: (ctx) => <GridCellEditor variant="field" … anchor={ctx.anchor} onCancel={ctx.done} /> }`；自己有界面的（勾选框、附件、关联）`{ onActivate }` | 点值（或悬停出来的「编辑」、值上 Enter / F2）就地换成编辑器，占满值那一格、原值藏起来；保存成功调 `ctx.done()`，失败留在编辑器；Esc 只取消这一格；长文本 Enter 换行、Ctrl + Enter 保存；可编辑的空字段留在原位；返回 null = 这条记录不能改，悬停出锁（`lockedReason`） |
| 字段上的按钮 | `RecordField.actions` / `tel` / `reveal` / `copy` / `action` | 列表展示：这一行悬停 / 聚焦时右上角出现（查看的眼睛留在值后面）；方块展示：方块右上角多个小按钮；`reveal` = 打码值 + 留痕查看（宿主鉴权并记录谁看过，默认 30 秒后自动打码），打码时不给复制 |
| 评论（记录、文档、知识库页面，唯一实现） | `CommentThread` | 默认筛「未解决」（标题行分段 全部 / 未解决 N / @我 N，`filter` / `onFilterChange` 受控，`filters` 可加 `resolved`；@我 要 `viewerId`），「全部」里已解决整串收成一行灰条、点开看、可重新打开；列表自己滚、输入框贴底（侧栏里给 `fill`）；回应固定 4 种 赞 / 收到 / 看过 / 有疑问（图标 + 字，不开放 emoji；`reactions[].names` 悬停看是谁）；行内小工具 回应 · 回复 · 解决 · ⋯ 悬停 / 聚焦才出、触屏常显；回复一层、超过 1 条折成「展开 N 条回复」；提到我 = 主色实底。@ 只能提到能看这条记录的人（`searchMentions` 由服务端过滤，看不到的给 `unavailable` 原因 → 灰掉不能选）；图片 / 文件、发送失败保留文字。编辑 / 删除自己的：`canEdit` / `canDelete` + `onEdit(id, body, mentions, { attachments, files })` / `onDelete(id)`，编辑就地复用输入框，删除是小气泡确认，墓碑（`deleted: true`）「评论已删除」、回复保留；本地更新 `patchComment` / `removeComment`。知识库划词评论：顶层评论带 `quote: { text, state?: "page" \| "orphaned" }`，`activeId` 高亮当前线程，`onSelect(id)` 让正文滚到划词，`composerNotice` 放「对方看不到这页，是否授予阅读？」。不要再自己写评论列表 / 输入框。服务端合同 `CommentThreadAdapter` |
| 一张表的权限页 | `TableAccessPanel` | 按角色：记录范围 6 档（按条件 = `renderCondition` 插槽）、能做的操作、字段 可读 / 可写 / 打码 / 可导出；改动后先看影响（服务端试算 `RuleImpactDto`）再保存，保存用 `ConfirmDialog` + `tableAccessChanges` 的改动清单 + 原因 |

明文、授权、提到的人、评论权限都以服务端为准；组件只显示和编辑草稿。
<!-- bt/share -->
## 附录 K：对外分享与单元格历史（§0.1 第 16 类）

| 类别 | 组件 |
|---|---|
| 16. 分享与历史 | 分享弹窗（`ShareDialog`）、公开页外框（`SharedPageShell`）、访客记录卡（`SharedRecordCard` · `SharedMediaCard`）、密码门（`PasswordGate`）、一次性密钥页（`SecretReveal`）、我的分享（`ShareManager` · `ShareAccessLog`）、二维码（`QrCode`）、单元格修改历史（`CellHistoryPopover`） |

- 分享任何对象（记录、视图、表单、文件、文档、密码）都用 `ShareDialog`，不另拼分享弹框。没有保存按钮：每次改动 `onChange` 给整份 `ShareSettings`，宿主立即保存并回填 `saveState`；打开前用 `applySharePolicy` 把设置拉回公司策略内（去掉禁止对外的字段、降到允许的「能做什么」、强制密码、封顶有效期）；弹窗里切到要求密码的「谁能打开」会自动生成密码。策略禁止的选项照样显示、写原因（`policy.audiences` / `requirePassword` / `maxExpiryHours` / `capabilities`）。「指定的人」传 `people` 时默认是 `GrantList mode="picked"`（已选的人 + 搜索添加），要换别的选人部件就传 `peoplePicker`。自定义有效期按 `timeZone` 填写和显示。
- 令牌、密码校验、次数、到期、作废、访问记录都在服务端（fenxiang，架构 §5.9）；界面上的倒计时、剩余次数只是提示。失效 / 不存在 / 错太多，公开页统一显示「链接已失效」，不说原因。
- 公开页不在 `AdminShell` 里：`SharedPageShell`（`variant="page"` 访客页、`"narrow"` 手机密码门 / 密钥页）+ 内容。手机上控件 ≥ 44px（`--aui-control-height-touch`）；不画插画；密码字符不上色。
- `PasswordGate` 只负责样子：宿主在 `onSubmit` 里请服务端校验，失败时更新 `failed` / `error`；连错 `captchaAfter` 次后 `captcha` 插槽放人机验证组件（如滑块），`captchaDone` 才放行。
- `SecretReveal` 到点自动隐藏、可立即销毁（`onDestroy` 通知服务端）；剪贴板清空是尽力而为，文案不要承诺更多。
- 我的分享用 `ShareManager`（指标带 + 筛选 + DataTable + RowActionBar），展开行放 `ShareAccessLog`；IP 由服务端打码后再给。
- 单元格 / 记录的版本历史用 `CellHistoryPopover`（`anchor` 元素或 `anchorRect`），恢复走 `onRestore`，恢复本身由服务端记成新版本。只给 `anchorRect` 时，`onClose(true)`（Esc / ✕）要由宿主把焦点放回那一格。

starter「系统 → 分享与历史」；公开页地址 `#share-public=visitor | password | secret`（加 `&dark`）。浏览器验收 `npm run test:share`（截图在 `test/artifacts/share/`）。
<!-- bt/views -->
## 附录 L：视图（看板、画册、日历、甘特、视图标签，可选子路径 `@adminui/react/views`）

| 要做的 | 用 | 要点 |
|---|---|---|
| 表格上方的视图切换、视图管理 | `ViewTabs` + `ViewManager`（+ `ViewLockNotice`、`ViewOverrideBar viewName`） | **一行**：标签（档位记号：标准小锁、共享两个人、我的不加）→「+」新建（`onCreateView`：6 张类型卡 + 名字 + 给谁看）→ 右侧「视图」+ 仪表盘组；不要再放「视图 ▾」按钮，快捷筛选放工具栏右边（`toolbarQuick` / `quickFilters`）；改了标准 / 共享视图 = `modified` 小点 + 标签下一行 `ViewOverrideBar`；`viewActions` 决定界面，服务端校验 |
| 按单选字段分列拖卡片 | `KanbanBoard`（卡片 = `RecordCard`） | 卡片用 `cardSlots` 五个固定位（标签 · 金额 · 区域 · 负责人 · 下次跟进），不显示字段名；列头合计给 `columnMeta[key].summary`（服务端整列）；`onMove(recordId, toValue, beforeId)` reject 放回、放下后撤销（宿主自己有撤销时 `undo={false}`）；键盘 Alt+方向键；每列 `columnMeta.hasMore` + `onLoadMore` |
| 带封面的卡片墙 | `GalleryView` | 封面是宿主图片或中性底，不画插画；点封面开 `MediaLightbox` |
| 月历 / 周历 / 日历 | `CalendarMonth` / `CalendarWeek` | 全天用日期键、定时用 ISO + `timeZone`；`weekStart`、`workCalendar`（休 / 班）由宿主给，SDK 不带日历；`onDateChange(id, start, end)` |
| 排期 / 甘特 | `GanttView` + `GanttSettings` | 宿主分好 ≤ 2 级 `groups`（分组层级 `ViewGroupLevel` 就是表格的 `GroupLevel`）；`config.endMode` field / duration / fixed、`workdaysOnly`；条上最多 2 个额外字段；颜色依据按单选字段 / 按条件（`colorRules` = 表格填色规则）/ 统一颜色；默认「两周」刻度只显示 `visibleDays`（15）天、左侧字段拿剩下的宽度——不要为了「多看几天」写死 `listWidth` 或自己算时间轴宽度 |
| 视图设置面板 | `CardSettings` / `CalendarSettings` / `GanttSettings` / `FieldOrderPicker` + `ViewSettingsFooter` | 放进 `PopoverPanel sheet`；底栏 `changes={countSettingChanges(shared, mine)}`（「已改 N 处，只对你生效」、没改「恢复」禁用），`onSaveForAll` 只给有维护权限的人；卡片设置给 `preview` 实时预览 |
| 从视图打开一条记录 | `RecordDetailDialog frame="drawer"` | 右侧抽屉，不挡视图、点别的卡片直接换人、`nav`（↑ ↓ +「8 / 13 · 按阶段」）、`onFrameChange` 三档；不要自己拿 `SideSheet` 拼详情 |

字段用 BitableGrid 的 `GridField<T>`，颜色只认选项的 10 色 + 实心；记录先按视图筛好排好再传，数组用 `useMemo` 保持引用。详见 [VIEWS.md](VIEWS.md)；starter「系统 → 视图」，验收 `npm run test:views`。
<!-- bt/templates -->
## 附录 M：模块工作区外壳、公开页、搭建器框架与触屏尺寸（T15 / T16 / T17，§0.1 第 10 类）

| 要做的 | 用 | 要点 |
|---|---|---|
| 一个模块一整屏的工作区（多维表格、CRM、文件、知识库） | `RailShell` + `NavTree` + `WorkspaceTitleBar`（T15） | 普通后台页面仍是 `AdminShell`；工作区从上到下 标题栏 → `ViewTabs` → 工具栏 → 视图，最后一块撑满、整页不滚；表名写在标题栏（T15 唯一显示页名的模板），不要 `PageHeader showTitle` |
| 目录里的表 / 看板 / 表单 / 自动化 | `NavTree` | 一层文件夹；数量写 `count`；搜索、键盘、收起都内置；「+ 新建」给 `createMenu`；手机上是抽屉，选一行自动收回 |
| 业务线 / 公司 / 空间切换 | `ScopePill`（放标题栏 `scope`） | 主色浅底胶囊 + 切换菜单；切换本身（要不要确认、换数据）由宿主做 |
| 谁正在看 | `WorkspaceTitleBar presence` | 用 `AvatarStack`，名字来自宿主的在线状态 |
| 「添加记录 ▾」 | `BitableGrid toolbarLeading={<SplitButton …/>}` | 放工具栏最左 |
| 不用登录、从链接打开的页面（T16） | 表单 `PublicForm` / `FormSuccess`；其他 `PublicPageLayout` / `PublicResult`；分享页 `SharedPageShell` | 没有后台外壳；不画插画；手机控件 ≥ 44px（`--aui-control-height-touch`）；提交成功 / 失效页给下一步按钮 |
| 拖组件搭看板（T17） | `RailShell` + `DashboardBuilder`（别的编辑器用 `BuilderLayout` 框架） | DashboardBuilder 自带顶栏撤销 / 重做 / 预览 / 保存和 组件库 · 画布 · 设置三栏，`height="100%"` 贴边铺满；BuilderLayout 没选中组件时右栏传 `null` |
| 手机上能点的东西 | `--aui-control-height-touch`（44px） | 按住说话、公开页按钮 / 输入框、密码格都用它，不写死 44px |

菜单（`Menu` / `ContextMenu`）只在它所属的元素被滚动时才跟着走或关闭：看板别的列、页面别处滚动不会把菜单关掉。全局 `button` 文字色重置在 `:where()` 里（优先级 0,1,0），组件自己写的颜色规则直接生效，不需要 CSS 变量绕。

starter：`#template=t15`、`#template=t16-form`（`t16-success` / `t16-visitor` / `t16-password`）、`#template=t17`，菜单「页面模板 → T15 / T16 / T17」；浏览器验收 `npm run test:page-templates`（截图 `test/artifacts/page-templates/t15-* / t16-* / t17-*`，对照 `design/templates/t15-workspace.png`、`t16-public-form.png`、`t17-dashboard-builder.png`）。
<!-- bt/builders-a -->
## 附录 N：条件编辑器、表单搭建器、公开填写页（样稿 D08 / D13 / D18 / D18m / D18s / D26）

| 类别 | 组件 |
|---|---|
| 14. 条件与表单 | 条件编辑器（`ConditionTreeEditor` · `ConditionValuePicker`，根入口；表格里是 `GridConditionTree`，权限里是 `CondBuilder`）、表单搭建器（`FormBuilder`，`@adminui/react/form-builder`）、公开填写页（`PublicForm` · `FormBrand` · `FormSuccess`，`@adminui/react/forms-public`） |

| 要做的 | 用 | 要点 |
|---|---|---|
| 任何「满足这些条件」的编辑（筛选、填色、权限按条件、分配规则、表单显示条件） | `ConditionTreeEditor`（数据是 condition-core 的条件树） | 条件组各自全部满足 / 任一满足，嵌套默认 1 层、最多 50 条（`limits` 可改）；值编辑器由宿主给（`renderValue`），选项 + 「我」用 `ConditionValuePicker`；窄卡片用 `density="compact"`。**不要再写一套条件行** |
| 治理规则、一张表的「按条件」 | `CondBuilder` | 值是 `CondDraft`，加了条件组多一个 `groups`；保存前 `draftToCond` 校验，服务端照样校验 |
| 收集表单（题目 = 表的字段） | `FormBuilder` | 受控：`form` / `settings` + 回调；删字段先 `ConfirmDialog`；分享走 `ShareDialog`（`onShare`）；提交次数限制（含每周 / 每月）是参数，登录 / 次数 / 范围由服务端强制 |
| 给外面的人填的页面 | `PublicForm` + `FormSuccess`（页面模板 T16 包着它） | 显示条件随答案生效，隐藏的题不提交；上传走宿主 `UploadQueueAdapter`；验证插槽放人机验证组件（如滑块）；手机吸顶「已填 N / M 题」、控件 ≥ 44px；成功页摘要用 `formSummary`（手机号打码） |

starter「系统 → 表单」（D08），公开页 `#form-public=fill`（加 `&dark`）；浏览器验收 `npm run test:form-builder`（截图 `test/artifacts/form-builder/`），权限里的条件跑 `test:access-governance`、`test:records`。
<!-- bt/builders-b -->
## 附录 O：录音文字稿、规则列表、看板搭建器（样稿 D27t / D26 / D32）

套件清单增补（并入 §0.1 时归类）：12. 媒体与附件 — 录音文字稿（`TranscriptViewer`）；4. 提示与反馈 / 6. 表单 — 规则列表（`RuleList` · `ConditionSummary`，条件白话 `describeConditionTree`）；8. 指标与图表 — 看板搭建器（`DashboardBuilder` · `DashboardView`，子路径 `@adminui/react/dashboard-builder`）。

| 要做的 | 用 | 要点 |
|---|---|---|
| 录音 + 转写（跟进、通话、会议、面试） | `TranscriptViewer` | 宿主给 `src`（签名地址）、`peaks`、已分说话人且**已打码**的 `segments`（打码区间里的文字就是打码后的文字），`onReveal` 留痕查看（服务端鉴权、记谁看过），`onExport` 出文件；说话人颜色是分类色（`slot`），标注分类只用主色族 tone，不用状态色。不要自己拼波形、跟随滚动、静默分隔 |
| 「如果 … 就 …」、第一条命中就停的规则（分配、路由、自动打标签、审批路线） | `RuleList` | `fields` 直接给表格字段；条件是 condition-core 的树（不要另造条件结构）；「然后」的摘要和表单由宿主画（`renderAction` / `renderActionEditor`）；兜底 `fallback` 固定在最后；规则保存、执行、命中数都在服务端 |
| 任何地方要把条件读给人听（规则摘要、权限条件、表单显示条件、筛选标签） | `describeConditionTree(tree, fields)` / `conditionTreeParts` | 「来源 = 官网 且 地区 是 上海、杭州」；嵌套组加括号；没填完的条件不读 |
| 让用户自己拼看板（我的看板、周会看板） | `DashboardBuilder`（T17 页面模板） | 看板存成 `DashboardSchema` JSON；`loadWidgetData(widget, filterContext, signal)` 在服务端按查看范围算好返回；标准指标来自宿主指标字典（口径不能改），改成自定义要标「自定义口径」；手机只读。只读展示用 `DashboardView`。DASHBOARDS.md §14 |

## 附录 P：日期 / 时间选择（§0.1 第 1 类）

| 要选什么 | 用 | 值 |
|---|---|---|
| 一天（安装日期、截止日） | `DatePicker` | `YYYY-MM-DD` |
| 日期 + 时间（到期、预约） | `DateTimePicker`（`minuteStep` 分钟一档，`defaultTime` 选天时的默认时间） | `YYYY-MM-DDTHH:mm` |
| 只要时间（每日提醒） | `TimeInput`（↑ ↓ 按步长，Alt + ↓ 列表） | `HH:mm` |
| 起止两天（报表区间、筛选） | `DateRangePicker`（`presets={dateRangePresets(["today", "thisWeek", "thisMonth", "last7"])}`） | `{ from, to }` |
| 「+ 添加」一天到列表（补班日、休息日） | `CalendarButton` | 回调给一天 |

- 值格式和原生输入框一样，替换原生框不改数据；值是墙上时间，属于哪个时区由宿主决定（例：审计日志按 UTC，分享到期按弹窗时区）。
- 框能直接打字：`2026-10-05`、`2026/10/5`、`10/5`（今年）；完整写法边输边生效，其它写法 Enter / 失焦生效，读不懂或越界的失焦退回并标红。点框只显示日历不抢焦点，↓ 或日历按钮进入：方向键换天、PageUp / PageDown 换月（Shift 换年）、Home / End、Enter 选、Esc 关。
- `min` / `max`（日期时间可到分钟）、`isDisabledDate`（周日不派单）挡住的日子不能选；`holidays` 由宿主给（`{ "2026-10-01": "off", "2026-10-10": "work" }`，显示休 / 班），**SDK 不带节假日日历**。`weekStart` 默认周一。
- 尺寸 `sm` 28 / `md` 36 / `touch` 44（公开页、手机）；手机上日期格自动 44px。在 `Dialog` / 弹出面板里照常用，日历挂在弹框里，Esc 只关日历。
- FormField 照常写 `htmlFor={id}`，把 `id` 给日期框；表格格子里的日期编辑（`BitableGrid` 的 date / datetime 字段）自带同一套日历。

<!-- bt/access-modules -->
## 附录 Q：权限按模块组织（§0.1 第 15 类「记录与字段」旁的权限部件，`@adminui/react/access`）

| 场景 | 用 | 要点 |
|---|---|---|
| 角色页按模块编辑权限 | `ModulePermissionEditor` | 每个模块一行：档位（统一 5 档 无 / 只看 / 成员·只看自己的 / 成员·按范围看 / 管理员）+ 能看到的数据 + 细调；不要再画「模块 × 操作」大表。集团下发的角色给 `readOnly={{ title, message, onCopy }}` |
| 「能看到的数据」下拉 | `DataScopeSelect` | 不要自己拼 `Choice` + `DataScopeDialog` |
| 保存前确认 | `PermissionDiff` | `changes = diffModuleGrants(...)`，`impact` 来自服务端试算；原因必填；影响过期只提醒 |
| 一个人按模块的最终权限 | `EffectiveAccessView` | 来源标签 + 「明细」展开 `EffectiveAccessTable` |
| 菜单上的待确认数 | `pendingCount(grants)` + `Count tone="attention"` | |

细则见 [ACCESS.md](ACCESS.md) §7；演示在 starter「系统 → 权限按模块」。

<!-- bt/flush -->
## 附录 R：工作区贴边（飞书式，`WorkspaceLayout` / `Pane` / `RailShell` 主区）

整屏工作区里**不再套卡片**：栏贴住分区标签条、侧栏和窗口边，栏与栏之间一条线；放进栏里的表格、列表面板、筛选栏、画册、表单搭建器、表格权限、有效权限、记录头部由 SDK 自动贴边，项目里不要再写 `border:0` / `padding:16px` 之类的覆盖，也不要自己包一层带内边距的 div。

| 要做的 | 用 | 要点 |
|---|---|---|
| 一个菜单项里几个分区，其中有整屏工作区 | `TabbedPage` + 分区里 `WorkspaceLayout` | 当前分区是工作区时标签条贴边、下面不留缝；同一页的卡片流分区照常有内边距（隐藏着的工作区分区不算） |
| 栏里放松散内容（表单、说明、字段块） | `Pane padding="sm" \| "md"` | 默认 `none` 贴边（列表、表格、视图）；`md` = 12px 16px |
| 栏里上下几块、最后一块撑满（工具栏 → 视图、筛选 → 表格） | `Pane fill` | 主体不滚，最后一块自己滚（同 RailShell 主区）；画册当最后一块时自动在块里滚；窄屏（≤ 1100px）上下排时卡片到外壳内容区底、撑满的栏长到卡片底（最多 80dvh），手机上不留灰条 |
| 栏头下面的提示（要确认、只读、7 天没跟进） | `Pane notice={<InlineAlert …/>}` | 离栏边 16px，不贴边；不要把提示条直接塞进贴边的主体 |
| 栏里的筛选行 | `QueryBar variant="flush"`（一条带底线的平条）/ `variant="bare"`（放进 Pane 头或 `ResourcePanel filters`，没有框和内边距） | 工作区里不写 variant 也自动是 flush 样子 |
| 一栏就是一个列表（右栏「最近跟进」） | `ResourcePanel` 直接当 `WorkspaceLayout` 的 `left` / `right` / 中间一栏 | 宽屏在栏里自己滚、表头吸顶、分页贴底；标题行和旁边 Pane 头一样高 |
| 看板 / 画册 / 日历 / 甘特上面的工具栏 | `GridToolbar features={{ rowHeight: false }}`（`@adminui/react/grid`） | 这些视图没有行，不要露「行高」；`BitableGrid toolbarFeatures.rowHeight` 同理 |
| 栏头放记录头部 | `Pane header={<RecordHeader …/>}` | 栏头里是平的（不再是浅色渐变块、不多一条线），`actions` 仍放 Pane |
| 栏里再分几个页签（画册 / 表格、资料 / 跟进） | 栏主体里直接放 `Tabs`（`children` 交给 Tabs 自己的 tabpanel） | 标签条贴边、下面不留缝；面板对贴边规则透明：里面的工具栏、表格、画册照样贴边，`Pane fill` 时面板吃掉剩下的高度、最后一块自己滚；不要再把标签条单独拿出来、丢掉 `aria-controls` / `role="tabpanel"` |
| 栏要 ref、右键菜单、埋点属性 | `Pane ref={…} onContextMenuCapture={…} data-*={…}` | 根元素 `<section>` 收 ref（React 19 ref 当 prop）和标准 DOM 属性 / 事件；`className` 和 `aui-pane` 合并；不要再包一层 div 去挂事件（会挡住贴边） |
| 文档阅读 / 编辑器页在窄屏（≤ 1100px）也贴边 | `WorkspaceLayout narrow="flush"` | 默认 `"card"` = 上下排成一张带框圆角卡片；`"flush"` = 外壳内容区不留内边距、没有外框圆角，栏贴左右边、上下一条横线，`TabbedPage` 分区标签条照样贴边；列表 / 工具页保持默认 |
| 文档正文 / 编辑器正文的文字颜色 | 正文容器加 `className="aui-neutral-text"`（`Pane className` 也行） | 子树里 `--aui-text` / `--aui-secondary` / `--aui-note` 换成纯中性灰 `--aui-neutral-1` / `-2` / `-2`（飞书 #1F2329 / #646A73），不带主色调；只用在读写大段文字的区域，列表、表单、导航照常用带主色调的文字色；`--aui-neutral-3`（占位、大字、图标，≥ 3:1）/ `-4`（禁用）不要拿来写小字正文 |
| 判断手机布局（目录进抽屉、两步走） | `useIsMobile()`（≤ 760px，同 SDK 断点）/ `useMediaQuery(query)` | 不要再在项目里复制 matchMedia hook；服务端渲染安全（先按不匹配渲染） |

贴边位置 = 没设 `padding` 的 `Pane` 主体、`RailShell` 主区、`WorkspaceLayout` 的栏，以及直接放在这些位置上的 `Tabs` 的标签页面板（`styles/flush.css`）；设了 `padding` 的 Pane 里组件保持原样。starter「系统 → 工作区贴边」（TabbedPage：客户表 / 画册 / 表单 / 表格权限 / 有效权限 / 记录 / 页签 / 文档 / 卡片流）；浏览器验收 `test:page-templates`、`test:views`、`test:access`、`test:records`、`test:form-builder`（共用 `test/flush-checks.mjs`：栏之间没缝、只有一条线、工作区里没有圆角 / 阴影卡片、没有叠在一起的两条线，1440 浅 / 深色 + 390；截图 `test/artifacts/*/flush-*.png`）；窄屏两种模式 390 / 900 浅 / 深色见 `test/narrow-checks.mjs`（截图 `test/artifacts/page-templates/narrow-*.png`）。

## 附录 S：反馈与弹层

- **先问还是先做**：能撤销的单条操作（删一条、移动、改阶段）**不弹确认**，直接做 + `useUndoToast()({ title, description, run, undo, commit? })`（「撤销」8 秒倒数）；撤不回、影响别人、批量 ≥ 20 条、删表 / 业务线、停用账号才用 `ConfirmDialog`（`confirmOrUndo` 判断）。确认弹框标题直接问对象、按钮写动作、影响写进 `impact` 数组、要输入名称用 `typeToConfirm`。
- **弹框**：`Dialog` / `FormDialog` 的 `size` 用 sm 420 · md 560 · lg 800 · xl 1080 · full；底栏用 `DialogFooter`（`danger` 最左、`hint`，`children` 按 取消 · 次要 · 主操作 的顺序）或 `FormDialog dangerAction / secondaryActions`；不要自己画分隔线（滚动时自动出）。
- **侧边弹层**：设置类 `SideSheet changes={N} cards`；评论 / 附件不挡表格 `SideSheet modal={false}`；手机表单 `BottomSheet onDone`。
- **菜单**：一律 `Menu` / `ContextMenu` / `MenuButton` / `MoreMenu` / `RowActions`（同一外观，手机自动变 `ActionSheet`）；多选菜单用 `header` 写对象、`label` 里写 `{count}`；不要自己写下拉菜单。
- **提示条**：`notify("已保存")` 仍可用；要对象 / 操作用 `notify.show({ title, description, action })`，长任务 `notify.progress(...)` 再 `update(...)`；失败不会自动消失，不要用提示条做表单校验。
- **空 / 错状态**：`StatePanel` 给 `title` + `message`（原因），出错给 `onRetry`（和 `details` 请求编号），搜不到给 `query` + `onClearSearch`，没权限用 `kind="forbidden"`、记录不在了 / 打错网址用 `kind="not-found"`（整页 `size="page"`），不要都写「暂无数据」。
- **通知中心**：`NotificationCenter` 是通用组件，宿主传 `loadNotifications / markRead / markAllRead / loadInbox / onInboxAction / onOpen`；「待我处理」只列当前用户能处理的，动作执行时服务端再判权限、写审计。
- **命令面板**：`CommandPalette` 的 `providers` 每个模块一个（按当前用户权限查、只回显示用的最少信息）；800ms 超时的组显示「较慢，回车看全部」（`onSearchAll`），每组 ≤ 5、总数 ≤ 30。
- **编辑冲突**：默认保留别人较新的值；表格 `onCellsChange` 对撞车的格子返回 `rejected: [{ rowId, field, error, conflict: { by, at, value } }]`，表格自动显示「重新填入我的 / 用我的覆盖」（覆盖时 `context.overwrite === true`）；详情多项保存用 `SaveConflictDialog`，打开期间被改用 `StaleRecordNotice`。
- **浮层定位**：任何浮起来的东西都走 `PopoverLayer` / `useLayerPosition`（`fixedOrigin` 实测包含块），不要手算减去弹框位置。

## 附录 T：导航与布局

- **外壳**：`AdminShell` 侧栏 232 / 折叠 64 / 顶栏 48。「切换公司」= `company`（品牌下，`options` + `onSwitch` 或 `onOpen`）；账号 = 左下一行头像 `account` + `accountMenu`（我的资料 / API 令牌 / 管理后台 `href` + `external` ↗）+ 外观 + `onSignOut`。账号区只有这一套，不要自己往侧栏底部加按钮。菜单数量 `badge`（要处理的 `badgeTone: "danger"`）、没开通 `locked`。
- **面包屑**：顶栏自动出（`crumbRoot` → 标签 `crumbs` 或菜单 `group` → 当前页），不要自己在页面顶部再写一条「工作空间 /」；记录页 / 文档页里的层级用 `Breadcrumbs`（灰色、当前页加粗，手机只留「← 上一级」）。
- **外观**：顶栏放 `AppearanceButton`（浅 / 深 / 跟随系统 + 色卡 + 字号）。不要另放明暗开关或单独的色卡 / 字号按钮。
- **工作标签**：多选关闭传 `onCloseTabs(ids)`；工作台标签 `pinned`。宿主别给工作标签另画样式，也别在手机上自己放标签条。
- **页内标签**：`Tabs` 只用下划线，放不下 SDK 自己出「更多 ⌄」；栏 / 卡片里换个看法用胶囊（`SegmentedControl` 或视图里的胶囊），筛选值用分段，三者别混。
- **设置**：设置页 `SideNavLayout`（`group` / `dirty` / `error`）+ 一条吸底 `SaveBar`；表设置这类抽屉用 `SettingsSheet`（`sections` 带 `group` / `icon` / `count` / `dirty` / `error`，`changes` + `onSave` + `onDiscard`），不要做成一长串卡片，也不要每节各放一个「保存」。
- **窄屏列表 → 详情**：列表 + 详情的页面（`ListDetailLayout`、`WorkspaceLayout`）传 `onBack` + `detailOpen`（`WorkspaceLayout` 再加 `narrow="steps"`），手机上先列表、点进详情、← 返回；桌面上照常两栏。宿主不要再做「换角色」按钮或上下叠一长卡。
- **分页 / 加载更多**：表格用页码（`DataTable pagination`）；时间线 / 动态 / 评论底部用 `LoadMore`（`shown` / `total` / `loading` / `error` / `onLoadMore`）。
- **步骤**：`Steps` 的 `status: "waiting" | "error"`、`description`、`onStepClick`、`orientation="vertical"`；做完的步骤字不要再改成灰色。
- **登录**：`AuthLayout` + `LoginForm`，**登录按钮永远不 disabled**，`onSubmit` 抛 `Error(人话原因)`；公开页 `PublicPageLayout logo`。

## 附录 U：协作、分享与媒体

- **一屏一个实心主按钮**：分享弹框只有「复制」是实心，「完成」描边；AI 建议的「采用」是描边（主色字）、「忽略」幽灵；审批详情只有「批准」实心、「驳回」描边异常色。
- **改前 → 改后只有一种写法**：`ChangeValue before after`（旧值备注色删除线 → 新值加粗；`before` 为 `null` / 空 = 「空」不划线；`unit`、`stacked`）。修改历史、操作记录、AI 建议、冲突表、权限对比、分享访问记录都已经用它；宿主自己的改前改后也用它，不要拼红绿底色。
- **评论**：只用 `CommentThread`（见附录 J「评论」一行）。默认「未解决」、回应 4 种、行内小工具悬停才出、手机常显。
- **行内操作**：一行 / 一条上的小按钮（评论小工具、复制、恢复版本、看大图里的工具）悬停或键盘聚焦才出现（用 `opacity`，按钮仍在 Tab 顺序里），触屏（`hover: none`）和 ≤ 760px 常显。
- **头像**：一律 `Avatar`（按账号 id 在选项色里取一种，灰色留给离职 / 系统 / 自动化），不要自己画同一个主色圆。
- **媒体浮层**：照片 / 视频上的字和遮罩只用 `--aui-on-media` / `--aui-media-scrim*` / `--aui-media-stage`；录音红 `--aui-record*` 只给录音键、录音中圆点和字、录音波形，出错用异常色。
- **滚动条**：都是 foundations 的细滚动条，组件里不要写 `scrollbar-width` / `scrollbar-color`（横向条要隐藏的写 `none`）。
- **审批**：一切审批（报价折扣、请假、费用、权限申请）用 `ApprovalList` + `ApprovalDetail` + `ApprovalProgress`（列表 + 详情配 `ListDetailLayout`，手机列表 → 详情），记录详情里嵌 `ApprovalProgressCard`。数据 `ApprovalRequest`：`requester`、`title`、`typeLabel`、`reason`、`createdAt`、`status`（pending / approved / rejected / withdrawn）、`steps`（`{ key, label, approvers, mode: "any" | "all", decisions: [{ approver, decision, reason, at }] }`，审批人由服务端从角色 / 上级解析好）、`currentStep`、`summary`（申请时的快照，用 `renderSubject` 画）。驳回必须写原因（组件拦一次，服务端再拦）；谁能批 / 撤回只是显示（`canDecide` / `canWithdraw`），服务端再判。组件里不写业务词，「批准后能做什么」这类说明由宿主放进 `renderSubject`。

## 附录 V：组织选人

- **所有「选人 / 部门 / 角色 / 业务线 / 公司」都用它**：分享给谁、字段 / 表 / 记录授权、知识库页面权限与协作者、培训指派、审批人、CRM 转交 / 分配、角色 → 成员。大场合 `OrgPicker`（弹框），小场合 `OrgPickerField`（行内，找不到点「组织架构」）；`GrantList mode="picked"` / `ShareDialog people` 给 `orgSource` 就自动换成它（懒加载）。不要再自己写「搜索框 + 平铺列表」，不要让人输 id / 编号。`OrgTreePicker` / `UserTransfer` 已弃用。
- **数据只走 `OrgDataSource`**（`@adminui/react/org-picker`）：`roots()`、`loadChildren(id)`（展开时）、`loadMembers(id, { deep, cursor })`（分页，`hiddenDeparted` = 不显示的离职人数）、`search(q, { kinds, limit })`（**服务端搜**：拼音首字母、职务、公司名，回 `path` + `ancestors`）、`resolve(refs)`（回显：标签、路径、离职状态）、`pathOf?(id)`（定位）。服务端按「看的人」的可授权范围过滤；组件不认识 quanxian。
- **范围由宿主说**：`availability(ref)` → `ok` / `locked`（灰 + 锁 + 原因「找谁开」）/ `partial`（能展开不能整选）/ `hidden`（不显示）。默认做法：本公司内超出范围的灰掉带锁写原因，别的公司对没有跨集团授权的人隐藏；`lockedHint` 写「跨公司分享要集团管理员开通」，只接在没有原因的锁定提示后面（`availability` 给的原因原样显示，里面写清找谁）。
- **打开位置 `defaultFocus`**：宿主按「我」算（多部门的人用主部门 = 第一个隶属，或宿主指定），**只定位不勾选**；预选跟场景走（分享不预选、审批人默认直属主管、培训默认上次那批）由宿主传 `value`。
- **已在名单里的**：`existing`（`subjectKey` `person:u1` 或 id → 「已授权 · 可读写」）灰掉、下拉里不出现，改档位回名单里改。**已离职但还在授权里的**：`value` 里带 `status: "left"`（或 `resolve` 回来），右栏划掉写「已离职」，只能手动 × 去掉——**确定时不悄悄丢掉**（权限变化必须显式）；GrantList 的行用 `GrantEntry.status`。
- **模式**：`mode="single"`（圆点、760 宽、点一行就选上，底栏写选了谁）、`selectable`（`["person"]` = 只选人，树上没有勾选框；默认人 + 部门 + 公司 + 额外分页的种类）、`max`、`includeSubDefault`（默认 true）、`extraSources`（角色 / 业务线 / 公司 / 最近，`PickerSource.list({ query })`）、`shortcuts`、`emptyAction`。
- **输出**：`onChange(next, picks)`——`next` 是 `PickedSubject[]`（带 status / ancestors，回填用），`picks` = `toOutput(next)` = `{ kind, id, label, path, includeSub }`（存库 / 发给服务端用这个）；只在「确定」时回调。`OrgPickerField commit="instant"`（默认，选了立刻进名单：分享、立即生效的名单）/ `"batch"`（攒成标签点「添加 N 个」：要点保存的表单）。
- **多语言**：`locale`（zh-CN 默认 / zh-TW / en）+ `messages` 覆盖任意一条（`ORG_PICKER_MESSAGES` 看全部键）；人数走 Intl。
- 服务端照样逐条校验授权范围，前端灰掉只是显示。
