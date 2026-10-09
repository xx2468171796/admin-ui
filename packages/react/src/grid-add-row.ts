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
  /** Server mode: refetch the loaded blocks / groups so the new row comes in. */
  refresh: () => void;
  /** Item index showing this row now (-1 = not loaded / not shown yet). */
  locate: (rowId: string) => number;
  /** Bring the row into view and open its first editable cell. */
  reveal: (index: number) => void;
  /** Not there yet: move towards where it will appear (ungrouped: the end). */
  seek: () => void;
};

/**
 * Runs `onAddRow` (one at a time: a double click adds one record) and, when it answers an id, keeps
 * looking for that row on every render until it shows up or {@link ADD_ROW_REVEAL_MS} passes.
 */
export function useAddRow(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const busy = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(async (group: Readonly<Record<string, string>>) => {
    const handler = latest.current.onAddRow;
    if (!handler || busy.current) return;
    busy.current = true;
    try {
      const id = await handler(group);
      if (typeof id === "string" && id) {
        latest.current.refresh();
        setPending(id);
      }
    } finally {
      busy.current = false;
    }
  }, []);
  // Every render while pending: the rows / blocks / layout it depends on change from render to render.
  useEffect(() => {
    if (!pending) return;
    const index = latest.current.locate(pending);
    if (index < 0) {
      latest.current.seek();
      return;
    }
    setPending(null);
    latest.current.reveal(index);
  });
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), ADD_ROW_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  return { run, adding: pending !== null };
}
