# 升级到 admin-ui 8.0

8.0 是干净的大版本：被新规范取代的旧写法全部删掉，**不留兼容层**；CSS 按组件拆开，页面只带用到的样式。

**旧项目升级可选，不强制**：钉着旧标签（如 `#adminUI-v8.8.0`）照常能用，谁要升谁升；新项目默认用最新。要升就照下面的表改，再跑一遍审计，审计零错误就改完了：

```bash
npx @adminui/react audit src          # 或 npx admin-ui-audit src；每条问题写 文件:行号 和 换成什么
```

审计新增 6 条规则：`removed-api`（删掉的导出）、`removed-prop`（删掉的属性 / 写法）、`removed-class`（删掉的类名，className 和 CSS 里都查）、`removed-css-var`（删掉的 CSS 变量）、`legacy-tone`（旧 7 色名当选项色用）、`deep-import`（引了 `src/` / `dist/` 里的文件）。下表就是审计用的同一张表（`scripts/ui-audit.mjs` 的 `MIGRATION_8`，单测保证两边一致）。

## 1. 样式怎么引（必看）

- `import "@adminui/react/styles.css"` 仍然写一次，**放在入口文件的第一个 import**。它现在只有 token、基础和核心组件。
- 其余样式跟着组件走：每个组件文件自己引它那一块 CSS（`#aui-css/<块>.css`，见 package.json `imports`）。打包器（Vite / webpack / esbuild）自动带上；Node、SSR、单测拿到的是空模块，不用配 CSS loader。
- 只从公开入口导入（`@adminui/react`、`/styles.css` 和 package.json `exports` 里的子路径）。以前直接引 `@adminui/react/src/styles/xxx.css` 的要删掉。
- 重的子路径（grid / views / charts / dashboard-builder / form-builder / access / markdown / excel）放在懒加载的路由里，它们的 JS 和 CSS 一起按需加载。三档起步方式见 INTEGRATION.md「项目规模」表。
- 宿主自己写的 `.aui-*` 覆盖本来就不允许（审计 `sdk-override`）；8.0 拆分后样式加载顺序跟着组件依赖走，靠「后写的覆盖先写的」的宿主样式更不可靠，缺什么回流 SDK。

## 2. 删掉的导出

| 旧 | 换成 |
|---|---|
| `ThemePicker` | `AppearanceButton`（外观：浅 / 深 / 跟随系统 + 色卡 + 字号） |
| `BatchBar` | DataTable `bulkActions` / `BulkActionBar`（底部浮条） |
| `ConflictDialog`、类型 `ConflictField` | `SaveConflictDialog`（rows: `FieldConflict[]`，保存时逐项选）或 `EditConflictNotice`（单格撞车） |
| `FieldTile`、`FieldTiles`、类型 `FieldTileProps` | `DescriptionList`（`DescriptionItem`）；记录详情用 RecordLayout / RecordDetail |
| 类型 `RecordDisplay`（`RecordLayout.display`） | 去掉 `display`：没给 `cards` 时是字段行（灰标签 + 值 + 悬停工具 + 就地编辑），要卡片分区给 `RecordLayout.cards`（C，版式 cards / single / split） |
| `LEGACY_TONE_MAP`、`LEGACY_OPTION_TONES`、类型 `LegacyOptionTone` | 选项色只有 20 个新名（`OptionTone`）；存量数据里的旧名用 `legacyTone(name)` 读 |
| `VIZ_CATEGORICAL` | `chartColors(palette).categorical`；构造器里写 `vizCategory(i)` |
| `VIZ_SEQUENTIAL` | `chartColors(palette).sequential`；构造器里写 `vizBrandStep(i)` |
| `VIZ_STATUS`、`vizColors` | `chartColors(palette).status` / `chartColors(palette)` |
| `resolveBrandColors`（`resolveBrandColors(option, "#hex")`） | `resolveVizTokens(option, chartColors(palette))`（AdminChart 已经自动做） |
| `shareSummary`、类型 `ShareSummaryChip` | `shareSentence(...)`、`ShareSentencePart`（一句话摘要） |
| `visibleComments`（`visibleComments(items, unresolvedOnly)`） | `filterComments(items, "open" \| "all")` |
| `DEFAULT_REACTIONS`、类型 `CommentReactionKind` | `COMMENT_REACTION_KEYS`、`CommentReactionKey`（回应固定 4 种：赞 / 收到 / 看过 / 有疑问） |
| `VIEW_TIER_BADGES`（views） | `VIEW_TIER_LABELS`，或 ViewTabs 自带的档位记号 |
| `LEGACY_ROW_HEIGHT`、`migrateLayout`（dashboard-builder） | `migrateDashboardSpec(spec)` |
| 类型 `Notice` | `NoticeOptions` + `notify.show({ title, description, tone, action })`（`notify("文字", "success")` 简写照旧可用） |

