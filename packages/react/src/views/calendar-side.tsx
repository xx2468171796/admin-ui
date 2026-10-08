"use client";
/**
 * Side pieces of CalendarMonth (bt/views V5, demo D09, review 08): the 「无日期」 drawer (300 wide: search
 * + 40px rows grip · name · option chip, dragged onto a day) and the phone month (small cells with
 * coloured dots + the selected day's agenda, 44px rows).
 */
import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { CalendarPlus, GripVertical, Info, X } from "lucide-react";
import { Input } from "../primitives.tsx";
import { ContextMenu } from "../menu.tsx";
import type { OptionTone } from "../option-tone.ts";
import { softTone } from "./view-color-core.ts";
import { clockText, dayLabelOf, shortDay, WEEKDAY_SHORT, weekday, type DayKey, type WorkCalendar } from "./date-core.ts";
import { eventsOnDay, isBarEvent, type ResolvedEvent } from "./calendar-core.ts";
import { DayBadge, type CalendarEvent } from "./calendar-parts.tsx";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

/** A record without a date (the drawer); drag it onto a day to give it one. */
export type CalendarUndatedItem = { id: string; title: string; badge?: string; tone?: OptionTone; /** Owner name (row tooltip). */ person?: string };

export function UndatedDrawer({ items, onClose, onPick, onPointerDown, cursorDay, today, draggingId, hint }: {
  items: readonly CalendarUndatedItem[];
  onClose: () => void;
  /** Keyboard / menu: put the item on a day. */
  onPick?: (id: string, day: DayKey) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>, item: CalendarUndatedItem) => void;
  cursorDay: DayKey;
  today: DayKey;
  draggingId: string | null;
  /** Footer note (default 「拖到日历上某一天 = 设日期」). */
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const shown = items.filter((i) => !query.trim() || i.title.includes(query.trim()));
  return (
    <aside className="aui-cal-drawer" aria-label="没有日期的记录">
      <header className="aui-cal-drawer-head">
        <strong>无日期</strong>
        <span className="aui-cal-count">{items.length}</span>
        <IconButton label="关闭无日期列表" className="aui-cal-drawer-close" onClick={onClose} icon={<X size={15} aria-hidden="true" />} />
      </header>
      <div className="aui-cal-drawer-search">
        <Input type="search" clearable aria-label="搜索没有日期的记录" placeholder="搜索名称" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="aui-cal-drawer-list">
        {shown.map((item) => (
          <li key={item.id}>
            <ContextMenu
              label={`「${item.title}」放到哪天`}
              disabled={!onPick}
              sections={[
                {
                  items: [
                    { key: "today", label: `放到今天（${shortDay(today)}）`, icon: <CalendarPlus size={15} />, onSelect: () => onPick?.(item.id, today) },
                    ...(cursorDay !== today ? [{ key: "cursor", label: `放到选中的那天（${shortDay(cursorDay)}）`, icon: <CalendarPlus size={15} />, onSelect: () => onPick?.(item.id, cursorDay) }] : []),
                  ],
                },
              ]}
            >
              <div className="aui-cal-undated" tabIndex={0} data-dragging={draggingId === item.id || undefined} data-tip={item.person} aria-label={`${item.title}${item.badge ? `，${item.badge}` : ""}，没有日期`} onPointerDown={(e) => onPointerDown?.(e, item)}>
                <GripVertical size={14} className="aui-cal-grip" aria-hidden="true" />
                <span className="aui-cal-undated-title">{item.title}</span>
                {item.badge && (
                  <span className="aui-chip" data-tone={item.tone ?? "neutral"}>
                    <span className="aui-chip-label">{item.badge}</span>
                  </span>
                )}
              </div>
            </ContextMenu>
          </li>
        ))}
        {shown.length === 0 && <li className="aui-cal-drawer-empty">{items.length ? "没有匹配的记录" : "所有记录都有日期"}</li>}
      </ul>
      <p className="aui-cal-drawer-foot">
        <Info size={13} aria-hidden="true" />
        {hint ?? "拖到日历上某一天 = 设日期"}
      </p>
    </aside>
  );
}

/** One agenda row: all-day / multi-day = soft option tone; timed = dot + time + title. */
export function AgendaRow({ event, resolved, onOpen }: { event: CalendarEvent | undefined; resolved: ResolvedEvent; onOpen?: (id: string) => void }) {
  const bar = isBarEvent(resolved);
  return (
    <button type="button" className="aui-cal-agenda-item" data-vtone={softTone(event?.tone ?? "green")} data-timed={bar ? undefined : ""} onClick={() => onOpen?.(resolved.id)}>
      {!bar && <i className="aui-cal-dot" aria-hidden="true" />}
      {!bar && <span className="aui-cal-agenda-time">{clockText(resolved.startMin ?? 0)}</span>}
      <span className="aui-cal-agenda-title">{event?.title}</span>
      {event?.badge && <span className="aui-cal-agenda-badge">{event.badge}</span>}
    </button>
  );
}

/**
 * Phones / narrow containers (review 08: 「手机日历只给月 + 当天日程」): the month as small cells with a
 * dot per event (option tone, ≤ 3), and the selected day's events below as 44px rows.
 */
export function CalendarPhoneMonth({ weeks, month, events, byId, today, selected, onSelect, calendar, onOpen }: {
  weeks: readonly (readonly DayKey[])[];
  month: string;
  events: readonly ResolvedEvent[];
  byId: ReadonlyMap<string, CalendarEvent>;
  today: DayKey;
  selected: DayKey;
  onSelect: (day: DayKey) => void;
  calendar?: WorkCalendar;
  onOpen?: (id: string) => void;
}) {
  const list = eventsOnDay(events, selected);
  return (
    <div className="aui-cal-phone">
      <div className="aui-cal-mini" role="grid" aria-label="月历">
        <div role="row" className="aui-cal-mini-row">
          {(weeks[0] ?? []).map((d) => <span key={d} role="columnheader" className="aui-cal-mini-wd">{WEEKDAY_SHORT[weekday(d)]}</span>)}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="aui-cal-mini-row">
            {week.map((day) => {
              const on = eventsOnDay(events, day);
              return (
                <span key={day} role="gridcell" aria-selected={day === selected}>
                  <button
                    type="button"
                    className="aui-cal-mini-day"
                    data-day={day}
                    data-out={day.slice(0, 7) !== month || undefined}
                    data-today={day === today || undefined}
                    data-selected={day === selected || undefined}
                    aria-label={`${dayLabelOf(day)}${day === today ? "，今天" : ""}，${on.length ? `${on.length} 条` : "没有记录"}`}
                    onClick={() => onSelect(day)}
                  >
                    <b>{Number(day.slice(8))}</b>
                    <span className="aui-cal-mini-dots" aria-hidden="true">
                      {on.slice(0, 3).map((e) => <i key={e.id} data-vtone={softTone(byId.get(e.id)?.tone ?? "green")} />)}
                    </span>
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <section className="aui-cal-dayagenda" aria-label={`${dayLabelOf(selected)}的日程`}>
        <h4>
          {dayLabelOf(selected)} · {list.length} 项
          <DayBadge day={selected} calendar={calendar} label />
        </h4>
        {list.length === 0 ? (
          <p className="aui-cal-agenda-none">没有安排</p>
        ) : (
          <ul>
            {list.map((e) => (
              <li key={e.id}>
                <AgendaRow event={byId.get(e.id)} resolved={e} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
