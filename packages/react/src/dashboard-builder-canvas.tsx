"use client";
/**
 * Dashboard canvas (bt/builders-b D9, D32, 审阅 06): the 6-column grid of 28px rows. Edit mode — drag a
 * widget by its grip to move, drag the right / bottom / corner handles to resize (a 「3 列 × 10 行」 hint
 * shows; the others make room live and float up), click to select; the card tools (复制 / 设置 / 删除)
 * sit in the card header, shown on hover or selection, never over the title. Keyboard on a focused
 * widget: arrows move, Shift+arrows resize, Delete removes, Ctrl+D duplicates, Esc deselects. Library
 * items dropped from outside land on the cell under the pointer (`cellAtClient`). View mode
 * (`DashboardView`) draws the same grid read-only; a 「数字组」 there is a bare row of number cards;
 * narrow screens stack the widgets in reading order.
 * Rules: dashboard-builder-core.ts.
 */
import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Copy, GripVertical, Filter, Settings2, Trash2 } from "lucide-react";
import { cn } from "./primitives.tsx";
import type { DashboardFilterValue } from "./dashboard-filters-core.ts";
import { WidgetStates, useWidgetData, widgetNoteOf, type LoadWidgetData } from "./dashboard-builder-widget.tsx";
import { WidgetNoteTag } from "./dashboard-widget-note.tsx";
import {
  cellAt,
  duplicateWidget,
  filterInheritance,
  keyboardLayoutStep,
  layoutBottom,
  metricBadge,
  moveWidget,
  nextWidgetId,
  readingOrder,
  removeWidget,
  resizeWidget,
  sizeAt,
  DASHBOARD_COLUMNS,
  type DashboardWidget,
} from "./dashboard-builder-core.ts";
import { IconButton } from "./buttons.tsx";
import { hugNumberRows } from "./dashboard-view-rows.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";

/** Row height of the grid (审阅 06: 64 → 28; stored version-1 dashboards are migrated by normalizeDashboard). */
export const DASHBOARD_ROW_HEIGHT = 28;
export const DASHBOARD_GAP = 12;
const GRID = { rowHeight: DASHBOARD_ROW_HEIGHT, gap: DASHBOARD_GAP, columns: DASHBOARD_COLUMNS };

/** What the frame shows next to the title (labels come from the host's dictionary / sources). */
export type WidgetDecor = {
  metrics?: readonly { key: string; name: string; version?: number; formula?: string }[];
  sourceLabel?: (sourceId: string) => string | undefined;
  dimensions?: readonly { key: string; label: string }[];
  /** 「清空筛选」 on a widget whose filters left nothing (no-match state). */
  onClearFilters?: () => void;
  /** 「设目标」 on a 「目标进度」 card without a target (the builder opens the widget's settings). */
  onSetTarget?: (widget: DashboardWidget) => void;
};

type FrameProps = {
  widget: DashboardWidget;
  context: DashboardFilterValue;
  load?: LoadWidgetData;
  decor: WidgetDecor;
  edit?: {
    selected: boolean;
    dragging: boolean;
    onSelect: () => void;
    onGrip: (event: PointerEvent<HTMLElement>) => void;
    onHandle: (event: PointerEvent<HTMLElement>, axis: "x" | "y" | "both") => void;
    onKey: (event: KeyboardEvent<HTMLElement>) => void;
    toolbar: ReactNode;
    /** 「3 列 × 10 行」 while resizing. */
    sizeHint?: string;
  };
  style?: CSSProperties;
};

/**
 * The widget card: header (grip in edit mode, title, grey source line, 「自定义口径」 / 「覆盖看板筛选」 —
 * the standard metric is not tagged, its definition stays in the tooltip — and the card tools) + body.
 */
