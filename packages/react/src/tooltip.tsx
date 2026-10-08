"use client";
/**
 * The dark Tooltip and keyboard keycaps (item 5).
 *
 * One delegated layer per AdminProvider root replaces the browser's native `title`: anything inside the root
 * with `data-tip="…"` (optionally `data-tip-keys="Mod+K"`, `data-tip-side="bottom"`, `data-tip-truncated`)
 * gets a dark bubble with an arrow — after 0.4 s on hover, at once while sweeping along a toolbar, at once
 * on keyboard focus; Esc / leaving / scrolling closes it. `Tooltip` and `tipProps` only write those
 * attributes, so the SDK and hosts never mount a component per bubble. Rules in tooltip-core.ts.
 */
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  COPY_FEEDBACK_MS,
  detectPlatform,
  formatShortcut,
  placeTip,
  shortcutLabel,
  tipDelay,
  type ShortcutPlatform,
  type TipPlacement,
  type TipSide,
} from "./tooltip-core.ts";

type Bubble = {
  anchor: HTMLElement;
  text: string;
  keys?: string;
  side: TipSide;
  tone?: "ok" | "error";
};

type Flash = (anchor: HTMLElement, text: string, options?: { tone?: "ok" | "error"; ms?: number; side?: TipSide }) => void;
const FlashContext = /* @__PURE__ */ createContext<Flash | null>(null);

/** Attributes that give an element the SDK bubble (spread onto any element): `{...tipProps("复制", "Mod+C")}`. */
export function tipProps(text: string | null | undefined, keys?: string, options?: { side?: TipSide; truncated?: boolean }): Record<string, string | undefined> {
  if (!text) return {};
  return {
    "data-tip": text,
    "data-tip-keys": keys,
    "data-tip-side": options?.side === "bottom" ? "bottom" : undefined,
    "data-tip-truncated": options?.truncated ? "" : undefined,
  };
}

export type TooltipProps = {
  /** One short sentence (no rich content — an explanation with a title or a link is a HelpTip). */
  content: string | null | undefined;
  /** Shortcut shown as keycaps in the bubble, e.g. "Mod+K" (Ctrl K on Windows, ⌘ K on Mac). */
  shortcut?: string;
  /** Default top; flips when there is no room. */
  side?: TipSide;
  /** Only show when the child's text is actually cut off (table cells, long names). */
  truncated?: boolean;
  /** One element that accepts `data-*` props (a button, a span). Disabled buttons: pass `disabledReason` to Button instead. */
  children: ReactElement;
};

/** Hover / focus bubble for one element; with no `content` the child renders unchanged. */
export function Tooltip({ content, shortcut, side, truncated, children }: TooltipProps) {
  if (!content || !isValidElement(children)) return children;
  return cloneElement(children as ReactElement<Record<string, unknown>>, tipProps(content, shortcut, { side, truncated }));
}

/** Show a one-off bubble on an element (「已复制」 for 1.5 s). Outside an AdminProvider it does nothing. */
export function useTipFlash(): Flash {
  return useContext(FlashContext) ?? noop;
}
const noop: Flash = () => undefined;

const truncatedNow = (el: HTMLElement) => {
  const target = el.querySelector<HTMLElement>("[data-tip-target]") ?? el;
  return target.scrollWidth > target.clientWidth + 1 || target.scrollHeight > target.clientHeight + 1;
};

/**
 * Mounted by AdminProvider: listens on its root (so portaled dialogs and menus inside it are covered) and
 * renders the bubble into the Provider portal.
 */
