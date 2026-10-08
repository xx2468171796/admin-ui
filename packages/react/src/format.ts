/**
 * The one place that turns dates and money into text. Pure: no React, no DOM; unit-tested in
 * test/format.test.ts. Every component that shows a time (CellDate, DateTimeDisplay, RelativeTime,
 * ActivityFeed, BitableGrid date fields) or an amount (MoneyDisplay, KpiCard values, grid currency
 * fields) goes through these functions, so the same value reads the same everywhere.
 *
 * - Dates: `2026-09-30` / `2026-09-30 14:05` / `2026-09-30 14:05:09` in a time zone (default: the
 *   runtime's, see admin-defaults.ts), never the browser's locale format.
 * - Relative time: 刚刚 / 5 分钟前 / 3 小时前 (same day) / 昨天 14:05 / 9月30日 14:05 (this year) /
 *   2025-12-31; future times read 「x 分钟后」.
 * - Money: minor units (fen, bigint) only, never floating point; negative amounts use the true minus
 *   sign (U+2212) like every other number in the SDK.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";

export type DateInput = string | number | Date;
/** True minus sign (U+2212): columns of tabular numerals stay aligned. */
export const MINUS = "−";

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string) => {
  let value = FORMATTERS.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    FORMATTERS.set(timeZone, value);
  }
  return value;
};
/** Epoch milliseconds of a date input; null for empty or unparsable values. */
export function toTime(value: DateInput | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const t = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}
const partsOf = (time: number, timeZone: string) => {
  const p = formatterFor(timeZone).formatToParts(new Date(time));
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute"), ss: get("second") };
};

export type DateTimeFormatOptions = {
  /** Add hours and minutes (default: date only). */
  time?: boolean;
  /** Add seconds (implies `time`). */
  seconds?: boolean;
  timeZone?: string;
};
/** `2026-09-30` / `2026-09-30 14:05` / `2026-09-30 14:05:09` in the time zone; null when empty or invalid. */
export function formatDateTime(value: DateInput | null | undefined, options: DateTimeFormatOptions = {}): string | null {
  const t = toTime(value);
  if (t === null) return null;
  const p = partsOf(t, options.timeZone ?? runtimeTimeZone());
  const day = `${p.y}-${p.m}-${p.d}`;
  if (!options.time && !options.seconds) return day;
  return `${day} ${p.hh}:${p.mm}${options.seconds ? `:${p.ss}` : ""}`;
}

/** Calendar day key "YYYY-MM-DD" in a time zone; "" when empty or invalid. */
export function dayKey(value: DateInput | null | undefined, timeZone = runtimeTimeZone()): string {
  return formatDateTime(value, { timeZone }) ?? "";
}

/** Short human time for feeds, compact lists and "last seen" cells (see the module comment). "—" when empty. */
export function relativeTime(value: DateInput | null | undefined, now = Date.now(), timeZone = runtimeTimeZone()): string {
  const t = toTime(value);
  if (t === null) return "—";
  const diff = now - t;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "前" : "后";
  if (abs < 45_000) return diff >= 0 ? "刚刚" : "马上";
  if (abs < 3_600_000) return `${Math.max(1, Math.round(abs / 60_000))} 分钟${suffix}`;
  const day = dayKey(t, timeZone);
  if (day === dayKey(now, timeZone)) return `${Math.round(abs / 3_600_000)} 小时${suffix}`;
  const p = partsOf(t, timeZone);
  if (day === dayKey(now - 86_400_000, timeZone)) return `昨天 ${p.hh}:${p.mm}`;
  if (p.y === partsOf(now, timeZone).y) return `${Number(p.m)}月${Number(p.d)}日 ${p.hh}:${p.mm}`;
  return `${p.y}-${p.m}-${p.d}`;
}

/** Heading of a day group: 今天 / 昨天 / 9月30日 星期二 / 2025年12月31日. */
export function dayLabel(key: string, now = Date.now(), timeZone = runtimeTimeZone()): string {
  if (!key) return "时间未知";
  if (key === dayKey(now, timeZone)) return "今天";
  if (key === dayKey(now - 86_400_000, timeZone)) return "昨天";
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const week = "日一二三四五六"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return y === Number(dayKey(now, timeZone).slice(0, 4)) ? `${m}月${d}日 星期${week}` : `${y}年${m}月${d}日`;
}

export type MoneyFormatOptions = {
  /** Currency symbol before the amount (default "": none; MoneyDisplay uses AdminProvider `defaults.currency`). */
  symbol?: string;
  /** Unit after the amount, e.g. "元" → "1,234.56 元" (default none). */
  unit?: string;
  /**
   * Fraction digits shown, 0 … `minorDigits` (default = `minorDigits`, i.e. 2): 237900000 with
   * digits 0 → "$2,379,000". Dropped digits round half away from zero (12350 → "¥124",
   * −12350 → "−¥124"); the value itself stays in minor units — this is display only.
   */
  digits?: number;
  /** How many decimal places one minor unit is (default 2: fen / cents; 0 for JPY-like currencies). */
  minorDigits?: number;
};
const clampDigits = (value: number | undefined, fallback: number, max: number) =>
  value === undefined || !Number.isFinite(value) ? fallback : Math.min(max, Math.max(0, Math.trunc(value)));
/**
 * Round an amount in minor units to `digits` shown fraction digits (half away from zero), still in
 * minor units: roundMinor(12350n, 0) → 12400n. Used by formatMinorMoney and the grid's money input.
 */
export function roundMinor(minor: bigint, digits: number, minorDigits = 2): bigint {
  const scale = clampDigits(minorDigits, 2, 6);
  const drop = 10n ** BigInt(scale - clampDigits(digits, scale, scale));
  if (drop === 1n) return minor;
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const rounded = ((abs * 2n + drop) / (drop * 2n)) * drop;
  return negative ? -rounded : rounded;
}
/**
 * Minor units (fen, bigint) → "1,234.56" / "¥1,234.56" / "−¥0.05" / "1,234.56 元" / "$2,379,000" (digits 0).
 * Money never goes through floating point or compact rounding. Presentation only — no wallet /
 * business arithmetic. An amount that rounds to zero shows without a minus sign.
 */
export function formatMinorMoney(minor: bigint | null | undefined, options: MoneyFormatOptions = {}): string {
  if (typeof minor !== "bigint") return "—";
  const { symbol = "", unit = "" } = options;
  const scale = clampDigits(options.minorDigits, 2, 6);
  const digits = clampDigits(options.digits, scale, scale);
  const rounded = roundMinor(minor, digits, scale);
  const negative = rounded < 0n;
  const abs = (negative ? -rounded : rounded) / 10n ** BigInt(scale - digits);
  const unitScale = 10n ** BigInt(digits);
  const whole = (abs / unitScale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = digits ? `.${(abs % unitScale).toString().padStart(digits, "0")}` : "";
  return `${negative ? MINUS : ""}${symbol}${whole}${fraction}${unit ? ` ${unit}` : ""}`;
}

