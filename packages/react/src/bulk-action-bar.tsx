"use client";
/**
 * BulkActionBar: the one bulk-action bar of the SDK — DataTable and BitableGrid
 * both render it. A white floating pill at the bottom centre of the list, 「已选 N 条」 + ghost action
 * buttons + ✕; it never pushes the table down. Place it right after the scrolling content (before the
 * footer) of a `position: relative` container: it then sits over the last rows and, when the list is
 * taller than the screen, sticks to the bottom of the viewport. Phones (≤ 760px): pinned to the screen
 * bottom. Styles: styles/table.css (.aui-bulkbar*).
 */
import type { KeyboardEvent, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { RowActions, type RowAction } from "./row-actions.tsx";
import { useIsMobile } from "./media-query.ts";
import { splitBulkActions } from "./data-card-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";

export type BulkAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};
export type BulkActionBarProps = {
  count: number;
  total?: number;
  /** 「本页 24 条」 small note */
  note?: ReactNode;
  actions: readonly BulkAction[];
  onClear: () => void;
  /** max buttons before the rest go into ⋯ (default 4, phones 2) */
  maxVisible?: number;
  label?: string;
  className?: string;
};

const toRowAction = (action: BulkAction): RowAction => ({
  key: action.key,
  label: action.label,
  icon: action.icon,
  destructive: action.danger,
  disabled: action.disabled,
  disabledReason: action.disabledReason,
  onSelect: action.onSelect,
});

/** Left / Right / Home / End move between the bar's buttons (role="toolbar"); Esc clears the selection. */
function onToolbarKey(event: KeyboardEvent<HTMLDivElement>, onClear: () => void) {
  if (event.key === "Escape") {
    event.stopPropagation();
    onClear();
    return;
  }
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
  const at = buttons.findIndex((button) => button === document.activeElement);
  if (at < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next]?.focus();
}

/** The shared bottom floating bulk-action bar; renders nothing when `count` is 0. */
export function BulkActionBar({ count, total, note, actions, onClear, maxVisible, label = "批量操作", className }: BulkActionBarProps) {
  const phone = useIsMobile();
  if (!(count > 0)) return null;
  const { visible, overflow } = splitBulkActions(actions, maxVisible ?? (phone ? 2 : 4));
  const small = note ?? (total !== undefined ? `共 ${total.toLocaleString("zh-CN")} 条` : null);
  return (
    <div className={className ? `aui-bulkbar-dock ${className}` : "aui-bulkbar-dock"}>
      <div className="aui-bulkbar" role="toolbar" aria-label={label} onKeyDown={(event) => onToolbarKey(event, onClear)}>
        <span className="aui-bulkbar-count" aria-live="polite">
          已选 <b>{count.toLocaleString("zh-CN")}</b> 条{small !== null && <small>{small}</small>}
        </span>
        {visible.map((action) => (
          <Button
            key={action.key}
            size="sm"
            variant="ghost"
            className="aui-bulkbar-action"
            data-danger={action.danger || undefined}
            disabled={action.disabled}
            disabledReason={action.disabled ? action.disabledReason : undefined}
            onClick={action.onSelect}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        {overflow.length > 0 && <RowActions label="更多批量操作" actions={overflow.map(toRowAction)} />}
        <span className="aui-bulkbar-sep" aria-hidden="true" />
        <IconButton label="清除选择" className="aui-bulkbar-clear" onClick={onClear} icon={<X aria-hidden="true" />} />
      </div>
    </div>
  );
}
