/** Pure command-palette logic: no React / DOM, unit-tested in test/command-core.test.ts. */
export type AdminCommand = {
  id: string;
  label: string;
  keywords?: string;
  /** Small note shown beside the result (e.g. the menu group); also searchable. */
  group?: string;
  shortcut?: string;
  allowed?: boolean;
  run: () => void | Promise<void>;
};

/** Lower-cased words of a query; blank input yields no words (= everything matches). */
export function queryWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Every space-separated word must appear somewhere in label + keywords + group (case-insensitive),
 * in any order: 「用户 停用」 finds 「停用用户」, and 「管理 资产」 finds 「资产管理」 under group 「资产」.
 */
export function commandMatches(
  command: Pick<AdminCommand, "label" | "keywords" | "group">,
  query: string,
): boolean {
  const haystack = `${command.label} ${command.keywords ?? ""} ${command.group ?? ""}`.toLowerCase();
  return queryWords(query).every((word) => haystack.includes(word));
}

/** Navigation entries as commands; NavItem from AdminShell fits structurally. */
export type NavCommandSource = {
  id: string;
  title: string;
  group?: string;
  keywords?: string;
};

/**
 * Turn AdminShell navigation into palette commands so every admin gets top-right search for free:
 * label = title, group shown as a note and searchable, optional NavItem.keywords for synonyms.
 * Command ids are `nav:<id>`; `extra` commands (host actions such as 改密码) are appended as-is.
 */
export function navCommands(
  navigation: readonly NavCommandSource[],
  onNavigate: (id: string) => void,
  extra: readonly AdminCommand[] = [],
): AdminCommand[] {
  return [
    ...navigation.map((item) => ({
      id: `nav:${item.id}`,
      label: item.title,
      keywords: [item.group, item.keywords].filter(Boolean).join(" ") || undefined,
      group: item.group,
      run: () => onNavigate(item.id),
    })),
    ...extra,
  ];
}

// ---------------------------------------------------------------- 命令面板搜索（Linear 式）

/** A search result row. React-free here; the palette adds `icon` / `run` (see command-palette.tsx). */
export type CommandSearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  /** Right-side note: 「阶段 · 区域 · 负责人」 or a path. */
  meta?: string;
  kind?: string;
  /** Extra searchable words (synonyms, old names); not displayed. */
  keywords?: string;
  /** Single key (「N」) or chord (「Mod+K」) shown as keycaps. */
  shortcut?: string;
  href?: string;
  /** Provider relevance 0–1, blended into the local score. */
  score?: number;
  /** Who produced the item (provider id, 「command」 …); the palette sets it on recent items. */
  source?: string;
};

/** One search provider (客户 / 记录 / 文档 …), structurally typed so core stays React-free. */
export type CommandSearchSource<T extends CommandSearchItem = CommandSearchItem> = {
  id: string;
  label: string;
  search: (q: string, ctx: { signal: AbortSignal; limit: number }) => Promise<readonly T[]> | readonly T[];
  /** Skip this provider below this many characters (trimmed). */
  minLength?: number;
  /** Own time budget; default the runProviders timeout (800ms). */
  timeoutMs?: number;
};

export type CommandGroupStatus = "loading" | "done" | "slow" | "error";
/** One provider's group while a query runs: slow = past its budget and still running. */
export type CommandGroupState<T extends CommandSearchItem = CommandSearchItem> = {
  id: string;
  label: string;
  status: CommandGroupStatus;
  items: readonly T[];
  error?: string;
};

/** Kana, CJK ideographs (+ ext. A, compatibility) and Hangul. */
const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/;
/** Platform search threshold (platform.md §25): trimmed query has ≥ 1 CJK character or ≥ 2 characters otherwise. */
export function searchReady(q: string): boolean {
  const text = q.trim();
  return CJK.test(text) || text.length >= 2;
}

