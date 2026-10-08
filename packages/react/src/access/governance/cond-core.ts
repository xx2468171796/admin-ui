/**
 * Conditions for share / restriction rules: Chinese text for any Cond tree, structural validation
 * (empty and / or / in are errors — a lost condition must never read as「everything」), and the
 * builder model for the rule editors: rows (field / operator / value) joined by AND or OR, plus nested
 * groups with their own AND / OR (bt/builders-a P1). The editor itself works on the condition-core
 * tree (`condDraftToTree` / `treeToCondDraft`); a draft without `groups` is the old flat shape.
 * Pure: no React / DOM. The server validates again with its own field whitelist.
 */
import {
  COND_LIKE_LABEL,
  COND_OP_LABEL,
  COND_REF_LABEL,
  type Cond,
  type CondFieldDef,
  type CondFieldType,
  type CondOp,
  type CondRef,
  type CondRefName,
  type CondScalar,
} from "./contracts.ts";
import { isConditionGroup, isDynamicValue, type Condition, type ConditionGroup } from "../../condition-core.ts";

const REF_NAMES = Object.keys(COND_REF_LABEL) as CondRefName[];
const isRef = (v: unknown): v is CondRef => !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as CondRef).ref === "string";

/** Field label lookup for condToText. */
export type CondLabels = {
  field?: (id: string) => string | undefined;
  /** Display value of a literal (enum label, user name …). */
  value?: (field: string, value: CondScalar) => string | undefined;
};

/** Labels from the editor's field definitions (enum options become value labels). */
export function condLabelsFrom(fields: readonly CondFieldDef[]): CondLabels {
  const byId = new Map(fields.map((f) => [f.id, f]));
  return {
    field: (id) => byId.get(id)?.label,
    value: (field, value) => byId.get(field)?.options?.find((o) => o.value === String(value))?.label,
  };
}

function valueText(field: string, value: unknown, labels: CondLabels): string {
  if (isRef(value)) return COND_REF_LABEL[value.ref] ?? value.ref;
  if (Array.isArray(value)) return `（${value.map((v) => valueText(field, v, labels)).join("、")}）`;
  if (typeof value === "boolean") return labels.value?.(field, value) ?? (value ? "是" : "否");
  if (typeof value === "string" || typeof value === "number") return labels.value?.(field, value) ?? `「${value}」`;
  if (value instanceof Date) return `「${value.toISOString()}」`;
  return String(value);
}

/**
 * Chinese text of a condition, e.g.「状态 等于「VIP」 且 负责人 等于 当前用户」. Nested groups with a
 * different joiner get parentheses. Unknown shapes become「（无法识别的条件）」instead of throwing.
 */
export function condToText(cond: Cond, labels: CondLabels = {}): string {
  return textOf(cond, labels, null);
}
function textOf(c: Cond, labels: CondLabels, parent: "and" | "or" | null): string {
  if (!c || typeof c !== "object") return "（无法识别的条件）";
  if ("all" in c) return "全部记录";
  if ("none" in c) return "没有记录";
  if ("unknown" in c) return "未知（按拒绝处理）";
  if ("not" in c) return `不满足（${textOf(c.not, labels, null)}）`;
  if ("and" in c || "or" in c) {
    const join = "and" in c ? "and" : "or";
    const parts = ("and" in c ? c.and : (c as { or: readonly Cond[] }).or) ?? [];
    if (!parts.length) return join === "and" ? "（空的「全部满足」条件）" : "（空的「任一满足」条件）";
    const text = parts.map((p) => textOf(p, labels, join)).join(join === "and" ? " 且 " : " 或 ");
    return parent && parent !== join && parts.length > 1 ? `（${text}）` : text;
  }
  if ("exists" in c) return `关联「${c.exists.rel}」中存在满足（${textOf(c.exists.where, labels, null)}）的记录`;
  if (!("field" in c)) return "（无法识别的条件）";
  const field = labels.field?.(c.field) ?? c.field;
  if ("in" in c && !("op" in c)) return `${field} 属于 ${valueText(c.field, c.in, labels)}`;
  const op = (c as { op: CondOp }).op;
  if (op === "isNull" || op === "notNull") return `${field} ${COND_OP_LABEL[op]}`;
  const value = (c as { value: unknown }).value;
  if (op === "like") {
    const match = (c as { match?: keyof typeof COND_LIKE_LABEL }).match ?? "contains";
    return `${field} ${COND_LIKE_LABEL[match]} ${valueText(c.field, value, labels)}`;
  }
  return `${field} ${COND_OP_LABEL[op] ?? op} ${valueText(c.field, value, labels)}`;
}

