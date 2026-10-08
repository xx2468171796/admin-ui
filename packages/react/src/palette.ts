/**
 * Colour system (5.0). A palette is ONE main hue family plus at most three accents that pair well
 * with it — owner rule: "全站最多 3 种颜色，同色系 + 互补 / 搭配好的颜色", no decorative colour bars.
 *
 * - primary family: buttons, icons, tags, links, progress, selected states, "正常"; every neutral
 *   (canvas, lines, surfaces, text) is tinted slightly with it so the page reads as one family.
 * - attention (amber-like): needs a look soon — due soon, waiting, delayed.
 * - danger (the complement): missing / failing / destructive.
 * - info (a quiet third hue): neutral information, used sparingly.
 *
 * createPalette() turns a spec (or a bare brand colour) into every CSS token for light or dark mode
 * and enforces text contrast (≥ 4.5 : 1 for text colours on their own backgrounds). Pure: no DOM.
 */

import { optionHueColors, optionHueVars } from "./option-palette.ts";

export type PaletteSpec = {
  id: string;
  /** Chinese name shown in pickers. */
  name: string;
  primary: string;
  attention: string;
  danger: string;
  info: string;
};

/** The six approved palettes (owner 2026-10-02); forest is the default. */
export const PALETTES = [
  { id: "forest", name: "森林绿", primary: "#357450", attention: "#a8691b", danger: "#b4492f", info: "#3f6283" },
  { id: "ocean", name: "深海蓝", primary: "#2f5f8f", attention: "#b0741c", danger: "#b8463a", info: "#2f7d74" },
  { id: "celadon", name: "青瓷", primary: "#2a7a78", attention: "#a8691b", danger: "#b8503a", info: "#4b5a8f" },
  { id: "graphite", name: "墨灰", primary: "#3d4a5c", attention: "#a86a1c", danger: "#b24a3a", info: "#4a7c5c" },
  { id: "clay", name: "暖陶", primary: "#9a5a3c", attention: "#9b7a12", danger: "#b03a3a", info: "#2f6f73" },
  { id: "plum", name: "黛紫", primary: "#5b4a8b", attention: "#a8691b", danger: "#b2424f", info: "#2e7570" },
] as const satisfies readonly PaletteSpec[];
export type PaletteId = (typeof PALETTES)[number]["id"];
export const DEFAULT_PALETTE: PaletteSpec = PALETTES[0];

export const validColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
export const isPaletteId = (value: unknown): value is PaletteId => PALETTES.some((p) => p.id === value);
export const paletteById = (id: string): PaletteSpec | undefined => PALETTES.find((p) => p.id === id);

const rgb = (value: string) => value.slice(1).match(/../g)!.map((n) => parseInt(n, 16));
/** a → b by weight (0 = a, 1 = b), both #rrggbb. */
export function mix(a: string, b: string, weight: number) {
  const from = rgb(a);
  const to = rgb(b);
  return "#" + from.map((v, i) => Math.round(v * (1 - weight) + (to[i] ?? v) * weight).toString(16).padStart(2, "0")).join("");
}
/** Rec. 709 luminance coefficients, indexed by channel. */
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
function luminance(color: string) {
  return rgb(color)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * (LUMINANCE_WEIGHTS[i] ?? 0), 0);
}
export function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Move `color` toward `toward` until it reaches `ratio` against `background`. */
function ensure(color: string, background: string, ratio: number, toward: string) {
  let c = color;
  for (let i = 0; i < 40 && contrast(c, background) < ratio; i++) c = mix(c, toward, 0.05);
  return c;
}

export type ThemeMode = "light" | "dark";

/** Accent tokens: the colour for text / icons, a tinted background and a border. */
export type AccentTokens = { color: string; soft: string; line: string };

/**
 * Every colour of one palette in one mode. `vars` maps CSS custom properties (without the
 * `--aui-` prefix) to values; AdminProvider sets them on its root.
 */
