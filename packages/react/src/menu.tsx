"use client";
/**
 * Menu / ContextMenu / MenuButton (bt/foundations F0.1): one data-driven menu for cell and header
 * right-click menus, column ⋯ menus, event menus and split buttons. Items come in sections (optional
 * titles), carry an icon, a shortcut hint, a right-aligned note, a count, a submenu, a danger tone or a
 * disabled reason. Opens at the pointer (ContextMenu, `point`) or under an element (`anchor`), flips and
 * clamps to the viewport (menu-core `placeLayer`), renders into the Provider portal (inside a Dialog:
 * into the dialog), and follows the WAI-ARIA menu pattern: arrows / Home / End, Enter / Space, → opens a
 * submenu, ← / Esc closes it, type-ahead, Tab closes; focus returns to where it came from.
 */
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight } from "lucide-react";
import { Button, cn, type ButtonProps } from "./primitives.tsx";
import { useAdminTheme } from "./theme.tsx";
import { menuLabel, menuScrollAction, menuTypeahead, nextMenuIndex, rectsOverlap, type LayerPlacement, type LayerPoint } from "./menu-core.ts";
import { LAYER_ATTR, layerHost, rectOf, useLayerPosition, type LayerTarget } from "./floating-layer.ts";
import { Kbd } from "./tooltip.tsx";
import { useIsMobile } from "./media-query.ts";
import type { ActionSheetProps } from "./action-sheet.tsx";
import { lazyPart, whenIdle } from "./lazy-part.ts";

// Phones show menus as an action sheet (a bottom dialog); that module loads the first time a sheet opens.
const sheetPart = lazyPart(() => import("./action-sheet.tsx").then((m) => m.ActionSheet));
const ActionSheet = sheetPart.Part as (props: ActionSheetProps) => ReactNode;

export type MenuItem = {
  key: string;
  /** Visible text; `{count}` is replaced by `count` (「删除所选 {count} 条记录」). */
  label: string;
  icon?: ReactNode;
  /** Keyboard shortcut shown on the right, e.g. 「Ctrl+C」 (display only; the host binds the keys). */
  shortcut?: string;
  /** A short note on the right (「谁能看 / 改」「0 → 9」「双击表头」). */
  hint?: string;
  count?: number;
  /** Destructive (danger colour). Put it in the last section. */
  danger?: boolean;
  disabled?: boolean;
  /** Why it is unavailable: shown under the label; the item stays focusable so it can be read. */
  disabledReason?: string;
  /** A toggle item (menuitemcheckbox) with a check mark when true. */
  checked?: boolean;
  onSelect?: () => void;
  /** A submenu (opens on hover, click, → or Enter). */
  items?: readonly MenuSection[];
  /** Accessible name when the visible label is not enough. */
  ariaLabel?: string;
};
export type MenuSection = { key?: string; /** Optional small heading above the section. */ title?: string; items: readonly MenuItem[] };
export type MenuCloseReason = "select" | "escape" | "outside" | "tab" | "scroll";

export type MenuProps = {
  open: boolean;
  /** Called with why it closed; set `open` false. Focus is already returned when it matters. */
  onClose: (reason: MenuCloseReason) => void;
  sections: readonly MenuSection[];
  /** Accessible name of the menu. */
  label: string;
  /** Open under this element (MenuButton, column ⋯, split button) … */
  anchor?: HTMLElement | null;
  /** … or at this viewport point (right-click). */
  point?: LayerPoint | null;
  /**
   * The element a pointer menu belongs to (the right-clicked card / cell). The menu closes when a scroll
   * moves it, and ignores scrolls elsewhere. Default: the anchor, else `returnFocus`, else what had focus.
   */
  origin?: Element | null;
  /** Anchored: line up left edges (start, default) or right edges (end). */
  align?: "start" | "end";
  /** Focus on open: the first / last item, or the menu itself (pointer-opened context menus). */
  initialFocus?: "first" | "last" | "menu";
  /** Where focus goes after select / Esc / Tab (default: the anchor, else what had focus before). `false` = leave it. */
  returnFocus?: HTMLElement | null | false;
  /** A line on top saying what the menu acts on (multi-select: 「已选 3 条：赵静怡、陈冠宇…」). */
  header?: ReactNode;
  /**
   * Phones (≤ 760px): the menu is a bottom action sheet. Default true; `false` keeps
   * the floating menu (a menu that must stay next to what it edits).
   */
  sheet?: boolean;
};

