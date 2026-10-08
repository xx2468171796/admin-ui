import test from "node:test";
import assert from "node:assert/strict";
import type { EffectiveAccessRow, ExplainResult, MatrixAction, MatrixResource, PermissionMatrixValue, TreeNode } from "../src/access/contracts.ts";
import {
  branchIds,
  checkStates,
  fullPath,
  halfChecked,
  indexTree,
  normalizeLinked,
  setAll,
  toggleNode,
  treeKey,
  visibleIds,
  visibleRows,
} from "../src/access/tree-core.ts";
import {
  describeScope,
  diffMatrix,
  matrixChangeItems,
  normalizeFieldPolicy,
  rowState,
  sameScope,
  setCell,
  toggleFieldAbility,
  toggleRows,
  validateScope,
  compareTier,
} from "../src/access/matrix-core.ts";
import {
  expiryState,
  explainSummary,
  filterEffective,
  levelIncludes,
  requestActions,
  reviewProgress,
  sortTeam,
  sourceCounts,
  staleGrant,
  teamOwner,
} from "../src/access/review-core.ts";
import { diffJson, formatJsonValue, isSecretPath } from "../src/access/diff-core.ts";

const MENU: TreeNode[] = [
  {
    id: "crm",
    label: "客户管理",
    children: [
      { id: "crm:customer", label: "客户", children: [{ id: "customer:read", label: "查看", hint: "customer:read" }, { id: "customer:edit", label: "编辑" }, { id: "customer:export", label: "导出", disabled: true }] },
      { id: "crm:deal", label: "商机", keywords: "shangji", children: [{ id: "deal:read", label: "查看" }] },
    ],
  },
  { id: "sys", label: "系统设置" },
];
const tree = indexTree(MENU);

test("树索引：深度优先顺序、完整路径、重复 id 直接报错", () => {
  assert.deepEqual(tree.order, ["crm", "crm:customer", "customer:read", "customer:edit", "customer:export", "crm:deal", "deal:read", "sys"]);
  assert.equal(fullPath(tree, "customer:edit"), "客户管理 / 客户 / 编辑");
  assert.equal(fullPath(tree, "missing"), "missing");
  assert.throws(() => indexTree([{ id: "a", label: "A", children: [{ id: "a", label: "A2" }] }]), /重复/);
  assert.deepEqual(branchIds(tree), ["crm", "crm:customer", "crm:deal"]);
});

test("联动勾选：勾父节点带上可用子孙，禁用节点保持原状，父节点半选 / 全选由子节点决定", () => {
  const on = toggleNode(tree, [], "crm:customer", true);
  // export is disabled → stays off → 客户 is only half checked, so it is not in the value.
  assert.deepEqual(on, ["customer:read", "customer:edit"]);
  const states = checkStates(tree, new Set(on), true);
  assert.equal(states.get("crm:customer"), "indeterminate");
  assert.equal(states.get("crm"), "indeterminate");
  assert.deepEqual(halfChecked(tree, on, true), ["crm", "crm:customer"]);
  // Checking the deal leaf makes 商机 full; 客户 still half.
  const more = toggleNode(tree, on, "deal:read", true);
  assert.deepEqual(more, ["customer:read", "customer:edit", "crm:deal", "deal:read"]);
  // Clicking a half parent checks everything enabled under it; clicking again clears.
  const full = toggleNode(tree, on, "crm", true);
  assert.deepEqual(full, ["customer:read", "customer:edit", "crm:deal", "deal:read"]);
  assert.deepEqual(toggleNode(tree, full, "crm", true).length, 0, "第二次点击：全部取消（禁用的本来就没勾）");
  // A disabled node never toggles.
  assert.deepEqual(toggleNode(tree, [], "customer:export", true), []);
});

test("联动值的规范形：父节点只在全部子节点勾上时出现；外来半选父节点读作半选而不是全选", () => {
  const withExport = normalizeLinked(tree, new Set(["customer:read", "customer:edit", "customer:export", "deal:read"]));
  assert.deepEqual(withExport, ["crm", "crm:customer", "customer:read", "customer:edit", "customer:export", "crm:deal", "deal:read"]);
  const stray = checkStates(tree, new Set(["crm:customer"]), true);
  assert.equal(stray.get("crm:customer"), "indeterminate");
  assert.deepEqual(normalizeLinked(tree, new Set(["crm:customer"])), []);
});

