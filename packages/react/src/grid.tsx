"use client";
/**
 * 多维表格 BitableGrid —— optional subpath `@adminui/react/grid` (peer deps @tanstack/react-table v9
 * and @tanstack/react-virtual v3; apps that never import it do not bundle either).
 *
 * Feishu Bitable / Airtable style: fixed row heights (矮 32 / 中 56 / 高 88 / 超高 120), frozen primary
 * column, drag to resize / reorder columns, hide fields, row-number column with checkbox + expand on
 * hover, the record-detail dialog (shared with DataTable), collapsible groups with counts, a summary
 * bar, search / filter / sort, roving-focus keyboard navigation and row virtualization; in-place
 * editing with optimistic saves, cell ranges, copy / cut / paste (Excel compatible), undo / redo;
 * client rows or a server data source with infinite scrolling; fills the window height by default.
 * DOM rendering with ARIA grid semantics; styles are scoped `.adminui .aui-grid-*` and follow --aui-*.
 *
 * Module map (all in this package, see INTEGRATION.md「多维表格」):
 *   grid-core.ts       pure model: fields, view, filters, sort / group keys, summaries, geometry
 *   grid-edit-core.ts  pure editing: parse, ranges, TSV, paste / clear plans, undo stack, key maps
 *   grid-data-core.ts  pure server contract: GridQuery, block cache, parseGridQuery / applyGridQuery
 *   grid-sql.ts        GridQuery → SQL (pg / mysql / sqlite) for backends
 *   grid-engine.ts     TanStack Table wiring (column model, client row pipeline)
 *   grid-editing.ts    hook: optimistic overlay + undo / redo + status line
 *   grid-data.ts       hook: server block loading
 *   grid-view.ts       hook: persisted view
 *   grid-cells.tsx / grid-editors.tsx / grid-toolbar.tsx / grid-popover.tsx   UI pieces
 */
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTable, type Header, type RowData } from "@tanstack/react-table";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, Info, Lock, Maximize2, Plus, Redo2, RefreshCw, Undo2, X } from "lucide-react";
import { Button, Checkbox } from "./primitives.tsx";
import { useMediaQuery } from "./media-query.ts";
import { StatePanel } from "./layout.tsx";
import { RowActions, type RowAction } from "./row-actions.tsx";
import { FONT_SIZE_PRESETS, useAdminTheme } from "./theme.tsx";
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import type { AdminDefaults } from "./admin-defaults.ts";
import { currencySymbol } from "./number-input-core.ts";
import { CellBudgetContext, type TableCellBudget } from "./cell-budget.ts";
import { useRecordExpand, type ExpandRecordContext } from "./record-expand.tsx";
import type { RecordDetailLevel, RecordLayout } from "./record-detail-core.ts";
import type { TableRowHeightPreset } from "./table-rows.ts";
import {
  activeFilterCount,
  fieldText,
  filterGridRows,
  fitFrozenWidths,
  gridGroupKey,
  gridGroupLabel,
  gridRowHeight,
  gridRowLines,
  gridViewReducer,
  moveGridCell,
  normalizeGridView,
  primaryField,
  readField,
  summarizeField,
  summaryKindsFor,
  summaryLabel,
  toPeople,
  type GridField,
  type GridPerson,
  type GridSummaryKind,
  type GridView,
  type GridViewAction,
  type GridViewInput,
  type GridViewLimits,
  valueText,
} from "./grid-core.ts";
import type { EditConflictNoticeProps } from "./edit-conflict.tsx";
import { lazyPart, whenIdle } from "./lazy-part.ts";
import {
  clampRange,
  gridKeyAction,
  isCellEditable,
  makeChange,
  parseTsv,
  planClear,
  planPaste,
  rangeCellCount,
  rangeContains,
  rangeText,
  toHtmlTable,
  toTsv,
  validateFieldInput,
  type GridCellRef,
  type GridRange,
  type PlanContext,
} from "./grid-edit-core.ts";
import { gridQueryOf, type GridDataSource } from "./grid-data-core.ts";
import {
  defaultFieldWidth,
  GRID_ACTIONS_COLUMN,
  GRID_ROW_COLUMN,
  GRID_ROW_NUMBER_WIDTH,
  GRID_TABLE_OPTIONS,
  gridColumnDefs,
  gridFeatures,
  gridTableState,
  type GridFeatures,
} from "./grid-engine.ts";
import { FIELD_ICONS, renderGridCell } from "./grid-cells.tsx";
import { gridCellTone } from "./grid-cells-due.tsx";
import type { GridCommitMove, GridEditorCommit, GridEditorProps } from "./grid-editors.tsx";
import { GridPopover } from "./grid-popover.tsx";
import { GridToolbar, type GridToolbarFeatures } from "./grid-toolbar.tsx";
import { useGridEditing, type GridCellsChangeHandler, type GridStatusConflict } from "./grid-editing.ts";
import { useGridServerData } from "./grid-data.ts";
// bt/grid-a: multi-level grouping (client + server), condition context, 填色, view panels
import { conditionTreeKey, type ConditionContext, type DynamicToken } from "./condition-core.ts";
import { flatLayout, groupedRowOrder, groupLayout, groupTreeFromNodes, groupTreeFromRows, groupValues, keepRowOrder, type GridGroup } from "./grid-group-core.ts";
import { useGridServerGroups } from "./grid-data-groups.ts";
import { GridGroupRow, type GridGroupSummaryCell } from "./grid-group-row.tsx";
import { gridRowFill } from "./grid-color-core.ts";
import { GRID_LIMITS, isGroupedBy } from "./grid-view-v2.ts";
// bt/grid-b: menus, freeze line, fill handle, row affordances, extra field types
import { Menu, type MenuItem, type MenuSection } from "./menu.tsx";
import { BulkActionBar, type BulkAction } from "./bulk-action-bar.tsx";
import { GRID_ADD_COLUMN } from "./grid-engine.ts";
import { gridCellMenu, gridGroupMenu, gridHeaderMenu, type GridCellMenuContext, type GridFieldActionKind, type GridHeaderMenuItem } from "./grid-menus.tsx";
import { fillDownTarget, filledRange, planFill, type GridFillTarget } from "./grid-fill-core.ts";
import { menuRowIds, rowMoveOf, scrollTailPad, type GridRowMove } from "./grid-interact-core.ts";
import { readClipboard, useFillDrag, useFreezeDrag, useRowDrag, writeClipboard } from "./grid-drag.ts";
import { rangeBounds, type GridCellChange } from "./grid-edit-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

// Not on the first paint: the cell editors (text / select / date picker / rating …) load once the grid can edit
// (on idle after mount, or on the first edit), the conflict notice when a save conflicts.
const cellEditor = lazyPart(() => import("./grid-editors.tsx").then((m) => m.GridCellEditor));
const GridCellEditor = cellEditor.Part as <T>(props: GridEditorProps<T>) => ReactNode;
const conflictNotice = lazyPart(() => import("./edit-conflict.tsx").then((m) => m.EditConflictNotice));
const EditConflictNotice = conflictNotice.Part as (props: EditConflictNoticeProps) => ReactNode;

// The pure cores (field model, query, SQL, edit parsing) are the backend entry `./grid-query`; this
// entry re-exports their types plus the view / editing helpers a front end needs next to BitableGrid.
export type * from "./grid-core.ts";
export type * from "./grid-edit-core.ts";
export type * from "./grid-data-core.ts";
export type * from "./grid-sql.ts";
export { normalizeGridView, gridViewReducer, serializeGridView, parseGridView, filterGridRows, summarizeField } from "./grid-core.ts";
export { planPaste, planClear, parseTsv, toTsv } from "./grid-edit-core.ts";
export { gridQueryOf } from "./grid-data-core.ts";
// bt/grid-a
export type * from "./condition-core.ts";
export type * from "./grid-group-core.ts";
export type * from "./grid-view-v2.ts";
export type * from "./view-diff-core.ts";
export { gridFilterTree, addGridFilter, addGridFilterGroup, patchGridFilter } from "./grid-core.ts";
export { GRID_LIMITS, isGroupedBy, VIEW_PANEL_WIDTHS, type ViewPanelWidth } from "./grid-view-v2.ts";
export { groupTreeFromRows, groupTreeFromNodes, groupLayout, flatLayout, groupedRowOrder, allGroupKeys, gridGroupPathKey, orderLabels } from "./grid-group-core.ts";
export { gridRowFill, rowMatchesFilter } from "./grid-color-core.ts";
export { describeViewDiff, viewDiffText } from "./view-diff-core.ts";
export { useGridServerGroups, type GridServerGroups } from "./grid-data-groups.ts";
export { GridFieldPicker, fieldIcon, type GridFieldPickerProps } from "./grid-field-picker.tsx";
export { GridConditionTree, ConditionValue, type GridConditionTreeProps } from "./grid-condition-editor.tsx";
export { ToolbarPanel, PanelFooter, type ToolbarPanelProps, type GridToolContext } from "./grid-toolbar-panel.tsx";
export { GridFilterTool } from "./grid-filter-panel.tsx";
export { GridGroupTool, GridSortTool } from "./grid-group-panel.tsx";
export { GridFieldsTool, type GridFieldsToolProps } from "./grid-fields-panel.tsx";
export { fieldPanelTree, fieldLayoutOf } from "./grid-fields-core.ts";
export { GridColorTool } from "./grid-color-panel.tsx";
export { GridGroupRow, GroupValue, type GridGroupSummaryCell } from "./grid-group-row.tsx";
export { ViewOverrideBar, type ViewOverrideBarProps } from "./view-override.tsx";
export * from "./grid-cells.tsx";
export * from "./grid-toolbar.tsx";
export * from "./grid-view.ts";
export * from "./grid-editors.tsx";
export { useGridEditing, type GridCellsChangeHandler, type GridStatus, type GridStatusConflict } from "./grid-editing.ts";
export { useGridServerData } from "./grid-data.ts";
export { GridPopover, type GridPopoverProps } from "./grid-popover.tsx";
// bt/grid-b
export type * from "./grid-field-types.ts";
export type * from "./grid-fill-core.ts";
export type * from "./grid-interact-core.ts";
export { gridFilterOps } from "./grid-core.ts";
export {
  coreType,
  coreField,
  maskPhone,
  progressText,
  toAttachments,
  toRecordRefs,
  toLookupTexts,
  toProgress,
  toPercent,
  toRating,
  isReadOnlyType,
  isExtraFieldType,
  GRID_EXTRA_FIELD_TYPES,
  GRID_EXTRA_FIELD_LABELS,
} from "./grid-field-types.ts";
export { planFill, fillTarget, fillSeries, filledRange, fillDownTarget } from "./grid-fill-core.ts";
export { frozenCountAt, menuRowIds, sortHints, rowMoveOf } from "./grid-interact-core.ts";
export * from "./grid-menus.tsx";
export * from "./grid-cells-extra.tsx";
export { GridRatingEditor } from "./grid-editors-extra.tsx";
export {
  GRID_ACTIONS_COLUMN,
  GRID_ADD_COLUMN,
  GRID_FEATURE_MAP,
  GRID_GROUP_COLUMN,
  GRID_ROW_COLUMN,
  GRID_TABLE_OPTIONS,
  defaultFieldWidth,
  gridColumnDefs,
  gridFeatures,
  gridTableState,
  type GridFeatures,
} from "./grid-engine.ts";

// ---------------------------------------------------------------- props

export type GridExpandRecord<T> = {
  /** Dialog title (default: the primary field's text). */
  title?: (row: T) => string;
  description?: (row: T) => ReactNode;
  /** Replace the 「详情」 content; `context.fields` is the default field list. */
  render?: (row: T, context: ExpandRecordContext<T>) => ReactNode;
  /** Record layout (sections, aside, tabs, highlights, status, actions, href); see RecordLayout. */
  layout?: Partial<RecordLayout<T>>;
  /** Level a record opens at (default: peek for ≤ 8 fields without tabs, expanded otherwise). */
  level?: Exclude<RecordDetailLevel, "page">;
  /** Keep the open record in the URL (`?record=<id>` or this parameter name). */
  url?: boolean | string;
  /** Controlled open record id (e.g. from a row action). */
  openKey?: string | null;
  onOpenChange?: (key: string | null) => void;
};

