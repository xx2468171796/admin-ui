/**
 * Server-side data for BitableGrid: the query a view sends (search / filters / sort), the request /
 * result contract of a data source, and the block cache that backs infinite scrolling and pages.
 * Pure (no React, no DOM, no fetch) — the same file is imported by backends through
 * `@adminui/react/grid-query` to validate the query and answer it (applyGridQuery in memory,
 * buildGridSql for PostgreSQL / MySQL / SQLite). Unit-tested in test/grid-data-core.test.ts.
 *
 * Contract (INTEGRATION.md「多维表格 · 服务端数据」):
 *   POST/GET <list endpoint> { query: GridQuery, offset, limit, summaries? }
 *     → { rows: T[], total: number, summaries?: { [fieldKey]: string } }
 *   `total` = records matching the query (not the page size); rows are in the query's order.
 */
import type { Sort } from "./contracts.ts";
import {
  compareSortKeys,
  filterGridRows,
  gridFilterTree,
  gridGroupSortKey,
  gridGroupKey,
  isFilterActive,
  sortKey,
  summarizeField,
  type GridField,
  type GridFieldType,
  type GridFilter,
  type GridFilterGroup,
  type GridSummaryKind,
  type GridView,
} from "./grid-core.ts";
// bt/grid-a: filter tree v2, relative dates / dynamic values, server-side grouping
import { CONDITION_LIMITS, conditionTreeIsContextual, conditionTreeKey, conditionTreeToList, flattenConditions, normalizeConditionTree, pruneConditionTree, resolveDynamic, todayIn, isDynamicValue, type ConditionContext } from "./condition-core.ts";
import { gridFieldKind, normalizeGroupLevels, type GroupLevel } from "./grid-view-v2.ts";
import { compareGroups, groupTreeFromRows, type GridGroup, type GridGroupNode } from "./grid-group-core.ts";

// ---------------------------------------------------------------- query

/**
 * What the server must apply: trimmed search, the filter tree (complete conditions only), sorts in
 * priority order, and — when the view is grouped — the group levels, which order the rows first.
 * `filters` + `conjunction` mirror a flat tree for servers written against the pre-v2 contract
 * (empty when the tree has nested groups: such servers must upgrade to read `filter`).
 */
export type GridQuery = {
  search: string;
  /** Filter tree (bt/grid-a); when absent, `filters` + `conjunction` are the whole filter. */
  filter?: GridFilterGroup;
  filters: GridFilter[];
  conjunction: "and" | "or";
  sort: Sort[];
  /** Group levels (bt/grid-a): order rows by these first, then by `sort`. */
  groups?: GroupLevel[];
};
export const EMPTY_GRID_QUERY: GridQuery = { search: "", filter: { id: "root", conjunction: "and", items: [] }, filters: [], conjunction: "and", sort: [] };

/** The filter tree a query carries (`filter`, else the legacy flat list). */
export const gridQueryFilter = (query: Pick<GridQuery, "filter" | "filters" | "conjunction">): GridFilterGroup => gridFilterTree(query);

/** Query parts from a tree: the tree plus the legacy mirror. */
function withTree(tree: GridFilterGroup): Pick<GridQuery, "filter" | "filters" | "conjunction"> {
  const flat = conditionTreeToList(tree);
  return { filter: tree, filters: flat ? flat.conditions.map(({ id, field, op, value }) => (value === undefined ? { id, field, op } : { id, field, op, value })) : [], conjunction: flat?.conjunction ?? tree.conjunction };
}

/**
 * The query of a view (incomplete conditions dropped, so typing in a filter box does not refetch).
 * `groups` only when the source can group (BitableGrid passes them for `loadGroups` sources).
 */
