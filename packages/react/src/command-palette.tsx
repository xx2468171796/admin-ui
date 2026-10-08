"use client";
/**
 * Command palette (Ctrl/⌘ K): a 640px panel 14vh from the top whose header is the
 * input. Empty box → 「最近」 + 「常用」; typing → one group per provider (queried concurrently,
 * 800ms each) plus 「页面」 / 「命令」 from `commands`. Logic: command-core.ts + command-palette-model.ts.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { searchReady, type AdminCommand } from "./command-core.ts";
import { useProviderSearch, useRecentItems } from "./command-palette-hooks.ts";
import {
  buildPaletteView,
  COMMAND_SOURCE,
  selectableRows,
  type CommandItem,
  type CommandProvider,
  type PaletteRow,
} from "./command-palette-model.ts";
import { CommandTrigger, NoMatch, PaletteFooter, PaletteRowView, ScopeChips } from "./command-palette-parts.tsx";
import { useAdminTheme } from "./theme.tsx";
import { Kbd } from "./tooltip.tsx";
import { useAdminShortcuts, useGlobalShortcutDefault } from "./admin-shortcuts.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/command-palette.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/command-palette.css";

export type { CommandItem, CommandProvider } from "./command-palette-model.ts";

export type CommandPaletteProps = {
  /** Legacy + local commands (navCommands(...) + host actions): grouped 「页面」 (nav:*) and 「命令」. */
  commands?: readonly AdminCommand[];
  /** Async search providers (客户 / 记录 / 文档 …), one group each, queried concurrently, 800ms each. */
  providers?: readonly CommandProvider[];
  /** Open a provider result (navigate to item.href, etc.). Commands run their own `run`. */
  onSelect?: (item: CommandItem, providerId: string) => void | Promise<void>;
  /** Enter on a 「较慢，回车看全部」 / 「在全部…里搜」 row: open the full search page. */
  onSearchAll?: (q: string, providerId?: string) => void;
  /** Fallback rows when nothing matched: e.g. 新建客户「花莲」. */
  emptyActions?: (q: string) => readonly CommandItem[];
  /** Recent items: controlled list, or remembered in localStorage under this key (default in-memory). */
  recent?: readonly CommandItem[];
  recentKey?: string;
  /** Common commands shown when the box is empty (ids of commands, default: commands with a shortcut). */
  suggested?: readonly string[];
  /** Ctrl/⌘K binding (default true). */
  enabled?: boolean;
  /**
   * Listen for Ctrl/⌘K (and the commands' shortcuts) on the whole window, not only while focus is inside the
   * AdminProvider: works on a freshly opened page before anything was clicked. Plain-key command shortcuts stay off
   * while typing in fields; Ctrl/⌘K works there too. Default: AdminShell `globalShortcut`, else false. One palette
   * per page.
   */
  globalShortcut?: boolean;
  /** 「搜索客户、记录、文档，或输入命令…」 */
  placeholder?: string;
  /** Render the topbar trigger (search-box look, 240 wide; magnifier only on phones). Default true. */
  trigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const NO_COMMANDS: readonly AdminCommand[] = [];