export function createPalette(input: string | PaletteSpec = DEFAULT_PALETTE, mode: ThemeMode = "light") {
  const spec: PaletteSpec = typeof input === "string" ? { ...DEFAULT_PALETTE, id: "custom", name: "自定义", primary: input } : input;
  for (const key of ["primary", "attention", "danger", "info"] as const)
    if (!validColor(spec[key])) throw new Error(`色卡颜色必须是六位十六进制，例如 #357450（${key}）`);
  const dark = mode === "dark";
  const white = "#ffffff";
  // Neutrals: a cool grey tinted with the main hue.
  const surface = dark ? mix("#141b20", spec.primary, 0.1) : white;
  const canvas = dark ? mix("#0b1014", spec.primary, 0.1) : mix("#e9ecef", spec.primary, 0.06);
  const surfaceSubtle = dark ? mix("#182027", spec.primary, 0.12) : mix("#f7f8f8", spec.primary, 0.04);
  const tile = dark ? mix("#172027", spec.primary, 0.12) : mix("#fbfcfc", spec.primary, 0.02);
  const line = dark ? mix("#28323a", spec.primary, 0.22) : mix("#dfe3e7", spec.primary, 0.09);
  const text = dark ? "#e5eaee" : mix("#1a2228", spec.primary, 0.15);
  const secondary = ensure(dark ? "#b8c2ca" : mix("#434c55", spec.primary, 0.12), surface, 7, dark ? white : "#000000");
  const note = ensure(dark ? "#8b979f" : mix("#6c757e", spec.primary, 0.1), surface, 4.5, dark ? white : "#000000");
  // Pure-neutral text ramp (no palette tint) for document reading / editor bodies, opt-in via `.aui-neutral-text`.
  // Light = Feishu's #1F2329 / #646A73 / #8F959E / #BBBFC4. 1 = body (≥ 7 : 1), 2 = secondary / caption (≥ 4.5 : 1),
  // 3 = placeholder / large text / icons (≥ 3 : 1), 4 = disabled (no contrast promise). Dark keeps the same steps.
  const towardText = dark ? white : "#000000";
  const neutralText = [
    ensure(dark ? "#e3e5e8" : "#1f2329", surface, 7, towardText),
    ensure(dark ? "#a7acb3" : "#646a73", surface, 4.5, towardText),
    ensure(dark ? "#7f858d" : "#8f959e", surface, 3, towardText),
    dark ? "#5a5f66" : "#bbbfc4",
  ] as const;
  const controlBorder = dark ? mix("#5c6a76", spec.primary, 0.15) : mix("#8793a2", spec.primary, 0.1);

  // Main family.
  const primary = dark ? ensure(mix(spec.primary, white, 0.28), surface, 4.5, white) : ensure(spec.primary, white, 4.8, "#000000");
  // Solid fills under white text (primary buttons, current step, avatars): ≥ 4.5 : 1 against white in both modes.
  const primaryFill = ensure(dark ? mix(spec.primary, "#000000", 0.1) : primary, white, 4.5, "#000000");
  const primaryDeep = dark ? mix(spec.primary, white, 0.55) : mix(spec.primary, "#1e293b", 0.3);
  const primaryMid = dark ? mix(spec.primary, white, 0.45) : mix(spec.primary, white, 0.18);
  const soft = dark ? mix(surface, spec.primary, 0.26) : mix(white, spec.primary, 0.09);
  const softStrong = dark ? mix(surface, spec.primary, 0.4) : mix(white, spec.primary, 0.2);
  const wash = dark ? mix(surface, spec.primary, 0.12) : mix(white, spec.primary, 0.04);
  const sidebar = mix(spec.primary, "#111827", dark ? 0.78 : 0.63);
  const sidebarDeep = mix(spec.primary, "#111827", dark ? 0.86 : 0.74);

  const accent = (base: string): AccentTokens => {
    const softBg = dark ? mix(surface, base, 0.22) : mix(white, base, 0.1);
    const color = dark ? ensure(mix(base, white, 0.35), softBg, 4.5, white) : ensure(base, softBg, 4.5, "#000000");
    return { color, soft: softBg, line: dark ? mix(surface, base, 0.5) : mix(white, base, 0.35) };
  };
  const attention = accent(spec.attention);
  const danger = accent(spec.danger);
  const info = accent(spec.info);

  const vars: Record<string, string> = {
    primary, "primary-fill": primaryFill, ink: primaryDeep, "primary-mid": primaryMid, soft, "soft-strong": softStrong, wash, border: softStrong,
    sidebar, sidebarDeep, canvas, surface, "surface-subtle": surfaceSubtle, tile, text, secondary, note, line,
    "control-border": controlBorder,
    "neutral-1": neutralText[0], "neutral-2": neutralText[1], "neutral-3": neutralText[2], "neutral-4": neutralText[3],
    // "正常 / 成功" is the main family (no fourth colour).
    success: dark ? primary : primaryDeep, "success-soft": soft, "success-line": softStrong,
    warning: attention.color, "warning-soft": attention.soft, "warning-line": attention.line,
    danger: danger.color, "danger-soft": danger.soft, "danger-line": danger.line,
    info: info.color, "info-soft": info.soft, "info-line": info.line,
  };
  // Ten option hues: green = primary, gray = note, the rest turned from the danger colour.
  const options = optionHueColors({ danger: danger.color, primary, note, surface, text, dark });
  Object.assign(vars, optionHueVars(options));
  return {
    id: spec.id,
    name: spec.name,
    mode,
    primary,
    ink: primaryDeep,
    primaryMid,
    soft,
    softStrong,
    wash,
    sidebar,
    sidebarDeep,
    attention,
    danger,
    info,
    /** Pure-neutral text ramp (`--aui-neutral-1..4`): body, secondary, placeholder, disabled. */
    neutralText,
    /** The ten option hues (`--aui-option-<hue>` / `-soft` / `-text` / `-solid`), see option-palette.ts. */
    options,
    /** Single-hue ramp for one series / ordered tiers (charts): deep → light. */
    series: [primary, primaryMid, dark ? mix(spec.primary, white, 0.65) : mix(spec.primary, "#111827", 0.36), dark ? mix(spec.primary, white, 0.8) : mix(spec.primary, white, 0.5)],
    vars,
  };
}
export type AdminPalette = ReturnType<typeof createPalette>;
