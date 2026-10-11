import { useMemo, useRef } from "react";

/**
 * An object of callbacks whose identity never changes but that always calls the latest implementation — handed
 * to memoized rows so a new closure per render does not re-render every row.
 */
export function useStableHandlers<H extends object>(impl: H): H {
  const ref = useRef(impl);
  ref.current = impl;
  return useMemo(
    () => new Proxy({} as H, {
      get: (_target, key) => (...args: unknown[]) => {
        const fn = ref.current[key as keyof H];
        return typeof fn === "function" ? (fn as (...a: unknown[]) => unknown)(...args) : undefined;
      },
    }),
    [],
  );
}
