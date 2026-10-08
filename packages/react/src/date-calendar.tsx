"use client";
/**
 * Calendar (bt/datepicker): the month grid inside DatePicker / DateRangePicker / DateTimePicker and
 * anything else that picks a day from a popover (the gantt settings' 补班日 「+ 添加」). WAI-ARIA grid:
 * one tab stop (the focused day), ← → ↑ ↓ / PageUp / PageDown (Shift = year) / Home / End move,
 * Enter / Space pick. The title opens a month / year jump view. Holiday marks (休 / 班) come from the
 * host; the SDK ships no calendar.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./primitives.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import {
  addMonths,
  clampDay,
  dayLabel,
  inRange,
  isDayKey,
  monthLabel,
  monthMatrix,
  moveDay,
  orderRange,
  outOfRange,
  splitDay,
  startOfMonth,
  todayKey,
  weekdayLabels,
  weekdayOf,
  dayKeyOf,
  type DateRangeValue,
  type DayKey,
  type HolidayMarks,
} from "./date-picker-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";

export type DatePickerSize = "sm" | "md" | "touch";

export type CalendarProps = {
  /** Selected day (single mode); "" = none. */
  value?: string;
  /** Selected range (range mode). */
  range?: DateRangeValue;
  /** Range mode: the first end already picked; the preview runs from it to the hovered / focused day. */
  rangeAnchor?: DayKey | null;
  onSelect: (day: DayKey) => void;
  /** Days before / after are shown but cannot be picked (day or moment values, compared by day). */
  min?: string;
  max?: string;
  /** 0 = Sunday … 6 = Saturday; default 1 (Monday). */
  weekStart?: number;
  /** Extra days that cannot be picked (weekends, full days …). */
  isDisabledDate?: (day: DayKey) => boolean;
  /** Host-supplied 休 / 补班 marks. */
  holidays?: HolidayMarks;
  /** Months side by side (1 or 2); a range picker on a wide screen uses 2. */
  months?: 1 | 2;
  /** Day that gets keyboard focus / is shown first; default the value, else today. */
  initialFocus?: DayKey;
  /** sm / md cells 32px, touch 44px (phones always get 44px). */
  size?: DatePickerSize;
  /** Accessible name prefix (「开始日期」) of the grid. */
  label?: string;
  /** Today override (tests / server time). */
  today?: DayKey;
  /** Called with the day keyboard focus moved to (a text box can follow it). */
  onFocusDay?: (day: DayKey) => void;
  /** Bottom bar (今天 / 清除 / time). */
  footer?: ReactNode;
};

