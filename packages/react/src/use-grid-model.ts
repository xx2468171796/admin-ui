"use client";
/**
 * The model behind BitableGrid: the view (controlled or internal), the data (client rows or server blocks with
 * the edit overlay), the row pipeline (filter → sort → group → layout) and the items it lays out. Each part is a
 * small hook; useGridModel composes them. Columns, geometry and virtualization: use-grid-layout.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RowData } from "@tanstack/react-table";
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { fieldText, filterGridRows, gridGroupKey, gridViewReducer, normalizeGridView, primaryField, type GridField, type GridSummaryKind, type GridView, type GridViewAction } from "./grid-core.ts";
import type { ConditionContext } from "./condition-core.ts";
import { gridQueryOf } from "./grid-data-core.ts";
import { useGridServerData } from "./grid-data.ts";
import { useGridServerGroups } from "./grid-data-groups.ts";
import { useGridEditing } from "./grid-editing.ts";
import { whenIdle } from "./lazy-part.ts";
import { cellEditor } from "./grid-lazy-parts.ts";
import { withLocaleDefaults } from "./grid-locale-defaults.ts";
import { NO_ROWS, type BitableGridProps } from "./grid-props.ts";

/** View: controlled (view + onViewChange) or internal. Server sources group only with `loadGroups`. */
export function useGridViewState<T>(props: BitableGridProps<T>, fields: readonly GridField<T>[]) {
  const server = Boolean(props.dataSource);
  const [ownView, setOwnView] = useState(() => normalizeGridView(props.defaultView ?? {}, fields, { rowHeight: props.rowHeight }));
  const rawView = useMemo(() => normalizeGridView(props.view ?? ownView, fields, { rowHeight: props.rowHeight }), [props.view, ownView, fields, props.rowHeight]);
  const serverGroups = server && Boolean(props.dataSource?.loadGroups);
  const view = useMemo(() => (server && !serverGroups && rawView.groupBy.length ? { ...rawView, groupBy: [], collapsed: [] } : rawView), [server, serverGroups, rawView]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const controlled = props.view !== undefined;
  const onViewChangeRef = useRef(props.onViewChange);
  onViewChangeRef.current = props.onViewChange;
  const commit = useCallback((next: GridView) => {
    viewRef.current = next;
    if (!controlled) setOwnView(next);
    onViewChangeRef.current?.(next);
  }, [controlled]);
  const dispatch = useCallback((action: GridViewAction) => commit(gridViewReducer(viewRef.current, action, fields)), [commit, fields]);
  return { view, viewRef, commit, dispatch, server, serverGroups };
}

type ViewState = ReturnType<typeof useGridViewState>;

/** Client rows or server blocks (with group headers), the edit overlay over them, and the load state. */
export function useGridData<T>(props: BitableGridProps<T>, fields: readonly GridField<T>[], viewState: ViewState, conditionContext: ConditionContext) {
  const { view, server, serverGroups } = viewState;
  const { getRowId, summary = true } = props;
  const caps = props.dataSource?.capabilities;
  const visibleKeys = useMemo(() => view.order.filter((key) => !view.hidden.includes(key)), [view.order, view.hidden]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the view parts gridQueryOf reads, so a column resize / reorder keeps the query (and the server cache key).
  const query = useMemo(() => gridQueryOf(view, fields, { groups: serverGroups }), [view.search, view.filter, view.sort, view.groupBy, serverGroups, fields]);
  const serverSummaries = useMemo(() => {
    if (!server || !summary) return undefined;
    const allowed = caps?.summaries ?? [];
    return Object.fromEntries(visibleKeys.flatMap((key) => { const kind = view.summary[key]; return kind && allowed.includes(kind) ? [[key, kind]] : []; })) as Record<string, GridSummaryKind>;
  }, [server, summary, caps?.summaries, visibleKeys, view.summary]);
  const remoteGroups = useGridServerGroups(props.dataSource, query, { enabled: serverGroups, summaries: serverSummaries });
  // 8.9: a new grouped query's rows wait for its group headers, then both replace the previous ones at once.
  const groupsHold = serverGroups && Boolean(query.groups?.length) && remoteGroups.loading;
  const remote = useGridServerData(props.dataSource, query, getRowId, { enabled: server, blockSize: props.blockSize, summaries: serverSummaries, hold: groupsHold });
  const sourceRows = props.rows ?? NO_ROWS;
  const rowIndex = useMemo(() => (server ? null : new Map(sourceRows.map((row) => [getRowId(row), row]))), [server, sourceRows, getRowId]);
  const findRow = (id: string) => (server ? remote.findRow(id) : rowIndex?.get(id));
  const editing = useGridEditing<T>({ fields, getRowId, onCellsChange: props.onCellsChange, findRow, dataVersion: server ? remote.state.blocks : props.rows, onSaved: server ? remote.patch : undefined });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `overlayVersion` is the trigger — editing.present reads the edit overlay through a ref.
  const presentRows = useMemo(() => (server ? NO_ROWS : sourceRows.map(editing.present)), [server, sourceRows, editing.present, editing.overlayVersion]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the view parts filterGridRows reads (filter / search / hidden), so sorting or resizing does not refilter.
  const filtered = useMemo(() => (server ? NO_ROWS : filterGridRows(presentRows, fields, view, conditionContext)), [server, presentRows, fields, view.filter, view.search, view.hidden, conditionContext]);
  return { query, remote, remoteGroups, groupsHold, editing, sourceRows, findRow, filtered, visibleKeys, caps };
}

type DataState<T> = ReturnType<typeof useGridData<T>>;

/** Loading / error state: only the very first load shows the loading panel, later queries a thin progress bar. */
export function gridLoadState<T>(props: BitableGridProps<T>, viewState: ViewState, data: DataState<T>, shownNodes: unknown) {
  const { view, server, serverGroups } = viewState;
  const { remote, remoteGroups, groupsHold } = data;
  const groupsPending = serverGroups && view.groupBy.length > 0 && remote.state.key === remote.key && shownNodes === null && !remoteGroups.error;
  const busy = Boolean(props.loading) || (server && remote.firstLoading) || groupsPending;
  const progress = !busy && server && (remote.pending || groupsHold);
  const failure = props.error ?? (server ? remote.firstError ?? (view.groupBy.length ? remoteGroups.error : null) ?? undefined : undefined);
  return { groupsPending, busy, progress, failure, interactive: !busy && !failure };
}

/** Fields with AdminProvider defaults, the condition context (time zone default), and the view + data hooks. */
export function useGridModel<T extends RowData>(props: BitableGridProps<T>) {
  const localeDefaults = useAdminDefaults();
  const fields = useMemo(() => withLocaleDefaults(props.fields, localeDefaults), [props.fields, localeDefaults]);
  const conditionContext = useMemo<ConditionContext>(() => (props.conditionContext?.timeZone ? props.conditionContext : { ...props.conditionContext, timeZone: localeDefaults.timeZone }), [props.conditionContext, localeDefaults.timeZone]);
  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const primary = primaryField(fields);
  const viewState = useGridViewState(props, fields);
  const data = useGridData(props, fields, viewState, conditionContext);
  // An editable grid fetches its cell editors while idle, so the first keystroke opens a ready editor.
  const editable = data.editing.enabled;
  useEffect(() => (editable ? whenIdle(cellEditor.preload) : undefined), [editable]);
  const { getRowId } = props;
  const primaryText = useCallback((row: T) => (primary ? fieldText(primary, row) : "") || getRowId(row), [primary, getRowId]);
  /** Group keys of a record under the shown levels (its header path). */
  const shownLevels = viewState.server ? data.remote.shownQuery.groups ?? NO_ROWS : viewState.view.groupBy;
  const groupPath = (row: T) => shownLevels.map((level) => { const field = byKey.get(level.field); return field ? gridGroupKey(field, row) : ""; });
  return { getRowId, fields, byKey, primary, primaryText, conditionContext, ...viewState, ...data, shownLevels, groupPath };
}
