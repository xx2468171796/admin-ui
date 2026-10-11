/**
 * Search-as-you-type against the host (「@ 提到同事」): waits `delay` ms after the last keystroke, only the
 * newest request may apply its result, a failure applies `null`. `request(null)` clears at once. Pure: timers
 * are injectable, no React.
 */
type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export function createLatestSearch<Q, R>(run: (query: Q) => Promise<R> | R, apply: (result: R | null) => void, delay = 150, timers: Timers = realTimers) {
  let seq = 0;
  let timer: unknown = null;
  const stop = () => {
    seq++;
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
  return {
    request(query: Q | null) {
      stop();
      if (query === null) return apply(null);
      const n = seq;
      timer = timers.set(() => {
        timer = null;
        Promise.resolve()
          .then(() => run(query))
          .then(
            (result) => n === seq && apply(result),
            () => n === seq && apply(null),
          );
      }, delay);
    },
    /** Drop the pending / running request (unmount). */
    cancel: stop,
  };
}
