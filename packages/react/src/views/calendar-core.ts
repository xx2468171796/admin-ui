/**
 * Pure layout of the calendar views (bt/views V5 / V6): month matrix with a configurable week start,
 * multi-day bars split across weeks into lanes with 「+N 更多」 overflow, and the week / day time grid
 * (30-minute snap, side-by-side overlaps, move / resize / create maths). Time-zone aware through
 * date-core. Unit-tested in test/views-calendar-core.test.ts.
 */
import { toTime, type DateInput } from "../format.ts";
import { addDays, diffDays, isDayKey, maxDay, minDay, startOfMonth, startOfWeek, endOfMonth, toDay, zonedInstant, zonedParts, type DayKey, type Weekday } from "./date-core.ts";
import { deadlineState } from "../deadline-core.ts";
import type { OptionTone } from "../option-tone.ts";

/** What a calendar needs of a record. All-day: `start` / `end` are days (end inclusive); timed: instants. */
export type CalendarEventInput = {
  id: string;
  start: DateInput;
  end?: DateInput | null;
  /** Default: true when `start` is a day key ("2026-10-13"), else false. */
  allDay?: boolean;
};
/** An event resolved in the view's time zone. Timed events carry minutes after midnight of their first / last day. */
export type ResolvedEvent = {
  id: string;
  allDay: boolean;
  startDay: DayKey;
  /** Inclusive. */
  endDay: DayKey;
  /** Timed only: minutes after midnight of startDay / endDay (end is exclusive, 1–1440). */
  startMin: number | null;
  endMin: number | null;
};
export const DEFAULT_EVENT_MINUTES = 60;

/** Resolve one event; null when it has no usable start. A timed event without an end lasts `defaultMinutes`. */
export function resolveEvent(event: CalendarEventInput, timeZone: string, defaultMinutes = DEFAULT_EVENT_MINUTES): ResolvedEvent | null {
  const allDay = event.allDay ?? isDayKey(event.start);
  if (allDay) {
    const startDay = toDay(event.start, timeZone);
    if (!startDay) return null;
    const end = toDay(event.end ?? null, timeZone);
    return { id: event.id, allDay: true, startDay, endDay: end && end > startDay ? end : startDay, startMin: null, endMin: null };
  }
  const start = toTime(event.start);
  if (start === null) return null;
  let end = toTime(event.end ?? null);
  if (end === null || end <= start) end = start + defaultMinutes * 60_000;
  const a = zonedParts(start, timeZone);
  const b = zonedParts(end, timeZone);
  // An event ending exactly at midnight ends on the previous day at 24:00.
  const endDay = b.minutes === 0 && b.day > a.day ? addDays(b.day, -1) : b.day;
  const endMin = b.minutes === 0 && b.day > a.day ? 1440 : b.minutes;
  return { id: event.id, allDay: false, startDay: a.day, endDay, startMin: a.minutes, endMin };
}
/**
 * Events whose date is a deadline (`deadline: true`) take their colour from it: overdue = red, due today or in
 * the next 2 days = yellow (the danger / warning hues); other events and deadlines further ahead keep their `tone`.
 * The due day is the event's last day (`end`, else `start`), counted in `timeZone` against `today`.
 */
export function deadlineEvents<E extends CalendarEventInput & { tone?: OptionTone; deadline?: boolean }>(events: readonly E[], today: DayKey, timeZone: string): readonly E[] {
  if (!events.some((e) => e.deadline)) return events;
  const now = new Date(zonedInstant(today, 720, timeZone));
  return events.map((event) => {
    if (!event.deadline) return event;
    const due = event.end ?? event.start;
    const state = deadlineState(typeof due === "number" ? new Date(due) : due, { now, timeZone });
    if (state.kind === "none") return event;
    return { ...event, tone: state.kind === "overdue" ? "red" : "yellow" };
  });
}
export const spanDays = (event: Pick<ResolvedEvent, "startDay" | "endDay">) => diffDays(event.startDay, event.endDay) + 1;
/** Shown as a bar in month view / the all-day row: all-day events and timed events crossing midnight. */
export const isBarEvent = (event: ResolvedEvent) => event.allDay || event.endDay > event.startDay;

// ---------------------------------------------------------------- month

