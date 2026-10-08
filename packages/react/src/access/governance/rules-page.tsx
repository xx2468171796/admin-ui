"use client";
/**
 * ShareRulesPage / RestrictionRulesPage — data rules stored in the database. Editing goes
 * draft →「预览影响」(who sees more / fewer rows) → 保存; any change after a preview disables 保存
 * until previewed again. Built-in restriction rules (written in code) are read-only. Deleting also
 * previews its impact first.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge, Switch } from "../../primitives.tsx";
import { ChipGroup, QuickDatePresets, SegmentedControl } from "../../choices.tsx";
import { DateTimePicker } from "../../date-picker.tsx";
import { ConfirmDialog, Dialog, FormField } from "../../forms.tsx";
import { InlineAlert, PageBody, PageHeader, ResourcePanel } from "../../layout.tsx";
import { DataTable, QueryBar, type Column } from "../../data.tsx";
import { CellText } from "../../cells.tsx";
import { CellDate } from "../../displays.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import { ExpiryBadge } from "../record-team.tsx";
import { isoToLocalInput, localInputToIso } from "../review-core.ts";
import {
  SHARE_LEVEL_LABEL,
  SUBJECT_TYPE_LABEL,
  type Cond,
  type GovOption,
  type GovResource,
  type GrantSubjectType,
  type RestrictionRuleDto,
  type RestrictionRuleInput,
  type RuleImpactDto,
  type ShareRuleDto,
  type ShareRuleInput,
} from "./contracts.ts";
import { condLabelsFrom, condToDraft, condToText, draftKey, draftToCond, emptyCondDraft, type CondDraft } from "./cond-core.ts";
import { impactSummary } from "./governance-core.ts";
import { govErrorMessage, type GovRuleCollection } from "./api.ts";
import { CondBuilder, RuleImpactView } from "./cond-builder.tsx";
import { GovLoad, feedbackOf, staleAlert, ReadOnlyNote, defaultNow, optionLabeler, toChoice, useGov, useNotice, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

type Kind = "share" | "restriction";
type AnyRule = ShareRuleDto | RestrictionRuleDto;
type Draft = {
  label: string;
  resourceType: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  level: "viewer" | "editor";
  expiresAt: string;
  actions: string[];
  exemptSuperuser: boolean;
  enabled: boolean;
  cond: CondDraft | null;
  original: Cond | null;
};

export type RuleSubjects = { user?: readonly GovOption[]; group?: readonly GovOption[]; dept?: readonly GovOption[] };
export type ShareRulesPageProps = GovPageBaseProps & {
  /** Resource types with their condition fields (the host's defineFields whitelist) and actions. */
  resources: readonly GovResource[];
  /** Who a rule can share with, per subject type. */
  subjects?: RuleSubjects;
  can?: { manage?: boolean };
};
export type RestrictionRulesPageProps = GovPageBaseProps & {
  resources: readonly GovResource[];
  /** People, to show who last changed a rule by name instead of user id. */
  users?: readonly GovOption[];
  can?: { manage?: boolean };
};

export function ShareRulesPage(props: ShareRulesPageProps) {
  return <RulesPage kind="share" {...props} />;
}
export function RestrictionRulesPage(props: RestrictionRulesPageProps) {
  return <RulesPage kind="restriction" {...props} />;
}

const isShare = (r: AnyRule): r is ShareRuleDto => "subject" in r;
const isBuiltin = (r: AnyRule) => !isShare(r) && r.builtin;

function draftOf(kind: Kind, rule: AnyRule | null, resources: readonly GovResource[]): Draft {
  const resourceType = rule?.resourceType ?? resources[0]?.id ?? "";
  const fields = resources.find((r) => r.id === resourceType)?.fields ?? [];
  const share = rule && isShare(rule) ? rule : null;
  const restriction = rule && !isShare(rule) ? rule : null;
  return {
    label: rule?.label ?? "",
    resourceType,
    subjectType: share?.subject.type ?? (kind === "share" ? "dept" : "everyone"),
    subjectId: share?.subject.id ?? "",
    level: share?.level ?? "viewer",
    expiresAt: isoToLocalInput(share?.expiresAt),
    actions: restriction?.actions ? [...restriction.actions] : [],
    exemptSuperuser: restriction?.exemptSuperuser ?? true,
    enabled: rule?.enabled ?? true,
    cond: rule ? condToDraft(rule.cond) : emptyCondDraft(fields),
    original: rule?.cond ?? null,
  };
}
const draftJson = (d: Draft) => JSON.stringify({ ...d, cond: draftKey(d.cond), original: d.cond ? null : d.original });

