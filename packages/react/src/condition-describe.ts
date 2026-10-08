/**
 * Plain-Chinese summary of a condition tree (bt/builders-b, A5 RuleList, D26): 「来源 = 官网 且 地区 是
 * 上海、杭州」, 「客户质量 = 低 或 客户质量 为空」, nested groups in 「（…）」. Works on the generic tree
 * from condition-core.ts and a light field list (GridField fits), so rule lists, permission
 * conditions, form display conditions and filter chips all read the same way. Pure, no React.
 *
 * `conditionTreeParts` gives the same thing as structured parts so a component can draw the values as
 * option chips (with their tones); `describeConditionTree` joins them into one string.
 */
import {
  conditionKindOf,
  conditionOpLabel,
  isConditionComplete,
  isConditionGroup,
  isDateRange,
  isDynamicValue,
  isRelativeDate,
  relativeDateLabel,
  CONDITION_DYNAMIC_TOKENS,
  VALUELESS_OPS,
  type Condition,
  type ConditionGroup,
  type ConditionKind,
  type ConditionOp,
  type ConditionValue,
  type DynamicToken,
} from "./condition-core.ts";
import type { GridFieldType } from "./grid-core.ts";
import type { GridFormulaResult } from "./grid-field-types.ts";
import { gridConditionKind } from "./grid-view-v2.ts";
import { resolveOptionTone, type OptionTone } from "./option-tone.ts";

/** What describing needs from a field: GridField<T> fits. `kind` wins over `type`. */
export type DescribeField = {
  key: string;
  title: string;
  type?: string;
  kind?: ConditionKind;
  /** formula: type of the computed value (conditions follow it, like the grid). */
  resultType?: string;
  /** Restricted fields (masked / permission-limited) and `filterable: false` ones cannot be filtered: their conditions are inactive. */
  restricted?: boolean | string;
  filterable?: boolean;
  options?: readonly { value: string; label: string; tone?: OptionTone | string; color?: string }[];
  /** money: currency shown before the amount (「US$ 50,000」; default none). */
  currency?: string;
};

/** One value in a summary: option values carry their label and tone. */
export type ConditionValuePart = { text: string; tone?: string };
export type ConditionLeafPart = {
  kind: "condition";
  id: string;
  field: string;
  /** Field title (or the key when the field is unknown). */
  fieldLabel: string;
  /** 「=」「是」「包含」「早于」「为空」… */
  opLabel: string;
  values: ConditionValuePart[];
  /** Field gone, not filterable (restricted / `filterable: false`) or condition incomplete: shown but ignored when the rule runs. */
  inactive: boolean;
};
export type ConditionGroupPart = { kind: "group"; id: string; conjunction: "and" | "or"; items: ConditionPart[] };
export type ConditionPart = ConditionLeafPart | ConditionGroupPart;

export type DescribeOptions = {
  /** Labels of dynamic tokens (default 「我（当前用户）」→ shown as 「我」, 「我的下属」). */
  dynamicTokens?: readonly DynamicToken[];
  /** Text of an empty tree, default 「所有记录」. */
  emptyText?: string;
  /** Separator between values of one condition, default 「、」. */
  valueSeparator?: string;
};

const SINGLE_SELECT_OPS: Partial<Record<ConditionOp, string>> = { anyOf: "=", noneOf: "≠" };

// Same kind the grid filters with (formula → its result type; extra types → their base type).
const kindOfField = (field: DescribeField | undefined): ConditionKind =>
  field?.kind ?? (field?.type ? gridConditionKind({ type: field.type as GridFieldType, resultType: field.resultType as GridFormulaResult | undefined }) : conditionKindOf("text"));
const dynamicLabel = (token: string, tokens: readonly DynamicToken[]) => {
  if (token === "me") return "我";
  return tokens.find((t) => t.token === token)?.label ?? token;
};

/** The values of one condition as display parts. */
export function conditionValueParts(condition: Condition<string>, field: DescribeField | undefined, options: DescribeOptions = {}): ConditionValuePart[] {
  const value = condition.value as ConditionValue | undefined;
  if (VALUELESS_OPS.has(condition.op as ConditionOp) || value === undefined || value === null) return [];
  const tokens = options.dynamicTokens ?? CONDITION_DYNAMIC_TOKENS;
  if (isDynamicValue(value)) return [{ text: dynamicLabel(value.dynamic, tokens) }];
  if (isRelativeDate(value)) return [{ text: relativeDateLabel(value) }];
  if (isDateRange(value)) return [{ text: value.from === value.to ? value.from : `${value.from} 至 ${value.to}` }];
  if (field?.type === "money" && (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))))) {
    return [{ text: `${field.currency ? `${field.currency} ` : ""}${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}` }];
  }
  const list = Array.isArray(value) ? (value as readonly string[]) : [value];
  return list.map((v) => {
    const text = String(v);
    const option = field?.options?.find((o) => o.value === text);
    return option ? { text: option.label, tone: resolveOptionTone(option) } : { text };
  });
}

