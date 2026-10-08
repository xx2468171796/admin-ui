import type { ComponentDoc } from "./types";

const button: ComponentDoc = {
  slug: "button",
  title: "按钮",
  subtitle: "Button · IconButton · ButtonGroup · MoreMenu",
  group: "basics",
  depth: "deep",
  importFrom: "@adminui/react",
  summary: "7 种样式 × 4 档尺寸的一套按钮。主按钮纯色、无渐变无投影；加载时锁住宽度；不能点时说清楚为什么。",
  keywords: "button icon-button 按钮 图标按钮 按钮组 更多 加载 禁用",
  when: [
    "触发一个动作：保存、提交、新建、导出。跳转到别的页面用链接（Link），不用按钮。",
    "工具栏：一个主按钮 + 若干幽灵按钮，低频操作收进「⋯」（MoreMenu）。",
    "只有图标的位置（字段行、卡片角、表格行）用 IconButton，label 必填。",
  ],
  whenNot: ["导航到另一个页面 —— 用 Link。", "在 2–6 个选项里选一个 —— 用 SegmentedControl。"],
  anatomy: [
    "左图标（可选，16px；加载时换成转圈）",
    "文字（字重 500，动词开头：「新建客户」「导出」）",
    "容器（圆角 8；28px 及以下圆角 6；描边与输入框同一根线）",
  ],
  states: [
    "悬停：中性 4–6% 叠层；按下：8–10% 叠层",
    "键盘聚焦：和输入框同一个 3px 主色光圈",
    "禁用：浅灰底 + 淡字，不降透明度（不会变成「浅绿按钮」看着像能点）",
    "加载：转圈替换左图标，文字可改为「保存中…」，宽度锁住，重复点击无效（aria-busy）",
  ],
  dos: [
    "一个区域只放一个实心主按钮；其余用描边或幽灵。",
    "幽灵按钮用灰字；主色字只留给文字按钮（表格行里的动作）和链接。",
    "不能点时用 disabledReason 说原因：按钮仍可聚焦，悬停 / 聚焦出深色气泡。",
    "保存、提交类按钮给 loading，防止重复提交。",
    "危险操作在页面上用「危险描边」，确认框里才用「危险实心」。",
  ],
  donts: [
    "不要给主按钮加渐变和投影；平面、纯色。",
    "同一工具栏不要混用 5 种按钮样子，也不要挤成两行 —— 低频操作进「⋯」。",
    "不要用 opacity 表示禁用：主色按钮会变成浅色按钮，看起来像能点。",
    "不要用实心主按钮表示一个开关（如「关注」）；开关用 IconButton pressed。",
    "不要用浏览器原生 title 做悬停提示；用 tooltip / disabledReason，键盘和触屏也能看到。",
  ],
  a11y: [
    "IconButton 的 label 同时是 aria-label 和提示气泡文字，必填。",
    "disabledReason 使用 aria-disabled 而不是 disabled，按钮仍在 Tab 顺序里，读屏能读到原因。",
    "loading 时设置 aria-busy；开关型按钮用 aria-pressed。",
    "焦点光圈画在按钮外 3px，对比度满足 WCAG 2.2 非文本 3:1。",
  ],
  demos: [
    {
      id: "basics/button-playground",
      title: "在线调试",
      description: "改右侧属性，预览和代码同步变化。",
      height: 160,
      controls: [
        { name: "variant", label: "样式 variant", type: "select", options: ["default", "secondary", "outline", "ghost", "text", "destructive", "destructive-outline"], default: "default" },
        { name: "size", label: "尺寸 size", type: "select", options: ["lg", "default", "sm", "xs"], default: "default" },
        { name: "label", label: "文字", type: "text", default: "新建客户" },
        { name: "withIcon", label: "带图标", type: "boolean", default: true },
        { name: "loading", label: "加载中 loading", type: "boolean", default: false },
        { name: "disabledReason", label: "禁用原因 disabledReason", type: "text", default: "" },
      ],
    },
    { id: "basics/button-variants", title: "7 种样式", height: 140 },
    { id: "basics/button-sizes-states", title: "尺寸、加载与禁用原因", height: 180 },
    { id: "basics/icon-button-group", title: "图标按钮、按钮组与「⋯」", height: 160 },
  ],
  props: [
    {
      component: "Button",
      rows: [
        { name: "variant", type: '"default" | "secondary" | "outline" | "ghost" | "text" | "destructive" | "destructive-outline"', default: '"default"', description: "default 主按钮（一个区域一个）· secondary 次要 · outline 常规 · ghost 灰字（工具栏）· text 主色字（行内动作）· destructive 只在确认框 · destructive-outline 页面上的删除" },
        { name: "size", type: '"lg" | "default" | "sm" | "xs"', default: '"default"', description: "40 / 36（手机 40）/ 28 / 24" },
        { name: "loading", type: "boolean", default: "false", description: "转圈替换左图标、锁宽度、忽略点击（aria-busy）" },
        { name: "loadingText", type: "ReactNode", description: "加载时的文字，如「保存中…」；不填保持原文字" },
        { name: "disabledReason", type: "string", description: "不能点的原因：按钮保持可聚焦（aria-disabled），深色气泡说明原因" },
        { name: "tooltip", type: "string", description: "提示气泡文字（一句话）" },
        { name: "shortcut", type: "string", description: '气泡里的快捷键，如 "Mod+S"（自动显示 ⌘ 或 Ctrl）' },
        { name: "asChild", type: "boolean", default: "false", description: "把样式交给唯一的子元素（Radix Slot）" },
      ],
    },
    {
      component: "IconButton",
      rows: [
        { name: "label", type: "string", description: "必填：读屏名称 + 提示气泡" },
        { name: "icon", type: "ReactNode", description: "Lucide 图标元素" },
        { name: "size", type: '"md" | "default" | "sm" | "xs"', default: '"default"', description: "36 / 32 / 28 / 24" },
        { name: "variant", type: '"ghost" | "outline" | "danger"', default: '"ghost"', description: "outline 单独放时用；danger 悬停变红（删除）" },
        { name: "pressed", type: "boolean", description: "开关型按钮：按下 = 主色浅底（aria-pressed）" },
        { name: "badge", type: "number | boolean", description: "右上角数字角标或圆点" },
        { name: "shortcut", type: "string", description: "气泡里的快捷键" },
        { name: "disabledReason", type: "string", description: "不能点的原因" },
      ],
    },
  ],
};

