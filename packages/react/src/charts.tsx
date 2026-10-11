"use client";
import { useMemo, useRef, type CSSProperties } from "react";
import type { EChartsOption, EChartsType } from "echarts";
import type { AdminChartPropsOf } from "./chart-props.ts";
import { FONT_SIZE_PRESETS, useAdminTheme } from "./theme.tsx";
import { ChartState } from "./chart-state.tsx";
import { resolveVizTokens } from "./chart-options.ts";
import { chartColors } from "./viz-palette.ts";
import { useChartInstance } from "./chart-instance.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

/** ECharts-typed AdminChart props (the fields are documented in chart-props.ts). */
export type AdminChartProps = AdminChartPropsOf<EChartsOption, EChartsType>;

function scaleOptionFonts(value: unknown, scale: number): unknown {
  if (Array.isArray(value)) return value.map((item) => scaleOptionFonts(item, scale));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, key === "fontSize" && typeof item === "number" ? item * scale : scaleOptionFonts(item, scale)]));
}

function ChartTable({ table }: { table: NonNullable<AdminChartProps["table"]> }) {
  return (
    <details className="aui-chart-table">
      <summary>查看数据</summary>
      <div className="aui-chart-table-scroll">
        <table>
          <thead>
            <tr>{table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j} data-numeric={typeof cell === "number" || undefined}>{cell ?? "—"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Lazy-import this subpath (or use the root `LazyAdminChart`); the root entry never loads ECharts. One instance per
 * mount (chart-instance.ts): created when the container first has a size, updated with replaceMerge:['series'] so
 * polling keeps zoom/legend state and does not replay the entry animation, rebuilt only when the theme changes.
 * ECharts is `echarts/core` with a fixed registration (chart-registry.ts); `registerAdminCharts` adds more.
 * Host owns metric semantics; option builders for the DASHBOARDS.md templates live in this subpath too.
 */
export function AdminChart(props: AdminChartProps) {
  const { option, label, visible = true, height = 300, loading, error, empty, onRetry, noMatch, onClearFilters, forbidden, stale, live = false, table } = props;
  const el = useRef<HTMLDivElement>(null);
  const { mode, fontSize, motionEnabled, palette } = useAdminTheme();
  // One colour set per palette + mode: the dark palette's primary is already lifted for dark panels,
  // so bars, funnels, bullets and sparklines are the same green (审阅 06).
  const colors = useMemo(() => chartColors(palette), [palette]);
  const fontScale = FONT_SIZE_PRESETS.find((preset) => preset.id === fontSize)?.scale ?? 1;
  const showChart = !loading && !error && !empty && !noMatch && !forbidden;
  const build = (): EChartsOption => ({
    ...resolveVizTokens(scaleOptionFonts(option, fontScale) as EChartsOption, colors),
    animation: live || !motionEnabled ? false : (option.animation ?? true),
    aria: { enabled: true, label: { description: label }, ...option.aria },
  });
  useChartInstance({
    el,
    build,
    label,
    show: showChart,
    visible,
    colors,
    themeKey: `${palette.id}-${mode}-${palette.primary.slice(1)}`,
    fontScale,
    deps: [option, label, live, fontSize, palette.primary],
    onEvents: props.onEvents,
    onPointClick: props.onPointClick,
    ref: props.ref,
  });

  // Every state is as tall as the chart (审阅 06): nothing below jumps when the data arrives.
  if (loading) return <ChartState kind="loading" height={height} label={label} />;
  if (forbidden) return <ChartState kind="forbidden" height={height} message={typeof forbidden === "string" ? forbidden : undefined} />;
  if (error) return <ChartState kind="error" height={height} message={error} onRetry={onRetry} />;
  if (noMatch) return <ChartState kind="no-match" height={height} onClearFilters={onClearFilters} />;
  if (empty) return <ChartState kind="empty" height={height} />;
  const body = (
    <div ref={el} role="img" aria-label={label} className="aui-chart" style={{ height: stale ? Math.max(40, height - 30) : height } as CSSProperties} />
  );
  return (
    <div className="aui-chart-wrap">
      {stale ? <ChartState kind="stale" height={height} message={stale} onRetry={onRetry}>{body}</ChartState> : body}
      {table && <ChartTable table={table} />}
    </div>
  );
}
export type { EChartsOption } from "echarts";
export type { AdminChartHandle } from "./chart-instance.ts";
export type { AdminChartEvent, AdminChartEventHandler, AdminChartPoint } from "./chart-events.ts";
export { registerAdminCharts, type AdminChartExtension } from "./chart-registry.ts";
export {
  timeSeriesOption,
  toleranceBandOption,
  funnelPlotOption,
  cohortHeatmapOption,
  withGaps,
  escapeHtml,
  timeAxisLabel,
} from "./chart-options.ts";
export type { SeriesInput, Annotation } from "./chart-options.ts";
// bt/dashboards
export { targetBarOption, type TargetBarInput } from "./chart-options-targets.ts";
// 审阅 06：柱 / 条形、环、堆叠 + 统一提示框；颜色 token 用 AdminChart 换成当前色卡
export { barOption, donutOption, donutSlices, stackedBarOption, stackSeries, tooltipHtml, chartValueText, CHART_VALUE_LABEL, type BarInput, type DonutInput, type DonutItem, type StackedBarInput, type StackedSeries, type TooltipRow } from "./chart-options-kinds.ts";
export { resolveVizTokens } from "./chart-options.ts";
export { chartFormatter } from "./chart-formatter.ts";
