/**
 * Pure model of BitableGrid (`@adminui/react/grid`): field values, the serializable view
 * (hidden / order / widths / sort / filters / group / search / row height / summaries), filter and
 * search predicates, sort and group keys, column summaries and row geometry. No React runtime, no
 * TanStack, no DOM: unit-tested in test/grid-core.test.ts.
 */
import type { ReactNode } from "react";
import type { Sort } from "./contracts.ts";
import type { CellTagTone } from "./cells.tsx";
import { formatNumber } from "./dashboard-core.ts";
import { formatDateTime, formatMinorMoney } from "./format.ts";
import { cellPadding, ROW_HEIGHT_PRESETS, rowLineBudget, type TableRowHeightPreset } from "./table-rows.ts";
// bt/grid-a: condition tree v2, multi-level grouping, field groups, colour rules
import {
  CONDITION_OP_LABELS,
  CONDITION_OPS,
  compareDay,
  conditionDayRange,
  conditionTreeFromList,
  evaluateConditionTree,
  flattenConditions,
  isConditionComplete,
  isConditionGroup,
  isDynamicValue,
  removeConditionNode,
  resolveDynamic,
  setConjunction,
  addConditionNode,
  canAddConditionGroup,
  nextConditionId,
  updateConditionNode,
  VALUELESS_OPS,
  type Condition,
  type ConditionContext,
  type ConditionGroup,
  type ConditionOp,
  type ConditionValue,
} from "./condition-core.ts";
import { GRID_HARD_LIMITS, gridConditionKind, normalizeColorRules, normalizeFieldGroups, normalizeGroupLevels, normalizeViewFilter, orderWithFieldGroups, type GridColorRule, type GridFieldGroup, type GroupLevel } from "./grid-view-v2.ts";
export type { GridColorRule, GridFieldGroup, GroupLevel, GridViewLimits } from "./grid-view-v2.ts";
// bt/grid-b: extra field types (rating, progress, phone, autoNumber, system fields, formula, attachment, link, lookup)
import { coreField, coreType, extraSummaryText, extraValueText, GRID_EXTRA_FIELD_TYPES, type GridCellTone, type GridExtraFieldType, type GridFormulaResult, type GridRecordRef } from "./grid-field-types.ts";

export type GridFieldType =
  | "text"
  | "longText"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "singleSelect"
  | "multiSelect"
  | "user"
  | "checkbox"
  | "url"
  | "email"
  | "custom"
  | GridExtraFieldType; // bt/grid-b
export const GRID_FIELD_TYPES: readonly GridFieldType[] = ["text", "longText", "number", "money", "date", "datetime", "singleSelect", "multiSelect", "user", "checkbox", "url", "email", "custom", ...GRID_EXTRA_FIELD_TYPES];

/**
 * One choice of a singleSelect / multiSelect field; its order is the sort and group order. Colour =
 * `tone`, one of the twenty option tones (green … gray, greenSolid … graySolid; option-tone.ts). `color` is a
 * stored colour name or hex (blue / 红色 / #7c3aed …) used only when `tone` is missing, mapped to the nearest
 * hue by `colorTone`; arbitrary CSS colours are never painted.
 */
export type GridSelectOption = { value: string; label: string; tone?: CellTagTone; color?: string };
export type GridPerson = { name: string; hint?: string; key?: string };

export type GridSummaryKind = "none" | "count" | "filled" | "empty" | "unique" | "sum" | "avg" | "min" | "max";
export const GRID_SUMMARY_KINDS: readonly GridSummaryKind[] = ["none", "count", "filled", "empty", "unique", "sum", "avg", "min", "max"];

export type GridCellContext = {
  /** The row is selected. */
  selected: boolean;
};
/**
 * A field (column) of the grid. Values are read with `value(row)` (default `row[key]`) and must have
 * the shape of the type: text / longText / url / email → string, number → number, money → minor
 * units (bigint, integer number or integer string; `currency` symbol, default none — BitableGrid fills it from AdminProvider `defaults.currency`), date / datetime →
 * ISO string / epoch ms / Date, singleSelect → option value, multiSelect → option values, user →
 * name / GridPerson / an array of them, checkbox → boolean, custom → anything (give `render` and
 * `text` for search / filter / sort).
 */
