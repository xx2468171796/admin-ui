"use client";
/**
 * AttachmentGallery: the attachments of one record / field. Three modes:
 *   tiles — sections 图片和视频 (thumbnail tiles: cover / duration badges) · 音频 (AudioPlayer rows) · 文件
 *           (file cards: neutral type icon + label, lock on the grey second line, 预览);
 *   list  — one row per file (thumb, name, meta, lock, 预览 / 下载), selectable;
 *   strip — one compact line for record detail (small tiles, 「+N」, add tile).
 * Toolbar: 网格 / 列表 switch, selection count, 批量下载. Opens MediaLightbox itself unless the host
 * handles `onOpen`. Upload tile / slot, empty state, upload overlays on tiles. Styles: styles/media.css.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Download, Eye, LayoutGrid, List, Paperclip, Plus, RefreshCw, TriangleAlert, X } from "lucide-react";
import { Button, Checkbox, cn } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { AudioPlayer } from "./media-audio.tsx";
import { fileTypeLabel, firstViewableFrom, isViewableMedia } from "./media-core.ts";
import { MediaLightbox, type MediaLightboxProps } from "./media-lightbox.tsx";
import { UploadDropZone } from "./upload-queue.tsx";
import { FileName, itemKind, LockPill, MediaMeta, MediaThumb, MediaTypeIcon, UploadOverlay, type MediaItem } from "./media-parts.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/media.css";

export type AttachmentGalleryMode = "tiles" | "list" | "strip";
type Section = "visual" | "audio" | "file";

export type AttachmentGalleryProps = {
  items: readonly MediaItem[];
  /** Names the gallery for screen readers (field name: 「现场资料」). */
  label: string;
  mode?: AttachmentGalleryMode;
  defaultMode?: AttachmentGalleryMode;
  onModeChange?: (mode: "tiles" | "list") => void;
  /** Show the 网格 / 列表 switch, count and 批量下载 row (tiles / list only). Default true. */
  toolbar?: boolean;
  /** Extra buttons at the right of the toolbar. */
  toolbarExtra?: ReactNode;
  /** Section hints right of the section titles (「点开大图，左右切换、旋转、下载」). */
  sectionHints?: Partial<Record<Section, ReactNode>>;
  /** Selection for batch download (controlled when `selected` is given). */
  selectable?: boolean;
  selected?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Download: one item (tile / row / lightbox) or the batch (selected, or every allowed item). */
  onDownload?: (items: MediaItem[]) => void;
  /** Take over opening (host shows its own viewer); default opens the built-in MediaLightbox. */
  onOpen?: (item: MediaItem, index: number) => void;
  onOpenInNewWindow?: (item: MediaItem) => void;
  /** Lightbox caption under the big preview. */
  caption?: (item: MediaItem) => ReactNode;
  /** Action slot on audio players (「转文字」). */
  audioAction?: (item: MediaItem) => ReactNode;
  /** Built-in lightbox: 「重新加载」 for an item without an address (MediaLightboxProps.onReload). */
  onReload?: MediaLightboxProps["onReload"];
  /** Built-in lightbox: fresh link for a video / audio that stopped loading (MediaLightboxProps.onMediaError). */
  onMediaError?: MediaLightboxProps["onMediaError"];
  /** Remove an item (✕ on failed uploads and on tiles in edit mode). */
  onRemove?: (item: MediaItem) => void;
  /** Add tile / row: 「＋」 that opens the host's picker. */
  onAdd?: () => void;
  addLabel?: string;
  /** Text after the add tile in strip mode (「拖文件到这里上传」). */
  addHint?: ReactNode;
  /** Drop zone / UploadQueue placed above the sections (tiles / list). */
  uploadSlot?: ReactNode;
  /** Strip mode: tiles before 「+N」. Default 6. */
  maxVisible?: number;
  /** Empty state text (the drop zone's bold line when `onFiles` is given). */
  empty?: ReactNode;
  /**
   * Files dropped / picked while the gallery is empty: the empty state becomes the one drop zone (* never a drop zone plus a second 「还没有文件」 box). With `uploadSlot` the slot is the only thing shown when empty.
   */
  onFiles?: (files: FileList) => void;
  /** Buttons next to 选择文件 in that empty drop zone (拍照 / 录音 — the host wires them). */
  emptyActions?: ReactNode;
  /** Limits for that drop zone's hint (「图片、视频，单个 2 GB 以内」). */
  accept?: readonly string[];
  maxBytes?: number;
  className?: string;
};

