"use client";
/**
 * AccessConsole sections「部门」,「岗位」and the dimension values (quanxian 2.2「业务线」…): department
 * tree (create / rename / move / enable / delete), leaders, members (with their primary department),
 * department roles; posts with their roles; values of each registered dimension. Every change goes to
 * the server (version-checked); failures stay in place.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { Building2, CirclePause, CirclePlay, Eye, Pencil, Plus, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { Button, Input, StatusBadge, Switch } from "../primitives.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../forms.tsx";
import { DescriptionList, Panel, StatePanel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { CellText } from "../cells.tsx";
import { RowActionBar } from "../row-actions.tsx";
import { DisabledReason } from "../advanced.tsx";
import { useAdminResource } from "../workflow-hooks.ts";
import { CheckableTree } from "./checkable-tree.tsx";
import { OrgTreePicker, UserTransfer } from "./org-picker.tsx";
import { ExpiryBadge } from "./record-team.tsx";
import type { AssignmentDto, AssignSubjectType, DeptDto, DimensionDto, DimValueDto, PostDto } from "./console-contracts.ts";
import { assignButton, assignmentActions, deptMembers, dimValueDisableImpact, moveTargets } from "./console-core.ts";
import { assignKey, describeAssignScope } from "./matrix-core.ts";
import { AssignRoleDialog, ErrorAlert, LockedNote, ReadOnlyNote, StatusLine, inDialog, useAction, useConsole, revealDetail } from "./console-shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

/** Roles assigned to a department / post, with「分配角色」and「取消分配」. */
export function SubjectRoles({ type, id, name, manage }: { type: AssignSubjectType; id: string; name: string; manage: boolean }) {
  const c = useConsole();
  const [rev, setRev] = useState(0);
  const list = useAdminResource(`assign:${type}:${id}:${rev}`, (signal) => c.api.listAssignments({ subjectType: type, subjectId: id }, signal), 0, c.rights.roles.view);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AssignmentDto | null>(null);
  const roleName = (rid: string) => c.roles.find((r) => r.id === rid)?.name ?? rid;
  const where = (a: AssignmentDto) => describeAssignScope(a.scope, { ...c.dimNames, dept: c.deptIdx.name });
  const anyScoped = (list.data ?? []).some((a) => a.scope);
  // 给部门 / 岗位的分配：只在某些业务线 / 部门管人的（quanxian 2.2），范围和这个部门都要在自己的范围里
  const subjectDept = type === "dept" ? id : type === "post" ? (c.posts.find((p) => p.id === id)?.deptId ?? null) : undefined;
  // quanxian 2.2.1：服务端说了能不能给它分配（自己在里面、不在辖区……）——不能就灰掉并写原因
  const button = assignButton(manage, type === "dept" ? c.deptIdx.byId.get(id)?.canAssign : type === "post" ? c.posts.find((p) => p.id === id)?.canAssign : undefined);
  if (!c.rights.roles.view) return null;
  const assign = <Button size="sm" variant="outline" disabled={!!button.disabledReason} onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" />分配角色</Button>;
  return (
    <Panel
      title="角色"
      description={`${name}里的每个人都会得到这些角色`}
      actions={button.show ? (button.disabledReason ? <DisabledReason reason={button.disabledReason}><span>{assign}</span></DisabledReason> : assign) : undefined}
    >
      <DataTable rowHeight="medium"
        caption={`${name}的角色`}
        rows={list.data ?? []}
        rowKey={assignKey}
        loading={list.loading && !list.data}
        error={list.error}
        onRetry={list.refresh}
        emptyLabel="没有分配角色"
        pagination={{ mode: "all" }}
        columns={[
          { key: "role", title: "角色", minWidth: 140, render: (a) => roleName(a.roleId) },
          ...(anyScoped ? [{ key: "scope", title: "范围", minWidth: 120, maxWidth: 220, truncate: where, render: where }] : []),
          { key: "exp", title: "到期", width: 120, render: (a) => <ExpiryBadge expiresAt={a.expiresAt} now={c.now} /> },
          { key: "by", title: "授予", minWidth: 140, maxWidth: 260, truncate: (a) => [c.userName(a.grantedBy), a.reason].filter(Boolean).join(" · "), render: (a) => [c.userName(a.grantedBy), a.reason].filter(Boolean).join(" · ") },
          {
            key: "actions",
            title: "操作",
            kind: "actions",
            render: (a) => {
              const can = assignmentActions(a, manage, { within: c.rights.assignWithin, subtree: c.deptIdx.subtree, names: { ...c.dimNames, dept: c.deptIdx.name }, ...(subjectDept !== undefined ? { subjectDept } : {}) });
              if (can.lockedReason) return <LockedNote reason={can.lockedReason} />;
              if (!can.unassign && !can.blockedReason) return null;
              return (
                <RowActionBar
                  label={`${roleName(a.roleId)}的更多操作`}
                  actions={[{ key: "unassign", label: "取消分配", icon: <UserMinus />, menuOnly: false, disabled: !can.unassign, ...(can.blockedReason ? { disabledReason: can.blockedReason } : {}), onSelect: () => setRemoving(a) }]}
                />
              );
            },
          },
        ]}
      />
      <AssignRoleDialog open={adding} onClose={() => setAdding(false)} subject={{ type, id }} subjectName={name} exclude={(list.data ?? []).filter((a) => !a.scope).map((a) => a.roleId)} onDone={() => { setAdding(false); setRev((r) => r + 1); }} />
      <ConfirmDialog
        open={removing !== null}
        title="取消分配"
        destructive
        confirmLabel="取消分配"
        impact={removing ? `${name}里的人将不再经由这里得到角色「${roleName(removing.roleId)}」${removing.scope ? `（${where(removing)}）` : ""}，立即生效。` : undefined}
        reason={{ label: "原因", required: true }}
        onClose={() => setRemoving(null)}
        onConfirm={(reason) =>
          inDialog(async () => {
            if (!removing) return;
            await c.api.unassign({ subject: { type, id }, roleId: removing.roleId, reason, ...(removing.scope ? { scope: removing.scope } : {}) });
            setRev((r) => r + 1);
          })
        }
      />
    </Panel>
  );
}