export type GridField<T> = {
  key: string;
  title: string;
  type: GridFieldType;
  /** The record's name field: always first, cannot be hidden, names the row for screen readers. */
  primary?: boolean;
  /** Default width in px (the user's dragged width in the view wins). */
  width?: number;
  /** Choices of singleSelect / multiSelect (order = sort and group order). */
  options?: readonly GridSelectOption[];
  /** Read the raw value (default `row[key]`). */
  value?: (row: T) => unknown;
  /** Plain text for search / filter / sort / grouping of custom fields (and an override for others). */
  text?: (row: T) => string;
  /** Cell content (default: the type's renderer, see GRID_CELL_RENDERERS). Clamped to the row height. */
  render?: (row: T, context: GridCellContext) => ReactNode;
  /** Full content in the expand-record dialog (default: `render` / the type renderer, unclamped). */
  detail?: (row: T) => ReactNode;
  /** Default summary shown in the bottom bar (the user's choice in the view wins). */
  summary?: GridSummaryKind;
  /** percent: the 56px bar before 「60%」 in the cell (default true; false = the text only). */
  percentBar?: boolean;
  /** money: currency symbol (default: AdminProvider `defaults.currency` inside BitableGrid, else none); value is in minor units (fen). */
  currency?: string;
  /**
   * Fraction digits shown. number: default up to 2. money: 0–2 (default 2) — cells, summaries and
   * typed input round to it (half away from zero); the value stays in minor units (237900000 with
   * precision 0 reads 「US$2,379,000」).
   */
  precision?: number;
  /** date / datetime: time zone for display, day filters and grouping (default: AdminProvider `defaults.timeZone`, else the runtime's). */
  timeZone?: string;
  /**
   * date / datetime: a due date (下次跟进, 到期). Form pickers (PublicForm / FormQuestionInput) then show 「周四 · 明天」 with
   * today / tomorrow in the attention colour and past days in the danger colour (DatePicker `deadline`).
   */
  deadline?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  /**
   * Users can edit the cell in place (and paste / clear / undo); needs BitableGrid `onCellsChange`.
   * A predicate decides per row (e.g. locked records). Custom fields also need `parse`.
   */
  editable?: boolean | ((row: T) => boolean);
  /** The record with this field set (default `{ ...row, [key]: value }`; required when `value` reads elsewhere). */
  write?: (row: T, value: unknown) => T;
  /** Typed / pasted text → value (default: by type, see parseFieldInput). */
  parse?: (text: string, row: T) => { ok: true; value: unknown } | { ok: false; error: string };
  /** Check a parsed value; return the message shown on the cell, or null. */
  validate?: (value: unknown, row: T) => string | null;
  /** Empty is not allowed (clear / paste of an empty value is refused). */
  required?: boolean;
  /** Placeholder of the editor. */
  placeholder?: string;
  // bt/grid-a
  /**
   * This user may not see every value of this field (masked / permission-limited): the field panel and
   * the filter field picker show a lock; a string is the reason. Filtering by it is not offered (no
   * guessing hidden values through filters). `locked` (bt/grid-b) only marks that restrictions exist.
   */
  restricted?: boolean | string;
  /** Title of the field group it starts in (field panel 「联系方式」); the user can regroup in the view. */
  group?: string;
  // bt/grid-b ----------------------------------------------------------------
  /** Header lock icon: the field has view / edit restrictions; a string is the tooltip (「技术、客服看不到」). */
  locked?: boolean | string;
  /** Header ⓘ: what the field means (tooltip, read by screen readers). */
  description?: string;
  /** Text tone of one cell, e.g. `(row) => overdue(row) ? "danger" : null` for a missed date. */
  tone?: (row: T) => GridCellTone | null | undefined;
  /** rating: number of stars (default 5). */
  max?: number;
  /** phone (and text): show the value masked (0755-***-456), or a function that masks it. */
  mask?: boolean | ((value: string) => string);
  /**
   * phone: the company's / table's country (「+86」, 「+44」 …). Numbers of this country read the local way 「138 0013 8000」,
   * others the international way without the trunk 0 「+44 7700 900123」. Not set: every number international.
   */
  phoneCountry?: string;
  /** Masked cells: load the full value (the host checks permission and writes the audit log). */
  onReveal?: (row: T) => string | Promise<string>;
  /** formula: type of the value the host computes (default text); filters / sort / summaries follow it. */
  resultType?: GridFormulaResult;
  /** link / lookup: open a linked record (chip click; default chips are plain text). */
  openRef?: (ref: GridRecordRef, row: T) => void;
  /** Edit with the host's own UI instead of the in-cell editor (record picker, upload drawer): Enter / double click / typing call it. */
  openEditor?: (row: T) => void;
  /** attachment: open file `index` (default: the built-in MediaLightbox). */
  openAttachment?: (row: T, index: number) => void;
  // ---------------------------------------------------------------- bt/grid-b
};

/** Filter operators (condition-core ConditionOp; inRange / notInRange take relative dates and ranges). */
export type GridFilterOp = ConditionOp;
/** A literal, a dynamic value (「我」) or a relative date / day range — see condition-core.ts. */
export type GridFilterValue = ConditionValue;
export type GridFilter = Condition<GridFilterOp>;
/** The filter of a view: conditions and nested groups, each group with its own and / or. */
export type GridFilterGroup = ConditionGroup<GridFilterOp>;

/**
 * The view: everything the user arranges, JSON-serializable so hosts can persist it per user
 * (useGridView → localStorage or their own store). Keys of fields that no longer exist are dropped
 * by normalizeGridView.
 */
export type GridView = {
  /** Hidden field keys (the primary field cannot be hidden). */
  hidden: string[];
  /** Field order (every field key once; the primary field first). */
  order: string[];
  /** Widths the user dragged, px. */
  widths: Record<string, number>;
  /** Multi-field sort, first = highest priority. */
  sort: Sort[];
  /**
   * Filter tree (bt/grid-a): the root group's conditions and groups combine with its `conjunction`.
   * Stored views with the old flat `filters` + `conjunction` are read into it by normalizeGridView.
   */
  filter: GridFilterGroup;
  /**
   * Group levels, outermost first (bt/grid-a; at most 3 in the UI by default). Stored views with the old
   * `groupBy: "stage"` string become `[{ field: "stage", order: "asc" }]`.
   */
  groupBy: GroupLevel[];
  /** Collapsed groups: path keys (gridGroupPathKey; level 1 = the group key itself). */
  collapsed: string[];
  /** Search text: every whitespace-separated term must appear in some visible field. */
  search: string;
  rowHeight: TableRowHeightPreset;
  /** Summary per field key for the bottom bar (also shown on group headers). */
  summary: Record<string, GridSummaryKind>;
  // bt/grid-a
  /** Show a group for every option even when no record has it (select / checkbox levels). */
  showEmptyGroups: boolean;
  /** Re-sort right after edits (default true); off keeps rows where they are until the sort changes. */
  autoSort: boolean;
  /** Field groups of the field panel (members stay adjacent in `order`). */
  fieldGroups: GridFieldGroup[];
  /** 填色 rules, first match wins. */
  colors: GridColorRule[];
  /** bt/grid-b: visible fields frozen after the row-number column (absent = BitableGrid `frozenColumns`). */
  frozen?: number;
};
/**
 * What normalizeGridView / useGridView defaults accept: a partial view, including the pre-v2 shapes
 * (`groupBy: "stage"`, flat `filters` + `conjunction`).
 */
export type GridViewInput = Partial<Omit<GridView, "groupBy">> & { groupBy?: string | null | readonly GroupLevel[]; filters?: readonly GridFilter[]; conjunction?: "and" | "or" };

export const GRID_MIN_WIDTH = 60;
export const GRID_MAX_WIDTH = 800;
export const GRID_DEFAULT_WIDTH = 160;
export const GRID_VIEW_VERSION = 1;

export const GRID_FILTER_LABELS: Readonly<Record<GridFilterOp, string>> = CONDITION_OP_LABELS;
/** Conditions offered per field type (first = default); from the type's condition kind. */
export const GRID_FILTER_OPS: Readonly<Record<GridFieldType, readonly GridFilterOp[]>> = Object.fromEntries(
  GRID_FIELD_TYPES.map((type) => [type, CONDITION_OPS[gridConditionKind({ type })]]),
) as Record<GridFieldType, readonly GridFilterOp[]>;
/** Ops that need no value. */
const VALUELESS = VALUELESS_OPS;

