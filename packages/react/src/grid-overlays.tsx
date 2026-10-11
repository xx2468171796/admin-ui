"use client";
/**
 * Menus and popovers of BitableGrid (loaded lazily: not on the first paint): the field (header) menu, the cell / group
 * menu (grid-context-menu.ts decides it, its sections are built here) and the summary picker of the bottom bar.
 */
import { Check } from "lucide-react";
import { Button } from "./primitives.tsx";
import { Menu, type MenuSection } from "./menu.tsx";
import { GridPopover } from "./grid-popover.tsx";
import { summarizeField, summaryKindsFor, summaryLabel, type GridField, type GridSummaryKind, type GridView, type GridViewAction } from "./grid-core.ts";
import { gridCellMenu, gridGroupMenu, gridHeaderMenu, type GridFieldActionKind, type GridHeaderMenuItem } from "./grid-menus.tsx";
import { GRID_LIMITS, isGroupedBy } from "./grid-view-v2.ts";
import type { GridCellMenuState, GridMenuBuilders } from "./grid-context-menu.ts";
import type { RowData } from "@tanstack/react-table";
import { ALL_FIELD_ACTIONS } from "./grid-props.ts";
import type { GridCore, useGridMenus } from "./use-bitable-grid.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

const BUILDERS: GridMenuBuilders = { gridCellMenu, gridGroupMenu };

export type GridHeaderMenuState = { key: string; anchor: HTMLElement; point?: { x: number; y: number } };
export type GridSummaryPopover = { key: string; anchor: HTMLElement };

export type HeaderMenuInput<T> = {
  field: GridField<T>;
  primary: boolean;
  view: GridView;
  visibleKeys: readonly string[];
  frozen: number;
  can: { sort: boolean; filter: boolean; group: boolean };
  maxGroupLevels?: number;
  actions: readonly GridFieldActionKind[];
  extra: readonly GridHeaderMenuItem[];
  dispatch: (action: GridViewAction) => void;
  onFilterByField?: (field: GridField<T>) => void;
  onFieldAction?: (action: GridFieldActionKind, field: GridField<T>) => void;
  notify: (text: string) => void;
};

/** Sections of a field's header menu (sort / filter / group / hide / freeze / move / host field actions). */
export function headerMenuSections<T>(input: HeaderMenuInput<T>): MenuSection[] {
  const { field, view, visibleKeys, dispatch } = input;
  return gridHeaderMenu({
    field,
    primary: input.primary,
    index: visibleKeys.indexOf(field.key),
    visibleCount: visibleKeys.length,
    sort: view.sort.find((s) => s.key === field.key)?.direction ?? null,
    canSort: input.can.sort,
    canFilter: input.can.filter,
    canGroup: input.can.group,
    grouped: isGroupedBy(view, field.key),
    frozen: input.frozen,
    canFreeze: true,
    actions: input.actions,
    extra: input.extra,
    on: {
      sort: (direction) => dispatch({ type: "sortBy", key: field.key, direction }),
      filter: () => {
        if (input.onFilterByField) return input.onFilterByField(field);
        dispatch({ type: "addFilter", field: field.key });
        input.notify(`已添加「${field.title}」的筛选条件，在工具栏「筛选」里填写`);
      },
      // bt/grid-a: 「按此字段分组」 adds a level (up to the limit; replaces the last when full), 「取消分组」 removes this level.
      group: (on) => {
        const max = input.maxGroupLevels ?? GRID_LIMITS.maxGroupLevels;
        const others = view.groupBy.filter((level) => level.field !== field.key);
        dispatch({ type: "setGroups", levels: on ? [...others.slice(0, Math.max(0, max - 1)), { field: field.key, order: "asc" }] : others });
      },
      hide: () => dispatch({ type: "toggleHidden", key: field.key, hidden: true }),
      freeze: (n) => dispatch({ type: "freeze", count: n }),
      move: (to) => dispatch(to === "left" || to === "right" ? { type: "shift", key: field.key, delta: to === "left" ? -1 : 1 } : { type: "moveBefore", key: field.key, before: to === "first" ? visibleKeys.filter((key) => key !== field.key)[1] ?? null : null }),
      action: (kind) => input.onFieldAction?.(kind, field),
    },
  });
}

