"use client";
/**
 * The input capture of BitableGrid: a transparent textarea over the active editable cell that holds keyboard
 * focus for it. Because focus sits in a real text box, an IME composes from the very first key (「张」, never
 * 「z张」); the grid opens the editor with the composed text when composition ends, and text typed while the editor
 * is still loading lands here and is handed over (grid-capture-core.ts). Arrow keys / Enter / Tab / shortcuts
 * bubble to the grid's keyboard handler as before; screen readers hear the field name and that typing edits it.
 */
import { useLayoutEffect, useRef, useState, type CompositionEvent, type CSSProperties, type FormEvent } from "react";

export type GridCaptureHandlers = {
  captureCompositionStart: (row: number, col: number) => void;
  captureCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => void;
  captureInput: (event: FormEvent<HTMLTextAreaElement>) => void;
  /** The capture had focus when it went away (the active cell moved by a paste / fill / data change): the grid refocuses. */
  captureLostFocus: () => void;
};

const BASE: CSSProperties = {
  position: "absolute", inset: 0, width: "100%", height: "100%", boxSizing: "border-box", margin: 0, padding: "6px 8px", border: 0, borderRadius: 0,
  resize: "none", overflow: "hidden", background: "transparent", color: "transparent", caretColor: "transparent", pointerEvents: "none",
  font: "inherit", lineHeight: "inherit", outline: "none", zIndex: 1,
};
/** Focused: the same ring the grid draws on a focused cell. */
const FOCUSED: CSSProperties = { ...BASE, outline: "2px solid var(--aui-primary)", outlineOffset: -2 };
/** While an IME composes, the text being composed shows in the cell like a starting editor. */
const COMPOSING: CSSProperties = { ...FOCUSED, color: "var(--aui-text)", caretColor: "auto", background: "var(--aui-surface)" };

export function GridCapture({ row, col, label, composing, on }: { row: number; col: number; label: string; composing: boolean; on: GridCaptureHandlers }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Runs before React removes the element: it still knows whether it had focus.
  useLayoutEffect(() => () => {
    if (ref.current && document.activeElement === ref.current) on.captureLostFocus();
  }, [on]);
  return (
    <textarea
      ref={ref}
      data-grid-capture=""
      tabIndex={0}
      rows={1}
      aria-label={`${label}（输入文字即可编辑，回车编辑，方向键移动）`}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      style={composing ? COMPOSING : focused ? FOCUSED : BASE}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onCompositionStart={() => on.captureCompositionStart(row, col)}
      onCompositionEnd={on.captureCompositionEnd}
      onInput={on.captureInput}
    />
  );
}
