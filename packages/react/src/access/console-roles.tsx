"use client";
/**
 * AccessConsole sections「角色」and「字段权限」: role list, basic info, the permission matrix with a
 * data scope per cell and field rows, diff against the saved role + unsaved prompt, optimistic
 * version (409 → reload), holders; and a per-role field-policy editor (读 / 写 / 导出 / 脱敏).
 * Built-in roles are defined in code: shown read-only, can be copied into a custom role.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { Copy, FolderOpen, Plus, UserMinus } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge, Switch, Textarea } from "../primitives.tsx";
import { ChangeList, ConfirmDialog, FormDialog, FormField } from "../forms.tsx";
import { InlineAlert, Panel, StatePanel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { CellText } from "../cells.tsx";
import { RowActionBar } from "../row-actions.tsx";
import { useAdminResource } from "../workflow-hooks.ts";
import { PermissionMatrix } from "./permission-matrix.tsx";
import { ExpiryBadge } from "./record-team.tsx";
import { FIELD_ABILITY_LABEL, type FieldAbility, type FieldPolicy, type PermissionMatrixValue } from "./contracts.ts";
import { assignKey, describeAssignScope, describeFieldPolicy, diffMatrix, fieldKey, fieldPolicyOf, matrixChangeItems, toggleFieldAbility } from "./matrix-core.ts";
import { ASSIGN_SUBJECT_LABEL, type AssignmentDto, type RoleDto } from "./console-contracts.ts";
import { assignmentActions, baseRoleOptions, errorView, fieldCondChangeItems, matrixOf, roleBasicChanges, roleBasics, roleDirty, roleSaveBody, type RoleBasics } from "./console-core.ts";
import { ErrorAlert, LockedNote, ReadOnlyNote, StatusLine, inDialog, useAction, useConsole, revealDetail } from "./console-shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

function RoleBadges({ role }: { role: RoleDto }) {
  return (
    <span className="aui-access-badges">
      {role.builtin && <StatusBadge>内置</StatusBadge>}
      {role.superuser && <StatusBadge tone="danger">超级管理员</StatusBadge>}
      {role.disabled && <StatusBadge tone="warning">已停用</StatusBadge>}
    </span>
  );
}

function RoleHolders({ role }: { role: RoleDto }) {
  const c = useConsole();
  const [rev, setRev] = useState(0);
  const list = useAdminResource(`holders:${role.id}:${rev}`, (signal) => c.api.listAssignments({ roleId: role.id }, signal));
  const [removing, setRemoving] = useState<AssignmentDto | null>(null);
  const manage = c.rights.assign && !c.readOnly;
  const nameOf = (a: AssignmentDto) => (a.subject.type === "user" ? c.userName(a.subject.id) : a.subject.type === "dept" ? c.deptIdx.path(a.subject.id) : (c.posts.find((p) => p.id === a.subject.id)?.name ?? a.subject.id));
  // 同一个人可以在几个范围上各持有一次（quanxian 2.2）：范围也是这一行的身份
  const where = (a: AssignmentDto) => describeAssignScope(a.scope, { ...c.dimNames, dept: c.deptIdx.name });
  const anyScoped = (list.data ?? []).some((a) => a.scope) || c.catalog?.scopedAssignments === true;
  // 只在某些业务线 / 部门管人（quanxian 2.2）：范围外的分配不给动（服务端 assertScopeInMgmt 会拒）
  const can = (a: AssignmentDto) =>
    assignmentActions(a, manage, {
      within: c.rights.assignWithin,
      subtree: c.deptIdx.subtree,
      names: { ...c.dimNames, dept: c.deptIdx.name },
      ...(a.subject.type === "dept" ? { subjectDept: a.subject.id } : a.subject.type === "post" ? { subjectDept: c.posts.find((p) => p.id === a.subject.id)?.deptId ?? null } : {}),
    });
  return (
    <Panel title="谁有这个角色" description="直接分配给人的，以及经由岗位 / 部门得到的">
      <DataTable rowHeight="medium"
        caption={`${role.name}的持有者`}
        rows={list.data ?? []}
        rowKey={(a) => `${a.subject.type}:${a.subject.id}:${assignKey(a)}`}
        loading={list.loading && !list.data}
        error={list.error}
        onRetry={list.refresh}
        emptyLabel="还没有人有这个角色"
        pagination={{ mode: "all" }}
        columns={[
          { key: "who", title: "对象", minWidth: 160, render: (a) => <CellText primary={nameOf(a)} secondary={ASSIGN_SUBJECT_LABEL[a.subject.type]} /> },
          ...(anyScoped ? [{ key: "scope", title: "范围", minWidth: 120, maxWidth: 220, truncate: where, render: where }] : []),
          { key: "exp", title: "到期", width: 120, render: (a) => <ExpiryBadge expiresAt={a.expiresAt} now={c.now} /> },
          { key: "why", title: "原因", minWidth: 120, maxWidth: 240, truncate: (a) => a.reason || "—", render: (a) => a.reason || "—" },
          {
            key: "actions",
            title: "操作",
            kind: "actions",
            render: (a) => {
              const allowed = can(a);
              if (allowed.lockedReason) return <LockedNote reason={allowed.lockedReason} />;
              if (!allowed.unassign && !allowed.blockedReason) return null;
              return (
                <RowActionBar
                  label={`${nameOf(a)}的更多操作`}
                  actions={[{ key: "unassign", label: "取消分配", icon: <UserMinus />, menuOnly: false, disabled: !allowed.unassign, ...(allowed.blockedReason ? { disabledReason: allowed.blockedReason } : {}), onSelect: () => setRemoving(a) }]}
                />
              );
            },
          },
        ]}
      />
      <ConfirmDialog
        open={removing !== null}
        title="取消分配"
        destructive
        confirmLabel="取消分配"
        impact={removing ? `${nameOf(removing)} 将失去角色「${role.name}」${removing.scope ? `（${where(removing)}）` : ""}，立即生效。` : undefined}
        reason={{ label: "原因", required: true }}
        onClose={() => setRemoving(null)}
        onConfirm={(reason) =>
          inDialog(async () => {
            if (!removing) return;
            // 带上这条的范围：不带 = 服务端只删不带范围的那条（会删错 / 404）
            await c.api.unassign({ subject: removing.subject, roleId: role.id, reason, ...(removing.scope ? { scope: removing.scope } : {}) });
            setRev((r) => r + 1);
          })
        }
      />
    </Panel>
  );
}

export function RoleSection() {
  const c = useConsole();
  const ids = useId();
  const manage = c.rights.roles.manage && !c.readOnly;
  const [selected, setSelected] = useState<string>(c.preset.roleId ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const role = c.roles.find((r) => r.id === selected) ?? null;
  const [basics, setBasics] = useState<RoleBasics>(roleBasics(role));
  const [matrix, setMatrix] = useState<PermissionMatrixValue>(matrixOf(role));
  const [loadedVersion, setLoadedVersion] = useState<string>("");
  const [confirm, setConfirm] = useState(false);
  const [creating, setCreating] = useState<{ name: string; code: string; description: string; copyFrom: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const act = useAction();
  const editable = manage && !!role && !role.builtin;

  useEffect(() => {
    if (!selected && c.roles.length) setSelected(c.preset.roleId ?? c.roles[0]!.id);
  }, [selected, c.roles, c.preset.roleId]);
  // Load the draft when the role (or its saved version) changes.
  useEffect(() => {
    const key = role ? `${role.id}@${role.version}` : "";
    if (key === loadedVersion) return;
    setBasics(roleBasics(role));
    setMatrix(matrixOf(role));
    setLoadedVersion(key);
  }, [role, loadedVersion]);

  const dirty = editable && roleDirty(role, basics, matrix, c.catalog);
  useEffect(() => {
    c.setDirty("roles", dirty);
    return () => c.setDirty("roles", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const changes = useMemo(() => {
    if (!role || !c.catalog) return [];
    const roleName = (id: string) => c.roles.find((r) => r.id === id)?.name ?? id;
    return [...roleBasicChanges(roleBasics(role), basics, roleName), ...matrixChangeItems(diffMatrix(matrixOf(role), matrix, c.catalog.resources, c.catalog.actions), c.deptIdx.name), ...fieldCondChangeItems(role, matrix, c.catalog.resources)];
  }, [role, basics, matrix, c.catalog, c.roles, c.deptIdx]);

  const pick = (id: string) => {
    if (id === selected) return;
    if (dirty) setPending(id);
    else setSelected(id);
  };

  if (!c.catalog) return <StatePanel kind="loading" message="正在加载权限目录…" />;
  return (
    <div className="aui-access-stack" data-aui-flow="stack">
      <ReadOnlyNote show={!manage} />
      <ErrorAlert error={act.error} onReload={() => { act.clear(); c.reload("roles"); }} onDismiss={act.clear} />
      <StatusLine text={act.done} />
      <div className="aui-access-split" data-aui-flow="columns">
        <Panel title="角色" actions={manage ? <Button size="sm" onClick={() => setCreating({ name: "", code: "", description: "", copyFrom: "" })}><Plus size={14} aria-hidden="true" />新建角色</Button> : undefined}>
          <DataTable rowHeight="medium"
            caption="角色列表"
            rows={[...c.roles].sort((a, b) => a.sort - b.sort)}
            rowKey={(r) => r.id}
            emptyLabel="还没有角色"
            pagination={{ mode: "all" }}
            columns={[
              { key: "name", title: "角色", minWidth: 150, render: (r) => <CellText primary={r.id === selected ? `${r.name}（当前）` : r.name} secondary={[r.superuser ? "超级管理员" : r.builtin ? "内置" : "自建", r.disabled ? "已停用" : "", r.description].filter(Boolean).join(" · ")} /> },
              { key: "open", title: "操作", kind: "actions", render: (r) => <RowActionBar label={`${r.name}的更多操作`} actions={[{ key: "open", label: "打开", icon: <FolderOpen />, ariaLabel: `打开角色 ${r.name}`, onSelect: () => { pick(r.id); revealDetail(); } }]} /> },
            ]}
          />
        </Panel>
        {role ? (
          <Panel
            title={role.name}
            description={role.builtin ? "内置角色：在代码里定义，后台只能查看" : `自建角色 · 版本 ${role.version}`}
            actions={
              <>
                {manage && (
                  <Button size="sm" variant="outline" onClick={() => setCreating({ name: `${role.name}（副本）`, code: "", description: role.description, copyFrom: role.id })}>
                    <Copy size={14} aria-hidden="true" />
                    复制为新角色
                  </Button>
                )}
                {editable && <Button size="sm" variant="ghost" onClick={() => setDeleting(true)}>删除</Button>}
              </>
            }
          >
            <RoleBadges role={role} />
            {role.builtin && <InlineAlert tone="info" title="内置角色不能在后台改">它在代码里定义，改代码后重启会自动同步。要在它基础上调整，点「复制为新角色」。</InlineAlert>}
            <div className="aui-access-form-row">
              <FormField label="名称" htmlFor={`${ids}-name`} required>
                <Input id={`${ids}-name`} value={basics.name} disabled={!editable} onChange={(e) => setBasics((b) => ({ ...b, name: e.target.value }))} />
              </FormField>
              <FormField label="基础角色" htmlFor={`${ids}-base`} hint="继承它的全部权限，再加上这里勾选的">
                <Choice id={`${ids}-base`} label="基础角色" value={basics.baseRoleId ?? "__none"} disabled={!editable} options={[{ value: "__none", label: "无" }, ...baseRoleOptions(c.roles, role.id)]} onChange={(v) => setBasics((b) => ({ ...b, baseRoleId: v === "__none" ? null : v }))} />
              </FormField>
            </div>
            <FormField label="说明" htmlFor={`${ids}-desc`}>
              <Textarea id={`${ids}-desc`} value={basics.description} disabled={!editable} onChange={(e) => setBasics((b) => ({ ...b, description: e.target.value }))} />
            </FormField>
            <div className="aui-access-form-row">
              <FormField label="停用" htmlFor={`${ids}-off`} hint="停用后持有它的人立即失去这些权限">
                <Switch id={`${ids}-off`} checked={basics.disabled} disabled={!editable} onCheckedChange={(disabled) => setBasics((b) => ({ ...b, disabled }))} />
              </FormField>
              {c.snapshot.superuser && (
                <FormField label="超级管理员" htmlFor={`${ids}-su`} hint="拥有全部权限；只有超级管理员能设">
                  <Switch id={`${ids}-su`} checked={basics.superuser} disabled={!editable} onCheckedChange={(superuser) => setBasics((b) => ({ ...b, superuser }))} />
                </FormField>
              )}
            </div>
          </Panel>
        ) : (
          <StatePanel kind="empty" message="在左边选一个角色" />
        )}
      </div>
      {role && (
        <div className="aui-access-stack" data-aui-flow="stack">
          {basics.superuser ? (
            <InlineAlert tone="warning" title="超级管理员拥有全部权限">矩阵对它不起作用；高危操作照样要二次验证。</InlineAlert>
          ) : (
            <PermissionMatrix
              caption={`${role.name}的权限`}
              resources={c.catalog.resources}
              actions={c.catalog.actions}
              value={matrix}
              savedValue={matrixOf(role)}
              readOnly={!editable}
              onChange={editable ? setMatrix : undefined}
              orgTree={c.orgTree}
              dimensions={c.dimensions}
              toolbar={
                editable ? (
                  <Button disabled={!dirty} onClick={() => setConfirm(true)}>
                    保存
                  </Button>
                ) : undefined
              }
            />
          )}
          {basics.superuser && editable && (
            <div className="aui-access-bar">
              <span className="aui-access-bar-end">
                <Button disabled={!dirty} onClick={() => setConfirm(true)}>保存</Button>
              </span>
            </div>
          )}
          {dirty && <p className="aui-note" role="status">有未保存的改动：切换角色或离开页面前会提醒你。</p>}
          <RoleHolders role={role} />
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={`保存角色「${role?.name ?? ""}」`}
        size="md"
        description="持有这个角色的人下一次请求就按新的权限判断。"
        confirmLabel="保存"
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          inDialog(async () => {
            if (!role) return;
            if (!basics.name.trim()) throw new Error("角色名称不能为空");
            const before = roleBasics(role);
            const patch = {
              version: role.version,
              ...(basics.name !== before.name ? { name: basics.name.trim() } : {}),
              ...(basics.description !== before.description ? { description: basics.description } : {}),
              ...(basics.disabled !== before.disabled ? { disabled: basics.disabled } : {}),
              ...(basics.superuser !== before.superuser ? { superuser: basics.superuser } : {}),
              ...(basics.baseRoleId !== before.baseRoleId ? { baseRoleId: basics.baseRoleId } : {}),
              // 字段的按行条件跟着矩阵一起发（不发 = 旧服务端把条件全清掉）
              ...roleSaveBody(role, matrix),
            };
            try {
              await c.api.updateRole(role.id, patch);
            } catch (e) {
              // A version conflict also stays on the page (with「重新加载」) after the dialog closes.
              if (errorView(e).conflict) act.fail(e);
              throw e;
            }
            act.setDone(`已保存角色「${basics.name.trim()}」`);
            c.reload("roles");
          })
        }
      >
        <ChangeList items={changes} />
      </ConfirmDialog>
      <ConfirmDialog
        open={pending !== null}
        title="放弃未保存的改动？"
        destructive
        confirmLabel="放弃改动"
        impact={`角色「${role?.name ?? ""}」有 ${changes.length} 处改动还没保存。`}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            setLoadedVersion("");
            setSelected(pending);
          }
          setPending(null);
        }}
      >
        <ChangeList items={changes} />
      </ConfirmDialog>
      <FormDialog
        open={creating !== null}
        title="新建角色"
        description="新角色默认没有任何权限；可以从已有角色复制一份再改。"
        dirty={!!creating && (!!creating.name || !!creating.code)}
        submitLabel="新建"
        onClose={() => setCreating(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!creating) return;
            if (!creating.name.trim()) throw new Error("请填写角色名称");
            const from = c.roles.find((r) => r.id === creating.copyFrom);
            const created = await c.api.createRole({ name: creating.name.trim(), ...(creating.code.trim() ? { code: creating.code.trim() } : {}), description: creating.description, ...(from ? roleSaveBody(from, matrixOf(from)) : {}) });
            setCreating(null);
            act.setDone(`已新建角色「${created.name}」`);
            setLoadedVersion("");
            setSelected(created.id);
            c.reload("roles");
          })
        }
      >
        {creating && (
          <>
            <div className="aui-access-form-row">
              <FormField label="名称" htmlFor={`${ids}-new-name`} required>
                <Input id={`${ids}-new-name`} value={creating.name} onChange={(e) => setCreating((x) => x && { ...x, name: e.target.value })} />
              </FormField>
              <FormField label="编码" htmlFor={`${ids}-new-code`} hint="可不填，自动生成">
                <Input id={`${ids}-new-code`} value={creating.code} onChange={(e) => setCreating((x) => x && { ...x, code: e.target.value })} />
              </FormField>
            </div>
            <FormField label="说明" htmlFor={`${ids}-new-desc`}>
              <Textarea id={`${ids}-new-desc`} value={creating.description} onChange={(e) => setCreating((x) => x && { ...x, description: e.target.value })} />
            </FormField>
            <FormField label="复制权限自" htmlFor={`${ids}-new-from`}>
              <Choice id={`${ids}-new-from`} label="复制权限自" value={creating.copyFrom || "__none"} options={[{ value: "__none", label: "不复制（空白角色）" }, ...c.roles.filter((r) => !r.superuser).map((r) => ({ value: r.id, label: r.name }))]} onChange={(v) => setCreating((x) => x && { ...x, copyFrom: v === "__none" ? "" : v })} />
            </FormField>
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={deleting}
        title="删除角色"
        destructive
        confirmLabel="删除"
        typeToConfirm={role?.name}
        impact={role ? `删除自建角色「${role.name}」，它的全部分配一起删除，持有它的人立即失去这些权限。` : undefined}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          inDialog(async () => {
            if (!role) return;
            await c.api.deleteRole(role.id);
            act.setDone(`已删除角色「${role.name}」`);
            setSelected("");
            setLoadedVersion("");
            c.reload("roles");
          })
        }
      />
    </div>
  );
}

const ABILITIES: readonly FieldAbility[] = ["read", "write", "export", "mask"];

/** Per-role field policy: one table per resource, 读 / 写 / 导出 / 脱敏 checkboxes, diff + save. */
export function FieldSection() {
  const c = useConsole();
  const ids = useId();
  const manage = c.rights.roles.manage && !c.readOnly;
  const withFields = (c.catalog?.resources ?? []).filter((r) => r.fields?.length);
  const [roleId, setRoleId] = useState(c.preset.roleId ?? "");
  const [resId, setResId] = useState(withFields[0]?.id ?? "");
  const role = c.roles.find((r) => r.id === roleId) ?? null;
  const resource = withFields.find((r) => r.id === resId) ?? withFields[0] ?? null;
  const [draft, setDraft] = useState<PermissionMatrixValue>(matrixOf(role));
  const [key, setKey] = useState("");
  const [confirm, setConfirm] = useState(false);
  const act = useAction();
  useEffect(() => {
    if (!roleId && c.roles.length) setRoleId(c.roles.find((r) => !r.builtin && !r.superuser)?.id ?? c.roles[0]!.id);
  }, [roleId, c.roles]);
  useEffect(() => {
    const k = role ? `${role.id}@${role.version}` : "";
    if (k !== key) {
      setDraft(matrixOf(role));
      setKey(k);
    }
  }, [role, key]);
  const editable = manage && !!role && !role.builtin && !role.superuser;
  const changes = useMemo(() => {
    if (!role || !c.catalog) return [];
    return diffMatrix(matrixOf(role), draft, c.catalog.resources, c.catalog.actions).filter((x) => x.kind === "field");
  }, [role, draft, c.catalog]);
  const dirty = editable && changes.length > 0;
  useEffect(() => {
    c.setDirty("fields", dirty);
    return () => c.setDirty("fields", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);
  if (!c.catalog) return <StatePanel kind="loading" message="正在加载权限目录…" />;
  if (!withFields.length) return <StatePanel kind="empty" message="权限目录里没有声明字段策略的资源" />;
  const savedFields = matrixOf(role);
  return (
    <div className="aui-access-stack" data-aui-flow="stack">
      <ReadOnlyNote show={!manage} />
      <ErrorAlert error={act.error} onReload={() => { act.clear(); c.reload("roles"); }} onDismiss={act.clear} />
      <StatusLine text={act.done} />
      <Panel title="字段权限" description="一个字段只要在某个角色上配过，就按配的算（多个角色取并集，脱敏要全部配过的角色都脱敏）；没配的按代码里的默认。">
        <div className="aui-access-filters">
          <FormField label="角色" htmlFor={`${ids}-role`}>
            <Choice id={`${ids}-role`} label="角色" value={roleId} options={c.roles.map((r) => ({ value: r.id, label: r.builtin ? `${r.name}（内置）` : r.name }))} onChange={(v) => (dirty ? act.fail(new Error("先保存或撤销当前角色的字段改动，再换角色")) : setRoleId(v))} />
          </FormField>
          <FormField label="资源" htmlFor={`${ids}-res`}>
            <Choice id={`${ids}-res`} label="资源" value={resource?.id ?? ""} options={withFields.map((r) => ({ value: r.id, label: r.label }))} onChange={setResId} />
          </FormField>
        </div>
        {role && (role.builtin || role.superuser) && <InlineAlert tone="info" title={role.superuser ? "超级管理员看得到全部字段" : "内置角色只能查看"}>{role.superuser ? "字段策略对超级管理员不起作用。" : "要调整请在「角色」里复制为新角色。"}</InlineAlert>}
      </Panel>
      {resource && role && (
        <DataTable rowHeight="medium"
          caption={`${role.name} · ${resource.label} 的字段权限`}
          rows={resource.fields ?? []}
          rowKey={(f) => f.id}
          pagination={{ mode: "all" }}
          toolbar={
            editable ? (
              <div className="aui-access-bar">
                <span className="aui-note">{changes.length ? `已修改 ${changes.length} 个字段，未保存` : "没有未保存的改动"}</span>
                <span className="aui-access-bar-end">
                  <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(matrixOf(role))}>撤销改动</Button>
                  <Button disabled={!dirty} onClick={() => setConfirm(true)}>保存</Button>
                </span>
              </div>
            ) : undefined
          }
          columns={[
            { key: "field", title: "字段", minWidth: 140, render: (f) => <CellText primary={f.label} secondary={f.sensitive ? "敏感字段" : f.id} /> },
            ...ABILITIES.map((a) => ({
              key: a,
              title: FIELD_ABILITY_LABEL[a],
              width: 72,
              render: (f: { id: string; label: string }) => {
                const p = fieldPolicyOf(draft, resource, f.id);
                return (
                  <Checkbox
                    aria-label={`${resource.label} · ${f.label} · ${FIELD_ABILITY_LABEL[a]}`}
                    checked={p[a]}
                    disabled={!editable}
                    onCheckedChange={() => setDraft((d) => ({ ...d, fields: { ...(d.fields ?? {}), [fieldKey(resource.id, f.id)]: toggleFieldAbility(fieldPolicyOf(d, resource, f.id), a) } }))}
                  />
                );
              },
            })),
            {
              key: "state",
              title: "说明",
              minWidth: 150,
              render: (f) => {
                const configured = !!savedFields.fields?.[fieldKey(resource.id, f.id)];
                const changed = changes.some((x) => x.key === fieldKey(resource.id, f.id));
                return changed ? <StatusBadge tone="warning">已改，未保存</StatusBadge> : configured ? <span className="aui-note">这个角色配过</span> : <span className="aui-note">按代码默认：{describeFieldPolicy(f.defaultPolicy ?? ({ read: false, write: false, export: false, mask: false } as FieldPolicy))}</span>;
              },
            },
          ]}
        />
      )}
      <ConfirmDialog
        open={confirm}
        title={`保存「${role?.name ?? ""}」的字段权限`}
        size="md"
        confirmLabel="保存"
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          inDialog(async () => {
            if (!role) return;
            await c.api.updateRole(role.id, { version: role.version, ...roleSaveBody(role, { grants: matrixOf(role).grants, fields: draft.fields ?? {} }) });
            act.setDone(`已保存「${role.name}」的字段权限`);
            c.reload("roles");
          })
        }
      >
        <ChangeList items={[...matrixChangeItems(changes), ...(role ? fieldCondChangeItems(role, { grants: matrixOf(role).grants, fields: draft.fields ?? {} }, c.catalog.resources) : [])]} />
      </ConfirmDialog>
    </div>
  );
}
