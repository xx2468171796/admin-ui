"use client";
/**
 * Edit state of BitableGrid: the optimistic overlay (new values shown at once, marked 保存中 until
 * the host resolves, rolled back with the reason when it fails), the undo / redo stack and the status
 * line. Pure rules live in grid-edit-core.ts; this hook only sequences them around the host's
 * `onCellsChange`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyGridHistory,
  makeChange,
  pushGridHistory,
  redoGridHistory,
  restoreGridHistory,
  sameFieldValue,
  undoGridHistory,
  writeField,
  type GridCellChange,
  type GridEditSource,
  type GridHistory,
  type GridHistoryEntry,
  type GridSaveResult,
} from "./grid-edit-core.ts";
import { readField, type GridField } from "./grid-core.ts";

/** `overwrite`: the user chose 「用我的覆盖」 after a conflict — save even though someone changed it since. */
export type GridCellsChangeHandler<T> = (changes: GridCellChange<T>[], context: { source: GridEditSource; overwrite?: boolean }) => GridSaveResult | Promise<GridSaveResult>;
type CellState = { value: unknown; state: "saving" | "saved" };
/** One cell edit that collided (status line shows EditConflictNotice; stays until handled). */
export type GridStatusConflict<T = unknown> = { change: GridCellChange<T>; by: string; at?: string; theirs: unknown };
export type GridStatus = { tone: "info" | "success" | "error"; text: string; undo?: boolean; conflict?: GridStatusConflict } | null;

export type UseGridEditingInput<T> = {
  fields: readonly GridField<T>[];
  getRowId: (row: T) => string;
  onCellsChange?: GridCellsChangeHandler<T>;
  /** Current record by id (client rows or the server cache), before the overlay. */
  findRow: (rowId: string) => T | undefined;
  /** The data the host gave changed identity (new rows / refetched block): saved cells are released. */
  dataVersion: unknown;
  /** After a save: records with the saved values, so a server cache can keep them. */
  onSaved?: (rows: ReadonlyMap<string, T>) => void;
};

const keyOf = (rowId: string, field: string) => `${rowId}\u0000${field}`;

