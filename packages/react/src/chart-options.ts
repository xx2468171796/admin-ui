/**
 * ECharts option builders for the dashboard templates in DASHBOARDS.md. Pure functions: no echarts
 * runtime import, so they are unit-testable and tree-shake away when unused. Every user-supplied
 * string that reaches an HTML tooltip is escaped (ECharts does not escape custom formatters).
 */
import type { EChartsOption, LineSeriesOption } from "echarts";
import {
  formatNumber,
  funnelLimits,
  judgeAgainstBand,
  Z95,
  Z998,
  type BandVerdict,
} from "./dashboard-core.ts";
import { resolveVizToken, VIZ_BRAND, vizBrandStep, vizCategory, vizColors, VIZ_CATEGORY_HUES, VIZ_SURFACE, VIZ_TEXT, type ChartColors, type VizMode } from "./viz-palette.ts";
import { formatDuration, isDurationUnit } from "./duration-format.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

const SINGLE_HUE = new Set(["line", "bar", "scatter", "effectScatter", "pictorialBar"]);

/**
 * Swap the chart tokens for live colours: VIZ_BRAND (+ alpha, or `vizBrandStep(i)` = panel → primary),
 * `vizCategory(i)` (the palette's option hues, past the eighth = 「其他」), VIZ_OTHER, `vizOptionColor(hue)`,
 * VIZ_TEXT / VIZ_SECONDARY / VIZ_NOTE / VIZ_TRACK / VIZ_SURFACE. AdminChart passes `chartColors(palette)`.
 * A lone line / bar series without its own colours follows the brand; otherwise the option gets the
 * categorical order as its `color`.
 */
export function resolveVizTokens(option: EChartsOption, palette: ChartColors): EChartsOption {
  const primary = palette.brand;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (value.startsWith(VIZ_BRAND)) {
        const rest = value.slice(VIZ_BRAND.length);
        if (rest.startsWith("-step:")) return palette.sequential[Math.min(12, Math.max(0, Number(rest.slice(6)) || 0))]!;
        return primary + rest;
      }
      return value.startsWith("aui:") ? (resolveVizToken(value, palette) ?? value) : value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
  };
  const resolved = walk(option) as EChartsOption;
  const series = Array.isArray(resolved.series) ? resolved.series : resolved.series ? [resolved.series] : [];
  const lone = series.length === 1 && SINGLE_HUE.has(String(series[0]?.type ?? "line"));
  if (resolved.color) return resolved;
  return { ...resolved, color: lone ? [primary] : [...palette.categorical] };
}

export const escapeHtml = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Point = readonly [number, number | null];
export type SeriesInput = { id: string; name: string; points: readonly Point[] };
export type Annotation =
  | { at: number; label: string }
  | { from: number; to: number; label: string };

const fmt = (v: unknown, digits: number, unit: string) =>
  typeof v === "number" && Number.isFinite(v) ? (isDurationUnit(unit) ? formatDuration(v) : `${formatNumber(v, { digits })}${unit}`) : "—";

/** Insert explicit nulls where consecutive timestamps are further apart than 1.5× the expected step,
 *  so the line breaks at missing data instead of drawing a straight bridge (ECharts only breaks on null). */
export function withGaps(points: readonly Point[], expectedIntervalMs?: number): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (!expectedIntervalMs) return sorted;
  const out: Point[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev && p[0] - prev[0] > expectedIntervalMs * 1.5) out.push([prev[0] + expectedIntervalMs, null]);
    out.push(p);
  }
  return out;
}

