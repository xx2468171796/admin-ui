"use client";
import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TooltipLayer } from "./tooltip.tsx";
import { AdminDefaultsProvider } from "./admin-defaults-context.tsx";
import type { AdminDefaults } from "./admin-defaults.ts";
import { sharedContext } from "./context.ts";
import { createPalette, DEFAULT_PALETTE, isPaletteId, paletteById, validColor, type AdminPalette, type PaletteSpec } from "./palette.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/core.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/core.css";
export { createPalette, PALETTES, DEFAULT_PALETTE, paletteById, isPaletteId, type PaletteSpec, type PaletteId, type AdminPalette } from "./palette.ts";

export const FONT_SIZE_PRESETS = [
  { id: "small", name: "小号", scale: 0.9 },
  { id: "medium", name: "中号", scale: 1 },
  { id: "mediumLarge", name: "中大号", scale: 1.075 },
  { id: "large", name: "大号", scale: 1.15 },
  { id: "xlarge", name: "特大号", scale: 1.3 },
] as const;
export type AdminFontSize = (typeof FONT_SIZE_PRESETS)[number]["id"];
const isFontSize = (value: string | null): value is AdminFontSize => FONT_SIZE_PRESETS.some((preset) => preset.id === value);

/** A palette choice: an approved palette id ("forest" …), a full spec, or a bare brand colour (#rrggbb, default accents). */
export type PaletteChoice = string | PaletteSpec;
const resolveChoice = (choice: PaletteChoice): PaletteSpec | string =>
  typeof choice !== "string" ? choice : isPaletteId(choice) ? paletteById(choice)! : validColor(choice) ? choice : DEFAULT_PALETTE;
const choiceKey = (choice: PaletteChoice) => (typeof choice === "string" ? choice : JSON.stringify(choice));

type ThemeContextValue = {
  /** The palette in effect (resolved for the current mode). */
  palette: AdminPalette;
  /** The user's / host's choice: palette id, spec or brand colour. */
  paletteChoice: PaletteChoice;
  /** Change the palette (persisted per storageKey when it is an id or a colour). */
  setPalette: (choice: PaletteChoice) => void;
  fontSize: AdminFontSize;
  setFontSize: (size: AdminFontSize) => void;
  portal: HTMLElement | null;
  motionEnabled: boolean;
  /** Resolved light/dark (system already applied). Canvas charts need it: they cannot read CSS variables. */
  mode: "light" | "dark";
  /** What is chosen: 浅色 / 深色 / 跟随系统 — the user's choice (AppearancePopover, AccountMenu) or the host's `mode`. */
  modeChoice: AdminColorMode;
  /** Change 浅色 / 深色 / 跟随系统; stored per storageKey and wins over the host's `mode` from then on. */
  setMode: (mode: AdminColorMode) => void;
  /** AdminProvider density (decides the default table row height: compact 40px, comfortable 48px). */
  density: "comfortable" | "compact";
};
const ThemeContext = sharedContext<ThemeContextValue>("theme");
export type AdminColorMode = "light" | "dark" | "system";
const isColorMode = (value: string | null): value is AdminColorMode => value === "light" || value === "dark" || value === "system";
/** 外观 choices in display order (AppearancePopover, AccountMenu). */
export const COLOR_MODES: readonly { id: AdminColorMode; name: string }[] = [
  { id: "light", name: "浅色" },
  { id: "dark", name: "深色" },
  { id: "system", name: "跟随系统" },
];

export type AdminProviderProps = {
  children: ReactNode;
  /** localStorage key prefix for the user's palette / font size (one per project). */
  storageKey: string;
  /** Project palette: an approved id (default "forest"), a full spec, or a brand colour. Users can override it with AppearanceButton. */
  palette?: PaletteChoice;
  className?: string;
  /** system respects prefers-reduced-motion; none disables all SDK motion. */
  motion?: "system" | "none";
  /**
   * Light / dark / follow the system. This is the project default: once the user picks 外观 (AppearanceButton,
   * AccountMenu) that choice is stored under `${storageKey}:mode` and wins — until the host changes `mode` itself.
   */
  mode?: AdminColorMode;
  /** compact (default) = 40px table rows; comfortable = 48px. */
  density?: "comfortable" | "compact";
  /** Global type scale; users can change it with FontSizePicker. Defaults to mediumLarge. */
  defaultFontSize?: AdminFontSize;
  /**
   * Locale defaults for everything inside (components' own props still win): `timeZone` (IANA, default the
   * browser's), `currency` (ISO 4217 code or symbol, default none), `phoneCountry` (calling code, default from
   * the browser locale). See `useAdminDefaults`.
   */
  defaults?: Partial<AdminDefaults>;
};

