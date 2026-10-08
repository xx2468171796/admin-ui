"use client";
/**
 * SettingsSheet: the 「表设置」-type drawer. 880px from the right; header 「表设置 · 智能家居客户」
 * + ×; a 184px section list on the left (small group titles · icon + name · grey count · amber dot = unsaved ·
 * red 「!」 = invalid) and ONE section on the right at a time (no long column of cards); the bottom row is the
 * the shared save bar (「改了 N 处」 · 取消 · 保存). Closing with unsaved changes asks first. Phones: full screen, the
 * sections become a sticky row of pills on top.
 */
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Dialog } from "./forms.tsx";
import { DiscardPrompt } from "./dialog-frame.tsx";
import { SaveBar } from "./page-templates.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";

export type SettingsSheetSection = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Small grey title above this row when it differs from the previous one (「表格」「业务线 · CRM」「高级」). */
  group?: string;
  /** Grey number on the right (「字段 24」). */
  count?: number | string;
  /** Unsaved changes here (amber dot). */
  dirty?: boolean;
  /** Something invalid here (red 「!」; a string is the reason). */
  error?: boolean | string;
  /** Heading above the content (default `label`). */
  title?: ReactNode;
  /** Grey text after the heading (「智能家居」). */
  hint?: ReactNode;
  /** The section body (FormSection / fields / lists). Mounted when first opened, then kept (hidden) so unsaved edits survive switching. */
  content: ReactNode;
};
export type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 「表设置」 */
  title: string;
  /** Grey after the title (「智能家居客户」). */
  subtitle?: ReactNode;
  sections: readonly SettingsSheetSection[];
  /** Current section (controlled); without it the sheet keeps its own (starts at the first). */
  value?: string;
  onValueChange?: (id: string) => void;
  /** Unsaved changes across the sheet: 「改了 N 处」 + 保存 enabled; closing asks first. */
  changes?: number;
  /** Which fields (「每人认领上限 · 币种」). */
  summary?: ReactNode;
  /** Fields with an invalid value. */
  errors?: number;
  /** Save everything; a rejection keeps the sheet open and shows the message. Without it there is no save bar. */
  onSave?: () => void | Promise<void>;
  /** Throw the edits away (called before closing on 取消 / confirmed ×). */
  onDiscard?: () => void;
  saveLabel?: string;
  /** Footer when there is nothing to save (read-only sheets). */
  footer?: ReactNode;
  /** Accessible name of the section list (default 「分节」). */
  navLabel?: string;
};

/** See the module comment. */
export function SettingsSheet({ open, onClose, title, subtitle, sections, value, onValueChange, changes = 0, summary, errors = 0, onSave, onDiscard, saveLabel = "保存", footer, navLabel = "分节" }: SettingsSheetProps) {
  const base = useId();
  const [own, setOwn] = useState(sections[0]?.id ?? "");
  const currentId = value ?? own;
  const current = sections.find((s) => s.id === currentId) ?? sections[0];
  const [asking, setAsking] = useState(false);
  // Visited sections stay mounted (hidden): a section's draft lives in its own state, switching must not drop it.
  const [visited, setVisited] = useState<readonly string[]>([]);
  const shownId = current?.id;
  useEffect(() => {
    if (shownId) setVisited((list) => (list.includes(shownId) ? list : [...list, shownId]));
  }, [shownId]);
  useEffect(() => {
    if (!open) setVisited([]);
  }, [open]);
  const pick = (id: string) => {
    if (value === undefined) setOwn(id);
    onValueChange?.(id);
  };
  const discardAndClose = () => {
    onDiscard?.();
    onClose();
  };
  const requestClose = () => (changes > 0 ? setAsking(true) : onClose());
  const bar = onSave ? (
    <SaveBar placement="footer" count={changes} errors={errors} summary={summary} saveLabel={saveLabel} onDiscard={requestClose} onSave={onSave} />
  ) : footer;
  return (
    <>
      <Dialog open={open} title={title} description={subtitle} onClose={requestClose} placement="side" sheetWidth="xl" className="aui-settings-sheet" bodyClassName="aui-settings-sheet-body" footer={bar}>
        <nav className="aui-settings-nav" aria-label={navLabel}>
          {sections.map((s, i) => (
            <Fragment key={s.id}>
              {s.group && s.group !== sections[i - 1]?.group && <div className="aui-settings-nav-group" aria-hidden="true">{s.group}</div>}
              <button type="button" className="aui-settings-nav-item" aria-current={s.id === current?.id ? "true" : undefined} aria-controls={`${base}-panel`} onClick={() => pick(s.id)}>
                {s.icon}
                <span className="aui-settings-nav-label">{s.label}</span>
                {s.count !== undefined && s.count !== "" && <span className="aui-settings-nav-count">{s.count}</span>}
                {s.error ? (
                  <CircleAlert className="aui-settings-nav-error" role="img" aria-label={typeof s.error === "string" ? s.error : "有填写错误"} />
                ) : (
                  s.dirty && <span className="aui-settings-nav-dot" role="img" aria-label="有未保存的改动" />
                )}
              </button>
            </Fragment>
          ))}
        </nav>
        {sections
          .filter((s) => s.id === current?.id || visited.includes(s.id))
          .map((s) => (
            <section key={s.id} id={s.id === current?.id ? `${base}-panel` : undefined} className="aui-settings-panel" aria-label={s.label} hidden={s.id !== current?.id || undefined}>
              <header className="aui-settings-panel-head">
                <h3>{s.title ?? s.label}</h3>
                {s.hint && <span>{s.hint}</span>}
              </header>
              <div className="aui-settings-panel-body">{s.content}</div>
            </section>
          ))}
      </Dialog>
      <DiscardPrompt
        open={asking}
        title="放弃没保存的改动？"
        description={`改了 ${changes} 处，关闭后不会保存。`}
        keepLabel="继续编辑"
        discardLabel="放弃改动"
        onKeep={() => setAsking(false)}
        onDiscard={() => {
          setAsking(false);
          discardAndClose();
        }}
      />
    </>
  );
}
