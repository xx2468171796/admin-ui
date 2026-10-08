/**
 * Typed HTTP client for the quanxian governance routes (default prefix `/api/qx`). Pure: no React,
 * no globals except `fetch`. The tenant comes from the server session, never from the client.
 *
 *   const api = createGovernanceApi();                       // same-origin /api/qx
 *   const api = createGovernanceApi({ baseUrl: "/admin/api/qx", fetch: authedFetch });
 *
 * Every method takes an optional `{ signal }` last. Non-2xx answers throw GovernanceApiError carrying
 * the server's `{ code, message, field?, permission? }`; network failures throw code "NETWORK".
 * The pages only depend on the GovernanceApi interface, so a host may also hand-write an adapter.
 */
import type {
  AccessRequestDto,
  AccessRequestInput,
  ApprovalPolicyDto,
  ApprovalPolicyInput,
  EmergencyInput,
  EmergencyReviewInput,
  GovAuditEventDto,
  GovErrorDto,
  GovViewAsDto,
  GovViewAsInput,
  HealthReportDto,
  PackageDto,
  PackageInput,
  RequestQuery,
  RestrictionRuleDto,
  RestrictionRuleInput,
  ReviewCampaignDto,
  ReviewCampaignInput,
  ReviewDecisionInput,
  ReviewItemDto,
  RuleImpactDto,
  RulePreviewInput,
  ShareRuleDto,
  ShareRuleInput,
  SodRuleDto,
  SodRuleInput,
  SodViolationDto,
  TenantContextDto,
  TenantCreateInput,
  TenantDto,
  TenantMemberDto,
  TenantMemberInput,
  TenantMemberPatch,
  TenantUpdateInput,
} from "./contracts.ts";

export type GovCallOptions = { signal?: AbortSignal };
type O = GovCallOptions;

/** Error thrown by GovernanceApi calls: server code + Chinese message + optional field. */
export class GovernanceApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;
  readonly permission?: string;
  readonly fields?: readonly string[];
  constructor(status: number, dto: GovErrorDto) {
    super(dto.message);
    this.name = "GovernanceApiError";
    this.code = dto.code;
    this.status = status;
    if (dto.field) this.field = dto.field;
    if (dto.permission) this.permission = dto.permission;
    if (dto.fields) this.fields = dto.fields;
  }
}

/** One CRUD collection of rules / policies / packages. */
export interface GovCollection<D, I> {
  list(o?: O): Promise<D[]>;
  create(input: I, o?: O): Promise<D>;
  update(id: string, input: I, o?: O): Promise<D>;
  remove(id: string, o?: O): Promise<void>;
}
export interface GovRuleCollection<D, I> extends GovCollection<D, I> {
  preview(input: RulePreviewInput, o?: O): Promise<RuleImpactDto>;
}

