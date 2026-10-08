# 更新记录

记 3.2 起的版本，以及 3.0、2.0 两次大版本的升级说明；更早的版本看 Git 提交记录。

## 8.3.0（2026-10-08）

**多维表格首屏变轻；命令面板在刚打开的页面也认 Ctrl / ⌘ K；组织选人补三个时序问题；成员「添加成员」接组织选人。** 只新增属性和导出，不删导出、不改默认行为（除下面写明的两处文案）。

- **多维表格首屏**：只读渲染一张 `BitableGrid` 的首屏 JS（含 TanStack Table / Virtual，gzip）158.0 → **113.4 KB**，CSS 42.9 → 37.3 KB。按需下载的：工具栏五个面板的内容（`grid-filter-body` / `grid-group-body` / `grid-fields-body` / `grid-color-rules`：条件树、日期选择、可拖动列表、色板；工具栏挂上后浏览器空闲时预取、鼠标移到 / 焦点到按钮上也预取，加载中显示骨架；`PopoverPanel` / `PopoverLayer` 的内容还在加载时焦点先停在面板上，内容出来再进第一个控件，不会落到标题旁的「?」上把说明弹出来）、格内编辑器（文本 / 选项 / 日期 / 评分；可编辑的表在空闲时预取）、改冲突提示、附件灯箱和迷你播放器（音频格先显示缩略图）、手机上 `Menu` 的底部弹层（手机上空闲时预取）。TanStack Table 留在首屏（只读表格本身就要它，v9 按功能摇树，约 26 KB）。`ToolbarPanel` 新可选 `preload`（宿主自己的面板也能预取），面板内容包在 Suspense 里。
- **摇树修正（所有入口受益）**：`primitives` 的 `X.displayName = …` 语句会把 Button / Input / Textarea / Checkbox / Switch 整组留在包里，改成无副作用写法；`Switch` 挪进自己的模块（`primitives` 照样导出）；顶层 `forwardRef` / `createContext` / `lazy` 标 `/* @__PURE__ */`。核心探针 25.7 → 22.9 KB JS，`/charts` 19.4 → 13.8，`/markdown` 9.3 → 4.3。
- **体积门禁**：`npm run size` 新探针 `grid:read-only`（真的渲染一张只读表的消费方，只算入口 + 静态 import，懒加载块列出不计；预算 120 / 41 KB）。
- **`CommandPalette globalShortcut`**（可选，默认 false）：快捷键挂在 window 上，刚打开、焦点还在 `<body>` 的页面按 Ctrl / ⌘ K 也能打开；在输入框 / 可编辑区域里只认带 Ctrl / ⌘ 的组合，单键命令（`g`、`/`）不抢打字；弹框里的按键留给弹框。`AdminShell globalShortcut` 给壳里的面板（`headerActions`）定默认值。纯函数 `shortcutApplies` / `shortcutOf`（command-core，单测）；`useAdminShortcuts(commands, enabled, { global })`。starter 顶栏面板打开了它。
- **OrgPicker**：① `defaultFocus` 晚到（宿主的「我的部门」接口比弹框慢）时会重新定位，不再停在骨架上；值变了也重新定位。② GrantList / ShareDialog 的「添加人、部门或角色」框是懒加载的——加载完之前点进去 / 打的字会交给加载好的框（以前占位框是禁用的，一打开页面马上点就没反应）；空闲时预取。`OrgPickerField` 新 `autoFocus`、`defaultQuery`。③ `lockedHint` 只接在**没有原因**的锁定提示后面；`availability` 给了原因（通常已经写了找谁开）就原样显示，不再变成「原因：lockedHint」两段。
- **成员「添加成员」接组织选人**：`TenantMembersPage` / `GovernanceConsole` 新 `orgSource`（宿主的 `OrgDataSource`）+ `orgPicker`（OrgPickerField 选项）。给了就用组织选人选一个人（只选人、单选，现有成员灰着写「已是成员」，选人框和样式随弹框懒加载），不再让人手填「用户编号」；不给照旧（`users` 下拉 / 手填）。starter 权限治理页接了演示通讯录。
- **看板文档与示例（开源准备）**：DASHBOARDS.md 通用章节的例子换成电商 / 订阅 / 门店 / 渠道（游戏类模板卡和游戏参考资料只在内部仓，导出时去掉）；`toleranceBandOption` 默认图例、`funnelPlotOption` 默认纵轴改成「实际比率」（原来是游戏口径的字样；内部的运营看板示例显式传原文字）；AI-RULES / catalog 的说法改成「命中率、转化率等有理论值的比率」。新脚本 `npm run test:dashboards-kit`（看板部件）。
- **测试与示例用中性账号**：登录演示 `tester`、账号区 `lead01`、令牌 `tok_…`、密钥 `sk_test_…`；守卫新规则拦 `demo_<名字>` 形式的内部种子账号。

**同事会注意到**：顶栏开了 `globalShortcut` 的项目，刚打开页面就能 Ctrl / ⌘ K；表格第一次打开筛选 / 分组等面板时可能闪一下骨架（网络慢时）；锁定提示不再在原因后面接 `lockedHint`；容差带 / 漏斗图没传图例时写「实际比率」。

**风险**：① 面板内容、编辑器、灯箱变成单独的块：离线 / 发版换块时第一次打开会失败（再点一次会重试），e2e 里「点了立刻断言面板内容」要等内容出现。② 可编辑表格在空闲预取编辑器之前就打字，第一次编辑的前几个字可能只留第一个（编辑器挂上后照常）。③ `access` 探针 219.8 → 238.3 KB（探针把懒加载块也算进去，成员页的选人框是懒加载的），预算 240 余量很小，下一个进 `/access` 的大件要懒加载或调预算。④ `toleranceBandOption` / `funnelPlotOption` 依赖原来默认图例字样的宿主要自己传 `label` / `yLabel`。

## 8.2.1（2026-10-08）

**开源前第二轮清理：演示数据和文档去掉剩下的内部业务数据、地区口味和审阅材料；不改组件行为、不删导出。**

- **设计审阅材料不再随包发布**：审阅稿、样稿 HTML、批准清单和带取舍理由的说明属于内部审阅材料，从 npm 包（`files`）和公开树里拿掉，只留 `design/templates/`。catalog `PAGE_TEMPLATES[].demo` 改成指向 `design/templates/tNN-*.png`——starter 的 T01–T17 页按 1440 × 900 浅色重新截的中性截图；文档里原来指向审阅材料的地方改成写规则本身、starter 页或模板截图。
- **演示数据中性化**：组件总览的订阅示例换成虚构的「Acme Cloud」SaaS 订阅（团队版 / 专业版 / 基础版，月费 / 预算 / 部门），不再有账号转售的进价 / 售价 / 毛利口径；运维平台演示里的主机别名和公网地址换成 web-01 / 203.0.113.x；演示客户换成新的虚构人名（孙佳宁、赵静怡）。
- **币种 / 区号 / 地名**：示例和文档的金额改用 CNY（starter / small / large / 文档站在 `AdminProvider defaults` 里设 `currency: "CNY"`，金额字段不再各自写死币种），电话改用 +86 号码，其它区号只作为多国列表里的例子；带地区色彩的地名和节假日日历换成中性的城市和日历。文档写明币种在 `AdminProvider defaults.currency` 或字段 `currency` 里配置。
- **注释和示例**：删掉剩下的裸内部编号；电话规则注释里的号码例子换成英国 / 中国大陆号码（行为不变）。

**同事会注意到**：组件总览的订阅演示改了字段名；starter 里的金额现在显示 CN¥ / ¥。

**风险**：① `PAGE_TEMPLATES[].demo` 的路径变了（统一成 `design/templates/*.png`，原来指向 HTML 样稿和另一个目录的截图），读这个字段找演示文件的工具要跟着改。② `defaults.currency` 目前只有 BitableGrid 会补到字段上，CompactTable、条件编辑器 / ConditionSentence、KanbanBoard 卡片和 `formula` 金额结果不会，示例里这几处显式写了 `currency`。

## 8.2.0（2026-10-08）

**开源准备：库里不再有任何内部名称和引用；地区默认值（时区、币种、电话区号）改成中性、可配置。** 根入口只新增导出，没有删导出；包名仍是 `@adminui/react`（开源导出时改名 `@adminui/react`，内部用别名照常导入）。

- **地区默认值 `AdminProvider defaults={{ timeZone, currency, phoneCountry }}`**：给 Provider 里所有组件定默认值，组件自己的属性仍然优先；`useAdminDefaults()` 读当前值，不用 AdminProvider 的地方包 `AdminDefaultsProvider`。没设置时的中性默认：
  - **时区** = 运行环境的（浏览器 = 用户的；Node = 进程 `TZ`，读不到就 UTC），原来写死 `Asia/Shanghai`。涉及 CellDate / DateTimeDisplay / RelativeTime / ActivityFeed / LogTimeline / CellHistoryPopover / TimeMachine / ShareDialog / ShareManager / 日历 / 甘特 / 卡片到期，以及纯函数 `formatDateTime` / `dayKey` / `relativeTime` / share-core / history-core / timeline-core。`buildGridSql` / `groupColumnSql` 的 mysql / sqlite `utcOffset` 不传时按 `timeZone` 当前的偏移算（原来写死 `+08:00`）。
  - **币种** = 无（金额不带符号），原来默认 `¥`（`MoneyInput` 没给 currency 时更是取了列表第一个币种）。`currency` 写 ISO 代码（`CNY` / `USD` …）或直接写符号。`formatMinorMoney` 的 `symbol` 默认 `""`；`MoneyDisplay` 的 `unit` 默认 `""`（原来 `元`），`symbol` 默认取 Provider 的币种；网格金额字段、条件编辑器、条件句子不写 `currency` 就不显示符号。
  - **电话区号** = 浏览器语言的地区（`zh-CN` → +86，`en-GB` → +44），不在列表里就用列表第一个；原来 `PhoneInput` 和表单题各有一个写死的默认区号。新纯函数 `defaultPhoneCountry(list, region?)`。
  - **BitableGrid** 把没写 `currency` / `timeZone` / `phoneCountry` 的字段用 Provider 的值补上，`conditionContext.timeZone` 没给时也用 Provider 的时区。
- **列表排序中性化**：`MONEY_CURRENCIES` 按 ISO 币种代码排（CNY EUR HKD JPY MYR SGD TWD USD），`PHONE_COUNTRIES` / `FORM_COUNTRY_CODES` 按地区代码排（CN GB HK JP KR MO MY SG TW US）。新纯函数 `currencySymbol(code)`；根入口新导出 `runtimeTimeZone`、`resolveAdminDefaults`、`utcOffsetOf`、`AdminDefaults` 类型（`/grid-query` 也导出 `runtimeTimeZone` / `utcOffsetOf`）。
- **中性文案**：记录详情「编辑布局」的范围「公司默认 / 只改我的」→「团队默认 / 只改我的」，按钮「恢复公司默认」→「恢复团队默认」（新 `editor.labels` 可改字）；仪表盘标签 `TAB_SCOPE_LABELS.company`「公司默认」→「团队默认」（新 `DashboardTabs scopeLabels`）；`InitialPasswordField` 默认说明里的「LINE」→「即时通讯工具」；字段类型示例的币种换成 US$。
- **新子路径 `@adminui/react/settings`**：和 `/peizhi` 完全同一个模块（字典 / 参数页）；`/peizhi` 在 8.x 照样能用，**已弃用**，下个大版本删。catalog 里 `peizhi` 能力的入口改写 `/settings`。
- **`admin-ui-audit` 认别名**：同时认 `@adminui/react` 和 `@adminui/react`，并从被检查目录往上每一级 package.json 里读出指向本包的依赖别名（`"x": "npm:@adminui/react@^8"`、Release tarball URL / `file:` 包）；另可 `--package <名字>`（可写多次）。以前用别名写的深层导入、8.0 删掉的导出会静默漏报。`auditText(text, file, { packages })` / `auditPaths(targets, base, { packages })`，新导出 `DEFAULT_PACKAGES` / `packageAliases` / `detectPackages`。
- **内部痕迹清理**：src 注释、catalog 规则文字、全部文档（含本文件历史条目）、审阅演示、examples、skills、测试里的公司名、内部工具 / 主机名、内网地址、决策编号、真名和由真名派生的演示账号、公司邮箱、内部链接全部换成中性写法；演示公司统一叫 Acme，演示部门「华南子公司」，地址用 example.com / 203.0.113.x 文档地址。catalog 引用的 T15 / T16 / T17 三张演示图用 starter 对应页重新截图。LICENSE 改为 `Copyright (c) 2026 admin-ui contributors`；package.json 的 description / keywords / repository / homepage / bugs / author 改成公开仓的。
- **泄漏守卫进门禁**：本包 `npm run check` 末尾跑 `npm run guard`（扫整个包和文档站，命中任何内部名称就失败）。
- **starter**：根 AdminProvider 显式写 `defaults={{ timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" }}` 做示范；T15 / T16 / T17 模板页的演示数据换成不带地区的内容。

**升级要做的（跟最新的宿主项目）**：
1. 每个 `AdminProvider` 加 `defaults`，填项目 / 租户自己的值，例如 `defaults={{ timeZone: tenant.timeZone, currency: tenant.currency, phoneCountry: "+86" }}`——不加时日期按浏览器时区、金额不带符号、电话区号按浏览器语言。
2. 服务端调用 `/grid-query`（`parseGridQuery` / `applyGridQuery` / `buildGridSql` / `buildGridGroupSql`）和 `formatDateTime` / `formatMinorMoney` / share-core 等纯函数时显式传 `timeZone`（mysql / sqlite 另可传 `utcOffset`）和币种符号，别依赖服务器时区。
3. 直接用 `MoneyDisplay` 又依赖默认「元」的，写 `unit="元"`；直接用 `formatMinorMoney` 依赖默认 ¥ 的，写 `symbol: "¥"`。
4. 想保留「公司默认」说法：`RecordLayout.cards.editor.labels = { default: "公司默认", reset: "恢复公司默认" }`、`<DashboardTabs scopeLabels={{ company: "公司默认" }}>`；浏览器测试里点「恢复公司默认」的改成新字或传 labels。
5. 依赖 `MONEY_CURRENCIES[0]` / `PHONE_COUNTRIES[0]` 顺序的代码改成按 code 查找；`/peizhi` 导入可以换成 `/settings`（不换也能用）。

**同事会注意到**：没设 `defaults` 的项目，金额前的 ¥ 没了、电话框区号跟着浏览器语言走、日期按浏览器时区；记录详情和仪表盘标签写「团队默认」。

**风险**：① 默认时区从固定 UTC+8 变成运行环境的：服务端如果在 UTC 跑且没传 `timeZone`，「今天」、相对日期、按天分组会按 UTC 算。② `MoneyInput` 不给 currency 也没设 Provider 币种时不再显示币种格，表单里看不出是什么钱。③ `/settings` 和 `/peizhi` 指向同一文件，同一页面混用两种导入不会出现两份模块。

## 8.1.0（2026-10-08）

<!-- adminui/8.1：组织树选人审阅 9 项全过，样稿 A–I -->
**组织选人：所有「分享 / 授权给人、部门、角色、业务线、公司」用同一个选择器。** 新可选子路径 `@adminui/react/org-picker`（自己的 CSS 块），根入口只新增导出，没有删导出；`OrgTreePicker` / `UserTransfer` 标 `@deprecated`（下个大版本删）。

- **`OrgPicker`（大弹框）**：桌面 1000 × 640 三栏——左部门树（集团 ▸ 公司 ▸ 部门，`loadChildren` 懒加载；勾部门 = 含下级，下面有人被选时上级半选 `aria-checked="mixed"`，被盖住的下级和人灰着写「已含在「销售部」里」）| 中间点中节点的人（路径、快捷「我 / 我的部门 / 上级」、「整个「一组」」、直属 / 含下级、负责人排前、虚拟滚动 48px 行 + 游标分页、超过 60 人不给「全选这些人」并提示勾整个部门、「另有 N 位已离职的不显示」、空部门 + `emptyAction`）| 右栏已选（按人 / 部门 / 公司 / 角色 / 业务线分组、路径 + 人数、「含下级」开关、×、清空、「共覆盖 N 人（去重）」，有角色 / 业务线时写「约覆盖」）。顶上搜索整个组织（`/` 聚焦；分组每组 6 条 +「显示全部」、每条完整路径、命中字高亮、搜到已离职的写「「X」已离职」不能选、部门行「下级 ›」在树里定位）；标签页可插拔 `extraSources`（角色 / 业务线 / 公司 / 最近）。草稿只在「确定 (N)」时 `onChange(next, picks)`。`mode="single"`（圆点、760 宽、没有右栏、底栏写选了谁；点已选的不会取消）、`selectable`（`["person"]` = 只选人，树上没有勾）、`max`（满了没勾的变灰）、`includeSubDefault`。手机 ≤ 760 自动整屏：下钻列表（面包屑、›）、行高 56、底部已选条 + 从下面升起的已选面板。
- **`OrgPickerField`（行内输入）**：已选标签 + 打字搜（分组带路径，回车选第一个），空着给 `suggestions`（我的部门 + 最近）；「组织架构」/「从组织架构选…」开大弹框；`commit="instant"`（默认，选了立刻进名单）/ `"batch"`（攒成标签点「添加 N 个」）；已在名单里的（`existing`）不出现在下拉里。
- **数据接口 `OrgDataSource`**：`roots` / `loadChildren` / `loadMembers(id, { deep, cursor })` / `search(q, { kinds, limit })` / `resolve(refs)` / `pathOf?`——组件不认识 quanxian，服务端按看的人过滤。范围 `availability(ref)` → `ok` / `locked`（灰 + 锁 + 「找谁开」）/ `partial`（能展开不能整选）/ `hidden`（不显示：别的公司默认这样，宿主决定）+ `lockedHint`；`defaultFocus` 只定位不勾选；`existing` 灰着写「已授权 · 可读写」；`value` 里 `status: "left"` 的人右栏划掉写「已离职」，**确定时不悄悄丢掉**，只能手动去掉。输出 `toOutput` = `{ kind, id, label, path, includeSub }`。文案 `locale`（zh-CN / zh-TW / en）+ `messages` 覆盖任意一条，人数走 Intl。
- **无障碍与键盘**：树 `role="tree"` / `treeitem`（`aria-level` / `aria-expanded` / `aria-checked` true·false·mixed / `aria-selected`，roving tabindex）；↑↓ 移动、→ 展开 / 进第一个子、← 收起 / 回父、Home / End、空格勾选、回车在中间看成员；成员 / 搜索结果 `role="listbox"` + `aria-multiselectable` + `aria-activedescendant`，↑↓ PageUp / PageDown Home End、空格 / 回车勾；Tab 在 搜索 → 树 → 成员 → 已选 → 底栏 之间走，Esc 关。
- **纯规则（无 React，单测）**：`org-picker-core`（`pickSubject` / `togglePick` / `setIncludeSub` / `pickAll`——含下级盖住的自动去重、`coveredBy`、`mixedIds`、`nodeCheckState`、`reachOf`、`diffPicks`（新增 / 去掉 / 留着的离职）、`toOutput`、`mergeResolved`、`groupByKind` / `groupHits`）、`org-picker-nav`（`visibleTreeRows`、`treeKey`、`listKey`、`virtualWindow`）、`org-picker-text`（`ORG_PICKER_MESSAGES`、`fillText`、`selectionSummary`）。
- **GrantList / ShareDialog 接入**：`GrantList mode="picked"` 新 `orgSource` + `orgPicker`（选项透传）——添加框换成懒加载的 `OrgPickerField`，已在名单里的（含锁住的负责人）灰着写「已授权 · 档位」，一次确定的多个人一起加；`ShareDialog` 的 `people.orgSource` / `people.orgPicker` 透传。`GrantEntry` 新可选 `path` / `includeSub` / `status`（`"left"` 的行标「已离职」）；`GrantSubjectKind` 加 `company` / `line`；新纯函数 `entryFromPick`、`grantedNotes`、`grantKindOf`。不给 `orgSource` 时样子和行为都不变。
- **根入口类型**：`OrgDataSource`、`OrgUnit`、`OrgPerson`、`PickedSubject`、`PickerSource`、`Availability`、`OrgPick` 等也能从 `@adminui/react` 拿（只是类型，零体积）。
- **starter**：新页「系统 → 组织选人」（集团总部 + 华南 / 深圳子公司、500 人客服中心、已离职的李俊杰、角色 / 业务线 / 公司分页、四个身份切换看范围）；新浏览器套件 `npm run test:org-picker`（截图 `test/artifacts/org-picker/`：1440 浅 / 深、390 下钻 + 已选面板 + 单选）；单测 `test/org-picker-core.test.ts`。
- **体积**：核心不变（25.4 KB JS / 24.1 KB CSS）；`/org-picker` 45.7 KB JS / 27.3 KB CSS（含核心，新预算 50 / 30）；根入口探针 305.7 → 323.7 KB JS、93.8 → 96.3 KB CSS（探针把懒加载块也算进去，预算 330 / 100 未动）；中档首屏 +0.2 KB。
- **文档**：DESIGN §2.7、AI-RULES 附录 V（+ §0.1 套件清单）、INTEGRATION §4.2 + 子路径表、ACCESS（弃用说明）、catalog `org-picker`。

**弃用**（下个大版本删）：`OrgTreePicker`（→ `OrgPickerField` / `OrgPicker`，`selectable={["dept"]}`）、`UserTransfer`（→ `OrgPicker`，`selectable={["person"]}`、`max`）。

**同事会注意到**：给了 `orgSource` 的授权名单 / 分享「指定的人」，添加框右边多一个「组织架构」按钮，点进去不打字就有建议；以前名单里离职的人现在标「已离职」，要手动去掉才会消失。

**风险**：① 树上点中的那一行用「主色浅底 + 加粗」，没有画审阅稿 B 里的左侧主色竖线（门禁 `style-rules`「不加装饰色条」，和 SelectList 一致）。② 根入口探针 323.7 / 330 KB，余量只剩约 7 KB：下一个进根入口的大件要么懒加载、要么调预算。③ 「共覆盖 N 人」是按已加载的树算的估算（选了角色 / 业务线就写「约」）；要精确数字由宿主服务端算（以后加 `reach` 属性）。④ `OrgPicker` 的 `defaultFocus` 要能定位到没加载过的节点需要 `pathOf`；不给就只能定位已加载过的。⑤ `mode="single"` 里再点已选的不会取消（圆点语义），想清空要宿主自己给按钮。⑥ GrantList 接入时下拉排除已授权的人用的是「人 / 部门 / 角色」的 id + 种类，宿主的 GrantEntry.kind 要和 `entryFromPick` 的映射一致（person → user）。
## 8.0.2（2026-10-08）

<!-- adminui/8.0.2：做 admin-ui 官网（sites/docs）时发现的 10 个库问题，逐个复现后修；只改补丁级行为，新增的都是可选属性 -->
**修官网演示里暴露的 10 个组件问题。** 不改导出、不删属性；新增 `DescriptionList layout`、`StatItem.onSelect / href / selected`、`MediaThumb size={数字}`、纯函数 `folderCount` / `mediaThumbBox`。

- **日期框手机上「周五 · 明天」压在日期上**：撑位用的隐藏副本按 13px 量，手机上输入框是 16px。字号、左右内边距改成 `.aui-datefield` 上的变量（`--aui-datefield-fs / -pl / -pr`），输入框和相对日期共用，sm / 默认 / touch 三档、桌面 / 手机都一致；手机（≤760px，和核心输入框同一断点）三档都是 ≥16px（不再有 sm 12.5px 触发 iOS 放大）。浏览器测试：1440 和 390 下相对日期都在值的右边、字号和输入框相同。
- **ContentSkeleton 的头像圆被拉成椭圆**：`.aui-content-skeleton-row > span` 同时选中了头像（也是 span），被 `flex:1` 撑宽。文字列改用自己的类 `.aui-content-skeleton-lines`；圆形骨架一律 `flex:none`（表格人员格里的小圆也不会被挤）。
- **FormDialog 手机底栏 4 个按钮挤出屏幕**：手机（≤760px）上底栏可以换行——危险 / 提示一行在最上（危险仍在左边）、每个次要操作占满一行、「取消 · 主操作」并排在最下（主操作在右，拇指够得着）；只有两个按钮时和以前一样。所有用 `aui-dialog-footer` 的弹框（含 `DialogFooter`）同样生效。
- **ConflictChooser「字段」列错位 + 手机没有布局**：单元格的类 `aui-conflict-field` 和 SaveConflictDialog 的 fieldset 撞名、被设成 grid；改名 `aui-conflict-fieldname`。手机上冲突表不再横着滚：每格一张小卡（记录 字段 / 「改前：…」/「现在：… [保留 | 退回]」/ 谁改的），切换按钮 32 高，列头只留给读屏。
- **ConfirmDialog 默认按钮字**：`confirmLabel` 不传时由「确认」改成「确定」，只是兜底——宿主一律传动作动词（「删除」「停用」「转交 23 位」），JSDoc 和 INTEGRATION.md 写明。权限申请两处兜底同步。
- **NavTree 收起的文件夹名写成「资料（3）」**：按导航审阅的样稿，数量是文件夹行右侧的灰色数字，展开 / 收起都显示，名字里不带括号（读屏名「资料 3 项」）。新纯函数 `folderCount`；`folderLabel` 标 `@deprecated`（行为不变）。
- **DescriptionList 还是上下排、StatStrip 不能点**（数据表格审阅样稿）：DescriptionList 默认横排——标签 96px 备注色 13px、值 13.5px 正文色，1 / 2 / 3 列；手机一列、标签 84px（样稿手机版也是横排）；新 `layout="stacked"` = 标签在上（窄卡片、KPI 下面）。StatStrip 每格新可选 `onSelect`（按钮，`aria-pressed`）/ `href`（链接）/ `selected`：整格可点，悬停浅底、键盘焦点框、选中 = 主色浅底（当列表筛选用）；没给的格子照旧只读。
- **看板「数字组」在窄画布上被裁**：固定行高的网格里，窄屏（≤760px）也把数字折成两列，第二行被组件高度裁掉。现在只有按阅读顺序（`stacked`，行高跟内容走）才两个一行；6 列网格里数字始终一行、由 FittedKpi 缩字，组窄于 560px 时卡片内边距收紧。数字组最小高度 3 → 4 行（编辑态标题 + 一行数字，3 行会裁；存量 h=3 读入时自动补成 4）。
- **手机上一挂看板整页往下跳**（官网概念页首屏跳到 ~3300px）：看板手机版的列胶囊条挂上时用 `scrollIntoView({ block: "nearest" })` 把当前列滚进来，它连页面一起滚到了折叠线下面的看板。新内部工具 `scroll-reveal.ts`（`revealInline`：只改横向条自己的 `scrollLeft`，从不滚页面；纯函数 `inlineRevealLeft` 有单测），看板列胶囊、仪表盘标签条、大图预览缩略图条都换成它。排查了挂载时会滚动的其他地方：日历周视图（只设自己的 scrollTop）、步骤条 / 视图标签（只设自己的 scrollLeft）、甘特 / 时间线 / 转写（只滚自己的盒子）没有问题；挂载时没有不带 `preventScroll` 的 `focus()`。浏览器测试 `test:views`：390 下视图区在 1600px 之下，挂看板、切日历、切甘特、切回看板，`window.scrollY` 一直是 0（修之前是 1037）。
- **深色模式主按钮发暗（官网首屏「开始使用」）**：不是色值问题——六套色卡深色主按钮白字对比度 5.95–10.05，森林绿深色 `#306848` 就是基础元素审阅通过的样稿值。真正的原因是 `.adminui[data-aui-mode=dark] a`（优先级 0,2,1）压过了按钮自己的颜色（0,2,0），`<Button asChild><a>` 的白字被刷成主色绿、描边 / 幽灵按钮也变绿。改成 `:where(a)`（0,2,0），正文里的普通链接深色下照旧是主色。单测（contracts）：六套色卡深色主按钮白字 ≥ 4.5、森林绿 = 样稿值、深色链接规则不再是 (0,2,1)。
- **MediaThumb 单独用没有尺寸**：新 `size={数字}` = 固定方块（px，最小 16，96 以下用小号图标 / 播放钮 / 角标，圆角）；`"sm"` / `"md"` 照旧跟容器走。纯函数 `mediaThumbBox`。

**测试**：单测 `rail-shell-core`（folderCount）、`media-core`（mediaThumbBox）、`builders-core`（数字组最小 4 行）、`scroll-reveal`（横向露出）、`contracts`（深色主按钮）；浏览器 `test:views`（390 挂视图不滚页面）、`test:form-controls`（相对日期 1440 / 390 不压字）、`test:basics`（骨架头像 32px 圆，1440 / 390）、`test:overlays`（手机 FormDialog 四个按钮的排法）、`test:history`（「字段」列居中、390 冲突卡片）、`test:page-templates`（NavTree 文件夹数量；T01 指标带可点：整格按钮、悬停、选中、焦点框、链接、只读格）。

**同事会注意到**：键值列表变成左标签右值、更紧凑；手机上打开带看板的页面不再自己往下跳；深色下做成链接的按钮字色恢复正常；目录文件夹右边多了灰色数字；手机上表单弹框按钮多的时候会排成几行；确认框没写按钮字时显示「确定」。

## 8.0.1（2026-10-08）

<!-- adminui/8.0.1：有宿主项目反馈一个视频 宝石开启中.mp4（H.264 Constrained Baseline 1920×1080 + AAC，浏览器都能放）在大图预览里「一张放大的静帧、超出右下、不居中、没有播放控件」 -->
**修大图预览放不了大分辨率视频 + 视频 / 音频断了能自己续上。** 只改补丁级行为，新增的都是可选属性，不升级也照常用。

- **根因（CSS）**：`.aui-lb-canvas` 是没有轨道定义的 grid，自动行按内容长高——1920×1080 的视频 `height:100%` 不起作用、按宽度和比例算出 985px 高，在 1920×880 的窗口里撑出舞台底部，原生控件条被裁掉，看起来就是一张不居中的静帧（宽高比比 16:9 更扁的窗口都会出）。现在画布是一个固定大小的格子（`grid-template: minmax(0,1fr) / minmax(0,1fr)`），视频 / 图片 / 预览框按舞台缩放、居中，控件始终在舞台里。
- **兜底卡片的海报**限在舞台里（`max-height: min(300px, 45vh)`，海报先缩），名字 / 说明 / 按钮在矮屏也看得见；卡片自己最多和舞台一样高。
- **MediaLightbox / AttachmentGallery 新属性 `onReload(item)`**：图片 / 视频 / 音频没有地址时（签名失败、还没签到）卡片上多一个「重新加载」，宿主重新取地址（返回 Promise 时按钮显示「正在重新加载…」）。
- **新属性 `onMediaError(item, { currentTime, code }) → Promise<string | null>`**（MediaLightbox / AttachmentGallery，AudioPlayer 上是 `onMediaError(info)`）：视频 / 音频加载出错（预签名链接过期、被撤销、网断）时向宿主要一个新链接，换上后**从原来的秒数接着放**（原来在放就继续放）。连续出错只重签一次：新链接还不行，就按错误码给原因——编码不支持 →「浏览器不支持这个视频编码，下载后播放」+ 下载（不再是一张不动的图）；文件坏了 → 解码出错；网络 → 「重新加载」。
- 新导出：`useMediaSource`（播放地址 + 出错重签 + 续播的 hook）、纯函数 `planMediaError` / `mediaFailureOf` / `mediaFailureText` / `resumeAt`、`MEDIA_ERR`，类型 `MediaErrorInfo` / `MediaRecover` / `MediaFailure` / `MediaErrorStep` / `MediaSourceState`。
- 测试：`test/media-source-core.test.ts`（重签 / 放弃 / 续播秒数）；`npm run test:media` 加「恢复」一节（`test/media-recovery.html`：1920×880 下 1080p 视频不越出画布、控件在舞台里；没地址时大海报不撑破舞台、1920×880 和 844×390 都居中、「重新加载」；打开时 403 → 重签一次 → 放出来；播到 1.6 秒出错 → 重签后从 1.6 秒接着放；坏文件重签一次后提示编码不支持 + 下载）。

**宿主要做的**：要「链接过期自动续上」和「重新加载」，把重签函数接到 `onMediaError` / `onReload`。不接也能用：CSS 修复不需要任何改动。

## 8.0.0（2026-10-08）

<!-- adminui/8.0：组件库收尾的干净大版本 -->
**干净的大版本：删掉已被新组件取代的旧写法（不留兼容层）+ CSS 按组件拆开 + 小 / 中 / 大三档起步样板 + 体积门禁 + 迁移审计。** 旧项目升级可选（钉旧标签照常可用），要升照 [MIGRATION-8.md](MIGRATION-8.md) 改，再跑 `npx @adminui/react audit src` 清零。

- **删掉的导出**：`ThemePicker`、`BatchBar`、`ConflictDialog`（+ `ConflictField`）、`FieldTile` / `FieldTiles`（+ `FieldTileProps`）、`RecordDisplay`、`LEGACY_TONE_MAP` / `LEGACY_OPTION_TONES` / `LegacyOptionTone`、`VIZ_CATEGORICAL` / `VIZ_SEQUENTIAL` / `VIZ_STATUS` / `vizColors`、`resolveBrandColors`（charts）、`shareSummary` / `ShareSummaryChip`、`visibleComments`、`DEFAULT_REACTIONS` / `CommentReactionKind`、`VIEW_TIER_BADGES`（views）、`LEGACY_ROW_HEIGHT` / `migrateLayout`（dashboard-builder）、类型 `Notice`。新增 `legacyTone(name)`：只用来读存量数据里的旧 7 色名。
- **删掉的属性 / 写法**：Button `size="icon"`（→ `IconButton`）、`variant="link"`（→ `Link` / `variant="text"`）、Button / IconButton 的 `title`（→ `tooltip` / `disabledReason`，SDK 组件上不再出原生提示）；MenuButton `size="icon"`（→ `MoreMenu`，新 `icon` / `tooltip` / `align` / `className`）；AdminShell `profile`；CommentThread `unresolvedOnly` / `onUnresolvedOnlyChange` / `reactions`；DataTable `batchMode` / `batchActions` 和 `TableCellContext.batchMode`；SectionCard `unfilled` / `onFill` / `fillLabel`；RecordHeader `variant`（只有白底紧凑一种）；`RecordLayout.display`（方块布局删掉：没有 `cards` = 字段行，有 `cards` = 记录详情 C）；Avatar `xs` / `sm`、AvatarStack `sm` / `md`（→ 像素数）；`OptionTone` / `CellTagTone` 只有 20 个新名；`TranscriptCategory.tone` 改成 green / teal / greenSolid / gray；看板组件和 `normalizeDashboard` 只认版本 2（存档先过 `migrateDashboardSpec`）。
- **SDK 内部统一**：91 处 Button 图标按钮 + 12 处图标菜单换成 IconButton / MoreMenu；胶囊 / 描边标签（权限来源、授权名单、表格权限、操作记录状态、北极星、分享页、规则停用、表单停止收集、清单状态、人员块）改成圆角 6 的软方块；零碎字号对到 8 档；删掉 `.aui-menu*`、`.aui-batchbar*`、`.aui-ftile*`、`.aui-profile*`、`.aui-palette-choice*`、`.aui-button-icon` / `-link` 等旧样式和 36 个早已不渲染的类。
- **CSS 拆开**：`styles.css` 只剩 token + 基础 + 核心组件（gzip 108.8 → **24.1 KB**）；其余 37 块样式（grid、views、charts / dashboard、dashboard-builder、form-builder、access、ai、media、record、share、comments、approval、notification-center、command-palette、shell …）由用到它的组件模块自己引入（`#aui-css/<块>.css`，package.json `imports`：打包器拿 CSS、Node / SSR / 单测拿空模块），页面只带渲染到的样式，懒加载的子路径连 CSS 一起按需加载。拆分前后在 starter 61 页 × 1440 / 390 × 浅 / 深逐个元素比对计算样式：0 处差异。新脚本 `scripts/css-chunks.mjs` 检查每个模块引的块和它渲染的类一致（`--fix` 重写），进了 `npm run check`。
- **记录详情按需加载**：`useRecordDetail` 挪到轻量的 `record-detail-state.tsx`，记录弹框（含 C 版卡片分区、编辑布局）第一次打开时才加载——带「展开记录」的 DataTable / ActivityFeed 不再把整套记录详情放进首屏。`RecordFieldList` 挪到 `record-field-kv.tsx`（导出不变）。DataTable `expandRecord.render` 的内容不再多套一层 `.aui-record-tab`（以前双倍内边距）。
- **三档起步样板**：新 `examples/small`（只用核心入口：外壳 + 列表 + 表单弹框 + 提示 + 设置）、`examples/large`（总览 + 懒加载的多维表格 / 看板 / 图表 + Markdown）；`examples/starter` 是中档，展示页全部改成懒加载（首屏 548.8 → 179.3 KB JS 含 react，CSS 108.8 → 37.4 KB）。三档只是默认起点，任何子路径都能加。
- **体积门禁**：`scripts/size-budget.mjs`（`npm run size`，进了 `npm run check`）——按入口 / 子路径的 gzip JS / CSS 预算 + 核心 JS 预算 + 三档首屏预算；核心 / 根入口 / 小档引到重依赖（echarts、TanStack、markdown、excel）直接失败。前后数字见 MIGRATION-8.md §7。
- **审计（admin-ui-audit）**：新规则 `removed-api` / `removed-prop` / `removed-class` / `removed-css-var` / `legacy-tone` / `deep-import`，每条写 文件:行 + 换成什么（和 MIGRATION-8.md 同一张表 `MIGRATION_8`）；新 bin `admin-ui`：`npx @adminui/react audit <目录>`。
- **文档**：AI-RULES / DESIGN / TABLES / DASHBOARDS / GRID / VIEWS / INTEGRATION / PAGE-TEMPLATES / WORKFLOWS / SKILL / catalog 只写新的一套；AI-RULES 和 INTEGRATION 加「项目规模 → 起步档 → 子路径 → 样板 → 首屏预算」表；新 MIGRATION-8.md。

