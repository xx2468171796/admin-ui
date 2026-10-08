"use client";
/**
 * AudioRecorder: record a voice note in place — big timer, live level waveform, pause / resume, cancel,
 * 「结束并保存」 → Blob callback; permission-denied and unsupported states with what to do. HoldToTalk:
 * press and hold to record, release to send, slide up to cancel (Space / Enter hold on keyboard, Esc
 * cancels); touch size ≥ 44px. Recording red (--aui-record*) only marks recording itself — the record
 * button, the dot + status text and the live waveform; errors use danger, everything
 * else stays neutral. Styles: styles/media.css.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Pause, Play, RotateCcw, Square, Upload, X } from "lucide-react";
import { Button, cn } from "./primitives.tsx";
import { useAdminTheme } from "./theme.tsx";
import { AudioPlayer, AudioWaveform, useElementWidth } from "./media-audio.tsx";
import { barCountFor, formatBytes, formatDuration, holdGesture, HOLD_CANCEL_DISTANCE } from "./media-core.ts";
import { useAudioRecorder, type RecordingResult } from "./media-recorder-hook.ts";
import { recorderProblem, type RecorderFailure, type RecorderProblemState } from "./media-recorder-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";

/** Live waveform: recorded levels in recording red from the left, a neutral dotted line for the rest. */
function LiveWave({ levels, active }: { levels: readonly number[]; active: boolean }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const count = barCountFor(width, 3, 2);
  const shown = count ? levels.slice(-Math.max(1, Math.floor(count * 0.86))) : [];
  return (
    <div ref={ref} className="aui-rec-wave" data-active={active || undefined} aria-hidden="true">
      {count > 0 && <AudioWaveform values={shown} progress={1} tone="record" />}
      <span className="aui-rec-rest" style={{ left: `${count ? (shown.length / count) * 100 : 0}%` }} />
    </div>
  );
}

const secureContext = () => (typeof window === "undefined" ? undefined : window.isSecureContext);

/**
 * Why the mic can't open, in words people can act on (media-recorder-core): numbered steps, 「再试一次」 (when it
 * can help) and 「改成上传录音文件」 (`onUpload`); the browser's own English reason only as the last small line.
 */
