"use client";
/**
 * Widget library of the dashboard builder (bt/builders-b D9, 审阅 06): search, chart tiles in 3 columns
 * (one per widget kind) and the host's templates in groups (「标准指标 · 口径来自指标字典」「多维表格视图」).
 * Drag an item onto the canvas (pointer) or press Enter / click to add it at the end (keyboard).
 * Collapses to a 56px icon rail (`collapsed`): the chart tiles stay as icon buttons, templates hide.
 */
import { useMemo, useState, type PointerEvent, type ReactNode } from "react";
import { BarChart3, ChartBarBig, ChartBarStacked, ChartColumnBig, ChartPie, Filter, GripVertical, Hash, LayoutGrid, LineChart, PanelLeftClose, PanelLeftOpen, Rows3, Search, SquarePlus, Table2, Target, Type, Users } from "lucide-react";
import { Input } from "./primitives.tsx";
import { WIDGET_KIND_LABELS, type DashboardWidget, type WidgetKind } from "./dashboard-builder-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";

/** A ready-made widget the host offers (standard metric widgets, bitable views …). */
export type WidgetTemplate = {
  id: string;
  label: string;
  kind: WidgetKind;
  /** Group heading, e.g. 「标准指标 · 口径来自指标字典」. */
  group?: string;
  /** Searchable extra words. */
  keywords?: string;
  icon?: ReactNode;
  /** The widget it creates (id and layout are filled in). */
  widget?: Partial<Omit<DashboardWidget, "id" | "kind">>;
};

export const WIDGET_KIND_ICONS: Readonly<Record<WidgetKind, ReactNode>> = {
  group: <Rows3 />,
  kpi: <Hash />,
  bullet: <Target />,
  line: <LineChart />,
  bar: <BarChart3 />,
  hbar: <ChartBarBig />,
  donut: <ChartPie />,
  stacked: <ChartBarStacked />,
  targetBar: <ChartColumnBig />,
  funnel: <Filter />,
  cohort: <LayoutGrid />,
  table: <Table2 />,
  rollup: <Users />,
  text: <Type />,
};

export type LibraryPick = { kind: WidgetKind; template?: WidgetTemplate };

export function WidgetLibrary({ kinds, templates, onAdd, onDragStart, hint, collapsed = false, onCollapsedChange }: {
  kinds: readonly WidgetKind[];
  templates: readonly WidgetTemplate[];
  onAdd: (pick: LibraryPick) => void;
  onDragStart: (pick: LibraryPick, event: PointerEvent<HTMLElement>) => void;
  hint?: ReactNode;
  /** Icon rail (56px): chart tiles only, labels as tooltips. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const tiles = kinds.filter((k) => !q || WIDGET_KIND_LABELS[k].toLowerCase().includes(q));
  const groups = useMemo(() => {
    const out = new Map<string, WidgetTemplate[]>();
    for (const t of templates) {
      const text = `${t.label} ${t.keywords ?? ""} ${WIDGET_KIND_LABELS[t.kind]}`.toLowerCase();
      if (q && !text.includes(q)) continue;
      const group = t.group ?? "常用组件";
      out.set(group, [...(out.get(group) ?? []), t]);
    }
    return [...out];
  }, [templates, q]);
  const item = (pick: LibraryPick, label: string, side: ReactNode, icon: ReactNode, className: string) => (
    <button
      type="button"
      className={className}
      aria-label={`添加${label}（${WIDGET_KIND_LABELS[pick.kind]}）`}
      data-tip={collapsed ? `${label} · 拖到画布，或点一下加到最后` : "拖到右边画布，或点一下加到最后"}
      onPointerDown={(e) => e.button === 0 && e.pointerType !== "touch" && onDragStart(pick, e)}
      onClick={() => onAdd(pick)}
    >
      {icon}
      <span>{label}</span>
      {side}
    </button>
  );
  const toggle = onCollapsedChange && (
    <IconButton label={collapsed ? "展开组件库" : "收起组件库"} className="aui-dbb-lib-toggle" aria-expanded={!collapsed} onClick={() => onCollapsedChange(!collapsed)} icon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />} />
  );
  if (collapsed)
    return (
      <aside className="aui-dbb-lib" data-collapsed="" aria-label="添加卡片">
        {toggle}
        <div className="aui-dbb-rail">{kinds.map((kind) => <span key={kind} className="aui-dbb-tile-wrap">{item({ kind }, WIDGET_KIND_LABELS[kind], null, WIDGET_KIND_ICONS[kind], "aui-dbb-tile")}</span>)}</div>
      </aside>
    );
  return (
    <aside className="aui-dbb-lib" aria-label="添加卡片">
      <h3><SquarePlus aria-hidden="true" />添加卡片{toggle}</h3>
      <span className="aui-dbb-lib-search">
        <Search aria-hidden="true" />
        <Input value={query} placeholder="搜索卡片、指标" aria-label="搜索卡片、指标" onChange={(e) => setQuery(e.target.value)} />
      </span>
      {tiles.length > 0 && (
        <>
          <h4>图表 · 拖到右边，或点一下加到最后</h4>
          <div className="aui-dbb-tiles">{tiles.map((kind) => <span key={kind} className="aui-dbb-tile-wrap">{item({ kind }, WIDGET_KIND_LABELS[kind], null, WIDGET_KIND_ICONS[kind], "aui-dbb-tile")}</span>)}</div>
        </>
      )}
      {groups.map(([group, list]) => (
        <section key={group} className="aui-dbb-lib-group" aria-label={group}>
          <h4>{group}</h4>
          {list.map((t) => (
            <span key={t.id} className="aui-dbb-lib-row">
              {item({ kind: t.kind, template: t }, t.label, <small>{WIDGET_KIND_LABELS[t.kind]}</small>, t.icon ?? WIDGET_KIND_ICONS[t.kind] ?? <GripVertical />, "aui-dbb-lib-item")}
            </span>
          ))}
        </section>
      ))}
      {!tiles.length && !groups.length && <p className="aui-dbb-lib-empty">没有找到「{query}」</p>}
      {hint && <p className="aui-dbb-lib-hint">{hint}</p>}
    </aside>
  );
}
