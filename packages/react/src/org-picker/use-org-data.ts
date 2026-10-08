"use client";
/**
 * Data plumbing of the OrgPicker: the lazily loaded tree (roots, children on expand, an index of every
 * node seen, expanding straight down to a node through `pathOf`), the members of the node in the middle
 * (cursor pages, older answers dropped), debounced server search, and the list of a pluggable tab. All
 * calls go to the host's OrgDataSource; nothing is fetched on its own.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { OrgDataSource, OrgPerson, OrgSearchHit, OrgUnit, PickedSubject, PickerSource, SubjectKind } from "./org-picker-core.ts";

/** The message of a failed call; `fallback` (the locale's 「网络中断」) when it has none. */
const reasonOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export type OrgTree = {
  roots: readonly OrgUnit[] | null;
  children: ReadonlyMap<string, readonly OrgUnit[]>;
  index: ReadonlyMap<string, OrgUnit>;
  expanded: ReadonlySet<string>;
  loading: ReadonlySet<string>;
  error: string | null;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  /** Expand every ancestor of `id` (loading what's missing); resolves with the chain root → node. */
  reveal: (id: string) => Promise<string[]>;
  remember: (units: readonly OrgUnit[]) => void;
  retry: () => void;
};

/** The tree of `source`, loaded when `active` turns true. */
export function useOrgTree(source: OrgDataSource, active: boolean, fallback = "网络中断"): OrgTree {
  const reason = (error: unknown) => reasonOf(error, fallback);
  const store = useRef({ roots: null as readonly OrgUnit[] | null, children: new Map<string, readonly OrgUnit[]>(), index: new Map<string, OrgUnit>(), expanded: new Set<string>(), loading: new Set<string>(), error: null as string | null, pending: new Map<string, Promise<readonly OrgUnit[]>>() });
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [attempt, setAttempt] = useState(0);
  const remember = useCallback((units: readonly OrgUnit[]) => {
    for (const u of units) store.current.index.set(u.id, { ...store.current.index.get(u.id), ...u });
  }, []);
  useEffect(() => {
    const s = store.current;
    s.roots = null;
    s.children = new Map();
    s.index = new Map();
    s.expanded = new Set();
    s.pending = new Map();
    s.error = null;
    bump();
  }, [source]);
  useEffect(() => {
    if (!active || store.current.roots) return;
    let live = true;
    source.roots().then(
      (roots) => {
        if (!live) return;
        remember(roots);
        store.current.roots = roots;
        store.current.error = null;
        bump();
      },
      (error: unknown) => {
        if (!live) return;
        store.current.error = reason(error);
        bump();
      },
    );
    return () => {
      live = false;
    };
  }, [active, source, remember, attempt]);
  const loadChildren = useCallback(
    (id: string): Promise<readonly OrgUnit[]> => {
      const s = store.current;
      const have = s.children.get(id);
      if (have) return Promise.resolve(have);
      const running = s.pending.get(id);
      if (running) return running;
      s.loading.add(id);
      bump();
      const p = source.loadChildren(id).then(
        (units) => {
          remember(units);
          s.children.set(id, units);
          return units;
        },
        (error: unknown) => {
          s.error = reason(error);
          return [] as readonly OrgUnit[];
        },
      ).finally(() => {
        s.loading.delete(id);
        s.pending.delete(id);
        bump();
      });
      s.pending.set(id, p);
      return p;
    },
    [source, remember],
  );
  const expand = useCallback(
    (id: string) => {
      store.current.expanded.add(id);
      bump();
      void loadChildren(id);
    },
    [loadChildren],
  );
  const collapse = useCallback((id: string) => {
    store.current.expanded.delete(id);
    bump();
  }, []);
  const reveal = useCallback(
    async (id: string) => {
      const s = store.current;
      let chain: string[] = [];
      if (!s.index.has(id) && source.pathOf) {
        const path = await source.pathOf(id);
        remember(path);
        chain = path.map((u) => u.id);
      } else {
        for (let at: string | null = id; at && s.index.has(at); at = s.index.get(at)?.parentId ?? null) chain.unshift(at);
      }
      for (const up of chain.slice(0, -1)) {
        s.expanded.add(up);
        await loadChildren(up);
      }
      bump();
      return chain;
    },
    [source, remember, loadChildren],
  );
  const s = store.current;
  return { roots: s.roots, children: s.children, index: s.index, expanded: s.expanded, loading: s.loading, error: s.error, expand, collapse, reveal, remember, retry: () => { s.error = null; setAttempt((n) => n + 1); } };
}

