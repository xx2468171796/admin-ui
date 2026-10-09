/**
 * Deadline dates (下次跟进, 到期日): how a due date stands against today, by calendar day in a time zone.
 * Pure, no React / DOM — exported from the root entry and from `@adminui/react/grid-query`, so a server
 * (reminders, counts) and the browser colour the same records. Unit-tested in test/deadline-core.test.ts.
 *
 * - overdue: the day is before today (`days` = whole days overdue, ≥ 1);
 * - today: the day is today (`days` = 0);
 * - soon: 1–2 days ahead (`days` = days until);
 * - none: further ahead, empty or invalid.
 * A datetime counts by its calendar day in the zone: due at 15:00 today is 「today」 all day, never overdue
 * by the hour. Date-only strings ("2026-10-13") are days already and are never shifted by the zone.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";
import { diffDays, toDay, todayKey } from "./views/date-core.ts";

export type DeadlineKind = "none" | "soon" | "today" | "overdue";
export type DeadlineState = { kind: DeadlineKind; days: number };
export type DeadlineOptions = {
  /** The moment that is 「now」 (default: the current time). */
  now?: Date;
  /** IANA zone the calendar days are counted in (default: the runtime's; components pass AdminProvider `defaults.timeZone`). */
  timeZone?: string;
};
/** Days ahead that still count as 「soon」. */
export const DEADLINE_SOON_DAYS = 2;
const NONE: DeadlineState = { kind: "none", days: 0 };

/** See the module comment. */
export function deadlineState(value: string | Date | null | undefined, opts: DeadlineOptions = {}): DeadlineState {
  if (value === null || value === undefined || value === "") return NONE;
  const zone = opts.timeZone || runtimeTimeZone();
  const day = toDay(value, zone);
  if (!day) return NONE;
  const today = todayKey((opts.now ?? new Date()).getTime(), zone);
  const ahead = diffDays(today, day);
  if (!Number.isFinite(ahead)) return NONE;
  if (ahead < 0) return { kind: "overdue", days: -ahead };
  if (ahead === 0) return { kind: "today", days: 0 };
  if (ahead <= DEADLINE_SOON_DAYS) return { kind: "soon", days: ahead };
  return NONE;
}

/** Text tone of a deadline: overdue = danger, today / soon = warning, else null. */
export function deadlineTone(state: DeadlineState): "danger" | "warning" | null {
  return state.kind === "overdue" ? "danger" : state.kind === "none" ? null : "warning";
}

/**
 * Words for a deadline: 「已逾期 3 天」 / 「今天到期」 / 「明天到期」 / 「2 天后到期」; "" for none.
 * `short` = the compact in-cell form, only for overdue: 「逾期 3 天」.
 */
export function deadlineText(state: DeadlineState, short = false): string {
  if (state.kind === "overdue") return short ? `逾期 ${state.days} 天` : `已逾期 ${state.days} 天`;
  if (state.kind === "today") return "今天到期";
  if (state.kind === "soon") return state.days === 1 ? "明天到期" : `${state.days} 天后到期`;
  return "";
}

/** What `fieldDeadline` needs of a GridField (structural, so this module stays free of the grid). */
export type DeadlineField<T> = {
  key: string;
  type: string;
  value?: (row: T) => unknown;
  timeZone?: string;
  deadline?: boolean | { closed?: (row: T) => boolean };
};
/**
 * The deadline state of a GridField's value for a row: null when the field is not a date / datetime deadline or the
 * row is closed (`deadline.closed(row)`). Zone: the field's `timeZone`, else `opts.timeZone`.
 */
export function fieldDeadline<T>(field: DeadlineField<T>, row: T, opts: DeadlineOptions = {}): DeadlineState | null {
  const spec = field.deadline;
  if (!spec || (field.type !== "date" && field.type !== "datetime")) return null;
  if (typeof spec === "object" && spec.closed?.(row)) return null;
  const raw = field.value ? field.value(row) : (row as Record<string, unknown>)[field.key];
  const value = typeof raw === "number" ? new Date(raw) : raw instanceof Date || typeof raw === "string" ? raw : null;
  return deadlineState(value, { now: opts.now, timeZone: field.timeZone ?? opts.timeZone });
}
