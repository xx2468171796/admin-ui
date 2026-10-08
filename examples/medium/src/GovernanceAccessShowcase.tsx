import { useMemo, useState } from "react";
import { InlineAlert, SegmentedControl } from "@adminui/react";
import {
  GovernanceApiError,
  GovernanceConsole,
  condLabelsFrom,
  condToText,
  type AccessRequestDto,
  type ApprovalPolicyDto,
  type ApprovalStepState,
  type Cond,
  type EmergencyTarget,
  type GovAuditEventDto,
  type GovLookups,
  type GovResource,
  type GovernanceApi,
  type HealthReportDto,
  type PackageDto,
  type RestrictionRuleDto,
  type RestrictionRuleInput,
  type ReviewCampaignDto,
  type ReviewItemDto,
  type RlsCheckDto,
  type RuleImpactDto,
  type RulePreviewInput,
  type ShareRuleDto,
  type ShareRuleInput,
  type SodRuleDto,
  type TenantDto,
  type TenantMemberDto,
} from "@adminui/react/access";
import { ORG_PEOPLE, createDemoOrgSource } from "./org-picker-demo.ts";

// 权限治理（大档）示例：一个内存里的假服务端，实现 GovernanceApi 的全部方法，刷新页面恢复初始数据。
// 生产里换成 createGovernanceApi()（默认 /api/qx），由 quanxian/fastify 的治理路由提供；租户取自会话，鉴权和审计都在服务端。

const ME = { id: "u8", name: "郑凯" };
const USERS = [
  { id: "u1", label: "陈晓", hint: "销售经理", depts: ["east"] },
  { id: "u2", label: "林宁", hint: "销售", depts: ["south"] },
  { id: "u3", label: "周敏", hint: "售前", depts: ["east"] },
  { id: "u4", label: "王磊", hint: "大客户经理", depts: ["south"] },
  { id: "u5", label: "赵一鸣", hint: "运维", depts: ["ops"] },
  { id: "u6", label: "孙悦", hint: "财务总监", depts: ["fin"] },
  { id: "u7", label: "吴桐", hint: "客户成功", depts: ["cs"] },
  { id: "u8", label: "郑凯", hint: "销售总监", depts: ["east", "south"] },
];
const GROUPS = [{ id: "g-vip", label: "VIP 服务组", members: ["u7", "u3"] }];
const DEPTS = [
  { id: "east", label: "华东区" },
  { id: "south", label: "华南区" },
  { id: "cs", label: "客户成功部" },
  { id: "fin", label: "财务部" },
  { id: "ops", label: "运维部" },
];
const ROLES = [
  { id: "sales", label: "销售" },
  { id: "sales-mgr", label: "销售经理" },
  { id: "finance", label: "财务" },
  { id: "finance-viewer", label: "财务只读" },
  { id: "dba", label: "数据库管理员" },
  { id: "tenant-admin", label: "租户管理员" },
];
const CODES = [
  { id: "customer:view", label: "查看客户" },
  { id: "customer:update", label: "编辑客户" },
  { id: "customer:export", label: "导出客户" },
  { id: "customer:delete", label: "删除客户" },
  { id: "finance:pay", label: "发起付款" },
  { id: "finance:approve", label: "审批付款" },
];
const RESOURCES: GovResource[] = [
  {
    id: "customer",
    label: "客户",
    fields: [
      { id: "status", label: "状态", type: "string", options: [{ value: "normal", label: "普通" }, { value: "vip", label: "VIP" }, { value: "frozen", label: "已冻结" }] },
      { id: "owner", label: "负责人", type: "id" },
      { id: "dept", label: "所属部门", type: "id" },
      { id: "amount", label: "年合同额（万元）", type: "number" },
      { id: "name", label: "客户名称", type: "string" },
    ],
    actions: [
      { id: "view", label: "查看" },
      { id: "update", label: "编辑" },
      { id: "delete", label: "删除" },
      { id: "export", label: "导出" },
    ],
  },
  {
    id: "deal",
    label: "商机",
    fields: [
      { id: "stage", label: "阶段", type: "string", options: [{ value: "lead", label: "线索" }, { value: "won", label: "赢单" }, { value: "lost", label: "输单" }] },
      { id: "owner", label: "负责人", type: "id" },
      { id: "amount", label: "金额（万元）", type: "number" },
    ],
    actions: [{ id: "view", label: "查看" }, { id: "update", label: "编辑" }],
  },
];
const EMERGENCY_TARGETS: EmergencyTarget[] = [
  { kind: "role", id: "dba", label: "数据库管理员" },
  { kind: "role", id: "finance", label: "财务" },
  { kind: "permission", id: "customer:delete", label: "删除客户" },
];
const LOOKUPS: GovLookups = {
  users: USERS,
  roles: ROLES,
  depts: DEPTS,
  groups: GROUPS,
  codes: CODES,
  features: [{ id: "crm", label: "客户管理" }, { id: "finance", label: "财务" }, { id: "report", label: "报表" }],
  resources: RESOURCES,
  emergencyTargets: EMERGENCY_TARGETS,
  quotaLabels: { members: "成员数", rules: "共享规则数", storage: "附件空间（GB）" },
};
const RLS: RlsCheckDto = {
  ok: false,
  role: "crm_app",
  superuser: false,
  bypassRls: false,
  tables: [
    { table: "crm.customers", owner: "crm_owner", rls: true, forced: true, policies: 2, ownedByApp: false },
    { table: "crm.deals", owner: "crm_owner", rls: true, forced: true, policies: 2, ownedByApp: false },
    { table: "crm.attachments", owner: "crm_app", rls: true, forced: false, policies: 1, ownedByApp: true },
  ],
  issues: ["crm.attachments 归业务角色 crm_app 所有且没有 FORCE ROW LEVEL SECURITY：业务连接能绕过租户隔离"],
};

