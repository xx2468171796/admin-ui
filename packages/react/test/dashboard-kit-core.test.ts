import assert from "node:assert/strict";
import test from "node:test";
import { bulletGeometry, bulletLabels, cohortMax, cohortShade, funnelStats, ringGeometry } from "../src/dashboard-kit-core.ts";
import { targetBarOption } from "../src/chart-options-targets.ts";
import { resolveVizTokens } from "../src/chart-options.ts";
import { chartColors } from "../src/viz-palette.ts";
import { createPalette } from "../src/palette.ts";
import { VIZ_BRAND, VIZ_STATUS } from "../src/viz-palette.ts";
const brandColors = (hex: string) => chartColors(createPalette(hex, "light"));

test("子弹图：量程默认取目标和当前的较大者，目标落在右端；缺值不画 0 宽的条", () => {
  const g = bulletGeometry({ value: 204, target: 1200, timeProgress: 0.15 });
  assert.equal(g.max, 1200);
  assert.equal(g.target, 1);
  assert.ok(Math.abs(g.value! - 0.17) < 1e-9);
  assert.equal(g.expectedValue, 180);
  assert.ok(Math.abs(g.expected! - 0.15) < 1e-9);
  assert.equal(g.behind, false, "17% 已达，时间进度 15%，不落后");
  assert.equal(bulletGeometry({ value: 100, target: 1200, timeProgress: 0.15 }).behind, true);
  const empty = bulletGeometry({ value: null, target: 80, max: 100 });
  assert.equal(empty.value, null);
  assert.equal(empty.target, 0.8);
  assert.equal(bulletGeometry({ value: 130, target: 100 }).max, 130, "超额完成时量程跟着当前值走");
  assert.equal(bulletGeometry({ value: 130, target: 100, max: 100 }).value, 1, "给了量程就截断在 100%");
  assert.equal(bulletGeometry({ value: 0, target: 0 }).max, 1, "量程退化时不除以 0");
});

test("子弹图：分档按值换成比例、升序、最后一档到 1", () => {
  assert.deepEqual(bulletGeometry({ value: 65, target: 80, max: 100, bands: [80, 50, 150, -1] }).bands, [0.5, 0.8, 1]);
});

test("子弹图刻度：目标 → 时间进度 → 0 → 量程，太近的丢掉", () => {
  const d29 = bulletLabels(bulletGeometry({ value: 65, target: 80, max: 100 }));
  assert.deepEqual(d29.map((m) => m.kind), ["min", "target"], "目标 80% 右对齐到刻度，量程 100% 太挤就不写");
  assert.deepEqual(bulletLabels(bulletGeometry({ value: 30, target: 50, max: 100 })).map((m) => m.kind), ["min", "target", "max"]);
  const d30 = bulletLabels(bulletGeometry({ value: 204, target: 1200, timeProgress: 0.15 }));
  assert.deepEqual(d30.map((m) => m.kind), ["expected", "target"], "时间进度 15% 太靠近 0，丢掉 0；目标在右端时不再写量程");
});

test("分步漏斗：步骤转化、整体转化、流失最多（按人数 / 按转化率）", () => {
  const steps = [{ count: 312 }, { count: 268 }, { count: 174 }, { count: 96 }, { count: 31 }];
  const byCount = funnelStats(steps);
  assert.equal(byCount.steps[0]!.stepRate, null);
  assert.ok(Math.abs(byCount.steps[1]!.stepRate! - 268 / 312) < 1e-12);
  assert.ok(Math.abs(byCount.steps[4]!.overallRate! - 31 / 312) < 1e-12);
  assert.equal(byCount.steps[2]!.lost, 94);
  assert.equal(byCount.biggestDrop, 2, "D30：需求确认这一步流失 94 位，最多");
  assert.equal(funnelStats(steps, "rate").biggestDrop, 4, "按转化率看最低的是成交这步 32.3%");
  assert.ok(Math.abs(byCount.overall! - 31 / 312) < 1e-12);
  const missing = funnelStats([{ count: 100 }, { count: null }, { count: 20 }]);
  assert.equal(missing.steps[1]!.stepRate, null);
  assert.equal(missing.steps[2]!.stepRate, null, "上一步未知时不算转化率");
  assert.equal(missing.steps[2]!.overallRate, 0.2);
  assert.equal(funnelStats([{ count: 0 }, { count: 0 }]).biggestDrop, null);
});

