/**
 * Multi-level grouping of BitableGrid (bt/grid-a G4, D17): up to 3 levels by default, each with its own
 * group order, counts and per-group summaries, empty groups on request, and one display layout for both
 * data modes — client rows (groups built here) and a server source (`loadGroups` answers the group
 * nodes, `load` pages the rows in the same order). Pure, no React. Unit-tested in test/grid-group-core.test.ts.
 *
 * Layout: the grid shows a list of items — group headers and rows. Rows are addressed by their
 * position in the flat grouped order (`offset`), so a server block cache and client arrays work alike.
 */
import { compareSortKeys, gridGroupKey, gridGroupLabel, gridGroupSortKey, type GridField, type GridFieldType } from "./grid-core.ts";
import type { GroupLevel } from "./grid-view-v2.ts";
import { coreType } from "./grid-field-types.ts";

/** Separator of a group path key (level 1 = the group key itself, so older collapsed lists still work). */
export const GROUP_PATH_SEPARATOR = "\u001f";
export const gridGroupPathKey = (path: readonly string[]) => path.join(GROUP_PATH_SEPARATOR);

/**
 * One group as a server answers it (`loadGroups`): its path of group keys (one per level, "" = empty
 * value), the number of matching records, optionally a display label and summary texts per field.
 * Answer every level (level-1 nodes, then level-2 nodes …) in the same order the rows come in.
 */
export type GridGroupNode = { path: readonly string[]; count: number; label?: string; summaries?: Readonly<Record<string, string>> };

export type GridGroup<T> = {
  /** Path key (gridGroupPathKey). */
  key: string;
  /** This level's group key ("" = empty). */
  value: string;
  /** 0-based level. */
  level: number;
  field: string;
  path: string[];
  count: number;
  /** Label from the server (else gridGroupLabel). */
  label?: string;
  /** Summary texts per field from the server. */
  summaries?: Readonly<Record<string, string>>;
  /** Client mode: every row under this group (for summaries). */
  rows?: T[];
  children: GridGroup<T>[];
  /** Position of its first row in the flat grouped order. */
  offset: number;
  /** Added by 显示空分组 (no records). */
  empty?: boolean;
};

const optionIndexOf = (field: GridField<unknown>, key: string) => field.options?.findIndex((option) => option.value === key) ?? -1;
type Keyed = { key: string; sort: ReturnType<typeof gridGroupSortKey> };
/** Group order of a level: by group sort key (option order, value, day), empty group last in both directions; ties by key. */
export function compareGroups(a: Keyed, b: Keyed, order: "asc" | "desc"): number {
  if (a.key === "" || b.key === "") return a.key === b.key ? 0 : a.key === "" ? 1 : -1;
  if (a.sort === undefined || b.sort === undefined) {
    if (a.sort !== b.sort) return a.sort === undefined ? 1 : -1;
  } else {
    const cmp = compareSortKeys(a.sort, b.sort);
    if (cmp) return order === "desc" ? -cmp : cmp;
  }
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}
/** Sort key of a group value without a row (empty groups): option order, checkbox false < true. */
function emptyGroupSort(field: GridField<unknown>, key: string): Keyed["sort"] {
  if (field.type === "checkbox") return key === "true" ? 1 : 0;
  const index = optionIndexOf(field, key);
  return index >= 0 ? index : undefined;
}
/** Keys a level can show with no records (显示空分组): select options, both checkbox states. */
export function enumerableGroupKeys(field: GridField<unknown>): string[] | null {
  if (field.type === "checkbox") return ["false", "true"];
  if (field.type === "singleSelect" && field.options?.length) return field.options.map((option) => option.value);
  return null;
}

/**
 * Client mode: the group tree of rows (already filtered and sorted by the view; rows keep that order
 * inside each group). Unknown level fields are skipped.
 */
