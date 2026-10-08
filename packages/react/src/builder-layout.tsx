"use client";
/**
 * BuilderLayout (bt/templates, page template T17 看板搭建器, demo D32): the frame of an editor that
 * builds something out of blocks — dashboards first (DashboardBuilder slots into the canvas), later
 * forms or reports. Top bar: icon + name (click ✎ to rename) · badges (「我的看板」「编辑中」) · a scope
 * note (「你只能看到你有权限的数据」) · undo / redo · host actions (预览、取消、保存); an optional filter
 * row; then three panes that never scroll the page: widget library (left 232) | canvas (scrolls) |
 * settings of the selected block (right 324, closable). Narrow screens stack the panes.
 * Only the frame: blocks, drag and drop, and saving belong to the host / the builder component.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Pencil, Redo2, Undo2, X } from "lucide-react";
import { Input } from "./primitives.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";

export type BuilderHistory = { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };
export type BuilderLayoutProps = {
  /** What is being built (「一组周会看板」). */
  title: string;
  /** Rename in place: shows ✎ next to the name. Reject to keep editing (the reason is shown). */
  onTitleChange?: (title: string) => void | Promise<void>;
  icon?: ReactNode;
  /** Small tags after the name (「我的看板」、编辑中). */
  badges?: ReactNode;
  /** One-line scope note in the top bar (InfoPill-like, e.g. data the viewer can see). */
  notice?: ReactNode;
  /** Undo / redo buttons (Ctrl+Z / Ctrl+Shift+Z are the host's). */
  history?: BuilderHistory;
  /** Right end of the top bar: 预览、取消、保存 (one primary). */
  actions?: ReactNode;
  /** A row under the top bar (dashboard filters: 时间、对比、组、人 …). */
  filters?: ReactNode;
  /** Left pane: what can be added (search, groups, draggable items). */
  library?: ReactNode;
  libraryLabel?: string;
  /** Right pane: settings of the selected block; omit / null when nothing is selected. */
  config?: ReactNode;
  configLabel?: string;
  /** The canvas. */
  children: ReactNode;
  /** Accessible name of the canvas (default 「画布」). */
  canvasLabel?: string;
};

function BuilderTitle({ title, icon, onTitleChange }: Pick<BuilderLayoutProps, "title" | "icon" | "onTitleChange">) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (draft !== null) input.current?.select();
  }, [draft !== null]);
  const save = async () => {
    if (draft === null) return;
    const next = draft.trim();
    if (!next) return setError("名字不能为空");
    if (next === title || !onTitleChange) return setDraft(null);
    setBusy(true);
    try {
      await onTitleChange(next);
      setDraft(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  if (draft !== null)
    return (
      <span className="aui-builder-title" data-editing="">
        {icon}
        <Input ref={input} aria-label="名字" value={draft} maxLength={60} aria-invalid={error ? true : undefined} disabled={busy}
          onChange={(e) => { setDraft(e.target.value); setError(""); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") { setDraft(null); setError(""); }
          }} />
        <IconButton label="保存名字" disabled={busy} onClick={() => void save()} icon={<Check />} />
        <IconButton label="取消改名" disabled={busy} onClick={() => { setDraft(null); setError(""); }} icon={<X />} />
        {error && <small className="aui-builder-title-error" role="alert">{error}</small>}
      </span>
    );
  return (
    <span className="aui-builder-title">
      {icon}
      <h1 data-tip={title}>{title}</h1>
      {onTitleChange && <IconButton label="改名字" onClick={() => setDraft(title)} icon={<Pencil />} />}
    </span>
  );
}

/** See the module comment. */
export function BuilderLayout({ title, onTitleChange, icon, badges, notice, history, actions, filters, library, libraryLabel = "组件库", config, configLabel = "组件设置", children, canvasLabel = "画布" }: BuilderLayoutProps) {
  return (
    <div className="aui-builder" data-config={config ? "" : undefined} data-library={library ? "" : undefined}>
      <header className="aui-builder-top">
        <BuilderTitle title={title} icon={icon} onTitleChange={onTitleChange} />
        {badges && <span className="aui-builder-badges">{badges}</span>}
        {notice && <span className="aui-builder-notice">{notice}</span>}
        <div className="aui-builder-actions">
          {history && (
            <span className="aui-builder-history" role="group" aria-label="撤销与重做">
              <IconButton label="撤销" tooltip="撤销（Ctrl+Z）" variant="outline" disabled={!history.canUndo} onClick={history.onUndo} icon={<Undo2 />} />
              <IconButton label="重做" tooltip="重做（Ctrl+Shift+Z）" variant="outline" disabled={!history.canRedo} onClick={history.onRedo} icon={<Redo2 />} />
            </span>
          )}
          {actions}
        </div>
      </header>
      {filters && <div className="aui-builder-filters">{filters}</div>}
      <div className="aui-builder-body">
        {library && <aside className="aui-builder-library" aria-label={libraryLabel}>{library}</aside>}
        <section className="aui-builder-canvas" aria-label={canvasLabel}>{children}</section>
        {config && <aside className="aui-builder-config" aria-label={configLabel}>{config}</aside>}
      </div>
    </div>
  );
}
