"use client";
/**
 * TranscriptViewer's header and side pieces (review 07 item 7): the search box, the 「导出 ⌄」
 * dropdown in the header (format · 带时间 / 说话人 / AI 标注 · 导出 / 复制全文 · 「导出也是打码后的」 — it
 * replaced the big export card of the side rail), and the side rail sections (AI 摘要 + clickable times,
 * 说话占比 bar, 标注 counts).
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Copy, Download, Search, ShieldCheck, X } from "lucide-react";
import { Button, Checkbox, Input } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { PopoverPanel } from "./popover-panel.tsx";
import { formatDuration } from "./media-core.ts";
import { speakerColors, type TalkShare, type TranscriptCategory, type TranscriptSpeaker } from "./transcript-core.ts";
import type { OptionHue } from "./option-palette.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/transcript.css";

export type TranscriptSummary = { text?: ReactNode; points?: readonly { time: number; text: ReactNode }[] };
export type TranscriptExportOptions = { format: string; withTime: boolean; withSpeaker: boolean; withAnnotations: boolean };

export function SummaryBody({ summary, seek }: { summary: TranscriptSummary; seek: (time: number) => void }) {
  return (
    <>
      {summary.text && <p>{summary.text}</p>}
      {summary.points?.length ? (
        <ul className="aui-tx-points">
          {summary.points.map((point) => (
            <li key={point.time}>
              <button type="button" className="aui-tx-stamp" aria-label={`跳到 ${formatDuration(point.time)}`} onClick={() => seek(point.time)}>{formatDuration(point.time)}</button>
              <span>{point.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function SearchBox({ query, setQuery, onKey, count, active, step }: { query: string; setQuery: (v: string) => void; onKey: (e: KeyboardEvent<HTMLInputElement>) => void; count: number; active: number; step: (dir: 1 | -1) => void }) {
  return (
    <span className="aui-tx-search" role="search">
      <Search aria-hidden="true" />
      <Input className="aui-tx-search-input" value={query} placeholder="在文字稿里搜" aria-label="在文字稿里搜" onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
      {query && (
        <>
          <span className="aui-tx-search-count" aria-live="polite">{count ? `${active + 1} / ${count}` : "没有找到"}</span>
          <button type="button" className="aui-tx-search-btn" aria-label="上一个" disabled={!count} onClick={() => step(-1)}><ChevronUp aria-hidden="true" /></button>
          <button type="button" className="aui-tx-search-btn" aria-label="下一个" disabled={!count} onClick={() => step(1)}><ChevronDown aria-hidden="true" /></button>
          <button type="button" className="aui-tx-search-btn" aria-label="清空搜索" onClick={() => setQuery("")}><X aria-hidden="true" /></button>
        </>
      )}
    </span>
  );
}

export function TalkShareBar({ shares, speakers, toneOf }: { shares: readonly TalkShare[]; speakers: ReadonlyMap<string, TranscriptSpeaker>; toneOf: (id: string) => OptionHue }) {
  const name = (id: string) => speakers.get(id)?.name ?? id;
  const color = (id: string) => speakerColors(toneOf(id)).color;
  return (
    <div className="aui-tx-share" role="img" aria-label={`说话占比：${shares.map((s) => `${name(s.speaker)} ${s.percent}%`).join("，")}`}>
      <span className="aui-tx-share-bar" aria-hidden="true">
        {shares.filter((s) => s.percent > 0).map((s) => (
          <i key={s.speaker} style={{ width: `${s.percent}%`, background: color(s.speaker) }} />
        ))}
      </span>
      <span className="aui-tx-share-legend" aria-hidden="true">
        {shares.map((s) => (
          <span key={s.speaker}><i style={{ background: color(s.speaker) }} />{name(s.speaker)} <b>{s.percent}%</b></span>
        ))}
      </span>
    </div>
  );
}

/** 「需求 3 · 关注 2 …」 soft brand chips. */
export function AnnotationStats({ stats, categories }: { stats: readonly { category: string; count: number }[]; categories: ReadonlyMap<string, TranscriptCategory> }) {
  return (
    <span className="aui-tx-stats">
      {stats.map((s) => (
        <span key={s.category} className="aui-chip aui-tx-tag" data-tone={categories.get(s.category)?.tone ?? "green"}>
          {categories.get(s.category)?.label ?? s.category} {s.count}
        </span>
      ))}
    </span>
  );
}

export type ExportMenuProps = {
  formats: readonly { value: string; label: string }[];
  onExport?: (options: TranscriptExportOptions) => void | Promise<void>;
  hasAnnotations: boolean;
  note?: ReactNode;
  copyText: (options: { withTime: boolean; withSpeaker: boolean; withAnnotations: boolean }) => string;
  onCopy?: (text: string) => void;
};

/** 「导出 ⌄」 in the header: a panel with format, options, 导出 / 复制全文 and the masking note. */
export function ExportMenu({ formats, onExport, hasAnnotations, note, copyText, onCopy }: ExportMenuProps) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState(formats[0]?.value ?? "txt");
  const [opts, setOpts] = useState({ withTime: true, withSpeaker: true, withAnnotations: false });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const option = (key: keyof typeof opts, text: string) => (
    <label className="aui-tx-opt">
      <Checkbox checked={opts[key]} onCheckedChange={(v) => setOpts((o) => ({ ...o, [key]: v === true }))} />
      {text}
    </label>
  );
  const copy = async () => {
    const text = copyText(opts);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制全文");
      onCopy?.(text);
    } catch {
      setStatus("复制失败，请手动选择文字");
    }
  };
  const run = async () => {
    if (!onExport) return;
    setBusy(true);
    setStatus("");
    try {
      await onExport({ format, ...opts });
      setStatus("");
      setOpen(false);
    } catch (caught) {
      setStatus(caught instanceof Error && caught.message ? caught.message : "导出失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button ref={anchor} variant="outline" size="sm" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
        <Download />
        导出
        <ChevronDown />
      </Button>
      <PopoverPanel open={open} anchor={anchor.current} onClose={() => setOpen(false)} title="导出文字稿" width="sm" align="end" sheet>
        <div className="aui-tx-export">
          {onExport && formats.length > 1 && <SegmentedControl size="sm" label="导出格式" value={format} options={formats} onValueChange={setFormat} className="aui-tx-formats" />}
          {option("withTime", "带时间")}
          {option("withSpeaker", "带说话人")}
          {hasAnnotations && option("withAnnotations", "带 AI 标注")}
          <div className="aui-tx-export-actions">
            {onExport && <Button size="sm" disabled={busy} onClick={() => void run()}><Download />{busy ? "导出中…" : "导出文字稿"}</Button>}
            <Button size="sm" variant="outline" onClick={() => void copy()}><Copy />复制全文</Button>
          </div>
          <span className="aui-tx-export-status" role="status">{status}</span>
          <small className="aui-tx-export-note"><ShieldCheck aria-hidden="true" />{note ?? "敏感信息已自动打码，复制和导出的也是打码后的"}</small>
        </div>
      </PopoverPanel>
    </>
  );
}
