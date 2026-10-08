"use client";
/**
 * Attachment and audio questions of a public form (bt/builders-a V10, D18 / D18m): file tiles with
 * progress, 取消, failed + 重试 (the file is kept), remove; recorded audio as a player row with
 * 重新录音 / delete; source buttons 拍照 · 录像 · 录音 · 选择文件 (phones open the camera), drop files on
 * the question. Recording uses AudioRecorder inline (desktop and phone, D18m); an audio-only question
 * (`upload.record === "only"`) uses HoldToTalk on touch screens. Transfers go through the host's
 * UploadQueueAdapter (useUploadQueue); the answer is the uploaded files as MediaItem[].
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Camera, FolderOpen, Mic, RefreshCw, Trash2, Video, X, TriangleAlert } from "lucide-react";
import { Button } from "../primitives.tsx";
import { useUploadQueue, type UploadQueueAdapter } from "../upload-queue.tsx";
import { AudioPlayer } from "../media-audio.tsx";
import { AudioRecorder, HoldToTalk } from "../media-recorder.tsx";
import { MediaThumb, type MediaItem } from "../media-parts.tsx";
import { formatBytes, formatDuration } from "../media-core.ts";
import type { RecordingResult } from "../media-recorder-hook.ts";
import { toAttachments } from "../grid-field-types.ts";
import type { FormQuestion } from "./form-core.ts";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

/** What the host's upload adapter resolves with: the stored file (its id and a URL to show it). */
export type FormUploadResult = { id: string; url?: string; thumbUrl?: string; name?: string };
export type FormUploadAdapter = UploadQueueAdapter<FormUploadResult>;