## 3. 删掉的属性 / 写法

| 旧 | 换成 |
|---|---|
| `<Button size="icon">` | `<IconButton label="…" icon={<X />} />`（`label` 必填 = 读屏名 + 气泡；默认 32，`size` md 36 / sm 28 / xs 24，`variant="outline"` 36 描边） |
| `<Button variant="link">` | 去别处：`<Link>`（`kind` quiet / anchor / next / external）；原地做事：`variant="text"` |
| `<Button title="…">`、`<IconButton title>` | 说明：`tooltip="…"`；禁用原因：`disabledReason="…"`（按钮仍可聚焦，气泡说原因）。SDK 组件上不再出现浏览器原生提示 |
| `<Link title>` | 说明写进链接文字，或 `{...tipProps("说明")}` |
| `<MenuButton size="icon">` | `<MoreMenu label="…" sections={…} />`（新 `icon` / `tooltip` / `align` / `className`） |
| AdminShell `profile` | `account` + `accountMenu` + `onSignOut`（左下头像菜单），切换公司用 `company` |
| CommentThread `unresolvedOnly` / `onUnresolvedOnlyChange` | `filter="open" \| "all"`（默认 open）/ `onFilterChange` |
| CommentThread `reactions` | 去掉（回应固定 4 种） |
| DataTable `batchMode` / `batchActions`、`TableCellContext.batchMode` | `bulkActions: BulkAction[]` + `bulkNote`（勾选后底部浮条，操作列照常可用） |
| SectionCard `unfilled` / `onFill` / `fillLabel` | 去掉；空字段收起交给记录详情（RecordLayout.cards），「补全」放进 `actions` |
| RecordHeader `variant` | 去掉：记录头部只有一种（白底紧凑） |
| `RecordLayout.display: "tiles" \| "list"` | 去掉（见上） |
| `<Avatar size="xs" \| "sm">` | `size={20}` / `size={24}` |
| `<AvatarStack size="sm" \| "md">` | `size={20}` / `size={32}` |
| `TranscriptCategory.tone`: brand / brandMid / solid / neutral | `"green" \| "teal" \| "greenSolid" \| "gray"`（同样的颜色） |
| `<WorkspaceLayout narrow="card">`（8.6 删掉） | 去掉这个属性：窄屏上下排一律贴边（原来的 `narrow="flush"` 现在是默认，写着也照常）；手机列表 → 详情两步走用 `narrow="steps"`。类型 `WorkspaceNarrowMode` = `"flush" \| "steps"` |
| 看板存档版本 1（64px 行）直接交给 `DashboardBuilder` / `normalizeDashboard` | 组件和 `normalizeDashboard` 只认版本 2：读存档时先 `migrateDashboardSpec(spec)`（或把表里的存档一次迁完） |

## 4. 选项色：只有 10 色 20 名

`OptionTone` = `green teal blue violet pink red orange yellow olive gray` 和各自的 `…Solid`。旧 7 色名不再是 API，写在代码里的要换：

| 旧名 | 新名 |
|---|---|
| `brand`、`success` | `green` |
| `brandMid` | `teal` |
| `info` | `blue` |
| `warning` | `yellow` |
| `danger` | `red` |
| `neutral` | `gray` |
| `solid` | `greenSolid` |

数据库里存着旧名不用迁移：读的时候 `legacyTone(stored) ?? stored`（`optionTone()` / `resolveOptionTone()` 也会把旧名读成新名）。注意只有**选项色**改了：`StatusBadge tone="danger"`、提示条 / 记录提醒的 `tone` 这些语义色照旧。

## 5. 删掉的类名

宿主代码 / 测试里按这些类名找元素、写样式的要换：

