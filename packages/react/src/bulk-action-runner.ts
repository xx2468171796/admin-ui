/**
 * BulkActionBar behaviour (unit-tested with a stub document):
 * - focus never drops to <body>: the bar disappears when the selection empties (✕, Esc, an action that clears
 *   it) and takes the focused button with it, so focus goes back to `returnFocus()` or to the element that had
 *   it when the bar appeared (the row checkbox);
 * - an action whose `onSelect` returns a Promise marks the bar busy until it settles, and every click meanwhile
 *   is ignored (no double submit of 「批量删除」).
 */
import { useLayoutEffect, useRef, useState } from "react";

export function useBulkActionRunner(count: number, returnFocus?: () => HTMLElement | null | undefined) {
  const dock = useRef<HTMLDivElement | null>(null);
  const previous = useRef<HTMLElement | null>(null);
  const restore = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const running = useRef(false);
  const shown = count > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on show / hide of the dock; returnFocus is read from that render.
  useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    if (shown) {
      if (!dock.current?.contains(active)) previous.current = active;
    } else if (restore.current) {
      restore.current = false;
      (returnFocus?.() ?? previous.current)?.focus({ preventScroll: true });
    }
  }, [shown]);
  const start = () => {
    if (running.current) return false;
    restore.current = Boolean(dock.current?.contains(document.activeElement));
    return true;
  };
  return {
    dock,
    busy,
    /** ✕ / Esc. */
    clear: (onClear: () => void) => start() && onClear(),
    /** An action button; ignored while another one is running. */
    run(key: string, onSelect: () => unknown) {
      if (!start()) return;
      const result = onSelect();
      if (!(result instanceof Promise)) return;
      running.current = true;
      setBusy(key);
      void result.catch(() => {}).finally(() => {
        running.current = false;
        setBusy(null);
      });
    },
  };
}
