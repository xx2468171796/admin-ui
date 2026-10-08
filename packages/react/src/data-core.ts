/**
 * Load-state transitions shared by useDataSource / useCursorDataSource. Pure: no React, so the
 * rules are unit-tested directly.
 *
 * A normal load replaces the table with a loading state (a new query must never show old rows).
 * A silent refresh keeps the rows on screen; if it fails while rows exist, the failure becomes
 * `staleError` and the rows stay, instead of the whole table turning into an error panel.
 */
export type ListLoadState<D> = {
  data?: D;
  loading: boolean;
  /** Load failed and there is nothing to show. */
  error?: string;
  /** A silent refresh is in flight; rows on screen are the previous result. */
  refreshing: boolean;
  /** The last silent refresh failed; the rows on screen may be out of date. */
  staleError?: string;
};

export type ListLoadEvent<D> =
  | { type: "start"; silent: boolean }
  | { type: "success"; data: D }
  | { type: "failure"; message: string; silent: boolean };

export const INITIAL_LIST_STATE: ListLoadState<never> = { loading: true, refreshing: false };

export function listLoadReducer<D>(state: ListLoadState<D>, event: ListLoadEvent<D>): ListLoadState<D> {
  switch (event.type) {
    case "start":
      // Silent only keeps what is there; with nothing loaded yet it is an ordinary (re)load.
      if (event.silent && state.data !== undefined) return { ...state, refreshing: true };
      if (event.silent && state.loading) return state;
      return { loading: true, refreshing: false };
    case "success":
      return { data: event.data, loading: false, refreshing: false };
    case "failure":
      if (event.silent && state.data !== undefined)
        return { data: state.data, loading: false, refreshing: false, staleError: event.message };
      return { loading: false, refreshing: false, error: event.message };
  }
}

/**
 * Pending reload requests between two effect runs collapse into one. A normal reload wins over a
 * silent one, and a changed query key always loads normally (old rows must not stand in for a new
 * query).
 */
export type ReloadMode = "silent" | "normal";
export function mergeReloadMode(pending: ReloadMode | null, next: ReloadMode): ReloadMode {
  return pending === "normal" || next === "normal" ? "normal" : "silent";
}
export function isSilentRun(pending: ReloadMode | null, previousKey: string | null, key: string): boolean {
  return pending === "silent" && previousKey === key;
}
