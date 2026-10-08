/**
 * Pure layout of GanttView (bt/views V7): time scales (week / month / quarter / year), the visible
 * window, bar geometry with off-screen pills, drag move / resize in whole days, workday-only spans
 * (host WorkCalendar: weekends, holidays, make-up days), header ticks with non-working shading, and
 * the flattened list rows for up to two group levels. Unit-tested in test/views-gantt-core.test.ts.
 */
import { addDays, addMonths, addWorkdays, diffDays, isWorkday, monthTitle, shortDay, startOfWeek, weekday, WEEKDAY_SHORT, workdaysBetween, type DayKey, type Weekday, type WorkCalendar } from "./date-core.ts";

export type GanttScale = "week" | "month" | "quarter" | "year";
export const GANTT_SCALES: readonly GanttScale[] = ["week", "month", "quarter", "year"];
/** 「month」 is the day-level scale: `visibleDays` (default 15) days from two days before the anchor. */
export const GANTT_SCALE_LABELS: Readonly<Record<GanttScale, string>> = { week: "周", month: "两周", quarter: "季", year: "年" };
/** Pixels per day of each scale when the timeline fills whatever the list leaves (list width set by the host / dragged, list collapsed, 季 / 年). */
export const GANTT_DAY_WIDTH: Readonly<Record<GanttScale, number>> = { week: 56, month: 36, quarter: 8, year: 2.4 };
/** Days on the 「两周」 scale by default (GanttView `visibleDays`). */
export const GANTT_VISIBLE_DAYS = 15;
/** Days shown before the anchor on the 「两周」 scale, so 「今天」 is the 3rd column rather than the left edge. */
export const GANTT_LEAD_DAYS = 2;
/**
 * Default split of the gantt body: the timeline gets `visibleDays` × `dayComfort` px, the list the rest
 * (between `listMin` and `listMax`); narrower bodies shrink the day width down to `dayMin` first, then
 * the list stops at `listMin`. `splitter` is the separator's width; `timelineMin` is what a splitter
 * drag must leave for the timeline. The separator takes no room (it overlaps both panes with negative margins).
 */
export const GANTT_SPLIT = { dayMin: 28, dayComfort: 36, listMin: 320, listMax: 880, splitter: 0, timelineMin: 240 } as const;

export type GanttWindow = { start: DayKey; days: number };
export const windowEnd = (w: GanttWindow): DayKey => addDays(w.start, w.days - 1);

