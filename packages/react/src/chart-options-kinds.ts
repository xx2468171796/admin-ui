/**
 * Category chart builders (审阅 06 第 3 项): bar / horizontal bar (ranking), donut (≤ 5 slices +
 * 「其他」, total in the middle), stacked bar (1px gaps, only the top segment rounded, tooltip with the total)
 * and the shared tooltip layout (swatch + name + right-aligned tabular value + unit). Pure functions, no
 * echarts runtime import; colours are tokens (VIZ_BRAND, vizCategory, VIZ_OTHER, vizOptionColor) that
 * AdminChart resolves with the live palette, so one builder serves every palette and dark mode.
 */
import type { EChartsOption } from "echarts";
import { formatNumber } from "./dashboard-core.ts";
import { VIZ_BRAND, VIZ_CATEGORY_HUES, VIZ_NOTE, VIZ_OTHER, VIZ_SECONDARY, VIZ_SURFACE, VIZ_TEXT, vizCategory } from "./viz-palette.ts";
import { escapeHtml } from "./chart-options.ts";
import { formatDuration, isDurationUnit } from "./duration-format.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Value text in charts: 「150万」 from 1 万 up, thousands separators below. */
export function chartValueText(value: number | null | undefined, digits = 0): string {
  if (!finite(value)) return "—";
  return formatNumber(value, { digits, compact: Math.abs(value) >= 1e4 });
}

export type TooltipRow = { color?: string; name: string; value: number | null | undefined; unit?: string; digits?: number; line?: boolean; note?: string };

/**
 * Tooltip HTML shared by every builder (escaped): a head line, one row per series — swatch (a short line
 * for line / target series), name, right-aligned tabular value + unit — an optional 「合计」 / 「完成」 row
 * and a grey note. Styles: `.aui-vz-tt` in dashboard.css (the tooltip DOM lives inside `.adminui`).
 */
export function tooltipHtml(input: { head?: string; chip?: string; rows: readonly TooltipRow[]; total?: { label: string; text: string }; note?: string }): string {
  const rows = input.rows.map((r) => {
    const swatch = r.color ? `<i${r.line ? ' data-line=""' : ""} style="background:${escapeHtml(r.color)}"></i>` : "";
    const value = isDurationUnit(r.unit) ? formatDuration(r.value) : `${chartValueText(r.value, r.digits)}${finite(r.value) && r.unit ? ` ${escapeHtml(r.unit)}` : ""}`;
    return `<div class="aui-vz-tt-row">${swatch}<span>${escapeHtml(r.name)}</span><b>${escapeHtml(value)}${r.note ? ` <small>${escapeHtml(r.note)}</small>` : ""}</b></div>`;
  });
  const head = input.head ? `<div class="aui-vz-tt-head">${escapeHtml(input.head)}${input.chip ? ` <span class="aui-vz-tt-chip">${escapeHtml(input.chip)}</span>` : ""}</div>` : "";
  const total = input.total ? `<div class="aui-vz-tt-row" data-total=""><span>${escapeHtml(input.total.label)}</span><b>${escapeHtml(input.total.text)}</b></div>` : "";
  const note = input.note ? `<div class="aui-vz-tt-note">${escapeHtml(input.note)}</div>` : "";
  return `<div class="aui-vz-tt">${head}${rows.join("")}${total}${note}</div>`;
}

const VALUE_LABEL = { fontSize: 11, fontWeight: 500 as const, color: VIZ_SECONDARY, textBorderWidth: 0 };
/** Value labels on bars: 11px, secondary colour, weight 500 (quieter than the axis, 审阅 06). */
export const CHART_VALUE_LABEL = VALUE_LABEL;

export type BarInput = {
  categories: readonly string[];
  /** null = no data for the category → no bar (not a 0 bar). */
  values: readonly (number | null)[];
  /** Series name in the tooltip: the metric (「客户数」), never 「实际」. */
  name?: string;
  unit?: string;
  digits?: number;
  /** Horizontal bars (ranking 「谁本月成交最多」): categories top to bottom, values at the bar end. */
  horizontal?: boolean;
  /** Per-bar colour tokens (e.g. each option's own tag colour `vizOptionColor(hue)`); default one brand colour. */
  colors?: readonly (string | null | undefined)[];
  /** Value labels at the bar ends (default true). */
  labels?: boolean;
  /** Highlight one bar; the others fade (「我」 in a ranking). */
  highlight?: number;
};

