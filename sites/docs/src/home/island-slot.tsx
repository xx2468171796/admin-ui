import { useEffect, useRef, useState } from "react";
import { Button, StatePanel } from "@adminui/react";
import { loadIsland, type IslandName } from "./islands";

type Props = {
  name: IslandName;
  part?: string;
  /**
   * Already on the first screen (the hero): load once the page has loaded and the browser is idle, or as soon as the
   * reader points at / focuses / touches the slot — not when it comes near the viewport. Keeps the island off the
   * first-load critical path (scripts/check-build.mjs budget) while it still arrives right after first paint.
   */
  firstScreen?: boolean;
  /** Reserved height while loading, so the page does not jump when the demo arrives. */
  minHeight: number | string;
  className?: string;
  label: string;
};

/** After the `load` event, when the browser is idle (at the latest `timeout` ms later); returns a cancel. */
function afterLoadIdle(task: () => void, timeout = 1500): () => void {
  let cancel: () => void = () => undefined;
  const idle = () => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(task, { timeout });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(task, 200);
      cancel = () => window.clearTimeout(id);
    }
  };
  if (document.readyState === "complete") idle();
  else {
    window.addEventListener("load", idle, { once: true });
    cancel = () => window.removeEventListener("load", idle);
  }
  return () => cancel();
}

const INTEREST = ["pointerenter", "focusin", "touchstart"] as const;

/** A placeholder that loads an island bundle when it is about to scroll into view, then mounts it in place. */
export function IslandSlot({ name, part = "main", firstScreen = false, minHeight, className = "", label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = box.current;
    const target = host.current;
    if (!el || !target) return;
    let cancelled = false;
    let unmount: (() => void) | null = null;
    let io: IntersectionObserver | null = null;
    let stopIdle: () => void = () => undefined;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      io?.disconnect();
      stopIdle();
      for (const type of INTEREST) el.removeEventListener(type, start);
      setState("loading");
      loadIsland(name).then(
        (mod) => {
          if (cancelled) return;
          unmount = mod.mount(target, part);
          setState("ready");
        },
        () => {
          if (!cancelled) setState("error");
        },
      );
    };
    if (firstScreen) {
      stopIdle = afterLoadIdle(start);
      for (const type of INTEREST) el.addEventListener(type, start, { passive: true });
    } else if (typeof IntersectionObserver === "undefined") start();
    else {
      io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && start(), { rootMargin: "700px 0px" });
      io.observe(el);
    }
    return () => {
      cancelled = true;
      io?.disconnect();
      stopIdle();
      for (const type of INTEREST) el.removeEventListener(type, start);
      const off = unmount;
      // Unmount the island root outside React's commit of the shell.
      if (off) window.setTimeout(off, 0);
    };
  }, [name, part, firstScreen, attempt]);

  return (
    <div ref={box} className={`h-slot ${className}`} data-state={state} style={state === "ready" ? undefined : { minHeight }}>
      {state !== "ready" && (
        <div className="h-slot-wait">
          {state === "error" ? (
            <StatePanel
              kind="error"
              title="演示没加载出来"
              message="网络不稳时会这样。页面其它部分不受影响。"
              action={<Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>再试一次</Button>}
            />
          ) : (
            <div className="h-skel" role="status" aria-label={`正在加载：${label}`}>
              <i /><i /><i /><i />
            </div>
          )}
        </div>
      )}
      <div ref={host} className="h-slot-host" />
    </div>
  );
}
