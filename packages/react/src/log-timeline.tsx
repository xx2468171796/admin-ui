"use client";
/**
 * LogTimeline (T06 日志 / 时间线; moved out of page-templates.tsx, still re-exported from there).
 *
 * Two layouts on the same data callbacks:
 * - `variant="audit"` (default, T06): one line per record grouped by day — time · actor (AI chip) ·
 *   sentence · target · result chip · open toggle; an opened row shows the before / after table.
 * - `variant="operations"` (D23 operation log with whole-batch undo): 操作编号 · 时间 · 操作人 ·
 *   做了什么（图标 + 类型 + 一句话 + 灰字 + 状态）· 影响 · 动作（查看改动 / 撤回整批 / 恢复字段 /
 *   撤销撤回）. Entries older than the undo window (default 3 days, `undoWindowDays`) go into a dimmed
 *   「超过 3 天」 group whose undo is greyed with the reason. An opened row shows record · field ·
 *   before → after · 「这批之后」 (later edits by others) and, when some cells were edited again, the
 *   keep / revert chooser; the choice goes to `undo().onUndo(decisions)`.
 * Both: kind chips with counts (`kinds` + `kind`), 「加载更多」 at the bottom. Filters other than the
 * kind go in the surrounding ResourcePanel. Styles: styles/templates.css (.aui-log-*) and
 * styles/history.css (.aui-oplog-*).
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, History } from "lucide-react";
import { ChangeValue } from "./change-value.tsx";
import { StatusBadge } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { groupByDay } from "./collections-core.ts";
import type { DateInput } from "./format.ts";
import { dayHeading } from "./timeline-core.ts";
import { StatePanel } from "./state-panel.tsx";
import { SkeletonBlock } from "./loading.tsx";
import { LoadMore } from "./load-more.tsx";
import { OperationsList } from "./log-operations.tsx";
import { hhmm, letterOf, LogStatusPill } from "./log-shared.tsx";
import { avatarTone } from "./avatar-core.ts";
import { countByKind, filterByKind, inlineChange, type ConflictDecisions } from "./history-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";

// 审阅 05: readable audit details (labels, folded technical keys) for the host's `detail` renderer.
export { detailValueText, readableDetail, type LogDetailEntry, type ReadableDetailOptions } from "./log-detail-core.ts";
export type LogActor = { name: string; ai?: boolean; avatar?: string; /** An automation / sync, not a person (icon instead of a letter). */ bot?: boolean; icon?: ReactNode };
export type LogResult = { label: string; tone: "success" | "warning" | "danger" | "neutral" };
/** A later edit of the same cell by someone else (operations mode: the 「这批之后」 column). */
export type LogLaterEdit = { by: string; at?: ReactNode; value: ReactNode };
export type LogChange = {
  key?: string;
  field: string;
  before: ReactNode;
  after: ReactNode;
  /** Operations mode: the record the cell belongs to (「黄淑芬」). */
  record?: ReactNode;
  /** Field type icon in front of the field name. */
  icon?: ReactNode;
  /** Someone changed this cell again after the batch → a conflict when undoing. null = 「没人再改过」. */
  later?: LogLaterEdit | null;
};
export type LogDiff = {
  meta?: readonly ReactNode[];
  changes: readonly LogChange[];
  /** Operations mode heading: 「48 格 = 24 条记录 × 预计金额、下次跟进 · 以下是 3 条样例」. */
  summary?: ReactNode;
  /** 「查看全部 48 格」 when the diff only shows samples. */
  onShowAll?: () => void;
  showAllLabel?: string;
};
/** One kind of entry for the chips and the small type tag (数据 / 字段 / 视图). */
export type LogKind = { key: string; label: string; /** Shorter text for the row tag (「字段」 for 「字段结构」). */ tag?: string; tone?: "neutral" | "attention" | "info" | "brand" };
/** A state pill after the sentence: 已撤回 / 部分撤回 / 冲突 / 数据还在 / 已被 OP-…0094 退回. */
export type LogStatus = { label: string; tone?: "neutral" | "brand" | "attention" | "danger" | "info"; icon?: ReactNode; title?: string };
/** batch = 撤回整批, field = 恢复字段（连数据）, revert = 撤销撤回 (undo a rollback / an undo). */
export type LogUndoKind = "batch" | "field" | "revert";
export type LogUndo = {
  kind?: LogUndoKind;
  /** Button text (default per kind). */
  label?: string;
  /** Tooltip, e.g. 「回滚本身也是一次操作，可以再撤回」. */
  title?: string;
  /** Greyed with this reason (inside the window). Outside the window it is greyed automatically. */
  disabledReason?: string;
  /** Called with the conflict choice when the opened diff has later edits (else null). Reject = notice, row stays. */
  onUndo: (decisions: ConflictDecisions | null) => void | Promise<void>;
};

