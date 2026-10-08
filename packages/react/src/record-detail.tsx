"use client";
/**
 * Record detail standard — one RecordLayout, three levels (see record-detail-core.ts). One field anatomy
 * everywhere: RecordFieldRow (grey label, value, hover tools, in-place editing).
 * - RecordDetailDialog level `peek`: small centered dialog — title + status, key field rows,
 *   「查看完整详情」 + 1–2 actions.
 * - RecordDetailDialog level `expanded`: large centered dialog (or the right drawer) — flat RecordHeader
 *   (avatar, title, status, badges, meta, actions, FactStrip, icon tabs), then `RecordLayout.cards` = the
 *   arranged detail C (stage, key numbers, host blocks, section cards; presets cards /
 *   single / split), or without it the sections as plain field rows with an optional right rail.
 * - RecordPage: the record's own route, full screen: same header and body, `overview` (charts) on top.
 * useRecordDetail wires open state, prev / next over a row list and the optional `?record=` URL.
 */
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Info, Maximize2, Minimize2, TriangleAlert } from "lucide-react";
import { Button, StatusBadge, Tabs } from "./primitives.tsx";
import { Dialog } from "./forms.tsx";
import { tipProps } from "./tooltip.tsx";
import { StatePanel } from "./layout.tsx";
import { RowActions } from "./row-actions.tsx";
import { CellBudgetContext } from "./cell-budget.ts";
import { FactStrip, RecordHeader, recordInitial, type Fact } from "./kit.tsx";
import { RecordEditingProvider, RecordFieldRows, RecordScopeContext, RecordSectionList } from "./record-field-list.tsx";
import { RecordCardsContext, RecordDetailBody, RecordDetailHeaderTools, useRecordCards, type RecordCardsState } from "./record-detail-view.tsx";
import { RecordLayoutBar } from "./record-detail-editor.tsx";
import { RecordFrameBar, type RecordFrame, type RecordFrameNav } from "./record-frame.tsx";
import type { MenuSection } from "./menu.tsx";
import {
  peekRecordFields,
  recordNavDelta,
  recordTabCount,
  recordTabs,
  splitRecordActions,
  type RecordAction,
  type RecordAlert,
  type RecordDetailLevel,
  type RecordHighlight,
  type RecordLayout,
  type RecordSection,
  type RecordSectionContext,
  type RecordTone,
} from "./record-detail-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/record.css";

// ---------------------------------------------------------------- pieces

const factTone = (tone: RecordTone | undefined): Fact["tone"] => (tone === "warning" ? "attention" : tone === "danger" ? "danger" : undefined);
const toFacts = (items: readonly RecordHighlight[]): Fact[] =>
  items.map((item) => ({ key: item.key, label: item.label, value: item.value, hint: item.hint, icon: item.icon, tone: factTone(item.tone) }));

/** Header pieces of a record: avatar (cards: the title's first character by default), badges, tags, meta (or subtitle). */
function headerParts<T>(layout: RecordLayout<T>, row: T, title: string, cards: boolean) {
  const avatar = layout.avatar ? layout.avatar(row) : cards ? recordInitial(title) : undefined;
  return { avatar: avatar ?? undefined, badges: layout.badges?.(row), tags: layout.tags?.(row), meta: layout.meta ? layout.meta(row) : layout.subtitle?.(row) };
}

const NO_TAB_SWITCH: RecordSectionContext = { level: "expanded", setTab: () => undefined };

/** One section as field rows (hover tools, in-place editing); a section with nothing to show renders nothing. */
export function RecordSectionView<T>({ section, row, title, compact, context = NO_TAB_SWITCH }: { section: RecordSection<T>; row: T; title?: string; compact?: boolean; context?: RecordSectionContext }) {
  return <RecordSectionList section={section} row={row} title={title} compact={compact} context={context} />;
}

/** Actions run, then the record dialog closes unless the action says keepOpen. */
const withClose = (actions: readonly RecordAction[], close?: () => void): RecordAction[] =>
  actions.map((action) => (close && !action.keepOpen ? { ...action, onSelect: () => { close(); action.onSelect(); } } : action));

/** Header button of an action: the first plain primary is filled, attention is amber soft, the rest outline. */
function ActionButton({ action, filled, size }: { action: RecordAction; filled: boolean; size?: "sm" }) {
  return (
    <Button size={size} variant={action.destructive ? "destructive" : action.tone === "attention" ? "outline" : filled ? "default" : "outline"}
      className={action.tone === "attention" && !action.destructive ? "aui-button-attention" : undefined}
      disabled={action.disabled} disabledReason={action.disabledReason} onClick={action.onSelect}>
      {action.icon}{action.label}
    </Button>
  );
}
const firstFilled = (buttons: readonly RecordAction[]) => buttons.find((action) => !action.destructive && action.tone !== "attention");

