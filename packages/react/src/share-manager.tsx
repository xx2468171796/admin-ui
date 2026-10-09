"use client";
/**
 * ShareManager (bt/share S5, demo D22): 「我的分享」 — every link a person sent (record, view, form, file,
 * video, document, secret) with a KPI strip, search / type / state filters, one row per link (type tile,
 * who, what, password, expiry, opens with a mini bar, last open) and RowActionBar (copy, settings, ⋯
 * extend / pause / reshare / access log / void). A row expands into ShareAccessLog: filter chips with
 * counts, masked IP, area, device, what happened (edits as old → new) and 「封这个 IP」 on security rows.
 * Data via props / callbacks; the server pages, filters and enforces.
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useState, type ReactNode } from "react";
import { BookOpen, ClipboardList, Copy, Download, Eye, FileText, Flame, Folder, Globe, Building2, History, KeyRound, LayoutGrid, Link2Off, Lock, MapPin, MessageSquare, Monitor, Pause, Pencil, Play, Rows3, Settings2, Share2, ShieldAlert, Smartphone, TriangleAlert, Users, Video, CalendarPlus, Download as DownloadIcon } from "lucide-react";
import { Button, Choice } from "./primitives.tsx";
import { ChangeValue } from "./change-value.tsx";
import { SegmentedControl } from "./choices.tsx";
import { ConfirmDialog } from "./forms.tsx";
import { ResourcePanel } from "./layout.tsx";
import { DataTable, type Column } from "./data.tsx";
import { RowActionBar } from "./row-actions.tsx";
import { SearchField, StatStrip, type StatItem } from "./page-templates.tsx";
import { ACCESS_KIND_LABELS, accessFilters, expiresSoon, filterAccess, relativeDay, remainingText, shortTime, type AccessFilter, type ShareAccessEvent, type ShareAudience } from "./share-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";

export type ShareKind = "record" | "view" | "form" | "file" | "video" | "doc" | "folder" | "secret";
export const SHARE_KIND_LABELS: Record<ShareKind, string> = { record: "记录", view: "视图", form: "表单", file: "文件", video: "视频", doc: "文档", folder: "文件夹", secret: "密码" };
const KIND_ICONS: Record<ShareKind, ReactNode> = { record: <Rows3 />, view: <LayoutGrid />, form: <ClipboardList />, file: <FileText />, video: <Video />, doc: <BookOpen />, folder: <Folder />, secret: <KeyRound /> };
export type ShareAccessKindLabel = "view" | "comment" | "edit" | "fill" | "download" | "burn";
const ACCESS_ICONS: Record<ShareAccessKindLabel, ReactNode> = { view: <Eye />, comment: <MessageSquare />, edit: <Pencil />, fill: <Pencil />, download: <Download />, burn: <Flame /> };
const AUDIENCE_ICONS: Record<ShareAudience, ReactNode> = { anyone: <Globe />, org: <Building2 />, people: <Users /> };
export type ShareState = "active" | "paused" | "void";

/** One link in 「我的分享」. */
export type ShareItem = {
  id: string;
  kind: ShareKind;
  title: string;
  /** 「记录 · 客户表」 */
  subtitle?: string;
  audience: ShareAudience;
  /** Overrides the audience text (「指定 2 人」). */
  audienceText?: string;
  /** What the visitor can do: 「可编辑 2 个字段」 + icon kind. */
  access: { text: string; kind: ShareAccessKindLabel };
  hasPassword: boolean;
  expiresAt: number | null;
  /** Grey line under the expiry (「表单例外 · 管理员批准」); default the time left. */
  expiryNote?: string;
  opened: number;
  openLimit: number | null;
  lastOpen?: { at: number; where?: string } | null;
  state: ShareState;
};

