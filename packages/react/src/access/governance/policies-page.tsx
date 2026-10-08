"use client";
/**
 * ApprovalPoliciesPage — which approval chain a request goes through: target (kind + optional id,
 * "*" = fallback), ordered steps (直属上级 / 部门负责人 / 角色持有人 / 记录负责人 / 指定人员), the
 * longest grant and a priority. Steps are edited in a table: add, reorder, remove.
 */
import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Choice, Input, StatusBadge, Switch } from "../../primitives.tsx";
import { ChipGroup } from "../../choices.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../../forms.tsx";
import { PageBody, PageHeader, ResourcePanel } from "../../layout.tsx";
import { DataTable } from "../../data.tsx";
import { CellText } from "../../cells.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import {
  APPROVAL_STEP_LABEL,
  REQUEST_TARGET_LABEL,
  type ApprovalPolicyDto,
  type ApprovalPolicyInput,
  type ApprovalStep,
  type ApprovalStepKind,
  type GovOption,
  type GovRequestTargetKind,
} from "./contracts.ts";
import { moveStep, stepsText, validatePolicy } from "./request-core.ts";
import { govErrorMessage } from "./api.ts";
import { GovLoad, feedbackOf, staleAlert, ReadOnlyNote, optionLabeler, toChoice, useGov, useNotice, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type ApprovalPoliciesPageProps = GovPageBaseProps & {
  roles?: readonly GovOption[];
  users?: readonly GovOption[];
  depts?: readonly GovOption[];
  /** Targets a policy can be bound to, per kind (role / permission). Free text when omitted. */
  targets?: { role?: readonly GovOption[]; permission?: readonly GovOption[]; record?: readonly GovOption[] };
  can?: { manage?: boolean };
};

/** Radix Select items cannot have "" as value: sentinel for「全部 / 默认」. */
const ANY = "*any";
type StepRow = ApprovalStep & { key: string };
let stepSeq = 0;
const stepRow = (s: ApprovalStep): StepRow => ({ ...s, key: `s${++stepSeq}` });

export function ApprovalPoliciesPage({ api, roles, users, depts, targets = {}, can = {}, active = true }: ApprovalPoliciesPageProps) {
  const res = useGov<ApprovalPolicyDto[]>("gov:policies", (signal) => api.approvalPolicies.list({ signal }), active);
  const [editing, setEditing] = useState<{ policy: ApprovalPolicyDto | null } | null>(null);
  const [removing, setRemoving] = useState<ApprovalPolicyDto | null>(null);
  const [notice, setNotice] = useNotice();
  const manage = !!can.manage;
  const label = optionLabeler(roles, users, depts, targets.role, targets.permission, targets.record);
  const named = (_kind: string, id: string) => label(id);
  const targetText = (p: ApprovalPolicyDto) => (p.targetKind === "*" ? "全部申请（兜底）" : `${REQUEST_TARGET_LABEL[p.targetKind]}：${p.targetId ? label(p.targetId) : "全部"}`);
  const sorted = [...(res.data ?? [])].sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label, "zh-CN"));

  return (
    <>
      <PageHeader
        title="审批流程"
        description="申请权限时按优先级找第一条匹配的流程，逐级审批；都不匹配时用「全部申请（兜底）」。最长天数会截短申请的期限。"
        actions={manage && <Button onClick={() => setEditing({ policy: null })}><Plus />新建流程</Button>}
      />
      <PageBody>
        {!manage && <ReadOnlyNote permission="权限申请 · 查看全部 / 收回 / 审批流配置" />}
        <ResourcePanel
          title="审批流程"
          count={res.data?.length}
          actions={<Button variant="outline" disabled={res.loading} onClick={() => void res.refresh()}>刷新</Button>}
          feedback={feedbackOf(notice, staleAlert(res))}
        >
          <GovLoad res={res} label="审批流程">
            {() => (
              <DataTable
                caption="审批流程"
                rows={sorted}
                rowKey={(p) => p.id}
                pagination={{ mode: "all" }}
                emptyLabel="还没有审批流程：所有申请都会被拒绝或按服务端默认处理"
                emptyAction={manage ? <Button onClick={() => setEditing({ policy: null })}>新建流程</Button> : undefined}
                columns={[
                  { key: "label", title: "流程", minWidth: 160, maxWidth: 240, render: (p) => <CellText primary={p.label} secondary={targetText(p)} /> },
                  { key: "steps", title: "审批链", minWidth: 220, maxWidth: 360, truncate: (p) => stepsText(p.steps, named), render: (p) => stepsText(p.steps, named) },
                  { key: "max", title: "最长天数", width: 100, numeric: true, render: (p) => (p.maxDays === null ? "不限" : `${p.maxDays} 天`) },
                  { key: "priority", title: "优先级", width: 80, numeric: true, render: (p) => p.priority },
                  { key: "state", title: "状态", width: 90, render: (p) => <StatusBadge tone={p.enabled ? "success" : "neutral"}>{p.enabled ? "启用" : "停用"}</StatusBadge> },
                  {
                    key: "ops",
                    title: "操作",
                    kind: "actions",
                    render: (p) =>
                      manage ? (
                        <RowActionBar
                          label={`${p.label}的更多操作`}
                          actions={[
                            { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setEditing({ policy: p }) },
                            { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setRemoving(p) },
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
      {editing && (
        <PolicyEditor
          policy={editing.policy}
          roles={roles}
          users={users}
          depts={depts}
          targets={targets}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              const saved = editing.policy ? await api.approvalPolicies.update(editing.policy.id, input) : await api.approvalPolicies.create(input);
              setNotice(`已保存「${saved.label}」`);
              void res.refresh();
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title="删除审批流程"
        destructive
        confirmLabel="删除"
        impact={removing ? `删除「${removing.label}」后，新提交的申请改用下一条匹配的流程；已经在审批中的不受影响（以服务端规则为准）。` : undefined}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api.approvalPolicies.remove(removing.id);
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`已删除「${removing.label}」`);
          void res.refresh();
        }}
      />
    </>
  );
}

function PolicyEditor({
  policy,
  roles,
  users,
  depts,
  targets,
  onClose,
  onSave,
}: {
  policy: ApprovalPolicyDto | null;
  roles?: readonly GovOption[];
  users?: readonly GovOption[];
  depts?: readonly GovOption[];
  targets: NonNullable<ApprovalPoliciesPageProps["targets"]>;
  onClose: () => void;
  onSave: (input: ApprovalPolicyInput) => Promise<void>;
}) {
  const id = useId();
  const [labelText, setLabel] = useState(policy?.label ?? "");
  const [targetKind, setTargetKind] = useState<GovRequestTargetKind | "*">(policy?.targetKind ?? "role");
  const [targetId, setTargetId] = useState(policy?.targetId ?? "");
  const [steps, setSteps] = useState<StepRow[]>(() => (policy?.steps.length ? policy.steps : [{ kind: "manager" as const }]).map(stepRow));
  const [maxDays, setMaxDays] = useState(policy?.maxDays === null || policy?.maxDays === undefined ? "" : String(policy.maxDays));
  const [priority, setPriority] = useState(String(policy?.priority ?? 0));
  const [enabled, setEnabled] = useState(policy?.enabled ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const snapshot = () => JSON.stringify([labelText, targetKind, targetId, steps.map(({ key: _k, ...s }) => s), maxDays, priority, enabled]);
  const [initial] = useState(snapshot);
  const dirty = snapshot() !== initial;
  const setStep = (key: string, patch: Partial<ApprovalStep>) => setSteps((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const targetOptions = targetKind === "*" ? [] : (targets[targetKind] ?? []);
  const toInput = (): ApprovalPolicyInput => ({
    ...(policy ? { id: policy.id, version: policy.version } : {}),
    label: labelText.trim(),
    targetKind,
    targetId: targetKind === "*" || !targetId ? null : targetId,
    steps: steps.map(({ key: _k, ...s }) => clean(s)),
    maxDays: maxDays.trim() ? Number(maxDays) : null,
    priority: priority.trim() ? Number(priority) : 0,
    enabled,
  });
  return (
    <FormDialog
      open
      size="lg"
      title={policy ? `编辑「${policy.label}」` : "新建审批流程"}
      description="按顺序逐级审批；每一级里任何一个候选人批准即可进入下一级。"
      dirty={dirty}
      onClose={onClose}
      onSubmit={async () => {
        const input = toInput();
        const e = validatePolicy(input);
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onSave(input);
      }}
    >
      <div className="aui-gov-form">
        <FormField label="名称" htmlFor={`${id}-label`} required error={errors.label}>
          <Input id={`${id}-label`} value={labelText} placeholder="例：财务角色需财务总监审批" onChange={(e) => setLabel(e.target.value)} />
        </FormField>
        <FormField label="适用于" htmlFor={`${id}-kind`}>
          <Choice
            label="适用于"
            value={targetKind}
            onChange={(v) => {
              setTargetKind(v as GovRequestTargetKind | "*");
              setTargetId("");
            }}
            options={[{ value: "role", label: "申请角色" }, { value: "permission", label: "申请单项权限" }, { value: "record", label: "申请记录权限" }, { value: "*", label: "全部申请（兜底）" }]}
          />
        </FormField>
        {targetKind !== "*" && (
          <FormField label={`具体${REQUEST_TARGET_LABEL[targetKind]}`} htmlFor={`${id}-target`} hint="不选 = 这一类全部">
            {targetOptions.length ? (
              <Choice label={`具体${REQUEST_TARGET_LABEL[targetKind]}`} value={targetId || ANY} onChange={(v) => setTargetId(v === ANY ? "" : v)} options={[{ value: ANY, label: "全部" }, ...toChoice(targetOptions)]} />
            ) : (
              <Input id={`${id}-target`} value={targetId} placeholder="留空 = 全部" onChange={(e) => setTargetId(e.target.value.trim())} />
            )}
          </FormField>
        )}
        <FormField label="最长批多少天" htmlFor={`${id}-max`} error={errors.maxDays} hint="留空 = 不限；申请永久的会被截到这个天数">
          <Input id={`${id}-max`} inputMode="numeric" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
        </FormField>
        <FormField label="优先级" htmlFor={`${id}-pri`} error={errors.priority} hint="数字大的先匹配">
          <Input id={`${id}-pri`} inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </FormField>
        <label className="aui-gov-check">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="启用这个流程" />
          启用这个流程
        </label>
      </div>
      <section className="aui-gov-steps" aria-label="审批步骤">
        <h3 className="aui-gov-subtitle">审批步骤</h3>
        {errors.steps && <p className="aui-error" role="alert">{errors.steps}</p>}
        <DataTable
          caption="审批步骤"
          rows={steps}
          rowKey={(s) => s.key}
          rowHeight="auto"
          pagination={{ mode: "all" }}
          emptyLabel="至少要有一级审批"
          columns={[
            { key: "n", title: "级", width: 48, render: (s) => `${steps.indexOf(s) + 1}` },
            {
              key: "kind",
              title: "审批人",
              minWidth: 150,
              render: (s) => (
                <Choice
                  label={`第 ${steps.indexOf(s) + 1} 级 · 审批人`}
                  value={s.kind}
                  onChange={(v) => setStep(s.key, { kind: v as ApprovalStepKind, roleId: undefined, deptId: undefined, userIds: undefined })}
                  options={(Object.keys(APPROVAL_STEP_LABEL) as ApprovalStepKind[]).map((k) => ({ value: k, label: APPROVAL_STEP_LABEL[k] }))}
                />
              ),
            },
            {
              key: "who",
              title: "具体是谁",
              minWidth: 200,
              render: (s) => {
                const n = steps.indexOf(s) + 1;
                const err = errors[`step.${n - 1}`];
                const body =
                  s.kind === "role_holder" ? (
                    roles?.length ? <Choice label={`第 ${n} 级 · 角色`} placeholder="选择角色" value={s.roleId ?? ""} onChange={(v) => setStep(s.key, { roleId: v })} options={toChoice(roles)} /> : <Input aria-label={`第 ${n} 级 · 角色编号`} placeholder="角色编号" value={s.roleId ?? ""} onChange={(e) => setStep(s.key, { roleId: e.target.value.trim() })} />
                  ) : s.kind === "dept_leader" ? (
                    depts?.length ? <Choice label={`第 ${n} 级 · 部门`} value={s.deptId ?? ANY} onChange={(v) => setStep(s.key, { deptId: v === ANY ? undefined : v })} options={[{ value: ANY, label: "申请人所在部门" }, ...toChoice(depts)]} /> : <Input aria-label={`第 ${n} 级 · 部门编号`} placeholder="留空 = 申请人所在部门" value={s.deptId ?? ""} onChange={(e) => setStep(s.key, { deptId: e.target.value.trim() || undefined })} />
                  ) : s.kind === "user" ? (
                    users?.length && users.length <= 12 ? (
                      <ChipGroup label={`第 ${n} 级 · 审批人`} value={[...(s.userIds ?? [])]} onValueChange={(v) => setStep(s.key, { userIds: v })} options={users.map((u) => ({ value: u.id, label: u.label }))} />
                    ) : (
                      <Input aria-label={`第 ${n} 级 · 审批人编号`} placeholder="编号，多个用逗号隔开" value={(s.userIds ?? []).join(", ")} onChange={(e) => setStep(s.key, { userIds: e.target.value.split(/[,，\s]+/).filter(Boolean) })} />
                    )
                  ) : (
                    <span className="aui-note">{s.kind === "manager" ? "申请人的直属上级" : "这条记录的负责人"}</span>
                  );
                return (
                  <div className="aui-gov-step-who">
                    {body}
                    {err && <p className="aui-error" role="alert">{err}</p>}
                  </div>
                );
              },
            },
            { key: "label", title: "显示名（可不填）", minWidth: 140, render: (s) => <Input aria-label={`第 ${steps.indexOf(s) + 1} 级 · 显示名`} value={s.label ?? ""} placeholder={APPROVAL_STEP_LABEL[s.kind]} onChange={(e) => setStep(s.key, { label: e.target.value || undefined })} /> },
            {
              key: "ops",
              title: "操作",
              kind: "actions",
              render: (s) => {
                const i = steps.indexOf(s);
                return (
                  <RowActionBar
                    label={`第 ${i + 1} 级的更多操作`}
                    actions={[
                      { key: "up", label: "上移", ariaLabel: `第 ${i + 1} 级上移`, icon: <ArrowUp />, disabled: i === 0, disabledReason: "已经是第一级", onSelect: () => setSteps((l) => moveStep(l, i, -1)) },
                      { key: "down", label: "下移", ariaLabel: `第 ${i + 1} 级下移`, icon: <ArrowDown />, disabled: i === steps.length - 1, disabledReason: "已经是最后一级", onSelect: () => setSteps((l) => moveStep(l, i, 1)) },
                      // Removing a step only edits the draft (nothing is saved until 保存), so it stays inline.
                      { key: "remove", label: "删除", ariaLabel: `删除第 ${i + 1} 级`, icon: <Trash2 />, destructive: true, menuOnly: false, disabled: steps.length === 1, disabledReason: "至少要留一级审批", onSelect: () => setSteps((l) => l.filter((x) => x.key !== s.key)) },
                    ]}
                  />
                );
              },
            },
          ]}
        />
        <div>
          <Button size="sm" variant="outline" onClick={() => setSteps((l) => [...l, stepRow({ kind: "manager" })])}>
            <Plus />
            加一级
          </Button>
        </div>
      </section>
    </FormDialog>
  );
}

/** Drop the fields the step kind does not use (so switching kinds leaves nothing stale). */
function clean(s: ApprovalStep): ApprovalStep {
  const base: ApprovalStep = { kind: s.kind, ...(s.label ? { label: s.label } : {}) };
  if (s.kind === "role_holder" && s.roleId) base.roleId = s.roleId;
  if (s.kind === "dept_leader" && s.deptId) base.deptId = s.deptId;
  if (s.kind === "user" && s.userIds?.length) base.userIds = [...s.userIds];
  return base;
}
