import type { ReactNode } from "react";

/** One row of a ChangeList: field, old value, new value, how it takes effect. */
export type ChangeItem = {
  label: string;
  from: ReactNode;
  to: ReactNode;
  unit?: string;
  /** How the change takes effect, e.g. 立即 / 热重载 / 重启后 / 发客户端后. */
  effect?: string;
};

export type ChangeField<T> = {
  key: keyof T & string;
  label: string;
  unit?: string;
  effect?: string;
  /** Display a raw value (enum label, money, percent). Defaults to String(value); null/undefined render as —. */
  format?: (value: T[keyof T & string]) => ReactNode;
};

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Draft vs saved values → ChangeItem rows for the fields that actually changed, in field order.
 * Comparison is by value (arrays/objects via JSON), so an untouched field never shows as a change.
 */
export function changedFields<T extends object>(
  before: T,
  after: T,
  fields: readonly ChangeField<T>[],
): ChangeItem[] {
  const show = (field: ChangeField<T>, value: T[keyof T & string]): ReactNode =>
    value === null || value === undefined ? "—" : field.format ? field.format(value) : String(value);
  return fields
    .filter((field) => !sameValue(before[field.key], after[field.key]))
    .map((field) => ({
      label: field.label,
      from: show(field, before[field.key]),
      to: show(field, after[field.key]),
      ...(field.unit !== undefined && { unit: field.unit }),
      ...(field.effect !== undefined && { effect: field.effect }),
    }));
}
