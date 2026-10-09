"use client";
import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * 8.6 page flush: a Panel / ResourcePanel that is the only titled block of its page (or of its TabbedPage
 * section) does not show its title as a row of its own — the work tab, the breadcrumb and the section tab
 * already name it (owner 2026-10-09: 「不要重复的标题，不要浪费的行」). The heading stays for screen readers.
 * With several stacked blocks every block keeps its title: then the titles tell the sections apart.
 */
const TITLED = ".aui-panel, .aui-resource, .aui-scard, .aui-dash-section";
/** Where a page / section starts: a TabbedPage section, else the AdminShell work page (both carry data-aui-page). */
const ROOT = "[data-aui-page]";
/**
 * Containers that only arrange page blocks: a block inside them is still a top-level block of the page. Layouts mark
 * themselves with data-aui-flow — "stack" (PageBody, SplitLayout / SideNavLayout / DetailLayout columns, the access
 * console stacks; the page-flush CSS treats these as page flow) or "columns" (the column containers themselves).
 */
const FLOW = ".aui-stack, [data-aui-flow]";

/** Where the page-flush CSS applies: a work page / TabbedPage section, or a flow stack (any element with data-aui-flow="stack"). */
const FLOW_ROOT = "[data-aui-page], [data-aui-flow=stack]";

/**
 * 8.6.1: `el` sits in page-flow position — straight in a page / flow stack, or in a stack / class-less `<div>` right inside
 * one (the same contexts the page-flush CSS uses). In-page `Tabs` there mark themselves as page flow (data-aui-flow).
 */
export function inPageFlow(el: Element): boolean {
  const p = el.parentElement;
  if (!p) return false;
  if (p.matches(FLOW_ROOT)) return true;
  return p.matches(".aui-stack, .aui-workflow-stack, div:not([class])") && Boolean(p.parentElement?.matches(FLOW_ROOT));
}

/** In-page Tabs in page-flow position: the tab row and its panel only arrange page blocks (read from the structure, so a
 * block inside can decide before Tabs has marked itself). */
const isFlowTabs = (el: Element) =>
  (el.matches(".aui-section-tabs-wrap") && inPageFlow(el)) ||
  (el.matches(".aui-section-panel") && el.parentElement !== null && el.parentElement.matches(".aui-section-tabs-wrap") && inPageFlow(el.parentElement));

/** A class-less wrapper `<div>` is transparent too (host wrappers with a class opt in with data-aui-flow="stack"). */
const isFlow = (el: Element) => el.matches(FLOW) || (el.tagName === "DIV" && !el.getAttribute("class")) || isFlowTabs(el);

/** True when every element between `el` and `root` only stacks page blocks. */
function isTopLevel(el: Element, root: Element): boolean {
  for (let p = el.parentElement; p && p !== root; p = p.parentElement) if (!isFlow(p)) return false;
  return el.parentElement !== null && root.contains(el);
}

/** `el` is the one titled top-level block of its page / section (hidden kept-mounted parts inside don't count). */
export function isSolePageBlock(el: Element): boolean {
  const root = el.closest(ROOT);
  if (!root || root === el || !isTopLevel(el, root)) return false;
  let count = 0;
  for (const block of root.querySelectorAll(TITLED)) {
    const hidden = block.closest("[hidden]");
    if (hidden && hidden !== root && root.contains(hidden)) continue;
    if (!isTopLevel(block, root)) continue;
    count += 1;
    if (count > 1) return false;
  }
  return count === 1;
}

/** Re-checks when blocks of the page / section mount or unmount. Off (always false) when `enabled` is false. */
export function useSolePageBlock(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [sole, setSole] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!enabled || !node) {
      setSole(false);
      return;
    }
    const update = () => setSole(isSolePageBlock(node));
    update();
    const root = node.closest(ROOT);
    if (!root || typeof MutationObserver === "undefined") return;
    // Busy pages (a grid editing / scrolling) mutate constantly: re-check at most once per frame, and only when the
    // mutation added or removed an element (text edits never change which blocks exist).
    let frame = 0;
    const observer = new MutationObserver((records) => {
      if (frame || !records.some((r) => [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeType === 1))) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);
  return sole;
}

/** 8.6.1: true when the element sits in page-flow position (see inPageFlow); checked once after mount. */
export function usePageFlow(ref: RefObject<HTMLElement | null>): boolean {
  const [flow, setFlow] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    setFlow(Boolean(node && inPageFlow(node)));
  }, [ref]);
  return flow;
}
