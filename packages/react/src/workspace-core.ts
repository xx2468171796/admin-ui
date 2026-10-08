/**
 * WorkspaceLayout height rules (pure, unit-tested in test/workspace-core.test.ts).
 * - `height`: wide screens — the work area runs from its top down to the window edge minus `bottomGap`
 *   (at least 420px).
 * - `fill`: stacked screens (≤ 1100px) with a `Pane fill` — the card reaches down to the bottom of the
 *   shell content, i.e. the window edge minus the padding / borders of the boxes around it (`below`),
 *   so no grey strip is left under it (at least 320px).
 */
export type WorkspaceHeights = { height: number; fill: number };

export function workspaceHeights({ viewport, top, bottomGap, below }: { viewport: number; top: number; bottomGap: number; below: number }): WorkspaceHeights {
  return {
    height: Math.max(420, Math.floor(viewport - top - bottomGap)),
    // Not rounded: the work area may start at a fractional y; flooring would leave a 1px strip.
    fill: Math.max(320, viewport - top - Math.max(0, below)),
  };
}

/** Padding + border (+ margin) under an element added by its ancestors up to `<body>`: the space left below it on the page. */
export function spaceBelow(node: Element): number {
  let total = 0;
  for (let el = node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    total += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0) + (el === document.body ? parseFloat(style.marginBottom) || 0 : 0);
  }
  return total;
}
