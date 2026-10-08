"use client";
/**
 * Shared plumbing of the floating layers added by bt/foundations (Menu, PopoverPanel, pickers): where
 * the layer renders (the Provider portal, or the enclosing Dialog so its focus trap lets the keyboard
 * in), where it sits (menu-core `placeLayer`), and when it follows / loses its anchor.
 */
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { placeLayer, type LayerPlacement, type LayerPoint, type LayerRect } from "./menu-core.ts";

/** Marks every floating layer; a click inside any of them never counts as "outside" for another. */
export const LAYER_ATTR = "data-aui-layer";
export const isInsideLayer = (node: EventTarget | null) =>
  node instanceof Element && Boolean(node.closest(`[${LAYER_ATTR}], .aui-select-content, [data-radix-popper-content-wrapper]`));

/** The element a layer opened from `origin` renders into: the enclosing dialog, else the Provider portal. */
export function layerHost(origin: Element | null | undefined, portal: HTMLElement | null): HTMLElement | null {
  return origin?.closest<HTMLElement>(".aui-dialog") ?? portal;
}

export type LayerTarget = () => LayerRect | LayerPoint | null;

/**
 * Position of a fixed layer against a target (anchor box or pointer). Re-measured after every render
 * (content can change size) and by `place()` on scroll / resize. Returns false from `place()` when an
 * anchor scrolled out of the viewport (the caller closes instead of floating detached). A transformed
 * dialog is the containing block of position:fixed children, so positions are made relative to it.
 */
export function useLayerPosition(open: boolean, layer: RefObject<HTMLElement | null>, target: LayerTarget, host: HTMLElement | null, placement?: LayerPlacement) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const args = useRef({ target, host, placement });
  args.current = { target, host, placement };
  const place = useCallback(() => {
    const node = layer.current;
    const box = args.current.target();
    if (!node || !box) return true;
    if (!("x" in box) && (box.bottom < 0 || box.top > window.innerHeight)) return false;
    const size = node.getBoundingClientRect();
    const hostBox = args.current.host?.classList.contains("aui-dialog") ? args.current.host.getBoundingClientRect() : null;
    // Inside a dialog the layer is clipped by the dialog's box (overflow hidden, and its transform makes it
    // the containing block): flip / fit inside that box, not the viewport, so nothing ends up under the overlay.
    const area = hostBox ? dialogArea(hostBox) : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    const local = "x" in box ? { x: box.x - area.left, y: box.y - area.top } : { top: box.top - area.top, bottom: box.bottom - area.top, left: box.left - area.left, right: box.right - area.left, width: box.width, height: box.height };
    const next = placeLayer(local, { width: size.width, height: size.height }, { width: area.width, height: area.height }, args.current.placement);
    // Only a host that really is the containing block of fixed children (transform…) shifts them —
    // a side sheet without a transform does not — so measure the origin instead of assuming it.
    const origin = hostBox ? fixedOrigin(node.parentElement ?? args.current.host) : null;
    const top = next.top + area.top - (origin?.top ?? 0);
    const left = next.left + area.left - (origin?.left ?? 0);
    setPosition((old) => (old && Math.abs(old.top - top) < 0.5 && Math.abs(old.left - left) < 0.5 ? old : { top, left }));
    return true;
  }, [layer]);
  useLayoutEffect(() => {
    if (open) place();
    else setPosition(null);
  });
  return { position, place };
}

/**
 * Where `position: fixed; top: 0; left: 0` ends up inside `container`, in viewport coordinates: (0, 0)
 * when fixed children are viewport-relative, the containing block's corner when an ancestor has a
 * transform / filter / contain (e.g. a centred dialog with translate; a side sheet without one is not).
 */
export function fixedOrigin(container: HTMLElement | null): { top: number; left: number } {
  if (!container) return { top: 0, left: 0 };
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none";
  container.appendChild(probe);
  const box = probe.getBoundingClientRect();
  probe.remove();
  return { top: box.top, left: box.left };
}

/** The part of a dialog's box inside the viewport (where a layer hosted by it can be seen). */
export function dialogArea(dialog: Pick<LayerRect, "top" | "left" | "right" | "bottom">, viewport = { width: window.innerWidth, height: window.innerHeight }) {
  const top = Math.max(0, dialog.top);
  const left = Math.max(0, dialog.left);
  return { top, left, width: Math.max(0, Math.min(viewport.width, dialog.right) - left), height: Math.max(0, Math.min(viewport.height, dialog.bottom) - top) };
}

/** Viewport box of an element as a plain LayerRect (null when missing). */
export const rectOf = (element: Element | null | undefined): LayerRect | null => {
  const r = element?.getBoundingClientRect();
  return r ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
};
