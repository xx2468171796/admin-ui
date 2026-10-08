"use client";
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, ChevronDown, Maximize2 } from "lucide-react";
import { Checkbox } from "./primitives.tsx";
import { useAdminTheme } from "./theme.tsx";
import { CellBudgetContext, type TableCellBudget } from "./cell-budget.ts";
import { resolveRowLayout, TWO_LINE_MIN_HEIGHT, type TableRowHeight } from "./table-rows.ts";
import type { Sort } from "./contracts.ts";
import { StatePanel } from "./layout.tsx";
import { SkeletonCell, SlowLoadingNote, TopProgress, useSlowLoading, type SkeletonCellKind } from "./loading.tsx";
import { useRecordExpand, type ExpandRecordOptions } from "./record-expand.tsx";
import { normalizePreferences, type TablePreferences } from "./workflow-core.ts";
import { groupRows, toggleGroup } from "./table-grouping.ts";
import { useIsMobile } from "./media-query.ts";
import { BulkActionBar, type BulkAction } from "./bulk-action-bar.tsx";
import { DataTableCards } from "./data-cards.tsx";
import { TableFooter } from "./table-footer.tsx";
import type { ColumnMobileRole } from "./data-card-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
export type { ColumnMobileRole } from "./data-card-core.ts";
export { BulkActionBar, type BulkAction, type BulkActionBarProps } from "./bulk-action-bar.tsx";
export { useDataSource, useCursorDataSource, type ReloadOptions } from "./data-sources.ts";
export type TableCellContext = {
  selected: boolean;
};
export type Column<T> = {
  key: string;
  title: string;
  render: (row: T, context: TableCellContext) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  width?: number;
  minWidth?: number;
  /** Cap the column width; long content inside is clipped with an ellipsis (use `truncate` or CellText for it). */
  maxWidth?: number;
  /**
   * Let the text wrap inside the row (3.0): it is clamped to the row's line budget with an ellipsis
   * (1 line by default, 2 at rowHeight="medium" ...) and never grows the row; a string render or
   * `truncate` gives the full text on hover, and expandRecord shows it in full. Only
   * rowHeight="auto" lets it grow the row (the 2.x behaviour).
   */
  wrap?: boolean;
  /**
   * Single-line cell: clip with an ellipsis and show the full text on hover. Returns the full text, so an
   * ellipsis never hides content without a way to read it. Width cap = `maxWidth` (default 320).
   */
  truncate?: (row: T) => string;
  /** Numeric presentation only; value calculation/formatting remains with the host. */
  numeric?: boolean;
  /** "actions": the row-action column (RowActionBar) — pinned right when the table scrolls sideways, ⋯ on phone cards. */
  kind?: "data" | "actions";
  /**
   * Place on the phone card (≤ 760px): "primary" = bold title, "status" = chip after the title, "meta" = the grey
   * line, "hidden" = only in the record view. Default: title = first column, chip = the column keyed
   * status / stage / state, grey line = the next 3 columns (data-card-core.ts cardLayout).
   */
  mobile?: ColumnMobileRole;
  /** Shape of this column's skeleton on first load (text line, tag pill, avatar + name, short number, action). */
  skeleton?: SkeletonCellKind;
  /**
   * Full, unclamped rendering for the expand-record view (long text, every tag, a mini table).
   * Defaults to the `truncate` text, then `render`.
   */
  detail?: (row: T) => ReactNode;
};
export type { ExpandRecordContext, ExpandRecordOptions } from "./record-expand.tsx";
export type PagePagination = {
  mode: "page";
  total: number;
  page: number;
  pageSize: number;
  pageSizes?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};
export type CursorPagination = {
  mode: "cursor";
  pageIndex: number;
  pageSize: number;
  pageSizes?: readonly number[];
  onPageSizeChange: (size: number) => void;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Cursor listings have no server-side total; passing one must not compile. */
  total?: never;
  page?: never;
  onPageChange?: never;
};
/**
 * Short tables that are loaded in full (a dozen maps, a to-do list, config rows): no pager, only
 * the exact count. Use page/cursor for anything the server pages.
 */
