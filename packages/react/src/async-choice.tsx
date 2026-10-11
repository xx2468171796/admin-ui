"use client";
/**
 * AsyncChoice: Choice whose options come from the server as you type (customers, SKUs, people in a large org).
 * Same trigger, popover, keyboard and look as Choice; the list is `loadOptions(search, { signal })`, called on
 * open and 250 ms after the last keystroke, the previous request aborted, nothing sent while an IME composes
 * (pinyin). States in the popover: searching (spinner), 「没有匹配「…」的选项」, failure + 重试, and 「再输入 N 个字」
 * below `minSearchLength`. The chosen option's label stays known after the list changes (`selectedOption` for the
 * value the form starts with).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { PopoverLayer } from "./popover-panel.tsx";
import { OptionContent, OptionList, SelectSearch, optionId, type SelectItem } from "./option-list.tsx";
import { initialActive, isPickable, keyboardOrder, moveActive } from "./option-list-core.ts";
import { createRemoteSearch, type RemoteSearchLoader, type RemoteSearchState } from "./choice-core.ts";
import { withWidth } from "./control-width.ts";
import type { ChoiceProps } from "./select.tsx";

export type AsyncChoiceProps = Omit<ChoiceProps, "options" | "searchable" | "onCreate"> & {
  /** Options matching `search` ("" on open = suggestions / first page). Abort with `signal`; reject → 「重试」. */
  loadOptions: RemoteSearchLoader<SelectItem>;
  /** The option of the current value, for its label before any search (a form opened on an existing record). */
  selectedOption?: SelectItem | null;
  /** Quiet time after typing before searching (default 250 ms). */
  debounceMs?: number;
  /** Search only from this many characters (default 0 = also on open). */
  minSearchLength?: number;
  /** Placeholder of the search box (default 「搜索」). */
  searchPlaceholder?: string;
};

const IDLE: RemoteSearchState<SelectItem> = { query: "", status: "idle", items: [], error: null };

/** The remote list of an open popover (see choice-core createRemoteSearch); fresh for every opening. */
function useRemoteOptions(props: AsyncChoiceProps) {
  const latest = useRef(props);
  latest.current = props;
  const [state, setState] = useState(IDLE);
  const [search] = useState(() =>
    createRemoteSearch<SelectItem>({
      load: (q, ctx) => latest.current.loadOptions(q, ctx),
      onChange: setState,
      debounceMs: props.debounceMs,
      minLength: props.minSearchLength,
    }),
  );
  useEffect(() => {
    search.open();
    return search.dispose;
  }, [search]);
  return { state, search };
}

type PanelProps = { props: AsyncChoiceProps; anchor: HTMLElement | null; width?: number; onPick: (option: SelectItem) => void; onClose: (returnFocus: boolean) => void };

function statusText(state: RemoteSearchState<SelectItem>, props: AsyncChoiceProps): string | null {
  const q = state.query.trim();
  const min = props.minSearchLength ?? 0;
  if (q.length < min) return `再输入 ${min - q.length} 个字开始搜索`;
  if (state.status === "error") return `没加载出来：${state.error ?? ""}`;
  if (state.status === "loading" && !state.items.length) return "正在搜索…";
  if (state.status === "ready" && !state.items.length) return q ? `没有匹配「${q}」的选项` : props.emptyText ?? "没有可选的选项";
  return null;
}

/** Search box + remote list + states; keyboard like Choice (↑↓ Home End move, Enter picks, Esc closes). */
function AsyncChoicePanel({ props, anchor, width, onPick, onClose }: PanelProps) {
  const listId = useId();
  const { state, search } = useRemoteOptions(props);
  const shown = keyboardOrder(state.items);
  const selected = props.value ? [props.value] : [];
  const [active, setActive] = useState(0);
  const listKey = shown.map((o) => o.value).join("\u0001");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the option values (`listKey`): `shown` / `selected` are new arrays each render, and the highlight resets only when the list really changed.
  useEffect(() => setActive(initialActive(shown, selected)), [listKey]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.nativeEvent.isComposing) return;
    const next = moveActive(shown, active, event.key, false);
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = shown[active];
      if (option && isPickable(option)) onPick(option);
    }
  };
  const message = statusText(state, props);
  return (
    <PopoverLayer open anchor={anchor} label={`选择${props.label}`} onClose={onClose} className="aui-popover aui-select-pop" style={width ? { minWidth: Math.round(width) } : undefined} sheet={{ title: props.label }}>
      <div onCompositionStart={search.compositionStart} onCompositionEnd={(event) => search.compositionEnd((event.target as HTMLInputElement).value)}>
        <SelectSearch value={state.query} onChange={search.setQuery} label={`搜索${props.label}`} placeholder={props.searchPlaceholder ?? "搜索"} listId={listId} activeId={shown[active] ? optionId(listId, active) : undefined} onKeyDown={onKeyDown} />
      </div>
      {shown.length > 0 && (
        <OptionList id={listId} label={props.label} options={shown} selected={selected} active={active} onActive={setActive} onPick={(v) => { const o = shown.find((x) => x.value === v); if (o) onPick(o); }} size={props.size ?? "md"} />
      )}
      <div className="aui-opt-empty" role="status" aria-live="polite" aria-busy={state.status === "loading" || undefined} hidden={!message && state.status !== "loading"}>
        {state.status === "loading" && <span className="aui-spinner" data-tone="brand" aria-hidden="true" />}
        {message}
        {state.status === "error" && (
          <button type="button" className="aui-button aui-button-text aui-button-xs" onClick={search.retry}>重试</button>
        )}
      </div>
    </PopoverLayer>
  );
}

/** Choice with server-side search — see the module comment. */
export function AsyncChoice(props: AsyncChoiceProps) {
  const { label, id, value, onChange, disabled, readOnly, placeholder = "请选择", size = "md", clearable, className } = props;
  const [open, setOpen] = useState(false);
  const [boxWidth, setBoxWidth] = useState<number | undefined>();
  const [picked, setPicked] = useState<SelectItem | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const locked = Boolean(disabled || readOnly);
  const current = [picked, props.selectedOption].find((o) => o && o.value === value) ?? null;
  const filled = Boolean(value) && !locked;
  const show = () => {
    if (locked) return;
    setBoxWidth(trigger.current?.getBoundingClientRect().width);
    setOpen(true);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus({ preventScroll: true });
  };
  const pick = (option: SelectItem) => {
    setPicked(option);
    if (option.value !== value) onChange(option.value);
    close(true);
  };
  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (locked) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
    } else if ((event.key === "Delete" || event.key === "Backspace") && clearable && value) {
      event.preventDefault();
      onChange("");
    }
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={props["aria-labelledby"] ? undefined : label}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        aria-readonly={readOnly || undefined}
        disabled={disabled}
        className={["aui-input aui-select", className].filter(Boolean).join(" ")}
        style={withWidth(undefined, props.width)}
        data-size={size}
        data-state={open ? "open" : undefined}
        data-filled={filled || undefined}
        data-readonly={readOnly || undefined}
        onClick={() => (open ? close(false) : show())}
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
      {open && <AsyncChoicePanel props={props} anchor={trigger.current} width={boxWidth} onPick={pick} onClose={close} />}
    </>
  );
}
