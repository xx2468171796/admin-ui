"use client";
/**
 * DatePicker / DateTimePicker / TimeInput (bt/datepicker): drop-in replacements of the native
 * `<input type="date | datetime-local | time">` with the same value strings (YYYY-MM-DD,
 * YYYY-MM-DDTHH:mm, HH:mm), so call sites keep their data. The box looks like the kit Input and takes
 * typing (2026-10-05, 2026/10/5, 10/5 → this year); a complete value commits while typing, looser forms
 * on Enter / blur, garbage reverts. Clicking the box shows the calendar without taking focus (typing
 * goes on); ↓ / Alt+↓ or the calendar button move focus into it; Esc closes and returns focus. The
 * popover renders through PopoverLayer, so it works inside a Dialog and flips / fits.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { CalendarDays, Clock, X } from "lucide-react";
import { Button, Input } from "./primitives.tsx";
import { PopoverLayer, type PopoverSheet } from "./popover-panel.tsx";
import { QuickDays, RelativeNote, TimeList } from "./date-picker-parts.tsx";
import { isInsideLayer } from "./floating-layer.ts";
import { Calendar, type DatePickerSize } from "./date-calendar.tsx";
import {
  dayPart,
  displayDateTime,
  isCompleteDateTimeText,
  isCompleteDayText,
  isDayKey,
  isTimeText,
  momentOutOfRange,
  nowTime,
  outOfRange,
  parseDateText,
  parseDateTimeText,
  parseTimeText,
  snapTime,
  stepTime,
  timeOptions,
  todayKey,
  type DayKey,
  type HolidayMarks,
} from "./date-picker-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";

export type { DatePickerSize };

/** Props every picker shares; aria-* / id go on the text box so FormField labels work. */
export type DateFieldBaseProps = {
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** sm 28px · md 36px (default) · touch 44px (public pages / phones). */
  size?: DatePickerSize;
  /** Show an × (on hover) and a 「清空」 in the popover that empty the value. */
  clearable?: boolean;
  /** 「周四 · 明天」 after the value in the box (DatePicker / DateTimePicker; default true). */
  relative?: boolean;
  /** A due date (跟进 / 提醒 / 到期): today / tomorrow in the attention colour, past days in the danger colour. */
  deadline?: boolean;
  /** Clock override (tests / server time). */
  now?: () => Date;
};
export type DayRuleProps = {
  /** Earliest / latest allowed (day, or moment for DateTimePicker); typed values outside are refused. */
  min?: string;
  max?: string;
  /** 0 = Sunday … 6 = Saturday; default 1 (Monday). */
  weekStart?: number;
  isDisabledDate?: (day: DayKey) => boolean;
  /** Host-supplied 休 / 补班 marks (the SDK ships no holiday calendar). */
  holidays?: HolidayMarks;
};

export const boxAria = (p: DateFieldBaseProps) => ({
  id: p.id,
  name: p.name,
  "aria-label": p["aria-label"],
  "aria-labelledby": p["aria-labelledby"],
  "aria-describedby": p["aria-describedby"],
  "aria-required": p["aria-required"] ?? (p.required || undefined),
  required: p.required,
  autoFocus: p.autoFocus,
});

