"use client";
/** LogTimeline variant="operations" (D23 operation log with whole-batch undo); split out of log-timeline.tsx. */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, TriangleAlert, Undo2 } from "lucide-react";
import { ChangeValue } from "./change-value.tsx";
import { Button } from "./primitives.tsx";
import { useNotify } from "./notifications.tsx";
import { groupByDay } from "./collections-core.ts";
import { toTime } from "./format.ts";
import { ConflictModePicker, ConflictToggle } from "./conflict-chooser.tsx";
import { avatarTone } from "./avatar-core.ts";
import {
  DEFAULT_CONFLICT_DECISIONS,
  DEFAULT_UNDO_WINDOW_DAYS,
  conflictChoice,
  setConflictChoice,
  setConflictMode,
  shortMoment,
  splitUndoWindow,
  zonedClock,
  type ConflictDecisions,
} from "./history-core.ts";
import type { LogChange, LogTimelineProps } from "./log-timeline.tsx";
import { hhmm, letterOf, LogStatusPill, UNDO_LABEL } from "./log-shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/history.css";

const changeKey = (c: LogChange, i: number) => c.key ?? `${c.field}-${i}`;

export function OperationsList<T>(props: LogTimelineProps<T>) {
  const { items, time, caption, defaultExpanded, timeZone: timeZoneProp, undoWindowDays = DEFAULT_UNDO_WINDOW_DAYS, oldNote = "只能逐条恢复", now: nowProp } = props;
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const [open, setOpen] = useState<readonly string[]>(defaultExpanded ?? []);
  const [decisions, setDecisions] = useState<Readonly<Record<string, ConflictDecisions>>>({});
  const now = nowProp ?? Date.now();
  const { recent, old, start } = useMemo(() => splitUndoWindow(items, time, now, undoWindowDays), [items, time, now, undoWindowDays]);
  const groups = useMemo(() => groupByDay(recent, time, timeZone), [recent, time, timeZone]);
  const old2 = useMemo(() => groupByDay(old, time, timeZone).flatMap((g) => g.items), [old, time, timeZone]);
  const today = zonedClock(now, timeZone).date;
  const yesterday = zonedClock(now - 86_400_000, timeZone).date;
  const toggle = (id: string) => setOpen((list) => (list.includes(id) ? list.filter((k) => k !== id) : [...list, id]));
  const row = (item: T, outside: boolean) => (
    <OperationRow
      key={props.getId(item)}
      p={props}
      item={item}
      outside={outside}
      open={open.includes(props.getId(item))}
      onToggle={toggle}
      decisions={decisions[props.getId(item)] ?? DEFAULT_CONFLICT_DECISIONS}
      onDecisions={(id, d) => setDecisions((all) => ({ ...all, [id]: d }))}
    />
  );
  return (
    <div className="aui-oplog">
      <div className="aui-oplog-head" aria-hidden="true">
        <span>操作编号</span><span>时间</span><span>操作人</span><span>做了什么</span><span>影响</span><span>动作</span>
      </div>
      <ol className="aui-log-days" aria-label={caption}>
        {groups.map((group) => {
          const label = group.key === today ? `今天 ${group.key.slice(5)}` : group.key === yesterday ? `昨天 ${group.key.slice(5)}` : group.key ? group.key.slice(5) : "时间未知";
          return (
            <li key={group.key || "unknown"} className="aui-log-day">
              <div className="aui-log-day-label">{label}</div>
              <ol className="aui-log-items">{group.items.map((item) => row(item, false))}</ol>
            </li>
          );
        })}
        {old2.length > 0 && (
          <li className="aui-log-day" data-old>
            <div className="aui-log-day-label">
              超过 {undoWindowDays} 天<small>{shortMoment(start, now, timeZone)} 之前 · {oldNote}</small>
            </div>
            <ol className="aui-log-items">{old2.map((item) => row(item, true))}</ol>
          </li>
        )}
      </ol>
    </div>
  );
}

