"use client";
/**
 * TranscriptViewer's text list (bt/builders-b A1, D27t): one row per segment — clickable timestamp,
 * speaker avatar in the speaker's colour + name + role (continuation rows of the same speaker drop them),
 * the text with AI-tagged phrases (soft brand chip), masked values grey + monospace with an eye (audited reveal),
 * search hits marked, 「正在播放」 on the current row, and 「静默 12 秒」 dividers between rows.
 */
import { forwardRef, type ReactNode } from "react";
import { Eye, EyeOff, Lock, Volume2 } from "lucide-react";
import { useSensitiveReveal } from "./displays.tsx";
import { formatDuration } from "./media-core.ts";
import { speakerStyle } from "./transcript-player.tsx";
import type { OptionHue } from "./option-palette.ts";
import { silenceLabel, splitSegmentText, type TranscriptCategory, type TranscriptMask, type TranscriptMatch, type TranscriptSegment, type TranscriptSpeaker } from "./transcript-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";

export type TranscriptRevealer = (segment: TranscriptSegment, mask: TranscriptMask) => Promise<string>;

type ListProps = {
  segments: readonly TranscriptSegment[];
  speakers: ReadonlyMap<string, TranscriptSpeaker>;
  categories: ReadonlyMap<string, TranscriptCategory>;
  toneOf: (speaker: string) => OptionHue;
  current: number;
  playing: boolean;
  showAnnotations: boolean;
  /** Divider before segment i (seconds of silence). */
  silenceBefore: ReadonlyMap<number, number>;
  skipSilence: boolean;
  matches: readonly TranscriptMatch[];
  activeMatch: number;
  onSeek: (time: number, index: number) => void;
  onReveal?: TranscriptRevealer;
  remaskAfter?: number;
  label: string;
  children?: ReactNode;
};

/** Text with search hits wrapped in <mark> (the active hit gets data-active). */
function marked(text: string, offset: number, hits: readonly (TranscriptMatch & { active: boolean })[]): ReactNode {
  const local = hits.filter((h) => h.start < offset + text.length && h.end > offset);
  if (!local.length) return text;
  const out: ReactNode[] = [];
  let cursor = 0;
  local.forEach((h, i) => {
    const from = Math.max(0, h.start - offset);
    const to = Math.min(text.length, h.end - offset);
    if (from > cursor) out.push(text.slice(cursor, from));
    out.push(<mark key={i} className="aui-tx-hit" data-active={h.active || undefined}>{text.slice(from, to)}</mark>);
    cursor = to;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function MaskChip({ text, mask, segment, onReveal, remaskAfter }: { text: string; mask: TranscriptMask; segment: TranscriptSegment; onReveal?: TranscriptRevealer; remaskAfter?: number }) {
  const state = useSensitiveReveal({ reveal: onReveal ? () => onReveal(segment, mask) : undefined, remaskAfter: remaskAfter ?? 30_000 });
  const what = mask.label ?? "敏感信息";
  const Mark = !onReveal ? Lock : state.shown ? EyeOff : Eye;
  const body = (
    <>
      <span className="aui-tx-mask-text">{state.value ?? text}</span>
      {state.shown && <small>{state.secondsLeft !== null ? `${state.secondsLeft} 秒后隐藏` : "已显示"}</small>}
      <Mark aria-hidden="true" />
    </>
  );
  return (
    <span className="aui-tx-mask-wrap">
      {onReveal ? (
        <button type="button" className="aui-tx-mask" data-shown={state.shown || undefined} aria-pressed={state.shown} disabled={state.busy} data-tip={state.shown ? "隐藏" : "查看原文（会被记录）"} aria-label={state.shown ? `隐藏${what}` : `查看${what}原文，查看会被记录`} onClick={() => void state.toggle()}>
          {body}
        </button>
      ) : (
        <span className="aui-tx-mask" data-tip={`${what}已自动打码`}>{body}</span>
      )}
      {state.error && <span role="alert" className="aui-tx-mask-error">{state.error}</span>}
    </span>
  );
}

/** The scrollable list; `ref` is the scroll box (follow-playback scrolls it, never the page). */
export const TranscriptList = /* @__PURE__ */ forwardRef<HTMLDivElement, ListProps>(function TranscriptList(props, ref) {
  const { segments, speakers, categories, toneOf, current, playing, showAnnotations, silenceBefore, skipSilence, matches, activeMatch, onSeek, onReveal, remaskAfter, label, children } = props;
  const active = matches[activeMatch];
  return (
    <div ref={ref} className="aui-tx-list" role="list" aria-label={label} tabIndex={-1}>
      {segments.map((seg, i) => {
        const speaker = speakers.get(seg.speaker);
        const gap = silenceBefore.get(i);
        const prev = segments[i - 1];
        const cont = Boolean(prev && prev.speaker === seg.speaker && gap === undefined && i !== current);
        const on = i === current;
        const hits = matches.filter((m) => m.segmentId === seg.id).map((m) => ({ ...m, active: m === active }));
        const name = speaker?.name ?? seg.speaker;
        return (
          <div key={seg.id} role="listitem" className="aui-tx-item">
            {gap !== undefined && <div className="aui-tx-gap" role="separator">{silenceLabel(gap, skipSilence)}</div>}
            <div className="aui-tx-row" data-row={i} data-current={on || undefined} data-cont={cont || undefined} data-tone={toneOf(seg.speaker)} style={speakerStyle(toneOf(seg.speaker))}>
              <button type="button" className="aui-tx-stamp" aria-label={`跳到 ${formatDuration(seg.start)}（${name}）`} data-tip={`点一下，录音跳到 ${formatDuration(seg.start)}`} onClick={() => onSeek(seg.start, i)}>
                {formatDuration(seg.start)}
              </button>
              {cont ? <span className="aui-tx-avatar-gap" /> : <span className="aui-tx-avatar" aria-hidden="true">{speaker?.initial ?? name.slice(0, 1)}</span>}
              <div className="aui-tx-body">
                {!cont && (
                  <div className="aui-tx-who">
                    <b>{name}</b>
                    {speaker?.role && <small>{speaker.role}</small>}
                    {on && (
                      <span className="aui-tx-now">
                        <Volume2 aria-hidden="true" />
                        {playing ? "正在播放" : "播放到这里"}
                      </span>
                    )}
                  </div>
                )}
                <p>
                  {splitSegmentText(seg.text, seg.spans).map((part) => {
                    if (part.kind === "text") return <span key={part.start}>{marked(part.text, part.start, hits)}</span>;
                    if (part.kind === "mask")
                      return <MaskChip key={part.start} text={part.text} mask={{ kind: "mask", start: part.start, end: part.start + part.text.length, label: part.label }} segment={seg} onReveal={onReveal} remaskAfter={remaskAfter} />;
                    const cat = categories.get(part.category);
                    if (!showAnnotations) return <span key={part.start}>{marked(part.text, part.start, hits)}</span>;
                    return (
                      <span key={part.start} className="aui-tx-phrase">
                        <span className="aui-tx-hl" data-tone={cat?.tone ?? "green"}>{marked(part.text, part.start, hits)}</span>
                        <span className="aui-chip aui-tx-tag" data-tone={cat?.tone ?? "green"}>{cat?.label ?? part.category}</span>
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      {children}
    </div>
  );
});
