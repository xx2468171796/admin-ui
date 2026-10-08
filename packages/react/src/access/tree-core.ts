/**
 * Pure tree logic for CheckableTree / OrgTreePicker / UserTransfer: index, tri-state with or without
 * parent/child linkage (RuoYi `menu_check_strictly`), search and「只看已选」filtering, the visible rows
 * for keyboard navigation and full paths. No React / DOM.
 */
import type { TreeNode } from "./contracts.ts";

export type CheckState = "checked" | "unchecked" | "indeterminate";
export type TreeEntry = {
  node: TreeNode;
  parentId: string | null;
  depth: number;
  /** Ids from the root down to the parent. */
  ancestors: readonly string[];
  childIds: readonly string[];
};
export type TreeIndex = {
  roots: readonly string[];
  byId: ReadonlyMap<string, TreeEntry>;
  /** Depth-first order. */
  order: readonly string[];
};

/** Index a forest. Duplicate ids throw: every checked value must name exactly one node. */
export function indexTree(nodes: readonly TreeNode[]): TreeIndex {
  const byId = new Map<string, TreeEntry>();
  const order: string[] = [];
  const walk = (list: readonly TreeNode[], parentId: string | null, ancestors: readonly string[]) => {
    for (const node of list) {
      if (byId.has(node.id)) throw new Error(`树节点 id 重复：${node.id}`);
      const childIds = (node.children ?? []).map((c) => c.id);
      byId.set(node.id, { node, parentId, depth: ancestors.length, ancestors, childIds });
      order.push(node.id);
      if (node.children?.length) walk(node.children, node.id, [...ancestors, node.id]);
    }
  };
  walk(nodes, null, []);
  return { roots: nodes.map((n) => n.id), byId, order };
}

/** Labels from the root to the node, e.g. 「总部 / 销售中心 / 华东区」. Unknown id → the id itself. */
export function fullPath(index: TreeIndex, id: string, separator = " / "): string {
  const entry = index.byId.get(id);
  if (!entry) return id;
  return [...entry.ancestors.map((a) => index.byId.get(a)!.node.label), entry.node.label].join(separator);
}

/** All descendant ids (not including the node). */
export function descendants(index: TreeIndex, id: string): string[] {
  const out: string[] = [];
  const stack = [...(index.byId.get(id)?.childIds ?? [])].reverse();
  while (stack.length) {
    const next = stack.pop()!;
    out.push(next);
    stack.push(...[...(index.byId.get(next)?.childIds ?? [])].reverse());
  }
  return out;
}

/**
 * Tri-state of every node for a set of checked ids.
 * - linked: a parent is checked when all its (non-disabled-and-unchecked-ignored) descendants are, half
 *   when some are; leaves follow the set. A checked parent with no checked descendants still reads
 *   indeterminate (a saved half state from another tool), never silently「全选」.
 * - unlinked (strict): every node is exactly what the set says.
 */
export function checkStates(index: TreeIndex, checked: ReadonlySet<string>, linked: boolean): Map<string, CheckState> {
  const states = new Map<string, CheckState>();
  if (!linked) {
    for (const id of index.order) states.set(id, checked.has(id) ? "checked" : "unchecked");
    return states;
  }
  const visit = (id: string): CheckState => {
    const entry = index.byId.get(id)!;
    if (!entry.childIds.length) {
      const s: CheckState = checked.has(id) ? "checked" : "unchecked";
      states.set(id, s);
      return s;
    }
    const childStates = entry.childIds.map(visit);
    const all = childStates.every((s) => s === "checked");
    const none = childStates.every((s) => s === "unchecked");
    const s: CheckState = all ? "checked" : none && !checked.has(id) ? "unchecked" : "indeterminate";
    states.set(id, s);
    return s;
  };
  for (const root of index.roots) visit(root);
  return states;
}

/**
 * Toggle one node and return the new checked ids (in tree order, unknown ids kept at the end).
 * Linked: checking a node checks it and every enabled descendant; unchecking clears them; disabled
 * descendants keep their state. Ancestors are then recomputed: fully checked parents are added,
 * others removed — so the value is「leaves + fully checked parents」(halfChecked is reported separately).
 */
export function toggleNode(index: TreeIndex, checked: readonly string[], id: string, linked: boolean): string[] {
  const entry = index.byId.get(id);
  if (!entry || entry.node.disabled) return [...checked];
  const set = new Set(checked);
  if (!linked) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
    return ordered(index, set);
  }
  const subtree = [id, ...descendants(index, id)];
  // antd semantics: once every ENABLED leaf below is on, the click clears them — even when a disabled
  // unchecked leaf keeps the parent half-checked forever.
  const leaves = subtree.filter((t) => !index.byId.get(t)!.childIds.length && !index.byId.get(t)!.node.disabled);
  const turnOn = leaves.some((t) => !set.has(t));
  for (const target of subtree) {
    if (index.byId.get(target)!.node.disabled) continue;
    if (turnOn) set.add(target);
    else set.delete(target);
  }
  return normalizeLinked(index, set);
}

