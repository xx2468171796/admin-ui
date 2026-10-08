"use client";
/**
 * useAudioRecorder: microphone → MediaRecorder with a live level history from an AnalyserNode.
 * States idle → requesting → recording ⇄ paused → done; denied (permission refused), unsupported
 * (no MediaRecorder / getUserMedia), error (no device …). Stop hands back a Blob, an object URL, the
 * duration and the level history as waveform peaks. The URL is revoked on reset / unmount.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { levelFromTimeDomain, pickRecorderMime, recorderErrorState, type RecorderState } from "./media-core.ts";
import { recorderFailure, type RecorderFailure } from "./media-recorder-core.ts";

export type RecordingResult = {
  blob: Blob;
  /** Object URL of the blob for local playback; revoked when the recorder resets or unmounts. */
  url: string;
  /** Seconds (pauses excluded). */
  duration: number;
  mimeType: string;
  /** One level (0..1) per tick, usable as AudioPlayer `peaks`. */
  peaks: number[];
};

export type UseAudioRecorderOptions = {
  /** Preferred container, e.g. 「audio/webm;codecs=opus」; falls back to what the browser can record. */
  mimeType?: string;
  /** Stop automatically after this many seconds. */
  maxDuration?: number;
  /** Called once when a recording finishes (not on cancel). */
  onDone?: (result: RecordingResult) => void;
  /** Level ticks kept for the live waveform. Default 160. */
  historySize?: number;
};

type Live = {
  stream: MediaStream;
  recorder: MediaRecorder;
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  chunks: Blob[];
  peaks: number[];
  accumulated: number;
  segmentStart: number | null;
  cancelled: boolean;
  timer: ReturnType<typeof setInterval> | null;
};

const TICK_MS = 80;

function isSupported() {
  return typeof window !== "undefined" && typeof window.MediaRecorder === "function" && typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

export function useAudioRecorder({ mimeType, maxDuration, onDone, historySize = 160 }: UseAudioRecorderOptions = {}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [bytes, setBytes] = useState(0);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [error, setError] = useState("");
  /** Name + message of what the browser threw (→ recorderProblem for the words people read). */
  const [failure, setFailure] = useState<RecorderFailure>({});
  const live = useRef<Live | null>(null);
  /** Bumped by every start / cancel / unmount: a permission prompt answered after that is stale and its stream is dropped. */
  const request = useRef(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const resultUrl = useRef<string | null>(null);
  const opts = useRef({ onDone, maxDuration, historySize, mimeType });
  opts.current = { onDone, maxDuration, historySize, mimeType };

  useEffect(() => {
    mounted.current = true;
    if (!isSupported()) setState("unsupported");
    return () => {
      mounted.current = false;
    };
  }, []);

  const release = useCallback((session: Live) => {
    if (session.timer) clearInterval(session.timer);
    session.stream.getTracks().forEach((t) => t.stop());
    void session.context?.close().catch(() => undefined);
    if (live.current === session) live.current = null;
  }, []);

  const seconds = (session: Live) => (session.accumulated + (session.segmentStart == null ? 0 : performance.now() - session.segmentStart)) / 1000;

  const stop = useCallback(() => {
    const session = live.current;
    if (!session || session.recorder.state === "inactive") return;
    if (session.segmentStart != null) {
      session.accumulated += performance.now() - session.segmentStart;
      session.segmentStart = null;
    }
    session.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (live.current || pending.current) return;
    if (!isSupported()) {
      setFailure({});
      setState("unsupported");
      return;
    }
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
    setError("");
    setFailure({});
    setElapsed(0);
    setLevels([]);
    setBytes(0);
    setState("requesting");
    const token = ++request.current;
    pending.current = true;
    const stale = () => token !== request.current || !mounted.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      if (stale()) return;
      pending.current = false;
      setState(recorderErrorState(err));
      setError(err instanceof Error ? err.message : "");
      setFailure(recorderFailure(err));
      return;
    }
    if (stale()) {
      // Cancelled, unmounted or superseded while the permission prompt was open: release the mic now.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    pending.current = false;
    const type = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t), opts.current.mimeType);
    let recorder: MediaRecorder;
    try {
      recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setState("error");
      setError(err instanceof Error ? err.message : "");
      setFailure(recorderFailure(err));
      return;
    }
    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        context = new Ctor();
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
      }
    } catch {
      // No level meter (old engine / stub): recording still works, the waveform stays flat.
      analyser = null;
    }
    const session: Live = { stream, recorder, context, analyser, chunks: [], peaks: [], accumulated: 0, segmentStart: performance.now(), cancelled: false, timer: null };
    live.current = session;
    const frame = new Uint8Array(analyser?.fftSize ?? 0);
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        session.chunks.push(event.data);
        setBytes((b) => b + event.data.size);
      }
    };
    recorder.onstop = () => {
      release(session);
      if (session.cancelled) return;
      const blob = new Blob(session.chunks, { type: recorder.mimeType || type || "audio/webm" });
      const url = URL.createObjectURL(blob);
      resultUrl.current = url;
      const done: RecordingResult = { blob, url, duration: session.accumulated / 1000, mimeType: blob.type, peaks: session.peaks };
      setResult(done);
      setElapsed(done.duration);
      setState("done");
      opts.current.onDone?.(done);
    };
    session.timer = setInterval(() => {
      if (session.segmentStart == null) return;
      const level = session.analyser ? (session.analyser.getByteTimeDomainData(frame), levelFromTimeDomain(frame)) : 0;
      session.peaks.push(level);
      setLevels((prev) => {
        const next = prev.length >= opts.current.historySize ? prev.slice(prev.length - opts.current.historySize + 1) : prev.slice();
        next.push(level);
        return next;
      });
      const now = seconds(session);
      setElapsed(now);
      if (opts.current.maxDuration && now >= opts.current.maxDuration) stop();
    }, TICK_MS);
    recorder.start(1000);
    setState("recording");
  }, [release, stop]);

  const pause = useCallback(() => {
    const session = live.current;
    if (!session || session.recorder.state !== "recording") return;
    session.recorder.pause();
    if (session.segmentStart != null) session.accumulated += performance.now() - session.segmentStart;
    session.segmentStart = null;
    setElapsed(session.accumulated / 1000);
    setState("paused");
  }, []);
  const resume = useCallback(() => {
    const session = live.current;
    if (!session || session.recorder.state !== "paused") return;
    session.recorder.resume();
    session.segmentStart = performance.now();
    setState("recording");
  }, []);
  const cancel = useCallback(() => {
    request.current += 1;
    pending.current = false;
    const session = live.current;
    if (session) {
      session.cancelled = true;
      if (session.recorder.state !== "inactive") session.recorder.stop();
      else release(session);
    }
    setElapsed(0);
    setLevels([]);
    setBytes(0);
    setState(isSupported() ? "idle" : "unsupported");
  }, [release]);
  const reset = useCallback(() => {
    cancel();
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
  }, [cancel]);

  useEffect(
    () => () => {
      request.current += 1;
      pending.current = false;
      const session = live.current;
      if (session) {
        session.cancelled = true;
        if (session.recorder.state !== "inactive") session.recorder.stop();
        release(session);
      }
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = null;
    },
    [release],
  );

  return { state, elapsed, levels, bytes, result, error, failure, start, pause, resume, stop, cancel, reset };
}
