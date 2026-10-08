"use client";
/**
 * RuleList (bt/builders-b A5, the generic part of demo D26): ordered IF / THEN rules where the first
 * match wins — assignment rules, routing, auto-tagging, approval routes. Each rule: drag grip (pointer
 * or keyboard via SortableList), order number, optional name, 「如果 …」 condition summary rendered
 * from the condition tree in plain Chinese with option chips, 「→ …」 action summary (host renders),
 * hit count, enable switch, ⋯ menu (修改 / 复制 / 删除). A fixed fallback rule sits at the bottom
 * (「都不满足时 …」): it cannot move or be deleted. 修改 opens a SideSheet with the host's form: name,
 * the condition editor (default: the grid's GridConditionTree on condition-core) and the action editor.
 *
 * UI only: the host owns the rules (`onChange`), saves edits (`onSave`, reject = stay open with the
 * message) and runs the rules on the server. Pools, weights, round-robin are business — host slots.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Copy, Lock, Pencil, Plus, SquarePlus, Trash2 } from "lucide-react";
import { Button, Input, Switch, cn } from "./primitives.tsx";
import { ConfirmDialog, FormField } from "./forms.tsx";
import { SideSheet } from "./sheets.tsx";
import { SortableList } from "./sortable.tsx";
import { canAddRootGroup, GridConditionTree } from "./grid-condition-editor.tsx";
import { CONDITION_LIMITS, canAddCondition, countConditions, type ConditionGroup, type ConditionLimits, type DynamicToken } from "./condition-core.ts";
import { conditionTreeParts, conjunctionWord, describeConditionTree, type ConditionGroupPart, type ConditionPart } from "./condition-describe.ts";
import { addGridFilter, addGridFilterGroup, type GridField, type GridFilterGroup, type GridSelectOption } from "./grid-core.ts";
import { IconButton, MoreMenu } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";

/**
 * A field as the condition summary and editor need it. Any `GridField<Row>` fits (the row type does not
 * matter here — no rows are read), so pages pass their BitableGrid fields as they are.
 */
export type ConditionFieldDef = Pick<GridField<never>, "key" | "title" | "type" | "options" | "restricted" | "filterable" | "group" | "locked" | "max" | "precision" | "currency" | "timeZone">;
/** The condition editor is typed on grid fields; field definitions are row-free, so this view is safe. */
export const asGridFields = (fields: readonly ConditionFieldDef[]) => fields as readonly GridField<never>[];

export type RuleItem = {
  id: string;
  /** Optional name above the summary (「高质量官网线索」). */
  name?: string;
  /** IF: the generic condition tree (condition-core). */
  condition: ConditionGroup<string>;
  enabled: boolean;
  /** Matches in the hit window (「近 7 天 46 条」); null = unknown (「—」); omit = no hit column. */
  hits?: number | null;
};

export type RuleFallback = {
  /** Default 「都不满足时」. */
  label?: ReactNode;
  /** What happens then (「留在客户池 · 通知 林经理」). */
  action: ReactNode;
  hits?: number | null;
  /** Pencil button (the fallback's own small form is the host's). */
  onEdit?: () => void;
  editLabel?: string;
};

export type RuleEditorApi<R extends RuleItem> = { draft: R; setDraft: (next: R) => void; isNew: boolean };

