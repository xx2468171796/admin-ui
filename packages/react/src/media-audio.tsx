"use client";
/**
 * AudioPlayer: plays an audio file in place (table cell, record detail, attachment drawer). Play / pause,
 * a seek bar that is the waveform when the host supplies `peaks` (plain progress bar otherwise), time,
 * speed cycle (0.75–2x), optional download and an action slot (「转文字」). `variant="mini"` fits a 32px
 * grid cell: play button + small progress + time. One player plays at a time on the page.
 * AudioWaveform is the bar renderer shared with AudioRecorder. Styles: styles/media.css.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Download, Pause, Play } from "lucide-react";
import { cn } from "./primitives.tsx";
import { barCountFor, clampTime, DEFAULT_SPEEDS, downsamplePeaks, formatDuration, formatSpeed, nextSpeed } from "./media-core.ts";
import { IconButton } from "./buttons.tsx";
import { mediaFailureText, type MediaRecover } from "./media-source-core.ts";
import { useMediaSource } from "./media-source-hook.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";

// ---------------------------------------------------------------- width hook

/** Content width of an element, kept current with ResizeObserver (0 before layout). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// ---------------------------------------------------------------- waveform

export type AudioWaveformProps = {
  /** Levels 0..1, one per bar (already downsampled to the bar count). */
  values: readonly number[];
  /** 0..1: bars before this are drawn as played. */
  progress?: number;
  /** `record` = recording red (the one allowed danger-colour exception, DESIGN.md §1). */
  tone?: "brand" | "record";
  /** Draw a playhead line at `progress`. */
  playhead?: boolean;
  /** Per-bar colour (CSS colour, e.g. a speaker's VIZ_CATEGORICAL slot) exposed as `--aui-wave-c` (bt/builders-b, TranscriptViewer). */
  colors?: readonly (string | null | undefined)[];
  className?: string;
};

