"use client";
/**
 * MediaLightbox: full-screen, immersive preview of one attachment on the media stage colour
 * — no dialog frame, no card in a card. Top bar: name + 「第 N / M 个」 + 下载 / 新窗口 / 信息 / 关闭; floating
 * toolbar 缩小 · 100% · 放大 · 旋转 · 适应 (images); round prev / next buttons at the sides; thumbnail strip
 * at the bottom; optional info panel. Keys: ← / → page, + / - / 0 zoom, Esc closes (focus goes back to the
 * opener). Ctrl + wheel zooms, drag pans a zoomed picture, phones swipe left / right. Video (native
 * controls), audio (AudioPlayer), PDF (frame or poster), other files (host preview frame, else a download
 * card). Built on Dialog (portal, focus trap, focus return). Stage + zoom: media-lightbox-stage.tsx.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Info, Minimize2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog } from "./forms.tsx";
import { useIsMobile } from "./media-query.ts";
import { formatBytes, formatDuration } from "./media-core.ts";
import { itemKind, KIND_LABEL, MediaMeta, MediaThumb, type MediaItem } from "./media-parts.tsx";
import { LightboxStage, useLightboxZoom, type LightboxZoom, type StageInsets } from "./media-lightbox-stage.tsx";
import { zoomPercent } from "./media-zoom.ts";
import { revealInline } from "./scroll-reveal.ts";
import type { MediaErrorInfo } from "./media-source-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";

export type MediaLightboxProps = {
  open: boolean;
  items: readonly MediaItem[];
  /** Index of the shown item in `items`. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Download the shown item (host builds the signed URL / zip). Hidden for locked-denied items. */
  onDownload?: (item: MediaItem) => void;
  /** Open the original in a new window (host decides the URL). */
  onOpenInNewWindow?: (item: MediaItem) => void;
  /** Where it came from (「来自 张家豪 · 字段「现场资料」· 阿杰 上传于 10-04」): shown at the top of the info panel. */
  caption?: (item: MediaItem) => ReactNode;
  /** Info panel body (「信息」 button); default = 来自 (caption) · 类型 · 大小 · 时长 / 页数 · 上传 (meta). */
  info?: (item: MediaItem) => ReactNode;
  /** Open the info panel when the lightbox opens. Default false. */
  defaultInfoOpen?: boolean;
  /** Zoom limits relative to the natural pixels (1 = 100%). Default 0.1 – 8. */
  minZoom?: number;
  maxZoom?: number;
  /** PDF: `frame` shows the browser's viewer in an iframe (default); `poster` shows thumbUrl + open button. */
  pdfPreview?: "frame" | "poster";
  /** Action slot on the audio player (「转文字」). */
  audioAction?: (item: MediaItem) => ReactNode;
  /** Dialog name for screen readers; default 「预览」. */
  label?: string;
  /**
   * The shown image / video / audio has no address (signing failed, link not ready): the card offers
   * 「重新加载」, which calls this; the host resolves the item again (forget cached failures, re-sign) and
   * passes items with `url`. Return a promise to show 「正在重新加载…」 until it settles.
   */
  onReload?: (item: MediaItem) => void | Promise<void>;
  /**
   * Video / audio stopped loading (presigned link expired mid-play, revoked, network): return a fresh link and
   * playback continues at `info.currentTime` (playing again if it was playing). null / undefined = no link →
   * the reason card. Called at most once per failure in a row; a fresh link that fails again ends in
   * 「浏览器不支持这个视频编码，下载后播放」 (or the network / broken-file message) with 下载.
   */
  onMediaError?: (item: MediaItem, info: MediaErrorInfo) => Promise<string | null | undefined>;
};

const IGNORE_KEYS_IN = "input,textarea,select,video,audio,[contenteditable=true],[role=slider]";
const DESKTOP_INSETS: StageInsets = { x: 84, top: 8, bottom: 76 };
const PHONE_INSETS: StageInsets = { x: 0, top: 8, bottom: 72 };

