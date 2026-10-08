"use client";
/**
 * A component that is not on its view's first paint (a panel body, a cell editor, a lightbox): its module loads
 * on first render, or earlier through `preload()` (hover / focus of the button that opens it, or idle time once
 * the view can need it). Render it inside a `<Suspense>`. A failed load (offline, a deploy replaced the chunk)
 * is forgotten so the next `preload()` / fresh part tries again.
 */
import { lazy, type ComponentType } from "react";

export type LazyPart<C> = {
  /** The lazily loaded component (same props as the real one). */
  Part: C;
  /** Start loading now (no-op once loaded or loading). */
  preload: () => void;
};

/* @__NO_SIDE_EFFECTS__ */
export function lazyPart<C>(load: () => Promise<C>): LazyPart<C> {
  let pending: Promise<{ default: C }> | null = null;
  const get = () => {
    pending ??= load().then(
      (component) => ({ default: component }),
      (error: unknown) => {
        pending = null;
        throw error;
      },
    );
    return pending;
  };
  return {
    Part: lazy(get as unknown as () => Promise<{ default: ComponentType<object> }>) as unknown as C,
    preload: () => {
      get().catch(() => undefined);
    },
  };
}

/** Run `task` when the browser is idle (or soon, where requestIdleCallback is missing); returns a cancel. */
export function whenIdle(task: () => void, timeout = 2000): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 200);
  return () => window.clearTimeout(id);
}