export type FormUploadQuestionProps = {
  question: FormQuestion;
  title: string;
  value: unknown;
  onChange: (files: MediaItem[]) => void;
  upload?: FormUploadAdapter;
  /** Some files are still going up (submit waits). */
  onBusyChange?: (busy: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
  /** Touch screen: an audio-only question shows 按住说话. */
  touch?: boolean;
};

const GB2 = 2 * 1024 ** 3;
const audioFile = (result: RecordingResult, index: number) => {
  const ext = result.mimeType.includes("mp4") ? "m4a" : result.mimeType.includes("ogg") ? "ogg" : "webm";
  return new File([result.blob], `语音说明${index > 1 ? ` ${index}` : ""}.${ext}`, { type: result.mimeType || "audio/webm" });
};

export function FormUploadQuestion({ question, title, value, onChange, upload, onBusyChange, labelledBy, describedBy, disabled, touch }: FormUploadQuestionProps) {
  const options = question.upload ?? {};
  const audioOnly = options.record === "only";
  const canRecord = options.record !== false;
  const capture = audioOnly ? [] : options.capture ?? ["photo", "video"];
  const files = toAttachments(value);
  const latest = useRef(files);
  latest.current = files;
  const recordings = useRef(new Map<string, RecordingResult>());
  const [recording, setRecording] = useState(false);
  const [drag, setDrag] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const accept = audioOnly ? ["audio/*"] : options.accept ?? [];
  const queue = useUploadQueue<FormUploadResult>({
    upload: upload ?? (() => Promise.reject(new Error("这个表单暂时不能上传文件"))),
    accept,
    maxBytes: options.maxBytes ?? GB2,
    // Uploaded files leave the queue (they live in the answer), so the queue only gets the room left.
    maxFiles: options.maxFiles == null ? undefined : Math.max(0, options.maxFiles - files.length),
    onUploaded: (result, item, file) => {
      const local = recordings.current.get(item.name);
      const media: MediaItem = { id: result.id, name: result.name ?? item.name, kind: item.kind, mime: file.type, size: item.size, url: result.url ?? local?.url, thumbUrl: result.thumbUrl, duration: local?.duration, peaks: local?.peaks };
      onChange([...latest.current, media]);
      queue.remove(item.id);
    },
  });
  const pending = queue.items.filter((i) => i.state !== "done" && i.state !== "cancelled");
  const busy = pending.some((i) => i.state === "waiting" || i.state === "uploading");
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  const inFlight = pending.filter((i) => i.state === "waiting" || i.state === "uploading").length;
  const full = options.maxFiles != null && files.length + inFlight >= options.maxFiles;
  const add = (list: FileList | readonly File[] | null) => {
    if (!list || disabled || full) return;
    queue.add(list);
  };
  const recorded = (result: RecordingResult) => {
    setRecording(false);
    if (full) return;
    const file = audioFile(result, files.filter((f) => f.kind === "audio").length + 1);
    // Keep the local recording (peaks, duration, playable URL) for the player row, by file name.
    recordings.current.set(file.name, result);
    queue.add([file]);
  };
  const visuals = files.filter((f) => f.kind !== "audio" && !(f.mime ?? "").startsWith("audio/"));
  const audios = files.filter((f) => f.kind === "audio" || (f.mime ?? "").startsWith("audio/"));
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDrag(false);
    if (event.dataTransfer.files.length) add(event.dataTransfer.files);
  };
  const tiles = visuals.length + pending.filter((i) => i.kind !== "audio").length;
  return (
    <div className="aui-pform-upload" role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} data-dragging={drag || undefined}
      onDragOver={(e) => { if (!disabled && !audioOnly) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
      onDrop={audioOnly ? undefined : onDrop}>
      {tiles > 0 && (
        <ul className="aui-pform-files" aria-label={`${title}：已选的文件`}>
          {visuals.map((file) => (
            <li key={file.id} className="aui-pform-file">
              <span className="aui-pform-file-thumb"><MediaThumb item={file} /></span>
              {!disabled && <button type="button" className="aui-pform-file-remove" aria-label={`删除 ${file.name}`} onClick={() => onChange(latest.current.filter((f) => f.id !== file.id))}><X aria-hidden="true" /></button>}
              <span className="aui-pform-file-meta"><b data-tip={file.name}>{file.name}</b><small>{formatBytes(file.size)}</small></span>
            </li>
          ))}
          {pending.filter((i) => i.kind !== "audio").map((item) => (
            <li key={item.id} className="aui-pform-file" data-state={item.state}>
              {item.state === "failed" ? (
                <span className="aui-pform-file-thumb aui-pform-file-failed">
                  <TriangleAlert aria-hidden="true" />
                  <b>上传失败</b>
                  {queue.canRetry(item.id) && <Button variant="outline" size="sm" onClick={() => queue.retry(item.id)}><RefreshCw />重试</Button>}
                </span>
              ) : (
                <span className="aui-pform-file-thumb">
                  <MediaThumb item={{ id: item.id, name: item.name, kind: item.kind }} showPlay={false} />
                  <span className="aui-pform-file-progress" role="progressbar" aria-label={`${item.name} 上传进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.progress)}>
                    <b>{item.state === "waiting" ? "等待上传" : `上传中 ${Math.round(item.progress)}%`}</b>
                    <span className="aui-pform-bar-track"><i style={{ width: `${item.progress}%` }} /></span>
                  </span>
                </span>
              )}
              <span className="aui-pform-file-meta">
                <b data-tip={item.name}>{item.name}</b>
                <small>
                  {item.state === "failed" ? <span className="aui-pform-file-error" data-tip={item.error}>{item.error ?? "上传失败"}</span> : item.state === "uploading" ? `${formatBytes((item.size * item.progress) / 100)} / ${formatBytes(item.size)}` : formatBytes(item.size)}
                  {item.state === "failed" ? (
                    <button type="button" className="aui-pform-file-x" aria-label={`移除 ${item.name}`} onClick={() => queue.remove(item.id)}><X aria-hidden="true" /></button>
                  ) : (
                    <button type="button" className="aui-pform-file-cancel" onClick={() => queue.cancel(item.id)} aria-label={`取消上传 ${item.name}`}>取消</button>
                  )}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {audios.map((file) => (
        <div key={file.id} className="aui-pform-audio">
          {file.url ? <AudioPlayer src={file.url} title={file.name} subtitle="刚刚录制" duration={file.duration} peaks={file.peaks} /> : <span className="aui-pform-audio-name"><Mic aria-hidden="true" />{file.name}{file.duration ? ` · ${formatDuration(file.duration)}` : ""}</span>}
          {!disabled && (
            <span className="aui-pform-audio-actions">
              {canRecord && <Button variant="ghost" size="sm" onClick={() => { onChange(latest.current.filter((f) => f.id !== file.id)); setRecording(true); }}><Mic />重新录音</Button>}
              <IconButton label={`删除 ${file.name}`} onClick={() => onChange(latest.current.filter((f) => f.id !== file.id))} icon={<Trash2 />} />
            </span>
          )}
        </div>
      ))}
      {pending.filter((i) => i.kind === "audio").map((item) => (
        <div key={item.id} className="aui-pform-audio" data-state={item.state}>
          <span className="aui-pform-audio-name"><Mic aria-hidden="true" />{item.name}</span>
          <span className="aui-pform-audio-status" role="status">{item.state === "failed" ? <span className="aui-pform-file-error">{item.error ?? "上传失败"}</span> : `上传中 ${Math.round(item.progress)}%`}</span>
          <span className="aui-pform-audio-actions">
            {item.state === "failed" && queue.canRetry(item.id) && <Button variant="outline" size="sm" onClick={() => queue.retry(item.id)}><RefreshCw />重试</Button>}
            <IconButton label={item.state === "failed" ? `移除 ${item.name}` : `取消上传 ${item.name}`} onClick={() => (item.state === "failed" ? queue.remove(item.id) : queue.cancel(item.id))} icon={<X />} />
          </span>
        </div>
      ))}
      {recording && (
        <AudioRecorder autoStart className="aui-pform-recorder" maxDuration={options.maxRecordSeconds ?? 600} showSize={false}
          title={`最长 ${Math.round((options.maxRecordSeconds ?? 600) / 60)} 分钟`}
          notes="点「结束并保存」放进上传列表" onDone={recorded} onCancel={() => setRecording(false)} />
      )}
      {!disabled && audioOnly && touch && !recording && audios.length === 0 && (
        <HoldToTalk label={`按住录「${title}」`} maxDuration={Math.min(options.maxRecordSeconds ?? 60, 60)} onDone={recorded} />
      )}
      {!disabled && !(audioOnly && (touch || audios.length > 0)) && (
        <div className="aui-pform-sources">
          {capture.includes("photo") && <Button variant="outline" size="sm" disabled={full} onClick={() => photo.current?.click()}><Camera />拍照</Button>}
          {capture.includes("video") && <Button variant="outline" size="sm" disabled={full} onClick={() => video.current?.click()}><Video />录像</Button>}
          {canRecord && <Button variant="outline" size="sm" disabled={full && !recording} aria-pressed={recording} data-on={recording || undefined} onClick={() => setRecording((v) => !v)}><Mic />{audioOnly ? "开始录音" : "录音"}</Button>}
          {!audioOnly && <Button variant="outline" size="sm" disabled={full} onClick={() => picker.current?.click()}><FolderOpen />选择文件</Button>}
          {full ? <small className="aui-pform-drop-hint" role="status">最多 {options.maxFiles} 个文件，已满</small> : !audioOnly && <small className="aui-pform-drop-hint">也可以把文件拖到这里</small>}
          <input ref={picker} type="file" hidden multiple accept={accept.join(",") || undefined} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <input ref={photo} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <input ref={video} type="file" hidden accept="video/*" capture="environment" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </div>
      )}
    </div>
  );
}
