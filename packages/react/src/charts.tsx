"use client";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import * as echarts from "echarts";
import { FONT_SIZE_PRESETS, useAdminTheme } from "./theme.tsx";
import { ChartState } from "./chart-state.tsx";
import { resolveVizTokens } from "./chart-options.ts";
import { chartColors, type ChartColors } from "./viz-palette.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

export type AdminChartProps = {
  option: echarts.EChartsOption;
  label: string;
  visible?: boolean;
  height?: number;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  onRetry?: () => void;
  /** Filters left nothing: 「筛选后没有数据」 + 「清空筛选」 (`onClearFilters`) instead of the plain empty state. */
  noMatch?: boolean;
  onClearFilters?: () => void;
  /** The chart uses data the viewer cannot see: lock + this reason (true = default text), never a 0 chart. */
  forbidden?: boolean | string;
  /** Refresh failed: keep this chart on screen under an attention strip with this text (「刷新失败，显示的是 14:05 的数据」). */
  stale?: string;
  /** Realtime panel (e.g. 3 s refresh): no update animation, data merged into the live instance. */
  live?: boolean;
  /** Accessible data view rendered under the chart ("查看数据"). Required when colours alone
   *  cannot carry the reading (categorical slots under 3:1 on white — see viz-palette.ts). */
  table?: { columns: readonly string[]; rows: readonly (readonly (string | number | null)[])[] };
};

/**
 * Theme from the palette (审阅 06): every colour comes from `chartColors(palette)` — gridlines = line
 * colour 62% on the panel, labels note / secondary, tooltip = panel colour with the popover shadow and
 * radius 8, legend top-left with 10 × 10 rounded squares, bars with a 4px top radius, ≤ 32px wide and a
 * 42% gap, hover band = body text 4.5% (dark 8%). Re-registered when the palette or mode changes.
 */
function registerAdminTheme(colors: ChartColors, scale: number, key: string) {
  const label = { color: colors.note, fontSize: 12 * scale, margin: 10 };
  const axis = { axisLine: { lineStyle: { color: colors.line } }, axisTick: { show: false }, axisLabel: label, splitLine: { lineStyle: { color: colors.grid } }, nameTextStyle: { color: colors.note, fontSize: 12 * scale } };
  const name = `adminui-${key}-${scale}`;
  echarts.registerTheme(name, {
    color: [...colors.categorical],
    backgroundColor: "transparent",
    textStyle: { color: colors.secondary, fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif", fontSize: 12 * scale },
    legend: { left: 0, top: 0, textStyle: { color: colors.secondary, fontSize: 12 * scale }, itemWidth: 10, itemHeight: 10, itemGap: 16, icon: "roundRect", inactiveColor: `${colors.note}73` },
    tooltip: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: colors.text, fontSize: 12 * scale },
      extraCssText: "border-radius:8px;box-shadow:var(--aui-pop-shadow, 0 12px 32px rgba(0,0,0,.14));",
      axisPointer: { lineStyle: { color: colors.note, type: "dashed", width: 1 }, shadowStyle: { color: colors.hover } },
    },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false }, splitNumber: 4 },
    timeAxis: { ...axis, splitLine: { show: false } },
    logAxis: { ...axis, axisLine: { show: false } },
    bar: { itemStyle: { borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32, barCategoryGap: "42%" },
    line: { symbol: "circle", symbolSize: 6, lineStyle: { width: 2 } },
    visualMap: { textStyle: { color: colors.note } },
  });
  return name;
}

function scaleOptionFonts(value: unknown, scale: number): unknown {
  if (Array.isArray(value)) return value.map((item) => scaleOptionFonts(item, scale));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, key === "fontSize" && typeof item === "number" ? item * scale : scaleOptionFonts(item, scale)]));
}

/**
 * Lazy-import this subpath; the root entry never loads ECharts. One instance per mount: created when
 * the container first has a size (hidden tabs do not init blank), updated with
 * replaceMerge:['series'] so polling keeps zoom/legend state and does not replay the entry
 * animation, rebuilt only when light/dark changes. Host owns metric semantics; option builders for
 * the DASHBOARDS.md templates live in this subpath too.
 */
export function AdminChart({
  option,
  label,
  visible = true,
  height = 300,
  loading,
  error,
  empty,
  onRetry,
  noMatch,
  onClearFilters,
  forbidden,
  stale,
  live = false,
  table,
}: AdminChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const latest = useRef({ option, label, live });
  latest.current = { option, label, live };
  const { mode, fontSize, motionEnabled, palette } = useAdminTheme();
  // One colour set per palette + mode: the dark palette's primary is already lifted for dark panels,
  // so bars, funnels, bullets and sparklines are the same green (审阅 06).
  const colors = useMemo(() => chartColors(palette), [palette]);
  const paint = useRef(colors);
  paint.current = colors;
  const themeKey = `${palette.id}-${mode}-${palette.primary.slice(1)}`;
  const fontScale = FONT_SIZE_PRESETS.find((preset) => preset.id === fontSize)!.scale;
  const showChart = !loading && !error && !empty && !noMatch && !forbidden;
  const motion = useRef(motionEnabled);
  motion.current = motionEnabled;

  const full = () => {
    const { option: o, label: l, live: isLive } = latest.current;
    return {
      ...resolveVizTokens(scaleOptionFonts(o, fontScale) as echarts.EChartsOption, paint.current),
      animation: isLive || !motion.current ? false : (o.animation ?? true),
      aria: { enabled: true, label: { description: l }, ...o.aria },
    } as echarts.EChartsOption;
  };

  useEffect(() => {
    const node = el.current;
    if (!showChart || !node) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const ensure = () => {
      if (chart.current || node.clientWidth === 0 || node.clientHeight === 0) return;
      chart.current = echarts.init(node, registerAdminTheme(paint.current, fontScale, themeKey));
      chart.current.setOption(full(), { notMerge: true });
    };
    const observer = new ResizeObserver(([entry]) => {
      const nw = Math.round(entry?.contentRect.width ?? 0);
      const nh = Math.round(entry?.contentRect.height ?? 0);
      if (Math.abs(nw - w) < 2 && Math.abs(nh - h) < 2) return; // ignore scrollbar jitter
      w = nw;
      h = nh;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        ensure();
        chart.current?.resize();
      });
    });
    observer.observe(node);
    ensure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      chart.current?.dispose();
      chart.current = null;
    };
    // Rebuild only for theme or when the canvas element (re)appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey, fontSize, showChart]);

  useEffect(() => {
    chart.current?.setOption(full(), { replaceMerge: ["series"], lazyUpdate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option, label, live, fontSize, palette.primary]);

  useEffect(() => {
    if (visible) chart.current?.resize();
  }, [visible]);

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
      {table && (
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
      )}
    </div>
  );
}
export type { EChartsOption } from "echarts";
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
