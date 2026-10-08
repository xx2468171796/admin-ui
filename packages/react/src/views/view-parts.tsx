"use client";
/**
 * Small shared pieces of the bt/views components: view-kind icons, a polite live region for drag /
 * keyboard announcements, pointer-drag tracking with a threshold and Esc to cancel, and a floating
 * hover card (Provider portal, never steals focus) for calendar / gantt details.
 */
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChartGantt, ClipboardList, Columns3, LayoutGrid, Table2, type LucideIcon } from "lucide-react";
import { useAdminTheme } from "../theme.tsx";
import { LAYER_ATTR, layerHost, useLayerPosition } from "../floating-layer.ts";
import type { LayerPlacement, LayerRect } from "../menu-core.ts";
import type { ViewKind } from "./view-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export const VIEW_KIND_ICONS: Readonly<Record<ViewKind, LucideIcon>> = {
  grid: Table2,
  kanban: Columns3,
  gallery: LayoutGrid,
  calendar: CalendarDays,
  gantt: ChartGantt,
  form: ClipboardList,
};
export function ViewKindIcon({ kind, size = 15 }: { kind: ViewKind; size?: number }) {
  const Icon = VIEW_KIND_ICONS[kind];
  return <Icon size={size} aria-hidden="true" />;
}

/** A polite live region plus `announce(text)` (repeated text is re-announced). */
export function useAnnouncer(): [ReactNode, (text: string) => void] {
  const [text, setText] = useState("");
  const announce = useCallback((next: string) => setText((old) => (old === next ? `${next} ` : next)), []);
  return [<span key="live" className="aui-sr-only" aria-live="polite" role="status">{text}</span>, announce];
}

export type DragHandlers = {
  /** Pixels the pointer must travel before the drag starts (default 4); below it, it is a click. */
  threshold?: number;
  onStart?: (event: PointerEvent) => void;
  onMove: (event: PointerEvent, dx: number, dy: number) => void;
  /** `cancelled` for Esc / pointercancel; `started` false = it was a click. */
  onEnd: (result: { cancelled: boolean; started: boolean; event: PointerEvent | null }) => void;
};
/**
 * Follow a pointer from a pointerdown until it is released (window listeners, so leaving the element
 * keeps tracking). Esc cancels. Only the primary button starts a drag.
 */
export function trackPointer(down: ReactPointerEvent, handlers: DragHandlers): void {
  if (down.button !== 0) return;
  const x0 = down.clientX;
  const y0 = down.clientY;
  const threshold = handlers.threshold ?? 4;
  let started = false;
  let last: PointerEvent | null = null;
  // The SDK root shows the grabbing cursor while dragging (styles stay inside .adminui).
  const root = (down.currentTarget instanceof Element ? down.currentTarget.closest(".adminui") : null) ?? document.documentElement;
  const stop = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", cancel, true);
    window.removeEventListener("keydown", key, true);
    root.removeAttribute("data-aui-dragging");
  };
  const move = (event: PointerEvent) => {
    last = event;
    const dx = event.clientX - x0;
    const dy = event.clientY - y0;
    if (!started) {
      if (Math.hypot(dx, dy) < threshold) return;
      started = true;
      root.setAttribute("data-aui-dragging", "");
      handlers.onStart?.(event);
    }
    event.preventDefault();
    handlers.onMove(event, dx, dy);
  };
  const up = (event: PointerEvent) => {
    stop();
    handlers.onEnd({ cancelled: false, started, event });
  };
  const cancel = () => {
    stop();
    handlers.onEnd({ cancelled: true, started, event: last });
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", cancel, true);
  window.addEventListener("keydown", key, true);
}

/** Scroll `el` when the pointer is within `edge` px of its sides (call on every pointer move while dragging). */
export function edgeScroll(el: HTMLElement | null, x: number, y: number, edge = 40, speed = 14): void {
  if (!el) return;
  const box = el.getBoundingClientRect();
  if (x >= box.left && x <= box.right) {
    if (y < box.top + edge && y > box.top - edge) el.scrollTop -= speed;
    else if (y > box.bottom - edge && y < box.bottom + edge) el.scrollTop += speed;
  }
  if (y >= box.top && y <= box.bottom) {
    if (x < box.left + edge && x > box.left - edge) el.scrollLeft -= speed;
    else if (x > box.right - edge && x < box.right + edge) el.scrollLeft += speed;
  }
}

export type HoverCardProps = {
  /** The element or box it hangs off; null hides it. */
  target: HTMLElement | LayerRect | null;
  label: string;
  children: ReactNode;
  placement?: LayerPlacement;
  className?: string;
  style?: CSSProperties;
  /** Keep it open while the pointer is over the card itself. */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
};
const rectOfTarget = (target: HTMLElement | LayerRect | null): LayerRect | null => {
  if (!target) return null;
  if (!(target instanceof HTMLElement)) return target;
  if (!target.isConnected) return null;
  const r = target.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};
/** Details next to an event / bar on hover or focus (Provider portal; does not take focus). */
export function HoverCard({ target, label, children, placement = { side: "bottom", align: "start", gap: 6 }, className = "aui-vhover", style, onPointerEnter, onPointerLeave }: HoverCardProps) {
  const { portal } = useAdminTheme();
  const node = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  useLayoutEffect(() => {
    setHost(target ? layerHost(target instanceof HTMLElement ? target : null, portal) : null);
  }, [target, portal]);
  const { position } = useLayerPosition(Boolean(target && host), node, () => rectOfTarget(targetRef.current), host, placement);
  if (!target || !host) return null;
  return createPortal(
    <div
      ref={node}
      role="dialog"
      aria-label={label}
      className={className}
      {...{ [LAYER_ATTR]: "" }}
      style={{ ...style, position: "fixed", top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>,
    host,
  );
}

/** Hover / focus intent with a small delay in and out (so the pointer can travel onto the card). */
export function useHoverIntent<K>(delayIn = 350, delayOut = 180) {
  const [current, setCurrent] = useState<{ key: K; target: HTMLElement } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const enter = useCallback((key: K, target: HTMLElement, immediate = false) => {
    clear();
    if (immediate) setCurrent({ key, target });
    else timer.current = setTimeout(() => setCurrent({ key, target }), delayIn);
  }, [delayIn]);
  const leave = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setCurrent(null), delayOut);
  }, [delayOut]);
  const keep = useCallback(() => clear(), []);
  const close = useCallback(() => {
    clear();
    setCurrent(null);
  }, []);
  return { current, enter, leave, keep, close };
}
