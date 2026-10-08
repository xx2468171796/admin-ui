"use client";
/**
 * AI output the user reviews before anything is written (D27 跟进记录 AI 分析面板):
 *
 * - SuggestionReview — fields the AI suggests updating: field · old → new (+ a small line) · reason /
 *   source; 采用 / 忽略 per row, 撤销 after either, 全部采用 in the header. State comes from the host
 *   (`item.state`); the host writes the record in `onAccept` (AI never writes by itself).
 * - CitationChips — the sources an answer came from, as chips that open the source (`href` or
 *   `onOpen`), optionally numbered 「[1]」.
 * - SourcedAnswer — a card with a short heading (「客户担心断网」), the answer text whose 「[1]」 markers
 *   become small numbered buttons that open that source, the source chips, 复制 and fold.
 *
 * UI only: no model calls. Styles: styles/ai.css (.aui-sug-*, .aui-cite-*, .aui-answer-*).
 */
import { useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Copy, TriangleAlert } from "lucide-react";
import { ChangeValue } from "./change-value.tsx";
import { Button } from "./primitives.tsx";
import { Count } from "./kit.tsx";
import { useNotify } from "./notifications.tsx";
import { answerSegments, safeCitationHref } from "./ai-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/ai.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/ai.css";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- SuggestionReview (A2)

export type FieldSuggestionState = "pending" | "applied" | "ignored";
export type FieldSuggestion = {
  id: string;
  /** 「预计金额」. */
  field: string;
  /** Current value (null / undefined = 「空」). Plain text is struck through. */
  before?: ReactNode;
  after: ReactNode;
  /** Small line under the new value: 「10-09 周五 10:00 · 李太太在家」. */
  detail?: ReactNode;
  /** Why: 「客户原话：预算 200–220 万」. */
  reason?: ReactNode;
  /** Where from: CitationChips or a 「▶ 07:42」 jump in the recording. */
  source?: ReactNode;
  state?: FieldSuggestionState;
  /** Tooltip of 采用 (「填进下一步和下次跟进，到时提醒你」). */
  acceptHint?: string;
};
export type SuggestionReviewProps = {
  items: readonly FieldSuggestion[];
  title?: string;
  /** Write it (await the save); reject = notice, row stays pending. */
  onAccept: (item: FieldSuggestion) => void | Promise<void>;
  onIgnore: (item: FieldSuggestion) => void | Promise<void>;
  /** Put an applied value back / un-ignore; without it there is no 撤销. */
  onUndo?: (item: FieldSuggestion) => void | Promise<void>;
  /** 全部采用 (default: onAccept for each pending row in order). */
  onAcceptAll?: (items: readonly FieldSuggestion[]) => void | Promise<void>;
  acceptLabel?: string;
  ignoreLabel?: string;
  emptyLabel?: string;
  /** Read-only (no permission to write the record): buttons hidden, states shown. */
  readOnly?: boolean;
};


