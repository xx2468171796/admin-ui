"use client";
/**
 * Geometry (fixed row heights, header / footer / group bars, the box height) and row virtualization of
 * BitableGrid; server blocks the viewport needs are requested from here.
 */
import { useCallback, useEffect, useLayoutEffect, type RefObject } from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import type { RowData } from "@tanstack/react-table";
import { useMediaQuery } from "./media-query.ts";
import { FONT_SIZE_PRESETS, useAdminTheme } from "./theme.tsx";
import type { TableCellBudget } from "./cell-budget.ts";
import { gridRowHeight, gridRowLines } from "./grid-core.ts";
import { useFillHeight } from "./use-fill-height.ts";
import { ADD_HEIGHT, FOOTER_HEIGHT, GROUP_HEIGHT, HEADER_HEIGHT, type BitableGridProps } from "./grid-props.ts";
import type { GridModel, useGridRows } from "./use-grid-layout.ts";

type Rows<T extends RowData> = ReturnType<typeof useGridRows<T>>;

/** Every data row has exactly the same height; touch screens get taller bars. */
export function useGridGeometry<T extends RowData>(props: BitableGridProps<T>, model: GridModel<T>, rows: Rows<T>, refs: { scroll: RefObject<HTMLDivElement | null>; panel: RefObject<HTMLDivElement | null> }) {
  const theme = useAdminTheme();
  const narrow = useMediaQuery("(max-width: 760px)");
  const summary = props.summary !== false;
  const fontScale = FONT_SIZE_PRESETS.find((preset) => preset.id === theme.fontSize)?.scale ?? 1;
  const rowHeight = gridRowHeight(model.view.rowHeight, { fontScale, touch: narrow });
  const lines = gridRowLines(model.view.rowHeight);
  const headerHeight = narrow ? 44 : HEADER_HEIGHT;
  const footerHeight = summary ? (narrow ? 44 : FOOTER_HEIGHT) : 0;
  const budget: TableCellBudget = { lines, clamped: true, compact: rowHeight < 40 };
  // Height: fill the window (default), fit the rows ("auto") or a fixed length.
  const heightMode = props.height === undefined || props.height === "fill" ? "fill" : props.height === "auto" ? "auto" : "fixed";
  const fillHeight = useFillHeight(refs.scroll, refs.panel, heightMode === "fill", props.fillOffset ?? 0, props.minHeight ?? 320);
  const count = rows.count;
  const contentHeight = headerHeight + footerHeight + Math.max(1, count) * rowHeight + 2;
  const boxHeight: number | string = heightMode === "fill" ? fillHeight ?? "clamp(320px, 70vh, 640px)"
    : heightMode === "auto" ? Math.min(props.maxHeight ?? 480, Math.max(props.minHeight ?? (count ? 0 : 200), contentHeight))
    : props.height ?? "auto";
  return { narrow, summary, rowHeight, lines, headerHeight, footerHeight, groupHeight: narrow ? 44 : GROUP_HEIGHT, addHeight: narrow ? 44 : ADD_HEIGHT, budget, boxHeight };
}
type Geometry = ReturnType<typeof useGridGeometry>;

/**
 * Row virtualization. The active row is always rendered (it holds focus and the input capture), without
 * stretching the fetched range to the whole table. The body stays mounted while the grid shows its loading
 * panel (an open editor keeps its draft).
 */
export function useGridVirtual<T extends RowData>(props: BitableGridProps<T>, model: GridModel<T>, rows: Rows<T>, geometry: Geometry, scrollRef: RefObject<HTMLDivElement | null>, activeRow: number) {
  const { server, remote, getRowId } = model;
  const { layout, count, clientRows } = rows;
  const rangeExtractor = useCallback((r: Range) => {
    const list = defaultRangeExtractor(r);
    if (activeRow >= 0 && activeRow < r.count && !list.includes(activeRow)) {
      list.push(activeRow);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [activeRow]);
  const getItemKey = useCallback((index: number) => {
    const at = layout.at(index);
    if (at?.kind === "group") return `__group:${at.group.key}`;
    if (at?.kind === "add") return `__add:${at.key}`;
    const offset = at?.offset ?? index;
    const row = server ? remote.rowAt(offset) : clientRows[offset];
    return row !== undefined ? getRowId(row) : `__i${index}`;
  }, [server, remote, clientRows, layout, getRowId]);
  const { rowHeight, groupHeight, addHeight, headerHeight, footerHeight } = geometry;
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const kind = layout.at(index)?.kind;
      return kind === "group" ? groupHeight : kind === "add" ? addHeight : rowHeight;
    },
    getItemKey,
    overscan: 6,
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight,
    scrollPaddingEnd: footerHeight,
    rangeExtractor,
    initialRect: { width: 1024, height: 560 },
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: row / group heights and the layout change the estimated sizes the virtualizer cached: re-measure.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight, groupHeight, layout]);
  // Rows stay mounted under the loading panel (busy) — only a failed load renders none.
  const shown = !rows.failure;
  const virtualItems = shown ? virtualizer.getVirtualItems() : [];
  // (The active row is always rendered, even far away: it must not stretch the range to the whole table.)
  const windowItems = virtualItems.length > 1 ? virtualItems.filter((item) => item.index !== activeRow) : virtualItems;
  const firstVisible = windowItems[0]?.index ?? 0;
  const lastVisible = windowItems.at(-1)?.index ?? (props.blockSize ?? 100) - 1;
  useEffect(() => {
    if (!server || rows.groupsPending) return;
    // Grouped: the rows shown between the headers (collapsed groups skipped).
    const span: [number, number] | null = layout.grouped ? layout.rowSpan(firstVisible, lastVisible + 20) : [firstVisible, lastVisible + 20];
    // The active row stays rendered when scrolled away: its block too.
    const activeAt = activeRow >= 0 ? layout.at(activeRow) : undefined;
    if (span) remote.ensure(span[0], span[1], activeAt?.kind === "row" ? activeAt.offset : undefined);
  }, [server, rows.groupsPending, layout, firstVisible, lastVisible, activeRow, remote.ensure]);
  return { virtualizer, virtualItems, bodyHeight: shown ? virtualizer.getTotalSize() : 0, lastVisible };
}
