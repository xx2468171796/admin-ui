"use client";
/**
 * NotificationCenter bodies: the 通知 list (grouped 今天 / 昨天 / 更早, unread dot that
 * turns into 「标为已读」 on hover) and the 「待我处理」 list (grouped by module, approve / reject in place, a
 * reason box before a reject). Shared states: skeleton, error + 重试, empty, 「加载更多」. Styles in
 * styles/notification-center.css.
 */
import { useRef, useState, type ReactNode } from "react";
import { AtSign, Bell, Check, CheckCheck, Inbox } from "lucide-react";
import { Avatar } from "./avatar.tsx";
import { IconButton } from "./buttons.tsx";
import { StatePanel } from "./layout.tsx";
import { ContentSkeleton } from "./loading.tsx";
import { Button, Textarea } from "./primitives.tsx";
import { groupInboxByModule, groupNotificationsByDay, relativeTimeText } from "./notification-core.ts";
import { errorText, type PagedList } from "./notification-center-load.ts";
import type { InboxAction, InboxItem, NotificationActor, NotificationItem } from "./notification-center.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/notification-center.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/notification-center.css";

function Who({ actor, kindIcon, tone }: { actor?: NotificationActor; kindIcon?: ReactNode; tone?: NotificationItem["tone"] }) {
  return (
    <span className="aui-ncenter-who" aria-hidden="true">
      {actor ? (
        <>
          <Avatar name={actor.name} id={actor.id} src={actor.avatar} size={32} />
          {kindIcon && <span className="aui-ncenter-kind" data-tone={tone === "default" ? undefined : tone}>{kindIcon}</span>}
        </>
      ) : (
        <span className="aui-ncenter-sys" data-tone={tone === "default" ? undefined : tone}>{kindIcon ?? <Bell />}</span>
      )}
    </span>
  );
}

