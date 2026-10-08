"use client";
/**
 * Operation-result toasts: a white card (radius 12, 380 wide) bottom-right — a 24px
 * round tinted icon, the result in bold + a small line naming the object, at most one action (撤销 / 打开 /
 * 再试一次) and ×. Success 4 s, with an action 8 s (the button counts down, a thin bar runs along the
 * bottom); failures stay until closed; in-progress toasts spin and turn into the result in place; the pointer
 * over a toast pauses it; at most 3 stacked. Phones: full width above the page's bottom bar.
 *
 * Division of labour: what you just did → toast; the state of a page / card → InlineAlert; form errors → under
 * the field. Reversible single actions don't ask first: `useUndoToast` acts, then offers 「撤销」.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { sharedContext } from "./context.ts";
import { Button } from "./primitives.tsx";
import { Spinner, IconButton } from "./buttons.tsx";
import { createCountdown, secondsLeft, stackToasts, toastDuration, type ToastCountdown, type ToastTone } from "./overlay-core.ts";

export type NoticeTone = ToastTone;
export type NoticeOptions = {
  /** The result, bold: 「已删除客户」「导出好了」「复制失败」. */
  title: string;
  /** The object / reason, small: 「赵静怡 · 智能家居客户」. */
  description?: string;
  tone?: NoticeTone;
  /** One action on the right (撤销 / 打开 / 再试一次). Clicking it closes the toast. */
  action?: { label: string; onClick: () => void | Promise<void> };
  /** ms; `null` = until closed. Default: success / info / warning 4 s, with an action 8 s, error / loading never. */
  duration?: number | null;
  /** The same key replaces the toast instead of stacking a second one. */
  key?: string;
  /** Called once when the toast goes away by itself (time up) or by ×; not when its action was used. */
  onDismiss?: (how: "timeout" | "close") => void;
};
export type NoticeHandle = {
  id: number;
  close: () => void;
  /** Change it in place (progress → result). */
  update: (next: NoticeOptions) => void;
};
export type UndoNoticeOptions = {
  title: string;
  description?: string;
  /** Put it back. Rejecting shows a persistent 「撤销失败」 toast. */
  onUndo: () => void | Promise<void>;
  /** Seconds to undo (default 8). */
  seconds?: number;
  undoLabel?: string;
  /** Time ran out / × without undoing (commit a deferred delete here). */
  onExpire?: () => void;
};
/** `useNotify()`: call it like before (`notify("已保存")`, `notify("失败", "error")`) or use the methods. */
export type Notify = ((message: string, tone?: "success" | "error" | "info") => void) & {
  show: (options: NoticeOptions) => NoticeHandle;
  /** 「已删除…」 + 撤销 with a countdown. */
  undo: (options: UndoNoticeOptions) => NoticeHandle;
  /** A spinning 「正在导出…」 that you later `update` into the result. */
  progress: (options: { title: string; description?: string }) => NoticeHandle;
  dismiss: (id: number) => void;
};

type Toast = NoticeOptions & { id: number; tone: NoticeTone; clock: ToastCountdown | null };

