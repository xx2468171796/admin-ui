import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { init, use, type EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { SunburstChart } from "echarts/charts";
import { ToolboxComponent } from "echarts/components";
import type { EChartsOption } from "echarts";
import { ensureAdminCharts, registerAdminCharts } from "../src/chart-registry.ts";
import {
  CHART_FONT_FALLBACK,
  DEFAULT_COMPONENTS,
  DEFAULT_SERIES,
  SERIES_IMPORTS,
  chartFontFamily,
  chartRegistrationHint,
  chartShapeKey,
  missingChartRegistrations,
} from "../src/chart-registry-core.ts";
import { cohortHeatmapOption, funnelPlotOption, resolveVizTokens, timeSeriesOption, toleranceBandOption } from "../src/chart-options.ts";
import { barOption, donutOption, stackedBarOption } from "../src/chart-options-kinds.ts";
import { targetBarOption } from "../src/chart-options-targets.ts";
import { chartColors } from "../src/viz-palette.ts";
import { createPalette } from "../src/palette.ts";

// Server-side rendering needs no DOM: the SVG renderer is registered here only (AdminChart itself draws on canvas).
use(SVGRenderer);
const colors = chartColors(createPalette("#357450", "light"));
const render = (option: EChartsOption): EChartsType => {
  const chart = init(null, undefined, { renderer: "svg", ssr: true, width: 480, height: 300 });
  try {
    chart.setOption({ ...resolveVizTokens(option, colors), animation: false }, { notMerge: true });
  } catch (error) {
    chart.dispose(); // a live instance keeps a timer: the test process would never exit
    throw error;
  }
  return chart;
};
const seriesCount = (option: { series?: unknown }) => (Array.isArray(option.series) ? option.series.length : option.series ? 1 : 0);

test("echarts/core registration: every SDK builder renders with nothing dropped (series, grid.containLabel, visualMap, markLine / markArea)", () => {
  ensureAdminCharts();
  const t0 = Date.UTC(2026, 8, 1);
  const builders: [string, EChartsOption][] = [
    ["timeSeries", timeSeriesOption({ series: [{ id: "a", name: "A", points: [[t0, 1], [t0 + 60_000, 2]] }, { id: "b", name: "B", points: [[t0, 3]] }], annotations: [{ at: t0, label: "发版" }, { from: t0, to: t0 + 1, label: "活动" }], inProgress: true })],
    ["toleranceBand", toleranceBandOption({ points: [{ t: t0, actual: 0.95, n: 5000 }, { t: t0 + 1, actual: 0.9, n: 5000 }], theoretical: 0.95, sigma: 5 })],
    ["funnelPlot", funnelPlotOption({ items: [{ name: "x", n: 5000, value: 0.95 }, { name: "y", n: 50, value: 0.2 }], theoretical: 0.95, sigma: 5 })],
    ["cohortHeatmap", cohortHeatmapOption({ cohorts: ["09-01"], periods: ["D0", "D1"], values: [[1, 0.4]] })],
    ["bar", barOption({ categories: ["a", "b"], values: [1, 2] })],
    ["donut", donutOption({ items: [{ name: "a", value: 1 }, { name: "b", value: 2 }] })],
    ["stackedBar", stackedBarOption({ categories: ["a"], series: [{ name: "x", values: [1] }, { name: "y", values: [2] }] })],
    ["targetBar", targetBarOption({ categories: ["a", "b"], values: [1, 2], targets: [2, 2] })],
  ];
  const errors: string[] = [];
  const original = { error: console.error, warn: console.warn, log: console.log };
  // ECharts reports missing modules with console.error and a containLabel without its feature with console.log.
  console.error = console.warn = console.log = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  try {
    for (const [name, option] of builders) {
      const chart = render(option);
      const applied = chart.getOption() as { series?: unknown };
      assert.equal(seriesCount(applied), seriesCount(option), `${name}: every series registered`);
      assert.deepEqual(missingChartRegistrations(resolveVizTokens(option, colors), applied), [], name);
      chart.dispose();
    }
  } finally {
    Object.assign(console, original);
  }
  assert.deepEqual(errors.filter((e) => /not imported|is used but|containLabel/i.test(e)), [], "ECharts printed no missing-module / containLabel warnings (same layout as the full build)");
  // grid.containLabel (a separate feature since ECharts 6) really works: long category names push the plot right
  // of `grid.left` (4) instead of overflowing the chart edge.
  const ranking = render(barOption({ categories: ["华东大区直营一部", "华南大区渠道二部"], values: [5, 3], horizontal: true }));
  const zeroX = ranking.convertToPixel({ xAxisIndex: 0 }, 0);
  ranking.dispose();
  assert.ok(typeof zeroX === "number" && zeroX > 60, `plot starts after the labels (x of 0 = ${String(zeroX)})`);
});

test("the default set covers the common host series and components; registerAdminCharts adds more", () => {
  ensureAdminCharts();
  const cartesian = new Set(["line", "bar", "scatter", "heatmap", "boxplot", "candlestick", "custom"]);
  for (const type of DEFAULT_SERIES) {
    const axes: EChartsOption = cartesian.has(type) ? { xAxis: { type: "category", data: ["a"] }, yAxis: type === "heatmap" ? { type: "category", data: ["b"] } : { type: "value" } } : type === "radar" ? { radar: { indicator: [{ name: "a", max: 1 }] } } : {};
    if (type === "heatmap") axes.visualMap = { min: 0, max: 1 };
    const series = type === "custom" ? { type, data: [], renderItem: () => null } : { type, data: [] };
    const chart = render({ ...axes, series: [series as never] });
    assert.equal(seriesCount(chart.getOption() as { series?: unknown }), 1, `${type} is registered`);
    chart.dispose();
  }
  const source = readFileSync(new URL("../src/chart-registry.ts", import.meta.url), "utf8");
  for (const name of [...DEFAULT_SERIES.map((t) => SERIES_IMPORTS[t]), ...DEFAULT_COMPONENTS]) assert.match(source, new RegExp(`\\b${name}\\b,`), `${name} is in use([...])`);
  // A type outside the default set is dropped (and named) until the host registers it.
  const sunburst: EChartsOption = { toolbox: { feature: {} }, series: [{ type: "sunburst", data: [{ name: "a", value: 1 }] }] };
  const logged: string[] = [];
  const error = console.error;
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(" ")); // ECharts' own dev hint
  const before = render(sunburst);
  console.error = error;
  const missing = missingChartRegistrations(sunburst, before.getOption());
  before.dispose();
  assert.ok(logged.some((l) => l.includes("SunburstChart")), "ECharts' own dev message fired too");
  assert.deepEqual(missing.map((m) => m.importName), ["SunburstChart", "ToolboxComponent"]);
  registerAdminCharts(SunburstChart, ToolboxComponent);
  const after = render(sunburst);
  assert.deepEqual(missingChartRegistrations(sunburst, after.getOption()), []);
  after.dispose();
});

