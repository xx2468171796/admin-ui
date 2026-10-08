/**
 * Requests, approval chains, emergency elevation and review campaigns: which actions to offer (from
 * the DTO's `can` + status), progress texts, input validation and the live countdown state.
 * Pure: no React / DOM. The server re-checks every transition.
 */
import { expiryState } from "../review-core.ts";
import type { ReviewItem } from "../contracts.ts";
import {
  APPROVAL_STEP_LABEL,
  REVIEW_DEADLINE_LABEL,
  REVIEW_SCOPE_LABEL,
  REVIEWER_KIND_LABEL,
  type AccessRequestDto,
  type AccessRequestInput,
  type ApprovalPolicyInput,
  type ApprovalStep,
  type EmergencyInput,
  type EmergencyReviewInput,
  type GovRequestStatus,
  type ReviewCampaignDto,
  type ReviewCampaignInput,
  type ReviewItemDto,
} from "./contracts.ts";

export type GovRequestAction = "submit" | "approve" | "reject" | "cancel" | "revoke";
export type GovActionMeta = { label: string; from: readonly GovRequestStatus[]; note: "required" | "optional" | "none"; destructive: boolean; impact: string };
/** State machine edges the UI may offer; `note: required` = reject / revoke must give a reason. */
export const GOV_REQUEST_ACTIONS: Readonly<Record<GovRequestAction, GovActionMeta>> = {
  submit: { label: "提交", from: ["draft"], note: "none", destructive: false, impact: "提交后进入审批，审批人会收到待办。" },
  approve: { label: "批准", from: ["pending"], note: "optional", destructive: false, impact: "批准后进入下一级审批；最后一级批准后按期限生效。" },
  reject: { label: "驳回", from: ["pending"], note: "required", destructive: true, impact: "驳回后申请结束，申请人会看到原因。" },
  cancel: { label: "撤回", from: ["draft", "pending"], note: "optional", destructive: false, impact: "撤回后这条申请作废，可以重新提交一条。" },
  revoke: { label: "收回", from: ["approved", "active"], note: "required", destructive: true, impact: "立即收回这项权限，对方下一次操作就会被拒绝。" },
};
const ACTION_ORDER: readonly GovRequestAction[] = ["approve", "reject", "submit", "cancel", "revoke"];

/** Actions to show for a request: allowed by the server's `can` AND valid from the current status. */
export function govRequestActions(dto: Pick<AccessRequestDto, "status" | "can">): GovRequestAction[] {
  return ACTION_ORDER.filter((a) => dto.can[a] && GOV_REQUEST_ACTIONS[a].from.includes(dto.status));
}

/** A required note is missing → message; otherwise null. */
export function actionNoteError(action: GovRequestAction, note: string): string | null {
  return GOV_REQUEST_ACTIONS[action].note === "required" && !note.trim() ? `请填写${action === "reject" ? "驳回" : "收回"}原因` : null;
}

export type ChainStepView = { index: number; label: string; state: "approved" | "rejected" | "current" | "waiting" | "skipped"; who: string; note: string | null; at: string | null };
/** Each approval step with its state for the timeline (done / rejected / current / waiting). */
export function chainSteps(dto: Pick<AccessRequestDto, "chain" | "status">): ChainStepView[] {
  const firstOpen = dto.chain.findIndex((s) => s.decision === null);
  const rejected = dto.chain.some((s) => s.decision === "reject");
  return dto.chain.map((s, i) => {
    const names = s.candidates.map((c) => c.name).join("、");
    if (s.decision === "approve") return { index: s.index, label: s.label, state: "approved", who: s.decidedBy ?? names, note: s.note, at: s.decidedAt };
    if (s.decision === "reject") return { index: s.index, label: s.label, state: "rejected", who: s.decidedBy ?? names, note: s.note, at: s.decidedAt };
    const live = dto.status === "pending" && !rejected && i === firstOpen;
    const closed = dto.status !== "pending" && dto.status !== "draft";
    return { index: s.index, label: s.label, state: live ? "current" : closed ? "skipped" : "waiting", who: names, note: null, at: null };
  });
}

/**
 * One line for the chain:「第 1 / 2 级：部门负责人（待 张三、李四 审批）」/「2 级审批全部通过」/
 *「第 2 级 财务负责人 驳回：预算不足」/「无需审批」.
 */
