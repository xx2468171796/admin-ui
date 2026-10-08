/**
 * One person's effective-access profile (D15 「按人员」): the stat strip above the effective table —
 * how many roles, personal adds, personal denies and shared records shape what this person can do —
 * and the row filter behind 「只看单独加减」. Pure; unit-tested in test/access-profile-core.test.ts.
 */
import type { EffectiveAccessRow } from "./contracts.ts";

export type AccessProfileStatKey = "roles" | "personalAdd" | "personalDeny" | "shared";
export type AccessProfileStat = { key: AccessProfileStatKey; label: string; value: number; tone: "neutral" | "brand" | "danger" };

const key = (s: { kind: string; id?: string; label: string }) => `${s.kind}:${s.id ?? s.label}`;

/**
 * Counts from the effective rows: distinct roles (also via post / department), distinct personal adds,
 * rows blocked by a personal deny, distinct shared records (`shared_record` / `record_grant`).
 */
export function accessProfileStats(rows: readonly EffectiveAccessRow[]): AccessProfileStat[] {
  const roles = new Set<string>();
  const adds = new Set<string>();
  const shared = new Set<string>();
  let denies = 0;
  for (const row of rows) {
    for (const s of row.sources) {
      if (s.kind === "role" || s.kind === "post" || s.kind === "dept") roles.add(key({ ...s, kind: "role" }));
      else if (s.kind === "personal") adds.add(key(s));
      else if (s.kind === "shared_record" || s.kind === "record_grant") shared.add(key(s));
    }
    if (row.blocks.some((b) => b.kind === "denied")) denies += 1;
  }
  return [
    { key: "roles", label: "角色", value: roles.size, tone: "neutral" },
    { key: "personalAdd", label: "单独加", value: adds.size, tone: adds.size ? "brand" : "neutral" },
    { key: "personalDeny", label: "单独减", value: denies, tone: denies ? "danger" : "neutral" },
    { key: "shared", label: "共享记录", value: shared.size, tone: "neutral" },
  ];
}

/** 「只看单独加减」: rows that a personal add or a personal deny decided. */
export function personalOnly(rows: readonly EffectiveAccessRow[]): EffectiveAccessRow[] {
  return rows.filter((r) => r.sources.some((s) => s.kind === "personal") || r.blocks.some((b) => b.kind === "denied"));
}

/** The soonest expiry among a row's sources (ISO), or null when nothing on the row expires. */
export function rowExpiry(row: EffectiveAccessRow): string | null {
  let best: { at: number; iso: string } | null = null;
  for (const s of row.sources) {
    if (!s.expiresAt) continue;
    const at = Date.parse(s.expiresAt);
    if (Number.isFinite(at) && (!best || at < best.at)) best = { at, iso: s.expiresAt };
  }
  return best?.iso ?? null;
}
