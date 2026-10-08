/**
 * Pure rules of AccessConsole: which sections a person sees and may change (from the access
 * snapshot), how API errors read in place (403 anti-escalation, 409 version conflict …), the
 * department index / tree built from the flat list, role drafts, audit wording and option lists.
 * No React / DOM: unit-tested in test/access-console-core.test.ts.
 */
import { FIELD_ABILITY_LABEL, SCOPE_TIER_LABEL, type AssignScope, type FieldAbility, type MatrixResource, type OrgNode, type PermissionMatrixValue } from "./contracts.ts";
import { ACCESS_CONSOLE_CODES, type AccessCatalogDto, type AccessConsoleCodes, type AccessSnapshot, type AssignmentDto, type CanAssign, type DeptDto, type DirectoryUser, type RoleDto } from "./console-contracts.ts";
import { AccessApiError } from "./console-api.ts";
import { describeDims, diffMatrix, type DimNamer } from "./matrix-core.ts";
import { condToText } from "./governance/cond-core.ts";
import type { Cond } from "./governance/contracts.ts";

// ── Sections ──────────────────────────────────────────────────────────────

export type AccessConsoleSection = "org" | "roles" | "people" | "groups" | "explain" | "fields" | "audit";
export const ACCESS_CONSOLE_SECTION_LABEL: Readonly<Record<AccessConsoleSection, string>> = {
  org: "部门与岗位",
  roles: "角色",
  people: "人员授权",
  groups: "用户组",
  fields: "字段权限",
  explain: "权限解释",
  audit: "授权审计",
};
export const ACCESS_CONSOLE_SECTIONS: readonly AccessConsoleSection[] = ["org", "roles", "people", "groups", "fields", "explain", "audit"];

/** What one person may see / change in the console. Display only: the server checks every call. */
export type ConsoleRights = {
  can(code: string): boolean;
  org: { view: boolean; manage: boolean };
  roles: { view: boolean; manage: boolean };
  /** Assign roles, personal allow / deny. */
  assign: boolean;
  /**
   * quanxian 2.2: where the assign right is held when it is held only through scoped assignments (「只在 A 线管人」) —
   * assignments must then carry one of these scopes; null = held without a scope (anywhere).
   */
  assignWithin: readonly { dims?: Readonly<Record<string, string>>; deptId?: string }[] | null;
  /** quanxian 2.2: the same for the org-manage right; when set, people's departments / posts can't be changed (company-wide), only their dimension values. */
  orgWithin: readonly { dims?: Readonly<Record<string, string>>; deptId?: string }[] | null;
  /** The viewer is a superuser: only they may move departments (change parent) or set leaders (the server refuses everyone else). */
  superuser: boolean;
  /** Personal allow / deny: the assign right held without a scope (the server refuses line-scoped managers). */
  overrides: boolean;
  /** Create / edit / delete departments, posts and dimension values: the org-manage right held without a scope. */
  orgStructure: boolean;
  groups: { view: boolean; manage: boolean };
  explain: boolean;
  audit: boolean;
  /** Sections to show, in order. */
  sections: AccessConsoleSection[];
};

export function consoleRights(snapshot: (Pick<AccessSnapshot, "superuser" | "codes"> & Partial<Pick<AccessSnapshot, "contexts">>) | null | undefined, codes: Partial<AccessConsoleCodes> = {}): ConsoleRights {
  const c = { ...ACCESS_CONSOLE_CODES, ...codes };
  const held = new Set(snapshot?.codes ?? []);
  const su = snapshot?.superuser === true;
  const can = (code: string) => su || held.has(code) || held.has("*");
  const org = { view: can(c.orgView) || can(c.orgManage), manage: can(c.orgManage) };
  const roleManage = can(c.roleManage);
  const assign = can(c.assignManage);
  const roles = { view: can(c.roleView) || roleManage || assign, manage: roleManage };
  const groups = { view: roles.view || can(c.groupManage), manage: can(c.groupManage) };
  const explain = can(c.explain);
  const audit = can(c.auditView);
  const show: Record<AccessConsoleSection, boolean> = {
    org: org.view,
    roles: roles.view,
    people: org.view || roles.view || explain,
    groups: groups.view,
    fields: roles.view,
    explain,
    audit,
  };
  const scopedOf = (code: string) => (su ? [] : (snapshot?.contexts ?? []).filter((g) => g.codes.includes(code)).map((g) => g.within));
  const scopedAssign = scopedOf(c.assignManage);
  const scopedOrg = scopedOf(c.orgManage);
  return {
    can,
    org,
    roles,
    assign,
    assignWithin: scopedAssign.length ? scopedAssign : null,
    orgWithin: scopedOrg.length ? scopedOrg : null,
    superuser: su,
    overrides: assign && !scopedAssign.length,
    orgStructure: org.manage && !scopedOrg.length,
    groups,
    explain,
    audit,
    sections: ACCESS_CONSOLE_SECTIONS.filter((s) => show[s]),
  };
}

