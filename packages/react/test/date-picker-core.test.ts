import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  addMonths,
  clampDay,
  dateRangePreset,
  dateRangePresets,
  dayLabel,
  displayDateTime,
  endOfWeek,
  isCompleteDateTimeText,
  isCompleteDayText,
  isDateTimeText,
  isDayKey,
  matchingPreset,
  momentOutOfRange,
  monthMatrix,
  moveDay,
  orderRange,
  outOfRange,
  parseDateText,
  parseDateTimeText,
  parseTimeText,
  snapTime,
  startOfWeek,
  stepTime,
  timeOptions,
  todayKey,
  weekdayLabels,
  weekdayOf,
} from "../src/date-picker-core.ts";

const NOW = new Date(2026, 9, 5, 14, 37); // 2026-10-05 (Monday) 14:37 local

test("日期键：校验真实日期，闰年 2 月", () => {
  assert.equal(isDayKey("2026-10-05"), true);
  assert.equal(isDayKey("2026-02-29"), false);
  assert.equal(isDayKey("2028-02-29"), true);
  assert.equal(isDayKey("2026-13-01"), false);
  assert.equal(isDayKey("2026-1-5"), false);
  assert.equal(isDateTimeText("2026-10-05T14:30"), true);
  assert.equal(isDateTimeText("2026-10-05 14:30"), false);
  assert.equal(isDateTimeText("2026-10-05T24:00"), false);
  assert.equal(todayKey(NOW), "2026-10-05");
});

test("日期运算：跨月跨年、月末夹住、星期", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-15", -1), "2025-12-15");
  assert.equal(addMonths("2026-10-05", 12), "2027-10-05");
  assert.equal(weekdayOf("2026-10-05"), 1);
  assert.equal(startOfWeek("2026-10-05", 1), "2026-10-05");
  assert.equal(startOfWeek("2026-10-04", 1), "2026-09-28", "周日属于上一周（周一开头）");
  assert.equal(startOfWeek("2026-10-04", 0), "2026-10-04", "周日开头");
  assert.equal(endOfWeek("2026-10-05", 1), "2026-10-11");
});

test("月份方格：6 周 × 7 天，从周起始日开始，包含上下月", () => {
  const m = monthMatrix(2026, 10, 1);
  assert.equal(m.length, 6);
  assert.ok(m.every((w) => w.length === 7));
  assert.equal(m[0]![0], "2026-09-28");
  assert.equal(m[0]![3], "2026-10-01");
  assert.equal(m[5]![6], "2026-11-08");
  const sun = monthMatrix(2026, 10, 0);
  assert.equal(sun[0]![0], "2026-09-27");
  assert.equal(weekdayOf(sun[0]![0]!), 0);
  assert.deepEqual(weekdayLabels(1), ["一", "二", "三", "四", "五", "六", "日"]);
  assert.deepEqual(weekdayLabels(0).slice(0, 2), ["日", "一"]);
  assert.equal(dayLabel("2026-10-10", "work"), "2026 年 10 月 10 日 星期六，补班");
});

test("解析输入：多种写法、无年份用今年、全角数字、非法日期", () => {
  assert.equal(parseDateText("2026-10-05", NOW), "2026-10-05");
  assert.equal(parseDateText("2026/10/5", NOW), "2026-10-05");
  assert.equal(parseDateText("2026.10.5", NOW), "2026-10-05");
  assert.equal(parseDateText("2026年10月5日", NOW), "2026-10-05");
  assert.equal(parseDateText("20261005", NOW), "2026-10-05");
  assert.equal(parseDateText("10/5", NOW), "2026-10-05");
  assert.equal(parseDateText("10-5", NOW), "2026-10-05");
  assert.equal(parseDateText("12月25日", NOW), "2026-12-25");
  assert.equal(parseDateText("２０２６／１０／５", NOW), "2026-10-05");
  assert.equal(parseDateText("2026-02-30", NOW), null);
  assert.equal(parseDateText("13/5", NOW), null);
  assert.equal(parseDateText("明天", NOW), null);
  assert.equal(parseDateText("", NOW), null);
});