export function WidgetFrame({ widget, context, load, decor, edit, style }: FrameProps) {
  const badge = metricBadge(widget.query?.metric, decor.metrics);
  const metric = widget.query?.metric;
  const formula = metric?.kind === "custom" ? metric.formula : metric ? decor.metrics?.find((m) => m.key === metric.key)?.formula : undefined;
  const source = widget.query?.source ? decor.sourceLabel?.(widget.query.source) : undefined;
  const inherit = widget.kind === "text" ? null : filterInheritance(widget, context, decor.dimensions);
  // Narrow widgets (KPI cards) keep the header for the title: the marks become icons.
  const wide = widget.layout.w >= 3;
  const pos = `第 ${widget.layout.x + 1} 列第 ${widget.layout.y + 1} 行，宽 ${widget.layout.w} 高 ${widget.layout.h}`;
  const bare = !edit && widget.kind === "group";
  const tip = badge?.kind === "standard" ? `${badge.label}${formula ? `：${formula}` : ""}` : undefined;
  const loaded = useWidgetData(widget, context, load);
  const note = widgetNoteOf(loaded.state);
  return (
    <section
      className="aui-dbb-widget"
      data-kind={widget.kind}
      data-bare={bare || undefined}
      data-selected={edit?.selected || undefined}
      data-dragging={edit?.dragging || undefined}
      style={style}
      tabIndex={edit ? 0 : undefined}
      aria-label={edit ? `${widget.title}（${pos}）` : widget.title}
      aria-roledescription={edit ? "看板组件" : undefined}
      onFocus={edit ? (e) => e.target === e.currentTarget && edit.onSelect() : undefined}
      onPointerDown={edit ? () => edit.onSelect() : undefined}
      onKeyDown={edit?.onKey}
    >
      <header className="aui-dbb-head" data-sr={bare || undefined}>
        {edit && (
          <span className="aui-dbb-grip" aria-hidden="true" data-tip="拖动" onPointerDown={edit.onGrip}>
            <GripVertical />
          </span>
        )}
        <h3 data-tip={widget.title}>{widget.title}</h3>
        {note && !bare && <WidgetNoteTag note={note} />}
        {source && wide && <small className="aui-dbb-sub">{source}</small>}
        {badge?.kind === "custom" && <span className="aui-dbb-tag" data-kind="custom" data-tip={formula ? `口径：${formula}` : badge.label}>{badge.label}</span>}
        {inherit && inherit.overridden.length > 0 && (
          <span className="aui-dbb-tag" data-kind="override" data-icon={wide ? undefined : ""} data-tip={`这个组件不跟看板的：${inherit.overridden.join("、")}`}>
            {wide ? "覆盖看板筛选" : <><Filter aria-hidden="true" /><span className="aui-sr-only">覆盖看板筛选</span></>}
          </span>
        )}
        {edit && edit.toolbar}
      </header>
      <div className="aui-dbb-body">
        <WidgetStates widget={widget} context={context} load={load} loaded={loaded} inlineNote={bare ? note : undefined} onClearFilters={decor.onClearFilters} onSetTarget={decor.onSetTarget ? () => decor.onSetTarget?.(widget) : undefined} />
        {widget.caption && <p className="aui-dbb-caption">{widget.caption}</p>}
      </div>
      {edit?.selected && (
        <>
          <span className="aui-dbb-handle" data-axis="x" aria-hidden="true" onPointerDown={(e) => edit.onHandle(e, "x")} />
          <span className="aui-dbb-handle" data-axis="y" aria-hidden="true" onPointerDown={(e) => edit.onHandle(e, "y")} />
          <span className="aui-dbb-handle" data-axis="both" aria-hidden="true" onPointerDown={(e) => edit.onHandle(e, "both")} />
        </>
      )}
      {edit?.sizeHint && <span className="aui-dbb-size" aria-hidden="true">{edit.sizeHint}</span>}
      {tip && <span className="aui-sr-only">{tip}</span>}
    </section>
  );
}

const place = (w: DashboardWidget): CSSProperties => ({ gridColumn: `${w.layout.x + 1} / span ${w.layout.w}`, gridRow: `${w.layout.y + 1} / span ${w.layout.h}` });
const gridVars = { "--aui-dbb-row": `${DASHBOARD_ROW_HEIGHT}px`, "--aui-dbb-gap": `${DASHBOARD_GAP}px` } as CSSProperties;

