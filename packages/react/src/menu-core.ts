/** Roving focus inside a menu: skips disabled items, wraps around. Pure for unit tests. */
export function nextMenuIndex(
  disabled: readonly boolean[],
  current: number,
  move: 1 | -1 | "first" | "last",
): number {
  const n = disabled.length;
  if (!n || disabled.every(Boolean)) return -1;
  if (move === "first") return disabled.findIndex((d) => !d);
  if (move === "last") {
    for (let i = n - 1; i >= 0; i--) if (!disabled[i]) return i;
    return -1;
  }
  let i = current < 0 ? (move === 1 ? -1 : n) : current;
  for (let step = 0; step < n; step++) {
    i = (i + move + n) % n;
    if (!disabled[i]) return i;
  }
  return -1;
}

const BAR_GAP = 4;
/** How many of the leading inline candidates fit: widths of the buttons, the ⋯ button, the space. */
export function fitRowActions(widths: readonly number[], triggerWidth: number, available: number, menuOnlyCount: number) {
  for (let shown = widths.length; shown > 0; shown--) {
    const buttons = widths.slice(0, shown).reduce((sum, w) => sum + w, 0) + BAR_GAP * (shown - 1);
    const needsMenu = shown < widths.length || menuOnlyCount > 0;
    if (buttons + (needsMenu ? BAR_GAP + triggerWidth : 0) <= available + 0.5) return shown;
  }
  return 0;
}


// ---------------------------------------------------------------- bt/foundations: Menu / ContextMenu / layers

/** A box in viewport pixels (DOMRect-compatible). */
export type LayerRect = { top: number; left: number; right: number; bottom: number; width: number; height: number };
export type LayerPoint = { x: number; y: number };
export type LayerSize = { width: number; height: number };
export type LayerPlacement = {
  /**
   * Where the layer sits against an anchor element: below it (menus, popovers), above it (a suggestion
   * list over a composer that has content under it) or beside it (submenus). bottom / top flip to the
   * other side when only that side has room.
   */
  side?: "bottom" | "top" | "right";
  /** bottom: left edges line up (start) or right edges (end). right: top edges line up. */
  align?: "start" | "end";
  /** Gap between anchor and layer (default 4). */
  gap?: number;
  /** Minimum distance to the viewport edge (default 8). */
  margin?: number;
};
export type LayerPosition = { top: number; left: number; flippedX: boolean; flippedY: boolean };

const fitAxis = (start: number, size: number, limit: number, margin: number) => Math.max(margin, Math.min(start, limit - size - margin));

/**
 * Where a floating layer (menu, submenu, popover) goes. A point (context menu) opens down-right of the
 * pointer and flips left / up when there is no room; an anchor opens below it (or to the right for a
 * submenu) and flips to the other side when that side has room; everything is clamped to the viewport.
 * Pure, so the browser tests and unit tests agree on the geometry.
 */
export function placeLayer(target: LayerRect | LayerPoint, size: LayerSize, viewport: LayerSize, placement: LayerPlacement = {}): LayerPosition {
  const gap = placement.gap ?? 4;
  const margin = placement.margin ?? 8;
  if ("x" in target) {
    const flippedX = target.x + size.width > viewport.width - margin && target.x - size.width >= margin;
    const flippedY = target.y + size.height > viewport.height - margin && target.y - size.height >= margin;
    const left = flippedX ? target.x - size.width : target.x;
    const top = flippedY ? target.y - size.height : target.y;
    return { left: fitAxis(left, size.width, viewport.width, margin), top: fitAxis(top, size.height, viewport.height, margin), flippedX, flippedY };
  }
  if (placement.side === "top") {
    const above = target.top - gap - size.height;
    const flippedY = above < margin && target.bottom + gap + size.height <= viewport.height - margin;
    const across = placeLayer(target, size, viewport, { ...placement, side: "bottom" });
    return { ...across, top: fitAxis(flippedY ? target.bottom + gap : above, size.height, viewport.height, margin), flippedY };
  }
  if (placement.side === "right") {
    const roomRight = target.right + gap + size.width <= viewport.width - margin;
    const flippedX = !roomRight && target.left - gap - size.width >= margin;
    const left = flippedX ? target.left - gap - size.width : target.right + gap;
    const top = placement.align === "end" ? target.bottom - size.height : target.top;
    return { left: fitAxis(left, size.width, viewport.width, margin), top: fitAxis(top, size.height, viewport.height, margin), flippedX, flippedY: false };
  }
  const below = target.bottom + gap;
  const flippedY = below + size.height > viewport.height - margin && target.top - gap - size.height >= margin;
  const top = flippedY ? target.top - gap - size.height : below;
  // Line up with the asked edge. An end-aligned layer running off the left edge lines up with the anchor's
  // left instead (stays next to the anchor rather than being pushed over a left sidebar). A start-aligned
  // layer running off the right edge only slides left as far as it must (fitAxis below): flipping it to
  // the anchor's right edge would throw a wide panel (the grid's 640px filter) across the sidebar.
  const end = target.right - size.width;
  const start = target.left;
  let left = placement.align === "end" ? end : start;
  let flippedX = false;
  if (placement.align === "end" && end < margin && start + size.width <= viewport.width - margin) [left, flippedX] = [start, true];
  return { left: fitAxis(left, size.width, viewport.width, margin), top: fitAxis(top, size.height, viewport.height, margin), flippedX, flippedY };
}

/**
 * Type-ahead inside a menu: the next enabled item after `current` whose label starts with `query`
 * (case-insensitive, wraps around); -1 when none. A query of one repeated letter cycles through the
 * items starting with it (WAI-ARIA menu pattern).
 */
export function menuTypeahead(labels: readonly string[], skip: readonly boolean[], current: number, query: string): number {
  const needle = query.toLocaleLowerCase("zh-CN");
  if (!needle) return -1;
  const repeated = [...needle].every((ch) => ch === needle[0]);
  const n = labels.length;
  const startOffset = repeated && needle.length > 1 ? 1 : needle.length > 1 ? 0 : 1;
  for (let step = 0; step < n; step++) {
    const i = (Math.max(current, -1) + startOffset + step + n) % n;
    if (skip[i]) continue;
    const label = (labels[i] ?? "").trim().toLocaleLowerCase("zh-CN");
    if (label.startsWith(needle) || (repeated && label.startsWith(needle[0] ?? ""))) return i;
  }
  return -1;
}

/** 「删除 {count} 条」 → 「删除 3 条」; labels without the placeholder are returned as they are. */
export function menuLabel(label: string, count?: number): string {
  return count === undefined ? label : label.replace(/\{count\}/g, String(count));
}

// bt/templates
/** Do two viewport boxes overlap (share at least one pixel)? */
export function rectsOverlap(a: LayerRect, b: LayerRect): boolean {
  return a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
}
/**
 * What an open menu does when something scrolls (bt/templates): a scroll that does not move the element
 * the menu belongs to (another kanban column, a list in a side panel) is ignored; when it does move it, a
 * menu at the pointer closes (what was right-clicked left the pointer) and an anchored menu follows its
 * anchor while the anchor is still in view, else closes.
 */
export function menuScrollAction(input: { movesOrigin: boolean; atPointer: boolean; originVisible: boolean }): "ignore" | "follow" | "close" {
  if (!input.movesOrigin) return "ignore";
  if (input.atPointer) return "close";
  return input.originVisible ? "follow" : "close";
}
