"use client";
/**
 * Pieces of the date / time popovers (review family 1): the quick row on top
 * (今天 / 明天 / 下周一 / 一周后 + 清空), the half-hour time column next to the calendar, the time list of
 * TimeInput, and the 「周四 · 明天」 note that follows a date in its box.
 */
import { useEffect, useId, useRef, useState } from "react";
import { quickDays, relativeDayText, dueState, dayPart, type DayKey } from "./date-picker-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";

/** 今天 / 明天 / 下周一 / 一周后 (+ 清空 on the right): one click picks the day. */
export function QuickDays({ today, value, accept, onPick, onClear }: { today: DayKey; value: string; accept: (day: DayKey) => boolean; onPick: (day: DayKey) => void; onClear?: () => void }) {
  return (
    <div className="aui-dquick" role="group" aria-label="快捷日期">
      {quickDays(today).map((q) => (
        <button key={q.key} type="button" className="aui-dquick-btn" aria-pressed={dayPart(value) === q.day} disabled={!accept(q.day)} data-tip={q.day} onClick={() => onPick(q.day)}>
          {q.label}
        </button>
      ))}
      {onClear && (
        <button type="button" className="aui-dquick-btn" data-ghost="" onClick={onClear}>
          清空
        </button>
      )}
    </div>
  );
}

/**
 * A listbox of times (TimeInput's popover, the column next to a DateTimePicker calendar): ↑ ↓ / Home /
 * End / PageUp / PageDown move, Enter / Space pick; the chosen time is filled with the primary colour.
 * Scrolls itself (never the page) so the current time sits in the middle.
 */
export function TimeList({ options, value, nearest, onPick, label = "时间", className = "aui-timelist", autoFocus = true }: { options: string[]; value: string; nearest: string; onPick: (t: string) => void; label?: string; className?: string; autoFocus?: boolean }) {
  const [active, setActive] = useState(nearest);
  const prefix = useId();
  const list = useRef<HTMLDivElement>(null);
  const into = (time: string, center: boolean) => {
    const box = list.current;
    const item = box?.querySelector<HTMLElement>(`[data-time="${time}"]`);
    if (!box || !item) return;
    if (center) box.scrollTop = item.offsetTop - box.clientHeight / 2 + item.offsetHeight / 2;
    else if (item.offsetTop < box.scrollTop) box.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = item.offsetTop + item.offsetHeight - box.clientHeight;
  };
  useEffect(() => into(active, false), [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => into(nearest, true), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={list}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${prefix}-${active.replace(":", "")}`}
      tabIndex={0}
      data-autofocus={autoFocus ? "" : undefined}
      className={className}
      onKeyDown={(event) => {
        const i = options.indexOf(active);
        const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: options.length - 1, PageDown: i + 4, PageUp: i - 4 }[event.key];
        if (next !== undefined) {
          event.preventDefault();
          setActive(options[Math.max(0, Math.min(options.length - 1, next))]!);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick(active);
        }
      }}
    >
      {options.map((t) => (
        <div key={t} id={`${prefix}-${t.replace(":", "")}`} role="option" data-time={t} aria-selected={t === value} data-active={t === active || undefined} className="aui-timelist-item" onClick={() => onPick(t)} onPointerEnter={() => setActive(t)}>
          {t}
        </div>
      ))}
    </div>
  );
}

/**
 * 「周四 · 明天」 after the value inside the box (an invisible copy of the text pushes it right after
 * the value); `deadline`: due today / tomorrow = attention colour, past = danger colour + 「（已过期）」.
 */
export function RelativeNote({ text, value, today, deadline }: { text: string; value: string; today: DayKey; deadline?: boolean }) {
  const note = relativeDayText(today, value, deadline);
  const day = dayPart(value);
  if (!note || !day) return null;
  return (
    <span className="aui-datefield-rel" aria-hidden="true">
      <span className="aui-datefield-mirror">{text}</span>
      <span className="aui-datefield-reltext" data-due={deadline ? dueState(today, day) ?? undefined : undefined}>{note}</span>
    </span>
  );
}
