"use client";
/**
 * Bodies of the 分组 and 排序 panels (GridGroupTool / GridSortTool): sortable levels, field pickers, order choices
 * and the switches. A lazy module — the grid's first paint only has the buttons.
 */
import { Info, Plus, X } from "lucide-react";
import { Button, Choice, Switch } from "./primitives.tsx";
import { SortableList } from "./sortable.tsx";
import { GridFieldPicker } from "./grid-field-picker.tsx";
import { orderLabels } from "./grid-group-core.ts";
import type { GridField } from "./grid-core.ts";
import type { GridToolContext } from "./grid-toolbar-panel.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

type Row = { id: string; index: number };
const canGroup = <T,>(field: GridField<T>) => field.groupable !== false && (field.type !== "custom" || Boolean(field.text));
const canSort = <T,>(field: GridField<T>) => field.sortable !== false && (field.type !== "custom" || Boolean(field.text));

export type GridPanelBodyProps<T> = Pick<GridToolContext<T>, "fields" | "view" | "apply" | "limits" | "server"> & { groupKeys?: readonly string[] };

export function GridGroupBody<T>({ fields, view, apply, limits, groupKeys }: GridPanelBodyProps<T>) {
  const groupable = fields.filter(canGroup);
  const levels = view.groupBy;
  const max = limits.maxGroupLevels;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const free = groupable.filter((field) => !levels.some((level) => level.field === field.key));
  const rows: Row[] = levels.map((level, index) => ({ id: level.field, index }));
  return (
    <div className="aui-grid-group-panel">
      {levels.length > 0 && (
        <SortableList<Row> label="分组层级" dense items={rows} itemLabel={(row) => `第 ${row.index + 1} 级 ${byKey.get(row.id)?.title ?? ""}`}
          onChange={(next) => apply({ type: "setGroups", levels: next.map((row) => levels[row.index]!) })}
          renderItem={(row) => {
            const level = levels[row.index]!;
            const field = byKey.get(level.field);
            const [asc, desc] = orderLabels(field);
            return (
              <div className="aui-grid-level-row">
                <span className="aui-grid-level-name">第 {row.index + 1} 级</span>
                <GridFieldPicker fields={groupable} value={level.field} label={`第 ${row.index + 1} 级分组字段`}
                  disabledReason={(f) => (f.key !== level.field && levels.some((l) => l.field === f.key) ? "已经在别的层级里" : null)}
                  onChange={(key) => apply({ type: "setGroups", levels: levels.map((l, i) => (i === row.index ? { field: key, order: "asc" } : l)) })} />
                <Choice label={`第 ${row.index + 1} 级的顺序`} value={level.order} options={[{ value: "asc", label: asc }, { value: "desc", label: desc }]}
                  onChange={(v) => apply({ type: "setGroups", levels: levels.map((l, i) => (i === row.index ? { ...l, order: v === "desc" ? "desc" : "asc" } : l)) })} />
                <IconButton label={`删除第 ${row.index + 1} 级分组`} onClick={() => apply({ type: "setGroups", levels: levels.filter((_, i) => i !== row.index) })} icon={<X />} />
              </div>
            );
          }} />
      )}
      {!levels.length && <p className="aui-note">不分组。添加分组后记录按字段值归到一组组里。</p>}
      <div className="aui-grid-panel-add">
        <Button variant="ghost" size="sm" disabled={levels.length >= max || !free.length} onClick={() => apply({ type: "setGroups", levels: [...levels, { field: free[0]!.key, order: "asc" }] })}><Plus />添加分组</Button>
        <span className="aui-note">最多 {max} 级</span>
      </div>
      <div className="aui-grid-panel-section">
        <label className="aui-grid-panel-setting">
          <span><strong>显示空分组</strong><span className="aui-note">没有记录的选项也显示一组</span></span>
          <Switch aria-label="显示空分组" checked={view.showEmptyGroups} onCheckedChange={(v) => apply({ type: "showEmptyGroups", value: v })} />
        </label>
        <div className="aui-grid-panel-setting">
          <span><strong>展开 / 收起</strong><span className="aui-note">只对你生效</span></span>
          <span className="aui-grid-panel-pair">
            <Button variant="outline" size="sm" disabled={!levels.length} onClick={() => apply({ type: "setCollapsed", keys: [] })}>全部展开</Button>
            <Button variant="outline" size="sm" disabled={!levels.length || !groupKeys?.length} onClick={() => apply({ type: "setCollapsed", keys: groupKeys ?? [] })}>全部收起</Button>
          </span>
        </div>
      </div>
    </div>
  );
}

