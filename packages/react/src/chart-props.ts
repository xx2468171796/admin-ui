/**
 * AdminChart's props without naming any ECharts type. `./charts` fills them with ECharts' own types
 * (`AdminChartProps = AdminChartPropsOf<EChartsOption, EChartsType>`); the root entry's `LazyAdminChart` uses
 * loose ones, so the root's type graph never needs ECharts installed (it is an optional peer: a project that
 * shows no chart does not install it, and with skipLibCheck off it would otherwise fail to type-check).
 */
import type { Ref } from "react";
import type { AdminChartEventHandler, AdminChartPoint } from "./chart-events.ts";

export type AdminChartPropsOf<Option, Instance> = {
  option: Option;
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
  /**
   * ECharts events by name (`click`, `legendselectchanged`, `datazoom` …). Handlers are read live: a new object
   * every render binds nothing new; adding / removing a name binds / unbinds it without re-creating the chart.
   */
  onEvents?: Readonly<Record<string, AdminChartEventHandler | undefined>>;
  /** A data point was clicked (drill-down): series + point, never fired for a title / legend / axis click. */
  onPointClick?: (point: AdminChartPoint) => void;
  /** `getInstance()` = the live ECharts instance (null before the first paint), for dispatchAction / export. */
  ref?: Ref<{ getInstance: () => Instance | null }>;
};
