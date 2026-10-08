/**
 * Extra field types of BitableGrid (bt/grid-b, G12): rating, progress, percent, phone (masked), autoNumber,
 * system fields (createdBy / createdAt / modifiedBy / modifiedAt), read-only formula, attachment,
 * link and lookup. Pure rules only (no React, no DOM, no value imports from grid-core so either module
 * can load first): every extra type maps onto a base type (`coreType`) for filters, sorting, grouping,
 * summaries and SQL, plus its own text, parsing and read-only rules. Unit-tested in
 * test/grid-field-types.test.ts.
 */
import type { GridField, GridFieldType } from "./grid-core.ts";
import type { MediaItem } from "./media-parts.tsx";

/** Types added on top of the 13 base types. */
export type GridExtraFieldType =
  | "rating"
  | "progress"
  | "percent"
  | "phone"
  | "autoNumber"
  | "createdBy"
  | "createdAt"
  | "modifiedBy"
  | "modifiedAt"
  | "formula"
  | "attachment"
  | "link"
  | "lookup";
export const GRID_EXTRA_FIELD_TYPES: readonly GridExtraFieldType[] = ["rating", "progress", "percent", "phone", "autoNumber", "createdBy", "createdAt", "modifiedBy", "modifiedAt", "formula", "attachment", "link", "lookup"];
/** The 13 types the core rules switch on. */
export type GridBaseFieldType = Exclude<GridFieldType, GridExtraFieldType>;
/** Value type a formula field shows (the host computes the value). */
export type GridFormulaResult = "text" | "number" | "money" | "date" | "datetime" | "checkbox";
/** A linked record (link / lookup chips); the host resolves titles. */
export type GridRecordRef = { id: string; title: string; /** Tooltip, e.g. the table name. */ hint?: string };
/** One file of an attachment cell (same shape as AttachmentGallery / MediaLightbox items). */
export type GridAttachment = MediaItem;
/** Text tone of one cell (GridField.tone): an overdue date in danger, a near deadline in warning. */
export type GridCellTone = "danger" | "warning" | "info" | "success" | "brand" | "note";

/** Chinese names of the extra types (field type pickers, header tooltips). */
export const GRID_EXTRA_FIELD_LABELS: Readonly<Record<GridExtraFieldType, string>> = {
  rating: "评分",
  progress: "进度",
  percent: "百分比",
  phone: "电话",
  autoNumber: "自动编号",
  createdBy: "创建人",
  createdAt: "创建时间",
  modifiedBy: "修改人",
  modifiedAt: "修改时间",
  formula: "公式",
  attachment: "附件",
  link: "关联",
  lookup: "查找引用",
};

const CORE: Readonly<Record<GridExtraFieldType, GridBaseFieldType>> = {
  rating: "number",
  progress: "number",
  percent: "number",
  autoNumber: "number",
  phone: "text",
  createdBy: "user",
  modifiedBy: "user",
  createdAt: "datetime",
  modifiedAt: "datetime",
  formula: "text",
  attachment: "text",
  link: "text",
  lookup: "text",
};
const isExtra = (type: string): type is GridExtraFieldType => Object.hasOwn(CORE, type);
export const isExtraFieldType = isExtra;

type TypeLike = GridFieldType | { type: GridFieldType; resultType?: GridFormulaResult };
/**
 * The base type whose rules a field follows: rating / progress / percent / autoNumber → number, phone and
 * attachment / link / lookup → text (on their display text), createdBy / modifiedBy → user,
 * createdAt / modifiedAt → datetime, formula → its `resultType` (default text). Base types map to
 * themselves. Switch on this, not on `field.type`, when writing type rules.
 */
export function coreType(input: TypeLike): GridBaseFieldType {
  const type = typeof input === "string" ? input : input.type;
  if (!isExtra(type)) return type;
  if (type === "formula" && typeof input === "object" && input.resultType) return input.resultType;
  return CORE[type];
}

/** Values are produced by the system or the host and can never be edited in a cell. */
export function isReadOnlyType(type: GridFieldType): boolean {
  return type === "autoNumber" || type === "createdBy" || type === "createdAt" || type === "modifiedBy" || type === "modifiedAt" || type === "formula" || type === "lookup";
}

