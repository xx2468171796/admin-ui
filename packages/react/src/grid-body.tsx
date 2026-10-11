"use client";
/**
 * The virtualized body of BitableGrid: group headers (with per-column group statistics), 「+ 新增一行」 lines,
 * loading placeholders and memoized record rows (grid-row.tsx), each given only its own slice of the state.
 */
import { useMemo, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import type { VirtualItem } from "@tanstack/react-virtual";
import { gridGroupLabel, summarizeField, summaryLabel, type GridField, type GridSummaryKind } from "./grid-core.ts";
import type { GridCellRef, GridRangeBounds } from "./grid-edit-core.ts";
import type { GridGroup } from "./grid-group-core.ts";
import type { GroupLevel } from "./grid-view-v2.ts";
import { GridGroupRow, type GridGroupSummaryCell } from "./grid-group-row.tsx";
import { cellAttrs, GridDataRow, type GridColumnCell, type GridRowContext, type GridRowEdit } from "./grid-row.tsx";
import type { GridItem } from "./grid-props.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export type GridBodyProps<T> = {
  items: readonly VirtualItem[];
  itemAt: (index: number) => GridItem<T>;
  headerHeight: number;
  width: number;
  columns: readonly GridColumnCell<T>[];
  /** Columns frozen at the start (group headers span them). */
  startCount: number;
  cell: GridCellRef;
  ctx: GridRowContext<T>;
  numberAt: (index: number, id: string) => number;
  selected: ReadonlySet<string>;
  isStale: (offset: number) => boolean;
  dragging: string | null;
  /** The anchored range (data-in-range), its outline when it spans more than one cell, the fill preview, where the fill handle sits. */
  range: GridRangeBounds | null;
  rangeBox: GridRangeBounds | null;
  fillBox: GridRangeBounds | null;
  handleBox: GridRangeBounds | null;
  /** The open editor: its row index and cell. */
  edit: ({ row: number } & GridRowEdit) | null;
  saving: ReadonlyMap<string, string>;
  menuKey: string | null;
  collapsed: readonly string[];
  groupBy: readonly GroupLevel[];
  summary: { enabled: boolean; kinds: Readonly<Record<string, GridSummaryKind>>; serverKinds: readonly GridSummaryKind[] | null; tree: unknown };
  onToggleGroup: (key: string) => void;
  onAddRow: (group: Record<string, string>) => void;
};

export function GridBody<T>(props: GridBodyProps<T>) {
  const { items, columns, cell, headerHeight, width } = props;
  const groupCells = useGroupSummaries(props);
  return (
    <>
      {items.map((virtual) => {
        const index = virtual.index;
        const item = props.itemAt(index);
        const top = virtual.start - headerHeight;
        const style = { height: virtual.size, transform: `translateY(${top}px)`, width };
        if (item.kind === "group")
          return (
            <GridGroupRow key={item.id} group={item.group} field={props.ctx.byKey.get(item.group.field)} index={index} style={style} folded={props.collapsed.includes(item.group.key)}
              cellId={`${index}:${cell.col}`} tabbable={cell.row === index} colCount={columns.length} startCount={props.startCount} startWidth={columns.slice(0, props.startCount).reduce((sum, c) => sum + c.width, 0)}
              summaries={groupCells ? groupCells(item.group) : null} onToggle={() => props.onToggleGroup(item.group.key)} />
          );
        if (item.kind === "add") return <AddLine key={item.id} {...props} index={index} style={style} item={item} />;
        if (item.kind === "loading") return <LoadingLine key={item.id} {...props} index={index} style={style} error={item.error} />;
        return <GridDataRow key={item.id} {...rowSlice(props, item, index, top, virtual.size)} />;
      })}
    </>
  );
}

/** A record row's own slice of the grid state (what its memo compares). */
function rowSlice<T>(props: GridBodyProps<T>, item: Extract<GridItem<T>, { kind: "row" }>, index: number, top: number, height: number) {
  const { cell, rangeBox, fillBox, handleBox, edit } = props;
  const box = fillBox ?? rangeBox;
  const crosses = (b: GridRangeBounds | null) => Boolean(b && index >= b.top && index <= b.bottom);
  return {
    ctx: props.ctx, columns: props.columns, row: item.row, id: item.id, index, top, height, width: props.width,
    number: props.numberAt(index, item.id),
    selected: props.selected.has(item.id),
    stale: props.isStale(item.offset),
    dragging: props.dragging === item.id,
    activeCol: cell.row === index ? cell.col : -1,
    inRange: props.range && crosses(props.range) ? { left: props.range.left, right: props.range.right } : null,
    box: box && crosses(box) ? { left: box.left, right: box.right, top: box.top === index, bottom: box.bottom === index, fill: Boolean(fillBox) } : null,
    handleCol: handleBox && handleBox.bottom === index ? handleBox.right : -1,
    edit: edit && edit.row === index ? { col: edit.col, startText: edit.startText, error: edit.error, composing: edit.composing } : null,
    saving: props.saving.get(item.id) ?? "",
    menuKey: props.menuKey,
  };
}

