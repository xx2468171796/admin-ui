import test from "node:test";
import assert from "node:assert/strict";
import { cellPadding, fitChips, isTableRowHeight, resolveRowLayout, rowLineBudget, ROW_HEIGHT_PRESETS, TABLE_ROW_HEIGHTS } from "../src/table-rows.ts";
import { normalizePreferences } from "../src/workflow-core.ts";


test("行数预算：floor((行高 − 上下留白) / 20)，至少 1 行", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ROW_HEIGHT_PRESETS).map(([k, h]) => [k, rowLineBudget(h)])), { short: 1, medium: 2, tall: 3, extraTall: 5 });
  assert.equal(TABLE_ROW_HEIGHTS.short, 40, "DataTable 紧凑 40");
  assert.equal(TABLE_ROW_HEIGHTS.medium, 56, "两行 56");
  assert.equal(ROW_HEIGHT_PRESETS.short, 32, "多维表格矮行仍是 32");
  assert.equal(resolveRowLayout({ rowHeight: "short" }).height, 40, "DataTable 的 short = 40");
  assert.equal(rowLineBudget(64), 2);
  assert.equal(cellPadding(24), 0);
  assert.equal(cellPadding(40), 4);
  assert.equal(cellPadding(120), 8);
  assert.equal(rowLineBudget(10), 1, "再矮也有 1 行");
  assert.equal(rowLineBudget(120, 22), 4, "行距变大时行数变少");
  assert.equal(rowLineBudget(Number.NaN), 1);
});

test("行高优先级：用户保存的偏好 > rowHeight > 表格密度 > Provider 密度", () => {
  assert.deepEqual(resolveRowLayout({}), { source: "density", height: 40, lines: 1, clamped: true });
  assert.equal(resolveRowLayout({ providerDensity: "comfortable" }).height, 48);
  assert.equal(resolveRowLayout({ providerDensity: "comfortable", tableDensity: "compact" }).height, 40, "紧凑 40");
  assert.deepEqual(resolveRowLayout({ rowHeight: "tall", tableDensity: "compact" }), { source: "rowHeight", preset: "tall", height: 88, lines: 3, clamped: true });
  assert.deepEqual(resolveRowLayout({ preference: "medium", rowHeight: "tall" }), { source: "preference", preset: "medium", height: 56, lines: 2, clamped: true });
  const auto = resolveRowLayout({ rowHeight: "auto", tableDensity: "compact" });
  assert.equal(auto.clamped, false);
  assert.equal(auto.lines, Number.POSITIVE_INFINITY);
  assert.equal(auto.height, undefined);
  // 无效的保存值（旧版本 / 手改 localStorage）不生效
  assert.equal(resolveRowLayout({ preference: "huge" as never, rowHeight: "short" }).preset, "short");
  assert.equal(isTableRowHeight("extraTall"), true);
  assert.equal(isTableRowHeight("toString"), false);
});

test("偏好里的行高：有效值保留，无效值丢掉，不多出 undefined 键", () => {
  const base = { density: "compact" as const, columns: ["a"], hidden: [], pageSize: 20 };
  assert.equal(normalizePreferences({ ...base, rowHeight: "tall" }, ["a"]).rowHeight, "tall");
  const dropped = normalizePreferences({ ...base, rowHeight: "giant" as never }, ["a"]);
  assert.equal("rowHeight" in dropped, false);
  assert.deepEqual(normalizePreferences(base, ["a"]), { density: "compact", columns: ["a"], hidden: [], pinned: undefined, pageSize: 20 });
});

test("标签排布：一行放不下就收进 +N，+N 和最后一个标签在同一行", () => {
  const plus = () => 30;
  // 全部放得下
  assert.deepEqual(fitChips([40, 40, 40], 200, 1, { gap: 4, plusWidth: plus }), { visible: 3, squeezeLast: false });
  // 40+4+40+4+40 = 128；再加 +N 需要 162 ≤ 170 → 3 个 + "+2"
  assert.deepEqual(fitChips([40, 40, 40, 40, 40], 170, 1, { gap: 4, plusWidth: plus }), { visible: 3, squeezeLast: false });
  // 两行：每行 3 个，第二行最后要给 +N 留位置
  assert.deepEqual(fitChips(Array(10).fill(40), 140, 2, { gap: 4, plusWidth: plus }), { visible: 5, squeezeLast: false });
  // 第一个标签就占满一行：压缩它给 +N 让位，至少还显示一个
  assert.deepEqual(fitChips([300, 40], 150, 1, { gap: 4, plusWidth: plus, minChip: 40 }), { visible: 1, squeezeLast: true, lastWidth: 116 });
  // 连压缩都放不下：只显示 +N
  assert.deepEqual(fitChips([300, 40], 60, 1, { gap: 4, plusWidth: plus, minChip: 40 }), { visible: 0, squeezeLast: false });
  // 不截断（rowHeight="auto" / 展开记录）：全部显示
  assert.deepEqual(fitChips([400, 400], 100, Number.POSITIVE_INFINITY), { visible: 2, squeezeLast: false });
  assert.deepEqual(fitChips([], 100, 1), { visible: 0, squeezeLast: false });
  // +N 的宽度随位数变化
  const wide = fitChips(Array(120).fill(20), 100, 1, { gap: 4, plusWidth: hidden => (String(hidden).length + 1) * 9 });
  assert.ok(wide.visible >= 1 && wide.visible * 24 - 4 + 4 + (String(120 - wide.visible).length + 1) * 9 <= 100, JSON.stringify(wide));
});

