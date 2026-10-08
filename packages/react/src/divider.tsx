"use client";
/**
 * Divider and the shortcut sheet.
 * - `Divider`: one kind of line, 1px solid. Section breaks in a card (`bleed` = edge to edge), a labelled one in
 *   timelines (「昨天」「更早」), and the 16px vertical toolbar separator. Prefer white space where it works.
 * - `ShortcutSheet`: the 「?」 key opens a list of the page's shortcuts, grouped (表格 / 记录详情).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Dialog } from "./forms.tsx";
import { Kbd, useShortcutPlatform } from "./tooltip.tsx";

export type DividerProps = {
  /** Text in the middle of the line (timeline days: 「昨天」「更早」). */
  label?: ReactNode;
  /** Labelled divider: text centred (default) or at the start. */
  align?: "center" | "start";
  /** horizontal (default) · vertical = the 16px toolbar separator. */
  orientation?: "horizontal" | "vertical";
  /** Edge to edge inside a card with 16px padding. */
  bleed?: boolean;
  /** No vertical margin (the caller spaces it). */
  flush?: boolean;
};
export function Divider({ label, align = "center", orientation = "horizontal", bleed, flush }: DividerProps) {
  if (orientation === "vertical") return <span className="aui-divider" data-orientation="vertical" role="separator" aria-orientation="vertical" />;
  if (label !== undefined && label !== null && label !== "")
    return (
      <div className="aui-divider-label" role="separator" data-align={align === "start" ? "start" : undefined}>
        {label}
      </div>
    );
  return <hr className="aui-divider" data-bleed={bleed || undefined} data-flush={flush || undefined} />;
}

export type ShortcutItem = { keys: string; label: string };
export type ShortcutGroup = { title: string; items: readonly ShortcutItem[] };
export type ShortcutSheetProps = {
  groups: readonly ShortcutGroup[];
  /** Controlled open state; leave out and the sheet opens itself on 「?」 (outside text fields). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
};

const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.getAttribute("role") === "textbox");

/** 「?」 opens the page's shortcut list; keycaps in the current system's notation; nothing on phones (no keyboard). */
export function ShortcutSheet({ groups, open: controlled, onOpenChange, title = "快捷键" }: ShortcutSheetProps) {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = (next: boolean) => {
    if (controlled === undefined) setOwn(next);
    onOpenChange?.(next);
  };
  useShortcutPlatform();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey || typingIn(event.target)) return;
      event.preventDefault();
      if (controlled === undefined) setOwn(true);
      onOpenChange?.(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [controlled, onOpenChange]);
  return (
    <Dialog open={open} title={title} description="按「?」随时打开这张表" onClose={() => setOpen(false)} size="md">
      <div className="aui-shortcuts">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3>{group.title}</h3>
            <dl>
              {group.items.map((item) => (
                <div key={`${item.keys}-${item.label}`}>
                  <dt>{item.label}</dt>
                  <dd>
                    <Kbd keys={item.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
