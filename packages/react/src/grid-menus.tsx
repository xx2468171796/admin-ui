"use client";
/**
 * Menus of BitableGrid (bt/grid-b, G7 / G8): the header menu (样稿 D03), the cell / range menu (D02)
 * and the group-header menu, as `MenuSection[]` for the root `Menu`. Built-in items act on the view
 * or call the grid's handlers; host items come from `onFieldAction` / `headerMenuItems` /
 * `cellMenuItems`. Data only: grid.tsx opens the menu at the pointer (right click), under the
 * header (click / Enter) or under the cell (Shift + F10 / the menu key).
 */
import type { ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUpNarrowWide,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardPaste,
  Copy,
  CopyPlus,
  EyeOff,
  Filter,
  Info,
  Layers,
  ListPlus,
  Lock,
  Maximize2,
  Move,
  Pencil,
  Snowflake,
  Trash2,
  ArrowDownToLine,
  ArrowUpToLine,
  X,
} from "lucide-react";
import type { MenuItem, MenuSection } from "./menu.tsx";
import type { GridField } from "./grid-core.ts";
import { sortHints } from "./grid-interact-core.ts";

/** Field actions the host performs (header menu; 「修改字段」 also on header double click). */
export type GridFieldActionKind = "edit" | "describe" | "insertLeft" | "insertRight" | "duplicate" | "permission" | "delete";
/** Where a host header item goes: 编辑 · 插入 · 视图 · 排序筛选 · 管理（默认）· 危险. */
export type GridHeaderMenuSlot = "edit" | "insert" | "view" | "sort" | "manage" | "danger";
export type GridHeaderMenuItem = MenuItem & { slot?: GridHeaderMenuSlot };

const icon = (Icon: typeof Copy): ReactNode => <Icon aria-hidden="true" />;

export type HeaderMenuInput<T> = {
  field: GridField<T>;
  primary: boolean;
  /** Position among the visible fields (0 = first) and their count. */
  index: number;
  visibleCount: number;
  sort: "asc" | "desc" | null;
  canSort: boolean;
  canFilter: boolean;
  canGroup: boolean;
  grouped: boolean;
  /** Fields frozen now, and whether freezing is offered. */
  frozen: number;
  canFreeze: boolean;
  /** Host field actions offered for this field (with labels the host can override via headerMenuItems). */
  actions: readonly GridFieldActionKind[];
  extra: readonly GridHeaderMenuItem[];
  on: {
    sort: (direction: "asc" | "desc" | null) => void;
    filter: () => void;
    group: (on: boolean) => void;
    hide: () => void;
    freeze: (count: number) => void;
    move: (to: "left" | "right" | "first" | "last") => void;
    action: (kind: GridFieldActionKind) => void;
  };
};

const ACTION_ITEMS: Record<GridFieldActionKind, { label: string; icon: ReactNode; slot: GridHeaderMenuSlot; hint?: string; danger?: boolean }> = {
  edit: { label: "修改字段", icon: icon(Pencil), slot: "edit", hint: "双击表头" },
  describe: { label: "编辑字段说明", icon: icon(Info), slot: "edit" },
  insertLeft: { label: "向左插入字段", icon: icon(BetweenVerticalStart), slot: "insert" },
  insertRight: { label: "向右插入字段", icon: icon(BetweenVerticalEnd), slot: "insert" },
  duplicate: { label: "复制字段", icon: icon(Copy), slot: "insert" },
  permission: { label: "字段权限", icon: icon(Lock), slot: "manage", hint: "谁能看 / 改" },
  delete: { label: "删除字段", icon: icon(Trash2), slot: "danger", danger: true },
};