export type ShareManagerProps = {
  items: readonly ShareItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** KPI strip above the list (有效 / 本周打开 / 即将到期 / 已作废). */
  stats?: readonly StatItem[];
  /** Panel title (default 「我的分享」) and buttons right of it. */
  title?: string;
  actions?: ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  kind: ShareKind | "all";
  onKindChange: (kind: ShareKind | "all") => void;
  kinds?: readonly ShareKind[];
  status: ShareState;
  onStatusChange: (status: ShareState) => void;
  /** Counts per state for the segmented filter. */
  counts?: Partial<Record<ShareState, number>>;
  /** Expanded row (access log); one at a time. */
  expanded: string | null;
  onExpandedChange: (id: string | null) => void;
  /** The access log of the expanded row (usually <ShareAccessLog … />). */
  renderLog: (item: ShareItem) => ReactNode;
  onCopyLink?: (item: ShareItem) => void;
  onEdit?: (item: ShareItem) => void;
  /** Extend; `extendLabel` names it (「延长 7 天（到 10-13）」). */
  onExtend?: (item: ShareItem) => void;
  extendLabel?: (item: ShareItem) => string;
  onPausedChange?: (item: ShareItem, paused: boolean) => void;
  onReshare?: (item: ShareItem) => void;
  /** Void after confirmation; reject keeps the confirm open with the message. */
  onVoid?: (item: ShareItem) => Promise<void> | void;
  /** Line under the table (「公司要求：对外必须设密码，最长 30 天」). */
  policyNote?: ReactNode;
  timeZone?: string;
  now?: () => number;
};

