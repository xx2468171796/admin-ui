"use client";
/**
 * AccessConsole section「人员授权」: find a person (search + department), then 组织（部门 / 主部门 /
 * 岗位）, 角色（分配 with expiry & reason, 取消, 续期）, 个人加减（allow / deny, 可授出, expiry）and
 * 有效权限（EffectiveAccessTable with sources, jump to 权限解释）. Anti-escalation and SoD are enforced by
 * the server; its 403 / 409 messages show in place.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { CalendarClock, Eye, Pencil, Plus, Trash2, UserMinus } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge, Tabs } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../forms.tsx";
import { DescriptionList, InlineAlert, Panel, StatePanel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { CellText } from "../cells.tsx";
import { RowActionBar } from "../row-actions.tsx";
import { HelpTip } from "../help-tip.tsx";
import { DisabledReason } from "../advanced.tsx";
import { useAdminResource } from "../workflow-hooks.ts";
import { CheckableTree } from "./checkable-tree.tsx";
import { OrgTreePicker } from "./org-picker.tsx";
import { EffectiveAccessTable } from "./effective-access.tsx";
import { ExpiryBadge } from "./record-team.tsx";
import type { AssignmentDto, DirectoryUser, OverrideDto } from "./console-contracts.ts";
import { assignButton, assignmentActions, codeOptions, editsSelf, futureIso, listFailure } from "./console-core.ts";
import { assignKey, describeAssignScope } from "./matrix-core.ts";
import { AssignRoleDialog, ErrorAlert, ExpiryField, LockedNote, ReadOnlyNote, ReasonField, StatusLine, inDialog, useAction, useConsole, useConsoleResource, revealDetail } from "./console-shared.tsx";
import { isoToLocalInput } from "./review-core.ts";
import { OverrideTargetFields } from "./override-target.tsx";
import { EMPTY_TARGET_DRAFT, draftToTarget, sameTargetDraft, scopedCodeOptions, targetKinds, targetLabel, targetToDraft, type OverrideTargetDraft } from "./override-core.ts";
import { AccessProfileHeader } from "./access-profile.tsx";
import { accessProfileStats } from "./profile-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

type Tab = "org" | "roles" | "overrides" | "effective";
const LIMIT = 200;

function OrgTab({ user, onChanged }: { user: DirectoryUser; onChanged: () => void }) {
  const c = useConsole();
  const ids = useId();
  // 不能改自己的部门 / 岗位 / 业务线（服务端防自己给自己提权），超管除外
  const manage = c.rights.org.manage && !c.readOnly && !editsSelf(c.snapshot, user.id);
  const [rev, setRev] = useState(0);
  const org = useConsoleResource(`org:${user.id}:${rev}`, (signal) => c.api.getUserOrg(user.id, signal), c.rights.org.view);
  const [depts, setDepts] = useState<{ ids: string[]; primary: string } | null>(null);
  const [posts, setPosts] = useState<string[] | null>(null);
  const [dimEdit, setDimEdit] = useState<{ dim: string; ids: string[]; primary: string } | null>(null);
  const canDims = manage && !!c.api.setUserDims;
  if (!c.rights.org.view) return <StatePanel kind="forbidden" message="你没有查看组织信息的权限" />;
  if (org.error && !org.data) {
    const f = listFailure(org.failure);
    return <StatePanel kind={f.forbidden ? "forbidden" : "error"} message={f.message} {...(f.retry ? { onRetry: org.refresh } : {})} />;
  }
  if (!org.data) return <StatePanel kind="loading" />;
  const o = org.data;
  const primary = o.depts.find((d) => d.primary)?.deptId;
  return (
    <>
      <DescriptionList
        items={[
          { label: "主部门", value: primary ? c.deptIdx.path(primary) : "未设置" },
          { label: "其他部门", value: o.depts.filter((d) => !d.primary).map((d) => c.deptIdx.path(d.deptId)).join("；") || "无" },
          { label: "岗位", value: o.postIds.map((p) => c.posts.find((x) => x.id === p)?.name ?? p).join("、") || "无" },
          { label: "用户组", value: o.groupIds.map((g) => c.groups.find((x) => x.id === g)?.name ?? g).join("、") || "无" },
          { label: "负责的部门", value: o.leads.map((d) => c.deptIdx.path(d)).join("；") || "无", full: true },
          // 维度（quanxian 2.2）：他在哪些业务线 / 区域里，主的标出来
          ...c.dims.map((d) => {
            const mine = (o.dims ?? []).filter((x) => x.dim === d.id);
            return { label: d.label, value: mine.length ? mine.map((x) => `${c.dimNames.value?.(d.id, x.value) ?? x.value}${x.primary && mine.length > 1 ? "（主）" : ""}`).join("、") : "无", full: true };
          }),
        ]}
      />
      {manage && (
        <div className="aui-access-bar">
          {/* 只在某些业务线管人（quanxian 2.2）：部门 / 岗位对全公司生效，不给改，只能调业务线 */}
          {!c.rights.orgWithin && <Button size="sm" variant="outline" onClick={() => setDepts({ ids: o.depts.map((d) => d.deptId), primary: primary ?? "" })}>调整部门</Button>}
          {!c.rights.orgWithin && <Button size="sm" variant="outline" onClick={() => setPosts([...o.postIds])}>调整岗位</Button>}
          {canDims &&
            c.dims.map((d) => {
              const mine = (o.dims ?? []).filter((x) => x.dim === d.id);
              return (
                <Button key={d.id} size="sm" variant="outline" onClick={() => setDimEdit({ dim: d.id, ids: mine.map((x) => x.value), primary: mine.find((x) => x.primary)?.value ?? "" })}>
                  调整{d.label}
                </Button>
              );
            })}
        </div>
      )}
      <FormDialog
        open={dimEdit !== null}
        title={`调整「${user.name}」的${dimEdit ? (c.dimNames.dim?.(dimEdit.dim) ?? dimEdit.dim) : ""}`}
        description="可以在多个里面，主的只用来显示；加进去 = 他「只在那里」的分配开始生效，按授出检查。不能改自己的。"
        dirty={!!dimEdit && JSON.stringify([...dimEdit.ids].sort()) !== JSON.stringify((o.dims ?? []).filter((x) => x.dim === dimEdit.dim).map((x) => x.value).sort())}
        onClose={() => setDimEdit(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!dimEdit) return;
            const main = dimEdit.ids.includes(dimEdit.primary) ? dimEdit.primary : (dimEdit.ids[0] ?? "");
            await c.api.setUserDims!(user.id, dimEdit.dim, dimEdit.ids.map((value) => ({ value, primary: value === main })));
            setDimEdit(null);
            setRev((r) => r + 1);
            onChanged();
          })
        }
      >
        {dimEdit && (
          <>
            <CheckableTree
              label={c.dimNames.dim?.(dimEdit.dim) ?? dimEdit.dim}
              nodes={(c.dims.find((d) => d.id === dimEdit.dim)?.values ?? []).map((v) => ({ id: v.id, label: v.name, hint: v.status === "disabled" ? "已停用" : undefined, disabled: v.status === "disabled" && !dimEdit.ids.includes(v.id) }))}
              value={dimEdit.ids}
              linked={false}
              onValueChange={(v) => setDimEdit((d) => d && { ...d, ids: v, primary: v.includes(d.primary) ? d.primary : (v[0] ?? "") })}
              maxHeight={280}
            />
            {dimEdit.ids.length > 1 && (
              <FormField label={`主${c.dimNames.dim?.(dimEdit.dim) ?? dimEdit.dim}`} htmlFor={`${ids}-dimp`}>
                <Choice id={`${ids}-dimp`} label="主值" value={dimEdit.primary} options={dimEdit.ids.map((v) => ({ value: v, label: c.dimNames.value?.(dimEdit.dim, v) ?? v }))} onChange={(p) => setDimEdit((d) => d && { ...d, primary: p })} />
              </FormField>
            )}
          </>
        )}
      </FormDialog>
      <FormDialog
        open={depts !== null}
        title={`调整「${user.name}」的部门`}
        description="可以属于多个部门，主部门有且只有一个；不能改自己的部门。"
        dirty={!!depts && (depts.primary !== (primary ?? "") || depts.ids.length !== o.depts.length || depts.ids.some((d) => !o.depts.some((x) => x.deptId === d)))}
        onClose={() => setDepts(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!depts) return;
            if (!depts.ids.length) throw new Error("至少要属于一个部门");
            const main = depts.ids.includes(depts.primary) ? depts.primary : depts.ids[0]!;
            await c.api.setUserDepts(user.id, depts.ids.map((deptId) => ({ deptId, primary: deptId === main })));
            setDepts(null);
            setRev((r) => r + 1);
            onChanged();
          })
        }
      >
        {depts && (
          <>
            <FormField label="所属部门" htmlFor={`${ids}-depts`}>
              <OrgTreePicker id={`${ids}-depts`} label="所属部门" multiple nodes={c.orgTree} value={depts.ids} onChange={(v) => setDepts((d) => d && { ids: v, primary: v.includes(d.primary) ? d.primary : (v[0] ?? "") })} />
            </FormField>
            <FormField label="主部门" htmlFor={`${ids}-primary`} hint="数据归属、「本部门」范围按主部门和其他部门的并集算">
              <Choice id={`${ids}-primary`} label="主部门" value={depts.primary} placeholder="先选部门" options={depts.ids.map((d) => ({ value: d, label: c.deptIdx.path(d) }))} onChange={(p) => setDepts((d) => d && { ...d, primary: p })} />
            </FormField>
          </>
        )}
      </FormDialog>
      <FormDialog
        open={posts !== null}
        title={`调整「${user.name}」的岗位`}
        description="岗位带角色：放到岗位上 = 授出岗位上的角色，按授出检查。"
        dirty={!!posts && (posts.length !== o.postIds.length || posts.some((p) => !o.postIds.includes(p)))}
        onClose={() => setPosts(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!posts) return;
            await c.api.setUserPosts(user.id, posts);
            setPosts(null);
            setRev((r) => r + 1);
            onChanged();
          })
        }
      >
        {posts && (c.posts.length ? (
          <CheckableTree label="岗位" nodes={c.posts.map((p) => ({ id: p.id, label: p.name, hint: p.deptId ? c.deptIdx.name(p.deptId) : "全公司", disabled: p.status === "disabled" }))} value={posts} linked={false} onValueChange={(v) => setPosts(v)} maxHeight={320} />
        ) : (
          <p className="aui-note">还没有岗位，先在「岗位」里新建。</p>
        ))}
      </FormDialog>
    </>
  );
}

