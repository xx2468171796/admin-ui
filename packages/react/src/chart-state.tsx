"use client";
/**
 * Chart states (审阅 06 第 1 项): every state is exactly as tall as the chart it stands in for,
 * so nothing below jumps when data arrives. 7 states = the chart itself + loading (skeleton bars with a
 * sweep, not 「××加载中」 dots), empty (icon + reason + next step, never a 0 bar), no-match (filters left
 * nothing → 「清空筛选」), error (this card only, 「重试」), stale (refresh failed: the old chart stays under
 * an attention strip saying how old it is) and forbidden (lock: the card uses a field you cannot see —
 * never shown as 0). Root entry, no echarts.
 */
import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, BarChart3, FilterX, Lock, RefreshCw } from "lucide-react";
import { Button } from "./primitives.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard.css";

export type ChartStateKind = "loading" | "empty" | "no-match" | "error" | "stale" | "forbidden";

export type ChartStateProps = {
  kind: ChartStateKind;
  /** Height of the chart it replaces (px or CSS length); default fills the parent. */
  height?: number | string;
  /** The reason line (empty / error / forbidden) or the stale strip text (「刷新失败，显示的是 14:05 的数据」). */
  message?: ReactNode;
  /** Retry (error, stale). */
  onRetry?: () => void;
  /** 「清空筛选」 (no-match). */
  onClearFilters?: () => void;
  /** Skeleton shape while loading: bars (charts), kpi (numbers), rows (tables / funnels). */
  shape?: "bars" | "kpi" | "rows";
  /** Accessible name of what is loading (「客户状态分布」). */
  label?: string;
  /** stale: the old chart, kept on screen under the strip. */
  children?: ReactNode;
};

const TITLES: Record<Exclude<ChartStateKind, "loading" | "stale">, string> = {
  empty: "没有数据",
  "no-match": "筛选后没有数据",
  error: "加载失败",
  forbidden: "无权限",
};
const REASONS: Record<Exclude<ChartStateKind, "loading" | "stale">, string> = {
  empty: "这段时间还没有记录，换个时间段看看",
  "no-match": "当前筛选条件下没有记录",
  error: "数据没取回来，只影响这一张卡",
  forbidden: "这张卡用到了你看不到的字段，不显示数",
};
const BARS = [46, 72, 58, 88, 64, 38];

export function ChartState({ kind, height, message, onRetry, onClearFilters, shape = "bars", label, children }: ChartStateProps) {
  const style = (height === undefined ? undefined : { height: typeof height === "number" ? `${height}px` : height }) as CSSProperties | undefined;
  if (kind === "loading")
    return (
      <div className="aui-chart-state" data-kind="loading" data-shape={shape} style={style} role="status" aria-busy="true" aria-label={label ? `${label}加载中` : "加载中"}>
        {shape === "bars" ? (
          <span className="aui-chart-skel-bars" aria-hidden="true">{BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
        ) : shape === "kpi" ? (
          <span className="aui-chart-skel-kpi" aria-hidden="true"><i /><i /><i /></span>
        ) : (
          <span className="aui-chart-skel-rows" aria-hidden="true">{BARS.slice(0, 4).map((w, i) => <i key={i} style={{ width: `${w + 10}%` }} />)}</span>
        )}
      </div>
    );
  if (kind === "stale")
    return (
      <div className="aui-chart-state" data-kind="stale" style={style}>
        <p className="aui-chart-stale" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>{message ?? "刷新失败，显示的是上一次的数据"}</span>
          {onRetry && <Button variant="text" size="xs" onClick={onRetry}>重试</Button>}
        </p>
        <div className="aui-chart-stale-body">{children}</div>
      </div>
    );
  const Icon = kind === "forbidden" ? Lock : kind === "error" ? AlertTriangle : kind === "no-match" ? FilterX : BarChart3;
  return (
    <div className="aui-chart-state" data-kind={kind} style={style} role={kind === "error" ? "alert" : undefined}>
      <span className="aui-chart-state-icon" aria-hidden="true"><Icon /></span>
      <b>{TITLES[kind]}</b>
      <span className="aui-chart-state-reason">{message ?? REASONS[kind]}</span>
      {kind === "error" && onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw />重试</Button>}
      {kind === "no-match" && onClearFilters && <Button variant="outline" size="sm" onClick={onClearFilters}>清空筛选</Button>}
    </div>
  );
}
