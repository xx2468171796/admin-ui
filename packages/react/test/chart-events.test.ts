import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chartEventNames, chartPoint, dispatchChartEvent, syncChartEvents, type AdminChartEvent, type AdminChartPoint, type ChartEventSource } from "../src/chart-events.ts";
import { chartFormatter } from "../src/chart-formatter.ts";
import { chartColors, resolveVizToken, VIZ_STATUS, VIZ_STATUS_TOKENS, vizStatus } from "../src/viz-palette.ts";
import { createPalette, contrast } from "../src/palette.ts";
import { cohortHeatmapOption, funnelPlotOption, resolveVizTokens, timeSeriesOption, toleranceBandOption } from "../src/chart-options.ts";

/** A fake ECharts instance: records on / off calls and can fire an event. */
function fakeChart() {
  const handlers = new Map<string, Set<(p: AdminChartEvent) => void>>();
  const log: string[] = [];
  return {
    log,
    handlers,
    on(name: string, handler: (p: AdminChartEvent) => void) {
      log.push(`on:${name}`);
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)?.add(handler);
    },
    off(name: string, handler: (p: AdminChartEvent) => void) {
      log.push(`off:${name}`);
      handlers.get(name)?.delete(handler);
    },
    fire(name: string, params: AdminChartEvent) {
      for (const h of handlers.get(name) ?? []) h(params);
    },
  };
}

test("AdminChart events: new handler objects bind nothing new, added / removed names bind / unbind, handlers read live", () => {
  const chart = fakeChart();
  const bound = new Map<string, (p: AdminChartEvent) => void>();
  const calls: string[] = [];
  let source: ChartEventSource = { onEvents: { click: () => calls.push("click v1") } };
  const sync = () => syncChartEvents(chart, chartEventNames(source), bound, () => source);
  sync();
  assert.deepEqual(chart.log, ["on:click"]);
  // A re-render with a fresh object (same names): no re-binding, but the new handler is the one called.
  source = { onEvents: { click: () => calls.push("click v2") } };
  sync();
  assert.deepEqual(chart.log, ["on:click"]);
  chart.fire("click", { componentType: "series", dataIndex: 0 });
  assert.deepEqual(calls, ["click v2"]);
  // Add a name, then remove click.
  source = { onEvents: { click: () => calls.push("click v3"), legendselectchanged: () => calls.push("legend") } };
  sync();
  assert.deepEqual(chart.log, ["on:click", "on:legendselectchanged"]);
  source = { onEvents: { legendselectchanged: () => calls.push("legend") } };
  sync();
  assert.deepEqual(chart.log, ["on:click", "on:legendselectchanged", "off:click"]);
  assert.equal(chart.handlers.get("click")?.size, 0, "click really unbound");
  chart.fire("legendselectchanged", {});
  assert.deepEqual(calls, ["click v2", "legend"]);
  // An undefined handler does not count as a name.
  assert.deepEqual(chartEventNames({ onEvents: { click: undefined } }), []);
});

test("onPointClick: fires for series data points only (drill-down), alongside onEvents.click", () => {
  const points: AdminChartPoint[] = [];
  const clicks: AdminChartEvent[] = [];
  const source: ChartEventSource = { onEvents: { click: (p) => clicks.push(p) }, onPointClick: (p) => points.push(p) };
  assert.deepEqual(chartEventNames(source), ["click"], "one click binding for both");
  assert.deepEqual(chartEventNames({ onPointClick: () => undefined }), ["click"]);
  const params: AdminChartEvent = { componentType: "series", seriesType: "bar", seriesIndex: 1, seriesId: "gmv", seriesName: "流水", dataIndex: 3, name: "华东", value: 120, data: { value: 120 } };
  dispatchChartEvent(source, "click", params);
  dispatchChartEvent(source, "click", { componentType: "legend", name: "流水" });
  dispatchChartEvent(source, "click", { componentType: "xAxis", value: "华东" });
  assert.equal(clicks.length, 3);
  assert.equal(points.length, 1, "title / legend / axis clicks are not points");
  assert.deepEqual({ ...points[0], event: undefined }, { seriesIndex: 1, seriesId: "gmv", seriesName: "流水", seriesType: "bar", dataIndex: 3, name: "华东", value: 120, data: { value: 120 }, event: undefined });
  assert.equal(chartPoint({ componentType: "series" }), null, "no dataIndex → not a point");
});