/** Month grid with prev / next, month / year jump and full keyboard. */
export function Calendar({ value = "", range, rangeAnchor = null, onSelect, min, max, weekStart = 1, isDisabledDate, holidays, months = 1, initialFocus, size = "md", label, today: todayProp, onFocusDay, footer }: CalendarProps) {
  const today = todayProp ?? todayKey();
  const start = clampDay(initialFocus && isDayKey(initialFocus) ? initialFocus : isDayKey(value) ? value : range && isDayKey(range.from) ? range.from : today, min, max);
  const [focus, setFocus] = useState<DayKey>(start);
  const [view, setView] = useState<DayKey>(startOfMonth(start));
  const [mode, setMode] = useState<"days" | "months">("days");
  const [hover, setHover] = useState<DayKey | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const lastView = addMonths(view, months - 1);
  // Follow an outside change of the starting day (typing in the box while the panel is open).
  useEffect(() => {
    setFocus(start);
    setView((v) => (start < v || start > lastDayOf(addMonths(v, months - 1)) ? startOfMonth(start) : v));
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    root.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus, view]);
  const blocked = (day: DayKey) => outOfRange(day, min, max) || Boolean(isDisabledDate?.(day));
  const goTo = (day: DayKey, keyboard: boolean) => {
    moved.current = keyboard;
    setFocus(day);
    onFocusDay?.(day);
    if (day < view) setView(startOfMonth(day));
    else if (day > lastDayOf(lastView)) setView(addMonths(startOfMonth(day), -(months - 1)));
  };
  const shiftView = (delta: number) => {
    const next = addMonths(view, delta);
    setView(next);
    const target = clampDay(addMonths(focus, delta), min, max);
    setFocus(target);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!blocked(focus)) onSelect(focus);
      return;
    }
    const next = moveDay(focus, event.key, { weekStart, shiftKey: event.shiftKey, min, max });
    if (!next) return;
    event.preventDefault();
    goTo(next, true);
  };
  const preview = rangeAnchor ? orderRange(rangeAnchor, hover ?? focus) : range;
  const lo = splitDay(min?.slice(0, 10) ?? "");
  const hi = splitDay(max?.slice(0, 10) ?? "");
  const viewParts = splitDay(view)!;
  const prevDisabled = Boolean(lo && view <= dayKeyOf(lo.year, lo.month, 1));
  const nextDisabled = Boolean(hi && lastView >= dayKeyOf(hi.year, hi.month, 1));
  return (
    <div ref={root} className="aui-dcal" data-size={size} data-months={months}>
      <div className="aui-dcal-head">
        <IconButton label={mode === "days" ? "上个月" : "上一年"} className="aui-dcal-nav" disabled={mode === "days" && prevDisabled} onClick={() => (mode === "days" ? shiftView(-1) : setView(addMonths(view, -12)))} icon={<ChevronLeft aria-hidden="true" />} />
        <div className="aui-dcal-titles">
          {mode === "days" ? (
            Array.from({ length: months }, (_, i) => {
              const p = splitDay(addMonths(view, i))!;
              return (
                <button key={i} type="button" className="aui-dcal-title" aria-live="polite" aria-expanded={false} aria-label={`${monthLabel(p.year, p.month)}，切换年月`} onClick={() => setMode("months")}>
                  {monthLabel(p.year, p.month)}
                  {i === 0 && <ChevronDown aria-hidden="true" />}
                </button>
              );
            })
          ) : (
            <button type="button" className="aui-dcal-title" aria-expanded aria-label={`${viewParts.year} 年，回到日期`} onClick={() => setMode("days")}>
              {viewParts.year} 年<ChevronDown aria-hidden="true" />
            </button>
          )}
        </div>
        <IconButton label={mode === "days" ? "下个月" : "下一年"} className="aui-dcal-nav" disabled={mode === "days" && nextDisabled} onClick={() => (mode === "days" ? shiftView(1) : setView(addMonths(view, 12)))} icon={<ChevronRight aria-hidden="true" />} />
      </div>
      {mode === "months" ? (
        <MonthJump
          year={viewParts.year}
          current={viewParts.month}
          today={today}
          min={min}
          max={max}
          onPick={(month) => {
            const first = dayKeyOf(viewParts.year, month, 1);
            setView(first);
            const d = splitDay(focus)!;
            moved.current = true;
            setFocus(clampDay(dayKeyOf(viewParts.year, month, Math.min(d.day, Number(lastDayOf(first).slice(8)))), min, max));
            setMode("days");
          }}
        />
      ) : (
        <div className="aui-dcal-months">
          {Array.from({ length: months }, (_, i) => {
            const p = splitDay(addMonths(view, i))!;
            return (
              <MonthGrid
                key={i}
                year={p.year}
                month={p.month}
                weekStart={weekStart}
                hideOutside={months > 1}
                label={`${label ? `${label} ` : ""}${monthLabel(p.year, p.month)}`}
                focus={focus}
                value={value}
                preview={preview}
                anchor={rangeAnchor}
                today={today}
                holidays={holidays}
                blocked={blocked}
                onKeyDown={onKeyDown}
                onPick={(day) => {
                  goTo(day, false);
                  if (!blocked(day)) onSelect(day);
                }}
                onHover={setHover}
              />
            );
          })}
        </div>
      )}
      {footer && <div className="aui-dcal-foot">{footer}</div>}
    </div>
  );
}

const lastDayOf = (monthStart: DayKey): DayKey => {
  const p = splitDay(monthStart)!;
  return dayKeyOf(p.year, p.month, new Date(Date.UTC(p.year, p.month, 0)).getUTCDate());
};

