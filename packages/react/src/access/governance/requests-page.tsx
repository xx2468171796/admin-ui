"use client";
/**
 * AccessRequestsPage — permission requests with three views (我的申请 / 待我审批 / 全部), a new-request
 * dialog, the approval chain, and approve / reject / cancel / revoke / submit offered from the DTO's
 * `can` + status (reject and revoke need a note). ApprovalChain — the step timeline, reusable.
 */
import { useId, useState, type ReactNode } from "react";
import { CircleCheck, CircleDot, CircleX, Circle, Eye, MinusCircle, Plus, Send, Undo2 } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge, Tabs, Textarea } from "../../primitives.tsx";
import { QuickDatePresets, SegmentedControl } from "../../choices.tsx";
import { DateTimePicker } from "../../date-picker.tsx";
import { ConfirmDialog, Dialog, FormDialog, FormField } from "../../forms.tsx";
import { DescriptionList, PageBody, PageHeader, ResourcePanel } from "../../layout.tsx";
import { DataTable, type Column } from "../../data.tsx";
import { CellText } from "../../cells.tsx";
import { CellDate } from "../../displays.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import { ExpiryBadge } from "../record-team.tsx";
import { describeScope } from "../matrix-core.ts";
import { localInputToIso, requestTone } from "../review-core.ts";
import { RECORD_LEVEL_LABEL } from "../contracts.ts";
import {
  GOV_REQUEST_STATUS_LABEL,
  POST_REVIEW_LABEL,
  REQUEST_KIND_LABEL,
  REQUEST_TARGET_LABEL,
  type AccessRequestDto,
  type AccessRequestInput,
  type GovOption,
  type GovRequestStatus,
  type GovRequestTargetKind,
  type RequestQuery,
} from "./contracts.ts";
import { GOV_REQUEST_ACTIONS, chainProgressText, chainSteps, govRequestActions, validateRequestInput, type GovRequestAction } from "./request-core.ts";
import { govErrorMessage, type GovernanceApi } from "./api.ts";
import { GovLoad, feedbackOf, staleAlert, defaultNow, toChoice, useGov, useNotice, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type AccessRequestsView = "mine" | "todo" | "all";
export type AccessRequestsPageProps = GovPageBaseProps & {
  /** What can be requested, per kind (pickers). Free text when a list is omitted. */
  targets?: { role?: readonly GovOption[]; permission?: readonly GovOption[] };
  /** Resource types for record requests. */
  resources?: readonly GovOption[];
  /** viewAll: the「全部」tab (qx:request.manage); request: show「申请权限」(default true). */
  can?: { viewAll?: boolean; request?: boolean };
  /** Initial tab (default「待我审批」when the viewer approves things, else「我的申请」). */
  defaultView?: AccessRequestsView;
};

const ALL = "*all";
const REQUEST_ACTION_ICON: Readonly<Record<GovRequestAction, ReactNode>> = { submit: <Send />, approve: <CircleCheck />, reject: <CircleX />, cancel: <Undo2 />, revoke: <MinusCircle /> };
const VIEW_LABEL: Readonly<Record<AccessRequestsView, string>> = { mine: "我的申请", todo: "待我审批", all: "全部" };

export function AccessRequestsPage({ api, targets = {}, resources, can = {}, defaultView = "todo", active = true, now = defaultNow }: AccessRequestsPageProps) {
  const [view, setView] = useState<AccessRequestsView>(defaultView === "all" && !can.viewAll ? "todo" : defaultView);
  const [status, setStatus] = useState<string>(ALL);
  const [kind, setKind] = useState<string>(ALL);
  const query: RequestQuery = { view, ...(status !== ALL ? { status: status as GovRequestStatus } : {}), ...(kind !== ALL ? { kind: kind as "normal" | "emergency" } : {}) };
  const res = useGov<AccessRequestDto[]>(`gov:requests:${view}:${status}:${kind}`, (signal) => api.requests.list(query, { signal }), active);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useNotice();
  const tabs = (["mine", "todo", "all"] as const).filter((v) => v !== "all" || can.viewAll).map((v) => ({ value: v, label: VIEW_LABEL[v] }));
  const filtered = status !== ALL || kind !== ALL;
  return (
    <>
      <PageHeader
        title="权限申请"
        description="申请角色、单项权限或某条记录的权限，按审批流程逐级审批；批准后到期自动收回。驳回和收回必须写原因。"
        actions={can.request !== false && <Button onClick={() => setCreating(true)}><Plus />申请权限</Button>}
      />
      <PageBody>
        <Tabs label="申请视图" value={view} onValueChange={(v) => setView(v as AccessRequestsView)} items={tabs}>
          <ResourcePanel
            title={VIEW_LABEL[view]}
            count={res.data && !filtered ? res.data.length : undefined}
            actions={<Button variant="outline" disabled={res.loading} onClick={() => void res.refresh()}>刷新</Button>}
            filters={
              <div className="aui-gov-filters">
                <Choice label="状态" value={status} onChange={setStatus} options={[{ value: ALL, label: "全部状态" }, ...(Object.keys(GOV_REQUEST_STATUS_LABEL) as GovRequestStatus[]).map((s) => ({ value: s, label: GOV_REQUEST_STATUS_LABEL[s] }))]} />
                <Choice label="类型" value={kind} onChange={setKind} options={[{ value: ALL, label: "全部类型" }, { value: "normal", label: REQUEST_KIND_LABEL.normal }, { value: "emergency", label: REQUEST_KIND_LABEL.emergency }]} />
              </div>
            }
            feedback={feedbackOf(notice, staleAlert(res))}
          >
            <GovLoad res={res} label="申请">
              {(rows) => (
                <RequestTable
                  rows={rows}
                  api={api}
                  now={now}
                  empty={filtered ? "没有符合筛选的申请" : view === "todo" ? "没有等你审批的申请" : view === "mine" ? "你还没有提过申请" : "没有申请"}
                  emptyAction={filtered ? <Button variant="outline" onClick={() => { setStatus(ALL); setKind(ALL); }}>清空筛选</Button> : undefined}
                  filtered={filtered}
                  onDone={(text) => {
                    setNotice(text);
                    void res.refresh();
                  }}
                />
              )}
            </GovLoad>
          </ResourcePanel>
        </Tabs>
      </PageBody>
      {creating && (
        <NewRequestDialog
          targets={targets}
          resources={resources}
          now={now}
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            try {
              const created = await api.requests.create(input);
              setNotice(created.status === "draft" ? "已存为草稿" : "申请已提交，等待审批");
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
            if (view !== "mine") setView("mine");
            else void res.refresh();
          }}
        />
      )}
    </>
  );
}

