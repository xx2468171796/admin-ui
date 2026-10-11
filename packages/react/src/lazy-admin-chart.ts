"use client";
/**
 * AdminChart from the root entry without putting ECharts in the root bundle: the `./charts` subpath (and
 * echarts/core with it) loads on first render, a chart-high loading skeleton stands in meanwhile, so nothing
 * below jumps. Same props as AdminChart, including `ref` (getInstance) and the events. `preloadAdminChart()`
 * starts the download early (hover on the tab that shows charts, idle time).
 */
import { createElement, Suspense, type ComponentType, type ReactElement } from "react";
import { lazyPart } from "./lazy-part.ts";
import { ChartState } from "./chart-state.tsx";
import type { AdminChartPropsOf } from "./chart-props.ts";

// No type import of ./charts here (it names ECharts types); the loaded component is narrowed to the loose props.
const part = lazyPart<ComponentType<LazyAdminChartProps>>(() =>
  import("./charts.tsx").then((m) => m.AdminChart as unknown as ComponentType<LazyAdminChartProps>),
);

/**
 * AdminChart's props with loose option / instance types: the root entry's types must not need ECharts (an optional
 * peer). Build `option` with the ./charts builders or write an ECharts option; `getInstance()` is the ECharts instance.
 */
export type LazyAdminChartProps = AdminChartPropsOf<object, unknown>;

export function LazyAdminChart(props: LazyAdminChartProps): ReactElement {
  const fallback = createElement(ChartState, { kind: "loading", height: props.height ?? 300, label: props.label });
  return createElement(Suspense, { fallback }, createElement(part.Part, props));
}

/** Start loading the charts subpath now (no-op once loaded or loading). */
export function preloadAdminChart(): void {
  part.preload();
}
