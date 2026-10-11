"use client";
/**
 * Runs the keyboard commands of BitableGrid (grid-keyboard.ts decides them): reads what the focused cell is,
 * asks gridKeyCommand, does it. Also the keys inside a cell's own controls (Tab cycles, Esc returns).
 */
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { RowData } from "@tanstack/react-table";
import { fillDownTarget } from "./grid-fill-core.ts";
import type { GridCellRef } from "./grid-edit-core.ts";
import { GRID_ACTIONS_COLUMN, GRID_ADD_COLUMN, GRID_ROW_COLUMN } from "./grid-engine.ts";
import { gridKeyCommand, type GridKeyCommand, type GridKeyFacts } from "./grid-keyboard.ts";
import { CELL_CONTROLS, cellOf } from "./grid-props.ts";
import type { GridHeaderMenuState, GridSummaryPopover } from "./grid-overlays.tsx";
import type { GridCore, GridInteractions } from "./use-bitable-grid.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

/** What the keyboard needs besides the grid's core and interactions: the menus it opens. */
export type KeyboardMenus = {
  openContextMenu: (node: HTMLElement, point: { x: number; y: number }, keyboard: boolean) => boolean;
  setHeaderMenu: (menu: GridHeaderMenuState) => void;
  setPopover: (popover: GridSummaryPopover) => void;
};

/** Enter on a cell with links / chips / buttons: move into them (Tab cycles inside, Esc returns). */
function enterCell(cellNode: HTMLElement) {
  const controls = [...cellNode.querySelectorAll<HTMLElement>(CELL_CONTROLS)];
  const first = controls[0];
  if (!first) return false;
  cellNode.dataset.inside = "true";
  for (const node of controls) node.tabIndex = 0;
  first.focus();
  const leave = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && cellNode.contains(event.relatedTarget)) return;
    delete cellNode.dataset.inside;
    for (const node of controls) node.tabIndex = -1;
    cellNode.removeEventListener("focusout", leave);
  };
  cellNode.addEventListener("focusout", leave);
  return true;
}

/** Inside a cell (its links / buttons): Tab cycles within the cell, Esc goes back to the cell. */
function keyInsideCell(event: ReactKeyboardEvent<HTMLDivElement>, cellNode: HTMLElement, target: HTMLElement) {
  if (event.key === "Escape") {
    event.preventDefault();
    cellNode.focus();
  } else if (event.key === "Tab" && cellNode.dataset.inside) {
    const controls = [...cellNode.querySelectorAll<HTMLElement>(CELL_CONTROLS)];
    const at = controls.indexOf(target);
    if (controls.length) {
      event.preventDefault();
      controls[(at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    }
  }
}

function factsOf<T extends RowData>(core: GridCore<T>, act: GridInteractions<T>, here: GridCellRef): GridKeyFacts {
  const { props, rows, geometry } = core;
  const id = core.columns.cols[here.col]?.id;
  const field = core.fieldAt(here.col);
  const item = here.row >= 0 && here.row < rows.count ? rows.itemAt(here.row) : null;
  return {
    here, count: rows.count, rowCount: core.rowCount, colCount: core.columns.cols.length,
    page: Math.max(1, Math.floor((core.box.height - geometry.headerHeight - geometry.footerHeight) / geometry.rowHeight) - 1),
    column: field ? "field" : id === GRID_ROW_COLUMN ? "row" : id === GRID_ACTIONS_COLUMN ? "actions" : id === GRID_ADD_COLUMN ? "add" : "other",
    item: item?.kind ?? null,
    itemError: item?.kind === "loading" && Boolean(item.error),
    editingEnabled: core.model.editing.enabled,
    editable: act.edit.canEditCell(here.row, here.col),
    checkbox: field?.type === "checkbox",
    selectable: act.selection.selectable,
    canSelectRow: item?.kind === "row" && act.selection.canSelect(item.row),
    canExpand: Boolean(act.record.recordOptions),
    canInsertRows: Boolean(props.onRowsInsert),
    hasAnchor: Boolean(core.cursor.anchor),
    footerAdd: rows.addRows && geometry.summary && props.addRowButton !== false,
    summary: geometry.summary,
  };
}

export function gridKeyDownHandler<T extends RowData>(core: GridCore<T>, act: GridInteractions<T>, menus: KeyboardMenus) {
  return (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".aui-grid-editor")) return;
    const cellNode = target.closest<HTMLElement>("[data-cell]");
    if (!cellNode || !core.refs.scrollRef.current?.contains(cellNode)) return;
    // The input capture is the cell itself (it holds focus so an IME can compose).
    if (target !== cellNode && target.dataset.gridCapture === undefined) return keyInsideCell(event, cellNode, target);
    const at = cellOf(cellNode);
    if (!at) return;
    const here = { row: at.row, col: Number.isNaN(at.col) ? core.cursor.cell.col : at.col };
    const command = gridKeyCommand({ key: event.key, shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, keyCode: event.keyCode, isComposing: event.nativeEvent.isComposing }, factsOf(core, act, here));
    if (!command) return;
    if (command.kind === "contextMenu") {
      const box = cellNode.getBoundingClientRect();
      if (menus.openContextMenu(cellNode, { x: box.left + 4, y: box.bottom }, true)) event.preventDefault();
      return;
    }
    event.preventDefault();
    runCommand(command, { core, act, menus }, here, cellNode);
  };
}

