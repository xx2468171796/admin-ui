"use client";
/**
 * useMediaSource (8.0.1): the address a <video> / <audio> plays, with recovery. On an error it asks the host
 * for a fresh link (`recover`, e.g. re-sign an expired presigned URL), swaps it in and resumes at the same
 * second (playing again if it was playing); a link that fails again, or no host hook, ends in a failure the
 * player shows as a card (「浏览器不支持这个视频编码，下载后播放」 …). A new `url` from the host starts over.
 * Rules in media-source-core.ts.
 */
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { planMediaError, mediaFailureOf, resumeAt, type MediaErrorInfo, type MediaFailure, type MediaRecover } from "./media-source-core.ts";

type SourceState = { from: string | undefined; src: string | undefined; failure: MediaFailure | null; busy: boolean; tries: number };

const fresh = (url: string | undefined): SourceState => ({ from: url, src: url, failure: null, busy: false, tries: 0 });

export type MediaSourceState = ReturnType<typeof useMediaSource>;

export function useMediaSource(url: string | undefined, recover?: MediaRecover) {
  const [state, setState] = useState<SourceState>(() => fresh(url));
  // The host handed over another address (refreshed cache, other item): start over with it.
  const current = state.from === url ? state : fresh(url);
  if (current !== state) setState(current);
  const resume = useRef<{ time: number; play: boolean } | null>(null);
  const playing = useRef(false);
  const last = useRef<{ el: HTMLMediaElement | null; info: MediaErrorInfo }>({ el: null, info: { currentTime: 0, code: null } });
  const alive = useRef(true);
  const shown = useRef(current.src);
  shown.current = current.src;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const resign = useCallback(
    (info: MediaErrorInfo, play: boolean) => {
      if (!recover) return;
      resume.current = { time: info.currentTime, play };
      setState((s) => ({ ...s, busy: true, failure: null, tries: s.tries + 1 }));
      recover(info).then(
        (next) => {
          if (!alive.current) return;
          if (!next) {
            setState((s) => ({ ...s, busy: false, failure: mediaFailureOf(info.code) }));
            return;
          }
          // Same string back: the element would not reload by itself.
          if (next === shown.current) last.current.el?.load();
          setState((s) => ({ ...s, busy: false, src: next }));
        },
        () => {
          if (alive.current) setState((s) => ({ ...s, busy: false, failure: "network" }));
        },
      );
    },
    [recover],
  );

  const onError = (event: SyntheticEvent<HTMLMediaElement>) => {
    const el = event.currentTarget;
    if (current.busy || !current.src) return;
    const info: MediaErrorInfo = { currentTime: el.currentTime, code: el.error?.code ?? null };
    // After a swapped link fails at once, the element's clock is back at 0: keep the second we were heading for.
    if (info.currentTime === 0 && resume.current) info.currentTime = resume.current.time;
    last.current = { el, info };
    const step = planMediaError({ code: info.code, tries: current.tries, canResign: Boolean(recover) });
    if (step.kind === "ignore") return;
    if (step.kind === "fail") {
      resume.current = null;
      setState((s) => ({ ...s, failure: step.failure }));
      return;
    }
    resign(info, playing.current || resume.current?.play === true || !el.paused);
  };

  const onLoadedMetadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    const el = event.currentTarget;
    const r = resume.current;
    if (!r) return;
    resume.current = null;
    const at = resumeAt(r.time, el.duration);
    if (at > 0) el.currentTime = at;
    if (r.play) el.play().catch(() => undefined);
  };

  return {
    src: current.src,
    failure: current.failure,
    busy: current.busy,
    /** Spread on the <video> / <audio>. */
    events: {
      onError,
      onLoadedMetadata,
      // A link that loaded fine resets the count: the next expiry gets its own re-sign.
      onLoadedData: () => {
        if (current.tries > 0) setState((s) => ({ ...s, tries: 0 }));
      },
      onPlay: () => {
        playing.current = true;
      },
      onPause: () => {
        playing.current = false;
      },
      onEnded: () => {
        playing.current = false;
      },
    },
    /** 「重新加载」 on the failure card: re-sign once more from where it stopped. False = no host hook. */
    retry: (): boolean => {
      if (!recover) return false;
      setState((s) => ({ ...s, tries: 0 }));
      resign(last.current.info, false);
      return true;
    },
  };
}
