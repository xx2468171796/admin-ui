"use client";
/**
 * FormSuccess (bt/builders-a V10, demo D18s): the page after submitting — check mark, 「提交成功」 and the
 * host's message, form name + time, 「您提交的内容」 (answered questions, phones masked, options as chips,
 * files counted by kind), 「再填一份」 and 「可以关闭这个页面了」. Same frame as PublicForm.
 */
import type { ReactNode } from "react";
import { CircleCheck, FileText, Image, Mic, RotateCcw, Video, File } from "lucide-react";
import { Button, cn } from "../primitives.tsx";
import { resolveOptionTone } from "../option-tone.ts";
import type { MediaKind } from "../media-core.ts";
import type { FormSummaryRow } from "./form-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

export type FormSuccessProps = {
  /** Brand block in the band (same as PublicForm). */
  brand?: ReactNode;
  cover?: string;
  title?: string;
  /** 「顾问会在 1 个工作日内联系您」 */
  message?: ReactNode;
  /** 「官网咨询表单 · 2026-10-05 14:32 提交」 */
  meta?: ReactNode;
  /** formSummary(...) of what was sent; omit to hide the summary card. */
  summary?: { rows: readonly FormSummaryRow[]; answered: number; total: number };
  onFillAgain?: () => void;
  fillAgainLabel?: string;
  /** More buttons next to 再填一份 (「修改我的提交」 when allowed). */
  actions?: ReactNode;
  closeNote?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

const KIND_ICON: Record<MediaKind, typeof Image> = { image: Image, video: Video, audio: Mic, pdf: FileText, file: File };
const KIND_NAME: Record<MediaKind, string> = { image: "图片", video: "视频", audio: "录音", pdf: "PDF", file: "文件" };

export function FormSuccess({ brand, cover, title = "提交成功", message, meta, summary, onFillAgain, fillAgainLabel = "再填一份", actions, closeNote = "可以关闭这个页面了", footer, className }: FormSuccessProps) {
  return (
    <div className={cn("aui-pform", "aui-pform-success", className)}>
      <div className="aui-pform-card">
        <div className="aui-pform-band" data-cover={cover ? true : undefined} style={cover ? { backgroundImage: `url("${cover.replace(/"/g, "%22")}")` } : undefined}>
          {brand && <div className="aui-pform-brand">{brand}</div>}
        </div>
        <div className="aui-pform-ok" role="status">
          <span className="aui-pform-ok-icon" aria-hidden="true"><CircleCheck /></span>
          <h1>{title}</h1>
          {message && <p>{message}</p>}
          {meta && <small>{meta}</small>}
        </div>
        {summary && summary.rows.length > 0 && (
          <section className="aui-pform-sum" aria-label="您提交的内容">
            <h2><FileText aria-hidden="true" />您提交的内容<small>共 {summary.total} 题，已答 {summary.answered} 题</small></h2>
            <dl>
              {summary.rows.map((row) => (
                <div key={row.key} className="aui-pform-sum-row">
                  <dt>{row.label}</dt>
                  <dd>
                    {row.chips ? (
                      <span className="aui-pform-sum-chips">{row.chips.map((chip) => <span key={chip.label} className="aui-chip" data-tone={chip.tone ?? resolveOptionTone(chip.option)}><span className="aui-chip-label">{chip.label}</span></span>)}</span>
                    ) : row.files ? (
                      <span className="aui-pform-sum-files">
                        {row.files.map((f) => {
                          const Icon = KIND_ICON[f.kind];
                          return <span key={f.kind} className="aui-pform-sum-file" data-tip={`${KIND_NAME[f.kind]} ${f.count} 个`}><Icon aria-hidden="true" /><span className="aui-sr-only">{KIND_NAME[f.kind]}</span>{f.count}</span>;
                        })}
                        <small>共 {row.fileCount} 个</small>
                      </span>
                    ) : row.text}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {(onFillAgain || actions || closeNote) && (
          <div className="aui-pform-acts">
            {onFillAgain && <Button variant="outline" className="aui-pform-again" onClick={onFillAgain}><RotateCcw />{fillAgainLabel}</Button>}
            {actions}
            {closeNote && <small>{closeNote}</small>}
          </div>
        )}
      </div>
      {footer && <div className="aui-pform-page-foot">{footer}</div>}
    </div>
  );
}
