import type { ComponentDoc } from "./types";

/**
 * Page templates: every back-office page starts from one of these. The layout is fixed, only the content changes.
 * Each doc shows one template as a live whole page (switch the preview to 手机 390 to see the phone layout).
 */

const COMMON_DONTS = "不要再写一个和页名重复的大标题或介绍段落：外壳的侧栏、标签和面包屑已经写了页名，说明收进「?」。";

const home: ComponentDoc = {
  slug: "tpl-home",
  title: "工作台首页",
  subtitle: "StatStrip · SplitLayout · TodoInbox · ActionList · PresenceList · QuickLinks · LiveStatus",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "登录后的第一屏：回答「现在正不正常、要我做什么、常去哪」。一排指标、一列待办和最近的操作、一条右栏放在线的人和常用入口。",
  keywords: "home dashboard workbench landing 首页 工作台 待办 概况 常用入口 在线 T01",
  when: [
    "登录后的首页，或某个角色（销售、客服、财务）的工作台。",
    "要让人一眼看到异常、马上去处理，而不是看报表。",
    "页面上的数字都能点进对应的列表页。",
  ],
  whenNot: [
    "复盘一段时间的趋势和排行 —— 用统计看板页。",
    "只看「我」自己的东西（我的客户、我的密钥）—— 用同样骨架的个人页：我的指标带 + 最近用过 + 要留意的事 + 右栏 440 我的接入。",
  ],
  anatomy: [
    "① 指标带 StatStrip：一张卡一排 4–6 个数，每个数下面一行说明（和昨天比、拆分、原因）；标题行右端放 LiveStatus 和刷新",
    "② 主栏：TodoInbox 待办（「全部 / 今天 / 知道一下」带数量的分段，每条最多 2 个按钮，没问题的事收成一行小标签）",
    "③ 主栏：「最近的操作」Panel flush + ActionList dense，一行一条",
    "④ 右栏 340：PresenceList 此刻在线（小计数 + 每人一行）+ QuickLinks 常用入口方块",
  ],
  states: [
    "待办处理完：这一条消失；全部处理完显示「都处理完了」。",
    "某个指标需要注意：数字或说明行用 attention / danger 色，不加色条。",
    "实时数据：LiveStatus 显示「实时 · 几秒前」；断开时变灰并写原因。",
    "1100px 以下：右栏排到主栏下面；手机上指标带两列。",
  ],
  dos: [
    "待办按紧急程度排，最急的在上面；每条写清对象、原因、已经多久。",
    "没问题的事也说出来，但只收成一行小标签（「续约提醒都已发出」），让人放心又不占地方。",
    "指标带最多 6 个数；超过就拆分区或换统计看板页。",
    "常用入口 8 个以内，图标 + 两到四个字。",
  ],
  donts: [
    COMMON_DONTS,
    "不要把报表图表堆在首页：首页回答「要我做什么」，趋势放统计看板页。",
    "不要让待办只有标题没有按钮：每条都要能直接处理，或者跳到能处理的地方。",
    "不要用大块彩色卡片或装饰色条区分指标：一张卡、细分隔线，颜色只给需要注意的数。",
  ],
  a11y: [
    "StatStrip、TodoInbox、ActionList 都是带名字的列表（aria-label），读屏能逐条读。",
    "待办的分段筛选是一组 aria-pressed 按钮，方向键移动，数量是按钮文字的一部分。",
    "QuickLinks 每个方块是按钮或链接，图标 aria-hidden，文字就是名字。",
    "LiveStatus 用 role=status 播报「已断开」，不只靠颜色。",
  ],
  demos: [{ id: "templates/home", title: "销售团队工作台", description: "点待办里的「去处理」，这一条会消失；切到「知道一下」看分类。", bleed: true, height: 680 }],
};

