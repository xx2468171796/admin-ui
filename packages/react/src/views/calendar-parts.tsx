"use client";
/**
 * Shared pieces of CalendarMonth / CalendarWeek (bt/views V5 / V6, demos D09 / D09b, review 08): the
 * event and prop types, the toolbar (今天 · ‹ › · title · 日 / 周 / 月 · colour legend · 无日期 N; on
 * phones no 日 / 周), the event menu and the 「休 国庆日」 / 「班」 day badge (host holidays).
 */
import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Maximize2 } from "lucide-react";
import { Button } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import type { MenuItem, MenuSection } from "../menu.tsx";
import type { OptionTone } from "../option-tone.ts";
import { clockText, dayMark, shortDay, type DayKey, type Weekday, type WorkCalendar } from "./date-core.ts";
import { spanDays, type CalendarEventInput, type ResolvedEvent } from "./calendar-core.ts";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

/** One record on the calendar. All-day: `start` / `end` are day keys (end inclusive); timed: ISO instants. */
export type CalendarEvent = CalendarEventInput & {
  title: string;
  /** Colour (one of the option tones, 10 hues), e.g. from the 「阶段」 option. Default brand. */
  tone?: OptionTone;
  /** The date is a deadline: overdue = red, due today / in the next 2 days = yellow, whatever `tone` says (deadlineEvents). Leave it off for closed records. */
  deadline?: boolean;
  /** The option name shown as a chip in the event card (「安装」). */
  badge?: string;
  /** Rows of the event card. */
  details?: readonly { label: string; value: ReactNode }[];
  /** false = cannot be dragged / resized (no permission, locked). Default true when onDateChange is set. */
  editable?: boolean;
};
export type CalendarMode = "day" | "week" | "month";
export type CalendarLegendItem = { label: string; tone: OptionTone };

/** Props both calendar views share. */
export type CalendarBaseProps = {
  events: readonly CalendarEvent[];
  /** The day the view shows (any day of the month / week). */
  date: DayKey;
  onNavigate: (date: DayKey) => void;
  /** Accessible name (「跟进日历」). */
  label: string;
  /** Default: AdminProvider `defaults.timeZone`, else the browser's. */
  timeZone?: string;
  /** 0 Sunday … 6 Saturday; default 1 (Monday). */
  weekStart?: Weekday;
  /** Host holidays / make-up days: month cells, week headers and gantt show 「休 国庆日」 / 「班」 (the label is the map value); the SDK ships none. */
  workCalendar?: WorkCalendar;
  /** Override 「today」 (tests, other zones); default now in `timeZone`. */
  today?: DayKey;
  /** Shows 日 / 周 / 月 in the toolbar. */
  mode?: CalendarMode;
  onModeChange?: (mode: CalendarMode) => void;
  /**
   * A drag / keyboard move or resize finished. All-day events get day keys (end inclusive, null =
   * one day); timed events get ISO instants. Reject to put the event back.
   */
  onDateChange?: (id: string, start: string, end: string | null) => void | Promise<void>;
  onOpen?: (id: string) => void;
  /** 「清除日期」 in the event card and menu (the record moves to 无日期). */
  onClearDate?: (id: string) => void;
  /** More menu items for an event (设置提醒, 分享记录, 删除记录 …), appended after the built-in ones. */
  eventMenu?: (event: CalendarEvent) => readonly MenuSection[];
  /** 「按「阶段」着色」 + chips. */
  legend?: { title: string; items: readonly CalendarLegendItem[] };
  /** Right of the toolbar (e.g. 「刻度 30 分钟 · 默认时长 1 小时」 or the 无日期 toggle). */
  toolbarExtra?: ReactNode;
};

const MODE_OPTIONS = [
  { value: "day" as const, label: "日" },
  { value: "week" as const, label: "周" },
  { value: "month" as const, label: "月" },
];