function RolesTab({ user, onChanged }: { user: DirectoryUser; onChanged: () => void }) {
  const c = useConsole();
  const manage = c.rights.assign && !c.readOnly && !editsSelf(c.snapshot, user.id);
  const [rev, setRev] = useState(0);
  const list = useConsoleResource(`assign:user:${user.id}:${rev}`, (signal) => c.api.listAssignments({ subjectType: "user", subjectId: user.id }, signal));
  // 「只在这个业务线上」只给他在的值（quanxian 2.2；看不了组织的不筛，服务端照样拦）
  // 他所在的业务线（分配范围只给这些，quanxian 2.2）+ 能不能给他分配（canAssign，2.2.1）
  const org = useAdminResource(`assign-org:${user.id}:${rev}`, (signal) => c.api.getUserOrg(user.id, signal), 0, c.rights.org.view && (manage || (c.catalog?.scopedAssignments === true && c.dimensions.length > 0)));
  const button = assignButton(manage, org.data?.canAssign);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AssignmentDto | null>(null);
  const [renewing, setRenewing] = useState<{ a: AssignmentDto; expires: string; reason: string } | null>(null);
  const roleName = (id: string) => c.roles.find((r) => r.id === id)?.name ?? id;
  const where = (a: AssignmentDto) => describeAssignScope(a.scope, { ...c.dimNames, dept: c.deptIdx.name });
  const anyScoped = (list.data ?? []).some((a) => a.scope) || c.catalog?.scopedAssignments === true;
  const changed = () => {
    setRev((r) => r + 1);
    onChanged();
  };
  const failure = list.error && !list.data ? listFailure(list.failure) : null;
  // 403（例如只在 A 线管人，他不在 A 线）：说清楚为什么，不给「重试」和「分配角色」
  if (failure?.forbidden) return <StatePanel kind="forbidden" message={failure.message} />;
  return (
    <>
      <DataTable rowHeight="medium"
        caption={`${user.name}的角色`}
        rows={list.data ?? []}
        rowKey={assignKey}
        loading={list.loading && !list.data}
        error={failure?.message}
        onRetry={list.refresh}
        emptyLabel="没有直接分配的角色（经由岗位 / 部门得到的看「有效权限」）"
        pagination={{ mode: "all" }}
        toolbar={
          button.show && !failure ? (
            button.disabledReason ? (
              <DisabledReason reason={button.disabledReason}>
                <span><Button size="sm" disabled><Plus size={14} aria-hidden="true" />分配角色</Button></span>
              </DisabledReason>
            ) : (
              <Button size="sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" />分配角色</Button>
            )
          ) : undefined
        }
        columns={[
          { key: "role", title: "角色", minWidth: 140, render: (a) => <CellText primary={roleName(a.roleId)} secondary={a.expired ? "已到期，不再生效" : undefined} /> },
          ...(anyScoped ? [{ key: "scope", title: "范围", minWidth: 120, maxWidth: 220, truncate: where, render: where }] : []),
          { key: "exp", title: "到期", width: 120, render: (a) => <ExpiryBadge expiresAt={a.expiresAt} now={c.now} /> },
          { key: "by", title: "授予", minWidth: 150, maxWidth: 280, truncate: (a) => [c.userName(a.grantedBy), a.reason].filter(Boolean).join(" · "), render: (a) => [c.userName(a.grantedBy), a.reason].filter(Boolean).join(" · ") },
          {
            key: "actions",
            title: "操作",
            kind: "actions",
            render: (a) => {
              // 只在某些业务线管人（quanxian 2.2）：范围外的分配灰掉并说明原因（服务端会拒）
              const can = assignmentActions(a, manage, { within: c.rights.assignWithin, subtree: c.deptIdx.subtree, names: { ...c.dimNames, dept: c.deptIdx.name } });
              if (can.lockedReason) return <LockedNote reason={can.lockedReason} />;
              if (!can.unassign && !can.blockedReason) return null;
              // 服务端可能只许其中一样（2.2.1 editable：能取消、不能改期限）：各灰各的
              const off = (ok: boolean) => (ok ? {} : { disabled: true, disabledReason: can.blockedReason ?? "你不能改这条分配" });
              return (
                <RowActionBar
                  label={`${roleName(a.roleId)}的更多操作`}
                  actions={[
                    { key: "renew", label: "改期限", icon: <CalendarClock />, ...off(can.renew), onSelect: () => setRenewing({ a, expires: isoToLocalInput(a.expiresAt), reason: "" }) },
                    { key: "unassign", label: "取消", icon: <UserMinus />, menuOnly: false, ...off(can.unassign), onSelect: () => setRemoving(a) },
                  ]}
                />
              );
            },
          },
        ]}
      />
      <AssignRoleDialog open={adding} onClose={() => setAdding(false)} subject={{ type: "user", id: user.id }} subjectName={user.name} targetDims={org.data?.dims ?? null} exclude={(list.data ?? []).filter((a) => !a.expired && !a.scope).map((a) => a.roleId)} onDone={() => { setAdding(false); changed(); }} />
      <FormDialog
        open={renewing !== null}
        title={`修改「${renewing ? roleName(renewing.a.roleId) : ""}」${renewing?.a.scope ? `（${where(renewing.a)}）` : ""}的期限`}
        description="重新分配一次（同一个角色在同一个范围上只保留一条）；到期后立即失效。"
        dirty={!!renewing && renewing.expires !== isoToLocalInput(renewing.a.expiresAt)}
        onClose={() => setRenewing(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!renewing) return;
            await c.api.assign({ subject: { type: "user", id: user.id }, roleId: renewing.a.roleId, expiresAt: futureIso(renewing.expires, c.now), reason: renewing.reason.trim() || renewing.a.reason, ...(renewing.a.scope ? { scope: renewing.a.scope } : {}) });
            setRenewing(null);
            changed();
          })
        }
      >
        {renewing && (
          <>
            <ExpiryField value={renewing.expires} onChange={(expires) => setRenewing((r) => r && { ...r, expires })} now={c.now} />
            <ReasonField value={renewing.reason} onChange={(reason) => setRenewing((r) => r && { ...r, reason })} />
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={removing !== null}
        title="取消角色"
        destructive
        confirmLabel="取消角色"
        impact={removing ? `${user.name} 将失去角色「${roleName(removing.roleId)}」${removing.scope ? `（${where(removing)}）` : ""}，下一次请求就生效。` : undefined}
        reason={{ label: "原因", required: true }}
        onClose={() => setRemoving(null)}
        onConfirm={(reason) =>
          inDialog(async () => {
            if (!removing) return;
            await c.api.unassign({ subject: { type: "user", id: user.id }, roleId: removing.roleId, reason, ...(removing.scope ? { scope: removing.scope } : {}) });
            changed();
          })
        }
      />
    </>
  );
}

