/**
 * Pure password rules: strength level + requirement checklist, the 「再输一次」 compare and
 * a readable generated password. No DOM, no React — PasswordStrength / PasswordConfirmHint / InitialPasswordField
 * only paint these results. The server still enforces its own policy; this is guidance while typing.
 */

/** One requirement in the checklist (「至少 8 位」). `test` must be pure. */
export type PasswordRule = { key: string; label: string; test: (password: string) => boolean };

/** 0 = empty, 1 很弱 · 2 弱 · 3 中 · 4 强. */
export type PasswordLevel = 0 | 1 | 2 | 3 | 4;

/** Words under the 4-segment bar, indexed by level (0 is unused: an empty box shows the first rule instead). */
export const PASSWORD_LEVEL_TEXT: readonly [string, string, string, string, string] = ["", "太弱", "一般", "够用", "很强"];

/** Minimum length rule (「至少 N 位」). Characters are counted as the user sees them (emoji = 1). */
export function minLengthRule(min: number): PasswordRule {
  return { key: "length", label: `至少 ${min} 位`, test: (pw) => Array.from(pw).length >= min };
}

/** The company default: ≥ 8 位、大小写字母、数字、符号. */
export const DEFAULT_PASSWORD_RULES: readonly PasswordRule[] = [
  minLengthRule(8),
  { key: "case", label: "大小写字母都有", test: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  { key: "digit", label: "有数字", test: (pw) => /\d/.test(pw) },
  { key: "symbol", label: "有符号", test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
];

export type PasswordCheck = { key: string; label: string; ok: boolean };
export type PasswordStrengthResult = {
  level: PasswordLevel;
  /** 「很弱」…「强」; empty string for an empty password. */
  label: string;
  checks: PasswordCheck[];
  /** How many rules pass. */
  passed: number;
  /** Every rule passes (what a submit button can wait for). */
  ok: boolean;
};

export type PasswordStrengthOptions = {
  /** Shorter than this caps the level at 1 (很弱) whatever else it has. Default: the `length` rule's number, else 8. */
  minLength?: number;
  /** This long and at least 中 → 强 even without every rule (a long passphrase). Default 14. */
  strongLength?: number;
};

function ruleMinLength(rules: readonly PasswordRule[]): number | undefined {
  const rule = rules.find((r) => r.key === "length");
  const match = rule ? /(\d+)/.exec(rule.label) : null;
  return match ? Number(match[1]) : undefined;
}

/**
 * Strength of `password` against `rules` (default DEFAULT_PASSWORD_RULES): the share of rules passed mapped onto
 * 4 levels (at least 很弱 once something is typed); under the minimum length it stays 很弱; a long password that
 * is already 中 counts as 强.
 */
export function passwordStrength(password: string, rules: readonly PasswordRule[] = DEFAULT_PASSWORD_RULES, options: PasswordStrengthOptions = {}): PasswordStrengthResult {
  const checks = rules.map((r) => ({ key: r.key, label: r.label, ok: password.length > 0 && r.test(password) }));
  const passed = checks.filter((c) => c.ok).length;
  const length = Array.from(password).length;
  if (!length) return { level: 0, label: "", checks, passed: 0, ok: rules.length === 0 };
  const min = options.minLength ?? ruleMinLength(rules) ?? 8;
  const strong = options.strongLength ?? 14;
  let level = rules.length ? Math.max(1, Math.round((passed / rules.length) * 4)) : length >= min ? 4 : 1;
  if (length < min) level = 1;
  if (length >= strong && level >= 3) level = 4;
  const safe = Math.min(4, Math.max(1, level)) as PasswordLevel;
  return { level: safe, label: PASSWORD_LEVEL_TEXT[safe], checks, passed, ok: passed === rules.length };
}

/**
 * 「再输一次」 compared live: `empty` (nothing typed yet), `partial` (so far a prefix of the new password — still
 * typing, say nothing), `match`, `mismatch` (show 「和上面不一样」).
 */
export type PasswordMatch = "empty" | "partial" | "match" | "mismatch";
export function passwordsMatch(password: string, confirm: string): PasswordMatch {
  if (!confirm) return "empty";
  if (confirm === password) return "match";
  if (confirm.length < password.length && password.startsWith(confirm)) return "partial";
  return "mismatch";
}

/** Letters and digits people can read aloud and type from a note: no 0 / O / o, 1 / l / I. */
export const READABLE_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type GeneratePasswordOptions = {
  /** Characters to pick from (default READABLE_ALPHABET). */
  alphabet?: string;
  /** Put this between groups (default "-": 「Tq7m-vw2K-9czX」); "" for none. */
  separator?: string;
  /** Group size (default 4). */
  groupSize?: number;
  /** Random source (default crypto.getRandomValues); tests inject a fixed one. */
  random?: (buffer: Uint32Array) => Uint32Array;
};

function defaultRandom(buffer: Uint32Array): Uint32Array {
  globalThis.crypto.getRandomValues(buffer as Uint32Array<ArrayBuffer>);
  return buffer;
}

/** One unbiased index in [0, n) (rejection sampling on 32-bit values). */
function pick(n: number, random: (buffer: Uint32Array) => Uint32Array): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const one = new Uint32Array(1);
  for (let i = 0; i < 64; i += 1) {
    const v = random(one)[0] ?? 0;
    if (v < limit) return v % n;
  }
  return (random(one)[0] ?? 0) % n;
}

function hasEveryClass(chars: readonly string[], alphabet: string): boolean {
  const need = [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(alphabet));
  return need.every((re) => chars.some((c) => re.test(c)));
}

/**
 * A random initial password of `length` characters (default 12) from a readable alphabet, grouped for reading
 * (「Tq7m-vw2K-9czX」, separators not counted in `length`). Uses crypto.getRandomValues, never Math.random; keeps
 * drawing until it has a lowercase letter, an uppercase letter and a digit (when the alphabet has them).
 */
export function generatePassword(length = 12, options: GeneratePasswordOptions = {}): string {
  const alphabet = Array.from(options.alphabet ?? READABLE_ALPHABET);
  const random = options.random ?? defaultRandom;
  const size = Math.max(1, Math.floor(length));
  const group = Math.max(1, Math.floor(options.groupSize ?? 4));
  const separator = options.separator ?? "-";
  if (!alphabet.length) throw new Error("generatePassword: alphabet is empty");
  let chars: string[] = [];
  for (let attempt = 0; attempt < 32; attempt += 1) {
    chars = Array.from({ length: size }, () => alphabet[pick(alphabet.length, random)] ?? "");
    if (size < 3 || hasEveryClass(chars, alphabet.join(""))) break;
  }
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += group) groups.push(chars.slice(i, i + group).join(""));
  return groups.join(separator);
}