const userName = (id: string) => USERS.find((u) => u.id === id)?.label ?? ORG_PEOPLE.find((p) => p.id === id)?.label ?? id;
// 「添加成员」 picks from the organisation (OrgPicker) — the same demo directory as 「组织选人」.
const ORG_SOURCE = createDemoOrgSource();
const roleName = (id: string) => ROLES.find((r) => r.id === id)?.label ?? id;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const DAY = 86_400_000;
const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const fail = (status: number, code: string, message: string, field?: string): never => {
  throw new GovernanceApiError(status, { code, message, ...(field ? { field } : {}) });
};
let seq = 100;
const nextId = (p: string) => `${p}${++seq}`;

// ---- A small customer table so「预览影响」computes real numbers ----------------------------------
type Row = { id: string; owner: string; dept: string; status: string; amount: number; name: string };
const CUSTOMERS: Row[] = Array.from({ length: 160 }, (_, i) => {
  const owner = USERS[i % 7]!;
  return { id: `C-${1000 + i}`, owner: owner.id, dept: owner.depts[0]!, status: i % 9 === 0 ? "frozen" : i % 4 === 0 ? "vip" : "normal", amount: (i * 37) % 500, name: `客户${i}` };
});
function test(c: Cond, row: Row, userId: string): boolean {
  if ("all" in c) return true;
  if ("none" in c || "unknown" in c) return false;
  if ("and" in c) return c.and.every((x) => test(x, row, userId));
  if ("or" in c) return c.or.some((x) => test(x, row, userId));
  if ("not" in c) return !test(c.not, row, userId);
  if ("exists" in c) return false;
  const v = (row as Record<string, unknown>)[c.field];
  if ("in" in c && !("op" in c)) return c.in.includes(String(v));
  const user = USERS.find((u) => u.id === userId);
  const resolve = (x: unknown): unknown => {
    if (x && typeof x === "object" && "ref" in x) {
      const ref = (x as { ref: string }).ref;
      return ref === "userId" ? userId : ref === "deptId" ? user?.depts[0] : ref === "deptIds" || ref === "deptTreeIds" ? user?.depts : ref === "subordinateIds" ? (userId === "u8" ? ["u1", "u2", "u3", "u4"] : []) : undefined;
    }
    return x;
  };
  const atom = c as { field: string; op: string; value?: unknown };
  switch (atom.op) {
    case "isNull":
      return v === null || v === undefined;
    case "notNull":
      return v !== null && v !== undefined;
    case "like":
      return String(v).includes(String(resolve(atom.value)));
    case "in":
    case "nin": {
      const list = resolve(atom.value);
      const hit = Array.isArray(list) && list.map(String).includes(String(v));
      return atom.op === "in" ? hit : !hit;
    }
    default: {
      const target = resolve(atom.value);
      const a = typeof v === "number" ? v : String(v);
      const b = typeof v === "number" ? Number(target) : String(target);
      return atom.op === "eq" ? a === b : atom.op === "ne" ? a !== b : atom.op === "lt" ? a < b : atom.op === "lte" ? a <= b : atom.op === "gt" ? a > b : a >= b;
    }
  }
}