**同事会注意到**：图标按钮小一号（幽灵 36 → 32，手机 40）；所有标签都是方块；侧栏菜单字 13.5 → 13、分组标题 11.5 → 12；记录头部不再有渐变底；开发时首屏加载更快、打开某页才加载它的样式。

**风险**：① 样式加载顺序跟着组件依赖走：宿主 `styles.css` 必须是入口第一个 import；靠「后写的覆盖先写的」去改 SDK 样式的宿主代码（本来就不允许）更容易失效。② 消费方的打包器必须支持 package.json `imports`（Vite ≥ 4.2、webpack 5、esbuild 都支持）；Jest 这类不认 CSS 又不走 `node` 条件的环境要配 CSS mock。③ 记录弹框改成懒加载：第一次打开多一个网络请求，e2e 里「点了立刻断言弹框」要等弹框出现。④ 小档 CSS 首屏 30.0 KB（原定约 15 KB）：核心组件（按钮 / 输入 / 下拉 / 弹框 / 提示 / 表格 / 外壳）已经是审过的样子，再压要动设计，记作后续。⑤ 删掉的 API 没有兼容层：钉 7.x 的项目不受影响，升 8.0 必须改完。

## 7.19.0（2026-10-08）

<!-- adminui/7.19：组件库审阅「协作、分享与媒体」10 项全过 -->
**协作、分享与媒体换新 + 通用审批组件**：逐项审定的「协作、分享与媒体」审阅落地。根入口只新增导出，没有删导出；被替代的用法标了 `@deprecated`（8.0 删）。

- **评论 `CommentThread`（唯一的评论实现，知识库也换成它）**：标题行「评论 N」+ 分段 **全部 / 未解决 N / @我 N**，**默认「未解决」**（已解决的不显示；「全部」里整串收成一行灰条，点开看、可重新打开）。新 `filter` / `defaultFilter` / `onFilterChange` / `filters`（可加 `resolved`）/ `mentionsMe`、`viewerId` / `viewerName`（@我、提到我 = 主色实底、回应提示里的「你」）。列表自己滚、输入框贴底（新 `fill` 撑满父高度），「回复 小王 ×」在输入框上方，日分隔「今天 10月7日 / 昨天」（`groupByDay`，时间只写 15:02）。回应**固定 4 种 赞 / 收到 / 看过 / 有疑问**（图标 + 字的软胶囊，`CommentReaction.names` 悬停看是谁，选择弹层四个大按钮）。**行内小工具**（回应 · 回复 · 解决 · ⋯）悬停 / 键盘聚焦才浮在右上角，触屏和 ≤ 760px 常显一行小字。回复超过 1 条折成「展开 N 条回复」+ 头像叠。删除改成**小气泡确认**（「回复会留着，这里显示『评论已删除』」）。头像用 `Avatar`（按人取色），文件是小卡片、图片 72×54。@ 列表里 `CommentPerson.unavailable` 的人灰掉、写原因、不能选。知识库要的：顶层评论 `quote: { text, state?: "page" | "orphaned" }`（划词原文 / 全文评论 / 原文已删除）、`activeId` 高亮当前线程、`onSelect(id)`（点线程让正文滚到划词）、`composerNotice`（「对方看不到这页，是否授予阅读？」）、`resolvedAt`。新纯函数 `filterComments`、`commentCounts`、`mentionsViewer`、`isViewerMention`、`foldReplies`、`commentDayLabel`、`groupCommentsByDay`、`reactionTip`、`COMMENT_REACTION_KEYS`。
- **改前 → 改后只有一种写法**：新 **`ChangeValue`**（旧值备注色删除线 → 新值加粗，「空」不划线，`unit` / `stacked`）。AI 建议、单元格历史、操作记录（行内一句 + 展开明细）、分享访问记录都换成它；`LogTimeline` 展开明细的改前 / 改后两列从红绿底改成同一写法；`ChangeList` 的原值也划线。
- **通用审批（新）**：**`ApprovalList`**（分段 我的申请 / 待我审批 N / 全部、一行两层 56px：头像 · 谁 · 部门 / 类型标签 · 标题 · 理由，右边小步骤点 + 状态 / 时间，`toolbar` 插槽、`footer`、`serverFiltered`）、**`ApprovalDetail`**（头 → 理由 + `fields` → `renderSubject` 画申请时的内容 → 审批进度 → 当前审批人：意见框 + 驳回（必须写原因，框变红 + 一行说明）/ 批准；申请人：撤回申请 + 确认）、**`ApprovalProgress`**（竖线步骤：每步审批人、任一人 / 都要批 + 已批几人、同意 / 驳回 + 原因 + 时间，当前步注意色浅底）、**`ApprovalProgressCard`**（记录详情卡片槽里的进度卡）、`ApprovalMiniSteps`。纯函数在 `approval-core`（无 React）：`stepStates`、`stepPassed`、`stepTally`、`pendingApprovers`、`currentStepIndex`、`canDecide`、`canWithdraw`、`decisionError`、`approvalStatusMeta`、`filterApprovals`、`approvalCounts`、`modeText`、`waitDays`、`waitingSince`、`currentLine`。组件里没有业务词，报价折扣 / 请假 / 权限申请都用它。
- **分享弹窗 `ShareDialog`**：600 宽一列、**不再套 8 张卡**、1440×900 一屏放下：链接行 → 一句话摘要（新 `shareSentence`，跟着设置变）→ 谁能打开 → 扁平设置列表 → 底栏。**只有「复制」实心**（有密码时「复制链接和密码」），**「完成」描边**；链接下面那排胶囊去掉；二维码收进链接旁的图标按钮（气泡 + 下载 PNG，**深色下放浅色卡上**）；访客能看的字段收成一行「10 / 14 个 · 可改 3 个 · 调整」；通知 / 暂停 / 重新生成 / 访客预览进头部「⋯」；手机全高底部弹层、复制按钮 44 高。**即改即生效**：新 `onApply(next, before)`（保存中… → 已保存，立即生效；失败退回原值、底栏写原因 + 重试，不弹框），`onChange` 改成可选，`ShareSaveState.onRetry`、`onRegenerate`，`SharePeople` 加 `locked` / `summary` / `searchSubjects` / `onApply` / `addPlaceholder`；`expiryHours` 默认空（1 / 7 / 30 天 / 永久 / 自定义）。
- **授权名单 `GrantList` 即改即生效**：`apply="instant"` + `onApply(change, next)`（`GrantChange`：add / level / remove），行内转圈，失败只退回那一处并写原因 + 重试，底部「保存中… / 已保存，立即生效」；`levelPicker="menu"`（4 档以上：可查看 / 可评论 / 可编辑 / 可管理）；`GrantHolder.level` / `tag` 让负责人锁成一行；`summary` 灰条。所有 picked 名单：搜索框移到名单上面、去掉单独的「添加」按钮，行内 × 悬停才出、触屏常显。新纯函数 `applyGrantChange`、`revertGrantChange`、`grantChangeId`、`grantChangeText`。
- **公开分享页默认加水印**：`SharedPageShell` 新 `watermark`（`variant="page"` 默认开，`false` 关）+ `visitor: { ip, at }` / `timeZone` 生成「访客 203.0.**.18 · 10-05 20:16」；颜色淡到备注色 14%，斜铺、不挡点击。新纯函数 `shareWatermarkText`、`expiryPhrase`、`shareChangeLabel`。
- **单元格历史 `CellHistoryPopover`**：380 宽竖线时间轴，每版 `ChangeValue` + 谁 · 何时 · 灰色来源小标；当前版本主色点 +「当前」；「恢复」只在悬停 / 聚焦那一行出现（触屏常显），点了就地确认「恢复成 X？会记成一个新版本」；去掉原生 title。新 `now`。
- **我的分享 `ShareManager`**：「能做什么」、事件类型改成软标签（无边框，「编辑」不再实心）。
- **看大图 `MediaLightbox` 整屏沉浸**：媒体舞台色铺满整个视口，不再是带白边的弹框套圆角卡；上栏 名字 +「第 N / M 个」+ 下载 / 新窗口 / 信息 / 关闭，底部浮动工具条 缩小 · 100% · 放大 · 旋转 · 适应（+ / − / 0 键、Ctrl + 滚轮、放大后拖动平移），两侧圆钮翻页、底部缩略图条，手机左右滑、工具条在底部。新 `info`（信息侧栏内容）/ `defaultInfoOpen` / `minZoom` / `maxZoom`；缩放 / 平移数学在纯函数 `media-zoom.ts`（内部，带单测）。原有键盘（← → Esc 归还焦点）不变。
- **媒体 token 与录音红**：照片 / 视频上的字和遮罩只用 `--aui-on-media` / `--aui-media-scrim*` / `--aui-media-stage`；录音红只给录音键、录音中圆点和字、录音波形（计时下的红虚线去掉）。麦克风打不开：两步说明 +「再试一次」+「改成上传录音文件」（`AudioRecorder` 新 `onUpload` 等），浏览器英文原因放最后一行小字。
- **录音文字稿**：说话人颜色改成**蓝 / 橙 / 青分类色**（新 `SPEAKER_TONES`、`speakerToneAt`、`speakerTone`、`speakerColors`，按说话人顺序或 `TranscriptSpeaker.slot`，不用主色深浅）；波形没播的段 35% 淡、播过的满色、静默段线色，AI 标注是波形上方的小钉；控制一行（后退 15 · 播放 40 · 前进 15 · 时间 · 倍速分段，三个开关小号在右，手机收进 ⋯）；导出收进标题行「导出 ⌄」下拉；右栏 AI 摘要 + 说话占比 + 标注统计（新 `annotationStats`）。
- **AI 审阅**：`SuggestionReview` 的「采用」改**描边主色字**、「忽略」幽灵，采用后整行主色浅底，忽略的写「恢复」；改前改后用 `ChangeValue`；「接受提示」走深色气泡（不再是原生 title）。
- **操作记录**：类型标签改成软标签（圆角 6 无边框）。
- **细滚动条**：去掉看板筛选行里残留的 `scrollbar-width: thin`（统一走 foundations 的细滚动条）。
- **头像按人取色核对**：评论、@ 列表、审批、单元格历史都用 `Avatar` / `avatarTone`（选项 10 色里取，灰色留给离职 / 系统）。

**弃用**（8.0 删）：`CommentThread` 的 `unresolvedOnly` / `onUnresolvedOnlyChange`（→ `filter` / `onFilterChange`）、自定义 `reactions`（回应固定 4 种）；`visibleComments`（→ `filterComments`）；`shareSummary` / `ShareSummaryChip`（→ `shareSentence`）。

**测试 / 文档**：新单测 `collab-core`、`approval-core`，`share-core` 加摘要 / 名单改动 / 水印，新单测 `media-zoom`，`transcript-core` 加说话人颜色；`test:media`（整屏大图、缩放 / 键盘 / 平移、焦点归还、手机滑动）/ `test:transcript`（三种分类色、播过 / 没播透明度、控制一行 / 手机 ⋯）跟着改；新浏览器 **`test:collab`**（评论：默认未解决、@我、日分隔、列表自己滚 + 输入框贴底、提到我、4 种回应 + 谁点的、悬停小工具 / 手机常显、回复折叠、已解决收一行、@ 往上开 + 看不到的人灰掉、删除小气泡 → 墓碑、划词引用 / activeId；ChangeValue；审批分段 / 两行行高 / 一个主按钮 / 驳回必填 / all 模式 / 撤回 / 进度卡；1440 浅深 / 390），`test:share` / `test:records` / `test:ai` 跟着新样子改。starter 新页「协作与分享」「审批」。DESIGN §2.6、AI-RULES 附录 U + 套件第 18 类「审批」、catalog（`comments` / `change-value` / `approval` / `share` / `grant-list`）、AGENTS 门禁表。

**同事会注意到**：评论栏默认只看「未解决」，已解决的要点「全部」；每条评论下面那行「回复 / 回应 / 解决」不见了——鼠标移上去右上角才出（手机照常一行）；回应只有 赞 / 收到 / 看过 / 有疑问 四种；删除评论是一个小气泡而不是大弹框。分享弹窗变成一列、只有「复制」是绿色实心按钮，二维码要点链接旁的小图标才出来；页面权限 / 链接分享改了就生效，没有保存按钮。公开分享页默认有一层很淡的水印。AI 建议的「采用」不再是实心绿按钮。所有「改前 → 改后」都是灰色删除线 → 加粗。新增「审批」整套组件。

**风险**：① e2e 里找「只看未解决」按钮、`menuitemcheckbox` 回应菜单、「删除这条评论？」确认框、常驻的「回复」按钮（现在要先悬停）、`.aui-comment-op` / `.aui-comment-ops`、`.aui-sug-before` / `.aui-sug-after`、分享弹窗里的卡片和胶囊排、「添加」按钮的，要跟着改。② 宿主没传 `filter` 时评论默认只显示未解决的——依赖「打开就看到全部」的页面要传 `defaultFilter="all"`。③ `ShareDialog` 高度和结构变了，按旧卡片写的覆盖样式会失效；`expiryHours` 默认值变了。④ 默认水印：已经自己画水印的公开页会叠两层，传 `watermark={false}`。⑤ 审批组件只负责显示，谁能批由服务端判定（`canDecide` 只是隐藏按钮）。

## 7.18.0（2026-10-08）

<!-- adminui/7.18：组件库审阅「导航与布局」10 项全过 -->
**导航与布局换新**：逐项审定的「导航与布局」审阅落地。根入口只新增导出，没有删导出；被替代的用法标了 `@deprecated`（8.0 删）。

- **外壳尺寸**：`AdminShell` 侧栏 228 → **232**、折叠 76 → **64**、顶栏 52 → **48**；菜单行 34px、图标 18、圆角 6，当前 = 浅一档的块 + 加粗。分组标题 11.5px；深色下侧栏右边一条线分开画布。
- **切换公司在左上**：新 `company`（`CompanySwitcher`：品牌下一条「当前公司」按钮 → 列表 + 当前打勾 + `footer`「公司设置」；只给 `onOpen` 时直接打开宿主自己的选择页）。新 `logo`（标志方块，折叠后只剩它；字符串 brand 默认取第一个字），brand 里 `<small>` 是灰色副名。
- **账号菜单**：新 `account.role` + `accountMenu` + `onSignOut` + `accountAppearance` → 左下一行「头像 + 名字 + 岗位」，点开 我的资料 / API 令牌 / 管理后台 ↗（`href` + `external` 新标签页）/ 外观 浅·深·跟随系统 / 退出登录（`AccountMenu`，也能单独用）。底部散按钮的 `profile` 槽 **@deprecated**（没给 `accountMenu` / `onSignOut` 时照旧画）。折叠后公司 / 账号菜单向右弹出。
- **菜单数量 / 没开通**：`NavItem.badge`（千分位灰胶囊，`badgeTone: "danger"` 实心；折叠后挂在图标角上、99+）、`locked`（灰 + 锁、不能点，字符串是原因）。数字 `aria-hidden`，按钮名不变。
- **顶栏真面包屑**：去掉固定的「工作空间 /」；`crumbRoot` →（`WorkspaceItem.crumbs` 或菜单 `group`）→ 当前页（深色加粗）。纯函数 `shellCrumbs`。
- **工作标签改胶囊**：30px，当前白底 + 细边 + 加粗、图标主色；× 只在当前 / 悬停（opacity，仍在读屏树里）；没存 = 琥珀圆点、悬停变 ×；`WorkspaceItem.pinned` = 只有图标的工作台；右端常驻「N ⌄」= 全部已打开的页面（>8 个可搜）+ 关闭其他 / 关闭右侧；右键同样菜单；中键关闭；新 `onCloseTabs(ids)`（不给就逐个调 `onCloseTab`）。纯函数 `tabsToClose` / `searchTabs`。
- **手机**：去掉工作标签条，顶栏 = ≡ + 当前页名 + 操作 + 页签数按钮（点开已打开的页面）；抽屉 min(304, 84vw)、44px 行、右上 ×、Esc 关。
- **外观弹层**：新 **`AppearanceButton`**（太阳 / 月亮 → 浅色 / 深色 / 跟随系统 + 6 个色卡色块 + 字号 + 「自定义品牌色…」）、`AppearancePanel`、`ColorModeChoice`、`COLOR_MODES`。`AdminProvider` 记住用户的外观（`${storageKey}:mode`），`useAdminTheme()` 新 `modeChoice` / `setMode`；宿主自己改 `mode` 时以宿主为准。**`ThemePicker` @deprecated**：现在就是这个小弹层（图标仍是调色板、名字仍叫「色卡设置」），不再弹大对话框。
- **页内标签只用下划线**：40px（`Tabs size="sm"` / 栏里 36），字间距 24、线和字等宽，选中 = 深主色字 + 加粗、**没有浅底块**（`TabbedPage` 也是）；数量灰胶囊、选中主色浅底；放不下右端 **「更多 ⌄」**（列出全部分区），**不再有圆箭头**（`ScrollStrip` 新 `trailing` / `trailingWhen`，给了就不画箭头）。
- **面包屑**：`Breadcrumbs` 灰色、悬停变深 + 浅底、当前页深色加粗、分隔小箭头；`maxItems`（默认 4）以上中间收成「…」菜单；手机只留「← 上一级」。新类型 `BreadcrumbItem`。
- **列表 → 详情两步**：`ListDetailLayout` 新 `onBack` / `detailOpen` / `backLabel` / `detailTitle` / `detailActions`，`WorkspaceLayout` 新 `narrow="steps"` + `detailOpen` / `onBack`：≤ 760px 先列表、点进只看详情、顶上「← 返回」（新 `NarrowBackBar`）。不传 `onBack` 时照旧上下叠。
- **表设置抽屉**：新 **`SettingsSheet`**（880、左 184 分节：`group` 小标题 / `icon` / `count` / `dirty` 琥珀点 / `error` 红叹号；右边一次一节 + 标题 `title` / `hint`；底部 `SaveBar placement="footer"`「改了 N 处 · 取消 · 保存」，有改动时关闭先问；手机铺满、分节变吸顶胶囊）。`SaveBar` 新 `placement="footer"`（一直显示，保存在没改时不能点）。
- **设置侧导航**：`SideNavLayout` 不再包卡片，分组小标题（`group`）+ 34px 行，当前主色浅底加粗，`error` 红叹号，窄屏吸顶胶囊横滑。
- **分页 / 加载更多**：当前页主色浅底加粗（页码无框）；新 **`LoadMore`**（加载更多 · 已显示 50 / 共 128 条 → 加载中 → 失败 + 重试 → 已经到底了 · 共 N 条）；`LogTimeline` 底部换成它。时间线 / 动态 / 评论用加载更多，表格用页码。
- **步骤**：`Steps` 做完的字用**正文色**（不灰），圆 24、当前带浅光；`StepItem.description` / `status: "waiting" | "error"`、`onStepClick`（做完的可点回去）、`orientation="vertical"`；手机横排只留圆和当前步的字。
- **登录页**：新 **`AuthLayout`**（居中 420 一栏：标志方块 + 标题 + 一行说明 + 卡片 + 灰色页脚，`embedded`）+ **`LoginForm`**（账号 / 密码带图标、密码可显示、`remember`「7 天内自动登录」、`forgot`；**按钮一直能点**，点了再在字段下写缺什么并聚焦第一个；`onSubmit` 抛错 → 卡片顶一条异常提示；登录中转圈）。
- **公开页外框**：`PublicPageLayout` 新 `logo`，品牌带改成**白底**（标志 + 名字 + 小字）+ 右上进度 + **带底细进度线**；`PublicForm` / `FormSuccess` 同一种品牌带；结果页圆图标 56。
- **RailShell 外观和 AdminShell 统一**（外壳不换）：图标栏 56 → 60、48 格、圆角 6、角标同一种；目录行 34、当前表 = 白块 + 细边、标题头 48。
- 顶栏 / 弹层：`PopoverLayer` 新 `side`（`top` / `right`）。

**弃用**（8.0 删）：`AdminShell profile`（→ `account` + `accountMenu` + `onSignOut` + `company`）；`ThemePicker`（→ `AppearanceButton`）。

**测试 / 文档**：新单测 `shell-core`；新浏览器 `test:navigation`（外壳尺寸、左上公司 / 左下账号菜单、菜单数量、面包屑、胶囊标签 +「N ⌄」+ 右键 + 中键、外观弹层、折叠向右弹出、页内标签「更多」、表设置抽屉、步骤、加载更多、登录点了再校验、手机标签数 / 抽屉 / 列表 → 详情 / 铺满的设置抽屉），截图 `test/artifacts/navigation/`（1440 浅 / 深 + 390）和样稿 `shots/new/` 并排看过；`test:browser`（折叠账号、外观弹层、页内标签「更多」）、`test:components`（顶栏）、`test:design`（面包屑分隔）改了断言。DESIGN.md §1.3 / §2 / §3（新 §3.1.1）、AI-RULES §0.1 + 附录 T、PAGE-TEMPLATES T08 / T09 / T10 / T16、INTEGRATION §2、catalog（新 `navigation`）同步；starter 外壳换成新账号区 + 外观按钮，新增「系统 → 外壳与布局」页（名字里不带「导航」，免得和测试里找「菜单 / 导航」按钮撞上）；`test:page-templates`（T15 图标栏 60）、`test:charts`（色卡在外观弹层）也改了断言。

**同事会注意到**：侧栏宽一点、收起后窄一点、顶栏矮一点；左上多了「当前公司」，左下变成一个头像（我的资料 / API 令牌 / 管理后台 / 外观 / 退出都在里面），不再有四个小按钮；顶栏写「业务 › 客户」而不是「工作空间 / 客户」；工作标签变成圆角胶囊，右边有个「4 ⌄」，能右键 / 中键关；手机上没有标签条，右上角一个数字；太阳 / 月亮按钮里切浅色 / 深色 / 跟随系统和色卡；页内标签没有浅底块、放不下出「更多」；面包屑变灰；设置抽屉左边分节；做完的步骤字不再是灰的；登录按钮不再是淡绿色的「不能点」。

**风险**：① 宿主不改代码时账号区仍是旧的 `profile` 槽，但侧栏 / 顶栏尺寸、胶囊标签、页内标签、面包屑样式会直接变——按 76px / 52px 算位置的宿主要改。② e2e 里找「工作空间」、`.aui-topbar-title > strong`、`.aui-scroll-arrow`、色卡对话框（「应用色卡」）、`.aui-palette-choice`、`.aui-breadcrumbs-sep` 的要改：面包屑 → `role=navigation name=面包屑`，色卡 → `.aui-appearance-pop` 里的色块按钮，页内标签放不下 → `「<label>：更多」` 按钮。③ 手机上 `.aui-tabs-strip` 不显示，靠顶栏 `.aui-tabs-count`。④ 页签 × 平时 `opacity: 0`（还在读屏树里）；没存的标签 × 盖在圆点上。⑤ 用户在外观里选过深色后，宿主固定传的 `mode` 不再生效（宿主改 `mode` 值时才重新生效）；只想给固定明暗的宿主别放 `AppearanceButton` / 账号菜单外观（`accountAppearance={false}`）。⑥ `Steps` 每步的字包进了 `.aui-step-text`；做完的字颜色变深。⑦ `SideNavLayout` 不再是白卡片，窄屏是吸顶胶囊（宿主卡片背景若依赖它要检查）。⑧ 提示条（右下）会盖住 `SettingsSheet` 底部按钮几秒——保存成功的提示别太长。

## 7.17.0（2026-10-08）

<!-- adminui/7.17：组件库审阅「视图与卡片」8 项全过 +「数据表格与列表」10 项全过 -->
**视图与卡片 + 数据表格与列表换新**：逐项审定的「视图与卡片」「数据表格与列表」两批审阅一起落地。根入口和子路径只新增导出，没有删导出；被替代的用法标了 `@deprecated`（8.0 删）。

视图（`@adminui/react/views`）：
- **视图标签一行**：`ViewTabs` = 标签 →「+」→ 右侧「视图」（视图管理）+ `trailing`（仪表盘组）；**去掉左边的「视图 ▾」按钮**，「更多 N」按 标准 / 共享 / 我的 分组、最下面「管理视图…」。标签带**档位记号**（标准 = 小锁、共享 = 两个人、我的 = 不加），不再写带框的「标准 / 共享」字；新 `ViewSummary.modified` = 改了标准 / 共享视图（只对自己生效）→ 注意色小点；新 `onRename` / `canRename`（双击 / F2 就地改名）。**手机**：所有标签一行横滑（两边渐隐、当前滚到中间，没有「更多」），`trailing` 收进「视图」面板，视图管理 / 新建视图是底部弹层。
- **新建视图**：新 `onCreateView({ kind, name, audience })` + **`NewViewPanel`**（6 张类型卡，每张一句用途 `VIEW_KIND_HINTS` + 名字 + `createAudiences`「只有我 / 共享给一组」+ `createNote`）；旧 `onCreate(kind)` 照样用（只出类型卡，第二个参数也能拿到草稿）。新类型 `NewViewDraft`、`ViewAudience`、`VIEW_AUDIENCE_LABELS`，纯函数 `overflowGroups`、`searchViews`。
- **视图管理**：380 宽、搜索（> 6 个视图）、三档小标题写谁维护、**眼睛悬停才出**（中性色，隐藏的灰色划线，必看的禁用写原因）、底部「+ 新建视图」（在 ViewTabs 里打开同一个新建面板，`ViewTabsContext`）+「拖动排序只改你的标签栏」。
- **改了标准视图的提示条**：`ViewOverrideBar` 新 `viewName` → 注意色浅底一行「你改了「我的客户」的筛选（阶段 = 报价），**只对你生效**，别人看到的还是原样」+ 文字按钮 恢复 · 另存为我的视图 · 保存给所有人（不给 `viewName` 时还是「你的个人设置：…」）。
- **记录卡片**：`RecordCard` 五个固定位——封面（16:10，可选）→ 标题（两行）→ 标签行 `tags`（10 色软标签，3 + N）→ 关键数行 `keyline`（金额加粗 · 区域）→ 底栏 `owner` + `comments` + `due`（今天 = 注意色、逾期 =「逾期 N 天」异常色，纯函数 `dueState`）；**默认不显示字段名**（`showLabels` 默认 false），空字段不占行；圆角 8、内边距 10 × 12，平时只有 1px 线，悬停加深 + 轻阴影 +「展开」（`onExpand`），聚焦 / 选中 = 主色边 + 3px 光圈，`locked`（小锁 + 原因）、`loading`（骨架）；没图的封面 = 中性底 + 图标（不写「没有附件」）。新类型 `RecordCardSlots<T>`，纯函数 `defaultCoverField` / `cardTags` / `cardKeyline` / `cardFieldEmpty`、`CARD_MAX_TAGS`、`NO_COVER`、`softTone`。
- **看板**：`cardSlots` / `showLabels` / `today` / `timeZone`；列宽 280、圆角 12、浅底无边框，列头 10 色软标签 + 条数 + **金额合计**（新 `KanbanColumnMeta.summary` 服务端整列合计，或 `sumField` 按已加载的卡片求和），＋ ⋯ 悬停才出；**「未设置」没有记录就不显示**；拖动：落点虚线框 +「松开放到「谈判」」、**底部居中提示条「阶段：报价 → 谈判 · Esc 取消」**（不再是压在卡片上的黑底小牌）、放下后「撤销」提示（新 `undo`，默认开，要 NotificationProvider）；`canMove` 锁住的卡片标题旁小锁，按住时提示 `lockReason`；空列「拖卡片到这里，或点 + 新建」、加载骨架卡、「还有 N 条 · 滚到底自动加载」；列菜单「列颜色」；**手机**顶部列切换胶囊（带条数）+ 一列 86% 宽横滑吸附。
- **画册**：顶部一行（条数 · 排序 | 封面字段 | 紧凑 / 常规 | 字段名），自动列宽 236（紧凑 184）间距 16；**表里没有图片字段时默认不显示封面**（`defaultCoverField`）；筛选无结果写当前筛选 +「清空筛选」（`filterText` / `onClearFilters`），骨架卡 +「已显示 20 / 168」（`total`）；手机 2 列不写字段名、负责人只留头像。
- **日历**：事件按选项色软底，定时事件 = 色点 + 时间 + 标题；跨周续段「‹」；**周末 / 假日浅底，假日写「休 国庆日」**（名字来自宿主的 `workCalendar.holidays`，SDK 仍不带地区日历）、补班「班」；今天 = 主色圆底数字；每格最多 3 行 +「+N 更多」；单击出事件卡（主按钮「打开详情」+「清除日期」），双击打开；格子 ＋ / 双击空白就地新建；无日期抽屉 300 宽、40px 行可拖到某天；周 / 日：全天栏 2 行 + 展开、上下拖改时间 / 左右拖换天（虚线预览写时间）；**「现在」线和时间牌用主色**（不再是异常红）；**手机只有月历小格 + 彩点 + 当天日程**，没有周 / 日（`CalendarWeek` 在手机上画月历并回调 `onModeChange("month")`）。
- **甘特**：条形 = 选项色软底 + 同色细边 + 深色字，放不下的字挪到条外（靠右边界挪左边，不被今天线穿过，`barTextPlace`）；**今天线和表头日期牌用主色**；周末浅底、假日斜纹；窗口外的记录只在当行边缘一个「09-28 → 10-02」小牌；手机列表带进度小轨道（`ganttTrack`）。
- **视图设置面板同一骨架**：标题行写视图名 + 标准 / 共享、分节小标题、左 96px 标签；`ViewSettingsFooter` 新 `changes`（「● 已改 1 处，只对你生效」，没改时「恢复」禁用，`countSettingChanges(shared, mine)` 算）、「恢复共享设置」改叫「恢复」、「保存给所有人」只给有维护权限的人；`CardSettings` 新 `preview`（实时预览卡）、`before`（看板「分组」节），「显示字段名」默认关；字段列表的眼睛中性色；手机底部弹层。
- **从视图打开记录 = 右侧抽屉**：`RecordDetailDialog` 新 `frame="drawer"`（640、贴右边、**没有遮罩不模糊**，视图仍可点——点别的卡片直接换人，↑ ↓ 上一条 / 下一条）、`onFrameChange`（抽屉 / 居中弹框 / 整页 同一外框，标题栏三档随时切）、`onCopyLink`、`frameMenu`，`nav.label`（「8 / 13 · 按阶段」）；新 **`RecordFrameBar`**（外框标题栏：左 ↑↓ + 位置，右 复制链接 · ⋯ | 三档 | ×）、`RECORD_FRAMES` / `RECORD_FRAME_LABELS` / `recordFrameNavText`。表格里点「展开」仍是居中弹框。

数据表格与列表：
- **手机 DataTable 默认卡片列表**（每行一张卡：勾选 + 标题 + 状态标签 + ⋯，下面一行 3 个值；「本页全选」；骨架卡），不再横滑；`mobile="table"` 保留旧表格；列可写 `mobile: "primary" | "status" | "meta" | "hidden"`（类型 `ColumnMobileRole`）。
- **表头 40px、12px / 600、次要色**，DataTable / CompactTable / 多维表格共用 `--aui-table-head-*` 变量；DESIGN.md 的表头规定改成 12px / 600、不加字距。
- **DataTable 行高** 紧凑 40 / 宽松 48 / 两行 56（`short` 和密度 compact 从 32 改成 40），第二行信息只在两行档出现。多维表格的行高不变。
- **批量操作 = 底部浮条**：新 **`BulkActionBar`**（`count` / `total` / `note` / `actions: BulkAction[]` / `onClear` / `maxVisible`）——「已选 2 条 · 转交 · 退回公海 · 导出 · ✕」，表格底部居中、不推动表格，超过一屏贴视口底，手机贴屏幕底；DataTable 新 `bulkActions` / `bulkNote`，**BitableGrid 新 `bulkActions(ids)`**（工具栏不再写「已选择 N 条 · 清除选择」）；勾选后操作列不再变灰；表头部分勾选 = 半选「−」。
- **多维表格工具栏固定一行**（`GridToolbar` / BitableGrid）：新 `quickFilters` / `toolbarQuick`（业务快捷筛选在**右边**）、`searchMode="icon"` / `toolbarSearch`（搜索收成图标，点开变框）、`more` / `toolbarMore`（「⋯」：表设置 · 权限 · 操作记录 · 公开登记链接 · 导出），`actions` 只放一个主按钮；生效中的工具 = 主色浅底 + **数量徽标**（「筛选」+ 3，不再写成「筛选 3」文字）；容器窄于 1100px 时没生效的工具只留图标，不折行。
- **五个视图面板一个外框**：左边对齐按钮，宽度三档 `VIEW_PANEL_WIDTHS`（筛选 / 填色 580、分组 / 排序 420、字段 320），标题行右边一句有用的话（「符合 5 / 168 条」「最多 3 级」「靠上的先排」「从上往下，先命中的生效」「显示 13 / 15」），**手机变底部弹层**；`ToolbarPanel` 新 `badge` / `badgeLabel`、`width="condition" | "list" | "field"`；`PopoverPanel` 新 `sheet`（手机底部弹层）。按钮名「字段配置」改叫「字段」。
- **行号列 76 → 48px**（`GRID_ROW_NUMBER_WIDTH`）：数字悬停变勾选框；底部统计栏的条数挪到第一格「2000 条记录」。
- **多维表格空格子留白**，「—」只给只读的 DataTable、记录详情和键值列表。
- **分页脚**：左「共 168 条」（选中时「已选 2 / 共 168 条」），右 每页条数 + 页码，当前页主色浅底；游标列表「已显示 1–20 条」+ ‹ ›，不写「第 1 页」。DataTable 新 `errorDetails`（请求号）。
- **SelectList**：图标不再套绿色圆底（16px 备注色），选中 = 主色浅底 + 加粗，右侧附注居中；新 `unreadCount`（加粗 + 主色数量徽标）、`loading`（骨架）、`onCreate` / `createLabel`（搜不到时「新建这个…」），搜索命中高亮，分组标题带数量。
- **时间线一种长相**（`ActivityFeed`、`LogTimeline`、记录详情的跟进时间线合成一个解剖，名字不变）：左 20px 轨道、1px 线穿过中心，人做的事 = 20px 头像（按人分色）、系统的事 = 8px 圆点、结果 = 带 ✓ / ✕ / ! 的圆，圆心都在线上；时间在右（正文数字字体，悬停看完整时间）；按天分组「今天 10月7日 周三」吸顶；底部「显示更早的 N 条」；审计密排一行 44px，展开 = 白底键值列表（技术 key 折进「原始数据」）。新积木 **`Timeline` / `TimelineDay` / `TimelineItem` / `TimelineMarker` / `TimelineAttachment` / `TimelineMore` / `TimelineSkeleton`**、纯函数 `dayHeading`（宿主自己画跟进列表时用）；ActivityFeed 新 `marker` / `attachments`，LogTimeline 新 `loading` / `emptyHint`。
- 涨跌徽标（7.16）、审计展开行可读标签（7.12.1）保持。

其他：新 `useOptionalNotify()`（不在 NotificationProvider 里时返回 null）。

**弃用**（8.0 删）：DataTable `batchMode` / `batchActions` 和 `BatchBar` → `bulkActions` / `BulkActionBar`；`VIEW_TIER_BADGES` 不再画在标签和视图管理上（宿主别处列视图时还能用）。

**测试 / 文档**：新单测 `views-717-core`（「更多」分组、视图搜索、设置改动计数、展开框翻页文字、面板宽度）、`views-card-core`、`data-card-core`、`timeline-core`，`views-calendar-core` / `views-gantt-core` / `views-color-core` / `grid-core` / `table-rows` 跟着改；浏览器 `test:views`（标签一行 + 档位记号、更多分组 + 管理视图、新建视图面板、双击改名、眼睛悬停、看板列合计 / 无字段名 / 虚线落点 / 底部提示条 / 撤销 / 锁住提示、右侧抽屉不挡看板 + 换人 + ↓ + 切弹框、画册 / 日历 / 甘特新样子、手机标签横滑 + 视图管理底部弹层 + 列切换胶囊）、`test:grid`（底部浮条不推表格、徽标）、`test:grid-panels`（面板标题行、恢复）、`test:business-tables` / `test:collections` / `test:components` / `test:page-templates` / `test:design` / `test:record-cards`（新时间线标记居中）都改了断言；截图在 `test/artifacts/views|grid|business-tables|collections|page-templates/`，和样稿 `shots/new/` 并排看过。VIEWS.md §0–§9、GRID.md §8.2 / §8.5 / §8.6、TABLES.md（浮条、分页脚、手机卡片、行高、时间线）、DESIGN.md（表头）、AI-RULES、PAGE-TEMPLATES（SelectList）、catalog 同步；starter「视图」「多维表格」「多维表格 · 客户」「业务表格」「轻量集合」页换新。