// D15: 「加什么」 = 操作 / 数据范围 / 字段 / 指定记录 (the last three need api.setTargetOverride)
type OverrideForm = { target: OverrideTargetDraft; effect: "allow" | "deny"; grantable: boolean; expires: string; reason: string; existing: OverrideDto | null };

function OverridesTab({ user, onChanged }: { user: DirectoryUser; onChanged: () => void }) {
  const c = useConsole();
  const ids = useId();
  // 个人加减要不带范围的授权（只在某条业务线管人的，服务端一律拒绝），也不能给自己加减
  const self = editsSelf(c.snapshot, user.id);
  const manage = c.rights.overrides && !c.readOnly && !self;
  const [rev, setRev] = useState(0);
  const list = useConsoleResource(`ovr:${user.id}:${rev}`, (signal) => c.api.listOverrides(user.id, signal));
  const [form, setForm] = useState<OverrideForm | null>(null);
  const [removing, setRemoving] = useState<OverrideDto | null>(null);
  const options = useMemo(() => codeOptions(c.catalog), [c.catalog]);
  const label = (code: string) => options.find((o) => o.value === code)?.label ?? code;
  const resources = c.catalog?.resources ?? [];
  const scopedCodes = useMemo(() => scopedCodeOptions(options, c.catalog?.actions ?? []), [options, c.catalog]);
  const kinds = targetKinds({ targeted: !!c.api.setTargetOverride, scoped: scopedCodes.length > 0, fields: resources.some((r) => r.fields?.length), records: !!c.api.findRecords });
  const findRecords = c.api.findRecords;
  const rowLabel = (o: OverrideDto) => (o.target ? targetLabel(o.target, resources, label) : label(o.code));
  const changed = () => {
    setRev((r) => r + 1);
    onChanged();
  };
  const failure = list.error && !list.data ? listFailure(list.failure) : null;
  if (failure?.forbidden) return <StatePanel kind="forbidden" message={failure.message} />;
  return (
    <>
      {c.rights.assign && !c.rights.overrides && !c.readOnly && !self && <ReadOnlyNote show>个人加减要不限范围的授权；你只在{c.dims.length === 1 ? `部分${c.dims[0]!.label}` : "部分范围"}管人，这里只能查看。</ReadOnlyNote>}
      <DataTable rowHeight="medium"
        caption={`${user.name}的个人加减`}
        rows={list.data ?? []}
        rowKey={(o) => o.code}
        loading={list.loading && !list.data}
        error={failure?.message}
        onRetry={list.refresh}
        emptyLabel="没有个人加减"
        pagination={{ mode: "all" }}
        toolbar={
          manage && !failure ? (
            <div className="aui-access-bar">
              <Button size="sm" onClick={() => setForm({ target: EMPTY_TARGET_DRAFT, effect: "allow", grantable: false, expires: "", reason: "", existing: null })}><Plus size={14} aria-hidden="true" />添加</Button>
              <HelpTip label="个人加减说明">「减」优先于任何角色；「加」可以带「可授出」（他能再授给别人）。都可以设到期。</HelpTip>
            </div>
          ) : undefined
        }
        columns={[
          { key: "code", title: "权限", minWidth: 180, render: (o) => <CellText primary={rowLabel(o)} secondary={o.effect === "deny" ? "「减」优先于任何角色" : o.grantable ? "他还能再授给别人" : undefined} /> },
          { key: "effect", title: "加 / 减", width: 100, render: (o) => (o.effect === "allow" ? <StatusBadge tone="success">{o.grantable ? "加（可授出）" : "加"}</StatusBadge> : <StatusBadge tone="danger">减</StatusBadge>) },
          { key: "exp", title: "到期", width: 120, render: (o) => <ExpiryBadge expiresAt={o.expiresAt} now={c.now} /> },
          { key: "why", title: "原因", minWidth: 120, maxWidth: 240, truncate: (o) => o.reason || "—", render: (o) => o.reason || "—" },
          {
            key: "actions",
            title: "操作",
            kind: "actions",
            render: (o) =>
              manage ? (
                <RowActionBar
                  label={`${rowLabel(o)}的更多操作`}
                  actions={[
                    { key: "edit", label: "修改", icon: <Pencil />, onSelect: () => setForm({ target: targetToDraft(o.target, o.code), effect: o.effect, grantable: o.grantable, expires: isoToLocalInput(o.expiresAt), reason: o.reason, existing: o }) },
                    { key: "remove", label: "去掉", icon: <Trash2 />, menuOnly: false, onSelect: () => setRemoving(o) },
                  ]}
                />
              ) : null,
          },
        ]}
      />
      <FormDialog
        open={form !== null}
        title={form?.existing ? "修改个人加减" : `给「${user.name}」添加个人加减`}
        description="加 = 授出（只能授出你自己能授出的）；减 = 收回，立即生效。"
        dirty={!!form && (form.existing ? !sameTargetDraft(form.target, targetToDraft(form.existing.target, form.existing.code)) || form.effect !== form.existing.effect || form.grantable !== form.existing.grantable || form.expires !== isoToLocalInput(form.existing.expiresAt) || form.reason !== form.existing.reason : !!(form.target.code || form.target.field || form.target.recordId))}
        onClose={() => setForm(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!form) return;
            const picked = draftToTarget(form.target);
            if ("error" in picked) throw new Error(picked.error);
            const input = { effect: form.effect, grantable: form.effect === "allow" && form.target.kind === "action" && form.grantable, expiresAt: futureIso(form.expires, c.now), ...(form.reason.trim() ? { reason: form.reason.trim() } : {}) };
            if (picked.target.kind === "action" && !form.existing?.target) await c.api.setOverride(user.id, picked.target.code, input);
            else if (c.api.setTargetOverride) await c.api.setTargetOverride(user.id, { ...input, target: picked.target });
            else throw new Error("这个后端只支持按权限码加减");
            setForm(null);
            changed();
          })
        }
      >
        {form && (
          <>
            <OverrideTargetFields
              draft={form.target}
              locked={!!form.existing}
              kinds={kinds}
              codes={options.map((o) => ({ value: o.value, label: o.risk === "high" ? `${o.label}（高危）` : o.label }))}
              scopedCodes={scopedCodes}
              resources={resources}
              findRecords={findRecords ? (res, q, signal) => findRecords.call(c.api, res, q, signal) : undefined}
              onChange={(target) => setForm((f) => f && { ...f, target })}
            />
            <FormField label="加 / 减" htmlFor={`${ids}-effect`}>
              <SegmentedControl label="加 / 减" value={form.effect} options={[{ value: "allow", label: "加授" }, { value: "deny", label: "禁用（减）" }]} onValueChange={(effect) => setForm((f) => f && { ...f, effect, grantable: effect === "allow" && f.grantable })} />
            </FormField>
            {form.effect === "allow" && form.target.kind === "action" && (
              <label className="aui-access-toggle">
                <Checkbox checked={form.grantable} aria-label="可授出" onCheckedChange={(v) => setForm((f) => f && { ...f, grantable: v === true })} />
                <span>可授出<span className="aui-note">（他能把这个权限再授给自己部门的人）</span></span>
              </label>
            )}
            <ExpiryField value={form.expires} onChange={(expires) => setForm((f) => f && { ...f, expires })} now={c.now} />
            <ReasonField value={form.reason} onChange={(reason) => setForm((f) => f && { ...f, reason })} />
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={removing !== null}
        title="去掉个人加减"
        destructive
        confirmLabel="去掉"
        impact={removing ? (removing.effect === "deny" ? `去掉「减 ${rowLabel(removing)}」= 把被压住的权限放回来（按授出检查）。` : `${user.name} 将不再有个人加授的「${rowLabel(removing)}」。`) : undefined}
        reason={{ label: "原因", required: true }}
        onClose={() => setRemoving(null)}
        onConfirm={(reason) =>
          inDialog(async () => {
            if (!removing) return;
            await c.api.removeOverride(user.id, removing.code, reason);
            changed();
          })
        }
      />
    </>
  );
}