/** Weeks (rows of 7 days) covering the month of `anchor`; `fixedWeeks` always returns 6 rows. */
export function monthMatrix(anchor: DayKey, weekStart: Weekday = 1, fixedWeeks = false): DayKey[][] {
  const first = startOfWeek(startOfMonth(anchor), weekStart);
  const last = endOfMonth(anchor);
  const weeks: DayKey[][] = [];
  for (let start = first; fixedWeeks ? weeks.length < 6 : start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}
/** `count` consecutive days from the start of the week of `anchor` (count 1 = the day itself). */
export function weekDays(anchor: DayKey, weekStart: Weekday = 1, count = 7): DayKey[] {
  const start = count === 1 ? anchor : startOfWeek(anchor, weekStart);
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export type MonthSegment = {
  id: string;
  event: ResolvedEvent;
  /** Column of the first / last covered day in this week (0–6). */
  startCol: number;
  endCol: number;
  lane: number;
  /** The event started before / goes on after this week (「续下周」). */
  continuesBefore: boolean;
  continuesAfter: boolean;
};
export type MonthWeekLayout = {
  days: DayKey[];
  /** Visible segments. */
  segments: MonthSegment[];
  /** Per column: events hidden behind 「+N 更多」. */
  hidden: number[];
  /** Lanes used by visible segments. */
  lanes: number;
};

/** Order inside a week: longer bars first, then all-day before timed, then start time, then id (stable lanes). */
export function compareEvents(a: ResolvedEvent, b: ResolvedEvent): number {
  return a.startDay.localeCompare(b.startDay)
    || spanDays(b) - spanDays(a)
    || Number(b.allDay) - Number(a.allDay)
    || (a.startMin ?? 0) - (b.startMin ?? 0)
    || a.id.localeCompare(b.id);
}

/** Lanes for the segments of one row of days (greedy: first lane free on every covered column). */
function laneRow(events: readonly ResolvedEvent[], days: readonly DayKey[]): MonthSegment[] {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return [];
  const taken: boolean[][] = [];
  const out: MonthSegment[] = [];
  for (const event of [...events].sort(compareEvents)) {
    if (event.endDay < first || event.startDay > last) continue;
    const startCol = diffDays(first, maxDay(event.startDay, first));
    const endCol = diffDays(first, minDay(event.endDay, last));
    let lane = 0;
    while (taken[lane]?.slice(startCol, endCol + 1).some(Boolean)) lane++;
    const row = (taken[lane] ??= Array.from({ length: days.length }, () => false));
    for (let c = startCol; c <= endCol; c++) row[c] = true;
    out.push({ id: event.id, event, startCol, endCol, lane, continuesBefore: event.startDay < first, continuesAfter: event.endDay > last });
  }
  return out;
}

/**
 * Month layout: every event becomes one segment per week it touches, in a lane; a day cell shows at
 * most `maxLanes` lines. When a day has more, it shows `maxLanes − 1` and a 「+N 更多」 line; a bar
 * crossing such a day is hidden (counted in every day it covers) unless its lane fits everywhere.
 * `reserveMore`: the 「+N 更多」 line comes below `maxLanes` event lines instead of replacing the last
 * one (review 08: 「每格最多 3 行 +「+N 更多」」; the week view's all-day row: 2 lines + more).
 */
export function layoutMonth(events: readonly ResolvedEvent[], weeks: readonly (readonly DayKey[])[], maxLanes = 3, options: { reserveMore?: boolean } = {}): MonthWeekLayout[] {
  return weeks.map((days) => {
    const all = laneRow(events, days);
    const covering = days.map((_, col) => all.filter((s) => s.startCol <= col && s.endCol >= col).length);
    const limit = days.map((_, col) => ((covering[col] ?? 0) > maxLanes && !options.reserveMore ? maxLanes - 1 : maxLanes));
    const visible = (s: MonthSegment) => {
      for (let c = s.startCol; c <= s.endCol; c++) if (s.lane >= (limit[c] ?? maxLanes)) return false;
      return true;
    };
    const segments = all.filter(visible);
    const hidden = days.map((_, col) => all.filter((s) => !visible(s) && s.startCol <= col && s.endCol >= col).length);
    const lanes = segments.reduce((n, s) => Math.max(n, s.lane + 1), 0);
    return { days: [...days], segments, hidden, lanes };
  });
}
/** Every event on a day, in display order (the 「+N 更多」 popover). */
export function eventsOnDay(events: readonly ResolvedEvent[], day: DayKey): ResolvedEvent[] {
  return events.filter((e) => e.startDay <= day && e.endDay >= day).sort(compareEvents);
}

// ---------------------------------------------------------------- week / day time grid

export type TimedPlacement = {
  id: string;
  event: ResolvedEvent;
  day: DayKey;
  /** Minutes after midnight on `day` (clipped to 0–1440). */
  startMin: number;
  /** Display end: at least `minMinutes` after the start so a short event stays readable. */
  endMin: number;
  /** The event's real end (what moves / resizes and the time text use; never the stretched display end). */
  realEndMin: number;
  /** Side-by-side position inside its overlap cluster. */
  col: number;
  cols: number;
};
/** All-day row segments (all-day events and timed events crossing midnight) and timed blocks per day. */
export function layoutTimeGrid(events: readonly ResolvedEvent[], days: readonly DayKey[], minMinutes = 15): { allDay: MonthSegment[]; allDayLanes: number; timed: Record<DayKey, TimedPlacement[]> } {
  const allDay = laneRow(events.filter(isBarEvent), days);
  const timed: Record<DayKey, TimedPlacement[]> = {};
  for (const day of days) {
    const pieces = events
      .filter((e) => !isBarEvent(e) && e.startDay === day)
      .map((e) => ({ event: e, start: e.startMin ?? 0, end: Math.max((e.startMin ?? 0) + minMinutes, e.endMin ?? 0) }));
    timed[day] = overlapColumns(pieces).map((p) => ({ id: p.event.id, event: p.event, day, startMin: p.start, endMin: Math.min(1440, p.end), realEndMin: Math.min(1440, Math.max(p.start, p.event.endMin ?? p.start)), col: p.col, cols: p.cols }));
  }
  return { allDay, allDayLanes: allDay.reduce((n, s) => Math.max(n, s.lane + 1), 0), timed };
}
/**
 * Side-by-side columns: events that overlap (transitively) form a cluster; each takes the first
 * column free at its start; all events of a cluster share the cluster's column count.
 */
export function overlapColumns<P extends { start: number; end: number; event: { id: string } }>(pieces: readonly P[]): (P & { col: number; cols: number })[] {
  const sorted = [...pieces].sort((a, b) => a.start - b.start || b.end - a.end || a.event.id.localeCompare(b.event.id));
  const out: (P & { col: number; cols: number })[] = [];
  let cluster: (P & { col: number; cols: number })[] = [];
  let columnsEnd: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = columnsEnd.length;
    for (const p of cluster) p.cols = cols;
    out.push(...cluster);
    cluster = [];
    columnsEnd = [];
  };
  for (const piece of sorted) {
    if (piece.start >= clusterEnd && cluster.length) flush();
    let col = columnsEnd.findIndex((end) => end <= piece.start);
    if (col < 0) col = columnsEnd.length;
    columnsEnd[col] = piece.end;
    cluster.push({ ...piece, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, piece.end);
  }
  if (cluster.length) flush();
  return out;
}

/** Round minutes to the nearest `step` (default 30). */
export const snapMinutes = (minutes: number, step = 30) => Math.round(minutes / step) * step;
/** The minute under a pointer `y` px below the top of the grid that starts at `startHour`. */
export function minutesAt(y: number, hourHeight: number, startHour = 0, step = 30): number {
  return Math.max(0, Math.min(1440, snapMinutes(startHour * 60 + (y / hourHeight) * 60, step)));
}
/** Move a timed block by whole days and snapped minutes, keeping its length; stays within its day. */
export function moveTimed(startMin: number, endMin: number, deltaMin: number, step = 30): { startMin: number; endMin: number } {
  const length = endMin - startMin;
  const start = Math.max(0, Math.min(1440 - length, snapMinutes(startMin + deltaMin, step)));
  return { startMin: start, endMin: start + length };
}
/** Drag the bottom edge: end snaps, never shorter than one step, never past midnight. */
export function resizeTimed(startMin: number, endMin: number, deltaMin: number, step = 30): { startMin: number; endMin: number } {
  return { startMin, endMin: Math.max(startMin + step, Math.min(1440, snapMinutes(endMin + deltaMin, step))) };
}
/** A drag on an empty slot from minute a to b (either direction): at least one step long. */
export function createRange(a: number, b: number, step = 30): { startMin: number; endMin: number } {
  const lo = Math.max(0, Math.min(a, b));
  const hi = Math.min(1440, Math.max(a, b));
  const start = Math.floor(lo / step) * step;
  return { startMin: start, endMin: Math.max(start + step, Math.ceil(hi / step) * step) };
}
/** Instants (ISO) for a day + minutes range in a zone — what onDateChange gets for timed events. */
export function timedRange(day: DayKey, startMin: number, endMin: number, timeZone: string): { start: string; end: string } {
  return { start: new Date(zonedInstant(day, startMin, timeZone)).toISOString(), end: new Date(zonedInstant(day, endMin, timeZone)).toISOString() };
}
/** Move an all-day / multi-day event so it starts on `day`, keeping its length. */
export function moveDays(event: Pick<ResolvedEvent, "startDay" | "endDay">, day: DayKey): { startDay: DayKey; endDay: DayKey } {
  return { startDay: day, endDay: addDays(day, diffDays(event.startDay, event.endDay)) };
}
