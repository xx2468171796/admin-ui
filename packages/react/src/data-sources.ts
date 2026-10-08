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
/** `reload({ silent: true })` keeps the rows on screen; a click event passed as `onClick={reload}` is a normal reload. */
export type ReloadOptions = { silent?: boolean };
const requestedMode = (options: unknown): ReloadMode =>
  typeof options === "object" && options !== null && (options as ReloadOptions).silent === true ? "silent" : "normal";
const failureMessage = (err: unknown) => (err instanceof Error ? err.message : "加载失败");
/**
 * Page listing state. A changed query cancels the old request and never shows old rows.
 * `reload()` reloads with a loading state (unchanged behaviour); `refresh()` = `reload({ silent: true })`
 * refreshes in the background: rows stay, `refreshing` is true meanwhile, and a failure while rows
 * exist lands in `staleError` (show it with InlineAlert) instead of replacing the table with an error.
 */
export function useDataSource<T, F>(
  adapter: ListAdapter<T, F>,
  query: ListQuery<F>,
) {
  const [state, dispatch] = useReducer(
    listLoadReducer<ListResult<T>>,
    INITIAL_LIST_STATE as ListLoadState<ListResult<T>>,
  );
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const pending = useRef<ReloadMode | null>(null);
  const lastKey = useRef<string | null>(null);
  const serialized = JSON.stringify(query);
  useEffect(() => {
    const request = ++sequence.current;
    const controller = new AbortController();
    const silent = isSilentRun(pending.current, lastKey.current, serialized);
    pending.current = null;
    lastKey.current = serialized;
    dispatch({ type: "start", silent });
    Promise.resolve()
      .then(() =>
        adapter(JSON.parse(serialized), { signal: controller.signal }),
      )
      .then((data) => {
        if (request === sequence.current && !controller.signal.aborted) {
          if (
            !Number.isInteger(data.total) ||
            data.total < 0 ||
            !Array.isArray(data.rows)
          )
            throw Error("列表响应格式不正确");
          dispatch({ type: "success", data });
        }
      })
      .catch((err) => {
        if (request === sequence.current && !controller.signal.aborted)
          dispatch({ type: "failure", message: failureMessage(err), silent });
      });
    return () => controller.abort();
  }, [adapter, serialized, revision]);
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
  const serialized = JSON.stringify(query);
  const previous = useRef(serialized);
  if (previous.current !== serialized) {
    previous.current = serialized;
    if (stack.length !== 1 || stack[0] !== null) setStack([null]);
  }
  const cursor = stack[stack.length - 1] ?? null;
  useEffect(() => {
    const request = ++sequence.current;
    const controller = new AbortController();
    // Moving to another page is a new key too: only a refresh of the same page keeps its rows.
    const key = JSON.stringify([serialized, cursor]);
    const silent = isSilentRun(pending.current, lastKey.current, key);
    pending.current = null;
    lastKey.current = key;
    dispatch({ type: "start", silent });
    Promise.resolve()
      .then(() =>
        adapter(
          { ...(JSON.parse(serialized) as Omit<CursorQuery<F>, "cursor">), cursor },
          { signal: controller.signal },
        ),
      )
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
  }, [adapter, serialized, cursor, revision]);
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
