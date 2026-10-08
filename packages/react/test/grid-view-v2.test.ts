import test from "node:test";
import assert from "node:assert/strict";
import { filterGridRows, gridViewReducer, normalizeGridView, parseGridView, serializeGridView, type GridField, type GridView } from "../src/grid-core.ts";
import { GRID_LIMITS, isGroupedBy, normalizeGroupLevels, orderWithFieldGroups } from "../src/grid-view-v2.ts";
import { gridRowFill } from "../src/grid-color-core.ts";
import { describeViewDiff, viewDiffText } from "../src/view-diff-core.ts";
import { fieldLayoutOf, fieldPanelTree } from "../src/grid-fields-core.ts";

type Lead = { id: string; name: string; stage: string; owner: string[]; rating: number | null; next: string | null; phone: string; region: string; amount: number | null };
const fields: GridField<Lead>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "first", label: "首通" }, { value: "quote", label: "报价" }, { value: "won", label: "成交" }] },
  { key: "owner", title: "负责人", type: "user" },
  { key: "rating", title: "意向", type: "number" },
  { key: "next", title: "下次跟进", type: "date" },
  { key: "phone", title: "手机", type: "text", group: "联系方式" },
  { key: "region", title: "地区", type: "singleSelect", group: "联系方式", options: [{ value: "tp", label: "上海" }, { value: "tc", label: "苏州" }] },
  { key: "amount", title: "成交价", type: "money", restricted: "只有主管能看" },
];
const rows: Lead[] = [
  { id: "1", name: "陈雅婷", stage: "first", owner: ["小王"], rating: 4, next: "2026-10-03", phone: "1381", region: "tp", amount: null },
  { id: "2", name: "林志明", stage: "quote", owner: ["阿杰"], rating: 5, next: "2026-09-20", phone: "1392", region: "tc", amount: 100 },
  { id: "3", name: "王美玲", stage: "quote", owner: ["小王"], rating: 2, next: "2026-10-06", phone: "1363", region: "tp", amount: null },
  { id: "4", name: "张家豪", stage: "won", owner: ["美华"], rating: 5, next: null, phone: "1584", region: "tp", amount: 5 },
];
const ctx = { now: Date.parse("2026-10-07T04:00:00Z"), resolve: (token: string) => (token === "me" ? ["小王"] : token === "mySubordinates" ? ["阿杰", "美华"] : null) };

test("old stored views migrate: flat filters + conjunction → tree, groupBy string → levels, collapsed kept", () => {
  const v1 = JSON.stringify({ v: 1, view: { order: ["name", "stage"], hidden: [], widths: { stage: 140 }, sort: [], filters: [{ id: "f1", field: "stage", op: "anyOf", value: ["quote"] }, { id: "f2", field: "rating", op: "gte", value: 5 }], conjunction: "or", groupBy: "stage", collapsed: ["won"], search: "", rowHeight: "short", summary: {} } });
  const view = parseGridView(v1, fields)!;
  assert.deepEqual(view.filter, { id: "root", conjunction: "or", items: [{ id: "f1", field: "stage", op: "anyOf", value: ["quote"] }, { id: "f2", field: "rating", op: "gte", value: 5 }] });
  assert.deepEqual(view.groupBy, [{ field: "stage", order: "asc" }]);
  assert.deepEqual(view.collapsed, ["won"], "一级分组的折叠键不变");
  assert.equal(view.autoSort, true);
  assert.equal(view.showEmptyGroups, false);
  assert.deepEqual(filterGridRows(rows, fields, view).map((r) => r.id), ["2", "3", "4"], "旧视图照样筛选（报价 或 意向 ≥ 5）");
  // Round trip in the new shape; the legacy keys are gone.
  const again = parseGridView(serializeGridView(view), fields)!;
  assert.deepEqual(again, view);
  assert.ok(!("filters" in again) && !("conjunction" in again));
  // Old host defaults still type-check and work.
  assert.deepEqual(normalizeGridView({ groupBy: "stage" }, fields).groupBy, [{ field: "stage", order: "asc" }]);
  assert.deepEqual(normalizeGroupLevels([{ field: "stage", order: "desc" }, "region", { field: "stage" }, { field: "nope" }], fields), [{ field: "stage", order: "desc" }, { field: "region", order: "asc" }]);
});

