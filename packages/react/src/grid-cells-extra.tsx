"use client";
/**
 * Cells of BitableGrid's extra field types (bt/grid-b, G12): rating stars, progress bar, masked phone
 * with a reveal button, auto numbers, system fields, formula results, attachments (thumbnails, file
 * chips or the mini audio player; click opens the MediaLightbox or the host), linked-record chips and
 * lookup values. Every renderer is the same in the grid (clamped) and in the record dialog.
 */
import { formatPhoneDisplay } from "./number-input-core.ts";
import { Suspense, useState, type ReactNode } from "react";
import {
  CalendarCog,
  CalendarPlus,
  Eye,
  EyeOff,
  FileSearch,
  Gauge,
  Link2,
  ListOrdered,
  Paperclip,
  Percent,
  Phone,
  Sigma,
  Star,
  UserPen,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Rating } from "./atoms.tsx";
import { PercentBar } from "./number-inputs.tsx";
import { CellPeople, CellTags } from "./cells.tsx";
import { CellDate } from "./displays.tsx";
import type { AudioPlayerProps } from "./media-audio.tsx";
import type { MediaLightboxProps } from "./media-lightbox.tsx";
import { lazyPart } from "./lazy-part.ts";
import { itemKind, MediaThumb } from "./media-parts.tsx";
import { toPeople, valueText, type GridField } from "./grid-core.ts";
import {
  coreType,
  maskPhone,
  progressText,
  toAttachments,
  toLookupTexts,
  toPercent,
  toProgress,
  toRating,
  toRecordRefs,
  type GridExtraFieldType,
  type GridRecordRef,
} from "./grid-field-types.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export const GRID_EXTRA_FIELD_ICONS: Readonly<Record<GridExtraFieldType, LucideIcon>> = {
  rating: Star,
  progress: Gauge,
  percent: Percent,
  phone: Phone,
  autoNumber: ListOrdered,
  createdBy: UserPlus,
  modifiedBy: UserPen,
  createdAt: CalendarPlus,
  modifiedAt: CalendarCog,
  formula: Sigma,
  attachment: Paperclip,
  link: Link2,
  lookup: FileSearch,
};

const empty = <span className="aui-cell-empty">—</span>;

/** Progress bar + percentage (value 0–100). */
export function GridProgress({ value, precision }: { value: number | null; precision?: number }) {
  if (value === null) return empty;
  return (
    <span className="aui-grid-progress" role="img" aria-label={`进度 ${progressText(value, precision)}`}>
      <span className="aui-grid-progress-track" aria-hidden="true"><span className="aui-grid-progress-fill" style={{ width: `${value}%` }} /></span>
      <span className="aui-grid-progress-text" aria-hidden="true">{progressText(value, precision)}</span>
    </span>
  );
}

/**
 * Masked value with an eye button: the host's `onReveal(row)` loads the full value (and writes the
 * audit log); shown until the row scrolls away or the eye is pressed again.
 */
