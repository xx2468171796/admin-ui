"use client";
/**
 * Header row of BitableGrid: field headers (sort marks, badges, menu, drag to reorder, resizer, freeze grip),
 * the row-number column's 「选择全部记录」 and the trailing 「+」 add-field column.
 */
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Info, Lock, Plus } from "lucide-react";
import { Checkbox } from "./primitives.tsx";
import { defaultFieldWidth, GRID_ACTIONS_COLUMN, GRID_ADD_COLUMN, GRID_ROW_COLUMN } from "./grid-engine.ts";
import { FIELD_ICONS } from "./grid-cells.tsx";
import type { GridField, GridView, GridViewAction } from "./grid-core.ts";
import type { GridFieldActionKind } from "./grid-menus.tsx";
import type { selectAllControl } from "./grid-controls-core.ts";
import type { useFreezeDrag } from "./grid-drag.ts";
import { cellAttrs, type GridColumnCell } from "./grid-row.tsx";
import { demoteInner } from "./grid-props.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

type ResizeHandler = (event: unknown) => void;
export type GridHeaderProps<T> = {
  columns: readonly GridColumnCell<T>[];
  headRef: RefObject<HTMLDivElement | null>;
  height: number;
  width: number;
  /** Active column when the cursor is on the header row, else -1. */
  activeCol: number;
  view: GridView;
  primaryKey: string | undefined;
  frozenCount: number;
  lastFrozenKey: string | undefined;
  /** Freeze line drag (useFreezeDrag). */
  freeze: ReturnType<typeof useFreezeDrag>;
  freezeHeight: number;
  /** null = no selection column. */
  selectAll: ReturnType<typeof selectAllControl> | null;
  onSelectAll: (ids: string[]) => void;
  menuKey: string | null;
  resizeHandler: (key: string) => ResizeHandler | undefined;
  isResizing: (key: string) => boolean;
  fieldActions: (field: GridField<T>) => readonly GridFieldActionKind[];
  on: {
    dispatch: (action: GridViewAction) => void;
    openMenu: (key: string, anchor: HTMLElement) => void;
    closeMenu: () => void;
    fieldAction?: (action: GridFieldActionKind, field: GridField<T>) => void;
    addField?: () => void;
    beginResize: () => void;
  };
};

export function GridHeaderRow<T>(props: GridHeaderProps<T>) {
  const { columns, headRef, activeCol } = props;
  const drag = useHeaderDrag(props);
  // Host-rendered controls in headers leave the tab order (one tab stop per grid).
  useLayoutEffect(() => {
    if (headRef.current) demoteInner(headRef.current);
  });
  const grip = <FreezeGrip frozen={props.frozenCount} freeze={props.freeze} />;
  return (
    <div role="row" aria-rowindex={1} className="aui-grid-row aui-grid-header-row" ref={headRef} style={{ height: props.height, width: props.width }}>
      {columns.map((column) => {
        if (column.id === GRID_ROW_COLUMN)
          return (
            <div key={column.id} role="columnheader" className="aui-grid-hcell aui-grid-rownum-cell" data-lead-col {...cellAttrs(column, -1, activeCol)}>
              {props.frozenCount === 0 && grip}
              {props.selectAll ? <SelectAll control={props.selectAll} onChange={props.onSelectAll} /> : <span className="aui-sr-only">序号</span>}
            </div>
          );
        if (column.id === GRID_ACTIONS_COLUMN)
          return <div key={column.id} role="columnheader" className="aui-grid-hcell" {...cellAttrs(column, -1, activeCol)}><span className="aui-sr-only">操作</span></div>;
        if (column.id === GRID_ADD_COLUMN)
          return (
            <div key={column.id} role="columnheader" className="aui-grid-hcell aui-grid-add-col" {...cellAttrs(column, -1, activeCol)}>
              <button type="button" tabIndex={-1} className="aui-grid-add-field" aria-label="添加字段" data-tip="添加字段" onClick={(event) => { event.stopPropagation(); props.on.addField?.(); }}><Plus aria-hidden="true" /></button>
            </div>
          );
        return column.field ? <FieldHeader key={column.id} {...props} column={column} field={column.field} drag={drag} grip={props.frozenCount > 0 && column.field.key === props.lastFrozenKey ? grip : null} /> : null;
      })}
      {drag.drop && <span className="aui-grid-drop" aria-hidden="true" style={{ left: drag.drop.x }} />}
      {props.freeze.preview && <span className="aui-grid-freeze-preview" aria-hidden="true" style={{ left: props.freeze.preview.x, height: props.freezeHeight }} />}
    </div>
  );
}

/** 「选择全部记录」: stays focusable while the grid loads (aria-disabled, activation ignored) — focus never drops to the page. */
function SelectAll({ control, onChange }: { control: ReturnType<typeof selectAllControl>; onChange: (ids: string[]) => void }) {
  return (
    <Checkbox aria-label="选择全部记录" tabIndex={-1} aria-disabled={control.inert || undefined} checked={control.checked}
      onCheckedChange={(v) => { const next = control.toggle(v === true); if (next) onChange(next); }} />
  );
}

function FreezeGrip({ frozen, freeze }: { frozen: number; freeze: GridHeaderProps<unknown>["freeze"] }) {
  return (
    <span className="aui-grid-freeze-grip" role="separator" aria-orientation="vertical" data-dragging={freeze.preview ? true : undefined}
      aria-label={`冻结线：已冻结 ${frozen} 列。拖动调整，或在字段菜单里选「冻结至此列」`} data-tip="拖动冻结线：向右多冻结几列，拖到最左解除冻结"
      onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} {...freeze.handlers}>
      <GripVertical aria-hidden="true" />
    </span>
  );
}

