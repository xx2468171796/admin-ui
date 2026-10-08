// AccessConsole / RecordTeam / 字典参数页的纯规则：可见分区与只读、错误原地文案、部门树、角色改动、HTTP 适配器、参数类型化编辑。
import assert from "node:assert/strict";
import { test } from "node:test";
import { AccessApiError, createAccessApi } from "../src/access/console-api.ts";
import { addEach, addEachText, assignButton, snapshotScopeLines, assignPlaceOptions, assignmentActions, auditActionLabel, auditEventDim, auditTargetLabel, baseRoleOptions, codeOptions, consoleRights, dimValueDisableImpact, editsSelf, fieldCondChangeItems, listFailure, matrixOf, roleSaveBody, scopeKeyLabel, snapshotHolds, deptIndex, deptTree, errorLine, errorView, explainActions, futureIso, moveTargets, remainingText, roleBasicChanges, roleBasics, roleDirty, tierLabel } from "../src/access/console-core.ts";
import { EVERYONE_ID, SCOPE_TIER_HINT, teamAddPayload } from "../src/access/contracts.ts";
import type { AccessCatalogDto, DeptDto, RoleDto } from "../src/access/console-contracts.ts";
import { describeScope, effectiveScopeLines, validateScope } from "../src/access/matrix-core.ts";
import { checkDictCode, checkItemValue, checkParamKey, groupParams, paramChange, paramDraft, paramValueText, parseParamDraft } from "../src/peizhi/core.ts";
import { createPeizhiApi } from "../src/peizhi/api.ts";
import type { ParamDto } from "../src/peizhi/contracts.ts";

const dept = (id: string, parentId: string | null, name: string, sort = 0): DeptDto => ({ id, parentId, name, path: "", sort, status: "enabled", leaderIds: [], version: 1 });
const DEPTS = [dept("hq", null, "总部"), dept("east", "hq", "华东区", 1), dept("sh", "east", "上海部"), dept("sh1", "sh", "上海一组", 2), dept("sh2", "sh", "上海二组", 1), dept("south", "hq", "华南区", 2)];

test("consoleRights：按快照显示分区，没有 manage 码就只读；超管全部可见", () => {
  const mgr = consoleRights({ superuser: false, codes: ["qx:org.view", "qx:role.view", "qx:assign.manage", "qx:explain"] });
  assert.deepEqual(mgr.sections, ["org", "roles", "people", "groups", "fields", "explain"]);
  assert.equal(mgr.org.manage, false);
  assert.equal(mgr.roles.manage, false);
  assert.equal(mgr.assign, true);
  const aud = consoleRights({ superuser: false, codes: ["qx:audit.view", "qx:org.view", "qx:role.view"] });
  assert.ok(aud.sections.includes("audit") && !aud.sections.includes("explain"));
  assert.deepEqual(consoleRights({ superuser: false, codes: ["customer:view_own"] }).sections, []);
  assert.equal(consoleRights({ superuser: true, codes: [] }).sections.length, 7);
  assert.equal(consoleRights(null).sections.length, 0);
  // Hosts that renamed the codes.
  assert.deepEqual(consoleRights({ superuser: false, codes: ["perm:audit"] }, { auditView: "perm:audit" }).sections, ["audit"]);
});

test("errorView：403 防提权原话、409 冲突提示重新加载、401 去登录、网络错误", () => {
  const forbidden = errorView(new AccessApiError(403, { code: "FORBIDDEN", message: "不能授出自己没有的权限「客户 · 查看（全部）」", permission: "customer:view" }));
  assert.equal(forbidden.title, "没有权限");
  assert.match(forbidden.message, /不能授出/);
  assert.equal(forbidden.permission, "customer:view");
  const conflict = errorView(new AccessApiError(409, { code: "CONFLICT", message: "别人刚改过，请刷新后再改", field: "version" }));
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.message, "别人刚改过，请刷新后再改");
  assert.match(errorView(new AccessApiError(409, { code: "CONFLICT", message: "负责人变了" })).message, /重新加载后再改/);
  assert.equal(errorView(new AccessApiError(401, { code: "UNAUTHORIZED", message: "未登录" })).signIn, true);
  assert.equal(errorLine(new AccessApiError(400, { code: "INVALID", message: "名称不能为空" })), "名称不能为空");
  assert.equal(errorLine(new AccessApiError(403, { code: "SOD_CONFLICT", message: "职责分离：审计员不能同时能改客户" })), "职责冲突：职责分离：审计员不能同时能改客户");
  assert.equal(errorView(new Error("请选择角色")).message, "请选择角色");
});

test("部门：索引、完整路径、排序后的树、不能挪到自己下面", () => {
  const idx = deptIndex(DEPTS);
  assert.equal(idx.path("sh1"), "总部 / 华东区 / 上海部 / 上海一组");
  assert.equal(idx.name("gone"), "gone（已不存在）");
  assert.deepEqual(idx.subtree("east").sort(), ["east", "sh", "sh1", "sh2"]);
  const tree = deptTree(DEPTS, (id) => (id === "sh1" ? 3 : 0));
  assert.deepEqual(tree.map((n) => n.id), ["hq"]);
  const sh = tree[0]!.children![0]!.children![0]!;
  assert.deepEqual(sh.children!.map((n) => n.label), ["上海二组", "上海一组"], "按 sort 排");
  assert.equal(sh.children![1]!.hint, "3 人");
  assert.deepEqual(moveTargets(DEPTS, "east").map((d) => d.id), ["hq", "south"]);
});

