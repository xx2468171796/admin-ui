"use client";
/**
 * RecordTeamPanel — the「协作成员」tab of one record (authentik per-object permissions): the owner,
 * editors and viewers with expiry, add members (UserTransfer by department), change level / expiry,
 * remove with a reason, and transfer the owner (one atomic server operation). Presentational: every
 * change goes through the host callbacks, which reject to keep the dialog open with the message.
 */
import { useId, useMemo, useState } from "react";
import { ArrowRightLeft, Pencil, UserMinus, UserPlus } from "lucide-react";
import { Button, Choice, StatusBadge, Textarea } from "../primitives.tsx";
import { SegmentedControl, QuickDatePresets } from "../choices.tsx";
import { DateTimePicker } from "../date-picker.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../forms.tsx";
import { InlineAlert, Panel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { RowActionBar, type RowAction } from "../row-actions.tsx";
import { CellText } from "../cells.tsx";
import { UserTransfer } from "./org-picker.tsx";
import { CheckableTree } from "./checkable-tree.tsx";
import { fullPath, indexTree } from "./tree-core.ts";
import {
  EVERYONE_ID,
  GRANT_SUBJECT_LABEL,
  RECORD_LEVEL_LABEL,
  type AccessUser,
  type GrantSubject,
  type OrgNode,
  type RecordLevel,
  type RecordTeamAddInput,
  type RecordTeamMember,
  type TransferOwnerInput,
} from "./contracts.ts";
import { expiryState, isoToLocalInput as toLocal, localInputToIso as toIso, sortTeam, teamOwner } from "./review-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type RecordTeamPanelProps = {
  members: readonly RecordTeamMember[];
  title?: string;
  /** e.g.「客户：远山精密制造」, used in dialog text. */
  recordLabel?: string;
  /** Add / change / remove members (UI only — the server checks the actor's level again). */
  canManage?: boolean;
  canTransfer?: boolean;
  /** People that can be added or receive ownership. */
  candidates?: readonly AccessUser[];
  orgTree?: readonly OrgNode[];
  /**
   * Who can be added (default only people). quanxian also grants to a group, a department (its
   * members) or everyone (id `"*"`).
   */
  subjectTypes?: readonly GrantSubject["type"][];
  /** Groups offered when `subjectTypes` includes "group". */
  groups?: readonly { id: string; name: string; hint?: string }[];
  onAdd?: (inputs: RecordTeamAddInput[]) => Promise<void>;
  onUpdate?: (member: RecordTeamMember, patch: { level: Exclude<RecordLevel, "owner">; expiresAt: string | null }) => Promise<void>;
  onRemove?: (member: RecordTeamMember, reason: string) => Promise<void>;
  onTransferOwner?: (input: TransferOwnerInput) => Promise<void>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  now?: Date;
};

type Editable = Exclude<RecordLevel, "owner">;
const LEVEL_OPTIONS = [
  { value: "viewer" as const, label: RECORD_LEVEL_LABEL.viewer },
  { value: "editor" as const, label: RECORD_LEVEL_LABEL.editor },
];

export function ExpiryBadge({ expiresAt, now }: { expiresAt?: string | null; now?: Date }) {
  const state = expiryState(expiresAt, now);
  if (state.kind === "permanent") return <span className="aui-note">永久</span>;
  return <StatusBadge tone={state.kind === "expired" || state.kind === "invalid" ? "danger" : state.kind === "soon" ? "warning" : "neutral"}>{state.label}</StatusBadge>;
}

