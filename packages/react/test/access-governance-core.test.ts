import test from "node:test";
import assert from "node:assert/strict";
import type { AccessRequestDto, ApprovalStepState, CondFieldDef, HealthItem, ReviewCampaignDto, RuleImpactDto } from "../src/access/governance/contracts.ts";
import { createGovernanceApi, GovernanceApiError, govErrorMessage, govQuery, parseGovError } from "../src/access/governance/api.ts";
import { condDraftToTree, condLabelsFrom, condToDraft, condToText, countDraftRows, draftKey, draftToCond, retypeRow, splitList, treeToCondDraft, validateCond, type CondDraft } from "../src/access/governance/cond-core.ts";
import {
  actionNoteError,
  campaignCloseImpact,
  campaignDeadline,
  campaignProgress,
  campaignScopeText,
  chainProgressText,
  chainSteps,
  emergencyCountdown,
  govRequestActions,
  moveStep,
  needsPostReview,
  reviewHint,
  stepsText,
  toReviewItem,
  validateCampaign,
  validateEmergency,
  validateEmergencyReview,
  validatePolicy,
  validateRequestInput,
} from "../src/access/governance/request-core.ts";
import {
  effectiveQuotas,
  governanceCan,
  governanceSections,
  groupHealth,
  healthSummary,
  impactRows,
  impactSummary,
  impactTone,
  parseLines,
  parseQuotaRows,
  quotaAlerts,
  quotaState,
  rlsSummary,
  tenantDeleteConfirmed,
  validatePackage,
  validateTenantCreate,
} from "../src/access/governance/governance-core.ts";

// ---- API client -----------------------------------------------------------------------------

type Call = { url: string; method: string; body: unknown; headers: Record<string, string>; credentials?: string };
function fakeFetch(reply: (call: Call) => { status?: number; body?: unknown; text?: string } | Error) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: (init?.headers ?? {}) as Record<string, string>, credentials: init?.credentials };
    calls.push(call);
    const r = reply(call);
    if (r instanceof Error) throw r;
    const text = r.text ?? (r.body === undefined ? "" : JSON.stringify(r.body));
    return new Response(text || null, { status: r.status ?? 200 });
  }) as typeof fetch;
  return { fn, calls };
}

test("API 客户端：路径、方法、请求体、查询串、同源 cookie 都按合同发", async () => {
  const { fn, calls } = fakeFetch(() => ({ body: { ok: true } }));
  const api = createGovernanceApi({ baseUrl: "/admin/qx/", fetch: fn, headers: { "x-csrf": "t" } });
  await api.tenant();
  await api.members.remove("u 1", "离职");
  await api.requests.list({ view: "todo", status: "pending", kind: "emergency" });
  await api.requests.reject("r1", "预算不足");
  await api.requests.approve("r1");
  await api.shareRules.preview({ id: "s1", delete: true });
  await api.restrictionRules.update("x/1", { resourceType: "customer", label: "冻结", cond: { field: "status", op: "eq", value: "frozen" }, version: 3 });
  await api.reviews.items("c1", { mine: true });
  await api.reviews.decide("c1", "i1", { decision: "revoke", note: "转岗" });
  await api.emergency.end("e1");
  await api.platform.tenants.remove("acme", { confirm: "acme", reason: "合同结束" });
  await api.platform.viewAs({ tenantId: "acme", userId: "u1", reason: "排查" });
  const sig = calls.map((c) => `${c.method} ${c.url}`);
  assert.deepEqual(sig, [
    "GET /admin/qx/tenant",
    "DELETE /admin/qx/members/u%201?reason=%E7%A6%BB%E8%81%8C",
    "GET /admin/qx/requests?view=todo&status=pending&kind=emergency",
    "POST /admin/qx/requests/r1/reject",
    "POST /admin/qx/requests/r1/approve",
    "POST /admin/qx/rules/share/preview",
    "PATCH /admin/qx/rules/restrictions/x%2F1",
    "GET /admin/qx/reviews/c1/items?mine=1",
    "POST /admin/qx/reviews/c1/items/i1/decide",
    "POST /admin/qx/emergency/e1/end",
    "DELETE /admin/qx/platform/tenants/acme",
    "POST /admin/qx/platform/view-as",
  ]);
  assert.deepEqual(calls[3]!.body, { note: "预算不足" });
  assert.deepEqual(calls[4]!.body, {}, "没写意见就不带 note");
  assert.deepEqual(calls[10]!.body, { confirm: "acme", reason: "合同结束" }, "删租户的确认和原因在请求体里");
  assert.equal(calls[0]!.headers["x-csrf"], "t");
  assert.equal(calls[0]!.headers["content-type"], undefined, "GET 不带 content-type");
  assert.equal(calls[3]!.headers["content-type"], "application/json");
  assert.equal(calls[0]!.credentials, "same-origin");
});