export type RuleListProps<R extends RuleItem> = {
  rules: readonly R[];
  /** Reorder, enable switch, duplicate and delete all hand back the whole list. */
  onChange: (next: R[]) => void;
  /** Fields the conditions use (BitableGrid fields fit): summaries and the default condition editor. */
  fields: readonly ConditionFieldDef[];
  /** THEN summary of a rule (「精英销售池 · 轮流分（按权重）」). */
  renderAction: (rule: R) => ReactNode;
  fallback: RuleFallback;
  /** Accessible name of the list, default 「规则（从上往下匹配，命中第一条就停）」. */
  label?: string;
  /** 「近 7 天」 before hit counts. */
  hitsLabel?: string;
  hitsUnit?: string;
  /** Fewer hits than this get a grey 「命中很少」 hint (default 5; 0 = off). */
  lowHits?: number;
  // ---- editing
  /** Save an edited or new rule; reject keeps the sheet open with the message. */
  onSave?: (rule: R, info: { isNew: boolean }) => void | Promise<void>;
  /** 「添加规则」 at the bottom of the list: the draft of a new rule. */
  newRule?: () => R;
  /** Copy for 「复制」 (default: same rule with id `${id}-copy-N`, name + 「（副本）」, switched off). */
  duplicate?: (rule: R, rules: readonly R[]) => R;
  /** Confirm text of delete, default 「删除规则 N」. Return a reject to keep the rule. */
  onDelete?: (rule: R) => void | Promise<void>;
  /** The THEN part of the editor (pools, people, how to assign …). */
  renderActionEditor?: (api: RuleEditorApi<R>) => ReactNode;
  /**
   * The IF part of the editor. Default: GridConditionTree (the grid's nested condition editor on
   * condition-core) with `fields`; replace it with another tree editor if your page has one.
   */
  renderConditionEditor?: (api: { tree: ConditionGroup<string>; onChange: (tree: ConditionGroup<string>) => void }) => ReactNode;
  /** Replace the whole editor body (then name / condition / action slots are not used). */
  renderEditor?: (api: RuleEditorApi<R>) => ReactNode;
  /** Condition limits (default nesting 1, 50 conditions). */
  limits?: ConditionLimits;
  /** Choices of people fields in the default condition editor. */
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  dynamicTokens?: readonly DynamicToken[];
  /** Grey note in the editor footer (「保存后立即生效，只影响之后进来的客户」). */
  editorNote?: ReactNode;
  /** No rule yet: text above the fallback. */
  emptyText?: string;
};

const nextCopyId = (id: string, rules: readonly RuleItem[]) => {
  let n = 1;
  while (rules.some((r) => r.id === `${id}-copy-${n}`)) n++;
  return `${id}-copy-${n}`;
};

/** Condition summary drawn with chips: 「来源 是 [官网表单] [转介绍] 且 地区 = [高雄]」. */
export function ConditionSummary({ tree, fields, emptyText = "所有记录" }: { tree: ConditionGroup<string>; fields: readonly ConditionFieldDef[]; emptyText?: string }) {
  const parts = conditionTreeParts(tree, fields);
  const text = describeConditionTree(tree, fields, { emptyText });
  const draw = (group: ConditionGroupPart): ReactNode[] => {
    const items = group.items.filter((item) => (item.kind === "group" ? item.items.length > 0 : !item.inactive));
    return items.flatMap((item: ConditionPart, i) => {
      const join = i > 0 ? [<span key={`j${item.id}`} className="aui-rule-join" data-conj={group.conjunction}>{conjunctionWord(group.conjunction)}</span>] : [];
      if (item.kind === "group") {
        const inner = draw(item);
        return [...join, <span key={item.id} className="aui-rule-group">{inner.length > 1 ? <>（{inner}）</> : inner}</span>];
      }
      return [
        ...join,
        <span key={item.id} className="aui-rule-cond">
          {item.fieldLabel} {item.opLabel}
          {item.values.map((v, k) => (v.tone ? <span key={k} className="aui-chip" data-tone={v.tone}>{v.text}</span> : <b key={k}>{v.text}</b>))}
        </span>,
      ];
    });
  };
  const drawn = draw(parts);
  return (
    <span className="aui-rule-if" aria-label={`如果 ${text}`}>
      <span className="aui-rule-kw" aria-hidden="true">如果</span>
      <span className="aui-rule-conds" aria-hidden="true">{drawn.length ? drawn : <span className="aui-rule-cond">{emptyText}</span>}</span>
    </span>
  );
}

function Hits({ hits, label, unit, low, lowHits }: { hits: number | null; label: string; unit: string; low: boolean; lowHits: number }) {
  return (
    <span className="aui-rule-hits" data-low={low || undefined} data-tip={low ? `命中少于 ${lowHits} ${unit}，可以考虑删掉或合并` : undefined}>
      {label} <b>{hits === null ? "—" : hits.toLocaleString("zh-CN")}</b> {unit}
    </span>
  );
}