function annotationMarks(annotations: readonly Annotation[] | undefined, mode: VizMode): Pick<LineSeriesOption, "markLine" | "markArea"> {
  if (!annotations?.length) return {};
  const muted = vizColors(mode).status.neutral;
  const lines = annotations.filter((a): a is { at: number; label: string } => "at" in a);
  const areas = annotations.filter((a): a is { from: number; to: number; label: string } => "from" in a);
  return {
    ...(lines.length && {
      markLine: {
        symbol: "none",
        silent: false,
        lineStyle: { color: muted, type: "dashed" as const, width: 1 },
        // Horizontal label above the line end: rotated CJK text along a vertical line is hard to read.
        label: { formatter: "{b}", color: muted, fontSize: 12, position: "end" as const, rotate: 0 },
        data: lines.map((a) => ({ xAxis: a.at, name: a.label })),
      },
    }),
    ...(areas.length && {
      markArea: {
        silent: true,
        itemStyle: { color: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" },
        label: { color: muted, fontSize: 12, position: "insideTop" as const },
        data: areas.map((a) => [{ xAxis: a.from, name: a.label }, { xAxis: a.to }] as [{ xAxis: number; name: string }, { xAxis: number }]),
      },
    }),
  };
}

/** Axis tooltip that lists each series once (main + dashed tail share a name), escaped, sorted desc. */
function axisTooltip(digits: number, unit: string) {
  return (params: unknown) => {
    const list = (Array.isArray(params) ? params : [params]) as {
      seriesName: string;
      value: unknown;
      color?: unknown;
      axisValueLabel?: string;
    }[];
    const seen = new Map<string, { color: string; v: number | null }>();
    for (const p of list) {
      const v = Array.isArray(p.value) ? p.value[1] : p.value;
      const num = typeof v === "number" && Number.isFinite(v) ? v : null;
      const prev = seen.get(p.seriesName);
      if (!prev || (prev.v === null && num !== null)) seen.set(p.seriesName, { color: typeof p.color === "string" ? p.color : "", v: num });
    }
    // Same layout as tooltipHtml (chart-options-kinds.ts): swatch line + name + right-aligned value.
    const rows = [...seen.entries()]
      .sort((a, b) => (b[1].v ?? -Infinity) - (a[1].v ?? -Infinity))
      .map(([name, { color, v }]) => `<div class="aui-vz-tt-row"><i data-line="" style="background:${escapeHtml(color)}"></i><span>${escapeHtml(name)}</span><b>${escapeHtml(fmt(v, digits, unit))}</b></div>`);
    return `<div class="aui-vz-tt"><div class="aui-vz-tt-head">${escapeHtml(list[0]?.axisValueLabel ?? "")}</div>${rows.join("")}</div>`;
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const DAY_MS = 86_400_000;
/**
 * Time-axis tick label in the browser's local time. ECharts' default labels a day boundary with the
 * bare day-of-month ("24"), which reads like an hour. Spans under a day show HH:mm; longer spans show
 * MM-dd at midnight and HH:mm between; a week or more shows MM-dd only.
 */
export function timeAxisLabel(value: number, spanMs: number): string {
  const d = new Date(value);
  const date = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  // A few minutes of 3 s points: every HH:mm label would read the same minute.
  if (spanMs > 0 && spanMs < 15 * 60_000) return `${time}:${pad2(d.getSeconds())}`;
  if (spanMs >= 7 * DAY_MS) return date;
  if (spanMs >= DAY_MS && d.getHours() === 0 && d.getMinutes() === 0) return date;
  return time;
}

/** Line points; values whose neighbours are both missing become visible dots. */
function markIsolated(pts: readonly (readonly [number, number | null])[]) {
  return pts.map((p, i) => {
    const alone = p[1] != null && (i === 0 || pts[i - 1]![1] == null) && (i === pts.length - 1 || pts[i + 1]![1] == null);
    return alone ? { value: [...p], symbol: "circle", symbolSize: 6 } : [...p];
  });
}

function timeSpan(series: readonly SeriesInput[]): number {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series)
    for (const [t] of s.points) {
      if (t < min) min = t;
      if (t > max) max = t;
    }
  return max > min ? max - min : 0;
}

/**
 * Time series for trend / realtime panels. Gaps break the line; with `inProgress` the last bucket is
 * drawn dashed (an unfinished period otherwise looks like a crash); annotations mark releases,
 * campaigns, incidents, metric-definition changes. `live` disables update animation (3 s refresh).
 */
export function timeSeriesOption(input: {
  series: readonly SeriesInput[];
  mode?: VizMode;
  unit?: string;
  digits?: number;
  expectedIntervalMs?: number;
  inProgress?: boolean;
  annotations?: readonly Annotation[];
  area?: boolean;
  live?: boolean;
  yMin?: number | "dataMin";
  /** Let the axis float around the data with round ticks (realtime counts that never approach 0). */
  scale?: boolean;
}): EChartsOption {
  const { mode = "light", unit = "", digits = 0, inProgress = false, live = false } = input;
  // A daily (or coarser) series labels dates even over a few days, never 00:00 / 12:00 ticks.
  const daily = (input.expectedIntervalMs ?? 0) >= DAY_MS;
  const span = daily ? Math.max(timeSpan(input.series), 7 * DAY_MS) : timeSpan(input.series);
  const series: NonNullable<EChartsOption["series"]> = [];
  input.series.slice(0, VIZ_CATEGORY_HUES.length).forEach((s, i) => {
    // One series follows the brand colour; several need the colour-blind-checked categorical order.
    const color = input.series.length === 1 ? VIZ_BRAND : vizCategory(i);
    const pts = withGaps(s.points, input.expectedIntervalMs);
    const split = inProgress && pts.length > 1 ? pts.length - 1 : pts.length;
    series.push({
      id: s.id,
      name: s.name,
      type: "line",
      // A point with no neighbour on either side draws no line at all, so it gets its own dot.
      data: markIsolated(pts.slice(0, split)),
      showSymbol: true,
      symbol: "none",
      connectNulls: false,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      ...(input.area && input.series.length === 1 && { areaStyle: { color, opacity: 0.08 } }),
      ...(pts.length > 600 && { sampling: "lttb" as const }),
      ...(i === 0 ? annotationMarks(input.annotations, mode) : {}),
    });
    if (split < pts.length)
      series.push({
        id: `${s.id}__tail`,
        name: s.name,
        type: "line",
        data: pts.slice(split - 1).map((p) => [...p]),
        showSymbol: false,
        lineStyle: { width: 2, color, type: [4, 4] },
        itemStyle: { color },
      });
  });
  return {
    animation: !live,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", confine: true, formatter: axisTooltip(digits, unit) as never },
    legend: input.series.length > 1 ? { top: 0, right: 0, data: input.series.map((s) => s.name) } : { show: false },
    xAxis: {
      type: "time",
      // Overlapping labels are dropped rather than drawn on top of each other (narrow phones).
      axisLabel: { hideOverlap: true, formatter: ((v: number) => timeAxisLabel(v, span)) as never },
    },
    yAxis: {
      type: "value",
      min: input.yMin,
      scale: input.scale,
      axisLabel: { formatter: (v: number) => (isDurationUnit(unit) ? formatDuration(v) : formatNumber(v, { compact: true })) },
      name: (!isDurationUnit(unit) && unit) || undefined,
    },
    series,
  };
}

const PCT = (ratio: number) => ratio * 100;

/**
 * An observed ratio (hit rate, conversion, payout ratio …) over time against theory ± z·σ/√N_eff. Points are coloured by
 * verdict (normal / watch / alert / insufficient); the band narrows as samples grow. No fixed %.
 * `points[].n` is the effective sample size behind that point (e.g. rolling 30-day N_eff).
 */
export function toleranceBandOption(input: {
  points: readonly { t: number; actual: number | null; n: number }[];
  theoretical: number;
  sigma: number;
  minN?: number;
  z?: number;
  mode?: VizMode;
  label?: string;
  annotations?: readonly Annotation[];
}): EChartsOption {
  const { theoretical, sigma, minN = 1000, z = Z95, mode = "light", label = "实际比率" } = input;
  const c = vizColors(mode);
  const pts = [...input.points].sort((a, b) => a.t - b.t);
  const lower: [number, number | null][] = [];
  const width: [number, number | null][] = [];
  const verdicts: BandVerdict[] = [];
  for (const p of pts) {
    const ok = p.n >= minN && p.n > 0;
    const half = ok ? (z * sigma) / Math.sqrt(p.n) : null;
    lower.push([p.t, half === null ? null : PCT(theoretical - half)]);
    width.push([p.t, half === null ? null : PCT(2 * half)]);
    verdicts.push(judgeAgainstBand(p.actual, theoretical, sigma, p.n, minN));
  }
  const colorOf = (v: BandVerdict) =>
    v.level === "alert" ? c.status.bad : v.level === "watch" ? c.status.warning : v.level === "insufficient" ? c.status.neutral : VIZ_BRAND;
  const word = { normal: "正常波动", watch: "偏离，留意", alert: "越过 99.8% 控制线", insufficient: "样本不足，不判断" } as const;
  return {
    animation: false,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, right: 0, data: [label, "理论值", `${z === Z95 ? "95%" : `z=${z}`} 容差带`] },
    tooltip: {
      trigger: "axis",
      confine: true,
      formatter: ((params: { dataIndex: number; axisValueLabel: string }[]) => {
        const i = params[0]?.dataIndex ?? 0;
        const p = pts[i];
        const v = verdicts[i];
        if (!p || !v) return "";
        const lo = lower[i]?.[1];
        const w = width[i]?.[1];
        const band = lo != null && w != null ? `${lo.toFixed(2)}% ~ ${(lo + w).toFixed(2)}%` : "—";
        return [
          escapeHtml(params[0]?.axisValueLabel ?? ""),
          `${escapeHtml(label)}：<b>${p.actual == null ? "—" : `${PCT(p.actual).toFixed(2)}%`}</b>`,
          `理论值：${PCT(theoretical).toFixed(2)}%`,
          `容差带：${band}`,
          `有效样本：${formatNumber(p.n, { compact: true })}`,
          `判定：${word[v.level]}${v.z != null ? `（z=${v.z.toFixed(2)}）` : ""}`,
        ].join("<br/>");
      }) as never,
    },
    xAxis: {
      type: "time",
      axisLabel: { hideOverlap: true, formatter: ((v: number) => timeAxisLabel(v, pts.length > 1 ? pts[pts.length - 1]!.t - pts[0]!.t : 0)) as never },
    },
    yAxis: { type: "value", scale: true, axisLabel: { formatter: "{value}%" } },
    series: [
      {
        id: "band-lower",
        type: "line",
        data: lower,
        stack: "band",
        stackStrategy: "all",
        lineStyle: { opacity: 0 },
        showSymbol: false,
        silent: true,
        tooltip: { show: false },
      },
      {
        id: "band-width",
        name: `${z === Z95 ? "95%" : `z=${z}`} 容差带`,
        type: "line",
        data: width,
        stack: "band",
        stackStrategy: "all",
        lineStyle: { opacity: 0 },
        areaStyle: { color: VIZ_BRAND, opacity: mode === "dark" ? 0.22 : 0.14 },
        // Legend swatch must look like the band, not like the actual line.
        itemStyle: { color: `${VIZ_BRAND}${mode === "dark" ? "59" : "3d"}` },
        showSymbol: false,
        silent: true,
      },
      {
        id: "theory",
        name: "理论值",
        type: "line",
        data: pts.map((p) => [p.t, PCT(theoretical)]),
        showSymbol: false,
        lineStyle: { type: "dashed", width: 1.5, color: c.status.neutral },
        itemStyle: { color: c.status.neutral },
        silent: true,
      },
      {
        id: "actual",
        name: label,
        type: "line",
        connectNulls: false,
        lineStyle: { width: 2, color: VIZ_BRAND },
        itemStyle: { color: VIZ_BRAND },
        symbolSize: 7,
        data: pts.map((p, i) => ({
          value: [p.t, p.actual == null ? null : PCT(p.actual)],
          itemStyle: { color: colorOf(verdicts[i]!), borderColor: colorOf(verdicts[i]!) },
          symbol: verdicts[i]!.level === "insufficient" ? "emptyCircle" : "circle",
        })),
        ...annotationMarks(input.annotations, mode),
      },
    ],
  };
}

/**
 * Funnel plot (Spiegelhalter 2005): x = effective sample size (log), y = observed ratio, control
 * limits at 95% and 99.8%. Replaces ratio league tables where the smallest groups fill both ends.
 * Only points outside the outer limit are labelled; items under `minN` are drawn hollow and grey.
 */
export function funnelPlotOption(input: {
  items: readonly { name: string; n: number; value: number }[];
  theoretical: number;
  sigma: number;
  minN?: number;
  mode?: VizMode;
  xLabel?: string;
  yLabel?: string;
}): EChartsOption {
  const { theoretical, sigma, minN = 1000, mode = "light", xLabel = "有效样本量", yLabel = "实际比率" } = input;
  const c = vizColors(mode);
  const ns = input.items.map((i) => i.n).filter((n) => n > 0);
  const nMin = Math.max(Math.min(minN, ...ns), 1);
  const nMax = Math.max(...ns, nMin * 10);
  const [inner, outer] = funnelLimits(theoretical, sigma, nMin, nMax, 60, [Z95, Z998]);
  const line = (id: string, name: string, data: readonly (readonly [number, number])[], dashed: boolean) => ({
    id,
    name,
    type: "line" as const,
    data: data.map(([n, v]) => [n, PCT(v)]),
    showSymbol: false,
    silent: true,
    tooltip: { show: false },
    lineStyle: { width: 1, color: c.status.neutral, type: dashed ? ("dashed" as const) : ("solid" as const) },
    itemStyle: { color: c.status.neutral },
  });
  const verdicts = input.items.map((i) => judgeAgainstBand(i.value, theoretical, sigma, i.n, minN));
  // Y range from judged items (+ the outer limit at the largest n), not from the wide small-n
  // limits or grey tiny-sample outliers — otherwise the informative region is squashed flat.
  const judged = input.items.filter((_, i) => verdicts[i]!.level !== "insufficient").map((i) => i.value);
  const outerAtMax = (Z998 * sigma) / Math.sqrt(nMax);
  const lo = Math.min(theoretical - 2 * outerAtMax, ...judged);
  const hi = Math.max(theoretical + 2 * outerAtMax, ...judged);
  const pad = Math.max((hi - lo) * 0.15, 0.002);
  // Snap to a readable step so the end ticks are round numbers, not "118.4%".
  const span = PCT(hi - lo + 2 * pad);
  // Smallest round step that keeps it to ≤ 6 intervals (a 230% range gave 23 stacked labels).
  const step = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => span / s <= 6) ?? 1000;
  const yMin = Math.floor(PCT(lo - pad) / step) * step;
  const yMax = Math.ceil(PCT(hi + pad) / step) * step;
  const colorOf = (v: BandVerdict) =>
    v.level === "alert" ? c.status.bad : v.level === "watch" ? c.status.warning : v.level === "insufficient" ? c.status.neutral : VIZ_BRAND;
  return {
    animation: false,
    grid: { left: 8, right: 24, top: 36, bottom: 28, containLabel: true },
    legend: { top: 0, right: 0, data: ["95% 控制线", "99.8% 控制线"] },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: ((p: { seriesId: string; dataIndex: number }) => {
        if (p.seriesId !== "items") return "";
        const item = input.items[p.dataIndex];
        const v = verdicts[p.dataIndex];
        if (!item || !v) return "";
        return [
          `<b>${escapeHtml(item.name)}</b>`,
          `${escapeHtml(yLabel)}：${PCT(item.value).toFixed(2)}%`,
          `${escapeHtml(xLabel)}：${formatNumber(item.n, { compact: true })}`,
          v.z == null ? "样本不足，不判断" : `z=${v.z.toFixed(2)}`,
        ].join("<br/>");
      }) as never,
    },
    xAxis: { type: "log", name: xLabel, nameLocation: "middle", nameGap: 24, axisLabel: { formatter: (v: number) => formatNumber(v, { compact: true }) } },
    yAxis: { type: "value", min: yMin, max: yMax, interval: step, axisLabel: { formatter: (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%` } },
    series: [
      line("l95-up", "95% 控制线", inner!.upper, true),
      line("l95-lo", "95% 控制线", inner!.lower, true),
      line("l998-up", "99.8% 控制线", outer!.upper, false),
      line("l998-lo", "99.8% 控制线", outer!.lower, false),
      {
        id: "theory",
        type: "line",
        data: [[nMin, PCT(theoretical)], [nMax, PCT(theoretical)]],
        showSymbol: false,
        silent: true,
        tooltip: { show: false },
        lineStyle: { width: 1.5, color: c.status.neutral, type: "dotted" },
      },
      {
        id: "items",
        name: yLabel,
        type: "scatter",
        symbolSize: 9,
        data: input.items.map((item, i) => {
          const v = verdicts[i]!;
          return {
            value: [Math.max(item.n, 1), PCT(item.value)],
            name: item.name,
            symbol: v.level === "insufficient" ? "emptyCircle" : "circle",
            itemStyle: { color: colorOf(v), borderColor: colorOf(v), opacity: v.level === "normal" ? 0.75 : 1 },
            label: { show: v.level === "alert", formatter: "{b}", position: "right" as const, fontSize: 12, color: mode === "dark" ? "#e5e7eb" : "#182230", textBorderWidth: 0 },
          };
        }),
      },
    ],
  };
}

/**
 * Cohort retention heatmap: rows = cohort (registration period), columns = period since start.
 * Unreached cells are "-" (not drawn) so the triangle shape shows; colour scale is fixed 0–max of
 * the non-first columns (period 0 is always 100% and would wash the scale out).
 */
export function cohortHeatmapOption(input: {
  cohorts: readonly string[];
  periods: readonly string[];
  /** Ratios 0..1; null = period not reached yet. */
  values: readonly (readonly (number | null)[])[];
  mode?: VizMode;
  digits?: number;
}): EChartsOption {
  const { mode = "light", digits = 1 } = input;
  let max = 0;
  const data: { value: [number, number, number | "-"]; label: { color: string } }[] = [];
  input.values.forEach((row) =>
    row.forEach((v, x) => {
      if (v != null && x > 0) max = Math.max(max, v * 100);
    }),
  );
  max = Math.max(1, Math.ceil(max));
  input.values.forEach((row, y) =>
    input.periods.forEach((_, x) => {
      const v = row[x];
      const pct = v == null ? "-" : Math.round(v * 100 * 10 ** digits) / 10 ** digits;
      // Cells run panel → primary (dark mode too): body text reads on all of them; only the deepest light-mode cells (> 72%) flip to white.
      const deep = mode !== "dark" && typeof pct === "number" && (x === 0 || pct / max > 0.72);
      data.push({ value: [x, y, pct], label: { color: deep ? "#ffffff" : VIZ_TEXT } });
    }),
  );
  return {
    animation: false,
    grid: { left: 8, right: 8, top: 28, bottom: 48, containLabel: true },
    tooltip: {
      confine: true,
      formatter: ((p: { value: [number, number, number | "-"] }) => {
        const [x, y, v] = p.value;
        return `${escapeHtml(input.cohorts[y] ?? "")} · ${escapeHtml(input.periods[x] ?? "")}<br/><b>${v === "-" ? "未到期" : `${v}%`}</b>`;
      }) as never,
    },
    // Unreached cells show a faint band per mode; ECharts' default split colours are light-theme greys.
    xAxis: { type: "category", position: "top", data: [...input.periods], axisTick: { show: false }, axisLine: { show: false } },
    yAxis: {
      type: "category",
      inverse: true,
      data: [...input.cohorts],
      axisTick: { show: false },
      axisLine: { show: false },
      splitArea: { show: true, areaStyle: { color: mode === "dark" ? ["rgba(255,255,255,0.035)", "rgba(255,255,255,0)"] : ["rgba(15,23,42,0.03)", "rgba(15,23,42,0)"] } },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemHeight: 120,
      itemWidth: 10,
      text: [`${max}%`, "0%"],
      inRange: { color: [0, 4, 8, 12].map(vizBrandStep) },
      // Period 0 (always 100%) sits above the scale on purpose; draw it at the darkest step, not grey.
      outOfRange: { color: [vizBrandStep(12)] },
    },
    series: [
      {
        id: "cohort",
        type: "heatmap",
        data,
        label: { show: true, fontSize: 12, formatter: ((p: { value: [number, number, number | "-"] }) => (p.value[2] === "-" ? "" : `${p.value[2]}`)) as never },
        itemStyle: { borderColor: VIZ_SURFACE, borderWidth: 2 },
        emphasis: { itemStyle: { borderColor: vizColors(mode).status.neutral } },
      },
    ],
  };
}
