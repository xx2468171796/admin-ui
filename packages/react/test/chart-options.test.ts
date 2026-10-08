import assert from "node:assert/strict";
import test from "node:test";
import {
  cohortHeatmapOption,
  escapeHtml,
  funnelPlotOption,
  timeAxisLabel,
  timeSeriesOption,
  toleranceBandOption,
  withGaps,
  resolveVizTokens,
} from "../src/chart-options.ts";
import { chartColors, VIZ_BRAND, VIZ_STATUS, vizCategory } from "../src/viz-palette.ts";
import { createPalette } from "../src/palette.ts";
const brandColors = (hex: string) => chartColors(createPalette(hex, "light"));

type AnySeries = { id: string; name?: string; data: unknown[]; lineStyle?: { type?: unknown }; markLine?: { data: unknown[] }; markArea?: { data: unknown[] } };
const seriesOf = (o: { series?: unknown }) => o.series as AnySeries[];

test("提示框里的用户文字必须转义（ECharts 不转义自定义 formatter）", () => {
  assert.equal(escapeHtml(`<img src=x onerror=alert(1)>"'&`), "&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;");
  const o = funnelPlotOption({ items: [{ name: "<b>房间</b>", n: 50_000, value: 0.95 }], theoretical: 0.95, sigma: 5 });
  const html = (o.tooltip as { formatter: (p: unknown) => string }).formatter({ seriesId: "items", dataIndex: 0 });
  assert.ok(html.includes("&lt;b&gt;房间&lt;/b&gt;"));
  assert.ok(!html.includes("<b>房间</b>"));
  const ts = timeSeriesOption({ series: [{ id: "a", name: "<script>", points: [[1, 2]] }] });
  const tip = (ts.tooltip as { formatter: (p: unknown) => string }).formatter([{ seriesName: "<script>", value: [1, 2], marker: "", axisValueLabel: "t" }]);
  assert.ok(!tip.includes("<script>"));
});

test("缺数据处插入 null 断线，而不是直线连过去", () => {
  const pts = withGaps([[0, 1], [60_000, 2], [300_000, 3]], 60_000);
  assert.deepEqual(pts.map((p) => p[1]), [1, 2, null, 3]);
  const o = timeSeriesOption({ series: [{ id: "s", name: "在线", points: [[0, 1], [60_000, 2], [300_000, 3]] }], expectedIntervalMs: 60_000 });
  assert.ok(seriesOf(o)[0]!.data.some((d) => Array.isArray(d) && d[1] === null));
});

test("进行中的最后一个桶画成虚线尾段，且共用衔接点", () => {
  const o = timeSeriesOption({ series: [{ id: "gmv", name: "流水", points: [[1, 10], [2, 12], [3, 4]] }], inProgress: true });
  const [main, tail] = seriesOf(o);
  assert.equal(main!.data.length, 2);
  assert.equal(tail!.id, "gmv__tail");
  assert.deepEqual(tail!.data, [[2, 12], [3, 4]]);
  assert.ok(Array.isArray(tail!.lineStyle?.type), "虚线");
});

test("事件标注：单点用 markLine，区间用 markArea，只挂在第一条序列", () => {
  const o = timeSeriesOption({
    series: [{ id: "a", name: "A", points: [[1, 1]] }, { id: "b", name: "B", points: [[1, 2]] }],
    annotations: [{ at: 1, label: "发版 v2.3" }, { from: 1, to: 2, label: "国庆活动" }],
  });
  const [a, b] = seriesOf(o);
  assert.equal(a!.markLine?.data.length, 1);
  assert.equal(a!.markArea?.data.length, 1);
  assert.equal(b!.markLine, undefined);
});

test("实时面板关闭动画；多序列按固定分类色板顺序上色", () => {
  const o = timeSeriesOption({ series: [{ id: "a", name: "A", points: [] }, { id: "b", name: "B", points: [] }], live: true, mode: "dark" });
  assert.equal(o.animation, false);
  const colors = seriesOf(o).map((s) => (s as unknown as { itemStyle: { color: string } }).itemStyle.color);
  assert.deepEqual(colors, [vizCategory(0), vizCategory(1)], "category tokens: AdminChart swaps in the palette's option hues");
});