export function groupTreeFromRows<T>(rows: readonly T[], levels: readonly GroupLevel[], fields: readonly GridField<T>[], options: { showEmpty?: boolean } = {}): GridGroup<T>[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const used = levels.filter((level) => byKey.has(level.field));
  let offset = 0;
  const build = (list: readonly T[], depth: number, prefix: string[]): GridGroup<T>[] => {
    const level = used[depth]!;
    const field = byKey.get(level.field)!;
    const parts = new Map<string, T[]>();
    for (const row of list) {
      const key = gridGroupKey(field, row);
      const bucket = parts.get(key);
      if (bucket) bucket.push(row);
      else parts.set(key, [row]);
    }
    const keyed: (Keyed & { rows: T[] })[] = [...parts].map(([key, bucket]) => ({ key, sort: gridGroupSortKey(field, bucket[0]!), rows: bucket }));
    if (options.showEmpty) for (const key of enumerableGroupKeys(field as GridField<unknown>) ?? []) if (!parts.has(key)) keyed.push({ key, sort: emptyGroupSort(field as GridField<unknown>, key), rows: [] });
    keyed.sort((a, b) => compareGroups(a, b, level.order));
    return keyed.map((part) => {
      const path = [...prefix, part.key];
      const group: GridGroup<T> = { key: gridGroupPathKey(path), value: part.key, level: depth, field: field.key, path, count: part.rows.length, rows: part.rows, children: [], offset, ...(part.rows.length ? {} : { empty: true }) };
      if (depth + 1 < used.length && part.rows.length) group.children = build(part.rows, depth + 1, path);
      else offset += part.rows.length;
      return group;
    });
  };
  return used.length ? build(rows, 0, []) : [];
}

/**
 * Server mode: the group tree of `loadGroups` nodes (server order kept; missing parents rebuilt from
 * their children). Offsets follow the counts, matching rows the server pages in the same order.
 */
export function groupTreeFromNodes<T>(nodes: readonly GridGroupNode[], levels: readonly GroupLevel[], fields: readonly GridField<T>[], options: { showEmpty?: boolean } = {}): GridGroup<T>[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const roots: GridGroup<T>[] = [];
  const index = new Map<string, GridGroup<T>>();
  const ensure = (path: string[]): GridGroup<T> | null => {
    const depth = path.length - 1;
    const level = levels[depth];
    if (!level) return null;
    const key = gridGroupPathKey(path);
    const found = index.get(key);
    if (found) return found;
    const group: GridGroup<T> = { key, value: path[depth]!, level: depth, field: level.field, path, count: 0, children: [], offset: 0 };
    index.set(key, group);
    if (depth === 0) roots.push(group);
    else ensure(path.slice(0, -1))?.children.push(group);
    return group;
  };
  const sorted = nodes.filter((node) => node.path.length >= 1 && node.path.length <= levels.length).slice().sort((a, b) => a.path.length - b.path.length);
  for (const node of sorted) {
    const group = ensure(node.path.map(String));
    if (!group) continue;
    group.count = Math.max(0, Math.floor(node.count));
    if (node.label !== undefined) group.label = node.label;
    if (node.summaries) group.summaries = node.summaries;
  }
  // Parents without their own node: the sum of their children.
  const fill = (group: GridGroup<T>): number => {
    if (!group.children.length) return group.count;
    const sum = group.children.reduce((n, child) => n + fill(child), 0);
    if (!group.count) group.count = sum;
    return group.count;
  };
  roots.forEach(fill);
  if (options.showEmpty) addEmptyGroups(roots, levels, byKey, 0, []);
  let offset = 0;
  const place = (list: GridGroup<T>[]) => {
    for (const group of list) {
      group.offset = offset;
      if (group.children.length) place(group.children);
      // A parent's own count wins: children cut off by `maxGroups` must not shift later groups.
      offset = group.offset + group.count;
    }
  };
  place(roots);
  return roots;
}
function addEmptyGroups<T>(list: GridGroup<T>[], levels: readonly GroupLevel[], byKey: Map<string, GridField<T>>, depth: number, prefix: string[]) {
  const level = levels[depth];
  const field = level ? byKey.get(level.field) : undefined;
  if (!level || !field) return;
  for (const key of enumerableGroupKeys(field as GridField<unknown>) ?? []) {
    if (list.some((group) => group.value === key)) continue;
    const path = [...prefix, key];
    const group: GridGroup<T> = { key: gridGroupPathKey(path), value: key, level: depth, field: field.key, path, count: 0, children: [], offset: 0, empty: true };
    // Next to its option neighbours when the siblings follow option order, else at the end.
    const at = list.findIndex((other) => compareGroups({ key: other.value, sort: emptyGroupSort(field as GridField<unknown>, other.value) }, { key, sort: emptyGroupSort(field as GridField<unknown>, key) }, level.order) > 0);
    list.splice(at < 0 ? list.length : at, 0, group);
  }
  for (const group of list) if (group.count) addEmptyGroups(group.children, levels, byKey, depth + 1, group.path);
}

