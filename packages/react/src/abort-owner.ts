/**
 * Abort signals handed to host callbacks must be able to fire: a component owns one controller per
 * operation, `next()` aborts the previous operation and starts a new one, `abort()` cancels the running one
 * quality-ok: fake-abort-signal (this comment names what it replaces)
 * (dialog closed, file changed) and the hook aborts on unmount. Never pass `new AbortController().signal`
 * — nobody can ever abort it.
 */
import { useEffect, useRef } from "react";

export type AbortOwner = {
  /** Abort the running operation (if any) and return the signal of a new one. */
  next: () => AbortSignal;
  /** Abort the running operation. */
  abort: () => void;
};

export function createAbortOwner(): AbortOwner {
  let controller: AbortController | null = null;
  return {
    next() {
      controller?.abort();
      controller = new AbortController();
      return controller.signal;
    },
    abort() {
      controller?.abort();
      controller = null;
    },
  };
}

/** A component-owned AbortOwner, aborted when the component unmounts. */
export function useAbortOwner(): AbortOwner {
  const owner = useRef<AbortOwner | null>(null);
  owner.current ??= createAbortOwner();
  const current = owner.current;
  useEffect(() => () => current.abort(), [current]);
  return current;
}
