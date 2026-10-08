"use client";
/**
 * Condition tree editor (bt/grid-a G3, D04) shared by the filter panel and the
 * colour rules: rows 「当 / 且 / 或 · 字段 · 条件 · 值 · ×」, nested group boxes with their own 全部满足 /
 * 任一满足, value editors per field kind — option tags (MultiChoice), people with 「我」 on top, stars for
 * ratings, dates with relative ranges (今天、过去 7 天、未来 7 天、本月 …), a specific day or a fixed range,
 * money with its currency. Unfinished rows say 「先不生效」, a number that is not a number is red.
 * Edits the tree as a whole (`onChange(tree)`); rules live in condition-core.ts and grid-core.ts.
 */
import { useState } from "react";
import { Calendar, CalendarDays } from "lucide-react";
import { Input } from "./primitives.tsx";
import { Choice, type SelectItem } from "./select.tsx";
import { NumberStepper, Rating } from "./atoms.tsx";
import { DatePicker } from "./date-picker.tsx";
import { DateRangePicker } from "./date-range-picker.tsx";
import { gridConditionKind } from "./grid-view-v2.ts";
import { ConditionTreeEditor } from "./condition-editor.tsx";
import { ConditionValuePicker } from "./condition-value-picker.tsx";
import {
  CONDITION_DYNAMIC_TOKENS,
  RELATIVE_DATE_TOKENS,
  canAddConditionGroup,
  conditionOpLabel,
  flattenConditions,
  isConditionComplete,
  isDateRange,
  isDay,
  isRelativeDate,
  relativeDateLabel,
  todayIn,
  VALUELESS_OPS,
  type ConditionLimits,
  type DynamicToken,
  type RelativeDateToken,
} from "./condition-core.ts";
import { gridFilterOps, patchGridFilter, type GridField, type GridFilter, type GridFilterGroup, type GridFilterOp, type GridFilterValue, type GridSelectOption } from "./grid-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export type GridConditionTreeProps<T> = {
  /** Fields that can be filtered (restricted ones are shown locked in the picker). */
  fields: readonly GridField<T>[];
  tree: GridFilterGroup;
  onChange: (tree: GridFilterGroup) => void;
  limits: ConditionLimits;
  /** Choices of user fields (default: none — free text). */
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  /** Dynamic values offered for people fields (default 「我（当前用户）」「我的下属」). */
  dynamicTokens?: readonly DynamicToken[];
  /** Time zone of 「今天」 for new fixed ranges. */
  timeZone?: string;
  /** 「添加条件 / 添加条件组」 under the tree (bt/builders-a; the filter panel keeps them in its footer). */
  rootActions?: boolean;
};

const isNumberText = (value: unknown) => typeof value === "number" || (typeof value === "string" && Number.isFinite(Number(value.replace(/,/g, "").trim())));

/** Condition id → message for values that can never work (a number box with letters in it). */
export function gridConditionErrors<T>(tree: GridFilterGroup, fields: readonly GridField<T>[]): Record<string, string> {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const out: Record<string, string> = {};
  for (const condition of flattenConditions(tree)) {
    const field = byKey.get(condition.field);
    if (!field || VALUELESS_OPS.has(condition.op)) continue;
    const kind = gridConditionKind(field as GridField<unknown>);
    const value = condition.value;
    if (kind === "number" && typeof value === "string" && value.trim() !== "" && !isNumberText(value)) out[condition.id] = "这里要填数字";
  }
  return out;
}

/**
 * Rows of a condition tree (the root's conjunction row, conditions, nested groups) — the generic
 * ConditionTreeEditor (condition-editor.tsx) with grid fields, grid operators and the grid value editors.
 */
export function GridConditionTree<T>({ fields, tree, onChange, limits, valueOptions, dynamicTokens = CONDITION_DYNAMIC_TOKENS, timeZone, rootActions = false }: GridConditionTreeProps<T>) {
  const opsOf = (field: GridField<T>) => gridFilterOps(field as GridField<unknown>);
  return (
    <ConditionTreeEditor<GridFilterOp, GridField<T>>
      fields={fields}
      tree={tree}
      onChange={onChange}
      limits={limits}
      rootActions={rootActions}
      errors={gridConditionErrors(tree, fields)}
      isComplete={(condition, field) => field !== undefined && isConditionComplete(gridConditionKind(field as GridField<unknown>), condition.op, condition.value)}
      operators={(field) => opsOf(field).map((op) => ({ value: op, label: conditionOpLabel(op, gridConditionKind(field as GridField<unknown>)) }))}
      createCondition={(field, id) => ({ id, field: field.key, op: opsOf(field)[0] ?? "is" })}
      patchCondition={(current, id, patch) => patchGridFilter(current, id, patch, fields)}
      renderValue={({ field, condition, onChange: set }) =>
        field ? <ConditionValue field={field} filter={condition} people={valueOptions?.[field.key]} dynamicTokens={dynamicTokens} timeZone={timeZone} onChange={set} /> : null}
    />
  );
}
/** Can the root take another condition / group (for the panel's footer buttons). */
export const canAddRootGroup = (tree: GridFilterGroup, limits: ConditionLimits) => canAddConditionGroup(tree, tree.id, limits);