export interface GovernanceApi {
  /** `GET /tenant`. */
  tenant(o?: O): Promise<TenantContextDto>;
  members: {
    list(o?: O): Promise<TenantMemberDto[]>;
    add(input: TenantMemberInput, o?: O): Promise<TenantMemberDto>;
    update(userId: string, patch: TenantMemberPatch, o?: O): Promise<TenantMemberDto>;
    remove(userId: string, reason: string, o?: O): Promise<void>;
  };
  shareRules: GovRuleCollection<ShareRuleDto, ShareRuleInput>;
  restrictionRules: GovRuleCollection<RestrictionRuleDto, RestrictionRuleInput>;
  sodRules: GovCollection<SodRuleDto, SodRuleInput> & { violations(o?: O): Promise<SodViolationDto[]> };
  approvalPolicies: GovCollection<ApprovalPolicyDto, ApprovalPolicyInput>;
  requests: {
    list(query?: RequestQuery, o?: O): Promise<AccessRequestDto[]>;
    get(id: string, o?: O): Promise<AccessRequestDto>;
    create(input: AccessRequestInput, o?: O): Promise<AccessRequestDto>;
    submit(id: string, note?: string, o?: O): Promise<AccessRequestDto>;
    approve(id: string, note?: string, o?: O): Promise<AccessRequestDto>;
    /** A note is required. */
    reject(id: string, note: string, o?: O): Promise<AccessRequestDto>;
    cancel(id: string, note?: string, o?: O): Promise<AccessRequestDto>;
    /** A note is required. */
    revoke(id: string, note: string, o?: O): Promise<AccessRequestDto>;
  };
  emergency: {
    start(input: EmergencyInput, o?: O): Promise<AccessRequestDto>;
    end(id: string, o?: O): Promise<AccessRequestDto>;
    review(id: string, input: EmergencyReviewInput, o?: O): Promise<AccessRequestDto>;
    actions(id: string, o?: O): Promise<GovAuditEventDto[]>;
  };
  reviews: {
    list(o?: O): Promise<ReviewCampaignDto[]>;
    create(input: ReviewCampaignInput, o?: O): Promise<ReviewCampaignDto>;
    get(id: string, o?: O): Promise<ReviewCampaignDto>;
    /** `mine` = only items I review. */
    items(id: string, query?: { mine?: boolean }, o?: O): Promise<ReviewItemDto[]>;
    decide(id: string, itemId: string, input: ReviewDecisionInput, o?: O): Promise<ReviewItemDto>;
    close(id: string, o?: O): Promise<ReviewCampaignDto>;
  };
  /** `GET /health` (tenant). */
  health(o?: O): Promise<HealthReportDto>;
  platform: {
    packages: GovCollection<PackageDto, PackageInput>;
    tenants: {
      list(o?: O): Promise<TenantDto[]>;
      create(input: TenantCreateInput, o?: O): Promise<TenantDto>;
      get(id: string, o?: O): Promise<TenantContextDto>;
      update(id: string, input: TenantUpdateInput, o?: O): Promise<TenantDto>;
      suspend(id: string, reason: string, o?: O): Promise<TenantDto>;
      resume(id: string, o?: O): Promise<TenantDto>;
      /** `confirm` must equal the tenant id (typed by the operator). */
      remove(id: string, input: { confirm: string; reason: string }, o?: O): Promise<void>;
      members(id: string, o?: O): Promise<TenantMemberDto[]>;
    };
    viewAs(input: GovViewAsInput, o?: O): Promise<GovViewAsDto>;
    health(o?: O): Promise<HealthReportDto>;
  };
}

export type GovernanceApiOptions = {
  /** Route prefix, default "/api/qx" (no trailing slash needed). */
  baseUrl?: string;
  /** Injected fetch (auth headers, CSRF, tests). Default: global fetch with same-origin cookies. */
  fetch?: typeof fetch;
  /** Extra headers on every request (e.g. a CSRF token). */
  headers?: Record<string, string>;
};

