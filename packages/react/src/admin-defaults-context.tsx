import { useContext, useMemo, type ReactNode } from "react";
import { resolveAdminDefaults, type AdminDefaults } from "./admin-defaults.ts";
import { sharedContext } from "./context.ts";

/**
 * React side of the locale defaults (admin-defaults.ts). `AdminProvider defaults={{ timeZone, currency, phoneCountry }}`
 * sets them for everything inside; components read them with `useAdminDefaults()` whenever their own prop is missing.
 * Outside any provider the neutral defaults apply (runtime time zone, no currency, phone country from the locale).
 */
const AdminDefaultsContext = sharedContext<AdminDefaults>("defaults");

export function AdminDefaultsProvider({ defaults, children }: { defaults?: Partial<AdminDefaults>; children: ReactNode }) {
  const parent = useContext(AdminDefaultsContext);
  const { timeZone, currency, phoneCountry } = defaults ?? {};
  const value = useMemo(
    () => resolveAdminDefaults({ ...parent, ...(timeZone ? { timeZone } : {}), ...(currency !== undefined ? { currency } : {}), ...(phoneCountry !== undefined ? { phoneCountry } : {}) }),
    [parent, timeZone, currency, phoneCountry],
  );
  return <AdminDefaultsContext.Provider value={value}>{children}</AdminDefaultsContext.Provider>;
}

let fallback: AdminDefaults | undefined;
/** The locale defaults in effect here (nearest AdminProvider / AdminDefaultsProvider, else the neutral ones). */
export function useAdminDefaults(): AdminDefaults {
  const ctx = useContext(AdminDefaultsContext);
  if (ctx) return ctx;
  fallback ??= resolveAdminDefaults();
  return fallback;
}
