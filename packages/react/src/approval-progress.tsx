"use client";
/**
 * Approval progress: `ApprovalProgress` = vertical steps — 「提交申请」 by the requester,
 * then every step: label, approvers, mode (任一人 / 都要批), each decision (同意 / 驳回 + reason + time);
 * passed steps a main-colour tick on a main-colour line, the current one an attention clock on a soft row,
 * a rejection a danger cross with the reason quoted, steps never reached grey. `ApprovalMiniSteps` = the
 * dots-and-lines of a list row. `ApprovalProgressCard` = a compact card for record detail slots: status,
 * mini steps, one line 「等 郑凯 审批 · 已等 2 天」, 「查看详情」. Data in, nothing fetched; rules in approval-core.ts.
 */
import type { ReactNode } from "react";
import { Check, ChevronRight, Clock, Send, Undo2, X } from "lucide-react";
import { Avatar } from "./avatar.tsx";
import { StatusBadge } from "./primitives.tsx";
import { formatDateTime } from "./format.ts";
import { approvalStatusMeta, currentLine, waitDays, modeText, pendingApprovers, stepStates, waitingSince, type ApprovalRequest, type ApprovalStepState } from "./approval-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/approval.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/approval.css";

const defaultTime = (iso: string) => {
  const text = formatDateTime(iso, { time: true }) ?? "";
  return text.startsWith(String(new Date().getFullYear())) ? text.slice(5) : text;
};

const DOT: Record<ApprovalStepState, ReactNode> = {
  done: <Check aria-hidden="true" />,
  current: <Clock aria-hidden="true" />,
  rejected: <X aria-hidden="true" />,
  waiting: null,
  skipped: null,
};
const STATE_TEXT: Record<ApprovalStepState, string> = { done: "已通过", current: "审批中", rejected: "已驳回", waiting: "还没轮到", skipped: "没有走到" };

export type ApprovalProgressProps = {
  request: ApprovalRequest;
  /** Time text (default 「10-05 09:12」). */
  formatTime?: (iso: string) => string;
  /** Hide the first 「提交申请」 row (default shown). */
  hideSubmit?: boolean;
  /** Accessible name / visible heading (default 「审批进度」; `null` hides the heading). */
  title?: string | null;
  /** 「现在」 for 「已等 N 天」 (tests). */
  now?: number;
};

/** See the module comment. */
export function ApprovalProgress({ request, formatTime = defaultTime, hideSubmit, title = "审批进度", now = Date.now() }: ApprovalProgressProps) {
  const states = stepStates(request);
  return (
    <section className="aui-approval-progress" aria-label={title ?? "审批进度"}>
      {title !== null && <h4 className="aui-approval-progress-title">{title}</h4>}
      <ol className="aui-approval-steps">
        {!hideSubmit && (
          <li className="aui-approval-step" data-state="done">
            <span className="aui-approval-dot" aria-hidden="true"><Send /></span>
            <div className="aui-approval-step-main">
              <div className="aui-approval-step-title"><b>{request.requester.name}</b>{request.requester.hint && <span className="aui-note">{request.requester.hint}</span>}</div>
              <div className="aui-approval-step-sub">提交申请 · <time dateTime={request.createdAt}>{formatTime(request.createdAt)}</time></div>
            </div>
          </li>
        )}
        {request.steps.map((step, i) => {
          const state = states[i] ?? "waiting";
          const waiting = state === "current" ? pendingApprovers(step) : [];
          const mode = modeText(step);
          const sub = [
            state === "current" ? `待 ${waiting.map((p) => p.name).join("、") || step.label} 审批 · 已等 ${waitDays(waitingSince(request), now)} 天` : state === "waiting" ? "还没轮到" : state === "skipped" ? (request.status === "withdrawn" ? "申请已撤回" : "没有走到") : "",
            mode,
          ].filter(Boolean);
          return (
            <li key={step.key} className="aui-approval-step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="aui-approval-dot" aria-hidden="true">{DOT[state]}</span>
              <div className="aui-approval-step-main">
                <div className="aui-approval-step-title">
                  <b>{step.label}</b>
                  <span className="aui-approval-approvers">{step.approvers.map((p) => p.name).join("、")}</span>
                  <span className="aui-sr-only">，{STATE_TEXT[state]}</span>
                </div>
                {sub.length > 0 && <div className="aui-approval-step-sub">{sub.join(" · ")}</div>}
                {(step.decisions ?? []).map((d, k) => (
                  <div key={`${d.approver.id}-${k}`} className="aui-approval-decision" data-decision={d.decision}>
                    <span className="aui-approval-decision-line">
                      <Avatar name={d.approver.name} id={d.approver.id} size={20} />
                      <b>{d.approver.name}</b>
                      <span className="aui-approval-decision-kind">{d.decision === "approved" ? "同意" : "驳回"}</span>
                      <time dateTime={d.at}>{formatTime(d.at)}</time>
                    </span>
                    {d.reason && <q className="aui-approval-reason">{d.reason}</q>}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
        {request.status === "withdrawn" && (
          <li className="aui-approval-step" data-state="skipped">
            <span className="aui-approval-dot" aria-hidden="true"><Undo2 /></span>
            <div className="aui-approval-step-main">
              <div className="aui-approval-step-title"><b>{request.requester.name}</b> 撤回了申请</div>
              {request.closedAt && <div className="aui-approval-step-sub"><time dateTime={request.closedAt}>{formatTime(request.closedAt)}</time></div>}
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}

/** Dots and lines of a list row: done main colour, current attention ring, rejected danger, rest grey. */
export function ApprovalMiniSteps({ request }: { request: ApprovalRequest }) {
  const states = stepStates(request);
  const label = `${states.filter((s) => s === "done").length} / ${states.length} 级已通过`;
  return (
    <span className="aui-approval-mini" role="img" aria-label={label}>
      <i data-state="done" />
      {states.map((s, i) => (
        <span key={i} className="aui-approval-mini-seg">
          <b data-state={s === "waiting" || s === "skipped" ? undefined : "done"} />
          <i data-state={s} />
        </span>
      ))}
    </span>
  );
}

export type ApprovalProgressCardProps = {
  request: ApprovalRequest;
  viewerId?: string;
  /** Open the full detail (drawer / approvals page). */
  onOpen?: () => void;
  /** Heading (default 「审批进度」). */
  title?: string;
  /** Extra line under the status (the host's summary: 「折扣 12% · 超过阈值 10%」). */
  detail?: ReactNode;
  now?: number;
};

/** A compact card for a record detail slot. See the module comment. */
export function ApprovalProgressCard({ request, viewerId, onOpen, title = "审批进度", detail, now = Date.now() }: ApprovalProgressCardProps) {
  const meta = approvalStatusMeta(request, viewerId);
  return (
    <section className="aui-approval-card" aria-label={`${title}：${request.title}`}>
      <div className="aui-approval-card-head">
        <h4>{title}</h4>
        <StatusBadge tone={meta.tone} variant="soft">{meta.label}</StatusBadge>
        <ApprovalMiniSteps request={request} />
      </div>
      <p className="aui-approval-card-title">{request.title}</p>
      {detail && <div className="aui-approval-card-detail">{detail}</div>}
      <div className="aui-approval-card-foot">
        <span className="aui-approval-card-line">{currentLine(request, now)}</span>
        {onOpen && (
          <button type="button" className="aui-approval-card-open" onClick={onOpen}>
            查看详情<ChevronRight aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
