import test from "node:test";
import assert from "node:assert/strict";
import { canPickUp, dropTarget, flattenIds, moveNode, positionText, reorder, stepTarget, visibleRows } from "../src/sortable-core.ts";

type N = { id: string; locked?: boolean; children?: readonly N[]; label?: string };
// D05 字段面板：客户名称锁在最前；「联系方式」「金额」两个字段编组。
const TREE: N[] = [
  { id: "name", locked: true },
  { id: "stage" },
  { id: "owner" },
  { id: "contact", children: [{ id: "phone" }, { id: "region" }, { id: "source" }] },
  { id: "money", children: [{ id: "expected" }, { id: "deal" }] },
  { id: "last" },
];
const ids = (tree: readonly N[] | null) => (tree ? flattenIds(tree).join(" ") : null);

test("reorder 是纯函数：拷贝后挪一个元素，越界夹住", () => {
  const list = ["a", "b", "c"];
  assert.deepEqual(reorder(list, 0, 2), ["b", "c", "a"]);
  assert.deepEqual(reorder(list, 2, 0), ["c", "a", "b"]);
  assert.deepEqual(reorder(list, 1, 9), ["a", "c", "b"]);
  assert.deepEqual(list, ["a", "b", "c"]);
});

test("锁定项不能拿起，也不能被越过；含锁定项的编组也不能拿起", () => {
  assert.equal(canPickUp(TREE, "name"), false);
  assert.equal(moveNode(TREE, "name", { parent: null, index: 2 }), null);
  assert.equal(moveNode(TREE, "stage", { parent: null, index: 0 }), null, "不能越过最前面锁定的客户名称");
  assert.equal(ids(moveNode(TREE, "stage", { parent: null, index: 2 })), "name owner stage contact phone region source money expected deal last");
  const lockedChild: N[] = [{ id: "g", children: [{ id: "x", locked: true }] }, { id: "y" }];
  assert.equal(canPickUp(lockedChild, "g"), false);
});

test("在编组之间移动；编组不能放进编组；放回原处结果不变", () => {
  assert.equal(ids(moveNode(TREE, "stage", { parent: "contact", index: 1 })), "name owner contact phone stage region source money expected deal last");
  assert.equal(ids(moveNode(TREE, "phone", { parent: "money", index: 2 })), "name stage owner contact region source money expected deal phone last");
  assert.equal(moveNode(TREE, "contact", { parent: "money", index: 0 }), null);
  assert.equal(ids(moveNode(TREE, "owner", { parent: null, index: 2 })), ids(TREE));
});

test("键盘一步：同组内交换、到组边缘就出组、碰到展开的组进组、折叠的组整个跨过", () => {
  assert.deepEqual(stepTarget(TREE, "phone", 1), { parent: "contact", index: 1 });
  assert.deepEqual(stepTarget(TREE, "phone", -1), { parent: null, index: 3 }, "第一个往上 = 出组到组前");
  assert.deepEqual(stepTarget(TREE, "source", 1), { parent: null, index: 4 }, "最后一个往下 = 出组到组后");
  assert.deepEqual(stepTarget(TREE, "owner", 1), { parent: "contact", index: 0 }, "往下碰到展开的组，进组第一个");
  assert.deepEqual(stepTarget(TREE, "owner", 1, new Set(["contact"])), { parent: null, index: 3 }, "折叠的组整个跨过");
  assert.deepEqual(stepTarget(TREE, "last", -1), { parent: "money", index: 2 }, "往上碰到展开的组，进组最后一个");
  assert.equal(stepTarget(TREE, "stage", -1), null, "上面是锁定的客户名称，不能再往上");
  assert.deepEqual(stepTarget(TREE, "contact", 1), { parent: null, index: 4 }, "编组只和顶层邻居换位");
  assert.equal(stepTarget(TREE, "last", 1), null, "到底了");
});

