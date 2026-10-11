"use client";
/**
 * useGridServerGroups (bt/grid-a G4): the group headers of a grouped server view — calls the source's
 * `loadGroups` for each new query (cancelling the previous one), keeps the last answer while a refresh
 * runs, and reports loading / error. Rows still come from `load` (useGridServerData), ordered by the
 * same group levels. 8.9: the answers of the last few queries are kept (`nodesFor`), so the grid can keep
 * the previous headers on screen until the new query's rows and headers are both in.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GridDataSource, GridQuery } from "./grid-data-core.ts";
import type { GridSummaryKind } from "./grid-core.ts";
import type { GridGroupNode } from "./grid-group-core.ts";
import { gridServerKey } from "./grid-data.ts";

export type GridServerGroups = {
  /** Headers of the current query (null until they arrive). */
  nodes: readonly GridGroupNode[] | null;
  truncated: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** 8.9: headers of a recent query by its cache key (the one whose rows are on screen). */
  nodesFor: (key: string) => readonly GridGroupNode[] | null;
  /** 8.9: add `delta` to the count of the group at `path` and its parents; false (nothing changed) when one is missing. */
  adjust: (path: readonly string[], delta: number) => boolean;
};

type Answer = { key: string; nodes: readonly GridGroupNode[]; truncated: boolean };
type State = { answers: readonly Answer[]; loading: string | null; error: { key: string; message: string } | null };
const KEEP_ANSWERS = 3;
const samePrefix = (node: GridGroupNode, path: readonly string[]) => node.path.length <= path.length && node.path.every((value, i) => String(value) === path[i]);

export function useGridServerGroups<T>(source: GridDataSource<T> | undefined, query: GridQuery, options: { enabled?: boolean; summaries?: Record<string, GridSummaryKind> } = {}): GridServerGroups {
  const enabled = Boolean(source?.loadGroups) && options.enabled !== false && Boolean(query.groups?.length);
  const key = gridServerKey(query, options.summaries);
  const [state, setState] = useState<State>({ answers: [], loading: null, error: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [generation, setGeneration] = useState(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const queryRef = useRef(query);
  queryRef.current = query;
  const summariesRef = useRef(options.summaries);
  summariesRef.current = options.summaries;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `generation` is the reload() trigger; source / query / summaries are read through refs, keyed by `key`.
  useEffect(() => {
    const load = sourceRef.current?.loadGroups;
    if (!enabled || !load) return;
    const controller = new AbortController();
    setState((old) => ({ ...old, loading: key, error: null }));
    load({ query: queryRef.current, summaries: summariesRef.current, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setState((old) => ({ answers: [{ key, nodes: result.groups, truncated: Boolean(result.truncated) }, ...old.answers.filter((a) => a.key !== key)].slice(0, KEEP_ANSWERS), loading: null, error: null }));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((old) => ({ ...old, loading: null, error: { key, message: error instanceof Error ? error.message : "分组加载失败" } }));
      });
    return () => controller.abort();
  }, [enabled, key, generation]);
  const refresh = useCallback(() => setGeneration((n) => n + 1), []);
  // Also while this query is not grouped: the previous grouped rows stay on screen until the new ones arrive.
  const nodesFor = useCallback((k: string) => stateRef.current.answers.find((a) => a.key === k)?.nodes ?? null, []);
  const adjust = useCallback((path: readonly string[], delta: number) => {
    const current = stateRef.current;
    const answer = current.answers.find((a) => a.key === key);
    if (!answer) return false;
    const hits = answer.nodes.filter((node) => samePrefix(node, path)).length;
    if (hits < path.length) return false;
    const nodes = answer.nodes.map((node) => (samePrefix(node, path) ? { ...node, count: Math.max(0, node.count + delta) } : node));
    const next = { ...current, answers: current.answers.map((a) => (a === answer ? { ...a, nodes } : a)) };
    stateRef.current = next;
    setState(next);
    return true;
  }, [key]);
  const answer = enabled ? state.answers.find((a) => a.key === key) : undefined;
  const error = enabled && state.error?.key === key ? state.error.message : null;
  return {
    nodes: answer?.nodes ?? null,
    truncated: Boolean(answer?.truncated),
    loading: enabled && (state.loading === key || (!answer && !error)),
    error,
    refresh,
    nodesFor,
    adjust,
  };
}
