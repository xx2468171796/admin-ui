"use client";
/**
 * In-cell editors of BitableGrid's extra field types (bt/grid-b, G12). Rating: the stars become a
 * slider in the cell (← → / digits / Home clears, Enter saves ↓, Tab →, Esc cancels; clicking a star
 * in a non-editing cell sets it directly). Percent: a text box that keeps 「%」 inside
 * while typing, right-aligned like the cell. Progress and phone use the text editor; read-only types
 * (autoNumber, system fields, formula, lookup) and host-edited ones (attachment, link via
 * `openEditor`) have none.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Rating } from "./atoms.tsx";
import { Input } from "./primitives.tsx";
import { editorKeyAction, editorText } from "./grid-edit-core.ts";
import { readField } from "./grid-core.ts";
import { toRating } from "./grid-field-types.ts";
import type { GridCommitMove, GridEditorProps } from "./grid-editors.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export function GridRatingEditor<T>({ field, row, startText, onCommit, onCancel, error, variant = "cell" }: GridEditorProps<T>) {
  const max = field.max ?? 5;
  const typed = startText !== undefined && /^\d$/.test(startText) ? Math.min(max, Number(startText)) : undefined;
  const [value, setValue] = useState<number | null>(typed ?? toRating(readField(field, row), max));
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const commit = (move: GridCommitMove) => {
    // Like the text editor: a rejected value keeps the editor open (error shown) for another try;
    // an accepted one unmounts it. Only Esc closes it for good.
    if (done.current) return;
    onCommit({ value: valueRef.current }, move);
  };
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[role=slider]")?.focus({ preventScroll: true });
    const onDown = (event: PointerEvent) => {
      if (box.current && event.target instanceof Node && !box.current.contains(event.target)) commit("none");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (event: ReactKeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      done.current = true;
      onCancel();
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(event.shiftKey ? "up" : "down");
    } else if (event.key === "Tab") {
      event.preventDefault();
      commit(event.shiftKey ? "left" : "right");
    }
  };
  return (
    <div ref={box} className="aui-grid-editor aui-grid-rating-editor" data-variant={variant} data-error={error ? true : undefined} onKeyDown={onKeyDown}>
      <span className="aui-grid-rating-box">
        <Rating value={value} max={max} label={`编辑「${field.title}」`} onChange={setValue} />
      </span>
      {error && <div className="aui-grid-editor-error" role="alert">{error}</div>}
    </div>
  );
}

const MOVE = { commitDown: "down", commitUp: "up", commitRight: "right", commitLeft: "left" } as const;

/** Percent cells: the 「%」 stays inside the box while typing (「格子里编辑时 % 还在」); 「60%」 / 「60」 both parse. */
export function GridPercentEditor<T>({ field, row, startText, onCommit, onCancel, error, variant = "cell" }: GridEditorProps<T>) {
  const [text, setText] = useState(() => (startText ?? editorText(field, readField(field, row))).replace(/\s*[%％]$/, ""));
  const ref = useRef<HTMLInputElement>(null);
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
    if (startText === undefined) node.select();
    else node.setSelectionRange(node.value.length, node.value.length);
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !node.closest(".aui-grid-editor")?.contains(event.target)) commit("none");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (event: ReactKeyboardEvent) => {
    const action = editorKeyAction({ key: event.key, shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, isComposing: event.nativeEvent.isComposing }, false, variant);
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
  return (
    <div className="aui-grid-editor" data-variant={variant} data-error={error ? true : undefined}>
      <span className="aui-grid-editor-affixed">
        <Input
          ref={ref}
          className="aui-grid-editor-input"
          inputMode="decimal"
          value={text}
          aria-label={`编辑「${field.title}」（%）`}
          aria-invalid={error ? true : undefined}
          placeholder={field.placeholder}
          style={{ paddingInlineEnd: 24, textAlign: variant === "cell" ? "right" : undefined, fontVariantNumeric: "tabular-nums" }}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="aui-grid-editor-suffix" aria-hidden="true">%</span>
      </span>
      {error && <div className="aui-grid-editor-error" role="alert">{error}</div>}
    </div>
  );
}