test("容差带：样本不足不画带、点为灰色空心；越界点标红", () => {
  const o = toleranceBandOption({
    theoretical: 0.95,
    sigma: 2,
    minN: 1000,
    points: [
      { t: 1, actual: 0.8, n: 100 },
      { t: 2, actual: 0.951, n: 1_000_000 },
      { t: 3, actual: 0.94, n: 1_000_000 },
    ],
  });
  const series = seriesOf(o);
  const lower = series.find((s) => s.id === "band-lower")!;
  assert.equal((lower.data[0] as [number, null])[1], null);
  const actual = series.find((s) => s.id === "actual")!;
  const colors = actual.data.map((d) => (d as { itemStyle: { color: string } }).itemStyle.color);
  assert.equal(colors[0], VIZ_STATUS.light.neutral);
  assert.equal(colors[1], VIZ_BRAND);
  assert.equal(colors[2], VIZ_STATUS.light.bad);
  assert.equal((actual.data[0] as { symbol: string }).symbol, "emptyCircle");
});

test("漏斗图只给越过外控制线的点加标签", () => {
  const o = funnelPlotOption({
    theoretical: 0.95,
    sigma: 2,
    items: [
      { name: "正常房", n: 1_000_000, value: 0.951 },
      { name: "异常房", n: 1_000_000, value: 0.93 },
      { name: "小房间", n: 50, value: 0.2 },
    ],
  });
  const items = seriesOf(o).find((s) => s.id === "items")!;
  const shown = items.data.map((d) => (d as { label: { show: boolean } }).label.show);
  assert.deepEqual(shown, [false, true, false], "小样本极端值不标注");
});

test("留存热力表：未到期格子为 -，色阶不被第 0 期 100% 压扁", () => {
  const o = cohortHeatmapOption({
    cohorts: ["09-01", "09-02"],
    periods: ["D0", "D1", "D7"],
    values: [[1, 0.4, 0.1], [1, 0.35, null]],
  });
  const data = seriesOf(o)[0]!.data as { value: [number, number, number | "-"] }[];
  assert.equal(data.find((d) => d.value[0] === 2 && d.value[1] === 1)!.value[2], "-");
  assert.equal((o.visualMap as { max: number }).max, 40);
});

test("图例放右上：不压在左上角的 y 轴名称（单位）上", () => {
  const ts = timeSeriesOption({ series: [{ id: "a", name: "今天", points: [[0, 1]] }, { id: "b", name: "上周", points: [[0, 2]] }], unit: "金币" });
  assert.equal((ts.legend as { right?: number; left?: number }).right, 0);
  assert.equal((ts.legend as { left?: number }).left, undefined);
  const band = toleranceBandOption({ points: [{ t: 0, actual: 0.95, n: 5000 }], theoretical: 0.95, sigma: 5 });
  assert.equal((band.legend as { right?: number }).right, 0);
  const funnel = funnelPlotOption({ items: [{ name: "x", n: 5000, value: 0.95 }], theoretical: 0.95, sigma: 5 });
  assert.equal((funnel.legend as { right?: number }).right, 0);
});

