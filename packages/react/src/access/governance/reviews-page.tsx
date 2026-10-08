"use client";
/**
 * ReviewsPage — access review campaigns (复核): list / create / close, then a campaign's items with
 * keep / revoke (revoke needs a reason), stale and never-used hints and progress. Items reuse
 * ReviewList from the access components.
 */
import { useId, useState, type ReactNode } from "react";
import { ArrowLeft, CircleStop, ClipboardCheck, Eye, Plus } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge } from "../../primitives.tsx";
import { ChipGroup, QuickDatePresets } from "../../choices.tsx";
import { DateTimePicker } from "../../date-picker.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../../forms.tsx";
import { DescriptionList, InlineAlert, PageBody, PageHeader, Panel, ResourcePanel } from "../../layout.tsx";
import { DataTable } from "../../data.tsx";
import { CellText } from "../../cells.tsx";
import { CellDate } from "../../displays.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import { ReviewList } from "../requests.tsx";
import { localInputToIso } from "../review-core.ts";
import {
  REVIEW_DEADLINE_LABEL,
  REVIEW_SCOPE_LABEL,
  REVIEWER_KIND_LABEL,
  type GovOption,
  type ReviewCampaignDto,
  type ReviewCampaignInput,
  type ReviewDeadlineAction,
  type ReviewItemDto,
  type ReviewScopeKind,
  type ReviewerKind,
} from "./contracts.ts";
import { campaignCloseImpact, campaignDeadline, campaignProgress, campaignScopeText, toReviewItem, validateCampaign } from "./request-core.ts";
import { govErrorMessage, type GovernanceApi } from "./api.ts";
import { GovLoad, feedbackOf, staleAlert, ReadOnlyNote, StaleAlert, defaultNow, optionLabeler, toChoice, useGov, useNotice, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type ReviewsPageProps = GovPageBaseProps & {
  roles?: readonly GovOption[];
  users?: readonly GovOption[];
  depts?: readonly GovOption[];
  /** Resource types (scope kind「resource」). */
  resources?: readonly GovOption[];
  /** manage: create / close campaigns and see every item (qx:review.manage). */
  can?: { manage?: boolean };
};

export function ReviewsPage({ api, roles, users, depts, resources, can = {}, active = true, now = defaultNow }: ReviewsPageProps) {
  const res = useGov<ReviewCampaignDto[]>("gov:reviews", (signal) => api.reviews.list({ signal }), active);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<ReviewCampaignDto | null>(null);
  const [notice, setNotice] = useNotice();
  const manage = !!can.manage;
  const label = optionLabeler(roles, users, depts, resources);
  const named = (_kind: string, id: string) => label(id);
  const at = now();
  const opened = res.data?.find((c) => c.id === openId) ?? null;

  if (opened)
    return (
      <CampaignItems
        api={api}
        campaign={opened}
        manage={manage}
        active={active}
        now={now}
        named={named}
        onBack={() => setOpenId(null)}
        onChanged={() => void res.refresh()}
        onClose={() => setClosing(opened)}
        closeDialog={<CloseCampaign campaign={closing} api={api} onClose={() => setClosing(null)} onClosed={(c) => { setNotice(`已关闭「${c.name}」`); void res.refresh(); }} />}
      />
    );

  return (
    <>
      <PageHeader
        title="权限复核"
        description="定期让上级或负责人确认每个人的权限还需不需要。从没用过、长期没用的会标出来；到截止时间没处理的按设定自动收回 / 保留。"
        actions={manage && <Button onClick={() => setCreating(true)}><Plus />发起复核</Button>}
      />
      <PageBody>
        {!manage && <ReadOnlyNote permission="权限复核 · 发起 / 关闭">你可以处理分给你的复核项；发起和关闭复核需要「权限复核 · 发起 / 关闭」权限。</ReadOnlyNote>}
        <ResourcePanel
          title="复核活动"
          count={res.data?.length}
          actions={<Button variant="outline" disabled={res.loading} onClick={() => void res.refresh()}>刷新</Button>}
          feedback={feedbackOf(notice, staleAlert(res))}
        >
          <GovLoad res={res} label="复核活动">
            {(list) => (
              <DataTable rowHeight="medium"
                caption="复核活动"
                rows={list}
                rowKey={(c) => c.id}
                pagination={{ mode: "all" }}
                emptyLabel="还没有复核活动"
                emptyAction={manage ? <Button onClick={() => setCreating(true)}>发起复核</Button> : undefined}
                columns={[
                  { key: "name", title: "复核", minWidth: 180, maxWidth: 280, render: (c) => <CellText primary={c.name} secondary={campaignScopeText(c, named).scope} /> },
                  { key: "reviewer", title: "复核人", minWidth: 140, maxWidth: 220, truncate: (c) => campaignScopeText(c, named).reviewer, render: (c) => campaignScopeText(c, named).reviewer },
                  {
                    key: "progress",
                    title: "进度",
                    width: 170,
                    render: (c) => {
                      const p = campaignProgress(c);
                      return <CellText primary={<span className="aui-gov-progress"><progress max={100} value={p.percent} aria-label={`${c.name} 复核进度`} />{p.text}</span>} secondary={p.detail} />;
                    },
                  },
                  {
                    key: "deadline",
                    title: "截止",
                    width: 150,
                    render: (c) => {
                      const d = campaignDeadline(c, at);
                      return <CellText primary={<CellDate value={c.deadline} />} secondary={<StatusBadge tone={d.tone}>{d.label}</StatusBadge>} />;
                    },
                  },
                  {
                    key: "ops",
                    title: "操作",
                    kind: "actions",
                    render: (c) => (
                      <RowActionBar
                        label={`${c.name}的更多操作`}
                        actions={[
                          c.status === "open"
                            ? { key: "handle", label: "处理", icon: <ClipboardCheck />, onSelect: () => setOpenId(c.id) }
                            : { key: "view", label: "查看", icon: <Eye />, onSelect: () => setOpenId(c.id) },
                          ...(manage && c.status === "open" ? [{ key: "close", label: "关闭复核", icon: <CircleStop />, destructive: true, onSelect: () => setClosing(c) }] : []),
                        ]}
                      />
                    ),
                  },
                ]}
              />
            )}
          </GovLoad>
        </ResourcePanel>
      </PageBody>
      {creating && (
        <CreateCampaign
          roles={roles}
          users={users}
          depts={depts}
          resources={resources}
          now={now}
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            try {
              const c = await api.reviews.create(input);
              setNotice(`已发起「${c.name}」，共 ${c.progress.total} 项待复核`);
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
            void res.refresh();
          }}
        />
      )}
      <CloseCampaign campaign={closing} api={api} onClose={() => setClosing(null)} onClosed={(c) => { setNotice(`已关闭「${c.name}」`); void res.refresh(); }} />
    </>
  );
}

