/**
 * The data port of AccessConsole / RecordTeam: one method per quanxian/fastify management route
 * (quanxian INTEGRATION §3.4), plus `createAccessApi` — a fetch adapter for that API. Hosts with a
 * different backend implement `AccessApi` themselves. Errors are thrown as `AccessApiError` carrying
 * the server's `{ code, message, field?, permission?, fields? }` so pages can show them in place.
 * No React / DOM types beyond `fetch`.
 */
import type { AssignScope, EffectiveAccessRow, ExplainQuery, ExplainResult, OrgNode, RecordTeamAddPayload, RecordTeamMember, TransferOwnerInput } from "./contracts.ts";
import type {
  AccessCatalogDto,
  AccessErrorDto,
  AccessSnapshot,
  AssignInput,
  AssignmentDto,
  AssignSubjectType,
  AuditEventDto,
  AuditQuery,
  DeptDto,
  DimensionDto,
  DimValueDto,
  DimValueInput,
  DimValuePatch,
  DeptInput,
  DeptPatch,
  GroupDto,
  GroupInput,
  GroupPatch,
  OverrideDto,
  OverrideInput,
  TargetOverrideInput,
  PostDto,
  PostInput,
  PostPatch,
  RoleDto,
  RoleInput,
  RolePatch,
  UserOrgDto,
  ViewAsDto,
} from "./console-contracts.ts";

/** An error from the management API. `status` 0 = network failure (no response). */
export class AccessApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly permission?: string;
  readonly fields?: readonly string[];
  readonly traceId?: string;
  constructor(status: number, body: Partial<AccessErrorDto> & { message: string }) {
    super(body.message);
    this.name = "AccessApiError";
    this.status = status;
    this.code = body.code ?? (status === 0 ? "NETWORK" : `HTTP_${status}`);
    if (body.field) this.field = body.field;
    if (body.permission) this.permission = body.permission;
    if (body.fields) this.fields = body.fields;
    if (body.traceId) this.traceId = body.traceId;
  }
}

type Signal = AbortSignal | undefined;

/** One method per route. Every method takes an optional AbortSignal last. */
export type AccessApi = {
  me(signal?: Signal): Promise<AccessSnapshot>;
  catalog(signal?: Signal): Promise<AccessCatalogDto>;
  listDepts(signal?: Signal): Promise<DeptDto[]>;
  deptTree(signal?: Signal): Promise<OrgNode[]>;
  createDept(input: DeptInput, signal?: Signal): Promise<DeptDto>;
  updateDept(id: string, patch: DeptPatch, signal?: Signal): Promise<DeptDto>;
  deleteDept(id: string, signal?: Signal): Promise<void>;
  setDeptLeaders(id: string, userIds: readonly string[], signal?: Signal): Promise<DeptDto>;
  listPosts(signal?: Signal): Promise<PostDto[]>;
  createPost(input: PostInput, signal?: Signal): Promise<PostDto>;
  updatePost(id: string, patch: PostPatch, signal?: Signal): Promise<PostDto>;
  deletePost(id: string, signal?: Signal): Promise<void>;
  getUserOrg(userId: string, signal?: Signal): Promise<UserOrgDto>;
  setUserDepts(userId: string, depts: readonly { deptId: string; primary: boolean }[], signal?: Signal): Promise<UserOrgDto>;
  setUserPosts(userId: string, postIds: readonly string[], signal?: Signal): Promise<UserOrgDto>;
  /** Dimensions (quanxian 2.2). Optional so adapters for older servers keep compiling; without them the console hides dimension features. */
  listDims?(signal?: Signal): Promise<DimensionDto[]>;
  createDimValue?(dim: string, input: DimValueInput, signal?: Signal): Promise<DimValueDto>;
  updateDimValue?(dim: string, id: string, patch: DimValuePatch, signal?: Signal): Promise<DimValueDto>;
  deleteDimValue?(dim: string, id: string, signal?: Signal): Promise<void>;
  setUserDims?(userId: string, dim: string, values: readonly { value: string; primary: boolean }[], signal?: Signal): Promise<UserOrgDto>;
  listRoles(signal?: Signal): Promise<RoleDto[]>;
  getRole(id: string, signal?: Signal): Promise<RoleDto>;
  createRole(input: RoleInput, signal?: Signal): Promise<RoleDto>;
  updateRole(id: string, patch: RolePatch, signal?: Signal): Promise<RoleDto>;
  deleteRole(id: string, signal?: Signal): Promise<void>;
  listAssignments(filter: { subjectType?: AssignSubjectType; subjectId?: string; roleId?: string }, signal?: Signal): Promise<AssignmentDto[]>;
  assign(input: AssignInput, signal?: Signal): Promise<AssignmentDto>;
  unassign(input: { subject: { type: AssignSubjectType; id: string }; roleId: string; reason?: string; scope?: AssignScope | null }, signal?: Signal): Promise<void>;
  listOverrides(userId: string, signal?: Signal): Promise<OverrideDto[]>;
  setOverride(userId: string, code: string, input: OverrideInput, signal?: Signal): Promise<OverrideDto>;
  removeOverride(userId: string, code: string, reason?: string, signal?: Signal): Promise<void>;
  /**
   * Personal add / deny on a data scope, a field or one record (D15). Optional: without it the console
   * only offers permission codes. The server checks the editor holds what they grant and writes the audit.
   */
  setTargetOverride?(userId: string, input: TargetOverrideInput, signal?: Signal): Promise<OverrideDto>;
  /** Find records of a resource the editor may share (「指定记录」 picker); needed for record targets. */
  findRecords?(resource: string, query: string, signal?: Signal): Promise<{ id: string; label: string; hint?: string }[]>;
  listGroups(signal?: Signal): Promise<GroupDto[]>;
  createGroup(input: GroupInput, signal?: Signal): Promise<GroupDto>;
  updateGroup(id: string, patch: GroupPatch, signal?: Signal): Promise<GroupDto>;
  deleteGroup(id: string, signal?: Signal): Promise<void>;
  setGroupMembers(id: string, members: readonly { userId: string; expiresAt?: string | null }[], signal?: Signal): Promise<GroupDto>;
  listRecordGrants(type: string, id: string, signal?: Signal): Promise<RecordTeamMember[]>;
  grantRecord(type: string, id: string, input: RecordTeamAddPayload, signal?: Signal): Promise<RecordTeamMember>;
  revokeRecordGrant(type: string, id: string, grantId: string, reason?: string, signal?: Signal): Promise<void>;
  transferOwner(type: string, id: string, input: TransferOwnerInput, signal?: Signal): Promise<{ from: string | null; to: string }>;
  effective(userId: string, signal?: Signal): Promise<EffectiveAccessRow[]>;
  explain(query: ExplainQuery, signal?: Signal): Promise<ExplainResult>;
  viewAs(userId: string, reason: string, signal?: Signal): Promise<ViewAsDto>;
  viewAsGet(token: string, signal?: Signal): Promise<ViewAsDto>;
  listAudit(query: AuditQuery, signal?: Signal): Promise<AuditEventDto[]>;
};

