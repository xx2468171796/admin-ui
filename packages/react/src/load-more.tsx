"use client";
/**
 * LoadMore: the bottom row of a timeline / activity feed / comment list — those load more,
 * tables page with numbers (DataTable pagination). Four states in one full-width row: 「加载更多 · 已显示 50 / 共 128
 * 条」 · loading (spinner, 「正在加载…」) · failed (danger text + 「重试」) · the end (「已经到底了 · 共 128 条」).
 */
import { RotateCw, CircleAlert } from "lucide-react";
import { Button } from "./primitives.tsx";
import { Spinner } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";

export type LoadMoreProps = {
  /** Items shown so far. */
  shown: number;
  /** All items, when the service knows (else 「已显示 50 条」). */
  total?: number;
  /** Cursor lists without a total: whether there is more. Default: shown < total (no total = true). */
  hasMore?: boolean;
  loading?: boolean;
  /** The last load failed: the message (true = 「没加载出来」). */
  error?: string | boolean;
  onLoadMore: () => void;
  /** 「重试」 (default onLoadMore). */
  onRetry?: () => void;
  /** Unit (default 「条」). */
  unit?: string;
};
const n = (value: number) => value.toLocaleString("zh-CN");

/** See the module comment. */
export function LoadMore({ shown, total, hasMore, loading, error, onLoadMore, onRetry, unit = "条" }: LoadMoreProps) {
  const more = hasMore ?? (total === undefined ? true : shown < total);
  const count = total === undefined ? `已显示 ${n(shown)} ${unit}` : `已显示 ${n(shown)} / 共 ${n(total)} ${unit}`;
  if (loading)
    return (
      <div className="aui-loadmore" data-state="loading" role="status">
        <Spinner size={16} />
        正在加载…
      </div>
    );
  if (error)
    return (
      <div className="aui-loadmore" data-state="error" role="alert">
        <CircleAlert aria-hidden="true" />
        <span>{typeof error === "string" ? error : "没加载出来"}</span>
        <Button size="sm" variant="outline" onClick={onRetry ?? onLoadMore}>
          <RotateCw />
          重试
        </Button>
      </div>
    );
  if (!more)
    return (
      <div className="aui-loadmore" data-state="end">
        <span>已经到底了{total !== undefined ? ` · 共 ${n(total)} ${unit}` : ""}</span>
      </div>
    );
  return (
    <div className="aui-loadmore">
      <Button size="sm" variant="outline" onClick={onLoadMore}>加载更多</Button>
      <span className="aui-loadmore-count">{count}</span>
    </div>
  );
}
