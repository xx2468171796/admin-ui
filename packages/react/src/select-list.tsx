"use client";
/**
 * SelectList (T09 / T10 left list; moved out of page-templates.tsx, still exported from it). * rows 36px (two lines 52, phones 44), icons plain 16px in the note colour (no green circle), selected =
 * primary soft background + bold, right side (meta / unread count) vertically centred, unread = bold name +
 * primary count badge, search hits highlighted, no-match line with an optional create action, skeleton rows
 * while loading. Styles: styles/templates.css (.aui-slist*).
 */
import { Fragment, useState, type ReactNode } from "react";
import { SearchBox } from "./search.tsx";
import { avatarTone } from "./avatar-core.ts";
import { SkeletonBlock } from "./loading.tsx";
import { highlightParts } from "./timeline-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/templates.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/templates.css";

export type SelectListItem = {
  key: string;
  title: ReactNode;
  /** Second line (last message, members): makes the row a two-line row (52px). */
  hint?: ReactNode;
  /** Right side: 「5 台」「04:31」. */
  meta?: ReactNode;
  /** A plain 16px icon in the note colour (groups, roles) … */
  icon?: ReactNode;
  /** … or a letter avatar (people, chats): the colour follows the person (`key`). */
  avatar?: string;
  /** Group heading the item sits under (人员组 / 人员, 今天 / 昨天). Items of a group must be adjacent. */
  group?: string;
  /** Unread without a number: bold name + a small dot on the right. */
  unread?: boolean;
  /** Unread messages: bold name + a primary count badge on the right (99+ above 99). */
  unreadCount?: number;
  /** Text the search matches (default: title + hint when they are strings). */
  text?: string;
};
export type SelectListProps = {
  items: readonly SelectListItem[];
  selected: string | null;
  onSelect: (key: string) => void;
  label: string;
  /** Show a search box on top (placeholder text); filters by `text`, highlights the hit in string titles. */
  search?: string;
  /** Header content instead of / next to the search (e.g. a 「新建」 icon button). */
  toolbar?: ReactNode;
  /** Shown when there are no items at all (「还没有表」). */
  emptyLabel?: string;
  /** Shown when the search hides every item (default 「没有找到「…」」) — never the empty label, which reads as "nothing exists". */
  noMatchLabel?: (query: string) => string;
  /** No match: offer 「或新建这个…」 with the typed text. */
  onCreate?: (query: string) => void;
  /** Text of the create link (default 「新建一个」). */
  createLabel?: string;
  /** First load: skeleton rows instead of items. */
  loading?: boolean;
};
const noMatchDefault = (query: string) => `没有找到「${query}」`;

function Highlight({ text, query }: { text: ReactNode; query: string }) {
  if (typeof text !== "string" || !query) return <>{text}</>;
  return <>{highlightParts(text, query).map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <Fragment key={i}>{part.text}</Fragment>))}</>;
}

function ItemRow({ item, on, query, onSelect }: { item: SelectListItem; on: boolean; query: string; onSelect: (key: string) => void }) {
  const count = item.unreadCount !== undefined && item.unreadCount > 0 ? item.unreadCount : 0;
  const unread = count > 0 || Boolean(item.unread);
  return (
    <button type="button" className="aui-slist-item" aria-current={on || undefined} data-two={item.hint ? "" : undefined} data-unread={unread || undefined} onClick={() => onSelect(item.key)}>
      {item.avatar !== undefined ? (
        <span className="aui-avatar" data-size={item.hint ? "24" : "20"} data-tone={avatarTone(item.key)} aria-hidden="true">{item.avatar}</span>
      ) : item.icon ? (
        <span className="aui-slist-icon" aria-hidden="true">{item.icon}</span>
      ) : null}
      <span className="aui-slist-text">
        <b><Highlight text={item.title} query={query} /></b>
        {item.hint && <small><Highlight text={item.hint} query={query} /></small>}
      </span>
      {(item.meta || unread) && (
        <span className="aui-slist-side">
          {item.meta && <span className="aui-slist-meta">{item.meta}</span>}
          {count > 0 ? (
            <span className="aui-slist-badge" aria-label={`${count} 条未读`}>{count > 99 ? "99+" : count}</span>
          ) : unread ? (
            <span className="aui-slist-dot" role="img" aria-label="有新消息" />
          ) : null}
        </span>
      )}
    </button>
  );
}

/** The left list of a list-detail page: optional search, group headings with counts, one selectable row per item. */
export function SelectList({ items, selected, onSelect, label, search, toolbar, emptyLabel = "没有匹配的项", noMatchLabel = noMatchDefault, onCreate, createLabel = "新建一个", loading }: SelectListProps) {
  const [q, setQ] = useState("");
  const query = q.trim();
  const words = query.toLowerCase();
  const textOf = (item: SelectListItem) => (item.text ?? [item.title, item.hint].filter((v) => typeof v === "string").join(" ")).toLowerCase();
  const shown = words ? items.filter((item) => textOf(item).includes(words)) : items;
  const groupCount = new Map<string, number>();
  for (const item of shown) if (item.group !== undefined) groupCount.set(item.group, (groupCount.get(item.group) ?? 0) + 1);
  let lastGroup: string | undefined;
  return (
    <div className="aui-slist" aria-busy={loading || undefined}>
      {(search !== undefined || toolbar) && (
        <div className="aui-slist-head">
          {search !== undefined && (
            <span className="aui-search-field" data-size="sm">
              <SearchBox value={q} onChange={setQ} placeholder={search} label={`${label}搜索`} size="sm" />
            </span>
          )}
          {toolbar}
        </div>
      )}
      <ul className="aui-slist-items" aria-label={label}>
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="aui-slist-skel" aria-hidden="true">
                <SkeletonBlock width={16} height={16} />
                <SkeletonBlock width={`${[62, 48, 74, 55][i] ?? 60}%`} />
              </li>
            ))
          : shown.map((item) => {
              const heading = item.group !== undefined && item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <Fragment key={item.key}>
                  {heading !== null && (
                    <li className="aui-slist-group" aria-hidden="true">
                      <span>{heading}</span>
                      <span className="aui-slist-group-count">{groupCount.get(heading) ?? 0}</span>
                    </li>
                  )}
                  <li>
                    <ItemRow item={item} on={item.key === selected} query={query} onSelect={onSelect} />
                  </li>
                </Fragment>
              );
            })}
        {!loading && !shown.length && (
          <li className="aui-slist-empty">
            {words && items.length ? (
              <>
                <b>{noMatchLabel(query)}</b>
                <span>
                  换个关键词{onCreate && <>，或<button type="button" className="aui-slist-create" onClick={() => onCreate(query)}>{createLabel}</button></>}
                </span>
              </>
            ) : (
              emptyLabel
            )}
          </li>
        )}
      </ul>
      {loading && <span className="aui-sr-only" role="status">正在加载{label}…</span>}
    </div>
  );
}
