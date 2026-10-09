"use client";
/**
 * Keyboard + search state shared by every select popover (Choice, MultiChoice, the grid option editor,
 * the filter pickers): the query, the shown options in keyboard order, the active row (skips greyed rows,
 * includes the 「新建」 row), Enter / Space picking, typeahead when there is no search box, and keeping
 * the active row in view.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createCandidate, filterOptions, initialActive, isPickable, keyboardOrder, moveActive, typeahead } from "./option-list-core.ts";
import { optionId, type SelectItem } from "./option-list.tsx";

export type OptionNavInput<O extends SelectItem> = {
  options: readonly O[];
  selected: readonly string[];
  onPick: (value: string) => void;
  /** Offer 「＋ 新建选项」 for a query no option has. */
  onCreate?: (label: string) => void;
  /** Compare the query with option labels case-sensitively for 「新建」 (createCandidate `exact`). */
  createExact?: boolean;
  /** Starting query (type-to-edit in a grid cell). */
  initialQuery?: string;
  /** Enter with nothing to pick (multi: finish). */
  onEnterEmpty?: () => void;
};

export function useOptionNav<O extends SelectItem>({ options, selected, onPick, onCreate, createExact = false, initialQuery = "", onEnterEmpty }: OptionNavInput<O>) {
  const listId = useId();
  const [query, setQueryState] = useState(initialQuery);
  const shown = useMemo(() => keyboardOrder(filterOptions(options, query)), [options, query]);
  const create = onCreate ? createCandidate(options, query, createExact) : null;
  const [active, setActive] = useState(() => initialActive(shown, selected));
  const typed = useRef({ text: "", at: 0 });
  const setQuery = (text: string) => {
    setQueryState(text);
    const next = keyboardOrder(filterOptions(options, text));
    const first = next.findIndex(isPickable);
    setActive(first >= 0 ? first : next.length);
  };
  // Keep the active row in view (keyboard and typeahead move it).
  useEffect(() => {
    document.getElementById(optionId(listId, active))?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);
  const activate = () => {
    if (active === shown.length && create && onCreate) {
      onCreate(create);
      setQueryState("");
      return true;
    }
    const option = shown[active];
    if (option && isPickable(option)) {
      onPick(option.value);
      return true;
    }
    return false;
  };
  /** Keys of the search box / listbox; returns true when it handled the key. */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, opts: { search: boolean }) => {
    if (event.nativeEvent.isComposing) return false;
    const next = moveActive(shown, active, event.key, Boolean(create));
    if (next !== null) {
      event.preventDefault();
      setActive(next);
      return true;
    }
    if (event.key === "Enter" || (!opts.search && event.key === " ")) {
      event.preventDefault();
      if (!activate()) onEnterEmpty?.();
      return true;
    }
    if (!opts.search && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current = { text: now - typed.current.at < 700 ? typed.current.text + event.key : event.key, at: now };
      const hit = typeahead(shown, active, typed.current.text) ?? typeahead(shown, active - 1, typed.current.text);
      if (hit !== null) setActive(hit);
      return true;
    }
    return false;
  };
  return { listId, query, setQuery, shown, active, setActive, create, onKeyDown, activeId: shown[active] || (create && active === shown.length) ? optionId(listId, active) : undefined };
}
