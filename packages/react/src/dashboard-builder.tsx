"use client";
/**
 * `@adminui/react/dashboard-builder` (bt/builders-b D9, demo D32): build a dashboard from widgets.
 *
 * DashboardBuilder (审阅 06) = one 52px toolbar line (name ✎ · scope chip · 「3 处修改未保存」 · ? permission
 * note ‖ undo redo | 预览 · 取消 · 另存为我的 · 保存) + the host's DashboardFilterBar row + panes: widget
 * library (248px, collapses to a 56px icon rail; search, chart tiles, host templates; drag or click to
 * add) | 6-column canvas of 28px rows (drag / resize / keyboard, card tools in the card header, empty
 * state) | config of the selected widget — only while one is selected (320px), otherwise the canvas
 * takes the room. Phones (< 760px) get a read-only preview with 「请在电脑上编辑」.
 *
 * The dashboard is a plain JSON `DashboardSchema`; widgets render with the existing dashboard
 * components from data the host returns in `loadWidgetData(widget, filterContext, signal)` — the host
 * runs the queries on the server inside the viewer's permission scope (DASHBOARDS.md §8, §9).
 * Rules: dashboard-builder-core.ts (unit-tested). Styles: styles/dashboard-builder.css.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Building2, Check, Eye, LayoutDashboard, Pencil, Redo2, Undo2, UserRound } from "lucide-react";
import { Button, Input, cn } from "./primitives.tsx";
import { InlineAlert } from "./layout.tsx";
import { HelpTip } from "./help-tip.tsx";
import { useElementWidth } from "./media-audio.tsx";
import { DEFAULT_COMPARE_OPTIONS, type DashboardFilterValue, type FilterOption } from "./dashboard-filters-core.ts";
import { DashboardCanvas, DashboardView, type DashboardCanvasHandle, type WidgetDecor } from "./dashboard-builder-canvas.tsx";
import { WidgetLibrary, type LibraryPick, type WidgetTemplate } from "./dashboard-builder-library.tsx";
import { WidgetConfig, type DashboardDataSource, type DashboardMetricDef, type DashboardTargetDef } from "./dashboard-builder-config.tsx";
import type { LoadWidgetData } from "./dashboard-builder-widget.tsx";
import { addWidget, countSchemaChanges, historyPush, historyRedo, historyStart, historyUndo, nextWidgetId, WIDGET_KINDS, WIDGET_KIND_LABELS, WIDGET_SIZES, type DashboardSchema, type DashboardWidget, type WidgetKind } from "./dashboard-builder-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";

export type DashboardBuilderProps = {
  /** The dashboard to edit (read once; give the builder a new `key` to load another). */
  value: DashboardSchema;
  /** Every finished change (drafts / autosave). */
  onChange?: (schema: DashboardSchema) => void;
  /** Current dashboard filter context (from DashboardFilterBar / useDashboardFilters). */
  filterContext: DashboardFilterValue;
  /** The filter row: the host's DashboardFilterBar. */
  filterBar?: ReactNode;
  filterNote?: ReactNode;
  /** Dashboard dimensions (key + pill label) for 「继承 / 覆盖」 in widgets. */
  dimensions?: readonly { key: string; label: string }[];
  loadWidgetData: LoadWidgetData;
  sources?: readonly DashboardDataSource[];
  /** The host's metric dictionary (standard metrics). */
  metrics?: readonly DashboardMetricDef[];
  /**
   * Targets the host keeps (a table's monthly goal …): target widgets (目标进度, 子弹图, 汇总卡, 实际 vs 目标) can pick one
   * instead of a fixed number. The widget stores only `targetRef`; `loadWidgetData` resolves the value and period.
   */
  targets?: readonly DashboardTargetDef[];
  compareOptions?: readonly FilterOption[];
  /** Ready-made widgets in the library (standard metric widgets, bitable views …). */
  templates?: readonly WidgetTemplate[];
  /** Chart tiles in the library and the config (default: every kind). */
  kinds?: readonly WidgetKind[];
  /** 「团队默认」 / 「我的」 chip next to the name. */
  scopeLabel?: string;
  /** Icon of the scope chip: company = building, personal = person (same icons as the dashboard tabs). */
  scope?: "company" | "personal";
  /** Start with the widget library as a 56px icon rail. */
  libraryCollapsed?: boolean;
  /** 「你只能看到你有权限的数据：一组 5 人」 — behind a 「?」 in the toolbar. */
  permissionNote?: ReactNode;
  /** Save; reject keeps the builder with the message. */
  onSave?: (schema: DashboardSchema) => void | Promise<void>;
  /** 「另存为我的看板」 (e.g. editing a shared dashboard you may not overwrite). */
  onSaveAsMine?: (schema: DashboardSchema) => void | Promise<void>;
  onCancel?: () => void;
  libraryHint?: ReactNode;
  /** Note at the bottom of the config pane, default 「分享给别人时，按对方的权限出数」. */
  configFooter?: ReactNode;
  /** Total height of the builder (panes scroll inside), default 760px. */
  height?: number | string;
  /** Below this width the builder is a read-only preview (default 760). */
  phoneBreakpoint?: number;
  className?: string;
};