function EffectiveTab({ user, rev }: { user: DirectoryUser; rev: number }) {
  const c = useConsole();
  const [personal, setPersonal] = useState(false);
  const list = useConsoleResource(`eff:${user.id}:${rev}`, (signal) => c.api.effective(user.id, signal), c.rights.explain || user.id === c.snapshot.userId);
  const failure = list.error && !list.data ? listFailure(list.failure) : null;
  if (!c.rights.explain && user.id !== c.snapshot.userId) return <StatePanel kind="forbidden" message="看别人的有效权限需要「权限解释」权限" />;
  if (failure?.forbidden) return <StatePanel kind="forbidden" message={failure.message} />;
  const rows = list.data ?? [];
  return (
    <>
      {/* D15: 这个人的权限构成（角色 / 单独加 / 单独减 / 共享记录）；点单独加减只看那几行 */}
      {rows.length > 0 && (
        <AccessProfileHeader
          name={user.name}
          tags={user.hint ? [user.hint] : []}
          meta={user.deptIds.map(c.deptIdx.path).join("；") || undefined}
          stats={accessProfileStats(rows)}
          activeStat={personal ? ["personalAdd", "personalDeny"] : null}
          onStatSelect={(stat) => setPersonal(stat.key === "personalAdd" || stat.key === "personalDeny" ? !personal : false)}
        />
      )}
      <EffectiveAccessTable rows={rows} subject={user.name} loading={list.loading && !list.data} error={failure?.message} onRetry={list.refresh} deptName={c.deptIdx.name} now={c.now} dimNames={c.dimNames} personalOnly={personal} onPersonalOnlyChange={setPersonal} />
      {c.rights.explain && (
        <div className="aui-access-bar">
          <Button size="sm" variant="outline" onClick={() => c.go("explain", { userId: user.id })}>为什么能 / 不能？去「权限解释」</Button>
        </div>
      )}
    </>
  );
}