/** 「我的分享」 list with KPI strip, filters and expandable access logs. */
export function ShareManager(props: ShareManagerProps) {
  const { items, timeZone: timeZoneProp, now = Date.now, kinds = ["record", "view", "form", "file", "video", "doc", "secret"] } = props;
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const [voiding, setVoiding] = useState<ShareItem | null>(null);
  const columns: Column<ShareItem>[] = [
    {
      key: "object",
      title: "分享对象",
      minWidth: 180,
      render: (row) => (
        <span className="aui-share-obj-cell">
          <span className="aui-share-kind" data-kind={row.kind} data-tip={SHARE_KIND_LABELS[row.kind]} aria-hidden="true">
            {KIND_ICONS[row.kind]}
          </span>
          <span className="aui-share-obj-text">
            <b data-tip={row.title}>{row.title}</b>
            {row.subtitle && <small data-tip={row.subtitle}>{row.subtitle}</small>}
          </span>
        </span>
      ),
    },
    { key: "audience", title: "谁能打开", width: 96, render: (row) => <span className="aui-share-cell-icon">{AUDIENCE_ICONS[row.audience]}{row.audienceText ?? { anyone: "任何人", org: "公司内", people: "指定的人" }[row.audience]}</span> },
    {
      key: "access",
      title: "能做什么",
      width: 140,
      render: (row) => (
        <span className="aui-share-access" data-kind={row.access.kind}>
          {ACCESS_ICONS[row.access.kind]}
          {row.access.text}
        </span>
      ),
    },
    { key: "password", title: "密码", width: 60, render: (row) => (row.hasPassword ? <span className="aui-share-cell-icon"><Lock />有</span> : <span className="aui-share-none">—</span>) },
    {
      key: "expiry",
      title: "有效期",
      width: 140,
      render: (row) => {
        const soon = expiresSoon(row.expiresAt, now());
        return (
          <span className="aui-share-two-line" data-tone={soon ? "attention" : undefined}>
            <span>{row.expiresAt === null ? "永久" : formatExpiry(row.expiresAt, now(), timeZone)}</span>
            <small>{soon ? `即将到期 · ${remainingText(row.expiresAt, now())}` : row.expiryNote ?? (row.expiresAt === null ? "" : remainingText(row.expiresAt, now()))}</small>
          </span>
        );
      },
    },
    { key: "opens", title: "打开次数", width: 112, render: (row) => <OpensCell opened={row.opened} limit={row.openLimit} /> },
    {
      key: "last",
      title: "最近打开",
      width: 112,
      render: (row) => (
        <span className="aui-share-two-line">
          <span>{row.lastOpen ? relativeDay(row.lastOpen.at, now(), timeZone) : "还没人打开"}</span>
          {row.lastOpen?.where && <small>{row.lastOpen.where}</small>}
        </span>
      ),
    },
    { key: "actions", title: "操作", kind: "actions", width: 132, render: (row) => <RowActionBar label={`${row.title} 的更多操作`} actions={actionsFor(row)} /> },
  ];
  function actionsFor(row: ShareItem) {
    const live = row.state !== "void";
    return [
      ...(props.onCopyLink && live ? [{ key: "copy", label: "复制链接", icon: <Copy />, onSelect: () => props.onCopyLink?.(row) }] : []),
      ...(props.onEdit && live ? [{ key: "edit", label: "改设置", icon: <Settings2 />, onSelect: () => props.onEdit?.(row) }] : []),
      ...(props.onExtend && live ? [{ key: "extend", label: props.extendLabel?.(row) ?? "延长 7 天", icon: <CalendarPlus />, onSelect: () => props.onExtend?.(row), menuOnly: true, disabled: row.expiresAt === null, disabledReason: row.expiresAt === null ? "永久有效，不用延长" : undefined }] : []),
      ...(props.onPausedChange && live ? [{ key: "pause", label: row.state === "paused" ? "恢复" : "暂停", icon: row.state === "paused" ? <Play /> : <Pause />, onSelect: () => props.onPausedChange?.(row, row.state !== "paused"), menuOnly: true }] : []),
      ...(props.onReshare ? [{ key: "reshare", label: "按这个设置再分享", icon: <Share2 />, onSelect: () => props.onReshare?.(row), menuOnly: true }] : []),
      { key: "log", label: props.expanded === row.id ? "收起访问记录" : "访问记录", icon: <History />, onSelect: () => props.onExpandedChange(props.expanded === row.id ? null : row.id), menuOnly: true },
      ...(props.onVoid && live ? [{ key: "void", label: "作废链接", icon: <Link2Off />, destructive: true, onSelect: () => setVoiding(row) }] : []),
    ];
  }
  const statusOptions = (["active", "paused", "void"] as const).map((value) => {
    const n = props.counts?.[value];
    return { value, label: `${{ active: "有效", paused: "已暂停", void: "已作废" }[value]}${n === undefined ? "" : ` ${n}`}` };
  });
  return (
    // 8.6.1 page flush: the strip and the list are page flow (flat, one line between), no card of its own
    <div className="aui-share-manager" data-aui-flow="stack">
      {props.stats && props.stats.length > 0 && <StatStrip items={props.stats} label="分享概况" />}
      <ResourcePanel
        title={props.title ?? "我的分享"}
        count={props.total}
        unit="条"
        actions={props.actions}
        filters={
          <div className="aui-share-filters">
            <SearchField value={props.search} onChange={props.onSearchChange} placeholder="搜索分享对象、访客 IP" label="搜索分享" size="sm" />
            <span className="aui-share-kind-filter">
              <Choice label="分享类型" value={props.kind} onChange={(v) => props.onKindChange(v as ShareKind | "all")} options={[{ value: "all", label: "全部类型" }, ...kinds.map((k) => ({ value: k, label: SHARE_KIND_LABELS[k] }))]} />
            </span>
            <SegmentedControl size="sm" label="分享状态" value={props.status} onValueChange={props.onStatusChange} options={statusOptions} />
          </div>
        }
      >
        <DataTable
          caption="我的分享"
          rows={items}
          columns={columns}
          rowKey={(row) => row.id}
          rowHeight="medium"
          loading={props.loading}
          error={props.error}
          onRetry={props.onRetry}
          emptyLabel={props.search || props.kind !== "all" ? "没有匹配的分享" : "还没有分享过"}
          emptyKind={props.search || props.kind !== "all" ? "no-results" : "empty"}
          expandable={{
            expanded: props.expanded ? [props.expanded] : [],
            onExpandedChange: (keys) => props.onExpandedChange(keys.find((k) => k !== props.expanded) ?? null),
            render: (row) => props.renderLog(row),
            label: (row) => `${row.title} 的访问记录`,
          }}
          pagination={{ mode: "page", total: props.total, page: props.page, pageSize: props.pageSize, onPageChange: props.onPageChange, onPageSizeChange: props.onPageSizeChange }}
        />
        {props.policyNote && (
          <p className="aui-share-manager-policy">
            <ShieldAlert aria-hidden="true" />
            {props.policyNote}
          </p>
        )}
      </ResourcePanel>
      <ConfirmDialog
        open={voiding !== null}
        title="作废这个分享链接？"
        impact={voiding ? `「${voiding.title}」的链接会立刻失效，已经拿到链接的人再打开只会看到「链接已失效」。不能恢复。` : undefined}
        destructive
        confirmLabel="作废链接"
        onConfirm={async () => {
          if (voiding) await props.onVoid?.(voiding);
        }}
        onClose={() => setVoiding(null)}
      />
    </div>
  );
}

function OpensCell({ opened, limit }: { opened: number; limit: number | null }) {
  if (limit === null)
    return (
      <span className="aui-share-opens-cell">
        <b>{opened.toLocaleString()}</b>
        <small>/ 不限</small>
      </span>
    );
  const ratio = Math.min(1, opened / Math.max(1, limit));
  return (
    <span className="aui-share-opens-cell" role="img" aria-label={`已打开 ${opened} 次，最多 ${limit} 次`}>
      <b>{opened}</b>
      <small>/ {limit}</small>
      <span className="aui-share-minibar" data-tone={ratio >= 0.8 ? "attention" : undefined} aria-hidden="true">
        <i style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </span>
    </span>
  );
}

