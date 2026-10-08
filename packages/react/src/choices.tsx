"use client";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { Button, cn } from "./primitives.tsx";
import { datePresetKey, datePresetValue, hourPresetValue, stepEnabled, toggleChoice, type DatePresetKey } from "./choice-core.ts";

/** Arrow keys / Home / End move focus between the enabled buttons of a group (they never select). */
function useArrowFocus(count: number, isDisabled: (index: number) => boolean) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : event.key === "Home"
            ? "first"
            : event.key === "End"
              ? "last"
              : null;
    if (step === null) return;
    event.preventDefault();
    const next = stepEnabled(Array.from({ length: count }, (_, i) => isDisabled(i)), index, step);
    if (next >= 0) refs.current[next]?.focus();
  };
  return { refs, onKeyDown };
}

export type SegmentedOption<V extends string = string> = {
  value: V;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
};
export type SegmentedControlProps<V extends string = string> = {
  value: V;
  onValueChange: (value: V) => void;
  options: readonly SegmentedOption<V>[];
  /** Accessible name of the group, e.g.「查看范围」. */
  label: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
};
/**
 * Single choice among 2–6 short options (view mode, range, preset). Buttons with aria-pressed:
 * arrows move focus, Enter / Space picks, so an option that saves on click is never triggered by
 * just arrowing past it. Use Choice for long lists and Tabs for page sections.
 */
