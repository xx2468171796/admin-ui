"use client";
/**
 * AI prompt settings pieces (D28 AI 分析设置):
 *
 * - PromptEditor — a plain-text prompt editor with line numbers, `{{变量}}` highlighted as chips,
 *   「插入变量」 at the caret, 「对比 vN」 gutter marks against a base version (+ = new / changed line,
 *   − = lines removed here), 「草稿 · 改了 N 处」 and a footer with characters, tokens (host counter or a
 *   rough estimate marked 「约」) and the variables used (unknown ones flagged).
 * - VersionList — versions with badge, note, author · time, 当前 / 草稿 marks; 对比 and 回退 callbacks
 *   (回退 = a new version with the old content; nothing is deleted — say so in `rollbackHint`).
 * - CompareGrid — A/B (or more) outputs side by side for one sample at a time: rows (摘要 / 顾虑 / 话术 …)
 *   × variants, cells may be flagged bad (编造 / 漏了); pick a winner per sample, tally across samples.
 *
 * UI only: the host stores versions, runs the model and counts tokens. Styles: styles/ai.css.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Braces, Check, Columns2, History, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, Choice } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { useNotify } from "./notifications.tsx";
import { countChars, estimateTokens, insertVariable, lineMarks, promptSegments, unknownVariables, usedVariables, winnerTally } from "./ai-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/ai.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/ai.css";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- PromptEditor (A4)

export type PromptVariable = { name: string; /** Shown in the insert menu: 「本次跟进文字稿（已分说话人）」. */ hint?: string };
export type PromptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name and default heading: 「跟进分析」. */
  label: string;
  /** Heading badges (version / published / draft). */
  badges?: ReactNode;
  variables?: readonly PromptVariable[];
  /** Base version to compare with (published one); with it 「对比 {baseLabel}」 and 「改了 N 处」 appear. */
  base?: string;
  baseLabel?: string;
  /** Compare marks on at first (default true when `base` is given). */
  defaultCompare?: boolean;
  /** Host tokenizer (gateway); else a rough estimate shown as 「约」. May be async. */
  countTokens?: (text: string) => number | Promise<number>;
  /** Right of the footer counts: 「每次约 2,300 字给 AI」. */
  footerExtra?: ReactNode;
  /** Extra buttons in the heading row. */
  actions?: ReactNode;
  readOnly?: boolean;
  /** Max height of the text area before it scrolls (default 420). */
  maxHeight?: number;
  placeholder?: string;
};