/** Is this a change to one's own access by a non-superuser? The server refuses it (no self-escalation): hide the controls. */
export function editsSelf(snapshot: Pick<AccessSnapshot, "userId" | "superuser">, userId: string): boolean {
  return !snapshot.superuser && snapshot.userId === userId;
}

type Within = { dims?: Readonly<Record<string, string>>; deptId?: string };

/** 「业务线「A 产品线」 · 部门「上海部」」, several places joined with「、」. */
export function withinText(within: readonly Within[], names: DimNamer & { dept?: (id: string) => string } = {}): string {
  return within
    .map((w) => [...Object.entries(w.dims ?? {}).map(([d, v]) => `${names.dim?.(d) ?? d}「${names.value?.(d, v) ?? v}」`), ...(w.deptId ? [`部门「${names.dept?.(w.deptId) ?? w.deptId}」`] : [])].join(" · "))
    .join("、");
}

/**
 * Does one of the editor's places cover an assignment's scope (quanxian Scopes.covers + assertScopeInMgmt)? Every dimension of
 * the place must be the assignment's; a place with a department needs the assignment's department (and, for post / dept
 * assignments, that post's / dept's department) inside its tree. An assignment without a scope is never covered.
 */
export function scopeCovered(within: readonly Within[], scope: AssignScope | null | undefined, opts: { subtree?: (deptId: string) => readonly string[]; subjectDept?: string | null } = {}): boolean {
  if (!scope || (!scope.dim && !scope.deptId)) return false;
  const tree = (id: string) => opts.subtree?.(id) ?? [id];
  return within.some((w) => {
    for (const [d, v] of Object.entries(w.dims ?? {})) if (scope.dim !== d || scope.value !== v) return false;
    if (!w.deptId) return true;
    const t = tree(w.deptId);
    if (!scope.deptId || !t.includes(scope.deptId)) return false;
    return opts.subjectDept === undefined || (!!opts.subjectDept && t.includes(opts.subjectDept));
  });
}

/**
 * Does this snapshot hold `code` (quanxian 2.2)? Display only — the server checks every call.
 *   · no `where`: the default — `codes` only (codes held only in some line / dept don't count);
 *   · `"anywhere"`: also when it is held somewhere (menu entries: the page then asks per line);
 *   · a place (`{ dims: { line: "A" } }` / `{ deptId }`): also when a scoped holding covers that place.
 * Dept trees aren't in the snapshot, so a dept place matches only the same dept (the server decides the rest).
 */
export function snapshotHolds(
  snapshot: Pick<AccessSnapshot, "superuser" | "codes" | "contexts"> | null | undefined,
  code: string,
  where?: "anywhere" | { dims?: Readonly<Record<string, string>>; deptId?: string },
): boolean {
  if (!snapshot) return false;
  if (snapshot.superuser || snapshot.codes.includes(code) || snapshot.codes.includes("*")) return true;
  if (!where) return false;
  const groups = (snapshot.contexts ?? []).filter((g) => g.codes.includes(code));
  if (where === "anywhere") return groups.length > 0;
  return groups.some((g) => {
    const dims = g.within.dims ?? {};
    for (const d of Object.keys(dims)) if (!Object.hasOwn(dims, d) || !where.dims || !Object.hasOwn(where.dims, d) || where.dims[d] !== dims[d]) return false;
    return !g.within.deptId || g.within.deptId === where.deptId;
  });
}

// ── Errors ────────────────────────────────────────────────────────────────

/**
 * What a row of assignments may offer: a locked assignment (decided by the host, e.g. a built-in role
 * holder derived from the host's own account role) offers nothing and shows why; otherwise unassign
 * (and renew, for direct user rows) when the viewer may manage assignments. quanxian 2.2: an editor who
 * holds the assign right only in some places (`within`) may only touch assignments inside one of them —
 * others get `blockedReason` (show the actions disabled with it; the server would refuse).
 */
