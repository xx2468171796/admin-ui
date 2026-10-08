/**
 * Pure rules of the field dialog family (bt/records R1–R3, demo D12): the type tile catalogue the host
 * supplies, search over it, grid keyboard steps, option ids / tones and the draft validation. No React
 * runtime and no DOM: unit-tested in test/records-core.test.ts.
 */
import type { ReactNode } from "react";
import type { OptionHueTone, OptionTone } from "./option-tone.ts";

/**
 * One tile of FieldTypePicker. `value` is the host's type id; a tile without `value` (or with `later`)
 * is a type that is not built yet: dashed, not pickable, `later` says why / when (「B3」「等文件存储」).
 */
export type FieldTypeTile<V extends string = string> = {
  value?: V;
  label: string;
  /** Lucide icon element. */
  icon?: ReactNode;
  /** Extra search words (pinyin, English, synonyms). */
  keywords?: string;
  /** Not available yet: shown dashed with this reason as the tooltip. */
  later?: string;
  /** Group heading (「基础」「选择」…; default: from FIELD_TYPE_INFO by `value`, then by `label`). */
  group?: string;
  /** What the type stores, for the explanation card (default from FIELD_TYPE_INFO). */
  description?: string;
  /** How a value looks in the table (text or a node, e.g. a tag), for the explanation card. */
  example?: ReactNode;
};

/** Group order of the type picker; unknown groups follow in the order they appear. */
export const FIELD_TYPE_GROUPS = ["基础", "选择", "人与联系", "关联与计算", "系统自动"] as const;

/** Built-in description of a common field type: group, what it stores, an example cell. */
export type FieldTypeInfo = { label: string; group: string; description: string; example: string };
const info = (label: string, group: string, description: string, example: string): FieldTypeInfo => ({ label, group, description, example });
/**
 * Group / explanation of the common type ids (grid type names and their usual aliases), so a host's
 * tiles group themselves; a tile's own `group` / `description` / `example` win.
 */
export const FIELD_TYPE_INFO: Readonly<Record<string, FieldTypeInfo>> = {
  text: info("文本", "基础", "一行字：名称、地址", "赵静怡"),
  longText: info("多行文本", "基础", "大段文字：需求、备注", "三房两厅…"),
  number: info("数字", "基础", "数量、面积", "32"),
  money: info("货币", "基础", "带币种的金额", "US$ 86,000"),
  percent: info("百分比", "基础", "赢率、完成度", "60%"),
  date: info("日期", "基础", "日期或日期 + 时间", "10-08 周四"),
  datetime: info("日期时间", "基础", "日期 + 几点几分", "10-08 14:30"),
  checkbox: info("复选框", "基础", "是 / 否", "✓"),
  singleSelect: info("单选", "选择", "从几个选项里选一个，带颜色", "报价"),
  multiSelect: info("多选", "选择", "可以选好几个", "门锁、窗帘"),
  rating: info("评分", "选择", "1–5 星", "★★★★"),
  progress: info("进度", "选择", "0–100 的进度条", "60%"),
  user: info("人员", "人与联系", "公司里的人", "小王"),
  phone: info("电话", "人与联系", "带区号，自动查重", "138 0013 8000"),
  email: info("邮箱", "人与联系", "邮件地址，点一下就能写信", "lin@mail.com"),
  url: info("超链接", "人与联系", "网址，点一下打开", "line.me/…"),
  attachment: info("附件", "关联与计算", "文件、照片、录音", "3 个文件"),
  subTable: info("子表", "关联与计算", "一条记录下面的多行明细", "报价明细 4 行"),
  link: info("关联", "关联与计算", "连到另一张表的记录", "装机单 #12"),
  lookup: info("查找引用", "关联与计算", "把关联记录里的某个字段带过来", "装机日期"),
  rollup: info("汇总", "关联与计算", "把关联记录的数字加起来", "240,000"),
  count: info("计数", "关联与计算", "关联了几条", "3"),
  formula: info("公式", "关联与计算", "按别的字段算出来", "12,000"),
  autoNumber: info("自动编号", "系统自动", "新记录自动编号，不能改", "C-2026-00002"),
  createdBy: info("创建人", "系统自动", "谁建的这条记录", "陈组长"),
  createdAt: info("创建时间", "系统自动", "这条记录建立的时间", "10-07 10:30"),
  updatedBy: info("修改人", "系统自动", "最后改它的人", "小王"),
  modifiedBy: info("修改人", "系统自动", "最后改它的人", "小王"),
  updatedAt: info("修改时间", "系统自动", "最后改动的时间", "10-07 11:02"),
  modifiedAt: info("修改时间", "系统自动", "最后改动的时间", "10-07 11:02"),
};
const INFO_BY_LABEL: ReadonlyMap<string, FieldTypeInfo> = new Map(Object.values(FIELD_TYPE_INFO).map((i) => [i.label, i]));

