// bt/grid-b G10：填充柄纯规则——拖动目标区域、复制 / 数列（数字、金额、日期、日期时间、评分、进度）、向上 / 向左倒推、
// 只读与校验跳过、分组行跳过、横向按文字解析、Ctrl+D。
import test from "node:test";
import assert from "node:assert/strict";
import type { GridField } from "../src/grid-core.ts";
import type { PlanContext } from "../src/grid-edit-core.ts";
import { fillDownTarget, filledRange, fillSeries, fillTarget, planFill } from "../src/grid-fill-core.ts";

type Row = { id: string; n: number | null; amount: number | null; day: string | null; at: string | null; stage: string | null; star: number | null; pct: number | null; locked?: boolean; name: string };
const fields: GridField<Row>[] = [
  { key: "name", title: "名称", type: "text", primary: true, editable: true },
  { key: "n", title: "数量", type: "number", editable: true, validate: (v) => (typeof v === "number" && v > 100 ? "不能超过 100" : null) },
  { key: "amount", title: "金额", type: "money", editable: true },
  { key: "day", title: "日期", type: "date", editable: (row) => !row.locked },
  { key: "at", title: "时间", type: "datetime", editable: true },
  { key: "stage", title: "阶段", type: "singleSelect", editable: true, options: [{ value: "a", label: "甲" }, { value: "b", label: "乙" }] },
  { key: "star", title: "评分", type: "rating", editable: true },
  { key: "pct", title: "进度", type: "progress", editable: true },
];
const row = (i: number, patch: Partial<Row> = {}): Row => ({ id: `r${i}`, n: null, amount: null, day: null, at: null, stage: null, star: null, pct: null, name: `R${i}`, ...patch });
// Display rows: index 3 is a group header (null).
const make = (data: (Row | null)[]): PlanContext<Row> => ({ rowAt: (i) => (data[i] ? { row: data[i]!, rowId: data[i]!.id } : null), rowCount: data.length, fieldAt: (c) => fields[c] ?? null });
const col = (key: string) => fields.findIndex((f) => f.key === key);
const values = (plan: ReturnType<typeof planFill<Row>>) => plan.changes.map((c) => [c.rowId, c.field, c.value]);

test("fillTarget: the axis the pointer moved further on, clamped to the data area", () => {
  const b = { top: 2, bottom: 3, left: 1, right: 2 };
  const limits = { rows: 10, firstCol: 1, lastCol: 7 };
  assert.equal(fillTarget(b, { row: 3, col: 2 }, limits), null, "还在源选区里");
  assert.deepEqual(fillTarget(b, { row: 6, col: 3 }, limits), { direction: "down", range: { anchor: { row: 4, col: 1 }, focus: { row: 6, col: 2 } } });
  assert.deepEqual(fillTarget(b, { row: 0, col: 2 }, limits), { direction: "up", range: { anchor: { row: 0, col: 1 }, focus: { row: 1, col: 2 } } });
  assert.deepEqual(fillTarget(b, { row: 3, col: 9 }, limits), { direction: "right", range: { anchor: { row: 2, col: 3 }, focus: { row: 3, col: 7 } } }, "列夹到最后一个字段");
  assert.deepEqual(fillTarget(b, { row: 2, col: 0 }, limits), null, "行号列不算（夹到第一个字段 = 源选区里）");
  assert.deepEqual(fillTarget(b, { row: 12, col: 12 }, limits)?.direction, "down", "一样远时按行");
  const target = fillTarget(b, { row: 6, col: 2 }, limits)!;
  assert.deepEqual(filledRange({ anchor: { row: 2, col: 1 }, focus: { row: 3, col: 2 } }, target), { anchor: { row: 2, col: 1 }, focus: { row: 6, col: 2 } });
});

test("fillSeries: constant steps continue, anything else is null", () => {
  const n = fields[col("n")]!;
  assert.deepEqual([1, 2, 3].map(fillSeries(n, [1, 3], false)!), [5, 7, 9]);
  assert.deepEqual([1, 2].map(fillSeries(n, [1, 3], true)!), [-1, -3], "向上倒推");
  assert.deepEqual([1, 2].map(fillSeries(n, [0.1, 0.2], false)!), [0.3, 0.4], "没有浮点尾巴");
  assert.equal(fillSeries(n, [1, 2, 4], false), null, "步长不一致 → 循环复制");
  assert.equal(fillSeries(n, [5], false), null, "一个值 → 复制");
  assert.equal(fillSeries(n, [1, null], false), null);
  assert.deepEqual([1].map(fillSeries(fields[col("amount")]!, [100, 250], false)!), [400], "金额按分");
  assert.deepEqual([1, 2].map(fillSeries(fields[col("day")]!, ["2026-10-01", "2026-10-08"], false)!), ["2026-10-15", "2026-10-22"], "日期按天");
  assert.deepEqual([1].map(fillSeries(fields[col("day")]!, ["2026-10-30", "2026-10-31"], false)!), ["2026-11-01"], "跨月");
  assert.deepEqual([1].map(fillSeries(fields[col("at")]!, ["2026-10-01T01:00:00.000Z", "2026-10-01T03:00:00.000Z"], false)!), ["2026-10-01T05:00:00.000Z"]);
  assert.deepEqual([1, 2, 3].map(fillSeries(fields[col("star")]!, [3, 4], false)!), [5, 5, 5], "评分夹在 0–5");
  assert.deepEqual([1, 2].map(fillSeries(fields[col("pct")]!, [80, 90], false)!), [100, 100], "进度夹在 0–100");
  assert.equal(fillSeries(fields[col("stage")]!, ["a", "b"], false), null, "单选不续写");
});

