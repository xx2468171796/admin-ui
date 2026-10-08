/**
 * Target bars (DASHBOARDS.md §6, §12.3; D29 hourly rhythm, D30 monthly revenue vs target): one bar
 * per period in the brand colour, an optional target tick per period, the unfinished period drawn as
 * a hollow dashed bar labelled 「进行中」, periods that have not started left empty (never 0).
 * Pure function, no echarts runtime import — kept apart from chart-options.ts to keep files small.
 */
import type { EChartsOption } from "echarts";
import { formatNumber } from "./dashboard-core.ts";
import { VIZ_BRAND, VIZ_NOTE, VIZ_TEXT, type VizMode } from "./viz-palette.ts";
import { CHART_VALUE_LABEL, tooltipHtml } from "./chart-options-kinds.ts";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export type TargetBarInput = {
  /** Period labels (「6 月」「9」 for 9 点 …). */
  categories: readonly string[];
  /** Actual value per period; null = not started / no data → no bar (not a 0 bar). */
  values: readonly (number | null)[];
  /** Target per period (tick across the bar); omit for plain bars. */
  targets?: readonly (number | null)[];
  /** Index of the unfinished period; `true` = the last period that has a value. */
  inProgress?: number | boolean;
  /** Text over the unfinished bar (default 「进行中」); with more than 8 categories the bar shows its value instead (the word would run into the next bar), the tooltip still says it. */
  inProgressLabel?: string;
  mode?: VizMode;
  unit?: string;
  digits?: number;
  /** Value labels above the bars (default true). */
  labels?: boolean;
  /** Series names for legend and tooltip. */
  name?: string;
  targetName?: string;
  /** Bar width cap in px, default 32 (the target tick is 8px wider). */
  barMaxWidth?: number;
};

/** ECharts option for 「bars vs target」. Feed it to AdminChart; colours follow the palette. */
export function targetBarOption(input: TargetBarInput): EChartsOption {
  const { categories, values, targets, mode = "light", unit = "", digits = 0, labels = true, name = "实际", targetName = "目标", barMaxWidth = 32, inProgressLabel = "进行中" } = input;
  void mode;
  const ink = VIZ_TEXT;
  let current = -1;
  if (input.inProgress === true) for (let i = values.length - 1; i >= 0; i--) if (finite(values[i])) { current = i; break; }
  if (typeof input.inProgress === "number") current = input.inProgress;
  const fmt = (v: number) => `${formatNumber(v, { digits, compact: Math.abs(v) >= 1e4 })}`;
  const hasTarget = Boolean(targets?.some(finite));
  // A value label under a higher target tick would be crossed by it: such labels sit above the tick.
  const labelOnTick = (i: number) => {
    const v = values[i];
    const t = targets?.[i];
    return hasTarget && finite(t) && (!finite(v) || t >= v);
  };
  // A target tick just under a bar's top would touch the value label above the bar: lift that label.
  const scale = Math.max(1, ...values.filter(finite), ...(targets ?? []).filter(finite));
  const tickJustBelow = (i: number) => {
    const v = values[i];
    const t = targets?.[i];
    return hasTarget && finite(t) && finite(v) && t < v && (v - t) / scale < 0.06;
  };
  // Many narrow slots (hours of a day): a word over the in-progress bar would overlap its neighbours.
  const dense = categories.length > 8;
  const bars = categories.map((_, i) => {
    const v = values[i];
    if (!finite(v)) return "-";
    const now = i === current;
    return {
      value: v,
      itemStyle: now ? { color: `${VIZ_BRAND}26`, borderColor: VIZ_BRAND, borderWidth: 1.5, borderType: "dashed" as const } : { color: VIZ_BRAND },
      label: { show: labels && (now || !labelOnTick(i)), formatter: now && !dense ? inProgressLabel : fmt(v), color: now ? VIZ_NOTE : undefined, distance: !now && tickJustBelow(i) ? 10 : 6 },
    };
  });
  const ticks = categories.map((_, i) => {
    const t = targets?.[i];
    const v = values[i];
    if (!finite(t)) return "-";
    const showValue = labels && i !== current && finite(v) && labelOnTick(i);
    return { value: t, label: { show: showValue, formatter: finite(v) ? fmt(v) : "", position: "top" as const, distance: 8 } };
  });
  const series: NonNullable<EChartsOption["series"]> = [
    {
      id: "actual",
      name,
      type: "bar",
      barMaxWidth,
      // Series colour = the bars' colour, so the legend swatch matches (per-point itemStyle alone leaves it on the palette's first colour).
      itemStyle: { color: VIZ_BRAND, borderRadius: [4, 4, 0, 0] },
      barCategoryGap: "42%",
      data: bars,
      label: { show: labels, position: "top", ...CHART_VALUE_LABEL },
      emphasis: { disabled: true },
    },
  ];
  if (hasTarget)
    series.push({
      id: "target",
      name: targetName,
      type: "scatter",
      symbol: "rect",
      symbolSize: [barMaxWidth + 10, 2],
      itemStyle: { color: ink },
      label: { ...CHART_VALUE_LABEL },
      data: ticks,
      z: 3,
      emphasis: { disabled: true },
    });
  return {
    animation: false,
    grid: { left: 8, right: 8, top: hasTarget ? 48 : 20, bottom: 4, containLabel: true },
    legend: hasTarget ? { data: [name, { name: targetName, icon: "rect", itemHeight: 2, itemWidth: 14 } as never] } : { show: false },
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: { type: "shadow" },
      formatter: ((params: { dataIndex: number; seriesId?: string; color?: string }[]) => {
        const i = params[0]?.dataIndex ?? 0;
        const tickColor = params.find((p) => p.seriesId === "target")?.color;
        const v = values[i];
        const t = targets?.[i];
        return tooltipHtml({
          head: categories[i] ?? "",
          ...(i === current ? { chip: inProgressLabel } : {}),
          rows: [
            { color: params.find((p) => p.seriesId === "actual")?.color, name, value: finite(v) ? v : null, unit, digits },
            ...(hasTarget ? [{ color: tickColor, line: true, name: targetName, value: finite(t) ? t : null, unit, digits }] : []),
          ],
          ...(finite(v) && finite(t) && t > 0 ? { total: { label: "完成", text: `${formatNumber((v / t) * 100, { digits: 1 })}%` } } : {}),
        });
      }) as never,
    },
    xAxis: { type: "category", data: [...categories], axisTick: { show: false } },
    // The unit belongs in the panel subtitle (「万 US$ · 横线 = 当月目标」); an axis name crowds the top-left tick.
    yAxis: { type: "value", min: 0, axisLabel: { formatter: (v: number) => formatNumber(v, { compact: true }) } },
    series,
  };
}
