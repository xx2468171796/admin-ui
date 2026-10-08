"use client";
/**
 * The one frame behind Dialog / FormDialog / ConfirmDialog / SideSheet / BottomSheet:
 * radius 12, no border, no backdrop blur, white footer; the header / footer divider only shows while the
 * body is scrolled / has more below; widths sm 420 · md 560 · lg 800 · xl 1080 · full (24px from every
 * edge); on phones sm / md rise from the bottom (grab bar), lg and up take the whole screen.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { useAdminTheme } from "./theme.tsx";
import { scrollEdges } from "./overlay-core.ts";
import { IconButton } from "./buttons.tsx";

const FOCUSABLE_SELECTOR =
  'a[href],button,input,select,textarea,summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
export function isFocusable(element: HTMLElement) {
  return element.isConnected && element.matches(FOCUSABLE_SELECTOR) && !element.hasAttribute("disabled");
}
/**
 * sm 420 · md 560 (default) · lg 800 · xl 1080 · full (24px from each edge: quote / import previews).
 * `record`: the expanded record (RecordDetail level 「详情」) — centered, 50–92vw wide and a fixed
 * height up to 88dvh, full screen at ≤760px. There is no side drawer: records open as centered dialogs.
 */
export type DialogSize = "sm" | "md" | "lg" | "xl" | "full" | "record";
/** Where a Dialog sits: centered (default), a right side sheet, or a bottom sheet. */
export type DialogPlacement = "center" | "side" | "bottom";
export type SheetWidth = "md" | "lg" | "xl";

/**
 * Mark the dialog `data-scrolled` (body scrolled down → divider under the header) and `data-more` (more
 * below → divider over the footer) while it is open. Re-measured on scroll, resize and content changes.
 */
function useScrollDividers(open: boolean, content: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let body: HTMLElement | null = null;
    const update = () => {
      const node = content.current;
      if (!node) return;
      const next = node.querySelector<HTMLElement>(":scope > .aui-dialog-body");
      if (next !== body) {
        body?.removeEventListener("scroll", update);
        body = next;
        body?.addEventListener("scroll", update, { passive: true });
      }
      const edges = body ? scrollEdges(body) : { scrolled: false, more: false };
      node.toggleAttribute("data-scrolled", edges.scrolled);
      node.toggleAttribute("data-more", edges.more);
    };
    // Radix mounts the content after this effect on the first open: retry for a few frames.
    let tries = 0;
    const start = () => {
      if (content.current || tries++ > 10) return update();
      frame = requestAnimationFrame(start);
    };
    start();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const mutate = typeof MutationObserver === "undefined" ? null : new MutationObserver(update);
    const watch = requestAnimationFrame(() => {
      const node = content.current;
      if (!node) return;
      resize?.observe(node);
      mutate?.observe(node, { childList: true, subtree: true });
      update();
    });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(watch);
      resize?.disconnect();
      mutate?.disconnect();
      body?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open, content]);
}

