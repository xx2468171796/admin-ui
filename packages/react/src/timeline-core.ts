/**
 * Pure helpers of the unified timeline (ActivityFeed, LogTimeline and the record
 * follow-up timeline share one anatomy) and of SelectList's search highlight. No React — unit-tested in
 * test/timeline-core.test.ts.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";
import { dayKey } from "./format.ts";

/** What sits on the 20px rail: a person (avatar), a system event (8px dot) or a result (✓ / ✕ / ! circle). */
export type TimelineMarkerKind = "person" | "system" | "result";
export type TimelineResult = "success" | "danger" | "warning";
/** Colour of a system dot: neutral (soft grey, default), brand, info, warning. */
export type TimelineDotTone = "neutral" | "brand" | "info" | "warning";

const WEEK = "日一二三四五六";

/**
 * Sticky day heading: 「今天」 + 「10月7日 周三」, 「昨天」 + 「10月6日 周二」, an older day this year 「10月5日」 + 「周一」,
 * another year 「2025年10月5日」 + 「周日」; no time → 「时间未知」.
 */
export function dayHeading(key: string, now = Date.now(), timeZone = runtimeTimeZone()): { label: string; date: string } {
  const [y, m, d] = key.split("-").map(Number);
  if (!key || !y || !m || !d) return { label: "时间未知", date: "" };
  const week = `周${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? ""}`;
  const md = `${m}月${d}日`;
  if (key === dayKey(now, timeZone)) return { label: "今天", date: `${md} ${week}` };
  if (key === dayKey(now - 86_400_000, timeZone)) return { label: "昨天", date: `${md} ${week}` };
  const thisYear = Number(dayKey(now, timeZone).slice(0, 4));
  return { label: y === thisYear ? md : `${y}年${md}`, date: week };
}

/** Marker a host tone maps to: success / danger / warning → a result circle, anything else → a system dot. */
export function markerForTone(tone: string | null | undefined): { kind: TimelineMarkerKind; result?: TimelineResult; dot?: TimelineDotTone } {
  if (tone === "success" || tone === "danger" || tone === "warning") return { kind: "result", result: tone };
  if (tone === "brand" || tone === "info") return { kind: "system", dot: tone };
  return { kind: "system", dot: "neutral" };
}

/** Split `text` into parts with every case-insensitive occurrence of `query` marked (search highlight). */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim().toLowerCase();
  if (!q || !text) return text ? [{ text, hit: false }] : [];
  const lower = text.toLowerCase();
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, at)) {
    if (i > at) parts.push({ text: text.slice(at, i), hit: false });
    parts.push({ text: text.slice(i, i + q.length), hit: true });
    at = i + q.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}