export function assignmentActions(
  a: { locked?: { reason: string } | undefined; scope?: AssignScope | undefined; editable?: { unassign: boolean; changeExpiry: boolean; reason?: string } | undefined },
  manage: boolean,
  editor: { within?: readonly Within[] | null; subtree?: (deptId: string) => readonly string[]; subjectDept?: string | null; names?: DimNamer & { dept?: (id: string) => string } } = {},
): { unassign: boolean; renew: boolean; lockedReason: string | null; blockedReason: string | null } {
  if (a.locked) return { unassign: false, renew: false, lockedReason: a.locked.reason || "由系统决定", blockedReason: null };
  if (!manage) return { unassign: false, renew: false, lockedReason: null, blockedReason: null };
  // quanxian 2.2.1：服务端在每条上给了能不能动（和写接口同一套检查、同一句话）——照它；老服务端没给才按编辑人范围自己算
  if (a.editable) {
    const ok = a.editable.unassign && a.editable.changeExpiry;
    return { unassign: a.editable.unassign, renew: a.editable.changeExpiry, lockedReason: null, blockedReason: ok ? null : a.editable.reason || "你不能改这条分配" };
  }
  if (!editor.within) return { unassign: true, renew: true, lockedReason: null, blockedReason: null };
  if (scopeCovered(editor.within, a.scope, { ...(editor.subtree ? { subtree: editor.subtree } : {}), ...(editor.subjectDept !== undefined ? { subjectDept: editor.subjectDept } : {}) })) return { unassign: true, renew: true, lockedReason: null, blockedReason: null };
  const names = editor.names ?? {};
  const here = a.scope && (a.scope.dim || a.scope.deptId) ? `在${withinText([{ ...(a.scope.dim && a.scope.value ? { dims: { [a.scope.dim]: a.scope.value } } : {}), ...(a.scope.deptId ? { deptId: a.scope.deptId } : {}) }], names)}` : "不限范围";
  return { unassign: false, renew: false, lockedReason: null, blockedReason: `你只能管${withinText(editor.within, names)}上的分配，这条${here}，请找管理员` };
}

/**
 * The「分配角色」button of a department / post / person: hidden without the assign right; with quanxian 2.2.1's `canAssign`
 * not ok it stays visible but disabled with the server's reason (older servers: as before).
 */
export function assignButton(manage: boolean, canAssign: CanAssign | null | undefined): { show: boolean; disabledReason: string | null } {
  if (!manage) return { show: false, disabledReason: null };
  if (!canAssign || canAssign.ok) return { show: true, disabledReason: null };
  return { show: true, disabledReason: canAssign.reason || "你不能给它分配角色" };
}

/**
 * A list that failed to load: a 403 (e.g. a line-scoped manager opening someone outside his lines) is final — say why in
 * the server's words and offer no「重试」; anything else can be retried.
 */
export function listFailure(error: unknown): { forbidden: boolean; retry: boolean; message: string } {
  const v = errorView(error);
  const forbidden = !!error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "FORBIDDEN";
  return { forbidden, retry: !forbidden && !v.signIn, message: forbidden ? `${v.message}（权限不够，重试也没用；需要的话请找管理员）` : v.message };
}

export type ErrorView = {
  /** Short headline for InlineAlert. */
  title: string;
  /** The server's own words (Chinese, specific) or a plain fallback. */
  message: string;
  /** 409 version conflict: offer「重新加载」and keep the user's draft. */
  conflict: boolean;
  /** 401: the host should send the person to sign in. */
  signIn: boolean;
  /** A permission code that was missing (403 FORBIDDEN with permission). */
  permission?: string;
  field?: string;
};

const TITLE_BY_CODE: Readonly<Record<string, string>> = {
  FORBIDDEN: "没有权限",
  UNAUTHORIZED: "需要重新登录",
  CONFLICT: "数据已被别人改过",
  BUILTIN: "内置项不能改",
  NOT_EMPTY: "还有内容，不能删除",
  NOT_FOUND: "找不到这一项",
  INVALID: "填写有误",
  SOD_CONFLICT: "职责冲突",
  APPROVAL_REQUIRED: "需要审批",
  STEP_UP_REQUIRED: "需要二次验证",
  TOTP_REQUIRED: "需要先完成二次验证",
  FEATURE_DISABLED: "功能未开通",
  LOCKED: "已锁定，不能在这里改",
  NETWORK: "网络异常",
  INTERNAL: "服务器出错",
};