export function chainProgressText(dto: Pick<AccessRequestDto, "chain" | "status" | "step" | "decisionNote">): string {
  const total = dto.chain.length;
  if (!total) {
    if (dto.step) return `第 ${dto.step.current} / ${dto.step.total} 级${dto.step.label ? `：${dto.step.label}` : ""}`;
    return dto.status === "draft" ? "未提交" : "无需审批";
  }
  const rejectedAt = dto.chain.findIndex((s) => s.decision === "reject");
  if (rejectedAt >= 0) {
    const s = dto.chain[rejectedAt]!;
    return `第 ${rejectedAt + 1} 级 ${s.label} 驳回${s.note ? `：${s.note}` : ""}`;
  }
  const done = dto.chain.filter((s) => s.decision === "approve").length;
  if (done === total) return total === 1 ? "审批已通过" : `${total} 级审批全部通过`;
  if (dto.status === "draft") return `未提交（共 ${total} 级审批）`;
  if (dto.status !== "pending") return `审批到第 ${done + 1} / ${total} 级时结束`;
  const current = dto.chain.find((s) => s.decision === null)!;
  const who = current.candidates.map((c) => c.name).join("、");
  return `第 ${done + 1} / ${total} 级：${current.label}${who ? `（待 ${who} 审批）` : ""}`;
}

export type GovFieldErrors = Record<string, string>;
const hasErrors = (e: GovFieldErrors) => Object.keys(e).length > 0;

/** New request form: target, reason, record level, future expiry. */
export function validateRequestInput(input: AccessRequestInput, now: Date = new Date()): GovFieldErrors {
  const e: GovFieldErrors = {};
  if (!input.target.id.trim()) e.target = input.target.kind === "record" ? "请填写记录编号" : "请选择要申请的内容";
  if (input.target.kind === "record") {
    if (!input.target.resourceType?.trim()) e.resourceType = "请选择资源类型";
    if (!input.level) e.level = "请选择要的级别";
  }
  if (input.reason.trim().length < 5) e.reason = "请写清楚为什么需要（至少 5 个字）";
  if (input.expiresAt) {
    const at = Date.parse(input.expiresAt);
    if (!Number.isFinite(at)) e.expiresAt = "到期时间格式不对";
    else if (at <= now.getTime()) e.expiresAt = "到期时间要晚于现在";
  }
  return e;
}
export const requestInputValid = (input: AccessRequestInput, now?: Date) => !hasErrors(validateRequestInput(input, now));

// ---- Emergency ------------------------------------------------------------------------------

export const EMERGENCY_MIN_REASON = 10;
/** Start form: target, reason ≥ 10 chars, supervisor ≠ self, 1 … maxMinutes minutes. */
export function validateEmergency(input: EmergencyInput, selfId: string, maxMinutes = 240): GovFieldErrors {
  const e: GovFieldErrors = {};
  if (!input.target.id) e.target = "请选择要临时获得的角色或权限";
  const len = [...input.reason.trim()].length;
  if (len < EMERGENCY_MIN_REASON) e.reason = `原因至少 ${EMERGENCY_MIN_REASON} 个字（现在 ${len} 个），写清楚是什么故障、要做什么`;
  if (!input.supervisorId) e.supervisorId = "请选择监督人";
  else if (input.supervisorId === selfId) e.supervisorId = "监督人不能是你自己";
  const m = input.minutes ?? 60;
  if (!Number.isInteger(m) || m < 1) e.minutes = "时长要是正整数（分钟）";
  else if (m > maxMinutes) e.minutes = `最长 ${maxMinutes} 分钟`;
  return e;
}
/** Post review: flagged needs a note saying what was wrong. */
export function validateEmergencyReview(input: EmergencyReviewInput): GovFieldErrors {
  return input.outcome === "flagged" && !input.note.trim() ? { note: "标记异常时请写明哪里不对" } : {};
}

export type CountdownState = { state: "waiting" | "running" | "ending" | "over"; ms: number; clock: string; label: string };
const pad = (n: number) => String(n).padStart(2, "0");
/**
 * Live countdown of an elevation:「42:05」/「1:02:03」+「还剩 42 分 5 秒」. `ending` in the last
 * 5 minutes; `over` once expired (or ended); `waiting` before it starts.
 */
