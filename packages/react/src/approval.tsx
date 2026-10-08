"use client";
/**
 * Generic approvals (platform.md §26) — no business words, data + callbacks only:
 * - ApprovalList — segments 「我的申请 / 待我审批 N / 全部」, rows of two lines (56px): avatar · requester ·
 *   hint / type tag · title · reason; right: mini steps + status chip / waiting time. A `toolbar` slot for
 *   the host's type filter and 「新申请」.
 * - ApprovalDetail — head (requester avatar, title, hint · time, status chip) → reason and extra fields →
 *   the subject snapshot (the host's `renderSubject`, on a grey block: 「批准后能做什么」, the quoted
 *   discount…) → ApprovalProgress → for the current approver an opinion box + 驳回 (danger outline; a reason
 *   is required — the box turns red with one line) / 批准 (the one primary); for the requester 撤回申请.
 * Pair them with ListDetailLayout (list → detail on phones). Rules in approval-core.ts.
 */
import { useState, type ReactNode } from "react";
import { Check, ClipboardCheck, Undo2 } from "lucide-react";
import { Avatar } from "./avatar.tsx";
import { Button, StatusBadge, Textarea } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { StatePanel } from "./layout.tsx";
import { ConfirmDialog } from "./forms.tsx";
import { formatDateTime, relativeTime } from "./format.ts";
import { ApprovalMiniSteps, ApprovalProgress } from "./approval-progress.tsx";
import { approvalCounts, approvalStatusMeta, canDecide, canWithdraw, decisionError, filterApprovals, type ApprovalRequest, type ApprovalScope } from "./approval-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/approval.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/approval.css";

const failure = (caught: unknown, fallback: string) => (caught instanceof Error && caught.message ? caught.message : fallback);
const defaultTime = (iso: string) => {
  const text = formatDateTime(iso, { time: true }) ?? "";
  return text.startsWith(String(new Date().getFullYear())) ? text.slice(5) : text;
};
const SCOPE_LABEL: Record<ApprovalScope, string> = { mine: "我的申请", todo: "待我审批", all: "全部" };
const EMPTY: Record<ApprovalScope, [string, string]> = {
  todo: ["没有等你审批的申请", "有新申请时会在这里和通知里出现"],
  mine: ["你还没有发起过申请", ""],
  all: ["还没有申请", ""],
};

export type ApprovalListProps<R extends ApprovalRequest = ApprovalRequest> = {
  items: readonly R[];
  /** The viewer's account id (who is 「我」 for 我的申请 / 待我审批). */
  viewerId?: string;
  /** Current segment (controlled). */
  scope: ApprovalScope;
  onScopeChange: (scope: ApprovalScope) => void;
  /** Which segments (default all three; drop `"all"` for people without the admin right). */
  scopes?: readonly ApprovalScope[];
  /** Server totals per segment when the list is paged (default: counted from `items`). */
  counts?: Partial<Record<ApprovalScope, number>>;
  /**
   * `items` are already the server's list for `scope` (default true: the host fetches with `scope`).
   * false = `items` are everything and the list filters by `scope` itself.
   */
  serverFiltered?: boolean;
  selectedId?: string | null;
  onSelect?: (request: R) => void;
  /** Right side of the head row: type filter, 「新申请」. */
  toolbar?: ReactNode;
  /** A grey line under the list (「共 4 条 · 超过 7 天没人批会提醒上一级」). */
  footer?: ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Older items (server paging). */
  onLoadMore?: () => void;
  /** Time text on the right (default relative: 「2 小时前」「昨天 16:40」). */
  formatTime?: (iso: string) => string;
  /** Accessible name (default 「审批」). */
  label?: string;
};

