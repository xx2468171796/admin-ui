/**
 * Condition model v2 (bt/grid-a G2): a filter is a tree — a root group of
 * conditions combined with 「全部满足」(and) / 「任一满足」(or), which may hold nested groups with their
 * own and / or. Values can be literal, dynamic (「我」「我的下属」 and host tokens, resolved by the host)
 * or relative dates (今天、本周、过去 N 天 …, with time zone and week start as parameters).
 *
 * Generic on purpose: no grid types, no React. BitableGrid filters (grid-core / grid-sql), the
 * conditional colours of a view and the governance CondBuilder all build on the same tree, the same
 * operators per field kind and the same editing helpers. Unit-tested in test/condition-core.test.ts.
 *
 * Limits are defaults, not rules: CONDITION_LIMITS (nesting depth 1 = top level + one level of groups,
 * 50 conditions) can be overridden by every caller.
 */
import { dayKey } from "./format.ts";

// ---------------------------------------------------------------- types

export type ConditionConjunction = "and" | "or";
/** Value family of a field: decides the operators and the value editor. */
export type ConditionKind = "text" | "number" | "rating" | "date" | "select" | "multi" | "user" | "checkbox";
export const CONDITION_KINDS: readonly ConditionKind[] = ["text", "number", "rating", "date", "select", "multi", "user", "checkbox"];

export type ConditionOp =
  | "contains"
  | "notContains"
  | "is"
  | "isNot"
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after"
  | "onOrBefore"
  | "onOrAfter"
  | "inRange"
  | "notInRange"
  | "anyOf"
  | "noneOf"
  | "hasAny"
  | "hasAll"
  | "hasNone"
  | "checked"
  | "unchecked"
  | "empty"
  | "notEmpty";

/** A value the host resolves when the condition runs: `me`, `mySubordinates` or a host token. */
export type DynamicValue = { dynamic: string };
export type RelativeDateToken = "today" | "yesterday" | "tomorrow" | "thisWeek" | "lastWeek" | "nextWeek" | "thisMonth" | "lastMonth" | "nextMonth" | "thisYear" | "pastDays" | "nextDays";
/** A day range relative to today; `days` only for pastDays / nextDays (1–3650). */
export type RelativeDateValue = { relative: RelativeDateToken; days?: number };
/** Fixed day range, both ends inclusive ("YYYY-MM-DD"). */
export type DateRangeValue = { from: string; to: string };
export type ConditionValue = string | number | boolean | readonly string[] | null | DynamicValue | RelativeDateValue | DateRangeValue;

export type Condition<Op extends string = ConditionOp> = { id: string; field: string; op: Op; value?: ConditionValue };
export type ConditionGroup<Op extends string = ConditionOp> = { id: string; conjunction: ConditionConjunction; items: ConditionNode<Op>[] };
export type ConditionNode<Op extends string = ConditionOp> = Condition<Op> | ConditionGroup<Op>;

export type ConditionLimits = {
  /** Nesting below the root: 0 = flat list, 1 (default) = groups inside the root, no deeper. */
  maxDepth: number;
  /** Conditions in the whole tree (default 50). */
  maxConditions: number;
};
export const CONDITION_LIMITS: Readonly<ConditionLimits> = { maxDepth: 1, maxConditions: 50 };

/**
 * What evaluating needs from the host: the clock and calendar for relative dates (time zone, first day
 * of the week: 0 Sunday … 6 Saturday, default 1 Monday) and a resolver for dynamic values. A dynamic
 * value the resolver does not know (or no resolver) makes its condition match nothing — a 「我的记录」
 * view never falls back to showing everything.
 */
export type ConditionContext = {
  now?: number | Date;
  timeZone?: string;
  weekStart?: number;
  resolve?: (token: string) => readonly string[] | null | undefined;
};

// ---------------------------------------------------------------- operators

