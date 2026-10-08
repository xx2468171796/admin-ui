import test from "node:test";
import assert from "node:assert/strict";
import { dayKey, dayLabel, formatDateTime, formatMinorMoney, relativeTime, toTime } from "../src/format.ts";

const SH = "Asia/Shanghai";
const NOW = Date.parse("2026-10-01T06:00:00Z"); // 上海 14:00，星期四

test("日期：按时区格式化成 年-月-日 [时:分[:秒]]，空值和无效值返回 null", () => {
  assert.equal(formatDateTime("2026-09-30T16:05:09Z", { timeZone: SH }), "2026-10-01");
  assert.equal(formatDateTime("2026-09-30T16:05:09Z", { time: true, timeZone: SH }), "2026-10-01 00:05");
  assert.equal(formatDateTime("2026-09-30T16:05:09Z", { time: true, seconds: true, timeZone: "UTC" }), "2026-09-30 16:05:09");
  assert.equal(formatDateTime("2026-10-01T06:05:09Z", { seconds: true, timeZone: SH }), "2026-10-01 14:05:09", "seconds 自带时分");
  assert.equal(formatDateTime(new Date("2026-10-01T06:05:09Z"), { time: true, timeZone: SH }), "2026-10-01 14:05");
  assert.equal(formatDateTime(Date.parse("2026-10-01T06:05:09Z"), { timeZone: SH }), "2026-10-01");
  assert.equal(formatDateTime("not a date"), null);
  assert.equal(formatDateTime(""), null);
  assert.equal(formatDateTime(null), null);
  assert.equal(formatDateTime(undefined), null);
  assert.equal(toTime("bad"), null);
});

test("相对时间与日期分组标题（Asia/Shanghai）", () => {
  assert.equal(relativeTime(NOW - 10_000, NOW, SH), "刚刚");
  assert.equal(relativeTime(NOW + 10_000, NOW, SH), "马上");
  assert.equal(relativeTime(NOW - 5 * 60_000, NOW, SH), "5 分钟前");
  assert.equal(relativeTime(NOW + 3 * 60_000, NOW, SH), "3 分钟后");
  assert.equal(relativeTime(NOW - 3 * 3_600_000, NOW, SH), "3 小时前");
  assert.equal(relativeTime(Date.parse("2026-09-30T13:05:00Z"), NOW, SH), "昨天 21:05");
  assert.equal(relativeTime(Date.parse("2026-09-29T01:05:00Z"), NOW, SH), "9月29日 09:05");
  assert.equal(relativeTime("2025-12-31T01:00:00Z", NOW, SH), "2025-12-31");
  assert.equal(relativeTime(null, NOW, SH), "—");
  assert.equal(relativeTime("garbage", NOW, SH), "—");
  assert.equal(dayKey("2026-09-30T16:30:00Z", SH), "2026-10-01", "按上海时区算日期");
  assert.equal(dayKey(null), "");
  assert.equal(dayLabel("2026-10-01", NOW, SH), "今天");
  assert.equal(dayLabel("2026-09-30", NOW, SH), "昨天");
  assert.equal(dayLabel("2026-09-28", NOW, SH), "9月28日 星期一");
  assert.equal(dayLabel("2025-12-31", NOW, SH), "2025年12月31日");
  assert.equal(dayLabel("", NOW, SH), "时间未知");
});

test("金额按分走 bigint，不经过浮点；负号统一用 U+2212，缺失和 0 分开", () => {
  assert.equal(formatMinorMoney(123456789n, { symbol: "¥" }), "¥1,234,567.89");
  assert.equal(formatMinorMoney(-5n, { symbol: "¥" }), "−¥0.05");
  assert.equal(formatMinorMoney(null), "—");
  assert.equal(formatMinorMoney(undefined), "—");
  assert.equal(formatMinorMoney(0n, { symbol: "" }), "0.00");
  assert.equal(formatMinorMoney(900719925474099312n, { symbol: "" }), "9,007,199,254,740,993.12", "超过 2^53 仍精确");
  assert.equal(formatMinorMoney(-1n, { symbol: "", unit: "元" }), "−0.01 元");
  assert.equal(formatMinorMoney(12345n, { symbol: "$" }), "$123.45");
  assert.equal(formatMinorMoney(12345n), "123.45", "没给 symbol 就不带货币符号");
});
