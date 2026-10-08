/** Pure geometry for horizontally scrolling strips (tab bars): which edges hide content, and where to scroll to reveal an item. */
export type ScrollEdges = { start: boolean; end: boolean };

/** 1px of slack absorbs sub-pixel widths so a strip that just fits never shows a fade. */
export function scrollEdges(scrollLeft: number, scrollWidth: number, clientWidth: number): ScrollEdges {
  return { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 };
}

/**
 * The scrollLeft that brings [itemLeft, itemLeft + itemWidth) (in scroll coordinates) fully into view,
 * keeping `pad` px clear of each edge for the fade and arrow; null when it is already visible.
 * An item wider than the view is aligned to its start.
 */
export function revealScrollLeft(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  itemLeft: number,
  itemWidth: number,
  pad: number,
): number | null {
  const max = Math.max(0, scrollWidth - clientWidth);
  const clamp = (value: number) => Math.min(max, Math.max(0, Math.round(value)));
  const startGap = itemLeft <= 0 ? 0 : pad;
  const endGap = itemLeft + itemWidth >= scrollWidth ? 0 : pad;
  if (itemLeft - startGap < scrollLeft || itemWidth + startGap + endGap > clientWidth) {
    const next = clamp(itemLeft - startGap);
    return next === scrollLeft ? null : next;
  }
  if (itemLeft + itemWidth + endGap > scrollLeft + clientWidth) {
    const next = clamp(itemLeft + itemWidth + endGap - clientWidth);
    return next === scrollLeft ? null : next;
  }
  return null;
}

/** A vertical wheel turn over a strip that can still scroll that way scrolls it sideways; otherwise the page keeps the wheel. */
export function wheelScrollLeft(scrollLeft: number, scrollWidth: number, clientWidth: number, deltaX: number, deltaY: number): number | null {
  if (Math.abs(deltaY) <= Math.abs(deltaX)) return null;
  const max = Math.max(0, scrollWidth - clientWidth);
  const next = Math.min(max, Math.max(0, scrollLeft + deltaY));
  return next === scrollLeft ? null : next;
}