const tagBadge: ComponentDoc = {
  slug: "tag-badge",
  title: "标签与徽标",
  subtitle: "Tag · StatusBadge · Count · DotBadge",
  group: "basics",
  importFrom: "@adminui/react",
  summary: "全家只有两种形状：圆角 6 的软方块（标签、状态、筛选块）和全圆（数字角标、圆点）；都不加描边。",
  keywords: "tag badge status count dot pill chip 标签 徽标 状态 角标 未读 圆点",
  when: [
    "角色、来源、类型这类没有颜色含义的分类：Tag variant=\"plain\"（灰）。",
    "一条记录的运行状态（正常 / 即将到期 / 同步失败 / 已停用）：StatusBadge。",
    "一个数量（收藏 12、待处理 3）或未读、告警：Count；只提醒「有新东西」不计数：DotBadge。",
  ],
  whenNot: ["带颜色的选项值（阶段、行业）—— 用选项标签（CellTags / Choice 的选项颜色）。", "可以点击切换的筛选 —— 用 ChipGroup。"],
  anatomy: [
    "软方块：圆角 6、软底 + 深字、无描边；格子里 20px、字段行 22px",
    "状态：圆点 + 字；soft 密度再加一层软底（22px）",
    "数字角标：18px 全圆、等宽数字，超过 99 写 99+",
    "圆点：8px 全圆，只提醒不计数",
  ],
  states: [
    "状态 dot 密度（表格、列表）：只有圆点 + 字，不加底色；在表格里自动用 dot",
    "状态 soft 密度（详情头部、卡片标题旁）：软底 + 圆点",
    "pulse：「同步中」圆点慢慢扩散",
    "Count：neutral 中性灰（0 也显示）· primary 未读主色实心（0 不显示）· danger 告警红色实心 · attention 注意色软底",
  ],
  dos: [
    "状态只用语义色：success 正常、warning 注意、danger 异常、info 信息 / 进行中、neutral 停用。",
    "表格一整列状态用 dot 密度，让列表安静下来；软底留给详情头部。",
    "数量用中性灰角标，0 也照常显示；未读才用主色实心。",
    "角色、来源这类普通标签用灰色 plain，和选项标签同一个形状。",
    "标签需要补充说明时传 title，会变成深色提示气泡。",
  ],
  donts: [
    "不要用全圆胶囊 + 描边做标签或状态；描边在深色模式下会变成一圈脏边。",
    "不要用白底描边的小方框做标签，看起来像一排输入框。",
    "不要让状态和选项标签长得一样：状态是「圆点 + 字」，选项是软方块。",
    "不要给数量 0 上主色，看起来像有东西；也不要只有一种颜色的角标。",
    "不要在表格每一行都用带底色的状态胶囊，整列会很吵。",
  ],
  a11y: [
    "状态和角标都带文字或 label，不只靠颜色表达含义。",
    "Count 的 label 写成完整的话（「未读 12 条」），读屏不会只念一个数字。",
    "DotBadge 不传 label 时是装饰（aria-hidden）；表达信息时必须传 label。",
    "软底标签的文字对比度在浅色和深色下都 ≥ 4.5:1。",
  ],
  demos: [
    { id: "basics/tag-badge-overview", title: "标签、状态、角标与圆点", height: 220 },
    { id: "basics/tag-badge-in-context", title: "在列表里：快捷筛选 + 选项标签 + 圆点状态", height: 300 },
  ],
};

