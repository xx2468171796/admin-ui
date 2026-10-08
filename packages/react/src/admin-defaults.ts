/**
 * Locale defaults the SDK falls back to when a component or function is not given one explicitly: time zone,
 * currency and phone calling code. Pure (no React); the React side is `AdminProvider defaults` /
 * `useAdminDefaults` (admin-defaults-context.tsx).
 *
 * Neutral by design — the SDK never assumes a country:
 * - time zone: the runtime's own (browser: the user's; Node: the server's `TZ`), "UTC" when unknown;
 * - currency: none (amounts show without a symbol until the host sets one);
 * - phone country: the calling code of the runtime locale's region when it is in the list, else the first entry.
 * Explicit props / options always win over these defaults.
 */

export type AdminDefaults = {
  /** IANA time zone for dates, relative times, "today" and calendars. */
  timeZone: string;
  /** ISO 4217 code ("CNY", "USD", …) or a plain symbol ("¥"); "" = no currency symbol. */
  currency: string;
  /** Calling code of the phone box ("+86", "+1", …); "" = from the runtime locale. */
  phoneCountry: string;
};

let runtimeZone: string | undefined;
/** The runtime's IANA time zone (browser: the user's; Node: `TZ` / the system's); "UTC" when unknown. */
export function runtimeTimeZone(): string {
  if (runtimeZone === undefined) {
    try {
      runtimeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      runtimeZone = "UTC";
    }
  }
  return runtimeZone;
}

/** Region of the runtime locale ("zh-CN" → "CN", "en-US" → "US"); "" when the locale has none. */
export function runtimeRegion(): string {
  const nav = (globalThis as { navigator?: { language?: string } }).navigator;
  let tag = nav?.language ?? "";
  if (!tag) {
    try {
      tag = new Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      tag = "";
    }
  }
  try {
    return new Intl.Locale(tag).maximize().region ?? "";
  } catch {
    return "";
  }
}

/** Defaults with nothing configured. */
export const NEUTRAL_DEFAULTS: Readonly<Omit<AdminDefaults, "timeZone">> = { currency: "", phoneCountry: "" };

/** Fill a partial host config with the neutral defaults. */
export function resolveAdminDefaults(partial: Partial<AdminDefaults> = {}): AdminDefaults {
  return {
    timeZone: partial.timeZone || runtimeTimeZone(),
    currency: partial.currency ?? NEUTRAL_DEFAULTS.currency,
    phoneCountry: partial.phoneCountry ?? NEUTRAL_DEFAULTS.phoneCountry,
  };
}

/** UTC offset of a time zone at a moment, "+08:00" / "-05:00" / "+05:30" (for SQL dialects without IANA zones). */
export function utcOffsetOf(timeZone: string, at = Date.now()): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(new Date(at)).find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = /([+-])(\d{1,2}):?(\d{2})?/.exec(name);
    return m ? `${m[1]}${(m[2] ?? "0").padStart(2, "0")}:${m[3] ?? "00"}` : "+00:00";
  } catch {
    return "+00:00";
  }
}
