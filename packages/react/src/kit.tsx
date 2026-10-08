"use client";
/**
 * Kit pieces approved by the owner (2026-10-02 component review, "C" record detail):
 * RecordHeader, FactStrip, SectionCard, Count, Steps, Sparkline,
 * PersonLine, Tag, AsyncSwitch, CopyBlock, Meter, SharePicker. Colours only from the palette (main family + attention / danger / info); no decorative
 * colour bars — state shows as a tinted background, border and text colour. Styles: styles/kit.css.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { Switch } from "./primitives.tsx";
import { useNotify } from "./notifications.tsx";
import { GrantList } from "./grant-list.tsx";
import { CopyButton } from "./copy-button.tsx";
import { tipProps } from "./tooltip.tsx";
import type { RecordBadge, RecordMetaPart } from "./record-detail-core.ts";
import { avatarTone } from "./avatar-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/kit.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/kit.css";

/** The three accents of a palette, plus the main family ("brand") and plain. */
export type KitTone = "neutral" | "brand" | "attention" | "danger" | "info";

// ---------------------------------------------------------------- Count

/**
 * 18px round number badge: neutral = a quantity (0 is shown) · primary = unread
 * (solid main colour; 0 is hidden) · danger = alerts (solid) · attention = soft amber. Over `max` (99) → 「99+」.
 */
export function Count({ children, tone = "neutral", label, max = 99 }: { children: ReactNode; tone?: "neutral" | "primary" | "danger" | "attention"; label?: string; max?: number }) {
  const n = typeof children === "number" ? children : null;
  if (n !== null && n <= 0 && tone === "primary") return null;
  const shown = n !== null && n > max ? `${max}+` : children;
  return (
    <span className="aui-count" data-tone={tone === "neutral" ? undefined : tone} aria-label={label}>
      {shown}
    </span>
  );
}