const role = (over: Partial<RoleDto> = {}): RoleDto => ({ id: "r1", code: "r1", name: "外包客服", description: "", builtin: false, superuser: false, disabled: false, baseRoleId: null, grantable: [], sort: 10, version: 1, permissions: { grants: { "customer:view": { scope: { tier: "own" } } }, fields: {} }, updatedAt: "", updatedBy: null, ...over });
const CATALOG: AccessCatalogDto = {
  resources: [{ id: "customer", label: "客户", actions: ["view", "export"], fields: [{ id: "phone", label: "手机号", sensitive: true }] }],
  actions: [{ id: "view", label: "查看", scoped: true, tiers: ["own", "dept", "all", "custom"] }, { id: "export", label: "导出" }],
  codes: [{ code: "customer:view_own", label: "客户 · 查看（自己名下的）", group: "客户", risk: "normal", grantable: true, adminOnly: false }],
};

test("角色草稿：基本信息改动清单、矩阵改动算脏、基础角色不能选自己", () => {
  const r = role();
  assert.equal(roleDirty(r, roleBasics(r), r.permissions, CATALOG), false);
  assert.equal(roleDirty(r, { ...roleBasics(r), name: "外包客服 2" }, r.permissions, CATALOG), true);
  assert.equal(roleDirty(r, roleBasics(r), { grants: { "customer:view": { scope: { tier: "dept" } } } }, CATALOG), true);
  assert.deepEqual(roleBasicChanges(roleBasics(r), { ...roleBasics(r), disabled: true, baseRoleId: "sales" }, (id) => (id === "sales" ? "销售" : id)), [
    { label: "停用", from: "否", to: "是" },
    { label: "基础角色", from: "无", to: "销售" },
  ]);
  assert.deepEqual(baseRoleOptions([r, role({ id: "r2", name: "销售" }), role({ id: "r3", name: "停用的", disabled: true })], "r1"), [{ value: "r2", label: "销售" }]);
});

test("解释的动作、范围档名（含内核词）、审计动作名、预览剩余时间、到期时间", () => {
  assert.deepEqual(explainActions(CATALOG, "customer"), [
    { id: "view", label: "查看（按数据范围）", hint: "view" },
    { id: "customer:export", label: "导出", hint: "customer:export" },
  ]);
  assert.equal(tierLabel("self"), "仅本人");
  assert.equal(tierLabel("self_and_subordinates"), "本人及下属");
  assert.equal(tierLabel("dept_tree"), "本部门及以下");
  assert.equal(tierLabel("none"), "无");
  assert.equal(auditActionLabel("record.transfer-owner"), "转移负责人");
  assert.equal(auditActionLabel("x.unknown"), "x.unknown");
  const now = Date.parse("2026-10-01T08:00:00Z");
  assert.equal(remainingText("2026-10-01T08:09:05Z", now), "9 分 05 秒");
  assert.equal(remainingText("2026-10-01T07:59:00Z", now), "已结束");
  assert.equal(futureIso(""), null);
  assert.throws(() => futureIso("2000-01-01T00:00"), /晚于现在/);
});

test("§3.13 契约对齐：指定部门 = 勾选部门 ∪ 自己名下的；所有人 id 为 *；加成员只发 { type, id? }", () => {
  assert.equal(SCOPE_TIER_HINT.custom, "只看勾选部门的，以及自己名下的");
  assert.match(describeScope({ tier: "custom", deptIds: [] }), /只有自己名下的/);
  assert.match(validateScope({ tier: "custom", deptIds: [] })!, /至少选择一个部门/);
  assert.equal(EVERYONE_ID, "*");
  assert.deepEqual(teamAddPayload({ subject: { type: "user", id: "u1", name: "张三", hint: "销售" }, level: "editor", expiresAt: null, reason: "跟进" }), { subject: { type: "user", id: "u1" }, level: "editor", expiresAt: null, reason: "跟进" });
  assert.deepEqual(teamAddPayload({ subject: { type: "everyone", id: EVERYONE_ID, name: "所有人" }, level: "viewer", expiresAt: null, reason: "公开" }).subject, { type: "everyone" });
});

type Call = { url: string; method: string; body?: string; headers: Record<string, string> };
function fakeFetch(respond: (c: Call) => { status: number; body?: unknown } | Error) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    const c: Call = { url, method: init.method ?? "GET", ...(init.body ? { body: String(init.body) } : {}), headers: init.headers as Record<string, string> };
    calls.push(c);
    const r = respond(c);
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? null : typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