/** Date operators that read 「在 / 不在」 before a relative range (「下次跟进 在未来 7 天」). */
const IN_RELATIVE: Partial<Record<ConditionOp, string>> = { is: "在", inRange: "在", notInRange: "不在" };

/**
 * Operator label of a condition: single-choice 「是」 reads 「=」 when one value is picked (「来源 = 展会」);
 * a date against a relative range reads 「在 / 不在」 (written without a space before the range).
 */
export function conditionOpText(condition: Condition<string>, field: DescribeField | undefined): string {
  const kind = kindOfField(field);
  const op = condition.op as ConditionOp;
  if (kind === "date" && isRelativeDate(condition.value) && IN_RELATIVE[op]) return IN_RELATIVE[op] ?? op;
  const count = Array.isArray(condition.value) ? condition.value.length : 1;
  if (kind === "select" && count === 1 && SINGLE_SELECT_OPS[op]) return SINGLE_SELECT_OPS[op] ?? op;
  return conditionOpLabel(op, kind);
}

/** The tree as structured parts (inactive conditions are kept and flagged). */
export function conditionTreeParts(tree: ConditionGroup<string>, fields: readonly DescribeField[], options: DescribeOptions = {}): ConditionGroupPart {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const walk = (group: ConditionGroup<string>): ConditionGroupPart => ({
    kind: "group",
    id: group.id,
    conjunction: group.conjunction,
    items: group.items.map((node): ConditionPart => {
      if (isConditionGroup(node)) return walk(node);
      const field = byKey.get(node.field);
      const kind = kindOfField(field);
      return {
        kind: "condition",
        id: node.id,
        field: node.field,
        fieldLabel: field?.title ?? node.field,
        opLabel: conditionOpText(node, field),
        values: conditionValueParts(node, field, options),
        inactive: !field || Boolean(field.restricted) || field.filterable === false || !isConditionComplete(kind, node.op as ConditionOp, node.value),
      };
    }),
  });
  return walk(tree);
}

/** Whether the operator and the value are written together (「在未来 7 天」). */
export const opJoinsValue = (opLabel: string) => opLabel === "在" || opLabel === "不在";

/** One condition as text: 「阶段 是 报价、谈判」「下次跟进 在未来 7 天」. */
export function conditionLeafText(part: ConditionLeafPart, separator = "、"): string {
  const values = part.values.map((v) => v.text).join(separator);
  const tail = opJoinsValue(part.opLabel) ? `${part.opLabel}${values}` : [part.opLabel, values].filter(Boolean).join(" ");
  return [part.fieldLabel, tail].filter(Boolean).join(" ");
}

/** 「且」 / 「或」. */
export const conjunctionWord = (conjunction: "and" | "or") => (conjunction === "or" ? "或" : "且");

/**
 * One line of plain Chinese: 「来源 = 官网 且 地区 是 上海、杭州」「阶段 是 报价、谈判 且 负责人 是 我
 * 且（下次跟进 在未来 7 天 或 预计金额 ≥ US$ 50,000）」; nested groups in full-width parentheses; incomplete conditions left out; an empty tree reads `emptyText` (「所有记录」).
 */
export function describeConditionTree(tree: ConditionGroup<string>, fields: readonly DescribeField[], options: DescribeOptions = {}): string {
  const sep = options.valueSeparator ?? "、";
  const leaf = (part: ConditionLeafPart) => conditionLeafText(part, sep);
  const group = (part: ConditionGroupPart, nested: boolean): string => {
    const items = part.items
      .filter((item) => (item.kind === "group" ? item.items.length > 0 : !item.inactive))
      .map((item) => (item.kind === "group" ? group(item, true) : leaf(item)))
      .filter(Boolean);
    // Full-width brackets need no space around them: 「负责人 是 我 且（…）」.
    const text = items.join(` ${conjunctionWord(part.conjunction)} `).replace(/ （/g, "（").replace(/） /g, "）");
    return nested && items.length > 1 ? `（${text}）` : text;
  };
  return group(conditionTreeParts(tree, fields, options), false) || (options.emptyText ?? "所有记录");
}