/** Summary kinds offered per field type (none first). */
export function summaryKindsFor(input: GridFieldType | Pick<GridField<unknown>, "type" | "resultType">): readonly GridSummaryKind[] {
  const type = coreType(input); // bt/grid-b
  if (type === "number" || type === "money") return GRID_SUMMARY_KINDS;
  if (type === "date" || type === "datetime") return ["none", "count", "filled", "empty", "unique", "min", "max"];
  if (type === "checkbox") return ["none", "count", "filled", "empty"];
  return ["none", "count", "filled", "empty", "unique"];
}
/** Chinese label of a summary kind (checkbox reads 已勾选 / 未勾选). */
export function summaryLabel(kind: GridSummaryKind, type: GridFieldType): string {
  if (type === "checkbox" && kind === "filled") return "已勾选";
  if (type === "checkbox" && kind === "empty") return "未勾选";
  if ((type === "date" || type === "datetime") && kind === "min") return "最早";
  if ((type === "date" || type === "datetime") && kind === "max") return "最晚";
  return ({ none: "不统计", count: "记录数", filled: "已填写", empty: "未填写", unique: "唯一值", sum: "求和", avg: "平均值", min: "最小值", max: "最大值" } as const)[kind];
}

// ---------------------------------------------------------------- values

/** The raw value of a field. */
export function readField<T>(field: Pick<GridField<T>, "key" | "value">, row: T): unknown {
  return field.value ? field.value(row) : (row as Record<string, unknown>)[field.key];
}

