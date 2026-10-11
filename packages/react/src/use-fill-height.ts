"use client";
import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Height that reaches the bottom of the window: viewport height − the scroll box's top in the
 * document (scroll positions of the page and its scrolling ancestors undone) − what the panel shows
 * below the box − `offset`. Re-measured on resize and whenever the layout above it changes.
 */
export function useFillHeight(box: RefObject<HTMLDivElement | null>, panel: RefObject<HTMLDivElement | null>, enabled: boolean, offset: number, min: number) {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    const measure = () => {
      const node = box.current;
      if (!node) return;
      const next = Math.max(min, Math.floor(window.innerHeight - documentTop(node) - belowBox(node, panel.current) - pageSpacing(panel.current) - offset));
      setHeight((old) => (old === next ? old : next));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => requestAnimationFrame(measure));
    observer?.observe(document.body);
    if (panel.current?.parentElement) observer?.observe(panel.current.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [enabled, offset, min, box, panel]);
  return height;
}

/** The box's top in the document (scroll positions of its scrolling ancestors undone). */
function documentTop(node: HTMLElement) {
  let scrolled = 0;
  for (let el = node.parentElement; el; el = el.parentElement) scrolled += el.scrollTop;
  return node.getBoundingClientRect().top + scrolled;
}
/**
 * What the panel draws under the box (status line …): the boxes after it, not the gap to the panel's bottom — a
 * panel stretched by a flex parent (RailShell workspace) would feed its own height back.
 */
function belowBox(node: HTMLElement, panel: HTMLElement | null) {
  let below = 0;
  for (let el: Element | null = node; el && el !== panel; el = el.parentElement) {
    for (let next = el.nextElementSibling; next; next = next.nextElementSibling) {
      const style = getComputedStyle(next);
      if (style.position === "absolute" || style.position === "fixed" || style.display === "none") continue;
      below += next.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    }
  }
  if (panel) {
    const style = getComputedStyle(panel);
    below += parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
  }
  return below;
}
/** The page's own bottom spacing: padding / border / margin of every ancestor under the panel. */
function pageSpacing(panel: HTMLElement | null) {
  let spacing = 0;
  for (let el: HTMLElement | null = panel; el && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    spacing += (el === panel ? 0 : parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth)) + parseFloat(style.marginBottom);
  }
  return spacing;
}