export type DashboardViewProps = {
  widgets: readonly DashboardWidget[];
  context: DashboardFilterValue;
  load?: LoadWidgetData;
  decor?: WidgetDecor;
  /** Stack in reading order (phones). */
  stacked?: boolean;
  label?: string;
};
/** Read-only dashboard (preview, phones, T17 view mode). */
export function DashboardView({ widgets, context, load, decor = {}, stacked, label = "看板" }: DashboardViewProps) {
  const list = stacked ? readingOrder(widgets) : widgets;
  const lone = stacked ? loneNumbers(list) : new Set<string>();
  // Number cards hug their content (8.6): stacked = one auto row each, wide = a band of them folds into one auto row.
  const hug = stacked ? null : hugNumberRows(list);
  const stackedRow = (w: DashboardWidget) => (w.kind === "group" || w.kind === "kpi" ? "span 1" : `span ${w.layout.h}`);
  return (
    <div className="aui-dbb-grid" data-stacked={stacked || undefined} style={hug ? { ...gridVars, gridTemplateRows: hug.templateRows } : gridVars} role="region" aria-label={label}>
      {list.map((w) => (
        <WidgetFrame key={w.id} widget={w} context={context} load={load} decor={decor} style={stacked ? { gridRow: stackedRow(w), ...(lone.has(w.id) ? { gridColumn: "1 / -1" } : {}) } : (hug?.place.get(w.id) ?? place(w))} />
      ))}
    </div>
  );
}

/** Phones put number cards two by two: the last of an odd run of them takes the whole row. */
function loneNumbers(list: readonly DashboardWidget[]): Set<string> {
  const out = new Set<string>();
  let run: string[] = [];
  const flush = () => {
    if (run.length % 2 === 1) out.add(run[run.length - 1]!);
    run = [];
  };
  for (const w of list) {
    if (w.kind === "kpi") run.push(w.id);
    else flush();
  }
  flush();
  return out;
}

type Drag = { id: string; mode: "move" | "resize"; axis: "x" | "y" | "both"; grab: { x: number; y: number }; preview: DashboardWidget[] };

export type DashboardCanvasHandle = {
  /** Grid cell under a viewport point, or null when the point is outside the canvas. */
  cellAtClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
};
export type DashboardCanvasProps = {
  widgets: readonly DashboardWidget[];
  /** Layout shown while something is dragged in from the library. */
  preview?: readonly DashboardWidget[] | null;
  previewId?: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** A finished change (history step) and what to announce. */
  onCommit: (next: DashboardWidget[], announcement: string) => void;
  context: DashboardFilterValue;
  load?: LoadWidgetData;
  decor: WidgetDecor;
  emptyHint?: ReactNode;
};

