/**
 * ECharts is loaded as `echarts/core` + an explicit registration list instead of the whole library (~1 MB):
 * every series type and component the SDK's builders draw, plus the ones hosts commonly use. `registerAdminCharts`
 * adds more (a map, a sunburst, the toolbox …). Registration runs inside a function (no module-level side
 * effect), the first time an AdminChart mounts; `use()` ignores an extension it already has.
 */
import { use } from "echarts/core";
import { BarChart, BoxplotChart, CandlestickChart, CustomChart, FunnelChart, GaugeChart, GraphChart, HeatmapChart, LineChart, PieChart, RadarChart, SankeyChart, ScatterChart, TreemapChart } from "echarts/charts";
import {
  AriaComponent,
  AxisPointerComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout, LegacyGridContainLabel, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

/** One thing `echarts/core`'s `use()` accepts: an `echarts/charts` / `components` / `features` / `renderers` export. */
export type AdminChartExtension = Parameters<typeof use>[0];

let registered = false;

/** Register AdminChart's default set once (idempotent). Called by AdminChart before its first `init`. */
export function ensureAdminCharts(): void {
  if (registered) return;
  registered = true;
  use([
    // Series: the SDK builders (line, bar, pie, scatter, heatmap) + the common host ones (keep in sync with DEFAULT_SERIES).
    LineChart, BarChart, PieChart, ScatterChart, HeatmapChart, FunnelChart, GaugeChart, RadarChart, BoxplotChart, CandlestickChart, SankeyChart, TreemapChart, GraphChart,
    // `custom`: a consumer's network-diagnosis timeline draws its bands with a custom series — the only series type a
    // consumer used that the first lean set missed; registering it keeps the 8.10 upgrade drop-in.
    CustomChart,
    // Components (keep in sync with DEFAULT_COMPONENTS).
    GridComponent, TooltipComponent, AxisPointerComponent, LegendComponent, TitleComponent, DataZoomComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent,
    VisualMapComponent, DatasetComponent, TransformComponent, AriaComponent, RadarComponent,
    // `grid.containLabel` (every SDK builder uses it) is a separate feature since ECharts 6; label layout for hideOverlap / moveOverlap.
    LegacyGridContainLabel, LabelLayout, UniversalTransition,
    CanvasRenderer,
  ]);
}

/**
 * Register more ECharts series / components / features for every AdminChart (call once at startup, before the
 * chart renders): `registerAdminCharts(SunburstChart, ToolboxComponent)` with the exports of `echarts/charts`,
 * `echarts/components`, `echarts/features` or `echarts/renderers`. In development AdminChart prints which
 * registration an option is missing.
 */
export function registerAdminCharts(...extensions: readonly AdminChartExtension[]): void {
  ensureAdminCharts();
  for (const ext of extensions) use(ext);
}