/** See the module comment. */
export function ApprovalList<R extends ApprovalRequest>({ items, viewerId, scope, onScopeChange, scopes = ["mine", "todo", "all"], counts, serverFiltered = true, selectedId, onSelect, toolbar, footer, loading, error, onRetry, onLoadMore, formatTime = (iso) => relativeTime(iso), label = "审批" }: ApprovalListProps<R>) {
  const shown = serverFiltered ? items : filterApprovals(items, scope, viewerId);
  const todoCount = counts?.todo ?? (!serverFiltered ? approvalCounts(items, viewerId).todo : scope === "todo" ? items.length : undefined);
  const [emptyTitle, emptyHint] = EMPTY[scope];
  return (
    <section className="aui-approval-list" aria-label={label}>
      <div className="aui-approval-list-head">
        <SegmentedControl size="sm" label="审批范围" value={scope} onValueChange={onScopeChange}
          options={scopes.map((s) => ({ value: s, label: s === "todo" && todoCount ? `${SCOPE_LABEL.todo} ${todoCount}` : SCOPE_LABEL[s] }))} />
        {toolbar && <div className="aui-approval-list-tools">{toolbar}</div>}
      </div>
      {loading && !shown.length ? <StatePanel kind="loading" /> : error ? <StatePanel kind="error" message={error} onRetry={onRetry} /> : !shown.length ? (
        <div className="aui-approval-empty">
          <span className="aui-approval-empty-icon" aria-hidden="true"><ClipboardCheck /></span>
          <b>{emptyTitle}</b>
          {emptyHint && <span className="aui-note">{emptyHint}</span>}
        </div>
      ) : (
        <ul className="aui-approval-rows">
          {shown.map((r) => {
            const meta = approvalStatusMeta(r, viewerId);
            const selected = selectedId === r.id;
            return (
              <li key={r.id}>
                <button type="button" className="aui-approval-row" aria-current={selected || undefined} data-status={r.status} onClick={() => onSelect?.(r)}>
                  <Avatar name={r.requester.name} id={r.requester.id} size={32} />
                  <span className="aui-approval-row-main">
                    <span className="aui-approval-row-l1"><b>{r.requester.name}</b>{r.requester.hint && <span className="aui-note">{r.requester.hint}</span>}</span>
                    <span className="aui-approval-row-l2">
                      {r.typeLabel && <span className="aui-approval-type">{r.typeLabel}</span>}
                      <span className="aui-approval-row-title">{r.title}</span>
                      {r.reason && <span className="aui-approval-row-reason">· {r.reason}</span>}
                    </span>
                  </span>
                  <span className="aui-approval-row-side">
                    <ApprovalMiniSteps request={r} />
                    <span className="aui-approval-row-meta">
                      {r.status === "pending" ? <span className="aui-note" data-mine-turn={meta.label === "待你审批" || undefined}>{meta.label}</span> : <StatusBadge tone={meta.tone} variant="dot">{meta.label}</StatusBadge>}
                      <time className="aui-note" dateTime={r.createdAt}>{formatTime(r.createdAt)}</time>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {onLoadMore && <Button size="sm" variant="ghost" className="aui-approval-more" onClick={onLoadMore}>加载更多</Button>}
      {footer && <p className="aui-approval-list-foot">{footer}</p>}
    </section>
  );
}

export type ApprovalDetailField = { label: string; value: ReactNode };
export type ApprovalDetailProps<R extends ApprovalRequest = ApprovalRequest> = {
  request: R;
  viewerId?: string;
  /** The subject snapshot (what is approved, as of the request): rendered on a grey block under the reason. */
  renderSubject?: (request: R) => ReactNode;
  /** Rows under the head (理由 is shown from `request.reason`; add 期限 / 金额 …). */
  fields?: readonly ApprovalDetailField[];
  /** Approve (comment optional). Reject (Error message) to keep the box and show why. */
  onApprove?: (request: R, comment: string) => Promise<void>;
  /** Reject; `reason` is never empty (checked here, and again on the server). */
  onReject?: (request: R, reason: string) => Promise<void>;
  /** Withdraw (requester, while pending), after a confirm. */
  onWithdraw?: (request: R) => Promise<void>;
  /** Grey hint next to the buttons (「批准后通知 周敏，再交给下一级」). */
  decideHint?: ReactNode;
  /** Extra actions in the head (⋯, 「去记录」). */
  actions?: ReactNode;
  formatTime?: (iso: string) => string;
  /** 「现在」 for 「已等 N 天」 (tests). */
  now?: number;
};

/** See the module comment. */
export function ApprovalDetail<R extends ApprovalRequest>({ request, viewerId, renderSubject, fields = [], onApprove, onReject, onWithdraw, decideHint, actions, formatTime = defaultTime, now }: ApprovalDetailProps<R>) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const meta = approvalStatusMeta(request, viewerId);
  const decide = canDecide(request, viewerId) && Boolean(onApprove || onReject);
  const withdraw = canWithdraw(request, viewerId) && Boolean(onWithdraw);
  const subject = renderSubject?.(request);
  const run = async (kind: "approve" | "reject") => {
    if (busy) return;
    const problem = kind === "reject" ? decisionError("rejected", comment) : null;
    setInvalid(Boolean(problem));
    setError(problem ?? "");
    if (problem) return;
    setBusy(kind);
    try {
      if (kind === "approve") await onApprove?.(request, comment.trim());
      else await onReject?.(request, comment.trim());
      setComment("");
    } catch (caught) {
      setError(failure(caught, kind === "approve" ? "批准没成功，请重试" : "驳回没成功，请重试"));
    } finally {
      setBusy(null);
    }
  };
  const errorId = `aui-approval-err-${request.id}`;
  return (
    <section className="aui-approval-detail" aria-label={request.title}>
      <header className="aui-approval-detail-head">
        <Avatar name={request.requester.name} id={request.requester.id} size={40} />
        <div className="aui-approval-detail-title">
          <h3>{request.title}</h3>
          <small>{[request.requester.name, request.requester.hint, formatTime(request.createdAt)].filter(Boolean).join(" · ")}</small>
        </div>
        <StatusBadge tone={meta.tone} variant="soft">{meta.label}</StatusBadge>
        {actions}
      </header>
      <div className="aui-approval-detail-body">
        {(request.reason || fields.length > 0) && (
          <dl className="aui-approval-fields">
            {request.reason && <div className="aui-approval-field"><dt>理由</dt><dd>{request.reason}</dd></div>}
            {fields.map((f) => <div key={f.label} className="aui-approval-field"><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
          </dl>
        )}
        {subject && <div className="aui-approval-subject">{subject}</div>}
        <ApprovalProgress request={request} formatTime={formatTime} now={now} />
      </div>
      {decide && (
        <div className="aui-approval-decide">
          <Textarea rows={2} minRows={2} maxRows={6} value={comment} placeholder="意见（批准可不写，驳回必须写）" aria-label="审批意见" aria-invalid={invalid || undefined} aria-describedby={error ? errorId : undefined} data-invalid={invalid || undefined}
            onChange={(e) => { setComment(e.currentTarget.value); if (invalid && e.currentTarget.value.trim()) { setInvalid(false); setError(""); } }} />
          {error && <p id={errorId} className="aui-approval-error" role="alert">{error}</p>}
          <div className="aui-approval-decide-bar">
            {decideHint && <span className="aui-note">{decideHint}</span>}
            {onReject && <Button variant="destructive-outline" loading={busy === "reject"} disabled={busy === "approve"} onClick={() => void run("reject")}>驳回</Button>}
            {onApprove && <Button loading={busy === "approve"} disabled={busy === "reject"} onClick={() => void run("approve")}><Check aria-hidden="true" />批准</Button>}
          </div>
        </div>
      )}
      {withdraw && (
        <div className="aui-approval-decide aui-approval-withdraw">
          <span className="aui-note">还在审批中，可以撤回后改了再提</span>
          <Button variant="outline" onClick={() => setWithdrawing(true)}><Undo2 aria-hidden="true" />撤回申请</Button>
        </div>
      )}
      {withdraw && onWithdraw && (
        <ConfirmDialog open={withdrawing} title="撤回这条申请？" confirmLabel="撤回" description="撤回后审批人不用再处理；要的话可以重新发起。"
          onConfirm={async () => { await onWithdraw(request); }} onClose={() => setWithdrawing(false)} />
      )}
    </section>
  );
}
