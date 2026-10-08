/**
 * Pure rules of the dictionary / parameter pages: typed parameter editing (draft text ↔ value with the
 * same checks the server runs, so most mistakes are caught in the dialog), display text (secrets never
 * shown), grouping and change rows. The server validates again. No React / DOM.
 */
import { CONFIG_SECRET_MASK, PARAM_TYPE_LABEL, type DictItemDto, type ParamDto } from "./contracts.ts";

/** Editor state of one parameter: text for string / number / json / enum, a boolean for switches. */
export type ParamDraft = { text: string; on: boolean };

export function paramDraft(p: ParamDto): ParamDraft {
  if (p.secret) return { text: "", on: false };
  const v = p.value;
  if (p.type === "boolean") return { text: "", on: v === true };
  if (p.type === "json") return { text: v === undefined || v === null ? "" : JSON.stringify(v, null, 2), on: false };
  return { text: v === undefined || v === null ? "" : String(v), on: false };
}

/** Draft → value, or throw an Error with a Chinese reason (mirrors peizhi checkValue). */
export function parseParamDraft(p: Pick<ParamDto, "type" | "label" | "secret" | "options" | "min" | "max" | "integer" | "maxLength">, draft: ParamDraft): unknown {
  switch (p.type) {
    case "boolean":
      return draft.on;
    case "number": {
      const t = draft.text.trim();
      if (!t) throw new Error(`${p.label}：请填写数字`);
      if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) throw new Error(`${p.label}：「${t}」不是数字`);
      const n = Number(t);
      if (!Number.isFinite(n)) throw new Error(`${p.label}：数字太大`);
      if (p.integer && !Number.isInteger(n)) throw new Error(`${p.label}：要填整数`);
      if (p.min !== undefined && n < p.min) throw new Error(`${p.label}：不能小于 ${p.min}`);
      if (p.max !== undefined && n > p.max) throw new Error(`${p.label}：不能大于 ${p.max}`);
      return n;
    }
    case "enum": {
      if (!p.options?.includes(draft.text)) throw new Error(`${p.label}：请从选项里选`);
      return draft.text;
    }
    case "json": {
      const t = draft.text.trim();
      if (!t) throw new Error(`${p.label}：请填写 JSON`);
      try {
        return JSON.parse(t) as unknown;
      } catch (e) {
        throw new Error(`${p.label}：JSON 格式不对（${e instanceof Error ? e.message : String(e)}）`);
      }
    }
    default: {
      if (p.secret && !draft.text) throw new Error(`${p.label}：请填写新的值（原值看不到，只能整体替换）`);
      if (p.maxLength !== undefined && [...draft.text].length > p.maxLength) throw new Error(`${p.label}：最多 ${p.maxLength} 个字`);
      return draft.text;
    }
  }
}

/** Human display of a value. Secrets: 已设置 / 未设置 only. */
export function paramValueText(p: Pick<ParamDto, "type" | "secret" | "hasValue" | "optionLabels">, value: unknown): string {
  if (p.secret) return p.hasValue ? "已设置（隐藏）" : "未设置";
  if (value === null || value === undefined || value === "") return "（空）";
  if (value === CONFIG_SECRET_MASK) return "（已隐藏）";
  if (p.type === "boolean") return value === true ? "开" : "关";
  if (p.type === "enum") return p.optionLabels?.[String(value)] ?? String(value);
  if (p.type === "json") {
    const s = JSON.stringify(value);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  }
  return String(value);
}

/** Change rows for the save confirmation (字段 · 原值 → 新值 · 生效方式). */
export function paramChange(p: ParamDto, next: unknown) {
  return [
    {
      label: p.label,
      from: paramValueText(p, p.value),
      to: p.secret ? "新值（隐藏）" : paramValueText(p, next),
      effect: "保存后各进程下一次读取即生效",
    },
  ];
}

export const paramTypeLabel = (p: Pick<ParamDto, "type">) => PARAM_TYPE_LABEL[p.type] ?? p.type;

/** Group label for the grouped list (empty group =「其他」). */
export const paramGroup = (p: Pick<ParamDto, "group">) => p.group || "其他";

/** Built-in first by declaration order (server order), custom after; stable within a group. */
export function groupParams(params: readonly ParamDto[]): ParamDto[] {
  const order = new Map<string, number>();
  params.forEach((p) => {
    const g = paramGroup(p);
    if (!order.has(g)) order.set(g, order.size);
  });
  return params
    .map((p, i) => ({ p, i }))
    .sort((a, b) => order.get(paramGroup(a.p))! - order.get(paramGroup(b.p))! || a.i - b.i)
    .map((x) => x.p);
}

const DICT_CODE = /^[a-z][a-z0-9_]*(?:[.:-][a-z0-9_]+)*$/;
const PARAM_KEY = /^[A-Za-z][A-Za-z0-9_]*(?:[.:-][A-Za-z0-9_]+)*$/;

/** A custom parameter key (same rule as peizhi checkParamKey). */
export function checkParamKey(key: string): string | null {
  if (!key.trim()) return "请填写键";
  if (key.length > 128 || !PARAM_KEY.test(key)) return "键只能用字母、数字、下划线（段之间可用 . : -），字母开头，最长 128";
  return null;
}

/** A dictionary type code (same rule as peizhi checkDictCode). */
export function checkDictCode(code: string): string | null {
  if (!code.trim()) return "请填写类型码";
  if (code.length > 64 || !DICT_CODE.test(code)) return "类型码只能用小写字母、数字、下划线（段之间可用 . : -），字母开头，最长 64";
  return null;
}

/** A dictionary item value: what business tables store; no spaces, ≤ 100. */
export function checkItemValue(value: string): string | null {
  if (!value) return "请填写值";
  if (value.length > 100) return "值最长 100";
  if (/\s/.test(value)) return "值不能有空格";
  return null;
}

export function sortItems(items: readonly DictItemDto[]): DictItemDto[] {
  return [...items].sort((a, b) => a.sort - b.sort || a.value.localeCompare(b.value));
}
