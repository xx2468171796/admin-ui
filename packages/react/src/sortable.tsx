"use client";
/**
 * SortableList (bt/foundations F0.3): a vertical list the user reorders by dragging a grip or with the
 * keyboard — field panels (D05), group levels (D17), sort rows (D17b), view manager (D16), option
 * editors (D12), form builders (D08). Rules live in sortable-core.ts: locked rows stay put and nothing
 * passes them; optional groups (two levels) collapse and items move between them.
 *
 * - Pointer: drag the grip; a line shows where it lands; the list's scroll box scrolls near its edges.
 * - Keyboard on the grip: Alt+↑ / Alt+↓ moves one step; Space / Enter lifts, ↑ / ↓ move, Space / Enter
 *   drops, Esc puts it back. Every step is announced (aria-live), focus stays on the moved grip.
 * - The host owns the data: `onChange(next, move)` gets the new tree; render rows with `renderItem`.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, GripVertical, Lock } from "lucide-react";
import { dropTarget, locate, moveNode, positionText, stepTarget, visibleRows, canPickUp, type SortableAllow, type SortableNode, type SortableTarget } from "./sortable-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/sortable.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/sortable.css";

export type SortableMove = { id: string; from: SortableTarget; to: SortableTarget };
export type SortableListProps<T extends SortableNode<T>> = {
  items: readonly T[];
  onChange: (next: T[], move: SortableMove) => void;
  /** Row content right of the grip (name, icons, eye toggle …). */
  renderItem: (item: T, state: { depth: 0 | 1; locked: boolean; dragging: boolean }) => ReactNode;
  /** Group header content right of the collapse toggle (name, 「3 个字段」, group eye …). Default: the label. */
  renderGroup?: (group: T, state: { collapsed: boolean; count: number }) => ReactNode;
  /** Plain name of a row for the grip's label and the announcements. */
  itemLabel: (item: T) => string;
  /** Accessible name of the list (「字段顺序」). */
  label: string;
  /** Collapsed groups (controlled); omit to let the list keep it. */
  collapsed?: ReadonlySet<string>;
  onCollapsedChange?: (next: ReadonlySet<string>) => void;
  /** Why locked rows can't move (grip tooltip), e.g. 「主字段固定在第一列」. */
  lockedHint?: string;
  /** Compact rows (28px) for popovers; default 32px. */
  dense?: boolean;
  /**
   * Extra rule for where a row may land (pointer, keyboard): e.g. items only inside groups —
   * `(item, target) => item.children !== undefined || target.parent !== null`.
   */
  canDrop?: SortableAllow<T>;
};

type Indicator = { top: number; indent: number } | null;
type Lifted = { id: string; from: SortableTarget } | null;

