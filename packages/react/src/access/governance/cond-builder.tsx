"use client";
/**
 * CondBuilder — condition editor for share / restriction rules and TableAccessPanel 「按条件」: rows of
 * 字段 · 运算 · 值 (a value can be typed or bound to the current person: 当前用户 / 当前用户的部门 …),
 * joined by 全部满足 / 任一满足, plus nested condition groups with their own and / or (bt/builders-a P1;
 * one level by default, `limits` changes it). Built on the shared ConditionTreeEditor; the value stays
 * the CondDraft (`groups` only appears once a group is added), validated by cond-core draftToCond.
 * RuleImpactView — the「预览影响」result table. Both are controlled and presentational.
 */
import { useMemo } from "react";
import { Choice, Input, StatusBadge } from "../../primitives.tsx";
import { InlineAlert } from "../../layout.tsx";
import { DateTimePicker } from "../../date-picker.tsx";
import { DataTable } from "../../data.tsx";
import { CellDate } from "../../displays.tsx";
import { ConditionTreeEditor, ConditionValuePicker, type ConditionEditorField } from "../../condition-editor.tsx";
import { updateConditionNode, type ConditionLimits } from "../../condition-core.ts";
import { COND_OP_LABEL, COND_REF_LABEL, type CondFieldDef, type CondFieldType, type CondOp, type RuleImpactDto } from "./contracts.ts";
import { OPS_FOR_TYPE, REFS_FOR_TYPE, isListRef, condDraftToTree, condRowToCondition, conditionToCondRow, retypeRow, splitList, treeToCondDraft, type CondDraft, type CondRow, type CondValueSource } from "./cond-core.ts";
import { impactRows, impactSummary, impactTone } from "./governance-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type CondBuilderProps = {
  fields: readonly CondFieldDef[];
  value: CondDraft;
  onChange: (next: CondDraft) => void;
  /** Row id → message (from draftToCond). */
  errors?: Readonly<Record<string, string>>;
  /** Whole-condition message (e.g. no rows). */
  error?: string;
  readOnly?: boolean;
  /** Accessible name prefix, default「条件」. */
  label?: string;
  /** Nesting / count limits (default: one level of groups, 50 conditions). `{ maxDepth: 0 }` = flat. */
  limits?: Partial<ConditionLimits>;
  /** `compact` = the D13 look for narrow cards (且 / 或 chips between rows). */
  density?: "default" | "compact";
};

type EditorField = ConditionEditorField & { def: CondFieldDef };
const ICON_TYPE: Readonly<Record<CondFieldType, string>> = { id: "text", string: "text", number: "number", boolean: "checkbox", timestamp: "datetime" };
const opLabel = (op: CondOp) => (op === "like" ? "包含（按原文）" : COND_OP_LABEL[op]);

export function CondBuilder({ fields, value, onChange, errors = {}, error, readOnly = false, label = "条件", limits, density = "default" }: CondBuilderProps) {
  const editorFields = useMemo<EditorField[]>(() => fields.map((def) => ({ key: def.id, title: def.label, type: def.options?.length ? "singleSelect" : ICON_TYPE[def.type], def })), [fields]);
  const tree = useMemo(() => condDraftToTree(value), [value]);
  if (!fields.length) return <InlineAlert tone="warning" title="这类资源没有可用的条件字段">请让开发在权限目录里声明字段（defineFields）后再写条件。</InlineAlert>;
  return (
    <div className="aui-gov-cond">
      <ConditionTreeEditor<CondOp, EditorField>
        label={label}
        fields={editorFields}
        tree={tree}
        onChange={(next) => onChange(treeToCondDraft(next))}
        limits={limits}
        density={density}
        readOnly={readOnly}
        keepOne
        errors={errors}
        fieldPicker="select"
        labels={{ row: ({ number }) => `${label} ${number}`, field: (row) => `${row} · 字段`, operator: (row) => `${row} · 运算` }}
        operators={(field) => OPS_FOR_TYPE[field.def.type].map((op) => ({ value: op, label: opLabel(op) }))}
        createCondition={(field, id) => ({ id, field: field.key, op: OPS_FOR_TYPE[field.def.type][0]!, value: "" })}
        patchCondition={(current, id, patch) =>
          updateConditionNode(current, id, (condition) => {
            const row = conditionToCondRow(condition);
            if (patch.field !== undefined && patch.field !== condition.field) return condRowToCondition(retypeRow(row, fields, patch.field));
            return { ...condition, ...patch };
          })}
        renderValue={({ condition, field, label: row, readOnly: locked, onChange: setValue }) => {
          const current = conditionToCondRow(condition);
          const type = field?.def.type ?? "string";
          if (current.op === "isNull" || current.op === "notNull") return null;
          const refs = REFS_FOR_TYPE[type];
          const list = current.op === "in" || current.op === "nin";
          const setSource = (source: CondValueSource) => setValue(source === "literal" ? "" : { dynamic: source });
          if (field?.def.options?.length) {
            // Options: one compact chips box (D13), the current person's attributes on top.
            const tokens = refs.filter((ref) => isListRef(ref) === list).map((ref) => ({ token: ref, label: COND_REF_LABEL[ref] }));
            return (
              <ConditionValuePicker label={`${row} · 值`} multiple={list} disabled={locked} choices={field.def.options} tokens={tokens}
                value={current.source !== "literal" ? { dynamic: current.source } : list ? splitList(current.value) : current.value}
                onChange={(next) => setValue(Array.isArray(next) ? next.join(", ") : next)} />
            );
          }
          return (
            <span className="aui-gov-cond-value">
              {refs.length > 0 && (
                <Choice label={`${row} · 值来源`} value={current.source} disabled={locked} onChange={(s) => setSource(s as CondValueSource)}
                  options={[{ value: "literal", label: "填写的值" }, ...refs.map((ref) => ({ value: ref, label: COND_REF_LABEL[ref] }))]} />
              )}
              {current.source === "literal" && <ValueInput def={field?.def} row={current} list={list} label={`${row} · 值`} readOnly={locked} onChange={setValue} />}
            </span>
          );
        }}
      />
      {tree.items.some((node) => !("items" in node) && node.op === "like" && typeof node.value === "string") && <p className="aui-note aui-gov-cond-error">「包含（按原文）」按原文匹配，% 和 _ 不是通配符。</p>}
      {error && <p className="aui-error" role="alert">{error}</p>}
    </div>
  );
}

