/**
 * Pure media logic shared by AttachmentGallery, MediaLightbox, AudioPlayer, UploadQueue and the recorders:
 * durations / sizes / speeds as text, file kind detection, waveform peak downsampling, the upload queue
 * state machine with a time-left estimate, and the hold-to-talk gesture. No React, no DOM.
 */

// ---------------------------------------------------------------- kinds

/** What a file is, as far as previewing goes. `pdf` previews in a frame; `file` = everything else. */
export type MediaKind = "image" | "video" | "audio" | "pdf" | "file";

const EXT_KIND: Record<string, MediaKind> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", avif: "image", bmp: "image", svg: "image", heic: "image", heif: "image",
  mp4: "video", m4v: "video", mov: "video", webm: "video", mkv: "video", avi: "video", "3gp": "video",
  mp3: "audio", m4a: "audio", aac: "audio", wav: "audio", ogg: "audio", oga: "audio", opus: "audio", flac: "audio", amr: "audio", weba: "audio",
  pdf: "pdf",
};

/** Lower-case extension without the dot ("" when there is none). */
export function fileExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * A file name split for a middle ellipsis: the stem may be cut, the extension (with its dot, original
 * case, ≤ 8 characters) stays visible — 「报价单-终版….xlsx」. No usable extension → whole name as stem.
 */
export function splitFileName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1 || name.length - dot - 1 > 8 || /[/\s]/.test(name.slice(dot + 1))) return { stem: name, ext: "" };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

/** Kind from the MIME type first (what the server says), then the extension. */
export function detectMediaKind(name: string, mime?: string | null): MediaKind {
  const type = (mime ?? "").toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return EXT_KIND[fileExtension(name)] ?? "file";
}

/** File families with their own neutral icon (no colour per type — DESIGN.md). */
export type FileFamily = "image" | "video" | "audio" | "pdf" | "sheet" | "doc" | "slides" | "archive" | "code" | "text" | "other";
const EXT_FAMILY: Record<string, FileFamily> = {
  xls: "sheet", xlsx: "sheet", csv: "sheet", numbers: "sheet", ods: "sheet",
  doc: "doc", docx: "doc", pages: "doc", odt: "doc", rtf: "doc",
  ppt: "slides", pptx: "slides", key: "slides", odp: "slides",
  zip: "archive", rar: "archive", "7z": "archive", gz: "archive", tar: "archive", tgz: "archive",
  js: "code", ts: "code", json: "code", html: "code", css: "code", xml: "code", py: "code", go: "code", rs: "code", sql: "code",
  txt: "text", md: "text", log: "text",
};
export function fileFamily(name: string, mime?: string | null): FileFamily {
  const kind = detectMediaKind(name, mime);
  if (kind !== "file") return kind;
  return EXT_FAMILY[fileExtension(name)] ?? "other";
}

/** Short type label for a file card ("PDF", "XLS", "DOCX" → "DOC"); at most 4 letters, "" when unknown. */
export function fileTypeLabel(name: string): string {
  const ext = fileExtension(name);
  if (!ext) return "";
  const short: Record<string, string> = { xlsx: "XLS", docx: "DOC", pptx: "PPT", jpeg: "JPG", markdown: "MD" };
  return (short[ext] ?? ext.toUpperCase()).slice(0, 4);
}