test("cohort：面板色 → 主色按量级（审阅 06），未到期返回 null；只有很深的格子（> 72%）反白字", () => {
  assert.equal(cohortShade(null, 14), null);
  assert.deepEqual(cohortShade(5, 0), { percent: 8, onBrand: false });
  assert.deepEqual(cohortShade(0, 0), { percent: 8, onBrand: false }, "全零批次是 0，不是未到期");
  assert.deepEqual(cohortShade(14, 14), { percent: 92, onBrand: true });
  assert.deepEqual(cohortShade(0, 14), { percent: 8, onBrand: false });
  assert.equal(cohortShade(11, 14)!.onBrand, true, "11 / 14 → 74% 主色 → 白字");
  assert.equal(cohortShade(10, 14)!.onBrand, false, "10 / 14 → 68%：正文色");
  assert.equal(cohortShade(14, 14, { ceil: 60 })!.onBrand, false);
  assert.equal(cohortMax([[2.3, 8.3, null], [null, 14]]), 14);
});

test("进度环：弧长、目标刻度在 12 点方向起顺时针", () => {
  const g = ringGeometry({ value: 7, max: 12, target: 9.6, size: 92, stroke: 9 });
  assert.ok(Math.abs(g.dash - (7 / 12) * g.circumference) < 1e-9);
  assert.ok(g.tick);
  const top = ringGeometry({ value: 0, max: 10, target: 0 });
  assert.equal(top.tick!.x1, top.center, "目标 0 = 正上方");
  assert.ok(top.tick!.y1 < top.center);
  assert.equal(ringGeometry({ value: null, max: 10 }).ratio, null);
});

type Bar = { value: number; itemStyle: { color?: string; borderType?: string }; label: { show: boolean; formatter: string } } | "-";
test("targetBarOption：进行中虚线空心、没开始的留空不画 0、目标刻度、值标签不被刻度压住", () => {
  const o = targetBarOption({ categories: ["6 月", "7 月", "8 月", "9 月", "10 月"], values: [1080, 1165, 1020, 1248, 204], targets: [1100, 1100, 1200, 1200, 1200], inProgress: true });
  const [bars, ticks] = o.series as { data: unknown[]; type: string }[];
  const b = bars!.data as Bar[];
  const last = b[4] as Exclude<Bar, "-">;
  assert.equal(last.itemStyle.borderType, "dashed");
  assert.equal(last.label.formatter, "进行中");
  assert.equal((b[1] as Exclude<Bar, "-">).label.show, true, "超过目标的月份标签在柱顶");
  assert.equal((b[0] as Exclude<Bar, "-">).label.show, false, "没到目标的月份标签挪到刻度上方");
  assert.equal(ticks!.type, "scatter");
  assert.equal((ticks!.data[0] as { label: { show: boolean } }).label.show, true);
  const hours = targetBarOption({ categories: ["9", "10", "11", "12", "13", "14", "15", "16"], values: [6, 8, 9, 2, 4, 7, 4, null], inProgress: 6 });
  assert.equal((hours.series as unknown[]).length, 1, "没有目标就只有柱子");
  assert.equal(((hours.series as { data: unknown[] }[])[0]!.data[7]), "-", "还没到的小时留空");
  assert.deepEqual(hours.legend, { show: false });
  const day = targetBarOption({ categories: ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18"], values: [6, 8, 9, 2, 4, 7, 4, null, null, null], inProgress: 6 });
  const dayNow = ((day.series as { data: Bar[] }[])[0]!.data[6]) as Exclude<Bar, "-">;
  assert.equal(dayNow.label.formatter, "4", "格子多时进行中的柱子标数值，不写「进行中」免得压到旁边的柱子");
  assert.equal(dayNow.itemStyle.borderType, "dashed");
  const resolved = resolveVizTokens(o, brandColors("#357450"));
  assert.equal(((resolved.series as { data: Bar[] }[])[0]!.data[0] as Exclude<Bar, "-">).itemStyle.color, "#357450");
  assert.equal(((resolved.series as { data: Bar[] }[])[0]!.data[4] as Exclude<Bar, "-">).itemStyle.color, "#35745026");
  assert.equal(((resolved.series as { itemStyle?: { color?: string } }[])[0]!.itemStyle?.color), "#357450", "系列色 = 柱色，图例色块对得上");
  const lifted = (b[3] as Exclude<Bar, "-"> & { label: { distance?: number } }).label.distance ?? 0;
  assert.ok(lifted >= 10, "目标刻度紧贴柱顶下方时，柱顶数值往上让开");
  const statusColours = new Set<string>(Object.values(VIZ_STATUS.light));
  assert.ok(!statusColours.has(VIZ_BRAND), "系列色不用状态色");
});

test("targetBarOption：提示框转义分类名", () => {
  const o = targetBarOption({ categories: ["<b>x</b>"], values: [1], targets: [2] });
  const formatter = (o.tooltip as { formatter: (p: unknown) => string }).formatter;
  const html = formatter([{ dataIndex: 0 }]);
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.match(html, /<span>完成<\/span><b>50%<\/b>/, "完成率 row");
  assert.ok(!html.includes("<b>x</b>"));
});
