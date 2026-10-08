/**
 * Row grouping for DataTable (pure: no React, unit-tested directly).
 *
 * Grouped tables follow the Cloudscape "table with grouped resources" / AG Grid group-row pattern:
 * a full-width header row per group, groups keep their own order, and a column sort only reorders
 * rows *inside* each group. Hosts that page locally group first, then page the flattened rows, so a
 * group never gets interleaved with another one.
 */
export type RowGroup<T> = { key: string; rows: T[] };

/** Group keys in human order: Chinese pinyin order, numbers by value ("机房 2" before "机房 10"). */
export const compareGroupKeys = (a: string, b: string): number => a.localeCompare(b, "zh-CN", { numeric: true, sensitivity: "base" });

/**
 * Split rows into groups. Rows keep their incoming order inside each group (that order is the column
 * sort). Groups are ordered by `compare`; without it, by first appearance.
 */
export function groupRows<T>(rows: readonly T[], by: (row: T) => string, compare?: (a: string, b: string) => number): RowGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = by(row);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  const out = [...groups].map(([key, list]) => ({ key, rows: list }));
  return compare ? out.sort((a, b) => compare(a.key, b.key)) : out;
}

/** Grouped rows back to one list (same-group rows adjacent): what a locally paged host pages over. */
export function flattenGroups<T>(groups: readonly RowGroup<T>[]): T[] {
  return groups.flatMap((g) => g.rows);
}

/** Toggle one group in a collapsed-keys list (keys stay unique, order kept). */
export function toggleGroup(collapsed: readonly string[], key: string): string[] {
  return collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key];
}
