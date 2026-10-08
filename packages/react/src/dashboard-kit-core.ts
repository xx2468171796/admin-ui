/**
 * Pure geometry and maths behind the target / funnel / cohort / ring widgets (BulletBar, StepFunnel,
 * CohortTable, ProgressRing). No React, no DOM — unit-tested in test/dashboard-kit-core.test.ts.
 * Semantics follow DASHBOARDS.md: target completion is a bullet graph (Few), a missing value is "—"
 * and never 0, a cohort cell that has not reached its age is "not due" and never 0.
 */

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type BulletMarkKind = "min" | "target" | "expected" | "max";
export type BulletMark = { kind: BulletMarkKind; at: number; ratio: number };
export type BulletGeometry = {
  /** Scale start and end (end ≥ target and ≥ value unless `max` was given). */
  min: number;
  max: number;
  /** Filled share of the track, 0..1 (null value → null: nothing drawn, never a 0-width bar). */
  value: number | null;
  /** Target tick position 0..1. */
  target: number | null;
  /** 「Expected by now」 = min + (target − min) × timeProgress, position 0..1. */
  expected: number | null;
  expectedValue: number | null;
  /** Qualitative band ends (0..1), ascending, last one is always 1. */
  bands: number[];
  /** value ≥ target. */
  reached: boolean;
  /** value < expected by now (only when a time marker is given). */
  behind: boolean;
};

/**
 * Bullet-graph geometry. The scale starts at `min` (default 0) and ends at `max`, or — when no max is
 * given — at the larger of target and value so the target tick sits at the right end (D30 / D31).
 */
export function bulletGeometry(input: {
  value: number | null | undefined;
  target?: number | null;
  max?: number | null;
  min?: number;
  timeProgress?: number | null;
  bands?: readonly number[];
}): BulletGeometry {
  const min = finite(input.min) ? input.min : 0;
  const target = finite(input.target) ? input.target : null;
  const value = finite(input.value) ? input.value : null;
  const auto = Math.max(target ?? -Infinity, value ?? -Infinity);
  let max = finite(input.max) ? input.max : Number.isFinite(auto) ? auto : min + 1;
  if (max <= min) max = min + 1;
  const pos = (v: number) => clamp01((v - min) / (max - min));
  const tp = finite(input.timeProgress) ? clamp01(input.timeProgress) : null;
  const expectedValue = tp !== null && target !== null ? min + (target - min) * tp : null;
  const bands = [...(input.bands ?? [])].filter(finite).map(pos).filter((b) => b > 0 && b < 1).sort((a, b) => a - b);
  return {
    min,
    max,
    value: value === null ? null : pos(value),
    target: target === null ? null : pos(target),
    expected: expectedValue === null ? null : pos(expectedValue),
    expectedValue,
    bands: [...new Set(bands), 1],
    reached: value !== null && target !== null && value >= target,
    behind: value !== null && expectedValue !== null && value < expectedValue,
  };
}

/**
 * Which scale labels fit under a bullet: priority target → expected → min → max; a label whose
 * position is closer than `gap` (share of width) to an already kept one is dropped.
 */
export function bulletLabels(geometry: BulletGeometry, gap = 0.16): BulletMark[] {
  const wanted: BulletMark[] = [];
  if (geometry.target !== null) wanted.push({ kind: "target", at: geometry.min + (geometry.max - geometry.min) * geometry.target, ratio: geometry.target });
  if (geometry.expected !== null && geometry.expectedValue !== null) wanted.push({ kind: "expected", at: geometry.expectedValue, ratio: geometry.expected });
  wanted.push({ kind: "min", at: geometry.min, ratio: 0 });
  if (geometry.target === null || geometry.target < 1) wanted.push({ kind: "max", at: geometry.max, ratio: 1 });
  const kept: BulletMark[] = [];
  // The scale end is the least useful label and sits next to an end-aligned target text: it needs twice the gap.
  for (const mark of wanted) if (kept.every((k) => Math.abs(k.ratio - mark.ratio) >= (mark.kind === "max" ? gap * 2 : gap))) kept.push(mark);
  return kept.sort((a, b) => a.ratio - b.ratio);
}

