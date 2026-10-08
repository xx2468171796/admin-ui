/**
 * Settings pages: one sticky SaveBar for the whole page. Keep the saved values and the
 * draft side by side; the bar counts the changed fields (「改了 2 处」) and each changed field shows 「已改」.
 * Switches that take effect at once are saved by themselves (AsyncSwitch) and are not part of the draft.
 */
import { useCallback, useMemo, useState } from "react";

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
  /** After a successful save: the draft becomes the saved value (or pass what the server returned). */
  commit: (saved?: T) => void;
};

/**
 * Draft + saved values for one settings page. `initial` is read when the hook mounts and whenever its
 * identity changes together with `version` (e.g. after a reload from the server).
 */
export function useChangeTracker<T extends Record<string, unknown>>(initial: T, version?: string | number): ChangeTracker<T> {
  const [state, setState] = useState(() => ({ saved: initial, values: initial, version }));
  if (state.version !== version) setState({ saved: initial, values: initial, version });
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setState((s) => ({ ...s, values: { ...s.values, [key]: value } })), []);
  const keys = useMemo(() => changedKeys(state.saved, state.values), [state.saved, state.values]);
  const changed = useCallback((key: keyof T) => keys.includes(key as keyof T & string), [keys]);
  const reset = useCallback(() => setState((s) => ({ ...s, values: s.saved })), []);
  const commit = useCallback((saved?: T) => setState((s) => ({ ...s, saved: saved ?? s.values, values: saved ?? s.values })), []);
  return { values: state.values, set, changed, keys, count: keys.length, reset, commit };
}
