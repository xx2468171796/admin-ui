"use client";
/**
 * Range operations of BitableGrid: clear, copy / cut / paste (Excel compatible TSV + HTML, formulas escaped), the
 * cell menu's clipboard items, and fill (handle drag / Ctrl + D).
 */
import type { ClipboardEvent as ReactClipboardEvent, RefObject } from "react";
import { fieldText, type GridField, type GridPerson } from "./grid-core.ts";
import { parseTsv, planClear, planPaste, rangeBounds, rangeCellCount, rangeText, toHtmlTable, toTsv, type GridCellRef, type GridRange, type PlanContext } from "./grid-edit-core.ts";
import { filledRange, planFill, type GridFillTarget } from "./grid-fill-core.ts";
import { readClipboard, writeClipboard } from "./grid-drag.ts";
import type { useGridEditing } from "./grid-editing.ts";
import { isTyping, type GridItem } from "./grid-props.ts";

export type ClipboardDeps<T> = {
  editing: ReturnType<typeof useGridEditing<T>>;
  itemAt: (index: number) => GridItem<T>;
  fieldAt: (col: number) => GridField<T> | null;
  people: (field: GridField<T>) => readonly GridPerson[] | undefined;
  count: number;
  lastDataCol: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** An editor is open (it handles its own clipboard). */
  editOpen: boolean;
  cursor: { cell: GridCellRef; effectiveRange: GridRange | null; setActive: (next: GridCellRef) => void; setAnchor: (next: GridCellRef | null) => void; focusPending: { current: boolean } };
};

export function useGridClipboard<T>(deps: ClipboardDeps<T>) {
  const { editing, cursor } = deps;
  const range = cursor.effectiveRange;
  const planContext: PlanContext<T> = {
    rowAt: (index) => {
      const item = index >= 0 && index < deps.count ? deps.itemAt(index) : null;
      return item?.kind === "row" ? { row: item.row, rowId: item.id } : null;
    },
    rowCount: deps.count,
    fieldAt: deps.fieldAt,
    people: deps.people,
  };
  const clearRange = () => {
    if (!editing.enabled || !range) return;
    const plan = planClear(range, planContext);
    void editing.apply(plan.changes, "clear", { label: "清空", skipped: plan.skipped.length, skipReason: plan.skipped[0]?.reason });
  };
  const copyRange = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!range) return false;
    const matrix = rangeText(range, planContext, fieldText);
    if (!matrix.length) return false;
    event.clipboardData.setData("text/plain", toTsv(matrix));
    event.clipboardData.setData("text/html", toHtmlTable(matrix));
    event.preventDefault();
    return true;
  };
  const pasteText = (text: string, target: GridRange | null = range) => {
    if (!target) return;
    const matrix = parseTsv(text);
    const plan = planPaste(matrix, target, planContext);
    void editing.apply(plan.changes, "paste", { label: "粘贴", skipped: plan.skipped.length, skipReason: plan.skipped[0]?.reason });
    // Select what was pasted (single value filling a range keeps the range).
    if (matrix.length === 1 && matrix[0]?.length === 1) return;
    const b = rangeBounds(target);
    const rows = Math.min(deps.count - 1, b.top === b.bottom ? cursor.cell.row + matrix.length - 1 : b.bottom);
    cursor.setAnchor({ row: b.top, col: b.left });
    cursor.setActive({ row: rows, col: Math.min(deps.lastDataCol, b.left + Math.max(...matrix.map((r) => r.length)) - 1) });
  };
  const applyFill = (source: GridRange, target: GridFillTarget) => {
    const plan = planFill(source, target, planContext);
    void editing.apply(plan.changes, "fill", { label: "填充", skipped: plan.skipped.length, skipReason: plan.skipped[0]?.reason });
    const filled = filledRange(source, target);
    cursor.setAnchor(filled.anchor);
    cursor.setActive(filled.focus);
    cursor.focusPending.current = true;
  };
  const handlers = {
    onCopy: (event: ReactClipboardEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      // Text the user selected outside the grid (or inside an editor) copies natively.
      if (deps.editOpen || isTyping(event.target) || (selection?.toString() && !deps.scrollRef.current?.contains(selection.anchorNode))) return;
      selection?.removeAllRanges();
      if (copyRange(event) && range) editing.setStatus({ tone: "success", text: copiedText(range) });
    },
    onCut: (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (deps.editOpen || isTyping(event.target) || !copyRange(event)) return;
      clearRange();
    },
    onPaste: (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (deps.editOpen || isTyping(event.target) || !editing.enabled || !range) return;
      const text = event.clipboardData.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      pasteText(text);
    },
  };
  return { planContext, clearRange, applyFill, handlers, menu: menuActions(planContext, editing, pasteText) };
}

const copiedText = (target: GridRange) => `已复制 ${rangeCellCount(target)} 格，可粘贴到 Excel / 飞书 / 本表`;

/** The cell menu's clipboard items (the async Clipboard API) and the rows a range covers. */
function menuActions<T>(planContext: PlanContext<T>, editing: ClipboardDeps<T>["editing"], pasteText: (text: string, target: GridRange) => void) {
  return {
    copyCells: async (target: GridRange) => {
      const matrix = rangeText(target, planContext, fieldText);
      if (!matrix.length) return;
      const ok = await writeClipboard(toTsv(matrix), toHtmlTable(matrix));
      editing.setStatus(ok ? { tone: "success", text: copiedText(target) } : { tone: "error", text: "浏览器不允许写剪贴板，请用 Ctrl + C" });
    },
    pasteFromMenu: async (target: GridRange) => {
      const text = await readClipboard();
      if (text === null) return editing.setStatus({ tone: "error", text: "浏览器不允许读剪贴板，请用 Ctrl + V" });
      if (text) pasteText(text, target);
    },
    /** Record ids of the rows a range covers (group / loading rows skipped). */
    rangeRowIds: (target: GridRange | null) => {
      if (!target) return [];
      const b = rangeBounds(target);
      const ids: string[] = [];
      for (let r = b.top; r <= b.bottom; r++) {
        const hit = planContext.rowAt(r);
        if (hit) ids.push(hit.rowId);
      }
      return ids;
    },
  };
}
