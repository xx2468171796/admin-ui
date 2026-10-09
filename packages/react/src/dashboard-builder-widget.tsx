"use client";
/**
 * One dashboard widget's content (bt/builders-b D9, 审阅 06): loads its data with the host's
 * `loadWidgetData(widget, filterContext)` (reloads only when the query, items, target or the filter
 * context changes, stale answers dropped) and draws it with the existing dashboard components — KpiCard
 * (also 2–6 in a 「数字组」), BulletBar, RollupCard, AdminChart + timeSeriesOption / barOption /
 * donutOption / stackedBarOption / targetBarOption, StepFunnel, CohortTable, CompactTable — or the note
 * text. States are ChartState, as tall as the widget body: loading skeleton, empty, no-match (「清空筛选」),
 * error (「重试」), stale (refresh failed: last data kept under a strip) and forbidden (lock, never 0).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useAdminTheme } from "./theme.tsx";
import { useElementWidth } from "./media-audio.tsx";
import { ChartState } from "./chart-state.tsx";
import { KpiCard, type KpiCardProps } from "./dashboard.tsx";
import { BulletBar, type BulletBarProps } from "./bullet-bar.tsx";
import { StepFunnel, CohortTable, RollupCard, type StepFunnelProps, type CohortTableProps, type RollupCardProps } from "./dashboard-widgets.tsx";
import { CompactTable } from "./collections.tsx";
import { AdminChart } from "./charts.tsx";
import { timeSeriesOption, type SeriesInput, type Annotation } from "./chart-options.ts";
import { targetBarOption, type TargetBarInput } from "./chart-options-targets.ts";
import { barOption, donutOption, stackedBarOption, type DonutItem, type StackedSeries } from "./chart-options-kinds.ts";
import type { GridField } from "./grid-core.ts";
import { TargetProgressCard, type TargetProgressData } from "./dashboard-target-card.tsx";
import { durationColumns, isDurationUnit } from "./duration-format.ts";
import type { DashboardFilterValue } from "./dashboard-filters-core.ts";
import { WidgetNoteTag, type DashboardWidgetNote } from "./dashboard-widget-note.tsx";
import { compactNumberText, kpiFitScale, widgetDataKey, widgetFilterContext, type DashboardWidget, type WidgetKind } from "./dashboard-builder-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";

type KpiData = Omit<KpiCardProps, "title" | "loading">;

export type DashboardTableRow = Record<string, unknown>;

/**
 * What `loadWidgetData` resolves with; `kind` must fit the widget's kind. `bar` data also draws a ranking
 * (hbar), a donut (categories = slices) or a one-segment stack, so switching the chart type in 「样式」
 * needs no new loader. Any kind may carry a `note` (8.8): a small tag next to the frame title (「按成交日汇率折算 ·
 * 缺汇率 3 条」, neutral or warning) whose `detail` opens in a popover.
 */
export type DashboardWidgetData = WidgetDataByKind & { note?: DashboardWidgetNote };
type WidgetDataByKind =
  | { kind: "kpi"; card: KpiData }
  /** 「数字组」: one card per item, in the widget's item order (`id` = the item's id). */
  | { kind: "group"; items: readonly { id: string; title?: string; card: KpiData }[] }
  | { kind: "bullet"; value: ReactNode | null; unit?: string; detail?: ReactNode; bullet: Omit<BulletBarProps, "label"> }
  | { kind: "line"; series: readonly SeriesInput[]; unit?: string; digits?: number; inProgress?: boolean; expectedIntervalMs?: number; annotations?: readonly Annotation[] }
  /** `bars.name` = the metric (tooltip 「客户数：117 位」); `colors` = per-bar colour tokens (an option's own `vizOptionColor`). */
  | { kind: "bar"; bars: Omit<TargetBarInput, "mode">; colors?: readonly (string | null | undefined)[] }
  | { kind: "donut"; items: readonly DonutItem[]; unit?: string; digits?: number; centerLabel?: string }
  | { kind: "stacked"; categories: readonly string[]; series: readonly StackedSeries[]; unit?: string; digits?: number; horizontal?: boolean }
  | { kind: "funnel"; funnel: Omit<StepFunnelProps, "label"> }
  | { kind: "cohort"; cohort: Omit<CohortTableProps, "label"> }
  /** `units`: field key → unit; "duration" shows that column's seconds as 「3.2 小时」 / 「1.5 天」. */
  | { kind: "table"; fields: readonly GridField<DashboardTableRow>[]; rows: readonly DashboardTableRow[]; rowKey?: string; viewAll?: { label: string; onClick?: () => void; href?: string }; units?: Readonly<Record<string, string>> }
  /** 「目标进度」 (targetProgress): actual / target in the target's period; `target: null` = none set. */
  | ({ kind: "targetProgress" } & TargetProgressData)
  | { kind: "rollup"; card: RollupCardProps }
  /** No data (「这个时间段没有记录」); `filtered` = the dashboard / widget filters left nothing → 「筛选后没有数据」 + 「清空筛选」. */
  | { kind: "empty"; message?: string; filtered?: boolean }
  /** The widget uses a field or source the viewer cannot read: lock + reason, never 0. */
  | { kind: "forbidden"; message?: string };