**同事会注意到**：视图标签只剩一行，左边的「视图 ▾」没了（在右边「视图」和「更多」最下面），标签上是小锁 / 两个人；改过标准视图会有一个橙色小点和一行橙底提示；新建视图是 6 张卡片；看板卡片没有字段名、列头有金额合计、「未设置」空着时不出现、拖动提示在屏幕底部、放下能撤销；从看板 / 日历打开记录是右边抽屉（看板还能点）；日历的「现在」线和甘特今天线是绿的；周末和假日有底色、写「休 国庆日」；手机日历只有月历；工具栏一行，「筛选 3」变成「筛选」+ 徽标、「字段配置」叫「字段」，表设置 / 权限 / 操作记录在「⋯」里；勾选后浮条在底部；行号列窄了，空格子不画横杠；手机上 DataTable 是卡片；表头 12px；分页写「共 N 条」；时间线一种样子。

**风险**：① `RecordCard showLabels` 默认改成 false——依赖字段名的页面显式传 `true`；看板 / 画册宿主要把负责人 / 金额 / 下次跟进放进 `cardSlots`，否则只剩一行行值。② 日历单击从「直接打开」改成「出事件卡」（双击或卡片里「打开详情」才打开）；实心选项色（成交）在日历 / 甘特上是同色浅底，不再白字实底。③ 看板默认在放下后出「撤销」提示，宿主自己已经有撤销提示的传 `undo={false}`，否则会出两条。④ BitableGrid 勾选后**一定**出底部浮条，工具栏不再写「已选择 N 条」：宿主往 `actions` / `banner` 塞的批量按钮要搬到 `bulkActions`；e2e 里找「已选择 N 条」「清除选择」的要改找 `role=toolbar name=批量操作`。⑤ 工具栏不折行：按钮多的宿主在窄屏上会先收成图标再左右滑；「筛选 3」这类按钮文字现在是「筛选」+ 徽标（读屏名「筛选 3 项生效」），断言 `/筛选 3/` 要改 `/筛选\s*3/`；「字段配置」按钮叫「字段」。⑥ 行号列 48px：自己按 76px 算冻结宽度的宿主要改用 `GRID_ROW_NUMBER_WIDTH`。⑦ DataTable 手机默认卡片：依赖 `tbody tr` 的宿主测试要改找 `.aui-table-card`，要表格的写 `mobile="table"`；DataTable 外框改成 `overflow: clip`（浮条吸底要用）；`short` 行高 32 → 40。⑧ `.aui-gallery*` 画册选择器收窄到 `.aui-gallery-view`（以前和 MediaGallery 撞名）；`ViewOverrideBar` 按钮改叫「恢复」「另存为我的视图」，找「恢复共享设置」的断言要改。⑨ SelectList 搜不到时多了「换个关键词」一行；ActivityFeed 的 `meta` 变成正文后的普通文字。

## 7.16.0（2026-10-07）

<!-- adminui/7.16：组件库审阅「图表与仪表盘」9 项全过 -->
**图表与仪表盘换新**：逐项审定的「图表与仪表盘」审阅落地。根入口和子路径只新增导出，没有删导出；被替代的用法标了 `@deprecated`（8.0 删）。

- **颜色全从色卡来**：新 **`chartColors(palette)`**（类别、其他、主色、顺序色、发散、状态、网格、轨道、文字……）和构造器 token **`vizCategory(i)`** / `VIZ_OTHER` / **`vizOptionColor(hue)`** / `VIZ_TEXT` / `VIZ_SECONDARY` / `VIZ_NOTE` / `VIZ_TRACK` / `VIZ_SURFACE`、`resolveVizToken`；`AdminChart` 用新的 **`resolveVizTokens(option, chartColors(palette))`** 换色、主题也全从色卡算（网格 = 线色 62% 混面板色，提示框圆角 8 + 浮层阴影，图例左上 10×10，柱顶圆角 4 / 最宽 32 / 间隙 42%，悬停阴影 = 正文色 4.5% / 深色 8%），**换色卡、深色自动跟**。**类别 = 选项标签 10 色里固定顺序的 8 个（蓝 橙 青 粉 橄榄 紫 黄 红，`VIZ_CATEGORY_HUES`），第 9 个起并进「其他」；单系列 / 有序 = 主色**（深色 = 深色色卡的主色：柱、漏斗、子弹图、迷你趋势同一个绿，不再「主色混 35% 白」）；顺序色 = 面板色 → 主色 13 档，深色也从面板色起步（`vizBrandStep`、cohort 热力表不再出浅色亮块，只有 > 72% 的格子反白字）。已批准清单第 8 组改成「单系列 / 有序用主色深浅，类别用选项标签色」。
- **新图表构造器**（`@adminui/react/charts`）：**`barOption`**（柱；`horizontal` = 条形排行、`highlight` 突出「我」、`colors` 每根自己的颜色；提示框写指标名 + 单位，不再是「实际：117」）、**`donutOption`** / `donutSlices`（≤ 5 片 + 其他，中间写合计，右边数值图例）、**`stackedBarOption`** / `stackSeries`（≤ 8 段，段间 1px 面板色缝，只有顶段圆角，提示框带合计）、统一提示框 **`tooltipHtml`**（色块 + 名称 + 右对齐等宽数值 + 单位，已转义）、`chartValueText`（≥ 1 万写「万」）、`CHART_VALUE_LABEL`。`targetBarOption` 换成同一套样子（顶圆角、最宽 32、11px 次要色数字、提示框带完成率），`timeSeriesOption` 多系列改用类别 token。
- **7 种等高状态**：新 **`ChartState`**（loading 骨架柱 + 扫光 / empty / no-match + 清空筛选 / error + 重试 / stale 留旧图 + 注意条 / forbidden 锁），`AdminChart` 新 `noMatch` + `onClearFilters`、`forbidden`、`stale`，原来的 `loading` / `empty` / `error` 也换成和图一样高的版本（以前是通用 `StatePanel`）。
- **数字卡 / 变化值**：`KpiCard` 新 `size`（lg 28 / md 24 默认 / sm 20，sm 不画趋势），标题 13px 常规字重；**`DeltaBadge` 和选项标签同形（圆角 6、无边框软底）**，好坏语义不变；汇总卡异常标签、漏斗「流失最多」同形；子弹图轨道圆角 5、分档灰阶拉开到 48 / 32 / 18%；漏斗条改用主色；留存表第一列 120px、「未到期」斜纹。
- **看板搭建器**：网格**行高 64 → 28**（新 `DASHBOARD_SCHEMA_VERSION = 2`）；纯函数 **`migrateDashboardSpec(spec)`**（版本 1 / 没写版本 → 2，y 和下边按 (64+12)/(28+12)=1.9 倍取整，挨着的仍挨着、像素大小基本不变，其他字段原样；版本 2 原样返回）、`migrateLayout`、`LEGACY_ROW_HEIGHT`；`normalizeDashboard` 读版本 1 时自动迁移，`DashboardBuilder` 的 `value` 给版本 1 也会迁移。**新组件类型** `group`「数字组」（2–6 个等宽数字，`widget.items`，`WIDGET_GROUP_LIMITS`，查看时是一排没外框的数字卡、手机两列）、`hbar` 条形、`donut` 环、`stacked` 堆叠（`query.stackBy`）；`targetBar` 改名「实际 vs 目标」，`bullet` / `rollup` 照旧；**目标值存在卡片上** `widget.target`（`TARGET_WIDGET_KINDS`，设置里「目标值」）；`widget.size`。`DashboardWidgetData` 新 `group` / `donut` / `stacked` / `forbidden`、`empty.filtered`、`bar.colors`（bar 数据也能画条形 / 环 / 单段堆叠）；`decor.onClearFilters`；重试失败时保留旧数据（stale）。**卡头不再挂「标准」**，只露「自定义口径」「覆盖看板筛选」，来源是灰字。工具条一行 52px（名字 ✎ · 范围 `scope` 楼 / 人 · **「N 处修改未保存」**〔`countSchemaChanges`〕· permissionNote 收进「?」‖ 撤销 重做 | 预览 取消 另存为我的 保存）；组件库 248px、图表格子 3 列、**可收成 56px 图标栏**（`libraryCollapsed`）；**设置面板只在选中卡片时出现**（320px），图表类型挪到「样式」、新「数字大小」；**卡片工具（复制 / 设置 / 删除）在卡头里**，悬停 / 选中才出现；改大小显示「3 列 × 10 行」；编辑时淡色列参考线。新 `skeletonShape`。
- **看板筛选行**：不套卡、一行（放不下横滑）；胶囊 30px 圆角 8，有值浅主色底 + 粗字 + **×**，展开主色边 + 光圈；只有一个对比项时不出下拉；**「重置」改过才出现**；手机（≤ 760）= 时间胶囊 +「筛选 · n」底部弹层（`compactOnPhone`，默认开）。
- **报表工具条**：`ReportToolbar` 改成同一条——**去掉「查询」，选了就查**（预设、日期范围两端都选好、来源变了立即 `onApply`；范围不对写原因不应用）；新 `defaultValue`（「重置」只在改过时出）、`actions`（刷新 / 导出）。
- **仪表盘标签**：新 **`DashboardTabs`**（`@adminui/react/views`，放 `ViewTabs` 的 `trailing`）——和视图同一种下划线标签、「仪表盘」分组字、每个标签带**范围图标**（`scope` company = 楼、personal = 人）、更多 N、当前标签 ⋯、「+」新建菜单，手机横滑时当前标签自动滚进来；`TabScopeIcon`、`TAB_SCOPE_LABELS`、类型 `ScopeTab` / `TabScope`。

**修：命令面板第一次按 Esc 只清空了输入框**（底栏写的是「Esc 关闭」）：现在一下就关（框里有字也关，执行中的命令除外），所有宽度一样；手机的「取消」照旧。

**弃用**（8.0 删）：`VIZ_CATEGORICAL` → `chartColors(palette).categorical` / `vizCategory(i)`；`VIZ_SEQUENTIAL` → `chartColors().sequential` / `vizBrandStep(i)`；`resolveBrandColors(option, "#hex")` → `resolveVizTokens(option, chartColors(palette))`；看板存档版本 1（64px 行）——读的时候迁移，8.0 起只认版本 2。

**测试 / 文档**：新浏览器测试 **`test:charts`**（starter 新页「看板 → 图表与仪表盘」：色板跟色卡 / 深色、6 种图、7 种状态等高、数字卡 3 档、变化值同形、仪表盘标签图标、筛选行、报表工具条、390 底部弹层；截图 `test/artifacts/charts/`）；`test:dashboard-builder` 改成版本 1 存档迁移 + 新组件 + 卡头工具 + 组件库图标栏 + 设置只在选中时出现；`test:dashboards` 筛选行断言更新；`test:command-palette` 加「第一次 Esc 就关」。新单测 `viz-palette`（色板规则、token、新构造器、提示框），`builders-core` 加迁移 / 新组件 / 改动计数，`dashboard-kit-core` cohort 深浅。starter「看板搭建」用版本 1 存档 + 新组件模板。DESIGN.md 新 §2.5，DASHBOARDS.md §12 / §14、AI-RULES 套件清单与附录 F、PAGE-TEMPLATES T17、catalog 同步。

**同事会注意到**：图表的多系列颜色变了（跟选项标签一个色、跟色卡走），深色下柱子 / 漏斗 / 子弹图是同一个绿；图的加载不再是三个点、而是和图一样高的骨架；变化值没有边框了；数字卡数字默认 24px（以前紧凑页 22）；看板卡头没有「标准」；搭建器没选中卡片时右边没有设置栏，卡片工具在卡头里；看板筛选行没有白卡、「重置」平时不显示；报表工具条没有「查询」按钮；按 Esc 直接关掉命令面板。

**风险**：① **看板存档**：宿主自己把 widgets 直接交给 `DashboardView`（不过 `normalizeDashboard` / `migrateDashboardSpec`）时，旧存档会被画成一半高——读的时候先迁移，存的时候写版本 2。宿主对 `DashboardSchema.version` 写死 `1` 的校验（Zod `literal(1)`）要放宽到 1 | 2。`WidgetKind` 加了 4 种、`DashboardWidgetData` 加了 4 种，对它们做穷举 switch 的宿主要补分支。② 自己调 `resolveBrandColors` / 直接用 option 构造器、不经 `AdminChart` 画图的宿主，多系列颜色现在是 token，要过 `resolveVizTokens`。③ `ReportToolbar` 的 `onApply` 现在在每次选择后就调用（以前只在点「查询」时），慢接口要自己防抖。④ e2e：搭建器的组件库叫「添加卡片」（以前「添加组件」）、「文字说明」改叫「文字」、工具条状态「已保存 / N 处修改未保存」、卡片工具没有「上移 / 下移」（键盘方向键照旧）、看板筛选行的「重置」平时不存在（不是禁用）。

## 7.15.0（2026-10-07）

<!-- adminui/7.15：组件库审阅「反馈与弹层」10 项全过 -->
**反馈与弹层换新 + 通知中心 + 命令面板**。根入口只新增导出，没有删导出；被替代的用法标了 `@deprecated`（8.0 删）。

- **弹框**：圆角 12、去掉边框和**遮罩模糊**（新 token `--aui-scrim` / `--aui-elev` / `--aui-dialog-shadow`，两级阴影 = 浮层 `--aui-pop-shadow` + 弹框）；宽度 **sm 420 · md 560 · lg 800 · 新 xl 1080 · 新 full（四边留 24）**（以前 460 / 680 / 960）；标题 16 / 600，× 28；**底栏白色**；**正文滚动起来才出头部分隔线、下面还有才出底栏分隔线**（`data-scrolled` / `data-more`）；深色比页面亮一档。新 **`DialogFooter`**（`danger` 最左红字幽灵、`hint`，右边 取消 · 次要 · 主操作）；`Dialog modal` / `className`。`FormDialog`：失败提示移到**顶部**、新 `dangerAction` / `secondaryActions` / `hint`；**「放弃未保存的内容？」改成叠在弹框上的小确认**（不再把原弹框整个换掉）。手机：sm / md 从底部升起（拖动条、上圆角 16），lg 以上整屏，底栏按钮 44 高。DialogFrame 抽到 `dialog-frame.tsx`。
- **确认弹框**：宽 420；左边 36 图标块（新 `tone` info / warning / danger、`icon`）+ 标题直接问 + 一句后果；**没有正文不再留空白条**；默认焦点在「取消」（有原因 / 名称框时在框里）；`impact` 可传数组 = 灰底影响清单；`typeToConfirm` 是红字代码块、输对了打勾；提交中按钮转圈；失败在顶部。
- **能撤销就不问**：新 **`useUndoToast()({ title, description, run, undo, commit, seconds })`**（先做再给「撤销」8 秒，返回 "done" / "undone" / "failed"）、`notify.undo(...)`、纯函数 `confirmOrUndo`（撤不回 / 影响别人 / 批量 ≥ 20 才问）。
- **提示条**：白卡圆角 12、宽 380；24 圆形浅底图标 + 粗体结果 + 小字对象 + 一个操作 + ×；`useNotify()` 照旧可当函数调，另有 **`notify.show({ title, description, tone, action, duration, key })`**、`notify.progress(...).update(...)`（进行中→原地变结果）、`notify.dismiss`；成功 4 秒（以前 5 秒）、带操作 8 秒（按钮倒数 + 底部细条）、失败 / 进行中不自动消失（7.12.1 起）、悬停暂停、最多 3 条（新 `warning` / `loading` 口气）。纯函数 `toastDuration` / `createCountdown` / `secondsLeft` / `stackToasts`。
- **行内提示**：圆角 8、图标 16、说明次要色（以前整段染色）；新 `density="compact" | "subtle"`、`banner`（贴边横幅）、`onClose`。
- **侧边 / 底部弹层**：`SideSheet` 不做圆角、贴边、左边 1px 线、头部 56（说明和标题同一行）；新 `changes`（底栏「改了 N 项，还没保存」，关之前先问）、`cards`（浅灰正文放白卡）、`modal={false}`（评论 / 附件不挡表格）；`BottomSheet onDone`（表单头「取消 · 标题 · 完成」）。新 **`ActionSheet`**：手机上的「⋯」。
- **菜单一种样式**：圆角 12、内边 4、行高 32、行圆角 6、浮层阴影，**悬停 / 键盘选中都是中性浅底**（以前主色浅底 + 焦点框），**鼠标打开不高亮、键盘打开高亮第一项**（新 `openFocus`），快捷键写短（`Kbd compact`：⇧ ↵ ⌫），子菜单离 6px，新 `header`（多选写对象）；**手机（≤760）所有菜单变底部操作单**（`sheet={false}` 关掉）。**`RowActions` 改用同一个 `Menu`**（以前自己一套 `aui-menu`，旧样式留到 8.0），`MoreMenu` / `MenuButton` / `SplitButton` 同样；新 `rowActionSections`。
- **弹出面板**：浮层阴影；`width="lg"` 600 → 560；触发按钮打开时浅灰底、`data-applied` 时主色浅底。
- **空 / 出错 / 没权限 / 404 分开**：`StatePanel` 改成 44 图标块（圆角 12）+ 标题 + 原因 + 最多两个按钮；新 `title`（`message` 变成原因，只给 `message` 时当标题——老调用不变）、`query` + `onClearSearch`、`details`（错误详情可复制）、`secondaryAction`、`tone="brand"`、`icon`、`size`（compact / default / page）、`kind="not-found"`（整页大号 404）/ `"no-permission"`（= forbidden，锁图标）；每种 kind 自己的图标；重试按钮带图标。新 `stateText`。
- **通知中心（新）**：**`NotificationCenter`** 顶栏铃铛（未读红底数，99+）+ 420 面板，标签「通知」/「待我处理」，通知按 今天 / 昨天 / 更早 分组（全部 / 未读 / @我），待我处理按模块分组、就地同意 / 拒绝（拒绝写原因），空 / 出错 / 加载更多，手机整屏底部面板；纯函数 `groupNotificationsByDay` / `groupInboxByModule` / `unreadBadgeText` / `relativeTimeText` / `mergePages` / `markReadLocal`。
- **命令面板（新实现，同名）**：**`CommandPalette`** 改成 Linear 式：顶部 14%、640 宽，输入框就是头部；空着时「最近」+「常用」，输入后按 页面 / 命令 / 各提供者 分组，命中加粗下划线，范围标签（Tab 切换），**`providers`**（每个模块一个，并发、每个 800ms，慢的组「较慢，回车看全部」）、`onSelect` / `onSearchAll` / `emptyActions` / `recent` / `recentKey`；旧的 `commands` 照样用。纯函数 `searchReady` / `rankItems` / `highlightRanges` / `limitGroups` / `pushRecent` / `runProviders`。`useAdminShortcuts` 挪到 `admin-shortcuts.ts`（导出不变）。
- **编辑冲突（新）**：`EditConflictNotice`（「王小明 刚改过这一格 · 14:31」+ 两个值，默认保留他的，「重新填入我的」/「用我的覆盖」）、`SaveConflictDialog`（每项两张选择卡、他的默认选中、「已经替你合好 N 项」）、`StaleRecordNotice`；纯函数 `resolveConflicts` / `overriddenKeys` / `conflictCounts` / `conflictHeadline` / `pickOf`。**BitableGrid**：`onCellsChange` 的 `rejected[]` 新可选 `conflict: { by, at, value }`（类型 `GridCellConflict`），单格撞车时状态栏显示冲突卡（不自动消失），「用我的覆盖」再调一次 `onCellsChange`，第二个参数带 `overwrite: true`。旧 `ConflictDialog` 标 `@deprecated`。
- **细滚动条**：弹框正文、操作单、提示条里也是细一档 8px。

**弃用**（8.0 删）：`ConflictDialog` → `SaveConflictDialog` / `EditConflictNotice`；`Notice` 类型 → `NoticeOptions`；`.aui-menu*` 样式（RowActions 已不用）。

**测试 / 文档**：新浏览器测试 `test:overlays`、`test:notification-center`、`test:command-palette`（截图 `test/artifacts/overlays|notification-center|command-palette/`，和样稿 `shots/new/` 并排看过）；新单测 `overlay-core`（滚动分隔线、提示条时长、撤销倒计时、堆叠、先问还是撤销、编辑冲突、菜单快捷键写短）、`notification-core`，`command-core` 加了排序 / 高亮 / 提供者超时。starter 新页「系统 → 反馈与弹层」；DESIGN.md 新 §2.4，AI-RULES 新附录 S、套件清单同步；catalog 新 `overlays`、`notification-center`，`forms` / `confirmations` / `notification` / `metrics` / `menus` / `sheets` / `workbench` 规则更新。

**同事会注意到**：弹框背后不再模糊、底栏不再是灰条、短弹框没有横线了；默认弹框窄了（680 → 560，lg 960 → 800）；确认框左边有个彩色图标块、默认焦点在「取消」；菜单悬停是灰色不是绿色、用鼠标打开时第一项不再自动高亮；**手机上点「⋯」从底部弹出操作单**；侧边弹层没有圆角；提示条成功 4 秒就走、能带「撤销」倒数；空状态 / 出错 / 没权限的图标各不相同、出错有带图标的「重试」主按钮；Ctrl / ⌘ K 的面板长得像 Linear；电话格里外国号码不再带开头的 0。

**风险**：① 弹框默认宽度变窄——内容按 680 排的表单弹框可能换行，需要的改 `size="lg"`；`DialogSize` 加了 `"xl" | "full"`，对 `DialogSize` 做穷举 switch 的宿主要补分支。② 菜单在 ≤760px 一律变底部操作单（包括表格单元格右键菜单），有菜单必须贴着所编辑对象的地方传 `sheet={false}`；宿主 e2e 里「打开菜单后焦点在第一项」的断言在鼠标打开时不再成立（焦点在菜单本身，↓ 进第一项）。③ `RowActions` 的 DOM 从 `.aui-menu` / `.aui-menu-item` 变成 `.aui-cmenu` / `.aui-cmenu-item`（role 不变），按 class 找的测试要改。④ `StatePanel` 只给 `message` 时它现在是加粗的标题；`no-results` / `empty` 默认文字不变，其余 kind 默认文字换成了更具体的。⑤ `InlineAlert` 图标 20 → 16、说明改次要色。⑥ 成功提示 5 秒 → 4 秒。⑦ `FormDialog` 的放弃确认是一个叠加的第二个对话框（role=dialog，名字「放弃未保存的内容？」），打开时原弹框对读屏隐藏。⑧ 命令面板的 DOM / 角色变了（combobox + listbox），旧 `.aui-command-results` / `.aui-command-item` 样式已删。

**修：电话把国际区号和长途 0 拼在一起显示**（反馈截图：表格 / 记录详情里 +447700900123 显示成「+44 07700 900123」）。新纯函数 **`formatPhoneDisplay(value, { home? })`**：本国（`home`）号码按当地写法「07700 900123」，其他国家国际写法、**不带开头的 0**：「+44 7700 900123」「+86 138 0013 8000」「+1 415 555 0132」；没有区号的原样（纯数字且给了 `home` 就按本国分组）。多维表格电话格用它，新字段属性 **`GridField.phoneCountry`**（本公司 / 本表的区号，如 `"+86"`；不给 = 一律国际写法）。公开表单提交成功页的摘要同样修了：`formSummary(..., { home })`（传 `PublicForm` 的 `defaultCountry`），新纯函数 `summaryPhoneText`。

## 7.14.0（2026-10-07）

<!-- adminui/7.14：组件库审阅「基础元素」8 项（含第 5 项第二轮）+「输入与表单」10 项 -->
**基础元素 + 输入与表单换新**：逐项审定的两批组件审阅一次落地。根入口只新增导出，没有删导出；被替代的用法标了 `@deprecated`（8.0 删）。

**基础元素**
- **按钮**：7 种样式 4 档尺寸。新样式 `variant="text"`（主色字，表格行里 / 行内的动作）、`"destructive-outline"`（页面上的删除）；新尺寸 `size="xs"`（24px），`lg` 改成 40px。主按钮纯主色、**去掉渐变和投影**；描边按钮的边 = 输入框同一根 `--aui-field-border`；**幽灵按钮改成灰字**（以前主色字），只有文字按钮和链接用主色；字重统一 500；28 / 24 圆角 6；悬停 / 按下 = 中性叠层（新 token `--aui-hover-overlay` / `--aui-press-overlay` / `--aui-fill-hover` / `--aui-fill-press` / `--aui-danger-fill`）；聚焦 = 输入框同一个 3px 光圈；**禁用 = 浅灰底 + 淡字，不再降透明度**（`--aui-disabled-bg` / `--aui-disabled-fg`）。新属性 `loading` / `loadingText`（转圈换掉左图标、宽度锁住、点不动、`aria-busy`）、`disabledReason`（按钮仍可聚焦、`aria-disabled`，气泡说原因）、`tooltip` / `shortcut`；`Button` 的原生 `title` 自动变成 SDK 气泡（禁用时 = 原因）。新组件 **`IconButton`**（方形无边 32 / 28 / 24，`variant="outline"` 36，`pressed`、`badge`，`label` 必填 = aria-label + 气泡）、**`ButtonGroup`**（视图切换 / 翻页连成一条）、**`MoreMenu`**（工具栏「⋯」）、**`Spinner`**（16 / 20 / 32）、**`Link`**（4 种：正文 / `quiet` / `anchor` / `next` / `external`）。`Button size="icon"`、`variant="link"` 标为弃用。
- **标签与徽标**：只剩两种形状——圆角 6 的软方块（`Tag`、状态、筛选块，都不加描边）和全圆（数字角标、圆点、头像、进度条）。`Tag` 新 `size="sm"`，`variant="plain"` 改成灰色同形状（以前白底描边方框）。`StatusBadge` 新 `variant="dot" | "soft"`（**在 `DataTable` / 格子 / `CompactTable` 里自动是「圆点 + 字」、不加底**）、新色 `info`、`pulse`（同步中）。`Count` 改成 18px 等宽数字：中性灰（0 也显示）/ 新 `tone="primary"` 未读实心（0 不显示）/ `danger` 实心 / `attention`，`max`（99+）；新 **`DotBadge`**。`ChipGroup` 快捷筛选块 28px、圆角 8，选中 = 主色边 + 浅底。
- **头像**：新 **`Avatar`**（5 档 20 / 24 / 32 / 40 / 64；**按人取 10 色之一**——按账号 id 稳定哈希，同一个人在哪都一个颜色，`avatarTone`；`src` 照片失败退回文字；`kind` bot / gone / group；`presence`）、**`PersonChip`**（24px 灰底人员块，表格里 `plain`）。`AvatarStack` 用新头像（叠 6px、外圈 2px），**「+k」变成按钮、点开列出其余的人**，单个头像悬停出「名字 · 在做什么」气泡；`size` 收 20 / 24 / 32（旧 `sm` / `md` 照样认）。SDK 内部所有头像（评论、操作记录、分享、授权名单、对话…）都按人分色，尺寸收进 5 档。
- **提示气泡**：新 **`Tooltip`** / `tipProps(文字, 快捷键)`：深色小气泡 + 箭头（深色模式下是浅一档的面板色），12.5px、圆角 6、最宽 260，可带键帽；悬停 0.4 秒出现、扫过一排按钮立即切换、Tab 聚焦也出现、Esc / 移开立即消失；默认在上方、放不下翻到下方；`truncated` 只在真截断时出。由 `AdminProvider` 里一个委托层统一画（元素上只写 `data-tip`）。**SDK 里约 150 处原生 `title` 全部换成了这个气泡**（`iframe` / `svg` 的保留）。`useTipFlash` 给「已复制」这种一次性气泡用。
- **说明「?」**：`HelpTip` 改成 16px 图标 + 24px 点击区，**说明卡从「?」下方左对齐弹出、带箭头**，贴边才往回挪（不再盖住侧栏）；新 `title`、`more`（「了解更多」链接）；悬停打开、点击钉住、点外面 / Esc 关；鼠标移进卡片不会关。
- **快捷键 · 复制 · 分隔线**：新 **`Kbd`**（一个键一个键帽 20px / 菜单和气泡里 18px，圆角 4、正文字体，**只显示当前系统写法**：`Mod+K` = Windows「Ctrl」「K」、Mac「⌘」「K」；`flat`；手机不显示）、**`ShortcutSheet`**（按「?」出快捷键表）。`Menu` 项的 `shortcut`、命令搜索按钮（原来写死「Ctrl/⌘ K」）、评论框「Ctrl + Enter 发送」、格子编辑提示都换成键帽。`CopyButton` **公开导出**并改成 24px 幽灵图标：`reveal` 时悬停 / 聚焦整行才出现（手机常显），成功 = 勾 + 气泡「已复制」1.5 秒 + 读屏，失败 = × +「复制失败，请手动选中复制」；记录详情字段行的编辑 / 历史 / 复制在手机上一直显示。新 **`CopyField`**（整段值：等宽字 + 「复制」，`secret` 打码、「显示」30 秒自动打回）；`CopyableValue` 两种样式都改用它们。新 **`Divider`**（1px 实线、`label` 带字的「昨天 / 更早」、`vertical` 工具栏 16px）；`ActivityFeed` 的按天分组改成带字分隔线。
- **加载与进度**：**`DataTable loading` 不再在中间转圈**——表头用这张表自己的字段名、表体是参差的骨架行（列的新属性 `skeleton`: text / tag / person / number），分页写「共 — 条」，10 秒后「加载比较慢… · 重试」；新 `refreshing`（旧数据留着稍淡 + 顶上 2px 细进度条）。`ResourcePanel` 新 `loading`（数量「—」）。**`StatePanel kind="loading"` 改成原位骨架**。新 `ContentSkeleton`、`SkeletonBlock`、`SkeletonCell`、`TopProgress`、`ProgressBar`（4 / 6 / 8，`null` = 不确定进度）、`StepProgress`、`Refreshing`、`useSlowLoading`、`SlowLoadingNote`；`Skeleton` 改成参差宽度；`Meter` 新 `size`（4 / 6 / 8，默认 6，以前 8）和 `value`。空状态图标 = 24px 放在 48 的中性浅底圆里。
- **文字层级与链接**：8 档字号（28 · 22 · 18 · 14.5 · 14 · 13 · 12.5 · 12，新 token `--aui-fs-*`、工具类 `.aui-text-display` … `.aui-text-note`）；**字重只剩 400 / 500 / 600**（样式表里 650 / 700 / 750 / 800 全部收成 600，`<b>` / `<strong>` / 标题也是 600）；样式表里零碎字号对到 8 档（13.5 → 13、15 / 16 → 14.5、17 → 18、19–21 → 22、24 → 28、10–11.5 → 12；键帽、角标、日历「休 / 班」、录音计时这些微标除外）。
- **图标**：5 档 12 / 14 / 16 / 20 / 24；**16px 以上线宽 1.75**（12–14 用 2、24 用 1.5，全局 CSS 按场景设好）；固定 24 个动作图标 `ACTION_ICONS` / `ACTION_ICON_LABELS`（`iconStroke`、`ICON_SIZES`），SDK 里 Settings / SlidersHorizontal → Settings2、MoreHorizontal → Ellipsis、ListFilter → Filter、表格刷新 RotateCw → RefreshCw。

**输入与表单**
- **文本框**：`Input` 新 `prefix` / `suffix`（框里的图标、单位）、`segment`（框里的一格：区号、币种、https://）、`clearable`（浅色圆圈 ×）、`showCount`、`size="sm"`、`mono`；不给这些就还是原来的裸 `<input>`。尺寸 28 / 36，手机 40，公开页 44。**浏览器自带的粗黑搜索 × 不再显示**。
- **多行**：`Textarea` **默认自动长高 3–10 行、没有拖拽角**（`autoGrow` / `minRows` / `maxRows`），新 `showCount`、`footer`（框里底行放工具和快捷键）。
- **字段与出错**：`FormField` 新 `optional`（「（选填）」）、`help`（标签后的「?」）、`count`（右侧字数）；出错一行带图标、替换说明；「已改」改成注意色小圆点 + 字。`FormSection` 新 `description`、`layout="side"`（设置页左标题右字段）、`labels="side"`（左标签 112px）。**`FormDialog` 提交出错**：两项以上在顶部汇总「有 N 项要改」（每条可点跳过去，新 `FormErrorSummary` / `jumpToField`），底栏左边「N 项要改」，提交中用按钮的 `loading`。
- **吸底保存条**：`SaveBar sticky` 改成浮在底部居中的一条卡片「改了 N 处」+ 哪几处 + 放弃 / 保存（以前「有 N 处改动未保存」），保存中转圈，手机贴底铺满；新 **`useChangeTracker`**（草稿 / 已保存、`changed(key)`、`count`、`reset`、`commit`）+ 纯函数 `changedKeys` / `sameValue`。
- **搜索**：**`QueryBar` 默认打字就筛**（停 0.3 秒调用 `onSearch`，**去掉「查询」「重置」两个按钮**；Esc / × 清空立即再搜）；慢列表 `searchMode="enter"`（框里写「回车搜索」）；新 `hits`（命中几条）、`canReset`（有别的筛选时出「清空筛选」）、`shortcut`；桌面上搜索框不再占满一行。新 **`SearchBox`**、**`Highlight`** / `highlightParts`；`SearchField` 新 `hits` / `shortcut` / `variant="subtle"`；多维表格工具栏和其他 SDK 里的搜索框都换成这一个框。
- **数字、金额、电话、百分比**：新 **`NumberInput`**（等宽、悬停才出 ↑↓、Shift ×10）、**`MoneyInput`**（币种一格、离开加千分位、存最小单位、「约 ¥8.6 万」）、**`PhoneInput`**（区号一格、`defaultCountry` 传本公司所在地、按当地分组、值存 E.164、离开才校验）、**`PercentInput`**（框里写 %，`slider` 换成滑块 + 小数字框）、**`PercentBar`**（「60%」+ 56px 细条）、**`SegmentPicker`** 和纯规则（`toE164` / `parsePhone` / `formatLocalPhone` / `validatePhone` / `approxMoney` / `PHONE_COUNTRIES` / `MONEY_CURRENCIES` …）。**新组件 `Slider`**（4px 轨道 + 16px 圆点、悬停 / 拖动出数值、刻度、键盘，只给赢率这类大概值）。`NumberStepper` 改成同一个框、两端 28px 幽灵按钮；`Rating` 星一律实心（没亮 = 浅灰），新 `labels`（「较高」）。**多维表格新字段类型 `percent`**（「百分比」：格子「10%」+ 细条，`GridField.percentBar: false` 只写字，编辑时 % 还在；`toPercent`）。表单搭建器的金额 / 电话 / 新百分比题换成新输入件，存的答案格式不变。
- **密码与密钥**：新 **`PasswordInput`**（等宽、框里的眼睛、大写锁定提醒）、**`PasswordStrength`**（4 段 + 太弱 / 一般 / 够用 / 很强 + 要求打勾）、`PasswordConfirmHint`、**`InitialPasswordField`**（自动生成 / 我来设）和纯规则 `passwordStrength` / `passwordsMatch` / `generatePassword`。`CodeInput`（密码门）格子 72 → **44 × 52**，出错只变红边 + 抖一下，新 `triesLeft` / `maxTries` / `invalid` / `shakeKey`。
- **上传**：`UploadDropZone` 只剩一种样子（1.5px 虚线、圆角 12、中性图标块、拖进来「松手开始上传 N 个文件」、格式写人话 `uploadLimitText`，新 `variant="row"` / `error` / `disabledText`）；`UploadField` 改成一行版（图标 + 说明 + 选择文件 → 缩略图 + 换一张 / 删除，新 `hint` / `value` / `onRemove`）；队列一行一个文件（4px 细条 +「46% · 还要 10 秒」、失败原因 + 重试、「全部重试」）；新 **`ImageUploadGrid`**（96px 方块、封面、圆环进度、「添加照片 · 还能加 N 张」）；`AttachmentGallery` 新 `onFiles`（空的时候只有一个拖放区）。
- **条件编辑器**：字段 / 条件 / 值都是 28px 小号下拉；值按字段换（选项是可点的带色标签、人员第一行「我」、日期相对日期、金额带币种和千分位）；删除用 ×；「且 / 或」可点切换；条件组浅底；筛选面板顶上一句话读出条件（新 **`ConditionSentence`**）、没条件时给常用字段快捷按钮、没填完的写「先不生效」、不合法标红；「清除全部」改「清空」。
- **字段配置**：`FieldTypePicker` 按「基础 / 选择 / 人与联系 / 关联与计算 / 系统自动」分组、可搜索，**还没做的类型收成「还有 N 种在做」**，选中后一张说明卡（新 `FIELD_TYPE_GROUPS` / `FIELD_TYPE_INFO` / `fieldTypeInfo` / `groupTypeTiles`）；`OptionsEditor` 一行 = 拖柄 + 10 色色点 + 名称框 + 已用条数，重名标红，删正在用的选项先问（新 `usage` / `fieldName` / `recordNoun`；`FieldDialog optionUsage`）。