const Context = sharedContext<Notify>("notifications");
const ICONS: Record<NoticeTone, ReactNode> = {
  success: <Check aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  warning: <TriangleAlert aria-hidden="true" />,
  error: <CircleAlert aria-hidden="true" />,
  loading: <Spinner size={16} tone="brand" />,
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const next = useRef(0);
  const live = useRef<Toast[]>([]);
  live.current = items;
  const remove = useCallback((id: number, how?: "timeout" | "close") => {
    const toast = live.current.find((t) => t.id === id);
    if (toast && how) toast.onDismiss?.(how);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);
  const build = (id: number, options: NoticeOptions): Toast => {
    const tone = options.tone ?? "success";
    const ms = toastDuration({ tone, action: Boolean(options.action), duration: options.duration });
    return { ...options, id, tone, clock: ms === null ? null : createCountdown(ms, Date.now()) };
  };
  const notify = useMemo<Notify>(() => {
    const show = (options: NoticeOptions): NoticeHandle => {
      const id = ++next.current;
      // Computed from the live list (not inside the state updater) so a toast pushed out of the stack still
      // gets its onDismiss — an undo toast pushed out commits like one whose time ran out.
      const out = stackToasts(live.current, build(id, options));
      const dropped = live.current.filter((t) => !out.includes(t));
      live.current = out;
      setItems(out);
      setNow(Date.now());
      for (const t of dropped) t.onDismiss?.("close");
      return {
        id,
        close: () => remove(id),
        update: (changed) => setItems((list) => list.map((t) => (t.id === id ? build(id, changed) : t))),
      };
    };
    const legacy = (message: string, tone: "success" | "error" | "info" = "success") => {
      show({ title: message, tone });
    };
    return Object.assign(legacy, {
      show,
      dismiss: (id: number) => remove(id),
      progress: (options: { title: string; description?: string }) => show({ ...options, tone: "loading" }),
      undo: (options: UndoNoticeOptions) => {
        const ms = (options.seconds ?? 8) * 1000;
        const handle = show({
          key: `undo:${next.current + 1}`,
          title: options.title,
          description: options.description,
          tone: "success",
          duration: ms,
          action: {
            label: options.undoLabel ?? "撤销",
            onClick: async () => {
              try {
                await options.onUndo();
                show({ title: "已撤销", description: options.title, tone: "info" });
              } catch (err) {
                show({ title: "撤销失败", description: err instanceof Error && err.message ? err.message : "请重试", tone: "error" });
              }
            },
          },
          onDismiss: () => options.onExpire?.(),
        });
        return handle;
      },
    });
  }, [remove]); // eslint-disable-line react-hooks/exhaustive-deps
  // One ticker while a timed toast is showing: re-render the countdowns and drop the expired ones.
  const timed = items.some((t) => t.clock);
  useEffect(() => {
    if (!timed) return;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      for (const t of live.current) if (t.clock && !t.clock.paused && t.clock.remaining(at) <= 0) remove(t.id, "timeout");
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [timed, remove]);
  return (
    <Context.Provider value={notify}>
      {children}
      <div className="aui-notices" aria-label="操作通知">
        {items.map((t) => {
          const left = t.clock ? t.clock.remaining(now) : null;
          return (
            <div
              key={t.id}
              className={`aui-notice aui-notice-${t.tone}`}
              role={t.tone === "error" ? "alert" : "status"}
              onPointerEnter={() => t.clock?.pause(Date.now())}
              onPointerLeave={() => t.clock?.resume(Date.now())}
            >
              <span className="aui-notice-icon">{ICONS[t.tone]}</span>
              <div className="aui-notice-text">
                <strong>{t.title}</strong>
                {t.description && <small>{t.description}</small>}
              </div>
              {t.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="aui-notice-action"
                  onClick={() => {
                    const action = t.action;
                    remove(t.id);
                    void action?.onClick();
                  }}
                >
                  {t.action.label}
                  {left !== null && <span className="aui-notice-seconds">{secondsLeft(left)}</span>}
                </Button>
              )}
              <IconButton label="关闭通知" className="aui-notice-close" onClick={() => remove(t.id, "close")} icon={<X />} />
              {t.clock && t.action && <span className="aui-notice-bar" aria-hidden="true" style={{ transform: `scaleX(${left === null ? 0 : left / t.clock.total})` }} />}
            </div>
          );
        })}
      </div>
    </Context.Provider>
  );
}
export function useNotify(): Notify {
  const value = useContext(Context);
  if (!value) throw Error("useNotify 必须位于 NotificationProvider 内");
  return value;
}
/** Like useNotify, but null outside a NotificationProvider (components that toast only when the page can show it). */
export function useOptionalNotify(): Notify | null {
  return useContext(Context);
}

export type UndoableOptions = {
  /** 「已删除客户」「已移到『谈判』」. */
  title: string;
  description?: string;
  /** Do it now (optimistic). A rejection shows a persistent failure toast and nothing to undo. */
  run?: () => void | Promise<void>;
  /** Put it back. */
  undo: () => void | Promise<void>;
  /** Deferred mode: really commit when the undo time runs out (e.g. the server delete). */
  commit?: () => void | Promise<void>;
  seconds?: number;
  /** Failure toast title (default `${title}失败`… shortened to 「操作失败」). */
  failTitle?: string;
};
/**
 * Act, then offer 「撤销」 — for reversible single actions (delete one row, move, change
 * stage) instead of asking first. Resolves with what happened: "done" (time ran out / closed — `commit` has
 * run), "undone", or "failed" (`run` threw; nothing to undo). Ask first (ConfirmDialog) only for what
 * can't be undone, touches other people, or is big (`confirmOrUndo`).
 */
export function useUndoToast() {
  const notify = useNotify();
  return useCallback(
    async (options: UndoableOptions): Promise<"done" | "undone" | "failed"> => {
      try {
        await options.run?.();
      } catch (err) {
        notify.show({ title: options.failTitle ?? "操作失败", description: err instanceof Error && err.message ? err.message : options.title, tone: "error" });
        return "failed";
      }
      return new Promise((resolve) => {
        notify.undo({
          title: options.title,
          description: options.description,
          seconds: options.seconds,
          onUndo: async () => {
            try {
              await options.undo();
              resolve("undone");
            } catch (err) {
              resolve("failed");
              throw err;
            }
          },
          onExpire: () => {
            void Promise.resolve(options.commit?.()).catch((err: unknown) =>
              notify.show({ title: "保存失败", description: err instanceof Error && err.message ? err.message : options.title, tone: "error" }),
            );
            resolve("done");
          },
        });
      });
    },
    [notify],
  );
}
