/** Pure helpers for SegmentedControl / ChipGroup / QuickDatePresets (unit-tested, no DOM). */

/** Toggle `value` in a multi-selection; the result keeps the options' order and drops unknown values. */
export function toggleChoice(
  options: readonly { value: string }[],
  selected: readonly string[],
  value: string,
): string[] {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return options.map((o) => o.value).filter((v) => next.has(v));
}

/**
 * Index of the next enabled item moving `step` (±1) from `from`, wrapping; "first" / "last" jump.
 * Returns -1 when every item is disabled.
 */
export function stepEnabled(
  disabled: readonly boolean[],
  from: number,
  step: 1 | -1 | "first" | "last",
): number {
  const n = disabled.length;
  if (!disabled.some((d) => !d)) return -1;
  if (step === "first") return disabled.findIndex((d) => !d);
  if (step === "last") return n - 1 - [...disabled].reverse().findIndex((d) => !d);
  let i = from;
  for (let k = 0; k < n; k++) {
    i = (((i + step) % n) + n) % n;
    if (!disabled[i]) return i;
  }
  return -1;
}

const pad = (n: number) => String(n).padStart(2, "0");
/**
 * Local-time value for a `<input type="date">` (YYYY-MM-DD) or `datetime-local` (YYYY-MM-DDTHH:mm)
 * `days` calendar days after `now`. Calendar arithmetic, so DST changes do not shift the clock time.
 */
export function datePresetValue(
  days: number,
  type: "date" | "datetime-local" = "datetime-local",
  now: Date = new Date(),
): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return type === "date" ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// bt/share：QuickDatePresets 的小时档、选中态和「策略禁止（原因）」
/** Key of a QuickDatePresets button: `${n}h` (hours), `${n}d` (days) or "permanent". */
export type DatePresetKey = `${number}h` | `${number}d` | "permanent";
export const datePresetKey = (amount: number, unit: "h" | "d"): DatePresetKey => `${amount}${unit}`;

/** Like datePresetValue, `hours` after `now` (exact elapsed hours; a `date` input gets that day). */
export function hourPresetValue(
  hours: number,
  type: "date" | "datetime-local" = "datetime-local",
  now: Date = new Date(),
): string {
  const d = new Date(now.getTime() + hours * 3_600_000);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return type === "date" ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Milliseconds a preset covers (null = permanent); for comparing against a policy maximum. */
export function datePresetMs(key: DatePresetKey): number | null {
  if (key === "permanent") return null;
  const amount = Number.parseFloat(key);
  return key.endsWith("h") ? amount * 3_600_000 : amount * 86_400_000;
}