/** 8px dot: 「something new」 without a number (a tab, an icon button). */
export function DotBadge({ tone = "danger", label }: { tone?: "danger" | "primary" | "attention"; label?: string }) {
  return <span className="aui-dot-badge" data-tone={tone === "danger" ? undefined : tone} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

// ---------------------------------------------------------------- icon block

/** A rounded square holding an icon, tinted by tone (main family by default). */
export function IconBlock({ children, tone = "brand", size = "md", round }: { children: ReactNode; tone?: KitTone; size?: "sm" | "md" | "lg"; round?: boolean }) {
  return (
    <span className="aui-icon-block" data-tone={tone} data-size={size} data-round={round || undefined} aria-hidden="true">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- RecordHeader

export type RecordHeaderNav = { index: number; total: number; onMove: (delta: -1 | 1) => void };
export type RecordHeaderProps = {
  /** Big square on the left: an icon or 1–2 letters (platform, object type). */
  avatar?: ReactNode;
  title: ReactNode;
  /** A StatusBadge (or any short status). */
  status?: ReactNode;
  /** Coloured chips right after the title (「跟进中」, 「A 类」). */
  badges?: readonly RecordBadge[];
  /** Small plain tags after the title line: type, project. */
  tags?: readonly ReactNode[];
  /** Grey text after the tags: 「更新于 10-01 19:01 · admin」, or parts joined by 「·」 (a `{ person }` part gets an initial avatar). */
  meta?: ReactNode | readonly (RecordMetaPart | null | undefined | false)[];
  /** Breadcrumb text above the title (「设置 / 订阅」); nav adds 「第 3 条，共 20 条」 + ↑ ↓. */
  crumb?: ReactNode;
  nav?: RecordHeaderNav;
  /** Buttons on the right (primary first). */
  actions?: ReactNode;
  /** FactStrip under the title. */
  facts?: ReactNode;
  /** Tabs under the facts. */
  tabs?: ReactNode;
};
/** Header of a record (detail dialog / page): white and compact — avatar, title + status, badges, meta, actions (small buttons), facts, tabs on the one bottom line. */
export function RecordHeader({ avatar, title, status, badges, tags, meta, crumb, nav, actions, facts, tabs }: RecordHeaderProps) {
  const metaNode = Array.isArray(meta) ? <RecordMetaLine parts={meta as readonly (RecordMetaPart | null | undefined | false)[]} /> : (meta as ReactNode);
  const hasMeta = Array.isArray(meta) ? meta.some(Boolean) : Boolean(meta);
  return (
    <header className="aui-rhead" data-variant="flat">
      {(crumb || nav) && (
        <div className="aui-rhead-crumb">
          {crumb}
          {nav && nav.total > 1 && (
            <span className="aui-rhead-nav" role="group" aria-label="切换记录">
              <span aria-live="polite">第 {nav.index + 1} 条，共 {nav.total} 条</span>
              <button type="button" className="aui-icon-button" aria-label="上一条（Alt + ↑ 或 K）" data-tip="上一条（Alt + ↑ 或 K）" aria-disabled={nav.index <= 0 || undefined} onClick={() => nav.index > 0 && nav.onMove(-1)}><ChevronUp aria-hidden="true" /></button>
              <button type="button" className="aui-icon-button" aria-label="下一条（Alt + ↓ 或 J）" data-tip="下一条（Alt + ↓ 或 J）" aria-disabled={nav.index >= nav.total - 1 || undefined} onClick={() => nav.index < nav.total - 1 && nav.onMove(1)}><ChevronDown aria-hidden="true" /></button>
            </span>
          )}
        </div>
      )}
      <div className="aui-rhead-main">
        {avatar !== undefined && avatar !== null && <span className="aui-rhead-avatar" aria-hidden="true">{avatar}</span>}
        <div className="aui-rhead-text">
          <div className="aui-rhead-title">
            <h2>{title}</h2>
            {status}
            {badges?.map((badge, i) => <span key={badge.key ?? `${badge.label}#${i}`} className="aui-chip aui-rhead-badge" data-tone={badge.tone ?? "gray"} data-tip={badge.title}>{badge.label}</span>)}
          </div>
          {(tags?.length || hasMeta) && (
            <div className="aui-rhead-meta">
              {tags?.map((tag, i) => <span key={i} className="aui-tag" data-variant="plain">{tag}</span>)}
              {hasMeta && <span className="aui-rhead-meta-text">{metaNode}</span>}
            </div>
          )}
        </div>
        {actions && <div className="aui-rhead-actions">{actions}</div>}
      </div>
      {facts}
      {tabs && <div className="aui-rhead-tabs">{tabs}</div>}
    </header>
  );
}

/** The first character of a title (the default letter tile of a record), or null for an empty title. */
export function recordInitial(title: string | null | undefined): string | null {
  const first = Array.from((title ?? "").trim())[0];
  return first ? first.toUpperCase() : null;
}

/** A record header's meta line: parts joined by a dot; `{ person }` = small initial avatar + name + suffix. */
export function RecordMetaLine({ parts }: { parts: readonly (RecordMetaPart | null | undefined | false)[] }) {
  const shown = parts.filter((part): part is RecordMetaPart => part !== null && part !== undefined && part !== false && part !== "");
  return (
    <>
      {shown.map((part, i) => (
        <span key={typeof part === "string" ? `${part}#${i}` : "person" in part ? `p:${part.person}#${i}` : part.key} className="aui-rhead-part">
          {i > 0 && <span className="aui-rhead-dot" aria-hidden="true">·</span>}
          {typeof part === "string" ? part : "person" in part ? (
            <span className="aui-rhead-person"><span className="aui-rhead-person-avatar" aria-hidden="true">{recordInitial(part.person)}</span>{part.person}{part.suffix ? ` ${part.suffix}` : ""}</span>
          ) : part.node}
        </span>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- FactStrip

export type Fact = { key: string; label: string; value: ReactNode; icon?: ReactNode; tone?: Exclude<KitTone, "neutral">; hint?: ReactNode };
/** 3–6 key values under a record title; attention = due soon, danger = missing / failing. */
export function FactStrip({ items }: { items: readonly Fact[] }) {
  if (!items.length) return null;
  return (
    <dl className="aui-facts">
      {items.map((f) => (
        <div key={f.key} className="aui-fact" data-tone={f.tone === "attention" || f.tone === "danger" ? f.tone : undefined}>
          {f.icon && <IconBlock tone={f.tone ?? "brand"}>{f.icon}</IconBlock>}
          <div>
            <dt>{f.label}</dt>
            <dd>
              {f.value === null || f.value === undefined || f.value === "" ? "—" : f.value}
              {f.hint && <small>{f.hint}</small>}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- SectionCard

export type SectionCardProps = {
  /** Leave out (with icon / progress / actions) for a card without a header bar. */
  title?: ReactNode;
  icon?: ReactNode;
  /** 「5 / 6 已填」 with a small bar. */
  progress?: { filled: number; total: number };
  /** Buttons in the header bar (1–2). */
  actions?: ReactNode;
  /** Extra footer content. */
  footer?: ReactNode;
  children?: ReactNode;
  /** No inner padding (tables, lists that bring their own). */
  flush?: boolean;
};
/** One block of a detail / edit view: icon + title + progress + buttons, body, footer. */
export function SectionCard({ title, icon, progress, actions, footer, children, flush }: SectionCardProps) {
  const pct = progress && progress.total > 0 ? Math.round((progress.filled / progress.total) * 100) : 0;
  return (
    <section className="aui-scard" aria-label={typeof title === "string" ? title : undefined}>
      {(title || icon || progress || actions) && <div className="aui-scard-head">
        {icon && <IconBlock size="sm">{icon}</IconBlock>}
        <h3>{title}</h3>
        <div className="aui-scard-tools">
          {progress && (
            <span className="aui-scard-progress">
              {progress.filled} / {progress.total} 已填
              <span className="aui-scard-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="已填比例"><i style={{ width: `${pct}%` }} /></span>
            </span>
          )}
          {actions}
        </div>
      </div>}
      {children !== undefined && <div className="aui-scard-body" data-flush={flush || undefined}>{children}</div>}
      {footer && <div className="aui-scard-foot">{footer}</div>}
    </section>
  );
}

// ---------------------------------------------------------------- PersonLine

/** Avatar + name + one grey line (owner, assignee). */
export function PersonLine({ name, hint, avatar }: { name: ReactNode; hint?: ReactNode; avatar?: ReactNode }) {
  const letter = avatar ?? (typeof name === "string" ? name.trim().slice(0, 1) : "");
  return (
    <div className="aui-person">
      <span className="aui-avatar" data-tone={avatarTone(typeof name === "string" ? name : String(letter))} aria-hidden="true">{letter}</span>
      <div>
        <b>{name}</b>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Steps

export type StepItem = {
  key: string;
  label: string;
  /** One grey line under the label (「10/03 上门量窗」「等陈组长确认 · 已等 2 天」). */
  description?: ReactNode;
  /** The current step waits for someone else (attention) or failed (error, ×). Only read on the current step. */
  status?: "waiting" | "error";
};
/**
 * Step bar of a wizard / a process. 24px circles: done = soft primary + ✓ with the label in
 * the body colour (never grey — the tick alone says 「done」); current = solid primary + a soft halo + bold; waiting
 * for someone = attention; failed = danger ×; not reached = thin grey ring + number. Lines fill the remaining width,
 * done lines in the primary colour. `onStepClick` makes done steps clickable (go back). `vertical` for narrow
 * columns. Phones: the horizontal bar keeps only the circles + the current step's label.
 */
export function Steps({ steps, current, label = "步骤", size = "md", tone, stretch, orientation = "horizontal", onStepClick }: {
  steps: readonly StepItem[];
  current: string;
  label?: string;
  /** sm = inside a work item card (WorkItemCard). */
  size?: "sm" | "md";
  /** attention = the current step waits for someone (「等你确认」); same as the current step's `status: "waiting"`. */
  tone?: "attention";
  /** Lines grow so the bar spans its container (wizard band). */
  stretch?: boolean;
  orientation?: "horizontal" | "vertical";
  /** Done steps become buttons (go back to a finished step). */
  onStepClick?: (key: string) => void;
}) {
  const at = Math.max(0, steps.findIndex((s) => s.key === current));
  // Phones: a bar wider than its box scrolls sideways; keep the current step in view (only the bar scrolls).
  const bar = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = bar.current;
    const item = el?.children[at] as HTMLElement | undefined;
    if (!el || !item || el.scrollWidth <= el.clientWidth) return;
    const box = el.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    el.scrollLeft = Math.max(0, rect.left - box.left + el.scrollLeft - (box.width - rect.width) / 2);
  }, [at, steps.length]);
  const status = steps[at]?.status ?? (tone === "attention" ? "waiting" : undefined);
  return (
    <ol ref={bar} className="aui-steps" aria-label={label} data-size={size === "sm" ? "sm" : undefined} data-tone={status === "waiting" ? "attention" : status === "error" ? "error" : undefined} data-stretch={stretch || undefined} data-orientation={orientation === "vertical" ? "vertical" : undefined}>
      {steps.map((step, i) => {
        const state = i < at ? "done" : i === at ? "current" : "todo";
        const mark = <span className="aui-step-n">{state === "done" ? <Check aria-hidden="true" /> : state === "current" && status === "error" ? <X aria-hidden="true" /> : i + 1}</span>;
        const text = (
          <span className="aui-step-text">
            <span className="aui-step-label">{step.label}</span>
            {step.description && <small className="aui-step-desc">{step.description}</small>}
          </span>
        );
        return (
          <li key={step.key} className="aui-step" data-state={state} aria-current={i === at ? "step" : undefined}>
            {state === "done" && onStepClick ? (
              <button type="button" className="aui-step-btn" onClick={() => onStepClick(step.key)} aria-label={`回到「${step.label}」（已完成）`}>{mark}{text}</button>
            ) : (
              <>{mark}{text}</>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- Sparkline

/** Tiny trend line for a table cell / fact (latency, traffic). Values only, no axes. */
export function Sparkline({ values, tone = "brand", width = 80, height = 20, label }: { values: readonly number[]; tone?: "brand" | "attention" | "danger"; width?: number; height?: number; label: string }) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return <span className="aui-sparkline" data-empty aria-label={`${label}：数据不足`}>—</span>;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const step = width / (finite.length - 1);
  const d = finite.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="aui-sparkline" data-tone={tone} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={d} />
    </svg>
  );
}

// ---------------------------------------------------------------- Tag

/**
 * A tag — the radius-6 soft square, no border. `soft` = main-colour soft (default),
 * `plain` = grey (roles, sources, types). Coloured option values are `CellTags` / option tones, statuses are
 * `StatusBadge`. `title` becomes the dark Tooltip.
 */
export function Tag({ children, variant = "soft", title, size = "md" }: { children: ReactNode; variant?: "soft" | "plain"; title?: string; size?: "sm" | "md" }) {
  return <span className="aui-tag" data-variant={variant === "plain" ? undefined : "soft"} data-size={size === "sm" ? "sm" : undefined} {...tipProps(title)}>{children}</span>;
}

// ---------------------------------------------------------------- AsyncSwitch

/** A switch that saves at once: disabled while saving, flips back and notifies when the save fails. */
export function AsyncSwitch({ id, checked, label, disabled, onChange }: { id?: string; checked: boolean; label: string; disabled?: boolean; onChange: (next: boolean) => Promise<void> }) {
  const notify = useNotify();
  const [pending, setPending] = useState(false);
  return (
    <Switch
      id={id}
      checked={checked}
      disabled={disabled || pending}
      aria-label={label}
      aria-busy={pending || undefined}
      onCheckedChange={(next) => {
        setPending(true);
        onChange(next)
          .catch((error: unknown) => notify(error instanceof Error ? error.message : String(error), "error"))
          .finally(() => setPending(false));
      }}
    />
  );
}

// ---------------------------------------------------------------- CopyBlock

/** A command / connection string in a monospace block with a copy button (one line or multi-line). */
export function CopyBlock({ value, label, hint }: { value: string; label: string; hint?: ReactNode }) {
  return (
    <div className="aui-copyblock">
      <pre aria-label={label}>{value}</pre>
      <div className="aui-copyblock-actions"><CopyButton text={value} label={label} /></div>
      {hint && <p className="aui-note">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Meter

/** Share of a total (CPU, disk, quota): attention from `warnAt` (default 0.8), danger from `dangerAt` (0.95). */
export function Meter({ label, ratio, detail, warnAt = 0.8, dangerAt = 0.95, tone: forced, size = 6, value: shownValue }: {
  label: string;
  ratio: number | null;
  detail?: ReactNode;
  warnAt?: number;
  dangerAt?: number;
  /** Fixed colour instead of the thresholds: progress bars are 「brand」 at any %, a waiting item is attention. */
  tone?: "brand" | "attention" | "danger";
  /** Bar height 4 · 6 (default) · 8. */
  size?: 4 | 6 | 8;
  /** The number on the right instead of the percentage (「38 / 50 席」). */
  value?: ReactNode;
}) {
  const r = ratio === null || !Number.isFinite(ratio) ? null : Math.min(1, Math.max(0, ratio));
  const tone = forced ? (forced === "brand" ? undefined : forced) : r === null ? undefined : r >= dangerAt ? "danger" : r >= warnAt ? "attention" : undefined;
  return (
    <div className="aui-meter" data-tone={tone} data-size={size === 6 ? undefined : String(size)}>
      <div className="aui-meter-head"><span>{label}</span><b>{shownValue ?? (r === null ? "—" : `${Math.round(r * 100)}%`)}</b></div>
      <span className="aui-meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={r === null ? undefined : Math.round(r * 100)}><i style={{ width: `${(r ?? 0) * 100}%` }} /></span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

// ---------------------------------------------------------------- SharePicker

export type ShareSubject = { id: string; name: string; hint?: string; group?: boolean };
export type ShareGrant = { id: string; level: string };
/**
 * Share with people / groups: search, tick, and a level per chosen subject (可看 / 可看密码 …). Same as
 * GrantList mode "list" (grant-list.tsx); GrantList mode "picked" is the 「已选的人 + 搜索添加」 form.
 */
export function SharePicker({ subjects, value, onChange, levels, label = "分享给" }: { subjects: readonly ShareSubject[]; value: readonly ShareGrant[]; onChange: (next: ShareGrant[]) => void; levels: readonly { value: string; label: string }[]; label?: string }) {
  return <GrantList mode="list" subjects={subjects} value={value} onChange={onChange} levels={levels} label={label} />;
}
