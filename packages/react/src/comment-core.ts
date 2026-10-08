/**
 * Pure model of CommentThread (bt/records R5, demo D11): comments with @mentions, image / file
 * attachments, reactions, resolve / reopen, replies one level deep, editing / deleting one's own
 * comments (「已编辑」, tombstones 「评论已删除」); the mention autocomplete (which word the caret is in,
 * how inserting a name changes the text) and the 「只看未解决」 filter.
 * No React / DOM. The server owns ids, authors, times and permissions; these types are what the
 * adapter hands over.
 */
import type { MediaItem } from "./media-parts.tsx";

export type CommentPerson = {
  id: string;
  name: string;
  /** Second line in the @ list (department / role). */
  hint?: string;
  /**
   * this person can't see the record / page — shown greyed in the @ list with this reason
   * (「看不到这条记录，提到也收不到」) and can't be picked. Only for search results, not for authors.
   */
  unavailable?: string;
};
/**
 * The four reactions: 赞 / 收到 / 看过 / 有疑问 — icons + words, never emoji. Hosts store
 * these keys; CommentThread's `DEFAULT_REACTIONS` gives their icons and labels.
 */
export const COMMENT_REACTION_KEYS = ["like", "ok", "seen", "question"] as const;
export type CommentReactionKey = (typeof COMMENT_REACTION_KEYS)[number];
/** A reaction on a comment: `key` is one of the thread's reaction kinds (no emoji: icons + names). */
export type CommentReaction = {
  key: string;
  count: number;
  /** The viewer reacted. */
  mine?: boolean;
  /** Who reacted (shown on hover: 「收到：你、小李」); the viewer may be listed under any name — `mine` marks them. */
  names?: readonly string[];
};
/**
 * What a top-level comment is about (knowledge-base inline comments): the quoted text of
 * the selection it hangs on. `state`: `"page"` = a comment on the whole page (no selection), `"orphaned"`
 * = the quoted text was deleted (shown 「原文已删除」 with the old quote).
 */
export type CommentQuote = { text: string; state?: "page" | "orphaned" };
export type CommentItem = {
  id: string;
  author: CommentPerson;
  /** ISO time from the server. */
  createdAt: string;
  /** Plain text; `@名字` of a person in `mentions` is highlighted. */
  body: string;
  mentions?: readonly CommentPerson[];
  attachments?: readonly MediaItem[];
  reactions?: readonly CommentReaction[];
  /** Top-level comments only: resolved threads hide under 「未解决」 and fold into one grey line under 「全部」. */
  resolved?: boolean;
  resolvedBy?: string;
  /** ISO time of the resolve (shown on the folded line). */
  resolvedAt?: string;
  /** Top-level comments only: the quoted selection it is about (knowledge-base inline comments). */
  quote?: CommentQuote;
  /** Replies (one level; replies of replies are flattened by the server). */
  replies?: readonly CommentItem[];
  /** ISO time of the last edit; shows 「已编辑」 (title: when). */
  editedAt?: string;
  /** Edited without a time (older servers); `editedAt` wins. */
  edited?: boolean;
  /** Tombstone kept by the host after a delete: shows 「评论已删除」 (replies stay), no text / files / actions. */
  deleted?: boolean;
  /** Per-comment permission from the server (default: allowed when the callback exists). */
  canResolve?: boolean;
  /** Per-comment permissions from the server, read by CommentThread's default `canEdit` / `canDelete` (absent = not allowed). */
  canEdit?: boolean;
  canDelete?: boolean;
};

/** What the composer sends. `files` are the picked files (the host uploads them, or already did via `onUpload`). */
export type CommentDraft = { body: string; mentions: CommentPerson[]; replyTo?: string; attachments: MediaItem[]; files: File[] };
/**
 * Attachments of an edited comment (4th argument of `onEdit`): `attachments` = the kept old ones plus the
 * ones uploaded while editing (`onUpload`), `files` = newly picked files when there is no `onUpload`.
 */
export type CommentEditAttachments = { attachments: MediaItem[]; files: File[] };

/**
 * Server adapter of a record's comments (types only; the host implements it against its API). Every
 * call is checked on the server: who may comment, mention, resolve, delete, see attachments.
 */
export type CommentThreadAdapter = {
  list: (recordId: string, options: { cursor?: string; unresolvedOnly?: boolean; signal?: AbortSignal }) => Promise<{ items: CommentItem[]; nextCursor?: string; total: number; open: number }>;
  create: (recordId: string, draft: Omit<CommentDraft, "files">) => Promise<CommentItem>;
  react: (commentId: string, key: string, on: boolean) => Promise<void>;
  resolve: (commentId: string, resolved: boolean) => Promise<void>;
  /** Edit the viewer's own comment; the server checks authorship, sets `editedAt` and returns the new item. */
  update?: (commentId: string, draft: Omit<CommentDraft, "files" | "replyTo">) => Promise<CommentItem>;
  /** Delete; the server decides whether a tombstone (`deleted: true`) stays (e.g. when there are replies). */
  remove?: (commentId: string) => Promise<void>;
  /** People the viewer may @ (members of the record / table), searched on the server. */
  searchMentions: (query: string, signal: AbortSignal) => Promise<CommentPerson[]>;
  upload?: (files: File[], signal: AbortSignal) => Promise<MediaItem[]>;
};