export type LoadWidgetData = (widget: DashboardWidget, context: DashboardFilterValue, signal: AbortSignal) => Promise<DashboardWidgetData>;

const FITS: Record<WidgetKind, DashboardWidgetData["kind"][]> = {
  group: ["group", "kpi"],
  kpi: ["kpi"],
  bullet: ["bullet"],
  line: ["line"],
  bar: ["bar"],
  hbar: ["bar"],
  donut: ["donut", "bar"],
  stacked: ["stacked", "bar"],
  targetBar: ["bar"],
  targetProgress: ["targetProgress"],
  funnel: ["funnel"],
  cohort: ["cohort"],
  table: ["table"],
  rollup: ["rollup"],
  text: [],
};

/** Skeleton shape while a widget loads. */
export function skeletonShape(kind: WidgetKind): "bars" | "kpi" | "rows" {
  if (kind === "kpi" || kind === "group" || kind === "bullet" || kind === "rollup" || kind === "targetProgress") return "kpi";
  if (kind === "funnel" || kind === "table" || kind === "cohort" || kind === "hbar") return "rows";
  return "bars";
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardWidgetData }
  /** A reload failed: the last data stays on screen under a strip. */
  | { status: "stale"; data: DashboardWidgetData; message: string; at: number };

const clock = (t: number) => new Date(t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Data of one widget; `reload()` for the retry button. A change of query / filters shows the skeleton
 * again; a failed retry of the same query keeps the last data (stale) instead of blanking the card.
 */
export function useWidgetData(widget: DashboardWidget, context: DashboardFilterValue, load: LoadWidgetData | undefined) {
  const key = widgetDataKey(widget, context);
  const [state, setState] = useState<State>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(widget);
  latest.current = widget;
  const last = useRef<{ key: string; data: DashboardWidgetData; at: number } | null>(null);
  useEffect(() => {
    if (widget.kind === "text" || !load) return;
    const controller = new AbortController();
    const kept = last.current?.key === key ? last.current : null;
    if (!kept) setState({ status: "loading" });
    load(latest.current, widgetFilterContext(latest.current, context), controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        last.current = { key, data, at: Date.now() };
        setState({ status: "ready", data });
      },
      (caught: unknown) => {
        if (controller.signal.aborted) return;
        const message = caught instanceof Error && caught.message ? caught.message : "数据加载失败";
        setState(kept ? { status: "stale", data: kept.data, message, at: kept.at } : { status: "error", message });
      },
    );
    return () => controller.abort();
    // `key` covers kind + query + items + target + the effective filter context; title / layout changes do not reload.
  }, [key, nonce, load]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}

/** Element height kept current (charts need a pixel height). */
function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(el.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, height] as const;
}

function ChartBox({ label, option }: { label: string; option: Parameters<typeof AdminChart>[0]["option"] }) {
  const [ref, height] = useElementHeight<HTMLDivElement>();
  return (
    <div ref={ref} className="aui-dbb-chart">
      {height > 40 && <AdminChart option={option} label={label} height={height} />}
    </div>
  );
}

/**
 * A KPI card whose number never gets cut to 「1.」 in a narrow widget (审阅 06): the number shrinks to fit
 * (down to 60%), then a plain number becomes 万 / 亿 (exact figure on hover), then shrinks further.
 * Back to the full number once the widget is wide enough again.
 */
