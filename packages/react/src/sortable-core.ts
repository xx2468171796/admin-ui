/**
 * Pure ordering rules of SortableList (bt/foundations F0.3), unit-tested in test/sortable-core.test.ts.
 *
 * The list is a tree of at most two levels: top-level nodes are items or groups (`children` defined);
 * groups hold items and never other groups. A `locked` node never moves, and nothing moves across it:
 * every other node keeps its before / after relation to every locked node in the flattened order (so a
 * locked primary field stays first). A group that holds a locked item cannot move either.
 */

export type SortableNode<T> = { id: string; locked?: boolean; children?: readonly T[] };
/** Where a node goes: a parent (null = top level, else a group id) and an index among its siblings. */
export type SortableTarget = { parent: string | null; index: number };
/**
 * Host rule on top of the built-in ones (bt/record-detail): may `node` land at `target`? E.g. 「fields
 * only inside sections」 = `(node, t) => node.children !== undefined || t.parent !== null`.
 */
export type SortableAllow<T> = (node: T, target: SortableTarget) => boolean;
/** A visible row (groups first, then their items unless collapsed). */
export type SortableRow<T> = { node: T; depth: 0 | 1; parent: string | null; index: number; isGroup: boolean };

/** Move one element of a flat list (copy): reorder(["a","b","c"], 0, 2) → ["b","c","a"]. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from < 0 || from >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved as T);
  return next;
}

const isGroup = <T extends SortableNode<T>>(node: T) => node.children !== undefined;

/** Depth-first ids: group, then its children. */
export function flattenIds<T extends SortableNode<T>>(tree: readonly T[]): string[] {
  return tree.flatMap((node) => [node.id, ...(node.children ?? []).map((child) => child.id)]);
}

/** Rows the list shows: every top-level node, and the items of groups that are not collapsed. */
export function visibleRows<T extends SortableNode<T>>(tree: readonly T[], collapsed: ReadonlySet<string> = new Set()): SortableRow<T>[] {
  const rows: SortableRow<T>[] = [];
  tree.forEach((node, index) => {
    rows.push({ node, depth: 0, parent: null, index, isGroup: isGroup(node) });
    if (node.children && !collapsed.has(node.id)) node.children.forEach((child, i) => rows.push({ node: child, depth: 1, parent: node.id, index: i, isGroup: false }));
  });
  return rows;
}

/** Parent id and index of a node; null when missing. */
export function locate<T extends SortableNode<T>>(tree: readonly T[], id: string): SortableTarget | null {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]!;
    if (node.id === id) return { parent: null, index: i };
    const j = node.children?.findIndex((child) => child.id === id) ?? -1;
    if (j >= 0) return { parent: node.id, index: j };
  }
  return null;
}

const find = <T extends SortableNode<T>>(tree: readonly T[], id: string): T | undefined => {
  for (const node of tree) {
    if (node.id === id) return node;
    const child = node.children?.find((c) => c.id === id);
    if (child) return child;
  }
  return undefined;
};

/** A node can be picked up: not locked, and (for a group) holding no locked item. */
export function canPickUp<T extends SortableNode<T>>(tree: readonly T[], id: string): boolean {
  const node = find(tree, id);
  return Boolean(node && !node.locked && !(node.children ?? []).some((child) => child.locked));
}

/**
 * The tree with `id` moved to `target` (index counted after removing it), or null when the move is not
 * allowed: unknown node / parent, a group into a group, a locked node, or a node passing a locked one.
 * Moving onto its own place returns an equal tree.
 */
export function moveNode<T extends SortableNode<T>>(tree: readonly T[], id: string, target: SortableTarget, allow?: SortableAllow<T>): T[] | null {
  const from = locate(tree, id);
  const node = find(tree, id);
  if (!from || !node || !canPickUp(tree, id)) return null;
  if (allow && !(from.parent === target.parent && from.index === target.index) && !allow(node, target)) return null;
  if (target.parent !== null && (isGroup(node) || !tree.some((n) => n.id === target.parent && isGroup(n)))) return null;
  // Remove.
  let next: T[] = from.parent === null
    ? tree.filter((n) => n.id !== id)
    : tree.map((n) => (n.id === from.parent ? { ...n, children: (n.children ?? []).filter((c) => c.id !== id) } : n));
  // Insert.
  if (target.parent === null) {
    if (target.index < 0 || target.index > next.length) return null;
    next = [...next.slice(0, target.index), node, ...next.slice(target.index)];
  } else {
    const parent = next.find((n) => n.id === target.parent);
    const siblings = parent?.children ?? [];
    if (target.index < 0 || target.index > siblings.length) return null;
    next = next.map((n) => (n.id === target.parent ? { ...n, children: [...siblings.slice(0, target.index), node, ...siblings.slice(target.index)] } : n));
  }
  // Nothing passes a locked node.
  const before = flattenIds(tree);
  const after = flattenIds(next);
  const moved = [node.id, ...(node.children ?? []).map((c) => c.id)];
  const locked = before.filter((nid) => find(tree, nid)?.locked);
  for (const l of locked)
    for (const m of moved)
      if (before.indexOf(m) < before.indexOf(l) !== after.indexOf(m) < after.indexOf(l)) return null;
  return next;
}