export type FunnelStepInput = { count: number | null | undefined };
export type FunnelStepStats = {
  /** count ÷ previous step's count (null for the first step or a missing side). */
  stepRate: number | null;
  /** count ÷ first step's count. */
  overallRate: number | null;
  /** Customers lost since the previous step (≥ 0), null when unknown. */
  lost: number | null;
  /** Bar width 0..1 relative to the first step. */
  width: number;
};

/**
 * Funnel maths: step conversion, overall conversion and the step that loses the most. `dropBy`
 * "count" (default) marks the largest absolute loss (D30 「流失最多」), "rate" the lowest step rate.
 */
export function funnelStats(steps: readonly FunnelStepInput[], dropBy: "count" | "rate" = "count") {
  const first = steps[0]?.count;
  const base = finite(first) && first > 0 ? first : null;
  const stats: FunnelStepStats[] = steps.map((step, i) => {
    const count = finite(step.count) ? step.count : null;
    const prev = i > 0 && finite(steps[i - 1]!.count) ? (steps[i - 1]!.count as number) : null;
    return {
      stepRate: i === 0 || count === null || prev === null || prev <= 0 ? null : count / prev,
      overallRate: count === null || base === null ? null : count / base,
      lost: i === 0 || count === null || prev === null ? null : Math.max(0, prev - count),
      width: count === null || base === null ? 0 : clamp01(count / base),
    };
  });
  let biggestDrop: number | null = null;
  stats.forEach((s, i) => {
    if (i === 0) return;
    const score = dropBy === "count" ? s.lost : s.stepRate === null ? null : 1 - s.stepRate;
    if (score === null || score <= 0) return;
    const best = biggestDrop === null ? null : dropBy === "count" ? stats[biggestDrop]!.lost : 1 - (stats[biggestDrop]!.stepRate ?? 1);
    if (best === null || score > best) biggestDrop = i;
  });
  const last = steps.length ? steps[steps.length - 1]!.count : null;
  return { steps: stats, biggestDrop, overall: base !== null && finite(last) ? last / base : null };
}

/**
 * Heat shading for a cohort cell in the brand hue: the share of brand colour mixed into the panel colour
 * (8 … 92 % by default, 审阅 06 — dark mode starts at the panel too) and whether the text must switch to
 * white: only cells deeper than 72 % (light mode; dark mode keeps dark text on the lifted primary).
 * Null / not-due → null; an all-zero (or empty) scale gives every real value the floor shade.
 */
export function cohortShade(value: number | null | undefined, max: number, options: { floor?: number; ceil?: number } = {}) {
  if (!finite(value)) return null;
  // 审阅 06：面板色 → 主色（深色也从面板色起步）；只有很深的格子（> 72%）才反白字。
  const { floor = 8, ceil = 92 } = options;
  if (!(max > 0)) return { percent: floor, onBrand: floor > 72 };
  const percent = Math.round(floor + clamp01(value / max) * (ceil - floor));
  return { percent, onBrand: percent > 72 };
}

/** Largest finite value in a cohort matrix (the colour scale end). */
export function cohortMax(rows: readonly (readonly (number | null | undefined)[])[]): number {
  let max = 0;
  for (const row of rows) for (const v of row) if (finite(v) && v > max) max = v;
  return max;
}

/**
 * Ring geometry for ProgressRing: circumference, the dash for the progress arc and the target
 * tick's end points (angle 0 = 12 o'clock, clockwise), in a `size`×`size` viewBox.
 */
export function ringGeometry(input: { value: number | null | undefined; max: number; target?: number | null; size?: number; stroke?: number }) {
  const size = input.size ?? 92;
  const stroke = input.stroke ?? 9;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const max = input.max > 0 ? input.max : 1;
  const ratio = finite(input.value) ? clamp01(input.value / max) : null;
  const center = size / 2;
  let tick: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (finite(input.target)) {
    const angle = clamp01(input.target / max) * 2 * Math.PI - Math.PI / 2;
    const inner = r - stroke / 2 - 3;
    const outer = r + stroke / 2 + 3;
    const round = (n: number) => Math.round(n * 100) / 100;
    tick = { x1: round(center + inner * Math.cos(angle)), y1: round(center + inner * Math.sin(angle)), x2: round(center + outer * Math.cos(angle)), y2: round(center + outer * Math.sin(angle)) };
  }
  return { size, stroke, r, center, circumference: c, ratio, dash: ratio === null ? 0 : ratio * c, tick };
}
