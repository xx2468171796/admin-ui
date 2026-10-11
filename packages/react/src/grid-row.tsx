"use client";
/**
 * One record row of BitableGrid, memoized: it re-renders only when its own slice changes (its record, selection,
 * the active / editing / range cells inside it, saving cells) — scrolling and moving the cursor elsewhere leave
 * it alone. Handlers come through a stable context object, so they never break the memo.
 */
import { memo, Suspense, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { GripVertical, Maximize2 } from "lucide-react";
import { Checkbox } from "./primitives.tsx";
import { RowActions, type RowAction } from "./row-actions.tsx";
import type { ConditionContext } from "./condition-core.ts";
import { fieldText, type GridField, type GridPerson } from "./grid-core.ts";
import { isCellEditable } from "./grid-edit-core.ts";
import type { GridColorRule } from "./grid-view-v2.ts";
import { gridRowFill } from "./grid-color-core.ts";
import { renderGridCell } from "./grid-cells.tsx";
import { gridCellTone } from "./grid-cells-due.tsx";
import { GRID_ACTIONS_COLUMN, GRID_ADD_COLUMN, GRID_ROW_COLUMN } from "./grid-engine.ts";
import type { GridCommitMove, GridEditorCommit } from "./grid-editors.tsx";
import { GridCellEditor } from "./grid-lazy-parts.ts";
import { GridCapture, type GridCaptureHandlers } from "./grid-capture.tsx";
import { demoteInner } from "./grid-props.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

/** A visible column as the rows draw it (memoized by the grid: same widths → same objects). */
export type GridColumnCell<T> = { id: string; index: number; width: number; style: CSSProperties; pin?: "start" | "end"; edge?: "start" | "end"; field: GridField<T> | null };

/** What every row shares: configuration (changes rarely) and stable handlers. */
export type GridRowContext<T> = {
  primary: GridField<T> | undefined;
  byKey: ReadonlyMap<string, GridField<T>>;
  colors: readonly GridColorRule[];
  conditionContext: ConditionContext;
  editingEnabled: boolean;
  selectable: boolean;
  rowMoveEnabled: boolean;
  expandable: boolean;
  openOnTap: "primary" | "row" | false;
  /** Input capture on the active editable cell (not on touch screens: it would pop up the keyboard). */
  capture: boolean;
  people?: Readonly<Record<string, readonly GridPerson[]>>;
  rowActions?: (row: T) => readonly RowAction[];
  cellBadge?: (row: T, field: GridField<T>) => { label: string; tone?: "warning" | "info" | "danger" | "brand" } | null | undefined;
  primaryText: (row: T) => string;
  canSelect: (row: T) => boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  on: GridRowHandlers;
};
export type GridRowHandlers = GridCaptureHandlers & {
  cellPointerDown: (event: ReactPointerEvent<HTMLDivElement>, row: number, col: number) => void;
  toggleCheckbox: (row: number, col: number) => void;
  setRating: (row: number, col: number, star: Element | null) => void;
  openRecord: (id: string) => void;
  doubleClick: (row: number, col: number, id: string) => void;
  finishEdit: (commit: GridEditorCommit | null, move: GridCommitMove) => void;
  draft: (text: string) => void;
  toggleRow: (id: string, on: boolean) => void;
  setShift: (shift: boolean) => void;
  rowDragStart: (id: string) => (event: ReactPointerEvent<HTMLElement>) => void;
  fillStart: (event: ReactPointerEvent<HTMLElement>) => void;
};
/** The open editor of this row (by column). */
export type GridRowEdit = { col: number; startText?: string; error?: string | null; composing?: boolean };
/** The selected range / fill preview where it crosses this row. */
export type GridRowBox = { left: number; right: number; top: boolean; bottom: boolean; fill: boolean };

export type GridRowProps<T> = {
  ctx: GridRowContext<T>;
  columns: readonly GridColumnCell<T>[];
  row: T;
  id: string;
  index: number;
  top: number;
  height: number;
  width: number;
  number: number;
  selected: boolean;
  stale: boolean;
  dragging: boolean;
  /** Column of the active cell when it is in this row, else -1. */
  activeCol: number;
  /** Range columns that are selected in this row (data-in-range), else null. */
  inRange: { left: number; right: number } | null;
  box: GridRowBox | null;
  /** Column of the fill handle when the selection ends in this row, else -1. */
  handleCol: number;
  edit: GridRowEdit | null;
  /** Keys of the fields being saved in this row ("\u0000"-joined). */
  saving: string;
  menuKey: string | null;
};

function GridDataRowInner<T>(props: GridRowProps<T>) {
  const { ctx, row, id, index, columns } = props;
  const rowRef = useRef<HTMLDivElement>(null);
  // Host-rendered controls in cells leave the tab order (the kit's own render with tabIndex -1 already).
  useLayoutEffect(() => {
    if (rowRef.current) demoteInner(rowRef.current);
  });
  const fill = ctx.colors.length ? gridRowFill(row, ctx.colors, ctx.byKey, ctx.conditionContext) : null;
  return (
    <div ref={rowRef} role="row" aria-rowindex={index + 2} aria-selected={ctx.selectable ? props.selected : undefined} className="aui-grid-row" data-row-key={id} data-row-index={index}
      data-stale={props.stale || undefined} data-selected={props.selected || undefined} data-active={props.activeCol >= 0 || undefined} data-editing={props.edit ? true : undefined}
      data-fill={fill?.row} data-fill-row={props.handleCol >= 0 || undefined} data-dragging={props.dragging || undefined}
      style={{ height: props.height, transform: `translateY(${props.top}px)`, width: props.width }}
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, [role=checkbox], .aui-grid-editor")) return;
        const node = target.closest<HTMLElement>("[data-cell]");
        ctx.on.doubleClick(index, node ? Number(node.dataset.cell?.split(":")[1]) : -1, id);
      }}>
      {columns.map((column) =>
        column.id === GRID_ROW_COLUMN ? <RowNumberCell key={column.id} {...props} column={column} />
        : column.id === GRID_ADD_COLUMN ? <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-add-col" {...cellAttrs(column, index, props.activeCol)} />
        : column.id === GRID_ACTIONS_COLUMN ? (
          <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-actions-cell" {...cellAttrs(column, index, props.activeCol)}>
            <RowActions label={`${ctx.primaryText(row)}的更多操作`} actions={ctx.rowActions?.(row) ?? []} />
          </div>
        ) : column.field ? <DataCell key={column.id} {...props} column={column} field={column.field} fillCell={fill?.cells[column.field.key]} /> : null,
      )}
    </div>
  );
}
/** Memoized record row (see the module comment). */
export const GridDataRow = memo(GridDataRowInner) as <T>(props: GridRowProps<T>) => ReactNode;