/** Readable names of document formats (by extension). */
const DOC_NAMES: Record<string, string> = {
  pdf: "PDF 文档", doc: "Word 文档", docx: "Word 文档", rtf: "RTF 文档", odt: "ODT 文档", pages: "Pages 文稿",
  xls: "Excel 表格", xlsx: "Excel 表格", csv: "CSV 表格", ods: "ODS 表格", numbers: "Numbers 表格",
  ppt: "PPT 演示文稿", pptx: "PPT 演示文稿", key: "Keynote 演示文稿", odp: "ODP 演示文稿",
  zip: "压缩包 ZIP", rar: "压缩包 RAR", "7z": "压缩包 7Z", gz: "压缩包 GZ", tar: "压缩包 TAR", tgz: "压缩包 TGZ",
  txt: "文本文件", md: "Markdown 文档", markdown: "Markdown 文档", log: "日志文件", json: "JSON 文件",
};
/** MIME subtypes that don't read as an extension. */
const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "text/csv": "csv",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip", "application/x-zip-compressed": "zip", "application/x-rar-compressed": "rar", "application/vnd.rar": "rar", "application/x-7z-compressed": "7z",
  "text/plain": "txt", "text/markdown": "md", "application/json": "json",
  "image/jpeg": "jpg", "image/svg+xml": "svg", "video/quicktime": "mov", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/webm": "webm",
};
const KIND_NAME: Record<Exclude<MediaKind, "pdf" | "file">, string> = { image: "图片", video: "视频", audio: "音频" };
const extOfMime = (mime: string) => {
  const type = mime.toLowerCase().split(";")[0]!.trim();
  if (MIME_EXT[type]) return MIME_EXT[type];
  const sub = type.split("/")[1] ?? "";
  return /^[a-z0-9]{1,5}$/.test(sub) ? sub : "";
};
const shortExt = (ext: string) => ({ jpeg: "JPG", markdown: "MD" })[ext] ?? ext.toUpperCase();

/**
 * A file type in words for people, never a raw MIME: 「图片 PNG」「视频 MP4」「音频 M4A」「PDF 文档」
 * 「Word 文档」「Excel 表格」「PPT 演示文稿」「压缩包 ZIP」; unknown → 「ABC 文件」 / 「文件」. The extension
 * wins over the MIME (servers often say application/octet-stream).
 */
export function fileTypeName(name: string, mime?: string | null): string {
  const ext = fileExtension(name) || extOfMime(mime ?? "");
  const kind = detectMediaKind(ext ? `x.${ext}` : "", mime);
  if (DOC_NAMES[ext]) return DOC_NAMES[ext]!;
  if (kind === "pdf") return "PDF 文档";
  if (kind !== "file") return ext ? `${KIND_NAME[kind]} ${shortExt(ext)}` : KIND_NAME[kind];
  return ext ? `${shortExt(ext)} 文件` : "文件";
}

/**
 * An upload `accept` list in words: ["image/*"] → 「图片」; ["image/png", "image/jpeg", ".pdf"] →
 * 「图片 PNG / JPG、PDF 文档」; [] → 「任意文件」. Same names as fileTypeName.
 */
export function acceptLabel(accept: readonly string[]): string {
  const groups = new Map<string, string[]>();
  const whole = new Set<string>();
  for (const raw of accept) {
    const rule = raw.trim().toLowerCase();
    if (!rule || rule === "*" || rule === "*/*") continue;
    const wild = /^(image|video|audio)\/\*$/.exec(rule);
    const name = wild ? KIND_NAME[wild[1] as keyof typeof KIND_NAME] : fileTypeName(rule.startsWith(".") ? `x${rule}` : "", rule.startsWith(".") ? null : rule);
    const media = wild ? null : /^(图片|视频|音频) (.+)$/.exec(name);
    const label = media ? media[1]! : name;
    if (wild) whole.add(label);
    const exts = groups.get(label) ?? [];
    if (media && !exts.includes(media[2]!)) exts.push(media[2]!);
    groups.set(label, exts);
  }
  if (!groups.size) return "任意文件";
  return [...groups].map(([label, exts]) => (exts.length && !whole.has(label) ? `${label} ${exts.join(" / ")}` : label)).join("、");
}

// ---------------------------------------------------------------- text

