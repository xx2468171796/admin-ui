"use client";
/**
 * CalendarMonth (bt/views V5, demo D09, review 08): a month grid with a configurable
 * first weekday. All-day / multi-day events are soft option-tone bars that continue across weeks (the
 * continuation starts with 「‹」); timed events are a coloured dot + time + title without a fill. At most
 * 3 lines per day plus 「+N 更多」 (popover with the whole day). Weekends and host holidays are tinted,
 * a holiday reads 「休 国庆日」 (label from `workCalendar.holidays`), a make-up day 「班」, today is a
 * primary round number. A click on an event opens the event card (打开详情 · 清除日期), a double-click
 * opens the record. Events drag to another day (keeping their length and time of day); the 「无日期」
 * drawer's rows drag onto a day. ＋ at a day's top right or a double-click on its blank area creates a
 * record on that day (`onCreate`). Keyboard: Alt+← / → one day, Alt+↑ / ↓ one week, Shift+F10 for the
 * menu; days are a roving grid (arrows, Enter creates). Narrower than `agendaBelow` px (phones) it is a
 * small month with coloured dots plus the selected day's agenda, and the toolbar has no 日 / 周.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useAdminDefaults } from "../admin-defaults-context.tsx";
import { useAdminTheme } from "../theme.tsx";
import type { OptionTone } from "../option-tone.ts";
import { softTone } from "./view-color-core.ts";
import { ContextMenu } from "../menu.tsx";
import { PopoverPanel } from "../popover-panel.tsx";
import { addDays, addMonths, clockText, dayLabelOf, diffDays, isWorkday, monthTitle, todayKey, zonedInstant, type DayKey } from "./date-core.ts";
import { eventsOnDay, isBarEvent, layoutMonth, monthMatrix, resolveEvent, type MonthSegment, type ResolvedEvent } from "./calendar-core.ts";
import { CalendarToolbar, DayBadge, eventMenuSections, whenText, type CalendarBaseProps } from "./calendar-parts.tsx";
import { AgendaRow, CalendarPhoneMonth, UndatedDrawer, type CalendarUndatedItem } from "./calendar-side.tsx";
import { EventCard, useEventCard } from "./calendar-card.tsx";
import { trackPointer, useAnnouncer } from "./view-parts.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type { CalendarUndatedItem } from "./calendar-side.tsx";
export type CalendarMonthProps = CalendarBaseProps & {
  /** Records without a date (the 「无日期 N」 toggle and drawer). */
  undated?: readonly CalendarUndatedItem[];
  undatedOpen?: boolean;
  onUndatedOpenChange?: (open: boolean) => void;
  /** Footer note of the 无日期 drawer (「拖到日历上某一天 = 设「下次跟进」」). */
  undatedHint?: string;
  /** Always 6 weeks (stable height). Default false (5 or 6). */
  fixedWeeks?: boolean;
  /** Container width under which the phone layout shows: small month + the selected day's agenda (default 560). */
  agendaBelow?: number;
  /** ＋ on a day, double-click on its blank area, Enter on a focused day. */
  onCreate?: (day: DayKey) => void;
};

const HEAD = 30;
const LANE = 22;
/** Event lines per day before 「+N 更多」 (review 08). */
const MAX_LINES = 3;
type Drag = { id: string; source: "event" | "undated"; title: string; tone: OptionTone; grab: DayKey | null; over: DayKey | null; x: number; y: number };

