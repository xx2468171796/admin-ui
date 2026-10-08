import test from "node:test";
import assert from "node:assert/strict";
import { fitRowActions } from "../src/menu-core.ts";

// 按钮宽 60，⋯ 宽 28，间距 4
test("放得下就全部露出，不留 ⋯", () => {
  assert.equal(fitRowActions([60, 60, 60], 28, 188, 0), 3);
});
test("放不下的才进 ⋯：留出 ⋯ 的位置", () => {
  assert.equal(fitRowActions([60, 60, 60], 28, 187, 0), 2);
  assert.equal(fitRowActions([60, 60, 60], 28, 96, 0), 1);
});
test("有只能放菜单的操作（删除）时 ⋯ 一直在，按钮照样塞满", () => {
  assert.equal(fitRowActions([60, 60, 60], 28, 220, 1), 3);
  assert.equal(fitRowActions([60, 60, 60], 28, 219, 1), 2);
});
test("一个都放不下就只剩 ⋯", () => {
  assert.equal(fitRowActions([60], 28, 40, 0), 0);
  assert.equal(fitRowActions([], 28, 40, 1), 0);
});
