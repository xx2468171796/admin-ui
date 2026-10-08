"use client";
/**
 * Edit conflicts. Default = keep the other person's newer value; the user's input is
 * never lost: 「重新填入我的」 puts it back into the editor, 「用我的覆盖」 saves it over theirs on purpose.
 *
 * - EditConflictNotice: one cell / field collided while editing in place — a small card 「王小明 刚改过这一格 ·
 *   14:31」 with both values side by side (BitableGrid shows it in its status line by itself).
 * - SaveConflictDialog: several fields saved at once (record detail) — per field two choice cards (theirs,
 *   newer, selected by default / mine) and 「已经替你合好 N 项」.
 * - StaleRecordNotice: someone changed the record while it was open — one info bar with 「刷新」.
 * The undo / time-machine flavour stays in ConflictChooser.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Check, Info, RefreshCw, X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { Dialog } from "./forms.tsx";
import { Avatar } from "./avatar.tsx";
import { conflictCounts, conflictHeadline, pickOf, type ConflictPick } from "./edit-conflict-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conflict.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conflict.css";

export type EditConflictNoticeProps = {
  /** Who saved first. */
  by: string;
  /** When (「14:31」). */
  at?: string;
  /** Their (kept) value, as displayed. */
  theirs: ReactNode;
  /** What this user had typed. */
  mine: ReactNode;
  /** Put my value back into the editor to keep editing. */
  onRefill?: () => void;
  /** Save mine over theirs. */
  onOverwrite?: () => void | Promise<void>;
  /** Keep theirs and close. */
  onDismiss?: () => void;
  /** 「这一格」 (default) / 「客户名称」. */
  what?: string;
  /** One-line form for status bars. */
  compact?: boolean;
};
export function EditConflictNotice({ by, at, theirs, mine, onRefill, onOverwrite, onDismiss, what = "这一格", compact }: EditConflictNoticeProps) {
  const [busy, setBusy] = useState(false);
  const overwrite = async () => {
    if (!onOverwrite || busy) return;
    setBusy(true);
    try {
      await onOverwrite();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="aui-conflict-notice" data-compact={compact || undefined} role="alert">
      <div className="aui-conflict-notice-head">
        <Avatar name={by} size={20} />
        <strong>{conflictHeadline(by, at, what)}</strong>
        {onDismiss && (
          <IconButton label="保留他的，关闭" className="aui-conflict-notice-close" onClick={onDismiss} icon={<X />} />
        )}
      </div>
      <div className="aui-conflict-notice-values">
        <div data-side="theirs">
          <small>
            <Check aria-hidden="true" />
            {by}的（较新，已保留）
          </small>
          <span>{theirs}</span>
        </div>
        <div data-side="mine">
          <small>我刚填的</small>
          <span>{mine}</span>
        </div>
      </div>
      {(onRefill || onOverwrite) && (
        <div className="aui-conflict-notice-actions">
          {onRefill && (
            <Button size="sm" variant="ghost" onClick={onRefill}>
              重新填入我的
            </Button>
          )}
          {onOverwrite && (
            <Button size="sm" variant="outline" loading={busy} onClick={() => void overwrite()}>
              用我的覆盖
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export type FieldConflict = {
  key: string;
  field: ReactNode;
  theirs: ReactNode;
  mine: ReactNode;
  /** Who / when for their value. */
  by?: string;
  at?: string;
};
export type SaveConflictDialogProps = {
  open: boolean;
  rows: readonly FieldConflict[];
  /** Fields merged automatically (no one else touched them): 「已经替你合好 N 项」. */
  merged?: number;
  /** Save with the picks (field key → theirs / mine). Reject to keep the dialog with the message. */
  onSave: (picks: Record<string, ConflictPick>) => void | Promise<void>;
  onClose: () => void;
  title?: string;
};
export function SaveConflictDialog({ open, rows, merged = 0, onSave, onClose, title = "保存时有冲突" }: SaveConflictDialogProps) {
  const [picks, setPicks] = useState<Record<string, ConflictPick>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setPicks({});
      setError("");
    }
  }, [open]);
  const counts = conflictCounts(rows, picks);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(Object.fromEntries(rows.map((row) => [row.key, pickOf(row.key, picks)])));
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      size="md"
      title={title}
      description={`有 ${rows.length} 项别人刚改过，默认保留他们较新的；要覆盖就点「用我的」。`}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <div className="aui-dialog-footer-start">
            <span className="aui-note">
              保留他的 {counts.theirs} 项{counts.mine ? ` · 用我的 ${counts.mine} 项` : ""}
            </span>
          </div>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            保存
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="aui-error aui-dialog-alert">
          {error}
        </p>
      )}
      <div className="aui-conflict-fields">
        {rows.map((row) => {
          const pick = pickOf(row.key, picks);
          const choose = (next: ConflictPick) => setPicks((old) => ({ ...old, [row.key]: next }));
          return (
            <fieldset key={row.key} className="aui-conflict-field">
              <legend>{row.field}</legend>
              <div className="aui-conflict-picks" role="radiogroup" aria-label={typeof row.field === "string" ? row.field : row.key}>
                <PickCard checked={pick === "theirs"} onSelect={() => choose("theirs")} label={`${row.by ?? "别人"}的（较新）${row.at ? ` · ${row.at}` : ""}`} value={row.theirs} />
                <PickCard checked={pick === "mine"} onSelect={() => choose("mine")} label="用我的" value={row.mine} />
              </div>
            </fieldset>
          );
        })}
      </div>
      {merged > 0 && (
        <p className="aui-conflict-merged">
          <Check aria-hidden="true" />
          已经替你合好 {merged} 项（只有你改了的）
        </p>
      )}
    </Dialog>
  );
}

function PickCard({ checked, onSelect, label, value }: { checked: boolean; onSelect: () => void; label: string; value: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="aui-conflict-pick" data-checked={checked || undefined} onClick={onSelect}>
      <span className="aui-radio" aria-checked={checked} aria-hidden="true" />
      <span className="aui-conflict-pick-text">
        <small>{label}</small>
        <span>{value}</span>
      </span>
    </button>
  );
}

export type StaleRecordNoticeProps = { by: string; at?: string; onRefresh: () => void; onDismiss?: () => void; what?: string };
/** 「王小明 刚改过这条记录 · 14:31 · 刷新」 — shown on top of an open record when it changed underneath. */
export function StaleRecordNotice({ by, at, onRefresh, onDismiss, what = "这条记录" }: StaleRecordNoticeProps) {
  return (
    <div className="aui-stale-notice" role="status">
      <Info aria-hidden="true" />
      <span className="aui-stale-notice-text">{conflictHeadline(by, at, what)}</span>
      <Button size="sm" variant="ghost" onClick={onRefresh}>
        <RefreshCw aria-hidden="true" />
        刷新
      </Button>
      {onDismiss && (
        <IconButton label="关闭提示" onClick={onDismiss} icon={<X />} />
      )}
    </div>
  );
}
