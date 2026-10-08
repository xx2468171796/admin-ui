/**
 * Transcript rules (bt/builders-b A1, demo D27t): which segment is playing, how much each speaker
 * talked, where the silences are, how a line splits into plain text / AI-annotated phrases / masked
 * spans, search, the speaker lane and the text for copy / export. Pure functions, no React / DOM —
 * the same rules can run on the server (export) and in tests (test/transcript-core.test.ts).
 *
 * Times are seconds from the start of the recording. Segments come from the host's speech-to-text
 * service already diarized (speaker per segment) and already masked: a sensitive span's text in
 * `segment.text` is the masked form (「身份证 A12****789」); the plain value only comes back from the
 * host's audited reveal callback.
 */
import { roundShares } from "./dashboard-core.ts";
import { formatDuration } from "./media-core.ts";
import type { OptionHue } from "./option-palette.ts";

// ---------------------------------------------------------------- types

export type TranscriptSpeaker = {
  id: string;
  name: string;
  /** Second word after the name (「销售」「客户」). */
  role?: string;
  /** Avatar letter (default the first character of the name). */
  initial?: string;
  /** Colour slot in SPEAKER_TONES (default: order in the list). Speakers are categories, not states. */
  slot?: number;
};

/** A phrase the AI (or a person) tagged inside a segment: [start, end) are character offsets in `text`. */
export type TranscriptAnnotation = { kind: "annotation"; start: number; end: number; category: string };
/** A sensitive span already masked in `text` (offsets of the masked text); reveal goes through the host. */
export type TranscriptMask = { kind: "mask"; start: number; end: number; /** What it is (「身份证」). */ label?: string };
export type TranscriptSpan = TranscriptAnnotation | TranscriptMask;

export type TranscriptSegment = {
  id: string;
  speaker: string;
  /** Seconds. */
  start: number;
  end: number;
  text: string;
  spans?: readonly TranscriptSpan[];
};

/** Annotation categories are host-supplied (需求、预算、顾虑 …). Tones are brand-family, never status colours. */
export type TranscriptCategory = {
  id: string;
  label: string;
  /** The main colour family only: green (default) · teal · greenSolid (emphasis, e.g. 顾虑) · gray. */
  tone?: "green" | "teal" | "greenSolid" | "gray";
};

/** One pin over the waveform: the first annotation of a category inside a segment. */
export type TranscriptPin = { id: string; time: number; category: string; segmentId: string };
export type TranscriptSilence = { start: number; end: number; seconds: number };
export type TalkShare = { speaker: string; seconds: number; percent: number };
export type TranscriptPart =
  | { kind: "text"; text: string; start: number }
  | { kind: "annotation"; text: string; start: number; category: string }
  | { kind: "mask"; text: string; start: number; label?: string; index: number };
export type TranscriptMatch = { segmentId: string; start: number; end: number };

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

// ---------------------------------------------------------------- order & lookup

/** Segments sorted by start (stable), invalid ones (end < start, non-finite) dropped. */
export function sortSegments<S extends TranscriptSegment>(segments: readonly S[]): S[] {
  return segments
    .filter((s) => finite(s.start) && finite(s.end) && s.end >= s.start)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.start - b.s.start || a.i - b.i)
    .map((x) => x.s);
}

/**
 * Index of the segment playing at `time` (sorted segments): the last one that started at or before
 * `time`. Inside a silence after a segment it stays on that segment (the list keeps its highlight
 * until the next line starts); before the first segment it is -1. Binary search: O(log n).
 */
