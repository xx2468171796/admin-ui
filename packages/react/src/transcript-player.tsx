"use client";
/**
 * TranscriptViewer's player block (review 07 item 7): speaker legend (colour · name · role ·
 * share) + annotation switch, a speaker-coloured waveform (unplayed 35% faded, played full, silence in the
 * line colour) with AI annotation pins above it (small dots; the name shows on hover / for the current
 * sentence), the axis, and ONE controls row: back 15 · play 40 · forward 15 · time · speed segmented, the
 * switches small on the right (in a 「⋯」 menu on phones). State lives in TranscriptViewer.
 */
import { useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { FastForward, Pause, Play, Rewind, Sparkles } from "lucide-react";
import { Switch } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { useIsMobile } from "./media-query.ts";
import { AudioWaveform, useElementWidth } from "./media-audio.tsx";
import { barCountFor, downsamplePeaks, formatDuration, formatSpeed } from "./media-core.ts";
import { barSpeakers, speakerColors, timeTicks, type TalkShare, type TranscriptCategory, type TranscriptPin, type TranscriptSegment, type TranscriptSpeaker } from "./transcript-core.ts";
import type { OptionHue } from "./option-palette.ts";
import { MoreMenu } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";

export const SKIP_SECONDS = 15;
const SEEK_KEY_STEP = 5;
type Tone = (speaker: string) => OptionHue;

/** Inline CSS variables of a speaker colour: `--aui-tx-c` (bars, dots), `--aui-tx-soft` / `--aui-tx-text` (avatar). */
export function speakerStyle(hue: OptionHue): CSSProperties {
  const c = speakerColors(hue);
  return { "--aui-tx-c": c.color, "--aui-tx-soft": c.soft, "--aui-tx-text": c.text } as CSSProperties;
}

export type TranscriptWaveProps = {
  duration: number;
  time: number;
  peaks?: readonly number[];
  segments: readonly TranscriptSegment[];
  pins: readonly TranscriptPin[];
  categories: ReadonlyMap<string, TranscriptCategory>;
  toneOf: Tone;
  started: boolean;
  /** Id of the segment playing now (its pins show their name). */
  currentSegment?: string;
  onSeek: (time: number) => void;
  label: string;
};

/** Pins + waveform (a slider) + axis. */
export function TranscriptWave({ duration, time, peaks, segments, pins, categories, toneOf, started, currentSegment, onSeek, label }: TranscriptWaveProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const dragging = useRef(false);
  const count = barCountFor(width, 3, 2);
  const bars = useMemo(() => (peaks?.length ? downsamplePeaks(peaks, count) : Array.from({ length: count }, () => 0.35)), [peaks, count]);
  const who = useMemo(() => barSpeakers(segments, bars.length, duration), [segments, bars.length, duration]);
  const colors = useMemo(() => who.map((s) => (s ? speakerColors(toneOf(s)).color : null)), [who, toneOf]);
  // Silence (nobody speaking) is a flat line in the line colour.
  const levels = useMemo(() => bars.map((v, i) => (who[i] ? v : 0)), [bars, who]);
  const ticks = useMemo(() => timeTicks(duration), [duration]);
  const progress = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width > 0) onSeek(((event.clientX - box.left) / box.width) * duration);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowLeft: time - SEEK_KEY_STEP, ArrowDown: time - SEEK_KEY_STEP, ArrowRight: time + SEEK_KEY_STEP, ArrowUp: time + SEEK_KEY_STEP, PageDown: time - 60, PageUp: time + 60, Home: 0, End: duration };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSeek(next);
  };
  return (
    <div className="aui-tx-wave">
      <div className="aui-tx-pins">
        {pins.map((pin) => {
          const cat = categories.get(pin.category);
          const name = cat?.label ?? pin.category;
          return (
            <button
              key={pin.id}
              type="button"
              className="aui-tx-pin"
              data-current={pin.segmentId === currentSegment || undefined}
              style={{ left: `${duration > 0 ? (pin.time / duration) * 100 : 0}%` }}
              aria-label={`${name}，跳到 ${formatDuration(pin.time)}`}
              onClick={() => onSeek(pin.time)}
            >
              <span className="aui-tx-pin-name" aria-hidden="true">{name}</span>
              <i aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div
        ref={ref}
        className="aui-tx-track"
        role="slider"
        tabIndex={0}
        aria-label={`${label} 播放进度`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatDuration(time)} / ${formatDuration(duration)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromPointer(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <AudioWaveform values={levels} progress={progress} colors={colors} />
        {started && <span className="aui-tx-head" style={{ left: `${progress * 100}%` }} aria-hidden="true" />}
      </div>
      <div className="aui-tx-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.time}>{t.label}</span>
        ))}
      </div>
    </div>
  );
}

export type TranscriptLegendProps = {
  speakers: readonly TranscriptSpeaker[];
  toneOf: Tone;
  shares?: readonly TalkShare[];
  annotationCount: number;
  annotationsLabel: string;
  showAnnotations: boolean;
  onShowAnnotations: (next: boolean) => void;
};
/** 「■ 小王 销售 47%  ■ 李先生 客户 29% …」 + 「AI 标注 11 处」 switch. */
export function TranscriptLegend({ speakers, toneOf, shares = [], annotationCount, annotationsLabel, showAnnotations, onShowAnnotations }: TranscriptLegendProps) {
  const percent = new Map(shares.map((s) => [s.speaker, s.percent]));
  return (
    <div className="aui-tx-legend">
      <span className="aui-tx-speakers" aria-label="说话人">
        {speakers.map((s) => (
          <span key={s.id} className="aui-tx-speaker" data-tone={toneOf(s.id)} style={speakerStyle(toneOf(s.id))}>
            <i aria-hidden="true" />
            {s.name}
            {s.role && <small>{s.role}</small>}
            {percent.has(s.id) && <u>{percent.get(s.id)}%</u>}
          </span>
        ))}
      </span>
      {annotationCount > 0 && (
        <label className="aui-tx-ai">
          <Sparkles aria-hidden="true" />
          <span className="aui-tx-ai-badge">{annotationsLabel} {annotationCount} 处</span>
          <Switch size="sm" checked={showAnnotations} onCheckedChange={onShowAnnotations} aria-label={`显示${annotationsLabel}`} />
        </label>
      )}
    </div>
  );
}

export type TranscriptToggle = { key: string; label: string; checked: boolean; onChange: (next: boolean) => void; hint?: string };
export type TranscriptControlsProps = {
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  speeds: readonly number[];
  failed: boolean;
  onToggle: () => void;
  onSkip: (delta: number) => void;
  onRate: (rate: number) => void;
  /** Small switches on the right (跳过静音 …); a 「⋯」 menu on phones. */
  toggles: readonly TranscriptToggle[];
  extra?: ReactNode;
};
/** One row: −15 / play / +15, time, speed · switches. */
export function TranscriptControls({ playing, time, duration, rate, speeds, failed, onToggle, onSkip, onRate, toggles, extra }: TranscriptControlsProps) {
  const Icon = playing ? Pause : Play;
  const phone = useIsMobile();
  return (
    <div className="aui-tx-controls">
      <span className="aui-tx-transport">
        <button type="button" className="aui-tx-skip" aria-label={`后退 ${SKIP_SECONDS} 秒`} data-tip={`后退 ${SKIP_SECONDS} 秒`} onClick={() => onSkip(-SKIP_SECONDS)}>
          <Rewind aria-hidden="true" />
        </button>
        <button type="button" className="aui-tx-play" aria-label={playing ? "暂停（空格）" : "播放（空格）"} disabled={failed} onClick={onToggle}>
          <Icon aria-hidden="true" />
        </button>
        <button type="button" className="aui-tx-skip" aria-label={`前进 ${SKIP_SECONDS} 秒`} data-tip={`前进 ${SKIP_SECONDS} 秒`} onClick={() => onSkip(SKIP_SECONDS)}>
          <FastForward aria-hidden="true" />
        </button>
        <span className="aui-tx-time" aria-live="off">
          <b>{formatDuration(time)}</b> / {formatDuration(duration)}
        </span>
        <SegmentedControl size="sm" label="倍速" value={String(rate)} options={speeds.map((s) => ({ value: String(s), label: formatSpeed(s) }))} onValueChange={(v) => onRate(Number(v))} />
        {failed && <small className="aui-tx-failed">录音无法播放，仍可看文字稿</small>}
      </span>
      <span className="aui-tx-toggles">
        {phone ? (
          <MoreMenu
            label="播放设置"
            className="aui-tx-more"
            sections={[{ items: toggles.map((t) => ({ key: t.key, label: t.label, hint: t.hint, checked: t.checked, onSelect: () => t.onChange(!t.checked) })) }]} />
        ) : (
          toggles.map((t) => (
            <label key={t.key} className="aui-tx-toggle" data-tip={t.hint}>
              <Switch size="sm" checked={t.checked} onCheckedChange={t.onChange} />
              {t.label}
            </label>
          ))
        )}
        {extra}
      </span>
    </div>
  );
}
