import { acceptLabel, formatBytes } from "./media-core.ts";
export type Sort = { key: string; direction: "asc" | "desc" };
export type ListQuery<F = Record<string, string>> = {
  page: number;
  pageSize: number;
  search: string;
  filters: F;
  sort?: Sort;
  /** Ordered by priority; host applies all fields server-side. Legacy sort remains supported. */
  sorts?: readonly Sort[];
};
export type ListResult<T> = { rows: T[]; total: number; updatedAt?: string };
export type ListAdapter<T, F = Record<string, string>> = (
  query: ListQuery<F>,
  context: { signal: AbortSignal },
) => Promise<ListResult<T>>;
/** Sidebar grouping: blocks keyed by first appearance of each label; ungrouped items stay inline. */
export type NavBlock<T> = { group?: string; items: T[] };
export function groupNavigation<T extends { group?: string }>(
  navigation: readonly T[],
): NavBlock<T>[] {
  const blocks: NavBlock<T>[] = [];
  for (const item of navigation) {
    if (item.group === undefined) {
      const last = blocks[blocks.length - 1];
      if (last && last.group === undefined) last.items.push(item);
      else blocks.push({ items: [item] });
      continue;
    }
    const existing = blocks.find((block) => block.group === item.group);
    if (existing) existing.items.push(item);
    else blocks.push({ group: item.group, items: [item] });
  }
  return blocks;
}
/**
 * Keyset/cursor listing for append-only hot tables where a live COUNT would scan the table.
 * There is no total by construction: `total?: never` keeps callers from inventing one.
 */
export type CursorQuery<F = Record<string, string>> = {
  cursor: string | null;
  limit: number;
  search: string;
  filters: F;
  sort?: Sort;
  sorts?: readonly Sort[];
};
export type CursorResult<T> = {
  rows: T[];
  nextCursor?: string | null;
  hasMore: boolean;
  updatedAt?: string;
  total?: never;
};
export type CursorListAdapter<T, F = Record<string, string>> = (
  query: CursorQuery<F>,
  context: { signal: AbortSignal },
) => Promise<CursorResult<T>>;
export type UploadResult = { id: string; name: string; url: string };
export type UploadAdapter = (
  file: File,
  context: { signal: AbortSignal; onProgress: (percent: number) => void },
) => Promise<UploadResult>;
/** Query keys must be JSON-compatible; business data and credentials never enter localStorage. */
export function pageWindow(page: number, pageCount: number) {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  return Array.from(
    { length: Math.min(5, Math.max(1, pageCount)) },
    (_, i) => start + i,
  );
}
/** Page-size choices always include the size in use (a host default outside the list would otherwise
 *  leave the select blank); ascending, unique, positive integers only. */
export function pageSizeOptions(sizes: readonly number[], current: number): number[] {
  return [...new Set([...sizes, current])]
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
}
export function validateFile(
  file: Pick<File, "size" | "type" | "name">,
  accept: readonly string[],
  maxBytes: number,
) {
  if (file.size > maxBytes)
    return `文件超过 ${formatBytes(maxBytes)} 上限`;
  if (
    !accept.some((rule) =>
      rule.startsWith(".")
        ? file.name.toLowerCase().endsWith(rule.toLowerCase())
        : rule.endsWith("/*")
          ? file.type.startsWith(rule.slice(0, -1))
          : file.type === rule,
    )
  )
    return `文件类型不支持，只能传${acceptLabel(accept)}`;
  return null;
}
