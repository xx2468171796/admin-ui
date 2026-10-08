/**
 * Bring an item into view inside its OWN sideways strip (tabs, kanban pills, a lightbox film strip) without
 * ever scrolling the page (8.0.2). `element.scrollIntoView({ block: "nearest" })` also scrolls every
 * scrollable ancestor — on a phone a kanban mounted below the fold dragged the whole page down to it.
 * Only `scroller.scrollLeft` changes here.
 */

/** New scrollLeft that shows [left, right] (offsets inside the scroll content) "nearest"; null = already visible. */
export function inlineRevealLeft(item: { left: number; right: number }, view: { scrollLeft: number; width: number }, margin = 0): number | null {
  const start = view.scrollLeft;
  const end = start + view.width;
  if (item.left - margin >= start && item.right + margin <= end) return null;
  if (item.right - item.left + 2 * margin >= view.width || item.left - margin < start) return Math.max(0, item.left - margin);
  return Math.max(0, item.right + margin - view.width);
}

/** Nearest ancestor that scrolls sideways (overflow-x auto / scroll), never the page itself. */
export function inlineScroller(item: HTMLElement): HTMLElement | null {
  for (let el = item.parentElement; el && el !== item.ownerDocument.body && el !== item.ownerDocument.documentElement; el = el.parentElement) {
    const x = getComputedStyle(el).overflowX;
    if ((x === "auto" || x === "scroll") && el.scrollWidth > el.clientWidth) return el;
  }
  return null;
}

/**
 * Scroll `scroller` (default: the item's nearest sideways-scrolling ancestor) so `item` is visible
 * (nearest edge). No vertical / page scrolling.
 */
export function revealInline(item: HTMLElement | null | undefined, scroller?: HTMLElement | null, margin = 0): void {
  if (!item) return;
  scroller ??= inlineScroller(item);
  if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
  const box = scroller.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const left = rect.left - box.left - scroller.clientLeft + scroller.scrollLeft;
  const next = inlineRevealLeft({ left, right: left + rect.width }, { scrollLeft: scroller.scrollLeft, width: scroller.clientWidth }, margin);
  if (next !== null) scroller.scrollLeft = next;
}