/** data-cell, roving tabindex, column index, pinning and width of a cell. */
export function cellAttrs<T>(column: GridColumnCell<T>, row: number, activeCol: number, tabbable = true) {
  return {
    "data-cell": `${row}:${column.index}`,
    tabIndex: tabbable && activeCol === column.index ? 0 : -1,
    "aria-colindex": column.index + 1,
    "data-pin": column.pin,
    "data-pin-edge": column.edge,
    style: column.style,
  };
}

function RowNumberCell<T>({ ctx, row, id, index, number, selected, activeCol, column }: GridRowProps<T> & { column: GridColumnCell<T> }) {
  return (
    <div role="gridcell" className="aui-grid-cell aui-grid-rownum-cell" {...cellAttrs(column, index, activeCol)}>
      <span className="aui-grid-rownum">{number}</span>
      <span className="aui-grid-rownum-tools">
        {ctx.rowMoveEnabled && (
          <span className="aui-grid-row-grip" aria-hidden="true" data-tip="拖动调整顺序（Alt + Shift + ↑ / ↓）" onPointerDown={ctx.on.rowDragStart(id)}>
            <GripVertical />
          </span>
        )}
        {ctx.selectable && (
          <Checkbox aria-label={`选择 ${ctx.primaryText(row)}`} tabIndex={-1} checked={selected} disabled={!ctx.canSelect(row)}
            onPointerDown={(event) => ctx.on.setShift(event.shiftKey)}
            onKeyDown={(event) => ctx.on.setShift(event.shiftKey)}
            onCheckedChange={(v) => ctx.on.toggleRow(id, v === true)} />
        )}
        {ctx.expandable && !ctx.primary && (
          <button type="button" tabIndex={-1} className="aui-grid-expand" aria-label={`展开记录 ${ctx.primaryText(row)}`} aria-haspopup="dialog" onClick={() => ctx.on.openRecord(id)}>
            <Maximize2 aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  );
}

type DataCellProps<T> = GridRowProps<T> & { column: GridColumnCell<T>; field: GridField<T>; fillCell: string | undefined };
function DataCell<T>(props: DataCellProps<T>) {
  const { ctx, row, id, index, column, field, activeCol, box } = props;
  const col = column.index;
  const isEditing = props.edit !== null && props.edit.col === col;
  const editable = ctx.editingEnabled && isCellEditable(field, row);
  const badge = ctx.cellBadge?.(row, field);
  const corner = props.handleCol === col;
  const primary = field === ctx.primary;
  const edge = box && col >= box.left && col <= box.right ? [box.top && "t", box.bottom && "b", col === box.left && "l", col === box.right && "r"].filter(Boolean).join(" ") || "in" : undefined;
  // Kept while an editor opens: keys typed before the (lazy) editor takes focus land here and are not lost.
  const capture = ctx.capture && editable && activeCol === col && field.type !== "checkbox";
  const attrs = cellAttrs(column, index, activeCol, !capture);
  return (
    <div role={primary ? "rowheader" : "gridcell"} className="aui-grid-cell" data-type={field.type}
      data-numeric={field.type === "number" || field.type === "money" || undefined} data-primary={primary || undefined}
      data-in-range={props.inRange && col >= props.inRange.left && col <= props.inRange.right ? true : undefined}
      data-edge={edge} data-fill-preview={box?.fill && edge ? true : undefined}
      data-tone={gridCellTone(field, row)} data-col-menu={props.menuKey === field.key || undefined} data-fill-corner={corner || undefined}
      data-editable={editable || undefined} data-editing={isEditing || undefined}
      data-saving={props.saving.split("\u0000").includes(field.key) ? "saving" : undefined} data-fill={props.fillCell}
      aria-readonly={ctx.editingEnabled && !editable ? true : undefined}
      {...attrs}
      onPointerDown={(event) => ctx.on.cellPointerDown(event, index, col)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (field.type === "checkbox" && editable && target.closest(".aui-grid-check")) ctx.on.toggleCheckbox(index, col);
        if (field.type === "rating" && editable && !isEditing) ctx.on.setRating(index, col, target.closest(".aui-rating-star"));
        const tap = ctx.openOnTap;
        if (tap && !isEditing && (tap === "row" || primary) && !target.closest("button, a, input, [role=checkbox]") && window.matchMedia("(pointer: coarse)").matches) ctx.on.openRecord(id);
      }}>
      {isEditing && !props.edit?.composing ? (
        <>
          <div className="aui-cell">{field.type === "singleSelect" || field.type === "multiSelect" || field.type === "user" ? renderGridCell(field, row, { selected: props.selected }) : null}</div>
          <EditorHost cellId={`${index}:${col}`} box={ctx.scrollRef}>
            {(anchor) => (
              <Suspense fallback={null}>
                <GridCellEditor field={field} row={row} startText={props.edit?.startText} anchor={anchor} people={ctx.people?.[field.key]} error={props.edit?.error}
                  onCommit={(value, move) => ctx.on.finishEdit(value, move)} onCancel={() => ctx.on.finishEdit(null, "none")} onDraft={ctx.on.draft} />
              </Suspense>
            )}
          </EditorHost>
        </>
      ) : (
        <div className="aui-cell">{renderGridCell(field, row, { selected: props.selected })}</div>
      )}
      {capture && <GridCapture row={index} col={col} label={`${field.title}：${fieldText(field, row) || "空"}`} composing={Boolean(props.edit?.composing)} on={ctx.on} />}
      {primary && ctx.expandable && !isEditing && (
        <button type="button" tabIndex={-1} className="aui-grid-expand aui-grid-expand-inline" aria-label={`展开记录 ${ctx.primaryText(row)}`} aria-haspopup="dialog" data-tip="展开记录（Ctrl + E）" onClick={() => ctx.on.openRecord(id)}>
          <Maximize2 aria-hidden="true" />
        </button>
      )}
      {badge && <><span className="aui-grid-badge" data-tone={badge.tone ?? "warning"} data-tip={badge.label} aria-hidden="true" /><span className="aui-sr-only">，{badge.label}</span></>}
      {corner && <span className="aui-grid-fill-handle" aria-hidden="true" data-tip="拖动填充（Ctrl + D 向下填充）" onPointerDown={ctx.on.fillStart} />}
    </div>
  );
}

/** Gives the editor its cell element (anchor of option lists) once mounted. */
function EditorHost({ cellId, box, children }: { cellId: string; box: RefObject<HTMLDivElement | null>; children: (anchor: HTMLElement) => ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setAnchor(box.current?.querySelector<HTMLElement>(`[data-cell="${cellId}"]`) ?? null);
  }, [cellId, box]);
  return anchor ? <>{children(anchor)}</> : null;
}
