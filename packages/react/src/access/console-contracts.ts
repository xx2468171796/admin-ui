/**
 * Server shapes for AccessConsole: the DTOs of the quanxian 2.0 management API (quanxian/fastify,
 * `quanxian/contracts`), mirrored structurally so this package stays free of a quanxian dependency.
 * Field names and meaning follow quanxian INTEGRATION §3.3–3.8; if the server adds fields, extra
 * properties pass through untouched. Pure types and constants: no React / DOM imports.
 */
import type { AssignScope, DataScope, EffectiveAccessRow, MatrixAction, MatrixField, MatrixResource, PermissionMatrixValue } from "./contracts.ts";

/** Codes the management API checks (quanxian `QX_PERMISSIONS`); the host may rename them. */
export const ACCESS_CONSOLE_CODES = {
  orgView: "qx:org.view",
  orgManage: "qx:org.manage",
  roleView: "qx:role.view",
  roleManage: "qx:role.manage",
  assignManage: "qx:assign.manage",
  groupManage: "qx:group.manage",
  explain: "qx:explain",
  auditView: "qx:audit.view",
} as const;
export type AccessConsoleCodes = { -readonly [K in keyof typeof ACCESS_CONSOLE_CODES]: string };

/** `GET /me/access` (= quanxian/simple whoami): what the signed-in person may do. */
export type AccessSnapshot = {
  userId: string;
  roles: readonly string[];
  superuser: boolean;
  elevated?: boolean;
  codes: readonly string[];
  pages?: readonly string[];
  scopes?: Readonly<Record<string, string>>;
  /**
   * Codes held only through scoped assignments (quanxian 2.2), grouped by where they apply. Except range-tier codes and codes the
   * catalog marks `withinScope`, these are NOT in `codes` (they don't count by default): show the menu entry
   * (`snapshotHolds(snap, code, "anywhere")`), then ask per line / dept (`snapshotHolds(snap, code, { dims: { line: "A" } })`).
   */
  contexts?: readonly { within: { dims?: Readonly<Record<string, string>>; deptId?: string }; codes: readonly string[] }[];
  /** quanxian 2.2.1: scope keys whose widest tier carries a dimension filter (`scopes` says 「全部」, it is 「全部 ∩ 我的业务线」). */
  scopeDims?: Readonly<Record<string, Readonly<Record<string, { mine?: boolean; values?: readonly string[]; includeNull?: boolean }>>>>;
};

/** quanxian 2.2.1: may the signed-in person assign roles to this department / post / person (same checks as the write path)? */
export type CanAssign = { ok: boolean; reason?: string };
/** quanxian 2.2.1: may the signed-in person cancel / change the expiry of this assignment (expiry: pre-check, saving checks again)? */
export type AssignEditable = { unassign: boolean; changeExpiry: boolean; reason?: string };

export type EntityStatus = "enabled" | "disabled";

export type DeptDto = {
  id: string;
  parentId: string | null;
  name: string;
  /** Materialized path of ids: /d1/d2/ */
  path: string;
  sort: number;
  status: EntityStatus;
  leaderIds: readonly string[];
  version: number;
  tenantId?: string | null;
  /** quanxian 2.2.1 (listDepts). */
  canAssign?: CanAssign;
};
export type DeptInput = { id?: string; parentId?: string | null; name: string; sort?: number; status?: EntityStatus };
export type DeptPatch = Partial<DeptInput> & { version: number };

export type PostDto = {
  id: string;
  deptId: string | null;
  code: string;
  name: string;
  sort: number;
  status: EntityStatus;
  version: number;
  tenantId?: string | null;
  /** quanxian 2.2.1 (listPosts). */
  canAssign?: CanAssign;
};
export type PostInput = { id?: string; deptId?: string | null; code: string; name: string; sort?: number; status?: EntityStatus };
export type PostPatch = Partial<PostInput> & { version: number };

/** One person's org data: departments (exactly one primary), posts, groups, departments he leads. */
export type UserOrgDto = {
  userId: string;
  depts: readonly { deptId: string; primary: boolean }[];
  postIds: readonly string[];
  groupIds: readonly string[];
  leads: readonly string[];
  /** Dimension values the person is in (quanxian 2.2), one primary per dimension. */
  dims?: readonly { dim: string; value: string; primary: boolean }[];
  /** quanxian 2.2.1 (getUserOrg): may the signed-in person assign roles to him. */
  canAssign?: CanAssign;
};

/** A value of a dimension (quanxian 2.2): 业务线 A / 区域 华东 … */
export type DimValueDto = {
  dim: string;
  id: string;
  name: string;
  sort: number;
  status: EntityStatus;
  version: number;
  tenantId?: string | null;
  /** How many people are in it. */
  members: number;
};
export type DimValueInput = { id?: string; name: string; sort?: number; status?: EntityStatus };
export type DimValuePatch = Partial<Omit<DimValueInput, "id">> & { version: number };
/** `GET /dims`: the dimensions the host registered in code, with their values. */
export type DimensionDto = { id: string; label: string; resources: readonly string[] | null; values: readonly DimValueDto[] };

