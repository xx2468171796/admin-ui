"use client";
/**
 * The stage of the full-screen MediaLightbox: a zoomable / pannable / rotatable image
 * (useLightboxZoom: buttons, + / - / 0 keys, Ctrl + wheel, drag to pan when zoomed, double-click,
 * swipe left / right on phones), video, audio, PDF / preview frames and the fallback cards. Maths in
 * media-zoom.ts; styles in styles/media.css (media tokens only: the photo never follows the theme).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Download, ExternalLink, Lock, RotateCw } from "lucide-react";
import { AudioPlayer } from "./media-audio.tsx";
import { fileTypeLabel } from "./media-core.ts";
import { itemKind, MediaTypeIcon, type MediaItem } from "./media-parts.tsx";
import { mediaFailureText, type MediaErrorInfo } from "./media-source-core.ts";
import { useMediaSource } from "./media-source-hook.ts";
import { canPan, clampPan, clampZoom, fitScale, stepZoom, swipeIntent, wheelZoom, zoomAround, ZOOM_MAX, ZOOM_MIN, type ZoomPan, type ZoomSize } from "./media-zoom.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";

const NO_PAN: ZoomPan = { x: 0, y: 0 };

/** Room kept around the fitted picture: side buttons on desktop, the floating toolbar below. */
export type StageInsets = { x: number; top: number; bottom: number };

export type LightboxZoom = ReturnType<typeof useLightboxZoom>;

/**
 * Zoom state of the shown image. `scale` null = 「适应」 (follows the stage size and rotation); a number is
 * relative to the natural pixels. Resets when `key` (the item id) changes.
 */
