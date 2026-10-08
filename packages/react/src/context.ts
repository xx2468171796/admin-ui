import { createContext, type Context } from "react";

/**
 * One React context per page, however many copies of this package get loaded. A dev server can
 * pre-bundle the root entry and serve a lazily imported subpath (`/charts`) from source, which makes
 * two module instances; module-level contexts would then split and AdminChart would throw
 * "must be inside AdminProvider" although it is. The global symbol registry is shared by both copies.
 */
export function sharedContext<T>(name: string): Context<T | null> {
  const key = Symbol.for(`@adminui/react:${name}`);
  const registry = globalThis as unknown as Record<symbol, Context<T | null> | undefined>;
  return (registry[key] ??= createContext<T | null>(null));
}
