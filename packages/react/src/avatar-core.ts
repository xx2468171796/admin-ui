/**
 * Avatar rules: five sizes, the letter = the first character of the name (the
 * surname in Chinese), and one of the approved option colours per PERSON — chosen by a stable hash of the
 * account id (falling back to the name), so the same person has the same colour everywhere and two people
 * with the same surname usually differ. Gray is not in the rotation: it means 「已离职 / 部门」. Pure; unit-tested.
 */
import type { OptionHue } from "./option-palette.ts";

/** 20 cells / stacks · 24 person chips / field rows · 32 comments / list rows · 40 member cards · 64 profile head. */
export type AvatarSize = 20 | 24 | 32 | 40 | 64;
export const AVATAR_SIZES: readonly AvatarSize[] = [20, 24, 32, 40, 64];

/** The nine person colours (every option tone except gray), in hash order. */
export const AVATAR_TONES: readonly OptionHue[] = ["blue", "green", "violet", "orange", "teal", "pink", "yellow", "red", "olive"];

/** FNV-1a 32-bit over UTF-16 code units: fast, stable across runtimes, good spread for short ids. */
export function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The colour of one person: same key → same tone, everywhere. Empty key → green. */
export function avatarTone(key: string | number | null | undefined): OptionHue {
  const text = key === null || key === undefined ? "" : String(key).trim();
  if (!text) return "green";
  return AVATAR_TONES[hashKey(text) % AVATAR_TONES.length] ?? "green";
}

/** The letter: first character of the name (surname), Latin upper-cased; 「?」 when empty. */
export function avatarLetter(name: string | null | undefined): string {
  const first = Array.from((name ?? "").trim())[0];
  return first ? first.toLocaleUpperCase("zh-CN") : "?";
}

/** Any pixel size → the nearest of the five (20 · 24 · 32 · 40 · 64); undefined → 32. */
export function avatarSize(size: number | undefined): AvatarSize {
  if (size === undefined) return 32;
  let best: AvatarSize = 32;
  for (const s of AVATAR_SIZES) if (Math.abs(s - size) < Math.abs(best - size)) best = s;
  return best;
}