type Built = { ok: true; input: ShareRuleInput | RestrictionRuleInput } | { ok: false; errors: Record<string, string>; rows: Record<string, string>; condError?: string };
function build(kind: Kind, d: Draft, rule: AnyRule | null, resources: readonly GovResource[]): Built {
  const errors: Record<string, string> = {};
  const res = resources.find((r) => r.id === d.resourceType);
  if (!d.label.trim()) errors.label = "请填写规则名称";
  if (!res) errors.resourceType = "请选择资源类型";
  let cond: Cond | null = d.original;
  let rows: Record<string, string> = {};
  let condError: string | undefined;
  if (d.cond) {
    const r = draftToCond(d.cond, res?.fields ?? []);
    if (r.ok) cond = r.cond;
    else {
      rows = r.rows;
      condError = r.error;
      cond = null;
    }
  }
  if (!cond && !condError && !Object.keys(rows).length) condError = "请写条件";
  let expiresAt: string | null = null;
  if (kind === "share") {
    if (d.subjectType !== "everyone" && !d.subjectId) errors.subject = "请选择共享给谁";
    try {
      expiresAt = localInputToIso(d.expiresAt);
      if (expiresAt && Date.parse(expiresAt) <= Date.now()) errors.expiresAt = "到期时间要晚于现在";
    } catch (e) {
      errors.expiresAt = (e as Error).message;
    }
  }
  if (Object.keys(errors).length || !cond) return { ok: false, errors, rows, ...(condError ? { condError } : {}) };
  const common = { ...(rule ? { id: rule.id, version: rule.version } : {}), resourceType: d.resourceType, label: d.label.trim(), cond, enabled: d.enabled };
  const input: ShareRuleInput | RestrictionRuleInput =
    kind === "share"
      ? { ...common, subject: d.subjectType === "everyone" ? { type: "everyone" } : { type: d.subjectType, id: d.subjectId }, level: d.level, expiresAt }
      : { ...common, actions: d.actions.length ? d.actions : null, exemptSuperuser: d.exemptSuperuser };
  return { ok: true, input };
}

