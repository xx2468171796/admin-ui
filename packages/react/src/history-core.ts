/**
 * Pure rules behind the version-rollback pieces (LogTimeline operations mode, ConflictChooser,
 * TimeMachineDialog). No React, no DOM; unit-tested in test/history-core.test.ts.
 *
 * - Undo window: operations newer than `now − days` can be undone as a whole batch; older ones only
 *   cell by cell (the window is a prop, default 3 days).
 * - Kind counts / filter for the 「全部 26 · 数据 19 · 字段结构 4 · 视图 3」 chips.
 * - Conflict decisions: one default (keep other people's later edits / revert them too) plus
 *   per-cell exceptions.
 * - Time machine scrubber: a fixed span (default 72 h) ending now, positions in %, day ticks,
 *   quick picks (1 小时前 / 今天 09:00 / 昨天 09:00 …) and the operations a target time would undo.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";
import { dayKey, toTime, type DateInput } from "./format.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Default undo window in days. */
export const DEFAULT_UNDO_WINDOW_DAYS = 3;

// ---------------------------------------------------------------- undo window

/** Epoch ms where the undo window starts (`now − days`). */
export function undoWindowStart(now: number, days = DEFAULT_UNDO_WINDOW_DAYS): number {
  return now - Math.max(0, days) * DAY;
}

/** Whether a time is still inside the undo window (unknown times are outside). */
export function inUndoWindow(value: DateInput | null | undefined, now: number, days = DEFAULT_UNDO_WINDOW_DAYS): boolean {
  const t = toTime(value);
  return t !== null && t >= undoWindowStart(now, days);
}

/** Items inside / outside the undo window, order kept. */
export function splitUndoWindow<T>(items: readonly T[], time: (item: T) => DateInput | null | undefined, now: number, days = DEFAULT_UNDO_WINDOW_DAYS): { recent: T[]; old: T[]; start: number } {
  const start = undoWindowStart(now, days);
  const recent: T[] = [];
  const old: T[] = [];
  for (const item of items) (inUndoWindow(time(item), now, days) ? recent : old).push(item);
  return { recent, old, start };
}

// ---------------------------------------------------------------- kind chips

/** Count of items per kind key (keys in first-seen order). */
export function countByKind<T>(items: readonly T[], kind: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = kind(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** Items of one kind; `"all"` (or empty) keeps everything. */
export function filterByKind<T>(items: readonly T[], kind: (item: T) => string, value: string | null | undefined): T[] {
  if (!value || value === "all") return [...items];
  return items.filter((item) => kind(item) === value);
}

// ---------------------------------------------------------------- conflicts

/** keep = leave the other person's later edit; revert = put the old value back anyway. */
export type ConflictChoice = "keep" | "revert";
/** One default for every conflicting cell plus per-cell exceptions (key → choice). */
export type ConflictDecisions = { mode: ConflictChoice; overrides?: Readonly<Record<string, ConflictChoice>> };

export const DEFAULT_CONFLICT_DECISIONS: ConflictDecisions = { mode: "keep" };

/** The choice that applies to one conflicting cell. */
export function conflictChoice(key: string, decisions: ConflictDecisions): ConflictChoice {
  return decisions.overrides?.[key] ?? decisions.mode;
}

/** Set one cell's choice; an exception equal to the default is dropped so the value stays minimal. */
export function setConflictChoice(decisions: ConflictDecisions, key: string, choice: ConflictChoice): ConflictDecisions {
  const overrides = { ...(decisions.overrides ?? {}) };
  if (choice === decisions.mode) delete overrides[key];
  else overrides[key] = choice;
  return Object.keys(overrides).length ? { mode: decisions.mode, overrides } : { mode: decisions.mode };
}

/** Change the default; exceptions are cleared (the user picked one rule for all). */
export function setConflictMode(mode: ConflictChoice): ConflictDecisions {
  return { mode };
}

/** How many of the given cells end up kept / reverted. */
export function conflictTally(keys: readonly string[], decisions: ConflictDecisions): { keep: number; revert: number } {
  let keep = 0;
  for (const key of keys) if (conflictChoice(key, decisions) === "keep") keep += 1;
  return { keep, revert: keys.length - keep };
}

// ---------------------------------------------------------------- zoned clock

const PARTS = new Map<string, Intl.DateTimeFormat>();
const partsFormatter = (timeZone: string) => {
  let f = PARTS.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    PARTS.set(timeZone, f);
  }
  return f;
};
/** Wall clock of an instant in a time zone: { date: "YYYY-MM-DD", time: "HH:MM" }. */
export function zonedClock(t: number, timeZone = runtimeTimeZone()): { date: string; time: string } {
  const p = partsFormatter(timeZone).formatToParts(new Date(t));
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
const wallAsUtc = (date: string, time: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
};
/** Epoch ms of a wall-clock date + time in a time zone; null when the input is not a valid date / time. */
export function zonedTime(date: string, time: string, timeZone = runtimeTimeZone()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = wallAsUtc(date, time);
  if (!Number.isFinite(guess)) return null;
  // Two passes settle DST edges: offset = wall clock seen at the guess − the guess.
  let t = guess;
  for (let i = 0; i < 2; i += 1) {
    const seen = zonedClock(t, timeZone);
    t -= wallAsUtc(seen.date, seen.time) - guess;
  }
  return t;
}

/** 「10-04 09:00」 / 「今天 09:00」 / 「昨天 09:00」 for scrubber pins and conflict headings. */
export function shortMoment(t: number, now: number, timeZone = runtimeTimeZone()): string {
  const { date, time } = zonedClock(t, timeZone);
  if (date === dayKey(now, timeZone)) return `今天 ${time}`;
  if (date === dayKey(now - DAY, timeZone)) return `昨天 ${time}`;
  return `${date.slice(5)} ${time}`;
}

// ---------------------------------------------------------------- time machine scrubber

export type ScrubberScale = { start: number; end: number };
/** The scrubber span: `hours` (default 72 = the 3-day undo window) ending now. */
export function scrubberScale(now: number, hours = DEFAULT_UNDO_WINDOW_DAYS * 24): ScrubberScale {
  return { start: now - Math.max(1, hours) * HOUR, end: now };
}
/** Position of an instant on the scrubber, 0–100 (clamped). */
export function scrubberPercent(scale: ScrubberScale, t: number): number {
  const span = scale.end - scale.start;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((t - scale.start) / span) * 100));
}
/** The instant at a position (0–100), rounded down to the minute and kept inside the span. */
export function scrubberTimeAt(scale: ScrubberScale, percent: number): number {
  const raw = scale.start + ((scale.end - scale.start) * Math.min(100, Math.max(0, percent))) / 100;
  return clampToScale(scale, Math.floor(raw / 60_000) * 60_000);
}
/** Keep a target inside the span. */
export function clampToScale(scale: ScrubberScale, t: number): number {
  return Math.min(scale.end, Math.max(scale.start, t));
}
/** Midnights inside the span (in the time zone) with their 「MM-DD」 labels. */
export function scrubberDayTicks(scale: ScrubberScale, timeZone = runtimeTimeZone()): { at: number; percent: number; label: string }[] {
  const ticks: { at: number; percent: number; label: string }[] = [];
  let date = zonedClock(scale.start, timeZone).date;
  for (let i = 0; i < 400; i += 1) {
    const midnight = zonedTime(date, "00:00", timeZone);
    if (midnight === null || midnight > scale.end) break;
    if (midnight > scale.start) ticks.push({ at: midnight, percent: scrubberPercent(scale, midnight), label: date.slice(5) });
    date = zonedClock((midnight ?? scale.start) + DAY + HOUR, timeZone).date;
  }
  return ticks;
}

