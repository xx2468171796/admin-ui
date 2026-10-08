"use client";
/**
 * SideSheet / BottomSheet (bt/foundations F0.6): the
 * same Dialog frame (focus trap, Esc, overlay, Provider portal, focus return) anchored to the right edge at
 * full height — no radius, a 1px line on its left + the dialog shadow, 56px header — or to the bottom of a
 * phone screen. SideSheet is for tool panels next to the page — settings, a trial run, comments — never for
 * record detail (records open as centered dialogs or pages, TABLES.md §3; from a view: RecordDetailDialog frame="drawer").
 *
 * - Settings-type sheets (`changes`): overlay + footer; 「改了 N 项，还没保存」 on the footer's left and closing
 *   asks first.
 * - Comments / attachments (`modal={false}`): no overlay, the table behind can still be clicked and scrolled.
 * - `cards`: grey body for white cards (no white card inside a white sheet).
 * BottomSheet: phones (actions, a recorder, a quick form). `onDone` gives the form header 「取消 · 标题 · 完成」.
 */
import { useState, type ReactNode } from "react";
import { Dialog, type DialogProps, type SheetWidth } from "./forms.tsx";
import { DiscardPrompt } from "./dialog-frame.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/sheets.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/sheets.css";

export type SideSheetProps = Omit<DialogProps, "size" | "placement" | "sheetWidth"> & {
  /** md 480 (default) · lg 640 · xl 800 px; full width at ≤ 760px. */
  width?: SheetWidth;
  /** Unsaved changes (settings sheets): footer says 「改了 N 项，还没保存」 and closing asks first. */
  changes?: number;
  /** Grey body for white cards (settings with several sections). */
  cards?: boolean;
};
/** Right-anchored, full-height dialog. Header / body / footer like Dialog; the body scrolls. */
export function SideSheet({ width = "md", changes = 0, cards, footer, onClose, bodyClassName, ...props }: SideSheetProps) {
  const [asking, setAsking] = useState(false);
  const close = () => (changes > 0 ? setAsking(true) : onClose());
  const bodyClass = [cards ? "aui-sheet-cards" : "", bodyClassName ?? ""].filter(Boolean).join(" ") || undefined;
  const foot: ReactNode =
    footer || changes > 0 ? (
      <>
        {changes > 0 && (
          <div className="aui-dialog-footer-start">
            <span className="aui-note aui-sheet-changes">改了 {changes} 项，还没保存</span>
          </div>
        )}
        {footer}
      </>
    ) : undefined;
  return (
    <>
      <Dialog {...props} onClose={close} footer={foot} bodyClassName={bodyClass} placement="side" sheetWidth={width} />
      <DiscardPrompt
        open={asking}
        title="放弃没保存的改动？"
        description={`改了 ${changes} 项，关闭后不会保存。`}
        keepLabel="继续编辑"
        discardLabel="放弃改动"
        onKeep={() => setAsking(false)}
        onDiscard={() => {
          setAsking(false);
          onClose();
        }}
      />
    </>
  );
}

export type BottomSheetProps = Omit<DialogProps, "size" | "placement" | "sheetWidth"> & {
  /** Form sheet: header becomes 「取消 · 标题 · 完成」 and 完成 calls this. */
  onDone?: () => void;
  doneLabel?: string;
  cancelLabel?: string;
  /** 完成 greyed out (nothing filled yet). */
  doneDisabled?: boolean;
};
/** Bottom-anchored dialog with a grab bar (phones); up to 88% of the screen height, the body scrolls. */
export function BottomSheet({ onDone, doneLabel = "完成", cancelLabel = "取消", doneDisabled, ...props }: BottomSheetProps) {
  const header = onDone
    ? () => (
        <header className="aui-sheet-formhead">
          <span className="aui-sheet-grab" aria-hidden="true" />
          <button type="button" className="aui-sheet-formhead-cancel" onClick={props.onClose}>
            {cancelLabel}
          </button>
          <strong className="aui-sheet-formhead-title">{props.title}</strong>
          <button type="button" className="aui-sheet-formhead-done" disabled={doneDisabled} onClick={onDone}>
            {doneLabel}
          </button>
        </header>
      )
    : props.header;
  return <Dialog {...props} header={header} placement="bottom" />;
}
