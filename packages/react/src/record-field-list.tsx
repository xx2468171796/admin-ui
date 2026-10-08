"use client";
/**
 * Record detail, list display (the default, Feishu-like; RecordLayout.display = "list"):
 * - RecordFieldRow: grey label left (fixed width, wraps), value right in normal weight; the field's
 *   buttons (edit, history / custom actions, call, open, copy) show on row hover / focus only; a
 *   read-only field shows a small lock on hover. Clicking the value (or 「编辑」) edits IN PLACE: the
 *   value cell becomes the host's editor at the row's full width, the value is hidden meanwhile; Esc /
 *   done() puts focus back on the value.
 * - RecordSectionList: a section as a flat region (no card): optional small heading + buttons, one
 *   light line 「10 / 11 已填 · 未填写：客户质量」, then the rows; editable empty fields stay in place.
 * One field edits at a time per record (RecordEditingProvider).
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ExternalLink, Eye, EyeOff, Lock, Pencil, Phone, Plus } from "lucide-react";
import { Button } from "./primitives.tsx";
import { useSensitiveReveal } from "./displays.tsx";
import { CopyButton } from "./copy-button.tsx";
import { FieldTileButton, HiddenFieldsPill } from "./record-extras.tsx";
import {
  arrangeRecordFields,
  isRecordFieldEmpty,
  recordFieldEditState,
  recordFieldText,
  recordFillSummary,
  sectionFields,
  type RecordField,
  type RecordSection,
  type RecordSectionContext,
} from "./record-detail-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

// ---------------------------------------------------------------- editing state

type Editing = { key: string | null; start: (key: string) => void; stop: (key: string) => void };
const RecordEditingContext = /* @__PURE__ */ createContext<Editing | null>(null);

/** One editor at a time inside a record; `resetKey` (the record's key) closes it when the record changes. */
export function RecordEditingProvider({ resetKey, children }: { resetKey: unknown; children: ReactNode }) {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => setKey(null), [resetKey]);
  const start = useCallback((next: string) => setKey(next), []);
  const stop = useCallback((done: string) => setKey((current) => (current === done ? null : current)), []);
  const value = useMemo(() => ({ key, start, stop }), [key, start, stop]);
  return <RecordEditingContext.Provider value={value}>{children}</RecordEditingContext.Provider>;
}

/** Key of the open record (dialog): a revealed value belongs to it; without one the row object is the owner. */
export const RecordScopeContext = /* @__PURE__ */ createContext<string | undefined>(undefined);

/** Clicks on these inside a value (links, attachment thumbnails, buttons) do their own thing, not edit. */
const INTERACTIVE = 'a, button, input, textarea, select, label, [role=button], [role=link], [role=slider], [role=checkbox], [tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------- one row