function AddLine<T>(props: GridBodyProps<T> & { index: number; style: CSSProperties; item: Extract<GridItem<T>, { kind: "add" }> }) {
  const { index, item, columns, cell } = props;
  const firstWidth = columns[0]?.width;
  const hint = item.node?.path.map((value, i) => { const field = props.ctx.byKey.get(props.groupBy[i]?.field ?? ""); return field ? gridGroupLabel(field, value) : value; }).join(" · ");
  return (
    <div role="row" aria-rowindex={index + 2} className="aui-grid-row aui-grid-add-row" data-row-index={index} style={props.style}>
      <div role="gridcell" aria-colindex={1} aria-colspan={columns.length} className="aui-grid-add-row-cell" data-cell={`${index}:${cell.col}`}
        tabIndex={cell.row === index ? 0 : -1} onClick={() => props.onAddRow(item.group)}>
        <span className="aui-grid-add-row-inner">
          <span className="aui-grid-add-row-icon" style={{ width: firstWidth }}><Plus aria-hidden="true" /></span>
          <span>新增一行</span>
          {item.node && <span className="aui-grid-add-row-hint">自动带上 {hint}</span>}
        </span>
      </div>
    </div>
  );
}

function LoadingLine<T>(props: GridBodyProps<T> & { index: number; style: CSSProperties; error: string | null }) {
  const { index, error, columns, cell } = props;
  return (
    <div role="row" aria-rowindex={index + 2} className="aui-grid-row aui-grid-loading-row" data-row-index={index} data-error={error ? true : undefined} style={props.style}>
      {columns.map((column) => (
        <div key={column.id} role="gridcell" className="aui-grid-cell" {...cellAttrs(column, index, cell.row === index ? cell.col : -1)}>
          {column.index === 0 ? <span className="aui-grid-rownum">{index + 1}</span>
            : error && column.index === 1 ? <span className="aui-grid-load-error">加载失败，回车重试</span>
            : <span className="aui-grid-skeleton" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

/** Group headers: each column's statistic for the group (the summary chosen in the bottom bar); client statistics cached per tree. */
function useGroupSummaries<T>(props: GridBodyProps<T>) {
  const { columns, startCount, summary, groupBy } = props;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a fresh cache whenever the group tree, the chosen statistics or the fields change.
  const cache = useMemo(() => new Map<string, string>(), [summary.tree, summary.kinds, props.ctx.byKey]);
  const shownFields = summary.enabled && groupBy.length ? columns.filter((column) => {
    const kind = column.field ? summary.kinds[column.field.key] : undefined;
    return kind && kind !== "none" && kind !== "count" && (!summary.serverKinds || summary.serverKinds.includes(kind));
  }) : [];
  if (!shownFields.length) return null;
  const clientText = (group: GridGroup<T>, field: GridField<T>, kind: GridSummaryKind) => {
    const key = `${group.key}\u0000${field.key}\u0000${kind}`;
    let text = cache.get(key);
    if (text === undefined) cache.set(key, (text = summarizeField(field, group.rows ?? [], kind).text));
    return text;
  };
  return (group: GridGroup<T>): GridGroupSummaryCell[] =>
    columns.slice(startCount).map((column, i) => {
      const field = column.field;
      const kind = field ? summary.kinds[field.key] : undefined;
      const shown = field && kind && shownFields.includes(column) ? { field, kind } : null;
      const text = shown ? (summary.serverKinds ? group.summaries?.[shown.field.key] : clientText(group, shown.field, shown.kind)) : undefined;
      return { id: column.id, colIndex: startCount + i + 1, numeric: field ? field.type === "number" || field.type === "money" : undefined, label: shown ? summaryLabel(shown.kind, shown.field.type) : undefined, text, style: column.style, pin: column.pin, edge: column.id === columns.find((c) => c.pin === "end")?.id ? "end" : undefined };
    });
}
