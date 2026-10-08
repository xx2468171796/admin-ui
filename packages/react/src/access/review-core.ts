/**
 * Pure helpers for RecordTeamPanel / AccessRequestList / ReviewList / EffectiveAccessTable /
 * ExplainPanel: expiry status, record levels, request state transitions, effective-access filtering
 * and explain summaries. No React / DOM.
 */
import {
  ALLOW_SOURCE_LABEL,
  BLOCK_LABEL,
  REQUEST_STATUS_LABEL,
  type AccessRequest,
  type AccessRequestStatus,
  type AllowSourceKind,
  type EffectiveAccessRow,
  type ExplainResult,
  type RecordLevel,
  type RecordTeamMember,
  type RequestAction,
  type ReviewItem,
} from "./contracts.ts";

const DAY = 86_400_000;

export type ExpiryState = { kind: "permanent" | "active" | "soon" | "expired" | "invalid"; days?: number; label: string };
/**
 * 「永久」/「还剩 12 天」/「今天到期」/「已到期」. `soonDays` (default 7) marks「即将到期」.
 * Days are whole calendar spans rounded up, so「还剩 1 天」never means already gone.
 */
export function expiryState(expiresAt: string | null | undefined, now: Date = new Date(), soonDays = 7): ExpiryState {
  if (expiresAt === null || expiresAt === undefined || expiresAt === "") return { kind: "permanent", label: "永久" };
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return { kind: "invalid", label: "到期时间无效" };
  const left = at - now.getTime();
  if (left <= 0) return { kind: "expired", days: 0, label: "已到期" };
  const days = Math.ceil(left / DAY);
  if (left < DAY) return { kind: "soon", days: 1, label: "今天到期" };
  return { kind: days <= soonDays ? "soon" : "active", days, label: `还剩 ${days} 天` };
}

const LEVEL_RANK: Readonly<Record<RecordLevel, number>> = { viewer: 1, editor: 2, owner: 3 };
/** viewer ⊆ editor ⊆ owner. */
export function levelIncludes(held: RecordLevel, needed: RecordLevel): boolean {
  return LEVEL_RANK[held] >= LEVEL_RANK[needed];
}

/** Team members sorted: owner first, then editors, viewers; inherited after direct; then by name. */
export function sortTeam(members: readonly RecordTeamMember[]): RecordTeamMember[] {
  return [...members].sort(
    (a, b) =>
      LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
      Number(!!a.inheritedFrom) - Number(!!b.inheritedFrom) ||
      a.subject.name.localeCompare(b.subject.name, "zh-CN"),
  );
}

/** The single owner of a record, or null (no owner = 公海 / unassigned). */
export function teamOwner(members: readonly RecordTeamMember[]): RecordTeamMember | null {
  return members.find((m) => m.level === "owner" && !m.inheritedFrom) ?? null;
}

/** State-machine transitions the UI may offer (the server decides again). */
export const REQUEST_TRANSITIONS: Readonly<Record<RequestAction, { from: readonly AccessRequestStatus[]; to: AccessRequestStatus; label: string }>> = {
  approve: { from: ["pending"], to: "approved", label: "批准" },
  reject: { from: ["pending"], to: "rejected", label: "驳回" },
  cancel: { from: ["draft", "pending"], to: "cancelled", label: "撤回" },
  revoke: { from: ["approved", "active"], to: "revoked", label: "收回" },
};

/** Actions available on a request for this viewer's capabilities. */
export function requestActions(request: AccessRequest, can: Partial<Record<RequestAction, boolean>>): RequestAction[] {
  return (Object.keys(REQUEST_TRANSITIONS) as RequestAction[]).filter((a) => can[a] && REQUEST_TRANSITIONS[a].from.includes(request.status));
}

export type RequestTone = "neutral" | "success" | "warning" | "danger" | "brand";
export function requestTone(status: AccessRequestStatus): RequestTone {
  return ({ draft: "neutral", pending: "warning", approved: "brand", active: "success", rejected: "danger", cancelled: "neutral", expired: "neutral", revoked: "danger" } as const)[status];
}
export const requestStatusLabel = (status: AccessRequestStatus) => REQUEST_STATUS_LABEL[status] ?? status;

