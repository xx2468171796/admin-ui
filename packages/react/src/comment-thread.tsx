"use client";
/**
 * CommentThread (bt/records R5): the one comment implementation for records, documents and
 * knowledge-base pages. Header 「评论 8」 + segments 「全部 / 未解决 4 / @我 1」 (default 未解决: resolved
 * threads stay out of sight until asked for; under 全部 each resolved thread folds into one grey line).
 * The list scrolls on its own and the composer sticks to the bottom (「回复 小王 ×」 above it while
 * replying). Day separators (今天 10月7日 / 昨天). A comment = avatar (per-person colour) · name · time ·
 * text with @mentions (the viewer's own mention is solid) · attachments (open in MediaLightbox) · reaction
 * pills (fixed to four: 赞 / 收到 / 看过 / 有疑问, icons + words, hover says who). Inline
 * tools float at the top right on hover / focus (回应 · 回复 · 解决 · ⋯) and are a row of small actions
 * on touch screens. Replies are one level; more than one fold into 「展开 N 条回复」. Own comments get
 * 编辑 (inline, the same composer: mentions and attachments work, Esc cancels, Ctrl + Enter saves) and
 * 删除 (a small confirm bubble; tombstones show 「评论已删除」, replies stay). Top-level comments may carry
 * a `quote` (the selection a knowledge-base comment hangs on) and the host can mark one `activeId` and
 * hear `onSelect` (scroll the document to the quote). Data and permissions are the host's (`comments` +
 * callbacks; `CommentThreadAdapter` in comment-core is the server contract); a failed send / save keeps
 * the text.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { MessageSquare, Pencil, Quote, Trash2 } from "lucide-react";
import { Button } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { type MenuSection } from "./menu.tsx";
import { type MediaItem } from "./media-parts.tsx";
import { MediaLightbox } from "./media-lightbox.tsx";
import { StatePanel } from "./layout.tsx";
import { formatDateTime } from "./format.ts";
import { CommentComposer } from "./comment-composer.tsx";
import { CommentView, DEFAULT_REACTIONS, DeleteBubble, MoreReplies, ResolvedLine } from "./comment-view.tsx";
import { commentActions, commentCounts, filterComments, foldReplies, groupCommentsByDay, type CommentDraft, type CommentEditAttachments, type CommentFilter, type CommentItem, type CommentPerson } from "./comment-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";

export type CommentThreadProps = {
  comments: readonly CommentItem[];
  /** Send a comment / reply; reject (Error message) to keep the text and show why. */
  onSend?: (draft: CommentDraft) => Promise<void>;
  /** People the viewer may @ (server search; only members of the record). Mark the ones who can't see it with `unavailable`. */
  searchMentions?: (query: string) => Promise<readonly CommentPerson[]> | readonly CommentPerson[];
  onReact?: (commentId: string, key: string, on: boolean) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  /** Turn picked files into attachments (upload); without it the files go along in `draft.files` (and in `onEdit`'s 4th argument). */
  onUpload?: (files: File[]) => Promise<MediaItem[]>;
  /** May the viewer edit this comment (usually: their own)? Default: the comment's `canEdit` flag (absent = no). The server checks again. */
  canEdit?: (comment: CommentItem) => boolean;
  /** May the viewer delete this comment? Default: the comment's `canDelete` flag (absent = no). The server checks again. */
  canDelete?: (comment: CommentItem) => boolean;
  /**
   * Save an edit (text, kept mentions, attachments: kept old + newly uploaded, or new `files` without
   * `onUpload`); the host sets `editedAt`. Reject (Error message) to stay in edit mode with the text.
   */
  onEdit?: (commentId: string, body: string, mentions: CommentPerson[], attachments: CommentEditAttachments) => Promise<void>;
  /** Delete after the viewer confirms in the bubble; reject to keep the bubble open with the message. Keep a tombstone with `deleted: true`, or drop the item. */
  onDelete?: (commentId: string) => Promise<void>;
  /** Heading (default 「评论」); `null` hides the header (inside a tab that already says 评论). */
  title?: string | null;
  /** The viewer's account id: 「@我」 segment, their own mentions solid, 「你」 in reaction tips. */
  viewerId?: string;
  /** The viewer's display name (dropped from reaction tips in favour of 「你」). */
  viewerName?: string;
  /** Header segment (controlled when given). Default `"open"` (未解决). */
  filter?: CommentFilter;
  /** Uncontrolled start segment (default `"open"`). */
  defaultFilter?: CommentFilter;
  /** Segment changed (a paged host refetches with its status). */
  onFilterChange?: (filter: CommentFilter) => void;
  /** Which segments to show (default 全部 / 未解决 / @我 — @我 only with `viewerId`). Add `"resolved"` for 已解决. */
  filters?: readonly CommentFilter[];
  /** Total from the server when the list is paged (default: counted from `comments`). */
  total?: number;
  /** Unresolved total from the server when the list is paged (default: counted from `comments`). */
  open?: number;
  /** 「@我」 total from the server when paged. */
  mentionsMe?: number;
  /** The highlighted thread (knowledge base: the one whose quote is selected in the document). */
  activeId?: string | null;
  /** A thread was clicked (not on one of its buttons): scroll the document to its quote. */
  onSelect?: (commentId: string) => void;
  /** Something above the composer (a host notice: 「对方看不到这页，是否授予阅读？」). */
  composerNotice?: ReactNode;
  /** Time text (default 「15:02」 under the day separators; 「10-05 15:02」 when `groupByDay` is off). */
  formatTime?: (iso: string) => string;
  /** Day separators 「今天 10月7日 / 昨天」 between top-level comments (default on). */
  groupByDay?: boolean;
  placeholder?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Show older comments (server paging). */
  onLoadMore?: () => void;
  /** No composer and no resolve / react / edit / delete (read-only viewers). */
  readOnly?: boolean;
  /** Without the card frame (inside a record tab). */
  bare?: boolean;
  /** Fill the parent's height: the list scrolls, the composer stays at the bottom (record side column, document side panel). */
  fill?: boolean;
};