test("解析时间与日期时间", () => {
  assert.equal(parseTimeText("9:5"), "09:05");
  assert.equal(parseTimeText("0905"), "09:05");
  assert.equal(parseTimeText("9"), "09:00");
  assert.equal(parseTimeText("21点30"), "21:30");
  assert.equal(parseTimeText("24:00"), null);
  assert.equal(parseTimeText("12:60"), null);
  assert.equal(parseDateTimeText("2026-10-05T14:30", NOW), "2026-10-05T14:30");
  assert.equal(parseDateTimeText("2026-10-05 14:30", NOW), "2026-10-05T14:30");
  assert.equal(parseDateTimeText("2026/10/5 9:05", NOW), "2026-10-05T09:05");
  assert.equal(parseDateTimeText("10/5 18", NOW), "2026-10-05T18:00");
  assert.equal(parseDateTimeText("10/5", NOW, "09:00"), "2026-10-05T09:00", "没写时间用兜底时间");
  assert.equal(parseDateTimeText("10/5 25:00", NOW), null);
  assert.equal(displayDateTime("2026-10-05T14:30"), "2026-10-05 14:30");
  assert.equal(displayDateTime("2026-10-05"), "2026-10-05");
  assert.equal(isCompleteDayText("2026-10-05"), true);
  assert.equal(isCompleteDayText("2026-10-0"), false);
  assert.equal(isCompleteDateTimeText("2026-10-05 14:30"), true);
  assert.equal(isCompleteDateTimeText("2026-10-05T14:3"), false);
});

test("范围：min / max 按天比，夹住，时刻比较，起止排序", () => {
  assert.equal(outOfRange("2026-10-05", "2026-10-06"), true);
  assert.equal(outOfRange("2026-10-05", undefined, "2026-10-05T08:00"), false, "日期时间的 max 按天比");
  assert.equal(outOfRange("2026-10-06", undefined, "2026-10-05"), true);
  assert.equal(clampDay("2026-09-01", "2026-10-02", "2026-10-05"), "2026-10-02");
  assert.equal(clampDay("2026-11-01", "2026-10-02", "2026-10-05"), "2026-10-05");
  assert.equal(momentOutOfRange("2026-10-05T07:59", "2026-10-05T08:00"), true);
  assert.equal(momentOutOfRange("2026-10-05T23:00", undefined, "2026-10-05"), false, "只给日期的 max 包含当天");
  assert.deepEqual(orderRange("2026-10-09", "2026-10-01"), { from: "2026-10-01", to: "2026-10-09" });
  assert.deepEqual(orderRange("2026-10-01", ""), { from: "2026-10-01", to: "" });
});

test("键盘：方向键、翻页、Home / End，夹在范围内", () => {
  assert.equal(moveDay("2026-10-05", "ArrowLeft"), "2026-10-04");
  assert.equal(moveDay("2026-10-05", "ArrowDown"), "2026-10-12");
  assert.equal(moveDay("2026-10-31", "PageDown"), "2026-11-30");
  assert.equal(moveDay("2026-10-05", "PageUp", { shiftKey: true }), "2025-10-05");
  assert.equal(moveDay("2026-10-07", "Home", { weekStart: 1 }), "2026-10-05");
  assert.equal(moveDay("2026-10-07", "End", { weekStart: 0 }), "2026-10-10");
  assert.equal(moveDay("2026-10-05", "ArrowUp", { min: "2026-10-01" }), "2026-10-01");
  assert.equal(moveDay("2026-10-05", "Enter"), null);
});

test("时间步长", () => {
  assert.equal(snapTime("14:37", 15), "14:30");
  assert.equal(snapTime("14:38", 15), "14:45");
  assert.equal(snapTime("23:58", 15), "23:45", "不跨到第二天");
  assert.equal(stepTime("23:50", 15), "00:05");
  assert.equal(timeOptions(30).length, 48);
  assert.equal(timeOptions(60)[9], "09:00");
});

test("范围快捷：今天 / 本周 / 本月 / 近 7 天，选中匹配", () => {
  assert.deepEqual(dateRangePreset("thisWeek", "2026-10-07"), { from: "2026-10-05", to: "2026-10-11" });
  assert.deepEqual(dateRangePreset("lastWeek", "2026-10-07"), { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(dateRangePreset("thisMonth", "2026-02-10"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(dateRangePreset("lastMonth", "2026-03-31"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(dateRangePreset("last7", "2026-10-05"), { from: "2026-09-29", to: "2026-10-05" });
  const presets = dateRangePresets(["today", "last7"], { now: NOW });
  assert.deepEqual(presets.map((p) => p.label), ["今天", "近 7 天"]);
  assert.equal(matchingPreset(presets, { from: "2026-10-05", to: "2026-10-05" }), "today");
  assert.equal(matchingPreset(presets, { from: "2026-10-01", to: "2026-10-05" }), undefined);
});