/** AI-suggested field updates with 采用 / 忽略 / 撤销 / 全部采用. */
export function SuggestionReview({ items, title = "建议更新", onAccept, onIgnore, onUndo, onAcceptAll, acceptLabel = "采用", ignoreLabel = "忽略", emptyLabel = "这次没有要更新的字段", readOnly }: SuggestionReviewProps) {
  const notify = useNotify();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const pending = items.filter((i) => (i.state ?? "pending") === "pending");
  const run = async (ids: readonly string[], fn: () => void | Promise<void>) => {
    if (ids.some((id) => busy.has(id))) return;
    setBusy((s) => new Set([...s, ...ids]));
    try {
      await fn();
    } catch (e) {
      notify(message(e), "error");
    } finally {
      setBusy((s) => new Set([...s].filter((id) => !ids.includes(id))));
    }
  };
  const acceptAll = () =>
    run(pending.map((i) => i.id), async () => {
      if (onAcceptAll) await onAcceptAll(pending);
      else for (const item of pending) await onAccept(item);
    });
  return (
    <section className="aui-sug" aria-label={title}>
      <div className="aui-sug-head">
        <h3>{title}</h3>
        <Count>{items.length}</Count>
        {!readOnly && pending.length > 1 && (
          <Button size="sm" variant="text" className="aui-sug-all" disabled={busy.size > 0} onClick={acceptAll}>全部{acceptLabel}</Button>
        )}
      </div>
      {!items.length ? (
        <p className="aui-sug-empty">{emptyLabel}</p>
      ) : (
        <ul className="aui-sug-list">
          {items.map((item) => {
            const state = item.state ?? "pending";
            const working = busy.has(item.id);
            return (
              <li key={item.id} className="aui-sug-row" data-state={state} aria-busy={working || undefined}>
                <span className="aui-sug-field">{item.field}</span>
                <span className="aui-sug-value">
                  <ChangeValue className="aui-sug-change" before={item.before === undefined ? undefined : item.before ?? null} after={item.after} />
                  {item.detail && <small className="aui-sug-detail">{item.detail}</small>}
                  {(item.reason || item.source) && (
                    <small className="aui-sug-reason">{item.reason}{item.source && <span className="aui-sug-source">{item.source}</span>}</small>
                  )}
                </span>
                <span className="aui-sug-actions">
                  {state === "pending" ? (
                    !readOnly && (
                      <>
                        <Button size="sm" variant="outline" className="aui-sug-accept" disabled={working} tooltip={item.acceptHint} aria-label={`${acceptLabel}：${item.field}`} onClick={() => run([item.id], () => onAccept(item))}>{acceptLabel}</Button>
                        <Button size="sm" variant="ghost" disabled={working} aria-label={`${ignoreLabel}：${item.field}`} onClick={() => run([item.id], () => onIgnore(item))}>{ignoreLabel}</Button>
                      </>
                    )
                  ) : (
                    <>
                      <span className="aui-sug-done" role="status">{state === "applied" ? <><Check aria-hidden="true" />已{acceptLabel}</> : `已${ignoreLabel}`}</span>
                      {onUndo && !readOnly && (
                        <Button size="sm" variant="text" className="aui-sug-undo" disabled={working} aria-label={`${state === "applied" ? "撤销" : "恢复"}：${item.field}`} onClick={() => run([item.id], () => onUndo(item))}>{state === "applied" ? "撤销" : "恢复"}</Button>
                      )}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- CitationChips (A3)

export type CitationSource = {
  id: string;
  /** 「产品手册 · 窗帘电机断网本地控制 p.12」. */
  label: string;
  icon?: ReactNode;
  /** Open in a new tab when there is no `onOpen`. */
  href?: string;
  /** Tooltip, e.g. 「打开原文第 12 页」. */
  title?: string;
};
export type CitationChipsProps = {
  sources: readonly CitationSource[];
  onOpen?: (source: CitationSource, index: number) => void;
  /** Prefix 「1」「2」 matching the [n] markers in the answer. */
  numbered?: boolean;
  label?: string;
};
/** Source chips that open the source; numbered when the answer cites them by number. */
export function CitationChips({ sources, onOpen, numbered, label = "出处" }: CitationChipsProps) {
  if (!sources.length) return null;
  return (
    <ul className="aui-cite-list" aria-label={label}>
      {sources.map((s, i) => {
        const body = (
          <>
            {numbered && <span className="aui-cite-no" aria-hidden="true">{i + 1}</span>}
            <span className="aui-cite-icon" aria-hidden="true">{s.icon ?? <BookOpen />}</span>
            <span className="aui-cite-label">{s.label}</span>
          </>
        );
        const name = `${numbered ? `出处 ${i + 1}：` : "出处："}${s.label}`;
        const href = safeCitationHref(s.href);
        return (
          <li key={s.id}>
            {onOpen || !href ? (
              <button type="button" className="aui-cite" data-tip={s.title} aria-label={name} disabled={!onOpen} onClick={() => onOpen?.(s, i)}>{body}</button>
            ) : (
              <a className="aui-cite" href={href} target="_blank" rel="noopener noreferrer" data-tip={s.title} aria-label={name}>{body}</a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- SourcedAnswer (A3)

export type SourcedAnswerProps = {
  /** Short heading: 「客户担心断网」. */
  title?: ReactNode;
  /** attention = an objection / risk (warning heading), brand = a plain answer. */
  tone?: "attention" | "brand";
  icon?: ReactNode;
  /** Answer text; 「[1]」「[2,3]」 refer to `sources` (1-based). */
  answer: string;
  sources: readonly CitationSource[];
  onOpenSource?: (source: CitationSource, index: number) => void;
  /** Wrap the answer in 「」 (a line to say to the customer). */
  quote?: boolean;
  /** 复制 button (copies the text without the markers). */
  copyable?: boolean;
  /** Fold to the heading + sources; open state is internal. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Extra line under the sources (「知识库里没有这个优惠」 warnings …). */
  footer?: ReactNode;
};
/** An AI answer with numbered citations that open their source. */
export function SourcedAnswer({ title, tone = "brand", icon, answer, sources, onOpenSource, quote, copyable, collapsible, defaultOpen = true, footer }: SourcedAnswerProps) {
  const notify = useNotify();
  const [open, setOpen] = useState(!collapsible || defaultOpen);
  const segments = answerSegments(answer);
  const plainText = segments.map((s) => (s.kind === "text" ? s.text : "")).join("").trim();
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw Error("浏览器不允许写剪贴板");
      await navigator.clipboard.writeText(plainText);
      notify("已复制");
    } catch (e) {
      notify(`复制失败：${message(e)}`, "error");
    }
  };
  const openSource = (n: number) => {
    const s = sources[n - 1];
    if (!s) return;
    if (onOpenSource) onOpenSource(s, n - 1);
    else {
      const href = safeCitationHref(s.href);
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    }
  };
  return (
    <article className="aui-answer" data-tone={tone} data-open={open || undefined}>
      {(title || copyable || collapsible) && (
        <div className="aui-answer-head">
          {title && (
            <span className="aui-answer-title">
              {icon ?? (tone === "attention" ? <TriangleAlert aria-hidden="true" /> : null)}
              {title}
            </span>
          )}
          {!open && sources[0] && <CitationChips sources={sources.slice(0, 1)} onOpen={onOpenSource} />}
          <span className="aui-answer-tools">
            {copyable && open && <Button size="sm" variant="ghost" onClick={copy}><Copy aria-hidden="true" />复制</Button>}
            {collapsible && (
              <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
                {open ? "收起" : "展开"}
                <ChevronDown aria-hidden="true" className="aui-answer-chevron" />
              </Button>
            )}
          </span>
        </div>
      )}
      {open && (
        <>
          <p className="aui-answer-text">
            {quote && "「"}
            {segments.map((s, i) =>
              s.kind === "text" ? (
                <span key={i}>{s.text}</span>
              ) : (
                <span key={i} className="aui-answer-cites">
                  {s.ids.map((n) => (
                    <button key={n} type="button" className="aui-answer-cite" disabled={!sources[n - 1]} aria-label={sources[n - 1] ? `出处 ${n}：${sources[n - 1]!.label}` : `出处 ${n}（不存在）`} onClick={() => openSource(n)}>{n}</button>
                  ))}
                </span>
              ),
            )}
            {quote && "」"}
          </p>
          <CitationChips sources={sources} onOpen={onOpenSource} numbered={segments.some((s) => s.kind === "cite")} />
          {footer && <div className="aui-answer-footer">{footer}</div>}
        </>
      )}
    </article>
  );
}
