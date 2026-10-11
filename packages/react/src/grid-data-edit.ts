/**
 * 8.9 in-place inserts / removals in the block cache of a server data source (BitableGridHandle.insertRow /
 * removeRows). Pure; kept out of grid-data-core so the grid loads it only when a host first uses them.
 * Unit-tested in test/grid-data-refresh.test.ts.
 */
import { GRID_BLOCK_SIZE, patchBlockRows, type GridBlockState, type GridRowAnchor } from "./grid-data-core.ts";

/**
 * Re-cut the cached blocks from `first` up to the next gap after `edit` changed their rows (`delta` = records
 * added / removed). Blocks after the gap are dropped (their positions moved); a cut block left short before the
 * end of the data stays stale so it is fetched again. New generation: answers already in flight are dropped.
 */
function recutBlocks<T>(state: GridBlockState<T>, first: number, edit: (rows: T[]) => T[], delta: number, blockSize: number): GridBlockState<T> {
  const total = state.total ?? 0;
  let last = first;
  while (state.blocks.has(last + 1)) last++;
  const run: T[] = [];
  for (let block = first; block <= last; block++) run.push(...(state.blocks.get(block) ?? []));
  const rows = edit(run);
  const nextTotal = Math.max(0, total + delta);
  const toEnd = (last + 1) * blockSize >= total;
  const blocks = new Map<number, readonly T[]>();
  const stale = new Set<number>();
  const failed = new Map<number, string>();
  for (const [block, cached] of state.blocks) {
    if (block >= first) continue;
    blocks.set(block, cached);
    if (state.stale?.has(block)) stale.add(block);
  }
  for (const [block, error] of state.failed) if (block < first) failed.set(block, error);
  const lastBlock = toEnd ? Math.max(first, Math.ceil(nextTotal / blockSize) - 1) : last;
  for (let block = first; block <= lastBlock; block++) {
    const chunk = rows.slice((block - first) * blockSize, (block - first + 1) * blockSize);
    blocks.set(block, chunk);
    if (state.stale?.has(block) || (!toEnd && chunk.length < blockSize)) stale.add(block);
  }
  return { ...state, total: nextTotal, blocks, stale, outdated: undefined, failed, loading: new Set(), held: undefined, generation: state.generation + 1 };
}
function blockOf<T>(state: GridBlockState<T>, id: string, getRowId: (row: T) => string): [number, number] | null {
  for (const [block, rows] of state.blocks) {
    const at = rows.findIndex((row) => getRowId(row) === id);
    if (at >= 0) return [block, at];
  }
  return null;
}
/**
 * 8.9 optimistic create: put `row` into the cache next to a loaded anchor row (or after the last record) and
 * count it in the total. `null` when the anchor is not loaded or nothing is loaded yet (refetch instead); a row
 * already in the cache is just replaced.
 */
export function insertBlockRow<T>(state: GridBlockState<T>, row: T, at: GridRowAnchor, getRowId: (row: T) => string, blockSize = GRID_BLOCK_SIZE): GridBlockState<T> | null {
  if (state.total === null) return null;
  const id = getRowId(row);
  if (blockOf(state, id, getRowId)) return patchBlockRows(state, new Map([[id, row]]), getRowId);
  if (at === "end") {
    const last = Math.max(0, Math.ceil(state.total / blockSize) - 1);
    if (state.total > 0 && !state.blocks.has(last)) return { ...state, total: state.total + 1 }; // it comes with that block
    return recutBlocks(state, last, (rows) => [...rows, row], 1, blockSize);
  }
  const anchor = blockOf(state, "before" in at ? at.before : at.after, getRowId);
  if (!anchor) return null;
  const [block, index] = anchor;
  const position = index + ("after" in at ? 1 : 0);
  return recutBlocks(state, block, (rows) => [...rows.slice(0, position), row, ...rows.slice(position)], 1, blockSize);
}
/** 8.9: take loaded rows out of the cache (and the total); ids that are not loaded are ignored. */
export function removeBlockRows<T>(state: GridBlockState<T>, ids: readonly string[], getRowId: (row: T) => string, blockSize = GRID_BLOCK_SIZE): GridBlockState<T> {
  const gone = new Set(ids);
  let first = -1;
  let found = 0;
  for (const [block, rows] of state.blocks) {
    const hits = rows.reduce((n, row) => n + (gone.has(getRowId(row)) ? 1 : 0), 0);
    if (!hits) continue;
    found += hits;
    if (first < 0 || block < first) first = block;
  }
  if (first < 0) return state;
  return recutBlocks(state, first, (rows) => rows.filter((row) => !gone.has(getRowId(row))), -found, blockSize);
}