**修**：`DatePicker` / `DateRangePicker` 点框右端的日历图标时焦点不再从输入框跳到图标上（按下不抢焦点）。

**测试 / 文档**：新浏览器测试 `test:basics`、`test:inputs`、`test:inputs-numbers`、`test:inputs-uploads`、`test:inputs-condition`（截图 `test/artifacts/basics|inputs*/`，和已审定的样稿截图并排看）；新单测 `basics-core`、`number-input-core`、`password-core`；starter 新页「系统 → 基础元素」「系统 → 输入与表单」；DESIGN.md §2 字号 / 圆角改成 8 档、新 §2.2 基础元素、§2.3 输入与表单，AI-RULES 套件清单与硬约束同步。浏览器测试的 vite 不再用 5173 端口（随机 6200–6799，关掉 HMR / 监听）。

**同事会注意到**：主按钮没有渐变和阴影了、幽灵按钮变灰字、禁用按钮是浅灰底；所有标签 / 状态变成无边框的圆角小方块，表格里的状态只剩圆点 + 字；头像变成按人分的软色（不再全是主色渐变）；鼠标停在图标按钮上出深色气泡（不再是浏览器原生提示）；「?」说明卡从下方左对齐弹出；表格首次加载显示表头 + 骨架、「共 — 条」；字重整体变轻（没有 700 了）、零碎字号对到 8 档；**列表搜索不用点「查询」了，打字就筛**；多行输入框没有拖拽角、会自己长高；设置页保存条改成浮在底部的「改了 N 处」；密码门格子变小；上传队列写「还要 N 秒」「已上传」（以前「剩 N 秒」「已完成」）。

**风险**：`QueryBar` 的 `onSearch` 现在会在打字停下 0.3 秒后被调用（以前只在点「查询」时）——慢接口（审计日志）要传 `searchMode="enter"`；`onReset` 只在 `canReset` 时露出按钮。`Textarea` 默认自动长高、`resize: none`，自己设了固定高度的宿主要传 `autoGrow={false}`。原生 `title` 换成 `data-tip`：宿主 e2e 里读 `title` 属性的断言要改读 `data-tip`（文字不变）；SDK 的搜索框是 `type="text"`（读屏角色仍是 textbox）。`StatusBadge` 在表格里自动变成圆点样式；`Meter` 默认条高 8 → 6。`.aui-icon-button`（内部类）改成无边。删掉的类：`.aui-upload-zone*`、`.aui-upload-progress`、`.aui-dropzone*`、`.aui-upq*`、`.aui-avatar-stack-item`、`.aui-copy-inline-button`（不再渲染）。

## 7.13.1（2026-10-07）

**热修：侧边弹层（SideSheet，如多维表格「表设置」）里打开下拉 / 菜单 / 日期选择器，列表跑到屏幕最左边。** 原因：浮层定位默认认为所有 `.aui-dialog` 都有 transform（是 fixed 子元素的包含块），一律减掉弹层的 left / top；侧边弹层没有 transform，于是被多减了约 800px。现在用一个 0×0 的 fixed 探针实测包含块原点（内部函数 `fixedOrigin`），居中对话框（有 transform）和侧边弹层（没有）都对；行操作菜单（RowActions）同样修了。foundations 浏览器测试加了侧边弹层里下拉贴按钮的断言（修前列表 left = 28、按钮 823）。

## 7.13.0（2026-10-07）

<!-- adminui/form-controls：五组表单控件审阅全部通过 -->
**表单控件统一**：日期、下拉、单选标签、多选、勾选类五组控件按已审定的样稿改成一套样子。根入口只新增导出，没有删导出；`OptionTone` 类型变宽（旧名照样合法）。

- **选项 10 色**（替代原来的 7 色）：`green`（= 主色）· `teal` · `blue` · `violet` · `pink` · `red` · `orange` · `yellow` · `olive` · `gray`（= 备注色），其余 8 个取当前色卡**异常色**的明度和彩度只转色相；每色还有实心 `greenSolid` …。`createPalette` 预先算好浅 / 深色的 `--aui-option-<色>` / `-soft` / `-text` / `-solid`（标签字 ≥ 4.5:1），不依赖 `oklch(from …)`。**旧 7 色名一一对上，存的数据不用迁移**：`brand → green`、`brandMid → teal`、`info → blue`、`warning → yellow`、`danger → red`、`neutral → gray`、`solid → greenSolid`。新导出 `OPTION_HUES` / `OPTION_HUE_LABELS` / `LEGACY_TONE_MAP` / `LEGACY_OPTION_TONES` / `toneHue` / `isSolidTone` / `withSolid` / `isOptionToneName` / `optionHueColors` / `hexToOklch` / `oklchToHex`，`createPalette().options`；类型 `OptionHue`、`OptionHueTone`（20 个新名）、`LegacyOptionTone`，`OptionTone` = 新名 + 旧名。`OPTION_TONES` 现在是 20 个新名；`optionTone` / `resolveOptionTone` / `colorTone` 返回新名（颜色名 `orange`、`purple` 对到自己的色，不再并成注意 / 信息）；`nextOptionTone` 轮换蓝、青、黄、橙、绿、紫、粉、红、橄榄、灰。
- **标签形状统一**：`.aui-chip` 是圆角 6 的软方块、不加边框（以前有胶囊 + 描边、白底方框、实心三种）；`data-size="md"` 22px（字段行）、`"lg"` 26px（表单）；小圆点 `.aui-tone-dot`；「+N」是浅灰小块。`OptionSwatchPicker` 改成 10 个色块（5 × 2，方向键 ↑ ↓ 换行）+「实心」开关 + 预览（`allowSolid` 可关）。表格填色、看板 / 日历 / 甘特色块跟着 10 色走。
- **一种下拉**：`Choice` 不再用 Radix Select，改成 SDK 自己的触发器 + 弹层（同样的 props，`role=combobox` / `listbox` / `option` 不变），新增 `size="sm"`（28px）、`clearable`（悬停 ×，Delete 清空）、`searchable`（默认多于 6 项自动出搜索）、`onCreate`（搜不到就地新建）、`readOnly`；选项可带 `tone` / `color`（显示成颜色标签）、`group`、`hint`、`avatar`（选人：头像 + 部门）、`disabledReason`。弹层：行高 32、圆角 6、整行悬停、单选的勾在右、灰掉的写原因、空状态 + 「＋ 新建选项」。新组件 **`MultiChoice`**（可删标签、`size="sm"` 一行放不下 +N、`max`、勾选框在左、底部「已选 N 项 · 清空」、点外面就保存）、**`ChoiceTags`**（表单里 ≤ 6 个选项的带色标签按钮）、**`RadioGroup`**（单选圆点 + 下一行说明）。拼特殊选择器用的零件也导出了：`OptionList` / `OptionContent` / `SelectSearch` / `SelectFooter` / `RemovableChip` / `useOptionNav` 和纯规则 `filterOptions` / `groupOptions` / `keyboardOrder` / `moveActive` / `initialActive` / `createCandidate` / `typeahead` / `toggleValue` / `chipsThatFit` / `showsSearch`。`FormField` 包着 `MultiChoice` / `ChoiceTags` / `RadioGroup` 时也自动用可见标签命名。
- **同一种下拉用到各处**：BitableGrid 和记录详情的单选 / 多选 / 人员编辑器（格子变成小号选择框，已选是标签；**「（清空）」不再是第一项**，单选用框里的 ×、退格清空；多选没有「完成」按钮，底部「已选 N 项 · 清空」）、筛选的字段框（`GridFieldPicker`，28px）、值框（`ConditionValuePicker`，勾选框 + 最多露 2 个 + N）、条件行的字段 / 运算（`size="sm"`）、公开表单 / 新建记录的单选（≤ 6 个选项 = 带颜色的 `ChoiceTags`，以前是没颜色的圆点；下拉也显示选项颜色）。仪表盘筛选胶囊和权限档位还是 Radix Select，样式换成同一套。
- **手机底部弹层**：`PopoverLayer` 新增 `sheet`（`PopoverSheet` = 标题 + 左右按钮）：≤ 760px 时同一个弹层贴底铺满、带遮罩和抓手，行高 / 日子格 44px。下拉、多选、表格选项编辑器、日期都用上了。
- **日期**：弹层顶上「今天 / 明天 / 下周一 / 一周后 · 清空」；今天 = 主色字 + 小圆点（不再是方框）、已选 = 主色实底、键盘焦点 = 主色描边；`DateTimePicker` 和表格的日期时间格子在月历右边有半小时一档的时间列，选中是主色实底；框里值后面跟「周四 · 明天」（`relative`，默认开），`deadline` 到期字段明天到期注意色、过期异常色 +「（已过期）」；`clearable` 的 × 悬停才出现。**表格日期格子的占位从写死的「2026-10-05」改成「年-月-日」（日期时间「年-月-日 时:分」）**。新纯函数 `quickDays` / `relativeDayText` / `relativeDayWord` / `dueState` / `daysBetween`。`DatePicker` 日历底下的「今天 / 清除」按钮移到顶上的快捷一行；`DateTimePicker` 底栏只剩时间框和「确定」。
- **勾选类**：全 SDK 一种勾选框（16px 圆角 4、1.5px 边、悬停主色边、聚焦 3px 光圈、`checked="indeterminate"` 显示「−」——`DataTable` / `BitableGrid` 表头部分勾选就是它）——表格勾选格、多选弹层、表单多选胶囊、授权名单都套这一个（`GrantList` 的原生勾选框换成 `Checkbox`）；单选圆点统一 16px、选中 5px 主色环（权限档位的原生 radio 也是这个样子，不再用 `accent-color`）；`Switch` 32 × 18、新增 `size="sm"` 26 × 14；`SegmentedControl` 选中改成浅底槽里的白色凸起块（以前是主色浅底）。新 CSS 工具类 `.aui-check-row`（一行勾选，文字可点）。
- **输入框状态统一**：新 token `--aui-field-border`（静止边框）、`--aui-focus-ring` / `--aui-focus-ring-danger`（聚焦光圈）、`--aui-pop-shadow`、`--aui-option-row`、`--aui-option-hover`；出错的输入框只在聚焦时有红光圈。
- **一套滚动条**（反馈：「这个滚动条的样式太丑了」）：`--aui-scrollbar-size`（10px，弹层 / 下拉 / 菜单 / 时间列 8px）、`--aui-scrollbar-thumb` / `-hover`（控件边框色），全站 `::-webkit-scrollbar` 一套；去掉组件里的 `scrollbar-width: thin`（Chromium 121+ 写了就退回系统样式）；深色侧栏用同一套变量换成侧栏线色。
- `RecordBadge.tone`（7.12.1 的记录头部小标签）也收 10 色；`ActivityComposerDue.deadline`（默认开：写跟进的「下次跟进」显示「周四 · 明天」并到期变色）、`GridField.deadline`（表单里的日期题按到期字段显示）。
- starter「系统 → 表单控件」样板页（五组、各种状态、浅 / 深色、手机）；新 `test:form-controls`（截图 `test/artifacts/form-controls/`）；单测 `option-tone.test.ts`（旧 7 → 新 10 映射、OKLCH、6 套色卡 × 浅深的对比度）、`option-list-core.test.ts`；DESIGN.md §1.7 选项 10 色、§2.1 表单控件。

**同事会注意到**：所有标签变成无边框的圆角小方块，颜色从 7 种变 10 种（旧数据自动对上：主色浅 → 青、信息 → 蓝、注意 → 黄……，`warning` 选项看起来更黄、`info` 更蓝）；所有下拉换成新弹层（勾在右、多于 6 项有搜索、手机是底部弹层）；表格单选编辑器没有「（清空）」行了（用 × 或退格）；多选编辑器没有「完成」按钮（点外面就保存）；新建记录 / 公开表单 ≤ 6 个选项的单选变成带颜色的标签按钮；日期框后面多了「周四 · 明天」，弹层多了快捷一行；分段选择选中变成白色凸起块；开关小了一号（36 × 20 → 32 × 18）。

**风险**：`Choice` 换了实现——还是 `role=combobox` + `listbox` / `option`，键盘 ↑ ↓ / Enter / Esc / 首字母跳转都在，但不再渲染 Radix 的隐藏 `<select>`（表单原生提交拿不到值，SDK 里没有这样用的）；弹层挂 Provider 的 portal（在 Dialog 里挂弹框里）。`resolveOptionTone` / `optionTone` / `kanbanColumns` / `viewRecordTone` 返回新色名（`"gray"` 而不是 `"neutral"`），按旧名比较的宿主代码要改成比较 `optionTone(x)`。`OptionTone` 是 20 个新名 + 7 个旧名的并集：宿主用 `Record<OptionTone, …>` 穷举的地方类型检查会要求补上新名。选项色 CSS 变量由 `AdminProvider` 写在根上，脱离 Provider 的地方只有森林绿浅色的兜底值。类名变化：`.aui-grid-option` / `-list` / `-check`、`.aui-grid-fpick-option` / `-list` / `-search` / `-name` / `-check` 去掉了（编辑框外壳 `.aui-grid-option-field` / `-search` / `-clear` / `-editor` 还在），换成 `.aui-opt*` / `.aui-optlist` / `.aui-select-search`；`.aui-pform-radio*` 去掉（单选题是 `.aui-tagpick`）。
## 7.12.1（2026-10-07）

<!-- adminui/7.12.1：截图验收（智能家居客户演示）+ 组件审阅「协作、分享与媒体」/「视图与卡片」 -->
**记录详情对齐样稿 C 的补丁 + 浮层叠放修复 + 时间线圆点对齐**。只新增可选属性 / 导出，没有删改已有导出。

- **修：阶段条后面的段被「填色」**（反馈截图：当前首通 1/7，第 4 段谈判也是绿的）。根因：分段悬停样式把未开始的段刷成「已走过」的颜色（`--aui-primary-mid`），鼠标停在某段上（比如刚点过谈判再改回首通）就像进度走到了那里。现在悬停只描一圈边、名字变主色，不填色。另外 `resolveStagePath(steps, current)`：给了 `current` 就只按位置推状态，宿主带来的旧 `state`（以前走到过的段）不再让后面的段亮；走过的段照样显示天数。单测「推进到谈判再退回首通」。
- **阶段「更多」**（丢单 / 作废出口）改成安静的小灰字，箭头小而淡。
- **头部（样稿 C）**：`RecordLayout.badges(row)` / `RecordDetail badges` / `RecordHeader badges`（新类型 `RecordBadge = { label, tone? }`）= 标题旁的彩色小标签（「跟进中」「A 类」）；`RecordLayout.meta(row)` / `RecordDetail meta` / `RecordHeader meta` 可以给分段数组（新类型 `RecordMetaPart`：文字，或 `{ person, suffix? }` = 小头像 + 「小王 负责」），用「·」连起来，给了就代替 `subtitle` 显示在头部（简要档仍用 `subtitle`）。卡片分区里没给 `avatar` 时默认标题第一个字的字母块（44px 圆角、浅主色底；`avatar: () => null` 不要）；标题 22px / 600，手机 40px / 20px。新导出 `recordInitial`、`RecordMetaLine`。
- **字段说明不再出 ⓘ 图标**：`RecordField.description`（字符串）= 悬停字段名看的说明（`title` + 读屏文字），详情里不多一个图标、不多一行。宿主别再用 `icon` 放说明。
- **`ActivityComposer` / `ActivityComposerTool`**（新，类型 `ActivityComposerProps`、`ActivityComposerDue`、`ActivityKind`）：样稿 C 的「写跟进」一个框——方式小标签（单选，带图标）、短文本（Ctrl + Enter 保存）、底部一行：左边宿主工具（录音、附件图标按钮），右边「下次跟进」+ 小日期框 + 1 / 3 / 7 天 + 保存按钮靠右；工具打开的东西（录音条、拖放区、上传列表）放 `panel`。手机上底部换行，保存仍靠右。
- **右栏停住**：卡片分区（和左右分栏的资料栏）宽屏时 `position: sticky`，比可视区高时自己滚（`overflow-y: auto; overflow-x: hidden`）；主栏的跟进 / 评论很长往下读时旁边一栏不再滚成空白。弹框和整页都生效，编辑布局时不停，手机一列照常。
- **修：从浮层里打开的确认框压在浮层下面**（审阅 08：视图管理里删「我的视图」，「删除视图」点不到）。弹窗遮罩 / 弹窗和菜单、`PopoverPanel` 同在 120 层，按打开顺序叠：从浮层里开的弹窗一定在上面，弹窗里再开的菜单也在弹窗上面。`PopoverPanel` 在它里面打开的弹窗上点按 / 按 Esc 不再当成「点了外面」把自己关掉（Esc 只关弹窗）。`test:views` 加删除我的视图。
- **视图标签栏右边宿主的东西（`ViewTabs trailing`，如仪表盘分组）不再压住视图标签和「更多」**（审阅 08，手机 390 上「更多」点不到）：宽屏它可以缩、自己横向滑（最多占一半）；手机上单独一行放在标签下面（横向滑，两个方向的 overflow 都写了），「视图」按钮和标签仍在第一行。
- **时间线圆点压在线上**（反馈：「跟进记录里面的那个线，圆点要左右居中到线上」）：`ActivityFeed`（CRM 跟进、修改记录…）和单元格修改历史（`CellHistoryPopover`）统一 2px 线、8px 圆点 + 2px 底色圈，圆心和线的中线对齐；`ActivityFeed` 的线往右让 5px，放在滚动容器里圆点也不会被切掉半个（浏览器测试量 |Δ| ≤ 0.5px，浅 / 深 / 390）。单元格历史的线从 1px 改 2px、圆点 9px 改 8px。

**同事会注意到**：卡片分区的头部、阶段悬停、「更多」样子变了；`.aui-dialog-overlay` z-index 100 → 120、`.aui-dialog` 110 → 120（自己写了 101–119 之间浮层的项目要看一下，库里没有）。

**风险**：`resolveStagePath` 在给了 `current` 时忽略步骤上的 `state`（以前宿主给的 state 优先）——想自己定每段状态就别传 `current`。

<!-- adminui/overlay-bugs：组件库审阅 03 / 04 / 05 的真 bug（不含视觉改版） -->
**审阅里的几处真 bug**。只新增导出和可选属性；行为变化见「同事会注意到」。

- **弹出面板贴着按钮**（审阅 03）：`placeLayer` 左对齐的面板右边放不下时，只往左挪到刚好放下（仍罩住触发按钮），不再翻成「右边缘对齐按钮」把宽面板（多维表格 640 宽的「筛选」）甩过左侧目录栏。右对齐放不下时照旧改成左对齐。格子里的单选 / 多选下拉同一套定位，贴格子下边 4px、左对齐。
- **失败提示不自动消失**（审阅 03）：`useNotify` 的 `"error"` 一直留着，要点 × 关；成功 / 信息仍 5 秒。同一条提示（同文字同口气）再来只留一条。手机（≤ 760px）上提示条铺满宽度，抬到页面底栏（表格条数 / 状态栏、表单操作条）和底部导航、安全区之上；底栏更高的宿主设 `--aui-notices-offset`（默认 48px）。
- **`SelectList noMatchLabel(query)`**（审阅 03）：搜索把所有项都筛掉时显示「没有找到「…」」（默认），不再显示 `emptyLabel`（那句只给真没有项的时候）。
- **多维表格最右边不留白缝**（审阅 05）：横向滚到底时，第一列滚动列正好贴着冻结线（末尾补一段空白，新纯函数 `scrollTailPad`），不再有一列滑到冻结列下面、只露出空白尾巴。
- **`DeltaBadge better`**（审阅 05）：`"down"` = 越小越好（响应时长、逾期），下降显示好的颜色；`"neutral"` 不分好坏；不给就用 delta 自己的 tone（`computeDelta` 的 `better`）。新纯函数 `deltaTone(direction, better)`（`computeDelta` 也用它）。
- **审计详情给人看**（审阅 05）：新纯函数 `readableDetail(detail, { labels, format, maxList })` → `{ shown, technical }` 和 `detailValueText(value)`：有标签的键写中文、值写人话（是 / 否、千分位、短列表「、」、长列表「N 项」），没标签的键和原始值归「技术细节」，给 `LogTimeline` 的 `detail` 用。
- **标签条的滚动箭头不压字**（审阅 04）：`ScrollStrip`（页内 `Tabs`、工作标签）放不下时两侧各留 28px 给圆形箭头，渐隐缩到 24px 且不再有全透明段；触屏上不留这段空。
- **手机步骤条不截断**（审阅 04）：`Steps` 在 ≤ 760px 线段可缩到 12px，再放不下就在条里横滑（两个方向的 overflow 都声明），当前步骤自动滚进可见范围。
- **侧栏收起后还能退出 / 切公司**（审阅 04）：`AdminShell` 收起时，底部账号区变成一个头像按钮，点开是一个弹出面板，里面就是 `profile` 的内容（点里面的按钮会自动关）。新可选属性 **`account: { name, detail? }`** 给头像首字和名字，不给就显示人形图标。
- 表头「全选」：`DataTable` / `BitableGrid` 部分勾选时本来就传 `"indeterminate"`；勾号换成「−」在 `Checkbox` 里改（同期的表单控件分支）。
- 测试：单测 `placeLayer` 宽面板、`scrollTailPad`、`deltaTone`、`readableDetail`；浏览器 `test:grid-panels` 筛选面板贴按钮（1440 / 1100）、`test:foundations` 失败提示常驻 + 去重 + 手机位置（starter「基础部件」加了「操作结果提示」演示）、`test:page-templates` 搜不到的写法 + 390 步骤条、`test:browser` 收起侧栏的账号按钮 + 箭头在留白里。

**同事会注意到**：失败提示不再 5 秒消失；手机上提示条位置变高、变宽；靠右的宽面板 / 菜单不再翻成右对齐，而是贴着右边距；标签条放不下时两侧多了 28px 留白；`SelectList` 搜不到时的文字变了。

<!-- adminui/input-bugs，组件库审阅 02 输入与表单的功能问题 -->
**表单逐项出错、公开页提交、区号默认值、金额格子编辑、文件大小 / 类型写法**。只新增导出和可选属性。

- **表单逐项出错**：新 `FormFieldErrors`（`throw new FormFieldErrors({ [控件 id]: "请填客户名称" })`）和 `FormDialog fieldErrors`：错误写在对应 `FormField` 下面、框变红（`aria-invalid`），提交后焦点到第一个出错的框并滚到中间；改了那个框它的错就消失；id 不在表单里的错退回表单底部那一行。整表级的 `Error` 照旧显示在底部，现在会滚到可见处（手机上「点新建没反应」）。新纯函数 `revealFirstProblem(root)`（`form-errors-core.ts`）。
- **PublicForm**：最后一题填错后直接点「提交」，离开那一题出的错误行把按钮往下挤、这次点击落空——只标了这一题，必填没填的题不提示。按下「提交」时不再按离开那一题判，提交照常判全部、焦点到第一个错。
- **`FormBuilder defaultCountry` / `countryCodes`**：搭建器画布里的手机题和「填写预览」用宿主给的默认区号（如英国团队 +44），不再固定 +86。
- **表格金额格子编辑**：编辑框里左边显示币种（`field.currency`，默认 ¥），数字靠右和格子一致。
- **`SecretReveal`**：分享人一行改成「郑主管 · 10-07 10:30 分享」；`sharedAt` 只传时间，旧写法「分享 · 10-07」也不会再出现「分享 · 分享」。新纯函数 `sharedByText`。
- **文件大小统一 1024 进位**（DESIGN.md「文件大小与类型」）：`UploadField` 的上限和 `validateFile` 的报错改用 `formatBytes`（5 MB 上限显示「5 MB」，不再「5.0 MB」/「4.8 MB」）。**类型写人话**：新 `fileTypeName(name, mime)`（「图片 PNG」「PDF 文档」「Word 文档」「Excel 表格」…）、`acceptLabel(accept)`（「图片 PNG / JPG」）；`UploadField` 不再显示 `image/png / image/jpeg`，类型不符写「文件类型不支持，只能传图片 PNG / JPG」。

**同事会注意到**：`FormDialog` 提交失败后焦点会移到第一个出错的框（或滚到底部错误行）；`validateFile` 的文字变了（大小写法、类型名）。

**风险**：`FormField` 在 `FormDialog` 里没给 `error` 时会读对话框的 `fieldErrors[htmlFor]`——别的表单里 id 重名的框不受影响（只读自己所在的对话框）。

<!-- adminui/collab-bugs：组件库审阅 07（协作、分享与媒体）+ 06 看板搭建器的数字卡 -->
**审阅 07 / 06 的功能 bug**（只修行为和排版，没有改样式风格）。只新增可选属性，没有删改已有导出。

- **@ 提到同事往上开**：评论输入框的 @ 弹层默认开在输入框上方（不再盖住下面的子表），上面放不下才往下。`placeLayer` / `LayerPlacement.side` 多了 `"top"`（上面优先、放不下翻到下面）。
- **我的分享 1440 带侧栏不再横着滚**：列宽收紧（分享对象 180 起、谁能打开 96、有效期 140、打开次数 112、最近打开 112）；展开的访问记录贴住表格看得见的宽度（`container-type` + `cqw`），表格窄到要滚时风险行的「封这个 IP」也不会被切到右边。
- **附件文件名不被锁标挤没**：锁标先缩（最少剩锁 + 「…」），文件名保住宽度、只省略主名；锁标 `title` 是「标签：说明」全文。
- **麦克风打不开说人话**：`AudioRecorder` / `HoldToTalk` 按浏览器错误名（NotAllowedError、NotFoundError、NotReadableError、NotSupportedError、不安全的 http 网址……）写中文原因 + 两步怎么办，重试没用时不给「重试」，浏览器英文原话只在最后一行小字（「浏览器原因：…」）。纯函数在新文件 `media-recorder-core.ts`（`recorderProblem` / `recorderFailure`）；`useAudioRecorder()` 多返回 `failure: { name?, message? }`。
- **记录修改历史直接写「旧 → 新」**：`LogTimeline` 新可选属性 **`inlineDiff`**（audit 版式）——`diff` 只有一处改动时，在行里写「修改了「状态」 ~~跟进中~~ → **已成交**」（值由宿主格式化 / 打码），这一行不用再展开；多处改动照旧展开看表。纯函数 `inlineChange`（history-core）。
- **操作记录「做了什么」不截断**：这一列最多两行写全（行高跟着长），操作人列收窄；纯文字的「做了什么 · 灰字」全文在 `title`。
- **表时光机没有可回退的修改时不给确认**：四张预览卡换成「这个时间点之后没有可回退的修改」，「确认回滚」禁用（悬停说原因）。`TimeMachinePreview` 新可选属性 **`empty`**（宿主用 `cards` 时告诉 SDK「没有改动」；用 `counts` 时自动算）；纯函数 `nothingToRollBack`。
- **深色二维码是一张卡**：白底（静区）不变，外面一圈面板色卡框，不再是一块刺眼的白方块。
- **看板搭建器编辑时数字卡不再只剩「1.」**（审阅 06）：编辑画布最少 560px 宽，窄了横 / 竖都能滚；数字卡的数先缩字号（到 60%），再把纯数字换成 万 / 亿（全数在 `title`），不会截在数字中间。纯函数 `compactNumberText` / `kpiFitScale`（dashboard-builder-core）。
- starter：版本回退页加「记录修改历史」示例（`inlineDiff`）；看板搭建器组件库加「本月成交金额」（大数字）。浏览器测试 `test:records`（@ 弹层位置）、`test:share`（1440 不横滚、封 IP 看得见、深色二维码卡框）、`test:media`（文件名、录音器错误）、`test:history`（行内旧 → 新、做了什么不截断、时光机没改动）、`test:dashboard-builder`（1280 / 1440 编辑时大数字）；单测 `media-recorder-core`、`history-core`、`menu-core`、`builders-core`。

**同事会注意到**：@ 弹层默认在输入框上方；我的分享列略窄；录音器出错的文字变了（测试里断言了旧文字「麦克风权限被拒绝」「这个浏览器不能录音」的要改）。

**风险**：`.aui-dbb-scroll` 从只竖滚改成两个方向都能滚；数字卡缩字号是在 `strong` 上写内联 `font-size`（只在看板搭建器里）。

## 7.12.0（2026-10-07）

<!-- adminui/record-detail-c -->
**记录详情卡片分区 + 编辑布局**（三版对比稿里选定了 C「卡片分区」，A / B 做成另外两种版式）。只新增导出和可选属性，没有删改已有导出；不给 `RecordLayout.cards` 的详情和以前一样。

- **`RecordLayout.cards`**（新类型 `RecordCardsLayout`）：给了它，弹框 / 整页的「详情」页签变成浅底上的软卡片——阶段 + 最多 4 个关键数整条在上，左宽主栏放宿主块（`slots`：跟进、评论、子表；`sections` 里用 `block` / `render` 画的分区自动变 slot），右栏 380px 是分区卡片（还是 `RecordField` 行：悬停按钮、就地编辑、锁）。分区里的空字段（**包括能编辑的**）收成「N 个空字段已收起 · 显示」。头部多了安静的「☆ 关注」（`follow`）和「编辑布局」（`editor`）。
- **`RecordDetail`**（头部 + 编辑条 + 正文，给宿主自己的页面）/ **`RecordDetailBody`** / **`useRecordLayoutEditor`** / `RecordLayoutBar` / `RecordLayoutButton` / `RecordDetailHeaderTools` / `FollowButton` / `recordDetailCatalog` / `useRecordDetailSpec`；新类型 `RecordStage`、`RecordKeyNumber`、`RecordDetailSlot`、`RecordFollow`、`RecordLayoutEditor`、`RecordLayoutEditing`。
- **布局是一份 JSON**：`RecordDetailSpec = { preset: cards | single | split, blocks: [{ id, kind: stage | keyNumbers | section | slot, column: main | side, title?, fields?, collapsed?, hideEmpty? }], hidden, keyNumbers? }`。纯规则在新子路径 **`@adminui/react/record-detail-spec`**（无 React，根入口也导出）：`normalizeRecordDetailSpec`（服务端保存前校验）、`defaultRecordDetailSpec`、`recordDetailPlacement`、`moveRecordDetailBlock` / `stepRecordDetailBlock` / `moveRecordDetailField` / `setRecordDetailHidden` / `updateRecordDetailBlock` / `addRecordDetailSection` / `removeRecordDetailSection` / `setRecordDetailPreset` / `setRecordDetailKeyNumbers` / `pickKeyNumbers` / `recordDetailFieldTree` / `applyRecordDetailFieldTree` / `recordDetailHiddenItems` / `foldRecordDetailFields` / `limitKeyNumbers` / `recordDetailSpecEqual`、`resolveStagePath`。
- **编辑布局**：编辑条（公司默认 / 只改我的、版式、恢复公司默认、取消、完成 → `onSave(spec, scope)`），卡片拖到另一栏 / 换顺序（指针；键盘 Alt + 方向键，左右换栏，或空格拿起），整理字段（侧边面板：字段只在分区里拖、改名 / 新建 / 删除分区、隐藏字段），默认收起、隐藏 + 「已隐藏」托盘、选择关键数。编辑时 Esc 先退出编辑。
- **`StagePath`**（可单独用）：`segments`（色条 + 每段天数「1 天 / 第 3 天」）或 `chevrons`（箭头）；`onSelect(stepId)` 每段是按钮（Tab + Enter，当前段 `aria-current="step"`），`kind: lost / void` 的出口（丢单、作废）进末尾「更多」菜单，已退出时这个按钮显示出口名；`readOnly` 不可点。`stageDaysText`。
- **`SortableList canDrop`**（`SortableAllow`，`moveNode` / `stepTarget` / `dropTarget` 的可选最后一个参数）：宿主落点规则，例如「字段只能在分组里」——键盘到组边直接进相邻分组，拖到两组之间落到上面那组末尾。
- **`OptionsEditor` / `FieldDialog` 的 `renderOptionExtra(option, index, change)`** + **`EditableOption.meta`**：每个选项行末尾放宿主控件（阶段的类别、默认赢率），`meta` 改名 / 换色 / 换序 / `cleanOptions` 都保留。
- starter「系统 → 记录详情 · 卡片」（赵静怡：三种版式、编辑布局存浏览器、弹框里的 `RecordLayout.cards`、阶段选项每行类别 + 赢率）；新 `test:record-cards`（截图 `test/artifacts/record-cards/`）；单测 `test/record-detail-spec.test.ts`、`sortable-core` 加 canDrop。

**同事会注意到**：没有变化，除非页面给了 `RecordLayout.cards` / 用了 `RecordDetail`。`RecordDetailDialog` / `RecordPage` 在 `cards` 下头部固定用 flat 样式。

**风险**：类名 `.aui-dcard*`、`.aui-rdetail*`、`.aui-rkey*`、`.aui-rstage*`、`.aui-stagepath*`、`.aui-rlayout-*` 是新的；卡片分区用容器查询（`container-type: inline-size`）判断窄屏。`moveNode` / `stepTarget` / `dropTarget` 多了可选参数，旧调用不受影响。布局 JSON 由宿主存，SDK 不鉴权——「公司默认」谁能改由宿主的 `canEditDefault` 和服务端决定。

## 7.11.0（2026-10-06）

<!-- bt/record-detail-feishu -->
**记录详情改成飞书式列表 + 就地编辑**（看客户记录时的反馈：「这个详情页好丑啊，编辑也有问题」）。只新增类型和可选属性，没有删除导出；旧的方块样子用 `display: "tiles"` 拿回。

- **新默认 `RecordLayout.display = "list"`**（新类型 `RecordDisplay`）：字段一栏，灰色字段名在左（约 132px，可换行，带图标），值在右（14px 正常字重，不再加粗放大）；行与行之间留白，没有一格一格的小卡片；多列网格去掉了（不会再出现「预计金额」旁边两个空格子）。分区是平的区域：小标题 + 一行浅色「10 / 11 已填 · 未填写：客户质量」（不再是卡片头 + 进度条），分区之间一条线；子表（`SubTableSection`）、评论（`CommentThread`）、宿主自己的 `SectionCard` 放在详情里也去掉外框圆角，贴着分区对齐。右栏「概要」「评论」和正文同一个白底，中间一条竖线；弹框 / 整页正文从浅灰底改成白底。
- **按钮只在悬停 / 聚焦时出现**：编辑、修改历史等 `action` / `actions`、拨打、打开、复制收进这一行右上角的按钮条，鼠标移上来或键盘 Tab 到这一行才显示；留痕查看的眼睛留在值后面。触屏上点字段名 / 值让这一行有焦点时出现。
- **就地编辑 `RecordField.edit`**（新类型 `RecordFieldEdit` / `RecordFieldEditContext`）：`edit: (row) => ({ render: (ctx) => … })`，点值（或「编辑「X」」按钮、焦点在值上按 Enter / F2）就把值那一格换成编辑器——占满整格宽、原值藏起来；保存成功宿主调 `ctx.done()`（焦点回到值），失败留在编辑器；Esc 只取消这一格，不再连详情弹窗一起关（`Dialog` 对带 `data-aui-editing` 的区域和浮层一样处理）；编辑时 Alt + ↑ / ↓、J / K 不切换记录。`{ onActivate(anchor) }` 给勾选框切换、附件面板、关联选择器。返回 null = 这条记录不能改：悬停出一把锁（`lockedReason`，默认「没有修改权限」）。可编辑的空字段留在原位显示「—」，点一下就填；「未填写」里的名字点了也直接进编辑。一条记录同时只开一个编辑器，换记录时关掉。
- **`GridCellEditor variant="field"`**（`@adminui/react/grid`，默认 `"cell"` 不变）：放在详情值那一格里排版（36px 框 / 多行框，主色细边 + 浅光圈），单行 Enter 保存、长文本 **Enter 换行、Ctrl / ⌘ + Enter 保存**、Tab / 点别处保存；单选 / 多选 / 人员变成一个框（已选的胶囊 + 搜索），选项列表挂在框下面、和框一样宽；日期框就地、日历挂在下面；评分就地。`editorKeyAction` 多了第三个参数 `variant`。
- **`RecordHeader variant="flat"`**（列表展示时详情弹框 / 整页自动用）：白底不再是渐变，标题 18px、图标 36px、头部按钮小号，标签页「详情 / 修改历史」压在头部唯一一条底线上。
- 顺带修：表格里日期格子的日历第一次打开时没有锚点（要等下一次重画才出来），现在挂上就出；评论「发送」没字可发时是中性灰的禁用样子，不再是一颗发白的主色按钮。
- starter「系统 → 记录与字段」客户详情演示就地编辑（预计金额、客户质量、安装日期、备注；带「失败」保存会被拒；最后跟进只读带锁）；新 `test/record-list-checks.mjs`：`test:records` 量编辑框在值那一格里、原值藏起、Esc 不关详情、焦点回到值、失败留着、长文本 Enter 换行 / Ctrl+Enter 保存、选项列表挂在值下面、日期框 + 日历、悬停才出按钮、锁、深色、390（字段名在上值在下、编辑框不出屏）；`test:record-detail` 量没有卡片套卡片、字段名在左值在右、正常字重、悬停按钮、头部 flat。单测：`recordFillSummary` / `recordFieldEditState` / `arrangeRecordFields keepEmpty`、`editorKeyAction` 字段模式。