/** Structural problems of a condition tree (empty and / or / in lists, missing fields, bad operators). [] = valid. */
export function validateCond(cond: Cond): string[] {
  const problems: string[] = [];
  const walk = (c: Cond, path: string) => {
    if (!c || typeof c !== "object") return void problems.push(`${path}：不是条件`);
    if ("all" in c || "none" in c || "unknown" in c) return;
    if ("not" in c) return walk(c.not, `${path}.not`);
    if ("and" in c || "or" in c) {
      const list = "and" in c ? c.and : (c as { or: readonly Cond[] }).or;
      if (!Array.isArray(list) || !list.length) return void problems.push(`${path}：「${"and" in c ? "全部满足" : "任一满足"}」里没有条件`);
      list.forEach((p, i) => walk(p, `${path}[${i}]`));
      return;
    }
    if ("exists" in c) return walk(c.exists.where, `${path}.exists`);
    if (!("field" in c) || !c.field) return void problems.push(`${path}：缺少字段`);
    if ("in" in c && !("op" in c)) {
      if (!Array.isArray(c.in) || !c.in.length) problems.push(`${path}：「属于」的值列表是空的`);
      return;
    }
    const op = (c as { op: string }).op;
    if (!(op in COND_OP_LABEL)) return void problems.push(`${path}：不认识的运算「${op}」`);
    if (op === "isNull" || op === "notNull") return;
    const value = (c as { value: unknown }).value;
    if (value === undefined || value === null || value === "") problems.push(`${path}：缺少值`);
    else if ((op === "in" || op === "nin") && !isRef(value) && (!Array.isArray(value) || !value.length)) problems.push(`${path}：「${COND_OP_LABEL[op as CondOp]}」的值列表是空的`);
  };
  walk(cond, "条件");
  return problems;
}

// ---- Builder model ------------------------------------------------------------------------

/** Where a row's value comes from: typed literal text or an attribute of the current person. */
export type CondValueSource = "literal" | CondRefName;
export type CondRow = {
  id: string;
  field: string;
  op: CondOp;
  source: CondValueSource;
  /** Raw text; for in / nin a list separated by , ，、 or new lines. */
  value: string;
};
/**
 * Builder model: rows joined by `join`, then nested groups (each a draft with its own join). Drafts
 * stored before nesting existed have no `groups` and still work everywhere.
 */
export type CondDraft = { join: "and" | "or"; rows: CondRow[]; groups?: CondDraftGroup[] };
export type CondDraftGroup = CondDraft & { id: string };

/** Operators offered per field type (like only for text; ranges for numbers / times / text). */
export const OPS_FOR_TYPE: Readonly<Record<CondFieldType, readonly CondOp[]>> = {
  id: ["eq", "ne", "in", "nin", "isNull", "notNull"],
  string: ["eq", "ne", "in", "nin", "like", "isNull", "notNull"],
  number: ["eq", "ne", "lt", "lte", "gt", "gte", "in", "nin", "isNull", "notNull"],
  boolean: ["eq", "ne", "isNull", "notNull"],
  timestamp: ["lt", "lte", "gt", "gte", "isNull", "notNull"],
};
/** Value sources that make sense per type (refs bind to the current person / time). */
export const REFS_FOR_TYPE: Readonly<Record<CondFieldType, readonly CondRefName[]>> = {
  id: ["userId", "deptId", "deptIds", "deptTreeIds", "groupIds", "postIds", "subordinateIds", "tenantId"],
  string: ["userId", "deptId", "deptIds", "deptTreeIds", "tenantId"],
  number: [],
  boolean: [],
  timestamp: ["now"],
};
/** Refs that stand for a list (only with in / nin). */
const LIST_REFS: ReadonlySet<CondRefName> = new Set(["deptIds", "deptTreeIds", "groupIds", "postIds", "subordinateIds"]);
export const isListRef = (ref: CondRefName) => LIST_REFS.has(ref);

let rowSeq = 0;
/** A fresh row with the field's first operator (ids are only for React keys). */
export function newCondRow(fields: readonly CondFieldDef[], field?: string): CondRow {
  const def = fields.find((f) => f.id === field) ?? fields[0];
  return { id: `r${++rowSeq}`, field: def?.id ?? "", op: def ? OPS_FOR_TYPE[def.type][0]! : "eq", source: "literal", value: "" };
}
export const emptyCondDraft = (fields: readonly CondFieldDef[]): CondDraft => ({ join: "and", rows: [newCondRow(fields)] });