/** Field names the server puts in INVALID messages (「reason 不能为空」) → the words on the page. */
const FIELD_WORD: Readonly<Record<string, string>> = {
  reason: "原因",
  expiresAt: "到期时间",
  name: "名称",
  code: "编码",
  description: "说明",
  sort: "排序",
  status: "状态",
  parentId: "上级部门",
  deptId: "部门",
  deptIds: "部门",
  postIds: "岗位",
  userIds: "人员",
  userId: "人员",
  roleId: "角色",
  level: "权限",
  subject: "对象",
  scope: "范围",
  value: "值",
  values: "值",
  version: "版本",
  permissions: "权限",
  fieldConds: "字段条件",
  effect: "加 / 减",
  grantable: "可授出",
  toUserId: "新负责人",
};
/** Replace raw field paths (`reason`, `scope.value`, `permissions.fields.customer.amount`) in a server message with words. */
function plainFields(message: string, field?: string): string {
  const word = (path: string) => {
    const parts = path.split(".");
    for (let i = parts.length - 1; i >= 0; i--) if (Object.hasOwn(FIELD_WORD, parts[i]!)) return FIELD_WORD[parts[i]!]!;
    return null;
  };
  let out = message;
  const paths = new Set<string>([...(field ? [field] : []), ...Object.keys(FIELD_WORD)]);
  for (const p of [...paths].sort((a, b) => b.length - a.length)) {
    const w = word(p);
    if (!w) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_.])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])(?:\\.[A-Za-z0-9_.]*)?\\s?`, "g");
    out = out.replace(re, w);
  }
  return out;
}

/** Any thrown value → what to show in place (dialog error / InlineAlert). */
export function errorView(error: unknown): ErrorView {
  if (error instanceof AccessApiError || (error && typeof error === "object" && "status" in error && "code" in error && "message" in error)) {
    const e = error as AccessApiError;
    const conflict = e.code === "CONFLICT";
    const title = TITLE_BY_CODE[e.code] ?? (e.status >= 500 ? "服务器出错" : "操作没有成功");
    const internal = e.code === "INTERNAL" || e.status >= 500;
    const traceId = (e as { traceId?: string }).traceId;
    // 500（含 quanxian 2.2.1 的 INTERNAL）：细节不给页面，说一句能做什么，带上编号方便找日志
    const message = internal
      ? `服务器处理时出了问题，请稍后再试；一直不行就把编号${traceId ? ` ${traceId} ` : ""}告诉管理员。`
      : conflict && !/刷新|重新加载/.test(e.message)
        ? `${plainFields(e.message, e.field)}。请重新加载后再改，你填的内容还在页面上。`
        : plainFields(e.message, e.field);
    return { title, message, conflict, signIn: e.status === 401, ...(e.permission ? { permission: e.permission } : {}), ...(e.field ? { field: e.field } : {}) };
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "操作没有成功";
  return { title: "操作没有成功", message, conflict: false, signIn: false };
}

/** One line for a dialog error (FormDialog / ConfirmDialog show the thrown Error's message). */
export function errorLine(error: unknown): string {
  const v = errorView(error);
  return v.title === "填写有误" || v.title === "操作没有成功" ? v.message : `${v.title}：${v.message}`;
}

/** Re-throw as a plain Error whose message is the in-place text (for FormDialog / ConfirmDialog). */
export function asDialogError(error: unknown): Error {
  return new Error(errorLine(error));
}

// ── Departments ───────────────────────────────────────────────────────────

export type DeptIndex = {
  byId: ReadonlyMap<string, DeptDto>;
  children: ReadonlyMap<string | null, DeptDto[]>;
  name(id: string): string;
  /** 「总部 / 华东区 / 上海部」 */
  path(id: string): string;
  /** The department and all below it. */
  subtree(id: string): string[];
};

export function deptIndex(depts: readonly DeptDto[]): DeptIndex {
  const byId = new Map(depts.map((d) => [d.id, d]));
  const children = new Map<string | null, DeptDto[]>();
  for (const d of depts) {
    const parent = d.parentId && byId.has(d.parentId) ? d.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(d);
    children.set(parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh-CN"));
  const name = (id: string) => byId.get(id)?.name ?? `${id}（已不存在）`;
  const path = (id: string) => {
    const out: string[] = [];
    const seen = new Set<string>();
    let cur = byId.get(id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out.length ? out.join(" / ") : name(id);
  };
  const subtree = (id: string) => {
    const out: string[] = [];
    const walk = (x: string) => {
      out.push(x);
      for (const c of children.get(x) ?? []) walk(c.id);
    };
    if (byId.has(id)) walk(id);
    return out;
  };
  return { byId, children, name, path, subtree };
}

/** Flat department list → tree nodes (sorted, disabled departments marked「已停用」). */
export function deptTree(depts: readonly DeptDto[], count?: (deptId: string) => number): OrgNode[] {
  const idx = deptIndex(depts);
  const build = (parent: string | null): OrgNode[] =>
    (idx.children.get(parent) ?? []).map((d) => {
      const kids = build(d.id);
      const n = count?.(d.id);
      const hint = [d.status === "disabled" ? "已停用" : "", n !== undefined ? `${n} 人` : ""].filter(Boolean).join(" · ");
      return { id: d.id, label: d.name, ...(kids.length ? { children: kids } : {}), ...(hint ? { hint } : {}) };
    });
  return build(null);
}

/** Departments a dept may move under: not itself, not its own subtree. */
export function moveTargets(depts: readonly DeptDto[], id: string): DeptDto[] {
  const blocked = new Set(deptIndex(depts).subtree(id));
  return depts.filter((d) => !blocked.has(d.id));
}

/** Members of a department (direct) from the directory. */
export function deptMembers(users: readonly DirectoryUser[], deptId: string): DirectoryUser[] {
  return users.filter((u) => u.deptIds.includes(deptId));
}

// ── Roles ─────────────────────────────────────────────────────────────────

export const EMPTY_MATRIX: PermissionMatrixValue = Object.freeze({ grants: {}, fields: {} });

/** Normal form so saved vs draft compare equal when nothing changed. */
export function matrixOf(role: Pick<RoleDto, "permissions"> | null | undefined): PermissionMatrixValue {
  return { grants: { ...(role?.permissions.grants ?? {}) }, fields: { ...(role?.permissions.fields ?? {}) } };
}

export type RoleBasics = { name: string; description: string; disabled: boolean; superuser: boolean; baseRoleId: string | null; sort: number };
export function roleBasics(role: RoleDto | null | undefined): RoleBasics {
  return { name: role?.name ?? "", description: role?.description ?? "", disabled: role?.disabled ?? false, superuser: role?.superuser ?? false, baseRoleId: role?.baseRoleId ?? null, sort: role?.sort ?? 100 };
}

export type RoleDraftChange = { label: string; from: string; to: string };
const BASIC_LABEL: Readonly<Record<keyof RoleBasics, string>> = { name: "名称", description: "说明", disabled: "停用", superuser: "超级管理员", baseRoleId: "基础角色", sort: "排序" };

/** Changes of the basic fields (名称 · 原值 → 新值). */
export function roleBasicChanges(saved: RoleBasics, draft: RoleBasics, roleName: (id: string) => string = (id) => id): RoleDraftChange[] {
  const fmt = (k: keyof RoleBasics, v: unknown) => (typeof v === "boolean" ? (v ? "是" : "否") : k === "baseRoleId" ? (v ? roleName(String(v)) : "无") : v === "" ? "（空）" : String(v));
  return (Object.keys(BASIC_LABEL) as (keyof RoleBasics)[]).filter((k) => saved[k] !== draft[k]).map((k) => ({ label: BASIC_LABEL[k], from: fmt(k, saved[k]), to: fmt(k, draft[k]) }));
}

/** Is the role draft different from what was loaded? */
export function roleDirty(role: RoleDto | null, basics: RoleBasics, matrix: PermissionMatrixValue, catalog: AccessCatalogDto | null): boolean {
  if (!role) return basics.name.trim() !== "";
  if (roleBasicChanges(roleBasics(role), basics).length) return true;
  return catalog ? diffMatrix(matrixOf(role), matrix, catalog.resources, catalog.actions).length > 0 : false;
}

/**
 * The permission part of a role save / copy: the matrix plus the row conditions of field policies (RoleDto.fieldConds) for
 * the field keys still in the draft. Always sent — leaving `fieldConds` out made older servers drop every condition — and
 * never with keys missing from `permissions.fields` (the server rejects those).
 */
export function roleSaveBody(saved: Pick<RoleDto, "fieldConds"> | null | undefined, draft: PermissionMatrixValue): { permissions: PermissionMatrixValue; fieldConds: Record<string, unknown> } {
  const fields = draft.fields ?? {};
  const fieldConds: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(saved?.fieldConds ?? {})) if (v !== null && v !== undefined && Object.hasOwn(fields, k)) fieldConds[k] = v;
  return { permissions: draft, fieldConds };
}

/**
 * ChangeList rows about field row-conditions for a save: a condition whose field left the draft is dropped (「去掉」); a
 * condition on a field whose 读 / 写 / 导出 / 脱敏 changed is kept and still limits it to the matching records (「保留」).
 */
export function fieldCondChangeItems(saved: Pick<RoleDto, "fieldConds" | "permissions">, draft: PermissionMatrixValue, resources: readonly MatrixResource[]): { label: string; from: string; to: string; effect: string }[] {
  const out: { label: string; from: string; to: string; effect: string }[] = [];
  const fields = draft.fields ?? {};
  const savedFields = saved.permissions.fields ?? {};
  for (const [key, cond] of Object.entries(saved.fieldConds ?? {})) {
    if (cond === null || cond === undefined) continue;
    const dot = key.indexOf(".");
    const res = resources.find((r) => r.id === key.slice(0, dot));
    const fieldId = key.slice(dot + 1);
    const field = res?.fields?.find((f) => f.id === fieldId);
    const label = `${res?.label ?? key.slice(0, dot)} · 字段「${field?.label ?? fieldId}」的按行条件`;
    const text = condToText(cond as Cond, { field: (id) => res?.fields?.find((f) => f.id === id)?.label });
    if (!Object.hasOwn(fields, key)) out.push({ label, from: text, to: "去掉", effect: "这个字段不再单独配置" });
    else {
      const before = savedFields[key];
      const after = fields[key];
      const changed = !before || !after || (Object.keys(FIELD_ABILITY_LABEL) as FieldAbility[]).some((a) => !!before[a] !== !!after[a]);
      if (changed) out.push({ label, from: text, to: "保留", effect: "仍只对满足条件的记录生效" });
    }
  }
  return out;
}

/** Roles a person may pick as「基础角色」: not itself, not disabled. */
export function baseRoleOptions(roles: readonly RoleDto[], selfId?: string) {
  return roles.filter((r) => r.id !== selfId && !r.disabled).map((r) => ({ value: r.id, label: r.name }));
}

// ── Catalog-derived options ───────────────────────────────────────────────

/** Permission codes for「个人加 / 减」(scoped actions appear per tier code). */
export function codeOptions(catalog: AccessCatalogDto | null): { value: string; label: string; group: string; risk: "normal" | "high" }[] {
  // Catalog labels usually start with their group already (「客户 · 新增」in group「客户」): don't say it twice.
  const label = (c: { group: string; label: string }) => (!c.group || c.label === c.group || c.label.startsWith(`${c.group} `) || c.label.startsWith(`${c.group}·`) ? c.label : `${c.group} · ${c.label}`);
  return (catalog?.codes ?? []).map((c) => ({ value: c.code, label: label(c), group: c.group, risk: c.risk }));
}

/**
 * A key of the snapshot's data scopes (「customer」/「customer.view」/「customer:view」) in the catalog's words: 「客户 · 查看」.
 * Unknown keys stay as they are.
 */
export function scopeKeyLabel(key: string, catalog: Pick<AccessCatalogDto, "resources" | "actions"> | null): string {
  const cut = key.search(/[.:]/);
  const resId = cut < 0 ? key : key.slice(0, cut);
  const res = catalog?.resources.find((r) => r.id === resId);
  if (!res) return key;
  if (cut < 0) return res.label;
  const actId = key.slice(cut + 1);
  const act = catalog?.actions.find((a) => a.id === actId);
  return act ? `${res.label} · ${act.label}` : key;
}

/** Explain panel actions for one resource: scoped action ids first, then the remaining codes of that resource. */
export function explainActions(catalog: AccessCatalogDto | null, resourceType: string): { id: string; label: string; hint?: string }[] {
  if (!catalog) return [];
  const res = catalog.resources.find((r) => r.id === resourceType);
  const out: { id: string; label: string; hint?: string }[] = [];
  for (const a of res?.actions ?? []) {
    const action = catalog.actions.find((x) => x.id === a);
    if (action?.scoped) out.push({ id: a, label: `${action.label}（按数据范围）`, hint: a });
    else out.push({ id: `${resourceType}:${a}`, label: action?.label ?? a, hint: `${resourceType}:${a}` });
  }
  return out;
}

const KERNEL_TIER: Readonly<Record<string, string>> = { self: "own", self_and_subordinates: "subordinates", tenant: "all" };
/** Tier label for page words (own …) and kernel words in snapshots (self / self_and_subordinates / none). */
export function tierLabel(tier: string): string {
  if (tier === "none") return "无";
  const t = KERNEL_TIER[tier] ?? tier;
  return (SCOPE_TIER_LABEL as Record<string, string>)[t] ?? tier;
}

// ── People / audit wording ────────────────────────────────────────────────

export function userNamer(users: readonly DirectoryUser[]): (id: string | null | undefined) => string {
  const map = new Map(users.map((u) => [u.id, u.name]));
  return (id) => (!id ? "—" : id.startsWith("system:") ? `系统（${id.slice(7)}）` : (map.get(id) ?? id));
}

const AUDIT_ACTION_LABEL: Readonly<Record<string, string>> = {
  "dept.create": "新建部门",
  "dept.update": "修改部门",
  "dept.delete": "删除部门",
  "dept.leaders": "设置部门负责人",
  "post.create": "新建岗位",
  "post.update": "修改岗位",
  "post.delete": "删除岗位",
  "user.depts": "调整所属部门",
  "user.posts": "调整岗位",
  "role.create": "新建角色",
  "role.update": "修改角色",
  "role.delete": "删除角色",
  "role.sync-create": "内置角色同步（新增）",
  "role.sync-update": "内置角色同步（更新）",
  "role.sync-disable": "内置角色同步（停用）",
  "role.assign": "分配角色",
  "role.unassign": "取消分配",
  "override.set": "个人加 / 减",
  "override.remove": "去掉个人加 / 减",
  "group.create": "新建用户组",
  "group.update": "修改用户组",
  "group.delete": "删除用户组",
  "group.members": "调整组成员",
  "record.grant": "添加协作成员",
  "record.revoke": "移出协作成员",
  "record.transfer-owner": "转移负责人",
  "record.release-owner": "回收到公海",
  "access.view-as": "以他视角预览",
  "access.view-as.cross-tenant": "跨租户以他视角预览",
  // 维度（quanxian 2.2）：「业务线」等名字按事件里的维度换上（auditActionLabel 第二个参数）
  "user.dims": "调整维度归属",
  "dim.create": "新建维度值",
  "dim.update": "修改维度值",
  "dim.delete": "删除维度值",
  // 治理（申请 / 复核 / 规则 / 紧急提权 / 租户）
  "request.submit": "提交申请",
  "request.approve": "批准申请",
  "request.reject": "驳回申请",
  "request.cancel": "撤回申请",
  "request.revoke": "收回申请的权限",
  "request.activate-failed": "申请生效失败",
  "request.activate-error": "申请生效出错",
  "approval-policy.create": "新建审批流程",
  "approval-policy.update": "修改审批流程",
  "approval-policy.delete": "删除审批流程",
  "emergency.start": "开始紧急提权",
  "emergency.use": "使用紧急提权",
  "emergency.end": "结束紧急提权",
  "emergency.review": "复核紧急提权",
  "review.create": "发起权限复核",
  "review.keep": "复核：保留",
  "review.revoke": "复核：收回",
  "review.close": "结束权限复核",
  "rule.share.create": "新建共享规则",
  "rule.share.update": "修改共享规则",
  "rule.share.delete": "删除共享规则",
  "rule.restriction.create": "新建收窄规则",
  "rule.restriction.update": "修改收窄规则",
  "rule.restriction.delete": "删除收窄规则",
  "rule.sod.create": "新建职责分离规则",
  "rule.sod.update": "修改职责分离规则",
  "rule.sod.delete": "删除职责分离规则",
  "member.add": "添加租户成员",
  "member.update": "修改租户成员",
  "member.remove": "移除租户成员",
  "tenant.create": "新建租户",
  "tenant.seed": "初始化租户",
  "tenant.update": "修改租户",
  "tenant.delete": "删除租户",
  "package.create": "新建套餐",
  "package.update": "修改套餐",
  "package.delete": "删除套餐",
  "system.cross-tenant": "跨租户操作",
};
const DIM_ACTION: Readonly<Record<string, (dim: string) => string>> = {
  "user.dims": (d) => `调整${d}`,
  "dim.create": (d) => `新建${d}`,
  "dim.update": (d) => `修改${d}`,
  "dim.delete": (d) => `删除${d}`,
};
/** An audit action in words; `dimLabel` names the dimension of dimension events (「调整业务线」「新建业务线」). Unknown actions stay as they are. */
export function auditActionLabel(action: string, dimLabel?: string): string {
  const dim = dimLabel ? DIM_ACTION[action] : undefined;
  return dim ? dim(dimLabel!) : (AUDIT_ACTION_LABEL[action] ?? action);
}
export const AUDIT_ACTION_OPTIONS: readonly { value: string; label: string }[] = Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ value, label }));
/** Audit action filter options; with one registered dimension its name replaces「维度」. */
export function auditActionOptions(dimLabel?: string): { value: string; label: string }[] {
  return Object.keys(AUDIT_ACTION_LABEL).map((value) => ({ value, label: auditActionLabel(value, dimLabel) }));
}

/** The dimension an audit event is about: `dim:<id>` targets (value create / update / delete) and「user.dims」(after / before .dim). */
export function auditEventDim(e: { action: string; targetType: string; before: unknown; after: unknown }): string | null {
  if (e.targetType.startsWith("dim:")) return e.targetType.slice(4) || null;
  if (e.action !== "user.dims") return null;
  for (const v of [e.after, e.before]) if (v && typeof v === "object" && typeof (v as { dim?: unknown }).dim === "string") return (v as { dim: string }).dim;
  return null;
}

const TARGET_LABEL: Readonly<Record<string, string>> = {
  dept: "部门",
  post: "岗位",
  role: "角色",
  user: "人员",
  group: "用户组",
  access_request: "权限申请",
  approval_policy: "审批流程",
  review: "权限复核",
  share_rule: "共享规则",
  restriction_rule: "收窄规则",
  sod_rule: "职责分离规则",
  tenant: "租户",
  package: "套餐",
  system: "系统",
};
/** An audit target type in words; `dim:<id>` reads as the dimension's name (`dimLabel`) or「维度值」. */
export function auditTargetLabel(type: string, dimLabel?: string): string {
  if (type.startsWith("dim:")) return dimLabel ?? "维度值";
  return TARGET_LABEL[type] ?? type;
}

/** Remaining time of a view-as preview: 「9 分 05 秒」/「已结束」. */
export function remainingText(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "已结束";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} 分 ${String(s % 60).padStart(2, "0")} 秒` : `${s} 秒`;
}