const formatExpiry = (ms: number, now: number, timeZone: string) => relativeDay(ms, now, timeZone);

// ---------------------------------------------------------------- ShareAccessLog

export type ShareAccessLogProps = {
  events: readonly ShareAccessEvent[];
  /** Right of the filters (default 「IP 中间两段已打码」). */
  ipNote?: ReactNode;
  onExport?: () => void;
  /** 「封这个 IP」 on alarm rows; reject shows the message. */
  onBlockIp?: (event: ShareAccessEvent) => Promise<void> | void;
  /** IPs already blocked (button becomes 「已封」). */
  blockedIps?: readonly string[];
  /** 「加载更多」 when the server has more. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
  timeZone?: string;
  /** Title (default 「访问记录」); false hides the head row title. */
  title?: string;
};

/** The access log of one share: who opened / downloaded / edited when, from where, on what. */
export function ShareAccessLog({ events, ipNote = "IP 中间两段已打码", onExport, onBlockIp, blockedIps = [], onLoadMore, loadingMore, timeZone: timeZoneProp, title = "访问记录" }: ShareAccessLogProps) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const [filter, setFilter] = useState<AccessFilter>("all");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const filters = accessFilters(events);
  const shown = filterAccess(events, filter);
  const block = async (event: ShareAccessEvent) => {
    if (!onBlockIp) return;
    setPending(event.id);
    setError("");
    try {
      await onBlockIp(event);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };
  return (
    <section className="aui-access-log" aria-label={title}>
      <header className="aui-access-log-head">
        <h4>
          <History aria-hidden="true" />
          {title}
        </h4>
        <SegmentedControl size="sm" label="按类型筛选访问记录" value={filter} onValueChange={setFilter} options={filters.map((f) => ({ value: f.value, label: `${f.label} ${f.count}` }))} />
        <span className="aui-access-log-note">{ipNote}</span>
        {onExport && (
          <Button size="sm" variant="outline" onClick={onExport}>
            <DownloadIcon />
            导出
          </Button>
        )}
      </header>
      {error && (
        <p className="aui-share-error" role="alert">
          {error}
        </p>
      )}
      <ol className="aui-access-rows">
        {shown.map((e) => {
          const blocked = blockedIps.includes(e.ip);
          return (
            <li key={e.id} className="aui-access-row" data-alarm={e.alarm || undefined}>
              <time dateTime={new Date(e.at).toISOString()}>{shortTime(e.at, timeZone)}</time>
              <span className="aui-access-ip">{e.ip}</span>
              <span className="aui-access-area">
                {e.area && (
                  <>
                    <MapPin aria-hidden="true" />
                    {e.area}
                  </>
                )}
              </span>
              <span className="aui-access-device">
                {e.device === "mobile" ? <Smartphone aria-hidden="true" /> : <Monitor aria-hidden="true" />}
                {e.os}
                {e.browser && <small>· {e.browser}</small>}
              </span>
              <span className="aui-access-what">
                <span className="aui-access-kind" data-kind={e.kind}>
                  {e.kind === "security" ? <TriangleAlert aria-hidden="true" /> : e.kind === "edit" ? <Pencil aria-hidden="true" /> : e.kind === "download" ? <Download aria-hidden="true" /> : e.kind === "comment" ? <MessageSquare aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  {ACCESS_KIND_LABELS[e.kind]}
                </span>
                {e.change ? (
                  <span className="aui-access-text">
                    <span className="aui-access-field">{e.change.field}</span>
                    <ChangeValue before={e.change.before} after={e.change.after} />
                  </span>
                ) : (
                  <span className="aui-access-text">{e.text}</span>
                )}
              </span>
              <span className="aui-access-side">
                {e.alarm && onBlockIp ? (
                  <Button size="sm" variant="outline" className="aui-access-block" disabled={blocked || pending === e.id} onClick={() => void block(e)}>
                    {blocked ? "已封" : "封这个 IP"}
                  </Button>
                ) : e.notified ? (
                  <small>已通知你</small>
                ) : null}
              </span>
            </li>
          );
        })}
        {!shown.length && <li className="aui-access-empty">这段时间没有记录</li>}
      </ol>
      {onLoadMore && (
        <Button size="sm" variant="ghost" className="aui-access-more" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "正在加载…" : "加载更多"}
        </Button>
      )}
    </section>
  );
}
