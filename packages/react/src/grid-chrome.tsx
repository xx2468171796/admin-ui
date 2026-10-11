"use client";
/**
 * The parts of BitableGrid around the scroll box: the view toolbar (with 撤销 / 重做 / 刷新), the loading / error /
 * empty panel over the body, and the parts that are not on the first paint — the menus (field menu, cell menu, summary
 * picker), the status line's content and the bulk action bar load in the background after mount.
 */
import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import type { RowData } from "@tanstack/react-table";
import { Plus, Redo2, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "./primitives.tsx";
import { StatePanel } from "./layout.tsx";
import { IconButton } from "./buttons.tsx";
import { lazyPart, whenIdle } from "./lazy-part.ts";
import type { BulkActionBarProps } from "./bulk-action-bar.tsx";
import { activeFilterCount, readField, toPeople } from "./grid-core.ts";
import { GridToolbar } from "./grid-toolbar.tsx";
import type { GridStatusProps } from "./grid-status.tsx";
import type { GridCore, GridInteractions, useGridMenus } from "./use-bitable-grid.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

type MenusProps<T extends RowData> = { core: GridCore<T>; menus: ReturnType<typeof useGridMenus<T>> };
const menusPart = /* @__PURE__ */ lazyPart(() => import("./grid-overlays.tsx").then((m) => m.GridMenus));
const LazyMenus = menusPart.Part as <T extends RowData>(props: MenusProps<T>) => ReactNode;
const statusPart = /* @__PURE__ */ lazyPart(() => import("./grid-status.tsx").then((m) => m.GridStatusContent));
const LazyStatus = statusPart.Part as <T>(props: GridStatusProps<T>) => ReactNode;
const bulkPart = /* @__PURE__ */ lazyPart(() => import("./bulk-action-bar.tsx").then((m) => m.BulkActionBar));
const LazyBulkBar = bulkPart.Part as (props: BulkActionBarProps) => ReactNode;

/** Field / cell menus and the summary picker: loaded after mount (they only show once opened). */
export function GridMenus<T extends RowData>(props: MenusProps<T>) {
  return <Suspense fallback={null}><LazyMenus {...props} /></Suspense>;
}

/**
 * The status line (保存中 / 已保存 / errors / conflicts). The live region is always there (screen readers announce what
 * appears in it); its content loads when an editable grid is idle.
 */
export function GridStatusLine<T>(props: GridStatusProps<T>) {
  const { status, editing } = props;
  useEffect(() => (editing.enabled ? whenIdle(statusPart.preload) : undefined), [editing.enabled]);
  return (
    <div className="aui-grid-status" role="status" aria-live="polite" data-tone={status?.tone} hidden={!status}>
      {status && <Suspense fallback={<span className="aui-grid-status-text">{status.text}</span>}><LazyStatus {...props} /></Suspense>}
    </div>
  );
}

/** The bottom bar of checked records (loaded when a grid with selection is idle). */
export function GridBulkBar(props: BulkActionBarProps & { selectable: boolean }) {
  const { selectable, ...bar } = props;
  useEffect(() => (selectable ? whenIdle(bulkPart.preload) : undefined), [selectable]);
  return selectable && bar.count > 0 ? <Suspense fallback={null}><LazyBulkBar {...bar} /></Suspense> : null;
}

/** Loading / error / empty panel over the body. */
export function GridStateOverlay<T extends RowData>({ core, act }: { core: GridCore<T>; act: GridInteractions<T> }) {
  const { props, model, rows } = core;
  if (rows.busy) return <div className="aui-grid-overlay"><StatePanel kind="loading" /></div>;
  if (rows.failure) return <div className="aui-grid-overlay"><StatePanel kind="error" message={rows.failure} onRetry={model.server && !props.error ? () => { model.remote.retry(); model.remoteGroups.refresh(); } : props.onRetry} /></div>;
  if (rows.dataCount) return null;
  const searching = Boolean(activeFilterCount(model.view, model.fields) || model.view.search.trim());
  const kind = (model.server || model.sourceRows.length > 0) && searching ? "no-results" : "empty";
  return (
    <div className="aui-grid-overlay">
      <StatePanel kind={kind} message={kind === "empty" ? props.emptyLabel : undefined}
        action={kind === "no-results" ? <Button variant="outline" onClick={() => model.dispatch({ type: "clearFilters" })}>清除筛选和搜索</Button> : props.onAddRow ? <Button variant="outline" onClick={() => void act.addRow.run({})}><Plus />新增一行</Button> : undefined} />
    </div>
  );
}

/** The default GridToolbar (`toolbar` true), the host's node, or nothing. */
export function GridViewToolbar<T extends RowData>({ core }: { core: GridCore<T> }): ReactNode {
  const { props, model, rows } = core;
  const { editing, server, caps, serverGroups, fields } = model;
  const valueOptions = useMemo(() => Object.fromEntries(fields.filter((f) => f.type === "user").map((f) => {
    const given = props.peopleOptions?.[f.key];
    const names = given ? given.map((p) => p.name) : [...new Set(model.sourceRows.flatMap((row) => toPeople(readField(f, row)).map((p) => p.name)))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return [f.key, names.map((name) => ({ value: name, label: name }))];
  })), [fields, model.sourceRows, props.peopleOptions]);
  if (props.toolbar === false) return null;
  if (props.toolbar !== undefined && props.toolbar !== true) return props.toolbar;
  const can = (cap: "search" | "filter" | "sort") => (!server || caps?.[cap] !== false) && props.toolbarFeatures?.[cap] !== false;
  const tools = <>
    {editing.enabled && <span className="aui-grid-history" role="group" aria-label="撤销与重做">
      <IconButton label="撤销（Ctrl + Z）" disabled={!editing.canUndo} onClick={editing.undo} icon={<Undo2 />} />
      <IconButton label="重做（Ctrl + Y）" disabled={!editing.canRedo} onClick={editing.redo} icon={<Redo2 />} />
    </span>}
    {server && <IconButton label="刷新" onClick={() => { model.remote.refresh(); if (serverGroups) model.remoteGroups.refresh(); }} icon={<RefreshCw />} />}
  </>;
  return (
    <GridToolbar fields={fields} view={model.view} onViewChange={model.commit} total={server ? model.remote.total ?? 0 : model.sourceRows.length} matched={server ? model.remote.total ?? 0 : model.filtered.length} groupKeys={rows.groupKeys}
      actions={props.actions} leading={props.toolbarLeading} quickFilters={props.toolbarQuick} searchMode={props.toolbarSearch} more={props.toolbarMore} valueOptions={valueOptions} tools={tools}
      limits={props.limits} dynamicTokens={props.dynamicTokens} timeZone={model.conditionContext.timeZone} onSaveAsView={props.onSaveAsView} panelNote={props.panelNote}
      onCreateField={props.onCreateField} onCreateFieldGroup={props.onCreateFieldGroup} server={server}
      features={{ search: can("search"), filter: can("filter"), sort: can("sort"), group: (!server || serverGroups) && props.toolbarFeatures?.group !== false, fields: props.toolbarFeatures?.fields !== false, color: props.toolbarFeatures?.color !== false, rowHeight: props.toolbarFeatures?.rowHeight !== false }} />
  );
}
