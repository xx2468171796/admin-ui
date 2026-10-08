"use client";
/**
 * OptionSwatchPicker: pick the colour of a select option, tag or dictionary value — ten
 * hue swatches (5 × 2, option-palette.ts) plus a 「实心」 switch for the one value that must stand out,
 * with a preview tag. `variant="button"` (default) is the small swatch square of the options editor that
 * opens the picker in a PopoverPanel; `variant="inline"` shows it directly (settings forms).
 * Old tone names (brand, warning …) are accepted as `value` and shown as their new hue.
 * Swatches are a radio group: ← → move by one, ↑ ↓ by a row, Home / End; a click picks and closes.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { PopoverPanel } from "./popover-panel.tsx";
import { Switch } from "./primitives.tsx";
import { OPTION_HUES, OPTION_HUE_LABELS, OPTION_TONE_LABELS, isSolidTone, optionTone, toneHue, withSolid, type OptionHue, type OptionHueTone, type OptionTone } from "./option-tone.ts";

export type OptionSwatchPickerProps = {
  /** Current tone (old names are read as their new hue). */
  value: OptionTone | string;
  onChange: (tone: OptionHueTone) => void;
  /** Accessible name, e.g. 「选项“高”的颜色」. */
  label: string;
  variant?: "button" | "inline";
  /** Preview text (default: the colour's name). */
  sample?: string;
  /** Offer the 「实心」 switch (default true). */
  allowSolid?: boolean;
  disabled?: boolean;
};

const COLUMNS = 5;

function SwatchGrid({ tone, onPick, label, sample, allowSolid, autoFocus, disabled }: { tone: OptionHueTone; onPick: (tone: OptionHueTone, commit: boolean) => void; label: string; sample?: string; allowSolid: boolean; autoFocus?: boolean; disabled?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const solidId = useId();
  const hue = toneHue(tone);
  const solid = isSolidTone(tone);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = OPTION_HUES.indexOf(hue);
    const n = OPTION_HUES.length;
    const next =
      event.key === "ArrowRight" ? (index + 1) % n
        : event.key === "ArrowLeft" ? (index - 1 + n) % n
          : event.key === "ArrowDown" ? (index + COLUMNS) % n
            : event.key === "ArrowUp" ? (index - COLUMNS + n) % n
              : event.key === "Home" ? 0
                : event.key === "End" ? n - 1
                  : null;
    if (next === null) return;
    event.preventDefault();
    onPick(withSolid(OPTION_HUES[next]!, solid), false);
    refs.current[next]?.focus();
  };
  return (
    <div className="aui-swatch-pick">
      <div role="radiogroup" aria-label={label} className="aui-swatch-grid" onKeyDown={onKeyDown}>
        {OPTION_HUES.map((h: OptionHue, index) => (
          <button
            key={h}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={h === hue}
            aria-label={OPTION_HUE_LABELS[h]}
            data-tip={OPTION_HUE_LABELS[h]}
            tabIndex={h === hue ? 0 : -1}
            disabled={disabled}
            data-autofocus={autoFocus && h === hue ? "" : undefined}
            className="aui-swatch-choice"
            data-tone={h}
            onClick={() => onPick(withSolid(h, solid), true)}
          />
        ))}
      </div>
      <div className="aui-swatch-side">
        <span className="aui-chip" data-tone={tone} aria-hidden="true">
          <span className="aui-chip-label">{sample ?? OPTION_TONE_LABELS[tone]}</span>
        </span>
        {allowSolid && (
          <label className="aui-swatch-solid" htmlFor={solidId}>
            <Switch id={solidId} size="sm" checked={solid} disabled={disabled} onCheckedChange={(on) => onPick(withSolid(hue, on), false)} />
            实心（只给最重要的一个值）
          </label>
        )}
      </div>
    </div>
  );
}

/** See the module comment. */
export function OptionSwatchPicker({ value, onChange, label, variant = "button", sample, allowSolid = true, disabled }: OptionSwatchPickerProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const tone = optionTone(value) ?? "gray";
  if (variant === "inline") return <SwatchGrid tone={tone} onPick={(next) => onChange(next)} label={label} sample={sample} allowSolid={allowSolid} disabled={disabled} />;
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="aui-swatch-button"
        aria-label={`${label}：${OPTION_TONE_LABELS[tone]}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="aui-swatch" data-tone={tone} aria-hidden="true" />
      </button>
      <PopoverPanel open={open} anchor={trigger.current} onClose={close} title="选项颜色" width={260}>
        <SwatchGrid
          tone={tone}
          label={label}
          sample={sample}
          allowSolid={allowSolid}
          autoFocus
          onPick={(next, commit) => {
            onChange(next);
            if (commit) close(true);
          }}
        />
      </PopoverPanel>
    </>
  );
}