function ActionBar({ actions: given, label, close, size }: { actions: readonly RecordAction[]; label: string; close?: () => void; size?: "sm" }) {
  if (!given.length) return null;
  const actions = withClose(given, close);
  const { buttons, menu } = splitRecordActions(actions);
  const filled = firstFilled(buttons);
  return (
    <>
      {buttons.map((action) => <ActionButton key={action.key} action={action} filled={action === filled} size={size} />)}
      {menu.length > 0 && <RowActions label={`${label}的更多操作`} actions={menu} />}
    </>
  );
}

function Alerts({ items }: { items: readonly RecordAlert[] }) {
  if (!items.length) return null;
  return (
    <div className="aui-record-alerts">
      {items.map((alert) => (
        <div key={alert.key} className="aui-record-alert" data-tone={alert.tone} role={alert.tone === "danger" ? "alert" : "status"}>
          {alert.icon !== null && <span className="aui-record-alert-icon" aria-hidden="true">{alert.icon ?? (alert.tone === "attention" || alert.tone === "danger" ? <TriangleAlert /> : <Info />)}</span>}
          <span><b>{alert.title}</b>{alert.text && <>：{alert.text}</>}</span>
          {alert.action && <Button size="sm" variant="outline" onClick={alert.action.onSelect}>{alert.action.label}</Button>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- body

export type RecordBodyProps<T> = {
  layout: RecordLayout<T>;
  row: T;
  level: RecordDetailLevel;
  close?: () => void;
  /** The tab to show (the tab bar lives in the header); default 「详情」. */
  tab?: string;
  /** Replace the 「详情」 tab content (default: alerts + section cards + rail). */
  details?: ReactNode;
  /** Switch the record's tab (section / tab content links such as 「查看全部操作记录」). */
  onTabChange?: (tab: string) => void;
};

/** The content of the current tab at the expanded / page level: alerts, section cards and the rail; a sections tab keeps the rail. */
export function RecordBody<T>({ layout, row, level, close = () => undefined, tab = "details", details, onTabChange = () => undefined }: RecordBodyProps<T>) {
  const cards = useContext(RecordCardsContext) as RecordCardsState<T> | null;
  const title = layout.title(row);
  const extra = tab !== "details" ? layout.tabs?.find((t) => t.key === tab) : undefined;
  const context: RecordSectionContext = { level, setTab: onTabChange };
  if (extra?.render) return <div className="aui-record-tab">{extra.render(row, { row, level, close, setTab: onTabChange })}</div>;
  if (!extra && details !== undefined) return <div className="aui-record-tab">{details}</div>;
  if (!extra && cards && layout.cards) return <RecordBodyEditing><RecordDetailBody {...cards.body} title={title} before={<Alerts items={layout.alerts?.(row) ?? []} />} /></RecordBodyEditing>;
  const hasAside = Boolean(layout.aside?.length);
  const sections = extra ? extra.sections ?? [] : layout.sections;
  return (
    <RecordBodyEditing>
      <div className="aui-record-layout" data-has-aside={hasAside || undefined} data-display="list">
        <div className="aui-record-main">
          {!extra && <Alerts items={layout.alerts?.(row) ?? []} />}
          {sections.map((section) => <RecordSectionView key={section.key} section={section} row={row} title={title} context={context} />)}
        </div>
        {hasAside ? (
          <aside className="aui-record-aside" aria-label="概要">
            {layout.aside!.map((section) => <RecordSectionView key={section.key} section={section} row={row} title={title} compact context={context} />)}
          </aside>
        ) : null}
      </div>
    </RecordBodyEditing>
  );
}

/** One in-place editor at a time per open record (closes when the dialog moves to another record). */
function RecordBodyEditing({ children }: { children: ReactNode }) {
  return <RecordEditingProvider resetKey={useContext(RecordScopeContext)}>{children}</RecordEditingProvider>;
}

/** The tab bar of a record (in RecordHeader): 「详情」 + layout tabs with icon and count. */
function RecordTabsBar<T>({ layout, row, level, value, onChange, idBase, panelId }: { layout: RecordLayout<T>; row: T; level: RecordDetailLevel; value: string; onChange: (tab: string) => void; idBase: string; panelId: string }) {
  const tabs = recordTabs(layout, level, row);
  if (tabs.length === 1) return null;
  return (
    <Tabs label="记录内容" idBase={idBase} panelId={panelId} value={value} onValueChange={onChange}
      items={tabs.map((t) => {
        if (t.key === "details") return { value: t.key, label: t.label, icon: layout.overview?.icon };
        const def = layout.tabs!.find((x) => x.key === t.key)!;
        const count = recordTabCount(def, row);
        return { value: t.key, label: t.label, icon: def.icon, count: count?.value, countTone: count?.tone };
      })} />
  );
}

// ---------------------------------------------------------------- dialog

export type RecordDialogNav = {
  /** 0-based position of the open record and the list length (「第 3 条，共 120 条」). */
  index: number;
  total: number;
  onMove: (delta: -1 | 1) => void;
  /** The list it walks, shown in the frame bar after the count: 「8 / 13 · 按阶段」. */
  label?: string;
};
export type RecordDetailDialogProps<T> = {
  layout: RecordLayout<T>;
  /** The open record; undefined = closed. */
  row: T | undefined;
  level: Exclude<RecordDetailLevel, "page">;
  onLevelChange?: (level: Exclude<RecordDetailLevel, "page">) => void;
  onClose: () => void;
  nav?: RecordDialogNav;
  /** Replace the 「详情」 content of the expanded level (the default sections stay available to wrap). */
  details?: (row: T) => ReactNode;
  /** Replace the peek body (default: the key fields as tiles). */
  peek?: (row: T) => ReactNode;
  /** Id of the open record (data-record-key on the body, for tests and host styling). */
  recordKey?: string;
  /**
   * Frame of the expanded level: "dialog" (default, centred) or "drawer" — right 640, no overlay,
   * the page behind stays clickable (open another card to switch), ↑ / ↓ previous / next. With `onFrameChange`
   * the title bar offers 抽屉 / 弹框 / 整页 ("page" is the host's route — navigate there).
   */
  frame?: Exclude<RecordFrame, "page">;
  onFrameChange?: (frame: RecordFrame) => void;
  /** Frame bar 「复制链接」 and ⋯ (drawer, or a dialog with `onFrameChange`). */
  onCopyLink?: () => void;
  frameMenu?: readonly MenuSection[];
};

/**
 * Open record as a centered dialog: `peek` (small, key fields, 「查看完整详情」) or `expanded` (the C
 * layout). Esc closes, Alt + ↑ / ↓ or J / K move between records, focus returns to the opener. Full
 * screen on phones.
 */
export function RecordDetailDialog<T>({ layout, row, level, onLevelChange, onClose, nav, details, peek, recordKey, frame = "dialog", onFrameChange, onCopyLink, frameMenu }: RecordDetailDialogProps<T>) {
  const drawer = frame === "drawer" && level !== "peek";
  const framed = drawer || Boolean(onFrameChange);
  const open = row !== undefined;
  const navRef = useRef(nav);
  navRef.current = nav;
  const framedRef = useRef(framed);
  framedRef.current = framed;
  const [wantedTab, setTab] = useState("details");
  const idBase = useId();
  const panelId = `${idBase}panel`;
  useEffect(() => { if (!open) setTab("details"); }, [open]);
  // The next record may not have the open tab (hidden / nothing to show): fall back to the first one.
  const dialogTabs = row !== undefined ? recordTabs(layout, "expanded", row) : [];
  const tab = dialogTabs.some((t) => t.key === wantedTab) ? wantedTab : "details";
  const cards = useRecordCards(layout, row, { level: "expanded", setTab });
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      // Drawer / framed: plain ↑ / ↓ too, when focus sits on the frame itself or its bar (not in the body's text).
      const plain = framedRef.current && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")
        && Boolean(target?.closest(".aui-rframe-bar") || target?.classList.contains("aui-dialog")) ? (event.key === "ArrowUp" ? -1 : 1) : null;
      const delta = plain ?? recordNavDelta(event, target);
      if (delta === null || !navRef.current) return;
      if (event.target instanceof Element && event.target.closest("[data-aui-editing]")) return; // a field is being edited in place
      // J / K only when focus is inside the record dialog (not in a nested menu / editor).
      if (!event.altKey && !(event.target instanceof Element && event.target.closest(".aui-dialog"))) return;
      event.preventDefault();
      const n = navRef.current;
      if ((delta < 0 && n.index > 0) || (delta > 0 && n.index < n.total - 1)) n.onMove(delta);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);
  const title = row !== undefined ? layout.title(row) : "";
  const status = row !== undefined ? layout.status?.(row) : null;
  const actions = row !== undefined ? layout.actions?.(row) ?? [] : [];
  const href = row !== undefined ? layout.href?.(row) : undefined;
  const statusBadge = status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : undefined;
  const pageLink = href ? (
    <a className="aui-icon-btn" href={href} aria-label="在新页面打开" {...tipProps("在新页面打开")}><ExternalLink /></a>
  ) : null;
  if (level === "peek") {
    const fields = row !== undefined ? peekRecordFields(layout, row, undefined, title) : [];
    return (
      <Dialog open={open} size="sm" initialFocus="dialog" title={title} titleAdornment={statusBadge}
        description={row !== undefined ? layout.subtitle?.(row) : undefined}
        headerActions={<>
          {nav && nav.total > 1 && (
            <span className="aui-record-nav" role="group" aria-label="切换记录">
              <span aria-live="polite">{nav.index + 1} / {nav.total}</span>
            </span>
          )}
          {pageLink}
        </>}
        onClose={onClose}
        footer={row !== undefined ? <>
          {onLevelChange && <Button variant="outline" onClick={() => onLevelChange("expanded")}><Maximize2 />查看完整详情</Button>}
          {splitRecordActions(withClose(actions, onClose)).buttons.map((action) => <ActionButton key={action.key} action={action} filled />)}
        </> : undefined}>
        {row !== undefined && (
          <CellBudgetContext.Provider value={null}><RecordScopeContext.Provider value={recordKey}>
            <div className="aui-record-dialog aui-record-peek" data-record-key={recordKey}>
              {peek ? peek(row) : !fields.length ? <p className="aui-note">没有可显示的字段。</p> : (
                <RecordBodyEditing><RecordFieldRows fields={fields} row={row} prefix="peek" /></RecordBodyEditing>
              )}
            </div>
          </RecordScopeContext.Provider></CellBudgetContext.Provider>
        )}
      </Dialog>
    );
  }
  const highlights = row !== undefined ? layout.highlights?.(row) ?? [] : [];
  const display = cards ? "cards" : "list";
  const editingLayout = cards?.editing.editing ? cards.editing : null;
  const frameNav: RecordFrameNav | undefined = nav ? { ...nav } : undefined;
  return (
    <Dialog open={open} size="record" initialFocus="dialog" title={title} bodyClassName="aui-record-dialog-body" onClose={editingLayout ? editingLayout.cancel : onClose}
      placement={drawer ? "side" : undefined} sheetWidth={drawer ? "lg" : undefined} modal={!drawer} className={framed ? `aui-rframe aui-rframe-${frame}` : undefined}
      header={(close) => row !== undefined ? (<>
        {framed && <RecordFrameBar nav={frameNav} frame={frame} onFrameChange={onFrameChange} onCopyLink={onCopyLink ?? (href ? () => void copyHref(href) : undefined)} menu={frameMenu} close={close} />}
        {cards && <RecordLayoutBar editing={cards.editing} />}
        <RecordHeader
          {...headerParts(layout, row, title, Boolean(cards))}
          title={title}
          status={statusBadge}
          crumb={framed ? undefined : layout.crumb}
          nav={framed ? undefined : nav}
          actions={<>
            {cards && <RecordDetailHeaderTools editing={cards.editing} follow={cards.follow} />}
            <ActionBar actions={actions} label={title} close={onClose} size="sm" />
            {!framed && onLevelChange && <IconButton label="缩小为简要视图" className="aui-record-level-toggle" onClick={() => onLevelChange("peek")} icon={<Minimize2 />} />}
            {!framed && pageLink}
            {!framed && close}
          </>}
          facts={<FactStrip items={toFacts(highlights)} />}
          tabs={<RecordTabsBar layout={layout} row={row} level="expanded" value={tab} onChange={setTab} idBase={idBase} panelId={panelId} />}
        />
      </>) : null}>
      {row !== undefined && (
        <CellBudgetContext.Provider value={null}><RecordScopeContext.Provider value={recordKey}><RecordCardsContext.Provider value={cards as RecordCardsState<unknown> | null}>
          <div className="aui-record-dialog aui-record-expanded" data-display={display} data-record-key={recordKey} id={panelId} role={dialogTabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={dialogTabs.length > 1 ? `${idBase}tab-${tab}` : undefined}>
            <RecordBody layout={layout} row={row} level="expanded" close={onClose} tab={tab} details={tab === "details" ? details?.(row) : undefined} onTabChange={setTab} />
          </div>
        </RecordCardsContext.Provider></RecordScopeContext.Provider></CellBudgetContext.Provider>
      )}
    </Dialog>
  );
}

/** Copy a record link (absolute) to the clipboard; quiet when the browser refuses. */
async function copyHref(href: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText(new URL(href, window.location.href).toString());
  } catch {
    // clipboard blocked: nothing to do
  }
}

// ---------------------------------------------------------------- page

export type RecordPageProps<T> = {
  layout: RecordLayout<T>;
  row: T | undefined;
  /** Back to the list: 「← 资产」. */
  back?: { label: string; href?: string; onClick?: () => void };
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Not found (deleted / no permission). */
  notFound?: boolean;
  /** Data visualization above the sections of the 「详情」 tab: KpiGrid, charts, trends. */
  overview?: (row: T) => ReactNode;
  /** Previous / next in the list the user came from (optional). */
  nav?: RecordDialogNav;
  tab?: string;
  onTabChange?: (tab: string) => void;
};

/**
 * Level 3: the record's own page (deep-linkable, full screen). Same RecordHeader as the dialog (with a
 * back link), `overview` (charts) above the section cards, page-only tabs included.
 */
export function RecordPage<T>({ layout, row, back, loading, error, onRetry, notFound, overview, nav, tab: controlledTab, onTabChange }: RecordPageProps<T>) {
  const [ownTab, setOwnTab] = useState("details");
  const idBase = useId();
  const panelId = `${idBase}panel`;
  const setTab = (next: string) => {
    if (controlledTab === undefined) setOwnTab(next);
    onTabChange?.(next);
  };
  const cards = useRecordCards(layout, loading || error || notFound ? undefined : row, { level: "page", setTab });
  const backLink = back ? (
    back.href ? (
      <a className="aui-record-back" href={back.href} onClick={back.onClick ? (event) => { event.preventDefault(); back.onClick!(); } : undefined}><ArrowLeft aria-hidden="true" />{back.label}</a>
    ) : (
      <button type="button" className="aui-record-back" onClick={back.onClick}><ArrowLeft aria-hidden="true" />{back.label}</button>
    )
  ) : null;
  if (loading || error || notFound || row === undefined)
    return (
      <div className="aui-record-page">
        {backLink}
        {loading ? <StatePanel kind="loading" /> : error ? <StatePanel kind="error" message={error} onRetry={onRetry} /> : <StatePanel kind="empty" message="找不到这条记录：它可能已被删除，或你没有查看权限。" />}
      </div>
    );
  const tabs = recordTabs(layout, "page", row);
  const wanted = controlledTab ?? ownTab;
  const tab = tabs.some((t) => t.key === wanted) ? wanted : "details";
  const status = layout.status?.(row);
  const title = layout.title(row);
  const display = cards ? "cards" : "list";
  return (
    <div className="aui-record-page" data-display={display}>
      {backLink}
      <div className="aui-record-page-card">
        {cards && <RecordLayoutBar editing={cards.editing} />}
        <RecordHeader
          {...headerParts(layout, row, title, Boolean(cards))}
          title={title}
          status={status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : undefined}
          crumb={layout.crumb}
          nav={nav}
          actions={<>{cards && <RecordDetailHeaderTools editing={cards.editing} follow={cards.follow} />}<ActionBar actions={layout.actions?.(row) ?? []} label={title} size="sm" /></>}
          facts={<FactStrip items={toFacts(layout.highlights?.(row) ?? [])} />}
          tabs={<RecordTabsBar layout={layout} row={row} level="page" value={tab} onChange={setTab} idBase={idBase} panelId={panelId} />}
        />
        <div className="aui-record-expanded aui-record-page-body" data-display={display} id={panelId} role={tabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={tabs.length > 1 ? `${idBase}tab-${tab}` : undefined}>
          {tab === "details" && overview && <div className="aui-record-overview">{overview(row)}</div>}
          <RecordCardsContext.Provider value={cards as RecordCardsState<unknown> | null}>
            <RecordBody layout={layout} row={row} level="page" tab={tab} onTabChange={setTab} />
          </RecordCardsContext.Provider>
        </div>
      </div>
    </div>
  );
}

export { useRecordDetail, type UseRecordDetailOptions } from "./record-detail-state.tsx";
export { RecordFieldList } from "./record-field-kv.tsx";
