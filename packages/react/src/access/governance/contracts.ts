/**
 * Data shapes of the large-tier (multi-tenant / governance) permission pages.
 *
 * Field-for-field mirror of quanxian 2.0 `src/contracts.ts` from the banner「大档」to the end
 * (plus the few shared shapes they reference: Cond, DataScope, RecordLevel, GrantSubjectType). The SDK
 * never imports quanxian; when the server contract changes, change this file in the same release.
 * Pure types and Chinese label maps: no React / DOM imports.
 */
import type { DataScope, RecordLevel } from "../contracts.ts";

// ---- Conditions (quanxian cond.ts) ---------------------------------------------------------

export type CondScalar = string | number | boolean;
/** Attributes of the current person a condition can refer to (bound by the server). */
export type CondRefName = "userId" | "deptId" | "deptIds" | "deptTreeIds" | "tenantId" | "groupIds" | "postIds" | "subordinateIds" | "now";
export type CondRef = { ref: CondRefName };
export type CondCmpOp = "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
export type CondOp = CondCmpOp | "in" | "nin" | "isNull" | "notNull" | "like";
/** like: literal substring match (% and _ are not wildcards). */
export type CondLikeMatch = "contains" | "prefix" | "suffix";
/** JSON condition tree. Empty and / or / in are invalid (the server rejects them: a lost condition must never mean「everything」). */
export type Cond =
  | { all: true }
  | { none: true }
  | { unknown: true }
  /** Legacy 1.x form: text value in a list. */
  | { field: string; in: readonly string[] }
  | { field: string; op: CondCmpOp; value: CondScalar | CondRef }
  | { field: string; op: "in" | "nin"; value: readonly CondScalar[] | CondRef }
  | { field: string; op: "isNull" | "notNull" }
  | { field: string; op: "like"; value: string | CondRef; match?: CondLikeMatch }
  | { not: Cond }
  | { and: readonly Cond[] }
  | { or: readonly Cond[] }
  | { exists: { rel: string; where: Cond } };

export type GrantSubjectType = "user" | "group" | "dept" | "everyone";

// ---- Permission codes ----------------------------------------------------------------------

/** Governance codes inside a tenant (quanxian QX_GOVERNANCE_PERMISSIONS). */
export const GOV_PERMISSIONS = {
  memberView: "qx:member.view",
  memberManage: "qx:member.manage",
  ruleView: "qx:rule.view",
  ruleManage: "qx:rule.manage",
  requestManage: "qx:request.manage",
  reviewManage: "qx:review.manage",
  emergencyUse: "qx:emergency.use",
  healthView: "qx:health.view",
} as const;
/** Platform (cross-tenant) codes (quanxian QX_PLATFORM_PERMISSIONS). */
export const GOV_PLATFORM_PERMISSIONS = {
  tenantView: "qx:tenant.view",
  tenantManage: "qx:tenant.manage",
  packageManage: "qx:package.manage",
  crossTenant: "qx:tenant.cross",
} as const;

// ---- Packages / tenants / members -----------------------------------------------------------

/** Package = permission ceiling: codes (wildcards allowed) ∩ what roles grant; features; seeded roles; quotas. */
export interface PackageDto {
  id: string;
  name: string;
  description: string;
  /** Defined in code (synced at start, read-only here). */
  builtin: boolean;
  codes: string[];
  /** Enabled feature modules; ["*"] = all. */
  features: string[];
  /** Role templates seeded into a new tenant. */
  roles: string[];
  /** Template the tenant admin gets. */
  adminRole: string | null;
  quotas: Record<string, number>;
  version: number;
  updatedAt: string;
}
export interface PackageInput {
  id?: string;
  name: string;
  description?: string;
  codes: readonly string[];
  features?: readonly string[];
  roles?: readonly string[];
  adminRole?: string | null;
  quotas?: Readonly<Record<string, number>>;
  version?: number;
}

export type TenantStatus = "active" | "suspended";
export interface TenantDto {
  id: string;
  name: string;
  status: TenantStatus;
  statusReason: string;
  packageId: string;
  /** Tenant overrides (missing keys follow the package). */
  quotas: Record<string, number>;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}