export function gridQueryOf<T>(view: Pick<GridView, "search" | "sort"> & { filter?: GridFilterGroup; filters?: readonly GridFilter[]; conjunction?: "and" | "or"; groupBy?: readonly GroupLevel[] }, fields: readonly Pick<GridField<T>, "key" | "type">[], options: { groups?: boolean } = {}): GridQuery {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const tree = pruneConditionTree(gridFilterTree(view), (filter) => isFilterActive(filter, byKey.get(filter.field) as GridField<T> | undefined));
  return {
    search: view.search.trim(),
    ...withTree(tree),
    sort: view.sort.map((s) => ({ key: s.key, direction: s.direction })),
    ...(options.groups && view.groupBy?.length ? { groups: view.groupBy.map((level) => ({ field: level.field, order: level.order })) } : {}),
  };
}
/** Stable cache key of a query (condition ids ignored: same conditions = same data). */
export function gridQueryKey(query: GridQuery): string {
  return JSON.stringify([query.search, conditionTreeKey(gridQueryFilter(query)), query.sort.map((s) => [s.key, s.direction]), (query.groups ?? []).map((g) => [g.field, g.order])]);
}

export type GridLoadRequest = {
  query: GridQuery;
  /** First row (0-based) and how many rows. */
  offset: number;
  limit: number;
  /** Summary per field the bottom bar shows; answer with display text in `summaries` (optional). */
  summaries?: Record<string, GridSummaryKind>;
  signal: AbortSignal;
};
export type GridLoadResult<T> = {
  rows: readonly T[];
  /** Records matching the query in total. */
  total: number;
  /** Display text per field key for the summary bar (e.g. "¥12,345.00"); missing = 「—」. */
  summaries?: Readonly<Record<string, string>>;
};
/** Request of `loadGroups`: the same query (with `groups`) and the summaries group headers show. */
export type GridGroupsRequest = {
  query: GridQuery;
  summaries?: Record<string, GridSummaryKind>;
  signal: AbortSignal;
};
/** Every group node of every level, in row order (see GridGroupNode); `truncated` when the server capped them. */
export type GridGroupsResult = { groups: readonly GridGroupNode[]; truncated?: boolean };
/**
 * A server data source: `load` answers one block. `capabilities` tells the toolbar what the server
 * can do (unsupported parts are hidden instead of silently ignored). Give `loadGroups` to let the
 * user group in server mode: it answers the group headers (paths, counts, summaries) and `load`
 * returns rows ordered by `query.groups` first (applyGridGroups / buildGridGroupSql do both).
 */
export type GridDataSource<T> = {
  load: (request: GridLoadRequest) => Promise<GridLoadResult<T>>;
  // bt/grid-a
  loadGroups?: (request: GridGroupsRequest) => Promise<GridGroupsResult>;
  capabilities?: {
    search?: boolean;
    filter?: boolean;
    sort?: boolean;
    /** Summary kinds the server computes (default: only 记录数 from `total`). */
    summaries?: readonly GridSummaryKind[];
  };
};

// ---------------------------------------------------------------- block cache

export const GRID_BLOCK_SIZE = 100;
/** Blocks kept in memory around the viewport (older ones are dropped and refetched if scrolled back). */
export const GRID_MAX_BLOCKS = 30;

export type GridBlockState<T> = {
  /** gridQueryKey of the cached data; a new query starts an empty cache. */
  key: string;
  total: number | null;
  blocks: ReadonlyMap<number, readonly T[]>;
  loading: ReadonlySet<number>;
  /** Error per block (shown on its rows with a retry). */
  failed: ReadonlyMap<number, string>;
  summaries?: Readonly<Record<string, string>>;
  /** Bumped by refresh: answers of older generations are dropped. */
  generation: number;
};
export const emptyBlockState = <T,>(key: string, generation = 0): GridBlockState<T> => ({ key, total: null, blocks: new Map(), loading: new Set(), failed: new Map(), generation });