test("createAccessApi：路径和参数编码、请求头、空 body 不发 content-type、错误转 AccessApiError", async () => {
  const { f, calls } = fakeFetch((c) => (c.url.includes("/roles/r1") ? { status: 409, body: { code: "CONFLICT", message: "别人刚改过，请刷新后再改", field: "version" } } : { status: 200, body: c.method === "DELETE" ? { ok: true } : [] }));
  const api = createAccessApi({ baseUrl: "/api/qx/", fetch: f, headers: () => ({ "x-user": "boss" }) });
  await api.listAssignments({ subjectType: "user", subjectId: "a b" });
  await api.removeOverride("u/1", "customer:view_own", "撤回原因");
  await api.unassign({ subject: { type: "dept", id: "sh" }, roleId: "sales_rep", reason: "调岗" });
  await api.grantRecord("customer", "c1", { subject: { type: "everyone" }, level: "viewer", expiresAt: null, reason: "公开" });
  assert.equal(calls[0]!.url, "/api/qx/assignments?subjectType=user&subjectId=a%20b");
  assert.equal(calls[1]!.url, "/api/qx/users/u%2F1/overrides/customer%3Aview_own?reason=%E6%92%A4%E5%9B%9E%E5%8E%9F%E5%9B%A0");
  assert.equal(calls[1]!.method, "DELETE");
  assert.equal(calls[1]!.headers["content-type"], undefined, "没有 body 不发 content-type（Fastify 会把空 JSON 当错）");
  assert.equal(calls[1]!.headers["x-user"], "boss");
  assert.match(calls[2]!.url, /^\/api\/qx\/assignments\?subjectType=dept&subjectId=sh&roleId=sales_rep&reason=/);
  assert.deepEqual(JSON.parse(calls[3]!.body!), { subject: { type: "everyone" }, level: "viewer", expiresAt: null, reason: "公开" });
  await assert.rejects(() => api.updateRole("r1", { version: 1, name: "x" }), (e: unknown) => e instanceof AccessApiError && e.status === 409 && e.code === "CONFLICT" && e.field === "version");
  const down = createAccessApi({ baseUrl: "/api/qx", fetch: fakeFetch(() => new TypeError("fetch failed")).f });
  await assert.rejects(() => down.me(), (e: unknown) => e instanceof AccessApiError && e.status === 0 && /连不上/.test(e.message));
  const html = createAccessApi({ baseUrl: "/api/qx", fetch: fakeFetch(() => ({ status: 502, body: "<html>bad gateway</html>" })).f });
  await assert.rejects(() => html.catalog(), (e: unknown) => e instanceof AccessApiError && e.status === 502 && /服务器出错/.test(e.message));
});

const param = (over: Partial<ParamDto>): ParamDto => ({ key: "k", type: "string", label: "名称", hint: "", group: "", secret: false, public: false, builtin: true, orphan: false, value: "", defaultValue: "", overridden: false, hasValue: true, invalid: null, updatedAt: null, updatedBy: null, ...over });

test("参数：按类型解析草稿（同服务端校验），密钥不显示原值，分组顺序", () => {
  const days = param({ type: "number", label: "回收天数", min: 1, max: 365, integer: true, value: 30 });
  assert.deepEqual(paramDraft(days), { text: "30", on: false });
  assert.equal(parseParamDraft(days, { text: "45", on: false }), 45);
  assert.throws(() => parseParamDraft(days, { text: "999", on: false }), /不能大于 365/);
  assert.throws(() => parseParamDraft(days, { text: "1.5", on: false }), /整数/);
  assert.throws(() => parseParamDraft(days, { text: "abc", on: false }), /不是数字/);
  assert.deepEqual(parseParamDraft(param({ type: "json", label: "公告" }), { text: '{"show":true}', on: false }), { show: true });
  assert.throws(() => parseParamDraft(param({ type: "json", label: "公告" }), { text: "{", on: false }), /JSON 格式不对/);
  assert.throws(() => parseParamDraft(param({ type: "enum", label: "阶段", options: ["new"] }), { text: "x", on: false }), /选项/);
  assert.equal(parseParamDraft(param({ type: "boolean" }), { text: "", on: true }), true);
  const secret = param({ secret: true, label: "密钥", value: null, hasValue: true });
  assert.deepEqual(paramDraft(secret), { text: "", on: false }, "密钥编辑框不带原值");
  assert.throws(() => parseParamDraft(secret, { text: "", on: false }), /整体替换/);
  assert.equal(paramValueText(secret, null), "已设置（隐藏）");
  assert.equal(paramChange(secret, "sk-1")[0]!.to, "新值（隐藏）");
  assert.equal(paramValueText(param({ type: "enum", optionLabels: { new: "新建" } }), "new"), "新建");
  assert.equal(paramValueText(param({ type: "boolean" }), false), "关");
  assert.deepEqual(groupParams([param({ key: "a", group: "基本" }), param({ key: "b", group: "公海" }), param({ key: "c", group: "基本" })]).map((p) => p.key), ["a", "c", "b"]);
});