export interface TenantCreateInput {
  id?: string;
  name: string;
  packageId: string;
  /** Becomes a member and gets the package's adminRole. */
  adminUserId: string;
  quotas?: Readonly<Record<string, number>>;
}
export interface TenantUpdateInput {
  name?: string;
  packageId?: string;
  quotas?: Readonly<Record<string, number>>;
  version: number;
}
export interface QuotaDto {
  key: string;
  label: string;
  /** null = unlimited. */
  limit: number | null;
  /** null = the package cannot count it (host-owned quota). */
  used: number | null;
}
/** `GET /tenant`: current tenant + package + quota usage. */
export interface TenantContextDto {
  tenant: TenantDto;
  package: PackageDto;
  quotas: QuotaDto[];
}
export type MemberStatus = "active" | "suspended";
export interface TenantMemberDto {
  tenantId: string;
  userId: string;
  name: string;
  status: MemberStatus;
  invitedBy: string | null;
  joinedAt: string;
  expiresAt: string | null;
  /** Roles held directly in this tenant. */
  roles: string[];
}
export interface TenantMemberInput {
  userId: string;
  expiresAt?: string | null;
  roleIds?: readonly string[];
}
export interface TenantMemberPatch {
  status?: MemberStatus;
  expiresAt?: string | null;
}

// ---- Share / restriction rules (data, previewed before saving) -----------------------------

export interface ShareRuleDto {
  id: string;
  tenantId: string | null;
  resourceType: string;
  label: string;
  subject: { type: GrantSubjectType; id: string; name: string };
  level: Exclude<RecordLevel, "owner">;
  cond: Cond;
  /** Human text from the server (「状态 = vip」). */
  condText: string;
  enabled: boolean;
  expiresAt: string | null;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}
export interface ShareRuleInput {
  id?: string;
  resourceType: string;
  label: string;
  subject: { type: GrantSubjectType; id?: string };
  level: Exclude<RecordLevel, "owner">;
  cond: Cond;
  enabled?: boolean;
  expiresAt?: string | null;
  version?: number;
}
export interface RestrictionRuleDto {
  id: string;
  tenantId: string | null;
  resourceType: string;
  label: string;
  /** null = every action of the resource. */
  actions: string[] | null;
  cond: Cond;
  condText: string;
  exemptSuperuser: boolean;
  enabled: boolean;
  /** Written in code (definePolicy): read-only. */
  builtin: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
}
export interface RestrictionRuleInput {
  id?: string;
  resourceType: string;
  label: string;
  actions?: readonly string[] | null;
  cond: Cond;
  exemptSuperuser?: boolean;
  enabled?: boolean;
  version?: number;
}
/** Preview before saving: who sees more / fewer rows. */
export interface RulePreviewInput {
  /** Rule being changed (absent = new); with delete = true previews removing it. */
  id?: string;
  rule?: ShareRuleInput | RestrictionRuleInput;
  delete?: boolean;
  /** Actions to evaluate (default view). */
  actions?: readonly string[];
  /** Max people evaluated (default 200). */
  limit?: number;
}
export interface RuleImpactUser {
  userId: string;
  name: string;
  action: string;
  before: number;
  after: number;
  gained: number;
  lost: number;
}
export interface RuleImpactDto {
  resourceType: string;
  actions: string[];
  /** Only people whose result changes. */
  users: RuleImpactUser[];
  totals: { usersChecked: number; usersGaining: number; usersLosing: number; rowsGained: number; rowsLost: number };
  /** Too many people: only the first `limit` were evaluated. */
  truncated: boolean;
  evaluatedAt: string;
}

// ---- Separation of duties --------------------------------------------------------------------