export type BitableGridProps<T> = {
  /** Client-side records (search / filter / sort / group in the browser; fine for a few thousand). */
  rows?: readonly T[];
  /** Server-side records instead of `rows`: loaded in blocks while scrolling (infinite scroll). */
  dataSource?: GridDataSource<T>;
  /** Rows per server request (default 100). */
  blockSize?: number;
  getRowId: (row: T) => string;
  fields: readonly GridField<T>[];
  /** Accessible name of the grid (default 「多维表格」). */
  caption?: string;
  /** Default row height when the view has none (矮 short 32 / 中 medium 56 / 高 tall 88 / 超高 extraTall 120). */
  rowHeight?: TableRowHeightPreset;
  /** Fields frozen at the left after the row-number column (default 1 = the primary field). */
  frozenColumns?: number;
  /** Controlled view (pair with onViewChange; useGridView persists it). Leave out for internal state. */
  view?: GridView;
  onViewChange?: (view: GridView) => void;
  /** Starting view when uncontrolled (older shapes such as `groupBy: "stage"` are fine). */
  defaultView?: GridViewInput;
  /** Bottom summary bar (default true): per-field statistic chosen by the user. */
  summary?: boolean;
  /** Record detail (default on): icon in the row-number column, Space / double click on a row. */
  expandRecord?: boolean | GridExpandRecord<T>;
  /** Row actions menu, frozen at the right. */
  rowActions?: (row: T) => readonly RowAction[];
  /** Selected record ids (controlled); give onSelectionChange to enable selection. */
  selection?: readonly string[];
  /**
   * Actions of the bottom floating bar shown while records are checked (「已选 2 条 · 转交 · 批量修改 ·
   * 删除 · ✕」, the same BulkActionBar as DataTable — it never pushes the grid down). Without it the bar still shows
   * the count and ✕.
   */
  bulkActions?: (ids: readonly string[]) => readonly BulkAction[];
  onSelectionChange?: (ids: string[]) => void;
  isRowSelectable?: (row: T) => boolean;
  /**
   * Save edits (fields with `editable`): typed values, pastes, clears, undo / redo arrive as one batch.
   * The grid shows the new values at once; resolve when saved (update your rows / refetch), throw or
   * return `{ rejected }` to roll cells back with the reason.
   */
  onCellsChange?: GridCellsChangeHandler<T>;
  /** Choices of user fields (editor and filter), per field key. */
  peopleOptions?: Readonly<Record<string, readonly GridPerson[]>>;
  /** true (default) = GridToolbar; a node replaces it; false hides it. */
  toolbar?: boolean | ReactNode;
  /** Host actions at the right end of the default toolbar. */
  actions?: ReactNode;
  /** bt/templates: host content at the left start of the default toolbar (T15: 「添加记录 ▾」 SplitButton). */
  toolbarLeading?: ReactNode;
  /** Business quick filters (公海 / 我跟进中的 / 停滞) at the right end of the default toolbar (GridToolbar `quickFilters`). */
  toolbarQuick?: ReactNode;
  /** The default toolbar's search: "box" (default) or "icon" (a search icon on the right that opens the box). */
  toolbarSearch?: "box" | "icon";
  /** The default toolbar's 「⋯」 (表设置 / 权限 / 操作记录 / 公开登记链接 / 导出), before `actions`. */
  toolbarMore?: readonly MenuSection[];
  /**
   * Turn off toolbar tools the page already provides (e.g. `{ search: false }` when a server-side
   * full-text search box sits above the grid). Server data sources also hide what they cannot do.
   */
  toolbarFeatures?: GridToolbarFeatures;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyLabel?: string;
  /**
   * Height of the scroll area: "fill" (default) = down to the bottom of the window (page-level
   * tables), "auto" = as tall as the rows up to `maxHeight` (small tables in dialogs / cards), or a
   * CSS length.
   */
  height?: number | string;
  /** "auto": tallest the grid gets (default 480). "fill": shortest (default 320). */
  maxHeight?: number;
  minHeight?: number;
  /** "fill": extra space kept below the grid (default 0; the page's own bottom padding is measured). */
  fillOffset?: number;
  // bt/grid-a
  /**
   * How filters and 填色 rules evaluate dynamic values and relative dates: `resolve(token)` answers
   * 「我」(`me`) / 「我的下属」(`mySubordinates`) / host tokens with the values to match (people names
   * or keys); `timeZone`, `weekStart` (0 Sunday … 6 Saturday, default Monday), `now`. Server sources
   * resolve them on the server from the session.
   */
  conditionContext?: ConditionContext;
  /** UI limits (default 3 group levels, 50 filter conditions, filter groups one level deep). */
  limits?: Partial<GridViewLimits>;
  /** Dynamic values offered in people filters (default 「我（当前用户）」「我的下属」). */
  dynamicTokens?: readonly DynamicToken[];
  /** 「另存为新视图」 in the view panels (host creates the view from the current one). */
  onSaveAsView?: () => void;
  /** Note in the view panels' footers, e.g. 「只改你的个人设置，自动保存」. */
  panelNote?: string;
  /** 字段配置: 「+ 新建字段」 and 「新建字段编组」. */
  onCreateField?: () => void;
  onCreateFieldGroup?: () => void;
  /** A bar between the toolbar and the grid (ViewOverrideBar「你的个人设置…」). */
  banner?: ReactNode;
  // bt/grid-b ---------------------------------------------------------------
  /** Host field actions in the header menu (修改字段 / 说明 / 插入 / 复制 / 权限 / 删除); double click on a header = 「edit」. */
  onFieldAction?: (action: GridFieldActionKind, field: GridField<T>) => void;
  /** Host field actions each header menu offers (default: all seven when onFieldAction is given). */
  fieldActions?: readonly GridFieldActionKind[] | ((field: GridField<T>) => readonly GridFieldActionKind[]);
  /** More header menu items (e.g. a 「加入字段编组 ›」 submenu), placed by `slot` (default 管理 next to 字段权限). */
  headerMenuItems?: (field: GridField<T>) => readonly GridHeaderMenuItem[];
  /** 「按此字段筛选」: open your filter panel on this field (default: an empty condition is added to the view). */
  onFilterByField?: (field: GridField<T>) => void;
  /** Trailing 「+」 column after the last field: create a field. */
  onAddField?: () => void;
  /** Cell menu 向上 / 向下插入记录 (Ctrl + Shift + Enter / Shift + Enter on a cell). */
  onRowsInsert?: (position: "above" | "below", anchorRowId: string) => void;
  /** Cell menu 复制记录 (checked rows, or the rows of the selected range). */
  onRowsDuplicate?: (rowIds: string[]) => void;
  /** Cell menu 删除所选 N 条记录: confirm in the host (ConfirmDialog) before deleting. */
  onRowsDelete?: (rowIds: string[]) => void;
  /** Host items of the cell menu after 「展开记录」 (分享记录 / 复制记录链接 / 查看修改历史 / 添加子记录 / 添加评论). */
  cellMenuItems?: (context: GridCellMenuContext<T>) => readonly MenuItem[];
  /** 「+ 新增一行」 under every expanded group (its group keys) and, ungrouped, at the bottom ({}). */
  onAddRow?: (group: Readonly<Record<string, string>>) => void;
  /** Drag records by the grip in the row-number column, or Alt + Shift + ↑ / ↓ (client rows, no sort). */
  onRowMove?: (move: GridRowMove) => void;
  /** A small corner marker on a cell (comments, pending approval); `label` is read by screen readers. */
  cellBadge?: (row: T, field: GridField<T>) => { label: string; tone?: "warning" | "info" | "danger" | "brand" } | null | undefined;
  // ---------------------------------------------------------------- bt/grid-b
};

type Item<T> =
  | { kind: "group"; id: string; key: string; group: GridGroup<T> }
  | { kind: "add"; id: string; group: Record<string, string>; node: GridGroup<T> | null } // bt/grid-b (multi-level: bt/grid-a)
  | { kind: "row"; id: string; row: T }
  | { kind: "loading"; id: string; error: string | null };

/** One tab stop per grid: links, chips and buttons inside cells are reached with Enter (then Tab cycles inside the cell, Esc returns). */
const INNER_CONTROLS = ".aui-grid-cell a[href], .aui-grid-cell button, .aui-grid-cell input, .aui-grid-hcell button";
const CELL_CONTROLS = "a[href], button:not([disabled]), input:not([disabled]), [role=checkbox]";
function demoteInner(box: HTMLElement) {
  for (const node of box.querySelectorAll<HTMLElement>(INNER_CONTROLS)) {
    if (node.closest(".aui-grid-editor, [data-inside]")) continue;
    if (node.tabIndex !== -1) node.tabIndex = -1;
  }
}
const HEADER_HEIGHT = 40;
/** One shared empty list: server mode must not hand TanStack / the layout a new [] every render. */
const NO_ROWS: never[] = [];
const FOOTER_HEIGHT = 36;
const GROUP_HEIGHT = 40;
const ADD_HEIGHT = 36; // bt/grid-b
const ALL_FIELD_ACTIONS: readonly GridFieldActionKind[] = ["edit", "describe", "insertLeft", "insertRight", "duplicate", "permission", "delete"];

const useNarrow = useMediaQuery;

/**
 * Height that reaches the bottom of the window: viewport height − the scroll box's top in the
 * document (scroll positions of the page and its scrolling ancestors undone) − what the panel shows
 * below the box − `offset`. Re-measured on resize and whenever the layout above it changes.
 */
function useFillHeight(box: React.RefObject<HTMLDivElement | null>, panel: React.RefObject<HTMLDivElement | null>, enabled: boolean, offset: number, min: number) {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    const measure = () => {
      const node = box.current;
      if (!node) return;
      let scrolled = 0;
      for (let el = node.parentElement; el; el = el.parentElement) scrolled += el.scrollTop;
      const top = node.getBoundingClientRect().top + scrolled;
      // What the panel draws under the box (status line …): the boxes after it, not the gap to the panel's
      // bottom — a panel stretched by a flex parent (RailShell workspace) would feed its own height back.
      let below = 0;
      for (let el: Element | null = node; el && el !== panel.current; el = el.parentElement) {
        for (let next = el.nextElementSibling; next; next = next.nextElementSibling) {
          const style = getComputedStyle(next);
          if (style.position === "absolute" || style.position === "fixed" || style.display === "none") continue;
          below += next.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
        }
      }
      if (panel.current) {
        const style = getComputedStyle(panel.current);
        below += parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
      }
      // The page's own bottom spacing: padding / border / margin of every ancestor under the panel.
      let spacing = 0;
      for (let el: HTMLElement | null = panel.current; el && el !== document.documentElement; el = el.parentElement) {
        const style = getComputedStyle(el);
        spacing += (el === panel.current ? 0 : parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth)) + parseFloat(style.marginBottom);
      }
      const next = Math.max(min, Math.floor(window.innerHeight - top - below - spacing - offset));
      setHeight((old) => (old === next ? old : next));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => requestAnimationFrame(measure));
    observer?.observe(document.body);
    if (panel.current?.parentElement) observer?.observe(panel.current.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [enabled, offset, min, box, panel]);
  return height;
}

const isTyping = (node: EventTarget | null) => node instanceof HTMLElement && (node.matches("input, textarea, select") || node.isContentEditable);

/**
 * 多维表格: record lists users sort / group / filter / summarize / edit themselves — the standard
 * table of admin pages (client rows up to a few thousand; server `dataSource` for more).
 * See INTEGRATION.md「多维表格」.
 */
