import test from "node:test";
import assert from "node:assert/strict";
import {
  actionState,
  changeSummaryText,
  diffModuleGrant,
  diffModuleGrants,
  effectiveScope,
  fieldModeOf,
  grantChips,
  grantedActions,
  impactCounts,
  impactSentence,
  levelOf,
  levelsNote,
  moduleLevels,
  nearestLevel,
  normalizeGrant,
  pendingCount,
  resetToLevel,
  resolvePending,
  scopeMode,
  setFieldMode,
  setLevel,
  toggleAction,
  type ModuleAccessDef,
  type ModuleGrant,
} from "../src/access/module-core.ts";

const BITABLE: ModuleAccessDef = {
  id: "bitable",
  label: "多维表格",
  levels: [
    { id: "viewer", actions: ["r:read"] },
    { id: "member_own", actions: ["r:read", "r:create", "i:import"] },
    { id: "member_all", actions: ["r:read", "r:create", "i:import", "r:bulk"] },
    { id: "admin", actions: ["r:read", "r:create", "i:import", "r:bulk", "r:export", "s:drop"], grantable: "你自己没有「多维表格 · 管理员」" },
  ],
  resources: [
    { id: "r", label: "记录", scoped: true, actions: [{ key: "r:read", label: "看" }, { key: "r:create", label: "加" }, { key: "r:export", label: "导出", risk: "high", stepUp: true }, { key: "r:bulk", label: "批量删除", risk: "high" }] },
    { id: "i", label: "导入", actions: [{ key: "i:import", label: "导入记录" }] },
    { id: "s", label: "表结构", actions: [{ key: "s:drop", label: "删表", minLevel: "admin" }] },
    { id: "f", label: "字段", actions: [], fields: [{ id: "deal", label: "成交价" }, { id: "floor", label: "底价", defaultMode: "hidden" }] },
  ],
};
const KB: ModuleAccessDef = {
  id: "kb",
  label: "知识库",
  scopeNote: "按空间成员决定",
  levels: [{ id: "viewer", actions: ["p:read"] }, { id: "member_all", actions: ["p:read", "p:edit"] }],
  resources: [{ id: "p", label: "页面", actions: [{ key: "p:read", label: "看" }, { key: "p:edit", label: "改" }] }],
};

test("levels: only declared ones (plus 无), note about the missing middle level", () => {
  assert.deepEqual(moduleLevels(KB), ["none", "viewer", "member_all"]);
  assert.match(levelsNote(KB) ?? "", /知识库没有「成员·只看自己的」「管理员」这一档/);
  assert.equal(levelsNote(BITABLE), null);
});

test("levelOf: exact level match, otherwise custom; nearestLevel counts the difference", () => {
  assert.equal(levelOf(BITABLE, []), "none");
  assert.equal(levelOf(BITABLE, ["r:create", "r:read", "i:import"]), "member_own");
  assert.equal(levelOf(BITABLE, ["r:read", "r:create", "i:import", "r:export"]), "custom");
  assert.deepEqual(nearestLevel(BITABLE, ["r:read", "r:create", "i:import", "r:export"]), { level: "member_own", extra: ["r:export"], missing: [] });
  assert.deepEqual(normalizeGrant(BITABLE, { level: null, raw: ["r:read"] }), { level: "viewer", scope: null });
  assert.equal(normalizeGrant(BITABLE, { level: null, raw: ["r:export"] }).level, null);
});

test("scope: member_own fixed to own, member_all defaults to all, scopeNote / none / unscoped", () => {
  assert.equal(scopeMode(BITABLE, { level: "member_own" }), "fixed");
  assert.equal(effectiveScope(BITABLE, { level: "member_own", scope: "all" }), "own");
  assert.equal(effectiveScope(BITABLE, { level: "member_all" }), "all");
  assert.equal(effectiveScope(BITABLE, { level: "member_all", scope: "dept_tree" }), "dept_tree");
  assert.equal(scopeMode(BITABLE, { level: "none" }), "none");
  assert.equal(scopeMode(KB, { level: "viewer" }), "note");
  assert.equal(effectiveScope(KB, { level: "viewer" }), null);
});

test("fine-tune: level actions toggle into mute, others into add; pending is never granted until decided", () => {
  let g: ModuleGrant = { level: "member_all", pending: ["r:bulk"] };
  assert.ok(!grantedActions(BITABLE, g).has("r:bulk"));
  assert.equal(actionState(BITABLE, g, BITABLE.resources[0]!.actions[3]!).origin, "pending");
  g = toggleAction(BITABLE, g, "i:import", false);
  assert.deepEqual(g.mute, ["i:import"]);
  assert.equal(actionState(BITABLE, g, BITABLE.resources[1]!.actions[0]!).origin, "muted");
  g = toggleAction(BITABLE, g, "r:export", true);
  assert.deepEqual(g.add, ["r:export"]);
  assert.equal(actionState(BITABLE, g, BITABLE.resources[0]!.actions[2]!).origin, "added");
  // minLevel lock
  const drop = actionState(BITABLE, g, BITABLE.resources[2]!.actions[0]!);
  assert.equal(drop.locked, "「管理员」档才有");
  // pending: give → granted via level; reject → muted
  assert.ok(grantedActions(BITABLE, resolvePending(BITABLE, g, "r:bulk", true)).has("r:bulk"));
  const rejected = resolvePending(BITABLE, g, "r:bulk", false);
  assert.deepEqual(rejected.pending, []);
  assert.ok(rejected.mute?.includes("r:bulk"));
  // reset keeps pending, clears add / mute / fields
  const reset = resetToLevel({ ...g, fields: { deal: { read: false } } });
  assert.deepEqual([reset.add, reset.mute, reset.pending, reset.fields], [[], [], ["r:bulk"], undefined]);
});

