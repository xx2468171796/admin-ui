import test from "node:test";
import assert from "node:assert/strict";
import { dayHeading, highlightParts, markerForTone } from "../src/timeline-core.ts";

const NOW = Date.UTC(2026, 9, 7, 4, 0); // 2026-10-07 12:00 北京时间，周三

test("按天分组的日期标题：今天 / 昨天带日期和周几，更早的写日期，跨年带年份", () => {
  assert.deepEqual(dayHeading("2026-10-07", NOW), { label: "今天", date: "10月7日 周三" });
  assert.deepEqual(dayHeading("2026-10-06", NOW), { label: "昨天", date: "10月6日 周二" });
  assert.deepEqual(dayHeading("2026-10-05", NOW), { label: "10月5日", date: "周一" });
  assert.deepEqual(dayHeading("2025-10-05", NOW), { label: "2025年10月5日", date: "周日" });
  assert.deepEqual(dayHeading("", NOW), { label: "时间未知", date: "" });
});

test("颜色 → 轨道标记：成功 / 失败 / 注意是结果圆，其余是系统小圆点", () => {
  assert.deepEqual(markerForTone("success"), { kind: "result", result: "success" });
  assert.deepEqual(markerForTone("danger"), { kind: "result", result: "danger" });
  assert.deepEqual(markerForTone("warning"), { kind: "result", result: "warning" });
  assert.deepEqual(markerForTone("brand"), { kind: "system", dot: "brand" });
  assert.deepEqual(markerForTone("neutral"), { kind: "system", dot: "neutral" });
  assert.deepEqual(markerForTone(undefined), { kind: "system", dot: "neutral" });
});

test("搜索高亮：不分大小写，每处命中都标出来", () => {
  assert.deepEqual(highlightParts("销售代表", "销售"), [{ text: "销售", hit: true }, { text: "代表", hit: false }]);
  assert.deepEqual(highlightParts("Admin admin", "ADMIN"), [{ text: "Admin", hit: true }, { text: " ", hit: false }, { text: "admin", hit: true }]);
  assert.deepEqual(highlightParts("财务", "销售"), [{ text: "财务", hit: false }]);
  assert.deepEqual(highlightParts("财务", " "), [{ text: "财务", hit: false }]);
  assert.deepEqual(highlightParts("", "x"), []);
});
