// 「目标进度」: completion, the 「按时间应完成」 share (today counted as passed), days left, gap / excess; targetRef in the schema.
import test from "node:test";
import assert from "node:assert/strict";
import { targetProgress } from "../src/dashboard-target-core.ts";
import { normalizeDashboard, widgetDataKey, TARGET_WIDGET_KINDS, WIDGET_KINDS } from "../src/dashboard-builder-core.ts";

const SH = "Asia/Shanghai";
const october = { start: "2026-10-01", end: "2026-10-31", label: "本月" };
const now = Date.parse("2026-10-09T04:00:00Z"); // 12:00 on the 9th in Shanghai

test("targetProgress: behind target in the middle of a month", () => {
  const p = targetProgress({ value: 600_000, target: 1_200_000, period: october, now, timeZone: SH });
  assert.equal(p.ratio, 0.5);
  assert.equal(p.gap, 600_000);
  assert.equal(p.over, null);
  assert.equal(p.elapsed, 9 / 31);
  assert.equal(p.daysLeft, 22);
});

test("targetProgress: over target, no target, no period, no value", () => {
  const over = targetProgress({ value: 130, target: 100, period: october, now, timeZone: SH });
  assert.equal(over.over, 30);
  assert.equal(over.gap, null);
  assert.equal(over.ratio, 1.3);
  const none = targetProgress({ value: 130, target: null, period: october, now, timeZone: SH });
  assert.deepEqual([none.ratio, none.gap, none.over], [null, null, null]);
  assert.equal(none.daysLeft, 22);
  assert.equal(targetProgress({ value: 5, target: 0 }).ratio, null);
  const noPeriod = targetProgress({ value: 5, target: 10 });
  assert.deepEqual([noPeriod.elapsed, noPeriod.daysLeft, noPeriod.gap], [null, null, 5]);
  const noValue = targetProgress({ value: null, target: 10 });
  assert.deepEqual([noValue.ratio, noValue.gap, noValue.over], [null, null, null]);
});

test("targetProgress: before, on the last day of and after the period; the zone decides today", () => {
  const before = targetProgress({ value: 0, target: 10, period: october, now: Date.parse("2026-09-20T04:00:00Z"), timeZone: SH });
  assert.deepEqual([before.elapsed, before.daysLeft], [0, 31]);
  const last = targetProgress({ value: 0, target: 10, period: october, now: Date.parse("2026-10-31T04:00:00Z"), timeZone: SH });
  assert.deepEqual([last.elapsed, last.daysLeft], [1, 0]);
  const after = targetProgress({ value: 0, target: 10, period: october, now: Date.parse("2026-11-03T04:00:00Z"), timeZone: SH });
  assert.deepEqual([after.elapsed, after.daysLeft], [1, 0]);
  // 2026-10-01 01:00 in Shanghai is still 2026-09-30 in New York: the period has not started there.
  const edge = Date.parse("2026-09-30T17:00:00Z");
  assert.equal(targetProgress({ value: 0, target: 10, period: october, now: edge, timeZone: SH }).elapsed, 1 / 31);
  assert.equal(targetProgress({ value: 0, target: 10, period: october, now: edge, timeZone: "America/New_York" }).elapsed, 0);
});

test("dashboard schema: targetProgress kind and targetRef survive normalizeDashboard; targetRef reloads data", () => {
  assert.ok(WIDGET_KINDS.includes("targetProgress"));
  assert.ok(TARGET_WIDGET_KINDS.includes("targetProgress"));
  const schema = normalizeDashboard({
    version: 2,
    title: "经营",
    widgets: [
      { id: "t", kind: "targetProgress", title: "本月成交", layout: { x: 0, y: 0, w: 2, h: 5 }, targetRef: "monthly-won" },
      { id: "b", kind: "bullet", title: "x", layout: { x: 2, y: 0, w: 2, h: 4 }, targetRef: 42 },
    ],
  });
  assert.equal(schema.widgets[0]?.targetRef, "monthly-won");
  assert.equal(schema.widgets[1]?.targetRef, undefined);
  const ctx = { time: "month", compare: "prev", dims: {} };
  const w = schema.widgets[0];
  assert.ok(w);
  assert.notEqual(widgetDataKey(w, ctx), widgetDataKey({ ...w, targetRef: "other" }, ctx));
});
