"use client";
/** Command palette state hooks: provider search with debounce / abort / retry, and recent items. */
import { useEffect, useRef, useState } from "react";
import { pushRecent, runProviders, type CommandGroupState } from "./command-core.ts";
import type { CommandItem, CommandProvider } from "./command-palette-model.ts";

const DEBOUNCE_MS = 120;

/**
 * Ask the providers for `q` while open: debounce 120ms, abort the previous query, keep the old rows
 * (marked loading) until the new ones arrive. `retry(id)` asks one provider again.
 */
export function useProviderSearch(open: boolean, q: string, ready: boolean, providers: readonly CommandProvider[]) {
  const [groups, setGroups] = useState<CommandGroupState<CommandItem>[]>([]);
  const latest = useRef(providers);
  latest.current = providers;
  const retryCtrl = useRef<AbortController | null>(null);
  const providerKey = providers.map((p) => p.id).join("\n");
  useEffect(() => {
    retryCtrl.current?.abort();
    if (!open || !ready || !latest.current.length) {
      setGroups([]);
      return;
    }
    setGroups((prev) =>
      latest.current.map((p) => ({ id: p.id, label: p.label, status: "loading", items: prev.find((g) => g.id === p.id)?.items ?? [] })),
    );
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void runProviders(latest.current, q, { signal: ctrl.signal, onUpdate: setGroups });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, q, ready, providerKey]);
  const retry = (providerId: string) => {
    const provider = latest.current.find((p) => p.id === providerId);
    if (!provider) return;
    retryCtrl.current?.abort();
    const ctrl = new AbortController();
    retryCtrl.current = ctrl;
    const patch = (next?: CommandGroupState<CommandItem>) => next && setGroups((prev) => prev.map((g) => (g.id === providerId ? next : g)));
    patch({ id: provider.id, label: provider.label, status: "loading", items: [] });
    void runProviders([provider], q, { signal: ctrl.signal, onUpdate: (states) => patch(states[0]) });
  };
  return { groups, retry };
}

function readRecent(key?: string): CommandItem[] {
  if (!key || typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CommandItem => typeof x === "object" && x !== null && typeof (x as CommandItem).id === "string" && typeof (x as CommandItem).title === "string",
    );
  } catch {
    return [];
  }
}
function writeRecent(key: string | undefined, list: readonly CommandItem[]) {
  if (!key || typeof localStorage === "undefined") return;
  // Icons and actions are not data: they come back from the provider / command on display.
  const plain = list.map(({ icon: _icon, run: _run, ...rest }) => rest);
  try {
    localStorage.setItem(key, JSON.stringify(plain));
  } catch {
    /* storage full / private mode: recent stays in memory */
  }
}

/** Recent items: the controlled `recent` list as is, else in memory (+ localStorage under `recentKey`). */
export function useRecentItems(recent: readonly CommandItem[] | undefined, recentKey: string | undefined) {
  const [memory, setMemory] = useState<CommandItem[]>(() => readRecent(recentKey));
  const remember = (item: CommandItem) => {
    if (recent) return;
    setMemory((list) => {
      const next = pushRecent(list, item);
      writeRecent(recentKey, next);
      return next;
    });
  };
  return { list: recent ?? memory, remember };
}
