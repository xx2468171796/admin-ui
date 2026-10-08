import { useState } from "react";
import {
  CONDITION_DYNAMIC_TOKENS, CONDITION_OPS, ConditionTreeEditor, ConditionValuePicker, Input, NumberInput, VALUELESS_OPS,
  conditionKindOf, conditionOpLabel, describeConditionTree, isConditionComplete,
  type ConditionEditorField, type ConditionGroup, type ConditionOp,
} from "@adminui/react";
import { PEOPLE, STAGES } from "../../data/demo-data";

type Field = ConditionEditorField & { options?: { value: string; label: string; tone?: (typeof STAGES)[number]["tone"] }[]; currency?: string };

const FIELDS: Field[] = [
  { key: "name", title: "客户名称", type: "text" },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES.map((s) => ({ value: s.value, label: s.label, tone: s.tone })) },
  { key: "owner", title: "负责人", type: "user", options: PEOPLE.map((p) => ({ value: p.id, label: p.name })) },
  { key: "amount", title: "预计金额", type: "money", currency: "¥" },
];
const START: ConditionGroup<ConditionOp> = {
  id: "root",
  conjunction: "and",
  items: [
    { id: "c1", field: "stage", op: "anyOf", value: ["proposal", "negotiation"] },
    { id: "c2", field: "owner", op: "hasAny", value: { dynamic: "me" } },
    { id: "g1", conjunction: "or", items: [{ id: "c3", field: "amount", op: "gte", value: 50000 }, { id: "c4", field: "name", op: "contains" }] },
  ],
};
const kindOf = (field: Field | undefined) => conditionKindOf(field?.type ?? "text");

/** 字段 / 条件 / 值三格；值按字段类型换（标签多选、选人含「我」、数字）；没填完的灰着写「先不生效」；顶上一句话读出条件。 */
export function Demo() {
  const [tree, setTree] = useState(START);
  return (
    <ConditionTreeEditor<ConditionOp, Field>
      label="筛选条件"
      fields={FIELDS}
      tree={tree}
      onChange={setTree}
      operators={(field) => CONDITION_OPS[kindOf(field)].map((op) => ({ value: op, label: conditionOpLabel(op, kindOf(field)) }))}
      isComplete={(condition, field) => isConditionComplete(kindOf(field), condition.op, condition.value)}
      summary={<p style={{ margin: 0 }}><b>当前条件：</b>{describeConditionTree(tree, FIELDS)}</p>}
      renderValue={({ condition, field, label, readOnly, onChange }) => {
        if (VALUELESS_OPS.has(condition.op)) return null;
        const value = condition.value;
        if (field?.type === "singleSelect" || field?.type === "user")
          return (
            <ConditionValuePicker
              label={`${label} · 值`}
              value={value}
              choices={field.options ?? []}
              tokens={field.type === "user" ? CONDITION_DYNAMIC_TOKENS.slice(0, 1) : undefined}
              neutral={field.type === "user"}
              disabled={readOnly}
              onChange={onChange}
            />
          );
        if (field?.type === "money")
          return <NumberInput size="sm" aria-label={`${label} · 金额`} prefix="¥" thousands value={typeof value === "number" ? value : null} onChange={(n) => onChange(n ?? undefined)} />;
        return <Input size="sm" aria-label={`${label} · 值`} placeholder="输入关键词" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)} />;
      }}
    />
  );
}
