"use client";
/**
 * In-place editing of BitableGrid: the edit state (by record id + field key, so it follows its record when rows
 * move), type-to-edit through the input capture (IME composition, keys buffered while the editor loads), commit /
 * cancel, checkbox and rating clicks, and the draft of an editor whose record left the view.
 */
import { useEffect, useRef, useState, type CompositionEvent, type FormEvent } from "react";
import type { RowData } from "@tanstack/react-table";
import { readField, type GridField, type GridPerson } from "./grid-core.ts";
import { isCellEditable, makeChange, validateFieldInput, type GridCellRef } from "./grid-edit-core.ts";
import type { GridCommitMove, GridEditorCommit } from "./grid-editors.tsx";
import type { useGridEditing } from "./grid-editing.ts";
import { captureEdit, locateEdit, type CaptureEvent, type GridDraft, type GridEditState } from "./grid-capture-core.ts";
import type { GridItem } from "./grid-props.ts";

export type EditDeps<T> = {
  editing: ReturnType<typeof useGridEditing<T>>;
  fieldAt: (col: number) => GridField<T> | null;
  colIndex: (field: string) => number;
  itemAt: (index: number) => GridItem<T>;
  indexOfRow: (rowId: string) => number;
  /** The record before the overlay (client rows / server cache). */
  findRow: (rowId: string) => T | undefined;
  count: number;
  firstDataCol: number;
  lastDataCol: number;
  /** Data is not loading (a missing record is really gone). */
  settled: boolean;
  people: (field: GridField<T>) => readonly GridPerson[] | undefined;
  cursor: { cell: GridCellRef; setActive: (next: GridCellRef) => void; setAnchor: (next: GridCellRef | null) => void; focusPending: { current: boolean } };
};

export function useGridEditActions<T extends RowData>(deps: EditDeps<T>) {
  const [edit, setEdit] = useState<GridEditState | null>(null);
  const draft = useRef<GridDraft | null>(null);
  const { editing, fieldAt, itemAt, cursor } = deps;
  const canEditCell = (row: number, col: number) => {
    const field = fieldAt(col);
    const item = row >= 0 && row < deps.count ? itemAt(row) : null;
    return Boolean(editing.enabled && field && item?.kind === "row" && isCellEditable(field, item.row));
  };
  const location = edit ? locateEdit(edit, { rowIndex: deps.indexOfRow, colIndex: deps.colIndex }, deps.settled) : null;
  useEditFollow(edit, location, deps, setEdit, draft);
  const startEdit = (row: number, col: number, startText?: string) => {
    const item = itemAt(row);
    const field = fieldAt(col);
    if (item.kind !== "row" || !field) return;
    // Attachment / link cells have no in-cell editor: without the host's `openEditor` (bt/grid-b: record picker /
    // upload drawer) there is nothing to open (an edit state with no editor would swallow the keyboard).
    if (!field.openEditor && (field.type === "attachment" || field.type === "link")) return;
    cursor.setAnchor(null);
    cursor.setActive({ row, col });
    if (field.openEditor) return field.openEditor(item.row);
    draft.current = null;
    setEdit({ rowId: item.id, field: field.key, startText });
  };
  const finishEdit = (commitValue: GridEditorCommit | null, move: GridCommitMove) => {
    const current = edit;
    if (!current) return;
    const field = deps.colIndex(current.field) >= 0 ? fieldAt(deps.colIndex(current.field)) : null;
    const base = deps.findRow(current.rowId);
    if (commitValue && field && base === undefined) return lostRecord(current, field, commitValue);
    if (commitValue && field && base !== undefined) {
      const error = saveCommit(field, editing.present(base), current.rowId, commitValue);
      if (error) return setEdit({ ...current, error });
    }
    setEdit(null);
    draft.current = null;
    cursor.focusPending.current = true;
    const here = location?.kind === "here" ? location : { row: cursor.cell.row, col: cursor.cell.col };
    cursor.setActive(move === "down" ? { row: Math.min(deps.count - 1, here.row + 1), col: here.col }
      : move === "up" ? { row: Math.max(0, here.row - 1), col: here.col }
      : move === "right" ? { row: here.row, col: Math.min(deps.lastDataCol, here.col + 1) }
      : move === "left" ? { row: here.row, col: Math.max(deps.firstDataCol, here.col - 1) }
      : { row: here.row, col: here.col });
  };
  /** Commit of a record that is gone meanwhile: keep the text in the status line (「重新填入」). */
  const lostRecord = (current: GridEditState, field: GridField<T>, commitValue: GridEditorCommit) => {
    setEdit(null);
    const text = "text" in commitValue ? commitValue.text : draft.current?.text ?? "";
    draft.current = null;
    surfaceDraft(editing, { rowId: current.rowId, field: field.key, text }, field.title);
  };
  /** Validate and save one cell; the error to show in the editor, or null. */
  const saveCommit = (field: GridField<T>, row: T, rowId: string, commitValue: GridEditorCommit): string | null => {
    let value: unknown;
    if ("text" in commitValue) {
      const parsed = validateFieldInput(field, commitValue.text, row, deps.people(field));
      if (!parsed.ok) return parsed.error;
      value = parsed.value;
    } else {
      value = commitValue.value;
      const message = field.required && (value === null || (Array.isArray(value) && !value.length)) ? `「${field.title}」不能为空` : field.validate?.(value, row) ?? null;
      if (message) return message;
    }
    const change = makeChange(field, row, rowId, value);
    if (change) void editing.apply([change], "edit", { label: `修改「${field.title}」` });
    return null;
  };
  return { edit, setEdit, location, draft, canEditCell, startEdit, finishEdit, ...useCellToggles(deps, canEditCell), capture: useCapture(edit, setEdit, deps, startEdit) };
}

