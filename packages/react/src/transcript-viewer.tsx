"use client";
/**
 * TranscriptViewer (bt/builders-b A1, demo D27t): a recording with its diarized transcript.
 *
 * - Player: speaker-coloured waveform (host `peaks`) with a speaker lane, AI annotation pins (click =
 *   jump), play / pause (Space), −15 s / +15 s, speed, 跳过静音, 只听 <focus speakers>, follow switch.
 * - List: clickable timestamps, follow-playback (current row highlighted and kept in view; scrolling
 *   the list yourself pauses following until 「回到正在播放」), phrase tags, masked chips with an
 *   audited reveal (`onReveal`, like SensitiveValue), 「静默 12 秒」 dividers, search with hit count.
 * - Header: title · meta · search · 「导出 ⌄」 dropdown (format, options, export / copy) · host actions.
 * - Side: host summary + clickable times, talk share per speaker, annotation counts.
 *
 * UI only: the audio URL, peaks, segments, masking and export are the host's. Speakers get the categorical
 * option hues blue / orange / teal … (SPEAKER_TONES, categories, never primary shades) on
 * the waveform, legend, avatars and share bar; annotation tones are brand-family.
 * Rules: transcript-core.ts. Styles: styles/transcript.css.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AudioLines, LocateFixed } from "lucide-react";
import { Button, cn } from "./primitives.tsx";
import { claim } from "./media-audio.tsx";
import { clampTime } from "./media-core.ts";
import { TranscriptControls, TranscriptLegend, TranscriptWave } from "./transcript-player.tsx";
import { TranscriptList, type TranscriptRevealer } from "./transcript-list.tsx";
import { AnnotationStats, ExportMenu, SearchBox, SummaryBody, TalkShareBar, type TranscriptExportOptions, type TranscriptSummary } from "./transcript-side.tsx";
import {
  annotationPins,
  annotationStats,
  countAnnotations,
  findSilences,
  nextFocusTime,
  searchTranscript,
  segmentIndexAt,
  skipSilence as skipSilenceAt,
  sortSegments,
  speakerTone,
  talkShare,
  transcriptText,
  type TranscriptCategory,
  type TranscriptSegment,
  type TranscriptSpeaker,
} from "./transcript-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";

export type { TranscriptExportOptions, TranscriptSummary } from "./transcript-side.tsx";

export type TranscriptViewerProps = {
  /** Audio URL (signed by the host). Without it (or when it fails) the transcript still works. */
  src?: string;
  /** Length in seconds (known from the host; the file's metadata wins once loaded). */
  duration: number;
  /** Host-computed amplitude peaks (any length). Absent → flat bars. */
  peaks?: readonly number[];
  speakers: readonly TranscriptSpeaker[];
  segments: readonly TranscriptSegment[];
  /** Annotation categories (需求、预算、顾虑 …) with brand-family tones. */
  categories?: readonly TranscriptCategory[];
  /** Header: title (「上门谈话 · 李承恩」), meta line, extra buttons after 「导出 ⌄」 (⋯ · 下载录音 · 关闭). */
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /**
   * AI summary card: a paragraph + key points with clickable times (D27t), or your own content
   * (a function gets `seek`). Hidden when absent.
   */
  summary?: TranscriptSummary | ((api: { seek: (time: number) => void }) => ReactNode);
  summaryTitle?: string;
  summaryAction?: ReactNode;
  /** Audited reveal of a masked span: the host checks permission, records who looked, resolves with the plain text. */
  onReveal?: TranscriptRevealer;
  /** Re-mask after this many ms (default 30 s). */
  remaskAfter?: number;
  /** 「只听客户」: a switch that plays only these speakers' segments. */
  focus?: { label: string; speakers: readonly string[] };
  /** Silences at least this long get a divider and are skipped by 跳过静音 (default 8 s). */
  silenceMin?: number;
  speeds?: readonly number[];
  defaultSkipSilence?: boolean;
  defaultFollow?: boolean;
  /** 「AI 标注」 switch label. */
  annotationsLabel?: string;
  /** Export formats in the header 「导出 ⌄」 dropdown (default Word / TXT / PDF); `onExport` does the file (server side for Word / PDF). */
  exportFormats?: readonly { value: string; label: string }[];
  onExport?: (options: TranscriptExportOptions) => void | Promise<void>;
  /** After 「复制全文」 copied the (masked) text. */
  onCopy?: (text: string) => void;
  /** Grey note in the export dropdown (default: masked text only). */
  exportNote?: ReactNode;
  /** Starting position (s). */
  initialTime?: number;
  onTimeChange?: (time: number) => void;
  /** Accessible name of the whole viewer, default 「录音文字稿」. */
  label?: string;
  className?: string;
};

const DEFAULT_SPEEDS = [1, 1.25, 1.5, 2] as const;
const DEFAULT_FORMATS = [
  { value: "docx", label: "Word" },
  { value: "txt", label: "TXT" },
  { value: "pdf", label: "PDF" },
] as const;
const IGNORE_SCROLL_MS = 700;

