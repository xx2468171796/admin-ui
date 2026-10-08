"use client";
/**
 * ActivityComposer (mockup C 「跟进」): one compact box to log an activity on a record —
 * small icon chips for the kind (电话 / LINE / 拜访 …, single choice), a short textarea, and ONE bottom
 * row: the host's tools on the left (录音, 附件 as icon buttons), then 「下次跟进」 + a small date picker
 * + 1 / 3 / 7 天 and the submit button right-aligned. Panels the tools open (recorder, drop zone, upload
 * list) go in `panel`, between the text and the bottom row. Phones: the bottom row wraps, submit stays
 * right. Styles: styles/record-cards.css (`.aui-acomposer`).
 */
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button, cn } from "./primitives.tsx";
import { DatePicker } from "./date-picker.tsx";
import { QuickDatePresets } from "./choices.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

export type ActivityKind<V extends string = string> = { value: V; label: string; icon?: LucideIcon };

export type ActivityComposerDue = {
  /** `YYYY-MM-DD` or "". */
  value: string;
  onChange: (value: string) => void;
  /** Label before the picker (default 「下次跟进」). */
  label?: string;
  /** Earliest day (usually today). */
  min?: string;
  /** Quick days after today (default 1 / 3 / 7; [] = none). */
  presets?: readonly number[];
  /** Picker placeholder (default 「选日期」). */
  placeholder?: string;
  /** A due date (default true): 「周四 · 明天」 after the value, today / tomorrow in the attention colour, past in danger. */
  deadline?: boolean;
};

export type ActivityComposerProps<V extends string = string> = {
  /** The text. */
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the text (default 「内容」). */
  label?: string;
  placeholder?: string;
  maxLength?: number;
  /** Kind chips (single choice); leave out for none. */
  kinds?: readonly ActivityKind<V>[];
  kind?: V;
  onKindChange?: (kind: V) => void;
  /** Accessible name of the kind group (default 「方式」). */
  kindLabel?: string;
  /** Icon buttons at the left of the bottom row (录音, 附件): use ActivityComposerTool. */
  tools?: ReactNode;
  /** What the tools open (recorder, drop zone, upload list): between the text and the bottom row. */
  panel?: ReactNode;
  /** 「下次跟进」 date + quick days in the bottom row. */
  due?: ActivityComposerDue;
  submitLabel?: string;
  /** Text on the submit button while saving / blocked (「保存中…」, 「附件上传中…」). */
  submitBusyLabel?: string;
  onSubmit: () => void;
  /** Disables the submit button (saving, uploads pending). */
  busy?: boolean;
  disabled?: boolean;
  /** A line under the box (InlineAlert with the error). */
  footer?: ReactNode;
  className?: string;
};

/** A small icon button for the composer's bottom row (title + aria-label = `label`). */
export function ActivityComposerTool({ label, icon: Icon, onClick, pressed, disabled }: { label: string; icon: LucideIcon; onClick: () => void; pressed?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className="aui-icon-button aui-acomposer-tool" aria-label={label} data-tip={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon aria-hidden="true" />
    </button>
  );
}

function KindChips<V extends string>({ kinds, kind, onKindChange, label, disabled }: { kinds: readonly ActivityKind<V>[]; kind: V | undefined; onKindChange?: (kind: V) => void; label: string; disabled?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = kinds.findIndex((k) => k.value === kind);
  const tabStop = selected >= 0 ? selected : 0;
  const move = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    refs.current[(index + delta + kinds.length) % kinds.length]?.focus();
  };
  return (
    <div className="aui-acomposer-kinds" role="group" aria-label={label}>
      {kinds.map((item, index) => {
        const Icon = item.icon;
        const pressed = item.value === kind;
        return (
          <button key={item.value} ref={(el) => { refs.current[index] = el; }} type="button" className="aui-acomposer-kind" aria-pressed={pressed} disabled={disabled}
            tabIndex={index === tabStop ? 0 : -1} onKeyDown={(event) => move(event, index)} onClick={() => { if (!pressed) onKindChange?.(item.value); }}>
            {Icon && <Icon aria-hidden="true" />}{item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActivityComposer<V extends string = string>({
  value, onChange, label = "内容", placeholder, maxLength, kinds, kind, onKindChange, kindLabel = "方式", tools, panel, due,
  submitLabel = "保存", submitBusyLabel, onSubmit, busy = false, disabled = false, footer, className,
}: ActivityComposerProps<V>) {
  const dueId = useId();
  const dueLabel = due?.label ?? "下次跟进";
  return (
    <div className={cn("aui-acomposer", className)} data-filled={value.trim() ? true : undefined}>
      <div className="aui-acomposer-box">
        {kinds && kinds.length > 0 && <KindChips kinds={kinds} kind={kind} onKindChange={onKindChange} label={kindLabel} disabled={disabled} />}
        <textarea className="aui-acomposer-text" aria-label={label} placeholder={placeholder} maxLength={maxLength} rows={2} value={value} disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !busy && !disabled) { event.preventDefault(); onSubmit(); } }} />
        {panel && <div className="aui-acomposer-panel">{panel}</div>}
        <div className="aui-acomposer-foot">
          {tools && <div className="aui-acomposer-tools">{tools}</div>}
          <span className="aui-acomposer-grow" />
          {due && (
            <div className="aui-acomposer-due" role="group" aria-labelledby={dueId}>
              <span id={dueId} className="aui-acomposer-due-label">{dueLabel}</span>
              <DatePicker size="sm" className="aui-acomposer-date" aria-label={dueLabel} placeholder={due.placeholder ?? "选日期"} clearable deadline={due.deadline ?? true} min={due.min} value={due.value} onChange={due.onChange} disabled={disabled} />
              {(due.presets ?? [1, 3, 7]).length > 0 && <QuickDatePresets type="date" days={due.presets ?? [1, 3, 7]} label={`${dueLabel}：快捷日期`} disabled={disabled} onPick={(day) => due.onChange(day)} />}
            </div>
          )}
          <Button size="sm" className="aui-acomposer-submit" disabled={busy || disabled} onClick={onSubmit}>{busy && submitBusyLabel ? submitBusyLabel : submitLabel}</Button>
        </div>
      </div>
      {footer}
    </div>
  );
}
