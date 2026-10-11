"use client";
/**
 * Composition of BitableGrid's hooks: model → columns → rows → geometry → virtualization → cursor, then the
 * interactions (editing, clipboard, selection, record detail, row moves, 新增记录, menus, keyboard). grid.tsx
 * renders what this returns.
 */
import { useMemo, useRef, useState } from "react";
import type { RowData } from "@tanstack/react-table";
import { rangeBounds } from "./grid-edit-core.ts";
import { useFillDrag, useFreezeDrag, useRowDrag } from "./grid-drag.ts";
import type { GridCellMenuState } from "./grid-context-menu.ts";
import { openGridContextMenu } from "./grid-context-menu.ts";
import { gridKeyDownHandler } from "./grid-keyboard-run.ts";
import type { GridHeaderMenuState, GridSummaryPopover } from "./grid-overlays.tsx";
import type { BitableGridProps } from "./grid-props.ts";
import { useGridModel } from "./use-grid-model.ts";
import { useBoxSize, useGridColumns, useGridRows } from "./use-grid-layout.ts";
import { useGridGeometry, useGridVirtual } from "./use-grid-virtual.ts";
import { useCursorState, useGridCursor } from "./use-grid-cursor.ts";
import { useGridEditActions } from "./use-grid-edit-actions.ts";
import { useGridClipboard } from "./use-grid-clipboard.ts";
import { useGridRecordDetail, useGridRowMove, useGridSelection } from "./use-grid-records.ts";
import { useGridAddRow } from "./use-grid-handle.ts";

/** Model, layout, virtualization and the cursor. */
export function useGridCore<T extends RowData>(props: BitableGridProps<T>) {
  const model = useGridModel(props);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(scrollRef);
  const cursorState = useCursorState(1);
  const columns = useGridColumns(model, props, model.filtered, box.width);
  const rows = useGridRows(model, props, columns.table);
  const geometry = useGridGeometry(props, model, rows, { scroll: scrollRef, panel: panelRef });
  const rowCount = rows.count + (geometry.summary ? 1 : 0);
  const virtual = useGridVirtual(props, model, rows, geometry, scrollRef, Math.max(-1, Math.min(cursorState.active.row, rowCount - 1)));
  const { cols, start, end } = columns;
  const fieldAt = (col: number) => { const column = cols[col]; return column ? model.byKey.get(column.id) ?? null : null; };
  const colIndex = (key: string) => cols.findIndex((column) => column.id === key);
  const editOpen = useRef(false);
  const cursor = useGridCursor(cursorState, {
    scrollRef, count: rows.count, rowCount, colCount: cols.length, firstDataCol: columns.firstDataCol, lastDataCol: columns.lastDataCol,
    isFieldCol: (col) => fieldAt(col) !== null, virtualizer: virtual.virtualizer, editOpen,
    frozenWidth: start.reduce((sum, column) => sum + column.getSize(), 0), trailingWidth: end.reduce((sum, column) => sum + column.getSize(), 0),
  });
  return { props, model, refs: { scrollRef, panelRef, bodyRef, headRef }, box, columns, rows, geometry, virtual, cursor, rowCount, fieldAt, colIndex, editOpen };
}
export type GridCore<T extends RowData> = ReturnType<typeof useGridCore<T>>;