function createDemoApi(): GovernanceApi {
  const labels = (resourceType: string) => condLabelsFrom(RESOURCES.find((r) => r.id === resourceType)?.fields ?? []);
  const packages: PackageDto[] = [
    { id: "basic", name: "基础版", description: "小团队：客户管理", builtin: true, codes: ["customer:*"], features: ["crm"], roles: ["sales", "tenant-admin"], adminRole: "tenant-admin", quotas: { members: 10, rules: 3 }, version: 1, updatedAt: iso(-90 * DAY) },
    { id: "pro", name: "专业版", description: "客户 + 财务 + 报表", builtin: false, codes: ["customer:*", "finance:*", "report:view"], features: ["crm", "finance", "report"], roles: ["sales", "sales-mgr", "finance", "tenant-admin"], adminRole: "tenant-admin", quotas: { members: 20, rules: 10, storage: 50 }, version: 3, updatedAt: iso(-20 * DAY) },
    { id: "enterprise", name: "企业版", description: "全部功能，配额按合同", builtin: false, codes: ["*"], features: ["*"], roles: ["sales", "sales-mgr", "finance", "finance-viewer", "dba", "tenant-admin"], adminRole: "tenant-admin", quotas: {}, version: 1, updatedAt: iso(-5 * DAY) },
  ];
  const tenants: TenantDto[] = [
    { id: "acme", name: "Acme 示例公司", status: "active", statusReason: "", packageId: "pro", quotas: {}, version: 4, createdAt: iso(-200 * DAY), updatedAt: iso(-3 * DAY), createdBy: "平台管理员" },
    { id: "huadong", name: "华东贸易有限公司", status: "suspended", statusReason: "合同到期未续费", packageId: "basic", quotas: { members: 15 }, version: 2, createdAt: iso(-120 * DAY), updatedAt: iso(-1 * DAY), createdBy: "平台管理员" },
    { id: "nanfang-retail", name: "南方零售集团", status: "active", statusReason: "", packageId: "enterprise", quotas: { members: 500 }, version: 1, createdAt: iso(-30 * DAY), updatedAt: iso(-30 * DAY), createdBy: "郑凯" },
  ];
  const members: TenantMemberDto[] = USERS.map((u, i) => ({
    tenantId: "acme",
    userId: u.id,
    name: u.label,
    status: u.id === "u4" ? "suspended" : "active",
    invitedBy: i === 0 ? null : ME.id,
    joinedAt: iso(-(150 - i * 10) * DAY),
    expiresAt: u.id === "u7" ? iso(5 * DAY) : u.id === "u5" ? iso(60 * DAY) : null,
    roles: u.id === "u8" ? ["tenant-admin", "sales-mgr"] : u.id === "u6" ? ["finance"] : u.id === "u5" ? [] : u.id === "u1" ? ["sales-mgr"] : ["sales"],
  }));
  for (let i = 0; i < 10; i++) members.push({ tenantId: "acme", userId: `x${i}`, name: `外包${i + 1}`, status: "active", invitedBy: "u1", joinedAt: iso(-(20 - i) * DAY), expiresAt: iso((10 + i) * DAY), roles: ["sales"] });
  const share: ShareRuleDto[] = [
    { id: "sh1", tenantId: "acme", resourceType: "customer", label: "VIP 客户共享给 VIP 服务组", subject: { type: "group", id: "g-vip", name: "VIP 服务组" }, level: "viewer", cond: { field: "status", op: "eq", value: "vip" }, condText: "", enabled: true, expiresAt: null, version: 1, updatedAt: iso(-10 * DAY), updatedBy: ME.id },
    { id: "sh2", tenantId: "acme", resourceType: "customer", label: "华东大客户共享给客户成功部", subject: { type: "dept", id: "cs", name: "客户成功部" }, level: "editor", cond: { and: [{ field: "dept", op: "eq", value: "east" }, { field: "amount", op: "gte", value: 300 }] }, condText: "", enabled: true, expiresAt: iso(40 * DAY), version: 2, updatedAt: iso(-2 * DAY), updatedBy: "u1" },
  ];
  const restrictions: RestrictionRuleDto[] = [
    { id: "rs1", tenantId: null, resourceType: "customer", label: "已冻结的客户不能改、不能删", actions: ["update", "delete"], cond: { field: "status", op: "eq", value: "frozen" }, condText: "", exemptSuperuser: true, enabled: true, builtin: true, version: 1, updatedAt: null, updatedBy: null },
    { id: "rs2", tenantId: "acme", resourceType: "customer", label: "不能导出别人负责的客户", actions: ["export"], cond: { field: "owner", op: "ne", value: { ref: "userId" } }, condText: "", exemptSuperuser: false, enabled: true, builtin: false, version: 1, updatedAt: iso(-7 * DAY), updatedBy: ME.id },
  ];
  const withText = <T extends { resourceType: string; cond: Cond; condText: string }>(r: T): T => ({ ...r, condText: condToText(r.cond, labels(r.resourceType)) });
  const sod: SodRuleDto[] = [
    { id: "sod1", tenantId: null, a: "finance:pay", b: "finance:approve", mode: "block", label: "付款与审批付款分离", enabled: true, builtin: true, version: 1 },
    { id: "sod2", tenantId: "acme", a: "customer:export", b: "customer:delete", mode: "approve", label: "导出与删除客户要审批", enabled: true, builtin: false, version: 1 },
  ];
  const policies: ApprovalPolicyDto[] = [
    { id: "p1", tenantId: "acme", label: "兜底：直属上级审批", targetKind: "*", targetId: null, steps: [{ kind: "manager" }], maxDays: 90, priority: 0, enabled: true, version: 1 },
    { id: "p2", tenantId: "acme", label: "财务角色：上级 + 财务总监", targetKind: "role", targetId: "finance-viewer", steps: [{ kind: "manager", label: "部门负责人" }, { kind: "user", userIds: ["u6"], label: "财务总监" }], maxDays: 30, priority: 10, enabled: true, version: 1 },
    { id: "p3", tenantId: "acme", label: "导出客户：记录负责人", targetKind: "permission", targetId: "customer:export", steps: [{ kind: "resource_owner" }], maxDays: 7, priority: 5, enabled: true, version: 1 },
  ];
  const chain = (steps: [string, string[], ApprovalStepState["decision"]?, string?][]): ApprovalStepState[] =>
    steps.map(([label, ids, decision = null, note], index) => ({ index, label, candidates: ids.map((id) => ({ id, name: userName(id) })), decision, decidedBy: decision ? userName(ids[0]!) : null, decidedAt: decision ? iso(-DAY) : null, note: note ?? null }));
  type Req = Omit<AccessRequestDto, "can">;
  const base = { tenantId: "acme", submittedAt: iso(-2 * DAY), startsAt: null, activatedAt: null, endedAt: null, version: 1 };
  const requests: Req[] = [
    { ...base, id: "r1", kind: "normal", requester: { id: "u2", name: "林宁" }, target: { kind: "role", id: "finance-viewer", label: "财务只读" }, reason: "月底对账需要查看回款明细", status: "pending", createdAt: iso(-2 * DAY), expiresAt: iso(30 * DAY), chain: chain([["部门负责人", ["u8"]], ["财务总监", ["u6"]]]) },
    { ...base, id: "r2", kind: "normal", requester: { id: "u3", name: "周敏" }, target: { kind: "permission", id: "customer:export", label: "导出客户" }, reason: "给客户做年度回顾报告", status: "pending", createdAt: iso(-DAY), expiresAt: iso(7 * DAY), chain: chain([["直属上级", ["u8", "u1"]]]) },
    { ...base, id: "r3", kind: "normal", requester: { id: "u8", name: "郑凯" }, target: { kind: "role", id: "finance", label: "财务" }, reason: "临时代理财务总监审批付款", status: "pending", createdAt: iso(-3 * DAY), expiresAt: iso(14 * DAY), chain: chain([["直属上级", ["u6"]]]) },
    { ...base, id: "r4", kind: "normal", requester: { id: "u7", name: "吴桐" }, target: { kind: "role", id: "sales-mgr", label: "销售经理" }, reason: "代管华东区一个季度", status: "active", createdAt: iso(-20 * DAY), activatedAt: iso(-19 * DAY), expiresAt: iso(20 * DAY), chain: chain([["直属上级", ["u8"], "approve"]]) },
    { ...base, id: "r5", kind: "normal", requester: { id: "u8", name: "郑凯" }, target: { kind: "record", id: "C-1024", label: "客户 C-1024", resourceType: "customer" }, level: "editor", reason: "协助处理客户投诉", status: "draft", submittedAt: null, createdAt: iso(-1 * DAY), expiresAt: null, chain: chain([["记录负责人", ["u1"]]]) },
    { ...base, id: "r6", kind: "normal", requester: { id: "u4", name: "王磊" }, target: { kind: "role", id: "dba", label: "数据库管理员" }, reason: "想看下数据库", status: "rejected", createdAt: iso(-9 * DAY), expiresAt: null, chain: chain([["直属上级", ["u8"], "reject", "不是本岗位需要，有问题找运维"]]), decidedBy: "郑凯", decisionNote: "不是本岗位需要，有问题找运维" },
    { ...base, id: "e1", kind: "emergency", requester: { id: "u5", name: "赵一鸣" }, target: { kind: "role", id: "dba", label: "数据库管理员" }, reason: "订单库主从延迟导致下单失败，需要紧急切换主库", status: "expired", createdAt: iso(-3 * 3_600_000), activatedAt: iso(-3 * 3_600_000), expiresAt: iso(-2 * 3_600_000), endedAt: iso(-2.2 * 3_600_000), chain: [], supervisor: { id: "u8", name: "郑凯" }, postReview: { status: "pending", by: null, at: null, note: null } },
  ];
  const actions: Record<string, GovAuditEventDto[]> = {
    e1: [
      { id: "a1", at: iso(-2.9 * 3_600_000), actorId: "u5", action: "db.failover", targetType: "cluster", targetId: "orders-pg", after: { primary: "pg-2" }, reason: "主从延迟 40s" },
      { id: "a2", at: iso(-2.6 * 3_600_000), actorId: "u5", action: "db.query", targetType: "table", targetId: "orders.payments", after: null, reason: "核对切换后订单" },
      { id: "a3", at: iso(-2.3 * 3_600_000), actorId: "u5", action: "user.password.reset", targetType: "user", targetId: "u2", after: null, reason: null },
    ],
  };
  const canOf = (r: Req): AccessRequestDto["can"] => {
    const current = r.chain.find((s) => s.decision === null);
    const approver = r.status === "pending" && !!current?.candidates.some((c) => c.id === ME.id);
    const mine = r.requester.id === ME.id;
    return {
      approve: approver,
      reject: approver,
      cancel: mine && (r.status === "draft" || r.status === "pending"),
      submit: mine && r.status === "draft",
      revoke: r.status === "approved" || r.status === "active",
      review: r.kind === "emergency" && r.supervisor?.id === ME.id && !!r.endedAt && r.postReview?.status === "pending",
    };
  };
  const out = (r: Req): AccessRequestDto => ({ ...r, step: r.chain.length ? { current: Math.min(r.chain.filter((s) => s.decision === "approve").length + 1, r.chain.length), total: r.chain.length } : undefined, can: canOf(r) });
  const find = (id: string) => requests.find((r) => r.id === id) ?? fail(404, "NOT_FOUND", "申请不存在");
  const campaigns: ReviewCampaignDto[] = [
    { id: "c1", tenantId: "acme", name: "2026 Q4 财务权限复核", scope: { kind: "role", id: "finance" }, reviewer: { kind: "users", ids: ["u8"], roleId: null }, deadline: iso(9 * DAY), onDeadline: "revoke", staleDays: 90, status: "open", createdBy: "郑凯", createdAt: iso(-3 * DAY), closedAt: null, progress: { total: 0, decided: 0, kept: 0, revoked: 0 } },
    { id: "c2", tenantId: "acme", name: "2026 Q3 销售权限复核", scope: { kind: "dept", id: "east" }, reviewer: { kind: "manager", ids: [], roleId: null }, deadline: iso(-30 * DAY), onDeadline: "keep", staleDays: 60, status: "closed", createdBy: "郑凯", createdAt: iso(-60 * DAY), closedAt: iso(-29 * DAY), progress: { total: 12, decided: 12, kept: 10, revoked: 2 } },
  ];
  const item = (id: string, who: string, label: string, lastUsedDays: number | null, extra: Partial<ReviewItemDto> = {}): ReviewItemDto => ({
    id,
    campaignId: "c1",
    subject: { id: who, name: userName(who) },
    grant: { kind: "role", ref: "finance", label },
    grantedAt: iso(-200 * DAY),
    lastUsedAt: lastUsedDays === null ? null : iso(-lastUsedDays * DAY),
    useCount: lastUsedDays === null ? 0 : 42,
    stale: lastUsedDays === null || lastUsedDays > 90,
    expiresAt: null,
    reviewer: { id: "u8", name: "郑凯" },
    decision: null,
    decidedBy: null,
    decidedAt: null,
    appliedAt: null,
    ...extra,
  });
  const items: ReviewItemDto[] = [
    item("i1", "u6", "财务", 1),
    item("i2", "u1", "财务", 130),
    item("i3", "u7", "财务只读", null),
    item("i4", "u3", "财务只读", 12, { decision: "keep", decidedBy: "郑凯", decidedAt: iso(-DAY) }),
    item("i5", "u2", "财务只读", 200, { grant: { kind: "permission", ref: "finance:approve", label: "审批付款" }, reviewer: { id: "u6", name: "孙悦" } }),
  ];
  const progressOf = (c: ReviewCampaignDto): ReviewCampaignDto => {
    if (c.id !== "c1") return c;
    const kept = items.filter((i) => i.decision === "keep").length;
    const revoked = items.filter((i) => i.decision === "revoke").length;
    return { ...c, progress: { total: items.length, decided: kept + revoked, kept, revoked } };
  };
  const health = (scope: "tenant" | "platform"): HealthReportDto => {
    const report: HealthReportDto = {
      scope,
      tenantId: scope === "tenant" ? "acme" : null,
      checkedAt: new Date().toISOString(),
      summary: { ok: 0, warn: 0, error: 0 },
      items:
        scope === "tenant"
          ? [
              { id: "h1", level: "error", title: "有人同时持有「发起付款」和「审批付款」", detail: "违反职责分离：同一个人可以自己付款自己批。", count: 1, samples: [{ id: "u6", label: "孙悦", detail: "角色「财务」+ 个人加授「审批付款」" }] },
              { id: "h2", level: "warn", title: "高危权限 90 天没用过", detail: "长期不用的导出 / 删除权限建议收回。", count: 3, samples: [{ id: "u1", label: "陈晓 · 导出客户", detail: "最后使用 130 天前" }, { id: "u2", label: "林宁 · 审批付款", detail: "从未使用" }] },
              { id: "h3", level: "warn", title: "成员 7 天内到期", detail: "到期后自动停用，需要续期的请先处理。", count: 2, samples: [{ id: "u7", label: "吴桐", detail: "5 天后到期" }, { id: "x0", label: "外包1", detail: "10 天后到期" }] },
              { id: "h4", level: "ok", title: "没有无人管理的超级管理员", detail: "每个超管都绑定了二次验证。", count: 0, samples: [] },
              { id: "h5", level: "ok", title: "所有共享规则都有到期或负责人", detail: "", count: 0, samples: [] },
              { id: "h6", level: "ok", title: "紧急提权都已复核", detail: "最近 30 天 3 次紧急提权，均已由监督人复核。", count: 0, samples: [] },
            ]
          : [
              { id: "p1", level: "warn", title: "停用超过 30 天的租户还有数据", detail: "确认不续费的话建议导出后删除。", count: 1, samples: [{ id: "huadong", label: "华东贸易有限公司", detail: "停用 1 天" }] },
              { id: "p2", level: "ok", title: "所有租户都有管理员", detail: "", count: 0, samples: [] },
            ],
    };
    for (const i of report.items) report.summary[i.level]++;
    return report;
  };

  // 「预览影响」：按共享 / 收窄规则算每个人能看到的客户条数（改前 vs 改后）
  const subjectHas = (s: ShareRuleDto | ShareRuleInput, userId: string) => {
    const user = USERS.find((u) => u.id === userId)!;
    const id = "id" in s.subject ? s.subject.id : undefined;
    return s.subject.type === "everyone" || (s.subject.type === "user" && id === userId) || (s.subject.type === "dept" && !!id && user.depts.includes(id)) || (s.subject.type === "group" && !!GROUPS.find((g) => g.id === id)?.members.includes(userId));
  };
  const visible = (userId: string, action: string, shares: (ShareRuleDto | ShareRuleInput)[], rests: (RestrictionRuleDto | RestrictionRuleInput)[]) =>
    CUSTOMERS.filter(
      (row) =>
        (row.owner === userId || shares.some((s) => s.enabled !== false && s.resourceType === "customer" && subjectHas(s, userId) && (action === "view" || s.level === "editor") && test(s.cond, row, userId))) &&
        !rests.some((x) => x.enabled !== false && x.resourceType === "customer" && (!x.actions || x.actions.includes(action)) && !(x.exemptSuperuser && userId === ME.id) && test(x.cond, row, userId)),
    ).length;
  const preview = (kind: "share" | "restriction", input: RulePreviewInput): RuleImpactDto => {
    const rule = input.rule as (ShareRuleInput & RestrictionRuleInput) | undefined;
    const resourceType = rule?.resourceType ?? (kind === "share" ? share : restrictions).find((r) => r.id === input.id)?.resourceType ?? "customer";
    const acts = [...(input.actions?.length ? input.actions : ["view"])];
    const others = <T extends { id: string }>(list: T[]) => list.filter((r) => r.id !== input.id);
    const afterShare = kind === "share" ? [...others(share), ...(input.delete || !rule ? [] : [rule])] : share;
    const afterRest = kind === "restriction" ? [...others(restrictions), ...(input.delete || !rule ? [] : [rule])] : restrictions;
    const users = USERS.flatMap((u) =>
      acts.map((action) => {
        const before = resourceType === "customer" ? visible(u.id, action, share, restrictions) : 0;
        const after = resourceType === "customer" ? visible(u.id, action, afterShare, afterRest) : 0;
        return { userId: u.id, name: u.label, action, before, after, gained: Math.max(after - before, 0), lost: Math.max(before - after, 0) };
      }),
    ).filter((u) => u.gained || u.lost);
    return {
      resourceType,
      actions: acts,
      users,
      totals: { usersChecked: USERS.length, usersGaining: users.filter((u) => u.gained).length, usersLosing: users.filter((u) => u.lost).length, rowsGained: users.reduce((n, u) => n + u.gained, 0), rowsLost: users.reduce((n, u) => n + u.lost, 0) },
      truncated: false,
      evaluatedAt: new Date().toISOString(),
    };
  };
  const touch = <T extends { version: number }>(list: T[], id: string, patch: Partial<T>, version?: number): T => {
    const i = list.findIndex((x) => (x as unknown as { id: string }).id === id);
    if (i < 0) fail(404, "NOT_FOUND", "要找的内容不存在或已被删除");
    if (version !== undefined && version !== list[i]!.version) fail(409, "CONFLICT", "这条已被别人修改，请关闭后刷新再改");
    list[i] = { ...list[i]!, ...patch, version: list[i]!.version + 1 };
    return list[i]!;
  };
  const decide = async (id: string, action: "submit" | "approve" | "reject" | "cancel" | "revoke", note?: string) => {
    await wait();
    const r = find(id);
    const can = canOf(r);
    if (!can[action]) fail(403, "FORBIDDEN", "你现在不能做这个操作");
    if ((action === "reject" || action === "revoke") && !note?.trim()) fail(400, "INVALID", "请填写原因", "note");
    const current = r.chain.find((s) => s.decision === null);
    if (action === "approve" && current) {
      Object.assign(current, { decision: "approve", decidedBy: ME.name, decidedAt: new Date().toISOString(), note: note ?? null });
      if (r.chain.every((s) => s.decision === "approve")) Object.assign(r, { status: "active", activatedAt: new Date().toISOString(), decidedBy: ME.name, decisionNote: note });
    } else if (action === "reject" && current) {
      Object.assign(current, { decision: "reject", decidedBy: ME.name, decidedAt: new Date().toISOString(), note: note ?? null });
      Object.assign(r, { status: "rejected", decidedBy: ME.name, decisionNote: note });
    } else if (action === "submit") Object.assign(r, { status: "pending", submittedAt: new Date().toISOString() });
    else if (action === "cancel") Object.assign(r, { status: "cancelled", endedAt: new Date().toISOString() });
    else if (action === "revoke") Object.assign(r, { status: "revoked", endedAt: new Date().toISOString(), decisionNote: note });
    r.version++;
    return out(r);
  };

  return {
    tenant: async () => {
      await wait();
      const tenant = tenants.find((t) => t.id === "acme")!;
      const pkg = packages.find((p) => p.id === tenant.packageId)!;
      const limits = { ...pkg.quotas, ...tenant.quotas };
      return {
        tenant,
        package: pkg,
        quotas: [
          { key: "members", label: "成员数", limit: limits.members ?? null, used: members.filter((m) => m.status === "active").length },
          { key: "rules", label: "共享规则数", limit: limits.rules ?? null, used: share.length },
          { key: "storage", label: "附件空间（GB）", limit: limits.storage ?? null, used: null },
        ],
      };
    },
    members: {
      list: async () => (await wait(), members.map((m) => ({ ...m }))),
      add: async (input) => {
        await wait();
        if (members.some((m) => m.userId === input.userId)) fail(409, "CONFLICT", "已经是成员了", "userId");
        if (members.filter((m) => m.status === "active").length >= 20) fail(409, "QUOTA_EXCEEDED", "成员数已达套餐上限（20 人）");
        const m: TenantMemberDto = { tenantId: "acme", userId: input.userId, name: userName(input.userId), status: "active", invitedBy: ME.id, joinedAt: new Date().toISOString(), expiresAt: input.expiresAt ?? null, roles: [...(input.roleIds ?? [])] };
        members.push(m);
        return m;
      },
      update: async (userId, patch) => {
        await wait();
        const m = members.find((x) => x.userId === userId) ?? fail(404, "NOT_FOUND", "成员不存在");
        if (userId === ME.id && patch.status === "suspended") fail(409, "CONFLICT", "不能停用你自己");
        Object.assign(m, patch);
        return { ...m };
      },
      remove: async (userId, reason) => {
        await wait();
        if (!reason.trim()) fail(400, "INVALID", "请填写原因", "reason");
        if (userId === ME.id) fail(409, "CONFLICT", "不能把你自己移出租户");
        members.splice(members.findIndex((m) => m.userId === userId), 1);
      },
    },
    shareRules: {
      list: async () => (await wait(), share.map(withText)),
      create: async (input) => {
        await wait();
        const sub = input.subject;
        const name = sub.type === "everyone" ? "所有人" : sub.type === "dept" ? (DEPTS.find((d) => d.id === sub.id)?.label ?? sub.id!) : sub.type === "group" ? (GROUPS.find((g) => g.id === sub.id)?.label ?? sub.id!) : userName(sub.id!);
        const r: ShareRuleDto = withText({ id: nextId("sh"), tenantId: "acme", resourceType: input.resourceType, label: input.label, subject: { type: sub.type, id: sub.id ?? "*", name }, level: input.level, cond: input.cond, condText: "", enabled: input.enabled ?? true, expiresAt: input.expiresAt ?? null, version: 1, updatedAt: new Date().toISOString(), updatedBy: ME.id });
        share.push(r);
        return r;
      },
      update: async (id, input) => {
        await wait();
        const sub = input.subject;
        const prev = share.find((s) => s.id === id);
        const name = sub.type === "everyone" ? "所有人" : sub.type === "dept" ? (DEPTS.find((d) => d.id === sub.id)?.label ?? sub.id!) : sub.type === "group" ? (GROUPS.find((g) => g.id === sub.id)?.label ?? sub.id!) : userName(sub.id!);
        return withText(touch(share, id, { label: input.label, subject: { type: sub.type, id: sub.id ?? "*", name: prev && prev.subject.id === sub.id ? prev.subject.name : name }, level: input.level, cond: input.cond, enabled: input.enabled ?? true, expiresAt: input.expiresAt ?? null, updatedAt: new Date().toISOString(), updatedBy: ME.id }, input.version));
      },
      remove: async (id) => {
        await wait();
        share.splice(share.findIndex((s) => s.id === id), 1);
      },
      preview: async (input) => (await wait(400), preview("share", input)),
    },
    restrictionRules: {
      list: async () => (await wait(), restrictions.map(withText)),
      create: async (input) => {
        await wait();
        const r: RestrictionRuleDto = withText({ id: nextId("rs"), tenantId: "acme", resourceType: input.resourceType, label: input.label, actions: input.actions ? [...input.actions] : null, cond: input.cond, condText: "", exemptSuperuser: input.exemptSuperuser ?? true, enabled: input.enabled ?? true, builtin: false, version: 1, updatedAt: new Date().toISOString(), updatedBy: ME.id });
        restrictions.push(r);
        return r;
      },
      update: async (id, input) => {
        await wait();
        if (restrictions.find((r) => r.id === id)?.builtin) fail(409, "BUILTIN", "内置规则写在代码里，不能在后台改");
        return withText(touch(restrictions, id, { label: input.label, actions: input.actions ? [...input.actions] : null, cond: input.cond, exemptSuperuser: input.exemptSuperuser ?? true, enabled: input.enabled ?? true, updatedAt: new Date().toISOString(), updatedBy: ME.id }, input.version));
      },
      remove: async (id) => {
        await wait();
        if (restrictions.find((r) => r.id === id)?.builtin) fail(409, "BUILTIN", "内置规则不能删除");
        restrictions.splice(restrictions.findIndex((r) => r.id === id), 1);
      },
      preview: async (input) => (await wait(400), preview("restriction", input)),
    },
    sodRules: {
      list: async () => (await wait(), sod.map((r) => ({ ...r }))),
      create: async (input) => {
        await wait();
        const r: SodRuleDto = { id: nextId("sod"), tenantId: "acme", a: input.a, b: input.b, mode: input.mode, label: input.label, enabled: input.enabled ?? true, builtin: false, version: 1 };
        sod.push(r);
        return r;
      },
      update: async (id, input) => (await wait(), touch(sod, id, { a: input.a, b: input.b, mode: input.mode, label: input.label, enabled: input.enabled ?? true }, input.version)),
      remove: async (id) => {
        await wait();
        sod.splice(sod.findIndex((r) => r.id === id), 1);
      },
      violations: async () => (await wait(), sod.some((r) => r.id === "sod1" && r.enabled) ? [{ userId: "u6", name: "孙悦", rule: { id: "sod1", a: "finance:pay", b: "finance:approve", mode: "block" as const, label: "付款与审批付款分离" } }] : []),
    },
    approvalPolicies: {
      list: async () => (await wait(), policies.map((p) => ({ ...p }))),
      create: async (input) => {
        await wait();
        const p: ApprovalPolicyDto = { id: nextId("p"), tenantId: "acme", label: input.label, targetKind: input.targetKind, targetId: input.targetId ?? null, steps: [...input.steps], maxDays: input.maxDays ?? null, priority: input.priority ?? 0, enabled: input.enabled ?? true, version: 1 };
        policies.push(p);
        return p;
      },
      update: async (id, input) => (await wait(), touch(policies, id, { label: input.label, targetKind: input.targetKind, targetId: input.targetId ?? null, steps: [...input.steps], maxDays: input.maxDays ?? null, priority: input.priority ?? 0, enabled: input.enabled ?? true }, input.version)),
      remove: async (id) => {
        await wait();
        policies.splice(policies.findIndex((p) => p.id === id), 1);
      },
    },
    requests: {
      list: async (q = {}) => {
        await wait();
        return requests
          .filter((r) => (q.view === "mine" ? r.requester.id === ME.id : q.view === "todo" ? canOf(r).approve || canOf(r).review : true))
          .filter((r) => (!q.status || r.status === q.status) && (!q.kind || r.kind === q.kind))
          .map(out)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      get: async (id) => (await wait(), out(find(id))),
      create: async (input) => {
        await wait();
        const label = input.target.kind === "role" ? roleName(input.target.id) : input.target.kind === "permission" ? (CODES.find((c) => c.id === input.target.id)?.label ?? input.target.id) : `${RESOURCES.find((r) => r.id === input.target.resourceType)?.label ?? "记录"} ${input.target.id}`;
        const r: Req = { ...base, id: nextId("r"), kind: "normal", requester: { id: ME.id, name: ME.name }, target: { ...input.target, label }, ...(input.level ? { level: input.level } : {}), reason: input.reason, status: input.submit === false ? "draft" : "pending", createdAt: new Date().toISOString(), submittedAt: input.submit === false ? null : new Date().toISOString(), expiresAt: input.expiresAt ?? null, chain: chain([["直属上级", ["u6"]]]) };
        requests.unshift(r);
        return out(r);
      },
      submit: (id, note) => decide(id, "submit", note),
      approve: (id, note) => decide(id, "approve", note),
      reject: (id, note) => decide(id, "reject", note),
      cancel: (id, note) => decide(id, "cancel", note),
      revoke: (id, note) => decide(id, "revoke", note),
    },
    emergency: {
      start: async (input) => {
        await wait();
        if ([...input.reason.trim()].length < 10) fail(400, "INVALID", "原因至少 10 个字", "reason");
        if (input.supervisorId === ME.id) fail(400, "INVALID", "监督人不能是自己", "supervisorId");
        const target = EMERGENCY_TARGETS.find((t) => t.id === input.target.id && t.kind === input.target.kind)!;
        const r: Req = { ...base, id: nextId("e"), kind: "emergency", requester: { id: ME.id, name: ME.name }, target: { kind: target.kind, id: target.id, label: target.label }, reason: input.reason, status: "active", createdAt: new Date().toISOString(), submittedAt: new Date().toISOString(), activatedAt: new Date().toISOString(), expiresAt: iso((input.minutes ?? 60) * 60_000), chain: [], supervisor: { id: input.supervisorId, name: userName(input.supervisorId) }, postReview: null };
        requests.unshift(r);
        actions[r.id] = [];
        return out(r);
      },
      end: async (id) => {
        await wait();
        const r = find(id);
        Object.assign(r, { status: "expired", endedAt: new Date().toISOString(), postReview: { status: "pending", by: null, at: null, note: null } });
        return out(r);
      },
      review: async (id, input) => {
        await wait();
        const r = find(id);
        if (!canOf(r).review) fail(403, "FORBIDDEN", "只有监督人能复核");
        if (input.outcome === "flagged" && !input.note.trim()) fail(400, "INVALID", "标记异常要写意见", "note");
        r.postReview = { status: input.outcome, by: ME.name, at: new Date().toISOString(), note: input.note || null };
        return out(r);
      },
      actions: async (id) => (await wait(300), actions[id] ?? []),
    },
    reviews: {
      list: async () => (await wait(), campaigns.map(progressOf)),
      create: async (input) => {
        await wait();
        const c: ReviewCampaignDto = { id: nextId("c"), tenantId: "acme", name: input.name, scope: { kind: input.scope.kind, id: input.scope.id ?? null }, reviewer: { kind: input.reviewer.kind, ids: [...(input.reviewer.ids ?? [])], roleId: input.reviewer.roleId ?? null }, deadline: input.deadline, onDeadline: input.onDeadline ?? "none", staleDays: input.staleDays ?? 90, status: "open", createdBy: ME.name, createdAt: new Date().toISOString(), closedAt: null, progress: { total: 0, decided: 0, kept: 0, revoked: 0 } };
        campaigns.unshift(c);
        return c;
      },
      get: async (id) => (await wait(), progressOf(campaigns.find((c) => c.id === id) ?? fail(404, "NOT_FOUND", "复核不存在"))),
      items: async (id, q = {}) => (await wait(), id === "c1" ? items.filter((i) => !q.mine || i.reviewer.id === ME.id).map((i) => ({ ...i })) : []),
      decide: async (id, itemId, input) => {
        await wait(150);
        const c = campaigns.find((x) => x.id === id);
        if (c?.status !== "open") fail(409, "CONFLICT", "复核已关闭");
        const i = items.find((x) => x.id === itemId) ?? fail(404, "NOT_FOUND", "复核项不存在");
        if (input.decision === "revoke" && !input.note?.trim()) fail(400, "INVALID", "收回要写原因", "note");
        Object.assign(i, { decision: input.decision, note: input.note, decidedBy: ME.name, decidedAt: new Date().toISOString() });
        return { ...i };
      },
      close: async (id) => {
        await wait();
        const c = campaigns.find((x) => x.id === id) ?? fail(404, "NOT_FOUND", "复核不存在");
        if (c.id === "c1") for (const i of items) if (!i.decision && c.onDeadline !== "none") Object.assign(i, { decision: c.onDeadline, decidedBy: "系统（到期处理）" });
        Object.assign(c, { status: "closed", closedAt: new Date().toISOString() });
        return progressOf(c);
      },
    },
    health: async () => (await wait(500), health("tenant")),
    platform: {
      packages: {
        list: async () => (await wait(), packages.map((p) => ({ ...p }))),
        create: async (input) => {
          await wait();
          const id = input.id || nextId("pkg");
          if (packages.some((p) => p.id === id)) fail(409, "CONFLICT", "编号已存在", "id");
          const p: PackageDto = { id, name: input.name, description: input.description ?? "", builtin: false, codes: [...input.codes], features: [...(input.features ?? [])], roles: [...(input.roles ?? [])], adminRole: input.adminRole ?? null, quotas: { ...input.quotas }, version: 1, updatedAt: new Date().toISOString() };
          packages.push(p);
          return p;
        },
        update: async (id, input) => (await wait(), touch(packages, id, { name: input.name, description: input.description ?? "", codes: [...input.codes], features: [...(input.features ?? [])], roles: [...(input.roles ?? [])], adminRole: input.adminRole ?? null, quotas: { ...input.quotas }, updatedAt: new Date().toISOString() }, input.version)),
        remove: async (id) => {
          await wait();
          if (tenants.some((t) => t.packageId === id)) fail(409, "NOT_EMPTY", "还有租户在用这个套餐，先给它们换套餐");
          packages.splice(packages.findIndex((p) => p.id === id), 1);
        },
      },
      tenants: {
        list: async () => (await wait(), tenants.map((t) => ({ ...t }))),
        create: async (input) => {
          await wait();
          const id = input.id || nextId("t");
          if (tenants.some((t) => t.id === id)) fail(409, "CONFLICT", "租户编号已存在", "id");
          const t: TenantDto = { id, name: input.name, status: "active", statusReason: "", packageId: input.packageId, quotas: { ...input.quotas }, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: ME.name };
          tenants.push(t);
          return t;
        },
        get: async (id) => {
          await wait();
          const t = tenants.find((x) => x.id === id) ?? fail(404, "NOT_FOUND", "租户不存在");
          const pkg = packages.find((p) => p.id === t.packageId)!;
          const limits = { ...pkg.quotas, ...t.quotas };
          const count = id === "acme" ? members.length : id === "huadong" ? 15 : 3;
          return { tenant: t, package: pkg, quotas: Object.keys(limits).map((key) => ({ key, label: LOOKUPS.quotaLabels?.[key] ?? key, limit: limits[key] ?? null, used: key === "members" ? count : key === "rules" ? 2 : null })) };
        },
        update: async (id, input) => (await wait(), touch(tenants, id, { ...(input.name ? { name: input.name } : {}), ...(input.packageId ? { packageId: input.packageId } : {}), quotas: { ...input.quotas }, updatedAt: new Date().toISOString() }, input.version)),
        suspend: async (id, reason) => (await wait(), touch(tenants, id, { status: "suspended", statusReason: reason })),
        resume: async (id) => (await wait(), touch(tenants, id, { status: "active", statusReason: "" })),
        remove: async (id, input) => {
          await wait();
          if (input.confirm !== id) fail(400, "INVALID", "确认编号不对", "confirm");
          tenants.splice(tenants.findIndex((t) => t.id === id), 1);
        },
        members: async (id) => (await wait(), id === "acme" ? members.map((m) => ({ ...m })) : [{ tenantId: id, userId: "a1", name: "租户管理员", status: "active" as const, invitedBy: null, joinedAt: iso(-30 * DAY), expiresAt: null, roles: ["tenant-admin"] }]),
      },
      viewAs: async (input) => (await wait(), { token: `demo-${input.userId}`, userId: input.userId, tenantId: input.tenantId, expiresAt: iso(10 * 60_000), readOnly: true as const }),
      health: async () => (await wait(500), health("platform")),
    },
  };
}

const PERSPECTIVES = {
  admin: ["qx:*"],
  member: ["qx:member.view", "qx:rule.view", "qx:health.view"],
} as const;

export function GovernanceAccessShowcase({ active = true }: { active?: boolean }) {
  const api = useMemo(() => createDemoApi(), []);
  const [who, setWho] = useState<keyof typeof PERSPECTIVES>("admin");
  return (
    <>
      <InlineAlert title="浏览器演示">数据在内存里，刷新恢复。生产里用 createGovernanceApi() 接 quanxian 的治理路由；按钮显隐只是界面，服务端逐条鉴权、写审计。</InlineAlert>
      <GovernanceConsole
        key={who}
        api={api}
        me={ME}
        permissions={PERSPECTIVES[who]}
        lookups={LOOKUPS}
        orgSource={ORG_SOURCE}
        rls={RLS}
        active={active}
        description="大档权限治理：租户与套餐、共享 / 收窄规则（改前预览影响）、职责分离、申请审批、紧急提权、权限复核和安全体检。"
        actions={<SegmentedControl label="演示视角" size="sm" value={who} onValueChange={setWho} options={[{ value: "admin", label: "治理管理员" }, { value: "member", label: "普通成员（只读）" }]} />}
      />
    </>
  );
}
