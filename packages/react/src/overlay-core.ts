/**
 * Pure rules behind the feedback & overlay pieces: scroll dividers of dialogs, how long a
 * toast stays, the pausable countdown of an 「撤销」 toast, the toast stack, and when to ask first vs.
 * act-then-undo. No React / DOM; unit-tested in test/overlay-core.test.ts.
 */

/** Divider flags of a scrolling dialog body: header line once scrolled, footer line while more is below. */
export function scrollEdges(body: { scrollTop: number; scrollHeight: number; clientHeight: number }): { scrolled: boolean; more: boolean } {
  return { scrolled: body.scrollTop > 0.5, more: body.scrollTop + body.clientHeight < body.scrollHeight - 1 };
}

export type ToastTone = "success" | "info" | "warning" | "error" | "loading";

/** Success / info 4 s; with an action (撤销 / 打开) 8 s; failures and in-progress toasts stay until closed / done. */
export const TOAST_MS = { plain: 4000, action: 8000 } as const;
export function toastDuration(toast: { tone: ToastTone; action?: boolean; duration?: number | null }): number | null {
  if (toast.duration !== undefined) return toast.duration;
  if (toast.tone === "error" || toast.tone === "loading") return null;
  return toast.action ? TOAST_MS.action : TOAST_MS.plain;
}

/**
 * A countdown that can be paused (pointer over the toast) and resumed. `now` is passed in so tests drive
 * the clock. `remaining(now)` stays between 0 and what was left (a stale `now` never adds time).
 */
export type ToastCountdown = {
  readonly total: number;
  remaining: (now: number) => number;
  pause: (now: number) => void;
  resume: (now: number) => void;
  readonly paused: boolean;
};
export function createCountdown(totalMs: number, startedAt: number): ToastCountdown {
  let left = totalMs;
  let since: number | null = startedAt;
  return {
    total: totalMs,
    remaining: (now) => Math.min(left, Math.max(0, since === null ? left : left - (now - since))),
    pause(now) {
      if (since === null) return;
      left = Math.max(0, left - (now - since));
      since = null;
    },
    resume(now) {
      if (since === null) since = now;
    },
    get paused() {
      return since === null;
    },
  };
}

/** 「撤销 8」: whole seconds left, rounded up (0 only when the time is really up). */
export const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

/**
 * Add a toast to the stack: the same toast again (same key, or same title + tone) replaces the old one;
 * at most `max` (3) are kept, the oldest dismissible one goes first (a running / failed one is kept
 * over an old success).
 */
export function stackToasts<T extends { id: number; title: string; tone: ToastTone; key?: string }>(list: readonly T[], next: T, max = 3): T[] {
  const same = (t: T) => (next.key !== undefined ? t.key === next.key : t.title === next.title && t.tone === next.tone);
  const kept = [...list.filter((t) => !same(t)), next];
  while (kept.length > max) {
    const index = kept.findIndex((t) => t.tone !== "error" && t.tone !== "loading");
    kept.splice(index >= 0 && index < kept.length - 1 ? index : 0, 1);
  }
  return kept;
}

/**
 * Ask first, or act and offer 「撤销」: reversible single actions (delete one row,
 * move, change stage) act at once with an undo toast; ask first when it can't be undone, touches other
 * people, or is big (≥ 20 rows, a whole table / business line, disabling an account).
 */
export function confirmOrUndo(action: { reversible: boolean; count?: number; affectsOthers?: boolean; bulkThreshold?: number }): "undo" | "confirm" {
  if (!action.reversible || action.affectsOthers) return "confirm";
  return (action.count ?? 1) >= (action.bulkThreshold ?? 20) ? "confirm" : "undo";
}