export function TooltipLayer({ rootRef, portal, children }: { rootRef: RefObject<HTMLElement | null>; portal: HTMLElement | null; children: ReactNode }) {
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const bubbleRef = useRef<Bubble | null>(null);
  bubbleRef.current = bubble;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastHidden = useRef(0);
  const flashing = useRef(false);
  const id = useId();

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    if (flashing.current) return;
    if (bubbleRef.current) lastHidden.current = Date.now();
    setBubble(null);
  }, []);

  const showFor = useCallback((el: HTMLElement, immediate: boolean) => {
    clearTimeout(timer.current);
    if (flashing.current) return;
    const text = el.dataset.tip;
    if (!text) return;
    if (el.hasAttribute("data-tip-truncated") && !truncatedNow(el)) return;
    const open = () => {
      if (!el.isConnected) return;
      setBubble({ anchor: el, text, keys: el.dataset.tipKeys || undefined, side: el.dataset.tipSide === "bottom" ? "bottom" : "top" });
    };
    const wait = immediate ? 0 : tipDelay(Date.now(), lastHidden.current, Boolean(bubbleRef.current));
    if (wait === 0) open();
    else timer.current = setTimeout(open, wait);
  }, []);

  const flash = useCallback<Flash>((anchor, text, options) => {
    clearTimeout(timer.current);
    clearTimeout(flashTimer.current);
    flashing.current = true;
    setBubble({ anchor, text, side: options?.side ?? "top", tone: options?.tone });
    flashTimer.current = setTimeout(() => {
      flashing.current = false;
      lastHidden.current = Date.now();
      setBubble(null);
    }, options?.ms ?? COPY_FEEDBACK_MS);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const hostOf = (target: EventTarget | null) => (target instanceof Element ? (target.closest("[data-tip]") as HTMLElement | null) : null);
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const host = hostOf(event.target);
      if (!host || !root.contains(host)) return;
      if (bubbleRef.current?.anchor === host) return;
      showFor(host, false);
    };
    const onOut = (event: PointerEvent) => {
      const host = hostOf(event.target);
      if (!host) return;
      const to = event.relatedTarget;
      if (to instanceof Node && host.contains(to)) return;
      if (bubbleRef.current?.anchor === host || !bubbleRef.current) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      let visible = false;
      try {
        visible = el.matches(":focus-visible");
      } catch {
        visible = false;
      }
      const host = hostOf(el);
      if (visible && host) showFor(host, true);
    };
    const onFocusOut = () => hide();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && bubbleRef.current && !flashing.current) hide();
    };
    const onDown = () => {
      // A click hides the hover bubble and cancels a pending one (the action happened); a flash stays.
      clearTimeout(timer.current);
      if (!flashing.current && bubbleRef.current) hide();
    };
    const onScroll = () => {
      if (!flashing.current) hide();
    };
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerout", onOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerout", onOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      clearTimeout(timer.current);
      clearTimeout(flashTimer.current);
    };
  }, [rootRef, showFor, hide]);

  // The anchor describes itself with the bubble while it is shown (unless the bubble only repeats its name).
  useEffect(() => {
    if (!bubble) return;
    const anchor = bubble.anchor;
    if (anchor.getAttribute("aria-label") === bubble.text) return;
    const before = anchor.getAttribute("aria-describedby");
    anchor.setAttribute("aria-describedby", [before, id].filter(Boolean).join(" "));
    return () => {
      if (before === null) anchor.removeAttribute("aria-describedby");
      else anchor.setAttribute("aria-describedby", before);
    };
  }, [bubble, id]);

  return (
    <FlashContext.Provider value={flash}>
      {children}
      {bubble && portal && createPortal(<TipBubble id={id} bubble={bubble} />, portal)}
    </FlashContext.Provider>
  );
}

function TipBubble({ id, bubble }: { id: string; bubble: Bubble }) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<TipPlacement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = bubble.anchor.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPlace(placeTip(a, { width: r.width, height: r.height }, { width: window.innerWidth, height: window.innerHeight }, bubble.side));
  }, [bubble]);
  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="aui-tip"
      data-side={place?.side ?? bubble.side}
      data-tone={bubble.tone}
      style={{ top: place?.top ?? 0, left: place?.left ?? 0, visibility: place ? "visible" : "hidden", ["--aui-tip-arrow" as string]: `${place?.arrow ?? 0}px` }}
    >
      <span>{bubble.text}</span>
      {bubble.keys && <Kbd keys={bubble.keys} size="sm" />}
    </div>
  );
}

// ---------------------------------------------------------------- Kbd

const subscribeNothing = () => () => undefined;
/** "mac" on Apple systems, else "other" (server render: "other"). */
export function useShortcutPlatform(): ShortcutPlatform {
  return useSyncExternalStore(
    subscribeNothing,
    () => detectPlatform(typeof navigator === "undefined" ? null : (navigator as Navigator & { userAgentData?: { platform?: string } })),
    () => "other",
  );
}

export type KbdProps = {
  /** "Mod+K", "Shift+?", ["Ctrl", "Enter"]; Mod = ⌘ on Mac, Ctrl elsewhere. */
  keys: string | readonly string[];
  /** md 20px (default, page text) · sm 18px (menus, bubbles). */
  size?: "md" | "sm";
  /** Flat keycaps for hints inside an input (「/」 to search). */
  flat?: boolean;
  /** Short symbols on every system (⇧ ↵ ⌫) — menus keep shortcuts narrow. */
  compact?: boolean;
  className?: string;
};

/**
 * Keycaps, one per key, in the current system's notation only (Windows 「Ctrl」「K」, Mac 「⌘」「K」); hidden on
 * phones (no keyboard). Screen readers hear 「Ctrl 加 K」.
 */
export function Kbd({ keys, size = "md", flat, compact, className }: KbdProps) {
  const platform = useShortcutPlatform();
  const caps = formatShortcut(keys, platform, compact);
  return (
    <span className={["aui-keys", className].filter(Boolean).join(" ")} data-size={size === "sm" ? "sm" : undefined} data-flat={flat || undefined}>
      <span className="aui-sr-only">{shortcutLabel(keys, platform)}</span>
      {caps.map((cap, i) => (
        <kbd key={`${cap}-${i}`} className="aui-kbd" aria-hidden="true">
          {cap}
        </kbd>
      ))}
    </span>
  );
}
