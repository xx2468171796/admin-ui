"use client";
/**
 * Status line of BitableGrid: saving / saved / errors with 撤销, a conflict someone else saved first
 * (EditConflictNotice: keep theirs, 重新填入我的, 用我的覆盖), and the draft of an editor whose record left the
 * view (重新填入 when the record is back).
 */
import { Suspense } from "react";
import { Check, X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { IconButton } from "./buttons.tsx";
import { valueText, type GridField } from "./grid-core.ts";
import type { GridCellChange } from "./grid-edit-core.ts";
import type { GridStatus, GridStatusConflict, GridStatusDraft, useGridEditing } from "./grid-editing.ts";
import { EditConflictNotice } from "./grid-lazy-parts.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export type GridStatusProps<T> = {
  status: GridStatus;
  editing: ReturnType<typeof useGridEditing<T>>;
  byKey: ReadonlyMap<string, GridField<T>>;
  /** Where a record / field is now (-1: not shown). */
  rowIndex: (rowId: string) => number;
  colIndex: (field: string) => number;
  startEdit: (row: number, col: number, startText?: string) => void;
};

/** What the status line shows (loaded lazily; its live-region container, GridStatusLine in grid-chrome.tsx, is always mounted). */
export function GridStatusContent<T>(props: GridStatusProps<T>) {
  const { status, editing } = props;
  if (!status) return null;
  if (status.conflict) return <Conflict {...props} conflict={status.conflict} />;
  return (
    <>
      {status.tone === "success" ? <Check aria-hidden="true" /> : status.tone === "error" ? <X aria-hidden="true" /> : <span className="aui-grid-status-spin" aria-hidden="true" />}
      <span className="aui-grid-status-text">{status.text}</span>
      {status.draft && <Refill {...props} draft={status.draft} />}
      {status.undo && editing.canUndo && <Button variant="text" size="sm" onClick={editing.undo}>撤销</Button>}
      {status.tone !== "info" && <IconButton label="关闭提示" onClick={() => editing.setStatus(null)} icon={<X />} />}
    </>
  );
}

/** 「重新填入」 the draft of a record that left the view, once it is shown again. */
function Refill<T>({ draft, editing, rowIndex, colIndex, startEdit }: GridStatusProps<T> & { draft: GridStatusDraft }) {
  const row = rowIndex(draft.rowId);
  const col = colIndex(draft.field);
  if (row < 0 || col < 0) return null;
  return (
    <Button variant="text" size="sm" onClick={() => {
      editing.setStatus(null);
      startEdit(row, col, draft.text);
    }}>重新填入</Button>
  );
}

/** A cell someone else saved first keeps their value; mine can be put back or forced. */
function Conflict<T>({ conflict, byKey, editing, rowIndex, colIndex, startEdit }: GridStatusProps<T> & { conflict: GridStatusConflict }) {
  const field = byKey.get(conflict.change.field);
  const show = (value: unknown) => (field ? valueText(field, value) : String(value ?? "")) || "（空）";
  const row = rowIndex(conflict.change.rowId);
  const col = colIndex(conflict.change.field);
  return (
    <Suspense fallback={null}>
      <EditConflictNotice
        compact
        by={conflict.by}
        at={conflict.at}
        what={field ? `「${field.title}」` : undefined}
        theirs={show(conflict.theirs)}
        mine={show(conflict.change.value)}
        onDismiss={() => editing.setStatus(null)}
        onRefill={row >= 0 && col >= 0 ? () => {
          editing.setStatus(null);
          startEdit(row, col, field ? valueText(field, conflict.change.value) : String(conflict.change.value ?? ""));
        } : undefined}
        onOverwrite={async () => {
          editing.setStatus(null);
          await editing.apply([conflict.change as GridCellChange<T>], "edit", { label: `修改「${field?.title ?? ""}」`, overwrite: true });
        }}
      />
    </Suspense>
  );
}