/**
 * One keyboard step (Alt+↑ / Alt+↓, or ↑ / ↓ while lifted) in the visible order: an item moves past
 * its neighbour, leaves its group at the group's edge, enters an expanded group it reaches (at the near
 * end), and steps over a collapsed group; a group moves past its top-level neighbour. Null when blocked
 * (edge of the list or a locked node in the way). With an `allow` rule that keeps items out of the top
 * level, an item at a group's edge moves straight into the neighbouring group instead.
 */
export function stepTarget<T extends SortableNode<T>>(tree: readonly T[], id: string, dir: -1 | 1, collapsed: ReadonlySet<string> = new Set(), allow?: SortableAllow<T>): SortableTarget | null {
  const at = locate(tree, id);
  const node = find(tree, id);
  if (!at || !node) return null;
  const tries: SortableTarget[] = [];
  if (isGroup(node) || at.parent === null) {
    const neighbour = tree[at.index + dir];
    if (!neighbour) return null;
    if (!isGroup(node) && isGroup(neighbour) && !collapsed.has(neighbour.id)) {
      // Enter the expanded group at its near end.
      tries.push({ parent: neighbour.id, index: dir === 1 ? 0 : (neighbour.children ?? []).length });
    }
    tries.push({ parent: null, index: at.index + dir });
  } else {
    const siblings = tree.find((n) => n.id === at.parent)?.children ?? [];
    const groupIndex = tree.findIndex((n) => n.id === at.parent);
    const inside = at.index + dir;
    if (inside >= 0 && inside < siblings.length) tries.push({ parent: at.parent, index: inside });
    // Leave the group: just above it (↑ from the first item) or just below it (↓ from the last) …
    else {
      tries.push({ parent: null, index: dir === 1 ? groupIndex + 1 : groupIndex });
      // … or, when the rule keeps items in groups, into the nearest group that way.
      for (let i = groupIndex + dir; i >= 0 && i < tree.length; i += dir) {
        const group = tree[i]!;
        if (!isGroup(group)) continue;
        tries.push({ parent: group.id, index: dir === 1 ? 0 : (group.children ?? []).length });
        break;
      }
    }
  }
  for (const target of tries) if (moveNode(tree, id, target, allow)) return target;
  return null;
}

/**
 * Pointer drop: the target for dropping `id` on the `edge` of visible row `over` (rows from
 * visibleRows). Before / after an item → next to it in its parent; after an expanded group header →
 * first in that group; after a collapsed group header → last in that group; a dragged group always
 * lands at the top level (next to the group the row belongs to). Null when the move is not allowed.
 */
export function dropTarget<T extends SortableNode<T>>(tree: readonly T[], rows: readonly SortableRow<T>[], id: string, over: number, edge: "before" | "after", collapsed: ReadonlySet<string> = new Set(), allow?: SortableAllow<T>): SortableTarget | null {
  const row = rows[over];
  const node = find(tree, id);
  if (!row || !node) return null;
  const from = locate(tree, id);
  let target: SortableTarget;
  if (isGroup(node)) {
    const top = row.parent === null ? row.index : tree.findIndex((n) => n.id === row.parent);
    // A row inside a group counts as the group: before its first half, after its second.
    const after = row.parent === null ? edge === "after" : row.index >= ((tree[top]?.children ?? []).length / 2);
    target = { parent: null, index: top + (after ? 1 : 0) };
  } else if (row.isGroup && edge === "after") {
    target = { parent: row.node.id, index: collapsed.has(row.node.id) ? (row.node.children ?? []).length : 0 };
  } else {
    target = { parent: row.parent, index: row.index + (edge === "after" ? 1 : 0) };
  }
  // Indices above were counted with the node still in place: shift when it sits earlier in the same parent.
  if (from && from.parent === target.parent && from.index < target.index) target = { ...target, index: target.index - 1 };
  if (moveNode(tree, id, target, allow)) return target;
  // An item the rule keeps out of the top level, dropped between groups: the end of the group above.
  if (allow && !isGroup(node) && target.parent === null) {
    const above = tree.slice(0, target.index + (from && from.parent === null && from.index < target.index ? 1 : 0)).filter((n) => isGroup(n) && n.id !== id).pop();
    if (above) {
      const end = { parent: above.id, index: (above.children ?? []).filter((c) => c.id !== id).length };
      if (moveNode(tree, id, end, allow)) return end;
    }
  }
  return null;
}

/** 1-based position text for announcements: 「第 3 项，共 15 项」 / 「“联系方式”里第 1 项，共 3 项」. */
export function positionText<T extends SortableNode<T>>(tree: readonly T[], id: string, groupLabel: (group: T) => string): string {
  const at = locate(tree, id);
  if (!at) return "";
  if (at.parent === null) return `第 ${at.index + 1} 项，共 ${tree.length} 项`;
  const group = tree.find((n) => n.id === at.parent);
  return `「${group ? groupLabel(group) : ""}」里第 ${at.index + 1} 项，共 ${(group?.children ?? []).length} 项`;
}