test("nested filters with 「我」, 「我的下属」, relative dates; restricted fields cannot filter", () => {
  const view = normalizeGridView({
    filter: {
      conjunction: "and",
      items: [
        { field: "stage", op: "anyOf", value: ["quote", "first"] },
        { id: "g1", conjunction: "or", items: [{ field: "rating", op: "gte", value: 5 }, { field: "next", op: "inRange", value: { relative: "pastDays", days: 7 } }] },
      ],
    },
  }, fields);
  assert.deepEqual(filterGridRows(rows, fields, view, ctx).map((r) => r.id), ["1", "2", "3"], "（意向 ≥ 5 或 过去 7 天要跟进）且 阶段");
  const mine = normalizeGridView({ filter: { items: [{ field: "owner", op: "hasAny", value: { dynamic: "me" } }] } }, fields);
  assert.deepEqual(filterGridRows(rows, fields, mine, ctx).map((r) => r.id), ["1", "3"]);
  const team = normalizeGridView({ filter: { items: [{ field: "owner", op: "hasAny", value: { dynamic: "mySubordinates" } }] } }, fields);
  assert.deepEqual(filterGridRows(rows, fields, team, ctx).map((r) => r.id), ["2", "4"]);
  assert.deepEqual(filterGridRows(rows, fields, mine, {}).map((r) => r.id), [], "宿主没解析「我」→ 一条都不显示，不会退回全部");
  const today = normalizeGridView({ filter: { items: [{ field: "next", op: "before", value: { relative: "today" } }] } }, fields);
  assert.deepEqual(filterGridRows(rows, fields, today, ctx).map((r) => r.id), ["1", "2", "3"], "早于今天（逾期）");
  const restricted = normalizeGridView({ filter: { items: [{ field: "amount", op: "notEmpty" }] } }, fields);
  assert.equal(filterGridRows(rows, fields, restricted, ctx).length, 4, "受限字段的条件不生效");
});

test("reducer: groups, nested filter groups within the limit, field layout, colours", () => {
  let view = normalizeGridView({}, fields);
  view = gridViewReducer(view, { type: "addFilter", field: "stage" }, fields);
  view = gridViewReducer(view, { type: "addFilterGroup", field: "rating" }, fields);
  view = gridViewReducer(view, { type: "addFilter", field: "next", group: "g1" }, fields);
  assert.deepEqual(view.filter.items.map((n) => n.id), ["f1", "g1"]);
  assert.equal((view.filter.items[1] as { items: unknown[] }).items.length, 2);
  view = gridViewReducer(view, { type: "conjunction", value: "and", group: "g1" }, fields);
  assert.equal((view.filter.items[1] as { conjunction: string }).conjunction, "and");
  view = gridViewReducer(view, { type: "updateFilter", id: "f3", patch: { op: "inRange", value: { relative: "thisWeek" } } }, fields);
  view = gridViewReducer(view, { type: "updateFilter", id: "f3", patch: { op: "is" } }, fields);
  assert.deepEqual(findValue(view, "f3"), { relative: "thisWeek" }, "换条件时还合适的值留着");
  view = gridViewReducer(view, { type: "updateFilter", id: "f3", patch: { op: "inRange", value: { from: "2026-10-01", to: "2026-10-05" } } }, fields);
  view = gridViewReducer(view, { type: "updateFilter", id: "f3", patch: { op: "before" } }, fields);
  assert.equal(findValue(view, "f3"), undefined, "固定范围不适合「早于」，丢掉");
  view = gridViewReducer(view, { type: "removeFilter", id: "g1" }, fields);
  assert.deepEqual(view.filter.items.map((n) => n.id), ["f1"]);
  view = gridViewReducer(view, { type: "setGroups", levels: [{ field: "stage", order: "asc" }, { field: "owner", order: "asc" }, { field: "region", order: "desc" }] }, fields);
  view = gridViewReducer(view, { type: "toggleGroup", key: "quote" }, fields);
  view = gridViewReducer(view, { type: "setGroups", levels: [{ field: "stage", order: "desc" }, { field: "owner", order: "asc" }, { field: "region", order: "desc" }] }, fields);
  assert.deepEqual(view.collapsed, ["quote"], "只改顺序不清折叠");
  view = gridViewReducer(view, { type: "setGroups", levels: [{ field: "owner", order: "asc" }] }, fields);
  assert.deepEqual(view.collapsed, [], "换字段清折叠");
  assert.equal(isGroupedBy(view, "owner"), true);
  assert.equal(GRID_LIMITS.maxGroupLevels, 3);
  view = gridViewReducer(view, { type: "setHidden", keys: ["name", "phone", "region"], hidden: true }, fields);
  assert.deepEqual(view.hidden, ["phone", "region"], "主字段不能隐藏");
  view = gridViewReducer(view, { type: "showEmptyGroups", value: true }, fields);
  view = gridViewReducer(view, { type: "autoSort", value: false }, fields);
  assert.equal(view.showEmptyGroups && !view.autoSort, true);
  view = gridViewReducer(view, { type: "setColors", rules: [{ id: "c1", target: "row", tone: "yellow", filter: { id: "root", conjunction: "and", items: [{ id: "f1", field: "next", op: "before", value: { relative: "today" } }] } }, { id: "c1", target: "row", tone: "red", filter: { id: "root", conjunction: "and", items: [] } }, { id: "c2", target: "cell", tone: "purple" as never, filter: { id: "root", conjunction: "and", items: [] } }] }, fields);
  assert.deepEqual(view.colors.map((r) => r.id), ["c1"], "重复 id、未知颜色去掉");
});
const findValue = (view: GridView, id: string): unknown => {
  const walk = (items: readonly unknown[]): unknown => {
    for (const node of items as { id: string; items?: unknown[]; value?: unknown }[]) {
      if (node.id === id) return node.value;
      if (node.items) { const hit = walk(node.items); if (hit !== undefined) return hit; }
    }
    return undefined;
  };
  return walk(view.filter.items);
};

