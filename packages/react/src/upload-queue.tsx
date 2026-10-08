"use client";
/**
 * Multi-file uploads: useUploadQueue (headless queue — concurrency, per-file progress, time left, cancel,
 * retry, failed with reason), UploadDropZone (drag-drop + picker + host buttons such as 拍照 / 录音),
 * UploadQueueList (the 「上传队列」 card) and UploadQueue (zone + list together). The actual transfer is the
 * host's adapter; a resumable adapter keys its session on `key` and continues on `attempt` > 1 — the SDK
 * only reports progress. Look: one drop zone, one file-row look; UploadField (uploads.tsx)
 * is the one-row single-file variant and ImageUploadGrid (image-upload-grid.tsx) the 96px photo tiles.
 */
import { useCallback, useEffect, useReducer, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Check, CircleAlert, FolderOpen, Lock, RefreshCw, Upload, X } from "lucide-react";
import { Button, cn } from "./primitives.tsx";
import { tipProps } from "./tooltip.tsx";
import { validateFile, type UploadResult } from "./contracts.ts";
import {
  acceptLabel,
  detectMediaKind,
  estimateSecondsLeft,
  fileTypeLabel,
  formatBytes,
  formatTimeLeft,
  nextUploads,
  summarizeUploads,
  uploadQueueReducer,
  uploadRoom,
  type UploadQueueAction,
  type MediaKind,
  type UploadQueueItem,
} from "./media-core.ts";
import { MediaTypeIcon } from "./media-parts.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";

/**
 * Upload one file. Same shape as UploadAdapter plus `key` (stable per queue item — use it to find a
 * resumable session) and `attempt` (1, then +1 per retry). Reject with an Error whose message is the
 * reason shown to the user; respect `signal` (cancel).
 */
export type UploadQueueAdapter<R = UploadResult> = (
  file: File,
  context: { signal: AbortSignal; onProgress: (percent: number) => void; key: string; attempt: number },
) => Promise<R>;

export type UseUploadQueueOptions<R> = {
  upload: UploadQueueAdapter<R>;
  /** Same rules as UploadField: 「.pdf」, 「image/*」, 「video/mp4」. Empty = anything. */
  accept?: readonly string[];
  maxBytes: number;
  /** Most files in flight at once — waiting + uploading (extra picks are refused with a reason). Rejected, failed, cancelled and done rows don't count; clearFinished tidies the list. */
  maxFiles?: number;
  /** Parallel uploads; default 3. */
  concurrency?: number;
  onUploaded?: (result: R, item: UploadQueueItem<R>, file: File) => void;
};

let seq = 0;
const newId = () => `up-${Date.now().toString(36)}-${(seq += 1)}`;