function CloseCampaign({ campaign, api, onClose, onClosed }: { campaign: ReviewCampaignDto | null; api: GovernanceApi; onClose: () => void; onClosed: (c: ReviewCampaignDto) => void }) {
  return (
    <ConfirmDialog
      open={campaign !== null}
      title="关闭复核"
      destructive
      confirmLabel="关闭复核"
      impact={campaign ? `关闭「${campaign.name}」：${campaignCloseImpact(campaign)}` : undefined}
      onClose={onClose}
      onConfirm={async () => {
        if (!campaign) return;
        try {
          await api.reviews.close(campaign.id);
        } catch (e) {
          throw new Error(govErrorMessage(e));
        }
        onClosed(campaign);
      }}
    />
  );
}

function CampaignItems({
  api,
  campaign: c,
  manage,
  active,
  now,
  named,
  onBack,
  onChanged,
  onClose,
  closeDialog,
}: {
  api: GovernanceApi;
  campaign: ReviewCampaignDto;
  manage: boolean;
  active: boolean;
  now: () => Date;
  named: (kind: string, id: string) => string;
  onBack: () => void;
  onChanged: () => void;
  onClose: () => void;
  closeDialog: ReactNode;
}) {
  const [all, setAll] = useState(false);
  const items = useGov<ReviewItemDto[]>(`gov:review:${c.id}:${all ? "all" : "mine"}`, (signal) => api.reviews.items(c.id, { mine: !all }, { signal }), active);
  const [failure, setFailure] = useState("");
  const text = campaignScopeText(c, named);
  const open = c.status === "open";
  return (
    <>
      <PageHeader
        title={c.name}
        description={`${text.scope} · ${text.reviewer}`}
        actions={
          <>
            <Button variant="outline" onClick={onBack}><ArrowLeft />返回复核列表</Button>
            {manage && open && <Button variant="destructive" onClick={onClose}>关闭复核</Button>}
          </>
        }
      />
      <PageBody>
        <Panel title="复核信息">
          <DescriptionList
            columns={3}
            items={[
              { label: "截止时间", value: <CellDate value={c.deadline} time />, hint: campaignDeadline(c, now()).label },
              { label: "到期未处理", value: REVIEW_DEADLINE_LABEL[c.onDeadline] },
              { label: "久未使用", value: `${c.staleDays} 天没用` },
              { label: "进度", value: campaignProgress(c).text, hint: campaignProgress(c).detail },
              { label: "状态", value: open ? "进行中" : "已关闭", hint: c.closedAt ? <CellDate value={c.closedAt} time /> : undefined },
            ]}
          />
        </Panel>
        <Panel
          title={all ? "全部复核项" : "分给我的复核项"}
          actions={
            manage && (
              <label className="aui-gov-check">
                <Checkbox checked={all} onCheckedChange={(v) => setAll(v === true)} aria-label="显示全部复核项" />
                显示全部（不只是分给我的）
              </label>
            )
          }
        >
          {!open && <InlineAlert tone="info" title="复核已关闭，结果只读" />}
          {failure && <InlineAlert tone="error" title="没有保存成功">{failure}</InlineAlert>}
          <StaleAlert res={items} />
          <GovLoad res={items} label="复核项">
            {(list) => (
              <ReviewList
                title={c.name}
                items={list.map(toReviewItem)}
                dueAt={c.deadline}
                staleDays={c.staleDays}
                readOnly={!open}
                now={now()}
                onDecide={async (ids, decision, note) => {
                  setFailure("");
                  const failed: string[] = [];
                  for (const itemId of ids) {
                    try {
                      await api.reviews.decide(c.id, itemId, { decision, ...(note ? { note } : {}) });
                    } catch (e) {
                      failed.push(govErrorMessage(e));
                    }
                  }
                  await items.refresh();
                  onChanged();
                  if (failed.length) throw new Error(`${failed.length} 项没保存成功：${failed[0]}`);
                }}
              />
            )}
          </GovLoad>
        </Panel>
      </PageBody>
      {closeDialog}
    </>
  );
}