const avatar: ComponentDoc = {
  slug: "avatar",
  title: "头像",
  subtitle: "Avatar · AvatarStack · PersonChip",
  group: "basics",
  importFrom: "@adminui/react",
  summary: "5 档尺寸、按人固定分色的头像，加上叠放头像和人员块。同一个人在哪都是同一个颜色。",
  keywords: "avatar avatar-stack person chip user presence 头像 叠放头像 人员 成员 在线",
  when: [
    "评论、操作记录、成员列表、负责人这类「是谁」的地方：Avatar + 名字。",
    "正在看 / 正在编辑的几个人、项目成员：AvatarStack。",
    "人作为一个字段值（负责人、协作人）：PersonChip；表格里用 plain。",
  ],
  anatomy: [
    "尺寸：20（格子、叠放）· 24（人员块、字段行）· 32（评论、列表行，默认）· 40（成员卡）· 64（个人页）",
    "字 = 姓，字号约直径 0.42、字重 600",
    "颜色：按账号 id（没有就按名字）固定分到 10 色之一，软底 + 深字，深色模式自动跟随",
    "在线点：on 主色点 · away 注意色点 · off 空心灰点",
  ],
  states: [
    "照片 src：加载失败自动退回文字",
    "bot：圆角方块 + 机器人图标（自动化、系统操作）",
    "gone：已离职，整块变灰，人员块补一句「已离职」给读屏",
    "group：部门 / 小组，灰底 + 人群图标",
  ],
  dos: [
    "传账号 id 给 id，同一个人在评论、授权名单、负责人列里都是同一个颜色，同姓也分得开。",
    "叠放头像给 label（「正在看的人」），悬停单个头像出「名字 · 在做什么」。",
    "超出 max 的人收成「+k」按钮，点开列出其余的人，手机上也能看。",
    "表格的负责人列用 PersonChip plain（20px 头像 + 名字，不加底）。",
    "机器人、已离职、部门用对应的 kind，不要让它们和在职的人长得一样。",
  ],
  donts: [
    "不要在各个模块里覆写头像尺寸，只用 5 档。",
    "不要所有人都用同一个主色渐变头像，评论里分不出谁是谁。",
    "不要用原生 title 显示叠放头像里的名字，手机上看不到。",
    "不要只放头像不写名字：头像是装饰，名字要写在旁边或气泡里。",
  ],
  a11y: [
    "Avatar 默认 aria-hidden，名字必须出现在旁边的文字或 tooltip 里。",
    "AvatarStack 是 role=\"group\"，aria-label 会念出组名和所有人的名字。",
    "「+k」是真正的按钮（aria-expanded），键盘可以打开名单，Esc 关闭。",
  ],
  demos: [
    { id: "basics/avatar-sizes-kinds", title: "尺寸、按人分色、种类与在线状态", height: 220 },
    { id: "basics/avatar-stack-chip", title: "叠放头像与人员块", height: 200 },
  ],
};

