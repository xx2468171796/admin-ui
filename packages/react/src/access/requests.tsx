"use client";
/**
 * AccessRequestList — permission requests with the state machine draft → pending → approved → active →
 * expired / revoked (or rejected / cancelled): approve (adjust expiry), reject (reason required),
 * revoke (reason required), cancel. ReviewList — an access review (复核) campaign: keep / revoke each
 * grant (or in batch), stale-grant hints, progress and「提交复核」when everything is decided.
 * Presentational: actions go through host callbacks that reject to keep the dialog with the message.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { CircleCheck, CircleX, MinusCircle, Undo2 } from "lucide-react";
import { Button, StatusBadge } from "../primitives.tsx";
import { ChipGroup, QuickDatePresets, SegmentedControl, type SegmentedOption } from "../choices.tsx";
import { DateTimePicker } from "../date-picker.tsx";
import { RowActionBar } from "../row-actions.tsx";
import { ConfirmDialog, FormField } from "../forms.tsx";
import { InlineAlert } from "../layout.tsx";
import { DataTable, type DataTablePagination } from "../data.tsx";
import { CellText } from "../cells.tsx";
import { CellDate } from "../displays.tsx";
import { RECORD_LEVEL_LABEL, REQUEST_STATUS_LABEL, type AccessRequest, type AccessRequestStatus, type RequestAction, type ReviewDecision, type ReviewItem } from "./contracts.ts";
import { describeScope } from "./matrix-core.ts";
import { REQUEST_TRANSITIONS, isoToLocalInput as toLocal, localInputToIso as toIso, requestActions, requestTone, reviewProgress, staleGrant } from "./review-core.ts";
import { ExpiryBadge } from "./record-team.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

const TARGET_LABEL = { role: "角色", permission: "权限", record: "记录", post: "岗位" } as const;
const REQUEST_ACTION_ICON: Readonly<Record<RequestAction, ReactNode>> = { approve: <CircleCheck />, reject: <CircleX />, cancel: <Undo2 />, revoke: <MinusCircle /> };
const DECISION_OPTIONS: readonly SegmentedOption<ReviewDecision | "">[] = [
  { value: "keep", label: "保留" },
  { value: "revoke", label: "收回" },
];


export type AccessRequestListProps = {
  requests: readonly AccessRequest[];
  caption?: string;
  /** What this viewer may do (UI only; the server checks approver / requester again). */
  can?: Partial<Record<RequestAction, boolean>>;
  /** `expiresAt` only for approve (the possibly adjusted expiry; null = permanent). */
  onAction?: (request: AccessRequest, action: RequestAction, input: { reason: string; expiresAt?: string | null }) => Promise<void>;
  /** Status chips shown as a filter (default all present statuses); controlled when `statusFilter` is passed. */
  statusFilter?: readonly AccessRequestStatus[];
  onStatusFilterChange?: (statuses: AccessRequestStatus[]) => void;
  /** Server paging; default shows all rows. */
  pagination?: DataTablePagination;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  deptName?: (id: string) => string;
  now?: Date;
};