export type LogTimelineProps<T> = {
  items: readonly T[];
  getId: (item: T) => string;
  time: (item: T) => DateInput | null | undefined;
  actor: (item: T) => LogActor;
  /** The sentence: 「部署了网关版本 5afba4ab」 / 「粘贴 48 格」. */
  text: (item: T) => ReactNode;
  /** What it was done to (audit: info colour; operations: grey detail after the sentence). */
  target?: (item: T) => ReactNode;
  result?: (item: T) => LogResult | null | undefined;
  /** Before / after shown when the row is opened (null = nothing to open). */
  diff?: (item: T) => LogDiff | null | undefined;
  /**
   * Audit: a diff with exactly one change is written in the row — 「修改了「状态」 跟进中 → 已成交」 (old
   * value struck through, new value bold) — instead of only when opened (record history). Values come
   * from `diff`, formatted (and masked) by the host.
   */
  inlineDiff?: boolean;
  /** Any other detail when opened (instead of / after the diff). */
  detail?: (item: T) => ReactNode;
  caption: string;
  /** Row keys open at first. */
  defaultExpanded?: readonly string[];
  /** Total matching records on the server: 「已显示 10 / 1,284 条」. */
  total?: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  timeZone?: string;
  /** Empty state title (centred in the card with an icon), default 「这段时间没有记录」. */
  emptyLabel?: string;
  /** Empty state second line (「改了这个角色的权限后，这里会按时间列出谁改了什么。」). */
  emptyHint?: ReactNode;
  /** First load: skeleton rows in the 44px row shape. */
  loading?: boolean;
  /** audit (T06, default) / operations (D23 operation log with undo). */
  variant?: "audit" | "operations";
  /** Operations: the operation number 「OP-20261005-0149」 (monospace). */
  code?: (item: T) => ReactNode;
  /** Operations: icon of the action in front of the sentence. */
  icon?: (item: T) => ReactNode;
  /** Kinds for the chips and the type tag; with `kind` the chips 「全部 26 · 数据 19 …」 appear above. */
  kinds?: readonly LogKind[];
  kind?: (item: T) => string;
  /** Controlled chip value (`"all"` = everything); leave out to keep it inside. */
  kindValue?: string;
  onKindChange?: (value: string) => void;
  /** Hide the built-in chips (e.g. the host shows LogKindFilter in its own header). */
  hideKindFilter?: boolean;
  /** State pill after the sentence. */
  status?: (item: T) => LogStatus | null | undefined;
  /** Grey the whole row (undone / overridden entries). */
  dimmed?: (item: T) => boolean;
  /** Operations: impact 「24 条」「1 个字段」. */
  impact?: (item: T) => ReactNode;
  /** Operations: the undo action of a row (null = none). */
  undo?: (item: T) => LogUndo | null | undefined;
  /** Whole-batch undo window in days (default 3). Older entries are grouped and their undo greyed. */
  undoWindowDays?: number;
  /** Grey note of the old group after 「… 之前 ·」 (default 「只能逐条恢复」). */
  oldNote?: ReactNode;
  /** Clock override (tests, server time). */
  now?: number;
};

