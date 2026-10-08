"use client";
/** Labelled values as a compact list (DataTable expandRecord `fields`, record rails). Core: no record-detail code. */
import { isRecordFieldEmpty, type RecordField } from "./record-detail-core.ts";

export function RecordFieldList<T>({ fields, row }: { fields: readonly RecordField<T>[]; row: T }) {
  return (
    <dl className="aui-kvlist">
      {fields.map((field) => {
        const empty = isRecordFieldEmpty(field, row);
        return (
          <div key={field.key} data-full={field.full || undefined}>
            <dt>{field.icon}{field.label}</dt>
            <dd data-empty={empty || undefined}>{empty ? "—" : field.value(row)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

