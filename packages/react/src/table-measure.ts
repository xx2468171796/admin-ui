/**
 * DataTable layout measurements (moved out of data.tsx). Both observe elements of the scrolling <table>;
 * on phones the table is replaced by cards, so `active` must be false there and the measurement re-runs
 * when the table comes back (phone → desktop), otherwise the pinned column keeps offsets of 0.
 */
import { useEffect, useState, type RefObject } from "react";

type Ref = RefObject<HTMLElement | null>;
export type UtilityWidths = { expand: number; select: number; record: number };

function observe(nodes: readonly (Element | null | undefined)[], measure: () => void): () => void {
  measure();
  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }
  const observer = new ResizeObserver(measure);
  for (const node of nodes) if (node) observer.observe(node);
  return () => observer.disconnect();
}

/** Widths of the expand / select / record header cells: the left offsets of a pinned column. */
export function useUtilityWidths(refs: { expand: Ref; select: Ref; record: Ref }, active: boolean, shape: string): UtilityWidths {
  const [widths, setWidths] = useState<UtilityWidths>({ expand: 44, select: 44, record: 44 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `shape` (which utility header cells exist) re-observes the cells that mounted / unmounted; `refs` holds the caller's stable useRef objects (an inline wrapper each render).
  useEffect(() => {
    if (!active) return;
    const width = (ref: Ref) => ref.current?.getBoundingClientRect().width ?? 0;
    return observe([refs.expand.current, refs.select.current, refs.record.current], () => {
      const next = { expand: width(refs.expand), select: width(refs.select), record: width(refs.record) };
      setWidths((p) => (p.expand === next.expand && p.select === next.select && p.record === next.record ? p : next));
    });
  }, [active, shape]);
  return widths;
}

/** Whether the scroll box is wider than its viewport (the actions column then pins right). */
export function useOverflowing(box: Ref, active: boolean): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const node = box.current;
    if (!active || !node) return;
    return observe([node, node.firstElementChild], () => {
      const next = node.scrollWidth > node.clientWidth + 1;
      setOverflowing((previous) => (previous === next ? previous : next));
    });
  }, [active, box]);
  return overflowing;
}
