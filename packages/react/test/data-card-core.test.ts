import test from "node:test";
import assert from "node:assert/strict";
import { cardLayout, cursorRange, footerCountText, splitBulkActions } from "../src/data-card-core.ts";

test("手机卡片：标题 = 第一列，状态 = status / stage 列，灰字行取后面 3 列，操作列进 ⋯", () => {
  const columns = [
    { key: "name" }, { key: "stage" }, { key: "products" }, { key: "owner" }, { key: "amount" }, { key: "next" },
    { key: "actions", kind: "actions" as const },
  ];
  assert.deepEqual(cardLayout(columns), { primary: "name", status: ["stage"], meta: ["products", "owner", "amount"], actions: "actions" });
});

test("手机卡片：列上的 mobile 提示优先，hidden 不上卡片，meta 保持表格列序", () => {
  const columns = [
    { key: "id", mobile: "hidden" as const }, { key: "name", mobile: "primary" as const }, { key: "products", mobile: "hidden" as const },
    { key: "owner" }, { key: "amount", mobile: "meta" as const }, { key: "level", mobile: "status" as const }, { key: "status" },
    { key: "next", mobile: "meta" as const }, { key: "region" }, { key: "ops", kind: "actions" as const },
  ];
  // 显式 status 时不再自动拿 status 列；meta：显式 2 个 + 自动补 1 个（owner），按列序
  assert.deepEqual(cardLayout(columns), { primary: "name", status: ["level"], meta: ["owner", "amount", "next"], actions: "ops" });
  assert.deepEqual(cardLayout(columns, 0).meta, ["amount", "next"], "显式 meta 总是显示");
  assert.deepEqual(cardLayout([]), { primary: undefined, status: [], meta: [], actions: undefined });
  assert.deepEqual(cardLayout([{ key: "status" }]), { primary: "status", status: [], meta: [], actions: undefined }, "唯一一列当标题");
});

test("游标列表：已显示 21–40 条；空页没有范围", () => {
  assert.deepEqual(cursorRange(1, 20, 20), { from: 1, to: 20 });
  assert.deepEqual(cursorRange(2, 20, 20), { from: 21, to: 40 });
  assert.deepEqual(cursorRange(3, 20, 7), { from: 41, to: 47 });
  assert.equal(cursorRange(1, 20, 0), null);
  assert.equal(cursorRange(1, 0, 5), null);
});

test("分页脚左边：共 N 条 / 已选 2 / 共 N 条 / 加载中 —", () => {
  assert.equal(footerCountText(168), "共 168 条");
  assert.equal(footerCountText(168, 2), "已选 2 / 共 168 条");
  assert.equal(footerCountText(12345), "共 12,345 条");
  assert.equal(footerCountText(null), "共 — 条");
});

test("批量浮条：前 maxVisible 个是按钮，其余进 ⋯", () => {
  assert.deepEqual(splitBulkActions(["a", "b", "c"], 4), { visible: ["a", "b", "c"], overflow: [] });
  assert.deepEqual(splitBulkActions(["a", "b", "c"], 2), { visible: ["a", "b"], overflow: ["c"] });
  assert.deepEqual(splitBulkActions(["a", "b"], 0), { visible: [], overflow: ["a", "b"] });
  assert.deepEqual(splitBulkActions(["a"], Number.NaN), { visible: ["a"], overflow: [] });
});