/** Header menu (样稿 D03): 修改 / 说明 · 插入 / 复制 · 隐藏 / 冻结 / 移动 · 排序 / 筛选 / 分组 · 权限 / 编组 · 删除. */
export function gridHeaderMenu<T>(input: HeaderMenuInput<T>): MenuSection[] {
  const { field, on } = input;
  const slots: Record<GridHeaderMenuSlot, MenuItem[]> = { edit: [], insert: [], view: [], sort: [], manage: [], danger: [] };
  for (const kind of input.actions) {
    const spec = ACTION_ITEMS[kind];
    if (kind === "delete" && input.primary) {
      slots.danger.push({ key: kind, label: spec.label, icon: spec.icon, danger: true, disabled: true, disabledReason: "主字段不能删除" });
      continue;
    }
    if (kind === "insertLeft" && input.primary) continue;
    slots[spec.slot].push({ key: kind, label: spec.label, icon: spec.icon, hint: spec.hint, danger: spec.danger, onSelect: () => on.action(kind) });
  }
  slots.view.push({ key: "hide", label: "隐藏字段", icon: icon(EyeOff), onSelect: on.hide, disabled: input.primary, disabledReason: input.primary ? "主字段不能隐藏" : undefined });
  if (input.canFreeze) {
    const here = input.index + 1;
    slots.view.push(input.frozen === here
      ? { key: "unfreeze", label: "取消冻结", icon: icon(Snowflake), onSelect: () => on.freeze(0) }
      : { key: "freeze", label: "冻结至此列", icon: icon(Snowflake), onSelect: () => on.freeze(here) });
  }
  slots.view.push({
    key: "move",
    label: "移动字段",
    icon: icon(Move),
    disabled: input.primary,
    disabledReason: input.primary ? "主字段固定在最前" : undefined,
    items: [{
      items: [
        { key: "left", label: "左移一列", icon: icon(ArrowLeft), disabled: input.index <= 1, onSelect: () => on.move("left") },
        { key: "right", label: "右移一列", icon: icon(ArrowRight), disabled: input.index >= input.visibleCount - 1, onSelect: () => on.move("right") },
        { key: "first", label: "移到最前", icon: icon(ArrowLeftToLine), disabled: input.index <= 1, onSelect: () => on.move("first") },
        { key: "last", label: "移到最后", icon: icon(ArrowRightToLine), disabled: input.index >= input.visibleCount - 1, onSelect: () => on.move("last") },
      ],
    }],
  });
  if (input.canSort) {
    const hints = sortHints(field);
    const cantSort = field.sortable === false || (field.type === "custom" && !field.text);
    slots.sort.push(
      { key: "asc", label: "升序", icon: icon(ArrowUpNarrowWide), hint: hints.asc, checked: input.sort === "asc", disabled: cantSort, disabledReason: cantSort ? "这个字段不能排序" : undefined, onSelect: () => on.sort(input.sort === "asc" ? null : "asc") },
      { key: "desc", label: "降序", icon: icon(ArrowDownWideNarrow), hint: hints.desc, checked: input.sort === "desc", disabled: cantSort, disabledReason: cantSort ? "这个字段不能排序" : undefined, onSelect: () => on.sort(input.sort === "desc" ? null : "desc") },
    );
    if (input.sort) slots.sort.push({ key: "unsort", label: "取消排序", icon: icon(X), onSelect: () => on.sort(null) });
  }
  if (input.canFilter) {
    const cantFilter = field.filterable === false;
    slots.sort.push({ key: "filter", label: "按此字段筛选", icon: icon(Filter), disabled: cantFilter, disabledReason: cantFilter ? "这个字段不能筛选" : undefined, onSelect: on.filter });
  }
  if (input.canGroup) {
    const cantGroup = field.groupable === false || (field.type === "custom" && !field.text);
    slots.sort.push({ key: "group", label: input.grouped ? "取消分组" : "按此字段分组", icon: icon(Layers), disabled: cantGroup, disabledReason: cantGroup ? "这个字段不能分组" : undefined, onSelect: () => on.group(!input.grouped) });
  }
  for (const item of input.extra) {
    const { slot = "manage", ...rest } = item;
    slots[slot].push(rest);
  }
  return (["edit", "insert", "view", "sort", "manage", "danger"] as const).filter((slot) => slots[slot].length).map((slot) => ({ key: slot, items: slots[slot] }));
}