function OperationRow<T>({ p, item, outside, open, onToggle, decisions, onDecisions }: { p: LogTimelineProps<T>; item: T; outside: boolean; open: boolean; onToggle: (id: string) => void; decisions: ConflictDecisions; onDecisions: (id: string, d: ConflictDecisions) => void }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const { timeZone: timeZoneProp, undoWindowDays = DEFAULT_UNDO_WINDOW_DAYS } = p;
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const id = p.getId(item);
  const who = p.actor(item);
  const change = p.diff?.(item);
  const more = p.detail?.(item);
  const st = p.status?.(item);
  const k = p.kind && p.kinds?.find((x) => x.key === p.kind?.(item));
  const u = p.undo?.(item);
  const canOpen = Boolean(change?.changes.length || more);
  const isOpen = canOpen && open;
  const t = toTime(p.time(item));
  const when = t === null ? "—" : outside ? `${zonedClock(t, timeZone).date.slice(5)} ${zonedClock(t, timeZone).time}` : hhmm(t, timeZone);
  const conflicts = (change?.changes ?? []).map((c, i) => ({ c, key: changeKey(c, i) })).filter((x) => x.c.later);
  const reason = outside ? `超过 ${undoWindowDays} 天，只能逐条恢复` : u?.disabledReason;
  const tipId = `aui-oplog-tip-${id}`;
  const runUndo = async () => {
    if (!u || reason || busy) return;
    setBusy(true);
    try {
      await u.onUndo(conflicts.length ? decisions : null);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const later = [...new Set(conflicts.map((x) => x.c.later?.by).filter((b): b is string => Boolean(b)))];
  // 「做了什么」 wraps to two lines; anything still cut off is in the tooltip (when the host gave plain text).
  const what = p.text(item);
  const whatDetail = p.target?.(item);
  const whatTitle = [what, whatDetail].filter((part) => (typeof part === "string" && part !== "") || typeof part === "number").join(" · ");
  return (
    <li className="aui-log-item aui-oplog-item" data-open={isOpen || undefined} data-dim={outside || p.dimmed?.(item) || undefined}>
      <div className="aui-oplog-row">
        <span className="aui-oplog-code">{p.code?.(item)}</span>
        <time className="aui-log-time">{when}</time>
        <span className="aui-log-actor">
          <span className="aui-avatar" data-size="20" data-bot={who.ai || who.bot || undefined} data-tone={avatarTone(who.name)} aria-hidden="true">{who.icon ?? who.avatar ?? letterOf(who.name)}</span>
          <b data-tip={who.name}>{who.name}</b>
          {who.ai && <span className="aui-ai-chip">AI</span>}
        </span>
        <span className="aui-oplog-what" data-tip={whatTitle || undefined}>
          {p.icon && <span className="aui-oplog-icon" aria-hidden="true">{p.icon(item)}</span>}
          {k && <span className="aui-log-kind" data-tone={k.tone ?? "neutral"}>{k.tag ?? k.label}</span>}
          <b className="aui-oplog-text">{what}</b>
          {p.target && <span className="aui-oplog-detail">{whatDetail}</span>}
          {st && <LogStatusPill status={st} />}
        </span>
        <span className="aui-oplog-impact">{p.impact?.(item)}</span>
        <span className="aui-oplog-actions">
          {canOpen && (
            <Button size="sm" variant="ghost" aria-expanded={isOpen} className="aui-oplog-toggle" onClick={() => onToggle(id)}>
              {isOpen ? <ChevronDown aria-hidden="true" /> : <Eye aria-hidden="true" />}
              {isOpen ? "收起改动" : "查看改动"}
            </Button>
          )}
          {u && (
            <span className="aui-hist-tipwrap">
              <Button
                size="sm"
                variant="outline"
                className="aui-oplog-undo"
                data-kind={u.kind ?? "batch"}
                aria-disabled={reason || busy ? true : undefined}
                aria-describedby={reason ? tipId : undefined}
                aria-busy={busy || undefined}
                tooltip={reason ? undefined : u.title}
                onClick={runUndo}
              >
                <Undo2 aria-hidden="true" />
                {busy ? "撤回中…" : u.label ?? UNDO_LABEL[u.kind ?? "batch"]}
              </Button>
              {reason && <span className="aui-hist-tip" role="tooltip" id={tipId}>{reason}</span>}
            </span>
          )}
        </span>
      </div>
      {isOpen && (
        <div className="aui-oplog-open">
          {change && change.changes.length > 0 && (
            <div className="aui-oplog-diff">
              {(change.summary || change.onShowAll) && (
                <div className="aui-oplog-diff-head">
                  <span><b>改动明细</b>{change.summary ? <> · {change.summary}</> : null}</span>
                  {change.onShowAll && (
                    <Button size="sm" variant="text" onClick={change.onShowAll}>{change.showAllLabel ?? "查看全部"}<ChevronRight aria-hidden="true" /></Button>
                  )}
                </div>
              )}
              {change.meta && change.meta.length > 0 && <div className="aui-log-meta">{change.meta.map((m, i) => <span key={i}>{m}</span>)}</div>}
              <div className="aui-oplog-diff-scroll">
                <table className="aui-oplog-diff-table">
                  <caption className="aui-sr-only">改动明细</caption>
                  <thead><tr><th scope="col">记录</th><th scope="col">字段</th><th scope="col">改前 → 改后</th><th scope="col">这批之后</th></tr></thead>
                  <tbody>
                    {change.changes.map((c, i) => {
                      const key = changeKey(c, i);
                      const choice = c.later ? conflictChoice(key, decisions) : null;
                      return (
                        <tr key={key} data-later={c.later ? true : undefined}>
                          <th scope="row">{c.record ?? "—"}</th>
                          <td className="aui-oplog-field">{c.icon}{c.field}</td>
                          <td className="aui-oplog-change"><ChangeValue before={c.before} after={c.after} /></td>
                          <td className="aui-oplog-later">
                            {c.later ? (
                              <span className="aui-oplog-later-cell">
                                <span className="aui-oplog-later-text"><TriangleAlert aria-hidden="true" />{c.later.by}{c.later.at ? <> {c.later.at}</> : null} 又改成 {c.later.value}</span>
                                <ConflictToggle label={`${typeof c.record === "string" ? c.record : c.field}：保留还是退回`} value={choice ?? "keep"} onChange={(v) => onDecisions(id, setConflictChoice(decisions, key, v))} />
                              </span>
                            ) : (
                              <span className="aui-oplog-later-none">没人再改过</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {conflicts.length > 0 && (
                <div className="aui-oplog-conflict">
                  <TriangleAlert aria-hidden="true" />
                  <span><b>这批之后有 {conflicts.length} 条被 {later.join("、")} 又改过。</b>{u ? `${u.label ?? UNDO_LABEL[u.kind ?? "batch"]}时：` : "撤回时："}</span>
                  <ConflictModePicker
                    value={decisions.mode}
                    keepLabel={later.length === 1 ? `保留${later[0]}后来的修改` : "保留别人后来的修改"}
                    onChange={(mode) => onDecisions(id, setConflictMode(mode))}
                  />
                </div>
              )}
            </div>
          )}
          {more}
        </div>
      )}
    </li>
  );
}
