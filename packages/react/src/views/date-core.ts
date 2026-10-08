/**
 * Calendar-day math shared by the calendar and gantt views (bt/views). Pure, no DOM: unit-tested in
 * test/views-date-core.test.ts.
 *
 * - A **day** is a `DayKey` ("YYYY-MM-DD"), a calendar date with no time zone. Day arithmetic runs on
 *   UTC day numbers, so daylight-saving jumps never shift a day.
 * - An **instant** (ISO string with offset, epoch ms, Date) becomes a day / minutes-of-day only through
 *   a time zone (`zonedParts`), and a wall-clock time in a zone becomes an instant with `zonedInstant`.
 *   Date-only strings ("2026-10-13") are days already and are never shifted by a zone.
 * - Working days: weekends (default Saturday + Sunday) and host holidays are off, host make-up days
 *   (调休上班) are on. The SDK ships **no** holiday data: the host passes a
 *   `WorkCalendar` built from its own source.
 */
import { toTime, type DateInput } from "../format.ts";

export type DayKey = string;
/** 0 = Sunday … 6 = Saturday (Date#getUTCDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DAY_MS = 86_400_000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isDayKey = (value: unknown): value is DayKey => typeof value === "string" && DAY_RE.test(value);

/** Days since 1970-01-01 of a day key (NaN for a malformed key). */
export function dayNumber(day: DayKey): number {
  const m = DAY_RE.exec(day);
  if (!m) return Number.NaN;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}