test("字典 / 参数的键：和 peizhi 同一套规则；createPeizhiApi 路径", async () => {
  assert.equal(checkDictCode("customer_level"), null);
  assert.match(checkDictCode("Customer")!, /小写/);
  assert.equal(checkParamKey("crm.pool.days"), null);
  assert.match(checkParamKey("1abc")!, /字母开头/);
  assert.match(checkItemValue("a b")!, /空格/);
  const { f, calls } = fakeFetch(() => ({ status: 200, body: {} }));
  const api = createPeizhiApi({ baseUrl: "/api/peizhi", fetch: f, historyUrl: "/api/peizhi-history" });
  await api.updateDictItem("customer_level", "a/b", { label: "A" });
  await api.setParam("crm.pool.days", 45);
  await api.history!({ kind: "param", target: "crm.sms.apiKey" });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ["PATCH /api/peizhi/dicts/customer_level/items/a%2Fb", "PUT /api/peizhi/params/crm.pool.days", "GET /api/peizhi-history?kind=param&target=crm.sms.apiKey"]);
  assert.deepEqual(JSON.parse(calls[1]!.body!), { value: 45 });
  assert.equal(createPeizhiApi({ baseUrl: "/x" }).history, undefined, "没有改动记录接口就不显示改动记录");
});

test("assignmentActions：锁定的分配不给取消 / 改期限，显示宿主给的原因；没锁的按能不能管", () => {
  assert.deepEqual(assignmentActions({ locked: { reason: "由运维平台角色决定" } }, true), { unassign: false, renew: false, lockedReason: "由运维平台角色决定", blockedReason: null });
  assert.deepEqual(assignmentActions({ locked: { reason: "" } }, true).lockedReason, "由系统决定");
  assert.deepEqual(assignmentActions({}, true), { unassign: true, renew: true, lockedReason: null, blockedReason: null });
  assert.deepEqual(assignmentActions({}, false), { unassign: false, renew: false, lockedReason: null, blockedReason: null });
  assert.equal(errorView({ status: 409, code: "LOCKED", message: "这条分配是锁定的" }).title, "已锁定，不能在这里改");
});

test("quanxian 2.2 维度：范围文字（我的业务线 / 指定值 / 含没填的）、规范形与比较、分配范围文字、行键", async () => {
  const { describeScope, describeDims, describeAssignScope, normalizeScope, sameScope, validateScope, assignKey, sameAssignScope } = await import("../src/access/matrix-core.ts");
  const names = { dim: (d: string) => ({ line: "业务线" })[d] ?? d, value: (_d: string, v: string) => ({ A: "A 线", B: "B 线" })[v] ?? v };
  assert.equal(describeScope({ tier: "dept", dims: { line: { mine: true } } }, undefined, names), "本部门 ∩ 我的业务线");
  assert.equal(describeScope({ tier: "all", dims: { line: { values: ["B", "A"], includeNull: true } } }, undefined, names), "全部 ∩ 业务线：B 线、A 线（含没填的）");
  assert.equal(describeDims({ line: { includeNull: true } }), "line为空的");
  assert.equal(describeScope({ tier: "own" }), "仅本人", "没有维度过滤：和以前一样");
  assert.deepEqual(normalizeScope({ tier: "dept", dims: { line: { values: ["B", "A", "B"] }, region: {} } }), { tier: "dept", dims: { line: { values: ["A", "B"] } } }, "空过滤去掉、值去重排序");
  assert.ok(sameScope({ tier: "dept", dims: { line: { values: ["A", "B"] } } }, { tier: "dept", dims: { line: { values: ["B", "A"] } } }));
  assert.ok(!sameScope({ tier: "dept" }, { tier: "dept", dims: { line: { mine: true } } }));
  assert.match(validateScope({ tier: "dept", dims: { line: { values: [] } } }) ?? "", /至少选一个/);
  assert.equal(describeAssignScope(null), "不限");
  assert.equal(describeAssignScope({ dim: "line", value: "A", deptId: "d1" }, { ...names, dept: (id) => ({ d1: "一部" })[id] ?? id }), "仅业务线「A 线」 · 部门「一部」");
  assert.notEqual(assignKey({ roleId: "r", scope: { dim: "line", value: "A" } }), assignKey({ roleId: "r" }));
  assert.ok(sameAssignScope(undefined, {}) && !sameAssignScope({ deptId: "d1" }, {}));
});

test("createAccessApi（2.2）：维度接口路径、取消带范围的分配把范围放进查询参数", async () => {
  const { f, calls } = fakeFetch(() => ({ status: 200, body: {} }));
  const api = createAccessApi({ baseUrl: "/api/qx", fetch: f });
  await api.listDims!();
  await api.createDimValue!("line", { name: "A 线" });
  await api.updateDimValue!("line", "A/1", { name: "A", version: 2 });
  await api.deleteDimValue!("line", "A");
  await api.setUserDims!("u1", "line", [{ value: "A", primary: true }]);
  await api.unassign({ subject: { type: "user", id: "u1" }, roleId: "mgr", scope: { dim: "line", value: "A" } });
  await api.assign({ subject: { type: "user", id: "u1" }, roleId: "mgr", scope: { deptId: "d1" } });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
    "GET /api/qx/dims",
    "POST /api/qx/dims/line/values",
    "PATCH /api/qx/dims/line/values/A%2F1",
    "DELETE /api/qx/dims/line/values/A",
    "PUT /api/qx/users/u1/dims/line",
    "DELETE /api/qx/assignments?subjectType=user&subjectId=u1&roleId=mgr&scopeDim=line&scopeValue=A",
    "POST /api/qx/assignments",
  ]);
  assert.deepEqual(JSON.parse(calls[4]!.body!), { values: [{ value: "A", primary: true }] });
  assert.deepEqual(JSON.parse(calls[6]!.body!).scope, { deptId: "d1" });
});