/** Every group path key (全部收起). */
export function allGroupKeys(roots: readonly GridGroup<unknown>[]): string[] {
  return roots.flatMap((group) => [group.key, ...allGroupKeys(group.children)]);
}
/** Client mode: the rows in flat grouped order (leaf groups one after another). */
export function groupedRowOrder<T>(roots: readonly GridGroup<T>[]): T[] {
  return roots.flatMap((group) => (group.children.length ? groupedRowOrder(group.children) : group.rows ?? []));
}
/** Display label of a group: the server's label, else the field's (「（空）」, option label, 已勾选 …). */
export function groupLabel<T>(group: GridGroup<T>, field: GridField<T> | undefined): string {
  return group.label ?? (field ? gridGroupLabel(field, group.value) : group.value);
}

// ---------------------------------------------------------------- layout

/** 「+ 新增一行」 (bt/grid-b onAddRow): `values` = the group keys per level field ({} when ungrouped). */
export type GridLayoutAdd<T> = { kind: "add"; key: string; values: Record<string, string>; group: GridGroup<T> | null };
export type GridLayoutItem<T> = { kind: "group"; group: GridGroup<T> } | { kind: "row"; offset: number } | GridLayoutAdd<T>;
type Segment<T> = { start: number; group: GridGroup<T> } | { start: number; offset: number; count: number } | { start: number; add: GridLayoutAdd<T> };
/**
 * What the grid shows: `count` items; `at(i)` is a group header or the row at a flat offset;
 * `rowSpan(a, b)` = the first and last row offsets shown in items a..b (null = only headers);
 * `indexOfOffset(o)` = the item showing that row (-1 when its group is collapsed).
 */
export type GridLayout<T> = {
  count: number;
  at: (index: number) => GridLayoutItem<T> | null;
  rowSpan: (start: number, end: number) => [number, number] | null;
  indexOfOffset: (offset: number) => number;
  groupKeys: string[];
  grouped: boolean;
};

/** The group keys of a group's path per level field ({ stage: "won", owner: "王磊" }). */
export function groupValues<T>(group: GridGroup<T>, levels: readonly GroupLevel[]): Record<string, string> {
  return Object.fromEntries(group.path.map((value, i) => [levels[i]?.field ?? `level${i}`, value]));
}

/** Layout of an ungrouped list of `rows` items (and a 「新增一行」 item after them with `addRow`). */
export function flatLayout<T>(rows: number, options: { addRow?: boolean } = {}): GridLayout<T> {
  const add: GridLayoutAdd<T> | null = options.addRow ? { kind: "add", key: "", values: {}, group: null } : null;
  return {
    count: rows + (add ? 1 : 0),
    at: (index) => (index >= 0 && index < rows ? { kind: "row", offset: index } : add && index === rows ? add : null),
    rowSpan: (start, end) => (rows && end >= start ? [Math.max(0, start), Math.min(rows - 1, end)] : null),
    indexOfOffset: (offset) => (offset >= 0 && offset < rows ? offset : -1),
    groupKeys: [],
    grouped: false,
  };
}

/**
 * Layout of a group tree with these groups collapsed (path keys). With `addRows` (the levels), every
 * expanded leaf group ends with a 「新增一行」 item carrying its group values.
 */
