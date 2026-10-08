/**
 * Pure rules of the dark Tooltip, the 「?」 HelpTip card and keyboard shortcuts:
 * where a bubble / card goes, which shortcut notation the current system uses, when a hover is "warm".
 * No React, no DOM writes; unit-tested in test/tooltip-core.test.ts.
 */

export type TipSide = "top" | "bottom";
export type TipRect = { top: number; left: number; right: number; bottom: number; width: number; height: number };
export type TipSize = { width: number; height: number };
export type TipViewport = { width: number; height: number };
export type TipPlacement = { top: number; left: number; side: TipSide; /** Arrow x inside the bubble / card, px. */ arrow: number };

/** Hover delay before a bubble shows (ms) — instant while "warm" (another bubble just closed). */
export const TIP_DELAY = 400;
/** How long after a bubble closes the next one still shows at once (sweeping along a toolbar). */
export const TIP_WARM_MS = 500;
/** 「已复制」 / 「复制失败」 bubble time (ms). */
export const COPY_FEEDBACK_MS = 1500;
const EDGE = 8;

/**
 * A one-line bubble: centred over the anchor, `prefer` side (default top) and flipped when there is no
 * room; kept 8px inside the viewport; the arrow keeps pointing at the anchor centre.
 */
export function placeTip(anchor: TipRect, tip: TipSize, view: TipViewport, prefer: TipSide = "top", gap = 8): TipPlacement {
  let side = prefer;
  if (side === "top" && anchor.top - tip.height - gap < EDGE) side = "bottom";
  else if (side === "bottom" && anchor.bottom + tip.height + gap > view.height - EDGE && anchor.top - tip.height - gap >= EDGE) side = "top";
  const top = side === "top" ? anchor.top - tip.height - gap : anchor.bottom + gap;
  const centre = anchor.left + anchor.width / 2;
  const left = clamp(centre - tip.width / 2, EDGE, view.width - tip.width - EDGE);
  return { top, left, side, arrow: clamp(centre - left, 10, Math.max(10, tip.width - 10)) };
}

/**
 * The 「?」 card: opens BELOW the 「?」, left-aligned with it (so a title on the left never sends the card over
 * the side menu); only when it would leave the viewport does it shift back left, and only when there is no
 * room below does it go above. The arrow points at the 「?」.
 */
export function placeCard(anchor: TipRect, card: TipSize, view: TipViewport, gap = 8): TipPlacement {
  const roomBelow = view.height - anchor.bottom - gap - EDGE;
  const side: TipSide = card.height > roomBelow && anchor.top - gap - card.height >= EDGE ? "top" : "bottom";
  const top = side === "bottom" ? anchor.bottom + gap : anchor.top - gap - card.height;
  const left = clamp(anchor.left - 4, EDGE, view.width - card.width - EDGE);
  const centre = anchor.left + anchor.width / 2;
  return { top, left, side, arrow: clamp(centre - left, 14, Math.max(14, card.width - 14)) };
}

/** Show at once (warm) or after TIP_DELAY? `lastHiddenAt` = when the previous bubble closed. */
export function tipDelay(now: number, lastHiddenAt: number, visible: boolean): number {
  return visible || now - lastHiddenAt < TIP_WARM_MS ? 0 : TIP_DELAY;
}

// ---------------------------------------------------------------- shortcuts

export type ShortcutPlatform = "mac" | "other";

/** Mac or not, from a navigator-like object (userAgentData.platform, then platform / userAgent). */
export function detectPlatform(nav?: { platform?: string; userAgent?: string; userAgentData?: { platform?: string } } | null): ShortcutPlatform {
  if (!nav) return "other";
  const text = `${nav.userAgentData?.platform ?? ""} ${nav.platform ?? ""} ${nav.userAgent ?? ""}`;
  return /mac|iphone|ipad|ipod/i.test(text) ? "mac" : "other";
}