test("setLevel drops redundant add / mute, keeps pending inside the new level, resets scope; none clears all", () => {
  const g: ModuleGrant = { level: "member_own", scope: "own", add: ["r:bulk", "r:export"], mute: ["i:import"], pending: ["r:bulk"] };
  const up = setLevel(BITABLE, g, "member_all");
  assert.deepEqual(up, { level: "member_all", scope: null, add: ["r:export"], mute: ["i:import"], pending: ["r:bulk"] });
  assert.deepEqual(setLevel(BITABLE, g, "viewer").mute, []);
  assert.deepEqual(setLevel(BITABLE, g, "none"), { level: "none" });
  // custom → level starts clean
  assert.deepEqual(setLevel(BITABLE, { level: null, raw: ["r:export"] }, "viewer"), { level: "viewer", scope: null, add: [], mute: [], pending: [] });
});

test("fields three-state: hidden = read false, read-only = write false, default entries are dropped", () => {
  const deal = BITABLE.resources[3]!.fields![0]!;
  const floor = BITABLE.resources[3]!.fields![1]!;
  assert.equal(fieldModeOf(undefined), "write");
  assert.equal(fieldModeOf({ read: false }), "hidden");
  assert.equal(fieldModeOf({ read: true, write: false }), "read");
  let g = setFieldMode({ level: "viewer" }, deal, "read");
  assert.deepEqual(g.fields, { deal: { read: true, write: false } });
  g = setFieldMode(g, deal, "write");
  assert.deepEqual(g.fields, {});
  assert.deepEqual(setFieldMode(g, floor, "hidden").fields, {});
});

test("chips and diff read like the demo; changeSummaryText for the change bar; pendingCount for the menu badge", () => {
  const saved: ModuleGrant = { level: "member_own", pending: ["r:bulk"] };
  const draft: ModuleGrant = { level: "member_all", scope: "dept_tree", add: ["r:export"], mute: ["i:import"], pending: ["r:bulk"], fields: { deal: { read: true, write: false } } };
  assert.deepEqual(grantChips(BITABLE, draft).map((c) => c.text), ["加 导出", "去掉 导入记录", "字段 1 个", "1 项待确认"]);
  assert.deepEqual(grantChips(BITABLE, { level: "viewer" }), [{ kind: "default", text: "按档位默认" }]);
  assert.equal(grantChips(BITABLE, { level: null, raw: ["r:read", "r:create", "i:import", "r:export"] })[0]!.text, "比「成员·只看自己的」多 1 项");
  const lines = diffModuleGrant(BITABLE, saved, draft, { scope: { own: "本人", dept_tree: "部门及下级" } });
  assert.deepEqual(lines.map((l) => [l.kind, l.what, l.from, l.to]), [
    ["change", "档位", "成员·只看自己的", "成员·按范围看"],
    ["change", "能看到的数据", "本人", "部门及下级"],
    ["add", "导出", undefined, undefined],
    ["remove", "导入记录", undefined, undefined],
    ["change", "字段「成交价」", "可编辑", "只读"],
  ]);
  assert.equal(lines[2]!.risk, true);
  assert.equal(lines[2]!.stepUp, true);
  const decided = diffModuleGrant(BITABLE, draft, resolvePending(BITABLE, draft, "r:bulk", false));
  assert.deepEqual(decided.map((l) => [l.kind, l.what]), [["remove", "批量删除"]], "rejecting a pending action is one line, not two");
  const changes = diffModuleGrants([BITABLE, { ...KB, section: "system" }], { bitable: saved }, { bitable: draft, kb: { level: "viewer" } });
  assert.deepEqual(changes.map((c) => c.label), ["多维表格", "系统管理 · 知识库"]);
  assert.match(changeSummaryText(changes), /^多维表格：成员·只看自己的 → 成员·按范围看、全部 → 部门及下级|^多维表格：成员·只看自己的 → 成员·按范围看/);
  assert.match(changeSummaryText(changes), / · 知识库：无 → 只看$/);
  assert.equal(pendingCount({ bitable: draft, kb: { level: "viewer" } }), 1);
  assert.equal(pendingCount([{ bitable: draft }, { bitable: draft }]), 2);
  assert.equal(diffModuleGrant(BITABLE, draft, draft).length, 0);
});

test("unavailable modules are skipped in diff and have no chips", () => {
  const off: ModuleAccessDef = { ...KB, id: "crm", unavailable: { label: "本公司未开通" } };
  assert.deepEqual(grantChips(off, { level: "viewer" }), []);
  assert.deepEqual(diffModuleGrants([off], {}, { crm: { level: "viewer" } }), []);
});

test("impact counts and sentence", () => {
  const people = [
    { id: "a", name: "小王", gains: ["导出"], losses: [] },
    { id: "b", name: "小李", gains: ["导出"], losses: ["导入"] },
    { id: "c", name: "周经理", gains: [], losses: [] },
  ];
  assert.deepEqual(impactCounts(people), { gain: 2, lose: 1, same: 1 });
  assert.equal(impactSentence({ total: 3, people }), "2 人多了权限、1 人少了、1 人不变");
  assert.equal(impactSentence({ total: 0, people: [] }), "没有人的权限会变");
});