test("不联动（menu_check_strictly=false）：每个节点各管各的，没有半选", () => {
  const v = toggleNode(tree, [], "crm", false);
  assert.deepEqual(v, ["crm"]);
  assert.equal(checkStates(tree, new Set(v), false).get("crm:customer"), "unchecked");
  assert.deepEqual(halfChecked(tree, v, false), []);
  assert.deepEqual(toggleNode(tree, v, "crm", false), []);
  assert.deepEqual(setAll(tree, ["unknown-id"], true, false), [...tree.order.filter((id) => id !== "customer:export"), "unknown-id"], "全选跳过禁用；未知 id 保留在末尾，不悄悄丢掉");
  assert.deepEqual(setAll(tree, tree.order, false, true), ["customer:export"]);
});

test("搜索与只看已选：保留命中节点、祖先做上下文，命中父节点时子节点一起显示", () => {
  const byKeyword = visibleIds(tree, { query: "shangji" })!;
  assert.deepEqual([...byKeyword].sort(), ["crm", "crm:deal", "deal:read"]);
  const byHint = visibleIds(tree, { query: "customer:read" })!;
  assert.ok(byHint.has("customer:read") && byHint.has("crm:customer") && !byHint.has("customer:edit"));
  assert.equal(visibleIds(tree, { query: "  " }), null);
  const states = checkStates(tree, new Set(["deal:read", "crm:deal"]), true);
  const only = visibleIds(tree, { onlyChecked: true, states })!;
  assert.deepEqual([...only].sort(), ["crm", "crm:deal", "deal:read"]);
  // Two words must both appear.
  assert.equal(visibleIds(tree, { query: "客户 不存在" })!.size, 0);
});

test("可见行与键盘：方向键 / Home / End / 左右展开收起与回到父节点", () => {
  const expanded = new Set(["crm"]);
  const rows = visibleRows(tree, expanded, null);
  assert.deepEqual(rows.map((r) => r.id), ["crm", "crm:customer", "crm:deal", "sys"]);
  assert.deepEqual(rows.map((r) => [r.posInSet, r.setSize]), [[1, 2], [1, 2], [2, 2], [2, 2]]);
  assert.deepEqual(treeKey(rows, tree, "crm", "ArrowDown"), { focus: "crm:customer" });
  assert.deepEqual(treeKey(rows, tree, "crm:customer", "ArrowRight"), { expand: "crm:customer" });
  assert.deepEqual(treeKey(rows, tree, "crm:customer", "ArrowLeft"), { focus: "crm" });
  assert.deepEqual(treeKey(rows, tree, "crm", "ArrowLeft"), { collapse: "crm" });
  assert.deepEqual(treeKey(rows, tree, "crm", "ArrowRight"), { focus: "crm:customer" });
  assert.deepEqual(treeKey(rows, tree, "crm:deal", "End"), { focus: "sys" });
  assert.deepEqual(treeKey(rows, tree, "sys", "Home"), { focus: "crm" });
  assert.equal(treeKey(rows, tree, "sys", "a"), null);
  const filtered = visibleRows(tree, new Set(branchIds(tree)), visibleIds(tree, { query: "shangji" }));
  assert.deepEqual(filtered.map((r) => r.id), ["crm", "crm:deal", "deal:read"]);
});

const ACTIONS: MatrixAction[] = [
  { id: "read", label: "查看", scoped: true },
  { id: "edit", label: "编辑", scoped: true, tiers: ["own", "dept"] },
  { id: "export", label: "导出" },
];
const RESOURCES: MatrixResource[] = [
  { id: "customer", label: "客户", group: "客户管理", actions: ["read", "edit", "export"], fields: [{ id: "phone", label: "手机号", sensitive: true }, { id: "name", label: "名称", defaultPolicy: { read: true, write: false, export: true, mask: false } }] },
  { id: "deal", label: "商机", group: "客户管理", actions: ["read"] },
];

