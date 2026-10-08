"use client";
/**
 * Media-query hooks shared by the components and the apps (they used to copy their own). SSR-safe:
 * the server render and the first client render read `serverValue` (default false), then the hook
 * follows the real query — no hydration mismatch, no `window` access during render on the server.
 */
import { useCallback, useSyncExternalStore } from "react";

/** Phone layout breakpoint used across the SDK (AdminShell, RailShell, BitableGrid cards, access cards). */
export const MOBILE_QUERY = "(max-width: 760px)";

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** True while `query` matches (e.g. `"(max-width: 1100px)"`, `"(pointer: coarse)"`); re-renders on change. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  const read = () => (canMatch() ? window.matchMedia(query).matches : serverValue);
  return useSyncExternalStore(subscribe, read, () => serverValue);
}

/** Phone layout (≤ 760px, the SDK's mobile breakpoint); pass another max width for your own breakpoint. */
export function useIsMobile(maxWidth = 760): boolean {
  return useMediaQuery(maxWidth === 760 ? MOBILE_QUERY : `(max-width: ${maxWidth}px)`);
}
