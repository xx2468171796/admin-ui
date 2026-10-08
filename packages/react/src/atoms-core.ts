/**
 * Pure rules of the small atoms (bt/foundations F0.5): AvatarStack, Rating, CodeInput, NumberStepper,
 * Countdown, Watermark. No React, no DOM; unit-tested in test/atoms-core.test.ts.
 */

/** First visible character of a name (「王小明」 → 「王」, 「amy」 → 「A」), "?" when blank. */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase("zh-CN") : "?";
}

/** Which avatars show and how many fold into 「+k」 (max ≥ 1; exactly max+1 people shows them all). */
export function stackPeople<T>(people: readonly T[], max: number): { shown: T[]; rest: T[] } {
  const limit = Math.max(1, Math.floor(max));
  if (people.length <= limit + 1) return { shown: people.slice(), rest: [] };
  return { shown: people.slice(0, limit), rest: people.slice(limit) };
}

/**
 * Keyboard on a rating input (slider pattern): → / ↑ +1, ← / ↓ −1, Home → 0 (cleared when allowed,
 * else 1), End → max, digit keys 0–max set it directly. Returns null for 「cleared」 and undefined for keys it does not handle.
 */
export function ratingKey(value: number | null, key: string, max: number, allowClear = true): number | null | undefined {
  const current = value ?? 0;
  const low = allowClear ? 0 : 1;
  const clamp = (n: number) => Math.max(low, Math.min(max, n));
  let next: number;
  if (key === "ArrowRight" || key === "ArrowUp") next = clamp(current + 1);
  else if (key === "ArrowLeft" || key === "ArrowDown") next = clamp(current - 1);
  else if (key === "Home") next = low;
  else if (key === "End") next = max;
  else if (/^\d$/.test(key) && Number(key) <= max) next = clamp(Number(key));
  else return undefined;
  return next === 0 ? null : next;
}

/** The word of a rating (labels[value − 1]: 「较高」); 「未评」 when empty; "" without labels. */
export function ratingWord(value: number | null, labels: readonly string[] | undefined): string {
  if (!labels?.length) return "";
  if (!value) return "未评";
  return labels[Math.min(labels.length, value) - 1] ?? "";
}

/** 「4 星（满分 5）」 / 「未评分」. */
export function ratingText(value: number | null, max: number): string {
  return value ? `${value} 星（满分 ${max}）` : "未评分";
}

export type CodeCharset = "numeric" | "alnum";
const allowed = (charset: CodeCharset) => (charset === "numeric" ? /[0-9]/ : /[0-9a-z]/i);

/** Keep only characters of the charset (uppercase when asked), cut to `length`. */
export function cleanCode(text: string, length: number, charset: CodeCharset, uppercase = true): string {
  const re = allowed(charset);
  const chars = Array.from(text).filter((ch) => re.test(ch));
  const joined = chars.join("").slice(0, length);
  return uppercase ? joined.toUpperCase() : joined;
}

/**
 * Typing or pasting `input` into box `index` of a PIN: fills from that box on, keeps earlier boxes, and
 * says which box gets focus next (the one after the last filled, or the last box).
 */
export function fillCode(current: string, index: number, input: string, length: number, charset: CodeCharset, uppercase = true): { value: string; focus: number } {
  const add = cleanCode(input, length, charset, uppercase);
  const boxes = Array.from({ length }, (_, i) => Array.from(current)[i] ?? "");
  if (!add) return { value: boxes.join(""), focus: index };
  Array.from(add).forEach((ch, offset) => {
    if (index + offset < length) boxes[index + offset] = ch;
  });
  // A code is contiguous: drop anything after the first gap.
  const gap = boxes.indexOf("");
  const value = (gap < 0 ? boxes : boxes.slice(0, gap)).join("");
  return { value, focus: Math.min(length - 1, index + Array.from(add).length) };
}

/**
 * Box `index` was emptied (Backspace, cut, IME / context-menu delete): the code keeps the boxes before
 * it — later boxes would leave a gap — and focus stays on that box.
 */
export function clearCodeBox(current: string, index: number): { value: string; focus: number } {
  return { value: Array.from(current).slice(0, Math.max(0, index)).join(""), focus: Math.max(0, index) };
}

/** Decimal places of a step (0.5 → 1, 0.01 → 2) so stepping never shows float noise. */
const decimals = (n: number) => {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
};

/** value ± step·times, clamped to [min, max] and rounded to the step's decimals. */
export function stepNumber(value: number | null, step: number, times: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
  const base = value ?? (min > Number.NEGATIVE_INFINITY ? min : 0);
  const raw = value === null ? base : base + step * times;
  const places = Math.max(decimals(step), decimals(base));
  const rounded = Number(raw.toFixed(places));
  return Math.max(min, Math.min(max, rounded));
}

/** Text typed into a stepper → a clamped number; null when blank, undefined when not a number. */
export function parseStepper(text: string, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number | null | undefined {
  const cleaned = text.replace(/[,，\s]/g, "").replace(/^－/, "-");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

export type CountdownParts = { total: number; days: number; hours: number; minutes: number; seconds: number };
/** Remaining milliseconds → whole parts (rounded up to the next second, never negative). */
export function countdownParts(ms: number): CountdownParts {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return { total, days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}
const two = (n: number) => String(n).padStart(2, "0");
/**
 * Countdown text. `auto`: 「52 秒」 under a minute, 「4:59」 under an hour, 「2:04:59」 under a day,
 * then 「3 天 4 小时」. `clock`: always 「mm:ss」 / 「h:mm:ss」. 「0 秒」 when expired.
 */
export function countdownText(ms: number, format: "auto" | "clock" = "auto"): string {
  const p = countdownParts(ms);
  if (format === "auto") {
    if (p.total < 60) return `${p.total} 秒`;
    if (p.days > 0) return p.hours ? `${p.days} 天 ${p.hours} 小时` : `${p.days} 天`;
  }
  const hours = p.days * 24 + p.hours;
  return hours ? `${hours}:${two(p.minutes)}:${two(p.seconds)}` : `${p.minutes}:${two(p.seconds)}`;
}

/** Remaining share of the ring (1 = full, 0 = empty), from remaining and total milliseconds. */
export function countdownProgress(ms: number, totalMs: number): number {
  if (!(totalMs > 0)) return 0;
  return Math.max(0, Math.min(1, ms / totalMs));
}

/** How many watermark tiles cover a box: one extra row / column each side so rotation leaves no gaps. */
export function watermarkTiles(width: number, height: number, gapX: number, gapY: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(width / Math.max(40, gapX)) + 2);
  const rows = Math.max(1, Math.ceil(height / Math.max(24, gapY)) + 2);
  return { cols: Math.min(cols, 60), rows: Math.min(rows, 120) };
}
