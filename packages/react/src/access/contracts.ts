/**
 * Data shapes for the permission-management components (`@adminui/react/access`).
 *
 * Aligned to quanxian 2.0 PLAN §3: scope tiers own ⊂ subordinates ⊂ dept ⊂ dept_tree ⊂ all (+ custom
 * departments, include-unassigned), record grant levels viewer ⊆ editor ⊆ owner, field policy
 * read / write / export / mask, explain sources and blocks. The components only display and edit these
 * values; hosts map them to their own API (quanxian/server) and the server re-checks everything.
 * Pure types and constants: no React / DOM imports.
 */

/**
 * Data-scope tiers, narrow → wide. Kernel mapping: own = `self`, subordinates = `self_and_subordinates`,
 * dept / dept_tree / all unchanged, custom = `{ kind: "custom", deptIds }`.
 */
export type ScopeTier = "own" | "subordinates" | "dept" | "dept_tree" | "all" | "custom";
/** The five ordered tiers (each includes the previous one); `custom` is outside the order. */
export const SCOPE_TIER_ORDER = ["own", "subordinates", "dept", "dept_tree", "all"] as const;
export const SCOPE_TIER_LABEL: Readonly<Record<ScopeTier, string>> = {
  own: "仅本人",
  subordinates: "本人及下属",
  dept: "本部门",
  dept_tree: "本部门及以下",
  all: "全部",
  custom: "指定部门",
};
export const SCOPE_TIER_HINT: Readonly<Record<ScopeTier, string>> = {
  own: "只看自己负责或创建的记录",
  subordinates: "自己的，加上直属和间接下属的",
  dept: "所在部门（多部门取并集）的记录",
  dept_tree: "所在部门及其全部下级部门的记录",
  all: "本租户内全部记录",
  custom: "只看勾选部门的，以及自己名下的",
};
/**
 * Dimension filter on a data scope (quanxian 2.2): `mine` = the person's own values (「我的业务线」),
 * `values` = fixed values, `includeNull` = also records with this dimension empty. ANDed with the tier.
 */
export type DimFilter = { mine?: boolean; values?: readonly string[]; includeNull?: boolean };
/** One data scope. `deptIds` only for `custom`; `includeUnassigned` adds records with no department / owner; `dims` = dimension filters (2.2). */
export type DataScope = {
  tier: ScopeTier;
  deptIds?: readonly string[];
  includeUnassigned?: boolean;
  dims?: Readonly<Record<string, DimFilter>>;
  /**
   * Server wording (quanxian 2.2.1, effective access / explain / view-as): 「全部 ∩ 我的业务线（A 产品线）」 — 「我的」 with the
   * values the person is actually in. Shown as is; never sent back (normalizeScope drops it).
   */
  label?: string;
};
/** A dimension the host registered (业务线 / 区域 / 品牌 …) and its values: offered in scope dialogs and assignment pickers. */
export type AccessDimension = {
  id: string;
  /** 「业务线」 */
  label: string;
  values: readonly { id: string; name: string; disabled?: boolean }[];
};
/** Where one assignment applies (quanxian 2.2): one dimension value and / or a department (with its sub-departments). Empty = everywhere. */
export type AssignScope = { dim?: string; value?: string; deptId?: string };

/** A node of a checkable tree: menus / permissions / departments. */
export type TreeNode = {
  id: string;
  label: string;
  children?: readonly TreeNode[];
  /** Cannot be toggled (and linkage leaves it as it is). */
  disabled?: boolean;
  /** Short grey text after the label, e.g. a permission code or a head count. */
  hint?: string;
  /** Extra search words (pinyin, code, aliases). */
  keywords?: string;
};
/** Departments use the same node shape. */
export type OrgNode = TreeNode;

/** A person that can be picked (UserTransfer / team panel). */
export type AccessUser = {
  id: string;
  name: string;
  /** Departments the person belongs to (multi-department supported). */
  deptIds: readonly string[];
  /** Account / job title / phone tail — shown in grey, searchable. */
  hint?: string;
  disabled?: boolean;
};