const readValue = <T>(field: Pick<GridField<T>, "key" | "value">, row: T): unknown => (field.value ? field.value(row) : (row as Record<string, unknown>)[field.key]);

// ---------------------------------------------------------------- values

/** Attachments of a cell: MediaItem objects (anything else dropped). */
export function toAttachments(value: unknown): GridAttachment[] {
  const list = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return list.filter((item): item is GridAttachment => Boolean(item) && typeof item === "object" && typeof (item as GridAttachment).id === "string" && typeof (item as GridAttachment).name === "string");
}
/** Linked records of a cell: `{ id, title }` objects (plain strings become `{ id: s, title: s }`). */
export function toRecordRefs(value: unknown): GridRecordRef[] {
  const list = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value];
  return list.flatMap((item): GridRecordRef[] => {
    if (typeof item === "string") return item ? [{ id: item, title: item }] : [];
    if (item && typeof item === "object" && typeof (item as GridRecordRef).id === "string") {
      const ref = item as GridRecordRef;
      return [{ ...ref, title: typeof ref.title === "string" && ref.title ? ref.title : ref.id }];
    }
    return [];
  });
}
/** Values of a lookup cell as texts (strings, numbers, `{ title }` / `{ name }` objects). */
export function toLookupTexts(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value];
  return list.flatMap((item): string[] => {
    if (typeof item === "string") return item ? [item] : [];
    if (typeof item === "number" || typeof item === "bigint") return [String(item)];
    if (typeof item === "boolean") return [item ? "是" : "否"];
    if (item && typeof item === "object") {
      const named = (item as { title?: unknown; name?: unknown }).title ?? (item as { name?: unknown }).name;
      return typeof named === "string" && named ? [named] : [];
    }
    return [];
  });
}

/** 0–100 progress of a value (null for empty / invalid). Values above 100 or below 0 are clamped. */
export function toProgress(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.replace(/%$/, "")) : NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
}
/** Percent of a value (0–100 stored as a number; 「60%」 text accepted); null for empty / invalid. Not clamped. */
export function toPercent(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.trim().replace(/[%％]$/, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}
/** Star count of a rating value (integer 0…max, null when empty). */
export function toRating(value: unknown, max = 5): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : null;
}

/**
 * Masked phone / id text: the middle digits become 「*」, separators stay (0755-123-456 →
 * 0755-***-456, 13812345678 → 138****5678). Text that already contains 「*」 is returned as is (the
 * server masked it). Give `mask` a function for other rules.
 */
export function maskPhone(text: string, mask: boolean | ((value: string) => string) = true): string {
  if (typeof mask === "function") return mask(text);
  if (!mask || text.includes("*")) return text;
  const digits = [...text].filter((ch) => ch >= "0" && ch <= "9").length;
  if (digits < 4) return text;
  const head = digits === 11 ? 3 : digits >= 8 ? 4 : 1;
  const tail = digits === 11 ? 4 : digits >= 8 ? 3 : 1;
  let seen = 0;
  return [...text].map((ch) => {
    if (ch < "0" || ch > "9") return ch;
    seen++;
    return seen > head && seen <= digits - tail ? "*" : ch;
  }).join("");
}

const round = (n: number, digits: number) => Number(n.toFixed(Math.max(0, Math.min(10, digits))));
/** 「62%」 for a progress value (precision = fraction digits, default 0). */
export const progressText = (value: number, precision = 0) => `${round(value, precision)}%`;

/**
 * Display text of an extra type's value (copy, search, filters on text); undefined for types whose
 * base type formats them (rating, system fields, formula).
 */
export function extraValueText<T>(field: Pick<GridField<T>, "type" | "mask" | "precision">, value: unknown): string | undefined {
  switch (field.type) {
    case "progress": {
      const n = toProgress(value);
      return n === null ? "" : progressText(n, field.precision);
    }
    case "percent": {
      const n = toPercent(value);
      return n === null ? "" : progressText(n, field.precision);
    }
    case "phone":
      return typeof value === "string" ? maskPhone(value, field.mask ?? false) : typeof value === "number" ? maskPhone(String(value), field.mask ?? false) : "";
    case "autoNumber":
      return typeof value === "number" || typeof value === "bigint" || typeof value === "string" ? String(value) : "";
    case "attachment":
      return toAttachments(value).map((item) => item.name).join("、");
    case "link":
      return toRecordRefs(value).map((ref) => ref.title).join("、");
    case "lookup":
      return toLookupTexts(value).join("、");
    default:
      return undefined;
  }
}