/** A target 「just before」 an operation: one minute earlier, rounded down to the minute. */
export function justBefore(opTime: number): number {
  return Math.floor((opTime - 60_000) / 60_000) * 60_000;
}

/** Operations that rolling back to `target` would undo (strictly after it). */
export function opsAfter<T>(ops: readonly T[], time: (op: T) => DateInput | null | undefined, target: number): T[] {
  return ops.filter((op) => {
    const t = toTime(time(op));
    return t !== null && t > target;
  });
}

export type QuickTime = { key: string; label: string; at: number };
/**
 * Quick picks under the date / time boxes: 1 小时前, 今天 09:00 (once it has passed), 昨天 09:00,
 * 前天 18:00 — only those inside the span. Times are rounded down to the minute.
 */
export function quickTimes(now: number, scale: ScrubberScale, timeZone = runtimeTimeZone()): QuickTime[] {
  const today = dayKey(now, timeZone);
  const yesterday = dayKey(now - DAY, timeZone);
  const before = dayKey(now - 2 * DAY, timeZone);
  const list: QuickTime[] = [{ key: "1h", label: "1 小时前", at: Math.floor((now - HOUR) / 60_000) * 60_000 }];
  const push = (key: string, label: string, date: string, time: string) => {
    const at = zonedTime(date, time, timeZone);
    if (at !== null && at < now) list.push({ key, label, at });
  };
  push("today-9", "今天 09:00", today, "09:00");
  push("yesterday-9", "昨天 09:00", yesterday, "09:00");
  push("yesterday-18", "昨天 18:00", yesterday, "18:00");
  push("before-18", `${before.slice(5)} 18:00`, before, "18:00");
  return list.filter((q) => q.at >= scale.start && q.at <= scale.end);
}

/** Index of the next / previous operation dot from the one focused (arrow keys), clamped. */
export function stepIndex(length: number, current: number, delta: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
}

/**
 * Whether rolling back to the previewed moment would change nothing (审阅 07: 0 changes but 「确认回滚」
 * still enabled). The host's `empty` wins; else all counts 0 and no conflicts. Host-worded cards without
 * `empty` can't be read, so they count as something to roll back.
 */
export function nothingToRollBack(preview: { empty?: boolean; counts?: { add?: number; change?: number; remove?: number }; cards?: readonly unknown[]; conflicts: readonly unknown[] }): boolean {
  if (preview.empty !== undefined) return preview.empty;
  if (preview.cards || preview.conflicts.length) return false;
  const c = preview.counts ?? {};
  return !(c.add || c.change || c.remove);
}

/** The change a log row can write inline (「旧 → 新」): the only one of its diff, else null (none / several). */
export function inlineChange<C>(diff: { changes: readonly C[] } | null | undefined): C | null {
  return diff?.changes.length === 1 ? (diff.changes[0] ?? null) : null;
}
