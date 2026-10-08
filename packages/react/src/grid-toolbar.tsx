"use client";
/**
 * GridToolbar: 搜索 · 字段配置 · 筛选 · 分组 · 排序 · 行高 · 填色 + record count + host actions. The
 * view panels live in their own files (bt/grid-a): grid-fields-panel / grid-filter-panel /
 * grid-group-panel (分组 + 排序) / grid-color-panel; they all edit the view through gridViewReducer.
 */
import { SearchBox } from "./search.tsx";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Rows3, Search } from "lucide-react";
import { Button } from "./primitives.tsx";
import { MoreMenu, IconButton } from "./buttons.tsx";
import type { MenuSection } from "./menu.tsx";
import { useIsMobile } from "./media-query.ts";
import { SegmentedControl } from "./choices.tsx";
import { ROW_HEIGHT_LABELS, type TableRowHeightPreset } from "./table-rows.ts";
import { gridViewReducer, type GridField, type GridSelectOption, type GridView, type GridViewAction, type GridViewLimits } from "./grid-core.ts";
import { ToolbarPopover } from "./grid-popover.tsx";
import type { DynamicToken } from "./condition-core.ts";
import { GRID_LIMITS } from "./grid-view-v2.ts";
import type { GridToolContext } from "./grid-toolbar-panel.tsx";
import { GridFilterTool, preloadFilterPanel } from "./grid-filter-panel.tsx";
import { GridGroupTool, GridSortTool, preloadGroupPanels } from "./grid-group-panel.tsx";
import { GridFieldsTool, preloadFieldsPanel } from "./grid-fields-panel.tsx";
import { GridColorTool, preloadColorPanel } from "./grid-color-panel.tsx";
import { whenIdle } from "./lazy-part.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

// ---------------------------------------------------------------- toolbar

/** Which GridToolbar tools to show; each defaults to on. */
export type GridToolbarFeatures = { search?: boolean; filter?: boolean; sort?: boolean; group?: boolean; fields?: boolean; color?: boolean; rowHeight?: boolean };

export type GridToolbarProps<T> = {
  fields: readonly GridField<T>[];
  view: GridView;
  onViewChange: (view: GridView) => void;
  /** All records / records matching search and filters, for 「共 N 条」. */
  total?: number;
  matched?: number;
  /** Selected record count, with 「清除选择」. */
  selected?: number;
  onClearSelection?: () => void;
  /** Group path keys of the current data (for 全部收起). */
  groupKeys?: readonly string[];
  /** Choices for user fields in the filter editor (default: free text, comma separated). */
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  /** Host actions on the right (新建记录, 导出, batch actions …). */
  actions?: ReactNode;
  /** bt/templates: host content at the left start (「添加记录 ▾」), before search and the view tools. */
  leading?: ReactNode;
  /**
   * Tools the data supports (server sources may not group / filter); default all on. `rowHeight: false`
   * drops 行高 — use that for kanban / gallery / calendar / gantt toolbars, which have no rows.
   */
  features?: GridToolbarFeatures;
  /** Extra buttons before the record count (BitableGrid puts 撤销 / 重做 here when editing). */
  tools?: ReactNode;
  // bt/grid-a
  /** UI limits (default GRID_LIMITS: 3 group levels, 50 conditions, groups one level deep). */
  limits?: Partial<GridViewLimits>;
  /** Dynamic values for people filters (default 「我（当前用户）」「我的下属」); the host resolves them. */
  dynamicTokens?: readonly DynamicToken[];
  /** Time zone of 「今天」 in date filters (BitableGrid passes AdminProvider `defaults.timeZone`; default the runtime's). */
  timeZone?: string;
  /** 「另存为新视图」 in the view panels. */
  onSaveAsView?: () => void;
  /** Note in the panels' footers, e.g. 「只改你的个人设置，自动保存」. */
  panelNote?: string;
  /** 字段配置: 「+ 新建字段」 / 「新建字段编组」. */
  onCreateField?: () => void;
  onCreateFieldGroup?: () => void;
  /** Server data source (自动排序 is not offered). */
  server?: boolean;
  /**
   * Business presets with counts (公海 15 · 我跟进中的 32 · 停滞 4 — a ChipGroup or the host's own pills), at the
   * RIGHT end before search; phones give them their own scrolling row.
   */
  quickFilters?: ReactNode;
  /** "box" (default) = a search box after the leading slot; "icon" = a search icon on the right that opens the box. */
  searchMode?: "box" | "icon";
  /**
   * The toolbar's 「⋯」 on the right, before `actions`: 表设置 · 权限 · 操作记录 · 公开登记链接 · 导出 (* rarely used things never take a button of their own, so the toolbar stays one line and stable per table).
   */
  more?: readonly MenuSection[];
};