/** Minor units of a money value; null for empty / invalid (non-integer numbers are rejected). */
export function toMinor(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return Number.isSafeInteger(value) ? BigInt(value) : null;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  return null;
}
/** "12.5" (major units, e.g. 元) → 1250n; null when not a plain decimal. */
export function majorToMinor(text: string, digits = 2): bigint | null {
  const match = /^\s*(-)?(\d+)(?:\.(\d*))?\s*$/.exec(text);
  if (!match) return null;
  const fraction = (match[3] ?? "").slice(0, digits).padEnd(digits, "0");
  const minor = BigInt(match[2]! + fraction);
  return match[1] ? -minor : minor;
}
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};
const toTime = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  const time = date?.getTime();
  return time === undefined || Number.isNaN(time) ? null : time;
};
const toStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v !== "") : typeof value === "string" && value !== "" ? [value] : [];
/** user values as people: a name, a GridPerson, or an array of either. */
export function toPeople(value: unknown): GridPerson[] {
  const list = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value];
  return list.flatMap((item): GridPerson[] =>
    typeof item === "string" ? (item ? [{ name: item }] : []) : item && typeof item === "object" && typeof (item as GridPerson).name === "string" && (item as GridPerson).name ? [item as GridPerson] : []);
}
const optionIndex = (field: Pick<GridField<unknown>, "options">, value: string) => field.options?.findIndex((option) => option.value === value) ?? -1;
/** Label of a select value (unknown values show as themselves). */
export function optionLabel(field: Pick<GridField<unknown>, "options">, value: string): string {
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

/** Empty = nothing filled in (checkbox: unchecked). */
export function isEmptyValue(type: GridFieldType, value: unknown): boolean {
  switch (coreType(type)) { // bt/grid-b
    case "number":
      return toNumber(value) === null;
    case "money":
      return toMinor(value) === null;
    case "date":
    case "datetime":
      return toTime(value) === null;
    case "multiSelect":
      return toStrings(value).length === 0;
    case "user":
      return toPeople(value).length === 0;
    case "checkbox":
      return value !== true;
    default:
      return value === null || value === undefined || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
  }
}

/** Plain text of a field value: search, filters on text, unique counts, CSV-like display. */
export function fieldText<T>(field: GridField<T>, row: T): string {
  if (field.text) return field.text(row);
  return valueText(field, readField(field, row));
}
/** Plain text of a raw value of the field's type. */
export function valueText<T>(field: GridField<T>, value: unknown): string {
  const extra = extraValueText(field, value); // bt/grid-b
  if (extra !== undefined) return extra;
  field = coreField(field);
  if (isEmptyValue(field.type, value)) return field.type === "checkbox" ? "否" : "";
  switch (field.type) {
    case "number":
      return formatNumber(toNumber(value), { digits: field.precision ?? 2 });
    case "money":
      return formatMinorMoney(toMinor(value), { symbol: field.currency ?? "", digits: field.precision });
    case "date":
      return formatDateTime(value as string, { timeZone: field.timeZone }) ?? "";
    case "datetime":
      return formatDateTime(value as string, { time: true, timeZone: field.timeZone }) ?? "";
    case "singleSelect":
      return toStrings(value).map((v) => optionLabel(field, v)).join("、");
    case "multiSelect":
      return toStrings(value).map((v) => optionLabel(field, v)).join("、");
    case "user":
      return toPeople(value).map((p) => p.name).join("、");
    case "checkbox":
      return "是";
    default:
      return typeof value === "string" ? value : typeof value === "number" || typeof value === "bigint" || typeof value === "boolean" ? String(value) : "";
  }
}

/**
 * Comparable key of a value: number / bigint / string, or undefined when empty (empties always sort
 * last, in either direction). Selects sort by option order, people / tags by their text.
 */
export function sortKey<T>(field: GridField<T>, row: T): number | bigint | string | undefined {
  field = coreField(field); // bt/grid-b
  const value = readField(field, row);
  if (field.text && field.type === "custom") return field.text(row) || undefined;
  if (isEmptyValue(field.type, value)) return field.type === "checkbox" ? 0 : undefined;
  switch (field.type) {
    case "number":
      return toNumber(value)!;
    case "money":
      return toMinor(value)!;
    case "date":
    case "datetime":
      return toTime(value)!;
    case "checkbox":
      return 1;
    case "singleSelect": {
      const index = optionIndex(field, toStrings(value)[0] ?? "");
      return index >= 0 ? index : 100000;
    }
    case "multiSelect":
      return toStrings(value).map((v) => { const i = optionIndex(field, v); return String(i >= 0 ? i : 99999).padStart(5, "0"); }).join(",");
    default:
      return fieldText(field, row) || undefined;
  }
}
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
/** Compare two sort keys (empties handled by the caller). */
export function compareSortKeys(a: number | bigint | string | undefined, b: number | bigint | string | undefined): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1;
  if (typeof a === "string" || typeof b === "string") return collator.compare(String(a), String(b));
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Group key of a row for a field: "" for empty; days for dates; option value for single selects. */
export function gridGroupKey<T>(field: GridField<T>, row: T): string {
  field = coreField(field); // bt/grid-b
  const value = readField(field, row);
  if (field.type === "checkbox") return value === true ? "true" : "false";
  if (field.type === "custom") return field.text ? field.text(row) : "";
  if (isEmptyValue(field.type, value)) return "";
  if (field.type === "date" || field.type === "datetime") return formatDateTime(value as string, { timeZone: field.timeZone }) ?? "";
  if (field.type === "singleSelect") return toStrings(value)[0] ?? "";
  if (field.type === "multiSelect") return toStrings(value).join("\u0001");
  if (field.type === "user") return toPeople(value).map((p) => p.name).join("\u0001");
  return fieldText(field, row);
}
/** Sort key of a group (option order for selects, value order otherwise; empty group last). */
export function gridGroupSortKey<T>(field: GridField<T>, row: T): number | bigint | string | undefined {
  field = coreField(field); // bt/grid-b
  if (field.type === "date" || field.type === "datetime") return gridGroupKey(field, row) || undefined;
  return sortKey(field, row);
}
/** Human label of a group key. */
export function gridGroupLabel<T>(field: GridField<T>, key: string): string {
  field = coreField(field); // bt/grid-b
  if (field.type === "checkbox") return key === "true" ? "已勾选" : "未勾选";
  if (key === "") return "（空）";
  if (field.type === "singleSelect") return optionLabel(field, key);
  if (field.type === "multiSelect") return key.split("\u0001").map((v) => optionLabel(field, v)).join("、");
  if (field.type === "user") return key.split("\u0001").join("、");
  return key;
}

// ---------------------------------------------------------------- filters & search

/**
 * A condition takes part only once it is complete (「包含」 with an empty value, a list with nothing
 * ticked, 「过去 0 天」 are ignored) and its field can be filtered (restricted fields cannot).
 */
export function isFilterActive<T>(filter: GridFilter, field: GridField<T> | undefined): boolean {
  if (!field || field.filterable === false || field.restricted || (field.type === "custom" && !field.text) || !gridFilterOps(field).includes(filter.op)) return false;
  return isConditionComplete(gridConditionKind(field), filter.op, filter.value);
}

const lower = (text: string) => text.toLocaleLowerCase("zh-CN");
const NUMBER_CMP: Partial<Record<GridFilterOp, (cmp: number) => boolean>> = { eq: (c) => c === 0, neq: (c) => c !== 0, gt: (c) => c > 0, gte: (c) => c >= 0, lt: (c) => c < 0, lte: (c) => c <= 0 };
/**
 * Does one row match one (active) condition. Dynamic values (「我」) are resolved by `context.resolve`
 * (unresolved = no match); relative dates use today in the field's time zone and `context.weekStart`.
 */
export function matchesFilter<T>(field: GridField<T>, row: T, filter: GridFilter, context: ConditionContext = {}): boolean {
  const kind = gridConditionKind(field);
  field = coreField(field); // bt/grid-b: extra types follow their base type
  const raw = readField(field, row);
  const empty = field.type === "custom" ? fieldText(field, row).trim() === "" : isEmptyValue(field.type, raw);
  if (filter.op === "empty") return empty;
  if (filter.op === "notEmpty") return !empty;
  if (filter.op === "checked") return raw === true;
  if (filter.op === "unchecked") return raw !== true;
  let value = filter.value;
  if (isDynamicValue(value)) {
    const resolved = resolveDynamic(value, context);
    if (!resolved) return false;
    value = resolved;
  }
  const list = Array.isArray(value) ? (value as readonly string[]) : value === null || value === undefined ? [] : [String(value)];
  switch (kind) {
    case "number":
    case "rating": {
      const test = NUMBER_CMP[filter.op];
      if (!test) return false;
      if (empty) return filter.op === "neq";
      let cmp: number;
      if (field.type === "money") {
        const target = majorToMinor(String(value));
        if (target === null) return false;
        const left = toMinor(raw)!;
        cmp = left < target ? -1 : left > target ? 1 : 0;
      } else {
        const target = toNumber(value);
        const left = toNumber(raw);
        if (target === null || left === null) return false;
        cmp = left < target ? -1 : left > target ? 1 : 0;
      }
      return test(cmp);
    }
    case "date": {
      const range = conditionDayRange(value as ConditionValue, { ...context, timeZone: field.timeZone ?? context.timeZone });
      if (!range) return false;
      if (empty) return filter.op === "notInRange";
      const day = formatDateTime(raw as string, { timeZone: field.timeZone });
      return day ? compareDay(day, filter.op, range) : false;
    }
    case "select": {
      const current = toStrings(raw)[0];
      const hit = current !== undefined && list.includes(current);
      return filter.op === "anyOf" ? hit : filter.op === "noneOf" ? !hit : false;
    }
    case "multi":
    case "user": {
      const have = field.type === "user" ? toPeople(raw).flatMap((p) => (p.key ? [p.name, p.key] : [p.name])) : toStrings(raw);
      // An empty list (dynamic value resolved to nothing) matches no row for hasAll, like the SQL side.
      return filter.op === "hasAny" ? list.some((v) => have.includes(v)) : filter.op === "hasAll" ? list.length > 0 && list.every((v) => have.includes(v)) : filter.op === "hasNone" ? !list.some((v) => have.includes(v)) : false;
    }
    default: {
      const text = lower(fieldText(field, row));
      if (Array.isArray(value)) {
        // A dynamic value on a text field: 「等于」 any of the resolved values.
        const targets = list.map((v) => lower(v.trim()));
        return filter.op === "is" ? targets.includes(text) : filter.op === "isNot" ? !targets.includes(text) : false;
      }
      const target = lower(String(value).trim());
      return filter.op === "contains" ? text.includes(target) : filter.op === "notContains" ? !text.includes(target) : filter.op === "is" ? text === target : filter.op === "isNot" ? text !== target : false;
    }
  }
}

/** Search terms (whitespace separated, lower-cased); empty = no search. */
export const searchTerms = (search: string) => lower(search).split(/\s+/).filter(Boolean);

/** Filter input of filterGridRows / activeFilterCount: the v2 tree, or the legacy flat list. */
export type GridFilterSource = { filter?: GridFilterGroup; filters?: readonly GridFilter[]; conjunction?: "and" | "or" };
/** The filter tree of a view (legacy `filters` + `conjunction` read as a flat root group). */
export function gridFilterTree(view: GridFilterSource): GridFilterGroup {
  if (view.filter && isConditionGroup(view.filter)) return view.filter;
  return conditionTreeFromList(view.filters ?? [], view.conjunction === "or" ? "or" : "and");
}

/**
 * Rows matching the view's search and filters, in input order. Search looks in the visible fields;
 * every term must appear in some visible field. The filter tree combines per group with its and / or;
 * incomplete conditions (and groups left without any) are ignored. `context` resolves 「我」 and
 * relative dates (see condition-core ConditionContext).
 */
export function filterGridRows<T>(rows: readonly T[], fields: readonly GridField<T>[], view: GridFilterSource & Pick<GridView, "search" | "hidden">, context: ConditionContext = {}): T[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const tree = gridFilterTree(view);
  const active = flattenConditions(tree).some((filter) => isFilterActive(filter, byKey.get(filter.field)));
  const terms = searchTerms(view.search);
  const searchable = fields.filter((field) => !view.hidden.includes(field.key));
  if (!active && !terms.length) return rows.slice();
  const texts = terms.length ? searchTexts(fields, searchable) : null;
  return rows.filter((row) => {
    if (active) {
      const test = (filter: GridFilter) => {
        const field = byKey.get(filter.field);
        return field && isFilterActive(filter, field) ? matchesFilter(field, row, filter, context) : null;
      };
      if (!evaluateConditionTree(tree, test)) return false;
    }
    if (texts) {
      const haystack = texts(row);
      if (!terms.every((term) => haystack.includes(term))) return false;
    }
    return true;
  });
}

// Search text of a row (its searchable fields, lower-cased, joined by a separator no term contains),
// cached per row object and field set: repeated searches over the same rows (typing, server blocks)
// format each cell once. Edited rows are new objects, so they are re-read.
const SEARCH_CACHE = new WeakMap<readonly unknown[], Map<string, WeakMap<object, string>>>();
function searchTexts<T>(fields: readonly GridField<T>[], searchable: readonly GridField<T>[]) {
  let byFields = SEARCH_CACHE.get(fields);
  if (!byFields) SEARCH_CACHE.set(fields, (byFields = new Map()));
  const key = searchable.map((field) => field.key).join("");
  let cache = byFields.get(key);
  if (!cache) byFields.set(key, (cache = new WeakMap()));
  const rows = cache;
  return (row: T): string => {
    const box = typeof row === "object" && row !== null ? (row as object) : null;
    const hit = box ? rows.get(box) : undefined;
    if (hit !== undefined) return hit;
    const text = searchable.map((field) => lower(fieldText(field, row))).join(" ");
    if (box) rows.set(box, text);
    return text;
  };
}

// ---------------------------------------------------------------- summaries

export type GridSummary = { kind: GridSummaryKind; label: string; value: string | number | bigint | null; text: string };
const roundDiv = (sum: bigint, count: bigint) => {
  const negative = sum < 0n;
  const abs = negative ? -sum : sum;
  const q = (abs * 2n + count) / (count * 2n);
  return negative ? -q : q;
};
/**
 * Statistic of one field over rows (all filtered rows, not only the rendered window). Money sums in
 * bigint minor units (exact); averages round half away from zero. Empty values are skipped by sum /
 * avg / min / max; `count` is the number of records.
 */
export function summarizeField<T>(field: GridField<T>, rows: readonly T[], kind: GridSummaryKind): GridSummary {
  const source = field; // bt/grid-b
  field = coreField(field);
  const label = summaryLabel(kind, field.type);
  const done = (value: GridSummary["value"], text: string): GridSummary => ({ kind, label, value, text });
  if (kind === "none") return done(null, "");
  if (kind === "count") return done(rows.length, formatNumber(rows.length));
  const values = rows.map((row) => readField(field, row));
  const isEmpty = (value: unknown, row: T) => (field.type === "custom" ? fieldText(field, row).trim() === "" : isEmptyValue(field.type, value));
  if (kind === "filled" || kind === "empty") {
    const filled = values.filter((value, i) => !isEmpty(value, rows[i]!)).length;
    const n = kind === "filled" ? filled : rows.length - filled;
    return done(n, formatNumber(n));
  }
  if (kind === "unique") {
    const seen = new Set<string>();
    rows.forEach((row, i) => { if (!isEmpty(values[i], row)) seen.add(field.type === "user" || field.type === "multiSelect" ? gridGroupKey(field, row) : lower(fieldText(field, row))); });
    return done(seen.size, formatNumber(seen.size));
  }
  if (field.type === "money") {
    const minors = values.map(toMinor).filter((v): v is bigint => v !== null);
    if (!minors.length) return done(null, "—");
    const sum = minors.reduce((s, v) => s + v, 0n);
    const result = kind === "sum" ? sum : kind === "avg" ? roundDiv(sum, BigInt(minors.length)) : minors.reduce((m, v) => (kind === "min" ? (v < m ? v : m) : v > m ? v : m));
    return done(result, formatMinorMoney(result, { symbol: field.currency ?? "", digits: field.precision }));
  }
  if (field.type === "number") {
    const numbers = values.map(toNumber).filter((v): v is number => v !== null);
    if (!numbers.length) return done(null, "—");
    const sum = numbers.reduce((s, v) => s + v, 0);
    const result = kind === "sum" ? sum : kind === "avg" ? sum / numbers.length : kind === "min" ? Math.min(...numbers) : Math.max(...numbers);
    const digits = kind === "avg" ? Math.max(field.precision ?? 2, 2) : field.precision ?? 2;
    return done(result, extraSummaryText(source, formatNumber(result, { digits }))); // bt/grid-b: progress %
  }
  if ((field.type === "date" || field.type === "datetime") && (kind === "min" || kind === "max")) {
    const times = values.map(toTime).filter((v): v is number => v !== null);
    if (!times.length) return done(null, "—");
    const result = kind === "min" ? Math.min(...times) : Math.max(...times);
    return done(result, formatDateTime(result, { time: field.type === "datetime", timeZone: field.timeZone }) ?? "—");
  }
  return done(null, "—");
}

// ---------------------------------------------------------------- view

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isPreset = (value: unknown): value is TableRowHeightPreset => typeof value === "string" && Object.hasOwn(ROW_HEIGHT_PRESETS, value);
const clampWidth = (width: number) => Math.round(Math.min(GRID_MAX_WIDTH, Math.max(GRID_MIN_WIDTH, width)));

/** Primary field: the one marked `primary`, else the first. */
export function primaryField<T>(fields: readonly GridField<T>[]): GridField<T> | undefined {
  return fields.find((field) => field.primary) ?? fields[0];
}

/**
 * A complete, valid view for these fields from anything (a partial default, a stored JSON value of an
 * older field list): unknown keys dropped, new fields appended to the order, the primary field first
 * and visible, widths clamped to 60–800px, sorts / filters / group on fields that allow them.
 */
export function normalizeGridView<T>(input: unknown, fields: readonly GridField<T>[], defaults: { rowHeight?: TableRowHeightPreset } = {}): GridView {
  const source = isRecord(input) ? input : {};
  const keys = fields.map((field) => field.key);
  const has = (key: unknown): key is string => typeof key === "string" && keys.includes(key);
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const primary = primaryField(fields)?.key;
  const stored = Array.isArray(source.order) ? source.order.filter(has) : [];
  const order = [...new Set([...stored, ...keys])];
  if (primary) order.splice(0, order.length, primary, ...order.filter((key) => key !== primary));
  const hidden = Array.isArray(source.hidden) ? [...new Set(source.hidden.filter(has))].filter((key) => key !== primary) : [];
  const widths: Record<string, number> = {};
  if (isRecord(source.widths)) for (const [key, width] of Object.entries(source.widths)) if (has(key) && typeof width === "number" && Number.isFinite(width)) widths[key] = clampWidth(width);
  const sortable = (key: string) => byKey.get(key)?.sortable !== false && (byKey.get(key)?.type !== "custom" || Boolean(byKey.get(key)?.text));
  const sort: Sort[] = [];
  if (Array.isArray(source.sort))
    for (const item of source.sort)
      if (isRecord(item) && has(item.key) && sortable(item.key) && (item.direction === "asc" || item.direction === "desc") && !sort.some((s) => s.key === item.key)) sort.push({ key: item.key, direction: item.direction });
  // bt/grid-a: filter tree (legacy flat filters migrate), group levels (legacy string migrates), field groups, colours.
  const filter = normalizeViewFilter(source, fields);
  const groupBy = normalizeGroupLevels(source.groupBy, fields);
  const collapsed = groupBy.length && Array.isArray(source.collapsed) ? [...new Set(source.collapsed.filter((key): key is string => typeof key === "string"))] : [];
  const fieldGroups = normalizeFieldGroups(source.fieldGroups, fields, primary);
  const colors = normalizeColorRules(source.colors, fields);
  const summary: Record<string, GridSummaryKind> = {};
  for (const field of fields) if (field.summary && field.summary !== "none" && summaryKindsFor(field).includes(field.summary)) summary[field.key] = field.summary;
  if (isRecord(source.summary))
    for (const [key, kind] of Object.entries(source.summary))
      if (has(key) && summaryKindsFor(byKey.get(key)!).includes(kind as GridSummaryKind)) {
        if (kind === "none") delete summary[key];
        else summary[key] = kind as GridSummaryKind;
      }
  return {
    hidden,
    order: orderWithFieldGroups(order, fieldGroups),
    widths,
    sort,
    filter,
    groupBy,
    collapsed,
    search: typeof source.search === "string" ? source.search.slice(0, 200) : "",
    rowHeight: isPreset(source.rowHeight) ? source.rowHeight : defaults.rowHeight ?? "short",
    summary,
    showEmptyGroups: source.showEmptyGroups === true,
    autoSort: source.autoSort !== false,
    fieldGroups,
    colors,
    ...normalizeFrozen(source.frozen, fields.length), // bt/grid-b
  };
}

/** Stored form of a view: `{ v: 1, view }` JSON (only the view, never row data). */
export function serializeGridView(view: GridView): string {
  return JSON.stringify({ v: GRID_VIEW_VERSION, view });
}
/** Read a stored view for the current fields; null when missing or unreadable (use defaults). */
export function parseGridView<T>(text: string | null | undefined, fields: readonly GridField<T>[], defaults?: { rowHeight?: TableRowHeightPreset }): GridView | null {
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || data.v !== GRID_VIEW_VERSION || !isRecord(data.view)) return null;
    return normalizeGridView(data.view, fields, defaults);
  } catch {
    return null;
  }
}

