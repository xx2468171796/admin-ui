"use client";
import { Component, useEffect, useId, useState, type ErrorInfo, type ReactNode } from "react";
import { Tabs } from "./primitives.tsx";
import { EmbeddedPage, PageHeader, StatePanel } from "./layout.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";

export type PanelErrorBoundaryProps = {
  children: ReactNode;
  /** Called after「重试」clears the error, before children render again (reset the state that crashed). */
  onReset?: () => void;
  /** Report to the host's logging; the SDK only writes console.error. */
  onError?: (error: Error, info: ErrorInfo) => void;
};
/**
 * A render error breaks only this block: it shows the message and「重试」, while the menu, other
 * tabs and sections keep working. Without a boundary React unmounts the whole tree (white screen).
 */
export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("adminUI: 区块渲染出错", error);
    this.props.onError?.(error, info);
  }
  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <StatePanel
        kind="error"
        message={`这一块出错了：${error.message || String(error)}。点「重试」重新加载；一直这样请把这句话发给管理员。`}
        onRetry={() => {
          this.props.onReset?.();
          this.setState({ error: null });
        }}
      />
    );
  }
}

export type TabbedPageSection = {
  id: string;
  label: string;
  disabled?: boolean;
  /** Icon before the label (6.0, page templates T02 / T05 / T09). */
  icon?: ReactNode;
  /** Number after the label: 「人员 23」; attention / danger when it means something to handle. */
  count?: number | string;
  countTone?: "neutral" | "attention" | "danger";
};
export type TabbedPageProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  sections: readonly TabbedPageSection[];
  /** Current section id (controlled; keep it in the URL or host state). */
  value: string;
  onValueChange: (id: string) => void;
  /**
   * Section content. `active` is true only for the visible section of a visible page: pause
   * polling / live refresh when it is false. A PageHeader inside renders compactly by itself.
   */
  render: (id: string, active: boolean) => ReactNode;
  /** Default true: visited sections stay mounted but hidden (filters, page, unsaved input kept). */
  keepMounted?: boolean;
  /** Whether the page itself is visible, e.g. its AdminShell workspace tab is active. Default true. */
  active?: boolean;
  /** Accessible name of the tab list; default `${title}分区`. */
  tabsLabel?: string;
  /**
   * With a single section the tab row is never shown (8.6): the panel is a region named by the section label.
   * Hide the section tab row while one section takes the whole page (e.g. a full-height workspace
   * opened inside it). Panels stay mounted; the row comes back when this turns false.
   */
  tabsHidden?: boolean;
};
/**
 * One menu entry that merges several pages: a single PageHeader + in-page Tabs + one panel per
 * section. Each panel is a tabpanel wrapped in PanelErrorBoundary and EmbeddedPage, so the pages
 * it hosts can keep their own PageHeader (it shrinks to a description + actions row).
 */
export function TabbedPage({
  title,
  description,
  actions,
  sections,
  value,
  onValueChange,
  render,
  keepMounted = true,
  active = true,
  tabsLabel,
  tabsHidden = false,
}: TabbedPageProps) {
  const base = useId();
  const [visited, setVisited] = useState<readonly string[]>([value]);
  useEffect(() => {
    if (keepMounted) setVisited((list) => (list.includes(value) ? list : [...list, value]));
  }, [value, keepMounted]);
  const panelId = (id: string) => `${base}panel-${id}`;
  const mounted = sections.filter((s) => s.id === value || (keepMounted && visited.includes(s.id)));
  // 8.6: one section = no tab row (a lone tab only repeats the page name); the panel is then a named region.
  const single = sections.length === 1;
  return (
    <div className="aui-tabbed-page">
      <EmbeddedPage embedded={false}>
        <PageHeader title={title} description={description} actions={actions} />
      </EmbeddedPage>
      {/* 分区标签一行的右端留插槽：分区一开头不是列表（例如 KPI 卡）时，页面按钮放这里，不单独占一行 */}
      <div className="aui-tabbed-tabs-row" hidden={tabsHidden || single || undefined}>
        <Tabs
          label={tabsLabel ?? `${title}分区`}
          value={value}
          onValueChange={onValueChange}
          items={sections.map((s) => ({ value: s.id, label: s.label, disabled: s.disabled, icon: s.icon, count: s.count, countTone: s.countTone }))}
          panelId={panelId(value)}
          idBase={base}
        />
        <span className="aui-page-actions-slot" />
      </div>
      <EmbeddedPage>
        {mounted.map((s) => (
          <div
            key={s.id}
            id={panelId(s.id)}
            role={single ? "region" : "tabpanel"}
            aria-labelledby={single ? undefined : `${base}tab-${s.id}`}
            aria-label={single ? s.label : undefined}
            className="aui-tabbed-panel"
            data-aui-page=""
            hidden={s.id !== value}
          >
            <PanelErrorBoundary>{render(s.id, active && s.id === value)}</PanelErrorBoundary>
          </div>
        ))}
      </EmbeddedPage>
    </div>
  );
}