export function SegmentedControl<V extends string = string>({
  value,
  onValueChange,
  options,
  label,
  size = "md",
  disabled = false,
  className,
}: SegmentedControlProps<V>) {
  const off = (i: number) => disabled || Boolean(options[i]?.disabled);
  const { refs, onKeyDown } = useArrowFocus(options.length, off);
  const selectedIndex = options.findIndex((o) => o.value === value);
  // Exactly one stop in the tab order: the selected option, else the first enabled one.
  const tabStop = selectedIndex >= 0 && !off(selectedIndex) ? selectedIndex : options.findIndex((_, i) => !off(i));
  return (
    <div role="group" aria-label={label} className={cn("aui-segmented", className)} data-size={size}>
      {options.map((option, index) => {
        const pressed = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            className="aui-segmented-item"
            aria-pressed={pressed}
            disabled={off(index)}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => {
              if (!pressed) onValueChange(option.value);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {Icon && <Icon aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export type ChipOption<V extends string = string> = {
  value: V;
  label: string;
  /** Optional count shown after the label (e.g. matching rows); null / undefined hides it. */
  count?: number | null;
  disabled?: boolean;
};
export type ChipGroupProps<V extends string = string> = {
  value: readonly V[];
  onValueChange: (value: V[]) => void;
  options: readonly ChipOption<V>[];
  label: string;
  disabled?: boolean;
  className?: string;
};
/** Multi-select filter chips (aria-pressed toggles, wrap on narrow screens); result keeps option order. */
export function ChipGroup<V extends string = string>({
  value,
  onValueChange,
  options,
  label,
  disabled = false,
  className,
}: ChipGroupProps<V>) {
  const off = (i: number) => disabled || Boolean(options[i]?.disabled);
  const { refs, onKeyDown } = useArrowFocus(options.length, off);
  return (
    <div role="group" aria-label={label} className={cn("aui-chips", className)}>
      {options.map((option, index) => {
        const pressed = value.includes(option.value);
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            className="aui-chip"
            aria-pressed={pressed}
            disabled={off(index)}
            onClick={() => onValueChange(toggleChoice(options, value, option.value) as V[])}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {pressed && <Check aria-hidden="true" />}
            {option.label}
            {option.count !== undefined && option.count !== null && (
              <span className="aui-chip-count">{option.count.toLocaleString()}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type QuickDatePresetsProps = {
  /** Receives the input value: YYYY-MM-DD / YYYY-MM-DDTHH:mm in local time, or "" for 永久; then the preset key. */
  onPick: (value: string, key: DatePresetKey) => void;
  /** Days from now; default 1 / 7 / 30. */
  days?: readonly number[];
  /** Hours from now, shown before the days (「1 小时」); default none. */
  hours?: readonly number[];
  /** Add a「永久」button (or a custom label) that picks "". */
  permanent?: boolean | string;
  type?: "date" | "datetime-local";
  /** Accessible name of the group; default「快捷日期」. */
  label?: string;
  disabled?: boolean;
  /** The preset currently in effect (`"7d"`, `"1h"`, `"permanent"`): shown pressed. Omit for plain fill buttons. */
  selected?: DatePresetKey | null;
  /**
   * Why a preset is not allowed (「华南子公司要求最长 30 天」): the button stays focusable, is struck
   * through, does nothing and reads the reason. Return undefined for allowed presets.
   */
  disabledReason?: (key: DatePresetKey) => string | undefined;
  /** Extra buttons after the presets (「自定义」). */
  children?: ReactNode;
  /** Clock override for tests / server time. */
  now?: () => Date;
};
/**
 * Small buttons under a date / datetime-local input that fill it with「N 小时 / N 天后」or empty (永久).
 * With `selected` they act as a single choice (aria-pressed); `disabledReason` greys out what a policy forbids.
 */
export function QuickDatePresets({
  onPick,
  days = [1, 7, 30],
  hours = [],
  permanent = false,
  type = "datetime-local",
  label = "快捷日期",
  disabled = false,
  selected,
  disabledReason,
  children,
  now = () => new Date(),
}: QuickDatePresetsProps) {
  const reasonId = useId();
  const presets: { key: DatePresetKey; text: string; value: () => string }[] = [
    ...hours.map((h) => ({ key: datePresetKey(h, "h"), text: `${h} 小时`, value: () => hourPresetValue(h, type, now()) })),
    ...days.map((d) => ({ key: datePresetKey(d, "d"), text: `${d} 天`, value: () => datePresetValue(d, type, now()) })),
    ...(permanent !== false ? [{ key: "permanent" as const, text: permanent === true ? "永久" : permanent, value: () => "" }] : []),
  ];
  return (
    <div role="group" aria-label={label} className="aui-date-presets">
      {presets.map((preset, i) => {
        const reason = disabledReason?.(preset.key);
        const pressed = selected === undefined ? undefined : selected === preset.key;
        return (
          <Button
            key={preset.key}
            size="sm"
            variant={pressed ? "default" : "outline"}
            disabled={disabled}
            aria-pressed={pressed}
            aria-disabled={reason ? true : undefined}
            aria-describedby={reason ? `${reasonId}-${i}` : undefined}
            data-blocked={reason ? true : undefined}
            tooltip={reason}
            onClick={() => {
              if (!reason) onPick(preset.value(), preset.key);
            }}
          >
            {preset.text}
            {reason && <span id={`${reasonId}-${i}`} className="aui-sr-only">（{reason}）</span>}
          </Button>
        );
      })}
      {children}
    </div>
  );
}

export type RadioOption<V extends string = string> = {
  value: V;
  label: string;
  /** Second line under the label (「按顺序一人一个」). */
  description?: string;
  disabled?: boolean;
};
export type RadioGroupProps<V extends string = string> = {
  value: V | "";
  onValueChange: (value: V) => void;
  options: readonly RadioOption<V>[];
  /** Accessible name of the group (or pass aria-labelledby, e.g. inside FormField). */
  label: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** vertical (default) or horizontal rows. */
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  className?: string;
};
/**
 * A short single choice written out as round radio dots (review family 5): the label is
 * clickable, a description goes on the line below. Arrow keys move and pick (like native radios).
 * Coloured options → ChoiceTags; options with a longer explanation as cards → ChoiceTiles.
 */
export function RadioGroup<V extends string = string>({ value, onValueChange, options, label, orientation = "vertical", disabled, className, ...aria }: RadioGroupProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = options.findIndex((o) => o.value === value);
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    for (let n = 1; n <= options.length; n += 1) {
      const i = (index + step * n + options.length) % options.length;
      const option = options[i];
      if (!option || option.disabled || disabled) continue;
      onValueChange(option.value);
      refs.current[i]?.focus();
      return;
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-labelledby"] ? undefined : label}
      aria-labelledby={aria["aria-labelledby"]}
      aria-describedby={aria["aria-describedby"]}
      className={cn("aui-radios", className)}
      data-orientation={orientation}
    >
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || option.disabled}
            tabIndex={on || (at < 0 && index === 0) ? 0 : -1}
            className="aui-radio-row"
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKey(event, index)}
          >
            <span className="aui-radio" aria-checked={on} aria-hidden="true" />
            <span className="aui-radio-text">
              {option.label}
              {option.description && <small>{option.description}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
