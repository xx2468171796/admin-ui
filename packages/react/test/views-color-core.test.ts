// bt/templates：视图的颜色依据（甘特条 / 卡片）——按单选字段、按条件（和表格填色同一个规则模型）、统一颜色。
import test from "node:test";
import assert from "node:assert/strict";
import { viewColorBasis, viewRecordTone } from "../src/views/view-color-core.ts";
import { newColorRule } from "../src/grid-color-core.ts";
import type { GridColorRule, GridField } from "../src/grid-core.ts";

type Job = { id: string; stage: string | null; amount: number; installer: string };
const fields: GridField<Job>[] = [
  { key: "id", title: "编号", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "quote", label: "报价", tone: "yellow" }, { value: "won", label: "成交", tone: "greenSolid" }] },
  { key: "amount", title: "金额", type: "number" },
  { key: "installer", title: "安装", type: "text" },
];
const big: GridColorRule = { id: "c1", target: "row", tone: "red", filter: { id: "root", conjunction: "and", items: [{ id: "f1", field: "amount", op: "gt", value: 100 }] } };
const ajie: GridColorRule = { id: "c2", target: "row", tone: "blue", filter: { id: "root", conjunction: "and", items: [{ id: "f1", field: "installer", op: "is", value: "阿杰" }] } };

test("颜色依据：有单选字段先按字段，其次有规则按条件，否则统一颜色", () => {
  assert.equal(viewColorBasis({ colorField: "stage", colorRules: [big] }), "option");
  assert.equal(viewColorBasis({ colorField: null, colorRules: [big] }), "condition");
  assert.equal(viewColorBasis({ colorRules: [] }), "uniform");
  assert.equal(viewColorBasis({}), "uniform");
});

test("按单选字段：选项的色调（旧色名换成新色），没值或不认识的值是灰", () => {
  assert.equal(viewRecordTone({ id: "1", stage: "quote", amount: 1, installer: "" }, fields, { colorField: "stage" }), "yellow");
  assert.equal(viewRecordTone({ id: "2", stage: null, amount: 1, installer: "" }, fields, { colorField: "stage" }), "gray");
});

test("按条件：规则从上到下，第一条符合的生效；都不符合用默认色；单元格规则不算", () => {
  const job = { id: "3", stage: "won", amount: 500, installer: "阿杰" };
  assert.equal(viewRecordTone(job, fields, { colorRules: [big, ajie] }), "red");
  assert.equal(viewRecordTone(job, fields, { colorRules: [ajie, big] }), "blue");
  assert.equal(viewRecordTone({ ...job, amount: 5, installer: "小王" }, fields, { colorRules: [big, ajie] }), "green");
  assert.equal(viewRecordTone(job, fields, { colorRules: [{ ...big, target: "cell", field: "amount" }] }), "green");
  assert.equal(viewRecordTone(job, fields, { colorRules: [{ ...big, enabled: false }, ajie] }), "blue");
});

test("新规则：编号不重复、整行、注意色、带一个空条件", () => {
  const rule = newColorRule([big, { ...ajie, id: "c3" }], fields[2]);
  assert.equal(rule.id, "c4");
  assert.equal(rule.target, "row");
  assert.equal(rule.tone, "yellow");
  assert.equal(rule.filter.items.length, 1);
});

test("softTone：日历事件 / 甘特条一律软底，实心选项用同色相的浅色，其余原样（审阅 08）", async () => {
  const { softTone } = await import("../src/views/view-color-core.ts");
  assert.equal(softTone("greenSolid"), "green");
  assert.equal(softTone("blueSolid"), "blue");
  assert.equal(softTone("green"), "green", "软色原样");
  assert.equal(softTone("violet"), "violet");
});
