"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreAdapter } from "./workflow-core.ts";
/** Interval refresh that skips hidden tabs; the caller owns visible errors. */
function useAutoRefresh(
  refresh: () => void | Promise<unknown>,
  intervalMs: number,
  enabled = true,
) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!stopped && document.visibilityState !== "hidden") {
        try {
          await callback.current();
        } catch {
          /* caller owns visible errors */
        }
      }
      if (!stopped) timer = setTimeout(tick, Math.max(250, intervalMs));
    };
    timer = setTimeout(tick, Math.max(250, intervalMs));
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [intervalMs, enabled]);
}
/** Same-key refresh retains data with an explicit stale error. A new key never displays old data. */
export function useAdminResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs = 0,
  enabled = true,
) {
  const loader = useRef(load);
  loader.current = load;
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<{
    key: string;
    data?: T;
    loading: boolean;
    error?: string;
    updatedAt?: string;
  }>({ key, loading: true });
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setState((old) => ({
      ...(old.key === key ? old : { key }),
      loading: true,
      error: undefined,
    }));
    try {
      const data = await loader.current(request.signal);
      if (!request.signal.aborted)
        setState({
          key,
          data,
          loading: false,
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      if (!request.signal.aborted)
        setState((old) => ({
          ...old,
          loading: false,
          error: error instanceof Error ? error.message : "加载失败",
        }));
    }
  }, [key]);
  useEffect(() => {
    if (enabled) void refresh();
    return () => controller.current?.abort();
  }, [refresh, enabled]);
  useAutoRefresh(refresh, intervalMs, enabled);
  return { ...(state.key === key ? state : { key, loading: true }), refresh };
}
export function usePersistentState<T>(
  key: string,
  initial: T,
  adapter: StoreAdapter<T>,
) {
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const [state, setState] = useState({
    key,
    value: initial,
    ready: false,
    error: "",
  });
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  useEffect(() => {
    const n = ++generation.current,
      controller = new AbortController();
    setState({ key, value: initialRef.current, ready: false, error: "" });
    void adapter
      .load(key, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted)
          setState({
            key,
            value: value ?? initialRef.current,
            ready: true,
            error: "",
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            key,
            value: initialRef.current,
            ready: true,
            error: String(error),
          });
      });
    return () => {
      controller.abort();
      if (n === generation.current) generation.current++;
    };
  }, [key, adapter]);
  const setValue = (value: T) => {
    if (state.key !== key || !state.ready) return;
    const n = generation.current;
    setState({ key, value, ready: true, error: "" });
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        await adapter.save(key, value, new AbortController().signal);
      })
      .catch((error) => {
        if (n === generation.current)
          setState((s) => ({ ...s, error: String(error) }));
      });
  };
  return {
    ...(state.key === key
      ? state
      : { key, value: initial, ready: false, error: "" }),
    setValue,
  };
}
export type Draft<T> = { version: string; expiresAt: number; value: T };
/** Explicit save avoids racing restore with autosave. Provide only an allowlisted, nonsensitive DTO. */
export function useFormDraft<T>(
  key: string,
  version: string,
  adapter: StoreAdapter<Draft<T>>,
  ttlMs = 86400000,
) {
  const resource = useAdminResource(key, (signal) => adapter.load(key, signal));
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const mutate = async (value?: T) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const signal = new AbortController().signal;
      if (value === undefined) await adapter.remove(key, signal);
      else
        await adapter.save(
          key,
          { value, version, expiresAt: Date.now() + ttlMs },
          signal,
        );
      await resource.refresh();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const valid = resource.data && resource.data.expiresAt > Date.now();
  return {
    draft: valid ? (resource.data ?? null) : null,
    conflict: Boolean(valid && resource.data?.version !== version),
    loading: resource.loading,
    saving,
    error: error || resource.error,
    save: (value: T) => mutate(value),
    clear: () => mutate(),
  };
}
/** Enable only after the user has restored/discarded any existing draft. Only the allowlisted value is persisted. */
export function useDraftAutosave<T>(
  value: T,
  save: (value: T) => Promise<boolean>,
  enabled: boolean,
  intervalMs = 1500,
) {
  const last = useRef<string | undefined>(undefined);
  const latest = useRef({ value, save });
  latest.current = { value, save };
  useAutoRefresh(
    async () => {
      const current = latest.current;
      const serialized = JSON.stringify(current.value);
      if (serialized !== last.current && (await current.save(current.value)))
        last.current = serialized;
    },
    intervalMs,
    enabled,
  );
}
export type AdminEvent = { type: string; resource?: string };
export type EventAdapter = (
  receive: (event: AdminEvent) => void,
  signal: AbortSignal,
  onError: (error: Error) => void,
) => void | (() => void);
export function useAdminEvents(
  subscribe: EventAdapter | undefined,
  receive: (event: AdminEvent) => void,
  enabled = true,
) {
  const callback = useRef(receive);
  callback.current = receive;
  const [error, setError] = useState("");
  useEffect(() => {
    if (!subscribe || !enabled) return;
    const controller = new AbortController();
    setError("");
    let stop: void | (() => void);
    try {
      stop = subscribe(
        (event) => {
          if (!controller.signal.aborted) callback.current(event);
        },
        controller.signal,
        (e) => {
          if (!controller.signal.aborted) setError(e.message);
        },
      );
    } catch (e) {
      setError(String(e));
    }
    return () => {
      controller.abort();
      stop?.();
    };
  }, [subscribe, enabled]);
  return { error };
}
