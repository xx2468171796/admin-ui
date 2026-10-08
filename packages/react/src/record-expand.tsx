"use client";
import { useMemo, type ReactNode } from "react";
import { useRecordDetail } from "./record-detail-state.tsx";
import { RecordFieldList } from "./record-field-kv.tsx";
import { sectionFields, type RecordDetailLevel, type RecordField, type RecordLayout } from "./record-detail-core.ts";

/**
 * "Expand record" shared by DataTable (`expandRecord`) and BitableGrid (`@adminui/react/grid`):
 * opens one record in the record-detail standard (record-detail.tsx) — a small centered dialog for
 * small records (`peek`), a large centered dialog for the rest (`expanded`), full screen on phones;
 * previous / next record in display order (Alt + ↑ / ↓, J / K); Esc / close returns focus. The
 * table builds a default layout from its columns; `layout` groups them into sections, adds tabs,
 * highlights, actions and the record page link.
 */
export type ExpandRecordContext<T> = {
  row: T;
  /** The default field list (every column as label + full value); wrap or extend it. */
  fields: ReactNode;
  /** Position in the current list (0-based) and its row count. */
  index: number;
  total: number;
  close: () => void;
};
export type ExpandRecordOptions<T> = {
  /** Dialog title (default: `label`, then the row key). */
  title?: (row: T) => string;
  description?: (row: T) => ReactNode;
  /** Names the row in the expand button's label for screen readers (default: the row key). */
  label?: (row: T) => string;
  /** Column keys to list, in this order (default: every column except kind "actions", hidden ones included). */
  fields?: readonly string[];
  /** Replace the 「详情」 content; `context.fields` is the default list. */
  render?: (row: T, context: ExpandRecordContext<T>) => ReactNode;
  /**
   * The record layout (sections, aside, tabs, highlights, status, actions, href). Missing parts come
   * from the table: title from `title` / the primary field, one section with every column.
   */
  layout?: Partial<RecordLayout<T>>;
  /** Level a record opens at (default: peek for ≤ 8 fields without tabs, expanded otherwise). */
  level?: Exclude<RecordDetailLevel, "page">;
  /** Keep the open record in the URL (`?record=<key>` or this parameter): shareable, Back closes it. */
  url?: boolean | string;
  /** Controlled open record key, e.g. opened from a row action; leave out for built-in state. */
  openKey?: string | null;
  onOpenChange?: (key: string | null) => void;
};
export type RecordExpandField = {
  key: string;
  label: string;
  value: ReactNode;
  /** Plain text: copy button and emptiness. */
  text?: string;
  /** Long content (long text, tags, people, JSON): takes a whole row. */
  full?: boolean;
  /** Show a copy button. */
  copy?: boolean;
};

export type RecordExpandInput<T> = {
  options: ExpandRecordOptions<T> | undefined;
  /** Rows in display order (grouped order when grouped): previous / next walk this list. */
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** false while loading / failed: an open record closes instead of showing stale data. */
  enabled: boolean;
  /** The default field list of a row (label + full value). */
  fields: (row: T) => readonly RecordExpandField[];
  /**
   * The user moved to another record and then closed: put focus back on that record (its expand
   * button / its row). Closing on the record it opened on returns focus to the opener (Dialog does it).
   */
  onRefocus: (key: string) => void;
};

const toRecordField = <T,>(field: RecordExpandField, read: (row: T) => RecordExpandField | undefined): RecordField<T> => ({
  key: field.key,
  label: field.label,
  full: field.full,
  copy: field.copy,
  value: (row) => read(row)?.value,
  text: field.text !== undefined ? (row) => read(row)?.text ?? "" : undefined,
});

/** State + dialog element of "expand record"; call unconditionally, render `element` once. */
export function useRecordExpand<T>({ options, rows, rowKey, enabled, fields, onRefocus }: RecordExpandInput<T>) {
  const labelOf = (row: T) => options?.label?.(row) ?? rowKey(row);
  const first = rows[0];
  // Field definitions come from the first row's list (same columns for every row); values are read per row.
  const sample = first !== undefined ? fields(first) : [];
  const shape = sample.map((f) => `${f.key}:${f.full ? 1 : 0}:${f.copy ? 1 : 0}:${f.text !== undefined ? 1 : 0}`).join("|");
  const layout = useMemo((): RecordLayout<T> => {
    const cache = new WeakMap<object, Map<string, RecordExpandField>>();
    const read = (row: T, key: string) => {
      const box = typeof row === "object" && row !== null ? (row as object) : null;
      let map = box ? cache.get(box) : undefined;
      if (!map) {
        map = new Map(fields(row).map((f) => [f.key, f]));
        if (box) cache.set(box, map);
      }
      return map.get(key);
    };
    const defaults = sample.map((field) => toRecordField<T>(field, (row) => read(row, field.key)));
    const custom = options?.layout ?? {};
    // Everything the host gives wins (avatar, tags, crumb, alerts … included); the table fills title and the default section.
    return {
      ...custom,
      title: custom.title ?? options?.title ?? labelOf,
      subtitle: custom.subtitle ?? options?.description,
      sections: custom.sections ?? [{ key: "fields", fields: defaults }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, options?.layout, options?.title, options?.description, rows]);
  const render = options?.render;
  const detail = useRecordDetail<T>({
    rows,
    rowKey,
    layout,
    defaultLevel: options?.level ?? (render ? "expanded" : undefined),
    url: options?.url,
    enabled: enabled && Boolean(options),
    openKey: options?.openKey,
    onOpenChange: options?.onOpenChange,
    onRefocus,
    details: render
      ? (row: T): ReactNode => {
          const index = rows.indexOf(row);
          const list = layout.sections.flatMap((s) => sectionFields(s, row));
          return render(row, { row, fields: <RecordFieldList fields={list} row={row} />, index, total: rows.length, close: detail.close });
        }
      : undefined,
  });
  return { openKey: detail.openKey, open: (key: string) => detail.open(key), close: detail.close, labelOf, element: options ? detail.element : null };
}
