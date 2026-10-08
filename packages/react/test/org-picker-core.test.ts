// OrgPicker 纯规则：选中模型（单选 / 多选 / 最多 N 个）、含下级盖住下级和人、半选推导、去重覆盖人数、
// 已离职的留在名单里直到手动去掉、输出形状、键盘走树、虚拟滚动窗口、多语言文案。
import test from "node:test";
import assert from "node:assert/strict";
import {
  chainOf,
  coveredBy,
  diffPicks,
  groupByKind,
  groupHits,
  mergeResolved,
  mixedIds,
  nodeCheckState,
  pathLabels,
  personSubject,
  pickAll,
  pickSubject,
  reachOf,
  setIncludeSub,
  toOutput,
  togglePick,
  unitSubject,
  type OrgUnit,
  type PickedSubject,
} from "../src/org-picker/org-picker-core.ts";
import { listKey, scrollToRow, treeKey, virtualWindow, visibleTreeRows } from "../src/org-picker/org-picker-nav.ts";
import { fillText, orgPickerMessages, selectionSummary, ORG_PICKER_MESSAGES } from "../src/org-picker/org-picker-text.ts";

const units: OrgUnit[] = [
  { id: "g", kind: "group", label: "Acme 集团", parentId: null, memberCount: 532 },
  { id: "hn", kind: "company", label: "华南子公司", parentId: "g", memberCount: 520 },
  { id: "sales", kind: "dept", label: "销售部", parentId: "hn", memberCount: 10, directCount: 1 },
  { id: "g1", kind: "dept", label: "一组", parentId: "sales", memberCount: 5 },
  { id: "g2", kind: "dept", label: "二组", parentId: "sales", memberCount: 4 },
  { id: "sz", kind: "company", label: "深圳子公司", parentId: "g", memberCount: 8 },
];
const index = new Map(units.map((u) => [u.id, u]));
const unit = (id: string) => index.get(id) as OrgUnit;
const li = personSubject({ id: "li", label: "小李", deptIds: ["g1"] }, index);
const chen = personSubject({ id: "chen", label: "陈组长", deptIds: ["g1"] }, index);
const lin = personSubject({ id: "lin", label: "林经理", deptIds: ["sales"] }, index);

test("chains and paths walk up the loaded index; paths drop the group root", () => {
  assert.deepEqual(chainOf(index, "g1"), ["g", "hn", "sales", "g1"]);
  assert.deepEqual(pathLabels(index, chainOf(index, "g1")), ["华南子公司", "销售部", "一组"]);
  assert.deepEqual(li.path, ["华南子公司", "销售部", "一组"]);
  assert.deepEqual(li.ancestors, ["g", "hn", "sales", "g1"]);
  const dept = unitSubject(unit("g2"), index);
  assert.deepEqual(dept, { kind: "dept", id: "g2", label: "二组", path: ["华南子公司", "销售部"], includeSub: true, ancestors: ["g", "hn", "sales"], count: 4 });
  assert.equal(unitSubject(unit("sales"), index, false).count, 1, "不含下级 = 直属人数");
});

test("half-checked: every ancestor of a pick is mixed, the picked node itself is checked", () => {
  const value = [li, unitSubject(unit("g2"), index)];
  const mixed = mixedIds(value, index);
  assert.deepEqual([...mixed].sort(), ["g", "g1", "hn", "sales"]);
  assert.equal(nodeCheckState(unit("sales"), value, index), "mixed");
  assert.equal(nodeCheckState(unit("g2"), value, index), "checked");
  assert.equal(nodeCheckState(unit("sz"), value, index), "unchecked");
});

test("含下级 covers descendants and their people; without it only the direct people", () => {
  const sales = unitSubject(unit("sales"), index);
  assert.equal(coveredBy(li, [sales], index)?.id, "sales");
  assert.equal(nodeCheckState(unit("g1"), [sales], index), "covered");
  const salesDirect = { ...sales, includeSub: false };
  assert.equal(coveredBy(li, [salesDirect], index), null, "一组的人不在「销售部（直属）」里");
  assert.equal(coveredBy({ ...lin, deptIds: ["sales"] }, [salesDirect], index)?.id, "sales", "林经理直属销售部");
  assert.equal(coveredBy(unitSubject(unit("g1"), index), [salesDirect], index), null);
});

test("picking a covering department drops the picks it now contains; single replaces; max stops", () => {
  const before = [li, chen, unitSubject(unit("g2"), index), unitSubject(unit("sz"), index)];
  const after = pickSubject(before, unitSubject(unit("sales"), index), index);
  assert.deepEqual(after.map((s) => s.id), ["sz", "sales"]);
  assert.deepEqual(pickSubject([li], chen, index, { mode: "single" }).map((s) => s.id), ["chen"]);
  assert.deepEqual(pickSubject([li], chen, index, { max: 1 }).map((s) => s.id), ["li"], "满了不再加");
  assert.deepEqual(togglePick([li, chen], li, index).map((s) => s.id), ["chen"]);
  assert.deepEqual(togglePick([li], li, index, { mode: "single" }).map((s) => s.id), [], "单选再点一次 = 取消");
});