test("field groups: seeded from fields, members adjacent in the column order, panel tree round trip", () => {
  const view = normalizeGridView({ order: ["name", "phone", "stage", "region"] }, fields);
  assert.deepEqual(view.fieldGroups, [{ id: "group:联系方式", title: "联系方式", fields: ["phone", "region"] }]);
  assert.deepEqual(view.order.slice(0, 4), ["name", "phone", "region", "stage"], "编组成员挨在一起");
  assert.deepEqual(orderWithFieldGroups(["a", "x", "b", "y"], [{ id: "g", title: "G", fields: ["a", "b"] }]), ["a", "b", "x", "y"]);
  const tree = fieldPanelTree(view, "name");
  assert.deepEqual(tree.slice(0, 2), [{ id: "name", locked: true }, { id: "§group:联系方式", children: [{ id: "phone" }, { id: "region" }] }]);
  // Drag 「地区」 out of the group to the end.
  const moved = [tree[0]!, { ...tree[1]!, children: [{ id: "phone" }] }, ...tree.slice(2), { id: "region" }];
  const layout = fieldLayoutOf(moved, view.fieldGroups);
  assert.deepEqual(layout.fieldGroups, [{ id: "group:联系方式", title: "联系方式", fields: ["phone"] }]);
  assert.equal(layout.order.at(-1), "region");
  const next = gridViewReducer(view, { type: "setFieldLayout", ...layout }, fields);
  assert.equal(next.order.at(-1), "region");
  const withEmpty = gridViewReducer(next, { type: "addFieldGroup", id: "money", title: "金额" }, fields);
  assert.deepEqual(fieldPanelTree(withEmpty, "name").at(-1), { id: "§money", children: [] }, "空编组放最后");
  // Stored groups win over the field declarations; a field sits in one group only.
  assert.deepEqual(normalizeGridView({ fieldGroups: [{ id: "a", title: "A", fields: ["phone", "name"] }, { id: "b", title: "B", fields: ["phone", "stage"] }] }, fields).fieldGroups, [{ id: "a", title: "A", fields: ["phone"] }, { id: "b", title: "B", fields: ["stage"] }]);
});