**同事会注意到**：所有记录详情（`DataTable` / `BitableGrid` 的 `expandRecord`、`useRecordDetail`、`RecordDetailDialog`、`RecordPage`）默认变成一栏列表，字段方块、分区卡片、右栏浅灰底都没了，字段按钮要悬停才看得到；头部变矮、按钮变小。想先保持原样的页面在 layout 里加 `display: "tiles"`。

**风险**：按 `.aui-ftile` / `.aui-scard`（分区卡片）/ `.aui-ftile-actions` 写的测试和选择器在列表展示下找不到——字段行是 `.aui-rfield`（`.aui-rfield-label` / `.aui-rfield-value` / `.aui-rfield-tools`），分区是 `.aui-rsection`（`role=region`，名字还是分区标题）。项目里给 `RecordField.action` 做的「修改」按钮 + 浮层编辑器应换成 `edit`（浮层里放 `GridCellEditor` 会因为它按格子绝对定位而浮在别处）。`FieldTile` / `FieldTiles` / `SectionCard` 本身没变。

## 7.10.1（2026-10-06）

- `WorkspaceLayout narrow="flush"`（≤1100px）：栏不再有 80dvh 上限，内容随页面滚（文档长页不被截断）；工作区铺 `--aui-surface` 底色并至少铺到可用高度底部，内容短时不露灰底。模块里为此写的 `max-height:none` 覆盖可以删。

## 7.10.0（2026-10-06）

<!-- bt/neutral -->
**文档页三处补齐：纯中性文字灰、面包屑斜杠间距、工作区窄屏贴边**（应用组反馈）。只新增，没有删改已有导出；`--aui-text` / `--aui-secondary` / `--aui-note` 的值不变，全站颜色不动。

- **纯中性文字阶**：新 token `--aui-neutral-1` … `--aui-neutral-4`（浅色 = 飞书 `#1F2329` / `#646A73` / `#8F959E` / `#BBBFC4`；深色按当前色卡面板算，森林绿上 `#e3e5e8` / `#a7acb3` / `#7f858d` / `#5a5f66`，1 ≥ 7:1、2 ≥ 4.5:1、3 ≥ 3:1），`createPalette` 多返回 `neutralText`。正文容器加 `className="aui-neutral-text"` 时，子树里正文 / 次要 / 备注换成 1 / 2 / 2 级（备注不用 3 级，保证小字 4.5:1）。只给文档阅读 / 编辑器正文用（DESIGN §1.6、AI-RULES 附录 R）。没有叫 `--aui-ink-1..4`：`--aui-ink` 已经是「深一级主色」，同名前缀会被当成主色阶。
- **`Breadcrumbs` 斜杠**：以前「 / 」写在后一项里，斜杠左边是项间距、右边只有一个空格，「个人空间 / asf」左宽右窄；现在斜杠是自己的 `aria-hidden` 元素（`.aui-breadcrumbs-sep`，备注色），左右各 6px，链接项去掉按钮左右内边距，文字到斜杠的距离两边一样。`nav aria-label="面包屑"`、最后一项 `aria-current="page"` 不变，读屏不再读斜杠。
- **`WorkspaceLayout narrow?: "card" | "flush"`**（默认 `"card"`，同以前）：`"flush"` = 窄屏（≤ 1100px）上下排时不做成卡片——外壳内容区不留内边距（手机底栏照样让出高度）、没有外框和圆角、栏贴左右边、上下之间一条横线；放在 `TabbedPage` 里分区标签条照宽屏那样贴边。给文档阅读 / 编辑器页用。新类型 `WorkspaceNarrowMode`。
- starter「系统 → 工作区贴边」加「文档」分区（`narrow="flush"` + 面包屑栏头 + `aui-neutral-text` 正文 + 四级灰阶示例）；新 `test/narrow-checks.mjs`：`test:page-templates` 测客户表（卡片）和文档（贴边）在 390 / 900 浅 / 深色下栏之间没缝、只有一条线、贴边模式无外框 / 圆角 / 内容区内边距、面包屑斜杠两边间距相等（按文字框量）、文档正文 / 备注取中性 1 / 2、对比度；`test:design` 量「后台工作流」面包屑；单测核对中性阶浅色值、纯灰、深色对比度、tokens.css 兜底值和 `.aui-neutral-text` 只换三个变量。

**同事会注意到**：面包屑斜杠两边一样宽（整体比以前略紧，斜杠变成备注色），读屏不再念「斜杠」。其余默认不变：不加 `narrow="flush"` / `aui-neutral-text` 的页面看起来和以前一样。

**风险**：`Breadcrumbs` 的 DOM 变了（每项外面一层 `.aui-breadcrumbs-item`，斜杠是兄弟元素）——按「`nav > span` 文字含 / 」写的测试或选择器要改。`aui-neutral-text` 只换 text / secondary / note 三个变量，组件里写死用别的变量的文字（主色、点缀色）不跟着变；放进弹层（portal）的内容不在子树里，不受影响。

## 7.9.1（2026-10-06）

- `GanttView` 默认分栏先顾左侧列表：列表放不下它的列（按字段类型和标题算的自然宽度，新导出 `ganttListNeed`）时，先把每天的格子缩窄（最窄 28px）再给列表，侧栏打开等窄容器里负责人、手机等列不再被挤成「小.」。`ganttAutoSplit` / `ganttFrame` 多了可选参数 `listNeed`。

## 7.9.0（2026-10-06）

<!-- bt/gantt15 -->
**甘特默认只看两周，左侧字段变宽**（反馈：「甘特图右侧太宽了，导致左侧的信息都显示不出来。正常情况下只需要显示 15 天的内容」）。只新增 / 放宽导出，没有删除。

- **`GanttView` 新增 `visibleDays?: number`（默认 15）**：默认刻度「两周」（以前叫「月」，值仍是 `"month"`，存过的设置不用改）正好显示 15 天、一天 36px，窗口从锚点前 2 天开始（「今天」在第 3 列，不再贴着左边）；‹ › 一次翻 15 天（以前翻一个月）；标题跨月写「2026 年 9 – 10 月」。「周」刻度在同样宽的时间轴里放 7 天；「季」/「年」不变。
- **左侧默认宽度 = 容器 − 15 天**（以前固定 460px，时间轴把剩下的全占了，1440 屏「月」刻度约 50 天、手机号等列被裁掉）：最少 320、最多约 880px；窄了先把一天压到 28px，再压左侧，窄于 `listBelow` 照旧变列表。左侧各列按字段类型和表头字数定基准宽、随左侧变宽按比例变宽（以前固定宽，「安装负责人」这类五个字的表头会被省略）。宿主传 `listWidth` 或用户拖过分隔条 / 收起左侧后照旧由那个宽度决定、时间轴能放几天放几天；双击分隔条回到默认。传了 `onListWidthChange` 但没传 `listWidth` 时拖动也生效了（以前不动）。
- 拖分隔条时左侧不再带宽度动画（以前跟手有拖影），只有 « / » 收起展开时有。
- 新导出（`@adminui/react/views`）：`GANTT_VISIBLE_DAYS`、`GANTT_LEAD_DAYS`、`GANTT_SPLIT`、`ganttAutoSplit`、`ganttFrame`（类型 `GanttFrame` / `GanttFrameInput`）、`ganttScaleLabel`、`ganttListColumns`；`ganttWindow` / `ganttTicks` 多一个可选的天宽参数，`shiftAnchor` 多一个可选的天数参数。
- starter「系统 → 视图 → 安装排期」左侧多了「手机」列；`test:views` 加：1440 默认正好 15 列、今天在第 3 列、15 天铺满时间轴、左侧 ≥ 600px 且 5 列表头和单元格都不省略、‹ › 翻 15 天、「今天」、拖分隔条后时间轴多放几天、双击复原、收起铺满、周刻度 7 天；单测加默认分栏 / 画面 / 左侧列。

**同事会注意到**：甘特默认只显示 15 天，左侧字段列表明显变宽（1440 屏约 630px，以前 460px），列不再被裁；刻度按钮「月」改叫「两周」，‹ › 一次翻 15 天；打开时今天在第 3 列。截图对比会变。

**风险**：行为变化的导出：`GANTT_DAY_WIDTH.month` 从 25 改成 36、`windowStart(anchor, "month")` 从当月 1 号改成锚点前 2 天、`shiftAnchor(…, "month", …)` 从一个月改成 15 天、`GANTT_SCALE_LABELS.month` 从「月」改成「两周」——自己用这些函数画排期的宿主要看一眼。想要以前「看一整个月」的样子：`visibleDays={30}`（按钮写「30 天」）或传 `listWidth`。

## 7.8.1（2026-10-06）

<!-- bt/flush2 -->
**工作区贴边再补四处**（应用升级 7.8.0 时发现）。只新增 / 放宽，没有删改已有导出。

- **贴边位置里的 `Tabs`**：没设 padding 的 Pane 主体 / RailShell 主区 / WorkspaceLayout 栏里直接放 `Tabs`（带 `children`，用 Tabs 自己的 `role="tabpanel"`）时，标签条贴边（下面不留 16px 缝、一条底线、右端操作留 16px），标签页面板对贴边规则透明：面板里的表格、画册、工具栏、权限部件、提示条和直接放在 Pane 主体里一样贴边；Tabs 是 `Pane fill` / RailShell 主区的最后一块时面板吃掉剩下的高度、面板里最后一块撑满自己滚（表头吸顶、分页贴底）。以前只能把标签条单独渲染、自己写面板，丢掉 `aria-controls` / `role="tabpanel"`——现在可以改回直接用 Tabs。
- **`Pane fill` 窄屏（≤ 1100px）**：以前固定 80dvh，手机上卡片下面留一条灰；现在有撑满栏的工作区卡片至少到外壳内容区底（`WorkspaceLayout` 自己量：窗口底 − 工作区顶 − 外面一圈内边距，新 CSS 变量 `--aui-workspace-fill-height`），撑满的栏长到卡片底，栏高最多仍是 80dvh、内容更高时栏主体滚。纯规则 `workspace-core.ts`（内部，单测 `test/workspace-core.test.ts`）。
- **`Pane` 根元素直通属性**：新类型 `PaneRootProps`；`Pane` 收 `ref`（React 19 ref 当 prop，指向根 `<section>`）和标准 DOM 属性 / 事件（`id`、`className`〔和 `aui-pane` 合并〕、`style`、`hidden`、`aria-*`、`data-*`、`onContextMenuCapture` 等）。`label` 仍优先于 `aria-label`；`data-bare` / `data-padding` / `data-fill` 仍由 Pane 自己设。
- **`LogTimeline variant="operations"` 手机（≤ 760px）不横着滚**：以前整张操作记录最小 880px、在框里横着滚；现在列头收起（本来就是 `aria-hidden`），每条拆成「做了什么 / 操作人 · 时间 · 编号 … 影响 / 动作」，展开的改动明细每格一张小卡（记录 · 字段 / 改前 → 改后 / 这批之后 + 保留 / 退回），明细列头视觉隐藏、仍留给读屏；灰按钮的原因提示在手机上靠左、可换行；类型筛选可换行。
- starter「系统 → 工作区贴边」加「页签」分区（Pane fill + Tabs：画册 / 表格，Pane ref 量栏宽、`onContextMenuCapture` 右键、`data-*`）；`test/flush-checks.mjs` 窄屏加「有 Pane fill 时卡片下面没有灰条、撑满的栏长到卡片底」；`test:page-templates` 加页签分区（tab / tabpanel ARIA、方向键、面板里贴边 / 撑满 / 表头吸顶、ref / data-* / 右键、390×1300 高屏），`test:history` 加 390 操作记录和改动明细不横着滚。

**同事会注意到**：贴边位置里的 Tabs 标签条下面的 16px 缝没了、面板里的内容贴边——为此自己写的 `margin` / padding 覆盖或「标签条单独渲染 + 自己的面板 div」可以删掉。手机上有 `Pane fill` 的工作区卡片变高到内容区底；操作记录在手机上变成多行卡片样子。截图对比会变。

**风险**：Tabs 透明只认**直接放在**贴边位置上的 Tabs（中间多包一层 div 就不算）；想保留标签条下的缝给 Pane 设 `padding`。窄屏撑满高度靠 `WorkspaceLayout` 量出来的值，工作区后面还有别的块时卡片照样只到内容区底、后面的块在下面接着滚。手机上的改动明细表把 `tr` / `td` 改成了 grid / block 显示，Chromium / Firefox 保留表格语义，个别老 Safari 读屏可能按普通文本读。

## 7.8.0（2026-10-06）

<!-- bt/flush -->
**飞书式贴边工作区补齐**（两个应用组反馈：工作区里还有一圈圈卡片、缝和贴着栏边的内容）。只新增 / 放宽，没有删改已有导出。

- **TabbedPage + WorkspaceLayout**：当前分区是工作区时，分区标签条下面不再有 16px 灰缝（标签行贴边、白底、整行一条底线）。修了 7.3 的选择器：`.aui-content` 去内边距只认**看得见的**工作区，TabbedPage 里留着没卸载的隐藏分区不再让同一页的卡片流分区丢掉内边距。
- **`Pane`** 新增 `padding?: "none" | "sm" | "md"`（默认 none，和以前一样贴边；sm = 8px 12px，md = 12px 16px）、`fill?: boolean`（主体变成上下排的一列、最后一块撑满并自己滚，同 RailShell 主区；窄屏上下排时这一栏 80dvh 高）、`notice?: ReactNode`（栏头下的提示条插槽，离栏边 16px）。直接放进贴边主体的 `InlineAlert` 也自动留 16px。
- **`QueryBar`** 新增 `variant?: "card" | "flush" | "bare"`：flush = 平条 + 底线（Pane 头下、贴边表格上面），bare = 没有框和内边距（Pane 头里、`ResourcePanel filters` 里）。工作区里不写 variant 也自动是 flush 样子；放进 Pane 头自动是 bare。
- **工作区里的 `DataTable` / `ResourcePanel`** 去掉外框圆角阴影（以前只有多维表格去了），首列、分页、表格工具栏和栏头一样留 16px。**`ResourcePanel` 直接当工作区一栏**（或 `Pane fill` 的最后一块）时宽屏在栏里自己滚：表头吸顶、分页贴底，标题行和旁边 Pane 头一样高（50px、14.5px 字）。`Pane fill` 里最后一块是 `DataTable` 同样表头吸顶、分页贴底。
- **`GridToolbar`** `features` 新增 `rowHeight`（`false` 去掉「行高」，给看板 / 画册 / 日历 / 甘特当工具栏）；`BitableGrid toolbarFeatures.rowHeight` 同理；新类型 `GridToolbarFeatures`。直接放进 Pane 主体的工具栏两侧 16px。
- **贴边位置里自动贴边**（没设 padding 的 Pane 主体、RailShell 主区、WorkspaceLayout 的栏）：`GalleryView`（根元素多了类名 `aui-gallery-view`）离栏边 16px（手机 12px），当 `Pane fill` / RailShell 主区的最后一块时自己滚（T15 里的画册以前被裁掉、滚不动）；`FormBuilder` 去外框圆角，当一栏时撑满；`TableAccessPanel` 三张圆角卡片变成一条线分开的三栏，工具行带底线，改动提示条离栏边 16px；`AccessProfileHeader` 去外框、留 16px，`EffectiveAccessTable` 筛选行留 16px + 底线、表格贴边；`RecordHeader` 放进 `Pane header` 时是平的（没有浅色渐变块、没有第二条线），放在主体里也不再是渐变块。
- **`useIsMobile(maxWidth = 760)` / `useMediaQuery(query, serverValue = false)` / `MOBILE_QUERY`**（根入口，`media-query.ts`）：`useSyncExternalStore` 实现，服务端渲染安全。SDK 里 `BitableGrid`、`RailShell`、`ModulePermissionEditor` 自己的那几份 matchMedia 也换成它。
- 新样式 `styles/flush.css`（`styles.css` 最后引入，贴边规则写成 `:where()` 不加优先级，靠先后顺序压过组件的卡片样式）；starter 新页「系统 → 工作区贴边」（TabbedPage：客户表 / 画册 / 表单 / 表格权限 / 有效权限 / 记录 / 卡片流）；共用浏览器检查 `test/flush-checks.mjs`，接进 `test:page-templates`、`test:views`、`test:access`、`test:records`、`test:form-builder`（1440 浅 / 深色 + 390，截图 `test/artifacts/*/flush-*.png`）。starter 的 `TableAccessShowcase` / `PersonAccessDemo` 把演示数据导出给新页复用。

**同事会注意到**：工作区（`WorkspaceLayout` 的栏、没设 padding 的 Pane 主体、RailShell 主区）里的 DataTable、ResourcePanel、筛选栏、画册、表单搭建器、表格权限、有效权限、记录头部变成贴边的样子——项目里为此写的 `border:0` / `padding:16px` 覆盖和包在外面的 padding div 可以删掉，留着会多出一圈边距。TabbedPage 里工作区分区的标签行变成白底贴边；同一页卡片流分区的内边距恢复（以前被隐藏的工作区分区吃掉）。截图对比会变。

**风险**：贴边按 DOM 位置判断（组件是 Pane 主体 / RailShell 主区 / 工作区栏的**直接子元素**），中间多包一层 div 就不贴边；想保留卡片样子就给 Pane 设 `padding`。选择器用了 `:has()` 和 `:not(复杂选择器)`（Chromium 105+ / Safari 15.4+ / Firefox 121+）。`ResourcePanel` 当一栏自己滚只在宽屏（> 1100px），窄屏仍是整页滚。

## 7.7.0（2026-10-06）

- `Pane` 头部标题放不下时末尾显示省略号（窄屏操作按钮多时不再压在标题上）；标题文字包在 `.aui-pane-title-text` 里。

## 7.6.0（2026-10-06）

<!-- bt/comment-edit -->
**评论可以编辑 / 删除自己的**（`CommentThread`，样稿 D11 右栏）。只新增，没有删改已有导出。

- `CommentThread` 新增 `canEdit(comment)` / `canDelete(comment)`（宿主判，默认读评论上的 `canEdit` / `canDelete`，没有 = 不给）和 `onEdit(id, body, mentions, { attachments, files })` / `onDelete(id)`。能改 / 能删的评论在操作行末尾出「⋯」菜单（编辑 / 删除）。
- 编辑就地进行，复用同一个输入框：@ 补全、图片 / 文件照常（旧附件可以去掉，新传的走 `onUpload`，没有 `onUpload` 时新文件在第 4 个参数的 `files` 里）；Esc 取消（不会关掉外面的记录详情），Ctrl + Enter 保存，没改动时「保存」灰着；保存失败留在编辑态并提示；结束后焦点回到「⋯」，读屏播报「评论已保存」。
- 「已编辑」改为读 `editedAt`（悬停显示编辑时间），老的 `edited: true` 仍然认；位置从正文末尾挪到作者 / 时间一行。
- 删除先弹 `ConfirmDialog`（显示作者和正文摘要，有回复时写明「回复会保留」），reject 留在确认框显示原因；删完焦点到输入框，读屏播报「评论已删除」。宿主保留墓碑（`deleted: true`）时显示「评论已删除」占位、回复照常显示、没有任何操作；「只看未解决」里没回复的墓碑收起，墓碑不算未解决。
- 纯规则（`comment-core.ts`，根入口导出）：`isEdited`、`commentActions`、`editChanged`、`patchComment`（改一条，顶层或回复）、`removeComment`（`{ tombstone }`）；新类型 `CommentEditAttachments`；`CommentItem` 加 `editedAt` / `deleted` / `canEdit`；`CommentThreadAdapter` 加可选 `update`。输入框拆到内部文件 `comment-composer.tsx`（不导出）。
- starter「记录与字段」：小B 自己的评论可以编辑 / 删除，有回复的删掉留墓碑；浏览器测试 `test:records` 补了菜单、键盘进编辑、@、Esc、失败、保存、删除确认、墓碑、深色、390。

**同事会注意到**：不传 `canEdit` / `canDelete` 时只有评论上带 `canEdit: true` / `canDelete: true` 的才出菜单（以前 `canDelete` 字段没有用到）。「（已编辑）」不再跟在正文后面，截图对比会变。

**风险**：界面上的 `canEdit` / `canDelete` 只决定按钮显不显示，服务端必须再核对作者和权限；是否留墓碑由宿主 / 服务端决定，`removeComment` 只是本地乐观更新的帮手。

## 7.5.0（2026-10-05）

<!-- bt/access-modules -->
**权限按模块组织**（已审定的演示 A1–A6）。只新增导出（`@adminui/react/access`），没有删改已有导出。

- **`ModulePermissionEditor`**：角色页每个模块一行（档位 · 能看到的数据 · 细调情况 · ▸细调）。统一 5 档 无 / 只看 / 成员·只看自己的 / 成员·按范围看 / 管理员；档位下拉带说明、授不出的档灰掉写原因、底部写模块没有的档；「自定义」；用不了的模块整行灰 + 去处；改过的行打点 + 改动条；「系统管理」小节；细调（加 / 去掉〔升级不加回〕/ 新高危权限待确认 给·不给 / `minLevel` 锁住 / 字段 隐藏·只读·可编辑 / 恢复成档位默认）；集团只读横幅 +「复制后修改」；≤ 760px 卡片 + 全屏细调。
- **`DataScopeSelect`**（范围下拉，「指定部门…」走 `DataScopeDialog`）、**`PermissionDiff`**（保存前改动 + 影响 + 数据变了提醒 + 原因必填）、**`EffectiveAccessView`**（预览 / 诊断：选人、最终档位、来源标签、明细表）。
- 纯规则 `src/access/module-core.ts`：`levelOf` / `nearestLevel` / `normalizeGrant` / `toggleAction` / `resolvePending` / `setLevel` / `resetToLevel` / `setScope` / `setFieldMode` / `grantChips` / `diffModuleGrant(s)` / `changeSummaryText` / `pendingCount`（菜单上的待确认数）/ `impactSentence`；数据形状对齐常见的按模块授权后端（对照见 ACCESS.md §7.1）。
- 新样式 `styles/access-modules.css`（`styles.css` 末尾引入）；单测 `test/access-modules-core.test.ts`；浏览器测试 `npm run test:access-modules`；starter 新页「系统 → 权限按模块」。

**同事会注意到**：范围显示名默认沿用 SDK 的「仅本人 / 本部门及以下」，要写成「本人 / 部门及下级」时传 `scopeLabels`。「成员·只看自己的」不给选范围（固定本人）。细调里的动作用**动作键**（`资源:动作`），宿主要把分范围的码（带 `_own` / `_tree` 后缀）和动作键互转。

**风险**：编辑器只按宿主给的 `grantable` / `minLevel` 灰掉，授权上限、编译、影响都必须由服务端再算；`pending` 里的动作在界面上算「没有」，宿主的存储要一致。

## 7.4.0（2026-10-05）

<!-- bt/datepicker -->
**日期 / 时间选择**（样稿 D10 甘特设置「补班日」、D18 公开表单日期题、D24 表时光机、D04 筛选日期条件）。新增导出，没有删改已有导出。

- **`DatePicker`**（`YYYY-MM-DD`）、**`DateTimePicker`**（`YYYY-MM-DDTHH:mm`，`minuteStep`、`defaultTime`）、**`TimeInput`**（`HH:mm`）、**`DateRangePicker`**（`{ from, to }`，`presets` + `dateRangePresets([...])`，桌面两个月 / 手机一个月）、**`CalendarButton`**（「+ 添加」点开日历挑一天）、**`Calendar`**（月份方格）。值格式和它们替换的原生输入框一模一样。框长得像 `Input`、能直接打字（`2026-10-05`、`2026/10/5`、`10/5` = 今年），完整日期边输边生效，其它写法 Enter / 失焦生效，越界退回并标红；日历走 `PopoverLayer`（弹框里挂在弹框内），键盘全套（方向键 / PageUp / PageDown / Home / End / Enter / Esc），ARIA 是 dialog + grid（`aria-selected`、`aria-current="date"`、中文日期名）。`min` / `max` / `isDisabledDate` / `holidays`（休 / 班，宿主给，SDK 不带日历）/ `weekStart` / `clearable` / `size: sm | md | touch`。纯规则 `date-picker-core.ts`（`parseDateText` / `parseTimeText` / `parseDateTimeText` / `monthMatrix` / `dateRangePreset(s)` …）。
- **SDK 里的原生日期框全部换掉**：权限部件和治理页的到期 / 截止（`ExpiryField`、成员、申请、复核、规则、记录团队、申请列表、条件值里的时间字段）、看板筛选条自定义范围（`DateRangePicker`）、表单填写页日期 / 日期时间题、审计日志起止日期、表格筛选的日期条件（具体日期 + 自定义范围）、报表起止日期、表时光机日期 + 时间、甘特设置「补班日」（改成「+ 添加」日历按钮，已加的标「班」）、分享弹窗自定义失效时间、访客页日期字段原地编辑；`BitableGrid` 的 date / datetime 格内编辑器换成文本框 + 日历（`grid-editors-date.tsx`）。starter 的两处到期框也换了，新页「系统 → 日期选择」。
- `PopoverLayer` 新增可选 `initialFocus`（false = 打开不抢焦点）和 `focusTarget`（Tab 离开时落到哪），在 `Dialog` 里自动把高度限制在弹框内（内容自己滚，不再被裁掉底部）。
- `admin-ui-audit` 新规则 `native-date`（提醒，不拦门禁）：`<Input type="date | datetime-local | time | month | week">` 提示换成 DatePicker 家族。
- 新样式 `styles/date-picker.css`（`styles.css` 末尾引入）；浏览器测试 `npm run test:date-picker`；单测 `test/date-picker-core.test.ts`。

**同事会注意到**：日期时间框显示成「2026-10-05 14:30」（中间是空格），但 `value` / `onChange` 仍是 `2026-10-05T14:30`；浏览器测试里读 `inputValue()` 的断言要按显示格式改。点日期框只弹日历不抢焦点，可以接着打字；↓ 才进日历。访客页日期字段原地编辑时 Enter 不再直接保存（要点「保存」），文本字段不变。看板筛选条的自定义范围从两个框变成一个范围框（读名仍是「开始日期」「结束日期」）。

**风险**：值是墙上时间，组件不换算时区（和原生框一样），时区仍由宿主决定；`DateTimePicker` 选天时没有已有时间就用「现在」按步长取整（可给 `defaultTime`）。原来依赖原生框 `min` / `max` 弹浏览器提示的地方，现在是标红 + 失焦退回。审计日志的起止日期互相限制（开始不晚于结束）。
## 7.3.0（2026-10-05）

工作区贴边（宿主项目的知识库 / 多维表格反馈「栏之间空隙太丑」，对标飞书）：

- **`WorkspaceLayout`（T10）**：宽屏下贴住工作标签条、侧栏和窗口边（外壳内容区自动去掉内边距），栏与栏之间只用一条线分开；栏里的 `Pane` 不再有圆角 / 阴影 / 外框；`bottomGap` 默认 24 → 0（一直到窗口底）。窄屏（≤ 1100px）上下排时整块是一张卡片，栏之间横线分开。
- 工作区里的 `BitableGrid` / `DataGrid` 表格面板也贴边（去外框圆角），页内标签条（`Tabs`）下不留 16px 缝。
- `Pane` 头不再被纵向布局压扁（`flex:none`）：头里放两行控件（空间下拉 + 工具）时不会被切掉上半截。

**同事会注意到**：用 `WorkspaceLayout` 的页面外圈的灰边和栏间缝没了；自己传了 `bottomGap` 的不受影响。

## 7.2.1（2026-10-05）

本项目接入 7.2.0 时发现的小问题：

- `FieldDialog`：类型、选项填错时，保存后焦点落到出错的地方（以前只认名称）；没有右栏时类型格子不再把四个字的类型名截成「多行…」。
- `newOptionId`：随机撞号 1000 次后的兜底也保持 `o` + 5 位的格式（以前会更长，服务端按格式校验会拒）。
- `GrantList`：列表模式的头像取首字按字符取，不会把生僻字 / emoji 切成半个；说明：行里的小字固定是「类型 · hint」，宿主的 hint 不要再自带「人 ·」之类前缀。

## 7.2.0（2026-10-06）

> 版本号说明：7.1.0 曾被另一次改动（明快色卡）占用后撤回、标签已删，为免混淆本次直接发 7.2.0；内容是第三期标准化 + 全量审计修复。

多维表格样稿标准化第三期：页面模板 T15 表格工作区 / T16 公开页 / T17 看板搭建器、`RailShell` / `NavTree` / `WorkspaceTitleBar`、触屏尺寸变量、共享的嵌套条件编辑器 `ConditionTreeEditor`（表格筛选、权限、规则共用）、表单搭建器与公开填写页（子路径 `form-builder` / `forms-public`）、录音文字稿、规则列表、看板搭建器（子路径 `dashboard-builder`）。全部是新增导出，没有删改已有导出。

**同事会注意到**：全局按钮重置规则降了优先级（`:where()`），以前被它盖掉的组件自带文字颜色恢复成设计里的颜色（侧栏灰字、「?」图标和拖动把手变灰、分段控件未选中项变次要色、录音按钮上的图标变白等，细节见下面 bt/templates 一节）；菜单只在自己的锚点滚动时才关；分享弹窗「指定的人」默认换成 `GrantList`；表格权限面板的「按条件」默认换成嵌套条件编辑器。


<!-- bt/builders-b -->
**录音文字稿、规则列表、看板搭建器**（第三期 A1 / A5 / D9，样稿 D27t / D26 / D32）。全部是新增导出，没有删改已有导出。

- **`TranscriptViewer`**（根入口）：录音 + 分好说话人的文字稿。波形按说话人上色（宿主 `peaks`）+ 说话人条 + AI 标注钉（点了跳）；播放 / 空格、±15 秒、倍速、跳过静音、`focus`「只听客户」、键盘拖进度；文字稿点时间跳转、跟着播放滚动（自己滚动就暂停跟随，出「回到正在播放」）、标注小签、打码小块 + `onReveal` 留痕查看（30 秒后自动打码）、「跳过 N 秒静默」分隔、搜索；右栏摘要（可点的时间点）、说话占比、导出 / 复制全文（打码后的文字）。纯规则 `transcript-core.ts`（`segmentIndexAt`、`talkShare`、`findSilences`、`splitSegmentText`、`searchTranscript`、`transcriptText` …）。
- **`RuleList`**（根入口）：从上往下匹配、第一条命中就停的「如果 … → …」规则列表，拖动 / 键盘排序、命中数、开关、⋯（修改 / 复制一条 / 删除）、固定的兜底规则；修改在 `SideSheet` 里，条件用表格的 `GridConditionTree`（可换），「然后」由宿主画。新纯函数 `describeConditionTree` / `conditionTreeParts`（`condition-describe.ts`）：把条件树读成白话（「来源 = 官网 且 地区 是 台北、新北」）。
- **`DashboardBuilder`**（新子路径 `@adminui/react/dashboard-builder`，依赖 echarts 可选 peer，同 `/charts`）：组件库 + 6 列画布（拖动 / 改大小 / 键盘、选中工具条、撤销重做）+ 组件设置（数据源、标准 / 自定义口径、分组、对比、粒度、图表类型、自己的条件 + 继承看板筛选），预览、保存 / 另存为我的，手机只读预览。看板是 JSON（`DashboardSchema`，`normalizeDashboard` 读存档）；组件用现有看板部件画，数据由宿主 `loadWidgetData` 给。`DashboardView` 只读渲染。纯规则 `dashboard-builder-core.ts`。
- `AudioWaveform` 新增可选 `colors`（每根柱子的颜色，文字稿用来按说话人上色）；`media-audio.tsx` 的「同时只放一个」`claim` 改为导出给文字稿用（不进根入口）。
- 新样式 `styles/transcript.css`、`styles/rule-list.css`、`styles/dashboard-builder.css`（`styles.css` 末尾引入）。starter 新页「系统 → 录音文字稿」「系统 → 分配规则」「看板 → 看板搭建」；浏览器测试 `npm run test:transcript`（含 RuleList）、`npm run test:dashboard-builder`。

同事会注意到：没有已有页面变样子（只加新组件）。风险：`DashboardBuilder` 的 `value` 只在挂载时读一次，换看板要换 `key`；`loadWidgetData` 返回的 `kind` 要和组件类型对得上（`bar` / `targetBar` 共用 `bar`），对不上组件里会写出来。


### bt/builders-a：嵌套条件编辑器、表单搭建器、公开填写页（第三期 P1、V9、V10）

- **通用条件编辑器 `ConditionTreeEditor`**（根入口，加 `ConditionValuePicker`）：表格筛选 / 填色的 `GridConditionTree` 改成它套上表格字段（外观、行为、可访问名称不变）；治理页 `CondBuilder` 也改用它。
- **`CondBuilder` 能写条件组**（每组自己的全部满足 / 任一满足，默认嵌套 1 层、50 条，`limits` 可改；`density="compact"` 是 D13 样子）。`CondDraft` 多一个可选的 `groups`，没有组时形状不变；`condToDraft` 现在能读嵌套 and / or（以前返回 null），`draftToCond` 递归校验、空组报错。新导出（`@adminui/react/access`）`condDraftToTree` / `treeToCondDraft` / `condRowToCondition` / `conditionToCondRow` / `countDraftRows` / `draftKey`。
- **新子路径 `@adminui/react/form-builder`**：`FormBuilder`（样稿 D08，三栏：字段列表拖进 / 拖出、题目块 + 设置条 + 显示条件、收集设置：提交次数限制含每周 / 每月、需要登录、允许修改、通知、谁能填、链接 / 二维码 / 预填链接、催填、停止收集）和全部纯函数。
- **新子路径 `@adminui/react/forms-public`**：`PublicForm` / `FormBrand` / `FormSuccess`（样稿 D18 / D18m / D18s）、`FormQuestionInput`、`FormUploadQuestion` 和可见性 / 校验 / 摘要 / 预填函数。
- 新样式文件 `styles/builders.css`、`styles/forms.css`（经 `styles.css` 引入）。

**同事会注意到**

- **`ShareDialog`「指定的人」默认换成 `GrantList mode="picked"`**（已选的人 + 搜索添加），不再是整列表打勾；自己传 `peoplePicker` 的不受影响。
- **`TableAccessPanel`「按条件」默认编辑器变紧凑**（D13：行间「且 / 或」小胶囊，可加条件组）。
- **治理规则编辑器**：有选项的字段，值从下拉框 / 一排胶囊变成一个胶囊选值框（「当前用户」等在选项上面）；条件下面多了「添加条件组」；「全部满足（且）/ 任一满足（或）」改成「符合以下 全部满足 / 任一满足 的条件」。

**风险**：`GridConditionTree` 内部换了实现（DOM 里条件行变成 `ol > li`，类名不变）；改了 `grid-condition-editor.tsx`、`access/governance/cond-*.ts(x)`、`access/table-access-panel.tsx`、`share-dialog-sections.tsx` 各一小处；quanxian 的 `Cond` 没有相对日期，所以治理条件不给相对日期。


### bt/templates：T15 表格工作区 / T16 公开页 / T17 看板搭建器、触屏尺寸变量、第二期遗留修补（第三期 L1、L2）

**做了什么**

- **三个新页面模板**（`PAGE_TEMPLATES` T15–T17、PAGE-TEMPLATES.md、starter `#template=…` 整页示例）：
  - T15 表格工作区（样稿 D01）：`RailShell`（56px 平台图标栏 + 可收起的目录 + 工作区，整页不滚；手机图标栏变底栏、目录变抽屉）、`NavTree`（文件夹 / 数量 / 搜索 / 键盘 / 新建）、`WorkspaceTitleBar`（表名 · ? · ☆ · 业务线胶囊 · 正在看的人 · 工具 · 分享 · ⋯）、`ScopePill`；纯规则 `rail-shell-core`（`filterNavTree`、`visibleTreeIds`、`nextTreeId`、`railBottomNav` …）。
  - T16 公开页（D18 / D18m / D18s / D21*）：`PublicPageLayout`（品牌条 + 居中一栏 688 / 440 + 进度，手机吸顶）、`PublicResult`（提交成功 / 已失效）；访客页、密码门仍用 `SharedPageShell`。
  - T17 看板搭建器（D32）：`BuilderLayout`（顶栏改名 / 撤销 / 重做 / 预览 / 保存 + 筛选行 + 组件库 | 画布 | 设置三栏）。
- `BitableGrid` 新属性 `toolbarLeading`（`GridToolbar leading`）：工具栏最左放「添加记录 ▾」。
- 触屏尺寸变量 `--aui-control-height-touch`（44px）进 `tokens.css`；`HoldToTalk`、分享公开页的滑块框改用它（之前在 `share.css` 里定义、别处写死 44px）。
- `GanttSettings` 颜色依据加「按条件」：就是表格填色的规则（`GridColorRule`，条件树 + 7 色，只按整行），`GanttConfig.colorRules` + `GanttView conditionContext`；视图子路径新导出 `viewColorBasis`、`viewRecordTone`。填色面板的规则列表拆成内部组件 `GridColorRules`（表格的「填色」面板外观不变）。
- `ViewGroupLevel` 改成表格 `GroupLevel` 的别名（`asc` / `desc`；单选字段 `asc` = 按选项顺序、`desc` = 选项倒序），旧值 `order: "option"` 读成 `asc`。
- `Menu` / `ContextMenu` 只在它所属的元素（锚点、右键的卡片 / 格子，新可选属性 `origin`）被滚动时才跟着走或关闭；别的看板列、页面别处滚动不再把菜单关掉。
- 全局按钮重置 `.adminui :where(button):not(…)` 改成整条 `:where()`（优先级 0,4,0 → 0,1,0），组件自己的颜色规则直接生效；视图子路径去掉 `--vbc` 绕法。
- AI-RULES：§0.1 套件清单收进第一、二期的新组件（每类一行，新增第 12–16 类），附录按 A–M 顺排（修掉重复的「附录 D」和多维表格菜单那一节正文错位）；AGENTS.md「改哪里跑哪个」补 `test:share` 和 T15–T17 两行。