test("switching 含下级 back on prunes the covered picks and keeps the position", () => {
  const wu = personSubject({ id: "wu", label: "吴", deptIds: ["sz"] }, index);
  const value = [wu, chen, { ...unitSubject(unit("sales"), index), includeSub: false }, li, lin];
  const on = setIncludeSub(value, { kind: "dept", id: "sales" }, true, index);
  assert.deepEqual(on.map((s) => `${s.id}:${s.includeSub ?? ""}`), ["wu:", "sales:true"], "一组的人和直属的林经理都被盖住");
  const off = setIncludeSub(on, { kind: "dept", id: "sales" }, false, index);
  assert.equal(off.find((s) => s.id === "sales")?.includeSub, false);
});

test("「全选这些人」 skips covered, departed and picked people and respects max", () => {
  const left = { ...personSubject({ id: "jie", label: "李俊杰", deptIds: ["g1"] }, index), status: "left" as const };
  const next = pickAll([chen], [li, chen, left, lin], index, { max: 3 });
  assert.deepEqual(next.map((s) => s.id), ["chen", "li", "lin"]);
  assert.deepEqual(pickAll([unitSubject(unit("g1"), index)], [li, chen], index).map((s) => s.id), ["g1"], "一组整组选了，人不再重复加");
});

test("reach is deduplicated: covered picks count once, direct-only uses the direct count, roles make it approximate", () => {
  const sales = unitSubject(unit("sales"), index);
  assert.deepEqual(reachOf([sales, li, unitSubject(unit("g1"), index)], index), { count: 10, exact: true });
  assert.deepEqual(reachOf([li, chen, unitSubject(unit("g2"), index)], index), { count: 6, exact: true });
  assert.deepEqual(reachOf([{ ...sales, includeSub: false }, li], index), { count: 2, exact: true });
  assert.deepEqual(reachOf([li, { kind: "role", id: "r1", label: "财务", count: 2 }], index), { count: 3, exact: false });
  const left: PickedSubject = { ...li, id: "jie", status: "left" };
  assert.equal(reachOf([left], index).count, 0, "已离职的不算覆盖人数");
});

test("departed people stay until removed explicitly; the diff says so", () => {
  const left: PickedSubject = { kind: "person", id: "jie", label: "李俊杰", status: "left" };
  const before = [left, li];
  const after = togglePick(before, chen, index);
  const diff = diffPicks(before, after);
  assert.deepEqual(diff.added.map((s) => s.id), ["chen"]);
  assert.deepEqual(diff.removed, []);
  assert.deepEqual(diff.keptDeparted.map((s) => s.id), ["jie"], "确定时不悄悄丢掉");
  const removed = diffPicks(before, togglePick(before, left, index));
  assert.deepEqual(removed.removed.map((s) => s.id), ["jie"]);
});

test("output shape is exactly { kind, id, label, path, includeSub } (includeSub only on units)", () => {
  const out = toOutput([li, unitSubject(unit("g2"), index), { kind: "role", id: "r1", label: "财务" }]);
  assert.deepEqual(out, [
    { kind: "person", id: "li", label: "小李", path: ["华南子公司", "销售部", "一组"] },
    { kind: "dept", id: "g2", label: "二组", path: ["华南子公司", "销售部"], includeSub: true },
    { kind: "role", id: "r1", label: "财务", path: [] },
  ]);
});

test("resolve merges labels / paths / departed status without reordering or dropping", () => {
  const value: PickedSubject[] = [{ kind: "person", id: "jie", label: "jie" }, { kind: "dept", id: "g2", label: "g2", includeSub: false }];
  const merged = mergeResolved(value, [{ kind: "dept", id: "g2", label: "二组", path: ["华南子公司", "销售部"], includeSub: true }, { kind: "person", id: "jie", label: "李俊杰", status: "left" }]);
  assert.deepEqual(merged.map((s) => [s.id, s.label, s.status ?? "", s.includeSub ?? ""]), [["jie", "李俊杰", "left", ""], ["g2", "二组", "", false]]);
});

test("grouping: right column by kind order, search hits six per group with a remainder", () => {
  assert.deepEqual(groupByKind([unitSubject(unit("g2"), index), { kind: "line", id: "l", label: "智能家居" }, li]).map((g) => g.kind), ["person", "dept", "line"]);
  const hits = [...Array.from({ length: 8 }, (_, i) => ({ kind: "person", id: `p${i}`, label: `人${i}` })), { kind: "company", id: "hn", label: "华南子公司" }, { kind: "dept", id: "g1", label: "一组" }, { kind: "role", id: "r", label: "销售" }];
  const groups = groupHits(hits, 6);
  assert.deepEqual(groups.map((g) => [g.key, g.items.length, g.more]), [["person", 6, 2], ["unit", 2, 0], ["role", 1, 0]]);
  assert.equal(groupHits(hits, 6, new Set(["person"]))[0]?.items.length, 8);
});