/** Search icon that opens into the box (stays open while there is a query). */
function SearchToggle({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  if (!open && !value)
    return (
      <IconButton label="搜索记录" tooltip="搜索" className="aui-grid-search-icon" onClick={() => {
        setOpen(true);
        requestAnimationFrame(() => box.current?.focus());
      }} icon={<Search aria-hidden="true" />} />
    );
  return (
    <div className="aui-grid-search" data-collapsible="" onBlur={(event) => {
      if (!value && !(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setOpen(false);
    }}>
      <SearchBox ref={box} size="sm" label="搜索记录" placeholder="搜索" value={value} onChange={onChange} />
    </div>
  );
}

/**
 * Toolbar of a grid view: 搜索 / 字段配置 / 筛选 / 分组 / 排序 / 行高 / 填色, plus the record count and
 * host actions. BitableGrid renders it by default (`toolbar`); export it to place it elsewhere — also
 * above kanban / gallery / calendar / gantt views with `features={{ rowHeight: false }}`.
 */
export function GridToolbar<T>({ fields, view, onViewChange, total, matched, selected, onClearSelection, groupKeys, valueOptions, actions, leading, features = {}, tools, limits, dynamicTokens, timeZone, onSaveAsView, panelNote, onCreateField, onCreateFieldGroup, server, quickFilters, searchMode = "box", more }: GridToolbarProps<T>) {
  const can = { search: features.search !== false, filter: features.filter !== false, sort: features.sort !== false, group: features.group !== false, fields: features.fields !== false, color: features.color !== false, rowHeight: features.rowHeight !== false };
  const apply = (action: GridViewAction) => onViewChange(gridViewReducer(view, action, fields));
  const searchId = useId();
  const context: GridToolContext<T> = { fields, view, apply, limits: { ...GRID_LIMITS, ...limits }, valueOptions, dynamicTokens, timeZone, onSaveAsView, panelNote, server, counts: { total, matched } };
  const iconSearch = can.search && searchMode === "icon";
  // Phones: the quick filters get their own row above (scrolls sideways); the toolbar stays one scrolling row.
  const phone = useIsMobile();
  const quickRow = phone && quickFilters ? <div className="aui-grid-quickrow">{quickFilters}</div> : null;
  // The panel bodies are lazy (not on the first paint); fetch the ones this toolbar shows once the browser is idle,
  // so the first open is instant.
  const wanted = `${can.filter}${can.group}${can.sort}${can.fields}${can.color}`;
  useEffect(
    () =>
      whenIdle(() => {
        if (can.filter) preloadFilterPanel();
        if (can.group || can.sort) preloadGroupPanels();
        if (can.fields) preloadFieldsPanel();
        if (can.color) preloadColorPanel();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wanted],
  );
  return (
    <>
    {quickRow}
    <div className="aui-grid-toolbar" role="toolbar" aria-label="视图工具栏" data-quick={quickFilters && !phone ? "" : undefined}>
      {leading && <div className="aui-grid-leading">{leading}</div>}
      {can.search && !iconSearch && <div className="aui-grid-search">
        <SearchBox id={searchId} size="sm" label="搜索记录" placeholder="搜索" value={view.search} onChange={(value) => apply({ type: "search", value })} />
      </div>}
      {can.fields && <GridFieldsTool {...context} onCreateField={onCreateField} onCreateGroup={onCreateFieldGroup} />}
      {can.filter && <GridFilterTool {...context} />}
      {can.group && <GridGroupTool {...context} groupKeys={groupKeys} />}
      {can.sort && <GridSortTool {...context} />}
      {can.rowHeight && <ToolbarPopover icon={<Rows3 />} label="行高">
        {() => (
          <div className="aui-grid-pop">
            <div className="aui-grid-pop-head"><strong>行高</strong><span className="aui-note">每行一样高，放不下的展开记录看</span></div>
            <SegmentedControl label="行高" value={view.rowHeight} options={(Object.keys(ROW_HEIGHT_LABELS) as TableRowHeightPreset[]).map((preset) => ({ value: preset, label: ROW_HEIGHT_LABELS[preset] }))}
              onValueChange={(v) => apply({ type: "rowHeight", value: v as TableRowHeightPreset })} />
          </div>
        )}
      </ToolbarPopover>}
      {can.color && <GridColorTool {...context} />}
      {tools}
      <div className="aui-grid-end">
        {quickFilters && !phone && <div className="aui-grid-quick">{quickFilters}</div>}
        {iconSearch && <SearchToggle value={view.search} onChange={(value) => apply({ type: "search", value })} />}
        <span className="aui-grid-count" aria-live="polite">
          {selected ? <>已选择 {selected} 条{onClearSelection && <Button variant="text" size="sm" onClick={onClearSelection}>清除选择</Button>}</> : total === undefined ? null : matched !== undefined && matched !== total ? `${iconSearch ? "" : "筛选出 "}${matched} / ${total} 条` : iconSearch ? `${total} 条` : `共 ${total} 条`}
        </span>
        {more && more.some((section) => section.items.length > 0) && <MoreMenu sections={more} label="更多操作" size="sm" />}
        {actions && <div className="aui-grid-actions">{actions}</div>}
      </div>
    </div>
    </>
  );
}
