"use client";
import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { TooltipLayer } from "./tooltip.tsx";
import { AdminDefaultsProvider } from "./admin-defaults-context.tsx";
import type { AdminDefaults } from "./admin-defaults.ts";
import { sharedContext } from "./context.ts";
import { useMediaQuery } from "./media-query.ts";
import { createPalette, DEFAULT_PALETTE, FONT_SIZE_PRESETS, isPaletteId, paletteById, validColor, type AdminFontSize, type AdminPalette, type PaletteSpec } from "./palette.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/core.css";
export { createPalette, PALETTES, DEFAULT_PALETTE, paletteById, isPaletteId, type PaletteSpec, type PaletteId, type AdminPalette } from "./palette.ts";
export { FONT_SIZE_PRESETS, adminThemeBootScript, type AdminFontSize, type AdminThemeBootOptions } from "./palette.ts";

const isFontSize = (value: string | null): value is AdminFontSize => FONT_SIZE_PRESETS.some((preset) => preset.id === value);

/*
 * The user's 外观 choices live in localStorage (`${storageKey}:palette` / `:mode` / `:font-size`). They are read with
 * useSyncExternalStore: a client-only render (Vite SPA) paints the stored choice on the very first frame (8.10: it
 * used to start from the defaults and switch in an effect — a white flash for dark users and ECharts initialised
 * twice); SSR renders the defaults, hydrates on them and re-renders before the effects (adminThemeBootScript paints
 * the stored choice even before hydration). Storage that throws (Safari private mode) falls back to memory.
 */
const memoryStore = new Map<string, string | null>();
const storeListeners = new Set<() => void>();
function readStored(key: string): string | null {
  if (memoryStore.has(key)) return memoryStore.get(key) ?? null;
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    memoryStore.delete(key);
  } catch {
    memoryStore.set(key, value);
  }
  for (const notify of storeListeners) notify();
}
function subscribeStored(notify: () => void) {
  storeListeners.add(notify);
  // another tab changed the same key
  if (typeof window !== "undefined") window.addEventListener("storage", notify);
  return () => {
    storeListeners.delete(notify);
    if (typeof window !== "undefined") window.removeEventListener("storage", notify);
  };
}
const serverStored = () => null;
function useStored(key: string): string | null {
  return useSyncExternalStore(subscribeStored, () => readStored(key), serverStored);
}
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
const readVisible = () => document.visibilityState !== "hidden";
const serverVisible = () => true;

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
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const darkSystem = useMediaQuery("(prefers-color-scheme: dark)");
  // server / first hydration render: reduced (no motion), as before
  const motionAllowed = !useMediaQuery("(prefers-reduced-motion: reduce)", true);
  const visible = useSyncExternalStore(subscribeVisibility, readVisible, serverVisible);
  const motionEnabled = motion === "system" && motionAllowed && visible;

  // The user's 外观 choice (stored) wins over the host's default `mode`; hosts that never show the picker never store one.
  const modeKey = `${storageKey}:mode`;
  const storedMode = useStored(modeKey);
  const userMode = isColorMode(storedMode) ? storedMode : null;
  const setMode = (next: AdminColorMode) => writeStored(modeKey, next);
  // The host switching `mode` itself (its own light / dark button) wins again: the stored choice is dropped.
  const hostMode = useRef(mode);
  useEffect(() => {
    if (hostMode.current === mode) return;
    hostMode.current = mode;
    writeStored(modeKey, null);
  }, [mode, modeKey]);
  const modeChoice = userMode ?? mode;
  const resolvedMode = modeChoice === "system" ? (darkSystem ? "dark" : "light") : modeChoice;

  // The user's saved palette (an id or a colour) wins over the project's default; a full spec passed to setPalette
  // is not persisted (kept in memory until storageKey or the project palette changes).
  const paletteKey = `${storageKey}:palette`;
  const projectKey = choiceKey(projectPalette);
  const storedPalette = useStored(paletteKey);
  const [specChoice, setSpecChoice] = useState<{ scope: string; spec: PaletteSpec } | null>(null);
  const scope = `${storageKey}\n${projectKey}`;
  const choice: PaletteChoice =
    specChoice?.scope === scope ? specChoice.spec : storedPalette && (isPaletteId(storedPalette) || validColor(storedPalette)) ? storedPalette : projectPalette;
  const setPalette = (next: PaletteChoice) => {
    if (typeof next === "string" && !isPaletteId(next) && !validColor(next)) throw new Error("色卡不存在，品牌色要写成 #rrggbb");
    if (typeof next !== "string") return setSpecChoice({ scope, spec: next });
    setSpecChoice(null);
    writeStored(paletteKey, next === projectPalette ? null : next);
  };

  const fontKey = `${storageKey}:font-size`;
  const storedFont = useStored(fontKey);
  const fontSize: AdminFontSize = isFontSize(storedFont) ? storedFont : defaultFontSize;
  const setFontSize = (next: AdminFontSize) => writeStored(fontKey, next);

  const paletteChoice = choiceKey(choice);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the choice's content (`paletteChoice`): an inline palette object is new each render.
  const palette = useMemo(() => createPalette(resolveChoice(choice), resolvedMode), [paletteChoice, resolvedMode]);
  const style = Object.fromEntries(Object.entries(palette.vars).map(([key, v]) => [`--aui-${key}`, v])) as CSSProperties & { "--aui-font-scale"?: number };
  style["--aui-font-scale"] = FONT_SIZE_PRESETS.find((preset) => preset.id === fontSize)!.scale;
  return (
    <ThemeContext.Provider value={{ palette, paletteChoice: choice, setPalette, fontSize, setFontSize, portal, motionEnabled, mode: resolvedMode, modeChoice, setMode, density }}>
      <div ref={rootRef} className={`adminui ${className}`} style={style} data-adminui="1" data-aui-storage={storageKey} suppressHydrationWarning data-aui-mode={resolvedMode} data-aui-palette={palette.id} data-aui-font-size={fontSize} data-density={density} data-aui-motion={motion} data-aui-paused={!visible}>
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
