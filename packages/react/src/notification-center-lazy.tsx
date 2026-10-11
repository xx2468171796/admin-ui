"use client";
/**
 * The notification center's lists (通知 / 待我处理) only render inside the open panel: their module loads on hover /
 * focus of the bell, when the panel opens, or on idle — not on the first paint. Each list has its own Suspense
 * (a skeleton for the moment the first panel waits).
 */
import { Suspense, useEffect, type ReactNode } from "react";
import { ContentSkeleton } from "./loading.tsx";
import { lazyPart, whenIdle } from "./lazy-part.ts";
import type { InboxListProps, NotificationListProps } from "./notification-center-lists.tsx";

const notificationPart = /* @__PURE__ */ lazyPart(() => import("./notification-center-lists.tsx").then((m) => m.NotificationList));
const inboxPart = /* @__PURE__ */ lazyPart(() => import("./notification-center-lists.tsx").then((m) => m.InboxList));
const LazyNotificationList = notificationPart.Part as (props: NotificationListProps) => ReactNode;
const LazyInboxList = inboxPart.Part as (props: InboxListProps) => ReactNode;

/** Start loading both lists (no-op once loaded). */
export function preloadLists(): void {
  notificationPart.preload();
  inboxPart.preload();
}

/** Load the lists at once when the panel is open, else on idle. */
export function usePreloadLists(open: boolean): void {
  useEffect(() => (open ? preloadLists() : whenIdle(preloadLists)), [open]);
}

export function NotificationList(props: NotificationListProps) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <LazyNotificationList {...props} />
    </Suspense>
  );
}

export function InboxList(props: InboxListProps) {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <LazyInboxList {...props} />
    </Suspense>
  );
}