export function useGridEditing<T>({ fields, getRowId, onCellsChange, findRow, dataVersion, onSaved }: UseGridEditingInput<T>) {
  const [overlay, setOverlay] = useState<ReadonlyMap<string, CellState>>(new Map());
  const [history, setHistory] = useState<GridHistory>(emptyGridHistory);
  const [status, setStatus] = useState<GridStatus>(null);
  const historyRef = useRef(history);
  historyRef.current = history;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const byKeyRef = useRef(byKey);
  byKeyRef.current = byKey;
  const busy = useRef(0);

  // Saved cells stay in the overlay until the host's data changes (it then carries the value).
  const firstVersion = useRef(true);
  useEffect(() => {
    if (firstVersion.current) {
      firstVersion.current = false;
      return;
    }
    setOverlay((old) => {
      if (![...old.values()].some((cell) => cell.state === "saved")) return old;
      return new Map([...old].filter(([, cell]) => cell.state === "saving"));
    });
  }, [dataVersion]);

  /** The record as the user should see it: pending / just-saved values applied. */
  const present = useCallback((row: T): T => {
    if (!overlayRef.current.size) return row;
    const id = getRowId(row);
    let out = row;
    for (const field of byKeyRef.current.values()) {
      const cell = overlayRef.current.get(keyOf(id, field.key));
      if (!cell) continue;
      if (cell.state === "saved" && sameFieldValue(readField(field, row), cell.value)) continue;
      try {
        out = writeField(field, out, cell.value);
      } catch {
        /* a field without write: shown after the host updates */
      }
    }
    return out;
  }, [getRowId]);

  const cellState = (rowId: string, field: string): "saving" | null => (overlay.get(keyOf(rowId, field))?.state === "saving" ? "saving" : null);

  /**
   * Send a batch to the host. Returns true when every cell was accepted. `record` = put it on the
   * undo stack (false for undo / redo themselves, which move the stack instead).
   */
  const apply = useCallback(async (changes: GridCellChange<T>[], source: GridEditSource, options: { label?: string; skipped?: number; skipReason?: string; overwrite?: boolean } = {}): Promise<boolean> => {
    if (!onCellsChange) return false;
    if (!changes.length) {
      if (options.skipped) setStatus({ tone: "error", text: `没有可写入的格子：${options.skipReason ?? "都被跳过了"}` });
      return false;
    }
    busy.current++;
    setOverlay((old) => {
      const next = new Map(old);
      for (const change of changes) next.set(keyOf(change.rowId, change.field), { value: change.value, state: "saving" });
      return next;
    });
    const n = changes.length;
    setStatus({ tone: "info", text: `正在保存 ${n} 格…` });
    let rejected: { rowId: string; field: string; error: string; conflict?: { by: string; at?: string; value: unknown } }[] = [];
    let failure: string | null = null;
    try {
      const result = await onCellsChange(changes, options.overwrite ? { source, overwrite: true } : { source });
      rejected = result && "rejected" in result && result.rejected ? [...result.rejected] : [];
    } catch (error) {
      failure = error instanceof Error ? error.message : "保存失败";
    } finally {
      busy.current--;
    }
    const refused = new Set(failure ? changes.map((c) => keyOf(c.rowId, c.field)) : rejected.map((r) => keyOf(r.rowId, r.field)));
    const accepted = changes.filter((c) => !refused.has(keyOf(c.rowId, c.field)));
    setOverlay((old) => {
      const next = new Map(old);
      for (const change of changes) {
        const key = keyOf(change.rowId, change.field);
        // A newer edit of the same cell owns it now.
        if (next.get(key)?.value !== change.value) continue;
        if (refused.has(key)) next.delete(key);
        else next.set(key, { value: change.value, state: "saved" });
      }
      return next;
    });
    if (accepted.length && onSaved) {
      const rows = new Map<string, T>();
      for (const change of accepted) {
        const base = rows.get(change.rowId) ?? findRow(change.rowId) ?? change.row;
        const field = byKeyRef.current.get(change.field);
        if (field) rows.set(change.rowId, writeField(field, base, change.value));
      }
      onSaved(rows);
    }
    if ((source === "edit" || source === "paste" || source === "clear" || source === "fill") && accepted.length) setHistory((old) => pushGridHistory(old, options.label ?? "编辑", accepted));
    const verb = source === "undo" ? "已撤销" : source === "redo" ? "已重做" : source === "paste" ? "已粘贴" : source === "clear" ? "已清空" : source === "fill" ? "已填充" : "已保存";
    const skipped = options.skipped ?? 0;
    if (failure) setStatus({ tone: "error", text: `保存失败，已恢复原值：${failure}` });
    else if (rejected.length === 1 && changes.length === 1 && rejected[0]!.conflict) {
      // someone saved this cell first — keep theirs, keep mine aside to put back / force.
      const { by, at, value } = rejected[0]!.conflict;
      setStatus({ tone: "error", text: `${by} 刚改过这一格`, conflict: { change: changes[0] as GridCellChange<unknown>, by, at, theirs: value } });
    } else if (rejected.length) setStatus({ tone: "error", text: `${accepted.length ? `${verb} ${accepted.length} 格，` : ""}${rejected.length} 格未保存：${rejected[0]!.error}` });
    else if (skipped) setStatus({ tone: "error", text: `${verb} ${accepted.length} 格，跳过 ${skipped} 格：${options.skipReason ?? ""}`, undo: source !== "undo" && source !== "redo" });
    else setStatus({ tone: "success", text: `${verb} ${accepted.length} 格`, undo: source !== "undo" && source !== "redo" });
    return !failure && !rejected.length;
  }, [onCellsChange, onSaved, findRow]);

  const replay = useCallback(async (entry: GridHistoryEntry, direction: "undo" | "redo") => {
    const changes: GridCellChange<T>[] = [];
    const rows = new Map<string, T>();
    for (const cell of entry.cells) {
      const field = byKeyRef.current.get(cell.field);
      const base = rows.get(cell.rowId) ?? (() => { const r = findRow(cell.rowId); return r === undefined ? undefined : present(r); })();
      if (!field || base === undefined) continue;
      const change = makeChange(field, base, cell.rowId, direction === "undo" ? cell.before : cell.after);
      if (!change) continue;
      rows.set(cell.rowId, change.next);
      changes.push(change);
    }
    if (!changes.length) {
      setStatus({ tone: "info", text: direction === "undo" ? "没有可撤销的改动（记录可能已变化）" : "没有可重做的改动" });
      return;
    }
    const ok = await apply(changes, direction);
    if (!ok) setHistory((old) => restoreGridHistory(old, entry, direction));
  }, [apply, findRow, present]);

  const undo = useCallback(() => {
    const step = undoGridHistory(historyRef.current);
    if (!step) return setStatus({ tone: "info", text: "没有可撤销的操作" });
    setHistory(step.history);
    void replay(step.entry, "undo");
  }, [replay]);
  const redo = useCallback(() => {
    const step = redoGridHistory(historyRef.current);
    if (!step) return setStatus({ tone: "info", text: "没有可重做的操作" });
    setHistory(step.history);
    void replay(step.entry, "redo");
  }, [replay]);

  // Status disappears after a while (errors stay longer).
  useEffect(() => {
    if (!status || status.tone === "info" || status.conflict) return;
    const timer = setTimeout(() => setStatus(null), status.tone === "error" ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [status]);

  return {
    enabled: Boolean(onCellsChange),
    present,
    cellState,
    apply,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    status,
    setStatus,
    overlayVersion: overlay,
    saving: () => busy.current > 0,
  };
}
