"use client";
/**
 * One comment of CommentThread (internal): avatar (per-person colour) · name · time ·
 * 「已编辑」, text with @mentions (主色浅底; the viewer = solid), attachments (72×54 thumbs, file cards),
 * reaction pills (icon + word + count, hover says who), and the inline tools — a small bar that floats at
 * the top right on hover / focus (回应 · 回复 · 解决 · ⋯) and is a row of small labelled actions on touch
 * screens. Also the folded line of a resolved thread and the 「展开 N 条回复」 button.
 */
import { useRef, useState, type ReactNode } from "react";
import { Check, CheckCheck, ChevronDown, CircleCheck, CircleHelp, Ellipsis, Eye, Reply, RotateCcw, SmilePlus, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "./primitives.tsx";
import { MenuButton, type MenuSection } from "./menu.tsx";
import { MediaThumb, type MediaItem } from "./media-parts.tsx";
import { PopoverLayer } from "./popover-panel.tsx";
import { Avatar } from "./avatar.tsx";
import { detectMediaKind, fileTypeLabel, formatBytes } from "./media-core.ts";
import { isEdited, isViewerMention, reactionTip, splitMentions, type CommentItem } from "./comment-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";

export type CommentReactionKind = { key: string; label: string; icon: ReactNode };
/** The four reactions (icons + words, no emoji): 赞 / 收到 / 看过 / 有疑问. */
export const DEFAULT_REACTIONS: readonly CommentReactionKind[] = [
  { key: "like", label: "赞", icon: <ThumbsUp aria-hidden="true" /> },
  { key: "ok", label: "收到", icon: <CheckCheck aria-hidden="true" /> },
  { key: "seen", label: "看过", icon: <Eye aria-hidden="true" /> },
  { key: "question", label: "有疑问", icon: <CircleHelp aria-hidden="true" /> },
];

const isImage = (item: MediaItem) => {
  const kind = item.kind ?? detectMediaKind(item.name, item.mime);
  return kind === "image" || kind === "video";
};

function Body({ comment, viewerId }: { comment: CommentItem; viewerId?: string }) {
  return (
    <p className="aui-comment-text">
      {splitMentions(comment.body, comment.mentions).map((seg, i) =>
        seg.kind === "mention" ? <span key={i} className="aui-comment-at" data-me={isViewerMention(seg, viewerId) || undefined}>{seg.text}</span> : <span key={i}>{seg.text}</span>,
      )}
    </p>
  );
}

function Attachments({ items, onOpen }: { items: readonly MediaItem[]; onOpen: (index: number) => void }) {
  if (!items.length) return null;
  return (
    <ul className="aui-comment-files" aria-label="附件">
      {items.map((item, index) =>
        isImage(item) ? (
          <li key={item.id}>
            <button type="button" className="aui-comment-file" aria-label={`查看 ${item.name}`} data-tip={item.name} disabled={item.lock?.denied} onClick={() => onOpen(index)}>
              <MediaThumb item={item} size="sm" />
            </button>
          </li>
        ) : (
          <li key={item.id}>
            <button type="button" className="aui-comment-doc" aria-label={`查看 ${item.name}`} disabled={item.lock?.denied} onClick={() => onOpen(index)}>
              <span className="aui-comment-doc-type" aria-hidden="true">{fileTypeLabel(item.name)}</span>
              <span className="aui-comment-doc-name"><b>{item.name}</b>{item.size !== undefined && <small>{fileTypeLabel(item.name)} · {formatBytes(item.size)}</small>}</span>
            </button>
          </li>
        ),
      )}
    </ul>
  );
}


/** The small confirm bubble of 删除 (小气泡确认, not a big dialog). */
export function DeleteBubble({ anchor, comment, onConfirm, onClose }: { anchor: HTMLElement | null; comment: CommentItem; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <PopoverLayer open anchor={anchor} label="删掉这条评论？" className="aui-popover aui-comment-confirm" align="end" onClose={() => !busy && onClose()}>
      <b>删掉这条评论？</b>
      <p>{comment.replies?.length ? "回复会留着，这里显示「评论已删除」。" : "删除后不能恢复。"}</p>
      {error && <p className="aui-error" role="alert">{error}</p>}
      <div className="aui-comment-confirm-actions">
        <Button size="sm" variant="outline" disabled={busy} onClick={onClose}>取消</Button>
        <Button size="sm" variant="destructive" loading={busy} onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onConfirm();
          } catch (caught) {
            setError(caught instanceof Error && caught.message ? caught.message : "删除失败，请重试");
            setBusy(false);
          }
        }}>删除</Button>
      </div>
    </PopoverLayer>
  );
}

