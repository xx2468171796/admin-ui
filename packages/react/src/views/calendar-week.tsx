"use client";
/**
 * CalendarWeek (bt/views V6, demo D09b): week (7 days) or day (`days={1}`) time grid — all-day row for
 * all-day / multi-day events, hour grid with 30-minute snap, overlapping events side by side, a now
 * line, and direct manipulation: drag an event to move it (to another time or day), drag its bottom
 * edge to resize, drag on an empty slot to create (`onCreate`), all with a live preview and the time
 * range; Esc cancels. Right-click / Shift+F10 opens the event menu (打开详情 · 改时间 · 清除日期 + the
 * host's items). Keyboard: Alt+↑ / ↓ moves 30 min, Alt+Shift+↑ / ↓ changes the length, Alt+← / → moves
 * a day (all-day bars too, also 提前一天 / 推后一天 in their menu). A click (or Enter) opens the event card
 * (打开详情 · 清除日期), a double-click opens the record. With `onCreate` the day columns are one tab stop
 * (← / → between days), Enter creates an event at the first visible step and a double-click on a blank
 * slot creates one there. Review 08: the all-day row shows 2 lines + 「+N 更多」 and an expand toggle;
 * timed blocks are soft option tone + a thin border of the same hue; the now line and its time tag are
 * the primary colour; host holidays read 「国庆日 休」 in the day header. Narrower than `agendaBelow`
 * (phones) there is no week / day view: it shows CalendarMonth's phone layout and asks the host to switch
 * to month (`onModeChange("month")`). Changes go to `onDateChange(id, startIso, endIso)`.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import { useAdminDefaults } from "../admin-defaults-context.tsx";
import { ContextMenu } from "../menu.tsx";
import { softTone } from "./view-color-core.ts";
import { addDays, clockText, dayLabelOf, diffDays, isoWeek, isWorkday, todayKey, weekday, WEEKDAY_SHORT, zonedInstant, zonedParts, type DayKey } from "./date-core.ts";
import { createRange, deadlineEvents, isBarEvent, layoutMonth, layoutTimeGrid, minutesAt, moveTimed, resizeTimed, resolveEvent, timedRange, weekDays, type MonthSegment, type ResolvedEvent, type TimedPlacement } from "./calendar-core.ts";
import { CalendarToolbar, DayBadge, eventMenuSections, whenText, type CalendarBaseProps } from "./calendar-parts.tsx";
import { EventCard, useEventCard } from "./calendar-card.tsx";
import { CalendarMonth } from "./calendar-month.tsx";
import { trackPointer, useAnnouncer } from "./view-parts.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type CalendarWeekProps = CalendarBaseProps & {
  /** 7 (week, default) or 1 (day). */
  days?: 1 | 7;
  /** Pixel height of one hour (default 52). */
  hourHeight?: number;
  /** Snap step in minutes (default 30). */
  step?: number;
  /** Hour scrolled to on open (default 8). */
  startHour?: number;
  /** Drag on an empty slot: ISO start / end of the new event. */
  onCreate?: (start: string, end: string) => void;
  /** Override the current time (tests); default Date.now(), refreshed every minute. */
  now?: number;
  /** Container width under which there is no week / day view: the phone month + agenda instead (default 560). */
  agendaBelow?: number;
};
/** All-day lines shown before 「+N 更多」 and the expand toggle (review 08). */
const ALLDAY_LINES = 2;
const ALLDAY_LANE = 24;

type Preview = { id: string | null; day: DayKey; startMin: number; endMin: number; kind: "move" | "resize" | "create" | "day" };

function rangeTitle(days: readonly DayKey[]): { title: string; sub?: string } {
  const a = days[0] ?? "";
  const b = days[days.length - 1] ?? a;
  const y = Number(a.slice(0, 4));
  const m = Number(a.slice(5, 7));
  if (days.length === 1) return { title: `${y} 年 ${m} 月 ${Number(a.slice(8))} 日`, sub: `周${WEEKDAY_SHORT[weekday(a)]}` };
  const end = b.slice(5, 7) === a.slice(5, 7) ? `${Number(b.slice(8))} 日` : `${Number(b.slice(5, 7))} 月 ${Number(b.slice(8))} 日`;
  return { title: `${y} 年 ${m} 月 ${Number(a.slice(8))} 日 – ${end}`, sub: `第 ${isoWeek(a)} 周` };
}