/** Every change the toolbar, headers and summary bar make to a view. */
export type GridViewAction =
  | { type: "toggleHidden"; key: string; hidden?: boolean }
  | { type: "showAll" }
  | { type: "move"; key: string; to: number }
  /** Drag-and-drop: put `key` right before `before` (null = at the end). */
  | { type: "moveBefore"; key: string; before: string | null }
  /** Move one place among the visible fields (column menu 左移 / 右移, field list ↑ / ↓). */
  | { type: "shift"; key: string; delta: -1 | 1; visibleOnly?: boolean }
  | { type: "resize"; key: string; width: number }
  | { type: "setSort"; sort: readonly Sort[] }
  | { type: "sortBy"; key: string; direction: "asc" | "desc" | null }
  /** Add a condition on `field` to a group (default: the top level). */
  | { type: "addFilter"; field: string; group?: string }
  /** Add a nested group (one condition on `field`) to a group (default: the top level), within the depth limit. */
  | { type: "addFilterGroup"; field: string; group?: string }
  | { type: "updateFilter"; id: string; patch: Partial<Omit<GridFilter, "id">> }
  /** Remove a condition or a whole group. */
  | { type: "removeFilter"; id: string }
  | { type: "clearFilters" }
  /** And / or of a group (default: the top level). */
  | { type: "conjunction"; value: "and" | "or"; group?: string }
  | { type: "setFilter"; filter: GridFilterGroup }
  /** One level (null = no grouping); kept for header menus. */
  | { type: "groupBy"; key: string | null }
  // bt/grid-a
  | { type: "setGroups"; levels: readonly GroupLevel[] }
  | { type: "showEmptyGroups"; value: boolean }
  | { type: "autoSort"; value: boolean }
  /** Hide / show several fields at once (全部隐藏, a field group's eye); the primary field stays visible. */
  | { type: "setHidden"; keys: readonly string[]; hidden: boolean }
  /** The field panel after a drag: new column order and field groups. */
  | { type: "setFieldLayout"; order: readonly string[]; fieldGroups: readonly GridFieldGroup[] }
  | { type: "addFieldGroup"; id: string; title: string; fields?: readonly string[] }
  | { type: "removeFieldGroup"; id: string }
  | { type: "setColors"; rules: readonly GridColorRule[] }
  | { type: "toggleGroup"; key: string }
  | { type: "setCollapsed"; keys: readonly string[] }
  | { type: "search"; value: string }
  | { type: "rowHeight"; value: TableRowHeightPreset }
  | { type: "summary"; key: string; kind: GridSummaryKind }
  /** bt/grid-b: freeze the first `count` visible fields (null = back to the grid's default). */
  | { type: "freeze"; count: number | null };