**同事会注意到**

- **一批组件的文字颜色变成它们设计时写的颜色**（按钮重置不再压住组件规则，和已审定的样稿一致）：侧栏菜单项平时是浅一档的灰绿、悬停 / 当前才是白字；「?」说明、表格行的拖动手柄、横向滚动箭头、复制小按钮、上传方块变成备注灰；分段选择未选中的项是次要色、选中的是深主色；分区标签当前项是主色；录音大圆键上的图标变白；KPI 卡的下钻、汇总卡的下钻、引用小标变主色；公开页底部「内容有问题？」变链接色。都是组件 CSS 里本来写好的颜色，以前被重置盖住了。
- 「页面模板」菜单从 14 项变 17 项；PAGE_TEMPLATES 多了 T15–T17（demo 指向模板截图）。
- 看板 / 日历 / 甘特里打开的右键菜单，滚动别的列或页面别处时不再自动关闭。

**风险**

- 宿主如果靠全局按钮重置把自己写的 `.aui-*` 子元素按钮颜色压成继承色，现在会显示 SDK 组件里写的颜色——这是本来的设计；真要回到旧样子只需把 `controls.css` 第 6 行改回原选择器。
- `GanttSettings` 的 `groups` 类型从 `"asc" | "desc" | "option"` 收窄成 `"asc" | "desc"`（只在本期未发版的视图子路径里出现过，宿主没有存量）。
- `ui-audit` 的模板骨架块加了 `RailShell` / `BuilderLayout` / `PublicPageLayout`，提示文字改成 T01–T17（只影响 no-template 提醒）。

<!-- bt/fix-base -->

**审计修复（基础部件 / 媒体 / 看板 / AI / 外壳）**

- `useAudioRecorder`：麦克风授权框还开着时取消、卸载或再点一次开始，迟到的音轨现在立刻关掉（以前麦克风一直亮、计时器往已卸载组件里写状态）；等授权期间再点开始不起作用；卸载时清掉结果链接。
- `SourcedAnswer` / `CitationChips`：出处链接只放行 http(s)、mailto 和相对地址，`javascript:` / `data:` 不再能被点开（新纯函数 `safeCitationHref`，在 `ai-core`，未进根入口）。
- `CohortTable`：全是 0 的留存表显示 0（最浅底色），不再整表「未到期」；只有缺值才是未到期。`cohortShade(v, 0)` 从 null 改为最浅档。
- `encodeFilterContext(..., { full: true })`：清成「全部」的默认维度也写 `key=`，服务端不会再把默认值套回去。
- `DashboardFilterBar`：自定义区间的两个日期框跟着 value 变（浏览器后退、重置、套用我的筛选）。
- `Countdown`：到点只调一次 onExpire（以前宿主每次重渲染传新的 `now` 就会反复触发）；只有截止时间变了才重新计。
- `NumberStepper`：Home / End 先丢掉没提交的草稿再跳到最小 / 最大值。`CodeInput`：剪切、输入法、右键删除把一格清空时和退格一样截掉后面的格。
- `formatTimeLeft`：先取整到分钟再拆，不再出现「剩 60 分钟」「1 小时 60 分」。
- `PromptEditor` 底部「用到的变量」显示 `{{变量}}`（以前少一层括号）。
- `.aui-chip[data-tone=solid]`、`AvatarStack` 头像字色改用新 token `--aui-on-primary`（白；色卡保证主色实底对白字 ≥ 4.5:1）。
- `RailShell` 目录键盘：搜索时跳过（已禁用的）文件夹、跳过禁用的行，上下键不再卡住。
- `useUploadQueue` 的 `maxFiles` 只数等待 + 上传中的文件；被拒、失败、取消、已完成的不再占名额（新纯函数 `uploadRoom`）。
- `MediaGallery` 条状模式「+N」打开隐藏部分里第一个能预览的；都不能预览时按钮禁用。

- 视觉审计：没缩略图的视频方块只画播放圆钮（不再和类型图标叠在一起），上传中的方块只留「上传中 N%」；柱图对目标（`targetBarOption`）图例色块和柱子同色，目标刻度紧贴柱顶时数值往上让开，超过 8 格（一天的小时）时进行中的柱子标数值而不写「进行中」；`StepFunnel` 宽度 ≤ 380px 时改成一栏（名字在条上、转化率和「流失最多」在条下）；`RollupCard` 小指标的名字和灰字可占两行；附件文件名中间省略、扩展名始终看得见（「报….xlsx」）；漏斗条内数字用 `--aui-on-primary`。
- starter「团队今日」：1440 下每人表格收紧列宽 / 表头（右栏 256px、疑似刷数标签移到第二行），不再横向溢出；KPI 卡说明文字缩短不折行。

**风险**

- `maxFiles` 语义放宽：以前「列表里最多 N 行」，现在是「同时在途最多 N 个」；宿主若靠它限制总数，需要自己在 onUploaded 里计数。
- 依赖 `cohortShade(x, 0) === null` 的宿主代码会拿到 `{ percent: floor }`。
- `AudioRecorder autoStart`：开发模式（StrictMode）下组件先卸再装，第一次申请的麦克风被丢掉后不会再申请、一直停在「正在请求」——改成每次挂载都申请（`start()` 本身防重复）。

<!-- bt/fix-records -->
**审计修复（记录 / 分享 / 权限部件）**

- 记录详情：上一条 / 下一条切换时，上一条「查看」出来的明文（手机等）立即打码，不再显示在下一条的方块上；切走前发出、切走后才回来的查看结果直接丢弃。`useSensitiveReveal` 多了可选 `scope`（值属于谁，变了就清掉）。
- `SecretReveal`：剪贴板清空计时挪到整页，倒计时到点隐藏字段后照样按时清空；离开页面时如果还没清，立即清。提示文字改成「剪贴板尽量在 60 秒后清空」（浏览器没焦点时可能清不掉）。
- `ShareDialog` 策略执行：切到要求密码的「谁能打开」时自动生成密码；`applySharePolicy` 按 `policy.capabilities` 把被禁止的「能做什么」降到允许的一档（可编辑 → 可评论 → 只能看），字段的「可改」跟着去掉。自定义有效期按 `timeZone` 填写和显示（以前按浏览器时区填、按 `timeZone` 显示，两边对不上）。
- `GrantList mode="picked"` 传了 `searchSubjects` 时，服务端返回的人不再按文字二次过滤（拼音、邮箱查到的人不会被丢掉），只去掉已选 / 锁定的。
- 权限控制台「按人员 → 修改个人加减」：目标锁住时「可读 / 可读写」也锁住；改动判断包含目标本身。
- `CommentThread` 新增 `open`（服务端的未解决总数，分页时用），不传时仍按已加载的评论数。
- 文档：AI-RULES / catalog 里「指定的人」默认部件改正为 `GrantList mode="picked"`（以前写成 `SharePicker`）。
- starter「记录与字段」演示多一条客户（王美玲），用来验收切换记录时的打码。
- 视觉对照样稿：记录详情 / 访客页里打码的手机号不再换成小一号的等宽字（和其它值同字号，数字等宽）；`FieldTile` 的 `tone`（如「下次跟进」）不再整块填色，改成提示文字的浅色小标签（没有提示时值变色）；表格就地权限「技术看不到」的行在深色下改成浅色底；「按人员」有效权限的筛选条排成一行（搜索 · 结果 · 两个勾选 · 来源标签），列宽收紧到 1440 宽下不用横向滚动，拦截原因不再被固定的「操作」列盖住（权限名太长省略，悬停 / 展开看全）；分享弹窗「谁能打开」方块文字不再截断。

**风险**：分享弹窗自定义有效期如果宿主的 `timeZone` 和用户浏览器时区不同，同一个输入会得到不同的时间点（现在才是对的）；`applySharePolicy` 可能多返回一条「能做什么」的改动说明。
<!-- bt/fix-views -->
- 审计修复（视图 / 表单 / 看板搭建器 / 模板）：
  - 看板搭建器：存档里 `y` 极大（如 1e12）不再卡死页面——`clampLayout` 把 `y` 限在 0–10000，`compactLayout` 直接算出上浮到哪一行（不再一行行往上试）。组件库格子和标准组件名字太长时折成两行，不截成「柱图 vs...」；三栏宽度改成样稿的 232 | 画布 | 324。
  - 甘特：工期按工作日算（`endMode` duration / fixed + `workdaysOnly`）时，整条拖动 / ← → 保持工作日数，跨周末顺延（以前按日历天平移，工期变短）；`endMode: "fixed"` 不再显示两端拖柄、Shift / Alt+← → 不改两端；季刻度的周按 `weekStart` 分；左侧「收起」圆钮挪到表头下面，不再压住最后一列列名。`dragSpan` 多了可选第 4 个参数，`ganttTicks` 多了可选 `weekStart`。
  - 日历：周 / 日视图里很短的事件（10:00–10:05）显示时仍拉到 15 分钟高，但拖动 / 键盘移动、改时长和时间文字都按真实结束时间（`TimedPlacement.realEndMin`），不再把 5 分钟改成 15 分钟；全天 / 跨天条支持 Alt+← / → 和菜单「提前一天 / 推后一天」；有 `onCreate` 时日子列是一个 Tab 停点（← / → 换天），Enter 在可见区第一格新建；此刻时间标签盖住整点标签时整点标签让开。月视图事件条通过 `aria-owns` 归到开始那天的格子里（ARIA：row 里只有 gridcell）。
  - 看板：没有 `onOpen` 时可移动的卡片本身能拿焦点，Alt+方向键照样能移；乐观移动按卡片分别记，一张卡的确认 / 记录刷新不再把另一张还在路上的移动冲掉（以前可能闪回原列，`test:views` 偶发失败的根因）；卡片字段按 `GridField.tone` 上色（逾期日期异常色）；没有附件的卡片不再留「没有附件」封面。画廊卡片最小宽度 220 → 200（1440 下 5 列）。
  - 公开表单：附件题 `upload.maxFiles` 真正生效（已上传的不在队列里，现在按剩余名额收，满了按钮灰掉并提示），`checkFormAnswer` 也检查文件个数；预填链接隐藏的题（`hide_`）没通过校验时自动显示出来让访客改，不再静默挡住提交；手机上删除角标、失败重试、取消 / 移除的点按区 ≥ 44px；`PublicForm` / `FormSuccess` 铺满视口、用页底色（深色下不露白边，搭建器里的填写预览不受影响）。
  - starter：T16 填表 / 提交成功换成真实的 `PublicForm` / `FormSuccess`（新增 `#template=t16-expired` 演示 `PublicPageLayout` + `PublicResult`）；T17 换成真实的 `DashboardBuilder`（和「看板搭建」示例同一份数据），原来的 `BuilderLayout` 框架页挪到 `#template=t17-frame`；分配规则编辑弹层「分法」改成一栏不折行；T17 框架页 KPI 百分点改用比率。
  - RuleList 默认条件编辑器本来就是嵌套的 `GridConditionTree`（基于 `ConditionTreeEditor`），没有改。

**同事会注意到（bt/fix-views）**

- T16 / T17 模板页现在显示真实组件；`test/page-templates.mjs` 的 T17 断言改成 DashboardBuilder（改名 / 撤销 / 重做 / 组件设置），BuilderLayout 的断言跟着挪到 `t17-frame`。
- 周视图的日子列多了一个 Tab 停点（只在传了 `onCreate` 时）；月视图事件条多了 `id`。

**风险（bt/fix-views）**

- 宿主若自己读 `TimedPlacement.endMin` 当事件结束时间，要改读 `realEndMin`（`endMin` 只是显示高度）。
- 看板乐观移动在宿主确认后、记录还没刷新前会保留；宿主 `onMove` resolve 之前就更新了记录的，行为和以前一样。
<!-- bt/fix-grid -->
**多维表格审计修补**（单测 `test/grid-audit-fixes.test.ts`）

- **安全**：`buildGridSql` / `groupColumnSql` 里单选的选项排序字面量按方言转义（MySQL 反斜杠也转义，新导出 `sqlStringLiteral`），用户自建的选项值不能再拼出 SQL。`sortExpr(column, dialect)` 现在必须传方言。
- **条件不再被静默丢掉**：人员 / 多选条件在标量列上（如 `owner_id`，「负责人 是 我」）按 `IN` 查；数组列在非 PG 方言、多选存成标量列等表达不了的完整条件一律 `1 = 0`（以前直接丢掉，返回全部数据）。动态值解析成空列表（「我的下属」没有人）时：「不是 / 不含 / 都不是」保留全部行，其余为假；前端 `hasAll` 空列表也改成不匹配，前后端一致。
- 服务端分组：父组自带条数、子组被 `maxGroups` 截断时，后面的组 offset 不再前移（行对不上组头）；`gridGroupsFromSql` 给数字 / 金额分组加了显示名（金额不再显示成「分」），`GridGroupSqlLevel` 多一个 `field`。
- 填充柄：数字列没有 `precision` 时按源值的小数位取整（不再出现 12345679.000000002）；横向填充遇到打码列（`mask`）跳过并说明，不复制打码后的文字。
- `describeConditionTree` / `conditionTreeParts` 按公式的结果类型判断条件，`restricted` / `filterable: false` 字段的条件标为不生效；`DescribeField` 多了可选的 `resultType` / `restricted` / `filterable`。
- **对话框里的弹层不再被裁掉**：对话框是 `overflow: hidden` 且有 `transform`，弹层（选值框、菜单、面板）现在在对话框可见范围内翻转 / 收拢（以前按视口放，伸出对话框的部分被裁掉，点选项时被遮罩挡住——治理页共享规则编辑「条件 1 · 值」）。锚定弹层左对齐放不下时改右对齐、右对齐放不下时改左对齐（`CellHistoryPopover` 不再被推到页面最左盖住侧栏）。
- `PopoverLayer` / `PopoverPanel`：Tab 出最后一个、Shift+Tab 出第一个控件时关闭并回到锚点。菜单里右键 / Shift+F10 / ContextMenu 键不再让外层 `ContextMenu` 重开；悬停打开的子菜单按 → / Enter 落到第一项。
- 表格：评分编辑器值被拒后可以再改（以前锁死）；附件 / 关联字段没有 `openEditor` 时不进入空的编辑状态；分组统计按分组树缓存；填充柄 / 行拖动中途卸载不提交；`height="fill"` 在被 flex 撑高的容器里（RailShell 工作区）真正撑到窗口底（以前留 80px 空白）；滚动区带 `scroll-padding`（表头 / 统计行高），键盘和 `scrollIntoView` 不再把行停在吸底统计行下面。窄屏（≤ 520px）工具栏收成一行左右滑动。
- `CellHistoryPopover` 的 `onClose` 带 `returnFocus`：只给 `anchorRect` 时，Esc / ✕ 由宿主把焦点放回格子。
- `CellTags` 的旧 `color` 不再画原始颜色圆点，没给 `tone` 时按色相换成最近的 7 色之一（新导出 `colorTone`）；`CellPeople` 改成实心头像 + 名字（样稿 D01），不画药丸边框。
- 7.0 升级指南里 `addGridFilter` 的写法改正为 `addGridFilter(tree, field, group?)`。

同事会注意到：人名单元格没有边框了；手机上表格工具栏只占一行；带 `color` 的标签颜色变成主题色系。风险：直接调 `sortExpr` 的后端要补方言参数（编译期报错）；以前「负责人 是 我」在标量列上被丢掉而返回全部数据的列表，现在只返回自己的记录。

## 7.0.0（2026-10-06）

多维表格样稿标准化第二期：多维表格视图 v2（嵌套筛选、三级分组含服务端、排序 / 字段面板、填色、个人设置条、表头 / 单元格 / 分组菜单、冻结线、填充柄、行操作、12 种新字段类型）、新子路径 `@adminui/react/views`（视图标签与管理、看板、画册、日历、甘特、视图设置）、记录与字段（新建字段弹窗、评论、子表区块、表的就地权限、授权列表）、对外分享套件与单元格修改历史。

**为什么是大版本**：BitableGrid 的视图结构变了（下面的升级指南），记录详情一个类型变成可选。存下来的旧视图、旧 `defaults` 会自动迁移，只有直接读写这些字段的代码要改。

### 升级指南（7.0）

| 旧写法 | 新写法 |
|---|---|
| `view.filters` + `view.conjunction`（扁平条件） | `view.filter`（条件树：`{ conjunction, items: [条件 \| 条件组] }`）；取树用 `gridFilterTree(view)`，加条件用 `addGridFilter(tree, field, group?)`（返回新树，写回 `view.filter`）/ `patchGridFilter(tree, id, patch, fields)`，判断用 `evaluateConditionTree` |
| `view.groupBy`（字符串或 null） | `view.groupBy`：`GroupLevel[]`（`[{ field, order }]`，最多 3 级）；只想知道按不按某字段分组用 `isGroupedBy(view, key)`，取第一级 `view.groupBy[0]?.field` |
| 服务端只认扁平 `GridQuery.filters` | `GridQuery.filter`（条件树）/ `groups`；后端用新版 `parseGridQuery` / `applyGridQuery` / `buildGridSql`，分组用 `GridDataSource.loadGroups` + `applyGridGroups` / `buildGridGroupSql`。**前后端一起升级**，否则嵌套筛选在服务端不生效 |
| 条件里的「我」由前端填用户 id | 动态值 `me` / `mySubordinates` 由宿主 `conditionContext` / 后端 `resolve` 解析；解析不出 = 条件为假（不会放开） |
| `gridColumnDefs` / `gridTableState` 做分组 | `groupTreeFromRows` + `groupLayout`（TanStack 只负责排序） |
| `RecordFieldAction.onSelect` 一定有 | 变成可选（动作可以是链接 `href`）；直接调用要写 `action.onSelect?.()` |
| `frozenColumns` 属性固定冻结列 | 仍是默认值；用户拖冻结线的结果存在 `view.frozen` |

**同事会注意到**

- 表格工具栏的按钮顺序、文字按样稿来（筛选 / 分组 / 排序 / 填色 / 字段 / 行高），多了「填色」；单选的条件「是其中之一 / 不是其中任何一个」改叫「是 / 不是」。
- 表头的列菜单变成真正的菜单（升序 / 降序、冻结到这里、移动字段、按此字段筛选 / 分组…），冻结边从阴影变成 2px 主色浅线，▾ 悬停才显示，展开记录的图标挪到主字段格子里。
- 分组可以三级，服务端模式也能分组（以前服务端模式静默不分组）。
- `SharePicker` 内部换成 `GrantList`（接口、外观不变）；`SensitiveValue` 新增查看留痕与自动遮回（`onReveal`、`remaskAfter`）。


### bt/grid-a：多维表格视图 v2——嵌套筛选、三级分组（含服务端）、排序 / 字段面板、填色、个人设置条（样稿 D01 / D04 / D05 / D17 / D17b，工作项 G2–G6、G13、G14）

- **条件模型 v2**（`condition-core.ts`，根入口和 `grid-query` 都导出）：条件树 `ConditionGroup`（全部满足 / 任一满足、条件组嵌套默认 1 层、最多 50 条，都是可改的默认值）；动态值 `{ dynamic: 'me' | 'mySubordinates' | 宿主自定义 }` 由宿主 `resolve`（解析不了 = 不匹配）；相对日期（今天、本周、上月、过去 N 天、未来 N 天…，时区和一周从周几开始是参数）和固定范围；每种字段 kind 的运算符（含评分）；规范化 / 编辑 / 求值 / `conditionTreeSql`。以后治理 CondBuilder 也用它。
- **`GridView` 新形状**：`filter`（条件树，替代 `filters` + `conjunction`）、`groupBy: GroupLevel[]`（替代单个字段名）、`showEmptyGroups`、`autoSort`、`fieldGroups`、`colors`。存着旧形状的视图（localStorage、宿主接口）和旧的 `defaults` 自动迁移，一级分组的折叠状态保留。`GridField` 新增 `restricted`、`group`。
- **筛选面板 v2**：条件组、可搜索的字段框（类型图标、锁）、值编辑器（选项、「我（当前用户）」「我的下属」、星级、相对日期 / 范围）、「N / 50 条」、添加条件组、另存为新视图。
- **三级分组**：组头缩进 + 条数 + 本组统计、显示空分组、全部展开 / 收起、层级可拖；分组改由本包自己做（`grid-group-core.ts`），TanStack 只排序。**服务端模式也能分组**：数据源加 `loadGroups`，后端 `applyGridGroups`（内存）或 `buildGridGroupSql` + `gridGroupsFromSql`（SQL，每级一条 GROUP BY），`buildGridSql` / `applyGridQuery` 先按 `query.groups` 排行。
- **排序面板 v2**（首先 / 然后可拖、方向按类型写字、自动排序开关、组内排序和空值最后的说明）、**字段配置 v2**（搜索、全部显示 / 隐藏、拖动、主字段锁、字段编组和整组眼睛、受限字段锁、「显示 13 / 15」、新建字段 / 编组回调）、**填色**（条件 + 7 种选项色，整行或单元格，第一条命中生效）。
- **`ViewOverrideBar` + `describeViewDiff`**：「你的个人设置：…」+ 恢复共享设置 / 另存为新视图 / 保存给所有人；BitableGrid 新增 `banner` 槽。`useGridView` 的 `load` 可以返回 Promise（期间 `loading`，不保存）。
- 和 bt/grid-b 合在一起：新字段类型的筛选条件按 `coreType` / `gridFilterOps` 走（评分保留自己的「大于等于」顺序和星级值编辑器，公式按 `resultType`）；表头菜单「按此字段筛选」进条件树，「按此字段分组」在多级分组里加一级；`onAddRow` / `onRowMove` 的 `group` 带上每一级的分组值（「新增一行 自动带上 首通 · 小王 · 台北」）；`GridView.frozen` 算进「你的个人设置」；`GridField.locked` 在字段配置和字段框里也显示锁（只有 `restricted` 才不能筛）。
- BitableGrid 新属性：`conditionContext`、`limits`、`dynamicTokens`、`onSaveAsView`、`panelNote`、`onCreateField`、`onCreateFieldGroup`、`banner`；`toolbarFeatures` 加 `fields` / `color`。新浏览器测试 `npm run test:grid-panels`；starter「多维表格」加了地区字段、字段编组、受限字段、「我」、个人设置条、服务端分组。

同事会注意到：工具栏按钮变成样稿的写法（「字段配置 / 已隐藏 N 个字段」「筛选 3」「分组: 阶段 / 分组 3 级」「排序 2」，多了「填色」），顺序是 搜索 · 字段配置 · 筛选 · 分组 · 排序 · 行高 · 填色；筛选、分组、排序、字段面板换成带标题和「?」的新面板；视图有统计时组头上显示本组统计；单选的「是其中之一 / 不是其中任何一个」改叫「是 / 不是」。

风险：`GridView.filters` / `conjunction` 不在类型里了，`groupBy` 从字符串变成数组——直接读写这些字段的宿主代码要改成 `view.filter` / `view.groupBy[0]?.field`（或 `isGroupedBy(view, key)`）；读旧视图、旧 defaults 不受影响。`GridQuery` 多了可选的 `filter` / `groups`：条件树有嵌套组时旧的扁平 `filters` 为空，**还在用旧版本 `parseGridQuery` 的后端要一起升级**，否则嵌套筛选在服务端不生效。服务端「我」必须由后端从会话解析（`resolve`），没传 resolve 的条件为假。`gridTableState` 不再产生 TanStack 分组状态（宿主若直接用 `gridColumnDefs` / `gridTableState` 做分组，改用 `groupTreeFromRows` + `groupLayout`）。

<!-- bt/grid-b -->
### bt/grid-b：多维表格的菜单、冻结线、填充柄、行操作和 12 种新字段类型（样稿 D01 / D02 / D03 / D19，工作项 G7–G12）

- **表头菜单 v2**（D03）：改用 `Menu`（键盘、子菜单、焦点归还），点表头 / 回车 / 右键 / Shift+F10 打开；内置 隐藏、冻结至此列、移动字段 ›、升降序（带「0 → 9」等提示）、按此字段筛选（`onFilterByField`）、按此字段分组；宿主项 `onFieldAction`（修改字段 / 编辑说明 / 向左右插入 / 复制 / 字段权限 / 删除，双击表头 = 修改）+ `fieldActions` + `headerMenuItems(field)`（按 `slot` 放，如「加入字段编组 ›」）。表头 `GridField.locked` 锁、`description` ⓘ；`onAddField` 末尾「+」列（新常量 `GRID_ADD_COLUMN`）。
- **单元格 / 选区 / 分组右键菜单**（D02，右键或 Shift+F10）：复制、粘贴、`onRowsInsert`（Shift+Enter / Ctrl+Shift+Enter）、`onRowsDuplicate`、展开记录（Ctrl+E）、`cellMenuItems(ctx)`、`onRowsDelete`「删除所选 N 条记录」；分组标题：收起 / 展开本组、全部收起 / 展开、在本组新增。
- **冻结线**：`GridView.frozen`（随视图保存，`frozenColumns` 变成默认值）、表头上可拖的冻结线手柄、「冻结至此列 / 取消冻结」；视图动作 `{ type: "freeze", count }`。
- **填充柄 + 选区外框**：多格选区 2px 主色外框，右下角填充柄拖动（虚线预览）或 Ctrl+D；一格复制、两格以上按步长续写数列；只读 / 校验不过跳过；`GridEditSource` 新增 `"fill"`，可撤销。纯函数 `planFill` / `fillTarget` / `fillSeries` / `fillDownTarget`。
- **行操作**：悬停时行号列拖动手柄 + 主字段右端展开图标；`onRowMove`（拖手柄或 Alt+Shift+↑↓，没排序时）；`onAddRow(group)` 每组底部「新增一行」；`cellBadge` 角标；`GridField.tone(row)` 按行着色。Ctrl+E 展开记录（空格 / 双击照旧）。
- **新字段类型**：`rating`、`progress`、`phone`（`mask` + `onReveal`）、`autoNumber`、`createdBy` / `createdAt` / `modifiedBy` / `modifiedAt`、`formula`（`resultType`）、`attachment`（缩略图 / 迷你录音播放器 / `MediaLightbox`）、`link`（`openRef` / `openEditor`）、`lookup`；`GridField.openEditor` 让任何字段改用宿主自己的编辑界面。规则按 `coreType` 映射到基础类型，`gridFilterOps(field)` 给每个字段的条件；`grid-query` 的 `parseGridQuery` / `applyGridQuery` / `buildGridSql` 都认（`GridSqlColumn.resultType`），并导出 `maskPhone` 等。
- 新文件 `grid-field-types.ts`、`grid-fill-core.ts`、`grid-interact-core.ts`、`grid-menus.tsx`、`grid-cells-extra.tsx`、`grid-editors-extra.tsx`、`grid-drag.ts`、`styles/grid-tools.css`；GRID.md 第 12 节；catalog `grid-tools`；starter「系统 → 多维表格 · 客户」；单测 `grid-field-types` / `grid-fill-core` / `grid-interact-core`；浏览器测试 `npm run test:grid-tools`。

同事会注意到：所有 BitableGrid 的字段菜单从按钮面板变成标准菜单（项目名改为「升序 / 降序」，多了冻结、移动、按此字段筛选）；冻结列右边的阴影变成 2px 主色浅线；表头里字段名不再撑满，▾ 只在悬停时出现；展开记录的图标从行号列移到主字段右端（悬停时）；Shift+Enter 在给了 `onRowsInsert` 的表格里变成「向下插入记录」。风险：`GridFieldType` 多了 12 个成员，宿主自己写的 `Record<GridFieldType, …>` 要补齐（或改用 `coreType`）；视图多了可选的 `frozen`，旧视图照常读取。

<!-- bt/records -->
### bt/records：记录与字段（样稿 D11 记录详情、D12 新建字段、D13 表格权限；工作项 R1–R6、P2、P3）

**做了什么**
- `FieldDialog`（新建 / 修改字段：名称、类型格子、类型设置插槽、选项、说明、默认值插槽、右栏授权插槽、底部说明；名称必填 / 重名 / 选项重名校验，保存失败留在弹框；860px 以下右栏移到下面）、`FieldTypePicker`（宿主给类型目录，没做的虚线 + 原因；搜索；方向键二维移动）、`OptionsEditor`（`SortableList` 拖动 / 键盘、`OptionSwatchPicker` 7 色、和表格一样的预览、回车加下一个、空名称退格删、重名标红、「允许在单元格里直接新建选项」）。从本项目 bitable 的 `field-dialog/` 抽出来，数据全走 props。
- `GrantList`：`mode="list"` 就是原来的 `SharePicker`（`SharePicker` 现在内部用它，API 和外观不变）；`mode="picked"` = 已选的人 / 组 / 部门 / 角色 + 每行 可读 / 可读写 / 管理 + 搜索添加（不抢焦点的建议列表，↑↓ 回车，Esc 只收起）+ 锁住的默认的人 + `audience` 横幅（谁看不到 / 共几人能看，`grantAudienceText`）。
- 记录详情：`RecordSection.block`（整块自己画：子表、评论）、`RecordSection.hiddenFields`（「N 个字段你看不到」，`HiddenFieldsPill`）、`RecordField.actions`（一个方块多个小按钮，`RecordFieldAction` 多了 `href`）、`tel`（拨打）、`reveal` + `remaskAfter`（留痕查看：眼睛按钮调宿主回调拿明文，默认 30 秒后自动打码并读秒；打码时不出复制按钮）。`SubTableSection`（子表外框：计数、说明、在表格中打开、显示列面板、添加 / 共 N 条显示最近 M 条 / 查看全部）。
- `SensitiveValue` 新增 `onReveal`（留痕，默认 30 秒自动打码）、`remaskAfter`、`variant="icon"`、`label`、`auditNote`；`useSensitiveReveal` 给自定义位置用。
- `CommentThread`（评论：@ 补全、图片 / 文件、回应用图标 + 名字、回复一层、解决 / 重新打开、只看未解决、Ctrl + Enter 发送、发送失败保留文字、图片点开 `MediaLightbox`）+ 纯函数 `splitMentions` / `mentionQuery` / `insertMention` / `keptMentions` / `visibleComments` / `openCount` / `toggleReaction`，服务端合同类型 `CommentThreadAdapter`。
- `@adminui/react/access` 新增 `TableAccessPanel`（一张表按角色的就地权限：角色列表 + 黄点、记录范围 6 档含「按条件」（`renderCondition` 插槽，默认平铺 `CondBuilder`）、交接后保留只读、操作胶囊、成员、字段 可读 / 可写 / 打码 / 可导出 + 计数 + 行标签 + 「看不到的」筛选、影响横幅 + `RuleImpactView`、以某人身份预览、保存）和纯函数 `table-access-core`（`tableAccessChanges` 给确认弹框）。复用 `toggleFieldAbility`、`DataScopeDialog`、`CondBuilder`、`RuleImpactView`，没另起一套。
- 新样式文件 `styles/records.css`（`styles.css` 末尾引入）；starter「系统 → 记录与字段」「系统 → 表格权限」；单测 `test/records-core.test.ts`，浏览器测试 `npm run test:records`。

**同事会注意到**：只新增，现有页面不变。`SensitiveValue` 的值多包了一层 `.aui-sensitive-text`，出错时如果回调 reject 的 Error 有 message 就显示那句话（以前固定「无权查看或加载失败」）。在弹框里的 `GrantList` 搜索框 / 评论输入框，建议列表开着时按 Esc 只收起列表。

**风险**：低。`RecordFieldAction.onSelect` 改成可选（给 `href` 时可以不写）——自己读这个类型并直接调用 `onSelect()` 的宿主代码要加 `?.`。`TableAccessPanel` 的「按条件」默认编辑器是平铺 `CondBuilder`，嵌套条件组（P1）合并后用 `renderCondition` 换上。

<!-- bt/share -->
### bt/share：对外分享套件和单元格修改历史（样稿 D20 / D21 / D21m / D21s / D22 / D25，工作项 S1–S5、H3）

- 新组件（根入口，无新依赖）：`ShareDialog`（链接 + 复制 + 二维码、摘要标签、复制链接和密码、策略横幅、谁能打开、能做什么 + 下载 / 复制、访客字段看 / 改 / 打码 / 禁止、PIN、有效期、打开次数 / 阅后即焚 + 用量、水印 / 通知 / 到期提醒、访问记录、暂停、作废）、`SharedPageShell` / `SharedRecordCard` / `SharedMediaCard`（公开访客页，水印、原地编辑）、`PasswordGate`、`SecretReveal`、`ShareManager` / `ShareAccessLog`、`CellHistoryPopover`、`QrCode` + `downloadQrPng`（内置二维码编码器 `encodeQr`，字节模式、L/M/Q/H、1–40 版，用 jsQR 独立解码验证过）。纯函数在 `share-core.ts`（`applySharePolicy`、`shareSummary`、`shareCopyText`、`attemptState`、`maskIp`、`accessFilters`、`relativeDay` …）。
- `QuickDatePresets` 新增（都可选，旧写法不变）：`hours`（「1 小时」档）、`selected`（按下态）、`disabledReason`（策略禁止的档划线、可聚焦读出原因）、`children`（「自定义」）；`onPick` 第二个参数是档位 key。新导出 `hourPresetValue`、`datePresetKey`、`datePresetMs`。
- `PopoverLayer` 多一个可选 `anchorRect`（挂在视口矩形下，给自己画格子的表格）。
- **修 bug**：`CodeInput` 从空开始连续打字会丢字（跳格时焦点回调读到旧值），现在按刚输入的值判断。
- 新变量 `--aui-control-height-touch`（44px，公开页手机控件）、`--aui-qr-dark` / `--aui-qr-light`（二维码在深色下仍是浅底深点）。新样式文件 `styles/share.css`。
- starter「系统 → 分享与历史」+ 公开页 `#share-public=…`；浏览器测试 `npm run test:share`；单测 `test/share-core.test.ts`。

同事会注意到：只新增；`CodeInput` 连续输入变正常。风险：低。`ShareDialog` 用 `:has()` 放宽到 1040px（老浏览器退回 960px）。

<!-- bt/views -->
### bt/views：视图（样稿 D01 / D16 视图标签与管理、D06 看板、D07 画册、D09 / D09b 日历、D10 甘特 + 甘特设置）

**做了什么**（新子路径 `@adminui/react/views`，没有新依赖；字段和值用 BitableGrid 的 `GridField<T>` 和格子渲染）
- `ViewTabs` + `ViewManager` + `ViewLockNotice`：视图标签（类型图标、标准视图锁、⋯ 菜单 / 右键、放不下进「更多」、新建视图）；视图管理三档（业务线标准 · 共享 · 我的，必看不能隐藏，拖动 / 键盘排序，眼睛，重命名 / 复制 / 删除，新建 6 种）；权限策略 `viewActions`。
- `RecordCard`（封面 / 附件数 / 字段行 / 两种密度 / 选中 · 拖动状态）、`KanbanBoard`（单选字段的列和色调、未设置列、列 ⋯ 收起 / 改色 / 隐藏、拖动 + 落点 + 变更提示、键盘移动、失败回滚、每列分页、左右翻页）、`GalleryView`（封面字段、密度、灯箱）。
- `CalendarMonth`（跨周多日条、+N 更多、悬停卡、今天、休 / 班、按色调着色 + 图例、无日期抽屉拖到某天、拖动 / 键盘改日期、窄屏日程列表）和 `CalendarWeek`（周 / 日时间网格、30 分钟吸附、重叠并排、拖动移动 / 拉伸带预览、拖空白新建、此刻线、右键菜单）。
- `GanttView`（左侧字段 + 两级分组、可拖可收的分隔条、周 / 月 / 季 / 年、只算工作日 + 休息日斜纹 + 补班日、今天线、里程碑、拖动 / 拉伸 / 键盘、边缘箭头、悬停提示、窄屏列表）。
- 设置面板 `FieldOrderPicker` / `CardSettings` / `CalendarSettings` / `GanttSettings` / `ViewSettingsFooter`。
- 纯逻辑：`date-core`（时区换算、周起始、工作日 / 节假日 / 补班，SDK 不带任何地区日历）、`calendar-core`、`gantt-core`、`kanban-core`、`view-core`，单测 `test/views-*.test.ts`；浏览器测试 `npm run test:views`；starter「系统 → 视图」；文档 VIEWS.md、AI-RULES 附录 D（视图）。

同事会注意到：只新增，现有页面不变（新样式文件 `styles/views.css`、`styles/views-time.css` 只作用于 `aui-v*` / `aui-kanban*` / `aui-cal*` / `aui-gantt*` / `aui-rcard*` 类）。风险：低；拖动用 Pointer Events + window 监听，触屏上卡片纵向滚动优先（`touch-action: pan-y`），日历 / 甘特条在触屏上拖动会占住手势。