export function AttachmentGallery(props: AttachmentGalleryProps) {
  const { items, label, toolbar = true, selectable, onDownload, onOpen, empty = "还没有附件", className, uploadSlot } = props;
  const [ownMode, setOwnMode] = useState<AttachmentGalleryMode>(props.defaultMode ?? "tiles");
  const mode = props.mode ?? ownMode;
  const [ownSelected, setOwnSelected] = useState<readonly string[]>([]);
  const selected = props.selected ?? ownSelected;
  const setSelected = (ids: string[]) => {
    if (!props.selected) setOwnSelected(ids);
    props.onSelectedChange?.(ids);
  };
  const [viewing, setViewing] = useState<number | null>(null);
  // The lightbox walks the openable items only (not locked-out, not still uploading).
  const viewable = useMemo(() => items.filter(isViewableMedia), [items]);
  const open = (item: MediaItem) => {
    const at = viewable.findIndex((i) => i.id === item.id);
    if (at < 0) return;
    if (onOpen) onOpen(item, at);
    else setViewing(at);
  };
  const downloadable = items.filter((i) => !i.lock?.denied && !i.upload);
  const pickedItems = downloadable.filter((i) => selected.includes(i.id));
  const ctx: Ctx = { ...props, mode, selected, setSelected, open };

  return (
    <div className={cn("aui-gallery", className)} data-mode={mode} data-filled={items.length > 0 || undefined} data-selecting={pickedItems.length > 0 || undefined} role="group" aria-label={label}>
      {toolbar && mode !== "strip" && (
        <div className="aui-gallery-bar">
          <SegmentedControl
            size="sm"
            label="显示方式"
            value={mode}
            onValueChange={(v) => {
              const next = v === "list" ? "list" : "tiles";
              setOwnMode(next);
              props.onModeChange?.(next);
            }}
            options={[
              { value: "tiles", label: "网格", icon: LayoutGrid },
              { value: "list", label: "列表", icon: List },
            ]}
          />
          <span className="aui-gallery-count">
            {selectable && pickedItems.length ? `已选 ${pickedItems.length} 个` : `${items.length} 个`}
          </span>
          <span className="aui-gallery-bar-end">
            {selectable && pickedItems.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                取消选择
              </Button>
            )}
            {props.toolbarExtra}
            {onDownload && (
              <Button variant="outline" size="sm" disabled={!downloadable.length} onClick={() => onDownload(pickedItems.length ? pickedItems : downloadable)}>
                <Download />
                {pickedItems.length ? `下载选中（${pickedItems.length}）` : "批量下载"}
              </Button>
            )}
          </span>
        </div>
      )}
      {mode !== "strip" && uploadSlot}
      {items.length === 0 && !props.onAdd ? (
        uploadSlot && mode !== "strip" ? null : props.onFiles ? (
          <UploadDropZone className="aui-gallery-drop" title={empty} accept={props.accept} maxBytes={props.maxBytes} actions={props.emptyActions} icon={<Paperclip aria-hidden="true" />} onFiles={props.onFiles} />
        ) : (
          <div className="aui-gallery-empty" role="status">{empty}</div>
        )
      ) : mode === "strip" ? (
        <StripView ctx={ctx} />
      ) : mode === "list" ? (
        <ListView ctx={ctx} />
      ) : (
        <TilesView ctx={ctx} />
      )}
      {!onOpen && (
        <MediaLightbox
          open={viewing != null}
          items={viewable}
          index={viewing ?? 0}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onDownload={onDownload ? (i) => onDownload([i]) : undefined}
          onOpenInNewWindow={props.onOpenInNewWindow}
          caption={props.caption}
          audioAction={props.audioAction}
          onReload={props.onReload}
          onMediaError={props.onMediaError}
        />
      )}
    </div>
  );
}

type Ctx = AttachmentGalleryProps & {
  mode: AttachmentGalleryMode;
  selected: readonly string[];
  setSelected: (ids: string[]) => void;
  open: (item: MediaItem) => void;
};

function section(item: MediaItem): Section {
  const kind = itemKind(item);
  return kind === "image" || kind === "video" ? "visual" : kind === "audio" ? "audio" : "file";
}

function SelectBox({ ctx, item }: { ctx: Ctx; item: MediaItem }) {
  if (!ctx.selectable || item.lock?.denied || item.upload) return null;
  const checked = ctx.selected.includes(item.id);
  return (
    <span className="aui-media-select">
      <Checkbox
        checked={checked}
        aria-label={`选择 ${item.name}`}
        onCheckedChange={(next) => ctx.setSelected(next === true ? [...ctx.selected, item.id] : ctx.selected.filter((id) => id !== item.id))}
      />
    </span>
  );
}

function AddTile({ ctx, size }: { ctx: Ctx; size: "sm" | "md" }) {
  if (!ctx.onAdd) return null;
  return (
    <button type="button" className="aui-media-add" data-size={size} onClick={ctx.onAdd} aria-label={ctx.addLabel ?? "添加附件"}>
      <Plus aria-hidden="true" />
      {size === "md" && <span>{ctx.addLabel ?? "添加附件"}</span>}
    </button>
  );
}

