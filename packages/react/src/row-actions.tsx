"use client";
import { useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "./primitives.tsx";
import { fitRowActions } from "./menu-core.ts";
import { Menu, openFocus, type MenuItem, type MenuSection } from "./menu.tsx";
import { RowActionLimitContext } from "./row-action-limit.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";

export type RowAction = {
  key: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Shown under the label; a disabled item with a reason stays keyboard-reachable so it can be read. */
  disabledReason?: string;
  icon?: ReactNode;
  /** Accessible name when the visible label is short (e.g. 「复制」 → 「复制 xx 的完整信息」). */
  ariaLabel?: string;
  /**
   * RowActionBar only: keep this action in the ⋯ menu even when there is room. Destructive actions
   * default to the menu (set `menuOnly: false` to show one inline anyway).
   */
  menuOnly?: boolean;
};
export type RowActionsProps = {
  actions: readonly RowAction[];
  /** Accessible name of the trigger and the menu. */
  label?: string;
};

/** The ⋯ menu's sections: normal actions first, destructive ones in the last group. */
export function rowActionSections(actions: readonly RowAction[]): MenuSection[] {
  const item = (action: RowAction): MenuItem => ({
    key: action.key,
    label: action.label,
    icon: action.icon,
    danger: action.destructive,
    disabled: action.disabled,
    disabledReason: action.disabledReason,
    ariaLabel: action.ariaLabel,
    onSelect: action.onSelect,
  });
  const normal = actions.filter((action) => !action.destructive).map(item);
  const danger = actions.filter((action) => action.destructive).map(item);
  return [normal, danger].filter((items) => items.length).map((items, index) => ({ key: index ? "danger" : "main", items }));
}

/**
 * A row's overflow menu: one icon button, the rest of the row's actions inside — the same Menu as every
 * other menu (one look: 32px rows, neutral hover; danger last; disabled with its reason; on phones a bottom
 * action sheet). Opened with the mouse nothing is highlighted, from the keyboard the first item is; Esc and
 * selecting return focus to the button; it follows the button on scroll and closes once the button leaves
 * the viewport. Rows show at most 1–2 visible buttons (TABLES.md); RowActionBar decides what goes in here.
 */
export function RowActions({ actions, label = "更多操作" }: RowActionsProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<false | "first" | "last" | "menu">(false);
  return (
    <>
      <IconButton label={label} ref={trigger} className="aui-row-actions-trigger" aria-haspopup="menu" aria-expanded={Boolean(open)} disabled={!actions.length} onClick={(event) => setOpen((v) => (v ? false : openFocus(event)))} onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(event.key === "ArrowDown" ? "first" : "last");
          }
        }} icon={<Ellipsis />} />
      <Menu open={Boolean(open)} anchor={trigger.current} align="end" sections={rowActionSections(actions)} label={label} initialFocus={open || "first"} onClose={() => setOpen(false)} />
    </>
  );
}


export type RowActionBarProps = {
  /** Every action of the row, most used first. */
  actions: readonly RowAction[];
  /** Accessible name of the ⋯ button and its menu. */
  label?: string;
  /** Most buttons shown in the row (default 3, owner 2026-10-02); the rest go into ⋯. */
  max?: number;
};

const inMenuOnly = (action: RowAction) => action.menuOnly ?? Boolean(action.destructive);

/**
 * The standard table action cell: shows as many actions as the column has room for (at most
 * `max`, default 3; disabled ones never take a slot) as small ghost buttons (icon + word), in the given order, and puts only the rest into the ⋯ menu — never a ⋯
 * next to empty space (owner rule 2026-10-02). Destructive actions stay in the menu by default.
 * The column can grow to fit every button when the table has spare width and shrinks to one button
 * plus ⋯ when it has not; re-measures on resize, font size and label changes.
 */
export function RowActionBar({ actions, label = "更多操作", max: wanted = 3 }: RowActionBarProps) {
  // DataTable's phone cards cap this at 0: the card shows only ⋯.
  const limit = useContext(RowActionLimitContext);
  const max = limit === null ? wanted : Math.min(wanted, limit);
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  // Unavailable actions never take a slot: they wait in ⋯ with their reason.
  const candidates = actions.filter((action) => !inMenuOnly(action) && !action.disabled).slice(0, Math.max(0, max));
  const menuOnlyCount = actions.length - candidates.length;
  const [shown, setShown] = useState(candidates.length);
  const signature = actions.map((action) => `${action.key}:${action.label}:${action.menuOnly ?? ""}`).join("|");

  useLayoutEffect(() => {
    const node = box.current;
    const measure = () => {
      const meter = ruler.current;
      if (!node || !meter) return;
      const items = [...meter.children] as HTMLElement[];
      const trigger = items.pop()?.offsetWidth ?? 0;
      const next = fitRowActions(items.map((item) => item.offsetWidth), trigger, node.clientWidth, menuOnlyCount);
      setShown((old) => (old === next ? old : next));
    };
    measure();
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (ruler.current) observer.observe(ruler.current);
    return () => observer.disconnect();
  }, [signature, menuOnlyCount]);

  const inline = candidates.slice(0, shown);
  const rest = actions.filter((action) => !inline.includes(action));
  const button = (action: RowAction, measuring = false) => (
    <Button
      key={action.key}
      size="sm"
      variant="ghost"
      className="aui-row-actionbar-button"
      data-destructive={action.destructive || undefined}
      disabled={action.disabled}
      disabledReason={action.disabled ? action.disabledReason : undefined}
      aria-label={action.ariaLabel}
      tabIndex={measuring ? -1 : undefined}
      onClick={measuring ? undefined : () => action.onSelect()}
    >
      {action.icon}
      {action.label}
    </Button>
  );
  return (
    <div ref={box} className="aui-row-actionbar">
      <div className="aui-row-actionbar-row">
        {inline.map((action) => button(action))}
        {rest.length > 0 && <RowActions label={label} actions={rest} />}
      </div>
      {/* Hidden ruler: every inline candidate + a ⋯ button. Zero height; its widths let the table
          column grow to fit all buttons when there is spare room. */}
      <div ref={ruler} className="aui-row-actionbar-ruler" aria-hidden="true" inert>
        {candidates.map((action) => button(action, true))}
        <IconButton label="更多" className="aui-row-actions-trigger" tabIndex={-1} icon={<Ellipsis />} />
      </div>
    </div>
  );
}