export function RuleList<R extends RuleItem>(props: RuleListProps<R>) {
  const { rules, onChange, fields, renderAction, fallback, label = "规则（从上往下匹配，命中第一条就停）", hitsLabel = "近 7 天", hitsUnit = "条", lowHits = 5, onSave, newRule, onDelete, renderActionEditor, renderConditionEditor, renderEditor, limits = CONDITION_LIMITS, valueOptions, dynamicTokens, editorNote, emptyText = "还没有规则，所有记录都走兜底" } = props;
  const [editing, setEditing] = useState<{ draft: R; isNew: boolean; original?: R } | null>(null);
  const [deleting, setDeleting] = useState<R | null>(null);
  const showHits = rules.some((r) => r.hits !== undefined) || fallback.hits !== undefined;
  const indexOf = (rule: R) => rules.findIndex((r) => r.id === rule.id) + 1;
  const copyOf = (rule: R): R => props.duplicate?.(rule, rules) ?? { ...rule, id: nextCopyId(rule.id, rules), name: rule.name ? `${rule.name}（副本）` : undefined, enabled: false, hits: rule.hits === undefined ? undefined : null };
  const setEnabled = (rule: R, enabled: boolean) => onChange(rules.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));

  return (
    <div className="aui-rulelist">
      {rules.length === 0 && <p className="aui-rule-empty">{emptyText}</p>}
      <SortableList
        items={rules}
        label={label}
        itemLabel={(rule) => `规则 ${indexOf(rule)}${rule.name ? ` ${rule.name}` : ""}`}
        onChange={(next) => onChange(next)}
        renderItem={(rule) => {
          const n = indexOf(rule);
          const low = typeof rule.hits === "number" && lowHits > 0 && rule.hits < lowHits;
          return (
            <div className={cn("aui-rule")} data-off={!rule.enabled || undefined}>
              <span className="aui-rule-no" aria-hidden="true">{n}</span>
              <button type="button" className="aui-rule-main" aria-label={`修改规则 ${n}`} disabled={!onSave} onClick={() => setEditing({ draft: rule, isNew: false, original: rule })}>
                {rule.name && <b className="aui-rule-name">{rule.name}</b>}
                <ConditionSummary tree={rule.condition} fields={fields} />
                <span className="aui-rule-then">
                  <ArrowRight aria-hidden="true" />
                  {renderAction(rule)}
                </span>
              </button>
              <span className="aui-rule-side">
                {!rule.enabled && <span className="aui-rule-off">已停用</span>}
                {showHits && <Hits hits={rule.hits ?? null} label={hitsLabel} unit={hitsUnit} low={low} lowHits={lowHits} />}
                <Switch checked={rule.enabled} aria-label={`${rule.enabled ? "停用" : "启用"}规则 ${n}`} onCheckedChange={(v) => setEnabled(rule, v)} />
                <MoreMenu
                  label={`规则 ${n} 的更多操作`}
                  sections={[
                    {
                      items: [
                        ...(onSave ? [{ key: "edit", label: "修改", icon: <Pencil />, onSelect: () => setEditing({ draft: rule, isNew: false, original: rule }) }] : []),
                        { key: "copy", label: "复制一条", icon: <Copy />, hint: "放在它下面，先停用", onSelect: () => onChange(rules.flatMap((r) => (r.id === rule.id ? [r, copyOf(r)] : [r]))) },
                      ],
                    },
                    { items: [{ key: "delete", label: "删除", icon: <Trash2 />, danger: true, onSelect: () => setDeleting(rule) }] },
                  ]} />
              </span>
            </div>
          );
        }}
      />
      <div className="aui-rule aui-rule-fallback" role="group" aria-label="兜底规则（固定在最后，不能删、不能拖动）" data-tip="兜底规则固定在最后，不能删、不能拖动">
        <span className="aui-rule-lock" aria-hidden="true"><Lock /></span>
        <span className="aui-rule-badge">兜底</span>
        <span className="aui-rule-main" data-static="">
          <span className="aui-rule-then">
            <span className="aui-rule-kw">{fallback.label ?? "都不满足时"}</span>
            <ArrowRight aria-hidden="true" />
            {fallback.action}
          </span>
        </span>
        <span className="aui-rule-side">
          {showHits && <Hits hits={fallback.hits ?? null} label={hitsLabel} unit={hitsUnit} low={false} lowHits={lowHits} />}
          {fallback.onEdit && (
            <IconButton label={fallback.editLabel ?? "修改兜底规则"} onClick={fallback.onEdit} icon={<Pencil />} />
          )}
        </span>
      </div>
      {newRule && onSave && (
        <Button variant="outline" className="aui-rule-add" onClick={() => setEditing({ draft: newRule(), isNew: true })}>
          <Plus />
          添加规则
        </Button>
      )}
      {editing && onSave && (
        <RuleEditorSheet
          key={editing.draft.id}
          initial={editing.draft}
          isNew={editing.isNew}
          number={editing.isNew ? rules.length + 1 : indexOf(editing.draft)}
          fields={fields}
          limits={limits}
          valueOptions={valueOptions}
          dynamicTokens={dynamicTokens}
          note={editorNote}
          renderEditor={renderEditor}
          renderConditionEditor={renderConditionEditor}
          renderActionEditor={renderActionEditor}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            await onSave(draft, { isNew: editing.isNew });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="删除规则"
        destructive
        confirmLabel="删除"
        impact={deleting ? `删除规则 ${indexOf(deleting)}：${describeConditionTree(deleting.condition, fields)}。之后命中它的记录会往下匹配，最后走兜底。` : undefined}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await onDelete?.(deleting);
          onChange(rules.filter((r) => r.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </div>
  );
}

function RuleEditorSheet<R extends RuleItem>({ initial, isNew, number, fields, limits, valueOptions, dynamicTokens, note, renderEditor, renderConditionEditor, renderActionEditor, onClose, onSave }: {
  initial: R;
  isNew: boolean;
  number: number;
  fields: readonly ConditionFieldDef[];
  limits: ConditionLimits;
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  dynamicTokens?: readonly DynamicToken[];
  note?: ReactNode;
  renderEditor?: (api: RuleEditorApi<R>) => ReactNode;
  renderConditionEditor?: RuleListProps<R>["renderConditionEditor"];
  renderActionEditor?: (api: RuleEditorApi<R>) => ReactNode;
  onClose: () => void;
  onSave: (draft: R) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState<R>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const api: RuleEditorApi<R> = { draft, setDraft, isNew };
  const summary = useMemo(() => describeConditionTree(draft.condition, fields), [draft.condition, fields]);
  const setTree = (tree: ConditionGroup<string>) => setDraft({ ...draft, condition: tree });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(draft);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SideSheet
      open
      width="lg"
      title={isNew ? "添加规则" : `修改规则 ${number}`}
      description={`如果 ${summary}`}
      onClose={() => !busy && onClose()}
      footer={
        <div className="aui-rule-sheet-foot">
          {error ? <span role="alert" className="aui-rule-error">{error}</span> : note ? <small>{note}</small> : <span />}
          <Button variant="outline" disabled={busy} onClick={onClose}>取消</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? "保存中…" : "完成"}</Button>
        </div>
      }
    >
      {renderEditor ? (
        renderEditor(api)
      ) : (
        <div className="aui-rule-editor">
          <FormField label="规则名称" htmlFor={`${id}-name`} hint="可不填；不填时列表里只显示条件">
            <Input id={`${id}-name`} value={draft.name ?? ""} placeholder="例：高质量官网线索" onChange={(e) => setDraft({ ...draft, name: e.target.value || undefined })} />
          </FormField>
          <section className="aui-rule-editor-part" aria-label="条件">
            <h4>条件 <small>{countConditions(draft.condition)} 条</small></h4>
            {renderConditionEditor ? (
              renderConditionEditor({ tree: draft.condition, onChange: setTree })
            ) : (
              <GridConditionTree fields={asGridFields(fields)} tree={draft.condition as GridFilterGroup} onChange={setTree} limits={limits} valueOptions={valueOptions} dynamicTokens={dynamicTokens} />
            )}
            {!renderConditionEditor && <ConditionAddRow tree={draft.condition} fields={fields} limits={limits} onChange={setTree} />}
          </section>
          {renderActionEditor && (
            <section className="aui-rule-editor-part" aria-label="然后">
              <h4>然后</h4>
              {renderActionEditor(api)}
            </section>
          )}
        </div>
      )}
    </SideSheet>
  );
}

/** 「+ 添加条件 / + 添加条件组」 under the default tree editor (the tree itself has no root buttons). */
function ConditionAddRow({ tree, fields: defs, limits, onChange }: { tree: ConditionGroup<string>; fields: readonly ConditionFieldDef[]; limits: ConditionLimits; onChange: (tree: ConditionGroup<string>) => void }) {
  const first = asGridFields(defs).find((f) => !f.restricted);
  const grid = tree as GridFilterGroup;
  return (
    <div className="aui-rule-editor-add">
      <Button variant="ghost" size="sm" disabled={!first || !canAddCondition(grid, limits)} onClick={() => onChange(addGridFilter(grid, first))}><Plus />添加条件</Button>
      <Button variant="ghost" size="sm" disabled={!first || !canAddRootGroup(grid, limits)} onClick={() => onChange(addGridFilterGroup(grid, first, undefined, limits))}><SquarePlus />添加条件组</Button>
    </div>
  );
}
