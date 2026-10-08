"use client";
/** BitableGrid cell renderers and field-type icons (same Cell* components as DataTable). */
import type { ReactNode } from "react";
import { AlignLeft, Calendar, CalendarClock, Check, CircleChevronDown, CircleDollarSign, Hash, Link, Mail, Puzzle, SquareCheck, Tags, Type, Users } from "lucide-react";
import { CellLink, CellLongText, CellPeople, CellTags } from "./cells.tsx";
import { CellDate } from "./displays.tsx";
import { fieldText, readField, toMinor, toPeople, valueText, type GridField, type GridFieldType } from "./grid-core.ts";
import { resolveOptionTone } from "./option-tone.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
import { GRID_EXTRA_CELL_RENDERERS, GRID_EXTRA_FIELD_ICONS } from "./grid-cells-extra.tsx"; // bt/grid-b

// ---------------------------------------------------------------- cell renderers

export const FIELD_ICONS: Record<GridFieldType, typeof Type> = {
  text: Type,
  longText: AlignLeft,
  number: Hash,
  money: CircleDollarSign,
  date: Calendar,
  datetime: CalendarClock,
  singleSelect: CircleChevronDown,
  multiSelect: Tags,
  user: Users,
  checkbox: SquareCheck,
  url: Link,
  email: Mail,
  custom: Puzzle,
  ...GRID_EXTRA_FIELD_ICONS, // bt/grid-b
};
const toSelectValues = (value: unknown) => (Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value]).filter((v): v is string => typeof v === "string");
const chipsOf = (field: GridField<never>, value: unknown) =>
  toSelectValues(value).map((v) => {
    const option = field.options?.find((o) => o.value === v);
    return { key: v, label: option?.label ?? v, tone: option ? resolveOptionTone(option) : undefined };
  });

/**
 * How each field type draws a value, built from the same Cell* components DataTable uses, so a value
 * looks identical in both. Inside the grid they clamp to the row; in the expand-record dialog they
 * render in full. Override one field with `field.render`.
 */
export const GRID_CELL_RENDERERS: { readonly [K in GridFieldType]: (value: unknown, field: GridField<never>, row?: unknown) => ReactNode } = {
  text: (value, field) => {
    const text = valueText(field, value);
    return text ? <span className="aui-grid-text" data-tip={text} data-tip-truncated="">{text}</span> : <span className="aui-cell-empty">—</span>;
  },
  longText: (value) => <CellLongText text={typeof value === "string" ? value : null} />,
  number: (value, field) => valueText(field, value) || <span className="aui-cell-empty">—</span>,
  money: (value, field) => (toMinor(value) === null ? <span className="aui-cell-empty">—</span> : valueText(field, value)),
  date: (value, field) => <CellDate value={value as string | null} timeZone={field.timeZone} />,
  datetime: (value, field) => <CellDate value={value as string | null} time timeZone={field.timeZone} />,
  singleSelect: (value, field) => <CellTags label={field.title} items={chipsOf(field, value).slice(0, 1)} />,
  multiSelect: (value, field) => <CellTags label={field.title} items={chipsOf(field, value)} />,
  user: (value, field) => <CellPeople label={field.title} people={toPeople(value)} />,
  checkbox: (value) => (
    <span className="aui-grid-check" data-checked={value === true || undefined} role="img" aria-label={value === true ? "是" : "否"}>
      {value === true ? <Check aria-hidden="true" /> : null}
    </span>
  ),
  url: (value) => <CellLink href={typeof value === "string" ? value : null} />,
  email: (value) => (typeof value === "string" && value ? <CellLink href={`mailto:${value}`}>{value}</CellLink> : <span className="aui-cell-empty">—</span>),
  custom: (value, field) => valueText(field, value) || <span className="aui-cell-empty">—</span>,
  ...GRID_EXTRA_CELL_RENDERERS, // bt/grid-b
};
/** The cell content of one field for one row: `field.render`, else the type's renderer. */
export function renderGridCell<T>(field: GridField<T>, row: T, context: { selected: boolean } = { selected: false }): ReactNode {
  if (field.render) return field.render(row, context);
  const value = readField(field, row);
  if (field.type === "custom" && field.text) return fieldText(field, row) || <span className="aui-cell-empty">—</span>;
  return GRID_CELL_RENDERERS[field.type](value, field as unknown as GridField<never>, row);
}