export function GridMaskedValue({ text, reveal, label }: { text: string; reveal?: () => string | Promise<string>; label: string }) {
  const [full, setFull] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  if (!text) return empty;
  const toggle = async () => {
    if (full !== null) return setFull(null);
    if (!reveal) return;
    setState("busy");
    try {
      setFull(await reveal());
      setState("idle");
    } catch {
      setState("error");
    }
  };
  return (
    <span className="aui-grid-masked" data-revealed={full !== null || undefined}>
      <span className="aui-grid-masked-text" data-tip={state === "error" ? "无权查看或加载失败" : undefined}>{full ?? text}</span>
      {reveal && (
        <button type="button" className="aui-grid-cell-icon" aria-label={full !== null ? `隐藏${label}` : state === "error" ? `查看完整${label}失败，重试` : `查看完整${label}`} aria-pressed={full !== null}
          disabled={state === "busy"} onClick={(event) => { event.stopPropagation(); void toggle(); }}>
          {full !== null ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      )}
    </span>
  );
}

// Not on the grid's first paint: the lightbox loads on the first click, the mini audio player when an audio cell
// renders (its thumbnail stands in until then).
const lightboxPart = lazyPart(() => import("./media-lightbox.tsx").then((m) => m.MediaLightbox));
const MediaLightbox = lightboxPart.Part as (props: MediaLightboxProps) => ReactNode;
const audioPart = lazyPart(() => import("./media-audio.tsx").then((m) => m.AudioPlayer));
const AudioPlayer = audioPart.Part as (props: AudioPlayerProps) => ReactNode;

/**
 * Attachment cell: a mini audio player when the first file is audio (「+N」 more), else thumbnails /
 * type tiles; clicking a tile opens the built-in MediaLightbox (or `open(index)` from the host).
 */
export function GridAttachments({ items, label, open }: { items: ReturnType<typeof toAttachments>; label: string; open?: (index: number) => void }) {
  const [shown, setShown] = useState<number | null>(null);
  // Mounted from the first open on (so closing still animates), loaded then.
  const [used, setUsed] = useState(false);
  if (!items.length) return empty;
  const first = items[0]!;
  const openAt = (index: number) => {
    if (open) return open(index);
    setUsed(true);
    setShown(index);
  };
  const lightbox = !open && used && (
    <Suspense fallback={null}>
      <MediaLightbox open={shown !== null} items={items} index={shown ?? 0} onIndexChange={setShown} onClose={() => setShown(null)} label={label} />
    </Suspense>
  );
  if (itemKind(first) === "audio" && first.url && !first.lock?.denied)
    return (
      <span className="aui-grid-attachments" data-audio>
        <Suspense fallback={<MediaThumb item={first} size="sm" />}>
          <AudioPlayer variant="mini" src={first.url} title={first.name} duration={first.duration} peaks={first.peaks} miniExtra={items.length > 1 ? `+${items.length - 1}` : undefined} />
        </Suspense>
      </span>
    );
  const visible = items.slice(0, 4);
  return (
    <span className="aui-grid-attachments" role="list" aria-label={`${label}：${items.length} 个文件`} onPointerEnter={open ? undefined : lightboxPart.preload}>
      {visible.map((item, index) => (
        <button key={item.id} type="button" role="listitem" className="aui-grid-attachment" data-tip={item.name} aria-label={`打开 ${item.name}`} onClick={(event) => { event.stopPropagation(); openAt(index); }}>
          <MediaThumb item={item} size="sm" showPlay={itemKind(item) === "video"} />
        </button>
      ))}
      {items.length > visible.length && <span className="aui-grid-attachment-more" aria-hidden="true">+{items.length - visible.length}</span>}
      {lightbox}
    </span>
  );
}

/** Linked-record chips; with `open` they are buttons that open the record. */
export function GridRefChips({ refs, label, open }: { refs: readonly GridRecordRef[]; label: string; open?: (ref: GridRecordRef) => void }) {
  if (!refs.length) return empty;
  if (!open) return <CellTags label={label} items={refs.map((ref) => ({ label: ref.title, tone: "teal" as const }))} />;
  return (
    <span className="aui-grid-refs" role="list" aria-label={label}>
      {refs.map((ref) => (
        <button key={ref.id} type="button" role="listitem" className="aui-chip aui-grid-ref" data-tone="teal" data-tip={ref.hint ? `${ref.title} · ${ref.hint}` : ref.title}
          onClick={(event) => { event.stopPropagation(); open(ref); }}>
          <span className="aui-chip-label">{ref.title}</span>
        </button>
      ))}
    </span>
  );
}

type Renderer = (value: unknown, field: GridField<never>, row?: unknown) => ReactNode;
const formulaRenderer: Renderer = (value, field) => {
  const type = coreType(field);
  if (type === "date" || type === "datetime") return <CellDate value={value as string | null} time={type === "datetime"} timeZone={field.timeZone} />;
  const text = valueText(field, value);
  return text ? <span className="aui-grid-text" data-tip={text} data-tip-truncated="">{text}</span> : empty;
};

/** Renderers of the extra types, merged into GRID_CELL_RENDERERS. `row` is passed by renderGridCell. */
export const GRID_EXTRA_CELL_RENDERERS: { readonly [K in GridExtraFieldType]: Renderer } = {
  rating: (value, field) => {
    const stars = toRating(value, field.max ?? 5);
    return stars === null ? empty : <Rating value={stars} max={field.max ?? 5} label={field.title} />;
  },
  progress: (value, field) => <GridProgress value={toProgress(value)} precision={field.precision} />,
  // 「60%」 with the 56px bar before it, right-aligned like numbers (percentBar: false = text only)
  percent: (value, field) => <PercentBar className="aui-grid-pct" value={toPercent(value)} precision={field.precision} bar={field.percentBar !== false} label={field.title} />,
  phone: (value, field, row) => {
    const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
    // stored E.164 reads the local way for the field's country (138 0013 8000), else
    // international without the trunk 0 (+44 7700 900123); masks still apply.
    const shown = formatPhoneDisplay(raw, { home: field.phoneCountry });
    const masked = field.mask ? maskPhone(shown, field.mask) : shown;
    const reveal = field.onReveal && row !== undefined ? () => field.onReveal!(row as never) : undefined;
    return field.mask || reveal ? <GridMaskedValue key={raw} text={masked} reveal={reveal} label={field.title} /> : raw ? <span className="aui-grid-text">{shown}</span> : empty;
  },
  autoNumber: (value, field) => valueText(field, value) || empty,
  createdBy: (value, field) => <CellPeople label={field.title} people={toPeople(value)} />,
  modifiedBy: (value, field) => <CellPeople label={field.title} people={toPeople(value)} />,
  createdAt: (value, field) => <CellDate value={value as string | null} time timeZone={field.timeZone} />,
  modifiedAt: (value, field) => <CellDate value={value as string | null} time timeZone={field.timeZone} />,
  formula: formulaRenderer,
  attachment: (value, field, row) => (
    <GridAttachments items={toAttachments(value)} label={field.title} open={field.openAttachment && row !== undefined ? (index) => field.openAttachment!(row as never, index) : undefined} />
  ),
  link: (value, field, row) => <GridRefChips refs={toRecordRefs(value)} label={field.title} open={field.openRef && row !== undefined ? (ref) => field.openRef!(ref, row as never) : undefined} />,
  lookup: (value, field) => {
    const texts = toLookupTexts(value);
    return texts.length ? <CellTags label={field.title} items={texts.map((text) => ({ label: text }))} /> : empty;
  },
};

