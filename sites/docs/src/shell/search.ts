import type { CommandItem } from "@adminui/react";
import { COMPONENT_DOCS } from "../content/index";
import { buildSearchBlocks, searchBlocks, type SearchBlock } from "./search-blocks";

let index: SearchBlock[] | null = null;

/** In-memory search over every component doc (the docs bundle carries the content anyway). */
export function searchDocs(query: string, limit: number): CommandItem[] {
  index ??= buildSearchBlocks(COMPONENT_DOCS);
  return searchBlocks(index, query, limit);
}
