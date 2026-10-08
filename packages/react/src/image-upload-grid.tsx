"use client";
/**
 * ImageUploadGrid (review 「组件库 02 · 上传」): photos as 96px tiles (radius 10). The first
 * tile is the cover (「封面」 badge); an uploading tile shows a progress ring + percentage over its own preview; a
 * failed one gets a red border + 重试; × removes (on hover, always on touch); the add tile says 「添加照片 · 还能加
 * N 张」 until `max`. Uploads run through useUploadQueue (same adapter as UploadQueue). The host owns the finished
 * list: append in `onUploaded`, drop in `onRemove` — a finished upload leaves the queue at once.
 */
import { useRef, useState, type ReactNode } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { cn } from "./primitives.tsx";
import { tipProps } from "./tooltip.tsx";
import { useUploadQueue, type UploadQueueAdapter } from "./upload-queue.tsx";
import type { UploadResult } from "./contracts.ts";
import type { UploadQueueItem } from "./media-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/uploads.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/uploads.css";

/** A finished photo in the grid (host data). */
export type ImageUploadTile = { id: string; url: string; name?: string };

export type ImageUploadGridProps<R = UploadResult> = {
  /** Finished photos, in order (the first is the cover). */
  images: readonly ImageUploadTile[];
  upload: UploadQueueAdapter<R>;
  /** Called when a photo finished uploading — append it to `images`. */
  onUploaded: (result: R, file: File) => void;
  onRemove?: (image: ImageUploadTile) => void;
  /** Most photos in total (finished + uploading). Default 9. */
  max?: number;
  maxBytes: number;
  /** Default ["image/*"] (phones then offer 拍照 / 相册). */
  accept?: readonly string[];
  /** Names the grid (field name: 「现场照片」). */
  label: string;
  /** 「添加照片」 */
  addLabel?: string;
  /** Badge the first tile 「封面」. Default true. */
  cover?: boolean;
  concurrency?: number;
  disabled?: boolean;
  className?: string;
};

const RING = 2 * Math.PI * 15;

function Ring({ progress }: { progress: number }) {
  return (
    <svg className="aui-imgs-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="aui-imgs-ring-bg" cx="18" cy="18" r="15" />
      <circle className="aui-imgs-ring-fg" cx="18" cy="18" r="15" strokeDasharray={RING} strokeDashoffset={RING * (1 - progress / 100)} />
    </svg>
  );
}

function QueueTile({ item, src, cover, canRetry, onRetry, onDrop }: { item: UploadQueueItem<unknown>; src?: string; cover: boolean; canRetry: boolean; onRetry: () => void; onDrop: () => void }) {
  const failed = item.state === "failed" || item.state === "cancelled";
  const pct = Math.round(item.progress);
  let veil: ReactNode;
  if (failed)
    veil = canRetry ? (
      <button type="button" className="aui-imgs-veil" data-failed="" aria-label={`重试 ${item.name}`} {...tipProps(item.error ?? "上传失败")} onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        <span>重试</span>
      </button>
    ) : (
      <span className="aui-imgs-veil" data-failed="" {...tipProps(item.error ?? "上传失败")}>
        <span>{item.error ?? "上传失败"}</span>
      </span>
    );
  else
    veil = (
      <span className="aui-imgs-veil" role="progressbar" aria-label={`${item.name} 上传进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        {item.state === "waiting" ? (
          <span>等待中</span>
        ) : (
          <>
            <Ring progress={item.progress} />
            <span className="aui-imgs-pct">{pct}%</span>
          </>
        )}
      </span>
    );
  return (
    <li className="aui-imgs-tile" data-state={item.state} data-failed={failed || undefined}>
      {src && <img src={src} alt="" draggable={false} />}
      {cover && <span className="aui-imgs-badge">封面</span>}
      {veil}
      <button type="button" className="aui-imgs-x" aria-label={failed ? `移除 ${item.name}` : `取消上传 ${item.name}`} {...tipProps(failed ? "移除" : "取消上传")} onClick={onDrop}>
        <X aria-hidden="true" />
      </button>
    </li>
  );
}

/** Photo tiles with cover, per-tile progress ring, retry and an add tile counting down to `max`. */
export function ImageUploadGrid<R = UploadResult>({ images, upload, onUploaded, onRemove, max = 9, maxBytes, accept = ["image/*"], label, addLabel = "添加照片", cover = true, concurrency, disabled, className }: ImageUploadGridProps<R>) {
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const holder = useRef<{ remove: (id: string) => void }>({ remove: () => undefined });
  const queue = useUploadQueue<R>({
    upload,
    accept,
    maxBytes,
    concurrency,
    onUploaded: (result, item, file) => {
      onUploaded(result, file);
      holder.current.remove(item.id);
    },
  });
  holder.current.remove = queue.remove;
  const pending = queue.items.filter((i) => i.state !== "done");
  const room = Math.max(0, max - images.length - pending.length);
  const add = (list: FileList | null) => {
    if (!list?.length || disabled) return;
    const files = Array.from(list);
    const taken = files.slice(0, room);
    setNotice(files.length > room ? `最多 ${max} 张，多出的 ${files.length - room} 张没有加` : "");
    if (taken.length) queue.add(taken);
  };
  let index = 0;
  return (
    <div
      className={cn("aui-imgs", className)}
      role="group"
      aria-label={label}
      onDragOver={(e) => {
        if (!disabled && room > 0) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        add(e.dataTransfer.files);
      }}
    >
      <ul className="aui-imgs-grid">
        {images.map((image) => {
          const first = cover && index++ === 0;
          return (
            <li key={image.id} className="aui-imgs-tile">
              <img src={image.url} alt={image.name ?? ""} draggable={false} />
              {first && <span className="aui-imgs-badge">封面</span>}
              {onRemove && !disabled && (
                <button type="button" className="aui-imgs-x" aria-label={`删除 ${image.name ?? "这张照片"}`} {...tipProps("删除")} onClick={() => onRemove(image)}>
                  <X aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
        {pending.map((item) => (
          <QueueTile
            key={item.id}
            item={item}
            src={queue.previewOf(item.id)}
            cover={cover && index++ === 0}
            canRetry={queue.canRetry(item.id)}
            onRetry={() => queue.retry(item.id)}
            onDrop={() => queue.remove(item.id)}
          />
        ))}
        {room > 0 && !disabled && (
          <li>
            <button type="button" className="aui-imgs-add" onClick={() => input.current?.click()}>
              <Plus aria-hidden="true" />
              {addLabel}
              <small>还能加 {room} 张</small>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        hidden
        multiple={room > 1}
        accept={accept.join(",") || undefined}
        disabled={disabled}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {notice && (
        <p className="aui-field-msg" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
