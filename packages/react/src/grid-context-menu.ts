/**
 * Right click / Shift + F10 / the menu key on a BitableGrid cell, group row or header: which menu opens there
 * (bt/grid-b). Returns false when the grid has no menu at that spot (the browser's own shows).
 */
import type { MenuItem, MenuSection } from "./menu.tsx";
import type { GridField, GridViewAction } from "./grid-core.ts";
import { rangeCellCount, rangeContains, type GridCellRef, type GridRange } from "./grid-edit-core.ts";
import type { GridCellMenuContext, gridCellMenu, gridGroupMenu } from "./grid-menus.tsx";
import { groupValues } from "./grid-group-core.ts";
import type { GroupLevel } from "./grid-view-v2.ts";
import { menuRowIds } from "./grid-interact-core.ts";
import { cellOf, type GridItem } from "./grid-props.ts";

/** The menu builders (grid-menus.tsx), handed in by the lazily loaded menu layer (grid-overlays.tsx). */
export type GridMenuBuilders = { gridCellMenu: typeof gridCellMenu; gridGroupMenu: typeof gridGroupMenu };
/** An open cell / group menu: its sections are built when the (lazy) menu layer renders. */
export type GridCellMenuState = { build: (menus: GridMenuBuilders) => readonly MenuSection[]; point: { x: number; y: number }; keyboard: boolean; returnTo: HTMLElement; label: string };

export type ContextMenuDeps<T> = {
  interactive: boolean;
  colIds: readonly string[];
  isField: (key: string) => boolean;
  fieldAt: (col: number) => GridField<T> | null;
  itemAt: (index: number) => GridItem<T>;
  count: number;
  firstDataCol: number;
  lastDataCol: number;
  cell: GridCellRef;
  range: GridRange | null;
  collapsed: readonly string[];
  groupBy: readonly GroupLevel[];
  groupKeys: readonly string[];
  canAddRows: boolean;
  selected: readonly string[];
  canPaste: boolean;
  canExpand: boolean;
  primaryText: (row: T) => string;
  scrollRef: { current: HTMLElement | null };
  hostItems?: (context: GridCellMenuContext<T>) => readonly MenuItem[];
  on: {
    dispatch: (action: GridViewAction) => void;
    headerMenu: (key: string, anchor: HTMLElement, point?: { x: number; y: number }) => void;
    cellMenu: (menu: GridCellMenuState) => void;
    select: (next: GridCellRef) => void;
    addRow: (group: Record<string, string>) => void;
    rangeRowIds: (range: GridRange | null) => string[];
    copy: (range: GridRange) => void;
    paste: (range: GridRange) => void;
    insert?: (position: "above" | "below", rowId: string) => void;
    duplicate?: (ids: string[]) => void;
    remove?: (ids: string[]) => void;
    openRecord: (id: string) => void;
  };
};

export function openGridContextMenu<T>(deps: ContextMenuDeps<T>, node: HTMLElement, point: { x: number; y: number }, keyboard: boolean): boolean {
  const at = deps.interactive ? cellOf(node) : null;
  if (!at) return false;
  if (at.row === -1) {
    const key = deps.colIds[at.col];
    if (!key || !deps.isField(key)) return false;
    deps.on.headerMenu(key, node, keyboard ? undefined : point);
    return true;
  }
  if (at.row >= deps.count) return false;
  const item = deps.itemAt(at.row);
  if (item.kind === "group") {
    deps.on.cellMenu({
      point, keyboard, returnTo: node, label: "分组菜单",
      build: (menus) => menus.gridGroupMenu({
        collapsed: deps.collapsed.includes(item.key),
        canAdd: deps.canAddRows && deps.groupBy.length > 0,
        on: {
          toggle: () => deps.on.dispatch({ type: "toggleGroup", key: item.key }),
          collapseAll: () => deps.on.dispatch({ type: "setCollapsed", keys: [...deps.groupKeys] }),
          expandAll: () => deps.on.dispatch({ type: "setCollapsed", keys: [] }),
          add: () => deps.on.addRow(groupValues(item.group, deps.groupBy)),
        },
      }),
    });
    return true;
  }
  if (item.kind !== "row") return false;
  return openRowMenu(deps, item, { row: at.row, col: Number.isNaN(at.col) ? deps.cell.col : at.col }, node, point, keyboard);
}

function openRowMenu<T>(deps: ContextMenuDeps<T>, item: Extract<GridItem<T>, { kind: "row" }>, here: GridCellRef, node: HTMLElement, point: { x: number; y: number }, keyboard: boolean) {
  const { range, on } = deps;
  const inRange = Boolean(range && rangeContains(range, here));
  const menuRange: GridRange = inRange && range ? range : deps.fieldAt(here.col) ? { anchor: here, focus: here } : { anchor: { row: here.row, col: deps.firstDataCol }, focus: { row: here.row, col: deps.lastDataCol } };
  if (!inRange) on.select(here);
  const returnTo = inRange ? deps.scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${deps.cell.row}:${deps.cell.col}"]`) ?? node : node;
  const ids = menuRowIds(item.id, deps.selected, on.rangeRowIds(menuRange));
  const context: GridCellMenuContext<T> = { row: item.row, rowId: item.id, field: deps.fieldAt(here.col), rowIds: ids, cells: rangeCellCount(menuRange) };
  on.cellMenu({
    point, keyboard, returnTo, label: `${deps.primaryText(item.row)}的菜单`,
    build: (menus) => menus.gridCellMenu({
      rowCount: ids.length,
      canPaste: deps.canPaste,
      canInsert: Boolean(on.insert),
      canDuplicate: Boolean(on.duplicate),
      canDelete: Boolean(on.remove),
      canExpand: deps.canExpand,
      extra: deps.hostItems?.(context) ?? [],
      on: {
        copy: () => on.copy(menuRange),
        paste: () => on.paste(menuRange),
        insert: (position) => on.insert?.(position, item.id),
        duplicate: () => on.duplicate?.(ids),
        expand: () => on.openRecord(item.id),
        remove: () => on.remove?.(ids),
      },
    }),
  });
  return true;
}
