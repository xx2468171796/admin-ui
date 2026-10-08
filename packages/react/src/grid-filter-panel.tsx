"use client";
/**
 * 筛选 panel v2 (bt/grid-a G3, demo D04): the toolbar button reads 「筛选 3」 (active
 * conditions); on top one sentence reads the filter (ConditionSentence: 「阶段 是 报价、谈判 且 负责人 是 我
 * 且（…）」); then 「符合以下 全部满足 / 任一满足 的条件」, condition rows and nested condition groups (one
 * level by default) with their own and / or, value editors per kind (option tags, 「我」, relative dates,
 * money with currency, stars), 「N / 50 条」, add condition / add group, 清空, 另存为新视图. With no
 * condition the panel offers quick buttons for common fields (阶段 · 负责人 = 我 · 下次跟进).
 */
import type { ReactNode } from "react";
import { Filter, Plus, SquarePlus } from "lucide-react";
import { Button } from "./primitives.tsx";
import { addConditionNode, canAddCondition, canAddConditionGroup, countConditions, countConditionGroups, nextConditionId, type DynamicToken } from "./condition-core.ts";
import { activeFilterCount, addGridFilter, addGridFilterGroup, gridFilterOps, type GridField, type GridFilterGroup } from "./grid-core.ts";
import { gridConditionKind, gridConditionLimits } from "./grid-view-v2.ts";
import { lazyPart } from "./lazy-part.ts";
import type { GridFilterBodyProps } from "./grid-filter-body.tsx";
import { PanelFooter, ToolbarPanel, type GridToolContext } from "./grid-toolbar-panel.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

const FILTER_HELP = "条件按「全部满足」（且）或「任一满足」（或）组合，点行前的「且 / 或」也能切换；条件组里的条件有自己的关系，例如「阶段是报价，并且（意向 ≥ 4 或 过去 7 天要跟进）」。没填完的条件先不生效。「我」按当前登录的人算，相对日期每天自动往后走。";

// The panel body (condition sentence + condition tree with its value editors, date pickers …) loads on first open.
const body = lazyPart(() => import("./grid-filter-body.tsx").then((m) => m.GridFilterBody));
const FilterBody = body.Part as <T>(props: GridFilterBodyProps<T>) => ReactNode;
/** Fetch the panel body ahead of the first open (GridToolbar calls it when the browser is idle). */
export const preloadFilterPanel = body.preload;

export type QuickAdd = { key: string; label: string; add: (tree: GridFilterGroup) => GridFilterGroup };

/** Up to three common starts: the first option field, 「<people field> = 我」, the first date field. */
export function quickFilterAdds<T>(fields: readonly GridField<T>[], tokens?: readonly DynamicToken[]): QuickAdd[] {
  const usable = fields.filter((field) => !field.restricted);
  const kindOf = (field: GridField<T>) => gridConditionKind(field as GridField<unknown>);
  const option = usable.find((field) => (kindOf(field) === "select" || kindOf(field) === "multi") && field.options?.length);
  const person = usable.find((field) => kindOf(field) === "user");
  const date = usable.find((field) => kindOf(field) === "date");
  const hasMe = !tokens || tokens.some((t) => t.token === "me");
  const out: QuickAdd[] = [];
  if (option) out.push({ key: option.key, label: option.title, add: (tree) => addGridFilter(tree, option) });
  if (person && hasMe)
    out.push({
      key: person.key,
      label: `${person.title} = 我`,
      add: (tree) => addConditionNode(tree, tree.id, { id: nextConditionId(tree, "f"), field: person.key, op: gridFilterOps(person as GridField<unknown>)[0] ?? "hasAny", value: { dynamic: "me" } }),
    });
  if (date) out.push({ key: date.key, label: date.title, add: (tree) => addGridFilter(tree, date) });
  return out;
}

export function GridFilterTool<T>({ fields, view, apply, limits, valueOptions, dynamicTokens, timeZone, onSaveAsView, panelNote, counts }: GridToolContext<T>) {
  const filterable = fields.filter((field) => field.filterable !== false && (field.type !== "custom" || field.text));
  const first = filterable.find((field) => !field.restricted);
  const active = activeFilterCount(view, fields);
  const total = countConditions(view.filter);
  const groups = countConditionGroups(view.filter);
  const conditionLimits = gridConditionLimits(limits);
  const tree = view.filter;
  const label = "筛选";
  const setFilter = (filter: GridFilterGroup) => apply({ type: "setFilter", filter });
  const quick = quickFilterAdds(filterable, dynamicTokens);
  // 「符合 5 / 168 条」: what the conditions do right now, when the grid knows its counts.
  const matchText = total > 0 && counts?.total !== undefined && counts.matched !== undefined ? `符合 ${counts.matched} / ${counts.total} 条` : null;
  return (
    <ToolbarPanel icon={<Filter />} preload={body.preload} label={label} badge={active} active={active > 0} title="筛选条件" help={FILTER_HELP} width="condition"
      headerExtra={<span className="aui-grid-panel-count" aria-label={`已有 ${total} 个条件，最多 ${conditionLimits.maxConditions} 个`}>{matchText ?? `最多 ${conditionLimits.maxConditions} 个条件`}{groups ? ` · ${groups} 个条件组` : ""}</span>}
      footer={(
        <PanelFooter onSaveAsView={onSaveAsView} note={panelNote}>
          <Button variant="ghost" size="sm" className="aui-cond-add-btn" data-autofocus={total === 0 ? "" : undefined} disabled={!first || !canAddCondition(tree, conditionLimits)} onClick={() => setFilter(addGridFilter(tree, first))}><Plus />添加条件</Button>
          {conditionLimits.maxDepth > 0 && (
            <Button variant="ghost" size="sm" className="aui-cond-add-btn" disabled={!first || !canAddConditionGroup(tree, tree.id, conditionLimits)} onClick={() => setFilter(addGridFilterGroup(tree, first, undefined, conditionLimits))}><SquarePlus />添加条件组</Button>
          )}
          {total > 0 && <Button variant="ghost" size="sm" onClick={() => setFilter({ ...tree, items: [] })}>清空</Button>}
        </PanelFooter>
      )}>
      {() => <FilterBody fields={filterable} tree={tree} limits={conditionLimits} quick={quick} valueOptions={valueOptions} dynamicTokens={dynamicTokens} timeZone={timeZone} onChange={setFilter} />}
    </ToolbarPanel>
  );
}