type Run<T extends RowData> = { core: GridCore<T>; act: GridInteractions<T>; menus: KeyboardMenus };
function runCommand<T extends RowData>(command: GridKeyCommand, { core, act, menus }: Run<T>, here: GridCellRef, cellNode: HTMLElement) {
  const { props, model, rows, cursor } = core;
  const item = here.row >= 0 && here.row < rows.count ? rows.itemAt(here.row) : null;
  const rowId = item?.kind === "row" ? item.id : null;
  const key = core.columns.cols[here.col]?.id ?? "";
  switch (command.kind) {
    case "resizeColumn": return model.dispatch({ type: "resize", key, width: (core.columns.cols[here.col]?.getSize() ?? 0) + command.delta });
    case "moveRow": return act.rowMove.moveByKey(here.row, command.delta);
    case "move": return cursor.moveTo(command.to, command.extend);
    case "insertRow": return rowId ? props.onRowsInsert?.(command.position, rowId) : undefined;
    case "openRecord": return rowId ? act.record.openRecord(rowId) : undefined;
    case "fillDown": {
      const plan = cursor.effectiveRange && fillDownTarget(cursor.effectiveRange);
      if (plan && model.editing.enabled) act.clip.applyFill(plan.source, plan.target);
      return;
    }
    case "addField": return props.onAddField?.();
    case "addRow": return item?.kind === "add" ? void act.addRow.run(item.group) : undefined;
    case "footerAdd": return void act.addRow.run({});
    case "undo": return model.editing.undo();
    case "redo": return model.editing.redo();
    case "selectAll":
      cursor.setAnchor({ row: 0, col: core.columns.firstDataCol });
      cursor.setActive({ row: rows.count - 1, col: core.columns.lastDataCol });
      cursor.focusPending.current = true;
      return;
    case "clearAnchor": return cursor.setAnchor(null);
    case "clear": return act.clip.clearRange();
    case "type": return act.edit.startEdit(here.row, here.col, command.text);
    case "toggleRow": return rowId ? toggleRow(act, rowId, command.shift) : undefined;
    case "headerMenu": return menus.setHeaderMenu({ key, anchor: cellNode });
    case "toggleAll": return toggleAll(core, act);
    case "summaryPicker": return menus.setPopover({ key, anchor: cellNode });
    case "toggleGroup": return item?.kind === "group" ? model.dispatch({ type: "toggleGroup", key: item.group.key }) : undefined;
    case "retry": return model.remote.retry();
    case "clickAction": return cellNode.querySelector<HTMLButtonElement>("button")?.click();
    case "toggleCheckbox": return act.edit.toggleCheckbox(here.row, here.col);
    case "edit": return act.edit.startEdit(here.row, here.col);
    case "enterCell":
      if (!enterCell(cellNode) && rowId) act.record.openRecord(rowId);
      return;
    default:
      return;
  }
}

function toggleRow<T extends RowData>(act: GridInteractions<T>, id: string, shift: boolean) {
  act.selection.shift.current = shift;
  act.selection.toggleRow(id, !act.selection.selectedSet.has(id));
}
/** Space on the header's row-number cell: check every selectable record, or uncheck them all. */
function toggleAll<T extends RowData>(core: GridCore<T>, act: GridInteractions<T>) {
  const { selectableIds: all, selectedSet, selected } = act.selection;
  const checked = all.filter((id) => selectedSet.has(id)).length;
  core.props.onSelectionChange?.(checked === all.length ? selected.filter((id) => !all.includes(id)) : [...new Set([...selected, ...all])]);
}
