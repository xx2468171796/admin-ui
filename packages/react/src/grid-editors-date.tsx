"use client";
/**
 * Date / datetime cell editor of BitableGrid (bt/datepicker): the cell becomes a text box (type
 * 2026-10-05, 2026/10/5, 10/5, with a time for datetime fields; an empty box only shows the format
 * 「年-月-日」, never a sample date) and the kit calendar hangs under it without taking focus — with the
 * quick row (今天 / 明天 / 下周一 / 一周后 · 清空) and, for datetime fields, the half-hour time column. Enter / Tab / Shift+Tab commit and move like the other editors, Esc cancels;
 * ↓ moves into the calendar, where Enter picks (a date field commits at once, a datetime field keeps
 * the time and stays in the box) and Esc goes back to the box.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Input } from "./primitives.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import { isInsideLayer } from "./floating-layer.ts";
import { Calendar } from "./date-calendar.tsx";
import { QuickDays, TimeList } from "./date-picker-parts.tsx";
import { editorKeyAction, editorText } from "./grid-edit-core.ts";
import { readField } from "./grid-core.ts";
import { displayDateTime, parseDateText, parseDateTimeText, timeOptions, todayKey } from "./date-picker-core.ts";
import type { GridCommitMove, GridEditorProps } from "./grid-editors.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

const MOVE = { commitDown: "down", commitUp: "up", commitRight: "right", commitLeft: "left" } as const;
const TIMES = timeOptions(30);

/** Typed text in the shape the grid parses (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm`); unreadable text goes as-is (the grid says what is wrong). */
export function normaliseDateCellText(text: string, withTime: boolean, now: Date = new Date()): string {
  const t = text.trim();
  if (!t) return "";
  if (withTime) {
    const v = parseDateTimeText(t, now, "00:00");
    return v ? displayDateTime(v) : t;
  }
  return parseDateText(t, now) ?? t;
}

export function DateCellEditor<T>({ field, row, startText, onCommit, onCancel, error, variant = "cell" }: GridEditorProps<T>) {
  const withTime = field.type === "datetime";
  const [text, setText] = useState(startText ?? editorText(field, readField(field, row)));
  const [open, setOpen] = useState(true);
  const box = useRef<HTMLDivElement | null>(null);
  // The calendar hangs under the box: keep the element in state so the paint after mounting anchors it.
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const setBox = (node: HTMLDivElement | null) => {
    box.current = node;
    setBoxEl(node);
  };
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;
  const commit = (move: GridCommitMove, value = textRef.current) => {
    if (done.current) return;
    onCommit({ text: normaliseDateCellText(value, withTime) }, move);
  };
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    if (startText === undefined) node.select();
    else node.setSelectionRange(node.value.length, node.value.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Clicking outside the editor (and outside its calendar) commits.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target) && !isInsideLayer(event.target)) commit("none");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const typed = normaliseDateCellText(text, withTime);
  const today = todayKey();
  const pickDay = (picked: string) => {
    if (!withTime) return commit("none", picked);
    setText(`${picked} ${time}`);
    input.current?.focus({ preventScroll: true });
  };
  const day = /^\d{4}-\d{2}-\d{2}/.test(typed) ? typed.slice(0, 10) : "";
  const time = withTime && typed.length >= 16 ? typed.slice(11, 16) : "00:00";
  const onKeyDown = (event: ReactKeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "ArrowDown" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const day = () => document.querySelector<HTMLElement>(".aui-grid-datepop [data-autofocus]");
      // Already open: go in now (no frame of delay); else after the calendar mounts.
      if (open && day()) day()?.focus({ preventScroll: true });
      else {
        setOpen(true);
        requestAnimationFrame(() => day()?.focus({ preventScroll: true }));
      }
      return;
    }
    const action = editorKeyAction({ key: event.key, shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, isComposing: event.nativeEvent.isComposing }, false, variant);
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
    <div ref={setBox} className="aui-grid-editor" data-variant={variant} data-error={error ? true : undefined}>
      <Input
        ref={input}
        className="aui-grid-editor-input"
        value={text}
        aria-label={`编辑「${field.title}」`}
        aria-invalid={error ? true : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        placeholder={field.placeholder ?? (withTime ? "年-月-日 时:分" : "年-月-日")}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {error && <div className="aui-grid-editor-error" role="alert">{error}</div>}
      <PopoverLayer
        open={open}
        anchor={boxEl}
        focusTarget={input.current}
        label={`选择「${field.title}」`}
        initialFocus={false}
        className="aui-popover aui-datepop aui-grid-datepop"
        onClose={(returnFocus) => {
          if (returnFocus) input.current?.focus({ preventScroll: true });
          else setOpen(false);
        }}
        sheet={{
          title: field.title,
          start: <button type="button" className="aui-sheet-action" data-muted onPointerDown={(event) => { event.preventDefault(); commit("none", ""); }}>清空</button>,
          end: <button type="button" className="aui-sheet-action" onPointerDown={(event) => { event.preventDefault(); commit("none"); }}>确定</button>,
        }}
      >
        <div className="aui-datepop-body">
          <QuickDays today={today} value={day} accept={() => true} onPick={pickDay} onClear={text ? () => commit("none", "") : undefined} />
          <div className={withTime ? "aui-datepop-main" : undefined}>
            <Calendar value={day} initialFocus={day || undefined} today={today} onSelect={pickDay} />
            {withTime && (
              <TimeList className="aui-timelist aui-dcal-timecol" label="时间列表" autoFocus={false} options={TIMES} value={typed.length >= 16 ? time : ""} nearest={TIMES.includes(time) ? time : "09:00"}
                onPick={(t) => {
                  setText(`${day || today} ${t}`);
                  input.current?.focus({ preventScroll: true });
                }} />
            )}
          </div>
        </div>
      </PopoverLayer>
    </div>
  );
}