test("API 客户端：服务端错误带 code / message / field；204 返回 undefined；网络错误 / 非 JSON 也给中文", async () => {
  const { fn } = fakeFetch((c) =>
    c.url.endsWith("/members")
      ? { status: 409, body: { code: "QUOTA_EXCEEDED", message: "成员数已达上限", field: "userId" } }
      : c.url.endsWith("/tenant")
        ? { status: 204 }
        : c.url.endsWith("/health")
          ? { status: 502, text: "<html>Bad gateway</html>" }
          : new TypeError("fetch failed"),
  );
  const api = createGovernanceApi({ fetch: fn });
  await assert.rejects(api.members.add({ userId: "u1" }), (e: unknown) => e instanceof GovernanceApiError && e.code === "QUOTA_EXCEEDED" && e.status === 409 && e.field === "userId" && e.message === "成员数已达上限");
  assert.equal(await api.tenant(), undefined);
  await assert.rejects(api.health(), (e: unknown) => e instanceof GovernanceApiError && e.code === "HTTP_502" && /请稍后重试/.test(e.message));
  await assert.rejects(api.reviews.list(), (e: unknown) => e instanceof GovernanceApiError && e.code === "NETWORK");
  const aborted = new AbortController();
  aborted.abort();
  const { fn: abortFetch } = fakeFetch(() => Object.assign(new Error("aborted"), { name: "AbortError" }));
  await assert.rejects(createGovernanceApi({ fetch: abortFetch }).tenant({ signal: aborted.signal }), (e: unknown) => (e as Error).name === "AbortError", "取消不包装成网络错误");
});

test("查询串与错误文案辅助", () => {
  assert.equal(govQuery({ a: "1", b: undefined, c: "", d: false, e: true, f: 0 }), "?a=1&e=1&f=0");
  assert.equal(govQuery({}), "");
  assert.deepEqual(parseGovError(403, ""), { code: "HTTP_403", message: "没有权限执行这个操作" });
  assert.equal(parseGovError(400, JSON.stringify({ message: "名称太长" })).code, "HTTP_400");
  const err = new GovernanceApiError(400, { code: "INVALID", message: "不能为空", field: "label" });
  assert.equal(govErrorMessage(err, (f) => (f === "label" ? "规则名称" : undefined)), "规则名称：不能为空");
  assert.equal(govErrorMessage(new Error("x")), "x");
  assert.equal(govErrorMessage("??"), "操作失败，请重试");
});

// ---- Conditions ----------------------------------------------------------------------------

const FIELDS: CondFieldDef[] = [
  { id: "status", label: "状态", type: "string", options: [{ value: "vip", label: "VIP" }, { value: "frozen", label: "已冻结" }] },
  { id: "owner", label: "负责人", type: "id" },
  { id: "amount", label: "金额", type: "number" },
  { id: "name", label: "名称", type: "string" },
  { id: "closed", label: "已关闭", type: "boolean" },
  { id: "dueAt", label: "截止时间", type: "timestamp" },
];
const labels = condLabelsFrom(FIELDS);

test("条件转中文：运算、引用、枚举标签、嵌套加括号、旧写法、异常形状不抛错", () => {
  assert.equal(condToText({ field: "status", op: "eq", value: "vip" }, labels), "状态 等于 VIP");
  assert.equal(condToText({ and: [{ field: "status", op: "eq", value: "vip" }, { field: "owner", op: "eq", value: { ref: "userId" } }] }, labels), "状态 等于 VIP 且 负责人 等于 当前用户");
  assert.equal(
    condToText({ or: [{ field: "amount", op: "gte", value: 1000 }, { and: [{ field: "owner", op: "in", value: { ref: "subordinateIds" } }, { field: "closed", op: "eq", value: false }] }] }, labels),
    "金额 大于等于 「1000」 或 （负责人 属于 当前用户的下属 且 已关闭 等于 否）",
  );
  assert.equal(condToText({ field: "owner", in: ["u1", "u2"] }, labels), "负责人 属于 （「u1」、「u2」）");
  assert.equal(condToText({ field: "name", op: "like", value: "50%_" }, labels), "名称 包含 「50%_」");
  assert.equal(condToText({ field: "name", op: "like", value: "A", match: "prefix" }, labels), "名称 开头是 「A」");
  assert.equal(condToText({ not: { field: "owner", op: "isNull" } }, labels), "不满足（负责人 为空）");
  assert.equal(condToText({ all: true }), "全部记录");
  assert.equal(condToText({ exists: { rel: "customer", where: { field: "status", op: "eq", value: "vip" } } }, labels), "关联「customer」中存在满足（状态 等于 VIP）的记录");
  assert.equal(condToText({ and: [] }), "（空的「全部满足」条件）");
  assert.equal(condToText(null as never), "（无法识别的条件）");
});

