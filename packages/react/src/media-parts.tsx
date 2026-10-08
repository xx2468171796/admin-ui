"use client";
/**
 * Shared media pieces: the MediaItem contract, neutral type icons, the thumbnail (image / video poster or a
 * neutral tile + type icon), duration / cover badges, the grey lock note and the meta line.
 * Used by AttachmentGallery and MediaLightbox. Styles: styles/media.css.
 */
import type { ReactNode } from "react";
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Lock,
  Play,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./primitives.tsx";
import { detectMediaKind, fileFamily, formatBytes, formatDuration, mediaThumbBox, splitFileName, type FileFamily, type MediaKind } from "./media-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";

/** Restricted file: who can see it (grey lock note on the second line); `denied` = this viewer cannot open or download it. */
export type MediaLock = { label: string; hint?: string; denied?: boolean };

/** Upload state shown on a tile while a file is still going up (map UploadQueue items onto gallery items). */
export type MediaUploadState = {
  state: "uploading" | "failed";
  /** 0–100. */
  progress?: number;
  /** Failure reason (「网络中断，已保留文件」). */
  error?: string;
  /** 「32.4 / 50.6 MB」 or 「剩 9 秒」. */
  detail?: ReactNode;
  onCancel?: () => void;
  onRetry?: () => void;
};

/** One attachment. Only `id` and `name` are required; the kind is detected from mime / extension. */
export type MediaItem = {
  id: string;
  name: string;
  kind?: MediaKind;
  mime?: string;
  /** Bytes. */
  size?: number;
  /** Original file (image full size, video, audio, PDF). Absent = no preview, placeholder only. */
  url?: string;
  /** Image thumbnail or video poster. */
  thumbUrl?: string;
  /** Online preview page for other files (Office viewer the host runs); shown in a frame in the lightbox. */
  previewUrl?: string;
  /** Seconds (video / audio). */
  duration?: number;
  /** PDF / document page count. */
  pages?: number;
  /** Amplitude peaks for audio (AudioPlayer). */
  peaks?: readonly number[];
  /** This image / video is the record's cover (gallery / kanban card). */
  cover?: boolean;
  /** Who / when: 「小王 09-27」. Joined after pages and size with 「 · 」. */
  meta?: ReactNode;
  lock?: MediaLock;
  upload?: MediaUploadState;
};

export function itemKind(item: Pick<MediaItem, "kind" | "name" | "mime">): MediaKind {
  return item.kind ?? detectMediaKind(item.name, item.mime);
}

const FAMILY_ICON: Record<FileFamily, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  audio: FileAudio,
  pdf: FileText,
  sheet: FileSpreadsheet,
  doc: FileText,
  slides: Presentation,
  archive: FileArchive,
  code: FileCode,
  text: FileText,
  other: File,
};
/** Neutral icon for a file (same colour for every type). */
/** A file name that ellipsises in the middle: the stem is cut, the extension stays (「报价单….xlsx」). */
export function FileName({ name }: { name: string }) {
  const { stem, ext } = splitFileName(name);
  if (!ext) return <>{name}</>;
  return (
    <span className="aui-fname">
      <span>{stem}</span>
      <span>{ext}</span>
    </span>
  );
}

export function MediaTypeIcon({ item, size = 18 }: { item: Pick<MediaItem, "kind" | "name" | "mime">; size?: number }) {
  const family: FileFamily = item.kind && item.kind !== "file" ? item.kind : fileFamily(item.name, item.mime);
  const Icon = FAMILY_ICON[family];
  return <Icon size={size} aria-hidden="true" />;
}

export const KIND_LABEL: Record<MediaKind, string> = { image: "图片", video: "视频", audio: "音频", pdf: "PDF", file: "文件" };

/** 「6 页 · 2.3 MB · 小王 10-03」 */
export function MediaMeta({ item }: { item: MediaItem }) {
  const parts: ReactNode[] = [];
  if (item.pages) parts.push(`${item.pages} 页`);
  if (item.size != null) parts.push(formatBytes(item.size));
  if (item.meta) parts.push(item.meta);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " · "}
          {p}
        </span>
      ))}
    </>
  );
}

/** Grey lock note for the second line: 「锁 仅能看价格的人可见」 (never squeezes the file name, not a warning pill); label + hint in the tooltip. */
export function LockPill({ lock }: { lock: MediaLock }) {
  return (
    <span className="aui-media-lock" data-tip={lock.hint ? `${lock.label}：${lock.hint}` : lock.label}>
      <Lock aria-hidden="true" />
      <span>{lock.label}</span>
    </span>
  );
}

/**
 * The picture part of a tile: thumbnail image, or a neutral tile with the type icon; video gets a play
 * disc and a duration badge, a cover gets the 「封面」 badge. Badges use the media scrim tokens.
 * `size`: "md" (default) fills the width of its container, 124px high (gallery tile); "sm" fills the box
 * its container sets (list row, lightbox strip); a number = a fixed square in px for a thumb used on its
 * own (`<MediaThumb item={file} size={64} />`), rounded corners.
 */
export function MediaThumb({ item, size: sizeProp = "md", showPlay = true }: { item: MediaItem; size?: "sm" | "md" | number; showPlay?: boolean }) {
  const box = mediaThumbBox(sizeProp);
  const size = box.look;
  const kind = itemKind(item);
  const denied = item.lock?.denied;
  const src = denied ? undefined : (item.thumbUrl ?? (kind === "image" ? item.url : undefined));
  // One centre mark only: the gallery tile's upload overlay 「上传中 N%」 owns the centre while uploading, and a
  // video without a thumbnail shows just the play disc (not the type icon underneath it).
  const uploading = size === "md" && item.upload?.state === "uploading";
  const play = kind === "video" && !denied && showPlay && !uploading;
  return (
    <span className={cn("aui-media-thumb")} data-size={size} data-fixed={box.px ? true : undefined} style={box.px ? { width: box.px, height: box.px } : undefined} data-kind={kind} data-image={src ? true : undefined}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} /> : denied ? <Lock size={size === "sm" ? 16 : 22} aria-hidden="true" /> : play || uploading ? null : <MediaTypeIcon item={item} size={size === "sm" ? 18 : 24} />}
      {play && (
        <span className="aui-media-play" aria-hidden="true">
          <Play />
        </span>
      )}
      {item.cover && !denied && size === "md" && <span className="aui-media-badge" data-pos="cover">封面</span>}
      {(kind === "video" || kind === "audio") && item.duration != null && !denied && (
        <span className="aui-media-badge" data-pos="duration">
          {size === "md" && kind === "video" && <Video aria-hidden="true" />}
          {formatDuration(item.duration)}
        </span>
      )}
    </span>
  );
}

/** Upload overlay on a tile: progress scrim while uploading, retry block when failed. */
export function UploadOverlay({ upload }: { upload: MediaUploadState }) {
  if (upload.state === "uploading") {
    const value = Math.round(Math.max(0, Math.min(100, upload.progress ?? 0)));
    return (
      <span className="aui-media-uploading" role="progressbar" aria-label="上传进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <b>上传中 {value}%</b>
        <span className="aui-media-upload-bar">
          <i style={{ width: `${value}%` }} />
        </span>
      </span>
    );
  }
  return null;
}
