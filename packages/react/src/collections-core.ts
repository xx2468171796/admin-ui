/**
 * Pure rules of the lightweight collections (collections.tsx): which pattern fits a data set, the
 * status checklist summary and feed day groups (time text lives in format.ts). No React, no DOM:
 * unit-tested in test/collections-core.test.ts. Guide: TABLES.md §1.
 *
 * Pattern choice (Cloudscape / Carbon / Primer / NN/g, see TABLES.md §1):
 * - DataTable: the main list of an admin page — many homogeneous records (≈ 10+ and growing) users
 *   find, filter, sort and act on row by row (visible action column, fixed row height, pagination).
 * - BitableGrid (`@adminui/react/grid`): only when the main job is entering / changing data in
 *   the cells like a spreadsheet (paste a batch, group and total it yourself).
 * - CompactTable: a small fixed set (≈ ≤ 20 rows) read at a glance — rankings, stats next to a chart,
 *   a few configured items, tables inside dialogs / cards / tabs. No toolbar, no row numbers.
 * - ActivityFeed: time-ordered events (what happened) — logs, checks, heartbeats, versions, history
 *   of ONE object, notices. Newest first, no columns.
 * - StatusChecklist: a few named checks each with a status (healthy / failing) and a reason.
 * - DescriptionList: the attributes of ONE object.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";
import { dayKey, toTime, type DateInput } from "./format.ts";

export type CollectionPattern = "table" | "grid" | "compact" | "feed" | "checklist" | "description";
export type CollectionTraits = {
  /** Typical / maximum rows. */
  rows: number;
  /** The rows are events ordered by time (append-only). */
  timeOrdered?: boolean;
  /** Each row is a named check with a status. */
  statusChecks?: boolean;
  /** The data is one object's attributes. */
  singleObject?: boolean;
  /** Users search / filter / sort / act on rows / select many. */
  explore?: boolean;
  /** The main job is editing cells like a spreadsheet (enter, paste, fill a batch). */
  editCells?: boolean;
  /** Placed inside a dialog, card or side panel (not the page's main list). */
  embedded?: boolean;
};
/** Recommended pattern for a data set (the rule of thumb in TABLES.md §1, as code). */
export function suggestCollection(t: CollectionTraits): CollectionPattern {
  if (t.singleObject) return "description";
  if (t.statusChecks && t.rows <= 20) return "checklist";
  if (t.timeOrdered && !t.explore) return "feed";
  const big = (t.explore && t.rows >= 10) || t.rows > 50;
  if (big || (t.editCells && !t.embedded)) return t.editCells ? "grid" : "table";
  return "compact";
}

// ---------------------------------------------------------------- checklist

export type CheckStatus = "ok" | "warning" | "error" | "pending" | "off" | "unknown";
export const CHECK_STATUS_LABELS: Readonly<Record<CheckStatus, string>> = { ok: "正常", warning: "注意", error: "异常", pending: "进行中", off: "未启用", unknown: "未知" };
const CHECK_STATUS_ORDER: readonly CheckStatus[] = ["error", "warning", "pending", "unknown", "off", "ok"];
export type CheckSummary = { total: number; counts: Record<CheckStatus, number>; worst: CheckStatus | null; text: string };
/** Counts per status, the worst status and a one-line summary: 「3 项正常 · 1 项异常」 / 「全部正常（4 项）」. */
export function summarizeChecks(statuses: readonly CheckStatus[]): CheckSummary {
  const counts = { ok: 0, warning: 0, error: 0, pending: 0, off: 0, unknown: 0 } as Record<CheckStatus, number>;
  for (const s of statuses) counts[s]++;
  const worst = CHECK_STATUS_ORDER.find((s) => counts[s] > 0) ?? null;
  const total = statuses.length;
  if (!total) return { total, counts, worst, text: "没有检查项" };
  if (counts.ok === total) return { total, counts, worst, text: `全部正常（${total} 项）` };
  const text = CHECK_STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => `${counts[s]} 项${CHECK_STATUS_LABELS[s]}`).join(" · ");
  return { total, counts, worst, text };
}

// ---------------------------------------------------------------- feed day groups

/** Items grouped by calendar day, newest day first, items newest first inside (stable for equal times). */
export function groupByDay<T>(items: readonly T[], time: (item: T) => DateInput | null | undefined, timeZone = runtimeTimeZone()): { key: string; items: T[] }[] {
  const sorted = items.map((item, index) => ({ item, index, t: toTime(time(item)) ?? -Infinity })).sort((a, b) => b.t - a.t || a.index - b.index);
  const groups: { key: string; items: T[] }[] = [];
  for (const { item, t } of sorted) {
    const key = Number.isFinite(t) ? dayKey(t, timeZone) : "";
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}
