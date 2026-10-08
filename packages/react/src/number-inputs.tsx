"use client";
/**
 * Number family (review 「数字、金额、电话、百分比」): NumberInput (tabular digits,
 * left in forms / right in tables, small ↑ ↓ arrows on hover / focus, ↑ ↓ keys with Shift ×10, parse on
 * blur), MoneyInput (currency as an in-field segment, plain digits while typing, thousands separators on
 * blur, value in minor units, 「约 US$ 8.6 万」 hint) and PercentBar (「60%」 + a 56 × 4 bar for cells).
 * The in-field segment picker (currency here, country code in phone-input.tsx) is SegmentPicker.
 * PhoneInput lives in phone-input.tsx, Slider / PercentInput in slider.tsx. Rules in number-input-core.ts.
 */
import { useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn, Input } from "./primitives.tsx";
import { tipProps } from "./tooltip.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import { OptionList, SelectSearch, type SelectItem } from "./option-list.tsx";
import { showsSearch } from "./option-list-core.ts";
import { useOptionNav } from "./use-option-nav.ts";
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import {
  approxMoney,
  clampNumber,
  MONEY_CURRENCIES,
  minorToMoneyText,
  moneyTextToMinor,
  numberDisplayText,
  parseNumberText,
  percentText,
  sliderRatio,
  stepKeyTimes,
  stepValue,
  type MoneyCurrency,
} from "./number-input-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";