test("planFill down: copy one, continue a series, cycle a pattern, skip group rows, read-only and invalid cells", () => {
  const data = [row(0, { n: 1, stage: "a", amount: 100 }), row(1, { n: 2, stage: "b", amount: 100 }), row(2), null, row(3, { locked: true }), row(4), row(5)];
  const context = make(data);
  // Source rows 0–1, columns 数量 … 阶段; target rows 2–6 (row 3 is a group header).
  const source = { anchor: { row: 0, col: col("n") }, focus: { row: 1, col: col("stage") } };
  const target = fillTarget({ top: 0, bottom: 1, left: col("n"), right: col("stage") }, { row: 6, col: col("n") }, { rows: data.length, firstCol: 0, lastCol: 7 })!;
  const plan = planFill(source, target, context);
  const n = plan.changes.filter((c) => c.field === "n").map((c) => [c.rowId, c.value]);
  assert.deepEqual(n, [["r2", 3], ["r3", 4], ["r4", 5], ["r5", 6]], "数量续写，分组行不占位");
  const stage = plan.changes.filter((c) => c.field === "stage").map((c) => c.value);
  assert.deepEqual(stage, ["a", "b", "a", "b"], "单选循环复制");
  assert.deepEqual(plan.changes.filter((c) => c.field === "amount").map((c) => c.value), [100, 100, 100, 100], "两个一样的金额 = 步长 0");
  assert.deepEqual(plan.skipped, [{ row: 4, col: col("day"), reason: "「日期」不能编辑" }], "按行只读的格子跳过");
  // One record changed in several fields: `next` carries all of them.
  const r2 = plan.changes.filter((c) => c.rowId === "r2").at(-1)!;
  assert.equal(r2.next.n, 3);
  assert.equal(r2.next.stage, "a");
  // validate refuses
  const big = planFill({ anchor: { row: 0, col: col("n") }, focus: { row: 0, col: col("n") } }, { direction: "down", range: { anchor: { row: 1, col: col("n") }, focus: { row: 1, col: col("n") } } }, make([row(0, { n: 101 }), row(1)]));
  assert.deepEqual(big.skipped.map((s) => s.reason), ["不能超过 100"]);
});

test("planFill up continues backwards; Ctrl+D copies the top row", () => {
  const data = [row(0), row(1), row(2, { n: 10, day: "2026-10-10" }), row(3, { n: 20, day: "2026-10-12" })];
  const plan = planFill({ anchor: { row: 2, col: col("n") }, focus: { row: 3, col: col("day") } }, { direction: "up", range: { anchor: { row: 0, col: col("n") }, focus: { row: 1, col: col("day") } } }, make(data));
  assert.deepEqual(values(plan).filter(([, f]) => f === "n"), [["r1", "n", 0], ["r0", "n", -10]]);
  assert.deepEqual(values(plan).filter(([, f]) => f === "day"), [["r1", "day", "2026-10-08"], ["r0", "day", "2026-10-06"]]);
  const down = fillDownTarget({ anchor: { row: 3, col: col("n") }, focus: { row: 0, col: col("n") } })!;
  assert.deepEqual(down.source, { anchor: { row: 0, col: col("n") }, focus: { row: 0, col: col("n") } });
  assert.deepEqual(planFill(down.source, down.target, make([row(0, { n: 7 }), row(1), row(2)])).changes.map((c) => c.value), [7, 7]);
  assert.equal(fillDownTarget({ anchor: { row: 2, col: 1 }, focus: { row: 2, col: 3 } }), null, "只有一行不填");
});

test("planFill right / left goes through the target field's parser", () => {
  const data = [row(0, { n: 5, name: "甲" })];
  const right = planFill({ anchor: { row: 0, col: col("n") }, focus: { row: 0, col: col("n") } }, { direction: "right", range: { anchor: { row: 0, col: col("amount") }, focus: { row: 0, col: col("day") } } }, make(data));
  assert.deepEqual(values(right), [["r0", "amount", 500]], "「5」写进金额 = 5 元");
  assert.deepEqual(right.skipped.map((s) => s.reason), ["请输入日期，如 2026-09-30"]);
  const left = planFill({ anchor: { row: 0, col: col("stage") }, focus: { row: 0, col: col("stage") } }, { direction: "left", range: { anchor: { row: 0, col: col("name") }, focus: { row: 0, col: col("at") } } }, make([row(0, { stage: "b" })]));
  assert.deepEqual(values(left).map(([, f, v]) => [f, v]), [["name", "乙"]], "只有文本字段收得下「乙」");
  assert.equal(left.skipped.length, 4);
});
