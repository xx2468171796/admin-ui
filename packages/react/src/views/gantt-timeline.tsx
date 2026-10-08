"use client";
/**
 * The timeline half of GanttView (bt/views V7, demo D10, review 08): header ticks (today = primary date
 * badge, holidays 「休」 with the host's name), day shading (weekends light, holidays hatched), today
 * (primary 2px) / milestone lines, bars (option-tone soft fill + thin border + dark text, the title bold;
 * text that does not fit sits right of the bar on the panel background — left near the right edge) with
 * drag handles, and 「09-28 → 10-02」 edge tags for records outside the window.
 */
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OptionTone } from "../option-tone.ts";
import { softTone } from "./view-color-core.ts";
import { dayOffset, barBox, barTextPlace, barTextWidth, nonWorkRuns, spanText, type GanttDragKind, type GanttSpan, type GanttTicks, type GanttWindow } from "./gantt-core.ts";
import type { DayKey, WorkCalendar } from "./date-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type GanttMilestone = { day: DayKey; label: string };

export function GanttHeader({ ticks, window, dayWidth, today, milestones }: { ticks: GanttTicks; window: GanttWindow; dayWidth: number; today: DayKey; milestones: readonly GanttMilestone[] }) {
  const todayLeft = dayOffset(today, window, dayWidth);
  const inWindow = (left: number) => left >= 0 && left < window.days * dayWidth;
  return (
    <div className="aui-gantt-th" aria-hidden="true">
      <div className="aui-gantt-th-top">
        {ticks.top.map((t) => (
          <span key={t.key} style={{ left: t.left, width: t.width }}>{t.label}</span>
        ))}
        {inWindow(todayLeft) && !ticks.bottom.some((t) => t.today) && (() => {
          // Next to the month label when today is near its start (D10: 「2026 年 10 月 今天」), else over today's column.
          const month = ticks.top.find((t) => todayLeft >= t.left && todayLeft < t.left + t.width);
          const left = month && todayLeft - month.left < 120 ? month.left + 118 : todayLeft + dayWidth / 2;
          return <b className="aui-gantt-todaytag" style={{ left }}>今天</b>;
        })()}
        {milestones.map((m) => {
          const left = dayOffset(m.day, window, dayWidth) + dayWidth / 2;
          return inWindow(left) ? <span key={`${m.day}${m.label}`} className="aui-gantt-mslabel" style={{ left }}>{m.label} {m.day.slice(5)}</span> : null;
        })}
      </div>
      <div className="aui-gantt-th-bottom">
        {ticks.bottom.map((t) => (
          <span key={t.key} style={{ left: t.left, width: t.width }} data-today={t.today || undefined} data-off={t.nonWork || undefined} data-makeup={t.makeup || undefined} data-holiday={t.holiday ? "" : undefined} data-tip={t.holiday}>
            {t.sub && <small>{t.sub}</small>}
            <b>{t.label}</b>
          </span>
        ))}
        {milestones.map((m) => {
          const left = dayOffset(m.day, window, dayWidth) + dayWidth / 2;
          return inWindow(left) ? <i key={`d${m.day}${m.label}`} className="aui-gantt-diamond" style={{ left }} /> : null;
        })}
      </div>
    </div>
  );
}

/** Day shading, today line and milestone lines behind the rows. */
export function GanttBackdrop({ ticks, window, dayWidth, today, milestones }: { ticks: GanttTicks; window: GanttWindow; dayWidth: number; today: DayKey; milestones: readonly GanttMilestone[] }) {
  const todayLeft = dayOffset(today, window, dayWidth);
  const inWindow = (left: number) => left >= 0 && left < window.days * dayWidth;
  return (
    <div className="aui-gantt-backdrop" aria-hidden="true">
      {ticks.days.map((d) => (
        <span key={d.key} style={{ left: d.left, width: d.width }} data-off={d.nonWork || undefined} data-holiday={d.holiday ? "" : undefined} />
      ))}
      {inWindow(todayLeft) && <i className="aui-gantt-today" style={{ left: todayLeft + dayWidth / 2 }} />}
      {milestones.map((m) => {
        const left = dayOffset(m.day, window, dayWidth) + dayWidth / 2;
        return inWindow(left) ? <i key={`${m.day}${m.label}`} className="aui-gantt-msline" style={{ left }} /> : null;
      })}
    </div>
  );
}