export type CreateAccessApiOptions = {
  /** Where quanxianFastify is registered, e.g. "/api/qx". */
  baseUrl: string;
  /** Default: globalThis.fetch. */
  fetch?: typeof fetch;
  /** Extra headers per request (auth, CSRF, a demo x-user …). Called for every request. */
  headers?: () => Record<string, string> | undefined;
  /** Fetch credentials (default "same-origin"). */
  credentials?: RequestCredentials;
};

const enc = encodeURIComponent;

function qs(params: Readonly<Record<string, string | number | undefined | null>>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${enc(k)}=${enc(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Read an error body defensively: JSON `{ code, message }`, plain text, or nothing. */
export async function readAccessError(res: Response): Promise<AccessApiError> {
  let body: Partial<AccessErrorDto> | null = null;
  const text = await res.text().catch(() => "");
  try {
    body = text ? (JSON.parse(text) as Partial<AccessErrorDto>) : null;
  } catch {
    body = null;
  }
  const message =
    (body && typeof body.message === "string" && body.message) ||
    (res.status === 401 ? "登录已失效，请重新登录" : res.status === 403 ? "没有权限做这件事" : res.status === 404 ? "不存在或没有权限查看" : res.status >= 500 ? "服务器出错了，请稍后再试" : text.slice(0, 200) || `请求失败（${res.status}）`);
  return new AccessApiError(res.status, { ...(body ?? {}), message });
}

/** fetch adapter for quanxian/fastify. JSON in, JSON out; non-2xx → AccessApiError. */
export function createAccessApi(options: CreateAccessApiOptions): AccessApi {
  const base = options.baseUrl.replace(/\/$/, "");
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  async function call<T>(method: string, path: string, body?: unknown, signal?: Signal): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(base + path, {
        method,
        credentials: options.credentials ?? "same-origin",
        headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(options.headers?.() ?? {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
      });
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") throw e;
      throw new AccessApiError(0, { code: "NETWORK", message: "连不上服务器，请检查网络后重试" });
    }
    if (!res.ok) throw await readAccessError(res);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  const none = async (p: Promise<unknown>) => {
    await p;
  };
  return {
    me: (s) => call("GET", "/me/access", undefined, s),
    catalog: (s) => call("GET", "/catalog", undefined, s),
    listDepts: (s) => call("GET", "/depts", undefined, s),
    deptTree: (s) => call("GET", "/depts/tree", undefined, s),
    createDept: (input, s) => call("POST", "/depts", input, s),
    updateDept: (id, patch, s) => call("PATCH", `/depts/${enc(id)}`, patch, s),
    deleteDept: (id, s) => none(call("DELETE", `/depts/${enc(id)}`, undefined, s)),
    setDeptLeaders: (id, userIds, s) => call("PUT", `/depts/${enc(id)}/leaders`, { userIds }, s),
    listPosts: (s) => call("GET", "/posts", undefined, s),
    createPost: (input, s) => call("POST", "/posts", input, s),
    updatePost: (id, patch, s) => call("PATCH", `/posts/${enc(id)}`, patch, s),
    deletePost: (id, s) => none(call("DELETE", `/posts/${enc(id)}`, undefined, s)),
    getUserOrg: (userId, s) => call("GET", `/users/${enc(userId)}/org`, undefined, s),
    setUserDepts: (userId, depts, s) => call("PUT", `/users/${enc(userId)}/depts`, { depts }, s),
    setUserPosts: (userId, postIds, s) => call("PUT", `/users/${enc(userId)}/posts`, { postIds }, s),
    listDims: (s) => call("GET", "/dims", undefined, s),
    createDimValue: (dim, input, s) => call("POST", `/dims/${enc(dim)}/values`, input, s),
    updateDimValue: (dim, id, patch, s) => call("PATCH", `/dims/${enc(dim)}/values/${enc(id)}`, patch, s),
    deleteDimValue: (dim, id, s) => none(call("DELETE", `/dims/${enc(dim)}/values/${enc(id)}`, undefined, s)),
    setUserDims: (userId, dim, values, s) => call("PUT", `/users/${enc(userId)}/dims/${enc(dim)}`, { values }, s),
    listRoles: (s) => call("GET", "/roles", undefined, s),
    getRole: (id, s) => call("GET", `/roles/${enc(id)}`, undefined, s),
    createRole: (input, s) => call("POST", "/roles", input, s),
    updateRole: (id, patch, s) => call("PATCH", `/roles/${enc(id)}`, patch, s),
    deleteRole: (id, s) => none(call("DELETE", `/roles/${enc(id)}`, undefined, s)),
    listAssignments: (f, s) => call("GET", `/assignments${qs(f)}`, undefined, s),
    assign: (input, s) => call("POST", "/assignments", input, s),
    unassign: (input, s) => none(call("DELETE", `/assignments${qs({ subjectType: input.subject.type, subjectId: input.subject.id, roleId: input.roleId, reason: input.reason, scopeDim: input.scope?.dim, scopeValue: input.scope?.value, scopeDeptId: input.scope?.deptId })}`, undefined, s)),
    listOverrides: (userId, s) => call("GET", `/users/${enc(userId)}/overrides`, undefined, s),
    setOverride: (userId, code, input, s) => call("PUT", `/users/${enc(userId)}/overrides/${enc(code)}`, input, s),
    removeOverride: (userId, code, reason, s) => none(call("DELETE", `/users/${enc(userId)}/overrides/${enc(code)}${qs({ reason })}`, undefined, s)),
    listGroups: (s) => call("GET", "/groups", undefined, s),
    createGroup: (input, s) => call("POST", "/groups", input, s),
    updateGroup: (id, patch, s) => call("PATCH", `/groups/${enc(id)}`, patch, s),
    deleteGroup: (id, s) => none(call("DELETE", `/groups/${enc(id)}`, undefined, s)),
    setGroupMembers: (id, members, s) => call("PUT", `/groups/${enc(id)}/members`, { members }, s),
    listRecordGrants: (type, id, s) => call("GET", `/records/${enc(type)}/${enc(id)}/grants`, undefined, s),
    grantRecord: (type, id, input, s) => call("POST", `/records/${enc(type)}/${enc(id)}/grants`, input, s),
    revokeRecordGrant: (type, id, grantId, reason, s) => none(call("DELETE", `/records/${enc(type)}/${enc(id)}/grants/${enc(grantId)}${qs({ reason })}`, undefined, s)),
    transferOwner: (type, id, input, s) => call("POST", `/records/${enc(type)}/${enc(id)}/transfer`, input, s),
    effective: (userId, s) => call("GET", `/users/${enc(userId)}/effective`, undefined, s),
    explain: (query, s) => call("POST", "/explain", query, s),
    viewAs: (userId, reason, s) => call("POST", "/view-as", { userId, reason }, s),
    viewAsGet: (token, s) => call("GET", `/view-as/${enc(token)}`, undefined, s),
    listAudit: (query, s) => call("GET", `/audit${qs(query)}`, undefined, s),
  };
}
