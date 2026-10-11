/**
 * Type-to-edit through the grid's input capture (grid-capture.tsx): the active editable cell keeps a hidden
 * textarea focused, so an IME can compose from the very first key. What happens to the edit state on the
 * capture's events is decided here (pure, unit-tested in test/grid-capture-core.test.ts):
 *
 * - a printable key (not IME): edit starts with that character (the grid prevents its default);
 * - characters typed before the lazily loaded editor mounts land in the capture and are appended, none is lost;
 * - compositionstart: edit starts, but the editor waits (mounting it would steal focus and break the composition);
 * - compositionend: the composed text (「张」, never 「z张」) becomes the editor's start text; an empty
 *   composition (Esc in the IME) cancels an edit it started.
 */

/** The cell being edited, by record id and field key (not by position: rows may move while editing). */
export type GridEditState = {
  rowId: string;
  field: string;
  /** Text the editor starts with (type-to-edit), else undefined = the current value, selected. */
  startText?: string;
  /** An IME composition runs in the capture: the editor is not mounted yet. */
  composing?: boolean;
  error?: string | null;
};

export type CaptureEvent =
  | { type: "compositionstart"; rowId: string; field: string }
  | { type: "compositionend"; text: string }
  | { type: "input"; text: string; composing?: boolean };

/** The next edit state for an event of the capture (null = no edit). */
export function captureEdit(edit: GridEditState | null, event: CaptureEvent): GridEditState | null {
  switch (event.type) {
    case "compositionstart":
      if (edit && (edit.rowId !== event.rowId || edit.field !== event.field)) return edit;
      return edit ? { ...edit, composing: true } : { rowId: event.rowId, field: event.field, startText: "", composing: true };
    case "compositionend": {
      if (!edit?.composing) return edit;
      const startText = (edit.startText ?? "") + event.text;
      return startText ? { ...edit, startText, composing: false } : null;
    }
    case "input":
      // Mid-composition input is the IME's preview, not text yet.
      if (!edit || edit.composing || event.composing || !event.text) return edit;
      return { ...edit, startText: (edit.startText ?? "") + event.text };
  }
}

/**
 * Where the edited cell is now. Edits follow their record, not a row index: rows re-sorted / refreshed / moved by
 * an insert keep the editor on the same record. A record missing while data is still loading is waited for
 * (the draft is kept); missing once loading settled = gone (the grid ends the edit and offers the draft back).
 */
export type EditLocation = { kind: "here"; row: number; col: number } | { kind: "wait" } | { kind: "gone" };
export function locateEdit(edit: Pick<GridEditState, "rowId" | "field">, find: { rowIndex: (rowId: string) => number; colIndex: (field: string) => number }, settled: boolean): EditLocation {
  const row = find.rowIndex(edit.rowId);
  const col = find.colIndex(edit.field);
  if (row >= 0 && col >= 0) return { kind: "here", row, col };
  return settled ? { kind: "gone" } : { kind: "wait" };
}

/** Unsaved text of an editor (reported while typing), kept per edited cell. */
export type GridDraft = { rowId: string; field: string; text: string };
/** Text an editor (re)opens with: the draft of this cell when there is one (a remount after its row came back), else the start text. */
export const editorStartText = (edit: GridEditState, draft: GridDraft | null) => (draft && draft.rowId === edit.rowId && draft.field === edit.field ? draft.text : edit.startText);

/** Does the editor of this edit mount now (not while the IME composes in the capture). */
export const editorReady = (edit: GridEditState | null) => Boolean(edit && !edit.composing);