export function SortableList<T extends SortableNode<T>>({ items, onChange, renderItem, renderGroup, itemLabel, label, collapsed: collapsedProp, onCollapsedChange, lockedHint = "这一项固定，不能移动", dense, canDrop }: SortableListProps<T>) {
  const help = useId();
  const box = useRef<HTMLDivElement>(null);
  const [ownCollapsed, setOwnCollapsed] = useState<ReadonlySet<string>>(new Set());
  const collapsed = collapsedProp ?? ownCollapsed;
  const setCollapsed = (next: ReadonlySet<string>) => (onCollapsedChange ? onCollapsedChange(next) : setOwnCollapsed(next));
  const [announcement, setAnnouncement] = useState("");
  const [lifted, setLifted] = useState<Lifted>(null);
  const [drag, setDrag] = useState<{ id: string; target: SortableTarget | null } | null>(null);
  const [indicator, setIndicator] = useState<Indicator>(null);
  const focusAfter = useRef<string | null>(null);
  const pointer = useRef<{ id: string; x: number; y: number; started: boolean; scroller: HTMLElement | null } | null>(null);
  const rows = visibleRows(items, collapsed);
  const groupName = (group: T) => itemLabel(group);
  const announce = (text: string) => setAnnouncement((old) => (old === text ? `${text} ` : text));

  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    box.current?.querySelector<HTMLElement>(`[data-sortable-handle="${CSS.escape(id)}"]`)?.focus({ preventScroll: false });
  });
  useEffect(() => {
    if (!lifted) return;
    // Clicking elsewhere drops the lifted row where it is now.
    const onDown = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && box.current?.contains(event.target)) return;
      setLifted(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [lifted]);

  const nameOf = (id: string) => {
    const row = rows.find((r) => r.node.id === id);
    return row ? itemLabel(row.node) : "";
  };
  const commit = (id: string, target: SortableTarget, verb: string) => {
    const from = locate(items, id);
    const next = moveNode(items, id, target, canDrop);
    if (!next || !from) return false;
    focusAfter.current = id;
    onChange(next, { id, from, to: target });
    announce(`${verb}「${nameOf(id)}」，${positionText(next, id, groupName)}`);
    return true;
  };
  const step = (id: string, dir: -1 | 1, verb: string) => {
    const target = stepTarget(items, id, dir, collapsed, canDrop);
    if (!target) {
      announce(dir === -1 ? `「${nameOf(id)}」不能再往上了` : `「${nameOf(id)}」不能再往下了`);
      return;
    }
    commit(id, target, verb);
  };

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>, node: T) => {
    const id = node.id;
    const up = event.key === "ArrowUp";
    const down = event.key === "ArrowDown";
    if (lifted?.id === id) {
      if (up || down) {
        event.preventDefault();
        step(id, up ? -1 : 1, "移到");
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setLifted(null);
        announce(`已放下「${nameOf(id)}」，${positionText(items, id, groupName)}`);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        const back = lifted.from;
        setLifted(null);
        const now = locate(items, id);
        if (now && (now.parent !== back.parent || now.index !== back.index)) {
          const restored = moveNode(items, id, back);
          if (restored) {
            focusAfter.current = id;
            onChange(restored, { id, from: now, to: back });
          }
        }
        announce(`已取消，「${nameOf(id)}」放回原处`);
      } else if (event.key === "Tab") setLifted(null);
      return;
    }
    if ((up || down) && event.altKey) {
      event.preventDefault();
      step(id, up ? -1 : 1, "已把");
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const from = locate(items, id);
      if (!from) return;
      setLifted({ id, from });
      announce(`已拿起「${nameOf(id)}」，${positionText(items, id, groupName)}。用上下方向键移动，空格放下，Esc 取消`);
    }
  };

  // ---------------------------------------------------------------- pointer
  const scrollerOf = (node: HTMLElement | null) => {
    for (let el = node?.parentElement ?? null; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
    }
    return null;
  };
  const measure = (clientY: number, id: string) => {
    const list = box.current;
    if (!list) return;
    const els = [...list.querySelectorAll<HTMLElement>("[data-sortable-row]")];
    if (!els.length) return;
    let over = els.length - 1;
    let edge: "before" | "after" = "after";
    for (let i = 0; i < els.length; i++) {
      const r = els[i]!.getBoundingClientRect();
      if (clientY < r.bottom) {
        over = i;
        edge = clientY < r.top + r.height / 2 ? "before" : "after";
        break;
      }
    }
    const target = dropTarget(items, rows, id, over, edge, collapsed, canDrop);
    setDrag({ id, target });
    if (!target) {
      setIndicator(null);
      return;
    }
    // The line sits on the edge of the row it was computed from (after a group header = top of its first item).
    const r = els[over]!.getBoundingClientRect();
    const top = (edge === "before" ? r.top : r.bottom) - list.getBoundingClientRect().top;
    setIndicator({ top, indent: target.parent === null ? 0 : 1 });
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, node: T) => {
    if (event.button !== 0 || !canPickUp(items, node.id)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    pointer.current = { id: node.id, x: event.clientX, y: event.clientY, started: false, scroller: scrollerOf(box.current) };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const p = pointer.current;
    if (!p) return;
    if (!p.started) {
      if (Math.abs(event.clientY - p.y) + Math.abs(event.clientX - p.x) < 4) return;
      p.started = true;
      announce(`正在拖动「${nameOf(p.id)}」`);
    }
    const s = p.scroller;
    if (s) {
      const r = s.getBoundingClientRect();
      if (event.clientY < r.top + 24) s.scrollTop -= 8;
      else if (event.clientY > r.bottom - 24) s.scrollTop += 8;
    }
    measure(event.clientY, p.id);
  };
  const endPointer = (cancel: boolean) => {
    const p = pointer.current;
    pointer.current = null;
    const target = drag?.target;
    setDrag(null);
    setIndicator(null);
    if (!p?.started) return;
    if (cancel || !target || !commit(p.id, target, "已把")) announce(`「${nameOf(p.id)}」没有移动`);
  };

  // ---------------------------------------------------------------- render
  const grip = (node: T, depth: 0 | 1) => {
    const movable = canPickUp(items, node.id);
    const name = itemLabel(node);
    if (!movable)
      return (
        <span className="aui-sortable-lock" data-tip={lockedHint} aria-label={`「${name}」${lockedHint}`} role="img">
          <Lock aria-hidden="true" />
        </span>
      );
    return (
      <button
        type="button"
        className="aui-sortable-grip"
        data-sortable-handle={node.id}
        data-lifted={lifted?.id === node.id || undefined}
        aria-label={`移动「${name}」`}
        aria-roledescription="可拖动"
        aria-describedby={help}
        aria-pressed={lifted?.id === node.id}
        data-depth={depth}
        onKeyDown={(event) => onHandleKey(event, node)}
        onPointerDown={(event) => onPointerDown(event, node)}
        onPointerMove={onPointerMove}
        onPointerUp={() => endPointer(false)}
        onPointerCancel={() => endPointer(true)}
        onBlur={() => {
          if (lifted?.id === node.id && !focusAfter.current) setLifted(null);
        }}
      >
        <GripVertical aria-hidden="true" />
      </button>
    );
  };
  const rowState = (node: T) => ({ dragging: drag?.id === node.id || lifted?.id === node.id, locked: !canPickUp(items, node.id) });
  const itemRow = (node: T, depth: 0 | 1) => {
    const state = rowState(node);
    return (
      <div key={node.id} role="listitem" className="aui-sortable-row" data-sortable-row data-depth={depth} data-dragging={state.dragging || undefined} data-locked={state.locked || undefined}>
        {grip(node, depth)}
        <div className="aui-sortable-content">{renderItem(node, { depth, ...state })}</div>
      </div>
    );
  };

  return (
    <div ref={box} className="aui-sortable" role="list" aria-label={label} data-dense={dense || undefined} data-dragging={drag ? true : undefined}>
      {items.map((node) => {
        if (node.children === undefined) return itemRow(node, 0);
        const isCollapsed = collapsed.has(node.id);
        const state = rowState(node);
        const name = itemLabel(node);
        const toggle = () => {
          const next = new Set(collapsed);
          if (isCollapsed) next.delete(node.id);
          else next.add(node.id);
          setCollapsed(next);
        };
        return (
          <div key={node.id} role="listitem" className="aui-sortable-group" aria-label={name}>
            <div className="aui-sortable-row" data-group data-sortable-row data-depth={0} data-dragging={state.dragging || undefined} data-locked={state.locked || undefined}>
              {grip(node, 0)}
              <button type="button" className="aui-sortable-toggle" aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? "展开" : "收起"}「${name}」`} onClick={toggle}>
                {isCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </button>
              <div className="aui-sortable-content">{renderGroup ? renderGroup(node, { collapsed: isCollapsed, count: node.children.length }) : name}</div>
            </div>
            {!isCollapsed && node.children.length > 0 && (
              <div role="list" aria-label={name} className="aui-sortable-children">
                {node.children.map((child) => itemRow(child, 1))}
              </div>
            )}
          </div>
        );
      })}
      {indicator && <div className="aui-sortable-indicator" aria-hidden="true" style={{ top: indicator.top, insetInlineStart: indicator.indent ? 40 : 4 }} />}
      <span id={help} hidden>
        拖动这个把手，或按 Alt + 上 / 下方向键移动；也可以按空格拿起，用上下方向键移动，再按空格放下，Esc 取消。
      </span>
      <div className="aui-sr-only" aria-live="assertive" aria-atomic="true">{announcement}</div>
    </div>
  );
}
