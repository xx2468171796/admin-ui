"use client";
/**
 * Slider and PercentInput (review 「评分与滑块」). The slider is only for rough
 * values (赢率, 满意度): a 4px rail, a 16px thumb (22px on phones) with the focus ring on hover / drag,
 * the value in a bubble above the thumb on hover / drag, optional ticks (passed ones turn white) and a
 * scale row; ← → step, PageUp / PageDown ×10, Home / End; pointer drag. It always comes with a number:
 * `withInput` puts a small NumberInput beside it (or pair it with one yourself). Rules in
 * number-input-core.ts.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { cn } from "./primitives.tsx";
import { NumberInput, PercentBar } from "./number-inputs.tsx";
import { sliderKey, sliderMarks, sliderRatio, sliderValueAt } from "./number-input-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";

export type SliderProps = {
  value: number | null;
  /** Every change (drag, keys, the paired box). */
  onChange: (value: number) => void;
  /** Once a drag ends / a key changed it (save here when saving per change is too chatty). */
  onCommit?: (value: number) => void;
  /** Accessible name (「赢率」). */
  label?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Ticks on the rail: true = every step (≤ 21), or the values to mark. */
  marks?: boolean | readonly number[];
  /** A scale row under the rail: true = min / middle / max, or the values (or `{ value, label }`) to write. */
  scale?: boolean | readonly (number | { value: number; label: string })[];
  /** Unit after the number in the bubble, aria-valuetext and the paired box (「%」「 万」). */
  unit?: string;
  /** Bubble / aria text of a value (default 「60%」 = value + unit). */
  format?: (value: number) => string;
  /** A small number box right of the slider (88px) that types the same value. */
  withInput?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
};

type ScaleItem = { value: number; label: string };
const scaleItems = (scale: SliderProps["scale"], min: number, max: number, format: (v: number) => string): ScaleItem[] => {
  if (!scale) return [];
  if (scale === true) {
    const mid = (min + max) / 2;
    return [min, mid, max].map((v) => ({ value: v, label: format(v) }));
  }
  return scale.map((item) => (typeof item === "number" ? { value: item, label: format(item) } : item));
};

/** A slider for rough values; see the module comment. */
export function Slider(props: SliderProps) {
  const { value, onChange, onCommit, label, min = 0, max = 100, step = 1, marks, scale, unit = "", withInput, disabled, id, className } = props;
  const format = props.format ?? ((v: number) => `${v}${unit}`);
  const rail = useRef<HTMLSpanElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const current = value ?? min;
  const ratio = sliderRatio(current, min, max);
  const ticks = sliderMarks(marks, min, max, step);
  const items = scaleItems(scale, min, max, format);
  const set = (next: number) => {
    if (next !== value) onChange(next);
  };
  const { drag, handlers } = useSliderDrag({ rail, thumb, current, min, max, step, disabled, set, onCommit });
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return;
    const next = sliderKey(current, event.key, { min, max, step, shiftKey: event.shiftKey });
    if (next === undefined) return;
    event.preventDefault();
    set(next);
    onCommit?.(next);
  };
  const pos = `${ratio * 100}%`;
  const slider = (
    <span
      className={cn("aui-slider", !withInput && className)}
      data-drag={drag || undefined}
      data-disabled={disabled || undefined}
      style={{ "--aui-slider-at": pos } as CSSProperties}
      {...handlers}
    >
      <span ref={rail} className="aui-slider-rail" aria-hidden="true" />
      <span className="aui-slider-fill" aria-hidden="true" />
      {ticks.map((m) => (
        <span key={m} className="aui-slider-mark" data-in={m <= current || undefined} style={{ left: `${sliderRatio(m, min, max) * 100}%` }} aria-hidden="true" />
      ))}
      <span
        ref={thumb}
        id={id}
        className="aui-slider-thumb"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={props["aria-labelledby"] ? undefined : label}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={value === null ? "未填" : format(current)}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      />
      <span className="aui-slider-tip" aria-hidden="true">{format(current)}</span>
    </span>
  );
  const body: ReactNode = items.length ? (
    <span className="aui-slider-col">
      {slider}
      <span className="aui-slider-scale" aria-hidden="true">
        {items.map((item) => (
          <span key={item.value} style={{ left: `${sliderRatio(item.value, min, max) * 100}%` }}>{item.label}</span>
        ))}
      </span>
    </span>
  ) : slider;
  if (!withInput) return body;
  return (
    <span className={cn("aui-slider-row", className)}>
      {body}
      <SliderBox value={value} onChange={onChange} onCommit={onCommit} label={label} min={min} max={max} step={step} unit={unit} disabled={disabled} />
    </span>
  );
}

