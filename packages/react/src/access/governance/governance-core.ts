/**
 * Tenants, packages, quotas, rule impact, security health and permission flags for the governance
 * pages. Pure: no React / DOM.
 */
import {
  GOV_PERMISSIONS,
  GOV_PLATFORM_PERMISSIONS,
  HEALTH_LEVEL_LABEL,
  type HealthItem,
  type HealthLevel,
  type HealthReportDto,
  type PackageDto,
  type PackageInput,
  type QuotaDto,
  type RlsCheckDto,
  type RuleImpactDto,
  type TenantCreateInput,
  type TenantDto,
} from "./contracts.ts";
import type { GovFieldErrors } from "./request-core.ts";

// ---- Permission flags ------------------------------------------------------------------------

/** What the current user may do on the governance pages (UI only; the server decides again). */
export type GovCan = {
  memberView: boolean;
  memberManage: boolean;
  ruleView: boolean;
  ruleManage: boolean;
  requestManage: boolean;
  reviewManage: boolean;
  emergencyUse: boolean;
  healthView: boolean;
  tenantView: boolean;
  tenantManage: boolean;
  packageManage: boolean;
  crossTenant: boolean;
};
/**
 * Permission codes (quanxian `qx:*`) → flags, honouring implies (manage ⇒ view) and `*` / `qx:*`
 * wildcards. Pass the codes from the host's `me` endpoint.
 */
export function governanceCan(codes: readonly string[]): GovCan {
  const set = new Set(codes);
  const has = (code: string) => set.has(code) || set.has("*") || set.has("qx:*") || set.has(`${code.split(":")[0]}:*`);
  const p = GOV_PERMISSIONS;
  const q = GOV_PLATFORM_PERMISSIONS;
  const memberManage = has(p.memberManage);
  const ruleManage = has(p.ruleManage);
  const tenantManage = has(q.tenantManage);
  const packageManage = has(q.packageManage);
  const crossTenant = has(q.crossTenant);
  return {
    memberView: memberManage || has(p.memberView),
    memberManage,
    ruleView: ruleManage || has(p.ruleView),
    ruleManage,
    requestManage: has(p.requestManage),
    reviewManage: has(p.reviewManage),
    emergencyUse: has(p.emergencyUse),
    healthView: has(p.healthView),
    tenantView: tenantManage || packageManage || crossTenant || has(q.tenantView),
    tenantManage,
    packageManage,
    crossTenant,
  };
}

// ---- Rule impact --------------------------------------------------------------------------

/**
 * One sentence for a preview:「3 人会多看到 120 条，1 人会少看到 4 条」;「没有人受影响」;
 * truncated adds「（只算了前 200 人）」.
 */
export function impactSummary(impact: RuleImpactDto): string {
  const t = impact.totals;
  const parts: string[] = [];
  if (t.usersGaining) parts.push(`${t.usersGaining} 人会多看到 ${t.rowsGained} 条`);
  if (t.usersLosing) parts.push(`${t.usersLosing} 人会少看到 ${t.rowsLost} 条`);
  const text = parts.length ? parts.join("，") : `没有人受影响（检查了 ${t.usersChecked} 人）`;
  return impact.truncated ? `${text}（人太多，只算了前 ${t.usersChecked} 人）` : text;
}
/** Tone of an impact: any loss = warning, only gains = info, none = success. */
export function impactTone(impact: RuleImpactDto): "success" | "info" | "warning" {
  if (impact.totals.usersLosing) return "warning";
  if (impact.totals.usersGaining) return "info";
  return "success";
}
/** Changed users sorted by the size of the change (largest first), then name. */
export function impactRows(impact: RuleImpactDto) {
  return [...impact.users].sort((a, b) => b.gained + b.lost - (a.gained + a.lost) || a.name.localeCompare(b.name, "zh-CN"));
}

// ---- Quotas -------------------------------------------------------------------------------

export type QuotaStateKind = "ok" | "near" | "over" | "unlimited" | "unknown";
export type QuotaState = { state: QuotaStateKind; ratio: number | null; text: string };
/**
 * ok / near (≥ nearAt, default 80 %) / over (reached or exceeded) / unlimited (limit null) /
 * unknown (used null: a host-owned quota). limit 0 = nothing allowed, so it is「over」.
 */
