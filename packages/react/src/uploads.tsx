"use client";
/**
 * UploadField — one file in a form: the one-row drop zone (icon + explanation + 「选择文件」),
 * while uploading the same row with a 4px bar + 「46%」 + 取消上传, and once there is a file a file row
 * (thumbnail / type tile + name + size + 换一张 / 删除). Multi-file: UploadQueue / UploadDropZone (upload-queue.tsx);
 * photos: ImageUploadGrid.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileUp, ImageIcon, Trash2, X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { tipProps } from "./tooltip.tsx";
import { formatBytes } from "./media-core.ts";
import { UploadDropZone, UploadFileTile, uploadLimitText } from "./upload-queue.tsx";
import { validateFile, type UploadAdapter, type UploadResult } from "./contracts.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/uploads.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/uploads.css";

/** A file already in the field (edit forms: the current cover). */
export type UploadFieldValue = { name: string; size?: number; url?: string; thumbUrl?: string; mime?: string };

export type UploadFieldProps = {
  upload: UploadAdapter;
  onUploaded: (asset: UploadResult) => void;
  accept: readonly string[];
  maxBytes: number;
  disabled?: boolean;
  /**
   * Bold line of the row (「上传封面」). Default 「上传图片」 / 「上传文件」 by `accept`.
   * Earlier this was the drop-zone sentence (「拖拽文件到这里，或点击选择」); a sentence still works but reads long.
   */
  label?: string;
  /** Small line (「PNG、JPG，5 MB 以内；建议 16:9」); default = the limits in words. */
  hint?: ReactNode;
  /** The file already there (controlled by the host after onUploaded / onRemove). Omit to let the field remember the last upload. */
  value?: UploadFieldValue | null;
  /** 删除 on the file row; without it the row only offers 换一张 / 换一个. */
  onRemove?: () => void;
  id?: string;
};

const isImageAccept = (accept: readonly string[]) => accept.length > 0 && accept.every((a) => a.startsWith("image/") || /^\.(png|jpe?g|gif|webp|avif|svg)$/i.test(a));

function useObjectUrl(file: File | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file || !file.type.startsWith("image/") || typeof URL.createObjectURL !== "function") {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function FileRow({ value, preview, image, disabled, onReplace, onRemove }: { value: UploadFieldValue; preview?: string; image: boolean; disabled?: boolean; onReplace: () => void; onRemove?: () => void }) {
  const [dims, setDims] = useState("");
  const src = preview ?? value.thumbUrl ?? (image ? value.url : undefined);
  const sub = [value.size != null ? formatBytes(value.size) : "", dims].filter(Boolean).join(" · ");
  return (
    <div className="aui-upload-file" data-image={src ? true : undefined}>
      <UploadFileTile name={value.name} mime={value.mime} src={src} />
      {src && <img className="aui-sr-only" src={src} alt="" onLoad={(e) => setDims(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)} />}
      <span className="aui-upload-file-text">
        <b {...tipProps(value.name, undefined, { truncated: true })}>{value.name}</b>
        {sub && <small>{sub}</small>}
      </span>
      {!disabled && (
        <span className="aui-upload-file-actions">
          <Button variant="ghost" size="sm" onClick={onReplace}>
            {image ? "换一张" : "换一个"}
          </Button>
          {onRemove && (
            <button type="button" className="aui-upq-x" aria-label={`删除 ${value.name}`} {...tipProps("删除")} onClick={onRemove}>
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/** One file in a form: a one-row picker, then the file row with 换一张 / 删除. */
export function UploadField({ upload, onUploaded, accept, maxBytes, disabled, label, hint, value, onRemove, id }: UploadFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [own, setOwn] = useState<UploadFieldValue | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const image = isImageAccept(accept);
  const preview = useObjectUrl(file);
  const current = value === undefined ? own : value;
  useEffect(() => () => controller.current?.abort(), []);
  const start = async (files: FileList | null) => {
    if (!files?.length || disabled || controller.current) return;
    setError("");
    if (files.length !== 1) {
      setError("每次请选择一个文件");
      return;
    }
    // The picker can report a length without a usable entry (cancelled dialog, removed file).
    const picked = files[0];
    if (!picked) return;
    const invalid = validateFile(picked, accept, maxBytes);
    if (invalid) {
      setError(invalid);
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setFile(picked);
    setProgress(0);
    setBusy(true);
    try {
      const result = await upload(picked, {
        signal: request.signal,
        onProgress: (n) => {
          if (!request.signal.aborted && Number.isFinite(n)) setProgress(Math.max(0, Math.min(100, n)));
        },
      });
      if (!request.signal.aborted) {
        onUploaded(result);
        setOwn({ name: picked.name, size: picked.size, url: result.url, mime: picked.type });
      }
    } catch (err) {
      if (!request.signal.aborted) {
        setError(err instanceof Error ? err.message : "上传失败，请重试");
        setFile(null);
      }
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setFile(null);
  };
  const remove = () => {
    setOwn(null);
    setFile(null);
    onRemove?.();
  };
  const name = file?.name ?? "";
  return (
    <div className="aui-upload" id={id}>
      {/* Only for 「换一张」: before a file is chosen the drop row below has the one file input. */}
      {current && (
      <input
        ref={input}
        type="file"
        hidden
        accept={accept.join(",")}
        disabled={disabled || busy}
        onChange={(e) => {
          void start(e.target.files);
          e.target.value = "";
        }}
      />
      )}
      {busy ? (
        <div className="aui-upload-file" data-busy="">
          <UploadFileTile name={name} mime={file?.type} src={preview} />
          <span className="aui-upload-file-text">
            <b {...tipProps(name, undefined, { truncated: true })}>{name}</b>
            <span className="aui-upq-status">
              <span className="aui-upq-bar" role="progressbar" aria-label={`${name} 上传进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <i style={{ width: `${progress}%` }} />
              </span>
              <span>{Math.round(progress)}%</span>
            </span>
          </span>
          <button type="button" className="aui-upq-x" aria-label="取消上传" {...tipProps("取消上传")} onClick={cancel}>
            <X aria-hidden="true" />
          </button>
        </div>
      ) : current ? (
        <FileRow value={current} preview={file && current === own ? preview : undefined} image={image} disabled={disabled} onReplace={() => input.current?.click()} onRemove={onRemove || value === undefined ? remove : undefined} />
      ) : (
        <UploadDropZone
          variant="row"
          multiple={false}
          accept={accept}
          disabled={disabled}
          title={label ?? (image ? "上传图片" : "上传文件")}
          hint={hint ?? uploadLimitText(accept, maxBytes, false)}
          icon={image ? <ImageIcon aria-hidden="true" /> : <FileUp aria-hidden="true" />}
          error={error || undefined}
          onFiles={(files) => void start(files)}
        />
      )}
      {error && current && (
        <p role="alert" className="aui-field-msg" data-error="">
          {error}
        </p>
      )}
      {current && !busy && (
        <span className="aui-sr-only" role="status">
          {current.name} 已上传
        </span>
      )}
    </div>
  );
}

// bt/media：多文件上传队列（一种拖放区、一种文件行）
export * from "./upload-queue.tsx";
