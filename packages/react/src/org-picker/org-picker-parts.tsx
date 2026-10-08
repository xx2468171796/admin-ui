"use client";
/**
 * Small shared pieces of the OrgPicker panes: the subject mark (person avatar or a kind icon block),
 * the tick (checkbox / radio look; the row itself carries the ARIA state), one pickable row (members,
 * search hits, tab lists, phone lists) and highlighted text.
 */
import type { ReactNode } from "react";
import { Building2, Check, Landmark, Lock, Minus, Route, Shield, Users } from "lucide-react";
import { avatarLetter, avatarTone } from "../avatar-core.ts";
import { highlightParts } from "../search.tsx";
import { tipProps } from "../tooltip.tsx";
import type { SubjectKind } from "./org-picker-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

const KIND_ICON: Partial<Record<string, typeof Users>> = { group: Landmark, company: Building2, dept: Users, role: Shield, line: Route };

/** Person: letter avatar in the person's colour (grey when departed). Anything else: a soft icon block. */
export function SubjectMark({ kind, id, label, src, gone, size = 24 }: { kind: SubjectKind; id: string; label: string; src?: string; gone?: boolean; size?: 20 | 24 | 32 }) {
  if (kind === "person") {
    return (
      <span className="aui-avatar" data-size={String(size)} data-tone={gone ? undefined : avatarTone(id)} data-kind={gone ? "gone" : undefined} aria-hidden="true">
        {src ? <img src={src} alt="" /> : avatarLetter(label)}
      </span>
    );
  }
  const Icon = KIND_ICON[kind] ?? Users;
  return (
    <span className="aui-orgp-mark" data-kind={kind} data-size={String(size)} aria-hidden="true">
      <Icon />
    </span>
  );
}

export type TickState = "checked" | "mixed" | "unchecked";
/** The tick look: square (multiple) or round (single). Decorative — the row has aria-checked / aria-selected. */
export function Tick({ state, round, disabled, onToggle }: { state: TickState; round?: boolean; disabled?: boolean; onToggle?: () => void }) {
  return (
    <span
      className={round ? "aui-orgp-radio" : "aui-orgp-check"}
      data-state={state}
      data-disabled={disabled || undefined}
      aria-hidden="true"
      onClick={
        onToggle
          ? (event) => {
              event.stopPropagation();
              if (!disabled) onToggle();
            }
          : undefined
      }
    >
      {!round && state === "checked" && <Check />}
      {!round && state === "mixed" && <Minus />}
    </span>
  );
}

/** Text with the query (or the server's matched ranges) marked. */
export function Marked({ text, query, ranges }: { text: string; query?: string; ranges?: readonly (readonly [number, number])[] }) {
  if (ranges?.length) {
    const out: ReactNode[] = [];
    let at = 0;
    for (const [from, to] of [...ranges].sort((a, b) => a[0] - b[0])) {
      if (from > at) out.push(<span key={`t${at}`}>{text.slice(at, from)}</span>);
      out.push(<mark key={`m${from}`} className="aui-hl">{text.slice(Math.max(from, at), to)}</mark>);
      at = Math.max(at, to);
    }
    if (at < text.length) out.push(<span key={`t${at}`}>{text.slice(at)}</span>);
    return <>{out}</>;
  }
  if (!query) return <>{text}</>;
  return <>{highlightParts(text, query).map((p, i) => (p.hit ? <mark key={i} className="aui-hl">{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}

export type PickRowProps = {
  id: string;
  kind: SubjectKind;
  label: ReactNode;
  /** Name for assistive tech when `label` is markup. */
  name: string;
  sub?: ReactNode;
  badges?: readonly string[];
  mark: ReactNode;
  tick: TickState | null;
  round?: boolean;
  /** Row can't be toggled; `lockReason` shows a lock and the reason on the right. */
  disabled?: boolean;
  lockReason?: string;
  /** 「已授权 · 可读写」 / 「已含在「销售部」里」 on the right. */
  note?: string;
  noteTone?: "brand" | "warning" | "neutral";
  aside?: { text: string; tone?: "neutral" | "warning" };
  trailing?: ReactNode;
  active?: boolean;
  optionId?: string;
  struck?: boolean;
  onToggle: () => void;
  onHover?: () => void;
  style?: React.CSSProperties;
};

/** One pickable line: tick · mark · name (+ badges) / second line · note · aside · trailing. role="option". */
export function PickRow({ id, kind, label, name, sub, badges, mark, tick, round, disabled, lockReason, note, noteTone = "neutral", aside, trailing, active, optionId, struck, onToggle, onHover, style }: PickRowProps) {
  const selected = tick === "checked";
  return (
    <div
      id={optionId}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      aria-label={[name, lockReason, note].filter(Boolean).join("，")}
      className="aui-orgp-row"
      data-kind={kind}
      data-id={id}
      data-active={active || undefined}
      data-on={selected || undefined}
      data-locked={lockReason ? true : undefined}
      data-disabled={disabled || undefined}
      style={style}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      onMouseEnter={onHover}
    >
      {lockReason ? <Lock className="aui-orgp-lock" aria-hidden="true" /> : tick ? <Tick state={tick} round={round} disabled={disabled} /> : <span className="aui-orgp-tick-gap" aria-hidden="true" />}
      {mark}
      <span className="aui-orgp-row-text">
        <span className="aui-orgp-row-name" data-struck={struck || undefined}>
          <span className="aui-orgp-row-label">{label}</span>
          {badges?.map((b) => (
            <span key={b} className="aui-orgp-badge">{b}</span>
          ))}
        </span>
        {sub && <span className="aui-orgp-row-sub">{sub}</span>}
      </span>
      {lockReason && (
        <span className="aui-orgp-note" data-tone="neutral" {...tipProps(lockReason, undefined, { truncated: true })}>
          <Lock aria-hidden="true" />
          {lockReason}
        </span>
      )}
      {!lockReason && note && (
        <span className="aui-orgp-note" data-tone={noteTone} {...tipProps(note, undefined, { truncated: true })}>
          {noteTone === "brand" && <Check aria-hidden="true" />}
          {note}
        </span>
      )}
      {aside && <span className="aui-orgp-aside" data-tone={aside.tone === "warning" ? "warning" : undefined}>{aside.text}</span>}
      {trailing}
    </div>
  );
}

/** Skeleton rows shaped like real rows (no spinner in the middle of content). */
export function SkeletonRows({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <div className="aui-orgp-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="aui-orgp-skel-row">
          <span className="aui-skel" data-shape="circle" style={{ width: 24, height: 24 }} aria-hidden="true" />
          <span className="aui-skel" style={{ width: `${[52, 38, 64, 44, 58, 36][i % 6]}%` }} aria-hidden="true" />
        </span>
      ))}
    </div>
  );
}