/** Editing, clipboard, selection, record detail, row moves, 新增记录 and the drags. */
export function useGridInteractions<T extends RowData>(core: GridCore<T>) {
  const { props, model, rows, cursor, columns, virtual, refs, fieldAt, colIndex } = core;
  const settled = !rows.busy && (!model.server || (model.remote.idle && !model.remote.pending));
  const people = (field: { key: string }) => props.peopleOptions?.[field.key];
  const cursorApi = { cell: cursor.cell, setActive: cursor.setActive, setAnchor: cursor.setAnchor, focusPending: cursor.focusPending };
  const edit = useGridEditActions<T>({ editing: model.editing, fieldAt, colIndex, itemAt: rows.itemAt, indexOfRow: rows.indexOfRow, findRow: model.findRow, count: rows.count, firstDataCol: columns.firstDataCol, lastDataCol: columns.lastDataCol, settled, people, cursor: cursorApi });
  core.editOpen.current = edit.edit !== null && !edit.edit.composing;
  const clip = useGridClipboard<T>({ editing: model.editing, itemAt: rows.itemAt, fieldAt, people, count: rows.count, lastDataCol: columns.lastDataCol, scrollRef: refs.scrollRef, editOpen: edit.edit !== null && !edit.edit.composing, cursor: { ...cursorApi, effectiveRange: cursor.effectiveRange } });
  const selection = useGridSelection(props, model, rows);
  const record = useGridRecordDetail(props, model, rows, {
    interactive: rows.interactive, selectedSet: selection.selectedSet,
    refocus: (row) => {
      cursor.focusPending.current = true;
      cursor.setActive((old) => ({ row, col: old.col }));
    },
  });
  const rowMove = useGridRowMove(props, model, rows, { interactive: rows.interactive, col: cursor.cell.col, moveTo: cursor.moveTo });
  const added = useGridAddRow(props, { model, rows, virtualizer: virtual.virtualizer, lastVisible: virtual.lastVisible, dataCols: columns.dataCols, firstDataCol: columns.firstDataCol, fieldAt, canEditCell: edit.canEditCell, moveTo: cursor.moveTo, startEdit: edit.startEdit, scrollRef: refs.scrollRef });
  const fill = useFillDrag(refs.scrollRef, { rows: rows.count, firstCol: columns.firstDataCol, lastCol: columns.lastDataCol }, clip.applyFill);
  const freeze = useFreezeDrag(refs.headRef, model.visibleKeys.length, (n) => model.dispatch({ type: "freeze", count: n }));
  const rowDrag = useRowDrag(refs.scrollRef, refs.bodyRef, rowMove.commit);
  const [focusWithin, setFocusWithin] = useState(false);
  const range = cursor.range;
  const boxes = {
    range: range ? rangeBounds(range) : null,
    rangeBox: range && !(range.anchor.row === range.focus.row && range.anchor.col === range.focus.col) ? rangeBounds(range) : null,
    fillBox: fill.preview ? rangeBounds(fill.preview.range) : null,
    handleBox: model.editing.enabled && rows.interactive && focusWithin && !edit.edit && cursor.effectiveRange ? rangeBounds(cursor.effectiveRange) : null,
  };
  return { edit, clip, selection, record, rowMove, ...added, fill, freeze, rowDrag, focusWithin, setFocusWithin, boxes };
}
export type GridInteractions<T extends RowData> = ReturnType<typeof useGridInteractions<T>>;

/** Header / cell menus, the summary picker, the context menu and the keyboard handler. */
export function useGridMenus<T extends RowData>(core: GridCore<T>, act: GridInteractions<T>) {
  const { props, model, rows, cursor, columns, refs, fieldAt } = core;
  const [popover, setPopover] = useState<GridSummaryPopover | null>(null);
  const [headerMenu, setHeaderMenu] = useState<GridHeaderMenuState | null>(null);
  const [cellMenu, setCellMenu] = useState<GridCellMenuState | null>(null);
  const colKey = columns.cols.map((column) => column.id).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the ids (`colKey`): the column objects are new each render, the id list rarely changes.
  const colIds = useMemo(() => columns.cols.map((column) => column.id), [colKey]);
  const select = (next: { row: number; col: number }) => {
    cursor.setAnchor(null);
    cursor.setActive(next);
  };
  const openContextMenu = (node: HTMLElement, point: { x: number; y: number }, keyboard: boolean) => openGridContextMenu<T>({
    interactive: rows.interactive, colIds, isField: (key) => model.byKey.has(key), fieldAt, itemAt: rows.itemAt, count: rows.count,
    firstDataCol: columns.firstDataCol, lastDataCol: columns.lastDataCol, cell: cursor.cell, range: cursor.range,
    collapsed: model.view.collapsed, groupBy: model.view.groupBy, groupKeys: rows.groupKeys, canAddRows: rows.addRows, selected: act.selection.selected,
    canPaste: model.editing.enabled, canExpand: Boolean(act.record.recordOptions), primaryText: model.primaryText, scrollRef: refs.scrollRef, hostItems: props.cellMenuItems,
    on: {
      dispatch: model.dispatch, headerMenu: (key, anchor, at) => setHeaderMenu({ key, anchor, point: at }), cellMenu: setCellMenu, select,
      addRow: (group) => void act.addRow.run(group), rangeRowIds: act.clip.menu.rangeRowIds, copy: (r) => void act.clip.menu.copyCells(r), paste: (r) => void act.clip.menu.pasteFromMenu(r),
      insert: props.onRowsInsert, duplicate: props.onRowsDuplicate, remove: props.onRowsDelete, openRecord: act.record.openRecord,
    },
  }, node, point, keyboard);
  const onKeyDown = gridKeyDownHandler<T>(core, act, { openContextMenu, setHeaderMenu, setPopover });
  return { popover, setPopover, headerMenu, setHeaderMenu, cellMenu, setCellMenu, openContextMenu, onKeyDown };
}
