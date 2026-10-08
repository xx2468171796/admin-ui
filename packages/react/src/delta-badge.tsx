"use client";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { deltaTone, type Better, type Delta } from "./dashboard-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

const TONE_WORD = { good: "向好", bad: "变差", neutral: "" } as const;
const DIRECTION_WORD = { up: "上升", down: "下降", flat: "持平" } as const;

export type DeltaBadgeProps = {
  /** From computeDelta(current, previous, { better, mode }). null = a comparison exists but data is missing → 「—」. */
  delta: Delta | null | undefined;
  /** What it compares against (「比上周同一天」「比目标」) — spoken with the change; shown by the host next to the badge. */
  comparison?: string;
  /** Unit after the change text for absolute deltas: 「+6 分」「−2 位」「+1 有效」. Not added to 「持平」 / 「新增」. */
  unit?: string;
  /** sm = compact chip for table cells and metric strips (18px). */
  size?: "md" | "sm";
  /**
   * The metric's direction when the badge should judge it itself: "down" = lower is better (response time,
   * churn, overdue) so a decrease is good; "neutral" = never good / bad. Omitted = the delta's own tone
   * (computeDelta's `better`, default higher-is-better).
   */
  better?: Better;
};

/**
 * Change chip (DASHBOARDS.md §4, §12.1): arrow = direction, colour = good / bad from the metric's
 * `better` (never from up / down), text always present — colour is not the only carrier. Rates use
 * percentage points (`mode: "points"` → 「+1.2pp」), growth from zero reads 「新增」, never ∞ %.
 */
export function DeltaBadge({ delta, comparison, unit, size = "md", better }: DeltaBadgeProps) {
  const small = size === "sm" ? "sm" : undefined;
  if (!delta)
    return (
      <span className="aui-delta aui-delta-none" data-size={small} aria-label={comparison ? `${comparison}：无对比数据` : "无对比数据"}>
        —
      </span>
    );
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
  const numeric = delta.value !== null && delta.direction !== "flat";
  const text = unit && numeric ? `${delta.text} ${unit}` : delta.text;
  const tone = better ? deltaTone(delta.direction, better) : delta.tone;
  const spoken = [comparison, DIRECTION_WORD[delta.direction], text, TONE_WORD[tone]].filter(Boolean).join(" ");
  return (
    <span className={`aui-delta aui-delta-${tone}`} data-size={small} aria-label={spoken} role="img">
      <Icon size={small ? 12 : 14} aria-hidden="true" />
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