const list: ComponentDoc = {
  slug: "tpl-list",
  title: "资源列表页",
  subtitle: "ResourcePanel · QueryBar · DataTable · RowActionBar · PageBody",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "管理一类会增长的对象：找、筛、逐行操作。一张列表卡撑满一屏：标题行 → 筛选行 → 固定行高的表格 → 分页。",
  keywords: "list page resource table crud filter bulk 列表页 资源 客户列表 筛选 批量 分页 T02",
  when: [
    "客户、成员、发票、产品这类对象的主列表。",
    "要搜索、按几个条件筛、对一行或多行做操作。",
    "一个菜单下有几个相关列表（成员 / 角色 / 邀请）时，用 TabbedPage 分区，每个分区照写本模板（分区合并页）。",
  ],
  whenNot: ["列表上方还要先看几个数正不正常 —— 用指标 + 列表页。", "一屏的表格工作区（左边目录、视图切换、行内编辑）—— 用多维表格的 RailShell + BitableGrid。"],
  anatomy: [
    "列表卡 ResourcePanel：标题 · 数量和单位（「24 家」）· ? · 页面按钮（导出、新建）",
    "筛选行 QueryBar：搜索框 + 2–3 个 Choice + 查询 / 重置",
    "表格 DataTable：固定行高；第一列主文字 + 一行灰字；操作列 RowActionBar 最多露 3 个，其余进 ⋯",
    "底部：合计 + 分页；勾选行后底部浮出批量操作条，不推动表格",
    "外层 PageBody fill：卡片撑满一屏，空表居中，分页贴底",
  ],
  states: [
    "加载：骨架行，行高不变。",
    "空：表格区域居中一句话 + 主操作（「还没有客户 · 新建客户」）；筛选后为空写「没有符合条件的客户 · 清空筛选」。",
    "出错：表格区域居中错误说明 + 重试，筛选条件保留。",
    "勾选：底部浮出「已选 N 项」+ 批量操作 + 取消。",
  ],
  dos: [
    "页面按钮并进列表卡的标题行右端，不单独占一行。",
    "数量带单位：「24 家」「86 人」「12 张」。",
    "状态用 StatusBadge、选项用 CellTags 的选项色，人用 CellPeople。",
    "列表必分页；每页条数可选，翻页和筛选都保留勾选以外的状态。",
  ],
  donts: [
    COMMON_DONTS,
    "不要在一行里摆五六个按钮：最多露 3 个，低频和危险的进「⋯」。",
    "不要让行高随内容变化：长文字截断，完整内容放展开或详情里。",
    "不要把筛选条件放进弹窗：常用的 2–3 个直接放筛选行，其余收进「更多筛选」。",
    "不要让卡片下面留一大块空白：不在分区里时用 PageBody fill。",
  ],
  a11y: [
    "DataTable 的 caption 是表格的读屏名称，表头是真正的 th，每行勾选框都有读屏名。",
    "RowActionBar 的「⋯」有 aria-label「某某的更多操作」，菜单用方向键选择。",
    "批量条是 toolbar：已选数量用 aria-live 播报，左右方向键在按钮间移动，Esc 清空选择。",
    "QueryBar 在搜索框里回车即查询。",
  ],
  demos: [{ id: "templates/list", title: "客户列表", description: "搜索、按阶段 / 负责人 / 行业筛选、翻页；勾选几行看底部的批量条。", bleed: true, height: 680 }],
};

const kpiList: ComponentDoc = {
  slug: "tpl-kpi-list",
  title: "指标 + 列表页",
  subtitle: "TabbedPage · MetricGrid · MetricCard · TodoInbox · ResourcePanel · DataTable",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "先看几个数正不正常，再处理列表：分区标签行 → 一排紧凑指标卡 → 「要处理的」（有才出现）→ 列表卡。",
  keywords: "kpi list metrics tickets backups alerts 指标 列表 工单 备份 告警 要处理的 T03",
  when: [
    "工单、告警、备份、额度这类「先看健康度、再逐条处理」的页面。",
    "指标和列表说的是同一批对象（17 个打开的工单 → 下面就是这 17 个工单）。",
  ],
  whenNot: ["数字要和上一期对比、看趋势 —— 用统计看板页。", "只有列表没有指标 —— 用资源列表页。"],
  anatomy: [
    "① 分区标签行 TabbedPage：右端放 LiveStatus · ? · 页面按钮（第一块是指标卡时，按钮自动放到这里）",
    "② 紧凑指标卡 MetricGrid + MetricCard 一排（每张不超过 90px 高）；有对比基准时用 KpiGrid + KpiCard",
    "③ TodoInbox「要处理的」：只在有问题时出现",
    "④ 列表卡 ResourcePanel + DataTable；操作列可以放一个即时生效的 Switch + RowActionBar",
  ],
  states: [
    "没有要处理的事：「要处理的」整块不出现，不显示空卡片。",
    "处理掉一条：对应的指标同时更新（「已超时 1 → 0」）。",
    "分区切换：已打开过的分区保持筛选和页码（keepMounted）。",
  ],
  dos: [
    "指标只放 3–4 个，每个一行说明「和什么比、为什么」。",
    "进度、占比、时限用 RatioBar，超过阈值换 attention / danger 色。",
    "即时生效的开关（关注、启用）可以直接放在行里，不进保存流程。",
  ],
  donts: [
    COMMON_DONTS,
    "不要让「要处理的」常驻显示「暂无」：没有就不出现。",
    "不要把指标做成大卡片配插图：一排紧凑卡，数字和单位就够了。",
    "不要把页面按钮单独放一行：并进分区标签行右端。",
  ],
  a11y: [
    "分区标签是 tablist，左右方向键切换，数量是标签名的一部分。",
    "MetricCard 的标题、值、单位按顺序读出。",
    "行内 Switch 的 aria-label 写清对象（「T-2041 关注更新」）。",
  ],
  demos: [{ id: "templates/kpi-list", title: "工单", description: "点「我来处理」，「要处理的」消失、超时数归零；行里的开关即时生效。", bleed: true, height: 680 }],
};

