// WorkspaceLayout 的高度规则：宽屏到窗口底（减 bottomGap，至少 420）；窄屏有 Pane fill 时卡片到外壳内容区底（减外面一圈内边距，至少 320，不取整）。
import test from "node:test";
import assert from "node:assert/strict";
import { workspaceHeights } from "../src/workspace-core.ts";

test("宽屏高度 = 窗口底 − 顶 − bottomGap，取整，至少 420", () => {
  assert.equal(workspaceHeights({ viewport: 900, top: 133.4, bottomGap: 0, below: 0 }).height, 766);
  assert.equal(workspaceHeights({ viewport: 900, top: 133, bottomGap: 24, below: 0 }).height, 743);
  assert.equal(workspaceHeights({ viewport: 500, top: 200, bottomGap: 0, below: 0 }).height, 420);
});

test("窄屏撑满高度 = 窗口底 − 顶 − 外面的内边距，不取整（不留 1px 灰条）", () => {
  assert.equal(workspaceHeights({ viewport: 844, top: 197.25, bottomGap: 0, below: 12 }).fill, 634.75);
  assert.equal(workspaceHeights({ viewport: 844, top: 105, bottomGap: 99, below: 12 }).fill, 727, "bottomGap 只管宽屏");
  assert.equal(workspaceHeights({ viewport: 600, top: 400, bottomGap: 0, below: 12 }).fill, 320, "至少 320");
  assert.equal(workspaceHeights({ viewport: 844, top: 100, bottomGap: 0, below: -5 }).fill, 744, "负的 below 当 0");
});