test("条件结构校验：空 and / or / in 都是错误（丢了条件不能变成全部）", () => {
  assert.deepEqual(validateCond({ field: "a", op: "eq", value: 1 }), []);
  assert.equal(validateCond({ and: [] }).length, 1);
  assert.equal(validateCond({ or: [{ field: "a", op: "in", value: [] }] }).length, 1);
  assert.equal(validateCond({ field: "a", in: [] }).length, 1);
  assert.equal(validateCond({ not: { field: "", op: "isNull" } }).length, 1);
  assert.match(validateCond({ field: "a", op: "regex" as "eq", value: "x" })[0]!, /不认识的运算/);
  assert.match(validateCond({ field: "a", op: "eq", value: "" })[0]!, /缺少值/);
  assert.deepEqual(validateCond({ field: "a", op: "in", value: { ref: "deptIds" } }), [], "引用一组值不算空");
});

const row = (field: string, op: string, value = "", source = "literal") => ({ id: `${field}-${op}-${value}`, field, op, source, value }) as CondDraft["rows"][number];

test("条件构造器 → Cond：一行就是原子条件，多行按且 / 或连接；类型解析与引用", () => {
  const one = draftToCond({ join: "and", rows: [row("status", "eq", "vip")] }, FIELDS);
  assert.deepEqual(one, { ok: true, cond: { field: "status", op: "eq", value: "vip" } });
  const many = draftToCond({ join: "or", rows: [row("amount", "gt", "1000.5"), row("owner", "eq", "", "userId"), row("closed", "eq", "false"), row("owner", "in", "", "subordinateIds"), row("name", "nin", "a，b、 c")] }, FIELDS);
  assert.deepEqual(many, {
    ok: true,
    cond: {
      or: [
        { field: "amount", op: "gt", value: 1000.5 },
        { field: "owner", op: "eq", value: { ref: "userId" } },
        { field: "closed", op: "eq", value: false },
        { field: "owner", op: "in", value: { ref: "subordinateIds" } },
        { field: "name", op: "nin", value: ["a", "b", "c"] },
      ],
    },
  });
  const like = draftToCond({ join: "and", rows: [row("name", "like", " 50%_x ")] }, FIELDS);
  assert.deepEqual(like, { ok: true, cond: { field: "name", op: "like", value: "50%_x" } }, "like 按原文，不把 % _ 当通配");
  const ts = draftToCond({ join: "and", rows: [row("dueAt", "lt", "2026-10-01T08:00:00Z")] }, FIELDS);
  assert.deepEqual(ts, { ok: true, cond: { field: "dueAt", op: "lt", value: "2026-10-01T08:00:00.000Z" } });
  assert.deepEqual(draftToCond({ join: "and", rows: [row("owner", "isNull")] }, FIELDS), { ok: true, cond: { field: "owner", op: "isNull" } });
});

test("条件构造器校验：空条件、缺值、空列表、类型不对、运算不允许、引用和运算不配", () => {
  const empty = draftToCond({ join: "and", rows: [] }, FIELDS);
  assert.equal(empty.ok, false);
  assert.match(!empty.ok ? (empty.error ?? "") : "", /至少写一个条件/);
  const bad = draftToCond(
    {
      join: "and",
      rows: [row("status", "eq", "  "), row("name", "in", " , ，"), row("amount", "gt", "12元"), row("closed", "lt", "true"), row("owner", "eq", "", "deptIds"), row("owner", "in", "", "userId"), row("ghost", "eq", "1"), row("closed", "eq", "也许")],
    },
    FIELDS,
  );
  assert.equal(bad.ok, false);
  const msgs = !bad.ok ? bad.rows : {};
  assert.equal(Object.keys(msgs).length, 8, JSON.stringify(msgs));
  assert.match(msgs["status-eq-  "]!, /请填写值/);
  assert.match(msgs["name-in- , ，"]!, /至少填一个值/);
  assert.match(msgs["amount-gt-12元"]!, /要填数字/);
  assert.match(msgs["closed-lt-true"]!, /不能用/);
  assert.match(msgs["owner-eq-"]!, /一组值/);
  assert.match(msgs["owner-in-"]!, /一组值比较/);
  assert.match(msgs["ghost-eq-1"]!, /请选择字段/);
  assert.match(msgs["closed-eq-也许"]!, /是.*否/);
});