test("snapshotHolds (quanxian 2.2): codes held only in some line don't count by default; anywhere for menus; per place for actions", () => {
  const snap = { superuser: false, codes: ["customer:view", "qx:assign.manage"], contexts: [{ within: { dims: { line: "A" } }, codes: ["pool:assign", "customer:phone"] }, { within: { deptId: "d1" }, codes: ["pay:audit"] }] };
  assert.equal(snapshotHolds(snap, "customer:view"), true);
  assert.equal(snapshotHolds(snap, "pool:assign"), false, "default: not held");
  assert.equal(snapshotHolds(snap, "pool:assign", "anywhere"), true);
  assert.equal(snapshotHolds(snap, "pool:assign", { dims: { line: "A" } }), true);
  assert.equal(snapshotHolds(snap, "pool:assign", { dims: { line: "B" } }), false);
  assert.equal(snapshotHolds(snap, "pool:assign", {}), false);
  assert.equal(snapshotHolds(snap, "pay:audit", { deptId: "d1" }), true);
  assert.equal(snapshotHolds(snap, "pay:audit", { deptId: "d2" }), false);
  assert.equal(snapshotHolds(snap, "pay:audit", { dims: JSON.parse('{"__proto__":{"line":"A"}}') }), false);
  assert.equal(snapshotHolds({ superuser: true, codes: [] }, "anything"), true);
  assert.equal(snapshotHolds(null, "customer:view", "anywhere"), false);
  // withinScope management codes stay in `codes`: the console shows the scoped manager's sections
  assert.deepEqual(consoleRights(snap).sections.includes("people"), true);
});

test("effectiveScopeLines (quanxian 2.2): one line per scoped source — never the widest tier next to all places", () => {
  const A = { dim: "line", value: "A", label: "业务线「A 线」" };
  const B = { dim: "line", value: "B", label: "业务线「B 线」" };
  const row = { allowed: true, scope: { tier: "dept_tree" as const, includeUnassigned: true }, within: [A, B], sources: [{ kind: "role" as const, label: "在业务线「A 线」担任「经理」", scope: { tier: "dept_tree" as const, includeUnassigned: true }, within: A }, { kind: "role" as const, label: "在业务线「B 线」担任「销售」", scope: { tier: "own" as const }, within: B }] };
  const lines = effectiveScopeLines(row);
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /^本部门及以下.*（仅在业务线「A 线」）$/);
  assert.equal(lines[1], "仅本人（仅在业务线「B 线」）");
  // 联系人：没有业务线字段，带业务线范围的来源不直接给 → 只跟随上级记录
  assert.deepEqual(effectiveScopeLines({ allowed: true, scope: null, sources: [{ kind: "role", label: "x", scope: null, within: A }] }), ["只跟随上级记录"]);
  assert.deepEqual(effectiveScopeLines({ allowed: true, scope: null, sources: [{ kind: "role", label: "x", scope: null, within: A, detail: "角色「经理」只在业务线「A」上分配给他；这类记录上没有业务线，这条分配在这里不直接给数据，只跟随所属的客户" }] }), ["只跟随所属的客户"]);
  assert.deepEqual(effectiveScopeLines({ allowed: true, scope: { tier: "all" }, sources: [] }), [describeScope({ tier: "all" })]);
});

test("assignPlaceOptions (quanxian 2.2): only the person's values; a scoped editor only their own places and no 不限", () => {
  const dims = [{ id: "line", label: "业务线", values: [{ id: "A", name: "A 线" }, { id: "B", name: "B 线" }, { id: "C", name: "C 线", disabled: true }] }];
  assert.deepEqual(assignPlaceOptions(dims), { values: [{ dim: "line", value: "A", label: "A 线" }, { dim: "line", value: "B", label: "B 线" }], allowAny: true });
  assert.deepEqual(assignPlaceOptions(dims, { target: [{ dim: "line", value: "B" }] }).values.map((v) => v.value), ["B"]);
  const scoped = assignPlaceOptions(dims, { editor: [{ dims: { line: "A" } }] });
  assert.deepEqual([scoped.allowAny, scoped.values.map((v) => v.value)], [false, ["A"]]);
  assert.deepEqual(assignPlaceOptions(dims, { editor: [{ dims: { line: "A" } }], target: [{ dim: "line", value: "B" }] }).values, [], "he is only in B, I only manage A");
  assert.deepEqual(consoleRights({ superuser: false, codes: ["qx:assign.manage"], contexts: [{ within: { dims: { line: "A" } }, codes: ["qx:assign.manage"] }] }).assignWithin, [{ dims: { line: "A" } }]);
  assert.equal(consoleRights({ superuser: false, codes: ["qx:assign.manage"] }).assignWithin, null);
  assert.deepEqual(consoleRights({ superuser: false, codes: ["qx:org.manage"], contexts: [{ within: { dims: { line: "A" } }, codes: ["qx:org.manage"] }] }).orgWithin, [{ dims: { line: "A" } }]);
  assert.equal(consoleRights({ superuser: true, codes: [], contexts: [{ within: { dims: { line: "A" } }, codes: ["qx:org.manage"] }] }).orgWithin, null);
});

