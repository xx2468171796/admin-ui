"use client";
/**
 * 填色 panel (bt/grid-a G13): colour rules of the view — conditions (same editor as 筛选) + one of the
 * seven option tones, for the whole row or one field's cell; drag to reorder (the first matching rule
 * wins), switch a rule off without deleting it.
 */
import type { ReactNode } from "react";
import { PaintBucket, Plus } from "lucide-react";
import { Button } from "./primitives.tsx";
import type { GridColorRule, GridField } from "./grid-core.ts";
import { newColorRule } from "./grid-color-core.ts";
import { PanelFooter, ToolbarPanel, type GridToolContext } from "./grid-toolbar-panel.tsx";
import { lazyPart } from "./lazy-part.ts";
import type { GridColorRulesProps } from "./grid-color-rules.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

// The rule list (condition trees, swatches, sortable rules) loads on first open.
const body = lazyPart(() => import("./grid-color-rules.tsx").then((m) => m.GridColorRules));
const ColorRules = body.Part as <T>(props: GridColorRulesProps<T>) => ReactNode;
/** Fetch the rule list ahead of the first open (GridToolbar calls it when the browser is idle). */
export const preloadColorPanel = body.preload;
/** Fields a colour rule can test (filterable, custom fields only with a text value); same as grid-color-rules. */
const colorRuleFields = <T,>(fields: readonly GridField<T>[]) => fields.filter((field) => field.filterable !== false && (field.type !== "custom" || field.text));

export function GridColorTool<T>({ fields, view, apply, limits, valueOptions, dynamicTokens, timeZone, onSaveAsView, panelNote }: GridToolContext<T>) {
  const first = colorRuleFields(fields).find((field) => !field.restricted);
  const rules = view.colors;
  const on = rules.filter((rule) => rule.enabled !== false).length;
  const set = (next: readonly GridColorRule[]) => apply({ type: "setColors", rules: next });
  return (
    <ToolbarPanel icon={<PaintBucket />} preload={body.preload} label="填色" badge={on} active={on > 0} title="填色" width="condition"
      help="符合条件的记录整行或某一格换底色，颜色是选项的 10 种色调。规则从上到下检查，第一条符合的生效；拖动调整先后，关掉开关暂时不用。"
      headerExtra={<span className="aui-grid-panel-count">从上往下，先命中的生效</span>}
      footer={(
        <PanelFooter onSaveAsView={onSaveAsView} note={panelNote}>
          <Button variant="ghost" size="sm" data-autofocus={rules.length ? undefined : ""} disabled={!first || rules.length >= limits.maxColorRules} onClick={() => set([...rules, newColorRule(rules, first)])}><Plus />添加填色规则</Button>
        </PanelFooter>
      )}>
      {() => <ColorRules fields={fields} rules={rules} onChange={set} valueOptions={valueOptions} dynamicTokens={dynamicTokens} timeZone={timeZone} />}
    </ToolbarPanel>
  );
}


export type { GridColorRulesProps } from "./grid-color-rules.tsx";
