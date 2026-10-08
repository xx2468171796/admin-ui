/**
 * Pure rules of the rail workspace shell (bt/templates L1, T15): the tree sidebar's search and folder
 * state, keyboard order of the visible rows, and which modules a phone's bottom bar shows. No React;
 * unit-tested in test/rail-shell-core.test.ts.
 */

/** A row of the tree sidebar: a table, dashboard, form, automation … */
export type NavTreeLeaf = {
  id: string;
  label: string;
  /** Grey number on the right (「1,284」「6 条」). */
  count?: string | number;
  /** Extra search words (old names, pinyin); not displayed. */
  keywords?: string;
  disabled?: boolean;
};
/** A folder of rows (one level: folders hold rows, not folders). */
export type NavTreeFolderShape<L extends NavTreeLeaf = NavTreeLeaf> = {
  id: string;
  label: string;
  children: readonly L[];
  /** Open on first render (default true). */
  defaultOpen?: boolean;
};
export type NavTreeShape<L extends NavTreeLeaf = NavTreeLeaf> = L | NavTreeFolderShape<L>;

export const isNavFolder = <L extends NavTreeLeaf>(node: NavTreeShape<L>): node is NavTreeFolderShape<L> =>
  Array.isArray((node as { children?: unknown }).children);

const norm = (text: string) => text.trim().toLocaleLowerCase("zh-CN");
const leafMatches = (leaf: NavTreeLeaf, needle: string) => norm(`${leaf.label} ${leaf.keywords ?? ""}`).includes(needle);

/**
 * The tree for a search: rows whose label / keywords contain the query; a folder stays when its own
 * name matches (all its rows) or any row matches (only those). An empty query returns the tree as is.
 */
export function filterNavTree<L extends NavTreeLeaf>(nodes: readonly NavTreeShape<L>[], query: string): NavTreeShape<L>[] {
  const needle = norm(query);
  if (!needle) return [...nodes];
  const out: NavTreeShape<L>[] = [];
  for (const node of nodes) {
    if (!isNavFolder(node)) {
      if (leafMatches(node, needle)) out.push(node);
      continue;
    }
    if (norm(node.label).includes(needle)) {
      out.push(node);
      continue;
    }
    const children = node.children.filter((leaf) => leafMatches(leaf, needle));
    if (children.length) out.push({ ...node, children });
  }
  return out;
}

/** Folders open on first render (`defaultOpen` absent = open). */
export function initialOpenFolders(nodes: readonly NavTreeShape[]): Set<string> {
  return new Set(nodes.filter(isNavFolder).filter((folder) => folder.defaultOpen !== false).map((folder) => folder.id));
}

/** The folder that holds a row (to open it when that row becomes current). */
export function folderOf(nodes: readonly NavTreeShape[], id: string): string | undefined {
  return nodes.find((node) => isNavFolder(node) && node.children.some((leaf) => leaf.id === id))?.id;
}

/**
 * @deprecated 8.0.2 — NavTree no longer puts the count in the name: the approved design
 * shows it as the grey number on the right of every folder, open or closed (`folderCount`). Kept for callers.
 */
export function folderLabel(folder: NavTreeFolderShape, open: boolean): string {
  return open ? folder.label : `${folder.label}（${folder.children.length}）`;
}

/** The grey number on the right of a folder row: how many rows it holds. */
export function folderCount(folder: NavTreeFolderShape): number {
  return folder.children.length;
}

/**
 * Ids of the rows a keyboard user walks through, top to bottom (folders, then the rows of open folders).
 * Only focusable rows: disabled leaves are skipped, and so are folders while searching (their toggle is
 * disabled then) — otherwise ↑ / ↓ would land on a row that cannot take focus and get stuck.
 */
export function visibleTreeIds(nodes: readonly NavTreeShape[], open: ReadonlySet<string>, searching = false): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (isNavFolder(node)) {
      if (!searching) ids.push(node.id);
      if (searching || open.has(node.id)) for (const leaf of node.children) if (!leaf.disabled) ids.push(leaf.id);
    } else if (!node.disabled) ids.push(node.id);
  }
  return ids;
}

/** Next row for ↑ / ↓ / Home / End (stays put at the ends). */
export function nextTreeId(ids: readonly string[], current: string, key: "ArrowUp" | "ArrowDown" | "Home" | "End"): string | undefined {
  if (!ids.length) return undefined;
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  const at = ids.indexOf(current);
  if (at < 0) return ids[0];
  return ids[Math.max(0, Math.min(ids.length - 1, at + (key === "ArrowDown" ? 1 : -1)))];
}

/**
 * Phone bottom bar: the modules listed in `pinned` (default the first ones) up to `max` (default 4);
 * the rest go behind 「更多」. The current module is always reachable in one tap: when it is not in the
 * bar it replaces the last pinned slot.
 */
export function railBottomNav<M extends { id: string }>(modules: readonly M[], active: string, pinned?: readonly string[], max = 4): { shown: M[]; more: M[] } {
  const order = pinned ? pinned.flatMap((id) => modules.filter((m) => m.id === id)) : [...modules];
  const shown = order.slice(0, max);
  const current = modules.find((m) => m.id === active);
  if (current && !shown.includes(current) && shown.length) shown[shown.length - 1] = current;
  return { shown, more: modules.filter((m) => !shown.includes(m)) };
}
