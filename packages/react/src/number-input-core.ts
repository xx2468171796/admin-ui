/**
 * Pure rules of the number family: NumberInput parsing / stepping, money in minor
 * units with thousands separators and the 「约 US$ 8.6 万」 hint, phone numbers (country calling code +
 * local grouping, stored as E.164), percent, and the slider's value maths. No React, no DOM;
 * unit-tested in test/number-input-core.test.ts.
 */
import { runtimeRegion } from "./admin-defaults.ts";

// ---------------------------------------------------------------- numbers

/** Full-width digits / signs / separators typed with a Chinese IME → ASCII. */
export function normalizeNumberText(text: string): string {
  return text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[－—–−]/g, "-")
    .replace(/[＋]/g, "+");
}

/** Round to `precision` fraction digits (half away from zero); undefined precision keeps the number. */
export function roundTo(n: number, precision?: number): number {
  if (precision === undefined) return n;
  const p = Math.max(0, Math.min(10, Math.floor(precision)));
  const factor = 10 ** p;
  return (Math.sign(n) * Math.round(Math.abs(n) * factor + Number.EPSILON)) / factor;
}

export const clampNumber = (n: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) => Math.max(min, Math.min(max, n));

/**
 * Typed text → number: thousands separators, spaces and a trailing unit / % are ignored, full-width
 * digits accepted. null = blank, undefined = not a number.
 */
