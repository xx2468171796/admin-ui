/**
 * Pure rules of the grid's optimistic overlay and undo history when saves overlap (useGridEditing,
 * grid-editing.ts): which cells a failed batch really rolls back, what the status line may claim, which
 * `before` the undo stack records, and when a saved cell can leave the overlay. No React; unit-tested in
 * test/grid-editing-core.test.ts.
 */
import { sameFieldValue, type GridCellChange, type GridHistory } from "./grid-edit-core.ts";

/** One cell of the overlay: a value being saved, or saved and waiting for the host's data to carry it. */
export type GridOverlayCell = { rowId: string; field: string; value: unknown; state: "saving" | "saved"; misses?: number };
export type GridOverlay = ReadonlyMap<string, GridOverlayCell>;
export const overlayKey = (rowId: string, field: string) => `${rowId}\u0000${field}`;

/** Put a batch into the overlay as 「保存中」. */
export function markSaving<T>(overlay: GridOverlay, changes: readonly GridCellChange<T>[]): Map<string, GridOverlayCell> {
  const next = new Map(overlay);
  for (const change of changes) next.set(overlayKey(change.rowId, change.field), { rowId: change.rowId, field: change.field, value: change.value, state: "saving" });
  return next;
}

/**
 * Land a batch's answer. Accepted cells become `saved`; refused cells are removed (rolled back) — unless a newer
 * edit of the same cell owns it by now, which then stays (superseded: nothing was rolled back there).
 */
export function settleOverlay<T>(overlay: GridOverlay, changes: readonly GridCellChange<T>[], refused: ReadonlySet<string>): { next: Map<string, GridOverlayCell>; rolledBack: number; superseded: number } {
  const next = new Map(overlay);
  let rolledBack = 0;
  let superseded = 0;
  for (const change of changes) {
    const key = overlayKey(change.rowId, change.field);
    const owned = next.get(key)?.value === change.value;
    if (refused.has(key)) {
      if (!owned) superseded++;
      else {
        next.delete(key);
        rolledBack++;
      }
    } else if (owned) next.set(key, { rowId: change.rowId, field: change.field, value: change.value, state: "saved" });
  }
  return { next, rolledBack, superseded };
}

/** Status line of a failed batch: only cells that really went back are said to be restored. */
export function failureText(failure: string, rolledBack: number, total: number): string {
  if (rolledBack >= total) return `保存失败，已恢复原值：${failure}`;
  if (rolledBack === 0) return `较早的一次保存失败（${failure}），格子里保留的是之后的修改`;
  return `保存失败，已恢复 ${rolledBack} 格原值（另 ${total - rolledBack} 格保留之后的修改）：${failure}`;
}

/** An edit whose save failed: the cell never held `value` on the server, it still holds `previous`. */
export type GridEditFailure = { rowId: string; field: string; value: unknown; previous: unknown };

/**
 * The `before` the undo stack records for a cell: the edit's `previous`, unless that was the optimistic value of
 * an earlier edit that failed — then what that one replaced (repeatedly, for a chain of failed edits).
 */
export function confirmedBefore(previous: unknown, rowId: string, field: string, failures: readonly GridEditFailure[]): unknown {
  let before = previous;
  for (let guard = 0; guard < failures.length; guard++) {
    const failed = [...failures].reverse().find((f) => f.rowId === rowId && f.field === field && sameFieldValue(f.value, before));
    if (!failed) break;
    before = failed.previous;
  }
  return before;
}

/**
 * An edit failed after a later edit of the same cell was already saved (and put on the undo stack with the failed
 * value as its `before`): that entry's `before` becomes what the failed edit replaced, so undo restores a value
 * the server really had.
 */
export function rebaseGridHistory(history: GridHistory, failure: GridEditFailure): GridHistory {
  for (let i = history.past.length - 1; i >= 0; i--) {
    const entry = history.past[i];
    const at = entry?.cells.findIndex((cell) => cell.rowId === failure.rowId && cell.field === failure.field) ?? -1;
    if (!entry || at < 0) continue;
    const cell = entry.cells[at];
    if (!cell || !sameFieldValue(cell.before, failure.value)) return history;
    const cells = entry.cells.map((c, j) => (j === at ? { ...c, before: failure.previous } : c));
    const past = history.past.slice();
    past[i] = { ...entry, cells };
    return { ...history, past };
  }
  return history;
}

/** Host data changes that may pass without carrying a saved value before the cell is released anyway. */
export const GRID_RELEASE_AFTER = 3;
/**
 * The host's data changed: a saved cell leaves the overlay once the host value equals it (or the record is gone);
 * a host update that does not carry it yet keeps it (no flash back to the old value) — up to GRID_RELEASE_AFTER
 * updates, after which the host evidently keeps another value.
 */
export function releaseSavedCells(overlay: GridOverlay, host: (rowId: string, field: string) => { found: boolean; value?: unknown }): GridOverlay {
  let changed = false;
  const next = new Map<string, GridOverlayCell>();
  for (const [key, cell] of overlay) {
    if (cell.state !== "saved") {
      next.set(key, cell);
      continue;
    }
    changed = true;
    const current = host(cell.rowId, cell.field);
    const misses = (cell.misses ?? 0) + 1;
    if (!current.found || sameFieldValue(current.value, cell.value) || misses >= GRID_RELEASE_AFTER) continue;
    next.set(key, { ...cell, misses });
  }
  return changed ? next : overlay;
}