/** Plain bars (single series = the brand colour) or a ranking (horizontal). */
export function barOption(input: BarInput): EChartsOption {
  const { categories, values, name = "数量", unit = "", digits = 0, horizontal = false, labels = true } = input;
  const colorAt = (i: number) => {
    const own = input.colors?.[i];
    if (own) return own;
    return input.highlight !== undefined && i !== input.highlight ? `${VIZ_BRAND}59` : VIZ_BRAND;
  };
  const data = categories.map((_, i) => {
    const v = values[i];
    return finite(v) ? { value: v, itemStyle: { color: colorAt(i) } } : "-";
  });
  const category = { type: "category" as const, data: [...categories], axisTick: { show: false }, axisLabel: { interval: 0, hideOverlap: true } };
  const value = { type: "value" as const, min: 0, axisLabel: { formatter: (v: number) => (isDurationUnit(unit) ? formatDuration(v) : chartValueText(v)) } };
  return {
    animation: false,
    grid: { left: 4, right: horizontal ? 48 : 12, top: labels && !horizontal ? 20 : 8, bottom: 4, containLabel: true },
    legend: { show: false },
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: { type: "shadow" },
      formatter: ((params: { dataIndex: number; color?: string }[]) => {
        const i = params[0]?.dataIndex ?? 0;
        return tooltipHtml({ head: categories[i], rows: [{ color: params[0]?.color, name, value: values[i], unit, digits }] });
      }) as never,
    },
    xAxis: horizontal ? { ...value, splitLine: { show: true } } : category,
    yAxis: horizontal ? { ...category, inverse: true, axisLine: { show: false } } : value,
    series: [
      {
        id: "values",
        name,
        type: "bar",
        data,
        barMaxWidth: horizontal ? 20 : 32,
        barCategoryGap: "42%",
        itemStyle: { color: VIZ_BRAND, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
        label: { show: labels, position: horizontal ? "right" : "top", distance: 6, ...VALUE_LABEL, formatter: ((p: { value: number }) => (isDurationUnit(unit) ? formatDuration(p.value) : chartValueText(p.value, digits))) as never },
        emphasis: { disabled: true },
      },
    ],
  };
}

export type DonutItem = { name: string; value: number | null; color?: string };
export type DonutInput = {
  items: readonly DonutItem[];
  unit?: string;
  digits?: number;
  /** Word under the total in the middle (default 「合计」). */
  centerLabel?: string;
  /** Slices before the rest folds into 「其他」 (default 5, the 5th is 「其他」 when there are more). */
  maxSlices?: number;
  /** side = legend with values right of the ring (default); stacked = ring on top, legend below (narrow cards). */
  layout?: "side" | "stacked";
};

/** Slices of a donut: largest first, at most `max` (the last one 「其他」 when there are more), zero / null dropped. */
export function donutSlices(items: readonly DonutItem[], max = 5): { name: string; value: number; color: string; share: number }[] {
  const list = items.filter((i): i is DonutItem & { value: number } => finite(i.value) && i.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((n, i) => n + i.value, 0);
  const keep = list.length > max ? list.slice(0, Math.max(1, max - 1)) : list;
  const rest = list.length > max ? list.slice(keep.length) : [];
  const slices = keep.map((item, i) => ({ name: item.name, value: item.value, color: item.color ?? vizCategory(i) }));
  if (rest.length) slices.push({ name: "其他", value: rest.reduce((n, i) => n + i.value, 0), color: VIZ_OTHER });
  return slices.map((s) => ({ ...s, share: total > 0 ? s.value / total : 0 }));
}

/** Donut for shares (≤ 5 slices + 其他), total in the middle, legend with values on the right. */
export function donutOption(input: DonutInput): EChartsOption {
  const { unit = "", digits = 0, centerLabel = "合计" } = input;
  const slices = donutSlices(input.items, input.maxSlices ?? 5);
  const total = slices.reduce((n, s) => n + s.value, 0);
  const pct = (share: number) => `${formatNumber(share * 100, { digits: 1 })}%`;
  const stacked = input.layout === "stacked";
  const center = stacked ? ["50%", "38%"] : ["28%", "50%"];
  return {
    animation: false,
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: ((p: { dataIndex: number; color?: string }) => {
        const s = slices[p.dataIndex];
        return s ? tooltipHtml({ rows: [{ color: p.color, name: s.name, value: s.value, unit, digits, note: pct(s.share) }] }) : "";
      }) as never,
    },
    legend: {
      ...(stacked ? { orient: "horizontal" as const, left: "center", bottom: 0, itemGap: 12 } : { orient: "vertical" as const, left: "56%", top: "middle", itemGap: 10 }),
      data: slices.map((s) => s.name),
      formatter: ((name: string) => {
        const s = slices.find((x) => x.name === name);
        if (!s) return name;
        return stacked ? `${name} ${pct(s.share)}` : `${name}  ${isDurationUnit(unit) ? formatDuration(s.value) : `${chartValueText(s.value, digits)}${unit}`}  ${pct(s.share)}`;
      }) as never,
    },
    title: {
      text: isDurationUnit(unit) ? formatDuration(total) : chartValueText(total, digits),
      subtext: centerLabel,
      left: center[0],
      top: stacked ? "28%" : "center",
      textAlign: "center",
      itemGap: 2,
      textStyle: { fontSize: stacked ? 18 : 22, fontWeight: 600, color: VIZ_TEXT },
      subtextStyle: { fontSize: 12, color: VIZ_NOTE },
    },
    series: [
      {
        id: "donut",
        type: "pie",
        radius: stacked ? ["42%", "62%"] : ["54%", "78%"],
        center,
        padAngle: 1.2,
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 3 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
      },
    ],
  };
}