export function useLightboxZoom(key: string, insets: StageInsets, minZoom = ZOOM_MIN, maxZoom = ZOOM_MAX) {
  // A callback ref: the dialog mounts its content after this hook first runs, so measure when the node appears.
  const [stage, stageRef] = useState<HTMLDivElement | null>(null);
  // Natural size is stored with the item it belongs to, so a stale size never applies to the next picture.
  const [loaded, setLoaded] = useState<{ key: string; size: ZoomSize } | null>(null);
  const natural = loaded?.key === key ? loaded.size : null;
  const setNatural = useCallback((size: ZoomSize) => setLoaded({ key, size }), [key]);
  const [room, setRoom] = useState<ZoomSize>({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState<number | null>(null);
  const [pan, setPan] = useState<ZoomPan>(NO_PAN);
  useLayoutEffect(() => {
    setRotation(0);
    setScale(null);
    setPan(NO_PAN);
  }, [key]);
  useLayoutEffect(() => {
    const el = stage;
    if (!el) return;
    const measure = () => setRoom({ width: Math.max(0, el.clientWidth - insets.x * 2), height: Math.max(0, el.clientHeight - insets.top - insets.bottom) });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stage, insets.x, insets.top, insets.bottom]);
  const fit = natural ? fitScale(natural, room, rotation) : 1;
  const shown = scale ?? fit;
  const apply = useCallback(
    (next: number, point?: ZoomPan) => {
      const target = clampZoom(next, minZoom, maxZoom);
      setPan((p) => (natural ? clampPan(zoomAround(p, shown, target, point), target, natural, room, rotation) : NO_PAN));
      setScale(Math.abs(target - fit) < 1e-3 ? null : target);
    },
    [minZoom, maxZoom, natural, shown, room, rotation, fit],
  );
  return {
    stage,
    stageRef,
    natural,
    setNatural,
    rotation,
    scale: shown,
    fit,
    fitted: scale === null,
    pan,
    pannable: Boolean(natural && canPan(shown, natural, room, rotation)),
    zoomIn: () => apply(stepZoom(shown, 1, minZoom, maxZoom)),
    zoomOut: () => apply(stepZoom(shown, -1, minZoom, maxZoom)),
    actual: (point?: ZoomPan) => apply(1, point),
    zoomTo: apply,
    wheel: (deltaY: number, point: ZoomPan) => apply(wheelZoom(shown, deltaY, minZoom, maxZoom), point),
    fitView: () => {
      setScale(null);
      setPan(NO_PAN);
    },
    rotate: () => {
      setRotation((r) => r + 90);
      setScale(null);
      setPan(NO_PAN);
    },
    panTo: (next: ZoomPan) => setPan(natural ? clampPan(next, shown, natural, room, rotation) : NO_PAN),
    canMin: shown > minZoom + 1e-3,
    canMax: shown < maxZoom - 1e-3,
  };
}

/** Pointer position relative to the centre of the image area (stage minus insets). */
function centred(stage: HTMLElement, insets: StageInsets, x: number, y: number): ZoomPan {
  const box = stage.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + insets.top + (box.height - insets.top - insets.bottom) / 2;
  return { x: x - cx, y: y - cy };
}

/** Ctrl + wheel (and trackpad pinch, which arrives as Ctrl + wheel) zooms around the pointer; needs a non-passive listener. */
function useCtrlWheel(el: HTMLElement | null, active: boolean, onWheel: (deltaY: number, x: number, y: number) => void) {
  const handler = useRef(onWheel);
  handler.current = onWheel;
  useEffect(() => {
    if (!el || !active) return;
    const listener = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      handler.current(event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY, event.clientX, event.clientY);
    };
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
  }, [el, active]);
}

export type LightboxStageProps = {
  item: MediaItem;
  zoom: LightboxZoom;
  insets: StageInsets;
  pdfPreview: "frame" | "poster";
  audioAction?: (item: MediaItem) => ReactNode;
  onDownload?: (item: MediaItem) => void;
  onOpenInNewWindow?: (item: MediaItem) => void;
  /** No address yet / gave up: 「重新加载」 asks the host to resolve the item again (see MediaLightboxProps). */
  onReload?: (item: MediaItem) => void | Promise<void>;
  /** Video / audio stopped loading: host returns a fresh link (re-sign) and playback resumes there. */
  onMediaError?: (item: MediaItem, info: MediaErrorInfo) => Promise<string | null | undefined>;
  /** Swipe / page: -1 previous, 1 next. */
  onPage: (delta: -1 | 1) => void;
};

/** The stage area: pointer handling (pan when zoomed, swipe otherwise) around the item's view. */
export function LightboxStage({ item, zoom, insets, onPage, ...view }: LightboxStageProps) {
  const kind = itemKind(item);
  const zoomable = kind === "image" && Boolean(item.url) && !item.lock?.denied;
  const drag = useRef<{ id: number; x: number; y: number; t: number; pan: ZoomPan; pannable: boolean; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  useCtrlWheel(zoom.stage, zoomable, (deltaY, x, y) => {
    if (zoom.stage) zoom.wheel(deltaY, centred(zoom.stage, insets, x, y));
  });
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button, a, video, audio, iframe, input, [role=slider]"))) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, pan: zoom.pan, pannable: zoomable && zoom.pannable, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId || !d.pannable) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    setDragging(true);
    zoom.panTo({ x: d.pan.x + dx, y: d.pan.y + dy });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || d.id !== event.pointerId || d.pannable) return;
    const intent = swipeIntent(event.clientX - d.x, event.clientY - d.y, event.timeStamp - d.t);
    if (intent) onPage(intent);
  };
  return (
    <div
      ref={zoom.stageRef}
      className="aui-lb-stage"
      data-kind={item.lock?.denied ? "locked" : kind}
      data-pannable={(zoomable && zoom.pannable) || undefined}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onDoubleClick={(event) => {
        if (!zoomable || !zoom.stage) return;
        const point = centred(zoom.stage, insets, event.clientX, event.clientY);
        if (zoom.scale < 1 - 1e-3) zoom.actual(point);
        else if (zoom.fitted) zoom.zoomTo(zoom.scale * 2, point);
        else zoom.fitView();
      }}
    >
      <div className="aui-lb-canvas" style={{ left: insets.x, right: insets.x, top: insets.top, bottom: insets.bottom }} aria-live="polite">
        <StageView item={item} zoom={zoom} {...view} />
      </div>
    </div>
  );
}

type ViewProps = Omit<LightboxStageProps, "insets" | "onPage">;

