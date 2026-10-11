/**
 * Settings pages: one sticky SaveBar for the whole page. Keep the saved values and the
 * draft side by side; the bar counts the changed fields (「改了 2 处」) and each changed field shows 「已改」.
 * Switches that take effect at once are saved by themselves (AsyncSwitch) and are not part of the draft.
 */
import { useCallback, useMemo, useRef, useState } from "react";

/** Structural equality for form values (primitives, arrays, plain objects, null / undefined, Dates). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Keys whose draft value differs from the saved one, in the draft's key order. */
export function changedKeys<T extends Record<string, unknown>>(saved: T, draft: T, equal: (a: unknown, b: unknown) => boolean = sameValue): (keyof T & string)[] {
  const keys = new Set<string>([...Object.keys(draft), ...Object.keys(saved)]);
  return [...keys].filter((key) => !equal(saved[key], draft[key])) as (keyof T & string)[];
}

/**
 * A save of `snapshot` (the draft when the save started) succeeded and the server holds `saved`: the new
 * draft is `saved`, except fields edited while the request was in flight — they keep the newer value and
 * stay 「已改」, instead of being silently marked saved.
 */
export function commitDraft<T extends Record<string, unknown>>(values: T, snapshot: T, saved: T): T {
  const next: Record<string, unknown> = { ...saved };
  for (const key of changedKeys(snapshot, values)) next[key] = values[key];
  return next as T;
}

/**
 * The saved values were reloaded (`version` changed) while the draft has edits: fields the user did not touch
 * take the new values, edited fields keep the draft. `conflicts` = edited fields the reload changed too.
 */
export function rebaseDraft<T extends Record<string, unknown>>(saved: T, values: T, next: T): { values: T; conflicts: (keyof T & string)[] } {
  const edited = changedKeys(saved, values);
  const draft: Record<string, unknown> = { ...next };
  for (const key of edited) draft[key] = values[key];
  return { values: draft as T, conflicts: edited.filter((key) => !sameValue(saved[key], next[key])) };
}

export type ChangeTracker<T extends Record<string, unknown>> = {
  /** The draft (bind the controls to it). */
  values: T;
  /** Change one field of the draft. */
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Is this field different from the saved value (→ FormField `changed`)? */
  changed: (key: keyof T) => boolean;
  /** Changed keys and their count (→ SaveBar `count`). */
  keys: (keyof T & string)[];
  count: number;
  /** Throw the draft away (SaveBar 放弃). */
  reset: () => void;
  /**
   * After a successful save. Recommended: `commit(snapshot)` with the `values` object the save sent
   * (SaveBar passes it to `onSave` when you give it `values`) — or `commit(serverValues, snapshot)` — then
   * fields edited while the request was in flight stay 「已改」. `commit()` without arguments marks the current
   * draft saved, including such late edits; `commit(serverValues)` alone takes the server values as the draft.
   */
  commit: (saved?: T, snapshot?: T) => void;
  /**
   * Fields edited here that a reload (`version` change) also changed on the server — the draft kept the
   * local value; show them (「别人刚改过：…」) so the user decides. Empty after reset / commit.
   */
  conflicts: (keyof T & string)[];
};

type TrackerState<T> = { saved: T; values: T; version?: string | number; conflicts: (keyof T & string)[] };

/**
 * Draft + saved values for one settings page. `initial` is read when the hook mounts and whenever its
 * identity changes together with `version` (e.g. after a reload from the server). A reload never throws
 * edits away: with a dirty draft, untouched fields update and edited ones are kept (see `conflicts`).
 */
export function useChangeTracker<T extends Record<string, unknown>>(initial: T, version?: string | number): ChangeTracker<T> {
  const [state, setState] = useState<TrackerState<T>>(() => ({ saved: initial, values: initial, version, conflicts: [] }));
  // Draft objects this tracker handed out: `commit(x)` with one of them is a snapshot, not server values.
  const issued = useRef(new WeakSet<object>());
  issued.current.add(state.values);
  if (state.version !== version) {
    const dirty = changedKeys(state.saved, state.values).length > 0;
    const rebased = dirty ? rebaseDraft(state.saved, state.values, initial) : { values: initial, conflicts: [] };
    setState({ saved: initial, values: rebased.values, version, conflicts: rebased.conflicts });
  }
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setState((s) => ({ ...s, values: { ...s.values, [key]: value } })), []);
  const keys = useMemo(() => changedKeys(state.saved, state.values), [state.saved, state.values]);
  const changed = useCallback((key: keyof T) => keys.includes(key as keyof T & string), [keys]);
  const reset = useCallback(() => setState((s) => ({ ...s, values: s.saved, conflicts: [] })), []);
  const commit = useCallback((saved?: T, snapshot?: T) => {
    setState((s) => {
      const base = snapshot ?? (saved && issued.current.has(saved) ? saved : undefined);
      const next = saved ?? s.values;
      return { ...s, saved: next, values: base ? commitDraft(s.values, base, next) : next, conflicts: [] };
    });
  }, []);
  return { values: state.values, set, changed, keys, count: keys.length, reset, commit, conflicts: state.conflicts };
}