/** Lead days before the anchor for a window of `visibleDays` (2 for 15 days, none for very short windows). */
export const leadDays = (visibleDays: number) => Math.max(0, Math.min(GANTT_LEAD_DAYS, Math.floor((visibleDays - 1) / 3)));
/** Where the window starts for an anchor day: `lead` days before it (两周), or the week / quarter / year that holds it. */
export function windowStart(anchor: DayKey, scale: GanttScale, weekStart: Weekday = 1, lead: number = GANTT_LEAD_DAYS): DayKey {
  if (scale === "week") return startOfWeek(anchor, weekStart);
  if (scale === "month") return addDays(anchor, -lead);
  const month = Number(anchor.slice(5, 7));
  if (scale === "quarter") return `${anchor.slice(0, 4)}-${String(month - ((month - 1) % 3)).padStart(2, "0")}-01`;
  return `${anchor.slice(0, 4)}-01-01`;
}
/** The visible window for a timeline `width` px wide filled with days of `dayWidth` (at least 7 days). */
export function ganttWindow(anchor: DayKey, scale: GanttScale, width: number, weekStart: Weekday = 1, dayWidth: number = GANTT_DAY_WIDTH[scale]): GanttWindow {
  return { start: windowStart(anchor, scale, weekStart), days: Math.max(7, Math.ceil(Math.max(0, width) / dayWidth)) };
}
/** Default list width and day width for a gantt body `bodyWidth` px wide (see GANTT_SPLIT). */
export function ganttAutoSplit(
  bodyWidth: number,
  visibleDays: number = GANTT_VISIBLE_DAYS,
  listNeed: number = GANTT_SPLIT.listMin,
): { listWidth: number; dayWidth: number } {
  const n = Math.max(1, Math.round(visibleDays));
  const room = Math.max(0, bodyWidth - GANTT_SPLIT.splitter);
  // The list's columns come first: days shrink (down to dayMin) before the list drops below what its columns need.
  const need = Math.max(GANTT_SPLIT.listMin, Math.min(GANTT_SPLIT.listMax, listNeed));
  let dayWidth = Math.max(GANTT_SPLIT.dayMin, Math.min(GANTT_SPLIT.dayComfort, Math.floor((room - need) / n)));
  if (room - n * dayWidth > GANTT_SPLIT.listMax) dayWidth = Math.floor((room - GANTT_SPLIT.listMax) / n);
  return { listWidth: Math.max(GANTT_SPLIT.listMin, room - n * dayWidth), dayWidth };
}
export type GanttFrameInput = {
  anchor: DayKey;
  scale: GanttScale;
  /** Inner width of the gantt body (list + splitter + timeline, without a vertical scrollbar). */
  bodyWidth: number;
  visibleDays?: number;
  weekStart?: Weekday;
  /** A width set by the host or by dragging the splitter; null / undefined = the default split. */
  listWidth?: number | null;
  collapsed?: boolean;
  /** Natural width of the list's columns (ganttListNeed); the default split keeps at least this much for the list. */
  listNeed?: number;
};
export type GanttFrame = {
  listWidth: number;
  dayWidth: number;
  window: GanttWindow;
  /** The list follows the default split. */
  auto: boolean;
};
/**
 * List width, day width and window of a GanttView. Default split: 「两周」 shows exactly `visibleDays`
 * days (fewer when even `dayMin` days don't fit next to a `listMin` list), 「周」 7 days across the same
 * timeline. A set list width or a collapsed list: the timeline fills the rest with GANTT_DAY_WIDTH days.
 * 「季」 / 「年」 always fill.
 */
export function ganttFrame(input: GanttFrameInput): GanttFrame {
  const n = Math.max(1, Math.round(input.visibleDays ?? GANTT_VISIBLE_DAYS));
  const auto = input.listWidth === null || input.listWidth === undefined;
  const split = ganttAutoSplit(input.bodyWidth, n, input.listNeed);
  const listWidth = input.collapsed ? 0 : (input.listWidth ?? split.listWidth);
  const timeline = Math.max(0, input.bodyWidth - listWidth - GANTT_SPLIT.splitter);
  const start = windowStart(input.anchor, input.scale, input.weekStart ?? 1, leadDays(n));
  const fill = (dayWidth: number): GanttFrame => ({ listWidth, dayWidth, auto, window: { start, days: Math.max(7, Math.ceil(timeline / dayWidth)) } });
  if (!auto || input.collapsed || input.scale === "quarter" || input.scale === "year") return fill(GANTT_DAY_WIDTH[input.scale]);
  if (input.scale === "week") return { listWidth, dayWidth: Math.max(GANTT_SPLIT.dayMin, timeline / 7), auto, window: { start, days: 7 } };
  return timeline >= n * split.dayWidth ? { listWidth, dayWidth: split.dayWidth, auto, window: { start, days: n } } : fill(split.dayWidth);
}
/** ‹ / › : `days` (两周, default 15) / one week / quarter / year back or forward. */
export function shiftAnchor(anchor: DayKey, scale: GanttScale, dir: -1 | 1, days: number = GANTT_VISIBLE_DAYS): DayKey {
  if (scale === "week") return addDays(anchor, 7 * dir);
  if (scale === "month") return addDays(anchor, Math.max(1, Math.round(days)) * dir);
  return addMonths(anchor, (scale === "quarter" ? 3 : 12) * dir);
}
/** Label of a scale in the switcher: 「两周」 for 14–15 days, else 「N 天」. */
export function ganttScaleLabel(scale: GanttScale, visibleDays: number = GANTT_VISIBLE_DAYS): string {
  if (scale !== "month" || visibleDays === 14 || visibleDays === 15) return GANTT_SCALE_LABELS[scale];
  return `${Math.max(1, Math.round(visibleDays))} 天`;
}
/** Header title of the window: 「2026 年 10 月」, 「2026 年 9 – 10 月」, 「2026 年 12 月 – 2027 年 1 月」, 「2026 年第 4 季度」, 「2026 年」. */
export function windowTitle(w: GanttWindow, scale: GanttScale): string {
  if (scale === "quarter") return `${Number(w.start.slice(0, 4))} 年第 ${Math.floor((Number(w.start.slice(5, 7)) - 1) / 3) + 1} 季度`;
  if (scale === "year") return `${Number(w.start.slice(0, 4))} 年`;
  const end = windowEnd(w);
  if (end.slice(0, 7) === w.start.slice(0, 7)) return monthTitle(w.start);
  if (end.slice(0, 4) === w.start.slice(0, 4)) return `${Number(w.start.slice(0, 4))} 年 ${Number(w.start.slice(5, 7))} – ${Number(end.slice(5, 7))} 月`;
  return `${monthTitle(w.start)} – ${monthTitle(end)}`;
}