export function segmentIndexAt(segments: readonly TranscriptSegment[], time: number): number {
  if (!finite(time)) return -1;
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (!seg) break;
    if (seg.start <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** The segment strictly containing `time` (start ≤ t < end), or null in a silence. */
export function segmentAt<S extends TranscriptSegment>(segments: readonly S[], time: number): S | null {
  const seg = segments[segmentIndexAt(segments, time)];
  return seg && time < seg.end ? seg : null;
}

// ---------------------------------------------------------------- talk share

/**
 * Speaking time per speaker (overlaps counted for each speaker) and whole-number shares that add up
 * to 100 (largest remainder). Speakers keep the given order; unknown speakers in segments are added
 * after them. A speaker with no segments reads 0 seconds / 0%.
 */
export function talkShare(segments: readonly TranscriptSegment[], speakers: readonly Pick<TranscriptSpeaker, "id">[] = []): TalkShare[] {
  const seconds = new Map<string, number>(speakers.map((s) => [s.id, 0]));
  for (const seg of segments) {
    if (!finite(seg.start) || !finite(seg.end) || seg.end <= seg.start) continue;
    seconds.set(seg.speaker, (seconds.get(seg.speaker) ?? 0) + (seg.end - seg.start));
  }
  const ids = [...seconds.keys()];
  const values = ids.map((id) => seconds.get(id) ?? 0);
  const percents = roundShares(values);
  return ids.map((speaker, i) => ({ speaker, seconds: values[i] ?? 0, percent: percents[i] ?? 0 }));
}

// ---------------------------------------------------------------- silences

/**
 * Gaps with nobody speaking that last at least `minSeconds` (default 8): between segments, before the
 * first and — when `duration` is known — after the last. Overlapping segments merge first.
 */
export function findSilences(segments: readonly TranscriptSegment[], duration?: number | null, minSeconds = 8): TranscriptSilence[] {
  const sorted = sortSegments(segments);
  const out: TranscriptSilence[] = [];
  let cursor = 0;
  const push = (start: number, end: number) => {
    const seconds = end - start;
    if (seconds >= minSeconds) out.push({ start, end, seconds });
  };
  for (const seg of sorted) {
    if (seg.start > cursor) push(cursor, seg.start);
    cursor = Math.max(cursor, seg.end);
  }
  if (finite(duration) && duration > cursor) push(cursor, duration);
  return out;
}

/** Where playback goes when 「跳过静音」 is on: the end of the silence `time` is in, else `time`. */
export function skipSilence(time: number, silences: readonly TranscriptSilence[]): number {
  const hit = silences.find((s) => time >= s.start && time < s.end - 0.05);
  return hit ? hit.end : time;
}

/**
 * Where playback goes when only some speakers are heard (「只听客户」): `time` if one of them is
 * speaking, else the start of their next segment; null = none of them speaks again (stop).
 */
export function nextFocusTime(segments: readonly TranscriptSegment[], time: number, speakers: ReadonlySet<string>): number | null {
  const sorted = sortSegments(segments);
  if (sorted.some((s) => speakers.has(s.speaker) && time >= s.start && time < s.end)) return time;
  const next = sorted.find((s) => speakers.has(s.speaker) && s.start > time);
  return next ? next.start : null;
}

/** 「静默 12 秒」 / 「静默 1 分 12 秒」. */
export function silenceLabel(seconds: number, skipped = false): string {
  const total = Math.round(Math.max(0, seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const text = m ? `${m} 分${s ? ` ${s} 秒` : "钟"}` : `${s} 秒`;
  return skipped ? `跳过 ${text}静默` : `静默 ${text}`;
}

// ---------------------------------------------------------------- text parts

/**
 * Split a segment's text into plain / annotated / masked parts by its spans (sorted; a span that
 * overlaps an earlier one or falls outside the text is ignored). Masks are numbered in order so the
 * reveal state can be kept per span.
 */
export function splitSegmentText(text: string, spans: readonly TranscriptSpan[] = []): TranscriptPart[] {
  const valid = spans
    .filter((s) => Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end > s.start && s.end <= text.length)
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const parts: TranscriptPart[] = [];
  let cursor = 0;
  let masks = 0;
  for (const span of valid) {
    if (span.start < cursor) continue;
    if (span.start > cursor) parts.push({ kind: "text", text: text.slice(cursor, span.start), start: cursor });
    const piece = text.slice(span.start, span.end);
    if (span.kind === "mask") parts.push({ kind: "mask", text: piece, start: span.start, label: span.label, index: masks++ });
    else parts.push({ kind: "annotation", text: piece, start: span.start, category: span.category });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ kind: "text", text: text.slice(cursor), start: cursor });
  return parts;
}

/** Pins over the waveform: one per (segment, category), at the segment's start, in time order. */
export function annotationPins(segments: readonly TranscriptSegment[]): TranscriptPin[] {
  const pins: TranscriptPin[] = [];
  for (const seg of sortSegments(segments)) {
    const seen = new Set<string>();
    for (const span of seg.spans ?? []) {
      if (span.kind !== "annotation" || seen.has(span.category)) continue;
      seen.add(span.category);
      pins.push({ id: `${seg.id}:${span.category}`, time: seg.start, category: span.category, segmentId: seg.id });
    }
  }
  return pins;
}

/** Number of annotated phrases (「AI 标注 6 处」). */
export const countAnnotations = (segments: readonly TranscriptSegment[]) =>
  segments.reduce((n, s) => n + (s.spans ?? []).filter((x) => x.kind === "annotation").length, 0);

// ---------------------------------------------------------------- search

/**
 * Case-insensitive matches of `query` in the segments' text, in time order. Masked spans are never
 * searched inside (the masked text is not the real value), so a match never straddles one.
 */
export function searchTranscript(segments: readonly TranscriptSegment[], query: string): TranscriptMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const out: TranscriptMatch[] = [];
  for (const seg of sortSegments(segments)) {
    const masks = (seg.spans ?? []).filter((s): s is TranscriptMask => s.kind === "mask");
    const hay = seg.text.toLowerCase();
    let from = 0;
    for (;;) {
      const at = hay.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      if (!masks.some((m) => at < m.end && end > m.start)) out.push({ segmentId: seg.id, start: at, end });
      from = at + Math.max(1, needle.length);
    }
  }
  return out;
}

// ---------------------------------------------------------------- lanes & bars

/** Speaker lane blocks as fractions of the duration (for the coloured strip under the waveform). */
export function speakerLane(segments: readonly TranscriptSegment[], duration: number): { speaker: string; from: number; to: number; start: number; end: number }[] {
  if (!finite(duration) || duration <= 0) return [];
  return sortSegments(segments).map((s) => ({
    speaker: s.speaker,
    start: s.start,
    end: s.end,
    from: Math.max(0, Math.min(1, s.start / duration)),
    to: Math.max(0, Math.min(1, s.end / duration)),
  }));
}

/** Speaker of each waveform bar (bar centre time); null = nobody speaks there. */
export function barSpeakers(segments: readonly TranscriptSegment[], bars: number, duration: number): (string | null)[] {
  if (!finite(duration) || duration <= 0 || bars <= 0) return [];
  const sorted = sortSegments(segments);
  return Array.from({ length: Math.floor(bars) }, (_, i) => segmentAt(sorted, ((i + 0.5) / bars) * duration)?.speaker ?? null);
}

/** Axis labels: `count` evenly spaced times, the last one the duration (「00:00 … 18:05」). */
export function timeTicks(duration: number, count = 7): { time: number; label: string }[] {
  if (!finite(duration) || duration <= 0 || count < 2) return [];
  return Array.from({ length: count }, (_, i) => {
    const time = i === count - 1 ? duration : Math.round((duration / (count - 1)) * i);
    return { time, label: formatDuration(time) };
  });
}

// ---------------------------------------------------------------- text for copy / export

export type TranscriptTextOptions = {
  withTime?: boolean;
  withSpeaker?: boolean;
  /** Append 「〔需求〕」 after each annotated phrase. */
  withAnnotations?: boolean;
  categories?: readonly TranscriptCategory[];
};

/** Plain text of the transcript (always the masked form): one line per segment. */
export function transcriptText(segments: readonly TranscriptSegment[], speakers: readonly TranscriptSpeaker[], options: TranscriptTextOptions = {}): string {
  const { withTime = true, withSpeaker = true, withAnnotations = false, categories = [] } = options;
  const names = new Map(speakers.map((s) => [s.id, s.name]));
  const label = new Map(categories.map((c) => [c.id, c.label]));
  return sortSegments(segments)
    .map((seg) => {
      const body = splitSegmentText(seg.text, seg.spans)
        .map((p) => (p.kind === "annotation" && withAnnotations ? `${p.text}〔${label.get(p.category) ?? p.category}〕` : p.text))
        .join("");
      const head = [withTime ? `[${formatDuration(seg.start)}]` : "", withSpeaker ? `${names.get(seg.speaker) ?? seg.speaker}：` : ""].filter(Boolean).join(" ");
      return head ? `${head}${withSpeaker ? "" : " "}${body}` : body;
    })
    .join("\n");
}

/**
 * Row (0 or 1) of each pin so neighbours closer than `minGap` (fraction of the width) do not overlap:
 * a pin too close to the previous one on row 0 goes to row 1, unless that row is taken too (then 0).
 */
export function stackPins(positions: readonly number[], minGap = 0.07): (0 | 1)[] {
  const last: [number, number] = [-Infinity, -Infinity];
  return positions.map((p) => {
    const row: 0 | 1 = p - last[0] >= minGap ? 0 : p - last[1] >= minGap ? 1 : 0;
    last[row] = p;
    return row;
  });
}

// ---------------------------------------------------------------- speaker colours

/**
 * Speaker colours: categorical hues from the ten option colours — blue / orange / teal (青)
 * first, then violet / pink / olive / yellow — never the primary green (that is the brand, used for
 * annotations) and never red (recording / danger). Deterministic: speaker index (or `slot`) → hue, the same
 * on every load, light and dark (the CSS variables `--aui-option-<hue>*` follow the theme).
 */
export const SPEAKER_TONES: readonly OptionHue[] = ["blue", "orange", "teal", "violet", "pink", "olive", "yellow"];

/** Hue of the n-th colour slot (wraps around; negative / non-integer slots are normalised). */
export function speakerToneAt(slot: number): OptionHue {
  const n = SPEAKER_TONES.length;
  const i = Number.isFinite(slot) ? Math.trunc(slot) : 0;
  return SPEAKER_TONES[((i % n) + n) % n] ?? "blue";
}

/**
 * Hue of a speaker: its `slot` when given, else its position in `speakers`; an id that is not in the list
 * takes the slot after the listed speakers.
 */
export function speakerTone(speakers: readonly Pick<TranscriptSpeaker, "id" | "slot">[], id: string): OptionHue {
  const index = speakers.findIndex((s) => s.id === id);
  const slot = speakers[index]?.slot ?? (index < 0 ? speakers.length : index);
  return speakerToneAt(slot);
}

/** CSS colours of a hue: bar / dot (`color`), avatar background (`soft`), avatar letter (`text`). */
export function speakerColors(hue: OptionHue): { color: string; soft: string; text: string } {
  return { color: `var(--aui-option-${hue})`, soft: `var(--aui-option-${hue}-soft)`, text: `var(--aui-option-${hue}-text)` };
}

/** Count of annotated phrases per category, in first-seen order (「需求 3 · 关注 2 …」 in the side rail). */
export function annotationStats(segments: readonly TranscriptSegment[]): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const seg of sortSegments(segments)) for (const span of seg.spans ?? []) if (span.kind === "annotation") counts.set(span.category, (counts.get(span.category) ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count }));
}