export function BitableGrid<T extends RowData>(props: BitableGridProps<T>) {
  const { getRowId, caption = "多维表格", frozenColumns = 1, summary = true, loading, error } = props;
  const theme = useAdminTheme();
  const localeDefaults = useAdminDefaults();
  const fields = useMemo(() => withLocaleDefaults(props.fields, localeDefaults), [props.fields, localeDefaults]);
  const fontScale = FONT_SIZE_PRESETS.find((preset) => preset.id === theme.fontSize)?.scale ?? 1;
  const narrow = useNarrow("(max-width: 760px)");
  const gridId = useId();
  const server = Boolean(props.dataSource);
  const caps = props.dataSource?.capabilities;

  // View: controlled (view + onViewChange) or internal. Server sources group only with `loadGroups`.
  const [ownView, setOwnView] = useState(() => normalizeGridView(props.defaultView ?? {}, fields, { rowHeight: props.rowHeight }));
  const rawView = useMemo(() => normalizeGridView(props.view ?? ownView, fields, { rowHeight: props.rowHeight }), [props.view, ownView, fields, props.rowHeight]);
  const serverGroups = server && Boolean(props.dataSource?.loadGroups);
  const view = useMemo(() => (server && !serverGroups && rawView.groupBy.length ? { ...rawView, groupBy: [], collapsed: [] } : rawView), [server, serverGroups, rawView]);
  const conditionContext = useMemo<ConditionContext>(() => (props.conditionContext?.timeZone ? props.conditionContext : { ...props.conditionContext, timeZone: localeDefaults.timeZone }), [props.conditionContext, localeDefaults.timeZone]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const controlled = props.view !== undefined;
  const onViewChangeRef = useRef(props.onViewChange);
  onViewChangeRef.current = props.onViewChange;
  const commit = useCallback((next: GridView) => {
    viewRef.current = next;
    if (!controlled) setOwnView(next);
    onViewChangeRef.current?.(next);
  }, [controlled]);
  const dispatch = useCallback((action: GridViewAction) => commit(gridViewReducer(viewRef.current, action, fields)), [commit, fields]);

  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const primary = primaryField(fields);
  const visibleKeys = view.order.filter((key) => !view.hidden.includes(key));

  // ---- data: client rows or server blocks, with the edit overlay applied
  const query = useMemo(() => gridQueryOf(view, fields, { groups: serverGroups }), [view.search, view.filter, view.sort, view.groupBy, serverGroups, fields]); // eslint-disable-line react-hooks/exhaustive-deps
  const serverSummaries = useMemo(() => {
    if (!server || !summary) return undefined;
    const allowed = caps?.summaries ?? [];
    return Object.fromEntries(visibleKeys.flatMap((key) => (view.summary[key] && allowed.includes(view.summary[key]!) ? [[key, view.summary[key]!]] : []))) as Record<string, GridSummaryKind>;
  }, [server, summary, caps?.summaries, visibleKeys.join("|"), view.summary]); // eslint-disable-line react-hooks/exhaustive-deps
  const remote = useGridServerData(props.dataSource, query, getRowId, { enabled: server, blockSize: props.blockSize, summaries: serverSummaries });
  const remoteGroups = useGridServerGroups(props.dataSource, query, { enabled: serverGroups, summaries: serverSummaries });
  const sourceRows = props.rows ?? NO_ROWS;
  const rowIndex = useMemo(() => (server ? null : new Map(sourceRows.map((row) => [getRowId(row), row]))), [server, sourceRows, getRowId]);
  const editing = useGridEditing<T>({
    fields,
    getRowId,
    onCellsChange: props.onCellsChange,
    findRow: (id) => (server ? remote.findRow(id) : rowIndex?.get(id)),
    dataVersion: server ? remote.state.blocks : props.rows,
    onSaved: server ? remote.patch : undefined,
  });
  // An editable grid fetches its cell editors while idle, so the first keystroke opens a ready editor.
  useEffect(() => (editing.enabled ? whenIdle(cellEditor.preload) : undefined), [editing.enabled]);
  const presentRows = useMemo(() => (server ? NO_ROWS : sourceRows.map(editing.present)), [server, sourceRows, editing.present, editing.overlayVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => (server ? NO_ROWS : filterGridRows(presentRows, fields, view, conditionContext)), [server, presentRows, fields, view.filter, view.search, view.hidden, conditionContext]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupsPending = serverGroups && view.groupBy.length > 0 && remoteGroups.nodes === null && !remoteGroups.error;
  const busy = Boolean(loading) || (server && remote.firstLoading) || groupsPending;
  const failure = error ?? (server ? remote.firstError ?? (view.groupBy.length ? remoteGroups.error : null) ?? undefined : undefined);
  const interactive = !busy && !failure;

  const hasActions = Boolean(props.rowActions);
  const addField = Boolean(props.onAddField);
  const columns = useMemo(() => gridColumnDefs(fields, null, hasActions, { addField }), [fields, hasActions, addField]);

  // Narrow screens: the frozen block never takes more than 60% of the width.
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [viewport, setViewport] = useState(0);
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => {
      setBoxWidth(node.clientWidth);
      setViewport(node.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const frozenCount = Math.min(visibleKeys.length, view.frozen ?? frozenColumns); // bt/grid-b: the view's freeze line wins
  const frozenKeys = visibleKeys.slice(0, Math.max(0, frozenCount));
  const sizing = useMemo(() => {
    if (!boxWidth || boxWidth >= 760) return undefined;
    const widths = frozenKeys.map((key) => view.widths[key] ?? defaultFieldWidth(byKey.get(key)!));
    const fitted = fitFrozenWidths(widths, GRID_ROW_NUMBER_WIDTH, boxWidth);
    return Object.fromEntries(frozenKeys.map((key, i) => [key, fitted[i]!]));
  }, [boxWidth, frozenKeys.join("|"), view.widths, byKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useMemo(() => gridTableState(view, { frozenColumns: frozenCount, actions: hasActions, sizing }), [view, frozenCount, hasActions, sizing]);

  // Server rows come sorted; a stable state object keeps TanStack's row model (and the layout) stable.
  const tableState = useMemo(() => (server ? { ...state, sorting: [], grouping: [], expanded: {} } : state), [server, state]);
  const table = useTable({
    ...GRID_TABLE_OPTIONS,
    features: gridFeatures,
    data: filtered,
    columns,
    getRowId: (row: T) => getRowId(row),
    state: tableState,
    onColumnSizingChange: (updater) => {
      const before = state.columnSizing as Record<string, number>;
      const next = (typeof updater === "function" ? updater(before) : updater) as Record<string, number>;
      const widths = { ...viewRef.current.widths };
      let changed = false;
      for (const [key, width] of Object.entries(next)) if (byKey.has(key) && before[key] !== width) { widths[key] = width; changed = true; }
      if (changed) commit(normalizeGridView({ ...viewRef.current, widths }, fields));
    },
  });

  const tableRows = table.getRowModel().rows;
  // Client: TanStack sorts; 自动排序 off keeps rows in place until the sort / filter changes; groups
  // are built here (any depth, empty groups, summaries). Server: group nodes from loadGroups.
  const frozenOrder = useRef<{ key: string; order: Map<string, number> } | null>(null);
  const sortedRows = useMemo(() => {
    if (server) return NO_ROWS as T[];
    const list = tableRows.map((row) => row.original);
    const key = JSON.stringify([view.sort, conditionTreeKey(view.filter), view.search]);
    if (view.autoSort || frozenOrder.current?.key !== key) {
      frozenOrder.current = { key, order: new Map(list.map((row, i) => [getRowId(row), i])) };
      return list;
    }
    const kept = keepRowOrder(list, frozenOrder.current.order, getRowId);
    frozenOrder.current = { key, order: kept.order };
    return kept.rows;
  }, [server, tableRows, view.autoSort, view.sort, view.filter, view.search, getRowId]);
  const serverTree = useMemo((): GridGroup<T>[] | null => (server && view.groupBy.length ? (remoteGroups.nodes ? groupTreeFromNodes<T>(remoteGroups.nodes, view.groupBy, fields, { showEmpty: view.showEmptyGroups }) : []) : null), [server, remoteGroups.nodes, view.groupBy, view.showEmptyGroups, fields]);
  const clientTree = useMemo((): GridGroup<T>[] | null => (!server && view.groupBy.length ? groupTreeFromRows(sortedRows, view.groupBy, fields, { showEmpty: view.showEmptyGroups }) : null), [server, sortedRows, view.groupBy, view.showEmptyGroups, fields]);
  const groupTree = server ? serverTree : clientTree;
  const clientRows = useMemo(() => (server ? (NO_ROWS as T[]) : clientTree ? groupedRowOrder(clientTree) : sortedRows), [server, clientTree, sortedRows]);
  // bt/grid-b 「+ 新增一行」: after every expanded leaf group (its group values), or at the bottom.
  const addRows = Boolean(props.onAddRow);
  const dataCount = server ? remote.total ?? 0 : clientRows.length;
  const layout = useMemo(
    () => (groupTree ? groupLayout(groupTree, view.collapsed, { addRows: addRows ? view.groupBy : undefined }) : flatLayout<T>(dataCount, { addRow: addRows && (!server || remote.total !== null) })),
    [groupTree, view.collapsed, view.groupBy, addRows, server, remote.total, dataCount],
  );
  const groupKeys = layout.groupKeys;
  const count = layout.count;
  const itemAt = (index: number): Item<T> => {
    const at = layout.at(index);
    if (at?.kind === "group") return { kind: "group", id: `__group:${at.group.key}`, key: at.group.key, group: at.group };
    if (at?.kind === "add") return { kind: "add", id: `__add:${at.key}`, group: at.values, node: at.group };
    const offset = at?.offset ?? index;
    if (server) {
      const row = remote.rowAt(offset);
      return row === undefined ? { kind: "loading", id: `__loading:${index}`, error: remote.failedAt(offset) } : { kind: "row", id: getRowId(row), row: editing.present(row) };
    }
    const row = clientRows[offset]!;
    return { kind: "row", id: getRowId(row), row };
  };
  /** Item index showing a row (client rows; -1 when its group is collapsed). */
  const displayIndexOf = (id: string) => {
    const offset = clientRows.findIndex((row) => getRowId(row) === id);
    return offset < 0 ? -1 : layout.indexOfOffset(offset);
  };
  const start = table.getStartVisibleLeafColumns();
  const center = table.getCenterVisibleLeafColumns();
  const end = table.getEndVisibleLeafColumns();
  const cols = [...start, ...center, ...end];
  const totalWidth = table.getTotalSize();
  const sizeOf = (column: (typeof cols)[number]) => column.getSize();
  const canvasWidth = totalWidth + scrollTailPad(center.map(sizeOf), [...start, ...end].reduce((sum, column) => sum + sizeOf(column), 0), boxWidth);
  const headers = new Map<string, Header<GridFeatures, T, unknown>>(table.getFlatHeaders().map((header) => [header.column.id, header]));
  const fieldAt = (col: number) => (cols[col] ? byKey.get(cols[col]!.id) ?? null : null);
  const dataCols = cols.map((column, i) => (byKey.has(column.id) ? i : -1)).filter((i) => i >= 0);
  const firstDataCol = dataCols[0] ?? 0;
  const lastDataCol = dataCols.at(-1) ?? 0;

  // Rows in display order (collapsed groups included): numbering and previous / next record.
  const ordered = useMemo(() => {
    if (server) return [...remote.state.blocks.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, rows]) => rows.map(editing.present));
    return clientRows;
  }, [server, remote.state.blocks, clientRows, editing.present]);
  const numberOf = useMemo(() => (server ? null : new Map(ordered.map((row, i) => [getRowId(row), i + 1]))), [server, ordered, getRowId]);
  const serverNumber = (index: number) => {
    const at = layout.at(index);
    return at?.kind === "row" ? at.offset + 1 : index + 1;
  };

  // Geometry: every data row has exactly the same height.
  const rowHeight = gridRowHeight(view.rowHeight, { fontScale, touch: narrow });
  const lines = gridRowLines(view.rowHeight);
  const headerHeight = narrow ? 44 : HEADER_HEIGHT;
  const footerHeight = summary ? (narrow ? 44 : FOOTER_HEIGHT) : 0;
  const groupHeight = narrow ? 44 : GROUP_HEIGHT;
  const addHeight = narrow ? 44 : ADD_HEIGHT;
  const budget: TableCellBudget = { lines, clamped: true, compact: rowHeight < 40 };

  // Height: fill the window (default), fit the rows ("auto") or a fixed length.
  const heightMode = props.height === undefined || props.height === "fill" ? "fill" : props.height === "auto" ? "auto" : "fixed";
  const fillHeight = useFillHeight(scrollRef, panelRef, heightMode === "fill", props.fillOffset ?? 0, props.minHeight ?? 320);
  const contentHeight = headerHeight + footerHeight + Math.max(1, count) * rowHeight + 2;
  const boxHeight: number | string = heightMode === "fill" ? fillHeight ?? "clamp(320px, 70vh, 640px)" : heightMode === "auto" ? Math.min(props.maxHeight ?? 480, Math.max(props.minHeight ?? (count ? 0 : 200), contentHeight)) : props.height!;

  // ---- active cell, range, editing
  const rowCount = count + (summary ? 1 : 0);
  const [active, setActive] = useState<GridCellRef>({ row: 0, col: Math.min(1, cols.length - 1) });
  const cell = { row: Math.max(-1, Math.min(active.row, rowCount - 1)), col: Math.max(0, Math.min(active.col, cols.length - 1)) };
  const [anchor, setAnchor] = useState<GridCellRef | null>(null);
  const range: GridRange | null = anchor && cell.row >= 0 && cell.row < count ? clampRange({ anchor, focus: cell }, count, firstDataCol, lastDataCol) : null;
  const effectiveRange: GridRange | null = range ?? (cell.row >= 0 && cell.row < count && fieldAt(cell.col) ? { anchor: cell, focus: cell } : null);
  const [edit, setEdit] = useState<{ rowId: string; row: number; col: number; startText?: string; error?: string | null } | null>(null);
  const focusPending = useRef(false);
  const activeRow = cell.row;
  const rangeExtractor = useCallback((r: Range) => {
    const list = defaultRangeExtractor(r);
    if (activeRow >= 0 && activeRow < r.count && !list.includes(activeRow)) {
      list.push(activeRow);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [activeRow]);
  const getItemKey = useCallback((index: number) => {
    const at = layout.at(index);
    if (at?.kind === "group") return `__group:${at.group.key}`;
    if (at?.kind === "add") return `__add:${at.key}`;
    const offset = at?.offset ?? index;
    const row = server ? remote.rowAt(offset) : clientRows[offset];
    return row !== undefined ? getRowId(row) : `__i${index}`;
  }, [server, remote, clientRows, layout, getRowId]); // eslint-disable-line react-hooks/exhaustive-deps
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const kind = layout.at(index)?.kind;
      return kind === "group" ? groupHeight : kind === "add" ? addHeight : rowHeight;
    },
    getItemKey,
    overscan: 6,
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight,
    scrollPaddingEnd: footerHeight,
    rangeExtractor,
    initialRect: { width: 1024, height: 560 },
  });
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight, groupHeight, layout]);
  const bodyHeight = virtualizer.getTotalSize();
  const virtualItems = interactive ? virtualizer.getVirtualItems() : [];
  // Server: fetch the blocks the viewport (plus overscan) needs.
  const firstVisible = virtualItems[0]?.index ?? 0;
  const lastVisible = virtualItems.at(-1)?.index ?? (props.blockSize ?? 100) - 1;
  useEffect(() => {
    if (!server || groupsPending) return;
    // Grouped: the rows shown between the headers (collapsed groups skipped).
    const span: [number, number] | null = layout.grouped ? layout.rowSpan(firstVisible, lastVisible + 20) : [firstVisible, lastVisible + 20];
    if (span) remote.ensure(span[0], span[1]);
  }, [server, groupsPending, layout, firstVisible, lastVisible, remote.ensure]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection.
  const selectable = Boolean(props.onSelectionChange);
  const selected = props.selection ?? [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selAnchor = useRef<string | null>(null);
  const shift = useRef(false);
  const canSelect = (row: T) => props.isRowSelectable?.(row) !== false;
  const selectableIds = useMemo(() => ordered.filter(canSelect).map(getRowId), [ordered, getRowId, props.isRowSelectable]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleRow = (id: string, on: boolean) => {
    if (!props.onSelectionChange) return;
    let ids = [id];
    if (shift.current && selAnchor.current && selAnchor.current !== id) {
      const a = selectableIds.indexOf(selAnchor.current);
      const b = selectableIds.indexOf(id);
      if (a >= 0 && b >= 0) ids = selectableIds.slice(Math.min(a, b), Math.max(a, b) + 1);
    }
    selAnchor.current = id;
    props.onSelectionChange(on ? [...new Set([...selected, ...ids])] : selected.filter((key) => !ids.includes(key)));
  };
  const checkedCount = selectableIds.filter((id) => selectedSet.has(id)).length;

  // Record detail (shared with DataTable).
  const recordOptions = props.expandRecord === false ? undefined : props.expandRecord === true || props.expandRecord === undefined ? {} : props.expandRecord;
  const primaryText = (row: T) => (primary ? fieldText(primary, row) : "") || getRowId(row);
  const expand = useRecordExpand<T>({
    options: recordOptions ? { title: recordOptions.title ?? primaryText, description: recordOptions.description, render: recordOptions.render, label: primaryText, layout: recordOptions.layout, level: recordOptions.level, url: recordOptions.url, openKey: recordOptions.openKey, onOpenChange: recordOptions.onOpenChange } : undefined,
    rows: ordered,
    rowKey: getRowId,
    enabled: interactive,
    fields: (row) => view.order.map((key) => {
      const field = byKey.get(key)!;
      const long = field.type === "longText" || field.type === "multiSelect" || field.type === "user" || Boolean(field.detail);
      const copy = field.primary || field.type === "url" || field.type === "email" || (field.type === "text" && !field.render);
      return { key, label: field.title, value: field.detail ? field.detail(row) : renderGridCell(field, row, { selected: selectedSet.has(getRowId(row)) }), text: fieldText(field, row), full: long, copy };
    }),
    onRefocus: (key) => {
      const offset = ordered.findIndex((row) => getRowId(row) === key);
      const at = offset < 0 ? -1 : layout.indexOfOffset(offset);
      if (at < 0) return;
      focusPending.current = true;
      setActive((old) => ({ row: at, col: old.col }));
    },
  });

  // Popovers: summary picker (the column menu is a Menu, bt/grid-b).
  const [popover, setPopover] = useState<{ kind: "summary"; key: string; anchor: HTMLElement } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{ key: string; anchor: HTMLElement; point?: { x: number; y: number } } | null>(null);
  const [cellMenu, setCellMenu] = useState<{ sections: readonly MenuSection[]; point: { x: number; y: number }; keyboard: boolean; returnTo: HTMLElement; label: string } | null>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const closePopover = (returnFocus: boolean) => {
    const target = popover?.anchor;
    setPopover(null);
    if (returnFocus) target?.focus({ preventScroll: true });
  };

  // Focus the active cell after keyboard moves; keep it clear of sticky header, footer and frozen columns.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    demoteInner(box);
    if (!focusPending.current || edit) return;
    focusPending.current = false;
    const target = box.querySelector<HTMLElement>(`[data-cell="${cell.row}:${cell.col}"]`) ?? box.querySelector<HTMLElement>(`[data-row-index="${cell.row}"] [data-cell]`);
    if (cell.row >= 0 && cell.row < count) virtualizer.scrollToIndex(cell.row, { align: "auto" });
    if (!target) return;
    target.focus({ preventScroll: true });
    if (target.dataset.pin) return;
    const boxRect = box.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const frozen = start.reduce((sum, column) => sum + column.getSize(), 0);
    const trailing = end.reduce((sum, column) => sum + column.getSize(), 0);
    if (rect.left < boxRect.left + frozen) box.scrollLeft -= boxRect.left + frozen - rect.left;
    else if (rect.right > boxRect.left + box.clientWidth - trailing) box.scrollLeft += rect.right - (boxRect.left + box.clientWidth - trailing);
  });
  // Cell components re-render on their own (CellTags measures, then shows +N): watch for new controls too.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => demoteInner(box));
    observer.observe(box, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const moveTo = (next: GridCellRef, extend = false) => {
    focusPending.current = true;
    if (extend) setAnchor((old) => old ?? cell);
    else setAnchor(null);
    setActive(next);
  };

  // ---- editing actions
  const planContext: PlanContext<T> = {
    rowAt: (index) => {
      const item = index >= 0 && index < count ? itemAt(index) : null;
      return item?.kind === "row" ? { row: item.row, rowId: item.id } : null;
    },
    rowCount: count,
    fieldAt,
    people: (field) => props.peopleOptions?.[field.key],
  };
  const canEditCell = (row: number, col: number) => {
    const field = fieldAt(col);
    const item = row >= 0 && row < count ? itemAt(row) : null;
    return Boolean(editing.enabled && field && item?.kind === "row" && isCellEditable(field, item.row));
  };
  const startEdit = (row: number, col: number, startText?: string) => {
    const item = itemAt(row);
    if (item.kind !== "row") return;
    const host = fieldAt(col)?.openEditor; // bt/grid-b: record picker / upload drawer of the host
    if (host) {
      setAnchor(null);
      setActive({ row, col });
      host(item.row);
      return;
    }
    // Attachment / link cells have no in-cell editor: without the host's `openEditor` there is nothing to open
    // (an edit state with no editor would swallow the keyboard).
    const type = fieldAt(col)?.type;
    if (type === "attachment" || type === "link") return;
    setAnchor(null);
    setActive({ row, col });
    setEdit({ rowId: item.id, row, col, startText });
  };
  const toggleCheckbox = (row: number, col: number) => {
    const field = fieldAt(col);
    const item = itemAt(row);
    if (!field || item.kind !== "row" || !canEditCell(row, col)) return;
    const change = makeChange(field, item.row, item.id, readField(field, item.row) !== true);
    if (change) void editing.apply([change], "edit", { label: `修改「${field.title}」` });
  };
  /** bt/grid-b: a click on a star sets the rating (the current value again clears it). */
  const setRating = (row: number, col: number, star: Element | null) => {
    const field = fieldAt(col);
    const item = itemAt(row);
    if (!star || !field || item.kind !== "row" || !canEditCell(row, col)) return;
    const stars = [...(star.parentElement?.querySelectorAll(".aui-rating-star") ?? [])];
    const picked = stars.indexOf(star) + 1;
    if (picked < 1) return;
    const value = readField(field, item.row) === picked ? null : picked;
    const change = makeChange(field, item.row, item.id, value);
    if (change) void editing.apply([change], "edit", { label: `修改「${field.title}」` });
  };
  const finishEdit = (commitValue: GridEditorCommit | null, move: GridCommitMove) => {
    const current = edit;
    if (!current) return;
    if (commitValue) {
      const field = fieldAt(current.col);
      const base = server ? remote.findRow(current.rowId) : rowIndex?.get(current.rowId);
      if (field && base !== undefined) {
        const row = editing.present(base);
        let value: unknown;
        if ("text" in commitValue) {
          const parsed = validateFieldInput(field, commitValue.text, row, props.peopleOptions?.[field.key]);
          if (!parsed.ok) {
            setEdit({ ...current, error: parsed.error });
            return;
          }
          value = parsed.value;
        } else {
          value = commitValue.value;
          const message = field.required && (value === null || (Array.isArray(value) && !value.length)) ? `「${field.title}」不能为空` : field.validate?.(value, row) ?? null;
          if (message) {
            setEdit({ ...current, error: message });
            return;
          }
        }
        const change = makeChange(field, row, current.rowId, value);
        if (change) void editing.apply([change], "edit", { label: `修改「${field.title}」` });
      }
    }
    setEdit(null);
    focusPending.current = true;
    const next = move === "down" ? { row: Math.min(count - 1, current.row + 1), col: current.col }
      : move === "up" ? { row: Math.max(0, current.row - 1), col: current.col }
      : move === "right" ? { row: current.row, col: Math.min(lastDataCol, current.col + 1) }
      : move === "left" ? { row: current.row, col: Math.max(firstDataCol, current.col - 1) }
      : { row: current.row, col: current.col };
    setActive(next);
  };
  // An edited row that scrolls away / disappears ends the edit without saving.
  const editRowGone = edit !== null && (edit.row >= count || itemAt(edit.row).id !== edit.rowId);
  useEffect(() => {
    if (editRowGone) setEdit(null);
  }, [editRowGone]);

  const clearRange = () => {
    if (!editing.enabled || !effectiveRange) return;
    const plan = planClear(effectiveRange, planContext);
    void editing.apply(plan.changes, "clear", { label: "清空", skipped: plan.skipped.length, skipReason: plan.skipped[0]?.reason });
  };
  const copyRange = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!effectiveRange) return false;
    const matrix = rangeText(effectiveRange, planContext, fieldText);
    if (!matrix.length) return false;
    event.clipboardData.setData("text/plain", toTsv(matrix));
    event.clipboardData.setData("text/html", toHtmlTable(matrix));
    event.preventDefault();
    return true;
  };
  const onCopy = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    // Text the user selected outside the grid (or inside an editor) copies natively.
    if (edit || isTyping(event.target) || (selection?.toString() && !scrollRef.current?.contains(selection.anchorNode))) return;
    selection?.removeAllRanges();
    if (copyRange(event) && effectiveRange) editing.setStatus({ tone: "success", text: `已复制 ${rangeCellCount(effectiveRange)} 格，可粘贴到 Excel / 飞书 / 本表` });
  };
  const onCut = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (edit || isTyping(event.target)) return;
    if (!copyRange(event)) return;
    clearRange();
  };
  const onPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (edit || isTyping(event.target) || !editing.enabled || !effectiveRange) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    pasteText(text);
  };
  const pasteText = (text: string, target: GridRange | null = effectiveRange) => {
    const effectiveRange = target;
    if (!effectiveRange) return;
    const matrix = parseTsv(text);
    const plan = planPaste(matrix, effectiveRange, planContext);
    void editing.apply(plan.changes, "paste", { label: "粘贴", skipped: plan.skipped.length, skipReason: plan.skipped[0]?.reason });
    // Select what was pasted (single value filling a range keeps the range).
    if (!(matrix.length === 1 && matrix[0]!.length === 1)) {
      const rows = Math.min(count - 1, effectiveRange.anchor.row === effectiveRange.focus.row ? cell.row + matrix.length - 1 : Math.max(effectiveRange.anchor.row, effectiveRange.focus.row));
      setAnchor({ row: Math.min(effectiveRange.anchor.row, effectiveRange.focus.row), col: Math.min(effectiveRange.anchor.col, effectiveRange.focus.col) });
      setActive({ row: rows, col: Math.min(lastDataCol, Math.min(effectiveRange.anchor.col, effectiveRange.focus.col) + Math.max(...matrix.map((r) => r.length)) - 1) });
    }
  };

  // ---- mouse: range drag, column drag
  const dragRange = useRef(false);
  const onCellPointerDown = (event: ReactPointerEvent<HTMLDivElement>, row: number, col: number) => {
    if (event.button !== 0 || !fieldAt(col)) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, [role=checkbox], .aui-grid-editor")) return;
    if (event.shiftKey) {
      event.preventDefault();
      setAnchor((old) => old ?? cell);
      setActive({ row, col });
      return;
    }
    setAnchor({ row, col });
    setActive({ row, col });
    dragRange.current = event.pointerType === "mouse";
  };
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRange.current || !(event.buttons & 1)) return;
      const node = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-cell]");
      if (!node || !scrollRef.current?.contains(node)) return;
      const [r, c] = node.dataset.cell!.split(":").map(Number) as [number, number];
      if (r < 0 || r >= count || Number.isNaN(c) || !byKey.has(cols[c]?.id ?? "")) return;
      setActive((old) => (old.row === r && old.col === c ? old : { row: r, col: c }));
    };
    const onUp = () => {
      if (!dragRange.current) return;
      dragRange.current = false;
      setAnchor((old) => (old && old.row === activeRef.current.row && old.col === activeRef.current.col ? null : old));
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  });
  const activeRef = useRef(cell);
  activeRef.current = cell;

  const drag = useRef<{ key: string; x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const headRow = useRef<HTMLDivElement>(null);
  const [drop, setDrop] = useState<{ before: string | null; x: number } | null>(null);
  const dropTarget = (clientX: number, key: string) => {
    const rowNode = headRow.current;
    if (!rowNode) return null;
    const base = rowNode.getBoundingClientRect().left;
    const cells = [...rowNode.querySelectorAll<HTMLElement>("[data-field-key]")].filter((node) => node.dataset.fieldKey !== primary?.key);
    for (const node of cells) {
      const rect = node.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return { before: node.dataset.fieldKey ?? null, x: rect.left - base, key };
    }
    const last = cells.at(-1)?.getBoundingClientRect();
    return { before: null, x: (last?.right ?? base) - base, key };
  };
  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>, key: string) => {
    if (event.button !== 0 || event.pointerType === "touch" || key === primary?.key || (event.target as HTMLElement).closest(".aui-grid-resizer")) return;
    drag.current = { key, x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onHeaderPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.abs(event.clientX - current.x) < 6) return;
    current.moved = true;
    const target = dropTarget(event.clientX, current.key);
    if (target) setDrop((old) => (old && old.before === target.before && Math.abs(old.x - target.x) < 1 ? old : { before: target.before, x: target.x }));
  };
  const onHeaderPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    suppressClick.current = true;
    const target = dropTarget(event.clientX, current.key);
    setDrop(null);
    if (target && target.before !== current.key) dispatch({ type: "moveBefore", key: current.key, before: target.before });
  };
  const openColumnMenu = (key: string, anchorNode: HTMLElement) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setHeaderMenu({ key, anchor: anchorNode });
  };

  // ---- bt/grid-b: fill handle, freeze line, row drag, context menus
  const applyFill = (source: GridRange, target: GridFillTarget) => {
    const plan = planFill(source, target, planContext);
    void editing.apply(plan.changes, "fill", { label: "填充", skipped: plan.skipped.length, skipReason: plan.skipped[0]?.reason });
    const filled = filledRange(source, target);
    setAnchor(filled.anchor);
    setActive(filled.focus);
    focusPending.current = true;
  };
  const fill = useFillDrag(scrollRef, { rows: count, firstCol: firstDataCol, lastCol: lastDataCol }, applyFill);
  const fillBox = fill.preview ? rangeBounds(fill.preview.range) : null;
  const rangeBox = range && !(range.anchor.row === range.focus.row && range.anchor.col === range.focus.col) ? rangeBounds(range) : null;
  const handleBox = editing.enabled && interactive && focusWithin && !edit && effectiveRange ? rangeBounds(effectiveRange) : null;
  const freeze = useFreezeDrag(headRow, visibleKeys.length, (n) => dispatch({ type: "freeze", count: n }));
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowMoveEnabled = Boolean(props.onRowMove) && !server && view.sort.length === 0 && interactive;
  // Group of a row = its keys on every level (bt/grid-a multi-level); moves stay inside one leaf group.
  const groupValuesOf = (row: T): Record<string, string> | null =>
    view.groupBy.length ? Object.fromEntries(view.groupBy.flatMap((level) => { const field = byKey.get(level.field); return field ? [[level.field, gridGroupKey(field, row)]] : []; })) : null;
  const groupOf = (row: T) => { const values = groupValuesOf(row); return values ? JSON.stringify(values) : null; };
  const commitRowMove = (rowId: string, targetId: string, place: "before" | "after") => {
    const target = ordered.find((row) => getRowId(row) === targetId);
    if (!target || !props.onRowMove) return;
    const group = groupOf(target);
    const ids = ordered.filter((row) => groupOf(row) === group).map(getRowId);
    const move = rowMoveOf(ids, rowId, targetId, place);
    const values = groupValuesOf(target);
    if (move) props.onRowMove({ ...move, ...(values ? { group: values } : {}) });
  };
  const rowDrag = useRowDrag(scrollRef, bodyRef, commitRowMove);
  const moveRowByKey = (index: number, delta: -1 | 1) => {
    const item = index >= 0 && index < count ? itemAt(index) : null;
    if (!rowMoveEnabled || item?.kind !== "row") return;
    const group = groupOf(item.row);
    const ids = ordered.filter((row) => groupOf(row) === group).map(getRowId);
    const neighbour = ids[ids.indexOf(item.id) + delta];
    if (!neighbour) return;
    const at = displayIndexOf(neighbour);
    commitRowMove(item.id, neighbour, delta < 0 ? "before" : "after");
    if (at >= 0) moveTo({ row: at, col: cell.col });
  };
  const rangeRowIds = (target: GridRange | null) => {
    if (!target) return [];
    const b = rangeBounds(target);
    const ids: string[] = [];
    for (let r = b.top; r <= b.bottom; r++) {
      const hit = planContext.rowAt(r);
      if (hit) ids.push(hit.rowId);
    }
    return ids;
  };
  const copyCells = async (target: GridRange) => {
    const matrix = rangeText(target, planContext, fieldText);
    if (!matrix.length) return;
    const ok = await writeClipboard(toTsv(matrix), toHtmlTable(matrix));
    editing.setStatus(ok ? { tone: "success", text: `已复制 ${rangeCellCount(target)} 格，可粘贴到 Excel / 飞书 / 本表` } : { tone: "error", text: "浏览器不允许写剪贴板，请用 Ctrl + C" });
  };
  const pasteFromMenu = async (target: GridRange) => {
    const text = await readClipboard();
    if (text === null) return editing.setStatus({ tone: "error", text: "浏览器不允许读剪贴板，请用 Ctrl + V" });
    if (text) pasteText(text, target);
  };
  /** Right click / Shift + F10 on a cell, a group row or a header. False = no menu here (the browser's shows). */
  const openContextMenu = (node: HTMLElement, point: { x: number; y: number }, keyboard: boolean): boolean => {
    if (!interactive || !node.dataset.cell) return false;
    const [r, c] = node.dataset.cell.split(":").map(Number) as [number, number];
    if (r === -1) {
      const key = cols[c]?.id;
      if (!key || !byKey.has(key)) return false;
      setHeaderMenu({ key, anchor: node, point: keyboard ? undefined : point });
      return true;
    }
    if (Number.isNaN(r) || r >= count) return false;
    const item = itemAt(r);
    if (item.kind === "group") {
      const folded = view.collapsed.includes(item.key);
      setCellMenu({
        point, keyboard, returnTo: node, label: "分组菜单",
        sections: gridGroupMenu({
          collapsed: folded,
          canAdd: addRows && view.groupBy.length > 0,
          on: {
            toggle: () => dispatch({ type: "toggleGroup", key: item.key }),
            collapseAll: () => dispatch({ type: "setCollapsed", keys: groupKeys }),
            expandAll: () => dispatch({ type: "setCollapsed", keys: [] }),
            add: () => props.onAddRow?.(groupValues(item.group, view.groupBy)),
          },
        }),
      });
      return true;
    }
    if (item.kind !== "row") return false;
    const col = Number.isNaN(c) ? cell.col : c;
    const here = { row: r, col };
    const inRange = Boolean(range && rangeContains(range, here));
    const menuRange: GridRange = inRange && range ? range : fieldAt(col) ? { anchor: here, focus: here } : { anchor: { row: r, col: firstDataCol }, focus: { row: r, col: lastDataCol } };
    if (!inRange) {
      setAnchor(null);
      setActive(here);
    }
    const returnTo = inRange ? scrollRef.current?.querySelector<HTMLElement>(`[data-cell="${cell.row}:${cell.col}"]`) ?? node : node;
    const ids = menuRowIds(item.id, selected, rangeRowIds(menuRange));
    const context: GridCellMenuContext<T> = { row: item.row, rowId: item.id, field: fieldAt(col), rowIds: ids, cells: rangeCellCount(menuRange) };
    setCellMenu({
      point, keyboard, returnTo, label: `${primaryText(item.row)}的菜单`,
      sections: gridCellMenu({
        rowCount: ids.length,
        canPaste: editing.enabled,
        canInsert: Boolean(props.onRowsInsert),
        canDuplicate: Boolean(props.onRowsDuplicate),
        canDelete: Boolean(props.onRowsDelete),
        canExpand: Boolean(recordOptions),
        extra: props.cellMenuItems?.(context) ?? [],
        on: {
          copy: () => void copyCells(menuRange),
          paste: () => void pasteFromMenu(menuRange),
          insert: (position) => props.onRowsInsert?.(position, item.id),
          duplicate: () => props.onRowsDuplicate?.(ids),
          expand: () => openRecord(item.id),
          remove: () => props.onRowsDelete?.(ids),
        },
      }),
    });
    return true;
  };

  // ---- keyboard
  /** Enter on a cell with links / chips / buttons: move into them (Tab cycles inside, Esc returns). */
  const enterCell = (cellNode: HTMLElement) => {
    const controls = [...cellNode.querySelectorAll<HTMLElement>(CELL_CONTROLS)];
    if (!controls.length) return false;
    cellNode.dataset.inside = "true";
    for (const node of controls) node.tabIndex = 0;
    controls[0]!.focus();
    const leave = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && cellNode.contains(event.relatedTarget)) return;
      delete cellNode.dataset.inside;
      for (const node of controls) node.tabIndex = -1;
      cellNode.removeEventListener("focusout", leave);
    };
    cellNode.addEventListener("focusout", leave);
    return true;
  };
  const openRecord = (id: string) => {
    if (recordOptions) expand.open(id);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".aui-grid-editor")) return;
    const cellNode = target.closest<HTMLElement>("[data-cell]");
    if (!cellNode || !scrollRef.current?.contains(cellNode)) return;
    if (target !== cellNode) {
      // Inside a cell (its links / buttons): Tab cycles within the cell, Esc goes back to the cell.
      if (event.key === "Escape") {
        event.preventDefault();
        cellNode.focus();
      } else if (event.key === "Tab" && cellNode.dataset.inside) {
        const controls = [...cellNode.querySelectorAll<HTMLElement>(CELL_CONTROLS)];
        const at = controls.indexOf(target);
        if (controls.length) {
          event.preventDefault();
          controls[(at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]!.focus();
        }
      }
      return;
    }
    const [r, c] = cellNode.dataset.cell!.split(":").map(Number) as [number, number];
    const here = { row: r, col: Number.isNaN(c) ? cell.col : c };
    const column = cols[here.col];
    if (event.altKey && here.row === -1 && column && byKey.has(column.id) && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      dispatch({ type: "resize", key: column.id, width: column.getSize() + (event.key === "ArrowLeft" ? -16 : 16) });
      return;
    }
    // bt/grid-b: Shift + F10 / menu key → header or cell menu; Alt + Shift + ↑ / ↓ moves the record.
    if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
      const box = cellNode.getBoundingClientRect();
      if (openContextMenu(cellNode, { x: box.left + 4, y: box.bottom }, true)) event.preventDefault();
      return;
    }
    if (event.altKey && event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      moveRowByKey(here.row, event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    const page = Math.max(1, Math.floor((viewport - headerHeight - footerHeight) / rowHeight) - 1);
    const next = moveGridCell(here, event.key, { rows: rowCount, cols: cols.length, page }, { ctrl: event.ctrlKey || event.metaKey });
    if (next) {
      event.preventDefault();
      const extend = event.shiftKey && here.row >= 0 && here.row < count && next.row >= 0 && next.row < count;
      moveTo(next, extend);
      return;
    }
    let action = gridKeyAction(event);
    if (!action) return;
    const item = here.row >= 0 && here.row < count ? itemAt(here.row) : null;
    const field = fieldAt(here.col);
    // bt/grid-b: insert / open / fill-down shortcuts; Shift + Enter stays 「edit」 when rows cannot be inserted.
    if (action === "insertBelow" || action === "insertAbove") {
      if (props.onRowsInsert && item?.kind === "row") {
        event.preventDefault();
        props.onRowsInsert(action === "insertAbove" ? "above" : "below", item.id);
        return;
      }
      if (action === "insertAbove") return;
      action = "edit";
    }
    if (action === "openRecord") {
      if (item?.kind !== "row" || !recordOptions) return;
      event.preventDefault();
      openRecord(item.id);
      return;
    }
    if (action === "fillDown") {
      event.preventDefault();
      const plan = effectiveRange && fillDownTarget(effectiveRange);
      if (plan && editing.enabled) applyFill(plan.source, plan.target);
      return;
    }
    if (column?.id === GRID_ADD_COLUMN && here.row === -1 && (action === "edit" || action === "expand")) {
      event.preventDefault();
      props.onAddField?.();
      return;
    }
    if (item?.kind === "add" && (action === "edit" || action === "expand")) {
      event.preventDefault();
      props.onAddRow?.(item.group);
      return;
    }
    switch (action) {
      case "undo":
      case "redo":
        if (!editing.enabled) return;
        event.preventDefault();
        if (action === "undo") editing.undo();
        else editing.redo();
        return;
      case "selectAll":
        if (!count) return;
        event.preventDefault();
        setAnchor({ row: 0, col: firstDataCol });
        setActive({ row: count - 1, col: lastDataCol });
        focusPending.current = true;
        return;
      case "escape":
        if (anchor) {
          event.preventDefault();
          setAnchor(null);
        }
        return;
      case "clear":
        if (!item || !editing.enabled) return;
        event.preventDefault();
        clearRange();
        return;
      case "type":
        if (field && item?.kind === "row" && canEditCell(here.row, here.col) && field.type !== "checkbox") {
          event.preventDefault();
          startEdit(here.row, here.col, event.key);
        }
        return;
      case "toggleRow":
        if (item?.kind === "row" && selectable && canSelect(item.row)) {
          event.preventDefault();
          shift.current = false;
          toggleRow(item.id, !selectedSet.has(item.id));
        }
        return;
      case "expand":
      case "edit": {
        // Header, summary row, group rows and the special columns first.
        if (here.row === -1 && column && byKey.has(column.id)) {
          event.preventDefault();
          if (action === "edit") setHeaderMenu({ key: column.id, anchor: cellNode });
          return;
        }
        if (here.row === -1 && column?.id === GRID_ROW_COLUMN && selectable && action === "expand") {
          event.preventDefault();
          props.onSelectionChange?.(checkedCount === selectableIds.length ? selected.filter((id) => !selectableIds.includes(id)) : [...new Set([...selected, ...selectableIds])]);
          return;
        }
        if (here.row === count && summary && column && byKey.has(column.id)) {
          event.preventDefault();
          setPopover({ kind: "summary", key: column.id, anchor: cellNode });
          return;
        }
        if (!item) return;
        event.preventDefault();
        if (item.kind === "group") return dispatch({ type: "toggleGroup", key: item.group.key });
        if (item.kind === "loading") return item.error ? remote.retry() : undefined;
        if (item.kind === "add") return;
        if (column?.id === GRID_ROW_COLUMN) {
          if (action === "expand" && selectable && canSelect(item.row)) {
            shift.current = event.shiftKey;
            toggleRow(item.id, !selectedSet.has(item.id));
          } else openRecord(item.id);
          return;
        }
        if (column?.id === GRID_ACTIONS_COLUMN) {
          cellNode.querySelector<HTMLButtonElement>("button")?.click();
          return;
        }
        if (action === "expand") return openRecord(item.id);
        // Enter / F2: edit → toggle checkbox → go into the cell's links / chips → open the record.
        if (field && canEditCell(here.row, here.col)) {
          if (field.type === "checkbox") toggleCheckbox(here.row, here.col);
          else startEdit(here.row, here.col);
          return;
        }
        if (enterCell(cellNode)) return;
        openRecord(item.id);
        return;
      }
    }
  };

  // ---- rendering
  const colCount = cols.length;
  const ariaRowCount = count + 1 + (summary ? 1 : 0);
  const pinStyle = (id: string): CSSProperties => {
    const column = table.getColumn(id);
    const pinned = column?.getIsPinned();
    if (pinned === "start") return { position: "sticky", left: column!.getStart("start") };
    if (pinned === "end") return { position: "sticky", right: column!.getAfter("end") };
    return {};
  };
  const lastStart = start.at(-1)?.id;
  const firstEnd = end[0]?.id;
  const cellAttrs = (row: number, col: number, id: string) => ({
    "data-cell": `${row}:${col}`,
    tabIndex: cell.row === row && cell.col === col ? 0 : -1,
    "aria-colindex": col + 1,
    "data-pin": table.getColumn(id)?.getIsPinned() || undefined,
    "data-pin-edge": id === lastStart ? "start" : id === firstEnd ? "end" : undefined,
    style: { width: table.getColumn(id)?.getSize(), ...pinStyle(id) } as CSSProperties,
  });

  const freezeGrip = (
    <span className="aui-grid-freeze-grip" role="separator" aria-orientation="vertical" data-dragging={freeze.preview ? true : undefined}
      aria-label={`冻结线：已冻结 ${frozenCount} 列。拖动调整，或在字段菜单里选「冻结至此列」`} data-tip="拖动冻结线：向右多冻结几列，拖到最左解除冻结"
      onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} {...freeze.handlers}>
      <GripVertical aria-hidden="true" />
    </span>
  );
  const fieldActionsOf = (field: GridField<T>) => (props.onFieldAction ? (typeof props.fieldActions === "function" ? props.fieldActions(field) : props.fieldActions ?? ALL_FIELD_ACTIONS) : []);
  const edgesOf = (row: number, col: number) => {
    const box = fillBox ?? rangeBox;
    if (!box || row < box.top || row > box.bottom || col < box.left || col > box.right) return undefined;
    return [row === box.top && "t", row === box.bottom && "b", col === box.left && "l", col === box.right && "r"].filter(Boolean).join(" ") || "in";
  };

  const header = (
    <div role="row" aria-rowindex={1} className="aui-grid-row aui-grid-header-row" ref={headRow} style={{ height: headerHeight, width: totalWidth }}>
      {cols.map((column, col) => {
        if (column.id === GRID_ROW_COLUMN)
          return (
            <div key={column.id} role="columnheader" className="aui-grid-hcell aui-grid-rownum-cell" data-lead-col {...cellAttrs(-1, col, column.id)}>
              {frozenCount === 0 && freezeGrip}
              {selectable ? (
                <Checkbox aria-label="选择全部记录" disabled={!interactive || !selectableIds.length}
                  checked={checkedCount && checkedCount === selectableIds.length ? true : checkedCount ? "indeterminate" : false}
                  onCheckedChange={(v) => props.onSelectionChange?.(v ? [...new Set([...selected, ...selectableIds])] : selected.filter((id) => !selectableIds.includes(id)))} />
              ) : <span className="aui-sr-only">序号</span>}
            </div>
          );
        if (column.id === GRID_ACTIONS_COLUMN)
          return <div key={column.id} role="columnheader" className="aui-grid-hcell" {...cellAttrs(-1, col, column.id)}><span className="aui-sr-only">操作</span></div>;
        if (column.id === GRID_ADD_COLUMN)
          return (
            <div key={column.id} role="columnheader" className="aui-grid-hcell aui-grid-add-col" {...cellAttrs(-1, col, column.id)}>
              <button type="button" className="aui-grid-add-field" aria-label="添加字段" data-tip="添加字段" onClick={(event) => { event.stopPropagation(); props.onAddField?.(); }}><Plus aria-hidden="true" /></button>
            </div>
          );
        const field = byKey.get(column.id)!;
        const Icon = FIELD_ICONS[field.type];
        const sortIndex = view.sort.findIndex((s) => s.key === field.key);
        const sort = view.sort[sortIndex];
        const resize = headers.get(column.id)?.getResizeHandler();
        return (
          <div key={column.id} role="columnheader" className="aui-grid-hcell" data-field-key={field.key} data-numeric={field.type === "number" || field.type === "money" || undefined}
            aria-sort={sortIndex === 0 ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
            aria-haspopup="menu" aria-label={`${field.title}${field.locked ? "，有权限限制" : ""}${sort ? `，${sort.direction === "asc" ? "升序" : "降序"}${view.sort.length > 1 ? `第 ${sortIndex + 1} 优先` : ""}` : ""}，回车打开字段菜单`}
            aria-description={field.description || undefined}
            data-dragging={drop && drag.current?.key === field.key ? true : undefined}
            data-menu-open={headerMenu?.key === field.key || undefined}
            {...cellAttrs(-1, col, column.id)}
            onClick={(event) => openColumnMenu(field.key, event.currentTarget)}
            onDoubleClick={() => {
              if (!props.onFieldAction || !fieldActionsOf(field).includes("edit")) return;
              setHeaderMenu(null);
              props.onFieldAction("edit", field);
            }}
            onPointerDown={(event) => onHeaderPointerDown(event, field.key)}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onPointerCancel={() => { drag.current = null; setDrop(null); }}>
            <Icon className="aui-grid-hicon" aria-hidden="true" />
            <span className="aui-grid-htitle">{field.title}</span>
            {field.locked && <span className="aui-grid-hbadge" data-kind="lock" data-tip={typeof field.locked === "string" ? field.locked : "有权限限制"} aria-hidden="true"><Lock /></span>}
            {field.description && <span className="aui-grid-hbadge" data-kind="info" data-tip={field.description} aria-hidden="true"><Info /></span>}
            {sort && <span className="aui-grid-hsort" aria-hidden="true">{view.sort.length > 1 && <span>{sortIndex + 1}</span>}{sort.direction === "asc" ? <ArrowUp /> : <ArrowDown />}</span>}
            <ChevronDown className="aui-grid-hmenu" aria-hidden="true" />
            {resize && (
              <span className="aui-grid-resizer" role="separator" aria-orientation="vertical" aria-label={`调整「${field.title}」列宽（表头上按 Alt + ← / →）`}
                aria-valuenow={Math.round(column.getSize())} aria-valuemin={60} aria-valuemax={800}
                data-resizing={column.getIsResizing?.() || undefined}
                onMouseDown={(event) => { event.stopPropagation(); resize(event); }}
                onTouchStart={(event) => { event.stopPropagation(); resize(event); }}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => { event.stopPropagation(); dispatch({ type: "resize", key: field.key, width: defaultFieldWidth(field) }); }} />
            )}
            {frozenCount > 0 && field.key === frozenKeys.at(-1) && freezeGrip}
          </div>
        );
      })}
      {drop && <span className="aui-grid-drop" aria-hidden="true" style={{ left: drop.x }} />}
      {freeze.preview && <span className="aui-grid-freeze-preview" aria-hidden="true" style={{ left: freeze.preview.x, height: Math.max(headerHeight, viewport - footerHeight) }} />}
    </div>
  );

  // Group headers: each column's statistic for the group (the summary chosen in the bottom bar).
  const startWidth = start.reduce((sum, column) => sum + column.getSize(), 0);
  const groupSummaryFields = summary && view.groupBy.length ? cols.filter((column) => byKey.has(column.id) && view.summary[column.id] && view.summary[column.id] !== "none" && view.summary[column.id] !== "count" && (!server || (caps?.summaries ?? []).includes(view.summary[column.id]!))) : [];
  // Client mode: a group's statistics are computed once per tree (not on every scroll / hover render).
  const groupSummaryCache = useMemo(() => new Map<string, string>(), [clientTree, view.summary, fields]);
  const clientGroupSummary = (group: GridGroup<T>, field: GridField<T>, kind: GridSummaryKind) => {
    const cacheKey = `${group.key}\u0000${field.key}\u0000${kind}`;
    let text = groupSummaryCache.get(cacheKey);
    if (text === undefined) groupSummaryCache.set(cacheKey, (text = summarizeField(field, group.rows ?? [], kind).text));
    return text;
  };
  const groupSummaryCells = (group: GridGroup<T>): GridGroupSummaryCell[] =>
    cols.slice(start.length).map((column, i) => {
      const field = byKey.get(column.id);
      const kind = field ? view.summary[field.key] : undefined;
      const shown = field && kind && groupSummaryFields.includes(column);
      const text = shown ? (server ? group.summaries?.[field.key] : clientGroupSummary(group, field, kind)) : undefined;
      return { id: column.id, colIndex: start.length + i + 1, numeric: field ? field.type === "number" || field.type === "money" : undefined, label: shown ? summaryLabel(kind, field.type) : undefined, text, style: { width: column.getSize(), ...pinStyle(column.id) }, pin: column.getIsPinned() || undefined, edge: column.id === firstEnd ? "end" : undefined };
    });
  const body = virtualItems.map((virtual) => {
    const item = itemAt(virtual.index);
    const top = virtual.start - headerHeight;
    const rowStyle = { height: virtual.size, transform: `translateY(${top}px)`, width: totalWidth };
    if (item.kind === "group") {
      const group = item.group;
      return (
        <GridGroupRow key={item.id} group={group} field={byKey.get(group.field)} index={virtual.index} style={rowStyle} folded={view.collapsed.includes(group.key)}
          cellId={`${virtual.index}:${cell.col}`} tabbable={cell.row === virtual.index} colCount={colCount} startCount={start.length} startWidth={startWidth}
          summaries={groupSummaryFields.length ? groupSummaryCells(group) : null} onToggle={() => dispatch({ type: "toggleGroup", key: group.key })} />
      );
    }
    if (item.kind === "add") {
      return (
        <div key={item.id} role="row" aria-rowindex={virtual.index + 2} className="aui-grid-row aui-grid-add-row" data-row-index={virtual.index} style={rowStyle}>
          <div role="gridcell" aria-colindex={1} aria-colspan={colCount} className="aui-grid-add-row-cell" data-cell={`${virtual.index}:${cell.col}`}
            tabIndex={cell.row === virtual.index ? 0 : -1} onClick={() => props.onAddRow?.(item.group)}>
            <span className="aui-grid-add-row-inner">
              <span className="aui-grid-add-row-icon" style={{ width: cols[0]?.getSize() }}><Plus aria-hidden="true" /></span>
              <span>新增一行</span>
              {item.node && <span className="aui-grid-add-row-hint">自动带上 {item.node.path.map((value, i) => { const field = byKey.get(view.groupBy[i]?.field ?? ""); return field ? gridGroupLabel(field, value) : value; }).join(" · ")}</span>}
            </span>
          </div>
        </div>
      );
    }
    if (item.kind === "loading") {
      return (
        <div key={item.id} role="row" aria-rowindex={virtual.index + 2} className="aui-grid-row aui-grid-loading-row" data-row-index={virtual.index} data-error={item.error ? true : undefined} style={rowStyle}>
          {cols.map((column, col) => (
            <div key={column.id} role="gridcell" className="aui-grid-cell" {...cellAttrs(virtual.index, col, column.id)}>
              {col === 0 ? <span className="aui-grid-rownum">{virtual.index + 1}</span>
                : item.error && col === 1 ? <span className="aui-grid-load-error">加载失败，回车重试</span>
                : <span className="aui-grid-skeleton" aria-hidden="true" />}
            </div>
          ))}
        </div>
      );
    }
    const row = item.row;
    const id = item.id;
    const isSelected = selectedSet.has(id);
    const number = numberOf?.get(id) ?? serverNumber(virtual.index);
    const rowFill = view.colors.length ? gridRowFill(row, view.colors, byKey, conditionContext) : null;
    const editingHere = edit !== null && edit.rowId === id;
    return (
      <div key={id} role="row" aria-rowindex={virtual.index + 2} aria-selected={selectable ? isSelected : undefined} className="aui-grid-row" data-row-key={id} data-row-index={virtual.index}
        data-selected={isSelected || undefined} data-active={cell.row === virtual.index || undefined} data-editing={editingHere || undefined}
        data-fill={rowFill?.row} data-fill-row={handleBox?.bottom === virtual.index || undefined} data-dragging={rowDrag.dragging === id || undefined}
        style={rowStyle}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button, a, [role=checkbox], .aui-grid-editor")) return;
          const node = target.closest<HTMLElement>("[data-cell]");
          const col = node ? Number(node.dataset.cell!.split(":")[1]) : -1;
          if (col >= 0 && canEditCell(virtual.index, col) && fieldAt(col)?.type !== "checkbox") startEdit(virtual.index, col);
          else openRecord(id);
        }}>
        {cols.map((column, col) => {
          if (column.id === GRID_ROW_COLUMN)
            return (
              <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-rownum-cell" {...cellAttrs(virtual.index, col, column.id)}>
                <span className="aui-grid-rownum">{number}</span>
                <span className="aui-grid-rownum-tools">
                  {rowMoveEnabled && (
                    <span className="aui-grid-row-grip" aria-hidden="true" data-tip="拖动调整顺序（Alt + Shift + ↑ / ↓）" onPointerDown={rowDrag.start(id)}>
                      <GripVertical />
                    </span>
                  )}
                  {selectable && (
                    <Checkbox aria-label={`选择 ${primaryText(row)}`} checked={isSelected} disabled={!canSelect(row)}
                      onPointerDown={(event) => { shift.current = event.shiftKey; }}
                      onKeyDown={(event) => { shift.current = event.shiftKey; }}
                      onCheckedChange={(v) => toggleRow(id, v === true)} />
                  )}
                  {recordOptions && !primary && (
                    <button type="button" className="aui-grid-expand" aria-label={`展开记录 ${primaryText(row)}`} aria-haspopup="dialog" onClick={() => expand.open(id)}>
                      <Maximize2 aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
            );
          if (column.id === GRID_ADD_COLUMN) return <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-add-col" {...cellAttrs(virtual.index, col, column.id)} />;
          if (column.id === GRID_ACTIONS_COLUMN)
            return (
              <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-actions-cell" {...cellAttrs(virtual.index, col, column.id)}>
                <RowActions label={`${primaryText(row)}的更多操作`} actions={props.rowActions!(row)} />
              </div>
            );
          const field = byKey.get(column.id)!;
          const here = { row: virtual.index, col };
          const isEditing = editingHere && edit!.col === col;
          const editable = canEditCell(virtual.index, col);
          const badge = props.cellBadge?.(row, field);
          const corner = handleBox && handleBox.bottom === virtual.index && handleBox.right === col;
          return (
            <div key={column.id} role={field === primary ? "rowheader" : "gridcell"} className="aui-grid-cell" data-type={field.type}
              data-numeric={field.type === "number" || field.type === "money" || undefined} data-primary={field === primary || undefined}
              data-in-range={range && rangeContains(range, here) ? true : undefined}
              data-edge={edgesOf(virtual.index, col)} data-fill-preview={fillBox && edgesOf(virtual.index, col) ? true : undefined}
              data-tone={gridCellTone(field, row)} data-col-menu={headerMenu?.key === field.key || undefined} data-fill-corner={corner || undefined}
              data-editable={editable || undefined} data-editing={isEditing || undefined}
              data-saving={editing.cellState(id, field.key) ?? undefined} data-fill={rowFill?.cells[field.key]}
              aria-readonly={editing.enabled && !editable ? true : undefined}
              {...cellAttrs(virtual.index, col, column.id)}
              onPointerDown={(event) => onCellPointerDown(event, virtual.index, col)}
              onClick={(event) => {
                if (field.type === "checkbox" && editable && (event.target as HTMLElement).closest(".aui-grid-check")) toggleCheckbox(virtual.index, col);
                if (field.type === "rating" && editable && !isEditing) setRating(virtual.index, col, (event.target as Element).closest(".aui-rating-star"));
              }}>
              {isEditing ? (
                <>
                  <div className="aui-cell">{field.type === "singleSelect" || field.type === "multiSelect" || field.type === "user" ? renderGridCell(field, row, { selected: isSelected }) : null}</div>
                  <EditorHost cellId={`${virtual.index}:${col}`} box={scrollRef}>
                    {(anchorNode) => (
                      <Suspense fallback={null}>
                        <GridCellEditor field={field} row={row} startText={edit!.startText} anchor={anchorNode} people={props.peopleOptions?.[field.key]} error={edit!.error}
                          onCommit={(value, move) => finishEdit(value, move)} onCancel={() => finishEdit(null, "none")} />
                      </Suspense>
                    )}
                  </EditorHost>
                </>
              ) : (
                <div className="aui-cell">{renderGridCell(field, row, { selected: isSelected })}</div>
              )}
              {field === primary && recordOptions && !isEditing && (
                <button type="button" className="aui-grid-expand aui-grid-expand-inline" aria-label={`展开记录 ${primaryText(row)}`} aria-haspopup="dialog" data-tip="展开记录（Ctrl + E）" onClick={() => expand.open(id)}>
                  <Maximize2 aria-hidden="true" />
                </button>
              )}
              {badge && <><span className="aui-grid-badge" data-tone={badge.tone ?? "warning"} data-tip={badge.label} aria-hidden="true" /><span className="aui-sr-only">，{badge.label}</span></>}
              {corner && effectiveRange && <span className="aui-grid-fill-handle" aria-hidden="true" data-tip="拖动填充（Ctrl + D 向下填充）" onPointerDown={fill.start(effectiveRange)} />}
            </div>
          );
        })}
      </div>
    );
  });

  const summaries = useMemo(() => {
    if (!summary || server) return new Map<string, ReturnType<typeof summarizeField>>();
    return new Map(visibleKeys.flatMap((key) => {
      const kind = view.summary[key];
      return kind && kind !== "none" ? [[key, summarizeField(byKey.get(key)!, filtered, kind)] as const] : [];
    }));
  }, [summary, server, visibleKeys.join("|"), view.summary, filtered, byKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const serverSummary = (key: string): { label: string; text: string } | undefined => {
    const kind = view.summary[key];
    const field = byKey.get(key);
    if (!kind || kind === "none" || !field) return undefined;
    if (kind === "count") return { label: summaryLabel(kind, field.type), text: String(remote.total ?? "—") };
    const text = remote.state.summaries?.[key];
    return text === undefined ? undefined : { label: summaryLabel(kind, field.type), text };
  };
  const totalText = server ? `${remote.total ?? 0} 条` : `${filtered.length} 条`;
  const firstFieldId = cols.find((column) => byKey.has(column.id))?.id;
  const countInField = firstFieldId !== undefined && !(server ? serverSummary(firstFieldId) : summaries.get(firstFieldId));
  const footer = summary && (
    <div role="row" aria-rowindex={ariaRowCount} className="aui-grid-row aui-grid-summary-row" style={{ height: footerHeight, width: totalWidth }}>
      {cols.map((column, col) => {
        if (column.id === GRID_ROW_COLUMN)
          // The 48px row-number column is too narrow for 「2000 条」: the count goes into the first field's cell when that
          // field has no statistic of its own (「24 条记录」), else it stays here.
          return <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-summary-cell aui-grid-rownum-cell" {...cellAttrs(count, col, column.id)}>{countInField ? <span className="aui-sr-only">{totalText}</span> : <span className="aui-grid-summary-total">{totalText}</span>}</div>;
        if (column.id === GRID_ACTIONS_COLUMN || column.id === GRID_ADD_COLUMN) return <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-summary-cell" {...cellAttrs(count, col, column.id)} />;
        const field = byKey.get(column.id)!;
        const result = server ? serverSummary(field.key) : summaries.get(field.key);
        return (
          <div key={column.id} role="gridcell" className="aui-grid-cell aui-grid-summary-cell" data-field-key={field.key} data-numeric={field.type === "number" || field.type === "money" || undefined}
            data-empty={!result || undefined} data-tip={result ? `${result.label} ${result.text}` : undefined} aria-haspopup="dialog" aria-label={result ? `${field.title}${result.label}：${result.text}` : `${field.title}：未统计，回车选择统计方式`}
            {...cellAttrs(count, col, column.id)}
            onClick={(event) => setPopover({ kind: "summary", key: field.key, anchor: event.currentTarget })}>
            {result ? <><span className="aui-grid-summary-label">{result.label}</span><span className="aui-grid-summary-value">{result.text}</span></> : countInField && column.id === firstFieldId ? <span className="aui-grid-summary-total" aria-hidden="true">{totalText.replace(/ 条$/, " 条记录")}</span> : <span className="aui-grid-summary-label">统计</span>}
          </div>
        );
      })}
    </div>
  );

  const popField = popover ? byKey.get(popover.key) : undefined;
  const menuAction = (action: GridViewAction) => {
    dispatch(action);
    closePopover(true);
  };
  const menuField = headerMenu ? byKey.get(headerMenu.key) : undefined;
  const headerSections = menuField ? gridHeaderMenu({
    field: menuField,
    primary: menuField === primary,
    index: visibleKeys.indexOf(menuField.key),
    visibleCount: visibleKeys.length,
    sort: view.sort.find((s) => s.key === menuField.key)?.direction ?? null,
    canSort: (!server || caps?.sort !== false) && props.toolbarFeatures?.sort !== false,
    canFilter: (!server || caps?.filter !== false) && props.toolbarFeatures?.filter !== false,
    canGroup: (!server || serverGroups) && props.toolbarFeatures?.group !== false,
    grouped: isGroupedBy(view, menuField.key),
    frozen: frozenCount,
    canFreeze: true,
    actions: fieldActionsOf(menuField),
    extra: props.headerMenuItems?.(menuField) ?? [],
    on: {
      sort: (direction) => dispatch({ type: "sortBy", key: menuField.key, direction }),
      filter: () => {
        if (props.onFilterByField) return props.onFilterByField(menuField);
        dispatch({ type: "addFilter", field: menuField.key });
        editing.setStatus({ tone: "success", text: `已添加「${menuField.title}」的筛选条件，在工具栏「筛选」里填写` });
      },
      // bt/grid-a: 「按此字段分组」 adds a level (up to the limit; replaces the last when full), 「取消分组」 removes this level.
      group: (on) => {
        const max = props.limits?.maxGroupLevels ?? GRID_LIMITS.maxGroupLevels;
        const others = view.groupBy.filter((level) => level.field !== menuField.key);
        dispatch({ type: "setGroups", levels: on ? [...others.slice(0, Math.max(0, max - 1)), { field: menuField.key, order: "asc" }] : others });
      },
      hide: () => dispatch({ type: "toggleHidden", key: menuField.key, hidden: true }),
      freeze: (n) => dispatch({ type: "freeze", count: n }),
      move: (to) => dispatch(to === "left" || to === "right" ? { type: "shift", key: menuField.key, delta: to === "left" ? -1 : 1 } : { type: "moveBefore", key: menuField.key, before: to === "first" ? visibleKeys.filter((key) => key !== menuField.key)[1] ?? null : null }),
      action: (kind) => props.onFieldAction?.(kind, menuField),
    },
  }) : [];
  const valueOptions = useMemo(() => Object.fromEntries(fields.filter((f) => f.type === "user").map((f) => {
    const given = props.peopleOptions?.[f.key];
    const names = given ? given.map((p) => p.name) : [...new Set(sourceRows.flatMap((row) => toPeople(readField(f, row)).map((p) => p.name)))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return [f.key, names.map((name) => ({ value: name, label: name }))];
  })), [fields, sourceRows, props.peopleOptions]);
  const total = server ? remote.total ?? 0 : sourceRows.length;
  const matched = server ? remote.total ?? 0 : filtered.length;
  const emptyKind = (server ? true : sourceRows.length > 0) && (activeFilterCount(view, fields) || view.search.trim()) ? "no-results" : "empty";
  const serverSummaryKinds = caps?.summaries ?? [];
  const editTools = editing.enabled ? (
    <span className="aui-grid-history" role="group" aria-label="撤销与重做">
      <IconButton label="撤销（Ctrl + Z）" disabled={!editing.canUndo} onClick={editing.undo} icon={<Undo2 />} />
      <IconButton label="重做（Ctrl + Y）" disabled={!editing.canRedo} onClick={editing.redo} icon={<Redo2 />} />
    </span>
  ) : null;
  const refreshTool = server ? <IconButton label="刷新" onClick={() => { remote.refresh(); remoteGroups.refresh(); }} icon={<RefreshCw />} /> : null;
  const toolbar = props.toolbar === false ? null : props.toolbar !== undefined && props.toolbar !== true ? props.toolbar : (
    <GridToolbar fields={fields} view={view} onViewChange={commit} total={total} matched={matched} groupKeys={groupKeys} actions={props.actions} leading={props.toolbarLeading}
      quickFilters={props.toolbarQuick} searchMode={props.toolbarSearch} more={props.toolbarMore}
      valueOptions={valueOptions} tools={<>{editTools}{refreshTool}</>}
      limits={props.limits} dynamicTokens={props.dynamicTokens} timeZone={conditionContext?.timeZone} onSaveAsView={props.onSaveAsView} panelNote={props.panelNote}
      onCreateField={props.onCreateField} onCreateFieldGroup={props.onCreateFieldGroup} server={server}
      features={{
        search: (!server || caps?.search !== false) && props.toolbarFeatures?.search !== false,
        filter: (!server || caps?.filter !== false) && props.toolbarFeatures?.filter !== false,
        sort: (!server || caps?.sort !== false) && props.toolbarFeatures?.sort !== false,
        group: (!server || serverGroups) && props.toolbarFeatures?.group !== false,
        fields: props.toolbarFeatures?.fields !== false,
        color: props.toolbarFeatures?.color !== false,
        rowHeight: props.toolbarFeatures?.rowHeight !== false,
      }} />
  );
  const status = editing.status;
  // a cell someone else saved first keeps their value; mine can be put back or forced.
  const renderConflict = (conflict: GridStatusConflict) => {
    const field = byKey.get(conflict.change.field);
    const show = (value: unknown) => (field ? valueText(field, value) : String(value ?? "")) || "（空）";
    const row = displayIndexOf(conflict.change.rowId);
    const col = cols.findIndex((column) => column.id === conflict.change.field);
    return (
      <Suspense fallback={null}>
      <EditConflictNotice
        compact
        by={conflict.by}
        at={conflict.at}
        what={field ? `「${field.title}」` : undefined}
        theirs={show(conflict.theirs)}
        mine={show(conflict.change.value)}
        onDismiss={() => editing.setStatus(null)}
        onRefill={row >= 0 && col >= 0 ? () => {
          editing.setStatus(null);
          startEdit(row, col, field ? valueText(field, conflict.change.value) : String(conflict.change.value ?? ""));
        } : undefined}
        onOverwrite={async () => {
          editing.setStatus(null);
          await editing.apply([conflict.change as GridCellChange<T>], "edit", { label: `修改「${field?.title ?? ""}」`, overwrite: true });
        }}
      />
      </Suspense>
    );
  };

  return (
    <div ref={panelRef} className="aui-grid-panel" data-row-height={view.rowHeight} data-editable={editing.enabled || undefined} aria-busy={busy || undefined}
      style={{ "--aui-row-lines": lines, "--aui-grid-row-h": `${rowHeight}px` } as CSSProperties}>
      {toolbar}
      {props.banner}
      <div className="aui-grid-frame">
        <div ref={scrollRef} id={gridId} className="aui-grid-scroll" role="grid" aria-label={caption} aria-rowcount={ariaRowCount} aria-colcount={colCount}
          aria-multiselectable={selectable || undefined} aria-readonly={editing.enabled ? undefined : true} style={{ height: boxHeight, scrollPaddingTop: headerHeight, scrollPaddingBottom: footerHeight }}
          onKeyDown={onKeyDown} onCopy={onCopy} onCut={onCut} onPaste={onPaste}
          onMouseDown={(event) => {
            // Right click: no native focus scroll (it would close the menu); inside the selected range the range stays.
            const node = event.button === 2 ? (event.target as HTMLElement).closest<HTMLElement>("[data-cell]") : null;
            if (!node || node.closest(".aui-grid-editor") || !scrollRef.current?.contains(node)) return;
            event.preventDefault();
            const [r, c] = node.dataset.cell!.split(":").map(Number) as [number, number];
            if (!(range && rangeContains(range, { row: r, col: c }))) node.focus({ preventScroll: true });
          }}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest(".aui-grid-editor, input, textarea")) return;
            const node = target.closest<HTMLElement>("[data-cell]");
            if (node && scrollRef.current?.contains(node) && openContextMenu(node, { x: event.clientX, y: event.clientY }, false)) event.preventDefault();
          }}
          onBlur={(event) => {
            if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setFocusWithin(false);
          }}
          onFocus={(event) => {
            setFocusWithin(true);
            const node = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]");
            if (!node || !scrollRef.current?.contains(node) || (event.target as HTMLElement).closest(".aui-grid-editor")) return;
            const [r, c] = node.dataset.cell!.split(":").map(Number) as [number, number];
            if (r !== cell.row || c !== cell.col) setActive({ row: r, col: Number.isNaN(c) ? cell.col : c });
          }}>
          <div className="aui-grid-canvas" style={{ width: canvasWidth }}>
            <div role="rowgroup" className="aui-grid-head">{header}</div>
            <div role="rowgroup" className="aui-grid-body" ref={bodyRef} style={{ height: interactive ? bodyHeight : 0 }}>
              <CellBudgetContext.Provider value={budget}>{body}</CellBudgetContext.Provider>
              {rowDrag.drop && <span className="aui-grid-row-drop" aria-hidden="true" style={{ top: rowDrag.drop.top, width: totalWidth }} />}
            </div>
            {footer && <div role="rowgroup" className="aui-grid-foot">{footer}</div>}
          </div>
        </div>
        {busy ? (
          <div className="aui-grid-overlay"><StatePanel kind="loading" /></div>
        ) : failure ? (
          <div className="aui-grid-overlay"><StatePanel kind="error" message={failure} onRetry={server && !error ? () => { remote.retry(); remoteGroups.refresh(); } : props.onRetry} /></div>
        ) : !dataCount ? (
          <div className="aui-grid-overlay">
            <StatePanel kind={emptyKind} message={emptyKind === "empty" ? props.emptyLabel : undefined}
              action={emptyKind === "no-results" ? <Button variant="outline" onClick={() => dispatch({ type: "clearFilters" })}>清除筛选和搜索</Button> : props.onAddRow ? <Button variant="outline" onClick={() => props.onAddRow?.({})}><Plus />新增一行</Button> : undefined} />
          </div>
        ) : null}
        {selectable && selected.length > 0 && (
          <BulkActionBar count={selected.length} total={total} actions={props.bulkActions?.(selected) ?? []} onClear={() => props.onSelectionChange?.([])} />
        )}
        <div className="aui-grid-status" role="status" aria-live="polite" data-tone={status?.tone} hidden={!status}>
          {status?.conflict ? renderConflict(status.conflict) : status && <>
            {status.tone === "success" ? <Check aria-hidden="true" /> : status.tone === "error" ? <X aria-hidden="true" /> : <span className="aui-grid-status-spin" aria-hidden="true" />}
            <span className="aui-grid-status-text">{status.text}</span>
            {status.undo && editing.canUndo && <Button variant="text" size="sm" onClick={editing.undo}>撤销</Button>}
            {status.tone !== "info" && <IconButton label="关闭提示" onClick={() => editing.setStatus(null)} icon={<X />} />}
          </>}
        </div>
      </div>
      {expand.element}
      <Menu open={Boolean(menuField)} anchor={headerMenu?.anchor} point={headerMenu?.point} label={`${menuField?.title ?? ""}字段菜单`} sections={headerSections}
        returnFocus={headerMenu?.anchor} onClose={() => setHeaderMenu(null)} />
      <Menu open={Boolean(cellMenu)} point={cellMenu?.point} label={cellMenu?.label ?? "菜单"} sections={cellMenu?.sections ?? []} initialFocus={cellMenu?.keyboard ? "first" : "menu"}
        returnFocus={cellMenu?.returnTo} onClose={() => setCellMenu(null)} />
      <GridPopover open={Boolean(popover && popField)} anchor={popover?.anchor ?? null} label={`${popField?.title}的统计方式`} onClose={closePopover}>
        {popover && popField && popover.kind === "summary" && (
          <div className="aui-grid-pop aui-grid-menu" role="group" aria-label="统计方式">
            {summaryKindsFor(popField.type).filter((kind) => !server || kind === "none" || kind === "count" || serverSummaryKinds.includes(kind)).map((kind) => {
              const preview = kind === "none" || server ? "" : summarizeField(popField, filtered, kind).text;
              const current = (view.summary[popField.key] ?? "none") === kind;
              return (
                <Button key={kind} variant="ghost" size="sm" aria-pressed={current} onClick={() => menuAction({ type: "summary", key: popField.key, kind })}>
                  {current ? <Check /> : <span className="aui-grid-menu-gap" />}
                  <span className="aui-grid-menu-label">{summaryLabel(kind, popField.type)}</span>
                  {preview && <span className="aui-grid-menu-hint">{preview}</span>}
                </Button>
              );
            })}
          </div>
        )}
      </GridPopover>
    </div>
  );
}