type DeptForm = { mode: "create" | "edit"; dept: DeptDto | null; name: string; parent: string[]; sort: string; enabled: boolean };

export function DeptSection() {
  const c = useConsole();
  // 建 / 改 / 删部门要不带范围的组织管理；挪部门（换上级）和任免负责人只有超管能做（服务端规则）
  const manage = c.rights.orgStructure && !c.readOnly;
  const canMove = manage && c.rights.superuser;
  const ids = useId();
  const [picked, setPicked] = useState<string>("");
  const [form, setForm] = useState<DeptForm | null>(null);
  const [deleting, setDeleting] = useState<DeptDto | null>(null);
  const [leaders, setLeaders] = useState<string[] | null>(null);
  const act = useAction();
  useEffect(() => {
    if (!picked && c.depts.length) setPicked((c.orgTree[0]?.id ?? c.depts[0]?.id) || "");
  }, [picked, c.depts, c.orgTree, c.deptIdx]);
  const dept = picked ? (c.deptIdx.byId.get(picked) ?? null) : null;
  const members = useMemo(() => (dept ? deptMembers(c.users, dept.id) : []), [dept, c.users]);
  const openEdit = (d: DeptDto) => setForm({ mode: "edit", dept: d, name: d.name, parent: d.parentId ? [d.parentId] : [], sort: String(d.sort), enabled: d.status === "enabled" });
  const openCreate = () => setForm({ mode: "create", dept: null, name: "", parent: dept ? [dept.id] : [], sort: "100", enabled: true });
  const parentTree = useMemo(() => {
    if (!form || form.mode === "create" || !form.dept) return c.orgTree;
    const ok = new Set(moveTargets(c.depts, form.dept.id).map((d) => d.id));
    const mark = (nodes: typeof c.orgTree): typeof c.orgTree => nodes.map((n) => ({ ...n, disabled: !ok.has(n.id), ...(n.children ? { children: mark(n.children as typeof c.orgTree) } : {}) }));
    return mark(c.orgTree);
  }, [form, c.orgTree, c.depts]);
  const formDirty = !!form && (form.mode === "create" ? !!form.name : form.name !== form.dept!.name || (form.parent[0] ?? null) !== form.dept!.parentId || form.sort !== String(form.dept!.sort) || form.enabled !== (form.dept!.status === "enabled"));

  if (!c.depts.length && !manage) return <StatePanel kind="empty" message="还没有部门" />;
  return (
    <div className="aui-access-stack" data-aui-flow="stack">
      <ReadOnlyNote show={!manage} />
      <ErrorAlert error={act.error} onReload={() => { act.clear(); c.reload("depts"); }} onDismiss={act.clear} />
      <StatusLine text={act.done} />
      <div className="aui-access-split" data-aui-flow="columns">
        <Panel title="部门" actions={manage ? <Button size="sm" onClick={openCreate}><Plus size={14} aria-hidden="true" />新建部门</Button> : undefined}>
          {c.depts.length ? (
            <CheckableTree label="部门" mode="single" nodes={c.orgTree} value={picked ? [picked] : []} onValueChange={(v) => { if (v[0]) { setPicked(v[0]); revealDetail(); } }} toolbar={false} maxHeight={480} />
          ) : (
            <StatePanel kind="empty" message="还没有部门，先新建一个" />
          )}
        </Panel>
        {dept ? (
          <div className="aui-access-stack" data-aui-flow="stack">
            <Panel
              title={dept.name}
              description={c.deptIdx.path(dept.id)}
              actions={
                manage ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openEdit(dept)}>{canMove ? "编辑 / 移动" : "编辑"}</Button>
                    {canMove && <Button size="sm" variant="outline" onClick={() => setLeaders([...dept.leaderIds])}>设置负责人</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(dept)}>删除</Button>
                  </>
                ) : undefined
              }
            >
              <DescriptionList
                items={[
                  { label: "上级部门", value: dept.parentId ? c.deptIdx.path(dept.parentId) : "（顶级）" },
                  { label: "状态", value: dept.status === "enabled" ? <StatusBadge tone="success">启用</StatusBadge> : <StatusBadge>已停用</StatusBadge> },
                  { label: "负责人", value: dept.leaderIds.length ? dept.leaderIds.map(c.userName).join("、") : "未设置", hint: "「本人及下属」= 负责人所管部门树里的全部成员" },
                  { label: "直属成员", value: `${members.length} 人` },
                ]}
              />
            </Panel>
            <Panel title="成员" description="只列直属成员；调整某人的部门在「人员授权」里做">
              <DataTable rowHeight="medium"
                caption={`${dept.name}的成员`}
                rows={members}
                rowKey={(u) => u.id}
                emptyLabel="这个部门还没有直属成员"
                pagination={{ mode: "all" }}
                columns={[
                  { key: "name", title: "姓名", minWidth: 140, render: (u) => <CellText primary={u.name} secondary={u.hint} /> },
                  { key: "leader", title: "身份", width: 110, render: (u) => (dept.leaderIds.includes(u.id) ? <StatusBadge tone="brand">负责人</StatusBadge> : <span className="aui-note">成员</span>) },
                  { key: "go", title: "操作", kind: "actions", render: (u) => <RowActionBar label={`${u.name}的更多操作`} actions={[{ key: "go", label: "查看授权", icon: <Eye />, ariaLabel: `查看 ${u.name} 的授权`, onSelect: () => c.go("people", { userId: u.id }) }]} /> },
                ]}
              />
            </Panel>
            <SubjectRoles type="dept" id={dept.id} name={dept.name} manage={c.rights.assign && !c.readOnly} />
          </div>
        ) : (
          <StatePanel kind="empty" message="在左边选一个部门" />
        )}
      </div>
      <FormDialog
        open={form !== null}
        title={form?.mode === "create" ? "新建部门" : `编辑部门「${form?.dept?.name ?? ""}」`}
        description={form?.mode === "create" ? "建在选中的部门下面；只能建在自己管的部门树里。" : canMove ? "改上级部门会连带移动它的全部下级。" : "可以改名称、排序和启用；换上级部门只有超级管理员能做。"}
        dirty={formDirty}
        onClose={() => setForm(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!form) return;
            if (!form.name.trim()) throw new Error("请填写部门名称");
            const sort = Number(form.sort);
            if (!Number.isInteger(sort)) throw new Error("排序要填整数");
            const parentId = form.parent[0] ?? null;
            const saved =
              form.mode === "create"
                ? await c.api.createDept({ name: form.name.trim(), parentId, sort, status: form.enabled ? "enabled" : "disabled" })
                : await c.api.updateDept(form.dept!.id, { name: form.name.trim(), ...(parentId !== form.dept!.parentId ? { parentId } : {}), sort, status: form.enabled ? "enabled" : "disabled", version: form.dept!.version });
            setForm(null);
            setPicked(saved.id);
            act.setDone(form.mode === "create" ? `已新建部门「${saved.name}」` : `已保存部门「${saved.name}」`);
            c.reload("depts");
          })
        }
      >
        {form && (
          <>
            <FormField label="名称" htmlFor={`${ids}-name`} required>
              <Input id={`${ids}-name`} value={form.name} maxLength={100} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
            </FormField>
            <FormField label="上级部门" htmlFor={`${ids}-parent`} hint={form.mode === "edit" && !canMove ? "只有超级管理员能换上级部门" : "不选 = 顶级部门"}>
              <OrgTreePicker id={`${ids}-parent`} label="上级部门" nodes={parentTree} value={form.parent} disabled={form.mode === "edit" && !canMove} onChange={(parent) => setForm((f) => f && { ...f, parent })} placeholder="（顶级）" />
            </FormField>
            <div className="aui-access-form-row">
              <FormField label="排序" htmlFor={`${ids}-sort`} hint="小的在前">
                <Input id={`${ids}-sort`} inputMode="numeric" value={form.sort} onChange={(e) => setForm((f) => f && { ...f, sort: e.target.value })} />
              </FormField>
              <FormField label="启用" htmlFor={`${ids}-on`}>
                <Switch id={`${ids}-on`} checked={form.enabled} onCheckedChange={(enabled) => setForm((f) => f && { ...f, enabled })} />
              </FormField>
            </div>
          </>
        )}
      </FormDialog>
      <FormDialog
        open={leaders !== null}
        title={`设置「${dept?.name ?? ""}」的负责人`}
        description="负责人能看到「本人及下属」范围里的记录；不能把自己设成负责人。"
        size="lg"
        dirty={!!dept && !!leaders && (leaders.length !== dept.leaderIds.length || leaders.some((l) => !dept.leaderIds.includes(l)))}
        onClose={() => setLeaders(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!dept || !leaders) return;
            await c.api.setDeptLeaders(dept.id, leaders);
            setLeaders(null);
            act.setDone(`已更新「${dept.name}」的负责人`);
            c.reload("depts");
          })
        }
      >
        {leaders && <UserTransfer label="负责人" orgTree={c.orgTree} users={c.users} value={leaders} onChange={setLeaders} />}
      </FormDialog>
      <ConfirmDialog
        open={deleting !== null}
        title="删除部门"
        destructive
        confirmLabel="删除"
        impact={deleting ? `删除「${c.deptIdx.path(deleting.id)}」。有下级部门、成员或岗位时服务端会拒绝。` : undefined}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!deleting) return;
            await c.api.deleteDept(deleting.id);
            act.setDone(`已删除部门「${deleting.name}」`);
            setPicked("");
            c.reload("depts");
          })
        }
      />
    </div>
  );
}

