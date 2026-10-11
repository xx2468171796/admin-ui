"use client";
/**
 * useGridServerData: the block cache of a server data source (grid-data-core.ts) wired to React —
 * loads the blocks the viewport needs, cancels answers of an old query, retries failed blocks on demand.
 * 8.9: a refresh keeps the rows on screen (stale) until their new answers arrive, and a new query keeps the
 * previous rows (`pending`) until its first block arrives — no skeleton or empty frame in between.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blocksForRange, emptyBlockState, failBlock, GRID_BLOCK_SIZE, GRID_MAX_BLOCKS, gridQueryKey, markLoading, missingBlocks, patchBlockRows, receiveBlock, refreshBlockState, rowAtIndex, settleBlocks, type GridBlockState, type GridDataSource, type GridQuery, type GridRowAnchor } from "./grid-data-core.ts";
import { gridLoadProblem, shownRowAt, shownRows, visibleRowOffsets } from "./grid-data-view.ts";
import type { GridSummaryKind } from "./grid-core.ts";

export type UseGridServerDataOptions = {
  blockSize?: number;
  summaries?: Record<string, GridSummaryKind>;
  /** false = do nothing (client-side rows). */
  enabled?: boolean;
  /** 8.9: keep showing the previous query's rows even once the new ones are in (e.g. until group headers arrive). */
  hold?: boolean;
};

/**
 * 8.9: what a host can do to a BitableGrid without DOM tricks (`handleRef`). Server data sources: the cache
 * changes in place, rows keep their DOM nodes. Client `rows`: refresh / patchRows / insertRow / removeRows do
 * nothing (change `rows` instead); revealRow works in both.
 */
export type BitableGridHandle<T> = {
  /** Refetch silently: the rows on screen stay and are replaced in place (also the group headers). */
  refresh(): void;
  /** Replace loaded records by id (realtime updates, a save in the record dialog), keeping their positions. */
  patchRows(rows: readonly T[]): void;
  /**
   * Show a record the server just created (its answer), next to a loaded row or after the last record; the
   * total grows by one. When the anchor is not loaded (or a grouped view would need a new group) the grid
   * refreshes silently instead.
   */
  insertRow(row: T, at: GridRowAnchor): void;
  /** Take deleted records out (loaded ones; the total shrinks by their number). */
  removeRows(ids: readonly string[]): void;
  /** Scroll to a record and focus it — `edit` opens its first editable cell. Waits for it to load; false when it does not show up. */
  revealRow(id: string, options?: { edit?: boolean }): Promise<boolean>;
};

/** Cache key of a query plus the summaries asked for (useGridServerData and useGridServerGroups use the same). */
/** 8.9.1: longest a refresh waits for all of its kept blocks before landing the ones that answered. */
const REFRESH_SWAP_MS = 3000;
export const gridServerKey = (query: GridQuery, summaries: Record<string, GridSummaryKind> | undefined) => `${gridQueryKey(query)}|${JSON.stringify(summaries ?? {})}`;

/** In-place inserts / removals load on first use (8.9; `preloadGridDataEdit` when a host takes a handle). */
const loadEdit = () => import("./grid-data-edit.ts");
export const preloadGridDataEdit = () => void loadEdit().catch(() => undefined);

/** What is shown, and the new query's cache while it loads (8.9). */
type Pair<T> = { shown: GridBlockState<T>; next: GridBlockState<T> | null };

/** Apply a reducer to both caches; the new one takes over once it has an answer (rows or an error), unless held. */
function step<T>(pair: Pair<T>, fn: (state: GridBlockState<T>) => GridBlockState<T>, hold: boolean): Pair<T> {
  const shown = fn(pair.shown);
  const next = pair.next && fn(pair.next);
  if (next && !hold && (next.total !== null || next.failed.size > 0)) return { shown: next, next: null };
  return shown === pair.shown && next === pair.next ? pair : { shown, next };
}

