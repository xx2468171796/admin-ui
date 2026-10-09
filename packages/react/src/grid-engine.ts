/**
 * TanStack Table v9 wiring of BitableGrid: the feature set, column definitions and the table state
 * derived from a GridView. No React here, so the same options run in `useTable` (grid.tsx) and in
 * `constructTable` (test/grid-core.test.ts) — the unit test exercises the real row pipeline
 * (group → sort → expand) and the column model (order, visibility, pinning, sizing).
 *
 * Search and filters run before TanStack (filterGridRows in grid-core): the view combines filters
 * with and / or across fields, which TanStack's per-column filters cannot express.
 */
import {
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type Row,
  type RowData,
} from "@tanstack/react-table";
import {
  compareSortKeys,
  GRID_DEFAULT_WIDTH,
  GRID_MAX_WIDTH,
  GRID_MIN_WIDTH,
  gridGroupKey,
  gridGroupSortKey,
  sortKey,
  type GridField,
  type GridFieldType,
  type GridView,
} from "./grid-core.ts";
import { GRID_EXTRA_WIDTHS } from "./grid-field-types.ts"; // bt/grid-b

/** Plain map of the features BitableGrid registers (spread it into tableFeatures to add more). */
export const GRID_FEATURE_MAP = {
  columnOrderingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnGroupingFeature,
  groupedRowModel: createGroupedRowModel(),
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
} as const;
export const gridFeatures = tableFeatures(GRID_FEATURE_MAP);
export type GridFeatures = typeof gridFeatures;

/** Row-number column (number / checkbox / expand), always frozen first. */
export const GRID_ROW_COLUMN = "__row";
/** Hidden column that carries the group key and the group order. */
export const GRID_GROUP_COLUMN = "__group";
/** Row actions column, frozen at the end when `rowActions` is given. */
export const GRID_ACTIONS_COLUMN = "__actions";
/** bt/grid-b: trailing 「+」 column (add a field), after the last field. */
export const GRID_ADD_COLUMN = "__add";
export const GRID_ADD_WIDTH = 44;
export const GRID_ROW_NUMBER_WIDTH = 48;
export const GRID_ACTIONS_WIDTH = 48;

const DEFAULT_WIDTHS: Partial<Record<GridFieldType, number>> = {
  longText: 240,
  number: 120,
  money: 160,
  date: 120,
  datetime: 160,
  singleSelect: 130,
  multiSelect: 200,
  user: 160,
  checkbox: 80,
  url: 200,
  email: 200,
  ...GRID_EXTRA_WIDTHS, // bt/grid-b
};
/** Deadline dates (GridField.deadline) leave room for 「逾期 N 天」 after the date. */
const DEADLINE_WIDTHS: Partial<Record<GridFieldType, number>> = { date: 184, datetime: 232 };
/** Width of a field before the user drags it: `field.width`, else a default for its type. */
export const defaultFieldWidth = (field: Pick<GridField<unknown>, "width" | "type" | "primary"> & { deadline?: unknown }) =>
  Math.min(GRID_MAX_WIDTH, Math.max(GRID_MIN_WIDTH, field.width ?? (field.deadline ? DEADLINE_WIDTHS[field.type] : undefined) ?? DEFAULT_WIDTHS[field.type] ?? (field.primary ? 200 : GRID_DEFAULT_WIDTH)));

const sortable = (field: GridField<unknown>) => field.sortable !== false && (field.type !== "custom" || Boolean(field.text));
type Key = ReturnType<typeof sortKey>;
const byKey = <T extends RowData>(a: Row<GridFeatures, T>, b: Row<GridFeatures, T>, id: string) => compareSortKeys(a.getValue(id) as Key, b.getValue(id) as Key);

/**
 * Column definitions: row number, one per field (value = the field's sort key, so TanStack sorts
 * empties last and selects by option order), the hidden group column for `groupBy`, and actions.
 */
