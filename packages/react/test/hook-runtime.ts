/**
 * Test helper: a tiny stand-in for "react" that runs ONE custom hook outside a DOM, enough to
 * observe render / effect / state behaviour of the package's .ts hooks (useDataSource, usePersistentState …).
 * Load the hook module after `installHookRuntime()` so its `import … from "react"` resolves here.
 *
 * Semantics kept from React: state setters bail out on Object.is, setState during render re-runs the render
 * at once, effects run after render in order (layout before passive) and only when their deps changed,
 * cleanups run before the next effect and on unmount. Updates outside render are batched into one
 * re-render per macrotask.
 */
import { registerHooks } from "node:module";

type Effect = { deps?: readonly unknown[]; cleanup?: void | (() => void); run?: () => void | (() => void) };
type Instance = {
  slots: unknown[];
  effects: Effect[];
  index: number;
  effectIndex: number;
  dirty: boolean;
  rendering: boolean;
  dead: boolean;
  renders: number;
  schedule: () => void;
};
let current: Instance | null = null;

function slot<T>(init: () => T): { get: () => T; set: (v: T) => void } {
  const inst = current;
  if (!inst) throw Error("hook called outside renderHook");
  const i = inst.index++;
  if (!(i in inst.slots)) inst.slots[i] = init();
  return { get: () => inst.slots[i] as T, set: (v) => (inst.slots[i] = v) };
}
function update(inst: Instance) {
  if (inst.dead) return;
  inst.dirty = true;
  if (!inst.rendering) inst.schedule();
}
const changed = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
  !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));

export function useState<T>(initial: T | (() => T)) {
  const inst = current as Instance;
  const box = slot(() => ({ value: typeof initial === "function" ? (initial as () => T)() : initial }));
  const state = box.get();
  const setter = slot(() => (next: T | ((old: T) => T)) => {
    const value = typeof next === "function" ? (next as (old: T) => T)(state.value) : next;
    if (Object.is(value, state.value)) return;
    state.value = value;
    update(inst);
  }).get();
  return [state.value, setter] as const;
}
export function useReducer<S, A>(reducer: (s: S, a: A) => S, initial: S) {
  const [value, set] = useState<S>(initial);
  const box = slot(() => ({ reducer }));
  box.get().reducer = reducer;
  const dispatch = slot(() => (action: A) => set((old) => box.get().reducer(old, action))).get();
  return [value, dispatch] as const;
}
export function useRef<T>(initial: T) {
  return slot(() => ({ current: initial })).get();
}
export function useMemo<T>(make: () => T, deps: readonly unknown[]) {
  const box = slot<{ deps?: readonly unknown[]; value?: T }>(() => ({}));
  const memo = box.get();
  if (changed(memo.deps, deps)) {
    memo.value = make();
    memo.deps = deps;
  }
  return memo.value as T;
}
export function useCallback<T>(fn: T, deps: readonly unknown[]) {
  return useMemo(() => fn, deps);
}
function effect(run: () => void | (() => void), deps?: readonly unknown[]) {
  const inst = current as Instance;
  const i = inst.effectIndex++;
  const previous = inst.effects[i];
  if (!previous) inst.effects[i] = { deps, run };
  else if (changed(previous.deps, deps)) Object.assign(previous, { deps, run });
}
export const useEffect = effect;
export const useLayoutEffect = effect;
let ids = 0;
export function useId() {
  return slot(() => `:r${++ids}:`).get();
}

export type HookHandle<P, R> = {
  readonly result: R;
  readonly renders: number;
  rerender: (props: P) => void;
  /** Wait until no re-render is pending (bounded: a render loop fails the test instead of hanging it). */
  settle: (rounds?: number) => Promise<void>;
  unmount: () => void;
};

export function renderHook<P, R>(hook: (props: P) => R, initialProps: P): HookHandle<P, R> {
  let props = initialProps;
  let result: R;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const inst: Instance = {
    slots: [],
    effects: [],
    index: 0,
    effectIndex: 0,
    dirty: false,
    rendering: false,
    dead: false,
    renders: 0,
    schedule: () => {
      timer ??= setTimeout(() => {
        timer = null;
        if (inst.dirty && !inst.dead) render();
      }, 0);
    },
  };
  const render = () => {
    let guard = 0;
    if (inst.renders >= 300) {
      // A render loop (effect → setState → new deps → effect …): stop it so the test fails instead of hanging.
      inst.dead = true;
      for (const e of inst.effects) if (typeof e.cleanup === "function") e.cleanup();
      return;
    }
    do {
      if (++guard > 50) throw Error("render loop: setState during render never settles");
      inst.dirty = false;
      inst.rendering = true;
      inst.index = 0;
      inst.effectIndex = 0;
      inst.renders++;
      const previous = current;
      current = inst;
      try {
        result = hook(props);
      } finally {
        current = previous;
        inst.rendering = false;
      }
    } while (inst.dirty);
    for (const e of inst.effects) {
      if (!e.run) continue;
      const run = e.run;
      e.run = undefined;
      if (typeof e.cleanup === "function") e.cleanup();
      e.cleanup = run();
    }
    if (inst.dirty) inst.schedule();
  };
  render();
  return {
    get result() {
      return result;
    },
    get renders() {
      return inst.renders;
    },
    rerender(next) {
      props = next;
      render();
    },
    async settle(rounds = 40) {
      for (let i = 0; i < rounds; i++) {
        await new Promise((r) => setTimeout(r, 1));
        if (!inst.dirty && timer === null) return;
      }
      throw Error(`hook never settled: ${inst.renders} renders`);
    },
    unmount() {
      inst.dead = true;
      if (timer) clearTimeout(timer);
      for (const e of inst.effects) if (typeof e.cleanup === "function") e.cleanup();
    },
  };
}

let installed = false;
/** Make `import … from "react"` resolve to this module for everything imported afterwards (this process only). */
export function installHookRuntime() {
  if (installed) return;
  installed = true;
  const self = import.meta.url;
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "react") return { url: self, shortCircuit: true };
      return next(specifier, context);
    },
  });
}