/** Value editor of one condition, by the field's kind. */
export function ConditionValue<T>({ field, filter, onChange, people, dynamicTokens = CONDITION_DYNAMIC_TOKENS, timeZone }: {
  field: GridField<T>;
  filter: GridFilter;
  onChange: (value: GridFilterValue | undefined) => void;
  people?: readonly GridSelectOption[];
  dynamicTokens?: readonly DynamicToken[];
  timeZone?: string;
}) {
  if (VALUELESS_OPS.has(filter.op)) return null;
  const kind = gridConditionKind(field);
  const value = filter.value;
  if (kind === "select" || kind === "multi" || kind === "user") {
    const choices = kind === "user" ? people ?? [] : field.options ?? [];
    if (!choices.length && kind !== "user") return <TextValue value={value} onChange={onChange} list />;
    return <ConditionValuePicker value={value} choices={choices} tokens={kind === "user" ? dynamicTokens : []} neutral={kind === "user"} onChange={onChange} />;
  }
  if (kind === "date") return <DateValue op={filter.op} value={value} onChange={onChange} timeZone={field.timeZone ?? timeZone} />;
  if (kind === "rating") {
    const max = (field as { max?: number }).max ?? 5;
    const n = typeof value === "number" ? value : typeof value === "string" && value ? Number(value) : null;
    return (
      <span className="aui-grid-cond-rating">
        <Rating label="筛选评分" max={max} value={n} onChange={(v) => onChange(v === null ? undefined : v)} size="md" />
        {n !== null && <span className="aui-grid-cond-hint">{n} 分</span>}
      </span>
    );
  }
  if (kind === "number") return field.type === "money" ? <MoneyValue currency={field.currency ?? ""} value={value} onChange={onChange} /> : <Input size="sm" aria-label="筛选值" inputMode="decimal" placeholder="输入数字" value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} />;
  return <TextValue value={value} onChange={onChange} />;
}

/** Amount in major units with the field's currency in front; thousands separators while not typing. */
function MoneyValue({ currency, value, onChange }: { currency: string; value: GridFilterValue | undefined; onChange: (value: GridFilterValue) => void }) {
  const [typing, setTyping] = useState(false);
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const shown = !typing && raw !== "" && isNumberText(raw) ? Number(raw).toLocaleString("en-US", { maximumFractionDigits: 2 }) : raw;
  return (
    <Input size="sm" aria-label="筛选值" inputMode="decimal" placeholder="输入金额" value={shown} segment={currency ? <span className="aui-input-seg">{currency}</span> : undefined}
      onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onChange={(e) => onChange(e.target.value.replace(/,/g, ""))} />
  );
}

function TextValue({ value, onChange, list }: { value: GridFilterValue | undefined; onChange: (value: GridFilterValue) => void; list?: boolean }) {
  const text = Array.isArray(value) ? value.join("，") : typeof value === "string" || typeof value === "number" ? String(value) : "";
  return <Input size="sm" aria-label="筛选值" placeholder={list ? "多个用逗号分隔" : "输入值"} value={text} onChange={(e) => onChange(list ? e.target.value.split(/[,，]/).map((v) => v.trim()).filter(Boolean) : e.target.value)} />;
}

type DateMode = "day" | "range" | RelativeDateToken;
/** Relative ranges in the order people reach for them (过去 / 未来 N 天 right after the days). */
const DATE_TOKENS: readonly RelativeDateToken[] = ["today", "yesterday", "tomorrow", "pastDays", "nextDays", "thisWeek", "lastWeek", "nextWeek", "thisMonth", "lastMonth", "nextMonth", "thisYear"];

/** Options of the date mode select: relative ranges, 具体日期 and (for 在范围内) 自定义范围. */
export function dateModeOptions(ranged: boolean, days = 7): SelectItem[] {
  const tokens = DATE_TOKENS.filter((token) => RELATIVE_DATE_TOKENS.includes(token));
  return [
    ...tokens.map((token): SelectItem => ({ value: token, label: relativeDateLabel(token === "pastDays" || token === "nextDays" ? { relative: token, days } : { relative: token }), icon: <Calendar /> })),
    { value: "day", label: "具体日期…", icon: <CalendarDays /> },
    ...(ranged ? [{ value: "range", label: "自定义范围…", icon: <CalendarDays /> }] : []),
  ];
}

/** A relative range (今天 / 过去 7 天 / 本月 …), a specific day or, for 在范围内, a fixed range. */
function DateValue({ op, value, onChange, timeZone }: { op: GridFilter["op"]; value: GridFilterValue | undefined; onChange: (value: GridFilterValue) => void; timeZone?: string }) {
  const ranged = op === "inRange" || op === "notInRange";
  const mode: DateMode = isRelativeDate(value) ? value.relative : isDateRange(value) ? "range" : "day";
  const days = isRelativeDate(value) ? value.days ?? 7 : 7;
  const today = todayIn({ timeZone });
  const setMode = (next: string) => {
    if (next === "day") onChange(isDay(value) ? value : "");
    else if (next === "range") onChange(isDateRange(value) ? value : { from: today, to: today });
    else onChange(next === "pastDays" || next === "nextDays" ? { relative: next, days } : { relative: next as RelativeDateToken });
  };
  const unset = value === undefined || value === null;
  return (
    <span className="aui-grid-cond-date">
      <Choice size="sm" label="日期范围" placeholder="选择日期" value={unset ? "" : mode} options={dateModeOptions(ranged, days)} onChange={setMode} />
      {mode === "day" && !unset && <DatePicker size="sm" aria-label="筛选日期" value={typeof value === "string" ? value : ""} onChange={onChange} />}
      {(mode === "pastDays" || mode === "nextDays") && isRelativeDate(value) && (
        <NumberStepper label="天数" unit="天" min={1} max={3650} value={days} onChange={(n) => onChange({ relative: mode, days: Math.max(1, Math.min(3650, Math.round(n ?? 1))) })} />
      )}
      {mode === "range" && isDateRange(value) && (
        <DateRangePicker size="sm" aria-label="筛选日期范围" months={1} value={value} onChange={(next) => { if (isDay(next.from) && isDay(next.to)) onChange(next); }} />
      )}
    </span>
  );
}
