/**
 * Option / tag colours (replaces the older seven tones): every select option, tag and
 * label uses one of ten hues taken from the current palette (option-palette.ts) — never an arbitrary
 * colour — as a soft tag, or, for the one value that must stand out (成交), a solid tag.
 *
 * | tone | looks like |
 * |---|---|
 * | `green` … `gray` (OPTION_HUES) | hue text on a soft hue background, no border |
 * | `greenSolid` … `graySolid` | white text on the hue, filled |
 *
 * The public tone names are only these twenty. Stored data written before 8.0 may still hold the seven
 * names of that is data, not API: `legacyTone` (and `optionTone`, which calls it) reads
 * them 1 : 1 (brand → green, brandMid → teal, info → blue, warning → yellow, danger → red, neutral → gray,
 * solid → greenSolid). `optionTone` also reads colour names (`orange`, `purple`, `红色` …) and `colorTone`
 * turns hex colours into the nearest hue.
 * Pure (no React).
 */
import { OPTION_HUES, OPTION_HUE_LABELS, hexToOklch, type OptionHue } from "./option-palette.ts";

export { OPTION_HUES, OPTION_HUE_LABELS, type OptionHue } from "./option-palette.ts";

export type OptionSolidTone = `${OptionHue}Solid`;
/** One of the twenty tones: a soft hue, or the hue filled (`greenSolid`). What pickers hand back. */
export type OptionHueTone = OptionHue | OptionSolidTone;
/** Any tone a prop accepts: one of the twenty tones. */
export type OptionTone = OptionHueTone;

/** All twenty tones: the ten soft hues, then the ten solid ones. */
export const OPTION_TONES: readonly OptionHueTone[] = [...OPTION_HUES, ...OPTION_HUES.map((hue): OptionSolidTone => `${hue}Solid`)];
const TONE_SET = new Set<string>(OPTION_TONES);
const LOWER_TONES = new Map(OPTION_TONES.map((tone) => [tone.toLowerCase(), tone]));
/** The seven older stored tone names → the new tone, one to one. Data only. */
const OLD_TONES: Readonly<Record<string, OptionHueTone>> = {
  brand: "green",
  brandmid: "teal",
  info: "blue",
  warning: "yellow",
  danger: "red",
  neutral: "gray",
  solid: "greenSolid",
};
/**
 * Read a tone name stored before 8.0 (brand / brandMid / info / warning / danger / neutral / solid) as one
 * of the twenty tones; undefined for anything else. For reading old data only — never write old names.
 */
export function legacyTone(stored: string | null | undefined): OptionHueTone | undefined {
  return stored ? OLD_TONES[stored.trim().toLowerCase()] : undefined;
}
/** Chinese names shown in pickers (「绿」「绿 · 实心」). */
export const OPTION_TONE_LABELS: Readonly<Record<OptionHueTone, string>> = Object.fromEntries(
  OPTION_TONES.map((tone) => [tone, tone.endsWith("Solid") ? `${OPTION_HUE_LABELS[tone.slice(0, -5) as OptionHue]} · 实心` : OPTION_HUE_LABELS[tone as OptionHue]]),
) as Record<OptionHueTone, string>;

/** The hue of a tone (`greenSolid` → green). */
export function toneHue(tone: OptionTone): OptionHue {
  const t = optionTone(tone) ?? "gray";
  return (t.endsWith("Solid") ? t.slice(0, -5) : t) as OptionHue;
}
/** Whether a tone is a filled one (`greenSolid`). */
export function isSolidTone(tone: OptionTone): boolean {
  return tone.endsWith("Solid");
}
/** Whether a string is one of the twenty tone names (not a colour name, not a pre-8.0 name). */
export function isOptionToneName(value: unknown): value is OptionTone {
  return typeof value === "string" && TONE_SET.has(value);
}
/** A hue, filled or soft. */
export function withSolid(hue: OptionHue, solid: boolean): OptionHueTone {
  return solid ? `${hue}Solid` : hue;
}

const ALIASES: Readonly<Record<string, OptionHueTone>> = {
  success: "green", primary: "green", green: "green", 绿: "green", 绿色: "green",
  sage: "teal", teal: "teal", cyan: "teal", mint: "teal", 青: "teal", 青色: "teal",
  blue: "blue", sky: "blue", indigo: "blue", 蓝: "blue", 蓝色: "blue",
  purple: "violet", violet: "violet", lavender: "violet", 紫: "violet", 紫色: "violet",
  pink: "pink", rose: "pink", magenta: "pink", 粉: "pink", 粉色: "pink",
  red: "red", error: "red", 红: "red", 红色: "red",
  orange: "orange", amber: "orange", brown: "orange", 橙: "orange", 橙色: "orange",
  yellow: "yellow", gold: "yellow", attention: "yellow", 黄: "yellow", 黄色: "yellow",
  olive: "olive", lime: "olive", 橄榄: "olive", 橄榄绿: "olive",
  gray: "gray", grey: "gray", slate: "gray", default: "gray", 灰: "gray", 灰色: "gray",
  dark: "greenSolid", black: "greenSolid", strong: "greenSolid",
};

/**
 * A tone, a stored pre-8.0 tone (`legacyTone`) or a colour name → one of the twenty tones; undefined for
 * anything else (arbitrary CSS colours are ignored on purpose). Case-insensitive. Use it on stored data.
 */
export function optionTone(nameOrTone: string | null | undefined): OptionHueTone | undefined {
  if (!nameOrTone) return undefined;
  const raw = nameOrTone.trim();
  if (TONE_SET.has(raw)) return raw as OptionHueTone;
  const key = raw.toLowerCase();
  return legacyTone(key) ?? LOWER_TONES.get(key) ?? ALIASES[key] ?? ALIASES[raw];
}

/** The tone a chip should use for an option: its `tone`, else its `color` name, else gray. */
export function resolveOptionTone(option: { tone?: string; color?: string } | null | undefined): OptionHueTone {
  return optionTone(option?.tone) ?? optionTone(option?.color) ?? "gray";
}

/** Hue angles (OKLCH) of the ten hues, for matching arbitrary colours. */
const HUE_ANGLES: readonly [OptionHue, number][] = [["red", 28], ["orange", 58], ["yellow", 85], ["olive", 120], ["green", 150], ["teal", 195], ["blue", 255], ["violet", 300], ["pink", 350]];

/**
 * Stored chip colour → tone: a colour name as `optionTone`, else a hex colour (`#7c3aed`) matched by its
 * OKLCH hue to the nearest of the ten hues (greys → gray). Unknown → undefined.
 */
export function colorTone(color: string | null | undefined): OptionHueTone | undefined {
  const named = optionTone(color);
  if (named || !color) return named;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return undefined;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const [, chroma, hue] = hexToOklch(`#${full}`);
  if (chroma < 0.035) return "gray";
  let best: OptionHue = "gray";
  let distance = Infinity;
  for (const [name, angle] of HUE_ANGLES) {
    const d = Math.min(Math.abs(hue - angle), 360 - Math.abs(hue - angle));
    if (d < distance) {
      distance = d;
      best = name;
    }
  }
  return best;
}
