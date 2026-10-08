"use client";
/**
 * AccessConsole section「用户组」: groups / teams that record grants can target; create, rename,
 * delete, and set members (with an expiry for all of them). Version-checked like every write.
 */
import { useId, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button, Input, StatusBadge, Textarea } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../forms.tsx";
import { Panel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { CellPeople, CellText } from "../cells.tsx";
import { RowActionBar } from "../row-actions.tsx";
import { UserTransfer } from "./org-picker.tsx";
import type { GroupDto } from "./console-contracts.ts";
import { futureIso } from "./console-core.ts";
import { ErrorAlert, ExpiryField, ReadOnlyNote, StatusLine, inDialog, useAction, useConsole } from "./console-shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

type GroupForm = { group: GroupDto | null; name: string; description: string; kind: "group" | "team" };

export function GroupSection() {
  const c = useConsole();
  const ids = useId();
  const manage = c.rights.groups.manage && !c.readOnly;
  const [form, setForm] = useState<GroupForm | null>(null);
  const [members, setMembers] = useState<{ group: GroupDto; ids: string[]; expires: string } | null>(null);
  const [deleting, setDeleting] = useState<GroupDto | null>(null);
  const act = useAction();
  return (
    <div className="aui-access-stack">
      <ReadOnlyNote show={!manage} />
      <ErrorAlert error={act.error} onReload={() => { act.clear(); c.reload("groups"); }} onDismiss={act.clear} />
      <StatusLine text={act.done} />
      <Panel
        title="用户组"
        description="把记录共享给一组人（团队、项目组）时用；成员可以设到期。不能把自己加进组。"
        actions={manage ? <Button size="sm" onClick={() => setForm({ group: null, name: "", description: "", kind: "group" })}><Plus size={14} aria-hidden="true" />新建用户组</Button> : undefined}
      >
        <DataTable rowHeight="medium"
          caption="用户组"
          rows={c.groups}
          rowKey={(g) => g.id}
          emptyLabel="还没有用户组"
          pagination={{ mode: "all" }}
          columns={[
            { key: "name", title: "名称", minWidth: 150, render: (g) => <CellText primary={g.name} secondary={g.description || undefined} /> },
            { key: "kind", title: "类型", width: 90, render: (g) => <StatusBadge>{g.kind === "team" ? "团队" : "用户组"}</StatusBadge> },
            { key: "members", title: "成员", minWidth: 180, maxWidth: 320, render: (g) => (g.members.length ? <CellPeople people={g.members.map((m) => ({ name: c.userName(m.userId) }))} /> : <span className="aui-note">无</span>) },
            {
              key: "actions",
              title: "操作",
              kind: "actions",
              render: (g) =>
                manage ? (
                  <RowActionBar
                    label={`${g.name}的更多操作`}
                    actions={[
                      { key: "members", label: "成员", icon: <Users />, onSelect: () => setMembers({ group: g, ids: g.members.map((m) => m.userId), expires: "" }) },
                      { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setForm({ group: g, name: g.name, description: g.description, kind: g.kind }) },
                      { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setDeleting(g) },
                    ]}
                  />
                ) : null,
            },
          ]}
        />
      </Panel>
      <FormDialog
        open={form !== null}
        title={form?.group ? `编辑「${form.group.name}」` : "新建用户组"}
        description="名称在授权、团队面板里显示。"
        dirty={!!form && (form.group ? form.name !== form.group.name || form.description !== form.group.description || form.kind !== form.group.kind : !!form.name)}
        onClose={() => setForm(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!form) return;
            if (!form.name.trim()) throw new Error("请填写名称");
            const body = { name: form.name.trim(), description: form.description, kind: form.kind };
            const saved = form.group ? await c.api.updateGroup(form.group.id, { ...body, version: form.group.version }) : await c.api.createGroup(body);
            setForm(null);
            act.setDone(`已保存「${saved.name}」`);
            c.reload("groups");
          })
        }
      >
        {form && (
          <>
            <FormField label="名称" htmlFor={`${ids}-name`} required>
              <Input id={`${ids}-name`} value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
            </FormField>
            <FormField label="类型" htmlFor={`${ids}-kind`}>
              <SegmentedControl label="类型" value={form.kind} options={[{ value: "group", label: "用户组" }, { value: "team", label: "团队" }]} onValueChange={(kind) => setForm((f) => f && { ...f, kind })} />
            </FormField>
            <FormField label="说明" htmlFor={`${ids}-desc`}>
              <Textarea id={`${ids}-desc`} value={form.description} onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })} />
            </FormField>
          </>
        )}
      </FormDialog>
      <FormDialog
        open={members !== null}
        title={`「${members?.group.name ?? ""}」的成员`}
        description="新加的成员按下面的到期时间；已在组里的保留原来的到期时间。"
        size="lg"
        dirty={!!members && (members.ids.length !== members.group.members.length || members.ids.some((id) => !members.group.members.some((m) => m.userId === id)))}
        onClose={() => setMembers(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!members) return;
            const expiresAt = futureIso(members.expires, c.now);
            const keep = new Map(members.group.members.map((m) => [m.userId, m.expiresAt]));
            await c.api.setGroupMembers(members.group.id, members.ids.map((userId) => ({ userId, expiresAt: keep.has(userId) ? (keep.get(userId) ?? null) : expiresAt })));
            setMembers(null);
            act.setDone(`已更新「${members.group.name}」的成员`);
            c.reload("groups");
          })
        }
      >
        {members && (
          <>
            <UserTransfer label="成员" orgTree={c.orgTree} users={c.users} value={members.ids} onChange={(v) => setMembers((m) => m && { ...m, ids: v })} />
            <ExpiryField label="新成员到期时间" value={members.expires} onChange={(expires) => setMembers((m) => m && { ...m, expires })} now={c.now} />
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={deleting !== null}
        title="删除用户组"
        destructive
        confirmLabel="删除"
        impact={deleting ? `删除「${deleting.name}」。共享给这个组的记录，组里的人会立即看不到。` : undefined}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!deleting) return;
            await c.api.deleteGroup(deleting.id);
            act.setDone(`已删除「${deleting.name}」`);
            c.reload("groups");
          })
        }
      />
    </div>
  );
}