// ---------------------------------------------------------------- spans

export type GanttEndMode = "field" | "duration" | "fixed";
export type GanttSpanOptions = {
  endMode: GanttEndMode;
  /** Durations count working days only (weekends / holidays skipped). */
  workdaysOnly?: boolean;
  /** endMode "fixed": every task lasts this many (working) days. Default 1. */
  fixedDays?: number;
};
export type GanttSpan = { start: DayKey; end: DayKey; days: number; workdays: number };

/** A record's bar: from `start` to the end field, or start + duration / fixed days. null without a start. */
export function ganttSpan(start: DayKey | null, end: DayKey | null, duration: number | null, options: GanttSpanOptions, calendar: WorkCalendar = {}): GanttSpan | null {
  if (!start) return null;
  let last: DayKey;
  if (options.endMode === "field") last = end && end >= start ? end : start;
  else {
    const n = Math.max(1, Math.round((options.endMode === "duration" ? duration : options.fixedDays) ?? 1));
    last = options.workdaysOnly ? addWorkdays(start, n, calendar) : addDays(start, n - 1);
  }
  return { start, end: last, days: diffDays(start, last) + 1, workdays: workdaysBetween(start, last, calendar) };
}
export type GanttDragKind = "move" | "start" | "end";
/** Days moved by a drag of `dx` px (rounded to whole days). */
export const dragDays = (dx: number, dayWidth: number) => Math.round(dx / dayWidth) || 0;
/** Whether a bar's edges can be dragged: endMode "fixed" means every task lasts `fixedDays`, so only moving makes sense. */
export const ganttResizable = (options: Pick<GanttSpanOptions, "endMode">) => options.endMode !== "fixed";
/**
 * New start / end after dragging the bar body or one edge by `delta` days; never shorter than one day.
 * With `keep` (the view's span options): a move of a duration / fixed task that counts working days only
 * keeps its working-day count (the end lands after the same number of workdays, weekends skipped), and
 * edges of a "fixed" task don't move.
 */
