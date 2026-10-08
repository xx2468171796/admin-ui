/**
 * Pure model of view tabs and view management (bt/views V1, demo D16): view kinds, the four tiers
 * (业务线标准 · 必看 · 共享 · 我的), what a viewer may do with a view in each tier, and how many tabs
 * fit before the rest go into 「更多」. Unit-tested in test/views-core.test.ts.
 *
 * Tier policy (defaults; the host decides who manages what and the server enforces it):
 * - standard: maintained by the business line; ordinary users cannot change its filter / group / sort,
 *   rename or delete it — they 「复制为我的视图」. `mustSee` standard views cannot be hidden either.
 * - shared: a team's views; editable by their managers (`canManageShared`).
 * - mine: only the owner sees them; everything allowed.
 */
export type ViewKind = "grid" | "kanban" | "gallery" | "calendar" | "gantt" | "form";
export const VIEW_KINDS: readonly ViewKind[] = ["grid", "kanban", "gallery", "calendar", "gantt", "form"];
export const VIEW_KIND_LABELS: Readonly<Record<ViewKind, string>> = { grid: "表格", kanban: "看板", gallery: "画册", calendar: "日历", gantt: "甘特", form: "表单" };

export type ViewTier = "standard" | "shared" | "mine";
export const VIEW_TIERS: readonly ViewTier[] = ["standard", "shared", "mine"];
export const VIEW_TIER_LABELS: Readonly<Record<ViewTier, string>> = { standard: "业务线标准视图", shared: "共享视图", mine: "我的视图" };
/** One line under each kind on the 「新建视图」 cards. */
export const VIEW_KIND_HINTS: Readonly<Record<ViewKind, string>> = { grid: "逐行看、批量改", kanban: "按阶段拖卡片", gallery: "看现场照片", calendar: "按日期排跟进", gantt: "安装排期", form: "对外收资料" };
/** Who a new view is for: only me, or shared with a group (the host decides which group). */
export type ViewAudience = "mine" | "shared";
export const VIEW_AUDIENCE_LABELS: Readonly<Record<ViewAudience, string>> = { mine: "只有我", shared: "共享给一组" };
/** What 「新建视图」 hands the host: the kind, the typed name and who it is for. */
export type NewViewDraft = { kind: ViewKind; name: string; audience: ViewAudience };

/** One saved view as the tabs and the manager see it. */
export type ViewSummary = {
  id: string;
  name: string;
  kind: ViewKind;
  tier: ViewTier;
  /** Standard views everyone must keep in the tab bar (cannot be hidden). */
  mustSee?: boolean;
  /** Hidden from this user's tab bar (still listed in the manager). */
  hidden?: boolean;
  /**
   * The user changed this standard / shared view for themselves only (filter, sort …): the tab shows an
   * attention dot and the host shows `ViewOverrideBar` under the tabs.
   */
  modified?: boolean;
};
export type ViewPolicy = {
  /** The viewer maintains the standard views (business-line manager). Default false. */
  canManageStandard?: boolean;
  /** The viewer maintains the shared views. Default false. */
  canManageShared?: boolean;
  /** Users may reorder views inside a tier for their own tab bar. Default true. */
  canReorder?: boolean;
};
export type ViewAction = "open" | "rename" | "duplicate" | "hide" | "show" | "delete" | "editConditions";
/** Why an action is unavailable (shown as the disabled reason), keyed by action. */
export type ViewActionSet = { allowed: ViewAction[]; reasons: Partial<Record<ViewAction, string>> };

const manages = (view: ViewSummary, policy: ViewPolicy) =>
  view.tier === "mine" || (view.tier === "standard" ? Boolean(policy.canManageStandard) : Boolean(policy.canManageShared));

