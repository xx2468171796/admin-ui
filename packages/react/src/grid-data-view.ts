/**
 * Grid data helpers the grid uses internally (not part of ./grid-query: grid-data-core.ts is re-exported there with
 * `export *`, so anything added to it becomes public API). Answer validation and the one-copy-per-record view of
 * the block cache.
 */
import { GRID_BLOCK_SIZE, rowAtIndex, type GridBlockState } from "./grid-data-core.ts";

/**
 * What is wrong with a data source's answer, or null when it is usable: `rows` must be an array and `total` a
 * non-negative integer (the same check as useDataSource). A bad answer fails its block (shown with 「重试」) instead
 * of corrupting the cache.
 */
export function gridLoadProblem(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return "表格数据响应格式不正确：不是对象";
  const { rows, total } = result as { rows?: unknown; total?: unknown };
  if (!Array.isArray(rows)) return "表格数据响应格式不正确：rows 不是数组";
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) return "表格数据响应格式不正确：total 不是非负整数";
  return null;
}
/**
 * Where each record is shown: one position per id. Blocks are read in arrival order and a later copy wins, so
 * when rows shifted between two requests (a record inserted / deleted on the server) the newest block keeps the
 * record and the older copy is hidden (a placeholder row until that stale block is fetched again) — a record never
 * shows twice, and React / the virtualizer never see two rows with one key.
 */
export function visibleRowOffsets<T>(state: GridBlockState<T>, getRowId: (row: T) => string, blockSize = GRID_BLOCK_SIZE): Map<string, number> {
  const offsets = new Map<string, number>();
  for (const [block, rows] of state.blocks) rows.forEach((row, i) => offsets.set(getRowId(row), block * blockSize + i));
  return offsets;
}
/** The row shown at a position: rowAtIndex unless a newer copy of that record sits elsewhere (then undefined). */
export function shownRowAt<T>(state: GridBlockState<T>, offsets: ReadonlyMap<string, number>, getRowId: (row: T) => string, index: number, blockSize = GRID_BLOCK_SIZE): T | undefined {
  const row = rowAtIndex(state, index, blockSize);
  return row !== undefined && offsets.get(getRowId(row)) === index ? row : undefined;
}
/** Loaded records in position order, each once (the copies visibleRowOffsets shows). */
export function shownRows<T>(state: GridBlockState<T>, offsets: ReadonlyMap<string, number>, getRowId: (row: T) => string, blockSize = GRID_BLOCK_SIZE): T[] {
  return [...state.blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([block, rows]) => rows.filter((row, i) => offsets.get(getRowId(row)) === block * blockSize + i));
}
