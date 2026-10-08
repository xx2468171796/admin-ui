"use client";
/**
 * useGridServerData: the block cache of a server data source (grid-data-core.ts) wired to React —
 * loads the blocks the viewport needs, cancels answers of an old query, keeps the total while
 * refreshing, retries failed blocks on demand.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  emptyBlockState,
  failBlock,
  GRID_BLOCK_SIZE,
  gridQueryKey,
  markLoading,
  missingBlocks,
  patchBlockRows,
  receiveBlock,
  refreshBlockState,
  rowAtIndex,
  type GridBlockState,
  type GridDataSource,
  type GridQuery,
} from "./grid-data-core.ts";
import type { GridSummaryKind } from "./grid-core.ts";

export type UseGridServerDataOptions = {
  blockSize?: number;
  summaries?: Record<string, GridSummaryKind>;
  /** false = do nothing (client-side rows). */
  enabled?: boolean;
};

export function useGridServerData<T>(source: GridDataSource<T> | undefined, query: GridQuery, getRowId: (row: T) => string, options: UseGridServerDataOptions = {}) {
  const blockSize = options.blockSize ?? GRID_BLOCK_SIZE;
  const enabled = Boolean(source) && options.enabled !== false;
  const summariesKey = JSON.stringify(options.summaries ?? {});
  const key = `${gridQueryKey(query)}|${summariesKey}`;
  const [state, setState] = useState<GridBlockState<T>>(() => emptyBlockState<T>(key));
  const stateRef = useRef(state);
  stateRef.current = state;
  const controllers = useRef(new Set<AbortController>());
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const queryRef = useRef(query);
  queryRef.current = query;
  const summariesRef = useRef(options.summaries);
  summariesRef.current = options.summaries;
  const range = useRef({ start: 0, end: blockSize - 1 });

  const load = useCallback((blocks: readonly number[], base: GridBlockState<T>) => {
    const src = sourceRef.current;
    if (!src || !blocks.length) return;
    setState((old) => (old.key === base.key && old.generation === base.generation ? markLoading(old, blocks) : old));
    for (const block of blocks) {
      const controller = new AbortController();
      controllers.current.add(controller);
      src.load({ query: queryRef.current, offset: block * blockSize, limit: blockSize, summaries: block === 0 || base.summaries === undefined ? summariesRef.current : undefined, signal: controller.signal })
        .then((result) => setState((old) => receiveBlock(old, { key: base.key, generation: base.generation, block, result })))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState((old) => failBlock(old, { key: base.key, generation: base.generation, block, error: error instanceof Error ? error.message : "加载失败" }));
        })
        .finally(() => controllers.current.delete(controller));
    }
  }, [blockSize]);

  // A new query (or summaries) starts an empty cache and cancels what is in flight.
  useEffect(() => {
    if (!enabled) return;
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
    const fresh = emptyBlockState<T>(key);
    setState(fresh);
    stateRef.current = fresh;
    load(missingBlocks(fresh, range.current.start, range.current.end, blockSize), fresh);
  }, [key, enabled, load, blockSize]);
  useEffect(() => () => { for (const controller of controllers.current) controller.abort(); }, []);

  /** The viewport shows rows start..end: fetch what is missing. */
  const ensure = useCallback((start: number, end: number) => {
    range.current = { start, end };
    if (!enabled) return;
    const current = stateRef.current;
    load(missingBlocks(current, start, end, blockSize), current);
  }, [enabled, load, blockSize]);
  const retry = useCallback(() => {
    const current = stateRef.current;
    load(missingBlocks(current, range.current.start, range.current.end, blockSize, true), current);
  }, [load, blockSize]);
  const refresh = useCallback(() => {
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
    const next = refreshBlockState(stateRef.current);
    setState(next);
    stateRef.current = next;
    load(missingBlocks(next, range.current.start, range.current.end, blockSize), next);
  }, [load, blockSize]);
  const patch = useCallback((rows: ReadonlyMap<string, T>) => setState((old) => patchBlockRows(old, rows, getRowId)), [getRowId]);

  const index = useMemo(() => {
    const map = new Map<string, T>();
    for (const rows of state.blocks.values()) for (const row of rows) map.set(getRowId(row), row);
    return map;
  }, [state.blocks, getRowId]);
  const failedRows = (rowIndex: number) => state.failed.get(Math.floor(rowIndex / blockSize)) ?? null;
  return {
    state,
    total: state.total,
    rowAt: (rowIndex: number) => rowAtIndex(state, rowIndex, blockSize),
    findRow: (rowId: string) => index.get(rowId),
    failedAt: failedRows,
    firstLoading: state.total === null && state.failed.size === 0,
    firstError: state.total === null ? state.failed.values().next().value ?? null : null,
    ensure,
    retry,
    refresh,
    patch,
  };
}
