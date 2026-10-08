/**
 * Pure model of KanbanBoard (bt/views V3): columns from a single-select field's options (with their
 * tones), the 「未设置」 column for empty / unknown values, card placement, move planning (pointer drop
 * slot and keyboard steps), and horizontal paging between columns. Unit-tested in
 * test/views-kanban-core.test.ts.
 */
import { optionTone, resolveOptionTone, type OptionTone } from "../option-tone.ts";
import type { GridSelectOption } from "../grid-core.ts";

/** The option's tone as one of the seven (legacy `success` → brand). */
export const toneOfOption = (option: GridSelectOption): OptionTone => optionTone(resolveOptionTone(option)) ?? "gray";

/** Key of the column holding records whose group value is empty or not one of the options. */
export const KANBAN_UNSET = "__unset";
export type KanbanColumn = {
  /** The option value, or KANBAN_UNSET. */
  key: string;
  label: string;
  tone: OptionTone;
  unset: boolean;
};
export type KanbanColumnState = {
  /** Collapsed column keys (shown as a narrow strip). */
  collapsed?: readonly string[];
  /** Hidden column keys (not shown; listed in the board's 「隐藏的列」 menu). */
  hidden?: readonly string[];
  /** Tone overrides per column key (column ⋯ → 颜色). */
  tones?: Readonly<Record<string, OptionTone>>;
};

/** Columns in option order, 「未设置」 first (collapsed by default — see `defaultCollapsed`). */
export function kanbanColumns(options: readonly GridSelectOption[], state: KanbanColumnState = {}, unsetLabel = "未设置", showUnset = true): KanbanColumn[] {
  const hidden = new Set(state.hidden ?? []);
  const columns: KanbanColumn[] = [];
  if (showUnset) columns.push({ key: KANBAN_UNSET, label: unsetLabel, tone: state.tones?.[KANBAN_UNSET] ?? "gray", unset: true });
  for (const o of options) columns.push({ key: o.value, label: o.label, tone: state.tones?.[o.value] ?? toneOfOption(o), unset: false });
  return columns.filter((c) => !hidden.has(c.key));
}
/** The column key of a record's group value. */
export function columnKeyOf(value: unknown, options: readonly GridSelectOption[]): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && options.some((o) => o.value === v) ? v : KANBAN_UNSET;
}
/** Record ids per column key, keeping the host's record order. */
export function placeCards<T>(records: readonly T[], recordId: (r: T) => string, groupValue: (r: T) => unknown, options: readonly GridSelectOption[]): Record<string, string[]> {
  const out: Record<string, string[]> = { [KANBAN_UNSET]: [] };
  for (const o of options) out[o.value] = [];
  for (const r of records) (out[columnKeyOf(groupValue(r), options)] ??= []).push(recordId(r));
  return out;
}
/** The value written back for a column (null for 「未设置」). */
export const columnValue = (key: string): string | null => (key === KANBAN_UNSET ? null : key);

export type KanbanMove = { id: string; from: string; to: string; /** Card it lands before (null = end of the column). */ beforeId: string | null; index: number };
/**
 * Move card `id` to column `to` at `index` (index counted without the card itself). Returns the new
 * placement and the move, or null when nothing changes.
 */
export function planMove(placement: Readonly<Record<string, readonly string[]>>, id: string, to: string, index: number): { next: Record<string, string[]>; move: KanbanMove } | null {
  const from = Object.keys(placement).find((k) => placement[k]?.includes(id));
  if (from === undefined) return null;
  const next: Record<string, string[]> = {};
  for (const [k, list] of Object.entries(placement)) next[k] = list.filter((x) => x !== id);
  const target = (next[to] ??= []);
  const at = Math.max(0, Math.min(target.length, index));
  const oldIndex = placement[from]?.indexOf(id) ?? -1;
  if (from === to && oldIndex === at) return null;
  target.splice(at, 0, id);
  return { next, move: { id, from, to, beforeId: target[at + 1] ?? null, index: at } };
}
/** A move the host hasn't confirmed yet (optimistic): card `id` goes to column `to`, before `beforeId` (null = last). */
export type PendingKanbanMove = { id: string; to: string; beforeId: string | null };
/**
 * Lay in-flight moves over the host's placement, oldest first. Each move is re-applied by its anchor
 * card, so a records update for another card (or the confirmation of an earlier move) doesn't undo it.
 */
export function applyPendingMoves(base: Readonly<Record<string, readonly string[]>>, moves: readonly PendingKanbanMove[]): Record<string, readonly string[]> {
  let placement: Record<string, readonly string[]> = base;
  for (const move of moves) {
    const target = (placement[move.to] ?? []).filter((x) => x !== move.id);
    const at = move.beforeId ? target.indexOf(move.beforeId) : -1;
    const plan = planMove(placement, move.id, move.to, at < 0 ? target.length : at);
    if (plan) placement = plan.next;
  }
  return placement;
}
/**
 * Drop index from the pointer: the first card whose vertical middle is below `y` (card rects of the
 * target column in order, the dragged card excluded).
 */
export function dropIndex(cards: readonly { top: number; height: number }[], y: number): number {
  const i = cards.findIndex((c) => y < c.top + c.height / 2);
  return i < 0 ? cards.length : i;
}
/**
 * Keyboard move: Alt+↑ / Alt+↓ one place within the column, Alt+← / Alt+→ to the end of the previous /
 * next visible, expanded column. null at the edges.
 */
export function keyboardMove(placement: Readonly<Record<string, readonly string[]>>, columns: readonly string[], id: string, dir: "up" | "down" | "left" | "right"): { to: string; index: number } | null {
  const from = columns.find((k) => placement[k]?.includes(id));
  if (from === undefined) return null;
  const list = placement[from] ?? [];
  const index = list.indexOf(id);
  if (dir === "up") return index > 0 ? { to: from, index: index - 1 } : null;
  if (dir === "down") return index < list.length - 1 ? { to: from, index: index + 1 } : null;
  const c = columns.indexOf(from) + (dir === "left" ? -1 : 1);
  const to = columns[c];
  return to === undefined ? null : { to, index: (placement[to] ?? []).length };
}
/** 「阶段：报价 → 成交」 */
export const moveLabel = (fieldTitle: string, fromLabel: string, toLabel: string) => `${fieldTitle}：${fromLabel} → ${toLabel}`;

/**
 * ‹ / › paging: the scrollLeft that puts the next / previous column that is not fully visible at the
 * left edge (column lefts in scroll coordinates, sorted). Clamped to the scroll range.
 */
export function pageTo(lefts: readonly number[], scrollLeft: number, clientWidth: number, scrollWidth: number, dir: -1 | 1): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.round(v)));
  if (dir > 0) {
    const right = scrollLeft + clientWidth;
    // The first column that is cut off at the right edge (or beyond it) becomes the first visible one.
    const next = lefts.find((l, i) => l > scrollLeft + 1 && (lefts[i + 1] ?? scrollWidth) > right + 1);
    return clamp(next ?? scrollLeft + clientWidth);
  }
  // Back: the furthest column left so that the current first column ends at the right edge.
  const target = scrollLeft - clientWidth;
  const prev = lefts.find((l) => l >= target - 1 && l < scrollLeft - 1);
  return clamp(prev ?? target);
}
