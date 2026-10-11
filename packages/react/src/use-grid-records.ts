"use client";
/**
 * Record-level features of BitableGrid: checkbox selection (Shift extends from the last checked record), the
 * record detail dialog (shared with DataTable) and moving records (drag the grip / Alt + Shift + ↑ / ↓).
 */
import { useCallback, useMemo, useRef } from "react";
import type { RowData } from "@tanstack/react-table";
import { useRecordExpand } from "./record-expand.tsx";
import { fieldText, gridGroupKey } from "./grid-core.ts";
import { rowMoveOf } from "./grid-interact-core.ts";
import { renderGridCell } from "./grid-cells.tsx";
import type { GridCellRef } from "./grid-edit-core.ts";
import type { BitableGridProps } from "./grid-props.ts";
import type { GridModel, useGridRows } from "./use-grid-layout.ts";

type Rows<T extends RowData> = ReturnType<typeof useGridRows<T>>;

export function useGridSelection<T extends RowData>(props: BitableGridProps<T>, model: GridModel<T>, rows: Rows<T>) {
  const { getRowId } = model;
  const selectable = Boolean(props.onSelectionChange);
  const selected = props.selection ?? [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const anchor = useRef<string | null>(null);
  const shift = useRef(false);
  const isRowSelectable = props.isRowSelectable;
  const canSelect = useCallback((row: T) => isRowSelectable?.(row) !== false, [isRowSelectable]);
  const selectableIds = useMemo(() => rows.ordered.filter(canSelect).map(getRowId), [rows.ordered, getRowId, canSelect]);
  const toggleRow = (id: string, on: boolean) => {
    if (!props.onSelectionChange) return;
    let ids = [id];
    if (shift.current && anchor.current && anchor.current !== id) {
      const a = selectableIds.indexOf(anchor.current);
      const b = selectableIds.indexOf(id);
      if (a >= 0 && b >= 0) ids = selectableIds.slice(Math.min(a, b), Math.max(a, b) + 1);
    }
    anchor.current = id;
    props.onSelectionChange(on ? [...new Set([...selected, ...ids])] : selected.filter((key) => !ids.includes(key)));
  };
  return { selectable, selected, selectedSet, shift, canSelect, selectableIds, toggleRow };
}

/** The record detail dialog: fields in view order, previous / next record, focus back on the record's row after closing. */
export function useGridRecordDetail<T extends RowData>(props: BitableGridProps<T>, model: GridModel<T>, rows: Rows<T>, deps: { interactive: boolean; selectedSet: ReadonlySet<string>; refocus: (row: number) => void }) {
  const { getRowId, byKey, view, primaryText } = model;
  // Memoized: the rows' shared context depends on it (a new {} per render would re-render every row).
  const expandRecord = props.expandRecord;
  const recordOptions = useMemo(() => (expandRecord === false ? undefined : expandRecord === true || expandRecord === undefined ? {} : expandRecord), [expandRecord]);
  const expand = useRecordExpand<T>({
    options: recordOptions ? { title: recordOptions.title ?? primaryText, description: recordOptions.description, render: recordOptions.render, label: primaryText, layout: recordOptions.layout, level: recordOptions.level, url: recordOptions.url, openKey: recordOptions.openKey, onOpenChange: recordOptions.onOpenChange } : undefined,
    rows: rows.ordered,
    rowKey: getRowId,
    enabled: deps.interactive,
    fields: (row) => view.order.flatMap((key) => {
      const field = byKey.get(key);
      if (!field) return [];
      const long = field.type === "longText" || field.type === "multiSelect" || field.type === "user" || Boolean(field.detail);
      const copy = field.primary || field.type === "url" || field.type === "email" || (field.type === "text" && !field.render);
      return [{ key, label: field.title, value: field.detail ? field.detail(row) : renderGridCell(field, row, { selected: deps.selectedSet.has(getRowId(row)) }), text: fieldText(field, row), full: long, copy }];
    }),
    onRefocus: (key) => {
      const at = rows.indexOfRow(key);
      if (at >= 0) deps.refocus(at);
    },
  });
  const openRecord = (id: string) => {
    if (recordOptions) expand.open(id);
  };
  return { recordOptions, expand, openRecord };
}

/** Moving records: within their group (every level's key), client rows without a sort. */
export function useGridRowMove<T extends RowData>(props: BitableGridProps<T>, model: GridModel<T>, rows: Rows<T>, deps: { interactive: boolean; col: number; moveTo: (next: GridCellRef) => void }) {
  const { getRowId, byKey, view, server } = model;
  const enabled = Boolean(props.onRowMove) && !server && view.sort.length === 0 && deps.interactive;
  // Group of a row = its keys on every level (bt/grid-a multi-level); moves stay inside one leaf group.
  const groupValuesOf = (row: T): Record<string, string> | null =>
    view.groupBy.length ? Object.fromEntries(view.groupBy.flatMap((level) => { const field = byKey.get(level.field); return field ? [[level.field, gridGroupKey(field, row)]] : []; })) : null;
  const groupOf = (row: T) => { const values = groupValuesOf(row); return values ? JSON.stringify(values) : null; };
  const commit = (rowId: string, targetId: string, place: "before" | "after") => {
    const target = rows.ordered.find((row) => getRowId(row) === targetId);
    if (!target || !props.onRowMove) return;
    const group = groupOf(target);
    const ids = rows.ordered.filter((row) => groupOf(row) === group).map(getRowId);
    const move = rowMoveOf(ids, rowId, targetId, place);
    const values = groupValuesOf(target);
    if (move) props.onRowMove({ ...move, ...(values ? { group: values } : {}) });
  };
  const moveByKey = (index: number, delta: -1 | 1) => {
    const item = index >= 0 && index < rows.count ? rows.itemAt(index) : null;
    if (!enabled || item?.kind !== "row") return;
    const group = groupOf(item.row);
    const ids = rows.ordered.filter((row) => groupOf(row) === group).map(getRowId);
    const neighbour = ids[ids.indexOf(item.id) + delta];
    if (!neighbour) return;
    const at = rows.indexOfRow(neighbour);
    commit(item.id, neighbour, delta < 0 ? "before" : "after");
    if (at >= 0) deps.moveTo({ row: at, col: deps.col });
  };
  return { enabled, commit, moveByKey };
}
