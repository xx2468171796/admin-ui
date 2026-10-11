import type { AdminDefaults } from "./admin-defaults.ts";
import { currencySymbol } from "./number-input-core.ts";
import type { GridField } from "./grid-core.ts";

/**
 * Field types whose instants are shown in a time zone. `date` is here for values that are instants and for
 * 「今天」 of its filters and editor; a plain calendar day ("2026-09-30") is never converted (format.ts calendarDay).
 */
const ZONED_TYPES = new Set(["date", "datetime", "createdAt", "modifiedAt"]);
/** Fill money currency, date time zone and phone country from AdminProvider `defaults` where a field leaves them out. */
export function withLocaleDefaults<T>(fields: readonly GridField<T>[], defaults: AdminDefaults): readonly GridField<T>[] {
  const symbol = currencySymbol(defaults.currency);
  let changed = false;
  const out = fields.map((field) => {
    const patch: Partial<GridField<T>> = {};
    if (field.type === "money" && field.currency === undefined && symbol) patch.currency = symbol;
    if (ZONED_TYPES.has(field.type) && field.timeZone === undefined) patch.timeZone = defaults.timeZone;
    if (field.type === "phone" && field.phoneCountry === undefined && defaults.phoneCountry) patch.phoneCountry = defaults.phoneCountry;
    if (!Object.keys(patch).length) return field;
    changed = true;
    return { ...field, ...patch };
  });
  return changed ? out : fields;
}
