import test from "node:test";
import assert from "node:assert/strict";
import { overflowGroups, searchViews, VIEW_KIND_HINTS, VIEW_KINDS, type ViewSummary } from "../src/views/view-core.ts";
import { countSettingChanges } from "../src/views/view-settings-core.ts";
import { recordFrameNavText, RECORD_FRAMES } from "../src/record-frame-core.ts";
import { VIEW_PANEL_WIDTHS } from "../src/grid-view-v2.ts";

// admin-ui 7.17：视图标签「更多」按档分组、视图管理搜索、设置面板「已改 N 处」、记录展开框翻页文字、视图面板三档宽度。
const VIEWS: ViewSummary[] = [
  { id: "a", name: "我的客户", kind: "grid", tier: "mine" },
  { id: "b", name: "本周待跟进", kind: "grid", tier: "standard" },
  { id: "c", name: "客户相册", kind: "gallery", tier: "shared" },
  { id: "d", name: "按阶段", kind: "kanban", tier: "standard", modified: true },
];

test("「更多」按 标准 → 共享 → 我的 分组，空档不出", () => {
  const groups = overflowGroups(VIEWS);
  assert.deepEqual(groups.map((g) => g.tier), ["standard", "shared", "mine"]);
  assert.deepEqual(groups[0]?.views.map((v) => v.id), ["b", "d"]);
  assert.deepEqual(overflowGroups(VIEWS.filter((v) => v.tier === "mine")).map((g) => g.tier), ["mine"]);
  assert.deepEqual(overflowGroups([]), []);
});

test("视图管理搜索：去空格、不分大小写，空查询全部", () => {
  assert.equal(searchViews(VIEWS, "").length, 4);
  assert.deepEqual(searchViews(VIEWS, " 客户 ").map((v) => v.id), ["a", "c"]);
  assert.deepEqual(searchViews([{ id: "x", name: "Gantt 排期", kind: "gantt", tier: "mine" }], "gantt").map((v) => v.id), ["x"]);
});

test("新建视图的 6 张类型卡都有一句用途", () => {
  for (const kind of VIEW_KINDS) assert.ok(VIEW_KIND_HINTS[kind].length > 0, kind);
});

test("设置改了几处：按顶层键数，数组 / 对象按内容比，空值和 undefined 一样", () => {
  const base = { coverField: null, fields: ["owner", "amount"], density: "normal", showLabels: false };
  assert.equal(countSettingChanges(base, { ...base }), 0);
  assert.equal(countSettingChanges(base, { ...base, fields: ["owner", "amount"] }), 0, "同内容的新数组不算改");
  assert.equal(countSettingChanges(base, { ...base, fields: ["amount", "owner"] }), 1, "换顺序算一处");
  assert.equal(countSettingChanges(base, { ...base, density: "compact", showLabels: true }), 2);
  assert.equal(countSettingChanges({ a: null }, { a: undefined }), 0);
  assert.equal(countSettingChanges({ g: { field: "x" } }, { g: { field: "y" } }), 1);
});

test("记录展开框：「8 / 13 · 按阶段」，三档 抽屉 / 弹框 / 整页", () => {
  assert.equal(recordFrameNavText({ index: 7, total: 13, label: "按阶段" }), "8 / 13 · 按阶段");
  assert.equal(recordFrameNavText({ index: 0, total: 1 }), "1 / 1");
  assert.deepEqual(RECORD_FRAMES, ["drawer", "dialog", "page"]);
});

test("五个视图面板三档宽度：条件 580 · 列表 420 · 字段 320", () => {
  assert.deepEqual(VIEW_PANEL_WIDTHS, { condition: 580, list: 420, field: 320 });
});
