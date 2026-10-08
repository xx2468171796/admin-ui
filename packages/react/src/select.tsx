"use client";
/**
 * Choice / MultiChoice / ChoiceTags (review families 2–4): one trigger look and one
 * popover look for every dropdown in a form, a filter bar or a dialog.
 *
 * - Trigger: the kit Input box (36px, `size="sm"` 28px); the value shows as its coloured tag when the
 *   option has a colour; placeholder in the note colour; chevron on the right that turns while open;
 *   `clearable`: an × replaces the chevron on hover (Delete / Backspace clears from the keyboard) — 「清空」
 *   is never a fake first option.
 * - Popover (option-list.tsx): search on top when there are more than 6 options or new ones can be
 *   created, groups, single = tick on the right, multi = checkbox on the left + 「已选 N 项 · 清空」,
 *   greyed options with their reason, 「＋ 新建选项」. Phones: the same list as a bottom sheet.
 * - ChoiceTags: ≤ 6 options in a form laid out as coloured tag buttons (radio group).
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { PopoverLayer } from "./popover-panel.tsx";
import { OptionContent, OptionList, RemovableChip, SelectFooter, SelectSearch, type SelectItem } from "./option-list.tsx";
import { chipsThatFit, showsSearch, toggleValue } from "./option-list-core.ts";
import { useOptionNav } from "./use-option-nav.ts";
import { resolveOptionTone } from "./option-tone.ts";

export type { SelectItem } from "./option-list.tsx";
export type { SelectOption } from "./option-list-core.ts";

type FieldAria = {
  /** Set automatically inside FormField: the visible label names the control instead of `label`. */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};
type SharedSelectProps = FieldAria & {
  /** Accessible name; also the bottom-sheet title on phones. */
  label: string;
  id?: string;
  options: readonly SelectItem[];
  disabled?: boolean;
  /** Shown like a value but cannot be changed (lock, no border). */
  readOnly?: boolean;
  placeholder?: string;
  /** md 36px (default) · sm 28px (filter bars, grid cells). */
  size?: "sm" | "md";
  /** Search box: "auto" (default) = more than 6 options or `onCreate` given. */
  searchable?: boolean | "auto";
  /** Offer 「＋ 新建选项『…』」 for a search no option matches; create it and return its value (or nothing). */
  onCreate?: (label: string) => string | void | Promise<string | void>;
  className?: string;
  /** Text of the empty state (default 「没有匹配的选项」). */
  emptyText?: string;
};

export type ChoiceProps = SharedSelectProps & {
  value: string;
  onChange: (value: string) => void;
  /** Hover × that empties the value (onChange("")). */
  clearable?: boolean;
};

/** Trigger + popover state shared by Choice and MultiChoice. */
function useSelectPopover(disabled?: boolean, readOnly?: boolean) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState<number | undefined>();
  const show = () => {
    if (disabled || readOnly) return;
    setWidth(trigger.current?.getBoundingClientRect().width);
    setOpen(true);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus({ preventScroll: true });
  };
  return { open, show, close, trigger, width };
}

const isLocked = (p: { disabled?: boolean; readOnly?: boolean }) => Boolean(p.disabled || p.readOnly);

/** One value from a list — see the module comment. Drop-in for the old Radix Choice (same props). */
export function Choice(props: ChoiceProps) {
  const { label, id, value, options, onChange, disabled, readOnly, placeholder = "请选择", size = "md", clearable, searchable = "auto", onCreate, className, emptyText } = props;
  const pop = useSelectPopover(disabled, readOnly);
  const current = options.find((o) => o.value === value);
  const filled = Boolean(value) && !isLocked(props);
  const create = onCreate ? async (text: string) => {
    const made = await onCreate(text);
    if (typeof made === "string" && made) onChange(made);
    pop.close(true);
  } : undefined;
  const pick = (next: string) => {
    if (next !== value) onChange(next);
    pop.close(true);
  };
  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isLocked(props)) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      pop.show();
    } else if ((event.key === "Delete" || event.key === "Backspace") && clearable && value) {
      event.preventDefault();
      onChange("");
    }
  };
  return (
    <>
      <button
        ref={(el) => {
          pop.trigger.current = el;
        }}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={pop.open}
        aria-label={props["aria-labelledby"] ? undefined : label}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        aria-readonly={readOnly || undefined}
        disabled={disabled}
        className={["aui-input aui-select", className].filter(Boolean).join(" ")}
        data-size={size}
        data-state={pop.open ? "open" : undefined}
        data-filled={filled || undefined}
        data-readonly={readOnly || undefined}
        onClick={() => (pop.open ? pop.close(false) : pop.show())}
        onKeyDown={onTriggerKey}
      >
        <span className="aui-select-value">
          {current ? <OptionContent option={current} size={size === "sm" ? "sm" : "md"} /> : value ? <span className="aui-opt-text">{value}</span> : <span className="aui-select-ph">{placeholder}</span>}
        </span>
        {clearable && filled && (
          <span className="aui-select-clear" aria-hidden="true" data-tip="清空" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onChange(""); }} onClick={(event) => event.stopPropagation()}>
            <X />
          </span>
        )}
        <ChevronDown className="aui-select-chev" aria-hidden="true" />
      </button>
      {pop.open && (
        <ChoicePopover
          {...{ label, options, searchable, emptyText }}
          anchor={pop.trigger.current}
          width={pop.width}
          selected={value ? [value] : []}
          multiple={false}
          onPick={pick}
          onCreate={create}
          onClose={pop.close}
          size={size}
        />
      )}
    </>
  );
}