export function emergencyCountdown(dto: Pick<AccessRequestDto, "status" | "expiresAt" | "startsAt" | "endedAt">, now: Date = new Date()): CountdownState {
  if (dto.status !== "active" || dto.endedAt) return { state: "over", ms: 0, clock: "00:00", label: "已结束" };
  const start = dto.startsAt ? Date.parse(dto.startsAt) : NaN;
  if (Number.isFinite(start) && start > now.getTime()) return { state: "waiting", ms: start - now.getTime(), clock: "--:--", label: "还没开始" };
  const end = dto.expiresAt ? Date.parse(dto.expiresAt) : NaN;
  if (!Number.isFinite(end)) return { state: "running", ms: Infinity, clock: "--:--", label: "没有结束时间" };
  const ms = end - now.getTime();
  if (ms <= 0) return { state: "over", ms: 0, clock: "00:00", label: "已到时间" };
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const clock = h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  const label = `还剩 ${h ? `${h} 小时 ` : ""}${m} 分 ${s} 秒`;
  return { state: ms <= 5 * 60_000 ? "ending" : "running", ms, clock, label };
}

/** Elevations whose post review is waiting for this viewer. */
export const needsPostReview = (dto: AccessRequestDto) => dto.kind === "emergency" && dto.can.review && (dto.postReview?.status ?? "pending") === "pending";

// ---- Review campaigns ---------------------------------------------------------------------

/** 「已处理 12 / 40（保留 10 · 收回 2）」+ percent. */
export function campaignProgress(c: Pick<ReviewCampaignDto, "progress">): { percent: number; text: string; detail: string } {
  const { total, decided, kept, revoked } = c.progress;
  return { percent: total ? Math.round((decided / total) * 100) : 0, text: `已处理 ${decided} / ${total}`, detail: `保留 ${kept} · 收回 ${revoked} · 未处理 ${Math.max(total - decided, 0)}` };
}

export type DeadlineView = { tone: "neutral" | "warning" | "danger" | "success"; label: string };
/** Deadline state of a campaign:「还剩 3 天」/「今天到期」/「已过截止」/「已关闭」. */
export function campaignDeadline(c: Pick<ReviewCampaignDto, "deadline" | "status">, now: Date = new Date()): DeadlineView {
  if (c.status === "closed") return { tone: "success", label: "已关闭" };
  const s = expiryState(c.deadline, now, 3);
  if (s.kind === "expired") return { tone: "danger", label: "已过截止" };
  if (s.kind === "invalid") return { tone: "danger", label: "截止时间无效" };
  return { tone: s.kind === "soon" ? "warning" : "neutral", label: s.label };
}

/** What closing does to undecided items, in words (for the close confirmation). */
export function campaignCloseImpact(c: Pick<ReviewCampaignDto, "progress" | "onDeadline">): string {
  const open = Math.max(c.progress.total - c.progress.decided, 0);
  if (!open) return `全部 ${c.progress.total} 项已处理：保留 ${c.progress.kept} 项，收回 ${c.progress.revoked} 项。关闭后结果不能再改。`;
  const what = c.onDeadline === "revoke" ? "自动收回" : c.onDeadline === "keep" ? "自动保留" : "保持原样（不处理）";
  return `还有 ${open} 项没处理，关闭后按「${what}」处理。关闭后结果不能再改。`;
}

/** Campaign scope / reviewer in words, with host labels for ids. */
export function campaignScopeText(c: Pick<ReviewCampaignDto, "scope" | "reviewer" | "onDeadline" | "staleDays">, label: (kind: string, id: string) => string = (_k, id) => id): { scope: string; reviewer: string; deadline: string } {
  const scope = c.scope.kind === "all" || !c.scope.id ? REVIEW_SCOPE_LABEL[c.scope.kind] : `${REVIEW_SCOPE_LABEL[c.scope.kind]}：${label(c.scope.kind, c.scope.id)}`;
  const reviewer =
    c.reviewer.kind === "users"
      ? `${REVIEWER_KIND_LABEL.users}：${c.reviewer.ids.map((id) => label("user", id)).join("、") || "—"}`
      : c.reviewer.kind === "role_holder"
        ? `${REVIEWER_KIND_LABEL.role_holder}：${c.reviewer.roleId ? label("role", c.reviewer.roleId) : "—"}`
        : REVIEWER_KIND_LABEL.manager;
  return { scope, reviewer, deadline: `到期未处理：${REVIEW_DEADLINE_LABEL[c.onDeadline]} · ${c.staleDays} 天未用算久未使用` };
}

