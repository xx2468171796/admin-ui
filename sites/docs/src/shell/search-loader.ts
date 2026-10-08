import type { CommandItem } from "@adminui/react";
import { searchBlocks, type SearchBlock } from "./search-blocks";

declare const __SEARCH_INDEX_SCRIPT__: string;

let pending: Promise<readonly SearchBlock[]> | null = null;

/**
 * The light home page has no doc content in its bundle: the first search loads assets/search-index.js (written by
 * the build) as a classic script — like the bundles themselves it also loads in sandboxed, opaque-origin frames.
 */
function loadIndex(): Promise<readonly SearchBlock[]> {
  pending ??= new Promise<readonly SearchBlock[]>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = __SEARCH_INDEX_SCRIPT__;
    script.onload = () => resolve((window as { __AUI_SEARCH__?: readonly SearchBlock[] }).__AUI_SEARCH__ ?? []);
    script.onerror = () => {
      pending = null;
      script.remove();
      reject(new Error("搜索索引没加载出来，稍后再试"));
    };
    document.head.appendChild(script);
  });
  return pending;
}

export async function searchDocsLazy(query: string, limit: number): Promise<CommandItem[]> {
  return searchBlocks(await loadIndex(), query, limit);
}