export function CalendarToolbar({ title, sub, onToday, onPrev, onNext, mode, onModeChange, legend, extra, undated, compact }: {
  title: string;
  sub?: string;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  mode?: CalendarMode;
  onModeChange?: (mode: CalendarMode) => void;
  legend?: CalendarBaseProps["legend"];
  extra?: ReactNode;
  undated?: { count: number; open: boolean; onToggle: () => void };
  /** Phones: title on its own line, no 日 / 周 / 月 (month only) and no legend. */
  compact?: boolean;
}) {
  return (
    <div className="aui-cal-bar" data-compact={compact || undefined}>
      <Button variant="outline" size="sm" onClick={onToday}>今天</Button>
      <IconButton label="往前" variant="outline" className="aui-cal-nav" onClick={onPrev} icon={<ChevronLeft size={15} aria-hidden="true" />} />
      <IconButton label="往后" variant="outline" className="aui-cal-nav" onClick={onNext} icon={<ChevronRight size={15} aria-hidden="true" />} />
      <h3 className="aui-cal-title" aria-live="polite">
        {title}
        {sub && <small>{sub}</small>}
      </h3>
      {mode && onModeChange && !compact && <SegmentedControl size="sm" label="日历范围" value={mode} onValueChange={onModeChange} options={MODE_OPTIONS} />}
      <span className="aui-cal-bar-end">
        {legend && legend.items.length > 0 && !compact && (
          <span className="aui-cal-legend" role="list" aria-label={legend.title}>
            {legend.items.map((item) => (
              <i key={item.label} role="listitem" className="aui-cal-legend-dot" data-vtone={item.tone} aria-label={item.label} data-tip={item.label} />
            ))}
            <span aria-hidden="true">{legend.title}</span>
          </span>
        )}
        {extra}
        {undated && (
          <Button variant={undated.open ? "secondary" : "outline"} size="sm" aria-pressed={undated.open} onClick={undated.onToggle}>
            <Inbox size={14} aria-hidden="true" />
            无日期 <b className="aui-cal-count">{undated.count}</b>
          </Button>
        )}
      </span>
    </div>
  );
}

/** 「休」/「班」 badge of a day (host calendar); `label` adds the host's name for it (「休 国庆日」). */
export function DayBadge({ day, calendar, label }: { day: DayKey; calendar?: WorkCalendar; label?: boolean }) {
  const mark = dayMark(day, calendar);
  if (!mark) return null;
  return (
    <span className="aui-cal-mark" data-kind={mark.kind}>
      <span className="aui-cal-badge" data-kind={mark.kind} data-tip={label ? undefined : mark.label} aria-label={mark.kind === "holiday" ? `休息：${mark.label}` : `上班：${mark.label}`}>
        {mark.badge}
      </span>
      {label && <span className="aui-cal-holiday" aria-hidden="true">{mark.label}</span>}
    </span>
  );
}

/** Built-in event menu (open, move by keyboard, clear date) followed by the host's sections. */
export function eventMenuSections(options: { onOpen?: () => void; onClearDate?: () => void; moves?: readonly MenuItem[]; extra?: readonly MenuSection[] }): MenuSection[] {
  const first: MenuItem[] = [];
  if (options.onOpen) first.push({ key: "open", label: "打开详情", icon: <Maximize2 size={15} />, shortcut: "Enter", onSelect: options.onOpen });
  const out: MenuSection[] = [];
  if (first.length) out.push({ items: first });
  if (options.moves?.length) out.push({ title: "改日期", items: options.moves });
  if (options.onClearDate) out.push({ items: [{ key: "clear", label: "清除日期", icon: <CalendarDays size={15} />, onSelect: options.onClearDate }] });
  out.push(...(options.extra ?? []));
  return out.filter((s) => s.items.length);
}

/** 「2026-10-13 → 10-15（3 天）」, 「2026-10-05」, 「2026-10-05 09:30–10:30」. */
export function whenText(event: ResolvedEvent): string {
  const days = spanDays(event);
  if (event.allDay) return days > 1 ? `${event.startDay} → ${shortDay(event.endDay)}（${days} 天）` : event.startDay;
  const from = `${event.startDay} ${clockText(event.startMin ?? 0)}`;
  return days > 1 ? `${from} → ${shortDay(event.endDay)} ${clockText(event.endMin ?? 0)}` : `${from}–${clockText(event.endMin ?? 0)}`;
}
