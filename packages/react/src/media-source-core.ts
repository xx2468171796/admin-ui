/**
 * What a video / audio player does when its file stops loading (8.0.1): presigned links expire (the host
 * re-signs and the player resumes where it was), a file the browser can't decode gets a clear 「下载后播放」
 * message instead of a silent still frame. Pure, no DOM; the hook is media-source-hook.ts.
 */

/** `MediaError.code` values (HTMLMediaElement). */
export const MEDIA_ERR = { ABORTED: 1, NETWORK: 2, DECODE: 3, SRC_NOT_SUPPORTED: 4 } as const;

/** Why playback gave up: format / codec the browser can't play, broken file, or the link / network. */
export type MediaFailure = "unsupported" | "decode" | "network";

/** Handed to the host when the file stops loading: where playback was, and the browser's error code. */
export type MediaErrorInfo = { currentTime: number; code: number | null };

/** Host hook: return a fresh address (re-signed link) to continue, or null when there is none. */
export type MediaRecover = (info: MediaErrorInfo) => Promise<string | null | undefined>;

export type MediaErrorStep = { kind: "ignore" } | { kind: "resign" } | { kind: "fail"; failure: MediaFailure };

/** Re-sign this many times in a row; a fresh link that fails again means the file itself is the problem. */
export const MEDIA_RESIGN_TRIES = 1;

/** Error code → failure (no code / aborted counts as network). */
export function mediaFailureOf(code: number | null): MediaFailure {
  if (code === MEDIA_ERR.SRC_NOT_SUPPORTED) return "unsupported";
  if (code === MEDIA_ERR.DECODE) return "decode";
  return "network";
}

/**
 * Next step after an error event. An expired / revoked link shows up as NETWORK mid-play and as
 * SRC_NOT_SUPPORTED (the 403 body is not media) on the first load, so both get one re-sign first;
 * DECODE never improves with a new link.
 */
export function planMediaError(input: { code: number | null; tries: number; canResign: boolean }): MediaErrorStep {
  if (input.code === MEDIA_ERR.ABORTED) return { kind: "ignore" };
  if (input.code === MEDIA_ERR.DECODE) return { kind: "fail", failure: "decode" };
  if (input.canResign && input.tries < MEDIA_RESIGN_TRIES) return { kind: "resign" };
  return { kind: "fail", failure: mediaFailureOf(input.code) };
}

/** Where to continue after a re-sign: the same second (not past the end), or 0. */
export function resumeAt(currentTime: number, duration?: number): number {
  if (!Number.isFinite(currentTime) || currentTime <= 0) return 0;
  if (duration !== undefined && Number.isFinite(duration) && duration > 0 && currentTime >= duration) return 0;
  return currentTime;
}

/** The message on the card (video / audio wording). */
export function mediaFailureText(failure: MediaFailure, kind: "video" | "audio"): string {
  const what = kind === "video" ? "视频" : "音频";
  if (failure === "unsupported") return kind === "video" ? "浏览器不支持这个视频编码，下载后播放" : "浏览器不支持这个音频格式，下载后播放";
  if (failure === "decode") return `${what}文件解码出错，可能已损坏，下载后用本机播放器试试`;
  return `${what}加载失败（网络断了或链接过期），点「重新加载」再试`;
}