/** 「全部 26 · 数据 19 · 字段结构 4 · 视图 3」 as a segmented control (put it in a panel header or let LogTimeline show it). */
export function LogKindFilter({ kinds, counts, total, value, onChange, label = "按类型看" }: { kinds: readonly LogKind[]; counts: ReadonlyMap<string, number>; total: number; value: string; onChange: (value: string) => void; label?: string }) {
  return (
    <SegmentedControl
      size="sm"
      label={label}
      value={value}
      onValueChange={onChange}
      className="aui-log-kinds"
      options={[{ value: "all", label: `全部 ${total}` }, ...kinds.map((k) => ({ value: k.key, label: `${k.label} ${counts.get(k.key) ?? 0}` }))]}
    />
  );
}

export { LogStatusPill } from "./log-shared.tsx";

/**
 * Audit / task log grouped by day, or (variant="operations") the operation log with whole-batch undo.
 * See the module comment for both layouts.
 */
export function LogTimeline<T>(props: LogTimelineProps<T>) {
  const { items, kinds, kind, kindValue, onKindChange, hideKindFilter, caption, emptyLabel = "这段时间没有记录", total, onLoadMore, loadingMore } = props;
  const [innerKind, setInnerKind] = useState("all");
  const currentKind = kindValue ?? innerKind;
  const setKind = (v: string) => {
    if (kindValue === undefined) setInnerKind(v);
    onKindChange?.(v);
  };
  const counts = useMemo(() => (kind ? countByKind(items, kind) : new Map<string, number>()), [items, kind]);
  const shown = useMemo(() => (kind ? filterByKind(items, kind, currentKind) : [...items]), [items, kind, currentKind]);
  const chips = kinds?.length && kind && !hideKindFilter ? <div className="aui-log-toolbar"><LogKindFilter kinds={kinds} counts={counts} total={items.length} value={currentKind} onChange={setKind} /></div> : null;
  // 时间线 / 动态用「加载更多」一整行（LoadMore：加载中 / 到底 都有样子）
  const more = onLoadMore ? (
    <div className="aui-log-more"><LoadMore shown={items.length} total={total} loading={loadingMore} onLoadMore={onLoadMore} /></div>
  ) : total !== undefined ? (
    <div className="aui-log-more"><span>已显示 {items.length.toLocaleString()} / {total.toLocaleString()} 条</span></div>
  ) : null;
  if (props.loading) return <LogSkeleton caption={caption} />;
  if (!items.length) return <div className="aui-log-empty"><StatePanel kind="empty" title={emptyLabel} message={props.emptyHint} icon={<History aria-hidden="true" />} size="compact" /></div>;
  return (
    <div className="aui-log" data-variant={props.variant ?? "audit"}>
      {chips}
      {!shown.length ? (
        <div className="aui-log-empty"><StatePanel kind="empty" title="没有这一类的记录" icon={<History aria-hidden="true" />} size="compact" /></div>
      ) : props.variant === "operations" ? (
        <OperationsList {...props} items={shown} caption={caption} />
      ) : (
        <AuditList {...props} items={shown} caption={caption} />
      )}
      {more}
    </div>
  );
}

/** Skeleton rows of the dense audit log (44px each). */
function LogSkeleton({ caption }: { caption: string }) {
  return (
    <div className="aui-log" aria-busy="true">
      <span className="aui-sr-only" role="status">正在加载{caption}…</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="aui-log-skel" aria-hidden="true">
          <SkeletonBlock width={36} />
          <span className="aui-log-actor"><SkeletonBlock shape="circle" height={20} /><SkeletonBlock width={48} /></span>
          <SkeletonBlock width={`${[62, 48, 70, 55, 66][i] ?? 60}%`} />
          <SkeletonBlock width="60%" />
        </div>
      ))}
    </div>
  );
}

