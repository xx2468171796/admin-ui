/**
 * OrgPicker wording (every string is replaceable). Three built-in tables — zh-CN
 * (default), zh-TW, en — and `messages` to override any key. `{name}`-style placeholders are filled by
 * `fillText`; counts go through Intl.NumberFormat of the locale. Pure; unit-tested.
 */

export type OrgPickerLocale = "zh-CN" | "zh-TW" | "en";

export type OrgPickerMessages = {
  searchPlaceholder: string;
  searchPlaceholderPeople: string;
  tabOrg: string;
  treeLabel: string;
  membersLabel: string;
  selectedLabel: string;
  selected: string;
  clear: string;
  cancel: string;
  confirm: string;
  confirmCount: string;
  includeSubNote: string;
  includeSub: string;
  direct: string;
  whole: string;
  wholeHint: string;
  members: string;
  selectAllShown: string;
  departedHidden: string;
  coveredIn: string;
  reach: string;
  reachApprox: string;
  backToMine: string;
  locked: string;
  partial: string;
  hiddenCount: string;
  largeDept: string;
  emptyDept: string;
  loading: string;
  loadFailed: string;
  retry: string;
  searchCount: string;
  groupPerson: string;
  groupUnit: string;
  groupRole: string;
  groupLine: string;
  groupOther: string;
  showAll: string;
  noResult: string;
  noResultTips: string;
  departedHit: string;
  departed: string;
  disabledPerson: string;
  departedKeep: string;
  existing: string;
  maxReached: string;
  locate: string;
  pickedSingle: string;
  noneSelected: string;
  emptySelected: string;
  people: string;
  remove: string;
  expand: string;
  collapse: string;
  fieldPlaceholder: string;
  fieldBrowse: string;
  fieldFromTree: string;
  fieldFooter: string;
  fieldSuggest: string;
  addN: string;
  barSummary: string;
  barHint: string;
  sheetClose: string;
  kindPerson: string;
  kindDept: string;
  kindCompany: string;
  kindGroup: string;
  kindRole: string;
  kindLine: string;
  countPeople: string;
  countUnits: string;
  shortcuts: string;
  networkError: string;
};

const ZH_CN: OrgPickerMessages = {
  searchPlaceholder: "搜人、部门、角色、业务线，支持拼音首字母",
  searchPlaceholderPeople: "搜人，支持拼音首字母",
  tabOrg: "组织架构",
  treeLabel: "组织架构",
  membersLabel: "成员",
  selectedLabel: "已选",
  selected: "已选 {n}",
  clear: "清空",
  cancel: "取消",
  confirm: "确定",
  confirmCount: "确定 ({n})",
  includeSubNote: "部门按「含下级」算：以后新进部门的人自动包含",
  includeSub: "含下级",
  direct: "直属",
  whole: "整个「{name}」",
  wholeHint: "{n} 人（含下级部门）· 以后新进的人自动有",
  members: "成员 · {n}",
  selectAllShown: "全选这些人",
  departedHidden: "另有 {n} 位已离职的不显示",
  coveredIn: "已含在「{name}」里",
  reach: "共覆盖 {n} 人（去重）",
  reachApprox: "约覆盖 {n} 人",
  backToMine: "回到我的位置",
  locked: "不在你的管理范围",
  partial: "只能选里面你管得着的部门",
  hiddenCount: "{n} 个不在你的管理范围，已隐藏",
  largeDept: "{n} 人，只画看得见的几十行。给整个部门授权就勾上面「整个「{name}」」，以后新来的人也自动有。",
  emptyDept: "「{name}」还没有人",
  loading: "正在加载…",
  loadFailed: "没加载出来：{reason}",
  retry: "重试",
  searchCount: "共 {n} 个结果",
  groupPerson: "人",
  groupUnit: "部门 / 公司",
  groupRole: "角色",
  groupLine: "业务线",
  groupOther: "其他",
  showAll: "还有 {n} 个，显示全部",
  noResult: "没有找到「{q}」",
  noResultTips: "只列你管得着的人和部门；已离职、停用的人不显示；可以搜拼音首字母，例如 xw",
  departedHit: "「{name}」已离职",
  departed: "已离职",
  disabledPerson: "已停用",
  departedKeep: "已离职 · 还在名单里，点 × 去掉",
  existing: "已授权",
  maxReached: "最多选 {n} 个，已满",
  locate: "下级",
  pickedSingle: "已选：{label}",
  noneSelected: "未选择",
  emptySelected: "从左边勾选人或部门",
  people: "{n} 人",
  remove: "去掉 {name}",
  expand: "展开",
  collapse: "收起",
  fieldPlaceholder: "添加人、部门或角色",
  fieldBrowse: "组织架构",
  fieldFromTree: "从组织架构选…",
  fieldFooter: "只列你管得着的 · 回车选第一个",
  fieldSuggest: "建议 · 你所在的部门和最近选过的",
  addN: "添加 {n} 个",
  barSummary: "已选 {summary}",
  barHint: "点这里查看 / 去掉",
  sheetClose: "收起",
  kindPerson: "人",
  kindDept: "部门",
  kindCompany: "公司",
  kindGroup: "集团",
  kindRole: "角色",
  kindLine: "业务线",
  countPeople: "{n} 人",
  countUnits: "{n} 个{kind}",
  shortcuts: "快捷",
  networkError: "网络中断",
};

