/**
 * The parts of a BitableGrid view added by bt/grid-a (G2 / G4 / G6 / G13) and how older
 * stored views migrate to them — pure, no React. grid-core's normalizeGridView calls these, so every
 * saved view (localStorage, host settings) keeps working:
 *
 *   filters[] + conjunction  →  filter: the condition tree (condition-core.ts)
 *   groupBy: "stage"         →  groupBy: [{ field: "stage", order: "asc" }]
 *
 * New: field groups of the field panel, conditional colour rules (填色), 显示空分组, 自动排序.
 * Unit-tested in test/grid-view-v2.test.ts.
 */
import type { GridField, GridFilter, GridView } from "./grid-core.ts";
import { coreType } from "./grid-field-types.ts";
import { conditionKindOf, conditionTreeFromList, normalizeConditionTree, type ConditionGroup, type ConditionKind, type ConditionLimits } from "./condition-core.ts";
import { isOptionToneName, legacyTone, type OptionTone } from "./option-tone.ts";

/** One grouping level: the field and the order of its groups (asc = option order / A→Z / small→large / early→late). */
export type GroupLevel = { field: string; order: "asc" | "desc" };
/** A named, collapsible block of fields in the field panel; its fields stay next to each other in the column order. */
export type GridFieldGroup = { id: string; title: string; fields: string[] };
/**
 * 填色: records matching `filter` get one of the seven option tones — the whole row, or only the cell of
 * `field`. Rules are checked top to bottom; the first match wins (per row, and per cell).
 */
export type GridColorRule = { id: string; target: "row" | "cell"; field?: string; tone: OptionTone; filter: ConditionGroup; enabled?: boolean };

/**
 * User-facing limits (defaults, overridable per grid): 3 group levels, 50 filter
 * conditions, groups nested one level below the top. Stored views are only cut at the hard limits.
 */
export type GridViewLimits = { maxGroupLevels: number; maxConditions: number; maxFilterDepth: number; maxColorRules: number };
export const GRID_LIMITS: Readonly<GridViewLimits> = { maxGroupLevels: 3, maxConditions: 50, maxFilterDepth: 1, maxColorRules: 20 };
/** What a stored view may hold at most, whatever the UI limits are. */
export const GRID_HARD_LIMITS: Readonly<GridViewLimits> = { maxGroupLevels: 10, maxConditions: 200, maxFilterDepth: 3, maxColorRules: 100 };
export const gridConditionLimits = (limits: Partial<GridViewLimits> = {}): ConditionLimits => ({ maxDepth: limits.maxFilterDepth ?? GRID_LIMITS.maxFilterDepth, maxConditions: limits.maxConditions ?? GRID_LIMITS.maxConditions });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
type FieldLike = Pick<GridField<unknown>, "key" | "type" | "filterable" | "groupable" | "resultType"> & { text?: unknown };

/**
 * Condition kind of a grid field: rating keeps its own kind (star editor, 「大于等于」); the other extra
 * types follow their base type (bt/grid-b coreType: progress → number, createdAt → date, formula → its
 * resultType …).
 */
export function gridConditionKind(field: Pick<GridField<unknown>, "type" | "resultType">): ConditionKind {
  return field.type === "rating" ? "rating" : conditionKindOf(coreType(field));
}

/** Condition kind of a grid field (filters, colour rules); undefined = cannot be filtered. */
export function gridFieldKind(field: FieldLike | undefined): ConditionKind | undefined {
  if (!field || field.filterable === false || (field.type === "custom" && !field.text)) return undefined;
  return gridConditionKind(field);
}
const canGroup = (field: FieldLike | undefined) => Boolean(field && field.groupable !== false && (field.type !== "custom" || field.text));

/**
 * The filter tree of a stored view: `filter` (v2) when present, else the legacy flat `filters` +
 * `conjunction`; unknown fields, bad operators and values dropped (see normalizeConditionTree).
 */
export function normalizeViewFilter(source: Record<string, unknown>, fields: readonly FieldLike[]): ConditionGroup {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const kindOf = (key: string) => gridFieldKind(byKey.get(key));
  const limits = gridConditionLimits(GRID_HARD_LIMITS);
  if (isRecord(source.filter)) return normalizeConditionTree(source.filter, kindOf, limits);
  const list = Array.isArray(source.filters) ? source.filters.filter(isRecord) : [];
  return normalizeConditionTree(conditionTreeFromList(list as unknown as GridFilter[], source.conjunction === "or" ? "or" : "and"), kindOf, limits);
}