export type CommentViewProps = {
  comment: CommentItem;
  reply?: boolean;
  kinds: readonly CommentReactionKind[];
  time: (iso: string) => string;
  viewerId?: string;
  viewerName?: string;
  readOnly?: boolean;
  onReact?: (commentId: string, key: string, on: boolean) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  onReply?: (c: CommentItem) => void;
  onOpenFile: (items: readonly MediaItem[], index: number) => void;
  /** 编辑 / 删除 menu items (none = no 「⋯」). */
  manage: MenuSection[];
  /** The inline edit composer while this comment is being edited. */
  editor?: ReactNode;
};

export function CommentView({ comment, reply, kinds, time, viewerId, viewerName, onReact, onResolve, onReply, onOpenFile, readOnly, manage, editor }: CommentViewProps) {
  const reactButton = useRef<HTMLButtonElement>(null);
  const [picking, setPicking] = useState(false);
  if (comment.deleted) {
    return (
      <article className="aui-comment" data-comment-id={comment.id} data-reply={reply || undefined} data-deleted="" aria-label="已删除的评论">
        <span className="aui-comment-gone-icon" aria-hidden="true"><Trash2 /></span>
        <p className="aui-comment-text aui-comment-gone">评论已删除</p>
      </article>
    );
  }
  const reactions = comment.reactions?.filter((r) => r.count > 0) ?? [];
  const canResolve = Boolean(!reply && onResolve && comment.canResolve !== false && !readOnly);
  const edited = isEdited(comment);
  const mine = (key: string) => Boolean(comment.reactions?.find((r) => r.key === key)?.mine);
  const tools = !readOnly && !editor && (onReact || onReply || canResolve || manage.length > 0);
  return (
    <article className="aui-comment" data-comment-id={comment.id} data-reply={reply || undefined} data-resolved={comment.resolved || undefined} data-editing={editor ? "" : undefined} data-tools-open={picking || undefined} aria-label={`${comment.author.name} 的评论`}>
      <Avatar name={comment.author.name} id={comment.author.id} size={24} />
      <div className="aui-comment-main">
        <div className="aui-comment-who">
          <b>{comment.author.name}</b>
          <time dateTime={comment.createdAt}>{time(comment.createdAt)}</time>
          {edited && (
            <span className="aui-comment-edited" data-tip={comment.editedAt ? `编辑于 ${time(comment.editedAt)}` : undefined}>
              · 已编辑{comment.editedAt && <span className="aui-sr-only">，编辑于 {time(comment.editedAt)}</span>}
            </span>
          )}
          {comment.resolved && <span className="aui-comment-resolved"><Check aria-hidden="true" />已解决{comment.resolvedBy ? ` · ${comment.resolvedBy}` : ""}</span>}
        </div>
        {editor ?? (
          <>
            <Body comment={comment} viewerId={viewerId} />
            <Attachments items={comment.attachments ?? []} onOpen={(i) => onOpenFile(comment.attachments ?? [], i)} />
          </>
        )}
        {reactions.length > 0 && !editor && (
          <div className="aui-comment-reactions">
            {reactions.map((r) => {
              const kind = kinds.find((k) => k.key === r.key);
              const label = kind?.label ?? r.key;
              return (
                <button key={r.key} type="button" className="aui-comment-reaction" aria-pressed={Boolean(r.mine)} aria-label={`${label} ${r.count}`} data-tip={reactionTip(label, r, viewerName)} disabled={!onReact || readOnly} onClick={() => onReact?.(comment.id, r.key, !r.mine)}>
                  {kind?.icon}<span aria-hidden="true">{label} {r.count}</span>
                </button>
              );
            })}
          </div>
        )}
        {tools && (
          <div className="aui-comment-hover" role="toolbar" aria-label={`${comment.author.name}的评论的操作`}>
            {onReact && (
              <button ref={reactButton} type="button" className="aui-comment-tool aui-comment-react" aria-label={`回应${comment.author.name}的评论`} aria-haspopup="dialog" aria-expanded={picking} data-tip="回应" onClick={() => setPicking((v) => !v)}>
                <SmilePlus aria-hidden="true" /><span>回应</span>
              </button>
            )}
            {onReply && (
              <button type="button" className="aui-comment-tool" aria-label="回复" data-tip="回复" onClick={() => onReply(comment)}>
                <Reply aria-hidden="true" /><span>回复</span>
              </button>
            )}
            {canResolve && (
              <button type="button" className="aui-comment-tool" data-tone={comment.resolved ? undefined : "ok"} aria-label={comment.resolved ? "重新打开" : "解决"} data-tip={comment.resolved ? "重新打开" : "标为已解决"} onClick={() => onResolve?.(comment.id, !comment.resolved)}>
                {comment.resolved ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />}<span>{comment.resolved ? "重新打开" : "解决"}</span>
              </button>
            )}
            {manage.length > 0 && (
              <MenuButton variant="ghost" className="aui-comment-tool aui-comment-more" label={`更多操作（${comment.author.name}的评论）`} aria-label={`更多操作（${comment.author.name}的评论）`} sections={manage}>
                <Ellipsis aria-hidden="true" />
              </MenuButton>
            )}
          </div>
        )}
      </div>
      {picking && onReact && (
        <PopoverLayer open anchor={reactButton.current} label={`回应${comment.author.name}的评论`} className="aui-popover aui-comment-rxpick" align="end" onClose={() => setPicking(false)}>
          {kinds.map((k) => (
            <button key={k.key} type="button" aria-pressed={mine(k.key)} onClick={() => { onReact(comment.id, k.key, !mine(k.key)); setPicking(false); }}>
              {k.icon}<span>{k.label}</span>
            </button>
          ))}
        </PopoverLayer>
      )}
    </article>
  );
}