const NUMBER_OPS: readonly ConditionOp[] = ["eq", "neq", "gt", "gte", "lt", "lte", "empty", "notEmpty"];
/** Operators offered per kind (first = default when a field is picked). */
export const CONDITION_OPS: Readonly<Record<ConditionKind, readonly ConditionOp[]>> = {
  text: ["contains", "notContains", "is", "isNot", "empty", "notEmpty"],
  number: NUMBER_OPS,
  rating: ["gte", "lte", "eq", "neq", "gt", "lt", "empty", "notEmpty"],
  date: ["is", "inRange", "notInRange", "before", "after", "onOrBefore", "onOrAfter", "empty", "notEmpty"],
  select: ["anyOf", "noneOf", "empty", "notEmpty"],
  multi: ["hasAny", "hasAll", "hasNone", "empty", "notEmpty"],
  user: ["hasAny", "hasNone", "hasAll", "empty", "notEmpty"],
  checkbox: ["checked", "unchecked"],
};
export const CONDITION_OP_LABELS: Readonly<Record<ConditionOp, string>> = {
  contains: "包含",
  notContains: "不包含",
  is: "等于",
  isNot: "不等于",
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  before: "早于",
  after: "晚于",
  onOrBefore: "不晚于",
  onOrAfter: "不早于",
  inRange: "在范围内",
  notInRange: "不在范围内",
  anyOf: "是",
  noneOf: "不是",
  hasAny: "包含任一",
  hasAll: "包含全部",
  hasNone: "不包含任一",
  checked: "已勾选",
  unchecked: "未勾选",
  empty: "为空",
  notEmpty: "不为空",
};
const KIND_LABELS: Partial<Record<ConditionKind, Partial<Record<ConditionOp, string>>>> = {
  rating: { eq: "等于", neq: "不等于", gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于" },
  date: { is: "是" },
  user: { hasAny: "是", hasNone: "不是", hasAll: "包含全部" },
};
/** Label of an operator for a kind (rating reads 「大于等于」, people 「是 / 不是」). */
export function conditionOpLabel(op: ConditionOp, kind?: ConditionKind): string {
  return (kind && KIND_LABELS[kind]?.[op]) ?? CONDITION_OP_LABELS[op];
}
/** Operators that take no value. */
export const VALUELESS_OPS: ReadonlySet<ConditionOp> = new Set(["empty", "notEmpty", "checked", "unchecked"]);

/**
 * Kind of a field type name (grid types and the common names other tables use). Unknown names read as
 * text, so a new field type is filterable as text until it gets its own kind.
 */
export function conditionKindOf(type: string): ConditionKind {
  switch (type) {
    case "number":
    case "money":
    case "progress":
    case "percent":
    case "autoNumber":
    case "duration":
      return "number";
    case "rating":
      return "rating";
    case "date":
    case "datetime":
    case "createdAt":
    case "updatedAt":
    case "modifiedAt":
      return "date";
    case "singleSelect":
    case "select":
      return "select";
    case "multiSelect":
    case "tags":
      return "multi";
    case "user":
    case "person":
    case "createdBy":
    case "updatedBy":
    case "modifiedBy":
      return "user";
    case "checkbox":
    case "boolean":
      return "checkbox";
    default:
      return "text";
  }
}

// ---------------------------------------------------------------- dynamic values

export type DynamicToken = { token: string; label: string };
/** Built-in tokens; hosts add their own (「我的部门」) and resolve them all. */
export const CONDITION_DYNAMIC_TOKENS: readonly DynamicToken[] = [
  { token: "me", label: "我（当前用户）" },
  { token: "mySubordinates", label: "我的下属" },
];
export const isDynamicValue = (value: unknown): value is DynamicValue => isRecord(value) && typeof value.dynamic === "string" && value.dynamic !== "";
/** Values of a dynamic token from the host; null = cannot resolve (the condition matches nothing). */
export function resolveDynamic(value: DynamicValue, context: ConditionContext = {}): string[] | null {
  const out = context.resolve?.(value.dynamic);
  return out ? out.filter((v): v is string => typeof v === "string") : null;
}

// ---------------------------------------------------------------- relative dates

export const RELATIVE_DATE_TOKENS: readonly RelativeDateToken[] = ["today", "yesterday", "tomorrow", "thisWeek", "lastWeek", "nextWeek", "thisMonth", "lastMonth", "nextMonth", "thisYear", "pastDays", "nextDays"];
export const RELATIVE_DATE_LABELS: Readonly<Record<RelativeDateToken, string>> = {
  today: "今天",
  yesterday: "昨天",
  tomorrow: "明天",
  thisWeek: "本周",
  lastWeek: "上周",
  nextWeek: "下周",
  thisMonth: "本月",
  lastMonth: "上月",
  nextMonth: "下月",
  thisYear: "今年",
  pastDays: "过去 N 天",
  nextDays: "未来 N 天",
};
export const isRelativeDate = (value: unknown): value is RelativeDateValue =>
  isRecord(value) && typeof value.relative === "string" && (RELATIVE_DATE_TOKENS as readonly string[]).includes(value.relative) &&
  (value.relative === "pastDays" || value.relative === "nextDays" ? Number.isInteger(value.days) && (value.days as number) >= 1 && (value.days as number) <= 3650 : value.days === undefined);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !DAY.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(value);
};
export const isDateRange = (value: unknown): value is DateRangeValue => isRecord(value) && isDay(value.from) && isDay(value.to) && value.from <= value.to;
/** 「过去 7 天」「本周」. */
export function relativeDateLabel(value: RelativeDateValue): string {
  if (value.relative === "pastDays") return `过去 ${value.days ?? 7} 天`;
  if (value.relative === "nextDays") return `未来 ${value.days ?? 7} 天`;
  return RELATIVE_DATE_LABELS[value.relative];
}

