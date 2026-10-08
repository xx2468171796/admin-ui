/**
 * Pure rules behind BitableGrid's menus, freeze line and row dragging (bt/grid-b, G7–G11). No React,
 * no DOM: unit-tested in test/grid-interact-core.test.ts.
 */
import type { GridFieldType } from "./grid-core.ts";
import { coreType, type GridFormulaResult } from "./grid-field-types.ts";

// ---------------------------------------------------------------- freeze line

/**
 * Blank space after the last column so that, scrolled all the way right, the first scrolled column starts
 * exactly at the freeze line (审阅 05: at the far right a column slid half under the frozen ones showed
 * as an empty strip — its content hidden, its tail blank). `scrolled` = widths of the columns that move,
 * `fixed` = frozen start + pinned end widths, `box` = the scroll box's client width. 0 when nothing scrolls.
 */
export function scrollTailPad(scrolled: readonly number[], fixed: number, box: number): number {
  const room = box - fixed;
  const total = scrolled.reduce((sum, width) => sum + width, 0);
  if (room <= 0 || total <= room) return 0;
  let tail = total;
  for (const width of scrolled) {
    if (tail <= room + 0.5) break;
    tail -= width;
  }
  return Math.max(0, Math.round(room - tail));
}

/**
 * Frozen field count for a freeze-line drag: the column boundary nearest the pointer. `edges` are the
 * right edges (px, same origin as `x`) of the row-number column (index 0 = count 0) and then of each
 * visible field in order; the result is clamped to `max` fields.
 */
export function frozenCountAt(x: number, edges: readonly number[], max: number): number {
  let best = 0;
  let distance = Infinity;
  edges.forEach((edge, index) => {
    const d = Math.abs(edge - x);
    if (d < distance) {
      distance = d;
      best = index;
    }
  });
  return Math.max(0, Math.min(max, best));
}

// ---------------------------------------------------------------- menus

/** Records a row / range menu acts on: the checked rows when the clicked row is one of them, else the rows of the selected range (when it holds the clicked row), else the clicked row. */
export function menuRowIds(clicked: string, checked: readonly string[], rangeIds: readonly string[]): string[] {
  if (checked.length > 1 && checked.includes(clicked)) return [...checked];
  if (rangeIds.includes(clicked)) return [...new Set(rangeIds)];
  return [clicked];
}

/** Direction hints of 升序 / 降序 in the header menu (「0 → 9」「A → Z」「早 → 晚」). */
export function sortHints(type: GridFieldType | { type: GridFieldType; resultType?: GridFormulaResult }): { asc: string; desc: string } {
  const core = coreType(type);
  if (core === "number" || core === "money") return { asc: "0 → 9", desc: "9 → 0" };
  if (core === "date" || core === "datetime") return { asc: "早 → 晚", desc: "晚 → 早" };
  if (core === "singleSelect" || core === "multiSelect") return { asc: "按选项顺序", desc: "倒序" };
  if (core === "checkbox") return { asc: "未勾在前", desc: "已勾在前" };
  return { asc: "A → Z", desc: "Z → A" };
}

// ---------------------------------------------------------------- row move

/** Where a dragged record lands: between `beforeId` (the record now above it) and `afterId` (below it). */
export type GridRowMove = {
  rowId: string;
  /** Record right above the new place (null = first). */
  afterId: string | null;
  /** Record right below the new place (null = last). */
  beforeId: string | null;
  /** Grouped views: the group keys of the target group (field key → group key, "" = empty group). */
  group?: Readonly<Record<string, string>>;
};

/**
 * The move for dropping `rowId` before / after the record at `target` in `ids` (display order of
 * one group or of the whole list). Null when it would not move.
 */
export function rowMoveOf(ids: readonly string[], rowId: string, target: string, place: "before" | "after"): Omit<GridRowMove, "group"> | null {
  if (target === rowId) return null;
  const rest = ids.filter((id) => id !== rowId);
  const at = rest.indexOf(target);
  if (at < 0) return null;
  const index = place === "before" ? at : at + 1;
  const afterId = rest[index - 1] ?? null;
  const beforeId = rest[index] ?? null;
  const from = ids.indexOf(rowId);
  if (from >= 0 && (from === 0 ? afterId === null : ids[from - 1] === afterId) && (from === ids.length - 1 ? beforeId === null : ids[from + 1] === beforeId)) return null;
  return { rowId, afterId, beforeId };
}
