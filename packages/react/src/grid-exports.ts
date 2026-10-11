// The public surface of `@adminui/react/grid` besides BitableGrid itself (grid.tsx re-exports this module).
// The pure cores (field model, query, SQL, edit parsing) are the backend entry `./grid-query`; this entry
// re-exports their types plus the view / editing helpers a front end needs next to BitableGrid.
export type * from "./grid-core.ts";
export type * from "./grid-edit-core.ts";
export type * from "./grid-data-core.ts";
export type * from "./grid-sql.ts";
export { normalizeGridView, gridViewReducer, serializeGridView, parseGridView, filterGridRows, summarizeField } from "./grid-core.ts";
export { planPaste, planClear, parseTsv, toTsv } from "./grid-edit-core.ts";
export { gridQueryOf } from "./grid-data-core.ts";
export { firstInlineEditColumn, ADD_ROW_REVEAL_MS, type GridAddRowHandler, type GridAddRowResult } from "./grid-add-row.ts";
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
// Types of the editors; the public GridCellEditor loads the editors module after first paint (grid-cell-editor.tsx).
export type * from "./grid-editors.tsx";
export { GridCellEditor } from "./grid-cell-editor.tsx";
export { useGridEditing, type GridCellsChangeHandler, type GridStatus, type GridStatusConflict } from "./grid-editing.ts";
export { useGridServerData, gridServerKey, type BitableGridHandle } from "./grid-data.ts";
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