export function gridColumnDefs<T extends RowData>(fields: readonly GridField<T>[], groupBy: string | null, actions: boolean, extra: { addField?: boolean } = {}): ColumnDef<GridFeatures, T>[] {
  const group = groupBy ? fields.find((field) => field.key === groupBy) : undefined;
  const defs: ColumnDef<GridFeatures, T>[] = [
    { id: GRID_ROW_COLUMN, size: GRID_ROW_NUMBER_WIDTH, minSize: GRID_ROW_NUMBER_WIDTH, maxSize: GRID_ROW_NUMBER_WIDTH, enableResizing: false, enableSorting: false, enableHiding: false },
    ...fields.map((field): ColumnDef<GridFeatures, T> => ({
      id: field.key,
      accessorFn: (row: T) => sortKey(field, row),
      size: defaultFieldWidth(field),
      minSize: GRID_MIN_WIDTH,
      maxSize: GRID_MAX_WIDTH,
      enableSorting: sortable(field as GridField<unknown>),
      sortFn: byKey,
      sortUndefined: "last",
      enableGrouping: false,
    })),
  ];
  if (group)
    defs.push({
      id: GRID_GROUP_COLUMN,
      accessorFn: (row: T) => gridGroupSortKey(group, row),
      getGroupingValue: (row: T) => gridGroupKey(group, row),
      sortFn: byKey,
      sortUndefined: "last",
      enableHiding: false,
    });
  if (extra.addField) defs.push({ id: GRID_ADD_COLUMN, size: GRID_ADD_WIDTH, minSize: GRID_ADD_WIDTH, maxSize: GRID_ADD_WIDTH, enableResizing: false, enableSorting: false, enableHiding: false }); // bt/grid-b
  if (actions) defs.push({ id: GRID_ACTIONS_COLUMN, size: GRID_ACTIONS_WIDTH, minSize: GRID_ACTIONS_WIDTH, maxSize: GRID_ACTIONS_WIDTH, enableResizing: false, enableSorting: false });
  return defs;
}

/** Row id of a group row (TanStack: `${columnId}:${groupingValue}`). */
export const gridGroupRowId = (key: string) => `${GRID_GROUP_COLUMN}:${key}`;

/**
 * TanStack state for a view: column order / visibility / pinning (row number + the first
 * `frozenColumns` visible fields at the start, actions at the end) / sizing and sorting. Grouping is
 * not TanStack's: BitableGrid groups the sorted rows itself (grid-group-core.ts, up to 3 levels, the
 * same layout in server mode), so `grouping` / `expanded` stay empty (bt/grid-a).
 */
export function gridTableState(view: GridView, options: { frozenColumns: number; actions: boolean; groupKeys?: readonly string[]; sizing?: Record<string, number> }) {
  const visible = view.order.filter((key) => !view.hidden.includes(key));
  const frozen = visible.slice(0, Math.max(0, Math.floor(options.frozenColumns)));
  const columnVisibility: Record<string, boolean> = { [GRID_GROUP_COLUMN]: false };
  for (const key of view.hidden) columnVisibility[key] = false;
  const sorting = view.sort.map((sort) => ({ id: sort.key, desc: sort.direction === "desc" }));
  return {
    columnOrder: [GRID_ROW_COLUMN, ...view.order, GRID_ADD_COLUMN, GRID_GROUP_COLUMN, GRID_ACTIONS_COLUMN],
    columnVisibility,
    columnPinning: { start: [GRID_ROW_COLUMN, ...frozen], end: options.actions ? [GRID_ACTIONS_COLUMN] : [] },
    columnSizing: { ...view.widths, ...options.sizing },
    sorting,
    grouping: [] as string[],
    expanded: {} as Record<string, boolean>,
  };
}

/** Table options shared by useTable and constructTable (state / handlers are added by the caller). */
export const GRID_TABLE_OPTIONS = {
  columnResizeMode: "onChange",
  autoResetExpanded: false,
  enableMultiSort: true,
  groupedColumnMode: false,
} as const;
