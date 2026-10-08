/**
 * Homepage islands: the heavy live demos (grid, views, dashboard builder, AI demo …) load when their section comes
 * near the viewport. Dev and the web build: a dynamic import (an ES module chunk; shared code such as the library
 * comes in its own cached chunks). Sandbox build: a separate classic bundle (`assets/home-<name>.js` + `.css`) loaded
 * by a plain <script> — classic scripts with relative URLs also load in sandboxed review frames (opaque origin, no
 * CORS), where module scripts and dynamic imports would not; those bundles share React with the shell through
 * globals (see main.tsx / vite.config.ts). Either way each island registers itself (registerIsland) and renders into
 * its own root; mode / palette come from the shared store (store.ts).
 */
import { useEffect, useState, type ComponentType } from "react";

declare const __HOME_BUILD__: string;
declare const __SITE_ESM__: boolean;

export const ISLANDS = ["hero", "crm", "views", "builder", "ai", "east"] as const;
export type IslandName = (typeof ISLANDS)[number];
/**
 * `mount` renders a part into its own root (used by the shell's IslandSlot); `parts` hands out components another
 * island renders inside its own tree (React is shared, and admin-ui's contexts are keyed by Symbol.for, so a
 * component from one island bundle works inside another island's AdminProvider).
 */
export type IslandModule = { mount: (el: HTMLElement, part: string) => () => void; parts?: Record<string, ComponentType> };

type Registry = { mods: Partial<Record<IslandName, IslandModule>>; waiting: Partial<Record<IslandName, (m: IslandModule) => void>> };
type IslandWindow = Window & { __auiHomeIslands?: Registry };

function registry(): Registry {
  const w = window as IslandWindow;
  w.__auiHomeIslands ??= { mods: {}, waiting: {} };
  return w.__auiHomeIslands;
}

/** Called by each island bundle when it has been evaluated. */
export function registerIsland(name: IslandName, mod: IslandModule) {
  const reg = registry();
  reg.mods[name] = mod;
  reg.waiting[name]?.(mod);
}

const loading = new Map<IslandName, Promise<IslandModule>>();

function addCss(href: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // the demo still works unstyled-ish; never block on CSS
    document.head.appendChild(link);
  });
}

/** Dev / web build: the island modules as lazy chunks. The sandbox build drops this (dead branch, see loadIsland). */
const IMPORTS: Record<IslandName, () => Promise<unknown>> = {
  hero: () => import("./islands/hero"),
  crm: () => import("./islands/crm"),
  views: () => import("./islands/views"),
  builder: () => import("./islands/builder"),
  ai: () => import("./islands/ai"),
  east: () => import("./islands/east"),
};

async function importIsland(name: IslandName): Promise<IslandModule> {
  await IMPORTS[name]();
  const mod = registry().mods[name];
  if (!mod) throw new Error(`演示没有注册：${name}`);
  return mod;
}

function scriptIsland(name: IslandName): Promise<IslandModule> {
  return new Promise<IslandModule>((resolve, reject) => {
    const css = addCss(`assets/home-${name}.css?v=${__HOME_BUILD__}`);
    const script = document.createElement("script");
    script.src = `assets/home-${name}.js?v=${__HOME_BUILD__}`;
    registry().waiting[name] = (mod) => void css.then(() => resolve(mod));
    script.onerror = () => reject(new Error(`演示加载失败：${name}`));
    script.onload = () => {
      const mod = registry().mods[name];
      if (mod) void css.then(() => resolve(mod));
      else reject(new Error(`演示没有注册：${name}`));
    };
    document.body.appendChild(script);
  });
}

export function loadIsland(name: IslandName): Promise<IslandModule> {
  const hit = registry().mods[name];
  if (hit) return Promise.resolve(hit);
  const pending = loading.get(name);
  if (pending) return pending;
  const made = (__SITE_ESM__ ? importIsland(name) : scriptIsland(name)).catch((e: unknown) => {
    loading.delete(name);
    throw e;
  });
  loading.set(name, made);
  return made;
}

/** A component exported by another island, loaded on first use: `undefined` while loading, `null` if it failed. */
export function useIslandPart(name: IslandName, part: string, enabled = true): ComponentType | null | undefined {
  const [found, setFound] = useState<{ part: string; view: ComponentType | null } | null>(() => {
    const view = registry().mods[name]?.parts?.[part];
    return view ? { part, view } : null;
  });
  useEffect(() => {
    if (!enabled || found?.part === part) return;
    let live = true;
    loadIsland(name).then(
      (mod) => live && setFound({ part, view: mod.parts?.[part] ?? null }),
      () => live && setFound({ part, view: null }),
    );
    return () => {
      live = false;
    };
  }, [name, part, enabled, found?.part]);
  return found?.part === part ? found.view : undefined;
}