test("拖放落点：行的上半 / 下半、组头下半进组、拖编组只落在顶层", () => {
  const rows = visibleRows(TREE);
  const at = (id: string) => rows.findIndex((row) => row.node.id === id);
  assert.deepEqual(dropTarget(TREE, rows, "last", at("owner"), "after"), { parent: null, index: 3 });
  assert.deepEqual(dropTarget(TREE, rows, "stage", at("contact"), "after"), { parent: "contact", index: 0 });
  assert.deepEqual(dropTarget(TREE, rows, "stage", at("region"), "before"), { parent: "contact", index: 1 });
  assert.deepEqual(dropTarget(TREE, rows, "stage", at("owner"), "after"), { parent: null, index: 2 }, "从前面往后拖，下标扣掉自己");
  assert.equal(dropTarget(TREE, rows, "stage", at("name"), "before"), null, "落在锁定项前面不行");
  assert.deepEqual(dropTarget(TREE, rows, "money", at("phone"), "before"), { parent: null, index: 3 }, "拖编组到别的组里 = 落在那个组前后");
  const folded = new Set(["money"]);
  const rows2 = visibleRows(TREE, folded);
  assert.deepEqual(dropTarget(TREE, rows2, "stage", rows2.findIndex((r) => r.node.id === "money"), "after", folded), { parent: "money", index: 2 }, "折叠的组头下半 = 放到组里最后");
});

test("可见行：折叠的组不出子项；读屏位置文字", () => {
  assert.equal(visibleRows(TREE, new Set(["contact", "money"])).length, 6);
  assert.equal(visibleRows(TREE).length, 11);
  assert.equal(positionText(TREE, "stage", () => ""), "第 2 项，共 6 项");
  assert.equal(positionText(TREE, "region", (g) => (g.id === "contact" ? "联系方式" : "")), "「联系方式」里第 2 项，共 3 项");
});

test("宿主规则 canDrop：字段只能在分组里——出组时直接进相邻分组，拖到两组之间落到上面那组末尾", () => {
  const tree: N[] = [
    { id: "contact", children: [{ id: "phone" }, { id: "line" }] },
    { id: "need", children: [{ id: "budget" }] },
    { id: "empty", children: [] },
  ];
  const inGroups = (node: N, target: { parent: string | null }) => node.children !== undefined || target.parent !== null;
  assert.equal(moveNode(tree, "phone", { parent: null, index: 0 }, inGroups), null, "不能放到顶层");
  assert.equal(ids(moveNode(tree, "phone", { parent: "need", index: 1 }, inGroups)), "contact line need budget phone empty");
  assert.deepEqual(stepTarget(tree, "line", 1, new Set(), inGroups), { parent: "need", index: 0 }, "最后一个往下 = 进下一组第一个");
  assert.deepEqual(stepTarget(tree, "budget", -1, new Set(), inGroups), { parent: "contact", index: 2 }, "第一个往上 = 进上一组最后");
  assert.deepEqual(stepTarget(tree, "budget", 1, new Set(), inGroups), { parent: "empty", index: 0 }, "空的组也能进");
  assert.equal(stepTarget(tree, "phone", -1, new Set(), inGroups), null, "最上面的组的第一个不能再往上");
  const rows = visibleRows(tree);
  const at = (id: string) => rows.findIndex((row) => row.node.id === id);
  assert.deepEqual(dropTarget(tree, rows, "phone", at("need"), "before", new Set(), inGroups), { parent: "contact", index: 1 }, "放在「需求」组头上半 = 「联系方式」末尾");
  assert.deepEqual(dropTarget(tree, rows, "phone", at("empty"), "after", new Set(), inGroups), { parent: "empty", index: 0 });
  assert.deepEqual(moveNode(tree, "need", { parent: null, index: 0 }, inGroups)?.map((n) => n.id), ["need", "contact", "empty"], "分组照常在顶层换序");
});