// ── 6.5.0 审计修复（2026-10-04） ──

test("角色保存带回字段的按行条件：字段还在就原样带回，去掉的列进改动清单（审计 1）", () => {
  const saved = role({
    permissions: { grants: {}, fields: { "customer.phone": { read: true, write: false, export: false, mask: false }, "customer.amount": { read: true, write: false, export: false, mask: false } } },
    fieldConds: { "customer.phone": { field: "status", op: "eq", value: "vip" }, "customer.amount": { field: "owner", op: "eq", value: { ref: "userId" } } },
  });
  // 字段都还在：两个条件都带回
  const same = roleSaveBody(saved, matrixOf(saved));
  assert.deepEqual(same.fieldConds, saved.fieldConds);
  assert.deepEqual(same.permissions, matrixOf(saved));
  // 草稿里没有 amount 了：它的条件不再发（服务端会拒绝多出来的键），并在清单里说「去掉」
  const draft = { grants: {}, fields: { "customer.phone": { read: true, write: true, export: false, mask: false } } };
  assert.deepEqual(roleSaveBody(saved, draft).fieldConds, { "customer.phone": saved.fieldConds!["customer.phone"] });
  const items = fieldCondChangeItems(saved, draft, CATALOG.resources);
  assert.equal(items.length, 2);
  assert.deepEqual(items.find((x) => x.to === "去掉"), { label: "客户 · 字段「amount」的按行条件", from: "owner 等于 当前用户", to: "去掉", effect: "这个字段不再单独配置" });
  // phone 的读写改了：清单说明条件保留
  assert.deepEqual(items.find((x) => x.label.includes("手机号")), { label: "客户 · 字段「手机号」的按行条件", from: "status 等于 「vip」", to: "保留", effect: "仍只对满足条件的记录生效" });
  // 没改到带条件的字段：清单里不出现
  assert.deepEqual(fieldCondChangeItems(saved, matrixOf(saved), CATALOG.resources), []);
  // 没有条件的角色：fieldConds 发空对象，清单为空
  const plain = role();
  assert.deepEqual(roleSaveBody(plain, matrixOf(plain)).fieldConds, {});
  assert.deepEqual(fieldCondChangeItems(plain, matrixOf(plain), CATALOG.resources), []);
});

test("只在某条业务线管人：个人加减不能改、组织结构不能改、超管才能挪部门 / 任免负责人（审计 2、4）", () => {
  const liu = consoleRights({ superuser: false, codes: ["qx:org.view", "qx:role.view", "qx:assign.manage", "qx:explain"], contexts: [{ within: { dims: { line: "A" } }, codes: ["qx:org.view", "qx:role.view", "qx:assign.manage", "qx:explain"] }] });
  assert.equal(liu.assign, true);
  assert.equal(liu.overrides, false, "服务端对只在某处持有的人一律拒绝个人加减");
  assert.equal(liu.superuser, false);
  const mgr = consoleRights({ superuser: false, codes: ["qx:org.manage", "qx:assign.manage"] });
  assert.equal(mgr.overrides, true);
  assert.equal(mgr.orgStructure, true);
  const scopedOrg = consoleRights({ superuser: false, codes: ["qx:org.manage"], contexts: [{ within: { dims: { line: "A" } }, codes: ["qx:org.manage"] }] });
  assert.equal(scopedOrg.org.manage, true);
  assert.equal(scopedOrg.orgStructure, false, "部门 / 岗位 / 业务线值要不带范围的组织管理");
  const boss = consoleRights({ superuser: true, codes: [] });
  assert.deepEqual([boss.superuser, boss.overrides, boss.orgStructure], [true, true, true]);
});

test("分配的行操作看编辑人自己的范围：范围外的灰掉并说明原因（审计 3）", () => {
  const names = { dim: (id: string) => (id === "line" ? "业务线" : id), value: (_d: string, v: string) => `${v} 产品线`, dept: (id: string) => deptIndex(DEPTS).name(id) };
  const lineA = { within: [{ dims: { line: "A" } }], names };
  assert.deepEqual(assignmentActions({ scope: { dim: "line", value: "A" } }, true, lineA), { unassign: true, renew: true, lockedReason: null, blockedReason: null });
  const anywhere = assignmentActions({}, true, lineA);
  assert.deepEqual([anywhere.unassign, anywhere.renew], [false, false]);
  assert.equal(anywhere.blockedReason, "你只能管业务线「A 产品线」上的分配，这条不限范围，请找管理员");
  assert.equal(assignmentActions({ scope: { dim: "line", value: "B" } }, true, lineA).blockedReason, "你只能管业务线「A 产品线」上的分配，这条在业务线「B 产品线」，请找管理员");
  // 不能管 = 什么都不给，也不解释；锁定的照旧
  assert.deepEqual(assignmentActions({ scope: { dim: "line", value: "B" } }, false, lineA), { unassign: false, renew: false, lockedReason: null, blockedReason: null });
  assert.equal(assignmentActions({ locked: { reason: "跟着账号走" } }, true, lineA).lockedReason, "跟着账号走");
  // 部门范围：分配的部门要在编辑人的部门树里；给岗位 / 部门的分配，那个岗位 / 部门也要在里面
  const sh = { within: [{ deptId: "sh" }], subtree: deptIndex(DEPTS).subtree, names };
  assert.equal(assignmentActions({ scope: { deptId: "sh1" } }, true, sh).unassign, true);
  assert.equal(assignmentActions({ scope: { deptId: "south" } }, true, sh).unassign, false);
  assert.equal(assignmentActions({ scope: { deptId: "sh1" } }, true, { ...sh, subjectDept: "sh2" }).unassign, true);
  assert.equal(assignmentActions({ scope: { deptId: "sh1" } }, true, { ...sh, subjectDept: "south" }).unassign, false);
  // 不带范围持有（within null）= 不限
  assert.equal(assignmentActions({}, true, { within: null }).unassign, true);
});