const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** "YYYY-MM-DD" + n days. */
export const addDays = (day: string, n: number) => fromUtc(toUtc(day) + n * 86_400_000);
/** Today as "YYYY-MM-DD" in a time zone (default: the runtime's). */
export const todayIn = (context: ConditionContext = {}) => dayKey(context.now ?? Date.now(), context.timeZone);

/**
 * The days a relative value covers, both ends inclusive. Weeks start on `weekStart` (default Monday);
 * pastDays N = the N days ending today, nextDays N = the N days starting today.
 */
export function relativeDateRange(value: RelativeDateValue, context: ConditionContext = {}): DateRangeValue {
  const today = todayIn(context);
  const weekStart = Number.isInteger(context.weekStart) ? (((context.weekStart as number) % 7) + 7) % 7 : 1;
  const weekday = new Date(toUtc(today)).getUTCDay();
  const weekFrom = addDays(today, -((weekday - weekStart + 7) % 7));
  const [y, m] = today.split("-").map(Number) as [number, number];
  const month = (offset: number) => {
    const first = new Date(Date.UTC(y, m - 1 + offset, 1));
    const last = new Date(Date.UTC(y, m + offset, 0));
    return { from: fromUtc(first.getTime()), to: fromUtc(last.getTime()) };
  };
  const days = Math.max(1, Math.floor(value.days ?? 7));
  switch (value.relative) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "tomorrow":
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case "thisWeek":
      return { from: weekFrom, to: addDays(weekFrom, 6) };
    case "lastWeek":
      return { from: addDays(weekFrom, -7), to: addDays(weekFrom, -1) };
    case "nextWeek":
      return { from: addDays(weekFrom, 7), to: addDays(weekFrom, 13) };
    case "thisMonth":
      return month(0);
    case "lastMonth":
      return month(-1);
    case "nextMonth":
      return month(1);
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "pastDays":
      return { from: addDays(today, -(days - 1)), to: today };
    case "nextDays":
      return { from: today, to: addDays(today, days - 1) };
  }
}
/** Day range of a date condition's value (a day, a relative value or a fixed range); null when invalid. */
export function conditionDayRange(value: ConditionValue | undefined, context: ConditionContext = {}): DateRangeValue | null {
  if (isDay(value)) return { from: value, to: value };
  if (isRelativeDate(value)) return relativeDateRange(value, context);
  if (isDateRange(value)) return { from: value.from, to: value.to };
  return null;
}
/** Does a day ("YYYY-MM-DD") satisfy a date operator against a range. */
export function compareDay(day: string, op: ConditionOp, range: DateRangeValue): boolean {
  switch (op) {
    case "is":
    case "inRange":
      return day >= range.from && day <= range.to;
    case "notInRange":
      return day < range.from || day > range.to;
    case "before":
      return day < range.from;
    case "after":
      return day > range.to;
    case "onOrBefore":
      return day <= range.to;
    case "onOrAfter":
      return day >= range.from;
    default:
      return false;
  }
}