export function parseNumberText(text: string, precision?: number): number | null | undefined {
  const cleaned = normalizeNumberText(text).replace(/[,，\s_]/g, "").replace(/[%％]$/, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? roundTo(n, precision) : undefined;
}

const decimalsOf = (n: number) => {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
};

/** value ± step × times, clamped and rounded so stepping never shows float noise (0.1 + 0.2). */
export function stepValue(value: number | null, step: number, times: number, min?: number, max?: number, precision?: number): number {
  const lo = min ?? Number.NEGATIVE_INFINITY;
  const hi = max ?? Number.POSITIVE_INFINITY;
  if (value === null) return clampNumber(lo > Number.NEGATIVE_INFINITY ? lo : 0, lo, hi);
  const places = precision ?? Math.max(decimalsOf(step), decimalsOf(value));
  return clampNumber(roundTo(value + step * times, places), lo, hi);
}

/** Times to step for a key on a number box: ↑ ↓ (Shift = ×10), PageUp / PageDown ×10; 0 = not a step key. */
export function stepKeyTimes(key: string, shiftKey: boolean): number {
  const big = shiftKey ? 10 : 1;
  if (key === "ArrowUp") return big;
  if (key === "ArrowDown") return -big;
  if (key === "PageUp") return 10;
  if (key === "PageDown") return -10;
  return 0;
}

/** 「要在 0–100 之间」 / 「不能小于 1」 / 「不能大于 30」 for a value outside the range (null = fine). */
export function rangeMessage(value: number | null, min?: number, max?: number, unit = ""): string | null {
  if (value === null) return null;
  const tooLow = min !== undefined && value < min;
  const tooHigh = max !== undefined && value > max;
  if (!tooLow && !tooHigh) return null;
  if (min !== undefined && max !== undefined) return `要在 ${min}–${max}${unit} 之间`;
  return tooLow ? `不能小于 ${min}${unit}` : `不能大于 ${max}${unit}`;
}

/** 86000 → 「86,000」; fixed digits when `precision` is given (1234.5, 2 → 「1,234.50」). */
export function formatThousands(n: number, precision?: number): string {
  const fixed = precision === undefined ? String(n) : roundTo(n, precision).toFixed(Math.max(0, Math.min(10, precision)));
  const negative = fixed.startsWith("-");
  const [int = "", frac] = (negative ? fixed.slice(1) : fixed).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${frac !== undefined ? `.${frac}` : ""}`;
}

/** Text a number box shows when not focused: plain, or with thousands separators. */
export function numberDisplayText(value: number | null, options: { precision?: number; thousands?: boolean } = {}): string {
  if (value === null || !Number.isFinite(value)) return "";
  if (options.thousands) return formatThousands(value, options.precision);
  return options.precision === undefined ? String(value) : roundTo(value, options.precision).toFixed(options.precision);
}

// ---------------------------------------------------------------- money

/** A currency of the money box: `symbol` is shown in the segment, `precision` = digits typed / shown. */
export type MoneyCurrency = { code: string; symbol: string; label: string; precision: number };
/** Currencies offered by the money box's picker, in ISO 4217 code order (hosts pass their own list / order). */
export const MONEY_CURRENCIES: readonly MoneyCurrency[] = [
  { code: "CNY", symbol: "CN¥", label: "人民币", precision: 2 },
  { code: "EUR", symbol: "€", label: "欧元", precision: 2 },
  { code: "HKD", symbol: "HK$", label: "港币", precision: 2 },
  { code: "JPY", symbol: "JP¥", label: "日元", precision: 0 },
  { code: "MYR", symbol: "RM", label: "马来西亚林吉特", precision: 2 },
  { code: "SGD", symbol: "S$", label: "新加坡元", precision: 2 },
  { code: "TWD", symbol: "NT$", label: "新台币", precision: 0 },
  { code: "USD", symbol: "US$", label: "美元", precision: 2 },
];

/**
 * The symbol shown for a currency setting: an ISO code in the list → its symbol ("USD" → "US$"); anything else is
 * taken as the symbol itself ("¥" → "¥"); "" / undefined → "" (no symbol).
 */
export function currencySymbol(currency: string | undefined, list: readonly MoneyCurrency[] = MONEY_CURRENCIES): string {
  if (!currency) return "";
  return list.find((c) => c.code === currency)?.symbol ?? currency;
}

/**
 * Major-unit text → minor units (1/100 of the major unit, like the grid's money fields and the form
 * builder's 分), rounded to `precision` digits first. null = blank, undefined = not an amount.
 * String maths, so 0.29 never becomes 28.999….
 */
export function moneyTextToMinor(text: string, precision = 2): number | null | undefined {
  const cleaned = normalizeNumberText(text).replace(/[,，\s_]/g, "").replace(/^[^\d.+-]+/, "");
  if (cleaned === "") return /\S/.test(text) ? undefined : null;
  const m = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!m || (m[2] === "" && !m[3])) return undefined;
  const sign = m[1] === "-" ? -1 : 1;
  const intPart = m[2] || "0";
  const frac = m[3] ?? "";
  const keep = Math.max(0, Math.min(2, precision));
  // Round the fraction to `keep` digits (half away from zero), then express in cents.
  const head = frac.slice(0, keep).padEnd(keep, "0");
  const roundUp = (frac[keep] ?? "0") >= "5";
  let units = Number(intPart) * 10 ** keep + (head ? Number(head) : 0) + (roundUp ? 1 : 0);
  units *= 10 ** (2 - keep);
  if (!Number.isSafeInteger(units)) return undefined;
  units = sign * units;
  return units === 0 ? 0 : units;
}

/** Minor units → major-unit text for typing (no separators): 8600000, 0 → 「86000」; 12345, 2 → 「123.45」. */
export function minorToMoneyText(minor: number | null, precision = 2, thousands = false): string {
  if (minor === null || !Number.isFinite(minor)) return "";
  const major = minor / 100;
  const keep = Math.max(0, Math.min(2, precision));
  return thousands ? formatThousands(major, keep) : roundTo(major, keep).toFixed(keep);
}

const trimZero = (text: string) => text.replace(/\.0$/, "");
/**
 * The hint under a money box: 「约 US$ 8.6 万」 from 10,000, 「约 US$ 1.2 亿」 from 100,000,000; null below
 * (and for empty values). `major` is the amount in major units.
 */
export function approxMoney(major: number | null, symbol: string): string | null {
  if (major === null || !Number.isFinite(major)) return null;
  const abs = Math.abs(major);
  const sign = major < 0 ? "-" : "";
  const sym = symbol ? `${symbol} ` : "";
  if (abs >= 1e8) return `约 ${sym}${sign}${trimZero((abs / 1e8).toFixed(1))} 亿`;
  if (abs >= 1e4) return `约 ${sym}${sign}${trimZero((abs / 1e4).toFixed(1))} 万`;
  return null;
}

// ---------------------------------------------------------------- phone

/**
 * A country / region of the phone box. `code` = calling code (「+44」); `trunk` = the national prefix
 * dropped in E.164 (GB 07700… → +44 7700…); `groups` = local grouping by length; `mobile` = what a
 * mobile number looks like locally (with the trunk prefix) and how to say it when wrong.
 */
export type PhoneCountry = {
  code: string;
  region: string;
  name: string;
  trunk?: string;
  /** Local example shown as the placeholder. */
  example: string;
  /** Allowed local lengths (digits, with the trunk prefix). */
  lengths: readonly [number, number];
  groups?: Readonly<Record<number, readonly number[]>>;
  /** Grouping of numbers that aren't mobile numbers (TW landline 02 2345 6789), by length. */
  landlineGroups?: Readonly<Record<number, readonly number[]>>;
  mobile?: { lengths: readonly [number, number]; pattern: RegExp; hint: string };
};
/** Countries / regions of the picker, in ISO 3166 region-code order (hosts pass their own list / order). */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: "+86", region: "CN", name: "中国大陆", example: "138 1234 5678", lengths: [10, 12], groups: { 11: [3, 4, 4] }, mobile: { lengths: [11, 11], pattern: /^1[3-9]\d{9}$/, hint: "中国大陆手机是 1 开头 11 位" } },
  { code: "+44", region: "GB", name: "英国", trunk: "0", example: "07700 900123", lengths: [10, 11], groups: { 11: [5, 6] }, mobile: { lengths: [11, 11], pattern: /^07\d{9}$/, hint: "英国手机是 07 开头 11 位" } },
  { code: "+852", region: "HK", name: "中国香港", example: "5123 4567", lengths: [8, 8], groups: { 8: [4, 4] }, mobile: { lengths: [8, 8], pattern: /^[4-9]\d{7}$/, hint: "香港手机是 8 位" } },
  { code: "+81", region: "JP", name: "日本", trunk: "0", example: "090 1234 5678", lengths: [10, 11], groups: { 11: [3, 4, 4], 10: [2, 4, 4] }, mobile: { lengths: [11, 11], pattern: /^0[789]0\d{8}$/, hint: "日本手机是 070 / 080 / 090 开头 11 位" } },
  { code: "+82", region: "KR", name: "韩国", trunk: "0", example: "010 1234 5678", lengths: [9, 11], groups: { 11: [3, 4, 4], 10: [3, 3, 4] }, mobile: { lengths: [10, 11], pattern: /^01\d{8,9}$/, hint: "韩国手机是 01 开头 10–11 位" } },
  { code: "+853", region: "MO", name: "中国澳门", example: "6612 3456", lengths: [8, 8], groups: { 8: [4, 4] }, mobile: { lengths: [8, 8], pattern: /^6\d{7}$/, hint: "澳门手机是 6 开头 8 位" } },
  { code: "+60", region: "MY", name: "马来西亚", trunk: "0", example: "012 345 6789", lengths: [9, 11], groups: { 10: [3, 3, 4], 11: [3, 4, 4] }, mobile: { lengths: [10, 11], pattern: /^01\d{8,9}$/, hint: "马来西亚手机是 01 开头 10–11 位" } },
  { code: "+65", region: "SG", name: "新加坡", example: "8123 4567", lengths: [8, 8], groups: { 8: [4, 4] }, mobile: { lengths: [8, 8], pattern: /^[89]\d{7}$/, hint: "新加坡手机是 8 或 9 开头 8 位" } },
  { code: "+886", region: "TW", name: "台湾", trunk: "0", example: "0912 345 678", lengths: [9, 10], groups: { 10: [4, 3, 3], 9: [2, 3, 4] }, landlineGroups: { 10: [2, 4, 4], 9: [2, 3, 4] }, mobile: { lengths: [10, 10], pattern: /^09\d{8}$/, hint: "台湾手机是 09 开头 10 位" } },
  { code: "+1", region: "US", name: "美国 / 加拿大", trunk: "1", example: "201 555 0123", lengths: [10, 10], groups: { 10: [3, 3, 4] }, mobile: { lengths: [10, 10], pattern: /^[2-9]\d{9}$/, hint: "美国 / 加拿大号码是 10 位" } },
];

/**
 * The phone box's starting country when the host did not set one: the calling code of `region` (default: the
 * runtime locale's region, "zh-CN" → "CN") when it is in the list, else the first entry of the list.
 */
export function defaultPhoneCountry(list: readonly PhoneCountry[] = PHONE_COUNTRIES, region: string = runtimeRegion()): string {
  return list.find((c) => c.region === region)?.code ?? list[0]?.code ?? "";
}

const findCountry = (code: string, list: readonly PhoneCountry[]) => list.find((c) => c.code === code);

/** Digits only (full-width digits accepted). */
export const phoneDigits = (text: string) => normalizeNumberText(text).replace(/\D/g, "");

/**
 * Local digits → the national significant number (trunk prefix dropped): GB 07700900123 → 7700900123,
 * US 12015550123 → 2015550123. Text typed as 「+44…」 / 「0044…」 keeps its own code (see toE164).
 */
function nationalNumber(country: PhoneCountry | undefined, digits: string): string {
  const trunk = country?.trunk;
  return trunk && digits.startsWith(trunk) ? digits.slice(trunk.length) : digits;
}

/**
 * Country code + what was typed → E.164 (「+44」, 「07700 900123」 → 「+447700900123」). Typed text that
 * already starts with 「+」 or 「00」 is taken as international. Empty → null.
 */
export function toE164(country: string, local: string, list: readonly PhoneCountry[] = PHONE_COUNTRIES): string | null {
  const raw = normalizeNumberText(local).trim();
  if (raw.startsWith("+")) {
    const digits = phoneDigits(raw);
    return digits ? `+${digits}` : null;
  }
  const digits = phoneDigits(raw);
  if (!digits) return null;
  if (digits.startsWith("00") && digits.length > 6) return `+${digits.slice(2)}`;
  const code = country.startsWith("+") ? country : `+${phoneDigits(country)}`;
  return `${code}${nationalNumber(findCountry(code, list), digits)}`;
}

/**
 * E.164 (or the form builder's older 「+44 07700900123」) → country code + local digits with the trunk
 * prefix put back (「+447700900123」 → { country: "+44", local: "07700900123" }). The longest calling
 * code in the list wins; unknown codes keep up to 3 digits. null when it isn't an international number.
 */
export function parsePhone(value: unknown, list: readonly PhoneCountry[] = PHONE_COUNTRIES): { country: string; local: string; national: string } | null {
  if (typeof value !== "string") return null;
  const text = normalizeNumberText(value).trim();
  if (!text.startsWith("+")) return null;
  const spaced = /^\+(\d{1,4})[\s-]+(.*)$/.exec(text);
  const digits = phoneDigits(text);
  if (!digits) return null;
  const known = [...list].sort((a, b) => b.code.length - a.code.length).find((c) => digits.startsWith(c.code.slice(1)));
  const code = spaced && findCountry(`+${spaced[1]}`, list) ? `+${spaced[1]}` : known ? known.code : `+${digits.slice(0, Math.min(3, digits.length))}`;
  const country = findCountry(code, list);
  const rest = digits.slice(code.length - 1);
  const national = nationalNumber(country, rest);
  const trunk = country?.trunk && country.trunk !== "1" ? country.trunk : "";
  const local = national && trunk && !national.startsWith(trunk) ? `${trunk}${national}` : national;
  return { country: code, local, national };
}

/** Groups of 3–4 from the left for a length (generic countries and odd lengths). */
function genericGroups(length: number): number[] {
  if (length <= 4) return [length];
  if (length < 8) return [3, length - 3];
  const threes = (4 - (length % 4)) % 4;
  return [...Array<number>(threes).fill(3), ...Array<number>((length - threes * 3) / 4).fill(4)];
}

/**
 * Local digits shown the local way: CN 「138 1234 5678」, GB 「07700 900123」, TW 「0912 345 678」 (landline 「02 2345 6789」), HK 「5123 4567」, US
 * 「201 555 0123」; other lengths in groups of 3–4. Non-digits are dropped.
 */
export function formatLocalPhone(country: string, local: string, list: readonly PhoneCountry[] = PHONE_COUNTRIES): string {
  const digits = phoneDigits(local);
  if (!digits) return "";
  const c = findCountry(country, list);
  const landline = c?.landlineGroups && c.mobile && !c.mobile.pattern.test(digits) ? c.landlineGroups[digits.length] : undefined;
  const groups = landline ?? c?.groups?.[digits.length] ?? genericGroups(digits.length);
  const out: string[] = [];
  let at = 0;
  for (const size of groups) {
    if (at >= digits.length) break;
    out.push(digits.slice(at, at + size));
    at += size;
  }
  if (at < digits.length) out.push(digits.slice(at));
  return out.join(" ");
}

/**
 * How a stored number reads in a table cell / record detail: a number of `home` (the
 * company's / field's country) the local way 「07700 900123」; any other country the international way
 * WITHOUT the trunk prefix 「+44 7700 900123」, 「+86 138 0013 8000」, 「+1 415 555 0132」 — never 「+44 07700…」.
 * No `home` = every international number in international form. Text that isn't international (no 「+」)
 * stays as stored, except plain digits of `home`, which get the local grouping.
 */
export function formatPhoneDisplay(value: unknown, options: { home?: string; list?: readonly PhoneCountry[] } = {}): string {
  const list = options.list ?? PHONE_COUNTRIES;
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const parsed = parsePhone(raw, list);
  if (!parsed) {
    return options.home && /^[\d\s\-()]+$/.test(raw) && phoneDigits(raw).length >= 6 ? formatLocalPhone(options.home, raw, list) : raw;
  }
  if (options.home && parsed.country === options.home) return formatLocalPhone(parsed.country, parsed.local, list);
  const country = findCountry(parsed.country, list);
  const trunk = country?.trunk && country.trunk !== "1" ? country.trunk : "";
  // Group the way locals write it, then drop the trunk digit(s) from the front: 07700 900123 → 7700 900123.
  let national = formatLocalPhone(parsed.country, parsed.local, list);
  if (trunk && parsed.local.startsWith(trunk)) {
    let drop = trunk.length;
    while (drop > 0 && national.length) {
      if (/\d/.test(national[0] ?? "")) drop--;
      national = national.slice(1);
    }
    national = national.trimStart();
  }
  return national ? `${parsed.country} ${national}` : parsed.country;
}

/**
 * Check a phone number when the box is left (not while typing). `mobile` = it must look like a local
 * mobile number. Returns the message (「位数不对：中国大陆手机是 1 开头 11 位」) or null; empty → null.
 */
export function validatePhone(country: string, local: string, options: { mobile?: boolean; list?: readonly PhoneCountry[] } = {}): string | null {
  const list = options.list ?? PHONE_COUNTRIES;
  const raw = normalizeNumberText(local).trim();
  if (raw.startsWith("+")) {
    const parsed = parsePhone(raw, list);
    return parsed ? validatePhone(parsed.country, parsed.local, options) : "号码格式不对";
  }
  if (/[^\d\s\-()（）.]/.test(raw)) return "号码只能有数字";
  const digits = phoneDigits(raw);
  if (!digits) return null;
  const c = findCountry(country, list);
  if (!c) return digits.length >= 6 && digits.length <= 15 ? null : "位数不对：号码一般是 6–15 位";
  if (options.mobile && c.mobile) {
    const localDigits = c.trunk === "1" && digits.length === 11 ? digits.slice(1) : digits;
    if (c.mobile.pattern.test(localDigits)) return null;
    const [lo, hi] = c.mobile.lengths;
    const wrongLength = localDigits.length < lo || localDigits.length > hi;
    return `${wrongLength ? "位数不对" : "号码不对"}：${c.mobile.hint}`;
  }
  const [lo, hi] = c.lengths;
  const n = c.trunk === "1" && digits.length === 11 && digits.startsWith("1") ? 10 : digits.length;
  return n >= lo - 1 && n <= hi ? null : `位数不对：${c.name}号码是 ${lo === hi ? lo : `${lo}–${hi}`} 位`;
}

/** 「+44 · 英国」: how a stored number's country is named next to a local number. */
export function phoneCountryLabel(code: string, list: readonly PhoneCountry[] = PHONE_COUNTRIES): string {
  const c = findCountry(code, list);
  return c ? `${c.code} · ${c.name}` : code;
}

// ---------------------------------------------------------------- slider

/** Where a value sits on the rail (0–1). */
export function sliderRatio(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return clampNumber((value - min) / (max - min), 0, 1);
}

/** The value at a rail position (0–1), snapped to the step. */
export function sliderValueAt(ratio: number, min: number, max: number, step: number): number {
  const raw = min + clampNumber(ratio, 0, 1) * (max - min);
  const snapped = step > 0 ? min + Math.round((raw - min) / step) * step : raw;
  return clampNumber(roundTo(snapped, Math.max(decimalsOf(step), decimalsOf(min))), min, max);
}

/**
 * Keyboard on a slider thumb: ← ↓ −step, → ↑ +step (Shift ×10), PageUp / PageDown ×10, Home / End.
 * undefined = not a slider key.
 */
export function sliderKey(value: number, key: string, options: { min: number; max: number; step: number; shiftKey?: boolean }): number | undefined {
  const { min, max, step } = options;
  const big = options.shiftKey ? 10 : 1;
  let times: number;
  if (key === "ArrowRight" || key === "ArrowUp") times = big;
  else if (key === "ArrowLeft" || key === "ArrowDown") times = -big;
  else if (key === "PageUp") times = 10;
  else if (key === "PageDown") times = -10;
  else if (key === "Home") return min;
  else if (key === "End") return max;
  else return undefined;
  return stepValue(value, step, times, min, max);
}

/** Tick values of a slider: `true` = every step (at most 21 ticks, else none), a list = those values. */
export function sliderMarks(marks: boolean | readonly number[] | undefined, min: number, max: number, step: number): number[] {
  if (!marks) return [];
  if (Array.isArray(marks)) return marks.filter((m) => m >= min && m <= max);
  if (!(step > 0)) return [];
  const count = Math.floor((max - min) / step) + 1;
  if (count > 21) return [];
  return Array.from({ length: count }, (_, i) => roundTo(min + i * step, Math.max(decimalsOf(step), decimalsOf(min))));
}

// ---------------------------------------------------------------- percent

/** 「60%」 (precision = fraction digits, default 0); empty for null. */
export function percentText(value: number | null, precision = 0): string {
  if (value === null || !Number.isFinite(value)) return "";
  return `${roundTo(value, precision)}%`;
}