const tooltip: ComponentDoc = {
  slug: "tooltip",
  title: "提示气泡与说明「?」",
  subtitle: "Tooltip · tipProps · HelpTip",
  group: "basics",
  importFrom: "@adminui/react",
  summary: "一句话的悬停提示用深色气泡（Tooltip），能带快捷键；要标题、要链接的说明用标题旁的「?」卡片（HelpTip）。",
  keywords: "tooltip tip hint help popover title 提示 气泡 悬停 说明 问号 帮助",
  when: [
    "所有图标按钮（IconButton 的 label 自动出气泡）、被截断的文字、需要补一句话的元素。",
    "按钮不能点时说原因：用 Button 的 disabledReason，它也是同一个气泡。",
    "标题、字段名旁边需要一段说明（怎么算、什么规则）：HelpTip。",
  ],
  whenNot: ["要用户确认或输入的内容 —— 用 Popover / Dialog。", "大段帮助文档 —— 用 Link 跳到帮助页。"],
  anatomy: [
    "气泡：深色底 + 箭头，12.5px、圆角 6、最宽 260；可带快捷键键帽",
    "说明「?」：16px 图标 + 24px 点击区，紧跟标题",
    "说明卡：浅色、圆角 12、最宽 320；可有标题和一个「了解更多」链接",
  ],
  states: [
    "气泡：悬停 0.4 秒出现；沿一排按钮扫过时立即切换；Tab 聚焦立即出现；Esc / 移开 / 滚动立即消失",
    "气泡默认在上方，放不下翻到下方",
    "说明卡：悬停 / 聚焦打开，点一下钉住，点外面或 Esc 关闭；手机上点按打开",
    "说明卡从「?」下方左对齐弹出，贴到窗口边才往回挪，不会盖住侧栏",
  ],
  dos: [
    "气泡只写一句话；需要标题或链接时改用 HelpTip。",
    "截断的文字加 truncated，只在真的被截断时才出气泡。",
    "有快捷键的动作把 shortcut 传进去，气泡里自动显示当前系统的写法。",
    "Tooltip 只往子元素上写 data-tip 属性，不会为每个气泡挂一个组件；也可以直接展开 tipProps(\"复制\", \"Mod+C\")。",
  ],
  donts: [
    "不要用浏览器原生 title：要等 1 秒多、样子随系统、深色下是白底、手机和键盘都看不到。",
    "不要让说明卡按「?」右对齐往左长，标题在左边时会盖住侧栏菜单。",
    "不要做没有箭头的说明卡，看不出是哪个「?」的。",
    "不要把「?」做成 28px 带底色的圆按钮，比标题还显眼。",
    "不要让禁用按钮沉默：说清楚为什么不能点。",
  ],
  a11y: [
    "气泡在键盘聚焦时同样出现，Esc 关闭；内容只是补充，按钮本身仍有 aria-label。",
    "Tooltip 包裹的元素必须能聚焦（按钮，或带 tabIndex 的元素）。",
    "HelpTip 是一个真正的按钮（aria-expanded），说明卡 role=\"tooltip\"，打开时用 aria-describedby 关联。",
    "Esc 关闭说明卡后焦点回到「?」按钮。",
  ],
  demos: [
    { id: "basics/tooltip-basic", title: "提示气泡：图标按钮、截断文字、禁用原因", height: 180 },
    { id: "basics/help-tip", title: "标题旁的说明「?」", height: 220 },
  ],
};