| 旧类名 | 换成 |
|---|---|
| `.aui-button-icon` | IconButton（`.aui-icon-btn`） |
| `.aui-button-link` | Link（`.aui-link`）或 Button `variant="text"` |
| `.aui-menu`、`.aui-menu-item`、`.aui-menu-icon`、`.aui-menu-label`、`.aui-menu-reason` | Menu（`.aui-cmenu`、`.aui-cmenu-item`） |
| `.aui-batchbar`、`.aui-batchbar-actions`、`.aui-bulkbar-dock` | BulkActionBar（`.aui-bulkbar`） |
| `.aui-ftile`、`.aui-ftiles` | DescriptionList（`.aui-desc`） |
| `.aui-scard-unfilled`、`.aui-scard-unfilled-label`、`.aui-scard-fill` | 去掉 |
| `.aui-profile`、`.aui-profile-mini`、`.aui-profile-pop` | `.aui-account-slot`、`.aui-acct-row`、`.aui-acct-pop` |
| `.aui-palette-choice`、`.aui-palette-choices`、`.aui-palette-swatch` | `.aui-appearance-pop` 里的色块 |
| `.aui-feed-row`、`.aui-feed-main`、`.aui-feed-time` | Timeline（`.aui-tl-*`） |
| `.aui-breadcrumbs-item`、`.aui-breadcrumbs-sep` | Breadcrumbs（`.aui-crumbs`） |

SDK 早已不渲染、8.0 一起删掉样式的类名（宿主写了也没用）：`aui-action-list`、`aui-cal-agenda`、`aui-cell-people`、`aui-chip-dot`、`aui-dbb-cfg-empty`、`aui-dbb-perm`、`aui-dbb-state`、`aui-dfilter-label`、`aui-dfilter-sep`、`aui-dl-item`、`aui-gov-cond-fields`、`aui-gov-cond-row`、`aui-gov-cond-rows`、`aui-grid-field-list`、`aui-grid-filter-row`、`aui-grid-filter-value`、`aui-grid-pop-foot`、`aui-grid-sort-row`、`aui-grid-vpick-avatar`、`aui-grid-vpick-chips`、`aui-grid-vpick-token`、`aui-input-tail`、`aui-link-external`、`aui-pform-affix`、`aui-pform-phone`、`aui-pform-prefix`、`aui-pz-tone`、`aui-share-note`、`aui-skel-paused`、`aui-tx-card`、`aui-vm-badge`、`aui-vm-create`、`aui-vm-kind`、`aui-vm-kinds`、`aui-vtab-lock`、`aui-vtabs-addtext`。

CSS 变量：8.0 没有删 `--aui-*` 变量（审计 `removed-css-var` 规则已就位，以后删变量时登记在同一张表）。

## 6. 样子变了的地方（不改代码也会看到）

- 图标按钮统一成 IconButton：幽灵图标按钮 36 → **32**（手机 40），外壳顶栏、记录头部、表格行里的都一样。
- 标签只剩圆角 6 的软方块：权限来源、授权名单的人、表格权限、操作记录状态、看板「北极星」、分享页上的标签、规则「已停用」、表单「已停止收集」、清单状态、人员块等原来的胶囊 / 描边标签都改了。
- 字号都在 8 档里：零碎的 13.5 / 15 / 16 / 11 / 11.5 等对到 13 / 14.5 / 12（侧栏菜单 13.5 → 13、分组标题 11.5 → 12、图标栏文字 11 → 12）；例外只有弹框标题 16、数字卡 28 / 24 / 20 和键帽、头像字、角标这类微标。
- 记录头部只有白底紧凑的一种（以前不给 `variant="flat"` 时是浅主色渐变底 + 发光头像）。
- 分页页码不再是图标按钮（`.aui-page-num`），样子不变。
- **8.6 页面贴边**：普通页面不再是灰底上的圆角卡片——外壳内容区不留内边距、白底；工作页、`PageBody`、`TabbedPage` 分区、`SplitLayout` / `SideNavLayout` / `DetailLayout` 栏里的 `Panel` / `ResourcePanel` / `DataTable` / `QueryBar` 没有边框、圆角、阴影和间距，块与块之间一条线，栏与栏之间一条竖线，最后的分栏（`ListDetailLayout`、`SplitLayout`、`SideNavLayout`）撑到页面底；分区标签行白底一条底线。看板（`KpiGrid` / `MetricGrid` / `DashboardSection` / `DashboardView`）照旧是卡片，放在自己的浅色画布带上。页面（或分区）里只有一个带标题的 `Panel` / `ResourcePanel` 时标题不再显示（只给读屏），数量、「?」和按钮并进筛选行或一条紧凑工具行（数量写成「共 N 条 / 个」）；只有一个分区的 `TabbedPage` 不出分区标签行（分区是 `role="region"`，名字 = 分区名）。项目里给内容区加回内边距、给面板加回边框的覆盖样式要删掉；按可见标题文字找元素的 e2e 改成按角色 / 名字找（标题还在，是读屏用的 h2）。

