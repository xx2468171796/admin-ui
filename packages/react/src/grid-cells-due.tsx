"use client";
/**
 * Deadline dates in grid cells and card fields (GridField.deadline): the cell tone and the overdue suffix.
 * Internal to the grid / views (not re-exported); the pure rules are deadline-core.ts.
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { CellDate } from "./displays.tsx";
import { deadlineText, deadlineTone, fieldDeadline } from "./deadline-core.ts";
import type { GridField } from "./grid-core.ts";
import type { GridCellTone } from "./grid-field-types.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

/**
 * Text tone of a cell: the field's own `tone(row)` when it returns one, else its deadline (overdue = danger,
 * today / soon = warning; `deadline.closed(row)` = none). `timeZone` = the zone when the field has none.
 */
export function gridCellTone<T>(field: GridField<T>, row: T, timeZone?: string): GridCellTone | undefined {
  const own = field.tone?.(row);
  if (own) return own;
  const state = field.deadline ? fieldDeadline(field, row, { timeZone }) : null;
  return (state && deadlineTone(state)) ?? undefined;
}

/** A deadline date: the date, then (overdue) a compact 「逾期 N 天」 that truncates in narrow columns; 「已逾期 N 天」 on hover. */
export function DeadlineDate({ value, field, row, time }: { value: unknown; field: GridField<never>; row: unknown; time?: boolean }) {
  const zone = useAdminDefaults().timeZone;
  const date = <CellDate value={value as string | null} time={time} timeZone={field.timeZone} />;
  const state = fieldDeadline(field, row as never, { timeZone: zone });
  if (!state || state.kind === "none") return date;
  const full = deadlineText(state);
  return (
    <span className="aui-grid-due" data-due={state.kind}>
      {date}
      {state.kind === "overdue" ? <span className="aui-grid-due-tag" data-tip={full}>{deadlineText(state, true)}</span> : <span className="aui-sr-only">，{full}</span>}
    </span>
  );
}