test("Cond → 构造器：单条 / 一层且或可编辑，复杂的返回 null；往返一致；草稿键忽略行 id", () => {
  const cond = { and: [{ field: "status", op: "in", value: ["vip", "frozen"] }, { field: "owner", op: "eq", value: { ref: "userId" } }] } as const;
  const draft = condToDraft(cond)!;
  assert.equal(draft.join, "and");
  assert.deepEqual(draft.rows.map((r) => [r.field, r.op, r.source, r.value]), [["status", "in", "literal", "vip, frozen"], ["owner", "eq", "userId", ""]]);
  assert.deepEqual(draftToCond(draft, FIELDS), { ok: true, cond });
  // bt/builders-a P1: nested and / or are editable now (条件组).
  assert.deepEqual(condToDraft({ and: [{ or: [{ field: "a", op: "isNull" }] }] })!.groups!.map((g) => [g.join, g.rows.length]), [["or", 1]], "嵌套变成条件组");
  assert.equal(condToDraft({ and: [{ or: [{ not: { field: "a", op: "isNull" } }] }] }), null, "条件组里有构造器不支持的，整体只读");
  assert.equal(condToDraft({ not: { field: "a", op: "isNull" } }), null);
  assert.equal(condToDraft({ field: "name", op: "like", value: "a", match: "prefix" }), null, "开头是 / 结尾是 构造器不支持");
  assert.deepEqual(condToDraft({ field: "owner", in: ["u1"] })!.rows[0]!.op, "in", "旧写法变成 属于");
  const again = condToDraft(cond)!;
  assert.equal(draftKey(again), draftKey(draft));
  assert.notEqual(draftKey({ ...draft, join: "or" }), draftKey(draft));
  assert.deepEqual(splitList("a, b，c、\nd ,"), ["a", "b", "c", "d"]);
});

test("换字段时运算 / 值来源 / 枚举值自动收敛到新类型能用的", () => {
  const r = row("owner", "in", "x", "deptIds");
  const toNumber = retypeRow(r, FIELDS, "amount");
  assert.equal(toNumber.op, "in", "数字也能用 属于");
  assert.equal(toNumber.source, "literal", "数字没有引用");
  const toBool = retypeRow(row("amount", "gt", "3"), FIELDS, "closed");
  assert.equal(toBool.op, "eq");
  const toEnum = retypeRow(row("name", "eq", "abc"), FIELDS, "status");
  assert.equal(toEnum.value, "", "不在枚举里的值清空");
});

// ---- Requests / chain / emergency / reviews ---------------------------------------------------

const step = (label: string, decision: ApprovalStepState["decision"], names: string[], extra: Partial<ApprovalStepState> = {}): ApprovalStepState => ({
  index: 0,
  label,
  candidates: names.map((n, i) => ({ id: `u${i}`, name: n })),
  decision,
  decidedBy: decision ? names[0]! : null,
  decidedAt: decision ? "2026-09-30T02:00:00Z" : null,
  note: null,
  ...extra,
});
const can = (over: Partial<AccessRequestDto["can"]> = {}): AccessRequestDto["can"] => ({ approve: false, reject: false, cancel: false, revoke: false, submit: false, review: false, ...over });

test("申请按钮：服务端 can 与状态机同时允许才出现，顺序固定", () => {
  assert.deepEqual(govRequestActions({ status: "pending", can: can({ approve: true, reject: true, cancel: true, revoke: true }) }), ["approve", "reject", "cancel"]);
  assert.deepEqual(govRequestActions({ status: "active", can: can({ approve: true, revoke: true }) }), ["revoke"]);
  assert.deepEqual(govRequestActions({ status: "draft", can: can({ submit: true, cancel: true }) }), ["submit", "cancel"]);
  assert.deepEqual(govRequestActions({ status: "rejected", can: can({ approve: true, revoke: true, cancel: true }) }), []);
  assert.deepEqual(govRequestActions({ status: "pending", can: can() }), [], "没有 can 什么都不给");
  assert.equal(actionNoteError("reject", "  "), "请填写驳回原因");
  assert.equal(actionNoteError("revoke", ""), "请填写收回原因");
  assert.equal(actionNoteError("approve", ""), null);
});

test("审批链进度：当前级 + 候选人、全部通过、驳回带原因、无需审批、草稿", () => {
  const two = [step("部门负责人", "approve", ["张三"]), step("财务总监", null, ["李四", "王五"])];
  assert.equal(chainProgressText({ status: "pending", chain: two }), "第 2 / 2 级：财务总监（待 李四、王五 审批）");
  assert.equal(chainProgressText({ status: "active", chain: [step("部门负责人", "approve", ["张三"]), step("财务总监", "approve", ["李四"])] }), "2 级审批全部通过");
  assert.equal(chainProgressText({ status: "rejected", chain: [step("部门负责人", "approve", ["张三"]), step("财务总监", "reject", ["李四"], { note: "预算不足" })] }), "第 2 级 财务总监 驳回：预算不足");
  assert.equal(chainProgressText({ status: "active", chain: [] }), "无需审批");
  assert.equal(chainProgressText({ status: "draft", chain: two.map((s) => ({ ...s, decision: null })) }), "未提交（共 2 级审批）");
  assert.equal(chainProgressText({ status: "cancelled", chain: two }), "审批到第 2 / 2 级时结束");
  assert.equal(chainProgressText({ status: "pending", chain: [], step: { current: 1, total: 2, label: "上级" } }), "第 1 / 2 级：上级");
  const states = chainSteps({ status: "pending", chain: [...two, step("CEO", null, ["赵六"])] }).map((s) => s.state);
  assert.deepEqual(states, ["approved", "current", "waiting"]);
  assert.deepEqual(chainSteps({ status: "cancelled", chain: two }).map((s) => s.state), ["approved", "skipped"]);
});