/** Pure view reducer; the result is normalized for `fields`. */
export function gridViewReducer<T>(view: GridView, action: GridViewAction, fields: readonly GridField<T>[]): GridView {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  if (action.type === "freeze") return normalizeGridView({ ...view, frozen: action.count ?? undefined }, fields, { rowHeight: view.rowHeight }); // bt/grid-b
  const next = ((): unknown => {
    switch (action.type) {
      case "toggleHidden": {
        const hide = action.hidden ?? !view.hidden.includes(action.key);
        return { ...view, hidden: hide ? [...view.hidden, action.key] : view.hidden.filter((key) => key !== action.key) };
      }
      case "showAll":
        return { ...view, hidden: [] };
      case "move": {
        const order = view.order.filter((key) => key !== action.key);
        const to = Math.max(1, Math.min(order.length, Math.round(action.to)));
        order.splice(to, 0, action.key);
        return { ...view, order };
      }
      case "moveBefore": {
        if (action.before === action.key) return view;
        const order = view.order.filter((key) => key !== action.key);
        const at = action.before === null ? order.length : order.indexOf(action.before);
        order.splice(at < 0 ? order.length : at, 0, action.key);
        return { ...view, order };
      }
      case "shift": {
        const list = action.visibleOnly === false ? view.order : view.order.filter((key) => !view.hidden.includes(key));
        const index = list.indexOf(action.key);
        if (index < 0) return view;
        const target = list[index + action.delta];
        if (target === undefined) return view;
        const order = view.order.filter((key) => key !== action.key);
        const at = order.indexOf(target) + (action.delta > 0 ? 1 : 0);
        order.splice(at, 0, action.key);
        return { ...view, order };
      }
      case "resize":
        return { ...view, widths: { ...view.widths, [action.key]: clampWidth(action.width) } };
      case "setSort":
        return { ...view, sort: action.sort };
      case "sortBy": {
        const rest = view.sort.filter((s) => s.key !== action.key);
        return { ...view, sort: action.direction ? [{ key: action.key, direction: action.direction }, ...rest] : rest };
      }
      case "addFilter":
        return { ...view, filter: addGridFilter(view.filter, byKey.get(action.field), action.group) };
      case "addFilterGroup":
        return { ...view, filter: addGridFilterGroup(view.filter, byKey.get(action.field), action.group, { maxDepth: GRID_HARD_LIMITS.maxFilterDepth, maxConditions: GRID_HARD_LIMITS.maxConditions }) };
      case "updateFilter":
        return { ...view, filter: patchGridFilter(view.filter, action.id, action.patch, fields) };
      case "removeFilter":
        return { ...view, filter: removeConditionNode(view.filter, action.id) };
      case "clearFilters":
        return { ...view, filter: { ...view.filter, items: [] }, search: "" };
      case "conjunction":
        return { ...view, filter: setConjunction(view.filter, action.group ?? view.filter.id, action.value) };
      case "setFilter":
        return { ...view, filter: action.filter };
      case "groupBy":
        return { ...view, groupBy: action.key ? [{ field: action.key, order: "asc" }] : [], collapsed: [] };
      case "setGroups": {
        const same = action.levels.length === view.groupBy.length && action.levels.every((level, i) => level.field === view.groupBy[i]?.field);
        return { ...view, groupBy: action.levels, collapsed: same ? view.collapsed : [] };
      }
      case "showEmptyGroups":
        return { ...view, showEmptyGroups: action.value };
      case "autoSort":
        return { ...view, autoSort: action.value };
      case "setHidden": {
        const keys = new Set(action.keys);
        return { ...view, hidden: action.hidden ? [...new Set([...view.hidden, ...keys])] : view.hidden.filter((key) => !keys.has(key)) };
      }
      case "setFieldLayout":
        return { ...view, order: action.order, fieldGroups: action.fieldGroups };
      case "addFieldGroup": {
        const members = new Set(action.fields ?? []);
        return { ...view, fieldGroups: [...view.fieldGroups.map((g) => ({ ...g, fields: g.fields.filter((key) => !members.has(key)) })), { id: action.id, title: action.title, fields: [...members] }] };
      }
      case "removeFieldGroup":
        return { ...view, fieldGroups: view.fieldGroups.filter((group) => group.id !== action.id) };
      case "setColors":
        return { ...view, colors: action.rules };
      case "toggleGroup":
        return { ...view, collapsed: view.collapsed.includes(action.key) ? view.collapsed.filter((key) => key !== action.key) : [...view.collapsed, action.key] };
      case "setCollapsed":
        return { ...view, collapsed: [...new Set(action.keys)] };
      case "search":
        return { ...view, search: action.value };
      case "rowHeight":
        return { ...view, rowHeight: action.value };
      case "summary":
        return { ...view, summary: { ...view.summary, [action.key]: action.kind } };
    }
  })();
  return normalizeGridView(next, fields, { rowHeight: view.rowHeight });
}

