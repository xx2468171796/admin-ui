"use client";
/**
 * In-cell editors of BitableGrid, one per field type: text / number / money / url / email (input in
 * the cell), longText (a taller box over the cell; Shift + Enter = new line), date / datetime
 * (typed text + the kit calendar under the cell), singleSelect / multiSelect / user (a box with the chosen tags and a
 * searchable option list under it, grid-editors-option.tsx).
 * Checkbox cells have no editor: Enter / click toggles them. Keys: Enter commit ↓, Shift + Enter ↑,
 * Tab →, Shift + Tab ←, Esc cancel; clicking elsewhere commits. IME composition is respected.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Input } from "./primitives.tsx";
import { editorKeyAction, editorText } from "./grid-edit-core.ts";
import { readField, type GridField, type GridPerson } from "./grid-core.ts";
import { OptionEditor } from "./grid-editors-option.tsx"; // one select look
import { isReadOnlyType } from "./grid-field-types.ts"; // bt/grid-b
import { GridPercentEditor, GridRatingEditor } from "./grid-editors-extra.tsx"; // bt/grid-b
import { DateCellEditor } from "./grid-editors-date.tsx"; // bt/datepicker
import { Kbd } from "./tooltip.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

/** Where the active cell goes after a commit. */
export type GridCommitMove = "down" | "up" | "right" | "left" | "none";
export type GridEditorCommit = { text: string } | { value: unknown };
export type GridEditorProps<T> = {
  field: GridField<T>;
  row: T;
  /** The character that started editing (type-to-edit replaces the content), else undefined. */
  startText?: string;
  /** The cell element (anchor of option lists). */
  anchor: HTMLElement;
  /** Choices of a user field. */
  people?: readonly GridPerson[];
  onCommit: (commit: GridEditorCommit, move: GridCommitMove) => void;
  onCancel: () => void;
  /** Error of the last commit attempt (shown under the editor; the editor stays open). */
  error?: string | null;
  /**
   * `cell` (default): drawn over a grid cell. `field`: in a record detail's value cell (RecordField.edit)
   * — the editor sits in the flow at the cell's full width (36px box / a growing text area), option lists
   * hang under the box, long text: Enter = new line, Ctrl + Enter saves.
   */
  variant?: "cell" | "field";
};

const MOVE = { commitDown: "down", commitUp: "up", commitRight: "right", commitLeft: "left" } as const;

/** The editor for a field (null = not editable in place, e.g. checkbox). */
export function GridCellEditor<T>(props: GridEditorProps<T>) {
  const { field } = props;
  if (field.type === "checkbox") return null;
  if (isReadOnlyType(field.type) || field.type === "attachment" || field.type === "link") return null; // bt/grid-b
  if (field.type === "rating") return <GridRatingEditor {...props} />; // bt/grid-b
  if (field.type === "percent") return <GridPercentEditor {...props} />;
  if (field.type === "singleSelect" || field.type === "multiSelect" || field.type === "user") return <OptionEditor {...props} />;
  if (field.type === "date" || field.type === "datetime") return <DateCellEditor {...props} />; // bt/datepicker
  return <TextEditor {...props} />;
}

function TextEditor<T>({ field, row, startText, onCommit, onCancel, error, variant = "cell" }: GridEditorProps<T>) {
  const multiline = field.type === "longText";
  const [text, setText] = useState(startText ?? editorText(field, readField(field, row)));
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const done = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;
  const commit = (move: GridCommitMove) => {
    if (done.current) return;
    onCommit({ text: textRef.current }, move);
  };
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    if (startText === undefined) node.select?.();
    else node.setSelectionRange?.(node.value.length, node.value.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Clicking outside the editor commits (the grid ignores the click that started editing).
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.closest(".aui-grid-editor")?.contains(event.target)) commit("none");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (event: ReactKeyboardEvent) => {
    const action = editorKeyAction({ key: event.key, shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, isComposing: event.nativeEvent.isComposing }, multiline, variant);
    event.stopPropagation();
    if (!action) return;
    event.preventDefault();
    if (action === "cancel") {
      done.current = true;
      onCancel();
      return;
    }
    commit(MOVE[action]);
  };
  const prefix = field.type === "money" ? (field.currency ?? "").trim() : "";
  const common = {
    ref,
    value: text,
    "aria-label": prefix ? `编辑「${field.title}」（${prefix}）` : `编辑「${field.title}」`,
    "aria-invalid": error ? true : undefined,
    placeholder: field.placeholder,
    onChange: (event: { target: { value: string } }) => setText(event.target.value),
    onKeyDown,
  };
  return (
    <div className="aui-grid-editor" data-variant={variant} data-multiline={multiline || undefined} data-error={error ? true : undefined}>
      {multiline ? (
        <textarea className="aui-input aui-grid-editor-input" rows={variant === "field" ? 4 : 5} {...common} />
      ) : prefix ? (
        // Money: the currency stays visible while typing (the cell shows it too); amounts align like the cell.
        <span className="aui-grid-editor-affixed">
          <span className="aui-grid-editor-prefix" aria-hidden="true">{prefix}</span>
          <Input className="aui-grid-editor-input" inputMode="decimal" style={{ paddingInlineStart: `calc(${Array.from(prefix).length}ch + 14px)`, textAlign: variant === "cell" ? "right" : undefined }} {...common} />
        </span>
      ) : (
        <Input className="aui-grid-editor-input" inputMode={field.type === "number" ? "decimal" : field.type === "email" ? "email" : field.type === "url" ? "url" : undefined} {...common} />
      )}
      {error && <div className="aui-grid-editor-error" role="alert">{error}</div>}
      {multiline && !error && <div className="aui-grid-editor-hint">{variant === "field" ? <><Kbd keys="Mod+Enter" size="sm" flat /> 保存 · <Kbd keys="Enter" size="sm" flat /> 换行 · <Kbd keys="Esc" size="sm" flat /> 取消</> : <><Kbd keys="Enter" size="sm" flat /> 保存 · <Kbd keys="Shift+Enter" size="sm" flat /> 换行 · <Kbd keys="Esc" size="sm" flat /> 取消</>}</div>}
    </div>
  );
}
