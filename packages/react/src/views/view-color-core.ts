/**
 * Colour basis of a view's records (bt/templates): by a single-select field's option tones, by 填色
 * rules (the grid's G13 model: condition tree + tone, first matching rule wins), or one uniform colour.
 * Used by GanttView bars and GanttSettings 颜色依据. Pure, no React; unit-tested in test/views-color-core.test.ts.
 */
import { readField, type GridField } from "../grid-core.ts";
import { gridRowFill } from "../grid-color-core.ts";
import type { GridColorRule } from "../grid-view-v2.ts";
import type { ConditionContext } from "../condition-core.ts";
import { isSolidTone, toneHue, type OptionTone } from "../option-tone.ts";
import { toneOfOption } from "./kanban-core.ts";

export type ViewColorBasis = "option" | "condition" | "uniform";
export type ViewColorConfig = { colorField?: string | null; colorRules?: readonly GridColorRule[] };

/** Which basis a config uses: an option field wins, then rules (at least one), else uniform. */
export function viewColorBasis(config: ViewColorConfig): ViewColorBasis {
  if (config.colorField) return "option";
  return config.colorRules?.length ? "condition" : "uniform";
}

/**
 * Tone of one record: the option's tone (no / unknown value = gray), the first matching rule's tone
 * (only whole-row rules count; no match = `fallback`), or `fallback` (default brand).
 */
export function viewRecordTone<T>(record: T, fields: readonly GridField<T>[], config: ViewColorConfig, context: ConditionContext = {}, fallback: OptionTone = "green"): OptionTone {
  const basis = viewColorBasis(config);
  if (basis === "option") {
    const field = fields.find((f) => f.key === config.colorField);
    if (!field) return fallback;
    const value = readField(field, record);
    const option = field.options?.find((o) => o.value === (Array.isArray(value) ? value[0] : value));
    return option ? toneOfOption(option) : "gray";
  }
  if (basis === "condition") {
    const rows = (config.colorRules ?? []).filter((rule) => rule.target === "row");
    return gridRowFill(record, rows, new Map(fields.map((f) => [f.key, f])), context)?.row ?? fallback;
  }
  return fallback;
}

/**
 * The soft version of a tone (review 08): calendar events and gantt bars are always a
 * soft fill + thin border, so a filled option (`greenSolid`, old `solid` = 成交) shows as its hue's
 * soft tone; soft tones (and old names like `brand`) pass through unchanged.
 */
export const softTone = (tone: OptionTone): OptionTone => (isSolidTone(tone) ? toneHue(tone) : tone);
