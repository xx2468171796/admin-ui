"use client";
import { useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { HelpTip } from "./help-tip.tsx";
import { sharedContext } from "./context.ts";
import { IconButton } from "./buttons.tsx";
const EmbeddedPageContext = sharedContext<boolean>("embedded-page");
/**
 * Internal (not exported from the root): marks its subtree as a section of a bigger page — TabbedPage
 * wraps each panel in it. Inside, PageHeader drops the big title and renders only description +
 * actions in one row. `embedded={false}` restores standalone headers below it. Hosts use TabbedPage.
 */
export function EmbeddedPage({ children, embedded = true }: { children: ReactNode; embedded?: boolean }) {
  return <EmbeddedPageContext.Provider value={embedded}>{children}</EmbeddedPageContext.Provider>;
}
/** True when rendered inside a TabbedPage panel or an EmbeddedPage: lay out as a section, not a page. */
export function useEmbeddedPage(): boolean {
  return useContext(EmbeddedPageContext) === true;
}
export type PageHeaderProps = {
  title: string;
  actions?: ReactNode;
  /** Page intro: shown only behind a 「?」 at the top right (HelpTip), never as a paragraph. */
  description?: ReactNode;
  sticky?: boolean;
  /**
   * Show the big title. Default false (5.2): the side menu, the work tab and the breadcrumb already
   * name the page, so the title is kept for screen readers only. Set true for pages without that
   * shell chrome (customer portal, standalone tools).
   */
  showTitle?: boolean;
};
/**
 * Page header = top-right actions + a 「?」 with the intro (owner 2026-10-02: no repeated big title,
 * no intro paragraph; the page starts with its buttons). The title stays as the h1 for screen
 * readers. Inside a TabbedPage panel (or EmbeddedPage) it is the group's accessible name instead.
 * Nothing visible at all when there are neither actions nor description.
 */
export function PageHeader(props: PageHeaderProps) {
  const embedded = useEmbeddedPage();
  if (!embedded) return <StandalonePageHeader {...props} />;
  const { title, actions, description } = props;
  if (!description && !actions) return null;
  return (
    <SlottedActions title={title}>
      {(slotted, bar) => slotted ? null : (
        <div className="aui-page-header aui-page-header-embedded" role="group" aria-label={title}>{bar}</div>
      )}
      {actions}
      {description && <HelpTip label={`${title}说明`}>{description}</HelpTip>}
    </SlottedActions>
  );
}
/** Blocks that can open a page or section; the first visible one decides where the page's buttons go. */
const PAGE_BLOCKS = ".aui-panel, .aui-resource, .aui-dash-section, .aui-kpi-grid, .aui-metrics, .aui-inline-alert, .aui-scard, .aui-record-page, .aui-dfilter"; // bt/dashboards: + .aui-dfilter
/**
 * Where the page's buttons go instead of a row of their own: the header row of the first block of
 * the page / section when that block has one (list panel, dashboard section); otherwise the section
 * tab row of the enclosing TabbedPage (e.g. a page that opens with KPI cards); null = stay in place.
 */
function findActionsSlot(anchor: HTMLElement): HTMLElement | null {
  // A header inside a hidden (kept-mounted) section stays put and invisible: never lend its buttons to
  // the visible section or the shared tab row.
  if (anchor.parentElement?.closest("[hidden]")) return null;
  const root =
    anchor.closest<HTMLElement>("[role=tabpanel]") ??
    anchor.closest<HTMLElement>(".aui-tabbed-page") ??
    anchor.closest<HTMLElement>("[id^='aui-page-']") ??
    anchor.closest<HTMLElement>("main");
  if (!root) return null;
  let first: HTMLElement | null = null;
  for (const block of root.querySelectorAll<HTMLElement>(PAGE_BLOCKS)) {
    if (block.closest(".aui-dialog") || block.closest("[hidden]")) continue;
    first = block;
    break;
  }
  const own = first?.querySelector<HTMLElement>(":scope > .aui-panel-header .aui-page-actions-slot, :scope > .aui-dash-section-head .aui-page-actions-slot, :scope > .aui-dfilter-row .aui-page-actions-slot");
  if (own) return own;
  return anchor.closest(".aui-tabbed-page")?.querySelector<HTMLElement>(":scope > .aui-tabbed-tabs-row > .aui-page-actions-slot") ?? null;
}
/**
 * The page's buttons (+ its 「?」) never take a row of their own when a list panel follows: they are
 * portalled into the first visible Panel / ResourcePanel header of the same page or section, next to
 * that panel's own buttons (owner 2026-10-02: 「不要单独占一排……放在下面那一行」). Re-targets when the
 * section tab changes; renders in place when the page has no panel header.
 */
function SlottedActions({ title, children }: { title: string; children: [(slotted: boolean, bar: ReactNode) => ReactNode, ...ReactNode[]] }) {
  const [renderShell, ...items] = children;
  const anchor = useRef<HTMLSpanElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const node = anchor.current;
    if (!node) return;
    const update = () => {
      const next = findActionsSlot(node);
      setSlot((old) => (old === next ? old : next));
    };
    update();
    const root = node.closest(".aui-tabbed-page") ?? node.closest("[id^='aui-page-']") ?? node.parentElement;
    if (!root || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(update);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, []);
  const bar = <div className="aui-header-actions" role="group" aria-label={`${title}操作`}>{items}</div>;
  return (
    <>
      <span ref={anchor} hidden />
      {renderShell(Boolean(slot), bar)}
      {slot && createPortal(bar, slot)}
    </>
  );
}
function StandalonePageHeader({
  title,
  actions,
  description,
  sticky = false,
  showTitle = false,
}: PageHeaderProps) {
  if (!showTitle && !actions && !description) return <h1 className="aui-sr-only">{title}</h1>;
  if (showTitle)
    return (
      <header className="aui-page-header" data-sticky={sticky}>
        <div className="aui-header-text"><h1>{title}</h1></div>
        <div className="aui-header-actions">
          {actions}
          {description && <HelpTip label={`${title}说明`}>{description}</HelpTip>}
        </div>
      </header>
    );
  return (
    <SlottedActions title={title}>
      {(slotted, bar) => slotted ? <h1 className="aui-sr-only">{title}</h1> : (
        <header className="aui-page-header" data-sticky={sticky} data-title-hidden>
          <div className="aui-header-text"><h1 className="aui-sr-only">{title}</h1></div>
          {bar}
        </header>
      )}
      {actions}
      {description && <HelpTip label={`${title}说明`}>{description}</HelpTip>}
    </SlottedActions>
  );
}
/**
 * Vertical stack for a page's sibling blocks (panels, KPI rows, tables) with the standard
 * section gap. Put it after PageHeader; sibling Panels without it touch each other.
 */
export function PageBody({
  children,
  className = "",
  fill = false,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Fill the screen (list pages, T02 / T03 / T09): the work page is at least one viewport tall and the
   * last block (ResourcePanel, SplitLayout main column's last ResourcePanel, a Panel holding a
   * ListDetailLayout) stretches to the bottom - the table area takes the height, the pager sits at the
   * bottom, an empty / loading / error state is centred. Rows never stretch; longer lists scroll the page.
   * Works when PageBody is a direct child of the AdminShell work page (the shell measures its own chrome).
   */
  fill?: boolean;
}) {
  return (
    <div className={`aui-page-body ${className}`.trim()} data-fill={fill || undefined}>
      {children}
    </div>
  );
}
export type DescriptionItem = {
  label: string;
  /** null / undefined render as —; a legitimate 0 or "" is shown as given. */
  value: ReactNode;
  hint?: ReactNode;
  /** Span the whole row (long text, JSON, addresses). */
  full?: boolean;
};
/**
 * Read-only facts for detail views: label 96px in the note colour beside the value
 * (13.5px body colour), 1 / 2 / 3 columns; one column at ≤760px (label 84px). `layout="stacked"` puts
 * the label above the value — narrow cards, the facts under a KPI.
 */
export function DescriptionList({
  items,
  columns = 2,
  layout = "inline",
}: {
  items: readonly DescriptionItem[];
  columns?: 1 | 2 | 3;
  /** inline (default) = label beside the value; stacked = label above (narrow cards). 8.0.2. */
  layout?: "inline" | "stacked";
}) {
  return (
    <dl className="aui-desc" data-columns={columns} data-layout={layout === "stacked" ? "stacked" : undefined}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="aui-desc-item" data-full={item.full || undefined}>
          <dt>{item.label}</dt>
          <dd>
            {item.value === null || item.value === undefined ? "—" : item.value}
            {item.hint && <div className="aui-desc-hint">{item.hint}</div>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  count,
  flush = false,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Grey text right after the title: 「38 台」「近 7 天 1,284 条」, or a LiveStatus (6.0). */
  count?: ReactNode;
  /** No body padding: the content (strip, list rows, table, split body) runs edge to edge (6.0). */
  flush?: boolean;
}) {
  return (
    <section className={`aui-panel ${className}`.trim()} data-flush={flush || undefined}>
      {(title || actions) && (
        <header className="aui-panel-header">
          <div className="aui-header-text">
            <div className="aui-panel-title"><h2>{title}</h2>{count !== undefined && count !== null && <span className="aui-panel-count">{count}</span>}{description && <HelpTip label={`${title ?? ""}说明`}>{description}</HelpTip>}</div>
          </div>
          <div className="aui-header-actions">{actions}<span className="aui-page-actions-slot" /></div>
        </header>
      )}
      {children}
    </section>
  );
}
/** One resource surface: heading/actions, filters, contextual feedback, then table. */
export function ResourcePanel({ title, count, unit, description, actions, filters, feedback, children, loading }: {
  title: string;
  /** Omit when the service does not provide an accurate total. */
  count?: number;
  /** First load: the count reads 「—」 instead of disappearing or claiming 0. */
  loading?: boolean;
  /** With a unit the count reads 「机器 38 台」 (page templates, 6.0) instead of 「机器 (38)」. */
  unit?: string;
  description?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  feedback?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="aui-resource" aria-labelledby={id}>
      <header className="aui-panel-header">
        <div className="aui-header-text">
          <div className="aui-panel-title"><h2 id={id}>{title}{(count !== undefined || loading) && <span className="aui-resource-count">{unit ? ` ${loading || count === undefined ? "—" : count.toLocaleString()} ${unit}` : ` (${loading || count === undefined ? "—" : count.toLocaleString()})`}</span>}</h2>{description && <HelpTip label={`${title}说明`}>{description}</HelpTip>}</div>
        </div>
        <div className="aui-header-actions">{actions}<span className="aui-page-actions-slot" /></div>
      </header>
      {filters && <div className="aui-resource-filters">{filters}</div>}
      {feedback && <div className="aui-resource-feedback">{feedback}</div>}
      {children}
    </section>
  );
}
/**
 * Persistent local feedback: the state of a page / card, not a result of what the user
 * just did (that is a toast). Radius 8, 16px icon, title 600 + the text in the secondary colour. Densities:
 * default (title + text + action) · compact (one line) · subtle (no background, inside forms); `banner` =
 * full width across the top of a page / pane, no radius. Optional × (`onClose`).
 */
export function InlineAlert({ tone = "info", title, children, action, density = "default", banner, onClose }: {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  density?: "default" | "compact" | "subtle";
  banner?: boolean;
  onClose?: () => void;
}) {
  const Icon = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }[tone];
  return (
    <div
      className={`aui-inline-alert aui-inline-alert-${tone}`}
      data-density={density === "default" ? undefined : density}
      data-banner={banner || undefined}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={16} aria-hidden="true" />
      <div className="aui-inline-alert-text"><strong>{title}</strong>{children && <div>{children}</div>}</div>
      {(action || onClose) && (
        <div className="aui-inline-alert-action">
          {action}
          {onClose && (
            <IconButton label="关闭提示" className="aui-inline-alert-close" onClick={onClose} icon={<X />} />
          )}
        </div>
      )}
    </div>
  );
}
export function DetailLayout({
  children,
  aside,
}: {
  children: ReactNode;
  aside: ReactNode;
}) {
  return (
    <div className="aui-detail">
      <div className="aui-stack">{children}</div>
      <aside className="aui-stack">{aside}</aside>
    </div>
  );
}
export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="aui-metrics">{children}</div>;
}
export function MetricCard({
  title,
  value,
  unit,
  note,
  icon: Icon,
}: {
  title: string;
  value: ReactNode | null;
  unit?: string;
  note?: string;
  icon?: LucideIcon;
}) {
  return (
    <Panel>
      <div className="aui-metric-label">
        {title}
        {Icon && <Icon size={18} />}
      </div>
      <strong className="aui-metric-value">
        {value ?? "—"}
        <small>{unit}</small>
      </strong>
      {note && <p className="aui-note">{note}</p>}
    </Panel>
  );
}
export { StatePanel, stateText, type StatePanelProps, type StateKind } from "./state-panel.tsx";
// AdminShell moved to admin-shell.tsx; re-exported here for code that imports it from layout.
export { AdminShell, type AdminShellProps, type NavItem, type WorkspaceItem } from "./admin-shell.tsx";
