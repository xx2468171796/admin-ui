/**
 * Data of one dashboard widget. Split out of dashboard-builder-widget.tsx (JSX) so the loading rules can be
 * unit-tested in node; dashboard-builder-widget.tsx re-exports `useWidgetData`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useHostFunction } from "./host-function.ts";
import { widgetDataKey, widgetFilterContext, type DashboardWidget } from "./dashboard-builder-core.ts";
import type { DashboardFilterValue } from "./dashboard-filters-core.ts";
import type { DashboardWidgetData, LoadWidgetData } from "./dashboard-builder-widget.tsx";

export type WidgetDataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardWidgetData }
  /** A reload failed: the last data stays on screen under a strip. */
  | { status: "stale"; data: DashboardWidgetData; message: string; at: number };

type Loaded = { key: string; data: DashboardWidgetData; at: number };
const CACHE_LIMIT = 200;
/**
 * Last answer per loader and widget key, shared by every card using that loader. A card that remounts — the
 * dashboard switching between its wide grid and the phone list when the window narrows or a phone rotates —
 * shows the data it already had at once and refreshes it quietly, instead of blanking to a skeleton for a
 * round trip (8.9.1: every card flashed for ~0.5 s on each breakpoint change). Keyed by the loader object, so a
 * host that passes a new inline loader every render simply gets no cache.
 */
const shared = new WeakMap<LoadWidgetData, Map<string, Loaded>>();
function cacheOf(load: LoadWidgetData): Map<string, Loaded> {
  let cache = shared.get(load);
  if (!cache) {
    cache = new Map();
    shared.set(load, cache);
  }
  return cache;
}
function remember(load: LoadWidgetData, entry: Loaded): void {
  const cache = cacheOf(load);
  cache.delete(entry.key);
  cache.set(entry.key, entry);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value ?? "");
}

/**
 * Data of one widget; `reload()` for the retry button. A change of query / filters shows the skeleton
 * again; a failed retry of the same query keeps the last data (stale) instead of blanking the card.
 */
export function useWidgetData(widget: DashboardWidget, context: DashboardFilterValue, load: LoadWidgetData | undefined) {
  const key = widgetDataKey(widget, context);
  const last = useRef<Loaded | null>(null);
  const [state, setState] = useState<WidgetDataState>(() => {
    const hit = load ? cacheOf(load).get(key) : undefined;
    last.current = hit ?? null;
    return hit ? { status: "ready", data: hit.data } : { status: "loading" };
  });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(widget);
  latest.current = widget;
  const latestContext = useRef(context);
  latestContext.current = context;
  // `load` through a ref: an inline loader is a new function every render, and an effect keyed on it
  // refetches → sets state → re-renders → refetches, forever. `loadGen` moves only on a real swap.
  const [loadRef, loadGen] = useHostFunction(load);
  const skip = widget.kind === "text" || !load;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` covers kind + query + items + target + the effective filter context (title / layout changes must not reload); `nonce` = retry; `loadGen` = a new loader.
  useEffect(() => {
    const run = loadRef.current;
    if (skip || !run) return;
    const controller = new AbortController();
    const kept = last.current?.key === key ? last.current : (cacheOf(run).get(key) ?? null);
    if (!kept) setState({ status: "loading" });
    run(latest.current, widgetFilterContext(latest.current, latestContext.current), controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        last.current = { key, data, at: Date.now() };
        remember(run, last.current);
        setState({ status: "ready", data });
      },
      (caught: unknown) => {
        if (controller.signal.aborted) return;
        const message = caught instanceof Error && caught.message ? caught.message : "数据加载失败";
        setState(kept ? { status: "stale", data: kept.data, message, at: kept.at } : { status: "error", message });
      },
    );
    return () => controller.abort();
  }, [key, nonce, loadGen, skip]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}