export function GridSortBody<T>({ fields, view, apply, server }: GridPanelBodyProps<T>) {
  const sortable = fields.filter(canSort);
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const free = sortable.filter((field) => !view.sort.some((s) => s.key === field.key));
  const rows: Row[] = view.sort.map((sort, index) => ({ id: sort.key, index }));
  const groupPath = view.groupBy.map((level) => byKey.get(level.field)?.title ?? level.field).join(" → ");
  return (
    <div className="aui-grid-sort-panel">
      {view.sort.length > 0 ? (
        <SortableList<Row> label="排序条件" dense items={rows} itemLabel={(row) => `${row.index === 0 ? "首先" : "然后"} ${byKey.get(row.id)?.title ?? ""}`}
          onChange={(next) => apply({ type: "setSort", sort: next.map((row) => view.sort[row.index]!) })}
          renderItem={(row) => {
            const sort = view.sort[row.index]!;
            const [asc, desc] = orderLabels(byKey.get(sort.key));
            return (
              <div className="aui-grid-level-row">
                <span className="aui-grid-level-name">{row.index === 0 ? "首先" : "然后"}</span>
                <GridFieldPicker fields={sortable} value={sort.key} label={`${row.index === 0 ? "首先" : "然后"}按哪个字段排序`}
                  disabledReason={(f) => (f.key !== sort.key && view.sort.some((s) => s.key === f.key) ? "已经在排序里" : null)}
                  onChange={(key) => apply({ type: "setSort", sort: view.sort.map((s, i) => (i === row.index ? { key, direction: "asc" } : s)) })} />
                <Choice label={`${byKey.get(sort.key)?.title ?? ""}的排序方向`} value={sort.direction} options={[{ value: "asc", label: asc }, { value: "desc", label: desc }]}
                  onChange={(v) => apply({ type: "setSort", sort: view.sort.map((s, i) => (i === row.index ? { ...s, direction: v === "desc" ? "desc" : "asc" } : s)) })} />
                <IconButton label={`删除排序 ${byKey.get(sort.key)?.title ?? sort.key}`} onClick={() => apply({ type: "setSort", sort: view.sort.filter((_, i) => i !== row.index) })} icon={<X />} />
              </div>
            );
          }} />
      ) : <p className="aui-note">按原始顺序显示。</p>}
      <div className="aui-grid-panel-add">
        <Button variant="ghost" size="sm" disabled={!free.length} onClick={() => apply({ type: "setSort", sort: [...view.sort, { key: free[0]!.key, direction: "asc" }] })}><Plus />添加排序</Button>
      </div>
      <div className="aui-grid-panel-section">
        {!server && (
          <label className="aui-grid-panel-setting">
            <span><strong>自动排序</strong><span className="aui-note">关掉后改了数据行不跳动，换排序时再重排</span></span>
            <Switch aria-label="自动排序" checked={view.autoSort} onCheckedChange={(v) => apply({ type: "autoSort", value: v })} />
          </label>
        )}
        {groupPath && <p className="aui-grid-panel-tip"><Info aria-hidden="true" />分组时在组内排序：先按 {groupPath} 分组，组里再排</p>}
        <p className="aui-grid-panel-tip"><Info aria-hidden="true" />空值永远排在最后</p>
      </div>
    </div>
  );
}
