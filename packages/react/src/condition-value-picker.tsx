"use client";
/**
 * ConditionValuePicker (review 02 「条件编辑器」): the value box of a condition row for option
 * and people fields — the approved 28px dropdown (MultiChoice / Choice `size="sm"`): option values are
 * their coloured tags (removable, 「+N」 when they do not fit), people are avatar chips and the dynamic
 * values (「我」「我的下属」 …) sit at the top of the list. Picking a dynamic value replaces the list;
 * picking a person after it replaces the dynamic value.
 */
import { useMemo } from "react";
import { Users } from "lucide-react";
import { Choice, MultiChoice, type SelectItem } from "./select.tsx";
import { resolveOptionTone } from "./option-tone.ts";
import { isDynamicValue, type ConditionValue, type DynamicToken } from "./condition-core.ts";
import type { CellTagTone } from "./cells.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";

export type ConditionChoice = { value: string; label: string; tone?: CellTagTone; color?: string };
export type ConditionValuePickerProps = {
  /** Current value: a list (multiple), one value, or a dynamic token (「我」). */
  value: ConditionValue | undefined;
  choices: readonly ConditionChoice[];
  /** Dynamic values offered on top (「我（当前用户）」「我的下属」 …); picking one replaces the list. */
  tokens?: readonly DynamicToken[];
  onChange: (value: ConditionValue) => void;
  /** Pick several (default) or exactly one (the value is then a string). */
  multiple?: boolean;
  /** People: avatar chips instead of option colours. */
  neutral?: boolean;
  label?: string;
  disabled?: boolean;
};

/** Values of dynamic tokens inside the select (never a real option value). */
const TOKEN = "\u0000";
const tokenKey = (token: string) => `${TOKEN}${token}`;
const isTokenKey = (key: string) => key.startsWith(TOKEN);

/** 「我」 reads short in the box, with what it means as the grey hint in the list. */
function tokenItem(token: DynamicToken): SelectItem {
  if (token.token === "me") return { value: tokenKey(token.token), label: "我", avatar: "我", hint: "当前登录的人，随人变", keywords: token.label };
  return { value: tokenKey(token.token), label: token.label, icon: <Users />, tone: "gray" };
}

/** Select items: dynamic tokens first, then the choices (people as avatars, options as tags). */
export function conditionValueItems(choices: readonly ConditionChoice[], tokens: readonly DynamicToken[], neutral?: boolean): SelectItem[] {
  return [
    ...tokens.map(tokenItem),
    ...choices.map((c): SelectItem => (neutral ? { value: c.value, label: c.label, avatar: "" } : { value: c.value, label: c.label, tone: resolveOptionTone(c) })),
  ];
}

/**
 * The next condition value after the list changed in the select: a newly added dynamic token wins
 * (`{ dynamic }`), otherwise the plain values without tokens.
 */
export function nextConditionValue(previous: readonly string[], next: readonly string[]): ConditionValue {
  const added = next.find((key) => !previous.includes(key) && isTokenKey(key));
  if (added) return { dynamic: added.slice(TOKEN.length) };
  return next.filter((key) => !isTokenKey(key));
}

/** See the module comment. */
export function ConditionValuePicker({ value, choices, tokens = [], onChange, multiple = true, neutral, label = "筛选值", disabled }: ConditionValuePickerProps) {
  const items = useMemo(() => conditionValueItems(choices, tokens, neutral), [choices, tokens, neutral]);
  const dynamic = isDynamicValue(value) ? value.dynamic : null;
  const known = dynamic === null || items.some((item) => item.value === tokenKey(dynamic));
  // A token the host no longer offers still shows (its key) so the row is not silently empty.
  const options = known || dynamic === null ? items : [{ value: tokenKey(dynamic), label: dynamic, tone: "gray" }, ...items];
  if (!multiple) {
    const current = dynamic !== null ? tokenKey(dynamic) : typeof value === "string" ? value : "";
    return (
      <Choice size="sm" label={label} value={current} options={options} disabled={disabled} placeholder="选择值"
        onChange={(key) => onChange(isTokenKey(key) ? { dynamic: key.slice(TOKEN.length) } : key)} />
    );
  }
  const list = dynamic !== null ? [tokenKey(dynamic)] : Array.isArray(value) ? (value as readonly string[]) : typeof value === "string" && value ? [value] : [];
  return (
    <MultiChoice size="sm" label={label} value={list} options={options} disabled={disabled} placeholder="选择值" className="aui-grid-vpick"
      onChange={(next) => onChange(nextConditionValue(list, next))} />
  );
}
