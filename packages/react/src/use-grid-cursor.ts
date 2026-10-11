"use client";
/**
 * The cursor of BitableGrid: the active cell (roving focus), the range anchor, keyboard focus after moves (kept
 * clear of the sticky header / footer / frozen columns) and mouse range selection. Document pointer listeners
 * exist only while a range drag runs.
 */
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { clampRange, type GridCellRef, type GridRange } from "./grid-edit-core.ts";
import { createPointerDrag } from "./grid-controls-core.ts";
import { cellOf } from "./grid-props.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

/** Raw cursor state (before the model knows the row / column counts it is clamped to). */
export function useCursorState(initialCol: number) {
  const [active, setActive] = useState<GridCellRef>({ row: 0, col: initialCol });
  const [anchor, setAnchor] = useState<GridCellRef | null>(null);
  return { active, setActive, anchor, setAnchor };
}
type CursorState = ReturnType<typeof useCursorState>;

type CursorInput = {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Data rows (items); rowCount adds the summary row. */
  count: number;
  rowCount: number;
  colCount: number;
  firstDataCol: number;
  lastDataCol: number;
  isFieldCol: (col: number) => boolean;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  /** Widths of the frozen start / end blocks. */
  frozenWidth: number;
  trailingWidth: number;
  /** An editor is open (it owns focus; read when the focus effect runs). */
  editOpen: { current: boolean };
};

export function useGridCursor(state: CursorState, input: CursorInput) {
  const { active, setActive, anchor, setAnchor } = state;
  const { count, rowCount, colCount, firstDataCol, lastDataCol } = input;
  const cell = { row: Math.max(-1, Math.min(active.row, rowCount - 1)), col: Math.max(0, Math.min(active.col, colCount - 1)) };
  const range: GridRange | null = anchor && cell.row >= 0 && cell.row < count ? clampRange({ anchor, focus: cell }, count, firstDataCol, lastDataCol) : null;
  const effectiveRange: GridRange | null = range ?? (cell.row >= 0 && cell.row < count && input.isFieldCol(cell.col) ? { anchor: cell, focus: cell } : null);
  const focusPending = useRef(false);
  const activeRef = useRef(cell);
  activeRef.current = cell;
  useFocusActive(input, cell, focusPending);
  const moveTo = (next: GridCellRef, extend = false) => {
    focusPending.current = true;
    if (extend) setAnchor((old) => old ?? cell);
    else setAnchor(null);
    setActive(next);
  };
  const latest = useRef(input);
  latest.current = input;
  // Range drag: pointermove / pointerup on the document only between pointerdown and pointerup (created on the
  // first drag: no `document` while rendering on the server).
  const dragRef = useRef<ReturnType<typeof createPointerDrag> | null>(null);
  const drag = () => (dragRef.current ??= createPointerDrag<PointerEvent>(document, {
    move: (event) => {
      if (!(event.buttons & 1)) return;
      const node = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-cell]");
      const at = node && latest.current.scrollRef.current?.contains(node) ? cellOf(node) : null;
      if (!at || at.row < 0 || at.row >= latest.current.count || Number.isNaN(at.col) || !latest.current.isFieldCol(at.col)) return;
      setActive((old) => (old.row === at.row && old.col === at.col ? old : { row: at.row, col: at.col }));
    },
    up: () => setAnchor((old) => (old && old.row === activeRef.current.row && old.col === activeRef.current.col ? null : old)),
  }));
  useLayoutEffect(() => () => dragRef.current?.stop(), []);
  const onCellPointerDown = (event: ReactPointerEvent<HTMLDivElement>, row: number, col: number) => {
    if (event.button !== 0 || !input.isFieldCol(col)) return;
    if ((event.target as HTMLElement).closest("a, button, input, textarea:not([data-grid-capture]), [role=checkbox], .aui-grid-editor")) return;
    if (event.shiftKey) {
      event.preventDefault();
      setAnchor((old) => old ?? cell);
      setActive({ row, col });
      return;
    }
    setAnchor({ row, col });
    setActive({ row, col });
    if (event.pointerType === "mouse") drag().start();
  };
  return { cell, active, setActive, anchor, setAnchor, range, effectiveRange, focusPending, moveTo, onCellPointerDown };
}

/** Focus the active cell (or its input capture) after keyboard moves; keep it clear of sticky header, footer and frozen columns. */
function useFocusActive(input: CursorInput, cell: GridCellRef, focusPending: { current: boolean }) {
  useLayoutEffect(() => {
    const box = input.scrollRef.current;
    if (!box || !focusPending.current || input.editOpen.current) return;
    focusPending.current = false;
    const target = box.querySelector<HTMLElement>(`[data-cell="${cell.row}:${cell.col}"]`) ?? box.querySelector<HTMLElement>(`[data-row-index="${cell.row}"] [data-cell]`);
    if (cell.row >= 0 && cell.row < input.count) input.virtualizer.scrollToIndex(cell.row, { align: "auto" });
    if (!target) return;
    (target.querySelector<HTMLElement>(":scope > [data-grid-capture]") ?? target).focus({ preventScroll: true });
    if (target.dataset.pin) return;
    const boxRect = box.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    if (rect.left < boxRect.left + input.frozenWidth) box.scrollLeft -= boxRect.left + input.frozenWidth - rect.left;
    else if (rect.right > boxRect.left + box.clientWidth - input.trailingWidth) box.scrollLeft += rect.right - (boxRect.left + box.clientWidth - input.trailingWidth);
  });
}
