import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  addWorkdays,
  dayMark,
  diffDays,
  endOfMonth,
  isoWeek,
  isWorkday,
  startOfWeek,
  toDay,
  weekday,
  workdaysBetween,
  zonedInstant,
  zonedParts,
  type WorkCalendar,
} from "../src/views/date-core.ts";

// 2026 国庆：10-01 ~ 10-07 放假，10-10（周六）补班 —— 宿主给的日历，SDK 不内置。
const CN: WorkCalendar = {
  holidays: Object.fromEntries(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"].map((d) => [d, "国庆"])),
  workdays: { "2026-10-10": "国庆调休" },
};

test("日期键运算不受时区和夏令时影响", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(diffDays("2026-09-28", "2026-10-05"), 7);
  assert.equal(weekday("2026-10-05"), 1, "2026-10-05 是周一");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28", "月底夹住");
  assert.equal(endOfMonth("2026-02-10"), "2026-02-28");
  assert.equal(startOfWeek("2026-10-08", 1), "2026-10-05", "周一开始");
  assert.equal(startOfWeek("2026-10-08", 0), "2026-10-04", "周日开始");
  assert.equal(startOfWeek("2026-10-04", 1), "2026-09-28");
  assert.equal(isoWeek("2026-10-05"), 41);
  assert.equal(isoWeek("2027-01-01"), 53);
});

test("瞬间 ↔ 时区里的日子和钟点", () => {
  // 2026-10-05T16:30Z = 上海 10-06 00:30，纽约 10-05 12:30
  const t = Date.parse("2026-10-05T16:30:00Z");
  assert.deepEqual(zonedParts(t, "Asia/Shanghai"), { day: "2026-10-06", minutes: 30 });
  assert.deepEqual(zonedParts(t, "America/New_York"), { day: "2026-10-05", minutes: 12 * 60 + 30 });
  assert.equal(new Date(zonedInstant("2026-10-06", 30, "Asia/Shanghai")).toISOString(), "2026-10-05T16:30:00.000Z");
  // 纽约夏令时结束当天（11-01），墙上 12:00 是 UTC 17:00
  assert.equal(new Date(zonedInstant("2026-11-01", 12 * 60, "America/New_York")).toISOString(), "2026-11-01T17:00:00.000Z");
  assert.equal(toDay("2026-10-13", "America/New_York"), "2026-10-13", "纯日期不被时区挪动");
  assert.equal(toDay("2026-10-05T16:30:00Z", "Asia/Shanghai"), "2026-10-06");
  assert.equal(toDay("", "Asia/Shanghai"), null);
});

test("工作日：周末、宿主的节假日（休）和补班日（班）", () => {
  assert.equal(isWorkday("2026-10-05", CN), false, "国庆");
  assert.equal(isWorkday("2026-10-10", CN), true, "周六补班");
  assert.equal(isWorkday("2026-10-11", CN), false, "周日");
  assert.equal(isWorkday("2026-10-05"), true, "没给日历：周一上班");
  assert.deepEqual(dayMark("2026-10-05", CN), { kind: "holiday", badge: "休", label: "国庆" });
  assert.deepEqual(dayMark("2026-10-10", CN), { kind: "workday", badge: "班", label: "国庆调休" });
  assert.equal(dayMark("2026-10-11", CN), null, "普通周末不加徽标");
  assert.equal(workdaysBetween("2026-10-09", "2026-10-15", CN), 6, "10-09~10-15 共 7 天，周日不算");
  assert.equal(workdaysBetween("2026-10-15", "2026-10-09", CN), 0);
  assert.equal(addWorkdays("2026-10-09", 6, CN), "2026-10-15");
  assert.equal(addWorkdays("2026-10-03", 1, CN), "2026-10-08", "假期开始的任务从第一个工作日算");
  assert.equal(isWorkday("2026-10-04", { weekend: [5, 6] }), true, "周末可配置");
});