export type SodMode = "block" | "approve";
export interface SodRuleDto {
  id: string;
  tenantId: string | null;
  a: string;
  b: string;
  mode: SodMode;
  label: string;
  enabled: boolean;
  /** Written in code (conflicts): read-only. */
  builtin: boolean;
  version: number;
}
export interface SodRuleInput {
  id?: string;
  a: string;
  b: string;
  mode: SodMode;
  label: string;
  enabled?: boolean;
  version?: number;
}
/** People who violate a rule right now (rule added later, or the service was bypassed). */
export interface SodViolationDto {
  userId: string;
  name: string;
  rule: { id: string; a: string; b: string; mode: SodMode; label: string };
}

// ---- Requests and approvals ----------------------------------------------------------------

export type GovRequestStatus = "draft" | "pending" | "approved" | "active" | "rejected" | "cancelled" | "expired" | "revoked";
export type GovRequestTargetKind = "role" | "permission" | "record";
export interface GovRequestTarget {
  kind: GovRequestTargetKind;
  id: string;
  label: string;
  /** For kind = record. */
  resourceType?: string;
}
/** How a step finds its approvers: manager / dept leader / role holders / record owner / named people. */
export type ApprovalStepKind = "manager" | "dept_leader" | "role_holder" | "resource_owner" | "user";
export interface ApprovalStep {
  kind: ApprovalStepKind;
  label?: string;
  roleId?: string;
  /** dept_leader (absent = the requester's main department). */
  deptId?: string;
  userIds?: readonly string[];
}
export interface ApprovalPolicyDto {
  id: string;
  tenantId: string | null;
  label: string;
  /** "*" = fallback. */
  targetKind: GovRequestTargetKind | "*";
  /** null = every target of the kind. */
  targetId: string | null;
  steps: ApprovalStep[];
  /** Longest grant in days (null = unlimited; permanent requests are cut to it). */
  maxDays: number | null;
  priority: number;
  enabled: boolean;
  version: number;
}
export interface ApprovalPolicyInput {
  id?: string;
  label: string;
  targetKind: GovRequestTargetKind | "*";
  targetId?: string | null;
  steps: readonly ApprovalStep[];
  maxDays?: number | null;
  priority?: number;
  enabled?: boolean;
  version?: number;
}
export interface ApprovalStepState {
  index: number;
  label: string;
  candidates: { id: string; name: string }[];
  decision: "approve" | "reject" | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
}
/** Same shape as the access AccessRequest plus server fields. */
export interface AccessRequestDto {
  id: string;
  kind: "normal" | "emergency";
  tenantId: string | null;
  requester: { id: string; name: string };
  target: GovRequestTarget;
  scope?: DataScope | null;
  level?: RecordLevel;
  reason: string;
  status: GovRequestStatus;
  createdAt: string;
  submittedAt: string | null;
  /** Requested / granted expiry; null = permanent. */
  expiresAt: string | null;
  startsAt: string | null;
  step?: { current: number; total: number; label?: string };
  chain: ApprovalStepState[];
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  activatedAt: string | null;
  endedAt: string | null;
  /** Emergency: supervisor (≠ requester) and post review. */
  supervisor?: { id: string; name: string } | null;
  postReview?: { status: "pending" | "ok" | "flagged"; by: string | null; at: string | null; note: string | null } | null;
  /** What the current user may do (UI hint; the server decides again). */
  can: { approve: boolean; reject: boolean; cancel: boolean; revoke: boolean; submit: boolean; review: boolean };
  version: number;
}
export interface AccessRequestInput {
  target: { kind: GovRequestTargetKind; id: string; resourceType?: string };
  /** kind = record: viewer / editor. */
  level?: Exclude<RecordLevel, "owner">;
  reason: string;
  expiresAt?: string | null;
  startsAt?: string | null;
  /** false = save as draft (default submits). */
  submit?: boolean;
}
export interface RequestDecisionInput {
  note?: string;
}
export interface RequestQuery {
  /** mine = mine; todo = waiting for me; all = everything (needs qx:request.manage). */
  view?: "mine" | "todo" | "all";
  status?: GovRequestStatus;
  kind?: "normal" | "emergency";
  limit?: number;
}

// ---- Emergency access (firefighter) ---------------------------------------------------------