test("新申请校验：目标、记录的资源和级别、理由长度、到期在未来", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  assert.deepEqual(validateRequestInput({ target: { kind: "role", id: "fin" }, reason: "月底对账需要", expiresAt: "2026-10-08T00:00:00Z" }, now), {});
  const e = validateRequestInput({ target: { kind: "record", id: " " }, reason: "要", expiresAt: "2026-09-01T00:00:00Z" }, now);
  assert.deepEqual(Object.keys(e).sort(), ["expiresAt", "level", "reason", "resourceType", "target"]);
});

test("紧急提权：原因至少 10 个字、监督人不能是自己、时长上限；复核标异常要写意见", () => {
  const ok = { target: { kind: "role" as const, id: "dba" }, reason: "线上订单库死锁需要紧急处理", supervisorId: "u2", minutes: 60 };
  assert.deepEqual(validateEmergency(ok, "u1"), {});
  const e = validateEmergency({ ...ok, reason: "修数据", supervisorId: "u1", minutes: 600 }, "u1", 240);
  assert.match(e.reason!, /至少 10 个字（现在 3 个）/);
  assert.equal(e.supervisorId, "监督人不能是你自己");
  assert.equal(e.minutes, "最长 240 分钟");
  assert.equal(validateEmergency({ ...ok, target: { kind: "role", id: "" }, supervisorId: "" }, "u1").supervisorId, "请选择监督人");
  assert.deepEqual(validateEmergencyReview({ outcome: "ok", note: "" }), {});
  assert.ok(validateEmergencyReview({ outcome: "flagged", note: " " }).note);
});

test("紧急提权倒计时：分秒 / 时分秒、最后 5 分钟、到点、已结束、未开始", () => {
  const base = { status: "active" as const, startsAt: null, endedAt: null };
  const now = new Date("2026-10-01T10:00:00Z");
  assert.deepEqual(emergencyCountdown({ ...base, expiresAt: "2026-10-01T10:42:05Z" }, now), { state: "running", ms: 2_525_000, clock: "42:05", label: "还剩 42 分 5 秒" });
  assert.equal(emergencyCountdown({ ...base, expiresAt: "2026-10-01T11:02:03Z" }, now).clock, "1:02:03");
  assert.equal(emergencyCountdown({ ...base, expiresAt: "2026-10-01T10:04:59Z" }, now).state, "ending");
  assert.equal(emergencyCountdown({ ...base, expiresAt: "2026-10-01T09:59:59Z" }, now).state, "over");
  assert.equal(emergencyCountdown({ ...base, endedAt: "2026-10-01T09:30:00Z", expiresAt: "2026-10-01T11:00:00Z" }, now).label, "已结束");
  assert.equal(emergencyCountdown({ ...base, status: "revoked", expiresAt: "2026-10-01T11:00:00Z" }, now).state, "over");
  assert.equal(emergencyCountdown({ ...base, startsAt: "2026-10-01T10:05:00Z", expiresAt: "2026-10-01T11:00:00Z" }, now).state, "waiting");
  const dto = { kind: "emergency", can: can({ review: true }), postReview: { status: "pending", by: null, at: null, note: null } } as AccessRequestDto;
  assert.equal(needsPostReview(dto), true);
  assert.equal(needsPostReview({ ...dto, postReview: { ...dto.postReview!, status: "ok" } }), false);
});

const campaign = (over: Partial<ReviewCampaignDto> = {}): ReviewCampaignDto => ({
  id: "c1",
  tenantId: "t1",
  name: "Q4 复核",
  scope: { kind: "role", id: "fin" },
  reviewer: { kind: "users", ids: ["u1", "u2"], roleId: null },
  deadline: "2026-10-03T00:00:00Z",
  onDeadline: "revoke",
  staleDays: 90,
  status: "open",
  createdBy: "u0",
  createdAt: "2026-09-01T00:00:00Z",
  closedAt: null,
  progress: { total: 40, decided: 12, kept: 10, revoked: 2 },
  ...over,
});

