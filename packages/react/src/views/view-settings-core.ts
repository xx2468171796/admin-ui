/** Pure helpers of the view settings panels (unit-tested in test/views-717-core.test.ts). */
/**
 * How many settings of a view differ from the shared ones: one per top-level key whose value differs (arrays and
 * plain objects compared by content). Feeds `ViewSettingsFooter changes`.
 */
export function countSettingChanges(base: Readonly<Record<string, unknown>>, mine: Readonly<Record<string, unknown>>): number {
  const keys = new Set([...Object.keys(base), ...Object.keys(mine)]);
  let n = 0;
  for (const key of keys) if (!sameValue(base[key], mine[key])) n++;
  return n;
}
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if ((a === undefined || a === null) && (b === undefined || b === null)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