type Ext = { pick: LibraryPick; widget: DashboardWidget; x: number; y: number; moved: boolean; over: { x: number; y: number } | null };

function newWidget(pick: LibraryPick, widgets: readonly DashboardWidget[]): DashboardWidget {
  const size = WIDGET_SIZES[pick.kind];
  const base = pick.template?.widget ?? {};
  const group = pick.kind === "group" && !base.items ? { items: [{ id: "n1", title: "数字 1" }, { id: "n2", title: "数字 2" }] } : {};
  return {
    ...group,
    ...base,
    id: nextWidgetId(widgets),
    kind: pick.kind,
    title: base.title ?? pick.template?.label ?? WIDGET_KIND_LABELS[pick.kind],
    layout: { x: 0, y: 0, w: base.layout?.w ?? size.w, h: base.layout?.h ?? size.h },
    ...(pick.template ? { template: pick.template.id } : {}),
  };
}

export function DashboardBuilder(props: DashboardBuilderProps) {
  const { onChange, filterContext, filterBar, filterNote = "看板筛选作用于全部组件；组件里还可以再加筛选", dimensions = [], loadWidgetData, sources = [], metrics = [], compareOptions = DEFAULT_COMPARE_OPTIONS, templates = [], kinds = WIDGET_KINDS, scopeLabel, scope, permissionNote, onSave, onSaveAsMine, onCancel, libraryHint = "拖到右边画布；标准组件的口径不能改，想改就换成「自定义」，组件会标出来。", configFooter = "分享给别人时，按对方的权限出数", height = 760, phoneBreakpoint = 760, className } = props;
  const [initial] = useState<DashboardSchema>(() => props.value);
  const [history, setHistory] = useState(() => historyStart(initial));
  const [saved, setSaved] = useState(initial);
  const [libraryCollapsed, setLibraryCollapsed] = useState(Boolean(props.libraryCollapsed));
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ext, setExt] = useState<Ext | null>(null);
  const suppressClick = useRef(false);
  const canvas = useRef<DashboardCanvasHandle>(null);
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const schema = history.present;
  const phone = width > 0 && width < phoneBreakpoint;
  const dirty = schema !== saved;
  const changes = dirty ? Math.max(1, countSchemaChanges(saved, schema)) : 0;
  const widget = schema.widgets.find((w) => w.id === selected) ?? null;
  // Narrow builders (inside a table page): while the config pane is open the library becomes the icon rail.
  const rail = libraryCollapsed || (widget !== null && width > 0 && width < 1100);
  const decor: WidgetDecor = useMemo(() => ({ metrics, dimensions, sourceLabel: (id: string) => { const s = sources.find((x) => x.id === id); return s ? `${s.group ? `${s.group} · ` : ""}${s.label}` : undefined; }, onSetTarget: (w: DashboardWidget) => setSelected(w.id) }), [metrics, dimensions, sources]);

  const announce = (text: string) => setAnnouncement((old) => (old === text ? `${text} ` : text));
  const lastMerge = useRef<string | null>(null);
  const commit = useCallback((next: DashboardSchema, text?: string, mergeKey?: string) => {
    const merge = Boolean(mergeKey) && mergeKey === lastMerge.current;
    lastMerge.current = mergeKey ?? null;
    setHistory((h) => historyPush(h, next, 100, merge));
    onChange?.(next);
    if (text) announce(text);
  }, [onChange]);
  const setWidgets = (widgets: DashboardWidget[], text?: string, mergeKey?: string) => commit({ ...schema, widgets }, text, mergeKey);
  const undo = () => {
    if (!history.past.length) return;
    const h = historyUndo(history);
    lastMerge.current = null;
    setHistory(h);
    onChange?.(h.present);
    announce("已撤销");
  };
  const redo = () => {
    if (!history.future.length) return;
    const h = historyRedo(history);
    setHistory(h);
    onChange?.(h.present);
    announce("已重做");
  };
  useEffect(() => {
    if (selected && !schema.widgets.some((w) => w.id === selected)) setSelected(null);
  }, [schema, selected]);

  // ---- library → canvas (pointer drag; a click without moving adds at the end)
  const add = (pick: LibraryPick, at?: { x: number; y: number }) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const w = newWidget(pick, schema.widgets);
    setWidgets(addWidget(schema.widgets, w, at), `已添加 ${w.title}`);
    setSelected(w.id);
  };
  const dragStart = (pick: LibraryPick, event: PointerEvent<HTMLElement>) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const w = newWidget(pick, schema.widgets);
    let state: Ext = { pick, widget: w, x: startX, y: startY, moved: false, over: null };
    const move = (e: globalThis.PointerEvent) => {
      const moved = state.moved || Math.hypot(e.clientX - startX, e.clientY - startY) > 5;
      state = { ...state, x: e.clientX, y: e.clientY, moved, over: moved ? (canvas.current?.cellAtClient(e.clientX, e.clientY) ?? null) : null };
      if (moved) setExt(state);
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("keydown", esc, true);
      setExt(null);
      if (!state.moved) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      if (!state.over) return announce("没有放进画布");
      setWidgets(addWidget(schema.widgets, state.widget, state.over), `已添加 ${state.widget.title}`);
      setSelected(state.widget.id);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      state = { ...state, over: null };
      up();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("keydown", esc, true);
  };
  const extPreview = ext?.over ? addWidget(schema.widgets, ext.widget, ext.over) : null;

  // Undo / redo keys: inside the builder, or with nothing focused (focus fell to <body> after a button
  // disabled itself). Text fields keep their own undo.
  const keys = useRef({ undo, redo, active: !phone && !preview });
  keys.current = { undo, redo, active: !phone && !preview };
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const inside = target && (target === document.body || rootRef.current?.contains(target));
      if (!inside || !keys.current.active || target.closest("input, textarea, [contenteditable=true]")) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) keys.current.redo();
        else keys.current.undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        keys.current.redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rootRef]);
  const run = async (fn: ((s: DashboardSchema) => void | Promise<void>) | undefined, done: string) => {
    if (!fn) return;
    setBusy(true);
    setError("");
    try {
      await fn(schema);
      setSaved(schema);
      announce(done);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const status = phone ? "只读预览" : preview ? "预览中" : dirty ? `${changes} 处修改未保存` : "已保存";
  const ScopeIcon = scope === "company" ? Building2 : scope === "personal" ? UserRound : null;
  const style = { "--aui-dbb-height": typeof height === "number" ? `${height}px` : height } as CSSProperties;
  return (
    <div ref={rootRef} className={cn("aui-dbb", className)} data-mode={phone ? "phone" : preview ? "preview" : "edit"} style={style}>
      <div className="aui-dbb-bar">
        <span className="aui-dbb-name">
          <LayoutDashboard aria-hidden="true" />
          {renaming && !phone ? (
            <Input autoFocus aria-label="看板名称" defaultValue={schema.title} onBlur={(e) => { setRenaming(false); const t = e.target.value.trim(); if (t && t !== schema.title) commit({ ...schema, title: t }, "已改名"); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(false); }} />
          ) : (
            <>
              <b>{schema.title}</b>
              {!phone && <IconButton label="改看板名称" tooltip="改名" onClick={() => setRenaming(true)} icon={<Pencil />} />}
            </>
          )}
        </span>
        {scopeLabel && <span className="aui-dbb-scope">{ScopeIcon && <ScopeIcon aria-hidden="true" />}{scopeLabel}</span>}
        <span className="aui-dbb-status" data-dirty={dirty || undefined} role="status">{status}</span>
        {permissionNote && <HelpTip label="权限说明" title="权限说明">{permissionNote}</HelpTip>}
        {!phone && (
          <span className="aui-dbb-bar-actions">
            <IconButton label="撤销（Ctrl+Z）" disabled={!history.past.length || preview} onClick={undo} icon={<Undo2 />} />
            <IconButton label="重做（Ctrl+Shift+Z）" disabled={!history.future.length || preview} onClick={redo} icon={<Redo2 />} />
            <span className="aui-dbb-bar-sep" aria-hidden="true" />
            <Button variant="outline" size="sm" aria-pressed={preview} onClick={() => { setPreview((v) => !v); setSelected(null); }}>{preview ? <><Pencil />继续编辑</> : <><Eye />预览</>}</Button>
            {onCancel && <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>取消</Button>}
            {onSaveAsMine && <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(onSaveAsMine, "已另存为我的看板")}>另存为我的</Button>}
            {onSave && <Button size="sm" disabled={busy || !dirty} loading={busy} onClick={() => void run(onSave, "已保存")}><Check />{busy ? "保存中…" : "保存"}</Button>}
          </span>
        )}
      </div>
      {error && <InlineAlert tone="error" title="没保存成功">{error}</InlineAlert>}
      {(filterBar || filterNote) && (
        <div className="aui-dbb-filters">
          {filterBar}
          {filterNote && !phone && <small className="aui-dbb-filter-note">{filterNote}</small>}
        </div>
      )}
      {phone ? (
        <div className="aui-dbb-phone">
          <InlineAlert title="请在电脑上编辑">手机上只能看，拖动和改设置请用电脑打开这个看板。</InlineAlert>
          <DashboardView widgets={schema.widgets} context={filterContext} load={loadWidgetData} decor={decor} stacked label={schema.title} />
        </div>
      ) : preview ? (
        <div className="aui-dbb-scroll">
          <DashboardView widgets={schema.widgets} context={filterContext} load={loadWidgetData} decor={decor} label={schema.title} />
        </div>
      ) : (
        <div className="aui-dbb-panes" data-lib={rail ? "rail" : "open"} data-config={widget ? "open" : undefined}>
          <WidgetLibrary kinds={kinds} templates={templates} onAdd={(pick) => add(pick)} onDragStart={dragStart} hint={libraryHint} collapsed={rail} onCollapsedChange={setLibraryCollapsed} />
          <div className="aui-dbb-scroll" data-dropping={ext?.moved || undefined}>
            <DashboardCanvas
              ref={canvas}
              widgets={schema.widgets}
              preview={extPreview}
              previewId={ext?.over ? ext.widget.id : null}
              selected={selected}
              onSelect={setSelected}
              onCommit={(next, text) => setWidgets(next, text)}
              context={filterContext}
              load={loadWidgetData}
              decor={decor}
            />
          </div>
          {widget && (
            <WidgetConfig
              key={widget.id}
              widget={widget}
              onChange={(next, merge) => setWidgets(schema.widgets.map((w) => (w.id === next.id ? next : w)), undefined, merge ? `${next.id}:${merge}` : undefined)}
              onClose={() => setSelected(null)}
              sources={sources}
              metrics={metrics}
              compareOptions={compareOptions}
              context={filterContext}
              dimensions={dimensions}
              kinds={kinds}
              targets={props.targets}
              footer={configFooter}
            />
          )}
          {ext?.moved && (
            <span className="aui-dbb-ghost" style={{ left: ext.x + 12, top: ext.y + 12 }} aria-hidden="true">{ext.widget.title}</span>
          )}
        </div>
      )}
      <span className="aui-sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}

// Subpath exports: the builder, its read-only view, the parts and the pure rules.
export { DashboardView, DashboardCanvas, WidgetFrame, DASHBOARD_ROW_HEIGHT, DASHBOARD_GAP, type DashboardViewProps, type DashboardCanvasProps, type DashboardCanvasHandle, type WidgetDecor } from "./dashboard-builder-canvas.tsx";
export { WidgetLibrary, WIDGET_KIND_ICONS, type WidgetTemplate, type LibraryPick } from "./dashboard-builder-library.tsx";
export { WidgetConfig, type WidgetConfigProps, type DashboardDataSource, type DashboardMetricDef, type DashboardTargetDef } from "./dashboard-builder-config.tsx";
export { TargetProgressCard, type TargetProgressData } from "./dashboard-target-card.tsx";
export { targetProgress, type TargetProgress, type TargetProgressInput, type TargetPeriod } from "./dashboard-target-core.ts";
export { formatDuration, DURATION_UNIT } from "./duration-format.ts";
export { WidgetBody, WidgetContent, useWidgetData, skeletonShape, type DashboardWidgetData, type DashboardTableRow, type LoadWidgetData } from "./dashboard-builder-widget.tsx";
export { WidgetNoteTag, type DashboardWidgetNote } from "./dashboard-widget-note.tsx";
export {
  DASHBOARD_COLUMNS,
  DASHBOARD_SCHEMA_VERSION,
  MAX_WIDGET_ROWS,
  TARGET_WIDGET_KINDS,
  WIDGET_GROUP_LIMITS,
  WIDGET_KINDS,
  WIDGET_KIND_LABELS,
  WIDGET_SIZES,
  WIDGET_GRANULARITIES,
  clampLayout,
  overlaps,
  layoutBottom,
  readingOrder,
  compactLayout,
  moveWidget,
  resizeWidget,
  addWidget,
  removeWidget,
  duplicateWidget,
  shiftWidget,
  keyboardLayoutStep,
  cellAt,
  sizeAt,
  nextWidgetId,
  historyStart,
  historyPush,
  historyUndo,
  historyRedo,
  filterInheritance,
  widgetFilterContext,
  metricBadge,
  widgetDataKey,
  normalizeDashboard,
  migrateDashboardSpec,
  countSchemaChanges,
  type DashboardSchemaVersion,
  type WidgetGroupItem,
  type WidgetKind,
  type WidgetLayout,
  type WidgetGranularity,
  type WidgetMetric,
  type WidgetQuery,
  type DashboardWidget,
  type DashboardSchema,
  type BuilderHistory,
  type FilterInheritance,
} from "./dashboard-builder-core.ts";