export type MentionSegment = { kind: "text"; text: string } | { kind: "mention"; text: string; person: CommentPerson };

/** Split a body into text and `@名字` mentions of the given people (longest name first, so 「@小王八」 matches 「小王八」 before 「小王」). */
export function splitMentions(body: string, mentions: readonly CommentPerson[] = []): MentionSegment[] {
  if (!mentions.length) return body ? [{ kind: "text", text: body }] : [];
  const people = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const out: MentionSegment[] = [];
  let text = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "@") {
      const person = people.find((p) => p.name && body.startsWith(p.name, i + 1));
      if (person) {
        if (text) out.push({ kind: "text", text });
        text = "";
        out.push({ kind: "mention", text: `@${person.name}`, person });
        i += person.name.length + 1;
        continue;
      }
    }
    text += body[i];
    i += 1;
  }
  if (text) out.push({ kind: "text", text });
  return out;
}

/**
 * The mention being typed at the caret: an `@` at the start or after whitespace / punctuation, then up
 * to 20 characters without spaces. Returns where the `@` is and the query after it; null otherwise.
 */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  const query = before.slice(at + 1);
  if (/\s/.test(query) || query.length > 20) return null;
  const prev = at > 0 ? before[at - 1]! : "";
  if (prev && /[\p{L}\p{N}_.]/u.test(prev) && !/[一-鿿]/u.test(prev)) return null; // e-mail like a@b
  return { start: at, query };
}

/** Replace `@query` at `start…caret` with `@名字 `; returns the new text and caret. */
export function insertMention(text: string, start: number, caret: number, name: string): { text: string; caret: number } {
  const inserted = `@${name} `;
  return { text: text.slice(0, start) + inserted + text.slice(caret), caret: start + inserted.length };
}

/** People still mentioned in the text (a removed `@名字` drops its person). */
export const keptMentions = (body: string, people: readonly CommentPerson[]) => people.filter((p, i) => body.includes(`@${p.name}`) && people.findIndex((q) => q.id === p.id) === i);

/** Unresolved comments: the server's count when the list is paged (`open`), else counted from the loaded ones (tombstones don't count). */
export const openCount = (items: readonly CommentItem[], serverOpen?: number) => serverOpen ?? items.filter((c) => !c.resolved && !c.deleted).length;

/** Whether to show 「已编辑」. */
export const isEdited = (comment: CommentItem) => !comment.deleted && Boolean(comment.editedAt || comment.edited);

/**
 * Which of 编辑 / 删除 the viewer gets on a comment: only when the host gave the callback, the thread is
 * not read-only, the comment is not a tombstone and the host's predicate allows it.
 */
export function commentActions(
  comment: CommentItem,
  options: { readOnly?: boolean; onEdit?: unknown; onDelete?: unknown; canEdit: (c: CommentItem) => boolean; canDelete: (c: CommentItem) => boolean },
): { edit: boolean; delete: boolean } {
  if (options.readOnly || comment.deleted) return { edit: false, delete: false };
  return { edit: Boolean(options.onEdit) && options.canEdit(comment), delete: Boolean(options.onDelete) && options.canDelete(comment) };
}

/** Did the edit change anything (text, mentions, attachments, new files)? Empty text with no attachments is not a valid edit. */
export function editChanged(comment: CommentItem, body: string, mentions: readonly CommentPerson[], extra: CommentEditAttachments): boolean {
  const text = body.trim();
  if (!text && !extra.attachments.length && !extra.files.length) return false;
  const ids = (list: readonly { id: string }[] = []) => list.map((x) => x.id).sort().join("|");
  return text !== comment.body.trim() || ids(mentions) !== ids(comment.mentions) || ids(extra.attachments) !== ids(comment.attachments) || extra.files.length > 0;
}

/** Apply `patch` to the comment `id`, top level or reply (optimistic update / server answer). */
export function patchComment(items: readonly CommentItem[], id: string, patch: (c: CommentItem) => CommentItem): CommentItem[] {
  return items.map((c) => (c.id === id ? patch(c) : c.replies?.some((r) => r.id === id) ? { ...c, replies: c.replies.map((r) => (r.id === id ? patch(r) : r)) } : c));
}

/**
 * Remove comment `id` locally. `tombstone: true` keeps a 「评论已删除」 placeholder (text, mentions, files and
 * reactions dropped); without it the comment goes (a top-level one with its replies).
 */
