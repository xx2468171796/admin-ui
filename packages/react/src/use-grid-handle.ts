"use client";
/**
 * 「新增记录」 (8.7: run onAddRow, find the new row, open its first editable cell) and the 8.9 imperative handle
 * (refresh / patchRows / insertRow / removeRows / revealRow) of BitableGrid; a new query's rows start at the top.
 */
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import type { RowData } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { firstInlineEditColumn, useAddRow } from "./grid-add-row.ts";
import { gridQueryKey } from "./grid-data-core.ts";
import { preloadGridDataEdit, type BitableGridHandle } from "./grid-data.ts";
import { whenIdle } from "./lazy-part.ts";
import type { GridCellRef } from "./grid-edit-core.ts";
import type { GridField } from "./grid-core.ts";
import type { BitableGridProps } from "./grid-props.ts";
import type { GridModel, useGridRows } from "./use-grid-layout.ts";

type HandleDeps<T extends RowData> = {
  model: GridModel<T>;
  rows: ReturnType<typeof useGridRows<T>>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  lastVisible: number;
  dataCols: readonly number[];
  firstDataCol: number;
  fieldAt: (col: number) => GridField<T> | null;
  canEditCell: (row: number, col: number) => boolean;
  moveTo: (next: GridCellRef) => void;
  startEdit: (row: number, col: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function useGridAddRow<T extends RowData>(props: BitableGridProps<T>, deps: HandleDeps<T>) {
  const { model, rows, virtualizer } = deps;
  const { server, remote, remoteGroups, serverGroups, view } = model;
  const refreshAll = () => {
    if (!server) return;
    remote.refresh();
    if (serverGroups) remoteGroups.refresh();
  };
  // Rows the host put in with handle.insertRow: 「新增记录」 then needs no refetch.
  const inserted = useRef(new Set<string>());
  const addRow = useAddRow({
    onAddRow: props.onAddRow,
    refresh: (id) => {
      if (!inserted.current.delete(id)) refreshAll();
    },
    idle: () => !server || (remote.idle && !remoteGroups.loading),
    // Grouped server data: wait for the refreshed group headers too, or the row would land in the old layout.
    locate: (id) => (server && serverGroups && view.groupBy.length > 0 && remoteGroups.loading ? -1 : rows.indexOfRow(id)),
    reveal: (index, edit) => {
      const col = edit ? firstInlineEditColumn([...deps.dataCols], (c) => {
        const field = deps.fieldAt(c);
        return { editable: deps.canEditCell(index, c), type: field?.type, hostEditor: Boolean(field?.openEditor) };
      }) : null;
      virtualizer.scrollToIndex(index, { align: "auto" });
      if (col === null) return deps.moveTo({ row: index, col: deps.firstDataCol });
      deps.startEdit(index, col);
    },
    seek: () => {
      if (!rows.layout.grouped && rows.count > 0 && deps.lastVisible < rows.count - 1) virtualizer.scrollToIndex(rows.count - 1, { align: "end" });
    },
  });
  useGridHandle(props, model, { refreshAll, inserted, reveal: addRow.reveal });
  useScrollTopOnNewQuery(model, deps.scrollRef);
  return { addRow, refreshAll };
}

/** 8.9 handle: what hosts did by clicking 「刷新」 through the DOM, plus in-place inserts / removals. */
function useGridHandle<T extends RowData>(props: BitableGridProps<T>, model: GridModel<T>, deps: { refreshAll: () => void; inserted: { current: Set<string> }; reveal: (id: string, edit: boolean) => Promise<boolean> }) {
  const { server, remote, remoteGroups, shownLevels, groupPath, getRowId } = model;
  const { refreshAll, inserted } = deps;
  const handleImpl = useRef<BitableGridHandle<T> | null>(null);
  handleImpl.current = {
    refresh: refreshAll,
    patchRows: (list) => {
      if (server && list.length) remote.patch(new Map(list.map((row) => [getRowId(row), row])));
    },
    insertRow: (row, at) => {
      if (!server) return;
      inserted.current.add(getRowId(row));
      if (!shownLevels.length) {
        void remote.insert(row, at).then((done) => { if (!done) refreshAll(); });
        return;
      }
      // Grouped: only next to a loaded row of the same group (its header counts one more); else refetch.
      const anchor = at === "end" ? undefined : remote.findRow("before" in at ? at.before : at.after);
      const path = groupPath(row);
      if (anchor !== undefined && !remote.pending && groupPath(anchor).join("\u0000") === path.join("\u0000") && remoteGroups.adjust(path, 1)) {
        void remote.insert(row, at).then((done) => { if (!done) refreshAll(); });
        remoteGroups.refresh();
      } else refreshAll();
    },
    removeRows: (ids) => {
      if (!server || !ids.length) return;
      if (shownLevels.length) {
        const found = ids.flatMap((id) => { const row = remote.findRow(id); return row === undefined ? [] : [row]; });
        if (!found.every((row) => remoteGroups.adjust(groupPath(row), -1))) return refreshAll();
        remoteGroups.refresh();
      }
      void remote.remove(ids);
    },
    revealRow: (id, options) => deps.reveal(id, options?.edit === true),
  };
  useImperativeHandle(props.handleRef, () => ({
    refresh: () => handleImpl.current?.refresh(),
    patchRows: (list) => handleImpl.current?.patchRows(list),
    insertRow: (row, at) => handleImpl.current?.insertRow(row, at),
    removeRows: (ids) => handleImpl.current?.removeRows(ids),
    revealRow: (id, options) => handleImpl.current?.revealRow(id, options) ?? Promise.resolve(false),
  }), []);
  const hasHandle = Boolean(props.handleRef);
  useEffect(() => (server && hasHandle ? whenIdle(preloadGridDataEdit) : undefined), [server, hasHandle]);
}

/** A new query's rows took over (8.9: the previous ones stayed until now): start at the top, as a fresh list would. */
function useScrollTopOnNewQuery<T extends RowData>(model: GridModel<T>, scrollRef: RefObject<HTMLDivElement | null>) {
  const shownQueryKey = useMemo(() => gridQueryKey(model.remote.shownQuery), [model.remote.shownQuery]);
  const lastQueryKey = useRef(shownQueryKey);
  useLayoutEffect(() => {
    if (lastQueryKey.current === shownQueryKey) return;
    lastQueryKey.current = shownQueryKey;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [shownQueryKey, scrollRef]);
}
