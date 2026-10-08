import type { OptionHue } from "./option-palette.ts";
import { mix } from "./palette.ts";

/**
 * Data-visualisation colours. Pure data, no DOM. Every chart colour comes from the palette:
 * `chartColors(palette)` and the option-builder tokens below (`VIZ_BRAND`, `vizBrandStep(i)`, `vizCategory(i)` …),
 * resolved by AdminChart. The fixed hex tables here are internal fallbacks for marks that have no palette yet.
 */
/** Diverging blue ↔ red with a neutral grey midpoint (never a hue at the midpoint). Internal. */
const VIZ_DIVERGING = {
  light: { negative: "#2a78d6", mid: "#f0efec", positive: "#e34948" },
  dark: { negative: "#3987e5", mid: "#383835", positive: "#e66767" },
} as const;

/** good / warning / bad for marks (dots, bands, badges) before the palette is known. Internal. */
export const VIZ_STATUS = {
  light: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", bad: "#d03b3b", neutral: "#898781" },
  dark: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", bad: "#e66767", neutral: "#898781" },
} as const;

export type VizMode = "light" | "dark";
/** Status / diverging fallbacks of one mode (option builders; AdminChart swaps them for the palette's). Internal. */
export const vizColors = (mode: VizMode) => ({
  diverging: VIZ_DIVERGING[mode],
  status: VIZ_STATUS[mode],
});

/**
 * The host's brand colour inside a chart option. Option builders stay pure and theme-free; AdminChart
 * swaps the token for the live `--aui-primary` so single-series charts follow AppearanceButton.
 * A 2-digit hex alpha may be appended (`${VIZ_BRAND}3d`).
 */
export const VIZ_BRAND = "aui:brand";
/** Brand-hued magnitude step, 0 (lightest = panel) … 12 (darkest = primary). */
export const vizBrandStep = (step: number) => `aui:brand-step:${step}`;

// ---------------------------------------------------------------- chart colours from the palette (审阅 06)

/**
 * Categories take eight of the ten option hues in this fixed order — neighbours far apart
 * in hue; green is the primary (single series / 「本期」), gray is 「其他」. Being computed from the palette,
 * they follow AppearanceButton and dark mode, and a 「报价」 option shows the same colour in tables and charts.
 * Same-lightness hues separate less under colour blindness: always keep a
 * legend / direct labels / 「查看数据」, ≤ 6 lines and ≤ 5 donut slices (+ 其他).
 */
export const VIZ_CATEGORY_HUES: readonly OptionHue[] = ["blue", "orange", "teal", "pink", "olive", "violet", "yellow", "red"];

/**
 * Option-builder tokens resolved by AdminChart with the live palette (builders stay pure and theme-free).
 * Each may carry a 2-digit hex alpha after the trailing colon: `${vizCategory(1)}3d`.
 */
export const vizCategory = (index: number) => `aui:cat:${index}:`;
/** Body text (target ticks), secondary (value labels), note (in-progress words), track (empty bullet). */
export const VIZ_TEXT = "aui:text:";
export const VIZ_SECONDARY = "aui:secondary:";
export const VIZ_NOTE = "aui:note:";
export const VIZ_TRACK = "aui:track:";
/** The panel colour (gaps between stacked segments). */
export const VIZ_SURFACE = "aui:surface:";
/** 「其他」 (and anything past the eighth category: never cycle). */
export const VIZ_OTHER = "aui:other:";
/** An option's own tag colour (`OptionHue` or a tone like "warning" resolved by the host first). */
export const vizOptionColor = (hue: OptionHue) => `aui:option:${hue}:`;

export type ChartColors = {
  /** Single series, ordered tiers, funnels, bullets, sparklines: one colour on every chart. */
  brand: string;
  categorical: readonly string[];
  other: string;
  /** Panel → brand in 13 steps (heat cells start at the panel colour in dark mode too, no light blocks). */
  sequential: readonly string[];
  diverging: { negative: string; mid: string; positive: string };
  status: { good: string; warning: string; bad: string; neutral: string };
  options: Readonly<Record<OptionHue, string>>;
  /** Gridlines = line colour 62% on the panel; bullet / ring tracks. */
  grid: string;
  track: string;
  text: string;
  secondary: string;
  note: string;
  line: string;
  surface: string;
  /** Hover band behind a bar (body text 4.5%, dark 8%). */
  hover: string;
  mode: VizMode;
};

type PaletteLike = { mode: VizMode; primary: string; options: Readonly<Record<OptionHue, { color: string }>>; vars: Readonly<Record<string, string>> };

const hex = (v: string | undefined, fallback: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
const alphaHex = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, "0");

/** Every chart colour of one palette in one mode (`useAdminTheme().palette`). Pure. */
export function chartColors(palette: PaletteLike): ChartColors {
  const dark = palette.mode === "dark";
  const v = palette.vars;
  const surface = hex(v.surface, dark ? "#141b20" : "#ffffff");
  const line = hex(v.line, dark ? "#28323a" : "#dfe3e7");
  const text = hex(v.text, dark ? "#e5eaee" : "#1a2228");
  const brand = palette.primary;
  const options = Object.fromEntries(Object.entries(palette.options).map(([hue, c]) => [hue, c.color])) as Record<OptionHue, string>;
  return {
    brand,
    categorical: VIZ_CATEGORY_HUES.map((hue) => options[hue]),
    other: options.gray,
    sequential: Array.from({ length: 13 }, (_, i) => mix(surface, brand, 0.08 + (0.92 * i) / 12)),
    diverging: { negative: hex(v.info, "#2a78d6"), mid: line, positive: hex(v.danger, "#d03b3b") },
    status: { good: brand, warning: hex(v.warning, "#b7791f"), bad: hex(v.danger, "#d03b3b"), neutral: hex(v.note, "#6c757e") },
    options,
    grid: mix(line, surface, 0.38),
    track: mix(line, surface, 0.3),
    text,
    secondary: hex(v.secondary, text),
    note: hex(v.note, text),
    line,
    surface,
    hover: `${text}${alphaHex(dark ? 0.08 : 0.045)}`,
    mode: palette.mode,
  };
}

const TOKEN = /^aui:(cat|other|option|surface|text|secondary|note|track):([a-z0-9]*):?([0-9a-f]{2})?$/i;

/** One token → colour (null = not a chart token). Categories past the eighth fold into 「其他」. */
export function resolveVizToken(value: string, colors: ChartColors): string | null {
  const m = TOKEN.exec(value);
  if (!m) return null;
  const alpha = m[3] ?? "";
  if (m[1] === "other") return colors.other + alpha;
  if (m[1] === "surface") return colors.surface + alpha;
  if (m[1] === "text") return colors.text + alpha;
  if (m[1] === "secondary") return colors.secondary + alpha;
  if (m[1] === "note") return colors.note + alpha;
  if (m[1] === "track") return colors.track + alpha;
  if (m[1] === "option") return (colors.options[m[2] as OptionHue] ?? colors.other) + alpha;
  const i = Number(m[2]);
  return (Number.isInteger(i) && i >= 0 && i < colors.categorical.length ? colors.categorical[i]! : colors.other) + alpha;
}
