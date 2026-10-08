"use client";
/**
 * DataTable on phones (≤ 760px): one card per row instead of a sideways-scrolling table —
 * checkbox · bold title + status chip · ⋯ on the first line, then a grey line with owner / money / next
 * follow-up. Which column goes where: `Column.mobile` hints, else cardLayout() defaults (data-card-core.ts).
 * Opt out per table with `mobile="table"`. Styles: styles/table-cards.css.
 */
import { Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Maximize2 } from "lucide-react";
import { Checkbox } from "./primitives.tsx";
import { CellBudgetContext, type TableCellBudget } from "./cell-budget.ts";
import { SkeletonCell } from "./loading.tsx";
import { RowActionLimitContext } from "./row-action-limit.ts";
import { groupRows, toggleGroup } from "./table-grouping.ts";
import { cardLayout } from "./data-card-core.ts";
import type { Column, TableCellContext } from "./data.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";

/** One line per meta cell; two-line cells (CellText) keep only their first line. */
const CARD_BUDGET: TableCellBudget = { lines: 1, clamped: true, compact: true };

export type DataTableCardsProps<T> = {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  context: (row: T) => TableCellContext;
  selected: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  isRowSelectable?: (row: T) => boolean;
  /** Skeleton cards instead of rows (first load). */
  loading?: boolean;
  skeletonCount: number;
  /** Open the record dialog (DataTable expandRecord). */
  record?: { open: (key: string) => void; label: (row: T) => string; register: (key: string, node: HTMLButtonElement | null) => void };
  expansion?: {
    expanded: readonly string[];
    onExpandedChange: (keys: string[]) => void;
    render: (row: T) => ReactNode;
    label: (row: T) => string;
    canExpand?: (row: T) => boolean;
  };
  grouping?: {
    by: (row: T) => string;
    header: (key: string, rows: readonly T[]) => ReactNode;
    collapsed?: readonly string[];
    onCollapsedChange?: (keys: string[]) => void;
  };
  idPrefix: string;
};

function cellOf<T>(column: Column<T>, row: T, context: TableCellContext): ReactNode {
  const content = column.render(row, context);
  if (column.truncate) return <span className="aui-cell-clip" data-tip={column.truncate(row)} data-tip-truncated="">{content}</span>;
  return content;
}