/** Gives the editor its cell element (anchor of option lists) once mounted. */
function EditorHost({ cellId, box, children }: { cellId: string; box: React.RefObject<HTMLDivElement | null>; children: (anchor: HTMLElement) => ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setAnchor(box.current?.querySelector<HTMLElement>(`[data-cell="${cellId}"]`) ?? null);
  }, [cellId, box]);
  return anchor ? <>{children(anchor)}</> : null;
}

const ZONED_TYPES = new Set(["date", "datetime", "createdAt", "modifiedAt"]);
/** Fill money currency, date time zone and phone country from AdminProvider `defaults` where a field leaves them out. */
function withLocaleDefaults<T>(fields: readonly GridField<T>[], defaults: AdminDefaults): readonly GridField<T>[] {
  const symbol = currencySymbol(defaults.currency);
  let changed = false;
  const out = fields.map((field) => {
    const patch: Partial<GridField<T>> = {};
    if (field.type === "money" && field.currency === undefined && symbol) patch.currency = symbol;
    if (ZONED_TYPES.has(field.type) && field.timeZone === undefined) patch.timeZone = defaults.timeZone;
    if (field.type === "phone" && field.phoneCountry === undefined && defaults.phoneCountry) patch.phoneCountry = defaults.phoneCountry;
    if (!Object.keys(patch).length) return field;
    changed = true;
    return { ...field, ...patch };
  });
  return changed ? out : fields;
}