## 6.7.0（2026-10-06）

多维表格样稿标准化第一期：基础部件、媒体与附件、看板部件、版本回退与 AI 审阅。全部是新增导出，没有删改已有导出。

**同事会注意到**

- **金额小数位终于生效**：BitableGrid 金额字段设了 `precision: 0` 的，以前固定显示「.00」，现在按设置显示（`¥2,379,000`）；复制出来的是显示值。
- **滚动条变细**：`.adminui` 里所有滚动条变成细的浅色滚动条（自己设了 `scrollbar-width` 的不变）。
- **选项颜色只认 7 种色调**：BitableGrid 选项的 `color` 只认已知颜色名（blue / green / red …）和 7 种色调（brand / brandMid / warning / danger / info / neutral / solid），任意十六进制颜色改为中性灰。
- **`DeltaBadge` 重新导出**（5.0 时收起过），用于看板和表格格子里的涨跌标。
- **在弹框里打开的菜单 / 弹出面板按 Esc 只关自己**，不再连弹框一起关。

**风险**：`Dialog` 新增 `placement`（侧边 / 底部），默认不变；`GridPopover` 改走统一的弹层，外观不变；`LogTimeline` 挪到 `log-timeline.tsx`（从原入口照样能导入）。


### bt/foundations：基础部件（第一期 F0.1–F0.6、G1、L3）

- **（修 bug）金额小数位**：`formatMinorMoney` / `MoneyDisplay` 新增 `digits`（0–2）和 `minorDigits`；BitableGrid 金额字段的格子、底部统计、输入都认 `precision`（237900000 分 + `precision: 0` → `¥2,379,000`，以前固定两位）。舍掉的位远离零四舍五入，值仍存分；新导出 `roundMinor`。
- **菜单**：`Menu` / `ContextMenu` / `MenuButton`（分组标题、图标、快捷键、右侧说明、`{count}`、子菜单、危险项、禁用原因、勾选项；指针处或锚点下打开、贴边翻转、键盘 + 首字母跳转、焦点归还）；纯函数 `placeLayer` / `menuTypeahead` / `menuLabel`。
- **`PopoverPanel`**：标题 + 「?」+ 右侧计数 + 内容 + 底栏的非模态面板。BitableGrid 的 `GridPopover` 改走同一层（外观、行为不变；在弹框里打开时挂进弹框）。
- **`SortableList`** + 纯函数 `reorder` / `moveNode` / `stepTarget` / `dropTarget` / `visibleRows` / `canPickUp` / `flattenIds`：指针拖动（落点线、靠边滚动）、键盘（Alt+↑/↓，空格拿起 / 放下，Esc 放回）、锁定项、两层编组、读屏播报。
- **选项 7 色**：`CellTagTone` 增加 `brandMid` / `info` / `solid`；`OPTION_TONES`、`OPTION_TONE_LABELS`、`optionTone`、`resolveOptionTone`、`OptionSwatchPicker`。
- **小部件**：`AvatarStack`、`Rating`、`SplitButton`、`CodeInput`、`NumberStepper`、`Countdown`（文字 / 圆环）、`Watermark`。
- **`SideSheet` / `BottomSheet`**：`Dialog` 新增 `placement`（`center` / `side` / `bottom`）和 `sheetWidth`。
- **细滚动条**：`.adminui` 内的滚动区统一细滚动条（平时很淡，悬停变明显，深色自动跟随）；自己写了 `scrollbar-width` 的（横滚标签条、侧栏）不变。
- starter 新页「系统 → 基础部件」，浏览器测试 `npm run test:foundations`。

同事会注意到：所有 `.adminui` 里的滚动条变细变淡（Chromium 10px、Firefox thin）；BitableGrid 里带 `color: "blue"` 这类旧颜色名的选项变成对应色调的标签（不再是白底加小圆点），任意颜色值不再显示。风险：`Dialog` 里打开的菜单 / 面板按 Esc 不再连带关掉弹框；给了 `precision` 的金额字段，输入会按它取整。
<!-- bt/media -->
**媒体与附件：附件集、大图预览、音频播放器（含格子里的迷你版）、多文件上传队列、录音和按住说话。** 起因：多维表格样稿 D19 / D07 / D11 / D18 / D27m 已审定，标准化进 SDK（工作项 F0.7、M1–M5）。

- 新组件（根入口，没有新依赖）：`AttachmentGallery`（网格 / 列表 / 一行条，封面和时长角标、锁标、没权限不能开、勾选 + 批量下载、添加方块、空状态、上传中 / 失败方块）、`MediaLightbox`（图片旋转、视频、音频、PDF、其他文件；← → Esc、缩略条、下载、新窗口打开、手机全屏）、`AudioPlayer`（波形来自宿主 `peaks`、倍速、键盘拖进度、`variant="mini"`）、`AudioWaveform`、`useUploadQueue` / `UploadQueue` / `UploadDropZone` / `UploadQueueList`（并发、进度、剩余时间、取消、失败原因、重试带 `attempt` + `key` 做断点续传）、`AudioRecorder` / `useAudioRecorder` / `HoldToTalk`、小部件 `MediaThumb` / `MediaTypeIcon` / `MediaMeta` / `LockPill`；纯函数（`media-core.ts`）`detectMediaKind`、`formatDuration`、`formatBytes`、`formatTimeLeft`、`downsamplePeaks`、`uploadQueueReducer`、`estimateSecondsLeft`、`holdGesture` 等。
- 新变量：`--aui-on-media`、`--aui-media-scrim`、`--aui-media-scrim-strong`、`--aui-media-stage`、`--aui-record*`（DESIGN.md §1.5）。录音红写进 DESIGN.md 作为唯一的点缀色例外。
- `UploadField` 不变；`uploads.tsx` 末尾多导出上传队列。新样式文件 `styles/media.css`（`styles.css` 末尾引入）。
- 文档：AI-RULES 附录 D（套件第 12 类）、catalog `media`；starter「系统 → 媒体与附件」；浏览器测试 `npm run test:media`（用 Chromium 假麦克风真录音）。

同事会注意到：只新增，现有页面不变。风险：低。`MediaLightbox` 用 `:has()` 选择器定尺寸（Chrome 105+ / Safari 15.4+ / Firefox 121+，更老的浏览器退回普通大弹框）；录音需要 HTTPS（或 localhost）和麦克风权限，不支持时组件显示原因和宿主给的 `fallback`。
### bt/dashboards：看板部件（样稿 D29 团队今日、D29m 我的今天、D30 业务线经营、D31 老板总览）

**做了什么**
- `KpiCard` 新增（都可选，旧写法不变）：`tag`（「北极星」「进行中」小标签）、`target` + `timeProgress`（数值旁边的子弹图，带「按时间进度应达」虚线）、`detail`（分母那一行）、`placeholder`（数据源还没接上：「—」+ 原因，不显示变化值）、`valueTone="bad"`、`trendPlacement="inline"`（趋势线放数值右边）。
- `BulletBar`：子弹图——当前值实心条、目标竖线、时间进度虚线、灰阶分档、进行中空心虚线。
- `DeltaBadge` 重新公开导出（5.0 收进了 KpiCard 内部；多维表格的格子和指标条也要用，`test/contracts.test.ts` 的「5.0 已删除」名单相应去掉它），新增 `size="sm"`（表格格子、指标条用）和 `unit`（「+6 分」）。
- `DashboardFilterBar` + `useDashboardFilters`：时间分段（今天 / 本周 / 本月 / 自定义）、对比（环比 / 同比 / 目标，每项带一句说明，`compareNote` 说明当前为什么这么比）、维度胶囊、「添加筛选」插槽、保存为我的筛选、重置；整个筛选是一个 `DashboardFilterValue`，进地址栏（`encodeFilterContext` / `decodeFilterContext`，不认识的值丢掉），下钻用 `carryFilterContext` 带走并列出目标页「未应用」的维度。页面的按钮（刷新 / 复制为我的看板）和「?」并进筛选行末尾，不单独占一行。
- `StepFunnel`（分步漏斗：每步人数、步骤转化 + 分母、整体转化、「流失最多」）、`CohortTable`（HTML cohort 表，主色深浅，「未到期」描边格）、`RollupCard`（实体汇总卡：值 vs 目标子弹图、异常胶囊、指标条、进入链接）、`ProgressRing`（带目标刻度的进度环，**只给手机「我的今天」这类个人进度**）。
- 图表子路径新增 `targetBarOption`（柱子 + 每期目标刻度，当期虚线空心「进行中」，没开始的留空不画 0），放在新文件 `chart-options-targets.ts`。
- 纯函数 `bulletGeometry` / `bulletLabels` / `funnelStats` / `cohortShade` / `cohortMax` / `ringGeometry`（`dashboard-kit-core.ts`）。
- starter 新增「团队今日示例」（D29）和「看板部件」（D30 / D31 / D29m）两页；`test:dashboards` 加跑 `test/dashboards-kit.mjs`。

**同事会注意到**：`DeltaBadge` 现在带 `role="img"`（读屏读整句「比上周同一天 上升 +12% 向好」）；`DashboardFilterBar` 是页面第一块时，`PageHeader` 的按钮会并进它的行末（`layout.tsx` 的 `PAGE_BLOCKS` 多了 `.aui-dfilter`）。

**风险**：`KpiCard` 的数值行多包了一层 `.aui-kpi-main`（只有自己写 CSS 改 `.aui-kpi > .aui-kpi-value` 的宿主会受影响，这本来就违反 sdk-override 规则）。
<!-- bt/history -->
**版本回退、有效权限扩展、AI 审阅与提示词设置（多维表格样稿 D23 / D24 / D15 / D27 / D28 标准化）。** 只新增，现有页面外观不变。

- `LogTimeline` 拆到 `src/log-timeline.tsx`（`page-templates` 照旧再导出，import 不用改），新增 `variant="operations"`：操作编号 · 影响 · 类型筛选带数量（`kinds` + `kind`，或 `LogKindFilter`）· 状态胶囊（`status`，`LogStatusPill`）· 撤回整批 / 恢复字段（连数据）/ 撤销撤回（`undo`）· 撤回窗口 `undoWindowDays` 默认 3 天、之外的灰组 · 展开看「这批之后」和冲突选择。原来的 T06 写法不受影响（`kinds` / `status` / `dimmed` 在 T06 也能用）。
- 新组件：`ConflictChooser` / `ConflictModePicker` / `ConflictToggle`、`TimeMachineDialog`（`timeMachineCards`）、`SuggestionReview`、`CitationChips`、`SourcedAnswer`、`PromptEditor`、`VersionList`、`CompareGrid`；纯规则 `history-core.ts`、`ai-core.ts`（导出见 catalog `history` / `ai-review` / `ai-prompt`）。
- `@adminui/react/access`：`AllowSourceKind` 多 `shared_record`、`field_default`；`EffectiveAccessRow.category`；`EffectiveAccessTable` 多 `rowActions`、`personalOnly`，有类别 / 到期时自动多出列；新 `AccessProfileHeader`、`OverrideTargetFields`、`accessProfileStats` 等；`AccessApi` 多两个**可选**方法 `setTargetOverride`、`findRecords`，`OverrideDto.target` 可选。`AccessConsole` 人员授权：个人加减可选「加什么」（适配器实现了才出现），有效权限顶上多权限构成条。
- starter 多「版本回退」「AI 分析」两页，「权限组件」多「按人员」分区；浏览器测试 `test:history`、`test:ai`，`test:access` 加 D15 交互。

同事会注意到：有效权限表里来源带到期时间时多一列「到期」，有单独加减时筛选行多「只看单独加减」。风险：宿主若对 `AllowSourceKind` 写了穷举 switch，要补两个新值。

<!-- bt/grid-a -->
## 6.6.1（2026-10-05）

**多维表格在 TanStack Table 9.2.6 上验证通过，写明 TanStack 版本怎么跟。** 起因：TanStack 发版很频繁，要求多维表格跟得上上游。

- 开发 / 测试用的 `@tanstack/react-table`、`@tanstack/table-core` 升到 9.2.6（`react-virtual` 仍是最新的 3.14.13）；`npm run check`（195 条）、`test:grid`、`test:grid-edit`（含服务端 10 万条无限滚动）全过。
- `GRID.md` 新增第 11 节：已验证的版本、小版本每月攒一次升、大版本先在本包分支适配、宿主不要领先本包去升；第 9 节加「业务代码不要直接 import TanStack」。

宿主要做的：把自己的 `@tanstack/react-table` 升到 9.2.6（peer 范围没变，不升也能用）。风险：无代码改动。

## 6.5.0（2026-10-04）

**权限管理页复审修复：不再悄悄删掉字段的按行条件，只显示服务端真会放行的按钮，行操作统一成 `RowActionBar`。** 起因：对 `@adminui/react` 6.4.0 权限页（`src/access/**`、`src/peizhi/**`）和 quanxian 样板 CRM 的一次全新复审。

- **（重要）保存角色不丢字段条件**：「角色」矩阵保存和「字段权限」保存都把 `fieldConds`（字段策略的按行条件）原样带回去，只带草稿里还有的字段；「复制为新角色」也一起复制。确认弹窗的改动清单会写出条件是「保留」还是「去掉」。以前这两处只发 `permissions`，服务端会把这个角色的全部按行条件清掉。纯函数 `roleSaveBody` / `fieldCondChangeItems`；`RoleInput` 多可选的 `fieldConds`。
- **按钮跟服务端规则一致**（服务端照样每次检查，这里只是不再显示点了必被拒的按钮）：
  - 只在某条业务线管人的（`assignWithin`）：「个人加减」只读，并说明要不限范围的授权（`consoleRights(...).overrides`）；分配列表里范围不在自己范围内的那几行，「改期限 / 取消」灰掉进 ⋯ 并写原因（`assignmentActions` 多第三个可选参数，返回多 `blockedReason`）。
  - 「设置负责人」、编辑部门时换上级部门：只有超级管理员看得到（`consoleRights(...).superuser`）；其他组织管理员的按钮叫「编辑」，上级部门不可改并提示原因。
  - 只在某处有组织管理的：部门 / 岗位 / 业务线值不给新建 / 编辑 / 删除（`consoleRights(...).orgStructure`）。
  - 不是超管时看自己：不显示分配角色、改期限 / 取消、个人加减、调整部门 / 岗位 / 业务线（纯函数 `editsSelf`）。
  - 打开管辖范围外的人：说清楚为什么看不了，不再给没用的「重试」和「分配角色」（纯函数 `listFailure`）。
- 记录协作成员一次加几个人：有人没加上时其余照加，最后都刷新，并写明「已添加：… 没加上：…（原因）」（纯函数 `addEach` / `addEachText`）。
- 停用业务线值先弹确认，写明多少人不再算在里面、多少条「只在这里」的分配不再生效（`dimValueDisableImpact`）。
- 说人话：授权审计的「调整业务线」「新建业务线」、对象类型「业务线」，以及申请 / 复核 / 规则 / 紧急提权 / 租户等动作都有中文名（`auditActionLabel` / `auditTargetLabel` 多可选的维度名参数，`auditEventDim`、`auditActionOptions`）；以他视角预览的「数据范围」用目录里的资源 / 动作名（`scopeKeyLabel`），剩余时间每秒走，有效权限里的业务线写名字；个人加减的选项不再写成「客户 · 客户 · 新增」；租户成员的邀请人、规则的最后修改人显示姓名（`RestrictionRulesPage` 新增可选属性 `users`）。
- 行操作统一：权限页、治理页、字典 / 参数页的操作列全部改用 `RowActionBar`（放得下就露、最多 3 个、危险操作进 ⋯）；字典的标签颜色改成 `SegmentedControl` + 一个预览徽标（不再是原生单选框，`TonePicker` 属性不变）；复核清单的「保留 / 收回」挪到「结论」列（`SegmentedControl`）；个人加减的说明收进「?」。
- **配合 quanxian 2.2.1 的能力字段**（老服务端不给时照旧）：分配列表每行的 `editable`（能不能取消 / 改期限，原因用服务端那句话）优先于页面自己按范围算，两样可以各自灰掉；部门 / 岗位 / 人的 `canAssign` 决定「分配角色」——不行就灰掉并在按钮下写原因（纯函数 `assignButton`）。有效权限、视角预览的范围优先用服务端的人话 `DataScope.label`（「全部 ∩ 我的业务线（B 产品线）」），预览的「数据范围」按快照的 `scopeDims` 写出维度过滤（`snapshotScopeLines`）；以前「业务线负责人」显示成「全部」，说宽了。
- 记录协作成员「添加成员」：原因改成必填，页面先拦（「请填写原因」）。服务端报错里的字段编码（`reason`、`expiresAt`、`scope.value` …）一律换成中文名；500 / 新错误码 `INTERNAL` 统一说「服务器出错，请稍后再试」并带上编号，不露细节。
- 门禁：`npm run check` 现在也跑 `admin-ui-audit src/access src/peizhi`（0 个错误才过）；SDK 自己实现矩阵 / 差异表 / 范围单选的几处原生控件用带原因的忽略注释标出。

同事会注意到：权限页里一些点了必报「没有权限」的按钮不见了或灰掉（带原因）；表格操作列放不下时多出 ⋯；字典改颜色变成一排按钮 + 预览。宿主自己写的浏览器测试如果按 `radio` 找字典颜色，改成 `getByRole("group", { name: "标签颜色" }).getByRole("button", { name: "主题色" })`；按 `button` 找「删除」这类危险操作的，要先点「…的更多操作」。

风险：低。新增的都是可选参数 / 可选属性（`DataScope.label`、`AssignmentDto.editable`、`DeptDto / PostDto / UserOrgDto.canAssign`、`AccessSnapshot.scopeDims`）；`assignmentActions` 返回值多一个字段，有 `editable` 时以它为准。5xx 的弹窗 / 提示不再显示服务端原话（只说稍后再试 + 编号）。配合 quanxian 2.2.1：服务端在不带 `fieldConds` 时也会保留条件，但页面现在总是带上。

## 6.4.0（2026-10-04）

**权限管理页跟上 quanxian 2.2：业务线（维度）+ 带范围的分配。** 起因：需要「单人多角色、多部门、多业务线」——同一个人在 A 业务线当经理、在 B 业务线是普通员工（CRM / ERP 常见）。

- `AccessConsole`：「部门 / 岗位」后面多一个维度分区（宿主登记了业务线等维度、适配器有 `listDims` 才出现）：值列表、新建 / 编辑 / 启停 / 删除。人员授权「组织」页显示他在哪些业务线里（主的标出来）、「调整业务线」；「角色」页多「范围」列（「仅业务线「A 线」· 部门「一部」」），同一个角色可以在几个范围上各分配一次，改期限 / 取消都按那一条。
- 分配弹窗（人 / 岗位 / 部门共用）：服务端 `catalog.scopedAssignments` 时多「只在这个业务线上」「只在这个部门（含下级）里」两项（不选 = 不限）；老服务端不给（它不认 scope，会当成不带范围）。
- 角色矩阵的范围弹框 `DataScopeDialog`：新属性 `dimensions`，每个维度一行过滤（不限 / 我的业务线 / 指定业务线 + 也包括没填的），值在 `DataScope.dims`；格子下面写「本部门 ∩ 我的业务线」。
- 有效权限 / 解释：只经带范围的分配持有的权限标「仅在业务线「A 线」」；`ExplainPanel` 新属性 `places`，「按业务线看」= 只算覆盖它的分配。
- 纯函数 `snapshotHolds(snapshot, code, where?)`：quanxian 2.2 起只在某条业务线给的按钮码默认不算（不在 `codes` 里，在 `contexts` 里）；菜单用 `"anywhere"`，对某一条按它的业务线问。
- `createAccessApi` 多五个方法（`listDims / createDimValue / updateDimValue / deleteDimValue / setUserDims`，在 `AccessApi` 上是可选的，自己写适配器的宿主不用改）；`unassign` 带 `scope`。纯函数 `describeDims / describeAssignScope / sameAssignScope / assignKey / normalizeDims`，`describeScope` 多一个可选参数（维度名）。

- 角色页「谁有这个角色」：多「范围」列，同一个人在几个范围上各一行；「取消分配」带上那一行的范围（只删那一条）。
- 人员「组织」页：只在某些业务线管人的（`consoleRights(...).orgWithin`）不显示「调整部门 / 调整岗位」（部门 / 岗位对全公司生效，服务端也拒），只能调业务线。
- 分配弹窗「只在这个业务线上」只给对方在的业务线；编辑人只在某些业务线管人时只给那些、也不给「不限」（`consoleRights(...).assignWithin`，纯函数 `assignPlaceOptions`）。
- 有效权限的范围列按来源各写一行（`effectiveScopeLines`）：「本部门及以下（仅在业务线「A」）；仅本人（仅在业务线「B」）」，不再把最宽的档配上全部业务线；没有业务线字段的记录写「只跟随上级记录」。
- **外壳顶栏（所有宿主）**：手机（≤ 760px）上 `headerActions` 放多了，每个操作保持自己的大小（身份选择不再被压成「老…」），整排横向滑动，藏着操作的那一边渐隐提示；左边的菜单按钮永远露在外面能点（以前会被盖住，手机上打不开导航），最后一个操作（如「退出」）滑得到。
- 有效权限：只在某处持有的行范围列和来源列都换行显示（行跟着长高），每条来源和它的「档位（仅在…）」不用展开就看得全；没有业务线字段的写「只跟随所属的客户」。
- 分配弹窗：编辑人只在某些业务线管人时，提示改成「你只能在自己管的业务线里分配」（不再说「不限 = 到处都算」）。

同事会注意到：宿主没登记维度时权限页完全不变；接 quanxian 2.2 的服务端后，分配弹窗多了「只在这个部门」一项、角色表多了「范围」列。手机上顶栏操作多的后台，右上角那排按钮变成可以横向滑动，菜单按钮不再被挡。

风险：低。新增的都是可选属性和可选方法；`DataScope` 多了可选的 `dims`，比较 / 规范化把它算进去（没有就和以前一样）。顶栏只改了 ≤ 760px 的布局（桌面不变）；宿主自己给 `.aui-topbar-actions` 写过样式的手机上要看一眼。

## 6.3.0（2026-10-02）

**列表页撑满一屏：`<PageBody fill>`。** 起因：美链通后台反馈，表格只有内容那么高，没数据时卡片下面留一大片空白，只能靠塞数据把表格撑满；用户要求表格默认铺满一屏、空状态上下左右居中。项目里先用一份覆盖 `.aui-*` 的样式实现并验证，现回流成 SDK 能力。

- `PageBody` 新增可选属性 `fill`：工作页至少一屏高，`PageBody` 的最后一块伸到底——`ResourcePanel`（含 `DataTable`）、`SplitLayout` 主栏里最后的 `ResourcePanel`、装 `ListDetailLayout` 的 `Panel`。伸开后表格区占满卡片、分页贴卡片底；空 / 加载 / 出错状态在表头与分页之间上下左右居中；有数据时行高不变，超过一屏整页滚动。
- `AdminShell` 自己量内容区上方（顶栏、工作标签条）的高度，写进 `.aui-content` 的 `--aui-content-offset`；字号、窗口变化时重量；向上取整，Windows 显示缩放（小数像素）下不会多出 1px 整页滚动。宿主不用自己测量。
- starter「用户管理」「资金账本」改用 `<PageBody fill>`；`test:components` 加断言：卡片底边 = 视口底 − 内容区下内边距、页面不竖向滚动、分页贴底、搜不到时空状态居中（偏差 ≤ 2px）。
- 文档：DESIGN §3.1、INTEGRATION §2.2、AI-RULES §2、PAGE-TEMPLATES（T02 / T03 / T09 写 `PageBody fill`）、catalog 规则同步。

同事会注意到：不加 `fill` 的页面完全不变；给列表页加上 `fill` 后，卡片伸到屏幕底部，空表时「暂无数据」居中、分页贴底。项目里如果自己写过拉伸 `.aui-*` 的样式（比如美链通的 `fill.css`），升级后删掉，改成 `<PageBody fill>`。

风险：低。只在 `PageBody fill` 打开时生效；用到 `:has()`（Chrome 105+ / Safari 15.4+ / Firefox 121+，不支持的浏览器保持原样）。限制：`PageBody` 要是工作页的直接子元素，`TabbedPage` 分区里暂不支持。

## 6.2.0（2026-10-02）

**SDK 能「自己长」、页面走样能被自动发现。** 起因：线上一个页面只用了已审定的设计里大约六成，没人注意到。

- **新命令 `admin-ui-audit`**（包的 `bin`，`scripts/ui-audit.mjs`，零依赖，Node 20+）：`npx admin-ui-audit <源码目录> [--json] [--baseline 文件] [--write-baseline]`。扫 `.tsx / .ts / .jsx / .css`（跳过 node_modules、dist、测试），每条报 `文件:行 + 规则 + 中文改法`。规则：`raw-control`（原生 button / table / dialog / select / input / textarea）、`hard-colour`（写死颜色）、`colour-bar`（≥2px 彩色左 / 上边框、inset 色条）、`sdk-override`（项目 CSS 改 `.aui-*`）、`row-actions`（操作列手摆 Button / RowActions，应该用 `RowActionBar`）、`intro-paragraph`（页面头后的介绍段落）、`page-title`（外壳里 `showTitle`）、`no-template`（提醒：有 PageHeader 却没用模板骨架块）。单行忽略 `// admin-ui-audit-ignore <规则>: <原因>`（原因必填），不在 SDK 环境里的整个文件用 `admin-ui-audit-ignore-file`；有不在基线里的错误就退出 1，老项目先 `--write-baseline` 登记、之后只许减少。`@adminui/react/catalog` 新增 `TOOLS`。
- **SDK 自我进化闭环**（维护者文档）：新组件 演示 → 产品负责人通过 → SDK（组件、文档、catalog、单测 + 浏览器测试、starter、留演示截图）→ 发版 → 各项目升级；三道防漂移门禁（项目 verify 跑 `admin-ui-audit`、SDK 浏览器测试对照演示、部署后截图对照，附可复制的 patchright 截图脚本）；定期 UI 巡检出改进提案给产品负责人确认；版本号规则。
- starter 自己先过审计：「客户与订单」和组件总览的操作列改用 `RowActionBar`（不可用的「修改负责人」带原因进 ⋯，「复制编号」固定在 ⋯ 里）；关系图主色块上的白字加了忽略说明。`npm run audit:starter` 零错误。

同事会注意到：装了 6.2.0 就能跑 `npx admin-ui-audit`；项目把它加进 verify 后，新写的原生按钮、写死颜色、装饰色条、改 SDK 样式等会让门禁变红。starter 的两张表操作列外观变成 RowActionBar 的样子（放得下就露，其余进 ⋯）。

风险：低。组件代码没有改动；审计是新增的命令，项目不接入就没有影响。规则是静态启发式，可能有个别误报——用忽略注释写原因，并把误报样例反馈给 SDK 修规则。

## 6.1.0（2026-10-02）

记录详情（T14，C 版）补齐已审定的 T14 演示里还缺的几样，都是新增可选属性，老代码不用改：

- `RecordLayout.overview: { label, icon }`：第一个标签页改名加图标（「概览」），key 仍是 `details`。
- `RecordTab.sections`：标签页直接用分区卡片 + 字段方块画（和「详情」一样，右栏保留），不用再写 `render`；`countUnfilled` 自动在标签名后显示「6 未填」（红）；`hidden(row)` 对某条记录不显示；`sections` 全空的标签页自动不显示。`render` 改为可选。
- `RecordField.action: (row) => ({ label, icon, onSelect })`：字段方块右上角一个小图标按钮（下次续费上的「已续费」、空着的预算上的「+」）；不关弹框。
- `RecordAction.tone: "attention"`：头部琥珀浅底按钮（「已续费」），总是按钮、不占 2 个主操作的名额。
- 分区 `render` 和标签页 `render` 多一个参数里的 `setTab`：右栏「最近动态」底部「查看全部 12 条操作记录 →」可以切到「操作记录」标签页。
- `RecordAlert.icon`：提示条前的圆形图标（默认注意 / 异常用警告图标，`null` 不要）。
- 大弹框 / 整页的右栏改成整列浅底 + 左细线（和演示一致）；右栏里的 `ActivityFeed` 时间换到正文下面，不挤标题。
- 核心函数：`recordTabs(layout, level, row?)` 按记录去掉隐藏 / 全空的标签页，新增 `recordTabCount`、`unfilledRecordFields`；`peekRecordFields` 也看标签页里的分区。
- starter「组件总览」的订阅记录改成和已审定的 T14 演示一样：概览 / 价格与成本（6 未填）/ 登录与令牌 / 客户 / 介绍 / 操作记录（`LogTimeline`），头部「已续费」，方块上的续费 / 填写按钮，右栏介绍版本、提醒规则和最近动态。TABLES.md §3 同步。

风险：低。唯一的可见变化是有右栏的详情弹框右栏底色、提示条多了图标；`RecordTab.render` 变成可选，自己调用 `tab.render(...)` 的代码要先判空（SDK 外没有这样用的）。

## 6.0.3（2026-10-02）

- `WorkItemCard`：步骤多于 3 个时步骤单独占第二行（游戏制作 5 个阶段挤在 300px 里，字叠在一起、撑出页面 400 多 px）。
- 分区标签行放不下时（手机、页面按钮多），右端的页面按钮换到下一行靠右，不再把整页撑宽（一个运维后台的远控页手机宽多出 210px）。

风险：低，纯布局。

## 6.0.2（2026-10-02）

- 合并页（TabbedPage）里看过又切走的分区，它的页面按钮不再串到当前分区或分区标签行（隐藏分区里的页头原地不动、看不见）。一个运维后台的远控页切到「录像」时会冒出「远控机」的「新增接入 / 强制升级」。
- `TodoInbox` 新属性 `wrap`（默认开）：灰色说明行可以换行，推送失败原因这类错误文字不再被截成一行看不全。

风险：低。

## 6.0.1（2026-10-02）

- `TabbedPage` 新属性 `tabsHidden`：某个分区要占满整页（例如在分区里打开整屏工作台）时收起分区标签行，分区不卸载。以前宿主只能自己写 CSS 盖 `.aui-tabbed-tabs-row`，违反「不在本地覆盖 SDK 样式」。

风险：低，只是新增可选属性。

## 6.0.0（2026-10-02）

**页面模板成为写后台的默认方式：每个页面先选 T01–T14 一个模板，布局定死、只换内容。** 14 个页面模板的静态演示已审定，规则是「所有项目的每个后台页面都用其中一个模板」。以前 SDK 只有组件没有页面骨架，各页面越写越不一样；这一版把模板做成 SDK 组件、starter 示例、文档和浏览器验收。

### 新增

- **页面模板文档** [PAGE-TEMPLATES.md](PAGE-TEMPLATES.md)：T01 工作台首页、T02 资源列表、T03 指标 + 列表、T04 统计看板、T05 分区合并、T06 日志 / 时间线、T07 关系图 / 监控、T08 设置 / 表单、T09 权限配置、T10 工具 / 工作区、T11 进度 / 工作项、T12 向导、T13 个人页、T14 记录详情——每个写了什么时候用、骨架、用哪些组件、示例代码、演示文件、典型用到它的页面（以运维平台为例）。`@adminui/react/catalog` 新增 `PAGE_TEMPLATES`（机器可读）和 `page-templates` 能力。
- **块和布局组件**（`src/page-templates.tsx`，样式 `src/styles/templates.css`）：`StatStrip` 指标带、`TodoInbox` 待办、`ActionList` 行列表、`QuickLinks` 常用入口、`PresenceList` 此刻在线、`BarList` / `RatioBar` 占比条、`InfoList` 信息小行、`ChoiceTiles` 选项方块、`ChangeMark` 改动标记、`SaveBar` 保存条、`SearchField` 搜索框、`SelectList` 选择列表、`Pane` / `PaneSection` 窗格、`LogTimeline` 日志时间线（按天分组、AI 标、展开看改前改后、加载更多）、`WorkItemCard` / `WorkItemList` 工作项、`ChatThread` / `ChatMessage` / `ToolCallCard` / `Composer` 对话；布局 `SplitLayout`（主栏 + 右栏）、`SideNavLayout`（左分节导航 + 滚动高亮 + 改动小点）、`ListDetailLayout`（左列表 + 右内容）、`WorkspaceLayout`（整屏三栏、页面不滚）、`WizardLayout`（居中向导 + 不能下一步写原因）、`GraphLayout`（图例 + 画布 + 右侧详情）。
- **已有组件的小扩展**（都是新增可选属性，老代码不用改）：`Panel` 的 `count`（标题后灰字）/ `flush`（内容贴边）；`ResourcePanel` 的 `unit`（「机器 38 台」）；`TabbedPage` 分区的 `icon` / `count` / `countTone`；`Tabs` 的 `countTone="attention"`；`FormField` 的 `changed`（「已改」+ 控件浅底）；`FormSection` 的 `title` 可省；`FieldTiles` 可 4 列；`Meter` 的 `tone`；`Steps` 的 `size="sm"` / `tone="attention"` / `stretch`。
- **starter 菜单「页面模板」**：T01–T13 各一页，只用 SDK 组件拼、内容是运维平台演示数据；「T14 记录详情」打开组件总览里的 C 版记录详情。
- **设计审阅流程**：通过的演示是参考库；流程是「静态演示 → 审阅页 → 产品负责人通过 / 要改 → 才写代码 → 截图对照」，附给 AI 的提示词。
- **浏览器验收** `npm run test:page-templates`：T01–T13 在 1440×900 浅 / 深色无脚本错误、不横向溢出、页面头不单独占行、每行最多露 3 个操作、指标块 ≤100px、工作区页不滚；390px 不横向溢出；待办筛选、保存条、日志展开的交互；截图在 `test/artifacts/page-templates/`。

### 修复

- 手机上表格格子里有可复制值（`CopyableValue variant="inline"`）、标签（`CellTags`）这类带读屏文字 / 测量用隐藏元素的内容时，整页会被撑宽（隐藏元素没有定位容器，按滚走的位置算进了页面宽度）。表格滚动区现在是它们的定位容器。

### 规则变化

- AI-RULES 新增两条最高规则：**「先选模板」**（每个页面先写明用 Txx，偏离要产品负责人同意）和 **「界面改动先出演示、产品负责人确认再写代码」**。宿主 AGENTS.md 片段、任务提示词 A、技能入口、DESIGN / INTEGRATION / README 同步。

### 同事会注意到

- 写新页面时 AI 会先说「本页用 T02」之类，并照 starter「页面模板」对应的一页改；要做模板以外的布局，AI 会先给一个静态 HTML 审阅页让产品负责人点通过。
- 页面或分区里的指标卡（`MetricGrid` / `KpiGrid`）和下面的卡片之间的空隙从 32px 收到 16px（以前多叠了一份下边距）。
- 没有复制 / 打开按钮的字段方块（`FieldTile`），标签不再给按钮留 64px 空位，窄方块里的标签不会被挤成竖排。

### 风险

低到中。新增组件和可选属性不影响现有页面；可见变化只有上面两处间距 / 标签宽度和表格滚动区多了 `position: relative`。`npm test`、`test:page-templates`、`test:components`、`test:dashboards`、`test:design`、`test:browser`、`test:business-tables`、`test:record-detail`、`test:collections`、`test:packed` 通过；`test/browser.mjs` 的菜单分组断言加了「页面模板」。版本号升到 6.0 是因为写页面的规矩变了（先选模板、先出演示），接口没有删改。

## 5.4.0（2026-10-02）

**页面开头是 KPI 卡时按钮也不单独占一行；指标卡变紧凑。** 看备份页时的反馈：右上角「实时 · 数据截至 · ?」又单独占一行，四张指标卡数据不多却很大，挤掉了下面真正要看的表格。

- 页面按钮的去处按页面 / 分区的**第一块**决定：第一块有标题行（`Panel` / `ResourcePanel` / `DashboardSection`）就并进它；第一块是 KPI 卡、提示条这类没有标题行的，放进 `TabbedPage` 分区标签那一行的右端；都没有才在原位。
- `DashboardSection`：`description` 收成标题旁「?」；标题行加按钮插槽。
- `KpiCard` / `MetricCard` 紧凑：去掉 132px 最小高度，内边距 10–14px，行距收紧，数值 22px。

同事会注意到：看板和统计页的指标卡矮了一半左右；分区标签那一行右边可能出现页面按钮。

风险：低。纯布局；`dashboards` / `components` / `design` / `browser` 浏览器验收通过。

## 5.3.0（2026-10-02）

**页面按钮不再单独占一行。** 5.2 去掉大标题后，页面头只剩右上角的按钮和「?」，还是单独占了一行；反馈：「应该跟下面不要单独占一排，下面不是也有一行吗？放在下面一点，不然浪费空间」。

- `PageHeader`（含 TabbedPage 分区里的页头）的按钮和「?」自动并进同一页面 / 分区里第一个看得见的 `Panel` / `ResourcePanel` 的标题行，排在面板自己的按钮后面（主按钮在最右）。切换分区时跟着换；页面里没有面板时才在原位一行靠右。
- `Panel` / `ResourcePanel` 标题行多了一个不占位的插槽 `.aui-page-actions-slot`；没有任何按钮时操作区不显示。
- 浏览器验收：用户页「新增用户」和「刷新」在用户列表标题行同一行；系统设置分区的按钮和「?」在「登录防护」面板标题行。