const stats: ComponentDoc = {
  slug: "tpl-stats",
  title: "统计看板页",
  subtitle: "StatStrip · SplitLayout · AdminChart · BarList · RatioBar · DataTable",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "复盘一段时间的用量、收入或趋势：概况卡（时间范围 / 筛选 / 导出在标题行）→ 两列：趋势图 | 占比 → 两列：明细表 | 排行。",
  keywords: "stats analytics usage report chart ranking 统计 看板 用量 收入 趋势 排行 占比 T04",
  when: [
    "销售业绩、用量、花费、存储这类按时间段复盘的页面。",
    "要回答「这段时间多少、怎么变的、谁占多少」。",
  ],
  whenNot: [
    "复杂的经营看板、实时大屏 —— 先按「业务类型 × 用途 × 受众」写分类卡，再用仪表盘套件或看板搭建器。",
    "要处理一条条对象 —— 用指标 + 列表页。",
  ],
  anatomy: [
    "① 概况卡 StatStrip：标题 · 时间段文字；标题行右端 SegmentedControl 时间范围 + Choice 筛选 + 导出；下面一排 4 个数",
    "② SplitLayout railWidth=380：左 AdminChart 趋势（从 @adminui/react/charts 懒加载）| 右 BarList 占比",
    "③ SplitLayout railWidth=380：左明细 DataTable（占比列用 RatioBar）| 右 BarList ranked 排行",
  ],
  states: [
    "图表加载中：LoadingDots 占位，其他卡片先显示。",
    "某人这段时间没有数据：占比列写「这段时间没有签约」，不画 0 长度的条。",
    "1100px 以下：两列变上下排。",
  ],
  dos: [
    "图表库从 /charts 子路径懒加载，首屏不等它。",
    "时间范围改了，标题行的时间段文字一起变。",
    "占比条和排行只用主色；需要注意的值才换色。",
    "说明口径（「按合同生效日期」「北京时间」）写进 ? 或卡片描述。",
  ],
  donts: [
    COMMON_DONTS,
    "不要给每个系列随手配色：用色卡顺序，深色模式同一套。",
    "不要把筛选放在页面顶部单独一行：放进概况卡的标题行。",
    "不要用饼图表示 5 个以上的占比：用 BarList。",
  ],
  a11y: [
    "AdminChart 必须有 label；图表旁边有同一组数的表格（明细）作为文字版本。",
    "SegmentedControl 是一组 aria-pressed 按钮，方向键在选项间移动。",
    "RatioBar 带 label 和数值文字，不只靠条的长度。",
  ],
  demos: [{ id: "templates/stats", title: "销售统计", description: "切换时间范围，趋势图跟着变；图表是懒加载的。", bleed: true, height: 720 }],
};

