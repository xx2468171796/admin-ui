"use client";
/**
 * TenantMembersPage — the current tenant (from the session), its package and quota usage, and its
 * members: add (with roles and expiry), suspend / resume, change expiry, remove (reason required).
 * TenantQuotas — the quota bars, reusable on the platform tenant detail.
 */
import { Suspense, useId, useState, type ReactNode } from "react";
import { CalendarClock, CirclePause, CirclePlay, Plus, UserMinus } from "lucide-react";
import { Button, Choice, Input, StatusBadge } from "../../primitives.tsx";
import { ChipGroup, QuickDatePresets, SegmentedControl } from "../../choices.tsx";
import { DateTimePicker } from "../../date-picker.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../../forms.tsx";
import { DescriptionList, InlineAlert, PageBody, PageHeader, Panel, ResourcePanel } from "../../layout.tsx";
import { DataTable, QueryBar } from "../../data.tsx";
import { CellTags, CellText } from "../../cells.tsx";
import { CellDate } from "../../displays.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import { QuotaMeter } from "../../portal.tsx";
import { ExpiryBadge } from "../record-team.tsx";
import { isoToLocalInput, localInputToIso } from "../review-core.ts";
import { MEMBER_STATUS_LABEL, TENANT_STATUS_LABEL, type GovOption, type QuotaDto, type TenantContextDto, type TenantMemberDto } from "./contracts.ts";
import { quotaAlerts } from "./governance-core.ts";
import { govErrorMessage } from "./api.ts";
import type { OrgDataSource, PickedSubject } from "../../org-picker/org-picker-core.ts";
import type { OrgPickerFieldProps } from "../../org-picker/org-picker-field.tsx";
import { lazyPart } from "../../lazy-part.ts";
import { GovLoad, feedbackOf, staleAlert, ReadOnlyNote, StaleAlert, defaultNow, optionLabeler, toChoice, useGov, useNotice, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

/** OrgPickerField options the add-member box passes through (wording, availability, defaultFocus, suggestions …). */
export type MemberOrgPickerOptions = Omit<OrgPickerFieldProps, "source" | "value" | "onChange" | "mode" | "selectable" | "commit" | "chips" | "existing">;

export type TenantMembersPageProps = GovPageBaseProps & {
  /** Roles of this tenant (labels + the add dialog). */
  roles?: readonly GovOption[];
  /** People who can be added (free text user id when omitted, unless `orgSource`). */
  users?: readonly GovOption[];
  /**
   * The host's directory: 「添加成员」 picks the person with an OrgPickerField (search the organisation with paths,
   * 「组织架构」 opens the OrgPicker; people only, one at a time; current members greyed as 「已是成员」) instead of the
   * `users` select / a typed user id. Loaded lazily with the dialog.
   */
  orgSource?: OrgDataSource;
  orgPicker?: MemberOrgPickerOptions;
  /** manage: add / suspend / remove (qx:member.manage). */
  can?: { manage?: boolean };
};

/** Quota bars: 已用 / 上限, yellow from 80 %, red when full; null limit = 不限, null used = 未统计. */
export function TenantQuotas({ quotas }: { quotas: readonly QuotaDto[] }) {
  if (!quotas.length) return <p className="aui-note">套餐没有配额限制</p>;
  return (
    <div className="aui-gov-quotas">
      {quotas.map((q) => (
        <QuotaMeter
          key={q.key}
          label={q.label}
          used={q.used}
          total={q.limit === 0 ? null : q.limit}
          unlimitedText={q.limit === 0 ? "0（不允许）" : "不限"}
          hint={q.used === null ? "这项用量由业务系统统计，这里看不到" : q.limit !== null && q.used >= q.limit ? "已达上限：再加会被拒绝，需要升级套餐或调高配额" : undefined}
        />
      ))}
    </div>
  );
}

export function TenantMembersPage({ api, roles, users, orgSource, orgPicker, can = {}, active = true, now = defaultNow }: TenantMembersPageProps) {
  const ctx = useGov<TenantContextDto>("gov:tenant", (signal) => api.tenant({ signal }), active);
  const res = useGov<TenantMemberDto[]>("gov:members", (signal) => api.members.list({ signal }), active);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [adding, setAdding] = useState(false);
  const [expiring, setExpiring] = useState<TenantMemberDto | null>(null);
  const [toggling, setToggling] = useState<TenantMemberDto | null>(null);
  const [removing, setRemoving] = useState<TenantMemberDto | null>(null);
  const [notice, setNotice] = useNotice();
  const manage = !!can.manage;
  const roleLabel = optionLabeler(roles);
  // invitedBy is a user id: show the name from the host's users, else from the member list, else the id.
  const personLabel = optionLabeler((res.data ?? []).map((m) => ({ id: m.userId, label: m.name })), users);
  const at = now();
  const refresh = () => {
    void res.refresh();
    void ctx.refresh();
  };
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (res.data ?? []).filter((m) => (status === "all" || m.status === status) && words.every((w) => `${m.name} ${m.userId} ${m.roles.map(roleLabel).join(" ")}`.toLowerCase().includes(w)));
  const filtered = words.length > 0 || status !== "all";
  const memberQuota = ctx.data?.quotas.find((q) => q.key === "members" || q.key === "users");
  const alerts = ctx.data ? quotaAlerts(ctx.data.quotas) : null;

  return (
    <>
      <PageHeader
        title="租户成员"
        description="谁能进入这个租户。停用后对方立即不能操作这个租户的数据；移出会同时去掉他在本租户的角色。"
        actions={manage && <Button onClick={() => setAdding(true)}><Plus />添加成员</Button>}
      />
      <PageBody>
        {!manage && <ReadOnlyNote permission="租户成员 · 加人 / 停用 / 移出" />}
        <Panel title="当前租户">
          <StaleAlert res={ctx} />
          <GovLoad res={ctx} label="租户信息">
            {(c) => (
              <div className="aui-gov-tenant">
                {c.tenant.status === "suspended" && <InlineAlert tone="error" title="租户已停用">{c.tenant.statusReason || "请联系平台管理员"}</InlineAlert>}
                {alerts && alerts.items.length > 0 && (
                  <InlineAlert tone={alerts.worst === "over" ? "error" : "warning"} title={alerts.worst === "over" ? "有配额已用满" : "有配额快用完了"}>
                    {alerts.items.map((q) => `${q.label}：${q.text}`).join("；")}
                  </InlineAlert>
                )}
                <DescriptionList
                  columns={3}
                  items={[
                    { label: "租户", value: c.tenant.name, hint: c.tenant.id },
                    { label: "套餐", value: c.package.name, hint: c.package.description || undefined },
                    { label: "状态", value: <StatusBadge tone={c.tenant.status === "active" ? "success" : "danger"}>{TENANT_STATUS_LABEL[c.tenant.status]}</StatusBadge> },
                  ]}
                />
                <TenantQuotas quotas={c.quotas} />
              </div>
            )}
          </GovLoad>
        </Panel>
        <ResourcePanel
          title="成员"
          count={res.data && !filtered ? res.data.length : undefined}
          actions={<Button variant="outline" disabled={res.loading} onClick={refresh}>刷新</Button>}
          filters={
            <QueryBar value={search} onChange={setSearch} onSearch={() => undefined} onReset={() => { setSearch(""); setStatus("all"); }} placeholder="搜索姓名、编号、角色">
              <SegmentedControl className="aui-gov-seg" label="状态" size="sm" value={status} onValueChange={setStatus} options={[{ value: "all", label: "全部" }, { value: "active", label: "正常" }, { value: "suspended", label: "已停用" }]} />
            </QueryBar>
          }
          feedback={feedbackOf(notice, staleAlert(res))}
        >
          <GovLoad res={res} label="成员">
            {() => (
              <DataTable rowHeight="medium"
                caption="租户成员"
                rows={rows}
                rowKey={(m) => m.userId}
                pagination={{ mode: "all" }}
                emptyKind={filtered ? "no-results" : "empty"}
                emptyLabel={filtered ? "没有符合筛选的成员" : "还没有成员"}
                emptyAction={filtered ? <Button variant="outline" onClick={() => { setSearch(""); setStatus("all"); }}>清空筛选</Button> : manage ? <Button onClick={() => setAdding(true)}>添加成员</Button> : undefined}
                columns={[
                  { key: "name", title: "成员", minWidth: 140, maxWidth: 220, render: (m) => <CellText primary={m.name} secondary={m.userId} /> },
                  { key: "roles", title: "本租户角色", minWidth: 160, maxWidth: 260, render: (m) => (m.roles.length ? <CellTags label="角色" items={m.roles.map((r) => ({ label: roleLabel(r), key: r }))} /> : <span className="aui-note">没有角色</span>) },
                  { key: "status", title: "状态", width: 90, render: (m) => <StatusBadge tone={m.status === "active" ? "success" : "neutral"}>{MEMBER_STATUS_LABEL[m.status]}</StatusBadge> },
                  { key: "expires", title: "成员期限", width: 110, render: (m) => <ExpiryBadge expiresAt={m.expiresAt} now={at} /> },
                  { key: "joined", title: "加入时间", width: 150, render: (m) => <CellText primary={<CellDate value={m.joinedAt} />} secondary={m.invitedBy ? `邀请人 ${personLabel(m.invitedBy)}` : undefined} /> },
                  {
                    key: "ops",
                    title: "操作",
                    kind: "actions",
                    render: (m) =>
                      manage ? (
                        <RowActionBar
                          label={`${m.name}的更多操作`}
                          actions={[
                            m.status === "active"
                              ? { key: "suspend", label: "停用", icon: <CirclePause />, onSelect: () => setToggling(m) }
                              : { key: "resume", label: "恢复", icon: <CirclePlay />, onSelect: () => setToggling(m) },
                            { key: "expiry", label: "改成员期限", icon: <CalendarClock />, onSelect: () => setExpiring(m) },
                            { key: "remove", label: "移出租户", icon: <UserMinus />, destructive: true, onSelect: () => setRemoving(m) },
                          ]}
                        />
                      ) : null,
                  },
                ]}
              />
            )}
          </GovLoad>
        </ResourcePanel>
      </PageBody>
      {adding && (
        <AddMember
          org={orgSource ? { source: orgSource, options: orgPicker, members: (res.data ?? []).map((m) => m.userId) } : undefined}
          roles={roles}
          users={(users ?? []).filter((u) => !res.data?.some((m) => m.userId === u.id))}
          quotaFull={!!memberQuota && memberQuota.limit !== null && memberQuota.used !== null && memberQuota.used >= memberQuota.limit}
          now={now}
          onClose={() => setAdding(false)}
          onAdd={async (input) => {
            try {
              const m = await api.members.add(input);
              setNotice(`已添加 ${m.name}`);
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
            refresh();
          }}
        />
      )}
      {expiring && (
        <ExpiryDialog
          member={expiring}
          now={now}
          onClose={() => setExpiring(null)}
          onSave={async (expiresAt) => {
            try {
              await api.members.update(expiring.userId, { expiresAt });
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
            setNotice(`已修改 ${expiring.name} 的成员期限`);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.status === "active" ? "停用成员" : "恢复成员"}
        destructive={toggling?.status === "active"}
        confirmLabel={toggling?.status === "active" ? "停用" : "恢复"}
        impact={toggling ? (toggling.status === "active" ? `停用 ${toggling.name} 后，他立即不能操作这个租户的数据；角色保留，恢复后照旧。` : `恢复 ${toggling.name}，他重新可以按原来的角色使用这个租户。`) : undefined}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return;
          const next = toggling.status === "active" ? "suspended" : "active";
          try {
            await api.members.update(toggling.userId, { status: next });
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`${next === "suspended" ? "已停用" : "已恢复"} ${toggling.name}`);
          refresh();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title="移出租户"
        destructive
        confirmLabel="移出"
        impact={removing ? `把 ${removing.name} 移出这个租户，同时去掉他在本租户的 ${removing.roles.length} 个角色。要回来需要重新添加。` : undefined}
        reason={{ label: "移出原因", required: true, placeholder: "写进审计，例如：离职 / 转岗" }}
        onClose={() => setRemoving(null)}
        onConfirm={async (reason) => {
          if (!removing) return;
          try {
            await api.members.remove(removing.userId, reason);
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`已把 ${removing.name} 移出租户`);
          refresh();
        }}
      />
    </>
  );
}

// The organisation box loads with the add dialog (its own chunk + CSS), not with the members list.
const orgField = lazyPart(() => import("../../org-picker/org-picker-field.tsx").then((m) => m.OrgPickerField));
const OrgPickerField = orgField.Part as (props: OrgPickerFieldProps) => ReactNode;

type MemberOrg = { source: OrgDataSource; options?: MemberOrgPickerOptions; members: readonly string[] };

/** 「成员」 in the add dialog with a directory: one person from the organisation; members already in are greyed. */
function MemberOrgPick({ id, org, value, onChange }: { id: string; org: MemberOrg; value: PickedSubject | null; onChange: (next: PickedSubject | null) => void }) {
  const existing = Object.fromEntries(org.members.map((userId) => [`person:${userId}`, "已是成员"]));
  return (
    <Suspense fallback={<Input id={id} disabled placeholder="正在加载组织架构…" />}>
      <OrgPickerField
        {...org.options}
        id={id}
        source={org.source}
        mode="single"
        selectable={["person"]}
        commit="instant"
        existing={existing}
        value={value ? [value] : []}
        placeholder={org.options?.placeholder ?? "搜索姓名，或从组织架构里选"}
        dialogTitle={org.options?.dialogTitle ?? "选择要添加的成员"}
        onChange={(next) => onChange(next.at(-1) ?? null)}
      />
    </Suspense>
  );
}

function AddMember({ org, roles, users, quotaFull, now, onClose, onAdd }: { org?: MemberOrg; roles?: readonly GovOption[]; users: readonly GovOption[]; quotaFull: boolean; now: () => Date; onClose: () => void; onAdd: (input: { userId: string; roleIds: string[]; expiresAt: string | null }) => Promise<void> }) {
  const id = useId();
  const [picked, setPicked] = useState<PickedSubject | null>(null);
  const [typedId, setUserId] = useState("");
  const userId = org ? (picked?.id ?? "") : typedId;
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [expires, setExpires] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <FormDialog
      open
      title="添加成员"
      description="添加后对方可以进入这个租户；能做什么由下面勾的角色决定。"
      dirty={!!(userId || roleIds.length || expires)}
      submitLabel="添加"
      onClose={onClose}
      onSubmit={async () => {
        const e: Record<string, string> = {};
        if (!userId.trim()) e.userId = "请选择要添加的人";
        let expiresAt: string | null = null;
        try {
          expiresAt = localInputToIso(expires);
          if (expiresAt && Date.parse(expiresAt) <= now().getTime()) e.expiresAt = "期限要晚于现在";
        } catch {
          e.expiresAt = "期限格式不对";
        }
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onAdd({ userId: userId.trim(), roleIds, expiresAt });
      }}
    >
      {quotaFull && <InlineAlert tone="warning" title="成员数已达套餐上限">继续添加会被服务端拒绝；请先移出不用的成员或升级套餐。</InlineAlert>}
      <FormField label="成员" htmlFor={`${id}-user`} required error={errors.userId}>
        {org ? <MemberOrgPick id={`${id}-user`} org={org} value={picked} onChange={setPicked} /> : users.length ? <Choice label="成员" placeholder="选择要添加的人" value={userId} onChange={setUserId} options={toChoice(users)} /> : <Input id={`${id}-user`} value={userId} placeholder="用户编号" onChange={(e) => setUserId(e.target.value)} />}
      </FormField>
      {roles && roles.length > 0 && (
        <FormField label="本租户角色" htmlFor={`${id}-roles`} hint="可以以后在「角色」里再改">
          <ChipGroup label="本租户角色" value={roleIds} onValueChange={setRoleIds} options={roles.map((r) => ({ value: r.id, label: r.label }))} />
        </FormField>
      )}
      <div className="aui-gov-stack">
        <FormField label="成员期限" htmlFor={`${id}-exp`} error={errors.expiresAt} hint="留空 = 长期（外包、临时顾问建议设期限）">
          <DateTimePicker id={`${id}-exp`} clearable value={expires} onChange={setExpires} />
        </FormField>
        <QuickDatePresets days={[7, 30, 90]} permanent="长期" onPick={setExpires} now={now} />
      </div>
    </FormDialog>
  );
}

function ExpiryDialog({ member, now, onClose, onSave }: { member: TenantMemberDto; now: () => Date; onClose: () => void; onSave: (expiresAt: string | null) => Promise<void> }) {
  const id = useId();
  const initial = isoToLocalInput(member.expiresAt);
  const [value, setValue] = useState(initial);
  return (
    <FormDialog
      open
      title={`${member.name} 的成员期限`}
      description="到期后自动停止访问这个租户。"
      dirty={value !== initial}
      onClose={onClose}
      onSubmit={async () => {
        let iso: string | null;
        try {
          iso = localInputToIso(value);
        } catch {
          throw new Error("期限格式不对");
        }
        if (iso && Date.parse(iso) <= now().getTime()) throw new Error("期限要晚于现在");
        await onSave(iso);
      }}
    >
      <div className="aui-gov-stack">
        <FormField label="成员期限" htmlFor={`${id}-exp`} hint="留空 = 长期">
          <DateTimePicker id={`${id}-exp`} clearable value={value} onChange={setValue} />
        </FormField>
        <QuickDatePresets days={[7, 30, 90]} permanent="长期" onPick={setValue} now={now} />
      </div>
    </FormDialog>
  );
}