export type StackedSeries = { key?: string; name: string; values: readonly (number | null)[]; color?: string };
export type StackedBarInput = {
  categories: readonly string[];
  /** One series per stacked dimension value, at most 8 (the rest fold into 「其他」). */
  series: readonly StackedSeries[];
  unit?: string;
  digits?: number;
  horizontal?: boolean;
};

/** Series of a stack: at most 8, the rest summed into 「其他」 (never cycle colours). */
export function stackSeries(series: readonly StackedSeries[], categories: number, max = VIZ_CATEGORY_HUES.length): (StackedSeries & { color: string })[] {
  const keep = series.length > max ? series.slice(0, max - 1) : series;
  const out = keep.map((s, i) => ({ ...s, color: s.color ?? vizCategory(i) }));
  if (series.length > max) {
    const rest = series.slice(keep.length);
    out.push({ key: "__other__", name: "其他", color: VIZ_OTHER, values: Array.from({ length: categories }, (_, i) => rest.reduce<number | null>((n, s) => (finite(s.values[i]) ? (n ?? 0) + (s.values[i] as number) : n), null)) });
  }
  return out;
}

/** Stacked bars: segments 1px apart (panel-coloured border), only the top segment rounded, tooltip with 「合计」. */
export function stackedBarOption(input: StackedBarInput): EChartsOption {
  const { categories, unit = "", digits = 0, horizontal = false } = input;
  const list = stackSeries(input.series, categories.length);
  const category = { type: "category" as const, data: [...categories], axisTick: { show: false }, axisLabel: { interval: 0, hideOverlap: true } };
  const value = { type: "value" as const, min: 0, axisLabel: { formatter: (v: number) => (isDurationUnit(unit) ? formatDuration(v) : chartValueText(v)) } };
  // The outermost non-empty segment of each category gets the rounded end.
  const topOf = categories.map((_, i) => {
    for (let s = list.length - 1; s >= 0; s--) if (finite(list[s]!.values[i]) && (list[s]!.values[i] as number) > 0) return s;
    return -1;
  });
  const radius = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  return {
    animation: false,
    grid: { left: 4, right: 12, top: list.length > 1 ? 36 : 12, bottom: 4, containLabel: true },
    legend: list.length > 1 ? { data: list.map((s) => s.name) } : { show: false },
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: { type: "shadow" },
      formatter: ((params: { dataIndex: number; seriesIndex: number; color?: string }[]) => {
        const i = params[0]?.dataIndex ?? 0;
        const rows = params
          .map((p) => ({ color: p.color, name: list[p.seriesIndex]?.name ?? "", value: list[p.seriesIndex]?.values[i] ?? null, unit, digits }))
          .filter((r) => finite(r.value));
        const sum = rows.reduce((n, r) => n + (r.value as number), 0);
        return tooltipHtml({ head: categories[i], rows, ...(rows.length > 1 ? { total: { label: "合计", text: isDurationUnit(unit) ? formatDuration(sum) : `${chartValueText(sum, digits)}${unit ? ` ${unit}` : ""}` } } : {}) });
      }) as never,
    },
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? { ...category, inverse: true, axisLine: { show: false } } : value,
    series: list.map((s, si) => ({
      id: s.key ?? `s${si}`,
      name: s.name,
      type: "bar" as const,
      stack: "total",
      barMaxWidth: 28,
      barCategoryGap: "40%",
      itemStyle: { color: s.color },
      emphasis: { focus: "series" as const },
      data: categories.map((_, i) => {
        const v = s.values[i];
        if (!finite(v)) return "-";
        return { value: v, itemStyle: { color: s.color, borderColor: VIZ_SURFACE, borderWidth: 1, borderRadius: topOf[i] === si ? radius : 0 } };
      }),
    })),
  };
}