function targetText(r: AccessRequestDto) {
  return `${REQUEST_TARGET_LABEL[r.target.kind]}：${r.target.label}`;
}

function RequestTable({ rows, api, now, empty, emptyAction, filtered, onDone }: { rows: AccessRequestDto[]; api: GovernanceApi; now: () => Date; empty: string; emptyAction?: ReactNode; filtered: boolean; onDone: (text: string) => void }) {
  const [pending, setPending] = useState<{ request: AccessRequestDto; action: GovRequestAction } | null>(null);
  const [detail, setDetail] = useState<AccessRequestDto | null>(null);
  const at = now();
  const columns: Column<AccessRequestDto>[] = [
    { key: "who", title: "申请人", minWidth: 120, render: (r) => <CellText primary={r.requester.name} secondary={r.kind === "emergency" ? REQUEST_KIND_LABEL.emergency : undefined} /> },
    {
      key: "what",
      title: "申请内容",
      minWidth: 180,
      maxWidth: 280,
      render: (r) => <CellText primary={targetText(r)} secondary={[r.target.resourceType, r.level && RECORD_LEVEL_LABEL[r.level], r.scope && describeScope(r.scope)].filter(Boolean).join(" · ") || undefined} />,
    },
    { key: "reason", title: "理由", minWidth: 140, maxWidth: 240, truncate: (r) => r.reason || "—", render: (r) => r.reason || "—" },
    { key: "expires", title: "期限", width: 110, render: (r) => <ExpiryBadge expiresAt={r.expiresAt} now={at} /> },
    {
      key: "status",
      title: "状态 / 审批进度",
      minWidth: 200,
      maxWidth: 300,
      render: (r) => <CellText primary={<StatusBadge tone={requestTone(r.status)}>{GOV_REQUEST_STATUS_LABEL[r.status]}</StatusBadge>} secondary={chainProgressText(r)} secondaryTitle={chainProgressText(r)} />,
    },
    { key: "created", title: "提交时间", width: 150, render: (r) => <CellDate value={r.submittedAt ?? r.createdAt} time /> },
    {
      key: "ops",
      title: "操作",
      kind: "actions",
      render: (r) => {
        const actions = govRequestActions(r);
        return (
          <RowActionBar
            label={`${r.requester.name}「${r.target.label}」的更多操作`}
            actions={[
              // The row's main decisions (first two, e.g. 批准 / 驳回) stay inline even when destructive; they open a confirm dialog.
              ...actions.map((a, i) => ({
                key: a,
                label: GOV_REQUEST_ACTIONS[a].label,
                icon: REQUEST_ACTION_ICON[a],
                destructive: GOV_REQUEST_ACTIONS[a].destructive,
                ...(i < 2 && GOV_REQUEST_ACTIONS[a].destructive ? { menuOnly: false } : {}),
                onSelect: () => setPending({ request: r, action: a }),
              })),
              { key: "detail", label: "查看详情", icon: <Eye />, onSelect: () => setDetail(r) },
            ]}
          />
        );
      },
    },
  ];
  const a = pending?.action;
  const meta = a ? GOV_REQUEST_ACTIONS[a] : null;
  return (
    <>
      <DataTable rowHeight="medium" caption="权限申请" rows={rows} rowKey={(r) => r.id} columns={columns} pagination={{ mode: "all" }} emptyKind={filtered ? "no-results" : "empty"} emptyLabel={empty} emptyAction={emptyAction} />
      <ConfirmDialog
        open={pending !== null}
        title={meta ? `${meta.label}申请` : ""}
        destructive={!!meta?.destructive}
        confirmLabel={meta?.label ?? "确定"}
        impact={pending && meta ? `${pending.request.requester.name} 的「${pending.request.target.label}」：${meta.impact}` : undefined}
        reason={!meta || meta.note === "none" ? undefined : meta.note === "required" ? { label: a === "reject" ? "驳回原因" : "收回原因", required: true, placeholder: "申请人会看到这段话，并写进审计" } : { label: a === "approve" ? "审批意见" : "说明", placeholder: "可不填" }}
        onClose={() => setPending(null)}
        onConfirm={async (note) => {
          if (!pending) return;
          const { request, action } = pending;
          try {
            await api.requests[action](request.id, note);
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          onDone(`已${GOV_REQUEST_ACTIONS[action].label}：${request.requester.name}「${request.target.label}」`);
        }}
      >
        {pending && pending.request.chain.length > 0 && <ApprovalChain request={pending.request} />}
      </ConfirmDialog>
      {detail && (
        <RequestDetail
          request={detail}
          now={at}
          onClose={() => setDetail(null)}
          onAction={(action) => {
            setDetail(null);
            setPending({ request: detail, action });
          }}
        />
      )}
    </>
  );
}

const STEP_ICON = { approved: CircleCheck, rejected: CircleX, current: CircleDot, waiting: Circle, skipped: MinusCircle } as const;
const STEP_STATE = { approved: "已批准", rejected: "已驳回", current: "审批中", waiting: "未开始", skipped: "未处理" } as const;
/** Approval chain timeline: one line per step with who decided / who can decide and the note. */
export function ApprovalChain({ request }: { request: Pick<AccessRequestDto, "chain" | "status" | "step" | "decisionNote"> }) {
  const steps = chainSteps(request);
  if (!steps.length) return <p className="aui-note">{chainProgressText(request)}</p>;
  return (
    <ol className="aui-gov-chain" aria-label="审批进度">
      {steps.map((s, i) => {
        const Icon = STEP_ICON[s.state];
        return (
          <li key={s.index} data-state={s.state}>
            <Icon size={16} aria-hidden="true" className="aui-gov-chain-icon" />
            <div className="aui-gov-chain-text">
              <strong>{`第 ${i + 1} 级：${s.label}`}</strong>
              <span className="aui-note">
                {STEP_STATE[s.state]}
                {s.who ? ` · ${s.state === "approved" || s.state === "rejected" ? s.who : `候选：${s.who}`}` : ""}
                {s.at ? " · " : ""}
                {s.at && <CellDate value={s.at} time />}
              </span>
              {s.note && <span className="aui-gov-chain-note">{s.note}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RequestDetail({ request: r, now, onClose, onAction }: { request: AccessRequestDto; now: Date; onClose: () => void; onAction: (a: GovRequestAction) => void }) {
  const actions = govRequestActions(r);
  return (
    <Dialog
      open
      size="lg"
      title={`${r.requester.name}：${targetText(r)}`}
      description={REQUEST_KIND_LABEL[r.kind]}
      titleAdornment={<StatusBadge tone={requestTone(r.status)}>{GOV_REQUEST_STATUS_LABEL[r.status]}</StatusBadge>}
      onClose={onClose}
      footer={
        <>
          {actions.map((a) => (
            <Button key={a} variant={GOV_REQUEST_ACTIONS[a].destructive ? "destructive" : a === "approve" || a === "submit" ? "default" : "outline"} onClick={() => onAction(a)}>
              {GOV_REQUEST_ACTIONS[a].label}
            </Button>
          ))}
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </>
      }
    >
      <div className="aui-gov-body">
      <DescriptionList
        items={[
          { label: "申请内容", value: targetText(r), hint: r.target.resourceType },
          { label: "级别 / 范围", value: [r.level && RECORD_LEVEL_LABEL[r.level], r.scope && describeScope(r.scope)].filter(Boolean).join(" · ") || null },
          { label: "期限", value: <ExpiryBadge expiresAt={r.expiresAt} now={now} />, hint: r.expiresAt ? <CellDate value={r.expiresAt} time /> : undefined },
          { label: "提交时间", value: r.submittedAt ? <CellDate value={r.submittedAt} time /> : "未提交" },
          { label: "生效时间", value: r.activatedAt ? <CellDate value={r.activatedAt} time /> : null },
          { label: "结束时间", value: r.endedAt ? <CellDate value={r.endedAt} time /> : null },
          ...(r.kind === "emergency"
            ? [
                { label: "监督人", value: r.supervisor?.name ?? null },
                { label: "事后复核", value: r.postReview ? `${POST_REVIEW_LABEL[r.postReview.status]}${r.postReview.note ? `：${r.postReview.note}` : ""}` : null },
              ]
            : []),
          { label: "理由", value: r.reason, full: true },
          ...(r.decisionNote ? [{ label: "审批意见", value: `${r.decidedBy ?? ""}${r.decidedBy ? "：" : ""}${r.decisionNote}`, full: true }] : []),
        ]}
      />
      <section aria-label="审批进度">
        <h3 className="aui-gov-subtitle">审批进度</h3>
        <ApprovalChain request={r} />
      </section>
      </div>
    </Dialog>
  );
}

function NewRequestDialog({ targets, resources, now, onClose, onSubmit }: { targets: NonNullable<AccessRequestsPageProps["targets"]>; resources?: readonly GovOption[]; now: () => Date; onClose: () => void; onSubmit: (input: AccessRequestInput) => Promise<void> }) {
  const id = useId();
  const [kind, setKind] = useState<GovRequestTargetKind>("role");
  const [target, setTarget] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [level, setLevel] = useState<"viewer" | "editor">("viewer");
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");
  const [draft, setDraft] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = !!(target || reason || expires || resourceType);
  const options = kind === "record" ? [] : (targets[kind] ?? []);
  return (
    <FormDialog
      open
      title="申请权限"
      description="写清楚为什么需要、要多久；审批人按审批流程逐级处理。"
      dirty={dirty}
      submitLabel={draft ? "存为草稿" : "提交申请"}
      onClose={onClose}
      onSubmit={async () => {
        let expiresAt: string | null = null;
        try {
          expiresAt = localInputToIso(expires);
        } catch {
          setErrors({ expiresAt: "到期时间格式不对" });
          throw new Error("请先改正标红的项");
        }
        const input: AccessRequestInput = {
          target: { kind, id: target.trim(), ...(kind === "record" ? { resourceType } : {}) },
          ...(kind === "record" ? { level } : {}),
          reason: reason.trim(),
          expiresAt,
          submit: !draft,
        };
        const e = validateRequestInput(input, now());
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onSubmit(input);
      }}
    >
      <FormField label="申请什么" htmlFor={`${id}-kind`}>
        <SegmentedControl className="aui-gov-seg"
          label="申请什么"
          size="sm"
          value={kind}
          onValueChange={(v) => {
            setKind(v);
            setTarget("");
          }}
          options={[{ value: "role", label: "角色" }, { value: "permission", label: "单项权限" }, { value: "record", label: "某条记录" }]}
        />
      </FormField>
      {kind === "record" ? (
        <>
          <FormField label="资源类型" htmlFor={`${id}-res`} required error={errors.resourceType}>
            {resources?.length ? <Choice label="资源类型" placeholder="选择资源类型" value={resourceType} onChange={setResourceType} options={toChoice(resources)} /> : <Input id={`${id}-res`} value={resourceType} placeholder="例：customer" onChange={(e) => setResourceType(e.target.value.trim())} />}
          </FormField>
          <FormField label="记录编号" htmlFor={`${id}-target`} required error={errors.target}>
            <Input id={`${id}-target`} value={target} placeholder="例：C-1024" onChange={(e) => setTarget(e.target.value)} />
          </FormField>
          <FormField label="要的级别" htmlFor={`${id}-level`} error={errors.level}>
            <SegmentedControl className="aui-gov-seg" label="要的级别" size="sm" value={level} onValueChange={setLevel} options={[{ value: "viewer", label: RECORD_LEVEL_LABEL.viewer }, { value: "editor", label: RECORD_LEVEL_LABEL.editor }]} />
          </FormField>
        </>
      ) : (
        <FormField label={kind === "role" ? "角色" : "权限"} htmlFor={`${id}-target`} required error={errors.target}>
          {options.length ? <Choice label={kind === "role" ? "角色" : "权限"} placeholder={`选择${kind === "role" ? "角色" : "权限"}`} value={target} onChange={setTarget} options={toChoice(options)} /> : <Input id={`${id}-target`} value={target} placeholder={kind === "role" ? "角色编号" : "例：finance:export"} onChange={(e) => setTarget(e.target.value)} />}
        </FormField>
      )}
      <FormField label="为什么需要" htmlFor={`${id}-reason`} required error={errors.reason} hint="审批人据此判断，也会写进审计">
        <Textarea id={`${id}-reason`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <div className="aui-gov-stack">
        <FormField label="到期时间" htmlFor={`${id}-exp`} error={errors.expiresAt} hint="留空 = 长期（审批流程可能会截短）">
          <DateTimePicker id={`${id}-exp`} clearable value={expires} onChange={setExpires} />
        </FormField>
        <QuickDatePresets days={[1, 7, 30, 90]} permanent="长期" onPick={setExpires} now={now} />
      </div>
      <label className="aui-gov-check">
        <Checkbox checked={draft} onCheckedChange={(v) => setDraft(v === true)} aria-label="先存草稿，不提交" />
        先存草稿，不提交
      </label>
    </FormDialog>
  );
}
