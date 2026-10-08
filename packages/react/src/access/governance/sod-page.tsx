"use client";
/**
 * SodRulesPage — separation of duties: pairs of permissions / roles one person must not hold together
 * (block) or may only hold with approval (approve), plus who violates a rule right now. Built-in
 * rules (written in code) are read-only.
 */
import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Choice, Input, StatusBadge, Switch } from "../../primitives.tsx";
import { SegmentedControl } from "../../choices.tsx";
import { ConfirmDialog, FormDialog, FormField } from "../../forms.tsx";
import { InlineAlert, PageBody, PageHeader, ResourcePanel } from "../../layout.tsx";
import { DataTable } from "../../data.tsx";
import { CellText } from "../../cells.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import { SOD_MODE_LABEL, type GovOption, type SodMode, type SodRuleDto, type SodRuleInput, type SodViolationDto } from "./contracts.ts";
import { govErrorMessage } from "./api.ts";
import { GovLoad, feedbackOf, staleAlert, ReadOnlyNote, optionLabeler, toChoice, useGov, useNotice, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type SodRulesPageProps = GovPageBaseProps & {
  /** Permission codes / roles that can appear in a rule (code → label). Free text when omitted. */
  codes?: readonly GovOption[];
  can?: { manage?: boolean };
};

type Draft = { label: string; a: string; b: string; mode: SodMode; enabled: boolean };

export function SodRulesPage({ api, codes, can = {}, active = true }: SodRulesPageProps) {
  const rules = useGov<SodRuleDto[]>("gov:sod", (signal) => api.sodRules.list({ signal }), active);
  const violations = useGov<SodViolationDto[]>("gov:sod:violations", (signal) => api.sodRules.violations({ signal }), active);
  const [editing, setEditing] = useState<{ rule: SodRuleDto | null } | null>(null);
  const [removing, setRemoving] = useState<SodRuleDto | null>(null);
  const [notice, setNotice] = useNotice();
  const manage = !!can.manage;
  const code = optionLabeler(codes);
  const refresh = () => {
    void rules.refresh();
    void violations.refresh();
  };
  const pair = (a: string, b: string) => `${code(a)} ＋ ${code(b)}`;

  return (
    <>
      <PageHeader
        title="职责分离"
        description="同一个人不能同时持有的两项权限（例如「付款」和「审批付款」）。「禁止」直接拒绝分配；「需审批」要走申请。规则是后加的，已经同时持有的人列在下面。"
        actions={manage && <Button onClick={() => setEditing({ rule: null })}><Plus />新建规则</Button>}
      />
      <PageBody>
        {!manage && <ReadOnlyNote permission="共享 / 收窄 / 职责分离规则 · 修改" />}
        <ResourcePanel
          title="职责分离规则"
          count={rules.data?.length}
          actions={<Button variant="outline" disabled={rules.loading} onClick={refresh}>刷新</Button>}
          feedback={feedbackOf(notice, staleAlert(rules))}
        >
          <GovLoad res={rules} label="规则">
            {(list) => (
              <DataTable rowHeight="medium"
                caption="职责分离规则"
                rows={list}
                rowKey={(r) => r.id}
                pagination={{ mode: "all" }}
                emptyLabel="还没有职责分离规则"
                emptyAction={manage ? <Button onClick={() => setEditing({ rule: null })}>新建规则</Button> : undefined}
                columns={[
                  { key: "label", title: "规则", minWidth: 160, maxWidth: 260, truncate: (r) => r.label, render: (r) => r.label },
                  { key: "pair", title: "不能同时持有", minWidth: 220, render: (r) => <CellText primary={pair(r.a, r.b)} secondary={`${r.a} ＋ ${r.b}`} /> },
                  { key: "mode", title: "处理方式", width: 140, render: (r) => <StatusBadge tone={r.mode === "block" ? "danger" : "warning"}>{SOD_MODE_LABEL[r.mode]}</StatusBadge> },
                  {
                    key: "state",
                    title: "状态",
                    width: 120,
                    render: (r) => (
                      <span className="aui-gov-badges">
                        {r.builtin && <StatusBadge tone="neutral">内置</StatusBadge>}
                        <StatusBadge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "启用" : "停用"}</StatusBadge>
                      </span>
                    ),
                  },
                  {
                    key: "ops",
                    title: "操作",
                    kind: "actions",
                    render: (r) =>
                      manage ? (
                        <RowActionBar
                          label={`${r.label}的更多操作`}
                          actions={[
                            { key: "edit", label: "编辑", icon: <Pencil />, disabled: r.builtin, disabledReason: r.builtin ? "内置规则写在代码里，不能在后台改" : undefined, onSelect: () => setEditing({ rule: r }) },
                            ...(r.builtin ? [] : [{ key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setRemoving(r) }]),
                          ]}
                        />
                      ) : null,
                  },
                ]}
              />
            )}
          </GovLoad>
        </ResourcePanel>
        <ResourcePanel title="当前违反规则的人" count={violations.data?.length} description="规则是后加的、或绕过了服务直接改库时会出现。请收回其中一项。" feedback={feedbackOf(staleAlert(violations))}>
          <GovLoad res={violations} label="违规名单">
            {(list) =>
              list.length ? (
                <DataTable rowHeight="medium"
                  caption="当前违反职责分离的人"
                  rows={list}
                  rowKey={(v) => `${v.userId}:${v.rule.id}`}
                  pagination={{ mode: "all" }}
                  columns={[
                    { key: "who", title: "人员", minWidth: 120, render: (v) => <CellText primary={v.name} secondary={v.userId} /> },
                    { key: "rule", title: "违反的规则", minWidth: 160, render: (v) => v.rule.label },
                    { key: "pair", title: "同时持有", minWidth: 200, render: (v) => pair(v.rule.a, v.rule.b) },
                    { key: "mode", title: "处理方式", width: 140, render: (v) => <StatusBadge tone={v.rule.mode === "block" ? "danger" : "warning"}>{SOD_MODE_LABEL[v.rule.mode]}</StatusBadge> },
                  ]}
                />
              ) : (
                <div className="aui-gov-pad"><InlineAlert tone="success" title="没有人违反职责分离规则" /></div>
              )
            }
          </GovLoad>
        </ResourcePanel>
      </PageBody>
      {editing && (
        <SodEditor
          rule={editing.rule}
          codes={codes}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              const saved = editing.rule ? await api.sodRules.update(editing.rule.id, input) : await api.sodRules.create(input);
              setNotice(`已保存「${saved.label}」`);
              refresh();
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title="删除职责分离规则"
        destructive
        confirmLabel="删除"
        impact={removing ? `删除「${removing.label}」后，同一个人可以同时持有 ${pair(removing.a, removing.b)}。` : undefined}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api.sodRules.remove(removing.id);
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`已删除「${removing.label}」`);
          refresh();
        }}
      />
    </>
  );
}