const dateTime = (iso: string) => {
  const text = formatDateTime(iso, { time: true }) ?? "";
  return text.startsWith(String(new Date().getFullYear())) ? text.slice(5) : text;
};
const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const flagEdit = (c: CommentItem) => c.canEdit === true;
const flagDelete = (c: CommentItem) => c.canDelete === true;
const selectorId = (id: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&"));
const EMPTY: Record<CommentFilter, [string, string]> = {
  all: ["还没有评论", "有问题 @ 同事，他会收到通知"],
  open: ["没有未解决的评论", "已解决的在「全部」里"],
  mine: ["没有提到你的评论", "别人 @ 你时会出现在这里，也会收到通知"],
  resolved: ["没有已解决的评论", ""],
};

function QuoteLine({ comment }: { comment: CommentItem }) {
  const q = comment.quote;
  if (!q) return null;
  return (
    <div className="aui-comment-quote" data-state={q.state}>
      <Quote aria-hidden="true" />
      {q.state === "orphaned" && <span className="aui-comment-quote-tag">原文已删除</span>}
      <span className="aui-comment-quote-text">{q.text || (q.state === "page" ? "全文评论" : "")}</span>
    </div>
  );
}

/** See the module comment. */
export function CommentThread({ comments, onSend, searchMentions, onReact, onResolve, onUpload, canEdit = flagEdit, canDelete = flagDelete, onEdit, onDelete, title = "评论", viewerId, viewerName, filter: controlledFilter, defaultFilter = "open", onFilterChange, filters, total, open: serverOpen, mentionsMe, activeId, onSelect, composerNotice, formatTime, groupByDay = true, placeholder = "写评论，@ 提到同事，他会收到通知", loading, error, onRetry, onLoadMore, readOnly, bare, fill }: CommentThreadProps) {
  const [own, setOwn] = useState<CommentFilter>(defaultFilter);
  const filter: CommentFilter = controlledFilter ?? own;
  const setFilter = (next: CommentFilter) => {
    if (onFilterChange) onFilterChange(next);
    if (controlledFilter === undefined) setOwn(next);
  };
  const time = formatTime ?? (groupByDay ? clock : dateTime);
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [viewer, setViewer] = useState<{ items: readonly MediaItem[]; index: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CommentItem | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState("");
  const root = useRef<HTMLElement>(null);
  /** Where focus goes after edit / delete: the comment's 「⋯」 (edit) or the composer / list (delete). */
  const refocus = useRef<{ kind: "more"; id: string } | { kind: "after-delete" } | null>(null);
  const shown = useMemo(() => filterComments(comments, filter, viewerId), [comments, filter, viewerId]);
  const counts = commentCounts(comments, viewerId, { total, open: serverOpen, mine: mentionsMe });
  const segments = (filters ?? (viewerId ? ["all", "open", "mine"] : ["all", "open"])) as readonly CommentFilter[];
  useEffect(() => {
    const target = refocus.current;
    if (!target || editingId || deleting) return;
    refocus.current = null;
    // Two frames: after React commits and after the bubble's own focus return.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const el = root.current;
        if (!el) return;
        const found = target.kind === "more"
          ? el.querySelector<HTMLElement>(`[data-comment-id="${selectorId(target.id)}"] .aui-comment-more`)
          : el.querySelector<HTMLElement>(".aui-comment-composer textarea") ?? el.querySelector<HTMLElement>(".aui-comments-list button:not(:disabled)");
        found?.focus();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId, deleting, comments]);
  const stopEditing = (id: string, message = "") => {
    refocus.current = { kind: "more", id };
    setEditingId(null);
    setStatus(message);
  };
  const manageOf = (c: CommentItem): MenuSection[] => {
    const allowed = commentActions(c, { readOnly, onEdit, onDelete, canEdit, canDelete });
    const sections: MenuSection[] = [];
    if (allowed.edit) sections.push({ key: "edit", items: [{ key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => { setStatus(""); setEditingId(c.id); } }] });
    if (allowed.delete) sections.push({ key: "delete", items: [{ key: "delete", label: "删除", icon: <Trash2 />, danger: true, onSelect: () => setDeleting(c) }] });
    return sections;
  };
  const editorOf = (c: CommentItem) =>
    editingId === c.id && onEdit ? (
      <CommentComposer editing={c} placeholder={placeholder} searchMentions={searchMentions} onUpload={onUpload} onCancel={() => stopEditing(c.id)}
        onSubmit={async (draft) => { await onEdit(c.id, draft.body, draft.mentions, { attachments: draft.attachments, files: draft.files }); stopEditing(c.id, "评论已保存"); }} />
    ) : undefined;
  const view = (c: CommentItem, parent?: CommentItem) => (
    <CommentView key={c.id} comment={c} reply={Boolean(parent)} kinds={DEFAULT_REACTIONS} time={time} viewerId={viewerId} viewerName={viewerName} readOnly={readOnly} onReact={onReact} onResolve={onResolve}
      onReply={onSend && !readOnly ? () => setReplyTo(parent ?? c) : undefined} onOpenFile={(items, index) => setViewer({ items, index })} manage={manageOf(c)} editor={editorOf(c)} />
  );
  const select = (id: string) => (event: MouseEvent<HTMLDivElement>) => {
    if (!onSelect || (event.target instanceof Element && event.target.closest("button, a, input, textarea, [role=menu]"))) return;
    onSelect(id);
  };
  const thread = (c: CommentItem) => {
    if (c.resolved && filter === "all" && !expanded.has(c.id)) {
      return <div key={c.id} className="aui-comment-thread" data-folded=""><ResolvedLine comment={c} time={time} onOpen={() => setExpanded((s) => new Set(s).add(c.id))} /></div>;
    }
    const { shown: replies, folded } = foldReplies(c.replies, unfolded.has(c.id));
    return (
      <div key={c.id} className="aui-comment-thread" data-active={activeId === c.id || undefined} data-selectable={onSelect ? "" : undefined} onClick={select(c.id)}>
        <QuoteLine comment={c} />
        {view(c)}
        {replies.map((r) => view(r, c))}
        {folded.length > 0 && <MoreReplies folded={folded} onOpen={() => setUnfolded((s) => new Set(s).add(c.id))} />}
      </div>
    );
  };
  const [emptyTitle, emptyHint] = EMPTY[filter];
  return (
    <section ref={root} className="aui-comments" data-bare={bare || undefined} data-fill={fill || undefined} aria-label={title ?? "评论"}>
      {title !== null && (
        <div className="aui-comments-head">
          <h3>{title}<span className="aui-comments-count" aria-label={`共 ${counts.all} 条，${counts.open} 条未解决`}>{counts.all}</span></h3>
          {segments.length > 1 && (
            <SegmentedControl size="sm" className="aui-comments-filter" label="评论筛选" value={filter} onValueChange={setFilter}
              options={segments.map((f) => ({ value: f, label: f === "all" ? "全部" : f === "open" ? `未解决 ${counts.open}` : f === "mine" ? `@我 ${counts.mine}` : `已解决 ${counts.resolved}` }))} />
          )}
        </div>
      )}
      <div className="aui-comments-list" aria-live="polite">
        {loading && !comments.length ? <StatePanel kind="loading" /> : error ? <StatePanel kind="error" message={error} onRetry={onRetry} /> : !shown.length ? (
          <div className="aui-comments-empty">
            <span className="aui-comments-empty-icon" aria-hidden="true"><MessageSquare /></span>
            <b>{comments.length || filter !== "all" ? emptyTitle : EMPTY.all[0]}</b>
            {emptyHint && <span className="aui-note">{emptyHint}</span>}
          </div>
        ) : groupByDay ? (
          groupCommentsByDay(shown).map((group, i) => (
            <Fragment key={`${group.label}-${i}`}>
              {group.label && <div className="aui-comments-day" role="separator" aria-label={group.label}><span>{group.label}</span></div>}
              {group.items.map(thread)}
            </Fragment>
          ))
        ) : (
          shown.map(thread)
        )}
        {onLoadMore && <Button size="sm" variant="ghost" className="aui-comments-older" onClick={onLoadMore}>查看更早的评论</Button>}
      </div>
      <p className="aui-sr-only" role="status">{status}</p>
      {onSend && !readOnly && (
        <div className="aui-comments-foot">
          {composerNotice}
          <CommentComposer onSubmit={onSend} searchMentions={searchMentions} onUpload={onUpload} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} placeholder={placeholder} />
        </div>
      )}
      {viewer && <MediaLightbox open items={viewer.items} index={viewer.index} onIndexChange={(index) => setViewer({ ...viewer, index })} onClose={() => setViewer(null)} />}
      {onDelete && deleting && (
        <DeleteBubble comment={deleting} anchor={root.current?.querySelector<HTMLElement>(`[data-comment-id="${selectorId(deleting.id)}"] .aui-comment-more`) ?? null}
          onClose={() => { refocus.current = { kind: "more", id: deleting.id }; setDeleting(null); }}
          onConfirm={async () => {
            await onDelete(deleting.id);
            refocus.current = { kind: "after-delete" };
            setDeleting(null);
            setStatus("评论已删除");
          }} />
      )}
    </section>
  );
}