const NAMES: Record<string, { mac: string; other: string }> = {
  mod: { mac: "⌘", other: "Ctrl" },
  cmd: { mac: "⌘", other: "Ctrl" },
  meta: { mac: "⌘", other: "Win" },
  ctrl: { mac: "⌃", other: "Ctrl" },
  control: { mac: "⌃", other: "Ctrl" },
  alt: { mac: "⌥", other: "Alt" },
  option: { mac: "⌥", other: "Alt" },
  shift: { mac: "⇧", other: "Shift" },
  enter: { mac: "↵", other: "Enter" },
  return: { mac: "↵", other: "Enter" },
  esc: { mac: "Esc", other: "Esc" },
  escape: { mac: "Esc", other: "Esc" },
  backspace: { mac: "⌫", other: "Backspace" },
  delete: { mac: "⌦", other: "Del" },
  del: { mac: "⌦", other: "Del" },
  tab: { mac: "Tab", other: "Tab" },
  space: { mac: "空格", other: "空格" },
  up: { mac: "↑", other: "↑" },
  down: { mac: "↓", other: "↓" },
  left: { mac: "←", other: "←" },
  right: { mac: "→", other: "→" },
  arrowup: { mac: "↑", other: "↑" },
  arrowdown: { mac: "↓", other: "↓" },
  arrowleft: { mac: "←", other: "←" },
  arrowright: { mac: "→", other: "→" },
  pageup: { mac: "PgUp", other: "PgUp" },
  pagedown: { mac: "PgDn", other: "PgDn" },
};

/** Keys that menus write as symbols on every system (⇧ ↵ ⌫). */
const COMPACT_KEYS = new Set(["shift", "enter", "return", "backspace"]);

/** Split 「Mod+Shift+K」 / ["Mod", "K"] into keys. A lone 「+」 stays a key (「Ctrl +」). */
export function shortcutKeys(keys: string | readonly string[]): string[] {
  if (typeof keys !== "string") return keys.filter(Boolean).map(String);
  const parts = keys.split(/\s*\+\s*/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? "";
    if (part === "" && i === parts.length - 1 && i > 0) out.push("+");
    else if (part !== "") out.push(part);
  }
  return out;
}

/**
 * One keycap per key in the current system's notation: Windows 「Ctrl」「K」, Mac 「⌘」「K」 (* only the current system's way, never 「Ctrl/⌘」). Letters are upper-cased; unknown keys pass through.
 */
export function formatShortcut(keys: string | readonly string[], platform: ShortcutPlatform, compact = false): string[] {
  return shortcutKeys(keys).map((key) => {
    const known = NAMES[key.toLowerCase()];
    // Menus: short symbols on every system — 「Ctrl ⇧ ↵」, not 「Ctrl+Shift+Enter」.
    if (known && compact && COMPACT_KEYS.has(key.toLowerCase())) return known.mac;
    if (known) return known[platform];
    return key.length === 1 ? key.toUpperCase() : key;
  });
}

/** Screen-reader text of a shortcut: 「Ctrl 加 K」. */
export function shortcutLabel(keys: string | readonly string[], platform: ShortcutPlatform): string {
  const spoken: Record<string, string> = { "⌘": "Command", "⌃": "Control", "⌥": "Option", "⇧": "Shift", "↵": "回车", "⌫": "删除", "⌦": "向前删除" };
  return formatShortcut(keys, platform).map((k) => spoken[k] ?? k).join(" 加 ");
}

/** Does a keyboard event match 「Mod+K」 on this platform? Mod = ⌘ on Mac, Ctrl elsewhere. */
export function matchShortcut(
  event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  keys: string | readonly string[],
  platform: ShortcutPlatform,
): boolean {
  const list = shortcutKeys(keys).map((k) => k.toLowerCase());
  const want = { ctrl: false, meta: false, alt: false, shift: false };
  let main = "";
  for (const key of list) {
    if (key === "mod" || key === "cmd") (platform === "mac" ? (want.meta = true) : (want.ctrl = true));
    else if (key === "ctrl" || key === "control") want.ctrl = true;
    else if (key === "meta") want.meta = true;
    else if (key === "alt" || key === "option") want.alt = true;
    else if (key === "shift") want.shift = true;
    else main = key;
  }
  const pressed = event.key.toLowerCase();
  const shiftedSymbol = main.length === 1 && !/[a-z0-9]/.test(main);
  return (
    (pressed === main || (main === "esc" && pressed === "escape") || (main === "enter" && pressed === "enter")) &&
    event.ctrlKey === want.ctrl &&
    event.metaKey === want.meta &&
    event.altKey === want.alt &&
    (shiftedSymbol || event.shiftKey === want.shift)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
