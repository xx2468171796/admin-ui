/**
 * Option colours (replaces the older seven tones): ten hues for select options, tags and
 * labels, all computed from the current palette so they follow palette changes and dark mode.
 *
 * - green = the palette's primary, gray = its note colour;
 * - the other eight take the lightness and chroma of the palette's danger colour (OKLCH) and only turn
 *   the hue (teal 195, blue 255, violet 300, pink 350, red 28, orange 58, yellow 85, olive 125), with a
 *   chroma cap per hue — the owner-approved review (form-controls-style, rujyqbpf3mg) did the same with
 *   CSS relative colours; here the values are precomputed so no browser needs `oklch(from …)`.
 *
 * Each hue gives four colours: `color` (dots, swatches), `soft` (tag background), `text` (tag text,
 * ≥ 4.5 : 1 on `soft`) and `solid` (filled tag under white text, ≥ 4.5 : 1). Pure: no DOM.
 */

export type OptionHue = "green" | "teal" | "blue" | "violet" | "pink" | "red" | "orange" | "yellow" | "olive" | "gray";
/** The ten hues in picker order. */
export const OPTION_HUES: readonly OptionHue[] = ["green", "teal", "blue", "violet", "pink", "red", "orange", "yellow", "olive", "gray"];
/** Chinese names shown in pickers. */
export const OPTION_HUE_LABELS: Readonly<Record<OptionHue, string>> = {
  green: "绿",
  teal: "青",
  blue: "蓝",
  violet: "紫",
  pink: "粉",
  red: "红",
  orange: "橙",
  yellow: "黄",
  olive: "橄榄",
  gray: "灰",
};

/** Colours of one hue: dot / swatch, tag background, tag text, filled tag. */
export type OptionHueColors = { color: string; soft: string; text: string; solid: string };

/** Hue angle, chroma cap and lightness lift of the eight turned hues (the review's numbers). */
const TURNS: Readonly<Record<Exclude<OptionHue, "green" | "gray">, { h: number; c: number; dl: number }>> = {
  teal: { h: 195, c: 0.09, dl: 0 },
  blue: { h: 255, c: 0.13, dl: 0 },
  violet: { h: 300, c: 0.13, dl: 0 },
  pink: { h: 350, c: 0.13, dl: 0 },
  red: { h: 28, c: 0.14, dl: 0 },
  orange: { h: 58, c: 0.13, dl: 0.03 },
  yellow: { h: 85, c: 0.12, dl: 0.02 },
  olive: { h: 125, c: 0.11, dl: 0 },
};

// ---------------------------------------------------------------- sRGB ↔ OKLCH

type Rgb = [number, number, number];
const hexRgb = (hex: string): Rgb => {
  const n = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as Rgb;
};
const rgbHex = (rgb: Rgb) => "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** `#rrggbb` → [L, C, H°] in OKLCH. */
export function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexRgb(hex).map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  return [L, Math.hypot(A, B), (H + 360) % 360];
}

const oklchToLinear = (L: number, C: number, H: number): Rgb => {
  const rad = (H * Math.PI) / 180;
  const A = C * Math.cos(rad);
  const B = C * Math.sin(rad);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH → `#rrggbb`; out-of-gamut colours keep L and H and lose chroma until they fit. */
export function oklchToHex(L: number, C: number, H: number): string {
  const l = Math.min(1, Math.max(0, L));
  let lo = 0;
  let hi = C;
  if (!inGamut(oklchToLinear(l, hi, H))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(l, mid, H))) lo = mid;
      else hi = mid;
    }
    hi = lo;
  }
  return rgbHex(oklchToLinear(l, hi, H).map(toGamma) as Rgb);
}

// ---------------------------------------------------------------- contrast helpers (as palette.ts)

const mixHex = (a: string, b: string, weight: number) => {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return rgbHex(x.map((v, i) => v * (1 - weight) + (y[i] ?? v) * weight) as Rgb);
};
const luminance = (hex: string) => {
  const [r, g, b] = hexRgb(hex).map(toLinear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const ensure = (color: string, background: string, min: number, toward: string) => {
  let c = color;
  for (let i = 0; i < 40 && ratio(c, background) < min; i++) c = mixHex(c, toward, 0.06);
  return c;
};

export type OptionPaletteInput = {
  /** The palette's danger colour as shown (light or dark), the lightness / chroma source. */
  danger: string;
  /** Primary as shown (green). */
  primary: string;
  /** Note colour (gray). */
  note: string;
  /** Panel colour tags sit on. */
  surface: string;
  /** Body text colour (light mode text is pulled toward it). */
  text: string;
  dark: boolean;
};

/** Colours of the ten option hues for one palette in one mode. */
export function optionHueColors({ danger, primary, note, surface, text, dark }: OptionPaletteInput): Record<OptionHue, OptionHueColors> {
  const [L, C] = hexToOklch(danger);
  const base = (hue: OptionHue): string => {
    if (hue === "green") return primary;
    if (hue === "gray") return note;
    const turn = TURNS[hue];
    return oklchToHex(L + turn.dl, Math.min(C, turn.c), turn.h);
  };
  const white = "#ffffff";
  const out = {} as Record<OptionHue, OptionHueColors>;
  for (const hue of OPTION_HUES) {
    const color = base(hue);
    // Review formula: light text = hue 88% + text, background = hue 14% on the panel;
    // dark text = hue 70% + white, background = hue 22% on the panel. Then make the text readable.
    const soft = mixHex(surface, color, dark ? 0.22 : 0.14);
    const rawText = dark ? mixHex(color, white, 0.3) : mixHex(color, text, 0.12);
    const tagText = ensure(rawText, soft, 4.5, dark ? white : "#000000");
    const solid = ensure(mixHex(color, "#000000", dark ? 0.38 : 0.12), white, 4.5, "#000000");
    out[hue] = { color, soft, text: tagText, solid };
  }
  return out;
}

/** CSS custom properties (without `--aui-`) for `createPalette().vars`: option-<hue>, -soft, -text, -solid. */
export function optionHueVars(colors: Record<OptionHue, OptionHueColors>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const hue of OPTION_HUES) {
    const c = colors[hue];
    vars[`option-${hue}`] = c.color;
    vars[`option-${hue}-soft`] = c.soft;
    vars[`option-${hue}-text`] = c.text;
    vars[`option-${hue}-solid`] = c.solid;
  }
  return vars;
}