test("自己：不是超管就不给改自己的东西（审计 5）", () => {
  assert.equal(editsSelf({ userId: "mgr", superuser: false }, "mgr"), true);
  assert.equal(editsSelf({ userId: "mgr", superuser: false }, "rep_a"), false);
  assert.equal(editsSelf({ userId: "boss", superuser: true }, "boss"), false);
});

test("列表加载失败：没有权限不给重试，说人话（审计 6）", () => {
  const f = listFailure(new AccessApiError(403, { code: "FORBIDDEN", message: "你只在业务线「A 产品线」上有「角色 · 查看角色 / 分配」，这个人不在你管的范围里", permission: "qx:role.view" }));
  assert.equal(f.forbidden, true);
  assert.equal(f.retry, false);
  assert.match(f.message, /不在你管的范围里/);
  const net = listFailure(new AccessApiError(0, { code: "NETWORK", message: "连不上服务器" }));
  assert.deepEqual([net.forbidden, net.retry], [false, true]);
  assert.equal(listFailure(new Error("超时")).retry, true);
});

test("逐个添加：报告加上的和没加上的（审计 7）", async () => {
  const r = await addEach(["张三", "李四", "王五"], async (x) => {
    if (x === "李四") throw new AccessApiError(403, { code: "FORBIDDEN", message: "不能授出编辑者" });
  }, (x) => x);
  assert.deepEqual(r.added, ["张三", "王五"]);
  assert.deepEqual(r.failed, [{ name: "李四", message: "没有权限：不能授出编辑者" }]);
  assert.equal(addEachText(r), "已添加：张三、王五。没加上：李四（没有权限：不能授出编辑者）");
  assert.equal(addEachText({ added: [], failed: [{ name: "李四", message: "x" }] }), "没加上：李四（x）");
  assert.equal(addEachText({ added: ["张三"], failed: [] }), null);
});

test("人话：审计动作 / 对象、个人加减的权限名、视角预览的数据范围（审计 8）", () => {
  assert.equal(auditActionLabel("user.dims", "业务线"), "调整业务线");
  assert.equal(auditActionLabel("user.dims"), "调整维度归属");
  assert.equal(auditActionLabel("dim.create", "业务线"), "新建业务线");
  assert.equal(auditActionLabel("dim.update", "业务线"), "修改业务线");
  assert.equal(auditActionLabel("dim.delete", "业务线"), "删除业务线");
  assert.equal(auditActionLabel("request.approve"), "批准申请");
  assert.equal(auditTargetLabel("dim:line", "业务线"), "业务线");
  assert.equal(auditTargetLabel("dim:line"), "维度值");
  assert.equal(auditEventDim({ action: "dim.create", targetType: "dim:line", before: null, after: null }), "line");
  assert.equal(auditEventDim({ action: "user.dims", targetType: "user", before: null, after: { dim: "line", values: [] } }), "line");
  assert.equal(auditEventDim({ action: "role.update", targetType: "role", before: null, after: null }), null);
  // 个人加减：标签已经以分组开头时不再重复
  assert.deepEqual(codeOptions(CATALOG).map((o) => o.label), ["客户 · 查看（自己名下的）"]);
  assert.deepEqual(codeOptions({ ...CATALOG, codes: [{ code: "pool:claim", label: "领取", group: "公海", risk: "normal", grantable: true, adminOnly: false }] }).map((o) => o.label), ["公海 · 领取"]);
  // 预览的数据范围：资源 / 动作用目录里的名字
  assert.equal(scopeKeyLabel("customer", CATALOG), "客户");
  assert.equal(scopeKeyLabel("customer.view", CATALOG), "客户 · 查看");
  assert.equal(scopeKeyLabel("customer:export", CATALOG), "客户 · 导出");
  assert.equal(scopeKeyLabel("unknown.x", CATALOG), "unknown.x");
});