// ---------------------------------------------------------------- validity

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const DYNAMIC_KINDS = new Set<ConditionKind>(["user", "text", "select", "multi"]);
/** A value of a shape some condition can hold (anything else is dropped when a view is loaded). */
export function isConditionValue(value: unknown): value is ConditionValue {
  return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every((v) => typeof v === "string")) || isDynamicValue(value) || isRelativeDate(value) || isDateRange(value);
}

/**
 * A condition takes part only once it is complete: the operator fits the kind and the value fits the
 * operator (「包含」 with an empty box, a list with nothing ticked, 「过去 0 天」 are ignored).
 */
export function isConditionComplete(kind: ConditionKind, op: ConditionOp, value: ConditionValue | undefined): boolean {
  if (!CONDITION_OPS[kind].includes(op)) return false;
  if (VALUELESS_OPS.has(op)) return true;
  if (value === undefined || value === null) return false;
  if (isDynamicValue(value)) return DYNAMIC_KINDS.has(kind) && op !== "contains" && op !== "notContains";
  switch (kind) {
    case "number":
    case "rating":
      return typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value.trim()));
    case "date":
      if (op === "inRange" || op === "notInRange") return isDay(value) || isRelativeDate(value) || isDateRange(value);
      return isDay(value) || isRelativeDate(value);
    case "select":
    case "multi":
    case "user":
      return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim() !== "";
    case "checkbox":
      return false;
    default:
      return (typeof value === "string" && value.trim() !== "") || typeof value === "number";
  }
}

// ---------------------------------------------------------------- tree

export const isConditionGroup = <Op extends string>(node: ConditionNode<Op>): node is ConditionGroup<Op> => Array.isArray((node as ConditionGroup<Op>).items);
export const emptyConditionGroup = <Op extends string = ConditionOp>(id = "root", conjunction: ConditionConjunction = "and"): ConditionGroup<Op> => ({ id, conjunction, items: [] });