同事会注意到：页面顶部那一行按钮没了，按钮出现在列表标题那一行；代码不用改。

风险：低到中。按钮渲染位置变了（React 门户，事件和上下文不变）；按 `.aui-page-header` 找按钮的测试要改成在面板标题行里找。

## 5.2.0（2026-10-02）

**页面一进来就是按钮和内容：不再重复页名大标题，介绍收进「?」。** 反馈：「左边已经写了机器，右边又写机器，下面还要写一个详细的介绍，这个都不需要……非要介绍的话，右上角写一个问号，鼠标挪上去的时候就会介绍」。

- `PageHeader`：大标题默认只给读屏（侧栏、工作标签、面包屑已写页名）；新属性 `showTitle` 给没有外壳的页面。`description` 不再显示成段落，收成右上角「?」。只有标题时页面头不占位置。
- `Panel` / `ResourcePanel`：`description` 收成标题旁的「?」。
- 新组件 `HelpTip`：小「?」按钮，鼠标悬停、键盘聚焦或点按显示说明框（挂 Provider portal，不被面板裁掉；Esc / 移开关闭）。
- AI-RULES、DESIGN、catalog 写明：不写介绍段落、不拿提示条当介绍。

同事会注意到：所有页面顶部的大标题和介绍文字没了，页面上移；介绍在右上角「?」里。没有外壳的独立页面如果需要标题，加 `showTitle`。

风险：中。纯展示变化，接口不变；依赖「页面标题文字」做定位的浏览器测试要改成按 h1 角色（标题仍在，只是视觉隐藏）。

## 5.1.1（2026-10-02）

- `RowActionBar` 一行最多露 3 个按钮（新属性 `max`，默认 3）：操作很多的表格（例如远控机 15 个操作）5.1.0 会把所有按钮铺满一行。反馈：「最多显示 3 个按钮吧」。
- 灰掉（`disabled`）的操作不再占露出的位置，统一进 ⋯ 并显示原因。
- 操作列宽度只按前 3 个可用按钮算，不会再把表格撑得很宽。浏览器验收加「每行 ≤ 3 个」。

风险：低。只是露出的按钮变少；所有操作都还在 ⋯ 里。

## 5.1.0（2026-10-02）

**表格操作列：放得下就露，放不下才进 ⋯。** 反馈是「明明还有空位，却弄了 3 个点」——以前一行只露 1–2 个按钮、其余全进菜单，列宽有富余也一样。

- 新组件 `RowActionBar`：把一行的全部操作按常用顺序给它，按列宽放得下几个就露几个（小号无边框按钮，图标 + 字），放不下的才进 ⋯；隐藏的尺子让表格有富余时操作列自动变宽，窄屏自动收。危险操作默认在 ⋯（`menuOnly: false` 才露出）。
- `RowAction` 新增 `ariaLabel`、`menuOnly`；纯函数 `fitRowActions`（在 `menu-core.ts`）。
- 文档规则改为：操作列一律 `RowActionBar`，不要自己摆 `Button` + `RowActions`（TABLES §2.6、AI-RULES、catalog）。浏览器验收加了一条：⋯ 旁边不许还有能放下一个按钮的空位。

同事会注意到：换成 `RowActionBar` 的表格，操作列里露出的按钮变多了，⋯ 菜单变短。老写法照样能用，只是不再推荐。

风险：低。只是新增组件；没换的页面不变。

## 5.0.0（2026-10-02）

包含 4.5.0 的全部内容（权限整页「锁定的分配」）。

**色卡、组件套件、文档整理，并删掉所有旧的、没人用的、重复的东西。** 当时唯一用 4.x 的消费方是一个运维平台；其余项目固定在 1.x / 2.x tag，不受影响。升级照下面的「升级指南」逐条改，改完 `tsc` 能编过就基本齐了。

### 新增与变化

- **色卡**（`src/palette.ts`）：一套色卡 = 一个主色系 + 3 种点缀色（注意 / 异常 / 信息），「正常 / 成功」用主色系；六套已批准色卡 `forest`（默认）/ `ocean` / `celadon` / `graphite` / `clay` / `plum`。`AdminProvider palette="forest"`（也收完整 `PaletteSpec` 或 `"#rrggbb"`）；`ThemePicker` 改为色卡选择。深色模式由同一套色卡生成并保证对比度。纯函数 `createPalette`、`contrast`、`mix`、`validColor`、`isPaletteId`、`paletteById`、`PALETTES`、`DEFAULT_PALETTE`。规则见 DESIGN.md §1。
- **尺寸**：控件高 36px（小号 28px），圆角控件 8px / 面板 12px；不画装饰色条。
- **组件套件**：已审定的 62 个组件是写后台的唯一来源（AI-RULES.md §0）；新增 `RecordHeader`、`FactStrip`、`SectionCard`、`FieldTile` / `FieldTiles`、`IconBlock`、`PersonLine`、`Count`、`Steps`、`BatchBar`、`Sparkline`（新版）、`Tag`、`AsyncSwitch`、`CopyBlock`、`Meter`、`SharePicker`；`Tabs` 的每一项可带 `icon` / `count`；`Dialog` 可用 `header` 换掉默认头部；`RecordLayout` 新增 `avatar` / `tags` / `crumb` / `alerts`，字段加 `icon` / `tone` / `mono` / `href` / `span`，分区加 `icon` / `progress` / `onFill`；`RecordDetailDialog` / `RecordPage` 换成 C 版版式（记录头部 + 关键信息块 + 分组卡片里的字段方块 + 右栏小卡片）。starter 新增「组件总览」页（可切色卡）。
- **样式**：`styles.css` 拆成 `src/styles/*.css`（按组件区域），颜色全部来自色卡变量（`test/style-rules.test.ts` 门禁：不许写死颜色、不许装饰色条、控件高度统一）；新增变量 `--aui-primary-fill`（白字底色，深色模式也清楚）、`--aui-*-soft / -line`、`--aui-shadow-sm/md/lg`、`--aui-overlay`、`--aui-hover`、`--aui-selected`、`--aui-control-height-sm`。
- **列表**：后台管理主列表是 `DataTable`；`BitableGrid` 只给格内录数据的页面。要搜要筛的大日志 = `DataTable` + 服务端分页。
- **格式化**：日期 / 相对时间 / 金额统一到一个模块（`src/format.ts`），所有组件同一种写法，负数统一用真减号。
- **文档 17 → 12 份**：README、INTEGRATION、AI-RULES、DESIGN、TABLES、ACCESS、WORKFLOWS、GRID、DASHBOARDS、CHANGELOG、AGENTS、THIRD-PARTY。删除并合并：AI-PROMPTS → AI-RULES 附录；PRECISION-TEMPLATE、MOTION → DESIGN；COLLECTIONS、RECORD-DETAIL → TABLES；GOVERNANCE + INTEGRATION 里的权限章节 → ACCESS；INTEGRATION 里的升级说明 → 本文件。
- starter：删掉组件画廊（gallery）、「系统 → 资产台账」（`RecordTables.tsx`，独有内容并进「客户与订单」）和旧「数据看板」页（标准是「运营看板示例」）。

### 升级指南：删除项与替代

| 删除 | 改成 |
|---|---|
| `AdminProvider defaultColor` / `design`、`THEME_PRESETS`、`useAdminTheme().color` / `setColor` | `AdminProvider palette`（色卡 id / spec / `"#hex"`）、`PALETTES`、`useAdminTheme().palette` / `paletteChoice` / `setPalette` |
| 1.x 存在浏览器里的颜色迁移（旧蓝色 → 深绿、旧中号 → 中大号） | 无；用户色卡存在 `storageKey + ":palette"` |
| 子路径 `@adminui/react/theme` | 根入口 `@adminui/react` |
| 子路径 `@adminui/react/contracts` | 根入口：`import type { ListAdapter, UploadAdapter, … } from '@adminui/react'` |
| `@adminui/react/grid` 转出的 `parseGridQuery` / `applyGridQuery` / `buildGridSql` / `validateFieldInput` 等 | `@adminui/react/grid-query` |
| `@adminui/react/access`、`@adminui/react/peizhi` 的 `export *` | 改为明确的导出清单；文档、示例、quanxian CRM 样板用到的都保留，内部辅助函数不再公开 |
| `DataTable rowSize` | `rowHeight`（`short / medium / tall / extraTall / "auto"`） |
| `DataTable` 平铺的 `total / page / pageSize / onPageChange / onPageSizeChange` | `pagination={{ mode: 'page', total, page, pageSize, onPageChange, onPageSizeChange }}` |
| `Dialog size="drawer"`（右侧抽屉） | `size="record"` / `"lg"`，记录详情用 `RecordDetailDialog` |
| `SplitView` | `DataTable expandRecord` / `useRecordDetail` / `RecordDetailDialog` |
| `EmbeddedPage` / `useEmbeddedPage` | `TabbedPage`（分区里的 `PageHeader` 自动收成一行） |
| `PermissionGate` | 按 `createPageRegistry` 的结果或权限码直接不渲染；功能开关用 `FeatureGate` |
| `RefreshToolbar`、`useAutoRefresh` | `useAdminResource(key, load, intervalMs, active)` + 「刷新」`Button` + `InlineAlert`；实时档 `useLiveResource` + `LiveStatus` |
| `AuditExplorer` | `AuditLogPage`（服务端分页检索）；单条对象的历史用 `AuditTimeline` / `ActivityFeed` |
| `useTaskCenter` | `TaskCenterProvider` + `TaskCenter` |
| `DeltaBadge` | `KpiCard delta={computeDelta(…)}` |
| 旧 `Sparkline`（`dashboard.tsx`）、`sparklinePath` | 新套件 `Sparkline`；KPI 卡里的趋势用 `KpiCard trend` |
| `useCellBudget` | 用 `CellText` / `CellLongText` / `CellTags` / `CellPeople`，它们自己读行数 |
| `formatMinor` | `formatMinorMoney(minor, { symbol, unit })` 或 `MoneyDisplay` |
| `formatCellDate`、`absoluteTime` 等分散的日期函数 | `src/format.ts` 的统一函数，组件用 `DateTimeDisplay` / `CellDate` / `RelativeTime` |
| `buttonVariants`、`Z95`、`Z998`、`CHECK_STATUS_ORDER`、`CHECK_STATUS_LABELS` | 无（内部用）；按钮用 `Button` 的 `variant` / `size` |
| `PEEK_FIELD_LIMIT`、`RECORD_DETAIL_LEVELS`、`RECORD_LEVEL_LABELS`、`RECORD_PARAM`、`RECORD_VIEW_PARAM`、`RECORD_PRIMARY_ACTIONS`、`recordFieldCount`、`recordFieldText`、`sectionFields` | 无（内部用）；记录详情只通过 `RecordLayout` 配置 |
| `CELL_LINE_HEIGHT`、`ROW_HEIGHT_LABELS`、`TWO_LINE_MIN_HEIGHT` | 无（内部用）；行高用 `rowHeight` / `ROW_HEIGHT_PRESETS` |
| `VIZ_DIVERGING` | 无；发散色按 DASHBOARDS.md §12.2 自己定（蓝 ↔ 红，中点灰） |
| 只给测试用的纯函数 | 不再公开；测试直接 `import '../src/*.ts'` |
| 内部文件 `record-drawer.tsx` / `useRecordDrawer` | 改名 `record-expand.tsx` / `useRecordExpand`（内部）；公开类型 `ExpandRecordOptions` / `ExpandRecordContext` 不变 |

固定版本改成 `#adminUI-v5.0.0&path:/packages/react`。宿主 AGENTS.md 里指向旧文档的入口（AI-PROMPTS.md、PRECISION-TEMPLATE.md、GOVERNANCE.md、COLLECTIONS.md、RECORD-DETAIL.md、MOTION.md）改成 AI-RULES.md / DESIGN.md / ACCESS.md / TABLES.md。

风险：界面整体换色（默认仍是森林绿，但侧栏、状态色、圆角、控件高度都变了），升级后逐页截图检查；写死了旧颜色或 32px 高度的宿主样式要删掉。

## 4.5.0（2026-10-02）

**权限管理整页 `AccessConsole`：锁定的分配不给取消。** 配合 quanxian 2.0.0 正式版（`AssignmentDto.locked`）。全部是新增，老页面不用改。

- `AssignmentDto` 多了可选的 `locked?: { reason }`。服务端标了锁定的分配（例如按宿主自己的账号角色推出来的「超级管理员 / 员工」持有人）在「角色 → 谁有这个角色」「人员授权 → 角色」「部门 / 岗位 → 角色」里不再显示「取消分配 / 改期限」，操作列换成锁图标 + 原因（`.aui-access-locked`，一行省略、悬停看全文）。
- 新纯函数 `assignmentActions(a, manage)`；错误码 `LOCKED` 的弹窗标题「已锁定，不能在这里改」。
- 文档里的波次占位（「W1 / W2 / W3 / W4」「beta」）换成正式说法；4.1.0 / 4.2.0 的「未打 tag」标注去掉（两版都已打 tag）。

同事会注意到：接了 quanxian 2.0.0 且配了 `lockedAssignment` 的项目（如运维平台），内置角色的持有人那几行没有取消按钮了，旁边写着原因。没配的项目看不出变化。

风险：低。只是在 `locked` 存在时少画按钮；接口照样由服务端判（409 LOCKED）。验证：`npm run check -w @adminui/react`（`access-console-core` 新用例）、`npm run test:access -w @adminui/react`、quanxian `npm run test:crm-web`（浏览器：老板打开「管理员」角色，锁定的那行没有「取消分配」、显示原因，直接调接口回 409 LOCKED）。

## 4.4.1（2026-10-02）

- 记录详情深色模式下「未填写」小标签看不清（浅底浅字），改成半透明底 + 正文色。

## 4.4.0（2026-10-02）

**后台管理列表默认回到 DataTable；记录详情改版式。** 试用多维表格后的结论：运维 / 管理后台的列表要"每行的操作按钮直接看得见、格子里能放自己的内容、每行一样高"，这是 Cloudscape / Ant Design ProTable / TDesign / Carbon 的标准表格，不是多维表格。

- 选型（现 TABLES.md §1、AI-RULES）：后台主列表 → `DataTable`（操作列 + 固定行高 + 分页 + `expandRecord`）；BitableGrid 只给在格子里录数据改数据的列表。`suggestCollection` 新增返回值 `"table"`（DataTable）和条件 `editCells`；以前返回 `"grid"` 的后台主列表现在返回 `"table"`，只有 `editCells` 才返回 `"grid"`。
- 记录详情（现 TABLES.md §3）：
  - 空字段不再一行一个「—」，分区末尾收成一行「未填写：…」；表格占位「—」也算空；新字段属性 `showEmpty`（空着也留在原位）。新纯函数 `arrangeRecordFields`。
  - 和标题相同的字段（如「名称」）不在正文和简要档里重复；`peekRecordFields` 新增第 4 个参数 `title`。
  - 字段默认标签在左、值在右（属性表），大弹框里标签列固定宽；分区新增 `fieldLayout: "stacked"` 改回标签在上。全空的分区不显示。
  - 第 ② 档大弹框高度随内容（至少半屏、最多 88%），有标签页时才固定高度。

## 4.3.2（2026-10-02）

- `BitableGrid` 新增 `toolbarFeatures`（`{ search?, filter?, sort?, group? }`）：页面上已经有服务端全文搜索时关掉表格自带的搜索框，不出现两个搜索框。

## 4.3.1（2026-10-02）

- `ActivityFeed` 新增 `canOpen(item)`：只有能打开的条目是可点的按钮，其余是普通行（以前给了 onOpen 就每条都像能点）。

## 4.3.0（2026-10-02）

**不是所有列表都该用多维表格**：新增三个轻量组件（根入口，不依赖 TanStack）和选型手册（现 TABLES.md §1）。

- `CompactTable`：紧凑表格，给排行 / 统计 / 图表旁明细 / 弹窗卡片里的几行。和 BitableGrid 同一套 `GridField`（换组件名即可互换）；`columns` 选显示的列，其余字段点行在记录详情里看；固定顺序 `sort`、`maxRows` + 显示更多、`viewAll` 去完整列表；一个操作直接是按钮，多的进 ⋯；没有工具栏 / 行号 / 统计栏。
- `ActivityFeed`：时间线，给某个对象的历史、体检、心跳、操作日志、版本、通知。最新在上、按天分组、相对时间（悬停看精确时间）、tone 圆点、描述两行、点开记录详情、显示更多。
- `StatusChecklist`：状态清单，给自检 / 依赖 / 运行器。汇总行、图标 + 文字状态 + 原因 + 最多一个操作。
- 纯函数 `suggestCollection`（按行数 / 时间流 / 是否要找要筛给出该用哪种）、`summarizeChecks`、`relativeTime`、`dayLabel`、`groupByDay`、`absoluteTime`。
- 验收 `npm run test:collections`；starter「系统 → 轻量集合」。

## 4.2.0（2026-10-01）

**新增：大档权限治理页**（quanxian 2.0 第 4 波，多租户 / 治理），在原来的可选子路径 `@adminui/react/access` 里，源码在 `src/access/governance/`。和 3.2 的权限部件不同，这些是**整页、自己加载和保存**：每页收一个 `api`（`createGovernanceApi()`，默认对同源 `/api/qx` 的 quanxian 治理接口，租户取自服务端会话），加上 `can` 权限开关和宿主给的选项。根入口和已有的权限部件不变。

- 页面：`TenantsPage` / `PackagesPage`（平台：开通、编辑、停用 / 恢复、删除要输入租户编号和原因；套餐 = 权限码上限 + 功能模块 + 角色模板 + 配额）、`TenantMembersPage`（当前租户、套餐、配额条，加人 / 停用 / 改期限 / 移出要原因）、`ShareRulesPage` / `RestrictionRulesPage`（条件构造器 + **保存前必须「预览影响」**，预览后再改保存变灰；内置规则只读；删除也先算影响）、`SodRulesPage`（职责分离规则 + 当前违规的人）、`AccessRequestsPage`（我的申请 / 待我审批 / 全部，新申请，批准 / 驳回 / 撤回 / 收回 / 提交，驳回和收回必填原因，审批链）、`ApprovalPoliciesPage`（表格式编辑审批步骤）、`EmergencyAccessPage`（紧急提权：原因 ≥ 10 字、监督人不能是自己、实时倒计时、立即结束、监督人看操作记录事后复核）、`ReviewsPage`（复核活动发起 / 关闭，复核项复用 `ReviewList`）、`SecurityHealthPage`（严重 / 警告 / 正常分组、样本展开、RLS 自检表），以及按 `qx:*` 权限码组成分区的 `GovernanceConsole`。
- 可复用部件：`CondBuilder`、`RuleImpactView`、`ApprovalChain`、`EmergencyCountdown`、`TenantQuotas`。
- 纯函数（无 React，可在服务端 / 测试里用）：`createGovernanceApi / GovernanceApiError / parseGovError`、`condToText / validateCond / condToDraft / draftToCond`、`govRequestActions / chainProgressText / chainSteps / validateRequestInput`、`validateEmergency / emergencyCountdown`、`campaignProgress / campaignDeadline / campaignCloseImpact / toReviewItem`、`stepsText / validatePolicy`、`governanceCan / governanceSections`、`impactSummary`（「3 人会多看到 120 条，1 人会少看到 4 条」）、`quotaState / quotaAlerts / effectiveQuotas`、`healthSummary / groupHealth / rlsSummary`。
- 数据形状 `src/access/governance/contracts.ts` 逐字段对齐 quanxian `contracts.ts`「大档（W4）」一节（SDK 不 import quanxian）。

同事会注意到：starter 菜单「系统」下多了「权限治理」（12 个分区，内存假服务端，可切「普通成员（只读）」视角）；`styles.css` 末尾多了一节 `.aui-gov-*`（只作用于这些页面）；`@adminui/react/access` 多导出了一批名字（都带 Gov / Governance 前缀或是页面名，和已有导出不重名）。

风险：服务端治理路由（quanxian 2.0.0-beta.4，2.0.0 正式版未改形状）已逐条对过；页面按合同的 `can` 和状态显示按钮，**只是界面**，鉴权、版本冲突、审计、配额都在服务端判。列表用的是 DataTable（和 3.2 权限部件一致，不引入 BitableGrid 的可选依赖），全是一次拿全的短表。

验证：`npm run check -w @adminui/react`（新增 `test/access-governance-core.test.ts` 22 个用例，含假 fetch 测 API 客户端）、`npm run test:access-governance -w @adminui/react`（浏览器：规则改条件 → 预览 → 再改保存变灰 → 重新预览 → 保存，放弃修改确认，内置规则只读，申请驳回要原因 / 批准进到下一级 / 审批链，新申请校验，紧急提权校验 / 开始 / 倒计时 / 结束 / 监督人复核标异常要意见，复核保留 / 收回要原因，成员移出要原因，租户删除要输入编号，只读视角，12 个分区 360 / 390 / 1440 不横向溢出，深色对比度 ≥ 4.5，截图在 `test/artifacts/access-governance/`）。

## 4.1.0（2026-10-01）

**权限管理整页接上 quanxian 2.0 服务端 + 字典 / 参数页**（quanxian 2.0 第 3 波）。全部是新增，老页面不用改。

- **`AccessConsole`**（`@adminui/react/access`）：中档项目挂一个组件就是整套权限管理——部门（树 / 负责人 / 成员 / 移动 / 部门角色）、岗位（含岗位角色）、角色（矩阵每格数据范围 + 字段行、和已保存比的改动清单、切换前「放弃未保存的改动？」、409 版本冲突原地「重新加载」、复制为新角色、内置角色只读、谁有这个角色）、人员授权（多部门 + 主部门、岗位、分配角色带到期和原因、个人加 / 减可授出可到期、有效权限带来源）、用户组、字段权限、权限解释 + 以他视角预览（只读、短时、记审计、顶部倒计时提示条）、授权审计（筛选 + 变更前后 + 加载更多）；`extraSections` 挂宿主分区。按 `GET /me/access` 快照只显示能看的分区，没有 manage 码自动只读；服务端 403（防提权、职责分离）/ 409 原话显示在弹窗里，输入不丢。
- **`RecordTeam`**：`RecordTeamPanel` 接 quanxian 记录授权接口，任何详情页都能放（负责人从业务列传入，加成员只发 `{ type, id? }`，改级别 / 到期、移除要原因、转移负责人一步完成）。`RecordTeamPanel` 新增 `subjectTypes` / `groups`：可以加用户组、部门、所有人（默认仍只加人）。
- **`createAccessApi` / `AccessApi` / `AccessApiError`**：quanxian/fastify 40 条管理接口的 fetch 适配器；`console-contracts.ts` 是服务端 DTO 的结构镜像（不依赖 quanxian 包）；纯规则 `consoleRights / errorView / deptIndex / deptTree / roleDirty / explainActions …`。
- **新子路径 `@adminui/react/peizhi`**：`DictManager`（字典类型 + 项、标签颜色 `TonePicker`、排序、默认项、启停、内置 / 自定义 / 后台改过标记、恢复默认）、`ParamManager`（分组、按类型编辑、实时「原值 → 新值」、非法值弹窗内说明、密钥只显示已设置 / 未设置且只能整体替换、恢复默认、自定义参数、改动记录）、`createPeizhiApi`。
- **契约对齐 quanxian §3.13**：允许来源加 `dept / implied / parent`；`SCOPE_TIER_HINT.custom` 改成「只看勾选部门的，以及自己名下的」（`describeScope` / `validateScope` 文案同步）；`EVERYONE_ID = "*"`；`teamAddPayload` 去掉只给界面看的 name / hint。
- 修正：`EffectiveAccessTable` / `ExplainPanel` 同一个角色经多条路径授予时 React key 重复的警告。

同事会注意到：`@adminui/react/access` 多了整页组件；新子路径 `@adminui/react/peizhi`；`styles.css` 在权限组件那节后面多了 `.aui-access-console / .aui-access-split / .aui-pz-*` 几条样式（只作用于这些组件）。

风险：`custom` 档的提示文案变了（以服务端「勾选部门 ∪ 最低一档」为准）；`AllowSourceKind` 多了三个值，宿主如果对它写了穷举 `switch` 会编译报错（加分支即可）。页面只做提示，权限照样以服务端为准。

验证：`npm run check -w @adminui/react`（新增 `test/access-console-core.test.ts` 9 组）；浏览器验收在 quanxian 样板 CRM：`npm run test:crm-web -w quanxian`（销售 / 经理 / 老板 / 审计员四种身份走完 e2e 里配置的全部操作，10 个分区 + 4 个业务页 × 桌面 / 手机 390 / 深色截图，390 / 1440 不横向溢出）。

## 4.0.1（2026-10-01）

- 记录详情弹框打开时焦点放在弹框本身，不再落在「上一条」按钮上（`Dialog` 新增 `initialFocus="dialog"`）。
- 记录详情里的操作（主按钮和「更多」菜单）执行后默认关闭弹框，避免打开整页 / 终端 / 确认框时详情还盖在上面；要保持打开给 `RecordAction.keepOpen`。

## 4.0.0（2026-10-01）

大版本：**多维表格 BitableGrid 成为后台记录列表的标准表格，点开一行的详情统一成「记录详情三档」**。API 兼容，但有两处默认样子变了（升级要点见下方「从 3.x 升级到 4.0」）。包含 3.2.0-beta.1 的权限管理组件。

- **记录详情三档**（根入口：`RecordDetailDialog`、`RecordPage`、`RecordBody`、`RecordFieldList`、`RecordSectionView`、`useRecordDetail` + 纯函数 `peekRecordFields / suggestRecordLevel / splitRecordActions / recordTabs / readRecordParam / writeRecordParam / recordNavDelta`；手册现为 TABLES.md §3）：一份 `RecordLayout`（分区 + 概要栏 + 标签页 + 高亮指标 + 状态 + 操作 + 整页链接）三档通用——简要小弹框（560px）、详情大弹框（800–1280px，固定高度，手机全屏）、整页（指标卡 + 图表 + 标签页）；上一条 / 下一条（Alt+↑↓、J/K）；`?record=` 深链，切换只替换历史，返回键关闭。
- **变化 ①**：DataTable / BitableGrid 的 `expandRecord` 不再打开右侧抽屉，改为上面的居中弹框；新增 `layout / level / url`。`Dialog` 新增 `size="record"` 和 `headerActions / headerExtra / titleAdornment / bodyClassName`；`RowActions` 现在能放在弹框里。
- **变化 ②**：BitableGrid 默认 `height="fill"` 铺满窗口（扣掉页面自己的底部内边距）；弹窗 / 卡片里的小表用 `height="auto"`（随行数，`maxHeight` 封顶）。
- **变化 ③**：BitableGrid 键盘——Enter 编辑 / 进入格内链接 / 打开记录，空格打开记录，Shift+空格勾选行。
- **格内编辑**：字段 `editable / write / parse / validate / required / placeholder` + 表格 `onCellsChange`；按类型的编辑器（输入框、长文本、日期、单选 / 多选 / 人员选项列表、勾选框直接点），输入法选词安全；新值先显示、宿主保存失败按格回滚；左下角状态提示 + 撤销。
- **选区、复制粘贴、撤销**：拖选 / Shift / Ctrl+A；Ctrl+C 复制 TSV + HTML（Excel / WPS / 飞书互贴）；Ctrl+V 单值填满选区、块从左上角贴，只读 / 非法格跳过并说明；Delete 清空、Ctrl+X 剪切；Ctrl+Z / Ctrl+Y（100 步，撤销也走 `onCellsChange`）。
- **服务端数据**：`dataSource`（`load({ query, offset, limit, summaries, signal }) → { rows, total, summaries }`）分块加载 + 无限滚动、骨架行、单块失败重试、刷新保持总数；`capabilities` 声明服务端支持的工具。新子路径 **`@adminui/react/grid-query`**（后端用，无 React）：`parseGridQuery`（校验前端查询）、`applyGridQuery`（内存数据，结果与前端一致，同查询分块走缓存）、`buildGridSql`（PostgreSQL / MySQL / SQLite 的 where + 参数 + orderBy）、`validateFieldInput`。
- **架构**：纯规则 `grid-edit-core / grid-data-core / grid-sql / record-detail-core`（单测），界面拆成 `grid-cells / grid-editors / grid-toolbar / grid-popover / grid-view / grid-editing / grid-data`；手册 GRID.md。
- 性能：数字格式化缓存 Intl 格式器；搜索文本按行缓存（10 万行第二次搜索 18ms）。
- 验收：`npm run test:grid-edit`、`npm run test:record-detail`（新），`test:grid` / `test:business-tables` 按新约定更新。

### 从 3.x 升级到 4.0

API 兼容（不改代码能编译），但默认样子变了：

1. 展开记录不再是右侧抽屉：`expandRecord` 打开居中弹框——字段 ≤ 8 个用小弹框，多的用大弹框（约屏宽 72%，手机全屏），可「在新页面打开」。`expandRecord` 新增 `layout / level / url`。`Dialog` 新增 `size="record"`、`headerActions / headerExtra / titleAdornment / bodyClassName`；`RowActions` 可以放在弹框里。
2. BitableGrid 默认 `height="fill"` 铺满窗口；嵌在弹框 / 卡片里的改传 `height="auto"`（`maxHeight` 默认 480）或固定值。
3. BitableGrid 键盘：Enter 编辑 / 进入格内链接 / 打开记录；空格打开记录；勾选行用行号列上的空格或 Shift + 空格。
4. 新能力（可选）：字段 `editable / write / parse / validate / required / placeholder`，表格 `onCellsChange / peopleOptions / dataSource / blockSize / maxHeight / minHeight / fillOffset`；新子路径 `@adminui/react/grid-query`。
5. 「所有新列表用 BitableGrid」已在 4.4 撤回：后台管理主列表用 `DataTable`。

## 3.2.0-beta.1（2026-10-01，未打 tag）

**新增可选子路径 `@adminui/react/access`：权限管理组件**（quanxian 2.0 第 1 波第 ③ 路）。纯展示、靠 props 驱动，组件自己不请求数据；后续波次把它们接到 quanxian/server 的接口上，组成 `<AccessConsole>`。根入口完全不变（`AccessManager`、`PermissionGate`、`AuditLogPage` 照旧），不用的项目不会多打包一行。

- `CheckableTree`：三态勾选、「父子联动」开关（对应若依 `menu_check_strictly`）、展开 / 收起全部、搜索（命中的节点、它的上级和下级都显示）、只看已选、全选 / 全不选；键盘走 WAI-ARIA tree（整棵树一个 Tab 停靠点，方向键 / Home / End，空格或回车勾选）；`mode="single"` 做部门单选。
- `PermissionMatrix`：资源 × 动作表格，带范围的动作每格可以选范围（仅本人 / 本人及下属 / 本部门 / 本部门及以下 / 全部 / 指定部门）；每个资源可展开字段行（读 / 写 / 导出 / 脱敏，写导出脱敏都要先能读）；资源分组可折叠；整行 / 整组三态勾选；只读模式；和上次保存的值比，改过的格子高亮并计数，可「撤销改动」；`diffMatrix` + `matrixChangeItems` 直接喂给 `ConfirmDialog` 里的 `ChangeList`。
- `DataScopeDialog`：五档 + 指定部门（部门树）+「同时包含没有部门或负责人的记录」；指定部门一个都不选不能保存；`disabledTiers` 表达「不能宽于自己的范围」。
- `OrgTreePicker`（部门单选 / 多选，回显完整路径「总部 / 销售中心 / 华东区」）和 `UserTransfer`（左边部门树、可含下级，中间候选人、搜索，右边已选列表，可设上限，停用账号不能选）。
- `EffectiveAccessTable`：一个人每个权限码能不能用、范围、来源（角色 / 岗位 / 个人加授 / 记录授权 / 共享规则 / 超管 / 委派）、拦截原因（收窄规则 / 个人禁用 / 租户隔离 / 未开通 / 二次验证 / 已到期 / 未授予 / 条件不满足），可按结果、来源、「只看被拦截的」和关键词筛选，展开行看完整来源。
- `ExplainPanel`：Keycloak「Evaluate」式权限解释——选人、动作、资源（可填记录 ID），宿主跑 `access.explain` 后把结果传回来；显示判定路径（通过 / 不通过 / 未知 / 跳过）、允许来源、拦截原因、「字段为空所以结果未知、未知按拒绝」提示、生效条件、字段结果；改了条件会提示结果已过期。结果的数据形状 `ExplainResult` 定义在 `src/access/contracts.ts`，对齐 PLAN §3.6。
- `RecordTeamPanel`：一条记录的协作成员（负责人 / 编辑者 / 查看者、到期时间、继承自上级的只读），添加成员（按部门找人）、改级别和到期、移除要填原因、转移负责人（新负责人 + 原负责人保留为编辑者 / 查看者 / 不保留 + 原因）。
- `AccessRequestList`：申请单状态机（待审批 → 已批准 → 生效中 → 已到期 / 已收回，或已驳回 / 已撤回），批准时可改期限（快捷 1 / 7 / 30 / 90 天 / 永久），驳回和收回必须填原因，显示多级审批进度。
- `ReviewList`：权限复核，逐条或批量「保留 / 收回」，从没用过或超过 90 天没用的标出来，显示进度和截止时间，全部处理完才能提交。
- `AuditDiff`：审计记录的变更前后，「改动清单」（字段 · 新增 / 删除 / 修改 · 原值 · 新值，带 id 的数组按 id 对齐）或「前后对照」两栏 JSON；password / token / secret 之类的键一律显示「（已隐藏）」。
- 纯函数（可在服务端和测试里复用）：`indexTree / toggleNode / checkStates / normalizeLinked / halfChecked / visibleIds / visibleRows / fullPath`、`describeScope / validateScope / normalizeScope / sameScope / toggleFieldAbility / setCell / toggleRows / diffMatrix / matrixChangeItems`、`expiryState / requestActions / reviewProgress / staleGrant / filterEffective / explainSummary`、`diffJson / isSecretPath / formatJsonValue`。

同事会注意到：starter 菜单「系统」下多了「权限组件」演示页（七个分区，内存数据）；`styles.css` 末尾多了一节 `.aui-access-*` 样式（只作用于这些组件）。

风险：beta 版，组件的 props 和数据形状在接上 quanxian/server（W2 / W3）时可能还会调整；范围档的写法是 `own / subordinates / dept / dept_tree / all / custom`，内核现在叫 `self / self_and_subordinates …`，由宿主适配层对应。组件只管界面：服务端照样逐条鉴权、校验版本、写审计。

验证：`npm run check -w @adminui/react`（新增 `test/access-core.test.ts` 15 个用例）、`npm run test:access -w @adminui/react`（浏览器：矩阵改动计数 / 撤销 / 范围 / 字段 / 只读，树的键盘 / 三态 / 联动 / 搜索，范围对话框校验，部门完整路径，按部门找人，有效权限筛选，解释的「未知因为空」，转移负责人要原因，申请批准 / 驳回，复核，审计差异隐藏密钥，七个分区 360 / 390 / 1440 不横向溢出，深色对比度 ≥ 4.5，截图在 `test/artifacts/access/`）。

## 3.0.0（升级说明）

**表格行高固定**：DataTable 每一行一样高，格子放不下的内容截断，不再撑高行（以前行高是最小值，`wrap: true` 的列、竖着堆的文字和徽标会把一行撑到几百像素）。API 兼容。升级后逐个列表检查：

1. `wrap: true` 现在是截断：在行的行数内换行，放不下省略号；要多显示几行给 `rowHeight="medium" | "tall" | "extraTall"`，或让用户在 `TablePreferencesMenu rowHeightControl` 里选。
2. 要看完整内容：加 `expandRecord`；某列在详情里要不同的完整写法给列加 `detail`。行下面的短补充仍用 `expandable`。
3. 格子里竖着堆的东西会被裁掉：换成 `CellText`、`CellTags` / `CellPeople`（排不下 +N）、`CellLongText`，并给列 `width` / `maxWidth`。
4. `CellText` 在矮行（< 40px）只显示主文字，说明移到悬停提示。
5. 逃生口：十几行、不翻页的小列表要恢复「内容撑高行」，传 `rowHeight="auto"`。
6. 格子内容包在 `<div class="aui-cell">` 里；宿主写过 `td > xxx` 的样式改成 `td .xxx`。格子里自己折行的长按钮不再撑高行，改成一行按钮或放进操作列 / `RowActions`。

## 2.0.0（升级说明）

**精密企业成为唯一外观**：`design` 不再起作用（`"classic"` 已删除）。旧后台升级后直接换新外观：侧栏变品牌深色、控件变矮、面板无阴影、默认行高 40px（要 48px 传 `density="comfortable"`）。侧栏 `brand` / `profile` 槽里的按钮、输入框自动换成深色侧栏配色；宿主自己写的侧栏样式用 `currentColor` 或 `--aui-text` / `--aui-secondary`，不要写死深色文字。单序列图表、容差带、留存热力图改为跟随主题色，多序列仍用 `VIZ_CATEGORICAL`。SDK 自己去掉浏览器默认的 8px 页边距。（颜色与尺寸在 5.0 又换成了色卡和 36px 控件，见 5.0.0。）
