import test from "node:test";
import assert from "node:assert/strict";
import {
  addConditionNode,
  canAddCondition,
  canAddConditionGroup,
  compareDay,
  conditionDayRange,
  conditionKindOf,
  conditionOpLabel,
  conditionTreeFromList,
  conditionTreeIsContextual,
  conditionTreeKey,
  conditionTreeSql,
  conditionTreeToList,
  countConditionGroups,
  countConditions,
  evaluateConditionTree,
  findConditionNode,
  isConditionComplete,
  nextConditionId,
  normalizeConditionTree,
  pruneConditionTree,
  relativeDateLabel,
  relativeDateRange,
  removeConditionNode,
  resolveDynamic,
  setConjunction,
  updateConditionNode,
  type ConditionGroup,
} from "../src/condition-core.ts";

// 2026-10-07 is a Wednesday; 15:30Z is already 10-07 23:30 in Shanghai but still 10-07 in UTC.
const NOW = Date.parse("2026-10-07T15:30:00Z");
const ctx = { now: NOW, timeZone: "Asia/Shanghai" };

test("relative dates: days, weeks with a week start, months, past / next N days, time zone", () => {
  assert.deepEqual(relativeDateRange({ relative: "today" }, ctx), { from: "2026-10-07", to: "2026-10-07" });
  assert.deepEqual(relativeDateRange({ relative: "today" }, { now: Date.parse("2026-10-07T17:00:00Z"), timeZone: "Asia/Shanghai" }), { from: "2026-10-08", to: "2026-10-08" }, "上海已过零点");
  assert.deepEqual(relativeDateRange({ relative: "today" }, { now: Date.parse("2026-10-07T17:00:00Z"), timeZone: "UTC" }), { from: "2026-10-07", to: "2026-10-07" });
  assert.deepEqual(relativeDateRange({ relative: "yesterday" }, ctx), { from: "2026-10-06", to: "2026-10-06" });
  assert.deepEqual(relativeDateRange({ relative: "thisWeek" }, ctx), { from: "2026-10-05", to: "2026-10-11" }, "默认周一开始");
  assert.deepEqual(relativeDateRange({ relative: "thisWeek" }, { ...ctx, weekStart: 0 }), { from: "2026-10-04", to: "2026-10-10" }, "周日开始");
  assert.deepEqual(relativeDateRange({ relative: "lastWeek" }, ctx), { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(relativeDateRange({ relative: "nextWeek" }, ctx), { from: "2026-10-12", to: "2026-10-18" });
  assert.deepEqual(relativeDateRange({ relative: "lastMonth" }, ctx), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(relativeDateRange({ relative: "thisMonth" }, { now: Date.parse("2026-02-10T00:00:00Z") }), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(relativeDateRange({ relative: "nextMonth" }, { now: Date.parse("2026-12-10T00:00:00Z") }), { from: "2027-01-01", to: "2027-01-31" }, "跨年");
  assert.deepEqual(relativeDateRange({ relative: "pastDays", days: 7 }, ctx), { from: "2026-10-01", to: "2026-10-07" }, "过去 7 天含今天");
  assert.deepEqual(relativeDateRange({ relative: "nextDays", days: 3 }, ctx), { from: "2026-10-07", to: "2026-10-09" });
  assert.deepEqual(relativeDateRange({ relative: "thisYear" }, ctx), { from: "2026-01-01", to: "2026-12-31" });
  assert.equal(relativeDateLabel({ relative: "pastDays", days: 7 }), "过去 7 天");
  assert.deepEqual(conditionDayRange({ from: "2026-10-01", to: "2026-10-03" }), { from: "2026-10-01", to: "2026-10-03" });
  assert.equal(conditionDayRange({ from: "2026-10-03", to: "2026-10-01" }), null, "反着的范围无效");
  assert.equal(conditionDayRange("2026-02-30"), null, "不存在的日期无效");
  const week = relativeDateRange({ relative: "thisWeek" }, ctx);
  assert.equal(compareDay("2026-10-05", "inRange", week), true);
  assert.equal(compareDay("2026-10-04", "notInRange", week), true);
  assert.equal(compareDay("2026-10-04", "before", week), true);
  assert.equal(compareDay("2026-10-11", "after", week), false);
  assert.equal(compareDay("2026-10-11", "onOrBefore", week), true);
});

test("operators per kind, labels, completeness of values", () => {
  assert.equal(conditionKindOf("money"), "number");
  assert.equal(conditionKindOf("rating"), "rating");
  assert.equal(conditionKindOf("datetime"), "date");
  assert.equal(conditionKindOf("phone"), "text", "未知类型按文本筛选");
  assert.equal(conditionOpLabel("gte", "rating"), "大于等于");
  assert.equal(conditionOpLabel("gte", "number"), "≥");
  assert.equal(conditionOpLabel("hasAny", "user"), "是");
  assert.equal(isConditionComplete("text", "contains", " "), false);
  assert.equal(isConditionComplete("number", "gt", "12.5"), true);
  assert.equal(isConditionComplete("number", "gt", "abc"), false);
  assert.equal(isConditionComplete("rating", "gte", 4), true);
  assert.equal(isConditionComplete("date", "is", { relative: "today" }), true);
  assert.equal(isConditionComplete("date", "is", { from: "2026-10-01", to: "2026-10-02" }), false, "固定范围只给「在范围内」");
  assert.equal(isConditionComplete("date", "inRange", { from: "2026-10-01", to: "2026-10-02" }), true);
  assert.equal(isConditionComplete("date", "inRange", { relative: "pastDays", days: 0 }), false);
  assert.equal(isConditionComplete("user", "hasAny", { dynamic: "me" }), true);
  assert.equal(isConditionComplete("number", "eq", { dynamic: "me" }), false, "数字不能用「我」");
  assert.equal(isConditionComplete("select", "anyOf", []), false);
  assert.equal(isConditionComplete("checkbox", "checked", undefined), true);
  assert.equal(isConditionComplete("text", "gt", "1"), false, "条件和类型不配");
  assert.deepEqual(resolveDynamic({ dynamic: "me" }, { resolve: (t) => (t === "me" ? ["王磊"] : null) }), ["王磊"]);
  assert.equal(resolveDynamic({ dynamic: "boss" }, { resolve: () => null }), null);
  assert.equal(resolveDynamic({ dynamic: "me" }), null, "没有解析器 = 无法解析");
});

const tree: ConditionGroup = {
  id: "root",
  conjunction: "and",
  items: [
    { id: "f1", field: "stage", op: "anyOf", value: ["quote"] },
    { id: "g1", conjunction: "or", items: [{ id: "f2", field: "rating", op: "gte", value: 4 }, { id: "f3", field: "next", op: "inRange", value: { relative: "pastDays", days: 7 } }] },
    { id: "f4", field: "name", op: "contains", value: "" },
  ],
};

test("tree: nested and / or, inactive conditions skipped, empty root passes", () => {
  const run = (answers: Record<string, boolean | null>) => evaluateConditionTree(tree, (c) => answers[c.id] ?? null);
  assert.equal(run({ f1: true, f2: false, f3: true }), true, "阶段且（意向 或 下次跟进）");
  assert.equal(run({ f1: true, f2: false, f3: false }), false);
  assert.equal(run({ f1: false, f2: true, f3: true }), false);
  assert.equal(run({ f1: true }), true, "组里全不生效 → 组跳过");
  assert.equal(run({}), true, "一个生效的条件都没有 = 不筛选");
  assert.equal(evaluateConditionTree({ id: "root", conjunction: "or", items: [] }, () => false), true);
  assert.equal(evaluateConditionTree({ ...tree, conjunction: "or" }, (c) => (c.id === "f4" ? false : c.id === "f2")), true);
  assert.equal(countConditions(tree), 4);
  assert.equal(countConditionGroups(tree), 1);
  assert.equal(conditionTreeIsContextual(tree), true, "过去 7 天每天在变");
  assert.equal(conditionTreeKey(tree), conditionTreeKey(JSON.parse(JSON.stringify(tree).replace(/"f(\d)"/g, '"x$1"'))), "id 不影响 key");
  const sql = conditionTreeSql(tree, (c) => (c.id === "f4" ? null : `${c.field} ?`));
  assert.equal(sql, "(stage ? AND (rating ? OR next ?))");
  assert.equal(conditionTreeSql({ id: "r", conjunction: "and", items: [{ id: "g", conjunction: "or", items: [{ id: "a", field: "x", op: "eq", value: 1 }] }] }, () => "x = 1"), "x = 1", "单个条件不加括号");
  assert.deepEqual(pruneConditionTree(tree, (c) => c.id === "f1").items.map((n) => n.id), ["f1"], "组被剪空就删");
  assert.equal(conditionTreeToList(tree), null);
  assert.deepEqual(conditionTreeToList(conditionTreeFromList([{ id: "a", field: "x", op: "eq", value: 1 }], "or")), { conditions: [{ id: "a", field: "x", op: "eq", value: 1 }], conjunction: "or" });
});

test("editing: add / update / remove / conjunction, ids, depth and count limits", () => {
  let t: ConditionGroup = { id: "root", conjunction: "and", items: [] };
  t = addConditionNode(t, "root", { id: nextConditionId(t), field: "a", op: "eq", value: 1 });
  t = addConditionNode(t, "root", { id: nextConditionId(t, "g"), conjunction: "or", items: [{ id: nextConditionId(t), field: "b", op: "eq" }] });
  assert.deepEqual(t.items.map((n) => n.id), ["f1", "g1"]);
  assert.equal(findConditionNode(t, "f2")?.depth, 2);
  assert.equal(canAddConditionGroup(t, "root"), true);
  assert.equal(canAddConditionGroup(t, "g1"), false, "默认只嵌一层");
  assert.equal(canAddConditionGroup(t, "g1", { maxDepth: 2 }), true, "上限可改");
  assert.equal(canAddCondition(t, { maxConditions: 2 }), false);
  t = updateConditionNode(t, "f2", (c) => ({ ...c, value: 5 }));
  t = setConjunction(t, "g1", "and");
  assert.deepEqual(t.items[1], { id: "g1", conjunction: "and", items: [{ id: "f2", field: "b", op: "eq", value: 5 }] });
  t = removeConditionNode(t, "f2");
  assert.deepEqual(t.items.map((n) => n.id), ["f1"], "组里最后一个条件删掉，组也没了");
});

test("normalize: unknown fields / ops / values dropped, deeper groups dropped, count capped, ids unique", () => {
  const kindOf = (key: string) => (key === "n" ? "number" as const : key === "d" ? "date" as const : undefined);
  const input = {
    conjunction: "or",
    items: [
      { id: "a", field: "n", op: "gt", value: 3 },
      { id: "a", field: "n", op: "contains", value: "x" },
      { id: "b", field: "zz", op: "eq", value: 1 },
      { id: "c", field: "d", op: "inRange", value: { relative: "pastDays", days: 7 } },
      { id: "d", field: "n", op: "eq", value: { evil: true } },
      { id: "g", conjunction: "and", items: [{ field: "n", op: "lt", value: 9 }, { id: "deep", conjunction: "or", items: [{ field: "n", op: "eq", value: 1 }] }] },
      { id: "e", conjunction: "and", items: [] },
    ],
  };
  const out = normalizeConditionTree(input, kindOf);
  assert.equal(out.conjunction, "or");
  assert.deepEqual(out.items.map((n) => n.id), ["a", "c", "d", "g"], "未知字段、不配的条件、空组去掉");
  assert.deepEqual(out.items[2], { id: "d", field: "n", op: "eq" }, "坏值丢掉，条件留着（还没填完）");
  const group = out.items[3] as ConditionGroup;
  assert.deepEqual(group.items, [{ id: "f1", field: "n", op: "lt", value: 9 }], "超过一层的组丢掉；缺 id 补上");
  assert.equal(countConditions(normalizeConditionTree(input, kindOf, { maxConditions: 2 })), 2);
  assert.deepEqual(normalizeConditionTree("junk", kindOf), { id: "root", conjunction: "and", items: [] });
});
