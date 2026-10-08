"use client";
/**
 * GalleryView (bt/views V4, review 08): records as a responsive grid of RecordCards
 * with covers. One control line on top of the content: count · sort note | cover-field picker |
 * 紧凑 / 常规 | 字段名 switch. Auto columns of at least 236px (compact 184), gap 16; phones 2 columns
 * without field names and with the owner's avatar only. Without a chosen cover field the gallery
 * shows no cover when the table has no image / attachment field (`defaultCoverField`); a record
 * without an image gets a neutral cover with an icon. Clicking a card opens the record; clicking a
 * cover opens the record's attachments in MediaLightbox (or the host's `onOpenCover`). No results
 * under a filter: an empty state naming the filter + 「清空筛选」. Paging: `hasMore` + `onLoadMore`
 * (button + auto when the end scrolls into view), skeleton cards while loading and 「已显示 20 / 168」.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Image as ImageIcon, SearchX } from "lucide-react";
import { Button, Choice, Switch } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { StatePanel } from "../layout.tsx";
import type { GridField } from "../grid-core.ts";
import type { MediaItem } from "../media-parts.tsx";
import { RecordCard, useCoverLightbox, type CoverLightboxOptions, type RecordCardDensity, type RecordCardSlots } from "./record-card.tsx";
import { defaultCoverField, NO_COVER } from "./record-card-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type GalleryCoverOption = { value: string; label: string };
export type GalleryViewProps<T> = {
  records: readonly T[];
  recordId: (record: T) => string;
  cardTitle: (record: T) => string;
  /** Extra card rows (values only; labelled with `showLabels`). */
  cardFields?: readonly GridField<T>[];
  /** The card's fixed slots: tags, key line, owner, next follow-up, comments (RecordCard). */
  cardSlots?: RecordCardSlots<T>;
  /** Attachments of the current cover field for a record. */
  cardAttachments?: (record: T) => readonly MediaItem[] | null | undefined;
  /** Accessible name (「现场照片」). */
  label: string;
  /** Left of the top row: 「共 1,284 条 · 按「最后跟进」从新到旧」 (default 「共 N 条」 from `total`). */
  summary?: ReactNode;
  /** Image / attachment fields the cover can come from; with `onCoverFieldChange` shows the 封面 picker. 「none」 = no cover. */
  coverFields?: readonly GalleryCoverOption[];
  /** Current cover field; undefined = `defaultCoverField(coverFields)` (no cover when there is no image field). */
  coverField?: string;
  onCoverFieldChange?: (value: string) => void;
  density?: RecordCardDensity;
  onDensityChange?: (density: RecordCardDensity) => void;
  /** Field names on cards (default false); with `onShowLabelsChange` shows the 字段名 switch. */
  showLabels?: boolean;
  onShowLabelsChange?: (show: boolean) => void;
  /** 「Today」 of the follow-up pill (DayKey) and the zone it is read in. */
  today?: string;
  timeZone?: string;
  onOpen?: (record: T) => void;
  /** Host viewer for covers; default: the built-in MediaLightbox. */
  onOpenCover?: (record: T, index: number) => void;
  lightbox?: CoverLightboxOptions;
  selectedId?: string | null;
  /** All matching records (「已显示 20 / 168」 and the default summary). */
  total?: number;
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  /** Shown when there are no records (default 「没有记录」). */
  empty?: string;
  /** The active filter in words (「阶段 = 成交 · 区域 = 高雄」): no results then shows it with 「清空筛选」. */
  filterText?: ReactNode;
  onClearFilters?: () => void;
};

const SKELETONS = 4;

