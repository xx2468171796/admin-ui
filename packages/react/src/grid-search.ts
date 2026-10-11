/**
 * The grid toolbar's search box (GridToolbar): typing updates the box at once, the view's `search` (and with it a
 * client re-filter or a server query) only 300 ms after the last keystroke, never while an IME is composing
 * (pinyin 「zhang」 is not a search) — the composed text is searched once composition ends. Clearing the box applies
 * at once. `createSearchDebouncer` is the pure part (unit-tested in test/grid-search.test.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CompositionEvent } from "react";

export const GRID_SEARCH_DELAY = 300;

export type SearchDebouncer = {
  /** The box changed (`composing`: the change is part of an IME composition). */
  input(text: string, composing?: boolean): void;
  compositionStart(): void;
  /** Composition finished with the box holding `text`. */
  compositionEnd(text: string): void;
  /** Drop a scheduled commit (the value was replaced from outside). */
  cancel(): void;
};
type Timers = { schedule?: (run: () => void, ms: number) => unknown; clear?: (handle: unknown) => void };

export function createSearchDebouncer(commit: (text: string) => void, options: { delay?: number } & Timers = {}): SearchDebouncer {
  const delay = options.delay ?? GRID_SEARCH_DELAY;
  const schedule = options.schedule ?? ((run: () => void, ms: number) => setTimeout(run, ms));
  const clear = options.clear ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let composing = false;
  const cancel = () => {
    if (timer !== null) clear(timer);
    timer = null;
  };
  const input = (text: string, inComposition = false) => {
    cancel();
    if (composing || inComposition) return;
    if (text === "") return commit("");
    timer = schedule(() => {
      timer = null;
      commit(text);
    }, delay);
  };
  return {
    input,
    compositionStart: () => {
      composing = true;
      cancel();
    },
    compositionEnd: (text) => {
      composing = false;
      input(text);
    },
    cancel,
  };
}

/**
 * Local text of a search box bound to `value`, committed through `onCommit` as described above. Spread
 * `composition` on an element around the input (composition events bubble).
 */
export function useDebouncedSearch(value: string, onCommit: (text: string) => void) {
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const debouncer = useMemo(() => createSearchDebouncer((next) => {
    committed.current = next;
    commitRef.current(next);
  }), []);
  useEffect(() => () => debouncer.cancel(), [debouncer]);
  // Replaced from outside (清除筛选和搜索, another view): show it and drop what was pending.
  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    debouncer.cancel();
    setText(value);
  }, [value, debouncer]);
  const onChange = useCallback((next: string) => {
    setText(next);
    debouncer.input(next);
  }, [debouncer]);
  const composition = useMemo(() => ({
    onCompositionStart: () => debouncer.compositionStart(),
    onCompositionEnd: (event: CompositionEvent<HTMLElement>) => {
      const target = event.target as HTMLInputElement;
      debouncer.compositionEnd(typeof target.value === "string" ? target.value : event.data);
    },
  }), [debouncer]);
  return { text, onChange, composition };
}