test("missing-registration hint names the series / key and the exact import + registerAdminCharts call", () => {
  const missing = missingChartRegistrations({ series: [{ type: "gauge" }, { type: "line" }], toolbox: { show: true }, grid: {} }, { series: [{ type: "line" }], toolbox: [{ show: true }], grid: [{ z: 0, left: "10%" }] });
  assert.deepEqual(missing, [
    { kind: "series", name: "gauge", importName: "GaugeChart", from: "echarts/charts" },
    { kind: "component", name: "toolbox", importName: "ToolboxComponent", from: "echarts/components" },
  ]);
  const hint = chartRegistrationHint(missing, "营收");
  assert.match(hint, /AdminChart「营收」/);
  assert.match(hint, /series type "gauge" → import \{ GaugeChart \} from "echarts\/charts";/);
  assert.match(hint, /registerAdminCharts\(GaugeChart, ToolboxComponent\)/);
  // Unknown custom series still get a readable name.
  assert.equal(missingChartRegistrations({ series: [{ type: "liquidFill" }] }, {})[0]?.importName, "LiquidFillChart");
  assert.equal(chartShapeKey({ series: [{ type: "bar" }, { type: "line" }], grid: {}, tooltip: {}, animation: false }), "bar,line|grid,tooltip");
});

test("chart font = the page's computed font (Inter first), fallback to the tokens.css stack", () => {
  assert.equal(chartFontFamily('Inter, "PingFang SC", sans-serif'), 'Inter, "PingFang SC", sans-serif');
  assert.equal(chartFontFamily(""), CHART_FONT_FALLBACK);
  assert.equal(chartFontFamily(undefined), CHART_FONT_FALLBACK);
  assert.match(CHART_FONT_FALLBACK, /^Inter,/);
  const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
  // The root font is `var(--aui-font-sans)`; the fallback must be that exact stack.
  assert.match(tokens, /\/1\.5 var\(--aui-font-sans\)/, "root font is the --aui-font-sans token");
  const stack = /--aui-font-sans:\s*([^;]+);/.exec(tokens)?.[1]?.trim();
  assert.equal(CHART_FONT_FALLBACK, stack, "chart fallback mirrors --aui-font-sans");
  const instance = readFileSync(new URL("../src/chart-instance.ts", import.meta.url), "utf8");
  assert.match(instance, /textStyle: \{ color: colors\.secondary, fontFamily, /, "theme text uses the computed font");
  assert.doesNotMatch(instance, /fontFamily: "system-ui/, "no hard-coded font stack");
});

test("charts subpath loads echarts/core, never the whole library", () => {
  for (const file of ["charts.tsx", "chart-instance.ts", "chart-registry.ts"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /^import (?!type )[^;]*from "echarts";/m, `${file}: no runtime import of "echarts"`);
    assert.doesNotMatch(source, /import \* as echarts from "echarts"/, file);
  }
});