export function RecordFieldRow<T>({ field, row, editKey }: { field: RecordField<T>; row: T; editKey: string }) {
  const editing = useContext(RecordEditingContext);
  const scope = useContext(RecordScopeContext) ?? row;
  const labelId = useId();
  const [cell, setCell] = useState<HTMLDivElement | null>(null);
  const empty = isRecordFieldEmpty(field, row);
  const reveal = field.reveal && !empty ? field.reveal : undefined;
  const sensitive = useSensitiveReveal({ reveal: reveal ? () => reveal(row) : undefined, remaskAfter: field.remaskAfter, scope });
  const edit = field.edit?.(row) ?? null;
  const state = recordFieldEditState(field, row);
  const active = Boolean(edit?.render && editing?.key === editKey);
  const done = () => {
    const focus = document.activeElement;
    const here = !focus || focus === document.body || Boolean(cell?.contains(focus));
    editing?.stop(editKey);
    if (here) requestAnimationFrame(() => cell?.focus({ preventScroll: true }));
  };
  const start = () => {
    if (!edit || !cell) return;
    if (edit.onActivate) edit.onActivate(cell);
    else editing?.start(editKey);
  };
  const onClick = (event: ReactMouseEvent) => {
    if (state !== "editable" || active) return;
    const target = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    if (target && target !== cell && cell?.contains(target)) return;
    if (typeof window !== "undefined" && window.getSelection()?.toString()) return; // selecting text to copy
    start();
  };
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.target !== cell || active || state !== "editable") return;
    if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      start();
    }
  };
  const text = field.copy && !empty && (!reveal || sensitive.shown) ? sensitive.value ?? recordFieldText(field, row) : null;
  const href = !empty ? field.href?.(row) ?? undefined : undefined;
  const tel = !empty ? field.tel?.(row) : undefined;
  const action = field.action?.(row);
  const buttons = [...(action ? [{ ...action, icon: action.icon ?? (empty ? <Plus aria-hidden="true" /> : <Pencil aria-hidden="true" />) }] : []), ...(field.actions?.(row) ?? [])];
  const tone = field.tone?.(row) ?? undefined;
  const shownValue = empty ? (field.showEmpty ? "未填" : "—") : sensitive.value ?? field.value(row);
  const hint = sensitive.secondsLeft !== null ? <>{field.hint}{field.hint ? " · " : ""}{sensitive.secondsLeft} 秒后隐藏</> : sensitive.error ? <span role="alert">{sensitive.error}</span> : field.hint;
  const tools = (
    <>
      {state === "editable" && <FieldTileButton label={`编辑「${field.label}」`} icon={<Pencil aria-hidden="true" />} onSelect={start} />}
      {buttons.map((b, i) => <FieldTileButton key={`${b.label}#${i}`} label={`${b.label}（${field.label}）`} icon={b.icon ?? <Pencil aria-hidden="true" />} href={b.href} onSelect={b.onSelect} />)}
      {tel && <FieldTileButton label={`拨打${field.label}`} icon={<Phone aria-hidden="true" />} href={`tel:${tel.replace(/[^\d+#*]/g, "")}`} />}
      {href && <a className="aui-icon-button" href={href} target="_blank" rel="noreferrer" aria-label={`打开${field.label}`} data-tip="在新窗口打开"><ExternalLink aria-hidden="true" /></a>}
      {text && <CopyButton text={text} label={field.label} />}
      {state === "locked" && <span className="aui-rfield-lock" role="img" aria-label={`「${field.label}」${field.lockedReason ?? "没有修改权限"}`} data-tip={field.lockedReason ?? "没有修改权限"}><Lock aria-hidden="true" /></span>}
    </>
  );
  const hasTools = state !== "none" || buttons.length > 0 || Boolean(tel || href || text);
  return (
    <div className="aui-rfield" role="listitem" data-field-key={field.key} data-state={state} data-editing={active || undefined} data-tone={tone} data-empty={empty || undefined}>
      <div className="aui-rfield-label" id={labelId} tabIndex={-1} data-tip={field.description || undefined} data-described={field.description ? true : undefined}>
        {field.icon}<span>{field.label}</span>{field.description && <span className="aui-sr-only">（{field.description}）</span>}
      </div>
      <div ref={setCell} className="aui-rfield-value" aria-labelledby={labelId} tabIndex={state === "editable" ? -1 : undefined}
        data-mono={field.mono || undefined} data-link={href ? true : undefined} data-aui-editing={active ? "" : undefined} onClick={onClick} onKeyDown={onKeyDown}>
        {active && edit?.render && cell ? (
          edit.render({ anchor: cell, done, label: field.label })
        ) : (
          <>
            <div className="aui-rfield-text">
              {href ? <a href={href} target="_blank" rel="noreferrer">{shownValue}</a> : shownValue}
              {reveal && (
                <FieldTileButton label={sensitive.shown ? `隐藏${field.label}` : `查看${field.label}（会被记录）`} icon={sensitive.shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  pressed={sensitive.shown} disabled={sensitive.busy} onSelect={() => void sensitive.toggle()} />
              )}
            </div>
            {hint && <div className="aui-rfield-hint">{hint}</div>}
          </>
        )}
      </div>
      {hasTools && !active && <div className="aui-rfield-tools">{tools}</div>}
    </div>
  );
}

/** Rows of fields (one column); `prefix` keeps edit keys unique across sections. */
export function RecordFieldRows<T>({ fields, row, prefix }: { fields: readonly RecordField<T>[]; row: T; prefix: string }) {
  return (
    <div className="aui-rfields" role="list">
      {fields.map((field) => <RecordFieldRow key={field.key} field={field} row={row} editKey={`${prefix}:${field.key}`} />)}
    </div>
  );
}

// ---------------------------------------------------------------- section

/** Start editing a field from the 「未填写」 line: same as clicking its value. */
const openField = (event: ReactMouseEvent, key: string) => {
  const section = (event.currentTarget as Element).closest(".aui-rsection");
  section?.querySelector<HTMLElement>(`[data-field-key="${CSS.escape(key)}"] .aui-rfield-value`)?.click();
};