/** Block numbers covering rows start..end (inclusive). */
export function blocksForRange(start: number, end: number, blockSize = GRID_BLOCK_SIZE): number[] {
  if (end < start) return [];
  const first = Math.floor(Math.max(0, start) / blockSize);
  const last = Math.floor(Math.max(0, end) / blockSize);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
/** Blocks of a range that are neither cached nor loading (failed ones only when `retry`). */
export function missingBlocks<T>(state: GridBlockState<T>, start: number, end: number, blockSize = GRID_BLOCK_SIZE, retry = false): number[] {
  const limit = state.total === null ? end : Math.min(end, state.total - 1);
  return blocksForRange(start, limit, blockSize).filter((block) => !state.blocks.has(block) && !state.loading.has(block) && (retry || !state.failed.has(block)));
}
/** The row at a position, or undefined when its block is not loaded. */
export function rowAtIndex<T>(state: GridBlockState<T>, index: number, blockSize = GRID_BLOCK_SIZE): T | undefined {
  return state.blocks.get(Math.floor(index / blockSize))?.[index % blockSize];
}
export function markLoading<T>(state: GridBlockState<T>, blocks: readonly number[]): GridBlockState<T> {
  const loading = new Set(state.loading);
  const failed = new Map(state.failed);
  for (const block of blocks) {
    loading.add(block);
    failed.delete(block);
  }
  return { ...state, loading, failed };
}
/**
 * Store an answer. Ignored when it belongs to an older query / generation. Keeps at most
 * `maxBlocks` blocks, dropping those farthest from the block just loaded.
 */
export function receiveBlock<T>(state: GridBlockState<T>, answer: { key: string; generation: number; block: number; result: GridLoadResult<T> }, maxBlocks = GRID_MAX_BLOCKS): GridBlockState<T> {
  if (answer.key !== state.key || answer.generation !== state.generation) return state;
  const blocks = new Map(state.blocks);
  blocks.set(answer.block, answer.result.rows);
  if (blocks.size > maxBlocks) {
    const far = [...blocks.keys()].sort((a, b) => Math.abs(b - answer.block) - Math.abs(a - answer.block));
    for (const block of far.slice(0, blocks.size - maxBlocks)) blocks.delete(block);
  }
  const loading = new Set(state.loading);
  loading.delete(answer.block);
  return { ...state, total: answer.result.total, blocks, loading, summaries: answer.result.summaries ?? state.summaries };
}
export function failBlock<T>(state: GridBlockState<T>, answer: { key: string; generation: number; block: number; error: string }): GridBlockState<T> {
  if (answer.key !== state.key || answer.generation !== state.generation) return state;
  const loading = new Set(state.loading);
  loading.delete(answer.block);
  const failed = new Map(state.failed);
  failed.set(answer.block, answer.error);
  return { ...state, loading, failed };
}
/** Replace cached records by id (after the host saved edits), keeping their positions. */
export function patchBlockRows<T>(state: GridBlockState<T>, updates: ReadonlyMap<string, T>, getRowId: (row: T) => string): GridBlockState<T> {
  if (!updates.size) return state;
  let changed = false;
  const blocks = new Map<number, readonly T[]>();
  for (const [block, rows] of state.blocks) {
    let copy: T[] | null = null;
    rows.forEach((row, i) => {
      const next = updates.get(getRowId(row));
      if (next !== undefined) {
        copy ??= rows.slice();
        copy[i] = next;
      }
    });
    if (copy) changed = true;
    blocks.set(block, copy ?? rows);
  }
  return changed ? { ...state, blocks } : state;
}
/** Start over (new generation): keeps the total so the scroll height does not jump while refetching. */
export function refreshBlockState<T>(state: GridBlockState<T>): GridBlockState<T> {
  return { ...emptyBlockState<T>(state.key, state.generation + 1), total: state.total, summaries: state.summaries };
}

// ---------------------------------------------------------------- backend helpers

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export type GridQueryLimits = {
  /** Conditions in the whole tree (default 50). */
  maxFilters?: number;
  /** Group nesting below the top level (default 1). */
  maxDepth?: number;
  maxSorts?: number;
  /** Group levels (default 3). */
  maxGroups?: number;
  maxSearch?: number;
};
/**
 * Validate a query received from the browser against the server's field list (never trust it):
 * unknown fields, ops that do not fit the type, bad values, incomplete conditions, too many
 * conditions / levels and over-long input are dropped. Reads the v2 `filter` tree, or the legacy flat
 * `filters` + `conjunction`. Use the result for applyGridQuery / buildGridSql.
 */
export function parseGridQuery(input: unknown, fields: readonly { key: string; type: GridFieldType; resultType?: GridField<unknown>["resultType"]; sortable?: boolean; filterable?: boolean; groupable?: boolean }[], limits: GridQueryLimits = {}): GridQuery {
  const source = typeof input === "string" ? (() => { try { return JSON.parse(input) as unknown; } catch { return null; } })() : input;
  if (!isRecord(source)) return { ...EMPTY_GRID_QUERY, filter: { id: "root", conjunction: "and", items: [] } };
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const kindOf = (key: string) => gridFieldKind(byKey.get(key) as GridField<unknown> | undefined);
  // Strings ≤ 500, lists ≤ 100 items of ≤ 200 chars; then only complete conditions.
  const valueOk = (value: unknown) => value === undefined || value === null || (typeof value === "string" ? value.length <= 500 : Array.isArray(value) ? value.length <= 100 && value.every((v) => typeof v === "string" && v.length <= 200) : true);
  const raw = isRecord(source.filter) ? source.filter : { conjunction: source.conjunction, items: Array.isArray(source.filters) ? source.filters : [] };
  const tree = normalizeConditionTree(raw, kindOf, { maxConditions: limits.maxFilters ?? CONDITION_LIMITS.maxConditions, maxDepth: limits.maxDepth ?? CONDITION_LIMITS.maxDepth });
  const filter = pruneConditionTree(tree, (c) => valueOk(c.value) && isFilterActive(c, byKey.get(c.field) as GridField<unknown> | undefined));
  const sort: Sort[] = [];
  if (Array.isArray(source.sort))
    for (const item of source.sort.slice(0, limits.maxSorts ?? 5)) {
      if (!isRecord(item) || typeof item.key !== "string") continue;
      const field = byKey.get(item.key);
      if (!field || field.sortable === false || sort.some((s) => s.key === field.key)) continue;
      if (item.direction === "asc" || item.direction === "desc") sort.push({ key: field.key, direction: item.direction });
    }
  const groups = normalizeGroupLevels(source.groups, fields as readonly GridField<unknown>[], limits.maxGroups ?? 3);
  return {
    search: typeof source.search === "string" ? source.search.trim().slice(0, limits.maxSearch ?? 200) : "",
    ...withTree(renumber(filter)),
    sort,
    ...(groups.length ? { groups } : {}),
  };
}
/** Server-made ids (f1, f2 … / g1 …) so nothing from the browser is echoed. */
function renumber(tree: GridFilterGroup): GridFilterGroup {
  let f = 0;
  let g = 0;
  const walk = (group: GridFilterGroup, root: boolean): GridFilterGroup => ({
    id: root ? "root" : `g${++g}`,
    conjunction: group.conjunction,
    items: group.items.map((node) => ("items" in node ? walk(node, false) : { ...node, id: `f${++f}` })),
  });
  return walk(tree, true);
}

/**
 * Answer a query in memory with the grid's own rules (same results as the client-side grid):
 * search in the given fields, the filter tree (`context` resolves 「我」 and relative dates — on a
 * server, resolve 「我」 from the session, never from the request), group levels, multi-field sort
 * (empties last), then one block.
 */
export function applyGridQuery<T>(rows: readonly T[], fields: readonly GridField<T>[], query: GridQuery, page: { offset: number; limit: number; summaries?: Record<string, GridSummaryKind> } = { offset: 0, limit: rows.length }, context: ConditionContext = {}): { rows: T[]; total: number; summaries?: Record<string, string> } {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const matched = matchedRows(rows, fields, query, byKey, context);
  const offset = Math.max(0, Math.floor(page.offset));
  const limit = Math.max(0, Math.min(1000, Math.floor(page.limit)));
  const summaries: Record<string, string> = {};
  for (const [key, kind] of Object.entries(page.summaries ?? {})) {
    const field = byKey.get(key);
    if (field && kind !== "none") summaries[key] = summarizeField(field, matched, kind).text;
  }
  return { rows: matched.slice(offset, offset + limit), total: matched.length, ...(Object.keys(summaries).length ? { summaries } : {}) };
}

/**
 * Answer `loadGroups` in memory: the group nodes of every level of `query.groups`, in the order
 * applyGridQuery returns the rows, with counts and summary texts. `maxGroups` caps the nodes (default 2000).
 */
export function applyGridGroups<T>(rows: readonly T[], fields: readonly GridField<T>[], query: GridQuery, options: { summaries?: Record<string, GridSummaryKind>; maxGroups?: number } = {}, context: ConditionContext = {}): GridGroupsResult {
  const levels = query.groups ?? [];
  if (!levels.length) return { groups: [] };
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const matched = matchedRows(rows, fields, query, byKey, context);
  const tree = groupTreeFromRows(matched, levels, fields);
  const out: GridGroupNode[] = [];
  const max = options.maxGroups ?? 2000;
  let truncated = false;
  const walk = (list: readonly GridGroup<T>[]) => {
    for (const group of list) {
      if (out.length >= max) { truncated = true; return; }
      const summaries: Record<string, string> = {};
      for (const [key, kind] of Object.entries(options.summaries ?? {})) {
        const field = byKey.get(key);
        if (field && kind !== "none" && kind !== "count") summaries[key] = summarizeField(field, group.rows ?? [], kind).text;
      }
      out.push({ path: group.path, count: group.count, ...(Object.keys(summaries).length ? { summaries } : {}) });
    }
    for (const group of list) if (group.children.length) walk(group.children);
  };
  walk(tree);
  // Level by level, each level in row order (what a SQL GROUP BY per level returns).
  out.sort((a, b) => a.path.length - b.path.length);
  return truncated ? { groups: out, truncated } : { groups: out };
}

// The filtered + sorted rows of the last query per row array: the blocks of one query (offset 0,
// 100, 200 …) reuse it instead of filtering and sorting everything again. Queries with 「我」 or
// relative dates also key on today and the resolved values.
const MATCH_CACHE = new WeakMap<readonly unknown[], { key: string; fields: readonly unknown[]; rows: unknown[] }>();
function contextKey(query: GridQuery, context: ConditionContext): string {
  const tree = gridQueryFilter(query);
  if (!conditionTreeIsContextual(tree)) return "";
  const tokens = [...new Set(flattenConditions(tree).flatMap((c) => (isDynamicValue(c.value) ? [c.value.dynamic] : [])))];
  return JSON.stringify([todayIn(context), context.weekStart ?? 1, tokens.map((token) => resolveDynamic({ dynamic: token }, context))]);
}
function matchedRows<T>(rows: readonly T[], fields: readonly GridField<T>[], query: GridQuery, byKey: Map<string, GridField<T>>, context: ConditionContext): T[] {
  const key = `${gridQueryKey(query)}|${contextKey(query, context)}`;
  const cached = MATCH_CACHE.get(rows);
  if (cached && cached.key === key && cached.fields === fields) return cached.rows as T[];
  const matched = filterGridRows(rows, fields, { search: query.search, filter: gridQueryFilter(query), hidden: [] }, context);
  const levels = (query.groups ?? []).filter((level) => byKey.has(level.field));
  const sorts = query.sort.filter((s) => byKey.has(s.key));
  if (sorts.length || levels.length) {
    const keyed = matched.map((row, index) => ({
      row,
      index,
      groups: levels.map((level) => { const field = byKey.get(level.field)!; return { key: gridGroupKey(field, row), sort: gridGroupSortKey(field, row) }; }),
      keys: sorts.map((s) => sortKey(byKey.get(s.key)!, row)),
    }));
    keyed.sort((a, b) => {
      for (let i = 0; i < levels.length; i++) {
        const cmp = compareGroups(a.groups[i]!, b.groups[i]!, levels[i]!.order);
        if (cmp) return cmp;
      }
      for (let i = 0; i < sorts.length; i++) {
        const ka = a.keys[i];
        const kb = b.keys[i];
        if (ka === undefined || kb === undefined) {
          if (ka !== kb) return ka === undefined ? 1 : -1; // empties last in either direction
          continue;
        }
        const cmp = compareSortKeys(ka, kb);
        if (cmp) return sorts[i]!.direction === "desc" ? -cmp : cmp;
      }
      return a.index - b.index;
    });
    for (let i = 0; i < keyed.length; i++) matched[i] = keyed[i]!.row;
  }
  MATCH_CACHE.set(rows, { key, fields, rows: matched });
  return matched;
}
