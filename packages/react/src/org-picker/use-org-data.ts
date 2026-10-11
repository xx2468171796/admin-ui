"use client";
/**
 * Data plumbing of the OrgPicker: the lazily loaded tree (roots, children on expand, an index of every
 * node seen, expanding straight down to a node through `pathOf`), the members of the node in the middle
 * (cursor pages, older answers dropped), debounced server search, and the list of a pluggable tab. All
 * calls go to the host's OrgDataSource; nothing is fetched on its own.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useHostFunction } from "../host-function.ts";
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
  // Read through a ref: an inline `source={{ … }}` is a new object every render; keyed on it, the tree reset
  // re-renders, which makes a new source, which resets again — forever. `sourceGen` moves only on a real swap.
  const [sourceRef, sourceGen] = useHostFunction(source);
  // The locale's message is read at failure time: a callback kept for one `sourceGen` must not report in the old locale.
  const [fallbackRef] = useHostFunction(fallback);
  const store = useRef({ roots: null as readonly OrgUnit[] | null, children: new Map<string, readonly OrgUnit[]>(), index: new Map<string, OrgUnit>(), expanded: new Set<string>(), loading: new Set<string>(), error: null as string | null, pending: new Map<string, Promise<readonly OrgUnit[]>>() });
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [attempt, setAttempt] = useState(0);
  const remember = useCallback((units: readonly OrgUnit[]) => {
    for (const u of units) store.current.index.set(u.id, { ...store.current.index.get(u.id), ...u });
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sourceGen` is the trigger — the host swapped to another directory, so everything cached from the old one is dropped.
  useEffect(() => {
    const s = store.current;
    s.roots = null;
    s.children = new Map();
    s.index = new Map();
    s.expanded = new Set();
    s.pending = new Map();
    s.error = null;
    bump();
  }, [sourceGen]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sourceGen` (source swapped, roots just cleared) and `attempt` (retry()) are re-run triggers; the source itself is read through its ref.
  useEffect(() => {
    if (!active || store.current.roots) return;
    let live = true;
    sourceRef.current.roots().then(
      (roots) => {
        if (!live) return;
        remember(roots);
        store.current.roots = roots;
        store.current.error = null;
        bump();
      },
      (error: unknown) => {
        if (!live) return;
        store.current.error = reasonOf(error, fallbackRef.current);
        bump();
      },
    );
    return () => {
      live = false;
    };
  }, [active, sourceGen, remember, attempt]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `sourceGen` must give a new loadChildren so `expand` / `reveal` built on the old source are replaced.
  const loadChildren = useCallback(
    (id: string): Promise<readonly OrgUnit[]> => {
      const s = store.current;
      const have = s.children.get(id);
      if (have) return Promise.resolve(have);
      const running = s.pending.get(id);
      if (running) return running;
      s.loading.add(id);
      bump();
      const p = sourceRef.current.loadChildren(id).then(
        (units) => {
          remember(units);
          s.children.set(id, units);
          return units;
        },
        (error: unknown) => {
          s.error = reasonOf(error, fallbackRef.current);
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
    [sourceGen, remember],
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `sourceGen` gives a new reveal (its `pathOf` comes from the swapped source).
  const reveal = useCallback(
    async (id: string) => {
      const s = store.current;
      let chain: string[] = [];
      if (!s.index.has(id) && sourceRef.current.pathOf) {
        const path = await sourceRef.current.pathOf(id);
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
    [sourceGen, remember, loadChildren],
  );
  const s = store.current;
  return { roots: s.roots, children: s.children, index: s.index, expanded: s.expanded, loading: s.loading, error: s.error, expand, collapse, reveal, remember, retry: () => { s.error = null; setAttempt((n) => n + 1); } };
}

export type MemberList = { items: readonly OrgPerson[]; total?: number; hiddenDeparted: number; loading: boolean; error: string | null; more: boolean; loadMore: () => void; retry: () => void };

/** People of `nodeId` (`deep` = with sub-departments), page by page. */
export function useMembers(source: OrgDataSource, nodeId: string | null, deep: boolean, fallback = "网络中断"): MemberList {
  const [sourceRef, sourceGen] = useHostFunction(source); // see useOrgTree
  const [fallbackRef] = useHostFunction(fallback);
  const [state, setState] = useState<{ key: string; items: readonly OrgPerson[]; cursor?: string; total?: number; hidden: number; loading: boolean; error: string | null }>({ key: "", items: [], hidden: 0, loading: false, error: null });
  const [attempt, setAttempt] = useState(0);
  const key = nodeId ? `${nodeId}|${deep}` : "";
  const live = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sourceGen` makes a new fetchPage on a source swap, which re-runs the load effect below.
  const fetchPage = useCallback(
    (cursor: string | undefined, append: boolean) => {
      if (!nodeId) return;
      live.current?.abort();
      const abort = new AbortController();
      live.current = abort;
      setState((s) => ({ ...s, key, loading: true, error: null, ...(append ? {} : { items: [], cursor: undefined, total: undefined, hidden: 0 }) }));
      sourceRef.current.loadMembers(nodeId, { deep, cursor, signal: abort.signal }).then(
        (page) => {
          if (abort.signal.aborted) return;
          setState((s) => ({ key, items: append ? [...s.items, ...page.items] : page.items, cursor: page.nextCursor, total: page.total, hidden: page.hiddenDeparted ?? 0, loading: false, error: null }));
        },
        (error: unknown) => {
          if (abort.signal.aborted) return;
          setState((s) => ({ ...s, loading: false, error: reasonOf(error, fallbackRef.current) }));
        },
      );
    },
    [sourceGen, nodeId, deep, key],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry() trigger.
  useEffect(() => {
    if (!nodeId) {
      setState({ key: "", items: [], hidden: 0, loading: false, error: null });
      return;
    }
    fetchPage(undefined, false);
    return () => live.current?.abort();
  }, [nodeId, fetchPage, attempt]);
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

/**
 * `hideUnselectable`: the loaded members minus the people `omit` leaves out, and how many were left out (the count
 * shown is the server total minus that). A page that was mostly left out may not fill `fill` px, so no scroll would
 * ever ask for the next one: it is asked for here. `omit` null = nothing left out.
 */
export function useListedMembers(list: MemberList, omit: ((person: OrgPerson) => boolean) | null, fill: number, rowH: number): { listed: readonly OrgPerson[]; omitted: number } {
  const listed = omit ? list.items.filter((p) => !omit(p)) : list.items;
  const short = Boolean(omit) && list.more && !list.loading && listed.length * rowH < fill;
  const [loadMore] = useHostFunction(list.loadMore);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `listed.length` re-checks after each page; loadMore is read through its ref.
  useEffect(() => {
    if (short) loadMore.current();
  }, [short, listed.length]);
  return { listed, omitted: list.items.length - listed.length };
}

/** Server search, 200 ms after the last keystroke; answers to older queries are dropped. */
export function useOrgSearch(source: OrgDataSource, query: string, kinds: readonly SubjectKind[], limit = 60, fallback = "网络中断"): { hits: readonly OrgSearchHit[]; loading: boolean; error: string | null; query: string } {
  const [sourceRef, sourceGen] = useHostFunction(source); // see useOrgTree
  const [fallbackRef] = useHostFunction(fallback);
  const [state, setState] = useState<{ query: string; hits: readonly OrgSearchHit[]; error: string | null }>({ query: "", hits: [], error: null });
  const q = query.trim();
  const kindKey = kinds.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sourceGen` re-runs the search against a swapped source; `kinds` is keyed by its value (`kindKey`), not array identity.
  useEffect(() => {
    if (!q) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      sourceRef.current.search(q, { kinds: kindKey.split(",") as SubjectKind[], limit, signal: abort.signal }).then(
        (hits) => !abort.signal.aborted && setState({ query: q, hits, error: null }),
        (error: unknown) => !abort.signal.aborted && setState({ query: q, hits: [], error: reasonOf(error, fallbackRef.current) }),
      );
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [sourceGen, q, kindKey, limit]);
  const current = state.query === q;
  return { hits: current ? state.hits : [], loading: Boolean(q) && !current, error: current ? state.error : null, query: q };
}

/** The list of a pluggable tab (roles, lines, companies …), filtered by the query on the host's side. */
export function useSourceList(source: PickerSource | null, query: string, fallback = "网络中断"): { items: readonly PickedSubject[]; loading: boolean; error: string | null } {
  const [sourceRef, sourceGen] = useHostFunction(source); // see useOrgTree
  const [fallbackRef] = useHostFunction(fallback);
  const [state, setState] = useState<{ key: string; items: readonly PickedSubject[]; error: string | null }>({ key: "", items: [], error: null });
  const key = source ? `${source.key}|${query.trim()}` : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sourceGen` re-lists from a swapped source; the source itself is read through its ref.
  useEffect(() => {
    const src = sourceRef.current;
    if (!src) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      src.list({ query: query.trim(), signal: abort.signal }).then(
        (items) => !abort.signal.aborted && setState({ key, items, error: null }),
        (error: unknown) => !abort.signal.aborted && setState({ key, items: [], error: reasonOf(error, fallbackRef.current) }),
      );
    }, query.trim() ? 200 : 0);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [sourceGen, query, key]);
  const current = state.key === key;
  return { items: current ? state.items : [], loading: Boolean(source) && !current, error: current ? state.error : null };
}