export function dragSpan(span: Pick<GanttSpan, "start" | "end">, kind: GanttDragKind, delta: number, keep?: { options: GanttSpanOptions; calendar?: WorkCalendar }): { start: DayKey; end: DayKey } {
  if (keep && kind !== "move" && !ganttResizable(keep.options)) return { start: span.start, end: span.end };
  if (kind === "move") {
    const start = addDays(span.start, delta);
    if (keep?.options.workdaysOnly && keep.options.endMode !== "field") {
      const calendar = keep.calendar ?? {};
      return { start, end: addWorkdays(start, Math.max(1, workdaysBetween(span.start, span.end, calendar)), calendar) };
    }
    return { start, end: addDays(span.end, delta) };
  }
  if (kind === "start") {
    const start = addDays(span.start, delta);
    return { start: start > span.end ? span.end : start, end: span.end };
  }
  const end = addDays(span.end, delta);
  return { start: span.start, end: end < span.start ? span.start : end };
}
/** What the host gets after a drag: start, end and the duration in the view's unit (working or calendar days). */
export function spanChange(next: { start: DayKey; end: DayKey }, options: GanttSpanOptions, calendar: WorkCalendar = {}): { start: DayKey; end: DayKey; duration: number } {
  return { start: next.start, end: next.end, duration: options.workdaysOnly ? workdaysBetween(next.start, next.end, calendar) : diffDays(next.start, next.end) + 1 };
}
/** 「6 个工作日（含 1 天休息日不计）」 or 「7 天」. */
export function durationText(span: GanttSpan, workdaysOnly: boolean): string {
  if (!workdaysOnly) return `${span.days} 天`;
  const off = span.days - span.workdays;
  return off > 0 ? `${span.workdays} 个工作日（含 ${off} 天休息日不计）` : `${span.workdays} 个工作日`;
}
/** Runs of non-working days inside a span (hatched on the bar): offsets in days from the span start. */
export function nonWorkRuns(span: Pick<GanttSpan, "start" | "end">, calendar: WorkCalendar = {}): { offset: number; length: number }[] {
  const runs: { offset: number; length: number }[] = [];
  const n = diffDays(span.start, span.end) + 1;
  for (let i = 0; i < n; i++) {
    if (isWorkday(addDays(span.start, i), calendar)) continue;
    const last = runs[runs.length - 1];
    if (last && last.offset + last.length === i) last.length++;
    else runs.push({ offset: i, length: 1 });
  }
  return runs;
}

// ---------------------------------------------------------------- geometry

export type BarBox =
  | { visible: true; left: number; width: number; clippedStart: boolean; clippedEnd: boolean }
  | { visible: false; side: "before" | "after" };
/** Pixel box of [start, end] in the window; off-screen bars report the side for an edge pill. */
export function barBox(span: Pick<GanttSpan, "start" | "end">, w: GanttWindow, dayWidth: number): BarBox {
  const last = windowEnd(w);
  if (span.end < w.start) return { visible: false, side: "before" };
  if (span.start > last) return { visible: false, side: "after" };
  const from = Math.max(0, diffDays(w.start, span.start));
  const to = Math.min(w.days - 1, diffDays(w.start, span.end));
  return { visible: true, left: from * dayWidth, width: (to - from + 1) * dayWidth, clippedStart: span.start < w.start, clippedEnd: span.end > last };
}
/** Left offset (px) of a day in the window (may be negative / beyond the end). */
export const dayOffset = (day: DayKey, w: GanttWindow, dayWidth: number) => diffDays(w.start, day) * dayWidth;
/** The anchor that brings an off-screen span into view (its start a few days in). */
export function revealAnchor(span: Pick<GanttSpan, "start">, scale: GanttScale): DayKey {
  return scale === "week" || scale === "month" ? span.start : addDays(span.start, -7);
}
/** 「09-28 → 09-30」 */
export const spanText = (span: Pick<GanttSpan, "start" | "end">) => (span.start === span.end ? shortDay(span.start) : `${shortDay(span.start)} → ${shortDay(span.end)}`);

export type GanttTick = { key: string; label: string; sub?: string; left: number; width: number; today?: boolean; nonWork?: boolean; makeup?: boolean; /** Host holiday name (「国庆日」): the day is hatched and its header reads 「休」. */ holiday?: string };
export type GanttTicks = { top: GanttTick[]; bottom: GanttTick[]; /** Day columns for the background (week / month / quarter scales). */ days: GanttTick[] };

