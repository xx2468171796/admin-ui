import test from "node:test";
import assert from "node:assert/strict";
import { chipsThatFit, createCandidate, filterOptions, groupOptions, initialActive, keyboardOrder, moveActive, showsSearch, toggleValue, typeahead, type SelectOption } from "../src/option-list-core.ts";
import { daysBetween, dueState, quickDays, relativeDayText, relativeDayWord } from "../src/date-picker-core.ts";

const STAGES: SelectOption[] = [
  { value: "s1", label: "首通", group: "进行中", hint: "1 天" },
  { value: "s2", label: "需求确认", group: "进行中" },
  { value: "s5", label: "成交", group: "已结束" },
  { value: "s3", label: "报价", group: "进行中" },
  { value: "s8", label: "丢单", group: "已结束", disabledReason: "要先填丢单原因" },
];

test("搜索：标签 / 值 / 关键词，空搜索全显示", () => {
  assert.equal(filterOptions(STAGES, "").length, 5);
  assert.deepEqual(filterOptions(STAGES, "确认").map((o) => o.value), ["s2"]);
  assert.deepEqual(filterOptions([{ value: "u1", label: "小王", keywords: "xiaowang" }], "WANG").map((o) => o.value), ["u1"]);
  assert.equal(showsSearch(6), false, "6 个以内不出搜索");
  assert.equal(showsSearch(7), true);
  assert.equal(showsSearch(2, true), true);
});

test("分组按第一次出现的顺序，键盘顺序跟着分组走", () => {
  assert.deepEqual(groupOptions(STAGES).map((s) => [s.group, s.options.map((o) => o.option.value)]), [["进行中", ["s1", "s2", "s3"]], ["已结束", ["s5", "s8"]]]);
  assert.deepEqual(keyboardOrder(STAGES).map((o) => o.value), ["s1", "s2", "s3", "s5", "s8"]);
});

test("键盘：跳过灰掉的选项，首尾循环，新建行在最后", () => {
  const order = keyboardOrder(STAGES);
  assert.equal(moveActive(order, 3, "ArrowDown"), 0, "s8 灰掉，s5 往下回到第一个");
  assert.equal(moveActive(order, 0, "ArrowUp"), 3, "往上从头绕到最后一个能选的");
  assert.equal(moveActive(order, 3, "ArrowDown", true), 5, "有新建行时落到新建行");
  assert.equal(moveActive(order, 2, "End"), 3);
  assert.equal(moveActive(order, 2, "Home"), 0);
  assert.equal(moveActive(order, 0, "x"), null);
  assert.equal(initialActive(order, ["s5"]), 3, "从已选的那一项开始");
  assert.equal(initialActive(order, []), 0);
  assert.equal(typeahead(order, 0, "报"), 2);
});

test("新建：搜索词没有同名选项才给", () => {
  assert.equal(createCandidate(STAGES, "  漠河 "), "漠河");
  assert.equal(createCandidate(STAGES, "首通"), null);
  assert.equal(createCandidate(STAGES, " "), null);
  // exact (field options, the grid's 「新建选项」): trimmed, case-sensitive — 「vip」 is new next to 「VIP」.
  const tags = [{ value: "v", label: "VIP" }];
  assert.equal(createCandidate(tags, "vip"), null);
  assert.equal(createCandidate(tags, "vip", true), "vip");
  assert.equal(createCandidate(tags, " VIP ", true), null);
});

test("多选：按选项顺序排、最多几个", () => {
  const order = ["a", "b", "c", "d"];
  assert.deepEqual(toggleValue(["c"], "a", order), ["a", "c"]);
  assert.deepEqual(toggleValue(["a", "c"], "a", order), ["c"]);
  assert.equal(toggleValue(["a", "b", "c"], "d", order, 3), null, "最多选 3 项");
  assert.deepEqual(toggleValue(["x"], "b", order), ["b", "x"], "不认识的值留在后面");
});

test("放不下收成 +N：至少露一个", () => {
  assert.equal(chipsThatFit([60, 60, 60], 300, 30), 3);
  assert.equal(chipsThatFit([60, 60, 60], 150, 30), 1, "60 + 4 + 60 + 4 + 30 > 150");
  assert.equal(chipsThatFit([60, 60, 60], 170, 30), 2);
  assert.equal(chipsThatFit([200], 100, 30), 1);
  assert.equal(chipsThatFit([], 100, 30), 0);
});

test("日期：快捷一行、「周四 · 明天」、到期颜色", () => {
  const today = "2026-10-07"; // 周三
  assert.deepEqual(quickDays(today).map((q) => `${q.label}:${q.day}`), ["今天:2026-10-07", "明天:2026-10-08", "下周一:2026-10-12", "一周后:2026-10-14"]);
  assert.equal(daysBetween(today, "2026-10-12"), 5);
  assert.equal(relativeDayWord(today, "2026-10-08"), "明天");
  assert.equal(relativeDayWord(today, "2026-10-09"), "后天");
  assert.equal(relativeDayWord(today, "2026-10-03"), "4 天前");
  assert.equal(relativeDayText(today, "2026-10-08"), "周四 · 明天");
  assert.equal(relativeDayText(today, "2026-10-09T14:30"), "周五 · 后天", "日期时间也认");
  assert.equal(relativeDayText(today, "2026-10-03", true), "周六 · 4 天前（已过期）");
  assert.equal(relativeDayText(today, "2026-10-03"), "周六 · 4 天前", "不是到期字段不说过期");
  assert.equal(relativeDayText(today, ""), "");
  assert.equal(dueState(today, "2026-10-08"), "soon");
  assert.equal(dueState(today, "2026-10-06"), "overdue");
  assert.equal(dueState(today, "2026-10-12"), null);
});
