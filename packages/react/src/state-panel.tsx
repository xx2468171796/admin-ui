"use client";
/**
 * StatePanel: empty / no results / error / no permission / not found / offline /
 * loading, each its own look — never the same inbox icon in another colour. One structure: a 44px icon block
 * (radius 12) + one title + one reason + at most two buttons. Tones: neutral (empty, no results, not found) ·
 * brand (first use, `tone="brand"`) · amber (no permission, offline, timeout) · terracotta (error, unavailable).
 * Errors give 「重试」 when the host passes `onRetry`, and a collapsible 「错误详情」 (request id, copyable) when it
 * passes `details`. Sizes: compact (popovers, cards) · default (panels) · page (whole page, 404 keeps the shell).
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, RefreshCw, CircleAlert, Clock, Copy, FileQuestion, Inbox, Lock, SearchX, ServerCrash, WifiOff } from "lucide-react";
import { Button } from "./primitives.tsx";
import { ContentSkeleton, SlowLoadingNote, useSlowLoading } from "./loading.tsx";

export type StateKind = "loading" | "empty" | "no-results" | "error" | "forbidden" | "no-permission" | "not-found" | "offline" | "unavailable" | "timeout";
export type StatePanelProps = {
  kind: StateKind;
  /** One sentence: what happened (「还没有客户」「没找到『陈小姐』」). Defaults per kind. */
  title?: ReactNode;
  /**
   * The reason / what to do (「把筛选清掉看看」「找管理员小陈申请」). Without `title` it is shown AS the title
   * (older call sites pass one sentence here).
   */
  message?: ReactNode;
  /** no-results: what was searched — title becomes 「没找到『q』」. */
  query?: string;
  /** no-results: a 「清除搜索」 button. */
  onClearSearch?: () => void;
  /** Error / timeout / offline / loading: a 「重试」 button. */
  onRetry?: () => void;
  /** Primary action (新建客户 / 申请查看 / 去回收站). */
  action?: ReactNode;
  /** A second, quieter action. */
  secondaryAction?: ReactNode;
  /** Error: technical details behind 「错误详情」 (request id …), copyable for the admin. */
  details?: string;
  /** brand = first use (main colour icon); default by kind. */
  tone?: "neutral" | "brand" | "warning" | "danger";
  /** Replace the icon. */
  icon?: ReactNode;
  size?: "compact" | "default" | "page";
};

type Look = { icon: ReactNode; tone: "neutral" | "warning" | "danger"; title: string };
const LOOKS: Record<Exclude<StateKind, "loading" | "no-permission">, Look> = {
  empty: { icon: <Inbox />, tone: "neutral", title: "暂无数据" },
  "no-results": { icon: <SearchX />, tone: "neutral", title: "没有符合筛选条件的记录" },
  error: { icon: <CircleAlert />, tone: "danger", title: "加载失败" },
  forbidden: { icon: <Lock />, tone: "warning", title: "没有权限查看" },
  "not-found": { icon: <FileQuestion />, tone: "neutral", title: "这个页面不存在" },
  offline: { icon: <WifiOff />, tone: "warning", title: "网络连接已断开" },
  unavailable: { icon: <ServerCrash />, tone: "danger", title: "服务暂不可用" },
  timeout: { icon: <Clock />, tone: "warning", title: "加载超时" },
};
const REASONS: Partial<Record<keyof typeof LOOKS, string>> = {
  forbidden: "需要的话找管理员申请。",
  "not-found": "网址可能输错了，或者内容已经被删除。",
  offline: "连上网络后会自动恢复，也可以点重试。",
  timeout: "服务器回得太慢，稍后再试一次。",
  unavailable: "服务正在恢复，稍后再试。",
  error: "可能是网络或服务出了问题，再试一次看看。",
};

/** The default title / reason of a state, for hosts that build their own layout (pure). */
export function stateText(kind: Exclude<StateKind, "loading">, query?: string): { title: string; reason?: string } {
  const key = kind === "no-permission" ? "forbidden" : kind;
  if (key === "no-results" && query) return { title: `没找到「${query}」`, reason: "换个关键词，或清除搜索看看全部。" };
  return { title: LOOKS[key].title, reason: REASONS[key] };
}

function ErrorDetails({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <details className="aui-state-details">
      <summary>
        错误详情 <ChevronDown aria-hidden="true" />
      </summary>
      <pre>{text}</pre>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true));
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "已复制" : "复制给管理员"}
      </Button>
    </details>
  );
}

export function StatePanel({ kind, title, message, query, onClearSearch, onRetry, action, secondaryAction, details, tone, icon, size = "default" }: StatePanelProps) {
  // loading is a skeleton in place (no spinner + 「正在加载」 in the middle); after 10 s
  // it says 「加载比较慢…」 with 重试 when the host gives onRetry.
  const slow = useSlowLoading(kind === "loading");
  if (kind === "loading")
    return (
      <div className="aui-state aui-state-loading" data-size={size === "default" ? undefined : size}>
        <ContentSkeleton label={typeof message === "string" ? message : "正在加载…"} rows={3} />
        {slow && <SlowLoadingNote onRetry={onRetry} />}
      </div>
    );
  const key = kind === "no-permission" ? "forbidden" : kind;
  const look = LOOKS[key];
  const text = stateText(key, query);
  const heading = title ?? message ?? text.title;
  const reason = title !== undefined ? message : message === undefined ? text.reason : undefined;
  const retry = Boolean(onRetry);
  return (
    <div
      className={`aui-state aui-state-${key}`}
      data-tone={tone ?? look.tone}
      data-size={size === "default" ? undefined : size}
      role={look.tone === "danger" ? "alert" : "status"}
    >
      {size === "page" && key === "not-found" && <span className="aui-state-code" aria-hidden="true">404</span>}
      <span className="aui-empty-icon" aria-hidden="true">{icon ?? look.icon}</span>
      <p className="aui-state-title">{heading}</p>
      {reason && <p className="aui-state-reason">{reason}</p>}
      {(retry || action || secondaryAction || onClearSearch) && (
        <div className="aui-state-actions">
          {action}
          {onClearSearch && (
            <Button variant="outline" size="sm" onClick={onClearSearch}>
              清除搜索
            </Button>
          )}
          {retry && (
            <Button variant={action ? "outline" : "default"} size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              重试
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
      {details && <ErrorDetails text={details} />}
    </div>
  );
}
