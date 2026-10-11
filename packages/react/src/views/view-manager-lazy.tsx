"use client";
/**
 * The public ViewManager: the 「视图管理」 panel body only renders when the panel opens, so its module (tiers, drag
 * sort, menus, rename, delete) loads then — or earlier on hover / focus of ViewTabs' 「视图」 button and on idle
 * (`preloadViewManager`). A skeleton shows for the moment the first panel waits.
 */
import { Suspense, useEffect, type ReactNode } from "react";
import { ContentSkeleton } from "../loading.tsx";
import { lazyPart, whenIdle } from "../lazy-part.ts";
import type { ViewManagerProps } from "./view-manager.tsx";

const managerPart = /* @__PURE__ */ lazyPart(() => import("./view-manager.tsx").then((m) => m.ViewManager));
const LazyManager = managerPart.Part as (props: ViewManagerProps) => ReactNode;

/** Start loading the panel body (no-op once loaded). */
export const preloadViewManager = (): void => managerPart.preload();

/** ViewTabs with a `manager`: load the panel body on idle. */
export function usePreloadViewManager(enabled: boolean): void {
  useEffect(() => (enabled ? whenIdle(preloadViewManager) : undefined), [enabled]);
}

export function ViewManager(props: ViewManagerProps) {
  return (
    <Suspense fallback={<ContentSkeleton rows={5} />}>
      <LazyManager {...props} />
    </Suspense>
  );
}