test("填色: first matching rule wins per row / per cell; disabled and empty rules colour nothing", () => {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const overdue = { id: "root", conjunction: "and" as const, items: [{ id: "f1", field: "next", op: "before" as const, value: { relative: "today" as const } }] };
  const hot = { id: "root", conjunction: "and" as const, items: [{ id: "f1", field: "rating", op: "gte" as const, value: 5 }] };
  const rules = [
    { id: "a", target: "row" as const, tone: "red" as const, filter: overdue, enabled: false },
    { id: "b", target: "row" as const, tone: "yellow" as const, filter: overdue },
    { id: "c", target: "row" as const, tone: "green" as const, filter: hot },
    { id: "d", target: "cell" as const, field: "rating", tone: "greenSolid" as const, filter: hot },
    { id: "e", target: "row" as const, tone: "blue" as const, filter: { id: "root", conjunction: "and" as const, items: [] } },
  ];
  assert.deepEqual(gridRowFill(rows[1]!, rules, byKey, ctx), { row: "yellow", cells: { rating: "greenSolid" } }, "逾期且意向 5：整行注意色，意向格实心");
  assert.deepEqual(gridRowFill(rows[3]!, rules, byKey, ctx), { row: "green", cells: { rating: "greenSolid" } });
  assert.equal(gridRowFill({ ...rows[3]!, rating: 1 }, rules, byKey, ctx), null, "空规则不给所有行上色");
});

test("describeViewDiff: what the personal copy changed, ids ignored", () => {
  const base = normalizeGridView({ groupBy: "stage", widths: { name: 200 } }, fields);
  assert.deepEqual(describeViewDiff(base, base, fields), []);
  let mine = gridViewReducer(base, { type: "addFilter", field: "stage" }, fields);
  mine = gridViewReducer(mine, { type: "updateFilter", id: "f1", patch: { value: ["quote"] } }, fields);
  mine = gridViewReducer(mine, { type: "addFilterGroup", field: "rating" }, fields);
  mine = gridViewReducer(mine, { type: "addFilter", field: "next", group: "g1" }, fields);
  assert.equal(describeViewDiff(base, mine, fields)[0]!.text, "筛选 1 条（含 1 个条件组）", "只数填完的条件");
  mine = gridViewReducer(mine, { type: "updateFilter", id: "f2", patch: { value: 4 } }, fields);
  mine = gridViewReducer(mine, { type: "updateFilter", id: "f3", patch: { value: { relative: "today" } } }, fields);
  mine = gridViewReducer(mine, { type: "setGroups", levels: [{ field: "stage", order: "asc" }, { field: "owner", order: "asc" }, { field: "region", order: "asc" }] }, fields);
  for (const key of ["stage", "owner", "rating"]) mine = gridViewReducer(mine, { type: "resize", key, width: 300 }, fields);
  mine = gridViewReducer(mine, { type: "toggleGroup", key: "quote" }, fields);
  mine = gridViewReducer(mine, { type: "search", value: "陈" }, fields);
  const items = describeViewDiff(base, mine, fields);
  assert.deepEqual(items.map((i) => i.text), ["筛选 3 条（含 1 个条件组）", "按「阶段 → 负责人 → 地区」分组", "调过 3 列的列宽"], "搜索和折叠不算设置");
  assert.equal(viewDiffText(items), "筛选 3 条（含 1 个条件组）、按「阶段 → 负责人 → 地区」分组、调过 3 列的列宽");
  const renamed = { ...mine, filter: JSON.parse(JSON.stringify(mine.filter).replace(/"f(\d)"/g, '"z$1"')) };
  assert.deepEqual(describeViewDiff(mine, renamed, fields), [], "条件 id 不同不算改动");
  assert.deepEqual(describeViewDiff(base, gridViewReducer(base, { type: "freeze", count: 3 }, fields), fields).map((i) => i.text), ["冻结前 3 列"], "冻结线（bt/grid-b）也算个人设置");
  const cleared = gridViewReducer(base, { type: "groupBy", key: null }, fields);
  assert.deepEqual(describeViewDiff(base, cleared, fields).map((i) => i.text), ["取消了分组"]);
  assert.equal(viewDiffText([1, 2, 3, 4, 5].map((n) => ({ kind: "order" as const, text: `x${n}` })), 4), "x1、x2、x3、x4 等 5 项");
});