const ZH_TW: OrgPickerMessages = {
  ...ZH_CN,
  searchPlaceholder: "搜尋人員、部門、角色、業務線，支援拼音首字母",
  searchPlaceholderPeople: "搜尋人員，支援拼音首字母",
  tabOrg: "組織架構",
  treeLabel: "組織架構",
  membersLabel: "成員",
  selectedLabel: "已選",
  selected: "已選 {n}",
  clear: "清空",
  cancel: "取消",
  confirm: "確定",
  confirmCount: "確定 ({n})",
  includeSubNote: "部門按「含下級」計算：之後新進部門的人自動包含",
  includeSub: "含下級",
  direct: "直屬",
  whole: "整個「{name}」",
  wholeHint: "{n} 人（含下級部門）· 之後新進的人自動有",
  members: "成員 · {n}",
  selectAllShown: "全選這些人",
  departedHidden: "另有 {n} 位已離職的不顯示",
  coveredIn: "已含在「{name}」裡",
  reach: "共涵蓋 {n} 人（去重）",
  reachApprox: "約涵蓋 {n} 人",
  backToMine: "回到我的位置",
  locked: "不在你的管理範圍",
  partial: "只能選裡面你管得到的部門",
  hiddenCount: "{n} 個不在你的管理範圍，已隱藏",
  largeDept: "{n} 人，只畫看得見的幾十行。給整個部門授權就勾上面「整個「{name}」」，之後新來的人也自動有。",
  emptyDept: "「{name}」還沒有人",
  loading: "載入中…",
  loadFailed: "沒有載入成功：{reason}",
  retry: "重試",
  searchCount: "共 {n} 個結果",
  groupPerson: "人員",
  groupUnit: "部門 / 公司",
  groupRole: "角色",
  groupLine: "業務線",
  groupOther: "其他",
  showAll: "還有 {n} 個，顯示全部",
  noResult: "找不到「{q}」",
  noResultTips: "只列出你管得到的人和部門；已離職、停用的人不顯示；可以搜拼音首字母，例如 xw",
  departedHit: "「{name}」已離職",
  departed: "已離職",
  disabledPerson: "已停用",
  departedKeep: "已離職 · 還在名單裡，點 × 移除",
  existing: "已授權",
  maxReached: "最多選 {n} 個，已滿",
  locate: "下級",
  pickedSingle: "已選：{label}",
  noneSelected: "未選擇",
  emptySelected: "從左邊勾選人員或部門",
  people: "{n} 人",
  remove: "移除 {name}",
  expand: "展開",
  collapse: "收合",
  fieldPlaceholder: "新增人員、部門或角色",
  fieldBrowse: "組織架構",
  fieldFromTree: "從組織架構選…",
  fieldFooter: "只列出你管得到的 · Enter 選第一個",
  fieldSuggest: "建議 · 你所在的部門和最近選過的",
  addN: "新增 {n} 個",
  barSummary: "已選 {summary}",
  barHint: "點這裡查看 / 移除",
  sheetClose: "收合",
  kindPerson: "人員",
  kindDept: "部門",
  kindCompany: "公司",
  kindGroup: "集團",
  kindRole: "角色",
  kindLine: "業務線",
  countPeople: "{n} 人",
  countUnits: "{n} 個{kind}",
  shortcuts: "快捷",
  networkError: "網路中斷",
};

