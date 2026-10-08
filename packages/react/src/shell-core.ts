/**
 * Pure rules of the AdminShell chrome: the top bar breadcrumb, which work tabs 「关闭其他 /
 * 关闭右侧」 close, the open-pages search, and how a menu count reads. No React; test/shell-core.test.ts.
 */

/** One step of a breadcrumb: grey (a link when it has `onClick`), the last one is the current page (dark, bold). */
export type ShellCrumb = { label: string; onClick?: () => void };

type CrumbNav = { id: string; title: string; group?: string };
type CrumbTab = { id: string; title: string; crumbs?: readonly ShellCrumb[] };

/**
 * The top bar trail for the active tab: `root` (「管理后台」) → the tab's own `crumbs` when it has them, else the
 * menu group its menu item sits under (「业务」) → the page title. No more fixed 「工作空间 /」.
 */
export function shellCrumbs(tab: CrumbTab | undefined, navigation: readonly CrumbNav[], root?: ShellCrumb | string): ShellCrumb[] {
  if (!tab) return [];
  const out: ShellCrumb[] = [];
  if (root) out.push(typeof root === "string" ? { label: root } : root);
  if (tab.crumbs) out.push(...tab.crumbs);
  else {
    const group = navigation.find((n) => n.id === tab.id)?.group;
    if (group) out.push({ label: group });
  }
  out.push({ label: tab.title });
  return out;
}

type ClosableTab = { id: string; closable?: boolean; pinned?: boolean };
const closable = (tab: ClosableTab) => tab.closable !== false && !tab.pinned;

/** Ids that 「关闭其他」 (every closable tab but `id`) or 「关闭右侧」 (closable tabs after `id`) closes, in strip order. */
export function tabsToClose(tabs: readonly ClosableTab[], id: string, which: "others" | "right"): string[] {
  const at = tabs.findIndex((t) => t.id === id);
  if (at < 0) return [];
  return tabs.filter((t, i) => closable(t) && (which === "others" ? i !== at : i > at)).map((t) => t.id);
}

/** Open pages matching a search (title contains the words, case-insensitive); empty query = all. */
export function searchTabs<T extends { title: string }>(tabs: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase("zh-CN");
  return needle ? tabs.filter((t) => t.title.toLocaleLowerCase("zh-CN").includes(needle)) : [...tabs];
}

/** A menu count: 1,284 with thousands separators; above `max` (default 9,999) it reads 「9,999+」; ≤ 0 / blank = nothing. */
export function navBadgeText(value: number | string | undefined, max = 9999): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value > max ? `${max.toLocaleString("en-US")}+` : Math.round(value).toLocaleString("en-US");
}

/** The collapsed rail's corner badge is tiny: 1–99, then 「99+」. */
export function railBadgeText(value: number | string | undefined): string | null {
  if (typeof value === "number") return navBadgeText(value, 99);
  return navBadgeText(value);
}