type PopoverProps = {
  label: string;
  options: readonly SelectItem[];
  searchable: boolean | "auto";
  emptyText?: string;
  anchor: HTMLElement | null;
  width?: number;
  selected: readonly string[];
  multiple: boolean;
  onPick: (value: string) => void;
  onCreate?: (label: string) => void;
  onClose: (returnFocus: boolean) => void;
  size: "sm" | "md";
  footer?: ReactNode;
  sheetEnd?: ReactNode;
};
/** The popover of Choice / MultiChoice: search, list, create row, footer; a bottom sheet on phones. */
function ChoicePopover({ label, options, searchable, emptyText, anchor, width, selected, multiple, onPick, onCreate, onClose, size, footer, sheetEnd }: PopoverProps) {
  const nav = useOptionNav({ options, selected, onPick, onCreate });
  const search = showsSearch(options.length, searchable) || Boolean(onCreate);
  const done = (
    <button type="button" className="aui-sheet-action" data-muted={multiple ? undefined : ""} onClick={() => onClose(true)}>{multiple ? "完成" : "取消"}</button>
  );
  return (
    <PopoverLayer
      open
      anchor={anchor}
      label={`选择${label}`}
      onClose={onClose}
      className="aui-popover aui-select-pop"
      style={width ? { minWidth: Math.round(width) } : undefined}
      sheet={{ title: label, end: sheetEnd ?? done }}
    >
      {search && (
        <SelectSearch
          value={nav.query}
          onChange={nav.setQuery}
          label={`搜索${label}`}
          placeholder={onCreate ? "搜索或新建选项" : "搜索"}
          listId={nav.listId}
          activeId={nav.activeId}
          onKeyDown={(event) => nav.onKeyDown(event, { search: true })}
        />
      )}
      <OptionList
        id={nav.listId}
        label={label}
        options={nav.shown}
        selected={selected}
        multiple={multiple}
        active={nav.active}
        onActive={nav.setActive}
        onPick={onPick}
        create={nav.create}
        onCreate={onCreate}
        emptyText={nav.query.trim() ? `没有匹配「${nav.query.trim()}」的选项` : emptyText ?? "没有可选的选项"}
        size={size}
        focusable={!search}
        onKeyDown={search ? undefined : (event) => nav.onKeyDown(event, { search: false })}
      />
      {footer}
    </PopoverLayer>
  );
}

export type MultiChoiceProps = SharedSelectProps & {
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Most values allowed; more are refused (show the reason with FormField error). */
  max?: number;
};

/**
 * Several values: chosen values are removable tags (× darkens on hover) in the box; what does not fit
 * folds into 「+N」 (sm: one line; md wraps). The popover has checkboxes, search, 「已选 N 项 · 清空」;
 * every click applies at once, clicking outside just closes (no 「完成」 button; phones: 完成 top right).
 */
