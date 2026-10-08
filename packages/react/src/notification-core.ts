/**
 * NotificationCenter pure rules: day groups 今天 / 昨天 / 更早, 「待我处理」 grouped by
 * module, the bell badge text (99+), the short relative time, page merging and local read marks. No React.
 */

export type NotificationDayGroup = "今天" | "昨天" | "更早";
export const NOTIFICATION_DAY_GROUPS: readonly NotificationDayGroup[] = ["今天", "昨天", "更早"];

const toDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value));
const dayStart = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const pad = (n: number) => String(n).padStart(2, "0");

/** Which local calendar day group a time falls in (future times count as 今天). */
export function dayGroupOf(date: string | Date, now: Date): NotificationDayGroup {
  const at = toDate(date);
  if (Number.isNaN(at.getTime())) return "更早";
  const today = dayStart(now);
  const day = dayStart(at);
  if (day >= today) return "今天";
  const yesterday = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return day >= yesterday ? "昨天" : "更早";
}

/** Notifications split into 今天 / 昨天 / 更早 (only non-empty groups; item order kept). */
export function groupNotificationsByDay<T extends { createdAt: string | Date }>(items: readonly T[], now: Date): { group: NotificationDayGroup; items: T[] }[] {
  const buckets = new Map<NotificationDayGroup, T[]>();
  for (const item of items) {
    const group = dayGroupOf(item.createdAt, now);
    const list = buckets.get(group);
    if (list) list.push(item);
    else buckets.set(group, [item]);
  }
  return NOTIFICATION_DAY_GROUPS.flatMap((group) => {
    const list = buckets.get(group);
    return list ? [{ group, items: list }] : [];
  });
}

/** 「待我处理」 items grouped by module in order of first appearance; label = moduleLabel ?? module. */
export function groupInboxByModule<T extends { module: string; moduleLabel?: string }>(items: readonly T[]): { module: string; label: string; items: T[] }[] {
  const groups: { module: string; label: string; items: T[] }[] = [];
  const byModule = new Map<string, { module: string; label: string; items: T[] }>();
  for (const item of items) {
    let group = byModule.get(item.module);
    if (!group) {
      group = { module: item.module, label: item.moduleLabel ?? item.module, items: [] };
      byModule.set(item.module, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Text of the red badge on the bell: "" for none, the number, 「99+」 over 99. */
export function unreadBadgeText(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(Math.floor(count));
}

/** 刚刚 · N 分钟前 · HH:mm (today) · 昨天 HH:mm · M月D日 (another year: YYYY年M月D日). */
export function relativeTimeText(date: string | Date, now: Date): string {
  const at = toDate(date);
  if (Number.isNaN(at.getTime())) return "";
  const diff = now.getTime() - at.getTime();
  if (diff < 60_000) return "刚刚";
  const group = dayGroupOf(at, now);
  if (diff < 3_600_000 && group === "今天") return `${Math.floor(diff / 60_000)} 分钟前`;
  const clock = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  if (group === "今天") return clock;
  if (group === "昨天") return `昨天 ${clock}`;
  const day = `${at.getMonth() + 1}月${at.getDate()}日`;
  return at.getFullYear() === now.getFullYear() ? day : `${at.getFullYear()}年${day}`;
}

/** Append the next page; an id already shown is not repeated (a new item pushed rows down meanwhile). */
export function mergePages<T extends { id: string }>(current: readonly T[], next: readonly T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];
  for (const item of next) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

/** Mark these ids read in place (same array back when nothing changed). */
export function markReadLocal<T extends { id: string; read: boolean }>(items: readonly T[], ids: readonly string[] | "all"): T[] {
  const wanted = ids === "all" ? null : new Set(ids);
  let changed = false;
  const next = items.map((item) => {
    if (item.read || (wanted && !wanted.has(item.id))) return item;
    changed = true;
    return { ...item, read: true };
  });
  return changed ? next : (items as T[]);
}