/** Group levels of a stored view: an array of levels, or the legacy single field key. */
export function normalizeGroupLevels(input: unknown, fields: readonly FieldLike[], max = GRID_HARD_LIMITS.maxGroupLevels): GroupLevel[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const list: unknown[] = typeof input === "string" ? [{ field: input, order: "asc" }] : Array.isArray(input) ? input : [];
  const out: GroupLevel[] = [];
  for (const item of list) {
    const level = typeof item === "string" ? { field: item, order: "asc" } : item;
    if (!isRecord(level) || typeof level.field !== "string" || !canGroup(byKey.get(level.field)) || out.some((l) => l.field === level.field)) continue;
    out.push({ field: level.field, order: level.order === "desc" ? "desc" : "asc" });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Field groups: known fields only, each field in at most one group, the primary field never grouped.
 * Without stored groups, fields that declare `group` (a title) seed them.
 */
export function normalizeFieldGroups(input: unknown, fields: readonly (FieldLike & { group?: string; primary?: boolean })[], primary: string | undefined): GridFieldGroup[] {
  const keys = new Set(fields.map((field) => field.key));
  const taken = new Set<string>(primary ? [primary] : []);
  const out: GridFieldGroup[] = [];
  const add = (id: string, title: string, members: readonly unknown[]) => {
    if (out.some((g) => g.id === id)) return;
    const list = members.filter((key): key is string => typeof key === "string" && keys.has(key) && !taken.has(key));
    list.forEach((key) => taken.add(key));
    out.push({ id, title: title.slice(0, 40), fields: list });
  };
  if (Array.isArray(input)) {
    for (const item of input) if (isRecord(item) && typeof item.id === "string" && item.id && typeof item.title === "string") add(item.id, item.title, Array.isArray(item.fields) ? item.fields : []);
    return out;
  }
  for (const field of fields) {
    if (!field.group || field.key === primary) continue;
    const id = `group:${field.group}`;
    const existing = out.find((g) => g.id === id);
    if (existing) {
      if (!taken.has(field.key)) { existing.fields.push(field.key); taken.add(field.key); }
    } else add(id, field.group, [field.key]);
  }
  return out;
}

/** Colour rules: known tones, a valid filter tree, a cell target needs a known field. */
export function normalizeColorRules(input: unknown, fields: readonly FieldLike[]): GridColorRule[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const kindOf = (key: string) => gridFieldKind(byKey.get(key));
  const out: GridColorRule[] = [];
  for (const item of input) {
    if (out.length >= GRID_HARD_LIMITS.maxColorRules) break;
    if (!isRecord(item) || typeof item.id !== "string" || !item.id || out.some((r) => r.id === item.id)) continue;
    const tone: OptionTone | null = isOptionToneName(item.tone) ? item.tone : typeof item.tone === "string" ? legacyTone(item.tone) ?? null : null;
    const target = item.target === "cell" ? "cell" : "row";
    if (!tone || (target === "cell" && !(typeof item.field === "string" && byKey.has(item.field)))) continue;
    out.push({
      id: item.id,
      target,
      ...(target === "cell" ? { field: item.field as string } : {}),
      tone,
      filter: normalizeConditionTree(item.filter, kindOf, gridConditionLimits(GRID_HARD_LIMITS)),
      ...(item.enabled === false ? { enabled: false } : {}),
    });
  }
  return out;
}

/** Column order with each field group's members kept together (at the place of its first member). */
export function orderWithFieldGroups(order: readonly string[], groups: readonly GridFieldGroup[]): string[] {
  if (!groups.length) return order.slice();
  const groupOf = new Map<string, GridFieldGroup>();
  for (const group of groups) for (const key of group.fields) groupOf.set(key, group);
  const out: string[] = [];
  const done = new Set<string>();
  for (const key of order) {
    if (done.has(key)) continue;
    const group = groupOf.get(key);
    const members = group ? order.filter((k) => groupOf.get(k) === group) : [key];
    for (const member of members) { out.push(member); done.add(member); }
  }
  return out;
}

/** True when a view groups by this field (any level). */
export const isGroupedBy = (view: Pick<GridView, "groupBy">, key: string) => view.groupBy.some((level) => level.field === key);

/**
 * One frame for the five view panels: left edge on the button, three widths by content —
 * conditions (筛选 / 填色) 580, lists (分组 / 排序) 420, fields 320; phones get a bottom sheet.
 */
export const VIEW_PANEL_WIDTHS = { condition: 580, list: 420, field: 320 } as const;
export type ViewPanelWidth = keyof typeof VIEW_PANEL_WIDTHS;