// One derived field per extra-type field object (cached, so per-row calls stay cheap).
const CORE_FIELDS = new WeakMap<object, unknown>();
/**
 * The field as its base type sees it: same object for base types; for extra types a copy with
 * `type: coreType(field)` and, for text-based ones, `text` = the display text (masked phone, file
 * names, linked titles). Core rules (filters, sort keys, groups, summaries) run on this.
 */
export function coreField<T>(field: GridField<T>): GridField<T> {
  if (!isExtra(field.type)) return field;
  const cached = CORE_FIELDS.get(field);
  if (cached) return cached as GridField<T>;
  const type = coreType(field);
  const textual = type === "text" && field.type !== "formula";
  const derived: GridField<T> = {
    ...field,
    type,
    ...(textual && !field.text ? { text: (row: T) => extraValueText(field, readValue(field, row)) ?? "" } : {}),
  };
  CORE_FIELDS.set(field, derived);
  return derived;
}

// ---------------------------------------------------------------- input

type Parsed = { ok: true; value: unknown } | { ok: false; error: string };
/**
 * Typed / pasted text → value for the extra types (null = not an extra type, use the base parser).
 * Empty text is handled by the caller (clears the cell).
 */
export function parseExtraInput<T>(field: Pick<GridField<T>, "type" | "title" | "max">, text: string): Parsed | null {
  const trimmed = text.trim();
  switch (field.type) {
    case "rating": {
      const max = field.max ?? 5;
      const stars = /^[★☆]+$/.test(trimmed) ? [...trimmed].filter((ch) => ch === "★").length : Number(trimmed.replace(/\s*(星|分)$/, ""));
      return Number.isInteger(stars) && stars >= 0 && stars <= max ? { ok: true, value: stars } : { ok: false, error: `请输入 0–${max} 的整数` };
    }
    case "progress": {
      const n = Number(trimmed.replace(/[%％]$/, ""));
      return Number.isFinite(n) && n >= 0 && n <= 100 ? { ok: true, value: n } : { ok: false, error: "进度在 0–100% 之间" };
    }
    case "percent": {
      const n = Number(trimmed.replace(/\s*[%％]$/, ""));
      return trimmed !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? { ok: true, value: n } : { ok: false, error: "百分比在 0–100% 之间" };
    }
    case "phone":
      return /^\+?[\d\s\-()（）]{3,24}(?:\s*(?:转|ext\.?|#)\s*\d{1,6})?$/i.test(trimmed) ? { ok: true, value: trimmed } : { ok: false, error: "不是有效的电话号码" };
    case "attachment":
      return { ok: false, error: "附件请上传，不能粘贴文字" };
    case "link":
      return { ok: false, error: `「${field.title}」请在选择器里选记录` };
    default:
      return isExtra(field.type) && isReadOnlyType(field.type) ? { ok: false, error: `「${field.title}」由系统生成，不能修改` } : null;
  }
}

/** Empty value written by clear for the extra types (undefined = use the base rule). */
export function extraEmptyValue(type: GridFieldType): unknown {
  return type === "attachment" || type === "link" ? [] : undefined;
}

/** Summary text of a numeric statistic on an extra type (progress / percent show %). */
export function extraSummaryText(field: Pick<GridField<unknown>, "type">, text: string): string {
  return (field.type === "progress" || field.type === "percent") && text !== "—" ? `${text}%` : text;
}

/** Default width (px) of the extra types. */
export const GRID_EXTRA_WIDTHS: Readonly<Partial<Record<GridExtraFieldType, number>>> = {
  rating: 110,
  progress: 140,
  percent: 130,
  phone: 140,
  autoNumber: 100,
  createdBy: 140,
  modifiedBy: 140,
  createdAt: 160,
  modifiedAt: 160,
  attachment: 150,
  link: 180,
  lookup: 160,
};