function CreateCampaign({ roles, users, depts, resources, now, onClose, onCreate }: { roles?: readonly GovOption[]; users?: readonly GovOption[]; depts?: readonly GovOption[]; resources?: readonly GovOption[]; now: () => Date; onClose: () => void; onCreate: (input: ReviewCampaignInput) => Promise<void> }) {
  const id = useId();
  const [name, setName] = useState("");
  const [scopeKind, setScopeKind] = useState<ReviewScopeKind>("role");
  const [scopeId, setScopeId] = useState("");
  const [reviewerKind, setReviewerKind] = useState<ReviewerKind>("manager");
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [reviewerRole, setReviewerRole] = useState("");
  const [deadline, setDeadline] = useState("");
  const [onDeadline, setOnDeadline] = useState<ReviewDeadlineAction>("none");
  const [staleDays, setStaleDays] = useState("90");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const scopeOptions = scopeKind === "role" ? roles : scopeKind === "dept" ? depts : scopeKind === "resource" ? resources : undefined;
  return (
    <FormDialog
      open
      title="发起复核"
      description="选范围和复核人；发起后复核人会收到待办。"
      dirty={!!(name || scopeId || deadline)}
      submitLabel="发起"
      onClose={onClose}
      onSubmit={async () => {
        let iso = "";
        try {
          iso = localInputToIso(deadline) ?? "";
        } catch {
          iso = "";
        }
        const input: ReviewCampaignInput = {
          name: name.trim(),
          scope: { kind: scopeKind, id: scopeKind === "all" ? null : scopeId || null },
          reviewer: { kind: reviewerKind, ...(reviewerKind === "users" ? { ids: reviewerIds } : {}), ...(reviewerKind === "role_holder" ? { roleId: reviewerRole || null } : {}) },
          deadline: iso,
          onDeadline,
          staleDays: Number(staleDays),
        };
        const e = validateCampaign(input, now());
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onCreate(input);
      }}
    >
      <FormField label="名称" htmlFor={`${id}-name`} required error={errors.name}>
        <Input id={`${id}-name`} value={name} placeholder="例：2026 Q4 财务权限复核" onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="复核范围" htmlFor={`${id}-scope`}>
        <Choice label="复核范围" value={scopeKind} onChange={(v) => { setScopeKind(v as ReviewScopeKind); setScopeId(""); }} options={(Object.keys(REVIEW_SCOPE_LABEL) as ReviewScopeKind[]).map((k) => ({ value: k, label: REVIEW_SCOPE_LABEL[k] }))} />
      </FormField>
      {scopeKind !== "all" && (
        <FormField label="具体范围" htmlFor={`${id}-scope-id`} required error={errors.scopeId}>
          {scopeOptions?.length ? <Choice label="具体范围" placeholder="选择" value={scopeId} onChange={setScopeId} options={toChoice(scopeOptions)} /> : <Input id={`${id}-scope-id`} value={scopeId} placeholder="编号" onChange={(e) => setScopeId(e.target.value.trim())} />}
        </FormField>
      )}
      <FormField label="谁来复核" htmlFor={`${id}-reviewer`}>
        <Choice label="谁来复核" value={reviewerKind} onChange={(v) => setReviewerKind(v as ReviewerKind)} options={(Object.keys(REVIEWER_KIND_LABEL) as ReviewerKind[]).map((k) => ({ value: k, label: REVIEWER_KIND_LABEL[k] }))} />
      </FormField>
      {reviewerKind === "users" && (
        <FormField label="复核人" htmlFor={`${id}-reviewers`} required error={errors.reviewerIds}>
          {users?.length ? <ChipGroup label="复核人" value={reviewerIds} onValueChange={setReviewerIds} options={users.map((u) => ({ value: u.id, label: u.label }))} /> : <Input id={`${id}-reviewers`} value={reviewerIds.join(", ")} placeholder="编号，多个用逗号隔开" onChange={(e) => setReviewerIds(e.target.value.split(/[,，\s]+/).filter(Boolean))} />}
        </FormField>
      )}
      {reviewerKind === "role_holder" && (
        <FormField label="复核角色" htmlFor={`${id}-reviewer-role`} required error={errors.reviewerRole}>
          {roles?.length ? <Choice label="复核角色" placeholder="选择角色" value={reviewerRole} onChange={setReviewerRole} options={toChoice(roles)} /> : <Input id={`${id}-reviewer-role`} value={reviewerRole} onChange={(e) => setReviewerRole(e.target.value.trim())} />}
        </FormField>
      )}
      <div className="aui-gov-stack">
        <FormField label="截止时间" htmlFor={`${id}-deadline`} required error={errors.deadline}>
          <DateTimePicker id={`${id}-deadline`} clearable value={deadline} onChange={setDeadline} />
        </FormField>
        <QuickDatePresets days={[7, 14, 30]} onPick={setDeadline} now={now} />
      </div>
      <FormField label="到截止时间还没处理的" htmlFor={`${id}-on`}>
        <Choice label="到截止时间还没处理的" value={onDeadline} onChange={(v) => setOnDeadline(v as ReviewDeadlineAction)} options={(Object.keys(REVIEW_DEADLINE_LABEL) as ReviewDeadlineAction[]).map((k) => ({ value: k, label: REVIEW_DEADLINE_LABEL[k] }))} />
      </FormField>
      <FormField label="多少天没用算久未使用" htmlFor={`${id}-stale`} error={errors.staleDays}>
        <Input id={`${id}-stale`} inputMode="numeric" value={staleDays} onChange={(e) => setStaleDays(e.target.value)} />
      </FormField>
    </FormDialog>
  );
}
