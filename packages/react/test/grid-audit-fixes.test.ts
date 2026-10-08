// bt/fix-grid：审计确认的多维表格问题——SQL 选项字面量转义、条件不能静默丢、动态值解析成空时前后端一致、
// 服务端分组截断后 offset、数字 / 金额分组名、填充数列小数位与打码列、条件白话的字段类型、拖动卸载不提交、弹层在对话框里翻转。
import test from "node:test";
import assert from "node:assert/strict";
import { matchesFilter, type GridField, type GridFilter } from "../src/grid-core.ts";
import { groupTreeFromNodes } from "../src/grid-group-core.ts";
import type { GridQuery } from "../src/grid-data-core.ts";
import { buildGridSql, groupColumnSql, sortExpr, sqlStringLiteral, type GridSqlColumn } from "../src/grid-sql.ts";
import { buildGridGroupSql, gridGroupsFromSql } from "../src/grid-sql-groups.ts";
import { fillSeries, planFill } from "../src/grid-fill-core.ts";
import type { PlanContext } from "../src/grid-edit-core.ts";
import { conditionTreeParts, describeConditionTree } from "../src/condition-describe.ts";
import { track } from "../src/grid-drag.ts";
import { dialogArea } from "../src/floating-layer.ts";

const query = (items: GridFilter[], extra: Partial<GridQuery> = {}): GridQuery => ({ search: "", filters: [], conjunction: "and", sort: [], filter: { id: "root", conjunction: "and", items }, ...extra });

test("sortExpr / groupColumnSql: option values are safe SQL literals in every dialect (MySQL backslash too)", () => {
  const evil = "a\\' OR 1=1 -- ";
  const column: GridSqlColumn = { sql: "t.stage", type: "singleSelect", options: ["ok", evil, "it's"] };
  assert.equal(sqlStringLiteral(evil, "pg"), "'a\\'' OR 1=1 -- '", "pg / sqlite：只把单引号写两遍（反斜杠不是转义符）");
  assert.equal(sqlStringLiteral(evil, "mysql"), "'a\\\\'' OR 1=1 -- '", "mysql：反斜杠也写两遍，引号不会被吃掉");
  const mysql = sortExpr(column, "mysql");
  assert.equal(mysql, "CASE t.stage WHEN 'ok' THEN 0 WHEN 'a\\\\'' OR 1=1 -- ' THEN 1 WHEN 'it''s' THEN 2 ELSE 3 END");
  assert.equal(groupColumnSql(column, "mysql").order, mysql, "分组排序用同一套转义");
  const sql = buildGridSql(query([], { sort: [{ key: "stage", direction: "asc" }] }), { stage: column }, { dialect: "mysql" });
  assert.match(sql.orderBy, /WHEN 'a\\\\'' OR 1=1 -- ' THEN 1/);
});

test("buildGridSql: a complete user / multi condition is never dropped (fails closed, or IN on a scalar column)", () => {
  const columns: Record<string, GridSqlColumn> = {
    owner: { sql: "c.owner_id", type: "user" },
    owners: { sql: "c.owners", type: "user", array: true },
    tags: { sql: "c.tags", type: "multiSelect" },
  };
  const me = { resolve: (token: string) => (token === "me" ? ["u7"] : null) };
  const mine = buildGridSql(query([{ id: "a", field: "owner", op: "hasAny", value: { dynamic: "me" } }]), columns, { dialect: "mysql", ...me });
  assert.equal(mine.where, "c.owner_id IN (?)", "「负责人 是 我」在标量列上 = IN");
  assert.deepEqual(mine.params, ["u7"]);
  const none = buildGridSql(query([{ id: "a", field: "owner", op: "hasNone", value: ["u1", "u2"] }]), columns, { dialect: "sqlite" });
  assert.equal(none.where, "(c.owner_id IS NULL OR NOT c.owner_id IN (?, ?))");
  assert.equal(buildGridSql(query([{ id: "a", field: "owner", op: "hasAll", value: ["u1", "u2"] }]), columns, { dialect: "pg" }).where, "1 = 0", "一个人不可能同时是两个人");
  assert.equal(buildGridSql(query([{ id: "a", field: "owners", op: "hasAny", value: { dynamic: "me" } }]), columns, { dialect: "mysql", ...me }).where, "1 = 0", "数组列只有 PG 能表达：别的方言条件为假，不放出全部数据");
  assert.equal(buildGridSql(query([{ id: "a", field: "tags", op: "hasAny", value: ["vip"] }]), columns, { dialect: "pg" }).where, "1 = 0", "多选存成标量列表达不了 → 条件为假");
  assert.match(buildGridSql(query([{ id: "a", field: "owners", op: "hasAll", value: ["u1"] }]), columns, { dialect: "pg" }).where, /^c\.owners @> \$1::text\[\]$/);
});

