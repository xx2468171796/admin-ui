/**
 * Generic approvals: the pure model behind
 * ApprovalList / ApprovalDetail / ApprovalProgress / ApprovalProgressCard. A request has a requester, a
 * snapshot of what is being approved (the host renders it), and steps run in order; each step names its
 * approvers (people, already resolved from roles / 「上级」 by the server) and a mode — `any` (one approval
 * passes the step) or `all` (every approver must approve). Any rejection ends the request (reason required);
 * the requester may withdraw while it is pending. The server owns state and permissions; these helpers only
 * derive what to show (step states, who may act, counts). No React / DOM; no business words (quotes, leave…).
 */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type ApprovalMode = "any" | "all";
export type ApprovalPerson = { id: string; name: string; /** Department / role, shown grey after the name. */ hint?: string };
export type ApprovalDecisionKind = "approved" | "rejected";
export type ApprovalDecision = {
  approver: ApprovalPerson;
  decision: ApprovalDecisionKind;
  /** Required for `rejected`; optional comment for `approved`. */
  reason?: string;
  /** ISO time. */
  at: string;
};
export type ApprovalStep = {
  key: string;
  /** 「直属上级」「财务总监」. */
  label: string;
  approvers: readonly ApprovalPerson[];
  mode: ApprovalMode;
  decisions?: readonly ApprovalDecision[];
};
export type ApprovalRequest<S = unknown> = {
  id: string;
  /** 「申请权限「导出客户」」「报价折扣 12%」. */
  title: string;
  /** Short type tag in lists (「权限」「折扣」「请假」). */
  typeLabel?: string;
  requester: ApprovalPerson;
  /** ISO time of the request. */
  createdAt: string;
  status: ApprovalStatus;
  steps: readonly ApprovalStep[];
  /** Index of the step waiting now (server value); derived from the decisions when absent. */
  currentStep?: number;
  /** The requester's reason (申请理由). */
  reason?: string;
  /** Snapshot taken when the request was made (what the approvers see); rendered by the host. */
  summary?: S;
  /** ISO time of the end (approved / rejected / withdrawn). */
  closedAt?: string;
};

export type ApprovalScope = "mine" | "todo" | "all";
/** done = passed · current = waiting now · waiting = not reached yet · rejected = ended here · skipped = never reached (rejected / withdrawn earlier). */
export type ApprovalStepState = "done" | "current" | "waiting" | "rejected" | "skipped";

const approvedBy = (step: ApprovalStep) => new Set((step.decisions ?? []).filter((d) => d.decision === "approved").map((d) => d.approver.id));

/** Has this step passed by its mode? `all` with no approvers never passes (the server should not send it). */
export function stepPassed(step: ApprovalStep): boolean {
  const ok = approvedBy(step);
  if (step.mode === "any") return ok.size > 0;
  return step.approvers.length > 0 && step.approvers.every((p) => ok.has(p.id));
}

export const stepRejected = (step: ApprovalStep) => Boolean(step.decisions?.some((d) => d.decision === "rejected"));

/** Approvals so far / needed: any → x / 1, all → x / number of approvers. */
export function stepTally(step: ApprovalStep): { approved: number; needed: number } {
  const ok = approvedBy(step);
  return { approved: step.mode === "any" ? Math.min(ok.size, 1) : step.approvers.filter((p) => ok.has(p.id)).length, needed: step.mode === "any" ? 1 : step.approvers.length };
}

/** Approvers of the step who have not decided yet. */
export function pendingApprovers(step: ApprovalStep): ApprovalPerson[] {
  const decided = new Set((step.decisions ?? []).map((d) => d.approver.id));
  return step.approvers.filter((p) => !decided.has(p.id));
}

/** The step waiting now: the server's `currentStep`, else the first step that has not passed; -1 when the request is closed. */
export function currentStepIndex(request: Pick<ApprovalRequest, "status" | "steps" | "currentStep">): number {
  if (request.status !== "pending") return -1;
  if (request.currentStep !== undefined && request.currentStep >= 0 && request.currentStep < request.steps.length) return request.currentStep;
  const at = request.steps.findIndex((s) => !stepPassed(s));
  return at;
}

/** State of every step (see ApprovalStepState). */
export function stepStates(request: Pick<ApprovalRequest, "status" | "steps" | "currentStep">): ApprovalStepState[] {
  const { status, steps } = request;
  if (status === "approved") return steps.map(() => "done");
  if (status === "pending") {
    const now = currentStepIndex(request);
    return steps.map((_, i) => (now < 0 || i < now ? "done" : i === now ? "current" : "waiting"));
  }
  // rejected / withdrawn: passed steps stay done; the rejecting step is rejected; the rest were never reached.
  let ended = false;
  return steps.map((s) => {
    if (ended) return "skipped";
    if (status === "rejected" && stepRejected(s)) {
      ended = true;
      return "rejected";
    }
    if (stepPassed(s)) return "done";
    ended = true;
    return "skipped";
  });
}