type Entry = { item: MenuItem; section: number };
const entriesOf = (sections: readonly MenuSection[]): Entry[] => sections.flatMap((section, index) => section.items.map((item) => ({ item, section: index })));
const unreachable = (item: MenuItem) => Boolean(item.disabled) && !item.disabledReason;

type ListProps = {
  rootId: string;
  sections: readonly MenuSection[];
  label: string;
  target: LayerTarget;
  placement: LayerPlacement;
  host: HTMLElement;
  depth: number;
  initialFocus: "first" | "last" | "menu" | "none";
  onCloseAll: (reason: MenuCloseReason) => void;
  /** Submenus: close this level and put focus back on the parent item. */
  onBack?: () => void;
  /** Root: the list reports its node so scroll / resize can re-place it. */
  onPlace?: (place: () => boolean) => void;
  header?: ReactNode;
};

function MenuList({ rootId, sections, label, target, placement, host, depth, initialFocus, onCloseAll, onBack, onPlace, header }: ListProps) {
  const listId = useId();
  const node = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const entries = entriesOf(sections);
  const skip = entries.map((entry) => unreachable(entry.item));
  const [active, setActive] = useState(() => (initialFocus === "first" || initialFocus === "last" ? nextMenuIndex(skip, -1, initialFocus) : -1));
  const [sub, setSub] = useState<{ index: number; focus: "first" | "none" } | null>(null);
  const typed = useRef({ text: "", at: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { position, place } = useLayerPosition(true, node, target, host, placement);
  useEffect(() => onPlace?.(place), [onPlace, place]);
  const positioned = Boolean(position);
  // Focus follows the active item once the list is placed (and not while a submenu holds focus).
  useEffect(() => {
    if (!positioned || initialFocus === "none" && active < 0) return;
    if (sub?.focus === "first") return;
    const el = active >= 0 ? items.current[active] : node.current;
    el?.focus({ preventScroll: true });
  }, [positioned, active, sub, initialFocus]);
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  // A submenu opened by hover (no active item) and then entered with → / Enter: land on its first item.
  useEffect(() => {
    if ((initialFocus === "first" || initialFocus === "last") && active < 0) setActive(nextMenuIndex(skip, -1, initialFocus));
  }, [initialFocus]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasIcons = entries.some((entry) => entry.item.icon || entry.item.checked !== undefined);

  const activate = (index: number, via: "key" | "pointer") => {
    const entry = entries[index];
    if (!entry || entry.item.disabled) return;
    if (entry.item.items?.length) {
      setActive(index);
      setSub({ index, focus: via === "key" ? "first" : "none" });
      if (via === "pointer") items.current[index]?.focus({ preventScroll: true });
      return;
    }
    onCloseAll("select");
    entry.item.onSelect?.();
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Keys inside an open submenu are handled there (React bubbles through the portal).
    if (event.target instanceof Node && !node.current?.contains(event.target)) return;
    const key = event.key;
    // Shift+F10 / the ContextMenu key inside the menu must not reach a ContextMenu wrapper (React bubbles
    // through the portal) and open the menu again on top of itself.
    if ((event.shiftKey && key === "F10") || key === "ContextMenu") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const move = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : key === "Home" ? "first" : key === "End" ? "last" : null;
    if (move !== null) {
      event.preventDefault();
      event.stopPropagation();
      const next = nextMenuIndex(skip, active, move);
      if (next >= 0) {
        setSub(null);
        setActive(next);
      }
      return;
    }
    if (key === "ArrowRight" && active >= 0 && entries[active]?.item.items?.length) {
      event.preventDefault();
      event.stopPropagation();
      activate(active, "key");
      return;
    }
    if (key === "ArrowLeft" && depth > 0) {
      event.preventDefault();
      event.stopPropagation();
      onBack?.();
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (depth > 0) onBack?.();
      else onCloseAll("escape");
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (active >= 0) activate(active, "key");
      return;
    }
    if (key === "Tab") {
      onCloseAll("tab");
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && key.trim()) {
      const now = Date.now();
      const text = now - typed.current.at > 600 ? key : typed.current.text + key;
      typed.current = { text, at: now };
      const next = menuTypeahead(entries.map((entry) => menuLabel(entry.item.label, entry.item.count)), skip, active, text);
      if (next >= 0) {
        setSub(null);
        setActive(next);
      }
    }
  };
  const subEntry = sub ? entries[sub.index] : undefined;

  return (
    <>
      {createPortal(
        <div
          ref={node}
          id={listId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          className="aui-cmenu"
          data-icons={hasIcons || undefined}
          data-depth={depth}
          {...{ [LAYER_ATTR]: "", "data-aui-menu": rootId }}
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
          onKeyDown={onKeyDown}
          onContextMenu={(event) => {
            // Right-click on the menu: no browser menu and no reopening by an enclosing ContextMenu.
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {header && <div className="aui-cmenu-head">{header}</div>}
          {sections.map((section, sectionIndex) => {
            const body = section.items.map((item) => {
              const index = entries.findIndex((entry) => entry.item === item);
              const reasonId = item.disabled && item.disabledReason ? `${listId}-${index}-reason` : undefined;
              const hintId = item.hint ? `${listId}-${index}-hint` : undefined;
              const describedBy = [hintId, reasonId].filter(Boolean).join(" ") || undefined;
              const hasSub = Boolean(item.items?.length);
              const text = menuLabel(item.label, item.count);
              return (
                <button
                  key={item.key}
                  ref={(el) => {
                    items.current[index] = el;
                  }}
                  type="button"
                  role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                  aria-checked={item.checked === undefined ? undefined : item.checked}
                  aria-haspopup={hasSub ? "menu" : undefined}
                  aria-expanded={hasSub ? sub?.index === index : undefined}
                  aria-disabled={item.disabled || undefined}
                  aria-describedby={describedBy}
                  aria-keyshortcuts={item.shortcut}
                  aria-label={item.ariaLabel}
                  tabIndex={index === active ? 0 : -1}
                  className="aui-cmenu-item"
                  data-active={index === active || undefined}
                  data-danger={item.danger || undefined}
                  onClick={() => activate(index, "pointer")}
                  onPointerMove={() => {
                    if (skip[index] || index === active && (sub?.index === index || !hasSub)) return;
                    setActive(index);
                    items.current[index]?.focus({ preventScroll: true });
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => setSub(hasSub && !item.disabled ? { index, focus: "none" } : null), 140);
                  }}
                >
                  {hasIcons && (
                    <span className="aui-cmenu-icon" aria-hidden="true">
                      {item.icon ?? (item.checked ? <Check /> : null)}
                    </span>
                  )}
                  <span className="aui-cmenu-label">
                    <span className="aui-cmenu-text">{text}</span>
                    {reasonId && <small id={reasonId} className="aui-cmenu-reason">{item.disabledReason}</small>}
                  </span>
                  {item.hint && <span id={hintId} className="aui-cmenu-hint">{item.hint}</span>}
                  {item.shortcut && <span className="aui-cmenu-kbd" aria-hidden="true"><Kbd keys={item.shortcut} size="sm" flat compact /></span>}
                  {item.icon && item.checked && <Check className="aui-cmenu-check" aria-hidden="true" />}
                  {hasSub && <ChevronRight className="aui-cmenu-sub" aria-hidden="true" />}
                </button>
              );
            });
            return (
              <div key={section.key ?? sectionIndex} role="group" aria-label={section.title} className="aui-cmenu-section">
                {sectionIndex > 0 && <div role="separator" className="aui-cmenu-sep" />}
                {section.title && <div className="aui-cmenu-title" aria-hidden="true">{section.title}</div>}
                {body}
              </div>
            );
          })}
        </div>,
        host,
      )}
      {sub && subEntry?.item.items && (
        <MenuList
          key={subEntry.item.key}
          rootId={rootId}
          sections={subEntry.item.items}
          label={menuLabel(subEntry.item.label, subEntry.item.count)}
          target={() => rectOf(items.current[sub.index])}
          placement={{ side: "right", gap: 11, margin: 8 }} // 6px from the menu edge (item inset 4 + border 1)
          host={host}
          depth={depth + 1}
          initialFocus={sub.focus}
          onCloseAll={onCloseAll}
          onBack={() => {
            const index = sub.index;
            setSub(null);
            items.current[index]?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}

/** A controlled menu at a point or under an anchor. See the module comment. */
export function Menu({ open, onClose, sections, label, anchor, point, origin, align = "start", initialFocus = "first", returnFocus, header, sheet = true }: MenuProps) {
  const { portal } = useAdminTheme();
  const mobile = useIsMobile();
  const asSheet = sheet && mobile;
  // The sheet mounts from its first open on (closing still animates).
  const sheetUsed = useRef(false);
  if (asSheet && open) sheetUsed.current = true;
  // Phones: fetch the sheet while idle so the first tap opens it at once (desktops never load it).
  useEffect(() => (asSheet ? whenIdle(sheetPart.preload) : undefined), [asSheet]);
  const rootId = useId();
  const opener = useRef<HTMLElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const placeRoot = useRef<() => boolean>(() => true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    if (!open) {
      setHost(null);
      return;
    }
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setHost(layerHost(anchor ?? opener.current, portal));
  }, [open, anchor, portal]);
  const finish = useCallback((reason: MenuCloseReason) => {
    if (reason === "select" || reason === "escape" || reason === "tab") {
      const target = returnFocus === false ? null : returnFocus ?? anchor ?? opener.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    }
    closeRef.current(reason);
  }, [returnFocus, anchor]);
  useEffect(() => {
    if (!open || asSheet) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node && Boolean((target instanceof Element && target.closest(`[data-aui-menu="${rootId}"]`)) || anchor?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) finish("outside");
    };
    // Only a scroll that moves what the menu belongs to matters (bt/templates): menus inside scrolling
    // kanban columns / grids stay open while another column or the page around them scrolls.
    const owner = (): Element | null => anchor ?? origin ?? (returnFocus || null) ?? opener.current;
    const onScroll = (event: Event) => {
      if (inside(event.target)) return;
      const el = owner();
      const scroller = event.target;
      const movesOrigin = !el || !(scroller instanceof Node) || scroller.contains(el);
      const box = scroller instanceof Element ? rectOf(scroller) : null;
      const own = rectOf(el);
      const originVisible = !box || !own || rectsOverlap(own, box);
      const action = menuScrollAction({ movesOrigin, atPointer: Boolean(point), originVisible });
      if (action === "close" || (action === "follow" && !placeRoot.current())) finish("scroll");
    };
    const onResize = () => {
      if (point || !placeRoot.current()) finish("scroll");
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, anchor, point, origin, returnFocus, rootId, finish, asSheet]);
  const onPlace = useCallback((place: () => boolean) => {
    placeRoot.current = place;
  }, []);
  if (asSheet)
    return sheetUsed.current ? (
      <Suspense fallback={null}>
        <ActionSheet open={open} sections={sections} label={label} header={header} onClose={() => closeRef.current("select")} />
      </Suspense>
    ) : null;
  if (!open || !host || (!anchor && !point)) return null;
  const target: LayerTarget = () => (point ? point : rectOf(anchor));
  return (
    <MenuList
      rootId={rootId}
      sections={sections}
      label={label}
      target={target}
      placement={{ side: "bottom", align, gap: 4 }}
      host={host}
      depth={0}
      initialFocus={initialFocus}
      onCloseAll={finish}
      onPlace={onPlace}
      header={header}
    />
  );
}

export type ContextMenuProps = {
  /** The menu, or a function of the right-clicked element (return null / [] for no menu there). */
  sections: readonly MenuSection[] | ((target: Element) => readonly MenuSection[] | null);
  label: string;
  children: ReactNode;
  disabled?: boolean;
};
/**
 * Right-click menu for whatever it wraps (the wrapper is `display: contents`, layout is untouched).
 * Opens at the pointer; Shift+F10 or the ContextMenu key opens it under the focused element. The
 * browser's own menu still shows where `sections` returns nothing.
 */
export function ContextMenu({ sections, label, children, disabled }: ContextMenuProps) {
  const [state, setState] = useState<{ point: LayerPoint; sections: readonly MenuSection[]; origin: Element; keyboard: boolean } | null>(null);
  const open = (origin: Element, point: LayerPoint, keyboard: boolean) => {
    const list = typeof sections === "function" ? sections(origin) : sections;
    if (!list?.length) return false;
    setState({ point, sections: list, origin, keyboard });
    return true;
  };
  const focusable = state?.origin.closest<HTMLElement>("button, a[href], input, textarea, [tabindex]");
  return (
    <div
      className="aui-context-target"
      onContextMenu={(event) => {
        if (disabled || !(event.target instanceof Element)) return;
        if (open(event.target, { x: event.clientX, y: event.clientY }, false)) event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (disabled || !(event.target instanceof Element)) return;
        if (!((event.shiftKey && event.key === "F10") || event.key === "ContextMenu")) return;
        const box = event.target.getBoundingClientRect();
        if (open(event.target, { x: box.left + 4, y: box.bottom }, true)) event.preventDefault();
      }}
    >
      {children}
      <Menu
        open={Boolean(state)}
        point={state?.point}
        origin={state?.origin}
        sections={state?.sections ?? []}
        label={label}
        initialFocus={state?.keyboard ? "first" : "menu"}
        returnFocus={focusable ?? false}
        onClose={() => setState(null)}
      />
    </div>
  );
}

export type MenuButtonProps = Omit<ButtonProps, "onClick" | "children"> & {
  sections: readonly MenuSection[];
  /** Accessible name of the button and the menu. */
  label: string;
  /** Button content (default: the label). An icon-only menu is `MoreMenu`. */
  children?: ReactNode;
  align?: "start" | "end";
  /** A line on top of the menu (multi-select: what it acts on). */
  header?: ReactNode;
};
/**
 * Where focus lands when a trigger opens its menu: opened with the mouse / touch no item
 * is highlighted (focus on the menu itself, ↓ starts at the first item); opened from the keyboard (Enter /
 * Space → click with detail 0) the first item is.
 */
export function openFocus(event: { detail: number }): "first" | "menu" {
  return event.detail === 0 ? "first" : "menu";
}
/** A button that opens a Menu under itself (column ⋯, view ⋯, 「更多」). ↓ / ↑ open it on the first / last item. */
export function MenuButton({ sections, label, children, align = "end", variant = "ghost", size, className, disabled, header, ...rest }: MenuButtonProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<false | "first" | "last" | "menu">(false);
  return (
    <>
      <Button
        {...rest}
        ref={trigger}
        variant={variant}
        size={size}
        className={cn("aui-menu-button", className)}
        aria-label={rest["aria-label"]}
        aria-haspopup="menu"
        aria-expanded={Boolean(open)}
        disabled={disabled || !sections.some((section) => section.items.length)}
        onClick={(event) => setOpen((v) => (v ? false : openFocus(event)))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(event.key === "ArrowDown" ? "first" : "last");
          }
        }}
      >
        {children ?? label}
      </Button>
      <Menu open={Boolean(open)} anchor={trigger.current} align={align} sections={sections} label={label} header={header} initialFocus={open || "first"} onClose={() => setOpen(false)} />
    </>
  );
}