export function MultiChoice(props: MultiChoiceProps) {
  const { label, id, value, options, onChange, disabled, readOnly, placeholder = "请选择", size = "md", searchable = "auto", onCreate, className, emptyText, max } = props;
  const pop = useSelectPopover(disabled, readOnly);
  const order = options.map((o) => o.value);
  const chosen = value.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v });
  const locked = isLocked(props);
  const toggle = (v: string) => {
    const next = toggleValue(value, v, order, max);
    if (next) onChange(next);
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));
  const create = onCreate ? async (text: string) => {
    const made = await onCreate(text);
    if (typeof made === "string" && made && !value.includes(made) && (max === undefined || value.length < max)) onChange([...value, made]);
  } : undefined;
  const oneLine = size === "sm";
  const fit = useChipFit(pop.trigger, JSON.stringify(value), chosen.length, oneLine);
  const shown = chosen.slice(0, fit);
  const hidden = chosen.slice(fit);
  return (
    <>
      <div
        ref={(el) => {
          pop.trigger.current = el;
        }}
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={pop.open}
        aria-label={props["aria-labelledby"] ? undefined : `${label}：${chosen.map((c) => c.label).join("、") || "未选择"}`}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        aria-disabled={disabled || undefined}
        aria-readonly={readOnly || undefined}
        className={["aui-input aui-select aui-multiselect", className].filter(Boolean).join(" ")}
        data-size={size}
        data-state={pop.open ? "open" : undefined}
        data-filled={(value.length > 0 && !locked) || undefined}
        data-readonly={readOnly || undefined}
        data-disabled={disabled || undefined}
        onClick={() => (pop.open ? pop.close(false) : pop.show())}
        onKeyDown={(event) => {
          if (locked) return;
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            pop.show();
          } else if (event.key === "Backspace" && value.length) {
            event.preventDefault();
            remove(value[value.length - 1]!);
          }
        }}
      >
        <span className="aui-select-value aui-multiselect-chips">
          {chosen.length === 0 && <span className="aui-select-ph">{placeholder}</span>}
          {shown.map((option) => (
            <RemovableChip key={option.value} option={option} size={size === "sm" ? "sm" : "md"} disabled={locked} onRemove={() => remove(option.value)} />
          ))}
          {hidden.length > 0 && <span className="aui-chip aui-chip-more" data-tip={hidden.map((c) => c.label).join("、")}>+{hidden.length}</span>}
        </span>
        {oneLine && chosen.length > 0 && (
          <span className="aui-multiselect-measure" aria-hidden="true">
            {chosen.map((option) => <RemovableChip key={option.value} option={option} size="sm" onRemove={locked ? undefined : () => undefined} />)}
            <span className="aui-chip aui-chip-more">+{chosen.length}</span>
          </span>
        )}
        {!locked && value.length > 0 && (
          <span className="aui-select-clear" aria-hidden="true" data-tip="清空" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onChange([]); }} onClick={(event) => event.stopPropagation()}>
            <X />
          </span>
        )}
        <ChevronDown className="aui-select-chev" aria-hidden="true" />
      </div>
      {pop.open && (
        <ChoicePopover
          {...{ label, options, searchable, emptyText }}
          anchor={pop.trigger.current}
          width={pop.width}
          selected={value}
          multiple
          onPick={toggle}
          onCreate={create}
          onClose={pop.close}
          size={size}
          footer={<SelectFooter count={value.length} note={max !== undefined ? `最多 ${max} 项` : undefined} onClear={() => onChange([])} />}
        />
      )}
    </>
  );
}

/**
 * How many chips of a one-line (`oneLine`) box fit: measured from a hidden copy of all chips
 * (`.aui-multiselect-measure`), again whenever the box resizes or the values change.
 */
function useChipFit(box: { current: HTMLElement | null }, key: string, count: number, oneLine: boolean): number {
  const [fit, setFit] = useState(count);
  useLayoutEffect(() => {
    const node = box.current;
    if (!oneLine || !node) return setFit(count);
    const measure = () => {
      const row = node.querySelector<HTMLElement>(".aui-multiselect-chips");
      const copy = node.querySelector<HTMLElement>(".aui-multiselect-measure");
      if (!row || !copy) return;
      const chips = [...copy.querySelectorAll<HTMLElement>(".aui-chip-removable")];
      const more = copy.querySelector<HTMLElement>(".aui-chip-more")?.offsetWidth ?? 30;
      const next = chipsThatFit(chips.map((c) => c.offsetWidth), row.clientWidth, more);
      setFit((old) => (old === next ? old : next));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [box, key, count, oneLine]);
  return Math.min(fit, count);
}

export type ChoiceTagsProps = FieldAria & {
  label: string;
  value: string;
  options: readonly SelectItem[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * A short single choice in a form (≤ 6 options, the new-record form's 「状态」): every option is a
 * coloured tag button; the chosen one gets the primary border, the focus ring and a tick. Radio group:
 * arrows move and pick. More options → Choice.
 */
export function ChoiceTags({ label, value, options, onChange, disabled, ...aria }: ChoiceTagsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = options.findIndex((o) => o.value === value);
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    for (let n = 1; n <= options.length; n += 1) {
      const next = (index + step * n + options.length) % options.length;
      const option = options[next]!;
      if (option.disabled || option.disabledReason) continue;
      onChange(option.value);
      refs.current[next]?.focus();
      return;
    }
  };
  return (
    <div
      className="aui-tagpick"
      role="radiogroup"
      aria-label={aria["aria-labelledby"] ? undefined : label}
      aria-labelledby={aria["aria-labelledby"]}
      aria-describedby={aria["aria-describedby"]}
      data-invalid={aria["aria-invalid"] === true || aria["aria-invalid"] === "true" || undefined}
    >
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || option.disabled || Boolean(option.disabledReason)}
            data-tip={option.disabledReason}
            tabIndex={on || (at < 0 && index === 0) ? 0 : -1}
            className="aui-tagpick-item"
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKey(event, index)}
          >
            <span className="aui-chip" data-tone={resolveOptionTone(option)}>
              <span className="aui-chip-label">{option.label}</span>
            </span>
            <Check className="aui-tagpick-ok" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