const pad = (n: number) => String(n).padStart(2, "0");
export function fromDayNumber(n: number): DayKey {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const addDays = (day: DayKey, n: number): DayKey => fromDayNumber(dayNumber(day) + n);
/** b − a in days. */
export const diffDays = (a: DayKey, b: DayKey): number => dayNumber(b) - dayNumber(a);
export const weekday = (day: DayKey): Weekday => new Date(dayNumber(day) * DAY_MS).getUTCDay() as Weekday;
export const minDay = (a: DayKey, b: DayKey) => (a <= b ? a : b);
export const maxDay = (a: DayKey, b: DayKey) => (a >= b ? a : b);

/** The first day of the week containing `day`, weeks starting on `weekStart` (1 = Monday). */
export function startOfWeek(day: DayKey, weekStart: Weekday = 1): DayKey {
  return addDays(day, -((weekday(day) - weekStart + 7) % 7));
}
export const startOfMonth = (day: DayKey): DayKey => `${day.slice(0, 7)}-01`;
export function addMonths(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, last))}`;
}
export const endOfMonth = (day: DayKey): DayKey => addDays(addMonths(startOfMonth(day), 1), -1);
/** ISO-8601 week number (weeks start Monday; week 1 holds the first Thursday). */
export function isoWeek(day: DayKey): number {
  const thursday = addDays(day, 3 - ((weekday(day) + 6) % 7));
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor(diffDays(jan1, thursday) / 7) + 1;
}

// ---------------------------------------------------------------- time zones

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = FORMATTERS.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    FORMATTERS.set(timeZone, f);
  }
  return f;
}
function wallClock(time: number, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(new Date(time));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute"), s: get("second") };
}
/** Offset of the zone at an instant, in ms (UTC+8 → 28 800 000). */
function zoneOffset(time: number, timeZone: string): number {
  const w = wallClock(time, timeZone);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - Math.floor(time / 1000) * 1000;
}
/** The day and minutes after midnight of an instant in a zone. */
export function zonedParts(time: number, timeZone: string): { day: DayKey; minutes: number } {
  const w = wallClock(time, timeZone);
  return { day: `${w.y}-${pad(w.m)}-${pad(w.d)}`, minutes: w.h * 60 + w.min };
}
/** The instant of a wall-clock time (`minutes` after midnight of `day`, may exceed 1440) in a zone. */
export function zonedInstant(day: DayKey, minutes: number, timeZone: string): number {
  const guess = dayNumber(day) * DAY_MS + Math.round(minutes * 60_000);
  let result = guess - zoneOffset(guess, timeZone);
  const again = guess - zoneOffset(result, timeZone);
  if (again !== result) result = again;
  return result;
}
/** A date input as a day in a zone: day keys pass through unchanged; null for empty / invalid input. */
export function toDay(value: DateInput | null | undefined, timeZone: string): DayKey | null {
  if (isDayKey(value)) return value;
  const t = toTime(value);
  return t === null ? null : zonedParts(t, timeZone).day;
}
export const todayKey = (now: number, timeZone: string): DayKey => zonedParts(now, timeZone).day;
/** ISO string of an instant (what views hand back for timed events). */
export const isoOf = (time: number): string => new Date(time).toISOString();

// ---------------------------------------------------------------- working days

/**
 * Which days are worked. `holidays` / `workdays` map a day to a short reason (「国庆」「国庆调休」).
 * Built by the host from its own source; the SDK ships none.
 */
export type WorkCalendar = {
  /** Days off every week (default [6, 0] = Saturday, Sunday). */
  weekend?: readonly Weekday[];
  /** Public holidays (off even on a weekday) — shown with 「休」. */
  holidays?: Readonly<Record<DayKey, string>>;
  /** Make-up working days (on even on a weekend) — shown with 「班」. */
  workdays?: Readonly<Record<DayKey, string>>;
};
export const DEFAULT_WEEKEND: readonly Weekday[] = [6, 0];

export function isWorkday(day: DayKey, calendar: WorkCalendar = {}): boolean {
  if (calendar.workdays?.[day] !== undefined) return true;
  if (calendar.holidays?.[day] !== undefined) return false;
  return !(calendar.weekend ?? DEFAULT_WEEKEND).includes(weekday(day));
}
/** The badge of a day: 「休」 for a host holiday, 「班」 for a make-up working day, null otherwise. */
export function dayMark(day: DayKey, calendar: WorkCalendar = {}): { kind: "holiday" | "workday"; badge: "休" | "班"; label: string } | null {
  const work = calendar.workdays?.[day];
  if (work !== undefined) return { kind: "workday", badge: "班", label: work || "调休上班" };
  const off = calendar.holidays?.[day];
  if (off !== undefined) return { kind: "holiday", badge: "休", label: off || "休息日" };
  return null;
}
/** Working days in [start, end] (inclusive); 0 when end < start. */
export function workdaysBetween(start: DayKey, end: DayKey, calendar: WorkCalendar = {}): number {
  const span = diffDays(start, end);
  let count = 0;
  for (let i = 0; i <= span; i++) if (isWorkday(addDays(start, i), calendar)) count++;
  return count;
}
/**
 * The last day of a task of `days` working days starting on `start` (a non-working start day is
 * skipped). `days` ≤ 1 → the first working day on or after `start`.
 */
export function addWorkdays(start: DayKey, days: number, calendar: WorkCalendar = {}): DayKey {
  let day = start;
  let guard = 0;
  while (!isWorkday(day, calendar) && guard++ < 366) day = addDays(day, 1);
  let left = Math.max(1, Math.round(days)) - 1;
  while (left > 0 && guard++ < 3660) {
    day = addDays(day, 1);
    if (isWorkday(day, calendar)) left--;
  }
  return day;
}

// ---------------------------------------------------------------- labels

export const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"] as const;
export const weekdayName = (d: Weekday) => `周${WEEKDAY_SHORT[d]}`;
/** 「2026 年 10 月」 */
export const monthTitle = (day: DayKey) => `${Number(day.slice(0, 4))} 年 ${Number(day.slice(5, 7))} 月`;
/** 「10-09」 */
export const shortDay = (day: DayKey) => day.slice(5);
/** 「14:20」 for minutes after midnight (1440 → 24:00). */
export const clockText = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(Math.round(minutes % 60))}`;
/** 「10月5日 周一」 */
export const dayLabelOf = (day: DayKey) => `${Number(day.slice(5, 7))}月${Number(day.slice(8))}日 ${weekdayName(weekday(day))}`;