const WORD_START = /[\s\-_/.·,，、（(「『:：]/;
/** How well one lower-cased word hits: 4 title prefix · 3 word start · 2 inside title · 1 subtitle / keywords · 0 miss. */
function wordScore(word: string, title: string, rest: string): number {
  const at = title.indexOf(word);
  if (at === 0) return 4;
  if (at > 0) {
    for (let i = at; i >= 0; i = title.indexOf(word, i + 1)) if (WORD_START.test(title[i - 1] ?? "")) return 3;
    return 2;
  }
  return rest.includes(word) ? 1 : 0;
}

/**
 * Relevance 0–1, or -1 when some query word is missing from title / subtitle / keywords (case-insensitive,
 * any order). Title prefix > word start > inside title > subtitle / keywords; a provider `score` blends in 30%.
 * A blank query matches everything with the provider score (or 0).
 */
export function scoreItem(item: Pick<CommandSearchItem, "title" | "subtitle" | "keywords" | "score">, q: string): number {
  const words = queryWords(q);
  const provider = item.score === undefined ? undefined : Math.min(1, Math.max(0, item.score));
  if (!words.length) return provider ?? 0;
  const title = item.title.toLowerCase();
  const rest = `${item.subtitle ?? ""} ${item.keywords ?? ""}`.toLowerCase();
  let total = 0;
  for (const word of words) {
    const s = wordScore(word, title, rest);
    if (!s) return -1;
    total += s;
  }
  const text = total / (words.length * 4);
  return provider === undefined ? text : text * 0.7 + provider * 0.3;
}

/**
 * Matching items, best first; equal scores keep the input order. `keepUnmatched`: provider results the
 * server matched on fields not shown here (a normalised phone number …) stay, ranked by their provider score only.
 */
export function rankItems<T extends Pick<CommandSearchItem, "title" | "subtitle" | "keywords" | "score">>(
  items: readonly T[],
  q: string,
  { keepUnmatched = false }: { keepUnmatched?: boolean } = {},
): T[] {
  return items
    .map((item, index) => {
      const score = scoreItem(item, q);
      return { item, index, score: score < 0 && keepUnmatched ? (item.score ?? 0) * 0.3 : score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item);
}

/** Where the query words occur in `text` (case-insensitive), as sorted, merged `[start, end)` ranges. */
export function highlightRanges(text: string, q: string): [number, number][] {
  const lower = text.toLowerCase();
  const found: [number, number][] = [];
  for (const word of queryWords(q))
    for (let i = lower.indexOf(word); i >= 0; i = lower.indexOf(word, i + 1)) found.push([i, i + word.length]);
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const [start, end] of found) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Cap every group (default 5) and the whole list (default 30) in order; the groups themselves are kept. */
export function limitGroups<G extends { items: readonly unknown[] }>(
  groups: readonly G[],
  { perGroup = 5, total = 30 }: { perGroup?: number; total?: number } = {},
): G[] {
  let left = total;
  return groups.map((group) => {
    const items = group.items.slice(0, Math.max(0, Math.min(perGroup, left)));
    left -= items.length;
    return { ...group, items };
  });
}

/** Most-recent-first list without duplicates (by id), at most `max` long. */
export function pushRecent<T extends { id: string }>(list: readonly T[], item: T, max = 8): T[] {
  return [item, ...list.filter((x) => x.id !== item.id)].slice(0, max);
}

export type RunProvidersOptions<T extends CommandSearchItem = CommandSearchItem> = {
  /** Budget per provider before it is reported 「slow」 (it keeps running). Default 800ms. */
  timeoutMs?: number;
  /** Items asked from each provider (and kept). Default 5. */
  limit?: number;
  /** Abort = stop everything: providers get aborted, no more onUpdate. */
  signal?: AbortSignal;
  /** Every state change, with a fresh array of all groups. */
  onUpdate?: (groups: CommandGroupState<T>[]) => void;
  /** Injectable timers (tests). */
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Ask every provider concurrently, each with its own AbortSignal. Each becomes a group:
 * loading → done | error, or loading → slow (past its budget, still running) → done | error.
 * A failing or slow provider never holds up the others. Resolves with the final states once
 * all settled, or right away with the current states when `signal` aborts.
 */
export function runProviders<T extends CommandSearchItem>(
  providers: readonly CommandSearchSource<T>[],
  q: string,
  { timeoutMs = 800, limit = 5, signal, onUpdate, timers }: RunProvidersOptions<T> = {},
): Promise<CommandGroupState<T>[]> {
  const set = timers?.set ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clear = timers?.clear ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const text = q.trim();
  const active = providers.filter((p) => text.length >= (p.minLength ?? 0));
  const states: CommandGroupState<T>[] = active.map((p) => ({ id: p.id, label: p.label, status: "loading", items: [] }));
  if (!active.length || signal?.aborted) return Promise.resolve(states);
  const controllers = active.map(() => new AbortController());
  const handles: unknown[] = [];
  let pending = active.length;
  let finished = false;
  return new Promise((resolve) => {
    const finish = () => {
      if (finished) return;
      finished = true;
      handles.forEach(clear);
      signal?.removeEventListener("abort", stop);
      resolve(states.slice());
    };
    function stop() {
      controllers.forEach((c) => c.abort());
      finish();
    }
    signal?.addEventListener("abort", stop, { once: true });
    const update = (index: number, next: CommandGroupState<T>) => {
      if (finished) return;
      states[index] = next;
      onUpdate?.(states.slice());
    };
    active.forEach((provider, index) => {
      const ctrl = controllers[index] ?? new AbortController();
      const base = { id: provider.id, label: provider.label };
      handles.push(
        set(() => {
          const now = states[index];
          if (now?.status === "loading") update(index, { ...now, status: "slow" });
        }, provider.timeoutMs ?? timeoutMs),
      );
      Promise.resolve()
        .then(() => provider.search(text, { signal: ctrl.signal, limit }))
        .then(
          (items) => update(index, { ...base, status: "done", items: items.slice(0, limit) }),
          (error: unknown) => update(index, { ...base, status: "error", items: [], error: errorText(error) }),
        )
        .finally(() => {
          pending -= 1;
          if (!pending) finish();
        });
    });
  });
}

// ---------------------------------------------------------------- shortcuts (useAdminShortcuts)

/** What shortcutApplies needs of an event target (an Element in the browser). */
export type ShortcutTarget = { closest(selector: string): unknown };

const EDITABLE = 'input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]';

/** Key text of an event as AdminCommand.shortcut writes it: `mod+k`, `g`, `?`. */
export function shortcutOf(e: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "key">): string {
  return `${e.ctrlKey || e.metaKey ? "mod+" : ""}${e.key.toLowerCase()}`;
}

/**
 * Should this keydown run a shortcut? Pure, for tests. Scoped (default): only keys whose target is inside the root
 * and not in an editable field or dialog. Global: any target; in editable fields only modifier shortcuts; never
 * inside a dialog (the palette's own dialog handles its keys).
 */
export function shortcutApplies(
  e: Pick<KeyboardEvent, "defaultPrevented" | "isComposing" | "repeat" | "ctrlKey" | "metaKey" | "altKey">,
  target: ShortcutTarget | null,
  /** The target is inside this AdminProvider's root (only the scoped mode needs it). */
  insideRoot: boolean,
  global: boolean,
): boolean {
  if (e.defaultPrevented || e.isComposing || e.repeat || e.altKey) return false;
  if (target?.closest('[role="dialog"],[role="alertdialog"]')) return false;
  const editable = Boolean(target?.closest(EDITABLE));
  if (!global) return insideRoot && !editable;
  return !editable || e.ctrlKey || e.metaKey;
}