test("停用业务线值：确认里说清多少人、多少条只在这里的分配不再算（审计 9）", () => {
  const a = (id: string, scope?: { dim: string; value: string }, type: "user" | "post" = "user") => ({ subject: { type, id }, roleId: "r", grantedBy: null, grantedAt: "", expiresAt: null, reason: "", expired: false, ...(scope ? { scope } : {}) });
  const list = [a("a", { dim: "line", value: "A" }), a("p", { dim: "line", value: "A" }, "post"), a("b", { dim: "line", value: "B" }), a("c")];
  const dim = { id: "line", label: "业务线" };
  assert.equal(dimValueDisableImpact(dim, { id: "A", name: "A 产品线", members: 3 }, list), "停用业务线「A 产品线」：里面的 3 人不再算在这个业务线里，2 条「只在 A 产品线」的角色分配也不再生效。人和分配都不删，重新启用后恢复。");
  assert.equal(dimValueDisableImpact(dim, { id: "C", name: "C 产品线", members: 0 }, list), "停用业务线「C 产品线」：现在没有人在里面，也没有只在这里的角色分配。重新启用后恢复。");
  assert.equal(dimValueDisableImpact(dim, { id: "A", name: "A 产品线", members: 3 }, null), "停用业务线「A 产品线」：里面的 3 人不再算在这个业务线里，「只在 A 产品线」的角色分配也不再生效。人和分配都不删，重新启用后恢复。");
});

// ── quanxian 2.2.1 能力字段（2026-10-04 复审二） ──

test("assignmentActions 用服务端给的 editable：没给才退回按编辑人范围算（2.2.1-A）", () => {
  const lineA = { within: [{ dims: { line: "A" } }] };
  // 服务端说能取消不能改期限：照它
  assert.deepEqual(assignmentActions({ editable: { unassign: true, changeExpiry: false, reason: "到期时间只能改短" } }, true, lineA), { unassign: true, renew: false, lockedReason: null, blockedReason: "到期时间只能改短" });
  // 服务端说都不行：原因用它那句话（不再用页面自己算的）
  assert.equal(assignmentActions({ editable: { unassign: false, changeExpiry: false, reason: "不能改自己的账号和权限，请找管理员" } }, true, lineA).blockedReason, "不能改自己的账号和权限，请找管理员");
  // 服务端说都行：不带范围也行（页面不再自己挡）
  assert.deepEqual(assignmentActions({ editable: { unassign: true, changeExpiry: true } }, true, lineA), { unassign: true, renew: true, lockedReason: null, blockedReason: null });
  // 不行又没给原因：给一句通用的
  assert.equal(assignmentActions({ editable: { unassign: false, changeExpiry: false } }, true).blockedReason, "你不能改这条分配");
  // 不能管（没有授权码 / 只读）照旧什么都不给；锁定的照旧
  assert.deepEqual(assignmentActions({ editable: { unassign: true, changeExpiry: true } }, false), { unassign: false, renew: false, lockedReason: null, blockedReason: null });
  assert.equal(assignmentActions({ locked: { reason: "跟着账号走" }, editable: { unassign: false, changeExpiry: false, reason: "锁定" } }, true).lockedReason, "跟着账号走");
});

test("分配角色按钮看 canAssign：不行就灰掉并写原因，没给就照旧（2.2.1-B）", () => {
  assert.deepEqual(assignButton(true, { ok: false, reason: "你自己在这个部门里" }), { show: true, disabledReason: "你自己在这个部门里" });
  assert.deepEqual(assignButton(true, { ok: false }), { show: true, disabledReason: "你不能给它分配角色" });
  assert.deepEqual(assignButton(true, { ok: true }), { show: true, disabledReason: null });
  assert.deepEqual(assignButton(true, undefined), { show: true, disabledReason: null });
  assert.deepEqual(assignButton(false, { ok: true }), { show: false, disabledReason: null });
});

test("错误说人话：字段编码换成中文名、500 INTERNAL 统一说服务器出错（2.2.1-C）", () => {
  const v = errorView(new AccessApiError(400, { code: "INVALID", message: "reason 不能为空", field: "reason" }));
  assert.equal(v.message, "原因不能为空");
  assert.equal(errorLine(new AccessApiError(400, { code: "INVALID", message: "expiresAt 不是合法时间", field: "expiresAt" })), "到期时间不是合法时间");
  assert.doesNotMatch(errorView(new AccessApiError(400, { code: "INVALID", message: "scope.value 不在列表里", field: "scope.value" })).message, /scope\.value/);
  const internal = errorView(new AccessApiError(500, { code: "INTERNAL", message: "服务器内部错误", traceId: "req-9" }));
  assert.equal(internal.title, "服务器出错");
  assert.match(internal.message, /稍后再试/);
  assert.match(internal.message, /req-9/);
});

test("数据范围带维度过滤：服务端的人话优先；视角预览按 scopeDims 写「∩ 我的业务线」（2.2.1）", () => {
  assert.equal(describeScope({ tier: "all", dims: { line: { mine: true } }, label: "全部 ∩ 我的业务线（B 产品线）" }), "全部 ∩ 我的业务线（B 产品线）");
  const names = { dim: (id: string) => (id === "line" ? "业务线" : id) };
  assert.deepEqual(snapshotScopeLines({ scopes: { "customer.view": "all", "contact.view": "none" }, scopeDims: { "customer.view": { line: { mine: true } } } }, CATALOG, names), ["客户 · 查看：全部 ∩ 我的业务线", "contact.view：无"]);
});
