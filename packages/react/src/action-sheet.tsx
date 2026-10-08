"use client";
/**
 * ActionSheet: on phones every 「⋯」 menu (MenuButton, MoreMenu, RowActions,
 * any anchored Menu) is this bottom sheet — grouped 48px rows on a light card, danger in red, disabled rows
 * with their reason, a submenu opens in place (with a 「返回」 row), and a separate 「取消」 card at the bottom
 * (iOS / 飞书 mobile). Same MenuSection data as Menu, so hosts never build two menus.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { DialogFrame } from "./dialog-frame.tsx";
import { menuLabel } from "./menu-core.ts";
import type { MenuItem, MenuSection } from "./menu.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/sheets.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/sheets.css";

export type ActionSheetProps = {
  open: boolean;
  onClose: () => void;
  sections: readonly MenuSection[];
  /** Accessible name (the menu's label). */
  label: string;
  /** A short line on top (「已选 3 条：赵静怡、陈冠宇…」). */
  header?: ReactNode;
};

/** A bottom action sheet built from MenuSection data. Selecting a row closes the sheet, then runs it. */
export function ActionSheet({ open, onClose, sections, label, header }: ActionSheetProps) {
  const [trail, setTrail] = useState<MenuItem[]>([]);
  useEffect(() => {
    if (!open) setTrail([]);
  }, [open]);
  const parent = trail.at(-1);
  const shown = parent?.items ?? sections;
  const select = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.items?.length) {
      setTrail((list) => [...list, item]);
      return;
    }
    onClose();
    item.onSelect?.();
  };
  const heading = parent ? menuLabel(parent.label, parent.count) : header;
  return (
    <DialogFrame
      open={open}
      title={label}
      placement="bottom"
      size="sm"
      className="aui-action-sheet"
      onRequestClose={onClose}
      header={() => <span className="aui-action-sheet-grab" aria-hidden="true" />}
    >
      <div className="aui-dialog-body aui-action-sheet-body" role="menu" aria-label={label}>
        {heading && <div className="aui-action-sheet-head">{heading}</div>}
        {parent && (
          <div className="aui-action-sheet-group">
            <button type="button" role="menuitem" className="aui-action-sheet-row" onClick={() => setTrail((list) => list.slice(0, -1))}>
              <ChevronLeft aria-hidden="true" />
              <span className="aui-action-sheet-label">返回</span>
            </button>
          </div>
        )}
        {shown.map((section, index) => (
          <div key={section.key ?? index} role="group" aria-label={section.title} className="aui-action-sheet-group">
            {section.title && <div className="aui-action-sheet-title" aria-hidden="true">{section.title}</div>}
            {section.items.map((item) => (
              <button
                key={item.key}
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                aria-disabled={item.disabled || undefined}
                aria-haspopup={item.items?.length ? "menu" : undefined}
                aria-label={item.ariaLabel}
                className="aui-action-sheet-row"
                data-danger={item.danger || undefined}
                onClick={() => select(item)}
              >
                {item.icon && <span className="aui-action-sheet-icon" aria-hidden="true">{item.icon}</span>}
                <span className="aui-action-sheet-label">
                  {menuLabel(item.label, item.count)}
                  {item.disabled && item.disabledReason && <small>{item.disabledReason}</small>}
                </span>
                {item.hint && <span className="aui-action-sheet-hint">{item.hint}</span>}
                {item.checked && <Check className="aui-action-sheet-check" aria-hidden="true" />}
                {item.items?.length ? <ChevronRight className="aui-action-sheet-sub" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ))}
        <button type="button" className="aui-action-sheet-cancel" data-autofocus onClick={onClose}>
          取消
        </button>
      </div>
    </DialogFrame>
  );
}