export type AllRowsPagination = {
  mode: "all";
  total?: never;
  page?: never;
  pageSize?: never;
  pageSizes?: never;
  onPageChange?: never;
  onPageSizeChange?: never;
};
export type DataTablePagination = PagePagination | CursorPagination | AllRowsPagination;
type DataTableBase<T> = {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  sort?: Sort;
  onSortChange?: (sort: Sort) => void;
  /**
   * First load / a new query: the table keeps its own header and shows skeleton rows in place, counts read
   * 「—」 (never 「共 0 条」); after 10 s 「加载比较慢… · 重试」 (with onRetry).
   */
  loading?: boolean;
  /** Background refresh (useDataSource `refreshing`): the rows stay, slightly dimmed, a 2px bar runs along the top. */
  refreshing?: boolean;
  error?: string;
  /** Error details behind 「错误详情」 (request id, status) — copyable for the admin; shown with 「重试」 when onRetry. */
  errorDetails?: string;
  onRetry?: () => void;
  selected?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  emptyLabel?: string;
  /** Distinguish an unpopulated resource from a query with no matches. */
  emptyKind?: "empty" | "no-results";
  emptyAction?: ReactNode;
  preferences?: TablePreferences;
  sorts?: readonly Sort[];
  onSortsChange?: (sorts: readonly Sort[]) => void;
  /**
   * Row height: three presets for admin lists — compact 40px (`short`, or density compact),
   * loose 48px (density comfortable, the default) and two-line 56px (`medium`; the second line of CellText —
   * number, department — only shows here). tall 88px (3 lines) / extraTall 120px (5 lines) remain for long
   * text. Every row has the same height; wrap columns and Cell* components clamp to the line budget. "auto" lets
   * content grow the row (row height is a minimum) - only for short lists. Precedence: preferences.rowHeight
   * (the user's choice) > rowHeight > table density > AdminProvider density.
   */
  rowHeight?: TableRowHeight;
  /** Expand-record dialog with all fields; see ExpandRecordOptions. */
  expandRecord?: ExpandRecordOptions<T>;
  zebra?: boolean;
  /** A bounded scroll region also enables a sticky header. */
  maxHeight?: number;
  toolbar?: ReactNode;
  /**
   * Bulk actions for the selected rows: the shared bottom floating bar (BulkActionBar) appears while rows are
   * selected — 「已选 N 条」 + buttons + ✕ (clears the selection). It never pushes the table down.
   */
  bulkActions?: readonly BulkAction[];
  /** Small note in the bulk bar (「本页 24 条」). */
  bulkNote?: ReactNode;
  /** Phones (≤ 760px): "cards" (default) = one card per row, no sideways scroll; "table" keeps the scrolling table. */
  mobile?: "cards" | "table";
  isRowSelectable?: (row: T) => boolean;
  expandable?: {
    expanded: readonly string[];
    onExpandedChange: (keys: string[]) => void;
    render: (row: T) => ReactNode;
    label: (row: T) => string;
    canExpand?: (row: T) => boolean;
  };
  /**
   * Row groups: a full-width, collapsible header row per group (`<tbody>` per group, header `th scope=rowgroup`).
   * Groups appear in the order of `rows` (arrange them with groupRows/flattenGroups before paging); a column sort
   * only reorders rows inside each group. `header` gets this page's rows of the group — pass whole-group
   * counts/aggregates from the host. Don't hand-build a "group" column instead.
   */
  grouping?: {
    by: (row: T) => string;
    header: (key: string, rows: readonly T[]) => ReactNode;
    /** Collapsed group keys (controlled); leave both out for groups that can't collapse. */
    collapsed?: readonly string[];
    onCollapsedChange?: (keys: string[]) => void;
  };
};
export type DataTableProps<T> = DataTableBase<T> & { pagination: DataTablePagination };
export function DataTable<T>(props: DataTableProps<T>) {
  const {
    rows,
    columns: originalColumns,
    rowKey,
    caption,
    sort,
    onSortChange,
    loading,
    error,
    onRetry,
    selected = [],
    onSelectionChange,
    emptyLabel,
  } = props;
  const preferences = props.preferences ? normalizePreferences(props.preferences, originalColumns.map(c => c.key)) : undefined;
  const visibleColumns = preferences ? preferences.columns.flatMap(key => { const column = originalColumns.find(c => c.key === key); return column && !preferences.hidden.includes(key) ? [column] : []; }) : originalColumns;
  const pinned = visibleColumns.find(c => c.key === preferences?.pinned);
  const columns = pinned ? [pinned, ...visibleColumns.filter(c => c !== pinned)] : visibleColumns;
  const tableId = useId();
  const expansion = props.expandable;
  const record = props.expandRecord;
  const { density: providerDensity } = useAdminTheme();
  const layout = resolveRowLayout({ preference: preferences?.rowHeight, rowHeight: props.rowHeight, tableDensity: preferences?.density, providerDensity });
  const budget: TableCellBudget = { lines: layout.lines, clamped: layout.clamped, compact: layout.height !== undefined && layout.height < TWO_LINE_MIN_HEIGHT };
  const utilityCount = Number(Boolean(expansion)) + Number(Boolean(onSelectionChange)) + Number(Boolean(record));
  const expandHeader = useRef<HTMLTableCellElement>(null);
  const selectHeader = useRef<HTMLTableCellElement>(null);
  const recordHeader = useRef<HTMLTableCellElement>(null);
  const [utilityWidths, setUtilityWidths] = useState({ expand: 44, select: 44, record: 44 });
  const hasExpansion = Boolean(expansion);
  const hasSelection = Boolean(onSelectionChange);
  const hasRecord = Boolean(record);
  const hasPinned = Boolean(pinned);
  useEffect(() => {
    if (!hasPinned) return;
    const measure = () => {
      const expand = expandHeader.current?.getBoundingClientRect().width ?? 0;
      const select = selectHeader.current?.getBoundingClientRect().width ?? 0;
      const record = recordHeader.current?.getBoundingClientRect().width ?? 0;
      setUtilityWidths(previous => previous.expand === expand && previous.select === select && previous.record === record ? previous : { expand, select, record });
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    for (const node of [expandHeader.current, selectHeader.current, recordHeader.current]) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [hasPinned, hasExpansion, hasSelection, hasRecord]);
  // 最后一列是操作列时，宽表放不下就把它固定在右边：不用滚到最右才能点「编辑 / 删除」
  const pinEndKey = columns.at(-1)?.kind === "actions" ? columns.at(-1)?.key : undefined;
  const scrollBox = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const node = scrollBox.current;
    if (!pinEndKey || !node) return;
    const measure = () => {
      const next = node.scrollWidth > node.clientWidth + 1;
      setOverflowing(previous => previous === next ? previous : next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [pinEndKey]);
  const selectOffset = expansion ? utilityWidths.expand : 0;
  const recordOffset = selectOffset + (onSelectionChange ? utilityWidths.select : 0);
  const keyOffset = recordOffset + (record ? utilityWidths.record : 0);
  const columnStyle = (c: Column<T>): CSSProperties => ({
    width: c.width ?? (c === pinned ? 180 : undefined),
    minWidth: c.minWidth ?? c.width ?? (c === pinned ? 180 : undefined),
    maxWidth: c.maxWidth ?? (c.truncate ? 320 : undefined),
    textAlign: c.align ?? (c.numeric ? "right" : undefined),
    ...(c === pinned ? { left: keyOffset } : {}),
  });
  const multiSorts = props.sorts ?? [];
  const pagination = props.pagination;
  const pageSize = pagination.mode === "all" ? Math.max(rows.length, 1) : pagination.pageSize;
  const pageKeys = rows.filter(row => props.isRowSelectable?.(row) !== false).map(rowKey);
  const checked = pageKeys.filter((k) => selected.includes(k)).length;
  const interactive = !loading && !error;
  const slow = useSlowLoading(Boolean(loading));
  const grouping = props.grouping;
  // Phones: one card per row instead of a sideways-scrolling table.
  const phone = useIsMobile();
  const cards = phone && props.mobile !== "table";
  const skeletonCount = pagination.mode === "all" ? 6 : Math.min(pageSize, 8);
  // 展开记录：弹框里一条记录的全部字段，上一条 / 下一条按本页显示顺序（与 BitableGrid 共用 record-expand）
  const recordButtons = useRef(new Map<string, HTMLButtonElement>());
  const ordered = grouping ? groupRows(rows, grouping.by).flatMap(group => group.rows) : rows;
  const recordColumns = record?.fields
    ? record.fields.flatMap(key => originalColumns.filter(column => column.key === key))
    : originalColumns.filter(column => column.kind !== "actions");
  const expand = useRecordExpand<T>({
    options: record,
    rows: ordered,
    rowKey,
    enabled: interactive,
    fields: row => recordColumns.map(column => ({
      key: column.key,
      label: column.title,
      value: column.detail ? column.detail(row) : column.truncate ? column.truncate(row) : column.render(row, { selected: selected.includes(rowKey(row)) }),
      full: Boolean(column.detail),
    })),
    onRefocus: key => recordButtons.current.get(key)?.focus({ preventScroll: true }),
  });
  const recordLabel = expand.labelOf;
  const cell = (c: Column<T>, row: T) => {
    const content = c.render(row, { selected: selected.includes(rowKey(row)) });
    if (c.kind === "actions") return <div className="aui-table-row-actions">{content}</div>;
    if (c.truncate) return <div className="aui-cell"><span className="aui-cell-clip" data-tip={c.truncate(row)} data-tip-truncated="">{content}</span></div>;
    const clampText = Boolean(c.wrap && layout.clamped);
    const title = clampText && (typeof content === "string" || typeof content === "number") ? String(content) : undefined;
    return <div className="aui-cell" data-clamp={clampText || undefined} data-tip={title} data-tip-truncated="">{content}</div>;
  };
  const renderRow = (row: T, index: number) => (
                <Fragment key={rowKey(row)}>
                <tr
                  data-row-key={rowKey(row)}
                  data-stripe={index % 2 === 1 || undefined}
                  data-selected={selected.includes(rowKey(row)) || undefined}
                >
                  {expansion && <td className="aui-table-utility" data-pinned={Boolean(pinned) || undefined} style={{ left: 0 }}>
                    {expansion.canExpand?.(row) !== false && <IconButton label={`${expansion.expanded.includes(rowKey(row)) ? "收起" : "展开"} ${expansion.label(row)}`} aria-expanded={expansion.expanded.includes(rowKey(row))} aria-controls={`${tableId}-${encodeURIComponent(rowKey(row))}`} onClick={() => expansion.onExpandedChange(expansion.expanded.includes(rowKey(row)) ? expansion.expanded.filter(key => key !== rowKey(row)) : [...expansion.expanded, rowKey(row)])} icon={expansion.expanded.includes(rowKey(row)) ? <ChevronDown /> : <ChevronRight />} />}
                  </td>}
                  {onSelectionChange && (
                    <td className="aui-table-utility" data-pinned={Boolean(pinned) || undefined} style={{ left: selectOffset }}>
                      <Checkbox
                        aria-label={`选择 ${rowKey(row)}`}
                        checked={selected.includes(rowKey(row))}
                        disabled={props.isRowSelectable?.(row) === false}
                        onCheckedChange={(v) =>
                          onSelectionChange(
                            v
                              ? [...new Set([...selected, rowKey(row)])]
                              : selected.filter((k) => k !== rowKey(row)),
                          )
                        }
                      />
                    </td>
                  )}
                  {record && <td className="aui-table-utility" data-pinned={Boolean(pinned) || undefined} style={{ left: recordOffset }}>
                    <IconButton label={`展开记录 ${recordLabel(row)}`} className="aui-record-open" ref={node => { if (node) recordButtons.current.set(rowKey(row), node); else recordButtons.current.delete(rowKey(row)); }} aria-haspopup="dialog" onClick={() => expand.open(rowKey(row))} icon={<Maximize2 />} />
                  </td>}
                  {columns.map((c) => (
                    <td key={c.key} data-truncate={c.truncate ? true : undefined} data-pinned={preferences?.pinned === c.key || undefined} data-pin-end={c.key === pinEndKey || undefined} data-wrap={c.wrap || undefined} data-numeric={c.numeric || undefined} style={columnStyle(c)}>
                      {cell(c, row)}
                    </td>
                  ))}
                </tr>
                {expansion && expansion.canExpand?.(row) !== false && <tr className="aui-table-expanded" hidden={!expansion.expanded.includes(rowKey(row))}>
                  <td colSpan={columns.length + utilityCount}>
                    <div id={`${tableId}-${encodeURIComponent(rowKey(row))}`} role="region" aria-label={`${expansion.label(row)}的详情`}>
                      <CellBudgetContext.Provider value={null}>
                        {expansion.expanded.includes(rowKey(row)) && expansion.render(row)}
                      </CellBudgetContext.Provider>
                    </div>
                  </td>
                </tr>}
                </Fragment>
  );
  return (
    <div className="aui-table-panel" aria-busy={Boolean(loading || props.refreshing)} data-refreshing={(props.refreshing && !loading) || undefined} data-density={preferences?.density} data-row-height={layout.preset} style={layout.clamped ? { "--aui-row-lines": layout.lines } as CSSProperties : undefined} data-zebra={props.zebra || undefined}>
      <TopProgress active={Boolean(props.refreshing && !loading)} />
      {props.toolbar && <div className="aui-table-toolbar">{props.toolbar}</div>}
      {props.onSortsChange && !cards && <p className="aui-note">点击表头按优先级添加排序；再次点击降序，第三次清除。</p>}
      {cards ? (
        <DataTableCards
          rows={interactive ? rows : []}
          columns={columns}
          rowKey={rowKey}
          caption={caption}
          context={(row) => ({ selected: selected.includes(rowKey(row)) })}
          selected={selected}
          onSelectionChange={interactive ? onSelectionChange : undefined}
          isRowSelectable={props.isRowSelectable}
          loading={Boolean(loading && !error)}
          skeletonCount={skeletonCount}
          record={record ? { open: expand.open, label: recordLabel, register: (key, node) => { if (node) recordButtons.current.set(key, node); else recordButtons.current.delete(key); } } : undefined}
          expansion={expansion}
          grouping={grouping}
          idPrefix={tableId}
        />
      ) : (
      <div ref={scrollBox} className="aui-table-scroll" tabIndex={0} role="region" aria-label={`${caption}，宽表可横向滚动`} data-sticky-header={props.maxHeight !== undefined || undefined} data-overflow={overflowing || undefined} style={{ maxHeight: props.maxHeight }}>
        <table className="aui-table">
          <caption className="aui-sr-only">{caption}</caption>
          <thead>
            <tr>
              {expansion && <th ref={expandHeader} scope="col" className="aui-table-utility" data-pinned={Boolean(pinned) || undefined} style={{ left: 0 }}><span className="aui-sr-only">展开详情</span></th>}
              {onSelectionChange && (
                <th ref={selectHeader} scope="col" className="aui-table-utility" data-pinned={Boolean(pinned) || undefined} style={{ left: selectOffset }}>
                  <Checkbox
                    aria-label="选择当前页"
                    disabled={!interactive || !pageKeys.length}
                    checked={
                      checked && checked === pageKeys.length
                        ? true
                        : checked
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(v) =>
                      onSelectionChange(
                        v
                          ? [...new Set([...selected, ...pageKeys])]
                          : selected.filter((k) => !pageKeys.includes(k)),
                      )
                    }
                  />
                </th>
              )}
              {record && <th ref={recordHeader} scope="col" className="aui-table-utility" data-pinned={Boolean(pinned) || undefined} style={{ left: recordOffset }}><span className="aui-sr-only">展开记录</span></th>}
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  data-pinned={preferences?.pinned === c.key || undefined}
                  data-pin-end={c.key === pinEndKey || undefined}
                  data-wrap={c.wrap || undefined}
                  data-numeric={c.numeric || undefined}
                  style={columnStyle(c)}
                  aria-sort={
                    props.onSortsChange ? (multiSorts[0]?.key === c.key ? (multiSorts[0].direction === "asc" ? "ascending" : "descending") : undefined) : sort?.key === c.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {c.sortable && (onSortChange || props.onSortsChange) ? (
                    <button
                      className="aui-sort"
                      disabled={!interactive}
                      onClick={() => {
                        if (props.onSortsChange) {
                          const current = multiSorts.find(s => s.key === c.key);
                          props.onSortsChange(!current ? [...multiSorts, { key: c.key, direction: "asc" }] : current.direction === "asc" ? multiSorts.map(s => s.key === c.key ? { ...s, direction: "desc" } : s) : multiSorts.filter(s => s.key !== c.key));
                          return;
                        }
                        onSortChange?.({
                          key: c.key,
                          direction:
                            sort?.key === c.key && sort.direction === "asc"
                              ? "desc"
                              : "asc",
                        });
                      }}
                    >
                      {c.title}
                      {props.onSortsChange ? (
                        multiSorts.some(s => s.key === c.key) ? <>
                          <span className="aui-sort-priority" aria-label={`排序优先级 ${multiSorts.findIndex(s => s.key === c.key) + 1}`}>{multiSorts.findIndex(s => s.key === c.key) + 1}</span>
                          {multiSorts.find(s => s.key === c.key)?.direction === "asc" ? <ArrowUp size={14} aria-label="升序" /> : <ArrowDown size={14} aria-label="降序" />}
                        </> : <ArrowUpDown className="aui-sort-idle" size={14} aria-hidden="true" />
                      ) : sort?.key === c.key ? (
                        sort.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : <ArrowUpDown className="aui-sort-idle" size={14} aria-hidden="true" />}
                    </button>
                  ) : (
                    c.title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <CellBudgetContext.Provider value={budget}>
          {interactive && grouping ? (
            groupRows(rows, grouping.by).map((group) => {
              const folded = grouping.collapsed?.includes(group.key) ?? false;
              return (
                <tbody key={`group:${group.key}`} data-group-key={group.key}>
                  <tr className="aui-table-group">
                    <th scope="rowgroup" colSpan={columns.length + utilityCount}>
                      <div className="aui-table-group-head">
                        {grouping.onCollapsedChange && (
                          <IconButton label={`${folded ? "展开" : "收起"}分组 ${group.key}`} aria-expanded={!folded} onClick={() => grouping.onCollapsedChange!(toggleGroup(grouping.collapsed ?? [], group.key))} icon={folded ? <ChevronRight /> : <ChevronDown />} />
                        )}
                        <CellBudgetContext.Provider value={null}>{grouping.header(group.key, group.rows)}</CellBudgetContext.Provider>
                      </div>
                    </th>
                  </tr>
                  {!folded && group.rows.map(renderRow)}
                </tbody>
              );
            })
          ) : (
          <tbody className={loading && !error ? "aui-table-skeleton" : undefined}>
            {interactive && rows.map(renderRow)}
            {loading && !error && Array.from({ length: skeletonCount }, (_, r) => (
              <tr key={`skeleton-${r}`} aria-hidden="true">
                {Array.from({ length: utilityCount }, (_, u) => <td key={`u${u}`} className="aui-table-utility" />)}
                {columns.map((c, ci) => (
                  <td key={c.key} data-align={c.align ?? (c.numeric ? "right" : undefined)}>
                    {c.kind === "actions" ? <SkeletonCell kind="action" /> : <SkeletonCell kind={c.skeleton ?? (c.numeric ? "number" : "text")} row={r} column={ci} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          )}
          </CellBudgetContext.Provider>
        </table>
      </div>
      )}
      {loading ? (
        <>
          <span className="aui-sr-only" role="status">正在加载{caption}…</span>
          {slow && <SlowLoadingNote onRetry={onRetry} />}
        </>
      ) : error ? (
        <StatePanel kind="error" message={error} onRetry={onRetry} details={props.errorDetails} />
      ) : !rows.length ? (
        <StatePanel kind={props.emptyKind ?? "empty"} message={emptyLabel} action={props.emptyAction} />
      ) : null}
      {props.bulkActions && onSelectionChange ? (
        <BulkActionBar count={interactive ? selected.length : 0} note={props.bulkNote} actions={props.bulkActions} onClear={() => onSelectionChange([])} />
      ) : null}
      <TableFooter pagination={pagination} rowCount={rows.length} loading={loading} interactive={interactive} selected={onSelectionChange ? selected.length : 0} />
      {expand.element}
    </div>
  );
}
export { QueryBar } from "./query-bar.tsx";