function SodEditor({ rule, codes, onClose, onSave }: { rule: SodRuleDto | null; codes?: readonly GovOption[]; onClose: () => void; onSave: (input: SodRuleInput) => Promise<void> }) {
  const id = useId();
  const initial: Draft = { label: rule?.label ?? "", a: rule?.a ?? "", b: rule?.b ?? "", mode: rule?.mode ?? "block", enabled: rule?.enabled ?? true };
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const picker = (key: "a" | "b", label: string) =>
    codes?.length ? (
      <Choice label={label} placeholder="选择权限或角色" value={d[key]} onChange={(v) => set(key === "a" ? { a: v } : { b: v })} options={toChoice(codes)} />
    ) : (
      <Input id={`${id}-${key}`} value={d[key]} placeholder="例：finance:pay" onChange={(e) => set(key === "a" ? { a: e.target.value.trim() } : { b: e.target.value.trim() })} />
    );
  return (
    <FormDialog
      open
      title={rule ? `编辑「${rule.label}」` : "新建职责分离规则"}
      description="选两项不能由同一个人同时持有的权限或角色。"
      dirty={dirty}
      onClose={onClose}
      onSubmit={async () => {
        const e: Record<string, string> = {};
        if (!d.label.trim()) e.label = "请填写名称";
        if (!d.a) e.a = "请选择第一项";
        if (!d.b) e.b = "请选择第二项";
        if (d.a && d.a === d.b) e.b = "两项不能相同";
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onSave({ ...(rule ? { id: rule.id, version: rule.version } : {}), label: d.label.trim(), a: d.a, b: d.b, mode: d.mode, enabled: d.enabled });
      }}
    >
      <FormField label="名称" htmlFor={`${id}-label`} required error={errors.label}>
        <Input id={`${id}-label`} value={d.label} placeholder="例：付款与审批付款分离" onChange={(e) => set({ label: e.target.value })} />
      </FormField>
      <FormField label="第一项" htmlFor={`${id}-a`} required error={errors.a}>
        {picker("a", "第一项")}
      </FormField>
      <FormField label="第二项" htmlFor={`${id}-b`} required error={errors.b}>
        {picker("b", "第二项")}
      </FormField>
      <FormField label="处理方式" htmlFor={`${id}-mode`}>
        <SegmentedControl className="aui-gov-seg" label="处理方式" size="sm" value={d.mode} onValueChange={(mode) => set({ mode })} options={[{ value: "block", label: SOD_MODE_LABEL.block }, { value: "approve", label: SOD_MODE_LABEL.approve }]} />
      </FormField>
      <label className="aui-gov-check">
        <Switch checked={d.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label="启用这条规则" />
        启用这条规则
      </label>
    </FormDialog>
  );
}