export function TranscriptViewer(props: TranscriptViewerProps) {
  const { src, peaks, speakers, categories = [], title, meta, actions, summary, summaryTitle = "AI 摘要", summaryAction, onReveal, remaskAfter, focus, silenceMin = 8, speeds = DEFAULT_SPEEDS, annotationsLabel = "AI 标注", exportFormats = DEFAULT_FORMATS, onExport, onCopy, exportNote, initialTime = 0, onTimeChange, label = "录音文字稿", className } = props;
  const audio = useRef<HTMLAudioElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const ignoreScrollUntil = useRef(0);
  const [loaded, setLoaded] = useState<number | null>(null);
  const duration = loaded ?? props.duration;
  const [time, setTime] = useState(initialTime);
  const [started, setStarted] = useState(initialTime > 0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rate, setRate] = useState<number>(speeds.includes(1) ? 1 : (speeds[0] ?? 1));
  const [skip, setSkip] = useState(props.defaultSkipSilence ?? true);
  const [focusOn, setFocusOn] = useState(false);
  const [follow, setFollow] = useState(props.defaultFollow ?? true);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [query, setQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);

  const segments = useMemo(() => sortSegments(props.segments), [props.segments]);
  const speakerMap = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const toneOf = useCallback((id: string) => speakerTone(speakers, id), [speakers]);
  const silences = useMemo(() => findSilences(segments, duration, silenceMin), [segments, duration, silenceMin]);
  const silenceBefore = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of silences) {
      const index = segments.findIndex((seg) => Math.abs(seg.start - s.end) < 0.001);
      if (index >= 0) map.set(index, s.seconds);
    }
    return map;
  }, [silences, segments]);
  const pins = useMemo(() => (showAnnotations ? annotationPins(segments) : []), [segments, showAnnotations]);
  const shares = useMemo(() => talkShare(segments, speakers), [segments, speakers]);
  const stats = useMemo(() => annotationStats(segments), [segments]);
  const matches = useMemo(() => searchTranscript(segments, query), [segments, query]);
  const current = segmentIndexAt(segments, time);
  const focusSet = useMemo(() => new Set(focus?.speakers ?? []), [focus]);

  // ---- playback
  const seek = useCallback(
    (seconds: number) => {
      const next = clampTime(seconds, duration || seconds);
      setTime(next);
      setStarted(true);
      setUserScrolled(false);
      const el = audio.current;
      if (el && !failed) el.currentTime = next;
      onTimeChange?.(next);
    },
    [duration, failed, onTimeChange],
  );
  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el || failed) return;
    if (el.paused) {
      claim(el);
      el.playbackRate = rate;
      el.play().catch(() => setPlaying(false));
    } else el.pause();
  }, [failed, rate]);
  const onAudioTime = (t: number) => {
    let next = t;
    if (skip) next = skipSilenceAt(next, silences);
    if (focusOn && focusSet.size) {
      const target = nextFocusTime(segments, next, focusSet);
      if (target === null) {
        audio.current?.pause();
        return;
      }
      next = target;
    }
    if (next !== t && audio.current) audio.current.currentTime = next;
    setTime(next);
    onTimeChange?.(next);
  };
  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate]);
  useEffect(() => {
    setFailed(false);
    setLoaded(null);
  }, [src]);

  // ---- follow playback: keep the current row in view inside the list (never scroll the page)
  useEffect(() => {
    if (!follow || userScrolled || current < 0) return;
    const box = list.current;
    const row = box?.querySelector<HTMLElement>(`[data-row="${current}"]`);
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    const target = Math.max(0, top - box.clientHeight / 3);
    if (Math.abs(box.scrollTop - target) < 4) return;
    ignoreScrollUntil.current = Date.now() + IGNORE_SCROLL_MS;
    const smooth = typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
  }, [current, follow, userScrolled]);
  useEffect(() => {
    const box = list.current;
    if (!box) return;
    const byUser = () => setUserScrolled(true);
    const onScroll = () => {
      if (Date.now() > ignoreScrollUntil.current) setUserScrolled(true);
    };
    box.addEventListener("wheel", byUser, { passive: true });
    box.addEventListener("touchmove", byUser, { passive: true });
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      box.removeEventListener("wheel", byUser);
      box.removeEventListener("touchmove", byUser);
      box.removeEventListener("scroll", onScroll);
    };
  }, []);

  // ---- search: jump the list to the active hit (does not move playback)
  useEffect(() => setActiveMatch(0), [query]);
  useEffect(() => {
    const hit = matches[activeMatch];
    const box = list.current;
    if (!hit || !box) return;
    const index = segments.findIndex((s) => s.id === hit.segmentId);
    const row = box.querySelector<HTMLElement>(`[data-row="${index}"]`);
    if (!row) return;
    setUserScrolled(true);
    ignoreScrollUntil.current = Date.now() + IGNORE_SCROLL_MS;
    box.scrollTo({ top: Math.max(0, row.offsetTop - box.offsetTop - box.clientHeight / 3) });
  }, [activeMatch, matches, segments]);
  const stepMatch = (dir: 1 | -1) => matches.length && setActiveMatch((i) => (i + dir + matches.length) % matches.length);
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      stepMatch(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  };
  const onRootKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== " " || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, button, [role=slider], [role=switch], [role=checkbox], a, select")) return;
    event.preventDefault();
    toggle();
  };

  const toggles = [
    { key: "skip", label: "跳过静音", checked: skip, onChange: setSkip, hint: `跳过 ${silenceMin} 秒以上没人说话的地方` },
    ...(focus?.speakers.length ? [{ key: "focus", label: focus.label, checked: focusOn, onChange: setFocusOn }] : []),
    { key: "follow", label: "跟着滚动", hint: "文字跟着播放滚动", checked: follow, onChange: (v: boolean) => { setFollow(v); setUserScrolled(false); } },
  ];

  const search = <SearchBox query={query} setQuery={setQuery} onKey={onSearchKey} count={matches.length} active={activeMatch} step={stepMatch} />;
  const exportMenu = (
    <ExportMenu formats={exportFormats} onExport={onExport} hasAnnotations={countAnnotations(segments) > 0} note={exportNote}
      copyText={(o) => transcriptText(segments, speakers, { ...o, categories })} onCopy={onCopy} />
  );

  return (
    <div className={cn("aui-transcript", className)} role="region" aria-label={label} onKeyDown={onRootKey}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setLoaded(d);
          if (time > 0) e.currentTarget.currentTime = time;
        }}
        onTimeUpdate={(e) => onAudioTime(e.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          setUserScrolled(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (src) setFailed(true);
          setPlaying(false);
        }}
      />
      {(title || meta || actions) && (
        <div className="aui-tx-header">
          <span className="aui-tx-icon" aria-hidden="true"><AudioLines /></span>
          <div className="aui-tx-title">
            {title && <h2>{title}</h2>}
            {meta && <small>{meta}</small>}
          </div>
          <div className="aui-tx-header-actions">
            {search}
            {exportMenu}
            {actions}
          </div>
        </div>
      )}
      <div className="aui-tx-player">
        <TranscriptLegend speakers={speakers} toneOf={toneOf} shares={shares} annotationCount={countAnnotations(segments)} annotationsLabel={annotationsLabel} showAnnotations={showAnnotations} onShowAnnotations={setShowAnnotations} />
        <TranscriptWave duration={duration} time={time} peaks={peaks} segments={segments} pins={pins} categories={categoryMap} toneOf={toneOf} started={started} currentSegment={segments[current]?.id} onSeek={seek} label={typeof title === "string" ? title : label} />
        <TranscriptControls
          playing={playing}
          time={time}
          duration={duration}
          rate={rate}
          speeds={speeds}
          failed={failed || !src}
          onToggle={toggle}
          onSkip={(d) => seek(time + d)}
          onRate={setRate}
          toggles={toggles}
          extra={!(title || meta || actions) ? <>{search}{exportMenu}</> : undefined}
        />
      </div>
      <div className="aui-tx-main">
        <div className="aui-tx-text">
          <TranscriptList
            ref={list}
            segments={segments}
            speakers={speakerMap}
            categories={categoryMap}
            toneOf={toneOf}
            current={current}
            playing={playing}
            showAnnotations={showAnnotations}
            silenceBefore={silenceBefore}
            skipSilence={skip}
            matches={matches}
            activeMatch={activeMatch}
            onSeek={(t) => seek(t)}
            onReveal={onReveal}
            remaskAfter={remaskAfter}
            label="文字稿"
          />
          {follow && userScrolled && current >= 0 && (
            <Button variant="outline" size="sm" className="aui-tx-back" onClick={() => setUserScrolled(false)}>
              <LocateFixed />
              回到正在播放
            </Button>
          )}
        </div>
        <aside className="aui-tx-side" aria-label="摘要与说话占比">
          {summary && (
            <section className="aui-tx-section" aria-label={summaryTitle}>
              <div className="aui-tx-card-head"><b>{summaryTitle}</b>{summaryAction}</div>
              <div className="aui-tx-summary">{typeof summary === "function" ? summary({ seek }) : <SummaryBody summary={summary} seek={seek} />}</div>
            </section>
          )}
          <section className="aui-tx-section" aria-label="说话占比">
            <div className="aui-tx-card-head"><b>说话占比</b></div>
            <TalkShareBar shares={shares} speakers={speakerMap} toneOf={toneOf} />
          </section>
          {showAnnotations && stats.length > 0 && (
            <section className="aui-tx-section" aria-label="标注">
              <div className="aui-tx-card-head"><b>标注</b></div>
              <AnnotationStats stats={stats} categories={categoryMap} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