export function removeComment(items: readonly CommentItem[], id: string, options: { tombstone?: boolean } = {}): CommentItem[] {
  if (options.tombstone) return patchComment(items, id, (c) => ({ ...c, deleted: true, body: "", mentions: [], attachments: [], reactions: [], resolved: false, editedAt: undefined, edited: false }));
  return items.filter((c) => c.id !== id).map((c) => (c.replies?.some((r) => r.id === id) ? { ...c, replies: c.replies.filter((r) => r.id !== id) } : c));
}

/** Toggle the viewer's reaction locally (optimistic update before the server answers). */
export function toggleReaction(reactions: readonly CommentReaction[] = [], key: string): CommentReaction[] {
  const at = reactions.findIndex((r) => r.key === key);
  if (at < 0) return [...reactions, { key, count: 1, mine: true }];
  const r = reactions[at]!;
  const next = r.mine ? { ...r, count: Math.max(0, r.count - 1), mine: false } : { ...r, count: r.count + 1, mine: true };
  return next.count > 0 ? reactions.map((x, i) => (i === at ? next : x)) : reactions.filter((_, i) => i !== at);
}

/**
 * The header segments of CommentThread: 「全部 / 未解决 N / @我 N」 (+ optional 「已解决」).
 * The default is `"open"`: resolved comments are hidden until the viewer asks for them.
 */
export type CommentFilter = "open" | "all" | "mine" | "resolved";

/** Does the comment or one of its replies @ the viewer? */
export function mentionsViewer(comment: CommentItem, viewerId: string | undefined): boolean {
  if (!viewerId) return false;
  const hit = (c: CommentItem) => !c.deleted && Boolean(c.mentions?.some((p) => p.id === viewerId));
  return hit(comment) || Boolean(comment.replies?.some(hit));
}

/**
 * Top-level comments shown under a filter: `open` = not resolved, `resolved` = resolved, `mine` = the
 * viewer is @-mentioned in it or its replies, `all` = everything. Tombstones without replies drop out of
 * every filter but `all`.
 */
export function filterComments(items: readonly CommentItem[], filter: CommentFilter, viewerId?: string): CommentItem[] {
  const gone = (c: CommentItem) => Boolean(c.deleted && !c.replies?.length);
  if (filter === "all") return items.slice();
  if (filter === "open") return items.filter((c) => !c.resolved && !gone(c));
  if (filter === "resolved") return items.filter((c) => c.resolved && !gone(c));
  return items.filter((c) => !gone(c) && mentionsViewer(c, viewerId));
}

/** Counts for the header segments (server totals win when the list is paged). */
export function commentCounts(items: readonly CommentItem[], viewerId?: string, server: { total?: number; open?: number; mine?: number } = {}) {
  const all = server.total ?? items.reduce((n, c) => n + (c.deleted ? 0 : 1) + (c.replies?.filter((r) => !r.deleted).length ?? 0), 0);
  return { all, open: openCount(items, server.open), mine: server.mine ?? items.filter((c) => mentionsViewer(c, viewerId)).length, resolved: items.filter((c) => c.resolved && !c.deleted).length };
}

/** Is `@名字` of this mention the viewer (solid highlight)? */
export const isViewerMention = (segment: MentionSegment, viewerId: string | undefined) => Boolean(viewerId && segment.kind === "mention" && segment.person.id === viewerId);

/**
 * Replies under a top-level comment: one level; when there is more than one and the
 * thread is not expanded, show the first and fold the rest into 「展开 N 条回复」 (+ their avatars).
 */
export function foldReplies(replies: readonly CommentItem[] = [], expanded: boolean): { shown: CommentItem[]; folded: CommentItem[] } {
  if (expanded || replies.length <= 1) return { shown: replies.slice(), folded: [] };
  return { shown: replies.slice(0, 1), folded: replies.slice(1) };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Day separator text: 「今天 10月7日」 / 「昨天」 / 「10月5日」 / 「2025年10月5日」 (local time). Invalid → "". */
export function commentDayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (dayKey(d) === dayKey(now)) return `今天 ${md}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return "昨天";
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}年${md}`;
}

/** Top-level comments split into runs of the same day (in the given order). */
export function groupCommentsByDay(items: readonly CommentItem[], now: Date = new Date()): { label: string; items: CommentItem[] }[] {
  const out: { label: string; items: CommentItem[] }[] = [];
  for (const c of items) {
    const label = commentDayLabel(c.createdAt, now);
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(c);
    else out.push({ label, items: [c] });
  }
  return out;
}

/** 「收到：你、小李」 — the hover text of a reaction pill (the viewer is 「你」 and goes first). */
export function reactionTip(label: string, reaction: CommentReaction, viewerName?: string): string {
  const names = [...(reaction.names ?? [])].filter((n) => n !== viewerName);
  const who = [...(reaction.mine ? ["你"] : []), ...names];
  return who.length ? `${label}：${who.join("、")}` : label;
}
