"use client";
/**
 * Pointer drags of BitableGrid (bt/grid-b): the freeze line (G9), the fill handle (G10) and row
 * reordering by the grip (G11). Each hook owns its preview state and pointer capture; the decisions
 * are pure (grid-interact-core / grid-fill-core) and the result goes back to the grid through a
 * callback. Keyboard equivalents live in grid.tsx (header menu 「冻结至此列」, Ctrl + D,
 * Alt + Shift + ↑ / ↓).
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { frozenCountAt } from "./grid-interact-core.ts";
import { fillTarget, type GridFillTarget } from "./grid-fill-core.ts";
import { rangeBounds, type GridCellRef, type GridRange } from "./grid-edit-core.ts";

type Handlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
};

/** Freeze line: drag the grip in the header; drops on the nearest column boundary. */
export function useFreezeDrag(headRow: RefObject<HTMLDivElement | null>, max: number, onCommit: (count: number) => void) {
  const [preview, setPreview] = useState<{ x: number; count: number } | null>(null);
  const edges = useRef<number[] | null>(null);
  const measure = () => {
    const row = headRow.current;
    if (!row) return null;
    const base = row.getBoundingClientRect().left;
    const lead = row.querySelector<HTMLElement>("[data-lead-col]");
    const cells = [...row.querySelectorAll<HTMLElement>("[data-field-key]")];
    return { base, list: [lead, ...cells].map((node) => (node ? node.getBoundingClientRect().right - base : 0)) };
  };
  const handlers: Handlers = {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      const measured = measure();
      if (!measured) return;
      edges.current = measured.list;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const count = frozenCountAt(event.clientX - measured.base, measured.list, max);
      setPreview({ x: measured.list[count] ?? 0, count });
    },
    onPointerMove: (event) => {
      const list = edges.current;
      const row = headRow.current;
      if (!list || !row) return;
      const count = frozenCountAt(event.clientX - row.getBoundingClientRect().left, list, max);
      setPreview((old) => (old?.count === count ? old : { x: list[count] ?? 0, count }));
    },
    onPointerUp: (event) => {
      const list = edges.current;
      edges.current = null;
      const row = headRow.current;
      setPreview(null);
      if (!list || !row) return;
      event.stopPropagation();
      onCommit(frozenCountAt(event.clientX - row.getBoundingClientRect().left, list, max));
    },
    onPointerCancel: () => {
      edges.current = null;
      setPreview(null);
    },
  };
  return { preview, handlers };
}

const cellAt = (x: number, y: number, box: HTMLElement | null): GridCellRef | null => {
  const node = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
  if (!node || !box?.contains(node)) return null;
  const [row, col] = node.dataset.cell!.split(":").map(Number) as [number, number];
  return Number.isNaN(row) || Number.isNaN(col) || row < 0 ? null : { row, col };
};
/** Scroll the grid a step when the pointer is near its edge (drags past the visible rows). */
function edgeScroll(box: HTMLElement | null, x: number, y: number) {
  if (!box) return;
  const rect = box.getBoundingClientRect();
  if (y > rect.bottom - 48) box.scrollTop += 24;
  else if (y < rect.top + 56) box.scrollTop -= 24;
  if (x > rect.right - 32) box.scrollLeft += 24;
  else if (x < rect.left + 32) box.scrollLeft -= 24;
}

/**
 * Run `move` / `up` on document pointer events until the pointer is released (rows may unmount while
 * scrolling). Returns a cancel function: removes the listeners without calling `up` (nothing is committed).
 */
export function track(move: (event: PointerEvent) => void, up: (event: PointerEvent | null) => void, target: EventTarget = document): () => void {
  const onMove = (event: Event) => move(event as PointerEvent);
  const stop = () => {
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onUp);
    target.removeEventListener("pointercancel", onCancel);
  };
  const onUp = (event: Event) => {
    stop();
    up(event as PointerEvent);
  };
  const onCancel = () => {
    stop();
    up(null);
  };
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onCancel);
  return stop;
}
/** `track` owned by a component: a drag still running when it unmounts is dropped, not committed. */
function useTrack() {
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);
  return (move: (event: PointerEvent) => void, up: (event: PointerEvent | null) => void) => {
    cancel.current?.();
    const stop = track(move, (event) => {
      cancel.current = null;
      up(event);
    });
    cancel.current = stop;
  };
}

/** Fill handle: drag from the range corner; the preview is the area that will be filled. */
export function useFillDrag(box: RefObject<HTMLDivElement | null>, limits: { rows: number; firstCol: number; lastCol: number }, onCommit: (source: GridRange, target: GridFillTarget) => void) {
  const [preview, setPreview] = useState<GridFillTarget | null>(null);
  const limitsRef = useRef(limits);
  limitsRef.current = limits;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const drag = useTrack();
  const start = (range: GridRange) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    let last: GridFillTarget | null = null;
    drag((move) => {
      edgeScroll(box.current, move.clientX, move.clientY);
      const cell = cellAt(move.clientX, move.clientY, box.current);
      if (!cell) return;
      const next = fillTarget(rangeBounds(range), cell, limitsRef.current);
      last = next;
      setPreview((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    }, (up) => {
      setPreview(null);
      if (up && last) commitRef.current(range, last);
    });
  };
  return { preview, start };
}

/** Row grip drag: a line between rows shows where the record lands. */
export function useRowDrag(box: RefObject<HTMLDivElement | null>, body: RefObject<HTMLDivElement | null>, onDrop: (rowId: string, targetId: string, place: "before" | "after") => void) {
  const [drop, setDrop] = useState<{ top: number; targetId: string; place: "before" | "after" } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dropRef = useRef<typeof drop>(null);
  const dropFn = useRef(onDrop);
  dropFn.current = onDrop;
  const drag = useTrack();
  const start = (rowId: string) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setDragging(rowId);
    drag((move) => {
      edgeScroll(box.current, -Infinity, move.clientY);
      const row = document.elementFromPoint(move.clientX, move.clientY)?.closest<HTMLElement>("[data-row-key]");
      const bodyNode = body.current;
      if (!row || !bodyNode || !bodyNode.contains(row)) return;
      const rect = row.getBoundingClientRect();
      const place = move.clientY < rect.top + rect.height / 2 ? "before" : "after";
      const top = (place === "before" ? rect.top : rect.bottom) - bodyNode.getBoundingClientRect().top;
      const targetId = row.dataset.rowKey!;
      const next = { top, targetId, place } as const;
      dropRef.current = next;
      setDrop((old) => (old && old.targetId === targetId && old.place === place ? old : next));
    }, (up) => {
      const target = dropRef.current;
      dropRef.current = null;
      setDrop(null);
      setDragging(null);
      if (up && target) dropFn.current(rowId, target.targetId, target.place);
    });
  };
  return { drop, dragging, start };
}

/** Copy cells to the system clipboard from a menu (no copy event): TSV + HTML where allowed. */
export async function writeClipboard(tsv: string, html: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([tsv], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
      return true;
    }
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    return false;
  }
}
/** Read text from the system clipboard for a menu paste (null when the browser refuses). */
export async function readClipboard(): Promise<string | null> {
  try {
    return (await navigator.clipboard?.readText()) ?? null;
  } catch {
    return null;
  }
}