const log: ComponentDoc = {
  slug: "tpl-log",
  title: "日志 / 时间线页",
  subtitle: "LogTimeline · ResourcePanel · QueryBar · SegmentedControl",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "按时间发生的记录：操作日志、登录记录、自动化任务、告警历史。按天分组一行一条，展开看改前改后，底部加载更多。",
  keywords: "audit log timeline history activity 日志 审计 操作记录 时间线 改前改后 T06",
  when: [
    "全公司的操作日志、登录记录、自动化运行记录、告警历史。",
    "要按时间、操作人、动作检索，并看清每次改了什么。",
  ],
  whenNot: ["一条记录自己的历史（某个客户的变更）—— 在详情里用 ActivityFeed。", "看对象之间的连接和此刻状态 —— 用关系图 / 监控页（GraphLayout）。"],
  anatomy: [
    "一张卡 ResourcePanel：标题 · 条数 · ? · 导出",
    "筛选行 QueryBar：SegmentedControl 时间范围（今天 / 7 天 / 30 天 / 自选）+ Choice 操作人 / 动作 + 搜索",
    "LogTimeline：按天分组，每行「时间 · 谁（自动化带标）· 做了什么 · 对象 · 结果 · 展开」",
    "展开：来源、请求号等元信息 + 字段的改前 → 改后",
    "底部：「已显示 6 / 9 条」+ 加载更多",
  ],
  states: [
    "首次加载：44px 骨架行。",
    "空：卡片中间「这段时间没有记录」+ 一句换个条件的建议。",
    "加载更多中：按钮转圈，已显示的行不动。",
    "结果：成功（绿）、无权限（琥珀）、失败（红），都是浅底文字标签。",
  ],
  dos: [
    "人和自动化分开标：自动化、AI 带标记，筛选里能「只看自动化」。",
    "只改了一个字段时可以把改动直接写进这一行（inlineDiff）。",
    "敏感值在展开里由页面先打码，再交给 LogTimeline。",
  ],
  donts: [
    COMMON_DONTS,
    "不要用分页器翻日志：按时间流，底部加载更多。",
    "不要只写「修改了客户」：写清改了哪个字段、从什么改成什么。",
    "不要在手机上横向滚动日志：每条拆成几行显示。",
  ],
  a11y: [
    "caption 是日志的读屏名称（「操作日志」）。",
    "展开按钮带 aria-expanded 和「展开详情 / 收起详情」的名字，改前改后紧跟在这一行后面。",
    "结果标签有文字，不只靠颜色。",
  ],
  demos: [{ id: "templates/log", title: "操作日志", description: "第一条默认展开看改前改后；点「加载更多」，按「只看自动化」筛选。", bleed: true, height: 680 }],
};

const settings: ComponentDoc = {
  slug: "tpl-settings",
  title: "设置 / 表单页",
  subtitle: "SideNavLayout · SaveBar · Panel · FormSection · FormField · DescriptionList",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "一页有好几组配置：左边分节导航，右边一节一张卡；改了东西才在底部浮起一条保存条，一次保存全部。",
  keywords: "settings preferences form sections save bar 设置 偏好 表单 分节 保存条 未保存 T08",
  when: [
    "公司设置、通知偏好、安全策略、开票信息这类几组字段的页面。",
    "既有只读事实（套餐、到期日）又有可改的项。",
    "同样的设置放在抽屉里（表格设置）时用 SettingsSheet：左 184 分节 + 右边一次一节 + 底部保存条。",
  ],
  whenNot: ["按顺序走几步才能完成 —— 用向导页。", "改一个人对一批对象的权限 —— 用权限配置页。"],
  anatomy: [
    "左 200 分节导航 SideNavLayout：分组小标题 + 34px 行；滚动时高亮当前节；改过的节琥珀圆点，出错的节红色叹号；窄屏变成吸顶的横向胶囊",
    "右边一节一张 Panel：只读事实用 DescriptionList 字段方块；可改项 FormSection 两列，标签在上",
    "FormField changed：改过的字段带「已改」",
    "底部 SaveBar sticky：改了 N 处 · 有误 N 处 · 放弃 / 保存",
  ],
  states: [
    "没改动：没有保存条。",
    "有改动：保存条浮起，写出改了哪些字段。",
    "有错误：对应字段红字说明，导航上这一节带红色叹号，保存条写「1 处有误」，保存会被拦下并说原因。",
    "保存中：保存按钮转圈；失败时保存条保留并显示原因。",
  ],
  dos: [
    "整页一条保存条，每节不各放保存按钮。",
    "即时生效的开关不计入改动数，并在提示里说明「立即生效」。",
    "提示只在需要时写（影响范围、格式要求），不给每个字段配一句废话。",
  ],
  donts: [
    COMMON_DONTS,
    "不要每节放一个「保存」按钮：人会以为别的节也保存了。",
    "不要一直显示一个灰掉的保存按钮：没改动就不出现保存条。",
    "不要把只读事实做成禁用的输入框：用字段方块显示。",
  ],
  a11y: [
    "分节导航是 nav，当前节 aria-current=location；点一项平滑滚动到这一节。",
    "FormField 把 hint 和 error 关联到控件（aria-describedby），出错时控件带 aria-invalid。",
    "保存条是带名字的 region，「改了 N 处」用 aria-live 播报。",
  ],
  demos: [{ id: "templates/settings", title: "公司设置", description: "已经改了一处（每日摘要），保存条浮在底部；把发票邮箱改错，看导航上的红色叹号。", bleed: true, height: 680 }],
};

