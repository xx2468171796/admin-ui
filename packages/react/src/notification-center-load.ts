"use client";
/**
 * NotificationCenter: one cursor-paged list that loads while it is shown. Every
 * request has an AbortController — closing the panel, switching tab / filter or a refresh aborts it. A
 * refresh with rows on screen keeps them until the new first page arrives (no skeleton flash).
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { mergePages } from "./notification-core.ts";

export type PagedResult<T> = { items: readonly T[]; nextCursor?: string | null };
export type PagedLoader<T> = (cursor: string | null, signal: AbortSignal) => Promise<PagedResult<T>>;

export type PagedList<T> = {
  status: "loading" | "ready" | "error";
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  retry: () => void;
  loadMore: () => void;
};

/** The message of a rejected promise, or the fallback. */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : typeof error === "string" && error ? error : fallback;
}

type ListState<T> = { key: string; status: "loading" | "ready" | "error"; items: T[]; cursor: string | null; error: string | null };

export function usePagedList<T extends { id: string }>(active: boolean, key: string, load: PagedLoader<T>, refreshKey: unknown): PagedList<T> {
  const [state, setState] = useState<ListState<T>>({ key, status: "loading", items: [], cursor: null, error: null });
  const [more, setMore] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const moreCtrl = useRef<AbortController | null>(null);
  const cursorRef = useRef<string | null>(null);
  cursorRef.current = state.key === key ? state.cursor : null;

  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    setMore({ loading: false, error: null });
    setState((prev) => (prev.key === key && prev.status === "ready" ? prev : { key, status: "loading", items: [], cursor: null, error: null }));
    loadRef.current(null, ctrl.signal).then(
      (page) => {
        if (!ctrl.signal.aborted) setState({ key, status: "ready", items: [...page.items], cursor: page.nextCursor ?? null, error: null });
      },
      (error: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((prev) => (prev.key === key && prev.status === "ready" ? prev : { key, status: "error", items: [], cursor: null, error: errorText(error, "没加载出来") }));
      },
    );
    return () => {
      ctrl.abort();
      moreCtrl.current?.abort();
      moreCtrl.current = null;
    };
  }, [active, key, refreshKey, attempt]);

  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor || moreCtrl.current) return;
    const ctrl = new AbortController();
    moreCtrl.current = ctrl;
    setMore({ loading: true, error: null });
    loadRef.current(cursor, ctrl.signal).then(
      (page) => {
        if (ctrl.signal.aborted) return;
        moreCtrl.current = null;
        setState((prev) => ({ ...prev, items: mergePages(prev.items, page.items), cursor: page.nextCursor ?? null }));
        setMore({ loading: false, error: null });
      },
      (error: unknown) => {
        if (ctrl.signal.aborted) return;
        moreCtrl.current = null;
        setMore({ loading: false, error: errorText(error, "没加载出来") });
      },
    );
  }, []);

  const setItems = useCallback<Dispatch<SetStateAction<T[]>>>((next) => {
    setState((prev) => ({ ...prev, items: typeof next === "function" ? next(prev.items) : next }));
  }, []);

  const current = state.key === key;
  return {
    status: current ? state.status : "loading",
    items: current ? state.items : [],
    setItems,
    error: current ? state.error : null,
    hasMore: current && Boolean(state.cursor),
    loadingMore: more.loading,
    moreError: more.error,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
    loadMore,
  };
}

type PendingRead = { id: string; base: number; done: boolean };
/**
 * A host count (unread / 待我处理) minus what was handled here and the host has not counted yet. An entry
 * stays while its request runs, and after it succeeds until the host reports a different count (some hosts
 * update the count inside the request, some refetch it later). A failed request drops its entry. Not
 * `optimistic`: a running request does not lower the count yet (待我处理 drops only when the action succeeded).
 */
export function usePendingCount(count: number, optimistic = true) {
  const [list, setList] = useState<PendingRead[]>([]);
  const live = list.filter((p) => !p.done || p.base === count);
  if (live.length !== list.length) setList(live);
  const countRef = useRef(count);
  countRef.current = count;
  const start = useCallback((id: string) => setList((l) => [...l.filter((p) => p.id !== id), { id, base: countRef.current, done: false }]), []);
  const finish = useCallback((id: string, ok: boolean) => setList((l) => (ok ? l.map((p) => (p.id === id ? { ...p, done: true } : p)) : l.filter((p) => p.id !== id))), []);
  const counted = live.filter((p) => optimistic || p.done).length;
  return { shown: Math.max(0, count - counted), active: counted, start, finish };
}
