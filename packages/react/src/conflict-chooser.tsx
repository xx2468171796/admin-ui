"use client";
/**
 * Conflict chooser for undo / rollback (D23 operation log, D24 time machine): some cells changed by
 * the batch (or after the target time) were edited again by someone else. One default for all of
 * them — 「保留别人后来的修改」 (keep) or 「一起退回」 (revert) — plus a per-cell keep / revert toggle.
 * The value is a `ConflictDecisions` (history-core.ts); the host sends it with the undo / restore call
 * and the server applies it (it re-checks every cell).
 *
 * ConflictModePicker = the two radio cards; ConflictToggle = one cell's 保留 / 退回;
 * ConflictChooser = warning header + picker + the conflict table (record · field · then · now · by).
 * Styles: styles/history.css (.aui-conflict-*).
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { SegmentedControl } from "./choices.tsx";
import { conflictChoice, conflictTally, setConflictChoice, setConflictMode, type ConflictChoice, type ConflictDecisions } from "./history-core.ts";
import { avatarTone } from "./avatar-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";

export type ConflictRow = {
  key: string;
  /** 「黄淑芬」 — the record the cell belongs to. */
  record: ReactNode;
  field: ReactNode;
  /** The value the undo / rollback would put back. */
  then: ReactNode;
  /** The value now (someone else's later edit). */
  now: ReactNode;
  /** Who made the later edit, and when (「小李」「10-05 15:05」). */
  by?: string;
  at?: ReactNode;
  /** Avatar letter / image text for `by` (default its first character). */
  avatar?: string;
};

export type ConflictModePickerProps = {
  value: ConflictChoice;
  onChange: (mode: ConflictChoice) => void;
  /** Accessible name of the radio group (default 「冲突怎么处理」). */
  label?: string;
  keepLabel?: string;
  /** Grey hint after the keep label: 「只退这 5 条以外的」. */
  keepHint?: ReactNode;
  revertLabel?: string;
  disabled?: boolean;
};
/** Two radio cards: keep other people's later edits (default) / revert them too. Arrow keys move. */
export function ConflictModePicker({ value, onChange, label = "冲突怎么处理", keepLabel = "保留别人后来的修改", keepHint, revertLabel = "一起退回", disabled }: ConflictModePickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const options: { value: ConflictChoice; label: string; hint?: ReactNode }[] = [
    { value: "keep", label: keepLabel, hint: keepHint },
    { value: "revert", label: revertLabel },
  ];
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next]!.value);
  };
  return (
    <div className="aui-conflict-modes" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          className="aui-conflict-mode"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          <span className="aui-conflict-radio" aria-hidden="true" />
          <span>{o.label}</span>
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

/** One conflicting cell: 保留 (keep the later edit) / 退回 (put the old value back). */
export function ConflictToggle({ value, onChange, label, disabled }: { value: ConflictChoice; onChange: (choice: ConflictChoice) => void; label: string; disabled?: boolean }) {
  return (
    <SegmentedControl
      size="sm"
      label={label}
      value={value}
      disabled={disabled}
      className="aui-conflict-toggle"
      onValueChange={onChange}
      options={[
        { value: "keep", label: "保留" },
        { value: "revert", label: "退回" },
      ]}
    />
  );
}

export type ConflictChooserProps = {
  rows: readonly ConflictRow[];
  value: ConflictDecisions;
  onChange: (value: ConflictDecisions) => void;
  /** The bold sentence: 「其中 5 条在 10-04 09:00 之后被别人改过」 (default from the row count). */
  title?: ReactNode;
  /** Column heading of the value that would come back: 「10-04 09:00 时」 / 「改前」. */
  thenLabel?: string;
  nowLabel?: string;
  byLabel?: string;
  /** Per-cell 保留 / 退回 toggles (default true); false = only the one rule for all. */
  perRow?: boolean;
  /** Table caption for screen readers. */
  caption?: string;
  disabled?: boolean;
};
/** Warning header with the keep / revert rule, then one row per conflicting cell. Renders nothing without rows. */
export function ConflictChooser({ rows, value, onChange, title, thenLabel = "改前", nowLabel = "现在", byLabel = "谁改的", perRow = true, caption = "有冲突的格子", disabled }: ConflictChooserProps) {
  if (!rows.length) return null;
  const tally = conflictTally(rows.map((r) => r.key), value);
  const hint = value.mode === "keep" ? `只退这 ${rows.length} 条以外的` : undefined;
  return (
    <section className="aui-conflict" aria-label={caption}>
      <div className="aui-conflict-head">
        <TriangleAlert aria-hidden="true" />
        <span className="aui-conflict-title">
          <b>{title ?? `其中 ${rows.length} 条之后被别人改过`}</b>，怎么处理？
        </span>
        <ConflictModePicker value={value.mode} keepHint={hint} disabled={disabled} onChange={(mode) => onChange(setConflictMode(mode))} />
      </div>
      <div className="aui-conflict-scroll">
        <table className="aui-conflict-table">
          <caption className="aui-sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">记录</th>
              <th scope="col">字段</th>
              <th scope="col">{thenLabel}</th>
              <th scope="col">{nowLabel}</th>
              <th scope="col">{byLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const choice = conflictChoice(r.key, value);
              return (
                <tr key={r.key} data-choice={choice}>
                  <th scope="row" className="aui-conflict-record">{r.record}</th>
                  <td className="aui-conflict-fieldname">{r.field}</td>
                  <td className="aui-conflict-then" data-label={thenLabel}>{r.then}</td>
                  <td className="aui-conflict-now" data-label={nowLabel}>
                    <span className="aui-conflict-now-value">{r.now}</span>
                    {perRow ? (
                      <ConflictToggle label={`${typeof r.record === "string" ? r.record : "这一格"}：保留还是退回`} value={choice} disabled={disabled} onChange={(c) => onChange(setConflictChoice(value, r.key, c))} />
                    ) : (
                      <span className="aui-conflict-tag" data-choice={choice}>{choice === "keep" ? "保留" : "退回"}</span>
                    )}
                  </td>
                  <td className="aui-conflict-by">
                    {r.by && (
                      <>
                        <span className="aui-avatar" data-size="20" data-tone={avatarTone(r.by)} aria-hidden="true">{r.avatar ?? r.by.slice(0, 1)}</span>
                        <span>{r.by}{r.at ? <> · {r.at}</> : null}</span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="aui-sr-only" role="status">保留 {tally.keep} 条，退回 {tally.revert} 条</p>
    </section>
  );
}