/** See the module comment. */
export function CalendarWeek(props: CalendarWeekProps) {
  const { events: input, date, onNavigate, label, weekStart = 1, workCalendar, mode, onModeChange, onDateChange, onOpen, onClearDate, eventMenu, legend, toolbarExtra, hourHeight = 52, step = 30, startHour = 8, onCreate, agendaBelow = 560 } = props;
  const count = props.days ?? (mode === "day" ? 1 : 7);
  const defaults = useAdminDefaults();
  const tz = props.timeZone ?? defaults.timeZone;
  const [clock, setClock] = useState(() => props.now ?? Date.now());
  useEffect(() => {
    if (props.now !== undefined) return setClock(props.now);
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [props.now]);
  const today = props.today ?? todayKey(clock, tz);
  const events = useMemo(() => deadlineEvents(input, today, tz), [input, today, tz]);
  const days = useMemo(() => weekDays(date, weekStart, count), [date, weekStart, count]);
  const [pending, setPending] = useState<Record<string, { start: string; end: string | null }>>({});
  useEffect(() => setPending({}), [events]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const resolved = useMemo(() => events.map((e) => resolveEvent(pending[e.id] ? { ...e, ...pending[e.id] } : e, tz)).filter((e): e is ResolvedEvent => e !== null), [events, pending, tz]);
  const layout = useMemo(() => layoutTimeGrid(resolved, days), [resolved, days]);
  const scroll = useRef<HTMLDivElement>(null);
  const cols = useRef(new Map<DayKey, HTMLDivElement>());
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;
  const suppress = useRef(false);
  const card = useEventCard();
  const [live, announce] = useAnnouncer();
  // Phones get no week / day view (review 08): measured on the container, so it works in any pane.
  const probe = useRef<HTMLSpanElement>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const box = probe.current?.parentElement;
    if (!box) return;
    const measure = () => setNarrow(box.getBoundingClientRect().width < agendaBelow);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [agendaBelow]);
  useEffect(() => {
    if (narrow && mode && mode !== "month") onModeChange?.("month");
  }, [narrow, mode, onModeChange]);
  const [allDayOpen, setAllDayOpen] = useState(false);
  const editable = (id: string) => Boolean(onDateChange) && byId.get(id)?.editable !== false;
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = startHour * hourHeight;
  }, [startHour, hourHeight, days[0], narrow]);

  const commit = (id: string, next: { start: string; end: string | null }, text: string) => {
    if (!onDateChange) return;
    setPending((p) => ({ ...p, [id]: next }));
    announce(text);
    Promise.resolve(onDateChange(id, next.start, next.end)).catch((error: unknown) => {
      setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)));
      announce(`没改成：${error instanceof Error ? error.message : "请重试"}`);
    });
  };
  const commitTimed = (id: string, day: DayKey, startMin: number, endMin: number) =>
    commit(id, timedRange(day, startMin, endMin, tz), `「${byId.get(id)?.title ?? ""}」改到 ${dayLabelOf(day)} ${clockText(startMin)}–${clockText(endMin)}`);
  const moveAllDay = (e: ResolvedEvent, delta: number) => {
    if (!delta) return;
    const start = addDays(e.startDay, delta);
    const end = addDays(e.endDay, delta);
    if (e.allDay) commit(e.id, { start, end: end === start ? null : end }, `「${byId.get(e.id)?.title ?? ""}」改到 ${dayLabelOf(start)}`);
    else commit(e.id, { start: new Date(zonedInstant(start, e.startMin ?? 0, tz)).toISOString(), end: new Date(zonedInstant(end, e.endMin ?? 0, tz)).toISOString() }, `改到 ${dayLabelOf(start)}`);
  };
  const dayAtX = (x: number): DayKey | null => {
    for (const day of days) {
      const r = cols.current.get(day)?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right) return day;
    }
    return null;
  };
  const minutesAtY = (day: DayKey, y: number) => {
    const r = cols.current.get(day)?.getBoundingClientRect();
    return r ? minutesAt(y - r.top, hourHeight, 0, step) : 0;
  };
  const endDrag = (started: boolean) => {
    if (!started) return;
    suppress.current = true;
    setTimeout(() => (suppress.current = false), 0);
  };

  const onBlockDown = (down: ReactPointerEvent<HTMLElement>, p: TimedPlacement, kind: "move" | "resize") => {
    if (!editable(p.id)) return;
    down.stopPropagation();
    trackPointer(down, {
      onStart: () => card.close(),
      onMove: (e, _dx, dy) => {
        const delta = (dy / hourHeight) * 60;
        const next = kind === "move" ? moveTimed(p.startMin, p.realEndMin, delta, step) : resizeTimed(p.startMin, p.realEndMin, delta, step);
        setPreview({ id: p.id, day: kind === "move" ? (dayAtX(e.clientX) ?? p.day) : p.day, ...next, kind });
      },
      onEnd: ({ cancelled, started }) => {
        const pv = previewRef.current;
        setPreview(null);
        endDrag(started);
        if (cancelled || !started || !pv) return;
        if (pv.day !== p.day || pv.startMin !== p.startMin || pv.endMin !== p.realEndMin) commitTimed(p.id, pv.day, pv.startMin, pv.endMin);
      },
    });
  };
  const onColumnDown = (down: ReactPointerEvent<HTMLDivElement>, day: DayKey) => {
    if (!onCreate || down.target !== down.currentTarget || down.detail > 1) return;
    const a = minutesAtY(day, down.clientY);
    trackPointer(down, {
      onMove: (e) => setPreview({ id: null, day, ...createRange(a, minutesAtY(day, e.clientY), step), kind: "create" }),
      onEnd: ({ cancelled, started }) => {
        const pv = previewRef.current;
        setPreview(null);
        endDrag(started);
        if (cancelled || !started || !pv) return;
        const range = timedRange(day, pv.startMin, pv.endMin, tz);
        onCreate(range.start, range.end);
      },
    });
  };
  // Keyboard create: the focused day column (one tab stop, ← / → between days), Enter = a new event at
  // the first full step visible at the top of the grid.
  const [colCursor, setColCursor] = useState<DayKey | null>(null);
  const focusDay = days.includes(colCursor ?? "") ? colCursor : days.includes(today) ? today : (days[0] ?? null);
  const onColumnKey = (event: KeyboardEvent<HTMLDivElement>, day: DayKey) => {
    if (event.target !== event.currentTarget || event.altKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const next = days[days.indexOf(day) + (event.key === "ArrowLeft" ? -1 : 1)];
      if (!next) return;
      event.preventDefault();
      setColCursor(next);
      cols.current.get(next)?.focus();
      return;
    }
    if (event.key !== "Enter" || !onCreate) return;
    event.preventDefault();
    const top = Math.ceil(((scroll.current?.scrollTop ?? startHour * hourHeight) / hourHeight) * (60 / step)) * step;
    const range = createRange(Math.min(1440 - step, top), Math.min(1440 - step, top), step);
    const iso = timedRange(day, range.startMin, range.endMin, tz);
    announce(`在 ${dayLabelOf(day)} ${clockText(range.startMin)} 新建`);
    onCreate(iso.start, iso.end);
  };
  const onBarDown = (down: ReactPointerEvent<HTMLElement>, seg: MonthSegment) => {
    if (!editable(seg.id)) return;
    const from = dayAtX(down.clientX);
    trackPointer(down, {
      onStart: () => card.close(),
      onMove: (e) => {
        const to = dayAtX(e.clientX);
        if (from && to) setPreview({ id: seg.id, day: to, startMin: 0, endMin: 0, kind: "day" });
      },
      onEnd: ({ cancelled, started }) => {
        const pv = previewRef.current;
        setPreview(null);
        endDrag(started);
        if (!cancelled && started && pv && from) moveAllDay(seg.event, diffDays(from, pv.day));
      },
    });
  };
  const keyMove = (p: TimedPlacement, key: string, shift: boolean) => {
    if (key === "ArrowLeft" || key === "ArrowRight") return commitTimed(p.id, addDays(p.day, key === "ArrowLeft" ? -1 : 1), p.startMin, p.realEndMin);
    const delta = key === "ArrowUp" ? -step : step;
    const next = shift ? resizeTimed(p.startMin, p.realEndMin, delta, step) : moveTimed(p.startMin, p.realEndMin, delta, step);
    if (next.startMin !== p.startMin || next.endMin !== p.realEndMin) commitTimed(p.id, p.day, next.startMin, next.endMin);
  };

  const menuFor = (id: string, p: TimedPlacement | null, bar?: ResolvedEvent) => {
    const ev = byId.get(id);
    if (!ev) return [];
    const moves = !editable(id)
      ? []
      : p
        ? [
            { key: "earlier", label: `提前 ${step} 分钟`, icon: <ArrowUp size={15} />, shortcut: "Alt+↑", onSelect: () => keyMove(p, "ArrowUp", false) },
            { key: "later", label: `推后 ${step} 分钟`, icon: <ArrowDown size={15} />, shortcut: "Alt+↓", onSelect: () => keyMove(p, "ArrowDown", false) },
          ]
        : bar
          ? [
              { key: "prev", label: "提前一天", icon: <ArrowLeft size={15} />, shortcut: "Alt+←", onSelect: () => moveAllDay(bar, -1) },
              { key: "next", label: "推后一天", icon: <ArrowRight size={15} />, shortcut: "Alt+→", onSelect: () => moveAllDay(bar, 1) },
            ]
          : [];
    return eventMenuSections({ onOpen: onOpen ? () => onOpen(id) : undefined, onClearDate: onClearDate ? () => onClearDate(id) : undefined, moves, extra: eventMenu?.(ev) });
  };
  const nowParts = zonedParts(clock, tz);
  const nowShown = days.includes(nowParts.day);
  const opened = card.card ? byId.get(card.card.id) : undefined;
  const openedResolved = card.card ? resolved.find((e) => e.id === card.card?.id) : undefined;
  const t = rangeTitle(days);
  // The all-day row: 2 lines + 「+N 更多」 until expanded.
  const allDayRow = layoutMonth(resolved.filter(isBarEvent), [days], allDayOpen ? Number.MAX_SAFE_INTEGER : ALLDAY_LINES, { reserveMore: true })[0];
  const allDaySegs = allDayRow?.segments ?? [];
  const allDayHidden = allDayRow?.hidden ?? [];
  const allDayMore = allDayHidden.some((n) => n > 0);
  const canFold = layout.allDayLanes > ALLDAY_LINES;
  const allDayLines = Math.max(1, allDaySegs.reduce((n, seg) => Math.max(n, seg.lane + 1), 0) + (allDayMore ? 1 : 0));
  const openCard = (id: string, target: HTMLElement, keyboard: boolean) => {
    if (!suppress.current) card.open(id, target, keyboard);
  };
  const openRecord = (id: string) => {
    card.close();
    onOpen?.(id);
  };
  if (narrow) {
    return (
      <>
        <span ref={probe} hidden />
        <CalendarMonth
          {...props}
          mode={mode && "month"}
          onCreate={onCreate ? (day) => {
            const range = timedRange(day, startHour * 60, startHour * 60 + 60, tz);
            onCreate(range.start, range.end);
          } : undefined}
        />
      </>
    );
  }
  const grid = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };
  const shift = count === 1 ? 1 : 7;
  return (
    <>
    <span ref={probe} hidden />
    <div className="aui-cal" data-mode={count === 1 ? "day" : "week"} role="region" aria-label={label} data-dragging={preview ? "" : undefined}>
      <CalendarToolbar title={t.title} sub={t.sub} onToday={() => onNavigate(today)} onPrev={() => onNavigate(addDays(date, -shift))} onNext={() => onNavigate(addDays(date, shift))} mode={mode} onModeChange={onModeChange} legend={legend} extra={toolbarExtra} />
      <div className="aui-calw" style={{ "--aui-calw-hour": `${hourHeight}px` } as CSSProperties}>
        <div className="aui-calw-head" style={grid}>
          <span />
          {days.map((day) => (
            <div key={day} className="aui-calw-dayhead" data-today={day === today || undefined} data-off={!isWorkday(day, workCalendar) || undefined} aria-label={`${dayLabelOf(day)}${day === today ? "，今天" : ""}`}>
              <span>周{WEEKDAY_SHORT[weekday(day)]}</span>
              <b className="aui-calw-num" data-today={day === today || undefined}>{Number(day.slice(8))}</b>
              <DayBadge day={day} calendar={workCalendar} label />
            </div>
          ))}
        </div>
        <div className="aui-calw-allday" style={grid}>
          <span className="aui-calw-gutter-label">
            全天
            {canFold && (
              <button type="button" className="aui-calw-allday-toggle" aria-expanded={allDayOpen} aria-label={allDayOpen ? "收起全天事件" : "展开全天事件"} onClick={() => setAllDayOpen((o) => !o)}>
                {allDayOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>
            )}
          </span>
          <div className="aui-calw-allday-area" style={{ gridColumn: `2 / span ${days.length}`, height: allDayLines * ALLDAY_LANE + 8 }}>
            {allDayHidden.map((n, col) =>
              n > 0 ? (
                <button key={`more-${col}`} type="button" className="aui-cal-more" style={{ left: `calc(${col} * 100% / ${days.length} + 3px)`, width: `calc(100% / ${days.length} - 6px)`, top: 4 + ALLDAY_LINES * ALLDAY_LANE }} onClick={() => setAllDayOpen(true)}>
                  +{n} 更多
                </button>
              ) : null,
            )}
            {allDaySegs.map((seg) => {
              const ev = byId.get(seg.id);
              if (!ev) return null;
              return (
                <ContextMenu key={seg.id} label={`「${ev.title}」的操作`} sections={() => menuFor(seg.id, null, seg.event)}>
                  <button
                    type="button"
                    className="aui-cal-ev"
                    data-bar=""
                    data-vtone={softTone(ev.tone ?? "green")}
                    data-cont-before={seg.continuesBefore || undefined}
                    data-cont-after={seg.continuesAfter || undefined}
                    data-editable={editable(seg.id) || undefined}
                    style={{ left: `calc(${seg.startCol} * 100% / ${days.length} + 3px)`, width: `calc(${seg.endCol - seg.startCol + 1} * 100% / ${days.length} - 6px)`, top: 4 + seg.lane * ALLDAY_LANE }}
                    aria-label={`${ev.title}，${whenText(seg.event)}`}
                    aria-haspopup="dialog"
                    data-open={card.card?.id === seg.id || undefined}
                    onClick={(e) => openCard(seg.id, e.currentTarget, e.detail === 0)}
                    onDoubleClick={() => openRecord(seg.id)}
                    onPointerDown={(e) => onBarDown(e, seg)}
                    onKeyDown={(e) => {
                      if (!e.altKey || !editable(seg.id) || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                      e.preventDefault();
                      moveAllDay(seg.event, e.key === "ArrowLeft" ? -1 : 1);
                    }}
                  >
                    {seg.continuesBefore && <span className="aui-cal-ev-cont" aria-hidden="true">‹</span>}
                    <span className="aui-cal-ev-title">{ev.title}</span>
                  </button>
                </ContextMenu>
              );
            })}
            {preview?.kind === "day" && (
              <span className="aui-calw-allday-drop" style={{ left: `calc(${days.indexOf(preview.day)} * 100% / ${days.length})`, width: `calc(100% / ${days.length})` }} aria-hidden="true" />
            )}
          </div>
        </div>
        <div ref={scroll} className="aui-calw-scroll">
          <div className="aui-calw-grid" style={{ ...grid, height: 24 * hourHeight }}>
            <div className="aui-calw-gutter" aria-hidden="true">
              {Array.from({ length: 24 }, (_, h) => (
                // The current-time label wins: an hour label it would cover (within ~18px) is left out.
                <span key={h} style={{ top: h * hourHeight }}>{h && !(nowShown && Math.abs(nowParts.minutes - h * 60) < (18 / hourHeight) * 60) ? clockText(h * 60) : ""}</span>
              ))}
              {nowShown && <span className="aui-calw-nowlabel" style={{ top: (nowParts.minutes / 60) * hourHeight }}>{clockText(nowParts.minutes)}</span>}
            </div>
            {days.map((day) => (
              <div
                key={day}
                ref={(el) => {
                  if (el) cols.current.set(day, el);
                  else cols.current.delete(day);
                }}
                className="aui-calw-col"
                data-day={day}
                data-off={!isWorkday(day, workCalendar) || undefined}
                data-creatable={onCreate ? "" : undefined}
                data-today={day === today || undefined}
                aria-label={onCreate ? `${dayLabelOf(day)}，按 Enter 新建` : dayLabelOf(day)}
                role="group"
                tabIndex={onCreate ? (day === focusDay ? 0 : -1) : undefined}
                onFocus={(e) => e.target === e.currentTarget && setColCursor(day)}
                onKeyDown={(e) => onColumnKey(e, day)}
                onPointerDown={(e) => onColumnDown(e, day)}
                onDoubleClick={(e) => {
                  if (!onCreate || e.target !== e.currentTarget) return;
                  const at = minutesAtY(day, e.clientY);
                  const range = createRange(Math.min(1440 - step, at), Math.min(1440 - step, at), step);
                  const iso = timedRange(day, range.startMin, range.endMin, tz);
                  onCreate(iso.start, iso.end);
                }}
              >
                {(layout.timed[day] ?? []).map((p) => {
                  const ev = byId.get(p.id);
                  if (!ev) return null;
                  const moving = preview?.id === p.id;
                  return (
                    <ContextMenu key={p.id} label={`「${ev.title}」的操作`} sections={() => menuFor(p.id, p)}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="aui-calw-ev"
                        data-vtone={softTone(ev.tone ?? "green")}
                        data-moving={moving || undefined}
                        data-editable={editable(p.id) || undefined}
                        style={{ top: (p.startMin / 60) * hourHeight + 1, height: Math.max(20, ((p.endMin - p.startMin) / 60) * hourHeight - 2), left: `calc(${p.col} * 100% / ${p.cols} + 2px)`, width: `calc(100% / ${p.cols} - 4px)` }}
                        aria-label={`${ev.title}，${whenText(p.event)}`}
                        aria-haspopup="dialog"
                        data-open={card.card?.id === p.id || undefined}
                        data-short={((p.endMin - p.startMin) / 60) * hourHeight < 38 || undefined}
                        onClick={(e) => openCard(p.id, e.currentTarget, false)}
                        onDoubleClick={() => openRecord(p.id)}
                        onPointerDown={(e) => onBlockDown(e, p, "move")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            card.open(p.id, e.currentTarget, true);
                            return;
                          }
                          if (!e.altKey || !editable(p.id) || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
                          e.preventDefault();
                          keyMove(p, e.key, e.shiftKey);
                        }}
                      >
                        <strong>{ev.title}</strong>
                        <span>{clockText(p.startMin)}–{clockText(p.realEndMin)}</span>
                        {editable(p.id) && <span className="aui-calw-resize" aria-hidden="true" onPointerDown={(e) => onBlockDown(e, p, "resize")} />}
                      </div>
                    </ContextMenu>
                  );
                })}
                {preview && preview.day === day && preview.kind !== "day" && (
                  <div className="aui-calw-preview" data-kind={preview.kind} style={{ top: (preview.startMin / 60) * hourHeight + 1, height: Math.max(20, ((preview.endMin - preview.startMin) / 60) * hourHeight - 2) }} aria-hidden="true">
                    <b>{clockText(preview.startMin)}–{clockText(preview.endMin)}</b>
                  </div>
                )}
                {day === nowParts.day && <span className="aui-calw-now" style={{ top: (nowParts.minutes / 60) * hourHeight }} aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <EventCard
        card={preview ? null : card.card}
        event={opened}
        when={openedResolved ? whenText(openedResolved) : ""}
        placement={{ side: "right", align: "start", gap: 6 }}
        onClose={card.close}
        onOpen={onOpen && opened ? () => openRecord(opened.id) : undefined}
        onClearDate={onClearDate && opened ? () => { card.close(); onClearDate(opened.id); } : undefined}
      />
      {live}
    </div>
    </>
  );
}
