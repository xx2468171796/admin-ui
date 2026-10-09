"use client";
/**
 * The one dropdown look (review family 2 / 4): the pieces every select popover in the SDK
 * is built from — Choice / MultiChoice, BitableGrid's option editor, the filter's field / value pickers.
 *
 * - `SelectSearch`: the search row at the top (shown for more than 6 options, or when you can create).
 * - `OptionList`: listbox; rows 32px, radius 6, whole-row hover; group headings; single = tick on the
 *   right, multi = checkbox on the left; option colour as a tag, people with an avatar, icons; greyed rows
 *   with their reason; 「没有匹配」 empty state; 「＋ 新建选项『…』 Enter」 row.
 * - `SelectFooter`: 「已选 N 项」 + 清空 on the right (multi).
 * Focus stays in the search box (or the listbox when there is none): `aria-activedescendant`.
 */
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { groupOptions, type SelectOption } from "./option-list-core.ts";
import { resolveOptionTone } from "./option-tone.ts";

/** An option with an optional icon (field type icons, 「我」). */
export type SelectItem = SelectOption & { icon?: ReactNode; /** Small marker before the hint (a lock with its reason). */ extra?: ReactNode };

export const optionId = (listId: string, index: number) => `${listId}-o${index}`;

/** The visible part of an option: a coloured tag, an avatar + name, or icon + text. */
export function OptionContent({ option, size = "md" }: { option: SelectItem; size?: "sm" | "md" | "lg" }) {
  if (option.avatar !== undefined) {
    const initial = option.avatar || Array.from(option.label.trim())[0] || "?";
    return (
      <span className="aui-opt-person">
        <span className="aui-opt-avatar" aria-hidden="true">{initial}</span>
        <span className="aui-opt-text">{option.label}</span>
      </span>
    );
  }
  if (option.tone !== undefined || option.color !== undefined)
    return (
      <span className="aui-chip" data-tone={resolveOptionTone(option)} data-size={size === "sm" ? undefined : size}>
        <span className="aui-chip-label">{option.label}</span>
      </span>
    );
  return (
    <>
      {option.icon && <span className="aui-opt-icon" aria-hidden="true">{option.icon}</span>}
      <span className="aui-opt-text">{option.label}</span>
    </>
  );
}

