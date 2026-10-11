/**
 * Public props of BitableGrid (`@adminui/react/grid`) and the internal item type / geometry constants /
 * small DOM helpers the grid's modules share (grid.tsx is the composition shell; see its module map).
 */
import type { ReactNode, Ref } from "react";
import type { RowAction } from "./row-actions.tsx";
import type { ExpandRecordContext } from "./record-expand.tsx";
import type { RecordDetailLevel, RecordLayout } from "./record-detail-core.ts";
import type { TableRowHeightPreset } from "./table-rows.ts";
import type { GridField, GridPerson, GridView, GridViewInput, GridViewLimits } from "./grid-core.ts";
import type { GridDataSource } from "./grid-data-core.ts";
import type { GridAddRowHandler } from "./grid-add-row.ts";
import type { GridToolbarFeatures } from "./grid-toolbar.tsx";
import type { GridCellsChangeHandler } from "./grid-editing.ts";
import type { BitableGridHandle } from "./grid-data.ts";
import type { ConditionContext, DynamicToken } from "./condition-core.ts";
import type { GridGroup } from "./grid-group-core.ts";
import type { MenuItem, MenuSection } from "./menu.tsx";
import type { BulkAction } from "./bulk-action-bar.tsx";
import type { GridCellMenuContext, GridFieldActionKind, GridHeaderMenuItem } from "./grid-menus.tsx";
import type { GridRowMove } from "./grid-interact-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

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
  /** 8.9 touch screens (pointer: coarse): one tap on the primary cell ("primary") or any cell ("row") opens the record (default off). */
  openOnTap?: "primary" | "row" | false;
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
  /**
   * 「+ 新增一行」 under every expanded group (its group keys) and, ungrouped, at the bottom ({}); also the footer 「+」
   * (`addRowButton`) with {}. Answer the new record's id (or a promise of it) and the grid scrolls to that row and
   * opens its first editable cell (8.7; server mode: the grid refetches itself — keep the new row in the answer,
   * e.g. pinned at the end). Answer nothing to place / focus it yourself.
   */
  onAddRow?: GridAddRowHandler;
  /** The 「+」 at the left end of the bottom bar, next to 「N 条记录」 (default true when `onAddRow` is given; needs `summary`). */
  addRowButton?: boolean;
  /** Drag records by the grip in the row-number column, or Alt + Shift + ↑ / ↓ (client rows, no sort). */
  onRowMove?: (move: GridRowMove) => void;
  /** A small corner marker on a cell (comments, pending approval); `label` is read by screen readers. */
  cellBadge?: (row: T, field: GridField<T>) => { label: string; tone?: "warning" | "info" | "danger" | "brand" } | null | undefined;
  // ---------------------------------------------------------------- bt/grid-b
  /** 8.9: refresh / patchRows / insertRow / removeRows / revealRow without touching the DOM (see BitableGridHandle). */
  handleRef?: Ref<BitableGridHandle<T>>;
};

/** One rendered line of the grid body: group header, 「+ 新增一行」, a record, or a record still loading. */
export type GridItem<T> =
  | { kind: "group"; id: string; key: string; group: GridGroup<T> }
  | { kind: "add"; id: string; group: Record<string, string>; node: GridGroup<T> | null } // bt/grid-b (multi-level: bt/grid-a)
  | { kind: "row"; id: string; row: T; offset: number }
  | { kind: "loading"; id: string; error: string | null };

export const HEADER_HEIGHT = 40;
export const FOOTER_HEIGHT = 36;
export const GROUP_HEIGHT = 40;
export const ADD_HEIGHT = 36; // bt/grid-b
/** One shared empty list: server mode must not hand TanStack / the layout a new [] every render. */
export const NO_ROWS: never[] = [];
export const ALL_FIELD_ACTIONS: readonly GridFieldActionKind[] = ["edit", "describe", "insertLeft", "insertRight", "duplicate", "permission", "delete"];
/** Controls inside cells / header cells (one tab stop per grid: they get tabIndex -1). */
export const INNER_CONTROLS = ".aui-grid-cell a[href], .aui-grid-cell button, .aui-grid-cell input, .aui-grid-hcell button";
/** What Enter moves into inside a cell (Tab cycles, Esc returns). */
export const CELL_CONTROLS = "a[href], button:not([disabled]), input:not([disabled]), [role=checkbox]";
/**
 * Take controls inside `box` (one row, or the header row) out of the tab order — a fallback for host-rendered
 * content; the kit's own cell controls already render with tabIndex -1 (GridInnerTabIndex). Skipped while the
 * user is inside a cell (Enter on a cell) or in an editor.
 */
export function demoteInner(box: HTMLElement) {
  for (const node of box.querySelectorAll<HTMLElement>(INNER_CONTROLS)) {
    if (node.closest(".aui-grid-editor, [data-inside]")) continue;
    if (node.tabIndex !== -1) node.tabIndex = -1;
  }
}
/** Focus is in a text box (an editor, the toolbar search …) — not the grid's own input capture. */
export const isTyping = (node: EventTarget | null) =>
  node instanceof HTMLElement && node.dataset.gridCapture === undefined && (node.matches("input, textarea, select") || node.isContentEditable);
/** Row and column of a `[data-cell="row:col"]` element (col NaN for full-width rows); null when there is none. */
export function cellOf(node: HTMLElement): { row: number; col: number } | null {
  const value = node.dataset.cell;
  if (!value) return null;
  const [row, col] = value.split(":").map(Number);
  return row === undefined || Number.isNaN(row) ? null : { row, col: col ?? Number.NaN };
}
