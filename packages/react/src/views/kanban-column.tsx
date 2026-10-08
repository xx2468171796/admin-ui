"use client";
/** Columns of KanbanBoard (bt/views V3): the expanded column (header ⋯ menu, cards, drop slot, paging, add) and the collapsed strip. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, EyeOff, Palette, PanelLeftClose, Plus } from "lucide-react";
import { Button } from "../primitives.tsx";
import { type MenuSection } from "../menu.tsx";
import { PopoverPanel } from "../popover-panel.tsx";
import { OptionSwatchPicker } from "../option-swatch.tsx";
import type { OptionTone } from "../option-tone.ts";
import type { KanbanColumn } from "./kanban-core.ts";
import { KanbanSkeleton } from "./kanban-parts.tsx";
import { IconButton, MoreMenu } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type KanbanColumnMeta = {
  /** All records of the column on the server (header count); default: cards loaded. */
  total?: number;
  /** More cards can be loaded (`onLoadMore`). */
  hasMore?: boolean;
  loading?: boolean;
  /**
   * Column total in the header after the count (「US$ 649 万」) — from the server for the whole column,
   * so it stays right while only the first page of cards is loaded. Wins over KanbanBoard `sumField`.
   */
  summary?: ReactNode;
};

type ColumnProps = {
  column: KanbanColumn;
  count: number;
  meta: KanbanColumnMeta | undefined;
  children: ReactNode;
  /** Drop target while dragging. */
  over: boolean;
  listRef: (el: HTMLDivElement | null) => void;
  sectionRef: (el: HTMLElement | null) => void;
  onAdd?: () => void;
  onLoadMore?: () => void;
  onCollapse?: () => void;
  onHide?: () => void;
  onTone?: (tone: OptionTone) => void;
  addLabel: string;
  /** Header total (meta.summary, else the board's client sum). */
  summary?: ReactNode;
};

/** An expanded column. */
export function KanbanColumnView({ column, count, meta, children, over, listRef, sectionRef, onAdd, onLoadMore, onCollapse, onHide, onTone, addLabel, summary }: ColumnProps) {
  const head = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const total = meta?.total ?? count;
  const more = Boolean(meta?.hasMore && onLoadMore);
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;
  // Load the next page when the end of the list scrolls into view (the button stays for the keyboard).
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || meta?.loading || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadRef.current?.();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [more, meta?.loading]);
  const sections: MenuSection[] = [
    {
      items: [
        ...(onCollapse ? [{ key: "collapse", label: "收起这一列", icon: <PanelLeftClose size={15} />, onSelect: onCollapse }] : []),
        ...(onTone ? [{ key: "tone", label: "列颜色", icon: <Palette size={15} />, onSelect: () => setToneOpen(true) }] : []),
        ...(onAdd ? [{ key: "add", label: "在这一列新建记录", icon: <Plus size={15} />, onSelect: onAdd }] : []),
      ],
    },
    ...(onHide ? [{ items: [{ key: "hide", label: "隐藏这一列", hint: "可从「隐藏的列」恢复", icon: <EyeOff size={15} />, onSelect: onHide }] }] : []),
  ];
  return (
    <section ref={sectionRef} className="aui-kanban-col" data-col={column.key} data-over={over || undefined} aria-label={`${column.label}，${total} 条`}>
      <header ref={head} className="aui-kanban-head">
        <span className="aui-chip" data-tone={column.tone}>
          <span className="aui-chip-label">{column.label}</span>
        </span>
        <span className="aui-kanban-count">{total}</span>
        {summary !== undefined && summary !== null && summary !== "" && <span className="aui-kanban-sum">{summary}</span>}
        <span className="aui-kanban-head-tools">
          {onAdd && (
            <IconButton label={`在「${column.label}」新建记录`} className="aui-kanban-tool" onClick={onAdd} icon={<Plus size={15} aria-hidden="true" />} />
          )}
          {sections.some((s) => s.items.length) && (
            <MoreMenu sections={sections} label={`「${column.label}」列菜单`} className="aui-kanban-tool" />
          )}
        </span>
      </header>
      {onTone && (
        <PopoverPanel open={toneOpen} anchor={head.current} onClose={() => setToneOpen(false)} title={`「${column.label}」的颜色`} width={300}>
          <OptionSwatchPicker
            variant="inline"
            value={column.tone}
            sample={column.label}
            label={`「${column.label}」的颜色`}
            onChange={(tone) => {
              onTone(tone);
            }}
          />
        </PopoverPanel>
      )}
      <div ref={listRef} className="aui-kanban-list" role="list" aria-label={`${column.label}的卡片`}>
        {children}
        {count === 0 && meta?.loading && <KanbanSkeleton />}
        {count === 0 && !over && !meta?.loading && <p className="aui-kanban-empty">{onAdd ? "拖卡片到这里，或点 + 新建" : "拖卡片到这里"}</p>}
        {more && (
          <div ref={sentinel} className="aui-kanban-more">
            {meta?.loading && count > 0 && <KanbanSkeleton count={1} />}
            <Button variant="ghost" size="sm" disabled={meta?.loading} onClick={() => onLoadMore?.()}>
              {meta?.loading ? "加载中…" : meta?.total !== undefined ? `还有 ${Math.max(0, meta.total - count)} 条 · 滚到底自动加载` : "加载更多"}
            </Button>
          </div>
        )}
      </div>
      {onAdd && (
        <footer className="aui-kanban-foot">
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Plus size={14} aria-hidden="true" />
            {addLabel}
          </Button>
        </footer>
      )}
    </section>
  );
}

/** A collapsed column: a narrow strip with the vertical label and count; click to expand; still a drop target. */
export function KanbanCollapsedColumn({ column, count, over, sectionRef, onExpand }: { column: KanbanColumn; count: number; over: boolean; sectionRef: (el: HTMLElement | null) => void; onExpand: () => void }) {
  // The strip carries the column's option colour (a dot) so a collapsed 「成交」 still reads as 「成交」.
  return (
    <section ref={sectionRef} className="aui-kanban-col" data-col={column.key} data-collapsed="" data-over={over || undefined} aria-label={`${column.label}（已收起），${count} 条`}>
      <button type="button" className="aui-kanban-strip" aria-expanded={false} aria-label={`展开「${column.label}」列（${count} 条）`} onClick={onExpand}>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="aui-kanban-strip-dot" data-tone={column.tone} aria-hidden="true" />
        <span className="aui-kanban-strip-label">{column.label}</span>
        <span className="aui-kanban-count">{count}</span>
      </button>
    </section>
  );
}