export type SelectSearchProps = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  /** Accessible name (「搜索阶段」). */
  label: string;
  listId: string;
  activeId?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
};
/** Search row at the top of a select popover (a combobox driving the list below). */
export function SelectSearch({ value, onChange, placeholder = "搜索", label, listId, activeId, onKeyDown, autoFocus = true }: SelectSearchProps) {
  return (
    <div className="aui-select-search">
      <Search aria-hidden="true" />
      <input
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        data-autofocus={autoFocus ? "" : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export type OptionListProps = {
  id: string;
  /** Accessible name of the listbox (the field / filter name, e.g. 「阶段」). */
  label: string;
  /** Shown options in keyboard order (`keyboardOrder`). */
  options: readonly SelectItem[];
  selected: readonly string[];
  multiple?: boolean;
  /** Keyboard row (index in `options`; `options.length` = the create row). */
  active: number;
  onActive: (index: number) => void;
  onPick: (value: string) => void;
  /** The label 「新建」 would create (null = no create row). */
  create?: string | null;
  onCreate?: (label: string) => void;
  /** A create is under way for this label: the row stays, says 「正在新建」 and can't be picked again. */
  creating?: string | null;
  /** Text when nothing matches (「没有匹配「花莲」的选项」). */
  emptyText?: string;
  /** Tag size of coloured options. */
  size?: "sm" | "md";
  /** Focus lives on the listbox itself (no search box): make it a tab stop with activedescendant. */
  focusable?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  /** Pick on pointerdown (grid editors keep focus in their box) instead of click. */
  pickOnPointerDown?: boolean;
};

/** The listbox of a select popover; see the module comment. */
export function OptionList({ id, label, options, selected, multiple, active, onActive, onPick, create, onCreate, creating, emptyText = "没有匹配的选项", size = "md", focusable, onKeyDown, pickOnPointerDown }: OptionListProps) {
  const sections = groupOptions(options);
  const pick = (option: SelectItem) => {
    if (option.disabled || option.disabledReason) return;
    onPick(option.value);
  };
  const handlers = (option: SelectItem, index: number) =>
    pickOnPointerDown
      ? { onPointerDown: (event: PointerEvent) => { event.preventDefault(); pick(option); }, onPointerEnter: () => onActive(index) }
      : { onMouseDown: (event: MouseEvent) => event.preventDefault(), onClick: () => pick(option), onPointerEnter: () => onActive(index) };
  const row = (option: SelectItem, index: number) => {
    const on = selected.includes(option.value);
    const off = Boolean(option.disabled || option.disabledReason);
    return (
      <li
        key={option.value}
        id={optionId(id, index)}
        role="option"
        aria-selected={on}
        aria-disabled={off || undefined}
        className="aui-opt"
        data-active={index === active || undefined}
        data-multi={multiple || undefined}
        data-tip={option.disabledReason}
        {...handlers(option, index)}
      >
        {multiple && <span className="aui-opt-box" data-checked={on || undefined} aria-hidden="true">{on && <Check />}</span>}
        <span className="aui-opt-main">
          <OptionContent option={option} size={size} />
        </span>
        {option.extra}
        {(option.disabledReason ?? option.hint) && <span className="aui-opt-hint">{option.disabledReason ?? option.hint}</span>}
        {!multiple && <Check className="aui-opt-tick" aria-hidden="true" />}
      </li>
    );
  };
  return (
    <>
      <ul
        id={id}
        role="listbox"
        aria-label={label}
        aria-multiselectable={multiple || undefined}
        aria-activedescendant={focusable && options[active] ? optionId(id, active) : undefined}
        tabIndex={focusable ? 0 : undefined}
        data-autofocus={focusable ? "" : undefined}
        className="aui-optlist"
        onKeyDown={onKeyDown}
      >
        {sections.map((section) =>
          section.group === null ? (
            section.options.map(({ option, index }) => row(option, index))
          ) : (
            <li key={`g:${section.group}`} role="presentation" className="aui-optsection">
              <span className="aui-optgroup" id={`${id}-g${section.options[0]!.index}`}>{section.group}</span>
              <ul role="group" aria-labelledby={`${id}-g${section.options[0]!.index}`}>
                {section.options.map(({ option, index }) => row(option, index))}
              </ul>
            </li>
          ),
        )}
      </ul>
      {!options.length && (
        <div className="aui-opt-empty" role="status">
          <span className="aui-opt-empty-icon" aria-hidden="true"><Search /></span>
          {emptyText}
        </div>
      )}
      {((create && onCreate) || creating) && (
        <button
          type="button"
          id={optionId(id, options.length)}
          tabIndex={-1}
          role="option"
          aria-selected={false}
          aria-label={creating ? `正在新建选项「${creating}」` : `新建选项「${create}」`}
          aria-busy={creating ? true : undefined}
          aria-disabled={creating ? true : undefined}
          className="aui-opt aui-opt-create"
          data-active={active === options.length || undefined}
          data-pending={creating ? "" : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onPointerEnter={() => onActive(options.length)}
          onClick={() => !creating && create && onCreate?.(create)}
        >
          {creating ? <span className="aui-spinner" data-tone="brand" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {creating ? "正在新建" : "新建选项"}
          <span className="aui-chip" data-tone="gray" data-size="md"><span className="aui-chip-label">{creating ?? create}</span></span>
          {!creating && <kbd className="aui-opt-kbd">Enter</kbd>}
        </button>
      )}
    </>
  );
}

/** 「已选 N 项」 + 清空 at the bottom of a multi select. */
export function SelectFooter({ count, onClear, note }: { count: number; onClear?: () => void; note?: ReactNode }) {
  return (
    <div className="aui-select-foot">
      <span className="aui-select-foot-text">已选 {count} 项{note ? <> · {note}</> : null}</span>
      {onClear && count > 0 && (
        <button type="button" className="aui-select-foot-clear" onMouseDown={(event) => event.preventDefault()} onClick={onClear}>
          清空
        </button>
      )}
    </div>
  );
}

/** A removable chip (multi values in a box): the tag + an × that only darkens on hover. */
export function RemovableChip({ option, onRemove, disabled, size = "md" }: { option: SelectItem; onRemove?: () => void; disabled?: boolean; size?: "sm" | "md" }) {
  const person = option.avatar !== undefined;
  const tone = person ? "gray" : resolveOptionTone(option);
  return (
    <span className="aui-chip aui-chip-removable" data-tone={tone} data-size={size === "md" ? "md" : undefined} data-person-chip={person || undefined}>
      {person && <span className="aui-opt-avatar" aria-hidden="true">{option.avatar || Array.from(option.label.trim())[0] || "?"}</span>}
      <span className="aui-chip-label">{option.label}</span>
      {onRemove && !disabled && (
        <button type="button" className="aui-chip-remove" aria-label={`移除「${option.label}」`} tabIndex={-1}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => { event.stopPropagation(); onRemove(); }}>
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
