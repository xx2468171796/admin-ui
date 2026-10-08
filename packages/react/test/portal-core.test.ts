import assert from "node:assert/strict";
import test from "node:test";
import { quotaPercent, quotaTone } from "../src/portal-core.ts";

test("额度颜色：80% 起黄，用完才红，未知不着色", () => {
  assert.equal(quotaTone(0.5), "normal");
  assert.equal(quotaTone(0.8), "warning");
  assert.equal(quotaTone(0.999), "warning");
  assert.equal(quotaTone(1), "danger");
  assert.equal(quotaTone(1.4), "danger");
  assert.equal(quotaTone(null), "normal");
  assert.equal(quotaTone(Number.NaN), "normal");
  assert.equal(quotaTone(0.6, 0.5), "warning");
});

test("额度百分比：没用完不显示 100，用了一点不显示 0，不限 / 未知为 null", () => {
  assert.equal(quotaPercent(0, 100), 0);
  assert.equal(quotaPercent(0.1, 100), 1);
  assert.equal(quotaPercent(99.8, 100), 99);
  assert.equal(quotaPercent(100, 100), 100);
  assert.equal(quotaPercent(250, 100), 100);
  assert.equal(quotaPercent(62.4, 100), 62);
  assert.equal(quotaPercent(5, 0), null);
  assert.equal(quotaPercent(5, null), null);
  assert.equal(quotaPercent(null, 100), null);
});
