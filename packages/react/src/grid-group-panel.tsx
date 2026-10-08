"use client";
/**
 * 分组 panel (bt/grid-a G4, D17) and 排序 panel v2 (G5, D17b). Group levels (≤ 3 by default): drag to
 * reorder, field + group order per level, 显示空分组, 全部展开 / 全部收起. Sorts: 「首先 / 然后」 rows
 * with drag, direction labels per type (从早到晚 / 从大到小 …), 自动排序, the notes that grouped views
 * sort inside groups and empties always go last.
 */
import type { ReactNode } from "react";
import { ArrowUpDown, Layers } from "lucide-react";
import { PanelFooter, ToolbarPanel, type GridToolContext } from "./grid-toolbar-panel.tsx";
import { lazyPart } from "./lazy-part.ts";
import type { GridPanelBodyProps } from "./grid-group-body.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

// The panel bodies (sortable levels, field pickers, switches) load on first open; one module for both panels.
const groupBody = lazyPart(() => import("./grid-group-body.tsx").then((m) => m.GridGroupBody));
const sortBody = lazyPart(() => import("./grid-group-body.tsx").then((m) => m.GridSortBody));
const GroupBody = groupBody.Part as <T>(props: GridPanelBodyProps<T>) => ReactNode;
const SortBody = sortBody.Part as <T>(props: GridPanelBodyProps<T>) => ReactNode;
/** Fetch both panel bodies ahead of the first open (GridToolbar calls it when the browser is idle). */
export const preloadGroupPanels = groupBody.preload;

export function GridGroupTool<T>({ fields, view, apply, limits, onSaveAsView, panelNote, groupKeys }: GridToolContext<T> & { groupKeys?: readonly string[] }) {
  const levels = view.groupBy;
  const max = limits.maxGroupLevels;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const label = !levels.length ? "分组" : levels.length === 1 ? `分组: ${byKey.get(levels[0]!.field)?.title ?? ""}` : `分组 ${levels.length} 级`;
  return (
    <ToolbarPanel icon={<Layers />} preload={groupBody.preload} label={label} active={levels.length > 0} title="分组" width="list"
      help="最多分几级由页面决定（默认 3 级）。每一级可以选组的先后顺序；拖动左边的把手调整层级。组头显示条数和底部统计栏选的统计。"
      headerExtra={<span className="aui-grid-panel-count">最多 {max} 级</span>}
      footer={<PanelFooter onSaveAsView={onSaveAsView} note={panelNote} />}>
      {() => <GroupBody fields={fields} view={view} apply={apply} limits={limits} groupKeys={groupKeys} />}
    </ToolbarPanel>
  );
}

export function GridSortTool<T>({ fields, view, apply, limits, onSaveAsView, panelNote, server }: GridToolContext<T>) {
  return (
    <ToolbarPanel icon={<ArrowUpDown />} preload={sortBody.preload} label="排序" badge={view.sort.length} active={view.sort.length > 0} title="排序" width="list"
      headerExtra={<span className="aui-grid-panel-count">靠上的先排</span>}
      help="靠上的优先：先按第一个字段排，相同的再按下一个排。拖动左边的把手调整先后。"
      footer={<PanelFooter onSaveAsView={onSaveAsView} note={panelNote} />}>
      {() => <SortBody fields={fields} view={view} apply={apply} limits={limits} server={server} />}
    </ToolbarPanel>
  );
}
