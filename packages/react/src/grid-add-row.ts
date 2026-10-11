/**
 * 「新增记录」 (bt/add-row, 8.7): the footer 「+」, the 「+ 新增一行」 rows and the group menu all go through
 * `useAddRow`. The host's `onAddRow` may answer the new record's id (or a promise of it); the grid then
 * finds that row — client rows once the host has put it in `rows`, server rows after its own refresh
 * (scrolling to the end, where hosts pin new rows) — and opens its first editable cell, so the user just
 * types (飞书「新增记录」).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GridFieldType } from "./grid-core.ts";

/** What `onAddRow` answers: the new record's id (reveal + edit it), or nothing (the host shows it itself). */
export type GridAddRowResult = string | null | undefined | void;
export type GridAddRowHandler = (group: Readonly<Record<string, string>>) => GridAddRowResult | Promise<GridAddRowResult>;

/** How long the grid looks for the new row before giving up (the host may have filtered it out). */
export const ADD_ROW_REVEAL_MS = 8000;

/** Cell types without an in-cell text editor: never opened by 「新增记录」 (checkbox toggles, attachments / links use host pickers). */
const NO_INLINE_EDITOR = new Set<GridFieldType>(["checkbox", "attachment", "link"]);

/**
 * Column to open on a new row: the first data column (display order) whose cell is editable and has an
 * in-cell editor (no host `openEditor` picker); `null` when there is none (the first cell is just selected).
 */
export function firstInlineEditColumn(
  columns: readonly number[],
  info: (col: number) => { editable: boolean; type: GridFieldType | undefined; hostEditor: boolean },
): number | null {
  for (const col of columns) {
    const cell = info(col);
    if (cell.editable && !cell.hostEditor && cell.type && !NO_INLINE_EDITOR.has(cell.type)) return col;
  }
  return null;
}

type Options = {
  onAddRow: GridAddRowHandler | undefined;
  /** Server mode: refetch the loaded blocks / groups so the new row (this id) comes in; skip it when the host already inserted the row. */
  refresh: (id: string) => void;
  /** Item index showing this row now (-1 = not loaded / not shown yet). */
  locate: (rowId: string) => number;
  /** Bring the row into view and focus its first cell, or open its first editable cell when `edit`. */
  reveal: (index: number, edit: boolean) => void;
  /** Not there yet: move towards where it will appear (ungrouped: the end). */
  seek: () => void;
  /** Nothing is loading: a row that is not there now will not come by itself. */
  idle: () => boolean;
};

/** How long `revealRow` waits on an idle grid before answering false (the row may need one more render). */
const REVEAL_IDLE_MS = 300;
type Pending = { id: string; edit: boolean; seek: boolean; done?: (found: boolean) => void };

/**
 * Runs `onAddRow` (one at a time: a double click adds one record) and, when it answers an id, keeps
 * looking for that row on every render until it shows up or {@link ADD_ROW_REVEAL_MS} passes. `reveal`
 * (8.9, BitableGridHandle.revealRow) looks for any row the same way and answers whether it was found.
 */
export function useAddRow(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const busy = useRef(false);
  const [pending, setPendingState] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const setPending = useCallback((next: Pending | null, found = false) => {
    const old = pendingRef.current;
    if (old && old !== next) old.done?.(found);
    pendingRef.current = next;
    setPendingState(next);
  }, []);
  const run = useCallback(async (group: Readonly<Record<string, string>>) => {
    const handler = latest.current.onAddRow;
    if (!handler || busy.current) return;
    busy.current = true;
    try {
      const id = await handler(group);
      if (typeof id === "string" && id) {
        latest.current.refresh(id);
        setPending({ id, edit: true, seek: true });
      }
    } finally {
      busy.current = false;
    }
  }, [setPending]);
  const reveal = useCallback((id: string, edit: boolean) => new Promise<boolean>((done) => setPending({ id, edit, seek: false, done })), [setPending]);
  // Every render while pending: the rows / blocks / layout it depends on change from render to render.
  useEffect(() => {
    if (!pending) return;
    const index = latest.current.locate(pending.id);
    if (index < 0) {
      if (pending.seek) latest.current.seek();
      else if (latest.current.idle()) {
        const timer = setTimeout(() => { if (pendingRef.current === pending) setPending(null); }, REVEAL_IDLE_MS);
        return () => clearTimeout(timer);
      }
      return;
    }
    setPending(null, true);
    latest.current.reveal(index, pending.edit);
  });
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => { if (pendingRef.current === pending) setPending(null); }, ADD_ROW_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [pending, setPending]);
  useEffect(() => () => pendingRef.current?.done?.(false), []);
  return { run, reveal, adding: pending !== null && pending.seek };
}
