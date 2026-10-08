"use client";
/**
 * Building blocks shared by the governance pages: the data-loading hook (loading / error-with-retry /
 * stale-after-refresh), the read-only note, success feedback, a ticking clock, and option labels.
 */
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Button } from "../../primitives.tsx";
import { InlineAlert, StatePanel } from "../../layout.tsx";
import { useAdminResource } from "../../workflow-hooks.ts";
import type { GovOption } from "./contracts.ts";
import { govErrorMessage, type GovernanceApi } from "./api.ts";

/** Props every governance page takes. */
export type GovPageBaseProps = {
  /** From createGovernanceApi(), or any object implementing GovernanceApi (tests / custom adapters). */
  api: GovernanceApi;
  /** False while the page is hidden (another workspace tab / section): loading pauses. Default true. */
  active?: boolean;
  /** Clock for countdowns and「还剩 N 天」(tests pass a fixed time). */
  now?: () => Date;
};

export type GovLoadState<T> = {
  data?: T;
  loading: boolean;
  error?: string;
  updatedAt?: string;
  refresh: () => Promise<void>;
};
/**
 * Load once when active, keep the data on refresh and expose the refresh error separately.
 * `key` changes (filters) start a fresh load and never show the previous key's rows.
 */
export function useGov<T>(key: string, load: (signal: AbortSignal) => Promise<T>, active = true): GovLoadState<T> {
  const res = useAdminResource<T>(key, async (signal) => {
    try {
      return await load(signal);
    } catch (error) {
      throw new Error(govErrorMessage(error));
    }
  }, 0, active);
  return res as GovLoadState<T>;
}

/**
 * Standard states around a loaded block: first load → spinner; first load failed → error with
 * 「重试」; refresh failed with data → keep the data under「刷新失败，当前数据可能已过期」.
 */
export function GovLoad<T>({ res, children, label }: { res: GovLoadState<T>; children: (data: T) => ReactNode; label?: string }) {
  if (res.data === undefined) {
    if (res.error) return <StatePanel kind="error" message={`${label ?? "数据"}加载失败：${res.error}`} onRetry={() => void res.refresh()} />;
    return <StatePanel kind="loading" />;
  }
  return <>{children(res.data)}</>;
}
/** The stale-data alert for ResourcePanel feedback (null when the last load succeeded). */
export function StaleAlert({ res }: { res: Pick<GovLoadState<unknown>, "data" | "error" | "loading" | "refresh"> }) {
  if (res.data === undefined || !res.error) return null;
  return (
    <InlineAlert tone="error" title="刷新失败，当前数据可能已过期" action={<Button size="sm" variant="outline" disabled={res.loading} onClick={() => void res.refresh()}>重试</Button>}>
      {res.error}
    </InlineAlert>
  );
}

/** 「只读」note shown when the viewer lacks the manage permission. */
export function ReadOnlyNote({ permission, children }: { permission: string; children?: ReactNode }) {
  return (
    <InlineAlert tone="info" title="只读">
      {children ?? `你没有「${permission}」权限，只能查看；需要修改请联系管理员。`}
    </InlineAlert>
  );
}

/** Success feedback after a mutation, cleared by the next action or after a while. */
export function useNotice(timeoutMs = 6000) {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), timeoutMs);
    return () => clearTimeout(t);
  }, [notice, timeoutMs]);
  const node = notice ? <InlineAlert tone="success" title={notice} /> : null;
  return [node, setNotice] as const;
}

/** A clock that ticks every `intervalMs` while enabled (countdowns). */
export function useTicker(now: () => Date, intervalMs = 1000, enabled = true): Date {
  const [at, setAt] = useState(() => now());
  useEffect(() => {
    if (!enabled) return;
    setAt(now());
    const t = setInterval(() => setAt(now()), intervalMs);
    return () => clearInterval(t);
  }, [now, intervalMs, enabled]);
  return at;
}

/** id → label from host options (falls back to the id itself). */
export function optionLabeler(...lists: (readonly GovOption[] | undefined)[]) {
  const map = new Map<string, string>();
  for (const list of lists) for (const o of list ?? []) map.set(o.id, o.label);
  return (id: string | null | undefined) => (id ? (map.get(id) ?? id) : "—");
}

/** Choice options from host lists, with a placeholder-free empty state handled by the caller. */
export const toChoice = (list: readonly GovOption[] | undefined) => (list ?? []).map((o) => ({ value: o.id, label: o.hint ? `${o.label}（${o.hint}）` : o.label }));

export const defaultNow = () => new Date();

/** The stale-data alert as a value (null when fine), for composing ResourcePanel feedback. */
export function staleAlert(res: Pick<GovLoadState<unknown>, "data" | "error" | "loading" | "refresh">): ReactNode {
  return res.data !== undefined && res.error ? <StaleAlert res={res} /> : null;
}
/** ResourcePanel feedback from optional nodes: undefined when there is nothing (no empty padded block). */
export function feedbackOf(...nodes: ReactNode[]): ReactNode {
  const shown = nodes.filter((n) => n !== null && n !== undefined && n !== false && n !== "");
  return shown.length ? <>{shown.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</> : undefined;
}
