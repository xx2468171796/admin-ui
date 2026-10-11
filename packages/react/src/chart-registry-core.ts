/**
 * Pure helpers of the ECharts registration (no echarts import, unit-tested): which `echarts/charts` /
 * `echarts/components` export a series type or a top-level option key needs, what an option asked for that the
 * live instance dropped (ECharts silently skips an unregistered series type in production), the actionable hint,
 * and the chart font read from the page.
 */

/** Series `type` → the `echarts/charts` export that registers it. */
export const SERIES_IMPORTS: Readonly<Record<string, string>> = {
  line: "LineChart",
  bar: "BarChart",
  pie: "PieChart",
  scatter: "ScatterChart",
  effectScatter: "EffectScatterChart",
  heatmap: "HeatmapChart",
  funnel: "FunnelChart",
  gauge: "GaugeChart",
  radar: "RadarChart",
  boxplot: "BoxplotChart",
  candlestick: "CandlestickChart",
  sankey: "SankeyChart",
  treemap: "TreemapChart",
  graph: "GraphChart",
  tree: "TreeChart",
  sunburst: "SunburstChart",
  map: "MapChart",
  lines: "LinesChart",
  parallel: "ParallelChart",
  themeRiver: "ThemeRiverChart",
  pictorialBar: "PictorialBarChart",
  chord: "ChordChart",
  custom: "CustomChart",
};

/** Top-level option key → the `echarts/components` export that registers it. */
export const COMPONENT_IMPORTS: Readonly<Record<string, string>> = {
  grid: "GridComponent",
  xAxis: "GridComponent",
  yAxis: "GridComponent",
  polar: "PolarComponent",
  angleAxis: "PolarComponent",
  radiusAxis: "PolarComponent",
  radar: "RadarComponent",
  geo: "GeoComponent",
  singleAxis: "SingleAxisComponent",
  parallel: "ParallelComponent",
  parallelAxis: "ParallelComponent",
  calendar: "CalendarComponent",
  matrix: "MatrixComponent",
  graphic: "GraphicComponent",
  toolbox: "ToolboxComponent",
  tooltip: "TooltipComponent",
  axisPointer: "AxisPointerComponent",
  brush: "BrushComponent",
  title: "TitleComponent",
  timeline: "TimelineComponent",
  legend: "LegendComponent",
  dataZoom: "DataZoomComponent",
  visualMap: "VisualMapComponent",
  thumbnail: "ThumbnailComponent",
  dataset: "DatasetComponent",
};

/** What AdminChart registers by default (series types and components). Hosts add more with `registerAdminCharts`. */
export const DEFAULT_SERIES = ["line", "bar", "pie", "scatter", "heatmap", "funnel", "gauge", "radar", "boxplot", "candlestick", "sankey", "treemap", "graph", "custom"] as const;
export const DEFAULT_COMPONENTS = ["GridComponent", "TooltipComponent", "AxisPointerComponent", "LegendComponent", "TitleComponent", "DataZoomComponent", "MarkLineComponent", "MarkAreaComponent", "MarkPointComponent", "VisualMapComponent", "DatasetComponent", "TransformComponent", "AriaComponent", "RadarComponent"] as const;

export type MissingRegistration = { kind: "series" | "component"; name: string; importName: string; from: "echarts/charts" | "echarts/components" };

type OptionLike = Record<string, unknown>;
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);
const seriesTypes = (option: OptionLike): Set<string> => {
  const types = new Set<string>();
  for (const s of asList(option.series)) {
    const type = s && typeof s === "object" ? (s as { type?: unknown }).type : undefined;
    if (typeof type === "string") types.add(type);
  }
  return types;
};

/**
 * A component key ECharts kept as a raw copy: `getOption()` returns a registered component with its defaults
 * merged in (`z`, `show` …), an unregistered one exactly as given (or not at all).
 */
const unmodelled = (requested: unknown, applied: unknown): boolean => {
  const got = asList(applied);
  return got.length === 0 || JSON.stringify(got) === JSON.stringify(asList(requested));
};

/**
 * What `requested` (the option AdminChart passed to setOption) asked for that `applied` (`chart.getOption()`)
 * does not have: a series type whose series all vanished (ECharts drops them), a component key ECharts did not
 * model (it keeps such a key as a raw copy).
 */
export function missingChartRegistrations(requested: OptionLike, applied: OptionLike): MissingRegistration[] {
  const out: MissingRegistration[] = [];
  const have = seriesTypes(applied);
  for (const type of seriesTypes(requested)) {
    if (have.has(type)) continue;
    out.push({ kind: "series", name: type, importName: SERIES_IMPORTS[type] ?? `${type[0]?.toUpperCase() ?? ""}${type.slice(1)}Chart`, from: "echarts/charts" });
  }
  for (const key of Object.keys(requested)) {
    const importName = COMPONENT_IMPORTS[key];
    if (!importName || requested[key] === undefined || !unmodelled(requested[key], applied[key])) continue;
    if (!out.some((m) => m.importName === importName)) out.push({ kind: "component", name: key, importName, from: "echarts/components" });
  }
  return out;
}

/** The console message for missing registrations: names the series / key and the exact import + call. */
export function chartRegistrationHint(missing: readonly MissingRegistration[], label: string): string {
  const lines = missing.map((m) => `- ${m.kind === "series" ? `series type "${m.name}"` : `option key "${m.name}"`} → import { ${m.importName} } from "${m.from}";`);
  const names = [...new Set(missing.map((m) => m.importName))].join(", ");
  return [
    `[admin-ui] AdminChart「${label}」: ECharts dropped part of the option because it is not registered (admin-ui loads echarts/core with a fixed set since 8.10).`,
    ...lines,
    `Register once at startup: import { registerAdminCharts } from "@adminui/react/charts"; registerAdminCharts(${names});`,
  ].join("\n");
}

/** A stable, cheap key of what an option needs (series types + component keys), to check each shape once. */
export function chartShapeKey(option: OptionLike): string {
  const keys = Object.keys(option).filter((k) => COMPONENT_IMPORTS[k] !== undefined && option[k] !== undefined).sort();
  return `${[...seriesTypes(option)].sort().join(",")}|${keys.join(",")}`;
}

/** The stack used when the page has no font (SSR, detached node): the root `.adminui` font of tokens.css. */
export const CHART_FONT_FALLBACK = 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

/** The chart font: the computed `font-family` of the chart's `.adminui` root (so Inter / a host font carry over). */
export function chartFontFamily(computed: string | null | undefined): string {
  const value = computed?.trim();
  return value ? value : CHART_FONT_FALLBACK;
}

/** Short hash for theme names (font stacks are long). */
export function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** True in a production bundle (`process.env.NODE_ENV` replaced by the bundler); false when it is not defined. */
export function isProductionBuild(): boolean {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
    return false;
  }
}
