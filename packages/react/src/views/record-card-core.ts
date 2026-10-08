/**
 * Pure rules of RecordCard and GalleryView (bt/views, review 08): the next follow-up
 * pill (今天 / 逾期 N 天 / 明天 / MM-DD), which fields of a card are empty (an empty field takes no
 * row, never 「—」), the tag chips of the tag row (max 3 + 「+N」), the key line parts and the
 * gallery's default cover field (no image / attachment field → 「不显示封面」). No React; unit-tested in
 * test/views-card-core.test.ts.
 */
import { type DateInput } from "../format.ts";
import { runtimeTimeZone } from "../admin-defaults.ts";
import { fieldText, isEmptyValue, readField, toPeople, type GridField } from "../grid-core.ts";
import { resolveOptionTone, type OptionHueTone } from "../option-tone.ts";
import { diffDays, toDay } from "./date-core.ts";

/** The 「下次跟进」 pill: today = attention tone, overdue = danger 「逾期 N 天」, tomorrow 「明天」, else 「MM-DD」 (other years 「YYYY-MM-DD」). */
export type DueState = { tone: "attention" | "danger" | null; text: string };

/** See DueState. `value` is a day key, an ISO instant, epoch ms or a Date; null when empty / invalid. */
export function dueState(value: unknown, today: string, timeZone: string = runtimeTimeZone()): DueState | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return null;
  const day = toDay(value as DateInput, timeZone);
  if (!day) return null;
  const diff = diffDays(today, day);
  if (!Number.isFinite(diff)) return null;
  if (diff === 0) return { tone: "attention", text: "今天" };
  if (diff < 0) return { tone: "danger", text: `逾期 ${-diff} 天` };
  if (diff === 1) return { tone: null, text: "明天" };
  return { tone: null, text: day.slice(0, 4) === today.slice(0, 4) ? day.slice(5) : day };
}

/** A field has nothing to show on a card (no row, no chip, no key-line part). */
export function cardFieldEmpty<T>(field: GridField<T>, record: T): boolean {
  if (field.text) return fieldText(field, record).trim() === "";
  return isEmptyValue(field.type, readField(field, record));
}

/** One chip of the tag row. */
export type CardChip = { key: string; label: string; tone: OptionHueTone };
/** Chips shown on a card (default 3) — the rest are counted in 「+N」. */
export const CARD_MAX_TAGS = 3;

const selectValues = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value]).filter((v): v is string => typeof v === "string" && v !== "");

/**
 * The tag row: single / multi select values as option-tone chips (in field order), other fields as one
 * grey chip with their text. Returns the visible chips and how many more there are.
 */
export function cardTags<T>(fields: readonly GridField<T>[], record: T, max = CARD_MAX_TAGS): { chips: CardChip[]; more: number } {
  const all: CardChip[] = [];
  for (const field of fields) {
    if (cardFieldEmpty(field, record)) continue;
    if (field.type === "singleSelect" || field.type === "multiSelect") {
      const values = selectValues(readField(field, record));
      for (const value of field.type === "singleSelect" ? values.slice(0, 1) : values) {
        const option = field.options?.find((o) => o.value === value);
        all.push({ key: `${field.key}:${value}`, label: option?.label ?? value, tone: option ? resolveOptionTone(option) : "gray" });
      }
    } else if (field.type === "user") {
      for (const person of toPeople(readField(field, record))) all.push({ key: `${field.key}:${person.key ?? person.name}`, label: person.name, tone: "gray" });
    } else {
      all.push({ key: field.key, label: fieldText(field, record), tone: "gray" });
    }
  }
  return { chips: all.slice(0, Math.max(0, max)), more: Math.max(0, all.length - Math.max(0, max)) };
}

/** One part of the key line: numbers / money bold and tabular, the rest secondary. */
export type CardKeyPart = { key: string; text: string; strong: boolean };
/** The key line 「US$ 18.6 万 · 上海 · 徐汇」: non-empty fields in order. */
export function cardKeyline<T>(fields: readonly GridField<T>[], record: T): CardKeyPart[] {
  return fields.flatMap((field) => {
    if (cardFieldEmpty(field, record)) return [];
    const text = fieldText(field, record);
    return text ? [{ key: field.key, text, strong: field.type === "money" || field.type === "number" }] : [];
  });
}

/** The first person of an owner field (footer avatar + name); null when empty. */
export function cardOwner<T>(field: GridField<T> | undefined, record: T): { name: string; id?: string } | null {
  if (!field || cardFieldEmpty(field, record)) return null;
  const people = toPeople(readField(field, record));
  const first = people[0];
  if (first) return first.key ? { name: first.name, id: first.key } : { name: first.name };
  const text = fieldText(field, record);
  return text ? { name: text } : null;
}

/** Attachment-like field types a gallery cover can come from. */
export const COVER_FIELD_TYPES: readonly string[] = ["attachment"];
/** Value of 「不显示封面」 in the gallery's cover picker. */
export const NO_COVER = "none";

/**
 * The gallery's cover field when the view has not chosen one: the first image / attachment field, or
 * 「不显示封面」 (`NO_COVER`) when the table has none (a customer table without photos
 * must not be a wall of grey placeholders). Accepts grid fields (`type: "attachment"`) or the gallery's
 * cover options (`{ value }`, every option is a cover field).
 */
export function defaultCoverField(fields: readonly ({ key: string; type: string } | { value: string })[] | null | undefined): string {
  for (const f of fields ?? []) {
    if ("value" in f) return f.value;
    if (COVER_FIELD_TYPES.includes(f.type)) return f.key;
  }
  return NO_COVER;
}