/** What a cell / range menu acts on. */
export type GridCellMenuContext<T> = {
  /** The right-clicked record and field (null on the row-number column). */
  row: T;
  rowId: string;
  field: GridField<T> | null;
  /** Records the menu acts on: checked rows / rows of the selected range / the clicked row. */
  rowIds: readonly string[];
  /** Cells in the selected range (1 = a single cell). */
  cells: number;
};

export type CellMenuInput = {
  rowCount: number;
  canPaste: boolean;
  canInsert: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  canExpand: boolean;
  extra: readonly MenuItem[];
  on: {
    copy: () => void;
    paste: () => void;
    insert: (position: "above" | "below") => void;
    duplicate: () => void;
    expand: () => void;
    remove: () => void;
  };
};

/** Cell / range menu (样稿 D02): 复制 / 粘贴 · 插入 / 复制记录 · 展开 + 宿主项 · 删除 N 条. */
export function gridCellMenu(input: CellMenuInput): MenuSection[] {
  const { on, rowCount: n } = input;
  const sections: MenuSection[] = [{
    key: "clipboard",
    items: [
      { key: "copy", label: "复制", icon: icon(Copy), shortcut: "Ctrl+C", onSelect: on.copy },
      ...(input.canPaste ? [{ key: "paste", label: "粘贴", icon: icon(ClipboardPaste), shortcut: "Ctrl+V", onSelect: on.paste }] : []),
    ],
  }];
  const rows: MenuItem[] = [];
  if (input.canInsert)
    rows.push(
      { key: "insertAbove", label: "向上插入记录", icon: icon(ArrowUpToLine), shortcut: "Ctrl+Shift+Enter", onSelect: () => on.insert("above") },
      { key: "insertBelow", label: "向下插入记录", icon: icon(ArrowDownToLine), shortcut: "Shift+Enter", onSelect: () => on.insert("below") },
    );
  if (input.canDuplicate) rows.push({ key: "duplicate", label: n > 1 ? "复制 {count} 条记录" : "复制记录", count: n, icon: icon(CopyPlus), onSelect: on.duplicate });
  if (rows.length) sections.push({ key: "rows", items: rows });
  const record: MenuItem[] = [];
  if (input.canExpand) record.push({ key: "expand", label: "展开记录", icon: icon(Maximize2), shortcut: "Ctrl+E", onSelect: on.expand });
  record.push(...input.extra);
  if (record.length) sections.push({ key: "record", items: record });
  if (input.canDelete) sections.push({ key: "danger", items: [{ key: "delete", label: n > 1 ? "删除所选 {count} 条记录" : "删除记录", count: n, icon: icon(Trash2), danger: true, onSelect: on.remove }] });
  return sections;
}

/** Group header menu: 收起 / 展开 this group, all groups, add a record to the group. */
export function gridGroupMenu(input: { collapsed: boolean; canAdd: boolean; on: { toggle: () => void; collapseAll: () => void; expandAll: () => void; add: () => void } }): MenuSection[] {
  const sections: MenuSection[] = [{
    key: "fold",
    items: [
      { key: "toggle", label: input.collapsed ? "展开本组" : "收起本组", icon: icon(input.collapsed ? ChevronsUpDown : ChevronsDownUp), onSelect: input.on.toggle },
      { key: "collapseAll", label: "全部收起", icon: icon(ChevronsDownUp), onSelect: input.on.collapseAll },
      { key: "expandAll", label: "全部展开", icon: icon(ChevronsUpDown), onSelect: input.on.expandAll },
    ],
  }];
  if (input.canAdd) sections.push({ key: "add", items: [{ key: "add", label: "在本组新增记录", icon: icon(ListPlus), onSelect: input.on.add }] });
  return sections;
}
