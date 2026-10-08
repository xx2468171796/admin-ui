"use client";
/**
 * Timeline building blocks: the one timeline anatomy shared by ActivityFeed, LogTimeline
 * and a host's own follow-up list (CRM 跟进). Left a 20px rail with a 1px line through its centre; on it a
 * person's action = 20px avatar (per-person colour, light background + first character), a system event = an
 * 8px dot, a result = a 20px circle with ✓ / ✕ / !. Title line 「who + did what + object」 with the time on the
 * right (hover = full time, body number font), body 13.5px, attachments / recordings as outlined small cards.
 * Days are grouped under a sticky 「今天 10月7日 周三」 heading; 「显示更早的 N 条」 at the bottom.
 * Phones: the time folds under the title. Styles: styles/timeline.css (.aui-tl*).
 *
 *   <Timeline label="跟进记录">
 *     <TimelineDay label="今天" date="10月7日 周三">
 *       <TimelineItem marker="person" avatar="小王" title={<><b>小王</b> LINE 跟进</>} time="10:42" timeTitle="2026-10-07 10:42:10">
 *         客户说太太想先看样品…
 *       </TimelineItem>
 *       <TimelineItem marker="system" title="提醒：下次跟进是今天" time="09:00" />
 *     </TimelineDay>
 *   </Timeline>
 *   <TimelineMore count={9} onClick={…} />
 */