/** The small number box beside a slider (88px, unit inside, no arrows). */
function SliderBox({ value, onChange, onCommit, label, min, max, step, unit, disabled }: Pick<SliderProps, "value" | "onChange" | "onCommit" | "label" | "disabled"> & { min: number; max: number; step: number; unit: string }) {
  return (
    <NumberInput
      value={value}
      onChange={(next) => {
        if (next !== null) onChange(next);
      }}
      onBlur={() => value !== null && onCommit?.(value)}
      aria-label={label ? `${label}（输入数字）` : "输入数字"}
      min={min}
      max={max}
      step={step}
      unit={unit.trim() || undefined}
      spin={false}
      disabled={disabled}
    />
  );
}

type DragInput = {
  rail: RefObject<HTMLSpanElement | null>;
  thumb: RefObject<HTMLSpanElement | null>;
  current: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  set: (value: number) => void;
  onCommit?: (value: number) => void;
};
/** Pointer drag on the whole slider: press jumps there (snapped), move follows, release commits. */
function useSliderDrag({ rail, thumb, current, min, max, step, disabled, set, onCommit }: DragInput) {
  const [drag, setDrag] = useState(false);
  const valueAt = (clientX: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return current;
    return sliderValueAt((clientX - box.left) / box.width, min, max, step);
  };
  const endDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (!drag) return;
    setDrag(false);
    const next = valueAt(event.clientX);
    set(next);
    onCommit?.(next);
  };
  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLSpanElement>) => {
      if (disabled || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      thumb.current?.focus({ preventScroll: true });
      setDrag(true);
      set(valueAt(event.clientX));
    },
    onPointerMove: (event: PointerEvent<HTMLSpanElement>) => {
      if (drag) set(valueAt(event.clientX));
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };
  return { drag, handlers };
}

// ---------------------------------------------------------------- PercentInput

export type PercentInputProps = {
  /** 0–100 (null = empty). */
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** ↑ ↓ / slider step (default 1; 赢率 often 10). */
  step?: number;
  /** Fraction digits (default 0). */
  precision?: number;
  /** A slider + small box instead of the box alone (rough values only). */
  slider?: boolean;
  /** Ticks on the slider (default every step when ≤ 21). */
  marks?: boolean | readonly number[];
  /** The 56 × 4 bar right of the box (default false). */
  bar?: boolean;
  /** Accessible name (the slider needs one; boxes are named by FormField). */
  label?: string;
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  className?: string;
};

/** A 0–100 number with 「%」 inside the box; `slider` pairs a Slider with a small box, `bar` adds the thin bar. */
export function PercentInput(props: PercentInputProps) {
  const { value, onChange, min = 0, max = 100, step = 1, precision = 0, slider, marks, bar, label, disabled, className } = props;
  if (slider)
    return (
      <Slider
        id={props.id}
        value={value}
        onChange={onChange}
        label={label}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        min={min}
        max={max}
        step={step}
        marks={marks ?? true}
        unit="%"
        withInput
        disabled={disabled || props.readOnly}
        className={className}
      />
    );
  const box = (
    <NumberInput
      id={props.id}
      value={value}
      onChange={onChange}
      aria-label={props["aria-labelledby"] ? undefined : label}
      aria-labelledby={props["aria-labelledby"]}
      aria-describedby={props["aria-describedby"]}
      aria-invalid={props["aria-invalid"]}
      min={min}
      max={max}
      step={step}
      precision={precision}
      unit="%"
      disabled={disabled}
      readOnly={props.readOnly}
      placeholder={props.placeholder}
      size={props.size}
      align={props.align}
      className={bar ? undefined : className}
    />
  );
  if (!bar) return box;
  return (
    <span className={cn("aui-pct-input", className)}>
      {box}
      <PercentBar value={value} precision={precision} label={label} className="aui-pct-bar-only" />
    </span>
  );
}