type PostForm = { post: PostDto | null; code: string; name: string; dept: string[]; sort: string; enabled: boolean };

export function PostSection() {
  const c = useConsole();
  // 岗位对全公司生效：建 / 改 / 删要不带范围的组织管理
  const manage = c.rights.orgStructure && !c.readOnly;
  const ids = useId();
  const [form, setForm] = useState<PostForm | null>(null);
  const [deleting, setDeleting] = useState<PostDto | null>(null);
  const [rolesOf, setRolesOf] = useState<PostDto | null>(null);
  const act = useAction();
  const dirty = !!form && (form.post ? form.name !== form.post.name || form.code !== form.post.code || (form.dept[0] ?? null) !== form.post.deptId || form.sort !== String(form.post.sort) || form.enabled !== (form.post.status === "enabled") : !!(form.name || form.code));
  return (
    <div className="aui-access-stack" data-aui-flow="stack">
      <ReadOnlyNote show={!manage} />
      <ErrorAlert error={act.error} onDismiss={act.clear} />
      <StatusLine text={act.done} />
      <Panel
        title="岗位"
        description="岗位挂在部门下（不挂 = 全公司通用）；给岗位分配角色后，在这个岗位上的人都会得到它。"
        actions={manage ? <Button size="sm" onClick={() => setForm({ post: null, code: "", name: "", dept: [], sort: "100", enabled: true })}><Plus size={14} aria-hidden="true" />新建岗位</Button> : undefined}
      >
        <DataTable rowHeight="medium"
          caption="岗位"
          rows={[...c.posts].sort((a, b) => a.sort - b.sort)}
          rowKey={(p) => p.id}
          emptyLabel="还没有岗位"
          pagination={{ mode: "all" }}
          columns={[
            { key: "name", title: "岗位", minWidth: 160, render: (p) => <CellText primary={p.name} secondary={p.code} /> },
            { key: "dept", title: "所属部门", minWidth: 160, maxWidth: 280, truncate: (p) => (p.deptId ? c.deptIdx.path(p.deptId) : "全公司"), render: (p) => (p.deptId ? c.deptIdx.path(p.deptId) : "全公司") },
            { key: "status", title: "状态", width: 90, render: (p) => (p.status === "enabled" ? <StatusBadge tone="success">启用</StatusBadge> : <StatusBadge>已停用</StatusBadge>) },
            {
              key: "actions",
              title: "操作",
              kind: "actions",
              render: (p) => {
                const actions = [
                  ...(c.rights.roles.view ? [{ key: "roles", label: "角色", icon: <ShieldCheck />, ariaLabel: `岗位「${p.name}」的角色`, onSelect: () => setRolesOf(p) }] : []),
                  ...(manage
                    ? [
                        { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setForm({ post: p, code: p.code, name: p.name, dept: p.deptId ? [p.deptId] : [], sort: String(p.sort), enabled: p.status === "enabled" }) },
                        { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setDeleting(p) },
                      ]
                    : []),
                ];
                return actions.length ? <RowActionBar label={`${p.name}的更多操作`} actions={actions} /> : null;
              },
            },
          ]}
        />
      </Panel>
      {rolesOf && (
        <div className="aui-access-stack" data-aui-flow="stack">
          <div className="aui-access-bar">
            <Building2 size={16} aria-hidden="true" />
            <strong>{rolesOf.name}</strong>
            <span className="aui-access-bar-end">
              <Button size="sm" variant="ghost" onClick={() => setRolesOf(null)}>收起</Button>
            </span>
          </div>
          <SubjectRoles type="post" id={rolesOf.id} name={`岗位「${rolesOf.name}」`} manage={c.rights.assign && !c.readOnly} />
        </div>
      )}
      <FormDialog
        open={form !== null}
        title={form?.post ? `编辑岗位「${form.post.name}」` : "新建岗位"}
        description="岗位编码建了以后最好不要改（别的系统可能按编码对接）。"
        dirty={dirty}
        onClose={() => setForm(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!form) return;
            if (!form.name.trim() || !form.code.trim()) throw new Error("请填写岗位名称和编码");
            const sort = Number(form.sort);
            if (!Number.isInteger(sort)) throw new Error("排序要填整数");
            const body = { code: form.code.trim(), name: form.name.trim(), deptId: form.dept[0] ?? null, sort, status: form.enabled ? ("enabled" as const) : ("disabled" as const) };
            const saved = form.post ? await c.api.updatePost(form.post.id, { ...body, version: form.post.version }) : await c.api.createPost(body);
            setForm(null);
            act.setDone(`已保存岗位「${saved.name}」`);
            c.reload("posts");
          })
        }
      >
        {form && (
          <>
            <div className="aui-access-form-row">
              <FormField label="名称" htmlFor={`${ids}-name`} required>
                <Input id={`${ids}-name`} value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
              </FormField>
              <FormField label="编码" htmlFor={`${ids}-code`} required>
                <Input id={`${ids}-code`} value={form.code} onChange={(e) => setForm((f) => f && { ...f, code: e.target.value })} />
              </FormField>
            </div>
            <FormField label="所属部门" htmlFor={`${ids}-dept`} hint="不选 = 全公司通用">
              <OrgTreePicker id={`${ids}-dept`} label="所属部门" nodes={c.orgTree} value={form.dept} onChange={(dept) => setForm((f) => f && { ...f, dept })} placeholder="全公司" />
            </FormField>
            <div className="aui-access-form-row">
              <FormField label="排序" htmlFor={`${ids}-sort`}>
                <Input id={`${ids}-sort`} inputMode="numeric" value={form.sort} onChange={(e) => setForm((f) => f && { ...f, sort: e.target.value })} />
              </FormField>
              <FormField label="启用" htmlFor={`${ids}-on`}>
                <Switch id={`${ids}-on`} checked={form.enabled} onCheckedChange={(enabled) => setForm((f) => f && { ...f, enabled })} />
              </FormField>
            </div>
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={deleting !== null}
        title="删除岗位"
        destructive
        confirmLabel="删除"
        impact={deleting ? `删除岗位「${deleting.name}」。还有人在这个岗位上时服务端会拒绝。` : undefined}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!deleting) return;
            await c.api.deletePost(deleting.id);
            act.setDone(`已删除岗位「${deleting.name}」`);
            if (rolesOf?.id === deleting.id) setRolesOf(null);
            c.reload("posts");
          })
        }
      />
    </div>
  );
}

