import { useSyncExternalStore } from "react";
import { isCrmPage, type CrmPage } from "./content";

/**
 * State shared by the homepage shell and its lazily loaded islands (separate bundles, separate React roots).
 * The instance lives on `window`, so every bundle that includes this file talks to the same store.
 * Mode and palette use the docs site's preference key, so the choice carries over to the docs pages.
 */
export type HomeMode = "light" | "dark";
export type HomeState = { mode: HomeMode; palette: string; crm: CrmPage; reduced: boolean };
type Store = { get: () => HomeState; set: (patch: Partial<HomeState>) => void; subscribe: (fn: () => void) => () => void };

const KEY = "aui-site:prefs";

function readPrefs(): Pick<HomeState, "mode" | "palette"> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof raw === "object" && raw !== null) {
      const r = raw as Record<string, unknown>;
      return { mode: r.mode === "dark" ? "dark" : "light", palette: typeof r.palette === "string" ? r.palette : "forest" };
    }
  } catch {
    /* sandboxed frames have no storage */
  }
  return { mode: "light", palette: "forest" };
}

function writePrefs(state: HomeState) {
  try {
    const old: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const base = typeof old === "object" && old !== null ? old : { lang: "zh" };
    localStorage.setItem(KEY, JSON.stringify({ ...base, mode: state.mode, palette: state.palette }));
  } catch {
    /* no storage */
  }
}

function createStore(): Store {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const asked = new URLSearchParams(window.location.search);
  const prefs = readPrefs();
  const askedMode = asked.get("mode");
  let state: HomeState = {
    mode: askedMode === "dark" || askedMode === "light" ? askedMode : prefs.mode,
    palette: asked.get("palette") ?? prefs.palette,
    crm: "grid",
    reduced: media.matches,
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<HomeState>) => {
    const next = { ...state, ...patch };
    if (!isCrmPage(next.crm)) next.crm = "grid";
    if (next.mode !== state.mode || next.palette !== state.palette) writePrefs(next);
    state = next;
    listeners.forEach((fn) => fn());
  };
  media.addEventListener("change", () => set({ reduced: media.matches }));
  return {
    get: () => state,
    set,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

type HomeWindow = Window & { __auiHomeStore?: Store };

export function homeStore(): Store {
  const w = window as HomeWindow;
  w.__auiHomeStore ??= createStore();
  return w.__auiHomeStore;
}

export function useHome(): HomeState & { set: Store["set"] } {
  const store = homeStore();
  const state = useSyncExternalStore(store.subscribe, store.get);
  return { ...state, set: store.set };
}