// ---- Permission matrix ------------------------------------------------------------------

/** A column of the matrix. `scoped` actions carry a data scope per cell. */
export type MatrixAction = {
  id: string;
  label: string;
  scoped?: boolean;
  /** Tiers offered for this action (default: all five + custom when an org tree is given). */
  tiers?: readonly ScopeTier[];
};
export type FieldAbility = "read" | "write" | "export" | "mask";
export const FIELD_ABILITY_LABEL: Readonly<Record<FieldAbility, string>> = { read: "读", write: "写", export: "导出", mask: "脱敏" };
/** read: visible; write: editable; export: included in exports; mask: shown masked (needs read). */
export type FieldPolicy = { read: boolean; write: boolean; export: boolean; mask: boolean };
export type MatrixField = {
  id: string;
  label: string;
  /** Sensitive fields are marked in the UI (phone, ID number, amount). */
  sensitive?: boolean;
  /** Policy used when the value has no entry for this field (PLAN §3.5: default whitelist → all false). */
  defaultPolicy?: FieldPolicy;
};
/** A row of the matrix. */
export type MatrixResource = {
  id: string;
  label: string;
  /** Rows with the same group are shown under one collapsible group header. */
  group?: string;
  description?: string;
  /** Action ids that apply to this resource; others show「—」(not applicable). */
  actions: readonly string[];
  fields?: readonly MatrixField[];
  /** Dimensions the records of this resource carry (quanxian 2.2): only these are offered as scope filters. */
  dims?: readonly string[];
};
/** A granted cell. Scoped actions have a scope; unscoped ones leave it out. */
export type MatrixCell = { scope?: DataScope };
/**
 * Matrix value. `grants` keys are permission codes `resource:action` (absent = not granted);
 * `fields` keys are `resource.field` (absent = the field's defaultPolicy).
 */
export type PermissionMatrixValue = {
  grants: Readonly<Record<string, MatrixCell>>;
  fields?: Readonly<Record<string, FieldPolicy>>;
};

// ---- Effective access / explain (PLAN §3.6) -----------------------------------------------

/**
 * Where an allow comes from. `dept` = a role assigned to a department the person is in, `implied` =
 * contained in a wider code (manage includes use), `parent` = follows the parent record (a contact
 * follows its customer). quanxian/server reports these three kinds since 2.1 (2.0 sent `role` /
 * `record_grant` with a `detail`); both render correctly. `shared_record` = someone shared that one
 * record with the person (「阿杰共享的」), `field_default` = a field's default visibility decided it
 * (no role mentions the field, D15「字段默认可见」).
 */
export type AllowSourceKind = "role" | "post" | "dept" | "personal" | "implied" | "record_grant" | "parent" | "share_rule" | "superuser" | "delegation" | "shared_record" | "field_default";
/** What a row of the effective-access table is about (D15 类别 column). */
export type EffectiveCategory = "action" | "scope" | "field" | "record" | "subtable";
export const EFFECTIVE_CATEGORY_LABEL: Readonly<Record<EffectiveCategory, string>> = { action: "操作", scope: "数据范围", field: "字段", record: "指定记录", subtable: "子表" };
/** What blocks it. `not_granted` = no source at all; `condition` = row condition false / unknown. */
export type BlockKind =
  | "restriction"
  | "denied"
  | "tenant"
  | "feature_off"
  | "step_up"
  | "expired"
  | "not_granted"
  | "condition";