test("复核活动：进度、截止状态、关闭影响、范围文字、表单校验", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  assert.deepEqual(campaignProgress(campaign()), { percent: 30, text: "已处理 12 / 40", detail: "保留 10 · 收回 2 · 未处理 28" });
  assert.deepEqual(campaignDeadline(campaign(), now), { tone: "warning", label: "还剩 2 天" });
  assert.deepEqual(campaignDeadline(campaign({ deadline: "2026-09-01T00:00:00Z" }), now), { tone: "danger", label: "已过截止" });
  assert.equal(campaignDeadline(campaign({ status: "closed" }), now).label, "已关闭");
  assert.match(campaignCloseImpact(campaign()), /还有 28 项没处理，关闭后按「自动收回」处理/);
  assert.match(campaignCloseImpact(campaign({ progress: { total: 3, decided: 3, kept: 2, revoked: 1 } })), /全部 3 项已处理/);
  const names: Record<string, string> = { fin: "财务", u1: "张三", u2: "李四" };
  const t = campaignScopeText(campaign(), (_k, id) => names[id] ?? id);
  assert.equal(t.scope, "某个角色的持有人：财务");
  assert.equal(t.reviewer, "指定人员：张三、李四");
  assert.deepEqual(validateCampaign({ name: "x", scope: { kind: "all" }, reviewer: { kind: "manager" }, deadline: "2026-10-10T00:00:00Z" }, now), {});
  const e = validateCampaign({ name: " ", scope: { kind: "dept" }, reviewer: { kind: "users", ids: [] }, deadline: "2026-09-10T00:00:00Z", staleDays: 0 }, now);
  assert.deepEqual(Object.keys(e).sort(), ["deadline", "name", "reviewerIds", "scopeId", "staleDays"]);
});

test("复核项：DTO → ReviewList 行、久未使用提示", () => {
  const dto = {
    id: "i1",
    campaignId: "c1",
    subject: { id: "u1", name: "张三" },
    grant: { kind: "role" as const, ref: "fin", label: "财务", scope: null },
    lastUsedAt: null,
    useCount: 0,
    stale: true,
    reviewer: { id: "u9", name: "郑凯" },
    decision: null,
    decidedBy: null,
    decidedAt: null,
    appliedAt: null,
  };
  const item = toReviewItem(dto);
  assert.equal(item.lastUsedAt, null);
  assert.equal(item.subject.hint, "复核人：郑凯");
  assert.equal(item.grant.label, "财务");
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(reviewHint(dto, now), "从未使用");
  assert.equal(reviewHint({ ...dto, lastUsedAt: "2026-06-01T00:00:00Z" }, now), "122 天未用");
  assert.equal(reviewHint({ ...dto, lastUsedAt: "2026-09-30T00:00:00Z", stale: false }, now), "");
});