type DimForm = { dim: DimensionDto; value: DimValueDto | null; id: string; name: string; sort: string; enabled: boolean };

/**
 * 维度值（quanxian 2.2：业务线 / 区域 …；维度在代码里登记，这里管它的值）：每个维度一个列表，
 * 新建 / 改名 / 启停 / 删除（有人或有分配挂着时服务端拒绝）。改值要不带范围的「组织管理」。
 */
export function DimSection() {
  const c = useConsole();
  // 维度值对全公司生效：建 / 改 / 停用 / 删要不带范围的组织管理
  const manage = c.rights.orgStructure && !c.readOnly && !!c.api.createDimValue;
  const ids = useId();
  const [form, setForm] = useState<DimForm | null>(null);
  const [deleting, setDeleting] = useState<{ dim: DimensionDto; value: DimValueDto } | null>(null);
  const [disabling, setDisabling] = useState<{ dim: DimensionDto; value: DimValueDto } | null>(null);
  // 停用前数一数「只在这个值上」的分配（看得到分配才数；数不了就只说人数）
  const scopedList = useAdminResource(`dim-disable:${disabling?.dim.id ?? ""}:${disabling?.value.id ?? ""}`, (signal) => c.api.listAssignments({}, signal), 0, !!disabling && c.rights.roles.view);
  const act = useAction();
  const setStatus = (dim: DimensionDto, v: DimValueDto, enabled: boolean) =>
    act.run(async () => {
      await c.api.updateDimValue!(dim.id, v.id, { status: enabled ? "enabled" : "disabled", version: v.version });
      c.reload("dims");
    }, enabled ? `已启用「${v.name}」` : `已停用「${v.name}」：里面的人不再算在这个${dim.label}里`);
  const dirty = !!form && (form.value ? form.name !== form.value.name || form.sort !== String(form.value.sort) || form.enabled !== (form.value.status === "enabled") : !!(form.name || form.id));
  if (!c.dims.length) return <StatePanel kind="empty" message="宿主没有登记维度（业务线 / 区域等在代码里 definePolicy({ dimensions }) 登记）" />;
  return (
    <div className="aui-access-stack" data-aui-flow="stack">
      <ReadOnlyNote show={!manage} />
      <ErrorAlert error={act.error} onReload={() => { act.clear(); c.reload("dims"); }} onDismiss={act.clear} />
      <StatusLine text={act.done} />
      {c.dims.map((dim) => (
        <Panel
          key={dim.id}
          title={dim.label}
          description={`人可以在多个${dim.label}里（一个主${dim.label}）；分配角色时可以「只在某个${dim.label}上」。记录上没填${dim.label}的，只有不限${dim.label}的人看得到。`}
          actions={manage ? <Button size="sm" onClick={() => setForm({ dim, value: null, id: "", name: "", sort: "100", enabled: true })}><Plus size={14} aria-hidden="true" />新建{dim.label}</Button> : undefined}
        >
          <DataTable rowHeight="medium"
            caption={dim.label}
            rows={dim.values}
            rowKey={(v) => v.id}
            emptyLabel={`还没有${dim.label}`}
            pagination={{ mode: "all" }}
            columns={[
              { key: "name", title: "名称", minWidth: 160, render: (v) => <CellText primary={v.name} secondary={v.id} /> },
              { key: "status", title: "状态", width: 90, render: (v) => (v.status === "enabled" ? <StatusBadge tone="success">启用</StatusBadge> : <StatusBadge>已停用</StatusBadge>) },
              { key: "members", title: "人数", width: 80, align: "right", render: (v) => v.members },
              {
                key: "actions",
                title: "操作",
                kind: "actions",
                render: (v) =>
                  manage ? (
                    <RowActionBar
                      label={`${v.name}的更多操作`}
                      actions={[
                        { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setForm({ dim, value: v, id: v.id, name: v.name, sort: String(v.sort), enabled: v.status === "enabled" }) },
                        v.status === "enabled" ? { key: "off", label: "停用", icon: <CirclePause />, onSelect: () => setDisabling({ dim, value: v }) } : { key: "on", label: "启用", icon: <CirclePlay />, onSelect: () => void setStatus(dim, v, true) },
                        { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, disabled: v.members > 0, disabledReason: v.members > 0 ? `还有 ${v.members} 人在里面，先移出` : undefined, onSelect: () => setDeleting({ dim, value: v }) },
                      ]}
                    />
                  ) : null,
              },
            ]}
          />
        </Panel>
      ))}
      <FormDialog
        open={form !== null}
        title={form?.value ? `编辑${form.dim.label}「${form.value.name}」` : `新建${form?.dim.label ?? ""}`}
        description={form?.value ? "停用后里面的人不再算在这个值里，只在这个值上的分配也一起不算。" : "编号建了以后不能改（业务表里存的就是它）；不填自动生成。"}
        dirty={dirty}
        onClose={() => setForm(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!form) return;
            if (!form.name.trim()) throw new Error(`请填写${form.dim.label}名称`);
            const sort = Number(form.sort);
            if (!Number.isInteger(sort)) throw new Error("排序要填整数");
            const status = form.enabled ? ("enabled" as const) : ("disabled" as const);
            const saved = form.value
              ? await c.api.updateDimValue!(form.dim.id, form.value.id, { name: form.name.trim(), sort, status, version: form.value.version })
              : await c.api.createDimValue!(form.dim.id, { ...(form.id.trim() ? { id: form.id.trim() } : {}), name: form.name.trim(), sort, status });
            setForm(null);
            act.setDone(`已保存${form.dim.label}「${saved.name}」`);
            c.reload("dims");
          })
        }
      >
        {form && (
          <>
            <div className="aui-access-form-row">
              <FormField label="名称" htmlFor={`${ids}-name`} required>
                <Input id={`${ids}-name`} value={form.name} maxLength={100} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
              </FormField>
              <FormField label="编号" htmlFor={`${ids}-id`} hint={form.value ? "不能改" : "字母、数字和 _ . : @ -"}>
                <Input id={`${ids}-id`} value={form.id} disabled={!!form.value} onChange={(e) => setForm((f) => f && { ...f, id: e.target.value })} />
              </FormField>
            </div>
            <div className="aui-access-form-row">
              <FormField label="排序" htmlFor={`${ids}-sort`} hint="小的在前">
                <Input id={`${ids}-sort`} inputMode="numeric" value={form.sort} onChange={(e) => setForm((f) => f && { ...f, sort: e.target.value })} />
              </FormField>
              <FormField label="启用" htmlFor={`${ids}-on`}>
                <Switch id={`${ids}-on`} checked={form.enabled} onCheckedChange={(enabled) => setForm((f) => f && { ...f, enabled })} />
              </FormField>
            </div>
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={disabling !== null}
        title={`停用${disabling?.dim.label ?? ""}`}
        confirmLabel="停用"
        impact={disabling ? dimValueDisableImpact(disabling.dim, disabling.value, c.rights.roles.view ? (scopedList.data ?? null) : null) : undefined}
        onClose={() => setDisabling(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!disabling) return;
            const { dim, value } = disabling;
            await c.api.updateDimValue!(dim.id, value.id, { status: "disabled", version: value.version });
            act.setDone(`已停用「${value.name}」：里面的人不再算在这个${dim.label}里`);
            c.reload("dims");
          })
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`删除${deleting?.dim.label ?? ""}`}
        destructive
        confirmLabel="删除"
        impact={deleting ? `删除${deleting.dim.label}「${deleting.value.name}」。还有人在里面、或还有分配「只在这个值上」时服务端会拒绝。` : undefined}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!deleting) return;
            await c.api.deleteDimValue!(deleting.dim.id, deleting.value.id);
            act.setDone(`已删除${deleting.dim.label}「${deleting.value.name}」`);
            c.reload("dims");
          })
        }
      />
    </div>
  );
}
