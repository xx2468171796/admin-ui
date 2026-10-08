/**
 * Dashboard math shared by KpiCard / charts / host services. Pure functions, no React/DOM.
 * Semantics follow DASHBOARDS.md: good/bad colour comes from the metric's direction, not from up/down;
 * rates compare in percentage points; probability metrics are judged against σ/√N bands, never a fixed %.
 */

import { MINUS } from "./format.ts";

export type Better = "up" | "down" | "neutral";
export type DeltaMode = "relative" | "points" | "absolute";
export type Delta = {
  /** Arrow direction of the raw change. */
  direction: "up" | "down" | "flat";
  /** Colour semantics after applying the metric's `better`. */
  tone: "good" | "bad" | "neutral";
  /** Ready-to-render text such as "+12.3%", "−1.2pp", "+1,204", "新增". */
  text: string;
  /** Raw numeric change in the requested mode (ratio for relative, points for points). */
  value: number | null;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const signed = (n: number, body: string) => (n > 0 ? "+" : n < 0 ? MINUS : "") + body;

/**
 * Compare current with previous.
 * - relative: (cur − prev) / |prev|, text in %; prev = 0 and cur ≠ 0 → "新增" (growth from zero has no %).
 * - points:   for ratios stored as 0..1 (conversion, hit rate …), change in percentage points ("pp").
 * - absolute: plain difference, formatted with `formatNumber`.
 * Returns null when either side is missing: a missing comparison must render as "—", never as 0%.
 */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  options: { better?: Better; mode?: DeltaMode; digits?: number; flatBelow?: number } = {},
): Delta | null {
  if (!finite(current) || !finite(previous)) return null;
  const { better = "up", mode = "relative", digits = 1 } = options;
  let value: number | null;
  let text: string;
  if (mode === "relative") {
    if (previous === 0) {
      if (current === 0) return { direction: "flat", tone: "neutral", text: "0%", value: 0 };
      value = null;
      text = current > 0 ? "新增" : "由零转负";
    } else if (previous < 0 !== current < 0 && current !== 0) {
      // Crossing zero (loss → profit) has no meaningful %; "+300%" there is a lie.
      value = null;
      text = current > 0 ? "由负转正" : "由正转负";
    } else {
      value = (current - previous) / Math.abs(previous);
      text = signed(round(value, digits + 2), `${formatFixed(Math.abs(value) * 100, digits)}%`);
    }
  } else if (mode === "points") {
    value = (current - previous) * 100;
    text = signed(round(value, digits), `${formatFixed(Math.abs(value), digits)}pp`);
  } else {
    value = current - previous;
    text = signed(value, formatNumber(Math.abs(value), { digits }));
  }
  const raw = value ?? current - previous;
  const flatBelow = options.flatBelow ?? (mode === "relative" ? 0.0005 : 0);
  const flat = value !== null ? Math.abs(raw) <= flatBelow : raw === 0;
  const direction = flat ? "flat" : raw > 0 ? "up" : "down";
  if (flat) text = "持平";
  return { direction, tone: deltaTone(direction, better), text, value };
}

/**
 * Good / bad of a change from the metric's `better` (higher-is-better "up", lower-is-better "down", e.g.
 * response time): never from the arrow alone. Flat and neutral metrics are neutral.
 */
export function deltaTone(direction: Delta["direction"], better: Better = "up"): Delta["tone"] {
  if (direction === "flat" || better === "neutral") return "neutral";
  return (direction === "up") === (better === "up") ? "good" : "bad";
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
// Intl number formatters are expensive to create (toLocaleString with options builds one per
// call): cache one per fraction-digit setting so 100k table cells stay fast.
const NUMBER_STYLES = new Map<string, Intl.NumberFormat>();
function numberStyle(min: number, max: number) {
  const key = min + "|" + max;
  let style = NUMBER_STYLES.get(key);
  if (!style) {
    style = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: min, maximumFractionDigits: max });
    NUMBER_STYLES.set(key, style);
  }
  return style;
}
function formatFixed(n: number, digits: number) {
  return numberStyle(digits, digits).format(round(n, digits));
}

/**
 * Chinese-friendly number formatting. `compact` switches to 万 / 亿 at 10⁴ / 10⁸ (deterministic,
 * unlike Intl compact notation which differs between engines). Negative numbers use the true
 * minus sign (U+2212) so columns of tabular numerals stay aligned.
 */
