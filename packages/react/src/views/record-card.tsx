"use client";
/**
 * RecordCard (bt/views V2, review 08): one record as a card for kanban, gallery, the
 * calendar's undated drawer and phone lists. Five fixed slots, each optional and taking no row when
 * empty (never 「—」):
 *
 * 1. cover (16:10; the record's cover image / video poster via MediaThumb, or a neutral background with
 *    an image icon — no text, no illustration; 「图 N」 count bottom right; a button to the lightbox),
 * 2. title (14px bold, at most two lines; a small lock right of it for locked records; 「展开」 top right
 *    on hover),
 * 3. tag row (option-tone soft chips 20px, max 3 + 「+N」),
 * 4. key line (money / numbers bold and tabular, then secondary info joined with 「 · 」, one line),
 * 5. footer (owner avatar + name; comment count and the next follow-up pill: today = attention,
 *    overdue = danger 「逾期 N 天」, tomorrow 「明天」, else 「MM-DD」).
 *
 * No field names by default; `showLabels` turns the tag / key-line / extra fields into two aligned
 * columns (label · value). States: hover (darker line + light shadow), keyboard focus / selected
 * (primary line + the inputs' 3px focus ring), dragging (tilt + deep shadow), ghost (35%), locked,
 * loading (skeleton). The whole card is one click target (the title is a button stretched over the
 * card); the cover is a separate button when `onOpenCover` is given. Extra handlers (kanban drag /
 * keyboard move) go on the root through `rootProps`. Pure rules: record-card-core.ts.
 */
import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { Image as ImageIcon, Lock, Maximize2 } from "lucide-react";
import { MediaLightbox, type MediaLightboxProps } from "../media-lightbox.tsx";
import { cn } from "../primitives.tsx";
import { CellBudgetContext, type TableCellBudget } from "../cell-budget.ts";
import { renderGridCell } from "../grid-cells.tsx";
import { gridCellTone } from "../grid-cells-due.tsx";
import { useAdminDefaults } from "../admin-defaults-context.tsx";
import { fileTypeLabel } from "../media-core.ts";
import { itemKind, MediaThumb, type MediaItem } from "../media-parts.tsx";
import { SkeletonBlock } from "../loading.tsx";
import { tipProps } from "../tooltip.tsx";
import type { GridField } from "../grid-core.ts";
import { cardFieldEmpty, cardKeyline, cardTags } from "./record-card-core.ts";
import { CardFooter } from "./record-card-parts.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type RecordCardDensity = "compact" | "normal";
export type RecordCardProps<T> = {
  record: T;
  /** The record's name (primary field text). */
  title: string;
  /** Extra rows under the fixed slots, in order: plain value lines (labelled with `showLabels`); empty values take no row. */
  fields?: readonly GridField<T>[];
  /** Tag row: single / multi select values as option-tone chips (max 3 + 「+N」). */
  tags?: readonly GridField<T>[];
  /** Key line: money / numbers bold, then the rest joined with 「 · 」 on one line. */
  keyline?: readonly GridField<T>[];
  /** Footer left: avatar + name (first person of a user field). */
  owner?: GridField<T>;
  /** Footer right: the next follow-up pill (date / datetime field). */
  due?: GridField<T>;
  /** Footer right: comment count (hidden when 0 / empty). */
  comments?: number | ((record: T) => number | null | undefined);
  /** A small lock right of the title; a string is the reason (tooltip). */
  locked?: boolean | string;
  /** 「Today」 for the follow-up pill (DayKey 'YYYY-MM-DD'); default today in `timeZone`. */
  today?: string;
  /** Zone of `today` and of datetime follow-ups (default: AdminProvider `defaults.timeZone`, else the browser's). */
  timeZone?: string;
  /** 「展开」 top right on hover (default: `onOpen`). */
  onExpand?: () => void;
  /** Skeleton card. */
  loading?: boolean;
  /** The record's attachments; the cover is the one marked `cover`, else the first image / video, else the first. */
  attachments?: readonly MediaItem[] | null;
  /** Reserve the cover area even when there are no attachments (the view has a cover field). Default: when attachments are given. */
  showCover?: boolean;
  /** How the attachment count shows on the cover: dots (kanban) or 「图 N」 (gallery). */
  coverBadge?: "dots" | "count";
  /** Cover height in px (default: 16:10 of the card width). */
  coverHeight?: number;
  density?: RecordCardDensity;
  /** Field names in front of values, two aligned columns (default false: values only). */
  showLabels?: boolean;
  selected?: boolean;
  /** Lifted by a drag (the floating copy). */
  dragging?: boolean;
  /** Where a dragged card came from (faded). */
  ghost?: boolean;
  /** Open the record (record detail). */
  onOpen?: () => void;
  /** Open the attachment at `index` (lightbox). Without it the cover is not a button. */
  onOpenCover?: (index: number) => void;
  /** After the title (an extra badge). */
  titleAdornment?: ReactNode;
  /** Bottom slot, under the footer row. */
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  rootProps?: HTMLAttributes<HTMLElement> & Record<`data-${string}`, string | undefined>;
};
/** The slot fields a view passes through to every card (KanbanBoard / GalleryView `cardSlots`). */
export type RecordCardSlots<T> = Pick<RecordCardProps<T>, "tags" | "keyline" | "owner" | "due" | "comments">;