/** The built-in info of a tile (by value, then by label); undefined for types it does not know. */
export const fieldTypeInfo = (tile: Pick<FieldTypeTile, "value" | "label">): FieldTypeInfo | undefined =>
  (tile.value ? FIELD_TYPE_INFO[tile.value] : undefined) ?? INFO_BY_LABEL.get(tile.label);

export type FieldTypeSection<T> = { group: string; tiles: T[] };
/**
 * Tiles laid out for the picker: pickable tiles by group (FIELD_TYPE_GROUPS order, tiles in their own
 * order; a tile without a known group goes to 「其他」) and the not-yet-available ones apart (`later`).
 * `grouped` is false when no tile has a group (the picker then draws one plain grid).
 */
export function groupTypeTiles<T extends FieldTypeTile<string>>(tiles: readonly T[]): { sections: FieldTypeSection<T>[]; later: T[]; grouped: boolean } {
  const groupOf = (tile: T) => tile.group ?? fieldTypeInfo(tile)?.group;
  const grouped = tiles.some((tile) => isTypeTileEnabled(tile) && groupOf(tile));
  const later = tiles.filter((tile) => !isTypeTileEnabled(tile));
  const on = tiles.filter((tile) => isTypeTileEnabled(tile));
  if (!grouped) return { sections: on.length ? [{ group: "", tiles: on }] : [], later, grouped };
  const order: string[] = [...FIELD_TYPE_GROUPS];
  const byGroup = new Map<string, T[]>();
  for (const tile of on) {
    const group = groupOf(tile) ?? "其他";
    if (!order.includes(group)) order.push(group);
    byGroup.set(group, [...(byGroup.get(group) ?? []), tile]);
  }
  const rest = order.filter((g) => g === "其他");
  const named = order.filter((g) => g !== "其他");
  return { sections: [...named, ...rest].flatMap((group) => (byGroup.get(group)?.length ? [{ group, tiles: byGroup.get(group) ?? [] }] : [])), later, grouped };
}

/** Pickable = has a value and is not marked `later`. */
export const isTypeTileEnabled = (tile: Pick<FieldTypeTile, "value" | "later">) => Boolean(tile.value) && !tile.later;

