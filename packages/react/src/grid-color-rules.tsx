"use client";
/**
 * The 填色 rule list (GridColorTool's panel body; GanttSettings 颜色依据「按条件」 edits the same model): sortable
 * rules, 整行 / 单元格, field, tone, on / off and the condition tree of each rule. A lazy module in the grid.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button, Switch } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { SortableList } from "./sortable.tsx";
import { OptionSwatchPicker } from "./option-swatch.tsx";
import { canAddCondition, type DynamicToken } from "./condition-core.ts";
import { addGridFilter, type GridColorRule, type GridField, type GridSelectOption } from "./grid-core.ts";
import { newColorRule } from "./grid-color-core.ts";
import { GridConditionTree } from "./grid-condition-editor.tsx";
import { GridFieldPicker } from "./grid-field-picker.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

const RULE_LIMITS = { maxDepth: 0, maxConditions: 10 };

/** Fields a colour rule can test (filterable, custom fields only with a text value). */
const colorRuleFields = <T,>(fields: readonly GridField<T>[]) => fields.filter((field) => field.filterable !== false && (field.type !== "custom" || field.text));

// bt/templates: the rule list on its own, so other views (GanttSettings 颜色依据「按条件」) edit the same model.
export type GridColorRulesProps<T> = {
  fields: readonly GridField<T>[];
  rules: readonly GridColorRule[];
  onChange: (rules: readonly GridColorRule[]) => void;
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  dynamicTokens?: readonly DynamicToken[];
  timeZone?: string;
  /** "row": every rule colours the whole record (gantt bars, cards) — no 整行 / 单元格 switch. Default "any". */
  targets?: "any" | "row";
  /** Show an 「添加规则」 button under the list (the grid panel has it in its footer). Max rules when shown. */
  addLimit?: number;
};
/** Internal (not exported from the package root): the 填色 rule list, see GridColorTool. */
export function GridColorRules<T>({ fields, rules, onChange, valueOptions, dynamicTokens, timeZone, targets = "any", addLimit }: GridColorRulesProps<T>) {
  const filterable = colorRuleFields(fields);
  const first = filterable.find((field) => !field.restricted);
  const set = onChange;
  const patch = (id: string, change: Partial<GridColorRule>) => set(rules.map((rule) => (rule.id === id ? { ...rule, ...change } : rule)));
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return (
        <div className="aui-grid-color-panel">
          {!rules.length && <p className="aui-note">还没有填色规则。例如「下次跟进 早于 今天」整行标成注意色。</p>}
          {rules.length > 0 && (
            <SortableList<{ id: string }> label="填色规则" items={rules.map((rule) => ({ id: rule.id }))} itemLabel={(item) => `规则 ${rules.findIndex((r) => r.id === item.id) + 1}`}
              onChange={(next) => set(next.flatMap((item) => rules.filter((rule) => rule.id === item.id)))}
              renderItem={(item) => {
                const rule = rules.find((r) => r.id === item.id);
                if (!rule) return null;
                const index = rules.indexOf(rule);
                return (
                  <div className="aui-grid-color-rule" data-off={rule.enabled === false || undefined} role="group" aria-label={`规则 ${index + 1}`}>
                    <div className="aui-grid-color-head">
                      <strong>规则 {index + 1}</strong>
                      {targets === "any" && <SegmentedControl size="sm" label={`规则 ${index + 1} 填在哪里`} value={rule.target} options={[{ value: "row", label: "整行" }, { value: "cell", label: "单元格" }]}
                        onValueChange={(v) => patch(rule.id, v === "cell" ? { target: "cell", field: rule.field ?? first?.key } : { target: "row", field: undefined })} />}
                      {targets === "any" && rule.target === "cell" && <GridFieldPicker fields={fields} value={rule.field ?? null} label={`规则 ${index + 1} 填哪一列`} onChange={(key) => patch(rule.id, { field: key })} />}
                      <OptionSwatchPicker label={`规则 ${index + 1} 的颜色`} value={rule.tone} sample={rule.target === "cell" && rule.field ? byKey.get(rule.field)?.title : "示例"} onChange={(tone) => patch(rule.id, { tone })} />
                      <Switch aria-label={`启用规则 ${index + 1}`} checked={rule.enabled !== false} onCheckedChange={(v) => patch(rule.id, { enabled: v ? undefined : false })} />
                      <IconButton label={`删除规则 ${index + 1}`} onClick={() => set(rules.filter((r) => r.id !== rule.id))} icon={<Trash2 />} />
                    </div>
                    <GridConditionTree fields={filterable} tree={rule.filter} limits={RULE_LIMITS} valueOptions={valueOptions} dynamicTokens={dynamicTokens} timeZone={timeZone}
                      onChange={(filter) => patch(rule.id, { filter })} />
                    <Button variant="ghost" size="sm" disabled={!first || !canAddCondition(rule.filter, RULE_LIMITS)} onClick={() => patch(rule.id, { filter: addGridFilter(rule.filter, first) })}><Plus />添加条件</Button>
                  </div>
                );
              }} />
          )}
          {addLimit !== undefined && (
            <Button variant="ghost" size="sm" disabled={!first || rules.length >= addLimit} onClick={() => set([...rules, newColorRule(rules, first)])}><Plus />添加规则</Button>
          )}
        </div>
  );
}