const matrix: ComponentDoc = {
  slug: "tpl-matrix",
  title: "权限配置页",
  subtitle: "ListDetailLayout · SelectList · Pane · DataTable · ChangeMark · SaveBar",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "谁能对哪些对象做什么：左边选角色或成员，右边对象 × 权限的勾选格；改过的格带浅色框，下面一条改动汇总。",
  keywords: "permissions matrix roles access grants rbac 权限 角色 授权 矩阵 勾选 T09",
  when: [
    "角色权限、成员授权、分组成员、分享范围。",
    "一次要改一个人或一个角色对一批对象的权限。",
    "按模块、动作的标准角色权限直接用 @adminui/react/access 的 PermissionMatrix。",
  ],
  whenNot: ["只是一组普通设置 —— 用设置 / 表单页。", "看某个成员最终有哪些权限 —— 用权限套件的有效权限视图。"],
  anatomy: [
    "一张卡 Panel flush：标题 · ? · 新建",
    "左 260 SelectList：搜索 + 分组标题（带数量）+ 选中高亮；行 36，有 hint 时两行 52，手机 44",
    "右 Pane bare：选中对象的图标、名字、说明",
    "DataTable：对象行 × 权限列的 Checkbox，改过的格包在 ChangeMark 里",
    "SaveBar inline：改了 N 处 · 撤销 · 保存；Pane 底部一行图例",
  ],
  states: [
    "改了格子：浅色框 + 汇总条写出「客户 加上导出」。",
    "搜不到：列表写「没有找到「…」」，可以给「新建」。",
    "加载：SelectList 骨架行。",
    "手机：先只看列表，点一行进详情，左上「←」回列表（ListDetailLayout detailOpen + onBack）。",
  ],
  dos: [
    "不在分区里时用 PageBody fill，整张卡撑满一屏。",
    "图例写清「勾选 = 有这项权限；浅色框 = 改过、还没保存」。",
    "继承来的权限写清来源（「角色里的成员自动继承」）。",
  ],
  donts: [
    COMMON_DONTS,
    "不要每勾一格就立即保存：改完一起保存，可以整体撤销。",
    "不要用颜色区分人和组：用图标（组）和字母头像（人）。",
    "不要在手机上把列表和矩阵挤在一屏：分两步。",
  ],
  a11y: [
    "SelectList 每一行是按钮，选中的一行 aria-current；搜索命中用 mark 高亮，未读数有读屏文字。",
    "每个 Checkbox 的 aria-label 写「对象 + 权限」（「客户 导出」）。",
    "ChangeMark 给改过的格加读屏文字「改过、还没保存」。",
  ],
  demos: [{ id: "templates/matrix", title: "角色权限", description: "勾几个格子，看浅色框和下面的改动汇总；切到手机看列表 → 详情两步。", bleed: true, height: 680 }],
};

