"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { shortcutApplies, shortcutOf, type AdminCommand } from "./command-core.ts";
import { useAdminTheme } from "./theme.tsx";

export type AdminShortcutOptions = {
  /**
   * Listen on `window` instead of the AdminProvider root, so shortcuts also work on a freshly opened page where
   * nothing has focus yet (the key goes to `<body>`, outside the Provider). Plain-key shortcuts (`g`, `?`) are still
   * ignored while typing in an input / textarea / select / contenteditable; modifier shortcuts (`mod+k`) work
   * there too. Keys inside an open dialog are always left to the dialog. Only one Provider on a page should use it.
   */
  global?: boolean;
};

/**
 * Default of CommandPalette `globalShortcut` for everything under it; AdminShell `globalShortcut` provides it, so a
 * palette in `headerActions` follows the shell.
 */
export const GlobalShortcutContext = /* @__PURE__ */ createContext<boolean | undefined>(undefined);

/** The page default set by AdminShell `globalShortcut` (undefined = not set). */
export function useGlobalShortcutDefault(): boolean | undefined {
  return useContext(GlobalShortcutContext);
}

/** Shortcuts are scoped to the focused AdminProvider and ignored inside editable fields and dialogs (see `global`). */
export function useAdminShortcuts(
  commands: readonly AdminCommand[],
  enabled = true,
  options: AdminShortcutOptions = {},
) {
  const { portal } = useAdminTheme();
  const latest = useRef(commands);
  latest.current = commands;
  const [error, setError] = useState("");
  const global = Boolean(options.global);
  useEffect(() => {
    if (!enabled || !portal) return;
    const root = portal.parentElement;
    const listener = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!shortcutApplies(e, target, Boolean(root?.contains(target)), global)) return;
      const key = shortcutOf(e);
      const command = latest.current.find((c) => c.allowed !== false && c.shortcut?.toLowerCase() === key);
      if (!command) return;
      e.preventDefault();
      Promise.resolve()
        .then(command.run)
        .catch((err) => setError(String(err)));
    };
    const host: EventTarget | null | undefined = global ? window : root;
    host?.addEventListener("keydown", listener as EventListener);
    return () => host?.removeEventListener("keydown", listener as EventListener);
  }, [portal, enabled, global]);
  return { error };
}