export function MediaLightbox({ open, items, index, onIndexChange, onClose, onDownload, onOpenInNewWindow, caption, info, defaultInfoOpen = false, minZoom, maxZoom, pdfPreview = "frame", audioAction, label = "预览", onReload, onMediaError }: MediaLightboxProps) {
  const safe = Math.max(0, Math.min(items.length - 1, index));
  const item = items[safe];
  const phone = useIsMobile();
  const insets = phone ? PHONE_INSETS : DESKTOP_INSETS;
  const zoom = useLightboxZoom(open && item ? item.id : "", insets, minZoom, maxZoom);
  const [infoOpen, setInfoOpen] = useState(defaultInfoOpen);
  const strip = useRef<HTMLDivElement>(null);
  const move = (delta: -1 | 1) => {
    const next = safe + delta;
    if (next >= 0 && next < items.length) onIndexChange(next);
  };
  const zoomable = Boolean(item && itemKind(item) === "image" && item.url && !item.lock?.denied);
  useEffect(() => {
    if (open) setInfoOpen(defaultInfoOpen);
  }, [open, defaultInfoOpen]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(IGNORE_KEYS_IN)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const action = keyAction(event.key, zoomable, zoom, move);
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => revealInline(strip.current?.querySelector<HTMLElement>("[aria-current=true]"), strip.current, 3));
    return () => cancelAnimationFrame(frame);
  }, [open, safe]);
  if (!item) return null;
  const kind = itemKind(item);
  const denied = Boolean(item.lock?.denied);
  const position = `第 ${safe + 1} / ${items.length} 个`;
  const description = [position, item.size != null ? formatBytes(item.size) : null, KIND_LABEL[kind]].filter(Boolean).join(" · ");
  const header = (close: ReactNode) => (
    <header className="aui-lb-top">
      <div className="aui-lb-title">
        <b className="aui-lb-name">{item.name}</b>
        <small className="aui-lb-sub">
          {position}
          {item.pages || item.size != null || item.meta ? " · " : ""}
          <MediaMeta item={item} />
        </small>
      </div>
      <div className="aui-lb-actions">
        {onDownload && !denied && (
          <button type="button" className="aui-lb-btn" data-text="" aria-label="下载" onClick={() => onDownload(item)}>
            <Download aria-hidden="true" />
            <span className="aui-lb-btn-text">下载</span>
          </button>
        )}
        {onOpenInNewWindow && !denied && (
          <button type="button" className="aui-lb-btn" aria-label="在新窗口打开" data-tip="在新窗口打开" onClick={() => onOpenInNewWindow(item)}>
            <ExternalLink aria-hidden="true" />
          </button>
        )}
        <button type="button" className="aui-lb-btn" aria-label="信息" aria-pressed={infoOpen} data-tip="信息" onClick={() => setInfoOpen((v) => !v)}>
          <Info aria-hidden="true" />
        </button>
        {close}
      </div>
    </header>
  );
  return (
    <Dialog open={open} title={item.name} description={description} onClose={onClose} size="full" header={header} className="aui-lightbox-dialog" bodyClassName="aui-lightbox-body" initialFocus="dialog">
      <section className="aui-lightbox" aria-label={label} aria-roledescription="媒体预览">
        <LightboxStage item={item} zoom={zoom} insets={insets} pdfPreview={pdfPreview} audioAction={audioAction} onDownload={onDownload} onOpenInNewWindow={onOpenInNewWindow} onReload={onReload} onMediaError={onMediaError} onPage={move} />
        {items.length > 1 && (
          <>
            <button type="button" className="aui-lb-nav" data-side="prev" aria-label="上一个" disabled={safe === 0} onClick={() => move(-1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="aui-lb-nav" data-side="next" aria-label="下一个" disabled={safe === items.length - 1} onClick={() => move(1)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
        {zoomable && <ZoomBar zoom={zoom} />}
        {infoOpen && <aside className="aui-lb-info" aria-label="文件信息">{info ? info(item) : <DefaultInfo item={item} caption={caption} />}</aside>}
      </section>
      {items.length > 1 && (
        <footer className="aui-lb-foot">
          <div className="aui-lightbox-strip" ref={strip} role="list" aria-label="全部附件">
            {items.map((it, i) => (
              <span role="listitem" key={it.id}>
                <button type="button" className="aui-lightbox-thumb" aria-current={i === safe || undefined} aria-label={`第 ${i + 1} 个：${it.name}`} onClick={() => onIndexChange(i)}>
                  <MediaThumb item={it} size="sm" />
                </button>
              </span>
            ))}
          </div>
        </footer>
      )}
    </Dialog>
  );
}

/** + / = zoom in, - / _ zoom out, 0 fit (images only); ← / → page. */
function keyAction(key: string, zoomable: boolean, zoom: LightboxZoom, move: (delta: -1 | 1) => void): (() => void) | null {
  if (key === "ArrowLeft") return () => move(-1);
  if (key === "ArrowRight") return () => move(1);
  if (!zoomable) return null;
  if (key === "+" || key === "=") return zoom.zoomIn;
  if (key === "-" || key === "_") return zoom.zoomOut;
  if (key === "0") return zoom.fitView;
  return null;
}

/** Floating toolbar: 缩小 · 100% · 放大 | 旋转 · 适应. */
function ZoomBar({ zoom }: { zoom: LightboxZoom }) {
  const percent = zoomPercent(zoom.scale);
  return (
    <div className="aui-lb-tools" role="toolbar" aria-label="缩放和旋转">
      <button type="button" className="aui-lb-btn" aria-label="缩小（-）" data-tip="缩小（-）" disabled={!zoom.canMin} onClick={zoom.zoomOut}>
        <ZoomOut aria-hidden="true" />
      </button>
      <button type="button" className="aui-lb-btn aui-lb-pct" aria-label={`当前 ${percent}%，点一下看原始大小`} data-tip="原始大小（100%）" onClick={() => zoom.actual()}>
        <span aria-live="polite">{percent}%</span>
      </button>
      <button type="button" className="aui-lb-btn" aria-label="放大（+）" data-tip="放大（+）" disabled={!zoom.canMax} onClick={zoom.zoomIn}>
        <ZoomIn aria-hidden="true" />
      </button>
      <i className="aui-lb-sep" aria-hidden="true" />
      <button type="button" className="aui-lb-btn" aria-label="向右旋转 90°" data-tip="旋转" onClick={zoom.rotate}>
        <RotateCw aria-hidden="true" />
      </button>
      <button type="button" className="aui-lb-btn" aria-label="适应屏幕（0）" data-tip="适应屏幕（0）" aria-pressed={zoom.fitted} onClick={zoom.fitView}>
        <Minimize2 aria-hidden="true" />
      </button>
    </div>
  );
}

function DefaultInfo({ item, caption }: { item: MediaItem; caption?: (item: MediaItem) => ReactNode }) {
  const kind = itemKind(item);
  const rows = useMemo(
    () =>
      [
        caption ? { term: "来自", value: caption(item) } : null,
        { term: "类型", value: KIND_LABEL[kind] },
        item.size != null ? { term: "大小", value: formatBytes(item.size) } : null,
        item.duration != null ? { term: "时长", value: formatDuration(item.duration) } : null,
        item.pages ? { term: "页数", value: `${item.pages} 页` } : null,
        item.meta ? { term: "上传", value: item.meta } : null,
      ].filter((row): row is { term: string; value: ReactNode } => row !== null),
    [item, caption, kind],
  );
  return (
    <dl>
      {rows.map((row) => (
        <div key={row.term}>
          <dt>{row.term}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
