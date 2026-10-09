"use client";
/**
 * The note tag of a dashboard widget (8.8, `DashboardWidgetData.note`): a small tag next to the frame title
 * — 「按成交日汇率折算 · 缺汇率 3 条」 — neutral or warning. A long label is cut with an ellipsis (full text in
 * the tooltip); with `detail` the tag is a button whose click / Enter opens a popover with it (the rates
 * used, the records left out). Where the frame hides its title row (a 「数字组」 in a read-only view) the tag
 * goes into the title row of the group's top-right number instead. Never changes the widget's height.
 */
import { useRef, useState, type ReactNode } from "react";
import { PopoverPanel } from "./popover-panel.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";

/** A note the host attaches to a widget's data (how the number was computed, what is missing). */
export type DashboardWidgetNote = {
  label: string;
  /** Shown in a popover when the tag is clicked (text or a small list / table). */
  detail?: ReactNode | string;
  /** warning = the warning colour (something is missing or estimated); default neutral. */
  tone?: "neutral" | "warning";
};

export function WidgetNoteTag({ note }: { note: DashboardWidgetNote }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const tone = note.tone ?? "neutral";
  const common = { className: "aui-dbb-tag aui-dbb-note-tag", "data-kind": "note", "data-tone": tone, "data-tip": note.label };
  if (note.detail === undefined || note.detail === null || note.detail === "") return <span {...common}>{note.label}</span>;
  return (
    <>
      <button ref={anchor} type="button" {...common} aria-haspopup="dialog" aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen((v) => !v); }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        {note.label}
      </button>
      <PopoverPanel open={open} anchor={anchor.current} onClose={() => setOpen(false)} title={note.label} width="sm" align="end">
        {typeof note.detail === "string" ? <p className="aui-dbb-note-detail">{note.detail}</p> : note.detail}
      </PopoverPanel>
    </>
  );
}