test("dynamic value resolved to nothing: negative operators keep every row, positive ones none — SQL and client agree", () => {
  type Row = { id: string; owner: string; tags: string[]; stage: string; name: string };
  const fields: GridField<Row>[] = [
    { key: "owner", title: "负责人", type: "user" },
    { key: "tags", title: "标签", type: "multiSelect", options: [{ value: "vip", label: "VIP" }] },
    { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "a", label: "甲" }] },
    { key: "name", title: "名称", type: "text" },
  ];
  const row: Row = { id: "r1", owner: "王磊", tags: ["vip"], stage: "a", name: "王磊" };
  const columns: Record<string, GridSqlColumn> = { owner: { sql: "c.owner", type: "user", array: true }, tags: { sql: "c.tags", type: "multiSelect", array: true }, stage: { sql: "c.stage", type: "singleSelect" }, name: { sql: "c.name", type: "text" } };
  const context = { resolve: (token: string) => (token === "team" ? [] : null) };
  const cases: [string, GridFilter["op"], boolean][] = [
    ["owner", "hasAny", false], ["owner", "hasAll", false], ["owner", "hasNone", true],
    ["tags", "hasAll", false], ["tags", "hasNone", true],
    ["stage", "anyOf", false], ["stage", "noneOf", true],
    ["name", "is", false], ["name", "isNot", true],
  ];
  for (const [field, op, expected] of cases) {
    const filter: GridFilter = { id: "f", field, op, value: { dynamic: "team" } };
    assert.equal(matchesFilter(fields.find((f) => f.key === field)!, row, filter, context), expected, `前端 ${field} ${op}`);
    assert.equal(buildGridSql(query([filter]), columns, { dialect: "pg", ...context }).where, expected ? "1 = 1" : "1 = 0", `SQL ${field} ${op}`);
  }
  const unresolved: GridFilter = { id: "f", field: "owner", op: "hasNone", value: { dynamic: "boss" } };
  assert.equal(matchesFilter(fields[0]!, row, unresolved, context), false, "解析不了 = 不匹配");
  assert.equal(buildGridSql(query([unresolved]), columns, { dialect: "pg", ...context }).where, "1 = 0");
});

test("groupTreeFromNodes: a parent's own count moves the offset even when its children were cut off", () => {
  const fields: GridField<{ a: string; b: string }>[] = [{ key: "a", title: "A", type: "text" }, { key: "b", title: "B", type: "text" }];
  const levels = [{ field: "a", order: "asc" as const }, { field: "b", order: "asc" as const }];
  const tree = groupTreeFromNodes(
    [{ path: ["x"], count: 100 }, { path: ["y"], count: 5 }, { path: ["x", "1"], count: 30 }, { path: ["x", "2"], count: 10 }],
    levels,
    fields,
  );
  assert.deepEqual(tree.map((g) => [g.value, g.offset, g.count]), [["x", 0, 100], ["y", 100, 5]], "x 的子组只到了 40 条，y 仍从 100 开始");
  assert.deepEqual(tree[0]!.children.map((g) => g.offset), [0, 30]);
});

test("gridGroupsFromSql: number / money group keys get display labels (money keys are minor units)", () => {
  type Deal = { amount: number; n: number; stage: string };
  const fields: GridField<Deal>[] = [{ key: "amount", title: "金额", type: "money", currency: "¥" }, { key: "n", title: "数量", type: "number", precision: 1 }, { key: "stage", title: "阶段", type: "text" }];
  const columns: Record<string, GridSqlColumn> = { amount: { sql: "d.amount_fen", type: "money" }, n: { sql: "d.n", type: "number" }, stage: { sql: "d.stage", type: "text" } };
  const plan = buildGridGroupSql(query([], { groups: [{ field: "amount", order: "asc" }, { field: "n", order: "asc" }] }), columns, { dialect: "pg" });
  assert.deepEqual(plan.levels.map((l) => l.field), ["amount", "n"]);
  const result = gridGroupsFromSql([[{ g0: "1250050", n: 2 }, { g0: null, n: 1 }], [{ g0: "1250050", g1: "3.25", n: 2 }]], plan, fields);
  assert.equal(result.groups[0]!.label, "¥12,500.50", "分组名按金额显示，不是 1250050");
  assert.equal(result.groups[1]!.label, undefined, "空组用（空）");
  assert.equal(result.groups[2]!.label, "3.3", "数字按字段小数位");
});

test("fillSeries: no float tail without a precision; horizontal fill never copies masked text", () => {
  const n: GridField<unknown> = { key: "n", title: "数量", type: "number", editable: true };
  assert.deepEqual([1, 2].map(fillSeries(n, [12345678.1, 12345678.2], false)!), [12345678.3, 12345678.4], "按源值最多的小数位取整");
  assert.deepEqual([1].map(fillSeries(n, [1.25, 1.5], false)!), [1.75]);
  assert.deepEqual([1].map(fillSeries(n, [1e-7, 2e-7], false)!), [3e-7]);
  type Row = { id: string; phone: string; note: string };
  const fields: GridField<Row>[] = [
    { key: "phone", title: "电话", type: "phone", mask: true, editable: true },
    { key: "note", title: "备注", type: "text", editable: true },
  ];
  const data: Row[] = [{ id: "r1", phone: "13800138000", note: "" }];
  const context: PlanContext<Row> = { rowAt: (i) => (data[i] ? { row: data[i]!, rowId: data[i]!.id } : null), rowCount: 1, fieldAt: (c) => fields[c] ?? null };
  const plan = planFill({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } }, { direction: "right", range: { anchor: { row: 0, col: 1 }, focus: { row: 0, col: 1 } } }, context);
  assert.deepEqual(plan.changes, [], "打码的电话不复制成 138****8000");
  assert.match(plan.skipped[0]!.reason, /已打码/);
});