export function groupLayout<T>(roots: readonly GridGroup<T>[], collapsed: Iterable<string>, options: { addRows?: readonly GroupLevel[] } = {}): GridLayout<T> {
  const folded = new Set(collapsed);
  const segments: Segment<T>[] = [];
  let count = 0;
  const walk = (list: readonly GridGroup<T>[]) => {
    for (const group of list) {
      segments.push({ start: count++, group });
      if (folded.has(group.key)) continue;
      if (group.children.length) walk(group.children);
      else {
        if (group.count) {
          segments.push({ start: count, offset: group.offset, count: group.count });
          count += group.count;
        }
        if (options.addRows) segments.push({ start: count++, add: { kind: "add", key: group.key, values: groupValues(group, options.addRows), group } });
      }
    }
  };
  walk(roots);
  const find = (index: number) => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid]!.start <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const rowSegments = segments.filter((s): s is Extract<Segment<T>, { offset: number }> => "offset" in s);
  return {
    count,
    grouped: true,
    groupKeys: allGroupKeys(roots as GridGroup<unknown>[]),
    at: (index) => {
      if (index < 0 || index >= count) return null;
      const segment = segments[find(index)]!;
      if ("add" in segment) return segment.add;
      return "group" in segment ? { kind: "group", group: segment.group } : { kind: "row", offset: segment.offset + (index - segment.start) };
    },
    rowSpan: (start, end) => {
      let min = Infinity;
      let max = -Infinity;
      for (const s of rowSegments) {
        const a = Math.max(start, s.start);
        const b = Math.min(end, s.start + s.count - 1);
        if (a > b) continue;
        min = Math.min(min, s.offset + (a - s.start));
        max = Math.max(max, s.offset + (b - s.start));
      }
      return min <= max ? [min, max] : null;
    },
    indexOfOffset: (offset) => {
      for (const s of rowSegments) if (offset >= s.offset && offset < s.offset + s.count) return s.start + (offset - s.offset);
      return -1;
    },
  };
}

// ---------------------------------------------------------------- frozen order (自动排序 off)

/**
 * 自动排序 off: keep rows where they were (`previous` = row id → position) and put new rows at the
 * end in their current order. Returns the ids → positions of the result for the next round.
 */
export function keepRowOrder<T>(rows: readonly T[], previous: ReadonlyMap<string, number> | null, getId: (row: T) => string): { rows: T[]; order: Map<string, number> } {
  const out = previous ? rows.map((row, i) => ({ row, at: previous.get(getId(row)) ?? Number.MAX_SAFE_INTEGER, i })).sort((a, b) => a.at - b.at || a.i - b.i).map((x) => x.row) : rows.slice();
  return { rows: out, order: new Map(out.map((row, i) => [getId(row), i])) };
}

// ---------------------------------------------------------------- order labels

const KIND_ORDER: Partial<Record<GridFieldType | string, [string, string]>> = {
  singleSelect: ["按选项顺序", "按选项倒序"],
  number: ["从小到大 0 → 9", "从大到小 9 → 0"],
  money: ["从小到大 0 → 9", "从大到小 9 → 0"],
  rating: ["从低到高", "从高到低"],
  progress: ["从小到大 0 → 9", "从大到小 9 → 0"],
  autoNumber: ["从小到大 0 → 9", "从大到小 9 → 0"],
  date: ["从早到晚", "从晚到早"],
  datetime: ["从早到晚", "从晚到早"],
  checkbox: ["未勾选在前", "已勾选在前"],
  user: ["A → Z（按姓名）", "Z → A（按姓名）"],
};
/** Labels of asc / desc for a field (sort and group order pickers): 「从早到晚 / 从晚到早」 … */
export function orderLabels(field: Pick<GridField<unknown>, "type" | "resultType"> | undefined): [string, string] {
  return (field && (KIND_ORDER[field.type] ?? KIND_ORDER[coreType(field)])) ?? ["A → Z", "Z → A"];
}