function RulesPage({ kind, api, resources, subjects = {}, users, can = {}, active = true, now = defaultNow }: GovPageBaseProps & { kind: Kind; resources: readonly GovResource[]; subjects?: RuleSubjects; users?: readonly GovOption[]; can?: { manage?: boolean } }) {
  const collection = (kind === "share" ? api.shareRules : api.restrictionRules) as GovRuleCollection<AnyRule, ShareRuleInput | RestrictionRuleInput>;
  const res = useGov<AnyRule[]>(`gov:rules:${kind}`, (signal) => collection.list({ signal }), active);
  const [search, setSearch] = useState("");
  const [resource, setResource] = useState("*");
  const [editing, setEditing] = useState<{ rule: AnyRule | null } | null>(null);
  const [removing, setRemoving] = useState<AnyRule | null>(null);
  const [notice, setNotice] = useNotice();
  const manage = !!can.manage;
  const resourceLabel = optionLabeler(resources);
  // updatedBy is a user id: show the person's name (falls back to the id when unknown).
  const personLabel = optionLabeler(subjects.user ?? users);
  const title = kind === "share" ? "共享规则" : "收窄规则";
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (res.data ?? []).filter((r) => {
    if (resource !== "*" && r.resourceType !== resource) return false;
    if (!words.length) return true;
    const hay = [r.label, r.condText, resourceLabel(r.resourceType), isShare(r) ? r.subject.name : ""].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const filtered = search.trim() !== "" || resource !== "*";
  const actionLabel = (resourceType: string) => optionLabeler(resources.find((r) => r.id === resourceType)?.actions);

  const columns: Column<AnyRule>[] = [
    { key: "label", title: "规则", minWidth: 180, maxWidth: 260, render: (r) => <CellText primary={r.label} secondary={resourceLabel(r.resourceType)} /> },
    kind === "share"
      ? {
          key: "subject",
          title: "共享给",
          minWidth: 150,
          render: (r) => (isShare(r) ? <CellText primary={r.subject.type === "everyone" ? "所有人" : r.subject.name} secondary={`${SUBJECT_TYPE_LABEL[r.subject.type]} · ${SHARE_LEVEL_LABEL[r.level]}`} /> : "—"),
        }
      : {
          key: "actions-scope",
          title: "限制动作",
          minWidth: 140,
          render: (r) => (!isShare(r) ? <CellText primary={r.actions?.length ? r.actions.map(actionLabel(r.resourceType)).join("、") : "全部动作"} secondary={r.exemptSuperuser ? "超级管理员不受限" : "对超级管理员也生效"} /> : "—"),
        },
    { key: "cond", title: kind === "share" ? "共享哪些记录" : "满足时禁止", minWidth: 200, maxWidth: 320, truncate: (r) => r.condText || condToText(r.cond), render: (r) => r.condText || condToText(r.cond) },
    {
      key: "state",
      title: "状态",
      width: 130,
      render: (r) => (
        <span className="aui-gov-badges">
          {isBuiltin(r) && <StatusBadge tone="neutral">内置</StatusBadge>}
          <StatusBadge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "启用" : "停用"}</StatusBadge>
          {isShare(r) && r.expiresAt && <ExpiryBadge expiresAt={r.expiresAt} now={now()} />}
        </span>
      ),
    },
    { key: "updated", title: "最后修改", width: 150, render: (r) => (r.updatedAt ? <CellText primary={<CellDate value={r.updatedAt} time />} secondary={r.updatedBy ? personLabel(r.updatedBy) : undefined} /> : <span className="aui-note">代码里定义</span>) },
    {
      key: "ops",
      title: "操作",
      kind: "actions",
      render: (r) => {
        const editable = manage && !isBuiltin(r);
        return (
          <RowActionBar
            label={`${r.label}的更多操作`}
            actions={[
              editable
                ? { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setEditing({ rule: r }) }
                : { key: "view", label: "查看", icon: <Eye />, onSelect: () => setEditing({ rule: r }) },
              ...(editable ? [{ key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setRemoving(r) }] : []),
            ]}
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        description={
          kind === "share"
            ? "按条件把一批记录共享给人 / 部门 / 用户组（在数据范围之外多看到）。保存前先预览会有谁多看到、少看到几条。"
            : "满足条件时禁止某些动作（在所有授权之后再收窄，例如「已冻结的客户不能改」）。保存前先预览影响。"
        }
        actions={manage && <Button onClick={() => setEditing({ rule: null })}><Plus />新建规则</Button>}
      />
      <PageBody>
        {!manage && <ReadOnlyNote permission="共享 / 收窄 / 职责分离规则 · 修改" />}
        <ResourcePanel
          title={`${title}列表`}
          count={res.data && !filtered ? res.data.length : undefined}
          actions={<Button variant="outline" disabled={res.loading} onClick={() => void res.refresh()}>刷新</Button>}
          filters={
            <QueryBar value={search} onChange={setSearch} onSearch={() => undefined} onReset={() => { setSearch(""); setResource("*"); }} placeholder="搜索规则名、条件、对象">
              <Choice label="资源类型" value={resource} onChange={setResource} options={[{ value: "*", label: "全部资源" }, ...resources.map((r) => ({ value: r.id, label: r.label }))]} />
            </QueryBar>
          }
          feedback={feedbackOf(notice, staleAlert(res))}
        >
          <GovLoad res={res} label={title}>
            {() => (
              <DataTable rowHeight="medium"
                caption={`${title}列表`}
                rows={rows}
                rowKey={(r) => r.id}
                columns={columns}
                pagination={{ mode: "all" }}
                emptyKind={filtered ? "no-results" : "empty"}
                emptyLabel={filtered ? "没有符合筛选的规则" : `还没有${title}`}
                emptyAction={filtered ? <Button variant="outline" onClick={() => { setSearch(""); setResource("*"); }}>清空筛选</Button> : manage ? <Button onClick={() => setEditing({ rule: null })}>新建规则</Button> : undefined}
              />
            )}
          </GovLoad>
        </ResourcePanel>
      </PageBody>
      {editing && (
        <RuleEditor
          kind={kind}
          rule={editing.rule}
          resources={resources}
          subjects={subjects}
          readOnly={!manage || (editing.rule ? isBuiltin(editing.rule) : false)}
          collection={collection}
          now={now}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setNotice(`已保存「${saved.label}」`);
            void res.refresh();
          }}
        />
      )}
      <DeleteRule
        rule={removing}
        collection={collection}
        onClose={() => setRemoving(null)}
        onDeleted={(r) => {
          setNotice(`已删除「${r.label}」`);
          void res.refresh();
        }}
      />
    </>
  );
}

function RuleEditor({
  kind,
  rule,
  resources,
  subjects,
  readOnly,
  collection,
  now,
  onClose,
  onSaved,
}: {
  kind: Kind;
  rule: AnyRule | null;
  resources: readonly GovResource[];
  subjects: RuleSubjects;
  readOnly: boolean;
  collection: GovRuleCollection<AnyRule, ShareRuleInput | RestrictionRuleInput>;
  now: () => Date;
  onClose: () => void;
  onSaved: (rule: AnyRule) => void;
}) {
  const id = useId();
  const initial = useMemo(() => draftOf(kind, rule, resources), [kind, rule, resources]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [shown, setShown] = useState<{ errors: Record<string, string>; rows: Record<string, string>; condError?: string }>({ errors: {}, rows: {} });
  const [impact, setImpact] = useState<{ key: string; dto: RuleImpactDto } | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "save">("");
  const [failure, setFailure] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const res = resources.find((r) => r.id === draft.resourceType);
  const fields = res?.fields ?? [];
  const built = build(kind, draft, rule, resources);
  const key = built.ok ? JSON.stringify(built.input) : "";
  const dirty = draftJson(draft) !== draftJson(initial);
  const previewed = !!impact && built.ok && impact.key === key;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const builtin = rule ? isBuiltin(rule) : false;
  const title = readOnly ? `查看${kind === "share" ? "共享" : "收窄"}规则` : rule ? `编辑「${rule.label}」` : `新建${kind === "share" ? "共享" : "收窄"}规则`;

  const requestClose = () => {
    if (busy) return;
    if (discarding) return setDiscarding(false);
    if (dirty && !readOnly) setDiscarding(true);
    else onClose();
  };
  const preview = async () => {
    setFailure("");
    if (!built.ok) {
      setShown({ errors: built.errors, rows: built.rows, ...(built.condError ? { condError: built.condError } : {}) });
      return;
    }
    setShown({ errors: {}, rows: {} });
    setBusy("preview");
    try {
      const dto = await collection.preview({ ...(rule ? { id: rule.id } : {}), rule: built.input, ...(kind === "restriction" && built.input && "actions" in built.input && built.input.actions ? { actions: built.input.actions } : {}) });
      setImpact({ key, dto });
    } catch (e) {
      setFailure(govErrorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const save = async () => {
    if (!built.ok || !previewed) return;
    setBusy("save");
    setFailure("");
    try {
      const saved = rule ? await collection.update(rule.id, built.input) : await collection.create(built.input);
      onSaved(saved);
    } catch (e) {
      setFailure(govErrorMessage(e));
      setBusy("");
    }
  };
  const subjectOptions = draft.subjectType === "everyone" ? [] : toChoice(subjects[draft.subjectType]);
  const actionsOfRes = res?.actions ?? [];

  return (
    <Dialog
      open
      size="lg"
      title={discarding ? "放弃未保存的修改？" : title}
      description={discarding ? undefined : readOnly ? (builtin ? "内置规则写在代码里，这里只能查看；要改请改代码。" : "你没有修改权限，只能查看。") : "改完先点「预览影响」看谁会多看到 / 少看到，再保存。"}
      onClose={requestClose}
      footer={
        discarding ? (
          <>
            <Button variant="outline" onClick={() => setDiscarding(false)}>继续编辑</Button>
            <Button variant="destructive" onClick={onClose}>放弃修改</Button>
          </>
        ) : readOnly ? (
          <Button variant="outline" onClick={onClose}>关闭</Button>
        ) : (
          <>
            <span className="aui-note aui-gov-footer-note">{previewed ? "已预览，可以保存" : impact ? "改动后要重新预览" : "保存前要先预览影响"}</span>
            <Button variant="outline" disabled={!!busy} onClick={requestClose}>取消</Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => void preview()}>
              <Eye />
              {busy === "preview" ? "预览中…" : "预览影响"}
            </Button>
            <Button disabled={!previewed || !!busy || !dirty} disabledReason={!previewed ? "先预览影响" : undefined} onClick={() => void save()}>
              {busy === "save" ? "保存中…" : "保存"}
            </Button>
          </>
        )
      }
    >
      {discarding ? (
        <p>关闭后不会保留当前修改。</p>
      ) : (
        <fieldset className="aui-gov-form" disabled={readOnly || !!busy}>
          <FormField label="规则名称" htmlFor={`${id}-label`} required error={shown.errors.label}>
            <Input id={`${id}-label`} value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder={kind === "share" ? "例：VIP 客户共享给客服部" : "例：冻结的客户不能改"} />
          </FormField>
          <FormField label="资源类型" htmlFor={`${id}-res`} required error={shown.errors.resourceType} hint={rule ? "已有规则不能换资源类型" : undefined}>
            <Choice
              label="资源类型"
              value={draft.resourceType}
              disabled={!!rule || readOnly}
              onChange={(v) => set({ resourceType: v, cond: emptyCondDraft(resources.find((r) => r.id === v)?.fields ?? []), original: null, actions: [] })}
              options={resources.map((r) => ({ value: r.id, label: r.label }))}
            />
          </FormField>
          {kind === "share" ? (
            <>
              <FormField label="共享给" htmlFor={`${id}-stype`} required error={shown.errors.subject}>
                <div className="aui-gov-inline">
                  <Choice
                    label="对象类型"
                    value={draft.subjectType}
                    disabled={readOnly}
                    onChange={(v) => set({ subjectType: v as GrantSubjectType, subjectId: "" })}
                    options={(["dept", "group", "user", "everyone"] as const).map((t) => ({ value: t, label: SUBJECT_TYPE_LABEL[t] }))}
                  />
                  {draft.subjectType !== "everyone" &&
                    (subjectOptions.length ? (
                      <Choice label={`选择${SUBJECT_TYPE_LABEL[draft.subjectType]}`} placeholder={`选择${SUBJECT_TYPE_LABEL[draft.subjectType]}`} value={draft.subjectId} disabled={readOnly} onChange={(v) => set({ subjectId: v })} options={subjectOptions} />
                    ) : (
                      <Input aria-label={`${SUBJECT_TYPE_LABEL[draft.subjectType]}编号`} placeholder={`${SUBJECT_TYPE_LABEL[draft.subjectType]}编号`} value={draft.subjectId} onChange={(e) => set({ subjectId: e.target.value.trim() })} />
                    ))}
                </div>
              </FormField>
              <FormField label="能做什么" htmlFor={`${id}-level`}>
                <SegmentedControl className="aui-gov-seg" label="共享级别" size="sm" value={draft.level} disabled={readOnly} onValueChange={(v) => set({ level: v })} options={[{ value: "viewer", label: "可查看" }, { value: "editor", label: "可编辑" }]} />
              </FormField>
              <div className="aui-gov-stack">
                <FormField label="到期时间" htmlFor={`${id}-exp`} error={shown.errors.expiresAt} hint="留空 = 一直有效">
                  <DateTimePicker id={`${id}-exp`} clearable value={draft.expiresAt} onChange={(v) => set({ expiresAt: v })} />
                </FormField>
                {!readOnly && <QuickDatePresets days={[7, 30, 90]} permanent="一直有效" onPick={(v) => set({ expiresAt: v })} now={now} />}
              </div>
            </>
          ) : (
            <>
              <FormField label="限制哪些动作" htmlFor={`${id}-acts`} hint="一个都不选 = 这类资源的全部动作">
                {actionsOfRes.length ? (
                  <ChipGroup label="限制哪些动作" value={draft.actions} disabled={readOnly} onValueChange={(v) => set({ actions: v })} options={actionsOfRes.map((a) => ({ value: a.id, label: a.label }))} />
                ) : (
                  <Input id={`${id}-acts`} value={draft.actions.join(", ")} placeholder="例：update, delete" onChange={(e) => set({ actions: e.target.value.split(/[,，\s]+/).filter(Boolean) })} />
                )}
              </FormField>
              <label className="aui-gov-check">
                <Checkbox checked={draft.exemptSuperuser} disabled={readOnly} onCheckedChange={(v) => set({ exemptSuperuser: v === true })} aria-label="超级管理员不受这条规则限制" />
                超级管理员不受这条规则限制
              </label>
            </>
          )}
          <label className="aui-gov-check">
            <Switch checked={draft.enabled} disabled={readOnly} onCheckedChange={(v) => set({ enabled: v })} aria-label="启用这条规则" />
            启用这条规则
          </label>
          <section className="aui-gov-form-full" aria-label={kind === "share" ? "共享哪些记录" : "满足什么条件时禁止"}>
            <h3 className="aui-gov-subtitle">{kind === "share" ? "共享哪些记录" : "满足什么条件时禁止"}</h3>
            {draft.cond ? (
              <CondBuilder fields={fields} value={draft.cond} readOnly={readOnly} errors={shown.rows} error={shown.condError} onChange={(cond) => set({ cond })} />
            ) : (
              <InlineAlert
                tone="info"
                title="条件比较复杂，这里只能整体查看"
                action={!readOnly && <Button size="sm" variant="outline" onClick={() => set({ cond: emptyCondDraft(fields), original: null })}>清空重写</Button>}
              >
                <code className="aui-gov-code">{draft.original ? condToText(draft.original, condLabelsFrom(fields)) : "—"}</code>
              </InlineAlert>
            )}
            {draft.cond && <p className="aui-note">预览：{built.ok ? condToText(built.input.cond, condLabelsFrom(fields)) : "条件还没写完整"}</p>}
          </section>
          {impact && <div className="aui-gov-form-full"><RuleImpactView impact={impact.dto} stale={!previewed} actionLabel={optionLabeler(actionsOfRes)} /></div>}
          {failure && <p className="aui-error aui-gov-form-full" role="alert">{failure}</p>}
        </fieldset>
      )}
    </Dialog>
  );
}

function DeleteRule({ rule, collection, onClose, onDeleted }: { rule: AnyRule | null; collection: GovRuleCollection<AnyRule, ShareRuleInput | RestrictionRuleInput>; onClose: () => void; onDeleted: (rule: AnyRule) => void }) {
  const [impact, setImpact] = useState<{ id: string; text: string } | null>(null);
  const ruleId = rule?.id;
  useEffect(() => {
    if (!ruleId) return;
    const controller = new AbortController();
    collection.preview({ id: ruleId, delete: true }, { signal: controller.signal }).then(
      (dto) => setImpact({ id: ruleId, text: impactSummary(dto) }),
      (e: unknown) => !controller.signal.aborted && setImpact({ id: ruleId, text: `没能算出影响：${govErrorMessage(e)}` }),
    );
    return () => controller.abort();
  }, [ruleId, collection]);
  return (
    <ConfirmDialog
      open={rule !== null}
      title="删除规则"
      destructive
      confirmLabel="删除"
      impact={rule ? `删除「${rule.label}」后立即生效。影响：${impact?.id === rule.id ? impact.text : "正在计算…"}` : undefined}
      onClose={onClose}
      onConfirm={async () => {
        if (!rule) return;
        try {
          await collection.remove(rule.id);
        } catch (e) {
          throw new Error(govErrorMessage(e));
        }
        onDeleted(rule);
      }}
    />
  );
}