/** Tiles whose label / keywords / value contain every word of the query (case-insensitive). */
export function filterTypeTiles<T extends Pick<FieldTypeTile, "label" | "keywords" | "value">>(tiles: readonly T[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return tiles.slice();
  return tiles.filter((tile) => {
    const hay = `${tile.label} ${tile.keywords ?? ""} ${tile.value ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Next focus in a grid of `count` items laid out `columns` wide: arrows move (left / right wrap across
 * rows), Home / End jump to the first / last; items that are not `enabled` are skipped in the move
 * direction. Returns null for other keys or when nothing is reachable.
 */
export function tileStep(index: number, key: string, columns: number, count: number, enabled: (i: number) => boolean = () => true): number | null {
  if (count <= 0) return null;
  const cols = Math.max(1, Math.floor(columns));
  const scan = (from: number, step: number): number | null => {
    for (let i = from; i >= 0 && i < count; i += step) if (enabled(i)) return i;
    return null;
  };
  switch (key) {
    case "ArrowRight": return scan(index + 1, 1);
    case "ArrowLeft": return scan(index - 1, -1);
    case "ArrowDown": return scan(index + cols, cols) ?? scan(index + 1, 1);
    case "ArrowUp": return scan(index - cols, -cols) ?? scan(index - 1, -1);
    case "Home": return scan(0, 1);
    case "End": return scan(count - 1, -1);
    default: return null;
  }
}

/**
 * An option being edited (single / multi select, tags, dictionary values). `meta` = the host's own
 * per-option data (a category, a default win rate …): OptionsEditor never reads it and keeps it on
 * rename, recolour, reorder and in cleanOptions; edit it through `renderOptionExtra`.
 */
export type EditableOption = { id: string; label: string; tone: OptionTone; meta?: Readonly<Record<string, unknown>> };

/** Option id `o` + 5 base-36 chars, unique within `taken`; ids never change after creation (rename only changes the label). */
export function newOptionId(taken: readonly { id: string }[], random: () => number = Math.random): string {
  for (let i = 0; i < 1000; i += 1) {
    const id = `o${random().toString(36).slice(2, 7).padEnd(5, "0")}`;
    if (!taken.some((o) => o.id === id)) return id;
  }
  // Still the documented shape (o + 5 base-36 chars): walk the space from a time-based start.
  const start = Date.now() % 36 ** 5;
  for (let i = 0; i < 36 ** 5; i += 1) {
    const id = `o${((start + i) % 36 ** 5).toString(36).padStart(5, "0")}`;
    if (!taken.some((o) => o.id === id)) return id;
  }
  throw new Error("选项编号已用完");
}

/**
 * Tone for the n-th new option (「颜色自动轮下一个」): blue, teal, yellow, orange, green, violet, pink, red,
 * olive, gray, then again — neighbours never share a hue. Solid is never handed out automatically.
 */
const STARTER_ORDER: readonly OptionHueTone[] = ["blue", "teal", "yellow", "orange", "green", "violet", "pink", "red", "olive", "gray"];
export const nextOptionTone = (count: number): OptionHueTone => STARTER_ORDER[count % STARTER_ORDER.length] ?? "blue";

/** Problems of an option list: ids of empty labels and of labels used twice (trimmed, case-sensitive). */
export function optionProblems(options: readonly Pick<EditableOption, "id" | "label">[]): { empty: string[]; duplicate: string[] } {
  const seen = new Map<string, string>();
  const empty: string[] = [];
  const duplicate: string[] = [];
  for (const option of options) {
    const label = option.label.trim();
    if (!label) {
      empty.push(option.id);
      continue;
    }
    if (seen.has(label)) duplicate.push(option.id);
    else seen.set(label, option.id);
  }
  return { empty, duplicate };
}

/** What the field dialog edits; type-specific settings, default value and grants stay with the host (slots). */
export type FieldDraft<V extends string = string> = {
  name: string;
  type: V | null;
  options: EditableOption[];
  /** 「允许在单元格里直接新建选项」 */
  allowCreate: boolean;
  description: string;
};

export type FieldDraftErrors = { name?: string; type?: string; options?: string; optionRows?: Readonly<Record<string, string>> };

export const FIELD_NAME_MAX = 100;

/**
 * Validation shown in the field dialog: name required, ≤ 100 chars, not taken (`existingNames`,
 * trimmed, case-insensitive); a type picked; for option types at least one named option and no
 * duplicate names (empty rows are dropped by `cleanOptions`, not an error).
 */
export function validateFieldDraft<V extends string>(draft: FieldDraft<V>, rules: { optionTypes?: readonly V[]; existingNames?: readonly string[] } = {}): FieldDraftErrors {
  const errors: { name?: string; type?: string; options?: string; optionRows?: Record<string, string> } = {};
  const name = draft.name.trim();
  if (!name) errors.name = "请填写字段名称";
  else if (name.length > FIELD_NAME_MAX) errors.name = `字段名称最多 ${FIELD_NAME_MAX} 个字`;
  else if (rules.existingNames?.some((n) => n.trim().toLowerCase() === name.toLowerCase())) errors.name = `已经有叫「${name}」的字段了`;
  if (!draft.type) errors.type = "请选择字段类型";
  if (draft.type && rules.optionTypes?.includes(draft.type)) {
    const { empty, duplicate } = optionProblems(draft.options);
    if (draft.options.length - empty.length === 0) errors.options = "至少要有一个选项";
    else if (duplicate.length) {
      errors.options = "选项有重名的";
      errors.optionRows = Object.fromEntries(duplicate.map((id) => [id, "和上面的选项重名"]));
    }
  }
  return errors;
}

export const hasFieldErrors = (errors: FieldDraftErrors) => Boolean(errors.name || errors.type || errors.options);

/** Options as sent to the server: trimmed labels, empty rows dropped, order kept. */
export const cleanOptions = (options: readonly EditableOption[]): EditableOption[] =>
  options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label);
