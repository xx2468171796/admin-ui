/**
 * Rules of the 「目标进度」 card (dashboard widget `targetProgress`): completion, the 「按时间应完成」 share of the
 * period, days left and the gap / excess. Pure, no React; unit-tested in test/dashboard-target-core.test.ts.
 *
 * The period is calendar days in a time zone, both ends included (`start` / `end` as day keys or instants). The
 * share 「按时间应完成」 counts today as passed: on 10-09 of a 31-day October it is 9 / 31, 22 days are left.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";
import { diffDays, toDay, todayKey } from "./views/date-core.ts";

/** The period a target is for (「本月」 = the month's first and last day). */
export type TargetPeriod = { start: string; end: string; label?: string };
export type TargetProgressInput = {
  value: number | null | undefined;
  target: number | null | undefined;
  period?: TargetPeriod;
  /** Default: now. */
  now?: number;
  timeZone?: string;
};
export type TargetProgress = {
  /** value / target (1 = done; may exceed 1); null without a target > 0 or a value. */
  ratio: number | null;
  /** Share of the period passed, today included (0..1); null without a period. */
  elapsed: number | null;
  /** Whole days after today until the period ends (0 on its last day and after it); null without a period. */
  daysLeft: number | null;
  /** target − value while short of the target, else null. */
  gap: number | null;
  /** value − target once past it, else null. */
  over: number | null;
};

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** See the module comment. */
export function targetProgress(input: TargetProgressInput): TargetProgress {
  const { value, target } = input;
  const hasTarget = finite(target) && target > 0;
  const ratio = hasTarget && finite(value) ? value / target : null;
  const gap = hasTarget && finite(value) && value < target ? target - value : null;
  const over = hasTarget && finite(value) && value > target ? value - target : null;
  const span = periodSpan(input.period, input.now ?? Date.now(), input.timeZone || runtimeTimeZone());
  return { ratio, gap, over, elapsed: span?.elapsed ?? null, daysLeft: span?.daysLeft ?? null };
}

function periodSpan(period: TargetPeriod | undefined, now: number, timeZone: string): { elapsed: number; daysLeft: number } | null {
  if (!period) return null;
  const start = toDay(period.start, timeZone);
  const end = toDay(period.end, timeZone);
  if (!start || !end) return null;
  const total = diffDays(start, end) + 1;
  if (!Number.isFinite(total) || total < 1) return null;
  const passed = Math.min(total, Math.max(0, diffDays(start, todayKey(now, timeZone)) + 1));
  return { elapsed: passed / total, daysLeft: total - passed };
}
