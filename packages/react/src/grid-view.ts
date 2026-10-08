"use client";
/** useGridView: BitableGrid view state persisted per key (localStorage) or through host callbacks. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TableRowHeightPreset } from "./table-rows.ts";
import { normalizeGridView, parseGridView, serializeGridView, type GridField, type GridView, type GridViewInput } from "./grid-core.ts";

// ---------------------------------------------------------------- view hook

export type UseGridViewOptions = {
  /** localStorage key; include project / user / table, e.g. `crm:u42:deals:view`. */
  storageKey?: string;
  /** Starting view for new users (and 恢复默认); older shapes (`groupBy: "stage"`, flat `filters`) are fine. */
  defaults?: GridViewInput;
  rowHeight?: TableRowHeightPreset;
  /**
   * Host persistence instead of localStorage (e.g. per-user settings API): read once, save on change.
   * May return the stored value (view object or serialized string) or a Promise of it: until it
   * resolves the grid shows `defaults` with `loading` true and nothing is saved; a change the user
   * makes meanwhile wins over the loaded view.
   */
  load?: () => unknown;
  save?: (view: GridView) => void | Promise<void>;
  /** Persist the search text too (default false: a reopened page starts without a stale search). */
  persistSearch?: boolean;
};
const isThenable = (value: unknown): value is PromiseLike<unknown> => typeof (value as PromiseLike<unknown> | null)?.then === "function";
type ViewState = { key: string | undefined; view: GridView; pending: PromiseLike<unknown> | null; error: string | null; touched: boolean; version: number };
/**
 * View state for BitableGrid, persisted per key (localStorage) or through host callbacks (sync or
 * async `load`). Stored views are validated against the current fields (removed fields dropped, new
 * ones appended, pre-v2 shapes migrated).
 */
export function useGridView<T>(fields: readonly GridField<T>[], options: UseGridViewOptions = {}) {
  const { storageKey, defaults, rowHeight, persistSearch = false } = options;
  const loadRef = useRef(options.load);
  loadRef.current = options.load;
  const fallback = () => normalizeGridView(defaults ?? {}, fields, { rowHeight });
  const fromStored = (value: unknown): GridView =>
    value ? normalizeGridView(typeof value === "string" ? parseGridView(value, fields, { rowHeight }) ?? defaults ?? {} : value, fields, { rowHeight }) : fallback();
  const read = (key: string | undefined): ViewState => {
    const base = { key, error: null, touched: false, version: 0 };
    const fromHost = loadRef.current?.();
    if (isThenable(fromHost)) return { ...base, view: fallback(), pending: fromHost };
    if (fromHost) return { ...base, view: fromStored(fromHost), pending: null };
    if (key && typeof localStorage !== "undefined") {
      try {
        return { ...base, view: parseGridView(localStorage.getItem(key), fields, { rowHeight }) ?? fallback(), pending: null };
      } catch {
        return { ...base, view: fallback(), pending: null };
      }
    }
    return { ...base, view: fallback(), pending: null };
  };
  const [state, setState] = useState<ViewState>(() => read(storageKey));
  if (state.key !== storageKey) setState(read(storageKey));
  // Async load: apply the answer unless the user already changed the view.
  useEffect(() => {
    const pending = state.pending;
    if (!pending) return;
    let live = true;
    pending.then(
      (value) => { if (live) setState((old) => (old.pending !== pending ? old : { ...old, pending: null, view: old.touched ? old.view : fromStored(value) })); },
      (error: unknown) => { if (live) setState((old) => (old.pending !== pending ? old : { ...old, pending: null, error: error instanceof Error ? error.message : "视图设置加载失败" })); },
    );
    return () => { live = false; };
  }, [state.pending]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = useMemo(() => normalizeGridView(state.view, fields, { rowHeight }), [state.view, fields, rowHeight]);
  const save = useRef(options.save);
  save.current = options.save;
  // Debounced write; a pending write is flushed when the page hides or the grid unmounts, so a
  // quick reload right after dragging a column does not lose it. Only the user's changes are saved.
  const pending = useRef<{ key: string | undefined; view: GridView } | null>(null);
  const flush = useCallback(() => {
    const job = pending.current;
    pending.current = null;
    if (!job) return;
    try {
      if (save.current) void Promise.resolve(save.current(job.view)).catch(() => undefined);
      else if (job.key) localStorage.setItem(job.key, serializeGridView(job.view));
    } catch {
      /* storage full / blocked: the view still works for this session */
    }
  }, []);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);
  useEffect(() => {
    if (!state.version) return;
    pending.current = { key: storageKey, view: persistSearch ? view : { ...view, search: "" } };
    const timer = setTimeout(flush, 150);
    return () => clearTimeout(timer);
  }, [state.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const onViewChange = useCallback((next: GridView) => setState((old) => ({ ...old, view: next, touched: true, version: old.version + 1 })), []);
  const reset = () => setState((old) => ({ ...old, view: fallback(), touched: true, version: old.version + 1 }));
  return { view, onViewChange, reset, loading: state.pending !== null, error: state.error };
}