function FittedKpi({ title, card, size }: { title: string; card: KpiData; size?: KpiCardProps["size"] }) {
  // Measures the widget body (the sentinel's parent) — KpiCard stays a direct child of it for the body styles.
  const sentinel = useRef<HTMLSpanElement>(null);
  const [compactAt, setCompactAt] = useState<number | null>(null);
  // Durations (unit "duration", seconds) format themselves in KpiCard and are never shortened to 万.
  const raw = !isDurationUnit(card.unit) && (typeof card.value === "string" || typeof card.value === "number") ? String(card.value) : null;
  const short = raw === null ? null : compactNumberText(raw);
  const compact = compactAt !== null && short !== null;
  useLayoutEffect(() => {
    const body = sentinel.current?.parentElement;
    if (!body) return;
    const fit = () => {
      const strong = body.querySelector<HTMLElement>(".aui-kpi-value strong");
      if (!strong) return;
      const width = body.clientWidth;
      strong.style.fontSize = "";
      if (compactAt !== null && width > compactAt + 1) return setCompactAt(null);
      const scale = kpiFitScale(strong.scrollWidth, strong.clientWidth);
      if (scale === null && short && compactAt === null) return setCompactAt(width);
      const s = scale ?? Math.max(0.4, Math.floor((strong.clientWidth / strong.scrollWidth) * 100) / 100);
      if (s < 1) strong.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(strong).fontSize) * s)}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(body);
    return () => observer.disconnect();
  }, [compactAt, short, card.value]);
  return (
    <>
      <KpiCard title={title} size={size} {...card} value={compact ? short : card.value} fullValue={card.fullValue ?? (compact && raw ? raw : undefined)} />
      <span ref={sentinel} hidden />
    </>
  );
}

/**
 * 「数字组」: 2–6 equal-width numbers (2 columns on phones, an odd last one spans the row). `note` = the widget's
 * note when the frame hides its own title row (read-only view): it goes into the last (top-right) number's title row.
 */
function NumberGroup({ widget, items, note }: { widget: DashboardWidget; items: readonly { id: string; title?: string; card: KpiData }[]; note?: DashboardWidgetNote }) {
  const titles = new Map((widget.items ?? []).map((i) => [i.id, i.title]));
  // Desktop shows all numbers in one row: the last one is the top-right one
  const noteAt = note ? items.length - 1 : -1;
  return (
    <div className="aui-dbb-group" data-count={items.length} data-odd={(items.length % 2 === 1 && items.length > 1) || undefined} role="list" aria-label={widget.title}>
      {items.map((item, index) => {
        const title = item.title ?? titles.get(item.id) ?? "";
        const head = <span className="aui-dbb-group-title" data-tip={title}>{title}</span>;
        return (
          <div key={item.id} className="aui-dbb-group-item" role="listitem">
            {note && index === noteAt ? <div className="aui-dbb-group-head">{head}<WidgetNoteTag note={note} /></div> : head}
            <FittedKpi title={title} card={item.card} size={widget.size} />
          </div>
        );
      })}
    </div>
  );
}

function asDonut(data: Extract<DashboardWidgetData, { kind: "bar" | "donut" }>): Extract<DashboardWidgetData, { kind: "donut" }> {
  if (data.kind === "donut") return data;
  const items = data.bars.categories.map((name, i) => {
    const color = data.colors?.[i];
    return { name, value: data.bars.values[i] ?? null, ...(color ? { color } : {}) };
  });
  return { kind: "donut", items, ...(data.bars.unit ? { unit: data.bars.unit } : {}), ...(data.bars.digits !== undefined ? { digits: data.bars.digits } : {}) };
}

/** Narrow cards (< 400px) put the legend under the ring instead of beside it. */
function DonutBox({ label, data }: { label: string; data: Extract<DashboardWidgetData, { kind: "donut" }> }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  if (!data.items.some((i) => typeof i.value === "number" && i.value > 0)) return <ChartState kind="empty" />;
  const layout = width > 0 && width < 400 ? "stacked" : "side";
  return (
    <div ref={ref} className="aui-dbb-chart-host">
      <ChartBox label={label} option={donutOption({ items: data.items, unit: data.unit, digits: data.digits, centerLabel: data.centerLabel, layout })} />
    </div>
  );
}