function StageView({ item, zoom, pdfPreview, audioAction, onDownload, onOpenInNewWindow, onReload, onMediaError }: ViewProps) {
  const kind = itemKind(item);
  if (item.lock?.denied)
    return (
      <div className="aui-lb-card">
        <span className="aui-lb-card-icon"><Lock aria-hidden="true" /></span>
        <b>你没有查看这个文件的权限</b>
        <span>{item.lock.label}{item.lock.hint ? `：${item.lock.hint}` : ""}</span>
      </div>
    );
  if (kind === "image" && item.url) {
    const n = zoom.natural;
    return (
      <img
        className="aui-lightbox-image"
        src={item.url}
        alt={item.name}
        draggable={false}
        data-ready={n ? true : undefined}
        onLoad={(e) => zoom.setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        style={n ? { width: n.width, height: n.height, transform: `translate(-50%, -50%) translate(${zoom.pan.x}px, ${zoom.pan.y}px) rotate(${zoom.rotation}deg) scale(${zoom.scale})` } : undefined}
      />
    );
  }
  const recover = onMediaError ? (info: MediaErrorInfo) => onMediaError(item, info) : undefined;
  if (kind === "video" && item.url) return <StageVideo key={item.id} item={item} recover={recover} onReload={onReload} onDownload={onDownload} />;
  if (kind === "audio" && item.url)
    return (
      <div className="aui-lightbox-audio">
        <AudioPlayer key={item.id} src={item.url} title={item.name} duration={item.duration} peaks={item.peaks} action={audioAction?.(item)} onMediaError={recover} />
      </div>
    );
  if (kind === "pdf" && item.url && pdfPreview === "frame") return <iframe className="aui-lightbox-frame" key={item.id} src={item.url} title={item.name} />;
  if (kind === "file" && item.previewUrl) return <iframe className="aui-lightbox-frame" key={item.id} src={item.previewUrl} title={item.name} />;
  // Poster / fallback card: thumbnail if there is one, else the type icon; actions to get the file.
  const missing = !item.url && (kind === "image" || kind === "video" || kind === "audio");
  const note = missing ? "还没有可预览的地址" : kind === "pdf" ? "在新窗口打开就能看全部页" : "这个类型不能在线预览，下载后用本机软件打开";
  return <StageCard key={item.id} item={item} note={note} onReload={missing && onReload ? () => onReload(item) : undefined} onDownload={onDownload} onOpenInNewWindow={onOpenInNewWindow} />;
}

/** Native-controls video; an error re-signs and resumes (useMediaSource), giving up shows the reason card. */
function StageVideo({ item, recover, onReload, onDownload }: { item: MediaItem; recover?: (info: MediaErrorInfo) => Promise<string | null | undefined>; onReload?: ViewProps["onReload"]; onDownload?: ViewProps["onDownload"] }) {
  const media = useMediaSource(item.url, recover);
  if (media.failure)
    return (
      <StageCard
        item={item}
        note={mediaFailureText(media.failure, "video")}
        failure={media.failure}
        onReload={media.failure === "network" ? () => (media.retry() ? undefined : onReload?.(item)) : undefined}
        onDownload={onDownload}
      />
    );
  return <video className="aui-lightbox-video" src={media.src} poster={item.thumbUrl} controls preload="metadata" aria-label={item.name} aria-busy={media.busy || undefined} {...media.events} />;
}

/** The card in the middle of the stage: poster (kept inside the stage) or type icon, name, note, actions. */
function StageCard({ item, note, failure, onReload, onDownload, onOpenInNewWindow }: { item: MediaItem; note: string; failure?: string; onReload?: () => void | Promise<void>; onDownload?: (item: MediaItem) => void; onOpenInNewWindow?: (item: MediaItem) => void }) {
  const [reloading, setReloading] = useState(false);
  const reload = onReload
    ? () => {
        setReloading(true);
        Promise.resolve(onReload())
          .catch(() => undefined)
          .finally(() => setReloading(false));
      }
    : undefined;
  return (
    <div className="aui-lb-card" data-failure={failure}>
      {item.thumbUrl ? (
        <img className="aui-lightbox-poster" src={item.thumbUrl} alt="" draggable={false} />
      ) : (
        <span className="aui-lb-card-icon">
          <MediaTypeIcon item={item} size={24} />
          {fileTypeLabel(item.name) && <small>{fileTypeLabel(item.name)}</small>}
        </span>
      )}
      <b>{item.name}</b>
      <span role={failure ? "alert" : undefined}>{note}</span>
      <span className="aui-lb-card-actions">
        {reload && (
          <button type="button" className="aui-lb-btn" data-text="" disabled={reloading} onClick={reload}>
            <RotateCw aria-hidden="true" />
            {reloading ? "正在重新加载…" : "重新加载"}
          </button>
        )}
        {onOpenInNewWindow && item.url && (
          <button type="button" className="aui-lb-btn" data-text="" onClick={() => onOpenInNewWindow(item)}>
            <ExternalLink aria-hidden="true" />
            在新窗口打开
          </button>
        )}
        {onDownload && (
          <button type="button" className="aui-lb-btn" data-text="" data-strong="" onClick={() => onDownload(item)}>
            <Download aria-hidden="true" />
            下载
          </button>
        )}
      </span>
    </div>
  );
}
