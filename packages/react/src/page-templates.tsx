"use client";
/**
 * Page templates (T01–T14; screenshots of the starter pages in design/templates/):
 * every admin page starts from one of 14 templates — the layout is fixed, only the content changes
 * per business. This module holds the blocks and layouts the templates need on top of the kit:
 *
 * Blocks: StatStrip, ActionList, TodoInbox, QuickLinks, PresenceList, BarList, RatioBar, InfoList,
 *   ChoiceTiles, ChangeMark, SaveBar, SearchField, SelectList, Pane, PaneSection, LogTimeline,
 *   WorkItemCard, WorkItemList, ChatMessage, ToolCallCard, Composer.
 * Layouts: SplitLayout, SideNavLayout, ListDetailLayout, WorkspaceLayout, WizardLayout, GraphLayout.
 *
 * Which template uses what: PAGE-TEMPLATES.md and PAGE_TEMPLATES in catalog.ts. Colours only from
 * the palette tokens, no decorative colour bars (state = tinted background + border + text + icon).
 * Styles: styles/templates.css.
 */
import { Fragment, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Pencil, TriangleAlert, X } from "lucide-react";
import { Button, StatusBadge, Textarea } from "./primitives.tsx";
import { Panel } from "./layout.tsx";
import { HelpTip } from "./help-tip.tsx";
import { IconBlock, Meter, Steps, type KitTone, type StepItem } from "./kit.tsx";
import { RowActionBar, RowActions, type RowAction } from "./row-actions.tsx";
import { SegmentedControl } from "./choices.tsx";
import { spaceBelow, workspaceHeights, type WorkspaceHeights } from "./workspace-core.ts";
import { useNotify } from "./notifications.tsx";
import { SearchBox } from "./search.tsx";
import { avatarTone } from "./avatar-core.ts";

const cssVars = (vars: Record<string, string>) => vars as CSSProperties;
const letterOf = (name: ReactNode) => (typeof name === "string" ? name.trim().slice(0, 1) : "");

// ---------------------------------------------------------------- StatStrip (T01 / T04 / T13)

export type StatItem = {
  key: string;
  label: string;
  /** Small icon before the label (lucide element). */
  icon?: ReactNode;
  /** Pre-formatted value; null renders 「—」, never 0. */
  value: ReactNode | null;
  unit?: string;
  /** One grey line under the value: comparison, breakdown, why. */
  note?: ReactNode;
  /** Colour of the value when the number itself needs attention (7 天内到期 1). */
  tone?: "attention" | "danger";
  /** Colour of the note: brand = good change, attention / danger = look at it. */
  noteTone?: "brand" | "attention" | "danger";
  /**
   * Clickable cell (8.0.2): usually filters the list below. The whole cell is the target,
   * hover = tinted background, keyboard focus ring; `selected` = brand-tinted (the active filter).
   */
  onSelect?: () => void;
  /** The cell is a link (another page / a filtered list). `onSelect` wins when both are given. */
  href?: string;
  /** The active cell (the filter in use): brand tint, aria-pressed / aria-current. */
  selected?: boolean;
};
export type StatStripProps = {
  items: readonly StatItem[];
  /** Card title (「运营概况」). Leave out for a bare strip card. */
  title?: string;
  count?: ReactNode;
  description?: ReactNode;
  /** Header buttons / LiveStatus / range picker. */
  actions?: ReactNode;
  /** Accessible name when there is no title. */
  label?: string;
};
/**
 * One card with a row of 4–6 numbers (icon label, value + unit, one note line), divided by thin
 * lines — the compact top strip of a workbench / stats / personal page. Not for 3 numbers that
 * each need a comparison and trend (KpiGrid) and never more than 6 (split into sections).
 */
export function StatStrip({ items, title, count, description, actions, label }: StatStripProps) {
  const id = useId();
  const strip = (
    <dl className="aui-stat-strip" data-cols={Math.min(Math.max(items.length, 1), 6)} aria-label={title ? undefined : label}>
      {items.map((item, i) => {
        const named = `${id}-${i}-l ${id}-${i}-v`;
        // The hit area is a real button / link stretched over the whole cell (dl > div may only hold dt / dd).
        const hit = item.onSelect ? (
          <button type="button" className="aui-stat-hit" aria-labelledby={named} aria-pressed={item.selected ?? undefined} onClick={item.onSelect} />
        ) : item.href ? (
          <a className="aui-stat-hit" href={item.href} aria-labelledby={named} aria-current={item.selected ? "true" : undefined} />
        ) : null;
        return (
          <div key={item.key} className="aui-stat" data-tone={item.tone} data-clickable={hit ? true : undefined} data-selected={hit && item.selected ? true : undefined}>
            <dt id={`${id}-${i}-l`}>{item.icon}{item.label}</dt>
            <dd>
              <strong id={`${id}-${i}-v`}>{item.value ?? "—"}{item.unit && item.value !== null && item.value !== undefined && <small>{item.unit}</small>}</strong>
              {item.note && <span data-tone={item.noteTone}>{item.note}</span>}
              {hit}
            </dd>
          </div>
        );
      })}
    </dl>
  );
  return <Panel title={title} count={count} description={description} actions={actions} flush>{strip}</Panel>;
}