// ---------------------------------------------------------------- filter tree editing (bt/grid-a)

/** The tree with a new condition on `field` (default operator, no value) in group `group` (default: top level). */
export function addGridFilter<T>(tree: GridFilterGroup, field: GridField<T> | undefined, group?: string): GridFilterGroup {
  if (!field) return tree;
  return addConditionNode(tree, group ?? tree.id, { id: nextConditionId(tree, "f"), field: field.key, op: gridFilterOps(field)[0]! });
}
/** The tree with a nested group (「任一满足」, one condition on `field`) in `group`, if the depth / count limits allow. */
export function addGridFilterGroup<T>(tree: GridFilterGroup, field: GridField<T> | undefined, group: string | undefined, limits: { maxDepth?: number; maxConditions?: number } = {}): GridFilterGroup {
  const parent = group ?? tree.id;
  if (!field || !canAddConditionGroup(tree, parent, limits)) return tree;
  const condition: GridFilter = { id: nextConditionId(tree, "f"), field: field.key, op: gridFilterOps(field)[0]! };
  return addConditionNode(tree, parent, { id: nextConditionId(tree, "g"), conjunction: "or", items: [condition] });
}
/**
 * Change one condition: a new field resets the operator and value; a new operator keeps a value that
 * still fits (a range or 「我」 that no longer fits is dropped); valueless operators drop the value.
 */