/** Header rows and background day columns of a window. */
export function ganttTicks(w: GanttWindow, scale: GanttScale, today: DayKey, calendar: WorkCalendar = {}, weekStart: Weekday = 1, dayWidth: number = GANTT_DAY_WIDTH[scale]): GanttTicks {
  const dw = dayWidth;
  // A month cut short by the window edge reads 「9 月」 instead of a clipped 「2026 年 9 …」.
  const monthLabel = (key: string, from: number, to: number) => ((to - from + 1) * dw < 100 ? `${Number(key.slice(5, 7))} 月` : monthTitle(`${key}-01`));
  const days: GanttTick[] = [];
  const top: GanttTick[] = [];
  const bottom: GanttTick[] = [];
  const pushRun = (list: GanttTick[], key: string, label: string, from: number, to: number, extra: Partial<GanttTick> = {}) => list.push({ key, label, left: from * dw, width: (to - from + 1) * dw, ...extra });
  let runStart = 0;
  let runKey = "";
  let weekStartIndex = 0;
  for (let i = 0; i < w.days; i++) {
    const day = addDays(w.start, i);
    const work = isWorkday(day, calendar);
    const makeup = Boolean(calendar.workdays?.[day]);
    const holiday = !makeup && calendar.holidays?.[day] !== undefined ? calendar.holidays[day] || "休息日" : undefined;
    if (scale !== "year") days.push({ key: day, label: "", left: i * dw, width: dw, nonWork: !work, makeup, today: day === today, ...(holiday ? { holiday } : {}) });
    if (scale === "week" || scale === "month") {
      bottom.push({ key: day, label: String(Number(day.slice(8))), sub: makeup ? "班" : holiday ? "休" : WEEKDAY_SHORT[weekday(day)], left: i * dw, width: dw, today: day === today, nonWork: !work, makeup, ...(holiday ? { holiday } : {}) });
    }
    // Top row: months (week / month / quarter), years (year scale).
    const topKey = scale === "year" ? day.slice(0, 4) : day.slice(0, 7);
    if (topKey !== runKey) {
      if (runKey) pushRun(top, runKey, scale === "year" ? `${Number(runKey)} 年` : monthLabel(runKey, runStart, i - 1), runStart, i - 1);
      runKey = topKey;
      runStart = i;
    }
    // Bottom row of quarter: weeks (starting on the view's weekStart); of year: months.
    if (scale === "quarter" && weekday(day) === weekStart && i > 0) {
      pushRun(bottom, addDays(w.start, weekStartIndex), shortDay(addDays(w.start, weekStartIndex)), weekStartIndex, i - 1);
      weekStartIndex = i;
    }
  }
  if (runKey) pushRun(top, runKey, scale === "year" ? `${Number(runKey)} 年` : monthLabel(runKey, runStart, w.days - 1), runStart, w.days - 1);
  if (scale === "quarter") pushRun(bottom, addDays(w.start, weekStartIndex), shortDay(addDays(w.start, weekStartIndex)), weekStartIndex, w.days - 1);
  if (scale === "year") {
    let from = 0;
    let key = w.start.slice(0, 7);
    for (let i = 1; i <= w.days; i++) {
      const k = i < w.days ? addDays(w.start, i).slice(0, 7) : "";
      if (k !== key) {
        pushRun(bottom, key, `${Number(key.slice(5))} 月`, from, i - 1);
        from = i;
        key = k;
      }
    }
  }
  return { top, bottom, days };
}

// ---------------------------------------------------------------- list rows (≤ 2 group levels)

/** Records arrive grouped by the host (already filtered / sorted); `groups` may nest one more level. */
export type GanttGroup<T> = {
  key: string;
  label: string;
  /** Shown after the label (default: records under it). */
  count?: number;
  /** A person group shows an avatar initial. */
  person?: boolean;
  groups?: readonly GanttGroup<T>[];
  records?: readonly T[];
};
export type GanttRow<T> =
  | { kind: "group"; key: string; depth: 0 | 1; label: string; count: number; person: boolean; collapsed: boolean }
  | { kind: "record"; key: string; depth: 0 | 1 | 2; record: T };