test("AdminChart exposes ref.getInstance and the event props; the chart is not re-created for handler changes", () => {
  // The props live in chart-props.ts (no ECharts types, so the root's LazyAdminChart can share them); ./charts fills them.
  const props = readFileSync(new URL("../src/chart-props.ts", import.meta.url), "utf8");
  for (const prop of ["onEvents?:", "onPointClick?:", "ref?: Ref<{ getInstance: () => Instance | null }>"]) assert.ok(props.includes(prop), prop);
  const charts = readFileSync(new URL("../src/charts.tsx", import.meta.url), "utf8");
  assert.match(charts, /export type AdminChartProps = AdminChartPropsOf<EChartsOption, EChartsType>;/);
  const instance = readFileSync(new URL("../src/chart-instance.ts", import.meta.url), "utf8");
  assert.match(instance, /useImperativeHandle\(input\.ref, \(\) => \(\{ getInstance: \(\) => chart\.current \}\)/);
  // The init effect depends on theme / font / visibility only (plus the stable container ref and `bind`) — never on the handlers.
  assert.match(instance, /\}, \[themeKey, fontScale, show, el, bind\]\);/);
  assert.match(instance, /const bind = useCallback\(\(\) => \{[^]*?\}, \[\]\);/);
});

test("status colours are palette tokens: funnel / tolerance band / annotations follow the palette and dark mode", () => {
  assert.equal(vizStatus("bad"), "aui:status:bad:");
  assert.deepEqual(Object.values(VIZ_STATUS_TOKENS), ["aui:status:good:", "aui:status:warning:", "aui:status:bad:", "aui:status:neutral:"]);
  // Backward compatible: the hex table is still exported unchanged.
  assert.equal(VIZ_STATUS.light.warning, "#fab219");
  for (const mode of ["light", "dark"] as const) {
    const colors = chartColors(createPalette("#357450", mode));
    assert.equal(resolveVizToken(vizStatus("warning"), colors), colors.status.warning);
    assert.equal(resolveVizToken(`${vizStatus("bad")}3d`, colors), `${colors.status.bad}3d`, "alpha suffix");
    assert.equal(resolveVizToken("aui:status:nope:", colors), colors.status.neutral, "unknown name → neutral");
    // The resolved warning reads on the panel (the old fixed #fab219 on white was ~1.9:1).
    assert.ok(contrast(colors.status.warning, colors.surface) >= 3, `${mode}: warning ≥ 3:1 on the panel`);
  }
  const light = chartColors(createPalette("#357450", "light"));
  const dark = chartColors(createPalette("#357450", "dark"));
  const t0 = Date.UTC(2026, 8, 1);
  const options = [
    funnelPlotOption({ items: [{ name: "x", n: 1_000_000, value: 0.9 }, { name: "y", n: 10, value: 0.2 }], theoretical: 0.95, sigma: 2 }),
    toleranceBandOption({ points: [{ t: t0, actual: 0.9, n: 1_000_000 }, { t: t0 + 1, actual: 0.95, n: 10 }], theoretical: 0.95, sigma: 2, annotations: [{ at: t0, label: "发版" }] }),
    timeSeriesOption({ series: [{ id: "a", name: "A", points: [[t0, 1]] }], annotations: [{ at: t0, label: "发版" }, { from: t0, to: t0 + 1, label: "活动" }] }),
    cohortHeatmapOption({ cohorts: ["a"], periods: ["D0", "D1"], values: [[1, 0.5]] }),
  ];
  for (const option of options) {
    const raw = JSON.stringify(option);
    for (const hex of ["#fab219", "#d03b3b", "#898781", "rgba(15,23,42", "rgba(255,255,255", "#e5e7eb", "#182230"]) assert.ok(!raw.includes(hex), `builders write no fixed ${hex}`);
    const resolvedLight = JSON.stringify(resolveVizTokens(option, light));
    const resolvedDark = JSON.stringify(resolveVizTokens(option, dark));
    assert.doesNotMatch(resolvedLight, /aui:/, "every token resolved");
    assert.notEqual(resolvedLight, resolvedDark, "light and dark differ");
  }
  const funnel = JSON.stringify(resolveVizTokens(options[0]!, light));
  assert.ok(funnel.includes(light.status.bad) && funnel.includes(light.status.neutral), "funnel uses the palette's danger / note");
});

test("formatters are typed through chartFormatter: no `as never` casts left in the option builders except one legend item", () => {
  const fn = (p: { dataIndex: number }) => `#${p.dataIndex}`;
  assert.equal(chartFormatter(fn), fn, "identity at runtime");
  assert.equal(chartFormatter(fn)({ dataIndex: 2 }), "#2");
  let casts = 0;
  for (const file of ["chart-options.ts", "chart-options-kinds.ts", "chart-options-targets.ts"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    casts += source.match(/as never/g)?.length ?? 0;
    assert.doesNotMatch(source, /formatter: \(\(/, `${file}: formatter callbacks go through chartFormatter`);
  }
  assert.ok(casts <= 1, `as never casts: ${casts} (was 15)`);
});