function SkeletonCards({ count, meta }: { count: number; meta: number }) {
  return (
    <ul className="aui-table-cards" aria-hidden="true" data-skeleton="">
      {Array.from({ length: count }, (_, r) => (
        <li key={r} className="aui-table-card">
          <span className="aui-table-card-check" />
          <div className="aui-table-card-main">
            <div className="aui-table-card-head"><SkeletonCell kind="text" row={r} column={1} /><SkeletonCell kind="tag" row={r} column={2} /></div>
            <div className="aui-table-card-meta">{Array.from({ length: Math.max(1, meta) }, (_, c) => <SkeletonCell key={c} kind={c === 0 ? "person" : "number"} row={r} column={c + 3} />)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The phone card list of DataTable (internal; DataTable renders it). */
export function DataTableCards<T>(props: DataTableCardsProps<T>) {
  const { rows, columns, rowKey, caption, context, selected, onSelectionChange, isRowSelectable, record, expansion, grouping } = props;
  const layout = cardLayout(columns.map((c) => ({ key: c.key, kind: c.kind, mobile: c.mobile })));
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const pick = (keys: readonly string[]) => keys.flatMap((k) => byKey.get(k) ?? []);
  const primary = layout.primary ? byKey.get(layout.primary) : undefined;
  const status = pick(layout.status);
  const meta = pick(layout.meta);
  const actions = layout.actions ? byKey.get(layout.actions) : undefined;
  if (props.loading) return <SkeletonCards count={props.skeletonCount} meta={meta.length} />;
  const pageKeys = rows.filter((row) => isRowSelectable?.(row) !== false).map(rowKey);
  const checked = pageKeys.filter((k) => selected.includes(k)).length;
  const card = (row: T) => {
    const key = rowKey(row);
    const ctx = context(row);
    const on = selected.includes(key);
    const open = expansion?.expanded.includes(key) ?? false;
    const canExpand = expansion && expansion.canExpand?.(row) !== false;
    const regionId = `${props.idPrefix}-card-${encodeURIComponent(key)}`;
    return (
      <li key={key} className="aui-table-card" data-row-key={key} data-selected={on || undefined}>
        {onSelectionChange && (
          <span className="aui-table-card-check">
            <Checkbox aria-label={`选择 ${key}`} checked={on} disabled={isRowSelectable?.(row) === false}
              onCheckedChange={(v) => onSelectionChange(v ? [...new Set([...selected, key])] : selected.filter((k) => k !== key))} />
          </span>
        )}
        <div className="aui-table-card-main">
          <div className="aui-table-card-head">
            {primary && <span className="aui-table-card-title">{cellOf(primary, row, ctx)}</span>}
            {status.map((c) => <span key={c.key} className="aui-table-card-status">{cellOf(c, row, ctx)}</span>)}
          </div>
          {meta.length > 0 && (
            <div className="aui-table-card-meta">
              {meta.map((c) => (
                <span key={c.key} className="aui-table-card-field" data-numeric={c.numeric || undefined}>
                  <span className="aui-sr-only">{c.title}：</span>
                  {cellOf(c, row, ctx)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="aui-table-card-tools">
          {canExpand && (
            <IconButton label={`${open ? "收起" : "展开"} ${expansion.label(row)}`} aria-expanded={open} aria-controls={regionId} onClick={() => expansion.onExpandedChange(open ? expansion.expanded.filter((k) => k !== key) : [...expansion.expanded, key])} icon={open ? <ChevronDown /> : <ChevronRight />} />
          )}
          {record && (
            <IconButton label={`展开记录 ${record.label(row)}`} className="aui-record-open" ref={(node) => record.register(key, node)} aria-haspopup="dialog" onClick={() => record.open(key)} icon={<Maximize2 />} />
          )}
          {actions && <RowActionLimitContext.Provider value={0}><div className="aui-table-row-actions">{actions.render(row, ctx)}</div></RowActionLimitContext.Provider>}
        </div>
        {canExpand && open && (
          <div id={regionId} className="aui-table-card-expanded" role="region" aria-label={`${expansion.label(row)}的详情`}>
            <CellBudgetContext.Provider value={null}>{expansion.render(row)}</CellBudgetContext.Provider>
          </div>
        )}
      </li>
    );
  };
  const body = grouping
    ? groupRows(rows, grouping.by).map((group) => {
        const folded = grouping.collapsed?.includes(group.key) ?? false;
        const onCollapsedChange = grouping.onCollapsedChange;
        return (
          <Fragment key={`group:${group.key}`}>
            <li className="aui-table-card-group" data-group-key={group.key}>
              {onCollapsedChange && (
                <IconButton label={`${folded ? "展开" : "收起"}分组 ${group.key}`} aria-expanded={!folded} onClick={() => onCollapsedChange(toggleGroup(grouping.collapsed ?? [], group.key))} icon={folded ? <ChevronRight /> : <ChevronDown />} />
              )}
              <CellBudgetContext.Provider value={null}>{grouping.header(group.key, group.rows)}</CellBudgetContext.Provider>
            </li>
            {!folded && group.rows.map(card)}
          </Fragment>
        );
      })
    : rows.map(card);
  return (
    <CellBudgetContext.Provider value={CARD_BUDGET}>
      {onSelectionChange && pageKeys.length > 0 && (
        <div className="aui-table-cards-head">
          <label className="aui-check-row">
            <Checkbox aria-label="选择当前页" checked={checked && checked === pageKeys.length ? true : checked ? "indeterminate" : false}
              onCheckedChange={(v) => onSelectionChange(v ? [...new Set([...selected, ...pageKeys])] : selected.filter((k) => !pageKeys.includes(k)))} />
            <span aria-hidden="true">本页全选</span>
          </label>
        </div>
      )}
      <ul className="aui-table-cards" aria-label={caption}>{body}</ul>
    </CellBudgetContext.Provider>
  );
}