/** Local datetime-input value → ISO (null = permanent); throws on past times. */
export function futureIso(local: string, now: Date = new Date()): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error("到期时间格式不对");
  if (d.getTime() <= now.getTime()) throw new Error("到期时间要晚于现在");
  return d.toISOString();
}

/**
 * Values the assign dialog offers for「只在这个业务线上」(quanxian 2.2): only values the person is in (a user target — the server
 * refuses others), and only within the editor's own scopes when the editor holds the assign right only in some places
 * (then「不限」is not offered either — the server would refuse an unscoped assignment). Posts / departments: no target filter.
 */
export function assignPlaceOptions(
  dimensions: readonly { id: string; label: string; values: readonly { id: string; name: string; disabled?: boolean }[] }[],
  opts: { target?: readonly { dim: string; value: string }[] | null; editor?: readonly { dims?: Readonly<Record<string, string>>; deptId?: string }[] | null } = {},
): { values: { dim: string; value: string; label: string }[]; allowAny: boolean } {
  const editor = opts.editor ?? null;
  const values = dimensions.flatMap((d) =>
    d.values
      .filter((v) => !v.disabled)
      .filter((v) => !opts.target || opts.target.some((x) => x.dim === d.id && x.value === v.id))
      .filter((v) => !editor || editor.some((w) => !!w.dims && Object.hasOwn(w.dims, d.id) && w.dims[d.id] === v.id))
      .map((v) => ({ dim: d.id, value: v.id, label: dimensions.length > 1 ? `${d.label} · ${v.name}` : v.name })),
  );
  return { values, allowAny: !editor };
}