test("数据范围：文字描述、校验、比较和相等（部门顺序无关）", () => {
  assert.equal(describeScope({ tier: "dept_tree", includeUnassigned: true }), "本部门及以下 + 无部门的记录");
  assert.equal(describeScope({ tier: "all", includeUnassigned: true }), "全部");
  assert.equal(describeScope({ tier: "custom", deptIds: ["d1", "d2"] }, (id) => ({ d1: "华东", d2: "华南" })[id]!), "指定部门：华东、华南");
  assert.equal(describeScope({ tier: "custom", deptIds: ["a", "b", "c", "d"] }), "指定部门（4 个）");
  assert.match(describeScope({ tier: "custom", deptIds: [] }), /只有自己名下的/);
  assert.equal(describeScope(null), "未授予");
  assert.match(validateScope({ tier: "custom" })!, /至少选择一个部门/);
  assert.equal(validateScope({ tier: "own" }), null);
  assert.ok(compareTier("all", "own")! > 0 && compareTier("own", "subordinates")! < 0);
  assert.equal(compareTier("custom", "dept"), null);
  assert.ok(sameScope({ tier: "custom", deptIds: ["b", "a"] }, { tier: "custom", deptIds: ["a", "b", "a"] }));
  assert.ok(!sameScope({ tier: "dept" }, { tier: "dept", includeUnassigned: true }));
  assert.ok(sameScope({ tier: "dept", deptIds: ["x"] }, { tier: "dept" }), "非 custom 的部门 id 不算数");
});

test("字段策略：写 / 导出 / 脱敏都要先能读，取消读全部清空", () => {
  const none = { read: false, write: false, export: false, mask: false };
  assert.deepEqual(toggleFieldAbility(none, "write"), { read: true, write: true, export: false, mask: false });
  assert.deepEqual(toggleFieldAbility({ read: true, write: true, export: true, mask: true }, "read"), none);
  assert.deepEqual(normalizeFieldPolicy({ read: false, write: true, export: true, mask: true }), none);
  assert.deepEqual(toggleFieldAbility({ read: true, write: false, export: false, mask: false }, "mask"), { read: true, write: false, export: false, mask: true });
});

test("矩阵：开格子带默认最窄档，整行三态切换，和保存值比出改动清单", () => {
  const saved: PermissionMatrixValue = { grants: { "customer:read": { scope: { tier: "dept" } } } };
  let draft = setCell(saved, "customer", ACTIONS[1]!, true);
  assert.deepEqual(draft.grants["customer:edit"], { scope: { tier: "own" } });
  assert.equal(rowState(draft, RESOURCES[0]!), "indeterminate");
  draft = toggleRows(draft, RESOURCES, ACTIONS);
  assert.equal(rowState(draft, RESOURCES[0]!), "checked");
  assert.deepEqual(draft.grants["customer:read"], { scope: { tier: "dept" } }, "整行勾选不改已有的范围");
  assert.deepEqual(draft.grants["customer:export"], {}, "不带范围的动作没有 scope");
  draft = setCell(draft, "customer", ACTIONS[0]!, true, { tier: "custom", deptIds: ["d1"] });
  draft = { ...draft, fields: { "customer.phone": { read: true, write: false, export: false, mask: true } } };
  const changes = diffMatrix(saved, draft, RESOURCES, ACTIONS);
  assert.deepEqual(changes.map((c) => c.key), ["customer:read", "customer:edit", "customer:export", "customer.phone", "deal:read"]);
  const items = matrixChangeItems(changes, () => "华东");
  assert.deepEqual(items[0], { label: "客户 · 查看", from: "已授予（本部门）", to: "已授予（指定部门：华东）", effect: "保存后立即生效" });
  assert.deepEqual(items[3], { label: "客户 · 字段「手机号」", from: "无", to: "读、脱敏", effect: "保存后立即生效" });
  // Field equal to its default policy is not a change; toggling all rows off again clears grants.
  assert.equal(diffMatrix(saved, { ...saved, fields: { "customer.name": { read: true, write: false, export: true, mask: false } } }, RESOURCES, ACTIONS).length, 0);
  const cleared = toggleRows(draft, RESOURCES, ACTIONS);
  assert.deepEqual(Object.keys(cleared.grants), []);
});

