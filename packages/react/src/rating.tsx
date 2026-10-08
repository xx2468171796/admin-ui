"use client";
/**
 * Rating: solid stars in the attention colour, unlit ones light grey and
 * solid too, hover preview, words like 「较高」 at form size. Rules in atoms-core.ts. Also exported from atoms.tsx.
 */
import { useState } from "react";
import { Star } from "lucide-react";
import { ratingKey, ratingText, ratingWord } from "./atoms-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";

export type RatingProps = {
  value: number | null;
  /** Number of stars (default 5). */
  max?: number;
  /** Accessible name (「意向」). */
  label: string;
  /** Omit for display only. */
  onChange?: (value: number | null) => void;
  /** Clicking the current value / Home clears it (default true). */
  allowClear?: boolean;
  disabled?: boolean;
  /** sm 13px (cells; default) · md 18px (forms). */
  size?: "sm" | "md";
  /**
   * Words for 1…max (「很低」「较低」「一般」「较高」「很高」): read out with the stars and, at md size, written
   * after them (「未评」 when empty) so the value doesn't depend on colour.
   */
  labels?: readonly string[];
};
/**
 * Solid stars in the attention colour, unlit ones light grey and solid too.
 * Display: one image named 「4 星（满分 5）」. Input: one slider (Tab stop) — ← → / ↑ ↓ change,
 * Home clears, End = max, digits set; hover previews (lighter), clicking the current star clears.
 */
export function Rating({ value, max = 5, label, onChange, allowClear = true, disabled, size = "sm", labels }: RatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const word = ratingWord(hover ?? value, labels);
  const stars = Array.from({ length: max }, (_, i) => (
    <Star key={i} className="aui-rating-star" data-on={i < shown || undefined} data-pre={(hover !== null && i < hover && i >= (value ?? 0)) || undefined} aria-hidden="true" />
  ));
  const text = labels?.length && size === "md" ? <span className="aui-rating-word" aria-hidden="true">{word}</span> : null;
  const spoken = ratingText(value, max) + (value && word ? ` · ${word}` : "");
  if (!onChange)
    return (
      <span className="aui-rating" data-size={size} role="img" aria-label={`${label}：${spoken}`}>
        {stars}
        {text}
      </span>
    );
  return (
    <span
      className="aui-rating"
      data-size={size}
      data-input
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value ?? 0}
      aria-valuetext={spoken}
      aria-disabled={disabled || undefined}
      onKeyDown={(event) => {
        if (disabled) return;
        const next = ratingKey(value, event.key, max, allowClear);
        if (next === undefined) return;
        event.preventDefault();
        if (next !== value) onChange(next);
      }}
      onPointerLeave={() => setHover(null)}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="aui-rating-hit"
          onPointerEnter={() => !disabled && setHover(i + 1)}
          onClick={() => {
            if (disabled) return;
            const next = allowClear && value === i + 1 ? null : i + 1;
            setHover(null);
            onChange(next);
          }}
        >
          {stars[i]}
        </span>
      ))}
      {text}
    </span>
  );
}