export function useUploadQueue<R = UploadResult>({ upload, accept = [], maxBytes, maxFiles, concurrency = 3, onUploaded }: UseUploadQueueOptions<R>) {
  const [items, dispatch] = useReducer((s: UploadQueueItem<R>[], a: UploadQueueAction<R>) => uploadQueueReducer(s, a), []);
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const previews = useRef(new Map<string, string>());
  const latest = useRef({ upload, onUploaded, items });
  latest.current = { upload, onUploaded, items };
  const [now, setNow] = useState(() => Date.now());
  const uploading = items.some((i) => i.state === "uploading");

  useEffect(() => {
    if (!uploading) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [uploading]);
  useEffect(
    () => () => {
      controllers.current.forEach((c) => c.abort());
      previews.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const forget = useCallback((id: string) => {
    files.current.delete(id);
    const url = previews.current.get(id);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(id);
  }, []);

  const run = useCallback(async (item: UploadQueueItem<R>) => {
    const file = files.current.get(item.id);
    if (!file || controllers.current.has(item.id)) return;
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    dispatch({ type: "start", id: item.id, now: Date.now() });
    try {
      const result = await latest.current.upload(file, {
        signal: controller.signal,
        key: item.id,
        attempt: item.attempt,
        onProgress: (p) => {
          if (!controller.signal.aborted) dispatch({ type: "progress", id: item.id, progress: p, now: Date.now() });
        },
      });
      if (controller.signal.aborted) return;
      dispatch({ type: "done", id: item.id, result, now: Date.now() });
      latest.current.onUploaded?.(result, { ...item, state: "done", progress: 100, result }, file);
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "fail", id: item.id, error: error instanceof Error && error.message ? error.message : "上传失败，请重试" });
    } finally {
      if (controllers.current.get(item.id) === controller) controllers.current.delete(item.id);
    }
  }, []);

  useEffect(() => {
    for (const id of nextUploads(items, concurrency)) {
      const item = items.find((i) => i.id === id);
      if (item) void run(item);
    }
  }, [items, concurrency, run]);

  const add = useCallback(
    (list: FileList | readonly File[] | null) => {
      if (!list) return;
      const picked = Array.from(list);
      const room = uploadRoom(latest.current.items, maxFiles);
      const fresh: UploadQueueItem<R>[] = [];
      picked.forEach((file, index) => {
        const id = newId();
        const base = { id, name: file.name, size: file.size, kind: detectMediaKind(file.name, file.type) };
        const invalid = index >= room ? `一次最多 ${maxFiles} 个文件` : accept.length ? validateFile(file, accept, maxBytes) : file.size > maxBytes ? validateFile(file, ["*"], maxBytes) : "";
        if (invalid) {
          dispatch({ type: "reject", item: base, error: invalid });
          return;
        }
        files.current.set(id, file);
        fresh.push({ ...base, state: "waiting", progress: 0, attempt: 1 });
      });
      if (fresh.length) dispatch({ type: "add", items: fresh });
    },
    [accept, maxBytes, maxFiles],
  );
  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    dispatch({ type: "cancel", id });
  }, []);
  const retry = useCallback((id: string) => {
    if (files.current.has(id)) dispatch({ type: "retry", id });
  }, []);
  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    forget(id);
    dispatch({ type: "remove", id });
  }, [forget]);
  const clearFinished = useCallback(() => {
    for (const i of latest.current.items) if (i.state === "done" || i.state === "cancelled") forget(i.id);
    dispatch({ type: "clearFinished" });
  }, [forget]);
  /** A local object URL for an image file in the queue (thumbnail while it uploads); revoked when the row goes. */
  const previewOf = useCallback((id: string): string | undefined => {
    const known = previews.current.get(id);
    if (known) return known;
    const file = files.current.get(id);
    if (!file || !file.type.startsWith("image/") || typeof URL.createObjectURL !== "function") return undefined;
    const url = URL.createObjectURL(file);
    previews.current.set(id, url);
    return url;
  }, []);
  const fileOf = useCallback((id: string) => files.current.get(id), []);
  return { items, now, add, cancel, retry, remove, clearFinished, canRetry: (id: string) => files.current.has(id), previewOf, fileOf };
}

// ---------------------------------------------------------------- type tile

/**
 * The 32px square in front of a file row: a thumbnail when there is one, otherwise the neutral type label
 * (PDF / XLS) or the type icon for media — one colour for every type; only a failed row uses the danger tint.
 */
export function UploadFileTile({ name, kind, mime, src, failed }: { name: string; kind?: MediaKind; mime?: string; src?: string; failed?: boolean }) {
  const family = kind && kind !== "file" ? kind : detectMediaKind(name, mime);
  const label = family === "image" || family === "video" || family === "audio" ? "" : fileTypeLabel(name);
  return (
    <span className="aui-upload-tile" data-failed={failed || undefined} data-image={src ? true : undefined} aria-hidden="true">
      {src ? <img src={src} alt="" draggable={false} /> : label ? label : <MediaTypeIcon item={{ kind: family, name, mime }} size={16} />}
    </span>
  );
}

/** 「图片 PNG / JPG，5 MB 以内」 — the limits of a picker in words (DESIGN「文件大小与类型」). */
export function uploadLimitText(accept: readonly string[] = [], maxBytes?: number, multiple = true): string {
  const types = acceptLabel(accept);
  if (maxBytes == null || !Number.isFinite(maxBytes)) return types;
  return `${types}，${multiple ? "单个 " : ""}${formatBytes(maxBytes)} 以内`;
}

// ---------------------------------------------------------------- drop zone

export type UploadDropZoneProps = {
  onFiles: (files: FileList) => void;
  accept?: readonly string[];
  multiple?: boolean;
  disabled?: boolean;
  /** Bold first line (「还没有附件」「上传封面」). */
  title?: ReactNode;
  /** The drag line; default 「把文件拖到这里，或 点击选择」 (「把文件拖到这里，或」 when `actions` are given). */
  label?: ReactNode;
  /** Small line (「平面图、报价单都行 · 单个 1 GB 以内」); default = the limits from `accept` + `maxBytes` in words. */
  hint?: ReactNode;
  /** Limit for the default hint (1024-based, 「5 MB 以内」). The host still validates. */
  maxBytes?: number;
  /** More buttons next to 选择文件 (拍照 / 录音 — the host wires them). With actions the zone shows buttons instead of being one big click target. */
  actions?: ReactNode;
  pickLabel?: string;
  /** Paste files (screenshots) while the zone has focus. Default true. */
  paste?: boolean;
  /** Red border + this reason (「只能传 PNG、JPG」). */
  error?: ReactNode;
  /** What to say while disabled (「已收集结束」). */
  disabledText?: ReactNode;
  /** `zone` (default): centred block · `row`: one line for a single file in a form (icon + text + 选择文件). */
  variant?: "zone" | "row";
  /** Icon in the neutral block (default upload arrow). */
  icon?: ReactNode;
  className?: string;
};