type HeaderDrag = ReturnType<typeof useHeaderDrag>;
/** Drag a header to reorder fields (not the primary field; mouse / pen only). */
function useHeaderDrag<T>(props: GridHeaderProps<T>) {
  const drag = useRef<{ key: string; x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [drop, setDrop] = useState<{ before: string | null; x: number } | null>(null);
  const dropTarget = (clientX: number) => {
    const rowNode = props.headRef.current;
    if (!rowNode) return null;
    const base = rowNode.getBoundingClientRect().left;
    const cells = [...rowNode.querySelectorAll<HTMLElement>("[data-field-key]")].filter((node) => node.dataset.fieldKey !== props.primaryKey);
    for (const node of cells) {
      const rect = node.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return { before: node.dataset.fieldKey ?? null, x: rect.left - base };
    }
    const last = cells.at(-1)?.getBoundingClientRect();
    return { before: null, x: (last?.right ?? base) - base };
  };
  return {
    drop,
    draggingKey: () => drag.current?.key,
    down: (event: ReactPointerEvent<HTMLDivElement>, key: string) => {
      if (event.button !== 0 || event.pointerType === "touch" || key === props.primaryKey || (event.target as HTMLElement).closest(".aui-grid-resizer")) return;
      drag.current = { key, x: event.clientX, moved: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    move: (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = drag.current;
      if (!current || (!current.moved && Math.abs(event.clientX - current.x) < 6)) return;
      current.moved = true;
      const target = dropTarget(event.clientX);
      if (target) setDrop((old) => (old && old.before === target.before && Math.abs(old.x - target.x) < 1 ? old : target));
    },
    up: (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = drag.current;
      drag.current = null;
      if (!current?.moved) return;
      suppressClick.current = true;
      const target = dropTarget(event.clientX);
      setDrop(null);
      if (target && target.before !== current.key) props.on.dispatch({ type: "moveBefore", key: current.key, before: target.before });
    },
    cancel: () => {
      drag.current = null;
      setDrop(null);
    },
    /** A click that ended a drag does not open the menu. */
    click: (key: string, anchor: HTMLElement) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      props.on.openMenu(key, anchor);
    },
  };
}

/** A field's header. Resizing: widths follow the pointer locally; the view is committed once when the drag ends (beginResize). */
function FieldHeader<T>(props:GridHeaderProps<T> & { column: GridColumnCell<T>; field: GridField<T>; drag: HeaderDrag; grip: ReactNode }) {
  const { field, column, view, drag, on } = props;
  const Icon = FIELD_ICONS[field.type];
  const sortIndex = view.sort.findIndex((s) => s.key === field.key);
  const sort = view.sort[sortIndex];
  const resize = props.resizeHandler(column.id);
  const sortText = sort ? `，${sort.direction === "asc" ? "升序" : "降序"}${view.sort.length > 1 ? `第 ${sortIndex + 1} 优先` : ""}` : "";
  return (
    <div role="columnheader" className="aui-grid-hcell" data-field-key={field.key} data-numeric={field.type === "number" || field.type === "money" || undefined}
      aria-sort={sortIndex === 0 && sort ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
      aria-haspopup="menu" aria-label={`${field.title}${field.locked ? "，有权限限制" : ""}${sortText}，回车打开字段菜单`}
      aria-description={field.description || undefined}
      data-dragging={drag.drop && drag.draggingKey() === field.key ? true : undefined}
      data-menu-open={props.menuKey === field.key || undefined}
      {...cellAttrs(column, -1, props.activeCol)}
      onClick={(event) => drag.click(field.key, event.currentTarget)}
      onDoubleClick={() => {
        if (!on.fieldAction || !props.fieldActions(field).includes("edit")) return;
        on.closeMenu();
        on.fieldAction("edit", field);
      }}
      onPointerDown={(event) => drag.down(event, field.key)}
      onPointerMove={drag.move}
      onPointerUp={drag.up}
      onPointerCancel={drag.cancel}>
      <Icon className="aui-grid-hicon" aria-hidden="true" />
      <span className="aui-grid-htitle">{field.title}</span>
      {field.locked && <span className="aui-grid-hbadge" data-kind="lock" data-tip={typeof field.locked === "string" ? field.locked : "有权限限制"} aria-hidden="true"><Lock /></span>}
      {field.description && <span className="aui-grid-hbadge" data-kind="info" data-tip={field.description} aria-hidden="true"><Info /></span>}
      {sort && <span className="aui-grid-hsort" aria-hidden="true">{view.sort.length > 1 && <span>{sortIndex + 1}</span>}{sort.direction === "asc" ? <ArrowUp /> : <ArrowDown />}</span>}
      <ChevronDown className="aui-grid-hmenu" aria-hidden="true" />
      {resize && (
        <span className="aui-grid-resizer" role="separator" aria-orientation="vertical" aria-label={`调整「${field.title}」列宽（表头上按 Alt + ← / →）`}
          aria-valuenow={Math.round(column.width)} aria-valuemin={60} aria-valuemax={800}
          data-resizing={props.isResizing(column.id) || undefined}
          onMouseDown={(event) => { event.stopPropagation(); resize(event); on.beginResize(); }}
          onTouchStart={(event) => { event.stopPropagation(); resize(event); on.beginResize(); }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => { event.stopPropagation(); on.dispatch({ type: "resize", key: field.key, width: defaultFieldWidth(field) }); }} />
      )}
      {props.grip}
    </div>
  );
}