/** What this viewer may do with a view (the ⋯ menu, the eye toggle, the lock notice). */
export function viewActions(view: ViewSummary, policy: ViewPolicy = {}): ViewActionSet {
  const allowed: ViewAction[] = ["open", "duplicate"];
  const reasons: Partial<Record<ViewAction, string>> = {};
  const own = manages(view, policy);
  if (own) allowed.push("rename", "editConditions", "delete");
  else {
    const who = view.tier === "standard" ? "业务线标准视图由负责人维护" : "共享视图由创建它的组维护";
    reasons.rename = who;
    reasons.delete = who;
    reasons.editConditions = view.tier === "standard" ? "标准视图不能改：复制为我的视图" : "共享视图不能改：复制为我的视图";
  }
  if (view.hidden) allowed.push("show");
  else if (view.mustSee) reasons.hide = "必看视图不能隐藏";
  else allowed.push("hide");
  return { allowed, reasons };
}
export const can = (set: ViewActionSet, action: ViewAction) => set.allowed.includes(action);

/** Views of one tier in the host's order. */
export const tierViews = (views: readonly ViewSummary[], tier: ViewTier) => views.filter((v) => v.tier === tier);
/** Views shown as tabs: not hidden, tiers in order standard → shared → mine, host order inside a tier. */
export function tabViews(views: readonly ViewSummary[]): ViewSummary[] {
  return VIEW_TIERS.flatMap((tier) => tierViews(views, tier).filter((v) => !v.hidden || v.mustSee));
}
/** 「10 个 · 隐藏 1」 */
export function managerCountText(views: readonly ViewSummary[]): string {
  const hidden = views.filter((v) => v.hidden && !v.mustSee).length;
  return hidden ? `${views.length} 个 · 隐藏 ${hidden}` : `${views.length} 个`;
}
/** Default name for a new view of a kind: 「看板 2」 when 「看板」 / 「看板 1」 exist. */
export function newViewName(kind: ViewKind, existing: readonly string[]): string {
  const base = VIEW_KIND_LABELS[kind];
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n++) if (!existing.includes(`${base} ${n}`)) return `${base} ${n}`;
}
/** 「复制」 name: 「全部客户 副本」, then 「全部客户 副本 2」 … */
export function copyName(name: string, existing: readonly string[]): string {
  const base = `${name} 副本`;
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n++) if (!existing.includes(`${base} ${n}`)) return `${base} ${n}`;
}

/**
 * How many tabs fit in `available` px: tabs keep their order; when not all fit, the 「更多」 button
 * (`moreWidth`) takes a slot and the active tab is swapped into the last visible slot if it would be
 * hidden. Returns the indexes shown in the bar and those in the 「更多」 menu.
 */
export function fitTabs(widths: readonly number[], available: number, moreWidth: number, activeIndex = -1, gap = 0): { shown: number[]; overflow: number[] } {
  const all = widths.map((_, i) => i);
  const total = widths.reduce((s, w, i) => s + w + (i ? gap : 0), 0);
  if (total <= available) return { shown: all, overflow: [] };
  const room = available - moreWidth - gap;
  const shown: number[] = [];
  let used = 0;
  for (const i of all) {
    const w = (widths[i] ?? 0) + (shown.length ? gap : 0);
    if (used + w > room) break;
    shown.push(i);
    used += w;
  }
  if (activeIndex >= 0 && !shown.includes(activeIndex)) {
    // Drop tabs from the end until the active one fits.
    const activeWidth = (widths[activeIndex] ?? 0) + gap;
    while (shown.length && used + activeWidth > room) {
      const last = shown.pop() as number;
      used -= (widths[last] ?? 0) + (shown.length ? gap : 0);
    }
    shown.push(activeIndex);
  }
  return { shown, overflow: all.filter((i) => !shown.includes(i)) };
}

/** 「更多 N」 menu groups: the views that did not fit, grouped by tier in tier order (empty tiers left out). */
export function overflowGroups(views: readonly ViewSummary[]): { tier: ViewTier; views: ViewSummary[] }[] {
  return VIEW_TIERS.map((tier) => ({ tier, views: views.filter((v) => v.tier === tier) })).filter((g) => g.views.length > 0);
}
/** Views whose name contains `query` (case-insensitive, trimmed); everything for an empty query. */
export function searchViews(views: readonly ViewSummary[], query: string): ViewSummary[] {
  const q = query.trim().toLowerCase();
  return q ? views.filter((v) => v.name.toLowerCase().includes(q)) : [...views];
}