/** The content of a widget for its data (no frame). */
export function WidgetContent({ widget, data, onClearFilters, onSetTarget, inlineNote }: { widget: DashboardWidget; data: DashboardWidgetData; onClearFilters?: () => void; /** 「设目标」 on a target card without a target. */ onSetTarget?: () => void; /** The note when the frame has no visible title row (a bare 「数字组」). */ inlineNote?: DashboardWidgetNote }) {
  const { mode } = useAdminTheme();
  if (data.kind === "empty") return <ChartState kind={data.filtered ? "no-match" : "empty"} message={data.message} onClearFilters={onClearFilters} />;
  if (data.kind === "forbidden") return <ChartState kind="forbidden" message={data.message} />;
  if (!FITS[widget.kind].includes(data.kind)) return <ChartState kind="error" message={`数据和组件类型对不上（${data.kind}）`} />;
  const metricName = widget.query?.metric?.kind === "custom" ? widget.query.metric.name : widget.title;
  switch (data.kind) {
    case "kpi":
      return widget.kind === "group" ? <NumberGroup widget={widget} items={[{ id: "only", title: widget.title, card: data.card }]} note={inlineNote} /> : <FittedKpi title={widget.title} card={data.card} size={widget.size} />;
    case "group":
      return <NumberGroup widget={widget} items={data.items} note={inlineNote} />;
    case "bullet":
      return (
        <div className="aui-dbb-bullet">
          <p className="aui-dbb-big"><strong>{data.value ?? "—"}</strong>{data.unit && data.value != null && <small>{data.unit}</small>}</p>
          <BulletBar {...data.bullet} label={widget.title} />
          {data.detail && <p className="aui-dbb-detail">{data.detail}</p>}
        </div>
      );
    case "line":
      return <ChartBox label={widget.title} option={timeSeriesOption({ series: data.series, unit: data.unit, digits: data.digits, inProgress: data.inProgress, expectedIntervalMs: data.expectedIntervalMs, annotations: data.annotations, mode })} />;
    case "bar": {
      const { bars } = data;
      if (widget.kind === "donut") return <DonutBox label={widget.title} data={asDonut(data)} />;
      if (widget.kind === "targetBar") return <ChartBox label={widget.title} option={targetBarOption({ ...bars, mode })} />;
      if (widget.kind === "stacked") return <ChartBox label={widget.title} option={stackedBarOption({ categories: bars.categories, series: [{ name: bars.name ?? metricName, values: bars.values }], unit: bars.unit, digits: bars.digits })} />;
      return <ChartBox label={widget.title} option={barOption({ categories: bars.categories, values: bars.values, name: bars.name ?? metricName, unit: bars.unit, digits: bars.digits, horizontal: widget.kind === "hbar", labels: bars.labels, colors: data.colors })} />;
    }
    case "donut":
      return <DonutBox label={widget.title} data={data} />;
    case "stacked":
      return <ChartBox label={widget.title} option={stackedBarOption({ categories: data.categories, series: data.series, unit: data.unit, digits: data.digits, horizontal: data.horizontal })} />;
    case "funnel":
      return <StepFunnel {...data.funnel} label={widget.title} />;
    case "cohort":
      return <CohortTable {...data.cohort} label={widget.title} />;
    case "targetProgress":
      return <TargetProgressCard title={widget.title} data={data} onSetTarget={onSetTarget} />;
    case "table":
      return <CompactTable caption={widget.title} fields={durationColumns(data.fields, data.units)} rows={data.rows} getRowId={(row) => String(row[data.rowKey ?? "id"] ?? "")} viewAll={data.viewAll} expandRecord={false} />;
    case "rollup":
      return <RollupCard {...data.card} />;
  }
}

type BodyProps = { widget: DashboardWidget; context: DashboardFilterValue; load?: LoadWidgetData; onClearFilters?: () => void; onSetTarget?: () => void };

/** Widget body: text note, or load + states + content. `onClearFilters` = 「清空筛选」 on a no-match state; `onSetTarget` = 「设目标」. */
export function WidgetBody(props: BodyProps) {
  return <WidgetStates {...props} loaded={useWidgetData(props.widget, props.context, props.load)} />;
}

/** The note of the data on screen (ready, or the kept data of a failed refresh). */
export function widgetNoteOf(state: ReturnType<typeof useWidgetData>["state"]): DashboardWidgetNote | undefined {
  return state.status === "ready" || state.status === "stale" ? state.data.note : undefined;
}

/** WidgetBody with the data loaded by the caller (WidgetFrame also needs it for the note in its header). */
export function WidgetStates({ widget, load, onClearFilters, onSetTarget, loaded, inlineNote }: BodyProps & { loaded: ReturnType<typeof useWidgetData>; inlineNote?: DashboardWidgetNote }) {
  const { state, reload } = loaded;
  if (widget.kind === "text") return <div className="aui-dbb-note">{widget.text?.trim() ? widget.text : <span className="aui-dbb-placeholder">在右边「样式」里写说明</span>}</div>;
  if (!load) return <ChartState kind="empty" message="没有数据接口" />;
  if (state.status === "loading") return <ChartState kind="loading" shape={skeletonShape(widget.kind)} label={widget.title} />;
  if (state.status === "error") return <ChartState kind="error" message={state.message} onRetry={reload} />;
  if (state.status === "stale")
    return (
      <ChartState kind="stale" message={`刷新失败，显示的是 ${clock(state.at)} 的数据`} onRetry={reload}>
        <WidgetContent widget={widget} data={state.data} onClearFilters={onClearFilters} onSetTarget={onSetTarget} inlineNote={inlineNote} />
      </ChartState>
    );
  return <WidgetContent widget={widget} data={state.data} onClearFilters={onClearFilters} onSetTarget={onSetTarget} inlineNote={inlineNote} />;
}
