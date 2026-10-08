/**
 * Command palette rows: turns commands, provider groups, recent items and the
 * current query / scope into the sections the palette renders. No DOM; React only for types.
 */
import type { ReactNode } from "react";
import {
  limitGroups,
  rankItems,
  type AdminCommand,
  type CommandGroupState,
  type CommandSearchItem,
} from "./command-core.ts";

/** A palette row: core item + an icon and an optional own action (emptyActions like 新建客户「花莲」). */
export type CommandItem = CommandSearchItem & {
  icon?: ReactNode;
  /** Runs instead of `onSelect` (fallback actions, host-made rows). */
  run?: () => void | Promise<void>;
};

/** One async search source (客户 / 记录 / 文档 …): one group each, queried concurrently, 800ms each. */
export type CommandProvider = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Return ≤ limit items for q; respect `signal`. Only items the current user may see. */
  search: (q: string, ctx: { signal: AbortSignal; limit: number }) => Promise<readonly CommandItem[]> | readonly CommandItem[];
  /** Skip this provider below this many characters (trimmed). */
  minLength?: number;
  /** Own time budget instead of 800ms. */
  timeoutMs?: number;
};

export type PaletteRow =
  | { type: "item"; key: string; item: CommandItem; source: string; brand: boolean }
  | { type: "slow"; key: string; providerId: string }
  | { type: "error"; key: string; providerId: string; message?: string }
  | { type: "search-all"; key: string; title: string; providerId?: string }
  | { type: "skeleton"; key: string };
export type PaletteSection = { id: string; label?: string; icon?: ReactNode; rows: PaletteRow[] };
export type PaletteChip = { id: string; label: string; count: number };
export type PaletteView = {
  sections: PaletteSection[];
  chips: PaletteChip[];
  /** Nothing matched: show 「没找到「q」」 above the fallback rows. */
  empty: boolean;
};

export const COMMAND_SOURCE = "command";
const PAGE_PREFIX = "nav:";

/** A legacy command as a row item: the menu group becomes the right-side note and stays searchable. */
export function commandItem(command: AdminCommand): CommandItem {
  return {
    id: command.id,
    title: command.label,
    meta: command.group,
    keywords: [command.keywords, command.group].filter(Boolean).join(" ") || undefined,
    shortcut: command.shortcut,
    kind: command.id.startsWith(PAGE_PREFIX) ? "page" : "command",
    source: COMMAND_SOURCE,
  };
}

const itemRow = (item: CommandItem, source: string, prefix: string): PaletteRow => ({
  type: "item",
  key: `${prefix}:${source}:${item.id}`,
  item,
  source,
  brand: source !== COMMAND_SOURCE && source !== "recent",
});
const isSingleKey = (shortcut?: string) => Boolean(shortcut && !/\+/.test(shortcut) && shortcut.length <= 2);

export type BuildPaletteInput = {
  query: string;
  scope: string;
  ready: boolean;
  commands: readonly AdminCommand[];
  providers: readonly CommandProvider[];
  groups: readonly CommandGroupState<CommandItem>[];
  recent: readonly CommandItem[];
  suggested?: readonly string[];
  searchAllTitle?: string;
  emptyActions?: (q: string) => readonly CommandItem[];
};

/** Empty box: 「最近」 + 「常用」 (suggested ids, else commands with a single-key shortcut, else the first commands). */
function idleSections({ commands, recent, suggested }: BuildPaletteInput): PaletteSection[] {
  const allowed = commands.filter((c) => c.allowed !== false);
  const picked = suggested
    ? suggested.flatMap((id) => allowed.filter((c) => c.id === id))
    : allowed.filter((c) => isSingleKey(c.shortcut));
  const common = (picked.length ? picked : recent.length ? [] : allowed).slice(0, 8);
  return [
    { id: "recent", label: "最近", rows: recent.slice(0, 5).map((item) => itemRow(item, item.source ?? "recent", "recent")) },
    { id: "common", label: "常用", rows: common.map((c) => itemRow(commandItem(c), COMMAND_SOURCE, "common")) },
  ].filter((s) => s.rows.length);
}

/** Typed query: one section per provider (in order), then 「页面」 and 「命令」; ≤ 5 per group, ≤ 30 in total. */
export function buildPaletteView(input: BuildPaletteInput): PaletteView {
  const q = input.query.trim();
  if (!q) return { sections: idleSections(input), chips: [], empty: false };
  const matched = rankItems(input.commands.filter((c) => c.allowed !== false).map(commandItem), q);
  const providerGroups = input.ready
    ? input.providers.map((p) => {
        const state = input.groups.find((g) => g.id === p.id);
        return { id: p.id, label: p.label, icon: p.icon, status: state?.status ?? "loading", error: state?.error, items: rankItems(state?.items ?? [], q, { keepUnmatched: true }) };
      })
    : [];
  const local = [
    { id: "pages", label: "页面", icon: undefined, status: "done" as const, error: undefined, items: matched.filter((i) => i.kind === "page") },
    { id: "commands", label: "命令", icon: undefined, status: "done" as const, error: undefined, items: matched.filter((i) => i.kind !== "page") },
  ];
  const limited = limitGroups([...providerGroups, ...local]);
  const chips: PaletteChip[] = limited.filter((g) => g.items.length).map((g) => ({ id: g.id, label: g.label, count: g.items.length }));
  const total = chips.reduce((sum, c) => sum + c.count, 0);
  const pending = limited.some((g) => g.status === "loading" || g.status === "slow");
  if (!total && !pending) {
    const rows: PaletteRow[] = [];
    if (input.searchAllTitle) rows.push({ type: "search-all", key: "fallback:search-all", title: input.searchAllTitle });
    for (const item of input.emptyActions?.(q) ?? []) rows.push(itemRow(item, "empty", "fallback"));
    const errors = limited.filter((g) => g.status === "error").map((g): PaletteRow => ({ type: "error", key: `error:${g.id}`, providerId: g.id, message: g.error }));
    return { sections: [{ id: "fallback", rows: [...errors, ...rows] }], chips: [], empty: true };
  }
  const scope = input.scope !== "all" && chips.some((c) => c.id === input.scope) ? input.scope : "all";
  const sections = limited
    .filter((g) => scope === "all" || g.id === scope)
    .map((g): PaletteSection => {
      const source = g.id === "pages" || g.id === "commands" ? COMMAND_SOURCE : g.id;
      const rows = g.items.map((item) => itemRow(item, source, g.id));
      if (g.status === "loading" && !rows.length) rows.push({ type: "skeleton", key: `skeleton:${g.id}` });
      if (g.status === "slow") rows.push({ type: "slow", key: `slow:${g.id}`, providerId: g.id });
      if (g.status === "error") rows.push({ type: "error", key: `error:${g.id}`, providerId: g.id, message: g.error });
      return { id: g.id, label: g.label, icon: g.icon, rows };
    })
    .filter((s) => s.rows.length);
  return { sections, chips: chips.length > 1 ? [{ id: "all", label: "全部", count: total }, ...chips] : [], empty: false };
}

/** Rows that can be selected with ↑↓ / Enter (skeletons cannot). */
export function selectableRows(view: PaletteView): PaletteRow[] {
  return view.sections.flatMap((s) => s.rows).filter((r) => r.type !== "skeleton");
}
