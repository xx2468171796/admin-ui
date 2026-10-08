"use client";
/**
 * KanbanBoard (bt/views V3, demo D06): records as cards in columns of a single-select field.
 *
 * - Columns = the field's options in order with their tones (option-tone.ts), plus 「未设置」 for empty
 *   or unknown values (collapsed by default). Column ⋯: collapse, colour (OptionSwatchPicker), hide,
 *   new record; hidden columns come back from 「隐藏的列」.
 * - Cards = RecordCard (cover, title, labelled fields). Drag a card between / within columns: a drop
 *   slot shows where it lands and a tooltip shows the change (「阶段：报价 → 成交」); Esc cancels.
 *   Keyboard: Alt+← / → moves the focused card to the neighbouring column, Alt+↑ / ↓ within the column;
 *   Shift+F10 / right-click opens 「移到…」. The board reports `onMove(recordId, toValue, beforeId)`;
 *   it shows the move at once and puts the card back if the promise rejects.
 * - Each column scrolls on its own and loads more (`columnMeta[key].hasMore` → `onLoadMore`); the
 *   board pages sideways with edge fades and ‹ › buttons; on phones columns snap.
 *
 * Data-source agnostic: pass the records already filtered and sorted (by the grid's view or the server).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, ChevronLeft, ChevronRight, Eye, Maximize2 } from "lucide-react";
import { ContextMenu, MenuButton, type MenuSection } from "../menu.tsx";
import { useAdminTheme } from "../theme.tsx";
import { useOptionalNotify } from "../notifications.tsx";
import { useIsMobile } from "../media-query.ts";
import { readField, summarizeField, type GridField } from "../grid-core.ts";
import type { MediaItem } from "../media-parts.tsx";
import type { OptionTone } from "../option-tone.ts";
import { scrollEdges } from "../scroll-strip-core.ts";
import { applyPendingMoves, columnValue, dropIndex, kanbanColumns, KANBAN_UNSET, keyboardMove, moveLabel, pageTo, placeCards, planMove, type KanbanColumnState, type PendingKanbanMove } from "./kanban-core.ts";
import { KanbanCollapsedColumn, KanbanColumnView, type KanbanColumnMeta } from "./kanban-column.tsx";
import { RecordCard, useCoverLightbox, type CoverLightboxOptions, type RecordCardDensity, type RecordCardSlots } from "./record-card.tsx";
import { KanbanHint, KanbanPills, useFlashHint } from "./kanban-parts.tsx";

/** An optimistic move: the `base` it was made on, `settled` once the host confirmed it. */
type InFlightMove = PendingKanbanMove & { key: number; base: Readonly<Record<string, readonly string[]>>; settled: boolean };
import { edgeScroll, trackPointer, useAnnouncer } from "./view-parts.tsx";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type { KanbanColumnMeta } from "./kanban-column.tsx";
export type KanbanBoardProps<T> = {
  /** Records to show, already filtered / sorted. */
  records: readonly T[];
  recordId: (record: T) => string;
  /** The single-select field the columns come from (its `options` and tones). */
  groupField: GridField<T>;
  /** Card title (the primary field's text). */
  cardTitle: (record: T) => string;
  /** Extra rows on each card (no field names unless `showLabels`; empty values take no row). */
  cardFields?: readonly GridField<T>[];
  /** The card's fixed slots: tags · money · region · owner · next follow-up (today / overdue) · comments. */
  cardSlots?: RecordCardSlots<T>;
  /** Field names in front of `cardFields` values (card setting 「显示字段名」, default false). */
  showLabels?: boolean;
  /** Why a card can't move (shown as the lock's tooltip and in the hint when it is grabbed); needs `canMove`. */
  lockReason?: (record: T) => string | null | undefined;
  /** Money / number field summed per column into the header (loaded cards; give `columnMeta[key].summary` for server totals). */
  sumField?: GridField<T>;
  /** After a move, a 「阶段：报价 → 谈判」 toast with 撤销 (default true; needs a NotificationProvider). */
  undo?: boolean;
  /** 「今天」 for the cards' next follow-up (today = attention, overdue = danger) and its time zone. */
  today?: string;
  timeZone?: string;
  /** The record's attachments (cover + count); omit for cards without a cover. */
  cardAttachments?: (record: T) => readonly MediaItem[] | null | undefined;
  density?: RecordCardDensity;
  /** Accessible name (「阶段看板」). */
  label: string;
  /** Collapsed / hidden columns and colour overrides; controlled with `onColumnStateChange`. */
  columnState?: KanbanColumnState;
  onColumnStateChange?: (next: KanbanColumnState) => void;
  /** Show the 「未设置」 column (default true) and its name. */
  showUnset?: boolean;
  unsetLabel?: string;
  /** Per column key (option value or KANBAN_UNSET): server total, more pages, loading. */
  columnMeta?: Readonly<Record<string, KanbanColumnMeta>>;
  onLoadMore?: (value: string | null) => void;
  /** Move a card; reject to put it back. `beforeId` = the card it now sits above (null = last). */
  onMove?: (recordId: string, toValue: string | null, beforeId: string | null) => void | Promise<void>;
  /** Cards that may not move (locked records). */
  canMove?: (record: T) => boolean;
  onOpen?: (record: T) => void;
  /** New record in a column (「+」 / 「+ 新建记录」). */
  onAdd?: (value: string | null) => void;
  /** Change a column's colour (column ⋯ → 更改颜色); also written to `columnState.tones`. */
  onColumnToneChange?: (value: string | null, tone: OptionTone) => void;
  /** Lightbox on cover click (default on when `cardAttachments` is given). */
  lightbox?: boolean | CoverLightboxOptions;
  selectedId?: string | null;
};

