import assert from "node:assert/strict";
import test from "node:test";
import { revealScrollLeft, scrollEdges, wheelScrollLeft } from "../src/scroll-strip-core.ts";

test("标签条两端：放得下不显示渐隐，滚到中间两边都有，亚像素误差不算溢出", () => {
  assert.deepEqual(scrollEdges(0, 300, 300), { start: false, end: false });
  assert.deepEqual(scrollEdges(0, 300.6, 300), { start: false, end: false });
  assert.deepEqual(scrollEdges(0, 600, 300), { start: false, end: true });
  assert.deepEqual(scrollEdges(150, 600, 300), { start: true, end: true });
  assert.deepEqual(scrollEdges(300, 600, 300), { start: true, end: false });
});

test("选中的标签滚进可视区，离被裁的边留出渐隐宽度；已经看得见就不动", () => {
  // 视口 300，内容 1000，当前在最左
  assert.equal(revealScrollLeft(0, 300, 1000, 100, 80, 40), null);
  assert.equal(revealScrollLeft(0, 300, 1000, 500, 80, 40), 320); // 500+80+40-300
  assert.equal(revealScrollLeft(600, 300, 1000, 400, 80, 40), 360); // 左侧被裁：400-40
  assert.equal(revealScrollLeft(600, 300, 1000, 920, 80, 40), 700); // 最后一个：贴右边不留白，夹到最大值
  assert.equal(revealScrollLeft(300, 300, 1000, 0, 80, 40), 0); // 第一个：贴左边
  assert.equal(revealScrollLeft(0, 300, 1000, 500, 400, 40), 460); // 比视口还宽：对齐开头
});

test("滚轮：竖向滚动在还能横滚时转成横滚，滚到头交还给页面，横向手势不接管", () => {
  assert.equal(wheelScrollLeft(0, 1000, 300, 0, 100), 100);
  assert.equal(wheelScrollLeft(650, 1000, 300, 0, 100), 700);
  assert.equal(wheelScrollLeft(700, 1000, 300, 0, 100), null);
  assert.equal(wheelScrollLeft(0, 1000, 300, 0, -100), null);
  assert.equal(wheelScrollLeft(0, 300, 300, 0, 100), null);
  assert.equal(wheelScrollLeft(0, 1000, 300, 60, 20), null);
});
