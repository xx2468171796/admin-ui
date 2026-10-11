"use client";
/**
 * List data hooks of DataTable (moved out of data.tsx; still exported from it and from the root entry):
 * useDataSource (page / total) and useCursorDataSource (cursor stack). Load-state rules: data-core.ts.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  INITIAL_LIST_STATE,
  isSilentRun,
  listLoadReducer,
  mergeReloadMode,
  type ListLoadState,
  type ReloadMode,
} from "./data-core.ts";
import type { CursorListAdapter, CursorQuery, CursorResult, ListAdapter, ListQuery, ListResult } from "./contracts.ts";
import { useHostFunction } from "./host-function.ts";
/** `reload({ silent: true })` keeps the rows on screen; a click event passed as `onClick={reload}` is a normal reload. */
export type ReloadOptions = { silent?: boolean };
const requestedMode = (options: unknown): ReloadMode =>
  typeof options === "object" && options !== null && (options as ReloadOptions).silent === true ? "silent" : "normal";
const failureMessage = (err: unknown) => (err instanceof Error ? err.message : "加载失败");
/**
 * Comparison key of a query (only decides "did the query change"; the adapter always gets the original
 * object, so Dates stay Dates). Dates compare by time, bigints by value — JSON.stringify alone throws on them.
 */
export function listQueryKey(query: unknown): string {
  return (
    JSON.stringify(query, function (this: Record<string, unknown>, key: string, value: unknown) {
      const raw = this[key];
      if (raw instanceof Date) return { $date: raw.getTime() };
      return typeof value === "bigint" ? { $bigint: String(value) } : value;
    }) ?? ""
  );
}
/** The last page when `page` is past it (rows deleted on the last page); null when the page is fine or the list is empty. */
export function pageOverflow(page: number, total: number, pageSize: number): number | null {
  if (!(total > 0) || !(pageSize > 0)) return null;
  const last = Math.ceil(total / pageSize);
  return page > last ? last : null;
}
export type DataSourceOptions = {
  /**
   * The query's page is past the last page (a delete emptied the last page): called with the last page
   * so the host can move there (`setQuery(q => ({ ...q, page }))`). DataTable's footer does this by itself.
   */
  onPageOverflow?: (lastPage: number) => void;
};
/**
 * Page listing state. A changed query cancels the old request and never shows old rows.
 * `reload()` reloads with a loading state (unchanged behaviour); `refresh()` = `reload({ silent: true })`
 * refreshes in the background: rows stay, `refreshing` is true meanwhile, and a failure while rows
 * exist lands in `staleError` (show it with InlineAlert) instead of replacing the table with an error.
 */
export function useDataSource<T, F>(
  adapter: ListAdapter<T, F>,
  query: ListQuery<F>,
  options: DataSourceOptions = {},
) {
  const [state, dispatch] = useReducer(
    listLoadReducer<ListResult<T>>,
    INITIAL_LIST_STATE as ListLoadState<ListResult<T>>,
  );
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const pending = useRef<ReloadMode | null>(null);
  const lastKey = useRef<string | null>(null);
  const [host, generation] = useHostFunction(adapter);
  const latest = useRef({ query, options });
  latest.current = { query, options };
  const serialized = listQueryKey(query);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `generation` (a memoized adapter swapped) and `revision` (reload()) are re-run triggers; the query is read from `latest`, keyed by `serialized`.
  useEffect(() => {
    const request = ++sequence.current;
    const controller = new AbortController();
    const silent = isSilentRun(pending.current, lastKey.current, serialized);
    pending.current = null;
    lastKey.current = serialized;
    dispatch({ type: "start", silent });
    const asked = latest.current.query;
    Promise.resolve()
      .then(() => host.current(asked, { signal: controller.signal }))
      .then((data) => {
        if (request === sequence.current && !controller.signal.aborted) {
          if (
            !Number.isInteger(data.total) ||
            data.total < 0 ||
            !Array.isArray(data.rows)
          )
            throw Error("列表响应格式不正确");
          dispatch({ type: "success", data });
          const last = pageOverflow(asked.page, data.total, asked.pageSize);
          if (last !== null) latest.current.options.onPageOverflow?.(last);
        }
      })
      .catch((err) => {
        if (request === sequence.current && !controller.signal.aborted)
          dispatch({ type: "failure", message: failureMessage(err), silent });
      });
    return () => controller.abort();
  }, [generation, serialized, revision]);
  const reload = useCallback((options?: ReloadOptions | object) => {
    pending.current = mergeReloadMode(pending.current, requestedMode(options));
    setRevision((n) => n + 1);
  }, []);
  const refresh = useCallback(() => reload({ silent: true }), [reload]);
  return { ...state, reload, refresh };
}
/**
 * Cursor listing state. The hook owns the cursor stack, so filters/limit changes always
 * restart at the first page and no caller can hand a stale cursor to a new query.
 * `refresh()` / `reload({ silent: true })` re-reads the current page in the background (see useDataSource).
 */
