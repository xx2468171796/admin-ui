"use client";
/**
 * The public GridCellEditor (record forms, side panels): the editors module (text / select / date picker / rating …)
 * is not on the first paint — it loads with the first editor shown (or earlier: BitableGrid preloads it on idle).
 * The very first editor of a page renders a moment later inside its own Suspense (nothing shown meanwhile); every
 * later one renders at once. BitableGrid's own cells use the same lazy part (grid-lazy-parts.ts).
 */
import { Suspense, type ReactNode } from "react";
import type { GridEditorProps } from "./grid-editors.tsx";
import { cellEditor } from "./grid-lazy-parts.ts";

const LazyEditor = cellEditor.Part as <T>(props: GridEditorProps<T>) => ReactNode;

export function GridCellEditor<T>(props: GridEditorProps<T>) {
  return (
    <Suspense fallback={null}>
      <LazyEditor<T> {...props} />
    </Suspense>
  );
}