/** Split an in / nin text into values; trims and drops empty pieces. */
export function splitList(text: string): string[] {
  return text
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function literalText(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (value instanceof Date) return value.toISOString();
  return value === undefined || value === null ? "" : String(value);
}
function rowFromAtom(c: Cond): CondRow | null {
  if (!c || typeof c !== "object" || !("field" in c)) return null;
  if ("in" in c && !("op" in c)) return { id: `r${++rowSeq}`, field: c.field, op: "in", source: "literal", value: literalText(c.in) };
  const op = (c as { op: CondOp }).op;
  if (!(op in COND_OP_LABEL)) return null;
  if (op === "like" && ((c as { match?: string }).match ?? "contains") !== "contains") return null;
  const value = (c as { value?: unknown }).value;
  if (isRef(value)) return { id: `r${++rowSeq}`, field: c.field, op, source: value.ref, value: "" };
  return { id: `r${++rowSeq}`, field: c.field, op, source: "literal", value: literalText(value) };
}

/**
 * Cond → builder draft. One condition, an and / or of conditions, and nested and / or groups (any
 * depth; the editor's limits only stop adding deeper ones). Shapes the builder can't edit (not,
 * exists, prefix / suffix like) return null — the editor then shows the text read-only and offers
 * 「清空重写」. Conditions come first, then groups (and / or don't depend on order).
 */
export function condToDraft(cond: Cond): CondDraft | null {
  if (!cond || typeof cond !== "object") return null;
  if ("and" in cond || "or" in cond) return groupFromCond(cond);
  const row = rowFromAtom(cond);
  return row ? { join: "and", rows: [row] } : null;
}
let groupSeq = 0;
function groupFromCond(cond: Cond): CondDraft | null {
  const join = "and" in cond ? "and" : "or";
  const list = ("and" in cond ? cond.and : (cond as { or: readonly Cond[] }).or) ?? [];
  if (!list.length) return null;
  const rows: CondRow[] = [];
  const groups: CondDraftGroup[] = [];
  for (const part of list) {
    if (part && typeof part === "object" && ("and" in part || "or" in part)) {
      const group = groupFromCond(part);
      if (!group) return null;
      groups.push({ ...group, id: `g${++groupSeq}` });
      continue;
    }
    const row = rowFromAtom(part);
    if (!row) return null;
    rows.push(row);
  }
  return groups.length ? { join, rows, groups } : { join, rows };
}

export type CondDraftResult = { ok: true; cond: Cond } | { ok: false; error?: string; rows: Record<string, string> };

function parseScalar(text: string, type: CondFieldType): CondScalar | Error {
  const t = text.trim();
  if (type === "number") {
    if (!/^-?\d+(\.\d+)?$/.test(t)) return new Error("要填数字");
    return Number(t);
  }
  if (type === "boolean") {
    if (["true", "是", "1"].includes(t)) return true;
    if (["false", "否", "0"].includes(t)) return false;
    return new Error("要选「是」或「否」");
  }
  if (type === "timestamp") {
    const at = Date.parse(t);
    if (!Number.isFinite(at)) return new Error("时间格式不对");
    return new Date(at).toISOString();
  }
  return t;
}

/**
 * Builder draft → Cond with validation: at least one condition (never an empty AND / OR), known field,
 * operator allowed for its type, value present (lists non-empty), numbers / booleans / times parse.
 * like keeps the text literally (% and _ match themselves). One condition in a group → that condition
 * alone; nested groups become nested and / or. Row errors are keyed by row id (any depth).
 */
export function draftToCond(draft: CondDraft, fields: readonly CondFieldDef[]): CondDraftResult {
  const rowsErr: Record<string, string> = {};
  if (!draft.rows.length && !draft.groups?.length) return { ok: false, error: "至少写一个条件（空条件不会被当成「全部」）", rows: rowsErr };
  const byId = new Map(fields.map((f) => [f.id, f]));
  let emptyGroup = false;
  const build = (group: CondDraft): Cond | null => {
    const atoms: Cond[] = [];
    for (const row of group.rows) {
      const atom = rowToAtom(row, byId, rowsErr);
      if (atom) atoms.push(atom);
    }
    for (const child of group.groups ?? []) {
      if (!child.rows.length && !child.groups?.length) {
        emptyGroup = true;
        continue;
      }
      const sub = build(child);
      if (sub) atoms.push(sub);
    }
    if (!atoms.length) return null;
    return atoms.length === 1 ? atoms[0]! : group.join === "and" ? { and: atoms } : { or: atoms };
  };
  const cond = build(draft);
  if (emptyGroup && !Object.keys(rowsErr).length) return { ok: false, error: "条件组里至少要有一个条件", rows: rowsErr };
  if (Object.keys(rowsErr).length || !cond) return { ok: false, rows: rowsErr };
  return { ok: true, cond };
}

function rowToAtom(row: CondRow, byId: ReadonlyMap<string, CondFieldDef>, rowsErr: Record<string, string>): Cond | null {
  const fail = (message: string) => {
    rowsErr[row.id] = message;
    return null;
  };
  const def = byId.get(row.field);
  if (!def) return fail("请选择字段");
  if (!OPS_FOR_TYPE[def.type].includes(row.op)) return fail(`「${def.label}」不能用「${COND_OP_LABEL[row.op]}」`);
  if (row.op === "isNull" || row.op === "notNull") return { field: def.id, op: row.op };
  const list = row.op === "in" || row.op === "nin";
  if (row.source !== "literal") {
    if (!REF_NAMES.includes(row.source) || !REFS_FOR_TYPE[def.type].includes(row.source)) return fail(`「${def.label}」不能和「${COND_REF_LABEL[row.source] ?? row.source}」比较`);
    if (isListRef(row.source) !== list)
      return fail(list ? `「${COND_OP_LABEL[row.op]}」要和一组值比较，请选「${COND_REF_LABEL.deptIds}」这类` : `「${COND_REF_LABEL[row.source]}」是一组值，请用「属于 / 不属于」`);
    const ref: CondRef = { ref: row.source };
    return list ? { field: def.id, op: row.op as "in" | "nin", value: ref } : row.op === "like" ? { field: def.id, op: "like", value: ref } : { field: def.id, op: row.op as "eq", value: ref };
  }
  if (list) {
    const parts = splitList(row.value);
    if (!parts.length) return fail("至少填一个值（多个值用逗号隔开）");
    const values: CondScalar[] = [];
    for (const p of parts) {
      const v = parseScalar(p, def.type);
      if (v instanceof Error) return fail(`「${p}」${v.message}`);
      values.push(v);
    }
    return { field: def.id, op: row.op as "in" | "nin", value: values };
  }
  if (!row.value.trim()) return fail("请填写值");
  // like: literal substring, keep the text as typed (the server escapes % _ and backslash).
  if (row.op === "like") return { field: def.id, op: "like", value: row.value.trim() };
  const v = parseScalar(row.value, def.type);
  return v instanceof Error ? fail(v.message) : { field: def.id, op: row.op as "eq", value: v };
}

/** Keep a row consistent after its field changed: reset an operator / ref the new type cannot use. */
export function retypeRow(row: CondRow, fields: readonly CondFieldDef[], field: string): CondRow {
  const def = fields.find((f) => f.id === field);
  if (!def) return { ...row, field };
  const ops = OPS_FOR_TYPE[def.type];
  const op = ops.includes(row.op) ? row.op : ops[0]!;
  const source = row.source === "literal" || REFS_FOR_TYPE[def.type].includes(row.source) ? row.source : "literal";
  return { ...row, field, op, source, value: def.options && !def.options.some((o) => o.value === row.value) ? "" : row.value };
}

/** Stable comparison key of a draft (ignores row / group ids): dirty / preview-stale detection. */
export function draftKey(draft: CondDraft | null): string {
  if (!draft) return "null";
  const key = (d: CondDraft): unknown[] => {
    const rows = d.rows.map((r) => [r.field, r.op, r.source, r.value.trim()]);
    return d.groups?.length ? [d.join, rows, d.groups.map(key)] : [d.join, rows];
  };
  return JSON.stringify(key(draft));
}

// ---- Draft <-> condition-core tree (the editor works on the tree) --------------------------

/** One builder row as a condition-core condition: a ref becomes a dynamic value `{ dynamic: ref }`. */
export function condRowToCondition(row: CondRow): Condition<CondOp> {
  return { id: row.id, field: row.field, op: row.op, value: row.source === "literal" ? row.value : { dynamic: row.source } };
}
/** A condition-core condition back as a builder row. */
export function conditionToCondRow(condition: Condition<CondOp>): CondRow {
  const value = condition.value;
  if (isDynamicValue(value)) return { id: condition.id, field: condition.field, op: condition.op, source: value.dynamic as CondRefName, value: "" };
  const text = Array.isArray(value) ? value.join(", ") : value === undefined || value === null ? "" : String(value);
  return { id: condition.id, field: condition.field, op: condition.op, source: "literal", value: text };
}
/** Draft → tree (rows first, then groups). */
export function condDraftToTree(draft: CondDraft, id = "root"): ConditionGroup<CondOp> {
  return { id, conjunction: draft.join, items: [...draft.rows.map(condRowToCondition), ...(draft.groups ?? []).map((g) => condDraftToTree(g, g.id))] };
}
/** Tree → draft; a draft without nested groups has no `groups` key (the old flat shape). */
export function treeToCondDraft(tree: ConditionGroup<CondOp>): CondDraft {
  const rows: CondRow[] = [];
  const groups: CondDraftGroup[] = [];
  for (const node of tree.items) {
    if (isConditionGroup(node)) groups.push({ ...treeToCondDraft(node), id: node.id });
    else rows.push(conditionToCondRow(node));
  }
  return groups.length ? { join: tree.conjunction, rows, groups } : { join: tree.conjunction, rows };
}
/** Conditions in a draft (all depths). */
export const countDraftRows = (draft: CondDraft): number => draft.rows.length + (draft.groups ?? []).reduce((n, g) => n + countDraftRows(g), 0);