const workspace: ComponentDoc = {
  slug: "tpl-workspace",
  title: "工具 / 工作区页",
  subtitle: "WorkspaceLayout · Pane · SelectList · ChatThread · ChatMessage · ToolCallCard · Composer",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "占满一屏的工具：AI 助手、在线客服、终端、文档。页面本身不滚：左 240 列表 | 中间工作区（自己滚，底部输入框）| 右 280 上下文。",
  keywords: "workspace chat assistant ai tool three pane 工作区 对话 助手 AI 客服 三栏 T10",
  when: [
    "AI 助手、在线客服会话、网页终端、远程桌面、文档阅读这类整屏工具。",
    "左边一列条目、中间一块工作区、右边当前对象的上下文。",
    "要看工作项进度（任务、长流程）时，用同一套块的进度页：WorkItemList + WorkItemCard。",
  ],
  whenNot: ["一个模块占一整屏、左边目录右边表格 —— 用表格工作区（RailShell + NavTree + BitableGrid）。", "普通的卡片流页面 —— 用 PageBody。"],
  anatomy: [
    "WorkspaceLayout：自动量出高度占满可用区域；宽屏贴边，栏与栏一条线分隔，不做成一张张卡片",
    "左 Pane：SearchField + 新建 + SelectList（按天分组；未读 unreadCount = 名字加粗 + 数量徽标）",
    "中 Pane：标题行 + ChatThread（ChatMessage、ToolCallCard、要确认的 InlineAlert、LoadingDots）+ 底部 Composer",
    "右 Pane：PaneSection 分小节，InfoList / DescriptionList / Meter",
  ],
  states: [
    "助手回复中：LoadingDots 带文字「正在回复」。",
    "需要人确认的操作：消息里一条 InlineAlert，按钮写清后果。",
    "1100px 以下：栏上下排；narrow=\"card\" 排成一张圆角卡片，文档页用 narrow=\"flush\" 贴边。",
    "手机：narrow=\"steps\" —— 先列表，点进去看对话，左上「← 返回列表」。",
  ],
  dos: [
    "只让栏自己滚，页面本身不滚；输入框始终贴在中间栏底部。",
    "工具调用折叠成一行（命令 + 结果标签），输出点开再看。",
    "会改数据或发消息的操作先让人确认，写清影响范围。",
  ],
  donts: [
    COMMON_DONTS,
    "不要把三栏做成三张有间距的卡片：贴边、一条线分隔。",
    "不要让整页随对话一起滚：输入框和列表会被滚走。",
    "不要让 AI 不经确认就执行发邮件、删数据这类操作。",
  ],
  a11y: [
    "三栏各是带名字的 section；ChatThread 是 role=log，新消息会被读出。",
    "每条 ChatMessage 是 article，名字是「某某的消息」。",
    "Composer：Enter 发送、Shift+Enter 换行，提示写在输入框下面。",
  ],
  demos: [{ id: "templates/workspace", title: "客户成功助手", description: "在底部输入一句话发送，看回复；切到手机看列表 → 对话两步。", bleed: true, height: 680 }],
};

const wizard: ComponentDoc = {
  slug: "tpl-wizard",
  title: "向导页",
  subtitle: "WizardLayout · ChoiceTiles · FormField · InlineAlert · ActionList · InfoList",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "要按顺序走几步的操作：导入、接入数据源、激活。居中一张向导卡（步骤条 → 每步一块内容 → 上一步 / 下一步）+ 右侧 260 小卡。",
  keywords: "wizard stepper onboarding import multi-step 向导 步骤 导入 接入 激活 T12",
  when: [
    "导入客户、接入数据源、开通集成、激活授权。",
    "后一步依赖前一步的结果（先选来源，才知道要上传什么）。",
    "导入 CSV / Excel 时优先用现成的 ImportWizard。",
  ],
  whenNot: ["几组互不依赖的配置 —— 用设置 / 表单页。", "一个简单的新建表单 —— 用对话框或抽屉。"],
  anatomy: [
    "WizardLayout 居中卡（最宽 880）：标题行（? · 一句灰色提示 · 关闭）",
    "步骤条 Steps（stretch）",
    "当前步的内容：ChoiceTiles 大选项、FormField、CopyBlock 命令、InlineAlert 等待状态",
    "底栏：上一步 / 下一步；不能下一步时在按钮旁边写原因（nextDisabledReason）",
    "右侧 260（aside）：常见问题 ActionList wrap + 最近记录 InfoList",
  ],
  states: [
    "不能下一步：按钮不可点，旁边一句原因（「先上传文件，才能对应字段」）。",
    "等待外部结果：InlineAlert「正在等…已等 00:42」+「马上检查」。",
    "最后一步：按钮变成「开始导入」；完成后给下一步去哪。",
    "窄屏：右侧小卡排到向导卡下面。",
  ],
  dos: [
    "步骤 3–5 步，每步只问一件事。",
    "2–4 个互斥大选项用 ChoiceTiles，每个带一行说明。",
    "能自动猜的先替用户填好（字段对应），让人确认而不是从零选。",
    "关掉向导会不会丢东西，在标题行写一句。",
  ],
  donts: [
    COMMON_DONTS,
    "不要让「下一步」灰着却不说为什么。",
    "不要把所有步骤的字段塞进一个长表单。",
    "不要在最后一步才报前面的错：哪一步的问题在哪一步拦下。",
  ],
  a11y: [
    "步骤条是有序列表，当前步 aria-current=step。",
    "ChoiceTiles 是 radiogroup，方向键切换。",
    "不能下一步时按钮禁用，原因是写在按钮旁边的可见文字，读屏按顺序读到。",
  ],
  demos: [{ id: "templates/wizard", title: "导入客户", description: "选来源 → 上传文件（没上传时「下一步」旁边写原因）→ 对应字段 → 完成。", bleed: true, height: 680 }],
};