export function useCursorDataSource<T, F>(
  adapter: CursorListAdapter<T, F>,
  query: Omit<CursorQuery<F>, "cursor">,
) {
  const [state, dispatch] = useReducer(
    listLoadReducer<CursorResult<T>>,
    INITIAL_LIST_STATE as ListLoadState<CursorResult<T>>,
  );
  const [stack, setStack] = useState<(string | null)[]>([null]);
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const pending = useRef<ReloadMode | null>(null);
  const lastKey = useRef<string | null>(null);
  const [host, generation] = useHostFunction(adapter);
  const latest = useRef(query);
  latest.current = query;
  const serialized = listQueryKey(query);
  const previous = useRef(serialized);
  if (previous.current !== serialized) {
    previous.current = serialized;
    if (stack.length !== 1 || stack[0] !== null) setStack([null]);
  }
  const cursor = stack[stack.length - 1] ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `generation` (a memoized adapter swapped) and `revision` (reload()) are re-run triggers; the query is read from `latest`, keyed by `serialized`.
  useEffect(() => {
    const request = ++sequence.current;
    const controller = new AbortController();
    // Moving to another page is a new key too: only a refresh of the same page keeps its rows.
    const key = JSON.stringify([serialized, cursor]);
    const silent = isSilentRun(pending.current, lastKey.current, key);
    pending.current = null;
    lastKey.current = key;
    dispatch({ type: "start", silent });
    const asked = { ...latest.current, cursor };
    Promise.resolve()
      .then(() => host.current(asked, { signal: controller.signal }))
      .then((data) => {
        if (request !== sequence.current || controller.signal.aborted) return;
        if (!Array.isArray(data.rows) || typeof data.hasMore !== "boolean")
          throw Error("游标列表响应格式不正确");
        if (data.hasMore && !data.nextCursor)
          throw Error("游标列表声明还有下一页但没有返回 nextCursor");
        dispatch({ type: "success", data });
      })
      .catch((err) => {
        if (request === sequence.current && !controller.signal.aborted)
          dispatch({ type: "failure", message: failureMessage(err), silent });
      });
    return () => controller.abort();
  }, [generation, serialized, cursor, revision]);
  const reload = useCallback((options?: ReloadOptions | object) => {
    pending.current = mergeReloadMode(pending.current, requestedMode(options));
    setRevision((n) => n + 1);
  }, []);
  const refresh = useCallback(() => reload({ silent: true }), [reload]);
  return {
    ...state,
    pageIndex: stack.length,
    canPrev: stack.length > 1 && !state.loading,
    canNext: Boolean(state.data?.hasMore && state.data.nextCursor) && !state.loading,
    next: () => {
      const nextCursor = state.data?.nextCursor;
      if (state.loading || !state.data?.hasMore || !nextCursor) return;
      setStack((s) => [...s, nextCursor]);
    },
    prev: () => {
      if (state.loading) return;
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    },
    reset: () => setStack([null]),
    reload,
    refresh,
  };
}