/** A visual tile: thumbnail + name + meta, upload overlay, selection box. */
function Tile({ ctx, item }: { ctx: Ctx; item: MediaItem }) {
  const denied = item.lock?.denied;
  const failed = item.upload?.state === "failed";
  return (
    <div className="aui-media-tile" data-denied={denied || undefined} data-failed={failed || undefined} data-selected={ctx.selected.includes(item.id) || undefined}>
      {failed ? (
        <span className="aui-media-failed">
          <TriangleAlert aria-hidden="true" />
          <b>上传失败</b>
          {item.upload?.onRetry && (
            <Button variant="outline" size="sm" onClick={item.upload.onRetry}>
              <RefreshCw />
              重试
            </Button>
          )}
        </span>
      ) : (
        <button type="button" className="aui-media-open" disabled={denied || Boolean(item.upload)} aria-label={denied ? `${item.name}（${item.lock?.label ?? "没有权限"}）` : `预览 ${item.name}`} data-tip={denied ? item.lock?.hint : undefined} onClick={() => ctx.open(item)}>
          <MediaThumb item={item} />
        </button>
      )}
      {item.upload && <UploadOverlay upload={item.upload} />}
      <span className="aui-media-meta">
        <b data-tip={item.name}><FileName name={item.name} /></b>
        <small>
          {failed ? <span className="aui-media-error">{item.upload?.error ?? "上传失败"}</span> : item.upload?.detail ?? (denied && item.lock ? item.lock.label : <MediaMeta item={item} />)}
        </small>
        {item.upload?.state === "uploading" && item.upload.onCancel && (
          <Button variant="text" size="sm" className="aui-media-cancel" onClick={item.upload.onCancel}>
            取消
          </Button>
        )}
        {(failed || (item.upload && !item.upload.onCancel)) && ctx.onRemove && (
          <IconButton label={`移除 ${item.name}`} size="sm" className="aui-media-cancel" onClick={() => ctx.onRemove?.(item)} icon={<X />} />
        )}
      </span>
      <SelectBox ctx={ctx} item={item} />
    </div>
  );
}

function FileCard({ ctx, item }: { ctx: Ctx; item: MediaItem }) {
  const denied = item.lock?.denied;
  const type = fileTypeLabel(item.name);
  return (
    <div className="aui-media-file" data-denied={denied || undefined} data-selected={ctx.selected.includes(item.id) || undefined}>
      <SelectBox ctx={ctx} item={item} />
      <span className="aui-media-type" aria-hidden="true">
        <MediaTypeIcon item={item} size={15} />
        {type && <small>{type}</small>}
      </span>
      <span className="aui-media-file-text">
        <span className="aui-media-file-name">
          <b data-tip={item.name}><FileName name={item.name} /></b>
        </span>
        <small>
          {item.lock && <LockPill lock={item.lock} />}
          {item.lock && " · "}
          <MediaMeta item={item} />
        </small>
      </span>
      {!denied && !item.upload && (
        <Button variant="outline" size="sm" onClick={() => ctx.open(item)} aria-label={`预览 ${item.name}`}>
          <Eye />
          预览
        </Button>
      )}
    </div>
  );
}

function TilesView({ ctx }: { ctx: Ctx }) {
  const groups: { key: Section; title: string; items: MediaItem[] }[] = [
    { key: "visual", title: "图片和视频", items: ctx.items.filter((i) => section(i) === "visual") },
    { key: "audio", title: "音频", items: ctx.items.filter((i) => section(i) === "audio") },
    { key: "file", title: "文件", items: ctx.items.filter((i) => section(i) === "file") },
  ];
  return (
    <div className="aui-gallery-sections">
      {groups.map((g) =>
        g.items.length || (g.key === "visual" && ctx.onAdd) ? (
          <section key={g.key} className="aui-gallery-section" aria-label={g.title}>
            <h4>
              {g.title}
              <span className="aui-count">{g.items.length}</span>
              {ctx.sectionHints?.[g.key] && <small>{ctx.sectionHints[g.key]}</small>}
            </h4>
            {g.key === "visual" ? (
              <div className="aui-media-tiles">
                {g.items.map((item) => (
                  <Tile key={item.id} ctx={ctx} item={item} />
                ))}
                <AddTile ctx={ctx} size="md" />
              </div>
            ) : g.key === "audio" ? (
              <div className="aui-media-audios">
                {g.items.map((item) =>
                  item.url && !item.lock?.denied ? (
                    <div key={item.id} className="aui-media-audio-row">
                      <SelectBox ctx={ctx} item={item} />
                      <AudioPlayer
                        src={item.url}
                        title={item.name}
                        subtitle={<MediaMeta item={{ ...item, size: undefined }} />}
                        duration={item.duration}
                        peaks={item.peaks}
                        action={ctx.audioAction?.(item)}
                        onDownload={ctx.onDownload ? () => ctx.onDownload?.([item]) : undefined}
                      />
                    </div>
                  ) : (
                    <FileCard key={item.id} ctx={ctx} item={item} />
                  ),
                )}
              </div>
            ) : (
              <div className="aui-media-files">
                {g.items.map((item) => (
                  <FileCard key={item.id} ctx={ctx} item={item} />
                ))}
              </div>
            )}
          </section>
        ) : null,
      )}
    </div>
  );
}

