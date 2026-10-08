import assert from "node:assert/strict";
import test from "node:test";
import { createPalette, contrast, paletteById } from "../src/palette.ts";
import { chartColors, resolveVizToken, VIZ_CATEGORY_HUES, VIZ_OTHER, VIZ_SURFACE, vizBrandStep, vizCategory, vizOptionColor } from "../src/viz-palette.ts";
import { resolveVizTokens } from "../src/chart-options.ts";
import { barOption, donutOption, donutSlices, stackedBarOption, stackSeries, tooltipHtml, chartValueText } from "../src/chart-options-kinds.ts";
import { targetBarOption } from "../src/chart-options-targets.ts";
import { cohortHeatmapOption } from "../src/chart-options.ts";

const forest = createPalette(paletteById("forest"), "light");
const forestDark = createPalette(paletteById("forest"), "dark");
const ocean = createPalette(paletteById("ocean"), "light");
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

test("审阅 06 色板：类别 = 选项标签 10 色里固定顺序的 8 个，跟色卡和深浅走；绿 = 主色留给单系列，灰 = 其他", () => {
  const c = chartColors(forest);
  assert.deepEqual(VIZ_CATEGORY_HUES, ["blue", "orange", "teal", "pink", "olive", "violet", "yellow", "red"]);
  assert.deepEqual(c.categorical, VIZ_CATEGORY_HUES.map((hue) => forest.options[hue].color), "a 「报价」 tag and its chart slice are the same colour");
  assert.equal(c.other, forest.options.gray.color);
  assert.equal(c.brand, forest.primary);
  assert.ok(!c.categorical.includes(c.brand), "green stays for single series");
  assert.equal(new Set(c.categorical).size, 8, "no repeats");
  assert.notDeepEqual(chartColors(ocean).categorical, c.categorical, "another palette → other category colours");
  assert.notEqual(chartColors(ocean).brand, c.brand);
  const dark = chartColors(forestDark);
  assert.equal(dark.brand, forestDark.primary, "dark = the dark palette's primary (bars, funnels, bullets the same green)");
  assert.notDeepEqual(dark.categorical, c.categorical, "dark has its own option hues");
});