export function PeopleSection() {
  const c = useConsole();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string[]>([]);
  const [picked, setPicked] = useState<string>(c.preset.userId ?? "");
  const [tab, setTab] = useState<Tab>("roles");
  const [rev, setRev] = useState(0);
  const act = useAction();
  useEffect(() => {
    if (c.preset.userId) setPicked(c.preset.userId);
  }, [c.preset.userId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const within = dept[0] ? new Set(c.deptIdx.subtree(dept[0])) : null;
    return c.users.filter((u) => (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || (u.hint ?? "").toLowerCase().includes(q)) && (!within || u.deptIds.some((d) => within.has(d))));
  }, [c.users, query, dept, c.deptIdx]);
  const user = c.users.find((u) => u.id === picked) ?? null;
  const tabs: { value: Tab; label: string }[] = [
    ...(c.rights.org.view ? [{ value: "org" as const, label: "组织" }] : []),
    ...(c.rights.roles.view ? [{ value: "roles" as const, label: "角色" }, { value: "overrides" as const, label: "个人加减" }] : []),
    ...(c.rights.explain ? [{ value: "effective" as const, label: "有效权限" }] : []),
  ];
  const current = tabs.some((t) => t.value === tab) ? tab : (tabs[0]?.value ?? "roles");
  // The list sits in a narrow column: show up to LIMIT people and ask to search / pick a department beyond that.
  const pageRows = filtered.slice(0, LIMIT);
  return (
    <div className="aui-access-stack">
      <ReadOnlyNote show={c.readOnly || (!c.rights.assign && !c.rights.org.manage)} />
      <ErrorAlert error={act.error} onDismiss={act.clear} />
      <div className="aui-access-split">
        <Panel title="人员">
          <div className="aui-access-filters">
            <FormField label="搜索" htmlFor="aui-access-people-q">
              <Input id="aui-access-people-q" type="search" clearable placeholder="姓名 / 账号" value={query} onChange={(e) => { setQuery(e.target.value); }} />
            </FormField>
            <FormField label="部门（含下级）" htmlFor="aui-access-people-dept">
              <OrgTreePicker id="aui-access-people-dept" label="部门（含下级）" nodes={c.orgTree} value={dept} onChange={(v) => { setDept(v); }} placeholder="全部部门" />
            </FormField>
          </div>
          {filtered.length > LIMIT && <p className="aui-note" role="status">共 {filtered.length} 人，只列出前 {LIMIT} 个；请搜索或选部门缩小范围。</p>}
          <DataTable rowHeight="medium"
            caption="人员列表"
            rows={pageRows}
            rowKey={(u) => u.id}
            emptyKind={query || dept.length ? "no-results" : "empty"}
            emptyLabel={query || dept.length ? "没有符合条件的人" : "宿主没有提供人员名单"}
            emptyAction={query || dept.length ? <Button size="sm" variant="outline" onClick={() => { setQuery(""); setDept([]); }}>清空筛选</Button> : undefined}
            pagination={{ mode: "all" }}
            columns={[
              { key: "name", title: "姓名", minWidth: 140, render: (u) => <CellText primary={u.id === picked ? `${u.name}（当前）` : u.name} secondary={u.deptIds.map(c.deptIdx.name).join("、") || u.hint} /> },
              { key: "open", title: "操作", kind: "actions", render: (u) => <RowActionBar label={`${u.name}的更多操作`} actions={[{ key: "open", label: "查看", icon: <Eye />, ariaLabel: `查看 ${u.name} 的授权`, onSelect: () => { setPicked(u.id); revealDetail(); } }]} /> },
            ]}
          />
        </Panel>
        {user ? (
          <Panel title={user.name} description={[user.deptIds.map(c.deptIdx.path).join("；"), user.hint].filter(Boolean).join(" · ")}>
            {editsSelf(c.snapshot, user.id) && <InlineAlert tone="info" title="这是你自己">不能改自己的角色、部门和岗位（防止自己给自己提权），请找其他管理员。</InlineAlert>}
            <Tabs label={`${user.name}的授权`} value={current} onValueChange={(v) => setTab(v as Tab)} items={tabs}>
              <div className="aui-access-stack">
                {current === "org" && <OrgTab key={`${user.id}-org`} user={user} onChanged={() => { setRev((r) => r + 1); c.reload("depts"); }} />}
                {current === "roles" && <RolesTab key={`${user.id}-roles`} user={user} onChanged={() => setRev((r) => r + 1)} />}
                {current === "overrides" && <OverridesTab key={`${user.id}-ovr`} user={user} onChanged={() => setRev((r) => r + 1)} />}
                {current === "effective" && <EffectiveTab key={`${user.id}-eff`} user={user} rev={rev} />}
              </div>
            </Tabs>
            <StatusLine text={act.done} />
          </Panel>
        ) : (
          <StatePanel kind="empty" message="在左边选一个人" />
        )}
      </div>
    </div>
  );
}
