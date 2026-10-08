"use client";
/** Non-modal popovers of BitableGrid (toolbar panels, column menu, summary picker, select editors). */
import { useRef, useState, type ReactNode } from "react";
import { Button } from "./primitives.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

// ---------------------------------------------------------------- popover

export type GridPopoverProps = { open: boolean; anchor: HTMLElement | null; label: string; onClose: (returnFocus: boolean) => void; children: ReactNode; wide?: boolean };
/**
 * Non-modal panel anchored under a toolbar button / column header (Provider portal, so the grid's
 * scroll box never clips it): focus moves in, Esc closes and returns focus, outside click closes.
 * Selects and menus opened inside it (their own portal) count as inside. Same layer as the root
 * `PopoverPanel` (which adds a header / footer); kept for the grid's own panels.
 */
export function GridPopover({ open, anchor, label, onClose, children, wide }: GridPopoverProps) {
  return (
    <PopoverLayer open={open} anchor={anchor} label={label} onClose={onClose} className="aui-grid-popover" dataset={{ "data-wide": wide ? "true" : undefined }}>
      {children}
    </PopoverLayer>
  );
}
/** A toolbar button with its popover. */
export function ToolbarPopover({ icon, label, badge, active, wide, children }: { icon: ReactNode; label: string; badge?: number; active?: boolean; wide?: boolean; children: (close: () => void) => ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };
  return (
    <>
      <Button ref={trigger} variant="ghost" size="sm" className="aui-grid-tool" data-active={active || undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {icon}
        <span className="aui-grid-tool-label">{label}</span>
        {badge ? <span className="aui-grid-tool-badge" aria-label={`${badge} 项`}>{badge}</span> : null}
      </Button>
      <GridPopover open={open} anchor={trigger.current} label={label} wide={wide} onClose={close}>
        {children(() => close(true))}
      </GridPopover>
    </>
  );
}