const ONE_LINE: TableCellBudget = { lines: 1, clamped: true, compact: true };

/** Index of the cover among the attachments (-1 when none). */
export function coverIndex(items: readonly MediaItem[] | null | undefined): number {
  if (!items?.length) return -1;
  const marked = items.findIndex((i) => i.cover && !i.lock?.denied);
  if (marked >= 0) return marked;
  const visual = items.findIndex((i) => !i.lock?.denied && (itemKind(i) === "image" || itemKind(i) === "video"));
  return visual >= 0 ? visual : 0;
}

function CardCover({ items, title, badge, height, onOpenCover }: { items: readonly MediaItem[]; title: string; badge: "dots" | "count"; height?: number; onOpenCover?: (index: number) => void }) {
  const cover = coverIndex(items);
  const coverItem = cover >= 0 ? items[cover] : undefined;
  const kind = coverItem ? itemKind(coverItem) : null;
  const body = (
    <>
      {coverItem ? (
        <MediaThumb item={{ ...coverItem, cover: false }} />
      ) : (
        <span className="aui-media-thumb aui-rcard-nocover" role="img" aria-label="没有图片">
          <ImageIcon aria-hidden="true" />
        </span>
      )}
      {coverItem && kind !== "image" && kind !== "video" && <span className="aui-rcard-type">{fileTypeLabel(coverItem.name) || "文件"}</span>}
      {items.length > 1 && badge === "dots" && (
        <span className="aui-rcard-dots" aria-hidden="true">
          {items.slice(0, 5).map((item, i) => <i key={item.id} data-on={i === cover || undefined} />)}
        </span>
      )}
      {items.length > 0 && badge === "count" && (
        <span className="aui-rcard-count">
          <ImageIcon aria-hidden="true" />
          {items.length}
        </span>
      )}
    </>
  );
  return (
    <div className="aui-rcard-cover" style={height ? { height, aspectRatio: "auto" } : undefined} data-kind={kind ?? undefined} data-empty={coverItem ? undefined : ""}>
      {onOpenCover && coverItem ? (
        <button type="button" className="aui-rcard-cover-button" aria-label={`预览「${title}」的附件（${items.length} 个）`} onClick={() => onOpenCover(cover)}>
          {body}
        </button>
      ) : (
        body
      )}
    </div>
  );
}

function CardSkeleton({ density, className, style }: { density: RecordCardDensity; className?: string; style?: CSSProperties }) {
  return (
    <article className={cn("aui-rcard", className)} data-density={density} data-loading="" aria-busy="true" aria-label="正在加载" style={style}>
      <div className="aui-rcard-body">
        <SkeletonBlock width="62%" height={12} />
        <SkeletonBlock width="86%" height={10} />
        <SkeletonBlock width="44%" height={10} />
      </div>
    </article>
  );
}