const NO_PROVIDERS: readonly CommandProvider[] = [];

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function CommandPalette({
  commands = NO_COMMANDS,
  providers = NO_PROVIDERS,
  onSelect,
  onSearchAll,
  emptyActions,
  recent,
  recentKey,
  suggested,
  enabled = true,
  globalShortcut,
  placeholder = "搜索客户、记录、文档，或输入命令…",
  trigger = true,
  open: openProp,
  onOpenChange,
}: CommandPaletteProps) {
  const { portal } = useAdminTheme();
  const shellGlobal = useGlobalShortcutDefault();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const ids = useId();
  const listId = `${ids}-list`;
  const allowed = commands.filter((c) => c.allowed !== false);
  const { list: recentList, remember } = useRecentItems(recent, recentKey);
  const q = query.trim();
  const ready = searchReady(q);
  const { groups, retry } = useProviderSearch(open, q, ready, providers);

  const setOpen = (next: boolean) => {
    if (next && !open) {
      const focused = document.activeElement;
      opener.current = focused instanceof HTMLElement && focused !== document.body ? focused : null;
      setQuery("");
      setScope("all");
      setActive(0);
      setError("");
    }
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  const shortcuts = useAdminShortcuts(
    [{ id: "palette", label: "打开命令面板", shortcut: "mod+k", run: () => setOpen(true) }, ...allowed],
    enabled,
    { global: globalShortcut ?? shellGlobal ?? false },
  );

  const searchAllTitle = onSearchAll ? `在全部${providers.length === 1 ? (providers[0]?.label ?? "") : "内容"}里搜「${q}」` : undefined;
  const view = useMemo(
    () => buildPaletteView({ query, scope, ready, commands, providers, groups, recent: recentList, suggested, searchAllTitle, emptyActions }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, scope, ready, commands, providers, groups, recentList, suggested, searchAllTitle],
  );
  const rows = selectableRows(view);
  const current = rows.length ? Math.min(active, rows.length - 1) : -1;
  const rowId = (index: number) => `${ids}-row-${index}`;
  useEffect(() => {
    if (current >= 0) document.getElementById(rowId(current))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const providerLabel = (id?: string) => providers.find((p) => p.id === id)?.label ?? "";
  const providerIcon = (id: string): ReactNode => providers.find((p) => p.id === id)?.icon ?? null;

  const execute = async (action: () => void | Promise<void>, recentItem?: CommandItem) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (recentItem) remember(recentItem);
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const pick = (row: PaletteRow | undefined) => {
    if (!row || busy) return;
    if (row.type === "error") return retry(row.providerId);
    if (row.type === "slow" || row.type === "search-all") {
      if (!onSearchAll) return;
      onSearchAll(q, row.providerId);
      return setOpen(false);
    }
    if (row.type !== "item") return;
    const { item } = row;
    const source = item.source ?? row.source;
    const { icon: _icon, run: _run, ...plain } = item;
    if (source === COMMAND_SOURCE) {
      const command = allowed.find((c) => c.id === item.id);
      if (command) void execute(command.run, { ...plain, source });
      return;
    }
    if (item.run) return void execute(item.run);
    void execute(() => onSelect?.(item, source), source === "empty" ? undefined : { ...plain, source });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length) setActive((current + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(rows[current]);
    } else if (e.key === "Tab" && view.chips.length) {
      e.preventDefault();
      const order = view.chips.map((c) => c.id);
      const at = Math.max(0, order.indexOf(scope));
      setScope(order[(at + (e.shiftKey ? -1 : 1) + order.length) % order.length] ?? "all");
      setActive(0);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const total = rows.filter((r) => r.type === "item").length;
  let index = -1;
  return (
    <>
      {trigger && <CommandTrigger ref={triggerRef} open={open} onOpen={() => setOpen(true)} />}
      {shortcuts.error && <span role="alert">{shortcuts.error}</span>}
      {portal && (
        <RadixDialog.Root open={open} onOpenChange={(next) => !next && !busy && setOpen(false)}>
          <RadixDialog.Portal container={portal}>
            <RadixDialog.Overlay className="aui-cmdk-overlay" />
            <RadixDialog.Content
              className="aui-cmdk"
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                inputRef.current?.focus();
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                const back = opener.current?.isConnected ? opener.current : triggerRef.current;
                back?.focus({ preventScroll: true });
              }}
              onEscapeKeyDown={(e) => {
                // Esc closes at once, typed or not (Linear / Raycast; the footer says 「Esc 关闭」). Only a running command keeps it open.
                if (busy) e.preventDefault();
              }}
            >
              <RadixDialog.Title className="aui-sr-only">搜索与命令</RadixDialog.Title>
              <div className="aui-cmdk-head">
                <Search aria-hidden="true" size={18} />
                <input
                  ref={inputRef}
                  className="aui-cmdk-input"
                  role="combobox"
                  aria-label="搜索与命令"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={current >= 0 ? rowId(current) : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder={placeholder}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setScope("all");
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                />
                <Kbd keys="Esc" size="sm" className="aui-cmdk-esc" />
                <button type="button" className="aui-cmdk-cancel" onClick={() => !busy && setOpen(false)}>
                  取消
                </button>
              </div>
              <ScopeChips
                chips={view.chips}
                scope={scope}
                onScope={(id) => {
                  setScope(id);
                  setActive(0);
                }}
              />
              <div className="aui-cmdk-body">
                {view.empty && <NoMatch q={q} hint={!ready && providers.length > 0} />}
                <div className="aui-cmdk-list" id={listId} role="listbox" aria-label="搜索结果" aria-busy={busy || undefined}>
                  {view.sections.map((section) => (
                    <div key={section.id} role="group" aria-labelledby={section.label ? `${ids}-g-${section.id}` : undefined} aria-label={section.label ? undefined : "其它做法"}>
                      {section.label && (
                        <div className="aui-cmdk-group" id={`${ids}-g-${section.id}`} role="presentation">
                          {section.label}
                        </div>
                      )}
                      {section.rows.map((row) => {
                        const at = row.type === "skeleton" ? -1 : (index += 1);
                        return (
                          <PaletteRowView
                            key={row.key}
                            row={row}
                            id={at >= 0 ? rowId(at) : `${ids}-skel-${section.id}`}
                            active={at === current}
                            query={q}
                            busy={busy}
                            providerLabel={providerLabel}
                            providerIcon={providerIcon}
                            onHover={() => at >= 0 && setActive(at)}
                            onPick={() => pick(row)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <span className="aui-sr-only" aria-live="polite">
                  {q ? (view.empty ? `没找到「${q}」` : `${total} 条结果`) : ""}
                </span>
              </div>
              {error && (
                <p role="alert" className="aui-cmdk-error">
                  {error}
                </p>
              )}
              <PaletteFooter scopes={view.chips.length > 0} />
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
      )}
    </>
  );
}