type FieldAria = {
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

type BoxProps = FieldAria & {
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  /** sm 28 (filters, cells) · md 36 (default; 40 on phones, 44 on public pages). */
  size?: "sm" | "md";
  /** left (forms, default) · right (tables, totals). */
  align?: "left" | "right";
  autoFocus?: boolean;
  className?: string;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  inputRef?: (node: HTMLInputElement | null) => void;
};

// ---------------------------------------------------------------- NumberInput

export type NumberInputProps = BoxProps & {
  value: number | null;
  /** Called with the parsed number while typing (when it parses) and the clamped one on blur / Enter / arrows. */
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Step of ↑ ↓ and the arrows (default 1); Shift / PageUp / PageDown step ×10. */
  step?: number;
  /** Fraction digits kept (rounded on blur) and shown when not focused. */
  precision?: number;
  /** Unit inside the box on the right (「%」「坪」「天」). */
  unit?: ReactNode;
  /** Inside the box on the left (an icon, 「US$」 for a table editor). */
  prefix?: ReactNode;
  /** An in-field segment on the left (see SegmentPicker). */
  segment?: ReactNode;
  /** The small ↑ ↓ arrows on hover / focus (default true; false in table editors). */
  spin?: boolean;
  /** Thousands separators when not focused (default false). */
  thousands?: boolean;
  /** Out-of-range typing is clamped on blur (default true); false keeps it so the host can show an error. */
  clamp?: boolean;
};

/**
 * A number box: tabular digits, plain text while typing (「1,200」 and full-width digits accepted), the
 * value parses on blur / Enter (clamped to min / max, rounded to `precision`); ↑ ↓ step (Shift ×10).
 * For 1–30 small integers with − / + use NumberStepper; for money MoneyInput; for 0–100 PercentInput.
 */
export function NumberInput(props: NumberInputProps) {
  const { value, onChange, min, max, step = 1, precision, unit, prefix, segment, spin = true, thousands, clamp = true, align = "left", className } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const own = useRef<HTMLInputElement | null>(null);
  const locked = Boolean(props.disabled || props.readOnly);
  const settle = (n: number | null) => (n === null || !clamp ? n : clampNumber(n, min, max));
  const commit = () => {
    if (draft === null) return;
    const parsed = parseNumberText(draft, precision);
    setDraft(null);
    if (parsed === undefined) return; // not a number: back to the last value
    const next = settle(parsed);
    if (next !== value) onChange(next);
  };
  const bump = (times: number) => {
    if (locked) return;
    const base = draft !== null ? parseNumberText(draft, precision) : value;
    const next = stepValue(base === undefined ? value : base, step, times, min, max, precision);
    setDraft(document.activeElement === own.current ? String(next) : null);
    if (next !== value) onChange(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const times = stepKeyTimes(event.key, event.shiftKey);
    if (times) {
      event.preventDefault();
      bump(times);
    } else if (event.key === "Enter") commit();
    else if (event.key === "Escape" && draft !== null) {
      event.preventDefault();
      setDraft(null);
    }
  };
  // While focused the box holds plain text (draft); otherwise the formatted value.
  const shown = draft ?? numberDisplayText(value, { precision, thousands });
  const spinner = spin && !locked ? <SpinArrows step={step} onStep={bump} focus={() => own.current?.focus({ preventScroll: true })} /> : null;
  const suffix = numberSuffix(unit, spinner);
  const boxed = Boolean(prefix || segment || suffix);
  return (
    <Input
      ref={(node) => {
        own.current = node;
        props.inputRef?.(node);
      }}
      {...boxBase(props)}
      role="spinbutton"
      aria-valuenow={value ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      inputMode={precision === 0 && (min ?? 0) >= 0 ? "numeric" : "decimal"}
      prefix={prefix}
      segment={segment}
      suffix={suffix}
      className={cn("aui-num-input", !boxed && align === "right" && "aui-num-right", !boxed && className)}
      boxClassName={cn("aui-num", align === "right" && "aui-num-right", className)}
      value={shown}
      onFocus={(event) => {
        setDraft((d) => d ?? numberDisplayText(value));
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = parseNumberText(text, precision);
        if (parsed !== undefined && parsed !== value) onChange(parsed);
      }}
      onBlur={(event) => {
        commit();
        props.onBlur?.(event);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

/** Id, names, aria and state props every box of the family passes to Input. */
function boxBase(p: BoxProps) {
  return {
    id: p.id,
    name: p.name,
    "aria-label": p["aria-label"],
    "aria-labelledby": p["aria-labelledby"],
    "aria-describedby": p["aria-describedby"],
    "aria-invalid": p["aria-invalid"],
    autoComplete: "off",
    size: p.size,
    disabled: p.disabled,
    readOnly: p.readOnly,
    placeholder: p.placeholder,
    autoFocus: p.autoFocus,
  };
}

/** Unit + arrows at the right end (undefined = nothing there, so the plain input stays unwrapped). */
function numberSuffix(unit: ReactNode, spinner: ReactNode): ReactNode {
  if (unit === undefined && !spinner) return undefined;
  return (
    <>
      {unit !== undefined && <span className="aui-num-unit">{unit}</span>}
      {spinner}
    </>
  );
}

/** The small ↑ ↓ pair at the right end of a number box (hover / focus only, via CSS). */
function SpinArrows({ step, onStep, focus }: { step: number; onStep: (times: number) => void; focus: () => void }) {
  const press = (times: number) => (event: { preventDefault: () => void }) => {
    event.preventDefault(); // keep the caret in the box
    focus();
    onStep(times);
  };
  return (
    <span className="aui-num-spin">
      <button type="button" tabIndex={-1} aria-label={`加 ${step}`} {...tipProps(`加 ${step}`, "↑")} onPointerDown={press(1)}>
        <ChevronUp aria-hidden="true" />
      </button>
      <button type="button" tabIndex={-1} aria-label={`减 ${step}`} {...tipProps(`减 ${step}`, "↓")} onPointerDown={press(-1)}>
        <ChevronDown aria-hidden="true" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------- SegmentPicker

export type SegmentPickerProps = {
  /** What the segment picks (「币种」「国家 / 地区」): button name and popover title. */
  label: string;
  value: string;
  /** Text in the segment (「US$」「+44」). */
  display: ReactNode;
  options: readonly SelectItem[];
  onPick: (value: string) => void;
  /** The whole box: the list hangs under it. */
  anchor: () => HTMLElement | null;
  disabled?: boolean;
  /** Static (fixed by the field settings): a plain span, not a button. */
  readOnly?: boolean;
  /** Called after the list closed (focus goes back to the number). */
  onClosed?: () => void;
};

/**
 * The part of a box you pick (currency, country code): a button with a ⌄ and a line after it, opening the
 * approved option list (search when > 6, tick on the right; a bottom sheet on phones). Read-only = a span.
 */
export function SegmentPicker({ label, value, display, options, onPick, anchor, disabled, readOnly, onClosed }: SegmentPickerProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);
  const name = `${label}：${current ? `${current.label}${current.hint ? ` ${current.hint}` : ""}` : value}`;
  if (readOnly) return <span className="aui-input-seg" aria-label={name}>{display}</span>;
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) onClosed?.();
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        className="aui-input-seg"
        aria-label={name}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        {...tipProps(`换${label}`)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {display}
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <SegmentList
          label={label}
          options={options}
          value={value}
          anchor={anchor() ?? button.current}
          onPick={(next) => {
            if (next !== value) onPick(next);
            close(true);
          }}
          onClose={close}
        />
      )}
    </>
  );
}

function SegmentList({ label, options, value, anchor, onPick, onClose }: { label: string; options: readonly SelectItem[]; value: string; anchor: HTMLElement | null; onPick: (value: string) => void; onClose: (returnFocus: boolean) => void }) {
  const nav = useOptionNav({ options, selected: [value], onPick });
  const search = showsSearch(options.length, "auto");
  return (
    <PopoverLayer
      open
      anchor={anchor}
      label={`选择${label}`}
      onClose={onClose}
      className="aui-popover aui-select-pop aui-seg-pop"
      sheet={{ title: label, end: <button type="button" className="aui-sheet-action" data-muted="" onClick={() => onClose(true)}>取消</button> }}
    >
      {search && (
        <SelectSearch value={nav.query} onChange={nav.setQuery} label={`搜索${label}`} listId={nav.listId} activeId={nav.activeId} onKeyDown={(event) => nav.onKeyDown(event, { search: true })} />
      )}
      <OptionList
        id={nav.listId}
        label={label}
        options={nav.shown}
        selected={[value]}
        active={nav.active}
        onActive={nav.setActive}
        onPick={onPick}
        emptyText={nav.query.trim() ? `没有匹配「${nav.query.trim()}」的${label}` : "没有可选的"}
        focusable={!search}
        onKeyDown={search ? undefined : (event) => nav.onKeyDown(event, { search: false })}
      />
    </PopoverLayer>
  );
}

// ---------------------------------------------------------------- MoneyInput

export type MoneyInputProps = BoxProps & {
  /** Minor units (1/100 of the major unit, like the grid's money fields): US$ 86,000 = 8600000. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Currency code of the value (「USD」), or a symbol for a currency not in the list (default: AdminProvider `defaults.currency`, else none). */
  currency?: string;
  /** Show the currency picker in the segment; without it the currency is static (fixed by the field). */
  onCurrencyChange?: (code: string, currency: MoneyCurrency) => void;
  currencies?: readonly MoneyCurrency[];
  /** Digits typed and shown (default: the currency's, else 2). Values stay in minor units. */
  precision?: number;
  /** 「约 US$ 8.6 万」 under the box from 10,000 (default true in forms, false when `align="right"`). */
  hint?: boolean;
  /** Negative amounts allowed (default false: a 「-」 is refused). */
  allowNegative?: boolean;
  /** Where the currency sits: an in-field segment (default) or a plain prefix (table editors). */
  currencyAs?: "segment" | "prefix";
};

const findCurrency = (code: string | undefined, list: readonly MoneyCurrency[]): MoneyCurrency | undefined =>
  code ? list.find((c) => c.code === code || c.symbol === code) : undefined;

/**
 * Money: the currency is a segment of the box (a picker when `onCurrencyChange` is given, else static),
 * typing is plain digits, thousands separators come back on blur, the value is minor units. From 10,000
 * a hint 「约 US$ 8.6 万」 shows under it. `align="right"` for tables.
 */
export function MoneyInput(props: MoneyInputProps) {
  const { value, onChange, currency, onCurrencyChange, currencies = MONEY_CURRENCIES, align = "left", allowNegative, currencyAs = "segment" } = props;
  const fallbackCurrency = useAdminDefaults().currency;
  const code = currency ?? (fallbackCurrency || undefined);
  const cur = findCurrency(code, currencies);
  const symbol = cur?.symbol ?? code ?? "";
  const precision = props.precision ?? cur?.precision ?? 2;
  const [draft, setDraft] = useState<string | null>(null);
  const box = useRef<HTMLInputElement | null>(null);
  const hintOn = props.hint ?? align !== "right";
  const commit = () => {
    if (draft === null) return;
    const parsed = moneyTextToMinor(draft, precision);
    setDraft(null);
    if (parsed === undefined || (!allowNegative && parsed !== null && parsed < 0)) return;
    if (parsed !== value) onChange(parsed);
  };
  const focused = draft !== null;
  const shown = draft ?? minorToMoneyText(value, precision, true);
  const live = draft !== null ? moneyTextToMinor(draft, precision) : value;
  const approx = hintOn && live !== null && live !== undefined ? approxMoney(live / 100, symbol) : null;
  const anchor = () => box.current?.closest<HTMLElement>(".aui-input-box") ?? null;
  const segment = currencyAs === "segment" && (symbol || onCurrencyChange) ? (
    <SegmentPicker
      label="币种"
      value={cur?.code ?? symbol}
      display={symbol || "币种"}
      options={currencies.map((c) => ({ value: c.code, label: c.label, hint: `${c.symbol} · ${c.precision ? `${c.precision} 位小数` : "整数"}` }))}
      onPick={(code) => {
        const next = currencies.find((c) => c.code === code);
        if (next) onCurrencyChange?.(code, next);
      }}
      anchor={anchor}
      readOnly={!onCurrencyChange}
      disabled={props.disabled || props.readOnly}
      onClosed={() => box.current?.focus({ preventScroll: true })}
    />
  ) : undefined;
  const input = (
    <Input
      ref={(node) => {
        box.current = node;
        props.inputRef?.(node);
      }}
      {...boxBase(props)}
      inputMode={precision > 0 ? "decimal" : "numeric"}
      placeholder={props.placeholder ?? (precision > 0 ? "0.00" : "0")}
      segment={segment}
      prefix={currencyAs === "prefix" && symbol ? symbol : undefined}
      className="aui-num-input"
      boxClassName={cn("aui-num aui-money", align === "right" && "aui-num-right", props.className)}
      value={shown}
      onFocus={(event) => {
        setDraft((d) => d ?? minorToMoneyText(value, precision).replace(/\.0+$/, ""));
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.target.value.replace(allowNegative ? /[^\d.,，\-－０-９．]/g : /[^\d.,，０-９．]/g, "");
        setDraft(text);
        const parsed = moneyTextToMinor(text, precision);
        if (parsed !== undefined && parsed !== value && (allowNegative || parsed === null || parsed >= 0)) onChange(parsed);
      }}
      onBlur={(event) => {
        commit();
        props.onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        else if (event.key === "Escape" && focused) {
          event.preventDefault();
          setDraft(null);
        }
      }}
    />
  );
  if (!hintOn) return input;
  return (
    <span className="aui-money-wrap">
      {input}
      <span className="aui-money-hint" aria-live="polite">{approx}</span>
    </span>
  );
}

// ---------------------------------------------------------------- PercentBar

export type PercentBarProps = {
  /** 0–100 (null = empty 「—」). */
  value: number | null;
  /** Fraction digits of the text (default 0). */
  precision?: number;
  /** The 56 × 4 bar (default true). */
  bar?: boolean;
  /** Accessible prefix (「赢率」). */
  label?: string;
  className?: string;
};

/** 「60%」 + a 56px × 4px thin bar (main colour, no colour by level) — cells, cards, read-only fields. */
export function PercentBar({ value, precision = 0, bar = true, label, className }: PercentBarProps) {
  if (value === null || !Number.isFinite(value)) return <span className="aui-cell-empty">—</span>;
  const text = percentText(value, precision);
  return (
    <span className={cn("aui-pct", className)} role="img" aria-label={label ? `${label} ${text}` : text}>
      {bar && (
        <span className="aui-pct-bar" aria-hidden="true">
          <i style={{ width: `${sliderRatio(value, 0, 100) * 100}%` }} />
        </span>
      )}
      <span className="aui-pct-text" aria-hidden="true">{text}</span>
    </span>
  );
}
