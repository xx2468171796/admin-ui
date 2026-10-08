"use client";
/**
 * Search: lists filter as you type (0.3 s after the last key) — no 查询 / 重置 buttons;
 * slow lists (audit logs) keep 「回车搜索」 (`mode="enter"`). Matches are highlighted (`Highlight`), the box can
 * say how many hit, 「/」 focuses it, Esc empties it, the light × clears it. Used by QueryBar and SearchField.
 */
import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "./primitives.tsx";
import { Kbd } from "./tooltip.tsx";

export type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  /** live (default): `onSearch` 0.3 s after typing stops · enter: only on Enter (slow lists), the box says 「回车搜索」. */
  mode?: "live" | "enter";
  /** Run the search (live: debounced; enter: on Enter; both: right after clearing). */
  onSearch?: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  /** Accessible name (default the placeholder). */
  label?: string;
  /** 「命中 12 条」 at the right end while there is a query. */
  hits?: number | null;
  /** Key that focuses the box from anywhere on the page (outside text fields), shown as a keycap: "/". */
  shortcut?: string;
  size?: "sm" | "md";
  /** subtle = grey box without a border (toolbars, side lists). */
  variant?: "default" | "subtle";
  id?: string;
  className?: string;
  /** ARIA role of the box: searchbox (default, like a native search input) · textbox (QueryBar, as before 7.14). */
  inputRole?: "searchbox" | "textbox";
};

const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export const SearchBox = /* @__PURE__ */ forwardRef<HTMLInputElement, SearchBoxProps>(function SearchBox(
  { value, onChange, mode = "live", onSearch, debounceMs = 300, placeholder = "搜索", label, hits, shortcut, size = "md", variant = "default", id, className, inputRole = "searchbox" },
  ref,
) {
  const input = useRef<HTMLInputElement | null>(null);
  const latest = useRef(onSearch);
  latest.current = onSearch;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (mode !== "live" || !latest.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current?.(value), debounceMs);
    return () => clearTimeout(timer.current);
  }, [value, mode, debounceMs]);
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== shortcut || event.ctrlKey || event.metaKey || event.altKey || typingIn(event.target)) return;
      if (!input.current || !input.current.isConnected || input.current.offsetParent === null) return;
      event.preventDefault();
      input.current.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut]);
  const setRef = (node: HTMLInputElement | null) => {
    input.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  const clear = () => {
    onChange("");
    clearTimeout(timer.current);
    latest.current?.("");
  };
  const tail: ReactNode =
    value && hits !== undefined && hits !== null ? (
      <span className="aui-search-hits">命中 {hits.toLocaleString()} 条</span>
    ) : mode === "enter" && value ? (
      <span className="aui-search-enter">回车搜索</span>
    ) : !value && shortcut ? (
      <Kbd keys={shortcut} size="sm" flat />
    ) : undefined;
  return (
    <Input
      ref={setRef}
      id={id}
      type="text"
      role={inputRole === "searchbox" ? "searchbox" : undefined}
      size={size}
      value={value}
      placeholder={mode === "enter" && !value ? `${placeholder}（回车搜索）` : placeholder}
      aria-label={label ?? placeholder}
      enterKeyHint="search"
      boxClassName={["aui-search-box", variant === "subtle" ? "aui-search-subtle" : "", className].filter(Boolean).join(" ")}
      prefix={<Search aria-hidden="true" />}
      suffix={tail}
      clearable
      onClear={clear}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(timer.current);
          latest.current?.(value);
        } else if (e.key === "Escape" && value) {
          e.preventDefault();
          e.stopPropagation();
          clear();
        }
      }}
    />
  );
});

/** Escape a query for use in a RegExp. */
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Split `text` into plain / matched parts (case-insensitive; whitespace separates several terms). */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(escapeRe);
  if (!terms.length || !text) return [{ text, hit: false }];
  const split = new RegExp(`(${terms.join("|")})`, "gi");
  const whole = new RegExp(`^(?:${terms.join("|")})$`, "i");
  return text.split(split).filter((part) => part !== "").map((part) => ({ text: part, hit: whole.test(part) }));
}
/** The text with the search terms marked (soft amber). */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) => (part.hit ? <mark key={i} className="aui-hl">{part.text}</mark> : <span key={i}>{part.text}</span>))}
    </>
  );
}