export type MemberList = { items: readonly OrgPerson[]; total?: number; hiddenDeparted: number; loading: boolean; error: string | null; more: boolean; loadMore: () => void; retry: () => void };

/** People of `nodeId` (`deep` = with sub-departments), page by page. */
export function useMembers(source: OrgDataSource, nodeId: string | null, deep: boolean, fallback = "网络中断"): MemberList {
  const reason = (error: unknown) => reasonOf(error, fallback);
  const [state, setState] = useState<{ key: string; items: readonly OrgPerson[]; cursor?: string; total?: number; hidden: number; loading: boolean; error: string | null }>({ key: "", items: [], hidden: 0, loading: false, error: null });
  const [attempt, setAttempt] = useState(0);
  const key = nodeId ? `${nodeId}|${deep}` : "";
  const live = useRef<AbortController | null>(null);
  const fetchPage = useCallback(
    (cursor: string | undefined, append: boolean) => {
      if (!nodeId) return;
      live.current?.abort();
      const abort = new AbortController();
      live.current = abort;
      setState((s) => ({ ...s, key, loading: true, error: null, ...(append ? {} : { items: [], cursor: undefined, total: undefined, hidden: 0 }) }));
      source.loadMembers(nodeId, { deep, cursor, signal: abort.signal }).then(
        (page) => {
          if (abort.signal.aborted) return;
          setState((s) => ({ key, items: append ? [...s.items, ...page.items] : page.items, cursor: page.nextCursor, total: page.total, hidden: page.hiddenDeparted ?? 0, loading: false, error: null }));
        },
        (error: unknown) => {
          if (abort.signal.aborted) return;
          setState((s) => ({ ...s, loading: false, error: reason(error) }));
        },
      );
    },
    [source, nodeId, deep, key],
  );
  useEffect(() => {
    if (!nodeId) {
      setState({ key: "", items: [], hidden: 0, loading: false, error: null });
      return;
    }
    fetchPage(undefined, false);
    return () => live.current?.abort();
  }, [nodeId, deep, fetchPage, attempt]);
  const current = state.key === key;
  return {
    items: current ? state.items : [],
    total: current ? state.total : undefined,
    hiddenDeparted: current ? state.hidden : 0,
    loading: !current || state.loading,
    error: current ? state.error : null,
    more: current && Boolean(state.cursor),
    loadMore: () => {
      if (current && state.cursor && !state.loading) fetchPage(state.cursor, true);
    },
    retry: () => setAttempt((n) => n + 1),
  };
}

/** Server search, 200 ms after the last keystroke; answers to older queries are dropped. */
export function useOrgSearch(source: OrgDataSource, query: string, kinds: readonly SubjectKind[], limit = 60, fallback = "网络中断"): { hits: readonly OrgSearchHit[]; loading: boolean; error: string | null; query: string } {
  const reason = (error: unknown) => reasonOf(error, fallback);
  const [state, setState] = useState<{ query: string; hits: readonly OrgSearchHit[]; error: string | null }>({ query: "", hits: [], error: null });
  const q = query.trim();
  const kindKey = kinds.join(",");
  useEffect(() => {
    if (!q) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      source.search(q, { kinds: kindKey.split(",") as SubjectKind[], limit, signal: abort.signal }).then(
        (hits) => !abort.signal.aborted && setState({ query: q, hits, error: null }),
        (error: unknown) => !abort.signal.aborted && setState({ query: q, hits: [], error: reason(error) }),
      );
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [source, q, kindKey, limit]);
  const current = state.query === q;
  return { hits: current ? state.hits : [], loading: Boolean(q) && !current, error: current ? state.error : null, query: q };
}

/** The list of a pluggable tab (roles, lines, companies …), filtered by the query on the host's side. */
export function useSourceList(source: PickerSource | null, query: string, fallback = "网络中断"): { items: readonly PickedSubject[]; loading: boolean; error: string | null } {
  const reason = (error: unknown) => reasonOf(error, fallback);
  const [state, setState] = useState<{ key: string; items: readonly PickedSubject[]; error: string | null }>({ key: "", items: [], error: null });
  const key = source ? `${source.key}|${query.trim()}` : "";
  useEffect(() => {
    if (!source) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      source.list({ query: query.trim(), signal: abort.signal }).then(
        (items) => !abort.signal.aborted && setState({ key, items, error: null }),
        (error: unknown) => !abort.signal.aborted && setState({ key, items: [], error: reason(error) }),
      );
    }, query.trim() ? 200 : 0);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [source, query, key]);
  const current = state.key === key;
  return { items: current ? state.items : [], loading: Boolean(source) && !current, error: current ? state.error : null };
}
