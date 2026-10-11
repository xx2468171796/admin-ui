"use client";
/**
 * 多维表格 BitableGrid —— optional subpath `@adminui/react/grid` (peer deps @tanstack/react-table v9
 * and @tanstack/react-virtual v3; apps that never import it do not bundle either).
 *
 * Feishu Bitable / Airtable style: fixed row heights (矮 32 / 中 56 / 高 88 / 超高 120), frozen primary
 * column, drag to resize / reorder columns, hide fields, row-number column with checkbox + expand on
 * hover, the record-detail dialog (shared with DataTable), collapsible groups with counts, a summary
 * bar, search / filter / sort, roving-focus keyboard navigation and row virtualization; in-place
 * editing with optimistic saves, cell ranges, copy / cut / paste (Excel compatible), undo / redo;
 * client rows or a server data source with infinite scrolling; fills the window height by default.
 * DOM rendering with ARIA grid semantics; styles are scoped `.adminui .aui-grid-*` and follow --aui-*.
 *
 * This file is the composition shell. Module map (all in this package, see INTEGRATION.md「多维表格」):
 *   grid-props.ts            public props, item type, constants        grid-exports.ts  the rest of the public surface
 *   use-bitable-grid.ts      hook composition (core → interactions → menus)
 *   use-grid-model.ts        view (controlled / internal), data (client rows / server blocks), edit overlay
 *   use-grid-layout.ts       columns (live resize), rows pipeline + layout   use-grid-virtual.ts  geometry, virtualization
 *   use-grid-cursor.ts       active cell, range, focus, range drag    use-grid-edit-actions.ts  editing by record id, input capture
 *   use-grid-clipboard.ts    clear / copy / cut / paste / fill        use-grid-records.ts  selection, record detail, row moves
 *   use-grid-handle.ts       新增记录 + BitableGridHandle            grid-keyboard.ts / grid-keyboard-run.ts  key → command → run
 *   grid-context-menu.ts     cell / group / header context menus     grid-overlays.tsx  menus + summary picker
 *   grid-chrome.tsx          toolbar, loading / error / empty panel, menus around the scroll box
 *   grid-header-row.tsx / grid-body.tsx / grid-row.tsx (memoized rows) / grid-summary-row.tsx / grid-status.tsx / grid-capture.tsx
 *   pure cores: grid-core / grid-edit-core / grid-data-core / grid-capture-core / grid-editing-core / grid-controls-core
 */