/** 83 → "01:23"; 3725 → "1:02:05"; invalid / negative → "--:--". Seconds are floored. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * The one size format of adminUI (DESIGN.md「文件大小」): binary steps (1 KB = 1024 B, 1 MB = 1024 KB —
 * what Windows / phones show for a file, and how limits are written: `20 * 1024 * 1024` → 「20 MB」),
 * labelled KB / MB / GB. 2_400_000 → "2.3 MB"; 48_000 → "47 KB"; 512 → "512 B"; one decimal from MB up,
 * whole numbers drop 「.0」.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? String(Math.round(value)) : value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${units[unit]}`;
}

/** Playback speed chip: 1 → "1.0x", 1.25 → "1.25x", 0.75 → "0.75x", 2 → "2.0x". */
export function formatSpeed(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(1) : String(rate)}x`;
}

export const DEFAULT_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/** The speed after `current` in the cycle (wraps; unknown current → 1 or the first). */
export function nextSpeed(current: number, speeds: readonly number[] = DEFAULT_SPEEDS): number {
  if (!speeds.length) return 1;
  const at = speeds.indexOf(current);
  if (at < 0) return speeds.includes(1) ? 1 : (speeds[0] ?? 1);
  return speeds[(at + 1) % speeds.length] ?? 1;
}

/** Seconds left as words: 9 → "剩 9 秒"; 130 → "剩 2 分钟"; 3900 → "剩 1 小时 5 分"; null → "". */
export function formatTimeLeft(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const s = Math.ceil(seconds);
  if (s < 60) return `剩 ${Math.max(1, s)} 秒`;
  // Round to whole minutes first, then split — 3590 s is 「1 小时」, never 「60 分钟」 / 「0 小时 60 分」.
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `剩 ${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `剩 ${h} 小时 ${m} 分` : `剩 ${h} 小时`;
}

/** Clamp a seek target into [0, duration]; non-finite duration → 0..target. */
export function clampTime(target: number, duration: number): number {
  if (!Number.isFinite(target)) return 0;
  const max = Number.isFinite(duration) && duration > 0 ? duration : Math.max(0, target);
  return Math.min(max, Math.max(0, target));
}

// ---------------------------------------------------------------- waveform

/**
 * Downsample host-supplied peaks to `bars` values in 0..1 (max of each bucket, normalised to the
 * loudest value). Fewer peaks than bars are stretched (each peak repeats). Empty / invalid → [].
 */
export function downsamplePeaks(peaks: readonly number[] | null | undefined, bars: number): number[] {
  const count = Math.floor(bars);
  if (!peaks?.length || !Number.isFinite(count) || count <= 0) return [];
  const clean = peaks.map((p) => (Number.isFinite(p) ? Math.abs(p) : 0));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * clean.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * clean.length) / count));
    let max = 0;
    for (let j = from; j < to && j < clean.length; j++) max = Math.max(max, clean[j] ?? 0);
    out.push(max);
  }
  const top = Math.max(...out);
  return top > 0 ? out.map((v) => Math.round((v / top) * 1000) / 1000) : out.map(() => 0);
}

/** Bars that fit in `width` px with `bar` px bars and `gap` px gaps (at least 1 when width > 0). */
export function barCountFor(width: number, bar = 3, gap = 2): number {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.max(1, Math.floor((width + gap) / (bar + gap)));
}

/** RMS level 0..1 of an 8-bit time-domain frame (AnalyserNode.getByteTimeDomainData), lifted for display. */
export function levelFromTimeDomain(frame: ArrayLike<number>): number {
  if (!frame.length) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const v = ((frame[i] ?? 128) - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / frame.length);
  // Speech RMS sits around 0.05–0.3: a square-root curve makes quiet speech visible.
  return Math.min(1, Math.sqrt(rms * 2));
}

// ---------------------------------------------------------------- upload queue

export type UploadItemState = "waiting" | "uploading" | "done" | "failed" | "cancelled";
export type UploadQueueItem<R = unknown> = {
  id: string;
  name: string;
  size: number;
  kind: MediaKind;
  state: UploadItemState;
  /** 0–100. */
  progress: number;
  /** 1 for the first try, +1 per retry. The adapter gets it so a resumable upload can continue. */
  attempt: number;
  /** When the current attempt started and how far it was then (for the time-left estimate). */
  startedAt?: number;
  startProgress?: number;
  /** Last progress report time. */
  updatedAt?: number;
  error?: string;
  result?: R;
};