export function patchGridFilter<T>(tree: GridFilterGroup, id: string, patch: Partial<Omit<GridFilter, "id">>, fields: readonly GridField<T>[]): GridFilterGroup {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return updateConditionNode(tree, id, (filter) => {
    const merged: GridFilter = { ...filter, ...patch };
    const field = byKey.get(merged.field);
    if (!field) return filter;
    if (patch.field && patch.field !== filter.field) return { id: filter.id, field: field.key, op: gridFilterOps(field)[0]! };
    if (!gridFilterOps(field).includes(merged.op)) merged.op = gridFilterOps(field)[0]!;
    const value = merged.value;
    if (VALUELESS.has(merged.op)) delete merged.value;
    else if (value !== null && typeof value === "object" && !Array.isArray(value) && !isConditionComplete(gridConditionKind(field), merged.op, value)) delete merged.value;
    return merged;
  });
}

/** Active (complete) filter count, for the toolbar badge (every condition of the tree). */
export function activeFilterCount<T>(view: GridFilterSource, fields: readonly GridField<T>[]): number {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return flattenConditions(gridFilterTree(view)).filter((filter) => isFilterActive(filter, byKey.get(filter.field))).length;
}

// ---------------------------------------------------------------- geometry

/** Base line height of a grid cell at a font scale: max(20px, 17px × scale), same as DataTable. */
export const gridLineHeight = (fontScale = 1) => Math.max(20, 17 * fontScale);
/**
 * Fixed height of every data row: the preset (32 / 56 / 88 / 120), grown only when a large font
 * scale needs more room for the preset's line budget (same rule as DataTable), at least 44px on
 * phones. Every row of the grid has exactly this height.
 */
export function gridRowHeight(preset: TableRowHeightPreset, options: { fontScale?: number; touch?: boolean } = {}): number {
  const base = Math.max(ROW_HEIGHT_PRESETS[preset], options.touch ? 44 : 0);
  const lines = rowLineBudget(ROW_HEIGHT_PRESETS[preset]);
  const pad = options.touch ? Math.min(8, Math.max(0, (base - 40) / 2)) : cellPadding(base);
  return Math.ceil(Math.max(base, lines * gridLineHeight(options.fontScale) + 2 * pad));
}
/** Line budget of a preset (1 / 2 / 3 / 5): what Cell* clamp to. */
export const gridRowLines = (preset: TableRowHeightPreset) => rowLineBudget(ROW_HEIGHT_PRESETS[preset]);

/**
 * Widths of the frozen columns on a narrow screen: the frozen block (row-number column included)
 * never takes more than `share` of the visible width, so the scrolling part stays usable at 390px.
 */
export function fitFrozenWidths(widths: readonly number[], lead: number, available: number, share = 0.6): number[] {
  const budget = Math.max(0, available * share - lead);
  const total = widths.reduce((s, w) => s + w, 0);
  if (!available || total <= budget) return widths.slice();
  const ratio = budget / total;
  return widths.map((width) => Math.max(GRID_MIN_WIDTH + 20, Math.floor(width * ratio)));
}

/** Next active cell for a navigation key; null = key not handled. Rows/cols are 0-based, row -1 = header. */
export function moveGridCell(
  cell: { row: number; col: number },
  key: string,
  bounds: { rows: number; cols: number; page: number },
  modifiers: { ctrl?: boolean } = {},
): { row: number; col: number } | null {
  const lastRow = bounds.rows - 1;
  const lastCol = bounds.cols - 1;
  const clampRow = (row: number) => Math.max(-1, Math.min(lastRow, row));
  switch (key) {
    case "ArrowUp":
      return { row: clampRow(cell.row - 1), col: cell.col };
    case "ArrowDown":
      return { row: clampRow(cell.row + 1), col: cell.col };
    case "ArrowLeft":
      return { row: cell.row, col: Math.max(0, cell.col - 1) };
    case "ArrowRight":
      return { row: cell.row, col: Math.min(lastCol, cell.col + 1) };
    case "Home":
      return modifiers.ctrl ? { row: Math.min(0, lastRow), col: 0 } : { row: cell.row, col: 0 };
    case "End":
      return modifiers.ctrl ? { row: lastRow, col: lastCol } : { row: cell.row, col: lastCol };
    case "PageUp":
      return { row: clampRow(Math.max(cell.row < 0 ? -1 : 0, cell.row - bounds.page)), col: cell.col };
    case "PageDown":
      return { row: clampRow(cell.row + bounds.page), col: cell.col };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- bt/grid-b: extra types, freeze

/**
 * Conditions of one field (first = default): GRID_FILTER_OPS by type, with a formula following its
 * `resultType`. Use this rather than `GRID_FILTER_OPS[field.type]` (the condition model, the server
 * query parser and SQL all do).
 */
export function gridFilterOps(field: Pick<GridField<unknown>, "type" | "resultType">): readonly GridFilterOp[] {
  return CONDITION_OPS[gridConditionKind(field)]; // bt/grid-a: one operator table per condition kind
}
function normalizeFrozen(value: unknown, max: number): { frozen?: number } {
  return typeof value === "number" && Number.isFinite(value) ? { frozen: Math.max(0, Math.min(max, Math.floor(value))) } : {};
}