function ListView({ ctx }: { ctx: Ctx }) {
  return (
    <ul className="aui-media-list">
      {ctx.items.map((item) => {
        const denied = item.lock?.denied;
        return (
          <li key={item.id} className="aui-media-row" data-denied={denied || undefined} data-selected={ctx.selected.includes(item.id) || undefined}>
            <SelectBox ctx={ctx} item={item} />
            <MediaThumb item={item} size="sm" showPlay={false} />
            <span className="aui-media-file-text">
              <span className="aui-media-file-name">
                <b data-tip={item.name}><FileName name={item.name} /></b>
              </span>
              <small>
                {item.lock && !item.upload && (
                  <>
                    <LockPill lock={item.lock} />
                    {" · "}
                  </>
                )}
                {item.upload?.state === "failed" ? <span className="aui-media-error">{item.upload.error ?? "上传失败"}</span> : item.upload?.state === "uploading" ? `上传中 ${Math.round(item.upload.progress ?? 0)}%` : <MediaMeta item={item} />}
              </small>
            </span>
            <span className="aui-media-row-actions">
              {!denied && !item.upload && (
                <Button variant="ghost" size="sm" onClick={() => ctx.open(item)} aria-label={`预览 ${item.name}`}>
                  <Eye />
                  预览
                </Button>
              )}
              {!denied && !item.upload && ctx.onDownload && (
                <IconButton label={`下载 ${item.name}`} size="sm" onClick={() => ctx.onDownload?.([item])} icon={<Download />} />
              )}
              {item.upload?.state === "failed" && item.upload.onRetry && (
                <Button variant="outline" size="sm" onClick={item.upload.onRetry}>
                  <RefreshCw />
                  重试
                </Button>
              )}
            </span>
          </li>
        );
      })}
      {ctx.onAdd && (
        <li className="aui-media-row" data-add>
          <Button variant="ghost" size="sm" onClick={ctx.onAdd}>
            <Plus />
            {ctx.addLabel ?? "添加附件"}
          </Button>
        </li>
      )}
    </ul>
  );
}

function StripView({ ctx }: { ctx: Ctx }) {
  const max = Math.max(1, ctx.maxVisible ?? 6);
  const shown = ctx.items.slice(0, max);
  const rest = ctx.items.length - shown.length;
  // 「+N」 opens the first hidden item the lightbox can show (a locked / uploading one would do nothing).
  const moreAt = rest > 0 ? firstViewableFrom(ctx.items, max) : -1;
  const moreItem = moreAt >= 0 ? ctx.items[moreAt] : undefined;
  return (
    <div className="aui-media-strip">
      {shown.map((item) => {
        const kind = itemKind(item);
        const denied = item.lock?.denied;
        const isFile = kind === "pdf" || kind === "file" || kind === "audio";
        return (
          <button
            type="button"
            key={item.id}
            className="aui-media-chip"
            data-file={isFile || undefined}
            disabled={denied || Boolean(item.upload)}
            data-tip={denied ? (item.lock?.hint ?? item.lock?.label) : item.name}
            aria-label={denied ? `${item.name}（${item.lock?.label ?? "没有权限"}）` : `预览 ${item.name}`}
            onClick={() => ctx.open(item)}
          >
            {isFile && !item.thumbUrl ? (
              <span className="aui-media-chip-file">
                <small>{fileTypeLabel(item.name) || <MediaTypeIcon item={item} size={14} />}</small>
                <span>{item.name.replace(/\.[^.]+$/, "")}</span>
              </span>
            ) : (
              <MediaThumb item={item} size="sm" />
            )}
          </button>
        );
      })}
      {rest > 0 && (
        <button type="button" className="aui-media-chip" data-more aria-label={moreItem ? `还有 ${rest} 个，打开预览` : `还有 ${rest} 个，暂时都不能预览`} disabled={!moreItem} onClick={() => moreItem && ctx.open(moreItem)}>
          +{rest}
        </button>
      )}
      <AddTile ctx={ctx} size="sm" />
      {ctx.onAdd && ctx.addHint && <span className="aui-media-strip-hint">{ctx.addHint}</span>}
    </div>
  );
}
