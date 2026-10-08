// bt/grid-b G7–G11：冻结线落点、菜单作用的记录、排序方向提示、行拖动落点。
import test from "node:test";
import assert from "node:assert/strict";
import { frozenCountAt, menuRowIds, rowMoveOf, sortHints } from "../src/grid-interact-core.ts";

test("frozenCountAt snaps to the nearest column boundary and clamps", () => {
  const edges = [76, 276, 380, 484]; // row column, 客户名称, 阶段, 负责人
  assert.equal(frozenCountAt(0, edges, 3), 0, "拖到最左 = 只冻结行号列");
  assert.equal(frozenCountAt(260, edges, 3), 1);
  assert.equal(frozenCountAt(340, edges, 3), 2);
  assert.equal(frozenCountAt(999, edges, 3), 3);
  assert.equal(frozenCountAt(999, edges, 2), 2, "最多冻结 max 列");
});

test("menuRowIds: checked rows win when clicked inside them, then the range, then the row", () => {
  assert.deepEqual(menuRowIds("b", ["a", "b", "c"], ["b"]), ["a", "b", "c"]);
  assert.deepEqual(menuRowIds("x", ["a", "b"], ["x", "y", "y"]), ["x", "y"], "选区里的行（去重）");
  assert.deepEqual(menuRowIds("z", ["a", "b"], ["x", "y"]), ["z"]);
  assert.deepEqual(menuRowIds("a", ["a"], []), ["a"], "只勾了自己一行 = 这一行");
});

test("sortHints follow the base type", () => {
  assert.deepEqual(sortHints("money"), { asc: "0 → 9", desc: "9 → 0" });
  assert.deepEqual(sortHints("rating"), { asc: "0 → 9", desc: "9 → 0" });
  assert.deepEqual(sortHints("createdAt"), { asc: "早 → 晚", desc: "晚 → 早" });
  assert.deepEqual(sortHints({ type: "formula", resultType: "date" }), { asc: "早 → 晚", desc: "晚 → 早" });
  assert.equal(sortHints("text").asc, "A → Z");
  assert.equal(sortHints("singleSelect").asc, "按选项顺序");
});

test("rowMoveOf gives the neighbours of the new place; no-op moves are null", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(rowMoveOf(ids, "d", "a", "before"), { rowId: "d", afterId: null, beforeId: "a" });
  assert.deepEqual(rowMoveOf(ids, "a", "c", "after"), { rowId: "a", afterId: "c", beforeId: "d" });
  assert.deepEqual(rowMoveOf(ids, "b", "d", "after"), { rowId: "b", afterId: "d", beforeId: null });
  assert.equal(rowMoveOf(ids, "b", "c", "before"), null, "放回原处");
  assert.equal(rowMoveOf(ids, "b", "a", "after"), null);
  assert.equal(rowMoveOf(ids, "b", "b", "after"), null);
  assert.deepEqual(rowMoveOf(["x", "y"], "q", "x", "after"), { rowId: "q", afterId: "x", beforeId: "y" }, "从别的组拖进来");
});

test("scrollTailPad: scrolled all the way right, the first scrolled column starts at the freeze line (审阅 05 白缝)", async () => {
  const { scrollTailPad } = await import("../src/grid-interact-core.ts");
  // frozen 276 (row number 76 + 客户名称 200), box 971 → 695 px for the scrolled columns
  const widths = [150, 140, 160, 160, 130, 240, 180, 160, 160, 120, 44];
  const pad = scrollTailPad(widths, 276, 971);
  const total = widths.reduce((a, b) => a + b, 0);
  const maxScroll = total + pad - 695;
  const prefix = widths.reduce<number[]>((list, w) => [...list, (list.at(-1) ?? 0) + w], [0]);
  assert.ok(prefix.includes(maxScroll), `最右时停在列边界上：maxScroll ${maxScroll}，pad ${pad}`);
  assert.ok(pad < 240, "空白不超过一列");
  assert.equal(scrollTailPad([100, 100], 276, 971), 0, "不用滚就不加");
  assert.equal(scrollTailPad([400, 295], 276, 971), 0, "刚好放下");
  assert.equal(scrollTailPad(widths, 276, 0), 0, "还没量到宽度");
});
