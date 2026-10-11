"use client";
/**
 * Columns (TanStack column model, frozen widths on narrow screens, live column resizing) and rows (client sort /
 * 自动排序 off / groups, server group nodes) of BitableGrid, laid out as items. Geometry + virtualization:
 * use-grid-virtual.ts.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTable, type Header, type RowData } from "@tanstack/react-table";
import { fitFrozenWidths, normalizeGridView } from "./grid-core.ts";
import { conditionTreeKey } from "./condition-core.ts";
import { flatLayout, groupedRowOrder, groupLayout, groupTreeFromNodes, groupTreeFromRows, keepRowOrder, type GridGroup } from "./grid-group-core.ts";
import { defaultFieldWidth, GRID_ROW_NUMBER_WIDTH, GRID_TABLE_OPTIONS, gridColumnDefs, gridFeatures, gridTableState, type GridFeatures } from "./grid-engine.ts";
import { scrollTailPad } from "./grid-interact-core.ts";
import { createResizeSession, sizingChanges } from "./grid-controls-core.ts";
import { gridLoadState, type useGridModel } from "./use-grid-model.ts";
import { NO_ROWS, type BitableGridProps, type GridItem } from "./grid-props.ts";

export type GridModel<T extends RowData> = ReturnType<typeof useGridModel<T>>;

/** Width and height of the scroll box (frozen widths and paging depend on them). */
export function useBoxSize(scrollRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => setSize((old) => (old.width === node.clientWidth && old.height === node.clientHeight ? old : { width: node.clientWidth, height: node.clientHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRef]);
  return size;
}

/**
 * Column model. Column resizing: widths follow the pointer locally (no view commit per pointermove); the view
 * gets the new widths once, when the drag ends (`beginResize` on the resizer's pointer down).
 */
export function useGridColumns<T extends RowData>(model: GridModel<T>, props: BitableGridProps<T>, rows: readonly T[], boxWidth: number) {
  const { view, viewRef, byKey, fields, commit, visibleKeys } = model;
  const [live, setLive] = useState<Record<string, number> | null>(null);
  const session = useMemo(() => createResizeSession((widths) => {
    setLive(null);
    commit(normalizeGridView({ ...viewRef.current, widths: { ...viewRef.current.widths, ...widths } }, fields));
  }), [commit, fields, viewRef]);
  const widths = live ? { ...view.widths, ...live } : view.widths;
  const hasActions = Boolean(props.rowActions);
  const addField = Boolean(props.onAddField);
  const columns = useMemo(() => gridColumnDefs(fields, null, hasActions, { addField }), [fields, hasActions, addField]);
  // Narrow screens: the frozen block never takes more than 60% of the width.
  const frozenCount = Math.min(visibleKeys.length, view.frozen ?? props.frozenColumns ?? 1); // bt/grid-b: the view's freeze line wins
  const frozenKeys = useMemo(() => visibleKeys.slice(0, Math.max(0, frozenCount)), [visibleKeys, frozenCount]);
  const sizing = useMemo(() => {
    if (!boxWidth || boxWidth >= 760) return undefined;
    const fitted = fitFrozenWidths(frozenKeys.map((key) => { const field = byKey.get(key); return widths[key] ?? (field ? defaultFieldWidth(field) : 0); }), GRID_ROW_NUMBER_WIDTH, boxWidth);
    return Object.fromEntries(frozenKeys.map((key, i) => [key, fitted[i] ?? 0]));
  }, [boxWidth, frozenKeys, widths, byKey]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `widths` is read only while `live`, and is then view.widths + live — both listed.
  const state = useMemo(() => gridTableState(live ? { ...view, widths } : view, { frozenColumns: frozenCount, actions: hasActions, sizing }), [view, live, frozenCount, hasActions, sizing]);
  // Server rows come sorted; a stable state object keeps TanStack's row model (and the layout) stable.
  const tableState = useMemo(() => (model.server ? { ...state, sorting: [], grouping: [], expanded: {} } : state), [model.server, state]);
  const table = useTable({
    ...GRID_TABLE_OPTIONS,
    features: gridFeatures,
    data: rows as T[],
    columns,
    getRowId: (row: T) => props.getRowId(row),
    state: tableState,
    onColumnSizingChange: (updater) => {
      const before = state.columnSizing as Record<string, number>;
      const next = (typeof updater === "function" ? updater(before) : updater) as Record<string, number>;
      const changed = sizingChanges(before, next, (key) => byKey.has(key));
      if (!changed) return;
      session.update(changed);
      setLive(session.live);
    },
  });
  const beginResize = useCallback(() => {
    const end = () => {
      for (const type of ["mouseup", "touchend", "touchcancel"]) document.removeEventListener(type, end);
      session.end();
    };
    for (const type of ["mouseup", "touchend", "touchcancel"]) document.addEventListener(type, end);
  }, [session]);
  return { table, frozenCount, frozenKeys, beginResize, ...columnGeometry(table, byKey, boxWidth) };
}

type GridTable<T extends RowData> = ReturnType<typeof useTable<GridFeatures, T>>;
/** Visible columns in order, their widths, and where the data columns are. */
function columnGeometry<T extends RowData>(table: GridTable<T>, byKey: ReadonlyMap<string, unknown>, boxWidth: number) {
  const start = table.getStartVisibleLeafColumns();
  const center = table.getCenterVisibleLeafColumns();
  const end = table.getEndVisibleLeafColumns();
  const cols = [...start, ...center, ...end];
  const totalWidth = table.getTotalSize();
  const sizeOf = (column: (typeof cols)[number]) => column.getSize();
  const canvasWidth = totalWidth + scrollTailPad(center.map(sizeOf), [...start, ...end].reduce((sum, column) => sum + sizeOf(column), 0), boxWidth);
  const headers = new Map<string, Header<GridFeatures, T, unknown>>(table.getFlatHeaders().map((header) => [header.column.id, header]));
  const dataCols = cols.map((column, i) => (byKey.has(column.id) ? i : -1)).filter((i) => i >= 0);
  return { start, center, end, cols, totalWidth, canvasWidth, headers, dataCols, firstDataCol: dataCols[0] ?? 0, lastDataCol: dataCols.at(-1) ?? 0 };
}

/** Client: TanStack sorts; 自动排序 off keeps rows in place until the sort / filter / search changes. */
function useSortedRows<T extends RowData>(model: GridModel<T>, table: GridTable<T>) {
  const { server, view, getRowId } = model;
  const tableRows = table.getRowModel().rows;
  const frozenOrder = useRef<{ key: string; order: Map<string, number> } | null>(null);
  return useMemo(() => {
    if (server) return NO_ROWS as T[];
    const list = tableRows.map((row) => row.original);
    const key = JSON.stringify([view.sort, conditionTreeKey(view.filter), view.search]);
    if (view.autoSort || frozenOrder.current?.key !== key) {
      frozenOrder.current = { key, order: new Map(list.map((row, i) => [getRowId(row), i])) };
      return list;
    }
    const kept = keepRowOrder(list, frozenOrder.current.order, getRowId);
    frozenOrder.current = { key, order: kept.order };
    return kept.rows;
  }, [server, tableRows, view.autoSort, view.sort, view.filter, view.search, getRowId]);
}

/**
 * Rows laid out as items (group headers, 「+ 新增一行」, records, loading placeholders) — client groups built here
 * (any depth, empty groups, summaries), server groups from loadGroups — plus display order and numbering.
 */
export function useGridRows<T extends RowData>(model: GridModel<T>, props: BitableGridProps<T>, table: GridTable<T>) {
  const { server, view, fields, remote, remoteGroups, shownLevels, editing, getRowId, serverGroups } = model;
  const sortedRows = useSortedRows(model, table);
  // The rows on screen belong to `remote.shownQuery` (the previous query while a new one loads): lay them out with its levels.
  const shownNodes = serverGroups && shownLevels.length ? remoteGroups.nodesFor(remote.state.key) : null;
  const serverTree = useMemo((): GridGroup<T>[] | null => (server && shownLevels.length ? (shownNodes ? groupTreeFromNodes<T>(shownNodes, shownLevels, fields, { showEmpty: view.showEmptyGroups }) : []) : null), [server, shownNodes, shownLevels, view.showEmptyGroups, fields]);
  const clientTree = useMemo((): GridGroup<T>[] | null => (!server && view.groupBy.length ? groupTreeFromRows(sortedRows, view.groupBy, fields, { showEmpty: view.showEmptyGroups }) : null), [server, sortedRows, view.groupBy, view.showEmptyGroups, fields]);
  const groupTree = server ? serverTree : clientTree;
  const clientRows = useMemo(() => (server ? (NO_ROWS as T[]) : clientTree ? groupedRowOrder(clientTree) : sortedRows), [server, clientTree, sortedRows]);
  // bt/grid-b 「+ 新增一行」: after every expanded leaf group (its group values), or at the bottom.
  const addRows = Boolean(props.onAddRow);
  const dataCount = server ? remote.total ?? 0 : clientRows.length;
  const layout = useMemo(
    () => (groupTree ? groupLayout(groupTree, view.collapsed, { addRows: addRows ? shownLevels : undefined }) : flatLayout<T>(dataCount, { addRow: addRows && (!server || remote.total !== null) })),
    [groupTree, view.collapsed, shownLevels, addRows, server, remote.total, dataCount],
  );
  const itemAt = (index: number): GridItem<T> => {
    const at = layout.at(index);
    if (at?.kind === "group") return { kind: "group", id: `__group:${at.group.key}`, key: at.group.key, group: at.group };
    if (at?.kind === "add") return { kind: "add", id: `__add:${at.key}`, group: at.values, node: at.group };
    const offset = at?.offset ?? index;
    if (server) {
      const row = remote.rowAt(offset);
      return row === undefined ? { kind: "loading", id: `__loading:${index}`, error: remote.failedAt(offset) } : { kind: "row", id: getRowId(row), row: editing.present(row), offset };
    }
    const row = clientRows[offset];
    return row === undefined ? { kind: "loading", id: `__loading:${index}`, error: null } : { kind: "row", id: getRowId(row), row, offset };
  };
  // Rows in display order (collapsed groups included): numbering and previous / next record.
  const ordered = useMemo(() => (server ? remote.rows.map(editing.present) : clientRows), [server, remote.rows, clientRows, editing.present]);
  const numberOf = useMemo(() => (server ? null : new Map(ordered.map((row, i) => [getRowId(row), i + 1]))), [server, ordered, getRowId]);
  /** Item index showing a record (-1 when it is not loaded or its group is collapsed). */
  const indexOfRow = (id: string) => {
    const offset = server ? remote.offsetOf(id) : clientRows.findIndex((row) => getRowId(row) === id);
    return offset < 0 ? -1 : layout.indexOfOffset(offset);
  };
  const numberAt = (index: number, id: string) => numberOf?.get(id) ?? (() => { const at = layout.at(index); return at?.kind === "row" ? at.offset + 1 : index + 1; })();
  const load = gridLoadState(props, model, model, shownNodes);
  return { sortedRows, clientTree, groupTree, clientRows, layout, count: layout.count, groupKeys: layout.groupKeys, dataCount, addRows, itemAt, ordered, indexOfRow, numberAt, ...load };
}