function ValueInput({ def, row, list, label, readOnly, onChange }: { def?: CondFieldDef; row: CondRow; list: boolean; label: string; readOnly: boolean; onChange: (v: string) => void }) {
  if (def?.type === "boolean")
    return <Choice label={label} value={row.value} disabled={readOnly} placeholder="选择" onChange={onChange} options={[{ value: "true", label: "是" }, { value: "false", label: "否" }]} />;
  if (def?.type === "timestamp" && !list) return <DateTimePicker aria-label={label} value={row.value} readOnly={readOnly} onChange={onChange} />;
  return (
    <Input
      aria-label={label}
      value={row.value}
      readOnly={readOnly}
      inputMode={def?.type === "number" ? "decimal" : undefined}
      placeholder={list ? "多个值用逗号隔开" : def?.type === "number" ? "数字" : "值"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export type RuleImpactViewProps = {
  impact: RuleImpactDto;
  /** True when the draft changed after this preview: shown greyed with a re-preview hint. */
  stale?: boolean;
  /** Action id → label. */
  actionLabel?: (id: string) => string;
};
/** Result of「预览影响」: one-sentence summary + per-person before / after table. */
export function RuleImpactView({ impact, stale = false, actionLabel = (id) => id }: RuleImpactViewProps) {
  const tone = impactTone(impact);
  return (
    <section className="aui-gov-impact" data-stale={stale ? "" : undefined} aria-label="影响预览">
      <InlineAlert tone={stale ? "warning" : tone} title={stale ? "条件已改动，下面是上一次的预览，请重新预览" : impactSummary(impact)}>
        {stale ? impactSummary(impact) : <>按「{impact.actions.map(actionLabel).join("、")}」计算，检查了 {impact.totals.usersChecked} 人 · <CellDate value={impact.evaluatedAt} time /></>}
      </InlineAlert>
      {impact.users.length > 0 && (
        <DataTable
          caption="受影响的人"
          rows={impactRows(impact)}
          rowKey={(u) => `${u.userId}:${u.action}`}
          pagination={{ mode: "all" }}
          maxHeight={280}
          columns={[
            { key: "name", title: "人员", minWidth: 120, render: (u) => u.name },
            { key: "action", title: "动作", width: 90, render: (u) => actionLabel(u.action) },
            { key: "before", title: "改前", width: 80, numeric: true, render: (u) => u.before.toLocaleString() },
            { key: "after", title: "改后", width: 80, numeric: true, render: (u) => u.after.toLocaleString() },
            {
              key: "delta",
              title: "变化",
              width: 120,
              render: (u) => (
                <span className="aui-gov-delta">
                  {u.gained > 0 && <StatusBadge tone="brand">{`多 ${u.gained}`}</StatusBadge>}
                  {u.lost > 0 && <StatusBadge tone="warning">{`少 ${u.lost}`}</StatusBadge>}
                </span>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