/** See the module comment. */
export function RecordCard<T>(props: RecordCardProps<T>) {
  const { record, title, fields = [], tags = [], keyline = [], owner, due, comments, locked, onExpand, loading, attachments, showCover, coverBadge = "dots", coverHeight, density = "normal", showLabels = false, selected, dragging, ghost, onOpen, onOpenCover, titleAdornment, footer, className, style, rootProps } = props;
  const defaultZone = useAdminDefaults().timeZone;
  const zone = props.timeZone ?? defaultZone;
  if (loading) return <CardSkeleton density={density} className={className} style={style} />;
  const items = attachments ?? [];
  const withCover = showCover ?? items.length > 0;
  const name = title || "未命名记录";
  const tagRow = showLabels ? null : cardTags(tags, record);
  const keyParts = showLabels ? [] : cardKeyline(keyline, record);
  const rows = (showLabels ? [...tags, ...keyline, ...fields] : fields).filter((field) => !cardFieldEmpty(field, record));
  const expand = onExpand ?? onOpen;
  const lockReason = typeof locked === "string" ? locked : "已锁定";
  return (
    <article
      {...rootProps}
      className={cn("aui-rcard", className)}
      data-density={density}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      data-ghost={ghost || undefined}
      data-locked={locked ? "" : undefined}
      style={style}
      aria-label={rootProps?.["aria-label"] ?? title}
    >
      {withCover && <CardCover items={items} title={name} badge={coverBadge} height={coverHeight} onOpenCover={onOpenCover} />}
      <div className="aui-rcard-body">
        <div className="aui-rcard-title">
          {onOpen ? (
            <button type="button" className="aui-rcard-open" onClick={onOpen}>
              {name}
            </button>
          ) : (
            <strong>{name}</strong>
          )}
          {locked && (
            <span className="aui-rcard-lock" role="img" aria-label={lockReason} {...tipProps(lockReason)}>
              <Lock aria-hidden="true" />
            </span>
          )}
          {titleAdornment}
          {expand && (
            <button
              type="button"
              className="aui-rcard-expand"
              aria-label={`展开「${name}」`}
              // Without its own handler it only repeats the title button: keep it out of the tab order and the a11y tree.
              {...(onExpand ? {} : { tabIndex: -1, "aria-hidden": true })}
              onClick={(e) => {
                e.stopPropagation();
                expand();
              }}
            >
              <Maximize2 aria-hidden="true" />
            </button>
          )}
        </div>
        {tagRow && tagRow.chips.length > 0 && (
          <span className="aui-rcard-tags" role="list" aria-label="标签">
            {tagRow.chips.map((chip) => (
              <span key={chip.key} role="listitem" className="aui-chip" data-tone={chip.tone}>
                <span className="aui-chip-label">{chip.label}</span>
              </span>
            ))}
            {tagRow.more > 0 && (
              <span role="listitem" className="aui-chip aui-chip-more" aria-label={`还有 ${tagRow.more} 个`}>
                +{tagRow.more}
              </span>
            )}
          </span>
        )}
        {keyParts.length > 0 && (
          <p className="aui-rcard-keyline" data-tip={keyParts.map((p) => p.text).join(" · ")}>
            {keyParts.map((part, i) => (
              <span key={part.key} data-strong={part.strong || undefined}>
                {i > 0 && <i aria-hidden="true"> · </i>}
                {part.text}
              </span>
            ))}
          </p>
        )}
        {rows.length > 0 && (
          <CellBudgetContext.Provider value={ONE_LINE}>
            <dl className="aui-rcard-fields" data-labels={showLabels || undefined}>
              {rows.map((field) => (
                <div key={field.key} className="aui-rcard-field">
                  {showLabels ? <dt>{field.title}</dt> : <dt className="aui-sr-only">{field.title}</dt>}
                  <dd data-tone={gridCellTone(field, record, zone)}>{renderGridCell(field, record)}</dd>
                </div>
              ))}
            </dl>
          </CellBudgetContext.Provider>
        )}
        <CardFooter record={record} owner={owner} due={due} comments={comments} today={props.today} timeZone={props.timeZone} />
        {footer}
      </div>
    </article>
  );
}

/** Lightbox options passed through by KanbanBoard / GalleryView (download, new window, caption …). */
export type CoverLightboxOptions = Pick<MediaLightboxProps, "onDownload" | "onOpenInNewWindow" | "caption" | "pdfPreview" | "audioAction">;
/** `open(items, index)` shows a record's attachments in MediaLightbox; render `element` once. */
export function useCoverLightbox(options: CoverLightboxOptions = {}): { open: (items: readonly MediaItem[], index: number, label?: string) => void; element: ReactNode } {
  const [state, setState] = useState<{ items: readonly MediaItem[]; index: number; label: string } | null>(null);
  return {
    open: (items, index, label = "附件预览") => setState({ items, index, label }),
    element: (
      <MediaLightbox
        open={Boolean(state)}
        items={state?.items ?? []}
        index={state?.index ?? 0}
        label={state?.label}
        onIndexChange={(index) => setState((s) => (s ? { ...s, index } : s))}
        onClose={() => setState(null)}
        {...options}
      />
    ),
  };
}