function dragCount(event: DragEvent<HTMLElement>): number {
  return Array.from(event.dataTransfer.items ?? []).filter((item) => item.kind === "file").length;
}

function zoneLine(p: { drag: number | null; disabled?: boolean; disabledText?: ReactNode; error?: ReactNode; label?: ReactNode; row: boolean; actions: boolean }): ReactNode {
  if (p.drag != null) return p.drag > 0 ? `松手开始上传 ${p.drag} 个文件` : "松手开始上传";
  if (p.disabled && p.disabledText) return p.disabledText;
  if (p.error) return p.error;
  if (p.label !== undefined || p.row) return p.label;
  return p.actions ? (
    "把文件拖到这里，或"
  ) : (
    <>
      把文件拖到这里，或 <u>点击选择</u>
    </>
  );
}

/**
 * The one drop zone: 1.5px dashed field border, radius 12, a neutral icon block; drag over =
 * solid main-colour border + soft background + 「松手开始上传 N 个文件」; limits in words; error / disabled states.
 */
export function UploadDropZone({ onFiles, accept = [], multiple = true, disabled, title, label, hint, maxBytes, actions, pickLabel = "选择文件", paste = true, error, disabledText, variant = "zone", icon, className }: UploadDropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const row = variant === "row";
  const clickable = !row && !actions && !disabled;
  const pick = () => {
    if (!disabled) input.current?.click();
  };
  const limits = hint ?? (accept.length || maxBytes != null ? uploadLimitText(accept, maxBytes, multiple) : undefined);
  const line = zoneLine({ drag, disabled, disabledText, error, label, row, actions: Boolean(actions) });
  const quiet = drag != null || Boolean(error) || Boolean(disabled && disabledText);
  const mark = disabled ? <Lock aria-hidden="true" /> : error && drag == null ? <CircleAlert aria-hidden="true" /> : (icon ?? <Upload aria-hidden="true" />);
  const pickButton = (
    <Button variant="outline" size="sm" disabled={disabled} onClick={pick}>
      {!row && <FolderOpen />}
      {pickLabel}
    </Button>
  );
  return (
    <div
      className={cn("aui-dropzone", className)}
      data-variant={variant}
      data-dragging={drag != null || undefined}
      data-disabled={disabled || undefined}
      data-error={error ? true : undefined}
      tabIndex={!disabled && (clickable || paste) ? 0 : undefined}
      role={clickable ? "button" : "group"}
      aria-label={typeof title === "string" ? title : typeof label === "string" ? label : "上传文件"}
      aria-disabled={disabled || undefined}
      onClick={clickable ? pick : undefined}
      onKeyDown={(e) => {
        if (clickable && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          pick();
        }
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        if (drag == null) setDrag(dragCount(e));
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(null);
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      onPaste={(e) => {
        if (paste && !disabled && e.clipboardData.files.length) onFiles(e.clipboardData.files);
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept.join(",") || undefined}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="aui-dropzone-icon">{mark}</span>
      {row ? (
        <>
          <span className="aui-dropzone-text">
            <b role={error && drag == null ? "alert" : undefined}>{quiet ? line : (title ?? line ?? "上传文件")}</b>
            {limits && !quiet && <small>{limits}</small>}
          </span>
          {!disabled && pickButton}
        </>
      ) : (
        <>
          {title && drag == null && <b className="aui-dropzone-title">{title}</b>}
          {line && (
            <span className="aui-dropzone-label" role={error && drag == null ? "alert" : undefined}>
              {line}
            </span>
          )}
          {actions && !disabled && drag == null && (
            <span className="aui-dropzone-actions">
              {pickButton}
              {actions}
            </span>
          )}
          {limits && !quiet && <small className="aui-dropzone-hint">{limits}</small>}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- queue list

export type UploadQueueListProps = {
  items: readonly UploadQueueItem<unknown>[];
  /** Clock for 「还要 N 秒」 (useUploadQueue returns one that ticks while uploading). */
  now: number;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  /** Retry is offered only when the file is still held (useUploadQueue().canRetry). */
  canRetry?: (id: string) => boolean;
  /** Thumbnails for image rows (useUploadQueue().previewOf). */
  previewOf?: (id: string) => string | undefined;
  title?: string;
  className?: string;
};

/** 「46% · 还要 10 秒」 — formatTimeLeft in the queue's wording. */
export function uploadProgressText(progress: number, secondsLeft: number | null): string {
  const left = progress >= 100 ? "" : formatTimeLeft(secondsLeft).replace(/^剩 /, "还要 ");
  return `${Math.round(progress)}%${left ? ` · ${left}` : ""}`;
}

function QueueStatus({ item, now }: { item: UploadQueueItem<unknown>; now: number }) {
  if (item.state === "uploading")
    return (
      <>
        <span className="aui-upq-bar" role="progressbar" aria-label={`${item.name} 上传进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.progress)}>
          <i style={{ width: `${item.progress}%` }} />
        </span>
        <span>{uploadProgressText(item.progress, estimateSecondsLeft(item, now))}</span>
      </>
    );
  if (item.state === "waiting") return <span>等待中 · {formatBytes(item.size)}</span>;
  if (item.state === "done")
    return (
      <>
        <span className="aui-upq-ok">
          <Check aria-hidden="true" />
          已上传
        </span>
        <span>{formatBytes(item.size)}</span>
      </>
    );
  if (item.state === "failed")
    return (
      <span className="aui-upq-error">
        <CircleAlert aria-hidden="true" />
        {item.error ?? "上传失败"}
      </span>
    );
  return <span>已取消</span>;
}

/** One row per file: type tile + name + 4px bar + 「46% · 还要 10 秒」; failed = reason + 重试; 「全部重试」 on top. */
export function UploadQueueList({ items, now, onCancel, onRetry, onRemove, canRetry = () => true, previewOf, title = "上传队列", className }: UploadQueueListProps) {
  const sum = summarizeUploads(items);
  const retryable = items.filter((i) => (i.state === "failed" || i.state === "cancelled") && canRetry(i.id));
  return (
    <div className={cn("aui-upq", className)} role="group" aria-label={title}>
      <h5>
        <span>
          <b>{title}</b> · {sum.total} 个{sum.failed > 0 && <span className="aui-upq-failed"> · {sum.failed} 个失败</span>}
        </span>
        {retryable.some((i) => i.state === "failed") && (
          <Button variant="ghost" size="sm" className="aui-upq-retry-all" onClick={() => retryable.forEach((i) => onRetry(i.id))}>
            <RefreshCw />
            全部重试
          </Button>
        )}
      </h5>
      {items.length === 0 ? (
        <p className="aui-upq-empty">还没有文件</p>
      ) : (
        <ul>
          {items.map((item) => {
            const active = item.state === "waiting" || item.state === "uploading";
            return (
              <li key={item.id} className="aui-upq-item" data-state={item.state}>
                <UploadFileTile name={item.name} kind={item.kind} src={item.kind === "image" ? previewOf?.(item.id) : undefined} failed={item.state === "failed"} />
                <span className="aui-upq-text">
                  <b {...tipProps(item.name, undefined, { truncated: true })}>{item.name}</b>
                  <span className="aui-upq-status" aria-live="polite">
                    <QueueStatus item={item} now={now} />
                  </span>
                </span>
                <span className="aui-upq-actions">
                  {(item.state === "failed" || item.state === "cancelled") && canRetry(item.id) && (
                    <Button variant="outline" size="sm" onClick={() => onRetry(item.id)}>
                      <RefreshCw />
                      重试
                    </Button>
                  )}
                  <button type="button" className="aui-upq-x" aria-label={active ? `取消上传 ${item.name}` : `从列表移除 ${item.name}`} {...tipProps(active ? "取消上传" : "移除")} onClick={() => (active ? onCancel(item.id) : onRemove(item.id))}>
                    <X aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- zone + queue

export type UploadQueueProps<R = UploadResult> = UseUploadQueueOptions<R> &
  Pick<UploadDropZoneProps, "title" | "label" | "hint" | "actions" | "disabled" | "pickLabel"> & {
    /** `side`: zone left, queue card right (300px) — stacks on phones; `stack`: queue under the zone. */
    layout?: "side" | "stack";
    /** Hide the queue card while it is empty. Default true. */
    hideEmptyQueue?: boolean;
    className?: string;
  };

export function UploadQueue<R = UploadResult>({ layout = "side", hideEmptyQueue = true, title, label, hint, actions, disabled, pickLabel, className, ...options }: UploadQueueProps<R>) {
  const queue = useUploadQueue<R>(options);
  const showList = !hideEmptyQueue || queue.items.length > 0;
  return (
    <div className={cn("aui-upload-queue", className)} data-layout={layout} data-has-list={showList || undefined}>
      <UploadDropZone onFiles={queue.add} accept={options.accept} maxBytes={options.maxBytes} title={title} label={label} hint={hint} actions={actions} disabled={disabled} pickLabel={pickLabel} />
      {showList && <UploadQueueList items={queue.items} now={queue.now} onCancel={queue.cancel} onRetry={queue.retry} onRemove={queue.remove} canRetry={queue.canRetry} previewOf={queue.previewOf} />}
    </div>
  );
}