/**
 * The「数据范围」lines of a view-as snapshot: catalog names, the tier, and (quanxian 2.2.1 `scopeDims`) the dimension filter of
 * the widest tier —「客户 · 查看：全部 ∩ 我的业务线」instead of a bare「全部」.
 */
export function snapshotScopeLines(snapshot: Pick<AccessSnapshot, "scopes" | "scopeDims">, catalog: Pick<AccessCatalogDto, "resources" | "actions"> | null, names: DimNamer = {}): string[] {
  return Object.entries(snapshot.scopes ?? {}).map(([k, t]) => {
    const dims = snapshot.scopeDims && Object.hasOwn(snapshot.scopeDims, k) ? describeDims(snapshot.scopeDims[k], names) : "";
    return `${scopeKeyLabel(k, catalog)}：${tierLabel(t)}${dims ? ` ∩ ${dims}` : ""}`;
  });
}

// ── Batches / dimension impact ────────────────────────────────────────────

/** Run `add` for each item one by one; keep going after a failure and report what made it and what didn't (with the reason). */
export async function addEach<T>(items: readonly T[], add: (item: T) => Promise<unknown>, name: (item: T) => string): Promise<{ added: string[]; failed: { name: string; message: string }[] }> {
  const added: string[] = [];
  const failed: { name: string; message: string }[] = [];
  for (const item of items) {
    try {
      await add(item);
      added.push(name(item));
    } catch (e) {
      failed.push({ name: name(item), message: errorLine(e) });
    }
  }
  return { added, failed };
}