/** A resolved thread folded into one grey line under 「全部」; click opens it. */
export function ResolvedLine({ comment, time, onOpen }: { comment: CommentItem; time: (iso: string) => string; onOpen: () => void }) {
  return (
    <button type="button" className="aui-comment-folded" data-comment-id={comment.id} aria-expanded={false} onClick={onOpen}>
      <CircleCheck aria-hidden="true" />
      <b>已解决</b>
      <span className="aui-comment-folded-text">{comment.author.name}：{comment.body || "（只有附件）"}</span>
      <span className="aui-comment-folded-by">{comment.resolvedBy ? `${comment.resolvedBy} 解决` : comment.resolvedAt ? time(comment.resolvedAt) : ""}</span>
      <ChevronDown aria-hidden="true" />
    </button>
  );
}

/** 「展开 N 条回复」 with the folded authors' avatars. */
export function MoreReplies({ folded, onOpen }: { folded: readonly CommentItem[]; onOpen: () => void }) {
  return (
    <button type="button" className="aui-comment-more-replies" onClick={onOpen}>
      <span className="aui-comment-more-avatars" aria-hidden="true">
        {folded.slice(0, 4).map((r) => <Avatar key={r.id} name={r.author.name} id={r.author.id} size={20} />)}
      </span>
      展开 {folded.length} 条回复
    </button>
  );
}