/** Prompt editor: line numbers, variable chips, diff marks vs a base version, counts. */
export function PromptEditor({ value, onChange, label, badges, variables = [], base, baseLabel = "已发布", defaultCompare, countTokens, footerExtra, actions, readOnly, maxHeight = 420, placeholder }: PromptEditorProps) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [compare, setCompare] = useState(defaultCompare ?? base !== undefined);
  const [tokens, setTokens] = useState<{ n: number; exact: boolean }>(() => ({ n: estimateTokens(value), exact: false }));
  const lines = useMemo(() => value.replace(/\r\n?/g, "\n").split("\n"), [value]);
  const marks = useMemo(() => (base !== undefined ? lineMarks(base, value) : null), [base, value]);
  const used = useMemo(() => usedVariables(value), [value]);
  const unknown = useMemo(() => unknownVariables(value, variables.map((v) => v.name)), [value, variables]);
  useEffect(() => {
    if (!countTokens) {
      setTokens({ n: estimateTokens(value), exact: false });
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      Promise.resolve(countTokens(value)).then(
        (n) => live && setTokens({ n, exact: true }),
        () => live && setTokens({ n: estimateTokens(value), exact: false }),
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value, countTokens]);
  const insert = (name: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = insertVariable(value, start, end, name);
    onChange(next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };
  const show = compare && marks;
  return (
    <section className="aui-prompt" aria-label={label}>
      <div className="aui-prompt-head">
        <h3>{label}</h3>
        {badges}
        {marks && marks.places > 0 && <span className="aui-prompt-badge" data-tone="attention">草稿 · 改了 {marks.places} 处</span>}
        <span className="aui-prompt-tools">
          {actions}
          {variables.length > 0 && !readOnly && (
            <span className="aui-prompt-insert">
              <Braces aria-hidden="true" />
              <Choice label="插入变量" value="" placeholder="插入变量" options={variables.map((v) => ({ value: v.name, label: v.hint ? `{{${v.name}}} · ${v.hint}` : `{{${v.name}}}` }))} onChange={(name) => name && insert(name)} />
            </span>
          )}
          {base !== undefined && (
            <Button size="sm" variant="outline" aria-pressed={compare} onClick={() => setCompare((v) => !v)}><Columns2 aria-hidden="true" />对比 {baseLabel}</Button>
          )}
        </span>
      </div>
      <div className="aui-prompt-body" style={{ maxHeight }}>
        <div className="aui-prompt-lines" aria-hidden="true">
          {lines.map((line, i) => {
            const n = i + 1;
            const added = show && marks.added.has(n);
            const removed = show ? marks.removedBefore.get(n) : undefined;
            return (
              <div key={i} className="aui-prompt-line" data-added={added || undefined} data-removed={removed ? true : undefined} data-tip={removed ? `这里删了 ${removed} 行` : undefined}>
                <span className="aui-prompt-no">{n}</span>
                <span className="aui-prompt-mark">{added ? "+" : removed ? "−" : ""}</span>
                <span className="aui-prompt-text">
                  {line ? promptSegments(line).map((s, j) => (s.kind === "var" ? <span key={j} className="aui-prompt-var" data-unknown={unknown.includes(s.name) || undefined}>{s.text}</span> : <span key={j}>{s.text}</span>)) : "\u200b"}
                </span>
              </div>
            );
          })}
          {show && marks.removedBefore.get(lines.length + 1) ? (
            <div className="aui-prompt-line" data-removed data-tip={`末尾删了 ${marks.removedBefore.get(lines.length + 1)} 行`}><span className="aui-prompt-no" /><span className="aui-prompt-mark">−</span><span className="aui-prompt-text">{"\u200b"}</span></div>
          ) : null}
        </div>
        <textarea
          ref={area}
          className="aui-prompt-input"
          aria-label={label}
          value={value}
          spellCheck={false}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="aui-prompt-foot">
        <span>共 <b>{countChars(value).toLocaleString()}</b> 字 · {tokens.exact ? "" : "约 "}<b>{tokens.n.toLocaleString()}</b> token</span>
        {footerExtra}
        {used.length > 0 && (
          <span className="aui-prompt-used">
            用到的变量
            {used.slice(0, 3).map((v) => <span key={v} className="aui-prompt-var" data-unknown={unknown.includes(v) || undefined}>{`{{${v}}}`}</span>)}
            {used.length > 3 && <span className="aui-prompt-var" data-tip={used.slice(3).join("、")}>+{used.length - 3}</span>}
          </span>
        )}
        {unknown.length > 0 && <span className="aui-prompt-warn" role="status"><TriangleAlert aria-hidden="true" />没有这个变量：{unknown.join("、")}</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- VersionList (A4)

export type PromptVersion = {
  id: string;
  /** 「v3」. */
  version: string;
  /** What changed: 「话术必须标出处」. */
  note: ReactNode;
  author: string;
  time: ReactNode;
  /** draft = unpublished changes; current = the published one in use. */
  state?: "draft" | "current" | null;
};
export type VersionListProps = {
  items: readonly PromptVersion[];
  label?: string;
  /** Highlight the version being compared / viewed. */
  selected?: string | null;
  /** 对比 this version with the draft. */
  onView?: (item: PromptVersion) => void;
  /** 回退: the host creates a new version with this content (reject = notice). */
  onRollback?: (item: PromptVersion) => void | Promise<void>;
  rollbackLabel?: string;
  /** Tooltip of 回退: 「回退到 v2：会生成 v5 = v2 的内容，不会删掉 v3」. */
  rollbackHint?: (item: PromptVersion) => string;
};
/** Version history with 对比 and 回退 (current and draft cannot be rolled back to). */
export function VersionList({ items, label = "版本历史", selected, onView, onRollback, rollbackLabel = "回退", rollbackHint }: VersionListProps) {
  const notify = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const rollback = async (item: PromptVersion) => {
    if (!onRollback || busy) return;
    setBusy(item.id);
    try {
      await onRollback(item);
    } catch (e) {
      notify(message(e), "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <ul className="aui-versions" aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className="aui-version" data-state={item.state ?? undefined} aria-current={selected === item.id || undefined}>
          <span className="aui-prompt-badge" data-tone={item.state === "draft" ? "attention" : item.state === "current" ? "brand" : "neutral"}>{item.version}</span>
          <span className="aui-version-text">
            <b>{item.note}</b>
            <small>{item.author} · {item.time}</small>
          </span>
          <span className="aui-version-actions">
            {item.state === "current" && <span className="aui-version-current">当前</span>}
            {onView && item.state !== "draft" && (
              <Button size="sm" variant="ghost" aria-pressed={selected === item.id} aria-label={`对比 ${item.version}`} onClick={() => onView(item)}><History aria-hidden="true" />对比</Button>
            )}
            {onRollback && !item.state && (
              <Button size="sm" variant="outline" disabled={busy !== null} tooltip={rollbackHint?.(item)} aria-label={`${rollbackLabel}到 ${item.version}`} onClick={() => rollback(item)}><RotateCcw aria-hidden="true" />{busy === item.id ? "回退中…" : rollbackLabel}</Button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- CompareGrid (A4)

export type CompareVariant = { key: string; /** 「v2」. */ badge: string; /** 「09-20 版」「当前发布」. */ label: ReactNode; /** 「7 秒 · US$ 0.3」. */ meta?: ReactNode; tone?: "brand" | "attention" | "neutral" };
/** A cell: content, optionally flagged (bad = made up / wrong, worse = missed something, better = found more). */
export type CompareCell = { content: ReactNode; flag?: "bad" | "worse" | "better"; note?: ReactNode };
export type CompareRow = { key: string; label: string; cells: Readonly<Record<string, CompareCell | ReactNode>> };
export type CompareSample = { key: string; label: string; rows: readonly CompareRow[]; /** One-line verdict under the grid: 「v3 多抓到 1 个顾虑…」. */ summary?: ReactNode };
export type CompareGridProps = {
  variants: readonly CompareVariant[];
  samples: readonly CompareSample[];
  /** Controlled sample; leave out for internal. */
  sample?: string;
  onSampleChange?: (key: string) => void;
  /** Winner per sample (variant key or "tie"). */
  winners?: Readonly<Record<string, string | null | undefined>>;
  onPickWinner?: (sample: string, variant: string) => void;
  /** 再跑一次 (reject = notice). */
  onRun?: (sample: string) => void | Promise<void>;
  /** Buttons right of the sample picker (换一段录音 / 看完整输出). */
  actions?: ReactNode;
  label?: string;
};
const isCell = (v: unknown): v is CompareCell => typeof v === "object" && v !== null && "content" in (v as Record<string, unknown>);

/** A/B outputs side by side, one sample at a time, with a winner per sample. */
export function CompareGrid({ variants, samples, sample: sampleProp, onSampleChange, winners = {}, onPickWinner, onRun, actions, label = "试跑对比" }: CompareGridProps) {
  const notify = useNotify();
  const [inner, setInner] = useState(samples[0]?.key ?? "");
  const [running, setRunning] = useState(false);
  const key = sampleProp ?? inner;
  const current = samples.find((s) => s.key === key) ?? samples[0];
  const pick = (k: string) => {
    if (sampleProp === undefined) setInner(k);
    onSampleChange?.(k);
  };
  const tally = winnerTally(winners, samples.map((s) => s.key), variants.map((v) => v.key));
  const run = async () => {
    if (!onRun || !current || running) return;
    setRunning(true);
    try {
      await onRun(current.key);
    } catch (e) {
      notify(message(e), "error");
    } finally {
      setRunning(false);
    }
  };
  if (!current) return null;
  const winner = winners[current.key];
  return (
    <section className="aui-compare" aria-label={label}>
      <div className="aui-compare-bar">
        {samples.length > 1 &&
          (samples.length <= 4 ? (
            <SegmentedControl size="sm" label="样本" value={current.key} onValueChange={pick} options={samples.map((s) => ({ value: s.key, label: s.label }))} />
          ) : (
            <Choice label="样本" value={current.key} onChange={pick} options={samples.map((s) => ({ value: s.key, label: s.label }))} />
          ))}
        {samples.length === 1 && <span className="aui-compare-sample">{current.label}</span>}
        <span className="aui-compare-actions">
          {actions}
          {onRun && <Button size="sm" disabled={running} aria-busy={running || undefined} onClick={run}><Play aria-hidden="true" />{running ? "运行中…" : "再跑一次"}</Button>}
        </span>
      </div>
      <div className="aui-compare-scroll">
        <table className="aui-compare-table">
          <caption className="aui-sr-only">{label}：{current.label}</caption>
          <thead>
            <tr>
              <td />
              {variants.map((v) => (
                <th key={v.key} scope="col" data-winner={winner === v.key || undefined}>
                  <span className="aui-compare-variant">
                    <span className="aui-prompt-badge" data-tone={v.tone ?? "neutral"}>{v.badge}</span>
                    <span>{v.label}</span>
                    {v.meta && <small>{v.meta}</small>}
                  </span>
                  {onPickWinner && (
                    <Button size="sm" variant={winner === v.key ? "secondary" : "ghost"} aria-pressed={winner === v.key} className="aui-compare-pick" onClick={() => onPickWinner(current.key, v.key)}>
                      {winner === v.key ? <><Check aria-hidden="true" />更好</> : "选这个"}
                    </Button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {variants.map((v) => {
                  const raw = row.cells[v.key];
                  const cell = isCell(raw) ? raw : { content: raw as ReactNode };
                  return (
                    <td key={v.key} data-flag={cell.flag}>
                      {cell.content ?? <span className="aui-note">—</span>}
                      {cell.note && <span className="aui-compare-note" data-flag={cell.flag}>{cell.flag === "bad" && <TriangleAlert aria-hidden="true" />}{cell.note}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(current.summary || onPickWinner) && (
        <div className="aui-compare-foot">
          {current.summary && <span className="aui-compare-summary"><Check aria-hidden="true" />{current.summary}</span>}
          {onPickWinner && samples.length > 1 && (
            <span className="aui-compare-tally" role="status">
              {variants.map((v) => `${v.badge} 胜 ${tally.wins.get(v.key) ?? 0}`).join(" · ")}
              {tally.tie ? ` · 平 ${tally.tie}` : ""} · 还没看 {tally.open}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