/** The edit follows its record (active cell moves with it); a record that is gone ends it with the draft kept. */
function useEditFollow<T>(edit: GridEditState | null, location: ReturnType<typeof locateEdit> | null, deps: EditDeps<T>, setEdit: (next: GridEditState | null) => void, draft: { current: GridDraft | null }) {
  const row = location?.kind === "here" ? location.row : -1;
  const col = location?.kind === "here" ? location.col : -1;
  const gone = location?.kind === "gone";
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the edited record's move re-points the cursor; keyed on the cursor too, every arrow key would snap back to the editor.
  useEffect(() => {
    if (row >= 0 && (deps.cursor.cell.row !== row || deps.cursor.cell.col !== col)) deps.cursor.setActive({ row, col });
  }, [row, col]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on the transition to 「record gone」 only; the edit / draft it closes are read from this render.
  useEffect(() => {
    if (!gone || !edit) return;
    setEdit(null);
    const field = deps.colIndex(edit.field) >= 0 ? deps.fieldAt(deps.colIndex(edit.field)) : null;
    const text = draft.current?.rowId === edit.rowId && draft.current.field === edit.field ? draft.current.text : edit.startText ?? "";
    draft.current = null;
    if (text) surfaceDraft(deps.editing, { rowId: edit.rowId, field: edit.field, text }, field?.title ?? edit.field);
  }, [gone]);
}

function surfaceDraft<T>(editing: ReturnType<typeof useGridEditing<T>>, saved: GridDraft, title: string) {
  editing.setStatus({ tone: "error", text: `「${title}」没有保存：这条记录已不在当前视图。你输入的「${saved.text}」还在`, draft: saved });
}

/** Checkbox clicks and rating stars (click the current value again to clear it). */
function useCellToggles<T>(deps: EditDeps<T>, canEditCell: (row: number, col: number) => boolean) {
  const change = (row: number, col: number, value: (field: GridField<T>, current: T) => unknown) => {
    const field = deps.fieldAt(col);
    const item = deps.itemAt(row);
    if (!field || item.kind !== "row" || !canEditCell(row, col)) return;
    const next = makeChange(field, item.row, item.id, value(field, item.row));
    if (next) void deps.editing.apply([next], "edit", { label: `修改「${field.title}」` });
  };
  return {
    toggleCheckbox: (row: number, col: number) => change(row, col, (field, current) => readField(field, current) !== true),
    /** bt/grid-b: a click on a star sets the rating (the current value again clears it). */
    setRating: (row: number, col: number, star: Element | null) => {
      if (!star) return;
      const stars = [...(star.parentElement?.querySelectorAll(".aui-rating-star") ?? [])];
      const picked = stars.indexOf(star) + 1;
      if (picked >= 1) change(row, col, (field, current) => (readField(field, current) === picked ? null : picked));
    },
  };
}

/**
 * Events of the active cell's input capture (grid-capture.tsx): composition starts an edit without mounting the
 * editor (that would end the composition), its end hands the composed text over; text typed while the editor
 * loads is appended to its start text.
 */
function useCapture<T>(edit: GridEditState | null, setEdit: (next: GridEditState | null) => void, deps: EditDeps<T>, startEdit: (row: number, col: number, text?: string) => void) {
  const apply = (event: CaptureEvent) => {
    const next = captureEdit(edit, event);
    if (next !== edit) setEdit(next);
  };
  return {
    onCompositionStart: (row: number, col: number) => {
      const item = deps.itemAt(row);
      const field = deps.fieldAt(col);
      if (item.kind === "row" && field) {
        deps.cursor.setAnchor(null);
        apply({ type: "compositionstart", rowId: item.id, field: field.key });
      }
    },
    onCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => {
      const node = event.currentTarget;
      const text = node.value || event.data || "";
      node.value = "";
      apply({ type: "compositionend", text });
    },
    onInput: (event: FormEvent<HTMLTextAreaElement>) => {
      const node = event.currentTarget;
      if ((event.nativeEvent as InputEvent).isComposing) return;
      const text = node.value;
      node.value = "";
      // Text that arrived without a keydown the grid understood (a dead key, a virtual keyboard): it starts the edit.
      if (!edit && text) return startEdit(deps.cursor.cell.row, deps.cursor.cell.col, text);
      apply({ type: "input", text });
    },
  };
}
