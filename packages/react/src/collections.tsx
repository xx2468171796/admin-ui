"use client";
/**
 * Lightweight collections for data that does not need the full multi-dimensional table
 * (BitableGrid). Root entry, no TanStack. When to use which: TABLES.md §1 / collections-core.ts.
 * - CompactTable: a small fixed set read at a glance (rankings, stats next to a chart, a few
 *   configured items, tables inside dialogs / cards / tabs). Same GridField definitions as
 *   BitableGrid, so a list can move between the two by swapping the component.
 * - ActivityFeed: time-ordered events, newest first, grouped by day.
 * - StatusChecklist: a few named checks with a status and a reason.
 * All three open the record-detail dialog on a row (TABLES.md §3) when given a layout.
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, CircleMinus, CircleX, LoaderCircle, Maximize2 } from "lucide-react";
import { Button } from "./primitives.tsx";
import { StatePanel } from "./layout.tsx";
import { RowActions, type RowAction } from "./row-actions.tsx";
import { CellBudgetContext, type TableCellBudget } from "./cell-budget.ts";
import { useRecordExpand } from "./record-expand.tsx";
import { useRecordDetail } from "./record-detail-state.tsx";
import type { RecordDetailLevel, RecordLayout, RecordTone } from "./record-detail-core.ts";
import { ROW_HEIGHT_PRESETS, rowLineBudget, type TableRowHeightPreset } from "./table-rows.ts";
import { compareSortKeys, fieldText, sortKey, type GridField } from "./grid-core.ts";
import { renderGridCell } from "./grid-cells.tsx";
import { CHECK_STATUS_LABELS, groupByDay, summarizeChecks, type CheckStatus } from "./collections-core.ts";
import { formatDateTime, relativeTime } from "./format.ts";
import { Timeline, TimelineDay, TimelineItem, TimelineMore, TimelineSkeleton, type TimelineItemProps } from "./timeline.tsx";
import { dayHeading, markerForTone, type TimelineDotTone, type TimelineResult } from "./timeline-core.ts";
import { IconButton, Link } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/collections.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/collections.css";



type StateProps = { loading?: boolean; error?: string; onRetry?: () => void; emptyLabel?: string };
function CollectionState({ loading, error, onRetry, emptyLabel, empty }: StateProps & { empty: boolean }) {
  if (loading) return <StatePanel kind="loading" />;
  if (error) return <StatePanel kind="error" message={error} onRetry={onRetry} />;
  if (empty) return <StatePanel kind="empty" message={emptyLabel} />;
  return null;
}

/** 「显示更多」 for long local lists: shows `step` more each time; null when everything is shown. */
function useShowMore(total: number, first: number | undefined, step: number) {
  const [shown, setShown] = useState(first ?? Infinity);
  useEffect(() => setShown(first ?? Infinity), [first]);
  const visible = Math.min(total, shown);
  return { visible, more: visible < total ? () => setShown((n) => n + step) : null, rest: total - visible };
}

// ---------------------------------------------------------------- CompactTable

export type CompactTableProps<T> = StateProps & {
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** Same field definitions as BitableGrid (types, value / text / render, options with tones). */
  fields: readonly GridField<T>[];
  /** Keys of the fields shown as columns, in order (default: every field). The rest appear in the record detail. */
  columns?: readonly string[];
  /** Accessible name of the table. */
  caption: string;
  /** Fixed sort (no sort UI): the order the rows are shown in. */
  sort?: { key: string; direction: "asc" | "desc" };
  /** Row height preset (default short = one line). */
  rowHeight?: TableRowHeightPreset;
  /** Actions per row: one action shows as a button, more go into the ⋯ menu. */
  rowActions?: (row: T) => readonly RowAction[];
  /**
   * Open a row in the record-detail dialog (default on when some fields are not shown as columns,
   * or a layout is given). `false` turns it off.
   */
  expandRecord?: boolean | { layout?: Partial<RecordLayout<T>>; level?: Exclude<RecordDetailLevel, "page"> };
  /** Show this many rows first, then 「显示更多」 (default: all). */
  maxRows?: number;
  /** A link to the full list (e.g. the page with the BitableGrid) shown under the table. */
  viewAll?: { label: string; onClick?: () => void; href?: string };
  /** Scroll inside this height (px) instead of growing the page. */
  maxHeight?: number;
  /** Hide the header row (2-column key → value style lists). */
  hideHeader?: boolean;
};

