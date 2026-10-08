import assert from "node:assert/strict";
import test from "node:test";
import { inlineRevealLeft } from "../src/scroll-reveal.ts";

test("横向条里露出一项：只算 scrollLeft，已经看得见就不动（8.0.2，不再用会滚整页的 scrollIntoView）", () => {
  const view = { scrollLeft: 100, width: 300 };
  assert.equal(inlineRevealLeft({ left: 150, right: 250 }, view), null, "已经在可见范围里");
  assert.equal(inlineRevealLeft({ left: 40, right: 120 }, view), 40, "在左边：左边对齐");
  assert.equal(inlineRevealLeft({ left: 380, right: 460 }, view), 160, "在右边：右边对齐");
  assert.equal(inlineRevealLeft({ left: 380, right: 460 }, view, 12), 172, "留边距");
  assert.equal(inlineRevealLeft({ left: 500, right: 900 }, view), 500, "比可见区还宽：左边对齐");
  assert.equal(inlineRevealLeft({ left: 4, right: 60 }, { scrollLeft: 30, width: 300 }, 12), 0, "不小于 0");
});