/** See the module comment. */
export function GalleryView<T>(props: GalleryViewProps<T>) {
  const { records, recordId, cardTitle, cardFields, cardSlots, cardAttachments, label, coverFields, onCoverFieldChange, density = "normal", onDensityChange, showLabels = false, onShowLabelsChange, onOpen, onOpenCover, lightbox, selectedId, total, hasMore, loading, onLoadMore, empty, filterText, onClearFilters } = props;
  const box = useCoverLightbox(lightbox);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadRef.current?.();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);
  // A host that passes attachments but no cover options keeps its cover (7.x behaviour).
  const coverField = props.coverField ?? (coverFields ? defaultCoverField(coverFields) : undefined);
  const withCover = Boolean(cardAttachments) && coverField !== NO_COVER;
  const summary = props.summary ?? (total !== undefined ? <>共 <b>{total.toLocaleString("zh-CN")}</b> 条</> : null);
  const filtered = records.length === 0 && !loading && Boolean(filterText || onClearFilters);
  return (
    <div className="aui-gallery aui-gallery-view" role="region" aria-label={label} data-density={density} aria-busy={loading || undefined}>
      {(summary || (coverFields && onCoverFieldChange) || onDensityChange || onShowLabelsChange) && (
        <div className="aui-gallery-bar">
          <span className="aui-gallery-summary">{summary}</span>
          <span className="aui-gallery-tools">
            {coverFields && onCoverFieldChange && (
              <span className="aui-gallery-cover">
                <ImageIcon size={14} aria-hidden="true" />
                <Choice label="封面字段" value={coverField ?? NO_COVER} onChange={onCoverFieldChange} options={[...coverFields.map((f) => ({ value: f.value, label: `封面：${f.label}` })), { value: NO_COVER, label: "不显示封面" }]} />
              </span>
            )}
            {onDensityChange && (
              <SegmentedControl
                size="sm"
                label="卡片密度"
                value={density}
                onValueChange={onDensityChange}
                options={[
                  { value: "compact", label: "紧凑" },
                  { value: "normal", label: "常规" },
                ]}
              />
            )}
            {onShowLabelsChange && (
              <label className="aui-gallery-labels">
                <Switch size="sm" checked={showLabels} onCheckedChange={onShowLabelsChange} aria-label="显示字段名" />
                字段名
              </label>
            )}
          </span>
        </div>
      )}
      {filtered ? (
        <div className="aui-gallery-noresult" role="status">
          <SearchX aria-hidden="true" />
          <strong>{empty ?? "没有符合筛选的记录"}</strong>
          {filterText && <span>当前筛选：{filterText}</span>}
          {onClearFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              清空筛选
            </Button>
          )}
        </div>
      ) : records.length === 0 && !loading ? (
        <StatePanel kind="empty" message={empty ?? "没有记录"} />
      ) : (
        <ul className="aui-gallery-grid" aria-label={`${label}的卡片`}>
          {records.map((record) => {
            const id = recordId(record);
            const items = withCover ? (cardAttachments?.(record) ?? null) : null;
            return (
              <li key={id} className="aui-gallery-item" data-card-id={id}>
                <RecordCard
                  record={record}
                  title={cardTitle(record)}
                  {...cardSlots}
                  fields={cardFields}
                  showLabels={showLabels}
                  today={props.today}
                  timeZone={props.timeZone}
                  attachments={items}
                  showCover={withCover}
                  coverBadge="count"
                  density={density}
                  selected={selectedId === id}
                  onOpen={onOpen ? () => onOpen(record) : undefined}
                  onOpenCover={items?.length ? (index) => (onOpenCover ? onOpenCover(record, index) : box.open(items, index, `「${cardTitle(record)}」的附件`)) : undefined}
                />
              </li>
            );
          })}
          {loading &&
            Array.from({ length: SKELETONS }, (_, i) => (
              <li key={`skeleton-${i}`} className="aui-gallery-item" aria-hidden="true">
                <RecordCard record={undefined} title="" loading density={density} />
              </li>
            ))}
        </ul>
      )}
      {(hasMore || (loading && records.length > 0)) && (
        <div ref={sentinel} className="aui-gallery-more">
          {total !== undefined && <span>已显示 {records.length.toLocaleString("zh-CN")} / {total.toLocaleString("zh-CN")}</span>}
          {hasMore && onLoadMore && (
            <Button variant="outline" size="sm" disabled={loading} onClick={onLoadMore}>
              {loading ? "加载中…" : "加载更多"}
            </Button>
          )}
        </div>
      )}
      {box.element}
    </div>
  );
}
