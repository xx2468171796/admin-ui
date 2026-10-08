import test from "node:test";
import assert from "node:assert/strict";
import { applyPendingMoves, columnKeyOf, columnValue, dropIndex, kanbanColumns, keyboardMove, KANBAN_UNSET, moveLabel, pageTo, placeCards, planMove } from "../src/views/kanban-core.ts";
import type { GridSelectOption } from "../src/grid-core.ts";

const STAGES: GridSelectOption[] = [
  { value: "first", label: "首通", tone: "green" },
  { value: "second", label: "二通", color: "teal" },
  { value: "quote", label: "报价", tone: "yellow" },
  { value: "won", label: "成交", tone: "greenSolid" },
  { value: "install", label: "安装", color: "#ff00aa" },
];

test("列来自单选字段的选项：顺序、10 色、任意颜色变灰、未设置列", () => {
  const cols = kanbanColumns(STAGES);
  assert.deepEqual(cols.map((c) => c.key), [KANBAN_UNSET, "first", "second", "quote", "won", "install"]);
  assert.deepEqual(cols.map((c) => c.tone), ["gray", "green", "teal", "yellow", "greenSolid", "gray"]);
  const custom = kanbanColumns(STAGES, { hidden: ["install"], tones: { quote: "red" } }, "未分组", false);
  assert.deepEqual(custom.map((c) => `${c.key}:${c.tone}`), ["first:green", "second:teal", "quote:red", "won:greenSolid"]);
});

test("卡片按值落列，空值和不认识的值进未设置；写回时未设置是 null", () => {
  type R = { id: string; stage: unknown };
  const rows: R[] = [{ id: "a", stage: "quote" }, { id: "b", stage: null }, { id: "c", stage: "gone" }, { id: "d", stage: ["won"] }, { id: "e", stage: "quote" }];
  const placed = placeCards(rows, (r) => r.id, (r) => r.stage, STAGES);
  assert.deepEqual(placed.quote, ["a", "e"]);
  assert.deepEqual(placed[KANBAN_UNSET], ["b", "c"]);
  assert.deepEqual(placed.won, ["d"]);
  assert.equal(columnKeyOf("", STAGES), KANBAN_UNSET);
  assert.equal(columnValue(KANBAN_UNSET), null);
  assert.equal(columnValue("won"), "won");
});

test("移动：跨列给出落点前一张卡，同列原地不算移动", () => {
  const placement = { quote: ["a", "e", "f"], won: ["g", "h"] };
  const r = planMove(placement, "e", "won", 1);
  assert.ok(r);
  assert.deepEqual(r.next, { quote: ["a", "f"], won: ["g", "e", "h"] });
  assert.deepEqual(r.move, { id: "e", from: "quote", to: "won", beforeId: "h", index: 1 });
  assert.equal(planMove(placement, "e", "quote", 1), null, "原地");
  assert.deepEqual(planMove(placement, "a", "quote", 9)?.next.quote, ["e", "f", "a"]);
  assert.equal(planMove(placement, "a", "won", 9)?.move.beforeId, null, "放在列尾");
  assert.equal(planMove(placement, "zz", "won", 0), null);
});

test("指针落点：卡片中线以上落在它前面", () => {
  const cards = [{ top: 0, height: 100 }, { top: 110, height: 100 }];
  assert.equal(dropIndex(cards, 30), 0);
  assert.equal(dropIndex(cards, 70), 1);
  assert.equal(dropIndex(cards, 300), 2);
  assert.equal(dropIndex([], 10), 0);
});

test("键盘移动：Alt+↑↓ 列内一格，Alt+←→ 到相邻列尾，边上不动", () => {
  const placement = { first: ["a", "b"], quote: ["c"], won: [] };
  const cols = ["first", "quote", "won"];
  assert.deepEqual(keyboardMove(placement, cols, "b", "up"), { to: "first", index: 0 });
  assert.equal(keyboardMove(placement, cols, "a", "up"), null);
  assert.deepEqual(keyboardMove(placement, cols, "a", "right"), { to: "quote", index: 1 });
  assert.deepEqual(keyboardMove(placement, cols, "c", "right"), { to: "won", index: 0 });
  assert.equal(keyboardMove(placement, cols, "a", "left"), null);
  assert.equal(moveLabel("阶段", "报价", "成交"), "阶段：报价 → 成交");
});

test("‹ › 翻页：下一列被截断的列顶到左边，回翻对齐", () => {
  const lefts = [0, 260, 520, 780, 1040, 1300];
  assert.equal(pageTo(lefts, 0, 900, 2000, 1), 780);
  assert.equal(pageTo(lefts, 0, 900, 1560, 1), 660, "夹在滚动范围里");
  assert.equal(pageTo(lefts, 660, 900, 1560, 1), 660, "已到最右");
  assert.equal(pageTo(lefts, 660, 900, 1560, -1), 0);
  assert.equal(pageTo(lefts, 1040, 900, 2000, -1), 260);
});

test("乐观移动叠在宿主数据上：另一张卡的确认不会把还在路上的移动冲掉", () => {
  const base = { first: ["a", "b"], quote: ["c", "d"], won: ["e"] };
  const moves = [{ id: "e", to: "quote", beforeId: "d" }, { id: "a", to: "won", beforeId: null }];
  assert.deepEqual(applyPendingMoves(base, moves), { first: ["b"], quote: ["c", "e", "d"], won: ["a"] });
  // 宿主确认了 a（数据里 a 已在 won），e 还在路上：e 仍在报价列 d 前面
  const confirmedA = { first: ["b"], quote: ["c", "d"], won: ["e", "a"] };
  assert.deepEqual(applyPendingMoves(confirmedA, moves.slice(0, 1)), { first: ["b"], quote: ["c", "e", "d"], won: ["a"] });
  assert.equal(applyPendingMoves(base, []), base, "没有移动时原样返回");
  assert.deepEqual(applyPendingMoves(base, [{ id: "zz", to: "won", beforeId: null }]), base, "卡片不在了就忽略");
});