import { useId, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import type { RowData } from "@tanstack/react-table";
import { useMediaQuery } from "./media-query.ts";
import { CellBudgetContext } from "./cell-budget.ts";
import { rangeContains } from "./grid-edit-core.ts";
import { GridBulkBar, GridMenus, GridStateOverlay, GridStatusLine, GridViewToolbar } from "./grid-chrome.tsx";
import { GridInnerTabIndex } from "./grid-tab-context.ts";
import { selectAllControl } from "./grid-controls-core.ts";
import { editorStartText } from "./grid-capture-core.ts";
import { GridHeaderRow } from "./grid-header-row.tsx";
import { GridBody } from "./grid-body.tsx";
import { GridSummaryRow } from "./grid-summary-row.tsx";
import type { GridColumnCell, GridRowContext, GridRowHandlers } from "./grid-row.tsx";
import { ALL_FIELD_ACTIONS, cellOf, type BitableGridProps } from "./grid-props.ts";
import { useStableHandlers } from "./use-stable-handlers.ts";
import { useGridCore, useGridInteractions, useGridMenus, type GridCore, type GridInteractions } from "./use-bitable-grid.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export * from "./grid-exports.ts";
export type { BitableGridProps, GridExpandRecord } from "./grid-props.ts";

type Menus<T extends RowData> = ReturnType<typeof useGridMenus<T>>;

/**
 * 多维表格: record lists users sort / group / filter / summarize / edit themselves — the standard
 * table of admin pages (client rows up to a few thousand; server `dataSource` for more).
 * See INTEGRATION.md「多维表格」.
 */
export function BitableGrid<T extends RowData>(props: BitableGridProps<T>) {
  const core = useGridCore(props);
  const act = useGridInteractions(core);
  const menus = useGridMenus(core, act);
  const { model, rows, geometry, refs } = core;
  const columns = useColumnCells(core);
  const captureLost = useRef(false);
  const ctx = useRowContext(core, act, captureLost);
  useCaptureFocus(refs.scrollRef, captureLost);
  return (
    <div ref={refs.panelRef} className="aui-grid-panel" data-row-height={model.view.rowHeight} data-editable={model.editing.enabled || undefined} aria-busy={rows.busy || rows.progress || undefined}
      style={{ "--aui-row-lines": geometry.lines, "--aui-grid-row-h": `${geometry.rowHeight}px` } as CSSProperties}>
      <GridViewToolbar core={core} />
      {props.banner}
      <div className="aui-grid-frame">
        {rows.progress && <div className="aui-top-progress aui-grid-loadbar" role="progressbar" aria-label="正在加载"><i /></div>}
        <GridFrame core={core} act={act} menus={menus} columns={columns} ctx={ctx} />
        <GridStateOverlay core={core} act={act} />
        <GridBulkBar selectable={act.selection.selectable} count={act.selection.selected.length} total={model.server ? model.remote.total ?? 0 : model.sourceRows.length}
          actions={act.selection.selected.length ? props.bulkActions?.(act.selection.selected) ?? [] : []} onClear={() => props.onSelectionChange?.([])} />
        <GridStatusLine status={model.editing.status} editing={model.editing} byKey={model.byKey} rowIndex={rows.indexOfRow} colIndex={core.colIndex} startEdit={act.edit.startEdit} />
      </div>
      {act.record.expand.element}
      <GridMenus core={core} menus={menus} />
    </div>
  );
}

/** Visible columns as the rows draw them; same widths / pinning → the same objects (memoized rows stay put). */
function useColumnCells<T extends RowData>(core: GridCore<T>): readonly GridColumnCell<T>[] {
  const { cols, start, end } = core.columns;
  const lastStart = start.at(-1)?.id;
  const firstEnd = end[0]?.id;
  const offset = (column: (typeof cols)[number]) => { const pin = column.getIsPinned(); return pin === "start" ? column.getStart("start") : pin === "end" ? column.getAfter("end") : 0; };
  const signature = cols.map((column) => `${column.id}:${column.getSize()}:${column.getIsPinned() || ""}:${offset(column)}`).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` encodes every column's id / width / pin / offset that the cells read (cols are new objects each render).
  return useMemo(() => cols.map((column, index): GridColumnCell<T> => {
    const pin = column.getIsPinned() || undefined;
    const sticky: CSSProperties = pin === "start" ? { position: "sticky", left: offset(column) } : pin === "end" ? { position: "sticky", right: offset(column) } : {};
    return { id: column.id, index, width: column.getSize(), style: { width: column.getSize(), ...sticky }, pin, edge: column.id === lastStart ? "start" : column.id === firstEnd ? "end" : undefined, field: core.model.byKey.get(column.id) ?? null };
  }), [signature, lastStart, firstEnd, core.model.byKey]);
}

/** What every row shares: configuration (memoized) and stable handlers — rows re-render only for their own changes. */
function useRowContext<T extends RowData>(core: GridCore<T>, act: GridInteractions<T>, captureLost: { current: boolean }): GridRowContext<T> {
  const { props, model, cursor } = core;
  const coarse = useMediaQuery("(pointer: coarse)");
  const on = useStableHandlers<GridRowHandlers>({
    cellPointerDown: cursor.onCellPointerDown,
    toggleCheckbox: act.edit.toggleCheckbox,
    setRating: act.edit.setRating,
    openRecord: (id) => act.record.expand.open(id),
    doubleClick: (row, col, id) => (col >= 0 && act.edit.canEditCell(row, col) && core.fieldAt(col)?.type !== "checkbox" ? act.edit.startEdit(row, col) : act.record.openRecord(id)),
    finishEdit: act.edit.finishEdit,
    draft: (text) => { const edit = act.edit.edit; if (edit) act.edit.draft.current = { rowId: edit.rowId, field: edit.field, text }; },
    toggleRow: act.selection.toggleRow,
    setShift: (shift) => { act.selection.shift.current = shift; },
    rowDragStart: (id) => act.rowDrag.start(id),
    fillStart: (event) => { if (cursor.effectiveRange) act.fill.start(cursor.effectiveRange)(event); },
    captureCompositionStart: act.edit.capture.onCompositionStart,
    captureCompositionEnd: act.edit.capture.onCompositionEnd,
    captureInput: act.edit.capture.onInput,
    captureLostFocus: () => { captureLost.current = true; },
  });
  const options = act.record.recordOptions;
  const isRowSelectable = props.isRowSelectable;
  return useMemo(() => ({
    primary: model.primary, byKey: model.byKey, colors: model.view.colors, conditionContext: model.conditionContext, editingEnabled: model.editing.enabled,
    selectable: act.selection.selectable, rowMoveEnabled: act.rowMove.enabled, expandable: Boolean(options), openOnTap: options?.openOnTap ?? false,
    capture: !coarse, people: props.peopleOptions, rowActions: props.rowActions, cellBadge: props.cellBadge, primaryText: model.primaryText,
    canSelect: (row: T) => isRowSelectable?.(row) !== false, scrollRef: core.refs.scrollRef, on,
  }), [model.primary, model.byKey, model.view.colors, model.conditionContext, model.editing.enabled, act.selection.selectable, act.rowMove.enabled, options, coarse, props.peopleOptions, props.rowActions, props.cellBadge, model.primaryText, isRowSelectable, core.refs.scrollRef, on]);
}

/**
 * A focused cell that has an input capture hands focus to it (clicks, Esc from inside a cell, tabbing in); a
 * focused capture that went away (the active cell moved by a paste / fill) passes focus to the new active cell.
 */
function useCaptureFocus(scrollRef: { current: HTMLDivElement | null }, lost: { current: boolean }) {
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const node = document.activeElement;
    if (!box) return;
    if (lost.current) {
      lost.current = false;
      if (!node || node === document.body) (box.querySelector<HTMLElement>("[data-grid-capture]") ?? box.querySelector<HTMLElement>("[data-cell][tabindex='0']"))?.focus({ preventScroll: true });
      return;
    }
    if (!(node instanceof HTMLElement) || node.dataset.cell === undefined || !box.contains(node)) return;
    node.querySelector<HTMLElement>(":scope > [data-grid-capture]")?.focus({ preventScroll: true });
  });
}

/** Fields being saved per record (keys joined), so only those rows re-render while saving. */
function useSavingByRow<T extends RowData>(core: GridCore<T>) {
  const overlay = core.model.editing.overlayVersion;
  return useMemo(() => {
    const out = new Map<string, string>();
    for (const cell of overlay.values()) if (cell.state === "saving") out.set(cell.rowId, [out.get(cell.rowId), cell.field].filter(Boolean).join("\u0000"));
    return out;
  }, [overlay]);
}

type FrameProps<T extends RowData> = { core: GridCore<T>; act: GridInteractions<T>; menus: Menus<T>; columns: readonly GridColumnCell<T>[] };
/** The scroll box: header, virtualized body, summary bar; keyboard, clipboard, context menu and focus tracking. */
function GridFrame<T extends RowData>({ core, act, menus, columns, ctx }: FrameProps<T> & { ctx: GridRowContext<T> }) {
  const { props, model, rows, geometry, refs, cursor } = core;
  const ariaRowCount = rows.count + 1 + (geometry.summary ? 1 : 0);
  const gridId = useId();
  const cellAt = (target: EventTarget) => {
    const node = (target as HTMLElement).closest<HTMLElement>("[data-cell]");
    return node && refs.scrollRef.current?.contains(node) && !(target as HTMLElement).closest(".aui-grid-editor") ? { node, at: cellOf(node) } : null;
  };
  return (
    <div ref={refs.scrollRef} id={gridId} className="aui-grid-scroll" role="grid" aria-label={props.caption ?? "多维表格"} aria-rowcount={ariaRowCount} aria-colcount={columns.length}
      aria-multiselectable={act.selection.selectable || undefined} aria-readonly={model.editing.enabled ? undefined : true} style={{ height: geometry.boxHeight, scrollPaddingTop: geometry.headerHeight, scrollPaddingBottom: geometry.footerHeight }}
      onKeyDown={menus.onKeyDown} onCopy={act.clip.handlers.onCopy} onCut={act.clip.handlers.onCut} onPaste={act.clip.handlers.onPaste}
      onMouseDown={(event) => {
        // Right click: no native focus scroll (it would close the menu); inside the selected range the range stays.
        const hit = event.button === 2 ? cellAt(event.target) : null;
        if (!hit?.at) return;
        event.preventDefault();
        if (!rangeContains(cursor.range, hit.at)) hit.node.focus({ preventScroll: true });
      }}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest(".aui-grid-editor, input, textarea:not([data-grid-capture])")) return;
        const hit = cellAt(event.target);
        if (hit && menus.openContextMenu(hit.node, { x: event.clientX, y: event.clientY }, false)) event.preventDefault();
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) act.setFocusWithin(false);
      }}
      onFocus={(event) => {
        act.setFocusWithin(true);
        const at = cellAt(event.target)?.at;
        if (at && (at.row !== cursor.cell.row || at.col !== cursor.cell.col)) cursor.setActive({ row: at.row, col: Number.isNaN(at.col) ? cursor.cell.col : at.col });
      }}>
      <GridInnerTabIndex.Provider value={-1}>
        <div className="aui-grid-canvas" style={{ width: core.columns.canvasWidth }}>
          <div role="rowgroup" className="aui-grid-head"><Header core={core} act={act} menus={menus} columns={columns} /></div>
          <Body core={core} act={act} menus={menus} columns={columns} ctx={ctx} />
          {geometry.summary && <div role="rowgroup" className="aui-grid-foot"><Footer core={core} act={act} menus={menus} columns={columns} ariaRowIndex={ariaRowCount} /></div>}
        </div>
      </GridInnerTabIndex.Provider>
    </div>
  );
}

/** The body stays mounted under the loading panel (an open editor keeps its draft): dimmed, not removed. */
function Body<T extends RowData>({ core, act, menus, columns, ctx }: FrameProps<T> & { ctx: GridRowContext<T> }) {
  const { model, rows, geometry, refs, cursor, virtual } = core;
  const saving = useSavingByRow(core);
  const { edit, location, draft } = act.edit;
  const width = core.columns.totalWidth;
  return (
    <div role="rowgroup" className="aui-grid-body" ref={refs.bodyRef} style={{ height: virtual.bodyHeight, opacity: rows.busy ? (edit ? 0.5 : 0) : undefined }}>
      <CellBudgetContext.Provider value={geometry.budget}>
        <GridBody items={virtual.virtualItems} itemAt={rows.itemAt} headerHeight={geometry.headerHeight} width={width} columns={columns} startCount={core.columns.start.length}
          cell={cursor.cell} ctx={ctx} numberAt={rows.numberAt} selected={act.selection.selectedSet} isStale={(offset) => model.server && model.remote.isStale(offset)} dragging={act.rowDrag.dragging}
          range={act.boxes.range} rangeBox={act.boxes.rangeBox} fillBox={act.boxes.fillBox} handleBox={act.boxes.handleBox}
          edit={edit && location?.kind === "here" ? { row: location.row, col: location.col, startText: editorStartText(edit, draft.current), error: edit.error, composing: edit.composing } : null}
          saving={saving} menuKey={menus.headerMenu?.key ?? null} collapsed={model.view.collapsed} groupBy={model.view.groupBy}
          summary={{ enabled: geometry.summary, kinds: model.view.summary, serverKinds: model.server ? model.caps?.summaries ?? [] : null, tree: rows.clientTree }}
          onToggleGroup={(key) => model.dispatch({ type: "toggleGroup", key })} onAddRow={(group) => void act.addRow.run(group)} />
      </CellBudgetContext.Provider>
      {act.rowDrag.drop && <span className="aui-grid-row-drop" aria-hidden="true" style={{ top: act.rowDrag.drop.top, width }} />}
    </div>
  );
}

function Header<T extends RowData>({ core, act, menus, columns }: FrameProps<T>) {
  const { props, model, geometry, cursor, columns: layout } = core;
  const fieldActions = (field: Parameters<NonNullable<typeof props.onFieldAction>>[1]) => (props.onFieldAction ? (typeof props.fieldActions === "function" ? props.fieldActions(field) : props.fieldActions ?? ALL_FIELD_ACTIONS) : []);
  return (
    <GridHeaderRow columns={columns} headRef={core.refs.headRef} height={geometry.headerHeight} width={layout.totalWidth} activeCol={cursor.cell.row === -1 ? cursor.cell.col : -1}
      view={model.view} primaryKey={model.primary?.key} frozenCount={layout.frozenCount} lastFrozenKey={layout.frozenKeys.at(-1)} freeze={act.freeze}
      freezeHeight={Math.max(geometry.headerHeight, core.box.height - geometry.footerHeight)}
      selectAll={act.selection.selectable ? selectAllControl({ interactive: core.rows.interactive, selectable: act.selection.selectableIds, selected: act.selection.selected }) : null}
      onSelectAll={(ids) => props.onSelectionChange?.(ids)} menuKey={menus.headerMenu?.key ?? null}
      resizeHandler={(key) => layout.headers.get(key)?.getResizeHandler()} isResizing={(key) => Boolean(layout.table.getColumn(key)?.getIsResizing?.())} fieldActions={fieldActions}
      on={{ dispatch: model.dispatch, openMenu: (key, anchor) => menus.setHeaderMenu({ key, anchor }), closeMenu: () => menus.setHeaderMenu(null), fieldAction: props.onFieldAction, addField: props.onAddField, beginResize: layout.beginResize }} />
  );
}

function Footer<T extends RowData>({ core, act, menus, columns, ariaRowIndex }: FrameProps<T> & { ariaRowIndex: number }) {
  const { props, model, rows, geometry, cursor } = core;
  return (
    <GridSummaryRow columns={columns} height={geometry.footerHeight} width={core.columns.totalWidth} ariaRowIndex={ariaRowIndex} rowIndex={rows.count} activeCol={cursor.cell.row === rows.count ? cursor.cell.col : -1}
      server={model.server} summary={model.view.summary} visibleKeys={model.visibleKeys} byKey={model.byKey} filtered={model.filtered} total={model.remote.total} serverSummaries={model.remote.state.summaries}
      addRow={{ show: rows.addRows && props.addRowButton !== false, adding: act.addRow.adding, run: () => void act.addRow.run({}) }}
      onPick={(key, anchor) => menus.setPopover({ key, anchor })} />
  );
}
