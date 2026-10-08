/**
 * Pure helpers behind the AI pieces (PromptEditor, VersionList, CompareGrid, SourcedAnswer). No React,
 * no DOM; unit-tested in test/ai-core.test.ts.
 *
 * - Prompt text: `{{变量}}` segments, the variables used, inserting one at the caret, characters and a
 *   rough token estimate (the host's real counter wins when given).
 * - Line diff (LCS) between a base version and the draft: per-line add / delete marks for the gutter
 *   and the 「改了 N 处」 count (consecutive changed lines = one place).
 * - Citation markers 「[1]」「[1,3]」 in an answer → text / citation segments.
 * - Winner tally for the A/B compare grid.
 * - Citation links: only http(s), mailto and relative hrefs may open (no `javascript:` / `data:`).
 */
import { safeDownloadUrl } from "./workflow-core.ts";

/** The href when a citation may open it (http:, https:, mailto:, relative), else undefined. */
export function safeCitationHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const value = href.trim();
  if (/^mailto:/i.test(value)) return value;
  return safeDownloadUrl(value);
}

// ---------------------------------------------------------------- variables

/** `{{客户名称}}` — names may not contain braces or line breaks. */
export const VARIABLE_PATTERN = /\{\{([^{}\n]+?)\}\}/g;

export type PromptSegment = { kind: "text"; text: string } | { kind: "var"; text: string; name: string };
/** Split a line (or a whole prompt) into plain text and `{{variable}}` segments. */
export function promptSegments(text: string): PromptSegment[] {
  const out: PromptSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(VARIABLE_PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    out.push({ kind: "var", text: m[0], name: m[1]!.trim() });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Variables used in the prompt, first-seen order, no duplicates. */
export function usedVariables(text: string): string[] {
  return [...new Set(promptSegments(text).flatMap((s) => (s.kind === "var" ? [s.name] : [])))];
}

/** Variables used but not offered by the host (typos, removed ones). */
export function unknownVariables(text: string, known: readonly string[]): string[] {
  const set = new Set(known);
  return usedVariables(text).filter((v) => !set.has(v));
}

/** Insert `{{name}}` replacing the selection; returns the new text and the caret after the variable. */
export function insertVariable(text: string, start: number, end: number, name: string): { text: string; caret: number } {
  const a = Math.max(0, Math.min(start, text.length));
  const b = Math.max(a, Math.min(end, text.length));
  const token = `{{${name}}}`;
  return { text: text.slice(0, a) + token + text.slice(b), caret: a + token.length };
}

// ---------------------------------------------------------------- counts

const CJK = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u;
/** Characters without whitespace (「共 412 字」). */
export function countChars(text: string): number {
  let n = 0;
  for (const ch of text) if (!/\s/u.test(ch)) n += 1;
  return n;
}
/**
 * Rough token estimate when the host has no tokenizer: CJK characters ≈ 1 token each, other text
 * ≈ 4 characters per token. Always shown as 「约」; pass the gateway's counter for real numbers.
 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK.test(ch)) cjk += 1;
    else if (!/\s/u.test(ch)) other += 1;
    else other += 0.25;
  }
  return Math.ceil(cjk + other / 4);
}

// ---------------------------------------------------------------- line diff

export type LineDiffOp = { kind: "same" | "add" | "del"; text: string; /** 1-based line in the base (same / del). */ oldLine?: number; /** 1-based line in the draft (same / add). */ newLine?: number };
const splitLines = (text: string) => text.replace(/\r\n?/g, "\n").split("\n");

/** Line diff base → draft (LCS; prompts are small, O(n·m) is fine). */
export function diffLines(base: string, draft: string): LineDiffOp[] {
  const a = splitLines(base);
  const b = splitLines(draft);
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const ops: LineDiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push({ kind: "same", text: a[i]!, oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      ops.push({ kind: "add", text: b[j]!, newLine: j + 1 });
      j += 1;
    } else {
      ops.push({ kind: "del", text: a[i]!, oldLine: i + 1 });
      i += 1;
    }
  }
  return ops;
}

export type LineMarks = {
  /** Draft lines (1-based) that are new or changed. */
  added: Set<number>;
  /**
   * Draft line (1-based) before which base lines were removed outright → how many (lines + 1 = at the
   * end). A changed line (deleted + added in the same run) is only in `added`.
   */
  removedBefore: Map<number, number>;
  /** 「改了 N 处」: per run of consecutive changes the larger of lines added / removed, summed. */
  places: number;
};
/** Gutter marks for the draft, from `diffLines`. */
export function lineMarks(base: string, draft: string): LineMarks {
  const added = new Set<number>();
  const removedBefore = new Map<number, number>();
  let places = 0;
  let adds = 0;
  let dels = 0;
  let next = 1;
  const close = () => {
    if (!adds && !dels) return;
    places += Math.max(adds, dels);
    if (dels > adds) removedBefore.set(next, dels - adds);
    adds = 0;
    dels = 0;
  };
  for (const op of diffLines(base, draft)) {
    if (op.kind === "same") {
      close();
      next = (op.newLine ?? next) + 1;
    } else if (op.kind === "add") {
      added.add(op.newLine ?? next);
      adds += 1;
      next = (op.newLine ?? next) + 1;
    } else dels += 1;
  }
  close();
  return { added, removedBefore, places };
}

// ---------------------------------------------------------------- citations

export type AnswerSegment = { kind: "text"; text: string } | { kind: "cite"; ids: number[] };
/** 「断网也能用[1]，见案例[2,3]。」 → text / cite segments; numbers are 1-based source indexes. */
export function answerSegments(text: string): AnswerSegment[] {
  const out: AnswerSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[(\d+(?:\s*[,，、]\s*\d+)*)\]/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    out.push({ kind: "cite", ids: m[1]!.split(/\s*[,，、]\s*/).map(Number) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
/** Source numbers cited that do not exist (the model made a citation up). */
export function missingCitations(text: string, sourceCount: number): number[] {
  const bad = new Set<number>();
  for (const s of answerSegments(text)) if (s.kind === "cite") for (const id of s.ids) if (id < 1 || id > sourceCount) bad.add(id);
  return [...bad].sort((a, b) => a - b);
}

// ---------------------------------------------------------------- compare winners

/** Per variant how many samples it won, plus ties / undecided. */
export function winnerTally(winners: Readonly<Record<string, string | null | undefined>>, samples: readonly string[], variants: readonly string[]): { wins: Map<string, number>; tie: number; open: number } {
  const wins = new Map(variants.map((v) => [v, 0] as [string, number]));
  let tie = 0;
  let open = 0;
  for (const s of samples) {
    const w = winners[s];
    if (w === undefined || w === null) open += 1;
    else if (w === "tie") tie += 1;
    else if (wins.has(w)) wins.set(w, (wins.get(w) ?? 0) + 1);
  }
  return { wins, tie, open };
}
