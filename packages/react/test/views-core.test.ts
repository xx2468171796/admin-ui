import test from "node:test";
import assert from "node:assert/strict";
import { can, copyName, fitTabs, managerCountText, newViewName, tabViews, tierViews, viewActions, type ViewSummary } from "../src/views/view-core.ts";

// D16：业务线标准 5（2 个必看、1 个隐藏）、共享 2、我的 3。
const VIEWS: ViewSummary[] = [
  { id: "all", name: "智能家居 · 全部客户", kind: "grid", tier: "standard", mustSee: true },
  { id: "week", name: "本周待跟进", kind: "grid", tier: "standard", mustSee: true },
  { id: "board", name: "阶段看板", kind: "kanban", tier: "standard" },
  { id: "plan", name: "安装排期", kind: "gantt", tier: "standard" },
  { id: "photo", name: "现场照片", kind: "gallery", tier: "standard", hidden: true },
  { id: "g1", name: "一组客户", kind: "grid", tier: "shared" },
  { id: "deal", name: "本月成交", kind: "kanban", tier: "shared" },
  { id: "mine", name: "我的客户", kind: "grid", tier: "mine" },
  { id: "late", name: "我的逾期跟进", kind: "calendar", tier: "mine" },
  { id: "tp", name: "上海大户", kind: "grid", tier: "mine" },
];
const byId = (id: string) => VIEWS.find((v) => v.id === id) as ViewSummary;

test("标准视图：普通人只能打开、复制、隐藏（必看的不能隐藏），不能改名删除改条件", () => {
  const all = viewActions(byId("all"));
  assert.deepEqual(all.allowed, ["open", "duplicate"]);
  assert.equal(all.reasons.hide, "必看视图不能隐藏");
  assert.equal(all.reasons.editConditions, "标准视图不能改：复制为我的视图");
  assert.ok(can(viewActions(byId("board")), "hide"));
  assert.ok(can(viewActions(byId("photo")), "show"), "隐藏的可以再显示");
  const manager = viewActions(byId("board"), { canManageStandard: true });
  assert.ok(can(manager, "rename") && can(manager, "delete") && can(manager, "editConditions"));
});

test("共享视图看是否管理共享；我的视图什么都能做", () => {
  assert.ok(!can(viewActions(byId("g1")), "delete"));
  assert.equal(viewActions(byId("g1")).reasons.editConditions, "共享视图不能改：复制为我的视图");
  assert.ok(can(viewActions(byId("g1"), { canManageShared: true }), "delete"));
  assert.deepEqual(viewActions(byId("tp")).allowed, ["open", "duplicate", "rename", "editConditions", "delete", "hide"]);
});

test("标签栏：按 标准 → 共享 → 我的，隐藏的不出现（必看的总在）", () => {
  assert.deepEqual(tabViews(VIEWS).map((v) => v.id), ["all", "week", "board", "plan", "g1", "deal", "mine", "late", "tp"]);
  assert.deepEqual(tabViews([{ ...byId("all"), hidden: true }]).map((v) => v.id), ["all"]);
  assert.equal(tierViews(VIEWS, "mine").length, 3);
  assert.equal(managerCountText(VIEWS), "10 个 · 隐藏 1");
});

test("新视图和副本的默认名不重名", () => {
  assert.equal(newViewName("kanban", ["看板"]), "看板 2");
  assert.equal(newViewName("gantt", []), "甘特");
  assert.equal(copyName("全部客户", ["全部客户 副本"]), "全部客户 副本 2");
});

test("标签放不下：「更多」占一格，当前视图总在栏里", () => {
  const widths = [120, 100, 100, 100, 100];
  assert.deepEqual(fitTabs(widths, 600, 60), { shown: [0, 1, 2, 3, 4], overflow: [] });
  assert.deepEqual(fitTabs(widths, 400, 60), { shown: [0, 1, 2], overflow: [3, 4] });
  assert.deepEqual(fitTabs(widths, 400, 60, 4), { shown: [0, 1, 4], overflow: [2, 3] });
  assert.deepEqual(fitTabs(widths, 100, 60, 0), { shown: [0], overflow: [1, 2, 3, 4] }, "再窄当前视图也露着");
  assert.deepEqual(fitTabs(widths, 530, 60, -1, 4), { shown: [0, 1, 2, 3], overflow: [4] });
});