test("到期：永久 / 剩余天数向上取整 / 今天到期 / 已到期 / 无效", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  assert.deepEqual(expiryState(null, now), { kind: "permanent", label: "永久" });
  assert.deepEqual(expiryState("2026-10-20T00:00:00Z", now), { kind: "active", days: 19, label: "还剩 19 天" });
  assert.deepEqual(expiryState("2026-10-03T01:00:00Z", now), { kind: "soon", days: 3, label: "还剩 3 天" });
  assert.equal(expiryState("2026-10-01T05:00:00Z", now).label, "今天到期");
  assert.equal(expiryState("2026-09-30T00:00:00Z", now).kind, "expired");
  assert.equal(expiryState("not a date", now).kind, "invalid");
});

test("记录团队：级别包含关系、排序、唯一负责人；申请单只给状态机允许的动作", () => {
  assert.ok(levelIncludes("owner", "viewer") && levelIncludes("editor", "editor") && !levelIncludes("viewer", "editor"));
  const team = sortTeam([
    { id: "1", subject: { type: "user", id: "u1", name: "王五" }, level: "viewer" },
    { id: "2", subject: { type: "user", id: "u2", name: "李四" }, level: "owner" },
    { id: "3", subject: { type: "dept", id: "d1", name: "华东区" }, level: "editor", inheritedFrom: "上级客户" },
    { id: "4", subject: { type: "user", id: "u3", name: "张三" }, level: "editor" },
  ]);
  assert.deepEqual(team.map((m) => m.id), ["2", "4", "3", "1"]);
  assert.equal(teamOwner(team)?.subject.name, "李四");
  assert.equal(teamOwner([]), null);
  const base = { id: "r", requester: { id: "u", name: "张三" }, target: { kind: "role" as const, id: "x", label: "财务" }, reason: "月结", createdAt: "2026-10-01" };
  assert.deepEqual(requestActions({ ...base, status: "pending" }, { approve: true, reject: true, cancel: true, revoke: true }), ["approve", "reject", "cancel"]);
  assert.deepEqual(requestActions({ ...base, status: "active" }, { approve: true, revoke: true }), ["revoke"]);
  assert.deepEqual(requestActions({ ...base, status: "pending" }, { revoke: true }), []);
  assert.deepEqual(requestActions({ ...base, status: "expired" }, { approve: true, reject: true, cancel: true, revoke: true }), []);
});

test("复核：进度统计；从没用过或 90 天没用的授权标出来", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const items = [
    { id: "a", subject: { id: "u", name: "A" }, grant: { kind: "role" as const, label: "管理员" }, decision: "keep" as const, lastUsedAt: "2026-09-30T00:00:00Z" },
    { id: "b", subject: { id: "u", name: "B" }, grant: { kind: "role" as const, label: "财务" }, decision: "revoke" as const, lastUsedAt: null },
    { id: "c", subject: { id: "u", name: "C" }, grant: { kind: "post" as const, label: "店长" }, lastUsedAt: "2026-05-01T00:00:00Z" },
  ];
  assert.deepEqual(reviewProgress(items), { decided: 2, total: 3, keep: 1, revoke: 1 });
  assert.deepEqual(items.map((i) => staleGrant(i, now)), [false, true, true]);
});

test("有效权限：按状态 / 来源 / 只看被拦截 / 关键词筛选，来源计数按行去重", () => {
  const rows: EffectiveAccessRow[] = [
    { code: "customer:read", label: "查看客户", group: "客户", allowed: true, sources: [{ kind: "role", label: "销售" }, { kind: "role", label: "经理" }], blocks: [] },
    { code: "customer:delete", label: "删除客户", group: "客户", allowed: false, sources: [{ kind: "role", label: "经理" }], blocks: [{ kind: "step_up", label: "需要短信验证" }] },
    { code: "deal:read", label: "查看商机", allowed: true, sources: [{ kind: "record_grant", label: "商机 D-1 编辑者" }], blocks: [] },
    { code: "finance:read", label: "查看财务", allowed: false, sources: [], blocks: [{ kind: "not_granted", label: "未授予" }] },
  ];
  assert.deepEqual(filterEffective(rows, { status: "allowed" }).map((r) => r.code), ["customer:read", "deal:read"]);
  assert.deepEqual(filterEffective(rows, { status: "denied", blockedOnly: true }).map((r) => r.code), ["customer:delete"]);
  assert.deepEqual(filterEffective(rows, { sources: ["record_grant"] }).map((r) => r.code), ["deal:read"]);
  assert.deepEqual(filterEffective(rows, { query: "客户 经理" }).map((r) => r.code), ["customer:read", "customer:delete"]);
  assert.deepEqual([...sourceCounts(rows)], [["role", 2], ["record_grant", 1]]);
});