/** May this viewer approve / reject now? Pending, on the current step, one of its approvers, not decided yet. */
export function canDecide(request: ApprovalRequest, viewerId: string | undefined): boolean {
  if (!viewerId || request.status !== "pending") return false;
  const step = request.steps[currentStepIndex(request)];
  return Boolean(step && pendingApprovers(step).some((p) => p.id === viewerId));
}

/** May this viewer withdraw? Only the requester, only while pending. */
export const canWithdraw = (request: ApprovalRequest, viewerId: string | undefined) => Boolean(viewerId && request.status === "pending" && request.requester.id === viewerId);

/** Check a decision before sending: a rejection needs a reason. Returns the error text or null. */
export function decisionError(decision: ApprovalDecisionKind, reason: string): string | null {
  return decision === "rejected" && !reason.trim() ? "驳回要写原因，申请人会看到" : null;
}

export type ApprovalStatusMeta = { label: string; tone: "warning" | "success" | "danger" | "neutral" };
/** Status chip: 审批中 / 已通过 / 已驳回 / 已撤回; 「待你审批」 when the viewer is the one to act. */
export function approvalStatusMeta(request: ApprovalRequest, viewerId?: string): ApprovalStatusMeta {
  if (request.status === "approved") return { label: "已通过", tone: "success" };
  if (request.status === "rejected") return { label: "已驳回", tone: "danger" };
  if (request.status === "withdrawn") return { label: "已撤回", tone: "neutral" };
  return { label: canDecide(request, viewerId) ? "待你审批" : "审批中", tone: "warning" };
}

/** The list under a scope: mine = I asked, todo = waiting for me, all = everything the host returned. */
export function filterApprovals<R extends ApprovalRequest>(items: readonly R[], scope: ApprovalScope, viewerId: string | undefined): R[] {
  if (scope === "all") return items.slice();
  if (scope === "mine") return items.filter((r) => r.requester.id === viewerId);
  return items.filter((r) => canDecide(r, viewerId));
}

/** Counts for the scope segments (server totals win when paged). */
export function approvalCounts(items: readonly ApprovalRequest[], viewerId: string | undefined, server: Partial<Record<ApprovalScope, number>> = {}): Record<ApprovalScope, number> {
  return {
    mine: server.mine ?? filterApprovals(items, "mine", viewerId).length,
    todo: server.todo ?? filterApprovals(items, "todo", viewerId).length,
    all: server.all ?? items.length,
  };
}

/** 「任一人批准即可」 / 「需 3 人都批准 · 已批 1」 / 「1 人审批」. */
export function modeText(step: ApprovalStep): string {
  if (step.approvers.length <= 1) return "";
  const { approved, needed } = stepTally(step);
  return step.mode === "any" ? "任一人批准即可" : `需 ${needed} 人都批准${approved ? ` · 已批 ${approved}` : ""}`;
}

/** Whole days between two times (floor, ≥ 0). */
export function waitDays(fromIso: string, now: number = Date.now()): number {
  const t = Date.parse(fromIso);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / 86_400_000));
}

/** When the current step started waiting: the last decision of the previous steps, else the request time. */
export function waitingSince(request: ApprovalRequest): string {
  const now = currentStepIndex(request);
  if (now <= 0) return request.createdAt;
  const times = request.steps.slice(0, now).flatMap((s) => (s.decisions ?? []).map((d) => d.at)).filter((t) => !Number.isNaN(Date.parse(t)));
  return times.length ? times.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b)) : request.createdAt;
}

/** One line for the current state: 「等 郑凯 审批 · 已等 2 天」 / 「已通过」 / 「郑凯 驳回了」 / 「申请人撤回了」. */
export function currentLine(request: ApprovalRequest, now: number = Date.now()): string {
  if (request.status === "approved") return "已通过";
  if (request.status === "withdrawn") return `${request.requester.name} 撤回了申请`;
  if (request.status === "rejected") {
    const d = request.steps.flatMap((s) => s.decisions ?? []).find((x) => x.decision === "rejected");
    return d ? `${d.approver.name} 驳回了` : "已驳回";
  }
  const step = request.steps[currentStepIndex(request)];
  if (!step) return "审批中";
  const names = pendingApprovers(step).map((p) => p.name);
  const who = names.length > 2 ? `${names.slice(0, 2).join("、")} 等 ${names.length} 人` : names.join("、") || step.label;
  const days = waitDays(waitingSince(request), now);
  return `等 ${who} 审批${days > 0 ? ` · 已等 ${days} 天` : ""}`;
}