export type DialogFrameProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  size?: DialogSize;
  closeDisabled?: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  headerActions?: ReactNode;
  headerExtra?: ReactNode;
  titleAdornment?: ReactNode;
  header?: (close: ReactNode) => ReactNode;
  initialFocus?: "first" | "dialog";
  placement?: DialogPlacement;
  sheetWidth?: SheetWidth;
  /** false = no overlay, the page behind stays usable (comments / attachments side sheet). */
  modal?: boolean;
  /** Extra class on the dialog box. */
  className?: string;
};
/** Shared shell for every adminUI overlay: one portal, one overlay, one aui-dialog-* stylesheet. */
export function DialogFrame({
  open,
  title,
  description,
  size = "md",
  closeDisabled = false,
  onRequestClose,
  children,
  headerActions,
  headerExtra,
  titleAdornment,
  header,
  initialFocus = "first",
  placement = "center",
  sheetWidth = "md",
  modal = true,
  className,
}: DialogFrameProps) {
  const { portal } = useAdminTheme();
  const opener = useRef<HTMLElement | null>(null);
  const anchors = useRef<HTMLElement[]>([]);
  const content = useRef<HTMLDivElement>(null);
  useScrollDividers(open, content);
  // Record the opener in a LAYOUT effect: layout effects run before passive effects, and
  // Radix moves focus into the dialog from a passive effect. Reading activeElement in a
  // passive effect instead remembers the dialog's own close button.
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    const found = active instanceof HTMLElement && active !== document.body ? active : null;
    opener.current = found;
    // Remember the region the opener lived in too: a console that refreshes its list
    // after saving destroys the trigger, and dropping the user at the top of the page is
    // the same loss of place as not restoring at all.
    const chain: HTMLElement[] = [];
    for (let node = found?.parentElement ?? null; node && node !== document.body; node = node.parentElement) chain.push(node);
    anchors.current = chain;
  }, [open]);
  // Own the return focus instead of relying on Radix: the host unmounts the content from
  // its own state, and when Radix's internally tracked node is gone the browser parks
  // focus on whatever it finds (an injected <style>, for one), silently losing the
  // keyboard user's place.
  const focusOpener = () => {
    const target = opener.current;
    if (!target?.isConnected) return false;
    target.focus({ preventScroll: true });
    return document.activeElement === target;
  };
  const focusRegion = () => {
    const region = anchors.current.find((node) => node.isConnected);
    if (!region) return false;
    // WAI-ARIA practice for a vanished trigger: return to the surrounding region. The
    // programmatic-only tabindex is borrowed and handed back on blur.
    const borrowed = !region.hasAttribute("tabindex");
    if (borrowed) region.setAttribute("tabindex", "-1");
    region.focus({ preventScroll: true });
    if (borrowed) region.addEventListener("blur", () => region.removeAttribute("tabindex"), { once: true });
    return document.activeElement === region;
  };
  const returnFocus = () => focusOpener() || focusRegion();
  useEffect(() => {
    if (open || !opener.current) return;
    // Verify a frame later instead of trusting the synchronous result: on the overlay and
    // submit paths the browser's own mousedown focus handling lands after our restore and
    // would otherwise leave the user on <body>. Only correct when focus is genuinely
    // lost, so a host that deliberately focuses something else keeps it.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !isFocusable(active)) returnFocus();
      opener.current = null;
      anchors.current = [];
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!portal) return null;
  const closeButton = (
    <IconButton label="关闭弹窗" className="aui-dialog-close" disabled={closeDisabled} onClick={onRequestClose} icon={<X />} />
  );
  return (
    <RadixDialog.Root
      open={open}
      modal={modal}
      onOpenChange={(next) => {
        if (!next) onRequestClose();
      }}
    >
      <RadixDialog.Portal container={portal}>
        {modal && <RadixDialog.Overlay className="aui-dialog-overlay" />}
        <RadixDialog.Content
          ref={content}
          className={className ? `aui-dialog aui-dialog-${size} ${className}` : `aui-dialog aui-dialog-${size}`}
          data-size={size}
          data-placement={placement === "center" ? undefined : placement}
          data-sheet-width={placement === "side" ? sheetWidth : undefined}
          data-modeless={modal ? undefined : true}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            // Esc inside a floating layer (menu, popover) closes that layer, not the dialog; inside a record
            // field being edited in place (data-aui-editing) it cancels that edit.
            if (event.target instanceof Element && event.target.closest("[data-aui-layer], [data-aui-editing]")) return;
            onRequestClose();
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            // A modeless sheet stays while the page behind it is used.
            if (modal) onRequestClose();
          }}
          onInteractOutside={modal ? undefined : (event) => event.preventDefault()}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            const node = event.currentTarget as HTMLElement | null;
            // An explicit target (ConfirmDialog: 「取消」, so Enter never deletes by accident).
            const marked = node?.querySelector<HTMLElement>("[data-autofocus]");
            if (marked) {
              event.preventDefault();
              marked.focus({ preventScroll: true });
              return;
            }
            // Long read-mostly content (record detail): focus the dialog itself, not its first button (WAI-ARIA dialog pattern).
            if (initialFocus === "dialog") {
              event.preventDefault();
              node?.focus({ preventScroll: true });
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus();
          }}
        >
          {header ? (
            <>
              {/* A custom header (RecordHeader …) shows the title itself; Radix still names the dialog. */}
              <RadixDialog.Title className="aui-sr-only">{title}</RadixDialog.Title>
              <RadixDialog.Description className="aui-sr-only">{typeof description === "string" ? description : ""}</RadixDialog.Description>
              {header(closeButton)}
            </>
          ) : (
            <header className="aui-dialog-header" data-extra={headerExtra ? true : undefined}>
              <div className="aui-header-text">
                <div className="aui-dialog-title-row">
                  <RadixDialog.Title className="aui-dialog-title">{title}</RadixDialog.Title>
                  {titleAdornment}
                </div>
                <RadixDialog.Description className="aui-note" asChild={typeof description === "object" && description !== null}>
                  {typeof description === "object" && description !== null ? <div>{description}</div> : description ?? ""}
                </RadixDialog.Description>
              </div>
              {headerActions && <div className="aui-dialog-header-actions">{headerActions}</div>}
              {closeButton}
              {headerExtra && <div className="aui-dialog-header-extra">{headerExtra}</div>}
            </header>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * The footer row of a Dialog (as in the approved mockup): 取消 · secondary actions · primary far
 * right; a destructive action (删除客户) sits far left as a red ghost button; a one-line hint may sit left. Pass it
 * as Dialog `footer` and put the buttons in `children` in that order.
 */
export function DialogFooter({ danger, hint, children }: { danger?: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {(danger || hint) && (
        <div className="aui-dialog-footer-start">
          {danger}
          {hint && <span className="aui-note">{hint}</span>}
        </div>
      )}
      {children}
    </>
  );
}

/**
 * The small 「放弃…？」 confirm stacked ON the dialog: the form underneath stays visible, so
 * the user sees what would be lost. Esc / 继续填写 go back to the form.
 */
export function DiscardPrompt({ open, title, description, keepLabel, discardLabel, onKeep, onDiscard }: { open: boolean; title: string; description: string; keepLabel: string; discardLabel: string; onKeep: () => void; onDiscard: () => void }) {
  return (
    <DialogFrame open={open} title={title} description={description} size="sm" className="aui-dialog-stacked" onRequestClose={onKeep}>
      <footer className="aui-dialog-footer">
        <Button variant="outline" data-autofocus onClick={onKeep}>
          {keepLabel}
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          {discardLabel}
        </Button>
      </footer>
    </DialogFrame>
  );
}