export function useGridServerData<T>(source: GridDataSource<T> | undefined, query: GridQuery, getRowId: (row: T) => string, options: UseGridServerDataOptions = {}) {
  const blockSize = options.blockSize ?? GRID_BLOCK_SIZE;
  const enabled = Boolean(source) && options.enabled !== false;
  const hold = options.hold === true;
  const key = gridServerKey(query, options.summaries);
  const [pair, setPair] = useState<Pair<T>>(() => ({ shown: emptyBlockState<T>(key), next: null }));
  const pairRef = useRef(pair);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const controllers = useRef(new Set<AbortController>());
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const queryRef = useRef(query);
  queryRef.current = query;
  const summariesRef = useRef(options.summaries);
  summariesRef.current = options.summaries;
  const rowIdRef = useRef(getRowId);
  rowIdRef.current = getRowId;
  // The query behind each cache key (the grid lays out the previous rows with the previous group levels).
  const queries = useRef(new Map<string, GridQuery>());
  queries.current.set(key, query);
  const range = useRef({ start: 0, end: blockSize - 1 });
  // Key + generation whose summaries were asked for: the first block of a new generation asks again.
  const summarized = useRef("");

  const update = useCallback((fn: (state: GridBlockState<T>) => GridBlockState<T>) => {
    const next = step(pairRef.current, fn, holdRef.current);
    if (next === pairRef.current) return;
    pairRef.current = next;
    setPair(next);
  }, []);
  const set = useCallback((next: Pair<T>) => {
    pairRef.current = next;
    setPair(next);
  }, []);
  const abortAll = useCallback(() => {
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
  }, []);

  const load = useCallback((blocks: readonly number[], base: GridBlockState<T>) => {
    const src = sourceRef.current;
    if (!src || !blocks.length) return;
    update((old) => (old.key === base.key && old.generation === base.generation ? markLoading(old, blocks) : old));
    const stamp = `${base.key}#${base.generation}`;
    let ask = summarized.current !== stamp || base.summaries === undefined;
    summarized.current = stamp;
    for (const block of blocks) {
      const controller = new AbortController();
      controllers.current.add(controller);
      const summaries = block === 0 || ask ? summariesRef.current : undefined;
      ask = false;
      src.load({ query: queryRef.current, offset: block * blockSize, limit: blockSize, summaries, signal: controller.signal })
        .then((result) => {
          // A malformed answer fails its block (「加载失败，回车重试」) instead of corrupting the cache.
          const problem = gridLoadProblem(result);
          if (problem) throw new Error(problem);
          update((old) => receiveBlock(old, { key: base.key, generation: base.generation, block, result, rowId: rowIdRef.current }, GRID_MAX_BLOCKS, blockSize));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          update((old) => failBlock(old, { key: base.key, generation: base.generation, block, error: error instanceof Error ? error.message : "加载失败" }, GRID_MAX_BLOCKS, blockSize));
        })
        .finally(() => controllers.current.delete(controller));
    }
  }, [blockSize, update]);

  /**
   * Refetch what is shown (rows on screen stay stale until their answers land together, 8.9.1); a kept block
   * that has not answered after REFRESH_SWAP_MS no longer holds the others back.
   */
  const refetch = useCallback((shown: GridBlockState<T>) => {
    const { start, end } = range.current;
    const kept = refreshBlockState(shown, blocksForRange(start, end, blockSize));
    set({ shown: kept, next: null });
    // The kept total may be out of date (rows added since — an empty list had 0): fetch the whole visible range.
    load(missingBlocks({ ...kept, total: null }, start, end, blockSize), kept);
    setTimeout(() => update((old) => (old.key === kept.key && old.generation === kept.generation ? settleBlocks(old, GRID_MAX_BLOCKS, blockSize, true) : old)), REFRESH_SWAP_MS);
  }, [blockSize, set, load, update]);
  // A new query (or summaries): the rows on screen stay until its first block arrives (8.9); back to the
  // query on screen = a silent refresh of it. Only an empty grid starts over with an empty cache.
  useEffect(() => {
    if (!enabled) return;
    abortAll();
    const { shown } = pairRef.current;
    const { start, end } = range.current;
    if (shown.key === key && shown.total !== null) refetch(shown);
    else if (shown.key !== key && shown.total !== null) {
      const fresh = emptyBlockState<T>(key);
      set({ shown, next: fresh });
      load(missingBlocks(fresh, 0, end - start, blockSize), fresh);
    } else {
      const fresh = emptyBlockState<T>(key, shown.generation + 1);
      set({ shown: fresh, next: null });
      load(missingBlocks(fresh, start, end, blockSize), fresh);
    }
  }, [key, enabled, load, blockSize, set, refetch, abortAll]);
  useEffect(() => () => abortAll(), [abortAll]);
  // Released: the new rows that were waiting take over.
  useEffect(() => {
    if (!hold) update((state) => state);
  }, [hold, update]);

  /**
   * The viewport shows rows start..end (and `also`, e.g. the active row scrolled away): fetch what is missing.
   * While a new query loads: its first rows.
   */
  const ensure = useCallback((start: number, end: number, also?: number) => {
    range.current = { start, end };
    if (!enabled) return;
    const { shown, next } = pairRef.current;
    if (next) return load(missingBlocks(next, 0, end - start, blockSize), next);
    const blocks = missingBlocks(shown, start, end, blockSize);
    if (also !== undefined) for (const block of missingBlocks(shown, also, also, blockSize)) if (!blocks.includes(block)) blocks.push(block);
    load(blocks, shown);
  }, [enabled, load, blockSize]);
  const retry = useCallback(() => {
    const { shown, next } = pairRef.current;
    const target = next ?? shown;
    load(missingBlocks(target, range.current.start, range.current.end, blockSize, true), target);
  }, [load, blockSize]);
  /** Refetch silently (8.9): the rows on screen stay (stale) and are replaced in place when the answers arrive. */
  const refresh = useCallback(() => {
    abortAll();
    const { shown, next } = pairRef.current;
    const { start, end } = range.current;
    if (next) {
      const fresh = emptyBlockState<T>(next.key, next.generation + 1);
      set({ shown, next: fresh });
      load(missingBlocks(fresh, 0, end - start, blockSize), fresh);
      return;
    }
    refetch(shown);
  }, [load, set, blockSize, refetch, abortAll]);
  const patch = useCallback((rows: ReadonlyMap<string, T>) => update((old) => patchBlockRows(old, rows, getRowId)), [update, getRowId]);
  /** 8.9: put a created row into the shown cache; false = not possible here (anchor not loaded, new query loading). */
  const insert = useCallback((row: T, at: GridRowAnchor) => loadEdit().then(({ insertBlockRow }) => {
    const { shown, next } = pairRef.current;
    const out = next ? null : insertBlockRow(shown, row, at, getRowId, blockSize);
    if (out) set({ shown: out, next: null });
    return Boolean(out);
  }), [set, getRowId, blockSize]);
  const remove = useCallback((ids: readonly string[]) => loadEdit().then(({ removeBlockRows }) => {
    const { shown, next } = pairRef.current;
    const out = removeBlockRows(shown, ids, getRowId, blockSize);
    if (out !== shown) set({ shown: out, next });
  }), [set, getRowId, blockSize]);

  const state = pair.shown;
  // One position per record (the newest copy when rows shifted between blocks): no record shows twice.
  // biome-ignore lint/correctness/useExhaustiveDependencies: visibleRowOffsets reads only `state.blocks`; keyed on it so a loading / failed change keeps the same offsets (and rows) identity.
  const offsets = useMemo(() => visibleRowOffsets(state, getRowId, blockSize), [state.blocks, getRowId, blockSize]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `offsets` is rebuilt whenever `state.blocks` / getRowId / blockSize change, the only inputs read here.
  const index = useMemo(() => {
    const map = new Map<string, T>();
    for (const [id, offset] of offsets) {
      const row = rowAtIndex(state, offset, blockSize);
      if (row !== undefined) map.set(id, row);
    }
    return map;
  }, [offsets]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: as `index` — `offsets` moves with every input shownRows reads.
  const rows = useMemo(() => shownRows(state, offsets, getRowId, blockSize), [offsets]);
  for (const k of queries.current.keys()) if (k !== key && k !== state.key && k !== pair.next?.key) queries.current.delete(k);
  const shownQuery = queries.current.get(state.key) ?? query;
  return {
    state,
    /** Cache key of the current query (`state.key` differs while `pending`). */
    key,
    /** The query whose rows are shown. */
    shownQuery,
    /** A new query is loading; the previous rows are still shown. */
    pending: pair.next !== null,
    total: state.total,
    rowAt: (rowIndex: number) => shownRowAt(state, offsets, getRowId, rowIndex, blockSize),
    findRow: (rowId: string) => index.get(rowId),
    /** Position of a loaded record (-1 when not loaded). */
    offsetOf: (rowId: string) => offsets.get(rowId) ?? -1,
    /** Loaded records in position order, each once. */
    rows,
    failedAt: (rowIndex: number) => state.failed.get(Math.floor(rowIndex / blockSize)) ?? null,
    /** The row's block is being fetched again (8.9). */
    isStale: (rowIndex: number) => Boolean(state.stale?.has(Math.floor(rowIndex / blockSize)) || state.outdated?.has(Math.floor(rowIndex / blockSize))),
    /** Nothing in flight. */
    idle: pair.next === null && state.loading.size === 0,
    firstLoading: state.total === null && state.failed.size === 0,
    firstError: state.total === null ? state.failed.values().next().value ?? null : null,
    ensure,
    retry,
    refresh,
    patch,
    insert,
    remove,
  };
}