const NO_OPTIONS: readonly never[] = [];
type Drag = { id: string; from: string; width: number; height: number; offsetX: number; offsetY: number; x: number; y: number; over: { key: string; index: number } | null };

/** See the module comment. */
export function KanbanBoard<T>(props: KanbanBoardProps<T>) {
  const { records, recordId, groupField, cardTitle, cardFields, cardAttachments, density = "normal", label, showUnset = true, unsetLabel = "未设置", columnMeta, onLoadMore, onMove, canMove, onOpen, onAdd, onColumnToneChange, lightbox = true, selectedId } = props;
  const { portal } = useAdminTheme();
  const notify = useOptionalNotify();
  const phone = useIsMobile();
  const [flash, setFlash] = useFlashHint();
  const [current, setCurrent] = useState<string | null>(null);
  const options = groupField.options ?? NO_OPTIONS;
  const optionKey = options.map((o) => o.value).join("|");
  const [ownState, setOwnState] = useState<KanbanColumnState>({ collapsed: [KANBAN_UNSET] });
  const state = props.columnState ?? ownState;
  const setState = (next: KanbanColumnState) => (props.onColumnStateChange ? props.onColumnStateChange(next) : setOwnState(next));
  const allColumns = useMemo(() => kanbanColumns(options, { ...state, hidden: [] }, unsetLabel, showUnset), [options, state, unsetLabel, showUnset]);
  const hidden = new Set(state.hidden ?? []);
  const collapsed = new Set(state.collapsed ?? []);
  // Functions may be new on every host render; only new `records` (or options) re-place the cards and
  // drop an optimistic move, so a host re-render while a move is saving doesn't make the card jump back.
  const fns = useRef({ recordId, groupField });
  fns.current = { recordId, groupField };
  const byId = useMemo(() => new Map(records.map((r) => [fns.current.recordId(r), r])), [records]);
  const base = useMemo(() => placeCards(records, fns.current.recordId, (r) => readField(fns.current.groupField, r), options), [records, optionKey, groupField.key]);
  // Optimistic moves until the host confirms: re-applied over every new `base`, so confirming one move
  // (or any records update) doesn't throw away another that is still in flight. A confirmed move is
  // dropped once the records change after it (the host's data now has it).
  const [moves, setMoves] = useState<readonly InFlightMove[]>([]);
  const baseRef = useRef(base);
  baseRef.current = base;
  const moveSeq = useRef(0);
  useEffect(() => setMoves((list) => (list.some((m) => m.settled && m.base !== base) ? list.filter((m) => !m.settled || m.base === base) : list)), [base]);
  const placement = useMemo(() => (moves.length ? applyPendingMoves(base, moves) : base), [base, moves]);
  // 「未设置」 only shows while it has records.
  const unsetEmpty = !placement[KANBAN_UNSET]?.length && !columnMeta?.[KANBAN_UNSET]?.total;
  const columns = allColumns.filter((c) => !hidden.has(c.key) && !(c.key === KANBAN_UNSET && unsetEmpty));
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const suppressClick = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const lists = useRef(new Map<string, HTMLDivElement>());
  const [edges, setEdges] = useState({ start: false, end: false });
  const focusAfter = useRef<string | null>(null);
  const [live, announce] = useAnnouncer();
  const box = useCoverLightbox(typeof lightbox === "object" ? lightbox : {});
  const labelOf = (key: string) => allColumns.find((c) => c.key === key)?.label ?? key;
  const movable = (id: string) => Boolean(onMove) && (!canMove || canMove(byId.get(id) as T));

  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges((old) => {
      const next = scrollEdges(el.scrollLeft, el.scrollWidth, el.clientWidth);
      return old.start === next.start && old.end === next.end ? old : next;
    });
    // Phones: the column nearest the left edge is the current pill.
    const left = el.getBoundingClientRect().left;
    let best: string | null = null;
    let distance = Infinity;
    for (const [key, section] of sections.current) {
      const d = Math.abs(section.getBoundingClientRect().left - left);
      if (d < distance) {
        best = key;
        distance = d;
      }
    }
    setCurrent((old) => (old === best ? old : best));
  };
  useLayoutEffect(updateEdges);
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    const card = scroller.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
    (card?.querySelector<HTMLElement>(".aui-rcard-open") ?? card)?.focus();
  });

  const commit = (id: string, to: string, index: number, via: "pointer" | "key" | "undo") => {
    const plan = planMove(placement, id, to, index);
    if (!plan) return;
    const fromIndex = (placement[plan.move.from] ?? []).indexOf(id);
    const key = ++moveSeq.current;
    setMoves((list) => [...list.filter((m) => m.id !== id), { key, id, to, beforeId: plan.move.beforeId, base, settled: false }]);
    if (via === "key") focusAfter.current = id;
    const fromLabel = labelOf(plan.move.from);
    const toLabel = labelOf(to);
    announce(plan.move.from === to ? `已移到「${toLabel}」第 ${plan.move.index + 1} 张` : `${moveLabel(groupField.title, fromLabel, toLabel)}，第 ${plan.move.index + 1} 张`);
    Promise.resolve(onMove?.(id, columnValue(to), plan.move.beforeId)).then(
      // Records already updated since the move: done; otherwise keep it until they are.
      () => {
        setMoves((list) => (baseRef.current !== base ? list.filter((m) => m.key !== key) : list.map((m) => (m.key === key ? { ...m, settled: true } : m))));
        const record = byId.get(id);
        if (via !== "undo" && props.undo !== false && notify && plan.move.from !== to && record)
          notify.show({
            key: `kanban-move:${id}`,
            title: moveLabel(groupField.title, fromLabel, toLabel),
            description: cardTitle(record),
            tone: "success",
            // The latest commit (fresh placement), not this render's: the card has moved since.
            action: { label: "撤销", onClick: () => commitRef.current(id, plan.move.from, Math.max(0, fromIndex), "undo") },
          });
      },
      (error: unknown) => {
        setMoves((list) => list.filter((m) => m.key !== key));
        announce(`没有移动成功：${error instanceof Error ? error.message : "请重试"}`);
      },
    );
  };

  const commitRef = useRef(commit);
  commitRef.current = commit;
  const measureIndex = (key: string, y: number, id: string): number => {
    const list = lists.current.get(key);
    if (!list) return (placement[key] ?? []).filter((x) => x !== id).length;
    const cards = Array.from(list.querySelectorAll<HTMLElement>("[data-card-id]")).filter((el) => el.dataset.cardId !== id);
    // Virtual tops without the drop slot, so the slot never shifts the cards it is measured against.
    const listBox = list.getBoundingClientRect();
    let top = listBox.top + parseFloat(getComputedStyle(list).paddingTop || "0") - list.scrollTop;
    const gap = parseFloat(getComputedStyle(list).rowGap || "0") || 8;
    const rects = cards.map((el) => {
      const r = { top, height: el.offsetHeight };
      top += el.offsetHeight + gap;
      return r;
    });
    return dropIndex(rects, y);
  };
  const columnAt = (x: number, y: number): string | null => {
    for (const [key, el] of sections.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top - 40 && y <= r.bottom + 40) return key;
    }
    return null;
  };

  const lockText = (id: string) => {
    const record = byId.get(id);
    return (record !== undefined && props.lockReason?.(record)) || "这条记录不能移动";
  };
  const onCardPointerDown = (event: ReactPointerEvent<HTMLElement>, id: string, from: string) => {
    if (event.target instanceof Element && event.target.closest(".aui-rcard-cover-button")) return;
    if (!movable(id)) {
      if (onMove && event.button === 0) setFlash(lockText(id));
      return;
    }
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    trackPointer(event, {
      onStart: (e) => {
        setDrag({ id, from, width: rect.width, height: rect.height, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, x: e.clientX, y: e.clientY, over: null });
      },
      onMove: (e) => {
        const key = columnAt(e.clientX, e.clientY);
        const over = key === null ? null : { key, index: collapsed.has(key) ? (placement[key] ?? []).filter((x) => x !== id).length : measureIndex(key, e.clientY, id) };
        setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over } : d));
        edgeScroll(scroller.current, e.clientX, e.clientY, 56, 16);
        if (key && !collapsed.has(key)) edgeScroll(lists.current.get(key) ?? null, e.clientX, e.clientY, 40, 12);
      },
      onEnd: ({ cancelled, started }) => {
        const d = dragRef.current;
        setDrag(null);
        if (!started) return;
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        if (cancelled) announce("已取消移动");
        else if (d?.over) commit(id, d.over.key, d.over.index, "pointer");
      },
    });
  };

  const visibleKeys = columns.map((c) => c.key);
  const cardMenu = (id: string, from: string): MenuSection[] => {
    const record = byId.get(id);
    const targets = columns.filter((c) => c.key !== from);
    return [
      { items: [{ key: "open", label: "打开记录", icon: <Maximize2 size={15} />, shortcut: "Enter", disabled: !onOpen, onSelect: () => record && onOpen?.(record) }] },
      ...(movable(id)
        ? [{
            items: [
              {
                key: "move",
                label: "移到…",
                icon: <ArrowRightLeft size={15} />,
                hint: "Alt+← →",
                items: [{ items: targets.map((c) => ({ key: c.key, label: c.label, onSelect: () => commit(id, c.key, (placement[c.key] ?? []).length, "key") })) }],
              },
              { key: "up", label: "上移一张", shortcut: "Alt+↑", disabled: (placement[from] ?? []).indexOf(id) <= 0, onSelect: () => keyStep(id, "up") },
              { key: "down", label: "下移一张", shortcut: "Alt+↓", disabled: (placement[from] ?? []).indexOf(id) >= (placement[from] ?? []).length - 1, onSelect: () => keyStep(id, "down") },
            ],
          }]
        : []),
    ];
  };
  const keyStep = (id: string, dir: "up" | "down" | "left" | "right") => {
    const expanded = visibleKeys.filter((k) => !collapsed.has(k) || (placement[k] ?? []).includes(id));
    const target = keyboardMove(placement, expanded, id, dir);
    if (!target) {
      announce(dir === "left" || dir === "right" ? "已经是最边上的列" : "已经到头了");
      return;
    }
    commit(id, target.to, target.index, "key");
  };

  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const lefts = columns.map((c) => sections.current.get(c.key)?.offsetLeft ?? 0).map((l) => l - (el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetLeft : 0));
    el.scrollTo({ left: pageTo(lefts, el.scrollLeft, el.clientWidth, el.scrollWidth, dir), behavior: "smooth" });
  };
  const setCollapsed = (key: string, on: boolean) => setState({ ...state, collapsed: on ? [...collapsed, key] : [...collapsed].filter((k) => k !== key) });

  const sumText = (ids: readonly string[]) => {
    const field = props.sumField;
    if (!field) return undefined;
    const rows = ids.map((id) => byId.get(id)).filter((r): r is T => r !== undefined);
    return rows.length ? summarizeField(field, rows, "sum").text : undefined;
  };
  const pick = (key: string) => {
    const el = scroller.current;
    const section = sections.current.get(key);
    if (el && section) el.scrollTo({ left: section.offsetLeft - 12, behavior: "smooth" });
    setCurrent(key);
  };
  const dragged = drag ? byId.get(drag.id) : undefined;
  const overLabel = drag?.over ? labelOf(drag.over.key) : null;
  const slot = (key: string, index: number) =>
    drag?.over && drag.over.key === key && drag.over.index === index ? (
      <div className="aui-kanban-slot" style={{ height: drag.height }} aria-hidden="true">
        松开放到「{labelOf(key)}」
      </div>
    ) : null;

  return (
    <div className="aui-kanban" aria-label={label} role="region" data-dragging={drag ? "" : undefined} onClickCapture={(e) => {
      if (suppressClick.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    }}>
      {phone && columns.length > 1 && (
        <KanbanPills columns={columns} counts={Object.fromEntries(columns.map((c) => [c.key, columnMeta?.[c.key]?.total ?? (placement[c.key] ?? []).length]))} current={current} onPick={pick} />
      )}
      <div ref={scroller} className="aui-kanban-scroll" onScroll={updateEdges}>
        <div className="aui-kanban-track">
          {columns.map((column) => {
            const ids = placement[column.key] ?? [];
            const over = drag?.over?.key === column.key;
            const sectionRef = (el: HTMLElement | null) => (el ? sections.current.set(column.key, el) : sections.current.delete(column.key));
            if (collapsed.has(column.key)) {
              return <KanbanCollapsedColumn key={column.key} column={column} count={columnMeta?.[column.key]?.total ?? ids.length} over={Boolean(over)} sectionRef={sectionRef} onExpand={() => setCollapsed(column.key, false)} />;
            }
            const shown = ids.filter((id) => !(drag && drag.id === id && over));
            return (
              <KanbanColumnView
                key={column.key}
                column={column}
                count={ids.length}
                meta={columnMeta?.[column.key]}
                summary={columnMeta?.[column.key]?.summary ?? sumText(ids)}
                over={Boolean(over)}
                sectionRef={sectionRef}
                listRef={(el) => (el ? lists.current.set(column.key, el) : lists.current.delete(column.key))}
                addLabel="新建记录"
                onAdd={onAdd ? () => onAdd(columnValue(column.key)) : undefined}
                onLoadMore={onLoadMore ? () => onLoadMore(columnValue(column.key)) : undefined}
                onCollapse={() => setCollapsed(column.key, true)}
                onHide={() => setState({ ...state, hidden: [...hidden, column.key] })}
                onTone={(tone) => {
                  setState({ ...state, tones: { ...state.tones, [column.key]: tone } });
                  onColumnToneChange?.(columnValue(column.key), tone);
                }}
              >
                {shown.map((id, index) => {
                  const record = byId.get(id);
                  if (!record) return null;
                  const items = cardAttachments?.(record) ?? null;
                  return (
                    <div key={id} className="aui-kanban-item" role="listitem">
                      {slot(column.key, index)}
                      <ContextMenu label={`「${cardTitle(record)}」的操作`} sections={() => cardMenu(id, column.key)}>
                        <RecordCard
                          record={record}
                          title={cardTitle(record)}
                          fields={cardFields}
                          {...props.cardSlots}
                          today={props.today}
                          timeZone={props.timeZone}
                          showLabels={props.showLabels ?? false}
                          locked={onMove && !movable(id) ? lockText(id) : undefined}
                          attachments={items}
                          showCover={Boolean(items?.length)}
                          density={density}
                          selected={selectedId === id}
                          ghost={drag?.id === id}
                          onOpen={onOpen ? () => onOpen(record) : undefined}
                          onOpenCover={lightbox && items?.length ? (i) => box.open(items, i, `「${cardTitle(record)}」的附件`) : undefined}
                          rootProps={{
                            "data-card-id": id,
                            "data-movable": movable(id) ? "" : undefined,
                            // Without an open button the card itself takes focus so Alt+arrows can move it.
                            tabIndex: movable(id) && !onOpen ? 0 : undefined,
                            "aria-keyshortcuts": movable(id) ? "Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown" : undefined,
                            onPointerDown: (e) => onCardPointerDown(e, id, column.key),
                            onKeyDown: (e) => {
                              if (!e.altKey || !movable(id)) return;
                              const dir = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const)[e.key as "ArrowUp"];
                              if (!dir) return;
                              e.preventDefault();
                              keyStep(id, dir);
                            },
                          }}
                        />
                      </ContextMenu>
                    </div>
                  );
                })}
                {slot(column.key, shown.length)}
              </KanbanColumnView>
            );
          })}
          {hidden.size > 0 && (
            <div className="aui-kanban-hidden">
              <MenuButton
                variant="outline"
                size="sm"
                label={`隐藏的列 ${hidden.size}`}
                sections={[{ title: "点一下恢复", items: allColumns.filter((c) => hidden.has(c.key)).map((c) => ({ key: c.key, label: c.label, icon: <Eye size={15} />, onSelect: () => setState({ ...state, hidden: [...hidden].filter((k) => k !== c.key) }) })) }]}
              />
            </div>
          )}
        </div>
      </div>
      {edges.start && (
        <>
          <span className="aui-kanban-fade" data-side="start" aria-hidden="true" />
          <IconButton label="往左翻" variant="outline" className="aui-kanban-page" data-side="start" onClick={() => page(-1)} icon={<ChevronLeft size={16} aria-hidden="true" />} />
        </>
      )}
      {edges.end && (
        <>
          <span className="aui-kanban-fade" data-side="end" aria-hidden="true" />
          <IconButton label="往右翻" variant="outline" className="aui-kanban-page" data-side="end" onClick={() => page(1)} icon={<ChevronRight size={16} aria-hidden="true" />} />
        </>
      )}
      {drag && dragged && portal &&
        createPortal(
          <div className="aui-kanban-float" style={{ width: drag.width, left: drag.x - drag.offsetX, top: drag.y - drag.offsetY }} aria-hidden="true">
            <RecordCard record={dragged} title={cardTitle(dragged)} fields={cardFields} {...props.cardSlots} today={props.today} timeZone={props.timeZone} showLabels={props.showLabels ?? false} density={density} dragging />
          </div>,
          portal,
        )}
      {drag && <KanbanHint text={overLabel && drag.over?.key !== drag.from ? moveLabel(groupField.title, labelOf(drag.from), overLabel) : `拖到别的列改「${groupField.title}」`} />}
      {!drag && flash && <KanbanHint text={flash} locked />}
      {live}
      {box.element}
    </div>
  );
}
