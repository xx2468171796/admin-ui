"use client";
/**
 * Group header row of BitableGrid (bt/grid-a G4, D17): indented per level, fold chevron, field name,
 * the group value drawn like its cells (option chip, people), record count, and — when the view has
 * column summaries — each column's statistic for the group under that column.
 */
import type { CSSProperties, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CellPeople } from "./cells.tsx";
import { resolveOptionTone } from "./option-tone.ts";
import { groupLabel, type GridGroup } from "./grid-group-core.ts";
import type { GridField } from "./grid-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export type GridGroupSummaryCell = { id: string; colIndex: number; style: CSSProperties; numeric?: boolean; label?: string; text?: string; pin?: string; edge?: string };

/** The group value as the grid draws it: option chip, people, or text. */
export function GroupValue<T>({ group, field }: { group: GridGroup<T>; field: GridField<T> | undefined }) {
  const label = groupLabel(group, field);
  if (!field || group.value === "" || group.label !== undefined) return <strong className="aui-grid-group-label">{label}</strong>;
  if (field.type === "singleSelect") {
    const option = field.options?.find((o) => o.value === group.value);
    return <span className="aui-grid-group-label"><span className="aui-chip" data-tone={resolveOptionTone(option)}><span className="aui-chip-label">{label}</span></span></span>;
  }
  if (field.type === "user") return <span className="aui-grid-group-label"><CellPeople label={field.title} people={group.value.split("\u0001").map((name) => ({ name }))} /></span>;
  return <strong className="aui-grid-group-label">{label}</strong>;
}

export function GridGroupRow<T>({ group, field, index, style, folded, cellId, tabbable, colCount, startCount, startWidth, summaries, onToggle }: {
  group: GridGroup<T>;
  field: GridField<T> | undefined;
  /** Item index (aria-rowindex = index + 2). */
  index: number;
  style: CSSProperties;
  folded: boolean;
  /** data-cell of the focusable label cell. */
  cellId: string;
  tabbable: boolean;
  colCount: number;
  /** Frozen columns the label spans and their width (used when summaries are shown). */
  startCount: number;
  startWidth: number;
  /** Per-column statistics; null = one full-width cell. */
  summaries: readonly GridGroupSummaryCell[] | null;
  onToggle: () => void;
}) {
  const inner: ReactNode = (
    <span className="aui-grid-group-inner" style={{ paddingInlineStart: 12 + group.level * 18 }}>
      {folded ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      <span className="aui-grid-group-field">{field?.title}</span>
      <GroupValue group={group} field={field} />
      <span className="aui-grid-group-count">{group.count} 条</span>
      <span className="aui-sr-only">{folded ? "，已收起，回车展开" : "，已展开，回车收起"}</span>
    </span>
  );
  return (
    <div role="row" aria-rowindex={index + 2} aria-expanded={!folded} aria-level={group.level + 1} className="aui-grid-row aui-grid-group" data-level={group.level} data-empty-group={group.empty || undefined} data-row-index={index} data-group-key={group.key} style={style}>
      <div role="gridcell" aria-colindex={1} aria-colspan={summaries ? startCount : colCount} className="aui-grid-group-cell" data-cell={cellId} tabIndex={tabbable ? 0 : -1}
        data-pin={summaries ? "start" : undefined} data-pin-edge={summaries ? "start" : undefined}
        style={summaries ? { width: startWidth, flex: "0 0 auto", position: "sticky", left: 0, zIndex: 2 } : undefined} onClick={onToggle}>
        {inner}
      </div>
      {summaries?.map((cell) => (
        <div key={cell.id} role="gridcell" aria-colindex={cell.colIndex} className="aui-grid-cell aui-grid-group-sum" data-numeric={cell.numeric || undefined} data-pin={cell.pin} data-pin-edge={cell.edge} style={cell.style}
          data-tip={cell.text ? `${cell.label} ${cell.text}` : undefined} onClick={onToggle}>
          {cell.text ? <><span className="aui-grid-summary-label">{cell.label}</span><span className="aui-grid-summary-value">{cell.text}</span></> : null}
        </div>
      ))}
    </div>
  );
}
