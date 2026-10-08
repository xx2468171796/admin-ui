import assert from "node:assert/strict";
import test from "node:test";
import { datePresetValue, stepEnabled, toggleChoice } from "../src/choice-core.ts";

test("多选标签：切换后按选项顺序输出，丢掉未知值", () => {
  const options = [{ value: "a" }, { value: "b" }, { value: "c" }];
  assert.deepEqual(toggleChoice(options, [], "b"), ["b"]);
  assert.deepEqual(toggleChoice(options, ["c"], "a"), ["a", "c"]);
  assert.deepEqual(toggleChoice(options, ["a", "c"], "a"), ["c"]);
  assert.deepEqual(toggleChoice(options, ["zzz", "b"], "c"), ["b", "c"]);
});

test("方向键焦点：跳过禁用项、首尾环绕、全禁用返回 -1", () => {
  const d = [false, true, false, false];
  assert.equal(stepEnabled(d, 0, 1), 2);
  assert.equal(stepEnabled(d, 3, 1), 0);
  assert.equal(stepEnabled(d, 0, -1), 3);
  assert.equal(stepEnabled(d, 2, -1), 0);
  assert.equal(stepEnabled([true, false, false, true], 0, "first"), 1);
  assert.equal(stepEnabled([true, false, false, true], 0, "last"), 2);
  assert.equal(stepEnabled([true, true], 0, 1), -1);
  assert.equal(stepEnabled([], 0, "first"), -1);
});

test("快捷日期：本地时间、按日历天数、跨月跨年", () => {
  const now = new Date(2026, 9, 1, 9, 5); // 2026-10-01 09:05 local
  assert.equal(datePresetValue(1, "datetime-local", now), "2026-10-02T09:05");
  assert.equal(datePresetValue(30, "date", now), "2026-10-31");
  assert.equal(datePresetValue(92, "date", now), "2027-01-01");
  assert.equal(datePresetValue(0, "datetime-local", now), "2026-10-01T09:05");
  assert.equal(datePresetValue(7, undefined, new Date(2024, 1, 25, 23, 59)), "2024-03-03T23:59", "闰年二月");
});