test("顺序色：面板色 → 主色 13 档，深色也从面板色起步（不出浅色亮块）；状态 / 发散 / 网格都从 token 来", () => {
  for (const palette of [forest, forestDark]) {
    const c = chartColors(palette);
    assert.equal(c.sequential.length, 13);
    const first = c.sequential[0]!;
    const surface = palette.vars.surface!;
    assert.ok(Math.abs(luminance(first) - luminance(surface)) < 0.08, `${palette.mode}: step 0 stays near the panel`);
    assert.ok(contrast(c.sequential[12]!, palette.primary) < 1.05, `${palette.mode}: step 12 = the primary`);
  }
  assert.ok(luminance(chartColors(forestDark).sequential[0]!) < 0.2, "dark heat cells start dark");
  const c = chartColors(forest);
  assert.equal(c.status.good, forest.primary);
  assert.equal(c.status.warning, forest.vars.warning);
  assert.equal(c.status.bad, forest.vars.danger);
  assert.deepEqual([c.diverging.negative, c.diverging.positive], [forest.vars.info, forest.vars.danger]);
  assert.match(c.grid, /^#[0-9a-f]{6}$/);
  assert.notEqual(c.grid, forest.vars.line, "gridlines lighter than the line colour");
  assert.match(c.hover, /^#[0-9a-f]{8}$/, "hover band = text with alpha");
});

test("颜色 token：类别、其他、选项色、面板色带透明度；第 9 个类别折成「其他」，不循环", () => {
  const c = chartColors(forest);
  assert.equal(resolveVizToken(vizCategory(1), c), c.categorical[1]);
  assert.equal(resolveVizToken(`${vizCategory(0)}3d`, c), `${c.categorical[0]}3d`);
  assert.equal(resolveVizToken(vizCategory(8), c), c.other, "past the eighth = 其他");
  assert.equal(resolveVizToken(VIZ_OTHER, c), c.other);
  assert.equal(resolveVizToken(vizOptionColor("yellow"), c), forest.options.yellow.color);
  assert.equal(resolveVizToken(VIZ_SURFACE, c), forest.vars.surface);
  assert.equal(resolveVizToken("#123456", c), null);
  const heat = resolveVizTokens({ series: [{ type: "heatmap", data: [] }], visualMap: { inRange: { color: [vizBrandStep(0), vizBrandStep(12)] } } }, c) as { visualMap: { inRange: { color: string[] } } };
  assert.deepEqual(heat.visualMap.inRange.color, [c.sequential[0], c.sequential[12]]);
});

const resolvedJson = (o: unknown) => JSON.stringify(resolveVizTokens(o as never, chartColors(forestDark)));

test("新图表类型：每个构造器的颜色都能换成色卡色（不留 token、不写死蓝灰）", () => {
  const options = [
    barOption({ categories: ["待分配", "跟进中"], values: [15, 117], name: "客户数", unit: "位" }),
    barOption({ categories: ["小王", "我"], values: [150, 109], horizontal: true, highlight: 1 }),
    donutOption({ items: [{ name: "官网", value: 60 }, { name: "LINE", value: 50 }] }),
    stackedBarOption({ categories: ["首通", "报价"], series: [{ name: "小王", values: [12, 5] }, { name: "我", values: [8, null] }] }),
    targetBarOption({ categories: ["9 月", "10 月"], values: [1248, 204], targets: [1200, 1200], inProgress: true }),
    cohortHeatmapOption({ cohorts: ["7 月"], periods: ["0", "30"], values: [[1, 0.4]], mode: "dark" }),
  ];
  for (const o of options) {
    const json = resolvedJson(o);
    assert.ok(!json.includes("aui:"), json.slice(0, 200));
    assert.ok(!/#edf0f4|#2c3a4d|#414d5c|#182230/.test(json), "no hard-coded blue-grey");
  }
});

test("柱 / 条形：缺数不画 0 柱；提示框写指标名和单位（不是「实际：117」）；条形横过来", () => {
  const o = barOption({ categories: ["待分配", "跟进中", "无效"], values: [15, 117, null], name: "客户数", unit: "位" });
  const series = (o.series as { data: unknown[]; barMaxWidth: number; barCategoryGap: string; label: { fontSize: number } }[])[0]!;
  assert.equal(series.data[2], "-");
  assert.equal(series.barMaxWidth, 32);
  assert.equal(series.barCategoryGap, "42%");
  assert.equal(series.label.fontSize, 11);
  const html = (o.tooltip as { formatter: (p: unknown) => string }).formatter([{ dataIndex: 1, color: "#357450" }]);
  assert.match(html, /客户数<\/span><b>117 位<\/b>/);
  assert.ok(!html.includes("实际"));
  const h = barOption({ categories: ["小王"], values: [1_500_000], horizontal: true });
  assert.equal((h.yAxis as { type: string; inverse: boolean }).type, "category");
  assert.equal((h.yAxis as { inverse: boolean }).inverse, true, "first category on top");
  assert.equal(chartValueText(1_500_000), "150万");
  assert.equal(chartValueText(null), "—");
});

test("环图：只 5 片（第 5 片是「其他」），0 / 空的不画，中间写合计", () => {
  const slices = donutSlices([{ name: "官网", value: 60 }, { name: "LINE", value: 50 }, { name: "转介绍", value: 30 }, { name: "展会", value: 20 }, { name: "电话", value: 5 }, { name: "其他渠道", value: 3 }, { name: "空", value: 0 }, { name: "缺", value: null }]);
  assert.deepEqual(slices.map((s) => s.name), ["官网", "LINE", "转介绍", "展会", "其他"]);
  assert.equal(slices[4]!.value, 8);
  assert.equal(slices[4]!.color, VIZ_OTHER);
  assert.equal(Math.round(slices.reduce((n, s) => n + s.share, 0) * 100), 100);
  assert.deepEqual(donutSlices([{ name: "a", value: 2, color: vizOptionColor("pink") }]).map((s) => s.color), [vizOptionColor("pink")], "an option's own tag colour wins");
  const o = donutOption({ items: [{ name: "官网", value: 60 }, { name: "LINE", value: 40 }], centerLabel: "新客户" });
  assert.deepEqual([(o.title as { text: string }).text, (o.title as { subtext: string }).subtext], ["100", "新客户"]);
});

test("堆叠：最多 8 段（多的并成「其他」）、只有最外一段圆角、段间 1px 面板色缝、提示带合计", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ name: `人${i}`, values: [i, 1] }));
  const list = stackSeries(many, 2);
  assert.equal(list.length, 8);
  assert.equal(list[7]!.name, "其他");
  assert.deepEqual(list[7]!.values, [7 + 8 + 9, 3]);
  const o = stackedBarOption({ categories: ["首通", "报价"], series: [{ name: "小王", values: [12, 5] }, { name: "我", values: [8, null] }], unit: "位" });
  type Bar = { data: ({ itemStyle: { borderRadius: unknown; borderColor: string; borderWidth: number } } | "-")[] };
  const [a, b] = o.series as Bar[];
  const cell = (s: Bar, i: number) => s.data[i] as Exclude<Bar["data"][number], "-">;
  assert.deepEqual(cell(b!, 0).itemStyle.borderRadius, [4, 4, 0, 0], "top segment rounded");
  assert.equal(cell(a!, 0).itemStyle.borderRadius, 0);
  assert.deepEqual(cell(a!, 1).itemStyle.borderRadius, [4, 4, 0, 0], "报价 has no 「我」 segment: 小王 is on top");
  assert.equal(cell(a!, 0).itemStyle.borderColor, VIZ_SURFACE);
  const html = (o.tooltip as { formatter: (p: unknown) => string }).formatter([{ dataIndex: 0, seriesIndex: 0, color: "#1" }, { dataIndex: 0, seriesIndex: 1, color: "#2" }]);
  assert.match(html, /合计<\/span><b>20 位<\/b>/);
});

test("提示框：转义用户文字；色块 + 名称 + 右对齐数值 + 单位", () => {
  const html = tooltipHtml({ head: "<b>9 月</b>", chip: "进行中", rows: [{ color: "#357450", name: "<i>实际</i>", value: 2_040_000, unit: "元" }], total: { label: "完成", text: "17.0%" } });
  assert.ok(!html.includes("<b>9 月</b>") && html.includes("&lt;b&gt;9 月&lt;/b&gt;"));
  assert.ok(html.includes("&lt;i&gt;实际&lt;/i&gt;"));
  assert.match(html, /<b>204万 元<\/b>/);
  assert.match(html, /aui-vz-tt-chip">进行中/);
});
