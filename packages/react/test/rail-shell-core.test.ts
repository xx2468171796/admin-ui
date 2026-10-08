// bt/templates：T15 表格工作区外壳的纯规则——目录搜索、文件夹开合、键盘顺序、手机底栏。
import test from "node:test";
import assert from "node:assert/strict";
import { filterNavTree, folderCount, folderLabel, folderOf, initialOpenFolders, isNavFolder, nextTreeId, railBottomNav, visibleTreeIds, type NavTreeShape } from "../src/rail-shell-core.ts";

const tree: NavTreeShape[] = [
  { id: "sales", label: "销售", children: [{ id: "customers", label: "客户", count: 1284 }, { id: "follow", label: "跟进记录", count: 9610 }, { id: "deals", label: "商机", keywords: "opportunity" }] },
  { id: "delivery", label: "交付", children: [{ id: "install", label: "安装工单" }, { id: "visit", label: "售后回访" }] },
  { id: "docs", label: "资料", defaultOpen: false, children: [{ id: "manual", label: "安装手册" }, { id: "price", label: "价目表" }, { id: "faq", label: "常见问题" }] },
  { id: "board", label: "销售看板" },
  { id: "auto", label: "自动化", count: "6 条" },
];

test("文件夹：默认打开，defaultOpen=false 的收起；收起时名字带行数", () => {
  assert.deepEqual([...initialOpenFolders(tree)], ["sales", "delivery"]);
  const docs = tree[2];
  assert.ok(docs && isNavFolder(docs));
  if (docs && isNavFolder(docs)) {
    assert.equal(folderLabel(docs, false), "资料（3）");
    assert.equal(folderLabel(docs, true), "资料");
    assert.equal(folderCount(docs), 3, "文件夹右侧的灰色数量（名字里不再带括号）");
  }
  assert.equal(folderOf(tree, "price"), "docs");
  assert.equal(folderOf(tree, "board"), undefined);
});

test("搜索：按名字和关键词找行；文件夹名命中留下整个文件夹；空查询原样返回", () => {
  assert.equal(filterNavTree(tree, "").length, tree.length);
  assert.deepEqual(filterNavTree(tree, "安装").map((n) => (isNavFolder(n) ? `${n.id}:${n.children.map((c) => c.id).join(",")}` : n.id)), ["delivery:install", "docs:manual"]);
  assert.deepEqual(filterNavTree(tree, "OPPORTUNITY").map((n) => (isNavFolder(n) ? n.children.map((c) => c.id).join(",") : n.id)), ["deals"]);
  assert.deepEqual(filterNavTree(tree, "交付").map((n) => (isNavFolder(n) ? n.children.length : 0)), [2]);
  assert.deepEqual(filterNavTree(tree, "看板").map((n) => n.id), ["board"]);
  assert.deepEqual(filterNavTree(tree, "没有这个"), []);
});

test("键盘：只走看得见的行；搜索时文件夹都展开；上下到头停住，Home / End", () => {
  const open = new Set(["sales"]);
  const ids = visibleTreeIds(tree, open);
  assert.deepEqual(ids, ["sales", "customers", "follow", "deals", "delivery", "docs", "board", "auto"]);
  assert.deepEqual(visibleTreeIds(filterNavTree(tree, "安装"), new Set(), true), ["install", "manual"], "搜索时文件夹按钮禁用，键盘只走行");
  const withDisabled: NavTreeShape[] = [
    { id: "a", label: "甲", children: [{ id: "a1", label: "一" }, { id: "a2", label: "二", disabled: true }, { id: "a3", label: "三" }] },
    { id: "b", label: "乙", disabled: true },
    { id: "c", label: "丙" },
  ];
  const walk = visibleTreeIds(withDisabled, new Set(["a"]));
  assert.deepEqual(walk, ["a", "a1", "a3", "c"], "禁用的行不进键盘顺序");
  assert.equal(nextTreeId(walk, "a1", "ArrowDown"), "a3");
  assert.equal(nextTreeId(walk, "a3", "ArrowDown"), "c");
  assert.equal(nextTreeId(ids, "deals", "ArrowDown"), "delivery");
  assert.equal(nextTreeId(ids, "sales", "ArrowUp"), "sales");
  assert.equal(nextTreeId(ids, "auto", "ArrowDown"), "auto");
  assert.equal(nextTreeId(ids, "follow", "Home"), "sales");
  assert.equal(nextTreeId(ids, "follow", "End"), "auto");
  assert.equal(nextTreeId(ids, "gone", "ArrowDown"), "sales");
  assert.equal(nextTreeId([], "x", "ArrowDown"), undefined);
});

test("手机底栏：最多 4 个，其余进「更多」；当前模块不在栏里就顶替最后一格；可指定常用", () => {
  const modules = ["home", "table", "crm", "files", "scripts", "todo", "wiki"].map((id) => ({ id }));
  const a = railBottomNav(modules, "table");
  assert.deepEqual(a.shown.map((m) => m.id), ["home", "table", "crm", "files"]);
  assert.deepEqual(a.more.map((m) => m.id), ["scripts", "todo", "wiki"]);
  const b = railBottomNav(modules, "wiki");
  assert.deepEqual(b.shown.map((m) => m.id), ["home", "table", "crm", "wiki"]);
  assert.deepEqual(b.more.map((m) => m.id), ["files", "scripts", "todo"]);
  const c = railBottomNav(modules, "todo", ["table", "todo", "nope"]);
  assert.deepEqual(c.shown.map((m) => m.id), ["table", "todo"]);
  assert.equal(c.more.length, 5);
  const d = railBottomNav(modules, "home", ["table", "todo"]);
  assert.deepEqual(d.shown.map((m) => m.id), ["table", "home"], "当前模块不在常用里：顶替最后一格");
});