export type GanttBarProps = {
  span: GanttSpan;
  window: GanttWindow;
  dayWidth: number;
  tone: OptionTone;
  /** Inside the bar (and after it when the bar is too short). */
  text: string;
  label: string;
  selected: boolean;
  dragging: boolean;
  editable: boolean;
  /** Edge handles shown when selected (false for endMode "fixed"). Default true. */
  resizable?: boolean;
  hatch: boolean;
  calendar?: WorkCalendar;
  milestone?: DayKey | null;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, kind: GanttDragKind) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onClick: () => void;
  onReveal: (side: "before" | "after") => void;
  onHover: (target: HTMLElement | null) => void;
};

/** One record's bar (or its off-screen pill, or a milestone diamond). */
export function GanttBar({ span, window, dayWidth, tone, text, label, selected, dragging, editable, resizable = true, hatch, calendar, milestone, onPointerDown, onKeyDown, onClick, onReveal, onHover }: GanttBarProps) {
  const box = barBox(span, window, dayWidth);
  const marker = milestone ? dayOffset(milestone, window, dayWidth) + dayWidth / 2 : null;
  const markerShown = marker !== null && marker >= 0 && marker < window.days * dayWidth;
  if (!box.visible) {
    return (
      <>
        <button type="button" className="aui-gantt-pill" data-side={box.side} aria-label={`${label}，${spanText(span)}，在${box.side === "before" ? "左边" : "右边"}，点一下跳过去`} onClick={() => onReveal(box.side)}>
          {box.side === "before" && <ChevronLeft size={12} aria-hidden="true" />}
          {spanText(span)}
          {box.side === "after" && <ChevronRight size={12} aria-hidden="true" />}
        </button>
        {markerShown && <i className="aui-gantt-milestone" style={{ left: marker }} aria-hidden="true" />}
      </>
    );
  }
  const width = Math.max(box.width, 6);
  const place = barTextPlace({ left: box.left, width }, barTextWidth(text), window.days * dayWidth);
  const style: CSSProperties = { left: box.left, width };
  const [head, ...rest] = text.split(" · ");
  const words = (
    <>
      <b>{head}</b>
      {rest.length > 0 && <span> · {rest.join(" · ")}</span>}
    </>
  );
  return (
    <>
      <button
        type="button"
        className="aui-gantt-bar"
        data-vtone={softTone(tone)}
        data-selected={selected || undefined}
        data-dragging={dragging || undefined}
        data-editable={editable || undefined}
        data-clip-start={box.clippedStart || undefined}
        data-clip-end={box.clippedEnd || undefined}
        style={style}
        aria-label={`${label}，${spanText(span)}`}
        aria-pressed={selected}
        onPointerDown={(e) => onPointerDown(e, "move")}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onPointerEnter={(e) => onHover(e.currentTarget)}
        onPointerLeave={() => onHover(null)}
        onFocus={(e) => onHover(e.currentTarget)}
        onBlur={() => onHover(null)}
      >
        {hatch &&
          nonWorkRuns(span, calendar).map((run) => {
            const left = dayOffset(span.start, window, dayWidth) + run.offset * dayWidth - box.left;
            return <i key={run.offset} className="aui-gantt-hatch" style={{ left, width: run.length * dayWidth }} aria-hidden="true" />;
          })}
        {place === "inside" && <span className="aui-gantt-bar-text">{words}</span>}
        {editable && resizable && selected && (
          <>
            <span className="aui-gantt-handle" data-edge="start" aria-hidden="true" onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, "start"); }} />
            <span className="aui-gantt-handle" data-edge="end" aria-hidden="true" onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, "end"); }} />
          </>
        )}
      </button>
      {place !== "inside" && (
        <span className="aui-gantt-after" data-side={place} style={place === "after" ? { left: box.left + width + 4 } : { right: window.days * dayWidth - box.left + 4 }} aria-hidden="true">
          {words}
        </span>
      )}
      {markerShown && <i className="aui-gantt-milestone" style={{ left: marker }} aria-hidden="true" />}
    </>
  );
}