export type GridOverlaysProps<T> = {
  headerMenu: GridHeaderMenuState | null;
  headerField: GridField<T> | undefined;
  headerSections: readonly MenuSection[];
  onHeaderClose: () => void;
  cellMenu: GridCellMenuState | null;
  onCellClose: () => void;
  popover: GridSummaryPopover | null;
  popField: GridField<T> | undefined;
  /** Kinds the server computes (server mode). */
  serverKinds: readonly GridSummaryKind[] | null;
  current: Readonly<Record<string, GridSummaryKind>>;
  filtered: readonly T[];
  onPick: (key: string, kind: GridSummaryKind) => void;
  onPopoverClose: (returnFocus: boolean) => void;
};

export function GridOverlays<T>(props: GridOverlaysProps<T>) {
  const { headerMenu, cellMenu, popover, popField, serverKinds } = props;
  return (
    <>
      <Menu open={Boolean(props.headerField)} anchor={headerMenu?.anchor} point={headerMenu?.point} label={`${props.headerField?.title ?? ""}字段菜单`} sections={props.headerSections}
        returnFocus={headerMenu?.anchor} onClose={props.onHeaderClose} />
      <Menu open={Boolean(cellMenu)} point={cellMenu?.point} label={cellMenu?.label ?? "菜单"} sections={cellMenu ? cellMenu.build(BUILDERS) : []} initialFocus={cellMenu?.keyboard ? "first" : "menu"}
        returnFocus={cellMenu?.returnTo} onClose={props.onCellClose} />
      <GridPopover open={Boolean(popover && popField)} anchor={popover?.anchor ?? null} label={`${popField?.title}的统计方式`} onClose={props.onPopoverClose}>
        {popover && popField && (
          <div className="aui-grid-pop aui-grid-menu" role="group" aria-label="统计方式">
            {summaryKindsFor(popField.type).filter((kind) => !serverKinds || kind === "none" || kind === "count" || serverKinds.includes(kind)).map((kind) => {
              const preview = kind === "none" || serverKinds ? "" : summarizeField(popField, props.filtered, kind).text;
              const current = (props.current[popField.key] ?? "none") === kind;
              return (
                <Button key={kind} variant="ghost" size="sm" aria-pressed={current} onClick={() => props.onPick(popField.key, kind)}>
                  {current ? <Check /> : <span className="aui-grid-menu-gap" />}
                  <span className="aui-grid-menu-label">{summaryLabel(kind, popField.type)}</span>
                  {preview && <span className="aui-grid-menu-hint">{preview}</span>}
                </Button>
              );
            })}
          </div>
        )}
      </GridPopover>
    </>
  );
}

/** The field menu (header), the cell / group menu and the summary picker. */
export function GridMenus<T extends RowData>({ core, menus }: { core: GridCore<T>; menus: ReturnType<typeof useGridMenus<T>> }) {
  const { props, model } = core;
  const headerField = menus.headerMenu ? model.byKey.get(menus.headerMenu.key) : undefined;
  const popField = menus.popover ? model.byKey.get(menus.popover.key) : undefined;
  const closePopover = (returnFocus: boolean) => {
    const target = menus.popover?.anchor;
    menus.setPopover(null);
    if (returnFocus) target?.focus({ preventScroll: true });
  };
  const can = (cap: "filter" | "sort") => (!model.server || model.caps?.[cap] !== false) && props.toolbarFeatures?.[cap] !== false;
  const headerSections = headerField ? headerMenuSections({
    field: headerField, primary: headerField === model.primary, view: model.view, visibleKeys: model.visibleKeys, frozen: core.columns.frozenCount,
    can: { sort: can("sort"), filter: can("filter"), group: (!model.server || model.serverGroups) && props.toolbarFeatures?.group !== false },
    maxGroupLevels: props.limits?.maxGroupLevels,
    actions: props.onFieldAction ? (typeof props.fieldActions === "function" ? props.fieldActions(headerField) : props.fieldActions ?? ALL_FIELD_ACTIONS) : [],
    extra: props.headerMenuItems?.(headerField) ?? [], dispatch: model.dispatch, onFilterByField: props.onFilterByField, onFieldAction: props.onFieldAction,
    notify: (text) => model.editing.setStatus({ tone: "success", text }),
  }) : [];
  return (
    <GridOverlays headerMenu={menus.headerMenu} headerField={headerField} headerSections={headerSections} onHeaderClose={() => menus.setHeaderMenu(null)}
      cellMenu={menus.cellMenu} onCellClose={() => menus.setCellMenu(null)} popover={menus.popover} popField={popField}
      serverKinds={model.server ? model.caps?.summaries ?? [] : null} current={model.view.summary} filtered={model.filtered}
      onPick={(key, kind) => { model.dispatch({ type: "summary", key, kind }); closePopover(true); }} onPopoverClose={closePopover} />
  );
}
