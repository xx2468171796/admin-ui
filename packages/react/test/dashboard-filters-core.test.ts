import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_COMPARE_OPTIONS,
  DEFAULT_TIME_OPTIONS,
  carryFilterContext,
  decodeFilterContext,
  encodeFilterContext,
  filterChangeCount,
  validCustomRange,
  withDimension,
  type DashboardFilterValue,
} from "../src/dashboard-filters-core.ts";

const defaults: DashboardFilterValue = { time: "today", compare: "mom", dims: { line: "smart", group: "g1" } };
const spec = {
  times: DEFAULT_TIME_OPTIONS,
  compares: DEFAULT_COMPARE_OPTIONS,
  dimensions: [
    { key: "line", options: [{ value: "smart" }, { value: "travel" }] },
    { key: "group", options: [{ value: "g1" }, { value: "g2" }] },
    { key: "source", options: [{ value: "web" }, { value: "line" }] },
  ],
};

test("默认值不写进地址；改过的写进去，相对时间保持相对", () => {
  assert.equal(encodeFilterContext(defaults, defaults).toString(), "");
  const next = { time: "month", compare: "yoy", dims: { line: "travel", group: "g1", source: "web" } };
  assert.equal(encodeFilterContext(next, defaults).toString(), "t=month&cmp=yoy&line=travel&source=web");
  assert.equal(encodeFilterContext(next, defaults, { full: true }).toString(), "t=month&cmp=yoy&group=g1&line=travel&source=web");
});

test("把默认维度清成「全部」也能往返", () => {
  const cleared = withDimension(defaults, "group", null);
  const query = encodeFilterContext(cleared, defaults);
  assert.equal(query.get("group"), "");
  assert.deepEqual(decodeFilterContext(query, defaults, spec), { time: "today", compare: "mom", dims: { line: "smart" } });
  const full = encodeFilterContext(cleared, defaults, { full: true });
  assert.equal(full.get("group"), "", "full 模式也要带「全部」标记，否则服务端会套回默认");
  assert.deepEqual(decodeFilterContext(full, defaults, spec), { time: "today", compare: "mom", dims: { line: "smart" } });
});

test("地址里的参数不可信：未知值、未知键、坏的自定义区间都回落到默认", () => {
  const v = decodeFilterContext("t=forever&cmp=hack&line=<script>&group=g2&evil=1", defaults, spec);
  assert.deepEqual(v, { time: "today", compare: "mom", dims: { group: "g2" } });
  const broken = decodeFilterContext("t=custom&from=2026-10-05&to=2026-10-01", defaults, spec);
  assert.equal(broken.time, "today");
  const ok = decodeFilterContext("t=custom&from=2026-10-01&to=2026-10-05", defaults, spec);
  assert.deepEqual([ok.time, ok.from, ok.to], ["custom", "2026-10-01", "2026-10-05"]);
  assert.equal(encodeFilterContext(ok, defaults).toString(), "t=custom&from=2026-10-01&to=2026-10-05");
});

test("自定义区间：两天都合法且有先后", () => {
  assert.equal(validCustomRange("2026-02-30", "2026-03-01"), false);
  assert.equal(validCustomRange("2026-10-01", undefined), false);
  assert.equal(validCustomRange("2026-10-01", "2026-10-01"), true);
});

test("下钻带着筛选走：时间和对比总带上，目标页不支持的维度列出来写「未应用」", () => {
  const v = { time: "month", compare: "yoy", dims: { line: "smart", source: "web" } };
  const { value, dropped } = carryFilterContext(v, ["line"]);
  assert.deepEqual(value, { time: "month", compare: "yoy", dims: { line: "smart" } });
  assert.deepEqual(dropped, ["source"]);
});

test("改动计数：0 时「重置」不可用", () => {
  assert.equal(filterChangeCount(defaults, defaults), 0);
  assert.equal(filterChangeCount({ ...defaults, compare: "target", dims: { line: "smart" } }, defaults), 2);
  assert.equal(filterChangeCount({ ...defaults, time: "custom", from: "2026-10-01", to: "2026-10-02" }, defaults), 1);
});
