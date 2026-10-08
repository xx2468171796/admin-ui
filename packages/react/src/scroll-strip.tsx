"use client";
import * as React from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { revealScrollLeft, scrollEdges, wheelScrollLeft, type ScrollEdges } from "./scroll-strip-core.ts";

/** Width of the edge fade; the selected item is kept this far from a clipped edge. Matches --aui-strip-fade in layout.css. */
const FADE = 24;
const behavior = (): ScrollBehavior =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/**
 * A tablist that scrolls sideways without a native scrollbar. Hidden content is shown by an edge fade; a vertical
 * wheel scrolls the strip until it reaches its end; the item holding aria-selected="true" is scrolled into view
 * whenever activeKey changes. With `trailing` (in-page Tabs 「更多 ⌄」, work tabs 「N ⌄」) that control
 * sits after the list and there are no arrow buttons; without it, mouse users get a round arrow button on a hidden
 * side (in a gutter next to the list, never over a tab). Keyboard users move with the tablist's own arrow keys.
 */
export function ScrollStrip({
  className,
  listClassName,
  label,
  activeKey,
  children,
  trailing,
  trailingWhen = "always",
}: {
  className?: string;
  listClassName: string;
  label: string;
  activeKey?: string;
  children: React.ReactNode;
  /** A control after the list (a 「更多 ⌄」 menu); replaces the round arrows. */
  trailing?: React.ReactNode;
  /** Show `trailing` always (default) or only while the items do not fit. */
  trailingWhen?: "always" | "overflow";
}) {
  const list = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState<ScrollEdges>({ start: false, end: false });

  React.useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => {
      const next = scrollEdges(el.scrollLeft, el.scrollWidth, el.clientWidth);
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const lines = event.deltaMode === 1 ? 16 : 1;
      const next = wheelScrollLeft(el.scrollLeft, el.scrollWidth, el.clientWidth, event.deltaX * lines, event.deltaY * lines);
      if (next === null) return;
      event.preventDefault();
      el.scrollLeft = next;
    };
    // Items change width (renamed, font size) or come and go (workspace tabs): watch the list and each item.
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    const watch = () => {
      if (!resize) return;
      resize.disconnect();
      resize.observe(el);
      for (const child of Array.from(el.children)) resize.observe(child);
    };
    const mutations = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(() => { watch(); measure(); });
    watch();
    measure();
    mutations?.observe(el, { childList: true });
    el.addEventListener("scroll", measure, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, []);

  const first = React.useRef(true);
  React.useEffect(() => {
    const el = list.current;
    let item = el?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null;
    while (item && item.parentElement !== el) item = item.parentElement;
    const initial = first.current;
    first.current = false;
    if (!el || !item) return;
    const box = el.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    const next = revealScrollLeft(el.scrollLeft, el.clientWidth, el.scrollWidth, rect.left - box.left + el.scrollLeft, rect.width, FADE);
    if (next !== null) el.scrollTo({ left: next, behavior: initial ? "auto" : behavior() });
  }, [activeKey]);

  const step = (direction: 1 | -1) => {
    const el = list.current;
    if (el) el.scrollBy({ left: direction * Math.max(80, el.clientWidth * 0.7), behavior: behavior() });
  };
  const arrow = (side: "start" | "end") => (
    <button
      type="button"
      className="aui-scroll-arrow"
      data-side={side}
      tabIndex={-1}
      aria-hidden="true"
      data-tip={side === "start" ? "向左滚动" : "向右滚动"}
      // Keep focus on the selected tab: a click on the arrow only scrolls.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => step(side === "start" ? -1 : 1)}
    >
      {side === "start" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  );
  return (
    <div className={clsx("aui-scroll-strip", className)} data-overflow={edges.start || edges.end || undefined} data-start={edges.start || undefined} data-end={edges.end || undefined} data-trailing={trailing ? trailingWhen : undefined}>
      <div ref={list} className={listClassName} role="tablist" aria-label={label}>
        {children}
      </div>
      {trailing ? (
        <div className="aui-strip-trailing" hidden={trailingWhen === "overflow" && !(edges.start || edges.end) ? true : undefined}>{trailing}</div>
      ) : (
        <>
          {arrow("start")}
          {arrow("end")}
        </>
      )}
    </div>
  );
}