export function formatNumber(
  value: number | null | undefined,
  options: { digits?: number; compact?: boolean } = {},
): string {
  if (!finite(value)) return "—";
  const { digits = 0, compact = false } = options;
  const abs = Math.abs(value);
  let body: string;
  if (compact && abs >= 1e8) body = `${trimZeros(formatFixed(abs / 1e8, Math.max(digits, 2)))}亿`;
  else if (compact && abs >= 1e4) body = `${trimZeros(formatFixed(abs / 1e4, Math.max(digits, 1)))}万`;
  else
    body = numberStyle(0, digits).format(abs);
  return value < 0 && body !== "0" ? MINUS + body : body;
}
const trimZeros = (s: string) => (s.includes(".") ? s.replace(/\.?0+$/, "") : s);

/** Largest-remainder rounding so displayed shares always sum to exactly 100. */
export function roundShares(values: readonly number[], digits = 0): number[] {
  const total = values.reduce((s, v) => s + (finite(v) && v > 0 ? v : 0), 0);
  if (total <= 0) return values.map(() => 0);
  const scale = 10 ** digits;
  const raw = values.map((v) => ((finite(v) && v > 0 ? v : 0) / total) * 100 * scale);
  const floors = raw.map(Math.floor);
  let rest = 100 * scale - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest--;
  }
  return floors.map((v) => v / scale);
}

// ---------------------------------------------------------------- probability / observed ratios

/** Effective sample size for unequal stakes: (Σb)² / Σb². Equal stakes → N; one huge stake → ≈1. */
export function effectiveSampleSize(sumStake: number, sumStakeSquared: number): number {
  if (!finite(sumStake) || !finite(sumStakeSquared) || sumStake <= 0 || sumStakeSquared <= 0) return 0;
  return (sumStake * sumStake) / sumStakeSquared;
}

/** z for 95% two-sided and the 99.8% control limit used by funnel plots (Spiegelhalter 2005). */
export const Z95 = 1.96;
export const Z998 = 3.09;

/** Expected-value band: theoretical ± z·σ/√n. σ is the per-round standard deviation in units of stake. */
export function toleranceBand(theoretical: number, sigma: number, n: number, z = Z95) {
  if (!finite(theoretical) || !finite(sigma) || !finite(n) || n <= 0 || sigma < 0) return null;
  const half = (z * sigma) / Math.sqrt(n);
  return { lower: theoretical - half, upper: theoretical + half, half };
}

/** Rounds needed so the band half-width is ≤ tolerance: (z·σ/E)². Halving E needs 4× rounds. */
export function roundsForTolerance(sigma: number, tolerance: number, z = Z95) {
  if (!finite(sigma) || !finite(tolerance) || tolerance <= 0) return Infinity;
  return Math.ceil(((z * sigma) / tolerance) ** 2);
}

export type BandVerdict = {
  z: number | null;
  level: "insufficient" | "normal" | "watch" | "alert";
};
/**
 * Judge an observed ratio (e.g. an actual hit or payout rate) against theory. Below `minN` → "insufficient"
 * (grey, never alert). |z| ≤ 1.96 normal; ≤ 3.09 watch (record, do not page); beyond → alert.
 * A single "alert" is a reason to look, not proof of a fault — escalate only on persistence.
 */
export function judgeAgainstBand(
  observed: number | null | undefined,
  theoretical: number,
  sigma: number,
  n: number,
  minN = 1000,
): BandVerdict {
  if (!finite(observed) || !finite(n) || n < minN || !(sigma > 0)) return { z: null, level: "insufficient" };
  const z = (observed - theoretical) / (sigma / Math.sqrt(n));
  const a = Math.abs(z);
  return { z, level: a <= Z95 ? "normal" : a <= Z998 ? "watch" : "alert" };
}

/** Control-limit curves for a funnel plot, sampled log-evenly between nMin and nMax. */
export function funnelLimits(
  theoretical: number,
  sigma: number,
  nMin: number,
  nMax: number,
  points = 60,
  zs: readonly number[] = [Z95, Z998],
) {
  const lo = Math.max(1, nMin);
  const hi = Math.max(lo + 1, nMax);
  const ns = Array.from({ length: points }, (_, i) => lo * (hi / lo) ** (i / (points - 1)));
  return zs.map((z) => ({
    z,
    upper: ns.map((n) => [n, theoretical + (z * sigma) / Math.sqrt(n)] as [number, number]),
    lower: ns.map((n) => [n, theoretical - (z * sigma) / Math.sqrt(n)] as [number, number]),
  }));
}