/** Edit canvas with pointer and keyboard layout editing. */
export const DashboardCanvas = /* @__PURE__ */ forwardRef<DashboardCanvasHandle, DashboardCanvasProps>(function DashboardCanvas(props, ref) {
  const { widgets, preview, previewId, selected, onSelect, onCommit, context, load, decor, emptyHint } = props;
  const grid = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const shown = drag?.preview ?? preview ?? widgets;
  const rows = layoutBottom(shown) + 1;
  const geometry = () => {
    const el = grid.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { box, width: el.clientWidth };
  };
  const cellAtClient = (clientX: number, clientY: number) => {
    const g = geometry();
    if (!g) return null;
    const { box } = g;
    if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom + DASHBOARD_ROW_HEIGHT) return null;
    return cellAt({ x: clientX - box.left, y: clientY - box.top }, { ...GRID, width: g.width });
  };
  useImperativeHandle(ref, () => ({ cellAtClient }));

  const start = (event: PointerEvent<HTMLElement>, widget: DashboardWidget, mode: Drag["mode"], axis: Drag["axis"]) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const cell = cellAtClient(event.clientX, event.clientY) ?? { x: widget.layout.x, y: widget.layout.y };
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    onSelect(widget.id);
    let current: Drag = { id: widget.id, mode, axis, grab: { x: cell.x - widget.layout.x, y: cell.y - widget.layout.y }, preview: widgets.slice() };
    setDrag(current);
    const onMove = (e: globalThis.PointerEvent) => {
      const g = geometry();
      if (!g) return;
      const point = { x: e.clientX - g.box.left, y: e.clientY - g.box.top };
      let next: DashboardWidget[];
      if (mode === "move") {
        const c = cellAt(point, { ...GRID, width: g.width });
        next = moveWidget(widgets, widget.id, { x: c.x - current.grab.x, y: c.y - current.grab.y });
      } else next = resizeWidget(widgets, widget.id, sizeAt(widget.layout, point, { ...GRID, width: g.width }, axis));
      current = { ...current, preview: next };
      setDrag(current);
    };
    const finish = (commit: boolean) => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onEsc, true);
      setDrag(null);
      if (!commit) return;
      const moved = current.preview.find((w) => w.id === widget.id);
      const before = widgets.find((w) => w.id === widget.id);
      if (!moved || !before || JSON.stringify(moved.layout) === JSON.stringify(before.layout)) return;
      const l = moved.layout;
      onCommit(current.preview, mode === "move" ? `${widget.title} 移到第 ${l.x + 1} 列第 ${l.y + 1} 行` : `${widget.title} 改成宽 ${l.w} 高 ${l.h}`);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onEsc, true);
  };

  const actions = (widget: DashboardWidget) => {
    const duplicate = () => {
      const id = nextWidgetId(widgets);
      onCommit(duplicateWidget(widgets, widget.id, id), `已复制 ${widget.title}`);
      onSelect(id);
    };
    const remove = () => {
      onCommit(removeWidget(widgets, widget.id), `已删除 ${widget.title}，可以撤销`);
      onSelect(null);
    };
    return { duplicate, remove };
  };
  const onKey = (event: KeyboardEvent<HTMLElement>, widget: DashboardWidget) => {
    if (event.target !== event.currentTarget) return;
    const a = actions(widget);
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      a.remove();
      grid.current?.focus();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      a.duplicate();
      return;
    }
    if (event.key === "Escape") {
      onSelect(null);
      return;
    }
    const next = keyboardLayoutStep(widgets, widget.id, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    const l = next.find((w) => w.id === widget.id)?.layout;
    if (l) onCommit(next, event.shiftKey ? `宽 ${l.w} 高 ${l.h}` : `第 ${l.x + 1} 列第 ${l.y + 1} 行`);
  };

  return (
    <div ref={grid} className="aui-dbb-grid" data-editing="" data-dragging={drag ? drag.mode : undefined} style={{ ...gridVars, gridTemplateRows: `repeat(${rows}, var(--aui-dbb-row))` }} tabIndex={-1} role="region" aria-label="看板画布" onPointerDown={(e) => e.target === e.currentTarget && onSelect(null)}>
      {shown.map((w) => {
        const a = actions(w);
        return (
          <WidgetFrame
            key={w.id}
            widget={w}
            context={context}
            load={load}
            decor={decor}
            style={place(w)}
            edit={{
              selected: selected === w.id,
              dragging: drag?.id === w.id || previewId === w.id,
              onSelect: () => selected !== w.id && onSelect(w.id),
              onGrip: (e) => start(e, w, "move", "both"),
              onHandle: (e, axis) => start(e, w, "resize", axis),
              onKey: (e) => onKey(e, w),
              ...(drag?.mode === "resize" && drag.id === w.id ? { sizeHint: `${w.layout.w} 列 × ${w.layout.h} 行` } : {}),
              toolbar: (
                <span className="aui-dbb-toolbar" role="toolbar" aria-label={`${w.title} 的操作`} onPointerDown={(e) => e.stopPropagation()}>
                  <IconButton label="复制" tooltip="复制（Ctrl+D）" onClick={a.duplicate} icon={<Copy />} />
                  <IconButton label="设置" aria-pressed={selected === w.id} onClick={() => onSelect(w.id)} icon={<Settings2 />} />
                  <IconButton label="删除" tooltip="删除（Delete）" className="aui-dbb-danger" onClick={a.remove} icon={<Trash2 />} />
                </span>
              ),
            }}
          />
        );
      })}
      <div className={cn("aui-dbb-drop")} style={{ gridColumn: "1 / -1", gridRow: `${rows} / span 1` }} aria-hidden="true">
        {shown.length === 0 ? emptyHint ?? "从左边把组件拖到这里，或点一下组件直接加到最后" : "把组件拖到这里"}
      </div>
      <HelpTipSlot />
    </div>
  );
});

/** Keyboard help, read once by screen readers (visually hidden). */
function HelpTipSlot() {
  return <span className="aui-sr-only">选中组件后：方向键移动，Shift 加方向键改大小，Delete 删除，Ctrl+D 复制，Esc 取消选中。</span>;
}
