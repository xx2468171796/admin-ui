#!/usr/bin/env node
// admin-ui-audit: static drift check for projects that use @adminui/react (zero dependencies, Node 20+).
//   npx admin-ui-audit <src-dir>... [--json] [--baseline file] [--write-baseline]
// Scans .tsx / .ts / .jsx / .css (skips node_modules, dist, build, tests) and reports owner-rule drift
// with file:line, a rule id and a one-line Chinese fix hint. Exit 1 when an error-level finding is not
// in the baseline, 2 on usage errors. Suppress one line with a comment on that line or the line above:
//   // admin-ui-audit-ignore <id>[,<id>]: <reason>      /* admin-ui-audit-ignore <id>: <reason> */
// A file outside the SDK context (e.g. a VS Code webview) can use `admin-ui-audit-ignore-file <id>: <reason>` once.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Rule table: id → level + Chinese fix hint (shown to people). */
export const RULES = {
  "raw-control": { level: "error", hint: "不手写原生控件：用 SDK 的 Button / DataTable / CompactTable / Dialog / Choice / Input / Checkbox / Switch / UploadField" },
  "hard-colour": { level: "error", hint: "不写死颜色：用色卡变量 var(--aui-…)（阴影用 var(--aui-shadow-*)），换色走 AdminProvider palette" },
  "colour-bar": { level: "error", hint: "不加装饰色条：去掉 ≥2px 的彩色左 / 上边框或 inset 阴影，状态用浅底 + 边框色 + 文字色 + 图标（StatusBadge / InlineAlert）" },
  "sdk-override": { level: "error", hint: "不在项目里改 SDK 样式（.aui-* 选择器）：缺什么回流 SDK 发新版，或用组件已有的属性" },
  "row-actions": { level: "error", hint: "操作列用 RowActionBar（放得下就露、最多 3 个，其余进 ⋯），不在 render 里手摆 Button / RowActions" },
  "intro-paragraph": { level: "error", hint: "不写页面介绍段落：介绍写进 PageHeader / Panel 的 description（收成「?」），提示条只放要处理的事" },
  "page-title": { level: "error", hint: "外壳里的页面不显示大标题：去掉 showTitle（侧栏、工作标签、面包屑已经写了页名）；没有外壳的页面加忽略注释写明" },
  "native-date": { level: "warn", hint: "日期 / 时间不用原生 type=date / datetime-local / time 输入框：换成 DatePicker / DateTimePicker / TimeInput / DateRangePicker（值格式不变，见 catalog date-picker）" },
  "no-template": { level: "warn", hint: "这个页面没用页面模板的骨架块：先按 PAGE-TEMPLATES.md 选 T01–T17，用 ResourcePanel / Panel / StatStrip / SplitLayout … 拼" },
  "bad-ignore": { level: "error", hint: "忽略注释要写规则名和原因：// admin-ui-audit-ignore <规则>: <原因>" },
  "removed-api": { level: "error", hint: "8.0 删掉的导出：照 MIGRATION-8.md 换成新的（每条后面写了替代）" },
  "removed-prop": { level: "error", hint: "8.0 删掉的属性 / 写法：照提示换（MIGRATION-8.md）" },
  "removed-class": { level: "error", hint: "8.0 删掉的类名：不要再写 / 覆盖它，换成新组件（MIGRATION-8.md）" },
  "removed-css-var": { level: "error", hint: "8.0 删掉的 CSS 变量：换成提示里的新变量（MIGRATION-8.md）" },
  "legacy-tone": { level: "error", hint: "旧 7 色名（brand / brandMid / info / warning / danger / neutral / solid）不再是选项色：写新 10 色名；存量数据读的时候用 legacyTone()" },
  "deep-import": { level: "error", hint: "只从公开入口导入（@adminui/react、/styles.css 和 package.json exports 里的子路径），不要引 src / dist 里的文件" },
};

/**
 * admin-ui 8.0 migration table: every export / prop / class / CSS variable / tone name removed in 8.0
 * with its replacement. The audit rules below read it; MIGRATION-8.md shows the same table to people
 * (test/ui-audit.test.ts checks they agree). Keys are what a consumer project may still write.
 */