// ---------------------------------------------------------------- freshness & time

export type Freshness = "live" | "delayed" | "down" | "unknown";
/**
 * live ≤ 2× interval; delayed ≤ downAfter; down beyond. Age is measured from the data's own
 * timestamp (watermark / snapshot ts), not from when the request finished. Pass `clockOffsetMs`
 * (serverNow − clientNow, e.g. from the HTTP Date header) to cancel client clock skew.
 */
export function freshnessOf(
  dataTime: string | number | Date | null | undefined,
  intervalMs: number,
  options: { now?: number; clockOffsetMs?: number; downAfterMs?: number } = {},
): { state: Freshness; ageMs: number | null } {
  if (dataTime == null) return { state: "unknown", ageMs: null };
  const t = dataTime instanceof Date ? dataTime.getTime() : typeof dataTime === "number" ? dataTime : Date.parse(dataTime);
  if (!finite(t)) return { state: "unknown", ageMs: null };
  const now = (options.now ?? Date.now()) + (options.clockOffsetMs ?? 0);
  const ageMs = Math.max(0, now - t);
  const delayedAfter = Math.max(2 * intervalMs, 1000);
  const downAfter = options.downAfterMs ?? Math.max(5 * intervalMs, 15_000);
  return { state: ageMs <= delayedAfter ? "live" : ageMs <= downAfter ? "delayed" : "down", ageMs };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Default bucket for a time range (DASHBOARDS.md §6). Keeps series around 100–1000 points. */
export function pickBucketMs(rangeMs: number): number {
  if (!(rangeMs > 0)) return MIN;
  if (rangeMs <= 6 * HOUR) return MIN;
  if (rangeMs <= 2 * DAY) return 15 * MIN;
  if (rangeMs <= 14 * DAY) return HOUR;
  if (rangeMs <= 90 * DAY) return DAY;
  return 7 * DAY;
}

/** Backoff for a polling loop: normal interval until `after` consecutive failures, then doubling with cap. */
export function pollDelayMs(intervalMs: number, consecutiveFailures: number, options: { after?: number; capMs?: number } = {}) {
  const { after = 3, capMs = 30_000 } = options;
  if (consecutiveFailures < after) return intervalMs;
  return Math.min(capMs, intervalMs * 2 ** (consecutiveFailures - after + 1));
}

/**
 * SVG path data for a sparkline in a `width × height` viewBox. `null` breaks the line (a gap is
 * missing data, never zero). With `inProgress`, the last segment is returned separately so it can
 * be drawn dashed ("this bucket is still filling") instead of looking like a crash.
 */
export function sparklinePath(
  values: readonly (number | null | undefined)[],
  width = 100,
  height = 32,
  options: { inProgress?: boolean; padding?: number } = {},
): { main: string; tail: string; last: [number, number] | null } {
  const pad = options.padding ?? 2;
  const nums = values.filter(finite);
  if (!nums.length) return { main: "", tail: "", last: null };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const n = values.length;
  const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) =>
    span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - 2 * pad);
  const pt = (i: number) => {
    const v = values[i];
    return finite(v) ? `${round(x(i), 2)} ${round(y(v), 2)}` : null;
  };
  const splitAt = options.inProgress && n > 1 ? n - 1 : n;
  let main = "";
  let pen = false;
  for (let i = 0; i < splitAt; i++) {
    const p = pt(i);
    if (p === null) {
      pen = false;
      continue;
    }
    main += `${pen ? "L" : "M"}${p}`;
    pen = true;
  }
  let tail = "";
  if (splitAt < n) {
    const a = pt(n - 2);
    const b = pt(n - 1);
    if (a !== null && b !== null) tail = `M${a}L${b}`;
  }
  let lastIndex = n - 1;
  while (lastIndex >= 0 && !finite(values[lastIndex])) lastIndex--;
  const lastValue = values[lastIndex];
  const last: [number, number] | null =
    lastIndex >= 0 && finite(lastValue) ? [round(x(lastIndex), 2), round(y(lastValue), 2)] : null;
  return { main, tail, last };
}