test("时间轴标签：一天内显示 HH:mm，跨天在零点显示 MM-dd，不再出现孤零零的「24」", () => {
  const midnight = new Date(2026, 8, 24, 0, 0).getTime();
  const afternoon = new Date(2026, 8, 24, 14, 5).getTime();
  const hour = 3_600_000;
  assert.equal(timeAxisLabel(midnight, 6 * hour), "00:00");
  assert.equal(timeAxisLabel(afternoon, 6 * hour), "14:05");
  assert.equal(timeAxisLabel(midnight, 3 * 24 * hour), "09-24");
  assert.equal(timeAxisLabel(afternoon, 3 * 24 * hour), "14:05");
  assert.equal(timeAxisLabel(afternoon, 30 * 24 * hour), "09-24");
  const o = timeSeriesOption({ series: [{ id: "s", name: "在线", points: [[midnight - 2 * hour, 1], [midnight + 2 * hour, 2]] }] });
  const axis = o.xAxis as { axisLabel: { hideOverlap: boolean; formatter: (v: number) => string } };
  assert.equal(axis.axisLabel.hideOverlap, true);
  assert.equal(axis.axisLabel.formatter(midnight), "00:00", "4 小时的窗口跨过零点也显示时刻");
  const week = timeSeriesOption({ series: [{ id: "s", name: "流水", points: [[midnight, 1], [midnight + 8 * 24 * hour, 2]] }] });
  assert.equal((week.xAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter(afternoon), "09-24");
  const band = toleranceBandOption({ points: [{ t: midnight, actual: 0.95, n: 5000 }, { t: midnight + 2 * 24 * hour, actual: 0.96, n: 6000 }], theoretical: 0.95, sigma: 5 });
  assert.equal((band.xAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter(midnight), "09-24");
});

test("日粒度序列横轴只标日期；前后都缺的孤点画成圆点", () => {
  const day = 86_400_000, t0 = Date.UTC(2026, 8, 20);
  const o = timeSeriesOption({ series: [{ id: "a", name: "a", points: [[t0, 1], [t0 + day, null], [t0 + 2 * day, 3], [t0 + 3 * day, null]] }], expectedIntervalMs: day });
  const fmt = (o.xAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter;
  assert.match(fmt(t0 + 2 * day + 12 * 3_600_000), /^\d{2}-\d{2}$/);
  const data = seriesOf(o)[0]!.data as unknown[];
  const dots = data.filter((d) => d && typeof d === "object" && !Array.isArray(d));
  assert.equal(dots.length, 2, "t0 and t0+2d are both isolated");
});

test("几分钟的实时序列横轴带秒；漏斗图纵轴最多 6 格", () => {
  const t = Date.UTC(2026, 8, 24, 14, 58, 7);
  const o = timeSeriesOption({ series: [{ id: "a", name: "a", points: [[t, 1], [t + 180_000, 2]] }] });
  const fmt = (o.xAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter;
  assert.match(fmt(t), /^\d{2}:\d{2}:\d{2}$/);
  const f = funnelPlotOption({ items: [{ name: "a", n: 1500, value: 0.65 }, { name: "b", n: 1400, value: 1.26 }, { name: "c", n: 900, value: 2.1 }], theoretical: 0.95, sigma: 12 });
  const y = f.yAxis as { min: number; max: number; interval: number };
  assert.ok((y.max - y.min) / y.interval <= 6, `${y.min}..${y.max} by ${y.interval}`);
});

test("品牌色：单系列/容差带/热力图跟随主题色，多系列保持色盲校验的分类色", () => {
  const one = timeSeriesOption({ series: [{ id: "a", name: "在线", points: [[0, 1], [1, 2]] }] });
  const two = timeSeriesOption({ series: [{ id: "a", name: "甲", points: [[0, 1]] }, { id: "b", name: "乙", points: [[0, 2]] }] });
  const green = "#357450";
  const r1 = resolveVizTokens(one, brandColors(green)) as { series: { lineStyle: { color: string } }[] };
  assert.equal(r1.series[0]!.lineStyle.color, green);
  const r2 = resolveVizTokens(two, brandColors(green)) as { series: { lineStyle: { color: string } }[] };
  const legacy = chartColors(createPalette(green, "light"));
  assert.deepEqual(r2.series.map((s) => s.lineStyle.color), [legacy.categorical[0], legacy.categorical[1]], "categories = the palette's option hues (blue, orange …)");
  const band = resolveVizTokens(toleranceBandOption({ points: [{ t: 0, actual: 0.95, n: 5000 }], theoretical: 0.95, sigma: 5 }), brandColors(green));
  assert.ok(!JSON.stringify(band).includes(VIZ_BRAND), "容差带里不能残留占位符");
  assert.ok(JSON.stringify(band).includes(`${green}3d`), "带宽区域用品牌色加透明度");
  const heat = resolveVizTokens(cohortHeatmapOption({ cohorts: ["w1"], periods: ["0", "1"], values: [[1, 0.4]] }), brandColors(green)) as { visualMap: { inRange: { color: string[] } } };
  assert.equal(heat.visualMap.inRange.color.length, 4);
  assert.ok(heat.visualMap.inRange.color.every((c) => /^#[0-9a-f]{6}$/.test(c)));
  // A raw host option with one line series and no colours follows the brand; a pie keeps categorical.
  assert.deepEqual((resolveVizTokens({ series: [{ type: "line", data: [1] }] }, brandColors(green)) as { color: string[] }).color, [green]);
  assert.deepEqual((resolveVizTokens({ series: [{ type: "pie", data: [1] }] }, brandColors(green)) as { color?: string[] }).color, [...legacy.categorical], "a pie gets the categorical order");
});
