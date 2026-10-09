// The duration unit: seconds as 「3.2 小时」 under 48 hours, 「1.5 天」 from there; charts, cards and tables use it.
import test from "node:test";
import assert from "node:assert/strict";
import { DURATION_UNIT, durationColumns, formatDuration, isDurationUnit } from "../src/duration-format.ts";
import { barOption, tooltipHtml } from "../src/chart-options-kinds.ts";
import { targetBarOption } from "../src/chart-options-targets.ts";
import { timeSeriesOption } from "../src/chart-options.ts";

const H = 3600;
type Axis = { axisLabel: { formatter: (v: number) => string }; name?: string };

test("formatDuration: hours under 48 h, days from 48 h, one decimal without a trailing .0", () => {
  assert.equal(formatDuration(3.2 * H), "3.2 小时");
  assert.equal(formatDuration(3 * H), "3 小时");
  assert.equal(formatDuration(30 * 60), "30 分钟");
  assert.equal(formatDuration(20), "不到 1 分钟");
  assert.equal(formatDuration(0), "0 分钟");
  assert.equal(formatDuration(47.9 * H), "47.9 小时");
  assert.equal(formatDuration(48 * H), "2 天");
  assert.equal(formatDuration(36 * H), "36 小时");
  assert.equal(formatDuration(3 * 86_400), "3 天");
  assert.equal(formatDuration(1.5 * 86_400 * 3), "4.5 天");
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(Number.NaN), "—");
  assert.equal(formatDuration(-2 * H), "−2 小时");
});

test("isDurationUnit / DURATION_UNIT", () => {
  assert.equal(DURATION_UNIT, "duration");
  assert.ok(isDurationUnit("duration"));
  assert.ok(!isDurationUnit("小时"));
  assert.ok(!isDurationUnit(undefined));
});

test("charts: duration tooltips, value labels and axes read as hours / days", () => {
  const tip = tooltipHtml({ rows: [{ name: "中位数", value: 5 * H, unit: "duration" }] });
  assert.match(tip, /5 小时/);
  assert.doesNotMatch(tip, /duration/);
  const bar = barOption({ categories: ["一组", "二组"], values: [2 * H, 72 * H], unit: "duration" });
  assert.equal((bar.yAxis as Axis).axisLabel.formatter(72 * H), "3 天");
  const target = targetBarOption({ categories: ["9 月"], values: [10 * H], targets: [8 * H], unit: "duration" });
  assert.equal((target.yAxis as Axis).axisLabel.formatter(10 * H), "10 小时");
  const line = timeSeriesOption({ series: [{ id: "m", name: "中位数", points: [[0, 2 * H], [86_400_000, 3 * H]] }], unit: "duration" });
  assert.equal((line.yAxis as Axis).axisLabel.formatter(50 * H), "2.1 天");
  assert.equal((line.yAxis as Axis).name, undefined);
});

test("durationColumns: duration columns render hours / days, values stay numbers", () => {
  type Row = { id: string; owner: string; median: number };
  const fields = [{ key: "owner", title: "负责人", type: "text" as const }, { key: "median", title: "中位数", type: "number" as const }];
  const out = durationColumns<Row>(fields, { median: "duration" });
  assert.equal(out[0], fields[0]);
  assert.equal(out[1]?.type, "number");
  assert.equal(out[1]?.render?.({ id: "1", owner: "a", median: 90 * H }, { selected: false }), "3.8 天");
  assert.equal(durationColumns<Row>(fields, undefined), fields);
});
