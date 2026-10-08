"use client";
/**
 * Small pieces of KanbanBoard (review 08 item 2): the bottom hint bar while dragging
 * (「阶段：报价 → 谈判 · Esc 取消」, or why a locked card can't move), the phone column-switch pills, and
 * skeleton cards while a column loads.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { useAdminTheme } from "../theme.tsx";
import { revealInline } from "../scroll-reveal.ts";
import type { KanbanColumn } from "./kanban-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

/** Bottom-centred bar in the Provider portal while a card is dragged (or a locked card is grabbed). */
export function KanbanHint({ text, locked }: { text: ReactNode; locked?: boolean }) {
  const { portal } = useAdminTheme();
  if (!portal) return null;
  return createPortal(
    <div className="aui-kanban-hint" data-locked={locked || undefined} aria-hidden="true">
      {locked && <Lock size={14} aria-hidden="true" />}
      <span>{text}</span>
      {!locked && <span className="aui-kanban-hint-key">Esc 取消</span>}
    </div>,
    portal,
  );
}

/** A hint that goes away by itself (locked card grabbed). */
export function useFlashHint(ms = 2400): [string | null, (text: string) => void] {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [
    text,
    (next: string) => {
      clearTimeout(timer.current);
      setText(next);
      timer.current = setTimeout(() => setText(null), ms);
    },
  ];
}

export type KanbanPillsProps = {
  columns: readonly KanbanColumn[];
  counts: Readonly<Record<string, number>>;
  current: string | null;
  onPick: (key: string) => void;
};
/** Phones: one pill per column (label + count) above the board; the visible column is the current one. */
export function KanbanPills({ columns, counts, current, onPick }: KanbanPillsProps) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = current ? box.current?.querySelector<HTMLElement>(`[data-pill="${CSS.escape(current)}"]`) : null;
    // Only the pill strip scrolls (scrollIntoView dragged the whole page down to a board below the fold, 8.0.2).
    revealInline(el, box.current, 12);
  }, [current]);
  return (
    <div ref={box} className="aui-kanban-pills" role="tablist" aria-label="切换列">
      {columns.map((column) => (
        <button
          key={column.key}
          type="button"
          role="tab"
          aria-selected={column.key === current}
          className="aui-kanban-pill"
          data-pill={column.key}
          data-tone={column.tone}
          onClick={() => onPick(column.key)}
        >
          <span className="aui-kanban-pill-dot" aria-hidden="true" />
          {column.label}
          <span className="aui-kanban-count">{counts[column.key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/** Skeleton cards (loading a column): the card's shape, no spinner. */
export function KanbanSkeleton({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aui-kanban-skeleton" aria-hidden="true">
          <span className="aui-skel" />
          <span className="aui-skel" />
          <span className="aui-skel" />
        </div>
      ))}
    </>
  );
}
