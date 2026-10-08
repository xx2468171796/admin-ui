"use client";
/**
 * DateRangePicker (bt/datepicker): from / to days in one box (two typed fields, 「开始日期」/「结束日期」),
 * one calendar popover with optional presets on the left (今天 / 本周 / 本月 / 近 7 天 … passed in as
 * props, see `dateRangePresets`). First click = one end, the preview follows the pointer / keyboard,
 * second click = the other end (order fixed automatically). Values are `YYYY-MM-DD` like the two native
 * date inputs it replaces.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import { Button, Input } from "./primitives.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import { isInsideLayer } from "./floating-layer.ts";
import { Calendar } from "./date-calendar.tsx";
import { useTypedValue, type DateFieldBaseProps, type DayRuleProps } from "./date-picker.tsx";
import { isCompleteDayText, isDayKey, matchingPreset, orderRange, outOfRange, parseDateText, todayKey, type DateRangePreset, type DateRangeValue, type DayKey } from "./date-picker-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dates.css";

export type DateRangePickerProps = Omit<DateFieldBaseProps, "placeholder"> & DayRuleProps & {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Quick ranges shown left of the calendar (build with `dateRangePresets([...])`). */
  presets?: readonly DateRangePreset[];
  /** Names of the two boxes; default 「开始日期」/「结束日期」. */
  fromLabel?: string;
  toLabel?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  /** Months side by side on wide screens (phones always 1); default 2. */
  months?: 1 | 2;
};

const narrow = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 600px)").matches;

/** From / to days with one calendar and optional presets. */
export function DateRangePicker({ value, onChange, presets, fromLabel = "开始日期", toLabel = "结束日期", fromPlaceholder, toPlaceholder, months = 2, min, max, weekStart = 1, isDisabledDate, holidays, ...base }: DateRangePickerProps) {
  const now = base.now ?? (() => new Date());
  const accept = (v: string) => isDayKey(v) && !outOfRange(v, min, max) && !isDisabledDate?.(v);
  const parse = (t: string) => parseDateText(t, now());
  const from = useTypedValue(value.from, (v) => v, (v) => onChange(orderRange(v, value.to)), parse, isCompleteDayText, accept);
  const to = useTypedValue(value.to, (v) => v, (v) => onChange(orderRange(value.from, v)), parse, isCompleteDayText, accept);
  const [open, setOpen] = useState(false);
  const [focusIn, setFocusIn] = useState(true);
  const [anchor, setAnchor] = useState<DayKey | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const fromBox = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const hintId = useId();
  const locked = base.disabled || base.readOnly;
  const today = todayKey(now());
  useEffect(() => {
    if (!open) setAnchor(null);
  }, [open]);
  const openPanel = (focus: boolean) => {
    if (locked) return;
    if (open && focus) {
      document.getElementById(panelId)?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
      return;
    }
    setFocusIn(focus);
    setOpen(true);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) fromBox.current?.focus({ preventScroll: true });
  };
  const pick = (day: DayKey) => {
    if (!anchor) {
      setAnchor(day);
      return;
    }
    onChange(orderRange(anchor, day));
    close(true);
  };
  const keys = (commit: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openPanel(true);
    } else if (event.key === "Enter") {
      commit();
      if (open) setOpen(false);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };
  const box = (which: "from" | "to") => {
    const field = which === "from" ? from : to;
    return (
      <Input
        ref={which === "from" ? fromBox : undefined}
        id={which === "from" ? base.id : undefined}
        name={base.name ? `${base.name}-${which}` : undefined}
        aria-label={which === "from" ? fromLabel : toLabel}
        aria-describedby={[base["aria-describedby"], hintId].filter(Boolean).join(" ")}
        aria-invalid={base["aria-invalid"] ?? (field.invalid || undefined)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="aui-daterange-box"
        value={field.text}
        placeholder={which === "from" ? fromPlaceholder ?? fromLabel : toPlaceholder ?? toLabel}
        disabled={base.disabled}
        readOnly={base.readOnly}
        autoFocus={which === "from" ? base.autoFocus : undefined}
        autoComplete="off"
        onChange={(e) => field.type(e.target.value)}
        onKeyDown={keys(field.commit)}
        onClick={() => !open && openPanel(false)}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && (wrap.current?.contains(next) || isInsideLayer(next))) {
            if (wrap.current?.contains(next)) field.commit();
            return;
          }
          field.commit();
          if (open && next) setOpen(false);
        }}
      />
    );
  };
  const active = presets ? matchingPreset(presets, value) : undefined;
  const shownMonths = months === 2 && !narrow() ? 2 : 1;
  return (
    <div
      ref={wrap}
      role="group"
      aria-label={base["aria-label"] ?? "日期范围"}
      aria-labelledby={base["aria-labelledby"]}
      className={["aui-daterange", base.className].filter(Boolean).join(" ")}
      data-size={base.size ?? "md"}
      data-state={open ? "open" : undefined}
      data-disabled={base.disabled || undefined}
      data-clearable={(base.clearable && (value.from || value.to) && !locked) || undefined}
      {...(open ? { "data-aui-layer": "" } : {})}
    >
      {box("from")}
      <ArrowRight className="aui-daterange-sep" aria-hidden="true" />
      {box("to")}
      <span id={hintId} className="aui-sr-only">可直接输入，如 2026-10-05；按 ↓ 打开日历</span>
      <span className="aui-datefield-tools">
        {base.clearable && (value.from || value.to) && !locked && (
          <button type="button" className="aui-datefield-clear" tabIndex={-1} aria-label="清除日期范围" onClick={() => { onChange({ from: "", to: "" }); fromBox.current?.focus(); }}>
            <X aria-hidden="true" />
          </button>
        )}
        <button type="button" className="aui-datefield-open" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} disabled={locked} aria-label="选择日期范围" aria-expanded={open} onClick={() => openPanel(true)}>
          <CalendarDays aria-hidden="true" />
        </button>
      </span>
      <PopoverLayer open={open} anchor={wrap.current} focusTarget={fromBox.current} label="选择日期范围" onClose={close} className="aui-popover aui-datepop" initialFocus={focusIn} dataset={{ id: panelId, "data-size": base.size ?? "md", "data-presets": presets?.length ? "" : undefined }}>
        <div className="aui-daterange-panel">
          {presets && presets.length > 0 && (
            <div role="group" aria-label="快捷范围" className="aui-daterange-presets">
              {presets.map((p) => (
                <Button key={p.key} size="sm" variant={active === p.key ? "secondary" : "ghost"} aria-pressed={active === p.key} onClick={() => { onChange(p.range); close(true); }}>
                  {p.label}
                </Button>
              ))}
            </div>
          )}
          <Calendar
            range={value}
            rangeAnchor={anchor}
            onSelect={pick}
            min={min}
            max={max}
            weekStart={weekStart}
            isDisabledDate={isDisabledDate}
            holidays={holidays}
            months={shownMonths}
            size={base.size}
            today={today}
            footer={
              <>
                <span className="aui-daterange-status" aria-live="polite">{anchor ? `已选 ${anchor}，再选另一端` : value.from && value.to ? `${value.from} → ${value.to}` : "选开始和结束日期"}</span>
                {base.clearable && (value.from || value.to) && <Button size="sm" variant="ghost" onClick={() => { onChange({ from: "", to: "" }); setAnchor(null); }}>清除</Button>}
              </>
            }
          />
        </div>
      </PopoverLayer>
    </div>
  );
}
