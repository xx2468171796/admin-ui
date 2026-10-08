"use client";
/** Command palette pieces: topbar trigger, result row, footer hints. */
import { forwardRef, type ReactNode } from "react";
import { CircleAlert, Clock3, LayoutGrid, Search, SearchX, Zap } from "lucide-react";
import { highlightRanges } from "./command-core.ts";
import type { CommandItem, PaletteChip, PaletteRow } from "./command-palette-model.ts";
import { SkeletonBlock } from "./loading.tsx";
import { Kbd } from "./tooltip.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/command-palette.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/command-palette.css";

/** Title with the query words bold + underlined (no background, ink colour). */
export function HitText({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) out.push(text.slice(at, start));
    out.push(
      <mark key={start} className="aui-cmdk-hit">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/** Search-box look (240 wide) with Mod+K at the right; a 36px magnifier on phones. */
export const CommandTrigger = /* @__PURE__ */ forwardRef<HTMLButtonElement, { onOpen: () => void; open: boolean }>(function CommandTrigger(
  { onOpen, open },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className="aui-cmdk-trigger aui-command-trigger"
      aria-label="搜索与命令"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Control+K Meta+K"
      onClick={onOpen}
    >
      <Search aria-hidden="true" size={15} />
      <span className="aui-cmdk-trigger-text" aria-hidden="true">
        搜索…
      </span>
      <Kbd keys="Mod+K" size="sm" />
    </button>
  );
});

const kindIcon = (kind?: string) => (kind === "page" ? <LayoutGrid size={14} /> : <Zap size={14} />);

export type RowProps = {
  row: PaletteRow;
  id: string;
  active: boolean;
  query: string;
  busy: boolean;
  providerLabel: (id?: string) => string;
  providerIcon: (id: string) => ReactNode;
  onHover: () => void;
  onPick: () => void;
};

function rowIcon(row: PaletteRow, providerIcon: RowProps["providerIcon"], item?: CommandItem): ReactNode {
  if (row.type === "slow") return <Clock3 size={14} />;
  if (row.type === "error") return <CircleAlert size={14} />;
  if (row.type === "search-all") return <Search size={14} />;
  if (!item) return null;
  if (item.icon) return item.icon;
  const fromProvider = row.type === "item" && row.source !== "command" ? providerIcon(item.source ?? row.source) : null;
  return fromProvider ?? kindIcon(item.kind);
}

/** One 40px row (48 on phones): 26px icon tile + title (hits marked) + subtitle + right note / keycap; active shows ↵. */
export function PaletteRowView({ row, id, active, query, busy, providerLabel, providerIcon, onHover, onPick }: RowProps) {
  if (row.type === "skeleton")
    return (
      <div className="aui-cmdk-row" data-skeleton="" aria-hidden="true">
        <span className="aui-cmdk-tile" data-skeleton="" />
        <SkeletonBlock width="46%" height={10} />
      </div>
    );
  const item = row.type === "item" ? row.item : undefined;
  const title =
    row.type === "slow"
      ? `${providerLabel(row.providerId)}较慢，回车看全部`
      : row.type === "error"
        ? `${providerLabel(row.providerId)}搜索出错 · 重试`
        : row.type === "search-all"
          ? row.title
          : (item?.title ?? "");
  const brand = (row.type === "item" && row.brand) || (row.type === "item" && row.source === "empty");
  return (
    <div
      role="option"
      id={id}
      aria-selected={active}
      aria-disabled={busy || undefined}
      className="aui-cmdk-row"
      data-active={active || undefined}
      data-type={row.type}
      onMouseMove={active ? undefined : onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={busy ? undefined : onPick}
    >
      <span className="aui-cmdk-tile" data-brand={brand || undefined} aria-hidden="true">
        {rowIcon(row, providerIcon, item)}
      </span>
      <span className="aui-cmdk-text">
        <span className="aui-cmdk-title">{item ? <HitText text={item.title} query={row.type === "item" && row.source === "empty" ? "" : query} /> : title}</span>
        {item?.subtitle && <small className="aui-cmdk-sub">{item.subtitle}</small>}
        {row.type === "error" && row.message && <small className="aui-cmdk-sub">{row.message}</small>}
      </span>
      <span className="aui-cmdk-right">
        {active && busy ? (
          <span className="aui-cmdk-meta">正在执行…</span>
        ) : (
          <>
            {item?.shortcut ? <Kbd keys={item.shortcut} size="sm" /> : item?.meta && <span className="aui-cmdk-meta">{item.meta}</span>}
            <Kbd keys="↵" size="sm" className="aui-cmdk-enter" />
          </>
        )}
      </span>
    </div>
  );
}

/** Footer key hints (hidden on phones). */
export function PaletteFooter({ scopes }: { scopes: boolean }) {
  return (
    <div className="aui-cmdk-foot" aria-hidden="true">
      <span>
        <Kbd keys={["↑", "↓"]} size="sm" />
        选择
      </span>
      <span>
        <Kbd keys="↵" size="sm" />
        打开
      </span>
      {scopes && (
        <span>
          <Kbd keys="Tab" size="sm" />
          换范围
        </span>
      )}
      <span className="aui-cmdk-grow" />
      <span>
        <Kbd keys="Esc" size="sm" />
        关闭
      </span>
    </div>
  );
}

/** 「全部 6 · 客户 4 · 文档 1」: Tab / Shift+Tab in the input cycles them, so they stay out of the tab order. */
export function ScopeChips({ chips, scope, onScope }: { chips: readonly PaletteChip[]; scope: string; onScope: (id: string) => void }) {
  if (!chips.length) return null;
  const current = chips.some((c) => c.id === scope) ? scope : "all";
  return (
    <div className="aui-cmdk-scopes" role="toolbar" aria-label="搜索范围">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          tabIndex={-1}
          aria-pressed={current === chip.id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onScope(chip.id)}
        >
          {chip.label} {chip.count}
        </button>
      ))}
    </div>
  );
}

/** Nothing matched: say what was searched; the fallback rows follow in the list. */
export function NoMatch({ q, hint }: { q: string; hint: boolean }) {
  return (
    <div className="aui-cmdk-empty">
      <span className="aui-cmdk-empty-icon" aria-hidden="true">
        <SearchX size={18} />
      </span>
      <strong>没找到「{q}」</strong>
      <span>{hint ? "再多输入一个字试试（至少 1 个汉字或 2 个字母）" : "页面、命令和你能看的内容里都没有"}</span>
    </div>
  );
}
