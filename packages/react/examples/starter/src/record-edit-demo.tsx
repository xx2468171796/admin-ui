import { useState } from "react";
import type { RecordFieldEdit, RecordFieldEditContext } from "@adminui/react";
import { GridCellEditor, type GridEditorCommit, type GridField } from "@adminui/react/grid";

// 记录详情里就地改一个字段（RecordField.edit）：和多维表格同一个编辑器，variant="field" 让它排在值那一格里。
// 保存是宿主的事（这里演示：等 300ms；内容带「失败」就拒绝，编辑器留着显示原因）。

type Row = { id: string } & Record<string, unknown>;
type Save = (value: unknown) => Promise<void>;

function FieldEditor({ field, row, context, save }: { field: GridField<Row>; row: Row; context: RecordFieldEditContext; save: Save }) {
  const [error, setError] = useState<string | null>(null);
  const commit = async (commit: GridEditorCommit) => {
    try {
      await save("text" in commit ? commit.text : commit.value);
      context.done();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败，请重试");
    }
  };
  return <GridCellEditor<Row> variant="field" field={field} row={row} anchor={context.anchor} onCommit={(c) => void commit(c)} onCancel={context.done} error={error} />;
}

/** `edit` of a RecordField: the value (raw) of this record + how to save it. */
export function demoEdit(field: GridField<Row>, recordId: string, value: unknown, save: Save): RecordFieldEdit {
  const row: Row = { id: recordId, [field.key]: value };
  return { render: (context) => <FieldEditor key={`${recordId}:${field.key}`} field={field} row={row} context={context} save={save} /> };
}

/** Demo save: 300ms; text containing 「失败」 is refused. */
export const demoSave = (apply: (value: unknown) => void): Save => async (value) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (typeof value === "string" && value.includes("失败")) throw new Error("保存失败：网络中断，改动已保留");
  apply(value);
};