test("describeConditionTree: formula follows its result type; restricted / unfilterable fields are inactive", () => {
  const tree = {
    id: "root",
    conjunction: "and" as const,
    items: [
      { id: "a", field: "total", op: "gte", value: 10 },
      { id: "b", field: "phone", op: "contains", value: "138" },
      { id: "c", field: "secret", op: "contains", value: "x" },
    ],
  };
  const fields = [
    { key: "total", title: "合计", type: "formula", resultType: "number" },
    { key: "phone", title: "电话", type: "phone", restricted: "只有主管能看" },
    { key: "secret", title: "备注", type: "text", filterable: false },
  ];
  const parts = conditionTreeParts(tree, fields).items;
  assert.equal(parts[0]!.kind === "condition" && parts[0]!.inactive, false, "公式按数字判断：≥ 10 是完整条件");
  assert.equal(parts[1]!.kind === "condition" && parts[1]!.inactive, true, "受限字段不能筛");
  assert.equal(parts[2]!.kind === "condition" && parts[2]!.inactive, true);
  assert.equal(describeConditionTree(tree, fields), "合计 ≥ 10");
});

test("track: cancel removes the listeners without committing", () => {
  const target = new EventTarget();
  const moves: number[] = [];
  let ups = 0;
  const cancel = track(() => moves.push(1), () => ups++, target);
  target.dispatchEvent(new Event("pointermove"));
  cancel();
  target.dispatchEvent(new Event("pointermove"));
  target.dispatchEvent(new Event("pointerup"));
  assert.deepEqual(moves, [1]);
  assert.equal(ups, 0, "卸载时不提交");
  const done = track(() => {}, () => ups++, target);
  target.dispatchEvent(new Event("pointerup"));
  target.dispatchEvent(new Event("pointerup"));
  assert.equal(ups, 1, "松手只提交一次");
  done();
});

test("dialogArea: the part of a dialog inside the viewport", () => {
  assert.deepEqual(dialogArea({ top: 146, left: 240, right: 1200, bottom: 854 }, { width: 1440, height: 1000 }), { top: 146, left: 240, width: 960, height: 708 });
  assert.deepEqual(dialogArea({ top: -20, left: 0, right: 390, bottom: 900 }, { width: 390, height: 844 }), { top: 0, left: 0, width: 390, height: 844 });
});

test("colorTone: legacy chip colours map to the nearest of the ten hues, never painted raw", async () => {
  const { colorTone } = await import("../src/option-tone.ts");
  assert.deepEqual(["#7c3aed", "#0891b2", "#16a34a", "#dc2626", "#b45309", "#2563eb", "#888", "purple", "nope"].map(colorTone), ["violet", "teal", "green", "red", "orange", "blue", "gray", "violet", undefined]);
});

test("placeLayer: an end-aligned layer that would run off the left edge lines up with the anchor's left instead", async () => {
  const { placeLayer } = await import("../src/menu-core.ts");
  const cell = { top: 300, bottom: 336, left: 260, right: 400, width: 140, height: 36 };
  const p = placeLayer(cell, { width: 560, height: 300 }, { width: 1440, height: 900 }, { align: "end" });
  assert.equal(p.left, 260, "不再被推到 x = 8 盖住侧栏");
  assert.equal(placeLayer({ ...cell, left: 1300, right: 1420 }, { width: 300, height: 100 }, { width: 1440, height: 900 }).left, 1132, "左对齐放不下时只往左挪到刚好放下");
  assert.equal(placeLayer({ ...cell, left: 600, right: 680 }, { width: 240, height: 100 }, { width: 1440, height: 900 }, { align: "end" }).left, 440, "放得下时照旧");
});

test("placeLayer: a wide start-aligned panel near the right slides left only as far as it must (never flips across a left sidebar)", async () => {
  const { placeLayer } = await import("../src/menu-core.ts");
  // 审阅 03：多维表格「筛选」按钮在 815–885，面板 640 宽；以前右对齐到按钮右边 → left 245，压住「数据表」目录栏
  const filter = { top: 150, bottom: 178, left: 815, right: 885, width: 70, height: 28 };
  const p = placeLayer(filter, { width: 640, height: 130 }, { width: 1440, height: 900 }, { gap: 4 });
  assert.equal(p.left, 1440 - 8 - 640, "贴右边距放下，仍盖住按钮");
  assert.ok(p.left <= filter.left && p.left + 640 >= filter.right, "面板横向罩住触发按钮");
  assert.equal(p.top, 182);
});
