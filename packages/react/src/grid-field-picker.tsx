"use client";
/**
 * GridFieldPicker (bt/grid-a): the field box of the filter / group / sort / colour panels (D04) — a
 * small select (the same trigger and popover as Choice) showing the field's type icon
 * and name; it opens a searchable list with type icons, a tick on the current field, a lock (with the
 * reason) on restricted fields and greyed rows with the reason on fields that cannot be picked.
 * Keyboard: ↑ / ↓ move, Enter picks, Esc closes; typing filters.
 */
import { useMemo, useRef, useState } from "react";
import { ChevronDown, Lock, Type } from "lucide-react";
import { PopoverLayer } from "./popover-panel.tsx";
import { FIELD_ICONS } from "./grid-cells.tsx";
import { OptionList, SelectSearch, type SelectItem } from "./option-list.tsx";
import { useOptionNav } from "./use-option-nav.ts";
import type { GridField } from "./grid-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export type GridFieldPickerProps<T> = {
  fields: readonly GridField<T>[];
  value: string | null;
  onChange: (key: string) => void;
  /** Accessible name of the box (「筛选字段」「分组字段」). */
  label: string;
  placeholder?: string;
  /** Why a field cannot be picked (shown greyed with the reason); null = it can. */
  disabledReason?: (field: GridField<T>) => string | null;
  disabled?: boolean;
};

/** Type icon of a field (unknown types: the text icon). */
export function fieldIcon(type: string) {
  return (FIELD_ICONS as Record<string, typeof Type>)[type] ?? Type;
}

export function GridFieldPicker<T>({ fields, value, onChange, label, placeholder = "选择字段", disabledReason, disabled }: GridFieldPickerProps<T>) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = fields.find((field) => field.key === value);
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };
  const Icon = current ? fieldIcon(current.type) : null;
  return (
    <>
      <button ref={trigger} type="button" className="aui-input aui-select aui-grid-fpick" data-size="sm" data-state={open ? "open" : undefined} aria-haspopup="listbox" aria-expanded={open} aria-label={current ? `${label}：${current.title}` : label} disabled={disabled}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true); } }}>
        <span className="aui-select-value">
          {Icon && <Icon className="aui-grid-fpick-icon" aria-hidden="true" />}
          <span className={current ? "aui-opt-text" : "aui-select-ph"}>{current?.title ?? placeholder}</span>
        </span>
        <ChevronDown className="aui-select-chev" aria-hidden="true" />
      </button>
      {open && <FieldList fields={fields} value={value} label={label} anchor={trigger.current} disabledReason={disabledReason} onPick={(key) => { if (key !== value) onChange(key); close(true); }} onClose={close} />}
    </>
  );
}

function FieldList<T>({ fields, value, label, anchor, disabledReason, onPick, onClose }: { fields: readonly GridField<T>[]; value: string | null; label: string; anchor: HTMLElement | null; disabledReason?: (field: GridField<T>) => string | null; onPick: (key: string) => void; onClose: (returnFocus: boolean) => void }) {
  const items = useMemo((): SelectItem[] => fields.map((field) => {
    const FieldIcon = fieldIcon(field.type);
    const reason = (field.restricted ? (typeof field.restricted === "string" ? field.restricted : "你没有这个字段的完整权限") : null) ?? disabledReason?.(field) ?? null;
    // bt/grid-b `locked`: the field has view / edit restrictions — a lock to look at, still pickable.
    const lockNote = reason ? null : field.locked ? (typeof field.locked === "string" ? field.locked : "这个字段有查看 / 编辑限制") : null;
    return {
      value: field.key,
      label: field.title,
      icon: <FieldIcon />,
      disabledReason: reason ?? undefined,
      extra: lockNote ? <span className="aui-opt-lock" role="img" aria-label={lockNote} data-tip={lockNote}><Lock aria-hidden="true" /></span> : undefined,
    };
  }), [fields, disabledReason]);
  const nav = useOptionNav({ options: items, selected: value ? [value] : [], onPick });
  return (
    <PopoverLayer open anchor={anchor} label={label} onClose={onClose} className="aui-popover aui-select-pop aui-grid-fpick-pop" sheet={{ title: label, end: <button type="button" className="aui-sheet-action" data-muted onClick={() => onClose(true)}>取消</button> }}>
      <SelectSearch value={nav.query} onChange={nav.setQuery} label="搜索字段" placeholder="搜索字段" listId={nav.listId} activeId={nav.activeId} onKeyDown={(event) => nav.onKeyDown(event, { search: true })} />
      <OptionList id={nav.listId} label={label} options={nav.shown} selected={value ? [value] : []} active={nav.active} onActive={nav.setActive} onPick={onPick} emptyText="没有匹配的字段" />
    </PopoverLayer>
  );
}