export const MIGRATION_8 = {
  /** Removed exports (any entry): name → replacement. */
  exports: {
    ThemePicker: "AppearanceButton（外观：浅 / 深 / 跟随系统 + 色卡 + 字号）",
    BatchBar: "DataTable bulkActions / BulkActionBar（底部浮条）",
    ConflictDialog: "SaveConflictDialog（保存时逐项选）或 EditConflictNotice（单格撞车）",
    FieldTile: "DescriptionList（键值列表）；记录详情用 RecordLayout / RecordDetail",
    FieldTiles: "DescriptionList（键值列表）；记录详情用 RecordLayout / RecordDetail",
    FieldTileProps: "DescriptionItem",
    LEGACY_TONE_MAP: "legacyTone(name)（只读旧数据）",
    LEGACY_OPTION_TONES: "legacyTone(name)（只读旧数据）",
    LegacyOptionTone: "OptionTone（20 个新色名）；旧数据用 legacyTone 读",
    VIZ_CATEGORICAL: "chartColors(palette).categorical / 构造器里 vizCategory(i)",
    VIZ_SEQUENTIAL: "chartColors(palette).sequential / 构造器里 vizBrandStep(i)",
    VIZ_STATUS: "chartColors(palette).status",
    vizColors: "chartColors(palette)",
    resolveBrandColors: "resolveVizTokens(option, chartColors(palette))（AdminChart 已自动做）",
    shareSummary: "shareSentence(settings, …)（一句话摘要）",
    ShareSummaryChip: "ShareSentencePart",
    visibleComments: "filterComments(items, \"open\" | \"all\")",
    DEFAULT_REACTIONS: "COMMENT_REACTION_KEYS（回应固定 4 种，不能自定义）",
    CommentReactionKind: "CommentReactionKey",
    VIEW_TIER_BADGES: "VIEW_TIER_LABELS（或 ViewTabs 自带的档位记号）",
    LEGACY_ROW_HEIGHT: "migrateDashboardSpec(spec)（旧看板存档先迁移）",
    migrateLayout: "migrateDashboardSpec(spec)",
    Notice: "NoticeOptions + notify.show(...)",
    ConflictField: "FieldConflict（SaveConflictDialog rows）",
    RecordDisplay: "去掉 RecordLayout.display：没有 cards 时是字段行，要卡片分区给 RecordLayout.cards",
  },
  /** Removed props: component → prop → replacement. `value` limits the match to that literal value. */
  props: [
    { component: "Button", prop: "size", value: "icon", hint: "图标按钮用 IconButton（label 必填 = 读屏名 + 气泡）" },
    { component: "WorkspaceLayout", prop: "narrow", value: "card", hint: "8.6 删掉：窄屏上下排一律贴边，去掉这个属性（手机两步走用 narrow=\"steps\"）" },
    { component: "Button", prop: "variant", value: "link", hint: "去别处用 Link，原地做事用 variant=\"text\"" },
    { component: "Button", prop: "title", hint: "Button 不再收 title：说明用 tooltip=，禁用原因用 disabledReason=" },
    { component: "IconButton", prop: "title", hint: "IconButton 的 label 就是气泡；另写说明用 tooltip=" },
    { component: "MenuButton", prop: "size", value: "icon", hint: "只有图标的菜单用 MoreMenu（icon= 换图标）" },
    { component: "AdminShell", prop: "profile", hint: "account + accountMenu + onSignOut（左下头像菜单），切公司用 company" },
    { component: "CommentThread", prop: "unresolvedOnly", hint: "filter=\"open\" | \"all\"（默认 open）" },
    { component: "CommentThread", prop: "onUnresolvedOnlyChange", hint: "onFilterChange" },
    { component: "CommentThread", prop: "reactions", hint: "回应固定 4 种（赞 / 收到 / 看过 / 有疑问），去掉这个属性" },
    { component: "DataTable", prop: "batchMode", hint: "bulkActions（勾选后底部浮条）" },
    { component: "DataTable", prop: "batchActions", hint: "bulkActions: BulkAction[] + bulkNote" },
    { component: "SectionCard", prop: "unfilled", hint: "去掉：空字段收起由记录详情（RecordLayout.cards）负责" },
    { component: "SectionCard", prop: "onFill", hint: "去掉：把「补全」放进 actions" },
    { component: "SectionCard", prop: "fillLabel", hint: "去掉：把「补全」放进 actions" },
    { component: "RecordHeader", prop: "variant", hint: "去掉：记录头部只有一种（白底紧凑）" },
    { component: "Avatar", prop: "size", value: "xs", hint: "size={20}" },
    { component: "Avatar", prop: "size", value: "sm", hint: "size={24}" },
    { component: "AvatarStack", prop: "size", value: "sm", hint: "size={20}" },
    { component: "AvatarStack", prop: "size", value: "md", hint: "size={32}" },
  ],
  /** Removed object keys / values in props objects. */
  keys: [
    { pattern: "display\\s*:\\s*[\"'](tiles|list)[\"']", hint: "RecordLayout.display 已删：没有 cards 时就是字段行；要卡片分区给 RecordLayout.cards" },
    { pattern: "\\bbatchMode\\s*:", hint: "TableCellContext.batchMode 已删（勾选时操作列照常可用）" },
  ],
  /** Removed class names (in className strings and CSS selectors): class → replacement. */
  classes: {
    "aui-button-icon": "IconButton（.aui-icon-btn）",
    "aui-button-link": "Link（.aui-link）或 Button variant=\"text\"",
    "aui-menu": "Menu（.aui-cmenu）",
    "aui-menu-item": "Menu（.aui-cmenu-item）",
    "aui-menu-icon": "Menu（.aui-cmenu-item 里的图标）",
    "aui-menu-label": "Menu",
    "aui-menu-reason": "Menu 项的 disabledReason",
    "aui-batchbar": "BulkActionBar（.aui-bulkbar）",
    "aui-batchbar-actions": "BulkActionBar（.aui-bulkbar）",
    "aui-bulkbar-dock": "BulkActionBar 自带外框",
    "aui-ftile": "DescriptionList（.aui-desc）",
    "aui-ftiles": "DescriptionList（.aui-desc）",
    "aui-scard-unfilled": "去掉（记录详情 C 自己收起空字段）",
    "aui-scard-unfilled-label": "去掉",
    "aui-scard-fill": "去掉",
    "aui-profile": "AdminShell account（.aui-account-slot）",
    "aui-profile-mini": "AdminShell account（.aui-acct-row）",
    "aui-profile-pop": "AccountMenu（.aui-acct-pop）",
    "aui-palette-choice": "AppearanceButton（.aui-appearance-pop 里的色块）",
    "aui-palette-choices": "AppearanceButton",
    "aui-palette-swatch": "AppearanceButton",
    "aui-feed-row": "Timeline / ActivityFeed（.aui-tl-*）",
    "aui-feed-main": "Timeline（.aui-tl-*）",
    "aui-feed-time": "Timeline（.aui-tl-*）",
    "aui-breadcrumbs-item": "Breadcrumbs（.aui-crumbs）",
    "aui-breadcrumbs-sep": "Breadcrumbs（.aui-crumbs）",
    "aui-action-list": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-cal-agenda": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-cell-people": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-chip-dot": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-dbb-cfg-empty": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-dbb-perm": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-dbb-state": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-dfilter-label": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-dfilter-sep": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-dl-item": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-gov-cond-fields": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-gov-cond-row": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-gov-cond-rows": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-field-list": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-filter-row": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-filter-value": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-pop-foot": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-sort-row": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-vpick-avatar": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-vpick-chips": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-grid-vpick-token": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-input-tail": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-link-external": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-pform-affix": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-pform-phone": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-pform-prefix": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-pz-tone": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-share-note": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-skel-paused": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-tx-card": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-vm-badge": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-vm-create": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-vm-kind": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-vm-kinds": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-vtab-lock": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
    "aui-vtabs-addtext": "（SDK 早已不渲染它，删掉这条样式 / 类名）",
  },
  /** CSS variables removed in 8.0. */
  cssVars: {},
  /** Older stored tone names → the new tone (data may still hold them: read with legacyTone). */
  tones: { brand: "green", brandMid: "teal", info: "blue", warning: "yellow", danger: "red", neutral: "gray", solid: "greenSolid", success: "green" },
  /** Entry points: anything else under the package is internal. */
  entries: ["", "styles.css", "charts", "markdown", "catalog", "excel", "grid", "access", "peizhi", "settings", "record-detail-spec", "grid-query", "views", "form-builder", "forms-public", "dashboard-builder", "org-picker"],
};