function FillLine<T>({ fields, row, folded, progress, onFill }: { fields: readonly RecordField<T>[]; row: T; folded: readonly string[]; progress: boolean; onFill?: () => void }) {
  const summary = recordFillSummary(fields, row);
  const empty = progress ? summary.empty : summary.empty.filter((item) => folded.includes(item.label));
  if (!(progress && summary.total) && !empty.length) return null;
  return (
    <p className="aui-rsection-fill">
      {progress && summary.total > 0 && <span className="aui-rsection-count">{summary.filled} / {summary.total} 已填</span>}
      {empty.length > 0 && (
        <span className="aui-rsection-empty">
          未填写：
          {empty.map((item, i) => (
            <span key={item.key}>
              {i > 0 && "、"}
              {item.editable ? <button type="button" className="aui-rsection-empty-link" onClick={(event) => openField(event, item.key)}>{item.label}</button> : item.label}
            </span>
          ))}
        </span>
      )}
      {onFill && empty.length > 0 && <Button size="sm" variant="text" className="aui-rsection-fill-all" onClick={onFill}>补全</Button>}
    </p>
  );
}

/**
 * One section in the list display: a flat region (no card). `compact` = right rail (labels left,
 * values right-aligned, read-only). A section with nothing to show renders nothing.
 */
export function RecordSectionList<T>({ section, row, title, compact, context }: { section: RecordSection<T>; row: T; title?: string; compact?: boolean; context: RecordSectionContext }) {
  const [folded, setFolded] = useState(Boolean(section.collapsible && section.collapsed));
  if (section.block) return <div className="aui-rsection" data-block>{section.block(row, context)}</div>;
  const all = sectionFields(section, row);
  const { shown, empty } = arrangeRecordFields(all, row, { title, keepEmpty: compact ? undefined : (field) => recordFieldEditState(field, row) === "editable" });
  const hidden = section.hiddenFields?.(row) ?? 0;
  if (!shown.length && !empty.length && !section.render && !(hidden > 0)) return null;
  const actions = section.actions?.(row) ?? [];
  const head = section.title || actions.length > 0 || section.collapsible;
  return (
    <section className="aui-rsection" data-compact={compact || undefined} aria-label={section.title}>
      {head && (
        <div className="aui-rsection-head">
          {section.title && <h3>{section.icon}{section.title}</h3>}
          <div className="aui-rsection-tools">
            {actions.map((action) => (
              <Button key={action.key} size="sm" variant={action.destructive ? "destructive" : "ghost"} disabled={action.disabled} disabledReason={action.disabledReason} onClick={action.onSelect}>{action.icon}{action.label}</Button>
            ))}
            {section.collapsible && <Button size="sm" variant="ghost" aria-expanded={!folded} onClick={() => setFolded((v) => !v)}>{folded ? "展开" : "收起"}</Button>}
          </div>
        </div>
      )}
      {!folded && (
        <>
          {!compact && <FillLine fields={all} row={row} folded={empty} progress={Boolean(section.progress)} onFill={section.onFill ? () => section.onFill!(row) : undefined} />}
          {section.description && <p className="aui-note aui-record-section-desc">{section.description}</p>}
          {compact && section.render && <div className="aui-record-free">{section.render(row, context)}</div>}
          {shown.length > 0 && (compact ? <CompactRows fields={shown} row={row} /> : <RecordFieldRows fields={shown} row={row} prefix={section.key} />)}
          {!compact && section.render && <div className="aui-record-free">{section.render(row, context)}</div>}
          {compact && empty.length > 0 && <p className="aui-rsection-fill">未填写：{empty.join("、")}</p>}
          {hidden > 0 && <div className="aui-rsection-hidden"><HiddenFieldsPill count={hidden} hint={section.hiddenHint} /></div>}
        </>
      )}
    </section>
  );
}

/** Right-rail rows: label left, value right; same hover buttons and in-place editing as the main list. */
function CompactRows<T>({ fields, row }: { fields: readonly RecordField<T>[]; row: T }) {
  return (
    <div className="aui-rfields" data-compact role="list">
      {fields.map((field) => <RecordFieldRow key={field.key} field={field} row={row} editKey={`aside:${field.key}`} />)}
    </div>
  );
}
