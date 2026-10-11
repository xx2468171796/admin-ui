"use client";
/**
 * Bottom summary bar of BitableGrid: per-field statistic chosen by the user (client: computed here; server: from
 * the data source), the record count and the footer 「+」 (8.7).
 */
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { summarizeField, summaryLabel, type GridField, type GridSummaryKind } from "./grid-core.ts";
import { GRID_ACTIONS_COLUMN, GRID_ADD_COLUMN, GRID_ROW_COLUMN } from "./grid-engine.ts";
import { cellAttrs, type GridColumnCell } from "./grid-row.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

type Result = { label: string; text: string };
export type GridSummaryProps<T> = {
  columns: readonly GridColumnCell<T>[];
  height: number;
  width: number;
  ariaRowIndex: number;
  /** Row index of the summary row (= item count). */
  rowIndex: number;
  activeCol: number;
  server: boolean;
  summary: Readonly<Record<string, GridSummaryKind>>;
  visibleKeys: readonly string[];
  byKey: ReadonlyMap<string, GridField<T>>;
  /** Client rows after search / filter. */
  filtered: readonly T[];
  /** Server: total and the source's summaries. */
  total: number | null;
  serverSummaries?: Readonly<Record<string, string>>;
  addRow: { show: boolean; adding: boolean; run: () => void };
  onPick: (key: string, anchor: HTMLElement) => void;
};

/** The statistic shown under a column (server: only what the source answered). */
export function useSummaryResults<T>(props: Pick<GridSummaryProps<T>, "server" | "summary" | "visibleKeys" | "byKey" | "filtered" | "total" | "serverSummaries">, enabled: boolean) {
  const { server, summary, visibleKeys, byKey, filtered } = props;
  const client = useMemo(() => {
    if (!enabled || server) return new Map<string, Result>();
    return new Map(visibleKeys.flatMap((key) => {
      const kind = summary[key];
      const field = byKey.get(key);
      return kind && kind !== "none" && field ? [[key, summarizeField(field, filtered, kind)] as const] : [];
    }));
  }, [enabled, server, visibleKeys, summary, filtered, byKey]);
  return (key: string): Result | undefined => {
    if (!server) return client.get(key);
    const kind = summary[key];
    const field = byKey.get(key);
    if (!kind || kind === "none" || !field) return undefined;
    if (kind === "count") return { label: summaryLabel(kind, field.type), text: String(props.total ?? "—") };
    const text = props.serverSummaries?.[key];
    return text === undefined ? undefined : { label: summaryLabel(kind, field.type), text };
  };
}

export function GridSummaryRow<T>(props: GridSummaryProps<T>) {
  const { columns, rowIndex, activeCol } = props;
  const resultOf = useSummaryResults(props, true);
  const totalText = props.server ? `${props.total ?? 0} 条` : `${props.filtered.length} 条`;
  const firstFieldId = columns.find((column) => column.field)?.id;
  const countInField = firstFieldId !== undefined && !resultOf(firstFieldId);
  // 8.7: the footer 「+」 (飞书左下角「+」) takes the row-number cell; the count sits right of it in the first field's cell.
  const addButton = props.addRow.show ? (
    <button type="button" className="aui-grid-footer-add" data-inside aria-label="新增记录" data-tip={countInField ? "新增记录" : `新增记录（共 ${totalText}）`}
      aria-disabled={props.addRow.adding || undefined} onClick={(event) => { event.stopPropagation(); if (!props.addRow.adding) props.addRow.run(); }}>
      <Plus aria-hidden="true" />
    </button>
  ) : null;
  return (
    <div role="row" aria-rowindex={props.ariaRowIndex} className="aui-grid-row aui-grid-summary-row" style={{ height: props.height, width: props.width }}>
      {columns.map((column) => {
        if (column.id === GRID_ROW_COLUMN)
          // The 48px row-number column is too narrow for 「2000 条」: the count goes into the first field's cell when that
          // field has no statistic of its own (「24 条记录」), else it stays here.
          return <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-summary-cell aui-grid-rownum-cell" data-add={addButton ? true : undefined} {...cellAttrs(column, rowIndex, activeCol)}>{addButton}{countInField || addButton ? <span className="aui-sr-only">{totalText}</span> : <span className="aui-grid-summary-total">{totalText}</span>}</div>;
        const field = column.field;
        if (column.id === GRID_ACTIONS_COLUMN || column.id === GRID_ADD_COLUMN || !field) return <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-summary-cell" {...cellAttrs(column, rowIndex, activeCol)} />;
        const result = resultOf(field.key);
        return (
          <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-summary-cell" data-field-key={field.key} data-numeric={field.type === "number" || field.type === "money" || undefined}
            data-empty={!result || undefined} data-tip={result ? `${result.label} ${result.text}` : undefined} aria-haspopup="dialog" aria-label={result ? `${field.title}${result.label}：${result.text}` : `${field.title}：未统计，回车选择统计方式`}
            {...cellAttrs(column, rowIndex, activeCol)}
            onClick={(event) => props.onPick(field.key, event.currentTarget)}>
            {result ? <><span className="aui-grid-summary-label">{result.label}</span><span className="aui-grid-summary-value">{result.text}</span></> : countInField && column.id === firstFieldId ? <span className="aui-grid-summary-total" aria-hidden="true">{totalText.replace(/ 条$/, " 条记录")}</span> : <span className="aui-grid-summary-label">统计</span>}
          </div>
        );
      })}
    </div>
  );
}
