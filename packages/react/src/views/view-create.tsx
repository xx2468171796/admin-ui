"use client";
/**
 * 「新建视图」 panel (review 08 item 1): six kind cards (icon + what it is for), the name and who
 * the view is for (「只有我 / 共享给一组」, only when the host offers sharing), then 取消 · 建好. ViewTabs opens it
 * from 「+」 in a PopoverPanel; hosts can also put it in their own popover / sheet.
 */
import { useId, useState, type ReactNode } from "react";
import { Button, Input } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { newViewName, VIEW_AUDIENCE_LABELS, VIEW_KIND_HINTS, VIEW_KIND_LABELS, VIEW_KINDS, type NewViewDraft, type ViewAudience, type ViewKind } from "./view-core.ts";
import { ViewKindIcon } from "./view-parts.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type NewViewPanelProps = {
  /** Kinds offered (default all six), in this order. */
  kinds?: readonly ViewKind[];
  /** Names already used (the default name becomes 「看板 2」 when 「看板」 exists). */
  existingNames?: readonly string[];
  /** Audiences offered; the 「只有我 / 共享给一组」 switch only shows with more than one (default only 「只有我」). */
  audiences?: readonly ViewAudience[];
  /** Kind selected first (default the first offered). */
  initialKind?: ViewKind;
  /** Ask for a name (default true); false = the cards only (hosts on the old `onCreate(kind)`). */
  nameable?: boolean;
  /** One line left of the buttons, e.g. 「建好后从当前视图带上筛选和排序」. */
  note?: ReactNode;
  onCreate: (draft: NewViewDraft) => void | Promise<void>;
  onCancel: () => void;
};

/** See the module comment. */
export function NewViewPanel({ kinds = VIEW_KINDS, existingNames = [], audiences = ["mine"], initialKind, nameable = true, note, onCreate, onCancel }: NewViewPanelProps) {
  const first = initialKind && kinds.includes(initialKind) ? initialKind : (kinds[0] ?? "grid");
  const [kind, setKind] = useState<ViewKind>(first);
  const [name, setName] = useState(() => newViewName(first, existingNames));
  const [typed, setTyped] = useState(false);
  const [audience, setAudience] = useState<ViewAudience>(audiences[0] ?? "mine");
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const pick = (next: ViewKind) => {
    setKind(next);
    if (!typed) setName(newViewName(next, existingNames));
  };
  const submit = async () => {
    const trimmed = name.trim() || newViewName(kind, existingNames);
    setBusy(true);
    try {
      await onCreate({ kind, name: trimmed, audience });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="aui-vnew"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="aui-vnew-kinds" role="radiogroup" aria-label="视图类型">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === kind}
            className="aui-vnew-kind"
            data-autofocus={k === kind ? "" : undefined}
            tabIndex={k === kind ? 0 : -1}
            onClick={() => pick(k)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const next = kinds[(kinds.indexOf(k) + step + kinds.length) % kinds.length];
              if (!next) return;
              pick(next);
              (event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-kind="${next}"]`) ?? null)?.focus();
            }}
            data-kind={k}
          >
            <span className="aui-vnew-icon" aria-hidden="true">
              <ViewKindIcon kind={k} size={16} />
            </span>
            <strong>{VIEW_KIND_LABELS[k]}</strong>
            <small>{VIEW_KIND_HINTS[k]}</small>
          </button>
        ))}
      </div>
      {nameable && (
        <div className="aui-vnew-row">
          <label className="aui-sr-only" htmlFor={nameId}>
            视图名称
          </label>
          <Input
            id={nameId}
            value={name}
            maxLength={40}
            placeholder="视图名称"
            onChange={(event) => {
              setTyped(true);
              setName(event.target.value);
            }}
          />
          {audiences.length > 1 && (
            <SegmentedControl<ViewAudience> label="给谁看" size="sm" value={audience} options={audiences.map((a) => ({ value: a, label: VIEW_AUDIENCE_LABELS[a] }))} onValueChange={setAudience} />
          )}
        </div>
      )}
      <div className="aui-vnew-foot">
        {note && <span className="aui-note">{note}</span>}
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          建好
        </Button>
      </div>
    </form>
  );
}