/**
 * A plain, read-at-a-glance table: header row, fixed one-line rows (cells clamp like the grid), numbers
 * right-aligned, at most one inline action (else ⋯), row → record detail. No toolbar, no row numbers,
 * no summary bar, no virtualization — use BitableGrid when users need to search / filter / sort.
 */
export function CompactTable<T>({ rows, getRowId, fields, columns, caption, sort, rowHeight = "short", rowActions, expandRecord, maxRows, viewAll, maxHeight, hideHeader, loading, error, onRetry, emptyLabel }: CompactTableProps<T>) {
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const shown = (columns ?? fields.map((f) => f.key)).map((key) => byKey.get(key)).filter((f): f is GridField<T> => Boolean(f));
  const ordered = useMemo(() => {
    const field = sort ? byKey.get(sort.key) : undefined;
    if (!field || !sort) return rows.slice();
    return rows.map((row, i) => ({ row, i, k: sortKey(field, row) })).sort((a, b) => {
      if (a.k === undefined || b.k === undefined) return a.k === b.k ? a.i - b.i : a.k === undefined ? 1 : -1;
      const c = compareSortKeys(a.k, b.k);
      return (sort.direction === "desc" ? -c : c) || a.i - b.i;
    }).map((x) => x.row);
  }, [rows, sort, byKey]);
  const page = useShowMore(ordered.length, maxRows, maxRows ?? 20);
  const visibleRows = ordered.slice(0, page.visible);
  const hiddenFields = fields.length > shown.length;
  const recordOn = expandRecord === undefined ? hiddenFields : expandRecord !== false;
  const recordOptions = expandRecord && typeof expandRecord === "object" ? expandRecord : {};
  const primary = fields.find((f) => f.primary) ?? fields[0];
  const titleOf = (row: T) => (primary ? fieldText(primary, row) : "") || getRowId(row);
  const expand = useRecordExpand<T>({
    options: recordOn ? { title: titleOf, label: titleOf, layout: recordOptions.layout, level: recordOptions.level } : undefined,
    rows: ordered,
    rowKey: getRowId,
    enabled: !loading && !error,
    fields: (row) => fields.map((f) => ({ key: f.key, label: f.title, value: f.detail ? f.detail(row) : renderGridCell(f, row), text: fieldText(f, row), full: f.type === "longText" || f.type === "multiSelect" || Boolean(f.detail), copy: f.primary || f.type === "url" || f.type === "email" })),
    onRefocus: () => undefined,
  });
  const height = ROW_HEIGHT_PRESETS[rowHeight];
  const budget: TableCellBudget = { lines: rowLineBudget(height), clamped: true, compact: height < 40 };
  const hasActions = Boolean(rowActions);
  const state = <CollectionState loading={loading} error={error} onRetry={onRetry} emptyLabel={emptyLabel} empty={!rows.length} />;
  if (loading || error || !rows.length) return <div className="aui-compact" data-state>{state}</div>;
  return (
    <div className="aui-compact">
      <div className="aui-compact-scroll" style={maxHeight ? { maxHeight } : undefined}>
        <table className="aui-compact-table" aria-label={caption} style={{ "--aui-compact-row-h": `${height}px`, "--aui-row-lines": budget.lines } as CSSProperties}>
          {!hideHeader && (
            <thead>
              <tr>
                {shown.map((f) => (
                  <th key={f.key} scope="col" data-numeric={f.type === "number" || f.type === "money" || undefined} style={f.width ? { width: f.width } : undefined}>{f.title}</th>
                ))}
                {(hasActions || recordOn) && <th scope="col" className="aui-compact-actions"><span className="aui-sr-only">操作</span></th>}
              </tr>
            </thead>
          )}
          <CellBudgetContext.Provider value={budget}>
            <tbody>
              {visibleRows.map((row) => {
                const id = getRowId(row);
                const actions = rowActions?.(row) ?? [];
                const single = actions.length === 1 && !actions[0]!.destructive ? actions[0]! : null;
                return (
                  <tr key={id} data-row-key={id} data-clickable={recordOn || undefined} onClick={(event) => { if (recordOn && !(event.target as HTMLElement).closest("a, button, input, [role=checkbox], [role=menu]")) expand.open(id); }}>
                    {shown.map((f, i) => {
                      const Tag = i === 0 ? "th" : "td";
                      return (
                        <Tag key={f.key} scope={i === 0 ? "row" : undefined} data-numeric={f.type === "number" || f.type === "money" || undefined} data-primary={f.primary || undefined}>
                          <div className="aui-cell">{renderGridCell(f, row)}</div>
                        </Tag>
                      );
                    })}
                    {(hasActions || recordOn) && (
                      <td className="aui-compact-actions">
                        <span className="aui-compact-actions-inner">
                          {single ? (
                            <Button size="sm" variant="ghost" disabled={single.disabled} disabledReason={single.disabledReason} onClick={single.onSelect}>{single.icon}{single.label}</Button>
                          ) : actions.length ? (
                            <RowActions label={`${titleOf(row)}的操作`} actions={actions} />
                          ) : null}
                          {recordOn && (
                            <IconButton label={`查看 ${titleOf(row)} 的详情`} tooltip="查看详情" className="aui-compact-open" onClick={() => expand.open(id)} icon={<Maximize2 />} />
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </CellBudgetContext.Provider>
        </table>
      </div>
      {(page.more || viewAll) && (
        <div className="aui-compact-foot">
          {page.more && <Button variant="ghost" size="sm" onClick={page.more}>显示更多（还有 {page.rest} 条）</Button>}
          {viewAll && (viewAll.href
            ? <Link kind="next" href={viewAll.href} onClick={viewAll.onClick ? (e) => { e.preventDefault(); viewAll.onClick!(); } : undefined}>{viewAll.label}</Link>
            : <Button variant="text" size="sm" onClick={viewAll.onClick}>{viewAll.label}</Button>)}
        </div>
      )}
      {expand.element}
    </div>
  );
}

// ---------------------------------------------------------------- ActivityFeed

export type FeedTone = RecordTone;
/** The rail marker of one ActivityFeed item (see TimelineItem). */
export type FeedMarker =
  | { kind: "person"; name: string; key?: string }
  | { kind: "system"; dot?: TimelineDotTone }
  | { kind: "result"; result: TimelineResult };
export type ActivityFeedProps<T> = StateProps & {
  items: readonly T[];
  getId: (item: T) => string;
  /** When it happened (ISO / ms / Date). Items are shown newest first. */
  time: (item: T) => string | number | Date | null | undefined;
  /** One line: what happened (「备份成功」「张三 修改了 阶段」). */
  title: (item: T) => ReactNode;
  /** Who did it (shown after the title, muted). */
  actor?: (item: T) => ReactNode;
  /** Up to two lines of detail (clamped; the full text is in the record detail). */
  description?: (item: T) => ReactNode;
  /** Small extras after the detail (「1.2 GB」, a duration) — plain text, not a status pill. */
  meta?: (item: T) => ReactNode;
  /** Colour → rail marker when `marker` is not given: success ✓ / danger ✕ / warning ! circles, others a dot. */
  tone?: (item: T) => FeedTone | null | undefined;
  /** Rail marker: a person's avatar, a system dot or a result circle (default from `tone`). */
  marker?: (item: T) => FeedMarker | null | undefined;
  /** Attachment / recording cards under the detail (TimelineAttachment). */
  attachments?: (item: T) => ReactNode;
  /** Accessible name of the list. */
  caption: string;
  /** Day headings (今天 10月7日 周三 / 昨天 / 10月5日) — default true. */
  groupByDay?: boolean;
  /** Show this many first, then 「显示更早的 N 条」 (default 20). */
  maxItems?: number;
  /** Open an item: a record-detail layout (dialog with prev / next) or a callback. */
  layout?: RecordLayout<T>;
  onOpen?: (item: T) => void;
  /** Which items can be opened (default: all when layout / onOpen is given); the others are plain rows. */
  canOpen?: (item: T) => boolean;
  /** Scroll inside this height (px). */
  maxHeight?: number;
  timeZone?: string;
};

function feedMarker<T>(item: T, marker: ActivityFeedProps<T>["marker"], tone: ActivityFeedProps<T>["tone"]): Pick<TimelineItemProps, "marker" | "avatar" | "avatarKey" | "dot" | "result"> {
  const given = marker?.(item);
  if (given?.kind === "person") return { marker: "person", avatar: given.name, avatarKey: given.key };
  if (given?.kind === "result") return { marker: "result", result: given.result };
  if (given?.kind === "system") return { marker: "system", dot: given.dot };
  const fromTone = markerForTone(tone?.(item));
  return { marker: fromTone.kind, result: fromTone.result, dot: fromTone.dot };
}

/**
 * Time-ordered events, newest first, grouped by day, in the one timeline anatomy: rail marker
 * (person avatar / system dot / result circle), 「title · actor」 with the relative time on the right (exact
 * time on hover), detail, attachments; 「显示更早的 N 条」 at the bottom.
 */
export function ActivityFeed<T>({ items, getId, time, title, actor, description, meta, tone, marker, attachments, caption, groupByDay: grouped = true, maxItems = 20, layout, onOpen, canOpen, maxHeight, timeZone: timeZoneProp, loading, error, onRetry, emptyLabel }: ActivityFeedProps<T>) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => { if (typeof document === "undefined" || document.visibilityState !== "hidden") setNow(Date.now()); }, 60_000);
    return () => clearInterval(timer);
  }, []);
  const groups = useMemo(() => groupByDay(items, time, timeZone), [items, time, timeZone]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const page = useShowMore(flat.length, maxItems, maxItems);
  const detail = useRecordDetail<T>({ rows: flat, rowKey: getId, layout: layout ?? { title: () => "", sections: [] }, defaultLevel: "peek", enabled: Boolean(layout) && !loading && !error });
  const open = layout ? (item: T) => detail.open(getId(item)) : onOpen;
  if (loading) return <div className="aui-feed-wrap"><TimelineSkeleton label={`正在加载${caption}…`} /></div>;
  if (error || !items.length) return <div className="aui-feed-wrap"><CollectionState error={error} onRetry={onRetry} emptyLabel={emptyLabel} empty={!items.length} /></div>;
  let left = page.visible;
  const row = (item: T) => {
    const at = time(item);
    const desc = description?.(item);
    const extra = meta?.(item);
    const body = desc || extra ? <>{desc}{desc && extra ? <span className="aui-feed-sep"> · </span> : null}{extra && <span className="aui-feed-meta">{extra}</span>}</> : null;
    return (
      <TimelineItem
        key={getId(item)}
        className="aui-feed-item"
        tone={tone?.(item) ?? undefined}
        {...feedMarker(item, marker, tone)}
        muted={false}
        title={<><span className="aui-feed-what">{title(item)}</span>{actor && <span className="aui-feed-actor">{actor(item)}</span>}</>}
        time={relativeTime(at, now, timeZone)}
        timeTitle={formatDateTime(at, { seconds: true, timeZone }) ?? "—"}
        dateTime={at instanceof Date ? at.toISOString() : at === null || at === undefined ? undefined : String(at)}
        onOpen={open && (canOpen?.(item) ?? true) ? () => open(item) : undefined}
        attachments={attachments?.(item)}
      >
        {body && <span className="aui-feed-desc">{body}</span>}
      </TimelineItem>
    );
  };
  return (
    <div className="aui-feed-wrap">
      <div className="aui-feed-scroll" style={maxHeight ? { maxHeight } : undefined}>
        <Timeline label={caption} className="aui-feed">
          {groups.map((group) => {
            if (left <= 0) return null;
            const part = group.items.slice(0, left);
            left -= part.length;
            if (!grouped) return part.map(row);
            const heading = dayHeading(group.key, now, timeZone);
            return (
              <TimelineDay key={group.key || "unknown"} label={heading.label} date={heading.date} headingClassName="aui-feed-day-label">
                {part.map(row)}
              </TimelineDay>
            );
          })}
        </Timeline>
      </div>
      {page.more && <TimelineMore count={page.rest} onClick={page.more} />}
      {layout ? detail.element : null}
    </div>
  );
}

// ---------------------------------------------------------------- StatusChecklist

export type ChecklistAction = { label: string; onSelect: () => void; disabled?: boolean; disabledReason?: string };
export type StatusChecklistProps<T> = StateProps & {
  items: readonly T[];
  getId: (item: T) => string;
  label: (item: T) => ReactNode;
  status: (item: T) => CheckStatus;
  /** Why (shown under the label): the error, the version, 「3 分钟前检查」. */
  reason?: (item: T) => ReactNode;
  /** Small extras on the right (version, latency). */
  meta?: (item: T) => ReactNode;
  /** One fix / details action per item. */
  action?: (item: T) => ChecklistAction | null | undefined;
  /** Status text override (default 正常 / 注意 / 异常 / 进行中 / 未启用 / 未知). */
  statusLabel?: (item: T) => string;
  caption: string;
  /** Summary line on top (「3 项正常 · 1 项异常」), default true. */
  summary?: boolean;
  /** Open an item in the record-detail dialog. */
  layout?: RecordLayout<T>;
};

const CHECK_ICONS: Record<CheckStatus, typeof CircleCheck> = { ok: CircleCheck, warning: CircleAlert, error: CircleX, pending: LoaderCircle, off: CircleMinus, unknown: CircleHelp };

/** A few named checks, each with a status icon + word (never colour alone), a reason and an optional action. */
export function StatusChecklist<T>({ items, getId, label, status, reason, meta, action, statusLabel, caption, summary = true, layout, loading, error, onRetry, emptyLabel }: StatusChecklistProps<T>) {
  const detail = useRecordDetail<T>({ rows: items, rowKey: getId, layout: layout ?? { title: () => "", sections: [] }, defaultLevel: "peek", enabled: Boolean(layout) && !loading && !error });
  if (loading || error || !items.length) return <div className="aui-checklist-wrap"><CollectionState loading={loading} error={error} onRetry={onRetry} emptyLabel={emptyLabel} empty={!items.length} /></div>;
  const sum = summarizeChecks(items.map(status));
  const SumIcon = sum.worst ? CHECK_ICONS[sum.worst] : CircleDashed;
  return (
    <div className="aui-checklist-wrap">
      {summary && (
        <p className="aui-checklist-summary" data-status={sum.worst ?? undefined}>
          <SumIcon aria-hidden="true" />{sum.text}
        </p>
      )}
      <ul className="aui-checklist" aria-label={caption}>
        {items.map((item) => {
          const s = status(item);
          const Icon = CHECK_ICONS[s];
          const act = action?.(item);
          return (
            <li key={getId(item)} className="aui-checkitem" data-status={s}>
              <Icon className="aui-checkitem-icon" aria-hidden="true" />
              <span className="aui-checkitem-main">
                <span className="aui-checkitem-label">
                  {layout ? <button type="button" className="aui-checkitem-open" onClick={() => detail.open(getId(item))}>{label(item)}</button> : label(item)}
                  <span className="aui-checkitem-status">{statusLabel?.(item) ?? CHECK_STATUS_LABELS[s]}</span>
                </span>
                {reason && <span className="aui-checkitem-reason">{reason(item)}</span>}
              </span>
              {meta && <span className="aui-checkitem-meta">{meta(item)}</span>}
              {act && <Button size="sm" variant="outline" disabled={act.disabled} disabledReason={act.disabledReason} onClick={act.onSelect}>{act.label}</Button>}
            </li>
          );
        })}
      </ul>
      {layout ? detail.element : null}
    </div>
  );
}
