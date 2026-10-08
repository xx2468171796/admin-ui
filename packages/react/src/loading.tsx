"use client";
/**
 * Loading. First load: the shell and the title come first, the content area shows a
 * skeleton IN PLACE — a table keeps its own header — and counts read 「—」, never 「共 0 条」; after 10 s it
 * says 「加载比较慢… · 重试」. Refresh: old data stays (a little dimmer), a 2px bar runs along the top.
 * Spinners only where the shape is unknown. Progress bars 4 / 6 / 8, round, indeterminate, segmented.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./primitives.tsx";

/** Width pattern of skeleton lines / cells: uneven like real text (deterministic, no Math.random). */
export const SKELETON_WIDTHS = [72, 54, 86, 40, 64, 78, 48, 92, 58, 68] as const;
export function skeletonWidth(row: number, column = 0): number {
  return SKELETON_WIDTHS[(row * 3 + column * 7) % SKELETON_WIDTHS.length] ?? 60;
}

/** True once `loading` has lasted `ms` (default 10 s): time to say 「加载比较慢…」. */
export function useSlowLoading(loading: boolean, ms = 10_000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [loading, ms]);
  return slow;
}

export type SkeletonBlockProps = {
  /** CSS width (number = px, string = any unit; default 100%). */
  width?: number | string;
  height?: number;
  /** line (default) · pill (a tag) · circle (an avatar). */
  shape?: "line" | "pill" | "circle";
};
/** One skeleton shape (decorative); put a status text (「正在加载客户…」) on the surrounding region. */
export function SkeletonBlock({ width, height, shape = "line" }: SkeletonBlockProps) {
  const style: CSSProperties = { width: typeof width === "number" ? `${width}px` : width, height };
  if (shape === "circle" && height) style.width = height;
  return <span className="aui-skel" data-shape={shape === "line" ? undefined : shape} style={style} aria-hidden="true" />;
}

/** The kind of content a column holds, so its skeleton has the right shape. */
export type SkeletonCellKind = "text" | "tag" | "person" | "number" | "action";
/** One skeleton cell: text (uneven line), tag (pill), person (circle + line), number (short, right), action (short pill). */
export function SkeletonCell({ kind = "text", row = 0, column = 0 }: { kind?: SkeletonCellKind; row?: number; column?: number }) {
  const w = skeletonWidth(row, column);
  if (kind === "tag") return <SkeletonBlock shape="pill" width={Math.round(36 + w / 3)} />;
  if (kind === "person")
    return (
      <span className="aui-skel-cell">
        <SkeletonBlock shape="circle" height={20} />
        <SkeletonBlock width={Math.round(36 + w / 3)} />
      </span>
    );
  if (kind === "number") return <SkeletonBlock width={Math.round(28 + w / 4)} />;
  if (kind === "action") return <SkeletonBlock shape="pill" width={44} />;
  return <SkeletonBlock width={`${w}%`} />;
}

export type ContentSkeletonProps = {
  /** Rows of the list (default 4). */
  rows?: number;
  /** With a circle in front (people lists, comments). */
  avatar?: boolean;
  /** Screen-reader text (「正在加载…」). */
  label?: string;
};
/** A list / card body placeholder: uneven rows (optionally with an avatar), in place of the content. */
export function ContentSkeleton({ rows = 4, avatar, label = "正在加载…" }: ContentSkeletonProps) {
  return (
    <div className="aui-content-skeleton" role="status" aria-label={label}>
      {Array.from({ length: Math.max(1, Math.min(12, rows)) }, (_, i) => (
        <div key={i} className="aui-content-skeleton-row" aria-hidden="true">
          {avatar && <SkeletonBlock shape="circle" height={32} />}
          <span className="aui-content-skeleton-lines">
            <SkeletonBlock width={`${skeletonWidth(i)}%`} />
            <SkeletonBlock width={`${Math.round(skeletonWidth(i, 1) * 0.6)}%`} height={10} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Slow first load: 「加载比较慢…」 + 重试. */
export function SlowLoadingNote({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="aui-load-slow" role="status">
      加载比较慢…
      {onRetry && (
        <Button size="sm" variant="text" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}

/** The 2px bar along the top of a panel while it refreshes (old data stays). The parent needs `position: relative`. */
export function TopProgress({ active = true, label = "正在刷新" }: { active?: boolean; label?: string }) {
  if (!active) return null;
  return (
    <span className="aui-top-progress" role="progressbar" aria-label={label} aria-busy="true">
      <i />
    </span>
  );
}

export type ProgressBarProps = {
  /** 0–1; null = indeterminate (unknown length). */
  value: number | null;
  /** Accessible name (「上传 3 个文件」). */
  label: string;
  /** Height 4 · 6 (default) · 8. */
  size?: 4 | 6 | 8;
  /** Fixed colour; default main colour. Quotas use `Meter` / `QuotaMeter` (warn / danger thresholds). */
  tone?: "brand" | "attention" | "danger";
};
/** A plain round progress bar (uploads, imports); null = indeterminate. */
export function ProgressBar({ value, label, size = 6, tone = "brand" }: ProgressBarProps) {
  const ratio = value === null || !Number.isFinite(value) ? null : Math.min(1, Math.max(0, value));
  return (
    <span
      className="aui-progress"
      data-size={size === 6 ? undefined : String(size)}
      data-tone={tone === "brand" ? undefined : tone}
      data-indeterminate={ratio === null || undefined}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ratio === null ? undefined : Math.round(ratio * 100)}
      style={ratio === null ? undefined : ({ "--aui-progress-v": `${ratio * 100}%` } as CSSProperties)}
    >
      <i />
    </span>
  );
}

/** Stage progress as segments: done ones filled, the current one half. */
export function StepProgress({ total, done, label, current = true }: { total: number; done: number; label: string; /** Show the step after the done ones as 「in progress」. */ current?: boolean }) {
  const n = Math.max(1, Math.floor(total));
  return (
    <span className="aui-progress-segs" role="img" aria-label={`${label}：${Math.min(done, n)} / ${n}`}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} data-state={i < done ? "done" : current && i === done ? "current" : undefined} />
      ))}
    </span>
  );
}

/** Wraps refreshed content: dims it a little while `refreshing` and draws the top bar. */
export function Refreshing({ refreshing, children }: { refreshing: boolean; children: ReactNode }) {
  return (
    <div className="aui-refresh-dim" data-refreshing={refreshing || undefined} style={{ position: "relative" }} aria-busy={refreshing || undefined}>
      <TopProgress active={refreshing} />
      {children}
    </div>
  );
}
