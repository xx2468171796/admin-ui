/**
 * Deferred commits behind undo toasts (「已删除 · 撤销 8」). Each runs at most once: when the time runs out,
 * the toast is closed / pushed out, or — so a closed tab or a route change never loses the delete — at once
 * on `pagehide` and when the NotificationProvider unmounts. Undo cancels it. Pure: no React, no DOM.
 */
export type UndoCommitReason = "timeout" | "close" | "pagehide" | "unmount";
export type UndoCommitInfo = { reason: UndoCommitReason };

export type UndoCommits = {
  add: (id: number, commit: (info: UndoCommitInfo) => void) => void;
  /** Run one commit now (once); false when it already ran or was cancelled. */
  settle: (id: number, reason: UndoCommitReason) => boolean;
  /** Undo was used: drop the commit without running it. */
  cancel: (id: number) => void;
  /** Run every pending commit now; returns their ids. */
  flush: (reason: UndoCommitReason) => number[];
  readonly size: number;
};

export function createUndoCommits(onError?: (error: unknown) => void): UndoCommits {
  const pending = new Map<number, (info: UndoCommitInfo) => void>();
  const settle = (id: number, reason: UndoCommitReason) => {
    const commit = pending.get(id);
    if (!commit) return false;
    pending.delete(id);
    try {
      commit({ reason });
    } catch (error) {
      onError?.(error);
    }
    return true;
  };
  return {
    add: (id, commit) => void pending.set(id, commit),
    settle,
    cancel: (id) => void pending.delete(id),
    flush: (reason) => [...pending.keys()].filter((id) => settle(id, reason)),
    get size() {
      return pending.size;
    },
  };
}
