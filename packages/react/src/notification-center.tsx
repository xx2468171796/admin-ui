"use client";
/**
 * NotificationCenter: the topbar bell with a red unread badge (99+) and a 420px panel
 * hung under it (same outer shape as PopoverPanel, positioned by PopoverLayer). Two tabs: 「通知」 (the tongzhi
 * inbox — 全部 / 未读 / @我, grouped 今天 / 昨天 / 更早) and 「待我处理」 (things modules list for me: approve /
 * reject in place). Data comes only from the host's loaders; no business code here. On phones it is a
 * full-height sheet. Styles in styles/notification-center.css.
 */
import { useCallback, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { IconButton } from "./buttons.tsx";
import { SegmentedControl } from "./choices.tsx";
import { useIsMobile } from "./media-query.ts";
import { PopoverLayer } from "./popover-panel.tsx";
import { Button } from "./primitives.tsx";
import { markReadLocal, unreadBadgeText } from "./notification-core.ts";
import { errorText, usePagedList, usePendingCount } from "./notification-center-load.ts";
import { InboxList, NotificationList } from "./notification-center-lists.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/notification-center.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/notification-center.css";

export type NotificationActor = { id?: string; name: string; avatar?: string };
export type NotificationItem = {
  id: string;
  /** One sentence; bold the person / record with <b> in ReactNode, or a plain string. */
  title: ReactNode;
  /** Quoted original words (comment / @ text), shown in a grey quote block. */
  quote?: string;
  actor?: NotificationActor;
  /** Small type icon on the avatar's corner (Lucide element). */
  kindIcon?: ReactNode;
  tone?: "default" | "attention" | "danger";
  /** 「CRM · 智能家居客户」 shown before the time. */
  source?: string;
  createdAt: string | Date;
  read: boolean;
  /** Is it an @me? (filter chip 「@我」 when the host passes `mentions`). */
  mention?: boolean;
  /** Inline actions done in place (导出 → 下载). */
  actions?: readonly { key: string; label: string }[];
};
export type NotificationPage<T> = { items: readonly T[]; nextCursor?: string | null };
export type InboxAction = {
  key: string;
  label: string;
  tone?: "primary" | "danger" | "default";
  /** Ask for a reason first (reject). */
  needsReason?: boolean;
  reasonRequired?: boolean;
};
export type InboxItem = {
  id: string;
  module: string;
  moduleLabel?: string;
  kind?: string;
  title: ReactNode;
  summary?: ReactNode;
  requester?: NotificationActor;
  createdAt: string | Date;
  href?: string;
  actions?: readonly InboxAction[];
};
export type NotificationFilter = "all" | "unread" | "mentions";
export type NotificationCenterTab = "notifications" | "inbox";
export type NotificationCenterProps = {
  /** Unread notifications (badge on the bell; 99+). */
  unreadCount: number;
  /** 「待我处理」 count (shown on its tab; the bell badge = unreadCount + inboxCount). */
  inboxCount?: number;
  loadNotifications: (query: { cursor?: string | null; filter: NotificationFilter; signal: AbortSignal }) => Promise<NotificationPage<NotificationItem>>;
  markRead: (ids: readonly string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Omit = no 「待我处理」 tab. */
  loadInbox?: (query: { cursor?: string | null; signal: AbortSignal }) => Promise<NotificationPage<InboxItem>>;
  /** Approve / reject / custom in place; reject → reason prompt first when needsReason. Reject the promise to show the error inline (item stays). Resolve = item leaves the list. */
  onInboxAction?: (item: InboxItem, action: InboxAction, input: { reason?: string }) => Promise<void>;
  /** A notification inline action (下载). */
  onNotificationAction?: (item: NotificationItem, actionKey: string) => void | Promise<void>;
  /** Click on a row: host navigates (the center marks a notification read first and closes). */
  onOpen?: (item: NotificationItem | InboxItem, kind: "notification" | "inbox") => void;
  /** Bump to reload the open list (realtime 「有新通知」). */
  refreshKey?: unknown;
  /** Show the 「@我」 filter. */
  mentions?: boolean;
  /** Bell / panel name (default 「通知」). */
  label?: string;
  /** Optional controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: NotificationCenterTab;
  /** Clock for the day groups and relative times (tests). */
  now?: () => Date;
};

const NO_INBOX = () => Promise.resolve({ items: [] as InboxItem[] });

/** Topbar bell + notification panel with 「通知」 / 「待我处理」. */
export function NotificationCenter(props: NotificationCenterProps) {
  const { unreadCount, inboxCount = 0, loadNotifications, markRead, markAllRead, loadInbox, onInboxAction, onNotificationAction, onOpen, refreshKey, mentions, label = "通知", defaultTab = "notifications" } = props;
  const mobile = useIsMobile();
  const id = useId();
  const [bell, setBell] = useState<HTMLButtonElement | null>(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = props.open ?? ownOpen;
  const onOpenChange = props.onOpenChange;
  const setOpen = useCallback((next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);
  const [tab, setTab] = useState<NotificationCenterTab>(loadInbox ? defaultTab : "notifications");
  const shownTab: NotificationCenterTab = loadInbox ? tab : "notifications";
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const shownFilter: NotificationFilter = filter === "mentions" && !mentions ? "all" : filter;
  const reads = usePendingCount(unreadCount);
  const allRead = usePendingCount(unreadCount);
  const done = usePendingCount(inboxCount, false);
  const [notice, setNotice] = useState<string | null>(null);
  const [allPending, setAllPending] = useState(false);
  const unread = allRead.active ? 0 : reads.shown;
  const waiting = loadInbox ? done.shown : 0;
  const nowRef = useRef(props.now);
  nowRef.current = props.now;
  const now = (nowRef.current ?? (() => new Date()))();

  const loadNotes = useRef(loadNotifications);
  loadNotes.current = loadNotifications;
  const notes = usePagedList<NotificationItem>(open && shownTab === "notifications", `n:${shownFilter}`, (cursor, signal) => loadNotes.current({ cursor, filter: shownFilter, signal }), refreshKey);
  const loadTodo = useRef(loadInbox ?? NO_INBOX);
  loadTodo.current = loadInbox ?? NO_INBOX;
  const todo = usePagedList<InboxItem>(open && shownTab === "inbox", "inbox", (cursor, signal) => loadTodo.current({ cursor, signal }), refreshKey);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setNotice(null);
    if (returnFocus) bell?.focus({ preventScroll: true });
  };

  const markOne = (item: NotificationItem) => {
    if (item.read) return;
    notes.setItems((items) => markReadLocal(items, [item.id]));
    reads.start(item.id);
    markRead([item.id]).then(
      () => reads.finish(item.id, true),
      (error: unknown) => {
        reads.finish(item.id, false);
        notes.setItems((items) => items.map((i) => (i.id === item.id ? { ...i, read: false } : i)));
        setNotice(errorText(error, "标为已读没成功，请重试"));
      },
    );
  };
  const markAll = async () => {
    const before = notes.items;
    setNotice(null);
    setAllPending(true);
    notes.setItems((items) => markReadLocal(items, "all"));
    allRead.start("all");
    try {
      await markAllRead();
      allRead.finish("all", true);
    } catch (error) {
      allRead.finish("all", false);
      notes.setItems(before);
      setNotice(errorText(error, "全部已读没成功，请重试"));
    } finally {
      setAllPending(false);
    }
  };
  const hasUnread = unread > 0 || notes.items.some((item) => !item.read);

  const tabs: { key: NotificationCenterTab; label: string; count: number }[] = [
    { key: "notifications", label, count: unread },
    { key: "inbox", label: "待我处理", count: waiting },
  ];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const at = tabs.findIndex((t) => t.key === shownTab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const target = tabs[next];
    if (!target) return;
    setTab(target.key);
    tabRefs.current[next]?.focus();
  };

  const filters = [
    { value: "all" as const, label: "全部" },
    { value: "unread" as const, label: "未读" },
    ...(mentions ? [{ value: "mentions" as const, label: "@我" }] : []),
  ];
  const allReadButton = (
    <Button variant="ghost" size="sm" className="aui-ncenter-allread" loading={allPending} disabled={!hasUnread} onClick={() => void markAll()}>
      <CheckCheck aria-hidden="true" />
      全部已读
    </Button>
  );
  const badge = unreadBadgeText(unread + waiting);
  const bellName = [label, unread ? `${unread} 条未读` : "", waiting ? `${waiting} 件待我处理` : ""].filter(Boolean).join("，");
  const panelId = `${id}panel`;

  return (
    <span className="aui-ncenter-bell">
      <IconButton
        ref={setBell}
        label={bellName}
        tooltip={label}
        icon={<Bell />}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen(!open)}
      />
      {badge && <span className="aui-count aui-ncenter-badge" data-tone="danger" aria-hidden="true">{badge}</span>}
      <PopoverLayer
        open={open}
        anchor={bell}
        label={label}
        onClose={close}
        className="aui-popover aui-ncenter"
        align="end"
        style={{ "--aui-popover-width": "420px" } as CSSProperties}
        sheet={{
          title: label,
          end: (
            <>
              {allReadButton}
              <IconButton label="关闭" icon={<X />} size="md" onClick={() => close(true)} />
            </>
          ),
        }}
      >
        {!mobile && (
          <div className="aui-ncenter-head">
            <strong className="aui-ncenter-title">{label}</strong>
            {allReadButton}
          </div>
        )}
        <div className="aui-ncenter-bar">
          {loadInbox && (
            <div role="tablist" aria-label={label} className="aui-ncenter-tabs" onKeyDown={onTabKey}>
              {tabs.map((t, i) => (
                <button
                  key={t.key}
                  ref={(node) => {
                    tabRefs.current[i] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${id}tab-${t.key}`}
                  aria-selected={shownTab === t.key}
                  aria-controls={panelId}
                  tabIndex={shownTab === t.key ? 0 : -1}
                  data-autofocus={shownTab === t.key ? "" : undefined}
                  className="aui-ncenter-tab"
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  {t.count > 0 && <span className="aui-ncenter-tab-n">{t.count > 99 ? "99+" : t.count}</span>}
                </button>
              ))}
            </div>
          )}
          {shownTab === "notifications" && (
            <SegmentedControl className="aui-ncenter-filter" size="sm" label="筛选通知" value={shownFilter} onValueChange={setFilter} options={filters} />
          )}
        </div>
        {notice && <p className="aui-ncenter-notice" role="alert">{notice}</p>}
        <div
          className="aui-ncenter-list"
          id={panelId}
          role={loadInbox ? "tabpanel" : undefined}
          aria-labelledby={loadInbox ? `${id}tab-${shownTab}` : undefined}
          aria-busy={(shownTab === "inbox" ? todo : notes).status === "loading" || undefined}
        >
          {shownTab === "notifications" ? (
            <NotificationList
              list={notes}
              filter={shownFilter}
              now={now}
              onMarkRead={markOne}
              onAction={onNotificationAction}
              onOpen={(item) => {
                markOne(item);
                onOpen?.(item, "notification");
                close(true);
              }}
            />
          ) : (
            <InboxList
              list={todo}
              now={now}
              onAction={onInboxAction}
              onPending={done.start}
              onSettled={done.finish}
              fallbackFocus={() => tabRefs.current[1]?.focus({ preventScroll: true })}
              onOpen={
                onOpen
                  ? (item) => {
                      onOpen(item, "inbox");
                      close(true);
                    }
                  : undefined
              }
            />
          )}
        </div>
      </PopoverLayer>
    </span>
  );
}