/** One provider per admin root. Tokens and portals stay inside this root; no document/global mutations. */
export function AdminProvider({ children, storageKey, palette: projectPalette = DEFAULT_PALETTE.id, className = "", motion = "system", mode = "light", density = "compact", defaultFontSize = "mediumLarge", defaults }: AdminProviderProps) {
  const [choice, setChoice] = useState<PaletteChoice>(projectPalette);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [fontSize, updateFontSize] = useState<AdminFontSize>(defaultFontSize);
  const [fontSizeLoaded, setFontSizeLoaded] = useState<string | null>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [darkSystem, setDarkSystem] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDarkSystem(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setMotionAllowed(!media.matches);
      setVisible(document.visibilityState !== "hidden");
    };
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const motionEnabled = motion === "system" && motionAllowed && visible;
  // The user's 外观 choice (stored) wins over the host's default `mode`; hosts that never show the picker never store one.
  const [userMode, setUserMode] = useState<AdminColorMode | null>(null);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(`${storageKey}:mode`); } catch {}
    setUserMode(isColorMode(stored) ? stored : null);
  }, [storageKey]);
  const setMode = (next: AdminColorMode) => {
    setUserMode(next);
    try { localStorage.setItem(`${storageKey}:mode`, next); } catch {}
  };
  // The host switching `mode` itself (its own light / dark button) wins again: the stored choice is dropped.
  const hostMode = useRef(mode);
  useEffect(() => {
    if (hostMode.current === mode) return;
    hostMode.current = mode;
    setUserMode(null);
    try { localStorage.removeItem(`${storageKey}:mode`); } catch {}
  }, [mode, storageKey]);
  const modeChoice = userMode ?? mode;
  const resolvedMode = modeChoice === "system" ? (darkSystem ? "dark" : "light") : modeChoice;

  // The user's saved palette (an id or a colour) wins over the project's default.
  const projectKey = choiceKey(projectPalette);
  useEffect(() => {
    let next: PaletteChoice = projectPalette;
    try {
      const stored = localStorage.getItem(`${storageKey}:palette`);
      if (stored && (isPaletteId(stored) || validColor(stored))) next = stored;
    } catch {}
    setChoice(next);
    setLoaded(storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, projectKey]);
  useEffect(() => {
    if (loaded !== storageKey || typeof choice !== "string") return;
    try {
      if (choice === projectPalette) localStorage.removeItem(`${storageKey}:palette`);
      else localStorage.setItem(`${storageKey}:palette`, choice);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, loaded, storageKey]);
  useEffect(() => {
    let next = defaultFontSize;
    try {
      const stored = localStorage.getItem(`${storageKey}:font-size`);
      if (isFontSize(stored)) next = stored;
    } catch {}
    updateFontSize(next);
    setFontSizeLoaded(storageKey);
  }, [storageKey, defaultFontSize]);
  useEffect(() => {
    if (fontSizeLoaded !== storageKey) return;
    try { localStorage.setItem(`${storageKey}:font-size`, fontSize); } catch {}
  }, [fontSize, fontSizeLoaded, storageKey]);

  const palette = useMemo(() => createPalette(resolveChoice(choice), resolvedMode), [choiceKey(choice), resolvedMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const setPalette = (next: PaletteChoice) => {
    if (typeof next === "string" && !isPaletteId(next) && !validColor(next)) throw new Error("色卡不存在，品牌色要写成 #rrggbb");
    setChoice(next);
  };
  const style = Object.fromEntries(Object.entries(palette.vars).map(([key, v]) => [`--aui-${key}`, v])) as CSSProperties & { "--aui-font-scale"?: number };
  style["--aui-font-scale"] = FONT_SIZE_PRESETS.find((preset) => preset.id === fontSize)!.scale;
  return (
    <ThemeContext.Provider value={{ palette, paletteChoice: choice, setPalette, fontSize, setFontSize: updateFontSize, portal, motionEnabled, mode: resolvedMode, modeChoice, setMode, density }}>
      <div ref={rootRef} className={`adminui ${className}`} style={style} data-adminui="1" data-aui-mode={resolvedMode} data-aui-palette={palette.id} data-aui-font-size={fontSize} data-density={density} data-aui-motion={motion} data-aui-paused={!visible}>
        <div className="aui-portal" ref={setPortal} />
        <AdminDefaultsProvider defaults={defaults}><TooltipLayer rootRef={rootRef} portal={portal}>{children}</TooltipLayer></AdminDefaultsProvider>
      </div>
    </ThemeContext.Provider>
  );
}
export function useAdminTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("adminUI 组件必须位于 AdminProvider 内");
  return ctx;
}