test("解释摘要：允许来源、有条件允许、未知因 NULL 按拒绝、拦截原因", () => {
  const base: Omit<ExplainResult, "decision" | "allowedBy" | "blockedBy"> = { query: { subjectId: "u1", action: "edit", resourceType: "customer", resourceId: "C-1" }, subject: { id: "u1", label: "张三" }, steps: [] };
  assert.equal(explainSummary({ ...base, decision: "allow", allowedBy: [{ kind: "role", label: "销售经理" }], blockedBy: [] }), "允许：来自 角色「销售经理」");
  assert.equal(explainSummary({ ...base, decision: "conditional", condition: "负责人 = 本人", allowedBy: [{ kind: "post", label: "销售岗" }], blockedBy: [] }), "有条件允许：只对满足「负责人 = 本人」的记录，来自 岗位「销售岗」");
  assert.equal(explainSummary({ ...base, decision: "deny", allowedBy: [], blockedBy: [{ kind: "condition", label: "负责人 = 本人" }], unknown: [{ field: "owner_id", label: "负责人" }] }), "拒绝：条件结果未知（负责人 为空），未知按拒绝处理");
  assert.equal(explainSummary({ ...base, decision: "deny", allowedBy: [{ kind: "role", label: "经理" }], blockedBy: [{ kind: "restriction", label: "冻结客户不可改" }] }), "拒绝：收窄规则「冻结客户不可改」");
  assert.equal(explainSummary({ ...base, decision: "deny", allowedBy: [], blockedBy: [] }), "拒绝：没有任何授予来源");
});

test("审计差异：叶子级增删改、带 id 的数组按 id 对齐、敏感键识别、值格式化", () => {
  const before = { name: "销售", permissions: ["a", "b"], members: [{ id: 1, level: "viewer" }, { id: 2, level: "editor" }], meta: { "x-y": 1 }, password: "old" };
  const after = { name: "销售经理", permissions: ["a"], members: [{ id: 2, level: "owner" }, { id: 1, level: "viewer" }, { id: 3, level: "viewer" }], meta: { "x-y": 2 }, note: "", password: "new" };
  assert.deepEqual(diffJson(before, after), [
    { path: "name", kind: "changed", before: "销售", after: "销售经理" },
    { path: "permissions[1]", kind: "removed", before: "b" },
    { path: "members[id=2].level", kind: "changed", before: "editor", after: "owner" },
    { path: "members[id=3]", kind: "added", after: { id: 3, level: "viewer" } },
    { path: 'meta["x-y"]', kind: "changed", before: 1, after: 2 },
    { path: "password", kind: "changed", before: "old", after: "new" },
    { path: "note", kind: "added", after: "" },
  ]);
  assert.deepEqual(diffJson({ a: 1 }, { a: 1 }), []);
  assert.deepEqual(diffJson(null, { a: 1 }), [{ path: "（整体）", kind: "changed", before: null, after: { a: 1 } }]);
  assert.equal(diffJson({ list: Array.from({ length: 50 }, (_, i) => i) }, { list: [] }, 10).length, 10);
  assert.ok(isSecretPath("password") && isSecretPath("auth.accessToken") && isSecretPath('headers["X-Api-Key"]') && !isSecretPath("name"));
  assert.equal(formatJsonValue("123"), '"123"');
  assert.equal(formatJsonValue("hello"), "hello");
  assert.equal(formatJsonValue(""), '""');
  assert.equal(formatJsonValue({ a: 1n }), '{"a":"1"}');
  assert.equal(formatJsonValue("x".repeat(300), 10).length, 10);
});
