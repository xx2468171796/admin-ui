"use client";
/**
 * useGridServerGroups (bt/grid-a G4): the group headers of a grouped server view — calls the source's
 * `loadGroups` for each new query (cancelling the previous one), keeps the last answer while a refresh
 * runs, and reports loading / error. Rows still come from `load` (useGridServerData), ordered by the
 * same group levels.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { gridQueryKey, type GridDataSource, type GridQuery } from "./grid-data-core.ts";
import type { GridSummaryKind } from "./grid-core.ts";
import type { GridGroupNode } from "./grid-group-core.ts";

export type GridServerGroups = {
  nodes: readonly GridGroupNode[] | null;
  truncated: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useGridServerGroups<T>(source: GridDataSource<T> | undefined, query: GridQuery, options: { enabled?: boolean; summaries?: Record<string, GridSummaryKind> } = {}): GridServerGroups {
  const enabled = Boolean(source?.loadGroups) && options.enabled !== false && Boolean(query.groups?.length);
  const key = `${gridQueryKey(query)}|${JSON.stringify(options.summaries ?? {})}`;
  const [state, setState] = useState<{ key: string; nodes: readonly GridGroupNode[] | null; truncated: boolean; error: string | null; loading: boolean }>({ key: "", nodes: null, truncated: false, error: null, loading: false });
  const [generation, setGeneration] = useState(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const queryRef = useRef(query);
  queryRef.current = query;
  const summariesRef = useRef(options.summaries);
  summariesRef.current = options.summaries;
  useEffect(() => {
    const load = sourceRef.current?.loadGroups;
    if (!enabled || !load) return;
    const controller = new AbortController();
    setState((old) => ({ key, nodes: old.key === key ? old.nodes : null, truncated: old.key === key && old.truncated, error: null, loading: true }));
    load({ query: queryRef.current, summaries: summariesRef.current, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setState({ key, nodes: result.groups, truncated: Boolean(result.truncated), error: null, loading: false }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState((old) => ({ ...old, key, error: error instanceof Error ? error.message : "分组加载失败", loading: false })); });
    return () => controller.abort();
  }, [enabled, key, generation]);
  const refresh = useCallback(() => setGeneration((n) => n + 1), []);
  const current = state.key === key;
  return { nodes: enabled && current ? state.nodes : null, truncated: current && state.truncated, loading: enabled && (!current || state.loading), error: enabled && current ? state.error : null, refresh };
}
