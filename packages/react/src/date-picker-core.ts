/**
 * Pure logic of the date / time pickers (bt/datepicker): day keys, month matrix, parsing what people
 * type, clamping to min / max, range ordering, keyboard moves and range presets. No React, no DOM.
 *
 * Values keep the shape of the native inputs they replace: a day is `YYYY-MM-DD`, a moment
 * `YYYY-MM-DDTHH:mm`, a time `HH:mm` — all wall-clock (no time zone); the host decides what zone a
 * value means. Day arithmetic runs on UTC dates so DST changes never shift a day.
 */
import type { DateRangeValue } from "./condition-core.ts";
export type { DateRangeValue };

/** A calendar day `YYYY-MM-DD`. */
export type DayKey = string;
/** Holiday markers supplied by the host (the SDK ships no calendar): off = 休, work = 补班. */
export type HolidayMarks = Readonly<Record<DayKey, "off" | "work">>;

const pad = (n: number) => String(n).padStart(2, "0");
const DAY_MS = 86_400_000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** `YYYY-MM-DD` of a year / month (1–12) / day; no validation. */
export const dayKeyOf = (year: number, month: number, day: number): DayKey => `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;

/** Days in a month (month 1–12). */
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Split a valid day key; null for anything else (2026-02-30 included). */
export function splitDay(key: string): { year: number; month: number; day: number } | null {
  const m = DAY_RE.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}
export const isDayKey = (value: unknown): value is DayKey => typeof value === "string" && splitDay(value) !== null;
export const isTimeText = (value: unknown): value is string => typeof value === "string" && TIME_RE.test(value);
/** A `YYYY-MM-DDTHH:mm` value with a real day and time. */
export const isDateTimeText = (value: unknown): value is string =>
  typeof value === "string" && value.length === 16 && value[10] === "T" && isDayKey(value.slice(0, 10)) && isTimeText(value.slice(11));

const toUtc = (key: DayKey) => {
  const p = splitDay(key);
  return p ? Date.UTC(p.year, p.month - 1, p.day) : Number.NaN;
};
const fromUtc = (ms: number): DayKey => {
  const d = new Date(ms);
  return dayKeyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** Local-time day of `now`. */
export const todayKey = (now: Date = new Date()): DayKey => dayKeyOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
/** Local-time `HH:mm` of `now`. */
export const nowTime = (now: Date = new Date()) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;

export const addDays = (key: DayKey, days: number): DayKey => fromUtc(toUtc(key) + days * DAY_MS);
/** Same day N months later, clamped to the month's last day (01-31 + 1 month = 02-28). */
export function addMonths(key: DayKey, months: number): DayKey {
  const p = splitDay(key);
  if (!p) return key;
  const index = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return dayKeyOf(year, month, Math.min(p.day, daysInMonth(year, month)));
}
/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (key: DayKey) => new Date(toUtc(key)).getUTCDay();
/** First day of the week containing `key` (weekStart 0–6, 1 = Monday). */
export const startOfWeek = (key: DayKey, weekStart = 1): DayKey => addDays(key, -((weekdayOf(key) - weekStart + 7) % 7));
export const endOfWeek = (key: DayKey, weekStart = 1): DayKey => addDays(startOfWeek(key, weekStart), 6);
export const startOfMonth = (key: DayKey): DayKey => `${key.slice(0, 8)}01`;
export function endOfMonth(key: DayKey): DayKey {
  const p = splitDay(key);
  return p ? dayKeyOf(p.year, p.month, daysInMonth(p.year, p.month)) : key;
}

/** Weekday letters in display order (「一 二 … 日」for weekStart 1). */
export const weekdayLabels = (weekStart = 1) => Array.from({ length: 7 }, (_, i) => WEEKDAY_NAMES[(weekStart + i) % 7]!);

/**
 * The month grid: always 6 weeks × 7 days (stable height), starting on `weekStart`; days of the
 * neighbouring months are included (callers dim them).
 */
export function monthMatrix(year: number, month: number, weekStart = 1): DayKey[][] {
  const first = startOfWeek(dayKeyOf(year, month, 1), weekStart);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
}

/** 「2026 年 10 月」. */
export const monthLabel = (year: number, month: number) => `${year} 年 ${month} 月`;
/** Screen-reader name of a day: 「2026 年 10 月 5 日 星期一」 (+「，休」/「，补班」). */
export function dayLabel(key: DayKey, holiday?: "off" | "work"): string {
  const p = splitDay(key);
  if (!p) return key;
  return `${p.year} 年 ${p.month} 月 ${p.day} 日 星期${WEEKDAY_NAMES[weekdayOf(key)]}${holiday === "off" ? "，休" : holiday === "work" ? "，补班" : ""}`;
}

/** Day part of a day or moment value (min / max of a DateTimePicker may be moments). */
export const dayPart = (value: string | undefined | null): DayKey | undefined => (value && isDayKey(value.slice(0, 10)) ? value.slice(0, 10) : undefined);

/** Outside [min, max] (either bound optional; bounds may be day or moment values — compared by day). */
export function outOfRange(key: DayKey, min?: string | null, max?: string | null): boolean {
  const lo = dayPart(min);
  const hi = dayPart(max);
  return Boolean((lo && key < lo) || (hi && key > hi));
}
/** Pull a day into [min, max]. */
export function clampDay(key: DayKey, min?: string | null, max?: string | null): DayKey {
  const lo = dayPart(min);
  const hi = dayPart(max);
  if (lo && key < lo) return lo;
  if (hi && key > hi) return hi;
  return key;
}
/** A moment value outside [min, max] (string compare works for the fixed-width format). */
export function momentOutOfRange(value: string, min?: string | null, max?: string | null): boolean {
  const lo = min ? (min.length === 10 ? `${min}T00:00` : min) : "";
  const hi = max ? (max.length === 10 ? `${max}T23:59` : max) : "";
  return Boolean((lo && value < lo) || (hi && value > hi));
}

/** Two days in order (either may be ""; an empty end stays empty). */
export function orderRange(a: string, b: string): DateRangeValue {
  if (a && b && b < a) return { from: b, to: a };
  return { from: a, to: b };
}
/** Is `key` within the (ordered) range, ends included. */
export const inRange = (key: DayKey, from: string, to: string) => Boolean(from && to && key >= from && key <= to);

// ---------------------------------------------------------------- parsing what people type

const normaliseDigits = (text: string) =>
  text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48))
    .replace(/[／．。]/g, (c) => (c === "／" ? "/" : "."))
    .replace(/：/g, ":")
    .trim();

/**
 * A day from what someone typed, or null: `2026-10-05`, `2026/10/5`, `2026.10.5`, `2026年10月5日`,
 * `20261005`, and without a year `10/5`, `10-5`, `10月5日` (current year of `now`). Full-width digits OK.
 */
export function parseDateText(text: string, now: Date = new Date()): DayKey | null {
  const t = normaliseDigits(text);
  if (!t) return null;
  let m = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/.exec(t);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) {
    const key = dayKeyOf(Number(m[1]), Number(m[2]), Number(m[3]));
    return isDayKey(key) ? key : null;
  }
  const short = /^(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/.exec(t);
  if (short) {
    const key = dayKeyOf(now.getFullYear(), Number(short[1]), Number(short[2]));
    return isDayKey(key) ? key : null;
  }
  return null;
}

/** `HH:mm` from `9:5`, `09:05`, `0905`, `9`, `21点30`, or null. */
export function parseTimeText(text: string): string | null {
  const t = normaliseDigits(text).replace(/分$/, "");
  if (!t) return null;
  const m = /^(\d{1,2})(?:\s*[:点时.]\s*(\d{1,2})?)?$/.exec(t) ?? /^(\d{2})(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/**
 * A moment `YYYY-MM-DDTHH:mm` from typed text: a day (any parseDateText form), then `T` or spaces
 * and a time (any parseTimeText form). A missing time takes `fallbackTime`.
 */
export function parseDateTimeText(text: string, now: Date = new Date(), fallbackTime = "00:00"): string | null {
  const t = normaliseDigits(text);
  if (!t) return null;
  const m = /^(.+?)(?:\s*[T\s]\s*|\s+)(\d{1,2}(?:\s*[:点时]\s*\d{0,2})?|\d{4})分?$/.exec(t);
  if (m) {
    const day = parseDateText(m[1]!, now);
    const time = parseTimeText(m[2]!);
    if (day && time) return `${day}T${time}`;
  }
  const day = parseDateText(t, now);
  return day && isTimeText(fallbackTime) ? `${day}T${fallbackTime}` : null;
}

/** Text shown in a picker's box: days as-is, moments with a space (`2026-10-05 14:30`). */
export const displayDateTime = (value: string) => (isDateTimeText(value) ? `${value.slice(0, 10)} ${value.slice(11)}` : value);

/** Typed text that is already a complete canonical value (commit while typing, like a native input). */
export const isCompleteDayText = (text: string) => isDayKey(text.trim());
export const isCompleteDateTimeText = (text: string) => {
  const t = text.trim().replace(" ", "T");
  return isDateTimeText(t);
};

// ---------------------------------------------------------------- time steps

export const timeToMinutes = (time: string) => (isTimeText(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : Number.NaN);
export const minutesToTime = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
/** Round a time to the nearest multiple of `step` minutes (step ≥ 1). */
export function snapTime(time: string, step = 1): string {
  const m = timeToMinutes(time);
  if (Number.isNaN(m)) return time;
  const s = Math.max(1, Math.round(step));
  return minutesToTime(Math.min(1440 - s, Math.round(m / s) * s));
}
/** Every `step` minutes of a day (`00:00`, `00:30` …). */
export const timeOptions = (step = 30) => {
  const s = Math.max(5, Math.round(step));
  return Array.from({ length: Math.ceil(1440 / s) }, (_, i) => minutesToTime(i * s));
};
/** Step a time by `delta` minutes, wrapping around midnight. */
export const stepTime = (time: string, delta: number) => minutesToTime((Number.isNaN(timeToMinutes(time)) ? 0 : timeToMinutes(time)) + delta);

// ---------------------------------------------------------------- keyboard

/**
 * Where the focused day goes for a key in the month grid (WAI-ARIA date picker): ← → a day, ↑ ↓ a
 * week, PageUp / PageDown a month (with Shift a year), Home / End the start / end of the week. The
 * result is clamped to [min, max]. null = not a navigation key.
 */
export function moveDay(key: DayKey, keyName: string, options: { weekStart?: number; shiftKey?: boolean; min?: string | null; max?: string | null } = {}): DayKey | null {
  const { weekStart = 1, shiftKey = false, min, max } = options;
  let next: DayKey;
  switch (keyName) {
    case "ArrowLeft": next = addDays(key, -1); break;
    case "ArrowRight": next = addDays(key, 1); break;
    case "ArrowUp": next = addDays(key, -7); break;
    case "ArrowDown": next = addDays(key, 7); break;
    case "PageUp": next = addMonths(key, shiftKey ? -12 : -1); break;
    case "PageDown": next = addMonths(key, shiftKey ? 12 : 1); break;
    case "Home": next = startOfWeek(key, weekStart); break;
    case "End": next = endOfWeek(key, weekStart); break;
    default: return null;
  }
  return clampDay(next, min, max);
}

// ---------------------------------------------------------------- range presets

export type DateRangePresetKey = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "last7" | "last30" | "last90" | "thisYear";
export const DATE_RANGE_PRESET_LABELS: Record<DateRangePresetKey, string> = {
  today: "今天",
  yesterday: "昨天",
  thisWeek: "本周",
  lastWeek: "上周",
  thisMonth: "本月",
  lastMonth: "上月",
  last7: "近 7 天",
  last30: "近 30 天",
  last90: "近 90 天",
  thisYear: "今年",
};
/** The range a preset means on `today` (local day; 「近 7 天」 = today and the 6 days before). */
export function dateRangePreset(key: DateRangePresetKey, today: DayKey, weekStart = 1): DateRangeValue {
  switch (key) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: addDays(today, -1), to: addDays(today, -1) };
    case "thisWeek": return { from: startOfWeek(today, weekStart), to: endOfWeek(today, weekStart) };
    case "lastWeek": return { from: addDays(startOfWeek(today, weekStart), -7), to: addDays(startOfWeek(today, weekStart), -1) };
    case "thisMonth": return { from: startOfMonth(today), to: endOfMonth(today) };
    case "lastMonth": { const prev = addMonths(startOfMonth(today), -1); return { from: prev, to: endOfMonth(prev) }; }
    case "last7": return { from: addDays(today, -6), to: today };
    case "last30": return { from: addDays(today, -29), to: today };
    case "last90": return { from: addDays(today, -89), to: today };
    case "thisYear": return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
}
export type DateRangePreset = { key: string; label: string; range: DateRangeValue };
/** Presets for DateRangePicker `presets` from keys (`["today", "thisWeek", "thisMonth", "last7"]`). */
export function dateRangePresets(keys: readonly DateRangePresetKey[], options: { now?: Date; weekStart?: number } = {}): DateRangePreset[] {
  const today = todayKey(options.now);
  return keys.map((key) => ({ key, label: DATE_RANGE_PRESET_LABELS[key], range: dateRangePreset(key, today, options.weekStart ?? 1) }));
}
/** The preset whose range equals `value` (for aria-pressed), else undefined. */
export const matchingPreset = (presets: readonly DateRangePreset[], value: DateRangeValue) => presets.find((p) => p.range.from === value.from && p.range.to === value.to)?.key;

// ---------------------------------------------------------------- quick picks, 「周四 · 明天」, due colours

/** Whole days from `today` to `day` (negative = before). */
export const daysBetween = (today: DayKey, day: DayKey) => Math.round((toUtc(day) - toUtc(today)) / DAY_MS);

export type QuickDay = { key: "today" | "tomorrow" | "nextMonday" | "nextWeek"; label: string; day: DayKey };
/** The quick row on top of a date popover: 今天 / 明天 / 下周一 / 一周后. */
export function quickDays(today: DayKey): QuickDay[] {
  return [
    { key: "today", label: "今天", day: today },
    { key: "tomorrow", label: "明天", day: addDays(today, 1) },
    { key: "nextMonday", label: "下周一", day: addDays(startOfWeek(today, 1), 7) },
    { key: "nextWeek", label: "一周后", day: addDays(today, 7) },
  ];
}

/** 「今天 / 明天 / 后天 / 昨天 / 前天 / 5 天后 / 3 天前」. */
export function relativeDayWord(today: DayKey, day: DayKey): string {
  const n = daysBetween(today, day);
  const named: Record<string, string> = { "0": "今天", "1": "明天", "2": "后天", "-1": "昨天", "-2": "前天" };
  return named[String(n)] ?? (n > 0 ? `${n} 天后` : `${-n} 天前`);
}

/** How a due date stands: past = overdue, today / tomorrow = soon, else null. */
export function dueState(today: DayKey, day: DayKey): "overdue" | "soon" | null {
  const n = daysBetween(today, day);
  return n < 0 ? "overdue" : n <= 1 ? "soon" : null;
}

/**
 * What follows a date in a box or a cell: 「周四 · 明天」; with `deadline` a past day adds 「（已过期）」.
 * Empty for anything that is not a day.
 */
export function relativeDayText(today: DayKey, value: string, deadline = false): string {
  const day = dayPart(value);
  if (!day) return "";
  const text = `周${WEEKDAY_NAMES[weekdayOf(day)]} · ${relativeDayWord(today, day)}`;
  return deadline && dueState(today, day) === "overdue" ? `${text}（已过期）` : text;
}