test("审批流程：步骤文字、校验、上移下移", () => {
  const names: Record<string, string> = { fin: "财务总监", ops: "运营部", u1: "张三" };
  const label = (_k: string, id: string) => names[id] ?? id;
  assert.equal(stepsText([{ kind: "manager" }, { kind: "dept_leader", deptId: "ops" }, { kind: "role_holder", roleId: "fin" }, { kind: "user", userIds: ["u1"] }, { kind: "user", userIds: ["a", "b"] }, { kind: "resource_owner", label: "客户负责人" }], label), "直属上级 → 运营部负责人 → 财务总监持有人 → 张三 → 指定人员（2 人） → 客户负责人");
  assert.equal(stepsText([]), "无需审批");
  assert.deepEqual(validatePolicy({ label: "x", targetKind: "*", steps: [{ kind: "manager" }], maxDays: null, priority: 1 }), {});
  const e = validatePolicy({ label: "", targetKind: "role", steps: [{ kind: "role_holder" }, { kind: "user", userIds: [] }], maxDays: 0, priority: 1.5 });
  assert.deepEqual(Object.keys(e).sort(), ["label", "maxDays", "priority", "step.0", "step.1"]);
  assert.ok(validatePolicy({ label: "x", targetKind: "*", steps: [] }).steps);
  assert.deepEqual(moveStep(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(moveStep(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
  assert.deepEqual(moveStep(["a", "b"], 0, -1), ["a", "b"], "越界不动");
});

// ---- Permissions / impact / quotas / tenants / health -----------------------------------------

test("权限码 → 页面开关：manage 蕴含 view，通配，平台码；分区按权限过滤", () => {
  const c = governanceCan(["qx:member.manage", "qx:rule.view", "qx:package.manage"]);
  assert.equal(c.memberView, true);
  assert.equal(c.memberManage, true);
  assert.equal(c.ruleView, true);
  assert.equal(c.ruleManage, false);
  assert.equal(c.tenantView, true, "管套餐也能看租户");
  assert.equal(c.tenantManage, false);
  assert.equal(governanceCan(["qx:*"]).crossTenant, true);
  assert.equal(governanceCan(["*"]).emergencyUse, true);
  assert.equal(governanceCan([]).healthView, false);
  assert.deepEqual(governanceSections(governanceCan([])), ["requests", "emergency", "reviews"], "人人都能申请、复核、做监督人");
  assert.deepEqual(governanceSections(c), ["members", "requests", "emergency", "reviews", "share", "restrictions", "sod", "tenants", "packages"]);
  assert.deepEqual(governanceSections(c, ["packages", "health", "members"]), ["packages", "members"], "限定 + 排序，无权的去掉");
});

const impact = (over: Partial<RuleImpactDto["totals"]> = {}, truncated = false): RuleImpactDto => ({
  resourceType: "customer",
  actions: ["view"],
  users: [
    { userId: "u1", name: "张三", action: "view", before: 10, after: 50, gained: 40, lost: 0 },
    { userId: "u2", name: "李四", action: "view", before: 10, after: 90, gained: 80, lost: 0 },
    { userId: "u3", name: "王五", action: "view", before: 9, after: 5, gained: 0, lost: 4 },
  ],
  totals: { usersChecked: 200, usersGaining: 3, usersLosing: 1, rowsGained: 120, rowsLost: 4, ...over },
  truncated,
  evaluatedAt: "2026-10-01T00:00:00Z",
});

test("影响预览一句话：多看到 / 少看到 / 没人受影响 / 人太多只算了前 N 人", () => {
  assert.equal(impactSummary(impact()), "3 人会多看到 120 条，1 人会少看到 4 条");
  assert.equal(impactSummary(impact({ usersGaining: 0, usersLosing: 0, usersChecked: 12 })), "没有人受影响（检查了 12 人）");
  assert.equal(impactSummary(impact({ usersLosing: 0 }, true)), "3 人会多看到 120 条（人太多，只算了前 200 人）");
  assert.equal(impactTone(impact()), "warning");
  assert.equal(impactTone(impact({ usersLosing: 0 })), "info");
  assert.equal(impactTone(impact({ usersLosing: 0, usersGaining: 0 })), "success");
  assert.deepEqual(impactRows(impact()).map((u) => u.name), ["李四", "张三", "王五"]);
});

test("配额状态：正常 / 快满（80%）/ 满或超 / 不限 / 未统计 / 上限 0", () => {
  assert.equal(quotaState({ limit: 10, used: 5 }).state, "ok");
  assert.equal(quotaState({ limit: 10, used: 8 }).state, "near");
  assert.deepEqual(quotaState({ limit: 10, used: 10 }), { state: "over", ratio: 1, text: "已用 10 / 10（已满）" });
  assert.equal(quotaState({ limit: 10, used: 12 }).text, "已用 12 / 10（超出 2）");
  assert.equal(quotaState({ limit: null, used: 3 }).state, "unlimited");
  assert.equal(quotaState({ limit: 5, used: null }).state, "unknown");
  assert.equal(quotaState({ limit: 0, used: 0 }).state, "over", "上限 0 = 不允许");
  const alerts = quotaAlerts([{ key: "a", label: "成员", limit: 10, used: 9 }, { key: "b", label: "存储", limit: 5, used: 5 }, { key: "c", label: "表单", limit: null, used: 1 }]);
  assert.equal(alerts.worst, "over");
  assert.deepEqual(alerts.items.map((q) => q.key), ["b", "a"]);
  assert.equal(quotaAlerts([]).worst, "ok");
});

test("租户配额来源、配额编辑行、开通 / 删除确认、套餐校验", () => {
  assert.deepEqual(effectiveQuotas({ quotas: { members: 50, storage: 10 } }, { quotas: { members: 80 } }), [
    { key: "members", limit: 80, source: "tenant" },
    { key: "storage", limit: 10, source: "package" },
  ]);
  assert.deepEqual(parseQuotaRows([{ key: " members ", value: "50" }, { key: "storage", value: "" }, { key: "", value: "" }]), { ok: true, quotas: { members: 50 } });
  assert.deepEqual(parseQuotaRows([{ key: "a", value: "1" }, { key: "a", value: "2" }]), { ok: false, error: "配额「a」重复了" });
  assert.equal(parseQuotaRows([{ key: "a", value: "-1" }]).ok, false);
  assert.equal(parseQuotaRows([{ key: "", value: "3" }]).ok, false);
  assert.deepEqual(validateTenantCreate({ name: "华东", packageId: "pro", adminUserId: "u1", id: "huadong" }), {});
  assert.deepEqual(Object.keys(validateTenantCreate({ name: "", packageId: "", adminUserId: " ", id: "Bad Id" })).sort(), ["adminUserId", "id", "name", "packageId"]);
  assert.equal(tenantDeleteConfirmed({ id: "acme" }, " acme "), true);
  assert.equal(tenantDeleteConfirmed({ id: "acme" }, "ACME"), false);
  assert.deepEqual(validatePackage({ name: "专业版", codes: ["crm:*", "finance:view"] }, true), {});
  assert.ok(validatePackage({ name: "x", codes: [] }, true).codes);
  assert.ok(validatePackage({ name: "x", codes: ["bad code"] }, true).codes);
  assert.deepEqual(parseLines("crm:*\n finance:view ,crm:*，"), ["crm:*", "finance:view"]);
});

test("安全体检：按严重 / 警告 / 正常分组、总结论、RLS 结论", () => {
  const item = (id: string, level: HealthItem["level"]): HealthItem => ({ id, level, title: id, detail: "", count: 1, samples: [] });
  const items = [item("a", "ok"), item("b", "warn"), item("c", "error"), item("d", "warn")];
  assert.deepEqual(groupHealth(items).map((g) => [g.level, g.label, g.items.length]), [["error", "严重", 1], ["warn", "警告", 2], ["ok", "正常", 1]]);
  assert.equal(healthSummary({ items }).text, "发现 1 项严重问题、2 项警告");
  assert.equal(healthSummary({ items: [item("a", "ok")] }).text, "没有发现问题（1 项检查全部正常）");
  assert.equal(healthSummary({ items: [] }).level, "ok");
  const table = { table: "t", owner: "app", rls: true, forced: true, policies: 1, ownedByApp: false };
  assert.equal(rlsSummary({ ok: true, role: "app", superuser: false, bypassRls: false, tables: [table], issues: [] }).ok, true);
  const bad = rlsSummary({ ok: false, role: "postgres", superuser: true, bypassRls: false, tables: [table, { ...table, table: "u", forced: false }], issues: ["x"] });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /超级用户.*1 张表/);
});

test("bt/builders-a 嵌套条件：条件组往返、组内一条变原子、空组报错、旧平铺草稿照样用、草稿 ⇄ 条件树", () => {
  const cond = {
    and: [
      { field: "status", op: "eq", value: "vip" },
      { or: [{ field: "amount", op: "gte", value: 100 }, { field: "owner", op: "eq", value: { ref: "userId" } }] },
    ],
  } as const;
  const draft = condToDraft(cond)!;
  assert.equal(draft.rows.length, 1);
  assert.equal(draft.groups?.length, 1);
  assert.equal(countDraftRows(draft), 3);
  assert.deepEqual(draftToCond(draft, FIELDS), { ok: true, cond });
  // a group holding one condition collapses into it
  const single = draftToCond({ join: "and", rows: [row("status", "eq", "vip")], groups: [{ id: "g1", join: "or", rows: [row("closed", "eq", "true")] }] }, FIELDS);
  assert.deepEqual(single, { ok: true, cond: { and: [{ field: "status", op: "eq", value: "vip" }, { field: "closed", op: "eq", value: true }] } });
  // only a group, no root rows
  assert.deepEqual(draftToCond({ join: "and", rows: [], groups: [{ id: "g1", join: "or", rows: [row("status", "eq", "vip"), row("closed", "eq", "否")] }] }, FIELDS), { ok: true, cond: { or: [{ field: "status", op: "eq", value: "vip" }, { field: "closed", op: "eq", value: false }] } });
  const emptyGroup = draftToCond({ join: "and", rows: [row("status", "eq", "vip")], groups: [{ id: "g1", join: "or", rows: [] }] }, FIELDS);
  assert.equal(emptyGroup.ok, false);
  assert.match(!emptyGroup.ok ? (emptyGroup.error ?? "") : "", /条件组里至少要有一个条件/);
  // errors inside groups are keyed by row id
  const bad = draftToCond({ join: "and", rows: [], groups: [{ id: "g1", join: "or", rows: [row("amount", "gt", "x")] }] }, FIELDS);
  assert.match(!bad.ok ? bad.rows["amount-gt-x"]! : "", /要填数字/);
  // tree conversion: refs are dynamic values; flat drafts stay flat (no groups key)
  const tree = condDraftToTree(draft);
  assert.equal(tree.items.length, 2);
  const firstGroup = tree.items[1] as { items: { value: unknown }[] };
  assert.deepEqual(firstGroup.items[1]!.value, { dynamic: "userId" });
  assert.deepEqual(draftKey(treeToCondDraft(tree)), draftKey(draft));
  const flat = { join: "or" as const, rows: [row("status", "eq", "vip")] };
  assert.deepEqual(Object.keys(treeToCondDraft(condDraftToTree(flat))).sort(), ["join", "rows"]);
  assert.notEqual(draftKey(draft), draftKey({ ...draft, groups: [{ ...draft.groups![0]!, join: "and" }] }), "组的且 / 或也算改动");
});