/** Build a query string from defined values only ("" / undefined / false are dropped). */
export function govQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    q.set(k, v === true ? "1" : String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Server error body → GovErrorDto, tolerant of non-JSON proxies. */
export function parseGovError(status: number, text: string): GovErrorDto {
  try {
    const body = JSON.parse(text) as Partial<GovErrorDto> | null;
    if (body && typeof body === "object" && typeof body.message === "string" && body.message) {
      return { ...body, code: typeof body.code === "string" ? body.code : `HTTP_${status}`, message: body.message } as GovErrorDto;
    }
  } catch {
    // fall through: plain-text / HTML error page
  }
  const fallback: Record<number, string> = {
    401: "登录已失效，请重新登录",
    403: "没有权限执行这个操作",
    404: "要找的内容不存在或已被删除",
    409: "数据已被别人修改，请刷新后重试",
  };
  return { code: `HTTP_${status}`, message: fallback[status] ?? `请求失败（HTTP ${status}），请稍后重试` };
}

export function createGovernanceApi(options: GovernanceApiOptions = {}): GovernanceApi {
  const base = (options.baseUrl ?? "/api/qx").replace(/\/+$/, "");
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const enc = encodeURIComponent;

  async function call<T>(method: string, path: string, body?: unknown, o?: O): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json", ...options.headers };
    if (body !== undefined) headers["content-type"] = "application/json";
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method,
        headers,
        credentials: "same-origin",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(o?.signal ? { signal: o.signal } : {}),
      });
    } catch (error) {
      if (o?.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new GovernanceApiError(0, { code: "NETWORK", message: "网络连接失败，请检查网络后重试" });
    }
    const text = await response.text();
    if (!response.ok) throw new GovernanceApiError(response.status, parseGovError(response.status, text));
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GovernanceApiError(response.status, { code: "BAD_RESPONSE", message: "服务器返回的不是有效数据，请稍后重试" });
    }
  }
  const get = <T>(path: string, o?: O) => call<T>("GET", path, undefined, o);
  const post = <T>(path: string, body: unknown, o?: O) => call<T>("POST", path, body, o);
  const patch = <T>(path: string, body: unknown, o?: O) => call<T>("PATCH", path, body, o);
  const del = (path: string, body?: unknown, o?: O) => call<void>("DELETE", path, body, o);
  const note = (n?: string) => (n ? { note: n } : {});

  function collection<D, I>(path: string): GovCollection<D, I> {
    return {
      list: (o) => get<D[]>(path, o),
      create: (input, o) => post<D>(path, input, o),
      update: (id, input, o) => patch<D>(`${path}/${enc(id)}`, input, o),
      remove: (id, o) => del(`${path}/${enc(id)}`, undefined, o),
    };
  }
  function rules<D, I>(path: string): GovRuleCollection<D, I> {
    return { ...collection<D, I>(path), preview: (input, o) => post<RuleImpactDto>(`${path}/preview`, input, o) };
  }
  const decision = (action: string) => (id: string, n?: string, o?: O) => post<AccessRequestDto>(`/requests/${enc(id)}/${action}`, note(n), o);

  return {
    tenant: (o) => get("/tenant", o),
    members: {
      list: (o) => get("/members", o),
      add: (input, o) => post("/members", input, o),
      update: (userId, body, o) => patch(`/members/${enc(userId)}`, body, o),
      remove: (userId, reason, o) => del(`/members/${enc(userId)}${govQuery({ reason })}`, undefined, o),
    },
    shareRules: rules("/rules/share"),
    restrictionRules: rules("/rules/restrictions"),
    sodRules: { ...collection<SodRuleDto, SodRuleInput>("/rules/sod"), violations: (o) => get("/rules/sod/violations", o) },
    approvalPolicies: collection("/approval-policies"),
    requests: {
      list: (query = {}, o) => get(`/requests${govQuery({ view: query.view, status: query.status, kind: query.kind, limit: query.limit })}`, o),
      get: (id, o) => get(`/requests/${enc(id)}`, o),
      create: (input, o) => post("/requests", input, o),
      submit: decision("submit"),
      approve: decision("approve"),
      reject: decision("reject"),
      cancel: decision("cancel"),
      revoke: decision("revoke"),
    },
    emergency: {
      start: (input, o) => post("/emergency", input, o),
      end: (id, o) => post(`/emergency/${enc(id)}/end`, {}, o),
      review: (id, input, o) => post(`/emergency/${enc(id)}/review`, input, o),
      actions: (id, o) => get(`/emergency/${enc(id)}/actions`, o),
    },
    reviews: {
      list: (o) => get("/reviews", o),
      create: (input, o) => post("/reviews", input, o),
      get: (id, o) => get(`/reviews/${enc(id)}`, o),
      items: (id, query = {}, o) => get(`/reviews/${enc(id)}/items${govQuery({ mine: query.mine })}`, o),
      decide: (id, itemId, input, o) => post(`/reviews/${enc(id)}/items/${enc(itemId)}/decide`, input, o),
      close: (id, o) => post(`/reviews/${enc(id)}/close`, {}, o),
    },
    health: (o) => get("/health", o),
    platform: {
      packages: collection("/platform/packages"),
      tenants: {
        list: (o) => get("/platform/tenants", o),
        create: (input, o) => post("/platform/tenants", input, o),
        get: (id, o) => get(`/platform/tenants/${enc(id)}`, o),
        update: (id, input, o) => patch(`/platform/tenants/${enc(id)}`, input, o),
        suspend: (id, reason, o) => post(`/platform/tenants/${enc(id)}/suspend`, { reason }, o),
        resume: (id, o) => post(`/platform/tenants/${enc(id)}/resume`, {}, o),
        remove: (id, input, o) => del(`/platform/tenants/${enc(id)}`, input, o),
        members: (id, o) => get(`/platform/tenants/${enc(id)}/members`, o),
      },
      viewAs: (input, o) => post("/platform/view-as", input, o),
      health: (o) => get("/platform/health", o),
    },
  };
}

/** Human message for any error a GovernanceApi call may throw (adds the field when the server named one). */
export function govErrorMessage(error: unknown, fieldLabel?: (field: string) => string | undefined): string {
  if (error instanceof GovernanceApiError) {
    const label = error.field ? fieldLabel?.(error.field) : undefined;
    return label && !error.message.includes(label) ? `${label}：${error.message}` : error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "操作失败，请重试";
}