/** See the module comment. */
export function CalendarMonth(props: CalendarMonthProps) {
  const { events, date, onNavigate, label, weekStart = 1, workCalendar, mode, onModeChange, onDateChange, onOpen, onClearDate, eventMenu, legend, toolbarExtra, undated, fixedWeeks, agendaBelow = 560, onCreate } = props;
  const defaults = useAdminDefaults();
  const tz = props.timeZone ?? defaults.timeZone;
  const today = props.today ?? todayKey(Date.now(), tz);
  const { portal } = useAdminTheme();
  const [pending, setPending] = useState<Record<string, { start: string; end: string | null }>>({});
  useEffect(() => setPending({}), [events]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const resolved = useMemo(
    () => events.map((e) => resolveEvent(pending[e.id] ? { ...e, ...pending[e.id] } : e, tz)).filter((e): e is ResolvedEvent => e !== null),
    [events, pending, tz],
  );
  const weeks = useMemo(() => monthMatrix(date, weekStart, fixedWeeks), [date, weekStart, fixedWeeks]);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const cells = useRef(new Map<DayKey, HTMLDivElement>());
  const [maxLanes, setMaxLanes] = useState(MAX_LINES);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const width = root.current?.getBoundingClientRect().width ?? 1000;
      setNarrow(width < agendaBelow);
      // A week row is at least 124px (the grid scrolls when the panel is shorter), so measure the row itself.
      const h = rows.current[0]?.offsetHeight ?? (body.current ? body.current.clientHeight / weeks.length : 0);
      // Room for the event lines and one 「+N 更多」 line under them.
      if (h) setMaxLanes(Math.max(1, Math.min(MAX_LINES, Math.floor((h - HEAD - 4) / LANE) - 1)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (root.current) ro.observe(root.current);
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, [weeks.length, agendaBelow, narrow]);
  const layout = useMemo(() => layoutMonth(resolved, weeks, maxLanes, { reserveMore: true }), [resolved, weeks, maxLanes]);
  const month = date.slice(0, 7);
  const [cursor, setCursor] = useState<DayKey>(today.slice(0, 7) === month ? today : `${month}-01`);
  useEffect(() => {
    if (cursor.slice(0, 7) !== month) setCursor(today.slice(0, 7) === month ? today : `${month}-01`);
  }, [month, cursor, today]);
  const [ownUndated, setOwnUndated] = useState(false);
  const undatedOpen = props.undatedOpen ?? ownUndated;
  const setUndatedOpen = (open: boolean) => (props.onUndatedOpenChange ? props.onUndatedOpenChange(open) : setOwnUndated(open));
  const [placed, setPlaced] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setPlaced(new Set()), [undated]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const suppress = useRef(false);
  const card = useEventCard();
  const [more, setMore] = useState<{ day: DayKey; anchor: HTMLElement } | null>(null);
  const [live, announce] = useAnnouncer();
  const resolvedById = useMemo(() => new Map(resolved.map((e) => [e.id, e])), [resolved]);
  const editable = (id: string) => Boolean(onDateChange) && byId.get(id)?.editable !== false;

  const dayAt = (x: number, y: number): DayKey | null => {
    for (let w = 0; w < weeks.length; w++) {
      const r = rows.current[w]?.getBoundingClientRect();
      if (!r || y < r.top || y > r.bottom || x < r.left || x > r.right) continue;
      return weeks[w]?.[Math.min(6, Math.max(0, Math.floor(((x - r.left) / r.width) * 7)))] ?? null;
    }
    return null;
  };
  const moveEvent = (id: string, delta: number) => {
    const e = resolvedById.get(id);
    if (!e || !delta || !onDateChange) return;
    const startDay = addDays(e.startDay, delta);
    const endDay = addDays(e.endDay, delta);
    const next = e.allDay
      ? { start: startDay, end: endDay === startDay ? null : endDay }
      : { start: new Date(zonedInstant(startDay, e.startMin ?? 0, tz)).toISOString(), end: new Date(zonedInstant(endDay, e.endMin ?? 60, tz)).toISOString() };
    setPending((p) => ({ ...p, [id]: next }));
    announce(`「${byId.get(id)?.title ?? ""}」改到 ${dayLabelOf(startDay)}`);
    Promise.resolve(onDateChange(id, next.start, next.end)).catch((error: unknown) => {
      setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)));
      announce(`没改成：${error instanceof Error ? error.message : "请重试"}`);
    });
  };
  const placeUndated = (id: string, day: DayKey) => {
    if (!onDateChange) return;
    setPlaced((s) => new Set([...s, id]));
    announce(`已放到 ${dayLabelOf(day)}`);
    Promise.resolve(onDateChange(id, day, null)).catch((error: unknown) => {
      setPlaced((s) => new Set([...s].filter((x) => x !== id)));
      announce(`没放成：${error instanceof Error ? error.message : "请重试"}`);
    });
  };
  const startDrag = (down: ReactPointerEvent<HTMLElement>, id: string, source: Drag["source"], title: string, tone: OptionTone) => {
    if (source === "event" && !editable(id)) return;
    if (source === "undated" && !onDateChange) return;
    const grab = source === "event" ? dayAt(down.clientX, down.clientY) : null;
    trackPointer(down, {
      onStart: (e) => {
        card.close();
        setDrag({ id, source, title, tone, grab, over: dayAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
      },
      onMove: (e) => setDrag((d) => (d ? { ...d, over: dayAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY } : d)),
      onEnd: ({ cancelled, started }) => {
        const d = dragRef.current;
        setDrag(null);
        if (!started) return;
        suppress.current = true;
        setTimeout(() => (suppress.current = false), 0);
        if (cancelled || !d?.over) return;
        if (d.source === "undated") placeUndated(id, d.over);
        else if (d.grab) moveEvent(id, diffDays(d.grab, d.over));
      },
    });
  };

  const onDayKey = (event: KeyboardEvent<HTMLDivElement>, day: DayKey) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (event.target !== event.currentTarget) return;
    if (step) {
      event.preventDefault();
      const next = addDays(day, step);
      setCursor(next);
      if (next.slice(0, 7) !== month) onNavigate(next);
      return;
    }
    if (event.key === "Enter" && onCreate) {
      event.preventDefault();
      onCreate(day);
    }
  };
  useLayoutEffect(() => {
    if (root.current?.contains(document.activeElement) && document.activeElement?.getAttribute("role") === "gridcell") cells.current.get(cursor)?.focus();
  }, [cursor]);

  // Chips and 「+N 更多」 sit in one layer over the week; aria-owns hands each to the gridcell of its first day.
  const ownBase = `aui-calm${useId().replace(/[^\w-]/g, "")}`;
  const chipId = (w: number, i: number) => `${ownBase}-w${w}-e${i}`;
  const moreId = (w: number, col: number) => `${ownBase}-w${w}-m${col}`;
  const ownedBy = (week: (typeof layout)[number], w: number, col: number) =>
    [...week.segments.flatMap((seg, i) => (seg.startCol === col ? [chipId(w, i)] : [])), ...((week.hidden[col] ?? 0) > 0 ? [moreId(w, col)] : [])].join(" ") || undefined;
  const chip = (seg: MonthSegment, w: number, id: string) => {
    const ev = byId.get(seg.id);
    if (!ev) return null;
    const bar = isBarEvent(seg.event);
    const span = seg.endCol - seg.startCol + 1;
    const moves = editable(seg.id)
      ? [
          { key: "prev", label: "提前一天", icon: <ArrowLeft size={15} />, shortcut: "Alt+←", onSelect: () => moveEvent(seg.id, -1) },
          { key: "next", label: "推后一天", icon: <ArrowRight size={15} />, shortcut: "Alt+→", onSelect: () => moveEvent(seg.id, 1) },
        ]
      : [];
    return (
      <ContextMenu
        key={`${seg.id}-${w}`}
        label={`「${ev.title}」的操作`}
        sections={() => eventMenuSections({ onOpen: onOpen ? () => onOpen(seg.id) : undefined, onClearDate: onClearDate ? () => onClearDate(seg.id) : undefined, moves, extra: eventMenu?.(ev) })}
      >
        <button
          id={id}
          type="button"
          className="aui-cal-ev"
          data-vtone={softTone(ev.tone ?? "green")}
          data-bar={bar || undefined}
          data-timed={bar ? undefined : ""}
          data-cont-before={seg.continuesBefore || undefined}
          data-cont-after={seg.continuesAfter || undefined}
          data-dragging={drag?.id === seg.id || undefined}
          data-editable={editable(seg.id) || undefined}
          data-open={card.card?.id === seg.id || undefined}
          style={{ left: `calc(${seg.startCol} * 100% / 7 + 3px)`, width: `calc(${span} * 100% / 7 - 6px)`, top: HEAD + seg.lane * LANE }}
          aria-label={`${ev.title}，${whenText(seg.event)}`}
          aria-haspopup="dialog"
          onClick={(e) => !suppress.current && card.open(seg.id, e.currentTarget, e.detail === 0)}
          onDoubleClick={() => {
            card.close();
            onOpen?.(seg.id);
          }}
          onPointerDown={(e) => startDrag(e, seg.id, "event", ev.title, ev.tone ?? "green")}
          onKeyDown={(e) => {
            if (!e.altKey || !editable(seg.id)) return;
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
            if (!delta) return;
            e.preventDefault();
            moveEvent(seg.id, delta);
          }}
        >
          {seg.continuesBefore && <span className="aui-cal-ev-cont" aria-hidden="true">‹</span>}
          {!bar && <i className="aui-cal-dot" aria-hidden="true" />}
          {!bar && <span className="aui-cal-ev-time">{clockText(seg.event.startMin ?? 0)}</span>}
          <span className="aui-cal-ev-title">{ev.title}</span>
        </button>
      </ContextMenu>
    );
  };

  const opened = card.card ? byId.get(card.card.id) : undefined;
  const openedResolved = card.card ? resolvedById.get(card.card.id) : undefined;
  const undatedItems = (undated ?? []).filter((i) => !placed.has(i.id));
  return (
    <div ref={root} className="aui-cal" data-mode="month" data-phone={narrow || undefined} role="region" aria-label={label} data-dragging={drag ? "" : undefined}>
      <CalendarToolbar
        title={monthTitle(date)}
        onToday={() => {
          onNavigate(today);
          setCursor(today);
        }}
        onPrev={() => onNavigate(addMonths(date, -1))}
        onNext={() => onNavigate(addMonths(date, 1))}
        mode={mode}
        onModeChange={onModeChange}
        legend={legend}
        extra={toolbarExtra}
        compact={narrow}
        undated={undated ? { count: undatedItems.length, open: undatedOpen, onToggle: () => setUndatedOpen(!undatedOpen) } : undefined}
      />
      <div className="aui-cal-main">
        {narrow ? (
          <CalendarPhoneMonth weeks={weeks} month={month} events={resolved} byId={byId} today={today} selected={cursor} onSelect={(d) => { setCursor(d); if (d.slice(0, 7) !== month) onNavigate(d); }} calendar={workCalendar} onOpen={onOpen} />
        ) : (
          <div className="aui-cal-month" role="grid" aria-label={`${monthTitle(date)}日历`}>
            <div className="aui-cal-weekdays" role="row">
              {(weeks[0] ?? []).map((d) => (
                <div key={d} role="columnheader" className="aui-cal-weekday">{dayLabelOf(d).split(" ")[1]}</div>
              ))}
            </div>
            <div ref={body} className="aui-cal-weeks" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(124px, 1fr))` }}>
              {layout.map((week, w) => (
                <div key={week.days[0]} ref={(el) => void (rows.current[w] = el)} className="aui-cal-week" role="row">
                  {week.days.map((day, col) => {
                    const inMonth = day.slice(0, 7) === month;
                    const isToday = day === today;
                    const count = eventsOnDay(resolved, day).length;
                    return (
                      <div
                        key={day}
                        ref={(el) => {
                          if (el) cells.current.set(day, el);
                          else cells.current.delete(day);
                        }}
                        role="gridcell"
                        aria-owns={ownedBy(week, w, col)}
                        className="aui-cal-day"
                        data-day={day}
                        data-out={!inMonth || undefined}
                        data-today={isToday || undefined}
                        data-off={!isWorkday(day, workCalendar) || undefined}
                        data-over={drag?.over === day || undefined}
                        tabIndex={day === cursor ? 0 : -1}
                        aria-selected={day === cursor}
                        aria-label={`${dayLabelOf(day)}${isToday ? "，今天" : ""}，${count ? `${count} 条` : "没有记录"}`}
                        onFocus={() => setCursor(day)}
                        onKeyDown={(e) => onDayKey(e, day)}
                        onDoubleClick={(e) => e.target === e.currentTarget && onCreate?.(day)}
                      >
                        <div className="aui-cal-day-head" onDoubleClick={() => onCreate?.(day)}>
                          <span className="aui-cal-date" data-today={isToday || undefined}>{!inMonth || day.endsWith("-01") ? `${Number(day.slice(5, 7))}月${Number(day.slice(8))}日` : Number(day.slice(8))}</span>
                          {isToday && <span className="aui-cal-todaytext">今天</span>}
                          <DayBadge day={day} calendar={workCalendar} label />
                          {drag?.over === day && <span className="aui-cal-drop">放到 {day.slice(5)}</span>}
                          {onCreate && !drag && (
                            <button type="button" className="aui-cal-add" tabIndex={-1} aria-label={`在 ${dayLabelOf(day)} 新建`} onClick={() => onCreate(day)} onDoubleClick={(e) => e.stopPropagation()}>
                              <Plus size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="aui-cal-segs" role="presentation">
                    {week.segments.map((seg, i) => chip(seg, w, chipId(w, i)))}
                    {week.hidden.map((n, col) =>
                      n > 0 ? (
                        <button
                          key={col}
                          id={moreId(w, col)}
                          type="button"
                          className="aui-cal-more"
                          style={{ left: `calc(${col} * 100% / 7 + 3px)`, width: `calc(100% / 7 - 6px)`, top: HEAD + maxLanes * LANE }}
                          onClick={(e) => setMore({ day: week.days[col] ?? today, anchor: e.currentTarget })}
                        >
                          +{n} 更多
                        </button>
                      ) : null,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {undated && undatedOpen && (
          <UndatedDrawer
            items={undatedItems}
            cursorDay={cursor}
            today={today}
            hint={props.undatedHint}
            draggingId={drag?.source === "undated" ? drag.id : null}
            onClose={() => setUndatedOpen(false)}
            onPick={onDateChange ? placeUndated : undefined}
            onPointerDown={(e, item) => startDrag(e, item.id, "undated", item.title, item.tone ?? "gray")}
          />
        )}
      </div>
      <PopoverPanel open={Boolean(more)} anchor={more?.anchor ?? null} onClose={() => setMore(null)} title={more ? dayLabelOf(more.day) : ""} width="sm" headerExtra={more ? `${eventsOnDay(resolved, more.day).length} 项` : undefined}>
        <ul className="aui-cal-morelist">
          {more &&
            eventsOnDay(resolved, more.day).map((e) => (
              <li key={e.id}>
                <AgendaRow event={byId.get(e.id)} resolved={e} onOpen={(id) => { setMore(null); onOpen?.(id); }} />
              </li>
            ))}
        </ul>
      </PopoverPanel>
      <EventCard
        card={drag ? null : card.card}
        event={opened}
        when={openedResolved ? whenText(openedResolved) : ""}
        onClose={card.close}
        onOpen={onOpen && opened ? () => { card.close(); onOpen(opened.id); } : undefined}
        onClearDate={onClearDate && opened ? () => { card.close(); onClearDate(opened.id); } : undefined}
      />
      {drag && portal &&
        createPortal(
          <div className="aui-cal-float" data-vtone={softTone(drag.tone)} style={{ left: drag.x + 8, top: drag.y + 8 }} aria-hidden="true">
            {drag.title}
          </div>,
          portal,
        )}
      {live}
    </div>
  );
}
