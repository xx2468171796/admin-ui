/**
 * The duration unit of dashboard metrics: `unit: "duration"` means the value is a number of seconds (the gap
 * between two times on a record, e.g. a median response time). It reads 「3.2 小时」 under 48 hours and 「1.5 天」
 * from 48 hours up (one decimal, a trailing .0 dropped). Number cards, number groups, chart axes / labels /
 * tooltips, dashboard tables and the target progress card all format through here. Pure; unit-tested in
 * test/duration-format.test.ts.
 */
import { formatNumber } from "./dashboard-core.ts";
import type { GridField } from "./grid-core.ts";

/** The metric unit whose values are seconds. */
export const DURATION_UNIT = "duration";
const HOUR = 3600;
const DAY = 86_400;

/** Seconds as 「25 分钟」 (< 1 h), 「3.2 小时」 (< 48 h) or 「1.5 天」; under a minute 「不到 1 分钟」; null / NaN → 「—」. */
export function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  // Under an hour in minutes (first-response times are often that short); under a minute is just 「不到 1 分钟」.
  if (seconds === 0) return "0 分钟";
  if (Math.abs(seconds) < 60) return "不到 1 分钟";
  if (Math.abs(seconds) < HOUR) return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
  const hours = Math.abs(seconds) < 48 * HOUR;
  return `${formatNumber(seconds / (hours ? HOUR : DAY), { digits: 1 })} ${hours ? "小时" : "天"}`;
}

/** `unit` is the duration unit. */
export const isDurationUnit = (unit: string | null | undefined): boolean => unit === DURATION_UNIT;

/** Columns of a dashboard table whose unit is "duration" (`units[key]`) show their seconds as 「3.2 小时」 (values and sorting stay numbers). */
export function durationColumns<R extends Record<string, unknown>>(fields: readonly GridField<R>[], units: Readonly<Record<string, string>> | undefined): readonly GridField<R>[] {
  if (!units) return fields;
  return fields.map((f) => {
    if (!isDurationUnit(units[f.key])) return f;
    const read = (row: R) => {
      const v = f.value ? f.value(row) : row[f.key];
      return typeof v === "number" ? v : null;
    };
    return { ...f, render: (row: R) => formatDuration(read(row)) };
  });
}
