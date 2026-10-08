"use client";
/**
 * GanttView on phones / narrow containers (bt/views V7, review 08): the rows as a list grouped like the
 * chart — title + option chip, 「09-28 → 10-02 · 5 天」 + owner, and a progress mini-track of the
 * current window with the today line. Tap opens the record.
 */
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import type { OptionTone } from "../option-tone.ts";
import { softTone } from "./view-color-core.ts";
import { Avatar } from "../avatar.tsx";
import { ganttTrack, spanText, type GanttRow, type GanttSpan, type GanttWindow } from "./gantt-core.ts";
import { addDays, diffDays, shortDay, type DayKey } from "./date-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type GanttListItem = { title: string; tone: OptionTone; chip?: string; owner?: string; span: GanttSpan | null };

export function GanttPhoneList<T>({ rows, item, window, today, workdaysOnly, label, onOpen, onToggleGroup }: {
  rows: readonly GanttRow<T>[];
  item: (record: T) => GanttListItem;
  window: GanttWindow;
  today: DayKey;
  workdaysOnly: boolean;
  label: string;
  onOpen?: (record: T) => void;
  onToggleGroup: (key: string) => void;
}) {
  const todayAt = diffDays(window.start, today);
  const todayPct = todayAt >= 0 && todayAt < window.days ? ((todayAt + 0.5) / window.days) * 100 : null;
  const last = shortDay(addDays(window.start, Math.max(0, window.days - 1)));
  return (
    <div className="aui-gantt-phone">
      <div className="aui-gantt-phone-scale" aria-hidden="true">
        {/* The edge dates give way to 「今天」 when it is close to them. */}
        <span>{todayPct === null || todayPct > 24 ? shortDay(window.start) : ""}</span>
        {todayPct !== null && <span className="aui-gantt-phone-today" style={{ left: `${Math.min(84, Math.max(16, todayPct))}%` }}>今天 {shortDay(today)}</span>}
        <span>{todayPct === null || todayPct < 76 ? last : ""}</span>
      </div>
      <ol className="aui-gantt-phone-list" aria-label={`${label}列表`}>
        {rows.map((row) => {
          if (row.kind === "group") {
            return (
              <li key={row.key} className="aui-gantt-mgroup" data-depth={row.depth}>
                <button type="button" aria-expanded={!row.collapsed} onClick={() => onToggleGroup(row.key)}>
                  {row.collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                  {row.label} <small>{row.count} 条</small>
                </button>
              </li>
            );
          }
          const it = item(row.record);
          const track = it.span ? ganttTrack(it.span, window) : null;
          const tone = softTone(it.tone);
          return (
            <li key={row.key}>
              <button type="button" className="aui-gantt-mrow" data-vtone={tone} onClick={() => onOpen?.(row.record)}>
                <span className="aui-gantt-mrow-head">
                  <b>{it.title}</b>
                  {it.chip && (
                    <span className="aui-chip" data-tone={tone}>
                      <span className="aui-chip-label">{it.chip}</span>
                    </span>
                  )}
                </span>
                <span className="aui-gantt-mrow-meta">
                  <CalendarDays size={14} aria-hidden="true" />
                  <span>{it.span ? `${spanText(it.span)} · ${workdaysOnly ? `${it.span.workdays} 个工作日` : `${it.span.days} 天`}` : "未排期"}</span>
                  {it.owner && (
                    <span className="aui-gantt-mrow-owner">
                      <Avatar name={it.owner} size={20} />
                      {it.owner}
                    </span>
                  )}
                </span>
                <span className="aui-gantt-track" aria-hidden="true">
                  {track && <i className="aui-gantt-track-bar" style={{ left: `${track.from * 100}%`, width: `${(track.to - track.from) * 100}%` }} />}
                  {todayPct !== null && <i className="aui-gantt-track-today" style={{ left: `${todayPct}%` }} />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