export function quotaState(q: Pick<QuotaDto, "limit" | "used">, nearAt = 0.8): QuotaState {
  if (q.limit === null) return { state: "unlimited", ratio: null, text: q.used === null ? "不限" : `已用 ${q.used} / 不限` };
  if (q.used === null) return { state: "unknown", ratio: null, text: `上限 ${q.limit}，用量未统计` };
  const ratio = q.limit > 0 ? q.used / q.limit : Infinity;
  const text = `已用 ${q.used} / ${q.limit}`;
  if (ratio >= 1) return { state: "over", ratio, text: q.used > q.limit ? `${text}（超出 ${q.used - q.limit}）` : `${text}（已满）` };
  return { state: ratio >= nearAt ? "near" : "ok", ratio, text };
}
const QUOTA_RANK: Readonly<Record<QuotaStateKind, number>> = { over: 3, near: 2, ok: 1, unknown: 0, unlimited: 0 };
/** Worst quota and the ones needing attention (near / over), for a banner above the page. */
export function quotaAlerts(quotas: readonly QuotaDto[], nearAt = 0.8): { worst: QuotaStateKind; items: (QuotaDto & QuotaState)[] } {
  const items = quotas.map((q) => ({ ...q, ...quotaState(q, nearAt) }));
  const flagged = items.filter((q) => q.state === "near" || q.state === "over").sort((a, b) => QUOTA_RANK[b.state] - QUOTA_RANK[a.state]);
  return { worst: flagged[0]?.state ?? "ok", items: flagged };
}

/** Effective quota limits of a tenant: package values, overridden by the tenant's own (source marked). */
export function effectiveQuotas(pkg: Pick<PackageDto, "quotas"> | undefined, tenant: Pick<TenantDto, "quotas">): { key: string; limit: number; source: "package" | "tenant" }[] {
  const keys = [...new Set([...Object.keys(pkg?.quotas ?? {}), ...Object.keys(tenant.quotas)])].sort();
  return keys.map((key) => (key in tenant.quotas ? { key, limit: tenant.quotas[key]!, source: "tenant" as const } : { key, limit: pkg!.quotas[key]!, source: "package" as const }));
}

/**
 * Quota editor rows (key + text) → record. Blank text = drop the key (follow the package);
 * values must be non-negative integers; keys must be unique.
 */
export function parseQuotaRows(rows: readonly { key: string; value: string }[]): { ok: true; quotas: Record<string, number> } | { ok: false; error: string } {
  const quotas: Record<string, number> = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key && !value) continue;
    if (!key) return { ok: false, error: "配额名称不能为空" };
    if (key in quotas) return { ok: false, error: `配额「${key}」重复了` };
    if (!value) continue;
    if (!/^\d+$/.test(value)) return { ok: false, error: `配额「${key}」要填 0 或正整数` };
    quotas[key] = Number(value);
  }
  return { ok: true, quotas };
}

// ---- Tenants / packages -------------------------------------------------------------------

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,62}$/;
/** Create-tenant form: name, optional id shape, package, admin user. */
export function validateTenantCreate(input: TenantCreateInput): GovFieldErrors {
  const e: GovFieldErrors = {};
  if (!input.name.trim()) e.name = "请填写租户名称";
  if (input.id && !ID_RE.test(input.id)) e.id = "编号只能用小写字母、数字、- 和 _（2–63 位），留空自动生成";
  if (!input.packageId) e.packageId = "请选择套餐";
  if (!input.adminUserId.trim()) e.adminUserId = "请指定租户管理员";
  return e;
}
/** Typed confirmation for deleting a tenant: the exact tenant id (trimmed). */
export const tenantDeleteConfirmed = (tenant: Pick<TenantDto, "id">, typed: string) => typed.trim() === tenant.id;

/** Package form: id shape for new ones, name, at least one code, no blank codes. */
export function validatePackage(input: PackageInput, isNew: boolean): GovFieldErrors {
  const e: GovFieldErrors = {};
  if (isNew && input.id && !ID_RE.test(input.id)) e.id = "编号只能用小写字母、数字、- 和 _（2–63 位），留空自动生成";
  if (!input.name.trim()) e.name = "请填写套餐名称";
  if (!input.codes.length) e.codes = "至少包含一个权限码（可以用 crm:* 这样的通配）";
  else if (input.codes.some((c) => !/^[\w.*-]+(:[\w.*-]+)?$/.test(c))) e.codes = "权限码格式是「资源:动作」，可用 * 通配";
  return e;
}
/** One code / name per line (or comma separated) → unique trimmed list. */
export function parseLines(text: string): string[] {
  return [...new Set(text.split(/[\n,，]/).map((s) => s.trim()).filter(Boolean))];
}