/** Conditions in the tree (groups not counted). */
export function countConditions(group: ConditionGroup<string>): number {
  return group.items.reduce((n, node) => n + (isConditionGroup(node) ? countConditions(node) : 1), 0);
}
/** Groups in the tree below the root. */
export function countConditionGroups(group: ConditionGroup<string>): number {
  return group.items.reduce((n, node) => n + (isConditionGroup(node) ? 1 + countConditionGroups(node) : 0), 0);
}
/** Every condition, depth first. */
export function flattenConditions<Op extends string>(group: ConditionGroup<Op>): Condition<Op>[] {
  return group.items.flatMap((node) => (isConditionGroup(node) ? flattenConditions(node) : [node]));
}
/** The node with this id (the root included) and its parent group. */
export function findConditionNode<Op extends string>(root: ConditionGroup<Op>, id: string): { node: ConditionNode<Op>; parent: ConditionGroup<Op> | null; depth: number } | null {
  if (root.id === id) return { node: root, parent: null, depth: 0 };
  const walk = (group: ConditionGroup<Op>, depth: number): ReturnType<typeof findConditionNode<Op>> => {
    for (const node of group.items) {
      if (node.id === id) return { node, parent: group, depth: depth + 1 };
      if (isConditionGroup(node)) {
        const hit = walk(node, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(root, 0);
}
/** Next unused id with a prefix: f1, f2 … (conditions) / g1 … (groups). */
export function nextConditionId(root: ConditionGroup<string>, prefix = "f"): string {
  const used = new Set<string>([root.id]);
  const walk = (group: ConditionGroup<string>) => group.items.forEach((node) => { used.add(node.id); if (isConditionGroup(node)) walk(node); });
  walk(root);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const mapGroups = <Op extends string>(group: ConditionGroup<Op>, fn: (group: ConditionGroup<Op>) => ConditionGroup<Op>): ConditionGroup<Op> =>
  fn({ ...group, items: group.items.map((node) => (isConditionGroup(node) ? mapGroups(node, fn) : node)) });

/** Can one more condition go in (count limit). */
export const canAddCondition = (root: ConditionGroup<string>, limits: Partial<ConditionLimits> = {}) => countConditions(root) < (limits.maxConditions ?? CONDITION_LIMITS.maxConditions);
/** Can a new group go into `parentId` (depth limit; a group starts with one condition, so the count limit too). */
export function canAddConditionGroup(root: ConditionGroup<string>, parentId: string, limits: Partial<ConditionLimits> = {}): boolean {
  const at = findConditionNode(root, parentId);
  if (!at || !isConditionGroup(at.node)) return false;
  return at.depth + 1 <= (limits.maxDepth ?? CONDITION_LIMITS.maxDepth) && canAddCondition(root, limits);
}
/** Append a node to a group (unknown group: unchanged). */
export function addConditionNode<Op extends string>(root: ConditionGroup<Op>, parentId: string, node: ConditionNode<Op>): ConditionGroup<Op> {
  return mapGroups(root, (group) => (group.id === parentId ? { ...group, items: [...group.items, node] } : group));
}
/** Replace a condition (by id) with fn(condition). */
export function updateConditionNode<Op extends string>(root: ConditionGroup<Op>, id: string, fn: (condition: Condition<Op>) => Condition<Op>): ConditionGroup<Op> {
  return mapGroups(root, (group) => ({ ...group, items: group.items.map((node) => (!isConditionGroup(node) && node.id === id ? fn(node) : node)) }));
}
/** And / or of one group. */
export function setConjunction<Op extends string>(root: ConditionGroup<Op>, groupId: string, conjunction: ConditionConjunction): ConditionGroup<Op> {
  return mapGroups(root, (group) => (group.id === groupId ? { ...group, conjunction } : group));
}
/** Remove a condition or a group; a nested group left empty goes too. */
export function removeConditionNode<Op extends string>(root: ConditionGroup<Op>, id: string): ConditionGroup<Op> {
  const prune = (group: ConditionGroup<Op>): ConditionGroup<Op> => ({
    ...group,
    items: group.items.flatMap((node): ConditionNode<Op>[] => {
      if (node.id === id) return [];
      if (!isConditionGroup(node)) return [node];
      const next = prune(node);
      return next.items.length ? [next] : [];
    }),
  });
  return prune(root);
}

/**
 * Evaluate a tree. `test` answers one condition: true / false, or null when the condition is not
 * active (incomplete, unknown field) and must be skipped. A group without active conditions is skipped
 * too; a root without any reads true (no filter).
 */
export function evaluateConditionTree<Op extends string>(group: ConditionGroup<Op>, test: (condition: Condition<Op>) => boolean | null): boolean {
  return evaluateGroup(group, test) ?? true;
}
function evaluateGroup<Op extends string>(group: ConditionGroup<Op>, test: (condition: Condition<Op>) => boolean | null): boolean | null {
  let seen = false;
  for (const node of group.items) {
    const result = isConditionGroup(node) ? evaluateGroup(node, test) : test(node);
    if (result === null) continue;
    seen = true;
    if (group.conjunction === "or" && result) return true;
    if (group.conjunction === "and" && !result) return false;
  }
  return seen ? group.conjunction === "and" : null;
}
/** The tree with only the conditions `keep` accepts; empty nested groups removed. */
export function pruneConditionTree<Op extends string>(group: ConditionGroup<Op>, keep: (condition: Condition<Op>) => boolean): ConditionGroup<Op> {
  return {
    ...group,
    items: group.items.flatMap((node): ConditionNode<Op>[] => {
      if (!isConditionGroup(node)) return keep(node) ? [node] : [];
      const next = pruneConditionTree(node, keep);
      return next.items.length ? [next] : [];
    }),
  };
}
/**
 * SQL of a tree: `leaf` turns one condition into a boolean expression (null = skip). Groups with more
 * than one part are parenthesized; "" = no condition. Values never go into the text — `leaf` binds them.
 */
export function conditionTreeSql<Op extends string>(group: ConditionGroup<Op>, leaf: (condition: Condition<Op>) => string | null): string {
  const parts = group.items.map((node) => (isConditionGroup(node) ? conditionTreeSql(node, leaf) : leaf(node))).filter((part): part is string => Boolean(part));
  if (parts.length <= 1) return parts[0] ?? "";
  return `(${parts.join(group.conjunction === "or" ? " OR " : " AND ")})`;
}
/** Same tree regardless of ids (for 「你调整了这个视图」 and query keys). */
export function conditionTreeKey(group: ConditionGroup<string>): string {
  const node = (n: ConditionNode<string>): unknown => (isConditionGroup(n) ? [n.conjunction, n.items.map(node)] : [n.field, n.op, n.value ?? null]);
  return JSON.stringify(node(group));
}
/** Uses a dynamic or relative value somewhere (results depend on who looks and when). */
export function conditionTreeIsContextual(group: ConditionGroup<string>): boolean {
  return flattenConditions(group).some((c) => isDynamicValue(c.value) || isRelativeDate(c.value));
}

/**
 * Read a stored tree: drops what is not a condition / group, unknown fields (`kindOf` returns
 * undefined), operators that do not fit, bad values and groups deeper than `maxDepth`; keeps at most
 * `maxConditions`. Incomplete conditions stay (the user may be typing). Ids are kept or made unique.
 */
export function normalizeConditionTree(input: unknown, kindOf: (field: string) => ConditionKind | undefined, limits: Partial<ConditionLimits> = {}): ConditionGroup {
  const maxDepth = limits.maxDepth ?? CONDITION_LIMITS.maxDepth;
  let budget = limits.maxConditions ?? CONDITION_LIMITS.maxConditions;
  const used = new Set<string>();
  const uid = (raw: unknown, prefix: string) => {
    let id = typeof raw === "string" && raw && raw.length <= 64 && !used.has(raw) ? raw : "";
    for (let n = 1; !id; n++) if (!used.has(`${prefix}${n}`)) id = `${prefix}${n}`;
    used.add(id);
    return id;
  };
  const group = (source: Record<string, unknown>, depth: number, isRoot: boolean): ConditionGroup => {
    const id = isRoot ? (used.add("root"), "root") : uid(source.id, "g");
    const items: ConditionNode[] = [];
    for (const item of Array.isArray(source.items) ? source.items : []) {
      if (!isRecord(item)) continue;
      if (Array.isArray(item.items)) {
        if (depth + 1 > maxDepth) continue;
        const child = group(item, depth + 1, false);
        if (child.items.length) items.push(child);
        continue;
      }
      if (budget <= 0 || typeof item.field !== "string") continue;
      const kind = kindOf(item.field);
      const op = item.op as ConditionOp;
      if (!kind || !CONDITION_OPS[kind].includes(op)) continue;
      const value = VALUELESS_OPS.has(op) || !isConditionValue(item.value) ? undefined : item.value;
      budget--;
      items.push({ id: uid(item.id, "f"), field: item.field, op, ...(value === undefined ? {} : { value }) });
    }
    return { id, conjunction: source.conjunction === "or" ? "or" : "and", items };
  };
  return group(isRecord(input) ? input : {}, 0, true);
}
/** A flat legacy list (`filters` + one `conjunction`) as a tree. */
export function conditionTreeFromList<Op extends string>(conditions: readonly Condition<Op>[], conjunction: ConditionConjunction = "and"): ConditionGroup<Op> {
  return { id: "root", conjunction, items: [...conditions] };
}
/** The flat list a tree is equal to, or null when it has nested groups. */
export function conditionTreeToList<Op extends string>(group: ConditionGroup<Op>): { conditions: Condition<Op>[]; conjunction: ConditionConjunction } | null {
  if (group.items.some(isConditionGroup)) return null;
  return { conditions: group.items as Condition<Op>[], conjunction: group.conjunction };
}