## 7. 体积前后对比

（`npm run size` / `scripts/size-budget.mjs`，消费方 Vite 生产构建、minify + gzip -9；JS 不含 react / react-dom 和重依赖 peer。）

| 入口 | JS 前 | JS 后 | CSS 前 | CSS 后 |
|---|---|---|---|---|
| 核心（AdminProvider + Button + Input + Dialog + styles.css） | 25.0 | 25.4 | 108.8 | 24.1 |
| 根入口全部导出 | 306.7 | 304.4 | 108.8 | 93.7 |
| `/charts` | 22.3 | 19.4 | 108.8 | 28.3 |
| `/markdown` | 9.4 | 9.3 | 108.8 | 24.3 |
| `/catalog` | 67.7 | 67.8 | 108.8 | 24.1 |
| `/excel` | 1.1 | 1.1 | 108.8 | 24.1 |
| `/grid` | 149.3 | 149.1 | 108.8 | 48.9 |
| `/access` | 219.8 | 219.6 | 108.8 | 58.7 |
| `/peizhi` | 87.1 | 87.1 | 108.8 | 41.4 |
| `/record-detail-spec` | 3.1 | 3.1 | 108.8 | 24.1 |
| `/grid-query` | 24.1 | 24.1 | 108.8 | 24.1 |
| `/views` | 118.2 | 118.2 | 108.8 | 48.2 |
| `/form-builder` | 96.0 | 96.0 | 108.8 | 47.5 |
| `/forms-public` | 54.4 | 54.8 | 108.8 | 34.7 |
| `/dashboard-builder` | 128.7 | 125.9 | 108.8 | 56.7 |
| 小档首屏（examples/small） | — | 66.7（含 react 126.6） | — | 30.0 |
| 中档首屏（examples/starter） | 548.8（含 react） | 118.8（含 react 179.3） | 108.8 | 37.4 |
| 大档首屏（examples/large） | — | 64.1（含 react 123.8） | — | 33.1 |

单位 KB（gzip -9）。前 = 7.19.0（styles.css 一个文件 108.8 KB，每个项目都整包带上）；后 = 8.0.0（styles.css 只剩核心，其余跟着组件按需带）。子路径一行的 CSS = styles.css + 这个子路径用到的块。小档 / 大档 7.19 没有样板，记「—」。7.19 的 starter 首屏是 548.8 KB JS（含 react）、108.8 KB CSS。门禁预算见 `scripts/size-budget.mjs` 的 `BUDGETS`（`npm run size`，`npm run check` 里也跑）。


## 8. 跟最新版的项目要做的

1. 依赖改到 `#adminUI-v8.8.0`，`npx @adminui/react audit apps modules platform packages` 清零（当前已知：`FieldTile/FieldTiles`（个人资料页）、`Button size="icon"`（多维表格仪表盘页）、`MenuButton size="icon"`（知识库标题栏）、bitable 原型里的旧色名）。
2. 入口里 `styles.css` 放第一行；模块前端按路由懒加载重子路径；删掉和 admin-ui 重复的手写样式。
3. 存量看板存档：读的时候 `migrateDashboardSpec`；存的选项色旧名用 `legacyTone` 读（或一次性迁移成新名）。
4. e2e 里按 `.aui-button-icon`、`.aui-menu-item`、`title` 属性找元素的改成按角色 / 名字找（IconButton 的名字就是 `label`）。
5. 升到 8.6：删掉 `WorkspaceLayout narrow="card"`（审计 `removed-prop` 会报）；删掉自己写的「卡片之间留缝」「内容区内边距」之类覆盖；页面里和页名重复的标题行不用再自己去（SDK 自动收），但自己拼的标题 div 要删。
