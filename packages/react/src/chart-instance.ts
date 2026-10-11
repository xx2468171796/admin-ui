"use client";
/**
 * The ECharts instance behind AdminChart: created when the container first has a size (hidden tabs do not init
 * blank), updated with replaceMerge:['series'] so polling keeps zoom / legend state, rebuilt only when the theme
 * (palette, mode, font size, font) changes. Events are bound through chart-events.ts (no re-create when handlers
 * change). In development an option part ECharts dropped because it is not registered is named in the console.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, type Ref, type RefObject } from "react";
import { init, registerTheme, type EChartsType } from "echarts/core";
import type { EChartsOption } from "echarts";
import { ensureAdminCharts } from "./chart-registry.ts";
import { chartFontFamily, chartRegistrationHint, chartShapeKey, isProductionBuild, missingChartRegistrations, shortHash } from "./chart-registry-core.ts";
import { chartEventNames, syncChartEvents, type AdminChartEvent, type ChartEmitter, type ChartEventSource } from "./chart-events.ts";
import type { ChartColors } from "./viz-palette.ts";

/** What `ref` on AdminChart / LazyAdminChart gives: the live ECharts instance (null before the first paint / after unmount). */
export type AdminChartHandle = { getInstance: () => EChartsType | null };

/**
 * Theme from the palette (审阅 06): every colour comes from `chartColors(palette)` — gridlines = line colour 62%
 * on the panel (`colors.grid`), labels note / secondary, tooltip = panel colour with the popover shadow and radius 8,
 * legend top-left with 10 × 10 rounded squares, bars with a 4px top radius, ≤ 32px wide and a 42% gap, hover band =
 * body text 4.5% (dark 8%). Text uses the page font (`.adminui` computed font-family: Inter first).
 */
function registerAdminTheme(colors: ChartColors, scale: number, key: string, fontFamily: string): string {
  const label = { color: colors.note, fontSize: 12 * scale, margin: 10 };
  const axis = { axisLine: { lineStyle: { color: colors.line } }, axisTick: { show: false }, axisLabel: label, splitLine: { lineStyle: { color: colors.grid } }, nameTextStyle: { color: colors.note, fontSize: 12 * scale } };
  const name = `adminui-${key}-${scale}-${shortHash(fontFamily)}`;
  registerTheme(name, {
    color: [...colors.categorical],
    backgroundColor: "transparent",
    textStyle: { color: colors.secondary, fontFamily, fontSize: 12 * scale },
    legend: { left: 0, top: 0, textStyle: { color: colors.secondary, fontSize: 12 * scale }, itemWidth: 10, itemHeight: 10, itemGap: 16, icon: "roundRect", inactiveColor: `${colors.note}73` },
    tooltip: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: colors.text, fontSize: 12 * scale, fontFamily },
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

/** The font of the chart's `.adminui` root (falls back to the tokens.css stack). */
function pageFont(node: HTMLElement): string {
  const root = node.closest(".adminui") ?? node;
  return chartFontFamily(typeof getComputedStyle === "function" ? getComputedStyle(root).fontFamily : "");
}

/** setOption; in development, name what ECharts dropped for want of a registration (once per option shape). */
function applyOption(chart: EChartsType, option: EChartsOption, opts: Parameters<EChartsType["setOption"]>[1], label: string, checked: Set<string>): void {
  const dev = !isProductionBuild();
  try {
    chart.setOption(option, opts);
  } catch (error) {
    if (dev) reportMissing(chart, option, label, checked, true);
    throw error;
  }
  if (dev) reportMissing(chart, option, label, checked, false);
}

function reportMissing(chart: EChartsType, option: EChartsOption, label: string, checked: Set<string>, force: boolean): void {
  const key = chartShapeKey(option);
  if (!force && checked.has(key)) return;
  checked.add(key);
  const missing = missingChartRegistrations(option, chart.getOption() ?? {});
  if (missing.length) console.error(chartRegistrationHint(missing, label));
}

type EChartsHandler = (...args: unknown[]) => void;
/** ECharts types string-named handlers as `(...args: unknown[])`; it calls them with one params object. */
const emitterOf = (chart: EChartsType): ChartEmitter => ({
  on: (name, handler) => chart.on(name, handler as EChartsHandler),
  off: (name, handler) => chart.off(name, handler as EChartsHandler),
});

export type ChartInstanceInput =ChartEventSource & {
  el: RefObject<HTMLDivElement | null>;
  /** The full option (tokens resolved, fonts scaled) — read at init and on every update. */
  build: () => EChartsOption;
  label: string;
  show: boolean;
  visible: boolean;
  colors: ChartColors;
  themeKey: string;
  fontScale: number;
  /** Values whose change means 「update the option」. */
  deps: readonly unknown[];
  ref?: Ref<AdminChartHandle>;
};

/** Mount / update / resize / events of one ECharts instance (see the module comment). */
export function useChartInstance(input: ChartInstanceInput): void {
  const { el, show, themeKey, fontScale, visible } = input;
  const chart = useRef<EChartsType | null>(null);
  const latest = useRef(input);
  latest.current = input;
  const bound = useRef(new Map<string, (params: AdminChartEvent) => void>());
  const checked = useRef(new Set<string>());
  useImperativeHandle(input.ref, () => ({ getInstance: () => chart.current }), []);
  const bind = useCallback(() => {
    const c = chart.current;
    if (c) syncChartEvents(emitterOf(c), chartEventNames(latest.current), bound.current, () => latest.current);
  }, []);

  // Rebuild only for theme or when the canvas element (re)appears; colors / option are read through `latest`.
  useEffect(() => {
    const node = el.current;
    if (!show || !node) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const ensure = () => {
      if (chart.current || node.clientWidth === 0 || node.clientHeight === 0) return;
      ensureAdminCharts();
      const now = latest.current;
      chart.current = init(node, registerAdminTheme(now.colors, fontScale, themeKey, pageFont(node)));
      applyOption(chart.current, now.build(), { notMerge: true }, now.label, checked.current);
      bind();
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
      bound.current.clear();
    };
  }, [themeKey, fontScale, show, el, bind]);

  // `input.deps` is the caller's list of option inputs (「update the option」); the option itself is read through `latest`.
  useEffect(() => {
    if (chart.current) applyOption(chart.current, latest.current.build(), { replaceMerge: ["series"], lazyUpdate: true }, latest.current.label, checked.current);
    // biome-ignore lint/correctness/useExhaustiveDependencies: a caller-supplied dependency list (see above), not a literal.
  }, input.deps);

  // Bind / unbind when the set of event names changes (handlers themselves are read live).
  const names = chartEventNames(input).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `names` is the trigger; bind reads the handlers through `latest`.
  useEffect(bind, [names]);

  useEffect(() => {
    if (visible) chart.current?.resize();
  }, [visible]);
}