const countOf = <T,>(g: GanttGroup<T>): number => g.count ?? (g.records?.length ?? 0) + (g.groups ?? []).reduce((n, c) => n + countOf(c), 0);
/** Flatten groups into list rows; a collapsed group hides what is under it. Group keys are paths ("阿明/上海"). */
export function ganttRows<T>(groups: readonly GanttGroup<T>[], recordId: (record: T) => string, collapsed: ReadonlySet<string> = new Set()): GanttRow<T>[] {
  const rows: GanttRow<T>[] = [];
  const walk = (list: readonly GanttGroup<T>[], depth: 0 | 1, prefix: string) => {
    for (const g of list) {
      const key = prefix ? `${prefix}/${g.key}` : g.key;
      const isCollapsed = collapsed.has(key);
      rows.push({ kind: "group", key, depth, label: g.label, count: countOf(g), person: Boolean(g.person), collapsed: isCollapsed });
      if (isCollapsed) continue;
      if (g.groups?.length && depth === 0) walk(g.groups, 1, key);
      for (const r of g.records ?? []) rows.push({ kind: "record", key: recordId(r), depth: (depth + 1) as 1 | 2, record: r });
    }
  };
  walk(groups, 0, "");
  return rows;
}
/** All group keys (expand / collapse all). */
export function groupKeys<T>(groups: readonly GanttGroup<T>[], prefix = ""): string[] {
  return groups.flatMap((g) => {
    const key = prefix ? `${prefix}/${g.key}` : g.key;
    return [key, ...groupKeys(g.groups ?? [], key)];
  });
}
/** Default left column widths by field type; a column is never narrower than its header (icon + title). */
const COL_WIDTH: Partial<Record<string, number>> = { text: 156, date: 92, datetime: 110, number: 64, money: 110, user: 96, singleSelect: 88 };
/** Width a column needs for its header: 10px padding each side, 14px icon + 5px gap + a few px of slack, ~13px per character. */
export const listColumnWidth = (field: { type: string; title: string }) => Math.max(COL_WIDTH[field.type] ?? 100, 44 + 13 * [...field.title].length);
/** Width the left list needs to show all its columns at their natural width. */
export const ganttListNeed = (fields: readonly { type: string; title: string }[]) =>
  fields.reduce((sum, f) => sum + listColumnWidth(f), 0);
/**
 * `grid-template-columns` of the left list: each column grows with the list in proportion to its width
 * (a wider default list shows whole values instead of cut-off ones) and shrinks to 70% before the list clips.
 */
export const ganttListColumns = (fields: readonly { type: string; title: string }[]) =>
  fields
    .map((f) => {
      const w = listColumnWidth(f);
      return `minmax(${Math.round(w * 0.7)}px, ${w}fr)`;
    })
    .join(" ");
/** Left pane width after a splitter drag / arrow key, kept between `min` and `max`. */
export const clampSplit = (width: number, min = 200, max = 720) => Math.round(Math.max(min, Math.min(max, width)));

/**
 * Where a bar's text goes (review 08): inside when it fits, else right of the bar on the panel
 * background, or left of it when the bar is near the right edge of the timeline.
 */
export function barTextPlace(box: { left: number; width: number }, textWidth: number, timelineWidth: number, gap = 6): "inside" | "after" | "before" {
  if (box.width >= textWidth + 16) return "inside";
  if (box.left + box.width + gap + textWidth <= timelineWidth) return "after";
  return box.left - gap - textWidth >= 0 ? "before" : "after";
}
/** Rough width of bar text at 12px (CJK ≈ 12px, Latin / digits ≈ 7px) for `barTextPlace`. */
export const barTextWidth = (text: string) => [...text].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) >= 0x2e80 ? 12 : 7), 8);
/** The phone list's mini track: the part of a span inside the window as fractions 0–1 (null when outside). */
export function ganttTrack(span: Pick<GanttSpan, "start" | "end">, w: GanttWindow): { from: number; to: number } | null {
  const a = Math.max(0, diffDays(w.start, span.start));
  const b = Math.min(w.days, diffDays(w.start, span.end) + 1);
  if (b <= a) return null;
  return { from: a / w.days, to: b / w.days };
}
