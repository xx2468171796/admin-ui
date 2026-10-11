/**
 * One ResizeObserver for many elements (every tag / people cell of a grid used to create its own): elements
 * register a callback, the shared observer dispatches each entry to its element's callback. Injectable
 * constructor so it is unit-tested without a DOM (test/grid-perf-core.test.ts).
 */
type ObserverLike = { observe(target: Element): void; unobserve(target: Element): void };
type ObserverCtor = new (callback: (entries: readonly { target: Element }[]) => void) => ObserverLike;

export function createSharedResizeObserver(Ctor: ObserverCtor | undefined) {
  let observer: ObserverLike | null = null;
  const callbacks = new Map<Element, () => void>();
  /** Watch `node`'s size; returns the unwatch function. No-op where ResizeObserver does not exist (SSR). */
  return function observeSize(node: Element, run: () => void): () => void {
    if (!Ctor) return () => undefined;
    observer ??= new Ctor((entries) => {
      for (const entry of entries) callbacks.get(entry.target)?.();
    });
    const shared = observer;
    callbacks.set(node, run);
    shared.observe(node);
    return () => {
      if (callbacks.get(node) !== run) return;
      callbacks.delete(node);
      shared.unobserve(node);
    };
  };
}

/** The page-wide shared observer (cells.tsx ChipList). */
export const observeSize = /* @__PURE__ */ createSharedResizeObserver(typeof ResizeObserver === "undefined" ? undefined : ResizeObserver);