export function AccessRequestList({
  requests,
  caption = "权限申请",
  can = {},
  onAction,
  statusFilter,
  onStatusFilterChange,
  pagination,
  loading,
  error,
  onRetry,
  deptName,
  now,
}: AccessRequestListProps) {
  const [innerFilter, setInnerFilter] = useState<AccessRequestStatus[]>([]);
  const filter = statusFilter ?? innerFilter;
  const [pending, setPending] = useState<{ request: AccessRequest; action: RequestAction } | null>(null);
  const [expires, setExpires] = useState("");
  const expId = useId();
  const statuses = (Object.keys(REQUEST_STATUS_LABEL) as AccessRequestStatus[]).filter((s) => requests.some((r) => r.status === s) || filter.includes(s));
  const rows = filter.length && !statusFilter ? requests.filter((r) => filter.includes(r.status)) : requests;
  const open = (request: AccessRequest, action: RequestAction) => {
    setExpires(toLocal(request.expiresAt));
    setPending({ request, action });
  };
  const a = pending?.action;
  const who = pending ? `${pending.request.requester.name} 的「${pending.request.target.label}」` : "";
  return (
    <div className="aui-access-requests">
      {statuses.length > 1 && (
        <ChipGroup
          label="状态"
          value={filter}
          onValueChange={(next) => (statusFilter ? onStatusFilterChange?.(next) : setInnerFilter(next))}
          options={statuses.map((s) => ({ value: s, label: REQUEST_STATUS_LABEL[s], count: statusFilter ? undefined : requests.filter((r) => r.status === s).length }))}
        />
      )}
      <DataTable rowHeight="medium"
        caption={caption}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyKind={filter.length ? "no-results" : "empty"}
        emptyLabel={filter.length ? "没有该状态的申请" : "没有申请"}
        pagination={pagination ?? { mode: "all" }}
        columns={[
          { key: "who", title: "申请人", minWidth: 140, render: (r) => <CellText primary={r.requester.name} secondary={r.requester.hint} /> },
          {
            key: "what",
            title: "申请内容",
            minWidth: 200,
            render: (r) => (
              <CellText
                primary={`${TARGET_LABEL[r.target.kind]}：${r.target.label}`}
                secondary={[r.scope && describeScope(r.scope, deptName), r.level && RECORD_LEVEL_LABEL[r.level]].filter(Boolean).join(" · ") || undefined}
              />
            ),
          },
          { key: "reason", title: "理由", minWidth: 160, maxWidth: 280, truncate: (r) => r.reason || "—", render: (r) => r.reason || "—" },
          { key: "expires", title: "期限", width: 120, render: (r) => <ExpiryBadge expiresAt={r.expiresAt} now={now} /> },
          {
            key: "status",
            title: "状态",
            width: 150,
            render: (r) => (
              <CellText
                primary={<StatusBadge tone={requestTone(r.status)}>{REQUEST_STATUS_LABEL[r.status]}</StatusBadge>}
                secondary={r.status === "pending" && r.step ? `第 ${r.step.current} / ${r.step.total} 级${r.step.label ? `：${r.step.label}` : ""}` : r.decidedBy ? `${r.decidedBy}${r.decisionNote ? `：${r.decisionNote}` : ""}` : undefined}
              />
            ),
          },
          { key: "created", title: "提交时间", width: 150, render: (r) => <CellDate value={r.createdAt} time /> },
          {
            key: "actions",
            title: "操作",
            kind: "actions",
            render: (r) => {
              const actions = onAction ? requestActions(r, can) : [];
              if (!actions.length) return null;
              return (
                <RowActionBar
                  label={`${r.requester.name}「${r.target.label}」的更多操作`}
                  actions={actions.map((action) => ({
                    key: action,
                    label: REQUEST_TRANSITIONS[action].label,
                    icon: REQUEST_ACTION_ICON[action],
                    // 驳回 / 收回 are the row's main decisions: keep them inline (each opens a confirm dialog with a reason).
                    ...(action === "reject" || action === "revoke" ? { destructive: true, menuOnly: false } : {}),
                    onSelect: () => open(r, action),
                  }))}
                />
              );
            },
          },
        ]}
      />
      <ConfirmDialog
        open={pending !== null}
        title={a ? `${REQUEST_TRANSITIONS[a].label}申请` : ""}
        destructive={a === "reject" || a === "revoke"}
        confirmLabel={a ? REQUEST_TRANSITIONS[a].label : "确定"}
        size={a === "approve" ? "md" : "sm"}
        impact={
          a === "approve"
            ? `批准后 ${who} 按下面的期限生效${pending?.request.step && pending.request.step.current < pending.request.step.total ? "（还要后续审批人通过）" : ""}。`
            : a === "reject"
              ? `驳回 ${who}，申请人会看到原因。`
              : a === "revoke"
                ? `立即收回 ${who}，对方下一次操作就会被拒绝。`
                : `撤回 ${who}。`
        }
        reason={a === "approve" ? { label: "审批意见", placeholder: "可不填" } : a === "cancel" ? { label: "撤回原因", placeholder: "可不填" } : { label: a === "reject" ? "驳回原因" : "收回原因", required: true }}
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (!pending || !onAction) return;
          await onAction(pending.request, pending.action, pending.action === "approve" ? { reason, expiresAt: toIso(expires) } : { reason });
        }}
      >
        {a === "approve" && (
          <div className="aui-access-approve-expiry">
            <FormField label="到期时间" htmlFor={expId} hint={pending?.request.expiresAt === undefined ? "留空 = 永久" : "默认是申请人填的期限，可以改短；留空 = 永久"}>
              <DateTimePicker id={expId} clearable value={expires} onChange={setExpires} />
            </FormField>
            <QuickDatePresets days={[1, 7, 30, 90]} permanent onPick={setExpires} now={now ? () => now : undefined} />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

export type ReviewListProps = {
  items: readonly ReviewItem[];
  title?: string;
  /** Campaign deadline. */
  dueAt?: string | null;
  /** Record a decision for some items (single row or batch). Reject to keep the dialog. */
  onDecide?: (ids: string[], decision: ReviewDecision, note: string) => Promise<void>;
  /** Finish the campaign; enabled only when every item is decided. */
  onSubmit?: () => Promise<void>;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  deptName?: (id: string) => string;
  /** Days without use that count as stale (default 90). */
  staleDays?: number;
  now?: Date;
};

type ReviewFilter = "open" | "keep" | "revoke" | "stale";

export function ReviewList({ items, title = "权限复核", dueAt, onDecide, onSubmit, readOnly = false, loading, error, onRetry, deptName, staleDays = 90, now }: ReviewListProps) {
  const [filter, setFilter] = useState<ReviewFilter[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ ids: string[]; decision: ReviewDecision } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [failure, setFailure] = useState("");
  const progress = reviewProgress(items);
  const stale = useMemo(() => new Set(items.filter((i) => staleGrant(i, now, staleDays)).map((i) => i.id)), [items, now, staleDays]);
  const rows = filter.length
    ? items.filter((i) => filter.some((f) => (f === "open" ? !i.decision : f === "stale" ? stale.has(i.id) : i.decision === f)))
    : items;
  const editable = !readOnly && !!onDecide && !loading && !error;
  const decide = (ids: string[], decision: ReviewDecision) => {
    if (!ids.length) return;
    // Keeping is low risk: no dialog. Revoking asks for a note.
    if (decision === "keep") {
      setFailure("");
      void onDecide?.(ids, "keep", "").then(
        () => setSelected([]),
        (e: unknown) => setFailure(e instanceof Error ? e.message : String(e)),
      );
    }
    else setConfirm({ ids, decision });
  };
  return (
    <div className="aui-access-review">
      <div className="aui-access-review-head">
        <div className="aui-access-review-progress" role="status">
          <strong>{`已处理 ${progress.decided} / ${progress.total}`}</strong>
          <span className="aui-note">{`保留 ${progress.keep} · 收回 ${progress.revoke} · 长期未用 ${stale.size}`}</span>
          <progress max={Math.max(progress.total, 1)} value={progress.decided} aria-label="复核进度" />
        </div>
        {dueAt !== undefined && dueAt !== null && (
          <span className="aui-access-review-due">
            截止 <CellDate value={dueAt} time /> <ExpiryBadge expiresAt={dueAt} now={now} />
          </span>
        )}
        {onSubmit && !readOnly && (
          <Button disabled={progress.decided < progress.total || finishing || !!error} onClick={() => setFinishing(true)}>
            提交复核
          </Button>
        )}
      </div>
      {failure && <InlineAlert tone="error" title="没有保存成功">{failure}</InlineAlert>}
      <ChipGroup
        label="筛选"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: "open", label: "未处理", count: progress.total - progress.decided },
          { value: "keep", label: "已保留", count: progress.keep },
          { value: "revoke", label: "已收回", count: progress.revoke },
          { value: "stale", label: `超过 ${staleDays} 天未用`, count: stale.size },
        ]}
      />
      <DataTable rowHeight="medium"
        caption={title}
        rows={rows}
        rowKey={(i) => i.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyKind={filter.length ? "no-results" : "empty"}
        emptyLabel={filter.length ? "没有符合筛选的条目" : "没有需要复核的授权"}
        pagination={{ mode: "all" }}
        selected={editable ? selected : undefined}
        onSelectionChange={editable ? setSelected : undefined}
        toolbar={
          editable && selected.length > 0 ? (
            <div className="aui-access-batch">
              <span>已选 {selected.length} 项</span>
              <Button size="sm" variant="secondary" onClick={() => decide(selected, "keep")}>批量保留</Button>
              <Button size="sm" variant="destructive" onClick={() => decide(selected, "revoke")}>批量收回</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>取消选择</Button>
            </div>
          ) : undefined
        }
        columns={[
          { key: "who", title: "人员", minWidth: 140, render: (i) => <CellText primary={i.subject.name} secondary={i.subject.hint} /> },
          { key: "grant", title: "授权", minWidth: 200, render: (i) => <CellText primary={`${TARGET_LABEL[i.grant.kind]}：${i.grant.label}`} secondary={i.grant.scope ? describeScope(i.grant.scope, deptName) : undefined} /> },
          { key: "granted", title: "授予时间", width: 120, render: (i) => <CellDate value={i.grantedAt ?? null} /> },
          {
            key: "used",
            title: "最近使用",
            width: 140,
            render: (i) => (i.lastUsedAt === null ? <StatusBadge tone="warning">从未使用</StatusBadge> : <span className="aui-access-used">{i.lastUsedAt ? <CellDate value={i.lastUsedAt} /> : "—"}{stale.has(i.id) && i.lastUsedAt && <> <StatusBadge tone="warning">长期未用</StatusBadge></>}</span>),
          },
          { key: "expires", title: "到期", width: 110, render: (i) => <ExpiryBadge expiresAt={i.expiresAt} now={now} /> },
          {
            key: "decision",
            title: "结论",
            width: editable ? 140 : 110,
            // A per-row decision is a choice, not an action: pick 保留 / 收回 right in the 结论 column (none pressed = 未处理).
            render: (i) =>
              editable ? (
                <SegmentedControl<ReviewDecision | "">
                  size="sm"
                  label={`${i.subject.name}「${i.grant.label}」的结论`}
                  value={i.decision ?? ""}
                  onValueChange={(d) => d && decide([i.id], d)}
                  options={DECISION_OPTIONS}
                />
              ) : i.decision === "keep" ? (
                <StatusBadge tone="success">保留</StatusBadge>
              ) : i.decision === "revoke" ? (
                <StatusBadge tone="danger">收回</StatusBadge>
              ) : (
                <span className="aui-note">未处理</span>
              ),
          },
        ]}
      />
      <ConfirmDialog
        open={confirm !== null}
        title="收回授权"
        destructive
        confirmLabel={confirm && confirm.ids.length > 1 ? `收回 ${confirm.ids.length} 项` : "收回"}
        impact={confirm ? `标记为「收回」的 ${confirm.ids.length} 项授权会在提交复核后撤销（是否立即撤销以服务端规则为准）。` : undefined}
        reason={{ label: "收回原因", required: true }}
        onClose={() => setConfirm(null)}
        onConfirm={async (note) => {
          if (!confirm || !onDecide) return;
          await onDecide(confirm.ids, "revoke", note);
          setSelected([]);
        }}
      />
      <ConfirmDialog
        open={finishing}
        title="提交复核"
        confirmLabel="提交"
        impact={`共 ${progress.total} 项：保留 ${progress.keep} 项，收回 ${progress.revoke} 项。提交后不能再改。`}
        onClose={() => setFinishing(false)}
        onConfirm={async () => {
          await onSubmit?.();
        }}
      />
    </div>
  );
}