/** Linked value normal form: leaves as given, parents present exactly when fully checked. */
export function normalizeLinked(index: TreeIndex, set: ReadonlySet<string>): string[] {
  const next = new Set(set);
  // Parents first come off; checkStates then decides them from their children.
  for (const id of index.order) if (index.byId.get(id)!.childIds.length) next.delete(id);
  const states = checkStates(index, next, true);
  for (const id of index.order) if (index.byId.get(id)!.childIds.length && states.get(id) === "checked") next.add(id);
  return ordered(index, next);
}

/** Half-checked ids (what RuoYi stores alongside checked keys when linkage is on). */
export function halfChecked(index: TreeIndex, checked: readonly string[], linked: boolean): string[] {
  if (!linked) return [];
  const states = checkStates(index, new Set(checked), true);
  return index.order.filter((id) => states.get(id) === "indeterminate");
}

/** Set every enabled node on/off (keeps disabled nodes as they are). */
export function setAll(index: TreeIndex, checked: readonly string[], on: boolean, linked: boolean): string[] {
  const set = new Set(checked);
  for (const id of index.order) {
    if (index.byId.get(id)!.node.disabled) continue;
    if (on) set.add(id);
    else set.delete(id);
  }
  return linked ? normalizeLinked(index, set) : ordered(index, set);
}

function ordered(index: TreeIndex, set: ReadonlySet<string>): string[] {
  const known = index.order.filter((id) => set.has(id));
  const unknown = [...set].filter((id) => !index.byId.has(id));
  return [...known, ...unknown];
}

/** Case-insensitive match on label / hint / keywords / id; every space-separated word must appear. */
export function nodeMatches(node: TreeNode, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${node.label} ${node.hint ?? ""} ${node.keywords ?? ""} ${node.id}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * Which nodes stay visible for a search and/or「只看已选」: matches plus their ancestors (for context)
 * — and, for a search, the matches' descendants too, so finding「客户」shows all its actions.
 * Returns null when nothing filters (show everything).
 */
export function visibleIds(
  index: TreeIndex,
  options: { query?: string; onlyChecked?: boolean; states?: ReadonlyMap<string, CheckState> },
): Set<string> | null {
  const query = options.query?.trim() ?? "";
  if (!query && !options.onlyChecked) return null;
  const keep = new Set<string>();
  for (const id of index.order) {
    const entry = index.byId.get(id)!;
    const hit = !query || nodeMatches(entry.node, query) || entry.ancestors.some((a) => nodeMatches(index.byId.get(a)!.node, query));
    const picked = !options.onlyChecked || (options.states?.get(id) ?? "unchecked") !== "unchecked";
    if (hit && picked) {
      keep.add(id);
      for (const a of entry.ancestors) keep.add(a);
    }
  }
  return keep;
}

export type VisibleRow = { id: string; depth: number; hasChildren: boolean; expanded: boolean; setSize: number; posInSet: number };
/**
 * Flattened rows that are rendered, in order, for roving focus. With a filter active, every kept
 * branch is shown expanded (the user is looking for something; collapsing it again is allowed).
 */
export function visibleRows(index: TreeIndex, expanded: ReadonlySet<string>, keep: ReadonlySet<string> | null): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (ids: readonly string[], depth: number) => {
    const shown = keep ? ids.filter((id) => keep.has(id)) : ids;
    shown.forEach((id, i) => {
      const entry = index.byId.get(id)!;
      const children = keep ? entry.childIds.filter((c) => keep.has(c)) : entry.childIds;
      const isOpen = children.length > 0 && expanded.has(id);
      rows.push({ id, depth, hasChildren: children.length > 0, expanded: isOpen, setSize: shown.length, posInSet: i + 1 });
      if (isOpen) walk(children, depth + 1);
    });
  };
  walk(index.roots, 0);
  return rows;
}

/** Ids of every node with children (「全部展开」). */
export function branchIds(index: TreeIndex): string[] {
  return index.order.filter((id) => index.byId.get(id)!.childIds.length > 0);
}

/** Keyboard target for tree navigation (WAI-ARIA tree pattern). */
export type TreeKeyResult = { focus?: string; expand?: string; collapse?: string };
export function treeKey(rows: readonly VisibleRow[], index: TreeIndex, current: string, key: string): TreeKeyResult | null {
  const at = rows.findIndex((r) => r.id === current);
  if (at < 0) return rows[0] ? { focus: rows[0].id } : null;
  const row = rows[at]!;
  switch (key) {
    case "ArrowDown":
      return rows[at + 1] ? { focus: rows[at + 1]!.id } : {};
    case "ArrowUp":
      return rows[at - 1] ? { focus: rows[at - 1]!.id } : {};
    case "Home":
      return { focus: rows[0]!.id };
    case "End":
      return { focus: rows[rows.length - 1]!.id };
    case "ArrowRight":
      if (row.hasChildren && !row.expanded) return { expand: row.id };
      if (row.hasChildren && rows[at + 1]) return { focus: rows[at + 1]!.id };
      return {};
    case "ArrowLeft": {
      if (row.hasChildren && row.expanded) return { collapse: row.id };
      const parent = index.byId.get(row.id)?.parentId;
      return parent ? { focus: parent } : {};
    }
    default:
      return null;
  }
}
