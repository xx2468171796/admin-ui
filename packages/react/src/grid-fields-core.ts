/**
 * The field panel's tree (bt/grid-a G6, D05) ⇄ the view's column order and field groups. Pure; unit-tested
 * in test/grid-view-v2.test.ts.
 */
import type { GridFieldGroup, GridView } from "./grid-core.ts";

/** A row of the field panel: a field (id = key) or a field group (id = 「§」 + group id) with its fields. */
export type FieldPanelNode = { id: string; locked?: boolean; children?: FieldPanelNode[] };
type Node = FieldPanelNode;
export const FIELD_GROUP_PREFIX = "§";
const GROUP = FIELD_GROUP_PREFIX;
const groupNodeId = (id: string) => `${GROUP}${id}`;
const isGroupNode = (id: string) => id.startsWith(GROUP);

/** Panel tree of a view: fields in column order, members of a field group under it, empty groups last. */
export function fieldPanelTree(view: Pick<GridView, "order" | "fieldGroups">, primary: string | undefined): Node[] {
  const groupOf = new Map<string, GridFieldGroup>();
  for (const group of view.fieldGroups) for (const key of group.fields) groupOf.set(key, group);
  const out: Node[] = [];
  const seen = new Set<string>();
  for (const key of view.order) {
    const group = groupOf.get(key);
    if (!group) {
      out.push({ id: key, ...(key === primary ? { locked: true } : {}) });
      continue;
    }
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    out.push({ id: groupNodeId(group.id), children: view.order.filter((k) => groupOf.get(k) === group).map((k) => ({ id: k })) });
  }
  for (const group of view.fieldGroups) if (!seen.has(group.id)) out.push({ id: groupNodeId(group.id), children: [] });
  return out;
}
/** Back from the panel tree: column order and field groups. */
export function fieldLayoutOf(tree: readonly Node[], groups: readonly GridFieldGroup[]): { order: string[]; fieldGroups: GridFieldGroup[] } {
  const order: string[] = [];
  const fieldGroups: GridFieldGroup[] = [];
  for (const node of tree) {
    if (!isGroupNode(node.id)) {
      order.push(node.id);
      continue;
    }
    const id = node.id.slice(GROUP.length);
    const members = (node.children ?? []).map((child) => child.id);
    order.push(...members);
    fieldGroups.push({ id, title: groups.find((g) => g.id === id)?.title ?? id, fields: members });
  }
  return { order, fieldGroups };
}