function AuditList<T>({ items, getId, time, actor, text, target, result, diff, inlineDiff, detail, caption, defaultExpanded, timeZone: timeZoneProp, kinds, kind, status, dimmed, now: nowProp }: LogTimelineProps<T>) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const [open, setOpen] = useState<readonly string[]>(defaultExpanded ?? []);
  const groups = useMemo(() => groupByDay(items, time, timeZone), [items, time, timeZone]);
  const now = nowProp ?? Date.now();
  const toggle = (id: string) => setOpen((list) => (list.includes(id) ? list.filter((k) => k !== id) : [...list, id]));
  return (
    <ol className="aui-log-days" aria-label={caption}>
      {groups.map((group) => {
        const heading = dayHeading(group.key, now, timeZone);
        return (
          <li key={group.key || "unknown"} className="aui-log-day">
            <div className="aui-log-day-label">{heading.label}<small>{heading.date ? `${heading.date} · ` : ""}{group.items.length} 条</small></div>
            <ol className="aui-log-items">
              {group.items.map((item) => {
                const id = getId(item);
                const who = actor(item);
                const res = result?.(item);
                const change = diff?.(item);
                const more = detail?.(item);
                const st = status?.(item);
                const k = kind && kinds?.find((x) => x.key === kind(item));
                const inline = inlineDiff ? inlineChange(change) : null;
                // A one-change diff written in the row has nothing more to open (unless there is meta / detail).
                const canOpen = Boolean(more || (change && (!inline || change.meta?.length)));
                const isOpen = canOpen && open.includes(id);
                return (
                  <li key={id} className="aui-log-item" data-open={isOpen || undefined} data-dim={dimmed?.(item) || undefined}>
                    <div className="aui-log-row" data-inline={inline ? true : undefined} onClick={canOpen ? (e) => { if (!(e.target as HTMLElement).closest("a, button:not(.aui-log-toggle)")) toggle(id); } : undefined} data-clickable={canOpen || undefined}>
                      <time className="aui-log-time">{hhmm(time(item), timeZone)}</time>
                      <span className="aui-log-actor">
                        <span className="aui-avatar" data-size="20" data-bot={who.ai || who.bot || undefined} data-tone={avatarTone(who.name)} aria-hidden="true">{who.icon ?? who.avatar ?? letterOf(who.name)}</span>
                        <b>{who.name}</b>
                        {who.ai && <span className="aui-ai-chip">AI</span>}
                      </span>
                      <span className="aui-log-text">
                        {k && <span className="aui-log-kind" data-tone={k.tone ?? "neutral"}>{k.tag ?? k.label}</span>}
                        {text(item)}
                        {inline && (
                          <ChangeValue className="aui-oplog-change aui-log-inline" before={inline.before} after={inline.after} />
                        )}
                        {st && <> <LogStatusPill status={st} /></>}
                      </span>
                      <span className="aui-log-target">{target && <span className="aui-log-object">{target(item)}</span>}</span>
                      <span className="aui-log-result">{res && <StatusBadge tone={res.tone}>{res.label}</StatusBadge>}</span>
                      {canOpen ? (
                        <button type="button" className="aui-log-toggle aui-icon-button" aria-expanded={isOpen} aria-label={isOpen ? "收起详情" : "展开详情"} onClick={(e) => { e.stopPropagation(); toggle(id); }}>
                          <ChevronDown aria-hidden="true" />
                        </button>
                      ) : <span />}
                    </div>
                    {isOpen && (
                      <div className="aui-log-detail">
                        {change?.meta && change.meta.length > 0 && <div className="aui-log-meta">{change.meta.map((m, i) => <span key={i}>{m}</span>)}</div>}
                        {change && change.changes.length > 0 && (
                          <table className="aui-log-diff">
                            <caption className="aui-sr-only">改前改后</caption>
                            <thead><tr><th scope="col">字段</th><th scope="col">改前</th><th scope="col">改后</th></tr></thead>
                            <tbody>
                              {change.changes.map((c, i) => {
                                const same = c.before === c.after;
                                return (
                                  <tr key={c.key ?? `${c.field}-${i}`} data-same={same || undefined}>
                                    <th scope="row">{c.field}</th>
                                    <td className="aui-log-before">{c.before}</td>
                                    <td className="aui-log-after">{same ? "没变" : c.after}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                        {more}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