test("tree rows and keys follow the WAI-ARIA tree pattern", () => {
  const roots = [unit("g")];
  const children = new Map<string, readonly OrgUnit[]>([["g", [unit("hn"), unit("sz")]], ["hn", [unit("sales")]], ["sales", [unit("g1"), unit("g2")]]]);
  const rows = visibleTreeRows(roots, children, new Set(["g", "hn"]), (u) => u.id === "sz");
  assert.deepEqual(rows.map((r) => `${r.unit.id}@${r.level}${r.expanded ? "+" : ""}`), ["g@1+", "hn@2+", "sales@3"], "隐藏的公司不出现");
  assert.deepEqual(treeKey(rows, "g", "ArrowDown"), { type: "focus", id: "hn" });
  assert.deepEqual(treeKey(rows, "sales", "ArrowRight"), { type: "expand", id: "sales" });
  assert.deepEqual(treeKey(rows, "hn", "ArrowRight"), { type: "focus", id: "sales" }, "展开的 → 进第一个子");
  assert.deepEqual(treeKey(rows, "hn", "ArrowLeft"), { type: "collapse", id: "hn" });
  assert.deepEqual(treeKey(rows, "sales", "ArrowLeft"), { type: "focus", id: "hn" }, "收着的 ← 回父");
  assert.deepEqual(treeKey(rows, "sales", " "), { type: "toggle", id: "sales" });
  assert.deepEqual(treeKey(rows, "sales", "Enter"), { type: "open", id: "sales" });
  assert.deepEqual(treeKey(rows, "hn", "End"), { type: "focus", id: "sales" });
  const unknown = visibleTreeRows([{ id: "x", kind: "dept", label: "X", parentId: null }], new Map(), new Set());
  assert.equal(unknown[0]?.hasChildren, true, "没加载过、不知道有没有下级：先给箭头");
  assert.equal(visibleTreeRows([{ id: "x", kind: "dept", label: "X", parentId: null, childCount: 0 }], new Map(), new Set())[0]?.hasChildren, false);
});

test("virtual window draws only the visible rows plus overscan; list keys clamp", () => {
  assert.deepEqual(virtualWindow(0, 480, 48, 500), { start: 0, end: 22, before: 0, after: (500 - 22) * 48 });
  const mid = virtualWindow(48 * 200, 480, 48, 500);
  assert.equal(mid.start, 194);
  assert.ok(mid.end - mid.start <= 22);
  assert.equal(mid.before + (mid.end - mid.start) * 48 + mid.after, 500 * 48, "总高度不变");
  assert.deepEqual(virtualWindow(0, 480, 48, 0), { start: 0, end: 0, before: 0, after: 0 });
  assert.equal(listKey(0, "ArrowUp", 5), 0);
  assert.equal(listKey(3, "End", 5), 4);
  assert.equal(listKey(1, "PageDown", 20), 9);
  assert.equal(scrollToRow(10, 0, 240, 48), 10 * 48 + 48 - 240);
  assert.equal(scrollToRow(1, 0, 240, 48), null);
});

test("wording: three locales with the same keys, overrides, Intl numbers, summaries", () => {
  const keys = Object.keys(ORG_PICKER_MESSAGES["zh-CN"]).sort();
  assert.deepEqual(Object.keys(ORG_PICKER_MESSAGES["zh-TW"]).sort(), keys);
  assert.deepEqual(Object.keys(ORG_PICKER_MESSAGES.en).sort(), keys);
  assert.equal(fillText("共覆盖 {n} 人（去重）", { n: 12345 }), "共覆盖 12,345 人（去重）");
  assert.equal(orgPickerMessages("zh-CN", { confirm: "好" }).confirm, "好");
  assert.equal(orgPickerMessages("zh-TW").confirm, "確定");
  assert.equal(fillText(orgPickerMessages().departedHit, { name: "李俊杰" }), "「李俊杰」已离职");
  const m = orgPickerMessages();
  assert.equal(selectionSummary(m, [{ kind: "person", count: 2 }, { kind: "dept", count: 1 }, { kind: "role", count: 0 }]), "2 人、1 个部门");
  assert.equal(selectionSummary(orgPickerMessages("en"), [{ kind: "person", count: 2 }, { kind: "line", count: 1 }], "en"), "2 people, 1 Lines");
});

test("锁定提示：宿主给了原因就原样显示（原因里已经写了找谁），没原因才用默认文案 + lockedHint", async () => {
  const { lockedNotice } = await import("../src/org-picker/org-picker-core.ts");
  assert.equal(lockedNotice("跨公司分享要集团管理员开通", "不在你的管理范围", "找管理员"), "跨公司分享要集团管理员开通");
  assert.equal(lockedNotice(undefined, "不在你的管理范围", "找管理员"), "不在你的管理范围：找管理员");
  assert.equal(lockedNotice(undefined, "不在你的管理范围"), "不在你的管理范围");
});
