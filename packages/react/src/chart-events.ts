/**
 * AdminChart's event outlet without re-creating the chart: one stable dispatcher per event name is bound to the
 * instance; it reads the latest handlers from a ref, so a new `onEvents` object every render binds nothing new.
 * Names that appear are bound, names that disappear are unbound. Pure (works on any `{ on, off }`), unit-tested.
 */

/** The params ECharts passes to a handler (mouse events: ECElementEvent; others such as `datazoom` their own shape). */
export type AdminChartEvent = { componentType?: string; seriesType?: string; seriesIndex?: number; seriesId?: string; seriesName?: string; name?: string; dataIndex?: number; data?: unknown; value?: unknown; [key: string]: unknown };
export type AdminChartEventHandler = (params: AdminChartEvent) => void;

/** A clicked data point (`onPointClick`): drill-down needs the series and the point. */
export type AdminChartPoint = {
  seriesIndex: number;
  seriesId?: string;
  seriesName?: string;
  seriesType?: string;
  dataIndex: number;
  /** Category / item name of the point (x category, pie slice, funnel stage). */
  name: string;
  value: unknown;
  data: unknown;
  /** The raw ECharts params. */
  event: AdminChartEvent;
};

export type ChartEventSource = { onEvents?: Readonly<Record<string, AdminChartEventHandler | undefined>>; onPointClick?: (point: AdminChartPoint) => void };

/** What syncChartEvents needs of an ECharts instance (chart-instance.ts adapts `EChartsType` to it). */
export type ChartEmitter = { on: (name: string, handler: (params: AdminChartEvent) => void) => unknown; off: (name: string, handler: (params: AdminChartEvent) => void) => unknown };

/** The event names a source listens to (`click` when only `onPointClick` is given). */
export function chartEventNames(source: ChartEventSource): string[] {
  const names = Object.entries(source.onEvents ?? {}).filter(([, fn]) => typeof fn === "function").map(([name]) => name);
  if (source.onPointClick && !names.includes("click")) names.push("click");
  return names.sort();
}

/** The point of a series click, or null for clicks on a title / legend / axis. */
export function chartPoint(params: AdminChartEvent): AdminChartPoint | null {
  if (params.componentType !== "series" || typeof params.dataIndex !== "number") return null;
  return {
    seriesIndex: typeof params.seriesIndex === "number" ? params.seriesIndex : 0,
    seriesId: params.seriesId,
    seriesName: params.seriesName,
    seriesType: params.seriesType,
    dataIndex: params.dataIndex,
    name: typeof params.name === "string" ? params.name : "",
    value: params.value,
    data: params.data,
    event: params,
  };
}

/** Call the current handlers of one event name. */
export function dispatchChartEvent(source: ChartEventSource, name: string, params: AdminChartEvent): void {
  source.onEvents?.[name]?.(params);
  if (name === "click" && source.onPointClick) {
    const point = chartPoint(params);
    if (point) source.onPointClick(point);
  }
}

/**
 * Bring the bindings of `chart` in line with `names`: bind a dispatcher for new names, unbind the ones that went.
 * `bound` (name → dispatcher) is kept by the caller across calls and cleared when the chart is disposed.
 */
export function syncChartEvents(chart: ChartEmitter, names: readonly string[], bound: Map<string, (params: AdminChartEvent) => void>, latest: () => ChartEventSource): void {
  for (const [name, handler] of [...bound]) {
    if (names.includes(name)) continue;
    chart.off(name, handler);
    bound.delete(name);
  }
  for (const name of names) {
    if (bound.has(name)) continue;
    const handler = (params: AdminChartEvent) => dispatchChartEvent(latest(), name, params);
    bound.set(name, handler);
    chart.on(name, handler);
  }
}