/** `GET /catalog`: everything the role matrix needs. */
export type AccessCatalogDto = {
  resources: readonly MatrixResource[];
  actions: readonly MatrixAction[];
  codes: readonly { code: string; label: string; group: string; risk: "normal" | "high"; grantable: boolean; adminOnly: boolean; feature?: string }[];
  /** Dimensions the host registered (quanxian 2.2). */
  dimensions?: readonly { id: string; label: string }[];
  /** The server supports scoped assignments (quanxian 2.2); without it the assign dialog offers no scope (an older server would ignore it). */
  scopedAssignments?: boolean;
};

export type RoleDto = {
  id: string;
  code: string;
  name: string;
  description: string;
  builtin: boolean;
  superuser: boolean;
  disabled: boolean;
  baseRoleId: string | null;
  /** Codes this role may grant to others (「可授出」). */
  grantable: readonly string[];
  sort: number;
  version: number;
  tenantId?: string | null;
  permissions: PermissionMatrixValue;
  /** Row conditions of field policies (keys like permissions.fields); opaque here. */
  fieldConds?: Readonly<Record<string, unknown>>;
  updatedAt: string;
  updatedBy: string | null;
};
export type RoleInput = {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  superuser?: boolean;
  disabled?: boolean;
  baseRoleId?: string | null;
  grantable?: readonly string[];
  sort?: number;
  permissions?: PermissionMatrixValue;
  /**
   * Row conditions of field policies (keys like permissions.fields; RoleDto.fieldConds). Send them with `permissions` —
   * only for field keys in it; `{}` removes all conditions.
   */
  fieldConds?: Readonly<Record<string, unknown>>;
};
export type RolePatch = Partial<RoleInput> & { version: number; reason?: string };

export type AssignSubjectType = "user" | "post" | "dept";
export const ASSIGN_SUBJECT_LABEL: Readonly<Record<AssignSubjectType, string>> = { user: "人员", post: "岗位", dept: "部门" };
export type AssignmentDto = {
  subject: { type: AssignSubjectType; id: string };
  roleId: string;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string | null;
  reason: string;
  expired: boolean;
  /** Locked by the host (e.g. built-in role holders derived from the host's own account roles): no unassign / renew here; `reason` is shown instead. */
  locked?: { reason: string };
  /** Applies only there (quanxian 2.2); absent = everywhere. The same role may be assigned once per place. */
  scope?: AssignScope;
  /** quanxian 2.2.1 (listAssignments): what the signed-in person may do with this row; `reason` is the server's own words. */
  editable?: AssignEditable;
};
export type AssignInput = { subject: { type: AssignSubjectType; id: string }; roleId: string; expiresAt?: string | null; reason?: string; scope?: AssignScope | null };

export type OverrideDto = {
  userId: string;
  code: string;
  effect: "allow" | "deny";
  grantable: boolean;
  expiresAt: string | null;
  reason: string;
  grantedBy: string | null;
  grantedAt: string;
  expired: boolean;
  /** Set for targeted overrides (scope / field / record); `code` is then the server's key for it. */
  target?: OverrideTarget;
};
export type OverrideInput = { effect: "allow" | "deny"; grantable?: boolean; expiresAt?: string | null; reason?: string };
/**
 * What a personal add / deny is about (D15「加什么」). `action` = a permission code (the classic
 * override, `setOverride`); scope / field / record need an adapter with `setTargetOverride`.
 */
export type OverrideTarget =
  | { kind: "action"; code: string }
  | { kind: "scope"; code: string; scope: DataScope }
  | { kind: "field"; resource: string; field: string; ability: "read" | "write" }
  | { kind: "record"; resource: string; recordId: string; recordLabel?: string; level: "viewer" | "editor" };
export type TargetOverrideInput = OverrideInput & { target: OverrideTarget };

export type GroupDto = {
  id: string;
  name: string;
  description: string;
  kind: "group" | "team";
  version: number;
  tenantId?: string | null;
  members: readonly { userId: string; expiresAt: string | null; addedBy: string | null; addedAt: string }[];
};
export type GroupInput = { id?: string; name: string; description?: string; kind?: "group" | "team" };
export type GroupPatch = Partial<GroupInput> & { version: number };

/** `POST /view-as`: a short-lived, read-only look through someone else's eyes (audited). */
export type ViewAsDto = {
  token: string;
  userId: string;
  expiresAt: string;
  readOnly: true;
  snapshot: AccessSnapshot;
  effective: readonly EffectiveAccessRow[];
};

export type AuditEventDto = {
  id: string;
  at: string;
  actorId: string;
  actorName: string | null;
  onBehalfOf: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  diff?: readonly { path: string; kind: "added" | "removed" | "changed"; before?: unknown; after?: unknown }[];
  reason: string;
  requestId: string | null;
  tenantId?: string | null;
};
export type AuditQuery = { targetType?: string; targetId?: string; actorId?: string; action?: string; before?: string; limit?: number };

/** Uniform error body: `{ code, message, field?, permission?, fields?, traceId? }`. */
export type AccessErrorDto = {
  code: string;
  message: string;
  field?: string;
  permission?: string;
  fields?: readonly string[];
  traceId?: string;
};

/** People come from the host's identity module (quanxian has no user table). */
export type DirectoryUser = { id: string; name: string; deptIds: readonly string[]; hint?: string; disabled?: boolean };

/** Helpers re-exported for convenience in host adapters. */
export type { AssignScope, DataScope, MatrixField };