import type { ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { avatarLetter, avatarTone } from "./avatar-core.ts";
import { SkeletonBlock } from "./loading.tsx";
import type { TimelineDotTone, TimelineMarkerKind, TimelineResult } from "./timeline-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/collections.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/collections.css";

export type { TimelineDotTone, TimelineMarkerKind, TimelineResult } from "./timeline-core.ts";

export type TimelineProps = {
  /** Accessible name of the list (「客户动态」「跟进记录」). */
  label: string;
  /** TimelineDay groups or TimelineItem rows. */
  children: ReactNode;
  className?: string;
};

/** The list (an <ol>): put TimelineDay groups or TimelineItem rows inside. */
export function Timeline({ label, children, className }: TimelineProps) {
  return <ol className={className ? `aui-tl ${className}` : "aui-tl"} aria-label={label}>{children}</ol>;
}

export type TimelineDayProps = {
  /** 「今天」「昨天」「10月5日」 (see dayHeading in timeline-core for the standard text). */
  label: ReactNode;
  /** Grey part after it: 「10月7日 周三」 / 「周一」 / 「6 条」. */
  date?: ReactNode;
  children: ReactNode;
  /** Extra class on the heading (ActivityFeed keeps its old hook `.aui-feed-day-label`). */
  headingClassName?: string;
};

/** One day: a sticky heading and its items. */
export function TimelineDay({ label, date, children, headingClassName }: TimelineDayProps) {
  return (
    <li className="aui-tl-day">
      <div className={headingClassName ? `aui-tl-day-label ${headingClassName}` : "aui-tl-day-label"}>
        <span>{label}</span>
        {date !== undefined && date !== null && date !== "" && <small>{date}</small>}
      </div>
      <ol className="aui-tl-items">{children}</ol>
    </li>
  );
}

export type TimelineItemProps = {
  /** person = avatar, system = 8px dot (default), result = ✓ / ✕ / ! circle. */
  marker?: TimelineMarkerKind;
  /** marker="person": the person's name (first character shown). */
  avatar?: string;
  /** marker="person": stable key for the colour (account id; default the name). */
  avatarKey?: string;
  /** marker="system": dot colour (default neutral grey). */
  dot?: TimelineDotTone;
  /** marker="result": success ✓ (default) / danger ✕ / warning !. */
  result?: TimelineResult;
  /** 「<b>小王</b> 改了阶段 需求确认 → 报价」: who + did what + object. */
  title: ReactNode;
  /** Short time on the right (「10:42」「2 分钟前」). */
  time?: ReactNode;
  /** Full time shown on hover (「2026-10-07 10:42:10」). */
  timeTitle?: string;
  /** Machine-readable time for <time dateTime>. */
  dateTime?: string;
  /** Body (13.5px): the note, the call summary. */
  children?: ReactNode;
  /** Attachment / recording cards under the body (TimelineAttachment). */
  attachments?: ReactNode;
  /** Grey title (system events read quieter); default true for marker="system". */
  muted?: boolean;
  /** Make the title line a button (open the record / event). */
  onOpen?: () => void;
  /** Extra class on the <li> (ActivityFeed keeps `.aui-feed-item`). */
  className?: string;
  /** Extra data-* hooks for hosts / tests. */
  tone?: string;
};

const RESULT_LABEL: Record<TimelineResult, string> = { success: "成功", danger: "失败", warning: "注意" };

/** The marker on the rail; centred on the 1px line. */
export function TimelineMarker({ marker = "system", avatar, avatarKey, dot = "neutral", result = "success" }: Pick<TimelineItemProps, "marker" | "avatar" | "avatarKey" | "dot" | "result">) {
  if (marker === "person")
    return <span className="aui-tl-marker" data-kind="person"><span className="aui-avatar" data-size="20" data-tone={avatarTone(avatarKey ?? avatar)} aria-hidden="true">{avatarLetter(avatar)}</span></span>;
  if (marker === "result") {
    const icon = result === "success" ? <Check aria-hidden="true" /> : result === "danger" ? <X aria-hidden="true" /> : <b aria-hidden="true">!</b>;
    return <span className="aui-tl-marker" data-kind="result" data-result={result}>{icon}<span className="aui-sr-only">{RESULT_LABEL[result]}</span></span>;
  }
  return <span className="aui-tl-marker" data-kind="system" data-dot={dot} aria-hidden="true"><i /></span>;
}

/** One event on the rail. */
export function TimelineItem(props: TimelineItemProps) {
  const { marker = "system", title, time, timeTitle, dateTime, children, attachments, onOpen, className } = props;
  const muted = props.muted ?? marker === "system";
  const head = (
    <>
      <span className="aui-tl-title">{title}</span>
      {time !== undefined && time !== null && <time className="aui-tl-time" dateTime={dateTime} data-tip={timeTitle}>{time}</time>}
    </>
  );
  return (
    <li className={className ? `aui-tl-item ${className}` : "aui-tl-item"} data-kind={marker} data-muted={muted || undefined} data-tone={props.tone}>
      <TimelineMarker marker={marker} avatar={props.avatar} avatarKey={props.avatarKey} dot={props.dot} result={props.result} />
      {onOpen ? <button type="button" className="aui-tl-head" onClick={onOpen}>{head}</button> : <div className="aui-tl-head">{head}</div>}
      {children !== undefined && children !== null && children !== false && <div className="aui-tl-body">{children}</div>}
      {attachments && <div className="aui-tl-attachments">{attachments}</div>}
    </li>
  );
}

/** An outlined small card for a file / recording under a timeline item. */
export function TimelineAttachment({ icon, children, onClick, href }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; href?: string }) {
  const inner = <>{icon && <span className="aui-tl-attachment-icon" aria-hidden="true">{icon}</span>}<span className="aui-tl-attachment-text">{children}</span></>;
  if (href) return <a className="aui-tl-attachment" href={href} target="_blank" rel="noreferrer">{inner}</a>;
  if (onClick) return <button type="button" className="aui-tl-attachment" onClick={onClick}>{inner}</button>;
  return <span className="aui-tl-attachment">{inner}</span>;
}

/** 「显示更早的 N 条」 under a timeline (renders nothing when count ≤ 0). */
export function TimelineMore({ count, onClick, label, loading }: { count: number; onClick: () => void; label?: string; loading?: boolean }) {
  if (!(count > 0)) return null;
  return (
    <button type="button" className="aui-tl-more" disabled={loading} onClick={onClick}>
      <ChevronDown aria-hidden="true" />
      {loading ? "正在加载…" : label ?? `显示更早的 ${count.toLocaleString("zh-CN")} 条`}
    </button>
  );
}

/** Skeleton rows in the timeline shape (first load). */
export function TimelineSkeleton({ rows = 3, label = "正在加载…" }: { rows?: number; label?: string }) {
  return (
    <div className="aui-tl-skeleton" aria-busy="true">
      <span className="aui-sr-only" role="status">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="aui-tl-skel-row" aria-hidden="true">
          <SkeletonBlock shape="circle" height={20} />
          <span className="aui-tl-skel-lines"><SkeletonBlock width={`${[34, 26, 40][i % 3] ?? 30}%`} /><SkeletonBlock width={`${[72, 58, 64][i % 3] ?? 60}%`} /></span>
          <SkeletonBlock width={40} />
        </div>
      ))}
    </div>
  );
}