const publicPage: ComponentDoc = {
  slug: "tpl-public",
  title: "公开页",
  subtitle: "PublicPageLayout · PublicResult · PublicForm · FormSuccess · FormBrand",
  group: "templates",
  importFrom: "@adminui/react",
  summary: "不用登录、从链接打开的页面：填表、提交成功、链接已失效、访客看分享的记录。没有后台外壳：品牌条 + 居中一栏 + 底部一句说明。",
  keywords: "public page form landing success expired share no login 公开页 表单 提交成功 链接失效 免登录 T16",
  when: [
    "对外收集信息的表单（申请试用、满意度回访、报名）。",
    "提交成功、链接已失效、已撤回这类结果页。",
    "访客打开分享的记录（SharedPageShell + SharedRecordCard）、密码门（PasswordGate）、一次性密钥（SecretReveal）。",
  ],
  whenNot: ["登录后的后台页面 —— 放在 AdminShell 里用其他模板。", "登录页 —— 用 AuthLayout + LoginForm（居中 420）。"],
  anatomy: [
    "品牌条：标志方块 + 名字 + 一行灰字；表单页右端「已填 4 / 7 题」+ 一条细进度线",
    "居中一栏：填表 688、提交成功 560、其他结果页 440（PublicPageLayout width）",
    "表单：标题（公开页显示标题）+「带 * 的是必填」+ 一两行说明 + 题目 + 整宽提交按钮",
    "结果页 PublicResult：大圆状态图标 + 标题 + 下一步 + 灰色时间 + 摘要 + 操作",
    "底部一句说明（谁提供、信息怎么用）",
  ],
  states: [
    "提交中：按钮转圈，答案保留；失败写原因，可以再提交。",
    "提交成功：FormSuccess，带提交内容摘要和「再填一份」。",
    "链接失效 / 撤回：PublicResult tone=warning / danger，告诉人接下来找谁。",
    "手机：一栏整宽、卡片去边框，品牌条带进度吸顶；按钮和输入框至少 44px。",
  ],
  dos: [
    "表单直接用 PublicForm（@adminui/react/forms-public），自带品牌条、进度、校验和上传。",
    "提交按钮一直能点，点了再校验并滚到第一个错误。",
    "结果页一定写「接下来会怎样 / 该找谁」。",
  ],
  donts: [
    "不要套后台外壳（侧栏、标签条）：访客没有登录。",
    "不要画插画、用装饰渐变：品牌条是白底 + 标志 + 名字。",
    "不要只写「链接无效」：说清原因和下一步。",
    "不要在手机上用小于 44px 的按钮和输入框。",
  ],
  a11y: [
    "页面有唯一的 h1（表单标题或结果标题）。",
    "每道题的控件用 aria-labelledby 指向题目、aria-describedby 指向说明和错误，出错时带 aria-invalid。",
    "进度「已填 4 / 7 题」是 aria-live 文字，不只靠进度线。",
    "结果图标 aria-hidden，标题文字说明结果。",
  ],
  demos: [
    { id: "templates/public-form", title: "申请试用表单", description: "填完必填题提交，看提交成功页和摘要；切到手机看吸顶进度。", bleed: true, height: 720 },
    { id: "templates/public-result", title: "结果页：已失效 / 已撤回 / 已处理", bleed: true, height: 640 },
  ],
};

export const templatesDocs: readonly ComponentDoc[] = [home, list, kpiList, stats, log, settings, matrix, workspace, wizard, publicPage];
