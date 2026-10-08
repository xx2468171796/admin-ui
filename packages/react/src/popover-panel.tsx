"use client";
/**
 * PopoverPanel (bt/foundations F0.2): the non-modal panel that hangs under a toolbar button or a
 * header — field panel, filter, group, sort, colour picker, cell history. Grown out of BitableGrid's
 * GridPopover (which now renders through the same PopoverLayer): Provider portal (inside a Dialog: the
 * dialog), focus moves in, Esc closes and returns focus, an outside click closes, it follows the anchor
 * while the page scrolls and closes once the anchor leaves the viewport. Clicks inside other floating
 * layers (a Menu or Select opened from inside it) count as inside.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAdminTheme } from "./theme.tsx";
import { HelpTip } from "./help-tip.tsx";
import { LAYER_ATTR, dialogArea, isInsideLayer, layerHost, rectOf, useLayerPosition } from "./floating-layer.ts";
import { useIsMobile } from "./media-query.ts";
import type { LayerRect } from "./menu-core.ts";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type PopoverLayerProps = {
  open: boolean;
  anchor: HTMLElement | null;
  /** Accessible name of the panel (role=dialog). */
  label: string;
  /** `returnFocus` is true for Esc (focus goes back to the anchor), false for an outside click / scroll. */
  onClose: (returnFocus: boolean) => void;
  children: ReactNode;
  className: string;
  align?: "start" | "end";
  style?: CSSProperties;
  dataset?: Record<string, string | undefined>;
  /** bt/share: hang under this viewport box instead of the anchor's (a grid cell drawn on a canvas, a point). */
  anchorRect?: LayerRect | null;
  /** bt/datepicker: false = open without moving focus in (a text box that keeps typing while the panel shows). */
  initialFocus?: boolean;
  /** bt/datepicker: where Tab out of the panel lands when the anchor itself is not focusable (default the anchor). */
  focusTarget?: HTMLElement | null;
  /**
   * on phones (≤ 760px) the same panel becomes a bottom sheet over a scrim — grab bar,
   * then a head row 「start · title · end」 (清空 · 回访时间 · 确定, or 阶段 · 取消). Desktop ignores it.
   */
  sheet?: PopoverSheet;
  /** Where it hangs: under the anchor (default), above it (a sidebar's bottom account row) or to its right (a collapsed rail). */
  side?: "bottom" | "top" | "right";
};
/** Head row of the phone bottom sheet (see PopoverLayerProps.sheet). */
export type PopoverSheet = { title: string; start?: ReactNode; end?: ReactNode };
/** Positioning, focus and dismissal shared by PopoverPanel and BitableGrid's GridPopover. */
export function PopoverLayer({ open, anchor, label, onClose, children, className, align = "start", style, dataset, anchorRect, initialFocus = true, focusTarget, sheet, side = "bottom" }: PopoverLayerProps) {
  const { portal } = useAdminTheme();
  const mobile = useIsMobile();
  const asSheet = Boolean(sheet && mobile);
  const panel = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setHost(open ? layerHost(anchor, portal) : null);
  }, [open, anchor, portal]);
  // bt/datepicker: inside a dialog the layer is clipped by the dialog's box — cap its height to fit there
  // (the body scrolls) instead of cutting off its bottom.
  const [cap, setCap] = useState<number | null>(null);
  useLayoutEffect(() => {
    setCap(open && !asSheet && host?.classList.contains("aui-dialog") ? Math.max(160, Math.floor(dialogArea(host.getBoundingClientRect()).height - 16)) : null);
  }, [open, host, asSheet]);
  const { position, place } = useLayerPosition(Boolean(open && host && !asSheet), panel, () => anchorRect ?? rectOf(anchor), host, { side, align, gap: 4 });
  const shown = Boolean(open && host && (position || asSheet));
  const focusIn = useRef(initialFocus);
  focusIn.current = initialFocus;
  useEffect(() => {
    if (!shown || !focusIn.current) return;
    // An explicit target, else the first control of the body (not the header's 「?」, which would pop its bubble).
    const node = panel.current;
    if (!node) return;
    const inBody = () => node.querySelector<HTMLElement>("[data-autofocus]") ?? node.querySelector<HTMLElement>(`.aui-popover-body :is(${FOCUSABLE})`);
    const first = inBody();
    const body = node.querySelector<HTMLElement>(".aui-popover-body");
    if (first || !body) {
      (first ?? node.querySelector<HTMLElement>(FOCUSABLE) ?? node).focus({ preventScroll: true });
      return;
    }
    // The body is still loading (a lazy panel body shows a skeleton): hold focus on the panel itself, then move into
    // the body once it has a control — unless the user has moved focus meanwhile.
    node.focus({ preventScroll: true });
    const observer = new MutationObserver(() => {
      const target = inBody();
      if (!target) return;
      observer.disconnect();
      if (document.activeElement === node) target.focus({ preventScroll: true });
    });
    observer.observe(body, { childList: true, subtree: true });
    const stop = window.setTimeout(() => observer.disconnect(), 10_000);
    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
    };
  }, [shown]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    // A dialog opened from inside the panel (「删除视图？」) is portaled outside it: working in that dialog
    // (or on its overlay) must not close the panel underneath — unless it is the dialog the panel lives in.
    const inOtherDialog = (node: Node) => {
      const dialog = (node instanceof Element ? node : node.parentElement)?.closest(".aui-dialog, .aui-dialog-overlay");
      return Boolean(dialog && dialog !== host && !dialog.contains(panel.current));
    };
    const inside = (node: EventTarget | null) => node instanceof Node && Boolean(panel.current?.contains(node) || anchor?.contains(node) || isInsideLayer(node) || inOtherDialog(node));
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) closeRef.current(false);
    };
    const onMove = (event: Event) => {
      if (asSheet) return; // a bottom sheet does not follow its anchor
      if (event.target instanceof Node && (panel.current?.contains(event.target) || isInsideLayer(event.target))) return;
      if (!place()) closeRef.current(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, anchor, place, host, asSheet]);
  if (!open || !host) return null;
  const placed: CSSProperties = asSheet
    ? { ...style, width: undefined, minWidth: undefined, maxWidth: undefined, maxHeight: undefined }
    : { ...style, ...(cap ? { maxHeight: cap } : null), top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" };
  return createPortal(
    <>
    {asSheet && <div className="aui-sheet-scrim" aria-hidden="true" />}
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className={className}
      {...dataset}
      {...{ [LAYER_ATTR]: "" }}
      data-sheet={asSheet || undefined}
      style={placed}
      onKeyDown={(event) => {
        // Keys from a dialog opened inside the panel bubble here through the React tree: that dialog handles them.
        if (!(event.target instanceof Node && panel.current?.contains(event.target))) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose(true);
        } else if (event.key === "Tab" && panel.current && !event.defaultPrevented) {
          // Tab past the last control / Shift+Tab before the first leaves the panel: close it and go
          // back to the anchor (like RowActions), so the page's tab order continues from there.
          const node = panel.current;
          const target = event.target instanceof Element ? event.target : null;
          if (target && target !== node && target.closest(`[${LAYER_ATTR}]`) !== node) return; // a layer opened from inside
          const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
          const leaving = !items.length || (event.shiftKey ? target === node || target === items[0] : target === items.at(-1));
          if (!leaving) return;
          event.stopPropagation();
          const back = focusTarget ?? anchor;
          if (event.shiftKey || !back) event.preventDefault(); // Shift+Tab lands on the anchor itself
          back?.focus({ preventScroll: true });
          onClose(true);
        }
      }}
    >
      {asSheet && sheet && (
        <div className="aui-sheet-head">
          <span className="aui-sheet-grab" aria-hidden="true" />
          <span className="aui-sheet-start">{sheet.start}</span>
          <strong className="aui-sheet-title">{sheet.title}</strong>
          <span className="aui-sheet-end">{sheet.end}</span>
        </div>
      )}
      {children}
    </div>
    </>,
    host,
  );
}

