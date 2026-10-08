/** Pure helpers behind QuotaMeter (no React), so they can be unit-tested and reused server-side. */
export type QuotaTone = "normal" | "warning" | "danger";

/** Tone for a used/total ratio: ≥ warnAt is warning, ≥ 1 (used up) is danger. */
export function quotaTone(ratio: number | null, warnAt = 0.8): QuotaTone {
  if (ratio === null || !Number.isFinite(ratio)) return "normal";
  if (ratio >= 1) return "danger";
  return ratio >= warnAt ? "warning" : "normal";
}

/**
 * Whole percent used for display, clamped to 0–100; null when unlimited or unknown.
 * Never shows 100 before it is really used up, and never 0 once anything is used.
 */
export function quotaPercent(used: number | null, total: number | null): number | null {
  if (used === null || total === null || !(total > 0) || !Number.isFinite(used)) return null;
  const raw = (used / total) * 100;
  if (raw >= 100) return 100;
  if (raw <= 0) return 0;
  return Math.min(99, Math.max(1, Math.round(raw)));
}
