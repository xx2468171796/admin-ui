"use client";
/**
 * Body of the 筛选 panel (GridFilterTool): the sentence that reads the filter, the quick starts when it is empty,
 * and the condition tree with its value editors. A lazy module — the grid's first paint only has the button.
 */
import { Filter } from "lucide-react";
import { canAddCondition, countConditions, type ConditionLimits, type DynamicToken } from "./condition-core.ts";
import type { GridField, GridFilterGroup, GridSelectOption } from "./grid-core.ts";
import { GridConditionTree } from "./grid-condition-editor.tsx";
import { ConditionSentence } from "./condition-sentence.tsx";
import type { QuickAdd } from "./grid-filter-panel.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export type GridFilterBodyProps<T> = {
  fields: readonly GridField<T>[];
  tree: GridFilterGroup;
  limits: ConditionLimits;
  quick: readonly QuickAdd[];
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  dynamicTokens?: readonly DynamicToken[];
  timeZone?: string;
  onChange: (filter: GridFilterGroup) => void;
};

export function GridFilterBody<T>({ fields, tree, limits, quick, valueOptions, dynamicTokens, timeZone, onChange }: GridFilterBodyProps<T>) {
  const total = countConditions(tree);
  return (
    <div className="aui-grid-filter-panel">
      {total > 0 && <ConditionSentence tree={tree} fields={fields} options={{ dynamicTokens }} />}
      {total === 0 && (
        <div className="aui-cond-empty">
          <span className="aui-cond-empty-icon" aria-hidden="true"><Filter /></span>
          <span>还没有筛选条件。{quick.length ? "常用：" : "添加条件后只显示符合的记录。"}</span>
          {quick.map((item) => (
            <button key={item.key} type="button" className="aui-cond-quick" onClick={() => onChange(item.add(tree))}>{item.label}</button>
          ))}
        </div>
      )}
      <GridConditionTree fields={fields} tree={tree} limits={limits} valueOptions={valueOptions} dynamicTokens={dynamicTokens} timeZone={timeZone} onChange={onChange} />
      {!canAddCondition(tree, limits) && <p className="aui-note">已到 {limits.maxConditions} 个条件的上限。</p>}
    </div>
  );
}
