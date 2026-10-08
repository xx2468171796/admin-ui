"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAdminTheme } from "./theme.tsx";
import { skeletonWidth } from "./loading.tsx";

/** Read the effective preference, including system reduced motion and background tabs. */
export function useAdminMotion() {
  return useAdminTheme().motionEnabled;
}

/** Finite entrance/replay; never remounts children or delays a business action. */
export function MotionReveal({ children, effect = "rise", replayKey, active = true, delay = 0, className = "" }: {
  children: ReactNode;
  effect?: "fade" | "rise" | "scale";
  replayKey?: string | number;
  active?: boolean;
  /** Stagger delay in ms, clamped to 0–300. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useAdminMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || !active || !node.getClientRects().length || !node.animate) return;
    const from = effect === "rise" ? "translateY(6px)" : effect === "scale" ? "scale(.98)" : "none";
    const animation = node.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], {
      duration: 180, delay: Number.isFinite(delay) ? Math.max(0, Math.min(300, delay)) : 0,
      easing: "cubic-bezier(0, 0, .2, 1)", fill: "backwards",
    });
    // A finished transform animation must not remain a containing block for fixed descendants.
    animation.onfinish = () => animation.cancel();
    return () => animation.cancel();
  }, [enabled, active, effect, replayKey, delay]);
  return <div ref={ref} className={`aui-reveal ${className}`}>{children}</div>;
}

function useContinuousMotion(paused: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const enabled = useAdminMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!globalThis.IntersectionObserver) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, paused: paused || !enabled || !inView };
}

/**
 * Non-interactive placeholder lines of uneven width; replace it when data arrives, never overlay actual controls.
 * For a table use DataTable `loading` (its own header + skeleton rows), for a list `ContentSkeleton`.
 */
export function Skeleton({ lines = 3, label = "正在加载", paused = false, className = "" }: {
  lines?: number; label?: string; paused?: boolean; className?: string;
}) {
  const activity = useContinuousMotion(paused);
  const count = Number.isFinite(lines) ? Math.max(1, Math.min(12, Math.floor(lines))) : 3;
  return <div ref={activity.ref} className={`aui-skeleton ${className}`} data-paused={activity.paused} role="status" aria-label={label}>
    <span className="aui-sr-only">{label}</span>
    {Array.from({ length: count }, (_, index) => <span key={index} className="aui-skel aui-skeleton-line" style={{ width: `${skeletonWidth(index)}%` }} aria-hidden="true"/>)}
  </div>;
}

/** An indeterminate state: the visible label remains when animation is reduced or paused. */
export function LoadingDots({ label = "正在处理", paused = false, className = "" }: {
  label?: string; paused?: boolean; className?: string;
}) {
  const activity = useContinuousMotion(paused);
  return <div ref={activity.ref} className={`aui-loading-dots ${className}`} data-paused={activity.paused} role="status">
    <span className="aui-loading-dots-shapes" aria-hidden="true"><span/><span/><span/></span>
    <span>{label}</span>
  </div>;
}