/** Page-template building blocks (PAGE-TEMPLATES.md); a page with PageHeader should use at least one. */
export const TEMPLATE_BLOCKS = [
  "ResourcePanel", "Panel", "DataTable", "StatStrip", "TodoInbox", "SplitLayout", "SideNavLayout", "ListDetailLayout",
  "WorkspaceLayout", "WizardLayout", "GraphLayout", "LogTimeline", "WorkItemList", "WorkItemCard", "TabbedPage", "KpiGrid",
  "MetricGrid", "DashboardSection", "RecordPage", "AccessConsole", "AccessManager", "AuditLogPage", "GovernanceConsole",
  "BitableGrid", "SectionCard", "CompactTable", "ActivityFeed", "ActionList", "Pane",
  // bt/templates: T15 / T16 / T17 frames
  "RailShell", "BuilderLayout", "PublicPageLayout",
];

const SOURCE_EXT = new Set([".tsx", ".ts", ".jsx", ".css"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git", ".vite", "__tests__", "__mocks__", "test", "tests", "fixtures"]);
const isTestFile = (name) => /\.(test|spec|stories)\.[jt]sx?$/.test(name) || name.endsWith(".d.ts");

// CSS named colours (CSS Color 4) minus the allowed keywords transparent / currentColor.
const NAMED = new Set(("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen").split(" "));
const HEX = /(?<![\w&#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/i;
const FUNC = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i;
const COLOUR_PROP = /(^|-)(color|background|border|outline|shadow|fill|stroke|column-rule|text-decoration)/i;
const COLOUR_KEY = /color|background|border|outline|shadow|fill|stroke/i;
const NEUTRAL_LINE = /var\(--aui-(border|line|control-border|rail-line)\)|\btransparent\b|\bnone\b/i;
const IGNORE = /admin-ui-audit-ignore(-file)?\s+([a-z][a-z0-9-]*(?:\s*,\s*[a-z][a-z0-9-]*)*)\s*(?::\s*(.*?))?\s*(?:\*\/|$)/;

/** Strip var(...) / url(...) / quoted strings from a CSS value before looking for colours. */
function colourScope(value) {
  return value.replace(/url\([^)]*\)/gi, " ").replace(/var\(\s*--[\w-]+/g, " ").replace(/(["'])(?:(?!\1).)*\1/g, " ");
}
/** Does a CSS value (or inline style value) contain a hard-coded colour? */
export function hasHardColour(value, prop = "color") {
  if (/var\(\s*--aui-/.test(value)) return false;
  const v = colourScope(value);
  if (HEX.test(v) || FUNC.test(v)) return true;
  if (!COLOUR_PROP.test(prop) && !prop.startsWith("--")) return false;
  return v.toLowerCase().split(/[^a-z]+/).some((w) => NAMED.has(w));
}
/** Width in px of a border shorthand / inset shadow, or 0. */
function barWidth(value) {
  const m = value.match(/(\d+(?:\.\d+)?)px/);
  if (m) return Number(m[1]);
  return /\bthick\b/.test(value) ? 5 : /\bmedium\b/.test(value) ? 3 : 0;
}
function isColourBar(prop, value) {
  const p = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).toLowerCase();
  if (/^border-(left|top|inline-start|block-start)$/.test(p)) return barWidth(value) >= 2 && !NEUTRAL_LINE.test(value);
  if (p === "box-shadow") {
    const m = value.match(/\binset\s+(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?\s+0(?:px)?\b/);
    return !!m && (Math.abs(Number(m[1])) >= 2 || Math.abs(Number(m[2])) >= 2) && (Number(m[1]) === 0 || Number(m[2]) === 0) && !NEUTRAL_LINE.test(value);
  }
  return false;
}

/** Line index helper. */
function lineOf(starts, index) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}
const lineStarts = (text) => [0, ...[...text.matchAll(/\n/g)].map((m) => m.index + 1)];

/**
 * Blank out comments (→ `code`) and additionally string contents (→ `bare`), keeping offsets and newlines.
 * Quotes only open a string after an operator / bracket, so apostrophes in JSX text ("don't") stay text.
 */
export function maskSource(text) {
  const code = text.split("");
  const bare = text.split("");
  const blank = (arr, from, to) => { for (let i = from; i < to; i++) if (arr[i] !== "\n") arr[i] = " "; };
  const stack = []; // template-literal nesting: brace depth inside ${ … }
  let depth = 0;
  let i = 0;
  const prevSignificant = (at) => { let j = at - 1; while (j >= 0 && /\s/.test(text[j])) j--; return j < 0 ? "" : text[j]; };
  const opensString = (at) => { const p = prevSignificant(at); return p === "" || /[=(\[{,:;?!&|+\-*%<>~^}]/.test(p) || /\b(return|case|from|import|typeof|in|of|else|yield|await)$/.test(text.slice(Math.max(0, at - 10), at).trimEnd()); };
  const readTemplate = (start) => { // start at the char after ` ; returns index after closing ` or at ${
    let j = start;
    while (j < text.length) {
      if (text[j] === "\\") { j += 2; continue; }
      if (text[j] === "`") return { end: j, closed: true };
      if (text[j] === "$" && text[j + 1] === "{") return { end: j, closed: false };
      j++;
    }
    return { end: j, closed: true };
  };
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === "/" && n === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      blank(code, i, stop); blank(bare, i, stop); i = stop; continue;
    }
    if (c === "/" && n === "/" && text[i - 1] !== ":" && text[i - 1] !== "\\") {
      let stop = text.indexOf("\n", i);
      if (stop < 0) stop = text.length;
      blank(code, i, stop); blank(bare, i, stop); i = stop; continue;
    }
    if ((c === '"' || c === "'") && opensString(i)) {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      blank(bare, i + 1, j); i = j + 1; continue;
    }
    if (c === "`" && (opensString(i) || /[\w$)\]]/.test(prevSignificant(i)))) {
      const { end, closed } = readTemplate(i + 1);
      blank(bare, i + 1, end);
      if (closed) { i = end + 1; continue; }
      stack.push(depth); depth = 0; i = end + 2; continue;
    }
    if (stack.length && c === "{") { depth++; i++; continue; }
    if (stack.length && c === "}") {
      if (depth > 0) { depth--; i++; continue; }
      depth = stack.pop();
      const { end, closed } = readTemplate(i + 1);
      blank(bare, i + 1, end);
      if (closed) { i = end + 1; continue; }
      stack.push(depth); depth = 0; i = end + 2; continue;
    }
    i++;
  }
  return { code: code.join(""), bare: bare.join("") };
}

/** Index just past the `>` that closes a JSX opening tag starting at `from` (`bare` text: strings blanked). */
function tagEnd(bare, from) {
  let depth = 0;
  for (let i = from + 1; i < bare.length; i++) {
    const c = bare[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && bare[i - 1] !== "=") return i + 1;
  }
  return bare.length;
}
/** Matching close brace for the `{` at `open`, -1 if unbalanced. */
function matchBrace(bare, open) {
  let depth = 0;
  for (let i = open; i < bare.length; i++) {
    if (bare[i] === "{") depth++;
    else if (bare[i] === "}" && --depth === 0) return i;
  }
  return -1;
}
/** Unmatched `{` before `at` (start of the enclosing object literal), -1 if none. */
function enclosingOpen(bare, at) {
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    if (bare[i] === "}") depth++;
    else if (bare[i] === "{") { if (depth === 0) return i; depth--; }
  }
  return -1;
}

// ---------------------------------------------------------------- 8.0 migration rules

const MIGRATION_RULES = new Set(["removed-api", "removed-prop", "removed-class", "removed-css-var", "legacy-tone", "deep-import"]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, (c) => `\\${c}`);
// ---------------------------------------------------------------- package names (npm aliases)

const OWN_NAME = (() => {
  try { return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).name; } catch { return undefined; }
})();
/** Names the SDK is published / installed under; imports written with any of them are audited. */
export const DEFAULT_PACKAGES = [...new Set([OWN_NAME, "@adminui/react", "@adminui/react"].filter(Boolean))];
const PUBLISHED_FILE = /(?:adminui-react-|adminui-react-)\d/;

/**
 * Dependency names in a package.json that point at the SDK, also under another name: `"x": "npm:@adminui/react@^8"`,
 * a release tarball URL / `file:` path of the package, or one of the known names itself.
 */
export function packageAliases(manifest) {
  const out = new Set();
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [name, spec] of Object.entries(manifest?.[field] ?? {})) {
      if (typeof spec !== "string") continue;
      const target = /^npm:(@?[^@]+)/.exec(spec)?.[1];
      if (DEFAULT_PACKAGES.includes(name) || (target && DEFAULT_PACKAGES.includes(target)) || PUBLISHED_FILE.test(spec)) out.add(name);
    }
  }
  return [...out];
}

/** Known names + aliases from every package.json from `target` up to the filesystem root. */
export function detectPackages(target) {
  const names = new Set(DEFAULT_PACKAGES);
  let dir = resolve(target);
  try { if (statSync(dir).isFile()) dir = dirname(dir); } catch { return [...names]; }
  for (;;) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      try { for (const n of packageAliases(JSON.parse(readFileSync(file, "utf8")))) names.add(n); } catch { /* not JSON: skip */ }
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return [...names];
}

const pkgPattern = (packages) => `(?:${[...new Set(packages)].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})`;

const removedClassRe = () => new RegExp(`(?<![\\w-])(${Object.keys(MIGRATION_8.classes).sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?![\\w-])`, "g");
const OLD_TONE = "brand|brandMid|info|warning|danger|neutral|solid|success";

/** Attributes at the top level of a JSX opening tag: name, literal string value (or null) and offset. */
function tagAttrs(code, bare, start, end) {
  const out = [];
  let depth = 0;
  for (let i = start + 1; i < end; i++) {
    const c = bare[i];
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; continue; }
    if (depth !== 0 || !/\s/.test(c)) continue;
    const m = /^\s+([A-Za-z_][\w-]*)(\s*=\s*)?/.exec(code.slice(i, end));
    if (!m) continue;
    const at = i + m[0].length;
    let value = null;
    if (m[2]) {
      const v = /^(?:\{\s*)?(["'])([^"'\n]*)\1/.exec(code.slice(at, end));
      if (v) value = v[2];
    }
    out.push({ name: m[1], value, index: i + m[0].indexOf(m[1]) });
    i += m[0].length - 1;
  }
  return out;
}

/** The innermost `{ … }` around `index` reads like a select option (`value | id | key` + `label`). */
function optionShaped(code, index) {
  let depth = 0;
  let open = -1;
  for (let i = index; i >= 0 && index - i < 400; i--) {
    if (code[i] === "}") depth++;
    else if (code[i] === "{") { if (depth === 0) { open = i; break; } depth--; }
  }
  if (open < 0) return false;
  let close = code.indexOf("}", index);
  if (close < 0) close = index + 120;
  const obj = code.slice(open, close);
  // select options (GridSelectOption / SelectOption / Choice options) carry `value` + `label`
  // (a literal non-empty `value`: stat rows `value: n` and form drafts `value: ""` are not options)
  return /\bvalue\s*:\s*(["'`])[^"'`\n]+\1/.test(obj) && /\blabel\s*:/.test(obj) && !/\bunit\s*:|\bnote\s*:/.test(obj);
}

function audit8Script(code, bare, push, packages) {
  const pkg = pkgPattern(packages);
  // removed-api: a removed name imported from any entry, or rendered as a component.
  for (const m of code.matchAll(new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*["']${pkg}(?:\\/[\\w-]+)?["']`, "g"))) {
    let offset = m.index + m[0].indexOf("{") + 1;
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
      if (name && Object.hasOwn(MIGRATION_8.exports, name)) push("removed-api", offset + part.indexOf(name), `${name} → ${MIGRATION_8.exports[name]}`);
      offset += part.length + 1;
    }
  }
  // deep-import: anything under the package that is not a public entry.
  for (const m of code.matchAll(new RegExp(`(?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*)["'](${pkg})\\/([^"']+)["']`, "g"))) {
    if (!MIGRATION_8.entries.includes(m[2])) push("deep-import", m.index, `${m[1]}/${m[2]} → 从 ${m[1]} 或 package.json exports 里的子路径导入`);
  }
  // removed-prop: props of SDK components that 8.0 removed (optionally only one literal value).
  const byComponent = new Map();
  for (const p of MIGRATION_8.props) byComponent.set(p.component, [...(byComponent.get(p.component) ?? []), p]);
  for (const m of bare.matchAll(new RegExp(`<(${[...byComponent.keys()].join("|")})(?=[\\s/>])`, "g"))) {
    const attrs = tagAttrs(code, bare, m.index, tagEnd(bare, m.index));
    for (const p of byComponent.get(m[1])) {
      const hit = attrs.find((a) => a.name === p.prop && (p.value === undefined || a.value === p.value));
      if (hit) push("removed-prop", hit.index, `<${m[1]} ${p.prop}${p.value !== undefined ? `="${p.value}"` : ""}> → ${p.hint}`);
    }
  }
  for (const k of MIGRATION_8.keys) for (const m of code.matchAll(new RegExp(k.pattern, "g"))) if (bare[m.index] !== " ") push("removed-prop", m.index, `${m[0]} → ${k.hint}`);
  // removed-class: class names inside strings (className, template literals, querySelector).
  for (const m of code.matchAll(removedClassRe())) if (bare[m.index] === " ") push("removed-class", m.index, `${m[1]} → ${MIGRATION_8.classes[m[1]]}`);
  // legacy-tone: an old tone name as a select option's colour, or passed to the option-tone helpers.
  for (const m of code.matchAll(new RegExp(`\\btone\\s*:\\s*(["'])(${OLD_TONE})\\1`, "g"))) {
    if (bare[m.index] !== " " && optionShaped(code, m.index)) push("legacy-tone", m.index, `tone: "${m[2]}" → "${MIGRATION_8.tones[m[2]]}"`);
  }
  for (const m of code.matchAll(new RegExp(`\\b(optionTone|toneHue|isSolidTone|resolveOptionTone)\\s*\\(\\s*(?:\\{\\s*tone\\s*:\\s*)?(["'])(${OLD_TONE})\\2`, "g"))) {
    push("legacy-tone", m.index, `${m[1]}("${m[3]}") → "${MIGRATION_8.tones[m[3]]}"`);
  }
}

function audit8Css(css, push, packages) {
  for (const m of css.matchAll(removedClassRe())) if (css[m.index - 1] === ".") push("removed-class", m.index - 1, `.${m[1]} → ${MIGRATION_8.classes[m[1]]}`);
  for (const [name, hint] of Object.entries(MIGRATION_8.cssVars)) {
    for (const m of css.matchAll(new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-])`, "g"))) push("removed-css-var", m.index, `${name} → ${hint}`);
  }
  for (const m of css.matchAll(new RegExp(`@import\\s+(?:url\\()?["'](${pkgPattern(packages)})\\/([^"')]+)["']`, "g"))) if (!MIGRATION_8.entries.includes(m[2])) push("deep-import", m.index, `${m[1]}/${m[2]} → 从 ${m[1]} 或 package.json exports 里的子路径导入`);
}

function auditScript(text, push, packages) {
  const { code, bare } = maskSource(text);
  const at = (re, src = bare) => [...src.matchAll(re)];

  // raw-control: native controls in JSX.
  for (const m of at(/<(button|table|dialog|select|input|textarea)(?=[\s/>])/g)) {
    if (m[1] === "input" || m[1] === "textarea") {
      const tag = code.slice(m.index, tagEnd(bare, m.index));
      if (m[1] === "input" && /\btype\s*=\s*\{?\s*["'](hidden|file)["']/.test(tag)) continue;
    }
    push("raw-control", m.index, `<${m[1]}>`);
  }

  // native-date: the kit Input used as a native date / time picker (a raw <input> is already raw-control).
  for (const m of at(/<Input(?=[\s/>])/g)) {
    const tag = code.slice(m.index, tagEnd(bare, m.index));
    if (/\btype\s*=\s*\{?\s*["'](date|datetime-local|time|month|week)["']/.test(tag)) push("native-date", m.index, "<Input type=date>");
  }

  // hard-colour / colour-bar in inline styles.
  for (const m of at(/\bstyle\s*=\s*\{\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchBrace(bare, open);
    if (close < 0) continue;
    const block = code.slice(open, close);
    for (const p of block.matchAll(/([A-Za-z_$][\w$]*|["'][\w-]+["'])\s*:\s*(["'`])((?:(?!\2)[^\n])*)\2/g)) {
      const key = p[1].replace(/["']/g, "");
      const value = p[3];
      const index = open + p.index;
      if (isColourBar(key, value)) push("colour-bar", index, `${key}: ${value}`);
      else if (hasHardColour(value, COLOUR_KEY.test(key) ? "color" : key)) push("hard-colour", index, `${key}: ${value}`);
    }
    // Colours in conditional values (`color: ok ? "#2e5d4a" : "red"`): any literal hex / rgb() in the block.
    for (const s of block.matchAll(/(["'`])((?:(?!\1)[^\n])*)\1/g))
      if (!/var\(\s*--aui-/.test(s[2]) && (HEX.test(colourScope(s[2])) || FUNC.test(colourScope(s[2])))) push("hard-colour", open + s.index, s[2]);
  }
  // hard-colour in colour attributes (fill="#fff", stroke="red", color="rgb(…)").
  for (const m of at(/\s(fill|stroke|stopColor|stop-color|floodColor|lightingColor|color|bgcolor|background)\s*=\s*\{?\s*(["'])([^"'\n]*)\2/g, code)) {
    if (bare[m.index + m[0].indexOf("=")] !== "=") continue; // inside a string or comment
    const [, attr, , value] = m;
    const paint = !/^(color|bgcolor|background)$/.test(attr);
    const scoped = colourScope(value);
    if (paint ? hasHardColour(value, "color") : (HEX.test(scoped) || FUNC.test(scoped)) && !/var\(\s*--aui-/.test(value))
      push("hard-colour", m.index + 1, `${attr}="${value}"`);
  }

  // row-actions: an actions column whose render lays out its own buttons.
  for (const m of at(/\bkind\s*:\s*(["'])actions\1/g, code)) {
    const open = enclosingOpen(bare, m.index);
    const close = open < 0 ? -1 : matchBrace(bare, open);
    if (close < 0) continue;
    const body = bare.slice(open, close);
    const hit = body.search(/<(Button|RowActions)(?=[\s/>])/);
    if (hit >= 0) push("row-actions", open + hit, "kind: \"actions\"");
  }

  // PageHeader-based rules.
  const headers = at(/<PageHeader(?=[\s/>])/g);
  for (const h of headers) {
    const end = tagEnd(bare, h.index);
    const tag = bare.slice(h.index, end);
    if (/\bshowTitle\b(?!\s*=\s*\{\s*false\s*\})/.test(tag)) push("page-title", h.index + tag.indexOf("showTitle"), "showTitle");
    let after = end;
    if (bare[end - 2] !== "/") {
      const closeTag = bare.indexOf("</PageHeader>", end);
      if (closeTag >= 0) after = closeTag + "</PageHeader>".length;
    }
    const blockRe = new RegExp(`<(${TEMPLATE_BLOCKS.join("|")})(?=[\\s/>])|</PageBody>|\\n\\s*\\);?\\s*\\n\\s*\\}`, "g");
    blockRe.lastIndex = after;
    const stop = blockRe.exec(bare);
    const slice = bare.slice(after, Math.min(stop ? stop.index : bare.length, after + 2000));
    for (const p of slice.matchAll(/<p(?=[\s>])|<(?:div|span)\s[^>]*className\s*=\s*\{?\s*["'][^"']*/g)) {
      const raw = code.slice(after + p.index, tagEnd(bare, after + p.index));
      if (p[0] === "<p" || /className\s*=\s*\{?\s*["'][^"']*\b(aui-note|intro|lead|page-desc|description|subtitle)\b/.test(raw)) push("intro-paragraph", after + p.index, raw.slice(0, 60));
    }
  }
  if (headers.length && !new RegExp(`<(${TEMPLATE_BLOCKS.join("|")})(?=[\\s/>])`).test(bare)) push("no-template", headers[0].index, "<PageHeader>");
  audit8Script(code, bare, push, packages);
}

/** Split on `sep` at parenthesis depth 0. */
function splitTop(text, sep) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && sep.test(c)) { out.push(text.slice(from, i)); from = i + 1; }
  }
  out.push(text.slice(from));
  return out.map((x) => x.trim()).filter(Boolean);
}
/**
 * A selector patches SDK styles when the element it styles (last compound) is an SDK `.aui-*` element, or is
 * an anonymous child of one (`.aui-panel > * + *`). Own classes placed inside SDK markup (`.aui-table .mine`) are fine.
 */
export function overridesSdk(selector) {
  return splitTop(selector, /,/).some((part) => {
    if (!/\.aui-[a-z0-9]/.test(part)) return false;
    const compounds = splitTop(part.replace(/\s*([>+~])\s*/g, " "), /\s/);
    const subject = compounds[compounds.length - 1] ?? "";
    if (/\.aui-[a-z0-9]/.test(subject)) return true;
    return !/[.#]/.test(subject.replace(/:[a-z-]+\([^)]*\)/g, ""));
  });
}

function auditCss(text, push, packages) {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  audit8Css(css, push, packages);
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c !== "{" && c !== "}" && c !== ";") continue;
    const seg = css.slice(start, i);
    const lead = seg.search(/\S/);
    const segStart = start + Math.max(lead, 0);
    start = i + 1;
    if (lead < 0) continue;
    const s = seg.trim();
    if (c === "{") {
      if (!s.startsWith("@") && overridesSdk(s)) push("sdk-override", segStart, s.replace(/\s+/g, " ").slice(0, 80));
      continue;
    }
    const colon = s.indexOf(":");
    if (colon < 0 || s.startsWith("@")) continue;
    const prop = s.slice(0, colon).trim();
    const value = s.slice(colon + 1).trim();
    if (!/^(--)?[a-z-]+$/i.test(prop)) continue;
    if (isColourBar(prop, value)) push("colour-bar", segStart, `${prop}: ${value}`);
    else if (hasHardColour(value, prop)) push("hard-colour", segStart, `${prop}: ${value}`);
  }
}

/**
 * Audit one file's text. `file` decides the language (.css vs script); `options.packages` = package names whose
 * imports are checked (default DEFAULT_PACKAGES; auditPaths adds npm aliases from package.json). Returns findings with 1-based lines.
 */
export function auditText(text, file = "file.tsx", options = {}) {
  const packages = options.packages ?? DEFAULT_PACKAGES;
  const starts = lineStarts(text);
  const lines = text.split("\n");
  const raw = [];
  const push = (rule, index, detail) => raw.push({ rule, line: lineOf(starts, index), detail });
  if (extname(file).toLowerCase() === ".css") auditCss(text, push, packages);
  else auditScript(text, push, packages);

  // Suppression comments: same line or the line above (or the whole file with -file, for files that live
  // outside the SDK context, e.g. a VS Code webview). A suppression without a reason is itself a finding.
  const ignores = new Map(); // line → Set(rule)
  const fileIgnores = new Set(); // `admin-ui-audit-ignore-file <id>: <reason>` anywhere in the file
  const findings = [];
  lines.forEach((ln, idx) => {
    if (!ln.includes("admin-ui-audit-ignore")) return;
    const m = ln.match(IGNORE);
    if (!m) { findings.push({ rule: "bad-ignore", line: idx + 1, detail: ln.trim().slice(0, 80) }); return; }
    const [, wholeFile, list, reason] = m;
    const ids = list.split(",").map((s) => s.trim());
    if (!reason || !reason.trim() || ids.some((id) => !RULES[id] || id === "bad-ignore")) { findings.push({ rule: "bad-ignore", line: idx + 1, detail: ln.trim().slice(0, 80) }); return; }
    if (wholeFile) { for (const id of ids) fileIgnores.add(id); return; }
    for (const target of [idx + 1, idx + 2]) {
      if (!ignores.has(target)) ignores.set(target, new Set());
      for (const id of ids) ignores.get(target).add(id);
    }
  });
  const seen = new Set();
  for (const f of raw) {
    if (fileIgnores.has(f.rule) || ignores.get(f.line)?.has(f.rule)) continue;
    // 8.0 migration findings name the exact API / prop / class, so several on one line are all reported.
    const key = MIGRATION_RULES.has(f.rule) ? `${f.rule}:${f.line}:${f.detail}` : `${f.rule}:${f.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(f);
  }
  return findings
    .map((f) => ({ ...f, level: RULES[f.rule].level, hint: RULES[f.rule].hint, text: (lines[f.line - 1] ?? "").trim().replace(/\s+/g, " ") }))
    .sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

/** All auditable files under a directory (or the file itself). */
export function listFiles(target) {
  const st = statSync(target);
  if (st.isFile()) return SOURCE_EXT.has(extname(target).toLowerCase()) ? [target] : [];
  return readdirSync(target).sort().flatMap((name) => {
    const path = join(target, name);
    const s = statSync(path);
    if (s.isDirectory()) return SKIP_DIRS.has(name) || name.startsWith(".") ? [] : listFiles(path);
    return SOURCE_EXT.has(extname(name).toLowerCase()) && !isTestFile(name) ? [path] : [];
  });
}

/**
 * Audit directories / files; `base` makes the reported paths relative (forward slashes). Package names: `options.packages`
 * plus, per target, the aliases found in package.json files above it (detectPackages).
 */
export function auditPaths(targets, base = process.cwd(), options = {}) {
  const out = [];
  for (const target of targets) {
    const packages = [...new Set([...detectPackages(target), ...(options.packages ?? [])])];
    for (const file of listFiles(resolve(target))) {
      const rel = relative(base, file).split("\\").join("/");
      for (const f of auditText(readFileSync(file, "utf8"), file, { packages })) out.push({ file: rel, ...f });
    }
  }
  return out;
}

const baselineKey = (f) => `${f.file}\u0000${f.rule}\u0000${f.text}`;
/** Baseline document for the current error-level findings (line numbers left out so edits elsewhere don't break it). */
export function makeBaseline(findings) {
  const entries = findings.filter((f) => f.level === "error").map((f) => ({ file: f.file, rule: f.rule, text: f.text }));
  entries.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.text.localeCompare(b.text));
  return { tool: "admin-ui-audit", version: 1, note: "已登记的历史问题：清掉一条就从这里删一条（或重新 --write-baseline）；新增问题不许进来", findings: entries };
}
/** Split findings into new vs. baselined (multiset match on file + rule + line text); `stale` = baseline entries no longer found. */
export function compareBaseline(findings, baseline) {
  const pool = new Map();
  for (const e of baseline?.findings ?? []) pool.set(baselineKey(e), (pool.get(baselineKey(e)) ?? 0) + 1);
  const fresh = [];
  const known = [];
  for (const f of findings) {
    const k = baselineKey(f);
    if (f.level === "error" && pool.get(k)) { pool.set(k, pool.get(k) - 1); known.push(f); }
    else fresh.push(f);
  }
  const stale = [...pool.values()].reduce((a, b) => a + b, 0);
  return { fresh, known, stale };
}

const USAGE = `用法：admin-ui-audit <源码目录>... [--json] [--baseline 文件] [--write-baseline] [--package 名字]
  （装了 @adminui/react 的项目里也可以：npx @adminui/react audit <源码目录>）
  --json             输出 JSON
  --baseline 文件    已登记的历史问题不算失败（路径按基线文件所在目录记）
  --write-baseline   把当前所有错误写进基线文件（默认 ui-audit-baseline.json）
  --package 名字     另外按这个包名检查导入（可写多次）；package.json 里 "npm:@adminui/react@…" 这类别名会自动认
忽略一行：在该行或上一行写  // admin-ui-audit-ignore <规则>: <原因>（原因必填）
忽略整个文件（不在 SDK 环境里的文件）：// admin-ui-audit-ignore-file <规则>: <原因>
规则：${Object.keys(RULES).join(" ")}`;

/** CLI entry; returns the exit code. */
export function main(argv, log = console.log) {
  const args = [...argv];
  const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
  const option = (name) => {
    const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
    if (i < 0) return undefined;
    const [a] = args.splice(i, 1);
    if (a.includes("=")) return a.slice(name.length + 1);
    return args.splice(i, 1)[0];
  };
  if (args[0] === "audit") args.shift(); // npx @adminui/react audit <dir>
  if (flag("--help") || flag("-h")) { log(USAGE); return 0; }
  const json = flag("--json");
  const write = flag("--write-baseline");
  const baselinePath = option("--baseline") ?? (write ? "ui-audit-baseline.json" : undefined);
  const extraPackages = [];
  for (let p = option("--package"); p !== undefined; p = option("--package")) extraPackages.push(p);
  const unknown = args.filter((a) => a.startsWith("-"));
  if (unknown.length || !args.length) { log(unknown.length ? `不认识的参数：${unknown.join(" ")}\n${USAGE}` : USAGE); return 2; }
  for (const t of args) if (!existsSync(t)) { log(`找不到：${t}`); return 2; }
  const base = baselinePath ? dirname(resolve(baselinePath)) : process.cwd();
  const findings = auditPaths(args, base, { packages: extraPackages });
  const shown = (f) => (baselinePath ? relative(process.cwd(), join(base, f.file)).split("\\").join("/") : f.file);

  if (write) {
    const doc = makeBaseline(findings);
    writeFileSync(baselinePath, `${JSON.stringify(doc, null, 2)}\n`);
    log(`已写入基线 ${baselinePath}：${doc.findings.length} 条错误`);
    return 0;
  }
  let baseline;
  if (baselinePath) {
    if (!existsSync(baselinePath)) { log(`基线文件不存在：${baselinePath}（先加 --write-baseline 生成）`); return 2; }
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  }
  const { fresh, known, stale } = compareBaseline(findings, baseline);
  const errors = fresh.filter((f) => f.level === "error");
  const warns = fresh.filter((f) => f.level === "warn");
  if (json) {
    log(JSON.stringify({ findings: fresh.map((f) => ({ ...f, file: shown(f) })), baselined: known.length, stale, errors: errors.length, warnings: warns.length }, null, 2));
  } else {
    for (const f of fresh) log(`${shown(f)}:${f.line}  ${f.level === "error" ? "错误" : "提醒"} [${f.rule}] ${f.hint}\n    ${f.text.slice(0, 140)}`);
    const parts = [`${errors.length} 个错误`, `${warns.length} 个提醒`];
    if (baseline) parts.push(`基线内 ${known.length} 条`, ...(stale ? [`基线里 ${stale} 条已经修好，可以从基线删掉`] : []));
    log(`${fresh.length ? "\n" : ""}admin-ui-audit：${parts.join("，")}`);
  }
  return errors.length ? 1 : 0;
}

const self = fileURLToPath(import.meta.url);
const invoked = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(self); } catch { return false; } })();
if (invoked) process.exitCode = main(process.argv.slice(2));