const EN: OrgPickerMessages = {
  searchPlaceholder: "Search people, departments, roles, lines",
  searchPlaceholderPeople: "Search people",
  tabOrg: "Organization",
  treeLabel: "Organization",
  membersLabel: "Members",
  selectedLabel: "Selected",
  selected: "Selected {n}",
  clear: "Clear",
  cancel: "Cancel",
  confirm: "Done",
  confirmCount: "Done ({n})",
  includeSubNote: "Departments include sub-departments: people who join later are included",
  includeSub: "Incl. sub",
  direct: "Direct",
  whole: "All of “{name}”",
  wholeHint: "{n} people (with sub-departments) · new members included",
  members: "Members · {n}",
  selectAllShown: "Select these",
  departedHidden: "{n} people who left are not shown",
  coveredIn: "Included in “{name}”",
  reach: "Covers {n} people (deduplicated)",
  reachApprox: "Covers about {n} people",
  backToMine: "Back to my team",
  locked: "Outside your scope",
  partial: "Only the sub-departments you manage can be picked",
  hiddenCount: "{n} outside your scope, hidden",
  largeDept: "{n} people — only the visible rows are drawn. To grant the whole department, tick “All of “{name}”” above; newcomers get it too.",
  emptyDept: "“{name}” has no members yet",
  loading: "Loading…",
  loadFailed: "Couldn't load: {reason}",
  retry: "Retry",
  searchCount: "{n} results",
  groupPerson: "People",
  groupUnit: "Departments / companies",
  groupRole: "Roles",
  groupLine: "Business lines",
  groupOther: "Other",
  showAll: "{n} more, show all",
  noResult: "Nothing found for “{q}”",
  noResultTips: "Only people and departments in your scope are listed; people who left or are disabled are hidden; initials work too.",
  departedHit: "“{name}” has left",
  departed: "Left",
  disabledPerson: "Disabled",
  departedKeep: "Left · still on the list, remove with ×",
  existing: "Granted",
  maxReached: "At most {n}, full",
  locate: "Open",
  pickedSingle: "Selected: {label}",
  noneSelected: "Nothing selected",
  emptySelected: "Tick people or departments on the left",
  people: "{n} people",
  remove: "Remove {name}",
  expand: "Expand",
  collapse: "Collapse",
  fieldPlaceholder: "Add people, departments or roles",
  fieldBrowse: "Organization",
  fieldFromTree: "Browse the organization…",
  fieldFooter: "Only people in your scope · Enter picks the first",
  fieldSuggest: "Suggested · your department and recent picks",
  addN: "Add {n}",
  barSummary: "Selected {summary}",
  barHint: "Tap to review / remove",
  sheetClose: "Close",
  kindPerson: "People",
  kindDept: "Departments",
  kindCompany: "Companies",
  kindGroup: "Group",
  kindRole: "Roles",
  kindLine: "Lines",
  countPeople: "{n} people",
  countUnits: "{n} {kind}",
  shortcuts: "Shortcuts",
  networkError: "Network error",
};

export const ORG_PICKER_MESSAGES: Readonly<Record<OrgPickerLocale, OrgPickerMessages>> = { "zh-CN": ZH_CN, "zh-TW": ZH_TW, en: EN };

/** The table for a locale with the host's overrides on top. */
export function orgPickerMessages(locale: OrgPickerLocale = "zh-CN", overrides?: Partial<OrgPickerMessages>): OrgPickerMessages {
  return { ...ORG_PICKER_MESSAGES[locale], ...overrides };
}

/** Fill `{key}` placeholders; numbers are formatted for the locale (1,234). */
export function fillText(template: string, params: Readonly<Record<string, string | number>>, locale: OrgPickerLocale = "zh-CN"): string {
  const nf = new Intl.NumberFormat(locale);
  return template.replace(/\{(\w+)\}/g, (all, key: string) => {
    const v = params[key];
    return v === undefined ? all : typeof v === "number" ? nf.format(v) : v;
  });
}

/** Label of a subject kind (group headings, chips). */
export function kindLabel(m: OrgPickerMessages, kind: string): string {
  const table: Record<string, string> = { person: m.kindPerson, dept: m.kindDept, company: m.kindCompany, group: m.kindGroup, role: m.kindRole, line: m.kindLine };
  return table[kind] ?? kind;
}

/** 「2 人、1 个部门」: what the bottom bar / summary says about a selection. */
export function selectionSummary(m: OrgPickerMessages, kinds: readonly { kind: string; count: number }[], locale: OrgPickerLocale = "zh-CN"): string {
  const sep = locale === "en" ? ", " : "、";
  return kinds
    .filter((k) => k.count > 0)
    .map((k) => (k.kind === "person" ? fillText(m.countPeople, { n: k.count }, locale) : fillText(m.countUnits, { n: k.count, kind: kindLabel(m, k.kind) }, locale)))
    .join(sep);
}