/** Review progress: decided / total and how many are marked revoke. */
export function reviewProgress(items: readonly ReviewItem[]): { decided: number; total: number; revoke: number; keep: number } {
  const keep = items.filter((i) => i.decision === "keep").length;
  const revoke = items.filter((i) => i.decision === "revoke").length;
  return { decided: keep + revoke, total: items.length, keep, revoke };
}

/** Unused for this many days (or never used) → suggest revoking. */
export function staleGrant(item: ReviewItem, now: Date = new Date(), days = 90): boolean {
  if (item.lastUsedAt === null) return true;
  if (item.lastUsedAt === undefined) return false;
  const at = Date.parse(item.lastUsedAt);
  return Number.isFinite(at) && now.getTime() - at > days * DAY;
}

export type EffectiveFilter = {
  query?: string;
  status?: "all" | "allowed" | "denied";
  /** Keep rows that have at least one of these allow sources. Empty = any. */
  sources?: readonly AllowSourceKind[];
  /** Only rows that are blocked by something (restriction / tenant / step-up …). */
  blockedOnly?: boolean;
};
/** Filter EffectiveAccessTable rows; search covers code / label / group / source labels. */
export function filterEffective(rows: readonly EffectiveAccessRow[], filter: EffectiveFilter): EffectiveAccessRow[] {
  const words = (filter.query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (filter.status === "allowed" && !row.allowed) return false;
    if (filter.status === "denied" && row.allowed) return false;
    if (filter.sources?.length && !row.sources.some((s) => filter.sources!.includes(s.kind))) return false;
    if (filter.blockedOnly && !row.blocks.some((b) => b.kind !== "not_granted")) return false;
    if (!words.length) return true;
    const hay = [row.code, row.label, row.group ?? "", ...row.sources.map((s) => s.label), ...row.blocks.map((b) => b.label)].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Count rows per allow source kind (for the filter chips). */
export function sourceCounts(rows: readonly EffectiveAccessRow[]): Map<AllowSourceKind, number> {
  const counts = new Map<AllowSourceKind, number>();
  for (const row of rows) for (const kind of new Set(row.sources.map((s) => s.kind))) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return counts;
}

/**
 * One sentence for the explain result, e.g.「允许：来自 角色「销售经理」」/「拒绝：收窄规则「冻结客户不可改」」/
 *「拒绝：条件结果未知（负责人 为空），未知按拒绝处理」.
 */
export function explainSummary(result: ExplainResult): string {
  const sources = result.allowedBy.map((s) => `${ALLOW_SOURCE_LABEL[s.kind]}「${s.label}」`).join("、");
  if (result.decision === "allow") return `允许：来自 ${sources || "（未说明来源）"}`;
  if (result.decision === "conditional") return `有条件允许：只对满足「${result.condition ?? "条件"}」的记录${sources ? `，来自 ${sources}` : ""}`;
  const blocks = result.blockedBy.filter((b) => b.kind !== "condition" || !result.unknown?.length);
  const reason = blocks.map((b) => `${BLOCK_LABEL[b.kind]}「${b.label}」`).join("、");
  if (result.unknown?.length) {
    const fields = result.unknown.map((u) => `${u.label ?? u.field} 为空`).join("、");
    return `拒绝：条件结果未知（${fields}），未知按拒绝处理${reason ? `；另有 ${reason}` : ""}`;
  }
  return `拒绝：${reason || "没有任何授予来源"}`;
}

/** datetime-local input value (local time) → ISO string; "" → null (permanent). Throws on garbage. */
export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const t = new Date(local);
  if (Number.isNaN(t.getTime())) throw new Error("到期时间格式不对");
  return t.toISOString();
}
/** ISO string → datetime-local input value in local time; null / invalid → "". */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
