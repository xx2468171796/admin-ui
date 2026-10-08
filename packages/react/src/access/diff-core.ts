/**
 * Structural JSON diff for AuditDiff (microdiff-style leaf entries; own implementation, no dependency).
 * Arrays of objects with an `id` are matched by id so a reordered list is not a wall of changes;
 * other arrays compare by index. Sensitive keys are masked before display. No React / DOM.
 */
import type { JsonDiffEntry } from "./contracts.ts";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const idOf = (v: unknown): string | null => (isObject(v) && (typeof v.id === "string" || typeof v.id === "number") ? String(v.id) : null);

function join(path: string, key: string | number): string {
  if (typeof key === "number") return `${path}[${key}]`;
  const plain = /^[A-Za-z_$一-龥][\w$一-龥]*$/.test(key);
  return plain ? (path ? `${path}.${key}` : key) : `${path}[${JSON.stringify(key)}]`;
}

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === "bigint" || typeof b === "bigint") return String(a) === String(b) && typeof a === typeof b;
  return false;
}

/** Leaf-level differences between two JSON-like values. `maxEntries` bounds huge snapshots. */
export function diffJson(before: unknown, after: unknown, maxEntries = 500): JsonDiffEntry[] {
  const out: JsonDiffEntry[] = [];
  const push = (e: JsonDiffEntry) => {
    if (out.length < maxEntries) out.push(e);
  };
  const walk = (a: unknown, b: unknown, path: string) => {
    if (out.length >= maxEntries) return;
    if (same(a, b)) return;
    if (a === undefined) return push({ path: path || "（整体）", kind: "added", after: b });
    if (b === undefined) return push({ path: path || "（整体）", kind: "removed", before: a });
    if (Array.isArray(a) && Array.isArray(b)) {
      const byId = a.every((x) => idOf(x) !== null) && b.every((x) => idOf(x) !== null);
      if (byId) {
        const left = new Map(a.map((x) => [idOf(x)!, x]));
        const right = new Map(b.map((x) => [idOf(x)!, x]));
        for (const [id, x] of left) walk(x, right.get(id), `${path}[id=${id}]`);
        for (const [id, y] of right) if (!left.has(id)) walk(undefined, y, `${path}[id=${id}]`);
        return;
      }
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) walk(i < a.length ? a[i] : undefined, i < b.length ? b[i] : undefined, join(path, i));
      return;
    }
    if (isObject(a) && isObject(b)) {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
      for (const k of keys) walk(a[k], b[k], join(path, k));
      return;
    }
    push({ path: path || "（整体）", kind: "changed", before: a, after: b });
  };
  walk(before, after, "");
  return out;
}

/** Keys whose values are never shown (case-insensitive substring). */
export const DEFAULT_SECRET_KEYS: readonly string[] = ["password", "passwd", "secret", "token", "apikey", "api_key", "privatekey", "private_key", "credential"];

export function isSecretPath(path: string, secretKeys: readonly string[] = DEFAULT_SECRET_KEYS): boolean {
  const lower = path.toLowerCase().replace(/[^a-z0-9_.]/g, "");
  return secretKeys.some((k) => lower.split(".").some((part) => part.includes(k.toLowerCase())));
}

/** Display text for one value: strings quoted only when ambiguous, objects compact JSON, cut at `max` chars. */
export function formatJsonValue(value: unknown, max = 160): string {
  let text: string;
  if (value === undefined) text = "—";
  else if (value === null) text = "null";
  else if (typeof value === "string") text = value === "" || value.trim() !== value || /^(true|false|null|-?\d)/.test(value) ? JSON.stringify(value) : value;
  else if (typeof value === "bigint") text = value.toString();
  else {
    try {
      text = JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) ?? String(value);
    } catch {
      text = String(value);
    }
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