// ---- Security health ---------------------------------------------------------------------

export const HEALTH_ORDER: readonly HealthLevel[] = ["error", "warn", "ok"];
/** Items grouped by level, worst first; empty groups omitted. */
export function groupHealth(items: readonly HealthItem[]): { level: HealthLevel; label: string; items: HealthItem[] }[] {
  return HEALTH_ORDER.map((level) => ({ level, label: HEALTH_LEVEL_LABEL[level], items: items.filter((i) => i.level === level) })).filter((g) => g.items.length);
}
/** Overall verdict:「发现 2 项严重问题、3 项警告」/「没有发现问题（12 项检查全部正常）」. */
export function healthSummary(report: Pick<HealthReportDto, "items">): { level: HealthLevel; text: string; counts: Record<HealthLevel, number> } {
  const counts: Record<HealthLevel, number> = { error: 0, warn: 0, ok: 0 };
  for (const i of report.items) counts[i.level]++;
  const level: HealthLevel = counts.error ? "error" : counts.warn ? "warn" : "ok";
  if (level === "ok") return { level, counts, text: report.items.length ? `没有发现问题（${report.items.length} 项检查全部正常）` : "没有可显示的检查项" };
  const parts = [counts.error && `${counts.error} 项严重问题`, counts.warn && `${counts.warn} 项警告`].filter(Boolean);
  return { level, counts, text: `发现 ${parts.join("、")}` };
}
/** RLS self-check verdict in words. */
export function rlsSummary(rls: RlsCheckDto): { ok: boolean; text: string } {
  const unprotected = rls.tables.filter((t) => !t.rls || !t.forced || !t.policies).length;
  if (rls.ok && !rls.issues.length) return { ok: true, text: `行级安全正常：${rls.tables.length} 张表都已开启并强制（连接角色 ${rls.role}）` };
  const reasons = [rls.superuser && "连接角色是超级用户（会绕过行级安全）", rls.bypassRls && "连接角色带 BYPASSRLS", unprotected && `${unprotected} 张表没开启 / 没强制 / 没有策略`].filter(Boolean);
  return { ok: false, text: `行级安全有问题：${reasons.join("；") || rls.issues[0] || "见下方问题列表"}` };
}

// ---- Console sections ---------------------------------------------------------------------

export type GovernanceSection = "members" | "share" | "restrictions" | "sod" | "requests" | "policies" | "emergency" | "reviews" | "health" | "tenants" | "packages" | "platform-health";
export const GOVERNANCE_SECTION_LABEL: Readonly<Record<GovernanceSection, string>> = {
  members: "租户成员",
  share: "共享规则",
  restrictions: "收窄规则",
  sod: "职责分离",
  requests: "权限申请",
  policies: "审批流程",
  emergency: "紧急提权",
  reviews: "权限复核",
  health: "安全体检",
  tenants: "租户",
  packages: "套餐",
  "platform-health": "平台体检",
};
const SECTION_ORDER: readonly GovernanceSection[] = ["members", "requests", "emergency", "reviews", "share", "restrictions", "sod", "policies", "health", "tenants", "packages", "platform-health"];
/**
 * Sections a viewer may open, in display order. Requests / emergency / reviews are always there
 * (anyone can request, supervisors and reviewers act there); the rest follow the view codes.
 * `only` limits and orders the result (unknown or forbidden ids are dropped).
 */
export function governanceSections(can: GovCan, only?: readonly GovernanceSection[]): GovernanceSection[] {
  const allowed: Record<GovernanceSection, boolean> = {
    members: can.memberView,
    share: can.ruleView,
    restrictions: can.ruleView,
    sod: can.ruleView,
    requests: true,
    policies: can.requestManage,
    emergency: true,
    reviews: true,
    health: can.healthView,
    tenants: can.tenantView,
    packages: can.packageManage || can.tenantView,
    "platform-health": can.crossTenant,
  };
  return (only ?? SECTION_ORDER).filter((s) => allowed[s]);
}