export type UploadQueueAction<R = unknown> =
  | { type: "add"; items: readonly Pick<UploadQueueItem<R>, "id" | "name" | "size" | "kind">[] }
  | { type: "reject"; item: Pick<UploadQueueItem<R>, "id" | "name" | "size" | "kind">; error: string }
  | { type: "start"; id: string; now: number }
  | { type: "progress"; id: string; progress: number; now: number }
  | { type: "done"; id: string; result: R; now: number }
  | { type: "fail"; id: string; error: string }
  | { type: "cancel"; id: string }
  | { type: "retry"; id: string }
  | { type: "remove"; id: string }
  | { type: "clearFinished" };

const pct = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);

/** The queue state machine. waiting → uploading → done | failed | cancelled; failed / cancelled → (retry) waiting. */
export function uploadQueueReducer<R>(items: readonly UploadQueueItem<R>[], action: UploadQueueAction<R>): UploadQueueItem<R>[] {
  const patch = (id: string, fn: (item: UploadQueueItem<R>) => UploadQueueItem<R> | null) =>
    items.map((item) => (item.id === id ? (fn(item) ?? item) : item));
  switch (action.type) {
    case "add": {
      const known = new Set(items.map((i) => i.id));
      const fresh = action.items.filter((i) => !known.has(i.id)).map((i) => ({ ...i, state: "waiting" as const, progress: 0, attempt: 1 }));
      return [...items, ...fresh];
    }
    case "reject":
      return [...items.filter((i) => i.id !== action.item.id), { ...action.item, state: "failed", progress: 0, attempt: 1, error: action.error }];
    case "start":
      return patch(action.id, (i) => (i.state === "waiting" ? { ...i, state: "uploading", startedAt: action.now, startProgress: i.progress, updatedAt: action.now, error: undefined } : null));
    case "progress":
      return patch(action.id, (i) => (i.state === "uploading" ? { ...i, progress: Math.max(i.progress, pct(action.progress)), updatedAt: action.now } : null));
    case "done":
      return patch(action.id, (i) => (i.state === "uploading" ? { ...i, state: "done", progress: 100, result: action.result, updatedAt: action.now, error: undefined } : null));
    case "fail":
      return patch(action.id, (i) => (i.state === "uploading" ? { ...i, state: "failed", error: action.error } : null));
    case "cancel":
      return patch(action.id, (i) => (i.state === "waiting" || i.state === "uploading" ? { ...i, state: "cancelled" } : null));
    case "retry":
      // Progress is kept: a resumable adapter continues from where it was and reports again.
      return patch(action.id, (i) => (i.state === "failed" || i.state === "cancelled" ? { ...i, state: "waiting", attempt: i.attempt + 1, error: undefined } : null));
    case "remove":
      return items.filter((i) => i.id !== action.id);
    case "clearFinished":
      return items.filter((i) => i.state !== "done" && i.state !== "cancelled");
  }
}

/** Can the lightbox show this item (not locked out, not still uploading)? */
export function isViewableMedia(item: { lock?: { denied?: boolean } | null; upload?: unknown }): boolean {
  return !item.lock?.denied && !item.upload;
}

/** Index of the first viewable item at or after `start` (the strip's 「+N」 chip); -1 when none. */
export function firstViewableFrom<T extends { lock?: { denied?: boolean } | null; upload?: unknown }>(items: readonly T[], start: number): number {
  for (let i = Math.max(0, start); i < items.length; i += 1) if (isViewableMedia(items[i] as T)) return i;
  return -1;
}

/**
 * How many more files fit under `maxFiles`: only files still in flight (waiting + uploading) count —
 * rejected, failed, cancelled and finished ones no longer hold a slot. No limit → Infinity.
 */