/** Typed text that follows `value` and commits through `parse` (complete forms immediately). */
export function useTypedValue(value: string, display: (v: string) => string, onCommit: (v: string) => void, parse: (text: string) => string | null, complete: (text: string) => boolean, accept: (v: string) => boolean) {
  const [text, setText] = useState(display(value));
  // An outside change of the value (preset buttons, reset) rewrites the box unless it already says that.
  useEffect(() => {
    if (parse(text) !== value) setText(display(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const emit = (v: string) => {
    if (v !== value) onCommit(v);
  };
  const type = (next: string) => {
    setText(next);
    if (!next.trim()) {
      if (value) emit("");
      return;
    }
    if (complete(next)) {
      const v = parse(next);
      if (v && accept(v)) emit(v);
    }
  };
  /** Enter / blur: take any form we can read, else go back to the value. */
  const commit = () => {
    if (!text.trim()) {
      if (value) emit("");
      setText("");
      return;
    }
    const v = parse(text);
    if (v && accept(v)) {
      emit(v);
      setText(display(v));
    } else setText(display(value));
  };
  const parsed = text.trim() ? parse(text) : "";
  const invalid = parsed === null || (parsed !== "" && !accept(parsed));
  return { text, setText, type, commit, invalid, emit };
}

type ShellProps = {
  base: DateFieldBaseProps;
  kind: "date" | "time";
  text: string;
  invalid: boolean;
  placeholder: string;
  open: boolean;
  onOpen: (focusIn: boolean) => void;
  onClose: (returnFocus: boolean) => void;
  onType: (text: string) => void;
  onCommit: () => void;
  onStep?: (delta: 1 | -1) => void;
  onClear: () => void;
  canClear: boolean;
  label: string;
  hint: string;
  panel: ReactNode;
  panelClass: string;
  panelFocus: boolean;
  /** The text box (callers focus it after a pick). */
  inputRef: RefObject<HTMLInputElement | null>;
  /** 「周四 · 明天」 shown after the value. */
  note?: ReactNode;
  /** Phone bottom sheet head (清空 · title · 确定). */
  sheet?: PopoverSheet;
};
/** The kit-Input-looking box + × + calendar / clock button + the popover. */
function FieldShell({ base, kind, text, invalid, placeholder, open, onOpen, onClose, onType, onCommit, onStep, onClear, canClear, label, hint, panel, panelClass, panelFocus, inputRef: input, note, sheet }: ShellProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const hintId = useId();
  const locked = base.disabled || base.readOnly;
  const focusPanel = () => document.getElementById(panelId)?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  const openIn = () => (open ? focusPanel() : onOpen(true));
  const close = (returnFocus: boolean) => {
    onClose(returnFocus);
    if (returnFocus) input.current?.focus({ preventScroll: true });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" && (event.altKey || !onStep)) {
      if (locked) return;
      event.preventDefault();
      openIn();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && onStep) {
      if (locked) return;
      event.preventDefault();
      onStep(event.key === "ArrowUp" ? 1 : -1);
    } else if (event.key === "Enter") {
      onCommit();
      if (open) onClose(false);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      onClose(false);
    }
  };
  const Icon = kind === "time" ? Clock : CalendarDays;
  return (
    <div
      ref={wrap}
      className={["aui-datefield", base.className].filter(Boolean).join(" ")}
      data-size={base.size ?? "md"}
      data-kind={kind}
      data-clearable={canClear || undefined}
      // While the popover is open the box counts as part of it: Esc / outside-click handlers of an
      // enclosing Dialog leave it alone.
      {...(open ? { "data-aui-layer": "" } : {})}
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (to instanceof Node && (wrap.current?.contains(to) || isInsideLayer(to))) return;
        onCommit();
        // No new focus (a click on the panel's padding, the window losing focus): keep it open; an
        // outside click is closed by the popover itself.
        if (open && to) onClose(false);
      }}
    >
      <Input
        ref={input}
        {...boxAria(base)}
        value={text}
        placeholder={placeholder}
        disabled={base.disabled}
        readOnly={base.readOnly}
        autoComplete="off"
        inputMode={kind === "time" ? "numeric" : undefined}
        aria-invalid={base["aria-invalid"] ?? (invalid || undefined)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-describedby={[base["aria-describedby"], hintId].filter(Boolean).join(" ")}
        data-state={open ? "open" : undefined}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={onKeyDown}
        onClick={() => {
          if (!locked && !open) onOpen(false);
        }}
      />
      {note}
      <span id={hintId} className="aui-sr-only">{hint}</span>
      <span className="aui-datefield-tools">
        {canClear && !locked && (
          <button type="button" className="aui-datefield-clear" tabIndex={-1} aria-label={kind === "time" ? "清除时间" : "清除日期"} onClick={() => { onClear(); input.current?.focus({ preventScroll: true }); }}>
            <X aria-hidden="true" />
          </button>
        )}
        <button type="button" className="aui-datefield-open" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} disabled={locked} aria-label={label} aria-expanded={open} onClick={openIn}>
          <Icon aria-hidden="true" />
        </button>
      </span>
      <PopoverLayer open={open} anchor={wrap.current} focusTarget={input.current} label={label} onClose={close} className={`aui-popover ${panelClass}`} initialFocus={panelFocus} dataset={{ id: panelId, "data-size": base.size ?? "md" }} sheet={sheet}>
        {panel}
      </PopoverLayer>
    </div>
  );
}

/** Bottom-sheet title: the field's own name (aria-label, else its visible <label for>), else `fallback`. */
function fieldTitle(base: DateFieldBaseProps, fallback: string): string {
  if (base["aria-label"]) return base["aria-label"];
  if (typeof document === "undefined") return fallback;
  const byId = (id: string | undefined) => (id ? document.getElementById(id)?.textContent?.trim() : undefined);
  const labelled = base["aria-labelledby"]?.split(/\s+/).map(byId).filter(Boolean).join(" ");
  const forId = base.id ? document.querySelector(`label[for="${CSS.escape(base.id)}"]`)?.textContent?.trim() : undefined;
  return labelled || forId || fallback;
}

// ---------------------------------------------------------------- DatePicker

export type DatePickerProps = DateFieldBaseProps & DayRuleProps & {
  /** `YYYY-MM-DD` or "". */
  value: string;
  onChange: (value: string) => void;
};
/** One day (YYYY-MM-DD) — the `<input type="date">` replacement. */
export function DatePicker({ value, onChange, min, max, weekStart = 1, isDisabledDate, holidays, relative = true, deadline, ...base }: DatePickerProps) {
  const now = base.now ?? (() => new Date());
  const accept = (v: string) => isDayKey(v) && !outOfRange(v, min, max) && !isDisabledDate?.(v);
  const field = useTypedValue(value, (v) => v, onChange, (t) => parseDateText(t, now()), isCompleteDayText, accept);
  const [open, setOpen] = useState(false);
  const [focusIn, setFocusIn] = useState(true);
  const today = todayKey(now());
  const typed = field.text.trim() ? parseDateText(field.text, now()) : null;
  const input = useRef<HTMLInputElement>(null);
  const pick = (day: DayKey) => {
    field.emit(day);
    field.setText(day);
    setOpen(false);
    input.current?.focus({ preventScroll: true });
  };
  const clear = () => {
    field.type("");
    setOpen(false);
    input.current?.focus({ preventScroll: true });
  };
  const clearable = Boolean(base.clearable && value && !base.disabled && !base.readOnly);
  return (
    <FieldShell
      inputRef={input}
      base={base}
      kind="date"
      note={relative && value && field.text === value ? <RelativeNote text={field.text} value={value} today={today} deadline={deadline} /> : undefined}
      sheet={{ title: fieldTitle(base, "选择日期"), start: clearable ? <button type="button" className="aui-sheet-action" data-muted onClick={clear}>清空</button> : undefined, end: <button type="button" className="aui-sheet-action" onClick={() => setOpen(false)}>确定</button> }}
      text={field.text}
      invalid={field.invalid}
      placeholder={base.placeholder ?? "选择日期"}
      open={open}
      onOpen={(f) => { setFocusIn(f); setOpen(true); }}
      onClose={() => setOpen(false)}
      onType={field.type}
      onCommit={field.commit}
      onClear={() => field.type("")}
      canClear={Boolean(base.clearable && value)}
      label="选择日期"
      hint="可直接输入，如 2026-10-05；按 ↓ 打开日历"
      panelClass="aui-datepop"
      panelFocus={focusIn}
      panel={
        <div className="aui-datepop-body">
          <QuickDays today={today} value={value} accept={accept} onPick={pick} onClear={clearable ? clear : undefined} />
          <Calendar
            value={value}
            initialFocus={typed ?? undefined}
            onSelect={pick}
            min={min}
            max={max}
            weekStart={weekStart}
            isDisabledDate={isDisabledDate}
            holidays={holidays}
            size={base.size}
            today={today}
          />
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------- DateTimePicker

export type DateTimePickerProps = DateFieldBaseProps & DayRuleProps & {
  /** `YYYY-MM-DDTHH:mm` or "". */
  value: string;
  onChange: (value: string) => void;
  /** Minutes between choosable times (typed times are rounded to it); default 1, list every 30. */
  minuteStep?: number;
  /** Time used when a day is picked / typed without one; default now rounded to the step. */
  defaultTime?: string;
};
/** Day + time (YYYY-MM-DDTHH:mm) — the `<input type="datetime-local">` replacement. */
export function DateTimePicker({ value, onChange, min, max, weekStart = 1, isDisabledDate, holidays, minuteStep = 1, defaultTime, relative = true, deadline, ...base }: DateTimePickerProps) {
  const now = base.now ?? (() => new Date());
  const step = Math.max(1, Math.round(minuteStep));
  const fallback = () => (value.length === 16 ? value.slice(11) : defaultTime && isTimeText(defaultTime) ? defaultTime : snapTime(nowTime(now()), step));
  const accept = (v: string) => v.length === 16 && !momentOutOfRange(v, min, max) && !outOfRange(v.slice(0, 10), min, max) && !isDisabledDate?.(v.slice(0, 10));
  const parse = (t: string) => {
    const v = parseDateTimeText(t, now(), fallback());
    return v ? `${v.slice(0, 11)}${snapTime(v.slice(11), step)}` : null;
  };
  const field = useTypedValue(value, displayDateTime, onChange, parse, isCompleteDateTimeText, accept);
  const [open, setOpen] = useState(false);
  const [focusIn, setFocusIn] = useState(true);
  const today = todayKey(now());
  const typed = field.text.trim() ? parse(field.text) : null;
  const day = dayPart(value) ?? "";
  const time = value.length === 16 ? value.slice(11) : "";
  const input = useRef<HTMLInputElement>(null);
  const set = (next: string) => {
    if (!accept(next)) return;
    field.emit(next);
    field.setText(displayDateTime(next));
  };
  const done = () => {
    setOpen(false);
    input.current?.focus({ preventScroll: true });
  };
  const clearable = Boolean(base.clearable && value && !base.disabled && !base.readOnly);
  const clear = () => {
    field.type("");
    done();
  };
  const listTimes = timeOptions(Math.max(30, step));
  return (
    <FieldShell
      inputRef={input}
      base={base}
      kind="date"
      note={relative && value && field.text === displayDateTime(value) ? <RelativeNote text={field.text} value={value} today={today} deadline={deadline} /> : undefined}
      sheet={{ title: fieldTitle(base, "选择日期和时间"), start: clearable ? <button type="button" className="aui-sheet-action" data-muted onClick={clear}>清空</button> : undefined, end: <button type="button" className="aui-sheet-action" onClick={done}>确定</button> }}
      text={field.text}
      invalid={field.invalid}
      placeholder={base.placeholder ?? "选择日期和时间"}
      open={open}
      onOpen={(f) => { setFocusIn(f); setOpen(true); }}
      onClose={() => setOpen(false)}
      onType={field.type}
      onCommit={field.commit}
      onClear={() => field.type("")}
      canClear={Boolean(base.clearable && value)}
      label="选择日期和时间"
      hint="可直接输入，如 2026-10-05 14:30；按 ↓ 打开日历"
      panelClass="aui-datepop"
      panelFocus={focusIn}
      panel={
        <div className="aui-datepop-body">
          <QuickDays today={today} value={day} accept={(d) => accept(`${d}T${fallback()}`)} onPick={(d) => set(`${d}T${fallback()}`)} onClear={clearable ? clear : undefined} />
          <div className="aui-datepop-main">
            <Calendar
              value={day}
              initialFocus={typed?.slice(0, 10)}
              onSelect={(d) => set(`${d}T${fallback()}`)}
              min={min}
              max={max}
              weekStart={weekStart}
              isDisabledDate={isDisabledDate}
              holidays={holidays}
              size={base.size}
              today={today}
            />
            <TimeList
              className="aui-timelist aui-dcal-timecol"
              label="时间列表"
              autoFocus={false}
              options={listTimes}
              value={time}
              nearest={time ? listTimes.reduce((a, b) => (Math.abs(minutes(b) - minutes(time)) < Math.abs(minutes(a) - minutes(time)) ? b : a)) : "09:00"}
              onPick={(t) => set(`${day || today}T${t}`)}
            />
          </div>
          <div className="aui-dcal-foot">
            <span className="aui-datepop-time">
              <TimeInput aria-label="时间" size="sm" value={time} minuteStep={step} disabled={!day} onChange={(t) => t && day && set(`${day}T${t}`)} />
            </span>
            <Button size="sm" onClick={done}>确定</Button>
          </div>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------- TimeInput

export type TimeInputProps = DateFieldBaseProps & {
  /** `HH:mm` or "". */
  value: string;
  onChange: (value: string) => void;
  /** Minutes per ↑ / ↓ and rounding of typed times; default 1. */
  minuteStep?: number;
  /** Minutes between rows of the drop-down list; default max(step, 30). */
  listStep?: number;
};
/** A time (HH:mm) — the `<input type="time">` replacement: type, ↑ / ↓ by the step, or pick from a list. */
export function TimeInput({ value, onChange, minuteStep = 1, listStep, ...base }: TimeInputProps) {
  const step = Math.max(1, Math.round(minuteStep));
  const parse = (t: string) => {
    const v = parseTimeText(t);
    return v ? snapTime(v, step) : null;
  };
  const field = useTypedValue(value, (v) => v, onChange, parse, (t) => isTimeText(t.trim()), isTimeText);
  const [open, setOpen] = useState(false);
  const [focusIn, setFocusIn] = useState(true);
  const options = timeOptions(listStep ?? Math.max(step, 30));
  const current = field.invalid ? value : parse(field.text) ?? value;
  const nearest = current ? options.reduce((a, b) => (Math.abs(minutes(b) - minutes(current)) < Math.abs(minutes(a) - minutes(current)) ? b : a)) : "09:00";
  const input = useRef<HTMLInputElement>(null);
  const pick = (t: string) => {
    field.emit(t);
    field.setText(t);
    setOpen(false);
    input.current?.focus({ preventScroll: true });
  };
  return (
    <FieldShell
      inputRef={input}
      base={base}
      kind="time"
      text={field.text}
      invalid={field.invalid}
      placeholder={base.placeholder ?? "时:分"}
      open={open}
      onOpen={(f) => { setFocusIn(f); setOpen(true); }}
      onClose={() => setOpen(false)}
      onType={field.type}
      onCommit={field.commit}
      onStep={(d) => {
        const next = stepTime(current || nowTime(base.now?.() ?? new Date()), d * step);
        field.emit(next);
        field.setText(next);
      }}
      onClear={() => field.type("")}
      canClear={Boolean(base.clearable && value)}
      label="选择时间"
      hint="可直接输入，如 14:30；↑ ↓ 调整，Alt + ↓ 打开列表"
      panelClass="aui-timepop"
      panelFocus={focusIn}
      panel={<TimeList options={options} value={value} nearest={nearest} onPick={pick} />}
    />
  );
}
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