// ---------------------------------------------------------------- ActionList (T01 / T03 / T13 rows)

/** A row action; `primary` = the filled main button of a to-do row (at most one). */
export type ListAction = RowAction & { primary?: boolean };
export type ActionListItem = {
  key: string;
  /** Icon in a tinted square (tone = state: attention / danger / info; brand by default). */
  icon?: ReactNode;
  tone?: KitTone;
  /** A letter avatar instead of the icon square (people, AI agents: `bot`). */
  avatar?: string;
  bot?: boolean;
  title: ReactNode;
  /** One grey line, truncated with an ellipsis. */
  detail?: ReactNode;
  /** A StatusBadge after the text (可达 / 3 天后到期). */
  badge?: ReactNode;
  /** Short grey text before the buttons: 「2 天了」「18 分钟前」. */
  meta?: ReactNode;
  actions?: readonly ListAction[];
};
export type ActionListProps = {
  items: readonly ActionListItem[];
  /** Accessible name of the list. */
  label: string;
  /**
   * buttons = to-do style: up to 2 real buttons (primary filled, other outlined), the rest in ⋯.
   * inline (default) = small ghost buttons (icon + word) like a table row, at most 3, the rest in ⋯.
   */
  actionStyle?: "buttons" | "inline";
  /** Shown (with a tick) when there are no rows. */
  emptyLabel?: ReactNode;
  /** One-line rows (42px, normal-weight title): a 「recent activity」 feed. */
  dense?: boolean;
  /** Let the grey line wrap (FAQ answers) instead of cutting it with an ellipsis. */
  wrap?: boolean;
};
/** Rows of 「icon · title + one grey line · badge · meta · buttons」, all the same height. */
export function ActionList({ items, label, actionStyle = "inline", emptyLabel, dense, wrap }: ActionListProps) {
  if (!items.length) return emptyLabel ? <p className="aui-alist-empty"><CircleCheck aria-hidden="true" />{emptyLabel}</p> : null;
  return (
    <ul className="aui-alist" aria-label={label} data-dense={dense || undefined} data-wrap={wrap || undefined}>
      {items.map((item) => (
        <li key={item.key} className="aui-alist-row">
          {item.avatar !== undefined ? <span className="aui-avatar" data-size="32" data-bot={item.bot || undefined} data-tone={avatarTone(item.key)} aria-hidden="true">{item.avatar}</span> : item.icon && <IconBlock tone={item.tone ?? "brand"}>{item.icon}</IconBlock>}
          <div className="aui-alist-text">
            {dense ? <span>{item.title}</span> : <b>{item.title}</b>}
            {item.detail && <small>{item.detail}</small>}
          </div>
          {item.badge}
          {item.meta && <span className="aui-alist-meta">{item.meta}</span>}
          {item.actions && item.actions.length > 0 && (
            <div className="aui-alist-actions">
              {actionStyle === "buttons" ? <ButtonActions actions={item.actions} label={`${typeof item.title === "string" ? item.title : ""}的更多操作`} /> : <RowActionBar actions={item.actions} label={`${typeof item.title === "string" ? item.title : ""}的更多操作`} />}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
function ButtonActions({ actions, label }: { actions: readonly ListAction[]; label: string }) {
  const shown = actions.filter((a) => !(a.menuOnly ?? a.destructive)).slice(0, 2);
  const rest = actions.filter((a) => !shown.includes(a));
  return (
    <>
      {shown.map((a) => (
        <Button key={a.key} size="sm" variant={a.primary ? "default" : "outline"} data-destructive={a.destructive || undefined} disabled={a.disabled} disabledReason={a.disabled ? a.disabledReason : undefined} aria-label={a.ariaLabel} onClick={() => a.onSelect()}>
          {a.icon}{a.label}
        </Button>
      ))}
      {rest.length > 0 && <RowActions label={label} actions={rest} />}
    </>
  );
}

// ---------------------------------------------------------------- TodoInbox (T01 / T03 / T13)

export type TodoItem = ActionListItem & {
  /** Keys of the filters this item belongs to (besides 「全部」). */
  filters?: readonly string[];
};
export type TodoFilter = { key: string; label: string };
export type TodoInboxProps = {
  items: readonly TodoItem[];
  /** Card title, default 「待办」. */
  title?: string;
  description?: ReactNode;
  /** Segments after 「全部」 (今天 / 知道一下); counts are added automatically. */
  filters?: readonly TodoFilter[];
  /** Things that are fine: a list of short texts (shown as chips after 「没问题的：」) or one sentence. */
  ok?: readonly string[] | ReactNode;
  okLabel?: string;
  /** Shown when nothing is left in the current filter. */
  emptyLabel?: string;
  /** Extra header buttons. */
  actions?: ReactNode;
  /** Let the grey line wrap instead of ellipsis (default true: error text must stay readable). */
  wrap?: boolean;
};
/**
 * 「What needs me」: header with count + 「?」 + segmented filter with counts, one row per item
 * (icon square, title, one grey line, meta, up to 2 buttons), a footer line that folds everything
 * that is fine into chips, and an empty state. Rows are sorted by the host (most urgent first).
 */
export function TodoInbox({ items, title = "待办", description, filters, ok, okLabel = "没问题的", emptyLabel = "都处理完了", actions, wrap = true }: TodoInboxProps) {
  const [filter, setFilter] = useState("all");
  const all = [{ key: "all", label: "全部" }, ...(filters ?? [])];
  const countOf = (key: string) => (key === "all" ? items.length : items.filter((i) => i.filters?.includes(key)).length);
  const shown = filter === "all" ? items : items.filter((i) => i.filters?.includes(filter));
  const okList = Array.isArray(ok) ? (ok as readonly string[]) : null;
  return (
    <Panel
      title={title}
      count={items.length}
      description={description}
      flush
      actions={
        filters?.length || actions ? (
          <>
            {filters?.length ? <SegmentedControl size="sm" label={`${title}分类`} value={filter} onValueChange={setFilter} options={all.map((f) => ({ value: f.key, label: `${f.label} ${countOf(f.key)}` }))} /> : null}
            {actions}
          </>
        ) : undefined
      }
    >
      <ActionList items={shown} label={title} actionStyle="buttons" emptyLabel={emptyLabel} wrap={wrap} />
      {ok !== undefined && ok !== null && (
        <div className="aui-todo-ok">
          <Check aria-hidden="true" />
          {okList ? (
            <>
              <span>{okLabel}：</span>
              {okList.map((text) => <StatusBadge key={text} tone="success">{text}</StatusBadge>)}
            </>
          ) : (
            <span>{ok as ReactNode}</span>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- QuickLinks (T01)

export type QuickLink = { key: string; label: string; icon: ReactNode; onSelect?: () => void; href?: string };
/** Grid of icon tiles to the most used pages (4 per row in a 340px rail). */
export function QuickLinks({ items, columns = 4, label = "常用入口" }: { items: readonly QuickLink[]; columns?: 3 | 4 | 5 | 6; label?: string }) {
  return (
    <ul className="aui-quicklinks" data-columns={columns} aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          {item.href ? (
            <a className="aui-quicklink" href={item.href} onClick={item.onSelect ? (e) => { e.preventDefault(); item.onSelect!(); } : undefined}>
              <IconBlock size="sm">{item.icon}</IconBlock>{item.label}
            </a>
          ) : (
            <button type="button" className="aui-quicklink" onClick={item.onSelect}>
              <IconBlock size="sm">{item.icon}</IconBlock>{item.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- PresenceList (T01)

export type PresencePerson = { key: string; name: string; hint?: ReactNode; status?: ReactNode; avatar?: string; bot?: boolean };
export type PresenceListProps = {
  people: readonly PresencePerson[];
  title?: string;
  /** 「2 人」 */
  count?: ReactNode;
  description?: ReactNode;
  /** LiveStatus etc. */
  actions?: ReactNode;
  /** A row of small counts above the list (SSH 0 · 网页终端 0 · AI 2). */
  summary?: readonly { key: string; label: string; value: ReactNode }[];
  emptyLabel?: string;
};
/** Who / which agents are online right now: optional counts row + one line per person with a status chip. */
export function PresenceList({ people, title = "此刻在线", count, description, actions, summary, emptyLabel = "现在没人在线" }: PresenceListProps) {
  return (
    <Panel title={title} count={count} description={description} actions={actions} flush>
      {summary && summary.length > 0 && (
        <dl className="aui-presence-sum" data-cols={Math.min(summary.length, 4)}>
          {summary.map((s) => <div key={s.key}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
        </dl>
      )}
      {people.length ? (
        <ul className="aui-presence" aria-label={title}>
          {people.map((p) => (
            <li key={p.key}>
              <span className="aui-avatar" data-size="32" data-bot={p.bot || undefined} data-tone={avatarTone(p.key)} aria-hidden="true">{p.avatar ?? letterOf(p.name)}</span>
              <span className="aui-presence-text"><b>{p.name}</b>{p.hint && <small>{p.hint}</small>}</span>
              {p.status}
            </li>
          ))}
        </ul>
      ) : (
        <p className="aui-alist-empty">{emptyLabel}</p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- RatioBar / BarList (T04)

/** A small inline bar + percentage (share of a total) for table cells and bar lists. */
export function RatioBar({ ratio, label, showValue = true, tone = "brand" }: { ratio: number | null; label: string; showValue?: boolean; tone?: "brand" | "attention" | "danger" }) {
  const r = ratio === null || !Number.isFinite(ratio) ? null : Math.min(1, Math.max(0, ratio));
  const pct = r === null ? null : Math.round(r * 100);
  return (
    <span className="aui-ratio" data-tone={tone === "brand" ? undefined : tone}>
      <span className="aui-ratio-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}><i style={{ width: `${pct ?? 0}%` }} /></span>
      {showValue && <b>{pct === null ? "—" : `${pct}%`}</b>}
    </span>
  );
}
export type BarListItem = { key: string; label: ReactNode; hint?: ReactNode; ratio: number | null; value: ReactNode; avatar?: string };
/** Ranked or shared amounts as rows: (rank) (avatar) label + grey hint, bar, value on the right. */
export function BarList({ items, label, ranked = false }: { items: readonly BarListItem[]; label: string; ranked?: boolean }) {
  const hasAvatar = items.some((i) => i.avatar);
  return (
    <ol className="aui-barlist" aria-label={label} data-ranked={ranked || undefined} data-avatar={hasAvatar || undefined}>
      {items.map((item, i) => (
        <li key={item.key}>
          {ranked && <span className="aui-barlist-rank">{i + 1}</span>}
          {hasAvatar && <span className="aui-avatar" data-size="24" data-tone={avatarTone(item.key)} aria-hidden="true">{item.avatar ?? ""}</span>}
          <span className="aui-barlist-label">{item.label}{item.hint && <small>{item.hint}</small>}</span>
          <RatioBar ratio={item.ratio} label={typeof item.label === "string" ? item.label : label} showValue={false} />
          <b className="aui-barlist-value">{item.value}</b>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- InfoList (T10 / T12)

export type InfoItem = { key: string; icon?: ReactNode; label: ReactNode; value?: ReactNode; mono?: boolean };
/** Compact rows 「icon · label … value」 for a side pane (tools, recent joins, small facts). */
export function InfoList({ items, label }: { items: readonly InfoItem[]; label: string }) {
  return (
    <ul className="aui-infolist" aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          {item.icon}
          <span className="aui-infolist-label" data-mono={item.mono || undefined}>{item.label}</span>
          {item.value !== undefined && <span className="aui-infolist-value">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- ChoiceTiles (T12)

export type ChoiceTileOption<V extends string = string> = { value: V; label: string; hint?: ReactNode; icon?: ReactNode; disabled?: boolean };
/** Pick one of 2–4 big options (系统 Linux / Windows / macOS) as tiles with a radio mark; arrow keys move. */
export function ChoiceTiles<V extends string = string>({ id, options, value, onValueChange, label, columns }: { id?: string; options: readonly ChoiceTileOption<V>[]; value: V; onValueChange: (value: V) => void; label: string; columns?: 2 | 3 | 4 }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    for (let n = 1; n <= options.length; n++) {
      const i = (index + step * n + options.length) % options.length;
      const option = options[i];
      if (option && !option.disabled) {
        onValueChange(option.value);
        refs.current[i]?.focus();
        return;
      }
    }
  };
  return (
    <div id={id} className="aui-choice-tiles" role="radiogroup" aria-label={label} data-columns={columns ?? Math.min(options.length, 4)}>
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={option.disabled}
            className="aui-choice-tile"
            onClick={() => onValueChange(option.value)}
            onKeyDown={(e) => move(e, i)}
          >
            {option.icon && <IconBlock size="sm">{option.icon}</IconBlock>}
            <span className="aui-choice-tile-text"><b>{option.label}</b>{option.hint && <small>{option.hint}</small>}</span>
            <span className="aui-choice-tile-radio" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- ChangeMark (T09)

/** Marks a cell / value changed but not saved yet (soft main-colour box); pair it with an inline SaveBar. */
export function ChangeMark({ changed, children, label = "改过、还没保存" }: { changed?: boolean; children?: ReactNode; label?: string }) {
  return (
    <span className="aui-change-mark" data-changed={changed || undefined} data-tip={changed ? label : undefined}>
      {children}
      {changed && <span className="aui-sr-only">（{label}）</span>}
    </span>
  );
}

// ---------------------------------------------------------------- SaveBar (T08 / T09)

export type SaveBarProps = {
  /** Number of unsaved changes; with 0 changes and 0 errors the bar is not shown. */
  count: number;
  /** Which fields: 「更新通道 · 语音播报」. */
  summary?: ReactNode;
  /** Fields with an invalid value. */
  errors?: number;
  onDiscard: () => void;
  /** Await the real save; a rejection keeps the bar and shows the message. */
  onSave: () => void | Promise<void>;
  /**
   * sticky = floats at the bottom of a settings page (T08); inline = a soft bar under a matrix (T09);
   * footer = the fixed bottom row of a settings sheet (SettingsSheet): always shown — 「改了 N 处」 on
   * the left when something changed, 取消 (`onDiscard`) + 保存 (disabled until something changed) on the right.
   */
  placement?: "sticky" | "inline" | "footer";
  saveLabel?: string;
  discardLabel?: string;
};
/**
 * The one save bar of a settings page: it appears only after something changed, says
 * 「改了 N 处」 (+ which fields), and has 放弃 / 保存; changed fields carry 「已改」 (`FormField changed`, see
 * `useChangeTracker`). Switches that take effect at once are not counted. `sticky` floats at the bottom centre
 * (phones: full width at the bottom); `inline` is the soft bar under a matrix (T09).
 */
export function SaveBar({ count, summary, errors = 0, onDiscard, onSave, placement = "sticky", saveLabel = "保存", discardLabel }: SaveBarProps) {
  const notify = useNotify();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const footer = placement === "footer";
  if (count <= 0 && errors <= 0 && !footer) return null;
  const inline = placement === "inline";
  const idle = count <= 0 && errors <= 0;
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onSave();
    } catch (error) {
      setFailed(true);
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  };
  const extra = errors > 0 ? `另有 ${errors} 处填写有误` : "";
  const names = Array.isArray(summary) ? (summary as readonly ReactNode[]).join("、") : summary;
  return (
    <div className="aui-savebar" data-placement={placement} data-idle={footer && idle ? true : undefined} data-state={saving ? "saving" : failed ? "error" : undefined} role="region" aria-label={footer ? "保存" : "未保存的改动"}>
      <span className="aui-savebar-msg" aria-live="polite">
        {!(footer && idle) && (inline ? <Pencil aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />)}
        {!(footer && idle) && <b>{saving ? "正在保存…" : `改了 ${count} 处`}</b>}
        {(names || extra) && <small>{names}{names && extra ? "；" : ""}{extra}</small>}
      </span>
      <span className="aui-savebar-actions">
        <Button size={inline ? "sm" : "default"} variant={inline || footer ? "outline" : "ghost"} disabled={saving} onClick={onDiscard}>{discardLabel ?? (inline ? "撤销" : footer ? "取消" : "放弃")}</Button>
        <Button size={inline ? "sm" : "default"} loading={saving} loadingText="保存中…" disabled={(errors > 0 && count <= 0) || (footer && idle)} onClick={save}>{saveLabel}</Button>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- SearchField

/**
 * A search box with the magnifier inside (list panes, card headers). Filters as you type (`onChange` on every
 * key); `hits` shows 「命中 N 条」, `shortcut="/"` focuses it from anywhere, Esc / × empties it.
 */
export function SearchField({ value, onChange, placeholder = "搜索", label, size = "md", hits, shortcut, variant }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string; size?: "sm" | "md"; hits?: number | null; shortcut?: string; variant?: "default" | "subtle" }) {
  return (
    <span className="aui-search-field" data-size={size === "sm" ? "sm" : undefined}>
      <SearchBox value={value} onChange={onChange} placeholder={placeholder} label={label} size={size} hits={hits} shortcut={shortcut} variant={variant} />
    </span>
  );
}

// ---------------------------------------------------------------- SelectList (T09 / T10): select-list.tsx

export { SelectList, type SelectListItem, type SelectListProps } from "./select-list.tsx";

// ---------------------------------------------------------------- Pane / PaneSection (T07 / T09 / T10)

/**
 * Standard attributes of the root `<section>` that pass through (`id`, `className` — merged with
 * `aui-pane` — `style`, `hidden`, `aria-*`, `data-*`, DOM events such as `onContextMenuCapture`).
 * `title` / `children` are Pane's own props; the `data-bare` / `data-padding` / `data-fill` hooks stay Pane's.
 */
export type PaneRootProps = Omit<ComponentPropsWithoutRef<"section">, "title" | "children">;
export type PaneProps = PaneRootProps & {
  /** The root `<section>` (React 19 ref as a prop). */
  ref?: Ref<HTMLElement>;
  title?: ReactNode;
  /** Icon square before the title. */
  icon?: ReactNode;
  /** Grey line under / after the title. */
  hint?: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  /** Buttons at the right of the header. */
  actions?: ReactNode;
  /** Custom header content instead of icon / title / hint (a search box). */
  header?: ReactNode;
  /** Pinned under the body (composer, 「打开详情」 buttons). */
  footer?: ReactNode;
  children?: ReactNode;
  /** No card border / radius: a pane inside another card (detail side of a list-detail page). */
  bare?: boolean;
  /** Accessible name when the title is not a string. */
  label?: string;
  /**
   * Inner padding of the body. Default "none": content runs edge to edge (lists, tables, grids — they
   * go flush by themselves); "sm" = 8px 12px, "md" = 12px 16px for loose content (forms, text, cards).
   */
  padding?: "none" | "sm" | "md";
  /**
   * Stack the body's blocks top to bottom and let the last one take the remaining height (toolbar →
   * view, query bar → table): the body no longer scrolls, the last block scrolls on its own.
   */
  fill?: boolean;
  /** Banner between the header and the body (an InlineAlert): gets its own inset, never touches the pane edges. */
  notice?: ReactNode;
};
/** A column of a work area: header, notice, body that scrolls on its own (when the pane has a fixed height), footer. */
export function Pane({ ref, title, icon, hint, count, description, actions, header, footer, children, bare, label, padding = "none", fill, notice, className, "aria-label": ariaLabel, ...rest }: PaneProps) {
  const hasHead = Boolean(header || title || actions || icon);
  return (
    <section {...rest} ref={ref} className={className ? `aui-pane ${className}` : "aui-pane"} data-bare={bare || undefined} data-padding={padding === "none" ? undefined : padding} data-fill={fill || undefined} aria-label={label ?? ariaLabel ?? (typeof title === "string" ? title : undefined)}>
      {hasHead && (
        <div className="aui-pane-head">
          {header ?? (
            <>
              {icon && <IconBlock size="sm">{icon}</IconBlock>}
              <div className="aui-pane-title">
                <h2><span className="aui-pane-title-text">{title}</span>{count !== undefined && <span className="aui-panel-count">{count}</span>}</h2>
                {hint && <small>{hint}</small>}
              </div>
              {description && <HelpTip label={`${typeof title === "string" ? title : ""}说明`}>{description}</HelpTip>}
            </>
          )}
          {actions && <div className="aui-pane-actions">{actions}</div>}
        </div>
      )}
      {notice && <div className="aui-pane-notice">{notice}</div>}
      <div className="aui-pane-body">{children}</div>
      {footer && <div className="aui-pane-foot">{footer}</div>}
    </section>
  );
}
/**
 * A titled block inside a Pane or flush Panel (当前机器 / 可用工具 / SSH 公钥), separated by a line;
 * `flush` = the content runs edge to edge (list rows) and the title sits on a tinted band.
 */
export function PaneSection({ title, icon, count, actions, children, flush }: { title: string; icon?: ReactNode; count?: ReactNode; actions?: ReactNode; children?: ReactNode; flush?: boolean }) {
  return (
    <section className="aui-pane-section" data-flush={flush || undefined} aria-label={title}>
      <div className="aui-pane-section-head">
        {icon}
        <h3>{title}</h3>
        {count !== undefined && <span className="aui-panel-count">{count}</span>}
        {actions && <span className="aui-pane-section-actions">{actions}</span>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- SplitLayout (T01 / T04 / T13)

/** Main column + a right rail (default 340px) of smaller cards; stacks under 1100px. */
export function SplitLayout({ children, rail, railWidth = 340 }: { children: ReactNode; rail: ReactNode; railWidth?: number }) {
  return (
    <div className="aui-split" data-aui-flow="columns" style={cssVars({ "--aui-rail-width": `${railWidth}px` })}>
      <div className="aui-split-main" data-aui-flow="stack">{children}</div>
      <div className="aui-split-rail" data-aui-flow="stack">{rail}</div>
    </div>
  );
}

// ---------------------------------------------------------------- SideNavLayout (T08) / ListDetailLayout (T09): nav-layouts.tsx

export { SideNavLayout, ListDetailLayout, NarrowBackBar, type SideNavSection, type ListDetailLayoutProps } from "./nav-layouts.tsx";
import { NarrowBackBar } from "./nav-layouts.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/templates.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/templates.css";

// ---------------------------------------------------------------- WorkspaceLayout (T10)

/**
 * Full-height tool page under the work tabs: left list / centre work area / right context, each a
 * Pane that scrolls on its own — the page itself never scrolls. On wide screens it sits flush against
 * the work tabs, the sidebar and the window edge (the shell drops its content padding) and the columns
 * are divided by a single line, no gaps. Under 1100px the panes stack (normal page scroll), still flush (8.6: the
 * only narrow look; the old `narrow="card"` is gone): no outer border / radius, panes edge-to-edge split by one
 * horizontal line; `narrow="steps"` shows list → detail in two steps on phones. With a `Pane fill` the stack reaches
 * down to the bottom of the shell content (the fill pane grows).
 * bottomGap: space kept under it on wide screens (0 = down to the window edge).
 */
export type WorkspaceNarrowMode = "flush" | "steps";
export function WorkspaceLayout({ left, children, right, leftWidth = 240, rightWidth = 280, bottomGap = 0, narrow = "flush", detailOpen = false, onBack, backLabel = "返回列表" }: {
  left?: ReactNode; children: ReactNode; right?: ReactNode; leftWidth?: number; rightWidth?: number; bottomGap?: number;
  /** Under 1100px the panes stack flush (default); "steps" = list → detail in two steps under 760px (`left` is the list). */
  narrow?: WorkspaceNarrowMode;
  /** narrow="steps": the detail (centre + right) is showing instead of the list. */
  detailOpen?: boolean;
  /** narrow="steps": the 「← 返回列表」 bar above the detail. */
  onBack?: () => void;
  backLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<WorkspaceHeights | null>(null);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      if (node.offsetParent === null) return;
      const next = workspaceHeights({ viewport: window.innerHeight, top: node.getBoundingClientRect().top + window.scrollY, bottomGap, below: spaceBelow(node) });
      setSize((old) => (old && old.height === next.height && Math.abs(old.fill - next.fill) < 0.5 ? old : next));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (node.parentElement) observer?.observe(node.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [bottomGap]);
  const cols = [left ? `${leftWidth}px` : null, "minmax(0,1fr)", right ? `${rightWidth}px` : null].filter(Boolean).join(" ");
  return (
    <div ref={box} className="aui-workspace" data-narrow={narrow === "steps" ? "steps" : undefined} data-step={narrow === "steps" ? (detailOpen ? "detail" : "list") : undefined} style={cssVars({ "--aui-workspace-cols": cols, ...(size ? { "--aui-workspace-height": `${size.height}px`, "--aui-workspace-fill-height": `${size.fill}px` } : {}) })}>
      {left}
      {narrow === "steps" && onBack && <NarrowBackBar label={backLabel} onBack={onBack} />}
      {children}
      {right}
    </div>
  );
}

// ---------------------------------------------------------------- Chat pieces (T10)

/** One message of a conversation: avatar, bubble (yours on the right, tinted), time line under it. */
export function ChatMessage({ author, avatar, mine, bot, time, children }: { author: string; avatar?: string; mine?: boolean; bot?: boolean; time?: ReactNode; children: ReactNode }) {
  return (
    <div className="aui-chat-msg" data-mine={mine || undefined} role="article" aria-label={`${author}的消息`}>
      <span className="aui-avatar" data-size="32" data-bot={bot || undefined} data-tone={avatarTone(author)} aria-hidden="true">{avatar ?? letterOf(author)}</span>
      <div className="aui-chat-col">
        <div className="aui-chat-bubble">{children}</div>
        {time && <small className="aui-chat-time">{time}</small>}
      </div>
    </div>
  );
}
/** A tool call inside a message: icon + command (monospace) + result chip; output folds open. */
export function ToolCallCard({ icon, title, status, children, defaultOpen = false }: { icon?: ReactNode; title: string; status?: ReactNode; children?: ReactNode; defaultOpen?: boolean }) {
  const head = (
    <>
      {icon}
      <code className="aui-toolcall-title" data-tip={title}>{title}</code>
      {status}
    </>
  );
  if (children === undefined || children === null) return <div className="aui-toolcall"><div className="aui-toolcall-head">{head}</div></div>;
  return (
    <details className="aui-toolcall" open={defaultOpen || undefined}>
      <summary className="aui-toolcall-head">{head}<ChevronDown className="aui-toolcall-chevron" aria-hidden="true" /></summary>
      <pre className="aui-toolcall-output">{children}</pre>
    </details>
  );
}
/** The scrolling message column of a conversation (ChatMessage, typing state …), 14px apart. */
export function ChatThread({ children, label = "对话" }: { children: ReactNode; label?: string }) {
  return <div className="aui-chat-thread" role="log" aria-label={label}>{children}</div>;
}
/** Message box at the bottom of a conversation: Enter sends, Shift+Enter breaks the line; tools on the left. */
export function Composer({ value, onChange, onSend, placeholder = "输入消息…", tools, hint = "Enter 发送 · Shift+Enter 换行", sendLabel = "发送", disabled }: { value: string; onChange: (value: string) => void; onSend: () => void; placeholder?: string; tools?: ReactNode; hint?: ReactNode; sendLabel?: string; disabled?: boolean }) {
  const send = () => {
    if (!disabled && value.trim()) onSend();
  };
  return (
    <form className="aui-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <Textarea
        rows={2}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="aui-composer-bar">
        {tools}
        {hint && <span className="aui-composer-hint">{hint}</span>}
        <Button type="submit" size="sm" disabled={disabled || !value.trim()}><ArrowUp />{sendLabel}</Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- WorkItemCard (T11)

export type WorkItemAttention = { label: string; text: ReactNode; action?: { label: string; onSelect: () => void } };
export type WorkItemCardProps = {
  title: string;
  /** Who works on it (an AI agent or a person) — shown with a letter avatar. */
  owner?: string;
  ownerAvatar?: string;
  /** More grey facts on the owner line: 「发起人 mia」「已跑 2 小时」. */
  facts?: readonly ReactNode[];
  steps?: readonly StepItem[];
  current?: string;
  /** 0–1; null = unknown. */
  progress?: number | null;
  /** Latest event: one grey line with an icon. */
  event?: ReactNode;
  eventIcon?: ReactNode;
  /** Row actions (查看 / 暂停 …): at most 3 shown, the rest in ⋯. */
  actions?: readonly RowAction[];
  /** Waiting for someone: amber card edge, the current step and bar turn amber, an inline confirm row. */
  attention?: WorkItemAttention;
};
/** One goal / task / job as a card: title, owner line, steps, progress, latest event, actions. */
export function WorkItemCard({ title, owner, ownerAvatar, facts, steps, current, progress, event, eventIcon, actions, attention }: WorkItemCardProps) {
  return (
    <article className="aui-workitem" data-attention={attention ? true : undefined} data-steps={steps && steps.length > 3 ? "many" : undefined} aria-label={title}>
      <div className="aui-workitem-main">
        <h3>{title}</h3>
        {(owner || facts?.length) && (
          <div className="aui-workitem-who">
            {owner && <><span className="aui-avatar" data-size="20" data-tone={avatarTone(owner)} aria-hidden="true">{ownerAvatar ?? letterOf(owner)}</span><span>{owner}</span></>}
            {facts?.map((f, i) => <Fragment key={i}><span className="aui-workitem-sep" aria-hidden="true">·</span><span>{f}</span></Fragment>)}
          </div>
        )}
        {event && <div className="aui-workitem-event">{eventIcon}{event}</div>}
      </div>
      {steps && steps.length > 0 && <div className="aui-workitem-steps"><Steps steps={steps} current={current ?? steps[0]!.key} size="sm" tone={attention ? "attention" : undefined} label={`${title}的步骤`} /></div>}
      {progress !== undefined && <div className="aui-workitem-meter"><Meter label="进度" ratio={progress} tone={attention ? "attention" : "brand"} /></div>}
      {actions && actions.length > 0 && <div className="aui-workitem-actions"><RowActionBar actions={actions} label={`${title}的更多操作`} /></div>}
      {attention && (
        <div className="aui-workitem-attention" role="status">
          <StatusBadge tone="warning">{attention.label}</StatusBadge>
          <span className="aui-workitem-attention-text">{attention.text}</span>
          {attention.action && <Button size="sm" variant="outline" onClick={attention.action.onSelect}>{attention.action.label}</Button>}
        </div>
      )}
    </article>
  );
}
/** Vertical stack of WorkItemCards (10px apart); `footer` = a summary line under them (本周已完成 6 个 · 看已完成). */
export function WorkItemList({ children, label, footer }: { children: ReactNode; label: string; footer?: ReactNode }) {
  return (
    <div className="aui-workitems" role="group" aria-label={label}>
      {children}
      {footer && <div className="aui-workitems-foot">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- WizardLayout (T12)

export type WizardLayoutProps = {
  title: string;
  description?: ReactNode;
  /** Grey sentence in the header (「关掉也没关系……」). */
  note?: ReactNode;
  onClose?: () => void;
  steps: readonly StepItem[];
  current: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  /** Why 「下一步」 cannot be pressed yet; shown next to it and disables it. */
  nextDisabledReason?: ReactNode;
  /** Right column (260px): FAQ, recent items. */
  aside?: ReactNode;
  /** Max width of the wizard card (default 880). */
  width?: number;
};
/**
 * A step-by-step page: step band, one block of content per step, back / next with the reason when blocked. In the page flow
 * (8.6.1) it is flat and edge to edge like the rest of the page; the content keeps to `width` and the aside is a column.
 */
export function WizardLayout({ title, description, note, onClose, steps, current, children, onBack, onNext, backLabel = "上一步", nextLabel = "下一步", nextDisabledReason, aside, width = 880 }: WizardLayoutProps) {
  const first = steps[0]?.key === current;
  return (
    // 8.6.1 page flush: the wizard is page flow — flat, edge to edge, the aside a column after one vertical line
    <div className="aui-wizard" data-aui-flow="columns" data-aside={aside ? true : undefined} style={cssVars({ "--aui-wizard-width": `${width}px` })}>
      <Panel
        title={title}
        description={description}
        flush
        className="aui-wizard-card"
        actions={
          note || onClose ? (
            <>
              {note && <span className="aui-wizard-note">{note}</span>}
              {onClose && <IconButton label="关闭向导" tooltip="关闭" variant="outline" onClick={onClose} icon={<X />} />}
            </>
          ) : undefined
        }
      >
        <div className="aui-wizard-steps"><Steps steps={steps} current={current} stretch label={`${title}步骤`} /></div>
        <div className="aui-wizard-body">{children}</div>
        <div className="aui-wizard-foot">
          {onBack && <Button variant="outline" disabled={first} onClick={onBack}><ChevronLeft />{backLabel}</Button>}
          {nextDisabledReason && <span className="aui-wizard-why"><TriangleAlert aria-hidden="true" />{nextDisabledReason}</span>}
          {onNext && <Button disabled={Boolean(nextDisabledReason)} onClick={onNext}>{nextLabel}<ChevronRight /></Button>}
        </div>
      </Panel>
      {aside && <div className="aui-wizard-aside" data-aui-flow="stack">{aside}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- GraphLayout (T07)

export type LegendItem = { key: string; label: string; kind?: "line" | "dashed" | "dot"; tone?: "brand" | "attention" | "danger" | "muted" };
export type GraphLayoutProps = {
  title: string;
  description?: ReactNode;
  /** Next to the title: LiveStatus. */
  live?: ReactNode;
  /** Right of the header: ChipGroup filters (只看在线 / 只看 AI). */
  filters?: ReactNode;
  legend?: readonly LegendItem[];
  /** Right end of the legend row: 「人 6 · 在线 4 · 机器 5」. */
  summary?: ReactNode;
  /** The canvas (app-provided SVG / canvas / graph library). */
  children: ReactNode;
  canvasLabel?: string;
  /** Small buttons at the bottom-right of the canvas (zoom / reset). */
  tools?: ReactNode;
  /** Selected node detail (Pane bare), 300px. */
  detail?: ReactNode;
  detailWidth?: number;
  height?: number;
};
/** Relationship graph / live monitor wall: header with live state and filters, legend row, canvas + detail panel. */
export function GraphLayout({ title, description, live, filters, legend, summary, children, canvasLabel, tools, detail, detailWidth = 300, height = 600 }: GraphLayoutProps) {
  return (
    <Panel title={title} description={description} count={live} actions={filters} flush className="aui-graph">
      {(legend?.length || summary) && (
        <div className="aui-graph-legend">
          {legend?.map((item) => (
            <span key={item.key} className="aui-legend-item">
              <i className="aui-legend-swatch" data-kind={item.kind ?? "dot"} data-tone={item.tone ?? "brand"} aria-hidden="true" />
              {item.label}
            </span>
          ))}
          {summary && <span className="aui-graph-summary">{summary}</span>}
        </div>
      )}
      <div className="aui-graph-body" data-detail={detail ? true : undefined} style={cssVars({ "--aui-graph-height": `${height}px`, "--aui-graph-detail": `${detailWidth}px` })}>
        <div className="aui-graph-canvas" role="figure" aria-label={canvasLabel ?? title}>
          {children}
          {tools && <div className="aui-graph-tools">{tools}</div>}
        </div>
        {detail && <div className="aui-graph-detail">{detail}</div>}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- LogTimeline (T06): moved to log-timeline.tsx

export * from "./log-timeline.tsx";