function RecorderProblem({ state, failure, onRetry, onUpload, fallback }: { state: RecorderProblemState; failure: RecorderFailure; onRetry: () => void; onUpload?: () => void; fallback?: ReactNode }) {
  const problem = recorderProblem(state, failure, { secure: secureContext() });
  return (
    <div className="aui-rec-problem" role="alert">
      <span className="aui-rec-problem-icon" aria-hidden="true"><MicOff /></span>
      <div className="aui-rec-problem-body">
        <b>{problem.title}</b>
        <ol className="aui-rec-problem-steps">
          {problem.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <span className="aui-rec-problem-actions">
          {problem.retry && (
            <Button size="sm" onClick={onRetry}>
              <RotateCcw />
              再试一次
            </Button>
          )}
          {onUpload && (
            <Button variant="outline" size="sm" onClick={onUpload}>
              <Upload />
              改成上传录音文件
            </Button>
          )}
          {fallback}
        </span>
        {problem.detail && <small className="aui-rec-problem-detail">浏览器原因：{problem.detail}</small>}
      </div>
    </div>
  );
}

export type AudioRecorderProps = {
  /** Finished recording (「结束并保存」 or max duration reached). */
  onDone: (result: RecordingResult) => void;
  /** User threw the recording away (✕). */
  onCancel?: () => void;
  /** Context after 「正在录音 ·」: 「上门谈话」. */
  title?: ReactNode;
  /** Small lines under the waveform (「锁屏或切到别的 App 也会继续录」 — only what the host really does). */
  notes?: ReactNode;
  /** A third round button on the right while recording (e.g. 拍照); default is 取消. */
  extra?: ReactNode;
  /** 「改成上传录音文件」 in the mic-unavailable state (the host opens its file picker / upload queue). */
  onUpload?: () => void;
  /** Extra content next to 「再试一次」 / 「改成上传录音文件」 in the mic-unavailable state. */
  fallback?: ReactNode;
  maxDuration?: number;
  mimeType?: string;
  /** Start as soon as it mounts (the user just pressed a 「录音」 button elsewhere). */
  autoStart?: boolean;
  /** Show the recorded size (「已存 21.6 MB」). Default true. */
  showSize?: boolean;
  className?: string;
};

export function AudioRecorder({ onDone, onCancel, title, notes, extra, onUpload, fallback, maxDuration, mimeType, autoStart, showSize = true, className }: AudioRecorderProps) {
  const rec = useAudioRecorder({ onDone, maxDuration, mimeType });
  // Start on mount without a once-only flag: a StrictMode remount cancels the first request (the hook
  // drops a mic granted after unmount), so the second mount has to ask again. start() ignores repeats.
  const startRef = useRef(rec.start);
  startRef.current = rec.start;
  useEffect(() => {
    if (autoStart) void startRef.current();
  }, [autoStart]);
  const { state } = rec;
  if (state === "denied" || state === "unsupported" || state === "error")
    return (
      <div className={cn("aui-recorder", className)} data-state={state}>
        <RecorderProblem state={state} failure={rec.failure} onRetry={() => void rec.start()} onUpload={onUpload} fallback={fallback} />
      </div>
    );
  if (state === "done" && rec.result)
    return (
      <div className={cn("aui-recorder", className)} data-state="done">
        <AudioPlayer src={rec.result.url} title="刚录的音频" subtitle={`${formatDuration(rec.result.duration)} · ${formatBytes(rec.result.blob.size)}`} duration={rec.result.duration} peaks={rec.result.peaks} />
        <span className="aui-rec-done-actions">
          <Button variant="outline" size="sm" onClick={() => void rec.start()}>
            <Mic />
            重新录音
          </Button>
        </span>
      </div>
    );
  const live = state === "recording" || state === "paused";
  const cancel = () => {
    rec.cancel();
    onCancel?.();
  };
  return (
    <div className={cn("aui-recorder", className)} data-state={state}>
      <div className="aui-rec-head">
        <span className="aui-rec-status" role="status">
          {live && <i className="aui-rec-dot" aria-hidden="true" />}
          {state === "recording" ? "正在录音" : state === "paused" ? "已暂停" : state === "requesting" ? "正在打开麦克风…" : "准备录音"}
          {title && <> · {title}</>}
        </span>
        {showSize && live && rec.bytes > 0 && <span className="aui-rec-size">已存 {formatBytes(rec.bytes)}</span>}
      </div>
      <div className="aui-rec-timer" aria-label={`已录 ${formatDuration(rec.elapsed)}`}>
        {formatDuration(rec.elapsed)}
      </div>
      <LiveWave levels={rec.levels} active={state === "recording"} />
      {notes && <div className="aui-rec-notes">{notes}</div>}
      <div className="aui-rec-controls">
        {live ? (
          <>
            <span className="aui-rec-side">
              <button type="button" className="aui-rec-round" onClick={state === "paused" ? rec.resume : rec.pause} aria-label={state === "paused" ? "继续录音" : "暂停录音"}>
                {state === "paused" ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              </button>
              <small aria-hidden="true">{state === "paused" ? "继续" : "暂停"}</small>
            </span>
            <span className="aui-rec-main">
              <button type="button" className="aui-rec-big" onClick={rec.stop} aria-label="结束并保存">
                <Square aria-hidden="true" />
              </button>
              <small aria-hidden="true">结束并保存</small>
            </span>
            <span className="aui-rec-side">
              {extra ?? (
                <>
                  <button type="button" className="aui-rec-round" onClick={cancel} aria-label="取消录音（不保存）">
                    <X aria-hidden="true" />
                  </button>
                  <small aria-hidden="true">取消</small>
                </>
              )}
            </span>
          </>
        ) : (
          <span className="aui-rec-main">
            <button type="button" className="aui-rec-big" data-idle onClick={() => void rec.start()} disabled={state === "requesting"} aria-label="开始录音">
              <Mic aria-hidden="true" />
            </button>
            <small aria-hidden="true">{state === "requesting" ? "请在浏览器弹窗里允许麦克风" : "开始录音"}</small>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- hold to talk

export type HoldToTalkProps = {
  onDone: (result: RecordingResult) => void;
  /** Slid up and released, or too short. */
  onCancel?: (reason: "slide" | "short" | "key") => void;
  label?: string;
  /** Shorter than this (seconds) counts as an accidental tap and is discarded. Default 0.6. */
  minDuration?: number;
  maxDuration?: number;
  mimeType?: string;
  disabled?: boolean;
  /** Under the button when recording is impossible (denied / unsupported). */
  fallback?: ReactNode;
  className?: string;
};

export function HoldToTalk({ onDone, onCancel, label = "按住说话", minDuration = 0.6, maxDuration = 60, mimeType, disabled, fallback, className }: HoldToTalkProps) {
  const { portal } = useAdminTheme();
  const startY = useRef<number | null>(null);
  const intent = useRef<"send" | "cancel">("send");
  const [armed, setArmed] = useState<"send" | "cancel">("send");
  const [holding, setHolding] = useState(false);
  const [notice, setNotice] = useState("");
  const rec = useAudioRecorder({ mimeType, maxDuration, onDone });
  const recState = useRef(rec.state);
  recState.current = rec.state;
  // Released while the permission prompt was still open: drop the recording as soon as it starts.
  const releasedEarly = useRef(false);
  useEffect(() => {
    if (releasedEarly.current && rec.state === "recording") {
      releasedEarly.current = false;
      rec.cancel();
    } else if (rec.state !== "requesting") releasedEarly.current = false;
  }, [rec]);

  const begin = (y: number | null) => {
    if (disabled || holding) return;
    setNotice("");
    startY.current = y;
    intent.current = "send";
    setArmed("send");
    setHolding(true);
    void rec.start();
  };
  const finish = (how: "send" | "cancel" | "key") => {
    if (!holding) return;
    setHolding(false);
    startY.current = null;
    if (recState.current === "requesting") {
      releasedEarly.current = true;
      return;
    }
    if (how !== "send" || recState.current !== "recording") {
      rec.cancel();
      if (recState.current === "recording" || recState.current === "paused") onCancel?.(how === "key" ? "key" : "slide");
      return;
    }
    if (rec.elapsed < minDuration) {
      rec.cancel();
      setNotice("说话时间太短，没有发送");
      onCancel?.("short");
      return;
    }
    rec.stop();
  };

  const problemState = rec.state === "denied" || rec.state === "unsupported" || rec.state === "error" ? rec.state : null;
  const problem = problemState !== null;
  const overlay = holding && portal
    ? createPortal(
        <div className="aui-hold-sheet" data-cancel={armed === "cancel" || undefined} role="status" aria-live="assertive">
          <div className="aui-hold-card">
            <span className="aui-rec-status">
              <i className="aui-rec-dot" aria-hidden="true" />
              {rec.state === "requesting" ? "正在打开麦克风…" : armed === "cancel" ? "松开手指，取消发送" : "正在录音"}
            </span>
            <span className="aui-rec-timer" data-size="md">{formatDuration(rec.elapsed)}</span>
            <LiveWave levels={rec.levels} active={rec.state === "recording"} />
            <span className="aui-hold-hint">{armed === "cancel" ? "回到按钮上可以继续" : `松开发送，上滑 ${HOLD_CANCEL_DISTANCE}px 取消`}</span>
          </div>
        </div>,
        portal,
      )
    : null;

  return (
    <div className={cn("aui-hold", className)}>
      <button
        type="button"
        className="aui-hold-button"
        data-holding={holding || undefined}
        data-cancel={(holding && armed === "cancel") || undefined}
        disabled={disabled || rec.state === "unsupported"}
        aria-label={`${label}（按住录音，松开发送，上滑取消）`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          begin(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!holding || startY.current == null) return;
          const next = holdGesture(startY.current, e.clientY);
          intent.current = next;
          setArmed(next);
        }}
        onPointerUp={() => finish(intent.current)}
        onPointerCancel={() => finish("cancel")}
        onKeyDown={(e) => {
          if (e.key === "Escape" && holding) {
            e.preventDefault();
            finish("key");
          } else if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            begin(null);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            finish("send");
          }
        }}
        onBlur={() => finish("cancel")}
      >
        <Mic aria-hidden="true" />
        {holding ? (armed === "cancel" ? "松开取消" : "松开发送") : label}
      </button>
      {(notice || problem) && (
        <p className="aui-hold-note" role={problem ? "alert" : "status"}>
          {problemState ? recorderProblem(problemState, rec.failure, { secure: secureContext() }).short : notice}
          {problem && fallback}
        </p>
      )}
      {overlay}
    </div>
  );
}