export const ALLOW_SOURCE_LABEL: Readonly<Record<AllowSourceKind, string>> = {
  role: "角色",
  post: "岗位",
  dept: "经由部门",
  personal: "个人加授",
  implied: "包含关系",
  record_grant: "记录授权",
  parent: "跟随上级记录",
  share_rule: "共享规则",
  superuser: "超级管理员",
  delegation: "委派",
  shared_record: "共享记录",
  field_default: "字段默认",
};
export const BLOCK_LABEL: Readonly<Record<BlockKind, string>> = {
  restriction: "收窄规则",
  denied: "个人禁用",
  tenant: "租户隔离",
  feature_off: "功能未开通",
  step_up: "需要二次验证",
  expired: "授权已到期",
  not_granted: "未授予",
  condition: "条件不满足",
};
export type AccessSource = {
  kind: AllowSourceKind;
  /** Role / post / grant / rule id for linking back. */
  id?: string;
  /** e.g. 「销售经理」「华东区岗位」「客户 C-1024 的编辑者」. */
  label: string;
  scope?: DataScope | null;
  level?: RecordLevel;
  expiresAt?: string | null;
  detail?: string;
  /** From an assignment that only applies there (quanxian 2.2); `label` e.g.「业务线「A 线」」. */
  within?: AssignScope & { label: string };
};
export type AccessBlock = {
  kind: BlockKind;
  id?: string;
  label: string;
  detail?: string;
};
/** One row of EffectiveAccessTable: a permission code for one subject. */
export type EffectiveAccessRow = {
  code: string;
  label: string;
  group?: string;
  allowed: boolean;
  /** Widest effective scope for scoped codes (null = not applicable). */
  scope?: DataScope | null;
  sources: readonly AccessSource[];
  blocks: readonly AccessBlock[];
  risk?: "normal" | "high";
  /** Held only through assignments limited to these places (quanxian 2.2), shown as「仅在 …」. */
  within?: readonly (AssignScope & { label: string })[];
  /** D15: 操作 / 数据范围 / 字段 / 指定记录 / 子表 — with it the table shows a 类别 column. */
  category?: EffectiveCategory;
};

/** Outcome of a single explain step (three-valued like the kernel's Conds.test). */
export type ExplainOutcome = "pass" | "fail" | "unknown" | "skip";
export type ExplainStage =
  | "tenant"
  | "feature"
  | "catalog"
  | "grant"
  | "restriction"
  | "personal"
  | "record"
  | "condition"
  | "field"
  | "step_up";
export const EXPLAIN_STAGE_LABEL: Readonly<Record<ExplainStage, string>> = {
  tenant: "租户",
  feature: "功能开通",
  catalog: "权限码",
  grant: "授予来源",
  restriction: "收窄规则",
  personal: "个人加减",
  record: "记录授权",
  condition: "行条件",
  field: "字段策略",
  step_up: "二次验证",
};
export type ExplainStep = {
  stage: ExplainStage;
  outcome: ExplainOutcome;
  label: string;
  detail?: string;
};
/** A condition evaluated to UNKNOWN because a column was NULL (top-level unknown = deny). */
export type ExplainUnknown = { field: string; label?: string; note?: string };
export type ExplainQuery = {
  subjectId: string;
  action: string;
  resourceType: string;
  /** Empty = list level (no row): the answer may be「conditional」. */
  resourceId?: string;
  /** Explain as seen within one place only (quanxian 2.2:「他在 A 线能不能」). */
  within?: AssignScope;
};
/**
 * `access.explain(action, resource, row?)` result. `conditional` only without a row: allowed for rows
 * matching `condition` (the list filter); with a row it is always allow / deny.
 */
export type ExplainResult = {
  query: ExplainQuery;
  subject: { id: string; label: string };
  decision: "allow" | "deny" | "conditional";
  allowedBy: readonly AccessSource[];
  blockedBy: readonly AccessBlock[];
  /** Decision path in evaluation order. */
  steps: readonly ExplainStep[];
  unknown?: readonly ExplainUnknown[];
  /** Human-readable effective condition, e.g. 「负责人 = 本人 或 部门 ∈ 华东区及以下」. */
  condition?: string;
  fields?: readonly ({ id: string; label: string } & FieldPolicy)[];
  evaluatedAt?: string;
};

// ---- Record team, requests, reviews --------------------------------------------------------

