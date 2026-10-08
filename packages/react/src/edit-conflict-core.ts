/**
 * Edit conflicts: when someone else saved the same field first, keep THEIR newer value
 * by default; the user's own input is kept aside so it can be put back (「重新填入我的」) or saved over theirs
 * (「用我的覆盖」) on purpose. Pure; unit-tested in test/edit-conflict-core.test.ts.
 */
export type ConflictPick = "theirs" | "mine";
export type FieldConflictValues<V = unknown> = { key: string; theirs: V; mine: V };

/** The pick of one field: theirs unless the user chose 「用我的」. */
export const pickOf = (key: string, picks: Readonly<Record<string, ConflictPick>>): ConflictPick => picks[key] ?? "theirs";

/** Values to save after the user decided: field key → chosen value. */
export function resolveConflicts<V>(rows: readonly FieldConflictValues<V>[], picks: Readonly<Record<string, ConflictPick>>): Record<string, V> {
  return Object.fromEntries(rows.map((row) => [row.key, pickOf(row.key, picks) === "mine" ? row.mine : row.theirs]));
}

/** Only the fields where the user overrides theirs (what an overwrite request needs to send). */
export function overriddenKeys(rows: readonly { key: string }[], picks: Readonly<Record<string, ConflictPick>>): string[] {
  return rows.filter((row) => pickOf(row.key, picks) === "mine").map((row) => row.key);
}

/** 「保留他的 2 项 · 用我的 1 项」 counts. */
export function conflictCounts(rows: readonly { key: string }[], picks: Readonly<Record<string, ConflictPick>>): { theirs: number; mine: number } {
  const mine = overriddenKeys(rows, picks).length;
  return { theirs: rows.length - mine, mine };
}

/** 「王小明 刚改过这一格 · 14:31」 — who changed it, and when when known. */
export function conflictHeadline(by: string, at?: string, what = "这一格"): string {
  return `${by} 刚改过${what}${at ? ` · ${at}` : ""}`;
}
