"use client";
/** QueryBar (moved out of data.tsx; still exported from it and from the root entry). */
import type { ReactNode } from "react";
import { Button } from "./primitives.tsx";
import { SearchBox } from "./search.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
/**
 * Search + filters above a list: the search filters as you type (0.3 s after the last
 * key) — there are no 查询 / 重置 buttons any more; slow lists (audit logs) pass `searchMode="enter"` and the
 * box says 「回车搜索」. Clearing the box (×, Esc) searches again at once. `onReset` is offered as a quiet
 * 「清空筛选」 text button only while `canReset` is true (some filter is set). `variant`: "card" (default, its own
 * card above a table), "flush" (a flat strip with a bottom line), "bare" (no frame: inside a Pane header or
 * ResourcePanel `filters`).
 */
export function QueryBar({
  value,
  onChange,
  onSearch,
  onReset,
  children,
  placeholder = "输入关键词搜索",
  variant = "card",
  searchMode = "live",
  hits,
  canReset,
  shortcut,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Run the search with the current text (called debounced while typing in live mode, on Enter in enter mode). */
  onSearch: () => void;
  /** Clear every filter; shown as 「清空筛选」 only while `canReset`. */
  onReset: () => void;
  children?: ReactNode;
  placeholder?: string;
  variant?: "card" | "flush" | "bare";
  /** live (default) = filter as you type · enter = slow lists (audit logs) search on Enter. */
  searchMode?: "live" | "enter";
  /** Number of matches, shown in the box while there is a query. */
  hits?: number | null;
  /** Show 「清空筛选」 (some filter besides the text is set). */
  canReset?: boolean;
  /** Key that focuses the search from anywhere ("/"). */
  shortcut?: string;
}) {
  return (
    <form
      className="aui-query"
      data-variant={variant === "card" ? undefined : variant}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      <div className="aui-query-search">
        <SearchBox value={value} onChange={onChange} onSearch={() => onSearch()} mode={searchMode} placeholder={placeholder} label="搜索关键词" hits={hits} shortcut={shortcut} inputRole="textbox" />
      </div>
      {children}
      {canReset && (
        <div className="aui-query-actions">
          <Button variant="text" size="sm" onClick={onReset}>
            清空筛选
          </Button>
        </div>
      )}
    </form>
  );
}
