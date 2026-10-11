/**
 * Host functions handed to the data hooks (list adapters, store adapters, event subscriptions) are read
 * through a ref, never listed as effect dependencies: an inline arrow (`useDataSource(async (q) => …, query)`)
 * is a new function on every render, and an effect keyed on it refetches → sets state → re-renders → refetches
 * forever.
 *
 * `generation` keeps the legacy "a memoized adapter whose dependencies changed reloads" behaviour: it moves
 * only when the identity changes after having been the same for at least one render. An identity that
 * changes on every render never moves it. Prefer `reload()` for "the data behind the adapter changed".
 */
import { useRef } from "react";

export function useHostFunction<F>(fn: F): readonly [{ readonly current: F }, number] {
  const ref = useRef(fn);
  const meta = useRef({ seen: false, stable: false, generation: 0 });
  if (!meta.current.seen) meta.current.seen = true;
  else if (ref.current === fn) meta.current.stable = true;
  else {
    if (meta.current.stable) meta.current.generation++;
    meta.current.stable = false;
    ref.current = fn;
  }
  return [ref, meta.current.generation];
}