/** viewer ⊆ editor ⊆ owner. */
export type RecordLevel = "viewer" | "editor" | "owner";
export const RECORD_LEVEL_LABEL: Readonly<Record<RecordLevel, string>> = { viewer: "查看者", editor: "编辑者", owner: "负责人" };
/** Who a record grant is for. 「所有人」(`everyone`) has the id `"*"` (EVERYONE_ID). */
export type GrantSubject = { type: "user" | "group" | "dept" | "everyone"; id: string; name: string; hint?: string };
export const EVERYONE_ID = "*";
export const GRANT_SUBJECT_LABEL: Readonly<Record<GrantSubject["type"], string>> = { user: "成员", group: "用户组", dept: "部门", everyone: "所有人" };
/** One record grant (team member). */
export type RecordTeamMember = {
  /** Grant id. */
  id: string;
  subject: GrantSubject;
  level: RecordLevel;
  expiresAt?: string | null;
  reason?: string;
  grantedBy?: string;
  grantedAt?: string;
  /** Follows a parent resource (read-only here, edit it on the parent). */
  inheritedFrom?: string;
};
/**
 * One member to add. `subject.name` / `hint` are for display only: the server wants `{ type, id? }`
 * (no id for `everyone`) — send it through `teamAddPayload`.
 */
export type RecordTeamAddInput = { subject: GrantSubject; level: Exclude<RecordLevel, "owner">; expiresAt: string | null; reason: string };
/** The request body quanxian/server expects for「添加协作成员」. */
export type RecordTeamAddPayload = { subject: { type: GrantSubject["type"]; id?: string }; level: Exclude<RecordLevel, "owner">; expiresAt: string | null; reason: string };
/** Strip display-only fields: `{ type, id }` (no id for everyone). */
export function teamAddPayload(input: RecordTeamAddInput): RecordTeamAddPayload {
  const { type, id } = input.subject;
  return { subject: type === "everyone" ? { type } : { type, id }, level: input.level, expiresAt: input.expiresAt, reason: input.reason };
}
export type TransferOwnerInput = { toUserId: string; keepPreviousAs: "editor" | "viewer" | null; reason: string };

/** Request state machine (Casdoor-like): draft → pending → approved → active → expired / revoked; or rejected / cancelled. */
export type AccessRequestStatus = "draft" | "pending" | "approved" | "active" | "rejected" | "cancelled" | "expired" | "revoked";
export const REQUEST_STATUS_LABEL: Readonly<Record<AccessRequestStatus, string>> = {
  draft: "草稿",
  pending: "待审批",
  approved: "已批准",
  active: "生效中",
  rejected: "已驳回",
  cancelled: "已撤回",
  expired: "已到期",
  revoked: "已收回",
};
export type AccessRequestTarget = { kind: "role" | "permission" | "record" | "post"; id: string; label: string };
export type AccessRequest = {
  id: string;
  requester: { id: string; name: string; hint?: string };
  target: AccessRequestTarget;
  scope?: DataScope | null;
  level?: RecordLevel;
  reason: string;
  status: AccessRequestStatus;
  createdAt: string;
  /** Requested / granted expiry; null = permanent. */
  expiresAt?: string | null;
  /** Approval chain progress, e.g. 第 1 / 2 级：部门负责人. */
  step?: { current: number; total: number; label?: string };
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
};
export type RequestAction = "approve" | "reject" | "revoke" | "cancel";

/** Access review (复核) item: an existing grant someone has to keep or revoke. */
export type ReviewDecision = "keep" | "revoke";
export type ReviewItem = {
  id: string;
  subject: { id: string; name: string; hint?: string };
  grant: { kind: "role" | "permission" | "record" | "post"; label: string; scope?: DataScope | null };
  grantedAt?: string;
  /** Last time this grant was used; null = never (a strong revoke hint). */
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  decision?: ReviewDecision | null;
  note?: string;
};

// ---- Audit diff -----------------------------------------------------------------------

export type JsonDiffKind = "added" | "removed" | "changed";
/** One leaf difference; `path` uses dots and [i] for arrays. */
export type JsonDiffEntry = { path: string; kind: JsonDiffKind; before?: unknown; after?: unknown };