export interface EmergencyInput {
  target: { kind: "role" | "permission"; id: string };
  /** Required, at least 10 characters. */
  reason: string;
  /** Supervisor (≠ self) who reviews afterwards. */
  supervisorId: string;
  /** Minutes (default 60, server caps it). */
  minutes?: number;
}
export interface EmergencyReviewInput {
  outcome: "ok" | "flagged";
  note: string;
}
/** One audit event of what was done during an elevation (`GET /emergency/:id/actions`). */
export interface GovAuditEventDto {
  id: string;
  at: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  after: unknown;
  reason: string | null;
}

// ---- Access reviews ------------------------------------------------------------------------

export type ReviewScopeKind = "role" | "resource" | "dept" | "all";
export type ReviewerKind = "manager" | "users" | "role_holder";
export type ReviewDeadlineAction = "revoke" | "keep" | "none";
export interface ReviewCampaignDto {
  id: string;
  tenantId: string | null;
  name: string;
  scope: { kind: ReviewScopeKind; id: string | null };
  reviewer: { kind: ReviewerKind; ids: string[]; roleId: string | null };
  deadline: string;
  /** Undecided items at the deadline: revoke / keep / none (remind only). */
  onDeadline: ReviewDeadlineAction;
  /** Days without use that count as stale. */
  staleDays: number;
  status: "open" | "closed";
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  progress: { total: number; decided: number; kept: number; revoked: number };
}
export interface ReviewCampaignInput {
  name: string;
  scope: { kind: ReviewScopeKind; id?: string | null };
  reviewer: { kind: ReviewerKind; ids?: readonly string[]; roleId?: string | null };
  deadline: string;
  onDeadline?: ReviewDeadlineAction;
  staleDays?: number;
}
export interface ReviewItemDto {
  id: string;
  campaignId: string;
  subject: { id: string; name: string };
  grant: { kind: "role" | "permission" | "record"; ref: string; label: string; scope?: DataScope | null };
  grantedAt?: string;
  /** null = never used. */
  lastUsedAt: string | null;
  useCount: number;
  stale: boolean;
  expiresAt?: string | null;
  reviewer: { id: string; name: string };
  decision: "keep" | "revoke" | null;
  note?: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** When the revoke was carried out. */
  appliedAt: string | null;
}
export interface ReviewDecisionInput {
  decision: "keep" | "revoke";
  note?: string;
}

// ---- Security health ------------------------------------------------------------------------

export type HealthLevel = "ok" | "warn" | "error";
export interface HealthItem {
  id: string;
  level: HealthLevel;
  title: string;
  detail: string;
  count: number;
  samples: { id: string; label: string; detail?: string }[];
}
export interface HealthReportDto {
  scope: "platform" | "tenant";
  tenantId: string | null;
  checkedAt: string;
  items: HealthItem[];
  summary: Record<HealthLevel, number>;
}
/** PostgreSQL row-level-security self check (quanxian/drizzle rlsSelfCheck). */
export interface RlsCheckDto {
  ok: boolean;
  role: string;
  superuser: boolean;
  bypassRls: boolean;
  tables: { table: string; owner: string; rls: boolean; forced: boolean; policies: number; ownedByApp: boolean }[];
  issues: string[];
}

/** `POST /platform/view-as` result: a short-lived read-only preview token (audited). */
export interface GovViewAsDto {
  token: string;
  userId: string;
  expiresAt: string;
  readOnly: true;
  tenantId?: string;
}
export interface GovViewAsInput {
  tenantId: string;
  userId: string;
  reason: string;
}

// ---- Server errors -------------------------------------------------------------------------

/** `{ code, message, field?, permission? }` returned by the governance routes. */
export interface GovErrorDto {
  code: string;
  message: string;
  field?: string;
  permission?: string;
  fields?: readonly string[];
  traceId?: string;
}

// ---- Host-provided lookups (labels / pickers) -----------------------------------------------