function Meta({ parts, at, now }: { parts: readonly (ReactNode | undefined)[]; at: string | Date; now: Date }) {
  const shown = parts.filter((part) => part !== undefined && part !== null && part !== "");
  return (
    <span className="aui-ncenter-meta">
      {shown.map((part, i) => (
        <span key={i}>{part}<span aria-hidden="true"> · </span></span>
      ))}
      <time dateTime={safeIso(at)}>{relativeTimeText(at, now)}</time>
    </span>
  );
}
function safeIso(value: string | Date): string | undefined {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** First load / error / empty / 「加载更多」 around a list body. */
function ListFrame<T>({ list, empty, children }: { list: PagedList<T>; empty: { title: string; text: string; icon: ReactNode }; children: ReactNode }) {
  if (list.status === "loading") return <div className="aui-ncenter-state"><ContentSkeleton rows={3} avatar /></div>;
  if (list.status === "error")
    return (
      <div className="aui-ncenter-state" data-kind="error">
        <StatePanel kind="error" message={list.error ?? "没加载出来"} onRetry={list.retry} />
      </div>
    );
  if (!list.items.length)
    return (
      <div className="aui-ncenter-empty" role="status">
        <span className="aui-ncenter-empty-icon" aria-hidden="true">{empty.icon}</span>
        <strong>{empty.title}</strong>
        <span>{empty.text}</span>
      </div>
    );
  return (
    <>
      {children}
      {list.hasMore && (
        <div className="aui-ncenter-more">
          {list.moreError && <span className="aui-ncenter-error" role="alert">{list.moreError}</span>}
          <Button variant="ghost" size="sm" loading={list.loadingMore} onClick={list.loadMore}>
            {list.moreError ? "重试" : "加载更多"}
          </Button>
        </div>
      )}
    </>
  );
}

export type NotificationListProps = {
  list: PagedList<NotificationItem>;
  filter: "all" | "unread" | "mentions";
  now: Date;
  onOpen: (item: NotificationItem) => void;
  onMarkRead: (item: NotificationItem) => void;
  onAction?: (item: NotificationItem, key: string) => void | Promise<void>;
};

export function NotificationList({ list, filter, now, onOpen, onMarkRead, onAction }: NotificationListProps) {
  const [pending, setPending] = useState<Record<string, string | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const act = async (item: NotificationItem, key: string) => {
    if (!onAction) return;
    if (!item.read) onMarkRead(item);
    setErrors((e) => ({ ...e, [item.id]: undefined }));
    setPending((p) => ({ ...p, [item.id]: key }));
    try {
      await onAction(item, key);
    } catch (error) {
      setErrors((e) => ({ ...e, [item.id]: errorText(error, "没办成，请重试") }));
    } finally {
      setPending((p) => ({ ...p, [item.id]: undefined }));
    }
  };
  const empty =
    filter === "unread"
      ? { title: "都看完了", text: "@ 你、分配给你、等你处理的都会在这里", icon: <CheckCheck /> }
      : filter === "mentions"
        ? { title: "没有人 @ 你", text: "评论里 @ 你的话会显示在这里", icon: <AtSign /> }
        : { title: "还没有通知", text: "@ 你、分配给你、等你处理的都会在这里", icon: <Bell /> };
  return (
    <ListFrame list={list} empty={empty}>
      {groupNotificationsByDay(list.items, now).map((group) => (
        <div key={group.group} role="group" aria-label={group.group} className="aui-ncenter-group">
          <div className="aui-ncenter-day" aria-hidden="true">{group.group}</div>
          {group.items.map((item) => (
            <div key={item.id} className="aui-ncenter-item" data-unread={!item.read || undefined} data-tone={item.tone === "default" ? undefined : item.tone}>
              <button type="button" className="aui-ncenter-main" onClick={() => onOpen(item)}>
                <Who actor={item.actor} kindIcon={item.kindIcon} tone={item.tone} />
                <span className="aui-ncenter-body">
                  {!item.read && <span className="aui-sr-only">未读，</span>}
                  <span className="aui-ncenter-msg">{item.title}</span>
                  {item.quote && <span className="aui-ncenter-quote">{item.quote}</span>}
                  <Meta parts={[item.source]} at={item.createdAt} now={now} />
                </span>
              </button>
              {(item.actions?.length || errors[item.id]) && (
                <div className="aui-ncenter-acts">
                  {item.actions?.map((action) => (
                    <Button key={action.key} variant="outline" size="sm" loading={pending[item.id] === action.key} disabled={Boolean(pending[item.id]) && pending[item.id] !== action.key} onClick={() => void act(item, action.key)}>
                      {action.label}
                    </Button>
                  ))}
                  {errors[item.id] && <span className="aui-ncenter-error" role="alert">{errors[item.id]}</span>}
                </div>
              )}
              {!item.read && (
                <>
                  <span className="aui-ncenter-dot" aria-hidden="true" />
                  <span className="aui-ncenter-hover">
                    <IconButton
                      size="xs"
                      label="标为已读"
                      icon={<Check />}
                      onClick={(event) => {
                        const row = event.currentTarget.closest(".aui-ncenter-item");
                        onMarkRead(item);
                        row?.querySelector<HTMLElement>(".aui-ncenter-main")?.focus({ preventScroll: true });
                      }}
                    />
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </ListFrame>
  );
}

type InboxUi = { pending?: string; error?: string; reasonFor?: string; reason?: string; reasonError?: string; leaving?: boolean };

export type InboxListProps = {
  list: PagedList<InboxItem>;
  now: Date;
  onOpen?: (item: InboxItem) => void;
  onAction?: (item: InboxItem, action: InboxAction, input: { reason?: string }) => Promise<void>;
  /** An action on this item started / settled (the 待我处理 count drops on success). */
  onPending: (id: string) => void;
  onSettled: (id: string, ok: boolean) => void;
  /** Where focus goes when the last item leaves. */
  fallbackFocus: () => void;
};

export function InboxList({ list, now, onOpen, onAction, onPending, onSettled, fallbackFocus }: InboxListProps) {
  const [ui, setUi] = useState<Record<string, InboxUi | undefined>>({});
  const rows = useRef(new Map<string, HTMLDivElement>());
  const patch = (id: string, next: Partial<InboxUi> | null) => setUi((all) => ({ ...all, [id]: next === null ? undefined : { ...all[id], ...next } }));

  const leave = (item: InboxItem) => {
    patch(item.id, { leaving: true, pending: undefined });
    window.setTimeout(() => {
      const row = rows.current.get(item.id);
      const hadFocus = Boolean(row && document.activeElement && row.contains(document.activeElement));
      const ids = list.items.map((i) => i.id);
      const at = ids.indexOf(item.id);
      const nextId = ids[at + 1] ?? ids[at - 1];
      list.setItems((items) => items.filter((i) => i.id !== item.id));
      patch(item.id, null);
      if (hadFocus) {
        const next = nextId ? rows.current.get(nextId)?.querySelector<HTMLElement>("button:not([disabled])") : null;
        if (next) next.focus({ preventScroll: true });
        else fallbackFocus();
      }
    }, 200);
  };

  const run = async (item: InboxItem, action: InboxAction, reason?: string) => {
    if (!onAction) return;
    if (action.needsReason && reason === undefined) {
      patch(item.id, { reasonFor: action.key, reason: "", reasonError: undefined, error: undefined });
      return;
    }
    if (action.reasonRequired && !reason?.trim()) {
      patch(item.id, { reasonError: `请写${action.label}的原因` });
      return;
    }
    patch(item.id, { pending: action.key, error: undefined, reasonError: undefined });
    onPending(item.id);
    try {
      await onAction(item, action, { reason: reason?.trim() || undefined });
      onSettled(item.id, true);
      leave(item);
    } catch (error) {
      onSettled(item.id, false);
      patch(item.id, { pending: undefined, error: errorText(error, "没办成，请重试") });
    }
  };

  return (
    <ListFrame list={list} empty={{ title: "没有要你处理的事", text: "审批、权限申请轮到你时会出现在这里", icon: <Inbox /> }}>
      {groupInboxByModule(list.items).map((group) => (
        <div key={group.module} role="group" aria-label={`${group.label} ${group.items.length} 件`} className="aui-ncenter-group">
          <div className="aui-ncenter-day" aria-hidden="true">
            {group.label}
            <span className="aui-ncenter-day-n">{group.items.length}</span>
          </div>
          {group.items.map((item) => {
            const state = ui[item.id] ?? {};
            const reasonAction = item.actions?.find((a) => a.key === state.reasonFor);
            const body = (
              <>
                <Who actor={item.requester} />
                <span className="aui-ncenter-body">
                  <span className="aui-ncenter-msg">{item.title}</span>
                  {item.summary && <span className="aui-ncenter-summary">{item.summary}</span>}
                  <Meta parts={[item.kind]} at={item.createdAt} now={now} />
                </span>
              </>
            );
            return (
              <div
                key={item.id}
                ref={(node) => {
                  if (node) rows.current.set(item.id, node);
                  else rows.current.delete(item.id);
                }}
                className="aui-ncenter-item"
                data-inbox=""
                data-leaving={state.leaving || undefined}
              >
                {onOpen ? (
                  <button type="button" className="aui-ncenter-main" onClick={() => onOpen(item)}>{body}</button>
                ) : (
                  <div className="aui-ncenter-main" data-static="">{body}</div>
                )}
                {item.actions?.length && !reasonAction ? (
                  <div className="aui-ncenter-acts">
                    {item.actions.map((action) => (
                      <Button
                        key={action.key}
                        size="sm"
                        variant={action.tone === "primary" ? "default" : action.tone === "danger" ? "destructive-outline" : "outline"}
                        loading={state.pending === action.key}
                        disabled={Boolean(state.pending) && state.pending !== action.key}
                        onClick={() => void run(item, action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {reasonAction && (
                  <div className="aui-ncenter-reason">
                    <Textarea
                      autoFocus
                      minRows={2}
                      maxRows={5}
                      maxLength={200}
                      aria-label={`${reasonAction.label}的原因`}
                      aria-invalid={state.reasonError ? true : undefined}
                      placeholder={reasonAction.reasonRequired ? `${reasonAction.label}的原因（必填，对方能看到）` : `${reasonAction.label}的原因（选填，对方能看到）`}
                      value={state.reason ?? ""}
                      onChange={(event) => patch(item.id, { reason: event.target.value, reasonError: undefined })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          void run(item, reasonAction, state.reason ?? "");
                        }
                      }}
                    />
                    {state.reasonError && <span className="aui-ncenter-error" role="alert">{state.reasonError}</span>}
                    <div className="aui-ncenter-acts">
                      <Button size="sm" variant={reasonAction.tone === "primary" ? "default" : "destructive-outline"} loading={state.pending === reasonAction.key} onClick={() => void run(item, reasonAction, state.reason ?? "")}>
                        确认{reasonAction.label}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={Boolean(state.pending)} onClick={() => {
                          patch(item.id, { reasonFor: undefined, reason: undefined, reasonError: undefined });
                          window.setTimeout(() => rows.current.get(item.id)?.querySelector<HTMLElement>(".aui-ncenter-acts button")?.focus({ preventScroll: true }), 0);
                        }}>
                        取消
                      </Button>
                    </div>
                  </div>
                )}
                {state.error && <span className="aui-ncenter-error" role="alert">{state.error}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </ListFrame>
  );
}