const copyKbdDivider: ComponentDoc = {
  slug: "copy-kbd-divider",
  title: "快捷键 · 复制 · 分隔线",
  subtitle: "Kbd · ShortcutSheet · CopyButton · CopyField · Divider",
  group: "basics",
  importFrom: "@adminui/react",
  summary: "三个小部件：一键一帽的快捷键（只显示当前系统写法）、带「已复制」反馈的复制按钮和复制框、只有 1px 实线一种的分隔线。",
  keywords: "kbd keyboard shortcut hotkey copy clipboard divider separator hr 快捷键 键帽 复制 剪贴板 分隔线",
  when: [
    "页面文字、菜单、气泡里提到快捷键：Kbd；整页的快捷键一览：ShortcutSheet（按「?」打开）。",
    "字段行里的值可以复制：CopyButton（reveal，悬停整行才出现）。",
    "整段要拿走的值（公开链接、API 令牌）：CopyField，令牌用 secret 打码。",
    "卡片里分区、时间线的「昨天 / 更早」、工具栏分组：Divider。",
  ],
  anatomy: [
    "键帽：一个键一个框，20px（菜单 / 气泡里 sm 18px）、圆角 4、正文字体",
    "复制按钮：24px 幽灵图标；成功 = 图标变勾 + 气泡「已复制」1.5 秒",
    "复制框：等宽字值 + 右边「复制」文字按钮；secret 时值打码 +「显示」",
    "分隔线：1px 实线；带字（居中或靠左）；竖线 16px",
  ],
  states: [
    "Kbd flat：输入框里的平键帽（「/」搜索）；compact：菜单里用短符号（⇧ ↵）",
    "复制失败：图标变叉 + 气泡「复制失败，请手动选中复制」",
    "令牌「显示」后 30 秒自动重新打码",
    "手机上：快捷键不显示（没有键盘），复制按钮一直显示",
  ],
  dos: [
    "快捷键写成 \"Mod+K\"，Windows 自动显示「Ctrl K」，Mac 显示「⌘ K」。",
    "复制按钮的 label 写成值的名字（「客户编号」），读屏念「复制客户编号」「已复制」。",
    "字段行外层加 aui-copy-host（记录详情、表格行已自带），复制图标悬停 / 聚焦整行才出现。",
    "能用留白分开的就不画线；必须画时只用 Divider 这一种。",
  ],
  donts: [
    "不要在 Windows 上写「Ctrl/⌘ K」，也不要把整串快捷键塞进一个框或写成纯文字。",
    "不要做带边框的复制小按钮，和别处无边的图标按钮不一致。",
    "不要只把图标变勾当作复制反馈；要有看得见的「已复制」和读屏播报。",
    "不要把失败原因藏在原生 title 里。",
    "不要各处自己画虚线、粗线做分隔。",
  ],
  a11y: [
    "Kbd 给读屏一段完整的文字（「Ctrl 加 K」），键帽本身 aria-hidden。",
    "复制结果通过 aria-live 播报「已复制」或失败原因。",
    "Divider 是 role=\"separator\"，竖线带 aria-orientation=\"vertical\"。",
    "ShortcutSheet 在输入框里打字时不会被「?」误触发。",
  ],
  demos: [
    { id: "basics/kbd-shortcuts", title: "键帽与快捷键一览", height: 160 },
    { id: "basics/copy-field", title: "字段行复制与复制框", height: 300 },
    { id: "basics/divider", title: "分隔线", height: 240 },
  ],
};