export function uploadRoom(items: readonly Pick<UploadQueueItem<unknown>, "state">[], maxFiles: number | undefined): number {
  if (maxFiles == null) return Number.POSITIVE_INFINITY;
  const busy = items.filter((i) => i.state === "waiting" || i.state === "uploading").length;
  return Math.max(0, maxFiles - busy);
}

/** Ids to start now so that at most `concurrency` items upload at once (queue order). */
export function nextUploads(items: readonly UploadQueueItem<unknown>[], concurrency: number): string[] {
  const running = items.filter((i) => i.state === "uploading").length;
  const free = Math.max(0, Math.floor(concurrency) - running);
  return items.filter((i) => i.state === "waiting").slice(0, free).map((i) => i.id);
}

/** Seconds left for an uploading item from its average rate in this attempt; null until there is a rate. */
export function estimateSecondsLeft(item: Pick<UploadQueueItem<unknown>, "state" | "progress" | "startedAt" | "startProgress" | "updatedAt">, now: number): number | null {
  if (item.state !== "uploading" || item.startedAt == null) return null;
  const elapsed = ((item.updatedAt ?? now) - item.startedAt) / 1000;
  const gained = item.progress - (item.startProgress ?? 0);
  if (elapsed < 0.5 || gained <= 0) return null;
  const rate = gained / elapsed; // percent per second
  const sinceLast = Math.max(0, (now - (item.updatedAt ?? now)) / 1000);
  return Math.max(0, (100 - item.progress) / rate - sinceLast);
}

/** Header numbers for the queue: active = waiting + uploading. */
export function summarizeUploads(items: readonly UploadQueueItem<unknown>[]) {
  const by = (s: UploadItemState) => items.filter((i) => i.state === s).length;
  const active = by("waiting") + by("uploading");
  return { total: items.length, active, done: by("done"), failed: by("failed"), cancelled: by("cancelled") };
}

// ---------------------------------------------------------------- hold to talk

/** Slide-up distance (px) after which releasing cancels the recording. */
export const HOLD_CANCEL_DISTANCE = 64;

/** What releasing now would do: slid up far enough → cancel, else send. */
export function holdGesture(startY: number, currentY: number, threshold = HOLD_CANCEL_DISTANCE): "send" | "cancel" {
  return startY - currentY >= threshold ? "cancel" : "send";
}

// ---------------------------------------------------------------- recorder

export type RecorderState = "idle" | "requesting" | "recording" | "paused" | "done" | "denied" | "unsupported" | "error";

/** Best container the browser can record (webm/opus in Chromium/Firefox, mp4/aac in Safari); "" = browser default. */
export function pickRecorderMime(isSupported: (type: string) => boolean, preferred?: string): string {
  const list = [preferred, "audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].filter((t): t is string => Boolean(t));
  for (const type of list) {
    try {
      if (isSupported(type)) return type;
    } catch {
      // isTypeSupported throws in some old engines for unknown strings: try the next.
    }
  }
  return "";
}

/** getUserMedia error → recorder state: permission refused vs. no device / other. */
export function recorderErrorState(error: unknown): "denied" | "error" {
  const name = typeof error === "object" && error && "name" in error ? String((error as { name: unknown }).name) : "";
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError" ? "denied" : "error";
}

/**
 * Box of a MediaThumb (8.0.2). "sm" / "md" fill the box their container gives them (gallery tile, list row,
 * lightbox strip); a number is a fixed square of that many px for a thumb used on its own (a card, a cell, a
 * line of text) — at least 16px, the small look (smaller icon / play disc / badge) below 96px.
 */
export function mediaThumbBox(size: "sm" | "md" | number | undefined): { look: "sm" | "md"; px?: number } {
  if (typeof size !== "number" || !Number.isFinite(size)) return { look: size === "sm" ? "sm" : "md" };
  const px = Math.max(16, Math.round(size));
  return { look: px < 96 ? "sm" : "md", px };
}