export function RecordTeamPanel({
  members,
  title = "协作成员",
  recordLabel,
  canManage = false,
  canTransfer = false,
  candidates = [],
  orgTree,
  subjectTypes = ["user"],
  groups = [],
  onAdd,
  onUpdate,
  onRemove,
  onTransferOwner,
  loading,
  error,
  onRetry,
  now,
}: RecordTeamPanelProps) {
  const sorted = useMemo(() => sortTeam(members), [members]);
  const owner = teamOwner(members);
  const ids = useId();
  const [adding, setAdding] = useState<{ kind: GrantSubject["type"]; users: string[]; level: Editable; expires: string; reason: string } | null>(null);
  const [editing, setEditing] = useState<{ member: RecordTeamMember; level: Editable; expires: string } | null>(null);
  const [removing, setRemoving] = useState<RecordTeamMember | null>(null);
  const [transfer, setTransfer] = useState<{ to: string; keep: "editor" | "viewer" | "none"; reason: string } | null>(null);
  const manage = canManage && !loading && !error;
  const existingUsers = new Set(members.filter((m) => m.subject.type === "user").map((m) => m.subject.id));
  const existing = new Set(members.map((m) => `${m.subject.type}:${m.subject.id}`));
  const kinds = subjectTypes.filter((k) => k !== "everyone" || !existing.has(`everyone:${EVERYONE_ID}`));
  const addable = candidates.filter((u) => !existingUsers.has(u.id));
  const transferTargets = [
    ...members.filter((m) => m.subject.type === "user" && m.level !== "owner" && !m.inheritedFrom).map((m) => ({ id: m.subject.id, name: m.subject.name, hint: RECORD_LEVEL_LABEL[m.level] })),
    ...addable.map((u) => ({ id: u.id, name: u.name, hint: u.hint })),
  ];
  const where = recordLabel ? `「${recordLabel}」` : "这条记录";
  return (
    <Panel
      title={title}
      description={owner ? `负责人：${owner.subject.name}` : "暂无负责人（公海）"}
      className="aui-access-team"
      actions={
        <>
          {canTransfer && onTransferOwner && (
            <Button variant="outline" disabled={loading || !!error} onClick={() => setTransfer({ to: "", keep: "editor", reason: "" })}>
              <ArrowRightLeft size={15} aria-hidden="true" />
              {owner ? "转移负责人" : "指定负责人"}
            </Button>
          )}
          {canManage && onAdd && (
            <Button disabled={!manage} onClick={() => setAdding({ kind: subjectTypes[0] ?? "user", users: [], level: "viewer", expires: "", reason: "" })}>
              <UserPlus size={15} aria-hidden="true" />
              添加成员
            </Button>
          )}
        </>
      }
    >
      {!canManage && <p className="aui-note aui-access-readonly-note">你只能查看协作成员，不能修改。</p>}
      <DataTable rowHeight="medium"
        caption={`${title}${recordLabel ? `：${recordLabel}` : ""}`}
        rows={sorted}
        rowKey={(m) => m.id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyLabel="还没有协作成员"
        pagination={{ mode: "all" }}
        columns={[
          { key: "who", title: "成员", minWidth: 180, render: (m) => <CellText primary={m.subject.name} secondary={[GRANT_SUBJECT_LABEL[m.subject.type], m.subject.hint].filter(Boolean).join(" · ")} /> },
          { key: "level", title: "权限", width: 110, render: (m) => <StatusBadge tone={m.level === "owner" ? "brand" : m.level === "editor" ? "success" : "neutral"}>{RECORD_LEVEL_LABEL[m.level]}</StatusBadge> },
          { key: "expires", title: "到期", width: 120, render: (m) => (m.level === "owner" ? <span className="aui-note">—</span> : <ExpiryBadge expiresAt={m.expiresAt} now={now} />) },
          {
            key: "from",
            title: "来源",
            minWidth: 160,
            maxWidth: 280,
            truncate: (m) => (m.inheritedFrom ? `继承自 ${m.inheritedFrom}` : [m.grantedBy && `${m.grantedBy} 授予`, m.reason].filter(Boolean).join(" · ") || "—"),
            render: (m) => (m.inheritedFrom ? `继承自 ${m.inheritedFrom}` : [m.grantedBy && `${m.grantedBy} 授予`, m.reason].filter(Boolean).join(" · ") || "—"),
          },
          {
            key: "actions",
            title: "操作",
            kind: "actions",
            render: (m) => {
              if (m.level === "owner" || !canManage) return null;
              // Inherited members are changed on the parent record; while loading / after an error nothing can be changed.
              const blocked = m.inheritedFrom ? `继承自 ${m.inheritedFrom}，在上级记录修改` : !manage ? (error ? "成员没有加载成功，先重试" : "成员还在加载") : undefined;
              const actions: RowAction[] = [];
              if (onUpdate) actions.push({ key: "edit", label: "修改", icon: <Pencil />, disabled: !!blocked, disabledReason: blocked, onSelect: () => setEditing({ member: m, level: m.level as Editable, expires: toLocal(m.expiresAt) }) });
              // 移除 opens a confirm dialog; it is the row's main action next to 修改, so it stays inline.
              if (onRemove) actions.push({ key: "remove", label: "移除", icon: <UserMinus />, destructive: true, menuOnly: false, disabled: !!blocked, disabledReason: blocked, onSelect: () => setRemoving(m) });
              return actions.length ? <RowActionBar label={`${m.subject.name}的更多操作`} actions={actions} /> : null;
            },
          },
        ]}
      />
      <FormDialog
        open={adding !== null}
        title="添加协作成员"
        description={`给${where}添加查看者或编辑者。负责人只能通过「转移负责人」更换。`}
        size="lg"
        dirty={!!adding && (adding.users.length > 0 || !!adding.reason)}
        submitLabel={adding?.kind === "user" && adding.users.length ? `添加 ${adding.users.length} 人` : "添加"}
        onClose={() => setAdding(null)}
        onSubmit={async () => {
          if (!adding || !onAdd) return;
          // 原因必填（服务端也要求）：先在页面上拦，别让「reason 不能为空」这种话出现
          if (!adding.reason.trim()) throw new Error("请填写原因（写进审计日志）");
          const expiresAt = toIso(adding.expires);
          const common = { level: adding.level, expiresAt, reason: adding.reason.trim() };
          if (adding.kind === "everyone") {
            await onAdd([{ subject: { type: "everyone", id: EVERYONE_ID, name: GRANT_SUBJECT_LABEL.everyone }, ...common }]);
            return;
          }
          if (!adding.users.length) throw new Error(adding.kind === "user" ? "请至少选择一位成员" : adding.kind === "group" ? "请至少选择一个用户组" : "请至少选择一个部门");
          const byId = new Map<string, { name: string; hint?: string }>(adding.kind === "user" ? candidates.map((u) => [u.id, u]) : adding.kind === "group" ? groups.map((g) => [g.id, g]) : []);
          const deptPath = orgTree ? indexTree(orgTree) : null;
          await onAdd(
            adding.users.map((id) => ({
              subject: { type: adding.kind, id, name: adding.kind === "dept" ? (deptPath ? fullPath(deptPath, id) : id) : (byId.get(id)?.name ?? id), hint: byId.get(id)?.hint },
              ...common,
            })),
          );
        }}
      >
        {adding && (
          <>
            {kinds.length > 1 && (
              <FormField label="添加谁" htmlFor={`${ids}-add-kind`}>
                <SegmentedControl label="添加谁" value={adding.kind} options={kinds.map((k) => ({ value: k, label: GRANT_SUBJECT_LABEL[k] }))} onValueChange={(kind) => setAdding((a) => a && { ...a, kind, users: [] })} />
              </FormField>
            )}
            {adding.kind === "user" && <UserTransfer orgTree={orgTree} users={addable} value={adding.users} onChange={(users) => setAdding((a) => a && { ...a, users })} />}
            {adding.kind === "group" && (
              <CheckableTree label="用户组" nodes={groups.filter((g) => !existing.has(`group:${g.id}`)).map((g) => ({ id: g.id, label: g.name, hint: g.hint }))} value={adding.users} linked={false} onValueChange={(users) => setAdding((a) => a && { ...a, users })} maxHeight={260} emptyLabel="没有可添加的用户组" />
            )}
            {adding.kind === "dept" && (orgTree ? <CheckableTree label="部门" nodes={orgTree} value={adding.users} linked={false} onValueChange={(users) => setAdding((a) => a && { ...a, users })} maxHeight={260} /> : <p className="aui-note">没有提供部门树。</p>)}
            {adding.kind === "everyone" && <InlineAlert tone="warning" title="所有人">{`所有登录的人都会成为${where}的${RECORD_LEVEL_LABEL[adding.level]}。只在确实要公开时用。`}</InlineAlert>}
            <div className="aui-access-form-row">
              <FormField label="权限" htmlFor={`${ids}-add-level`}>
                <SegmentedControl label="权限" value={adding.level} options={LEVEL_OPTIONS} onValueChange={(level) => setAdding((a) => a && { ...a, level })} />
              </FormField>
              <FormField label="到期时间" htmlFor={`${ids}-add-exp`} hint="留空 = 永久；到期后立即失效">
                <DateTimePicker id={`${ids}-add-exp`} clearable value={adding.expires} onChange={(v) => setAdding((a) => a && { ...a, expires: v })} />
              </FormField>
            </div>
            <QuickDatePresets permanent onPick={(expires) => setAdding((a) => a && { ...a, expires })} now={now ? () => now : undefined} />
            <FormField label="原因" htmlFor={`${ids}-add-reason`} required hint="写进审计日志">
              <Textarea id={`${ids}-add-reason`} value={adding.reason} onChange={(e) => setAdding((a) => a && { ...a, reason: e.target.value })} />
            </FormField>
          </>
        )}
      </FormDialog>
      <FormDialog
        open={editing !== null}
        title={`修改 ${editing?.member.subject.name ?? ""} 的权限`}
        description="改动保存后立即生效。"
        dirty={!!editing && (editing.level !== editing.member.level || editing.expires !== toLocal(editing.member.expiresAt))}
        onClose={() => setEditing(null)}
        onSubmit={async () => {
          if (!editing || !onUpdate) return;
          await onUpdate(editing.member, { level: editing.level, expiresAt: toIso(editing.expires) });
        }}
      >
        {editing && (
          <>
            <FormField label="权限" htmlFor={`${ids}-edit-level`}>
              <SegmentedControl label="权限" value={editing.level} options={LEVEL_OPTIONS} onValueChange={(level) => setEditing((e) => e && { ...e, level })} />
            </FormField>
            <FormField label="到期时间" htmlFor={`${ids}-edit-exp`} hint="留空 = 永久">
              <DateTimePicker id={`${ids}-edit-exp`} clearable value={editing.expires} onChange={(v) => setEditing((x) => x && { ...x, expires: v })} />
            </FormField>
            <QuickDatePresets permanent onPick={(expires) => setEditing((e) => e && { ...e, expires })} now={now ? () => now : undefined} />
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={removing !== null}
        title="移除协作成员"
        destructive
        confirmLabel="移除"
        impact={removing ? `${removing.subject.name} 将不能再${removing.level === "editor" ? "查看和编辑" : "查看"}${where}，立即生效。` : undefined}
        reason={{ label: "移除原因", required: true }}
        onClose={() => setRemoving(null)}
        onConfirm={async (reason) => {
          if (removing && onRemove) await onRemove(removing, reason);
        }}
      />
      <FormDialog
        open={transfer !== null}
        title={owner ? "转移负责人" : "指定负责人"}
        description="新负责人拥有全部权限；转移在服务端一步完成（不会出现两个负责人或没有负责人）。"
        dirty={!!transfer && (!!transfer.to || !!transfer.reason)}
        submitLabel="确认转移"
        onClose={() => setTransfer(null)}
        onSubmit={async () => {
          if (!transfer || !onTransferOwner) return;
          if (!transfer.to) throw new Error("请选择新负责人");
          if (!transfer.reason.trim()) throw new Error("请填写转移原因");
          await onTransferOwner({ toUserId: transfer.to, keepPreviousAs: transfer.keep === "none" ? null : transfer.keep, reason: transfer.reason.trim() });
        }}
      >
        {transfer && (
          <>
            {transferTargets.length === 0 && <InlineAlert tone="warning" title="没有可选的人">先把对方加为协作成员，或由宿主提供候选人。</InlineAlert>}
            <FormField label="新负责人" htmlFor={`${ids}-transfer-to`} required>
              <Choice label="新负责人" value={transfer.to} placeholder="选择成员" options={transferTargets.map((t) => ({ value: t.id, label: t.hint ? `${t.name}（${t.hint}）` : t.name }))} onChange={(to) => setTransfer((t) => t && { ...t, to })} />
            </FormField>
            {owner && (
              <FormField label={`原负责人 ${owner.subject.name}`} htmlFor={`${ids}-transfer-keep`}>
                <SegmentedControl
                  label="原负责人保留为"
                  value={transfer.keep}
                  options={[{ value: "editor", label: "保留为编辑者" }, { value: "viewer", label: "保留为查看者" }, { value: "none", label: "不保留" }]}
                  onValueChange={(keep) => setTransfer((t) => t && { ...t, keep })}
                />
              </FormField>
            )}
            <FormField label="原因" htmlFor={`${ids}-transfer-reason`} required hint="写进审计日志">
              <Textarea id={`${ids}-transfer-reason`} value={transfer.reason} onChange={(e) => setTransfer((t) => t && { ...t, reason: e.target.value })} />
            </FormField>
          </>
        )}
      </FormDialog>
    </Panel>
  );
}
