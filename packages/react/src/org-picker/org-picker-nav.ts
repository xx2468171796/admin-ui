/**
 * OrgPicker keyboard and scrolling rules: the flat list of visible tree rows,
 * what an arrow / Home / End / Space / Enter does on the tree (WAI-ARIA tree pattern), and the window of
 * a fixed-height virtual list (rows of 48px; only what is visible plus a little overscan is drawn).
 * Pure; unit-tested.
 */
import type { OrgUnit } from "./org-picker-core.ts";

export type TreeRow = { unit: OrgUnit; level: number; expanded: boolean; hasChildren: boolean; parentId: string | null };

/**
 * Visible rows in order: roots, and the children of every expanded node. `children` = what is loaded
 * (missing = not loaded yet); `hidden` drops nodes the viewer may not see.
 */
export function visibleTreeRows(roots: readonly OrgUnit[], children: ReadonlyMap<string, readonly OrgUnit[]>, expanded: ReadonlySet<string>, hidden: (unit: OrgUnit) => boolean = () => false): TreeRow[] {
  const out: TreeRow[] = [];
  const walk = (units: readonly OrgUnit[], level: number) => {
    for (const unit of units) {
      if (hidden(unit)) continue;
      const loaded = children.get(unit.id);
      // Unknown child count: show the arrow until a load says it is a leaf.
      const hasChildren = loaded ? loaded.some((c) => !hidden(c)) : unit.childCount === undefined || unit.childCount > 0;
      const open = expanded.has(unit.id) && hasChildren;
      out.push({ unit, level, expanded: open, hasChildren, parentId: unit.parentId });
      if (open && loaded) walk(loaded, level + 1);
    }
  };
  walk(roots, 1);
  return out;
}

export type TreeKeyAction =
  | { type: "focus"; id: string }
  | { type: "expand"; id: string }
  | { type: "collapse"; id: string }
  | { type: "toggle"; id: string }
  | { type: "open"; id: string }
  | null;

/**
 * Tree keys: ↑ ↓ move; → expands a closed node, else goes to its first child; ← collapses an open node,
 * else goes to the parent; Home / End; Space ticks; Enter shows the node's people in the middle.
 */
export function treeKey(rows: readonly TreeRow[], activeId: string | null, key: string): TreeKeyAction {
  if (!rows.length) return null;
  const at = Math.max(0, rows.findIndex((r) => r.unit.id === activeId));
  const row = rows[at];
  if (!row) return null;
  switch (key) {
    case "ArrowDown":
      return { type: "focus", id: (rows[Math.min(rows.length - 1, at + 1)] ?? row).unit.id };
    case "ArrowUp":
      return { type: "focus", id: (rows[Math.max(0, at - 1)] ?? row).unit.id };
    case "Home":
      return { type: "focus", id: (rows[0] ?? row).unit.id };
    case "End":
      return { type: "focus", id: (rows[rows.length - 1] ?? row).unit.id };
    case "ArrowRight":
      if (row.hasChildren && !row.expanded) return { type: "expand", id: row.unit.id };
      if (row.expanded) {
        const child = rows[at + 1];
        return child && child.level === row.level + 1 ? { type: "focus", id: child.unit.id } : null;
      }
      return null;
    case "ArrowLeft":
      if (row.expanded) return { type: "collapse", id: row.unit.id };
      return row.parentId && rows.some((r) => r.unit.id === row.parentId) ? { type: "focus", id: row.parentId } : null;
    case " ":
      return { type: "toggle", id: row.unit.id };
    case "Enter":
      return { type: "open", id: row.unit.id };
    default:
      return null;
  }
}

/** ↑ ↓ Home End PageUp PageDown over a list of `count` rows (no wrap); null for other keys. */
export function listKey(active: number, key: string, count: number, page = 8): number | null {
  if (!count) return null;
  if (key === "ArrowDown") return Math.min(count - 1, active + 1);
  if (key === "ArrowUp") return Math.max(0, active - 1);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "PageDown") return Math.min(count - 1, active + page);
  if (key === "PageUp") return Math.max(0, active - page);
  return null;
}

/** Rows to draw for a fixed-height list: [start, end) plus the spacer heights above / below. */
export function virtualWindow(scrollTop: number, viewport: number, rowHeight: number, count: number, overscan = 6): { start: number; end: number; before: number; after: number } {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0, before: 0, after: 0 };
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan);
  const visible = Math.ceil(Math.max(viewport, rowHeight) / rowHeight) + overscan * 2;
  const end = Math.min(count, first + visible);
  return { start: first, end, before: first * rowHeight, after: (count - end) * rowHeight };
}

/** Scroll position that brings row `index` into view (nearest edge), or null when it already is. */
export function scrollToRow(index: number, scrollTop: number, viewport: number, rowHeight: number): number | null {
  const top = index * rowHeight;
  if (top < scrollTop) return top;
  if (top + rowHeight > scrollTop + viewport) return top + rowHeight - viewport;
  return null;
}
