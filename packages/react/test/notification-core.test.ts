// 通知中心的纯规则——按天分组（午夜边界）、待我处理按模块分组、铃铛角标 99+、翻页去重、相对时间、本地已读。
import test from "node:test";
import assert from "node:assert/strict";
import { dayGroupOf, groupInboxByModule, groupNotificationsByDay, markReadLocal, mergePages, relativeTimeText, unreadBadgeText } from "../src/notification-core.ts";

const now = new Date(2026, 9, 7, 10, 30, 0);
const at = (d: number, h: number, m = 0, s = 0) => new Date(2026, 9, d, h, m, s);

test("按天分组：午夜前后、昨天零点、前天 23:59、未来时间算今天", () => {
  assert.equal(dayGroupOf(at(7, 0, 0, 0), now), "今天");
  assert.equal(dayGroupOf(at(6, 23, 59, 59), now), "昨天");
  assert.equal(dayGroupOf(at(6, 0, 0, 0), now), "昨天");
  assert.equal(dayGroupOf(at(5, 23, 59, 59), now), "更早");
  assert.equal(dayGroupOf(at(7, 12), now), "今天", "比现在晚（时钟偏差）算今天");
  assert.equal(dayGroupOf("not a date", now), "更早");
  const newYear = new Date(2027, 0, 1, 0, 5);
  assert.equal(dayGroupOf(new Date(2026, 11, 31, 23, 50), newYear), "昨天", "跨年的昨天");
  assert.equal(dayGroupOf(at(7, 8).toISOString(), now), "今天", "ISO 字符串");
});

test("按天分组：只留有内容的组，固定 今天 → 昨天 → 更早，组内保持原顺序", () => {
  const items = [
    { id: "a", createdAt: at(7, 9) },
    { id: "b", createdAt: at(1, 9) },
    { id: "c", createdAt: at(7, 8) },
    { id: "d", createdAt: at(2, 9) },
  ];
  const groups = groupNotificationsByDay(items, now);
  assert.deepEqual(groups.map((g) => g.group), ["今天", "更早"]);
  assert.deepEqual(groups[0]?.items.map((i) => i.id), ["a", "c"]);
  assert.deepEqual(groups[1]?.items.map((i) => i.id), ["b", "d"]);
  assert.deepEqual(groupNotificationsByDay([], now), []);
});

test("待我处理按模块分组：按第一次出现的顺序，标题用 moduleLabel，没有就用 module", () => {
  const groups = groupInboxByModule([
    { id: "1", module: "access", moduleLabel: "权限申请" },
    { id: "2", module: "handover" },
    { id: "3", module: "access", moduleLabel: "权限申请" },
  ]);
  assert.deepEqual(groups.map((g) => [g.module, g.label, g.items.map((i) => i.id)]), [
    ["access", "权限申请", ["1", "3"]],
    ["handover", "handover", ["2"]],
  ]);
});

test("铃铛角标：0 和负数不显示，99 原样，超过 99 显示 99+", () => {
  assert.equal(unreadBadgeText(0), "");
  assert.equal(unreadBadgeText(-3), "");
  assert.equal(unreadBadgeText(Number.NaN), "");
  assert.equal(unreadBadgeText(1), "1");
  assert.equal(unreadBadgeText(99), "99");
  assert.equal(unreadBadgeText(100), "99+");
  assert.equal(unreadBadgeText(4321), "99+");
});

test("相对时间：刚刚 / N 分钟前 / 今天 HH:mm / 昨天 HH:mm / M月D日 / 跨年带年份", () => {
  assert.equal(relativeTimeText(at(7, 10, 29, 30), now), "刚刚");
  assert.equal(relativeTimeText(at(7, 10, 31), now), "刚刚", "未来时间算刚刚");
  assert.equal(relativeTimeText(at(7, 10, 20), now), "10 分钟前");
  assert.equal(relativeTimeText(at(7, 9, 31), now), "59 分钟前");
  assert.equal(relativeTimeText(at(7, 9, 5), now), "09:05");
  assert.equal(relativeTimeText(at(6, 17, 20), now), "昨天 17:20");
  assert.equal(relativeTimeText(at(3, 9), now), "10月3日");
  assert.equal(relativeTimeText(new Date(2025, 11, 30, 9), now), "2025年12月30日");
  const earlyMorning = new Date(2026, 9, 7, 0, 20);
  assert.equal(relativeTimeText(new Date(2026, 9, 6, 23, 50), earlyMorning), "昨天 23:50", "不到一小时但跨了午夜：说昨天");
  assert.equal(relativeTimeText("bad", now), "");
});

test("翻页合并：追加到后面，按 id 去重，不改原数组", () => {
  const first = [{ id: "a" }, { id: "b" }];
  const merged = mergePages(first, [{ id: "b" }, { id: "c" }, { id: "c" }]);
  assert.deepEqual(merged.map((i) => i.id), ["a", "b", "c"]);
  assert.equal(first.length, 2);
});

test("本地标为已读：只改指定的，all 全改，没变化返回同一个数组", () => {
  const items = [
    { id: "a", read: false },
    { id: "b", read: false },
    { id: "c", read: true },
  ];
  const one = markReadLocal(items, ["a"]);
  assert.deepEqual(one.map((i) => i.read), [true, false, true]);
  assert.equal(items[0]?.read, false, "不改原对象");
  assert.deepEqual(markReadLocal(items, "all").map((i) => i.read), [true, true, true]);
  assert.equal(markReadLocal(items, ["c"]), items);
  assert.equal(markReadLocal(items, ["zzz"]), items);
});
