"use client";
/**
 * EmergencyAccessPage — firefighter access: take a role / permission for a short time with a reason
 * (≥ 10 characters) and a supervisor (not yourself); a live countdown, 「立即结束」, and the
 * supervisor's post review with the log of everything done while elevated.
 * EmergencyCountdown — the ticking remaining time, reusable.
 */
import { useEffect, useId, useRef, useState } from "react";
import { CircleStop, ClipboardCheck, Siren } from "lucide-react";
import { Button, Choice, StatusBadge, Textarea } from "../../primitives.tsx";
import { SegmentedControl } from "../../choices.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../../forms.tsx";
import { DescriptionList, InlineAlert, PageBody, PageHeader, ResourcePanel, StatePanel } from "../../layout.tsx";
import { DataTable } from "../../data.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import { CellText } from "../../cells.tsx";
import { CellDate } from "../../displays.tsx";
import { requestTone } from "../review-core.ts";
import { GOV_REQUEST_STATUS_LABEL, POST_REVIEW_LABEL, REQUEST_TARGET_LABEL, type AccessRequestDto, type EmergencyInput, type GovAuditEventDto, type GovOption } from "./contracts.ts";
import { EMERGENCY_MIN_REASON, emergencyCountdown, needsPostReview, validateEmergency, validateEmergencyReview } from "./request-core.ts";
import { govErrorMessage, type GovernanceApi } from "./api.ts";
import { GovLoad, feedbackOf, staleAlert, ReadOnlyNote, defaultNow, optionLabeler, toChoice, useGov, useNotice, useTicker, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type EmergencyTarget = GovOption & { kind: "role" | "permission" };
export type EmergencyAccessPageProps = GovPageBaseProps & {
  /** The signed-in user (supervisor must be someone else). */
  me: { id: string; name: string };
  /** Roles / permissions that may be taken in an emergency. */
  targets: readonly EmergencyTarget[];
  /** Who can supervise (the current user is filtered out). */
  supervisors: readonly GovOption[];
  /** Longest elevation in minutes (default 240; the server caps it too). */
  maxMinutes?: number;
  /** use: may start an elevation (qx:emergency.use). */
  can?: { use?: boolean };
};

const PRESETS = [30, 60, 120, 240];

/** Live remaining time of an active elevation; calls `onOver` once when it runs out. */
export function EmergencyCountdown({ request, now = defaultNow, onOver }: { request: Pick<AccessRequestDto, "status" | "expiresAt" | "startsAt" | "endedAt">; now?: () => Date; onOver?: () => void }) {
  const running = request.status === "active" && !request.endedAt;
  const at = useTicker(now, 1000, running);
  const state = emergencyCountdown(request, at);
  const fired = useRef(false);
  useEffect(() => {
    if (state.state === "over" && running && !fired.current) {
      fired.current = true;
      onOver?.();
    }
  }, [state.state, running, onOver]);
  if (!running) return <span className="aui-note">已结束</span>;
  return (
    <span className="aui-gov-countdown" data-state={state.state} role="timer" aria-label={state.label}>
      <strong aria-hidden="true">{state.clock}</strong>
      <span className="aui-note" aria-hidden="true">{state.state === "ending" ? "即将结束" : state.state === "waiting" ? "还没开始" : "剩余"}</span>
    </span>
  );
}

export function EmergencyAccessPage({ api, me, targets, supervisors, maxMinutes = 240, can = {}, active = true, now = defaultNow }: EmergencyAccessPageProps) {
  const mine = useGov<AccessRequestDto[]>("gov:emergency:mine", (signal) => api.requests.list({ view: "mine", kind: "emergency" }, { signal }), active);
  const todo = useGov<AccessRequestDto[]>("gov:emergency:todo", (signal) => api.requests.list({ view: "todo", kind: "emergency" }, { signal }), active);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState<AccessRequestDto | null>(null);
  const [reviewing, setReviewing] = useState<AccessRequestDto | null>(null);
  const [notice, setNotice] = useNotice();
  const use = !!can.use;
  const supervisorName = optionLabeler(supervisors);
  const refresh = () => {
    void mine.refresh();
    void todo.refresh();
  };
  const running = (mine.data ?? []).filter((r) => r.status === "active" && !r.endedAt);
  const toReview = (todo.data ?? []).filter(needsPostReview);

  return (
    <>
      <PageHeader
        title="紧急提权"
        description="线上故障等紧急情况下临时拿到一个角色或权限，到时间自动收回。全程记审计，结束后由监督人逐条复核做过的操作。"
        actions={use && <Button variant="destructive" onClick={() => setStarting(true)}><Siren />发起紧急提权</Button>}
      />
      <PageBody>
        {!use && <ReadOnlyNote permission="紧急提权 · 可以发起">你没有「紧急提权 · 可以发起」权限，只能查看和复核。</ReadOnlyNote>}
        {notice}
        {running.length > 0 && (
          <InlineAlert tone="warning" title={`你正处于紧急提权中（${running.length} 项）`}>
            用完请立即结束；每一步操作都会记入审计，并由监督人事后复核。
          </InlineAlert>
        )}
        <ResourcePanel title="我的紧急提权" count={mine.data?.length} actions={<Button variant="outline" disabled={mine.loading} onClick={refresh}>刷新</Button>} feedback={feedbackOf(staleAlert(mine))}>
          <GovLoad res={mine} label="紧急提权记录">
            {(rows) => (
              <DataTable rowHeight="medium"
                caption="我的紧急提权"
                rows={rows}
                rowKey={(r) => r.id}
                pagination={{ mode: "all" }}
                emptyLabel="没有紧急提权记录"
                columns={[
                  { key: "what", title: "临时拿到", minWidth: 160, maxWidth: 260, render: (r) => <CellText primary={`${REQUEST_TARGET_LABEL[r.target.kind]}：${r.target.label}`} secondary={r.reason} secondaryTitle={r.reason} /> },
                  { key: "status", title: "状态", width: 100, render: (r) => <StatusBadge tone={requestTone(r.status)}>{GOV_REQUEST_STATUS_LABEL[r.status]}</StatusBadge> },
                  { key: "left", title: "剩余时间", width: 130, render: (r) => (r.status === "active" && !r.endedAt ? <EmergencyCountdown request={r} now={now} onOver={refresh} /> : r.endedAt ? <CellDate value={r.endedAt} time /> : "—") },
                  { key: "sup", title: "监督人", width: 100, render: (r) => r.supervisor?.name ?? "—" },
                  { key: "review", title: "事后复核", width: 120, render: (r) => <PostReviewBadge request={r} /> },
                  {
                    key: "ops",
                    title: "操作",
                    kind: "actions",
                    render: (r) =>
                      r.status === "active" && !r.endedAt ? (
                        <RowActionBar
                          label={`${r.target.label}的更多操作`}
                          actions={[{ key: "end", label: "立即结束", icon: <CircleStop />, destructive: true, menuOnly: false, onSelect: () => setEnding(r) }]}
                        />
                      ) : null,
                  },
                ]}
              />
            )}
          </GovLoad>
        </ResourcePanel>
        <ResourcePanel title="待我复核" count={todo.data ? toReview.length : undefined} description="你是监督人的紧急提权：结束后逐条看做过的操作，确认无异常或标记异常。" feedback={feedbackOf(staleAlert(todo))}>
          <GovLoad res={todo} label="待复核列表">
            {() => (
              <DataTable rowHeight="medium"
                caption="待我复核的紧急提权"
                rows={toReview}
                rowKey={(r) => r.id}
                pagination={{ mode: "all" }}
                emptyLabel="没有待你复核的紧急提权"
                columns={[
                  { key: "who", title: "发起人", minWidth: 100, render: (r) => r.requester.name },
                  { key: "what", title: "临时拿到", minWidth: 160, maxWidth: 260, render: (r) => <CellText primary={`${REQUEST_TARGET_LABEL[r.target.kind]}：${r.target.label}`} secondary={r.reason} secondaryTitle={r.reason} /> },
                  { key: "when", title: "时间", width: 160, render: (r) => <CellText primary={r.activatedAt ? <CellDate value={r.activatedAt} time /> : "—"} secondary={r.endedAt ? "已结束" : "进行中"} /> },
                  { key: "status", title: "状态", width: 100, render: (r) => <StatusBadge tone={requestTone(r.status)}>{GOV_REQUEST_STATUS_LABEL[r.status]}</StatusBadge> },
                  { key: "ops", title: "操作", kind: "actions", render: (r) => <RowActionBar label={`${r.requester.name}的${r.target.label}的更多操作`} actions={[{ key: "review", label: "复核", icon: <ClipboardCheck />, onSelect: () => setReviewing(r) }]} /> },
                ]}
              />
            )}
          </GovLoad>
        </ResourcePanel>
      </PageBody>
      {starting && (
        <StartDialog
          me={me}
          targets={targets}
          supervisors={supervisors}
          maxMinutes={maxMinutes}
          onClose={() => setStarting(false)}
          onStart={async (input) => {
            try {
              await api.emergency.start(input);
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
            setNotice(`已开始紧急提权，${input.minutes ?? 60} 分钟后自动收回；监督人：${supervisorName(input.supervisorId)}`);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={ending !== null}
        title="立即结束紧急提权"
        confirmLabel="立即结束"
        impact={ending ? `马上收回「${ending.target.label}」。之后要再用需要重新发起。` : undefined}
        onClose={() => setEnding(null)}
        onConfirm={async () => {
          if (!ending) return;
          try {
            await api.emergency.end(ending.id);
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`已结束「${ending.target.label}」的紧急提权，等待监督人复核`);
          refresh();
        }}
      />
      {reviewing && (
        <ReviewDialog
          api={api}
          request={reviewing}
          onClose={() => setReviewing(null)}
          onDone={(flagged) => {
            setNotice(flagged ? `已标记异常：${reviewing.requester.name}「${reviewing.target.label}」` : `复核完成：${reviewing.requester.name}「${reviewing.target.label}」无异常`);
            refresh();
          }}
        />
      )}
    </>
  );
}

function PostReviewBadge({ request: r }: { request: AccessRequestDto }) {
  if (!r.postReview) return <span className="aui-note">{r.status === "active" ? "结束后复核" : "—"}</span>;
  const tone = r.postReview.status === "ok" ? "success" : r.postReview.status === "flagged" ? "danger" : "warning";
  return <StatusBadge tone={tone}>{POST_REVIEW_LABEL[r.postReview.status]}</StatusBadge>;
}

function StartDialog({ me, targets, supervisors, maxMinutes, onClose, onStart }: { me: { id: string; name: string }; targets: readonly EmergencyTarget[]; supervisors: readonly GovOption[]; maxMinutes: number; onClose: () => void; onStart: (input: EmergencyInput) => Promise<void> }) {
  const id = useId();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const length = [...reason.trim()].length;
  const presets = PRESETS.filter((m) => m <= maxMinutes);
  const picked = targets.find((t) => `${t.kind}:${t.id}` === target);
  return (
    <FormDialog
      open
      title="发起紧急提权"
      description="只在紧急情况下用。开始后立即生效，到时间自动收回；全程记审计，结束后监督人复核。"
      dirty={!!(target || reason || supervisorId)}
      destructive
      submitLabel="开始提权"
      onClose={onClose}
      onSubmit={async () => {
        const input: EmergencyInput = { target: { kind: picked?.kind ?? "role", id: picked?.id ?? "" }, reason: reason.trim(), supervisorId, minutes: Number(minutes) };
        const e = validateEmergency(input, me.id, maxMinutes);
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onStart(input);
      }}
    >
      <FormField label="临时拿到" htmlFor={`${id}-target`} required error={errors.target}>
        <Choice label="临时拿到" placeholder="选择角色或权限" value={target} onChange={setTarget} options={targets.map((t) => ({ value: `${t.kind}:${t.id}`, label: `${REQUEST_TARGET_LABEL[t.kind]}：${t.label}` }))} />
      </FormField>
      <FormField label="原因" htmlFor={`${id}-reason`} required error={errors.reason} hint={`至少 ${EMERGENCY_MIN_REASON} 个字，写清楚是什么故障、要做什么（已写 ${length} 个字）`}>
        <Textarea id={`${id}-reason`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <FormField label="监督人" htmlFor={`${id}-sup`} required error={errors.supervisorId} hint="不能是你自己；他会收到通知并在结束后复核">
        <Choice label="监督人" placeholder="选择监督人" value={supervisorId} onChange={setSupervisorId} options={toChoice(supervisors.filter((s) => s.id !== me.id))} />
      </FormField>
      <FormField label="时长" htmlFor={`${id}-min`} error={errors.minutes} hint={`最长 ${maxMinutes} 分钟`}>
        <SegmentedControl className="aui-gov-seg" label="时长" size="sm" value={minutes} onValueChange={setMinutes} options={presets.map((m) => ({ value: String(m), label: m < 60 ? `${m} 分钟` : `${m / 60} 小时` }))} />
      </FormField>
    </FormDialog>
  );
}

function ReviewDialog({ api, request: r, onClose, onDone }: { api: GovernanceApi; request: AccessRequestDto; onClose: () => void; onDone: (flagged: boolean) => void }) {
  const id = useId();
  const log = useGov<GovAuditEventDto[]>(`gov:emergency:actions:${r.id}`, (signal) => api.emergency.actions(r.id, { signal }));
  const [outcome, setOutcome] = useState<"ok" | "flagged">("ok");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <FormDialog
      open
      size="lg"
      title={`复核：${r.requester.name} 的紧急提权`}
      description="看一遍提权期间做过的每一步操作，确认是否都和原因相符。"
      dirty={!!note || outcome !== "ok"}
      submitLabel={outcome === "ok" ? "确认无异常" : "标记异常"}
      destructive={outcome === "flagged"}
      onClose={onClose}
      onSubmit={async () => {
        const e = validateEmergencyReview({ outcome, note });
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        try {
          await api.emergency.review(r.id, { outcome, note: note.trim() });
        } catch (err) {
          throw new Error(govErrorMessage(err));
        }
        onDone(outcome === "flagged");
      }}
    >
      <DescriptionList
        items={[
          { label: "临时拿到", value: `${REQUEST_TARGET_LABEL[r.target.kind]}：${r.target.label}` },
          { label: "时间", value: r.activatedAt ? <CellDate value={r.activatedAt} time /> : null, hint: r.endedAt ? <>结束 <CellDate value={r.endedAt} time /></> : "还在进行中" },
          { label: "原因", value: r.reason, full: true },
        ]}
      />
      <section aria-label="提权期间的操作">
        <h3 className="aui-gov-subtitle">提权期间的操作{log.data ? `（${log.data.length}）` : ""}</h3>
        {log.data === undefined ? (
          log.error ? <StatePanel kind="error" message={`操作记录加载失败：${log.error}`} onRetry={() => void log.refresh()} /> : <StatePanel kind="loading" />
        ) : (
          <DataTable rowHeight="medium"
            caption="提权期间的操作"
            rows={log.data}
            rowKey={(e) => e.id}
            pagination={{ mode: "all" }}
            maxHeight={260}
            emptyLabel="提权期间没有做任何操作"
            columns={[
              { key: "at", title: "时间", width: 150, render: (e) => <CellDate value={e.at} time /> },
              { key: "action", title: "操作", minWidth: 140, render: (e) => <CellText primary={e.action} secondary={`${e.targetType} · ${e.targetId}`} /> },
              { key: "reason", title: "说明", minWidth: 140, maxWidth: 260, truncate: (e) => e.reason ?? "—", render: (e) => e.reason ?? "—" },
            ]}
          />
        )}
      </section>
      <FormField label="复核结论" htmlFor={`${id}-outcome`}>
        <SegmentedControl className="aui-gov-seg" label="复核结论" size="sm" value={outcome} onValueChange={setOutcome} options={[{ value: "ok", label: "无异常" }, { value: "flagged", label: "有异常" }]} />
      </FormField>
      <FormField label="复核意见" htmlFor={`${id}-note`} required={outcome === "flagged"} error={errors.note} hint={outcome === "flagged" ? "写明哪一步不对，会通知安全负责人" : "可不填"}>
        <Textarea id={`${id}-note`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
    </FormDialog>
  );
}
