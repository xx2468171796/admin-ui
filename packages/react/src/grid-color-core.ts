/**
 * 填色 (conditional colouring, bt/grid-a G13): which tone a row / a cell gets from the view's colour
 * rules. A rule = a condition tree (condition-core) + one of the seven option tones, applied to the
 * whole row or to one field's cell; rules are checked top to bottom, the first match wins (separately
 * for the row and for each field). A rule without complete conditions colours nothing. Pure, no React;
 * unit-tested in test/grid-view-v2.test.ts.
 */
import { evaluateConditionTree, flattenConditions, type ConditionContext } from "./condition-core.ts";
import { addGridFilter, isFilterActive, matchesFilter, type GridField, type GridFilterGroup } from "./grid-core.ts";
import type { GridColorRule } from "./grid-view-v2.ts";
import type { OptionTone } from "./option-tone.ts";

export type GridRowFill = { row?: OptionTone; cells: Record<string, OptionTone> };

/** Does a row match a tree; null when the tree has no complete condition (= no rule). */
export function rowMatchesFilter<T>(row: T, tree: GridFilterGroup, byKey: ReadonlyMap<string, GridField<T>>, context: ConditionContext = {}): boolean | null {
  const active = flattenConditions(tree).some((c) => isFilterActive(c, byKey.get(c.field)));
  if (!active) return null;
  return evaluateConditionTree(tree, (c) => {
    const field = byKey.get(c.field);
    return field && isFilterActive(c, field) ? matchesFilter(field, row, c, context) : null;
  });
}

/** Fill of one row (null = no rule matched). */
export function gridRowFill<T>(row: T, rules: readonly GridColorRule[], byKey: ReadonlyMap<string, GridField<T>>, context: ConditionContext = {}): GridRowFill | null {
  let fill: GridRowFill | null = null;
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    if (rule.target === "row" ? fill?.row : rule.field && fill?.cells[rule.field]) continue;
    if (rowMatchesFilter(row, rule.filter, byKey, context) !== true) continue;
    fill ??= { cells: {} };
    if (rule.target === "row") fill.row = rule.tone;
    else if (rule.field) fill.cells[rule.field] = rule.tone;
  }
  return fill;
}

// bt/templates
/**
 * A new 填色 rule after `rules`: the next free id `cN`, the whole row, attention tone, one empty
 * condition on `field` (the first usable field). Used by the grid panel and GanttSettings 「按条件」.
 */
export function newColorRule<T>(rules: readonly GridColorRule[], field: GridField<T> | undefined): GridColorRule {
  let n = rules.length + 1;
  while (rules.some((rule) => rule.id === `c${n}`)) n++;
  return { id: `c${n}`, target: "row", tone: "yellow", filter: addGridFilter({ id: "root", conjunction: "and", items: [] }, field) };
}