/** One option of a picker (person, role, permission code, department, group). */
export type GovOption = { id: string; label: string; hint?: string };
/** Field type of a condition field; decides which operators the builder offers. */
export type CondFieldType = "id" | "string" | "number" | "boolean" | "timestamp";
/** A field the rule editors may use in conditions (the host's defineFields whitelist). */
export type CondFieldDef = { id: string; label: string; type: CondFieldType; options?: readonly { value: string; label: string }[] };
/** A resource type the rule editors can target. */
export type GovResource = { id: string; label: string; fields: readonly CondFieldDef[]; actions?: readonly GovOption[] };

// ---- Chinese labels --------------------------------------------------------------------------

export const TENANT_STATUS_LABEL: Readonly<Record<TenantStatus, string>> = { active: "正常", suspended: "已停用" };
export const MEMBER_STATUS_LABEL: Readonly<Record<MemberStatus, string>> = { active: "正常", suspended: "已停用" };
export const GOV_REQUEST_STATUS_LABEL: Readonly<Record<GovRequestStatus, string>> = {
  draft: "草稿",
  pending: "待审批",
  approved: "已批准",
  active: "生效中",
  rejected: "已驳回",
  cancelled: "已撤回",
  expired: "已到期",
  revoked: "已收回",
};
export const REQUEST_TARGET_LABEL: Readonly<Record<GovRequestTargetKind, string>> = { role: "角色", permission: "权限", record: "记录" };
export const REQUEST_KIND_LABEL: Readonly<Record<AccessRequestDto["kind"], string>> = { normal: "普通申请", emergency: "紧急提权" };
export const APPROVAL_STEP_LABEL: Readonly<Record<ApprovalStepKind, string>> = {
  manager: "直属上级",
  dept_leader: "部门负责人",
  role_holder: "角色持有人",
  resource_owner: "记录负责人",
  user: "指定人员",
};
export const SOD_MODE_LABEL: Readonly<Record<SodMode, string>> = { block: "禁止同时持有", approve: "同时持有需审批" };
export const SHARE_LEVEL_LABEL: Readonly<Record<Exclude<RecordLevel, "owner">, string>> = { viewer: "可查看", editor: "可编辑" };
export const SUBJECT_TYPE_LABEL: Readonly<Record<GrantSubjectType, string>> = { user: "成员", group: "用户组", dept: "部门", everyone: "所有人" };
export const REVIEW_SCOPE_LABEL: Readonly<Record<ReviewScopeKind, string>> = { role: "某个角色的持有人", resource: "某类资源的记录授权", dept: "某个部门的人", all: "全部授权" };
export const REVIEWER_KIND_LABEL: Readonly<Record<ReviewerKind, string>> = { manager: "直属上级", users: "指定人员", role_holder: "某角色的持有人" };
export const REVIEW_DEADLINE_LABEL: Readonly<Record<ReviewDeadlineAction, string>> = { revoke: "自动收回", keep: "自动保留", none: "只提醒，不处理" };
export const POST_REVIEW_LABEL: Readonly<Record<"pending" | "ok" | "flagged", string>> = { pending: "待复核", ok: "复核无异常", flagged: "已标记异常" };
export const HEALTH_LEVEL_LABEL: Readonly<Record<HealthLevel, string>> = { error: "严重", warn: "警告", ok: "正常" };
export const COND_OP_LABEL: Readonly<Record<CondOp, string>> = {
  eq: "等于",
  ne: "不等于",
  lt: "小于",
  lte: "小于等于",
  gt: "大于",
  gte: "大于等于",
  in: "属于",
  nin: "不属于",
  isNull: "为空",
  notNull: "不为空",
  like: "包含",
};
export const COND_REF_LABEL: Readonly<Record<CondRefName, string>> = {
  userId: "当前用户",
  deptId: "当前用户的主部门",
  deptIds: "当前用户的部门",
  deptTreeIds: "当前用户的部门及下级",
  tenantId: "当前租户",
  groupIds: "当前用户的用户组",
  postIds: "当前用户的岗位",
  subordinateIds: "当前用户的下属",
  now: "当前时间",
};
export const COND_LIKE_LABEL: Readonly<Record<CondLikeMatch, string>> = { contains: "包含", prefix: "开头是", suffix: "结尾是" };
