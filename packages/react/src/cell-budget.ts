import { useContext } from "react";
import { sharedContext } from "./context.ts";

/**
 * What a table cell may occupy, set by DataTable around its body cells. Cell components (CellTags,
 * CellLongText, CellText …) read it to clamp themselves to the row instead of growing it. Outside a
 * DataTable (the expand-record view, a details page) there is no budget and they render in full.
 */
export type TableCellBudget = {
  /** Text lines the row holds; Infinity when the table uses rowHeight="auto". */
  lines: number;
  /** false for rowHeight="auto": content may grow the row (2.x behaviour). */
  clamped: boolean;
  /** Row shorter than two compact lines (< 40px): two-line cells fall back to one line. */
  compact: boolean;
};
export const CellBudgetContext = sharedContext<TableCellBudget>("table-cell-budget");
/** The budget of the surrounding DataTable row, or null outside a table (render unclamped). */
export function useCellBudget(): TableCellBudget | null {
  return useContext(CellBudgetContext);
}