const loading: ComponentDoc = {
  slug: "loading",
  title: "加载与进度",
  subtitle: "ContentSkeleton · SkeletonBlock · TopProgress · ProgressBar · StepProgress · Spinner · Meter",
  group: "basics",
  importFrom: "@adminui/react",
  summary: "第一次加载在原位置出骨架，再次刷新保留旧数据 + 顶上细进度条；转圈只给形状未知的地方；进度条和配额条一套样子。",
  keywords: "loading skeleton spinner progress meter quota refresh 加载 骨架屏 转圈 进度条 配额 刷新",
  when: [
    "第一次打开列表、卡片：ContentSkeleton / SkeletonBlock 在内容的位置画出形状。",
    "已有数据再刷新：Refreshing（旧数据变淡 + TopProgress 2px 细条）。",
    "上传、导入：ProgressBar；不知道多久时 value={null} 为不确定进度。",
    "阶段：StepProgress；配额、用量：Meter（自动按阈值变色）；打开弹框、搜索、加载更多：Spinner。",
  ],
  anatomy: [
    "骨架：宽度参差的行，头像画成圆、标签画成胶囊；外壳和标题先出来",
    "细进度条：面板顶上 2px",
    "进度条：高 4 / 6 / 8，全圆；Meter = 标题 + 右侧等宽数值 + 一行说明",
    "转圈：16（按钮、输入框里）/ 20 / 32（整块区域）",
  ],
  states: [
    "数量在拿到前显示「—」，不显示「共 0 条」",
    "超过 10 秒：换成「加载比较慢… · 重试」（StatePanel 自带）",
    "刷新失败：保留旧数据 + 一条「刷新失败 · 重试」",
    "Meter：≥ 80% 注意色、≥ 95% 异常色，并在说明里给下一步",
  ],
  dos: [
    "表格加载时表头用这张表自己的字段名，骨架行画在表头下面。",
    "转圈旁边的字写「正在……」，用中文省略号「…」。",
    "配额快满时在 Meter 的 detail 里写下一步（清理、加购席位）。",
    "Spinner 旁已经有文字时不传 label；单独出现时传 label 给读屏。",
  ],
  donts: [
    "不要在加载时显示上一张表的表头或「共 0 条」，用户会以为表是空的。",
    "不要首次打开整页白底只有一个转圈；外壳和标题先出来。",
    "不要画几根一样长的灰条当骨架，不像真实内容。",
    "不要写英文省略号「...」；不要只有一种尺寸的转圈。",
    "不要让配额页只有数字没有条。",
  ],
  a11y: [
    "ContentSkeleton 是 role=\"status\"，用 label 说明在加载什么；骨架形状本身 aria-hidden。",
    "ProgressBar、Meter 带 aria-valuenow；不确定进度不写数值。",
    "刷新中的区域设置 aria-busy，读屏不会读到一半的内容。",
    "TopProgress 是 role=\"progressbar\"，用 label 说明在做什么（默认「正在刷新」）。",
  ],
  demos: [
    { id: "basics/loading-skeleton", title: "首次加载与刷新", height: 260 },
    { id: "basics/loading-progress", title: "进度条、阶段、配额与转圈", height: 400 },
  ],
};

const typography: ComponentDoc = {
  slug: "typography",
  title: "文字层级与链接",
  subtitle: "Link · aui-text-*",
  group: "basics",
  importFrom: "@adminui/react",
  summary: "8 级字号、3 种字重、4 种链接。字号用 aui-text-* 工具类，都乘全局字号系数；跳到别处用 Link，在原地做事用文字按钮。",
  keywords: "typography font size weight text link anchor heading 字号 字重 文字 标题 链接",
  when: [
    "业务页需要写标题、正文、备注时，用 aui-text-display … aui-text-note 八个工具类，不写固定 px。",
    "正文里的跳转：Link；整列都是链接（客户名列）：Link kind=\"quiet\"。",
    "滚到本页某个字段：kind=\"anchor\"；「查看全部 →」：kind=\"next\"；去别的网站：kind=\"external\"。",
  ],
  whenNot: ["在原地做一件事（标记已读、展开）—— 用 Button variant=\"text\"。"],
  anatomy: [
    "字号：大数字 28 · 页面 / 记录标题 22（手机 20）· 区块大标题 18 · 卡片标题 14.5 · 正文 14 · 表格 / 控件 13 · 标签 12.5 · 备注 / 表头 12",
    "字重：400 正文 · 500 按钮 / 标签 / 强调 · 600 所有标题和大数字",
    "颜色：正文 --aui-text · 次要 --aui-secondary · 备注 --aui-note",
    "数字等宽，单位小一号次要色",
  ],
  states: [
    "正文链接：主色，悬停下划线",
    "安静链接：平时正文色，悬停变主色",
    "定位链接：点状下划线，悬停变实线",
    "外部链接：带 ↗，新窗口打开；禁用：灰字、不可点",
  ],
  dos: [
    "所有字号都通过 token / 工具类，跟随用户在「外观」里选的字号一起变。",
    "标题统一 600，不用 650 / 700 / 800。",
    "文档阅读区的正文容器加 aui-neutral-text，换成纯中性灰；列表、表单照常。",
    "行高跟着字号定死，不要每处自己调。",
  ],
  donts: [
    "不要写 13.5、14.5、17 这类零碎字号；只用 8 级。",
    "不要在正文附近堆一片粗字（按钮、标签、表头都 600 以上），层级反而不清楚。",
    "不要用主色文字按钮冒充链接，也不要用链接做原地动作。",
    "不要降透明度做次要文字；用 --aui-secondary / --aui-note，对比度 ≥ 4.5:1。",
  ],
  a11y: [
    "Link 有清楚的聚焦描边；禁用时 aria-disabled 且移出 Tab 顺序。",
    "外部链接给读屏补一句「（新窗口打开）」。",
    "备注色在白底上仍满足小字 4.5:1。",
  ],
  demos: [
    { id: "basics/typography-scale", title: "8 级字号", height: 380 },
    { id: "basics/typography-links", title: "4 种链接与文字按钮", height: 200 },
  ],
};

