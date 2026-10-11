/** Pure helpers for SegmentedControl / ChipGroup / QuickDatePresets (unit-tested, no DOM). */

/** Toggle `value` in a multi-selection; the result keeps the options' order and drops unknown values. */
export function toggleChoice(
  options: readonly { value: string }[],
  selected: readonly string[],
  value: string,
): string[] {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return options.map((o) => o.value).filter((v) => next.has(v));
}

/**
 * Index of the next enabled item moving `step` (±1) from `from`, wrapping; "first" / "last" jump.
 * Returns -1 when every item is disabled.
 */
export function stepEnabled(
  disabled: readonly boolean[],
  from: number,
  step: 1 | -1 | "first" | "last",
): number {
  const n = disabled.length;
  if (!disabled.some((d) => !d)) return -1;
  if (step === "first") return disabled.findIndex((d) => !d);
  if (step === "last") return n - 1 - [...disabled].reverse().findIndex((d) => !d);
  let i = from;
  for (let k = 0; k < n; k++) {
    i = (((i + step) % n) + n) % n;
    if (!disabled[i]) return i;
  }
  return -1;
}

const pad = (n: number) => String(n).padStart(2, "0");
/**
 * Local-time value for a `<input type="date">` (YYYY-MM-DD) or `datetime-local` (YYYY-MM-DDTHH:mm)
 * `days` calendar days after `now`. Calendar arithmetic, so DST changes do not shift the clock time.
 */
export function datePresetValue(
  days: number,
  type: "date" | "datetime-local" = "datetime-local",
  now: Date = new Date(),
): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return type === "date" ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// bt/share：QuickDatePresets 的小时档、选中态和「策略禁止（原因）」
/** Key of a QuickDatePresets button: `${n}h` (hours), `${n}d` (days) or "permanent". */
export type DatePresetKey = `${number}h` | `${number}d` | "permanent";
export const datePresetKey = (amount: number, unit: "h" | "d"): DatePresetKey => `${amount}${unit}`;

/** Like datePresetValue, `hours` after `now` (exact elapsed hours; a `date` input gets that day). */
export function hourPresetValue(
  hours: number,
  type: "date" | "datetime-local" = "datetime-local",
  now: Date = new Date(),
): string {
  const d = new Date(now.getTime() + hours * 3_600_000);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return type === "date" ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Milliseconds a preset covers (null = permanent); for comparing against a policy maximum. */
export function datePresetMs(key: DatePresetKey): number | null {
  if (key === "permanent") return null;
  const amount = Number.parseFloat(key);
  return key.endsWith("h") ? amount * 3_600_000 : amount * 86_400_000;
}

// ---------------------------------------------------------------- remote search (AsyncChoice)

export type RemoteSearchStatus = "idle" | "loading" | "ready" | "error";
export type RemoteSearchState<T> = {
  /** What is in the search box (also while an IME is composing). */
  query: string;
  status: RemoteSearchStatus;
  /** Results of the last finished request (kept on screen while the next one loads). */
  items: readonly T[];
  error: string | null;
};
/** The host's search: options matching `search` (trimmed; "" = the first page / suggestions). Honour `signal`. */
export type RemoteSearchLoader<T> = (search: string, ctx: { signal: AbortSignal }) => Promise<readonly T[]>;
export type RemoteSearchOptions<T> = {
  load: RemoteSearchLoader<T>;
  onChange: (state: RemoteSearchState<T>) => void;
  /** Quiet time after the last keystroke before searching (default 250 ms). */
  debounceMs?: number;
  /** Fewer characters than this do not search (status "idle"); default 0 = search on open too. */
  minLength?: number;
};
export type RemoteSearch = {
  /** The popover opened: search the current query now (no debounce). */
  open: () => void;
  /** The search box changed. While an IME is composing only the text is kept: no request for half-typed pinyin. */
  setQuery: (query: string) => void;
  compositionStart: () => void;
  /** Composition committed (or cancelled): search the final text. */
  compositionEnd: (query: string) => void;
  retry: () => void;
  /** Cancel the timer and abort the running request (popover closed / unmounted). */
  dispose: () => void;
};

const failureText = (error: unknown) => (error instanceof Error && error.message ? error.message : typeof error === "string" && error ? error : "没加载出来");

/**
 * Debounced, abortable remote search for a select box. A new query aborts the request still running (its late
 * answer is ignored even if the loader ignores the signal), waits `debounceMs`, then calls `load`. Nothing is
 * requested while an IME composes (compositionstart … compositionend). Framework-free; AsyncChoice wraps it.
 */
export function createRemoteSearch<T>({ load, onChange, debounceMs = 250, minLength = 0 }: RemoteSearchOptions<T>): RemoteSearch {
  let state: RemoteSearchState<T> = { query: "", status: "idle", items: [], error: null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: AbortController | null = null;
  let composing = false;
  const emit = (patch: Partial<RemoteSearchState<T>>) => {
    state = { ...state, ...patch };
    onChange(state);
  };
  const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    running?.abort();
    running = null;
  };
  const run = (query: string) => {
    const ctrl = new AbortController();
    running = ctrl;
    const settle = (patch: Partial<RemoteSearchState<T>>) => {
      if (ctrl.signal.aborted) return;
      running = null;
      emit(patch);
    };
    Promise.resolve()
      .then(() => load(query.trim(), { signal: ctrl.signal }))
      .then((items) => settle({ status: "ready", items: [...items], error: null }), (error: unknown) => settle({ status: "error", error: failureText(error) }));
  };
  const schedule = (query: string, delay: number) => {
    stop();
    if (query.trim().length < minLength) return emit({ status: "idle", items: [], error: null });
    emit({ status: "loading", error: null });
    if (delay <= 0) return run(query);
    timer = setTimeout(() => {
      timer = undefined;
      run(query);
    }, delay);
  };
  return {
    open: () => schedule(state.query, 0),
    setQuery: (query) => {
      if (query === state.query) return;
      emit({ query });
      if (!composing) schedule(query, debounceMs);
    },
    compositionStart: () => {
      composing = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    compositionEnd: (query) => {
      composing = false;
      emit({ query });
      schedule(query, debounceMs);
    },
    retry: () => schedule(state.query, 0),
    dispose: stop,
  };
}