export type PopoverPanelProps = {
  open: boolean;
  /** The button / header it hangs under. */
  anchor: HTMLElement | null;
  /** Esc → true (focus returns to the anchor); outside click / scroll → false. Set `open` false. */
  onClose: (returnFocus: boolean) => void;
  /** Header title; also names the panel. Omit for a header-less panel (then give `label`). */
  title?: string;
  /** Accessible name when there is no title. */
  label?: string;
  /** Explanation behind a 「?」 next to the title (never an intro paragraph). */
  help?: ReactNode;
  /** Right side of the header: a count (「显示 13 / 15」) or one small action. */
  headerExtra?: ReactNode;
  /** Bottom bar: 「+ 新建字段」, 「保存为新视图」, apply / cancel. */
  footer?: ReactNode;
  children: ReactNode;
  /** sm 300 · md 380 (default) · lg 560 px, or a number; always ≤ viewport − 16px. */
  width?: "sm" | "md" | "lg" | number;
  /** Line up with the anchor's left (start, default) or right edge (end). */
  align?: "start" | "end";
  /** Body without padding (lists that bring their own rows). */
  flush?: boolean;
  /**
   * Phones (≤ 760px) get a bottom sheet with a grab bar, the title and 「关闭」 instead of a popover (* the five view panels, view management, 新建视图). Default false (the old popover everywhere).
   */
  sheet?: boolean;
};
const WIDTHS = { sm: 300, md: 380, lg: 560 } as const;

/** A titled popover panel: header (title + ? + extra), scrolling body, optional footer. */
export function PopoverPanel({ open, anchor, onClose, title, label, help, headerExtra, footer, children, width = "md", align = "start", flush, sheet }: PopoverPanelProps) {
  const px = typeof width === "number" ? width : WIDTHS[width];
  const mobile = useIsMobile();
  const asSheet = Boolean(sheet && mobile);
  const name = title ?? label ?? "面板";
  return (
    <PopoverLayer
      open={open}
      anchor={anchor}
      label={title ?? label ?? "面板"}
      onClose={onClose}
      className="aui-popover"
      align={align}
      style={{ "--aui-popover-width": `${px}px` } as CSSProperties}
      sheet={sheet ? { title: name, end: <button type="button" className="aui-sheet-action" data-muted="" onClick={() => onClose(true)}>关闭</button> } : undefined}
    >
      {asSheet ? (headerExtra && <div className="aui-popover-header" data-in-sheet=""><div className="aui-popover-extra">{headerExtra}</div></div>) : (title || headerExtra) && (
        <div className="aui-popover-header">
          {title && <strong className="aui-popover-title">{title}</strong>}
          {help && <HelpTip label={`${title ?? label ?? ""}说明`}>{help}</HelpTip>}
          {headerExtra && <div className="aui-popover-extra">{headerExtra}</div>}
        </div>
      )}
      <div className="aui-popover-body" data-flush={flush || undefined}>{children}</div>
      {footer && <div className="aui-popover-footer">{footer}</div>}
    </PopoverLayer>
  );
}