/** Bars only; the parent decides the size. Decorative (aria-hidden): the slider around it carries the value. */
export function AudioWaveform({ values, progress = 0, tone = "brand", playhead, colors, className }: AudioWaveformProps) {
  const played = Math.round(Math.max(0, Math.min(1, progress)) * values.length);
  return (
    <span className={cn("aui-wave", className)} data-tone={tone} aria-hidden="true">
      {values.map((v, i) => (
        <i key={i} data-played={i < played || undefined} data-c={colors?.[i] ? "" : undefined} style={colors?.[i] ? ({ height: `${Math.max(12, Math.round(v * 100))}%`, "--aui-wave-c": colors[i] } as CSSProperties) : { height: `${Math.max(12, Math.round(v * 100))}%` }} />
      ))}
      {playhead && <b className="aui-wave-head" style={{ left: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />}
    </span>
  );
}

// ---------------------------------------------------------------- player

let current: HTMLAudioElement | null = null;
/** Pause whatever else is playing: one sound at a time across all players in the page (also TranscriptViewer). */
export function claim(audio: HTMLAudioElement) {
  if (current && current !== audio && !current.paused) current.pause();
  current = audio;
}

export type AudioPlayerProps = {
  src: string;
  /** File name / title; also names the controls for screen readers. */
  title: string;
  /** Second line: who recorded it, where (「小王 · 通话录音」). Not shown in the mini variant. */
  subtitle?: ReactNode;
  /** Known length in seconds (shown before the file's metadata loads). */
  duration?: number;
  /** Host-computed amplitude peaks (any length; downsampled to fit). Absent → plain progress bar. */
  peaks?: readonly number[];
  /** Speed cycle; default 0.75 / 1 / 1.25 / 1.5 / 2. */
  speeds?: readonly number[];
  /** Download the original; shows a download icon button. */
  onDownload?: () => void;
  /** Extra controls after the speed chip, e.g. a 「转文字」 button (disabled with a reason until available). */
  action?: ReactNode;
  /** `full` (row, 56px) or `mini` (fits a 32px grid cell). */
  variant?: "full" | "mini";
  /** Extra text after the time in the mini variant (「+2」 more recordings). */
  miniExtra?: ReactNode;
  onPlay?: () => void;
  onEnded?: () => void;
  /** The file stopped loading (expired presigned link …): return a fresh link and playback resumes there (8.0.1). */
  onMediaError?: MediaRecover;
  className?: string;
};

const SEEK_STEP = 5;

export function AudioPlayer({ src, title, subtitle, duration: knownDuration, peaks, speeds = DEFAULT_SPEEDS, onDownload, action, variant = "full", miniExtra, onPlay, onEnded, onMediaError, className }: AudioPlayerProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const media = useMediaSource(src, onMediaError);
  const failed = media.failure !== null;
  const [started, setStarted] = useState(false);
  const [trackRef, trackWidth] = useElementWidth<HTMLDivElement>();
  const dragging = useRef(false);
  const mini = variant === "mini";
  const duration = loaded ?? knownDuration ?? 0;
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const bars = peaks?.length ? downsamplePeaks(peaks, barCountFor(trackWidth, mini ? 2 : 3, mini ? 1.5 : 2)) : [];

  useEffect(() => () => {
    const el = audio.current;
    if (el && current === el) current = null;
  }, []);
  useEffect(() => {
    setTime(0);
    setLoaded(null);
    setStarted(false);
  }, [src]);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el || failed) return;
    if (el.paused) {
      claim(el);
      el.playbackRate = rate;
      el.play().catch(() => setPlaying(false));
    } else el.pause();
  }, [failed, rate]);

  const seekTo = (seconds: number) => {
    const el = audio.current;
    if (!el || !duration) return;
    const next = clampTime(seconds, duration);
    el.currentTime = next;
    setTime(next);
    setStarted(true);
  };
  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    seekTo(((event.clientX - box.left) / box.width) * duration);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => seekTo(time - SEEK_STEP),
      ArrowDown: () => seekTo(time - SEEK_STEP),
      ArrowRight: () => seekTo(time + SEEK_STEP),
      ArrowUp: () => seekTo(time + SEEK_STEP),
      Home: () => seekTo(0),
      End: () => seekTo(duration),
      " ": toggle,
      Enter: toggle,
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  };
  const changeRate = () => {
    const next = nextSpeed(rate, speeds);
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const timeText = started || playing ? `${formatDuration(time)} / ${formatDuration(duration || null)}` : formatDuration(duration || null);
  const PlayIcon = playing ? Pause : Play;
  return (
    <div className={cn("aui-audio", className)} data-variant={variant} data-playing={playing || undefined} data-failed={failed || undefined}>
      <audio
        ref={audio}
        src={media.src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setLoaded(d);
          media.events.onLoadedMetadata(e);
        }}
        onLoadedData={media.events.onLoadedData}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setLoaded(d);
        }}
        onTimeUpdate={(e) => {
          if (!dragging.current) setTime(e.currentTarget.currentTime);
        }}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          media.events.onPlay();
          onPlay?.();
        }}
        onPause={() => {
          setPlaying(false);
          media.events.onPause();
        }}
        onEnded={() => {
          setPlaying(false);
          media.events.onEnded();
          onEnded?.();
        }}
        onError={(e) => {
          media.events.onError(e);
          setPlaying(false);
        }}
      />
      <button type="button" className="aui-audio-play" aria-label={`${playing ? "暂停" : "播放"} ${title}`} disabled={failed} onClick={toggle}>
        <PlayIcon aria-hidden="true" />
      </button>
      {!mini && (
        <span className="aui-audio-name">
          <b data-tip={title}>{title}</b>
          {media.failure ? <small className="aui-audio-error">{media.failure === "network" ? "无法播放这个文件" : mediaFailureText(media.failure, "audio")}</small> : subtitle && <small>{subtitle}</small>}
        </span>
      )}
      <div
        ref={trackRef}
        className="aui-audio-track"
        data-wave={bars.length ? true : undefined}
        role="slider"
        tabIndex={failed ? -1 : 0}
        aria-label={`${title} 播放进度`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatDuration(time)} / ${formatDuration(duration || null)}`}
        aria-disabled={failed || undefined}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (failed || e.button !== 0) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          seekFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) seekFromPointer(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {bars.length ? (
          <AudioWaveform values={bars} progress={progress} playhead={!mini && (started || playing)} />
        ) : (
          <span className="aui-audio-bar" aria-hidden="true">
            <i style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </div>
      <span className="aui-audio-time">{timeText}</span>
      {mini && miniExtra && <span className="aui-audio-extra">{miniExtra}</span>}
      {!mini && (
        <>
          <button type="button" className="aui-audio-speed" aria-label={`播放速度 ${formatSpeed(rate)}，点击切换`} disabled={failed} onClick={changeRate}>
            {formatSpeed(rate)}
          </button>
          {action}
          {onDownload && (
            <IconButton label={`下载 ${title}`} size="sm" onClick={onDownload} icon={<Download />} />
          )}
        </>
      )}
    </div>
  );
}
