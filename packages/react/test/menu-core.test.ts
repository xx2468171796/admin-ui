import test from "node:test";
import assert from "node:assert/strict";
import { menuLabel, menuScrollAction, menuTypeahead, nextMenuIndex, placeLayer, rectsOverlap } from "../src/menu-core.ts";

const VIEW = { width: 1440, height: 900 };
const SIZE = { width: 240, height: 300 };
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });

test("右键菜单：默认在指针右下，靠右 / 靠下放不下就翻到左 / 上", () => {
  assert.deepEqual(placeLayer({ x: 100, y: 100 }, SIZE, VIEW), { left: 100, top: 100, flippedX: false, flippedY: false });
  assert.deepEqual(placeLayer({ x: 1300, y: 800 }, SIZE, VIEW), { left: 1060, top: 500, flippedX: true, flippedY: true });
});
test("右键菜单：两边都放不下时夹在视口里，离边 8px", () => {
  const tall = { width: 240, height: 1000 };
  const p = placeLayer({ x: 100, y: 400 }, tall, VIEW);
  assert.equal(p.top, 8);
  assert.equal(placeLayer({ x: 2, y: 2 }, SIZE, VIEW).left, 8);
});
test("锚点菜单：在按钮下方左对齐或右对齐，下面放不下翻到上面", () => {
  const button = rect(600, 100, 80, 28);
  assert.deepEqual(placeLayer(button, SIZE, VIEW), { left: 600, top: 132, flippedX: false, flippedY: false });
  assert.equal(placeLayer(button, SIZE, VIEW, { align: "end" }).left, 440);
  const low = rect(600, 800, 80, 28);
  const p = placeLayer(low, SIZE, VIEW);
  assert.equal(p.flippedY, true);
  assert.equal(p.top, 496);
});
test("子菜单：在父项右边，右边放不下翻到左边", () => {
  const item = rect(900, 300, 230, 32);
  assert.equal(placeLayer(item, SIZE, VIEW, { side: "right" }).left, 1134);
  const edge = rect(1250, 300, 180, 32);
  const p = placeLayer(edge, SIZE, VIEW, { side: "right" });
  assert.equal(p.flippedX, true);
  assert.equal(p.left, 1250 - 4 - 240);
});
test("键盘：跳过禁用项、循环；全禁用返回 -1", () => {
  assert.equal(nextMenuIndex([false, true, false], 0, 1), 2);
  assert.equal(nextMenuIndex([false, true, false], 2, 1), 0);
  assert.equal(nextMenuIndex([true, true], -1, "first"), -1);
});
test("首字母跳转：从当前项之后找，循环，跳过禁用；同一个字母连按轮流跳", () => {
  const labels = ["复制", "粘贴", "Copy link", "copy id", "删除"];
  const skip = [false, false, false, true, false];
  assert.equal(menuTypeahead(labels, skip, -1, "c"), 2);
  assert.equal(menuTypeahead(labels, skip, 2, "c"), 2, "copy id 被禁用，只剩 Copy link");
  assert.equal(menuTypeahead(labels, skip, 0, "粘"), 1);
  assert.equal(menuTypeahead(labels, skip, 0, "co"), 2);
  assert.equal(menuTypeahead(labels, skip, 0, "x"), -1);
  assert.equal(menuTypeahead(["Alpha", "Apple", "Beta"], [false, false, false], 0, "aa"), 1);
});
test("带数量的菜单项文字", () => {
  assert.equal(menuLabel("删除所选 {count} 条记录", 3), "删除所选 3 条记录");
  assert.equal(menuLabel("删除记录"), "删除记录");
});

// bt/templates
test("滚动：只有菜单所属的元素被滚动时才处理；指针处的菜单关闭，锚点菜单跟着锚点、滚出可见区才关", () => {
  assert.equal(menuScrollAction({ movesOrigin: false, atPointer: true, originVisible: true }), "ignore");
  assert.equal(menuScrollAction({ movesOrigin: false, atPointer: false, originVisible: false }), "ignore");
  assert.equal(menuScrollAction({ movesOrigin: true, atPointer: true, originVisible: true }), "close");
  assert.equal(menuScrollAction({ movesOrigin: true, atPointer: false, originVisible: true }), "follow");
  assert.equal(menuScrollAction({ movesOrigin: true, atPointer: false, originVisible: false }), "close");
});
test("两个框是否相交（贴边不算）", () => {
  const box = { top: 100, left: 100, right: 300, bottom: 400, width: 200, height: 300 };
  assert.equal(rectsOverlap({ top: 380, left: 120, right: 200, bottom: 420, width: 80, height: 40 }, box), true);
  assert.equal(rectsOverlap({ top: 400, left: 120, right: 200, bottom: 440, width: 80, height: 40 }, box), false);
  assert.equal(rectsOverlap({ top: 150, left: 300, right: 360, bottom: 190, width: 60, height: 40 }, box), false);
});

test("side top（评论框 @ 弹层）：默认开在锚点上方，上面放不下才翻到下面", () => {
  const composer = { top: 600, left: 100, right: 500, bottom: 680, width: 400, height: 80 };
  assert.deepEqual(placeLayer(composer, SIZE, VIEW, { side: "top" }), { left: 100, top: 600 - 4 - SIZE.height, flippedX: false, flippedY: false });
  const nearTop = { top: 40, left: 100, right: 500, bottom: 120, width: 400, height: 80 };
  const p = placeLayer(nearTop, SIZE, VIEW, { side: "top" });
  assert.equal(p.flippedY, true);
  assert.equal(p.top, 124);
  // 上下都放不下：留在上方、夹进视口
  const tall = { width: 200, height: VIEW.height - 40 };
  assert.equal(placeLayer({ top: 300, left: 100, right: 500, bottom: 380, width: 400, height: 80 }, tall, VIEW, { side: "top" }).top, 8);
});