/** Create form: name, scope id when needed, reviewers, future deadline, stale days. */
export function validateCampaign(input: ReviewCampaignInput, now: Date = new Date()): GovFieldErrors {
  const e: GovFieldErrors = {};
  if (!input.name.trim()) e.name = "请填写名称";
  if (input.scope.kind !== "all" && !input.scope.id) e.scopeId = "请选择复核范围";
  if (input.reviewer.kind === "users" && !input.reviewer.ids?.length) e.reviewerIds = "至少选一个复核人";
  if (input.reviewer.kind === "role_holder" && !input.reviewer.roleId) e.reviewerRole = "请选择角色";
  const at = Date.parse(input.deadline);
  if (!Number.isFinite(at)) e.deadline = "请选择截止时间";
  else if (at <= now.getTime()) e.deadline = "截止时间要晚于现在";
  if (input.staleDays !== undefined && (!Number.isInteger(input.staleDays) || input.staleDays < 1)) e.staleDays = "天数要是正整数";
  return e;
}

/** ReviewItemDto → the ReviewList row (server `stale` wins over the local day count via lastUsedAt). */
export function toReviewItem(dto: ReviewItemDto): ReviewItem {
  return {
    id: dto.id,
    subject: { id: dto.subject.id, name: dto.subject.name, hint: `复核人：${dto.reviewer.name}` },
    grant: { kind: dto.grant.kind, label: dto.grant.label, scope: dto.grant.scope ?? null },
    ...(dto.grantedAt ? { grantedAt: dto.grantedAt } : {}),
    lastUsedAt: dto.lastUsedAt,
    expiresAt: dto.expiresAt ?? null,
    decision: dto.decision,
    ...(dto.note ? { note: dto.note } : {}),
  };
}

/** 「从未使用」/「96 天未用」/「" for one review item. */
export function reviewHint(dto: Pick<ReviewItemDto, "lastUsedAt" | "stale" | "useCount">, now: Date = new Date()): string {
  if (dto.lastUsedAt === null) return "从未使用";
  if (!dto.stale) return "";
  const at = Date.parse(dto.lastUsedAt);
  const days = Number.isFinite(at) ? Math.floor((now.getTime() - at) / 86_400_000) : null;
  return days === null ? "久未使用" : `${days} 天未用`;
}

// ---- Approval policies ----------------------------------------------------------------------

/** 「直属上级 → 财务部负责人 → 指定人员（2 人）」. */
export function stepsText(steps: readonly ApprovalStep[], label: (kind: string, id: string) => string = (_k, id) => id): string {
  if (!steps.length) return "无需审批";
  return steps
    .map((s) => {
      if (s.label) return s.label;
      if (s.kind === "role_holder" && s.roleId) return `${label("role", s.roleId)}持有人`;
      if (s.kind === "dept_leader" && s.deptId) return `${label("dept", s.deptId)}负责人`;
      if (s.kind === "user" && s.userIds?.length) return s.userIds.length === 1 ? label("user", s.userIds[0]!) : `${APPROVAL_STEP_LABEL.user}（${s.userIds.length} 人）`;
      return APPROVAL_STEP_LABEL[s.kind];
    })
    .join(" → ");
}

/** Policy form: label, ≥ 1 step, each step complete, positive maxDays / integer priority. Errors keyed by field or `step.<i>`. */
export function validatePolicy(input: ApprovalPolicyInput): GovFieldErrors {
  const e: GovFieldErrors = {};
  if (!input.label.trim()) e.label = "请填写名称";
  if (!input.steps.length) e.steps = "至少要有一级审批";
  input.steps.forEach((s, i) => {
    if (s.kind === "role_holder" && !s.roleId) e[`step.${i}`] = "请选择角色";
    if (s.kind === "user" && !s.userIds?.length) e[`step.${i}`] = "至少选一个审批人";
  });
  if (input.maxDays !== undefined && input.maxDays !== null && (!Number.isInteger(input.maxDays) || input.maxDays < 1)) e.maxDays = "最长天数要是正整数，留空 = 不限";
  if (input.priority !== undefined && !Number.isInteger(input.priority)) e.priority = "优先级要是整数";
  return e;
}

/** Move a step up / down (table-driven steps editor). Out-of-range moves return the same array. */
export function moveStep<T>(steps: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= steps.length || to < 0 || to >= steps.length) return [...steps];
  const next = [...steps];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}
