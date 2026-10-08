"use client";
/**
 * Open-record state (useRecordDetail) without the record-detail UI: the dialog (record-detail.tsx, with the
 * arranged detail, its editor and their styles) loads on first open, so a DataTable / ActivityFeed that can
 * open records does not ship the whole record detail on the first screen.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { readRecordParam, RECORD_PARAM, suggestRecordLevel, writeRecordParam, type RecordDetailLevel, type RecordLayout } from "./record-detail-core.ts";

import type { RecordDetailDialogProps } from "./record-detail.tsx";

const RecordDetailDialog = /* @__PURE__ */ lazy(() => import("./record-detail.tsx").then((m) => ({ default: m.RecordDetailDialog }))) as unknown as <T>(props: RecordDetailDialogProps<T>) => ReactNode;


export type UseRecordDetailOptions<T> = {
  /** Records in display order: prev / next walk this list; an open key that leaves it closes. */
  rows: readonly T[];
  rowKey: (row: T) => string;
  layout: RecordLayout<T>;
  /** Level a record opens at (default: suggestRecordLevel(layout) — peek for small records). */
  defaultLevel?: Exclude<RecordDetailLevel, "page">;
  /** Keep the open record in the URL (`?record=<key>`, or this parameter name): shareable, Back closes it. */
  url?: boolean | string;
  /** false while loading / failed: an open record waits instead of showing stale data. */
  enabled?: boolean;
  /** Controlled open key (e.g. a row action opens a record); leave out for internal state. */
  openKey?: string | null;
  onOpenChange?: (key: string | null) => void;
  /** The user moved to another record and then closed: put focus back on that record. */
  onRefocus?: (key: string) => void;
  details?: (row: T) => ReactNode;
  peek?: (row: T) => ReactNode;
};

/**
 * Open-record state for any list: `open(key, level?)`, prev / next, the dialog element (render it
 * once), and the optional URL deep link. DataTable `expandRecord` and BitableGrid use it.
 */
export function useRecordDetail<T>({ rows, rowKey, layout, defaultLevel, url, enabled = true, openKey: controlledKey, onOpenChange, onRefocus, details, peek }: UseRecordDetailOptions<T>) {
  const param = url ? (typeof url === "string" ? url : RECORD_PARAM) : null;
  const initial = param && typeof window !== "undefined" ? readRecordParam(window.location.search, param) : null;
  const [ownKey, setOwnKey] = useState<string | null>(initial?.key ?? null);
  const fallbackLevel = defaultLevel ?? suggestRecordLevel(layout);
  const [level, setLevel] = useState<Exclude<RecordDetailLevel, "page">>(initial?.level ?? fallbackLevel);
  const controlled = controlledKey !== undefined;
  const key = controlled ? controlledKey ?? null : ownKey;
  const index = key !== null && enabled ? rows.findIndex((row) => rowKey(row) === key) : -1;
  const row = index >= 0 ? rows[index] : undefined;
  const pushed = useRef(false);

  const syncUrl = useCallback((next: string | null, nextLevel: Exclude<RecordDetailLevel, "page">, mode: "push" | "replace" | "back") => {
    if (!param || typeof window === "undefined") return;
    const search = writeRecordParam(window.location.search, next === null ? null : { key: next, level: nextLevel }, param);
    const target = `${window.location.pathname}${search}${window.location.hash}`;
    if (mode === "back" && pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    if (mode === "push") {
      window.history.pushState(window.history.state, "", target);
      pushed.current = true;
    } else window.history.replaceState(window.history.state, "", target);
  }, [param]);

  const setKey = (next: string | null) => {
    if (!controlled) setOwnKey(next);
    onOpenChange?.(next);
  };
  // Back / forward: follow the URL.
  useEffect(() => {
    if (!param) return;
    const onPop = () => {
      const location = readRecordParam(window.location.search, param);
      pushed.current = false;
      if (!controlled) setOwnKey(location?.key ?? null);
      onOpenChange?.(location?.key ?? null);
      if (location) setLevel(location.level);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [param, controlled, onOpenChange]);

  // The record the dialog opened on (by open(), a controlled key or the URL): closing on it returns
  // focus to the opener (Dialog does that); after prev / next, onRefocus moves it to the current one.
  const firstKey = useRef<string | null>(null);
  const isOpen = row !== undefined;
  useEffect(() => {
    if (!isOpen) firstKey.current = null;
    else if (firstKey.current === null) firstKey.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const open = (next: string, nextLevel?: Exclude<RecordDetailLevel, "page">) => {
    const lv = nextLevel ?? fallbackLevel;
    firstKey.current = next;
    setLevel(lv);
    setKey(next);
    syncUrl(next, lv, key === null ? "push" : "replace");
  };
  const move = (delta: -1 | 1) => {
    const next = rows[index + delta];
    if (index < 0 || !next) return;
    setKey(rowKey(next));
    syncUrl(rowKey(next), level, "replace");
  };
  const close = () => {
    const current = key;
    const moved = current !== null && current !== firstKey.current;
    setKey(null);
    syncUrl(null, level, "back");
    if (moved && onRefocus) requestAnimationFrame(() => onRefocus(current));
  };
  const changeLevel = (next: Exclude<RecordDetailLevel, "page">) => {
    setLevel(next);
    if (key !== null) syncUrl(key, next, "replace");
  };
  // A record that disappeared (deleted, filtered out) closes instead of lingering on stale data.
  const stale = !controlled && ownKey !== null && enabled && rows.length > 0 && index < 0;
  useEffect(() => {
    if (stale) {
      setOwnKey(null);
      syncUrl(null, level, "replace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  // Mounted from the first open on (the dialog animates closed and keeps focus return), never before.
  const [loaded, setLoaded] = useState(false);
  if (row !== undefined && !loaded) setLoaded(true);
  const element = loaded ? (
    <Suspense fallback={null}>
      <RecordDetailDialog layout={layout} row={row} level={level} onLevelChange={changeLevel} onClose={close}
        nav={row !== undefined ? { index, total: rows.length, onMove: move } : undefined} details={details} peek={peek} recordKey={row !== undefined ? rowKey(row) : undefined} />
    </Suspense>
  ) : null;
  return useMemo(() => ({ openKey: row !== undefined ? key : null, level, open, close, setLevel: changeLevel, element, row, index }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, key, level, rows, layout, details, peek, enabled, loaded]);
}