type MonthGridProps = {
  year: number;
  month: number;
  weekStart: number;
  hideOutside: boolean;
  label: string;
  focus: DayKey;
  value: string;
  preview?: DateRangeValue;
  anchor: DayKey | null;
  today: DayKey;
  holidays?: HolidayMarks;
  blocked: (day: DayKey) => boolean;
  onKeyDown: (event: KeyboardEvent) => void;
  onPick: (day: DayKey) => void;
  onHover: (day: DayKey | null) => void;
};
function MonthGrid({ year, month, weekStart, hideOutside, label, focus, value, preview, anchor, today, holidays, blocked, onKeyDown, onPick, onHover }: MonthGridProps) {
  const weeks = monthMatrix(year, month, weekStart);
  const prefix = dayKeyOf(year, month, 1).slice(0, 7);
  const days = weekdayLabels(weekStart);
  return (
    <div role="grid" aria-label={label} className="aui-dcal-grid" onKeyDown={onKeyDown} onPointerLeave={() => onHover(null)}>
      <div role="row" className="aui-dcal-row aui-dcal-weekdays">
        {days.map((d, i) => (
          <span key={i} role="columnheader" className="aui-dcal-wd" aria-label={`星期${d}`} data-weekend={(weekStart + i) % 7 === 0 || (weekStart + i) % 7 === 6 || undefined}>
            {d}
          </span>
        ))}
      </div>
      {weeks.map((week, w) => (
        <div key={w} role="row" className="aui-dcal-row">
          {week.map((day) => {
            const outside = !day.startsWith(prefix);
            if (outside && hideOutside) return <span key={day} role="gridcell" className="aui-dcal-day" data-empty aria-hidden="true" />;
            const mark = holidays?.[day];
            const isBlocked = blocked(day);
            const selected = preview ? Boolean(preview.from && (day === preview.from || day === preview.to)) || (anchor === day) : day === value;
            const between = preview && inRange(day, preview.from, preview.to) && !selected;
            return (
              <span
                key={day}
                role="gridcell"
                className="aui-dcal-day"
                data-day={day}
                tabIndex={day === focus ? 0 : -1}
                data-autofocus={day === focus ? "" : undefined}
                aria-selected={selected}
                aria-current={day === today ? "date" : undefined}
                aria-disabled={isBlocked || undefined}
                aria-label={dayLabel(day, mark)}
                data-outside={outside || undefined}
                data-between={between || undefined}
                data-edge={preview && selected ? (day === preview.from && day === preview.to ? "both" : day === preview.from ? "start" : "end") : undefined}
                data-holiday={mark}
                data-weekend={[0, 6].includes(weekdayOf(day)) || undefined}
                onClick={() => onPick(day)}
                onPointerEnter={() => onHover(day)}
              >
                {Number(day.slice(8))}
                {mark && <small aria-hidden="true">{mark === "off" ? "休" : "班"}</small>}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthJump({ year, current, today, min, max, onPick }: { year: number; current: number; today: DayKey; min?: string; max?: string; onPick: (month: number) => void }) {
  const [focus, setFocus] = useState(current);
  const ref = useRef<HTMLDivElement>(null);
  const moved = useRef(true);
  useLayoutEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    ref.current?.querySelector<HTMLElement>(`[data-month="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus]);
  const lo = min?.slice(0, 7);
  const hi = max?.slice(0, 7);
  return (
    <div
      ref={ref}
      role="grid"
      aria-label={`${year} 年的月份`}
      className="aui-dcal-monthgrid"
      onKeyDown={(event) => {
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
        if (delta === undefined) return;
        event.preventDefault();
        moved.current = true;
        setFocus((f) => Math.min(12, Math.max(1, f + delta)));
      }}
    >
      {[0, 1, 2, 3].map((r) => (
        <div key={r} role="row" className="aui-dcal-monthrow">
          {[1, 2, 3].map((c) => {
            const m = r * 3 + c;
            const key = `${year}-${String(m).padStart(2, "0")}`;
            const off = Boolean((lo && key < lo) || (hi && key > hi));
            return (
              <button
                key={m}
                type="button"
                role="gridcell"
                data-month={m}
                className="aui-dcal-month"
                tabIndex={m === focus ? 0 : -1}
                aria-selected={m === current}
                aria-current={today.startsWith(key) ? "date" : undefined}
                disabled={off}
                onClick={() => onPick(m)}
              >
                {m} 月
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- CalendarButton

export type CalendarButtonProps = {
  min?: string;
  max?: string;
  weekStart?: number;
  isDisabledDate?: (day: DayKey) => boolean;
  holidays?: HolidayMarks;
  /** Button content (「+ 添加」). */
  children: ReactNode;
  /** Accessible name of the button and the popover (「添加补班日」). */
  label: string;
  onSelect: (day: DayKey) => void;
  /** Day the calendar opens on; default today. */
  initialDay?: DayKey;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: DatePickerSize;
  disabled?: boolean;
  className?: string;
  /** id of the button (a FormField htmlFor). */
  id?: string;
  /** Keep the calendar open after a pick (adding several days); default false. */
  keepOpen?: boolean;
  now?: () => Date;
};
/** A button that opens the calendar and hands back the picked day — for 「+ 添加」 chips (补班日, 休息日). */
export function CalendarButton({ children, label, onSelect, initialDay, variant = "outline", size = "sm", disabled, className, id, keepOpen = false, min, max, weekStart = 1, isDisabledDate, holidays, now }: CalendarButtonProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <Button ref={trigger} id={id} type="button" variant={variant} size={size === "md" ? "default" : "sm"} className={className} disabled={disabled} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {children}
      </Button>
      <PopoverLayer open={open} anchor={trigger.current} label={label} onClose={close} className="aui-popover aui-datepop" dataset={{ "data-size": size }}>
        <Calendar
          initialFocus={initialDay}
          today={todayKey(now?.())}
          onSelect={(day) => {
            onSelect(day);
            if (!keepOpen) close(true);
          }}
          min={min}
          max={max}
          weekStart={weekStart}
          isDisabledDate={isDisabledDate}
          holidays={holidays}
          size={size}
        />
      </PopoverLayer>
    </>
  );
}