/** 「已添加：张三、王五。没加上：李四（原因）」; null when everything was added. */
export function addEachText(r: { added: readonly string[]; failed: readonly { name: string; message: string }[] }): string | null {
  if (!r.failed.length) return null;
  const failed = `没加上：${r.failed.map((f) => `${f.name}（${f.message}）`).join("、")}`;
  return r.added.length ? `已添加：${r.added.join("、")}。${failed}` : failed;
}

/**
 * What disabling a dimension value does, for the confirm dialog: its people no longer count as in it and assignments
 * 「只在这个值上」stop counting (nothing is deleted). `assignments` null = couldn't count them (no right to list).
 */
export function dimValueDisableImpact(dim: { id: string; label: string }, value: { id: string; name: string; members: number }, assignments: readonly Pick<AssignmentDto, "scope">[] | null): string {
  const head = `停用${dim.label}「${value.name}」：`;
  const scoped = assignments ? assignments.filter((a) => a.scope?.dim === dim.id && a.scope.value === value.id).length : null;
  if (value.members === 0 && scoped === 0) return `${head}现在没有人在里面，也没有只在这里的角色分配。重新启用后恢复。`;
  const people = value.members > 0 ? `里面的 ${value.members} 人不再算在这个${dim.label}里` : `现在没有人在里面`;
  const grants = scoped === null ? `「只在 ${value.name}」的角色分配也不再生效` : scoped > 0 ? `${scoped} 条「只在 ${value.name}」的角色分配也不再生效` : "没有只在这里的角色分配";
  return `${head}${people}，${grants}。人和分配都不删，重新启用后恢复。`;
}