const icons: ComponentDoc = {
  slug: "icons",
  title: "图标",
  subtitle: "ACTION_ICONS · ICON_SIZES · iconStroke · ACTION_ICON_LABELS",
  group: "basics",
  importFrom: "@adminui/react",
  summary: "只用 Lucide，5 档尺寸，线宽随尺寸走，颜色跟着字走；常用的 24 个动作每个意思只用一个图标。",
  keywords: "icon icons lucide stroke size action 图标 线宽 尺寸 动作图标",
  when: [
    "按钮、菜单、工具栏、字段类型前的图标：直接用 lucide-react。",
    "新建、编辑、删除、刷新这类通用动作：从 ACTION_ICONS 里取，保证全站同一个图标。",
    "自己画图标块、空状态时：用 ICON_SIZES 里的尺寸，线宽用 iconStroke(size)。",
  ],
  anatomy: [
    "12：标签、外部链接 ↗ · 14：小按钮、筛选块、字段类型 · 16：默认 · 20：手机底部导航、图标块 · 24：空状态、大图标块",
    "线宽：12–14 用 2，16–20 用 1.75，24 用 1.5",
    "图标块 28 / 32 / 40（圆角 6 / 8 / 10，浅底 + 同色系图标），只用在卡片、列表行开头",
    "空状态：24px 图标放在 48 的中性浅底圆里，下面一句话 + 一个按钮",
  ],
  dos: [
    "单独的图标用次要色，悬停变正文色，开着（pressed）用主色。",
    "点缀色只给状态图标，而且后面一定跟文字。",
    "按钮里的图标不用写尺寸，Button / IconButton 会按自己的尺寸设好。",
    "图标都加 aria-hidden，意思由旁边的文字或按钮 label 表达。",
  ],
  donts: [
    "不要用 9 / 11 / 13 / 15 这类零碎尺寸，并排时大小不一。",
    "不要 16px 以上还用默认线宽 2，比 14px 中文还重。",
    "不要同一个意思用不同图标（Settings / Settings2 / SlidersHorizontal），一个意思一个图标。",
    "不要让工具栏里的图标有的绿有的灰；不要把空状态图标放在主色圆底里，像一个按钮。",
  ],
  a11y: [
    "纯装饰图标 aria-hidden=\"true\"；只有图标的按钮必须有 label。",
    "图标与背景的对比度 ≥ 3:1（非文本对比度）。",
    "不只靠图标颜色表达状态，旁边写字。",
  ],
  demos: [
    { id: "basics/icons-sizes", title: "尺寸、线宽与空状态", height: 360 },
    { id: "basics/icons-actions", title: "24 个动作图标", height: 420 },
  ],
};

export const basicsDocs: readonly ComponentDoc[] = [button, tagBadge, avatar, tooltip, copyKbdDivider, loading, typography, icons];
